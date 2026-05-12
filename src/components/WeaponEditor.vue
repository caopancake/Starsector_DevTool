<template>
  <div class="modal-backdrop">
    <div class="editor-window">
      <header class="editor-header">
        <strong>武器编辑器: {{ weaponId }}</strong>
        <div class="segmented">
          <button :class="{ active: viewMode === 'turret' }" @click="setView('turret')">炮塔视图</button>
          <button :class="{ active: viewMode === 'hardpoint' }" @click="setView('hardpoint')">固定视图</button>
        </div>
      </header>
      <div class="editor-body">
        <div class="canvas-stage">
          <canvas ref="canvasRef" class="editor-canvas" @mousedown="onDown" @mousemove="onMove" @mouseup="onUp" @mouseleave="onUp" @wheel.prevent="onWheel" @contextmenu.prevent />
        </div>
        <aside class="editor-side">
          <div class="editor-scroll">
            <n-collapse default-expanded-names="basic">
              <n-collapse-item title="基础属性" name="basic">
                <div class="form-grid">
                  <label>id</label><n-input :value="weaponId" disabled />
                  <label>specClass</label><n-select v-model:value="localWeapon.specClass" :options="opts(['projectile','beam'])" />
                  <label>type</label><n-select v-model:value="localWeapon.type" :options="opts(['BALLISTIC','ENERGY','MISSILE','HYBRID','UNIVERSAL','SYNERGY','COMPOSITE','DECORATIVE','SYSTEM','BUILT_IN'])" />
                  <label>size</label><n-select v-model:value="localWeapon.size" :options="opts(['SMALL','MEDIUM','LARGE'])" />
                </div>
              </n-collapse-item>
              <n-collapse-item title="贴图" name="sprites">
                <div class="form-grid">
                  <template v-for="field in spriteFields" :key="field">
                    <label>{{ field }}</label><n-input v-model:value="localWeapon[field]" @change="loadSprite" />
                  </template>
                </div>
                <input type="file" accept="image/png" @change="uploadCurrentSprite" />
              </n-collapse-item>
              <n-collapse-item title="发射点" name="barrels">
                <div class="item-list">
                  <button v-for="(_, i) in barrelCount" :key="i" :class="{ selected: selected === i }" @click="selected=i;draw()">炮管 {{ i }} <span>[{{ offsets[i*2] }}, {{ offsets[i*2+1] }}] {{ angles[i] || 0 }}°</span></button>
                </div>
                <div v-if="selected >= 0" class="form-grid">
                  <label>X 前进</label><n-input-number :value="offsets[selected*2]" @update:value="setOffset(0,$event)" />
                  <label>Y 右侧</label><n-input-number :value="offsets[selected*2+1]" @update:value="setOffset(1,$event)" />
                  <label>角度偏移</label><n-input-number :value="angles[selected] || 0" @update:value="setAngle($event)" />
                </div>
                <div class="form-grid">
                  <label>barrelMode</label><n-select v-model:value="localWeapon.barrelMode" :options="opts(['ALTERNATING','LINKED'])" />
                </div>
                <div class="button-row"><n-button @click="addBarrel">添加炮管</n-button><n-button type="error" ghost @click="deleteBarrel">删除炮管</n-button></div>
              </n-collapse-item>
              <n-collapse-item v-if="localWeapon.specClass === 'projectile'" title="动画" name="anim">
                <div class="form-grid">
                  <label>animationType</label><n-select v-model:value="localWeapon.animationType" :options="opts(['NONE','MUZZLE_FLASH','SMOKE','GLOW_AND_FLASH','GLOW'])" />
                  <label>visualRecoil</label><n-input-number v-model:value="localWeapon.visualRecoil" />
                </div>
                <ObjectEditor v-model="muzzleFlashSpec" title="muzzleFlashSpec" />
                <ObjectEditor v-model="smokeSpec" title="smokeSpec" />
              </n-collapse-item>
              <n-collapse-item v-if="localWeapon.specClass === 'projectile'" title="弹丸" name="proj">
                <div class="form-grid">
                  <label>projectileSpecId</label>
                  <n-auto-complete v-model:value="projectileSpecId" :options="projectileOptions" />
                </div>
                <div class="button-row">
                  <n-button @click="$emit('editProjectile', projectileSpecId)">编辑弹丸</n-button>
                  <n-button tertiary @click="$emit('preview', weaponId)">预览弹道</n-button>
                </div>
              </n-collapse-item>
              <n-collapse-item v-if="localWeapon.specClass === 'beam'" title="光束" name="beam">
                <ColorArray label="fringeColor" v-model="fringeColor" />
                <ColorArray label="coreColor" v-model="coreColor" />
                <ColorArray label="glowColor" v-model="glowColor" />
                <div class="form-grid">
                  <label>width</label><n-input-number v-model:value="localWeapon.width" />
                  <label>textureType</label><n-select v-model:value="localWeapon.textureType" :options="opts(['ROUGH','SMOOTH','NONE'])" />
                  <label>textureScrollSpeed</label><n-input-number v-model:value="localWeapon.textureScrollSpeed" />
                  <label>pixelsPerTexel</label><n-input-number v-model:value="localWeapon.pixelsPerTexel" />
                  <label>convergeOnPoint</label><n-checkbox v-model:checked="localWeapon.convergeOnPoint" />
                  <label>darkCore</label><n-checkbox v-model:checked="localWeapon.darkCore" />
                </div>
                <n-button tertiary @click="$emit('preview', weaponId)">预览光束</n-button>
              </n-collapse-item>
              <n-collapse-item title="音效" name="sound">
                <div class="form-grid">
                  <label>fireSoundOne</label><n-input v-model:value="localWeapon.fireSoundOne" />
                  <label>fireSoundTwo</label><n-input v-model:value="localWeapon.fireSoundTwo" />
                </div>
              </n-collapse-item>
            </n-collapse>
          </div>
        </aside>
      </div>
      <footer class="editor-footer">
        <span>Ctrl+Z 撤销 | Ctrl+Y 重做 | 右键拖动画布</span>
        <n-button @click="$emit('close')">关闭</n-button>
        <n-button type="primary" @click="save">保存</n-button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { saveWeapon, uploadSprite } from '../api';
