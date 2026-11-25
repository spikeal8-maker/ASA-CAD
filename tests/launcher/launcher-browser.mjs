import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../../vendor/toubkal/node_modules/playwright-core/index.mjs';

const home = new URL(process.env.ASA_CAD_SHELL_URL ?? 'http://127.0.0.1:8090/').href;
assert.ok(![8094, 8098, 8099].includes(Number(new URL(home).port)), 'Use the isolated CI origin, never an installed D2 origin');
const artifacts = 'artifacts/launcher-browser';
await mkdir(artifacts, { recursive: true });
const report = { workflowSha: process.env.GITHUB_SHA ?? null, home, status: 'RUNNING', cases: [], pageErrors: [], failedRequests: [], cleanupErrors: [] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('requestfailed', request => report.failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
const launcher = () => page.getByTestId('three-mode-launcher');
const leave = () => page.getByRole('dialog', { name: 'Сохранить изменения перед выходом?', exact: true });
const homeButton = () => page.getByRole('button', { name: '← На главную', exact: true });
const editorUrl = (mode, id) => new URL(`cad/${mode}/${id}`, home).href;
const title = 'Launcher CI — общий проект';
let projectId, documentId, sketchId, savedDocument;

async function step(name, run) {
  const result = { name, status: 'RUNNING' }; report.cases.push(result);
  try { await run(); result.status = 'PASS'; }
  catch (error) { result.status = 'FAIL'; result.error = String(error.stack ?? error); throw error; }
}
async function atHome() {
  await launcher().waitFor(); await page.waitForURL(home);
  assert.equal(await page.locator('.cad-app').count(), 0, 'home retained an interactive editor');
}
async function atEditor(mode, id, sketches = 0) {
  await page.waitForURL(editorUrl(mode, id));
  await page.locator(`.asa-editor-root[data-mode="${mode}"] .cad-app[data-sketch-count="${sketches}"]`).waitFor();
  await page.locator(mode === 'fusion' ? '.live-top' : '.k-main-menu-bar').waitFor();
  assert.equal(await launcher().count(), 0);
  assert.equal(await page.getByRole('combobox', { name: 'Редактор', exact: true }).inputValue(), mode);
}
async function create(mode, name) {
  await launcher().getByRole('button', { name: `Создать проект — ${mode === 'kompas' ? 'Компас' : 'Fusion'}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Создать проект · ${mode === 'kompas' ? 'Компас' : 'Fusion'}`, exact: true });
  await dialog.getByRole('textbox', { name: 'Название проекта', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Создать и открыть', exact: true }).click();
  await page.waitForURL(url => url.pathname.startsWith(`/cad/${mode}/`));
  const id = new URL(page.url()).pathname.split('/').at(-1);
  assert.match(id, /^[0-9a-f-]{36}$/); await atEditor(mode, id); return id;
}
async function stored(id) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(`asa-cad-local-project:${key}:state`);
    if (!raw) throw new Error('Saved project envelope missing');
    const value = JSON.parse(raw);
    return { document: JSON.parse(value.serializedDocument), mode: value.launcher.mode, raw };
  }, id);
}
async function createSketch(count) {
  await page.getByRole('button', { name: /Создать эскиз/i }).click();
  await page.getByText('Опорный объект', { exact: true }).waitFor();
  await page.getByRole('button', { name: /XY/ }).click();
  await page.locator('.k-pp-ok').click();
  await page.locator(`.cad-app[data-sketch-count="${count}"]`).waitFor();
  await page.waitForFunction(() => !!document.querySelector('.cad-app')?.getAttribute('data-active-sketch-id'));
  return page.locator('.cad-app').getAttribute('data-active-sketch-id');
}
async function open(mode) {
  await launcher().getByRole('button', { name: `Открыть проект — ${mode === 'kompas' ? 'Компас' : 'Fusion'}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Открыть проект · ${mode === 'kompas' ? 'Компас' : 'Fusion'}`, exact: true });
  await dialog.getByRole('button').filter({ hasText: title }).click();
  await atEditor(mode, projectId, 1);
}

try {
  await step('Launcher shows Kompas, Fusion and unavailable Vassalite without ASA Lab links', async () => {
    const response = await page.goto(home, { waitUntil: 'networkidle' }); assert.ok(response?.ok());
    await atHome(); assert.equal(await page.locator('.asa-launcher-card').count(), 3);
    for (const name of ['Компас', 'Fusion']) {
      await launcher().getByRole('heading', { name, exact: true }).waitFor();
      for (const verb of ['Создать', 'Открыть'])
        assert.equal(await launcher().getByRole('button', { name: `${verb} проект — ${name}`, exact: true }).isEnabled(), true);
    }
    await launcher().getByRole('heading', { name: 'Vassalite', exact: true }).waitFor();
    for (const verb of ['Создать', 'Открыть'])
      assert.equal(await launcher().getByRole('button', { name: `${verb} проект — Vassalite`, exact: true }).isDisabled(), true);
    await launcher().getByText(/исходники Vassalite отсутствуют/).waitFor();
    assert.equal(await launcher().locator('a[href*="asa-lab"]').count(), 0, 'external ASA Lab handoff remains');
    assert.equal(await page.locator('iframe').count(), 0);
    await page.screenshot({ path: `${artifacts}/01-home.png`, fullPage: true });
  });
  await step('Create, dirty Stay, mode switch and shared Undo/Redo', async () => {
    projectId = await create('kompas', title);
    const initial = await stored(projectId); documentId = initial.document.documentId;
    assert.ok(documentId); assert.equal(initial.document.title, title); assert.equal(initial.document.sketches.length, 0);
    const app = await page.locator('.cad-app').elementHandle();
    sketchId = await createSketch(1); assert.ok(sketchId);
    await homeButton().click(); await leave().waitFor();
    await page.keyboard.press('Control+z'); await page.keyboard.press('Control+s');
    await page.screenshot({ path: `${artifacts}/02-dirty-guard.png` });
    assert.equal(await page.locator('.cad-app').getAttribute('data-sketch-count'), '1', 'dialog allowed background Undo');
    assert.equal((await stored(projectId)).raw, initial.raw, 'dialog allowed background Save');
    await leave().getByRole('button', { name: 'Остаться', exact: true }).click();
    await leave().waitFor({ state: 'detached' }); await atEditor('kompas', projectId, 1);
    await page.getByRole('combobox', { name: 'Редактор', exact: true }).selectOption('fusion');
    await atEditor('fusion', projectId, 1);
    assert.equal(await app.evaluate(node => node === document.querySelector('.cad-app')), true, 'mode switch replaced the shared App');
    await page.locator('.live-quickbuttons [data-command-id="system.undo"]').click();
    await page.locator('.cad-app[data-sketch-count="0"]').waitFor();
    await page.locator('.live-quickbuttons [data-command-id="system.redo"]').click();
    await page.locator('.cad-app[data-sketch-count="1"]').waitFor();
    await page.screenshot({ path: `${artifacts}/03-fusion.png` });
    await app.dispose();
  });
  await step('Save and leave, recent Open, reload, and mode-independent project picker', async () => {
    await homeButton().click(); await leave().waitFor();
    await leave().getByRole('button', { name: 'Сохранить и выйти', exact: true }).click(); await atHome();
    const saved = await stored(projectId); savedDocument = saved.document;
    assert.equal(saved.mode, 'fusion'); assert.equal(saved.document.documentId, documentId);
    assert.equal(saved.document.sketches.length, 1); assert.equal(saved.document.sketches[0].id, sketchId);
    await launcher().getByRole('button', { name: `Продолжить: ${title}`, exact: true }).click();
    await atEditor('fusion', projectId, 1);
    await page.reload({ waitUntil: 'networkidle' }); await atEditor('fusion', projectId, 1);
    assert.deepEqual((await stored(projectId)).document, savedDocument, 'reload changed saved intent');
    await homeButton().click(); await atHome();
    assert.equal(await leave().count(), 0, 'clean reload acquired a dirty guard');
    await open('kompas');
    await page.goBack(); await atHome();
    await page.goForward(); await atEditor('kompas', projectId, 1);
  });
  await step('Dirty browser Back restores URL on Stay and exits on Discard', async () => {
    await createSketch(2);
    const saved = await stored(projectId);
    await page.goBack(); await leave().waitFor(); await page.waitForURL(editorUrl('kompas', projectId));
    await leave().getByRole('button', { name: 'Остаться', exact: true }).click();
    await leave().waitFor({ state: 'detached' }); await atEditor('kompas', projectId, 2);
    await page.goBack(); await leave().waitFor();
    await leave().getByRole('button', { name: 'Выйти без сохранения', exact: true }).click(); await atHome();
    assert.equal((await stored(projectId)).raw, saved.raw, 'Discard overwrote the saved document');
  });
  await step('Fusion Create owns a separate project that survives reload', async () => {
    const id = await create('fusion', 'Launcher CI — отдельный Fusion');
    const saved = await stored(id);
    assert.notEqual(id, projectId); assert.notEqual(saved.document.documentId, documentId);
    assert.equal(saved.mode, 'fusion'); assert.equal(saved.document.sketches.length, 0);
    await page.reload({ waitUntil: 'networkidle' }); await atEditor('fusion', id);
    assert.equal((await stored(id)).raw, saved.raw);
    await homeButton().click(); await atHome();
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.failedRequests, []);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = String(error.stack ?? error);
  await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  for (const close of [() => context.tracing.stop({ path: `${artifacts}/trace.zip` }), () => context.close(), () => browser.close()]) {
    try { await close(); } catch (error) { report.cleanupErrors.push(String(error)); report.status = 'FAIL'; }
  }
  if (report.pageErrors.length || report.failedRequests.length) report.status = 'FAIL';
  await writeFile(`${artifacts}/report.json`, JSON.stringify(report, null, 2) + '\n');
}
assert.equal(report.status, 'PASS', report.error ?? JSON.stringify(report));
console.log(`ASA-CAD launcher real-browser PASS (${report.cases.length} scenarios)`);
