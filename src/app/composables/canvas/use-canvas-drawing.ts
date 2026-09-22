import type { Point } from '@/domain/editors/editor-types';
import { CANVAS_CLEAR_COLOR, CANVAS_GRID_COLOR } from '@/domain/editors/lib/canvas-palette';

interface GridOptions {
  center: Point;
  height: number;
  scale: number;
  width: number;
}

export function useCanvasDrawing() {
  function clear(ctx: CanvasRenderingContext2D, width: number, height: number, color = CANVAS_CLEAR_COLOR) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx: CanvasRenderingContext2D, options: GridOptions) {
    const step = 50 * options.scale;
    if (step < 5) return;
    ctx.strokeStyle = CANVAS_GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let x = options.center.x % step; x < options.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, options.height);
      ctx.stroke();
    }
    for (let y = options.center.y % step; y < options.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(options.width, y);
      ctx.stroke();
    }
  }

  function drawPixelImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, width: number, height: number) {
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, x, y, width, height);
    ctx.imageSmoothingEnabled = smoothing;
  }

  return {
    clear,
    drawGrid,
    drawPixelImage,
  };
}
