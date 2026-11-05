import { useSyncExternalStore } from 'react';
import type { CadDimensionId, CadSketchId } from '../../../src/contracts/ids';
import type { SketchViewportState } from '../../../src/web/viewport/SketchViewportGeometry';

/** Prototype presentation only. The document, solver and editing commands stay in App. */
export type SketchDisplayOption = 'grid' | 'snap' | 'points' | 'profiles' | 'dimensions' | 'constraints';
export type SketchViewCommand = 'look-at' | 'fit' | 'zoom-in' | 'zoom-out' | 'reset';
export interface ActiveSketchView {
  id: CadSketchId;
  name: string;
  support: string;
  supportLabel: string;
  planeLabel: string;
  projection: 'origin-plane' | 'stable-reference';
  modelContextReady: boolean;
  entityCount: number;
  dimensionCount: number;
  constraintCount: number;
}
export interface SketchViewSnapshot {
  settings: Readonly<Record<SketchDisplayOption, boolean>>;
  active: Readonly<ActiveSketchView> | null;
  viewport: Readonly<SketchViewportState> | null;
  panMode: boolean;
  navigationReady: boolean;
  dimensionEditReady: boolean;
  capabilities: Readonly<Record<SketchDisplayOption, boolean> & {
    lookAt: boolean; fit: boolean; zoom: boolean; pan: boolean; orbit: false;
  }>;
  unavailable: Readonly<Partial<Record<SketchDisplayOption, string>>>;
  orbitUnavailableReason: string;
  snapScope: string;
}

let snapshot: SketchViewSnapshot = {
  settings: { grid: true, snap: true, points: true, profiles: true, dimensions: true, constraints: true },
  active: null,
  viewport: null,
  panMode: false,
  navigationReady: false,
  dimensionEditReady: false,
  capabilities: { grid: true, snap: true, points: true, profiles: true, dimensions: true, constraints: true,
    lookAt: true, fit: true, zoom: true, pan: true, orbit: false },
  unavailable: {},
  orbitUnavailableReason: 'Эскиз отображается в собственной 2D-плоскости. Для вращения нужен общий мост камеры и проекции выбора; плоскости граней пока не разрешены в origin/u/v/normal.',
  snapScope: 'При построении линии, прямоугольника, окружности и дуги: концы, центры и узлы сетки. Привязка не добавляет геометрические ограничения.',
};
const listeners = new Set<() => void>();
function update(patch: Partial<SketchViewSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach(listener => listener());
}
export function getSketchViewState(): SketchViewSnapshot { return snapshot; }
export function subscribeSketchView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Root palette: const {settings, unavailable, active} = useSketchView(). */
export function useSketchView(): SketchViewSnapshot {
  return useSyncExternalStore(subscribeSketchView, getSketchViewState, getSketchViewState);
}
export const useSketchViewState = useSketchView;
let workspaceExit: (() => void) | null = null;
/** The existing shell setter is invoked after cancelling an orphaned tool. */
export function registerSketchWorkspaceExit(handler: () => void): () => void {
  workspaceExit = handler;
  return () => { if (workspaceExit === handler) workspaceExit = null; };
}
export function requestSketchWorkspaceExit(): boolean {
  if (!workspaceExit) return false;
  workspaceExit();
  return true;
}
export function toggleSketchDisplay(option: SketchDisplayOption): void {
  if (!snapshot.capabilities[option]) return;
  update({ settings: { ...snapshot.settings, [option]: !snapshot.settings[option] } });
}
export function setSketchDisplay(option: SketchDisplayOption, visible: boolean): void {
  if (!snapshot.capabilities[option] || snapshot.settings[option] === visible) return;
  update({ settings: { ...snapshot.settings, [option]: visible } });
}
export function setSketchPanMode(enabled: boolean): void {
  if (snapshot.panMode !== enabled) update({ panMode: enabled });
}

let navigation: ((command: SketchViewCommand) => void) | null = null;
/** Root navigation: requestSketchView('fit' | 'look-at' | 'zoom-in' | 'zoom-out' | 'reset'). */
export function requestSketchView(command: SketchViewCommand): boolean {
  if (!navigation) return false;
  navigation(command);
  return true;
}
export function registerSketchNavigation(handler: (command: SketchViewCommand) => void): () => void {
  navigation = handler;
  update({ navigationReady: true });
  return () => {
    if (navigation !== handler) return;
    navigation = null;
    // The stage owns this publication; Solid must not retain its last sketch view.
    update({ navigationReady: false, active: null, viewport: null, panMode: false });
  };
}
export function publishSketchView(active: ActiveSketchView, viewport: SketchViewportState): void {
  update({ active, viewport });
}

let dimensionEditor: ((id: CadDimensionId) => void) | null = null;
/** Root bridge in an effect: return registerSketchDimensionEditor(tree.onEditDimension). */
export function registerSketchDimensionEditor(handler: (id: CadDimensionId) => void): () => void {
  dimensionEditor = handler;
  update({ dimensionEditReady: true });
  return () => {
    if (dimensionEditor !== handler) return;
    dimensionEditor = null;
    update({ dimensionEditReady: false });
  };
}
export function editSketchDimension(id: CadDimensionId): boolean {
  if (!dimensionEditor) return false;
  dimensionEditor(id);
  return true;
}

export const sketchViewActions = {
  toggle: toggleSketchDisplay,
  set: setSketchDisplay,
  request: requestSketchView,
  setPanMode: setSketchPanMode,
};
