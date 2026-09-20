import assert from 'node:assert/strict';
import {
  CadApplicationImpl,
  PlaneGCSSketchSolverRuntime,
  SketchSolveSession,
  createEmptyCadDocument,
  type CadRuntimeAdapter,
  type CadRuntimeRecomputeResult,
  type CadRuntimeReferenceCaptureResult,
  type CadConstraintId,
  type CadDimensionId,
  type CadSketchEntityId,
  type CadSketchId,
} from '../../src';

class NoopGeometryRuntime implements CadRuntimeAdapter {
  async recompute(): Promise<CadRuntimeRecomputeResult> {
    return { ok: true, diagnostics: [] };
  }

  async captureReference(): Promise<CadRuntimeReferenceCaptureResult> {
    throw new Error('not used by sketch solver test');
  }

  dispose(): void {}
}

async function assertPlaneGcsNativeDegreesOfFreedom() {
  const probeApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopGeometryRuntime());
  const sketchResult = await probeApp.execute({
    id: 'sketch.create',
    payload: { support: 'XY', name: 'DoF probe' },
  });
  const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
  assert.ok(sketchId);
  const lineResult = await probeApp.execute({
    id: 'sketch.line',
    payload: { sketchId, from: [0, 0], to: [30, 5] },
  });
  const lineId = lineResult.createdIds?.[0] as CadSketchEntityId;
  assert.ok(lineId);

  const solver = new PlaneGCSSketchSolverRuntime();
  await solver.init();
  const unconstrained = solver.solve(probeApp.getDocument(), sketchId);
  assert.equal(unconstrained.ok, true);
  assert.ok(
    unconstrained.degreesOfFreedom !== null && unconstrained.degreesOfFreedom > 0,
    `unconstrained Line must report solver-native DoF > 0, got ${unconstrained.degreesOfFreedom}`,
  );

  const stateSession = new SketchSolveSession(new PlaneGCSSketchSolverRuntime());
  const under = await stateSession.solve(probeApp.getDocument(), sketchId);
  assert.equal(under.constraintState, 'under-constrained');
  assert.ok(under.degreesOfFreedom !== null && under.degreesOfFreedom > 0);

  const redundantDocument = structuredClone(probeApp.getDocument());
  if (redundantDocument.kind !== 'part') throw new Error('Expected Part DoF probe');
  const redundantSketch = redundantDocument.sketches.find((item) => item.id === sketchId);
  assert.ok(redundantSketch);
  const redundantA = 'constraint_native_redundant_a' as CadConstraintId;
  const redundantB = 'constraint_native_redundant_b' as CadConstraintId;
  redundantDocument.constraints.push(
    { id: redundantA, type: 'horizontal', entityIds: [lineId] },
    { id: redundantB, type: 'horizontal', entityIds: [lineId] },
  );
  redundantSketch.constraintIds.push(redundantA, redundantB);
  const over = await stateSession.solve(redundantDocument, sketchId);
  assert.equal(over.status, 'solved', 'native redundancy may converge successfully');
  assert.equal(over.constraintState, 'over-constrained');
  assert.ok(
    over.diagnostics.some((diagnostic) => diagnostic.code === 'PLANEGCS_REDUNDANT_CONSTRAINTS'),
    'native PlaneGCS redundancy diagnostics must drive over-constrained state',
  );

  const conflictingDocument = structuredClone(probeApp.getDocument());
  if (conflictingDocument.kind !== 'part') throw new Error('Expected Part conflict probe');
  const conflictingSketch = conflictingDocument.sketches.find((item) => item.id === sketchId);
  assert.ok(conflictingSketch);
  const conflictA = 'dimension_native_conflict_a' as CadDimensionId;
  const conflictB = 'dimension_native_conflict_b' as CadDimensionId;
  conflictingDocument.dimensions.push(
    { id: conflictA, type: 'linear', entityIds: [lineId], value: 10, driving: true },
    { id: conflictB, type: 'linear', entityIds: [lineId], value: 20, driving: true },
  );
  conflictingSketch.dimensionIds.push(conflictA, conflictB);
  const conflicting = await stateSession.solve(conflictingDocument, sketchId);
  assert.equal(conflicting.status, 'error', 'native conflict must remain a failed solve');
  assert.equal(conflicting.constraintState, 'over-constrained');
  assert.ok(
    conflicting.diagnostics.some((diagnostic) => diagnostic.code === 'PLANEGCS_CONFLICTING_CONSTRAINTS'),
    'native PlaneGCS conflict diagnostics must drive over-constrained state',
  );

  assert.equal((await probeApp.execute({
    id: 'constraint.horizontal',
    payload: { sketchId, entityId: lineId },
  })).ok, true);
  const partiallyConstrained = solver.solve(probeApp.getDocument(), sketchId);
  assert.ok(
    partiallyConstrained.degreesOfFreedom !== null
      && partiallyConstrained.degreesOfFreedom > 0
      && partiallyConstrained.degreesOfFreedom < unconstrained.degreesOfFreedom,
    `Horizontal Line DoF must be between free and fixed, got ${partiallyConstrained.degreesOfFreedom}`,
  );

  const fixedApp = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopGeometryRuntime());
  const fixedSketchResult = await fixedApp.execute({
    id: 'sketch.create',
    payload: { support: 'XY', name: 'Fixed DoF probe' },
  });
  const fixedSketchId = fixedSketchResult.createdIds?.[0] as CadSketchId;
  assert.ok(fixedSketchId);
  const fixedLineResult = await fixedApp.execute({
    id: 'sketch.line',
    payload: { sketchId: fixedSketchId, from: [0, 0], to: [30, 5] },
  });
  const fixedLineId = fixedLineResult.createdIds?.[0] as CadSketchEntityId;
  assert.ok(fixedLineId);
  const beforeFixed = solver.solve(fixedApp.getDocument(), fixedSketchId);
  assert.equal(beforeFixed.ok, true);
  const solvedFixedLine = beforeFixed.entities.find((entity) => entity.id === fixedLineId);
  assert.ok(solvedFixedLine && solvedFixedLine.type === 'line');
  if (!solvedFixedLine || solvedFixedLine.type !== 'line') throw new Error('Expected solved Fixed probe Line');
  assert.equal((await fixedApp.execute({
    id: 'constraint.fixed',
    payload: {
      sketchId: fixedSketchId,
      entityId: fixedLineId,
      frozenGeometry: {
        type: 'line',
        from: solvedFixedLine.data.from,
        to: solvedFixedLine.data.to,
      },
    },
  })).ok, true);
  const fixed = solver.solve(fixedApp.getDocument(), fixedSketchId);
  assert.equal(fixed.ok, true);
  assert.equal(fixed.degreesOfFreedom, 0, 'Fixed Line must report solver-native DoF = 0');
  const fully = await stateSession.solve(fixedApp.getDocument(), fixedSketchId);
  assert.equal(fully.constraintState, 'fully-constrained');
  assert.equal(fully.degreesOfFreedom, 0);

  stateSession.dispose();
  solver.dispose();
  probeApp.dispose();
  fixedApp.dispose();
}

