import fs from 'node:fs';

const alreadyApplied = fs.readFileSync('src/contracts/sketch.ts', 'utf8').includes('export interface CadSketchArcData');
if (alreadyApplied) {
  console.log('M3.4A Arc contract codemod already applied');
  process.exit(0);
}

function replaceOnce(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Expected fragment not found in ${path}: ${from.slice(0, 120)}`);
  const next = source.replace(from, to);
  if (next === source) throw new Error(`No change produced for ${path}`);
  fs.writeFileSync(path, next);
}

// Persisted ASA Sketch contract.
replaceOnce(
  'src/contracts/sketch.ts',
  `export interface CadSketchCircleData {\n  center: CadPoint2;\n  diameter: number;\n}\n`,
  `export interface CadSketchCircleData {\n  center: CadPoint2;\n  diameter: number;\n}\n\nexport interface CadSketchArcData {\n  center: CadPoint2;\n  radius: number;\n  /** Canonical start angle in radians, normalized to [0, 2π). */\n  startAngle: number;\n  /** Canonical CCW end angle in radians; endAngle > startAngle and sweep < 2π. */\n  endAngle: number;\n}\n`,
);
replaceOnce(
  'src/contracts/sketch.ts',
  `export interface CadSketchCircleEntity {\n  id: CadSketchEntityId;\n  type: 'circle';\n  data: CadSketchCircleData;\n}\n\n/** Current persisted M3-ready Sketch entity surface. Extend this union explicitly. */\nexport type CadSketchEntity = CadSketchLineEntity | CadSketchCircleEntity;`,
  `export interface CadSketchCircleEntity {\n  id: CadSketchEntityId;\n  type: 'circle';\n  data: CadSketchCircleData;\n}\n\nexport interface CadSketchArcEntity {\n  id: CadSketchEntityId;\n  type: 'arc';\n  data: CadSketchArcData;\n}\n\n/** Current persisted M3-ready Sketch entity surface. Extend this union explicitly. */\nexport type CadSketchEntity = CadSketchLineEntity | CadSketchCircleEntity | CadSketchArcEntity;`,
);
replaceOnce(
  'src/contracts/sketch.ts',
  `    case 'circle':\n      expectPoint2(data.center, \`${'${path}'}.data.center\`);\n      expectPositiveFinite(data.diameter, \`${'${path}'}.data.diameter\`);\n      return;\n    default:`,
  `    case 'circle':\n      expectPoint2(data.center, \`${'${path}'}.data.center\`);\n      expectPositiveFinite(data.diameter, \`${'${path}'}.data.diameter\`);\n      return;\n    case 'arc': {\n      expectPoint2(data.center, \`${'${path}'}.data.center\`);\n      expectPositiveFinite(data.radius, \`${'${path}'}.data.radius\`);\n      expectFinite(data.startAngle, \`${'${path}'}.data.startAngle\`);\n      expectFinite(data.endAngle, \`${'${path}'}.data.endAngle\`);\n      const twoPi = Math.PI * 2;\n      if (data.startAngle < 0 || data.startAngle >= twoPi) {\n        throw new Error(\`${'${path}'}.data.startAngle must be in [0,2π)\`);\n      }\n      const sweep = data.endAngle - data.startAngle;\n      if (!(sweep > 0) || !(sweep < twoPi)) {\n        throw new Error(\`${'${path}'}.data.sweep must be greater than 0 and less than 2π\`);\n      }\n      return;\n    }\n    default:`,
);

// Public re-exports.
replaceOnce(
  'src/contracts/document.ts',
  `  CadSketchCircleData,\n  CadSketchCircleEntity,\n  CadSketchEntity,`,
  `  CadSketchCircleData,\n  CadSketchCircleEntity,\n  CadSketchArcData,\n  CadSketchArcEntity,\n  CadSketchEntity,`,
);

// Typed command contract. One initial construction mode: center -> start -> end.
replaceOnce(
  'src/contracts/commands.ts',
  `} from './ids';\n\nexport type CadSketchPointName`,
  `} from './ids';\nimport type { CadPoint2 } from './sketch';\n\nexport type CadSketchPointName`,
);
replaceOnce(
  'src/contracts/commands.ts',
  `  | 'sketch.circle'\n  | 'sketch.finish'`,
  `  | 'sketch.circle'\n  | 'sketch.arc'\n  | 'sketch.finish'`,
);
replaceOnce(
  'src/contracts/commands.ts',
  `  'sketch.circle': {\n    sketchId: CadSketchId;\n    center: readonly [number, number];\n    diameter: number;\n  };\n  'sketch.finish':`,
  `  'sketch.circle': {\n    sketchId: CadSketchId;\n    center: readonly [number, number];\n    diameter: number;\n  };\n  'sketch.arc': {\n    sketchId: CadSketchId;\n    center: CadPoint2;\n    start: CadPoint2;\n    end: CadPoint2;\n  };\n  'sketch.finish':`,
);

// Focused application handler + canonicalization.
replaceOnce(
  'src/application/commands/SketchCommandHandlers.ts',
  `  'sketch.circle',\n  'sketch.finish',`,
  `  'sketch.circle',\n  'sketch.arc',\n  'sketch.finish',`,
);
replaceOnce(
  'src/application/commands/SketchCommandHandlers.ts',
  `  'sketch.finish': handler<'sketch.finish'>({`,
  `  'sketch.arc': handler<'sketch.arc'>({\n    availability: requireSketchAvailability,\n    execute: (part, command) => {\n      const sketch = requireSketch(part, command.payload.sketchId);\n      const { center, start, end } = command.payload;\n      const radius = pointDistance(center, start);\n      if (!(radius > 1e-6)) throw new Error('Arc radius must be positive');\n      const startAngle = normalizeAngle(Math.atan2(start[1] - center[1], start[0] - center[0]));\n      const rawEndAngle = normalizeAngle(Math.atan2(end[1] - center[1], end[0] - center[0]));\n      const sweep = positiveSweep(startAngle, rawEndAngle);\n      if (!(sweep > 1e-9) || !(sweep < TWO_PI - 1e-9)) {\n        throw new Error('Arc sweep must be greater than 0 and less than 2π');\n      }\n      const id = createCadId<CadSketchEntityId>('entity');\n      sketch.entities.push({\n        id,\n        type: 'arc',\n        data: { center, radius, startAngle, endAngle: startAngle + sweep },\n      });\n      return { ok: true, changed: true, createdIds: [id] };\n    },\n  }),\n\n  'sketch.finish': handler<'sketch.finish'>({`,
);
replaceOnce(
  'src/application/commands/SketchCommandHandlers.ts',
  `    case 'sketch.circle':\n      return HANDLERS['sketch.circle'].execute(part, command);\n    case 'sketch.finish':`,
  `    case 'sketch.circle':\n      return HANDLERS['sketch.circle'].execute(part, command);\n    case 'sketch.arc':\n      return HANDLERS['sketch.arc'].execute(part, command);\n    case 'sketch.finish':`,
);
replaceOnce(
  'src/application/commands/SketchCommandHandlers.ts',
  `function requireSketch(part: CadPartDocument, id: CadSketchId): CadSketch {`,
  `const TWO_PI = Math.PI * 2;\n\nfunction normalizeAngle(value: number): number {\n  const normalized = ((value % TWO_PI) + TWO_PI) % TWO_PI;\n  return Object.is(normalized, -0) ? 0 : normalized;\n}\n\nfunction positiveSweep(startAngle: number, endAngle: number): number {\n  let sweep = endAngle - startAngle;\n  if (sweep <= 0) sweep += TWO_PI;\n  return sweep;\n}\n\nfunction pointDistance(a: readonly [number, number], b: readonly [number, number]): number {\n  return Math.hypot(b[0] - a[0], b[1] - a[1]);\n}\n\nfunction requireSketch(part: CadPartDocument, id: CadSketchId): CadSketch {`,
);

// ASA PlaneGCS adapter: typed Arc DTO <-> vendor EntityGeom.
replaceOnce(
  'src/runtime/PlaneGCSSketchSolverRuntime.ts',
  `        if (entity.type === 'circle' && solved.kind === 'circle') {\n          return {\n            id: entity.id,\n            type: 'circle',\n            data: {\n              ...entity.data,\n              center: [solved.c[0], solved.c[1]],\n              diameter: solved.r * 2,\n            },\n          };\n        }\n\n        return structuredClone(entity);`,
  `        if (entity.type === 'circle' && solved.kind === 'circle') {\n          return {\n            id: entity.id,\n            type: 'circle',\n            data: {\n              ...entity.data,\n              center: [solved.c[0], solved.c[1]],\n              diameter: solved.r * 2,\n            },\n          };\n        }\n\n        if (entity.type === 'arc' && solved.kind === 'arc') {\n          const startAngle = normalizeArcAngle(solved.a1);\n          const sweep = positiveArcSweep(solved.a1, solved.a2);\n          return {\n            id: entity.id,\n            type: 'arc',\n            data: {\n              center: [solved.c[0], solved.c[1]],\n              radius: solved.r,\n              startAngle,\n              endAngle: startAngle + sweep,\n            },\n          };\n        }\n\n        return structuredClone(entity);`,
);
replaceOnce(
  'src/runtime/PlaneGCSSketchSolverRuntime.ts',
  `        case 'circle':\n          return [{\n            id: entity.id,\n            kind: 'circle',\n            c: [entity.data.center[0], entity.data.center[1]],\n            r: entity.data.diameter / 2,\n          }];\n      }`,
  `        case 'circle':\n          return [{\n            id: entity.id,\n            kind: 'circle',\n            c: [entity.data.center[0], entity.data.center[1]],\n            r: entity.data.diameter / 2,\n          }];\n        case 'arc':\n          return [{\n            id: entity.id,\n            kind: 'arc',\n            c: [entity.data.center[0], entity.data.center[1]],\n            r: entity.data.radius,\n            a1: entity.data.startAngle,\n            a2: entity.data.endAngle,\n          }];\n      }`,
);
replaceOnce(
  'src/runtime/PlaneGCSSketchSolverRuntime.ts',
  `}\n`,
  `}\n\nconst ARC_TWO_PI = Math.PI * 2;\n\nfunction normalizeArcAngle(value: number): number {\n  const normalized = ((value % ARC_TWO_PI) + ARC_TWO_PI) % ARC_TWO_PI;\n  return Object.is(normalized, -0) ? 0 : normalized;\n}\n\nfunction positiveArcSweep(start: number, end: number): number {\n  let sweep = normalizeArcAngle(end) - normalizeArcAngle(start);\n  if (sweep <= 0) sweep += ARC_TWO_PI;\n  return sweep;\n}\n`,
);

// Existing O7 guard must evolve with the explicit union.
replaceOnce(
  'tests/m2o/sketch-contract-boundary.mjs',
  `/type CadSketchEntity = CadSketchLineEntity \\| CadSketchCircleEntity/`,
  `/type CadSketchEntity = CadSketchLineEntity \\| CadSketchCircleEntity \\| CadSketchArcEntity/`,
);

// Test lane: contract/runtime only; no product/browser Arc acceptance yet.
const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.scripts['test:m3:arc-contract'] = 'node vendor/toubkal/node_modules/tsx/dist/cli.mjs tests/m3/arc-contract.ts && node tests/m3/arc-contract-boundary.mjs';
packageJson.scripts['test:m3'] = 'npm run test:m3:foundation && npm run test:m3:circle && npm run test:m3:arc-contract';
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('M3.4A Arc contract codemod applied');
