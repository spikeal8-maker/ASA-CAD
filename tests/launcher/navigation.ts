import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { CadHistoryNavigation, CadHistoryStepper, type CadHistoryEntry, type CadLeaveGuard } from '../../src/web/launcher/CadHistoryNavigation';

const first = '/cad/kompas/first', second = '/cad/fusion/second', third = '/cad/kompas/third';
const flush = () => setImmediate();

class LeavePrompt implements CadLeaveGuard {
  dirty = true;
  opened = 0;
  closed = 0;
  decide!: (allowed: boolean) => void;
  reject!: (reason: Error) => void;
  isDirty = () => this.dirty;
  confirmLeave = () => {
    this.opened++;
    return new Promise<boolean>((resolve, reject) => { this.decide = resolve; this.reject = reject; });
  };
  settled = () => { this.closed++; };
}

type Traversal = { delta: number; key?: never; done?: () => void }
  | { key: string; delta?: never; done: () => void };

/** Independent browser history model: queued deltas are applied at delivery,
 * not at the call site. No guard/restore/confirmation logic lives here. */
class HistoryHarness {
  entries: CadHistoryEntry[];
  cursor: number;
  rendered: string;
  queue: Traversal[] = [];
  commits: string[] = [];
  moves = 0;
  private serial = 0;
  readonly controller: CadHistoryNavigation;
  private readonly stepper: CadHistoryStepper;

  constructor(paths: string[], readonly fallback = false) {
    this.entries = paths.map((pathname, index) => ({ pathname, index, key: `entry-${this.serial++}` }));
    this.cursor = paths.length - 1;
    this.rendered = this.current.pathname;
    this.stepper = new CadHistoryStepper(delta => { this.moves++; this.queue.push({ delta }); });
    this.controller = new CadHistoryNavigation({
      read: () => this.current,
      push: entry => {
        this.entries.splice(this.cursor + 1);
        this.entries.push({ ...entry, key: `entry-${this.serial++}` });
        this.cursor++;
      },
      traverse: (target, from) => {
        if (fallback) return this.stepper.traverse(target, from);
        this.moves++;
        return new Promise<void>(done => this.queue.push({ key: target.key!, done }));
      },
      commit: pathname => { this.rendered = pathname; this.commits.push(pathname); },
    });
  }
  get current(): CadHistoryEntry { return this.entries[this.cursor]; }
  back(delta = -1): void { this.queue.push({ delta }); }
  deliver(complete = true): () => void {
    const next = this.queue.shift(); assert.ok(next, 'a browser traversal must be queued');
    const previous = this.current;
    const cursor = next.key === undefined ? this.cursor + next.delta : this.entries.findIndex(entry => entry.key === next.key);
    assert.ok(cursor >= 0 && cursor < this.entries.length, 'a traversal must stay within browser history');
    this.cursor = cursor;
    this.stepper.pop(previous, this.current);
    this.controller.pop(this.current);
    if (complete) next.done?.();
    return () => next.done?.();
  }
  async drain(): Promise<void> {
    for (let count = 0; this.queue.length && count < 20; count++) { this.deliver(); await flush(); }
    assert.equal(this.queue.length, 0, 'navigation must converge without a traversal loop');
  }
  assertAt(pathname: string): void {
    assert.equal(this.current.pathname, pathname, 'address bar');
    assert.equal(this.rendered, pathname, 'accepted rendered route');
  }
}

await test('a registered clean guard accepts Back synchronously and the next push uses the accepted index', async () => {
  const history = new HistoryHarness(['/', first, second]), prompt = new LeavePrompt();
  prompt.dirty = false; history.controller.registerGuard(prompt);
  history.back(); history.deliver();
  history.assertAt(first);
  assert.equal(history.controller.phase, 'idle');
  assert.equal(history.moves, 0, 'clean Back must not bounce through the editor');
  assert.equal(prompt.opened, 0);
  await history.controller.go(third);
  assert.deepEqual(history.entries.map(entry => [entry.pathname, entry.index]), [['/', 0], [first, 1], [third, 2]]);
  history.assertAt(third);
});

await test('a dirty Back waits for restoration completion before showing its guard', async () => {
  const history = new HistoryHarness(['/', first]), prompt = new LeavePrompt();
  history.controller.registerGuard(prompt);
  history.back(); history.deliver();
  assert.equal(history.current.pathname, '/');
  assert.equal(history.rendered, first);
  assert.equal(prompt.opened, 0);
  assert.equal(history.controller.phase, 'restoring');
  const finishRestore = history.deliver(false);
  history.assertAt(first);
  await flush();
  assert.equal(prompt.opened, 0, 'the restore is still in flight');
  finishRestore(); await flush();
  assert.equal(prompt.opened, 1);
  assert.equal(history.controller.phase, 'confirming');
  prompt.decide(false); await flush();
  history.assertAt(first);
  assert.equal(prompt.closed, 1);
  assert.equal(history.controller.phase, 'idle');
});

