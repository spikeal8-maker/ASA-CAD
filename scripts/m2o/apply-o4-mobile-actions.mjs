import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O4 mobile codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'MobileToolsPanel import',
  "import { useM2CadUiActions } from './useM2CadUiActions';\n",
  "import { useM2CadUiActions } from './useM2CadUiActions';\nimport { MobileToolsPanel } from './MobileToolsPanel';\n",
);

replaceOnce(
  'active panel state',
  "  const [activePanel, setActivePanel] = useState<'tree' | 'parameters'>('tree');\n",
  "  const [activePanel, setActivePanel] = useState<'tree' | 'parameters' | 'tools'>('tree');\n",
);

replaceOnce(
  'management panel content',
  `        <aside className="management-panel">
          {activePanel === 'tree' ? (
            <DocumentTree
              document={document}
              selectedBodyId={selectedBodyId}
              onSelectBody={handleBodySelect}
              onEditDimension={beginDimensionEdit}
            />
          ) : (
            <ParameterPanel
              activeCommand={activeCommand}
              requiresFaceSelection={hasSolid && activeCommand === 'part.sketch.create'}
              selectedPick={selectedPick}
              sketchPlane={sketchPlane}
              setSketchPlane={setSketchPlane}
              rectangleWidth={rectangleWidth}
              rectangleHeight={rectangleHeight}
              setRectangleWidth={setRectangleWidth}
              setRectangleHeight={setRectangleHeight}
              circleDiameter={circleDiameter}
              setCircleDiameter={setCircleDiameter}
              extrudeDistance={extrudeDistance}
              setExtrudeDistance={setExtrudeDistance}
              filletRadius={filletRadius}
              setFilletRadius={setFilletRadius}
              dimensionEditValue={dimensionEditValue}
              setDimensionEditValue={setDimensionEditValue}
              onCreateSketch={commitCreateSketch}
              onCreateRectangle={commitRectangle}
              onCreateCircle={commitCircle}
              onExtrude={commitExtrude}
              onCut={commitCut}
              onFillet={commitFillet}
              onDimensionEdit={commitDimensionEdit}
              onCancel={cancelCommand}
            />
          )}
        </aside>`,
  `        <aside className="management-panel">
          {activePanel === 'tree' ? (
            <DocumentTree
              document={document}
              selectedBodyId={selectedBodyId}
              onSelectBody={handleBodySelect}
              onEditDimension={beginDimensionEdit}
            />
          ) : activePanel === 'parameters' ? (
            <ParameterPanel
              activeCommand={activeCommand}
              requiresFaceSelection={hasSolid && activeCommand === 'part.sketch.create'}
              selectedPick={selectedPick}
              sketchPlane={sketchPlane}
              setSketchPlane={setSketchPlane}
              rectangleWidth={rectangleWidth}
              rectangleHeight={rectangleHeight}
              setRectangleWidth={setRectangleWidth}
              setRectangleHeight={setRectangleHeight}
              circleDiameter={circleDiameter}
              setCircleDiameter={setCircleDiameter}
              extrudeDistance={extrudeDistance}
              setExtrudeDistance={setExtrudeDistance}
              filletRadius={filletRadius}
              setFilletRadius={setFilletRadius}
              dimensionEditValue={dimensionEditValue}
              setDimensionEditValue={setDimensionEditValue}
              onCreateSketch={commitCreateSketch}
              onCreateRectangle={commitRectangle}
              onCreateCircle={commitCircle}
              onExtrude={commitExtrude}
              onCut={commitCut}
              onFillet={commitFillet}
              onDimensionEdit={commitDimensionEdit}
              onCancel={cancelCommand}
            />
          ) : (
            <MobileToolsPanel
              documentKind={document.kind}
              workspace={activeWorkspace}
              getAction={uiAction}
            />
          )}
        </aside>`,
);

replaceOnce(
  'mobile bottom bar',
  `      <div className="mobile-bottom-bar" aria-label="Мобильные панели">
        <button type="button" onClick={() => setActivePanel('tree')}>☷<span>Дерево</span></button>
        <button type="button" onClick={() => setActivePanel('parameters')}>≡<span>Параметры</span></button>
        <button type="button" onClick={() => setNewDialogOpen(true)}>＋<span>Документ</span></button>
      </div>`,
  `      <div className="mobile-bottom-bar" aria-label="Мобильные панели">
        <button
          type="button"
          className={activePanel === 'tree' ? 'active' : ''}
          aria-pressed={activePanel === 'tree'}
          onClick={() => setActivePanel('tree')}
        >☷<span>Дерево</span></button>
        <button
          type="button"
          className={activePanel === 'parameters' ? 'active' : ''}
          aria-pressed={activePanel === 'parameters'}
          onClick={() => setActivePanel('parameters')}
        >≡<span>Параметры</span></button>
        <button
          type="button"
          className={activePanel === 'tools' ? 'active' : ''}
          aria-pressed={activePanel === 'tools'}
          onClick={() => setActivePanel('tools')}
        >⌘<span>Инструменты</span></button>
      </div>`,
);

writeFileSync(path, source);
console.log('Applied O4 mobile shared-action wiring');
