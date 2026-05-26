<template>
  <div class="modal-backdrop">
    <div ref="editorWindowRef" class="editor-window" tabindex="-1">
      <EditorHeader title="舰船编辑器" :subtitle="str(localShip.hullName) || hullId">
        <div class="ship-mode-controls">
          <div class="segmented ship-mode-tabs">
            <button v-for="m in modes" :key="m.value" :class="{ active: mode === m.value }" @click="setMode(m.value)">
              {{ m.label }} <span class="ship-mode-shortcut">{{ m.shortcut }}</span>
            </button>
          </div>
          <span class="ship-mode-hint">T 打开右侧</span>
        </div>
      </EditorHeader>
      <div class="editor-body">
        <div ref="stageRef" class="canvas-stage">
          <canvas
            ref="canvasRef"
            class="editor-canvas"
            @mousedown="onDown"
            @mousemove="onMove"
            @mouseup="onUp"
            @mouseleave="onLeave"
            @wheel.prevent="onWheel"
            @contextmenu.prevent
          />
        </div>
        <EditorInspector title="舰船检查器">
          <n-collapse
            v-model:expanded-names="expandedSections"
            :theme-overrides="editorCollapseTheme"
            @update:expanded-names="onExpandedSectionsUpdate"
          >
            <n-collapse-item title="船体属性" name="basic">
              <div class="form-grid">
                <label>hullId</label><n-input v-model:value="localShip.hullId" /> <label>hullName</label
                ><n-input v-model:value="localShip.hullName" /> <label>hullSize</label
                ><n-select
                  v-model:value="localShip.hullSize"
                  :options="toOptions(['FRIGATE', 'DESTROYER', 'CRUISER', 'CAPITAL_SHIP', 'FIGHTER'])"
                />
                <label>style</label
                ><n-select
                  v-model:value="localShip.style"
                  filterable
                  tag
                  :options="toOptions(['LOW_TECH', 'MIDLINE', 'HIGH_TECH', 'OMEGA', 'CUSTOM'])"
                />
                <label>width</label><n-input-number v-model:value="localShip.width" @update:value="draw" /> <label>height</label
                ><n-input-number v-model:value="localShip.height" @update:value="draw" />
              </div>
            </n-collapse-item>
            <n-collapse-item title="贴图" name="sprite">
              <div class="form-grid">
                <label>spriteName</label>
                <div class="sprite-field-row">
                  <n-input v-model:value="localShip.spriteName" @change="loadSprite" />
                  <input ref="shipSpriteInputRef" class="editor-file-input" type="file" accept="image/png" @change="uploadShipSprite" />
                  <n-button
                    class="sprite-icon-button"
                    tertiary
                    title="选择贴图文件"
                    aria-label="选择贴图文件"
                    @click="shipSpriteInputRef?.click()"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 19V5h6l2 2h8v12H4z" />
                      <path d="M8 14h8M12 10v8" />
                    </svg>
                  </n-button>
                </div>
                <label>sprite width</label><n-input-number :value="spriteSize.width || null" disabled /> <label>sprite height</label
                ><n-input-number :value="spriteSize.height || null" disabled />
              </div>
              <div class="sprite-actions">
                <n-button :disabled="!canSyncSpriteSize" @click="syncSpriteSize">更新贴图宽高</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item title="中心与护盾" name="props">
              <div class="form-grid">
                <label data-inspector-field="center-x">center X</label
                ><n-input-number :value="center[0]" @update:value="setArray('center', 0, $event)" />
                <label data-inspector-field="center-y">center Y</label
                ><n-input-number :value="center[1]" @update:value="setArray('center', 1, $event)" /> <label>collisionRadius</label
                ><n-input-number v-model:value="localShip.collisionRadius" @update:value="draw" />
                <label data-inspector-field="shield-x">shield X</label
                ><n-input-number :value="shieldCenter[0]" @update:value="setArray('shieldCenter', 0, $event)" />
                <label data-inspector-field="shield-y">shield Y</label
                ><n-input-number :value="shieldCenter[1]" @update:value="setArray('shieldCenter', 1, $event)" /> <label>shieldRadius</label
                ><n-input-number v-model:value="localShip.shieldRadius" @update:value="draw" />
              </div>
            </n-collapse-item>
            <n-collapse-item title="武器槽" name="weapons">
              <div class="item-list">
                <button
                  v-for="item in normalWeaponSlots"
                  :key="item.index"
                  :data-inspector-target="`weapon-${item.index}`"
                  :class="{ selected: mode === 'weapon' && selected === item.index }"
                  @click="selectInspectorItem('weapon', item.index, 'weapon')"
                >
                  {{ item.slot.id || `slot ${item.index}` }} <span>{{ item.slot.size }} {{ item.slot.type }}</span>
                </button>
              </div>
              <div v-if="mode === 'weapon' && selectedSlot" class="form-grid">
                <label>id</label><n-input v-model:value="selectedSlot.id" /> <label>size</label
                ><n-select v-model:value="selectedSlot.size" :options="toOptions(['SMALL', 'MEDIUM', 'LARGE'])" @update:value="draw" />
                <label>type</label
                ><n-select
                  v-model:value="selectedSlot.type"
                  :options="
                    toOptions([
                      'BALLISTIC',
                      'ENERGY',
                      'MISSILE',
                      'HYBRID',
                      'UNIVERSAL',
                      'SYNERGY',
                      'COMPOSITE',
                      'DECORATIVE',
                      'SYSTEM',
                      'STATION_MODULE',
                    ])
                  "
                  @update:value="draw"
                />
                <label>mount</label><n-select v-model:value="selectedSlot.mount" :options="toOptions(['TURRET', 'HARDPOINT', 'HIDDEN'])" />
                <label>angle</label><n-input-number v-model:value="selectedSlot.angle" @update:value="draw" /> <label>arc</label
                ><n-input-number v-model:value="selectedSlot.arc" @update:value="draw" /> <label>loc X</label
                ><n-input-number :value="slotLoc[0]" @update:value="setSlotLoc(0, $event)" /> <label>loc Y</label
                ><n-input-number :value="slotLoc[1]" @update:value="setSlotLoc(1, $event)" />
              </div>
              <div class="action-row button-row">
                <n-button @click="addWeaponSlot">添加</n-button><n-button type="error" ghost @click="deleteSelected">删除</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item title="甲板" name="launchBays">
              <div class="item-list">
                <button
                  v-for="item in launchBaySlots"
                  :key="item.index"
                  :data-inspector-target="`launchBay-${item.index}`"
                  :class="{ selected: mode === 'launchBay' && selected === item.index }"
                  @click="selectInspectorItem('launchBay', item.index, 'weapon')"
                >
                  {{ item.slot.id || `LB ${item.index + 1}` }} <span>甲板</span>
                </button>
              </div>
              <div v-if="mode === 'launchBay' && selectedSlot" class="form-grid">
                <label>id</label><n-input v-model:value="selectedSlot.id" /> <label>loc X</label
                ><n-input-number :value="slotLoc[0]" @update:value="setSlotLoc(0, $event)" /> <label>loc Y</label
                ><n-input-number :value="slotLoc[1]" @update:value="setSlotLoc(1, $event)" />
              </div>
              <div class="action-row button-row">
                <n-button @click="addLaunchBay">添加</n-button><n-button type="error" ghost @click="deleteSelected">删除</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item title="引擎" name="engines">
              <div class="item-list">
                <button
                  v-for="(eng, i) in engineSlots"
                  :key="i"
                  :data-inspector-target="`engine-${i}`"
                  :class="{ selected: mode === 'engine' && selected === i }"
                  @click="selectInspectorItem('engine', i, 'engine')"
                >
                  引擎 {{ i }} <span>{{ eng.width }}x{{ eng.length }}</span>
                </button>
              </div>
              <div v-if="mode === 'engine' && selectedEngine" class="form-grid">
                <label>angle</label><n-input-number v-model:value="selectedEngine.angle" @update:value="draw" /> <label>width</label
                ><n-input-number v-model:value="selectedEngine.width" @update:value="draw" /> <label>length</label
                ><n-input-number v-model:value="selectedEngine.length" @update:value="draw" /> <label>contrailSize</label
                ><n-input-number v-model:value="selectedEngine.contrailSize" /> <label>style</label
                ><n-select v-model:value="selectedEngine.style" :options="toOptions(['LOW_TECH', 'MIDLINE', 'HIGH_TECH', 'CUSTOM'])" />
                <label>loc X</label><n-input-number :value="engineLoc[0]" @update:value="setEngineLoc(0, $event)" /> <label>loc Y</label
                ><n-input-number :value="engineLoc[1]" @update:value="setEngineLoc(1, $event)" />
              </div>
              <div class="action-row button-row">
                <n-button @click="addEngine">添加</n-button><n-button type="error" ghost @click="deleteSelected">删除</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item title="碰撞边界" name="bounds">
              <div class="bounds-list">
                <div
                  v-for="(_, i) in boundPairs"
                  :key="i"
                  :data-inspector-target="`bound-${i}`"
                  :class="{ selected: mode === 'bounds' && selected === i }"
                  @click="selectInspectorItem('bounds', i, 'bound')"
                >
                  <span>{{ i }}</span>
                  <n-input-number :value="bounds[i * 2]" @update:value="setBound(i * 2, $event)" />
                  <n-input-number :value="bounds[i * 2 + 1]" @update:value="setBound(i * 2 + 1, $event)" />
                </div>
              </div>
              <div class="action-row button-row">
                <n-button @click="addBound">添加点</n-button><n-button type="error" ghost @click="deleteSelected">删除点</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item title="内置装备" name="builtins">
              <textarea v-model="builtInWeaponsText" @change="applyBuiltInWeapons" />
              <label>builtInMods</label><n-dynamic-tags v-model:value="builtInMods" /> <label>builtInWings</label
              ><n-dynamic-tags v-model:value="builtInWings" />
            </n-collapse-item>
          </n-collapse>
        </EditorInspector>
      </div>
      <EditorFooter :note="footerNote">
        <template #actions>
          <n-button @click="$emit('close')">关闭</n-button>
          <n-button type="primary" @click="save">保存</n-button>
        </template>
      </EditorFooter>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useAppFeedback } from '@/app/composables/use-app-feedback';
