// ─── The robot's CRT face: shared by the app icon, the end card and the robot character ───
// Drawn in the icon's 512×512 space (screen at 84..428 × 136..376, center 256,256).

export const FACE_STATES = {
  chord: '<circle cx="196" cy="242" r="33"/><circle cx="316" cy="242" r="33"/><path d="M226 290 q15 30 30 0 q15 30 30 0"/>'
    + '<circle cx="196" cy="242" r="13" class="fill"/><circle cx="316" cy="242" r="13" class="fill"/>',
  happy: '<path d="M168 220 L222 242 L168 264"/><path d="M344 220 L290 242 L344 264"/><path d="M226 290 q15 30 30 0 q15 30 30 0"/>',
  strum: `${star(196, 242)}${star(316, 242)}<path d="M226 290 q15 30 30 0 q15 30 30 0"/>`,
  beat: '<path d="M166 258 L196 222 L226 258"/><path d="M286 258 L316 222 L346 258"/><circle cx="256" cy="300" r="17"/>',
  idle: '<circle cx="196" cy="240" r="15" class="fill"/><circle cx="316" cy="240" r="15" class="fill"/><path d="M224 304 H288"/>',
  blink: '<path d="M166 242 H226"/><path d="M286 242 H346"/><path d="M224 304 H288"/>',
  // Story moods
  sad: '<path d="M168 236 q28 22 56 0"/><path d="M288 236 q28 22 56 0"/><path d="M228 310 q28 -26 56 0"/>'
    + '<path d="M176 212 L218 222" /><path d="M336 212 L294 222"/>',
  curious: '<circle cx="196" cy="242" r="30"/><circle cx="316" cy="242" r="30"/>'
    + '<circle class="pupil fill" cx="196" cy="242" r="12"/><circle class="pupil fill" cx="316" cy="242" r="12"/><path d="M236 304 H276"/>',
  wow: '<circle cx="196" cy="236" r="34"/><circle cx="316" cy="236" r="34"/>'
    + '<circle cx="196" cy="236" r="14" class="fill"/><circle cx="316" cy="236" r="14" class="fill"/><ellipse cx="256" cy="304" rx="15" ry="19"/>',
} as const;
export type Face = keyof typeof FACE_STATES;

export function star(cx: number, cy: number, r = 34): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(' ')}" class="fill" stroke-linejoin="round"/>`;
}

/** Gradients/filters used by the CRT (ids prefixed so several copies can share a page). */
export function crtDefs(p: string): string {
  return `
    <radialGradient id="${p}-crt" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#03301a"/><stop offset=".6" stop-color="#001a0a"/><stop offset="1" stop-color="#000804"/></radialGradient>
    <pattern id="${p}-scan" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#000" opacity=".28"/></pattern>
    <filter id="${p}-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

/** The CRT screen with every face state as a hidden group (toggle with showFace). */
export function crtScreen(p: string): string {
  return `
    <rect x="70" y="122" width="372" height="268" rx="46" fill="#0b1a0e" stroke="#000" stroke-width="6"/>
    <rect x="84" y="136" width="344" height="240" rx="34" fill="url(#${p}-crt)"/>
    <rect class="crt-tint" x="84" y="136" width="344" height="240" rx="34" fill="#00e060" opacity=".06"/>
    <g class="face" fill="none" stroke="#3dff8f" stroke-width="13" stroke-linecap="round" filter="url(#${p}-glow)">
      <path d="M136 186 Q104 256 136 326"/><path d="M376 186 Q408 256 376 326"/>
      ${Object.entries(FACE_STATES).map(([k, v]) => `<g data-face="${k}">${v}</g>`).join('')}
    </g>
    <rect x="84" y="136" width="344" height="240" rx="34" fill="url(#${p}-scan)"/>
    <path d="M110 150 H402 Q414 150 414 162 V176 Q256 196 98 176 V162 Q98 150 110 150 Z" fill="#fff" opacity=".06"/>`;
}

/** The full app icon (body + screen), as in scripts/icon.svg. */
export function iconSvg(p: string, size: number): string {
  return `
<svg viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="${p}-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3632"/><stop offset=".45" stop-color="#1e1c1a"/><stop offset="1" stop-color="#0e0d0c"/></linearGradient>
    <clipPath id="${p}-round"><rect width="512" height="512" rx="113"/></clipPath>
    ${crtDefs(p)}
  </defs>
  <g clip-path="url(#${p}-round)">
    <rect width="512" height="512" fill="url(#${p}-body)"/>
    ${crtScreen(p)}
  </g>
</svg>`;
}

/** Show one face state inside a container built with crtScreen(). */
export function showFace(root: Element, face: Face): void {
  root.querySelectorAll<SVGGElement>('[data-face]').forEach(g => { g.style.display = g.dataset.face === face ? 'inline' : 'none'; });
}

/** One mood per beat, with a quick blink at the end of "idle" (end cards). */
export const FACE_LOOP: Face[] = ['strum', 'chord', 'happy', 'beat', 'idle'];
export function loopFace(local: number, beat = 0.5): Face {
  const f = FACE_LOOP[Math.floor(local / beat) % FACE_LOOP.length];
  return f === 'idle' && local % beat > beat * 0.72 ? 'blink' : f;
}
