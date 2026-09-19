import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const application = readFileSync('src/application/CadApplicationImpl.ts', 'utf8');
const facade = readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');
const shared = readFileSync('src/application/commands/SketchCommandHandlerShared.ts', 'utf8');
const geometry = readFileSync('src/application/commands/SketchGeometryCommandHandlers.ts', 'utf8');
const edit = readFileSync('src/application/commands/SketchEditCommandHandlers.ts', 'utf8');
const constraints = readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const linePairs = readFileSync('src/application/commands/SketchLinePairConstraintOwner.ts', 'utf8');
const dimensions = readFileSync('src/application/commands/SketchDimensionCommandHandlers.ts', 'utf8');

assert.match(application, /isSketchGrowthCommandId\(id\)/, 'availability must delegate M3-growth commands to the handler registry');
assert.match(application, /applySketchGrowthCommand\(part, command\)/, 'execution must delegate M3-growth commands to the handler registry');
assert.match(application, /private undoStack:/, 'undo history must remain centralized in CadApplicationImpl');
assert.match(application, /private redoStack:/, 'redo history must remain centralized in CadApplicationImpl');
assert.match(application, /const before = cloneDocument\(this\.document\)/, 'application must snapshot before handler execution');
assert.match(application, /this\.document = before/, 'application must restore the snapshot on handler failure');

for (const legacyCase of [
  "case 'sketch.create':", "case 'sketch.line':", "case 'sketch.rectangle':", "case 'sketch.circle':", "case 'sketch.arc':",
  "case 'sketch.entity.delete':", "case 'sketch.entity.translate':", "case 'sketch.finish':",
  "case 'constraint.coincident':", "case 'constraint.horizontal':", "case 'constraint.vertical':", "case 'constraint.parallel':", "case 'constraint.perpendicular':", "case 'constraint.fixed':",
  "case 'dimension.linear':", "case 'dimension.horizontal':", "case 'dimension.vertical':", "case 'dimension.diameter':", "case 'dimension.radius':", "case 'part.dimension.setValue':",
]) {
  assert.equal(application.includes(legacyCase), false, `M3 growth handler must not return to central application switch: ${legacyCase}`);
}

assert.match(facade, /SKETCH_GROWTH_COMMAND_IDS/, 'facade must publish the controlled command-id set');
for (const family of ['SKETCH_GEOMETRY_COMMAND_IDS', 'SKETCH_EDIT_COMMAND_IDS', 'SKETCH_CONSTRAINT_COMMAND_IDS', 'SKETCH_DIMENSION_COMMAND_IDS']) {
  assert.ok(facade.includes(family), `Sketch facade must compose ${family}`);
}

const families = [
  { name: 'geometry', source: geometry, ids: ['sketch.create', 'sketch.line', 'sketch.rectangle', 'sketch.circle', 'sketch.arc'] },
  { name: 'edit', source: edit, ids: ['sketch.entity.delete', 'sketch.entity.translate', 'sketch.finish'] },
  { name: 'constraint', source: constraints, ids: ['constraint.coincident', 'constraint.horizontal', 'constraint.vertical', 'constraint.parallel', 'constraint.perpendicular', 'constraint.fixed'] },
  { name: 'dimension', source: dimensions, ids: ['dimension.linear', 'dimension.horizontal', 'dimension.vertical', 'dimension.diameter', 'dimension.radius', 'part.dimension.setValue'] },
];

for (const family of families) {
  assert.match(family.source, /satisfies SketchCommandHandlerMap</, `${family.name} owner must use the typed handler map`);
  for (const id of family.ids) assert.ok(family.source.includes(`'${id}'`), `${family.name} owner is missing ${id}`);
  const foreignIds = families.filter((other) => other !== family).flatMap((other) => other.ids);
  for (const id of foreignIds) assert.equal(family.source.includes(`'${id}'`), false, `${family.name} owner must not absorb foreign command family ${id}`);
}

assert.match(shared, /requireSketch\(/, 'shared handler contract owns common sketch lookup');
assert.match(shared, /requireSketchEntity\(/, 'shared handler contract owns common entity lookup');
assert.match(constraints, /SketchLinePairConstraintOwner/, 'constraint handler map must delegate Line-pair semantics');
assert.match(linePairs, /addLinePairConstraint/, 'focused Line-pair owner must own pair mutation');
assert.match(linePairs, /sameUnorderedEntityPair/, 'focused Line-pair owner must own symmetric duplicate semantics');

const handlerSources = [facade, shared, geometry, edit, constraints, linePairs, dimensions];
for (const forbidden of ['../runtime/', '../browser/', '../host/', 'vendor/', 'opencascade', 'TopoDS', 'undoStack', 'redoStack']) {
  for (const source of handlerSources) assert.equal(source.includes(forbidden), false, `Sketch command owners must not own runtime/history/vendor concerns: ${forbidden}`);
}

console.log('M2O O6 application handler architecture PASS (focused geometry/edit/constraint/Line-pair/dimension owners + centralized history/rollback)');
