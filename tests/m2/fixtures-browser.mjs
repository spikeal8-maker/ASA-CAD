import assert from 'node:assert/strict';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const baseUrl = (process.env.ASA_CAD_FIXTURE_BASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true });

function near(actual, expected, tolerance = 0.25, label = 'value') {
  assert.ok(Number.isFinite(actual), `${label} is not finite: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

async function openFixture(name, expectedStatus = 'ready') {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const pageErrors = [];
  const failedRequests = [];
  const wasmRequests = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('request', (request) => {
    if (/\.wasm(?:\?|$)/i.test(request.url())) wasmRequests.push(request.url());
  });

  const response = await page.goto(`${baseUrl}/dev/part/${name}`, { waitUntil: 'networkidle', timeout: 30_000 });
  assert.ok(response?.ok(), `${name}: navigation failed with ${response?.status()}`);
  assert.equal(await page.evaluate(() => crossOriginIsolated), true, `${name}: route is not cross-origin isolated`);
  await page.locator(`.cad-app[data-dev-fixture="${name}"][data-fixture-status="${expectedStatus}"]`).waitFor({ timeout: 120_000 });

  return {
    page,
    pageErrors,
    failedRequests,
    wasmRequests,
    async finish() {
      assert.deepEqual(pageErrors, [], `${name}: page errors: ${pageErrors.join('; ')}`);
      assert.deepEqual(failedRequests, [], `${name}: failed requests: ${failedRequests.join('; ')}`);
      await page.close();
    },
  };
}

async function rootState(page) {
  return page.locator('.cad-app').evaluate((node) => ({
    fixture: node.getAttribute('data-dev-fixture'),
    fixtureStatus: node.getAttribute('data-fixture-status'),
    runtimeStatus: node.getAttribute('data-runtime-status'),
    recomputeStatus: node.getAttribute('data-recompute-status'),
    sketchCount: Number(node.getAttribute('data-sketch-count')),
    featureCount: Number(node.getAttribute('data-feature-count')),
    stableReferenceCount: Number(node.getAttribute('data-stable-reference-count')),
  }));
}

async function assertBounds(page, expected) {
  const raw = await page.locator('[data-testid="cad-viewport"]').getAttribute('data-bounds');
  assert.ok(raw, 'viewport bounds missing');
  const actual = raw.split(',').map(Number);
  assert.equal(actual.length, 6, `invalid bounds: ${raw}`);
  expected.forEach((value, index) => near(actual[index], value, 0.25, `bounds[${index}]`));
}

try {
  console.log('\nASA-CAD M2A deterministic Part fixtures');

  {
    const fx = await openFixture('empty');
    const state = await rootState(fx.page);
    assert.deepEqual(state, {
      fixture: 'empty',
      fixtureStatus: 'ready',
      runtimeStatus: 'idle',
      recomputeStatus: 'clean',
      sketchCount: 0,
      featureCount: 0,
      stableReferenceCount: 0,
    });
    await fx.page.getByText('Fixture empty готов', { exact: true }).waitFor();
    assert.equal(await fx.page.locator('[data-testid="cad-viewport"] canvas').count(), 0);
    assert.equal(fx.wasmRequests.length, 0, 'empty fixture loaded OpenCascade WASM');
    console.log('  ✓ /dev/part/empty — clean shell, no WASM');
    await fx.finish();
  }

  {
    const fx = await openFixture('sketch');
    const state = await rootState(fx.page);
    assert.equal(state.fixture, 'sketch');
    assert.equal(state.fixtureStatus, 'ready');
    assert.equal(state.runtimeStatus, 'idle');
    assert.equal(state.recomputeStatus, 'dirty');
    assert.equal(state.sketchCount, 1);
    assert.equal(state.featureCount, 0);
    assert.equal(state.stableReferenceCount, 0);
    await fx.page.getByText('Эскиз 1', { exact: true }).waitFor();
    await fx.page.getByRole('button', { name: /Ширина: 60 мм/ }).waitFor();
    await fx.page.getByRole('button', { name: /Высота: 40 мм/ }).waitFor();
    assert.equal(await fx.page.locator('[data-testid="cad-viewport"] canvas').count(), 0);
    assert.equal(fx.wasmRequests.length, 0, 'sketch fixture loaded OpenCascade WASM');
    console.log('  ✓ /dev/part/sketch — 60×40 driving sketch, no WASM');
    await fx.finish();
  }

  {
    const fx = await openFixture('extrude');
    await fx.page.locator('.cad-app[data-runtime-status="ready"][data-recompute-status="clean"]').waitFor({ timeout: 120_000 });
    await fx.page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
    const state = await rootState(fx.page);
    assert.equal(state.fixture, 'extrude');
    assert.equal(state.sketchCount, 1);
    assert.equal(state.featureCount, 1);
    assert.equal(state.stableReferenceCount, 0);
    await fx.page.getByText('Элемент выдавливания 1', { exact: true }).waitFor();
    await fx.page.getByText('Тело 1', { exact: true }).waitFor();
    await assertBounds(fx.page, [-30, -20, 0, 30, 20, 10]);
    assert.ok(fx.wasmRequests.length >= 1, 'extrude fixture did not load OpenCascade WASM');
    console.log('  ✓ /dev/part/extrude — real 60×40×10 OCC B-Rep');
    await fx.finish();
  }

  {
    const fx = await openFixture('reference');
    await fx.page.locator('.cad-app[data-runtime-status="ready"][data-recompute-status="clean"]').waitFor({ timeout: 120_000 });
    await fx.page.locator('[data-testid="cad-viewport"] canvas').waitFor({ timeout: 60_000 });
    const state = await rootState(fx.page);
    assert.equal(state.fixture, 'reference');
    assert.equal(state.sketchCount, 2);
    assert.equal(state.featureCount, 3);
    assert.equal(state.stableReferenceCount, 2);
    await fx.page.getByText('Элемент выдавливания 1', { exact: true }).waitFor();
    await fx.page.getByText('Вырезать выдавливанием 1', { exact: true }).waitFor();
    await fx.page.getByText('Скругление 1', { exact: true }).waitFor();
    await fx.page.getByRole('button', { name: /Диаметр: 12 мм/ }).waitFor();
    await assertBounds(fx.page, [-30, -20, 0, 30, 20, 10]);
    assert.ok(fx.wasmRequests.length >= 1, 'reference fixture did not load OpenCascade WASM');
    console.log('  ✓ /dev/part/reference — cut + fillet rebuilt from 2 real StableRefs');
    await fx.finish();
  }

  {
    const fx = await openFixture('rebuild-error', 'error');
    const state = await rootState(fx.page);
    assert.equal(state.fixture, 'rebuild-error');
    assert.equal(state.fixtureStatus, 'error');
    assert.equal(state.runtimeStatus, 'ready');
    assert.equal(state.recomputeStatus, 'error');
    assert.equal(state.sketchCount, 2);
    assert.equal(state.featureCount, 2);
    assert.equal(state.stableReferenceCount, 0);
    await fx.page.getByText('Ошибка перестроения', { exact: true }).waitFor();
    await fx.page.getByText('B-Rep не построен', { exact: true }).waitFor();
    const bodyText = await fx.page.locator('.model-stage').innerText();
    assert.match(bodyText, /cut|circle|profile|окруж|профил/i, `rebuild-error fixture has no useful diagnostic: ${bodyText}`);
    assert.equal(await fx.page.locator('[data-testid="cad-viewport"] canvas').count(), 0, 'invalid fixture rendered stale B-Rep canvas');
    assert.ok(fx.wasmRequests.length >= 1, 'rebuild-error fixture never exercised OpenCascade');
    console.log('  ✓ /dev/part/rebuild-error — real recompute failure surfaced, no stale canvas');
    await fx.finish();
  }

  console.log('ASA-CAD M2A deterministic Part fixtures PASS\n');
} finally {
  await browser.close();
}
