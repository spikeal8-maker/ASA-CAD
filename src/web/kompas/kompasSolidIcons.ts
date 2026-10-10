/* Объёмные значки твердотельных команд — перенесено из прототипа #170 (prototypes/kompas-shell, тег ui-reference-20261004). */

const c = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const F = (d: string) => 'F:' + d;
const PL = (pts: ReadonlyArray<readonly [number, number]>) => 'M' + pts.map((p) => p.join(' ')).join('L') + 'Z';
const BOX = (x: number, y: number, w: number, h: number, d = 6) => [
  'f:' + PL([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]),
  't:' + PL([[x, y], [x + d, y - d], [x + w + d, y - d], [x + w, y]]),
  's:' + PL([[x + w, y], [x + w + d, y - d], [x + w + d, y + h - d], [x + w, y + h]]),
];
/* скругление R7: видимая часть скруглённой поверхности — серп над передней гранью */
const FILLET3D = ['a:M3 13A7 7 0 0 1 10 6L15 1A7 7 0 0 0 8 8Z', 'f:M3 20V13A7 7 0 0 1 10 6H16V20Z', 't:M10 6L15 1H21L16 6Z', 's:M16 6L21 1V15L16 20Z'];

export const KOMPAS_SOLID_ICONS: Record<string, readonly string[]> = {
 ts_solid:[...BOX(4,10,11,10,6)],
 extrude:[...BOX(2,11,11,9,6),'A:M21.5 9.5V2.5','A:m19.5 4.5 2-2 2 2'],
 cut:[...BOX(2,10,13,10,6),'k:M5 13.5h7v4.5H5z','A:M5 13.5h7v4.5H5z'],
 fillet:FILLET3D,
 chamfer3d:['a:M3 11L6 8L11 3L8 6Z','f:M3 20V11L6 8H16V20Z','t:M6 8L11 3H21L16 8Z','s:M16 8L21 3V15L16 20Z'],
 thicken:[...BOX(2,14,13,4,6),'A:M11.5 11V2.5','A:m9.5 4.5 2-2 2 2'],
 hole:[...BOX(2,11,13,9,6),'k:M8.1 8a3.4 1.6 0 1 0 6.8 0a3.4 1.6 0 1 0-6.8 0z','B:M8.1 8.4v8M14.9 8.4v8'],
 fullfillet:['a:M4 13A6 6 0 0 1 16 13L21 8A6 6 0 0 0 9 8Z','f:M4 20V13A6 6 0 0 1 16 13V20Z','s:M16 13L21 8V15L16 20Z'],
 rib:[...BOX(2,16,15,4,5),...BOX(2,5,4,11,5),'a:M6 15.5V9L12.5 15.5Z'],
 section:[...BOX(3,10,12,10,6),'p:M1 17L9 9H22L14 17Z'],
 draft:['f:M3 20L6 8H13L16 20Z','t:M6 8L11 3H18L13 8Z','s:M13 8L18 3L21 15L16 20Z'],
 addpart:[...BOX(2,12,11,8,5),'A:M20.5 1v6M17.5 4h6'],
 shell:[...BOX(2,10,13,10,6),'k:M5.2 9L8.7 5.5H18L14.5 9Z'],
 boolean:[...BOX(2,11,11,9,5),'a:'+c(16,9,5)],
 slice:[...BOX(1,11,7,9,4),...BOX(12,11,7,9,4),'B:M10.5 2v20'],
 delbody:[...BOX(2,12,11,8,5),'A:M16.5 2l5.5 5.5M22 2l-5.5 5.5'],
 pbox:[...BOX(3,12,12,8,5),'a:'+c(3,20,1.7),'a:'+c(15,12,1.7),'a:'+c(20,7,1.7)],
 delface:['f:M3 11H15V20H3Z','s:M15 11L21 5V14L15 20Z','B:M3 11L9 5H21L15 11Z','A:M1.5 1.5l4.5 4.5M6 1.5l-4.5 4.5'],
 moveface:['f:M2 12H14V20H2Z','s:M14 12L20 6V14L14 20Z','a:M2 9L8 3H20L14 9Z','A:M22.5 14V4','A:m20.8 5.7 1.7-1.7 1.7 1.7'],
 replaceface:['f:M2 11H14V20H2Z','s:M14 11L20 5V14L14 20Z','a:M2 11Q7 7.5 8 5H20Q15 8 14 11Z'],
 resizefillet:[...FILLET3D,'A:M1.5 1.5l3.5 3.5','A:M1.5 5V1.5H5'],
 resizeface:[...BOX(2,11,11,9,6),'A:M21.8 3v11','A:m20.1 4.7 1.7-1.7 1.7 1.7','A:m20.1 12.3 1.7 1.7 1.7-1.7'],
 scale3d:[...BOX(2,14,7,6,4),'B:M2 20V8H14V20ZM2 8l6-6h12v12l-6 6','A:M10.5 12.5 17 6','A:M13.5 6H17v3.5'],
 move3d:[...BOX(2,12,10,8,5),'A:M19 2.5v10M14.5 7.5h9','A:m17.3 4.2 1.7-1.7 1.7 1.7','A:m21.8 5.8 1.7 1.7-1.7 1.7'],
 gridpat:[...BOX(1,7,6,5,3),...BOX(12,7,6,5,3),...BOX(1,18,6,5,3),...BOX(12,18,6,5,3)],
 copyobj:['B:M8 8H18V16H8ZM8 8l5-5h10v8l-5 5',...BOX(2,13,10,8,4)],
 collection:[...BOX(2,13,8,7,4),'f:M14 8.5v9a3.5 1.5 0 0 0 7 0v-9z','t:M14 8.5a3.5 1.5 0 1 0 7 0a3.5 1.5 0 1 0-7 0z'],
 plane:['t:M3 17L9 7H21L15 17Z'],
 planeTree:[F('M4 16l5-8h11l-5 8z')]
};
