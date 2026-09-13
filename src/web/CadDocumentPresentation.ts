import type { CadDocumentKind } from '../contracts/document';

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

export function documentKindIcon(kind: CadDocumentKind): string {
  switch (kind) {
    case 'part': return '◇';
    case 'assembly': return '⬡';
    case 'drawing': return '▱';
    case 'fragment': return '⌗';
    case 'specification': return '≣';
    case 'text': return '¶';
  }
}
