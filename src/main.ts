import './styles.css';

import { ARP_MODE_NAMES, newArpState, nextArpPos } from './arp';
import { AudioEngine } from './audio/engine';
import { ChordVoice, drum, pluck } from './audio/instruments';
import { PATTERNS, findPattern } from './patterns';
import { Sequencer } from './sequencer';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { NOTE_NAMES, distinctStringIndices, strumMidi, type ChordType } from './theory';
import { ChordGrid } from './ui/chordGrid';
import { bindKeyboard } from './ui/keyboard';
import { Robot } from './ui/robot';
import { Strumplate } from './ui/strumplate';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

// ═══ State ═══

const settings: Settings = { ...DEFAULT_SETTINGS };
const engine = new AudioEngine();
const chordVoice = new ChordVoice(engine);

let powered = false;
let selRoot: number | null = null;
let selType: ChordType | null = null;
let strumNotes: number[] = [];
let arpIndices: number[] = []; // string index of each distinct strumplate note
let arpState = newArpState();

// ═══ Views ═══

const robot = new Robot($('robotFace'), $('robotStatus'), () => powered);
const grid = new ChordGrid($('chordGrid'), (root, type) => selectChord(root, type));
const strumplate = new Strumplate($('strumplate'), {
  canPlay: () => powered,
  onPluck: (idx, delay) => playString(idx, 1, engine.ctx.currentTime + delay),
});

/** Run `fn` when the audio clock reaches `time` (for visuals of scheduled notes). */
function atAudioTime(time: number, fn: () => void): void {
  setTimeout(fn, Math.max(0, (time - engine.ctx.currentTime) * 1000));
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
  strumplate.setNotes(strumNotes);
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

function syncTransport(): void {
  const rb = $('rhythmBtn'), ab = $('autoStrumBtn'), badge = $('arpSyncBadge');
  rb.textContent = sequencer.rhythmActive ? '⏹ STOP' : '▶ PLAY';
  rb.classList.toggle('active', sequencer.rhythmActive);
  ab.textContent = sequencer.arpActive ? '⏹ ARP' : '▶ ARP';
  ab.classList.toggle('active', sequencer.arpActive);
  badge.textContent = sequencer.synced ? 'SYNC' : 'FREE';
  badge.classList.toggle('synced', sequencer.synced);
}

// ═══ Power ═══

function togglePower(): void {
  powered = !powered;
  const led = $('powerLed');
  $('instrument').classList.toggle('powered-off', !powered);
  $('powerBtn').classList.toggle('on', powered);
  $('powerBtn').setAttribute('aria-pressed', String(powered));

  if (powered) {
    engine.boot(settings);
    led.classList.add('on', 'green');
    $('powerTooltip').classList.add('hidden');
    robot.set('idle');
    clearChord();
  } else {
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
    });
  });

  const bpmInput = $<HTMLInputElement>('bpmCtrl');
  const setBpm = (bpm: number): void => {
    settings.bpm = bpm;
    bpmInput.value = String(bpm);
    $('bpmVal').textContent = String(bpm);
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
  });

  $('rhythmBtn').addEventListener('click', toggleRhythm);
  $('autoStrumBtn').addEventListener('click', toggleArp);
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

initControls();
buildSpeakerGrille();
syncTransport();
bindKeyboard({
  get powered() { return powered; },
  togglePower,
  selectChord,
  clearChord,
  toggleRhythm,
});
