// ─── Kinetic headline: words rise into view per line, then leave together ───

import { easeInCubic, easeOutExpo, prog } from './anim';
import { el } from './dom';

export class Headline {
  readonly el: HTMLDivElement;
  private readonly lines: HTMLElement[][] = [];

  /** `lines`: words prefixed with * are gold. */
  constructor(lines: string[], private readonly times: number[], private readonly out: number, top: number, size: number) {
    this.el = el('div', 'headline');
    Object.assign(this.el.style, { top: `${top}px`, fontSize: `${size}px` });
    for (const line of lines) {
      const l = el('span', 'line', this.el);
      const words = line.split(' ').map((w, i, arr) => {
        const span = el('span', 'word' + (w.startsWith('*') ? ' gold' : ''), l);
        span.textContent = w.replace(/^\*/, '') + (i < arr.length - 1 ? ' ' : '');
        return span;
      });
      this.lines.push(words);
    }
  }

  /** Shrink the font until every line fits the stage width. */
  fit(maxW = 960): void {
    let size = parseFloat(this.el.style.fontSize);
    const lineEls = [...this.el.querySelectorAll<HTMLElement>('.line')];
    const widest = () => Math.max(...lineEls.map(l => [...l.children].reduce((w, c) => w + (c as HTMLElement).offsetWidth, 0)));
    while (widest() > maxW && size > 20) { size -= 2; this.el.style.fontSize = `${size}px`; }
  }

  render(t: number): void {
    const visible = t >= this.times[0] - 0.01 && t < this.out + 0.4;
    this.el.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const q = easeInCubic(prog(t, this.out, 0.3));
    this.lines.forEach((words, li) => {
      words.forEach((w, wi) => {
        const p = easeOutExpo(prog(t, this.times[li] + wi * 0.05, 0.5));
        const y = (1 - p) * 110 - q * 110;
        w.style.transform = `translateY(${y}%)`;
        w.style.opacity = String(Math.min(p * 1.5, 1) * (1 - q));
      });
    });
  }
}

