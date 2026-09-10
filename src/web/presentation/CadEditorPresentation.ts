import type { CadDocument, CadDocumentKind, CadPartDocument, CadSketch } from '../../contracts/document';
import type { CadViewportViewName } from '../CadViewport';
import {
  cadUiCommandById,
  cadUiCommandLabel,
  searchableCadUiCommands,
  type CadUiCommandMeta,
} from './CadUiActions';

export const documentNames: Record<CadDocumentKind, string> = {
  part: 'Деталь',
  assembly: 'Сборка',
  drawing: 'Чертеж',
  fragment: 'Фрагмент',
  specification: 'Спецификация',
  text: 'Текстовый документ',
};

export const documentDescriptions: Record<CadDocumentKind, string> = {
  part: 'Параметрическая трехмерная деталь',
  assembly: 'Сборка деталей и подсборок',
  drawing: 'Листовой ассоциативный чертеж',
  fragment: 'Свободный двумерный фрагмент',
  specification: 'Состав изделия и позиции',
  text: 'Инженерный текстовый документ',
};

export const viewportViewByLabel: Record<string, CadViewportViewName> = {
  'Показать всё': 'fit',
  'Спереди': 'front',
  'Сзади': 'back',
  'Сверху': 'top',
  'Снизу': 'bottom',
  'Слева': 'left',
  'Справа': 'right',
  'Изометрия': 'isometric',
};

export const commandById = cadUiCommandById;
export const commandLabel = cadUiCommandLabel;

export function searchCommands(query: string, documentKind: CadDocumentKind): CadUiCommandMeta[] {
  return searchableCadUiCommands(query, documentKind).slice(0, 8);
}

export function kindIcon(kind: CadDocumentKind): string {
  switch (kind) {
    case 'part': return '◇';
    case 'assembly': return '⬡';
    case 'drawing': return '▱';
    case 'fragment': return '⌗';
    case 'specification': return '≣';
    case 'text': return '¶';
  }
}

export function partDocument(document: Readonly<CadDocument>): CadPartDocument | null {
  return document.kind === 'part' ? document as CadPartDocument : null;
}

export function latestSketch(part: CadPartDocument | null): CadSketch | null {
  return part?.sketches.at(-1) ?? null;
}

export function hasRectangle(sketch: CadSketch | null): boolean {
  return Boolean(
    sketch?.entities.filter(
      (entity) => entity.type === 'line' && String(entity.data.role ?? '').startsWith('rectangle-edge-'),
    ).length === 4,
  );
}

export function hasCircle(sketch: CadSketch | null): boolean {
  return Boolean(sketch?.entities.some((entity) => entity.type === 'circle'));
}

export function dimensionLabel(name: string | undefined, type: string): string {
  if (name === 'width') return 'Ширина';
  if (name === 'height') return 'Высота';
  if (name === 'diameter' || type === 'diameter') return 'Диаметр';
  return name || type;
}
