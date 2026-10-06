import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** All files under `dir`, as URL paths relative to it. */
function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, root) : ['/' + relative(root, full).split(sep).join('/')];
  });
}

/** Writes dist/sw.js from src/sw.js with the list of built files to precache. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'omnisound-service-worker',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const files = listFiles(outDir).filter(f => f !== '/sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const sw = readFileSync('src/sw.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(files));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  test: {
    environment: 'node',
  },
});
