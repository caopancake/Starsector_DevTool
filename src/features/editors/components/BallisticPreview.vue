<template>
  <div class="modal-backdrop">
    <div class="preview-window">
      <header class="editor-header">
        <div class="editor-title">
          <strong>弹道预览</strong>
          <span>{{ weaponId }}</span>
        </div>
        <span class="preview-stats">{{ stats }}</span>
      </header>
      <div ref="previewStageRef" class="preview-scroll">
        <canvas ref="canvasRef" class="preview-canvas" />
      </div>
      <footer class="editor-footer">
        <n-button @click="toggle">{{ running ? '暂停' : '播放' }}</n-button>
        <n-button v-for="s in [0.25, 1, 2, 4]" :key="s" :type="speed === s ? 'primary' : 'default'" @click="speed = s">{{ s }}x</n-button>
        <n-button @click="reset">重置</n-button>
        <span class="spacer"></span>
        <n-button @click="$emit('close')">关闭</n-button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { RowData } from '../../../shared/types';
import { num, rgba, str } from '../../../shared/lib/starsector';

const props = defineProps<{
  weaponId: string;
  weapons: RowData[];
  wpnFiles: Record<string, RowData>;
  projFiles: Record<string, RowData>;
}>();
defineEmits<{ close: [] }>();
const canvasRef = ref<HTMLCanvasElement>();
const previewStageRef = ref<HTMLElement>();
const running = ref(true);
const speed = ref(1);
let anim = 0;
let last = 0;
let fireTimer = 0;
let burst = 0;
let barrelIndex = 0;
interface TrailPoint {
  x: number;
  y: number;
}

interface ProjectilePreviewState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  age: number;
  trail: TrailPoint[];
  exploding: boolean;
  explosionAge: number;
  missile: boolean;
}

interface BeamPreviewState {
  phase: 'chargeup';
  timer: number;
  width: number;
  offset: number;
}