import type { RowData } from '../types';
import { arr, deepClone, fileToBase64, num, str } from '../utils';

const props = defineProps<{ modRoot: string; weaponId: string; weapon: RowData; csvRow?: RowData; projectiles: Record<string, RowData> }>();
const emit = defineEmits<{ close: []; saved: [id: string, weapon: RowData]; editProjectile: [id: string]; preview: [id: string] }>();
const message = useMessage();
const dialog = useDialog();
const localWeapon = ref<RowData>(deepClone(props.weapon));
const canvasRef = ref<HTMLCanvasElement>();
const viewMode = ref<'turret' | 'hardpoint'>('turret');
const selected = ref(-1);
const scale = ref(2);
const pan = ref({ x: 0, y: 0 });
const img = new Image();
const dragging = ref(false);
const panning = ref(false);
let last = { x: 0, y: 0 };
const undo: string[] = [];
const redo: string[] = [];
const spriteFields = ['turretSprite','hardpointSprite','turretGunSprite','hardpointGunSprite','turretGlowSprite','hardpointGlowSprite','turretUnderSprite','hardpointUnderSprite'];

const offsetsKey = computed(() => viewMode.value === 'turret' ? 'turretOffsets' : 'hardpointOffsets');
const anglesKey = computed(() => viewMode.value === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets');
const offsets = computed<number[]>(() => Array.isArray(localWeapon.value[offsetsKey.value]) ? localWeapon.value[offsetsKey.value] as number[] : (localWeapon.value[offsetsKey.value] = []) as number[]);
const angles = computed<number[]>(() => Array.isArray(localWeapon.value[anglesKey.value]) ? localWeapon.value[anglesKey.value] as number[] : (localWeapon.value[anglesKey.value] = []) as number[]);
const barrelCount = computed(() => Math.floor(offsets.value.length / 2));
const projectileSpecId = computed({ get: () => str(localWeapon.value.projectileSpecId), set: (v) => localWeapon.value.projectileSpecId = v });
const projectileOptions = computed(() => Object.keys(props.projectiles).map((value) => ({ label: value, value })));
const fringeColor = computed({ get: () => arr(localWeapon.value.fringeColor, [255, 255, 255, 255]), set: (v) => localWeapon.value.fringeColor = v });
const coreColor = computed({ get: () => arr(localWeapon.value.coreColor, [255, 255, 255, 255]), set: (v) => localWeapon.value.coreColor = v });
const glowColor = computed({ get: () => arr(localWeapon.value.glowColor, [255, 255, 255, 255]), set: (v) => localWeapon.value.glowColor = v });
const muzzleFlashSpec = computed({ get: () => objectField('muzzleFlashSpec'), set: (v) => localWeapon.value.muzzleFlashSpec = v });
const smokeSpec = computed({ get: () => objectField('smokeSpec'), set: (v) => localWeapon.value.smokeSpec = v });

function opts(values: string[]) { return values.map((value) => ({ label: value, value })); }
function objectField(key: string): RowData { return localWeapon.value[key] && typeof localWeapon.value[key] === 'object' && !Array.isArray(localWeapon.value[key]) ? localWeapon.value[key] as RowData : {}; }
function pushUndo() { undo.push(JSON.stringify(localWeapon.value)); if (undo.length > 250) undo.shift(); redo.length = 0; }
function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(localWeapon.value)); localWeapon.value = JSON.parse(undo.pop()!); selected.value = -1; draw(); }
function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(localWeapon.value)); localWeapon.value = JSON.parse(redo.pop()!); selected.value = -1; draw(); }
function setView(v: 'turret' | 'hardpoint') { viewMode.value = v; selected.value = -1; loadSprite(); }
function center() { const c = canvasRef.value!; return { x: c.width / 2 + pan.value.x, y: c.height / 2 + pan.value.y }; }
function toCanvas(x: number, y: number) { const cc = center(); return { x: cc.x + y * scale.value, y: cc.y - x * scale.value }; }
function toWeapon(px: number, py: number) { const cc = center(); return { x: -(py - cc.y) / scale.value, y: (px - cc.x) / scale.value }; }
function resizeCanvas() { const c = canvasRef.value; if (!c) return; c.width = 1600; c.height = 1100; draw(); }
function currentSpriteField() { return viewMode.value === 'turret' ? 'turretSprite' : 'hardpointSprite'; }
function loadSprite() { img.src = ''; draw(); }
function draw() {
  const c = canvasRef.value; if (!c) return; const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = '#08111f'; ctx.fillRect(0, 0, c.width, c.height); drawGrid(ctx);
  const cc = center();
  if (img.width) { ctx.globalAlpha = 0.72; ctx.drawImage(img, cc.x - img.width * scale.value / 2, cc.y - img.height * scale.value / 2, img.width * scale.value, img.height * scale.value); ctx.globalAlpha = 1; }
  ctx.strokeStyle = '#ffffff55'; ctx.beginPath(); ctx.moveTo(cc.x - 12, cc.y); ctx.lineTo(cc.x + 12, cc.y); ctx.moveTo(cc.x, cc.y - 12); ctx.lineTo(cc.x, cc.y + 12); ctx.stroke();
  for (let i = 0; i < barrelCount.value; i++) {
    const p = toCanvas(offsets.value[i * 2] || 0, offsets.value[i * 2 + 1] || 0);
    const angle = (angles.value[i] || 0) * Math.PI / 180;
    ctx.strokeStyle = selected.value === i ? '#fbbf24' : '#ef4444'; ctx.lineWidth = selected.value === i ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.sin(-angle) * 32, p.y - Math.cos(angle) * 32); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, selected.value === i ? 8 : 5, 0, Math.PI * 2); ctx.fillStyle = selected.value === i ? '#fbbf24' : '#ef4444'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i), p.x, p.y);
  }
}
function drawGrid(ctx: CanvasRenderingContext2D) { const c = canvasRef.value!; const step = 50 * scale.value; if (step < 5) return; const cc = center(); ctx.strokeStyle = '#31415f55'; ctx.lineWidth = 0.5; for (let x = cc.x % step; x < c.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); } for (let y = cc.y % step; y < c.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); } }
function hit(mx: number, my: number) { for (let i = barrelCount.value - 1; i >= 0; i--) { const p = toCanvas(offsets.value[i*2] || 0, offsets.value[i*2+1] || 0); if (Math.hypot(mx - p.x, my - p.y) < 14) return i; } return -1; }
function onDown(e: MouseEvent) { last = { x: e.offsetX, y: e.offsetY }; if (e.button === 2) { panning.value = true; return; } const i = hit(last.x, last.y); if (i >= 0) { pushUndo(); selected.value = i; dragging.value = true; } else selected.value = -1; draw(); }
function onMove(e: MouseEvent) { const mx = e.offsetX; const my = e.offsetY; const dx = mx - last.x; const dy = my - last.y; last = { x: mx, y: my }; if (panning.value) { pan.value.x += dx; pan.value.y += dy; draw(); return; } if (!dragging.value || selected.value < 0) return; const coord = toWeapon(mx, my); offsets.value[selected.value * 2] = +coord.x.toFixed(1); offsets.value[selected.value * 2 + 1] = +coord.y.toFixed(1); draw(); }
function onUp() { dragging.value = false; panning.value = false; }
function onWheel(e: WheelEvent) { scale.value = Math.max(0.1, Math.min(20, scale.value * (e.deltaY < 0 ? 1.1 : 0.9))); draw(); }
function setOffset(axis: 0 | 1, value: number | null) { if (selected.value < 0) return; offsets.value[selected.value * 2 + axis] = value || 0; draw(); }
function setAngle(value: number | null) { if (selected.value < 0) return; angles.value[selected.value] = value || 0; draw(); }
function addBarrel() { pushUndo(); offsets.value.push(0, 0); angles.value.push(0); selected.value = barrelCount.value - 1; draw(); }
function deleteBarrel() { if (selected.value < 0) return; pushUndo(); offsets.value.splice(selected.value * 2, 2); angles.value.splice(selected.value, 1); selected.value = -1; draw(); }
async function uploadCurrentSprite(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; const b64 = await fileToBase64(file); let result = await uploadSprite(props.modRoot, file.name, b64, 'weapons', false); if (result.exists) { dialog.warning({ title: '覆盖贴图？', content: result.message, positiveText: '覆盖', negativeText: '取消', onPositiveClick: async () => { result = await uploadSprite(props.modRoot, file.name, b64, 'weapons', true); localWeapon.value[currentSpriteField()] = result.path; message.success('贴图已上传'); } }); } else { localWeapon.value[currentSpriteField()] = result.path; message.success('贴图已上传'); } }
async function save() { await saveWeapon(props.modRoot, props.weaponId, localWeapon.value); emit('saved', props.weaponId, localWeapon.value); }
function onKey(e: KeyboardEvent) { if ((e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return; if (e.ctrlKey && e.key === 'z') { e.preventDefault(); doUndo(); } if (e.ctrlKey && e.key === 'y') { e.preventDefault(); doRedo(); } }
watch(localWeapon, draw, { deep: true });
onMounted(() => { window.addEventListener('resize', resizeCanvas); window.addEventListener('keydown', onKey); nextTick(resizeCanvas); });
onUnmounted(() => { window.removeEventListener('resize', resizeCanvas); window.removeEventListener('keydown', onKey); });

const ColorArray = defineComponent({
  props: { label: { type: String, required: true }, modelValue: { type: Array, default: () => [255,255,255,255] } },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    const set = (i: number, v: number | null) => { const next = [...(p.modelValue as number[])]; next[i] = v || 0; emit('update:modelValue', next); };
    return () => h('div', { class: 'color-array' }, [
      h('strong', p.label),
      [0,1,2,3].map((i) => h('input', { type: 'number', min: 0, max: 255, value: (p.modelValue as number[])[i] ?? 255, onInput: (e: Event) => set(i, Number((e.target as HTMLInputElement).value)) })),
    ]);
  },
});

const ObjectEditor = defineComponent({
  props: { title: { type: String, required: true }, modelValue: { type: Object, default: () => ({}) } },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    const text = ref(JSON.stringify(p.modelValue || {}, null, 2));
    watch(() => p.modelValue, (v) => text.value = JSON.stringify(v || {}, null, 2));
    const apply = () => { try { emit('update:modelValue', JSON.parse(text.value || '{}')); } catch {} };
    return () => h('div', { class: 'object-editor' }, [h('label', p.title), h('textarea', { value: text.value, onInput: (e: Event) => text.value = (e.target as HTMLTextAreaElement).value, onChange: apply })]);
  },
});
</script>
