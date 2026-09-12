import type { CadApplication } from '../contracts/application';
import type { CadCommand, CadCommandResult } from '../contracts/commands';
import { createEmptyCadDocument } from '../contracts/document';
import type {
  CadFeatureId,
  CadSketchEntityId,
  CadSketchId,
} from '../contracts/ids';
import type { CadPartDevFixtureName } from '../browser/routes';

export interface CadPartDevFixtureResult {
  name: CadPartDevFixtureName;
  workspace: 'solid' | 'sketch';
  expectedRecomputeStatus: 'clean' | 'dirty' | 'error';
  message: string;
  /** Optional review-only Sketch activation; existing fixtures keep their old lazy behavior. */
  activeSketchId?: CadSketchId;
}

function commandError(result: CadCommandResult, label: string): never {
  throw new Error(result.error?.message ?? `${label} failed`);
}

async function execute(app: CadApplication, command: CadCommand, label: string): Promise<CadCommandResult> {
  const result = await app.execute(command);
  if (!result.ok) commandError(result, label);
  return result;
}

function createdId<T extends string>(result: CadCommandResult, index: number, label: string): T {
  const id = result.createdIds?.[index];
  if (!id) throw new Error(`${label} did not create object ${index}`);
  return id as unknown as T;
}

async function buildLineSketch(app: CadApplication): Promise<CadSketchId> {
  const sketchResult = await execute(
    app,
    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },
    'Create line sketch',
  );
  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create line sketch');
  await execute(
    app,
    { id: 'sketch.line', payload: { sketchId, from: [-8, -4], to: [10, 6] } },
    'Create direct line fixture',
  );
  return sketchId;
}

async function buildCircleSketch(app: CadApplication): Promise<CadSketchId> {
  const sketchResult = await execute(
    app,
    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },
    'Create circle sketch',
  );
  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create circle sketch');
  await execute(
    app,
    { id: 'sketch.circle', payload: { sketchId, center: [5, -3], diameter: 24 } },
    'Create direct circle fixture',
  );
  return sketchId;
}

async function buildRectangleSketch(app: CadApplication): Promise<CadSketchId> {
  const sketchResult = await execute(
    app,
    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз 1' } },
    'Create base sketch',
  );
  const sketchId = createdId<CadSketchId>(sketchResult, 0, 'Create base sketch');

  const rectangleResult = await execute(
    app,
    {
      id: 'sketch.rectangle',
      payload: { sketchId, origin: [-30, -20], width: 60, height: 40 },
    },
    'Create 60x40 rectangle',
  );
  const edges = rectangleResult.createdIds as CadSketchEntityId[] | undefined;
  if (!edges || edges.length !== 4) throw new Error('Rectangle fixture must create four edges');

  await execute(
    app,
    {
      id: 'dimension.linear',
      payload: { sketchId, entityIds: [edges[0]], value: 60, name: 'width' },
    },
    'Create width dimension',
  );
  await execute(
    app,
    {
      id: 'dimension.linear',
      payload: { sketchId, entityIds: [edges[1]], value: 40, name: 'height' },
    },
    'Create height dimension',
  );
  return sketchId;
}

async function buildExtrude(app: CadApplication): Promise<CadFeatureId> {
  const sketchId = await buildRectangleSketch(app);
  const extrude = await execute(
    app,
    { id: 'feature.extrude', payload: { sketchId, distance: 10 } },
    'Create 10 mm extrusion',
  );
  return createdId<CadFeatureId>(extrude, 0, 'Create 10 mm extrusion');
}