let projectiles: ProjectilePreviewState[] = [];
let beams: BeamPreviewState[] = [];
const csv = computed(() => props.weapons.find((w) => str(w.id) === props.weaponId) || {});
const wpn = computed(() => props.wpnFiles[props.weaponId] || {});
const proj = computed(() => props.projFiles[str(wpn.value.projectileSpecId)] || {});
const params = computed(() => ({
  specClass: str(wpn.value.specClass, 'projectile'),
  range: num(csv.value.range, 600),
  projSpeed: num(csv.value['proj speed'], 800),
  damage: num(csv.value['damage/shot'], 100),
  burstSize: Math.max(1, num(csv.value['burst size'], 1)),
  burstDelay: num(csv.value['burst delay'], 0),
  chargeup: num(csv.value.chargeup, 0),
  chargedown: num(csv.value.chargedown, 0.5),
  minSpread: num(csv.value['min spread'], 0),
  maxSpread: num(csv.value['max spread'], 0),
  barrelMode: str(wpn.value.barrelMode, 'ALTERNATING'),
  offsets: Array.isArray(wpn.value.turretOffsets) ? (wpn.value.turretOffsets as number[]) : [10, 0],
  beamWidth: num(wpn.value.width, 10),
  fringeColor: wpn.value.fringeColor || [255, 100, 100, 255],
  coreColor: wpn.value.coreColor || [255, 255, 255, 255],
  textureScrollSpeed: num(wpn.value.textureScrollSpeed, 200),
  projLength: num(proj.value.length, 20),
  projWidth: num(proj.value.width, 4),
  projFringeColor: proj.value.fringeColor || [255, 100, 50, 200],
  projCoreColor: proj.value.coreColor || [255, 255, 200, 255],
  spawnType: str(proj.value.spawnType, 'BALLISTIC'),
  missileType: str(proj.value.specClass) === 'missile' ? str(proj.value.missileType, 'MISSILE') : '',
  missileAcc: num((proj.value.engineSpec as RowData)?.acc, 200),
  missileMaxSpeed: num((proj.value.engineSpec as RowData)?.maxSpeed, num(csv.value['proj speed'], 800)),
  missileSize: Array.isArray(proj.value.size) ? (proj.value.size as number[]) : [10, 10],
  explosionRadius: num(proj.value.explosionRadius, 50),
  explosionColor: proj.value.explosionColor || [255, 200, 50, 255],
}));
const barrelCount = computed(() => Math.max(1, Math.floor(params.value.offsets.length / 2)));
const stats = computed(() => {
  const p = params.value;
  const cycle = p.chargeup + p.chargedown + (p.burstSize - 1) * p.burstDelay;
  const dps = cycle > 0 ? (p.damage * p.burstSize) / cycle : 0;
  return `射程 ${p.range} | 弹速 ${p.projSpeed} | DPS ${dps.toFixed(1)}`;
});
function scalePx() {
  const c = canvasRef.value;
  return c ? (c.width - 140) / Math.max(params.value.range, 100) : 0.5;
}
function rangePx() {
  return params.value.range * scalePx();
}
function reset() {
  projectiles = [];
  beams = [];
  fireTimer = params.value.chargeup;
  burst = 0;
  barrelIndex = 0;
  last = 0;
  running.value = true;
}
function toggle() {
  running.value = !running.value;
  if (running.value) {
    last = 0;
    anim = requestAnimationFrame(frame);
  }
}
function fireProjectile(missile = false) {
  const p = params.value;
  const c = canvasRef.value!;
  const cy = c.height / 2;
  const s = scalePx();
  const create = (i: number) => {
    const bx = p.offsets[i * 2] || 0;
    const by = p.offsets[i * 2 + 1] || 0;
    const spread = ((p.minSpread + Math.random() * (p.maxSpread - p.minSpread)) * Math.PI) / 180;
    const ang = (Math.random() - 0.5) * spread;
    projectiles.push({
      x: 80 + bx * s,
      y: cy - by * s,
      angle: ang,
      speed: missile ? p.projSpeed * s * 0.3 : p.projSpeed * s,
      age: 0,
      trail: [],
      exploding: false,
      explosionAge: 0,
      missile,
    });
  };
  if (p.barrelMode === 'LINKED') for (let i = 0; i < barrelCount.value; i++) create(i);
  else {
    create(barrelIndex);
    barrelIndex = (barrelIndex + 1) % barrelCount.value;
  }
}
function update(dt: number) {
  const p = params.value;
  if (p.specClass === 'beam') {
    if (!beams.length) beams.push({ phase: 'chargeup', timer: p.chargeup, width: 0, offset: 0 });
    beams[0].offset += p.textureScrollSpeed * dt;
    beams[0].timer -= dt;
    beams[0].width = beams[0].timer > 0 ? 1 - beams[0].timer / Math.max(p.chargeup, 0.01) : 1;
    return;
  }
  fireTimer -= dt;
  if (fireTimer <= 0) {
    fireProjectile(Boolean(p.missileType));
    burst++;
    if (burst >= p.burstSize) {
      fireTimer = p.chargedown + p.chargeup;
      burst = 0;
    } else fireTimer = p.burstDelay;
  }
  const s = scalePx();
  const max = p.missileMaxSpeed * s;
  const acc = p.missileAcc * s;
  for (const obj of projectiles) {
    if (obj.missile) obj.speed = Math.min(max, obj.speed + acc * dt);
    obj.x += Math.cos(obj.angle) * obj.speed * dt;
    obj.y += Math.sin(obj.angle) * obj.speed * dt;
    obj.age += dt;
    if (obj.missile) {
      obj.trail.push({ x: obj.x, y: obj.y });
      if (obj.trail.length > 30) obj.trail.shift();
      if (obj.x - 80 > rangePx()) obj.exploding = true;
      if (obj.exploding) obj.explosionAge += dt;
    }
  }
  projectiles = projectiles.filter((o) => o.age < 8 && (!o.exploding || o.explosionAge < 0.5));
}
function draw() {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  const p = params.value;
  const cy = c.height / 2;
  const end = 80 + rangePx();
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#08111f';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#31415f55';
  for (let x = 80; x < c.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, c.height);
    ctx.stroke();
  }
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#ef444488';
  ctx.beginPath();
  ctx.moveTo(end, 40);
  ctx.lineTo(end, c.height - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#374151';
  ctx.fillRect(62, cy - 12, 36, 24);
  ctx.strokeStyle = '#9ca3af';
  ctx.strokeRect(62, cy - 12, 36, 24);
  if (p.specClass === 'beam' && beams.length) {
    const bw = Math.max(1, p.beamWidth * scalePx() * 0.15 * beams[0].width);
    for (let i = 0; i < barrelCount.value; i++) {
      const by = p.offsets[i * 2 + 1] || 0;
      const y = cy - by * scalePx();
      ctx.fillStyle = rgba(p.fringeColor, 0.65);
      ctx.fillRect(95, y - bw, end - 95, bw * 2);
      ctx.fillStyle = rgba(p.coreColor, 0.9);
      ctx.fillRect(95, y - bw * 0.4, end - 95, bw * 0.8);
    }
  }
  for (const o of projectiles) {
    if (o.exploding) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, p.explosionRadius * scalePx() * 0.1 * o.explosionAge * 4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.explosionColor, 0.5);
      ctx.fill();
      continue;
    }
    if (o.trail?.length > 1) {
      ctx.beginPath();
      ctx.moveTo(o.trail[0].x, o.trail[0].y);
      for (const t of o.trail) ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = '#f59e0b66';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle);
    ctx.fillStyle = o.missile ? '#9ca3af' : rgba(p.projFringeColor, 0.8);
    ctx.fillRect(
      -p.projLength * scalePx() * 0.08,
      -Math.max(2, p.projWidth * scalePx() * 0.1),
      p.projLength * scalePx() * 0.16,
      Math.max(3, p.projWidth * scalePx() * 0.2),
    );
    ctx.fillStyle = o.missile ? '#ef4444' : rgba(p.projCoreColor, 0.95);
    ctx.fillRect(0, -1, Math.max(4, p.projLength * scalePx() * 0.08), 2);
    ctx.restore();
  }
}
function frame(ts: number) {
  if (!running.value) return;
  if (!last) last = ts;
  const dt = Math.min(((ts - last) / 1000) * speed.value, 0.1);
  last = ts;
  update(dt);
  draw();
  anim = requestAnimationFrame(frame);
}
function resize() {
  const c = canvasRef.value;
  if (!c) return;
  const rect = previewStageRef.value?.getBoundingClientRect();
  c.width = Math.max(1, Math.floor(rect?.width ?? 1400));
  c.height = Math.max(1, Math.floor(rect?.height ?? 760));
  draw();
}
onMounted(() => {
  resize();
  window.addEventListener('resize', resize);
  reset();
  anim = requestAnimationFrame(frame);
});
onUnmounted(() => {
  cancelAnimationFrame(anim);
  window.removeEventListener('resize', resize);
});
</script>
