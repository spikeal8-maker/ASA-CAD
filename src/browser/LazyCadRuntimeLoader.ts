import type { CadBrowserCapabilityResult } from './capabilities';

export type CadRuntimeLoadStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

export interface CadRuntimeLoadState {
  status: CadRuntimeLoadStatus;
  capabilities?: CadBrowserCapabilityResult;
  error?: string;
}

export type CadCapabilityProbe = () => CadBrowserCapabilityResult;
export type CadRuntimeFactory<T> = () => Promise<T>;

/**
 * Owns the lazy-load lifecycle for the heavy browser CAD runtime. Constructing
 * this object performs no kernel/WASM work. The factory runs only after load().
 */
export class LazyCadRuntimeLoader<T> {
  private state: CadRuntimeLoadState = { status: 'idle' };
  private instance: T | null = null;
  private pending: Promise<T> | null = null;

  constructor(
    private readonly probe: CadCapabilityProbe,
    private readonly factory: CadRuntimeFactory<T>,
  ) {}

  getState(): Readonly<CadRuntimeLoadState> {
    return this.state;
  }

  getIfReady(): T | null {
    return this.instance;
  }

  async load(): Promise<T> {
    if (this.instance) return this.instance;
    if (this.pending) return this.pending;

    const capabilities = this.probe();
    if (!capabilities.supported) {
      this.state = { status: 'unsupported', capabilities };
      throw new CadRuntimeUnsupportedError(capabilities);
    }

    this.state = { status: 'loading', capabilities };
    this.pending = this.factory()
      .then((instance) => {
        this.instance = instance;
        this.state = { status: 'ready', capabilities };
        return instance;
      })
      .catch((error: unknown) => {
        this.state = {
          status: 'error',
          capabilities,
          error: error instanceof Error ? error.message : String(error),
        };
        throw error;
      })
      .finally(() => {
        this.pending = null;
      });

    return this.pending;
  }

  reset(): void {
    if (this.pending) throw new Error('Cannot reset CAD runtime while it is loading');
    this.instance = null;
    this.state = { status: 'idle' };
  }
}

export class CadRuntimeUnsupportedError extends Error {
  readonly code = 'CAD_RUNTIME_UNSUPPORTED';

  constructor(readonly capabilities: CadBrowserCapabilityResult) {
    super(`CAD runtime unsupported: ${capabilities.reasons.join('; ') || 'capability requirements not met'}`);
    this.name = 'CadRuntimeUnsupportedError';
  }
}
