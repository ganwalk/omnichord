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
// Layout: the strumplate is a full-height column on the right, strings
// running across it and stacked front to back (low strings nearest the
// player, as in the app's portrait layout). Everything else lives in the
// area to its left, top to bottom:
//   top band     power · brand · SYS MONITOR (robot) · CHORD DISPLAY · status LEDs
//   slider band  mixer · octave · rhythm · arpeggiator · MENU encoder
//   function row 12 keys aligned with the grid columns
//   chord grid   note names + 6 × 12 keys, speaker grille to its right

const M = 12;              // panel margin
const P = 19.05;           // key pitch (MX standard)
const KEY_CUT = 14;        // MX plate cut-out (square)
const CAP = 18;            // keycap footprint, guide only (DSA/XDA ≈ 18 mm)
const LABEL_W = 30;        // column left of the grid for row labels
const LEFT_W = 345;        // right edge of the controls area
const GAP = 16;            // between the controls area and the strumplate

const STRUM_N = 24;        // strings (theory.ts STRING_COUNT)
const STRUM_W = 110;       // strumplate window width (string length)
const STRUM_GAP = 3.5;     // gap between neighbouring copper strips (guide)
const STRUM_PAD = 4;       // window margin around the strips

const TOP_H = 70;          // band with power, brand, displays, LEDs
const SLIDER_H = 75;       // band with sliders, octave switch, encoder
const FN_H = 28;           // row of function keys (label + key)
const HEADER_H = 8;        // note names above the grid

const SLIDER_TRAVEL = 45;  // CHECK: slide pot travel
const SLIDER_SLOT_W = 3;   // CHECK: lever width + clearance
const SLIDER_CAP = [10, 18]; // CHECK: slider knob footprint (guide)

const OLED_WIN = [58, 31];     // CHECK: 2.42" SSD1309 visible area + 1 mm
const SEG_WIN = [102, 21];     // CHECK: 2 × 0.54" quad 14-segment displays side by side
const POWER_D = 16;            // CHECK: power push button
const LED_D = 3;               // status LEDs (light through the panel)
const TOGGLE_D = 6.4;          // CHECK: mini toggle switch thread (1/4")
const ENCODER_D = 7;           // CHECK: rotary encoder thread
const SPEAKER_R = 30;          // grille radius (3" speaker)
const GRILLE_HOLE = 3.5;
const GRILLE_PITCH = 6;

const FRAME_SIDE = 15;     // visible wood, front and back rails (guide)
const FRAME_CHEEK = 30;    // visible wood, end cheeks (guide)

// From the app (src/theory.ts) so the panel matches the screen.
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const ROWS = [
  ['Major', '#4a8a5a'], ['Minor', '#5080b0'], ['7th', '#a06050'],
  ['m7', '#806098'], ['Maj7', '#407090'], ['Dim7', '#8a7030'],
];
const FUNCTIONS = ['PLAY', '◀ RHYTHM', 'RHYTHM ▶', 'TAP', 'ARP', '◀ MODE', 'MODE ▶', 'KEY', 'MUTE', 'SHIFT', 'F1', 'F2'];

// ── Derived layout ──────────────────────────────────────────────────────────

const gridX0 = M + LABEL_W;
const gridW = 12 * P;
const strumX0 = LEFT_W + GAP;
const W = strumX0 + STRUM_W + M;

const topY0 = M;
const sliderY0 = topY0 + TOP_H;
const fnY0 = sliderY0 + SLIDER_H;
const headerY0 = fnY0 + FN_H;
const gridY0 = headerY0 + HEADER_H;
const H = gridY0 + 6 * P + M;

const strumY0 = M, strumH = H - 2 * M;
const STRUM_PITCH = (strumH - 2 * STRUM_PAD) / STRUM_N;

// ── Geometry collection ─────────────────────────────────────────────────────
// Shapes are in panel coordinates (origin top-left, y down).

const cuts = [];    // {type:'rect', x,y,w,h,r} | {type:'circle', cx,cy,r} | {type:'slot', cx,y1,y2,w}
const texts = [];   // {x,y,s,t,anchor,weight}
const guides = [];  // {type:'rect'|'circle'|'robot'|'seg', ..., role, fill}

