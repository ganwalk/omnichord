// ─── The physical panel, drawn from the hardware generator's layout ───
// hardware/painel/gerar.cjs writes out/layout.json; this module turns it into
// an interactive SVG (keys, sliders, encoder, strumplate) with the OLED
// screens as canvases laid over their windows. Units are millimetres.

import raw from '../../hardware/painel/out/layout.json';

export interface Layout {
  panel: { w: number; h: number; frame: number };
  cap: number;
  holeD: number;
  mountD: number;
  slotW: number;
  sliderCap: [number, number];
  keys: { type: number; root: number; x: number; y: number; color: string }[];
  fnKeys: { action: string; x: number; y: number }[];
  sliders: { setting: string; x: number; y1: number; y2: number }[];
  screens: { id: 'robot' | 'chord'; x: number; y: number; w: number; h: number }[];
  leds: { id: string; x: number; y: number; d: number }[];
  grille: [number, number][];
  mounts: [number, number][];
  power: { x: number; y: number; d: number };
  encoder: { x: number; y: number; r: number };
  strum: { x: number; y: number; w: number; h: number; n: number; pad: number; pitch: number; gap: number };
  texts: { x: number; y: number; t: string; s: number; anchor: string; weight: string; spacing: number }[];
}

export const LAYOUT = raw as unknown as Layout;

/**
 * String index (0 = lowest) under a point `y` mm from the panel's top edge.
 * The physical plate has the high strings at the back (top of the panel);
 * `lowAtBottom = false` flips it.
 */
export function strumIndex(y: number, s: Layout['strum'], lowAtBottom = true): number {
  const row = Math.floor((y - s.y - s.pad) / s.pitch);
  const fromTop = Math.min(s.n - 1, Math.max(0, row));
  return lowAtBottom ? s.n - 1 - fromTop : fromTop;
}

