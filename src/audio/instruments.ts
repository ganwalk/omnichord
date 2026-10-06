// ─── Voices: sustained chord, plucked string, drum kit ───

import { chordMidi, midiToFreq } from '../theory';
import type { Hit } from '../patterns';
import type { AudioEngine } from './engine';

/** Play a slice of the shared noise buffer through `dest`, starting at `t`. */
function noiseBurst(eng: AudioEngine, dest: AudioNode, t: number, dur: number): void {
  const src = eng.ctx.createBufferSource();
  src.buffer = eng.noise;
  const offset = Math.random() * Math.max(0, eng.noise.duration - dur);
  src.connect(dest);
  src.start(t, offset, dur);
}

// ── Sustained chord ──

interface Voice { osc: OscillatorNode; gain: GainNode }

export class ChordVoice {
  private voices: Voice[] = [];

  constructor(private readonly eng: AudioEngine) {}

  play(root: number, intervals: readonly number[], octave: number): void {
    this.stop();
    const ctx = this.eng.ctx, t = ctx.currentTime;
    const notes = chordMidi(root, intervals, 3 + octave);
    const bass = notes[0] - 12;

    const add = (freq: number, type: OscillatorType, amp: number): void => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.04);
      osc.connect(gain).connect(this.eng.buses.chord);
      osc.start(t);
      this.voices.push({ osc, gain });
    };

    const harmonic = (f: number, h: number, amp: number): void =>
      add(f * h, h === 2 || h === 3 ? 'triangle' : 'sine', amp / (h * 0.7 + 0.3));

    for (const midi of notes) {
      const f = midiToFreq(midi);
      for (const h of [1, 2, 3, 4, 6]) harmonic(f, h, 0.09);
      add(f * 1.0035, 'sine', 0.035); // slight detune for chorus
    }
    for (const h of [1, 2]) harmonic(midiToFreq(bass), h, 0.16);
  }

  stop(): void {
    if (this.voices.length === 0) return;
    const t = this.eng.ctx.currentTime;
    for (const { osc, gain } of this.voices) {
      // Cancel a pending attack ramp first, otherwise it keeps rising after release.
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.setTargetAtTime(0, t, 0.06);
      osc.stop(t + 0.5);
    }
    this.voices = [];
  }
}

// ── Plucked string ──

export function pluck(eng: AudioEngine, midi: number, vel = 1, when?: number): void {
  const ctx = eng.ctx, t = when ?? ctx.currentTime;
  const dest = eng.buses.strum;
  const freq = midiToFreq(midi);

  const osc = ctx.createOscillator(), gain = ctx.createGain(), flt = ctx.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  flt.type = 'lowpass';
  flt.frequency.value = Math.min(freq * 9, 12000);
  flt.Q.value = 0.8;
  gain.gain.setValueAtTime(0.28 * vel, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
  osc.connect(flt).connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + 2.5);

  // Pick noise
  const nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nf.type = 'bandpass';
  nf.frequency.value = Math.min(freq * 1.5, 12000);
  nf.Q.value = 2;
  ng.gain.setValueAtTime(0.18 * vel, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  nf.connect(ng).connect(dest);
  noiseBurst(eng, nf, t, 0.06);

  // Octave shimmer
  const osc2 = ctx.createOscillator(), g2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;
  g2.gain.setValueAtTime(0.09 * vel, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  osc2.connect(g2).connect(dest);
  osc2.start(t);
  osc2.stop(t + 1.6);
}

// ── Drums ──

function kick(eng: AudioEngine, t: number): void {
  const ctx = eng.ctx, dest = eng.buses.rhythm;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(36, t + 0.16);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.3);

  const o2 = ctx.createOscillator(), g2 = ctx.createGain();
  o2.frequency.value = 80;
  g2.gain.setValueAtTime(0.5, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  o2.connect(g2).connect(dest);
  o2.start(t); o2.stop(t + 0.1);
}

function snare(eng: AudioEngine, t: number): void {
  const ctx = eng.ctx, dest = eng.buses.rhythm;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = 200;
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.2);

  const nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nf.type = 'bandpass';
  nf.frequency.value = 2800;
  nf.Q.value = 0.6;
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  nf.connect(ng).connect(dest);
  noiseBurst(eng, nf, t, 0.22);
}

function hihat(eng: AudioEngine, t: number, open: boolean): void {
  const ctx = eng.ctx;
  const dur = open ? 0.2 : 0.04;
  const hf = ctx.createBiquadFilter(), g = ctx.createGain();
  hf.type = 'highpass';
  hf.frequency.value = 7000;
  g.gain.setValueAtTime(open ? 0.25 : 0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  hf.connect(g).connect(eng.buses.rhythm);
  noiseBurst(eng, hf, t, dur);
}

function rimshot(eng: AudioEngine, t: number): void {
  const ctx = eng.ctx;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = 900;
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.connect(g).connect(eng.buses.rhythm);
  o.start(t); o.stop(t + 0.05);
}

export function drum(eng: AudioEngine, hit: Hit, t: number): void {
  switch (hit) {
    case 'k': return kick(eng, t);
    case 's': return snare(eng, t);
    case 'h': return hihat(eng, t, false);
    case 'o': return hihat(eng, t, true);
    case 'r': return rimshot(eng, t);
  }
}
