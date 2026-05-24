<template>
  <div class="modal-backdrop">
    <div ref="editorWindowRef" class="editor-window" tabindex="-1">
      <EditorHeader title="武器编辑器" :subtitle="weaponId">
        <div class="ship-mode-controls">
          <div class="segmented ship-mode-tabs">
            <button :class="{ active: viewMode === 'turret' }" @click="setView('turret')">
              炮塔视图 <span class="ship-mode-shortcut">U</span>
            </button>
            <button :class="{ active: viewMode === 'hardpoint' }" @click="setView('hardpoint')">
              固定视图 <span class="ship-mode-shortcut">H</span>
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
        <EditorInspector title="武器检查器">
          <n-collapse
            v-model:expanded-names="expandedSections"
            :theme-overrides="editorCollapseTheme"
            @update:expanded-names="onExpandedSectionsUpdate"
          >
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
            <n-collapse-item title="炮塔贴图" name="turretSprites">
              <div class="form-grid">
                <template v-for="field in turretSpriteFields" :key="field">
                  <label>{{ field }}</label>
                  <div class="sprite-field-row">
                    <n-input v-model:value="localWeapon[field]" @change="loadSpriteField(field)" />
                    <input
                      :ref="(el) => setSpriteInputRef(field, el)"
                      class="editor-file-input"
                      type="file"
                      accept="image/png"
                      @change="uploadSpriteField(field, $event)"
                    />
                    <n-button
                      class="sprite-icon-button"
                      tertiary
                      title="选择贴图文件"
                      aria-label="选择贴图文件"
                      @click="openSpriteInput(field)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 19V5h6l2 2h8v12H4z" />
                        <path d="M8 14h8M12 10v8" />
                      </svg>
                    </n-button>
                  </div>
                </template>
              </div>
            </n-collapse-item>
            <n-collapse-item title="固定贴图" name="hardpointSprites">
              <div class="form-grid">
                <template v-for="field in hardpointSpriteFields" :key="field">
                  <label>{{ field }}</label>
                  <div class="sprite-field-row">
                    <n-input v-model:value="localWeapon[field]" @change="loadSpriteField(field)" />
                    <input
                      :ref="(el) => setSpriteInputRef(field, el)"
                      class="editor-file-input"
                      type="file"
                      accept="image/png"
                      @change="uploadSpriteField(field, $event)"
                    />
                    <n-button
                      class="sprite-icon-button"
                      tertiary
                      title="选择贴图文件"
                      aria-label="选择贴图文件"
                      @click="openSpriteInput(field)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 19V5h6l2 2h8v12H4z" />
                        <path d="M8 14h8M12 10v8" />
                      </svg>
                    </n-button>
                  </div>
                </template>
              </div>
            </n-collapse-item>
            <n-collapse-item title="炮塔发射点" name="turretBarrels">
              <div class="item-list">
                <button
                  v-for="(_, i) in barrelCountFor('turret')"
                  :key="i"
                  :data-inspector-target="`turret-barrel-${i}`"
                  :class="{ selected: viewMode === 'turret' && selected === i }"
                  @click="selectBarrel('turret', i)"
                >
                  发射点 {{ i }}
                  <span>[{{ offsetsFor('turret')[i * 2] }}, {{ offsetsFor('turret')[i * 2 + 1] }}] {{ anglesFor('turret')[i] || 0 }}°</span>
                </button>
              </div>
              <div v-if="viewMode === 'turret' && selected >= 0" class="form-grid">
                <label>X</label><n-input-number :value="offsets[selected * 2]" @update:value="setOffset(0, $event)" /> <label>Y</label
                ><n-input-number :value="offsets[selected * 2 + 1]" @update:value="setOffset(1, $event)" /> <label>角度偏移</label
                ><n-input-number :value="angles[selected] || 0" @update:value="setAngle($event)" />
              </div>
              <div class="action-row button-row">
                <n-button @click="addBarrelFor('turret')">添加</n-button
                ><n-button type="error" ghost @click="deleteBarrelFor('turret')">删除</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item title="固定发射点" name="hardpointBarrels">
              <div class="item-list">
                <button
                  v-for="(_, i) in barrelCountFor('hardpoint')"
                  :key="i"
                  :data-inspector-target="`hardpoint-barrel-${i}`"
                  :class="{ selected: viewMode === 'hardpoint' && selected === i }"
                  @click="selectBarrel('hardpoint', i)"
                >
                  发射点 {{ i }}
                  <span
                    >[{{ offsetsFor('hardpoint')[i * 2] }}, {{ offsetsFor('hardpoint')[i * 2 + 1] }}]
                    {{ anglesFor('hardpoint')[i] || 0 }}°</span
                  >
                </button>
              </div>
              <div v-if="viewMode === 'hardpoint' && selected >= 0" class="form-grid">
                <label>X</label><n-input-number :value="offsets[selected * 2]" @update:value="setOffset(0, $event)" /> <label>Y</label
                ><n-input-number :value="offsets[selected * 2 + 1]" @update:value="setOffset(1, $event)" /> <label>角度偏移</label
                ><n-input-number :value="angles[selected] || 0" @update:value="setAngle($event)" />
              </div>
              <div class="action-row button-row">
                <n-button @click="addBarrelFor('hardpoint')">添加</n-button
                ><n-button type="error" ghost @click="deleteBarrelFor('hardpoint')">删除</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item title="发射模式" name="barrelMode">
              <div class="form-grid">
                <label>barrelMode</label><n-select v-model:value="localWeapon.barrelMode" :options="opts(['ALTERNATING', 'LINKED'])" />
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
              <div class="action-row button-row">
                <n-button @click="$emit('editProjectile', projectileSpecId)">编辑弹体</n-button>
                <n-button tertiary @click="$emit('preview', weaponId)">发射预览</n-button>
              </div>
            </n-collapse-item>
            <n-collapse-item v-if="localWeapon.specClass === 'beam'" title="光束" name="beam">
              <ColorPicker label="fringeColor" v-model="fringeColor" />
              <ColorPicker label="coreColor" v-model="coreColor" />
              <ColorPicker label="glowColor" v-model="glowColor" />
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
import ColorPicker from '@/shared/ui/ColorPicker.vue';
import EditorFooter from '@/app/components/editors/common/EditorFooter.vue';
import EditorHeader from '@/app/components/editors/common/EditorHeader.vue';
import EditorInspector from '@/app/components/editors/common/EditorInspector.vue';
import ObjectEditor from '@/app/components/editors/common/ObjectEditor.vue';
import type { FileChangeRecord } from '@/shared/api/write-api';
import type { RowData } from '@/shared/types';
import { arr, str } from '@/shared/lib/starsector';
import { normalizeWeaponSpec } from '@/domain/editors/lib/normalize';
import { useCanvasDrawing } from '@/app/composables/use-canvas-drawing';
import { useCanvasViewport } from '@/app/composables/use-canvas-viewport';
import { useHistory } from '@/app/composables/use-history';
import { useEditorShortcuts } from '@/app/composables/use-editor-shortcuts';
import { useObjectField } from '@/app/composables/use-object-field';
import { useSpriteUpload } from '@/app/composables/use-sprite-upload';
import { editorCollapseTheme, snapToStep, toOptions as opts } from '@/domain/editors/lib/editor-constants';
import { drawBarrelVisual, drawCrossMarker } from '@/domain/editors/lib/canvas-visuals';

