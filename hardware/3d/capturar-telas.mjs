#!/usr/bin/env node
// ─── Photograph the digital twin's screens, for the panel drawings and the 3D model ───
//
// Starts the twin (twin.html) with Vite, powers it on, plays one chord and saves
// exactly what its two screens show, so the drawings and the 3D model always
// match the twin:
//   hardware/painel/out/tela-robo.png     SYS MONITOR
//   hardware/painel/out/tela-acorde.png   CHORD DISPLAY
//   hardware/painel/out/estado.json       which pad is lit (the chord played)
//
// Usage (after npm install, with Playwright available):
//   node hardware/painel/gerar.cjs && node hardware/3d/capturar-telas.mjs && node hardware/painel/gerar.cjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'hardware', 'painel', 'out');

/** The chord shown in the pictures: D♭m7 (row 3 = m7, column 1 = D♭), with the rhythm playing. */
const CHORD = { type: 3, root: 1 };

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0 } });
await server.listen();
const url = new URL('twin.html', server.resolvedUrls.local[0]).href;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  await page.goto(url);
  await page.locator('.twin-power').click();
  // Real clicks (the twin captures the pointer): PLAY, then the chord.
  // The robot shows CHORD! for half a second after a chord.
  const click = async locator => {
    const b = await locator.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  await click(page.locator('.twin-fn').nth(8));
  await click(page.locator('.twin-key:not(.twin-fn)').nth(CHORD.type * 12 + CHORD.root));
  await page.waitForTimeout(120);
  const shots = await page.$$eval('canvas.twin-screen', cs => cs.map(c => c.toDataURL('image/png')));
  mkdirSync(OUT, { recursive: true });
  const save = (name, dataUrl) => writeFileSync(join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  save('tela-robo.png', shots[0]);
  save('tela-acorde.png', shots[1]);
  writeFileSync(join(OUT, 'estado.json'), JSON.stringify({ chord: CHORD }) + '\n');
  console.log('Screens saved: tela-robo.png, tela-acorde.png');
} finally {
  await browser.close();
  await server.close();
}
