import { useCallback, useState } from 'react';
import type { CadViewportViewName } from './viewport/ViewportCameraController';

/** Same shape as CadViewportViewCommand: a monotonically numbered camera request. */
export interface ViewportViewCommand {
  sequence: number;
  view: CadViewportViewName;
}

const viewportViewByLabel: Record<string, CadViewportViewName> = {
  'Показать всё': 'fit', 'Спереди': 'front', 'Сзади': 'back', 'Сверху': 'top',
  'Снизу': 'bottom', 'Слева': 'left', 'Справа': 'right', 'Изометрия': 'isometric',
};

/** Ribbon, quick-access and shortcut view requests as one viewport camera command stream. */
export function useViewportViewCommands() {
  const [viewName, setViewName] = useState('Изометрия');
  const [viewCommand, setViewCommand] = useState<ViewportViewCommand>({ sequence: 0, view: 'isometric' });
  const requestViewportCommand = useCallback(
    (view: CadViewportViewName) => setViewCommand((current) => ({ sequence: current.sequence + 1, view })),
    [],
  );
  const requestView = useCallback((label: string) => {
    const view = viewportViewByLabel[label];
    if (!view) return;
    setViewName(label);
    requestViewportCommand(view);
  }, [requestViewportCommand]);
  return { viewName, viewCommand, requestView, requestViewportCommand };
}
