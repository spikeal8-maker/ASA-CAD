const fs = require('node:fs');

function patch(path) {
  const source = fs.readFileSync(path, 'utf8');
  const before = "  await page.getByRole('button', { name: /Прямоугольник/i }).click();\n  await page.locator('.parameter-actions button.primary').click();";
  const after = "  await page.getByRole('button', { name: /Прямоугольник/i }).click();\n  await page.locator('.content-area.panel-closed').waitFor();\n  await page.getByTitle('Параметры').click();\n  await page.locator('.parameter-panel').waitFor();\n  await page.locator('.parameter-actions button.primary').click();";
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one legacy Rectangle numeric-flow anchor, found ${count}`);
  fs.writeFileSync(path, source.replace(before, after));
}

for (const path of [
  'tests/m2/navigation-browser.mjs',
  'tests/m2/views-browser.mjs',
  'tests/m2/shortcuts-browser.mjs',
  'tests/m2/ordinary-selection-browser.mjs',
]) patch(path);

console.log('M3.5 M2 numeric Rectangle compatibility helpers updated');
