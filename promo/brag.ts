// ─── OmniHarp promo — the app demo ("brag") scenes ───
// Every visual is a pure function of time t (seconds). The render script calls
// window.renderFrame(t) for each frame and screenshots the stage, so timing is
// frame-exact and matches the soundtrack, which is rendered from the same score.
//
// The devices show the real app (iframes of /), "puppeteered" per frame: the
// promo sets the same classes and text the app would, instead of running it.

import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
import '@fontsource/unbounded/900.css';
import './video.css';

import { clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutExpo, lerp, prog, window01 } from './lib/anim';
import { AppView, Device, PHONE_LANDSCAPE, PHONE_PORTRAIT, TABLET, homeBar, makeAppState, statusBar } from './lib/app';
import { el, fitWidth, layer, withParent } from './lib/dom';
import { iconSvg, loopFace, showFace } from './lib/face';
import { Headline } from './lib/headline';
import { CTA_URL, SCORE, T, activePlucks, chords, hits } from './score';

export interface BragOptions {
  /** Frame the opening close-up on the power button (default) or the app's robot screen. */
  focus?: 'power' | 'robot';
  /** Hide the "press to power on" hint on the hero phone. */
  hideHint?: boolean;
}

export interface Brag {
  init(): Promise<void>;
  render(t: number): void;
  /** Stage position of the hero phone's robot screen (valid after render). */
  robotScreenOnStage(): [number, number];
}

