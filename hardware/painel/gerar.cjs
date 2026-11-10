#!/usr/bin/env node
// ─── OmniHarp hardware: top panel layout generator ───
//
// One parametric layout, several outputs (all at 1:1, millimetres):
//   out/painel-corte.svg     cut lines (red) + silkscreen text (black) + guides (grey)
//   out/painel-corte.dxf     cut lines only, for the laser-cut MDF mock-up
//   out/painel-visual.svg    how the finished panel should look (black FR4, wood frame)
//   out/painel-visual.png    preview of the above
//   out/painel-A2.pdf        full size on one A2 sheet (print shop / plotter)
//   out/painel-A4.pdf        full size split across A4 sheets (home printer)
//
// Usage: node hardware/painel/gerar.cjs
// Change the constants below and run again: every output follows.
// Values marked CHECK depend on the exact part bought; measure it with calipers.

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');

// ── Parameters ──────────────────────────────────────────────────────────────
//
// Two zones, each one a separate panel part (and later one PCB each):
//
//   left: everything sits on the 12 key columns (19.05 mm), so the controls
//   are exactly as wide as the chord grid. Top to bottom:
//     top band      power · SYS MONITOR (robot) · CHORD DISPLAY · MENU encoder
//     slider row    MIXER (6) · RHYTHM (2) · ARPEGGIATOR (2)
//     function row  global keys · rhythm keys · arp keys, under their sliders
//     chord grid    note names + 6 × 12 keys
//   right: speaker on top, strumplate below (high strings at the back, low
//   strings nearest the player, as in the app's portrait layout).
//
// The function row and the chord grid share one key PCB (7 × 12 matrix);
// the slider row is the controls PCB; the top band is the display PCB.

const M = 12;              // panel margin
const P = 19.05;           // key pitch (MX standard); every control column uses it
const KEY_CUT = 14;        // MX plate cut-out (square)
const CAP = 18;            // keycap footprint, guide only (DSA/XDA ≈ 18 mm)
const LABEL_W = 30;        // column left of the grid: power button, row labels
const GAP = 16;            // between the left zone and the right column (panel seam in the middle)

const STRUM_N = 24;        // strings (theory.ts STRING_COUNT)
const STRUM_W = 110;       // strumplate window width (string length)
const STRUM_GAP = 3;       // gap between neighbouring copper strips (guide)
const STRUM_PAD = 4;       // window margin around the strips

const TOP_H = 54;          // displays band (and speaker, on the right)
const SLIDER_H = 74;       // slider row
const FN_H = 30;           // function row (label + key)
const HEADER_H = 9;        // note names above the grid

const SLIDER_TRAVEL = 45;  // CHECK: slide pot travel
const SLIDER_SLOT_W = 3;   // CHECK: lever width + clearance
const SLIDER_CAP = [10, 18]; // CHECK: slider knob footprint (guide)

const OLED_WIN = [58, 31];     // CHECK: 2.42" SSD1309 visible area + 1 mm (both screens are this model)
const OLED_MODULE = [71, 41];  // CHECK: the module's circuit board behind the panel (sets the spacing)
const OLED_GAP = 3;            // between the two modules' boards
const POWER_D = 16;            // CHECK: power push button
const LED_D = 3;               // status LEDs (light through the panel)
const ENCODER_D = 7;           // CHECK: rotary encoder thread
const ENCODER_KNOB_R = 13;     // knob footprint (guide)
const SPEAKER = [70, 40];       // CHECK: rectangular full-range speaker (4 Ω, 3–5 W) under the grille (guide)
const GRILLE_INSET = 5;        // grille holes keep this far from its frame
const GRILLE_HOLE = 3.5;
const GRILLE_PITCH = 6;
const MOUNT_D = 3.6;           // M3 clearance holes to screw the panel to the wood
const MOUNT_INSET = 6;

