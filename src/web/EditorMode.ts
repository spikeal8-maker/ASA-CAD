import { createContext, useContext } from 'react';
import type { CadEditorMode } from '../browser/editorModes';

export const EditorModeContext = createContext<CadEditorMode>('kompas');
export const useEditorMode = (): CadEditorMode => useContext(EditorModeContext);
