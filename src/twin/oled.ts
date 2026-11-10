// ─── 128 × 64 monochrome OLED, as on the physical instrument ───
// Text is drawn into a 1-bit framebuffer (anti-aliasing thresholded away),
// then every lit pixel is painted as a small green square, plus a blurred copy
// for the glow, so the screen shows exactly what a 2.42" SSD1309 module can show.

export const OLED_W = 128;
export const OLED_H = 64;

export interface OledLine {
  text: string;
  /** Font size in OLED pixels. */
  size: number;
  /** Baseline, in OLED pixels from the top. */
  y: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}

const FONT = '"DejaVu Sans Mono", "Courier New", monospace';
const ON = '#00e060';

export class Oled {
  private readonly scratch: CanvasRenderingContext2D;
  private readonly layer: CanvasRenderingContext2D;
  private readonly out: CanvasRenderingContext2D;
  private readonly scale: number;
  private brightness = 1;

  constructor(readonly canvas: HTMLCanvasElement, scale = 4) {
    this.scale = scale;
    canvas.width = OLED_W * scale;
    canvas.height = OLED_H * scale;
    this.out = canvas.getContext('2d')!;
    const s = document.createElement('canvas');
    s.width = OLED_W;
    s.height = OLED_H;
    this.scratch = s.getContext('2d', { willReadFrequently: true })!;
    const l = document.createElement('canvas');
    l.width = canvas.width;
    l.height = canvas.height;
    this.layer = l.getContext('2d')!;
    this.clear();
  }

  setBrightness(b: number): void { this.brightness = b; }

  clear(): void {
    this.out.fillStyle = '#000';
    this.out.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Render a full frame. An empty list blanks the screen (powered off). */
  draw(lines: readonly OledLine[]): void {
    const c = this.scratch;
    c.clearRect(0, 0, OLED_W, OLED_H);
    for (const l of lines) {
      c.font = `${l.bold ? 'bold ' : ''}${l.size}px ${FONT}`;
      c.textAlign = l.align ?? 'center';
      c.textBaseline = 'alphabetic';
      const x = l.align === 'left' ? 2 : l.align === 'right' ? OLED_W - 2 : OLED_W / 2;
      c.fillStyle = '#fff';
      c.fillText(l.text, x, l.y);
    }
    const px = c.getImageData(0, 0, OLED_W, OLED_H).data;

    // Sharp pixels on a layer, then the layer twice: blurred (glow) and sharp.
    const s = this.scale, l = this.layer;
    l.clearRect(0, 0, this.canvas.width, this.canvas.height);
    l.fillStyle = ON;
    for (let y = 0; y < OLED_H; y++) {
      for (let x = 0; x < OLED_W; x++) {
        if (px[(y * OLED_W + x) * 4 + 3] > 110) l.fillRect(x * s, y * s, s - 1, s - 1);
      }
    }
    const o = this.out;
    this.clear();
    o.save();
    o.globalAlpha = 0.55 * this.brightness;
    o.filter = `blur(${s * 1.2}px)`;
    o.drawImage(l.canvas, 0, 0);
    o.filter = 'none';
    o.globalAlpha = this.brightness;
    o.drawImage(l.canvas, 0, 0);
    o.restore();
  }
}