/** Build the demo scenes inside `root`; render(t) draws them at demo time t (0–32 s). */
export function createBrag(root: Element, opts: BragOptions = {}): Brag {
  return withParent(root, () => {
  // ═══ Background ═══

  const glow = layer('glow');
  const bigStrings = layer('bigStrings');
  const stringGlows = Array.from({ length: 24 }, () => {
    const s = el('div', 'big-string', bigStrings);
    return { s, g: el('div', 'glow', s) };
  });

  function renderBigStrings(t: number, opacity: number): void {
    bigStrings.style.opacity = String(opacity);
    if (opacity <= 0.001) return;
    const active = activePlucks(t, 0.7);
    stringGlows.forEach(({ s, g }, i) => {
      const pt = active.get(i);
      if (pt === undefined) { g.style.opacity = '0'; s.style.transform = ''; return; }
      const age = t - pt, k = 1 - age / 0.7;
      g.style.opacity = String(k * k);
      s.style.transform = `translateX(${Math.sin(age * 70) * 7 * k}px)`;
    });
  }

  const appState = makeAppState(SCORE);

  // Hero phone: portrait app, plus a landscape app pre-rotated inside the screen,
  // revealed when the phone turns sideways.
  const hero = new Device('phone', 390, 844);
  // Portrait app + its status bar fade out together when the phone turns (iOS hides it sideways).
  const portraitLayer = el('div', 'layer', hero.screen);
  statusBar(portraitLayer, 390, PHONE_PORTRAIT.top, 16);
  homeBar(portraitLayer, 195, 9, 134);
  const heroPortrait = new AppView(portraitLayer, 390, 844 - PHONE_PORTRAIT.top - PHONE_PORTRAIT.bottom, 0, PHONE_PORTRAIT.top);
  const landHolder = el('div', 'land-holder', hero.screen);
  Object.assign(landHolder.style, { width: '844px', height: '390px', transform: 'translate(390px, 0) rotate(90deg)' });
  homeBar(landHolder, 422, 7, 160);
  const heroLandscape = new AppView(landHolder, 844 - 2 * PHONE_LANDSCAPE.side, 390 - PHONE_LANDSCAPE.bottom, PHONE_LANDSCAPE.side, 0);
  /** Landscape app point → hero screen point. */
  const landToScreen = (x: number, y: number): [number, number] => [390 - y, x];

  const tablet = new Device('tablet', 820, 1180);
  statusBar(tablet.screen, 820, TABLET.top, 13);
  homeBar(tablet.screen, 410, 7, 260);
  const tabletApp = new AppView(tablet.screen, 820, 1180 - TABLET.top - TABLET.bottom, 0, TABLET.top);
  const laptop = new Device('laptop', 1440, 900);
  const laptopApp = new AppView(laptop.screen, 1440, 900);
  const phone2 = new Device('phone', 390, 844);
  statusBar(phone2.screen, 390, PHONE_PORTRAIT.top, 16);
  homeBar(phone2.screen, 195, 9, 134);
  const phone2App = new AppView(phone2.screen, 390, 844 - PHONE_PORTRAIT.top - PHONE_PORTRAIT.bottom, 0, PHONE_PORTRAIT.top);

  // ═══ Typography ═══

  const sub = (text: string, top: number) => { const d = el('div', 'sub'); d.style.top = `${top}px`; d.textContent = text; return d; };

  // ═══ Scenes ═══

  // S1 — hook
  const h1 = new Headline(['E se o seu', 'celular', 'virasse uma', '*harpa?'], [0.3, 0.8, 1.3, 2.3], 2.85, 520, 132);

  // S2 — logo
  const logoTop = el('div', 'logo');
  logoTop.style.top = '96px';
  const logoTopRow = el('div', '', logoTop);
  Object.assign(logoTopRow.style, { display: 'flex', alignItems: 'center', gap: '30px' });
  const logoTopIcon = el('img', '', logoTopRow);
  logoTopIcon.src = '/icons/icon-512.png';
  Object.assign(logoTopIcon.style, { width: '128px', height: '128px' });
  const logoTopWord = el('div', 'wordmark gold', logoTopRow);
  logoTopWord.textContent = 'OmniHarp';
  logoTopWord.style.fontSize = '132px';
  const s2sub = sub('Acordes e cordas na ponta dos dedos.', 290);

  // S3 — how it works
  const h3 = new Headline(['Toque um acorde.', 'Deslize as cordas.', '*É música.'], [7.95, 8.95, 9.95], 11.65, 96, 84);

  // S4 — drums
  const h4 = new Headline(['Uma banda inteira', '*no seu bolso.'], [12.0, 12.5], 15.65, 170, 96);
  const ticker = el('div');
  ticker.id = 'ticker';
  const PATTERN_NAMES = ['Bossa Nova', 'Rock', 'Samba', 'Reggae', 'Waltz', 'Shuffle', 'March'];
  for (let k = 0; k < 4; k++) for (const n of PATTERN_NAMES) { const c = el('div', 'chip' + (n === 'Rock' ? ' on' : ''), ticker); c.textContent = n; }

  // S5 — arpeggiator
  const h5 = new Headline(['Arpejador', '*sempre no tempo.'], [16.0, 16.5], 19.65, 170, 110);
  const syncBadge = el('div', 'badge');
  syncBadge.textContent = 'SYNC';

  // S6 — feature blitz
  const CARDS: [big: string, label: string, hint: string, cls?: string][] = [
    ['72', 'acordes', 'maior, menor, 7, m7, Maj7, °7'],
    ['24', 'cordas', 'quatro oitavas sob os dedos'],
    ['7', 'ritmos', 'bossa nova, rock, samba…'],
    ['7', 'arpejos', 'sincronizados com a bateria'],
    ['● REC', 'grave', 'e compartilhe o que tocar', 'rec'],
    ['MIDI', 'conecte', 'seu teclado e toque acordes'],
    ['Tom', 'em destaque', 'os acordes certos acesos'],
    ['Offline', 'sempre', 'toca até sem internet'],
  ];
  const cards = CARDS.map(([big, label, hint, cls]) => {
    const c = el('div', 'card');
    const b = el('div', 'big gold' + (cls ? ` ${cls}` : ''), c);
    if (cls === 'rec') b.classList.remove('gold');
    b.textContent = big;
    el('div', 'label', c).textContent = label;
    el('div', 'hint', c).textContent = hint;
    return { c, b };
  });

  // S7 — devices
  const h7 = new Headline(['No celular.', 'No tablet.', 'No computador.', '*Em qualquer tela.'], [24.0, 25.0, 26.0, 27.0], 27.75, 70, 78);

  // S8 — end card
  const endCard = el('div', 'logo');
  endCard.style.top = '470px';
  // End-card icon: the app icon (scripts/icon.svg) drawn live, so the robot's
  // face can cycle through its moods on the beat.
  const endIcon = el('div', 'end-icon', endCard);
  endIcon.innerHTML = iconSvg('ec', 250);
  const faceEl = endIcon.querySelector<SVGGElement>('.face')!;

  function renderEndFace(t: number): void {
    const local = Math.max(0, t - T.finale);
    showFace(endIcon, loopFace(local));
    // A little bounce on every change, like the robot reacting on the instrument.
    const bounce = 1 + 0.07 * Math.exp(-(local % 0.5) * 14);
    faceEl.setAttribute('transform', `translate(256 256) scale(${bounce.toFixed(4)}) translate(-256 -256)`);
  }
  const endWord = el('div', 'wordmark gold', endCard);
  endWord.textContent = 'OmniHarp';
  Object.assign(endWord.style, { fontSize: '170px', marginTop: '46px' });
  const endTag = el('div', '', endCard);
  Object.assign(endTag.style, { marginTop: '34px', fontSize: '50px', fontWeight: '600', textAlign: 'center', lineHeight: '1.3', color: 'rgba(255,240,215,0.9)' });
  endTag.innerHTML = 'Sua harpa de acordes.<br>Em qualquer tela.';
  const endCta = el('div', 'cta', endCard);
  endCta.textContent = '▶  Toque agora';
  // The address is the call to action's destination: right under the button.
  const endUrl = el('div', 'url', endCard);
  endUrl.textContent = CTA_URL;
  endUrl.style.display = CTA_URL ? 'block' : 'none';
  const endPlat = el('div', 'platforms', endCard);
  endPlat.textContent = 'Web agora · Android e iOS em breve';
  const endParts = [endIcon, endWord, endTag, endCta, endUrl, endPlat];

  // Touch indicators (chord thumb + strum thumb)
  const tapDot = el('div', 'touch');
  const swipeDot = el('div', 'touch');

  const vignette = layer('vignette');
  const flash = layer('flash');
  const black = layer('black');
  black.style.background = '#000';
  void vignette;

  // ═══ Frame ═══

  const FLASHES: [number, number][] = [[3.5, 0.35], [4.0, 0.55], [12.0, 0.75], [20.0, 0.4], [28.0, 0.9]];
  const kicks = hits.filter(h => h.hit === 'k').map(h => h.t);

  /** Power button center on the hero phone (device px), measured once at init:
   *  a hidden device has no layout to measure. */
  let powerPt = { x: 0, y: 0 };
  let robotPt = { x: 0, y: 0 };
  /** What the opening close-up frames: the power button, or (story) the app's robot screen. */
  let focusPt = { x: 0, y: 0 };

  function heroPose(t: number): { cx: number; cy: number; s: number; rot: number; op: number } {
    const HERO = { cx: 540, cy: 1150, s: 1.55 };
    const px = focusPt.x, py = focusPt.y;
    if (t < T.firstChord) {
      // Close on the power button, then pull out on the first strum.
      const s = lerp(4.6, 5.3, prog(t, 3.0, 1.0));
      const fx = px + (opts.focus === 'robot' ? 0 : 55); // power: a little right of the button, so the hint reads in full
      return { cx: 540 - (fx - hero.w / 2) * s, cy: 980 - (py - hero.h / 2) * s, s, rot: 0, op: prog(t, 3.1, 0.25) };
    }
    if (t < T.rhythmOn) {
      const p = easeOutExpo(prog(t, T.firstChord, 0.9));
      const s0 = 5.3, cx0 = 540 - (px + (opts.focus === 'robot' ? 0 : 55) - hero.w / 2) * s0, cy0 = 980 - (py - hero.h / 2) * s0;
      const push = lerp(1, 1.05, prog(t, 8, 4));
      return {
        cx: lerp(cx0, HERO.cx, p), cy: lerp(cy0, HERO.cy, p),
        s: Math.exp(lerp(Math.log(s0), Math.log(HERO.s * push), p)), rot: 0, op: 1,
      };
    }
    // Drop: rotate to landscape and settle; push in during the arpeggio; exit at the blitz.
    const r = easeInOutCubic(prog(t, T.rhythmOn, 0.75));
    const land = { cx: 540, cy: 1060, s: 1.12 };
    const push = easeInOutCubic(prog(t, T.arpOn, 3.5));
    const exit = easeInCubic(prog(t, T.blitz - 0.25, 0.25));
    return {
      cx: lerp(HERO.cx, land.cx, r) - push * 110,
      cy: lerp(HERO.cy * 1, land.cy, r),
      s: lerp(HERO.s * 1.05, land.s, r) * (1 + push * 0.18) * (1 + exit * 0.4),
      rot: -90 * r,
      op: 1 - exit,
    };
  }

  function renderFrame(t: number): void {
    // Background light: kick pulses and accent flashes.
    let pulse = 0;
    for (const k of kicks) if (k <= t && t - k < 0.6) pulse = Math.max(pulse, Math.exp(-(t - k) * 7));
    glow.style.opacity = String(0.25 + 0.6 * pulse * (t >= T.rhythmOn && t < T.finale + 1 ? 1 : 0) + (t >= T.firstChord ? 0.15 : 0));
    let fl = 0;
    for (const [ft, a] of FLASHES) if (ft <= t && t - ft < 0.5) fl = Math.max(fl, a * Math.exp(-(t - ft) * 9));
    flash.style.opacity = String(fl);

    // Giant strings: hero of the intro and the end, a faint backdrop in between.
    let strOp = 0.14;
    if (t < 3.6) strOp = lerp(1, 0.12, prog(t, 2.9, 0.7));
    else if (t >= T.blitz && t < T.lineup) strOp = 0.55;
    else if (t >= T.finale) strOp = lerp(1, 0.4, prog(t, 29.2, 1.2));
    renderBigStrings(t, strOp);

    const state = appState(t);
    // Story: the face that travelled down the cable is the one that lights up the app.
    if (opts.focus === 'robot' && t >= T.powerOn && t < T.firstChord) state.robot = 'chord';

    // ── Hero phone (0–20.3 s) ──
    const pose = heroPose(t);
    hero.place(pose.cx, pose.cy, pose.s, pose.rot, pose.op);
    if (pose.op > 0) {
      const landP = prog(t, T.rhythmOn + 0.3, 0.15);
      portraitLayer.style.opacity = String(1 - landP);
      landHolder.style.opacity = String(landP);
      if (landP < 1) heroPortrait.apply(state);
      if (landP > 0) heroLandscape.apply(state);
    }

    // ── Touch indicators: chord taps and strum swipes while the phone is upright or settled sideways ──
    const upright = t >= T.firstChord + 0.6 && t < T.rhythmOn;
    const sideways = t >= T.rhythmOn + 0.9 && t < T.arpOn;
    tapDot.style.opacity = '0';
    swipeDot.style.opacity = '0';
    if (upright || sideways) {
      const view = upright ? heroPortrait : heroLandscape;
      const map = (x: number, y: number) => (upright
        ? hero.toStage(...heroPortrait.toParent(x, y))
        : hero.toStage(...landToScreen(...heroLandscape.toParent(x, y))));
      const c = chords.find(ch => t >= ch.t - 0.35 && t < ch.t + 0.3);
      if (c) {
        const r = view.rect(view.chordButton(c));
        const [x, y] = map(r.x + r.width / 2, r.y + r.height / 2);
        const press = t < c.t - 0.16 ? prog(t, c.t - 0.35, 0.19) : 1;
        const lift = prog(t, c.t + 0.1, 0.2);
        tapDot.style.opacity = String(press * (1 - lift));
        tapDot.style.transform = `translate(${x}px, ${y}px) scale(${t >= c.t - 0.16 && t < c.t + 0.12 ? 0.85 : 1.15})`;

        // Strum thumb sweeps low → high across the plate with the strum.
        const spread = c.t === T.firstChord ? 0.011 : 0.0075;
        const idx = Math.max(0, Math.min(23, Math.floor((t - c.t) / spread)));
        const sr = view.rect(view.stringEl(idx));
        const [sx, sy] = map(sr.x + sr.width / 2, sr.y + sr.height / 2);
        swipeDot.style.opacity = String(prog(t, c.t - 0.12, 0.1) * (1 - prog(t, c.t + 0.22, 0.15)));
        swipeDot.style.transform = `translate(${sx}px, ${sy}px)`;
      }
    }

    // ── Headlines & cards ──
    h1.render(t);
    const lp = easeOutBack(prog(t, T.firstChord, 0.55));
    const lo = window01(t, T.firstChord, 0.2, 7.6, 0.3);
    logoTop.style.opacity = String(lo);
    logoTop.style.transform = `scale(${lerp(1.6, 1, lp)})`;
    s2sub.style.opacity = String(window01(t, 4.6, 0.4, 7.6, 0.3));
    s2sub.style.transform = `translateY(${(1 - easeOutExpo(prog(t, 4.6, 0.6))) * 30}px)`;
    h3.render(t);
    h4.render(t);
    ticker.style.opacity = String(window01(t, 12.6, 0.3, 15.6, 0.3));
    ticker.style.transform = `translate(${-200 - (t - 12) * 170}px, 1500px)`;
    h5.render(t);
    {
      const beatAge = (t - T.arpOn) % 0.5;
      syncBadge.style.opacity = String(window01(t, 16.6, 0.2, 19.6, 0.3));
      syncBadge.style.left = '410px';
      syncBadge.style.top = '1500px';
      syncBadge.style.transform = `scale(${1 + 0.12 * Math.exp(-beatAge * 10)})`;
    }

    cards.forEach(({ c }, i) => {
      const t0 = T.blitz + i * 0.5;
      const local = t - t0;
      if (local < 0 || local >= 0.5) { c.style.opacity = '0'; return; }
      const pin = easeOutExpo(prog(local, 0, 0.14));
      const pout = prog(local, 0.42, 0.08);
      c.style.opacity = String(pin * (1 - pout));
      c.style.transform = `translateY(${640}px) scale(${lerp(1.35, 1, pin) * lerp(1, 0.94, pout)}) rotate(${(i % 2 ? 1 : -1) * (1 - pin) * 4}deg)`;
    });

    // ── Lineup (24–28.4 s) ──
    const lineState = appState(t, { rec: true });
    const exitAll = easeInCubic(prog(t, T.finale - 0.05, 0.25));
    const enter = (t0: number) => easeOutExpo(prog(t, t0, 0.7));
    const move = (t0: number) => easeInOutCubic(prog(t, t0, 0.55));
    const pPhone = enter(T.lineup), pTab = enter(T.lineup + 1), pLap = enter(T.lineup + 2);
    const mPhone = move(T.lineup + 1), mTab = move(T.lineup + 2);
    const grow = 1 + exitAll * 0.3;
    // Phone: rises to center, then moves bottom-right when the tablet arrives.
    phone2.place(lerp(540, 790, mPhone), lerp(lerp(1950, 1200, pPhone), 1440, mPhone), lerp(0.95, 0.56, mPhone) * grow,
      lerp(8, 0, pPhone), Math.min(pPhone * 2, 1) * (1 - exitAll));
    // Tablet: lands top-center, then moves bottom-left when the laptop arrives.
    tablet.place(lerp(540, 310, mTab), lerp(lerp(-200, 800, pTab), 1440, mTab), lerp(0.62, 0.40, mTab) * grow,
      lerp(-6, 0, pTab), Math.min(pTab * 2, 1) * (1 - exitAll));
    laptop.place(540, lerp(560, 790, pLap), lerp(0.95, 0.62, pLap) * grow, 0, Math.min(pLap * 2, 1) * (1 - exitAll));
    if (t >= T.lineup && t < T.finale + 0.4) {
      if (pPhone > 0) phone2App.apply(lineState);
      if (pTab > 0) tabletApp.apply(lineState);
      if (pLap > 0) laptopApp.apply(lineState);
    }
    h7.render(t);

    // ── End card ──
    endCard.style.display = t >= T.finale ? 'flex' : 'none';
    endParts.forEach((part, i) => {
      const p = easeOutBack(prog(t, T.finale + 0.1 + i * 0.25, 0.6));
      part.style.opacity = String(clamp01(p * 1.3));
      part.style.transform = `translateY(${(1 - p) * 60}px) scale(${lerp(0.85, 1, p)})`;
    });
    if (t >= T.finale) renderEndFace(t);
    endCta.style.boxShadow = `0 20px 60px rgba(240,170,40,${0.35 + 0.25 * Math.sin(t * 5)}), inset 0 2px 0 rgba(255,255,255,0.6)`;

    black.style.opacity = String(Math.max(1 - prog(t, 0, 0.25), prog(t, 31.2, 0.8)));
  }

  async function init(): Promise<void> {
    await Promise.all([heroPortrait, heroLandscape, tabletApp, laptopApp, phone2App].map(v => v.load()));
    if (opts.hideHint) heroPortrait.hidePowerHint();
    await document.fonts.ready;
    const btn = heroPortrait.rect('#powerBtn');
    const [bx, by] = heroPortrait.toParent(btn.x + btn.width / 2, btn.y + btn.height / 2);
    powerPt = { x: hero.bezel + bx, y: hero.bezel + by };
    const scr = heroPortrait.rect('#robotScreen');
    const [rx, ry] = heroPortrait.toParent(scr.x + scr.width / 2, scr.y + scr.height / 2);
    robotPt = { x: hero.bezel + rx, y: hero.bezel + ry };
    focusPt = opts.focus === 'robot' ? robotPt : powerPt;
    for (const h of [h1, h3, h4, h5, h7]) h.fit();
    for (const { b } of cards) fitWidth(b, 300, 940);
    fitWidth(endWord, 170, 940);
    fitWidth(logoTopWord, 132, 780);
  }


    return {
      init,
      render: renderFrame,
      robotScreenOnStage: () => hero.toStage(robotPt.x - hero.bezel, robotPt.y - hero.bezel),
    };
  });
}
