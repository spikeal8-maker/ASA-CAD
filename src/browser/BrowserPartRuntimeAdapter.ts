import type { CadDocument } from '../contracts/document';
import type {
  CadReferenceCaptureRequest,
  CadRuntimeAdapter,
  CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
} from '../contracts/runtime';
import type { CadRenderModel, CadRenderModelProvider } from '../contracts/render';
import { LazyCadRuntimeLoader, type CadRuntimeLoadState } from './LazyCadRuntimeLoader';
import { probeCurrentBrowserCapabilities } from './capabilities';

interface LoadedPartRuntime {
  runtime: CadRuntimeAdapter;
  render: CadRenderModelProvider;
}

/**
 * Product-side lazy bridge. Empty documents and sketch-only editing stay light;
 * OpenCascade/Three tessellation are imported only when a Part feature needs a
 * real B-Rep rebuild or topology reference capture.
 */
export class BrowserPartRuntimeAdapter implements CadRuntimeAdapter, CadRenderModelProvider {
  private readonly loader = new LazyCadRuntimeLoader<LoadedPartRuntime>(
    probeCurrentBrowserCapabilities,
    async () => {
      const [openCascadeModule, runtimeModule, renderModule] = await Promise.all([
        import('opencascade.js'),
        import('../runtime/OpenCascadePartRuntime'),
        import('../runtime/OpenCascadePartRenderAdapter'),
      ]);
      const oc = await openCascadeModule.default();
      const runtime = new runtimeModule.OpenCascadePartRuntime(oc);
      const render = new renderModule.OpenCascadePartRenderAdapter(runtime);
      return { runtime, render };
    },
  );

  getLoadState(): Readonly<CadRuntimeLoadState> {
    return this.loader.getState();
  }

  async recompute(document: Readonly<CadDocument>): Promise<CadRuntimeRecomputeResult> {
    // The shell and sketch-only document model need no solid kernel yet. This is
    // what keeps normal ASA-CAD boot and New Document routing free of WASM work.
    if (document.kind !== 'part' || document.features.every((feature) => feature.suppressed)) {
      return {
        ok: true,
        diagnostics: [],
        runtimeRevision: document.kind === 'part' ? 'part-no-brep' : `${document.kind}-no-runtime`,
      };
    }
    return (await this.loader.load()).runtime.recompute(document);
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
    return this.loader.getIfReady()?.render.getRenderModel(document, options) ?? null;
  }

  dispose(): void {
    const loaded = this.loader.getIfReady();
    loaded?.runtime.dispose();
    if (this.loader.getState().status !== 'loading') this.loader.reset();
  }
}
