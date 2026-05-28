use super::super::{
    cache::{
        ensure_registered_session_table_rows, load_core_csv_table, load_core_source_data,
        loaded_csv_rows, session_for_mut, sessions,
    },
    model::{is_comment_row, string_from_row, SourceOptionsContext},
};
use super::resources_shared::source_option_resource_ref;
use crate::{
    errors::{AppError, AppResult},
    io::read_csv_data,
    models::{CsvTableKey, ResourceSource, SourceOptionGroup, SourceOptionOrigin, CSV_TABLES},
};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeSet, HashMap},
    path::Path,
};

pub fn query_csv_source_options(
    session_id: &str,
    source: &str,
    current_values: &[String],
    search: Option<String>,
    limit: Option<usize>,
) -> AppResult<Vec<SourceOptionGroup>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    let (table, column) = parse_csv_source(source)?;
    let table_key = table.as_str();
    ensure_registered_session_table_rows(session, table)?;
    let csv = session
        .csv_tables
        .get(table_key)
        .ok_or_else(|| AppError::message(format!("unknown table: {table_key}")))?;
    ensure_source_column(&csv.header, table_key, column)?;
    let search = search.unwrap_or_default().to_lowercase();
    let limit = limit.unwrap_or(200);
    let mut seen = BTreeSet::new();
    let mut groups = Vec::new();
    let current_options = source_options_from_values(
        SourceOptionOrigin::Current,
        current_values,
        &search,
        limit,
        &mut seen,
    );
    if !current_options.is_empty() {
        groups.push(SourceOptionGroup {
            label: "当前值".to_string(),
            options: current_options,
        });
    }
    let rows = loaded_csv_rows(csv, table_key)?;
    let options = source_options_from_rows(
        ResourceSource::Mod,
        rows,
        column,
        SourceOptionsContext {
            core: None,
            limit,
            search: &search,
            seen: &mut seen,
            session: Some(session),
            table,
        },
    )?;
    if !options.is_empty() {
        groups.push(SourceOptionGroup {
            label: "当前 Mod".to_string(),
            options,
        });
    }
    if let Some(root) = session.manifest.starsector_root.as_ref() {
        let core_csv = load_core_csv_table(root, table)?;
        if let Some(core_csv) = core_csv {
            ensure_source_column(&core_csv.header, table_key, column)?;
            let core_rows = loaded_csv_rows(&core_csv, table_key)?;
            let core_data = load_core_source_data(root, table)?;
            let options = source_options_from_rows(
                ResourceSource::Core,
                core_rows,
                column,
                SourceOptionsContext {
                    core: Some(core_data),
                    limit,
                    search: &search,
                    seen: &mut seen,
                    session: Some(session),
                    table,
                },
            )?;
            if !options.is_empty() {
                groups.push(SourceOptionGroup {
                    label: "原版".to_string(),
                    options,
                });
            }
        }
    }
    Ok(groups)
}

fn parse_csv_source(source: &str) -> AppResult<(CsvTableKey, &str)> {
    let trimmed = source.strip_prefix("csv:").unwrap_or(source);
    let (table, column) = trimmed
        .split_once('.')
        .ok_or_else(|| AppError::message(format!("invalid csv source: {source}")))?;
    let table = CsvTableKey::from_key(table)
        .ok_or_else(|| AppError::message(format!("unknown csv source table: {table}")))?;
    Ok((table, column))
}

fn ensure_source_column(header: &[String], table: &str, column: &str) -> AppResult<()> {
    if header.iter().any(|field| field == column) {
        return Ok(());
    }
    Err(AppError::message(format!(
        "csv source column does not exist: {table}.{column}"
    )))
}

fn source_options_from_values(
    origin: SourceOptionOrigin,
    values: &[String],
    search: &str,
    limit: usize,
    seen: &mut BTreeSet<String>,
) -> Vec<crate::models::SourceOption> {
    values
        .iter()
        .filter(|value| !value.trim().is_empty())
        .filter(|value| search.is_empty() || value.to_lowercase().contains(search))
        .filter(|value| seen.insert((*value).clone()))
        .take(limit)
        .map(|value| crate::models::SourceOption {
            label: value.clone(),
            value: value.clone(),
            description: None,
            resource_ref: None,
            origin,
        })
        .collect()
}

fn source_options_from_rows(
    resource_source: ResourceSource,
    rows: &[super::super::model::SessionCsvRow],
    column: &str,
    context: SourceOptionsContext<'_>,
) -> AppResult<Vec<crate::models::SourceOption>> {
    let metadata = source_metadata_map(column, context.session)?;
    let is_id_column = column == "id";
    let mut options = Vec::new();
    for row in rows.iter().filter(|row| !is_comment_row(&row.row)) {
        let Some(cell_value) = row.row.get(column).and_then(serde_json::Value::as_str) else {
            continue;
        };
        if cell_value.trim().is_empty() {
            continue;
        }
        let values: Vec<&str> = if is_id_column {
            vec![cell_value]
        } else {
            cell_value
                .split(',')
                .map(|v| v.trim())
                .filter(|v| !v.is_empty())
                .collect()
        };
        for value in values {
            if !context.search.is_empty() && !value.to_lowercase().contains(context.search) {
                continue;
            }
            if !context.seen.insert(value.to_string()) {
                continue;
            }
            if options.len() >= context.limit {
                break;
            }
            let label = source_option_label(row, column, value, metadata.as_ref());
            let description = source_option_description(value, metadata.as_ref());
            let resource_ref = if is_id_column {
                source_option_resource_ref(
                    resource_source,
                    context.table,
                    value,
                    &row.row,
                    context.core.as_ref(),
                    context.session,
                )?
            } else {
                None
            };
            options.push(crate::models::SourceOption {
                label,
                value: value.to_string(),
                description,
                resource_ref,
                origin: resource_source.into(),
            });
        }
        if options.len() >= context.limit {
            break;
        }
    }
    Ok(options)
}