import EditorFooter from '@/app/components/editors/common/EditorFooter.vue';
import EditorHeader from '@/app/components/editors/common/EditorHeader.vue';
import EditorInspector from '@/app/components/editors/common/EditorInspector.vue';
import type { RowData } from '@/shared/types';
import { arr, deepClone, num, str } from '@/shared/lib/starsector';
import { normalizeShipSpec } from '@/domain/editors/lib/normalize';
import { useHistory } from '@/app/composables/use-history';
import { useCanvasDrawing } from '@/app/composables/use-canvas-drawing';
import { useCanvasViewport } from '@/app/composables/use-canvas-viewport';
import { useEditorShortcuts } from '@/app/composables/use-editor-shortcuts';
import { useSpriteUpload } from '@/app/composables/use-sprite-upload';
import { editorCollapseTheme, snapToStep, toOptions } from '@/domain/editors/lib/editor-constants';
import { drawBoundsVisual, drawEngineVisual, drawRadiusField, drawWeaponSlotVisual } from '@/domain/editors/lib/canvas-visuals';

const props = defineProps<{
  modRoot: string;
  hullId: string;
  ship: RowData;
  spriteData?: string;
}>();
const emit = defineEmits<{ close: []; 'save-requested': [ship: RowData] }>();
const feedback = useAppFeedback();
const editorWindowRef = ref<HTMLElement>();
const stageRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const shipSpriteInputRef = ref<HTMLInputElement>();
const localShip = ref<RowData>(normalizeShipSpec(props.ship));
const mode = ref<'overview' | 'ranges' | 'bounds' | 'weapon' | 'launchBay' | 'engine'>('overview');
const selected = ref<number | null>(null);
const expandedSections = ref(['basic']);
const viewport = useCanvasViewport(canvasRef, 1, 10);
const { scale } = viewport;
const img = new Image();
const spriteSize = ref({ width: 0, height: 0 });
const dragging = ref<ShipDragKind | null>(null);
const hovered = ref<ShipCanvasTargetIdentity | null>(null);
const activeTarget = ref<ShipCanvasTargetIdentity | null>(null);
const inspectorLock = ref<ShipCanvasTargetIdentity | null>(null);
const panning = ref(false);
const dragStarted = ref(false);
const pointerInside = ref(false);
const inspectorRevealInProgress = ref(false);
let last = { x: 0, y: 0 };
const history = useHistory(() => localShip.value);
const drawing = useCanvasDrawing();
const { uploadSpriteFromInput } = useSpriteUpload();
const modes = [
  { shortcut: 'P', value: 'overview', label: '总览' },
  { shortcut: 'C', value: 'ranges', label: '范围' },
  { shortcut: 'B', value: 'bounds', label: '边界' },
  { shortcut: 'W', value: 'weapon', label: '武器' },
  { shortcut: 'L', value: 'launchBay', label: '甲板' },
  { shortcut: 'E', value: 'engine', label: '引擎' },
] as const;
type ShipCanvasTarget = { kind: 'weapon' | 'engine' | 'bound' | 'center' | 'shield'; i: number; distance: number };
type ShipCanvasTargetIdentity = Pick<ShipCanvasTarget, 'kind' | 'i'>;
type ShipDragKind =
  | ShipCanvasTarget['kind']
  | 'collisionRadius'
  | 'shieldRadius'
  | 'weaponAngle'
  | 'weaponArc'
  | 'engineAngle'
  | 'engineSize';
type InspectorSection = 'basic' | 'sprite' | 'props' | 'weapons' | 'launchBays' | 'engines' | 'bounds' | 'builtins';
type ModifierState = Pick<MouseEvent | KeyboardEvent, 'altKey' | 'ctrlKey' | 'shiftKey'>;
type HoverPreview =
  | { kind: 'collisionRadius'; radius: number }
  | { kind: 'shieldRadius'; radius: number }
  | { kind: 'boundAppend'; coord: number[] }
  | { kind: 'boundInsert'; coord: number[]; insertAfter: number }
  | { kind: 'weaponCopy'; coord: number[]; slot: RowData }
  | { kind: 'weaponMove'; coord: number[]; slot: RowData }
  | { kind: 'weaponArc'; arc: number }
  | { kind: 'launchBayAdd'; coord: number[]; slot: RowData }
  | { kind: 'engineCopy'; coord: number[]; engine: RowData }
  | { kind: 'engineMove'; coord: number[]; engine: RowData }
  | { kind: 'engineSize'; length: number; width: number }
  | null;
