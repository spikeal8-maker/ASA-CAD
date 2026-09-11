import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) {
    throw new Error(`O4 codemod could not find ${label}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  'action imports',
  "import { useCadPersistenceCommands } from './useCadPersistenceCommands';\n",
  "import { useCadPersistenceCommands } from './useCadPersistenceCommands';\nimport { CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';\nimport { useM2CadUiActions } from './useM2CadUiActions';\n",
);

replaceOnce(
  'legacy searchable commands',
  "  const searchableCommands = search.trim()\n    ? registry.commands\n        .filter((command) => command.labelRu.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))\n        .slice(0, 8)\n    : [];\n\n",
  '',
);

replaceOnce(
  'shared action catalog',
  "  async function rebuild() {\n    clearTransientSelection();\n    setNotice('Перестроение…');\n    const result = await app.execute({ id: 'document.rebuild', payload: {} });\n    setNotice(result.ok ? 'Перестроено' : result.error?.message ?? 'Ошибка перестроения');\n  }\n\n",
  "  async function rebuild() {\n    clearTransientSelection();\n    setNotice('Перестроение…');\n    const result = await app.execute({ id: 'document.rebuild', payload: {} });\n    setNotice(result.ok ? 'Перестроено' : result.error?.message ?? 'Ошибка перестроения');\n  }\n\n  const uiActions = useM2CadUiActions(\n    {\n      open: openLocal,\n      save: saveLocal,\n      undo,\n      redo,\n      rebuild,\n      createSketch: beginCreateSketch,\n      rectangle: beginRectangle,\n      circle: beginCircle,\n      finishSketch,\n      extrude: beginExtrude,\n      cutExtrude: beginCut,\n      fillet: beginFillet,\n      fit: () => requestView('Показать всё'),\n      front: () => requestView('Спереди'),\n      back: () => requestView('Сзади'),\n      top: () => requestView('Сверху'),\n      bottom: () => requestView('Снизу'),\n      left: () => requestView('Слева'),\n      right: () => requestView('Справа'),\n      isometric: () => requestView('Изометрия'),\n    },\n    {\n      canUndo: state.canUndo,\n      canRedo: state.canRedo,\n      hasSketch: Boolean(sketch),\n      canExtrude,\n      canCutExtrude: canCut,\n      canFillet,\n    },\n  );\n  const searchableActions = uiActions.search(search);\n  const uiAction = (id: string) => {\n    const action = uiActions.byId.get(id);\n    if (!action) throw new Error(`Missing CadUiAction: ${id}`);\n    return action;\n  };\n\n",
);

replaceOnce(
  'command search surface',
  "          {searchableCommands.length > 0 && (\n            <div className=\"command-search-results\">\n              {searchableCommands.map((command) => (\n                <button key={command.id} type=\"button\" onClick={() => setSearch('')}>\n                  <span>{command.labelRu}</span>\n                  <small>{command.milestone}</small>\n                </button>\n              ))}\n            </div>\n          )}\n",
  "          <CadUiActionSearchResults actions={searchableActions} onPicked={() => setSearch('')} />\n",
);

replaceOnce(
  'global toolbar surface',
  "          <button type=\"button\" title=\"Открыть\" onClick={openLocal}>⌂</button>\n          <button type=\"button\" title=\"Сохранить (Ctrl+S)\" onClick={saveLocal}>▣</button>\n          <button type=\"button\" title=\"Отменить (Ctrl+Z)\" onClick={undo} disabled={!state.canUndo}>↶</button>\n          <button type=\"button\" title=\"Повторить (Ctrl+Y / Ctrl+Shift+Z)\" onClick={redo} disabled={!state.canRedo}>↷</button>\n",
  "          <CadUiGlobalActionButton action={uiAction('system.open')}>⌂</CadUiGlobalActionButton>\n          <CadUiGlobalActionButton action={uiAction('system.save')} titleSuffix=\"(Ctrl+S)\">▣</CadUiGlobalActionButton>\n          <CadUiGlobalActionButton action={uiAction('system.undo')} titleSuffix=\"(Ctrl+Z)\">↶</CadUiGlobalActionButton>\n          <CadUiGlobalActionButton action={uiAction('system.redo')} titleSuffix=\"(Ctrl+Y / Ctrl+Shift+Z)\">↷</CadUiGlobalActionButton>\n",
);

writeFileSync(path, source);
console.log('Applied O4 global toolbar/search CadUiAction migration');
