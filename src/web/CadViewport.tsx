import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CadPlaneName } from '../contracts/commands';
import type { CadRenderModel, CadViewportPick } from '../contracts/render';
import type { CadBodyId } from '../contracts/ids';
import { VIEWPORT_VISUAL_TOKENS } from './viewportTokens';
import { partReferenceScene } from './viewport/PartReferenceGeometry';
import { createViewportMeshLayer } from './viewport/ViewportMeshLayer';
import { createViewportReferenceLayer } from './viewport/ViewportReferenceLayer';
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
import { SketchOverlayLayer } from './viewport/SketchOverlayLayer';
import type { SketchOverlayModel } from './viewport/SketchOverlayModel';
import {
  ViewportCameraController,
  type CadViewportViewName,
  type ViewportCameraPose,
} from './viewport/ViewportCameraController';
import './runtime.css';

export type { CadViewportViewName } from './viewport/ViewportCameraController';

export interface CadViewportViewCommand {
  sequence: number;
  view: CadViewportViewName;
}

export interface CadViewportProps {
  model: CadRenderModel | null;
  /** Separate transient 2D Sketch surface; never merged into B-Rep CadRenderModel. */
  sketchOverlay?: SketchOverlayModel | null;
  selectionMode?: ViewportSelectionMode;
  onPick?: (pick: CadViewportPick) => void;
  /** Called only when multiple near-depth semantic targets compete under the cursor. */
  onPickCandidates?: (candidates: readonly ViewportPickCandidate[]) => void;
  viewCommand?: CadViewportViewCommand;
  selectedBodyId?: CadBodyId | null;
  onBodySelect?: (bodyId: CadBodyId | null) => void;
  /** Document origin planes; when given, the scene exists without any B-Rep. */
  referencePlanes?: readonly CadPlaneName[] | null;
  selectedPlane?: CadPlaneName | null;
  onPlaneSelect?: (plane: CadPlaneName) => void;
}

interface ViewportInteractionBridge {
  setSelectionMode(mode: ViewportSelectionMode): void;
  setView(view: CadViewportViewName): void;
  setSelectedBodyId(bodyId: CadBodyId | null): void;
  setSelectedPlane(plane: CadPlaneName | null): void;
}

interface StoredCameraState {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  up: readonly [number, number, number];
}

