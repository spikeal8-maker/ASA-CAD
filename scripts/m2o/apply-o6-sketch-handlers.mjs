import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/application/CadApplicationImpl.ts';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O6 codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'command imports',
  `import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
  CadSketchCommandReference,
} from '../contracts/commands';
`,
  `import type {
  CadCommand,
  CadCommandAvailability,
  CadCommandId,
  CadCommandResult,
} from '../contracts/commands';
`,
);

replaceOnce(
  'document imports',
  `import type {
  CadBody,
  CadConstraint,
  CadDimension,
  CadDocument,
  CadFeature,
  CadPartDocument,
  CadSketch,
  CadSketchEntity,
  CadStableReference,
} from '../contracts/document';
`,
  `import type {
  CadBody,
  CadDocument,
  CadFeature,
  CadPartDocument,
  CadStableReference,
} from '../contracts/document';
`,
);

replaceOnce(
  'id imports',
  `import type {
  CadBodyId,
  CadConstraintId,
  CadDimensionId,
  CadFeatureId,
  CadSketchEntityId,
  CadSketchId,
  CadStableReferenceId,
} from '../contracts/ids';
`,
  `import type {
  CadBodyId,
  CadFeatureId,
  CadStableReferenceId,
} from '../contracts/ids';
`,
);

replaceOnce(
  'handler import',
  "import type { CadReferenceCaptureRequest, CadRuntimeAdapter } from '../contracts/runtime';\n",
  `import type { CadReferenceCaptureRequest, CadRuntimeAdapter } from '../contracts/runtime';
import {
  applySketchGrowthCommand,
  getSketchGrowthCommandAvailability,
  isSketchGrowthCommand,
  isSketchGrowthCommandId,
} from './commands/SketchCommandHandlers';
`,
);

const availabilityStart = source.indexOf('    const part = this.document;\n    switch (id) {');
const availabilityEndMarker = '\n  }\n\n  async execute(command: CadCommand): Promise<CadCommandResult> {';
const availabilityEnd = source.indexOf(availabilityEndMarker, availabilityStart);
if (availabilityStart < 0 || availabilityEnd < 0) throw new Error('O6 could not locate availability switch');
const availabilityReplacement = `    const part = this.document;
    if (isSketchGrowthCommandId(id)) {
      return getSketchGrowthCommandAvailability(part, id);
    }

    switch (id) {
      case 'feature.extrude':
      case 'feature.cutExtrude':
        return part.sketches.length > 0
          ? { enabled: true }
          : { enabled: false, reason: 'A sketch/profile is required' };
      case 'feature.fillet':
        return part.stableReferences.length > 0
          ? { enabled: true }
          : { enabled: false, reason: 'A stable edge/face reference is required' };
    }`;
source = `${source.slice(0, availabilityStart)}${availabilityReplacement}${source.slice(availabilityEnd)}`;

const applyStart = source.indexOf("  private applyDocumentCommand(command: Exclude<CadCommand, { id: 'document.rebuild' }>): CadCommandResult {");
const recomputeStart = source.indexOf('  private async recompute(): Promise<CadCommandResult> {', applyStart);
if (applyStart < 0 || recomputeStart < 0) throw new Error('O6 could not locate application command switch');
const applyReplacement = `  private applyDocumentCommand(command: Exclude<CadCommand, { id: 'document.rebuild' }>): CadCommandResult {
    const part = this.requirePart();

    if (isSketchGrowthCommand(command)) {
      return applySketchGrowthCommand(part, command);
    }

    switch (command.id) {
      case 'feature.extrude': {
        if (!part.sketches.some((sketch) => sketch.id === command.payload.sketchId)) {
          throw new Error(\`Unknown sketch: \${command.payload.sketchId}\`);
        }
        if (command.payload.distance <= 0) throw new Error('Extrude distance must be positive');
        const featureId = createCadId<CadFeatureId>('feature');
        const feature: CadFeature = {
          id: featureId,
          type: 'extrude',
          name: \`Элемент выдавливания \${part.features.filter((item) => item.type === 'extrude').length + 1}\`,
          suppressed: false,
          parameters: { ...command.payload },
          inputReferences: [],
        };
        part.features.push(feature);
        const createdIds: Array<CadFeatureId | CadBodyId> = [featureId];
        if (part.bodies.length === 0) {
          const bodyId = createCadId<CadBodyId>('body');
          const body: CadBody = { id: bodyId, name: 'Тело 1', visible: true };
          part.bodies.push(body);
          createdIds.push(bodyId);
        }
        return { ok: true, changed: true, createdIds };
      }

      case 'feature.cutExtrude': {
        if (!part.sketches.some((sketch) => sketch.id === command.payload.sketchId)) {
          throw new Error(\`Unknown sketch: \${command.payload.sketchId}\`);
        }
        if (command.payload.end === 'blind' && (!command.payload.distance || command.payload.distance <= 0)) {
          throw new Error('Blind cut requires a positive distance');
        }
        const id = createCadId<CadFeatureId>('feature');
        part.features.push({
          id,
          type: 'cut-extrude',
          name: \`Вырезать выдавливанием \${part.features.filter((item) => item.type === 'cut-extrude').length + 1}\`,
          suppressed: false,
          parameters: { ...command.payload },
          inputReferences: [],
        });
        return { ok: true, changed: true, createdIds: [id] };
      }

      case 'feature.fillet': {
        if (command.payload.radius <= 0) throw new Error('Fillet radius must be positive');
        for (const referenceId of command.payload.references) {
          if (!part.stableReferences.some((reference) => reference.id === referenceId)) {
            throw new Error(\`Unknown stable reference: \${referenceId}\`);
          }
        }
        const id = createCadId<CadFeatureId>('feature');
        part.features.push({
          id,
          type: 'fillet',
          name: \`Скругление \${part.features.filter((item) => item.type === 'fillet').length + 1}\`,
          suppressed: false,
          parameters: { radius: command.payload.radius },
          inputReferences: [...command.payload.references],
        });
        return { ok: true, changed: true, createdIds: [id] };
      }
    }
  }

`;
source = `${source.slice(0, applyStart)}${applyReplacement}${source.slice(recomputeStart)}`;

const requireSketchStart = source.indexOf('  private requireSketch(part: CadPartDocument, id:');
const emitStart = source.indexOf('  private emit(): void {', requireSketchStart);
if (requireSketchStart < 0 || emitStart < 0) throw new Error('O6 could not locate obsolete sketch helper methods');
source = `${source.slice(0, requireSketchStart)}${source.slice(emitStart)}`;

writeFileSync(path, source);
console.log('Applied O6 Sketch/Constraint/Dimension handler extraction');
