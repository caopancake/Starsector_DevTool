<template>
  <div class="modal-backdrop">
    <div class="editor-window">
      <header class="editor-header">
        <div class="editor-title">
          <strong>武器编辑器</strong>
          <span>{{ weaponId }}</span>
        </div>
        <div class="segmented">
          <button :class="{ active: viewMode === 'turret' }" @click="setView('turret')">炮塔视图</button>
          <button :class="{ active: viewMode === 'hardpoint' }" @click="setView('hardpoint')">固定视图</button>
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
          <div class="inspector-title">武器检查器</div>
          <div class="editor-scroll">
            <n-collapse default-expanded-names="basic" :theme-overrides="editorCollapseTheme">
              <n-collapse-item title="基础属性" name="basic">
                <div class="form-grid">
                  <label>id</label><n-input :value="weaponId" disabled /> <label>specClass</label
                  ><n-select v-model:value="localWeapon.specClass" :options="opts(['projectile', 'beam'])" /> <label>type</label
                  ><n-select
                    v-model:value="localWeapon.type"
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
                        'BUILT_IN',
                      ])
                    "
                  />
                  <label>size</label><n-select v-model:value="localWeapon.size" :options="opts(['SMALL', 'MEDIUM', 'LARGE'])" />
                </div>
              </n-collapse-item>
              <n-collapse-item title="贴图" name="sprites">
                <div class="form-grid">
                  <template v-for="field in spriteFields" :key="field">
                    <label>{{ field }}</label
                    ><n-input v-model:value="localWeapon[field]" @change="loadSprite" />
                  </template>
                </div>
                <input type="file" accept="image/png" @change="uploadCurrentSprite" />
              </n-collapse-item>
              <n-collapse-item title="发射点" name="barrels">
                <div class="item-list">
                  <button
                    v-for="(_, i) in barrelCount"
                    :key="i"
                    :class="{ selected: selected === i }"
                    @click="
                      selected = i;
                      draw();
                    "
                  >
                    炮管 {{ i }} <span>[{{ offsets[i * 2] }}, {{ offsets[i * 2 + 1] }}] {{ angles[i] || 0 }}°</span>
                  </button>
                </div>
                <div v-if="selected >= 0" class="form-grid">
                  <label>X 前进</label><n-input-number :value="offsets[selected * 2]" @update:value="setOffset(0, $event)" />
                  <label>Y 右侧</label><n-input-number :value="offsets[selected * 2 + 1]" @update:value="setOffset(1, $event)" />
                  <label>角度偏移</label><n-input-number :value="angles[selected] || 0" @update:value="setAngle($event)" />
                </div>
                <div class="form-grid">
                  <label>barrelMode</label><n-select v-model:value="localWeapon.barrelMode" :options="opts(['ALTERNATING', 'LINKED'])" />
                </div>
                <div class="button-row">
                  <n-button @click="addBarrel">添加炮管</n-button><n-button type="error" ghost @click="deleteBarrel">删除炮管</n-button>
                </div>
              </n-collapse-item>
              <n-collapse-item v-if="localWeapon.specClass === 'projectile'" title="动画" name="anim">
                <div class="form-grid">
                  <label>animationType</label
                  ><n-select
                    v-model:value="localWeapon.animationType"
                    :options="opts(['NONE', 'MUZZLE_FLASH', 'SMOKE', 'GLOW_AND_FLASH', 'GLOW'])"
                  />
                  <label>visualRecoil</label><n-input-number v-model:value="localWeapon.visualRecoil" />
                </div>
                <ObjectEditor v-model="muzzleFlashSpec" title="muzzleFlashSpec" />
                <ObjectEditor v-model="smokeSpec" title="smokeSpec" />
              </n-collapse-item>
              <n-collapse-item v-if="localWeapon.specClass === 'projectile'" title="弹体" name="proj">
                <div class="form-grid">
                  <label>projectileSpecId</label>
                  <n-auto-complete v-model:value="projectileSpecId" :options="projectileOptions" />
                </div>
                <div class="button-row">
                  <n-button @click="$emit('editProjectile', projectileSpecId)">编辑弹体</n-button>
                  <n-button tertiary @click="$emit('preview', weaponId)">预览弹体发射</n-button>
                </div>
              </n-collapse-item>
              <n-collapse-item v-if="localWeapon.specClass === 'beam'" title="光束" name="beam">
                <ColorArray label="fringeColor" v-model="fringeColor" />
                <ColorArray label="coreColor" v-model="coreColor" />
                <ColorArray label="glowColor" v-model="glowColor" />
                <div class="form-grid">
                  <label>width</label><n-input-number v-model:value="localWeapon.width" /> <label>textureType</label
                  ><n-select :options="opts(['ROUGH', 'SMOOTH', 'NONE'])" v-model:value="localWeapon.textureType" />
                  <label>textureScrollSpeed</label><n-input-number v-model:value="localWeapon.textureScrollSpeed" />
                  <label>pixelsPerTexel</label><n-input-number v-model:value="localWeapon.pixelsPerTexel" /> <label>convergeOnPoint</label
                  ><n-checkbox v-model:checked="localWeapon.convergeOnPoint" /> <label>darkCore</label
                  ><n-checkbox v-model:checked="localWeapon.darkCore" />
                </div>
                <n-button tertiary @click="$emit('preview', weaponId)">预览光束</n-button>
              </n-collapse-item>
              <n-collapse-item title="音效" name="sound">
                <div class="form-grid">
                  <label>fireSoundOne</label><n-input v-model:value="localWeapon.fireSoundOne" /> <label>fireSoundTwo</label
                  ><n-input v-model:value="localWeapon.fireSoundTwo" />
                </div>
              </n-collapse-item>
            </n-collapse>
          </div>
        </aside>
      </div>
      <footer class="editor-footer">
        <span>Ctrl+Z 撤销 | Ctrl+Y 重做 | 右键拖动画布</span>
        <div class="editor-footer-actions">
          <n-button @click="$emit('close')">关闭</n-button>
          <n-button type="primary" @click="save">保存 .wpn</n-button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import ColorArray from './common/ColorArray.vue';
