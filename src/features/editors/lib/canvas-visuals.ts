import type { Point } from '../composables/useCanvasViewport';
import { SLOT_RADIUS, WEAPON_COLORS } from '../../../shared/lib/starsector';

interface WeaponSlotVisualOptions {
  angle: number;
  arc: number;
  mount: string;
  point: Point;
  selected: boolean;
  size: string;
  type: string;
  hovered?: boolean;
}

interface EngineVisualOptions {
  angle: number;
  length: number;
  point: Point;
  scale: number;
  selected: boolean;
  width: number;
  hovered?: boolean;
}

interface BarrelVisualOptions {
  angle: number;
  index: number;
  point: Point;
  selected: boolean;
  hovered?: boolean;
}

function colorFor(type: string) {
  return WEAPON_COLORS[type] ?? '#9ca3af';
}

function radiusFor(size: string) {
  return SLOT_RADIUS[size] ?? SLOT_RADIUS.MEDIUM;
}

function usesSizeLayers(type: string) {
  return type === 'BALLISTIC' || type === 'ENERGY' || type === 'MISSILE';
}

function layerRadiiFor(type: string, size: string, scale: number) {
  if (!usesSizeLayers(type)) return [radiusFor(size) * scale];
  if (size === 'LARGE') return [SLOT_RADIUS.LARGE, SLOT_RADIUS.MEDIUM, SLOT_RADIUS.SMALL].map((radius) => radius * scale);
  if (size === 'MEDIUM') return [SLOT_RADIUS.MEDIUM, SLOT_RADIUS.SMALL].map((radius) => radius * scale);
  return [SLOT_RADIUS.SMALL * scale];
}

function withStroke(ctx: CanvasRenderingContext2D, color: string, draw: () => void) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  draw();
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
}

function drawSquare(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  ctx.rect(-radius, -radius, radius * 2, radius * 2);
}

function drawDiamond(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius, 0);
  ctx.closePath();
}

function drawPentagon(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHexagon(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI / 6 + (i * Math.PI * 2) / 6;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawTriangle(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  ctx.moveTo(-radius * 0.78, -radius);
  ctx.lineTo(radius * 1.1, 0);
  ctx.lineTo(-radius * 0.78, radius);
  ctx.closePath();
}

function drawOutline(ctx: CanvasRenderingContext2D, type: string, radius: number, color: string) {
  if (type === 'BALLISTIC') withStroke(ctx, color, () => drawSquare(ctx, radius));
  else if (type === 'ENERGY') withStroke(ctx, color, () => drawCircle(ctx, radius));
  else if (type === 'MISSILE') withStroke(ctx, color, () => drawDiamond(ctx, radius));
  else if (type === 'HYBRID') {
    withStroke(ctx, color, () => drawCircle(ctx, radius));
    withStroke(ctx, color, () => drawSquare(ctx, radius / Math.SQRT2));
  } else if (type === 'UNIVERSAL') {
    withStroke(ctx, color, () => drawSquare(ctx, radius));
    withStroke(ctx, color, () => drawCircle(ctx, radius * 0.88));
    withStroke(ctx, color, () => drawDiamond(ctx, radius * 0.9));
  } else if (type === 'SYNERGY') {
    withStroke(ctx, color, () => drawCircle(ctx, radius));
    withStroke(ctx, color, () => drawDiamond(ctx, radius * 0.88));
  } else if (type === 'COMPOSITE' || type === 'LAUNCH_BAY') {
    withStroke(ctx, color, () => drawSquare(ctx, radius));
    withStroke(ctx, color, () => drawDiamond(ctx, radius * 0.9));
  } else if (type === 'DECORATIVE') {
    withStroke(ctx, color, () => drawTriangle(ctx, radius * 1.1));
  } else if (type === 'STATION_MODULE') {
    withStroke(ctx, color, () => drawHexagon(ctx, radius * 0.92));
  } else if (type !== 'SYSTEM') {
    withStroke(ctx, color, () => drawPentagon(ctx, radius * 0.92));
  }
}

function drawSlotCenter(ctx: CanvasRenderingContext2D, color: string) {
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawArcAndFacing(ctx: CanvasRenderingContext2D, radius: number, arc: number, color: string) {
  const clampedArc = Math.max(0, Math.min(360, arc || 0));
  if (clampedArc > 0) {
    const half = (clampedArc * Math.PI) / 360;
    const start = -Math.PI / 2 - half;
    const end = -Math.PI / 2 + half;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, start, end);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(start) * radius * 1.18, Math.sin(start) * radius * 1.18);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(end) * radius * 1.18, Math.sin(end) * radius * 1.18);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d8d8d8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.2);
  ctx.lineTo(0, -8);
  ctx.stroke();
}

