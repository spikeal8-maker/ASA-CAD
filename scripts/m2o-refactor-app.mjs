import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${path}: expected refactor anchor not found`);
  await writeFile(path, source.replace(before, after));
}

await replaceExact(
  'src/web/App.tsx',
  `import {\n  createEmptyCadDocument,\n  parseCadDocument,\n  serializeCadDocument,\n  type CadDocument,\n  type CadDocumentKind,\n  type CadPartDocument,\n} from '../contracts/document';`,
  `import {\n  createEmptyCadDocument,\n  type CadDocument,\n  type CadDocumentKind,\n  type CadPartDocument,\n} from '../contracts/document';`,
);

await replaceExact(
  'src/web/App.tsx',
  `import { applyPartDevFixture } from './devFixtures';`,
  `import { applyPartDevFixture } from './devFixtures';\nimport { CadEditorPersistence } from './CadEditorPersistence';`,
);

await replaceExact(
  'src/web/App.tsx',
  `  const app = useMemo(\n    () => new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Деталь 1' }), runtime),\n    [runtime],\n  );\n  const shortcutRegistry = useMemo(() => new ShortcutRegistry(), []);`,
  `  const app = useMemo(\n    () => new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Деталь 1' }), runtime),\n    [runtime],\n  );\n  const persistence = useMemo(\n    () => new CadEditorPersistence(route, createEmptyCadDocument('part', { title: 'Деталь 1' })),\n    [route],\n  );\n  const shortcutRegistry = useMemo(() => new ShortcutRegistry(), []);`,
);

await replaceExact(
  'src/web/App.tsx',
  `  async function saveLocal() {\n    localStorage.setItem('asa-cad-m2-shell-document', serializeCadDocument(app.getDocument()));\n    setNotice('Сохранено локально');\n  }\n\n  async function openLocal() {\n    const saved = localStorage.getItem('asa-cad-m2-shell-document');\n    if (!saved) {\n      setNotice('Нет локально сохраненного документа');\n      return;\n    }\n    try {\n      setNotice('Открытие документа…');\n      await app.replaceDocument(parseCadDocument(saved));\n      setActivePanel('tree');\n      setActiveCommand(null);\n      setEditingDimensionId(null);\n      clearTransientSelection();\n      setActiveWorkspace(app.getDocument().kind === 'part' ? 'solid' : app.getDocument().kind);\n      setNotice('Локальный документ открыт');\n    } catch (error) {\n      setNotice(error instanceof Error ? error.message : String(error));\n    }\n  }`,
  `  async function saveLocal() {\n    try {\n      const result = await persistence.save(app.getDocument() as CadDocument);\n      setNotice(\`Сохранено локально · ревизия \${result.revision}\`);\n    } catch (error) {\n      setNotice(error instanceof Error ? error.message : String(error));\n    }\n  }\n\n  async function openLocal() {\n    if (!persistence.hasStoredProject()) {\n      setNotice('Нет локально сохраненного документа');\n      return;\n    }\n    try {\n      setNotice('Открытие документа…');\n      await app.replaceDocument(await persistence.load());\n      setActivePanel('tree');\n      setActiveCommand(null);\n      setEditingDimensionId(null);\n      clearTransientSelection();\n      setActiveWorkspace(app.getDocument().kind === 'part' ? 'solid' : app.getDocument().kind);\n      setNotice('Локальный документ открыт');\n    } catch (error) {\n      setNotice(error instanceof Error ? error.message : String(error));\n    }\n  }`,
);

await replaceExact(
  'tests/m2/part-browser.mjs',
  `  await page.getByTitle('Сохранить').click();\n  await page.getByText('Сохранено локально', { exact: true }).waitFor();\n\n  const saved = await page.evaluate(() => localStorage.getItem('asa-cad-m2-shell-document'));\n  assert.ok(saved, 'saved Part document missing from localStorage');\n  const document = JSON.parse(saved);`,
  `  await page.getByTitle('Сохранить').click();\n  await page.getByText(/Сохранено локально · ревизия \\d+/).waitFor();\n\n  const stored = await page.evaluate(() => {\n    const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('asa-cad-project:'));\n    return key ? { key, value: localStorage.getItem(key) } : null;\n  });\n  assert.ok(stored?.value, 'saved Part project record missing from CadProjectHost storage');\n  const record = JSON.parse(stored.value);\n  assert.ok(Number.isSafeInteger(record.revision) && record.revision >= 1, 'standalone host revision was not advanced');\n  assert.equal(typeof record.serializedDocument, 'string', 'standalone host did not persist serialized CadDocument');\n  const saved = record.serializedDocument;\n  const document = JSON.parse(saved);`,
);

console.log('M2O App persistence refactor applied');
