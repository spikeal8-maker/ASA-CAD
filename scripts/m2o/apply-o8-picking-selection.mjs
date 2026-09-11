import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const path = 'src/web/CadViewport.tsx';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O8.1 codemod could not find ${label}`);
  source = source.replace(before, after);
}

function replaceBetween(label, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`O8.1 codemod could not locate ${label}`);
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

replaceOnce(
  'viewport interaction imports',
  "import { VIEWPORT_VISUAL_TOKENS } from './viewportTokens';\n",
  `import { VIEWPORT_VISUAL_TOKENS } from './viewportTokens';
import {
  resolveViewportPickCandidates,
  type ViewportBodyCandidate,
  type ViewportEdgeCandidate,
  type ViewportFaceCandidate,
  type ViewportPickCandidate,
  type ViewportPickResolution,
  type ViewportSelectionMode,
} from './viewport/ViewportPicking';
import { ViewportSelectionController } from './viewport/ViewportSelectionController';
`,
);

replaceOnce(
  'viewport props selection contract',
  `  selectionMode?: 'none' | 'face' | 'edge';
  onPick?: (pick: CadViewportPick) => void;
  viewCommand?: CadViewportViewCommand;`,
  `  selectionMode?: ViewportSelectionMode;
  onPick?: (pick: CadViewportPick) => void;
  /** Called only when multiple near-depth semantic targets compete under the cursor. */
  onPickCandidates?: (candidates: readonly ViewportPickCandidate[]) => void;
  viewCommand?: CadViewportViewCommand;`,
);

replaceOnce(
  'bridge selection mode contract',
  "  setSelectionMode(mode: 'none' | 'face' | 'edge'): void;",
  '  setSelectionMode(mode: ViewportSelectionMode): void;',
);

replaceOnce(
  'candidate callback destructuring',
  `  selectionMode = 'none',
  onPick,
  viewCommand,`,
  `  selectionMode = 'none',
  onPick,
  onPickCandidates,
  viewCommand,`,
);

replaceOnce(
  'candidate callback ref',
  `  const onPickRef = useRef(onPick);
  const selectedBodyIdRef`,
  `  const onPickRef = useRef(onPick);
  const onPickCandidatesRef = useRef(onPickCandidates);
  const selectedBodyIdRef`,
);

replaceOnce(
  'candidate callback effect',
  `  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    onBodySelectRef.current = onBodySelect;`,
  `  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    onPickCandidatesRef.current = onPickCandidates;
  }, [onPickCandidates]);

  useEffect(() => {
    onBodySelectRef.current = onBodySelect;`,
);

replaceOnce(
  'selection local state',
  `        let selectedFace: { meshId: string; faceIndex: number } | null = null;
        let hoverFace: { meshId: string; faceIndex: number } | null = null;
        let hoverBodyId: CadBodyId | null = null;
        let viewChangeCount = 0;`,
  `        const selection = new ViewportSelectionController(
          selectionModeRef.current,
          selectedBodyIdRef.current,
        );
        let viewChangeCount = 0;`,
);

replaceBetween(
  'material selection projection',
  '        const refreshMaterials = () => {',
  '        const resetCommandSelectionVisuals = () => {',
  `        const refreshMaterials = () => {
          const snapshot = selection.getSnapshot();
          const ordinaryMode = snapshot.mode === 'none';
          const selectedCandidate = snapshot.selectedCommandCandidate;
          const hoverCandidate = snapshot.hoverCandidate;
          for (const record of meshRecords) {
            const bodySelected = ordinaryMode
              && Boolean(record.source.bodyId)
              && snapshot.selectedBodyId === record.source.bodyId;
            const bodyHovered = ordinaryMode
              && hoverCandidate?.kind === 'body'
              && hoverCandidate.bodyId === record.source.bodyId;
            for (let index = 0; index < record.source.faceGroups.length; index++) {
              const face = record.source.faceGroups[index];
              const faceSelected = selectedCandidate?.kind === 'face'
                && selectedCandidate.meshId === record.source.meshId
                && selectedCandidate.faceIndex === face.faceIndex;
              const faceHovered = hoverCandidate?.kind === 'face'
                && hoverCandidate.meshId === record.source.meshId
                && hoverCandidate.faceIndex === face.faceIndex;
              record.mesh.geometry.groups[index].materialIndex = bodySelected || faceSelected
                ? 2
                : bodyHovered || faceHovered ? 1 : 0;
            }
          }
        };

`,
);

replaceBetween(
  'selection bridge projection',
  '        const resetCommandSelectionVisuals = () => {',
  '        interactionRef.current = { setSelectionMode, setView, setSelectedBodyId };',
  `        const resetCommandSelectionVisuals = () => {
          selection.resetCommandSelection();
          selection.clearHover();
          hoverMarker.visible = false;
          selectedMarker.visible = false;
          refreshMaterials();
          renderer.domElement.style.cursor = 'default';
          render();
        };

        const setSelectionMode = (mode: ViewportSelectionMode) => {
          selection.setMode(mode);
          renderer.domElement.className = \`cad-viewport-canvas selection-\${mode}\`;
          resetCommandSelectionVisuals();
        };
        const setSelectedBodyId = (bodyId: CadBodyId | null) => {
          selectedBodyIdRef.current = bodyId;
          selection.setExternalBodySelection(bodyId);
          refreshMaterials();
          render();
        };
`,
);

replaceBetween(
  'raw ray hits and semantic candidate resolution',
  '        const setPointer = (event: PointerEvent) => {',
  '        const onPointerMove = (event: PointerEvent) => {',
  `        const setPointer = (event: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
        };

        const meshRayHits = (event: PointerEvent) => {
          setPointer(event);
          const hits = raycaster.intersectObjects(meshRecords.map((record) => record.mesh), false);
          return hits.flatMap((hit) => {
            const record = meshRecords.find((item) => item.mesh === hit.object);
            return record ? [{ hit, record }] : [];
          });
        };

        const edgeRayHits = (event: PointerEvent) => {
          setPointer(event);
          const hits = raycaster.intersectObjects(meshRecords.map((record) => record.edges), false);
          return hits.flatMap((hit) => {
            const record = meshRecords.find((item) => item.edges === hit.object);
            return record ? [{ hit, record }] : [];
          });
        };

        const publishCandidateDebug = (resolution: ViewportPickResolution) => {
          const currentHost = hostRef.current;
          if (!currentHost) return;
          currentHost.dataset.pickCandidateCount = String(resolution.ordered.length);
          currentHost.dataset.pickAmbiguous = String(resolution.ambiguous);
          currentHost.dataset.pickPrimaryKind = resolution.primary?.kind ?? '';
        };

        const resolveEntries = <T extends { candidate: ViewportPickCandidate },>(
          entries: T[],
          mode: ViewportSelectionMode,
        ) => {
          const resolution = resolveViewportPickCandidates(entries.map((entry) => entry.candidate), mode);
          publishCandidateDebug(resolution);
          const entry = resolution.primary
            ? entries.find((candidateEntry) => candidateEntry.candidate === resolution.primary) ?? null
            : null;
          return { entry, resolution };
        };

        const bodyHit = (event: PointerEvent) => {
          const entries = meshRayHits(event).flatMap(({ hit, record }) => {
            const bodyId = record.source.bodyId;
            if (!bodyId) return [];
            const candidate: ViewportBodyCandidate = {
              kind: 'body',
              meshId: record.source.meshId,
              bodyId,
              sourceFeatureId: record.source.sourceFeatureId,
              distance: hit.distance,
              point: [hit.point.x, hit.point.y, hit.point.z],
            };
            return [{ hit, record, candidate }];
          });
          return resolveEntries(entries, 'none');
        };

        const faceHit = (event: PointerEvent) => {
          const entries = meshRayHits(event).flatMap(({ hit, record }) => {
            if (hit.faceIndex == null) return [];
            const face = faceGroupAtTriangle(record.source, hit.faceIndex);
            if (!face) return [];
            const candidate: ViewportFaceCandidate = {
              kind: 'face',
              meshId: record.source.meshId,
              bodyId: record.source.bodyId,
              sourceFeatureId: record.source.sourceFeatureId,
              faceIndex: face.faceIndex,
              distance: hit.distance,
              point: [hit.point.x, hit.point.y, hit.point.z],
            };
            return [{ hit, record, face, candidate }];
          });
          return resolveEntries(entries, 'face');
        };

        const edgeHit = (event: PointerEvent) => {
          const entries = edgeRayHits(event).map(({ hit, record }) => {
            const candidate: ViewportEdgeCandidate = {
              kind: 'edge',
              meshId: record.source.meshId,
              bodyId: record.source.bodyId,
              sourceFeatureId: record.source.sourceFeatureId,
              segmentIndex: hit.index ?? undefined,
              distance: hit.distance,
              point: [hit.point.x, hit.point.y, hit.point.z],
            };
            return { hit, record, candidate };
          });
          return resolveEntries(entries, 'edge');
        };

        const offerAmbiguousCandidates = (resolution: ViewportPickResolution): boolean => {
          if (!resolution.ambiguous || !onPickCandidatesRef.current) return false;
          onPickCandidatesRef.current(resolution.ordered);
          return true;
        };

`,
);

replaceBetween(
  'pointer routing through candidate/selection models',
  '        const onPointerMove = (event: PointerEvent) => {',
  '        const onPointerDown = (event: PointerEvent) => {',
  `        const onPointerMove = (event: PointerEvent) => {
          if (event.buttons !== 0) {
            selection.clearHover();
            hoverMarker.visible = false;
            refreshMaterials();
            renderer.domElement.style.cursor = 'grabbing';
            render();
            return;
          }

          const mode = selectionModeRef.current;
          if (mode === 'face') {
            const { entry: found } = faceHit(event);
            selection.setHover(found?.candidate ?? null);
            hoverMarker.visible = false;
            refreshMaterials();
            renderer.domElement.style.cursor = found ? 'crosshair' : 'default';
            render();
            return;
          }
          if (mode === 'edge') {
            const { entry: found } = edgeHit(event);
            selection.setHover(found?.candidate ?? null);
            refreshMaterials();
            if (found) {
              hoverMarker.position.set(...found.candidate.point);
              hoverMarker.visible = true;
            } else {
              hoverMarker.visible = false;
            }
            renderer.domElement.style.cursor = found ? 'crosshair' : 'default';
            render();
            return;
          }
          if (mode === 'sketch') {
            selection.clearHover();
            hoverMarker.visible = false;
            refreshMaterials();
            renderer.domElement.style.cursor = 'default';
            render();
            return;
          }

          const { entry: found } = bodyHit(event);
          selection.setHover(found?.candidate ?? null);
          hoverMarker.visible = false;
          refreshMaterials();
          renderer.domElement.style.cursor = found ? 'pointer' : 'default';
          render();
        };

        const onPointerLeave = () => {
          selection.clearHover();
          hoverMarker.visible = false;
          refreshMaterials();
          renderer.domElement.style.cursor = 'default';
          render();
        };

        const onPointerClick = (event: PointerEvent) => {
          if (event.button !== 0) return;
          const mode = selectionModeRef.current;
          if (mode === 'face') {
            const { entry: found, resolution } = faceHit(event);
            if (!found || offerAmbiguousCandidates(resolution)) return;
            selection.select(found.candidate);
            hoverMarker.visible = false;
            refreshMaterials();
            render();
            onPickRef.current?.({
              kind: 'face',
              meshId: found.candidate.meshId,
              bodyId: found.candidate.bodyId,
              sourceFeatureId: found.candidate.sourceFeatureId,
              faceIndex: found.candidate.faceIndex,
              point: found.candidate.point,
            });
            return;
          }

          if (mode === 'edge') {
            const { entry: found, resolution } = edgeHit(event);
            if (!found || offerAmbiguousCandidates(resolution)) return;
            selection.select(found.candidate);
            hoverMarker.visible = false;
            selectedMarker.position.set(...found.candidate.point);
            selectedMarker.visible = true;
            render();
            onPickRef.current?.({
              kind: 'edge',
              meshId: found.candidate.meshId,
              bodyId: found.candidate.bodyId,
              sourceFeatureId: found.candidate.sourceFeatureId,
              segmentIndex: found.candidate.segmentIndex,
              point: found.candidate.point,
            });
            return;
          }

          if (mode === 'sketch') return;

          const { entry: found, resolution } = bodyHit(event);
          if (offerAmbiguousCandidates(resolution)) return;
          selection.select(found?.candidate ?? null);
          const bodyId = found?.candidate.bodyId ?? null;
          selectedBodyIdRef.current = bodyId;
          refreshMaterials();
          render();
          onBodySelectRef.current?.(bodyId);
        };

        const onPointerLeaveLegacyGuard = false;
        void onPointerLeaveLegacyGuard;

`,
);

// The replacement above owns onPointerLeave/onPointerClick. No legacy local
// selection state should remain after this point.

writeFileSync(path, source);

let pkg = readFileSync('package.json', 'utf8');
const beforeScript = '    "test:m2o:solve-cycle": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-solve-session.ts && node tests/m2o/sketch-solve-boundary.mjs",\n    "test:m2o":';
const afterScript = '    "test:m2o:solve-cycle": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/sketch-solve-session.ts && node tests/m2o/sketch-solve-boundary.mjs",\n    "test:m2o:viewport-interaction": "node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m2o/viewport-picking.ts && node tests/m2o/viewport-interaction-boundary.mjs",\n    "test:m2o":';
if (!pkg.includes(beforeScript)) throw new Error('O8.1 codemod could not add viewport test script');
pkg = pkg.replace(beforeScript, afterScript);
const beforeGate = 'npm run test:m2o:sketch-session && npm run test:m2o:solve-cycle",';
const afterGate = 'npm run test:m2o:sketch-session && npm run test:m2o:solve-cycle && npm run test:m2o:viewport-interaction",';
if (!pkg.includes(beforeGate)) throw new Error('O8.1 codemod could not include viewport gate');
pkg = pkg.replace(beforeGate, afterGate);
writeFileSync('package.json', pkg);

for (const tempPath of [
  'scripts/m2o/apply-o8-picking-selection.mjs',
  '.github/workflows/m2o-o8-picking-selection-codemod.yml',
]) {
  if (existsSync(tempPath)) rmSync(tempPath);
}

console.log('Applied O8.1 candidate/selection extraction and removed one-shot codemod');