import ObjectEditor from './common/ObjectEditor.vue';
import { saveWeaponSpec } from '../editor.service';
import type { RowData } from '../../../shared/types';
import { arr, str } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import { normalizeWeaponSpec } from '../lib/normalize';
import { useCanvasDrawing } from '../composables/useCanvasDrawing';
import { useCanvasViewport } from '../composables/useCanvasViewport';
import { useHistory } from '../composables/useHistory';
import { useEditorShortcuts } from '../composables/useEditorShortcuts';
import { useObjectField } from '../composables/useObjectField';
import { useSpriteUpload } from '../composables/useSpriteUpload';
import { snapToStep, toOptions as opts } from '../lib/editor-utils';
import { editorCollapseTheme } from '../lib/editor-theme';

const props = defineProps<{
  modRoot: string;
  weaponId: string;
  weapon: RowData;
  spriteData?: string;
  projectiles: Record<string, RowData>;
}>();
const emit = defineEmits<{ close: []; saved: [id: string, weapon: RowData]; editProjectile: [id: string]; preview: [id: string] }>();
const message = useMessage();
const dialog = useDialog();
const localWeapon = ref<RowData>(normalizeWeaponSpec(props.weapon));
const stageRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const viewMode = ref<'turret' | 'hardpoint'>('turret');
const selected = ref(-1);
const viewport = useCanvasViewport(canvasRef, 2, 20);
const { scale } = viewport;
const img = new Image();
const dragging = ref(false);
const panning = ref(false);
let last = { x: 0, y: 0 };
const history = useHistory(() => localWeapon.value);
const drawing = useCanvasDrawing();
const { bindObjectField } = useObjectField(localWeapon);
const { uploadSpriteFile } = useSpriteUpload();
const spriteFields = [
  'turretSprite',
  'hardpointSprite',
  'turretGunSprite',
  'hardpointGunSprite',
  'turretGlowSprite',
  'hardpointGlowSprite',
  'turretUnderSprite',
  'hardpointUnderSprite',
];

