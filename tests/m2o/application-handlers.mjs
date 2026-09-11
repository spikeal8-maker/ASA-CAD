import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const application = readFileSync('src/application/CadApplicationImpl.ts', 'utf8');
const handlers = readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');

assert.match(application, /isSketchGrowthCommandId\(id\)/, 'availability must delegate M3-growth commands to the handler registry');
assert.match(application, /applySketchGrowthCommand\(part, command\)/, 'execution must delegate M3-growth commands to the handler registry');
assert.match(application, /private undoStack:/, 'undo history must remain centralized in CadApplicationImpl');
assert.match(application, /private redoStack:/, 'redo history must remain centralized in CadApplicationImpl');
assert.match(application, /const before = cloneDocument\(this\.document\)/, 'application must snapshot before handler execution');
assert.match(application, /this\.document = before/, 'application must restore the snapshot on handler failure');

for (const legacyCase of [
  "case 'sketch.create':",
  "case 'sketch.line':",
  "case 'sketch.rectangle':",
  "case 'sketch.circle':",
  "case 'sketch.finish':",
  "case 'constraint.coincident':",
  "case 'constraint.horizontal':",
  "case 'constraint.vertical':",
  "case 'constraint.fixed':",
  "case 'dimension.linear':",
  "case 'dimension.diameter':",
  "case 'part.dimension.setValue':",
]) {
  assert.equal(application.includes(legacyCase), false, `M3 growth handler must not return to central switch: ${legacyCase}`);
}

assert.match(handlers, /SKETCH_GROWTH_COMMAND_IDS/, 'handler module must publish its controlled command-id set');
assert.match(handlers, /satisfies SketchGrowthHandlerRegistry/, 'handler map must be checked against the typed registry');
for (const id of [
  'sketch.create',
  'sketch.line',
  'sketch.rectangle',
  'sketch.circle',
  'sketch.finish',
  'constraint.coincident',
  'constraint.horizontal',
  'constraint.vertical',
  'constraint.fixed',
  'dimension.linear',
  'dimension.diameter',
  'part.dimension.setValue',
]) {
  assert.ok(handlers.includes(`'${id}'`), `handler registry is missing ${id}`);
}

for (const forbidden of [
  '../runtime/',
  '../browser/',
  '../host/',
  'vendor/',
  'opencascade',
  'TopoDS',
  'undoStack',
  'redoStack',
]) {
  assert.equal(handlers.includes(forbidden), false, `Sketch handler registry must not own runtime/history/vendor concerns: ${forbidden}`);
}

console.log('M2O O6 application handler architecture PASS (focused typed registry + centralized history/rollback)');
