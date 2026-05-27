<template>
  <div class="modal-backdrop">
    <div class="projectile-window">
      <EditorHeader title="战术系统编辑器" :subtitle="systemId" />
      <div class="projectile-body" style="overflow-y: auto; max-height: calc(100vh - 108px)">
        <n-collapse v-model:expanded-names="expandedSections" :theme-overrides="editorCollapseTheme">
          <n-collapse-item title="基础信息" name="basic">
            <div class="form-grid">
              <label>系统 ID</label><n-input :value="systemId" disabled /> <label>系统类型</label
              ><n-select :value="systemType" :options="toOptions([...SYSTEM_TYPES])" @update:value="onTypeChange" />
              <label>AI 行为类型</label><n-select v-model:value="localSystem.aiType" :options="toOptions([...AI_TYPES])" filterable tag />
              <label>效果脚本</label><n-input v-model:value="localSystem.statsScript" />
              <template v-if="aiType === 'CUSTOM'"> <label>AI 脚本</label><n-input v-model:value="localSystem.aiScript" /> </template>
            </div>
          </n-collapse-item>

          <n-collapse-item title="行为标志" name="behavior">
            <div class="form-grid">
              <label>暂停时运行脚本</label><n-switch v-model:value="localSystem.runScriptWhilePaused" /> <label>闲置时运行脚本</label
              ><n-switch v-model:value="localSystem.runScriptWhileIdle" /> <label>充能降低时阻止动作</label
              ><n-switch v-model:value="localSystem.blockActionsWhileChargingDown" /> <label>不会导致过载</label
              ><n-switch v-model:value="localSystem.canNotCauseOverload" /> <label>右键系统开启时可用</label
              ><n-switch v-model:value="localSystem.canUseWhileRightClickSystemOn" /> <label>效果后限制转向</label
              ><n-switch v-model:value="localSystem.clampTurnRateAfter" /> <label>效果后限制速度</label
              ><n-switch v-model:value="localSystem.clampMaxSpeedAfter" /> <label>持续加速</label
              ><n-switch v-model:value="localSystem.alwaysAccelerate" /> <label>撞击失控概率</label
              ><n-input-number v-model:value="localSystem.flameoutOnImpactChance" :step="0.1" /> <label>充能降低时淡出音效</label
              ><n-switch v-model:value="localSystem.fadeActivationSoundOnChargedown" /> <label>开盾时取消系统</label
              ><n-switch v-model:value="localSystem.activatingShieldsCancels" />
            </div>
          </n-collapse-item>

          <n-collapse-item title="音效" name="sound">
            <div class="form-grid">
              <label>激活音效</label><n-input v-model:value="localSystem.useSound" /> <label>循环音效</label
              ><n-input v-model:value="localSystem.loopSound" /> <label>关闭音效</label
              ><n-input v-model:value="localSystem.deactivateSound" /> <label>用尽音效</label
              ><n-input v-model:value="localSystem.outOfUsesSound" /> <label>滤波类型</label
              ><n-select v-model:value="localSystem.soundFilterType" :options="toOptions(['LOWPASS'])" clearable /> <label>滤波增益</label
              ><n-input-number v-model:value="localSystem.soundFilterGain" :step="0.05" /> <label>高频滤波增益</label
              ><n-input-number v-model:value="localSystem.soundFilterGainHF" :step="0.05" />
            </div>
          </n-collapse-item>

          <n-collapse-item v-if="showEngineSection" title="引擎视觉" name="engine">
            <div class="form-grid">
              <label>光柱长度倍率</label><n-input-number v-model:value="localSystem.engineGlowLengthMult" :step="0.1" />
              <label>光柱宽度倍率</label><n-input-number v-model:value="localSystem.engineGlowWidthMult" :step="0.1" />
              <label>辉光强度倍率</label><n-input-number v-model:value="localSystem.engineGlowGlowMult" :step="0.1" />
            </div>
            <ColorPicker label="引擎发光颜色" v-model="engineGlowColor" />
            <ColorPicker label="引擎尾迹颜色" v-model="engineGlowContrailColor" />
          </n-collapse-item>

          <n-collapse-item title="武器发光" name="weaponGlow">
            <ColorPicker label="武器发光颜色" v-model="weaponGlowColor" />
            <div class="form-grid">
              <label>受影响武器类型</label
              ><n-select
                v-model:value="localSystem.weaponTypes"
                :options="toOptions(['ENERGY', 'BALLISTIC', 'MISSILE', 'SYSTEM'])"
                multiple
              />
            </div>
          </n-collapse-item>

          <n-collapse-item title="抖动效果" name="jitter">
            <ColorPicker label="抖动颜色" v-model="jitterColor" />
            <div class="form-grid">
              <label>抖动副本数</label><n-input-number v-model:value="localSystem.jitterCopies" /> <label>最小范围</label
              ><n-input-number v-model:value="localSystem.jitterMinRange" /> <label>抖动范围</label
              ><n-input-number v-model:value="localSystem.jitterRange" /> <label>范围半径比例</label
              ><n-input-number v-model:value="localSystem.jitterRangeRadiusFraction" :step="0.1" />
            </div>
            <ColorPicker label="底层抖动颜色" v-model="jitterUnderColor" />
            <div class="form-grid">
              <label>底层副本数</label><n-input-number v-model:value="localSystem.jitterUnderCopies" /> <label>底层最小范围</label
              ><n-input-number v-model:value="localSystem.jitterUnderMinRange" /> <label>底层抖动范围</label
              ><n-input-number v-model:value="localSystem.jitterUnderRange" /> <label>底层范围半径比例</label
              ><n-input-number v-model:value="localSystem.jitterUnderRangeRadiusFraction" :step="0.1" />
            </div>
          </n-collapse-item>

          <n-collapse-item v-if="showPhaseSection" title="相位视觉" name="phase">
            <ColorPicker label="效果颜色 1" v-model="effectColor1" />
            <ColorPicker label="效果颜色 2" v-model="effectColor2" />
            <div class="form-grid">
              <label>高光贴图后缀</label><n-input v-model:value="localSystem.phaseHighlight" /> <label>漫射贴图后缀</label
              ><n-input v-model:value="localSystem.phaseDiffuse" /> <label>舰船透明度</label
              ><n-input-number v-model:value="localSystem.shipAlpha" :step="0.05" />
            </div>
          </n-collapse-item>

          <n-collapse-item v-if="showShieldSection" title="护盾视觉" name="shield">
            <ColorPicker label="护盾环颜色" v-model="shieldRingColor" />
            <ColorPicker label="护盾内部颜色" v-model="shieldInnerColor" />
            <div class="form-grid">
              <label>护盾厚度倍率</label><n-input-number v-model:value="localSystem.shieldThicknessMult" :step="0.1" />
              <label>护盾波动倍率</label><n-input-number v-model:value="localSystem.shieldFluctuationMult" :step="0.1" />
            </div>
          </n-collapse-item>

          <n-collapse-item v-if="showDisplacerSection" title="位移器参数" name="displacer">
            <div class="form-grid">
              <label>位移距离</label><n-input-number v-model:value="localSystem.range" /> <label>随机偏移</label
              ><n-input-number v-model:value="localSystem.randomRange" /> <label>传送时渲染副本</label
              ><n-switch v-model:value="localSystem.renderCopyDuringTeleport" />
            </div>
          </n-collapse-item>

          <n-collapse-item v-if="showWeaponSection" title="武器系统" name="weaponSystem">
            <div class="form-grid"><label>关联武器 ID</label><n-input v-model:value="localSystem.weaponDataId" /></div>
          </n-collapse-item>

          <n-collapse-item v-if="showDroneSection" title="无人机参数" name="drone">
            <div class="form-grid">
              <label>无人机装配 ID</label><n-input v-model:value="localSystem.droneVariant" /> <label>允许自由漫游</label
              ><n-switch v-model:value="localSystem.allowFreeRoam" /> <label>发射速度</label
              ><n-input-number v-model:value="localSystem.launchSpeed" /> <label>发射延迟</label
              ><n-input-number v-model:value="localSystem.launchDelay" :step="0.1" /> <label>最大无人机数</label
              ><n-input-number v-model:value="localSystem.maxDrones" />
            </div>
            <h4 style="margin: 8px 0 4px">无人机行为定义</h4>
            <ObjectEditor v-model="droneBehaviorJson" />
          </n-collapse-item>

          <n-collapse-item title="伤害（AI 理解用）" name="damage">
            <div class="form-grid">
              <label>EMP 伤害</label><n-input-number v-model:value="localSystem.empDamage" /> <label>伤害值</label
              ><n-input-number v-model:value="localSystem.damage" /> <label>伤害类型</label
              ><n-select
                v-model:value="localSystem.damageType"
                :options="toOptions(['ENERGY', 'KINETIC', 'HIGH_EXPLOSIVE', 'FRAGMENTATION'])"
                clearable
              />
            </div>
          </n-collapse-item>

          <n-collapse-item title="AI 提示" name="aiHints">
            <ObjectEditor v-model="aiHintsJson" />
          </n-collapse-item>

          <n-collapse-item title="额外字段" name="extra">
            <textarea
              v-model="extraJson"
              @change="applyExtra"
              style="width: 100%; min-height: 120px; font-family: monospace; font-size: 12px"
            />
          </n-collapse-item>
        </n-collapse>
      </div>
      <EditorFooter note="结构化 JSON 写回，内部字段会被后端剔除。">
        <template #actions>
          <n-button @click="$emit('close')">关闭</n-button>
          <n-button type="primary" @click="emit('save-requested', localSystem)">保存</n-button>
        </template>
      </EditorFooter>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ColorPicker from '@/shared/ui/ColorPicker.vue';
