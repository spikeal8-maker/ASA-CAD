import { CadApplicationImpl } from '../../src/application/CadApplicationImpl';
import { createEmptyCadDocument, type CadPartDocument } from '../../src/contracts/document';
import type { CadApplication } from '../../src/contracts/application';
import type { CadCommand } from '../../src/contracts/commands';
import type { CadDimensionId, CadSketchEntityId, CadSketchId } from '../../src/contracts/ids';
import type { CadRuntimeAdapter } from '../../src/contracts/runtime';

export const profileRuntimeStub: CadRuntimeAdapter = {
  async recompute() { return { ok: true, diagnostics: [] }; },
  async captureReference() { throw new Error('Profile UI fixture does not capture topology'); },
  dispose() {},
};

export function profileApp(runtime: CadRuntimeAdapter = profileRuntimeStub) {
  return new CadApplicationImpl(createEmptyCadDocument('part', { title: 'Solved profile regression' }), runtime);
}

export function requireProfilePart(app: CadApplication): Readonly<CadPartDocument> {
  const part = app.getDocument();
  if (part.kind !== 'part') throw new Error('Expected Part');
  return part;
}

export async function profileCommand(app: CadApplication, command: CadCommand) {
  const result = await app.execute(command);
  if (!result.ok) throw new Error(command.id + ': ' + result.error?.message);
  return result.createdIds?.[0];
}

/** Raw endpoint [0,1] stays persisted; Coincident closes it to [0,0] only in the solver result. */
export async function profileTriangle(app: CadApplication, close = true) {
  const sketchId = await profileCommand(app, { id: 'sketch.create', payload: { support: 'XY' } }) as CadSketchId;
  const lines: CadSketchEntityId[] = [];
  for (const [from, to] of [
    [[0, 0], [20, 0]], [[20, 0], [20, 10]], [[20, 10], [0, 1]],
  ] as const) {
    const entityId = await profileCommand(app, { id: 'sketch.line', payload: { sketchId, from, to } }) as CadSketchEntityId;
    lines.push(entityId);
    if (lines.length < 3) await profileCommand(app, { id: 'constraint.fixed', payload: { sketchId, entityId, frozenGeometry: { type: 'line', from, to } } });
  }
  if (close) await closeProfileTriangle(app, sketchId, lines);
  await profileCommand(app, { id: 'sketch.finish', payload: { sketchId } });
  return { sketchId, lines };
}

export async function closeProfileTriangle(app: CadApplication, sketchId: CadSketchId, lines: CadSketchEntityId[]) {
  await profileCommand(app, {
    id: 'constraint.coincident',
    payload: { sketchId, a: { entityId: lines[2], point: 'a' }, b: { entityId: lines[1], point: 'b' } },
  });
  await profileCommand(app, {
    id: 'constraint.coincident',
    payload: { sketchId, a: { entityId: lines[2], point: 'b' }, b: { entityId: lines[0], point: 'a' } },
  });
}

export async function profileBasePrism(app: CadApplication) {
  const sketchId = await profileCommand(app, { id: 'sketch.create', payload: { support: 'XY' } }) as CadSketchId;
  await profileCommand(app, {
    id: 'sketch.rectangle', payload: { sketchId, origin: [-30, -20], width: 60, height: 40 },
  });
  await profileCommand(app, { id: 'feature.extrude', payload: { sketchId, distance: 5 } });
}

export async function profileCircle(app: CadApplication) {
  const sketchId = await profileCommand(app, { id: 'sketch.create', payload: { support: 'XY' } }) as CadSketchId;
  const entityId = await profileCommand(app, {
    id: 'sketch.circle', payload: { sketchId, center: [0, 0], diameter: 10 },
  }) as CadSketchEntityId;
  const dimensionId = await profileCommand(app, {
    id: 'dimension.diameter', payload: { sketchId, entityId, value: 20, name: 'profile-diameter' },
  }) as CadDimensionId;
  await profileCommand(app, { id: 'sketch.finish', payload: { sketchId } });
  return { sketchId, entityId, dimensionId };
}
