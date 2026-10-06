// ─── Keep the screen on while the instrument is powered ───
// The browser drops the lock whenever the page is hidden, so it is requested
// again each time the page becomes visible.

type Sentinel = { release(): Promise<void>; addEventListener(type: 'release', fn: () => void): void };
type WakeLockNavigator = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };

export class ScreenWakeLock {
  private sentinel: Sentinel | null = null;
  private wanted = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (this.wanted && document.visibilityState === 'visible') void this.acquire();
    });
  }

  set enabled(on: boolean) {
    this.wanted = on;
    if (on) void this.acquire();
    else void this.sentinel?.release().catch(() => {});
  }

  private async acquire(): Promise<void> {
    const wl = (navigator as WakeLockNavigator).wakeLock;
    if (!wl || this.sentinel) return;
    try {
      const s = await wl.request('screen');
      this.sentinel = s;
      s.addEventListener('release', () => { if (this.sentinel === s) this.sentinel = null; });
    } catch {
      // Denied (battery saver, unsupported context) — nothing to do.
    }
  }
}