export function CadViewport({
  model,
  sketchOverlay = null,
  selectionMode = 'none',
  onPick,
  onPickCandidates,
  viewCommand,
  selectedBodyId = null,
  onBodySelect,
  referencePlanes = null,
  selectedPlane = null,
  onPlaneSelect,
}: CadViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectionModeRef = useRef(selectionMode);
  const onPickRef = useRef(onPick);
  const onPickCandidatesRef = useRef(onPickCandidates);
  const selectedBodyIdRef = useRef<CadBodyId | null>(selectedBodyId);
  const onBodySelectRef = useRef(onBodySelect);
  const selectedPlaneRef = useRef<CadPlaneName | null>(selectedPlane);
  const onPlaneSelectRef = useRef(onPlaneSelect);
  const cameraTouchedRef = useRef(false);
  const sceneHadMeshesRef = useRef(false);
  const referenceKey = referencePlanes?.join(',') ?? '';
  const viewCommandRef = useRef(viewCommand);
  const appliedViewSequenceRef = useRef<number | null>(null);
  const interactionRef = useRef<ViewportInteractionBridge | null>(null);
  const cameraStateRef = useRef<StoredCameraState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    onPickCandidatesRef.current = onPickCandidates;
  }, [onPickCandidates]);

  useEffect(() => {
    onBodySelectRef.current = onBodySelect;
    onPlaneSelectRef.current = onPlaneSelect;
  }, [onBodySelect, onPlaneSelect]);

  useEffect(() => {
    selectedPlaneRef.current = selectedPlane;
    interactionRef.current?.setSelectedPlane(selectedPlane);
  }, [selectedPlane]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
    interactionRef.current?.setSelectionMode(selectionMode);
  }, [selectionMode]);

  useEffect(() => {
    selectedBodyIdRef.current = selectedBodyId;
    interactionRef.current?.setSelectedBodyId(selectedBodyId);
  }, [selectedBodyId]);

  useEffect(() => {
    viewCommandRef.current = viewCommand;
    if (viewCommand && viewCommand.sequence > 0) cameraTouchedRef.current = true;
    if (!viewCommand || !interactionRef.current) return;
    if (appliedViewSequenceRef.current === viewCommand.sequence) return;
    interactionRef.current.setView(viewCommand.view);
    appliedViewSequenceRef.current = viewCommand.sequence;
  }, [viewCommand?.sequence, viewCommand?.view]);

  // Layout effect: a replaced scene leaves the DOM in the same commit that
  // delivers the new model, so a visible canvas always matches current props.
  useLayoutEffect(() => {
    const host = hostRef.current;
    const meshes = model?.meshes ?? [];
    const planeIds = referenceKey ? referenceKey.split(',') as CadPlaneName[] : [];
    if (!host || (meshes.length === 0 && planeIds.length === 0)) return;

    let disposed = false;
    let cleanup = () => {};
    setError(null);

    void Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
    ])
      .then(([THREE, controlsModule]) => {
        if (disposed || !hostRef.current) return;

        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = `cad-viewport-canvas selection-${selectionModeRef.current}`;
        renderer.domElement.tabIndex = 0;
        host.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100000);
        camera.up.set(0, 0, 1);
        scene.add(new THREE.HemisphereLight(
          VIEWPORT_VISUAL_TOKENS.hemisphereSky,
          VIEWPORT_VISUAL_TOKENS.hemisphereGround,
          1.75,
        ));
        const key = new THREE.DirectionalLight(VIEWPORT_VISUAL_TOKENS.light, 2.25);
        key.position.set(2, -3, 4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(VIEWPORT_VISUAL_TOKENS.light, 0.7);
        fill.position.set(-3, 2, 1);
        scene.add(fill);

        const meshLayer = createViewportMeshLayer(THREE, meshes);
        const meshRecords = meshLayer.records;
        scene.add(meshLayer.group);
        const reference = planeIds.length ? partReferenceScene(planeIds, model && meshes.length ? model.bounds : null) : null;
        const referenceLayer = reference ? createViewportReferenceLayer(THREE, reference) : null;
        if (referenceLayer) scene.add(referenceLayer.group);

        const { minX, minY, minZ, maxX, maxY, maxZ } = model && meshes.length ? model.bounds : reference!.bounds;
        const center = new THREE.Vector3(
          (minX + maxX) / 2,
          (minY + maxY) / 2,
          (minZ + maxZ) / 2,
        );
        const diagonal = Math.max(
          Math.hypot(maxX - minX, maxY - minY, maxZ - minZ),
          10,
        );
        camera.near = Math.max(diagonal / 1000, 0.01);
        camera.far = diagonal * 100;

        const controls = new controlsModule.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.screenSpacePanning = true;
        controls.zoomToCursor = true;
        controls.enablePan = true;
        controls.enableRotate = true;
        controls.enableZoom = true;
        controls.minDistance = Math.max(diagonal * 0.02, 0.05);
        controls.maxDistance = diagonal * 50;
        controls.mouseButtons.LEFT = null;
        controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
        controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
        controls.touches.ONE = THREE.TOUCH.ROTATE;
        controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

        // The first body after an untouched empty scene is framed exactly as a
        // fresh B-Rep scene; otherwise the user's camera continues unchanged.
        const fitFirstModel = meshes.length > 0 && !sceneHadMeshesRef.current && !cameraTouchedRef.current;
        sceneHadMeshesRef.current = meshes.length > 0;
        if (fitFirstModel) appliedViewSequenceRef.current = null;
        if (cameraStateRef.current && !fitFirstModel) {
          camera.position.set(...cameraStateRef.current.position);
          controls.target.set(...cameraStateRef.current.target);
          camera.up.set(...cameraStateRef.current.up);
        } else {
          camera.position.set(
            center.x + diagonal * 0.95,
            center.y - diagonal * 1.15,
            center.z + diagonal * 0.8,
          );
          controls.target.copy(center);
          camera.up.set(0, 0, 1);
        }
        camera.lookAt(controls.target);
        controls.update();

        const raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = Math.max(diagonal * 0.012, 0.25);
        const pointer = new THREE.Vector2();

        const hoverMarker = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(diagonal * 0.007, 0.28), 14, 8),
          new THREE.MeshBasicMaterial({
            color: VIEWPORT_VISUAL_TOKENS.markerPreselection,
            depthTest: false,
          }),
        );
        hoverMarker.visible = false;
        hoverMarker.renderOrder = 19;
        scene.add(hoverMarker);

        const selectedMarker = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(diagonal * 0.009, 0.35), 16, 10),
          new THREE.MeshBasicMaterial({
            color: VIEWPORT_VISUAL_TOKENS.markerSelection,
            depthTest: false,
          }),
        );
        selectedMarker.visible = false;
        selectedMarker.renderOrder = 20;
        scene.add(selectedMarker);

        const selection = new ViewportSelectionController(
          selectionModeRef.current,
          selectedBodyIdRef.current,
          selectedPlaneRef.current,
        );
        let viewChangeCount = 0;

        const writeCameraState = () => {
          const currentHost = hostRef.current;
          if (!currentHost) return;
          const position: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
          const target: [number, number, number] = [controls.target.x, controls.target.y, controls.target.z];
          const up: [number, number, number] = [camera.up.x, camera.up.y, camera.up.z];
          cameraStateRef.current = { position, target, up };
          currentHost.dataset.cameraPosition = position.map((value) => value.toFixed(6)).join(',');
          currentHost.dataset.cameraTarget = target.map((value) => value.toFixed(6)).join(',');
          currentHost.dataset.cameraUp = up.map((value) => value.toFixed(6)).join(',');
          currentHost.dataset.viewChangeCount = String(viewChangeCount);
        };

        const render = () => renderer.render(scene, camera);
        const onCameraChange = () => {
          viewChangeCount += 1;
          writeCameraState();
          render();
        };
        const onNavigationStart = () => { cameraTouchedRef.current = true; };
        controls.addEventListener('change', onCameraChange);
        controls.addEventListener('start', onNavigationStart);
        host.dataset.sceneRevision = model && meshes.length ? model.runtimeRevision : 'reference';
        writeCameraState();

        const finishViewMutation = (view: CadViewportViewName, pose: ViewportCameraPose) => {
          camera.position.set(...pose.position);
          controls.target.set(...pose.target);
          camera.up.set(...pose.up);
          camera.lookAt(controls.target);
          controls.update();
          const currentHost = hostRef.current;
          if (currentHost) currentHost.dataset.viewName = view;
          writeCameraState();
          render();
        };

        const cameraController = new ViewportCameraController({
          center: [center.x, center.y, center.z],
          diagonal,
          readState: () => ({
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z],
            up: [camera.up.x, camera.up.y, camera.up.z],
            fovDegrees: camera.fov,
            aspect: camera.aspect,
            minDistance: controls.minDistance,
            maxDistance: controls.maxDistance,
          }),
          applyPose: finishViewMutation,
        });

        const setView = (view: CadViewportViewName) => cameraController.setView(view);

        const faceGroupAtTriangle = (
          source: CadRenderModel['meshes'][number],
          triangleIndex: number,
        ) => {
          const indexOffset = triangleIndex * 3;
          return source.faceGroups.find(
            (face) => indexOffset >= face.start && indexOffset < face.start + face.count,
          ) ?? null;
        };

        const refreshMaterials = () => {
          const snapshot = selection.getSnapshot();
          meshLayer.refresh(snapshot);
          referenceLayer?.refresh(snapshot);
        };

        const resetCommandSelectionVisuals = () => {
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
          renderer.domElement.className = `cad-viewport-canvas selection-${mode}`;
          resetCommandSelectionVisuals();
        };
        const setSelectedBodyId = (bodyId: CadBodyId | null) => {
          selectedBodyIdRef.current = bodyId;
          selection.setExternalBodySelection(bodyId);
          refreshMaterials();
          render();
        };
        const setSelectedPlane = (plane: CadPlaneName | null) => {
          selection.setExternalPlaneSelection(plane);
          refreshMaterials();
          render();
        };
        interactionRef.current = { setSelectionMode, setView, setSelectedBodyId, setSelectedPlane };
        refreshMaterials();
        const pendingViewCommand = viewCommandRef.current;
        if (pendingViewCommand && appliedViewSequenceRef.current !== pendingViewCommand.sequence) {
          setView(pendingViewCommand.view);
          appliedViewSequenceRef.current = pendingViewCommand.sequence;
        }

        const setPointer = (event: PointerEvent) => {
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

        const planeEntries = () => (referenceLayer?.hits(raycaster) ?? []).map((candidate) => ({ candidate }));

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
            return [{ candidate }];
          });
          return resolveEntries([...entries, ...planeEntries()], 'none');
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
            return [{ candidate }];
          });
          return resolveEntries([...entries, ...planeEntries()], 'face');
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

        const onPointerMove = (event: PointerEvent) => {
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
            const candidate = found.candidate;
            selection.select(candidate);
            hoverMarker.visible = false;
            refreshMaterials();
            render();
            if (candidate.kind === 'base-plane') onPlaneSelectRef.current?.(candidate.planeId);
            else if (candidate.kind === 'face') {
              onPickRef.current?.({
                kind: 'face',
                meshId: candidate.meshId,
                bodyId: candidate.bodyId,
                sourceFeatureId: candidate.sourceFeatureId,
                faceIndex: candidate.faceIndex,
                point: candidate.point,
              });
            }
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
          const candidate = found?.candidate ?? null;
          selection.select(candidate);
          refreshMaterials();
          render();
          if (candidate?.kind === 'base-plane') {
            onPlaneSelectRef.current?.(candidate.planeId);
            return;
          }
          const bodyId = candidate?.kind === 'body' ? candidate.bodyId : null;
          selectedBodyIdRef.current = bodyId;
          onBodySelectRef.current?.(bodyId);
        };

        const onPointerDown = (event: PointerEvent) => {
          if (event.button === 1 || event.button === 2) {
            renderer.domElement.style.cursor = 'grabbing';
          }
        };
        const onPointerUp = () => {
          renderer.domElement.style.cursor = selectionModeRef.current === 'none' ? 'default' : 'crosshair';
        };
        const onContextMenu = (event: MouseEvent) => {
          event.preventDefault();
        };

        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerleave', onPointerLeave);
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('click', onPointerClick);
        renderer.domElement.addEventListener('contextmenu', onContextMenu);

        const resize = () => {
          const current = hostRef.current;
          if (!current) return;
          const width = Math.max(current.clientWidth, 1);
          const height = Math.max(current.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          render();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        cleanup = () => {
          interactionRef.current = null;
          observer.disconnect();
          controls.removeEventListener('change', onCameraChange);
          controls.removeEventListener('start', onNavigationStart);
          controls.dispose();
          renderer.domElement.removeEventListener('pointermove', onPointerMove);
          renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
          renderer.domElement.removeEventListener('pointerdown', onPointerDown);
          renderer.domElement.removeEventListener('pointerup', onPointerUp);
          renderer.domElement.removeEventListener('click', onPointerClick);
          renderer.domElement.removeEventListener('contextmenu', onContextMenu);
          hoverMarker.geometry.dispose();
          (hoverMarker.material as InstanceType<typeof THREE.MeshBasicMaterial>).dispose();
          selectedMarker.geometry.dispose();
          (selectedMarker.material as InstanceType<typeof THREE.MeshBasicMaterial>).dispose();
          meshLayer.dispose();
          referenceLayer?.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason));
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [model, referenceKey]);

  const bounds = model
    ? [model.bounds.minX, model.bounds.minY, model.bounds.minZ, model.bounds.maxX, model.bounds.maxY, model.bounds.maxZ].join(',')
    : '';

  return (
    <div
      ref={hostRef}
      className="cad-viewport"
      data-testid="cad-viewport"
      data-runtime-revision={model?.runtimeRevision ?? ''}
      data-selection-mode={selectionMode}
      data-selected-body-id={selectedBodyId ?? ''}
      data-bounds={bounds}
      data-reference-planes={referenceKey}
      data-selected-plane={selectedPlane ?? ''}
    >
      <SketchOverlayLayer model={sketchOverlay} />
      {error && <div className="cad-viewport-error">{error}</div>}
    </div>
  );
}
