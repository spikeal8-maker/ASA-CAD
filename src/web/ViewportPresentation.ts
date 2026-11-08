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