const rect = (x, y, w, h, r = 0) => cuts.push({ type: 'rect', x, y, w, h, r });
const circle = (cx, cy, d) => cuts.push({ type: 'circle', cx, cy, r: d / 2 });
const text = (x, y, t, s = 2.6, anchor = 'middle', weight = 'normal') =>
  texts.push({ x, y, t, s, anchor, weight });

// Panel outline
rect(0, 0, W, H);

// Top band: power, brand, robot screen, chord display, status LEDs
const midTop = topY0 + TOP_H / 2;
circle(M + 16, midTop - 6, POWER_D);
circle(M + 16, midTop + 16, LED_D + 2);
text(M + 16, midTop + 26, 'POWER', 2.4);

const brandX = M + 38;
text(brandX, midTop - 9, 'GANWALK', 2.6, 'start');
text(brandX, midTop + 2, 'OMNIHARP', 7.5, 'start', 'bold');
text(brandX, midTop + 9, 'CHORD SYNTH', 2.6, 'start');

const oledX = 112, oledY = midTop - OLED_WIN[1] / 2 - 4;
rect(oledX, oledY, OLED_WIN[0], OLED_WIN[1], 2);
guides.push({ type: 'rect', x: oledX - 2, y: oledY - 4, w: OLED_WIN[0] + 4, h: OLED_WIN[1] + 8, role: 'part' });
text(oledX + OLED_WIN[0] / 2, oledY + OLED_WIN[1] + 6, 'SYS MONITOR', 2.4);
guides.push({ type: 'robot', x: oledX + OLED_WIN[0] / 2, y: oledY + OLED_WIN[1] / 2 });

const segX = oledX + OLED_WIN[0] + 12, segY = midTop - SEG_WIN[1] / 2 - 4;
rect(segX, segY, SEG_WIN[0], SEG_WIN[1], 1.5);
text(segX + SEG_WIN[0] / 2, oledY + OLED_WIN[1] + 6, 'CHORD DISPLAY', 2.4);
guides.push({ type: 'seg', x: segX + SEG_WIN[0] / 2, y: segY + SEG_WIN[1] / 2 });

['PLAY', 'ARP', 'BEAT', 'MIDI'].forEach((lbl, i) => {
  const x = segX + SEG_WIN[0] + 16 + (i % 2) * 20;
  const y = midTop - 14 + Math.floor(i / 2) * 18;
  circle(x, y, LED_D);
  text(x, y + 6.5, lbl, 2.2);
});

// Slider band: mixer, octave, rhythm, arp, MENU encoder
const slotTop = sliderY0 + 10;
const slotBottom = slotTop + SLIDER_TRAVEL + SLIDER_SLOT_W;
const sliderLabelY = sliderY0 + SLIDER_H - 5;
const slider = (x, label) => {
  cuts.push({ type: 'slot', cx: x, y1: slotTop, y2: slotBottom, w: SLIDER_SLOT_W });
  guides.push({ type: 'rect', x: x - SLIDER_CAP[0] / 2, y: (slotTop + slotBottom) / 2 - SLIDER_CAP[1] / 2,
    w: SLIDER_CAP[0], h: SLIDER_CAP[1], role: 'knob' });
  text(x, sliderLabelY, label, 2.3);
};
const groupLabel = (x1, x2, label) => text((x1 + x2) / 2, sliderY0 + 5, label, 2.2, 'middle', 'bold');

const mixer = ['MASTER', 'CHORD', 'STRUM', 'TONE', 'REVERB', 'GLIDE'];
const sx = i => M + 14 + i * 22;
mixer.forEach((l, i) => slider(sx(i), l));
groupLabel(sx(0), sx(5), 'MIXER');

const octX = sx(5) + 26;
circle(octX, (slotTop + slotBottom) / 2, TOGGLE_D);
text(octX, slotTop + 6, '+1', 2.4);
text(octX + 7, (slotTop + slotBottom) / 2 + 1, '0', 2.4);
text(octX, slotBottom - 3, '−1', 2.4);
text(octX, sliderLabelY, 'OCTAVE', 2.3);

const rx = octX + 28;
slider(rx, 'TEMPO');
slider(rx + 22, 'RHYTHM');
groupLabel(rx, rx + 22, 'RHYTHM');
slider(rx + 50, 'SPEED');
slider(rx + 72, 'ARP VOL');
groupLabel(rx + 50, rx + 72, 'ARPEGGIATOR');