import EditorFooter from '@/app/components/editors/common/EditorFooter.vue';
import EditorHeader from '@/app/components/editors/common/EditorHeader.vue';
import ObjectEditor from '@/app/components/editors/common/ObjectEditor.vue';
import type { RowData } from '@/shared/types';
import { arr, str } from '@/shared/lib/starsector';
import { normalizeSystemSpec } from '@/domain/editors/lib/normalize';
import { useObjectField } from '@/app/composables/use-object-field';
import { editorCollapseTheme, toOptions } from '@/domain/editors/lib/editor-constants';

const props = defineProps<{
  modRoot: string;
  systemId: string;
  system?: RowData;
}>();
const emit = defineEmits<{ close: []; 'save-requested': [system: RowData] }>();

const localSystem = ref<RowData>(normalizeSystemSpec(props.system || { id: props.systemId, type: 'STAT_MOD' }));
const expandedSections = ref(['basic']);
const { bindObjectField } = useObjectField(localSystem);

const SYSTEM_TYPES = ['STAT_MOD', 'ENGINE_MOD', 'SHIELD_MOD', 'PHASE_CLOAK', 'DISPLACER', 'WEAPON', 'DRONE_LAUNCHER'] as const;

const AI_TYPES = [
  'BURN_DRIVE',
  'BURN_DRIVE_TOGGLE',
  'MANEUVERING_JETS',
  'PHASE_CLOAK',
  'PHASE_DISPLACER',
  'FORTRESS_SHIELD',
  'DAMPER_FIELD',
  'TEMPORAL_SHELL',
  'ACAUSAL_DISRUPTOR',
  'WEAPON_BOOST',
  'FLARE',
  'CANISTER_FLAK',
  'DRONE_LAUNCHER_PD',
  'DRONE_STRIKE',
  'RESERVE_DEPLOYMENT',
  'MOTE_ATTRACTOR',
  'CUSTOM',
  'NONE',
] as const;