const hoverPreview = ref<HoverPreview>(null);
const modeToSection: Record<typeof mode.value, InspectorSection | null> = {
  overview: null,
  ranges: 'props',
  bounds: 'bounds',
  weapon: 'weapons',
  launchBay: 'launchBays',
  engine: 'engines',
};
const modeFooterNotes: Record<typeof mode.value, string> = {
  overview: '仅查看',
  ranges: '左键 拖动中心或护盾 | Shift+左键 改碰撞半径 | Ctrl+左键 改护盾半径 | T 打开中心与护盾',
  bounds: '左键 拖动边界点 | Shift+左键 追加边界点 | Ctrl+左键 插入最近边段 | T 打开碰撞边界',
  weapon: '左键 旋转角度 | Shift+左键 复制武器槽 | Ctrl+左键 移动位置 | Alt+左键 调整射角 | T 打开武器槽',
  launchBay: '左键 移动甲板位置 | Shift+左键 新建甲板 | T 打开甲板',
  engine: '左键 旋转角度 | Shift+左键 复制引擎 | Ctrl+左键 移动位置 | Alt+左键 调整宽高 | T 打开引擎',
};
const footerNote = computed(() => `右键 拖动画布 | 滚轮 缩放 | Ctrl+Z 撤销 | Ctrl+Shift+Z 重做\n${modeFooterNotes[mode.value]}`);

const weaponSlots = computed<RowData[]>(() =>
  Array.isArray(localShip.value.weaponSlots) ? (localShip.value.weaponSlots as RowData[]) : [],
);
const normalWeaponSlots = computed(() =>
  weaponSlots.value.map((slot, index) => ({ index, slot })).filter((item) => str(item.slot.type).toUpperCase() !== 'LAUNCH_BAY'),
);
const launchBaySlots = computed(() =>
  weaponSlots.value.map((slot, index) => ({ index, slot })).filter((item) => str(item.slot.type).toUpperCase() === 'LAUNCH_BAY'),
);
const engineSlots = computed<RowData[]>(() =>
  Array.isArray(localShip.value.engineSlots) ? (localShip.value.engineSlots as RowData[]) : [],
);
const bounds = computed<number[]>(() => (Array.isArray(localShip.value.bounds) ? (localShip.value.bounds as number[]) : []));
const boundPairs = computed(() => Array.from({ length: Math.floor(bounds.value.length / 2) }));
const center = computed(() => arr(localShip.value.center, [0, 0]));
const shieldCenter = computed(() => arr(localShip.value.shieldCenter, [0, 0]));
const selectedSlot = computed(() => (selected.value === null ? null : weaponSlots.value[selected.value]));
const selectedEngine = computed(() => (selected.value === null ? null : engineSlots.value[selected.value]));
const slotLoc = computed(() => arr(selectedSlot.value?.locations, [0, 0]));
const engineLoc = computed(() => arr(selectedEngine.value?.location, [0, 0]));
const builtInMods = computed({
  get: () => (Array.isArray(localShip.value.builtInMods) ? (localShip.value.builtInMods as string[]) : []),
  set: (v) => (localShip.value.builtInMods = v),
});
const builtInWings = computed({
  get: () => (Array.isArray(localShip.value.builtInWings) ? (localShip.value.builtInWings as string[]) : []),
  set: (v) => (localShip.value.builtInWings = v),
});
const builtInWeaponsText = ref(JSON.stringify(localShip.value.builtInWeapons || {}, null, 2));

function pushUndo() {
  history.push(localShip.value);
}
function doUndo() {
  const previous = history.undo(localShip.value);
  if (!previous) return;
  localShip.value = normalizeShipSpec(previous);
  selected.value = null;
  activeTarget.value = null;
  inspectorLock.value = null;
  clearHoverPreview();
  draw();
}
function doRedo() {
  const next = history.redo(localShip.value);
  if (!next) return;
  localShip.value = normalizeShipSpec(next);
  selected.value = null;
  activeTarget.value = null;
  inspectorLock.value = null;
  clearHoverPreview();
  draw();
}
useEditorShortcuts({ onKeyDown: handleEditorShortcut, redo: doRedo, scope: editorWindowRef, undo: doUndo });
function setMode(value: typeof mode.value) {
  mode.value = value;
  selected.value = null;
  hovered.value = null;
  activeTarget.value = null;
  inspectorLock.value = null;
  clearHoverPreview();
  draw();
}
function canvasCenter() {
  return viewport.center();
}
function shipCenterPoint() {
  return shipToCanvas(center.value);
}
function shipToCanvas(loc: number[]) {
  const origin = canvasCenter();
  return { x: origin.x + (loc[1] || 0) * scale.value, y: origin.y + (loc[0] || 0) * scale.value };
}
function relativeToCanvas(loc: number[]) {
  return shipToCanvas(relativeToAbsolute(loc));
}
function canvasToShip(x: number, y: number) {
  const point = rawCanvasToShip(x, y);
  return [snapToStep(point[0]), snapToStep(point[1])];
}
function rawCanvasToShip(x: number, y: number) {
  const origin = canvasCenter();
  return [(y - origin.y) / scale.value, (x - origin.x) / scale.value];
}
function canvasToRelative(x: number, y: number) {
  const point = canvasToShip(x, y);
  return absoluteToRelative(point);
}
function relativeToAbsolute(loc: number[]) {
  return [(center.value[0] || 0) - (loc[1] || 0), (center.value[1] || 0) + (loc[0] || 0)];
}
function absoluteToRelative(loc: number[]) {
  return [snapToStep((loc[1] || 0) - (center.value[1] || 0)), snapToStep((center.value[0] || 0) - (loc[0] || 0))];
}
function roundDegree(value: number) {
  return Math.round(value);
}
function normalizeDegree(value: number) {
  const normalized = roundDegree(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
function clampArc(value: number) {
  return Math.max(0, Math.min(360, roundDegree(value)));
}
function distance(a: number[], b: number[]) {
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0));
}
function pointAngle(origin: number[], point: number[]) {
  const relativePoint = [point[1] - (origin[1] || 0), (origin[0] || 0) - point[0]];
  return normalizeDegree((Math.atan2(relativePoint[1] || 0, relativePoint[0] || 0) * 180) / Math.PI);
}
function pointArc(origin: number[], point: number[], angle: number) {
  return clampArc(angleDelta(pointAngle(origin, point), angle) * 2);
}
function angleDelta(a: number, b: number) {
  return Math.abs(((((a - b + 540) % 360) + 360) % 360) - 180);
}
function targetKindAt(mx: number, my: number) {
  if (mode.value !== 'ranges') return activeTarget.value?.kind || null;
  const raw = rawCanvasToShip(mx, my);
  const shieldDistance = distance(raw, relativeToAbsolute(shieldCenter.value));
  const centerDistance = distance(raw, center.value);
  if (distance([0, 0], shieldCenter.value) === 0 && shieldDistance === centerDistance) return 'shield';
  return shieldDistance < centerDistance ? 'shield' : 'center';
}
function resizeCanvas() {
  const rect = stageRef.value?.getBoundingClientRect();
  if (viewport.resize(rect?.width, rect?.height)) draw();
}
function updateSpriteSize() {
  spriteSize.value = { width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0 };
}
function loadSprite() {
  spriteSize.value = { width: 0, height: 0 };
  img.src = props.spriteData || '';
  if (str(localShip.value.spriteName) && !props.spriteData) img.src = '';
  draw();
}
const canSyncSpriteSize = computed(() => spriteSize.value.width > 0 && spriteSize.value.height > 0);
function syncSpriteSize() {
  if (!canSyncSpriteSize.value) return;
  pushUndo();
  localShip.value.width = spriteSize.value.width;
  localShip.value.height = spriteSize.value.height;
  draw();
}

