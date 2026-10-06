// ─── Sequencer: one clock for rhythm + arpeggiator ───
// Uses the "two clocks" technique: a coarse JS timer wakes up every TICK_MS and
// schedules every event that falls inside the next LOOKAHEAD seconds, at exact
// AudioContext times. Each event time is derived from the previous one
// (nextStepTime += stepDur), never from "now", so timer jitter never reaches
// the audio.

import { freeArpInterval, syncedBeatsPerNote } from './arp';
import type { Hit, Pattern } from './patterns';

export interface Clock {
  readonly currentTime: number;
}

export interface SequencerConfig {
  bpm(): number;
  pattern(): Pattern;
  /** Arp speed slider, 0–1. */
  arpSpeed(): number;
}

export interface SequencerHandlers {
  onHit(hit: Hit, time: number): void;
  /** First step of each bar. */
  onBar(time: number): void;
  onArp(time: number): void;
}

const LOOKAHEAD = 0.12;
const TICK_MS = 25;
/** Small delay before the first event so it is never scheduled in the past. */
const START_DELAY = 0.03;
/** If the timer stalled (background tab) longer than this, skip ahead instead of bursting. */
const MAX_LAG = 0.1;

export class Sequencer {
  private rhythmOn = false;
  private arpOn = false;
  private step = 0;
  private nextStepTime = 0;
  private nextArpTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly cfg: SequencerConfig,
    private readonly handlers: SequencerHandlers,
  ) {}

  get rhythmActive(): boolean { return this.rhythmOn; }
  get arpActive(): boolean { return this.arpOn; }
  /** Arp follows the rhythm grid while both are running. */
  get synced(): boolean { return this.rhythmOn && this.arpOn; }

  startRhythm(): void {
    if (this.rhythmOn) return;
    this.rhythmOn = true;
    this.step = 0;
    this.nextStepTime = this.clock.currentTime + START_DELAY;
    this.run();
  }

  stopRhythm(): void {
    if (!this.rhythmOn) return;
    this.rhythmOn = false;
    // Free-running arp picks up exactly where the grid left off.
    this.nextArpTime = this.nextStepTime;
    this.idleCheck();
  }

  startArp(): void {
    if (this.arpOn) return;
    this.arpOn = true;
    if (!this.rhythmOn) this.nextArpTime = this.clock.currentTime + START_DELAY;
    this.run();
  }

  stopArp(): void {
    if (!this.arpOn) return;
    this.arpOn = false;
    this.idleCheck();
  }

  stopAll(): void {
    this.rhythmOn = false;
    this.arpOn = false;
    this.idleCheck();
  }

  /** Restart the pattern from its first step (on pattern change). Timing is kept. */
  restartPattern(): void {
    this.step = 0;
  }

  /** Schedule everything inside the lookahead window. Public for tests. */
  tick(): void {
    const now = this.clock.currentTime;
    const horizon = now + LOOKAHEAD;

    if (this.rhythmOn) {
      if (this.nextStepTime < now - MAX_LAG) this.nextStepTime = now + START_DELAY;
      while (this.nextStepTime < horizon) {
        const pat = this.cfg.pattern();
        this.scheduleStep(pat, this.nextStepTime);
        this.nextStepTime += 60 / this.cfg.bpm() / pat.stepsPerBeat;
        this.step++;
      }
    } else if (this.arpOn) {
      if (this.nextArpTime < now - MAX_LAG) this.nextArpTime = now + START_DELAY;
      while (this.nextArpTime < horizon) {
        this.handlers.onArp(this.nextArpTime);
        this.nextArpTime += freeArpInterval(this.cfg.arpSpeed());
      }
    }
  }

  private scheduleStep(pat: Pattern, time: number): void {
    const idx = this.step % pat.steps.length;
    if (idx === 0) this.handlers.onBar(time);
    for (const hit of pat.steps[idx]) this.handlers.onHit(hit, time);

    if (this.arpOn) {
      const stepsPerNote = Math.max(1, Math.round(syncedBeatsPerNote(this.cfg.arpSpeed()) * pat.stepsPerBeat));
      if (this.step % stepsPerNote === 0) this.handlers.onArp(time);
    }
  }

  private run(): void {
    this.tick();
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private idleCheck(): void {
    if (this.rhythmOn || this.arpOn || !this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
