import React, { useEffect, useReducer } from 'react';
import { createRoot } from 'react-dom/client';
import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { createEmptyCadDocument, parseCadDocument, serializeCadDocument } from '../../src/contracts/document';
import { useSketchArcTool } from '../../src/web/useSketchArcTool';
let app, root, sketchId, tool, initial, mounted = false, renders = 0, gate;
let pending = [], returned = [], errors = [], notices = [], commands = [], accepted = 0, commits = 0;
let failNext = false, fault = null;
function state() {
  return { mounted, renders, accepted, commits, returned: [...returned], errors: [...errors],
    notices: [...notices], commands: structuredClone(commands),
    draft: structuredClone(tool?.draft), committing: tool?.committing,
    input: tool ? { phase: tool.input.phase, fields: structuredClone(tool.input.fields),
      error: tool.input.error, canCommit: tool.input.canCommit } : null,
    fault: structuredClone(fault),
    dto: app ? serializeCadDocument(app.getDocument()) : null,
    application: app ? structuredClone(app.getState()) : null };
}
function Harness() {
  const [, update] = useReducer(x => x + 1, 0);
  useEffect(() => app.subscribe(update), []);
  tool = useSketchArcTool({ app, sketchId, active: true,
    setNotice: text => notices.push(text), onCommitted: () => commits++ });
  useEffect(() => { mounted = true; return () => { mounted = false; }; }, []);
  useEffect(() => { renders++; });
  return React.createElement('output', { id: 'hook' }, 'Actual useSketchArcTool');
}
async function close() {
  gate?.resolve(); gate = undefined; await Promise.all(pending);
  root?.unmount(); root = undefined; app?.dispose();
  return { mounted, pendingSettled: returned.every(x => x !== null) };
}
async function setup() {
  await close();
  app = new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Arc ownership fixture' }), {
    async recompute(doc) {
      if (doc.kind !== 'part' || doc.features.length) throw Error('Unexpected B-Rep in Sketch-only fixture');
      return { ok: true, diagnostics: [], runtimeRevision: 'arc-ownership-fixture' };
    },
    async captureReference() { throw Error('Topology is outside this fixture'); }, dispose() {},
  });
  const result = await app.execute({ id: 'sketch.create', payload: { support: 'XY' } });
  if (!result.ok) throw Error('Sketch setup failed'); sketchId = result.createdIds[0];
  await app.replaceDocument(parseCadDocument(serializeCadDocument(app.getDocument())));
  initial = serializeCadDocument(app.getDocument());
  pending = []; returned = []; errors = []; notices = []; commands = []; accepted = 0; commits = 0; renders = 0;
  failNext = false; fault = null;
  const execute = app.execute.bind(app);
  app.execute = command => {
    commands.push(structuredClone(command));
    const before = app.getDocument();
    const injected = failNext && command.id === 'sketch.arc'; failNext = false;
    const submitted = injected ? { ...command, payload: { ...command.payload, sketchId: 'missing-sketch' } } : command;
    const actual = execute(submitted), held = gate;
    if (injected) {
      fault = { kind: 'injected invalid sketchId into actual app.execute',
        rollbackCloneObserved: app.getDocument() !== before, error: null };
      return actual.then(result => { fault.error = result.error?.message; return result; });
    }
    if (command.id !== 'sketch.arc' || !held) return actual;
    return actual.then(async result => { accepted++; await held.promise; return result; });
  };
  root = createRoot(document.getElementById('root')); root.render(React.createElement(Harness));
  return initial;
}
function hold() {
  if (gate) throw Error('Already held');
  let resolve; const promise = new Promise(done => { resolve = done; }); gate = { promise, resolve };
}
function begin(n = 1) {
  for (let i = 0; i < n; i++) {
    const index = returned.length; returned.push(null);
    pending.push(tool.commitPreview().then(value => { returned[index] = value; }, error => errors.push(String(error))));
  }
}
async function change(kind) {
  const before = renders;
  if (kind === 'undo') {
    const result = await app.undo(); if (!result.ok) throw Error('Actual Undo failed');
  } else {
    const next = parseCadDocument(initial); next.title = 'Replacement with identical document and Sketch IDs';
    await app.replaceDocument(next);
  }
  return before;
}
async function preSubmit(kind) {
  let replacement;
  if (kind === 'replace') {
    const next = parseCadDocument(initial); next.title = 'Same-ID replacement before submit';
    // No await: commit is attempted before a React effect can handle replacement.
    replacement = app.replaceDocument(next);
  } else {
    // Intentional test fault: mutate relevant live DTO without emitting application state.
    app.getDocument().sketches[0].name = 'In-place intent mutation without emit';
  }
  const expected = serializeCadDocument(app.getDocument());
  begin(); await Promise.all([replacement, ...pending]);
  return { expected, state: state() };
}
function unmount() { root?.unmount(); root = undefined; }
globalThis.arcOwnership = { state, setup, hold, begin, change,
  preSubmit, unmount, reset: () => tool.reset(), failNext: () => { failNext = true; },
  edit: (field, text) => tool.input.change(field, text), enter: field => tool.input.enter(field),
  point: p => tool.point(p), move: p => tool.move(p),
  async release() { gate?.resolve(); gate = undefined; await Promise.all(pending); return state(); },
  close };
