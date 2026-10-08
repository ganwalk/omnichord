// ─── Tiny DOM helpers for the promo stage ───

export const stage = (): HTMLElement => document.getElementById('stage')!;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent: Element = stage()): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}

export function layer(id: string, parent: Element = stage()): HTMLDivElement {
  const d = el('div', 'layer', parent);
  d.id = id;
  return d;
}

/** Shrink an element's font until it fits `max` px wide on one line. */
export function fitWidth(e: HTMLElement, start: number, max: number): void {
  let size = start;
  e.style.fontSize = `${size}px`;
  e.style.whiteSpace = 'nowrap';
  e.style.width = 'max-content';
  while (e.offsetWidth > max && size > 40) { size -= 6; e.style.fontSize = `${size}px`; }
}
