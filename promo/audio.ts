// Renders the promo soundtrack offline with the app's own audio engine and voices.

import { AudioEngine } from '../src/audio/engine';
import { ChordVoice, drum, pluck } from '../src/audio/instruments';
import { DEFAULT_SETTINGS } from '../src/settings';
import { toWavBase64 } from './lib/wav';
import { DURATION, T, chords, hits, plucks } from './score';

const SAMPLE_RATE = 48000;

async function renderAudio(): Promise<string> {
  const ctx = new OfflineAudioContext(2, SAMPLE_RATE * DURATION, SAMPLE_RATE);
  const engine = new AudioEngine();
  engine.boot({ ...DEFAULT_SETTINGS, reverb: 0.3, chordVol: 0.5, strumVol: 0.85, rhythmVol: 0.6 }, ctx);

  const voice = new ChordVoice(engine);
  for (const c of chords) voice.play(c.root, c.type.intervals, 0, c.t);
  voice.stop(T.chordOff);
  for (const p of plucks) pluck(engine, p.midi, p.vel, p.t);
  for (const h of hits) drum(engine, h.hit, h.t);

  return toWavBase64(await ctx.startRendering());
}

(window as unknown as { renderAudio: typeof renderAudio }).renderAudio = renderAudio;
