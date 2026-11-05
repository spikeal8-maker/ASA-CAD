/* Independently drawn geometric symbols; no generic document icon for sketch commands. */
const blue='#6db8df',grey='#7f8f99';
const lines=(d:string)=>`<path d="${d}" fill="none" stroke="${blue}" stroke-width="2.8" stroke-linecap="round"/>`;
const mark=(d:string)=>`<path d="${d}" fill="none" stroke="${grey}" stroke-width="2.2" stroke-linecap="round"/>`;
const circle=(x:number,y:number,r:number)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${blue}" stroke-width="2.4"/>`;
export const sketchIcons:Readonly<Record<string,string>>={
 'constraint.coincident':lines('M7 39 25 25 41 8')+'<circle cx="25" cy="25" r="5" fill="#fff" stroke="#6db8df" stroke-width="2.2"/>'+mark('M12 7h10M17 2v10'),
 'constraint.horizontal':lines('M6 29h38')+mark('M17 11v12M30 11v12M17 17h13'),
 'constraint.vertical':lines('M23 6v38')+mark('m31 15 5 15 6-15'),
 'constraint.parallel':lines('m7 38 18-30M23 42 18-30')+mark('m20 24 4 5M33 26l4 5'),
 'constraint.perpendicular':lines('M7 39h35M15 39V7')+mark('M15 30h9v9'),
 'constraint.tangent':circle(24,22,13)+lines('M5 35h40')+mark('M22 35h5'),
 'constraint.concentric':circle(25,25,17)+circle(25,25,8)+mark('M22 25h6M25 22v6'),
 'constraint.equal':lines('M7 13h36M7 38h36')+mark('M18 21h14M18 28h14'),
 'constraint.symmetric':lines('M8 8v34M42 8v34')+mark('M25 5v7M25 18v8M25 32v13M11 24h28m-24-4-4 4 4 4m20-8 4 4-4 4'),
 'constraint.fixed':'<path d="M12 22h27v22H12Z" fill="#d7eaf5" stroke="#8299a6" stroke-width="2"/>'+mark('M18 22v-8a8 8 0 0 1 16 0v8M25 30v7'),
 'constraint.pointOnCurve':lines('M6 38Q18 6 43 17')+'<circle cx="22" cy="19" r="4" fill="#7cbbd8" stroke="#81949f"/>',
 'dimension.linear':lines('M9 37 38 10')+mark('M5 27 17 40M29 3 44 19M10 33 35 10m-21 22-4 1 1-5m21-17 3-1-1 4'),
 'dimension.horizontal':lines('M8 35h35')+mark('M8 12v28M43 12v28M8 19h35m-28-4-7 4 7 4m21-8 7 4-7 4'),
 'dimension.vertical':lines('M15 8v34')+mark('M11 8h28M11 35h28M31 8v27m-4-20 4-7 4 7m-8 13 4 7 4-7'),
 'dimension.diameter':circle(25,25,17)+mark('M7 43 43 7m-8 5 8-5-4 9M8 36l-1 7 8-4'),
 'dimension.radius':circle(25,25,17)+mark('M25 25 42 8m-8 3 8-3-3 9')+'<text x="10" y="29" font-size="12" fill="#6c8392">R</text>',
 'dimension.angular':lines('M8 40h35M8 40 24 6')+mark('M20 40a12 12 0 0 0-7-10m3-1-3 1 2 3'),
 'system.rebuild':mark('M39 18a16 16 0 1 0 1 12M39 7v12H27'),
};