export function drawWeaponSlotVisual(ctx: CanvasRenderingContext2D, options: WeaponSlotVisualOptions) {
  const type = (options.type || 'SYSTEM').toUpperCase();
  const color = colorFor(type);
  const size = (options.size || 'MEDIUM').toUpperCase();
  const radiusScale = 1.5;
  const base = radiusFor(size) * radiusScale;
  const outlineRadii = layerRadiiFor(type, size, radiusScale);

  ctx.save();
  ctx.translate(options.point.x, options.point.y);
  ctx.globalAlpha = options.selected ? 1 : 0.6;
  ctx.save();
  ctx.rotate((-options.angle * Math.PI) / 180);
  drawArcAndFacing(ctx, base * 1.85, options.arc, color);
  ctx.restore();

  if (type !== 'SYSTEM') {
    outlineRadii.forEach((radius) => drawOutline(ctx, type, radius, color));
  }
  if (options.mount === 'HARDPOINT') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-base * 0.9, base * 0.9);
    ctx.lineTo(base * 0.9, -base * 0.9);
    ctx.stroke();
  }
  drawSlotCenter(ctx, color);
  ctx.restore();
}

export function drawBoundsVisual(ctx: CanvasRenderingContext2D, points: Point[], selectedIndex: number, hoveredIndex = -1) {
  if (points.length < 2) return;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((point, index) => {
    index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.stroke();
  points.forEach((point, index) => drawControlPoint(ctx, point, index === selectedIndex, index === hoveredIndex, 6));
}

export function drawControlPoint(ctx: CanvasRenderingContext2D, point: Point, selected: boolean, hovered = false, radius = 5) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, selected ? radius + 2 : hovered ? radius + 1 : radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (selected || hovered) {
    ctx.strokeStyle = '#101010';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function drawRadiusField(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  fill: string,
  selected: boolean,
  hovered = false,
  marker: 'cross' | 'x' = 'cross',
) {
  if (radius > 0) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (marker === 'x') drawXMarker(ctx, center, selected, hovered);
  else drawCrossMarker(ctx, center, selected, hovered);
}

export function drawCrossMarker(ctx: CanvasRenderingContext2D, point: Point, selected: boolean, hovered = false, label?: string) {
  const radius = selected || hovered ? 16 : 13;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = selected ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(point.x - radius, point.y);
  ctx.lineTo(point.x + radius, point.y);
  ctx.moveTo(point.x, point.y - radius);
  ctx.lineTo(point.x, point.y + radius);
  ctx.stroke();
  if (label) {
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 4;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeText(label, point.x + 10, point.y + 14);
    ctx.fillText(label, point.x + 10, point.y + 14);
  }
}

export function drawXMarker(ctx: CanvasRenderingContext2D, point: Point, selected: boolean, hovered = false) {
  const radius = selected || hovered ? 16 : 13;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = selected ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(point.x - radius, point.y - radius);
  ctx.lineTo(point.x + radius, point.y + radius);
  ctx.moveTo(point.x + radius, point.y - radius);
  ctx.lineTo(point.x - radius, point.y + radius);
  ctx.stroke();
}

export function drawEngineVisual(ctx: CanvasRenderingContext2D, options: EngineVisualOptions) {
  const width = Math.max(4, options.width * options.scale);
  const length = Math.max(8, options.length * options.scale);
  const selected = options.selected || Boolean(options.hovered);
  ctx.save();
  ctx.translate(options.point.x, options.point.y);
  ctx.rotate(-Math.PI / 2 + (options.angle * Math.PI) / 180);
  ctx.fillStyle = 'rgba(220, 230, 220, 0.08)';
  ctx.fillRect(0, -width / 2, length, width);

  const flame = ctx.createLinearGradient(0, 0, length, 0);
  flame.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  flame.addColorStop(0.35, 'rgba(255, 174, 91, 0.75)');
  flame.addColorStop(1, 'rgba(219, 92, 37, 0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.45);
  ctx.quadraticCurveTo(length * 0.55, -width * 0.35, length, 0);
  ctx.quadraticCurveTo(length * 0.55, width * 0.35, 0, width * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawControlPoint(ctx, options.point, options.selected, options.hovered, selected ? 7 : 5);
}

export function drawBarrelVisual(ctx: CanvasRenderingContext2D, options: BarrelVisualOptions) {
  const color = '#f1f5f9';
  const length = 36;
  const angle = (options.angle * Math.PI) / 180;
  ctx.save();
  ctx.globalAlpha = options.selected ? 1 : 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(options.point.x, options.point.y);
  ctx.lineTo(options.point.x + Math.sin(-angle) * length, options.point.y - Math.cos(angle) * length);
  ctx.stroke();
  drawControlPoint(ctx, options.point, false, false, 5);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(String(options.index), options.point.x, options.point.y);
  ctx.fillText(String(options.index), options.point.x, options.point.y);
  ctx.restore();
}