fn source_option_label(
    row: &super::super::model::SessionCsvRow,
    column: &str,
    value: &str,
    metadata: Option<&HashMap<String, SourceOptionMetadata>>,
) -> String {
    if column == "id" {
        let name = row
            .row
            .get("name")
            .or_else(|| row.row.get("hullName"))
            .or_else(|| row.row.get("displayName"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        if name.trim().is_empty() || name == value {
            value.to_string()
        } else {
            format!("{name} ({value})")
        }
    } else if let Some(metadata) = source_option_metadata(value, metadata) {
        format!("{value} ({})", metadata.label)
    } else {
        value.to_string()
    }
}

fn source_option_description(
    value: &str,
    metadata: Option<&HashMap<String, SourceOptionMetadata>>,
) -> Option<String> {
    source_option_metadata(value, metadata).and_then(|metadata| metadata.description)
}

fn source_option_metadata(
    value: &str,
    metadata: Option<&HashMap<String, SourceOptionMetadata>>,
) -> Option<SourceOptionMetadata> {
    metadata
        .and_then(|metadata| metadata.get(value))
        .cloned()
        .or_else(|| generated_tag_metadata(value))
}

fn source_metadata_map(
    column: &str,
    session: Option<&super::super::model::ProjectSession>,
) -> AppResult<Option<HashMap<String, SourceOptionMetadata>>> {
    match column {
        "tags" => session.map(build_tag_metadata_map).transpose(),
        "hints" => Ok(Some(build_hint_metadata_map())),
        _ => Ok(None),
    }
}

#[derive(Clone)]
struct SourceOptionMetadata {
    label: String,
    description: Option<String>,
}

fn build_tag_metadata_map(
    session: &super::super::model::ProjectSession,
) -> AppResult<HashMap<String, SourceOptionMetadata>> {
    let mut metadata = well_known_metadata_map(WELL_KNOWN_TAG_LABELS);
    add_core_blueprint_package_metadata(&mut metadata, session)?;
    add_mod_blueprint_package_metadata(&mut metadata, session)?;
    add_faction_blueprint_metadata(&mut metadata, session);
    Ok(metadata)
}

fn build_hint_metadata_map() -> HashMap<String, SourceOptionMetadata> {
    well_known_metadata_map(WELL_KNOWN_HINT_LABELS)
}

fn add_core_blueprint_package_metadata(
    metadata: &mut HashMap<String, SourceOptionMetadata>,
    session: &super::super::model::ProjectSession,
) -> AppResult<()> {
    let Some(root) = session.manifest.starsector_root.as_ref() else {
        return Ok(());
    };
    let Some(table) = load_core_csv_table(root, CsvTableKey::SpecialItems)? else {
        return Ok(());
    };
    let Some(rows) = table.rows.as_ref() else {
        return Ok(());
    };
    for row in rows {
        add_blueprint_package_metadata(metadata, &row.row);
    }
    Ok(())
}

fn add_mod_blueprint_package_metadata(
    metadata: &mut HashMap<String, SourceOptionMetadata>,
    session: &super::super::model::ProjectSession,
) -> AppResult<()> {
    let rel_path = registered_csv_rel_path(CsvTableKey::SpecialItems)?;
    let csv = read_csv_data(&Path::new(&session.manifest.mod_root).join(rel_path))?;
    for row in &csv.rows {
        add_blueprint_package_metadata(metadata, row);
    }
    Ok(())
}

fn registered_csv_rel_path(table: CsvTableKey) -> AppResult<&'static str> {
    CSV_TABLES
        .iter()
        .find_map(|(key, rel_path)| (*key == table).then_some(*rel_path))
        .ok_or_else(|| {
            AppError::message(format!("unknown registered CSV table: {}", table.as_str()))
        })
}

fn add_blueprint_package_metadata(
    metadata: &mut HashMap<String, SourceOptionMetadata>,
    row: &Map<String, Value>,
) {
    if !row_has_tag(row, "package_bp") {
        return;
    }
    let Some(tag) = string_from_row(row, "plugin params") else {
        return;
    };
    let Some(name) = string_from_row(row, "name") else {
        return;
    };
    metadata.insert(
        tag,
        SourceOptionMetadata {
            label: name,
            description: string_from_row(row, "desc"),
        },
    );
}

fn row_has_tag(row: &Map<String, Value>, expected: &str) -> bool {
    row.get("tags")
        .and_then(Value::as_str)
        .is_some_and(|tags| tags.split(',').map(str::trim).any(|tag| tag == expected))
}

fn add_faction_blueprint_metadata(
    metadata: &mut HashMap<String, SourceOptionMetadata>,
    session: &super::super::model::ProjectSession,
) {
    for (tag, faction_id) in &session.tag_map {
        if metadata.contains_key(tag) {
            continue;
        }
        let faction_name = session
            .faction_files
            .get(faction_id)
            .and_then(|v| v.get("displayName"))
            .or_else(|| {
                session
                    .faction_files
                    .get(faction_id)
                    .and_then(|v| v.get("displayNameLong"))
            })
            .and_then(serde_json::Value::as_str)
            .unwrap_or(faction_id);
        metadata.insert(
            tag.clone(),
            SourceOptionMetadata {
                label: format!("{faction_name}蓝图"),
                description: Some(format!("由势力 {faction_name} 推导的蓝图标签。")),
            },
        );
    }
}

fn well_known_metadata_map(
    metadata: &[(&str, &str, &str)],
) -> HashMap<String, SourceOptionMetadata> {
    metadata
        .iter()
        .map(|(value, label, description)| {
            (
                value.to_string(),
                SourceOptionMetadata {
                    label: label.to_string(),
                    description: Some(description.to_string()),
                },
            )
        })
        .collect()
}

fn generated_tag_metadata(value: &str) -> Option<SourceOptionMetadata> {
    let (prefix, index) = split_numeric_suffix(value)?;
    let (label, description) = GENERATED_TAG_PATTERNS.iter().find_map(|pattern| {
        (pattern.prefix == prefix).then_some((pattern.label, pattern.description))
    })?;
    Some(SourceOptionMetadata {
        label: format!("{label} {index}"),
        description: Some(description.to_string()),
    })
}

fn split_numeric_suffix(value: &str) -> Option<(&str, u32)> {
    let split_at = value
        .char_indices()
        .rev()
        .find_map(|(index, ch)| (!ch.is_ascii_digit()).then_some(index + ch.len_utf8()))?;
    if split_at == value.len() || split_at == 0 {
        return None;
    }
    let number = value[split_at..].parse::<u32>().ok()?;
    Some((&value[..split_at], number))
}

struct GeneratedTagPattern {
    prefix: &'static str,
    label: &'static str,
    description: &'static str,
}

static GENERATED_TAG_PATTERNS: &[GeneratedTagPattern] = &[
    GeneratedTagPattern {
        prefix: "kinetic",
        label: "动能武器强度",
        description: "仅适用于武器。动能武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "he",
        label: "高爆武器强度",
        description: "仅适用于武器。高爆武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "energy",
        label: "能量武器强度",
        description: "仅适用于武器。能量武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "missile",
        label: "导弹武器强度",
        description: "仅适用于武器。导弹武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "beam",
        label: "光束武器强度",
        description: "仅适用于武器。光束武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "pd",
        label: "点防御武器强度",
        description: "仅适用于武器。点防御武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "strike",
        label: "打击武器强度",
        description: "仅适用于武器。打击武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "rocket",
        label: "火箭武器强度",
        description: "仅适用于武器。火箭武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "utility",
        label: "功能武器强度",
        description: "仅适用于武器。功能武器强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "fighter",
        label: "战斗机强度",
        description: "仅适用于战机联队。战斗机强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "interceptor",
        label: "截击机强度",
        description: "仅适用于战机联队。截击机强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "bomber",
        label: "轰炸机强度",
        description: "仅适用于战机联队。轰炸机强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "support",
        label: "支援机强度",
        description: "仅适用于战机联队。支援机强度排序标签。",
    },
    GeneratedTagPattern {
        prefix: "substrate_",
        label: "渊幕底物武器强度",
        description: "仅适用于武器。渊幕底物武器强度排序标签。",
    },
];

static WELL_KNOWN_TAG_LABELS: &[(&str, &str, &str)] = &[
    (
        "base_bp",
        "基础蓝图",
        "所有势力默认拥有的蓝图。玩家也默认拥有。",
    ),
    (
        "rare_bp",
        "稀有蓝图",
        "可在遗迹中找到或打捞科研空间站得到的蓝图。",
    ),
    ("no_bp", "无蓝图", "不存在单独的蓝图。注意，依然可能被蓝图包所包含。"),
    ("no_drop", "不可掉落", "不会作为战斗掉落物生成，也不会在遗迹中找到或在打捞空间站找到。"),
    (
        "no_drop_salvage",
        "打捞不掉落",
        "不会在残骸区找到。",
    ),
    (
        "no_loss_from_combat",
        "战斗不损失",
        "仅适用于货物。不会因为舰队战斗损失。",
    ),
    (
        "restricted",
        "受限(RES)",
        "表示该组件是特殊的，仅作为标记。",
    ),
    (
        "codex_unlockable",
        "百科可解锁",
        "在百科中默认锁定，需要遇见或获取后解锁。",
    ),
    (
        "hide_in_codex",
        "在百科中隐藏",
        "仅适用于武器。舰船的隐藏在 hints 中定义。",
    ),
    ("show_in_codex", "显示于百科", "仅适用于武器。强制该条目在百科中显示。"),
    (
        "show_in_codex_as_ship",
        "按舰船显示于百科",
        "让该条目在百科中按舰船条目显示。",
    ),
    (
        "show_in_planet_list",
        "显示于行星列表",
        "仅适用于市场条件。会显示在行星列表中。",
    ),
    ("no_autofit", "不自动装配", "仅适用于舰船。不会触发随机装配。"),
    ("no_sell", "不可出售", "市场不会出售该组件。"),
    ("no_dealer", "不可交易", "交易商不会交易该组件。"),
    ("no_build_in", "不可内置", "仅适用于舰船差距。不能作为内置插件。"),
    (
        "no_standard_data",
        "无标准数据",
        "仅适用于武器。不按标准数据方式展示或处理。",
    ),
    ("no_sim", "模拟战不可用", "仅适用于舰船。不会出现在模拟战相关选择中。"),
    (
        "no_derelict",
        "不生成遗弃船",
        "仅适用于舰船。舰船不会以遗弃船的形式生成，无论实际上是否可打捞。",
    ),
    (
        "no_battle_salvage",
        "战后不打捞",
        "仅适用于舰船。战后无法从中打捞到任何东西。",
    ),
    (
        "no_armor_schematic",
        "无装甲图示",
        "仅适用于舰船。不在解析面部中显示其装甲。",
    ),
    (
        "no_auto_penalty",
        "无自动舰船惩罚",
        "仅适用于舰船。不受任何自动舰船相关机制惩罚，包括安装 AI 核心时的部署点惩罚。",
    ),
    ("fighter", "战斗机", "仅适用于战机联队。分类为战斗机。"),
    ("interceptor", "截击机", "仅适用于战机联队。分类为截击机。"),
    ("bomber", "轰炸机", "仅适用于战机联队。分类为轰炸机。"),
    ("support", "支援机", "仅适用于战机联队。分类为支援机。"),
    (
        "attack_at_an_angle",
        "斜角攻击",
        "仅适用于战机联队。战机 AI 将环绕目标并攻击。",
    ),
    ("auto_fighter", "自动战机", "仅适用于战机联队。视为无人机，允许由自动舰船搭载。"),
    ("drone", "无人机", "仅适用于战机联队。分类为无人机。"),
    (
        "independent_of_carrier",
        "独立于航母",
        "仅适用于战机联队。战机行为不完全依赖母舰。",
    ),
    (
        "leader_no_swarm",
        "长机不聚集",
        "仅适用于战机联队。联队长机不会刻意聚集。",
    ),
    (
        "match_leader_facing",
        "匹配长机朝向",
        "仅适用于战机联队。联队僚机会匹配长机朝向。",
    ),
    ("rapid_reform", "快速重组", "仅适用于战机联队。理论上重整阵型时更快，但实际上效果非常不显著。"),
    (
        "stay_in_front_of_ship",
        "停留在舰船前方",
        "仅适用于战机联队的支援机联队。支援机会倾向保持在母舰前方，而非默认的后方。",
    ),
    ("swarm_fighter", "集群战机联队", "集群威胁的战机标签。"),
    ("wingmen_no_swarm", "僚机不聚集", "仅适用于战机联队。联队僚机不会刻意聚集。"),
    ("ind", "非势力团体", "非势力团体会携带该组件。"),
    ("merc", "雇佣兵", "非势力团体的高级雇佣兵会携带该组件。"),
    ("threat", "集群威胁", "集群威胁的战机或威胁相关内容标签。"),
    ("monster", "怪物", "怪物类特殊内容标签。"),
    ("hist1t", "历史学家 1", "让历史学家相关事件可能指出该组件的蓝图。较为稀有。"),
    ("hist2t", "历史学家 2", "让历史学家相关事件可能指出该组件的蓝图。非常稀有。"),
    ("hist3t", "历史学家 3", "让历史学家相关事件可能指出该组件的蓝图。极其稀有。"),
    ("kanta_gift", "Kanta 赠礼", "仅适用于舰船。Kanta 将接受其作为礼物。"),
    (
        "req_military",
        "需要军事市场",
        "仅适用于舰船。只会在军用市场出现。",
    ),
    ("military", "军用品", "适用于商品或殖民地设施。表示商品是军用物资，或殖民地设施作为 patrol/military/command 中的二级。"),
    ("crew", "船员", "仅适用于商品。船员货物标签。"),
    ("personnel", "人员", "仅适用于商品。人员货物标签。"),
    ("marines", "陆战队员", "仅适用于商品。陆战队员货物标签。"),
    ("food", "食品", "仅适用于商品。食品货物标签。"),
    ("luxury", "奢侈品", "仅适用于商品。奢侈品货物标签。"),
    ("medical", "医疗品", "仅适用于商品。医疗品货物标签。"),
    ("ai_core", "AI 核心", "仅适用于商品。AI 核心货物标签。"),
    ("nonecon", "非经济商品", "仅适用于商品。不作为普通经济商品处理。"),
    ("exotic", "特异商品", "仅适用于商品。特异货物标签。"),
    ("expensive", "高价值商品", "仅适用于商品。高价值货物标签。"),
    ("meta", "代码适配商品", "仅适用于商品。用于适配代码的商品标签。不应该直接在游戏出现。"),
    ("colony_item", "殖民地物品", "仅适用于特殊物品。可安装于殖民地设施的物品。"),
    ("mission_item", "任务物品", "仅适用于特殊物品。各类与任务相关的物品。"),
    ("single_bp", "单项蓝图", "仅适用于特殊物品。用于适配代码的商品标签。不应该直接在游戏出现。"),
    (
        "package_bp",
        "蓝图包",
        "仅适用于特殊物品。可能包含武器、舰船、战机联队的蓝图包。plugin params 指向关联的蓝图标签。",
    ),
    ("modspec", "插件规格", "仅适用于特殊物品。用于适配代码的商品标签。不应该直接在游戏出现。"),
    ("nanoforge", "纳米锻炉", "仅适用于特殊物品。纳米锻炉类殖民地物品。"),
    (
        "planet_search",
        "行星搜索",
        "仅适用于特殊物品。可在行星搜索面板出现。",
    ),
    ("pather1", "左径兴趣 1", "仅适用于特殊物品。卢德左径兴趣等级标签，数字越大兴趣越高，范围仅限 1/2/4/6/8/10。"),
    ("pather2", "左径兴趣 2", "仅适用于特殊物品。卢德左径兴趣等级标签，数字越大兴趣越高，范围仅限 1/2/4/6/8/10。"),
    ("pather4", "左径兴趣 4", "仅适用于特殊物品。卢德左径兴趣等级标签，数字越大兴趣越高，范围仅限 1/2/4/6/8/10。"),
    ("pather6", "左径兴趣 6", "仅适用于特殊物品。卢德左径兴趣等级标签，数字越大兴趣越高，范围仅限 1/2/4/6/8/10。"),
    ("pather8", "左径兴趣 8", "仅适用于特殊物品。卢德左径兴趣等级标签，数字越大兴趣越高，范围仅限 1/2/4/6/8/10。"),
    ("pather10", "左径兴趣 10", "仅适用于特殊物品。卢德左径兴趣等级标签，数字越大兴趣越高，范围仅限 1/2/4/6/8/10。"),
    ("battlestation", "战斗空间站", "仅适用于殖民地设施。和 station 同时使用时，表示空间站是二级战斗空间站。"),
    ("starfortress", "星堡", "仅适用于殖民地设施。和 station 同时使用时，表示空间站是三级星堡。"),
    ("station", "空间站", "仅适用于殖民地设施。表示这是一种空间站，并且会产生附属空间站实体。"),
    ("industry", "工业设施", "仅适用于殖民地设施。需要占用工业设施位置数。"),
    ("structure", "常规设施", "仅适用于殖民地设施。不需要占用工业设施位置数。"),
    ("industrial", "工业倾向", "仅适用于殖民地设施。让殖民地的被视作工业殖民地的因素增加。"),
    ("rural", "乡村倾向", "仅适用于殖民地设施。让殖民地的被视作乡村殖民地的因素增加。"),
    ("urban", "城市倾向", "仅适用于殖民地设施。让殖民地的被视作城市殖民地的因素增加。"),
    ("unraidable", "不可劫掠", "仅适用于殖民地设施。该设施无法被劫掠。"),
    (
        "uses_blueprints",
        "含有蓝图",
        "仅适用于殖民地设施。可以从该设施劫掠得到蓝图。",
    ),
    ("parent_item", "父设施", "仅适用于殖民地设施。该设施在建造界面中被视作 '一类' 殖民地设施的统一入口。"),
    ("sub_item", "子设施", "仅适用于殖民地设施。该设施在建造界面中被视作 '一类' 的殖民地设施入口内的次级标签。"),
    ("patrol", "巡逻", "仅适用于殖民地设施。作为 patrol/military/command 中的一级。"),
    ("command", "指挥", "仅适用于殖民地设施。作为 patrol/military/command 中的三级。"),
    ("cryorevival", "低温复苏设施", "仅适用于殖民地设施。低温复苏设施行业标签。"),
    ("cryosanctum", "低温避难所", "仅适用于殖民地设施。低温避难所行业标签。"),
    ("farming", "农业", "仅适用于殖民地设施。农业行业标签。"),
    ("fuelprod", "燃料生产", "仅适用于殖民地设施。燃料生产行业标签。"),
    ("grounddefenses", "地面防御", "仅适用于殖民地设施。表示该设施具备提供地面防御能力加成的效果。"),
    ("heavyindustry", "重工业", "仅适用于殖民地设施。重工业行业标签。"),
    ("lightindustry", "轻工业", "仅适用于殖民地设施。轻工业行业标签。"),
    ("mining", "采矿", "仅适用于殖民地设施。采矿行业标签。"),
    ("population", "人口", "仅适用于殖民地设施。人口行业标签。"),
    ("refining", "精炼", "仅适用于殖民地设施。精炼行业标签。"),
    ("spaceport", "太空港", "仅适用于殖民地设施。太空港行业标签。"),
    ("tactical_bombardment", "可被战术轰炸", "仅适用于殖民地设施。表示该设施可被选为战术轰炸目标。"),
    ("techmining", "技术采矿", "仅适用于殖民地设施。技术采矿行业标签。"),
    ("waystation", "中转站", "仅适用于殖民地设施。中转站行业标签。"),
    ("active_defenses", "主动防御", "仅适用于技能。具有主动防御能力。"),
    ("ai_core_only", "仅 AI 核心", "仅适用于技能。仅 AI 核心可用的技能。"),
    ("ballistic_weapons", "实弹武器", "仅适用于技能。加成实弹武器的能力。"),
    ("carrier", "航母", "仅适用于技能。加成航母能力加成。"),
    (
        "elite_player_only",
        "仅玩家精英",
        "仅适用于技能。仅玩家可将其精英化。",
    ),
    ("energy_weapons", "能量武器", "仅适用于技能。加成能量武器的能力。"),
    ("missile_weapons", "导弹武器", "仅适用于技能。加成导弹武器的能力。"),
    ("npc_only", "仅 NPC", "仅适用于技能。仅 NPC 可用的技能。"),
    ("phase", "相位", "仅适用于技能。加成相位舰的能力。"),
    ("player_only", "仅玩家", "仅适用于技能。仅玩家可用的技能。"),
    ("spec", "专业化", "仅适用于技能。该标签已不再使用。"),
    ("deprecated", "已废弃", "仅适用于技能。该技能已废弃。"),
    ("damage", "受损", "仅适用于舰船插件。被归类为受损类。"),
    ("defensive", "防御", "仅适用于舰船插件。被归类为防御类。"),
    ("offensive", "进攻", "仅适用于舰船插件。被归类为进攻类。"),
    ("movement", "机动", "仅适用于舰船插件。被归类为机动类。"),
    ("engines", "引擎", "仅适用于舰船插件。被归类为引擎类。"),
    ("shields", "护盾", "仅适用于舰船插件。被归类为护盾类。"),
    ("weapons", "武器", "仅适用于舰船插件。被归类为武器类。"),
    ("standard", "标准插件", "仅适用于舰船插件。所有势力默认拥有的插件。"),
    ("special", "特殊插件", "仅适用于舰船插件。被归类为特殊类。"),
    ("dmod", "D 插", "仅适用于舰船插件。被归类为 D-Mod 插件。"),
    ("civ", "民用 D 插", "仅适用于舰船插件。与 dmod 同时使用时，让该 dmod 会在民用船上出现。"),
    ("civ_package", "民用插件包", "仅适用于舰船插件。被归类为民用插件包。"),
    ("civOnly", "仅民用 D 插", "仅适用于舰船插件。与 dmod 同时使用时，让该 dmod 只会在民用船上出现，不会在非民用船上出现。"),
    ("non_phase", "非相位", "仅适用于舰船插件。无法在相位舰上安装。"),
    ("notPhase", "非相位 D 插", "仅适用于舰船插件。与 dmod 同时使用时，让该 dmod 不会在相位舰上出现。"),
    ("notAuto", "非自动舰船 D 插", "仅适用于舰船插件。与 dmod 同时使用时，让该 dmod 不会在自动舰船上出现。"),
    ("req_spaceport", "需要太空港", "仅适用于舰船插件。需要在太空港中才可安装或卸载。"),
    ("reqShields", "需要护盾", "仅适用于舰船插件。需要舰船拥有护盾才可安装。"),
    ("damageStruct", "结构伤害 D 插", "仅适用于舰船插件。相较于其它 dmod，有更高概率出现。"),
    (
        "destroyedDamageAlways",
        "摧毁必带 D 插",
        "仅适用于舰船插件。舰船摧毁后必定带有的 dmod。",
    ),
    (
        "fighterBayDamage",
        "甲板 D 插",
        "仅适用于舰船插件。与 dmod 同时使用时，让该 dmod 只会在带有甲板的舰船上出现。",
    ),
    ("phaseDamage", "相位 D 插", "仅适用于舰船插件。与 dmod 同时使用时，让该 dmod 只会在相位舰上出现。"),
    ("phase_brawler", "相位搏斗者", "仅适用于舰船插件。让 AI 倾向于更积极的战斗方式。"),
    ("peak_time", "峰值 D 插", "仅适用于舰船插件。与 dmod 同时使用时，让该 dmod 只会在有峰值时间限制的舰船上出现。"),
    ("shrouded", "渊幕", "仅适用于舰船插件。渊幕原种相关插件标签。"),
    (
        "codex_require_related",
        "百科连带显示",
        "仅适用于舰船插件。只需要接触过携带该插件的舰船，即可显示，而不必实际拥有该插件或带有该插件的舰船。",
    ),
    (
        "limited_tooltip_if_locked",
        "未解锁时限制提示",
        "仅适用于舰船。百科未解锁时，只显示非常有限的描述内容。",
    ),
    (
        "module_hull_bar_only",
        "仅模块舰体条",
        "仅适用于舰船。只显示结构条。",
    ),
    (
        "center_diamond_on_hull_center",
        "菱形居中",
        "仅适用于舰船。战术图标菱形以舰体中心为准。",
    ),
    (
        "full_cr_recovery",
        "完整 CR 恢复",
        "仅适用于舰船。战斗结束后恢复完整战备值。",
    ),
    (
        "special_allows_system_use",
        "特殊允许系统",
        "仅适用于舰船。让 AI 在右键战术系统启动时，允许使用 F 战术系统。",
    ),
    (
        "system_allows_special_use",
        "系统允许特殊",
        "仅适用于舰船。让 AI 在 F 战术系统启动时，允许使用右键战术系统。",
    ),
    ("uses_damper_ai", "使用阻尼 AI", "仅适用于战术系统。使用阻尼类 AI。"),
    ("burn-", "降低最大航速", "仅适用于能力。降低最大航速。"),
    ("burn+", "提高最大航速", "仅适用于能力。提高最大航速。"),
    ("sensors-", "降低感应强度", "仅适用于能力。降低感应强度。"),
    ("sensors+", "提高感应强度", "仅适用于能力。提高感应强度。"),
    ("stealth-", "降低隐蔽", "仅适用于能力。降低隐蔽效果。"),
    ("stealth+", "提高隐蔽", "仅适用于能力。提高隐蔽效果。"),
    (
        "disabled_by_interdict",
        "可被阻断脉冲禁用",
        "仅适用于能力。能力会被阻断脉冲脉冲所打断。",
    ),
    ("fixed_range", "固定射程", "仅适用于武器。射程不受任何因素影响。"),
    (
        "fires_one_burst",
        "单轮爆发",
        "仅适用于武器。一般只会在 DEM 弹头出现。一次发射一个完整爆发周期。",
    ),
    ("damage_soft_flux", "软幅能伤害", "仅适用于武器。造成软幅能伤害。"),
    ("damage_special", "特殊伤害", "仅适用于武器。不显示伤害数值。"),
    ("fragment", "碎片", "仅适用于武器。接入集群威胁的碎片类武器机制。"),
    ("fragment_glow", "碎片发光", "仅适用于武器。接入集群威胁的碎片类武器机制，且碎片发光。"),
    ("lidar", "激光雷达", "仅适用于武器。激光雷达武器标签。"),
    ("LR", "远程", "仅适用于武器。让 AI 倾向于和其它远程武器分为同一武器组。"),
    ("SR", "近程", "仅适用于武器。让 AI 倾向于和其它近程武器分为同一武器组。"),
    ("pusherplate", "推力板", "仅适用于武器。该武器是某种猎户座驱动式战术系统的推力板。"),
    ("reload_1pt", "导弹装填机 1 消耗", "仅适用于武器。当导弹自动装填机恢复其备弹量时，固定消耗 1 点资源。"),
    ("reload_1_and_a_half_pt", "导弹装填机 1.5 消耗", "仅适用于武器。当导弹自动装填机恢复其备弹量时，固定消耗 1.5 点资源。"),
    ("reload_2pt", "导弹装填机 2 消耗", "仅适用于武器。当导弹自动装填机恢复其备弹量时，固定消耗 2 点资源。"),
    ("reload_3pt", "导弹装填机 3 消耗", "仅适用于武器。当导弹自动装填机恢复其备弹量时，固定消耗 3 点资源。"),
    ("reload_4pt", "导弹装填机 4 消耗", "仅适用于武器。当导弹自动装填机恢复其备弹量时，固定消耗 4 点资源。"),
    ("reload_5pt", "导弹装填机 5 消耗", "仅适用于武器。当导弹自动装填机恢复其备弹量时，固定消耗 5 点资源。"),
    ("reload_6pt", "导弹装填机 6 消耗", "仅适用于武器。当导弹自动装填机恢复其备弹量时，固定消耗 6 点资源。"),
    ("no_reload", "不适用于导弹装填机", "仅适用于武器。被导弹自动装填机强制忽略。"),
];

static WELL_KNOWN_HINT_LABELS: &[(&str, &str, &str)] = &[
    (
        "PD",
        "点防御",
        "仅适用于武器。会自动对导弹开火，且优先对导弹开火。",
    ),
    (
        "PD_ALSO",
        "兼作点防御",
        "仅适用于武器。与 PD 一同使用时才有效，优先对非导弹开火，其次才是对导弹开火。",
    ),
    (
        "PD_ONLY",
        "仅点防御",
        "仅适用于武器。与 PD 一同使用时才有效，只会对导弹开火。",
    ),
    (
        "STRIKE",
        "打击武器",
        "仅适用于武器。让 AI 认为该武器具备某种斩杀性质，且尽可能避免对战机和护卫舰开火。",
    ),
    (
        "USE_VS_FRIGATES",
        "可对抗护卫舰",
        "仅适用于武器。与 STRIKE 一同使用时才有效，不再避免对护卫舰开火。",
    ),
    (
        "ANTI_FTR",
        "优先对抗战机",
        "仅适用于武器。优先对战机开火。与 STRIKE 一同使用时，不再避免对战机开火。",
    ),
    ("BOMB", "炸弹", "仅适用于武器。标记为炸弹类武器。"),
    (
        "SYSTEM",
        "系统武器",
        "仅适用于武器。表示这是一个系统武器，且还会自动在百科中隐藏。",
    ),
    (
        "DO_NOT_AIM",
        "无需瞄准",
        "仅适用于武器。让 AI 认为这是一个制导武器，无需瞄准目标即可开火。",
    ),
    (
        "DIRECT_AIM",
        "直接瞄准",
        "仅适用于武器。让 AI 直接瞄准目标。",
    ),
    (
        "NO_AUTO_FIRE",
        "不自动开火",
        "仅适用于武器。让 AI 不自动开火。",
    ),
    (
        "NO_MANUAL_FIRE",
        "不可手动开火",
        "仅适用于武器。玩家不能手动开火。",
    ),
    (
        "DO_NOT_CONSERVE",
        "不节省弹药",
        "仅适用于武器。AI 不按节省弹药逻辑保留弹药。",
    ),
    (
        "CONSERVE_1",
        "节省弹药 1",
        "仅适用于武器。让 AI 倾向于保留至少 1 轮发射的弹药。",
    ),
    (
        "CONSERVE_2",
        "节省弹药 2",
        "仅适用于武器。让 AI 倾向于保留至少 2 轮发射的弹药。",
    ),
    (
        "CONSERVE_3",
        "节省弹药 3",
        "仅适用于武器。让 AI 倾向于保留至少 3 轮发射的弹药。",
    ),
    (
        "CONSERVE_4",
        "节省弹药 4",
        "仅适用于武器。让 AI 倾向于保留至少 4 轮发射的弹药。",
    ),
    (
        "CONSERVE_5",
        "节省弹药 5",
        "仅适用于武器。让 AI 倾向于保留至少 5 轮发射的弹药。",
    ),
    (
        "CONSERVE_ALL",
        "节省全部弹药",
        "仅适用于武器。AI 尽量保留全部弹药。",
    ),
    (
        "CONSERVE_FOR_ANTI_ARMOR",
        "节省反装甲弹药",
        "仅适用于武器。与 CONSERVE_ 系列 hints 同时使用时，AI 倾向为反装甲目标保留弹药。",
    ),
    (
        "FIRE_WHEN_INEFFICIENT",
        "频繁开火",
        "仅适用于武器。即使命中收益不大或伤害效率较低，也允许开火。",
    ),
    (
        "DANGEROUS",
        "危险武器",
        "仅适用于武器。让 AI 在被该武器指向时倾向于认为自己处境危险。",
    ),
    (
        "IMPORTANT",
        "重要武器",
        "仅适用于武器。让 AI 更倾向于直接操作该武器，而非自动开火。",
    ),
    (
        "GROUP_ALTERNATING",
        "武器组交替开火",
        "仅适用于武器。含有该武器的武器组默认设为交替开火。",
    ),
    (
        "GROUP_LINKED",
        "武器组同时开火",
        "仅适用于武器。含有该武器的武器组默认设为同时开火。",
    ),
    ("GUIDED_POOR", "弱制导", "仅适用于武器。DO_NOT_AIM 的弱化版，让 AI 认为目标在一定角度范围内即可开火。"),
    ("HEATSEEKER", "追尾", "仅适用于武器。让 AI 认为这种武器发射的弹体会追尾目标的引擎。对于导弹武器，将修改其飞行 AI 为追尾。"),
    (
        "MISSILE_SPREAD",
        "导弹散开",
        "仅适用于武器。让 AI 认为这种武器发射的弹体会散开。",
    ),
    (
        "RANGE_FROM_SHIP_RADIUS",
        "射程从舰体半径计算",
        "仅适用于武器。让 AI 基于舰船半径计算武器射程，而非根据实际武器的位置计算。",
    ),
    (
        "RANGE_FROM_TARGETING_OVAL",
        "射程从瞄准椭圆计算",
        "仅适用于武器。让 AI 基于舰船凸包椭圆计算武器射程，而非根据实际武器的位置计算。",
    ),
    (
        "USE_LESS_VS_SHIELDS",
        "少用于护盾",
        "仅适用于武器。让 AI 只会在备弹量满 (如果有备弹量) 时才对护盾开火。",
    ),
    (
        "SHOW_IN_CODEX",
        "显示于百科",
        "仅适用于武器。在百科中显示该条目。",
    ),
    (
        "HIDE_IN_CODEX",
        "隐藏于百科",
        "仅适用于舰船。在百科中隐藏该条目。",
    ),
    (
        "ALWAYS_PANIC",
        "总是恐慌",
        "仅适用于舰船。舰船 AI 总是按恐慌行为处理，并且特别频繁地使用导弹武器。",
    ),
    ("CARRIER", "航母", "仅适用于舰船。舰船角色分类为航母。"),
    ("CIVILIAN", "民用舰船", "仅适用于舰船。舰船角色分类为民用。"),
    ("COMBAT", "战斗舰船", "仅适用于舰船。舰船角色分类为战斗舰。"),
    ("FREIGHTER", "货船", "仅适用于舰船。舰船角色分类为货船。"),
    ("LINER", "客船", "仅适用于舰船。舰船角色分类为客船。"),
    ("MODULE", "舰船模块", "仅适用于舰船。该舰船作为模块使用。"),
    (
        "SHIP_WITH_MODULES",
        "带模块舰船",
        "仅适用于舰船。该舰船拥有舰船模块。",
    ),
    ("STATION", "空间站", "仅适用于舰船。舰船角色分类为空间站。"),
    ("TANKER", "油船", "仅适用于舰船。舰船角色分类为油船。"),
    (
        "TRANSPORT",
        "运输舰",
        "仅适用于舰船。舰船角色分类为运输舰。",
    ),
    (
        "UNBOARDABLE",
        "不可登舰",
        "仅适用于舰船。战后不可打捞回收。",
    ),
    (
        "UNDER_PARENT",
        "父级之下",
        "仅适用于舰船模块。模块的图层渲染在舰船的图层之下。",
    ),
    (
        "NEVER_DODGE_MISSILES",
        "不躲导弹",
        "仅适用于舰船。AI 不执行躲避导弹行为。",
    ),
    (
        "NO_AUTO_ESCORT",
        "不自动护航",
        "仅适用于舰船。与 CARRIER 同时使用时，不会被其它舰船自动护航。",
    ),
];

#[cfg(test)]
mod tests {
    use super::super::super::session::{close_project_session, open_project_session_traced};
    use super::*;
    use crate::io::write_utf8_no_bom;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn source_options_return_resource_refs_without_data_urls() {
        let root = temp_dir("source_resource_refs");
        std::fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,name\r\nship_a,Ship A\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_a.ship"),
            r#"{"hullId":"ship_a","spriteName":"graphics/ships/ship_a.png"}"#,
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let groups =
            query_csv_source_options(&manifest.session_id, "csv:ships.id", &[], None, None)
                .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        let option = groups
            .iter()
            .flat_map(|group| group.options.iter())
            .find(|option| option.value == "ship_a")
            .unwrap();
        assert_eq!(
            option
                .resource_ref
                .as_ref()
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/ships/ship_a.png")
        );
    }

    #[test]
    fn core_wing_source_options_fail_when_skin_index_fails() {
        let root = temp_dir("core_wing_source_ref_skin_error");
        let mod_root = root.join("mods/demo");
        std::fs::create_dir_all(&mod_root).unwrap();
        std::fs::create_dir_all(root.join("starsector-core/data/hulls/skins")).unwrap();
        std::fs::create_dir_all(root.join("starsector-core/data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/hulls/wing_data.csv"),
            "id,variant\r\ncore_wing,core_variant\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/variants/core_variant.variant"),
            r#"{"variantId":"core_variant","hullId":"skin_hull"}"#,
        )
        .unwrap();
        write_utf8_no_bom(&root.join("starsector-core/data/hulls/skins/bad.skin"), "{").unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&mod_root, Some(&root), &mut trace).unwrap();
        let error = query_csv_source_options(
            &manifest.session_id,
            "csv:wings.id",
            &[],
            Some("core_wing".to_string()),
            None,
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("bad.skin"));
    }

    #[test]
    fn csv_source_parser_requires_registered_table_key() {
        let result = parse_csv_source("csv:missions.id");

        assert!(result.is_err());
    }

    #[test]
    fn csv_source_options_reject_missing_source_column() {
        let root = temp_dir("source_missing_column");
        std::fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,name\r\nship_a,Ship A\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_csv_source_options(
            &manifest.session_id,
            "csv:ships.missing",
            &["current".to_string()],
            None,
            None,
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("csv source column does not exist: ships.missing"));
    }

    #[test]
    fn non_id_csv_source_options_do_not_inherit_row_resources() {
        let root = temp_dir("source_non_id_no_resource");
        std::fs::create_dir_all(root.join("data/campaign")).unwrap();
        write_utf8_no_bom(
            &root.join("data/campaign/commodities.csv"),
            "id,name,tags,icon\r\nore,Ore,bulk,graphics/icons/cargo/ore.png\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let groups = query_csv_source_options(
            &manifest.session_id,
            "csv:commodities.tags",
            &[],
            None,
            None,
        )
        .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        let option = groups
            .iter()
            .flat_map(|group| group.options.iter())
            .find(|option| option.value == "bulk")
            .unwrap();
        assert!(option.resource_ref.is_none());
    }

    #[test]
    fn tag_and_hint_source_options_use_separate_known_labels() {
        let root = temp_dir("source_separate_tag_hint_labels");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name,tags,hints\r\nweapon,Weapon,no_drop,PD\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let tag_groups =
            query_csv_source_options(&manifest.session_id, "csv:weapons.tags", &[], None, None)
                .unwrap();
        let hint_groups =
            query_csv_source_options(&manifest.session_id, "csv:weapons.hints", &[], None, None)
                .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        let tag_label = source_option_label_from_groups(&tag_groups, "no_drop");
        let hint_label = source_option_label_from_groups(&hint_groups, "PD");
        assert_eq!(tag_label.as_deref(), Some("no_drop (不可掉落)"));
        assert_eq!(hint_label.as_deref(), Some("PD (点防御)"));
    }

    #[test]
    fn tag_source_options_label_blueprint_package_tags_from_core_special_items() {
        let root = temp_dir("source_core_blueprint_package_tag_labels");
        let mod_root = root.join("mods/demo");
        std::fs::create_dir_all(mod_root.join("data/campaign")).unwrap();
        std::fs::create_dir_all(root.join("starsector-core/data/campaign")).unwrap();
        write_utf8_no_bom(
            &mod_root.join("data/campaign/commodities.csv"),
            "id,name,tags\r\ncommodity,Commodity,lowtech_bp\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/campaign/special_items.csv"),
            "name,id,tags,plugin params,desc\r\nLow Tech Blueprint Package,low_tech_package,\"package_bp, codex_unlockable\",lowtech_bp,Unlocks low tech blueprints.\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/campaign/commodities.csv"),
            "id,name,tags\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&mod_root, Some(&root), &mut trace).unwrap();
        let groups = query_csv_source_options(
            &manifest.session_id,
            "csv:commodities.tags",
            &[],
            None,
            None,
        )
        .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        let tag_label = source_option_label_from_groups(&groups, "lowtech_bp");
        let tag_description = source_option_description_from_groups(&groups, "lowtech_bp");
        assert_eq!(
            tag_label.as_deref(),
            Some("lowtech_bp (Low Tech Blueprint Package)")
        );
        assert_eq!(
            tag_description.as_deref(),
            Some("Unlocks low tech blueprints.")
        );
    }

    #[test]
    fn source_options_label_core_tag_and_hint_metadata() {
        let root = temp_dir("source_core_tag_hint_metadata");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name,tags,hints\r\nweapon,Weapon,codex_unlockable,CONSERVE_5\r\nbeam,Beam,beam999,DIRECT_AIM\r\nbad,Bad,energy123,CONSERVE_999\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let tag_groups =
            query_csv_source_options(&manifest.session_id, "csv:weapons.tags", &[], None, None)
                .unwrap();
        let hint_groups =
            query_csv_source_options(&manifest.session_id, "csv:weapons.hints", &[], None, None)
                .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(
            source_option_label_from_groups(&tag_groups, "codex_unlockable").as_deref(),
            Some("codex_unlockable (百科可解锁)")
        );
        assert_eq!(
            source_option_label_from_groups(&tag_groups, "beam999").as_deref(),
            Some("beam999 (光束武器强度 999)")
        );
        assert_eq!(
            source_option_label_from_groups(&hint_groups, "DIRECT_AIM").as_deref(),
            Some("DIRECT_AIM (直接瞄准)")
        );
        assert_eq!(
            source_option_label_from_groups(&hint_groups, "CONSERVE_5").as_deref(),
            Some("CONSERVE_5 (节省弹药 5)")
        );
        assert_eq!(
            source_option_label_from_groups(&tag_groups, "energy123").as_deref(),
            Some("energy123 (能量武器强度 123)")
        );
        assert_eq!(
            source_option_label_from_groups(&hint_groups, "CONSERVE_999").as_deref(),
            Some("CONSERVE_999")
        );
    }

    fn source_option_label_from_groups(
        groups: &[SourceOptionGroup],
        value: &str,
    ) -> Option<String> {
        groups
            .iter()
            .flat_map(|group| group.options.iter())
            .find(|option| option.value == value)
            .map(|option| option.label.clone())
    }

    fn source_option_description_from_groups(
        groups: &[SourceOptionGroup],
        value: &str,
    ) -> Option<String> {
        groups
            .iter()
            .flat_map(|group| group.options.iter())
            .find(|option| option.value == value)
            .and_then(|option| option.description.clone())
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        std::fs::create_dir_all(&path).unwrap();
        path
    }
}
