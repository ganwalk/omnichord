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

/** The twin's screens, photographed by hardware/3d/capturar-telas.mjs (if they exist). */
const screenShot = name => {
  const file = path.join(OUT, name);
  return fs.existsSync(file) ? 'data:image/png;base64,' + fs.readFileSync(file).toString('base64') : null;
};
const SHOTS = { robot: screenShot('tela-robo.png'), seg: screenShot('tela-acorde.png') };
const STATE = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(OUT, 'estado.json'), 'utf8')); } catch { return null; }
})();

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
// Pads: one translucent silicone keypad under the panel, each pad poking up
// through its own hole, lit from below by an RGB LED (SPD / Launchpad style).
const CAP = 17;            // CHECK: pad face, square with rounded corners
const PAD_H = 4;           // CHECK: pad height above the panel (shallow, like a drum-pad controller)
const KEY_CUT = 17.6;      // panel hole: pad + 0.3 mm all round
const KEY_CUT_R = 2.2;     // hole corner radius
const LABEL_W = 30;        // column left of the grid: power button, row labels
const GAP = 24;            // between the left zone and the right column: room for the seam rail underneath

const STRUM_N = 24;        // strings (theory.ts STRING_COUNT)
const STRUM_W = 110;       // strumplate window width (string length)
const STRUM_GAP = 3;       // gap between neighbouring copper strips (guide)
const STRUM_PAD = 4;       // window margin around the strips

const TOP_H = 60;          // displays band (and speaker, on the right)
const SLIDER_H = 79;       // slider row (the knobs overhang the slot ends by half their height)
const FN_H = 30;           // function row (label + key)
const HEADER_H = 9;        // note names above the grid

const SLIDER_TRAVEL = 45;  // CHECK: slide pot travel
const SLIDER_SLOT_W = 3;   // CHECK: lever width + clearance
const SLIDER_CAP = [10, 18]; // CHECK: slider knob footprint (guide)

// Two identical 2.4" IPS colour screens, 320 × 240 (ST7789 or ILI9341), landscape.
const SCREEN_ACTIVE = [48.96, 36.72]; // CHECK: lit area of the 2.4" panel
const SCREEN_WIN = [51, 39];          // window in the panel: lit area + ~1 mm all round
const SCREEN_MODULE = [77, 43];       // CHECK: the module's circuit board behind the panel (sets the spacing)
const SCREEN_GAP = 3;                 // between the two modules' boards
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

// Wood frame and enclosure. The panel drops into the frame and sits 1.5 mm
// below its top edge, resting and screwed on cleats glued inside the walls.
const FRAME_T = 20;        // board thickness = visible wood width, the same on all four sides
const FRAME_H = 55;        // CHECK: frame height; sets the room under the panel
const BASE_T = 9;          // plywood base, set into a rebate at the bottom of the frame
const PANEL_T = 1.6;       // FR4 panel (the MDF mock-up is 3 mm)
const PANEL_RECESS = 1.5;  // panel top below the wood's top edge
const CLEAT = [10, 15];    // cleat width (under the panel edge) × height
const RAIL_W = 16;         // cross rail under the seam between the two panel parts
const INNER_H = FRAME_H - PANEL_RECESS - PANEL_T - BASE_T; // room between the base and the panel

// From the app (src/theory.ts) so the panel matches the screen.
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const ROWS = [
  ['Major', '#4a8a5a'], ['Minor', '#5080b0'], ['7th', '#a06050'],
  ['m7', '#806098'], ['Maj7', '#407090'], ['Dim7', '#8a7030'],
];

