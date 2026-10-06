import './styles.css';

import { ARP_MODE_NAMES, newArpState, nextArpPos } from './arp';
import { AudioEngine } from './audio/engine';
import { ChordVoice, drum, pluck } from './audio/instruments';
import { Recorder, deliverFile, recordingSupported } from './audio/recorder';
import { applyTranslations, strings, t } from './i18n';
import { PATTERNS, findPattern } from './patterns';
import { MidiChordInput, midiSupported } from './platform/midi';
import { hapticTap, setupNativeChrome } from './platform/native';
import { registerServiceWorker } from './platform/pwa';
import { ScreenWakeLock } from './platform/wakeLock';
import { Sequencer } from './sequencer';
import { type Settings } from './settings';
import { loadSettings, saveSettings } from './storage';
import { NOTE_NAMES, diatonicChords, distinctStringIndices, keyName, strumMidi, type ChordType } from './theory';
import { ChordGrid, pageOf } from './ui/chordGrid';
import { bindKeyboard } from './ui/keyboard';
import { Robot } from './ui/robot';
import { Strumplate } from './ui/strumplate';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

// ═══ State ═══

const settings: Settings = loadSettings();
const engine = new AudioEngine();
const chordVoice = new ChordVoice(engine);
const recorder = new Recorder(engine);
const wakeLock = new ScreenWakeLock();

let powered = false;
let selRoot: number | null = null;
let selType: ChordType | null = null;
let strumNotes: number[] = [];
let arpIndices: number[] = []; // string index of each distinct strumplate note
let arpState = newArpState();

// ═══ Views ═══

const robot = new Robot($('robotFace'), $('robotStatus'), () => powered);
const grid = new ChordGrid($('chordGrid'), (root, type) => {
  if (powered) hapticTap();
  selectChord(root, type);
});
const strumplate = new Strumplate($('strumplate'), {
  canPlay: () => powered,
  onPluck: (idx, delay) => playString(idx, 1, engine.ctx.currentTime + delay),
});

