import React, { useEffect, useRef, useState } from 'react';
import type { CadRenderModel, CadViewportPick } from '../contracts/render';
import { VIEWPORT_VISUAL_TOKENS } from './viewportTokens';
import './runtime.css';

export type CadViewportViewName =
  | 'fit'
  | 'front'
  | 'back'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'isometric'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down';

export interface CadViewportViewCommand {
  sequence: number;
  view: CadViewportViewName;
}

export interface CadViewportProps {
  model: CadRenderModel | null;
  selectionMode?: 'none' | 'face' | 'edge';
  onPick?: (pick: CadViewportPick) => void;
  viewCommand?: CadViewportViewCommand;
}

interface ViewportInteractionBridge {
  setSelectionMode(mode: 'none' | 'face' | 'edge'): void;
  setView(view: CadViewportViewName): void;
}

interface StoredCameraState {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  up: readonly [number, number, number];
}

export function CadViewport({ model, selectionMode = 'none', onPick, viewCommand }: CadViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectionModeRef = useRef(selectionMode);
  const onPickRef = useRef(onPick);
  const viewCommandRef = useRef(viewCommand);
  const appliedViewSequenceRef = useRef<number | null>(null);
  const interactionRef = useRef<ViewportInteractionBridge | null>(null);
  const cameraStateRef = useRef<StoredCameraState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
    interactionRef.current?.setSelectionMode(selectionMode);
  }, [selectionMode]);

  useEffect(() => {
    viewCommandRef.current = viewCommand;
    if (!viewCommand || !interactionRef.current) return;
    if (appliedViewSequenceRef.current === viewCommand.sequence) return;
    interactionRef.current.setView(viewCommand.view);
    appliedViewSequenceRef.current = viewCommand.sequence;
  }, [viewCommand?.sequence, viewCommand?.view]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !model || model.meshes.length === 0) return;

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

        const group = new THREE.Group();
        const meshRecords: Array<{
          mesh: InstanceType<typeof THREE.Mesh>;
          source: CadRenderModel['meshes'][number];
          materials: Array<InstanceType<typeof THREE.MeshStandardMaterial>>;
          edges: InstanceType<typeof THREE.LineSegments>;
          edgeMaterial: InstanceType<typeof THREE.LineBasicMaterial>;
        }> = [];

        for (const source of model.meshes) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(source.positions, 3));
          geometry.setAttribute('normal', new THREE.BufferAttribute(source.normals, 3));
          geometry.setIndex(new THREE.BufferAttribute(source.indices, 1));
          for (const face of source.faceGroups) geometry.addGroup(face.start, face.count, 0);
          geometry.computeBoundingSphere();

          const materials = [
            new THREE.MeshStandardMaterial({
              color: VIEWPORT_VISUAL_TOKENS.solid,
              roughness: 0.55,
              metalness: 0.08,
              side: THREE.DoubleSide,
            }),
            new THREE.MeshStandardMaterial({
              color: VIEWPORT_VISUAL_TOKENS.facePreselection,
              roughness: 0.48,
              metalness: 0.05,
              side: THREE.DoubleSide,
            }),
            new THREE.MeshStandardMaterial({
              color: VIEWPORT_VISUAL_TOKENS.faceSelection,
              roughness: 0.42,
              metalness: 0.05,
              side: THREE.DoubleSide,
            }),
          ];
          const mesh = new THREE.Mesh(geometry, materials);
          mesh.userData = {
            cadMeshId: source.meshId,
            bodyId: source.bodyId,
            sourceFeatureId: source.sourceFeatureId,
            faceGroups: source.faceGroups,
          };
          group.add(mesh);

          const edgeGeometry = new THREE.EdgesGeometry(geometry, 25);
          const edgeMaterial = new THREE.LineBasicMaterial({
            color: VIEWPORT_VISUAL_TOKENS.edge,
            transparent: true,
            opacity: 0.62,
          });
          const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
          edges.userData = {
            cadMeshId: source.meshId,
            bodyId: source.bodyId,
            sourceFeatureId: source.sourceFeatureId,
          };
          group.add(edges);
          meshRecords.push({ mesh, source, materials, edges, edgeMaterial });
        }
        scene.add(group);

        const { minX, minY, minZ, maxX, maxY, maxZ } = model.bounds;
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

        if (cameraStateRef.current) {
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

        let selectedFace: { meshId: string; faceIndex: number } | null = null;
        let hoverFace: { meshId: string; faceIndex: number } | null = null;
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
        controls.addEventListener('change', onCameraChange);
        writeCameraState();

        const fitDistance = () => {
          const radius = diagonal / 2;
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.01));
          const limitingFov = Math.max(Math.min(verticalFov, horizontalFov), THREE.MathUtils.degToRad(5));
          return Math.min(
            Math.max(radius / Math.sin(limitingFov / 2) * 1.16, controls.minDistance * 2),
            controls.maxDistance * 0.95,
          );
        };

        const finishViewMutation = (view: CadViewportViewName) => {
          camera.lookAt(controls.target);
          controls.update();
          const currentHost = hostRef.current;
          if (currentHost) currentHost.dataset.viewName = view;
          writeCameraState();
          render();
        };

        const setView = (view: CadViewportViewName) => {
          const currentOffset = camera.position.clone().sub(controls.target);
          if (currentOffset.lengthSq() < 1e-10) currentOffset.set(1, -1, 1);

          if (view === 'zoom-in' || view === 'zoom-out') {
            const nextDistance = THREE.MathUtils.clamp(
              currentOffset.length() * (view === 'zoom-in' ? 0.82 : 1.22),
              controls.minDistance,
              controls.maxDistance,
            );
            currentOffset.setLength(nextDistance);
            camera.position.copy(controls.target).add(currentOffset);
            finishViewMutation(view);
            return;
          }

          if (view.startsWith('pan-')) {
            const viewDirection = controls.target.clone().sub(camera.position).normalize();
            const screenRight = new THREE.Vector3().crossVectors(viewDirection, camera.up).normalize();
            const screenUp = new THREE.Vector3().crossVectors(screenRight, viewDirection).normalize();
            const amount = Math.max(currentOffset.length() * 0.06, diagonal * 0.01);
            const delta = new THREE.Vector3();
            if (view === 'pan-left') delta.addScaledVector(screenRight, -amount);
            if (view === 'pan-right') delta.addScaledVector(screenRight, amount);
            if (view === 'pan-up') delta.addScaledVector(screenUp, amount);
            if (view === 'pan-down') delta.addScaledVector(screenUp, -amount);
            camera.position.add(delta);
            controls.target.add(delta);
            finishViewMutation(view);
            return;
          }

          const currentDirection = currentOffset.normalize();
          let direction = currentDirection;
          let up = camera.up.clone();
          if (view === 'front') { direction = new THREE.Vector3(0, -1, 0); up = new THREE.Vector3(0, 0, 1); }
          if (view === 'back') { direction = new THREE.Vector3(0, 1, 0); up = new THREE.Vector3(0, 0, 1); }
          if (view === 'top') { direction = new THREE.Vector3(0, 0, 1); up = new THREE.Vector3(0, 1, 0); }
          if (view === 'bottom') { direction = new THREE.Vector3(0, 0, -1); up = new THREE.Vector3(0, -1, 0); }
          if (view === 'left') { direction = new THREE.Vector3(-1, 0, 0); up = new THREE.Vector3(0, 0, 1); }
          if (view === 'right') { direction = new THREE.Vector3(1, 0, 0); up = new THREE.Vector3(0, 0, 1); }
          if (view === 'isometric') { direction = new THREE.Vector3(1, -1, 1).normalize(); up = new THREE.Vector3(0, 0, 1); }

          controls.target.copy(center);
          camera.up.copy(up);
          camera.position.copy(center).addScaledVector(direction, fitDistance());
          finishViewMutation(view);
        };

        const faceGroupAtTriangle = (
          source: CadRenderModel['meshes'][number],
          triangleIndex: number,
        ) => {
          const indexOffset = triangleIndex * 3;
          return source.faceGroups.find(
            (face) => indexOffset >= face.start && indexOffset < face.start + face.count,
          ) ?? null;
        };

        const refreshFaceMaterials = () => {
          for (const record of meshRecords) {
            for (let index = 0; index < record.source.faceGroups.length; index++) {
              const face = record.source.faceGroups[index];
              const selected = selectedFace?.meshId === record.source.meshId && selectedFace.faceIndex === face.faceIndex;
              const hovered = hoverFace?.meshId === record.source.meshId && hoverFace.faceIndex === face.faceIndex;
              record.mesh.geometry.groups[index].materialIndex = selected ? 2 : hovered ? 1 : 0;
            }
          }
        };

        const resetSelectionVisuals = () => {
          selectedFace = null;
          hoverFace = null;
          hoverMarker.visible = false;
          selectedMarker.visible = false;
          refreshFaceMaterials();
          renderer.domElement.style.cursor = 'default';
          render();
        };

        const setSelectionMode = (mode: 'none' | 'face' | 'edge') => {
          renderer.domElement.className = `cad-viewport-canvas selection-${mode}`;
          resetSelectionVisuals();
        };
        interactionRef.current = { setSelectionMode, setView };
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

        const faceHit = (event: PointerEvent) => {
          setPointer(event);
          const hits = raycaster.intersectObjects(meshRecords.map((record) => record.mesh), false);
          for (const hit of hits) {
            const record = meshRecords.find((item) => item.mesh === hit.object);
            if (!record || hit.faceIndex == null) continue;
            const face = faceGroupAtTriangle(record.source, hit.faceIndex);
            if (!face) continue;
            return { hit, record, face };
          }
          return null;
        };

        const edgeHit = (event: PointerEvent) => {
          setPointer(event);
          const hits = raycaster.intersectObjects(meshRecords.map((record) => record.edges), false);
          for (const hit of hits) {
            const record = meshRecords.find((item) => item.edges === hit.object);
            if (record) return { hit, record };
          }
          return null;
        };

        const onPointerMove = (event: PointerEvent) => {
          if (event.buttons !== 0) {
            hoverFace = null;
            hoverMarker.visible = false;
            refreshFaceMaterials();
            renderer.domElement.style.cursor = 'grabbing';
            render();
            return;
          }

          const mode = selectionModeRef.current;
          if (mode === 'face') {
            const found = faceHit(event);
            hoverFace = found ? { meshId: found.record.source.meshId, faceIndex: found.face.faceIndex } : null;
            hoverMarker.visible = false;
            refreshFaceMaterials();
            renderer.domElement.style.cursor = found ? 'crosshair' : 'default';
            render();
            return;
          }
          if (mode === 'edge') {
            const found = edgeHit(event);
            hoverFace = null;
            refreshFaceMaterials();
            if (found) {
              hoverMarker.position.copy(found.hit.point);
              hoverMarker.visible = true;
            } else {
              hoverMarker.visible = false;
            }
            renderer.domElement.style.cursor = found ? 'crosshair' : 'default';
            render();
            return;
          }

          hoverFace = null;
          hoverMarker.visible = false;
          refreshFaceMaterials();
          renderer.domElement.style.cursor = 'default';
          render();
        };

        const onPointerLeave = () => {
          hoverFace = null;
          hoverMarker.visible = false;
          refreshFaceMaterials();
          renderer.domElement.style.cursor = 'default';
          render();
        };

        const onPointerClick = (event: PointerEvent) => {
          if (event.button !== 0) return;
          const mode = selectionModeRef.current;
          if (mode === 'face') {
            const found = faceHit(event);
            if (!found) return;
            selectedFace = {
              meshId: found.record.source.meshId,
              faceIndex: found.face.faceIndex,
            };
            hoverFace = null;
            hoverMarker.visible = false;
            refreshFaceMaterials();
            render();
            onPickRef.current?.({
              kind: 'face',
              meshId: found.record.source.meshId,
              bodyId: found.record.source.bodyId,
              sourceFeatureId: found.record.source.sourceFeatureId,
              faceIndex: found.face.faceIndex,
              point: [found.hit.point.x, found.hit.point.y, found.hit.point.z],
            });
            return;
          }

          if (mode === 'edge') {
            const found = edgeHit(event);
            if (!found) return;
            hoverMarker.visible = false;
            selectedMarker.position.copy(found.hit.point);
            selectedMarker.visible = true;
            render();
            onPickRef.current?.({
              kind: 'edge',
              meshId: found.record.source.meshId,
              bodyId: found.record.source.bodyId,
              sourceFeatureId: found.record.source.sourceFeatureId,
              segmentIndex: found.hit.index ?? undefined,
              point: [found.hit.point.x, found.hit.point.y, found.hit.point.z],
            });
          }
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
          for (const record of meshRecords) {
            record.mesh.geometry.dispose();
            record.materials.forEach((material) => material.dispose());
            record.edges.geometry.dispose();
            record.edgeMaterial.dispose();
          }
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
  }, [model]);

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
      data-bounds={bounds}
    >
      {error && <div className="cad-viewport-error">{error}</div>}
    </div>
  );
}