await test('approval keeps the guard active until replay reaches the actual destination', async () => {
  const history = new HistoryHarness(['/', first]), prompt = new LeavePrompt();
  history.controller.registerGuard(prompt);
  history.back(); history.deliver(); await history.drain();
  prompt.decide(true); await flush();
  history.assertAt(first);
  assert.equal(history.controller.phase, 'replaying');
  assert.equal(prompt.closed, 0, 'background commands must remain blocked during replay');
  const finishReplay = history.deliver(false);
  assert.equal(history.current.pathname, '/');
  assert.equal(history.rendered, first, 'pop alone is not completion of the approved traversal');
  assert.equal(prompt.closed, 0);
  finishReplay(); await flush();
  history.assertAt('/');
  assert.equal(prompt.closed, 1);
  prompt.dirty = false;
  await history.controller.go(third);
  assert.deepEqual(history.entries.map(entry => entry.index), [0, 1]);
});

for (const fallback of [false, true]) {
  const adapter = fallback ? 'History API fallback' : 'absolute entry traversal';
  await test(`repeated Back and Stay before restore settles preserve the editor with ${adapter}`, async () => {
    const history = new HistoryHarness(['/', first, second], fallback), prompt = new LeavePrompt();
    history.controller.registerGuard(prompt);
    history.back(); history.deliver(); await history.drain();
    assert.equal(prompt.opened, 1);
    history.back(); history.back();
    history.deliver(); history.deliver();
    assert.equal(history.current.pathname, '/');
    assert.equal(history.rendered, second);
    assert.equal(history.queue.length, 1, 'only one restoring traversal may be in flight');
    prompt.decide(false); await flush();
    assert.equal(prompt.closed, 0, 'Stay must await URL restoration');
    await history.drain();
    history.assertAt(second);
    assert.equal(prompt.opened, 1, 'repeated Back must reuse the existing decision');
    assert.equal(prompt.closed, 1);
    assert.deepEqual(history.commits, [], 'intermediate URLs must never become accepted documents');
  });

  await test(`two Back events queued before the first restoration converge with ${adapter}`, async () => {
    const history = new HistoryHarness(['/', first, second], fallback), prompt = new LeavePrompt();
    history.controller.registerGuard(prompt);
    history.back(); history.back(); history.deliver(); history.deliver();
    assert.equal(prompt.opened, 0);
    await history.drain();
    history.assertAt(second);
    assert.equal(prompt.opened, 1);
    prompt.decide(true); await flush(); await history.drain();
    history.assertAt(first);
    assert.equal(prompt.closed, 1);
  });
}

await test('a toolbar leave followed by Back waits for restoration before pushing a new entry', async () => {
  const history = new HistoryHarness(['/', first, second]), prompt = new LeavePrompt();
  history.controller.registerGuard(prompt);
  let completed = false;
  const go = history.controller.go(third).then(() => { completed = true; });
  assert.equal(prompt.opened, 1);
  history.back(); history.deliver();
  prompt.decide(true); await flush();
  assert.equal(completed, false);
  assert.equal(prompt.closed, 0);
  assert.equal(history.entries.length, 3);
  await history.drain(); await go;
  history.assertAt(third);
  assert.deepEqual(history.entries.map(entry => entry.index), [0, 1, 2, 3]);
  assert.equal(prompt.closed, 1);
});

await test('Kompas and Fusion for one local document bypass the guard and update history normally', async () => {
  const history = new HistoryHarness(['/', first]), prompt = new LeavePrompt();
  history.controller.registerGuard(prompt);
  await history.controller.go('/cad/fusion/first');
  history.assertAt('/cad/fusion/first');
  history.back(); history.deliver();
  history.assertAt(first);
  assert.equal(prompt.opened, 0);
  assert.equal(history.moves, 0);
  const leaving = history.controller.go('/');
  assert.equal(prompt.opened, 1, 'a different document still requires the guard');
  prompt.decide(false); await leaving;
  history.assertAt(first);
});

await test('a save completing during initial restoration avoids an unnecessary confirmation', async () => {
  const history = new HistoryHarness(['/', first]), prompt = new LeavePrompt();
  history.controller.registerGuard(prompt);
  history.back(); history.deliver(); prompt.dirty = false;
  await history.drain();
  history.assertAt('/');
  assert.equal(prompt.opened, 0);
});

await test('rejected leave, duplicate go and disposal cannot replay a stale approval', async () => {
  const history = new HistoryHarness(['/', first]), prompt = new LeavePrompt();
  history.controller.registerGuard(prompt);
  const rejected = history.controller.go('/');
  await history.controller.go(third);
  assert.equal(prompt.opened, 1);
  prompt.reject(new Error('save failed')); await rejected;
  history.assertAt(first);
  const disposed = history.controller.go('/');
  history.controller.dispose(); prompt.decide(true);
  await disposed; await flush();
  history.assertAt(first);
  assert.equal(history.queue.length, 0);
});