const TYPE_EXCLUSIVE_FIELDS: Record<string, string[]> = {
  ENGINE_MOD: [
    'engineGlowColor',
    'engineGlowContrailColor',
    'engineGlowLengthMult',
    'engineGlowWidthMult',
    'engineGlowGlowMult',
    'flameoutOnImpactChance',
    'alwaysAccelerate',
  ],
  SHIELD_MOD: ['shieldRingColor', 'shieldInnerColor', 'shieldThicknessMult', 'shieldFluctuationMult'],
  PHASE_CLOAK: ['effectColor1', 'effectColor2', 'phaseHighlight', 'phaseDiffuse', 'shipAlpha'],
  DISPLACER: ['range', 'randomRange', 'renderCopyDuringTeleport'],
  WEAPON: ['weaponDataId'],
  DRONE_LAUNCHER: ['droneVariant', 'allowFreeRoam', 'launchSpeed', 'launchDelay', 'maxDrones', 'droneBehavior'],
};

const systemType = computed(() => str(localSystem.value.type, 'STAT_MOD'));
const aiType = computed(() => str(localSystem.value.aiType, 'NONE'));
const showEngineSection = computed(() => systemType.value === 'ENGINE_MOD');
const showShieldSection = computed(() => systemType.value === 'SHIELD_MOD');
const showPhaseSection = computed(() => systemType.value === 'PHASE_CLOAK');
const showDisplacerSection = computed(() => systemType.value === 'DISPLACER');
const showWeaponSection = computed(() => systemType.value === 'WEAPON');
const showDroneSection = computed(() => systemType.value === 'DRONE_LAUNCHER');

