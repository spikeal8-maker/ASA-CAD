import React, { useId } from 'react';
import type { LauncherModeId } from './LauncherPage';

/** Original vector illustrations; no editor state or geometry runtime. */
export function LauncherArt({ mode }: { mode: LauncherModeId }) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  return (
    <svg className="asa-launcher-model-art" viewBox="0 0 420 260" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-blue`} x1="128" y1="65" x2="300" y2="196" gradientUnits="userSpaceOnUse"><stop stopColor="#CBEAF7" /><stop offset="1" stopColor="#74AED0" /></linearGradient>
        <linearGradient id={`${id}-amber`} x1="120" y1="70" x2="290" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#FFE4AA" /><stop offset="1" stopColor="#E8AA40" /></linearGradient>
        <linearGradient id={`${id}-cylinder`} x1="219" y1="144" x2="290" y2="144" gradientUnits="userSpaceOnUse"><stop stopColor="#E39724" /><stop offset=".5" stopColor="#F6BC55" /><stop offset="1" stopColor="#D88818" /></linearGradient>
        <radialGradient id={`${id}-sphere`} cx=".3" cy=".25" r=".8"><stop stopColor="#B2D8F3" /><stop offset=".6" stopColor="#5598C9" /><stop offset="1" stopColor="#25628C" /></radialGradient>
        <clipPath id={`${id}-hole`}><ellipse cx="216" cy="124" rx="32" ry="16" /></clipPath>
      </defs>
      <g stroke="currentColor" strokeWidth=".7" opacity=".12">
        <path d="m30 164 169-86 190 98M51 178l169-86M75 191l169-86M99 204l169-86M123 216l169-86M147 229l169-86M65 146l190 98M89 134l190 98M113 122l190 98M137 110l190 98M161 98l190 98M185 86l190 98" />
        <path d="M34 164 224 262M199 78l190 98" opacity=".5" />
      </g>
      {mode === 'kompas' && <>
        <ellipse cx="216" cy="197" rx="114" ry="21" fill="#2C6188" opacity=".09" />
        <path d="m100 117 107 60v24l-107-60Z" fill="#5C99BE" stroke="#397CA8" />
        <path d="m207 177 125-64v24l-125 64Z" fill="#2D74A2" stroke="#397CA8" />
        <path d="m100 117 124-60 108 56-125 64Z" fill={paint('blue')} stroke="#5493B8" strokeWidth="1.3" />
        <path d="m106 118 118-57 102 53-119 60Z" stroke="white" strokeOpacity=".55" />
        <ellipse cx="216" cy="124" rx="32" ry="16" fill="#28658D" stroke="#397FA9" />
        <g clipPath={paint('hole')}><ellipse cx="216" cy="134" rx="27" ry="13" fill="#E8F4F9" /><path d="M184 124v18M248 124v18" stroke="#17496D" strokeWidth="4" /></g>
        <ellipse cx="216" cy="124" rx="33" ry="17" stroke="#EAF7FE" strokeWidth="1.5" />
        <g fill="#3779A1" stroke="#C9E8F5" strokeWidth="1.2"><ellipse cx="143" cy="119" rx="8" ry="4" /><ellipse cx="223" cy="80" rx="8" ry="4" /><ellipse cx="289" cy="114" rx="8" ry="4" /><ellipse cx="208" cy="156" rx="8" ry="4" /></g>
        <g stroke="#4A839F" strokeWidth="1" strokeLinecap="round" opacity=".7"><path d="m94 149-12 12m125 46-12 12M84 163l108 55m-106-60-2 6 6-1m97 49 5 6-7-1M337 143l12 9m-135 58 12 8m3-2 118-61m-6-1 6 1-1 6m-111 49-6 6 7-1" /><path d="m216 101 25-33h36" strokeDasharray="3 3" /></g>
        <g fill="#4E7A95" fontSize="10" fontFamily="'Segoe UI',sans-serif"><text x="126" y="202" transform="rotate(27 126 202)">60</text><text x="281" y="194" transform="rotate(-27 281 194)">40</text><text x="263" y="64">Ø14</text></g>
      </>}
      {mode === 'fusion' && <>
        <ellipse cx="219" cy="217" rx="111" ry="19" fill="#8E671E" opacity=".09" />
        <path d="m104 157 118 60v15l-118-60Z" fill="#D39435" stroke="#C28A32" />
        <path d="m222 217 105-54v15l-105 54Z" fill="#B97720" stroke="#C28A32" />
        <path d="m104 157 104-53 119 59-105 54Z" fill={paint('amber')} stroke="#D3A14F" strokeWidth="1.2" />
        <path d="m119 157 89-45 103 51-89 46Z" stroke="#FFE5AE" />
        <path d="m104 157 104-53V68c0-21-11-28-28-20l-55 28c-16 8-21 14-21 30Z" fill={paint('amber')} stroke="#CB9B4B" strokeWidth="1.2" />
        <path d="m208 104 14 7V76c0-23-12-33-29-28l-13 0c17-8 28-1 28 20Z" fill="#D89B3B" stroke="#CB9B4B" strokeWidth="1.1" />
        <path d="m109 153 94-47V68c0-17-8-21-22-15l-54 28c-13 7-18 12-18 26Z" stroke="#FFEFD0" strokeOpacity=".85" />
        <path d="M141 108c0-14 7-27 17-32 10-5 18 0 18 13s-8 27-18 32c-10 5-17 0-17-13Z" fill="#99601D" stroke="#FCE0A5" strokeWidth="2" />
        <path d="M149 113c0-14 7-26 17-31 3-2 6-2 9-2 5 13-4 34-17 41-3 1-6 2-8 1Z" fill="#F8F1DF" />
        <path d="M137 169c12-6 26-11 40-18s24-12 33-21" stroke="#C18830" strokeWidth="6" strokeLinecap="round" opacity=".35" />
        <ellipse cx="245" cy="162" rx="14" ry="7" fill="#BB812C" stroke="#FDE5B6" strokeWidth="1.5" />
        <ellipse cx="205" cy="183" rx="14" ry="7" fill="#BB812C" stroke="#FDE5B6" strokeWidth="1.5" />
        <g stroke="#B38A43" strokeWidth="1" opacity=".55"><path d="M157 54v91M126 117l62-32M223 162h50m-28-15v30" strokeDasharray="4 4" /><path d="m83 108-7-3v66l18 9m-22-70 4-5 4 8m-8 51 4 7 4-4" /></g>
        <text x="67" y="145" fill="#9E7838" fontSize="10" fontFamily="'Segoe UI',sans-serif">40</text>
      </>}
      {mode === 'blocks3d' && <>
        <ellipse cx="212" cy="211" rx="126" ry="22" fill="#43708A" opacity=".08" />
        <path d="m88 136 57 29v55l-57-29Z" fill="#0AA4C8" stroke="#0787AC" />
        <path d="m145 165 57-29v55l-57 29Z" fill="#087FA7" stroke="#08779B" />
        <path d="m88 136 57-29 57 29-57 29Z" fill="#4BD1E5" stroke="#19ACCB" />
        <path d="m94 136 51-26 51 26-51 26Z" stroke="#9EE8F2" strokeWidth="1.2" />
        <path d="M219 108v63c0 10 16 18 36 18s36-8 36-18v-63Z" fill={paint('cylinder')} stroke="#D2922C" />
        <ellipse cx="255" cy="108" rx="36" ry="18" fill="#FAD17B" stroke="#DDA745" />
        <ellipse cx="255" cy="106" rx="31" ry="14" stroke="#FFE6AC" />
        <path d="M224 115v52" stroke="#FFD788" strokeWidth="1.5" opacity=".65" />
        <circle cx="300" cy="189" r="32" fill={paint('sphere')} />
        <path d="M281 180c0-8 7-15 14-17" stroke="#E0F0FB" strokeWidth="2.3" strokeLinecap="round" opacity=".7" />
        <path d="m145 96 20-10 20 10-20 10Z" stroke="#16A4BD" strokeDasharray="3 3" opacity=".45" />
        <path d="M165 106v18m70-45h40M255 69v20" stroke="#C39337" strokeDasharray="3 3" opacity=".45" />
      </>}
      <g strokeWidth="1.5" strokeLinecap="round" opacity=".65"><path d="M40 220v-20" stroke="#669EB4" /><path d="m40 220 18 9" stroke="#C59B55" /><path d="m40 220-17 9" stroke="#79A693" /></g>
    </svg>
  );
}
