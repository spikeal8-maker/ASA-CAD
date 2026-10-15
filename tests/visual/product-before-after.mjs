import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const root = process.env.ASA_CAD_PRODUCT_EVIDENCE_ROOT ?? 'ui-core-u1-evidence/product-before-after';
const sides = ['BEFORE', 'AFTER'].map(side => {
  const url = process.env[`ASA_CAD_${side}_URL`], sha = process.env[`ASA_CAD_${side}_SHA`];
  assert.ok(url, `${side} URL required`);
  assert.match(sha ?? '', /^[a-f0-9]{40}$/, `${side} exact SHA required`);
  return { side: side.toLowerCase(), url: url.replace(/\/$/, ''), sha };
});
const browser = await chromium.launch({ headless: true });
const manifest = { state: 'new Part, light theme, UI Scale 100%, initial tree/camera', browser: browser.version(), images: [] };
try {
  for (const source of sides) {
    const dir = join(root, source.side);
    await mkdir(dir, { recursive: true });
    for (const [width, height] of [[360, 640], [768, 1024], [844, 390], [1600, 900]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light' });
      try {
        const response = await page.goto(`${source.url}/cad/?uiScale=100`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        await page.locator('.cad-app[data-document-kind="part"]').waitFor();
        await page.locator('canvas').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        const file = `${source.side}/kompas-${width}x${height}.png`;
        const png = await page.screenshot({ path: join(root, file), fullPage: false });
        manifest.images.push({ ...source, width, height, deviceScaleFactor: 1, file,
          sha256: createHash('sha256').update(png).digest('hex') });
      } finally { await page.close(); }
    }
  }
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Product before/after evidence PASS (4 matched viewports; exact SHA/hash manifest)');
} finally { await browser.close(); }
