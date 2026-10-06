// Renders the promo soundtrack offline with the app's own audio engine and voices.

import { AudioEngine } from '../src/audio/engine';
import { ChordVoice, drum, pluck } from '../src/audio/instruments';
import { DEFAULT_SETTINGS } from '../src/settings';
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

/** 16-bit PCM WAV, base64-encoded for transfer out of the page. */
function toWavBase64(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels, len = buf.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++, o += 2) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(data.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

(window as unknown as { renderAudio: typeof renderAudio }).renderAudio = renderAudio;
