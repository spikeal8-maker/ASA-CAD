import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import initOpenCascade from '../../vendor/toubkal/node_modules/opencascade.js/dist/node.js';

const fixtureUrl = new URL('./protected-part.fixture.json', import.meta.url);
const sourceText = await readFile(fixtureUrl, 'utf8');
const fixture = JSON.parse(sourceText);

assert.equal(fixture.units, 'mm');
assert.equal(fixture.sketch.plane, 'XY');
assert.equal(fixture.sketch.fullyConstrained, true);

const extrudeFeature = fixture.features.find((feature) => feature.type === 'extrude');
const holeFeature = fixture.features.find((feature) => feature.type === 'through-hole');
const filletFeature = fixture.features.find((feature) => feature.type === 'fillet');
assert.ok(extrudeFeature, 'protected fixture must contain extrusion');
assert.ok(holeFeature, 'protected fixture must contain through-hole');
assert.ok(filletFeature, 'protected fixture must contain fillet');

const oc = await initOpenCascade();
const EPS = 1e-5;

function near(actual, expected, tolerance = EPS, label = 'value') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`,
  );
}

function rectangleWire(width, height) {
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  for (const [x, y] of [[0, 0], [width, 0], [width, height], [0, height]]) {
    const point = new oc.gp_Pnt_3(x, y, 0);
    polygon.Add_1(point);
    point.delete?.();
  }
  polygon.Close();
  const wire = polygon.Wire();
  polygon.delete?.();
  return wire;
}

function extrudeRectangle(width, height, depth) {
  const wire = rectangleWire(width, height);
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, true);
  const vector = new oc.gp_Vec_4(0, 0, depth);
  const prism = new oc.BRepPrimAPI_MakePrism_1(faceMaker.Shape(), vector, false, true);
  const shape = prism.Shape();
  vector.delete?.();
  return shape;
}

function translate(shape, x, y, z) {
  const transform = new oc.gp_Trsf_1();
  const vector = new oc.gp_Vec_4(x, y, z);
  transform.SetTranslation_1(vector);
  const moved = new oc.BRepBuilderAPI_Transform_2(shape, transform, true).Shape();
  vector.delete?.();
  transform.delete?.();
  return moved;
}

function centeredThroughCylinder(width, height, depth, diameter) {
  const radius = diameter / 2;
  const maker = new oc.BRepPrimAPI_MakeCylinder_1(radius, depth + 2);
  const cylinder = maker.Shape();
  return translate(cylinder, width / 2, height / 2, -1);
}

function cut(base, tool) {
  const operation = new oc.BRepAlgoAPI_Cut_3(base, tool, new oc.Message_ProgressRange_1());
  operation.Build(new oc.Message_ProgressRange_1());
  assert.equal(operation.IsDone(), true, 'through-hole boolean cut failed');
  return operation.Shape();
}

function edgeVertices(edge) {
  const vertices = [];
  const explorer = new oc.TopExp_Explorer_2(
    edge,
    oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  while (explorer.More()) {
    const vertex = oc.TopoDS.Vertex_1(explorer.Current());
    const point = oc.BRep_Tool.Pnt(vertex);
    vertices.push([point.X(), point.Y(), point.Z()]);
    point.delete?.();
    explorer.Next();
  }
  explorer.delete?.();
  return vertices;
}

function isNearEither(value, a, b, tolerance = 1e-4) {
  return Math.abs(value - a) <= tolerance || Math.abs(value - b) <= tolerance;
}

function findOuterVerticalEdge(shape, width, height, depth) {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  while (explorer.More()) {
    const edge = oc.TopoDS.Edge_1(explorer.Current());
    const points = edgeVertices(edge);
    if (points.length >= 2) {
      const [a, b] = points;
      const vertical = Math.abs(a[0] - b[0]) < 1e-4
        && Math.abs(a[1] - b[1]) < 1e-4
        && Math.abs(Math.abs(a[2] - b[2]) - depth) < 1e-4;
      const onOuterCorner = isNearEither(a[0], 0, width)
        && isNearEither(a[1], 0, height);
      if (vertical && onOuterCorner) {
        explorer.delete?.();
        return edge;
      }
    }
    explorer.Next();
  }

  explorer.delete?.();
  throw new Error('No outer vertical edge found for protected fillet');
}

function filletOuterVerticalEdge(shape, width, height, depth, radius) {
  const edge = findOuterVerticalEdge(shape, width, height, depth);
  const filletShape = oc.ChFi3d_FilletShape?.ChFi3d_Rational ?? 0;
  const operation = new oc.BRepFilletAPI_MakeFillet(shape, filletShape);
  operation.Add_2(radius, edge);
  operation.Build(new oc.Message_ProgressRange_1());
  assert.equal(operation.IsDone(), true, 'protected fillet failed');
  return operation.Shape();
}

function volume(shape) {
  const properties = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape, properties, true, false, false);
  const result = properties.Mass();
  properties.delete?.();
  return result;
}

function bounds(shape) {
  const result = {
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
  };
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_VERTEX,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  while (explorer.More()) {
    const point = oc.BRep_Tool.Pnt(oc.TopoDS.Vertex_1(explorer.Current()));
    result.minX = Math.min(result.minX, point.X());
    result.minY = Math.min(result.minY, point.Y());
    result.minZ = Math.min(result.minZ, point.Z());
    result.maxX = Math.max(result.maxX, point.X());
    result.maxY = Math.max(result.maxY, point.Y());
    result.maxZ = Math.max(result.maxZ, point.Z());
    point.delete?.();
    explorer.Next();
  }
  explorer.delete?.();
  return result;
}

function commonVolume(a, b) {
  const operation = new oc.BRepAlgoAPI_Common_3(a, b, new oc.Message_ProgressRange_1());
  operation.Build(new oc.Message_ProgressRange_1());
  assert.equal(operation.IsDone(), true, 'common-volume probe failed');
  return volume(operation.Shape());
}

function buildProtectedPart(intent) {
  const width = intent.sketch.width;
  const height = intent.sketch.height;
  const depth = intent.features.find((feature) => feature.type === 'extrude').depth;
  const diameter = intent.features.find((feature) => feature.type === 'through-hole').diameter;
  const radius = intent.features.find((feature) => feature.type === 'fillet').radius;

  const extruded = extrudeRectangle(width, height, depth);
  const holeTool = centeredThroughCylinder(width, height, depth, diameter);
  const cutShape = cut(extruded, holeTool);
  const finalShape = filletOuterVerticalEdge(cutShape, width, height, depth, radius);

  return { finalShape, width, height, depth, diameter, radius };
}

function verifyProtectedPart(built, label) {
  const box = bounds(built.finalShape);
  near(box.minX, 0, 1e-4, `${label}.minX`);
  near(box.minY, 0, 1e-4, `${label}.minY`);
  near(box.minZ, 0, 1e-4, `${label}.minZ`);
  near(box.maxX, built.width, 1e-4, `${label}.width`);
  near(box.maxY, built.height, 1e-4, `${label}.height`);
  near(box.maxZ, built.depth, 1e-4, `${label}.depth`);

  const rawCutVolume = built.width * built.height * built.depth
    - Math.PI * (built.diameter / 2) ** 2 * built.depth;
  const actualVolume = volume(built.finalShape);
  assert.ok(actualVolume < rawCutVolume, `${label}: fillet must remove material`);
  assert.ok(rawCutVolume - actualVolume < 50, `${label}: fillet removed implausibly much material`);

  const probeMaker = new oc.BRepPrimAPI_MakeCylinder_1(built.diameter / 4, built.depth + 2);
  const probe = translate(probeMaker.Shape(), built.width / 2, built.height / 2, -1);
  const obstruction = commonVolume(built.finalShape, probe);
  near(obstruction, 0, 1e-5, `${label}: through-hole obstruction`);

  return actualVolume;
}

console.log('\nASA-CAD M0 protected Part regression');

const initialIntent = structuredClone(fixture);
const initial = buildProtectedPart(initialIntent);
const initialVolume = verifyProtectedPart(initial, 'initial 60x40');
console.log(`  ✓ initial 60x40x10, Ø12 through-hole, R1 fillet (V=${initialVolume.toFixed(3)})`);

// Save -> close -> reopen is intentionally represented as pure serialization here.
// M1 replaces this baseline fixture shape with the real ASA CadDocument contract.
const savedInitial = JSON.stringify(initialIntent);
const reopenedIntent = JSON.parse(savedInitial);
assert.deepEqual(reopenedIntent, initialIntent, 'serialized baseline intent changed after reopen');

reopenedIntent.sketch.width = 80;
const edited = buildProtectedPart(reopenedIntent);
const editedVolume = verifyProtectedPart(edited, 'edited 80x40');
near(editedVolume - initialVolume, 8000, 0.05, '60->80 volume delta');
console.log(`  ✓ upstream sketch edit 60 -> 80 recomputes downstream features (V=${editedVolume.toFixed(3)})`);

const savedEdited = JSON.stringify(reopenedIntent);
const reopenedEditedIntent = JSON.parse(savedEdited);
const rebuilt = buildProtectedPart(reopenedEditedIntent);
const rebuiltVolume = verifyProtectedPart(rebuilt, 'reopened edited');
near(rebuiltVolume, editedVolume, 1e-5, 'reopened edited volume');
console.log('  ✓ save/reopen preserves parametric intent and rebuild result');
console.log('  ✓ M0 protected Part regression PASS\n');
