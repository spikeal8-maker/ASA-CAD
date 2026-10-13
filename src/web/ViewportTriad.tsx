import React from 'react';

type Vec3 = readonly [number, number, number];
interface TriadAxis { name: string; color: string; x: number; y: number; depth: number }

const AXES: ReadonlyArray<readonly [string, Vec3, string]> = [
  ['X', [1, 0, 0], '#d05a5a'],
  ['Y', [0, 1, 0], '#5fa61f'],
  ['Z', [0, 0, 1], '#2a77c9'],
];
const LENGTH = 30;

/**
 * KOMPAS axis triad in the lower-left corner of the graphics area. It reads the
 * camera pose the viewport already publishes on its host element, so it never
 * touches Three objects and cannot disagree with the picture.
 */
export function ViewportTriad() {
  const svg = React.useRef<SVGSVGElement>(null);
  const [axes, setAxes] = React.useState<readonly TriadAxis[]>([]);

  React.useEffect(() => {
    const host = svg.current?.parentElement?.querySelector<HTMLElement>('[data-testid="cad-viewport"]');
    if (!host) return;
    const read = () => {
      const position = parse(host.dataset.cameraPosition);
      const target = parse(host.dataset.cameraTarget);
      const up = parse(host.dataset.cameraUp);
      setAxes(position && target && up ? project(sub(position, target), up) : []);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(host, { attributes: true, attributeFilter: ['data-camera-position', 'data-camera-target', 'data-camera-up'] });
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={svg} className="viewport-triad" viewBox="-48 -48 96 96" aria-hidden="true" data-testid="viewport-triad">
      {axes.map((axis) => (
        <g key={axis.name} data-axis={axis.name}>
          <line x1="0" y1="0" x2={axis.x} y2={axis.y} stroke={axis.color} strokeWidth="3" strokeLinecap="round" />
          {Math.hypot(axis.x, axis.y) > 6 && (
            <text x={axis.x * 1.28} y={axis.y * 1.28 + 4} fill={axis.color} fontSize="11" textAnchor="middle">{axis.name}</text>
          )}
        </g>
      ))}
      <circle r="5" fill="#d8c040" stroke="#5c5320" strokeWidth="1" />
    </svg>
  );
}

/** Screen projection of the world axes for a camera looking from `back` (target → eye) with `up`. */
function project(back: Vec3, up: Vec3): TriadAxis[] {
  const z = normalize(back);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return AXES
    .map(([name, axis, color]) => ({ name, color, x: dot(axis, x) * LENGTH, y: -dot(axis, y) * LENGTH, depth: dot(axis, z) }))
    .sort((a, b) => a.depth - b.depth);
}

function parse(value: string | undefined): Vec3 | null {
  const parts = value?.split(',').map(Number);
  return parts?.length === 3 && parts.every(Number.isFinite) ? [parts[0]!, parts[1]!, parts[2]!] : null;
}
function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize(a: Vec3): Vec3 {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}