const offsetsKey = computed(() => (viewMode.value === 'turret' ? 'turretOffsets' : 'hardpointOffsets'));
const anglesKey = computed(() => (viewMode.value === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets'));
const offsets = computed<number[]>(() =>
  Array.isArray(localWeapon.value[offsetsKey.value]) ? (localWeapon.value[offsetsKey.value] as number[]) : [],
);
const angles = computed<number[]>(() =>
  Array.isArray(localWeapon.value[anglesKey.value]) ? (localWeapon.value[anglesKey.value] as number[]) : [],
);
const barrelCount = computed(() => Math.floor(offsets.value.length / 2));
const projectileSpecId = computed({
  get: () => str(localWeapon.value.projectileSpecId),
  set: (v) => (localWeapon.value.projectileSpecId = v),
});
const projectileOptions = computed(() => Object.keys(props.projectiles).map((value) => ({ label: value, value })));
const fringeColor = computed({
  get: () => arr(localWeapon.value.fringeColor, [255, 255, 255, 255]),
  set: (v) => (localWeapon.value.fringeColor = v),
});
const coreColor = computed({
  get: () => arr(localWeapon.value.coreColor, [255, 255, 255, 255]),
  set: (v) => (localWeapon.value.coreColor = v),
});
const glowColor = computed({
  get: () => arr(localWeapon.value.glowColor, [255, 255, 255, 255]),
  set: (v) => (localWeapon.value.glowColor = v),
});
const muzzleFlashSpec = bindObjectField('muzzleFlashSpec');
const smokeSpec = bindObjectField('smokeSpec');

function pushUndo() {
  history.push(localWeapon.value);
}
function doUndo() {
  const previous = history.undo(localWeapon.value);
  if (!previous) return;
  localWeapon.value = normalizeWeaponSpec(previous);
  selected.value = -1;
  draw();
}
function doRedo() {
  const next = history.redo(localWeapon.value);
  if (!next) return;
  localWeapon.value = normalizeWeaponSpec(next);
  selected.value = -1;
  draw();
}
useEditorShortcuts({ redo: doRedo, undo: doUndo });
function setView(v: 'turret' | 'hardpoint') {
  viewMode.value = v;
  selected.value = -1;
  loadSprite();
}
function center() {
  return viewport.center();
}
function toCanvas(x: number, y: number) {
  return viewport.toCanvas('weapon', x, y);
}
function toWeapon(px: number, py: number) {
  const point = viewport.fromCanvas('weapon', px, py);
  return { x: snapToStep(point.x), y: snapToStep(point.y) };
}
function resizeCanvas() {
  const rect = stageRef.value?.getBoundingClientRect();
  if (viewport.resize(rect?.width, rect?.height)) draw();
}
function currentSpriteField() {
  return viewMode.value === 'turret' ? 'turretSprite' : 'hardpointSprite';
}
function loadSprite() {
  img.src = props.spriteData || '';
  if (str(localWeapon.value[currentSpriteField()]) && !props.spriteData) img.src = '';
  draw();
}
function draw() {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  const cc = center();
  drawing.clear(ctx, c.width, c.height);
  drawing.drawGrid(ctx, { center: cc, height: c.height, scale: scale.value, width: c.width });
  if (img.width) {
    ctx.globalAlpha = 0.72;
    drawing.drawPixelImage(
      ctx,
      img,
      cc.x - (img.width * scale.value) / 2,
      cc.y - (img.height * scale.value) / 2,
      img.width * scale.value,
      img.height * scale.value,
    );
    ctx.globalAlpha = 1;
  }
  drawing.drawCrosshair(ctx, cc);
  for (let i = 0; i < barrelCount.value; i++) {
    const p = toCanvas(offsets.value[i * 2] || 0, offsets.value[i * 2 + 1] || 0);
    const angle = ((angles.value[i] || 0) * Math.PI) / 180;
    ctx.strokeStyle = selected.value === i ? '#fbbf24' : '#ef4444';
    ctx.lineWidth = selected.value === i ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.sin(-angle) * 32, p.y - Math.cos(angle) * 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, selected.value === i ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = selected.value === i ? '#fbbf24' : '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i), p.x, p.y);
  }
}
function hit(mx: number, my: number) {
  for (let i = barrelCount.value - 1; i >= 0; i--) {
    const p = toCanvas(offsets.value[i * 2] || 0, offsets.value[i * 2 + 1] || 0);
    if (Math.hypot(mx - p.x, my - p.y) < 14) return i;
  }
  return -1;
}
function onDown(e: MouseEvent) {
  last = { x: e.offsetX, y: e.offsetY };
  if (e.button === 2) {
    panning.value = true;
    return;
  }
  const i = hit(last.x, last.y);
  if (i >= 0) {
    pushUndo();
    selected.value = i;
    dragging.value = true;
  } else selected.value = -1;
  draw();
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
  if (!dragging.value || selected.value < 0) return;
  const coord = toWeapon(mx, my);
  offsets.value[selected.value * 2] = coord.x;
  offsets.value[selected.value * 2 + 1] = coord.y;
  draw();
}
function onUp() {
  dragging.value = false;
  panning.value = false;
}
function onWheel(e: WheelEvent) {
  viewport.zoom(e.deltaY);
  draw();
}
function setOffset(axis: 0 | 1, value: number | null) {
  if (selected.value < 0) return;
  offsets.value[selected.value * 2 + axis] = value || 0;
  draw();
}
function setAngle(value: number | null) {
  if (selected.value < 0) return;
  angles.value[selected.value] = value || 0;
  draw();
}
function addBarrel() {
  pushUndo();
  offsets.value.push(0, 0);
  angles.value.push(0);
  selected.value = barrelCount.value - 1;
  draw();
}
function deleteBarrel() {
  if (selected.value < 0) return;
  pushUndo();
  offsets.value.splice(selected.value * 2, 2);
  angles.value.splice(selected.value, 1);
  selected.value = -1;
  draw();
}
async function uploadCurrentSprite(event: Event) {
  try {
    await uploadSpriteFile(event, {
      dialog,
      modRoot: props.modRoot,
      subfolder: 'weapons',
      onUploaded: (result, dataUrl) => {
        localWeapon.value[currentSpriteField()] = result.path;
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
    await saveWeaponSpec(props.modRoot, props.weaponId, localWeapon.value);
    emit('saved', props.weaponId, localWeapon.value);
  } catch (error) {
    message.error(formatError(error));
  }
}
watch(localWeapon, draw, { deep: true });
onMounted(() => {
  window.addEventListener('resize', resizeCanvas);
  if (props.spriteData) {
    img.src = props.spriteData;
    img.onload = () => {
      draw();
    };
  }
  nextTick(resizeCanvas);
});
onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
});
</script>
