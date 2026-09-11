import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O4 shortcut codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'M2 action import',
  "import { useM2CadUiActions } from './useM2CadUiActions';\n",
  "import { useM2CadUiActions } from './useM2CadUiActions';\nimport { cadUiActionIdForShortcut } from './M2CadUiActions';\n",
);

replaceOnce(
  'shortcut dispatch prologue',
  "  async function dispatchShortcutAction(action: ShortcutActionId) {\n    switch (action) {\n      case 'system.save':\n        await saveLocal();\n        return;\n      case 'system.undo':\n        await undo();\n        return;\n      case 'system.redo':\n        await redo();\n        return;\n      case 'system.rebuild':\n        await rebuild();\n        return;\n",
  "  async function dispatchShortcutAction(action: ShortcutActionId) {\n    const sharedActionId = cadUiActionIdForShortcut(action);\n    if (sharedActionId) {\n      const sharedAction = uiActions.byId.get(sharedActionId);\n      if (!sharedAction) throw new Error(`Missing CadUiAction for shortcut: ${sharedActionId}`);\n      if (!sharedAction.enabled) {\n        setNotice(sharedAction.disabledReason ?? 'Команда недоступна');\n        return;\n      }\n      await sharedAction.execute();\n      return;\n    }\n\n    switch (action) {\n",
);

for (const [label, snippet] of [
  ['fit shortcut duplicate', "      case 'view.fit':\n        requestView('Показать всё');\n        return;\n"],
  ['iso shortcut duplicate', "      case 'view.iso':\n        requestView('Изометрия');\n        return;\n"],
  ['front shortcut duplicate', "      case 'view.front':\n        requestView('Спереди');\n        return;\n"],
  ['top shortcut duplicate', "      case 'view.top':\n        requestView('Сверху');\n        return;\n"],
  ['left shortcut duplicate', "      case 'view.left':\n        requestView('Слева');\n        return;\n"],
]) {
  replaceOnce(label, snippet, '');
}

writeFileSync(path, source);
console.log('Applied O4 shortcut-to-CadUiAction migration');
