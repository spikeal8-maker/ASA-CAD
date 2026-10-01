import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  createEmptyCadDocument,
  drawingLineLength,
  parseCadDocument,
  serializeCadDocument,
  type CadDraftEntityId,
  type CadDrawingDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
} from '../../src';

class NoopRuntime implements CadRuntimeAdapter {
  recomputeCount = 0;
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    this.recomputeCount += 1;
    return { ok: true, diagnostics: [], runtimeRevision: `drawing-r1-${this.recomputeCount}` };
  }
  async captureReference(): Promise<never> { throw new Error('Drawing R1 does not capture B-Rep references'); }
  dispose(): void {}
}

const runtime = new NoopRuntime();
const app = new CadApplicationImpl(createEmptyCadDocument('drawing', { title: 'Чертеж 1' }), runtime);

function drawing(): Readonly<CadDrawingDocument> {
  const document = app.getDocument();
  assert.equal(document.kind, 'drawing');
  if (document.kind !== 'drawing') throw new Error('Expected Drawing');
  return document;
}

const initial = drawing();
assert.equal(initial.units, 'mm');
assert.equal(initial.sheets.length, 1);
const sheet = initial.sheets[0];
assert.equal(sheet.format, 'A4');
assert.equal(sheet.orientation, 'landscape');
assert.deepEqual([sheet.width, sheet.height], [297, 210]);
assert.equal(sheet.layers.length, 1);
assert.equal(sheet.activeLayerId, sheet.layers[0].id);
assert.equal(initial.sheets[0].entities.length, 0);
assert.equal(runtime.recomputeCount, 0, 'Drawing construction must not require the B-Rep runtime');

const created = await app.execute({
  id: 'drawing.line.create',
  payload: {
    sheetId: sheet.id,
    from: [20, 20],
    to: [70, 20],
  },
});
assert.equal(created.ok, true);
assert.equal(created.createdIds?.length, 1);
const lineId = created.createdIds?.[0] as CadDraftEntityId;
assert.ok(lineId);
assert.equal(drawing().sheets[0].entities.length, 1);
let line = drawing().sheets[0].entities[0];
assert.equal(line.id, lineId);
assert.equal(drawingLineLength(line), 50);
assert.equal(app.getState().canUndo, true);

const updated = await app.execute({
  id: 'drawing.line.update',
  payload: { sheetId: sheet.id, entityId: lineId, from: [20, 20], to: [90, 20] },
});
assert.equal(updated.ok, true);
line = drawing().sheets[0].entities[0];
assert.equal(line.id, lineId, 'geometry edit must preserve Drawing entity ID');
assert.equal(drawingLineLength(line), 70);

assert.equal((await app.undo()).ok, true);
line = drawing().sheets[0].entities[0];
assert.equal(line.id, lineId);
assert.equal(drawingLineLength(line), 50, 'one Undo must revert one update command');
assert.equal((await app.redo()).ok, true);
line = drawing().sheets[0].entities[0];
assert.equal(line.id, lineId);
assert.equal(drawingLineLength(line), 70);

const deleted = await app.execute({
  id: 'drawing.entity.delete',
  payload: { sheetId: sheet.id, entityId: lineId },
});
assert.equal(deleted.ok, true);
assert.equal(drawing().sheets[0].entities.length, 0);
assert.equal((await app.undo()).ok, true);
assert.equal(drawing().sheets[0].entities[0].id, lineId, 'Undo Delete must restore the same ID');
assert.equal(drawingLineLength(drawing().sheets[0].entities[0]), 70);

const beforeInvalid = serializeCadDocument(drawing());
const invalid = await app.execute({
  id: 'drawing.line.update',
  payload: { sheetId: sheet.id, entityId: lineId, from: [30, 30], to: [30, 30] },
});
assert.equal(invalid.ok, false);
assert.equal(serializeCadDocument(drawing()), beforeInvalid, 'invalid edit must not mutate Drawing');

const saved = serializeCadDocument(drawing());
const reopened = parseCadDocument(saved);
await app.replaceDocument(reopened);
assert.equal(runtime.recomputeCount > 0, true);
assert.equal(app.getState().canUndo, false);
assert.equal(drawing().sheets[0].entities[0].id, lineId);
assert.equal(drawingLineLength(drawing().sheets[0].entities[0]), 70);

const slopeEdit = await app.execute({
  id: 'drawing.line.update',
  payload: { sheetId: drawing().sheets[0].id, entityId: lineId, from: [10, 15], to: [58, 51] },
});
assert.equal(slopeEdit.ok, true);
line = drawing().sheets[0].entities[0];
assert.equal(line.id, lineId);
assert.deepEqual(line.from, [10, 15]);
assert.deepEqual(line.to, [58, 51]);
assert.equal(drawingLineLength(line), 60);

console.log('ASA-CAD R1 Drawing application PASS (A4 + Line 50→70 + Undo/Redo/Delete + Save/Open + stable ID)');
