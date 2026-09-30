import type { CadDocument } from '../contracts/document';
import type {
  CadReferenceCaptureRequest,
  CadRuntimeAdapter,
  CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
} from '../contracts/runtime';
import type { CadRenderModel, CadRenderModelProvider } from '../contracts/render';
import { SolvedSketchPartRuntimeAdapter } from '../runtime/SolvedSketchPartRuntimeAdapter';
import { LazyCadRuntimeLoader, type CadRuntimeLoadState } from './LazyCadRuntimeLoader';
import { probeCurrentBrowserCapabilities } from './capabilities';
import { createSharedBrowserSketchSolverClient } from './SharedBrowserSketchSolver';

interface LoadedPartRuntime {
  runtime: CadRuntimeAdapter;
  render: CadRenderModelProvider;
}

/**
 * Product-side lazy bridge. Empty documents and sketch-only editing stay light;
 * feature rebuilds pass through the shared Sketch solver before OpenCascade.
 */
export class BrowserPartRuntimeAdapter implements CadRuntimeAdapter, CadRenderModelProvider {
  private renderCurrent = false;
  private readonly loader = new LazyCadRuntimeLoader<LoadedPartRuntime>(
    probeCurrentBrowserCapabilities,
    async () => {
      const [openCascadeModule, runtimeModule, renderModule] = await Promise.all([
        import('opencascade.js'),
        import('../runtime/OpenCascadePartRuntime'),
        import('../runtime/OpenCascadePartRenderAdapter'),
      ]);
      const oc = await openCascadeModule.default();
      const coreRuntime = new runtimeModule.OpenCascadePartRuntime(oc);
      const runtime = new SolvedSketchPartRuntimeAdapter(
        coreRuntime,
        createSharedBrowserSketchSolverClient(),
      );
      const render = new renderModule.OpenCascadePartRenderAdapter(coreRuntime);
      return { runtime, render };
    },
  );

  getLoadState(): Readonly<CadRuntimeLoadState> {
    return this.loader.getState();
  }

  async recompute(document: Readonly<CadDocument>): Promise<CadRuntimeRecomputeResult> {
    this.renderCurrent = false;
    if (document.kind !== 'part' || document.features.every((feature) => feature.suppressed)) {
      return {
        ok: true,
        diagnostics: [],
        runtimeRevision: document.kind === 'part' ? 'part-no-brep' : `${document.kind}-no-runtime`,
      };
    }
    const result = await (await this.loader.load()).runtime.recompute(document);
    this.renderCurrent = result.ok;
    return result;
  }

  async captureReference(
    document: Readonly<CadDocument>,
    request: CadReferenceCaptureRequest,
  ): Promise<CadRuntimeReferenceCaptureResult> {
    return (await this.loader.load()).runtime.captureReference(document, request);
  }

  getRenderModel(
    document: Readonly<CadDocument>,
    options?: { deflection?: number },
  ): CadRenderModel | null {
    if (!this.renderCurrent) return null;
    return this.loader.getIfReady()?.render.getRenderModel(document, options) ?? null;
  }

  dispose(): void {
    const loaded = this.loader.getIfReady();
    loaded?.runtime.dispose();
    this.renderCurrent = false;
    if (this.loader.getState().status !== 'loading') this.loader.reset();
  }
}
