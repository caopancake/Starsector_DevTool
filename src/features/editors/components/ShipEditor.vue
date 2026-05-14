<template>
  <div class="modal-backdrop">
    <div class="editor-window">
      <EditorHeader title="舰船编辑器" :subtitle="str(localShip.hullName) || hullId">
        <div class="segmented ship-mode-tabs">
          <button v-for="m in modes" :key="m.value" :class="{ active: mode === m.value }" @click="setMode(m.value)">{{ m.label }}</button>
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
          <n-collapse default-expanded-names="basic" :theme-overrides="editorCollapseTheme">
            <n-collapse-item title="船体属性" name="basic">
              <div class="form-grid">
                <label>hullId</label><n-input v-model:value="localShip.hullId" /> <label>hullName</label
                ><n-input v-model:value="localShip.hullName" /> <label>hullSize</label
                ><n-select v-model:value="localShip.hullSize" :options="opts(['FRIGATE', 'DESTROYER', 'CRUISER', 'CAPITAL_SHIP'])" />
                <label>style</label
                ><n-select v-model:value="localShip.style" :options="opts(['LOW_TECH', 'MIDLINE', 'HIGH_TECH', 'CUSTOM'])" />
                <label>width</label><n-input-number v-model:value="localShip.width" @update:value="draw" /> <label>height</label
                ><n-input-number v-model:value="localShip.height" @update:value="draw" /> <label>collisionRadius</label
                ><n-input-number v-model:value="localShip.collisionRadius" @update:value="draw" />
              </div>
            </n-collapse-item>
            <n-collapse-item title="贴图" name="sprite">
              <div class="form-grid">
                <label>spriteName</label><n-input v-model:value="localShip.spriteName" @change="loadSprite" /> <label>选择已有</label
                ><n-select
                  v-model:value="localShip.spriteName"
                  filterable
                  :options="availableSprites.map((s) => ({ label: s, value: s }))"
                  @update:value="loadSprite"
                />
              </div>
              <input type="file" accept="image/png" @change="uploadShipSprite" />
            </n-collapse-item>
            <n-collapse-item title="中心与护盾" name="props">
              <div class="form-grid">
                <label>center X</label><n-input-number :value="center[0]" @update:value="setArray('center', 0, $event)" />
                <label>center Y</label><n-input-number :value="center[1]" @update:value="setArray('center', 1, $event)" />
                <label>shield X</label><n-input-number :value="shieldCenter[0]" @update:value="setArray('shieldCenter', 0, $event)" />
                <label>shield Y</label><n-input-number :value="shieldCenter[1]" @update:value="setArray('shieldCenter', 1, $event)" />
                <label>shieldRadius</label><n-input-number v-model:value="localShip.shieldRadius" @update:value="draw" />
              </div>
            </n-collapse-item>
            <n-collapse-item title="武器槽" name="weapons">
              <div class="item-list">
                <button
                  v-for="item in normalWeaponSlots"
                  :key="item.index"
                  :class="{ selected: mode === 'weapon' && selected === item.index }"
                  @click="
                    mode = 'weapon';
                    selected = item.index;
                    draw();
                  "
                >
                  {{ item.slot.id || `slot ${item.index}` }} <span>{{ item.slot.size }} {{ item.slot.type }}</span>
                </button>
              </div>
              <div v-if="mode === 'weapon' && selectedSlot" class="form-grid">
                <label>id</label><n-input v-model:value="selectedSlot.id" /> <label>size</label
                ><n-select v-model:value="selectedSlot.size" :options="opts(['SMALL', 'MEDIUM', 'LARGE'])" @update:value="draw" />
                <label>type</label
                ><n-select
                  v-model:value="selectedSlot.type"
                  :options="
                    opts([
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
                <label>mount</label><n-select v-model:value="selectedSlot.mount" :options="opts(['TURRET', 'HARDPOINT', 'HIDDEN'])" />
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
                  :class="{ selected: mode === 'launchBay' && selected === item.index }"
                  @click="
                    mode = 'launchBay';
                    selected = item.index;
                    draw();
                  "
                >
                  {{ item.slot.id || `LB ${item.index + 1}` }} <span>甲板</span>
                </button>
              </div>
              <div v-if="mode === 'launchBay' && selectedSlot" class="form-grid">
                <label>id</label><n-input v-model:value="selectedSlot.id" />
                <label>loc X</label><n-input-number :value="slotLoc[0]" @update:value="setSlotLoc(0, $event)" />
                <label>loc Y</label><n-input-number :value="slotLoc[1]" @update:value="setSlotLoc(1, $event)" />
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
                  :class="{ selected: mode === 'engine' && selected === i }"
                  @click="
                    mode = 'engine';
                    selected = i;
                    draw();
                  "
                >
                  引擎 {{ i }} <span>{{ eng.width }}x{{ eng.length }}</span>
                </button>
              </div>
              <div v-if="mode === 'engine' && selectedEngine" class="form-grid">
                <label>angle</label><n-input-number v-model:value="selectedEngine.angle" @update:value="draw" /> <label>width</label
                ><n-input-number v-model:value="selectedEngine.width" @update:value="draw" /> <label>length</label
                ><n-input-number v-model:value="selectedEngine.length" @update:value="draw" /> <label>contrailSize</label
                ><n-input-number v-model:value="selectedEngine.contrailSize" /> <label>style</label
                ><n-select v-model:value="selectedEngine.style" :options="opts(['LOW_TECH', 'MIDLINE', 'HIGH_TECH', 'CUSTOM'])" />
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
                  :class="{ selected: mode === 'bounds' && selected === i }"
                  @click="
                    mode = 'bounds';
                    selected = i;
                    draw();
                  "
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
      <EditorFooter note="Ctrl+Z 撤销 | Ctrl+Y 重做 | 右键拖动画布 | 滚轮缩放">
        <template #actions>
          <n-button @click="$emit('close')">关闭</n-button>
          <n-button type="primary" @click="save">保存 .ship</n-button>
        </template>
      </EditorFooter>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import EditorFooter from './common/EditorFooter.vue';
import EditorHeader from './common/EditorHeader.vue';
import EditorInspector from './common/EditorInspector.vue';
import { saveShipSpec } from '../editor.service';
import type { RowData } from '../../../shared/types';
import { arr, num, str } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import { normalizeShipSpec } from '../lib/normalize';
import { useHistory } from '../composables/useHistory';
import { useCanvasDrawing } from '../composables/useCanvasDrawing';
import { useCanvasViewport } from '../composables/useCanvasViewport';
import { useEditorShortcuts } from '../composables/useEditorShortcuts';
import { useSpriteUpload } from '../composables/useSpriteUpload';
import { snapToStep, toOptions as opts } from '../lib/editor-utils';
import { editorCollapseTheme } from '../lib/editor-theme';
import { drawBoundsVisual, drawEngineVisual, drawRadiusField, drawWeaponSlotVisual } from '../lib/canvas-visuals';

const props = defineProps<{ modRoot: string; hullId: string; ship: RowData; spriteData?: string; availableSprites: string[] }>();
const emit = defineEmits<{ close: []; saved: [id: string, ship: RowData] }>();
const message = useMessage();
const dialog = useDialog();
const stageRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const localShip = ref<RowData>(normalizeShipSpec(props.ship));
const mode = ref<'overview' | 'ranges' | 'bounds' | 'weapon' | 'launchBay' | 'engine'>('overview');
const selected = ref(-1);
const viewport = useCanvasViewport(canvasRef, 1, 10);
const { scale } = viewport;
const img = new Image();
const dragging = ref('');
const hovered = ref<{ kind: string; i: number } | null>(null);
const panning = ref(false);
let last = { x: 0, y: 0 };
const history = useHistory(() => localShip.value);
const drawing = useCanvasDrawing();
const { uploadSpriteFile } = useSpriteUpload();
const modes = [
  { value: 'overview', label: '总览' },
  { value: 'ranges', label: '范围' },
  { value: 'bounds', label: '边界' },
  { value: 'weapon', label: '武器' },
  { value: 'launchBay', label: '甲板' },
  { value: 'engine', label: '引擎' },
] as const;

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
const selectedSlot = computed(() => weaponSlots.value[selected.value]);
const selectedEngine = computed(() => engineSlots.value[selected.value]);
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
  selected.value = -1;
  draw();
}
function doRedo() {
  const next = history.redo(localShip.value);
  if (!next) return;
  localShip.value = normalizeShipSpec(next);
  selected.value = -1;
  draw();
}
useEditorShortcuts({ redo: doRedo, undo: doUndo });
function setMode(value: typeof mode.value) {
  mode.value = value;
  selected.value = -1;
  draw();
}
function canvasCenter() {
  return viewport.center();
}
function shipToCanvas(loc: number[]) {
  return viewport.toCanvas('ship', loc[0] || 0, loc[1] || 0);
}
function canvasToShip(x: number, y: number) {
  const point = viewport.fromCanvas('ship', x, y);
  return [snapToStep(point.x), snapToStep(point.y)];
}
function resizeCanvas() {
  const rect = stageRef.value?.getBoundingClientRect();
  if (viewport.resize(rect?.width, rect?.height)) draw();
}
function loadSprite() {
  img.src = props.spriteData || '';
  if (str(localShip.value.spriteName) && !props.spriteData) img.src = '';
  draw();
}

function draw() {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  const cc = canvasCenter();
  drawing.clear(ctx, c.width, c.height);
  drawing.drawGrid(ctx, { center: cc, height: c.height, scale: scale.value, width: c.width });
  if (img.width) {
    const cen = center.value;
    ctx.globalAlpha = 0.72;
    drawing.drawPixelImage(
      ctx,
      img,
      cc.x - cen[0] * scale.value,
      cc.y - cen[1] * scale.value,
      img.width * scale.value,
      img.height * scale.value,
    );
    ctx.globalAlpha = 1;
  }
  if (bounds.value.length >= 4 && (mode.value === 'bounds' || mode.value === 'overview')) {
    const points = [];
    for (let i = 0; i < bounds.value.length; i += 2) points.push(shipToCanvas([bounds.value[i], bounds.value[i + 1]]));
    drawBoundsVisual(
      ctx,
      points,
      mode.value === 'bounds' ? selected.value : -1,
      mode.value === 'bounds' && hovered.value?.kind === 'bound' ? hovered.value.i : -1,
    );
  }
  if (mode.value === 'ranges' || mode.value === 'overview') {
    const sp = shipToCanvas(shieldCenter.value);
    drawRadiusField(
      ctx,
      cc,
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
      drawWeaponSlotVisual(ctx, {
        angle: num(slot.angle, 0),
        arc: num(slot.arc, 0),
        hovered:
          (mode.value === 'weapon' || mode.value === 'launchBay') && hovered.value?.kind === 'weapon' && hovered.value.i === i,
        mount: str(slot.mount),
        point: shipToCanvas(arr(slot.locations, [0, 0])),
        selected: (mode.value === 'weapon' || mode.value === 'launchBay') && i === selected.value,
        size: str(slot.size, 'MEDIUM'),
        type: str(slot.type, 'SYSTEM'),
      });
    });
  if (mode.value === 'engine' || mode.value === 'overview')
    engineSlots.value.forEach((eng, i) => {
      drawEngineVisual(ctx, {
        angle: num(eng.angle, 0),
        hovered: mode.value === 'engine' && hovered.value?.kind === 'engine' && hovered.value.i === i,
        length: num(eng.length, 20),
        point: shipToCanvas(arr(eng.location, [0, 0])),
        scale: scale.value,
        selected: mode.value === 'engine' && i === selected.value,
        width: num(eng.width, 10),
      });
    });
}
function hit(mx: number, my: number) {
  if (mode.value === 'weapon' || mode.value === 'launchBay')
    for (let i = weaponSlots.value.length - 1; i >= 0; i--) {
      const isLaunchBay = str(weaponSlots.value[i].type).toUpperCase() === 'LAUNCH_BAY';
      if (mode.value === 'weapon' && isLaunchBay) continue;
      if (mode.value === 'launchBay' && !isLaunchBay) continue;
      const p = shipToCanvas(arr(weaponSlots.value[i].locations, [0, 0]));
      if (Math.hypot(mx - p.x, my - p.y) < 14) return { kind: 'weapon', i };
    }
  if (mode.value === 'engine')
    for (let i = engineSlots.value.length - 1; i >= 0; i--) {
      const p = shipToCanvas(arr(engineSlots.value[i].location, [0, 0]));
      if (Math.hypot(mx - p.x, my - p.y) < 16) return { kind: 'engine', i };
    }
  if (mode.value === 'bounds')
    for (let i = 0; i < bounds.value.length; i += 2) {
      const p = shipToCanvas([bounds.value[i], bounds.value[i + 1]]);
      if (Math.hypot(mx - p.x, my - p.y) < 14) return { kind: 'bound', i: i / 2 };
    }
  if (mode.value === 'ranges') {
    const sp = shipToCanvas(shieldCenter.value);
    const cc = canvasCenter();
    if (Math.hypot(mx - sp.x, my - sp.y) < 14) return { kind: 'shield', i: 0 };
    if (Math.hypot(mx - cc.x, my - cc.y) < 14) return { kind: 'center', i: 0 };
  }
  return null;
}
function onDown(e: MouseEvent) {
  last = { x: e.offsetX, y: e.offsetY };
  if (e.button === 2) {
    panning.value = true;
    return;
  }
  const h = hit(last.x, last.y);
  if (h) {
    pushUndo();
    selected.value = h.i;
    dragging.value = h.kind;
    draw();
  } else selected.value = -1;
}
function onMove(e: MouseEvent) {
  const mx = e.offsetX;
  const my = e.offsetY;
  const dx = mx - last.x;
  const dy = my - last.y;
  last = { x: mx, y: my };
  if (panning.value) {
    viewport.panBy(dx, dy);
    draw();
    return;
  }
  if (!dragging.value) {
    const h = hit(mx, my);
    const nextHover = h ? { kind: h.kind, i: h.i } : null;
    if (hovered.value?.kind !== nextHover?.kind || hovered.value?.i !== nextHover?.i) {
      hovered.value = nextHover;
      draw();
    }
    return;
  }
  const coord = canvasToShip(mx, my);
  if (dragging.value === 'weapon' && selectedSlot.value) selectedSlot.value.locations = coord;
  if (dragging.value === 'engine' && selectedEngine.value) selectedEngine.value.location = coord;
  if (dragging.value === 'bound') {
    bounds.value[selected.value * 2] = coord[0];
    bounds.value[selected.value * 2 + 1] = coord[1];
  }
  if (dragging.value === 'shield') localShip.value.shieldCenter = coord;
  if (dragging.value === 'center') {
    localShip.value.center = [snapToStep(center.value[0] + dx / scale.value), snapToStep(center.value[1] + dy / scale.value)];
  }
  draw();
}
function onUp() {
  dragging.value = '';
  panning.value = false;
}
function onLeave() {
  dragging.value = '';
  panning.value = false;
  hovered.value = null;
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
  pushUndo();
  if ((mode.value === 'weapon' || mode.value === 'launchBay') && selected.value >= 0) {
    const isLaunchBay = str(weaponSlots.value[selected.value]?.type).toUpperCase() === 'LAUNCH_BAY';
    if ((mode.value === 'weapon' && !isLaunchBay) || (mode.value === 'launchBay' && isLaunchBay)) {
      weaponSlots.value.splice(selected.value, 1);
    }
  }
  if (mode.value === 'engine' && selected.value >= 0) engineSlots.value.splice(selected.value, 1);
  if (mode.value === 'bounds' && selected.value >= 0) bounds.value.splice(selected.value * 2, 2);
  selected.value = -1;
  draw();
}
function applyBuiltInWeapons() {
  try {
    localShip.value.builtInWeapons = JSON.parse(builtInWeaponsText.value);
  } catch {
    message.error('builtInWeapons JSON 无效');
  }
}
async function uploadShipSprite(event: Event) {
  try {
    await uploadSpriteFile(event, {
      dialog,
      modRoot: props.modRoot,
      subfolder: 'ships',
      onUploaded: (result, dataUrl) => {
        localShip.value.spriteName = result.path;
        img.src = dataUrl;
        img.onload = () => draw();
        message.success('贴图已上传');
      },
    });
  } catch (error) {
    message.error(`上传贴图失败：${formatError(error)}`);
  }
}
async function save() {
  try {
    await saveShipSpec(props.modRoot, props.hullId, localShip.value);
    emit('saved', props.hullId, localShip.value);
  } catch (error) {
    message.error(formatError(error));
  }
}
watch(localShip, draw, { deep: true });
onMounted(() => {
  window.addEventListener('resize', resizeCanvas);
  nextTick(() => {
    resizeCanvas();
    if (props.spriteData) {
      img.src = props.spriteData;
      img.onload = () => {
        if (img.width) scale.value = Math.min(1, 500 / Math.max(img.width, img.height));
        draw();
      };
    }
  });
});
onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
});
</script>
