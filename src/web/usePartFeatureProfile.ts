import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createSharedBrowserSketchSolverClient } from '../browser/SharedBrowserSketchSolver';
import type { CadApplication } from '../contracts/application';
import type { CadSketchId } from '../contracts/ids';
import { PartFeatureProfile } from './PartFeatureProfile';

/** One profile consumer for Extrude/Cut; the runtime and Sketch overlay share its solver provider. */
export function usePartFeatureProfile(app: CadApplication, sketchId: CadSketchId | null): PartFeatureProfile {
  const profile = useMemo(() => new PartFeatureProfile(
    () => app.getDocument(), createSharedBrowserSketchSolverClient(),
  ), [app]);
  useSyncExternalStore(profile.subscribe, profile.getSnapshot, profile.getSnapshot);

  useEffect(() => {
    const refresh = () => { void profile.refresh(sketchId); };
    const unsubscribe = app.subscribe(refresh);
    refresh();
    return () => {
      unsubscribe();
      // Non-owning client: release transient input/results, never the shared WASM instance.
      profile.cancel();
    };
  }, [app, profile, sketchId]);

  return profile;
}
