// ─── OmniHarp promo — feature video ───
// Every visual is a pure function of time t (seconds). The render script calls
// window.renderFrame(t) for each frame and screenshots the stage, so timing is
// frame-exact and matches the soundtrack, which is rendered from the same score.

import { createBrag } from './brag';
import { stage } from './lib/dom';

const brag = createBrag(stage());

const w = window as unknown as { promoReady: Promise<void>; renderFrame: (t: number) => void };
w.renderFrame = brag.render;
w.promoReady = brag.init().then(() => brag.render(0));
