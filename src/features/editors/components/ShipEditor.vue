<template>
  <div class="modal-backdrop">
    <div class="editor-window">
      <header class="editor-header">
        <strong>舰船编辑器: {{ localShip.hullName || hullId }}</strong>
        <div class="segmented">
          <button v-for="m in modes" :key="m.value" :class="{ active: mode === m.value }" @click="setMode(m.value)">{{ m.label }}</button>
        </div>
      </header>
      <div class="editor-body">
        <div ref="stageRef" class="canvas-stage">
          <canvas
            ref="canvasRef"
            class="editor-canvas"
            @mousedown="onDown"
            @mousemove="onMove"
            @mouseup="onUp"
            @mouseleave="onUp"
            @wheel.prevent="onWheel"
            @contextmenu.prevent
          />
        </div>
        <aside class="editor-side">
          <div class="editor-scroll">
            <n-collapse default-expanded-names="basic">
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
                    v-for="(slot, i) in weaponSlots"
                    :key="i"
                    :class="{ selected: mode === 'weapon' && selected === i }"
                    @click="
                      mode = 'weapon';
                      selected = i;
                      draw();
                    "
                  >
                    {{ slot.id || `slot ${i}` }} <span>{{ slot.size }} {{ slot.type }}</span>
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
                        'LAUNCH_BAY',
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
                <div class="button-row">
                  <n-button @click="addWeaponSlot">添加</n-button><n-button type="error" ghost @click="deleteSelected">删除</n-button>
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
                <div class="button-row">
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
                <div class="button-row">
                  <n-button @click="addBound">添加点</n-button><n-button type="error" ghost @click="deleteSelected">删除点</n-button>
                </div>
              </n-collapse-item>
              <n-collapse-item title="内置装备" name="builtins">
                <textarea v-model="builtInWeaponsText" @change="applyBuiltInWeapons" />
                <label>builtInMods</label><n-dynamic-tags v-model:value="builtInMods" /> <label>builtInWings</label
                ><n-dynamic-tags v-model:value="builtInWings" />
              </n-collapse-item>
            </n-collapse>
          </div>
        </aside>
      </div>
      <footer class="editor-footer">
        <span>Ctrl+Z 撤销 | Ctrl+Y 重做 | 右键拖动画布 | 滚轮缩放</span>
        <n-button @click="$emit('close')">关闭</n-button>
        <n-button type="primary" @click="save">保存 .ship</n-button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { saveShipSpec } from '../editor.service';
import type { RowData } from '../../../shared/types';
import { arr, num, SLOT_RADIUS, str, WEAPON_COLORS } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import { normalizeShipSpec } from '../lib/normalize';
import { useHistory } from '../composables/useHistory';
import { useCanvasDrawing } from '../composables/useCanvasDrawing';
import { useCanvasViewport } from '../composables/useCanvasViewport';
import { useEditorShortcuts } from '../composables/useEditorShortcuts';
import { useSpriteUpload } from '../composables/useSpriteUpload';
import { snapToStep, toOptions as opts } from '../lib/editor-utils';

const props = defineProps<{ modRoot: string; hullId: string; ship: RowData; spriteData?: string; availableSprites: string[] }>();
const emit = defineEmits<{ close: []; saved: [id: string, ship: RowData] }>();
const message = useMessage();
const dialog = useDialog();
const stageRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const localShip = ref<RowData>(normalizeShipSpec(props.ship));
const mode = ref<'weapon' | 'engine' | 'bounds' | 'props'>('weapon');
const selected = ref(-1);
const viewport = useCanvasViewport(canvasRef, 1, 10);
const { scale } = viewport;
const img = new Image();
const dragging = ref('');
const panning = ref(false);
let last = { x: 0, y: 0 };
const history = useHistory(() => localShip.value);
const drawing = useCanvasDrawing();
const { uploadSpriteFile } = useSpriteUpload();
const modes = [
  { value: 'weapon', label: '武器' },
  { value: 'engine', label: '引擎' },
  { value: 'bounds', label: '边界' },
  { value: 'props', label: '属性' },
] as const;

const weaponSlots = computed<RowData[]>(() =>
  Array.isArray(localShip.value.weaponSlots) ? (localShip.value.weaponSlots as RowData[]) : [],
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
  if (bounds.value.length >= 4 && (mode.value === 'bounds' || mode.value === 'props')) {
    ctx.beginPath();
    for (let i = 0; i < bounds.value.length; i += 2) {
      const p = shipToCanvas([bounds.value[i], bounds.value[i + 1]]);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (mode.value === 'bounds')
      for (let i = 0; i < bounds.value.length; i += 2)
        drawing.drawDot(ctx, shipToCanvas([bounds.value[i], bounds.value[i + 1]]), i / 2 === selected.value ? '#fff' : '#22c55e', 5);
  }
  if (mode.value === 'props') {
    const sp = shipToCanvas(shieldCenter.value);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#06b6d4aa';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, num(localShip.value.shieldRadius, 0) * scale.value, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawing.drawDot(ctx, sp, '#06b6d4', 8);
    drawing.drawDot(ctx, cc, '#fff', 6);
  }
  if (mode.value === 'weapon' || mode.value === 'props')
    weaponSlots.value.forEach((slot, i) => {
      const p = shipToCanvas(arr(slot.locations, [0, 0]));
      const color = WEAPON_COLORS[str(slot.type)] || '#888';
      const r = SLOT_RADIUS[str(slot.size)] || 6;
      drawing.drawDot(ctx, p, i === selected.value && mode.value === 'weapon' ? '#fff' : color, r);
      if (num(slot.arc) > 0) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  if (mode.value === 'engine' || mode.value === 'props')
    engineSlots.value.forEach((eng, i) => {
      const p = shipToCanvas(arr(eng.location, [0, 0]));
      const ew = num(eng.width, 10) * scale.value;
      const el = num(eng.length, 20) * scale.value;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-Math.PI / 2 + (num(eng.angle) * Math.PI) / 180);
      ctx.fillStyle = i === selected.value && mode.value === 'engine' ? '#fbbf24' : '#f59e0b88';
      ctx.fillRect(0, -ew / 2, el, ew);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(0, -ew / 2, el, ew);
      ctx.restore();
    });
}
function hit(mx: number, my: number) {
  if (mode.value === 'weapon')
    for (let i = weaponSlots.value.length - 1; i >= 0; i--) {
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
  if (mode.value === 'props') {
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
  if (!dragging.value) return;
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
function addWeaponSlot() {
  pushUndo();
  weaponSlots.value.push({
    id: `WS_NEW_${weaponSlots.value.length}`,
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
  if (mode.value === 'weapon' && selected.value >= 0) weaponSlots.value.splice(selected.value, 1);
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