const encX = (rx + 72 + LEFT_W) / 2 + 4, encY = (slotTop + slotBottom) / 2;
circle(encX, encY, ENCODER_D);
guides.push({ type: 'circle', cx: encX, cy: encY, r: 12.5, role: 'knob' });
text(encX, sliderLabelY, 'MENU', 2.3);

// Function row: one key per grid column, label above (keycaps stay blank)
FUNCTIONS.forEach((lbl, i) => {
  const cx = gridX0 + (i + 0.5) * P, cy = fnY0 + 6 + CAP / 2;
  rect(cx - KEY_CUT / 2, cy - KEY_CUT / 2, KEY_CUT, KEY_CUT);
  guides.push({ type: 'rect', x: cx - CAP / 2, y: cy - CAP / 2, w: CAP, h: CAP, role: 'fnkey' });
  text(cx, fnY0 + 4, lbl, 2.1);
});

// Chord grid: note names on top, row labels on the left
NOTE_NAMES.forEach((n, i) => text(gridX0 + (i + 0.5) * P, headerY0 + 5.5, n, 3, 'middle', 'bold'));
ROWS.forEach(([label, color], r) => {
  const cy = gridY0 + (r + 0.5) * P;
  text(gridX0 - 4, cy + 1, label, 2.8, 'end', 'bold');
  for (let i = 0; i < 12; i++) {
    const cx = gridX0 + (i + 0.5) * P;
    rect(cx - KEY_CUT / 2, cy - KEY_CUT / 2, KEY_CUT, KEY_CUT);
    guides.push({ type: 'rect', x: cx - CAP / 2, y: cy - CAP / 2, w: CAP, h: CAP, role: 'key', fill: color });
  }
});

// Speaker grille, between the grid and the strumplate
const spkX = (gridX0 + gridW + LEFT_W) / 2, spkY = (fnY0 + H - M) / 2;
for (let row = -10; row <= 10; row++) {
  const y = spkY + row * GRILLE_PITCH * Math.sqrt(3) / 2;
  for (let col = -10; col <= 10; col++) {
    const x = spkX + col * GRILLE_PITCH + (row % 2 ? GRILLE_PITCH / 2 : 0);
    if (Math.hypot(x - spkX, y - spkY) <= SPEAKER_R - GRILLE_HOLE / 2) circle(x, y, GRILLE_HOLE);
  }
}

// Strumplate: full-height column, strings stacked top (high) to bottom (low)
rect(strumX0, strumY0, STRUM_W, strumH, 3);
for (let i = 0; i < STRUM_N; i++) {
  const cy = strumY0 + STRUM_PAD + (i + 0.5) * STRUM_PITCH;
  const h = STRUM_PITCH - STRUM_GAP;
  guides.push({ type: 'rect', x: strumX0 + 5, y: cy - h / 2, w: STRUM_W - 10, h, role: 'strip' });
}
text(strumX0 + STRUM_W / 2, M - 3.5, 'STRUMPLATE · HIGH ▲', 2.3);
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
  if (g.type === 'seg') return `<text class="seg" x="${f(g.x)}" y="${f(g.y + 3.2)}">C#m7</text>`;
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
    .g-part { fill: none; stroke: none; }
    .robot, .seg { fill: #00e060; }
    .title, .scale { fill: #d8c7a8; stroke: none; }
    .scale-line { stroke: #d8c7a8; }` : `
    .sheet { fill: #fff; }
    .wood { fill: none; stroke: #a0703c; stroke-width: .3; stroke-dasharray: 3 2; }
    .panel { fill: none; }
    .cut { fill: none; stroke: #e00000; stroke-width: .2; }
    .silk { fill: #000; }
    .g-key, .g-fnkey, .g-knob, .g-strip, .g-part { fill: none; stroke: #999; stroke-width: .15; stroke-dasharray: 1 .8; }
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
  .robot { font-size: 7px; } .robot.small { font-size: 3px; letter-spacing: .8px; } .seg { font-size: 10px; letter-spacing: 2px; }
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
<text class="title" x="${OX + W}" y="${scaleY + 5}" text-anchor="end">${visual ? 'visual preview' : 'red = cut · black = silkscreen · grey dashed = parts under/over the panel · brown = wood frame'} · draft</text>
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
