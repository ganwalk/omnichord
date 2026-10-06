// ─── Robot face on the "sys monitor" screen ───

const STATES = {
  sleep: { face: '(×_×)',  status: 'SLEEP' },
  idle:  { face: '(·_·)',  status: 'READY' },
  chord: { face: '(◉ω◉)',  status: 'CHORD!' },
  strum: { face: '(★ω★)',  status: 'STRUM~' },
  beat:  { face: '(^o^)♪', status: 'BEAT!' },
  blink: { face: '(-_-)',  status: '· · ·' },
} as const;

type RobotState = keyof typeof STATES;
export type RobotEvent = 'chord' | 'strum' | 'beat';

const EVENT_HOLD_MS: Record<RobotEvent, number> = { beat: 200, strum: 280, chord: 500 };

export class Robot {
  private current: RobotState = 'sleep';
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly faceEl: HTMLElement,
    private readonly statusEl: HTMLElement,
    private readonly isOn: () => boolean,
  ) {
    this.set('sleep');
    // Occasional idle blink
    setInterval(() => {
      if (this.isOn() && this.current === 'idle' && Math.random() < 0.08) this.blink(120);
    }, 600);
  }

  set(state: RobotState): void {
    clearTimeout(this.timer);
    this.current = state;
    this.faceEl.textContent = STATES[state].face;
    this.statusEl.textContent = STATES[state].status;
  }

  event(ev: RobotEvent): void {
    if (!this.isOn()) return;
    this.set(ev);
    this.timer = setTimeout(() => {
      if (Math.random() < 0.15) this.blink(100);
      else this.set('idle');
    }, EVENT_HOLD_MS[ev]);
  }

  private blink(ms: number): void {
    this.set('blink');
    this.timer = setTimeout(() => this.set('idle'), ms);
  }
}
