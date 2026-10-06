// ─── Record the master output to a downloadable audio file ───

import type { AudioEngine } from './engine';

/** Container/codec candidates, best first (Chrome/Firefox: WebM; Safari: MP4). */
const TYPES: [mime: string, ext: string][] = [
  ['audio/webm;codecs=opus', 'webm'],
  ['audio/webm', 'webm'],
  ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
  ['audio/mp4', 'm4a'],
  ['audio/ogg;codecs=opus', 'ogg'],
];

export const recordingSupported = (): boolean =>
  typeof MediaRecorder !== 'undefined' && TYPES.some(([m]) => MediaRecorder.isTypeSupported(m));

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ext = 'webm';

  constructor(private readonly engine: AudioEngine) {}

  get recording(): boolean { return this.rec?.state === 'recording'; }

  start(): void {
    if (this.recording) return;
    const [mime, ext] = TYPES.find(([m]) => MediaRecorder.isTypeSupported(m))!;
    this.ext = ext;
    this.chunks = [];
    this.rec = new MediaRecorder(this.engine.recordingStream(), { mimeType: mime, audioBitsPerSecond: 192_000 });
    this.rec.addEventListener('dataavailable', e => { if (e.data.size) this.chunks.push(e.data); });
    this.rec.start(1000);
  }

  /** Stop and resolve with the recorded file. */
  stop(): Promise<File | null> {
    const rec = this.rec;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    return new Promise(resolve => {
      rec.addEventListener('stop', () => {
        this.rec = null;
        if (this.chunks.length === 0) return resolve(null);
        const type = rec.mimeType || this.chunks[0].type;
        resolve(new File(this.chunks, `omnisound-${timestamp()}.${this.ext}`, { type }));
      }, { once: true });
      rec.stop();
    });
  }
}

const timestamp = (d = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

/** Hand the file to the user: share sheet where available (phones), else a download. */
export async function deliverFile(file: File): Promise<void> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name }); return; } catch { /* cancelled → fall back */ }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