const FRAME_SIDE = 15;     // visible wood, front and back rails (guide)
const FRAME_CHEEK = 30;    // visible wood, end cheeks (guide)

// From the app (src/theory.ts) so the panel matches the screen.
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const ROWS = [
  ['Major', '#4a8a5a'], ['Minor', '#5080b0'], ['7th', '#a06050'],
  ['m7', '#806098'], ['Maj7', '#407090'], ['Dim7', '#8a7030'],
];

// Control groups, by key column. Sliders sit on column centres or, in the
// 3-column groups, on the lines between columns so the pair stays centred.
// The on/off key of each group is its rightmost key, nearest the strumming hand.
// TAP tempo = SHIFT + PLAY.
const GROUPS = [
  { title: 'MIXER', from: 0, to: 5,
    sliders: [[0.5, 'MASTER'], [1.5, 'CHORD'], [2.5, 'STRUM'], [3.5, 'TONE'], [4.5, 'REVERB'], [5.5, 'GLIDE']],
    keys: ['SHIFT', 'MUTE', 'KEY', 'OCT −', 'OCT +', 'F1'] },
  { title: 'RHYTHM', from: 6, to: 8,
    sliders: [[7, 'TEMPO'], [8, 'VOLUME']],
    keys: ['◀ STYLE', 'STYLE ▶', 'PLAY'] },
  { title: 'ARPEGGIATOR', from: 9, to: 11,
    sliders: [[10, 'SPEED'], [11, 'VOLUME']],
    keys: ['◀ MODE', 'MODE ▶', 'ARP'] },
];

// ── Derived layout ──────────────────────────────────────────────────────────

const gridX0 = M + LABEL_W;
const gridW = 12 * P;
const colX = c => gridX0 + c * P;              // left edge of column c (fractions allowed)
const strumX0 = gridX0 + gridW + GAP;
const W = strumX0 + STRUM_W + M;
const seamX = strumX0 - GAP / 2;

const topY0 = M;
const sliderY0 = topY0 + TOP_H;
const fnY0 = sliderY0 + SLIDER_H;
const headerY0 = fnY0 + FN_H;
const gridY0 = headerY0 + HEADER_H;
const H = gridY0 + 6 * P + M;

const strumY0 = sliderY0, strumH = H - M - sliderY0;
const STRUM_PITCH = (strumH - 2 * STRUM_PAD) / STRUM_N;

// ── Geometry collection ─────────────────────────────────────────────────────
// Shapes are in panel coordinates (origin top-left, y down).

const cuts = [];    // {type:'rect', x,y,w,h,r} | {type:'circle', cx,cy,r} | {type:'slot', cx,y1,y2,w}
const texts = [];   // {x,y,s,t,anchor,weight}
const guides = [];  // {type:'rect'|'circle'|'line'|'robot'|'seg', ..., role, fill}

const rect = (x, y, w, h, r = 0) => cuts.push({ type: 'rect', x, y, w, h, r });
const circle = (cx, cy, d) => cuts.push({ type: 'circle', cx, cy, r: d / 2 });
const text = (x, y, t, s = 2.6, anchor = 'middle', weight = 'normal') =>
  texts.push({ x, y, t, s, anchor, weight });

// Panel outline, seam between the two panel parts, mounting holes
rect(0, 0, W, H);
guides.push({ type: 'line', x1: seamX, y1: 0, x2: seamX, y2: H, role: 'seam' });
for (const [x1, x2] of [[0, seamX], [seamX, W]]) {
  const xs = [x1 + MOUNT_INSET, x2 - MOUNT_INSET];
  if (x2 - x1 > 200) xs.push((x1 + x2) / 2);
  for (const x of xs) for (const y of [MOUNT_INSET, H - MOUNT_INSET]) circle(x, y, MOUNT_D);
  for (const x of [x1 + MOUNT_INSET, x2 - MOUNT_INSET]) circle(x, H / 2, MOUNT_D);
}

