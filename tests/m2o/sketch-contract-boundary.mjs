import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sketchContract = readFileSync('src/contracts/sketch.ts', 'utf8');
const documentContract = readFileSync('src/contracts/document.ts', 'utf8');
const solverContract = readFileSync('src/contracts/sketchSolver.ts', 'utf8');
const solver = readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');
const handlers = readFileSync('src/application/commands/SketchCommandHandlers.ts', 'utf8');

assert.match(sketchContract, /type CadSketchEntity = CadSketchLineEntity \| CadSketchCircleEntity \| CadSketchArcEntity/, 'Sketch entities must be a discriminated union');
assert.match(sketchContract, /support: CadSketchSupport/, 'Sketch support must not degrade to arbitrary string');
assert.match(sketchContract, /type CadConstraint =/, 'Sketch constraints must be a discriminated union');
assert.match(sketchContract, /type CadDimension =/, 'Sketch dimensions must be a discriminated union');
assert.match(sketchContract, /validateCadPartSketchCollections/, 'Sketch DTO runtime validator must exist');
assert.match(documentContract, /validateCadPartSketchCollections\(value\)/, 'CadDocument parser must validate Part Sketch DTOs');
assert.doesNotMatch(documentContract, /interface CadSketchEntity[\s\S]*type: string;[\s\S]*Record<string, unknown>/, 'legacy permissive Sketch entity contract must not return');
assert.doesNotMatch(documentContract, /interface CadConstraint[\s\S]*type: string;/, 'legacy permissive constraint contract must not return');
assert.doesNotMatch(documentContract, /interface CadDimension[\s\S]*type: string;/, 'legacy permissive dimension contract must not return');
assert.match(solverContract, /type CadSolvedSketchEntity = CadSketchEntity/, 'Solved entities must retain their discriminant');

assert.doesNotMatch(solver, /function point2\(/, 'PlaneGCS adapter must not parse typed entity coordinates as unknown');
assert.doesNotMatch(solver, /function number\(/, 'PlaneGCS adapter must not parse typed numeric entity fields as unknown');
assert.doesNotMatch(solver, /as StoredPointRef/, 'PlaneGCS adapter must consume typed constraint refs directly');
assert.match(solver, /switch \(entity.type\)/, 'PlaneGCS geometry conversion must narrow on entity discriminants');
assert.match(solver, /case 'coincident':/, 'PlaneGCS typed constraint boundary must retain current coincident support');
assert.match(solver, /case 'diameter':/, 'PlaneGCS typed dimension boundary must retain current diameter support');

assert.doesNotMatch(handlers, /function addConstraint\([\s\S]*type: string/, 'Sketch handlers must not construct arbitrary string-typed constraints');
assert.doesNotMatch(handlers, /data\?: Record<string, unknown>/, 'Sketch handlers must not construct arbitrary constraint payload maps');
assert.match(handlers, /const dimension: CadDimension =/, 'Sketch handlers must construct typed dimension DTOs');
assert.match(handlers, /const constraint: CadConstraint =/, 'Sketch handlers must construct typed constraint DTOs');
assert.doesNotMatch(handlers, /support: String\(command\.payload\.support\)/, 'Sketch support must retain its typed command value');

console.log('M2O O7 Sketch contract boundary PASS (typed DTOs + typed PlaneGCS/handler consumption)');