type WeaponViewMode = 'turret' | 'hardpoint';
type SpriteField =
  | 'turretSprite'
  | 'turretGunSprite'
  | 'turretGlowSprite'
  | 'turretUnderSprite'
  | 'hardpointSprite'
  | 'hardpointGunSprite'
  | 'hardpointGlowSprite'
  | 'hardpointUnderSprite';
type InspectorSection =
  | 'basic'
  | 'turretSprites'
  | 'hardpointSprites'
  | 'turretBarrels'
  | 'hardpointBarrels'
  | 'barrelMode'
  | 'anim'
  | 'proj'
  | 'beam'
  | 'sound';
type BarrelPreview = { kind: 'add'; coord: { x: number; y: number } } | { kind: 'angle'; angle: number } | null;

const props = defineProps<{
  modRoot: string;
  weaponId: string;
  weapon: RowData;
  spriteData?: Record<string, string>;
  projectiles: Record<string, RowData>;
  projectileOptions: { label: string; value: string }[];
  saveSpec: (weapon: RowData) => Promise<FileChangeRecord[]>;
}>();
const emit = defineEmits<{
  close: [];
  saved: [id: string, weapon: RowData, changes: FileChangeRecord[]];
  editProjectile: [id: string];
  preview: [id: string];
}>();
const feedback = useAppFeedback();
const editorWindowRef = ref<HTMLElement>();
const stageRef = ref<HTMLElement>();
const canvasRef = ref<HTMLCanvasElement>();
const localWeapon = ref<RowData>(normalizeWeaponSpec(props.weapon));
const viewMode = ref<WeaponViewMode>('turret');
const selected = ref(-1);
const expandedSections = ref<InspectorSection[]>(['basic']);
const viewport = useCanvasViewport(canvasRef, 2, 20);
const { scale } = viewport;
const dragging = ref(false);
const angleDragging = ref(false);
const hovered = ref(-1);
const activeBarrel = ref(-1);
const inspectorLock = ref(-1);
const inspectorRevealInProgress = ref(false);
const hoverPreview = ref<BarrelPreview>(null);
const panning = ref(false);
const pointerInside = ref(false);
const localSpriteData = ref<Record<string, string>>({ ...(props.spriteData || {}) });
const spriteImages = new Map<string, InstanceType<typeof Image>>();
const spriteInputRefs = new Map<SpriteField, HTMLInputElement>();
let last = { x: 0, y: 0 };
const history = useHistory(() => localWeapon.value);
const drawing = useCanvasDrawing();
const { bindObjectField } = useObjectField(localWeapon);
const { uploadSpriteFile } = useSpriteUpload();
const turretSpriteFields: SpriteField[] = ['turretSprite', 'turretGunSprite', 'turretGlowSprite', 'turretUnderSprite'];
const hardpointSpriteFields: SpriteField[] = ['hardpointSprite', 'hardpointGunSprite', 'hardpointGlowSprite', 'hardpointUnderSprite'];
const spriteDrawOrder: Record<WeaponViewMode, SpriteField[]> = {
  turret: ['turretUnderSprite', 'turretSprite', 'turretGunSprite', 'turretGlowSprite'],
  hardpoint: ['hardpointUnderSprite', 'hardpointSprite', 'hardpointGunSprite', 'hardpointGlowSprite'],
};
const spriteOriginRatio: Record<WeaponViewMode, { x: number; y: number }> = {
  turret: { x: 0.5, y: 0.5 },
  hardpoint: { x: 0.5, y: 0.75 },
};
const modeFooterNotes: Record<WeaponViewMode, string> = {
  turret: '左键 拖动发射点 | Shift+左键 添加发射点 | Ctrl+左键 设置角度 | 退格 删除发射点 | T 打开炮塔发射点',
  hardpoint: '左键 拖动发射点 | Shift+左键 添加发射点 | Ctrl+左键 设置角度 | 退格 删除发射点 | T 打开固定发射点',
};
const footerNote = computed(() => `右键 拖动画布 | 滚轮缩放 | Ctrl+Z 撤销 | Ctrl+Shift+Z 重做\n${modeFooterNotes[viewMode.value]}`);