// Top band: power · two identical OLED screens (robot, chord) · brand + status
// LEDs · MENU encoder (cols 9–11). The screens are spaced by their boards,
// which are much larger than the visible glass.
const dispY = topY0 + 5, dispMid = dispY + OLED_WIN[1] / 2, dispLabelY = dispY + OLED_WIN[1] + 6;
circle(M + LABEL_W / 2, dispMid - 3, POWER_D);
circle(M + LABEL_W / 2, dispMid + 12, LED_D);
text(M + LABEL_W / 2, dispLabelY, 'POWER', 2.3);

const screen = (col, label, guide) => {
  const x = colX(col) - OLED_WIN[0] / 2;
  rect(x, dispY, OLED_WIN[0], OLED_WIN[1], 2);
  guides.push({ type: 'rect', x: colX(col) - OLED_MODULE[0] / 2, y: dispMid - OLED_MODULE[1] / 2,
    w: OLED_MODULE[0], h: OLED_MODULE[1], role: 'part' });
  guides.push({ type: guide, x: colX(col), y: dispMid });
  text(colX(col), dispLabelY, label, 2.3);
};
const powerEdge = M + LABEL_W / 2 + POWER_D / 2 + 1;               // right edge of the power button + 1 mm
const scr1 = (powerEdge + OLED_MODULE[0] / 2 - gridX0) / P;        // in columns
const scr2 = scr1 + (OLED_MODULE[0] + OLED_GAP) / P;
screen(scr1, 'SYS MONITOR', 'robot');
screen(scr2, 'CHORD DISPLAY', 'seg');

const brandCol = (scr2 + OLED_MODULE[0] / 2 / P + 10.5 - ENCODER_KNOB_R / P) / 2;
text(colX(brandCol), dispMid - 3, 'OMNIHARP', 6.5, 'middle', 'bold');
text(colX(brandCol), dispMid + 2.5, 'CHORD SYNTH · GANWALK', 2.3);
['BEAT', 'MIDI'].forEach((lbl, i) => {
  const x = colX(brandCol - 0.65 + i * 1.3);
  circle(x, dispMid + 10, LED_D);
  text(x, dispLabelY, lbl, 2.2);
});

circle(colX(10.5), dispMid, ENCODER_D);
guides.push({ type: 'circle', cx: colX(10.5), cy: dispMid, r: ENCODER_KNOB_R, role: 'knob' });
text(colX(10.5), dispLabelY, 'MENU · PUSH', 2.3);

// Slider row + function row, by group
const slotTop = sliderY0 + 9;
const slotBottom = slotTop + SLIDER_TRAVEL + SLIDER_SLOT_W;
const sliderLabelY = slotBottom + 6.5;
const fnKeyY = fnY0 + 7 + CAP / 2;

for (const g of GROUPS) {
  const x1 = colX(g.from) + 0.8, x2 = colX(g.to + 1) - 0.8;
  text((x1 + x2) / 2, sliderY0 + 4.5, g.title, 2.3, 'middle', 'bold');

  for (const [col, label] of g.sliders) {
    const x = colX(col);
    cuts.push({ type: 'slot', cx: x, y1: slotTop, y2: slotBottom, w: SLIDER_SLOT_W });
    guides.push({ type: 'rect', x: x - SLIDER_CAP[0] / 2, y: (slotTop + slotBottom) / 2 - SLIDER_CAP[1] / 2,
      w: SLIDER_CAP[0], h: SLIDER_CAP[1], role: 'knob' });
    text(x, sliderLabelY, label, 2.2);
  }

  g.keys.forEach((label, i) => {
    const cx = colX(g.from + i + 0.5);
    rect(cx - KEY_CUT / 2, fnKeyY - KEY_CUT / 2, KEY_CUT, KEY_CUT);
    guides.push({ type: 'rect', x: cx - CAP / 2, y: fnKeyY - CAP / 2, w: CAP, h: CAP, role: 'fnkey' });
    text(cx, fnKeyY - CAP / 2 - 1.6, label, 2.1);
  });
}
// Status LEDs of the two on/off keys, beside their labels
for (const [g, i] of [[GROUPS[1], 2], [GROUPS[2], 2]]) {
  circle(colX(g.from + i + 0.5) + 5.5, fnKeyY - CAP / 2 - 2.4, LED_D - 0.5);
}

