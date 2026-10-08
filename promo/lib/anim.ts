// ─── Animation helpers: everything is a pure function of time t (seconds) ───

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const prog = (t: number, t0: number, dur: number): number => clamp01((t - t0) / dur);
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export const easeOutExpo = (x: number): number => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeInCubic = (x: number): number => x * x * x;
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeInOutCubic = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeInOutSine = (x: number): number => -(Math.cos(Math.PI * x) - 1) / 2;
export const easeOutBack = (x: number): number => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
/** Fade in over [a, a+din], out over [b, b+dout]. */
export const window01 = (t: number, a: number, din: number, b: number, dout: number): number =>
  Math.min(prog(t, a, din), 1 - prog(t, b, dout));

export type Ease = (x: number) => number;
/** A keyframe: [time, value, easing used to arrive at this key]. */
export type Key = [t: number, v: number, ease?: Ease];

/** Interpolate keyframes (sorted by time); holds the first/last value outside the range. */
export function track(t: number, keys: Key[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease = easeInOutCubic] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, ease(t1 === t0 ? 1 : (t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

/** Deterministic pseudo-random in [0, 1) from an integer seed (same every frame/render). */
export function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
