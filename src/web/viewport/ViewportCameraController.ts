export type CadViewportViewName =
  | 'fit'
  | 'front'
  | 'back'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'isometric'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down';

export type ViewportVec3 = readonly [number, number, number];

export interface ViewportCameraState {
  position: ViewportVec3;
  target: ViewportVec3;
  up: ViewportVec3;
  fovDegrees: number;
  aspect: number;
  minDistance: number;
  maxDistance: number;
}

export interface ViewportCameraPose {
  position: ViewportVec3;
  target: ViewportVec3;
  up: ViewportVec3;
}

export interface ViewportCameraControllerOptions {
  center: ViewportVec3;
  diagonal: number;
  readState(): ViewportCameraState;
  applyPose(view: CadViewportViewName, pose: ViewportCameraPose): void;
}

/**
 * Three-independent camera/navigation owner. It translates ASA view commands
 * to an exact numeric pose; the viewport adapter is responsible only for
 * applying that pose to its concrete camera/OrbitControls implementation.
 */
export class ViewportCameraController {
  constructor(private readonly options: ViewportCameraControllerOptions) {}

  setView(view: CadViewportViewName): void {
    const state = this.options.readState();
    let offset = subtract(state.position, state.target);
    if (lengthSquared(offset) < 1e-10) offset = [1, -1, 1];

    if (view === 'zoom-in' || view === 'zoom-out') {
      const distance = clamp(
        length(offset) * (view === 'zoom-in' ? 0.82 : 1.22),
        state.minDistance,
        state.maxDistance,
      );
      const direction = normalize(offset);
      this.options.applyPose(view, {
        position: add(state.target, scale(direction, distance)),
        target: state.target,
        up: state.up,
      });
      return;
    }

    if (view.startsWith('pan-')) {
      const viewDirection = normalize(subtract(state.target, state.position));
      const screenRight = normalize(cross(viewDirection, state.up));
      const screenUp = normalize(cross(screenRight, viewDirection));
      const amount = Math.max(length(offset) * 0.06, this.options.diagonal * 0.01);
      let delta: ViewportVec3 = [0, 0, 0];
      if (view === 'pan-left') delta = scale(screenRight, -amount);
      if (view === 'pan-right') delta = scale(screenRight, amount);
      if (view === 'pan-up') delta = scale(screenUp, amount);
      if (view === 'pan-down') delta = scale(screenUp, -amount);
      this.options.applyPose(view, {
        position: add(state.position, delta),
        target: add(state.target, delta),
        up: state.up,
      });
      return;
    }

    const currentDirection = normalize(offset);
    let direction = currentDirection;
    let up = state.up;
    if (view === 'front') { direction = [0, -1, 0]; up = [0, 0, 1]; }
    if (view === 'back') { direction = [0, 1, 0]; up = [0, 0, 1]; }
    if (view === 'top') { direction = [0, 0, 1]; up = [0, 1, 0]; }
    if (view === 'bottom') { direction = [0, 0, -1]; up = [0, -1, 0]; }
    if (view === 'left') { direction = [-1, 0, 0]; up = [0, 0, 1]; }
    if (view === 'right') { direction = [1, 0, 0]; up = [0, 0, 1]; }
    if (view === 'isometric') { direction = normalize([1, -1, 1]); up = [0, 0, 1]; }

    const distance = fitDistance(state, this.options.diagonal);
    this.options.applyPose(view, {
      position: add(this.options.center, scale(direction, distance)),
      target: this.options.center,
      up,
    });
  }
}

export function fitDistance(state: ViewportCameraState, diagonal: number): number {
  const radius = diagonal / 2;
  const verticalFov = degreesToRadians(state.fovDegrees);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(state.aspect, 0.01));
  const limitingFov = Math.max(Math.min(verticalFov, horizontalFov), degreesToRadians(5));
  return Math.min(
    Math.max(radius / Math.sin(limitingFov / 2) * 1.16, state.minDistance * 2),
    state.maxDistance * 0.95,
  );
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function add(a: ViewportVec3, b: ViewportVec3): ViewportVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a: ViewportVec3, b: ViewportVec3): ViewportVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(value: ViewportVec3, factor: number): ViewportVec3 {
  return [value[0] * factor, value[1] * factor, value[2] * factor];
}

function lengthSquared(value: ViewportVec3): number {
  return value[0] * value[0] + value[1] * value[1] + value[2] * value[2];
}

function length(value: ViewportVec3): number {
  return Math.sqrt(lengthSquared(value));
}

function normalize(value: ViewportVec3): ViewportVec3 {
  const magnitude = length(value);
  return magnitude < 1e-12 ? [0, 0, 0] : scale(value, 1 / magnitude);
}

function cross(a: ViewportVec3, b: ViewportVec3): ViewportVec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
