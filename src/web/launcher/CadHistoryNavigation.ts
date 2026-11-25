import { parseCadClientRoute } from '../../browser/routes';

export interface CadHistoryEntry { pathname: string; index: number; key?: string }
export interface CadLeaveGuard {
  isDirty(): boolean;
  confirmLeave(): Promise<boolean>;
  /** Release the modal only after the accepted URL is actually reached. */
  settled(): void;
}
export interface CadHistoryPort {
  read(): CadHistoryEntry;
  push(entry: CadHistoryEntry): void;
  traverse(target: CadHistoryEntry, from: CadHistoryEntry): Promise<void>;
  commit(pathname: string): void;
}
export type CadNavigationPhase = 'idle' | 'restoring' | 'confirming' | 'replaying';
interface PendingNavigation {
  kind: 'push' | 'pop';
  target: CadHistoryEntry;
  guard: CadLeaveGuard;
  asked: boolean;
  decision?: boolean;
  resolve(): void;
}

function sameEntry(a: CadHistoryEntry, b: CadHistoryEntry): boolean {
  return a.index === b.index && a.pathname === b.pathname && (!a.key || !b.key || a.key === b.key);
}

function sameDocument(from: string, to: string): boolean {
  const a = parseCadClientRoute(from), b = parseCadClientRoute(to);
  return a.kind === 'local-editor' && b.kind === 'local-editor' && a.projectId === b.projectId;
}

/** One accepted document and one navigation transaction; popstate is never a blanket bypass. */
export class CadHistoryNavigation {
  private accepted: CadHistoryEntry;
  private observed: CadHistoryEntry;
  private guard: CadLeaveGuard | null = null;
  private pending: PendingNavigation | null = null;
  private moving = false;
  private disposed = false;
  phase: CadNavigationPhase = 'idle';

  constructor(private readonly port: CadHistoryPort) {
    this.accepted = this.observed = port.read();
  }

  registerGuard(guard: CadLeaveGuard): () => void {
    this.guard = guard;
    return () => {
      if (this.guard === guard) this.guard = null;
      if (this.pending?.guard === guard) { this.pending.decision = false; this.advance(); }
    };
  }

  go(pathname: string): Promise<void> {
    if (this.disposed || this.pending || pathname === this.accepted.pathname) return Promise.resolve();
    const target = { pathname, index: this.accepted.index + 1 };
    const guard = this.requiredGuard(target);
    if (!guard) { this.push(target); return Promise.resolve(); }
    return new Promise(resolve => {
      this.pending = { kind: 'push', target, guard, asked: false, resolve };
      this.advance();
    });
  }

  pop(entry: CadHistoryEntry): void {
    if (this.disposed) return;
    this.observed = entry;
    if (this.pending) { this.advance(); return; }
    const guard = this.requiredGuard(entry);
    // In particular, a registered but clean editor accepts Back synchronously.
    if (!guard || sameEntry(entry, this.accepted)) { this.accept(entry); return; }
    this.pending = { kind: 'pop', target: entry, guard, asked: false, resolve() {} };
    this.advance();
  }

  dispose(): void {
    this.disposed = true;
    this.complete();
    this.guard = null;
  }

  private requiredGuard(target: CadHistoryEntry): CadLeaveGuard | null {
    return !sameDocument(this.accepted.pathname, target.pathname) && this.guard?.isDirty() ? this.guard : null;
  }

  private accept(entry: CadHistoryEntry): void {
    this.accepted = this.observed = entry;
    this.port.commit(entry.pathname);
  }

  private push(entry: CadHistoryEntry): void {
    this.port.push(entry);
    this.accept(this.port.read());
  }

  private advance(): void {
    const request = this.pending;
    if (!request || this.moving || this.disposed) return;
    const replay = this.phase === 'replaying';
    const destination = replay ? request.target : this.accepted;
    if (!sameEntry(this.observed, destination)) {
      this.phase = replay ? 'replaying' : 'restoring';
      this.moving = true;
      // Browser traversals are asynchronous. Neither a guard decision nor an
      // intervening Back may start another relative traversal before this ends.
      void this.port.traverse(destination, this.observed).then(() => {
        if (this.disposed || this.pending !== request) return;
        this.moving = false;
        this.observed = this.port.read();
        this.advance();
      });
      return;
    }
    if (replay) { this.accept(this.observed); this.complete(); return; }
    if (request.decision === false) { this.complete(); return; }
    if (request.decision === true) {
      if (request.kind === 'push') { this.push(request.target); this.complete(); }
      else { this.phase = 'replaying'; this.advance(); }
      return;
    }
    this.phase = 'confirming';
    if (request.asked) return;
    request.asked = true;
    // A save may have completed while restoration was in progress.
    if (!request.guard.isDirty()) { request.decision = true; this.advance(); return; }
    try {
      void request.guard.confirmLeave().then(
        allowed => this.decide(request, allowed),
        () => this.decide(request, false),
      );
    } catch { this.decide(request, false); }
  }

  private decide(request: PendingNavigation, allowed: boolean): void {
    if (this.pending !== request || this.disposed) return;
    request.decision = allowed;
    this.advance();
  }

  private complete(): void {
    const request = this.pending;
    this.pending = null;
    this.phase = 'idle';
    request?.guard.settled();
    request?.resolve();
  }
}

/** History API fallback: one step in flight, even when several Back events were queued. */
export class CadHistoryStepper {
  private pending: { direction: number; resolve(): void } | null = null;
  constructor(private readonly move: (delta: number) => void) {}

  traverse(target: CadHistoryEntry, from: CadHistoryEntry): Promise<void> {
    const direction = Math.sign(target.index - from.index);
    if (!direction) return Promise.resolve();
    return new Promise(resolve => {
      this.pending = { direction, resolve };
      this.move(direction);
    });
  }

  pop(previous: CadHistoryEntry, entry: CadHistoryEntry): void {
    // Repeated Back while restoring forward is a user traversal, not the
    // completion of our queued forward step. Wait for that step before retrying.
    if (this.pending && Math.sign(entry.index - previous.index) === this.pending.direction) {
      const { resolve } = this.pending; this.pending = null; resolve();
    }
  }
  dispose(): void { this.pending?.resolve(); this.pending = null; }
}
