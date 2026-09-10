import type {
  CadApplication,
  CadApplicationListener,
  CadApplicationState,
} from '../contracts/application';
import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
} from '../contracts/commands';
import type {
  CadDocument,
  CadPartDocument,
  CadStableReference,
} from '../contracts/document';
import type { CadStableReferenceId } from '../contracts/ids';
import { createCadId } from '../contracts/ids';
import type { CadReferenceCaptureRequest, CadRuntimeAdapter } from '../contracts/runtime';
import {
  applyPartDocumentCommand,
  getPartCommandAvailability,
} from './partCommandHandlers';

function cloneDocument<T extends CadDocument>(document: T): T {
  return structuredClone(document);
}

function errorResult(error: unknown): CadCommandResult {
  return {
    ok: false,
    changed: false,
    error: {
      code: 'CAD_COMMAND_FAILED',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

/**
 * Application/session orchestration only. Domain mutation logic belongs to
 * focused command-handler modules so M3/M4 do not grow another giant switch.
 */
export class CadApplicationImpl implements CadApplication {
  private document: CadDocument;
  private readonly runtime: CadRuntimeAdapter;
  private readonly listeners = new Set<CadApplicationListener>();
  private undoStack: CadDocument[] = [];
  private redoStack: CadDocument[] = [];
  private disposed = false;
  private state: CadApplicationState;

  constructor(document: CadDocument, runtime: CadRuntimeAdapter) {
    this.document = cloneDocument(document);
    this.runtime = runtime;
    this.state = {
      documentKind: document.kind,
      mode: 'idle',
      selection: [],
      canUndo: false,
      canRedo: false,
      dirty: false,
      recompute: { status: 'dirty' },
    };
  }

  getDocument(): Readonly<CadDocument> {
    return this.document;
  }

  getState(): Readonly<CadApplicationState> {
    return this.state;
  }

  getCommandAvailability(id: CadCommandId): CadCommandAvailability {
    if (this.disposed) return { enabled: false, reason: 'Application is disposed' };
    if (id === 'document.rebuild') return { enabled: true };
    if (this.document.kind !== 'part') {
      return { enabled: false, reason: 'Command requires a Part document' };
    }
    return getPartCommandAvailability(this.document, id);
  }

  async execute(command: CadCommand): Promise<CadCommandResult> {
    this.assertAlive();
    const availability = this.getCommandAvailability(command.id);
    if (!availability.enabled) {
      return {
        ok: false,
        changed: false,
        error: {
          code: 'CAD_COMMAND_DISABLED',
          message: availability.reason ?? `Command ${command.id} is disabled`,
        },
      };
    }

    if (command.id === 'document.rebuild') return this.recompute();

    const before = cloneDocument(this.document);
    try {
      const result = applyPartDocumentCommand(this.requirePart(), command);
      if (result.changed) {
        this.undoStack.push(before);
        this.redoStack = [];
        this.state = {
          ...this.state,
          dirty: true,
          recompute: { status: 'dirty' },
          canUndo: this.undoStack.length > 0,
          canRedo: false,
        };
        this.emit();
      }
      return result;
    } catch (error) {
      this.document = before;
      return errorResult(error);
    }
  }

  async captureReference(request: CadReferenceCaptureRequest): Promise<CadStableReferenceId> {
    this.assertAlive();
    const part = this.requirePart();

    if (this.state.recompute.status === 'dirty' || this.state.recompute.status === 'error') {
      const rebuild = await this.recompute();
      if (!rebuild.ok) {
        throw new Error(rebuild.error?.message ?? 'Cannot capture reference from an invalid model');
      }
    }

    const captured = await this.runtime.captureReference(this.document, request);
    const before = cloneDocument(this.document);
    const id = createCadId<CadStableReferenceId>('ref');
    const reference: CadStableReference = {
      id,
      ownerFeatureId: captured.ownerFeatureId,
      semanticRole: captured.semanticRole,
      locator: structuredClone(captured.locator),
    };
    part.stableReferences.push(reference);
    this.undoStack.push(before);
    this.redoStack = [];
    this.state = {
      ...this.state,
      dirty: true,
      canUndo: true,
      canRedo: false,
    };
    this.emit();
    return id;
  }

  async undo(): Promise<CadCommandResult> {
    this.assertAlive();
    const previous = this.undoStack.pop();
    if (!previous) return { ok: true, changed: false };

    this.redoStack.push(cloneDocument(this.document));
    this.document = cloneDocument(previous);
    this.state = {
      ...this.state,
      documentKind: this.document.kind,
      dirty: true,
      canUndo: this.undoStack.length > 0,
      canRedo: true,
      recompute: { status: 'dirty' },
    };
    this.emit();
    const rebuild = await this.recompute();
    return rebuild.ok ? { ...rebuild, changed: true } : rebuild;
  }

  async redo(): Promise<CadCommandResult> {
    this.assertAlive();
    const next = this.redoStack.pop();
    if (!next) return { ok: true, changed: false };

    this.undoStack.push(cloneDocument(this.document));
    this.document = cloneDocument(next);
    this.state = {
      ...this.state,
      documentKind: this.document.kind,
      dirty: true,
      canUndo: true,
      canRedo: this.redoStack.length > 0,
      recompute: { status: 'dirty' },
    };
    this.emit();
    const rebuild = await this.recompute();
    return rebuild.ok ? { ...rebuild, changed: true } : rebuild;
  }

  async replaceDocument(document: CadDocument): Promise<void> {
    this.assertAlive();
    this.document = cloneDocument(document);
    this.undoStack = [];
    this.redoStack = [];
    this.state = {
      documentKind: document.kind,
      mode: 'idle',
      selection: [],
      canUndo: false,
      canRedo: false,
      dirty: false,
      recompute: { status: 'dirty' },
    };
    this.emit();
    await this.recompute();
  }

  subscribe(listener: CadApplicationListener): () => void {
    this.assertAlive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.runtime.dispose();
  }

  private async recompute(): Promise<CadCommandResult> {
    this.state = { ...this.state, mode: 'rebuilding', recompute: { status: 'running' } };
    this.emit();
    try {
      const result = await this.runtime.recompute(this.document);
      const firstError = result.diagnostics.find((item) => item.severity === 'error');
      const firstWarning = result.diagnostics.find((item) => item.severity === 'warning');
      this.state = {
        ...this.state,
        mode: result.ok ? 'idle' : 'error',
        recompute: result.ok
          ? firstWarning
            ? { status: 'warning', message: firstWarning.message }
            : { status: 'clean' }
          : { status: 'error', message: firstError?.message ?? 'Recompute failed' },
      };
      this.emit();
      return result.ok
        ? {
            ok: true,
            changed: false,
            warnings: result.diagnostics
              .filter((item) => item.severity === 'warning')
              .map((item) => item.message),
          }
        : {
            ok: false,
            changed: false,
            error: {
              code: firstError?.code ?? 'CAD_RECOMPUTE_FAILED',
              message: firstError?.message ?? 'Recompute failed',
            },
          };
    } catch (error) {
      this.state = {
        ...this.state,
        mode: 'error',
        recompute: { status: 'error', message: error instanceof Error ? error.message : String(error) },
      };
      this.emit();
      return errorResult(error);
    }
  }

  private requirePart(): CadPartDocument {
    if (this.document.kind !== 'part') throw new Error('Command requires a Part document');
    return this.document;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('CadApplication is disposed');
  }
}
