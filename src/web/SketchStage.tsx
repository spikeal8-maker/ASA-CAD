import { useEditorMode } from './EditorMode';
import { SketchEditingStage as KompasStage, type SketchEditingStageProps } from './SketchEditingStage';
import { SketchEditingStage as FusionStage } from './fusion/LiveSketchStage';
export type { SketchEditingStageProps };

export function SketchEditingStage(props: SketchEditingStageProps) {
  return useEditorMode() === 'fusion' ? <FusionStage {...props} /> : <KompasStage {...props} />;
}
