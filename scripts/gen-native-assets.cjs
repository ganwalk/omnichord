// Render the source images that `npx @capacitor/assets generate` turns into
// Android/iOS icons and splash screens (written to assets/).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const out = path.join(__dirname, '..', 'assets');
const BG = '#0e0a06';

// Artwork without the background rect, for adaptive-icon foregrounds and splash.
const art = svg.replace(/<rect width="512" height="512"[^>]*\/>/, '');

const jobs = [
  ['icon-only.png', 1024, svg, null],
  ['icon-foreground.png', 1024, art, 'transparent'],
  ['icon-background.png', 1024, '', BG],
  ['splash.png', 2732, art, BG, 0.3],
  ['splash-dark.png', 2732, art, BG, 0.3],
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, size, markup, bg, scale = 1] of jobs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * scale);
    const img = markup ? markup.replace('<svg ', `<svg width="${inner}" height="${inner}" `) : '';
    await page.setContent(`<style>*{margin:0}body{width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg ?? 'transparent'}}</style>${img}`);
    await page.screenshot({ path: path.join(out, name), omitBackground: bg === 'transparent' });
    await page.close();
  }
  await browser.close();
})();
