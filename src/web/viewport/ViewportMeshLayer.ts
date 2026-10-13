import type { CadRenderModel } from '../../contracts/render';
import { VIEWPORT_VISUAL_TOKENS } from '../viewportTokens';
import type { ViewportSelectionSnapshot } from './ViewportSelectionController';

type Three = typeof import('three');
type RenderMesh = CadRenderModel['meshes'][number];

export interface ViewportMeshRecord {
  mesh: InstanceType<Three['Mesh']>;
  source: RenderMesh;
  materials: Array<InstanceType<Three['MeshStandardMaterial']>>;
  edges: InstanceType<Three['LineSegments']>;
  edgeMaterial: InstanceType<Three['LineBasicMaterial']>;
}

/**
 * Three adapter for tessellated B-Rep bodies: builds face/edge objects from the
 * kernel-neutral render model and maps selection snapshots to face materials.
 */
export function createViewportMeshLayer(THREE: Three, meshes: readonly RenderMesh[]) {
  const group = new THREE.Group();
  const records: ViewportMeshRecord[] = [];

  for (const source of meshes) {
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
    records.push({ mesh, source, materials, edges, edgeMaterial });
  }

  const refresh = (snapshot: Readonly<ViewportSelectionSnapshot>) => {
    const ordinaryMode = snapshot.mode === 'none';
    const selectedCandidate = snapshot.selectedCommandCandidate;
    const hoverCandidate = snapshot.hoverCandidate;
    for (const record of records) {
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

  const dispose = () => {
    for (const record of records) {
      record.mesh.geometry.dispose();
      record.materials.forEach((material) => material.dispose());
      record.edges.geometry.dispose();
      record.edgeMaterial.dispose();
    }
  };

  return { group, records, refresh, dispose };
}

export type ViewportMeshLayer = ReturnType<typeof createViewportMeshLayer>;
