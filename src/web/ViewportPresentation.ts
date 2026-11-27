import type { PerspectiveCamera, Vector3 } from 'three';
import type { CadViewportViewName, ViewportCameraPose } from './viewport/ViewportCameraController';
import type { CadEditorMode } from '../browser/editorModes';
import { createViewportReferenceLayer } from './viewport/ViewportReferenceLayer';

/** Select presentation adapters; the viewport, render model and geometry runtime remain shared. */
export async function loadViewportPresentation(mode: CadEditorMode) {
  if (mode === 'fusion') {
    const [three, camera, controls, reference] = await Promise.all([
      import('three'), import('./fusion/ProjectionCamera'),
      import('./fusion/LiveOrbitControls'), import('./fusion/LiveReferenceLayer'),
    ]);
    return [{ ...three, PerspectiveCamera: camera.FusionProjectionCamera }, controls, reference.createViewportReferenceLayer] as const;
  }
  const [three, controls] = await Promise.all([import('three'), import('three/examples/jsm/controls/OrbitControls.js')]);
  return [three, controls, createViewportReferenceLayer] as const;
}

type ProjectionScaleCamera = PerspectiveCamera & { fitScale?(distance: number): void };

/** Apply shared view commands to the concrete presentation camera without changing CAD state. */
export function applyViewportCameraPose(
  camera: ProjectionScaleCamera,
  controls: { target: Vector3; update(): unknown },
  view: CadViewportViewName,
  pose: ViewportCameraPose,
): void {
  camera.position.set(...pose.position);
  controls.target.set(...pose.target);
  camera.up.set(...pose.up);
  if (view === 'fit') camera.fitScale?.(camera.position.distanceTo(controls.target));
  camera.lookAt(controls.target);
  controls.update();
}
