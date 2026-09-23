import {useState,type Dispatch,type SetStateAction} from 'react';
import type {CadApplication} from '../contracts/application';
import type {CadSketch} from '../contracts/document';
import type {CadSketchEntityId,CadSketchId} from '../contracts/ids';
import type {CadWorkspacePanel} from './PartSketchWorkspaceTypes';
import {findSketch,partDocument} from './PartSketchWorkspaceModel';
import {useSketchLineTool} from './useSketchLineTool';
import {useSketchCircleTool} from './useSketchCircleTool';
import {useSketchArcTool} from './useSketchArcTool';
import {useSketchRectangleTool} from './useSketchRectangleTool';

export interface SketchEditingControllerOptions {
  app: CadApplication; activeSketchId: CadSketchId | null; sketch: Readonly<CadSketch> | null;
  activeCommand: string | null; setActiveCommand: Dispatch<SetStateAction<string | null>>;
  setActiveWorkspace: Dispatch<SetStateAction<string>>; setPanel(panel: CadWorkspacePanel): void;
  setNotice(message: string): void; clearTransientSelection(): void; finishSession(): void;
}

export function useSketchEditingController(options: SketchEditingControllerOptions) {
  const {
    app,activeSketchId,sketch,activeCommand,setActiveCommand,
    setActiveWorkspace,setPanel,setNotice,clearTransientSelection,finishSession,
  } = options;
  const [rectangleWidth,setRectangleWidth]=useState(60);
  const [rectangleHeight,setRectangleHeight]=useState(40);
  const [circleDiameter,setCircleDiameter]=useState(12);

  const onToolCommitted = () => {
    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('sketch');
    clearTransientSelection();
  };

  const lineTool = useSketchLineTool({
    app, sketchId: activeSketchId, active: activeCommand === 'sketch.line',
    setNotice, onCommitted: onToolCommitted,
  });
  const rectangleTool = useSketchRectangleTool({
    app, sketchId: activeSketchId, active: activeCommand === 'sketch.rectangle', setNotice,
    onCommitted: (width, height) => {
      setRectangleWidth(width);
      setRectangleHeight(height);
      onToolCommitted();
    },
  });
  const circleTool = useSketchCircleTool({
    app, sketchId: activeSketchId, active: activeCommand === 'sketch.circle', setNotice,
    onCommitted: (diameter) => {
      setCircleDiameter(diameter);
      onToolCommitted();
    },
  });
  const arcTool = useSketchArcTool({
    app, sketchId: activeSketchId, active: activeCommand === 'sketch.arc',
    setNotice, onCommitted: onToolCommitted,
  });

  function beginLine() {
    if (!sketch) return;
    lineTool.reset();
    setActiveCommand('sketch.line');
    setPanel('closed');
    clearTransientSelection();
    setNotice('Укажите начальную точку отрезка');
  }

  function beginRectangle() {
    if (!sketch) return;
    rectangleTool.reset();
    setActiveCommand('sketch.rectangle');
    setPanel('closed');
    clearTransientSelection();
    setNotice('Укажите первый угол прямоугольника');
  }

  async function commitRectangle() {
    const currentSketch = findSketch(partDocument(app.getDocument()), activeSketchId);
    if (!currentSketch) { setNotice('Сначала создайте эскиз'); return; }
    if (!(rectangleWidth > 0) || !(rectangleHeight > 0)) {
      setNotice('Размеры прямоугольника должны быть больше нуля');
      return;
    }
    const rectangle = await app.execute({
      id: 'sketch.rectangle',
      payload: {
        sketchId: currentSketch.id,
        origin: [-rectangleWidth / 2, -rectangleHeight / 2],
        width: rectangleWidth,
        height: rectangleHeight,
      },
    });
    if (!rectangle.ok || !rectangle.createdIds || rectangle.createdIds.length < 2) {
      setNotice(rectangle.error?.message ?? 'Не удалось создать прямоугольник');
      return;
    }
    const edges = rectangle.createdIds as CadSketchEntityId[];
    const widthDimension = await app.execute({
      id: 'dimension.linear',
      payload: { sketchId: currentSketch.id, entityIds: [edges[0]], value: rectangleWidth, name: 'width' },
    });
    const heightDimension = await app.execute({
      id: 'dimension.linear',
      payload: { sketchId: currentSketch.id, entityIds: [edges[1]], value: rectangleHeight, name: 'height' },
    });
    if (!widthDimension.ok || !heightDimension.ok) {
      setNotice(widthDimension.error?.message ?? heightDimension.error?.message ?? 'Не удалось создать размеры');
      return;
    }
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Прямоугольник ${rectangleWidth}×${rectangleHeight} мм создан`);
  }

  function beginCircle() {
    if (!sketch) return;
    circleTool.reset();
    setActiveCommand('sketch.circle');
    setPanel('closed');
    clearTransientSelection();
    setNotice('Укажите центр окружности');
  }

  function beginArc() {
    if (!sketch) return;
    arcTool.reset();
    setActiveCommand('sketch.arc');
    setPanel('closed');
    clearTransientSelection();
    setNotice('Укажите центр дуги');
  }

  async function commitCircle() {
    const currentSketch = findSketch(partDocument(app.getDocument()), activeSketchId);
    if (!currentSketch) { setNotice('Сначала создайте эскиз'); return; }
    if (!(circleDiameter > 0)) { setNotice('Диаметр должен быть больше нуля'); return; }
    const circle = await app.execute({
      id: 'sketch.circle',
      payload: { sketchId: currentSketch.id, center: [0, 0], diameter: circleDiameter },
    });
    if (!circle.ok || !circle.createdIds?.[0]) {
      setNotice(circle.error?.message ?? 'Не удалось создать окружность');
      return;
    }
    const diameter = await app.execute({
      id: 'dimension.diameter',
      payload: {
        sketchId: currentSketch.id,
        entityId: circle.createdIds[0] as CadSketchEntityId,
        value: circleDiameter,
        name: 'diameter',
      },
    });
    if (!diameter.ok) {
      setNotice(diameter.error?.message ?? 'Не удалось создать диаметральный размер');
      return;
    }
    setActiveCommand(null);
    setPanel('tree');
    setNotice(`Окружность Ø${circleDiameter} мм создана`);
  }

  async function finishSketch() {
    const currentSketch = findSketch(partDocument(app.getDocument()), activeSketchId);
    if (!currentSketch) return;
    const result = await app.execute({ id: 'sketch.finish', payload: { sketchId: currentSketch.id } });
    if (!result.ok) { setNotice(result.error?.message ?? 'Не удалось завершить эскиз'); return; }
    setActiveCommand(null);
    setPanel('tree');
    setActiveWorkspace('solid');
    clearTransientSelection();
    finishSession();
    setNotice('Эскиз завершен');
  }

  function resetActiveTool(command: string | null) {
    if (command === 'sketch.line') lineTool.reset();
    if (command === 'sketch.rectangle') rectangleTool.reset();
    if (command === 'sketch.circle') circleTool.reset();
    if (command === 'sketch.arc') arcTool.reset();
  }

  return {
    rectangleWidth,setRectangleWidth,rectangleHeight,setRectangleHeight,
    circleDiameter,setCircleDiameter,beginLine,
    lineDraft:lineTool.draft,lineCommitting: lineTool.committing,
    handleSketchLinePointMove: lineTool.move, handleSketchLinePoint: lineTool.point,
    beginRectangle,commitRectangle,
    rectangleDraft: rectangleTool.draft, rectangleCommitting: rectangleTool.committing,
    handleSketchRectanglePointMove: rectangleTool.move, handleSketchRectanglePoint: rectangleTool.point,
    beginCircle, commitCircle,
    circleDraft: circleTool.draft, circleCommitting: circleTool.committing,
    handleSketchCirclePointMove: circleTool.move, handleSketchCirclePoint: circleTool.point,
    beginArc, arcDraft: arcTool.draft, arcCommitting: arcTool.committing,
    handleSketchArcPointMove: arcTool.move, handleSketchArcPoint: arcTool.point,
    finishSketch, resetActiveTool,
    commitLinePreview: lineTool.commitPreview,
    commitRectanglePreview: rectangleTool.commitPreview,
    commitCirclePreview: circleTool.commitPreview,
    commitArcPreview: arcTool.commitPreview,
    hasRectangleDraft: Boolean(rectangleTool.draft.first),
    hasCircleDraft: Boolean(circleTool.draft.center),
  };
}
