// ─── 2.4" IPS colour screen, 320 × 240, as on the physical instrument ───
// The canvas is drawn in screen pixels (320 × 240), with a 2× backing store so
// it stays sharp when the page is zoomed.

export const SCREEN_W = 320;
export const SCREEN_H = 240;
const BACKING = 2;

export class Screen {
  readonly ctx: CanvasRenderingContext2D;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = SCREEN_W * BACKING;
    canvas.height = SCREEN_H * BACKING;
    this.ctx = canvas.getContext('2d')!;
    this.off();
  }

  /** Backlight level, 0–1. */
  setBrightness(b: number): void {
    this.canvas.style.filter = b < 1 ? `brightness(${b})` : '';
  }

  /** Backlight off: a black panel. */
  off(): void {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Start a frame: transform set to screen pixels, background cleared to `bg`. */
  begin(bg: string | CanvasGradient = '#000'): CanvasRenderingContext2D {
    const c = this.ctx;
    c.setTransform(BACKING, 0, 0, BACKING, 0, 0);
    c.shadowBlur = 0;
    c.globalAlpha = 1;
    c.fillStyle = bg;
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    return c;
  }
}