// Chord grid: note names on top, row labels on the left (keycaps stay blank)
NOTE_NAMES.forEach((n, i) => text(colX(i + 0.5), headerY0 + 6, n, 3, 'middle', 'bold'));
ROWS.forEach(([label, color], r) => {
  const cy = gridY0 + (r + 0.5) * P;
  text(gridX0 - 4, cy + 1, label, 2.8, 'end', 'bold');
  for (let i = 0; i < 12; i++) {
    const cx = colX(i + 0.5);
    rect(cx - KEY_CUT / 2, cy - KEY_CUT / 2, KEY_CUT, KEY_CUT);
    guides.push({ type: 'rect', x: cx - CAP / 2, y: cy - CAP / 2, w: CAP, h: CAP, role: 'key', fill: color });
  }
});

// Right column: speaker grille on top, strumplate below. The grille is a
// rectangle as wide as the strumplate, so the column reads as one block;
// a rectangular speaker sits under its centre.
const spkY0 = topY0, spkH = strumY0 - 6 - topY0;
const rowStep = GRILLE_PITCH * Math.sqrt(3) / 2;
const nRows = Math.floor((spkH - 2 * GRILLE_INSET - GRILLE_HOLE) / rowStep) + 1;
const nCols = Math.floor((STRUM_W - 2 * GRILLE_INSET - GRILLE_HOLE - GRILLE_PITCH / 2) / GRILLE_PITCH) + 1;
const gy0 = spkY0 + (spkH - (nRows - 1) * rowStep) / 2;
const gx0 = strumX0 + (STRUM_W - (nCols - 1) * GRILLE_PITCH - GRILLE_PITCH / 2) / 2;
for (let r = 0; r < nRows; r++) {
  for (let c = 0; c < nCols; c++) circle(gx0 + c * GRILLE_PITCH + (r % 2 ? GRILLE_PITCH / 2 : 0), gy0 + r * rowStep, GRILLE_HOLE);
}
guides.push({ type: 'rect', x: strumX0 + (STRUM_W - SPEAKER[0]) / 2, y: spkY0 + (spkH - SPEAKER[1]) / 2, w: SPEAKER[0], h: SPEAKER[1], role: 'part' });

rect(strumX0, strumY0, STRUM_W, strumH, 3);
for (let i = 0; i < STRUM_N; i++) {
  const cy = strumY0 + STRUM_PAD + (i + 0.5) * STRUM_PITCH;
  const h = STRUM_PITCH - STRUM_GAP;
  guides.push({ type: 'rect', x: strumX0 + 5, y: cy - h / 2, w: STRUM_W - 10, h, role: 'strip' });
}
text(strumX0 + STRUM_W / 2, strumY0 - 1.6, 'STRUMPLATE · HIGH ▲', 2.2);
text(strumX0 + STRUM_W / 2, H - 4, '▼ LOW', 2.3);

// ── SVG ─────────────────────────────────────────────────────────────────────

const f = n => +n.toFixed(3);
const PAD = 10, TITLE_H = 24;
const OX = PAD + FRAME_CHEEK, OY = PAD + FRAME_SIDE;            // panel origin on the sheet
const SHEET_W = W + 2 * FRAME_CHEEK + 2 * PAD;
const SHEET_H = H + 2 * FRAME_SIDE + 2 * PAD + TITLE_H;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function slotPath({ cx, y1, y2, w }) {
  const r = w / 2;
  return `M${f(cx - r)},${f(y1 + r)} A${r},${r} 0 0 1 ${f(cx + r)},${f(y1 + r)} ` +
    `L${f(cx + r)},${f(y2 - r)} A${r},${r} 0 0 1 ${f(cx - r)},${f(y2 - r)} Z`;
}

