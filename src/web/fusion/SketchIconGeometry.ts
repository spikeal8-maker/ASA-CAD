/* Independently drawn geometric symbols; no generic document icon for sketch commands. */
export const blue='#6db8df',grey='#7f8f99';
export const lines=(d:string)=>`<path d="${d}" fill="none" stroke="${blue}" stroke-width="2.8" stroke-linecap="round"/>`;
export const mark=(d:string)=>`<path d="${d}" fill="none" stroke="${grey}" stroke-width="2.2" stroke-linecap="round"/>`;
export const circle=(x:number,y:number,r:number)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${blue}" stroke-width="2.4"/>`;
export const dot=(x:number,y:number)=>`<circle cx="${x}" cy="${y}" r="2.8" fill="#e39b63" stroke="#a26e46" stroke-width=".8"/>`;
export const dashed=(d:string)=>`<path d="${d}" fill="none" stroke="${grey}" stroke-width="1.6" stroke-dasharray="3 3"/>`;
export const word=(text:string,x=25,y=29)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="${grey}">${text}</text>`;
export const cube=lines('m8 17 17-10 17 10v20L25 47 8 37Zm0 0 17 10 17-10M25 27v20');
export const arrow=mark('M25 5v20m-6-6 6 6 6-6');
export const cursor='<path d="m12 6 25 20-12 2-6 13Z" fill="#eff5f8" stroke="#728d9b" stroke-width="2.3"/>';
export const spline=lines('M5 37C15 37 10 7 25 11s7 28 20 5');
export const rectangle=lines('M8 11h34v28H8Z');
export const polygon=lines('m25 6 18 13-7 23H14L7 19Z');
export const slot=lines('M16 12h18a12 12 0 0 1 0 24H16a12 12 0 0 1 0-24Z');
export const mesh=lines('M6 38 18 9 34 11 44 39ZM6 38l28-27M18 9l26 30M6 38l20-14 18 15M18 9l8 15 8-13');
