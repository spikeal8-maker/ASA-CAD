// Selectors shared by the KOMPAS desktop shell (#170) and the compact phone shell.
export const COMMIT = '.parameter-actions button.primary, .k-pp-ok';
export const RIBBON = ':is(.command-ribbon, .k-command-ribbon)';
export const QUICK = ':is(.global-actions, .k-command-ribbon)';
export const PANEL = ':is(.parameter-panel, .k-pp)';
export const PANEL_TITLE = ':is(.parameter-panel .panel-title-row strong, .k-pp-cmd strong)';
export const FIELD = ':is(.numeric-field, .k-pp-row)';
export const DIRTY = ':is(.dirty-dot, [data-document-dirty="true"])';
export const PARAMS_READY = '.content-area.panel-closed, .k-content[data-panel-tab="params"]';

/** Runs a standard view command: KOMPAS orientation grid / quick access, or the compact shell button. */
export async function runView(page, id) {
  if (await page.locator('.k-qa').count() === 0) return page.locator(`[data-command-id="${id}"]`).first().click();
  if (id === 'view.iso' || id === 'view.fit') return page.locator(`.k-qa [data-command-id="${id}"]`).click();
  await page.locator('[data-qdrop="views"]').click();
  await page.locator(`.k-pop.k-views [data-command-id="${id}"]`).click();
}

/** Opens the product UI Scale settings: KOMPAS «Параметры» → «Размер интерфейса…», or the compact shell gear. */
export async function openUiScaleSettings(page) {
  if (await page.locator('.k-main-menu-bar').count() === 0) return page.getByTitle('Настройки').click();
  await page.locator('.k-title-tools [aria-label="Параметры"]').click();
  await page.getByRole('dialog', { name: 'Параметры', exact: true }).getByRole('button', { name: 'Размер интерфейса…' }).click();
}

/** Shows the parameters panel of the running command in either shell. */
export async function openParams(page) {
  if (await page.locator('.k-content').count() === 0) await page.getByTitle('Параметры').click();
  else if (await page.locator('.k-content[data-panel-tab="params"]').count() === 0) await page.getByRole('tab', { name: 'Параметры' }).click();
}