// Control groups, by key column. Sliders sit on column centres or, in the
// 3-column groups, on the lines between columns so the pair stays centred.
// The on/off key of each group is its rightmost key, nearest the strumming hand.
// TAP sits right beside the rhythm keys; its LED blinks on the beat.
const GROUPS = [
  { title: 'MIXER', from: 0, to: 5,
    sliders: [[0.5, 'MASTER', 'master'], [1.5, 'CHORD', 'chordVol'], [2.5, 'STRUM', 'strumVol'],
      [3.5, 'TONE', 'tone'], [4.5, 'REVERB', 'reverb'], [5.5, 'GLIDE', 'glide']],
    keys: [['SHIFT', 'shift'], ['MUTE', 'mute'], ['KEY', 'key'], ['OCT −', 'octDown'], ['OCT +', 'octUp'], ['TAP', 'tap']] },
  { title: 'RHYTHM', from: 6, to: 8,
    sliders: [[7, 'TEMPO', 'bpm'], [8, 'VOLUME', 'rhythmVol']],
    keys: [['◀ STYLE', 'stylePrev'], ['STYLE ▶', 'styleNext'], ['PLAY', 'play']] },
  { title: 'ARPEGGIATOR', from: 9, to: 11,
    sliders: [[10, 'SPEED', 'arpSpeed'], [11, 'VOLUME', 'arpVol']],
    keys: [['◀ MODE', 'modePrev'], ['MODE ▶', 'modeNext'], ['ARP', 'arp']] },
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
const text = (x, y, t, s = 2.6, anchor = 'middle', weight = 'normal', spacing = 0) =>
  texts.push({ x, y, t, s, anchor, weight, spacing });

// What every control is, for the digital twin (src/twin/), written to out/layout.json.
const twin = { keys: [], fnKeys: [], sliders: [], screens: [], leds: [], grille: [], mounts: [] };

// Panel outline, seam between the two panel parts, mounting holes
rect(0, 0, W, H);
guides.push({ type: 'line', x1: seamX, y1: 0, x2: seamX, y2: H, role: 'seam' });
for (const [x1, x2] of [[0, seamX], [seamX, W]]) {
  const xs = [x1 + MOUNT_INSET, x2 - MOUNT_INSET];
  if (x2 - x1 > 200) xs.push((x1 + x2) / 2);
  for (const x of xs) for (const y of [MOUNT_INSET, H - MOUNT_INSET]) { circle(x, y, MOUNT_D); twin.mounts.push([x, y]); }
  for (const x of [x1 + MOUNT_INSET, x2 - MOUNT_INSET]) { circle(x, H / 2, MOUNT_D); twin.mounts.push([x, H / 2]); }
}

// Top band: power · two identical colour screens (robot, chord) · OMNIHARP
// wordmark · MENU encoder. The screens are spaced by their boards,
// which are much larger than the visible glass.
const dispY = topY0 + 5, dispMid = dispY + SCREEN_WIN[1] / 2, dispLabelY = dispY + SCREEN_WIN[1] + 6;
circle(M + LABEL_W / 2, dispMid - 3, POWER_D);
circle(M + LABEL_W / 2, dispMid + 12, LED_D);
text(M + LABEL_W / 2, dispLabelY, 'POWER', 2.3);
twin.power = { x: M + LABEL_W / 2, y: dispMid - 3, d: POWER_D };
twin.leds.push({ id: 'power', x: M + LABEL_W / 2, y: dispMid + 12, d: LED_D });

const screen = (col, label, guide) => {
  const x = colX(col) - SCREEN_WIN[0] / 2;
  rect(x, dispY, SCREEN_WIN[0], SCREEN_WIN[1], 2);
  guides.push({ type: 'rect', x: colX(col) - SCREEN_MODULE[0] / 2, y: dispMid - SCREEN_MODULE[1] / 2,
    w: SCREEN_MODULE[0], h: SCREEN_MODULE[1], role: 'part' });
  guides.push({ type: guide, x: colX(col), y: dispMid });
  text(colX(col), dispLabelY, label, 2.3);
  twin.screens.push({ id: guide === 'robot' ? 'robot' : 'chord', x, y: dispY, w: SCREEN_WIN[0], h: SCREEN_WIN[1], aw: SCREEN_ACTIVE[0], ah: SCREEN_ACTIVE[1] });
};
const powerEdge = M + LABEL_W / 2 + POWER_D / 2 + 3;               // power button body + 2 mm clearance
const scr1 = (powerEdge + SCREEN_MODULE[0] / 2 - gridX0) / P;        // in columns
const scr2 = scr1 + (SCREEN_MODULE[0] + SCREEN_GAP) / P;
screen(scr1, 'SYS MONITOR', 'robot');
screen(scr2, 'CHORD DISPLAY', 'seg');

// Encoder flush with the right edge of the grid; the wordmark alone, centred
// in the space between the chord display and the encoder.
const encX = colX(12) - ENCODER_KNOB_R;
circle(encX, dispMid, ENCODER_D);
guides.push({ type: 'circle', cx: encX, cy: dispMid, r: ENCODER_KNOB_R, role: 'knob' });
text(encX, dispLabelY, 'MENU · PUSH', 2.3);
twin.encoder = { x: encX, y: dispMid, r: ENCODER_KNOB_R };

const brandX = (colX(scr2) + SCREEN_WIN[0] / 2 + encX - ENCODER_KNOB_R) / 2;
text(brandX, dispMid + 2.4, 'OMNIHARP', 6.5, 'middle', '900', 0.8);

// Slider row + function row, by group
// The knob overhangs the slot ends by half its height: keep the group title
// above it and the label below it, at both ends of the travel.
const slotTop = sliderY0 + 6.5 + SLIDER_CAP[1] / 2;
const slotBottom = slotTop + SLIDER_TRAVEL + SLIDER_SLOT_W;
const sliderLabelY = slotBottom - SLIDER_SLOT_W / 2 + SLIDER_CAP[1] / 2 + 4;
const fnKeyY = fnY0 + 7 + CAP / 2;

for (const g of GROUPS) {
  const x1 = colX(g.from) + 0.8, x2 = colX(g.to + 1) - 0.8;
  text((x1 + x2) / 2, sliderY0 + 4.5, g.title, 2.3, 'middle', 'bold');
  // Tempo pulse LED beside the RHYTHM title (MIDI activity shows on the SYS MONITOR)

  for (const [col, label, setting] of g.sliders) {
    const x = colX(col);
    cuts.push({ type: 'slot', cx: x, y1: slotTop, y2: slotBottom, w: SLIDER_SLOT_W });
    guides.push({ type: 'rect', x: x - SLIDER_CAP[0] / 2, y: (slotTop + slotBottom) / 2 - SLIDER_CAP[1] / 2,
      w: SLIDER_CAP[0], h: SLIDER_CAP[1], role: 'knob' });
    text(x, sliderLabelY, label, 2.2);
    twin.sliders.push({ setting, x, y1: slotTop + SLIDER_SLOT_W / 2, y2: slotBottom - SLIDER_SLOT_W / 2 });
  }

  g.keys.forEach(([label, action], i) => {
    const cx = colX(g.from + i + 0.5);
    rect(cx - KEY_CUT / 2, fnKeyY - KEY_CUT / 2, KEY_CUT, KEY_CUT, KEY_CUT_R);
    guides.push({ type: 'rect', x: cx - CAP / 2, y: fnKeyY - CAP / 2, w: CAP, h: CAP, role: 'fnkey' });
    text(cx, fnKeyY - CAP / 2 - 1.6, label, 2.1);
    twin.fnKeys.push({ action, x: cx, y: fnKeyY });
  });
}
// LEDs beside the labels of PLAY, ARP (on/off) and TAP (blinks on the beat)
for (const [g, i, id] of [[GROUPS[0], 5, 'beat'], [GROUPS[1], 2, 'play'], [GROUPS[2], 2, 'arp']]) {
  circle(colX(g.from + i + 0.5) + 5.5, fnKeyY - CAP / 2 - 2.4, LED_D - 0.5);
  twin.leds.push({ id, x: colX(g.from + i + 0.5) + 5.5, y: fnKeyY - CAP / 2 - 2.4, d: LED_D - 0.5 });
}

// Chord grid: note names on top, row labels on the left (keycaps stay blank)
NOTE_NAMES.forEach((n, i) => text(colX(i + 0.5), headerY0 + 6, n, 3, 'middle', 'bold'));
ROWS.forEach(([label, color], r) => {
  const cy = gridY0 + (r + 0.5) * P;
  text(gridX0 - 4, cy + 1, label, 2.8, 'end', 'bold');
  for (let i = 0; i < 12; i++) {
    const cx = colX(i + 0.5);
    rect(cx - KEY_CUT / 2, cy - KEY_CUT / 2, KEY_CUT, KEY_CUT, KEY_CUT_R);
    const lit = STATE?.chord?.type === r && STATE?.chord?.root === i;   // the pad the twin is playing
    guides.push({ type: 'rect', x: cx - CAP / 2, y: cy - CAP / 2, w: CAP, h: CAP, role: 'key', fill: color, lit });
    twin.keys.push({ type: r, root: i, x: cx, y: cy, color });
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
  for (let c = 0; c < nCols; c++) {
    const x = gx0 + c * GRILLE_PITCH + (r % 2 ? GRILLE_PITCH / 2 : 0), y = gy0 + r * rowStep;
    circle(x, y, GRILLE_HOLE);
    twin.grille.push([x, y]);
  }
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
twin.strum = { x: strumX0, y: strumY0, w: STRUM_W, h: strumH, n: STRUM_N, pad: STRUM_PAD, pitch: STRUM_PITCH, gap: STRUM_GAP };

// ── What sits under the panel ───────────────────────────────────────────────
// Boxes in panel coordinates (x, y as above) and height z above the base
// (0 = top of the base, INNER_H = underside of the panel). Sizes are typical
// for the parts named in the README; the CHECK values decide the real fit.

const parts = [];  // {name, label, x, y, w, d, z0, z1, kind, on}
/** `on`: the part it is mounted on (they touch on purpose). `label`: name in Portuguese, for the 3D view. */
const part = (name, x, y, w, d, z0, z1, kind = 'elec', label = name, on = null) =>
  parts.push({ name, label, x, y, w, d, z0, z1, kind, on });
const UNDER = INNER_H;     // panel underside

// Wood: cleats along the four walls, rail under the seam
part('Cleat, back', 0, 0, W, CLEAT[0], UNDER - CLEAT[1], UNDER, 'wood', 'Sarrafo (trás)');
part('Cleat, front', 0, H - CLEAT[0], W, CLEAT[0], UNDER - CLEAT[1], UNDER, 'wood', 'Sarrafo (frente)');
part('Cleat, left', 0, CLEAT[0], CLEAT[0], H - 2 * CLEAT[0], UNDER - CLEAT[1], UNDER, 'wood', 'Sarrafo (esquerda)');
part('Cleat, right', W - CLEAT[0], CLEAT[0], CLEAT[0], H - 2 * CLEAT[0], UNDER - CLEAT[1], UNDER, 'wood', 'Sarrafo (direita)');
part('Seam rail', seamX - RAIL_W / 2, CLEAT[0], RAIL_W, H - 2 * CLEAT[0], UNDER - CLEAT[1], UNDER, 'wood', 'Travessa sob a emenda do painel');

// Hanging from the panel
part('Power button', M + LABEL_W / 2 - 9, dispMid - 3 - 9, 18, 18, UNDER - 28, UNDER, 'elec', 'Botão liga/desliga (com LED)');
const scrX0 = colX(scr1) - SCREEN_MODULE[0] / 2;
part('Display board', scrX0, dispMid - SCREEN_MODULE[1] / 2 - 2, encX + 12 - scrX0, SCREEN_MODULE[1] + 4, UNDER - 17.6, UNDER - 16, 'board',
  'Placa das telas e do encoder');
for (const [col, name, label] of [[scr1, 'Screen (robot)', 'Tela 2,4" (robô)'], [scr2, 'Screen (chord)', 'Tela 2,4" (acorde)']]) {
  part(name, colX(col) - SCREEN_MODULE[0] / 2, dispMid - SCREEN_MODULE[1] / 2, SCREEN_MODULE[0], SCREEN_MODULE[1], UNDER - 14, UNDER, 'elec', label, 'Display board');
}
part('Encoder', encX - 7, dispMid - 7, 14, 14, UNDER - 15, UNDER, 'elec', 'Encoder MENU (porca no painel)', 'Display board');
part('Slider board', gridX0 - 3, slotTop - 9, gridW + 5, slotBottom - slotTop + 18, UNDER - 16, UNDER, 'board', 'Placa dos sliders (10)');
part('Pad board (84 pads)', gridX0 - 3, fnKeyY - 11, gridW + 5, gridY0 + 6 * P + 1 - (fnKeyY - 11), UNDER - 5, UNDER, 'board',
  'Pads de silicone + placa com contatos e LEDs RGB');
part('Strumplate + acrylic', strumX0 - 1, strumY0 - 1, STRUM_W + 2, strumH + 2, UNDER - 3, UNDER, 'board', 'Strumplate (placa) + acrílico');
part('MPR121 #1', strumX0 + 4, strumY0 + strumH / 3 - 10, 26, 20, UNDER - 15, UNDER - 3, 'elec', 'Sensor MPR121 (cordas 1–12)', 'Strumplate + acrylic');
part('MPR121 #2', strumX0 + 4, strumY0 + 2 * strumH / 3 - 10, 26, 20, UNDER - 15, UNDER - 3, 'elec', 'Sensor MPR121 (cordas 13–24)', 'Strumplate + acrylic');
part('Speaker box', strumX0 + (STRUM_W - 80) / 2, spkY0 + spkH / 2 - 24, 80, 48, UNDER - 36, UNDER, 'elec', 'Caixa do alto-falante (fechada)');

// On the base: main board with the Teensy, battery, charger, amplifier
const MB = { x: gridX0 + 8, y: gridY0 + 8, w: 110, d: 62 };
part('Main board', MB.x, MB.y, MB.w, MB.d, 4, 5.6, 'board', 'Placa principal (sobre espaçadores de 4 mm)');
part('Teensy 4.1 + Audio Shield', MB.x + 8, MB.y + 22, 61, 31, 5.6, 27, 'elec', 'Teensy 4.1 + Audio Shield (empilhados)', 'Main board');
const BAT = { x: colX(6.5), y: gridY0 + 20, w: 77, d: 41 };
part('Battery 2 × 18650', BAT.x, BAT.y, BAT.w, BAT.d, 0, 22, 'elec', 'Baterias 2 × 18650 (suporte)');
const CHG = { x: BAT.x + BAT.w + 5, y: gridY0 + 25, w: 25, d: 22 };
part('Charger / 5 V boost', CHG.x, CHG.y, CHG.w, CHG.d, 0, 10, 'elec', 'Carregador + elevador 5 V');
const AMP = { x: strumX0 + 70, y: strumY0 + 30, w: 22, d: 18 };
part('Amplifier PAM8302A', AMP.x, AMP.y, AMP.w, AMP.d, 0, 12, 'elec', 'Amplificador PAM8302A');

// Rear I/O board: every connector is soldered to it and pokes through the back wall
const JACKS = [
  ['USB-C', 14, 24, 'USB-C (MIDI + carga)'], ['MIDI IN', 22, 22, 'MIDI IN (DIN)'], ['MIDI OUT', 22, 22, 'MIDI OUT (DIN)'],
  ['SYNC', 12, 22, 'SYNC (P2)'], ['SUSTAIN', 22, 32, 'Pedal SUSTAIN (P10)'], ['PHONES', 12, 22, 'Fone (P2)'],
  ['LINE R', 22, 32, 'Saída LINE R (P10)'], ['LINE L/MONO', 22, 32, 'Saída LINE L/MONO (P10)'], ['SPEAKER', 12, 20, 'Chave do alto-falante'],
];
const IO = { x: 44, y: 1, d: 46 };
{
  let x = 50;
  for (const [name, w, d, label] of JACKS) { part(name, x, 0, w, d, 2.2, 24, 'jack', label, 'I/O board'); x += w + 8; }
  IO.w = x - 8 + 4 - IO.x;
}
part('I/O board', IO.x, IO.y, IO.w, IO.d, 0.6, 2.2, 'board', 'Placa de conectores (traseira)');

// Connectors: [name, label, x, y, w, d, z0, z1, mounted on]
const CONN = [
  ['J disp', 'Conector 16 vias (telas)', MB.x + 4, MB.y + 2, 28, 9, 5.6, 14.6, 'Main board'],
  ['J sliders', 'Conector 14 vias (sliders)', MB.x + 36, MB.y + 2, 25, 9, 5.6, 14.6, 'Main board'],
  ['J io', 'Conector 16 vias (traseira)', MB.x + 66, MB.y + 2, 28, 9, 5.6, 14.6, 'Main board'],
  ['J pads', 'Conector 20 vias (pads)', MB.x + 74, MB.y + 28, 33, 9, 5.6, 14.6, 'Main board'],
  ['J leds', 'Conector 3 vias (LEDs dos pads)', MB.x + 74, MB.y + 44, 8, 6, 5.6, 12, 'Main board'],
  ['J btn', 'Conector 4 vias (botão + LED)', MB.x + 4, MB.y + 55, 10, 6, 5.6, 12, 'Main board'],
  ['J pwr', 'Conector 2 vias (5 V)', MB.x + 74, MB.y + 54, 7, 6, 5.6, 12, 'Main board'],
  ['J amp', 'Conector 5 vias (amplificador)', MB.x + 86, MB.y + 54, 12, 6, 5.6, 12, 'Main board'],
  ['J strum', 'Conector 5 vias (strumplate)', MB.x + 100, MB.y + 54, 8, 5, 5.6, 11, 'Main board'],
  ['J disp/b', 'Conector 16 vias', colX(scr2) - 14, dispMid + 14, 28, 9, UNDER - 26.6, UNDER - 17.6, 'Display board'],
  ['J sliders/b', 'Conector 14 vias', gridX0 + 2, slotBottom - 6, 25, 9, UNDER - 25, UNDER - 16, 'Slider board'],
  ['J io/b', 'Conector 16 vias', 150, 36, 28, 9, 2.2, 11, 'I/O board'],
  ['J pads/b', 'Conector 20 vias', MB.x + 74, MB.y + 28, 33, 9, UNDER - 14, UNDER - 5, 'Pad board (84 pads)'],
  ['J leds/b', 'Conector 3 vias', MB.x + 96, MB.y + 44, 8, 6, UNDER - 11, UNDER - 5, 'Pad board (84 pads)'],
];
for (const [name, label, x, y, w, d, z0, z1, on] of CONN) part(name, x, y, w, d, z0, z1, 'conn', label, on);

/** Centre of a part's face: 'top', 'bottom' or a side ('-y' = back). */
function at(name, face = 'top', dz = 0) {
  const p = parts.find(q => q.name === name);
  if (!p) throw new Error(`no part ${name}`);
  const cx = p.x + p.w / 2, cy = p.y + p.d / 2, cz = (p.z0 + p.z1) / 2;
  return {
    top: [cx, cy, p.z1 + dz], bottom: [cx, cy, p.z0 - dz],
    '-y': [cx, p.y - dz, cz], '+y': [cx, p.y + p.d + dz, cz], '-x': [p.x - dz, cy, cz], '+x': [p.x + p.w + dz, cy, cz],
  }[face];
}

// ── Cables: what connects to what, and the way they run inside the box ──
// kind: 'ribbon' (flat, 1.27 mm pitch), 'wires' (a bundle; one colour per wire), 'usb'.
const cables = [];
const cable = (name, kind, wires, from, to, path, colors) => cables.push({ name, kind, wires, from, to, path, colors });
const RED = '#c0392b', BLACK = '#222', YEL = '#e1b12c', GRN = '#27ae60', BLU = '#2e86de', WHT = '#ddd', ORG = '#e67e22';

{
  const d = at('J disp/b', 'bottom'), m = at('J disp', 'top');
  cable('Telas + encoder', 'ribbon', 16, 'J disp/b', 'J disp', [d, [d[0], d[1], 21], [d[0], d[1] + 30, 21], [m[0], m[1] - 6, 21], [m[0], m[1], m[2]]]);
}
{
  const s0 = at('J sliders/b', 'bottom'), m = at('J sliders', 'top');
  cable('Sliders', 'ribbon', 14, 'J sliders/b', 'J sliders', [s0, [s0[0], s0[1], 17.5], [m[0], m[1] - 8, 17.5], [m[0], m[1], m[2]]]);
}
{
  const r = at('J io/b', 'top'), m = at('J io', 'top');
  cable('Conectores traseiros', 'ribbon', 16, 'J io/b', 'J io', [r, [r[0], r[1] + 14, 12.5], [m[0], m[1] - 10, 12.5], [m[0], m[1], m[2]]]);
}
{
  const a = at('J pads/b', 'bottom'), b = at('J pads', 'top');
  cable('Pads (matriz 7 × 12)', 'ribbon', 20, 'J pads/b', 'J pads', [a, [a[0], a[1] + 2, (a[2] + b[2]) / 2], b]);
}
{
  const a = at('J leds/b', 'bottom'), b = at('J leds', 'top');
  cable('LEDs dos pads', 'wires', 3, 'J leds/b', 'J leds', [a, [a[0], a[1], 20], [b[0], b[1], 18], b], [RED, BLACK, YEL]);
}
{
  const b = at('Power button', 'bottom'), j = at('J btn', 'top');
  cable('Botão + LED de power', 'wires', 4, 'Power button', 'J btn',
    [b, [b[0], b[1], 9], [b[0] + 4, b[1] + 30, 8], [b[0] + 4, j[1], 8], [j[0], j[1], j[2]]], [RED, BLACK, GRN, WHT]);
}
{
  const u = at('USB-C', '+y'), t = at('Teensy 4.1 + Audio Shield', '-x');
  cable('USB (painel → Teensy)', 'usb', 4, 'USB-C', 'Teensy 4.1 + Audio Shield',
    [u, [u[0], u[1] + 12, 12], [IO.x - 5, IO.y + IO.d + 12, 9], [IO.x - 5, t[1] - 10, 8], [t[0] - 8, t[1], 8], [t[0], t[1], 8]], [BLACK]);
}
{
  const m = at('MPR121 #1', '-x'), j = at('J strum', '+y');
  const yRun = MB.y + MB.d + 8;
  cable('Strumplate (I²C)', 'wires', 5, 'MPR121 #1', 'J strum',
    [m, [strumX0 + 2, m[1] + 8, 18], [strumX0 + 2, yRun, 9], [j[0], yRun, 9], [j[0], j[1], j[2]]], [RED, BLACK, BLU, YEL, WHT]);
  const m2 = at('MPR121 #2', '-x'), m1 = at('MPR121 #1', '-x');
  cable('Entre os dois MPR121', 'wires', 4, 'MPR121 #1', 'MPR121 #2', [m1, [m1[0] - 2, m1[1], m1[2]], [m2[0] - 2, m2[1], m2[2]], m2], [RED, BLACK, BLU, YEL]);
}
{
  const j = at('J amp', '+y'), a = at('Amplifier PAM8302A', '+y');
  const yRun = MB.y + MB.d + 4;
  cable('Áudio + 5 V para o amplificador', 'wires', 5, 'J amp', 'Amplifier PAM8302A',
    [j, [j[0], yRun, 7], [a[0], yRun, 7], [a[0], a[1], a[2]]], [RED, BLACK, WHT, ORG, GRN]);
  const s = at('Speaker box', 'bottom'), am = at('Amplifier PAM8302A', '-y');
  cable('Alto-falante', 'wires', 2, 'Amplifier PAM8302A', 'Speaker box', [am, [am[0], am[1] - 12, 8], [s[0] + 20, s[1] + 30, 5], [s[0] + 20, s[1] + 20, s[2]]], [RED, BLACK]);
}
{
  const c = at('Charger / 5 V boost', '+y'), j = at('J pwr', '+y');
  const yRun = MB.y + MB.d + 12;
  cable('5 V para a placa principal', 'wires', 2, 'Charger / 5 V boost', 'J pwr', [c, [c[0], yRun, 5], [j[0], yRun, 5], [j[0], j[1], j[2]]], [RED, BLACK]);
  const b = at('Battery 2 × 18650', '+x'), c2 = at('Charger / 5 V boost', '-x');
  cable('Bateria', 'wires', 2, 'Battery 2 × 18650', 'Charger / 5 V boost', [b, [b[0] + 2.5, b[1] - 6, 6], [c2[0], c2[1] - 4, 6], [c2[0], c2[1], c2[2]]], [RED, BLACK]);
  const v = at('I/O board', '+y'), c3 = at('Charger / 5 V boost', '-y');
  cable('Carga (5 V do USB-C)', 'wires', 2, 'I/O board', 'Charger / 5 V boost', [[CHG.x + 6, IO.y + IO.d, 3], [CHG.x + 6, c3[1] - 10, 4], [c3[0], c3[1], c3[2]]], [RED, BLACK]);
  void v;
}

/** Cable length along its path, plus 15 % slack, rounded up to 10 mm. */
const cableLength = c => {
  let L = 0;
  for (let i = 1; i < c.path.length; i++) L += Math.hypot(...c.path[i].map((v, k) => v - c.path[i - 1][k]));
  // A flat cable needs room to fold at both connectors; short wires need room for the crimp.
  return Math.max(c.kind === 'ribbon' ? 60 : 50, Math.ceil((L * 1.15) / 10) * 10);
};
const cableRadius = c => (c.kind === 'ribbon' ? 0.6 : c.kind === 'usb' ? 2.5 : 0.8 + 0.35 * c.wires);
const cableWidth = c => (c.kind === 'ribbon' ? c.wires * 1.27 + 1 : 2 * cableRadius(c));

/** Pairs closer than `min` mm (negative clearance = they overlap). */
function clashes(min = 1) {
  const out = [];
  const gap = (a0, a1, b0, b1) => Math.max(b0 - a1, a0 - b1);
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j];
    if (a.kind === 'wood' && b.kind === 'wood') continue;        // joined on purpose
    if (a.kind === 'jack' && b.kind === 'wood') continue;        // jacks pass under the back cleat by design
    if (a.on === b.name || b.on === a.name || (a.on && a.on === b.on)) continue;
    const c = Math.max(gap(a.x, a.x + a.w, b.x, b.x + b.w), gap(a.y, a.y + a.d, b.y, b.y + b.d), gap(a.z0, a.z1, b.z0, b.z1));
    if (c < min) out.push({ a: a.name, b: b.name, c });
  }
  for (const p of parts) {
    if (p.x < 0 || p.y < 0 || p.x + p.w > W || p.y + p.d > H || p.z0 < 0 || p.z1 > INNER_H) out.push({ a: p.name, b: 'enclosure', c: -1 });
  }
  // Cables: sample every 2 mm and check the cable's own thickness against every
  // part except the ones it plugs into (and what those are mounted on).
  for (const c of cables) {
    // Flat ribbons: thin in height, wide sideways. Round cables: the same both ways.
    const rz = cableRadius(c), rxy = c.kind === 'ribbon' ? cableWidth(c) / 2 : rz;
    const ends = new Set([c.from, c.to]);
    for (const e of [c.from, c.to]) { const p = parts.find(q => q.name === e); if (p?.on) ends.add(p.on); }
    for (const p of parts) {
      if (ends.has(p.name) || (p.on && ends.has(p.on) && p.kind === 'conn')) continue;
      let worst = Infinity;
      for (let i = 1; i < c.path.length; i++) {
        const A = c.path[i - 1], B = c.path[i], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
        const n = Math.max(1, Math.ceil(L / 2));
        for (let k = 0; k <= n; k++) {
          // Skip the last 4 mm at each end, where the cable enters its connector.
          const t = k / n, along = t * L;
          if ((i === 1 && along < 4) || (i === c.path.length - 1 && L - along < 4)) continue;
          const q = A.map((v, j) => v + (B[j] - v) * t);
          // Gap between the part's box and the cable's own box around this point
          const gx = Math.max(p.x - q[0], q[0] - (p.x + p.w)) - rxy, gy = Math.max(p.y - q[1], q[1] - (p.y + p.d)) - rxy;
          const gz = Math.max(p.z0 - q[2], q[2] - p.z1) - rz;
          worst = Math.min(worst, Math.max(gx, gy, gz));
        }
      }
      if (worst < 0) out.push({ a: `cable “${c.name}”`, b: p.name, c: worst });
    }
  }
  return out;
}

// ── SVG ─────────────────────────────────────────────────────────────────────

const f = n => +n.toFixed(3);
const PAD = 10, TITLE_H = 24;
const OX = PAD + FRAME_T, OY = PAD + FRAME_T;            // panel origin on the sheet
const SHEET_W = W + 2 * FRAME_T + 2 * PAD;
const SHEET_H = H + 2 * FRAME_T + 2 * PAD + TITLE_H;

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

/** Mix a #rrggbb colour toward white. */
function lighten(hex, amount) {
  const v = parseInt(hex.slice(1), 16), ch = c => Math.round(c + (255 - c) * amount);
  return `rgb(${ch(v >> 16)}, ${ch((v >> 8) & 255)}, ${ch(v & 255)})`;
}

function guideSvg(g, visual) {
  if (visual && (g.type === 'robot' || g.type === 'seg') && SHOTS[g.type]) {
    const [aw, ah] = SCREEN_ACTIVE;
    return `<image href="${SHOTS[g.type]}" x="${f(g.x - aw / 2)}" y="${f(g.y - ah / 2)}" width="${aw}" height="${ah}" preserveAspectRatio="none"/>`;
  }
  if (g.type === 'robot') {
    return `<text class="robot" x="${f(g.x)}" y="${f(g.y + 1)}">(◉ω◉)</text>` +
      `<text class="robot small" x="${f(g.x)}" y="${f(g.y + 8)}">CHORD!</text>`;
  }
  if (g.type === 'seg') return `<text class="seg" x="${f(g.x)}" y="${f(g.y + 4)}">C#m7</text>`;
  if (g.type === 'line') return `<line class="g-${g.role}" x1="${f(g.x1)}" y1="${f(g.y1)}" x2="${f(g.x2)}" y2="${f(g.y2)}"/>`;
  if (g.type === 'circle') return `<circle class="g-${g.role}" cx="${f(g.cx)}" cy="${f(g.cy)}" r="${g.r}"/>`;
  const fill = visual && g.fill ? ` style="fill:${g.lit ? lighten(g.fill, 0.45) : g.fill}"` : '';
  const r = g.role === 'key' || g.role === 'fnkey' ? 3 : g.role === 'knob' ? 1.5 : 0.5;
  const glow = visual && g.lit
    ? `<rect x="${f(g.x - 2)}" y="${f(g.y - 2)}" width="${f(g.w + 4)}" height="${f(g.h + 4)}" rx="${r + 2}" fill="${lighten(g.fill, 0.6)}" opacity=".45"/>`
    : '';
  return `${glow}<rect class="g-${g.role}" x="${f(g.x)}" y="${f(g.y)}" width="${f(g.w)}" height="${f(g.h)}" rx="${r}"${fill}/>`;
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

  const scaleY = OY + H + FRAME_T + 10;
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
<rect class="wood" x="${PAD}" y="${PAD}" width="${f(W + 2 * FRAME_T)}" height="${f(H + 2 * FRAME_T)}" rx="${visual ? 4 : 0}"/>
<g transform="translate(${OX} ${OY})">
  <rect class="panel" x="0" y="0" width="${f(W)}" height="${f(H)}"/>
  <g class="cut">${cuts.slice(1).map(cutSvg).join('\n')}</g>
  <g class="guides">${guides.map(g => guideSvg(g, visual)).join('\n')}</g>
  <rect class="cut" x="0" y="0" width="${f(W)}" height="${f(H)}" style="fill:none"/>
  <g>${texts.map(t => `<text class="silk" x="${f(t.x)}" y="${f(t.y)}" style="font-size:${t.s}px;text-anchor:${t.anchor};font-weight:${t.weight};letter-spacing:${t.spacing}px">${esc(t.t)}</text>`).join('\n')}</g>
</g>
<line class="scale-line" x1="${OX}" y1="${scaleY}" x2="${OX + 100}" y2="${scaleY}"/>${ticks}
<text class="scale" x="${OX}" y="${scaleY + 4}">100 mm — measure to confirm the print is at 100%</text>
<text class="title" x="${OX + W}" y="${scaleY}" text-anchor="end">OmniHarp · top panel ${f(W)} × ${f(H)} mm · with wood frame ${f(W + 2 * FRAME_T)} × ${f(H + 2 * FRAME_T)} mm</text>
<text class="title" x="${OX + W}" y="${scaleY + 5}" text-anchor="end">${visual ? 'visual preview' : 'red = cut · black = silkscreen · grey dashed = parts · blue dashed = seam between the two panel parts · brown = wood frame'} · draft</text>
</svg>
`;
}

// ── Panel texture for the 3D viewer: print + windows, without caps or knobs ──

function textura() {
  const keep = g => g.role === 'strip' || g.type === 'robot' || g.type === 'seg';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">
<style>
  text { font-family: 'DejaVu Sans', Arial, sans-serif; }
  .robot, .seg { text-anchor: middle; font-family: 'DejaVu Sans Mono', 'Courier New', monospace; font-weight: bold; fill: #00e060; }
  .robot { font-size: 7px; } .robot.small { font-size: 3px; letter-spacing: .8px; } .seg { font-size: 11px; letter-spacing: 1px; }
  .cut { fill: #050505; } .g-strip { fill: #d4b048; } .silk { fill: #eee; }
</style>
<rect width="${f(W)}" height="${f(H)}" fill="#141414"/>
<g class="cut">${cuts.slice(1).map(cutSvg).join('')}</g>
<g>${guides.filter(keep).map(g => guideSvg(g, true)).join('')}</g>
<g>${texts.map(t => `<text class="silk" x="${f(t.x)}" y="${f(t.y)}" style="font-size:${t.s}px;text-anchor:${t.anchor};font-weight:${t.weight};letter-spacing:${t.spacing}px">${esc(t.t)}</text>`).join('')}</g>
</svg>`;
}

/** Everything the 3D model needs, in panel millimetres (hardware/3d/ reads it). */
function model() {
  return {
    panel: { w: W, h: H, t: PANEL_T, recess: PANEL_RECESS },
    frame: { t: FRAME_T, h: FRAME_H, base: BASE_T, inner: INNER_H, cleat: CLEAT, rail: RAIL_W, seamX },
    cap: CAP, padH: PAD_H, keyCut: KEY_CUT, sliderCap: SLIDER_CAP, slotW: SLIDER_SLOT_W,
    cuts: cuts.slice(1),
    parts,
    cables: cables.map(c => ({ ...c, length: cableLength(c), radius: cableRadius(c), width: cableWidth(c) })),
    keys: [
      ...twin.keys.map(k => ({ x: k.x, y: k.y, color: k.color, type: k.type, root: k.root })),
      ...twin.fnKeys.map(k => ({ x: k.x, y: k.y, color: '#3a3a3a', action: k.action })),
    ],
    state: STATE,
    sliders: twin.sliders, encoder: twin.encoder, power: twin.power, screens: twin.screens, strum: twin.strum,
    leds: twin.leds, mounts: twin.mounts,
  };
}

/** Wiring list (Portuguese), from the cables above: what to buy and how long. */
function fiacao() {
  const BOARD = {
    'Main board': 'placa principal', 'Display board': 'placa das telas', 'Slider board': 'placa dos sliders',
    'I/O board': 'placa traseira', 'Pad board (84 pads)': 'placa dos pads',
  };
  const label = name => {
    const p = parts.find(q => q.name === name);
    if (!p) return name;
    return p.kind === 'conn' ? `${p.label.split(' (')[0]}, ${BOARD[p.on] ?? p.on}` : p.label;
  };
  const kind = c => (c.kind === 'ribbon' ? `cabo flat ${c.wires} vias (IDC, passo 1,27 mm)`
    : c.kind === 'usb' ? 'cabo USB-C de painel → micro-USB' : `${c.wires} fios 24–26 AWG (conector JST)`);
  const rows = cables.map(c => `| ${c.name} | ${label(c.from)} | ${label(c.to)} | ${kind(c)} | ${cableLength(c)} mm |`);
  return `# Fiação do OmniHarp

Gerado por \`hardware/painel/gerar.cjs\` a partir das posições das placas e do
caminho de cada cabo dentro da caixa. O comprimento já inclui 15 % de folga.
Não edite à mão: mude o gerador e rode de novo.

| Cabo | De | Para | Tipo | Comprimento |
|---|---|---|---|---|
${rows.join('\n')}

## Entradas e saídas (parede de trás, da esquerda para a direita para quem está tocando)

${JACKS.map(([, , , l]) => `- ${l}`).join('\n')}

## Placas

${parts.filter(p => p.kind === 'board').map(p => `- **${p.label}**: ${f(p.w)} × ${f(p.d)} mm`).join('\n')}
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


// ── Inside view: plan + front-to-back section ────────────────────────────────

function interno() {
  const KIND = {
    wood: ['#d9b98a', '#8a5a2b'], elec: ['#b7d4ea', '#2a5d86'], jack: ['#f2c38f', '#a0521c'],
    board: ['#a9d6b8', '#1f5d3a'], conn: ['#6b6b6b', '#222'],
  };
  const T = FRAME_T, PADI = 12;
  const planX = PADI + T, planY = PADI + 14 + T;              // inner frame corner on the sheet
  const secTop = planY + H + T + 26;                           // section drawing area
  const cutX = 80;                                             // section plane, mm from the left inner wall
  const secBase = secTop + FRAME_H + 4;                        // sheet y of the frame's bottom edge
  const zY = z => secBase - BASE_T - z;                        // height above the base → sheet y
  const sheetW = W + 2 * T + 2 * PADI, sheetH = secBase + 40;
  const rectS = (x, y, w, h, fill, stroke, extra = '') =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${stroke}" stroke-width=".25"${extra}/>`;
  const label = (x, y, t, size = 2.1, anchor = 'middle') =>
    `<text x="${f(x)}" y="${f(y)}" font-size="${size}" text-anchor="${anchor}">${esc(t)}</text>`;

  let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(sheetW)}mm" height="${f(sheetH)}mm" viewBox="0 0 ${f(sheetW)} ${f(sheetH)}">
<style>text{font-family:'DejaVu Sans',Arial,sans-serif;fill:#222}</style>
<rect width="100%" height="100%" fill="#fff"/>
${label(PADI, PADI + 3, 'PLAN — inside, seen from above with the panel removed (panel cut-outs in light red)', 3.2, 'start')}`;

  // Plan: frame, panel cut-outs for reference, parts
  o += rectS(planX - T, planY - T, W + 2 * T, H + 2 * T, KIND.wood[0], KIND.wood[1]);
  o += rectS(planX, planY, W, H, '#fbfaf7', KIND.wood[1]);
  o += `<g transform="translate(${planX} ${planY})" fill="none" stroke="#f3b0b0" stroke-width=".2">${cuts.slice(1).map(cutSvg).join('')}</g>`;
  const order = [...parts].sort((a, b) => (b.z1 - b.z0) - (a.z1 - a.z0));
  for (const p of order) {
    const [fill, stroke] = KIND[p.kind];
    o += rectS(planX + p.x, planY + p.y, p.w, p.d, fill, stroke, ' fill-opacity=".55"');
  }
  for (const p of parts) {
    if (p.kind === 'wood' && p.name !== 'Seam rail') continue;
    const vertical = p.kind === 'jack' || p.name === 'Seam rail';
    const cx = planX + p.x + p.w / 2, cy = planY + p.y + p.d / 2;
    o += vertical
      ? `<text x="${f(cx)}" y="${f(cy)}" font-size="1.9" text-anchor="middle" transform="rotate(-90 ${f(cx)} ${f(cy)})">${esc(p.name)}</text>`
      : label(cx, cy + 0.8, `${p.name} · ${p.z1 - p.z0 | 0} mm`);
  }
  // Cables, as seen from above
  for (const c of cables) {
    const pts = c.path.map(([x, y]) => `${f(planX + x)},${f(planY + y)}`).join(' ');
    const col = c.kind === 'ribbon' ? '#8d8d8d' : c.kind === 'usb' ? '#222' : (c.colors?.[0] ?? '#444');
    o += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${f(Math.min(cableWidth(c), 6))}" stroke-opacity=".75" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  o += `<line x1="${planX + cutX}" y1="${planY - T - 3}" x2="${planX + cutX}" y2="${planY + H + T + 3}" stroke="#d00" stroke-width=".35" stroke-dasharray="3 1.5"/>`;
  o += label(planX + cutX, planY - T - 4.5, 'A', 3);
  o += label(planX - T, planY + H + T + 6, `Outside ${f(W + 2 * T)} × ${f(H + 2 * T)} × ${FRAME_H} mm · wood ${T} mm on every side · inside height ${f(INNER_H)} mm (base to panel)`, 2.6, 'start');
  o += label(planX - T, planY + H + T + 10, 'Back wall at the top (connectors), player at the bottom. Blue = electronics, green = boards, orange = connectors, grey = ribbon cables, coloured lines = wires.', 2.6, 'start');

  // Section A: cut at x = cutX, back on the left
  o += label(PADI, secTop - 6, `SECTION A — front-to-back cut at the red line (back on the left, player on the right)`, 3.2, 'start');
  const sx = y => planX + y;                                   // depth → sheet x
  o += rectS(sx(-T), secBase - FRAME_H, T, FRAME_H, KIND.wood[0], KIND.wood[1]);          // back wall
  o += rectS(sx(H), secBase - FRAME_H, T, FRAME_H, KIND.wood[0], KIND.wood[1]);           // front wall
  o += rectS(sx(0), secBase - BASE_T, H, BASE_T, KIND.wood[0], KIND.wood[1]);             // base
  o += rectS(sx(0), zY(INNER_H + PANEL_T), H, PANEL_T, '#222', '#000');                    // panel
  for (const p of parts) {
    if (p.x > cutX || p.x + p.w < cutX) continue;
    const [fill, stroke] = KIND[p.kind];
    o += rectS(sx(p.y), zY(p.z1), p.d, p.z1 - p.z0, fill, stroke, ' fill-opacity=".7"');
    if (p.kind !== 'wood') o += label(sx(p.y + p.d / 2), zY((p.z0 + p.z1) / 2) + 0.8, p.name, 1.9);
  }
  o += label(sx(H + T + 3), zY(INNER_H + PANEL_T) + 1, `panel ${PANEL_T} mm, ${PANEL_RECESS} mm below the wood`, 2.1, 'start');
  o += label(sx(H + T + 3), secBase - BASE_T / 2 + 1, `base ${BASE_T} mm`, 2.1, 'start');

  // Clearance report
  const report = clashes();
  o += label(PADI, sheetH - 14, report.length
    ? `Clearance check: ${report.length} problem(s) — ` + report.map(r => `${r.a} × ${r.b} (${f(r.c)} mm)`).join(' · ')
    : 'Clearance check: every part has at least 1 mm of room around it.', 2.8, 'start');
  o += label(PADI, sheetH - 9, 'Sizes are typical for the parts in the README; measure the real ones and update the CHECK values.', 2.4, 'start');
  return o + '</svg>\n';
}

// ── PDFs and PNG via the pre-installed Playwright Chromium ──────────────────

async function render(corteSvg, visualSvg, internoSvg, texturaSvg) {
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

  // Panel texture for the 3D viewer, 4 px per mm
  const tpx = 4;
  await page.setViewportSize({ width: Math.ceil(W * tpx), height: Math.ceil(H * tpx) });
  await page.setContent(`<style>body{margin:0}svg{width:${W * tpx}px;height:${H * tpx}px;display:block}</style>${texturaSvg}`);
  await page.screenshot({ path: path.join(OUT, 'painel-textura.png') });

  // PNG of the inside view
  const m = internoSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const [iw, ih] = [+m[1] * pxPerMm, +m[2] * pxPerMm];
  await page.setViewportSize({ width: Math.ceil(iw), height: Math.ceil(ih) });
  await page.setContent(`<style>body{margin:0}svg{width:${iw}px;height:${ih}px;display:block}</style>${internoSvg}`);
  await page.screenshot({ path: path.join(OUT, 'painel-interno.png') });
  await browser.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const corte = svg(false), visual = svg(true);
  fs.writeFileSync(path.join(OUT, 'painel-corte.svg'), corte);
  fs.writeFileSync(path.join(OUT, 'painel-visual.svg'), visual);
  fs.writeFileSync(path.join(OUT, 'painel-corte.dxf'), dxf());
  const r3 = o => JSON.parse(JSON.stringify(o, (_, v) => typeof v === 'number' ? f(v) : v));
  fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(r3({
    panel: { w: W, h: H, frame: FRAME_T }, cap: CAP, holeD: GRILLE_HOLE, mountD: MOUNT_D, slotW: SLIDER_SLOT_W,
    sliderCap: SLIDER_CAP, ...twin, texts,
  })) + '\n');
  const inside = interno();
  fs.writeFileSync(path.join(OUT, 'painel-interno.svg'), inside);
  fs.writeFileSync(path.join(OUT, 'model.json'), JSON.stringify(r3(model())) + '\n');
  fs.writeFileSync(path.join(OUT, 'fiacao.md'), fiacao());
  await render(corte, visual, inside, textura());
  console.log(`Panel ${f(W)} × ${f(H)} mm (with wood frame ${f(W + 2 * FRAME_T)} × ${f(H + 2 * FRAME_T)} mm)`);
  const report = clashes();
  console.log(report.length ? `Clearance problems:\n${report.map(r => `  ${r.a} × ${r.b}: ${f(r.c)} mm`).join('\n')}` : 'Clearance check: OK');
  console.log(`${cuts.length} cut shapes · outputs in ${path.relative(process.cwd(), OUT) || OUT}`);
})();
