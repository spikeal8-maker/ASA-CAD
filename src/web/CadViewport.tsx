import React, { useEffect, useRef, useState } from 'react';
import type { CadRenderModel } from '../contracts/render';
import './runtime.css';

export function CadViewport({ model }: { model: CadRenderModel | null }) {
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
        for (const source of model.meshes) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(source.positions, 3));
          geometry.setAttribute('normal', new THREE.BufferAttribute(source.normals, 3));
          geometry.setIndex(new THREE.BufferAttribute(source.indices, 1));
          for (const face of source.faceGroups) geometry.addGroup(face.start, face.count, 0);
          geometry.computeBoundingSphere();

          const material = new THREE.MeshStandardMaterial({
            color: 0xc8d3df,
            roughness: 0.55,
            metalness: 0.08,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData = {
            cadMeshId: source.meshId,
            bodyId: source.bodyId,
            sourceFeatureId: source.sourceFeatureId,
            faceGroups: source.faceGroups,
          };
          group.add(mesh);
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

        const resize = () => {
          const current = hostRef.current;
          if (!current) return;
          const width = Math.max(current.clientWidth, 1);
          const height = Math.max(current.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        cleanup = () => {
          observer.disconnect();
          for (const child of group.children) {
            if (!(child instanceof THREE.Mesh)) continue;
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach((item) => item.dispose());
            else child.material.dispose();
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

  return (
    <div
      ref={hostRef}
      className="cad-viewport"
      data-testid="cad-viewport"
      data-runtime-revision={model?.runtimeRevision ?? ''}
    >
      {error && <div className="cad-viewport-error">{error}</div>}
    </div>
  );
}
