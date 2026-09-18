export function dimensionLabel(name: string | undefined, type: string): string {
  if (name === 'width') return 'Ширина';
  if (name === 'height') return 'Высота';
  if (name === 'diameter' || type === 'diameter') return 'Диаметр';
  if (type === 'linear') return 'Линейный размер';
  if (type === 'horizontal') return 'Горизонтальный размер';
  if (type === 'vertical') return 'Вертикальный размер';
  return name || type;
}