/** Run `fn` when the audio clock reaches `time` (for visuals of scheduled notes). */
function atAudioTime(time: number, fn: () => void): void {
  setTimeout(fn, Math.max(0, (time - engine.ctx.currentTime) * 1000));
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function setDisplay(text: string, root: string, sym: string): void {
  $('led').textContent = text;
  $('chordRoot').textContent = root;
  $('chordSym').textContent = sym;
  $('chordBadge').classList.toggle('has-chord', selRoot !== null);
}

// ═══ Chords & strings ═══

function selectChord(root: number, type: ChordType): void {
  if (!powered) return;
  engine.boot(settings);
  selRoot = root;
  selType = type;
  grid.setSelected(root, type);
  // A keyboard shortcut may pick a chord on the hidden page of a compact layout.
  if (grid.page !== pageOf(type)) setPage(pageOf(type));
  setDisplay(NOTE_NAMES[root] + type.sym, NOTE_NAMES[root], type.sym);
  chordVoice.play(root, type.intervals, settings.octave);
  rebuildStrumNotes();
  robot.event('chord');
}

/** Silence the chord and deselect it; strumplate and arp go quiet too. */
function clearChord(): void {
  if (engine.booted) chordVoice.stop();
  selRoot = null;
  selType = null;
  strumNotes = [];
  arpIndices = [];
  grid.setSelected(null, null);
  strumplate.setNotes([]);
  setDisplay(powered ? 'READY' : '– – –', '–', '');
  if (powered) robot.set('idle');
}

function rebuildStrumNotes(): void {
  if (selRoot === null || !selType) return;
  strumNotes = strumMidi(selRoot, selType.intervals, settings.octave);
  arpIndices = distinctStringIndices(strumNotes);
  strumplate.setNotes(strumNotes, selRoot);
}

function playString(idx: number, vel: number, time: number): void {
  const midi = strumNotes[idx];
  if (midi === undefined) return;
  pluck(engine, midi, vel, time);
  atAudioTime(time, () => {
    strumplate.animate(idx);
    robot.event('strum');
  });
}

// ═══ Rhythm & arpeggiator ═══

const sequencer = new Sequencer(
  { get currentTime() { return engine.ctx.currentTime; } },
  {
    bpm: () => settings.bpm,
    pattern: () => findPattern(settings.pattern),
    arpSpeed: () => settings.arpSpeed,
  },
  {
    onHit: (hit, time) => drum(engine, hit, time),
    onBar: time => atAudioTime(time, () => robot.event('beat')),
    onArp: time => {
      if (arpIndices.length === 0) return;
      const pos = nextArpPos(settings.arpMode, arpState, arpIndices.length);
      playString(arpIndices[pos], 0.7 * settings.arpVol, time);
    },
  },
);

function toggleRhythm(): void {
  if (!powered) return;
  engine.boot(settings);
  if (sequencer.rhythmActive) sequencer.stopRhythm();
  else sequencer.startRhythm();
  arpState = newArpState();
  syncTransport();
}

function toggleArp(): void {
  if (!powered) return;
  engine.boot(settings);
  if (sequencer.arpActive) sequencer.stopArp();
  else { arpState = newArpState(); sequencer.startArp(); }
  syncTransport();
}

/** Transport buttons exist twice (quick bar + panels); keep every copy in sync. */
function syncTransport(): void {
  document.querySelectorAll('[data-action="rhythm"]').forEach(b => {
    b.textContent = sequencer.rhythmActive ? '⏹ STOP' : '▶ PLAY';
    b.classList.toggle('active', sequencer.rhythmActive);
  });
  document.querySelectorAll('[data-action="arp"]').forEach(b => {
    b.textContent = sequencer.arpActive ? '⏹ ARP' : '▶ ARP';
    b.classList.toggle('active', sequencer.arpActive);
  });
  const badge = $('arpSyncBadge');
  badge.textContent = sequencer.synced ? 'SYNC' : 'FREE';
  badge.classList.toggle('synced', sequencer.synced);
}

// ═══ Compact layouts: chord pages + controls sheet ═══

function setPage(page: number): void {
  grid.setPage(page);
  const btn = $('pageBtn');
  btn.textContent = grid.page === 0 ? '⇅ EXT' : '⇅ BASIC';
  btn.setAttribute('aria-label', t(grid.page === 0 ? 'pageExt' : 'pageBasic'));
}

const sheetToggle = document.querySelector<HTMLElement>('.quickbar [data-action="sheet"]')!;

function setSheet(open: boolean): void {
  $('instrument').classList.toggle('sheet-open', open);
  sheetToggle.setAttribute('aria-expanded', String(open));
  if (open) $('controls').querySelector<HTMLElement>('.sheet-header button')?.focus();
  else if ($('controls').contains(document.activeElement)) sheetToggle.focus();
}

const sheetOpen = (): boolean => $('instrument').classList.contains('sheet-open');

// The sheet only exists in compact layouts; close it when leaving them.
// Keep in sync with the compact media queries in styles.css.
const COMPACT_QUERY = '(orientation: landscape) and (max-height: 500px), (orientation: portrait) and (max-width: 600px)';
matchMedia(COMPACT_QUERY).addEventListener('change', e => { if (!e.matches) setSheet(false); });

/** Esc: close the sheet first, otherwise silence the chord. */
function escape(): void {
  if (sheetOpen()) setSheet(false);
  else clearChord();
}

// ═══ Power ═══

function togglePower(): void {
  powered = !powered;
  const led = $('powerLed');
  $('instrument').classList.toggle('powered-off', !powered);
  $('powerBtn').classList.toggle('on', powered);
  $('powerBtn').setAttribute('aria-pressed', String(powered));

  wakeLock.enabled = powered;
  if (powered) {
    engine.boot(settings);
    led.classList.add('on', 'green');
    $('powerTooltip').classList.add('hidden');
    robot.set('idle');
    clearChord();
  } else {
    void stopRecording();
    sequencer.stopAll();
    syncTransport();
    clearChord();
    robot.set('sleep');
    led.classList.remove('green');
    setTimeout(() => led.classList.remove('on'), 300); // brief red standby blink
    // Let the release tails ring out, then free the audio hardware.
    setTimeout(() => { if (!powered) void engine.suspend(); }, 800);
  }
}

// Mobile browsers may suspend/interrupt audio in the background (calls, app switch).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && powered) void engine.resume();
});

// ═══ Tools: key highlight, recording, MIDI ═══

function setKey(key: number | null): void {
  settings.key = key;
  grid.setKeyHighlight(key === null ? null : diatonicChords(key));
  saveSettings(settings);
}

function syncRecButton(): void {
  const btn = $<HTMLButtonElement>('recBtn');
  btn.textContent = recorder.recording ? t('recStop') : t('recStart');
  btn.classList.toggle('recording', recorder.recording);
  $('instrument').classList.toggle('recording', recorder.recording);
}

async function stopRecording(): Promise<void> {
  if (!recorder.recording) return;
  const file = await recorder.stop();
  syncRecButton();
  if (file) {
    await deliverFile(file);
    toast(`${t('recSaved')}: ${file.name}`);
  }
}

function toggleRecording(): void {
  if (!powered) return;
  if (recorder.recording) { void stopRecording(); return; }
  engine.boot(settings);
  recorder.start();
  syncRecButton();
}

