// Render the OmniHarp promo videos.
//
//   node promo/render.cjs                      → promo/out/omniharp-promo.mp4 (+ poster)
//   node promo/render.cjs --video story        → promo/out/omniharp-story.mp4 (+ poster)
//   node promo/render.cjs --stills 4.2,13      → promo/out/still-4.20.png, still-13.00.png
//
// Requires Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`,
// then run with NODE_PATH="$(npm root -g)") and ffmpeg on the PATH.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const FPS = 30;
const PORT = 5199;

const VIDEOS = {
  // Feature "brag" promo: phones are touch devices.
  brag: { page: 'video.html', audio: 'audio.html', out: 'omniharp-promo.mp4', poster: 'poster.png', posterT: 29.5, duration: 32, hasTouch: true },
  // Story promo: wordless robot intro, then the feature demo (touch devices, like the feature video).
  story: { page: 'story.html', audio: 'story-audio.html', out: 'omniharp-story.mp4', poster: 'story-poster.png', posterT: 36.3, duration: 38.8, hasTouch: true },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const stillsArg = process.argv.indexOf('--stills');
  const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null;
  const videoArg = process.argv.indexOf('--video');
  const V = VIDEOS[videoArg > 0 ? process.argv[videoArg + 1] : 'brag'];
  if (!V) throw new Error(`unknown --video; use one of: ${Object.keys(VIDEOS).join(', ')}`);

  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { port: PORT, strictPort: true },
    // Pre-bundle everything up front so pages never reload mid-render.
    optimizeDeps: { entries: ['index.html', 'promo/*.html'] },
  });
  await server.listen();
  const base = `http://localhost:${PORT}`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  try {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, hasTouch: V.hasTouch, locale: 'pt-BR' });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.goto(`${base}/promo/${V.page}`);
    await page.evaluate(() => window.promoReady);

    if (stills) {
      for (const t of stills) {
        await page.evaluate(t => window.renderFrame(t), t);
        await page.screenshot({ path: path.join(OUT, `still-${t.toFixed(2)}.png`) });
      }
      console.log(`stills written to ${OUT}`);
      return;
    }

    // Soundtrack, rendered offline by the app's own audio engine.
    const audioPage = await ctx.newPage();
    await audioPage.goto(`${base}/promo/${V.audio}`);
    await audioPage.waitForFunction(() => typeof window.renderAudio === 'function');
    const wavB64 = await audioPage.evaluate(() => window.renderAudio());
    const wav = path.join(OUT, 'soundtrack.wav');
    fs.writeFileSync(wav, Buffer.from(wavB64, 'base64'));
    await audioPage.close();
    console.log('soundtrack rendered');

    const mp4 = path.join(OUT, V.out);
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', wav,
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-movflags', '+faststart', '-shortest', mp4,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((resolve, reject) => ff.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));

    const frames = FPS * V.duration;
    for (let i = 0; i < frames; i++) {
      const t = i / FPS;
      await page.evaluate(t => window.renderFrame(t), t);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 60 === 0) process.stdout.write(`\rframe ${i}/${frames}`);
      if (Math.abs(t - V.posterT) < 1e-9) await page.screenshot({ path: path.join(OUT, V.poster) });
    }
    ff.stdin.end();
    await done;
    console.log(`\nvideo written to ${mp4}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