await assertPlaneGcsNativeDegreesOfFreedom();

const app = new CadApplicationImpl(createEmptyCadDocument('part'), new NoopGeometryRuntime());
const sketchResult = await app.execute({ id: 'sketch.create', payload: { support: 'XY', name: 'Solver test' } });
const sketchId = sketchResult.createdIds?.[0] as CadSketchId;
assert.ok(sketchId);

const lineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [0, 0], to: [30, 5] },
});
const lineId = lineResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(lineId);

const horizontal = await app.execute({
  id: 'constraint.horizontal',
  payload: { sketchId, entityId: lineId },
});
assert.equal(horizontal.ok, true);

const length = await app.execute({
  id: 'dimension.linear',
  payload: { sketchId, entityIds: [lineId], value: 40, name: 'solver-length' },
});
assert.equal(length.ok, true);

const circleResult = await app.execute({
  id: 'sketch.circle',
  payload: { sketchId, center: [50, 10], diameter: 8 },
});
const circleId = circleResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(circleId);

const diameter = await app.execute({
  id: 'dimension.diameter',
  payload: { sketchId, entityId: circleId, value: 10, name: 'solver-diameter' },
});
assert.equal(diameter.ok, true);

const radiusCircleResult = await app.execute({
  id: 'sketch.circle',
  payload: { sketchId, center: [70, 10], diameter: 16 },
});
const radiusCircleId = radiusCircleResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(radiusCircleId);
const circleRadiusDimension = await app.execute({
  id: 'dimension.radius',
  payload: { sketchId, entityId: radiusCircleId, value: 12, name: 'solver-circle-radius' },
});
assert.equal(circleRadiusDimension.ok, true);

