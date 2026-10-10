import {
  REFERENCE_HOVER_COLOR,
  REFERENCE_SELECTION_COLOR,
  type ViewportReferencePlane,
  type ViewportReferenceScene,
} from './PartReferenceGeometry';
import type { ViewportBasePlaneCandidate } from './ViewportPicking';
import type { ViewportSelectionSnapshot } from './ViewportSelectionController';

type Three = typeof import('three');

const FILL_OPACITY = { idle: 0, hover: 0.1, selected: 0.16 } as const;

/**
 * Three adapter for the Part origin: axis lines and translucent base planes.
 * Plane identity crosses the picking seam as the document plane name only.
 */
export function createViewportReferenceLayer(THREE: Three, reference: ViewportReferenceScene) {
  const group = new THREE.Group();
  group.name = 'asa-part-origin';

  const planes = reference.planes.map((plane: ViewportReferencePlane) => {
    const [a, b, c, d] = plane.corners.map((corner) => new THREE.Vector3(...corner));
    const outlineMaterial = new THREE.LineBasicMaterial({ color: plane.color });
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([a, b, c, d]), outlineMaterial);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: plane.color,
      transparent: true,
      opacity: FILL_OPACITY.idle,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fill = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([a, b, c, a, c, d]), fillMaterial);
    fill.renderOrder = 1;
    fill.userData = { cadPlaneId: plane.id };
    outline.userData = { cadPlaneId: plane.id };
    group.add(fill, outline);
    return { plane, outline, outlineMaterial, fill, fillMaterial };
  });

  const axes = reference.axes.map((axis) => {
    const material = new THREE.LineBasicMaterial({ color: axis.color });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(...axis.end)]),
      material,
    );
    line.userData = { cadAxis: axis.id };
    group.add(line);
    return { line, material };
  });

  const hits = (raycaster: InstanceType<Three['Raycaster']>): ViewportBasePlaneCandidate[] =>
    raycaster.intersectObjects(planes.map((record) => record.fill), false).flatMap((hit) => {
      const record = planes.find((item) => item.fill === hit.object);
      return record
        ? [{
          kind: 'base-plane' as const,
          planeId: record.plane.id,
          distance: hit.distance,
          point: [hit.point.x, hit.point.y, hit.point.z] as const,
        }]
        : [];
    });

  const refresh = (snapshot: Readonly<ViewportSelectionSnapshot>) => {
    const hovered = snapshot.hoverCandidate?.kind === 'base-plane' ? snapshot.hoverCandidate.planeId : null;
    const commandPlane = snapshot.selectedCommandCandidate?.kind === 'base-plane'
      ? snapshot.selectedCommandCandidate.planeId
      : null;
    const selected = commandPlane ?? snapshot.selectedPlaneId;
    for (const record of planes) {
      const state = record.plane.id === selected ? 'selected' : record.plane.id === hovered ? 'hover' : 'idle';
      const color = state === 'selected' ? REFERENCE_SELECTION_COLOR : state === 'hover' ? REFERENCE_HOVER_COLOR : record.plane.color;
      record.outlineMaterial.color.setHex(color);
      record.fillMaterial.color.setHex(color);
      record.fillMaterial.opacity = FILL_OPACITY[state];
    }
  };

  const dispose = () => {
    for (const record of planes) {
      record.outline.geometry.dispose();
      record.outlineMaterial.dispose();
      record.fill.geometry.dispose();
      record.fillMaterial.dispose();
    }
    for (const axis of axes) {
      axis.line.geometry.dispose();
      axis.material.dispose();
    }
  };

  return { group, hits, refresh, dispose };
}

export type ViewportReferenceLayer = ReturnType<typeof createViewportReferenceLayer>;
