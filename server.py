#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Starsector Mod 策划配置工具 - 通用本地服务器
放在任意 mod 的 Tool/ 子目录下即可使用。
运行: python server.py
浏览器访问: http://localhost:8266
"""
import csv, io, json, os, re, base64, glob, sys
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PORT = 8266
SCRIPT_DIR = Path(__file__).resolve().parent
MOD_ROOT = SCRIPT_DIR.parent  # 自动检测: Tool/ 的父目录就是 mod 根目录
STARSECTOR_ROOT = MOD_ROOT.parent.parent  # Tool/../../../ = Starsector安装目录
CORE_DIR = STARSECTOR_ROOT / "starsector-core"

# 确保工作目录正确（兼容双击运行）
os.chdir(str(SCRIPT_DIR))

# ── Starsector 宽松 JSON 解析 ─────────────────────────
def parse_ss_json(text):
    text = re.sub(r'#[^\n]*', '', text)
    text = re.sub(r',\s*([}\]])', r'\1', text)
    text = re.sub(r'(?<!["\w])(\w+)\s*:', r'"\1":', text)
    # 提取第一个完整 JSON 对象（处理尾部多余内容）
    depth = 0; end = len(text)
    for i, ch in enumerate(text):
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0: end = i + 1; break
    return json.loads(text[:end])

def read_json_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return parse_ss_json(f.read())

# ── 读取 mod_info.json ────────────────────────────────
def read_mod_info():
    p = MOD_ROOT / "mod_info.json"
    if p.exists():
        try: return read_json_file(str(p))
        except: pass
    return {"id": MOD_ROOT.name, "name": MOD_ROOT.name}

# ── 自动发现阵营 ──────────────────────────────────────
def discover_factions():
    """从 .faction 文件自动发现阵营，构建 factionMeta 和 tag→faction 映射"""
    factions = {}
    tag_map = {}  # tag → faction_id
    prefix_map = {}  # id_prefix → faction_id
    faction_dir = MOD_ROOT / "data" / "world" / "factions"
    if not faction_dir.exists():
        return factions, tag_map, prefix_map

    COLORS_FALLBACK = ["#f39900","#ef4444","#a855f7","#3b82f6","#22c55e","#06b6d4","#ec4899","#84cc16"]
    color_idx = 0

    for fp in sorted(faction_dir.glob("*.faction")):
        try:
            d = read_json_file(str(fp))
            fid = d.get("id")
            name = d.get("displayName") or d.get("displayNameLong")
            if not fid or not name:
                continue
            color_arr = d.get("color", [128,128,128,255])
            hex_color = "#{:02x}{:02x}{:02x}".format(
                int(color_arr[0]) if len(color_arr)>0 else 128,
                int(color_arr[1]) if len(color_arr)>1 else 128,
                int(color_arr[2]) if len(color_arr)>2 else 128,
            )
            factions[fid] = {"name": name, "color": hex_color}

            # 从 knownShips/knownWeapons 的 tags 中提取 faction-specific tags
            for section in ["knownShips","knownWeapons","knownFighters"]:
                tags = d.get(section, {}).get("tags", [])
                for tag in tags:
                    tag = tag.strip()
                    if tag and "_bp" in tag and tag not in ["base_bp","lowtech_bp","midline_bp","hightech_bp","missile_bp","pirate_bp","pirates"]:
                        tag_map[tag] = fid
        except:
            pass

    # Build prefix map from discovered ship IDs in ship_data
    # We'll do this dynamically when loading data
    return factions, tag_map, prefix_map

# ── 阵营检测 ──────────────────────────────────────────
_faction_meta = {}
_tag_map = {}

def detect_faction(eid, tags_str=""):
    # By tag (more reliable)
    for tag, fid in _tag_map.items():
        if tag in tags_str:
            return fid
    # By ID prefix: check if ID starts with any known faction's ship prefix
    # Use first part before underscore
    if "_" in eid:
        prefix = eid.split("_")[0] + "_"
        for fid in _faction_meta:
            if eid.lower().startswith(fid[:3].lower()):
                return fid
    return "other"

# ── CSV 读写 ──────────────────────────────────────────
def read_csv_data(rel_path):
    full = MOD_ROOT / rel_path
    if not full.exists(): return [], []
    with open(full, "r", encoding="utf-8") as f:
        all_rows = list(csv.reader(f))
    if not all_rows: return [], []
    header = all_rows[0]
    data = []
    for row in all_rows[1:]:
        first = row[0] if row else ""
        if first.startswith("#"): continue
        d = {}
        for i, h in enumerate(header):
            d[h] = row[i] if i < len(row) else ""
        data.append(d)
    return header, data

# ── 图片列表 ──────────────────────────────────────────
def list_ship_sprites():
    """列出所有可用的船贴图路径（相对于 MOD_ROOT）"""
    sprites = []
    gfx_dir = MOD_ROOT / "graphics" / "ships"
    if gfx_dir.exists():
        for f in sorted(gfx_dir.rglob("*.png")):
            sprites.append(str(f.relative_to(MOD_ROOT)).replace("\\", "/"))
    return sprites

# ── 武器/弹道数据加载 ─────────────────────────────────
def load_wpn_files():
    """加载所有 .wpn 文件"""
    wpn_files = {}
    wpn_dir = MOD_ROOT / "data" / "weapons"
    if wpn_dir.exists():
        for fp in sorted(wpn_dir.glob("*.wpn")):
            try:
                d = read_json_file(str(fp))
                if d and "id" in d:
                    wpn_files[d["id"]] = d
            except: pass
    return wpn_files

def load_proj_files(mod_only=False):
    """加载 .proj 文件（mod 优先，再加载 core）"""
    proj_files = {}
    # Mod proj
    mod_proj = MOD_ROOT / "data" / "weapons" / "proj"
    if mod_proj.exists():
        for fp in sorted(mod_proj.glob("*.proj")):
            try:
                d = read_json_file(str(fp))
                if d and "id" in d:
                    proj_files[d["id"]] = d
                    proj_files[d["id"]]["_source"] = "mod"
            except: pass
    if mod_only:
        return proj_files
    # Core proj
    core_proj = CORE_DIR / "data" / "weapons" / "proj"
    if core_proj.exists():
        for fp in sorted(core_proj.glob("*.proj")):
            try:
                d = read_json_file(str(fp))
                if d and "id" in d and d["id"] not in proj_files:
                    proj_files[d["id"]] = d
                    proj_files[d["id"]]["_source"] = "core"
            except: pass
    return proj_files

def list_weapon_sprites():
    """列出 mod 的 graphics/weapons/ + graphics/missiles/ 下所有 PNG"""
    sprites = []
    for subdir in ["graphics/weapons", "graphics/missiles", "graphics/fx"]:
        gfx = MOD_ROOT / subdir
        if gfx.exists():
            for f in sorted(gfx.rglob("*.png")):
                sprites.append(str(f.relative_to(MOD_ROOT)).replace("\\", "/"))
    return sprites

def find_wpn_file(weapon_id):
    """查找 .wpn 文件路径（mod 优先，再 core）"""
    mod_dir = MOD_ROOT / "data" / "weapons"
    for fp in mod_dir.glob("*.wpn"):
        try:
            d = read_json_file(str(fp))
            if d and d.get("id") == weapon_id:
                return fp, "mod"
        except: pass
    core_dir = CORE_DIR / "data" / "weapons"
    if core_dir.exists():
        for fp in core_dir.glob("*.wpn"):
            try:
                d = read_json_file(str(fp))
                if d and d.get("id") == weapon_id:
                    return fp, "core"
            except: pass
    return None, None

def find_proj_file(proj_id):
    """查找 .proj 文件路径（mod 优先，再 core）"""
    for base in [MOD_ROOT, CORE_DIR]:
        proj_dir = base / "data" / "weapons" / "proj"
        if proj_dir.exists():
            for fp in proj_dir.glob("*.proj"):
                try:
                    d = read_json_file(str(fp))
                    if d and d.get("id") == proj_id:
                        return fp, ("mod" if base == MOD_ROOT else "core")
                except: pass
    return None, None

# ── 数据加载 ──────────────────────────────────────────
def load_all_data():
    global _faction_meta, _tag_map
    _faction_meta, _tag_map, _ = discover_factions()
    if "other" not in _faction_meta:
        _faction_meta["other"] = {"name": "其他", "color": "#6b7280"}

    mod_info = read_mod_info()

    data = {
        "modInfo": mod_info,
        "factionMeta": _faction_meta,
    }

    csv_tables = {
        "ships": "data/hulls/ship_data.csv",
        "weapons": "data/weapons/weapon_data.csv",
        "wings": "data/hulls/wing_data.csv",
        "hullmods": "data/hullmods/hull_mods.csv",
        "industries": "data/campaign/industries.csv",
    }
    data["csvPaths"] = csv_tables
    data["csvHeaders"] = {}
    for key, path in csv_tables.items():
        header, rows = read_csv_data(path)
        for r in rows:
            if "id" in r:
                r["_faction"] = detect_faction(r.get("id",""), r.get("tags",""))
        data[key] = rows
        data["csvHeaders"][key] = header

    # .ship
    ship_files = {}
    ship_dir = MOD_ROOT / "data" / "hulls"
    if ship_dir.exists():
        for fp in sorted(ship_dir.glob("*.ship")):
            try:
                d = read_json_file(str(fp))
                if d and "hullId" in d:
                    ship_files[d["hullId"]] = d
            except: pass
    data["shipFiles"] = ship_files

    # .variant
    variants = {}
    var_dir = MOD_ROOT / "data" / "variants"
    if var_dir.exists():
        for fp in sorted(var_dir.glob("*.variant")):
            try:
                d = read_json_file(str(fp))
                if d and "hullId" in d:
                    variants.setdefault(d["hullId"], []).append(d)
            except: pass
    data["variants"] = variants

    # 贴图 base64
    sprites = {}
    for hid, sd in ship_files.items():
        sp = sd.get("spriteName","")
        if sp:
            img = MOD_ROOT / sp.replace("\\","/")
            if img.exists():
                with open(img,"rb") as f:
                    sprites[hid] = "data:image/png;base64," + base64.b64encode(f.read()).decode()
    data["shipSprites"] = sprites

    # 可用贴图列表
    data["availableSprites"] = list_ship_sprites()

    # Weapon/Projectile data
    data["wpnFiles"] = load_wpn_files()
    data["projFiles"] = load_proj_files()
    data["weaponSprites"] = list_weapon_sprites()
    data["coreAvailable"] = CORE_DIR.exists()

    return data

# ── HTTP 服务器 ───────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # 只显示非200的请求，方便调试
        if args and len(args) >= 1 and '200' not in str(args[1] if len(args)>1 else args[0]):
            print(f"  [{args[1] if len(args)>1 else '?'}] {args[0] if args else '?'}")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors(); self.send_header("Content-Length", len(body)); self.end_headers()
        self.wfile.write(body)

    def _html(self, html):
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self._cors(); self.send_header("Content-Length", len(body)); self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path in ("/", "/index.html", "/app.html"):
            # 尝试 index.html，再 fallback app.html
            for fname in ("index.html", "app.html"):
                tpl = SCRIPT_DIR / fname
                if tpl.exists():
                    self._html(tpl.read_text(encoding="utf-8"))
                    return
            self._json({"error": f"找不到前端文件。SCRIPT_DIR={SCRIPT_DIR}, 文件列表={list(SCRIPT_DIR.iterdir())}"}, 404)

        elif path.startswith("/css/") or path.startswith("/js/"):
            # Serve static files (css, js)
            file_path = SCRIPT_DIR / path.lstrip("/")
            if file_path.exists() and file_path.is_file():
                content = file_path.read_bytes()
                self.send_response(200)
                if path.endswith(".css"):
                    self.send_header("Content-Type", "text/css; charset=utf-8")
                elif path.endswith(".js"):
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                else:
                    self.send_header("Content-Type", "application/octet-stream")
                self._cors()
                self.send_header("Content-Length", len(content))
                self.end_headers()
                self.wfile.write(content)
            else:
                self._json({"error": "not found: " + path}, 404)

        elif path == "/api/data":
            self._json(load_all_data())

        elif path.startswith("/api/sprite/"):
            # 直接服务贴图文件
            rel = path[len("/api/sprite/"):]
            img_path = MOD_ROOT / rel.replace("\\","/")
            if img_path.exists() and img_path.suffix.lower() == ".png":
                with open(img_path, "rb") as f: img_data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", len(img_data))
                self._cors(); self.end_headers()
                self.wfile.write(img_data)
            else:
                self._json({"error": "not found"}, 404)

        elif path.startswith("/api/wpn/"):
            wid = path[len("/api/wpn/"):]
            fp, src = find_wpn_file(wid)
            if fp:
                self._json(read_json_file(str(fp)))
            else:
                self._json({"error": f"wpn {wid} not found"}, 404)

        elif path.startswith("/api/proj/"):
            pid = path[len("/api/proj/"):]
            fp, src = find_proj_file(pid)
            if fp:
                self._json(read_json_file(str(fp)))
            else:
                self._json({"error": f"proj {pid} not found"}, 404)

        elif path == "/api/proj_list":
            projs = load_proj_files()
            self._json([{"id": k, "source": v.get("_source","?"), "specClass": v.get("specClass","")} for k,v in projs.items()])

        elif path == "/api/weapon_sprites":
            self._json(list_weapon_sprites())

        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if path == "/api/save_csv":
            table = body.get("table")
            csv_paths = {
                "ships": "data/hulls/ship_data.csv",
                "weapons": "data/weapons/weapon_data.csv",
                "wings": "data/hulls/wing_data.csv",
                "hullmods": "data/hullmods/hull_mods.csv",
                "industries": "data/campaign/industries.csv",
            }
            if table not in csv_paths:
                self._json({"error": f"unknown table: {table}"}, 400); return
            try:
                header = body["header"]
                rows = body["rows"]
                full = MOD_ROOT / csv_paths[table]
                # 保留注释行
                comment_rows = []
                if full.exists():
                    with open(full, "r", encoding="utf-8") as f:
                        for row in list(csv.reader(f))[1:]:
                            if row and row[0].startswith("#"):
                                comment_rows.append(row)
                with open(full, "w", encoding="utf-8", newline="") as f:
                    w = csv.writer(f)
                    w.writerow(header)
                    for cr in comment_rows: w.writerow(cr)
                    for row in rows:
                        w.writerow([row.get(h, "") for h in header])
                self._json({"ok": True, "saved": csv_paths[table]})
            except Exception as e:
                self._json({"error": str(e)}, 500)

        elif path == "/api/save_ship":
            hull_id = body.get("hullId")
            ship_data = body.get("data")
            if not hull_id or not ship_data:
                self._json({"error": "missing hullId or data"}, 400); return
            ship_dir = MOD_ROOT / "data" / "hulls"
            ship_dir.mkdir(parents=True, exist_ok=True)
            target = None
            for fp in ship_dir.glob("*.ship"):
                try:
                    d = read_json_file(str(fp))
                    if d and d.get("hullId") == hull_id:
                        target = fp; break
                except: pass
            if not target:
                target = ship_dir / f"{hull_id}.ship"
            clean = {k:v for k,v in ship_data.items() if not k.startswith("_")}
            with open(target, "w", encoding="utf-8") as f:
                json.dump(clean, f, ensure_ascii=False, indent=2)
            self._json({"ok": True, "saved": str(target.relative_to(MOD_ROOT))})

        elif path == "/api/delete_ship":
            hull_id = body.get("hullId")
            if not hull_id:
                self._json({"error": "missing hullId"}, 400); return
            ship_dir = MOD_ROOT / "data" / "hulls"
            deleted = False
            for fp in ship_dir.glob("*.ship"):
                try:
                    d = read_json_file(str(fp))
                    if d and d.get("hullId") == hull_id:
                        fp.unlink()
                        deleted = True; break
                except: pass
            self._json({"ok": deleted, "hullId": hull_id})

        elif path == "/api/add_csv_row":
            table = body.get("table")
            row = body.get("row", {})
            csv_paths = {
                "ships": "data/hulls/ship_data.csv",
                "weapons": "data/weapons/weapon_data.csv",
                "wings": "data/hulls/wing_data.csv",
                "hullmods": "data/hullmods/hull_mods.csv",
                "industries": "data/campaign/industries.csv",
            }
            if table not in csv_paths:
                self._json({"error": f"unknown table"}, 400); return
            full = MOD_ROOT / csv_paths[table]
            try:
                with open(full, "r", encoding="utf-8") as f:
                    all_rows = list(csv.reader(f))
                header = all_rows[0] if all_rows else []
                new_row = [row.get(h, "") for h in header]
                with open(full, "a", encoding="utf-8", newline="") as f:
                    csv.writer(f).writerow(new_row)
                self._json({"ok": True})
            except Exception as e:
                self._json({"error": str(e)}, 500)

        elif path == "/api/delete_csv_row":
            table = body.get("table")
            row_id = body.get("id")  # 用 id 字段匹配
            csv_paths = {
                "ships": "data/hulls/ship_data.csv",
                "weapons": "data/weapons/weapon_data.csv",
                "wings": "data/hulls/wing_data.csv",
                "hullmods": "data/hullmods/hull_mods.csv",
                "industries": "data/campaign/industries.csv",
            }
            if table not in csv_paths or not row_id:
                self._json({"error": "missing params"}, 400); return
            full = MOD_ROOT / csv_paths[table]
            try:
                with open(full, "r", encoding="utf-8") as f:
                    all_rows = list(csv.reader(f))
                header = all_rows[0]
                id_col = header.index("id") if "id" in header else -1
                if id_col < 0:
                    self._json({"error": "no id column"}, 400); return
                kept = [all_rows[0]]
                for row in all_rows[1:]:
                    if len(row) > id_col and row[id_col] == row_id:
                        continue  # skip this row = delete
                    kept.append(row)
                with open(full, "w", encoding="utf-8", newline="") as f:
                    csv.writer(f).writerows(kept)
                self._json({"ok": True, "deleted": row_id})
            except Exception as e:
                self._json({"error": str(e)}, 500)

        elif path == "/api/save_wpn":
            wid = body.get("id")
            wpn_data = body.get("data")
            if not wid or not wpn_data:
                self._json({"error": "missing id or data"}, 400); return
            wpn_dir = MOD_ROOT / "data" / "weapons"
            wpn_dir.mkdir(parents=True, exist_ok=True)
            # Find existing file or create new
            target = None
            for fp in wpn_dir.glob("*.wpn"):
                try:
                    d = read_json_file(str(fp))
                    if d and d.get("id") == wid:
                        target = fp; break
                except: pass
            if not target:
                target = wpn_dir / f"{wid}.wpn"
            clean = {k:v for k,v in wpn_data.items() if not k.startswith("_")}
            with open(target, "w", encoding="utf-8") as f:
                json.dump(clean, f, ensure_ascii=False, indent=2)
            self._json({"ok": True, "saved": str(target.relative_to(MOD_ROOT))})

        elif path == "/api/save_proj":
            pid = body.get("id")
            proj_data = body.get("data")
            if not pid or not proj_data:
                self._json({"error": "missing id or data"}, 400); return
            proj_dir = MOD_ROOT / "data" / "weapons" / "proj"
            proj_dir.mkdir(parents=True, exist_ok=True)
            target = None
            for fp in proj_dir.glob("*.proj"):
                try:
                    d = read_json_file(str(fp))
                    if d and d.get("id") == pid:
                        target = fp; break
                except: pass
            if not target:
                target = proj_dir / f"{pid}.proj"
            clean = {k:v for k,v in proj_data.items() if not k.startswith("_")}
            with open(target, "w", encoding="utf-8") as f:
                json.dump(clean, f, ensure_ascii=False, indent=2)
            self._json({"ok": True, "saved": str(target.relative_to(MOD_ROOT))})

        elif path == "/api/upload_sprite":
            # 接收 base64 图片数据，保存到 graphics/ships/
            filename = body.get("filename", "")
            img_data_b64 = body.get("data", "")
            if not filename or not img_data_b64:
                self._json({"error": "missing filename or data"}, 400); return
            safe_name = re.sub(r'[^\w\-.]', '_', filename)
            if not safe_name.lower().endswith('.png'):
                safe_name += '.png'
            target_dir = MOD_ROOT / "graphics" / "ships"
            target_dir.mkdir(parents=True, exist_ok=True)
            target = target_dir / safe_name
            rel_path = f"graphics/ships/{safe_name}"
            exists = target.exists()
            if exists and not body.get("overwrite", False):
                self._json({"exists": True, "path": rel_path, "message": f"{safe_name} 已存在，是否覆盖？"})
                return
            try:
                img_bytes = base64.b64decode(img_data_b64)
                with open(target, "wb") as f:
                    f.write(img_bytes)
                self._json({"ok": True, "path": rel_path, "overwritten": exists})
            except Exception as e:
                self._json({"error": str(e)}, 500)

        else:
            self._json({"error": "not found"}, 404)


def main():
    mod_info = read_mod_info()
    mod_name = mod_info.get("name", MOD_ROOT.name)
    print("=" * 56)
    print(f"  Starsector Mod 策划配置工具")
    print(f"  Mod: {mod_name}")
    print("=" * 56)
    print(f"  Mod 目录: {MOD_ROOT}")
    print(f"  Tool 目录: {SCRIPT_DIR}")
    print(f"  服务地址: http://localhost:{PORT}")
    print(f"  按 Ctrl+C 停止")
    print("=" * 56)

    # 检查前端文件
    has_new = (SCRIPT_DIR / "index.html").exists()
    has_old = (SCRIPT_DIR / "app.html").exists()
    if not has_new and not has_old:
        print("\n[ERROR] 找不到 index.html 或 app.html!")
        sys.exit(1)
    if has_new:
        print(f"  前端: 模块化 (index.html + js/ + css/)")
    else:
        print(f"  前端: 单文件 (app.html)")

    # 检查端口是否被占用
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", PORT))
        sock.close()
    except OSError:
        sock.close()
        print(f"\n[ERROR] 端口 {PORT} 已被占用！")
        print(f"  可能有旧的 server.py 还在运行。")
        print(f"  请先关闭旧进程，或在命令行执行:")
        print(f"    Windows: netstat -ano | findstr {PORT}")
        print(f"    然后: taskkill /PID <进程ID> /F")
        sys.exit(1)

    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        import webbrowser
        webbrowser.open(f"http://localhost:{PORT}")
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
        server.server_close()

if __name__ == "__main__":
    main()
