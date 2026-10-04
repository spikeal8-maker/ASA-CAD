import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const referenceUrl = (process.env.ASA_CAD_UI_REFERENCE_URL ?? 'http://127.0.0.1:8089').replace(/\/$/, '');
const candidateUrl = (process.env.ASA_CAD_UI_CANDIDATE_URL ?? 'http://127.0.0.1:8088').replace(/\/$/, '');
const outputRoot = process.env.ASA_CAD_UI_EVIDENCE_ROOT ?? 'ui-core-u1-evidence';
const referenceSha = process.env.ASA_CAD_UI_REFERENCE_SHA ?? null;
const referenceTag = process.env.ASA_CAD_UI_REFERENCE_TAG ?? 'ui-reference-20261004';
const candidateSha = process.env.ASA_CAD_UI_CANDIDATE_SHA ?? null;

assert.equal(referenceSha, '88c535c652dac8b04f0d68fa144cf8486afdc926');
assert.equal(referenceTag, 'ui-reference-20261004');
assert.ok(candidateSha, 'candidate SHA is required');

const hash = (value) => createHash('sha256').update(value).digest('hex');

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.subarray(0, 8).equals(signature), 'not PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function evidence(path, expected, state) {
  const info = await stat(path);
  const data = await readFile(path);
  assert.ok(info.size > 0);
  assert.deepEqual(pngDimensions(data), expected);
  return { path, bytes: info.size, sha256: hash(data), ...expected, ...state };
}

async function shot(page, relative, width, height, state) {
  const path = join(outputRoot, relative);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
  return evidence(path, { width, height }, state);
}

async function region(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor();
  const box = await locator.boundingBox();
  assert.ok(box, `missing geometry for ${selector}`);
  return {
    selector,
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

async function referenceMetrics(page) {
  return Promise.all([
    region(page, '#menu'),
    region(page, '#toolsets'),
    region(page, '#ribbon'),
    region(page, '#content'),
  ]);
}

async function candidateMetrics(page) {
  return Promise.all([
    region(page, '.main-menu-bar'),
    region(page, '.workspace-tabs'),
    region(page, '.command-ribbon'),
    region(page, '.content-area'),
  ]);
}

async function openReference(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(`${referenceUrl}/`, { waitUntil: 'networkidle', timeout: 30000 });
  assert.ok(response?.ok());
  await page.locator('#app').waitFor();
  await page.locator('[data-toolset="solid"]').waitFor();
  assert.equal(await page.evaluate(() => typeof window.THREE), 'object', 'frozen reference Three.js did not initialize');
  return { context, page, errors };
}

async function fileCommand(page, label) {
  await page.getByRole('button', { name: 'Файл', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Файл', exact: true });
  await menu.waitFor();
  await menu.getByRole('menuitem', { name: label, exact: true }).click();
}

async function ensurePart(page) {
  if (await page.locator('.cad-app[data-document-kind="part"]').count()) return;
  await fileCommand(page, 'Новый');
  const dialog = page.getByRole('dialog', { name: 'Новый документ', exact: true });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: /Деталь/ }).click();
  await page.locator('.cad-app[data-document-kind="part"]').waitFor();
}

async function openCandidate(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
  const response = await page.goto(`${candidateUrl}/cad/?uiScale=100`, { waitUntil: 'networkidle', timeout: 30000 });
  assert.ok(response?.ok());
  await page.getByRole('button', { name: 'ASA-CAD', exact: true }).waitFor();
  await ensurePart(page);
  return { context, page, errors, failed };
}

async function setReferenceToolset(page, id) {
  await page.locator(`[data-toolset="${id}"]`).click();
  await page.waitForTimeout(100);
}

async function setCandidateWorkspace(page, label) {
  await page.getByRole('tab', { name: label, exact: true }).click();
  await page.waitForTimeout(100);
}

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const screenshots = [];
const geometry = {};
let browserVersion;

try {
  browserVersion = browser.version();

  const reference = await openReference(browser, 1600, 900);
  const candidate = await openCandidate(browser, 1600, 900);

  screenshots.push(await shot(reference.page, 'reference/solid-1600x900.png', 1600, 900, {
    side: 'reference', state: 'solid',
  }));
  screenshots.push(await shot(candidate.page, 'candidate/solid-1600x900.png', 1600, 900, {
    side: 'candidate', state: 'solid',
  }));
  geometry.referenceSolid1600 = await referenceMetrics(reference.page);
  geometry.candidateSolid1600 = await candidateMetrics(candidate.page);

  await setReferenceToolset(reference.page, 'surfaces');
  await setCandidateWorkspace(candidate.page, 'Каркас и поверхности');
  screenshots.push(await shot(reference.page, 'reference/surfaces-1600x900.png', 1600, 900, {
    side: 'reference', state: 'surfaces',
  }));
  screenshots.push(await shot(candidate.page, 'candidate/surfaces-1600x900.png', 1600, 900, {
    side: 'candidate', state: 'surfaces',
  }));

  await setReferenceToolset(reference.page, 'solid');
  await setCandidateWorkspace(candidate.page, 'Твердотельное моделирование');
  await reference.page.setViewportSize({ width: 1366, height: 768 });
  await candidate.page.setViewportSize({ width: 1366, height: 768 });
  screenshots.push(await shot(reference.page, 'reference/solid-1366x768.png', 1366, 768, {
    side: 'reference', state: 'solid',
  }));
  screenshots.push(await shot(candidate.page, 'candidate/solid-1366x768.png', 1366, 768, {
    side: 'candidate', state: 'solid',
  }));
  geometry.referenceSolid1366 = await referenceMetrics(reference.page);
  geometry.candidateSolid1366 = await candidateMetrics(candidate.page);

  assert.deepEqual(reference.errors, []);
  assert.deepEqual(candidate.errors, []);
  assert.deepEqual(candidate.failed, []);

  await reference.context.close();
  await candidate.context.close();
} finally {
  await browser.close();
}

const manifest = {
  schemaVersion: 1,
  package: 'UI-CORE-U1-VISUAL-EVIDENCE',
  purpose: 'Frozen #170 UI reference versus exact product candidate evidence',
  reference: {
    tag: referenceTag,
    sha: referenceSha,
  },
  candidate: {
    sha: candidateSha,
  },
  environment: {
    browser: `Chromium ${browserVersion}`,
    os: `${process.platform} ${process.arch}`,
    deviceScaleFactor: 1,
    uiScale: 100,
  },
  states: [
    'solid 1600x900',
    'surfaces 1600x900',
    'solid 1366x768',
  ],
  geometry,
  screenshots,
  automatedParityClaim: 'NONE',
  visualAcceptance: 'OWNER_REQUIRED',
  fullM2V: 'NOT_ACCEPTED',
};

await writeFile(join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('UI-CORE U1 visual evidence capture PASS (owner parity acceptance still required)');
