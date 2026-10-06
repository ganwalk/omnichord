// Rasterize scripts/icon.svg into the PNG icons in public/icons/.
// Needs Playwright with Chromium: `npx -y playwright@1 install chromium` once,
// then `node scripts/gen-icons.cjs`.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const out = path.join(__dirname, '..', 'public', 'icons');
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180, 'favicon-32.png': 32 };

(async () => {
  const browser = await chromium.launch();
  for (const [name, size] of Object.entries(SIZES)) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>*{margin:0}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
    await page.screenshot({ path: path.join(out, name) });
    await page.close();
  }
  await browser.close();
})();
