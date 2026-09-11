import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/contracts/document.ts';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`O7 contract codemod could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'Sketch contract import/export',
  "import { createCadId } from './ids';\n",
  `import { createCadId } from './ids';
import { validateCadPartSketchCollections } from './sketch';
import type { CadConstraint, CadDimension, CadSketch } from './sketch';

export type {
  CadCoincidentConstraint,
  CadConstraint,
  CadConstraintPointReference,
  CadDiameterDimension,
  CadDimension,
  CadFixedConstraint,
  CadHorizontalConstraint,
  CadLinearDimension,
  CadPartSketchCollections,
  CadPoint2,
  CadSketch,
  CadSketchCircleData,
  CadSketchCircleEntity,
  CadSketchEntity,
  CadSketchLineData,
  CadSketchLineEntity,
  CadSketchPointSelector,
  CadVerticalConstraint,
} from './sketch';
`,
);

const oldSketchBlock = `export interface CadSketchEntity {
  id: CadSketchEntityId;
  type: string;
  data: Record<string, unknown>;
}

export interface CadSketch {
  id: CadSketchId;
  name: string;
  support: string;
  entities: CadSketchEntity[];
  constraintIds: CadConstraintId[];
  dimensionIds: CadDimensionId[];
}

export interface CadConstraint {
  id: CadConstraintId;
  type: string;
  entityIds: CadSketchEntityId[];
  data?: Record<string, unknown>;
}

export interface CadDimension {
  id: CadDimensionId;
  type: string;
  entityIds: CadSketchEntityId[];
  value: number;
  driving: boolean;
  name?: string;
}

`;
replaceOnce('legacy permissive Sketch DTOs', oldSketchBlock, '');

replaceOnce(
  'Part sketch validation',
  `  if (!['mm', 'cm', 'm', 'inch'].includes(String(document.units))) {
    throw new Error(\`Unsupported CadDocument units: \${String(document.units)}\`);
  }
}
`,
  `  if (!['mm', 'cm', 'm', 'inch'].includes(String(document.units))) {
    throw new Error(\`Unsupported CadDocument units: \${String(document.units)}\`);
  }
  if (document.kind === 'part') {
    validateCadPartSketchCollections(value);
  }
}
`,
);

writeFileSync(path, source);
console.log('Applied O7 typed Sketch contract wiring');