const offsets = computed<number[]>(() => offsetsFor(viewMode.value));
const angles = computed<number[]>(() => anglesFor(viewMode.value));
const barrelCount = computed(() => barrelCountFor(viewMode.value));
const projectileSpecId = computed({
  get: () => str(localWeapon.value.projectileSpecId),
  set: (v) => (localWeapon.value.projectileSpecId = v),
});
const projectileOptions = computed(() => props.projectileOptions);
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
  hovered.value = -1;
  activeBarrel.value = -1;
  inspectorLock.value = -1;
  draw();
}
function doRedo() {
  const next = history.redo(localWeapon.value);
  if (!next) return;
  localWeapon.value = normalizeWeaponSpec(next);
  selected.value = -1;
  hovered.value = -1;
  activeBarrel.value = -1;
  inspectorLock.value = -1;
  draw();
}
useEditorShortcuts({ onKeyDown: handleEditorShortcut, redo: doRedo, scope: editorWindowRef, undo: doUndo });
function handleEditorShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (key === 'u') {
    event.preventDefault();
    setView('turret');
    return;
  }
  if (key === 'h') {
    event.preventDefault();
    setView('hardpoint');
    return;
  }
  if (key === 't') {
    event.preventDefault();
    void revealCurrentBarrelSection();
    return;
  }
  if (key === 'backspace') {
    event.preventDefault();
    deleteSelectedBarrel();
  }
}
function setView(v: WeaponViewMode) {
  viewMode.value = v;
  selected.value = -1;
  hovered.value = -1;
  activeBarrel.value = -1;
  inspectorLock.value = -1;
  draw();
}
function selectBarrel(mode: WeaponViewMode, index: number) {
  viewMode.value = mode;
  selected.value = index;
  hovered.value = index;
  activeBarrel.value = index;
  inspectorLock.value = index;
  draw();
}
function center() {
  return viewport.center();
}
function toCanvas(x: number, y: number) {
  return viewport.toCanvas('ship', x, y);
}
function toWeapon(px: number, py: number) {
  const point = viewport.fromCanvas('ship', px, py);
  return { x: snapToStep(point.x), y: snapToStep(point.y) };
}
function rawToWeapon(px: number, py: number) {
  return viewport.fromCanvas('ship', px, py);
}
function resizeCanvas() {
  const rect = stageRef.value?.getBoundingClientRect();
  if (viewport.resize(rect?.width, rect?.height)) draw();
}
function offsetsKeyFor(mode: WeaponViewMode) {
  return mode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
}
function anglesKeyFor(mode: WeaponViewMode) {
  return mode === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets';
}
function offsetsFor(mode: WeaponViewMode) {
  const key = offsetsKeyFor(mode);
  if (!Array.isArray(localWeapon.value[key])) localWeapon.value[key] = [];
  return localWeapon.value[key] as number[];
}
function anglesFor(mode: WeaponViewMode) {
  const key = anglesKeyFor(mode);
  if (!Array.isArray(localWeapon.value[key])) localWeapon.value[key] = [];
  return localWeapon.value[key] as number[];
}
function barrelCountFor(mode: WeaponViewMode) {
  return Math.floor(offsetsFor(mode).length / 2);
}
function currentBarrelSection(): InspectorSection {
  return viewMode.value === 'turret' ? 'turretBarrels' : 'hardpointBarrels';
}
async function revealCurrentBarrelSection() {
  const section = currentBarrelSection();
  if (activeBarrel.value >= 0) inspectorLock.value = activeBarrel.value;
  inspectorRevealInProgress.value = true;
  expandedSections.value = [section];
  await nextTick();
  inspectorRevealInProgress.value = false;
  if (selected.value < 0) return;
  editorWindowRef.value
    ?.querySelector<HTMLElement>(`[data-inspector-target="${viewMode.value}-barrel-${selected.value}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}
function onExpandedSectionsUpdate() {
  if (inspectorRevealInProgress.value) return;
  inspectorLock.value = -1;
}
function spriteDataFor(field: SpriteField) {
  return localSpriteData.value[field] || '';
}
function setSpriteImage(field: SpriteField, dataUrl: string) {
  if (!dataUrl) {
    spriteImages.delete(field);
    draw();
    return;
  }
  const image = new Image();
  image.onload = () => draw();
  image.src = dataUrl;
  spriteImages.set(field, image);
}
function loadAllSpriteImages() {
  for (const field of [...turretSpriteFields, ...hardpointSpriteFields]) setSpriteImage(field, spriteDataFor(field));
}
function loadSpriteField(field: SpriteField) {
  setSpriteImage(field, spriteDataFor(field));
  draw();
}
function setSpriteInputRef(field: SpriteField, element: unknown) {
  const input = element instanceof window.HTMLInputElement ? element : null;
  if (input) {
    spriteInputRefs.set(field, input);
  } else {
    spriteInputRefs.delete(field);
  }
}
function openSpriteInput(field: SpriteField) {
  spriteInputRefs.get(field)?.click();
}
function drawSpriteLayer(ctx: CanvasRenderingContext2D, image: InstanceType<typeof Image>) {
  if (!image.width) return;
  const origin = spriteOriginRatio[viewMode.value];
  const drawWidth = image.width * scale.value;
  const drawHeight = image.height * scale.value;
  ctx.save();
  ctx.translate(center().x, center().y);
  ctx.rotate(Math.PI / 2);
  drawing.drawPixelImage(ctx, image, -drawWidth * origin.x, -drawHeight * origin.y, drawWidth, drawHeight);
  ctx.restore();
}
function drawCursorPosition(ctx: CanvasRenderingContext2D) {
  if (!pointerInside.value) return;
  const coord = toWeapon(last.x, last.y);
  const point = toCanvas(coord.x, coord.y);
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
function cursorLabel(coord: { x: number; y: number }) {
  if (hoverPreview.value?.kind === 'angle') return `${hoverPreview.value.angle}°`;
  return `${coord.x.toFixed(1)}, ${coord.y.toFixed(1)}`;
}
function pointAngle(origin: { x: number; y: number }, point: { x: number; y: number }) {
  const angle = (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;
  const rounded = Math.round(angle) % 360;
  return rounded < 0 ? rounded + 360 : rounded;
}
function previewAngle(mx: number, my: number) {
  if (selected.value < 0) return 0;
  const origin = { x: offsets.value[selected.value * 2] || 0, y: offsets.value[selected.value * 2 + 1] || 0 };
  return pointAngle(origin, rawToWeapon(mx, my));
}
function updateHoverPreview(mx: number, my: number, modifiers: Pick<MouseEvent | KeyboardEvent, 'ctrlKey' | 'shiftKey'>) {
  if (modifiers.shiftKey) {
    hoverPreview.value = { kind: 'add', coord: toWeapon(mx, my) };
    return;
  }
  if (modifiers.ctrlKey && selected.value >= 0) {
    hoverPreview.value = { kind: 'angle', angle: previewAngle(mx, my) };
    return;
  }
  hoverPreview.value = null;
}
function clearHoverPreview() {
  hoverPreview.value = null;
}
function drawHoverPreview(ctx: CanvasRenderingContext2D) {
  const preview = hoverPreview.value;
  if (!preview) return;
  ctx.save();
  ctx.globalAlpha = 0.65;
  if (preview.kind === 'add') {
    drawBarrelVisual(ctx, {
      angle: 0,
      hovered: true,
      index: barrelCount.value,
      point: toCanvas(preview.coord.x, preview.coord.y),
      selected: true,
    });
  }
  if (preview.kind === 'angle' && selected.value >= 0) {
    drawBarrelVisual(ctx, {
      angle: preview.angle,
      hovered: true,
      index: selected.value,
      point: toCanvas(offsets.value[selected.value * 2] || 0, offsets.value[selected.value * 2 + 1] || 0),
      selected: true,
    });
  }
  ctx.restore();
}
function draw() {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  const cc = center();
  drawing.clear(ctx, c.width, c.height);
  drawing.drawGrid(ctx, { center: cc, height: c.height, scale: scale.value, width: c.width });
  ctx.globalAlpha = 0.72;
  for (const field of spriteDrawOrder[viewMode.value]) {
    const image = spriteImages.get(field);
    if (image) drawSpriteLayer(ctx, image);
  }
  ctx.globalAlpha = 1;
  drawCrossMarker(ctx, cc, true);
  for (let i = 0; i < barrelCount.value; i++) {
    drawBarrelVisual(ctx, {
      angle: angles.value[i] || 0,
      hovered: hovered.value === i,
      index: i,
      point: toCanvas(offsets.value[i * 2] || 0, offsets.value[i * 2 + 1] || 0),
      selected: selected.value === i,
    });
  }
  drawHoverPreview(ctx);
  drawCursorPosition(ctx);
}
function barrelHitRadius() {
  return 26;
}
function selectableTargets(mx: number, my: number) {
  const targets: { i: number; distance: number }[] = [];
  for (let i = barrelCount.value - 1; i >= 0; i -= 1) {
    const p = toCanvas(offsets.value[i * 2] || 0, offsets.value[i * 2 + 1] || 0);
    targets.push({ i, distance: Math.hypot(mx - p.x, my - p.y) });
  }
  return targets;
}
function nearestTarget(mx: number, my: number) {
  const targets = selectableTargets(mx, my);
  const locked = targets.find((target) => target.i === inspectorLock.value) ?? null;
  const nearby = targets
    .filter((target) => target.i !== inspectorLock.value && target.distance <= barrelHitRadius())
    .sort((a, b) => a.distance - b.distance)[0];
  if (nearby) return nearby;
  if (locked) return locked;
  if (inspectorLock.value < 0) return targets.sort((a, b) => a.distance - b.distance)[0] ?? null;
  return null;
}
function hitTarget(mx: number, my: number) {
  const target = nearestTarget(mx, my);
  if (!target) return null;
  if (target.i === inspectorLock.value) return target;
  return target.distance <= barrelHitRadius() ? target : null;
}
function syncSelection(target: { i: number; distance: number } | null) {
  if (!target) return false;
  const changed = hovered.value !== target.i || selected.value !== target.i || activeBarrel.value !== target.i;
  hovered.value = target.i;
  selected.value = target.i;
  activeBarrel.value = target.i;
  return changed;
}
function clearCanvasSelection() {
  const changed = hovered.value !== -1 || selected.value !== -1 || activeBarrel.value !== -1;
  hovered.value = -1;
  selected.value = -1;
  activeBarrel.value = -1;
  return changed;
}
function selectIdentityTarget(index: number) {
  if (index < 0 || index >= barrelCount.value) return null;
  const point = toCanvas(offsets.value[index * 2] || 0, offsets.value[index * 2 + 1] || 0);
  const target = { i: index, distance: Math.hypot(last.x - point.x, last.y - point.y) };
  syncSelection(target);
  return target;
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
function onDown(e: MouseEvent) {
  last = { x: e.offsetX, y: e.offsetY };
  if (e.button === 2) {
    panning.value = true;
    return;
  }
  if (e.button !== 0) return;
  if (e.shiftKey) {
    pushUndo();
    addBarrelAt(viewMode.value, toWeapon(last.x, last.y));
    dragging.value = true;
    clearHoverPreview();
    draw();
    return;
  }
  if (e.ctrlKey && selected.value >= 0) {
    selectIdentityTarget(inspectorLock.value) ?? selectIdentityTarget(activeBarrel.value) ?? selectForPointer(last.x, last.y);
    if (selected.value < 0) return;
    pushUndo();
    angleDragging.value = true;
    angles.value[selected.value] = previewAngle(last.x, last.y);
    updateHoverPreview(last.x, last.y, e);
    draw();
    return;
  }
  const target = selectIdentityTarget(activeBarrel.value) ?? selectForPointer(last.x, last.y);
  if (target) {
    pushUndo();
    dragging.value = true;
  }
  draw();
}
function onMove(e: MouseEvent) {
  const mx = e.offsetX;
  const my = e.offsetY;
  pointerInside.value = true;
  const dx = mx - last.x;
  const dy = my - last.y;
  last = { x: mx, y: my };
  if (panning.value) {
    viewport.panBy(dx, dy);
    draw();
    return;
  }
  if (angleDragging.value && selected.value >= 0) {
    angles.value[selected.value] = previewAngle(mx, my);
    updateHoverPreview(mx, my, e);
    draw();
    return;
  }
  if (!dragging.value || selected.value < 0) {
    if (e.shiftKey || e.ctrlKey) {
      updateHoverPreview(mx, my, e);
      draw();
      return;
    }
    if (hoverPreview.value) clearHoverPreview();
    const target = nearestTarget(mx, my);
    if (target) syncSelection(target);
    else clearCanvasSelection();
    draw();
    return;
  }
  const coord = toWeapon(mx, my);
  offsets.value[selected.value * 2] = coord.x;
  offsets.value[selected.value * 2 + 1] = coord.y;
  draw();
}
function onUp() {
  dragging.value = false;
  angleDragging.value = false;
  panning.value = false;
  clearHoverPreview();
  draw();
}
function onKeyUp(event: KeyboardEvent) {
  if (event.key !== 'Shift' && event.key !== 'Control') return;
  if (!hoverPreview.value) return;
  updateHoverPreview(last.x, last.y, event);
  if (!hoverPreview.value) draw();
}
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Shift' && event.key !== 'Control') return;
  if (!pointerInside.value || dragging.value || angleDragging.value || panning.value) return;
  updateHoverPreview(last.x, last.y, event);
  if (hoverPreview.value) draw();
}
function onLeave() {
  dragging.value = false;
  angleDragging.value = false;
  panning.value = false;
  pointerInside.value = false;
  hovered.value = -1;
  activeBarrel.value = -1;
  clearHoverPreview();
  draw();
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
function addBarrelFor(mode: WeaponViewMode) {
  pushUndo();
  addBarrelAt(mode, { x: 0, y: 0 });
  draw();
}
function addBarrelAt(mode: WeaponViewMode, coord: { x: number; y: number }) {
  const nextOffsets = offsetsFor(mode);
  const nextAngles = anglesFor(mode);
  nextOffsets.push(coord.x, coord.y);
  nextAngles.push(0);
  viewMode.value = mode;
  selected.value = barrelCountFor(mode) - 1;
  hovered.value = selected.value;
  activeBarrel.value = selected.value;
  inspectorLock.value = -1;
}
function deleteBarrelFor(mode: WeaponViewMode) {
  if (viewMode.value !== mode || selected.value < 0) return;
  pushUndo();
  deleteSelectedBarrelData(mode);
  draw();
}
function deleteSelectedBarrel() {
  if (selected.value < 0) return;
  pushUndo();
  deleteSelectedBarrelData(viewMode.value);
  draw();
}
function deleteSelectedBarrelData(mode: WeaponViewMode) {
  offsetsFor(mode).splice(selected.value * 2, 2);
  anglesFor(mode).splice(selected.value, 1);
  selected.value = -1;
  hovered.value = -1;
  activeBarrel.value = -1;
  inspectorLock.value = -1;
}
async function uploadSpriteField(field: SpriteField, event: Event) {
  try {
    await uploadSpriteFile(event, {
      feedback,
      modRoot: props.modRoot,
      subfolder: 'weapons',
      onUploaded: (result, dataUrl) => {
        localWeapon.value[field] = result.path;
        localSpriteData.value[field] = dataUrl;
        setSpriteImage(field, dataUrl);
        feedback.success('贴图已上传');
      },
    });
  } catch (error) {
    feedback.error(error, '上传贴图失败');
  }
}
async function save() {
  try {
    const changes = await props.saveSpec(localWeapon.value);
    emit('saved', props.weaponId, localWeapon.value, changes);
  } catch (error) {
    feedback.error(error, '保存武器失败');
  }
}
watch(
  () => props.weapon,
  (weapon) => {
    localWeapon.value = normalizeWeaponSpec(weapon);
    selected.value = -1;
    hovered.value = -1;
    activeBarrel.value = -1;
    inspectorLock.value = -1;
    hoverPreview.value = null;
  },
  { deep: true },
);
watch(localWeapon, draw, { deep: true });
onMounted(() => {
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  nextTick(() => {
    editorWindowRef.value?.focus({ preventScroll: true });
    resizeCanvas();
    loadAllSpriteImages();
  });
});
onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>
