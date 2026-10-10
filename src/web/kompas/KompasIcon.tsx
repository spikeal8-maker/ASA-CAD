import React from 'react';
import { KOMPAS_LINE_ICONS } from './kompasLineIcons';
import { KOMPAS_SOLID_ICONS } from './kompasSolidIcons';

/* Префиксы частей значка: F — заливка цветом значка, D — пунктир; объёмные значки:
   f — передняя грань, t — верхняя (светлая), s — боковая (тёмная), k — отверстие/полость,
   a — элемент операции (акцент), p — полупрозрачная плоскость, A — линия-акцент, B — пунктир-акцент. */
const SOLID_PARTS = 'ftskapAB';

function part(kind: string, d: string, key: number): React.ReactElement {
  switch (kind) {
    case 'F': return <path key={key} d={d} fill="currentColor" stroke="none" />;
    case 'D': return <path key={key} d={d} strokeDasharray="2.2 2" />;
    case 'f': return <path key={key} d={d} fill="var(--k-sf-front)" />;
    case 't': return <path key={key} d={d} fill="var(--k-sf-top)" />;
    case 's': return <path key={key} d={d} fill="var(--k-sf-side)" />;
    case 'k': return <path key={key} d={d} fill="var(--k-sf-dark)" />;
    case 'a': return <path key={key} d={d} fill="var(--k-sf-acc)" />;
    case 'p': return <path key={key} d={d} fill="var(--k-sf-acc)" fillOpacity=".28" stroke="var(--k-sf-acc)" />;
    case 'A': return <path key={key} d={d} fill="none" stroke="var(--k-sf-acc)" strokeWidth="1.9" />;
    default: return <path key={key} d={d} fill="none" stroke="var(--k-sf-acc)" strokeDasharray="2 1.6" strokeWidth="1.3" />;
  }
}

/** Icon of the KOMPAS shell: own vector drawings of the frozen reference, never KOMPAS artwork. */
export function KIcon(props: { name: string; size?: number; className?: string }) {
  const parts = KOMPAS_SOLID_ICONS[props.name] ?? KOMPAS_LINE_ICONS[props.name] ?? KOMPAS_LINE_ICONS.ts_generic ?? [];
  let solid = false;
  const children = parts.map((value, index) => {
    const match = /^([FDftskapAB]):/.exec(value);
    if (!match) return <path key={index} d={value} />;
    if (SOLID_PARTS.includes(match[1]!)) solid = true;
    return part(match[1]!, value.slice(2), index);
  });
  const size = props.size ?? 16;
  return (
    <svg
      className={`k-ic${props.className ? ` ${props.className}` : ''}${solid ? ' k-ic-solid' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={solid ? 'var(--k-sf-line)' : 'currentColor'}
      strokeWidth={solid ? 1.15 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
