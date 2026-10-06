// ─── MIDI keyboard input: play a chord on the controller, OmniSound follows ───

import { recognizeChord, type ChordType } from '../theory';

/** Notes of a chord rarely arrive at the same instant; wait this long before recognizing. */
const SETTLE_MS = 35;

export const midiSupported = (): boolean => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

export class MidiChordInput {
  private access: MIDIAccess | null = null;
  private readonly held = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly onChord: (root: number, type: ChordType) => void,
    private readonly onDevices: (count: number) => void,
  ) {}

  get connected(): boolean { return this.access !== null; }

  /** Ask for MIDI access (shows a permission prompt in some browsers). */
  async connect(): Promise<void> {
    if (this.access) return;
    this.access = await navigator.requestMIDIAccess();
    this.access.addEventListener('statechange', () => this.bindInputs());
    this.bindInputs();
  }

  private bindInputs(): void {
    if (!this.access) return;
    let count = 0;
    this.access.inputs.forEach(input => {
      if (input.state !== 'connected') return;
      count++;
      input.onmidimessage = e => { if (e.data) this.handle(e.data); };
    });
    this.onDevices(count);
  }

  private handle(data: Uint8Array): void {
    const [status, note, velocity] = data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && velocity > 0) this.held.add(note);
    else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) { this.held.delete(note); return; }
    else return;

    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const chord = recognizeChord(this.held);
      if (chord) this.onChord(chord.root, chord.type);
    }, SETTLE_MS);
  }
}
