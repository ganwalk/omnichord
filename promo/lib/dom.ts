// ─── Tiny DOM helpers for the promo stage ───

export const stage = (): HTMLElement => document.getElementById('stage')!;

const parents: Element[] = [];
const defaultParent = (): Element => parents[parents.length - 1] ?? stage();

/** Build a scene inside `root`: every el()/layer() without an explicit parent goes there. */
export function withParent<T>(root: Element, build: () => T): T {
  parents.push(root);
  try { return build(); } finally { parents.pop(); }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent: Element = defaultParent()): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
}

export function layer(id: string, parent: Element = defaultParent()): HTMLDivElement {
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
