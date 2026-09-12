import React, { createContext, useContext } from 'react';
import {
  DEFAULT_SKETCH_VIEWPORT_STATE,
  sketchDisplayFrame,
  type SketchDisplayFrame,
} from './SketchViewportGeometry';

const DEFAULT_FRAME = sketchDisplayFrame(DEFAULT_SKETCH_VIEWPORT_STATE);
const SketchViewportFrameContext = createContext<SketchDisplayFrame>(DEFAULT_FRAME);

export interface SketchViewportFrameProviderProps {
  frame: SketchDisplayFrame;
  children: React.ReactNode;
}

/** Sketch-only presentation context. B-Rep CadRenderModel/Three never depends on it. */
export function SketchViewportFrameProvider({ frame, children }: SketchViewportFrameProviderProps) {
  return (
    <SketchViewportFrameContext.Provider value={frame}>
      {children}
    </SketchViewportFrameContext.Provider>
  );
}

export function useSketchViewportFrame(): SketchDisplayFrame {
  return useContext(SketchViewportFrameContext);
}
