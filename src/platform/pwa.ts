// ─── Service worker registration (production builds only) ───

export function registerServiceWorker(onUpdate: () => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const hadController = navigator.serviceWorker.controller !== null;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    // A new worker took over a page that was already controlled: a deploy landed.
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) onUpdate(); });
  });
}
