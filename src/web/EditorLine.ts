import { useEditorMode } from './EditorMode';
import { useSketchLineTool as useKompasLine, type UseSketchLineToolOptions } from './useSketchLineTool';
import { useSketchLineTool as useFusionLine } from './fusion/LiveSketchLineTool';

/** Only the chosen gesture owner is active; both dispatch to the same CadApplication. */
export function useSketchLineTool(options: UseSketchLineToolOptions & { onCommitted(): void }) {
  const mode = useEditorMode();
  const kompas = useKompasLine({ ...options, active: options.active && mode === 'kompas' });
  const fusion = useFusionLine({ ...options, active: options.active && mode === 'fusion' });
  return mode === 'fusion' ? { ...fusion, input: kompas.input } : kompas;
}