const radiusArcResult = await app.execute({
  id: 'sketch.arc',
  payload: { sketchId, center: [100, 20], start: [110, 20], end: [100, 30] },
});
const radiusArcId = radiusArcResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(radiusArcId);
const arcRadiusDimension = await app.execute({
  id: 'dimension.radius',
  payload: { sketchId, entityId: radiusArcId, value: 15, name: 'solver-arc-radius' },
});
assert.equal(arcRadiusDimension.ok, true);
const arcRadiusDimensionId = arcRadiusDimension.createdIds?.[0] as CadDimensionId;
assert.ok(arcRadiusDimensionId);

const horizontalLineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [30, 15], to: [10, 5] },
});
const horizontalLineId = horizontalLineResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(horizontalLineId);
const horizontalDimension = await app.execute({
  id: 'dimension.horizontal',
  payload: { sketchId, entityId: horizontalLineId, value: 40, name: 'solver-horizontal' },
});
assert.equal(horizontalDimension.ok, true);
const horizontalDimensionId = horizontalDimension.createdIds?.[0] as CadDimensionId;
assert.ok(horizontalDimensionId);

const verticalLineResult = await app.execute({
  id: 'sketch.line',
  payload: { sketchId, from: [15, 35], to: [5, 10] },
});
const verticalLineId = verticalLineResult.createdIds?.[0] as CadSketchEntityId;
assert.ok(verticalLineId);
const verticalDimension = await app.execute({
  id: 'dimension.vertical',
  payload: { sketchId, entityId: verticalLineId, value: 30, name: 'solver-vertical' },
});
assert.equal(verticalDimension.ok, true);
const verticalDimensionId = verticalDimension.createdIds?.[0] as CadDimensionId;
assert.ok(verticalDimensionId);

const solver = new PlaneGCSSketchSolverRuntime();
await solver.init();

const invalidRadiusDocument = structuredClone(app.getDocument());
if (invalidRadiusDocument.kind !== 'part') throw new Error('Expected Part document');
const invalidRadiusDimensionId = 'dimension_radius_line_solver_probe' as CadDimensionId;
invalidRadiusDocument.dimensions.push({
  id: invalidRadiusDimensionId,
  type: 'radius',
  entityIds: [lineId],
  value: 5,
  driving: true,
});
const invalidRadiusSketch = invalidRadiusDocument.sketches.find((item) => item.id === sketchId);
assert.ok(invalidRadiusSketch);
invalidRadiusSketch.dimensionIds.push(invalidRadiusDimensionId);
const invalidRadiusSolve = solver.solve(invalidRadiusDocument, sketchId);
assert.equal(invalidRadiusSolve.ok, false);
assert.match(invalidRadiusSolve.diagnostics[0]?.message ?? '', /requires a Circle or Arc entity, got line/);

const result = solver.solve(app.getDocument(), sketchId);
assert.equal(result.ok, true, result.diagnostics.map((item) => item.message).join('; '));
assert.equal(result.converged, true);

const solvedLine = result.entities.find((entity) => entity.id === lineId);
assert.ok(solvedLine);
assert.equal(solvedLine.type, 'line');
if (solvedLine.type !== 'line') throw new Error('Expected solved line');
const from = solvedLine.data.from;
const to = solvedLine.data.to;
assert.ok(Array.isArray(from) && Array.isArray(to));
assert.ok(Math.abs(from[1] - to[1]) < 1e-5, `horizontal constraint failed: ${from[1]} vs ${to[1]}`);
assert.ok(Math.abs(Math.hypot(to[0] - from[0], to[1] - from[1]) - 40) < 1e-4, 'driving length was not solved to 40');

const solvedCircle = result.entities.find((entity) => entity.id === circleId);
assert.ok(solvedCircle);
assert.equal(solvedCircle.type, 'circle');
if (solvedCircle.type !== 'circle') throw new Error('Expected solved circle');
assert.ok(Math.abs(solvedCircle.data.diameter - 10) < 1e-5, 'driving diameter was not solved to 10');

const solvedRadiusCircle = result.entities.find((entity) => entity.id === radiusCircleId);
assert.ok(solvedRadiusCircle && solvedRadiusCircle.type === 'circle');
if (solvedRadiusCircle.type !== 'circle') throw new Error('Expected solved Radius circle');
assert.ok(Math.abs(solvedRadiusCircle.data.diameter - 24) < 1e-5, 'Radius 12 must solve Circle diameter to 24');

const solvedRadiusArc = result.entities.find((entity) => entity.id === radiusArcId);
assert.ok(solvedRadiusArc && solvedRadiusArc.type === 'arc');
if (solvedRadiusArc.type !== 'arc') throw new Error('Expected solved Radius arc');
assert.ok(Math.abs(solvedRadiusArc.data.radius - 15) < 1e-5, 'Radius dimension must solve Arc radius to 15');
assert.ok(solvedRadiusArc.data.startAngle >= 0 && solvedRadiusArc.data.startAngle < Math.PI * 2);
assert.ok(solvedRadiusArc.data.endAngle > solvedRadiusArc.data.startAngle);
assert.ok(solvedRadiusArc.data.endAngle - solvedRadiusArc.data.startAngle < Math.PI * 2);

