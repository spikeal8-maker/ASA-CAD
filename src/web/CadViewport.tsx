import React, { useEffect, useRef, useState } from 'react';
import type { CadRenderModel, CadViewportPick } from '../contracts/render';
import './runtime.css';

export interface CadViewportProps {
  model: CadRenderModel | null;
  selectionMode?: 'none' | 'face' | 'edge';
  onPick?: (pick: CadViewportPick) => void;
}

export function CadViewport({ model, selectionMode = 'none', onPick }: CadViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !model || model.meshes.length === 0) return;

    let disposed = false;
    let cleanup = () => {};
    setError(null);

    void import('three')
      .then((THREE) => {
        if (disposed || !hostRef.current) return;

        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = `cad-viewport-canvas selection-${selectionMode}`;
        host.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100000);
        camera.up.set(0, 0, 1);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x657080, 1.75));
        const key = new THREE.DirectionalLight(0xffffff, 2.25);
        key.position.set(2, -3, 4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.7);
        fill.position.set(-3, 2, 1);
        scene.add(fill);

        const group = new THREE.Group();
        const meshRecords: Array<{
          mesh: InstanceType<typeof THREE.Mesh>;
          source: CadRenderModel['meshes'][number];
          materials: Array<InstanceType<typeof THREE.MeshStandardMaterial>>;
          edges: InstanceType<typeof THREE.LineSegments>;
          edgeMaterials: Array<InstanceType<typeof THREE.LineBasicMaterial>>;
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
              color: 0xc8d3df,
              roughness: 0.55,
              metalness: 0.08,
              side: THREE.DoubleSide,
            }),
            new THREE.MeshStandardMaterial({
              color: 0xa9d7f5,
              roughness: 0.48,
              metalness: 0.05,
              side: THREE.DoubleSide,
            }),
            new THREE.MeshStandardMaterial({
              color: 0x66b9e8,
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
          const edgeMaterials = [
            new THREE.LineBasicMaterial({ color: 0x4b5966, transparent: true, opacity: 0.58 }),
            new THREE.LineBasicMaterial({ color: 0x1b91d0, transparent: false }),
          ];
          const edges = new THREE.LineSegments(edgeGeometry, edgeMaterials[selectionMode === 'edge' ? 1 : 0]);
          edges.userData = {
            cadMeshId: source.meshId,
            bodyId: source.bodyId,
            sourceFeatureId: source.sourceFeatureId,
          };
          group.add(edges);
          meshRecords.push({ mesh, source, materials, edges, edgeMaterials });
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
        camera.position.set(
          center.x + diagonal * 0.95,
          center.y - diagonal * 1.15,
          center.z + diagonal * 0.8,
        );
        camera.near = Math.max(diagonal / 1000, 0.01);
        camera.far = diagonal * 100;
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        const raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = Math.max(diagonal * 0.012, 0.25);
        const pointer = new THREE.Vector2();
        const selectedMarker = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(diagonal * 0.009, 0.35), 16, 10),
          new THREE.MeshBasicMaterial({ color: 0x0f82c1, depthTest: false }),
        );
        selectedMarker.visible = false;
        selectedMarker.renderOrder = 20;
        scene.add(selectedMarker);

        let selectedFace: { meshId: string; faceIndex: number } | null = null;
        let hoverFace: { meshId: string; faceIndex: number } | null = null;

        const render = () => renderer.render(scene, camera);

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
          if (selectionMode === 'face') {
            const found = faceHit(event);
            hoverFace = found ? { meshId: found.record.source.meshId, faceIndex: found.face.faceIndex } : null;
            refreshFaceMaterials();
            renderer.domElement.style.cursor = found ? 'crosshair' : 'default';
            render();
            return;
          }
          if (selectionMode === 'edge') {
            const found = edgeHit(event);
            renderer.domElement.style.cursor = found ? 'crosshair' : 'default';
            if (!selectedMarker.visible && found) {
              selectedMarker.position.copy(found.hit.point);
              selectedMarker.visible = true;
              render();
            } else if (!found && selectedMarker.visible) {
              selectedMarker.visible = false;
              render();
            }
          }
        };

        const onPointerLeave = () => {
          hoverFace = null;
          refreshFaceMaterials();
          if (selectionMode === 'edge') selectedMarker.visible = false;
          renderer.domElement.style.cursor = 'default';
          render();
        };

        const onPointerClick = (event: PointerEvent) => {
          if (selectionMode === 'face') {
            const found = faceHit(event);
            if (!found) return;
            selectedFace = {
              meshId: found.record.source.meshId,
              faceIndex: found.face.faceIndex,
            };
            hoverFace = null;
            refreshFaceMaterials();
            render();
            onPick?.({
              kind: 'face',
              meshId: found.record.source.meshId,
              bodyId: found.record.source.bodyId,
              sourceFeatureId: found.record.source.sourceFeatureId,
              faceIndex: found.face.faceIndex,
              point: [found.hit.point.x, found.hit.point.y, found.hit.point.z],
            });
            return;
          }

          if (selectionMode === 'edge') {
            const found = edgeHit(event);
            if (!found) return;
            selectedMarker.position.copy(found.hit.point);
            selectedMarker.visible = true;
            render();
            onPick?.({
              kind: 'edge',
              meshId: found.record.source.meshId,
              bodyId: found.record.source.bodyId,
              sourceFeatureId: found.record.source.sourceFeatureId,
              segmentIndex: found.hit.index ?? undefined,
              point: [found.hit.point.x, found.hit.point.y, found.hit.point.z],
            });
          }
        };

        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerleave', onPointerLeave);
        renderer.domElement.addEventListener('click', onPointerClick);

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
          observer.disconnect();
          renderer.domElement.removeEventListener('pointermove', onPointerMove);
          renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
          renderer.domElement.removeEventListener('click', onPointerClick);
          selectedMarker.geometry.dispose();
          (selectedMarker.material as InstanceType<typeof THREE.MeshBasicMaterial>).dispose();
          for (const record of meshRecords) {
            record.mesh.geometry.dispose();
            record.materials.forEach((material) => material.dispose());
            record.edges.geometry.dispose();
            record.edgeMaterials.forEach((material) => material.dispose());
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
  }, [model, selectionMode, onPick]);

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
