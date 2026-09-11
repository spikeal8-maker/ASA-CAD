import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O4 ribbon codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'action control imports',
  "import { CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';\n",
  "import { CadUiActionButton, CadUiActionSearchResults, CadUiGlobalActionButton } from './CadUiActionControls';\nimport type { CadUiAction } from './CadUiAction';\n",
);

replaceOnce(
  'command ribbon',
  `        <div className="command-ribbon">
          {document.kind === 'part' && activeWorkspace === 'sketch' ? (
            <>
              <CommandGroup label="Геометрия">
                <CommandButton id="sketch.rectangle" large active disabled={!sketch} reason="Сначала создайте эскиз" onClick={beginRectangle} />
                <CommandButton id="sketch.circle" disabled={!sketch} reason="Сначала создайте эскиз" onClick={beginCircle} />
              </CommandGroup>
              <CommandGroup label="Размеры">
                <RibbonTextButton
                  label={rectangleReady ? \`${'${rectangleWidth}'} × ${'${rectangleHeight}'} мм\` : circleReady ? \`Ø${'${circleDiameter}'} мм\` : 'Размеры'}
                  symbol="↔"
                  disabled
                />
              </CommandGroup>
              <CommandGroup label="Эскиз" compact>
                <RibbonTextButton label="Завершить эскиз" symbol="✓" onClick={finishSketch} disabled={!sketch} />
              </CommandGroup>
            </>
          ) : document.kind === 'part' && activeWorkspace !== 'view' ? (
            <>
              <CommandGroup label="Эскиз">
                <CommandButton id="part.sketch.create" large active onClick={beginCreateSketch} />
              </CommandGroup>
              <CommandGroup label="Элементы тела">
                <CommandButton
                  id="part.extrude"
                  disabled={!canExtrude}
                  reason="Завершите прямоугольный эскиз"
                  onClick={beginExtrude}
                />
                <CommandButton
                  id="part.cutExtrude"
                  disabled={!canCut}
                  reason="Создайте окружность на грани и завершите эскиз"
                  onClick={beginCut}
                />
                <CommandButton
                  id="part.fillet"
                  disabled={!canFillet}
                  reason="Сначала постройте сквозной вырез"
                  onClick={beginFillet}
                />
              </CommandGroup>
              <CommandGroup label="Сервис модели" compact>
                <RibbonTextButton label="Перестроить" symbol="↻" onClick={rebuild} title="Перестроить (F5)" />
                <RibbonTextButton label="Свойства" symbol="ⓘ" disabled />
              </CommandGroup>
            </>
          ) : document.kind === 'part' ? (
            <ViewCommandGroups viewName={viewName} requestView={requestView} />
          ) : (
            <div className="planned-workspace-note">
              <strong>{documentNames[document.kind]}</strong>
              <span>Документный маршрут уже существует. Инструменты включаются по roadmap без фиктивных кнопок.</span>
            </div>
          )}
        </div>`,
  `        <div className="command-ribbon">
          {document.kind === 'part' && activeWorkspace === 'sketch' ? (
            <>
              <CommandGroup label="Геометрия">
                <CadUiActionButton action={uiAction('sketch.rectangle')} symbol={commandSymbol('sketch.rectangle')} large accent />
                <CadUiActionButton action={uiAction('sketch.circle')} symbol={commandSymbol('sketch.circle')} />
              </CommandGroup>
              <CommandGroup label="Размеры">
                <RibbonTextButton
                  label={rectangleReady ? \`${'${rectangleWidth}'} × ${'${rectangleHeight}'} мм\` : circleReady ? \`Ø${'${circleDiameter}'} мм\` : 'Размеры'}
                  symbol="↔"
                  disabled
                />
              </CommandGroup>
              <CommandGroup label="Эскиз" compact>
                <CadUiActionButton action={uiAction('sketch.finish')} symbol="✓" text />
              </CommandGroup>
            </>
          ) : document.kind === 'part' && activeWorkspace !== 'view' ? (
            <>
              <CommandGroup label="Эскиз">
                <CadUiActionButton action={uiAction('part.sketch.create')} symbol={commandSymbol('part.sketch.create')} large accent />
              </CommandGroup>
              <CommandGroup label="Элементы тела">
                <CadUiActionButton action={uiAction('part.extrude')} symbol={commandSymbol('part.extrude')} />
                <CadUiActionButton action={uiAction('part.cutExtrude')} symbol={commandSymbol('part.cutExtrude')} />
                <CadUiActionButton action={uiAction('part.fillet')} symbol={commandSymbol('part.fillet')} />
              </CommandGroup>
              <CommandGroup label="Сервис модели" compact>
                <CadUiActionButton action={uiAction('system.rebuild')} symbol="↻" text titleSuffix="(F5)" />
                <RibbonTextButton label="Свойства" symbol="ⓘ" disabled />
              </CommandGroup>
            </>
          ) : document.kind === 'part' ? (
            <ViewCommandGroups viewName={viewName} getAction={uiAction} />
          ) : (
            <div className="planned-workspace-note">
              <strong>{documentNames[document.kind]}</strong>
              <span>Документный маршрут уже существует. Инструменты включаются по roadmap без фиктивных кнопок.</span>
            </div>
          )}
        </div>`,
);

