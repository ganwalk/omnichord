// Render the OmniHarp promo video.
//
//   node promo/render.cjs                 → promo/out/omniharp-promo.mp4 (+ poster.png)
//   node promo/render.cjs --stills 4.2,13 → promo/out/still-4.20.png, still-13.00.png
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
const DURATION = 32;
const PORT = 5199;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const stillsArg = process.argv.indexOf('--stills');
  const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null;

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
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, hasTouch: true, locale: 'pt-BR' });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.goto(`${base}/promo/video.html`);
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
    await audioPage.goto(`${base}/promo/audio.html`);
    await audioPage.waitForFunction(() => typeof window.renderAudio === 'function');
    const wavB64 = await audioPage.evaluate(() => window.renderAudio());
    const wav = path.join(OUT, 'soundtrack.wav');
    fs.writeFileSync(wav, Buffer.from(wavB64, 'base64'));
    await audioPage.close();
    console.log('soundtrack rendered');

    const mp4 = path.join(OUT, 'omniharp-promo.mp4');
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

    const frames = FPS * DURATION;
    for (let i = 0; i < frames; i++) {
      const t = i / FPS;
      await page.evaluate(t => window.renderFrame(t), t);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 60 === 0) process.stdout.write(`\rframe ${i}/${frames}`);
      if (Math.abs(t - 29.5) < 1e-9) await page.screenshot({ path: path.join(OUT, 'poster.png') });
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
