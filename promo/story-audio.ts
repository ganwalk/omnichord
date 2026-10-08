// Renders the story soundtrack offline: the app's own engine plays the music;
// the story's sound effects are synthesized here.

import { AudioEngine } from '../src/audio/engine';
import { ChordVoice, drum, pluck } from '../src/audio/instruments';
import { DEFAULT_SETTINGS } from '../src/settings';
import { rand } from './lib/anim';
import { toWavBase64 } from './lib/wav';
import { DURATION, S, chords, hits, plucks, sfx, type Sfx } from './story-score';

const SAMPLE_RATE = 48000;

async function renderAudio(): Promise<string> {
  const ctx = new OfflineAudioContext(2, SAMPLE_RATE * DURATION, SAMPLE_RATE);
  const engine = new AudioEngine();
  engine.boot({ ...DEFAULT_SETTINGS, reverb: 0.34, chordVol: 0.5, strumVol: 0.85, rhythmVol: 0.55 }, ctx);

  const voice = new ChordVoice(engine);
  for (const c of chords) voice.play(c.root, c.type.intervals, 0, c.t);
  voice.stop(S.chordOff);
  for (const p of plucks) pluck(engine, p.midi, p.vel, p.t);
  for (const h of hits) drum(engine, h.hit, h.t);

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
  g.gain.setValueAtTime(0.3, S.plug);
  g.gain.exponentialRampToValueAtTime(0.0001, S.power + 0.8);
  src.connect(f).connect(g).connect(out);
  src.start(0); lfo.start(0);
  src.stop(S.power + 1); lfo.stop(S.power + 1);
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
  whoosh: (c, o, t) => noise(c, o, t, 1.0, 'bandpass', 300, 2600, 1.2, 0.09, 0.55),
};

(window as unknown as { renderAudio: typeof renderAudio }).renderAudio = renderAudio;