replaceOnce(
  'legacy CommandButton component',
  `function CommandButton(props: {
  id: string;
  disabled?: boolean;
  reason?: string;
  large?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const command = commandById.get(props.id);
  const label = command?.labelRu ?? props.id;
  return (
    <button
      className={\`ribbon-command ${'${props.large ? \'large\' : \'\'}'} ${'${props.active ? \'accent\' : \'\'}'}\`}
      type="button"
      disabled={props.disabled}
      title={props.disabled && props.reason ? \`${'${label}'}: ${'${props.reason}'}\` : label}
      onClick={props.onClick}
    >
      <span className="ribbon-command-icon" aria-hidden="true">{commandSymbol(props.id)}</span>
      <span>{label}</span>
      {props.disabled && <span className="planned-badge">позже</span>}
    </button>
  );
}

`,
  '',
);

replaceOnce(
  'view command groups',
  `function ViewCommandGroups(props: { viewName: string; requestView: (value: string) => void }) {
  const views = ['Спереди', 'Сзади', 'Сверху', 'Снизу', 'Слева', 'Справа', 'Изометрия'];
  const shortcuts: Record<string, string> = {
    'Спереди': '1',
    'Сверху': '2',
    'Слева': '3',
    'Изометрия': '0',
  };
  return (
    <CommandGroup label="Ориентация">
      {views.map((view) => (
        <button
          className={\`ribbon-command view-command ${'${props.viewName === view ? \'selected\' : \'\'}'}\`}
          type="button"
          key={view}
          onClick={() => props.requestView(view)}
          title={shortcuts[view] ? \`${'${view}'} (${'${shortcuts[view]}'})\` : view}
        >
          <span className="ribbon-command-icon">◇</span>
          <span>{view}</span>
        </button>
      ))}
    </CommandGroup>
  );
}
`,
  `function ViewCommandGroups(props: { viewName: string; getAction: (id: string) => CadUiAction }) {
  const views = [
    { label: 'Спереди', id: 'view.front', shortcut: '1' },
    { label: 'Сзади', id: 'view.back' },
    { label: 'Сверху', id: 'view.top', shortcut: '2' },
    { label: 'Снизу', id: 'view.bottom' },
    { label: 'Слева', id: 'view.left', shortcut: '3' },
    { label: 'Справа', id: 'view.right' },
    { label: 'Изометрия', id: 'view.iso', shortcut: '0' },
  ];
  return (
    <CommandGroup label="Ориентация">
      {views.map((view) => (
        <CadUiActionButton
          key={view.id}
          action={props.getAction(view.id)}
          symbol="◇"
          className="view-command"
          selected={props.viewName === view.label}
          titleSuffix={view.shortcut ? \`(${'${view.shortcut}'})\` : undefined}
        />
      ))}
    </CommandGroup>
  );
}
`,
);

writeFileSync(path, source);
console.log('Applied O4 ribbon/view CadUiAction migration');