const midi = new MidiChordInput(
  (root, type) => selectChord(root, type),
  count => { $('midiStatus').textContent = count ? strings.midiDevices(count) : t('midiNoDevices'); },
);

async function connectMidi(): Promise<void> {
  try {
    await midi.connect();
    $('midiBtn').classList.add('active');
  } catch {
    $('midiStatus').textContent = t('midiDenied');
  }
}

function initTools(): void {
  const select = $<HTMLSelectElement>('keySelect');
  select.add(new Option(`— ${t('keyOff')} —`, ''));
  NOTE_NAMES.forEach((_, k) => select.add(new Option(keyName(k), String(k))));
  select.value = settings.key === null ? '' : String(settings.key);
  select.addEventListener('change', () => setKey(select.value === '' ? null : Number(select.value)));
  setKey(settings.key);

  const rec = $<HTMLButtonElement>('recBtn');
  if (!recordingSupported()) { rec.disabled = true; rec.title = t('recUnsupported'); }
  syncRecButton();

  const midiBtn = $<HTMLButtonElement>('midiBtn');
  midiBtn.textContent = t('midi');
  if (!midiSupported()) { midiBtn.disabled = true; midiBtn.title = t('midiUnsupported'); }
}

// ═══ Controls ═══

type UnitKey = 'master' | 'chordVol' | 'strumVol' | 'tone' | 'reverb' | 'rhythmVol' | 'arpVol' | 'arpSpeed';

function initControls(): void {
  // 0–100 sliders mapped to 0–1 settings.
  document.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach(input => {
    const key = input.dataset.setting as UnitKey;
    input.value = String(Math.round(settings[key] * 100));
    input.addEventListener('input', () => {
      settings[key] = Number(input.value) / 100;
      engine.apply(settings);
      saveSettings(settings);
    });
  });

  const bpmInput = $<HTMLInputElement>('bpmCtrl');
  const setBpm = (bpm: number): void => {
    settings.bpm = bpm;
    bpmInput.value = String(bpm);
    $('bpmVal').textContent = String(bpm);
    saveSettings(settings);
  };
  setBpm(settings.bpm);
  // The sequencer reads the tempo on every step, so changes apply smoothly.
  bpmInput.addEventListener('input', () => setBpm(Number(bpmInput.value)));

  const octBtns = document.querySelectorAll<HTMLButtonElement>('.oct-btn');
  octBtns.forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.oct) === settings.octave);
    btn.addEventListener('click', () => {
      octBtns.forEach(b => b.classList.toggle('active', b === btn));
      settings.octave = Number(btn.dataset.oct) as Settings['octave'];
      saveSettings(settings);
      if (powered && selRoot !== null && selType) selectChord(selRoot, selType);
    });
  });

  buildToggleGroup($('patternBtns'), PATTERNS.map(p => p.name), settings.pattern, name => {
    settings.pattern = name;
    setBpm(findPattern(name).bpm);
    sequencer.restartPattern();
  });
  buildToggleGroup($('arpModeBtns'), ARP_MODE_NAMES, settings.arpMode, name => {
    settings.arpMode = name;
    arpState = newArpState();
    saveSettings(settings);
  });

  const actions: Record<string, () => void> = {
    rhythm: toggleRhythm,
    arp: toggleArp,
    page: () => setPage(grid.page + 1),
    sheet: () => setSheet(!sheetOpen()),
    record: toggleRecording,
    midi: () => void connectMidi(),
  };
  document.addEventListener('click', e => {
    const el = (e.target as Element).closest<HTMLElement>('[data-action]');
    if (el) actions[el.dataset.action!]?.();
  });
  $('powerBtn').addEventListener('click', togglePower);
  $('chordBadge').addEventListener('click', clearChord);
}

function buildToggleGroup(container: HTMLElement, names: string[], active: string, onSelect: (name: string) => void): void {
  const btns = names.map(name => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mode-btn' + (name === active ? ' active' : '');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.toggle('active', b === btn));
      onSelect(name);
    });
    container.appendChild(btn);
    return btn;
  });
}

function buildSpeakerGrille(): void {
  const grille = $('speakerGrille');
  for (let i = 0; i < 36; i++) grille.appendChild(Object.assign(document.createElement('div'), { className: 'gd' }));
}

// ═══ Init ═══

applyTranslations();
initControls();
initTools();
buildSpeakerGrille();
setPage(0);
syncTransport();
bindKeyboard({
  get powered() { return powered; },
  togglePower,
  selectChord,
  escape,
  toggleRhythm,
});
void setupNativeChrome();
registerServiceWorker(() => toast(t('updated')));