function setInspectorSection(section: InspectorSection) {
  expandedSections.value = [section];
}
function onExpandedSectionsUpdate() {
  if (inspectorRevealInProgress.value) return;
  inspectorLock.value = null;
}
function clearHoverPreview() {
  hoverPreview.value = null;
}
function targetMatches(target: ShipCanvasTargetIdentity | null, identity: ShipCanvasTargetIdentity | null) {
  return Boolean(target && identity && target.kind === identity.kind && target.i === identity.i);
}
function currentRangePreview(coord: number[], modifiers: ModifierState) {
  if (modifiers.shiftKey) return { kind: 'collisionRadius' as const, radius: Math.max(0, Math.round(distance(coord, center.value))) };
  if (modifiers.ctrlKey)
    return { kind: 'shieldRadius' as const, radius: Math.max(0, Math.round(distance(coord, relativeToAbsolute(shieldCenter.value)))) };
  return null;
}
function previewWeaponState(coord: number[], modifiers: ModifierState) {
  const relativeCoord = absoluteToRelative(coord);
  if (modifiers.altKey && selectedSlot.value) {
    return {
      kind: 'weaponArc' as const,
      arc: pointArc(relativeToAbsolute(slotLoc.value), rawCanvasToShip(last.x, last.y), num(selectedSlot.value.angle, 0)),
    };
  }
  if (modifiers.shiftKey) {
    const source = selectedSlot.value ? deepClone(selectedSlot.value) : {};
    return {
      kind: 'weaponCopy' as const,
      coord: relativeCoord,
      slot: {
        ...source,
        id: nextWeaponSlotId(),
        size: str(source.size, 'MEDIUM'),
        type: str(source.type, 'BALLISTIC'),
        mount: str(source.mount, 'TURRET'),
        arc: num(source.arc, 120),
        angle: num(source.angle, 0),
        locations: relativeCoord,
      },
    };
  }
  if (modifiers.ctrlKey && selectedSlot.value) {
    return { kind: 'weaponMove' as const, coord: relativeCoord, slot: { ...deepClone(selectedSlot.value), locations: relativeCoord } };
  }
  return null;
}
function previewLaunchBayState(coord: number[], modifiers: ModifierState) {
  if (!modifiers.shiftKey) return null;
  const relativeCoord = absoluteToRelative(coord);
  const source = selectedSlot.value ? deepClone(selectedSlot.value) : {};
  return {
    kind: 'launchBayAdd' as const,
    coord: relativeCoord,
    slot: {
      ...source,
      id: nextLaunchBayId(),
      size: 'LARGE',
      type: 'LAUNCH_BAY',
      mount: 'HIDDEN',
      arc: 360,
      angle: 0,
      locations: relativeCoord,
    },
  };
}
function previewEngineState(coord: number[], modifiers: ModifierState) {
  const relativeCoord = absoluteToRelative(coord);
  if (modifiers.altKey && selectedEngine.value) {
    const { length, width } = engineSizeFromPointer(last.x, last.y);
    return { kind: 'engineSize' as const, length, width };
  }
  if (modifiers.shiftKey) {
    const source = selectedEngine.value ? deepClone(selectedEngine.value) : {};
    return {
      kind: 'engineCopy' as const,
      coord: relativeCoord,
      engine: {
        ...source,
        angle: num(source.angle, 180),
        contrailSize: num(source.contrailSize, 12),
        length: num(source.length, 30),
        width: num(source.width, 10),
        location: relativeCoord,
        style: str(source.style, 'LOW_TECH'),
      },
    };
  }
  if (modifiers.ctrlKey && selectedEngine.value) {
    return { kind: 'engineMove' as const, coord: relativeCoord, engine: { ...deepClone(selectedEngine.value), location: relativeCoord } };
  }
  return null;
}
function previewBoundsState(coord: number[], modifiers: ModifierState) {
  const relativeCoord = absoluteToRelative(coord);
  if (modifiers.shiftKey) return { kind: 'boundAppend' as const, coord: relativeCoord };
  if (modifiers.ctrlKey)
    return { kind: 'boundInsert' as const, coord: relativeCoord, insertAfter: nearestBoundsSegmentIndex(relativeCoord) };
  return null;
}
function updateHoverPreview(mx: number, my: number, modifiers: ModifierState) {
  const coord = canvasToShip(mx, my);
  if (mode.value === 'ranges') {
    hoverPreview.value = currentRangePreview(coord, modifiers);
    return;
  }
  if (mode.value === 'bounds') {
    hoverPreview.value = previewBoundsState(coord, modifiers);
    return;
  }
  if (mode.value === 'weapon') {
    hoverPreview.value = previewWeaponState(coord, modifiers);
    return;
  }
  if (mode.value === 'launchBay') {
    hoverPreview.value = previewLaunchBayState(coord, modifiers);
    return;
  }
  if (mode.value === 'engine') {
    hoverPreview.value = previewEngineState(coord, modifiers);
    return;
  }
  hoverPreview.value = null;
}
function shouldPauseAutoSnap(modifiers: ModifierState) {
  if (mode.value === 'ranges') return modifiers.shiftKey || modifiers.ctrlKey;
  if (mode.value === 'bounds') return modifiers.shiftKey || modifiers.ctrlKey;
  if (mode.value === 'weapon') return modifiers.altKey || modifiers.ctrlKey || modifiers.shiftKey;
  if (mode.value === 'launchBay') return modifiers.shiftKey;
  if (mode.value === 'engine') return modifiers.altKey || modifiers.ctrlKey || modifiers.shiftKey;
  return false;
}

function currentInspectorTargetSelector() {
  if (mode.value === 'weapon') return selected.value !== null ? `[data-inspector-target="weapon-${selected.value}"]` : '';
  if (mode.value === 'launchBay') return selected.value !== null ? `[data-inspector-target="launchBay-${selected.value}"]` : '';
  if (mode.value === 'engine') return selected.value !== null ? `[data-inspector-target="engine-${selected.value}"]` : '';
  if (mode.value === 'bounds') return selected.value !== null ? `[data-inspector-target="bound-${selected.value}"]` : '';
  if (mode.value === 'ranges') {
    if (activeTarget.value?.kind === 'center') return '[data-inspector-field="center-x"]';
    if (activeTarget.value?.kind === 'shield') return '[data-inspector-field="shield-x"]';
  }
  return '';
}

async function revealCurrentInspectorTarget() {
  const section = modeToSection[mode.value];
  const selector = currentInspectorTargetSelector();
  if (!section || !selector) return;
  if (activeTarget.value) inspectorLock.value = { kind: activeTarget.value.kind, i: activeTarget.value.i };
  inspectorRevealInProgress.value = true;
  setInspectorSection(section);
  await nextTick();
  inspectorRevealInProgress.value = false;
  editorWindowRef.value?.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'nearest' });
}

function handleEditorShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (key === 'backspace') {
    if (deleteSelected()) event.preventDefault();
    return;
  }
  if (key === 't') {
    event.preventDefault();
    void revealCurrentInspectorTarget();
    return;
  }
  if (key === 'p') {
    event.preventDefault();
    setMode('overview');
    return;
  }
  if (key === 'c') {
    event.preventDefault();
    setMode('ranges');
    return;
  }
  if (key === 'b') {
    event.preventDefault();
    setMode('bounds');
    return;
  }
  if (key === 'w') {
    event.preventDefault();
    setMode('weapon');
    return;
  }
  if (key === 'l') {
    event.preventDefault();
    setMode('launchBay');
    return;
  }
  if (key === 'e') {
    event.preventDefault();
    setMode('engine');
  }
}

