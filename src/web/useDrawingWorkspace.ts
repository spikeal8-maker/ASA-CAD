import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CadApplication } from '../contracts/application';
import type {
  CadDocument,
  CadDraftLineEntity,
  CadPoint2,
} from '../contracts/document';
import type { CadDraftEntityId } from '../contracts/ids';
import type { CadWorkspacePanel } from './PartSketchWorkspaceTypes';

export interface DrawingLineDraft {
  from: CadPoint2 | null;
  to: CadPoint2 | null;
}

export interface DrawingLineEdit {
  from: CadPoint2;
  to: CadPoint2;
}

export interface DrawingWorkspaceOptions {
  app: CadApplication;
  document: Readonly<CadDocument>;
  setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void;
}

const EMPTY_DRAFT: DrawingLineDraft = { from: null, to: null };
const EMPTY_EDIT: DrawingLineEdit = { from: [0, 0], to: [0, 0] };
const MIN_LINE_LENGTH = 1e-6;

export function useDrawingWorkspace(options: DrawingWorkspaceOptions) {
  const { app, document, setPanel, setNotice } = options;
  const drawing = document.kind === 'drawing' ? document : null;
  const sheet = drawing?.sheets[0] ?? null;
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<CadDraftEntityId | null>(null);
  const [lineDraft, setLineDraft] = useState<DrawingLineDraft>(EMPTY_DRAFT);
  const [lineEdit, setLineEdit] = useState<DrawingLineEdit>(EMPTY_EDIT);
  const [committing, setCommitting] = useState(false);

  const selectedLine = useMemo(() => {
    if (!sheet || !selectedEntityId) return null;
    const entity = sheet.entities.find((item) => item.id === selectedEntityId);
    return entity?.type === 'line' ? entity : null;
  }, [selectedEntityId, sheet]);

  useEffect(() => {
    resetTransient();
  }, [document.documentId]);

  useEffect(() => {
    if (!selectedLine || activeCommand !== 'draft.line.update') return;
    setLineEdit({ from: [...selectedLine.from], to: [...selectedLine.to] });
  }, [selectedLine?.id]);

  function resetTransient(): void {
    setActiveCommand(null);
    setSelectedEntityId(null);
    setLineDraft(EMPTY_DRAFT);
    setLineEdit(EMPTY_EDIT);
    setCommitting(false);
  }

  const beginLine = useCallback(() => {
    if (!sheet) {
      setNotice('Откройте Чертеж с рабочим листом');
      return false;
    }
    setSelectedEntityId(null);
    setLineDraft(EMPTY_DRAFT);
    setActiveCommand('draft.line');
    setPanel('parameters');
    setNotice('Отрезок: укажите первую точку');
    return true;
  }, [setNotice, setPanel, sheet]);

  const moveLinePoint = useCallback((point: CadPoint2) => {
    setLineDraft((current) => current.from ? { from: current.from, to: point } : current);
  }, []);

  const commitLine = useCallback(async (to: CadPoint2) => {
    if (!sheet || !lineDraft.from || committing) return false;
    const from = lineDraft.from;
    if (distance(from, to) <= MIN_LINE_LENGTH) {
      setNotice('Конечная точка должна отличаться от начальной');
      return false;
    }
    setCommitting(true);
    const result = await app.execute({
      id: 'drawing.line.create',
      payload: { sheetId: sheet.id, from, to },
    });
    setCommitting(false);
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось создать отрезок');
      return false;
    }
    const id = result.createdIds?.[0] as CadDraftEntityId | undefined;
    setLineDraft(EMPTY_DRAFT);
    setActiveCommand(null);
    if (id) setSelectedEntityId(id);
    setPanel('tree');
    setNotice(`Отрезок создан: ${formatLength(distance(from, to))} мм`);
    return true;
  }, [app, committing, lineDraft.from, setNotice, setPanel, sheet]);

  const linePoint = useCallback(async (point: CadPoint2) => {
    if (activeCommand !== 'draft.line' || committing) return;
    if (!lineDraft.from) {
      setLineDraft({ from: point, to: point });
      setNotice('Отрезок: укажите вторую точку');
      return;
    }
    await commitLine(point);
  }, [activeCommand, commitLine, committing, lineDraft.from, setNotice]);

  const selectEntity = useCallback((id: CadDraftEntityId) => {
    if (!sheet || activeCommand) return;
    const entity = sheet.entities.find((item) => item.id === id);
    if (!entity || entity.type !== 'line') return;
    setSelectedEntityId(id);
    setLineEdit({ from: [...entity.from], to: [...entity.to] });
    setActiveCommand('draft.line.update');
    setPanel('parameters');
    setNotice(`Выбран отрезок: ${formatLength(distance(entity.from, entity.to))} мм`);
  }, [activeCommand, setNotice, setPanel, sheet]);

  const updateEditPoint = useCallback((end: 'from' | 'to', axis: 0 | 1, value: number) => {
    setLineEdit((current) => {
      const point = [...current[end]] as [number, number];
      point[axis] = value;
      return { ...current, [end]: point };
    });
  }, []);

  const setLineLength = useCallback((value: number) => {
    if (!Number.isFinite(value) || value <= MIN_LINE_LENGTH) return;
    setLineEdit((current) => {
      const currentLength = distance(current.from, current.to);
      if (currentLength <= MIN_LINE_LENGTH) return current;
      const scale = value / currentLength;
      return {
        from: current.from,
        to: [
          current.from[0] + (current.to[0] - current.from[0]) * scale,
          current.from[1] + (current.to[1] - current.from[1]) * scale,
        ],
      };
    });
  }, []);

  const commitEdit = useCallback(async () => {
    if (!sheet || !selectedEntityId || committing) return false;
    if (![...lineEdit.from, ...lineEdit.to].every(Number.isFinite)) {
      setNotice('Координаты отрезка должны быть числами');
      return false;
    }
    if (distance(lineEdit.from, lineEdit.to) <= MIN_LINE_LENGTH) {
      setNotice('Длина отрезка должна быть больше 0');
      return false;
    }
    setCommitting(true);
    const result = await app.execute({
      id: 'drawing.line.update',
      payload: { sheetId: sheet.id, entityId: selectedEntityId, from: lineEdit.from, to: lineEdit.to },
    });
    setCommitting(false);
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось изменить отрезок');
      return false;
    }
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Отрезок изменен: ${formatLength(distance(lineEdit.from, lineEdit.to))} мм`);
    return true;
  }, [app, committing, lineEdit, selectedEntityId, setNotice, setPanel, sheet]);

  const deleteSelectedEntity = useCallback(async () => {
    if (!sheet || !selectedEntityId) return false;
    const result = await app.execute({
      id: 'drawing.entity.delete',
      payload: { sheetId: sheet.id, entityId: selectedEntityId },
    });
    if (!result.ok) {
      setNotice(result.error?.message ?? 'Не удалось удалить элемент');
      return false;
    }
    setSelectedEntityId(null);
    setActiveCommand(null);
    setLineEdit(EMPTY_EDIT);
    setPanel('tree');
    setNotice('Элемент чертежа удален');
    return true;
  }, [app, selectedEntityId, setNotice, setPanel, sheet]);

  const cancelCommand = useCallback(() => {
    setLineDraft(EMPTY_DRAFT);
    setActiveCommand(null);
    setCommitting(false);
    if (selectedLine) {
      setLineEdit({ from: [...selectedLine.from], to: [...selectedLine.to] });
    } else {
      setSelectedEntityId(null);
      setLineEdit(EMPTY_EDIT);
    }
    setPanel(selectedLine ? 'tree' : 'tree');
    setNotice('Команда отменена');
  }, [selectedLine, setNotice, setPanel]);

  const clearSelection = useCallback(() => {
    if (activeCommand) {
      cancelCommand();
      return;
    }
    setSelectedEntityId(null);
    setLineEdit(EMPTY_EDIT);
    setNotice('Выбор очищен');
  }, [activeCommand, cancelCommand, setNotice]);

  async function commitActiveCommand() {
    if (activeCommand === 'draft.line.update') return commitEdit();
    if (activeCommand === 'draft.line' && lineDraft.to) return commitLine(lineDraft.to);
    return false;
  }

  return {
    drawing,
    sheet,
    activeCommand,
    selectedEntityId,
    selectedLine,
    lineDraft,
    lineEdit,
    committing,
    canLine: Boolean(sheet),
    hasSelection: Boolean(selectedEntityId),
    beginLine,
    moveLinePoint,
    linePoint,
    selectEntity,
    updateEditPoint,
    setLineLength,
    commitEdit,
    deleteSelectedEntity,
    cancelCommand,
    clearSelection,
    resetTransient,
    commitActiveCommand,
  };
}

export type DrawingWorkspace = ReturnType<typeof useDrawingWorkspace>;

export function drawingLineLength(line: Pick<CadDraftLineEntity, 'from' | 'to'>): number {
  return distance(line.from, line.to);
}

function distance(a: readonly [number, number], b: readonly [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function formatLength(value: number): string {
  return Number(value.toFixed(3)).toString();
}
