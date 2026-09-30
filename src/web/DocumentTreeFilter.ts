import type { CadDocument } from '../contracts/document';
import type { CadDimensionId } from '../contracts/ids';
import type { CadDimension, CadSketch } from '../contracts/sketch';
import { dimensionLabel, dimensionUnit } from './SketchDimensionPresentation';

export function documentTreeFilter(document: CadDocument, query: string) {
  const dimensionOwnerCounts = document.kind === 'part'
    ? countDimensionOwners(document.sketches)
    : new Map<CadDimensionId, number>();
  const ownershipIssues = document.kind === 'part'
    ? document.dimensions.filter((dimension) => (dimensionOwnerCounts.get(dimension.id) ?? 0) !== 1)
    : [];
  const filter = query.trim().toLocaleLowerCase('ru-RU');
  const filtering = filter.length > 0;
  const matches = (value: string) => value.toLocaleLowerCase('ru-RU').includes(filter);

  const visibleSketches = document.kind === 'part'
    ? document.sketches.filter((sketch) => !filtering || matches(sketchSearchText(
        sketch,
        document.dimensions.filter((dimension) => sketch.dimensionIds.includes(dimension.id)),
      )))
    : [];
  const visibleFeatures = document.kind === 'part'
    ? document.features.filter((feature) => !filtering || matches(feature.name))
    : [];
  const visibleBodies = document.kind === 'part'
    ? document.bodies.filter((body) => !filtering || matches(body.name))
    : [];
  const visibleOwnershipIssues = ownershipIssues.filter((dimension) => !filtering || matches(
    `${dimensionLabel(dimension.name, dimension.type)} ${dimension.value} ${dimensionUnit(dimension.type)}`,
  ));
  const originMatches = !filtering
    || ['Начало координат', 'Плоскость XY', 'Плоскость XZ', 'Плоскость YZ'].some(matches);
  const noMatches = filtering && !matches(document.title) && !originMatches
    && visibleSketches.length === 0 && visibleFeatures.length === 0
    && visibleBodies.length === 0 && visibleOwnershipIssues.length === 0;

  return {
    dimensionOwnerCounts,
    filtering,
    matches,
    visibleSketches,
    visibleFeatures,
    visibleBodies,
    visibleOwnershipIssues,
    originMatches,
    noMatches,
  };
}

function countDimensionOwners(sketches: readonly CadSketch[]): Map<CadDimensionId, number> {
  const counts = new Map<CadDimensionId, number>();
  for (const sketch of sketches) {
    for (const id of new Set(sketch.dimensionIds)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function sketchSearchText(sketch: CadSketch, dimensions: readonly CadDimension[]): string {
  const entityLabels = sketch.entities.map((entity) => {
    if (entity.type === 'line') return 'Отрезок линия';
    if (entity.type === 'circle') return 'Окружность круг';
    return 'Дуга';
  });
  const dimensionLabels = dimensions.map((dimension) => (
    `${dimensionLabel(dimension.name, dimension.type)} ${dimension.value} ${dimensionUnit(dimension.type)}`
  ));
  return [sketch.name, ...entityLabels, ...dimensionLabels].join(' ');
}