function cutSvg(c) {
  if (c.type === 'rect') return `<rect x="${f(c.x)}" y="${f(c.y)}" width="${f(c.w)}" height="${f(c.h)}" rx="${c.r}"/>`;
  if (c.type === 'circle') return `<circle cx="${f(c.cx)}" cy="${f(c.cy)}" r="${f(c.r)}"/>`;
  return `<path d="${slotPath(c)}"/>`;
}

function guideSvg(g, visual) {
  if (g.type === 'robot') {
    return `<text class="robot" x="${f(g.x)}" y="${f(g.y + 1)}">(◉ω◉)</text>` +
      `<text class="robot small" x="${f(g.x)}" y="${f(g.y + 8)}">CHORD!</text>`;
  }
  if (g.type === 'seg') return `<text class="seg" x="${f(g.x)}" y="${f(g.y + 4)}">C#m7</text>`;
  if (g.type === 'line') return `<line class="g-${g.role}" x1="${f(g.x1)}" y1="${f(g.y1)}" x2="${f(g.x2)}" y2="${f(g.y2)}"/>`;
  if (g.type === 'circle') return `<circle class="g-${g.role}" cx="${f(g.cx)}" cy="${f(g.cy)}" r="${g.r}"/>`;
  const fill = visual && g.fill ? ` style="fill:${g.fill}"` : '';
  const r = g.role === 'key' || g.role === 'fnkey' ? 2 : g.role === 'knob' ? 1.5 : 0.5;
  return `<rect class="g-${g.role}" x="${f(g.x)}" y="${f(g.y)}" width="${f(g.w)}" height="${f(g.h)}" rx="${r}"${fill}/>`;
}

