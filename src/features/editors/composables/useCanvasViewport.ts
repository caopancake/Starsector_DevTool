import { ref, type Ref } from 'vue';

export interface Point {
  x: number;
  y: number;
}

type CoordinateSpace = 'ship' | 'weapon';

export function useCanvasViewport(canvasRef: Ref<HTMLCanvasElement | undefined>, initialScale: number, maxScale: number) {
  const scale = ref(initialScale);
  const pan = ref<Point>({ x: 0, y: 0 });

  function center(): Point {
    const canvas = canvasRef.value;
    if (!canvas) return { x: pan.value.x, y: pan.value.y };
    return { x: canvas.width / 2 + pan.value.x, y: canvas.height / 2 + pan.value.y };
  }

  function resize(width = 1600, height = 1100) {
    const canvas = canvasRef.value;
    if (!canvas) return false;
    canvas.width = width;
    canvas.height = height;
    return true;
  }

  function panBy(dx: number, dy: number) {
    pan.value.x += dx;
    pan.value.y += dy;
  }

  function zoom(deltaY: number) {
    scale.value = Math.max(0.1, Math.min(maxScale, scale.value * (deltaY < 0 ? 1.1 : 0.9)));
  }

  function toCanvas(space: CoordinateSpace, x: number, y: number): Point {
    const canvasCenter = center();
    if (space === 'ship') {
      return { x: canvasCenter.x - y * scale.value, y: canvasCenter.y - x * scale.value };
    }
    return { x: canvasCenter.x + y * scale.value, y: canvasCenter.y - x * scale.value };
  }

  function fromCanvas(space: CoordinateSpace, x: number, y: number): Point {
    const canvasCenter = center();
    if (space === 'ship') {
      return { x: -(y - canvasCenter.y) / scale.value, y: -(x - canvasCenter.x) / scale.value };
    }
    return { x: -(y - canvasCenter.y) / scale.value, y: (x - canvasCenter.x) / scale.value };
  }

  return {
    center,
    fromCanvas,
    pan,
    panBy,
    resize,
    scale,
    toCanvas,
    zoom,
  };
}
