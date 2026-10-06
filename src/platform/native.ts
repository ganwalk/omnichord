// ─── Native shell integration (Capacitor) ───
// On the web these are light fallbacks; plugin code is only downloaded when
// running inside the Android/iOS app.

import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

/** Short tick when a chord is pressed. */
export function hapticTap(): void {
  if (isNative) {
    void import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
  } else {
    navigator.vibrate?.(8); // Android browsers; iOS Safari has no vibration API
  }
}

/** Dark status bar matching the instrument (native apps only). */
export async function setupNativeChrome(): Promise<void> {
  if (!isNative) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (Capacitor.getPlatform() === 'android') await StatusBar.setBackgroundColor({ color: '#1e1e1e' }).catch(() => {});
}
