import React from 'react';

export type CadIconName =
  | 'search' | 'open' | 'save' | 'undo' | 'redo' | 'settings' | 'new' | 'close'
  | 'part' | 'assembly' | 'drawing' | 'text' | 'tree' | 'parameters' | 'variables' | 'library'
  | 'fit' | 'view' | 'accept' | 'cancel' | 'sketch' | 'line' | 'rectangle' | 'circle' | 'arc'
  | 'construction' | 'horizontal' | 'vertical' | 'fixed' | 'coincident' | 'parallel'
  | 'perpendicular' | 'tangent' | 'concentric' | 'equal' | 'symmetric' | 'point'
  | 'dimension' | 'diameter' | 'radius' | 'angle' | 'extrude' | 'cut' | 'fillet'
  | 'rebuild' | 'info' | 'origin' | 'plane' | 'feature' | 'body' | 'chevron';

export function CadIcon(props: { name: CadIconName; size?: number; className?: string }) {
  const size = props.size ?? 18;
  return (
    <svg
      className={`cad-icon${props.className ? ` ${props.className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {geometry(props.name)}
    </svg>
  );
}

function geometry(name: CadIconName): React.ReactNode {
  switch (name) {
    case 'search': return <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>;
    case 'open': return <><path d="M3.5 7.5h6l2-2h3.5a2 2 0 0 1 2 2v1" /><path d="m4 9.5 16 0-3 9H6z" /></>;
    case 'save': return <><path d="M5 3.5h12l2 2v15H5z" /><path d="M8 3.5v6h7v-6M8 20.5v-7h8v7" /></>;
    case 'undo': return <><path d="m9 7-4 4 4 4" /><path d="M6 11h7a5 5 0 0 1 5 5" /></>;
    case 'redo': return <><path d="m15 7 4 4-4 4" /><path d="M18 11h-7a5 5 0 0 0-5 5" /></>;
    case 'settings': return <><circle cx="12" cy="12" r="3.2" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>;
    case 'new': return <path d="M12 5v14M5 12h14" />;
    case 'close':
    case 'cancel': return <path d="m6 6 12 12M18 6 6 18" />;
    case 'part': return <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>;
    case 'assembly': return <><circle cx="7" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><circle cx="12" cy="17" r="3" /><path d="m9.5 10 1.5 4M14.5 10 13 14M10 8h4" /></>;
    case 'drawing': return <><rect x="4" y="3.5" width="16" height="17" rx="1" /><path d="M7 8h10M7 12h7M7 16h5" /></>;
    case 'text': return <><path d="M5 5h14M12 5v14M8 19h8" /></>;
    case 'tree': return <><path d="M7 5v14M7 8h5M7 15h5" /><circle cx="15" cy="8" r="2" /><circle cx="15" cy="15" r="2" /></>;
    case 'parameters': return <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" /></>;
    case 'variables': return <><path d="M8 19c3-5 3-10 5-14 1-2 3-2 4-1" /><path d="M6 10h9" /></>;
    case 'library': return <><rect x="4" y="4" width="4" height="16" /><rect x="10" y="4" width="4" height="16" /><path d="m16 5 3-1 2 15-3 1z" /></>;
    case 'fit': return <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />;
    case 'view': return <><path d="m12 4 7 4v8l-7 4-7-4V8z" /><path d="m5 8 7 4 7-4M12 12v8" /></>;
    case 'accept': return <path d="m5 12 4 4 10-10" />;
    case 'sketch': return <><path d="M4 18.5 8.5 17 18 7.5 16.5 6 7 15.5z" /><path d="M4 20h16" /></>;
    case 'line': return <path d="M5 18 19 6" />;
    case 'rectangle': return <rect x="4.5" y="6" width="15" height="12" />;
    case 'circle': return <circle cx="12" cy="12" r="7" />;
    case 'arc': return <path d="M5 16a8 8 0 0 1 14 0" />;
    case 'construction': return <path d="M4 12h3m2 0h3m2 0h3m2 0h1" />;
    case 'horizontal': return <path d="M4 12h16M6 9v6M18 9v6" />;
    case 'vertical': return <path d="M12 4v16M9 6h6M9 18h6" />;
    case 'fixed': return <><rect x="6" y="10" width="12" height="9" rx="1" /><path d="M9 10V8a3 3 0 0 1 6 0v2" /></>;
    case 'coincident': return <><circle cx="9" cy="12" r="4" /><circle cx="15" cy="12" r="4" /></>;
    case 'parallel': return <path d="m7 18 6-12M12 18l6-12" />;
    case 'perpendicular': return <path d="M6 6v12h12" />;
    case 'tangent': return <><circle cx="13" cy="12" r="5" /><path d="M4 17h14" /></>;
    case 'concentric': return <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /></>;
    case 'equal': return <><path d="M5 8h14M5 16h14" /><path d="m9 6 2 4M13 14l2 4" /></>;
    case 'symmetric': return <><path d="M12 3v18" strokeDasharray="2 2" /><path d="M5 8h4M15 8h4M5 16h4M15 16h4" /></>;
    case 'point': return <><path d="M4 17c4-8 8-10 16-10" /><circle cx="12" cy="10" r="2" fill="currentColor" stroke="none" /></>;
    case 'dimension': return <><path d="M5 7v10M19 7v10M5 12h14" /><path d="m8 10-3 2 3 2M16 10l3 2-3 2" /></>;
    case 'diameter': return <><circle cx="12" cy="12" r="7" /><path d="M6 18 18 6" /></>;
    case 'radius': return <><path d="M12 12 18 7" /><circle cx="12" cy="12" r="7" /></>;
    case 'angle': return <><path d="M5 18h14M5 18l9-12" /><path d="M10 18a5 5 0 0 1 1.6-3.7" /></>;
    case 'extrude': return <><rect x="4" y="8" width="9" height="10" /><path d="m13 8 5-3v10l-5 3M13 8l5-3M13 18l5-3" /></>;
    case 'cut': return <><path d="m4 9 8-4 8 4-8 4zM4 9v7l8 4 8-4V9" /><path d="M8 12h8" /></>;
    case 'fillet': return <><path d="M5 19V7h12" /><path d="M9 19c0-5 3-8 8-8" /></>;
    case 'rebuild': return <><path d="M18 8V4l-2 2a7 7 0 1 0 2 10" /><path d="M18 4h-4" /></>;
    case 'info': return <><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></>;
    case 'origin': return <><path d="M12 12 20 8M12 12v9M12 12 5 7" /><circle cx="12" cy="12" r="1.8" /></>;
    case 'plane': return <path d="m4 15 5-8h11l-5 8z" />;
    case 'feature': return <><path d="m12 4 7 4v8l-7 4-7-4V8z" /><path d="M12 8v8M8 12h8" /></>;
    case 'body': return <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />;
    case 'chevron': return <path d="m9 6 6 6-6 6" />;
  }
}