const engineGlowColor = computed({
  get: () => arr(localSystem.value.engineGlowColor, [255, 175, 125, 255]),
  set: (v) => (localSystem.value.engineGlowColor = v),
});
const engineGlowContrailColor = computed({
  get: () => arr(localSystem.value.engineGlowContrailColor, [255, 175, 125, 255]),
  set: (v) => (localSystem.value.engineGlowContrailColor = v),
});
const weaponGlowColor = computed({
  get: () => arr(localSystem.value.weaponGlowColor, [255, 255, 255, 255]),
  set: (v) => (localSystem.value.weaponGlowColor = v),
});
const jitterColor = computed({
  get: () => arr(localSystem.value.jitterColor, [255, 255, 255, 255]),
  set: (v) => (localSystem.value.jitterColor = v),
});
const jitterUnderColor = computed({
  get: () => arr(localSystem.value.jitterUnderColor, [255, 255, 255, 255]),
  set: (v) => (localSystem.value.jitterUnderColor = v),
});
const effectColor1 = computed({
  get: () => arr(localSystem.value.effectColor1, [100, 50, 200, 255]),
  set: (v) => (localSystem.value.effectColor1 = v),
});
const effectColor2 = computed({
  get: () => arr(localSystem.value.effectColor2, [150, 75, 255, 255]),
  set: (v) => (localSystem.value.effectColor2 = v),
});
const shieldRingColor = computed({
  get: () => arr(localSystem.value.shieldRingColor, [100, 200, 255, 255]),
  set: (v) => (localSystem.value.shieldRingColor = v),
});
const shieldInnerColor = computed({
  get: () => arr(localSystem.value.shieldInnerColor, [100, 200, 255, 75]),
  set: (v) => (localSystem.value.shieldInnerColor = v),
});

const aiHintsJson = bindObjectField('aiHints');
const droneBehaviorJson = bindObjectField('droneBehavior');

const KNOWN_FIELDS = new Set([
  'id',
  'type',
  'aiType',
  'statsScript',
  'aiScript',
  'runScriptWhilePaused',
  'runScriptWhileIdle',
  'blockActionsWhileChargingDown',
  'canNotCauseOverload',
  'canUseWhileRightClickSystemOn',
  'clampTurnRateAfter',
  'clampMaxSpeedAfter',
  'alwaysAccelerate',
  'flameoutOnImpactChance',
  'fadeActivationSoundOnChargedown',
  'activatingShieldsCancels',
  'useSound',
  'loopSound',
  'deactivateSound',
  'outOfUsesSound',
  'soundFilterType',
  'soundFilterGain',
  'soundFilterGainHF',
  'engineGlowColor',
  'engineGlowContrailColor',
  'engineGlowLengthMult',
  'engineGlowWidthMult',
  'engineGlowGlowMult',
  'weaponGlowColor',
  'weaponTypes',
  'jitterColor',
  'jitterCopies',
  'jitterMinRange',
  'jitterRange',
  'jitterRangeRadiusFraction',
  'jitterUnderColor',
  'jitterUnderCopies',
  'jitterUnderMinRange',
  'jitterUnderRange',
  'jitterUnderRangeRadiusFraction',
  'effectColor1',
  'effectColor2',
  'phaseHighlight',
  'phaseDiffuse',
  'shipAlpha',
  'shieldRingColor',
  'shieldInnerColor',
  'shieldThicknessMult',
  'shieldFluctuationMult',
  'range',
  'randomRange',
  'renderCopyDuringTeleport',
  'weaponDataId',
  'droneVariant',
  'allowFreeRoam',
  'launchSpeed',
  'launchDelay',
  'maxDrones',
  'droneBehavior',
  'empDamage',
  'damage',
  'damageType',
  'aiHints',
]);

const extraFields = computed(() => {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(localSystem.value)) {
    if (!KNOWN_FIELDS.has(key) && !key.startsWith('_')) {
      extra[key] = value;
    }
  }
  return extra;
});

const extraJson = ref(JSON.stringify(extraFields.value, null, 2));

function onTypeChange(newType: string) {
  const oldType = str(localSystem.value.type, 'STAT_MOD');
  for (const [typeName, fields] of Object.entries(TYPE_EXCLUSIVE_FIELDS)) {
    if (typeName === oldType && typeName !== newType) {
      for (const field of fields) {
        delete localSystem.value[field];
      }
    }
  }
  localSystem.value.type = newType;
}

function applyExtra() {
  try {
    const parsed = JSON.parse(extraJson.value);
    for (const key of Object.keys(localSystem.value)) {
      if (!KNOWN_FIELDS.has(key) && !key.startsWith('_')) {
        delete localSystem.value[key];
      }
    }
    Object.assign(localSystem.value, parsed);
  } catch {
    // ignore invalid JSON
  }
}

watch(
  () => props.system,
  (system) => {
    localSystem.value = normalizeSystemSpec(system || { id: props.systemId, type: 'STAT_MOD' });
    extraJson.value = JSON.stringify(extraFields.value, null, 2);
  },
  { deep: true },
);
</script>