function svg(visual) {
  const theme = visual ? `
    .sheet { fill: #1b140d; }
    .wood { fill: #b98a55; stroke: #7a5530; stroke-width: .4; }
    .panel { fill: #111; }
    .cut { fill: #050505; stroke: #333; stroke-width: .2; }
    .silk { fill: #eee; }
    .g-key, .g-fnkey { stroke: #000; stroke-width: .3; }
    .g-fnkey { fill: #3a3a3a; }
    .g-knob { fill: #c49a62; stroke: #6b4a26; stroke-width: .3; }
    .g-strip { fill: #d4b048; }
    .g-part, .g-seam { fill: none; stroke: none; }
    .robot, .seg { fill: #00e060; }
    .title, .scale { fill: #d8c7a8; stroke: none; }
    .scale-line { stroke: #d8c7a8; }` : `
    .sheet { fill: #fff; }
    .wood { fill: none; stroke: #a0703c; stroke-width: .3; stroke-dasharray: 3 2; }
    .panel { fill: none; }
    .cut { fill: none; stroke: #e00000; stroke-width: .2; }
    .silk { fill: #000; }
    .g-key, .g-fnkey, .g-knob, .g-strip, .g-part { fill: none; stroke: #999; stroke-width: .15; stroke-dasharray: 1 .8; }
    .g-seam { stroke: #08f; stroke-width: .3; stroke-dasharray: 4 2; }
    .robot, .seg { fill: #7a9; }
    .title, .scale { fill: #000; }
    .scale-line { stroke: #000; }`;

  const scaleY = OY + H + FRAME_SIDE + 10;
  const ticks = Array.from({ length: 11 }, (_, i) =>
    `<line class="scale-line" x1="${OX + i * 10}" y1="${scaleY}" x2="${OX + i * 10}" y2="${scaleY - (i % 5 ? 2 : 4)}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(SHEET_W)}mm" height="${f(SHEET_H)}mm" viewBox="0 0 ${f(SHEET_W)} ${f(SHEET_H)}">
<style>
  text { font-family: 'DejaVu Sans', Arial, sans-serif; }
  .silk { text-anchor: middle; }
  .robot, .seg { text-anchor: middle; font-family: 'DejaVu Sans Mono', 'Courier New', monospace; font-weight: bold; }
  .robot { font-size: 7px; } .robot.small { font-size: 3px; letter-spacing: .8px; } .seg { font-size: 11px; letter-spacing: 1px; }
  .title { font-size: 3.2px; } .scale { font-size: 2.6px; }
  .scale-line { stroke-width: .3; }
  ${theme}
</style>
<rect class="sheet" x="0" y="0" width="${f(SHEET_W)}" height="${f(SHEET_H)}"/>
<rect class="wood" x="${PAD}" y="${PAD}" width="${f(W + 2 * FRAME_CHEEK)}" height="${f(H + 2 * FRAME_SIDE)}" rx="${visual ? 4 : 0}"/>
<g transform="translate(${OX} ${OY})">
  <rect class="panel" x="0" y="0" width="${f(W)}" height="${f(H)}"/>
  <g class="cut">${cuts.slice(1).map(cutSvg).join('\n')}</g>
  <g class="guides">${guides.map(g => guideSvg(g, visual)).join('\n')}</g>
  <rect class="cut" x="0" y="0" width="${f(W)}" height="${f(H)}" style="fill:none"/>
  <g>${texts.map(t => `<text class="silk" x="${f(t.x)}" y="${f(t.y)}" style="font-size:${t.s}px;text-anchor:${t.anchor};font-weight:${t.weight}">${esc(t.t)}</text>`).join('\n')}</g>
</g>
<line class="scale-line" x1="${OX}" y1="${scaleY}" x2="${OX + 100}" y2="${scaleY}"/>${ticks}
<text class="scale" x="${OX}" y="${scaleY + 4}">100 mm — measure to confirm the print is at 100%</text>
<text class="title" x="${OX + W}" y="${scaleY}" text-anchor="end">OmniHarp · top panel ${f(W)} × ${f(H)} mm · with wood frame ${f(W + 2 * FRAME_CHEEK)} × ${f(H + 2 * FRAME_SIDE)} mm</text>
<text class="title" x="${OX + W}" y="${scaleY + 5}" text-anchor="end">${visual ? 'visual preview' : 'red = cut · black = silkscreen · grey dashed = parts · blue dashed = seam between the two panel parts · brown = wood frame'} · draft</text>
</svg>
`;
}

// ── DXF (R12, cut lines only, y up) ─────────────────────────────────────────

function dxf() {
  const out = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES'];
  const Y = y => f(H - y);
  const line = (x1, y1, x2, y2) => out.push('0', 'LINE', '8', 'CORTE', '10', f(x1), '20', Y(y1), '30', '0', '11', f(x2), '21', Y(y2), '31', '0');
  // Angles in DXF space (y up, counter-clockwise).
  const arc = (cx, cy, r, a1, a2) => out.push('0', 'ARC', '8', 'CORTE', '10', f(cx), '20', Y(cy), '30', '0', '40', f(r), '50', a1, '51', a2);

  for (const c of cuts) {
    if (c.type === 'circle') { out.push('0', 'CIRCLE', '8', 'CORTE', '10', f(c.cx), '20', Y(c.cy), '30', '0', '40', f(c.r)); continue; }
    if (c.type === 'slot') {
      const r = c.w / 2;
      line(c.cx - r, c.y1 + r, c.cx - r, c.y2 - r);
      line(c.cx + r, c.y1 + r, c.cx + r, c.y2 - r);
      arc(c.cx, c.y1 + r, r, 0, 180);   // top end (higher y in DXF)
      arc(c.cx, c.y2 - r, r, 180, 360); // bottom end
      continue;
    }
    const { x, y, w, h, r } = c;
    line(x + r, y, x + w - r, y);
    line(x + r, y + h, x + w - r, y + h);
    line(x, y + r, x, y + h - r);
    line(x + w, y + r, x + w, y + h - r);
    if (r > 0) {
      arc(x + r, y + r, r, 90, 180);          // top-left
      arc(x + w - r, y + r, r, 0, 90);        // top-right
      arc(x + w - r, y + h - r, r, 270, 360); // bottom-right
      arc(x + r, y + h - r, r, 180, 270);     // bottom-left
    }
  }
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n') + '\n';
}

// ── PDFs and PNG via the pre-installed Playwright Chromium ──────────────────

async function render(corteSvg, visualSvg) {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch {
    console.warn('Playwright not found: skipping PDF/PNG (SVG and DXF are ready).');
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const inner = corteSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

  // A2 landscape, one sheet
  await page.setContent(`<style>@page{size:594mm 420mm;margin:0}body{margin:0}</style>
    <div style="width:594mm;height:420mm;display:flex;align-items:center;justify-content:center">${corteSvg}</div>`);
  await page.pdf({ path: path.join(OUT, 'painel-A2.pdf'), width: '594mm', height: '420mm', printBackground: true });

  // A4 landscape tiles with 10 mm overlap and alignment marks
  const TW = 277, TH = 190, OV = 10;
  const cols = Math.ceil((SHEET_W - OV) / (TW - OV)), rows = Math.ceil((SHEET_H - OV) / (TH - OV));
  let pages = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * (TW - OV), y = r * (TH - OV);
    pages += `<section><svg xmlns="http://www.w3.org/2000/svg" width="${TW}mm" height="${TH}mm" viewBox="${x} ${y} ${TW} ${TH}">${inner}
      <rect x="${x + .2}" y="${y + .2}" width="${TW - .4}" height="${TH - .4}" fill="none" stroke="#08f" stroke-width=".3" stroke-dasharray="4 2"/>
      </svg><p>Sheet ${r * cols + c + 1}/${rows * cols} · row ${r + 1}, column ${c + 1} · neighbouring sheets overlap by ${OV} mm (blue dashed edge) · print at 100% / actual size</p></section>`;
  }
  await page.setContent(`<style>@page{size:297mm 210mm;margin:0}body{margin:0;font:9px sans-serif}
    section{width:297mm;height:210mm;padding:6mm 10mm 0;box-sizing:border-box;page-break-after:always}p{margin:1mm 0 0}</style>${pages}`);
  await page.pdf({ path: path.join(OUT, 'painel-A4.pdf'), width: '297mm', height: '210mm', printBackground: true });

  // PNG preview of the visual version
  const pxPerMm = 3;
  await page.setViewportSize({ width: Math.ceil(SHEET_W * pxPerMm), height: Math.ceil(SHEET_H * pxPerMm) });
  await page.setContent(`<style>body{margin:0}svg{width:${SHEET_W * pxPerMm}px;height:${SHEET_H * pxPerMm}px;display:block}</style>${visualSvg}`);
  await page.screenshot({ path: path.join(OUT, 'painel-visual.png') });
  await browser.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const corte = svg(false), visual = svg(true);
  fs.writeFileSync(path.join(OUT, 'painel-corte.svg'), corte);
  fs.writeFileSync(path.join(OUT, 'painel-visual.svg'), visual);
  fs.writeFileSync(path.join(OUT, 'painel-corte.dxf'), dxf());
  await render(corte, visual);
  console.log(`Panel ${f(W)} × ${f(H)} mm (with wood frame ${f(W + 2 * FRAME_CHEEK)} × ${f(H + 2 * FRAME_SIDE)} mm)`);
  console.log(`${cuts.length} cut shapes · outputs in ${path.relative(process.cwd(), OUT) || OUT}`);
})();