const solvedHorizontalLine = result.entities.find((entity) => entity.id === horizontalLineId);
assert.ok(solvedHorizontalLine);
assert.equal(solvedHorizontalLine.type, 'line');
if (solvedHorizontalLine.type !== 'line') throw new Error('Expected solved horizontal-dimension line');
assert.ok(
  Math.abs(Math.abs(solvedHorizontalLine.data.to[0] - solvedHorizontalLine.data.from[0]) - 40) < 1e-4,
  'horizontal dimension was not solved to absolute ΔX = 40',
);
assert.ok(
  solvedHorizontalLine.data.from[0] > solvedHorizontalLine.data.to[0],
  'reverse-X seed ordering must remain deterministic: endpoint b is the lower-X first vendor ref',
);

const solvedVerticalLine = result.entities.find((entity) => entity.id === verticalLineId);
assert.ok(solvedVerticalLine);
assert.equal(solvedVerticalLine.type, 'line');
if (solvedVerticalLine.type !== 'line') throw new Error('Expected solved vertical-dimension line');
assert.ok(
  Math.abs(Math.abs(solvedVerticalLine.data.to[1] - solvedVerticalLine.data.from[1]) - 30) < 1e-4,
  'vertical dimension was not solved to absolute ΔY = 30',
);
assert.ok(
  solvedVerticalLine.data.from[1] > solvedVerticalLine.data.to[1],
  'reverse-Y seed ordering must remain deterministic: endpoint b is the lower-Y first vendor ref',
);

const horizontalEdit = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: horizontalDimensionId, value: 55 },
});
assert.equal(horizontalEdit.ok, true);
const verticalEdit = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: verticalDimensionId, value: 45 },
});
assert.equal(verticalEdit.ok, true);
const radiusEdit = await app.execute({
  id: 'part.dimension.setValue',
  payload: { dimensionId: arcRadiusDimensionId, value: 20 },
});
assert.equal(radiusEdit.ok, true);

const editedResult = solver.solve(app.getDocument(), sketchId);
assert.equal(editedResult.ok, true, editedResult.diagnostics.map((item) => item.message).join('; '));
const editedHorizontalLine = editedResult.entities.find((entity) => entity.id === horizontalLineId);
const editedVerticalLine = editedResult.entities.find((entity) => entity.id === verticalLineId);
assert.ok(editedHorizontalLine && editedHorizontalLine.type === 'line');
assert.ok(editedVerticalLine && editedVerticalLine.type === 'line');
if (editedHorizontalLine.type !== 'line' || editedVerticalLine.type !== 'line') {
  throw new Error('Expected edited directional-dimension lines');
}
assert.ok(
  Math.abs(Math.abs(editedHorizontalLine.data.to[0] - editedHorizontalLine.data.from[0]) - 55) < 1e-4,
  'part.dimension.setValue must re-drive horizontal ΔX to 55',
);
assert.ok(
  Math.abs(Math.abs(editedVerticalLine.data.to[1] - editedVerticalLine.data.from[1]) - 45) < 1e-4,
  'part.dimension.setValue must re-drive vertical ΔY to 45',
);
assert.ok(editedHorizontalLine.data.from[0] > editedHorizontalLine.data.to[0]);
assert.ok(editedVerticalLine.data.from[1] > editedVerticalLine.data.to[1]);
const editedRadiusArc = editedResult.entities.find((entity) => entity.id === radiusArcId);
assert.ok(editedRadiusArc && editedRadiusArc.type === 'arc');
if (editedRadiusArc.type !== 'arc') throw new Error('Expected edited Radius arc');
assert.ok(Math.abs(editedRadiusArc.data.radius - 20) < 1e-5, 'part.dimension.setValue must re-drive Arc radius to 20');
assert.ok(editedRadiusArc.data.startAngle >= 0 && editedRadiusArc.data.startAngle < Math.PI * 2);
assert.ok(editedRadiusArc.data.endAngle > editedRadiusArc.data.startAngle);
assert.ok(editedRadiusArc.data.endAngle - editedRadiusArc.data.startAngle < Math.PI * 2);

solver.dispose();
app.dispose();
console.log('ASA-CAD M1 PlaneGCS sketch solver boundary PASS');
