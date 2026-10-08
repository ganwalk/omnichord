// Renders the "Conexão" soundtrack offline: the story's sound effects are
// synthesized here; the app's own engine plays the demo's music (shifted).

import { AudioEngine } from '../src/audio/engine';
import { ChordVoice, drum, pluck } from '../src/audio/instruments';
import { DEFAULT_SETTINGS } from '../src/settings';
import { rand } from './lib/anim';
import { toWavBase64 } from './lib/wav';
import { DURATION, S, demoChordOff, demoChords, demoHits, demoPlucks, introPlucks, sfx, type Sfx } from './story-score';

const SAMPLE_RATE = 48000;

async function renderAudio(): Promise<string> {
  const ctx = new OfflineAudioContext(2, SAMPLE_RATE * DURATION, SAMPLE_RATE);
  const engine = new AudioEngine();
  // Same mix as the feature video, so the demo part sounds identical.
  engine.boot({ ...DEFAULT_SETTINGS, reverb: 0.3, chordVol: 0.5, strumVol: 0.85, rhythmVol: 0.6 }, ctx);

  const voice = new ChordVoice(engine);
  for (const c of demoChords) voice.play(c.root, c.type.intervals, 0, c.t);
  voice.stop(demoChordOff);
  for (const p of [...introPlucks, ...demoPlucks]) pluck(engine, p.midi, p.vel, p.t);
  for (const h of demoHits) drum(engine, h.hit, h.t);

  const fx = ctx.createGain();
  fx.gain.value = 1;
  fx.connect(engine.buses.rhythm);
  wind(ctx, fx);
  for (const [t, kind] of sfx) SFX[kind](ctx, fx, t);

  return toWavBase64(await ctx.startRendering());
}

// ═══ Sound effects ═══

type Fx = (ctx: BaseAudioContext, out: AudioNode, t: number) => void;

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rand(i + 1) * 2 - 1;
  return buf;
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(ctx: BaseAudioContext, out: AudioNode, t: number, type: OscillatorType,
  f0: number, f1: number, glide: number, peak: number, attack: number, decay: number): void {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + glide);
  env(g, t, peak, attack, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function noise(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, filter: BiquadFilterType,
  f0: number, f1: number, q: number, peak: number, attack: number): void {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer(ctx, dur + 0.1);
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, peak, attack, Math.max(0.01, dur - attack));
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** The grey void: a soft, hollow wind that dies away when the music arrives. */
function wind(ctx: BaseAudioContext, out: AudioNode): void {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer(ctx, 4);
  src.loop = true;
  f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.8;
  const lfo = ctx.createOscillator(), depth = ctx.createGain();
  lfo.frequency.value = 0.17; depth.gain.value = 180;
  lfo.connect(depth).connect(f.frequency);
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(0.3, 1.5);
  g.gain.setValueAtTime(0.3, S.whip);
  g.gain.exponentialRampToValueAtTime(0.0001, S.arrive);
  src.connect(f).connect(g).connect(out);
  src.start(0); lfo.start(0);
  src.stop(S.arrive + 0.1); lfo.stop(S.arrive + 0.1);
}

const SFX: Record<Sfx, Fx> = {
  sigh: (c, o, t) => tone(c, o, t, 'sine', 420, 250, 0.7, 0.13, 0.12, 0.7),
  glint: (c, o, t) => { tone(c, o, t, 'sine', 2637, 2637, 0.1, 0.05, 0.005, 0.7); tone(c, o, t + 0.07, 'sine', 3951, 3951, 0.1, 0.035, 0.005, 0.6); },
  boop: (c, o, t) => tone(c, o, t - 0.02, 'sine', 240, 430, 0.08, 0.13, 0.01, 0.16),
  pickup: (c, o, t) => tone(c, o, t, 'triangle', 880, 1320, 0.09, 0.07, 0.01, 0.25),
  click: (c, o, t) => { noise(c, o, t, 0.03, 'highpass', 2500, 2500, 0.7, 0.3, 0.002); tone(c, o, t, 'sine', 140, 70, 0.05, 0.25, 0.003, 0.08); },
  sparks: (c, o, t) => {
    for (let i = 0; i < 14; i++) {
      const dt = rand(i * 7 + 3) * 0.38;
      noise(c, o, t + dt, 0.01 + rand(i * 5) * 0.02, 'highpass', 3500, 6000, 0.7, 0.05 + rand(i * 11) * 0.12, 0.001);
    }
  },
  buzz: (c, o, t) => {
    const os = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    os.type = 'square'; os.frequency.value = 110;
    f.type = 'lowpass'; f.frequency.value = 1800;
    env(g, t, 0.06, 0.004, 0.07);
    os.connect(f).connect(g).connect(o);
    os.start(t); os.stop(t + 0.1);
  },
  powerup: (c, o, t) => {
    const os = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    const end = S.power;
    os.type = 'sawtooth';
    os.frequency.setValueAtTime(90, t);
    os.frequency.exponentialRampToValueAtTime(900, end);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(5000, end);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, end - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
    os.connect(f).connect(g).connect(o);
    os.start(t); os.stop(end + 0.1);
  },
  whoosh: (c, o, t) => noise(c, o, t, 0.4, 'bandpass', 500, 4000, 1.0, 0.16, 0.22),
  // The face travels as data: a rising sweep under a patter of bright blips.
  transmit: (c, o, t) => {
    const dur = S.arrive - t;
    tone(c, o, t, 'sine', 300, 2400, dur, 0.06, dur * 0.8, 0.12);
    for (let i = 0; t + i * 0.045 < S.arrive - 0.05; i++) {
      const f = 1100 + rand(i * 17 + 5) * 1500;
      tone(c, o, t + i * 0.045, 'square', f, f, 0.01, 0.018, 0.003, 0.03);
    }
  },
  // Landing in the app: a soft, bright "bloop" up.
  arrive: (c, o, t) => { tone(c, o, t, 'sine', 520, 1560, 0.12, 0.12, 0.01, 0.35); tone(c, o, t + 0.06, 'triangle', 1560, 2080, 0.1, 0.05, 0.01, 0.3); },
};

(window as unknown as { renderAudio: typeof renderAudio }).renderAudio = renderAudio;
