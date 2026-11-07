import type { CadDocument } from '../contracts/document';
import type {
  CadReferenceCaptureRequest,
  CadRuntimeAdapter,
  CadRuntimeRecomputeResult,
  CadRuntimeReferenceCaptureResult,
  CadRuntimeRequest,
} from '../contracts/runtime';
import type { CadRenderModel, CadRenderModelProvider } from '../contracts/render';
import { SolvedSketchPartRuntimeAdapter } from '../runtime/SolvedSketchPartRuntimeAdapter';
import { LazyCadRuntimeLoader, type CadRuntimeLoadState } from './LazyCadRuntimeLoader';
import { probeCurrentBrowserCapabilities } from './capabilities';

interface LoadedPartRuntime {
  runtime: CadRuntimeAdapter;
  render: CadRenderModelProvider;
}
interface AcceptedRender {
  source: Readonly<CadDocument>;
  snapshot: Readonly<CadDocument>;
  ownership: CadRuntimeRequest;
  model: CadRenderModel | null;
  deflection: number;
}

/** Lazy product bridge. Only the current request can publish runtime/render state. */
export class BrowserPartRuntimeAdapter implements CadRuntimeAdapter, CadRenderModelProvider {
  private requestId = 0;
  private disposed = false;
  private accepted: AcceptedRender | null = null;
  private readonly loader: LazyCadRuntimeLoader<LoadedPartRuntime>;

  constructor(loader?: LazyCadRuntimeLoader<LoadedPartRuntime>) {
    this.loader = loader ?? createPartRuntimeLoader(() => !this.disposed);
  }

  getLoadState(): Readonly<CadRuntimeLoadState> {
    return this.loader.getState();
  }

  async recompute(document: Readonly<CadDocument>, parent?: CadRuntimeRequest): Promise<CadRuntimeRecomputeResult> {
    const ownership = this.beginRequest(parent);
    try {
      this.assertCurrent(ownership);
      if (document.kind !== 'part' || document.features.every(feature => feature.suppressed)) {
        this.accepted = null;
        return {
          ok: true, diagnostics: [],
          runtimeRevision: document.kind === 'part' ? 'part-no-brep' : document.kind + '-no-runtime',
        };
      }
      const snapshot = structuredClone(document);
      const loaded = await this.load();
      this.assertCurrent(ownership);
      const result = await loaded.runtime.recompute(snapshot, ownership);
      this.assertCurrent(ownership);
      this.accepted = result.ok ? this.acceptRender(document, snapshot, ownership, loaded) : null;
      return result;
    } catch (error) {
      if (ownership.isCurrent()) this.accepted = null;
      throw error;
    }
  }

  async captureReference(
    document: Readonly<CadDocument>,
    request: CadReferenceCaptureRequest,
    parent?: CadRuntimeRequest,
  ): Promise<CadRuntimeReferenceCaptureResult> {
    const ownership = this.beginRequest(parent);
    this.assertCurrent(ownership);
    const snapshot = structuredClone(document);
    const input = structuredClone(request);
    const loaded = await this.load();
    this.assertCurrent(ownership);
    const captured = await loaded.runtime.captureReference(snapshot, input, ownership);
    this.assertCurrent(ownership);
    this.accepted = this.acceptRender(document, snapshot, ownership, loaded);
    return captured;
  }

  getRenderModel(document: Readonly<CadDocument>, options: { deflection?: number } = {}): CadRenderModel | null {
    const accepted = this.accepted;
    if (this.disposed || !accepted) return null;
    // A rejected synchronous command may restore an equivalent document clone.
    if (document !== accepted.source && JSON.stringify(document) !== JSON.stringify(accepted.source)) return null;
    const deflection = options.deflection ?? 0.1;
    if (accepted.deflection === deflection) return accepted.model;
    if (!accepted.ownership.isCurrent()) return null;
    const loaded = this.loader.getIfReady();
    if (!loaded) return null;
    accepted.model = loaded.render.getRenderModel(accepted.snapshot, options);
    accepted.deflection = deflection;
    return accepted.model;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestId++;
    this.accepted = null;
    const loaded = this.loader.getIfReady();
    loaded?.runtime.dispose();
    if (this.loader.getState().status !== 'loading') this.loader.reset();
  }

  private beginRequest(parent?: CadRuntimeRequest): CadRuntimeRequest {
    const id = ++this.requestId;
    return { isCurrent: () => !this.disposed && id === this.requestId && (parent?.isCurrent() ?? true) };
  }

  private assertCurrent(request: CadRuntimeRequest): void {
    if (!request.isCurrent()) throw new Error('CAD runtime request superseded or disposed');
  }

  private async load(): Promise<LoadedPartRuntime> {
    try {
      const loaded = await this.loader.load();
      if (this.disposed) {
        // Concurrent waiters share one instance; reset makes this cleanup run once.
        if (this.loader.getIfReady() === loaded) {
          loaded.runtime.dispose();
          this.loader.reset();
        }
        throw new Error('BrowserPartRuntimeAdapter disposed while loading');
      }
      return loaded;
    } catch (error) {
      if (this.disposed && this.loader.getState().status !== 'loading') this.loader.reset();
      throw error;
    }
  }

  private acceptRender(
    source: Readonly<CadDocument>, snapshot: Readonly<CadDocument>,
    ownership: CadRuntimeRequest, loaded: LoadedPartRuntime,
  ): AcceptedRender {
    this.assertCurrent(ownership);
    // Snapshot the last valid model before another request can mutate the OCC cache.
    // Pending rebuilds keep this model for the same document, preserving the camera.
    const model = loaded.render.getRenderModel(snapshot);
    return { source, snapshot, ownership, model, deflection: 0.1 };
  }
}

function createPartRuntimeLoader(isAlive: () => boolean): LazyCadRuntimeLoader<LoadedPartRuntime> {
  return new LazyCadRuntimeLoader(probeCurrentBrowserCapabilities, async () => {
    const [openCascadeModule, runtimeModule, renderModule, solverModule] = await Promise.all([
      import('opencascade.js'),
      import('../runtime/OpenCascadePartRuntime'),
      import('../runtime/OpenCascadePartRenderAdapter'),
      import('./SharedBrowserSketchSolver'),
    ]);
    if (!isAlive()) throw new Error('BrowserPartRuntimeAdapter disposed while loading');
    const oc = await openCascadeModule.default();
    if (!isAlive()) throw new Error('BrowserPartRuntimeAdapter disposed while loading');
    const coreRuntime = new runtimeModule.OpenCascadePartRuntime(oc);
    const runtime = new SolvedSketchPartRuntimeAdapter(coreRuntime, solverModule.createSharedBrowserSketchSolverClient());
    return { runtime, render: new renderModule.OpenCascadePartRenderAdapter(coreRuntime) };
  });
}
