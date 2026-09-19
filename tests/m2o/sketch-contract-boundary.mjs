import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sketchContract = readFileSync('src/contracts/sketch.ts', 'utf8');
const dimensionContract = readFileSync('src/contracts/sketchDimensions.ts', 'utf8');
const validationContract = readFileSync('src/contracts/contractValidation.ts', 'utf8');
const contractsIndex = readFileSync('src/contracts/index.ts', 'utf8');
const documentContract = readFileSync('src/contracts/document.ts', 'utf8');
const commandsContract = readFileSync('src/contracts/commands.ts', 'utf8');
const commandRegistry = JSON.parse(readFileSync('spec/ui/command-registry.v1.json', 'utf8'));
const solverContract = readFileSync('src/contracts/sketchSolver.ts', 'utf8');
const solver = readFileSync('src/runtime/PlaneGCSSketchSolverRuntime.ts', 'utf8');
const geometryHandlers = readFileSync('src/application/commands/SketchGeometryCommandHandlers.ts', 'utf8');
const constraintHandlers = readFileSync('src/application/commands/SketchConstraintCommandHandlers.ts', 'utf8');
const dimensionHandlers = readFileSync('src/application/commands/SketchDimensionCommandHandlers.ts', 'utf8');

assert.match(sketchContract, /type CadSketchEntity = CadSketchLineEntity \| CadSketchCircleEntity \| CadSketchArcEntity/, 'Sketch entities must be a discriminated union');
assert.match(sketchContract, /support: CadSketchSupport/, 'Sketch support must not degrade to arbitrary string');
assert.match(sketchContract, /type CadConstraint =/, 'Sketch constraints must be a discriminated union');
assert.match(
  dimensionContract,
  /type CadDimension =[\s\S]*CadLinearDimension[\s\S]*CadHorizontalDimension[\s\S]*CadVerticalDimension[\s\S]*CadDiameterDimension[\s\S]*CadRadiusDimension/,
  'Sketch dimensions must be a discriminated union owned by sketchDimensions.ts',
);
assert.match(dimensionContract, /export function validateCadDimension/, 'Dimension owner must own runtime validation');
assert.match(sketchContract, /validateCadDimension/, 'Sketch collection validation must delegate dimensions to the dimension owner');
assert.match(sketchContract, /CadHorizontalDimension/, 'Sketch contract must re-export Horizontal Dimension publicly');
assert.match(sketchContract, /CadVerticalDimension/, 'Sketch contract must re-export Vertical Dimension publicly');
assert.match(sketchContract, /CadRadiusDimension/, 'Sketch contract must re-export Radius Dimension publicly');
assert.match(sketchContract, /CadAngularDimension/, 'Sketch contract must re-export Angular Dimension publicly');
assert.match(documentContract, /CadHorizontalDimension/, 'CadDocument public contract must re-export Horizontal Dimension');
assert.match(documentContract, /CadVerticalDimension/, 'CadDocument public contract must re-export Vertical Dimension');
assert.match(documentContract, /CadRadiusDimension/, 'CadDocument public contract must re-export Radius Dimension');
assert.match(documentContract, /CadAngularDimension/, 'CadDocument public contract must re-export Angular Dimension');
assert.doesNotMatch(sketchContract, /interface CadDimensionBase/, 'Dimension DTO definitions must not return to sketch.ts');
assert.doesNotMatch(sketchContract, /function validateDimension\(/, 'Dimension runtime validation must not return to sketch.ts');
assert.match(validationContract, /export function expectRecord/, 'Shared contract validation must own record validation');
assert.match(validationContract, /export function expectPositiveFinite/, 'Shared contract validation must own positive finite validation');
assert.doesNotMatch(contractsIndex, /contractValidation/, 'Internal validation helpers must not become public contract exports');
assert.match(sketchContract, /validateCadPartSketchCollections/, 'Sketch DTO runtime validator must exist');
assert.match(documentContract, /validateCadPartSketchCollections\(value\)/, 'CadDocument parser must validate Part Sketch DTOs');
assert.doesNotMatch(documentContract, /interface CadSketchEntity[\s\S]*type: string;[\s\S]*Record<string, unknown>/, 'legacy permissive Sketch entity contract must not return');
assert.doesNotMatch(documentContract, /interface CadConstraint[\s\S]*type: string;/, 'legacy permissive constraint contract must not return');
assert.doesNotMatch(documentContract, /interface CadDimension[\s\S]*type: string;/, 'legacy permissive dimension contract must not return');
assert.doesNotMatch(dimensionContract, /type:\s*string/, 'dimension owner must not permit arbitrary string dimension discriminants');
assert.match(commandsContract, /'dimension\.horizontal'/, 'Typed command contract must own dimension.horizontal');
assert.match(commandsContract, /'dimension\.vertical'/, 'Typed command contract must own dimension.vertical');
assert.match(commandsContract, /'dimension\.radius'/, 'Typed command contract must own dimension.radius');
assert.match(commandsContract, /'dimension\.angular'/, 'Typed command contract must own dimension.angular');
assert.match(commandsContract, /'dimension\.horizontal':[\s\S]*entityId: CadSketchEntityId;[\s\S]*value: number;/, 'Horizontal payload must use one typed entityId and numeric value');
assert.match(commandsContract, /'dimension\.vertical':[\s\S]*entityId: CadSketchEntityId;[\s\S]*value: number;/, 'Vertical payload must use one typed entityId and numeric value');
assert.match(commandsContract, /'dimension\.radius':[\s\S]*entityId: CadSketchEntityId;[\s\S]*value: number;/, 'Radius payload must use one typed entityId and numeric value');
assert.match(commandsContract, /'dimension\.angular':[\s\S]*aEntityId: CadSketchEntityId;[\s\S]*bEntityId: CadSketchEntityId;[\s\S]*value: number;/, 'Angular payload must use two ordered typed Line ids and degree value');
assert.match(solverContract, /type CadSolvedSketchEntity = CadSketchEntity/, 'Solved entities must retain their discriminant');

assert.doesNotMatch(solver, /function point2\(/, 'PlaneGCS adapter must not parse typed entity coordinates as unknown');
assert.doesNotMatch(solver, /function number\(/, 'PlaneGCS adapter must not parse typed numeric entity fields as unknown');
assert.doesNotMatch(solver, /as StoredPointRef/, 'PlaneGCS adapter must consume typed constraint refs directly');
assert.match(solver, /switch \(entity.type\)/, 'PlaneGCS geometry conversion must narrow on entity discriminants');
assert.match(solver, /case 'coincident':/, 'PlaneGCS typed constraint boundary must retain current coincident support');
assert.match(solver, /case 'linear':/, 'PlaneGCS typed dimension boundary must retain current linear support');
assert.match(solver, /type: dimension\.type === 'horizontal' \? 'DISTANCE_X' : 'DISTANCE_Y'/, 'Directional dimensions must map to PlaneGCS DISTANCE_X / DISTANCE_Y');
assert.match(solver, /const axis = dimension\.type === 'horizontal' \? 0 : 1/, 'Directional ordering must use persisted X/Y seed geometry');
assert.match(solver, /const refs: SketchRef\[\] = fromValue <= toValue/, 'Directional refs must use lower coordinate first and stable a→b tie ordering');
assert.match(solver, /case 'diameter':/, 'PlaneGCS typed dimension boundary must retain current diameter support');
assert.match(solver, /case 'radius':[\s\S]*type: 'RADIUS'[\s\S]*value: dimension\.value,/, 'Radius must map directly to PlaneGCS RADIUS without Diameter halving');
assert.match(solver, /case 'angular':[\s\S]*type: 'ANGLE'[\s\S]*value: dimension\.value,/, 'Angular must map directly to PlaneGCS ANGLE in persisted degrees');
assert.doesNotMatch(solver, /case 'angular':[\s\S]*Math\.PI\s*\/\s*180/, 'ASA Angular mapping must not convert degrees to radians');

assert.doesNotMatch(constraintHandlers, /function addConstraint\([\s\S]*type: string/, 'Constraint owner must not construct arbitrary string-typed constraints');
assert.doesNotMatch(constraintHandlers, /data\?: Record<string, unknown>/, 'Constraint owner must not construct arbitrary payload maps');
assert.match(constraintHandlers, /constraint: CadConstraint/, 'Constraint owner must construct typed constraint DTOs');
assert.match(dimensionHandlers, /const dimension: CadDimension =/, 'Dimension owner must construct typed dimension DTOs');
assert.match(dimensionHandlers, /'dimension\.horizontal'/, 'Focused dimension owner must contain dimension.horizontal');
assert.match(dimensionHandlers, /'dimension\.vertical'/, 'Focused dimension owner must contain dimension.vertical');
assert.match(dimensionHandlers, /'dimension\.radius'/, 'Focused dimension owner must contain dimension.radius');
assert.match(dimensionHandlers, /'dimension\.angular'/, 'Focused dimension owner must contain dimension.angular');
assert.doesNotMatch(geometryHandlers, /support: String\(command\.payload\.support\)/, 'Geometry owner must retain typed Sketch support');

for (const id of ['dimension.horizontal', 'dimension.vertical']) {
  const entry = commandRegistry.commands.find((command) => command.id === id);
  assert.ok(entry, `Command registry must retain ${id}`);
  assert.equal(entry.status, 'implemented', `${id} must remain implemented after M3-DIM-001B productization`);
}
const radiusRegistry = commandRegistry.commands.find((command) => command.id === 'dimension.radius');
assert.ok(radiusRegistry, 'Command registry must retain dimension.radius');
assert.equal(radiusRegistry.status, 'implemented', 'Radius registry must match the productized Circle/Arc path');
const angularRegistry = commandRegistry.commands.find((command) => command.id === 'dimension.angular');
assert.ok(angularRegistry, 'Command registry must retain dimension.angular');
assert.equal(angularRegistry.status, 'implemented', 'Angular registry must match the productized Line-pair path');

console.log('M2O O7 Sketch contract boundary PASS (typed DTOs + typed PlaneGCS/focused handler consumption)');
