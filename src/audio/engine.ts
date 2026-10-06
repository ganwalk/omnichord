// ─── Audio engine: context lifecycle, mixer buses and shared resources ───
//
//   chord ─► tone LPF ─┬─► dry ─┐
//   strum ─────────────┤        ├─► master ─► out
//   rhythm ────────────┴─► reverb ─► wet ─┘

import { reverbMix, toneToCutoff, type Settings } from '../settings';

/** Time constant for parameter changes from the UI — avoids zipper noise. */
const SMOOTH = 0.015;

export interface Buses {
  chord: GainNode;
  strum: GainNode;
  rhythm: GainNode;
}

interface Graph {
  master: GainNode;
  dry: GainNode;
  wet: GainNode;
  tone: BiquadFilterNode;
  buses: Buses;
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export class AudioEngine {
  private _ctx: BaseAudioContext | null = null;
  private graph: Graph | null = null;
  private _noise: AudioBuffer | null = null;
  private recordTap: MediaStreamAudioDestinationNode | null = null;

  get ctx(): BaseAudioContext {
    if (!this._ctx) throw new Error('AudioEngine used before boot()');
    return this._ctx;
  }
  get buses(): Buses {
    if (!this.graph) throw new Error('AudioEngine used before boot()');
    return this.graph.buses;
  }
  /** One second of shared white noise; voices play slices of it. */
  get noise(): AudioBuffer {
    if (!this._noise) throw new Error('AudioEngine used before boot()');
    return this._noise;
  }
  get booted(): boolean { return this._ctx !== null; }

  /**
   * Create (first call) or resume the context. Must run inside a user gesture.
   * `context` lets tools render offline (OfflineAudioContext) with the same graph.
   */
  boot(settings: Settings, context?: BaseAudioContext): void {
    if (this._ctx) {
      void this.resume();
      return;
    }
    // iOS: play through the ringer/silent switch like a music app.
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession) nav.audioSession.type = 'playback';

    const ctx = context ?? new AudioContext({ latencyHint: 'interactive' });
    this._ctx = ctx;
    this._noise = makeNoise(ctx, 1);

    const g = (): GainNode => ctx.createGain();
    const master = g(), dry = g(), wet = g();
    const chord = g(), strum = g(), rhythm = g();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.value = 0.5;
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.8);

    chord.connect(tone);
    for (const src of [tone, strum, rhythm]) { src.connect(dry); src.connect(reverb); }
    reverb.connect(wet);
    dry.connect(master);
    wet.connect(master);
    master.connect(ctx.destination);

    this.graph = { master, dry, wet, tone, buses: { chord, strum, rhythm } };
    this.apply(settings, true);
  }

  /** Push mixer settings to the graph. */
  apply(s: Settings, immediate = false): void {
    const gr = this.graph;
    if (!gr || !this._ctx) return;
    const set = (p: AudioParam, v: number): void => {
      if (immediate) p.value = v;
      else p.setTargetAtTime(v, this._ctx!.currentTime, SMOOTH);
    };
    const [dry, wet] = reverbMix(s.reverb);
    set(gr.master.gain, s.master);
    set(gr.buses.chord.gain, s.chordVol);
    set(gr.buses.strum.gain, s.strumVol);
    set(gr.buses.rhythm.gain, s.rhythmVol);
    set(gr.tone.frequency, toneToCutoff(s.tone));
    set(gr.dry.gain, dry);
    set(gr.wet.gain, wet);
  }

  /** Stream of the master output, for recording. */
  recordingStream(): MediaStream {
    if (!this.graph || !(this._ctx instanceof AudioContext)) throw new Error('AudioEngine used before boot()');
    if (!this.recordTap) {
      this.recordTap = this._ctx.createMediaStreamDestination();
      this.graph.master.connect(this.recordTap);
    }
    return this.recordTap.stream;
  }

  async resume(): Promise<void> {
    if (this._ctx instanceof AudioContext && this._ctx.state !== 'running') await this._ctx.resume();
  }

  /** Release the audio hardware (saves battery while powered off). */
  async suspend(): Promise<void> {
    if (this._ctx instanceof AudioContext && this._ctx.state === 'running') await this._ctx.suspend();
  }
}

function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  }
  return buf;
}