/** Centre (y, mm) of string `idx`, the inverse of strumIndex. */
export function stringY(idx: number, s: Layout['strum'], lowAtBottom = true): number {
  const fromTop = lowAtBottom ? s.n - 1 - idx : idx;
  return s.y + s.pad + (fromTop + 0.5) * s.pitch;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function el<K extends keyof SVGElementTagNameMap>(
  tag: K, attrs: Record<string, string | number> = {}, parent?: Element,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

export interface PanelView {
  svg: SVGSVGElement;
  keys: Map<string, SVGGElement>;          // `${type}:${root}`
  fnKeys: Map<string, SVGGElement>;        // by action
  sliders: Map<string, { knob: SVGGElement; hit: SVGRectElement; y1: number; y2: number }>;
  leds: Map<string, SVGCircleElement>;
  strings: SVGRectElement[];               // by string index, 0 = lowest
  strumHit: SVGRectElement;
  encoder: { knob: SVGGElement; hit: SVGCircleElement };
  power: SVGGElement;
  screens: Map<string, HTMLCanvasElement>;
  /** Re-place the strings after the strum direction changes. */
  placeStrings(lowAtBottom: boolean): void;
  /** Panel millimetres under a pointer event. */
  toMm(e: { clientX: number; clientY: number }): { x: number; y: number };
}

export function buildPanel(stage: HTMLElement, L: Layout = LAYOUT): PanelView {
  const F = L.panel.frame, W = L.panel.w, H = L.panel.h;
  const svg = el('svg', { viewBox: `${-F} ${-F} ${W + 2 * F} ${H + 2 * F}`, class: 'twin-svg' });
  stage.appendChild(svg);

  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0.15">
      <stop offset="0" stop-color="#c79a63"/><stop offset=".35" stop-color="#b98a55"/>
      <stop offset=".7" stop-color="#c49560"/><stop offset="1" stop-color="#a87a47"/>
    </linearGradient>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b1b1b"/><stop offset="1" stop-color="#101010"/>
    </linearGradient>
    <radialGradient id="metal" cx=".38" cy=".35" r=".7">
      <stop offset="0" stop-color="#5a5a5a"/><stop offset=".6" stop-color="#222"/><stop offset="1" stop-color="#111"/>
    </radialGradient>
    <radialGradient id="knobWood" cx=".4" cy=".35" r=".75">
      <stop offset="0" stop-color="#d7ad78"/><stop offset="1" stop-color="#9c6e3c"/>
    </radialGradient>
    <linearGradient id="capShine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".18"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="ledGlow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1"/></filter>`;

  // Wood frame and panel
  el('rect', { x: -F, y: -F, width: W + 2 * F, height: H + 2 * F, rx: 5, fill: 'url(#wood)' }, svg);
  el('rect', { x: -1, y: -1, width: W + 2, height: H + 2, rx: 1, fill: '#3a2814' }, svg);
  el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#panelGrad)' }, svg);

  // Screws
  for (const [x, y] of L.mounts) {
    el('circle', { cx: x, cy: y, r: L.mountD / 2 + 0.3, fill: 'url(#metal)' }, svg);
    el('line', { x1: x - 1.3, y1: y, x2: x + 1.3, y2: y, stroke: '#0a0a0a', 'stroke-width': 0.5 }, svg);
  }

  // Silkscreen
  const silk = el('g', { class: 'silk' }, svg);
  for (const t of L.texts) {
    const node = el('text', {
      x: t.x, y: t.y, 'font-size': t.s, 'text-anchor': t.anchor, 'font-weight': t.weight, 'letter-spacing': t.spacing,
    }, silk);
    node.textContent = t.t;
  }

  // Speaker grille
  const grille = el('g', { fill: '#040404' }, svg);
  for (const [x, y] of L.grille) el('circle', { cx: x, cy: y, r: L.holeD / 2 }, grille);

  // OLED windows (the canvases go on top, as HTML)
  const screens = new Map<string, HTMLCanvasElement>();
  const pct = (v: number, total: number): string => `${((v + F) / (total + 2 * F)) * 100}%`;
  for (const s of L.screens) {
    el('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 2, fill: '#000', stroke: '#2a2a2a', 'stroke-width': 0.4 }, svg);
    // 2.42" active area: 55.0 × 27.5 mm, centred in the window
    const aw = 55, ah = 27.5, ax = s.x + (s.w - aw) / 2, ay = s.y + (s.h - ah) / 2;
    const canvas = document.createElement('canvas');
    canvas.className = 'twin-oled';
    Object.assign(canvas.style, {
      left: pct(ax, W), top: pct(ay, H),
      width: `${(aw / (W + 2 * F)) * 100}%`, height: `${(ah / (H + 2 * F)) * 100}%`,
    });
    stage.appendChild(canvas);
    screens.set(s.id, canvas);
  }

  // Power button + LEDs
  const power = el('g', { class: 'twin-power' }, svg);
  el('circle', { cx: L.power.x, cy: L.power.y, r: L.power.d / 2, fill: 'url(#metal)', stroke: '#000', 'stroke-width': 0.5 }, power);
  el('circle', { cx: L.power.x, cy: L.power.y, r: L.power.d / 2 - 2.5, fill: 'none', stroke: '#777', 'stroke-width': 0.35 }, power);
  const sym = el('text', { x: L.power.x, y: L.power.y + 2.2, 'font-size': 6, 'text-anchor': 'middle', class: 'twin-power-sym' }, power);
  sym.textContent = '⏻';
  const leds = new Map<string, SVGCircleElement>();
  for (const l of L.leds) {
    el('circle', { cx: l.x, cy: l.y, r: l.d / 2, fill: '#1a0606' }, svg);
    leds.set(l.id, el('circle', { cx: l.x, cy: l.y, r: l.d / 2, class: `twin-led led-${l.id}` }, svg));
  }

  // Encoder
  const encG = el('g', { class: 'twin-encoder' }, svg);
  const { x: ex, y: ey, r: er } = L.encoder;
  el('circle', { cx: ex, cy: ey + 0.6, r: er, fill: '#000', opacity: 0.5 }, encG);
  const encKnob = el('g', {}, encG);
  el('circle', { cx: ex, cy: ey, r: er, fill: 'url(#knobWood)', stroke: '#5e3d1c', 'stroke-width': 0.4 }, encKnob);
  el('line', { x1: ex, y1: ey - er + 1.5, x2: ex, y2: ey - er + 5, stroke: '#2b1a0a', 'stroke-width': 1, 'stroke-linecap': 'round' }, encKnob);
  const encHit = el('circle', { cx: ex, cy: ey, r: er + 2, fill: 'transparent' }, encG);

  // Sliders
  const sliders = new Map<string, { knob: SVGGElement; hit: SVGRectElement; y1: number; y2: number }>();
  const [cw, ch] = L.sliderCap;
  for (const s of L.sliders) {
    const g = el('g', { class: 'twin-slider' }, svg);
    el('rect', { x: s.x - L.slotW / 2, y: s.y1 - L.slotW / 2, width: L.slotW, height: s.y2 - s.y1 + L.slotW, rx: L.slotW / 2, fill: '#030303' }, g);
    const knob = el('g', {}, g);
    el('rect', { x: s.x - cw / 2 + 0.3, y: -ch / 2 + 0.6, width: cw, height: ch, rx: 1.5, fill: '#000', opacity: 0.45 }, knob);
    el('rect', { x: s.x - cw / 2, y: -ch / 2, width: cw, height: ch, rx: 1.5, fill: 'url(#knobWood)', stroke: '#5e3d1c', 'stroke-width': 0.3 }, knob);
    el('line', { x1: s.x - cw / 2 + 1.5, y1: 0, x2: s.x + cw / 2 - 1.5, y2: 0, stroke: '#2b1a0a', 'stroke-width': 0.5 }, knob);
    const hit = el('rect', { x: s.x - cw / 2 - 2, y: s.y1 - ch / 2, width: cw + 4, height: s.y2 - s.y1 + ch, fill: 'transparent' }, g);
    sliders.set(s.setting, { knob, hit, y1: s.y1, y2: s.y2 });
  }

  // Keys: an LED glow under each cap (per-key LEDs), then the cap
  const keyCap = (x: number, y: number, fill: string, cls: string): SVGGElement => {
    const g = el('g', { class: cls }, svg);
    const c = L.cap;
    el('rect', { x: x - c / 2 - 1.5, y: y - c / 2 - 1.5, width: c + 3, height: c + 3, rx: 3, class: 'twin-key-glow', filter: 'url(#glow)' }, g);
    el('rect', { x: x - c / 2 + 0.3, y: y - c / 2 + 0.8, width: c, height: c, rx: 2, fill: '#000', opacity: 0.55 }, g);
    const cap = el('g', { class: 'twin-cap' }, g);
    el('rect', { x: x - c / 2, y: y - c / 2, width: c, height: c, rx: 2, fill }, cap);
    el('rect', { x: x - c / 2, y: y - c / 2, width: c, height: c, rx: 2, fill: 'url(#capShine)' }, cap);
    el('rect', { x: x - c / 2 + 2.2, y: y - c / 2 + 1.6, width: c - 4.4, height: c - 4.6, rx: 1.4, fill: '#fff', opacity: 0.05 }, cap);
    return g;
  };
  const keys = new Map<string, SVGGElement>();
  for (const k of L.keys) keys.set(`${k.type}:${k.root}`, keyCap(k.x, k.y, k.color, 'twin-key'));
  const fnKeys = new Map<string, SVGGElement>();
  for (const k of L.fnKeys) fnKeys.set(k.action, keyCap(k.x, k.y, '#3a3a3a', 'twin-key twin-fn'));

  // Strumplate: window, gold strips under acrylic, hit area
  const st = L.strum;
  el('rect', { x: st.x, y: st.y, width: st.w, height: st.h, rx: 3, fill: '#050505', stroke: '#2a2a2a', 'stroke-width': 0.4 }, svg);
  const stripsG = el('g', {}, svg);
  const strings: SVGRectElement[] = [];
  for (let i = 0; i < st.n; i++) {
    strings.push(el('rect', { x: st.x + 5, y: 0, width: st.w - 10, height: st.pitch - st.gap, rx: 0.6, class: 'twin-string' }, stripsG));
  }
  el('rect', { x: st.x, y: st.y, width: st.w, height: st.h, rx: 3, fill: 'url(#capShine)', opacity: 0.6, 'pointer-events': 'none' }, svg);
  const strumHit = el('rect', { x: st.x, y: st.y, width: st.w, height: st.h, fill: 'transparent', class: 'twin-strum-hit' }, svg);

  const placeStrings = (lowAtBottom: boolean): void => {
    strings.forEach((r, i) => r.setAttribute('y', String(stringY(i, st, lowAtBottom) - (st.pitch - st.gap) / 2)));
  };
  placeStrings(true);

  const toMm = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  return {
    svg, keys, fnKeys, sliders, leds, strings, strumHit, encoder: { knob: encKnob, hit: encHit },
    power, screens, placeStrings, toMm,
  };
}