function drawPreviewBounds(ctx: CanvasRenderingContext2D) {
  const preview = hoverPreview.value;
  if (!preview || (preview.kind !== 'boundAppend' && preview.kind !== 'boundInsert')) return;
  const points = [];
  for (let i = 0; i < bounds.value.length; i += 2) points.push([bounds.value[i], bounds.value[i + 1]]);
  if (preview.kind === 'boundAppend') points.push(preview.coord);
  else points.splice(preview.insertAfter + 1, 0, preview.coord);
  if (points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawBoundsVisual(ctx, points.map(relativeToCanvas), points.length - 1, points.length - 1);
  ctx.restore();
}
function drawHoverPreview(ctx: CanvasRenderingContext2D) {
  const preview = hoverPreview.value;
  if (!preview) return;
  ctx.save();
  ctx.globalAlpha = 0.55;
  if (preview.kind === 'collisionRadius') {
    drawRadiusField(ctx, shipCenterPoint(), preview.radius * scale.value, 'rgba(249, 210, 75, 0.28)', false, true);
  }
  if (preview.kind === 'shieldRadius') {
    drawRadiusField(ctx, relativeToCanvas(shieldCenter.value), preview.radius * scale.value, 'rgba(79, 209, 197, 0.28)', false, true, 'x');
  }
  if (preview.kind === 'weaponCopy' || preview.kind === 'weaponMove' || preview.kind === 'launchBayAdd') {
    drawWeaponSlotVisual(ctx, {
      angle: num(preview.slot.angle, 0),
      arc: num(preview.slot.arc, 0),
      hovered: true,
      mount: str(preview.slot.mount),
      point: relativeToCanvas(preview.coord),
      selected: true,
      size: str(preview.slot.size, 'MEDIUM'),
      type: str(preview.slot.type, 'SYSTEM'),
    });
  }
  if (preview.kind === 'weaponArc' && selectedSlot.value) {
    drawWeaponSlotVisual(ctx, {
      angle: num(selectedSlot.value.angle, 0),
      arc: preview.arc,
      hovered: true,
      mount: str(selectedSlot.value.mount),
      point: relativeToCanvas(slotLoc.value),
      selected: true,
      size: str(selectedSlot.value.size, 'MEDIUM'),
      type: str(selectedSlot.value.type, 'SYSTEM'),
    });
  }
  if (preview.kind === 'engineCopy') {
    drawEngineVisual(ctx, {
      angle: num(preview.engine.angle, 0),
      hovered: true,
      length: num(preview.engine.length, 20),
      point: relativeToCanvas(preview.coord),
      scale: scale.value,
      selected: true,
      width: num(preview.engine.width, 10),
    });
  }
  if (preview.kind === 'engineMove') {
    drawEngineVisual(ctx, {
      angle: num(preview.engine.angle, 0),
      hovered: true,
      length: num(preview.engine.length, 20),
      point: relativeToCanvas(preview.coord),
      scale: scale.value,
      selected: true,
      width: num(preview.engine.width, 10),
    });
  }
  if (preview.kind === 'engineSize' && selectedEngine.value) {
    drawEngineVisual(ctx, {
      angle: num(selectedEngine.value.angle, 0),
      hovered: true,
      length: preview.length,
      point: relativeToCanvas(engineLoc.value),
      scale: scale.value,
      selected: true,
      width: preview.width,
    });
  }
  ctx.restore();
  drawPreviewBounds(ctx);
}
function drawCursorPosition(ctx: CanvasRenderingContext2D) {
  if (!pointerInside.value) return;
  const coord = canvasToShip(last.x, last.y);
  const point = shipToCanvas(coord);
  const label = cursorLabel(coord);
  ctx.save();
  ctx.strokeStyle = '#f8fafc';
  ctx.fillStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(point.x - 6, point.y);
  ctx.lineTo(point.x + 6, point.y);
  ctx.moveTo(point.x, point.y - 6);
  ctx.lineTo(point.x, point.y + 6);
  ctx.stroke();
  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 3;
  ctx.strokeText(label, point.x + 12, point.y + 12);
  ctx.fillText(label, point.x + 12, point.y + 12);
  ctx.restore();
}
function formatCoord(coord: number[]) {
  return `${coord[0].toFixed(1)}, ${coord[1].toFixed(1)}`;
}
function cursorLabel(coord: number[]) {
  if (dragging.value === 'weaponAngle' && selectedSlot.value) return `${Math.round(num(selectedSlot.value.angle, 0))}°`;
  if (dragging.value === 'weaponArc' && selectedSlot.value) return `${Math.round(num(selectedSlot.value.arc, 0))}°`;
  if (hoverPreview.value?.kind === 'weaponArc') return `${Math.round(hoverPreview.value.arc)}°`;
  if (dragging.value === 'engineAngle' && selectedEngine.value) return `${Math.round(num(selectedEngine.value.angle, 0))}°`;
  if (dragging.value === 'engineSize' && selectedEngine.value)
    return `${Math.round(num(selectedEngine.value.length, 0))} x ${Math.round(num(selectedEngine.value.width, 0))}`;
  if (hoverPreview.value?.kind === 'engineSize')
    return `${Math.round(hoverPreview.value.length)} x ${Math.round(hoverPreview.value.width)}`;
  if (mode.value === 'overview' || mode.value === 'ranges') return formatCoord(coord);
  return formatCoord(absoluteToRelative(coord));
}

function draw() {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  const cc = canvasCenter();
  drawing.clear(ctx, c.width, c.height);
  drawing.drawGrid(ctx, { center: cc, height: c.height, scale: scale.value, width: c.width });
  if (img.width) {
    const bottomLeft = shipToCanvas([0, 0]);
    const drawWidth = img.height * scale.value;
    ctx.globalAlpha = 0.72;
    ctx.save();
    ctx.translate(bottomLeft.x + drawWidth, bottomLeft.y);
    ctx.rotate(Math.PI / 2);
    drawing.drawPixelImage(ctx, img, 0, 0, img.width * scale.value, img.height * scale.value);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (bounds.value.length >= 4 && (mode.value === 'bounds' || mode.value === 'overview')) {
    const points = [];
    for (let i = 0; i < bounds.value.length; i += 2) points.push(relativeToCanvas([bounds.value[i], bounds.value[i + 1]]));
    drawBoundsVisual(
      ctx,
      points,
      mode.value === 'bounds' ? selected.value : null,
      mode.value === 'bounds' && hovered.value?.kind === 'bound' ? hovered.value.i : null,
    );
  }
  if (mode.value === 'ranges' || mode.value === 'overview') {
    const sp = relativeToCanvas(shieldCenter.value);
    const cp = shipCenterPoint();
    drawRadiusField(
      ctx,
      cp,
      num(localShip.value.collisionRadius, 0) * scale.value,
      'rgba(118, 106, 57, 0.34)',
      dragging.value === 'center',
      hovered.value?.kind === 'center',
    );
    drawRadiusField(
      ctx,
      sp,
      num(localShip.value.shieldRadius, 0) * scale.value,
      'rgba(95, 118, 126, 0.34)',
      dragging.value === 'shield',
      hovered.value?.kind === 'shield',
      'x',
    );
  }
  if (mode.value === 'weapon' || mode.value === 'launchBay' || mode.value === 'overview')
    weaponSlots.value.forEach((slot, i) => {
      const isLaunchBay = str(slot.type).toUpperCase() === 'LAUNCH_BAY';
      if (mode.value === 'weapon' && isLaunchBay) return;
      if (mode.value === 'launchBay' && !isLaunchBay) return;
      if (hoverPreview.value?.kind === 'weaponMove' && mode.value === 'weapon' && i === selected.value) return;
      if (hoverPreview.value?.kind === 'weaponMove' && mode.value === 'launchBay' && i === selected.value) return;
      drawWeaponSlotVisual(ctx, {
        angle: num(slot.angle, 0),
        arc: num(slot.arc, 0),
        hovered: (mode.value === 'weapon' || mode.value === 'launchBay') && hovered.value?.kind === 'weapon' && hovered.value.i === i,
        mount: str(slot.mount),
        point: relativeToCanvas(arr(slot.locations, [0, 0])),
        selected: (mode.value === 'weapon' || mode.value === 'launchBay') && i === selected.value,
        size: str(slot.size, 'MEDIUM'),
        type: str(slot.type, 'SYSTEM'),
      });
    });
  if (mode.value === 'engine' || mode.value === 'overview')
    engineSlots.value.forEach((eng, i) => {
      if (hoverPreview.value?.kind === 'engineMove' && mode.value === 'engine' && i === selected.value) return;
      drawEngineVisual(ctx, {
        angle: num(eng.angle, 0),
        hovered: mode.value === 'engine' && hovered.value?.kind === 'engine' && hovered.value.i === i,
        length: num(eng.length, 20),
        point: relativeToCanvas(arr(eng.location, [0, 0])),
        scale: scale.value,
        selected: mode.value === 'engine' && i === selected.value,
        width: num(eng.width, 10),
      });
    });
  drawHoverPreview(ctx);
  drawCursorPosition(ctx);
}
function targetIndex(target: ShipCanvasTarget | null) {
  return target?.kind === 'center' || target?.kind === 'shield' ? 0 : (target?.i ?? -1);
}
function selectableTargets(mx: number, my: number): ShipCanvasTarget[] {
  const targets: ShipCanvasTarget[] = [];
  if (mode.value === 'overview') return targets;
  if (mode.value === 'weapon' || mode.value === 'launchBay') {
    for (let i = weaponSlots.value.length - 1; i >= 0; i--) {
      const isLaunchBay = str(weaponSlots.value[i].type).toUpperCase() === 'LAUNCH_BAY';
      if (mode.value === 'weapon' && isLaunchBay) continue;
      if (mode.value === 'launchBay' && !isLaunchBay) continue;
      const p = relativeToCanvas(arr(weaponSlots.value[i].locations, [0, 0]));
      targets.push({ kind: 'weapon', i, distance: Math.hypot(mx - p.x, my - p.y) });
    }
  }
  if (mode.value === 'engine') {
    for (let i = engineSlots.value.length - 1; i >= 0; i--) {
      const p = relativeToCanvas(arr(engineSlots.value[i].location, [0, 0]));
      targets.push({ kind: 'engine', i, distance: Math.hypot(mx - p.x, my - p.y) });
    }
  }
  if (mode.value === 'bounds') {
    for (let i = 0; i < bounds.value.length; i += 2) {
      const p = relativeToCanvas([bounds.value[i], bounds.value[i + 1]]);
      targets.push({ kind: 'bound', i: i / 2, distance: Math.hypot(mx - p.x, my - p.y) });
    }
  }
  if (mode.value === 'ranges') {
    const sp = relativeToCanvas(shieldCenter.value);
    const cp = shipCenterPoint();
    targets.push({ kind: 'shield', i: 0, distance: Math.hypot(mx - sp.x, my - sp.y) });
    targets.push({ kind: 'center', i: 0, distance: Math.hypot(mx - cp.x, my - cp.y) });
  }
  return targets;
}
function targetHitRadius(target: ShipCanvasTarget) {
  if (target.kind === 'engine') return 28;
  if (target.kind === 'center' || target.kind === 'shield') return 30;
  return 26;
}
function nearestTarget(mx: number, my: number) {
  const targets = selectableTargets(mx, my);
  const locked = targets.find((target) => targetMatches(target, inspectorLock.value)) ?? null;
  const nearby = targets
    .filter((target) => !targetMatches(target, inspectorLock.value) && target.distance <= targetHitRadius(target))
    .sort((a, b) => a.distance - b.distance)[0];
  if (nearby) return nearby;
  if (locked) return locked;
  if (!inspectorLock.value) return targets.sort((a, b) => a.distance - b.distance)[0] ?? null;
  return null;
}
function hitTarget(mx: number, my: number) {
  const target = nearestTarget(mx, my);
  if (!target) return null;
  if (targetMatches(target, inspectorLock.value)) return target;
  return target.distance < targetHitRadius(target) ? target : null;
}
function syncSelection(target: ShipCanvasTarget | null) {
  if (!target) return false;
  const nextSelected = targetIndex(target);
  const changed = hovered.value?.kind !== target.kind || hovered.value?.i !== target.i || selected.value !== nextSelected;
  hovered.value = { kind: target.kind, i: target.i };
  selected.value = nextSelected;
  activeTarget.value = { kind: target.kind, i: target.i };
  return changed;
}
function clearCanvasSelection() {
  const changed = hovered.value !== null || selected.value !== null;
  hovered.value = null;
  selected.value = null;
  activeTarget.value = null;
  return changed;
}
function dragKindForTarget(target: ShipCanvasTarget) {
  return target.kind;
}
function selectForPointer(mx: number, my: number) {
  const target = nearestTarget(mx, my) ?? hitTarget(mx, my);
  if (target) {
    syncSelection(target);
    return target;
  }
  clearCanvasSelection();
  return null;
}
function lockedOrActiveTarget() {
  return inspectorLock.value ?? activeTarget.value;
}
function selectIdentityTarget(identity: ShipCanvasTargetIdentity | null) {
  if (!identity) return null;
  const target = selectableTargets(last.x, last.y).find((item) => targetMatches(item, identity)) ?? null;
  if (target) syncSelection(target);
  return target;
}
function selectForModifierOperation(e: MouseEvent) {
  if ((mode.value === 'weapon' || mode.value === 'engine') && (e.altKey || e.ctrlKey)) {
    return selectIdentityTarget(lockedOrActiveTarget()) ?? selectForPointer(last.x, last.y);
  }
  if (mode.value === 'ranges' && (e.shiftKey || e.ctrlKey))
    return selectIdentityTarget(activeTarget.value) ?? selectForPointer(last.x, last.y);
  return selectForPointer(last.x, last.y);
}
function nearestBoundsSegmentIndex(point: number[]) {
  const count = Math.floor(bounds.value.length / 2);
  if (count < 2) return count - 1;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i += 1) {
    const a = [bounds.value[i * 2], bounds.value[i * 2 + 1]];
    const next = (i + 1) % count;
    const b = [bounds.value[next * 2], bounds.value[next * 2 + 1]];
    const d = distanceToSegment(point, a, b);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }
  return bestIndex;
}
function shiftRelativePosition(value: RowData[string], dxAbsolute: number, dyAbsolute: number) {
  const loc = arr(value, [0, 0]);
  loc[0] = snapToStep((loc[0] || 0) - dyAbsolute);
  loc[1] = snapToStep((loc[1] || 0) + dxAbsolute);
  return loc;
}
function offsetRelativeFields(dxAbsolute: number, dyAbsolute: number) {
  localShip.value.shieldCenter = shiftRelativePosition(localShip.value.shieldCenter, dxAbsolute, dyAbsolute);
  for (const slot of weaponSlots.value) slot.locations = shiftRelativePosition(slot.locations, dxAbsolute, dyAbsolute);
  for (const engine of engineSlots.value) engine.location = shiftRelativePosition(engine.location, dxAbsolute, dyAbsolute);
  for (let i = 0; i < bounds.value.length; i += 2) {
    bounds.value[i] = snapToStep((bounds.value[i] || 0) - dyAbsolute);
    bounds.value[i + 1] = snapToStep((bounds.value[i + 1] || 0) + dxAbsolute);
  }
}
function distanceToSegment(point: number[], a: number[], b: number[]) {
  const ax = a[0] || 0;
  const ay = a[1] || 0;
  const bx = b[0] || 0;
  const by = b[1] || 0;
  const px = point[0] || 0;
  const py = point[1] || 0;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function copyWeaponSlotAt(coord: number[]) {
  const source = selectedSlot.value ? deepClone(selectedSlot.value) : {};
  const relativeCoord = absoluteToRelative(coord);
  weaponSlots.value.push({
    ...source,
    id: nextWeaponSlotId(),
    size: str(source.size, 'MEDIUM'),
    type: str(source.type, 'BALLISTIC'),
    mount: str(source.mount, 'TURRET'),
    arc: num(source.arc, 120),
    angle: num(source.angle, 0),
    locations: relativeCoord,
  });
  selected.value = weaponSlots.value.length - 1;
  hovered.value = { kind: 'weapon', i: selected.value };
  activeTarget.value = { kind: 'weapon', i: selected.value };
}
function addLaunchBayAt(coord: number[]) {
  const relativeCoord = absoluteToRelative(coord);
  weaponSlots.value.push({
    id: nextLaunchBayId(),
    size: 'LARGE',
    type: 'LAUNCH_BAY',
    mount: 'HIDDEN',
    arc: 360,
    angle: 0,
    locations: relativeCoord,
  });
  selected.value = weaponSlots.value.length - 1;
  hovered.value = { kind: 'weapon', i: selected.value };
  activeTarget.value = { kind: 'weapon', i: selected.value };
}
function copyEngineAt(coord: number[]) {
  const source = selectedEngine.value ? deepClone(selectedEngine.value) : {};
  const relativeCoord = absoluteToRelative(coord);
  engineSlots.value.push({
    ...source,
    angle: num(source.angle, 180),
    contrailSize: num(source.contrailSize, 12),
    length: num(source.length, 30),
    width: num(source.width, 10),
    location: relativeCoord,
    style: str(source.style, 'LOW_TECH'),
  });
  selected.value = engineSlots.value.length - 1;
  hovered.value = { kind: 'engine', i: selected.value };
  activeTarget.value = { kind: 'engine', i: selected.value };
}
function updateInteraction(mx: number, my: number) {
  const coord = canvasToShip(mx, my);
  const rawCoord = rawCanvasToShip(mx, my);
  const relativeCoord = canvasToRelative(mx, my);
  if (dragging.value === 'weapon' && selectedSlot.value) selectedSlot.value.locations = relativeCoord;
  if (dragging.value === 'engine' && selectedEngine.value) selectedEngine.value.location = relativeCoord;
  if (dragging.value === 'bound' && selected.value !== null) {
    bounds.value[selected.value * 2] = relativeCoord[0];
    bounds.value[selected.value * 2 + 1] = relativeCoord[1];
  }
  if (dragging.value === 'shield') localShip.value.shieldCenter = relativeCoord;
  if (dragging.value === 'center') {
    const previous = center.value;
    localShip.value.center = coord;
    offsetRelativeFields((coord[0] || 0) - (previous[0] || 0), (coord[1] || 0) - (previous[1] || 0));
  }
  if (dragging.value === 'collisionRadius') localShip.value.collisionRadius = Math.max(0, Math.round(distance(rawCoord, center.value)));
  if (dragging.value === 'shieldRadius')
    localShip.value.shieldRadius = Math.max(0, Math.round(distance(rawCoord, relativeToAbsolute(shieldCenter.value))));
  if (dragging.value === 'weaponAngle' && selectedSlot.value) {
    selectedSlot.value.angle = pointAngle(relativeToAbsolute(slotLoc.value), rawCoord);
  }
  if (dragging.value === 'weaponArc' && selectedSlot.value) {
    selectedSlot.value.arc = pointArc(relativeToAbsolute(slotLoc.value), rawCoord, num(selectedSlot.value.angle, 0));
  }
  if (dragging.value === 'engineAngle' && selectedEngine.value) {
    selectedEngine.value.angle = pointAngle(relativeToAbsolute(engineLoc.value), rawCoord);
  }
  if (dragging.value === 'engineSize') applyEngineSizeFromPointer(mx, my);
}
function startBoundsInsert(coord: number[], insertAfter: number) {
  const at = Math.max(0, Math.min(bounds.value.length, (insertAfter + 1) * 2));
  bounds.value.splice(at, 0, coord[0], coord[1]);
  selected.value = at / 2;
  hovered.value = { kind: 'bound', i: selected.value };
  activeTarget.value = { kind: 'bound', i: selected.value };
  dragging.value = 'bound';
}
function applyEngineSizeFromPointer(mx: number, my: number) {
  if (!selectedEngine.value) return;
  const { length, width } = engineSizeFromPointer(mx, my);
  selectedEngine.value.width = width;
  selectedEngine.value.length = length;
}
function engineSizeFromPointer(mx: number, my: number) {
  const point = canvasToRelative(mx, my);
  const origin = engineLoc.value;
  const angle = (num(selectedEngine.value?.angle, 0) * Math.PI) / 180;
  const dx = (point[0] || 0) - (origin[0] || 0);
  const dy = (point[1] || 0) - (origin[1] || 0);
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  const across = -dx * Math.sin(angle) + dy * Math.cos(angle);
  return {
    length: Math.max(8, Math.round(Math.abs(along)) || num(selectedEngine.value?.length, 20)),
    width: Math.max(4, Math.round(Math.abs(across) * 2) || num(selectedEngine.value?.width, 10)),
  };
}
function onDown(e: MouseEvent) {
  last = { x: e.offsetX, y: e.offsetY };
  if (e.button === 2) {
    panning.value = true;
    return;
  }
  if (e.button !== 0) return;
  const coord = canvasToShip(last.x, last.y);
  const relativeCoord = canvasToRelative(last.x, last.y);
  dragStarted.value = true;
  if (mode.value === 'bounds' && e.shiftKey) {
    pushUndo();
    bounds.value.push(relativeCoord[0], relativeCoord[1]);
    selected.value = bounds.value.length / 2 - 1;
    hovered.value = { kind: 'bound', i: selected.value };
    activeTarget.value = { kind: 'bound', i: selected.value };
    dragging.value = 'bound';
    draw();
    return;
  }
  if (mode.value === 'bounds' && e.ctrlKey) {
    pushUndo();
    startBoundsInsert(relativeCoord, nearestBoundsSegmentIndex(relativeCoord));
    draw();
    return;
  }
  if (mode.value === 'launchBay' && e.shiftKey) {
    pushUndo();
    addLaunchBayAt(coord);
    dragging.value = 'weapon';
    draw();
    return;
  }
  if (mode.value === 'weapon' && e.shiftKey) {
    pushUndo();
    copyWeaponSlotAt(coord);
    dragging.value = 'weapon';
    clearHoverPreview();
    draw();
    return;
  }
  if (mode.value === 'engine' && e.shiftKey) {
    pushUndo();
    copyEngineAt(coord);
    dragging.value = 'engine';
    clearHoverPreview();
    draw();
    return;
  }
  const h = selectForModifierOperation(e);
  if (!h) {
    dragStarted.value = false;
    draw();
    return;
  }
  if (mode.value === 'weapon' && e.altKey) dragging.value = 'weaponArc';
  else if (mode.value === 'weapon' && e.ctrlKey) dragging.value = 'weapon';
  else if (mode.value === 'weapon') dragging.value = 'weaponAngle';
  else if (mode.value === 'engine' && e.altKey) dragging.value = 'engineSize';
  else if (mode.value === 'engine' && e.ctrlKey) dragging.value = 'engine';
  else if (mode.value === 'engine') dragging.value = 'engineAngle';
  else if (mode.value === 'ranges' && e.shiftKey) dragging.value = 'collisionRadius';
  else if (mode.value === 'ranges' && e.ctrlKey) dragging.value = 'shieldRadius';
  else if (mode.value === 'ranges') dragging.value = targetKindAt(last.x, last.y) || dragKindForTarget(h);
  else dragging.value = dragKindForTarget(h);
  pushUndo();
  clearHoverPreview();
  updateInteraction(last.x, last.y);
  draw();
}
function onMove(e: MouseEvent) {
  const mx = e.offsetX;
  const my = e.offsetY;
  pointerInside.value = true;
  last = { x: mx, y: my };
  if (panning.value) {
    viewport.panBy(e.movementX, e.movementY);
    draw();
    return;
  }
  if (!dragging.value) {
    if (shouldPauseAutoSnap(e)) {
      updateHoverPreview(mx, my, e);
      draw();
      return;
    }
    const target = nearestTarget(mx, my);
    const changed = target ? syncSelection(target) : false;
    updateHoverPreview(mx, my, e);
    if (changed || hoverPreview.value) draw();
    else draw();
    return;
  }
  updateInteraction(mx, my);
  draw();
}
function onUp() {
  dragging.value = null;
  panning.value = false;
  dragStarted.value = false;
}
function onKeyUp(event: KeyboardEvent) {
  if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt') return;
  if (!hoverPreview.value) return;
  updateHoverPreview(last.x, last.y, event);
  if (!hoverPreview.value) draw();
}
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt') return;
  if (!pointerInside.value || dragging.value || panning.value) return;
  updateHoverPreview(last.x, last.y, event);
  if (hoverPreview.value) draw();
}
function onLeave() {
  dragging.value = null;
  panning.value = false;
  dragStarted.value = false;
  pointerInside.value = false;
  hovered.value = null;
  clearHoverPreview();
  draw();
}
function onWheel(e: WheelEvent) {
  viewport.zoom(e.deltaY);
  draw();
}
function setArray(key: string, idx: number, value: number | null) {
  pushUndo();
  const v = arr(localShip.value[key], [0, 0]);
  v[idx] = value || 0;
  localShip.value[key] = v;
  draw();
}
function setSlotLoc(idx: number, value: number | null) {
  if (!selectedSlot.value) return;
  selectedSlot.value.locations = slotLoc.value;
  slotLoc.value[idx] = value || 0;
  draw();
}
function setEngineLoc(idx: number, value: number | null) {
  if (!selectedEngine.value) return;
  selectedEngine.value.location = engineLoc.value;
  engineLoc.value[idx] = value || 0;
  draw();
}
function setBound(idx: number, value: number | null) {
  bounds.value[idx] = value || 0;
  draw();
}
function selectInspectorItem(nextMode: typeof mode.value, index: number, kind: ShipCanvasTarget['kind']) {
  mode.value = nextMode;
  selected.value = index;
  hovered.value = { kind, i: index };
  activeTarget.value = { kind, i: index };
  inspectorLock.value = { kind, i: index };
  draw();
}
function nextWeaponSlotId() {
  const used = new Set<string>();
  for (const slot of weaponSlots.value) {
    const id = str(slot.id);
    if (/^WS\d{4}$/.test(id)) used.add(id);
  }
  for (let index = 1; index <= 9999; index += 1) {
    const id = `WS${String(index).padStart(4, '0')}`;
    if (!used.has(id)) return id;
  }
  return `WS${String(weaponSlots.value.length + 1).padStart(4, '0')}`;
}
function nextLaunchBayId() {
  const used = new Set<string>();
  for (const item of launchBaySlots.value) {
    const id = str(item.slot.id);
    if (/^LB \d+$/.test(id)) used.add(id);
  }
  for (let index = 1; index <= 9999; index += 1) {
    const id = `LB ${index}`;
    if (!used.has(id)) return id;
  }
  return `LB ${launchBaySlots.value.length + 1}`;
}
function addWeaponSlot() {
  pushUndo();
  weaponSlots.value.push({
    id: nextWeaponSlotId(),
    size: 'MEDIUM',
    type: 'BALLISTIC',
    mount: 'TURRET',
    arc: 120,
    angle: 0,
    locations: [0, 0],
  });
  mode.value = 'weapon';
  selected.value = weaponSlots.value.length - 1;
  draw();
}
function addLaunchBay() {
  pushUndo();
  weaponSlots.value.push({
    id: nextLaunchBayId(),
    size: 'LARGE',
    type: 'LAUNCH_BAY',
    mount: 'HIDDEN',
    arc: 360,
    angle: 0,
    locations: [0, 0],
  });
  mode.value = 'launchBay';
  selected.value = weaponSlots.value.length - 1;
  draw();
}
function addEngine() {
  pushUndo();
  engineSlots.value.push({ angle: 180, contrailSize: 12, length: 30, width: 10, location: [-50, 0], style: 'LOW_TECH' });
  mode.value = 'engine';
  selected.value = engineSlots.value.length - 1;
  draw();
}
function addBound() {
  pushUndo();
  bounds.value.push(0, 0);
  mode.value = 'bounds';
  selected.value = bounds.value.length / 2 - 1;
  draw();
}
function deleteSelected() {
  if (selected.value === null) return false;
  const selectedIndex = selected.value;
  let deleted = false;
  pushUndo();
  if (mode.value === 'weapon' || mode.value === 'launchBay') {
    const isLaunchBay = str(weaponSlots.value[selectedIndex]?.type).toUpperCase() === 'LAUNCH_BAY';
    if ((mode.value === 'weapon' && !isLaunchBay) || (mode.value === 'launchBay' && isLaunchBay)) {
      weaponSlots.value.splice(selectedIndex, 1);
      deleted = true;
    }
  }
  if (mode.value === 'engine') {
    engineSlots.value.splice(selectedIndex, 1);
    deleted = true;
  }
  if (mode.value === 'bounds') {
    bounds.value.splice(selectedIndex * 2, 2);
    deleted = true;
  }
  if (!deleted) return false;
  selected.value = null;
  hovered.value = null;
  activeTarget.value = null;
  inspectorLock.value = null;
  draw();
  return true;
}
function applyBuiltInWeapons() {
  try {
    localShip.value.builtInWeapons = JSON.parse(builtInWeaponsText.value);
  } catch {
    feedback.error('builtInWeapons JSON 无效');
  }
}
async function uploadShipSprite(event: Event) {
  try {
    await uploadSpriteFromInput(event, {
      feedback,
      modRoot: props.modRoot,
      subfolder: 'ships',
      onUploaded: (result, dataUrl) => {
        localShip.value.spriteName = result.state.path;
        img.src = dataUrl;
        img.onload = () => {
          updateSpriteSize();
          draw();
        };
        feedback.success('贴图已上传');
      },
    });
  } catch (error) {
    feedback.error(error, '上传贴图失败');
  }
}
function save() {
  emit('save-requested', localShip.value);
}
watch(
  () => props.ship,
  (ship) => {
    localShip.value = normalizeShipSpec(ship);
    builtInWeaponsText.value = JSON.stringify(localShip.value.builtInWeapons || {}, null, 2);
    selected.value = null;
    activeTarget.value = null;
    inspectorLock.value = null;
    clearHoverPreview();
  },
  { deep: true },
);
watch(localShip, draw, { deep: true });
onMounted(() => {
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  nextTick(() => {
    editorWindowRef.value?.focus({ preventScroll: true });
    resizeCanvas();
    if (props.spriteData) {
      img.src = props.spriteData;
      img.onload = () => {
        updateSpriteSize();
        if (img.width) scale.value = Math.min(1, 500 / Math.max(img.width, img.height));
        draw();
      };
    }
  });
});
onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>
