import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/web/App.tsx';
let app = readFileSync(path, 'utf8');

function replaceExact(before, after, label) {
  if (!app.includes(before)) throw new Error(`M3.1 codemod missing ${label}`);
  app = app.replace(before, after);
}

replaceExact(
`import {
  CadViewport,
  type CadViewportViewCommand,
  type CadViewportViewName,
} from './CadViewport';`,
`import type {
  CadViewportViewCommand,
  CadViewportViewName,
} from './CadViewport';`,
'CadViewport import',
);

replaceExact(
`import { ParameterPanel } from './ParameterPanel';
import { usePartSketchWorkspace } from './usePartSketchWorkspace';`,
`import { ParameterPanel } from './ParameterPanel';
import { PartModelStage } from './PartModelStage';
import { usePartSketchWorkspace } from './usePartSketchWorkspace';`,
'PartModelStage import',
);

replaceExact(
`  const [, setRevisionToken] = useState(0);`,
`  const [revisionToken, setRevisionToken] = useState(0);`,
'revision token state',
);

const stageStart = app.indexOf('          <div className="model-stage">');
const stageEnd = app.indexOf('          </div>\n        </section>', stageStart);
if (stageStart < 0 || stageEnd < 0) throw new Error('M3.1 codemod cannot locate model-stage');
let stage = app.slice(stageStart, stageEnd);
const partBranch = /\{document\.kind === 'part' \? \(\n\s+<>[\s\S]*?\n\s+<\/>\n\s+\) : \(/;
if (!partBranch.test(stage)) throw new Error('M3.1 codemod cannot locate Part stage branch');
stage = stage.replace(partBranch, `{document.kind === 'part' ? (\n              <PartModelStage\n                document={document}\n                activeSketch={sketch}\n                activeWorkspace={activeWorkspace}\n                revisionToken={revisionToken}\n                renderModel={renderModel}\n                runtimeStatus={runtimeState.status}\n                fixtureError={fixtureError}\n                rectangleReady={rectangleReady}\n                selectionMode={selectionMode}\n                onPick={handleViewportPick}\n                viewCommand={viewCommand}\n                selectedBodyId={selectedBodyId}\n                onBodySelect={handleBodySelect}\n              />\n            ) : (`);
app = app.slice(0, stageStart) + stage + app.slice(stageEnd);

writeFileSync(path, app);
console.log('M3.1 PartModelStage wiring applied');