async function buildReferenceModel(app: CadApplication): Promise<void> {
  const extrudeFeatureId = await buildExtrude(app);
  const topFaceReferenceId = await app.captureReference({
    kind: 'face',
    sourceFeatureId: extrudeFeatureId,
    point: [0, 0, 10],
    semanticRole: 'fixture-top-face-for-hole-sketch',
  });

  const sketch2Result = await execute(
    app,
    { id: 'sketch.create', payload: { support: topFaceReferenceId, name: 'Эскиз 2' } },
    'Create face-supported sketch',
  );
  const sketch2 = createdId<CadSketchId>(sketch2Result, 0, 'Create face-supported sketch');
  const circleResult = await execute(
    app,
    { id: 'sketch.circle', payload: { sketchId: sketch2, center: [0, 0], diameter: 12 } },
    'Create fixture hole circle',
  );
  const circleId = createdId<CadSketchEntityId>(circleResult, 0, 'Create fixture hole circle');
  await execute(
    app,
    {
      id: 'dimension.diameter',
      payload: { sketchId: sketch2, entityId: circleId, value: 12, name: 'diameter' },
    },
    'Create fixture diameter',
  );

  const cutResult = await execute(
    app,
    { id: 'feature.cutExtrude', payload: { sketchId: sketch2, end: 'through-all' } },
    'Create through-all cut',
  );
  const cutFeatureId = createdId<CadFeatureId>(cutResult, 0, 'Create through-all cut');

  const edgeReferenceId = await app.captureReference({
    kind: 'edge',
    sourceFeatureId: cutFeatureId,
    point: [0, -20, 0],
    semanticRole: 'fixture-outer-bottom-edge-for-fillet',
  });
  await execute(
    app,
    { id: 'feature.fillet', payload: { references: [edgeReferenceId], radius: 1 } },
    'Create R1 fixture fillet',
  );
  await execute(app, { id: 'document.rebuild', payload: {} }, 'Rebuild reference fixture');
}

async function buildExpectedRebuildError(app: CadApplication): Promise<string> {
  await buildExtrude(app);
  const invalidSketchResult = await execute(
    app,
    { id: 'sketch.create', payload: { support: 'XY', name: 'Эскиз ошибки' } },
    'Create intentionally empty cut sketch',
  );
  const invalidSketchId = createdId<CadSketchId>(
    invalidSketchResult,
    0,
    'Create intentionally empty cut sketch',
  );
  await execute(
    app,
    { id: 'feature.cutExtrude', payload: { sketchId: invalidSketchId, end: 'through-all' } },
    'Create intentionally invalid cut feature',
  );
  const rebuild = await app.execute({ id: 'document.rebuild', payload: {} });
  if (rebuild.ok) throw new Error('Rebuild-error fixture unexpectedly rebuilt successfully');
  return rebuild.error?.message ?? 'Expected fixture rebuild failure';
}

export async function applyPartDevFixture(
  app: CadApplication,
  name: CadPartDevFixtureName,
): Promise<CadPartDevFixtureResult> {
  await app.replaceDocument(createEmptyCadDocument('part', { title: `Fixture — ${name}` }));

  if (name === 'empty') {
    return {
      name,
      workspace: 'solid',
      expectedRecomputeStatus: 'clean',
      message: 'Fixture empty готов',
    };
  }

  if (name === 'sketch') {
    await buildRectangleSketch(app);
    return {
      name,
      workspace: 'sketch',
      expectedRecomputeStatus: 'dirty',
      message: 'Fixture sketch: параметрический прямоугольник 60×40 мм',
    };
  }

  if (name === 'line') {
    const activeSketchId = await buildLineSketch(app);
    return {
      name,
      workspace: 'sketch',
      expectedRecomputeStatus: 'dirty',
      message: 'Fixture line: один прямой отрезок в XY',
      activeSketchId,
    };
  }

  if (name === 'circle') {
    const activeSketchId = await buildCircleSketch(app);
    return {
      name,
      workspace: 'sketch',
      expectedRecomputeStatus: 'dirty',
      message: 'Fixture circle: окружность Ø24 мм с центром (5, -3) в XY',
      activeSketchId,
    };
  }

  if (name === 'extrude') {
    await buildExtrude(app);
    await execute(app, { id: 'document.rebuild', payload: {} }, 'Rebuild extrusion fixture');
    return {
      name,
      workspace: 'solid',
      expectedRecomputeStatus: 'clean',
      message: 'Fixture extrude: 60×40×10 мм',
    };
  }

  if (name === 'reference') {
    await buildReferenceModel(app);
    return {
      name,
      workspace: 'solid',
      expectedRecomputeStatus: 'clean',
      message: 'Fixture reference: Ø12 сквозной вырез + R1 + 2 StableRef',
    };
  }

  const errorMessage = await buildExpectedRebuildError(app);
  return {
    name,
    workspace: 'solid',
    expectedRecomputeStatus: 'error',
    message: `Fixture rebuild-error: ${errorMessage}`,
  };
}
