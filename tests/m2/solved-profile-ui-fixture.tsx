import { useEffect, useReducer, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePartSketchWorkspace } from '../../src/web/usePartSketchWorkspace';
import { usePartCadUiActionCatalog, type PartCadUiActionCatalogOptions } from '../../src/web/usePartCadUiActionCatalog';
import { useActiveSketchSolveOverlay, type ActiveSketchSolveOverlayResult } from '../../src/web/useActiveSketchSolveOverlay';
import { sharedBrowserSketchSolver } from '../../src/browser/SharedBrowserSketchSolver';
import { serializeCadDocument, type CadPartDocument } from '../../src/contracts/document';
import type { CadDimensionId, CadSketchEntityId, CadSketchId } from '../../src/contracts/ids';
import {
  profileApp, profileTriangle, profileCircle, profileBasePrism, profileCommand, requireProfilePart,
} from '../m1/solved-profile-fixtures';

let app: ReturnType<typeof profileApp>, root: Root | undefined;
let workspace: ReturnType<typeof usePartSketchWorkspace>, catalog: ReturnType<typeof usePartCadUiActionCatalog>;
let fixture: { sketchId: CadSketchId; lines?: CadSketchEntityId[]; dimensionId?: CadDimensionId };
let kind = '', notice = '', commands: string[] = [];
let overlay: ActiveSketchSolveOverlayResult | undefined;
let hold: Promise<void> | null = null, release: (() => void) | null = null;
const initialize = sharedBrowserSketchSolver.init.bind(sharedBrowserSketchSolver);
sharedBrowserSketchSolver.init = async () => { if (hold) await hold; await initialize(); };
const noop = () => {};
const handlers: Omit<PartCadUiActionCatalogOptions, 'workspace' | 'canUndo' | 'canRedo'> = {
  newDocument: noop, open: noop, save: noop, undo: noop, redo: noop, rebuild: noop,
  horizontalConstraint: noop, verticalConstraint: noop, fixedConstraint: noop,
  concentricConstraint: noop, equalConstraint: noop, symmetricConstraint: noop,
  pointOnCurveConstraint: noop, requestView: noop,
};

function Overlay({ document, revision }: { document: Readonly<CadPartDocument>; revision: number }) {
  overlay = useActiveSketchSolveOverlay({
    document, sketch: document.sketches.at(-1) ?? null, active: true, revisionToken: revision,
  });
  return null;
}

function Harness() {
  const [revision, update] = useReducer((value: number) => value + 1, 0);
  const [showOverlay, setOverlay] = useState(true);
  useEffect(() => app.subscribe(update), []);
  workspace = usePartSketchWorkspace({
    app, document: app.getDocument(), renderModelAvailable: false,
    setPanel: noop, setNotice: value => { notice = value; },
  });
  catalog = usePartCadUiActionCatalog({
    ...handlers, workspace, canUndo: app.getState().canUndo, canRedo: app.getState().canRedo,
  });
  const extrude = catalog.byId.get('part.extrude')!, cut = catalog.byId.get('part.cutExtrude')!;
  return <div data-mounted="true">
    <button id="extrude" disabled={!extrude.enabled} onClick={extrude.execute}>Extrude</button>
    <button id="cut" disabled={!cut.enabled} onClick={cut.execute}>Cut</button>
    <button id="commit" onClick={() => workspace.commitActiveCommand()}>Commit</button>
    <button id="overlay" onClick={() => setOverlay(value => !value)}>Overlay</button>
    <output id="command">{workspace.activeCommand ?? ''}</output>
    <output id="overlay-mounted">{String(showOverlay)}</output>
    {showOverlay && <Overlay document={requireProfilePart(app)} revision={revision} />}
  </div>;
}

function state() {
  const part = requireProfilePart(app), e = catalog.byId.get('part.extrude')!, c = catalog.byId.get('part.cutExtrude')!;
  return {
    extrude: workspace.extrude.canStart, cut: workspace.canCut,
    extrudeReason: workspace.extrude.disabledReason, cutReason: workspace.cutDisabledReason,
    catalogExtrude: e.enabled, catalogCut: c.enabled,
    catalogExtrudeReason: e.disabledReason, catalogCutReason: c.disabledReason,
    active: workspace.activeCommand, features: part.features.length,
    featureType: part.features.at(-1)?.type, dto: serializeCadDocument(part),
    commands: [...commands], notice, overlayStatus: overlay?.snapshot.status,
  };
}

const harness = {
  state,
  async setup(next: string) {
    release?.(); hold = null; root?.unmount(); app?.dispose();
    kind = next; app = profileApp(); notice = ''; overlay = undefined;
    if (kind === 'cut') await profileBasePrism(app);
    fixture = kind === 'circle' ? await profileCircle(app) : await profileTriangle(app, kind !== 'open');
    const initial = serializeCadDocument(app.getDocument());
    commands = [];
    const execute = app.execute.bind(app);
    app.execute = command => { commands.push(command.id); return execute(command); };
    root = createRoot(document.getElementById('root')!); root.render(<Harness />);
    return initial;
  },
  async bypassDisabled() {
    workspace.extrude.begin(); await workspace.extrude.commit();
    if (kind === 'cut') { workspace.beginCut(); await workspace.commitCut(); }
    return state();
  },
  async invalidate(change: string) {
    const stale = workspace;
    hold = new Promise(resolve => { release = resolve; });
    if (change === 'replace') await app.replaceDocument(structuredClone(app.getDocument()));
    if (change === 'dimension') await profileCommand(app, {
      id: 'part.dimension.setValue', payload: { dimensionId: fixture.dimensionId!, value: 8 },
    });
    if (change === 'constraint') await profileCommand(app, {
      id: 'constraint.fixed',
      payload: { sketchId: fixture.sketchId, entityId: fixture.lines![2], frozenGeometry: { type: 'line', from: [20, 10], to: [0, 1] } },
    });
    if (kind === 'cut') { stale.beginCut(); await stale.commitCut(); }
    else { stale.extrude.begin(); await stale.extrude.commit(); }
    return state();
  },
  resume() { release?.(); release = null; hold = null; },
  async editDiameter() {
    await profileCommand(app, { id: 'part.dimension.setValue', payload: { dimensionId: fixture.dimensionId!, value: 8 } });
  },
  close() { release?.(); root?.unmount(); app?.dispose(); },
};
declare global { var profileHarness: typeof harness; }
globalThis.profileHarness = harness;
