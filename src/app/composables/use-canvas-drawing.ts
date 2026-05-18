import type { Point } from '@/domain/editors/editor-types';

interface GridOptions {
  center: Point;
  height: number;
  scale: number;
  width: number;
}

export function useCanvasDrawing() {
  function clear(ctx: CanvasRenderingContext2D, width: number, height: number, color = '#08111f') {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx: CanvasRenderingContext2D, options: GridOptions) {
    const step = 50 * options.scale;
    if (step < 5) return;
    ctx.strokeStyle = '#31415f55';
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

  function drawDot(ctx: CanvasRenderingContext2D, point: Point, color: string, radius: number) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawCrosshair(ctx: CanvasRenderingContext2D, point: Point, radius = 12, color = '#ffffff55') {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(point.x - radius, point.y);
    ctx.lineTo(point.x + radius, point.y);
    ctx.moveTo(point.x, point.y - radius);
    ctx.lineTo(point.x, point.y + radius);
    ctx.stroke();
  }

  function drawPixelImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, x: number, y: number, width: number, height: number) {
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, x, y, width, height);
    ctx.imageSmoothingEnabled = smoothing;
  }

  return {
    clear,
    drawCrosshair,
    drawDot,
    drawGrid,
    drawPixelImage,
  };
}
