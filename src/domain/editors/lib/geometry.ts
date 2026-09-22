/// Ship-canvas geometry helpers: angles are degrees with 0° = +X and the
/// ship coordinate system flipped on Y (screen y grows downward).

export function roundDegree(value: number): number {
  return Math.round(value);
}

export function normalizeDegree(value: number): number {
  const normalized = roundDegree(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function clampArc(value: number): number {
  return Math.max(0, Math.min(360, roundDegree(value)));
}

/// Absolute shortest signed→unsigned arc delta between two angles (0..180).
export function angleDelta(from: number, to: number): number {
  return Math.abs(((((from - to + 540) % 360) + 360) % 360) - 180);
}

export function distance(a: number[], b: number[]): number {
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[1] || 0) - (b[1] || 0));
}

/// Angle from origin to point in the flipped ship coordinate system.
export function pointAngle(origin: number[], point: number[]): number {
  const relativePoint = [(point[1] || 0) - (origin[1] || 0), (origin[0] || 0) - (point[0] || 0)];
  return normalizeDegree((Math.atan2(relativePoint[1] || 0, relativePoint[0] || 0) * 180) / Math.PI);
}

/// Angle from origin to point in plain screen coordinates (y grows downward);
/// used by the weapon editor where no flip is involved.
export function pointAngleScreen(origin: { x: number; y: number }, point: { x: number; y: number }): number {
  const angle = (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;
  return normalizeDegree(angle);
}

export function pointArc(origin: number[], point: number[], angle: number): number {
  return clampArc(angleDelta(pointAngle(origin, point), angle) * 2);
}

export function distanceToSegment(point: number[], a: number[], b: number[]): number {
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
