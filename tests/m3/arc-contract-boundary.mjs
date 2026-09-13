import assert from 'node:assert/strict';
import fs from 'node:fs';

const sketch = fs.readFileSync('src/contracts/sketch.ts', 'utf8');
const commands = fs.readFileSync('src/contracts/commands.ts', 'utf8');
const handlers = fs.readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');
const solver = fs.readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');
const registry = JSON.parse(fs.readFileSync('spec/ui/command-registry.v1.json', 'utf8'));

assert.match(sketch, /interface CadSketchArcData/, 'ASA contracts must own persisted Arc data');
assert.match(sketch, /type: 'arc'/, 'Arc must be a discriminated Sketch entity');
assert.match(sketch, /startAngle/, 'Arc must persist a canonical start angle');
assert.match(sketch, /endAngle/, 'Arc must persist a canonical end angle');
assert.match(sketch, /sweep must be greater than 0 and less than 2π/, 'Arc validator must reject zero/full-turn sweeps');

assert.match(commands, /\| 'sketch\.arc'/, 'CadCommandId must contain sketch.arc');
assert.match(commands, /'sketch\.arc': \{/, 'CadCommandMap must contain a typed sketch.arc payload');
assert.match(commands, /center: readonly \[number, number\]/, 'Arc command must use a strict 2D center tuple without circular contract imports');
assert.match(commands, /start: readonly \[number, number\]/, 'Arc command must define one initial center-start-end construction mode');
assert.match(commands, /end: readonly \[number, number\]/, 'Arc command must define one initial center-start-end construction mode');

assert.match(handlers, /'sketch\.arc'/, 'Arc command must use focused Sketch handler dispatch');
assert.match(handlers, /type: 'arc'/, 'Arc handler must persist the canonical ASA Arc entity');
assert.match(handlers, /normalizeAngle/, 'Arc canonicalization belongs to the application boundary, not UI');
assert.match(handlers, /positiveSweep/, 'Arc handler must canonicalize a positive CCW sweep');

assert.match(solver, /case 'arc'/, 'PlaneGCS ASA adapter must map typed Arc DTOs');
assert.match(solver, /kind: 'arc'/, 'PlaneGCS geometry seam must use vendor Arc geometry only behind ASA runtime boundary');
assert.match(solver, /\bstartAngle,/, 'solver readback must retain canonical solved Arc start angle');
assert.match(solver, /endAngle: startAngle \+ sweep/, 'solver readback must retain canonical solved Arc sweep');

const arc = registry.commands.find((command) => command.id === 'sketch.arc');
assert.ok(arc, 'command registry must contain sketch.arc');
assert.equal(arc.status, 'implemented', 'Arc may be implemented only together with direct product UI/browser acceptance');
assert.equal(arc.backendCommand, 'sketch.arc', 'implemented Arc must remain wired to the typed backend command');

console.log('ASA-CAD M3.4 Arc contract boundary PASS (ASA DTO/command/handler/PlaneGCS + direct product acceptance)');
