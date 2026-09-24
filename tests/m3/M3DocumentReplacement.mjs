export async function reloadAndOpenSavedDocument(page) {
  await page.reload({ waitUntil: 'networkidle' });
  const app = page.locator('.cad-app');
  await app.waitFor();
  if (await app.getAttribute('data-dev-fixture')) {
    await page.locator('.cad-app[data-fixture-status="ready"]').waitFor();
  }
  const wasDirty = await page.locator('.dirty-dot').count() > 0;
  await page.locator('.global-actions [data-command-id="system.open"]').click();
  if (wasDirty) {
    await page.getByRole('dialog', { name: 'Есть несохранённые изменения' })
      .getByRole('button', { name: 'Не сохранять' }).click();
  }
  await page.getByText('Локальный документ открыт', { exact: true }).waitFor();
}
