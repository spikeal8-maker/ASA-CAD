import assert from 'node:assert/strict';
import { assertNoPageErrors, launchM3Browser, newDesktopPage } from './M3BrowserHarness.mjs';

export { assertNoPageErrors };
export const launchFusionBrowser = launchM3Browser;
export const fusionViewport = { width: 1920, height: 1080 };

export async function newFusionPage(browser) {
  const { page, errors } = await newDesktopPage(browser, fusionViewport);
  page.setDefaultTimeout(20_000);
  return { page, errors };
}

export function fusionLauncher(page) {
  return page.locator('[data-testid="three-mode-launcher"]');
}

export async function openFusionCreateDialog(page) {
  await fusionLauncher(page).getByRole('button', { name: 'Создать проект — Fusion', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Создать проект · Fusion', exact: true });
  await dialog.waitFor();
  return dialog;
}

export async function atFusionEditor(page, id, sketches = 0) {
  await page.locator(`.asa-editor-root[data-mode="fusion"] .cad-app[data-sketch-count="${sketches}"]`).waitFor();
  await page.locator('.live-top').waitFor();
  assert.equal(await fusionLauncher(page).count(), 0, 'launcher must not remain inside the Fusion editor');
  assert.equal(new URL(page.url()).pathname, `/cad/fusion/${id}`, 'Fusion editor route mismatch');
  return id;
}

export async function submitFusionCreate(page, dialog, name) {
  await dialog.getByRole('textbox', { name: 'Название проекта', exact: true }).fill(name);
  const submit = dialog.getByRole('button', { name: 'Создать и открыть', exact: true });
  assert.equal(await submit.isEnabled(), true, 'valid Fusion name must enable create');
  await submit.click();
  await page.waitForURL((url) => url.pathname.startsWith('/cad/fusion/'));
  const id = new URL(page.url()).pathname.split('/').at(-1);
  assert.match(id, /^[0-9a-f-]{36}$/, 'Fusion project id must be a real launcher id');
  await atFusionEditor(page, id, 0);
  return id;
}

export async function createFusionPart(page, name) {
  return submitFusionCreate(page, await openFusionCreateDialog(page), name);
}

export async function createFusionXYSketch(page) {
  await page.locator('.live-top [data-command-id="part.sketch.create"]').click();
  const panel = page.locator('.live-parameters[data-command="part.sketch.create"]');
  await panel.waitFor();
  await panel.getByRole('combobox', { name: 'Плоскость эскиза' }).selectOption('XY');
  await panel.locator('.live-commit').click();
  await page.locator('.cad-app[data-sketch-count="1"]').waitFor();
  const handle = await page.waitForFunction(() => document.querySelector('.cad-app')?.getAttribute('data-active-sketch-id'));
  const activeSketchId = await handle.jsonValue();
  assert.ok(activeSketchId, 'active Fusion sketch id must not be empty');
  await page.locator('[data-testid="part-model-stage"][data-sketch-support="XY"]').waitFor();
  await page.locator('[data-testid="cad-sketch-overlay"][data-entity-count="0"]').waitFor();
  await page.locator('.live-top[data-sketch-active="true"]').waitFor();
  return activeSketchId;
}

export async function activateFusionCircle(page) {
  const button = page.locator('.live-sketch-ribbon [data-native-command="CircleCenterRadius"][data-command-id="sketch.circle"]');
  assert.equal(await button.isEnabled(), true, 'CircleCenterRadius must be enabled in an active Fusion sketch');
  await button.click();
  await page.locator('.live-parameters[data-command="sketch.circle"]').waitFor();
  await page.locator('.live-workarea[data-active-command="sketch.circle"]').waitFor();
  await page.locator('[data-testid="cad-sketch-interaction"][data-tool="circle"]').waitFor();
}

export async function cancelFusionCircle(page) {
  await page.locator('.live-parameters[data-command="sketch.circle"]')
    .getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.live-parameters[data-command="sketch.circle"]'));
  await page.locator('.live-workarea[data-active-command=""]').waitFor();
}

export async function savedFusionProject(page, projectId) {
  return page.evaluate((id) => {
    const raw = localStorage.getItem(`asa-cad-local-project:${id}:state`);
    if (!raw) throw new Error('saved Fusion project envelope is missing');
    const value = JSON.parse(raw);
    const document = JSON.parse(value.serializedDocument);
    return { launcherMode: value.launcher?.mode, document };
  }, projectId);
}

export async function saveFusionDocument(page, projectId) {
  const key = `asa-cad-local-project:${projectId}:state`;
  const before = await page.evaluate((key) => localStorage.getItem(key), key);
  await page.locator('.live-quickbuttons [data-command-id="system.save"]').click();
  await page.waitForFunction(({ key, base }) => localStorage.getItem(key) !== base, { key, base: before });
  return savedFusionProject(page, projectId);
}

export function fusionReadonlySnapshot(page, extra = {}) {
  return page.evaluate((extra) => {
    const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) ?? '';
    const entities = attr('[data-testid="cad-sketch-overlay"]', 'data-entity-count');
    return {
      url: location.href,
      documentKind: attr('.cad-app', 'data-document-kind'),
      sketchCount: attr('.cad-app', 'data-sketch-count') === '' ? -1 : Number(attr('.cad-app', 'data-sketch-count')),
      activeSketchId: attr('.cad-app', 'data-active-sketch-id'),
      workspace: attr('.live-workarea', 'data-workspace'),
      activeCommand: attr('.live-workarea', 'data-active-command'),
      sketchSupport: attr('[data-testid="part-model-stage"]', 'data-sketch-support'),
      overlayEntities: entities === '' ? -1 : Number(entities),
      ...extra,
    };
  }, extra);
}
