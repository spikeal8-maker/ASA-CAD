import React from 'react';
import artwork from './artwork.v6.json';
import promotedArtwork from './promoted-artwork.v6.json';
import {sketchIcons} from './SketchIcons';
const own:Record<string,string>={
 'sketch.line':'<path d="M8 40 42 8" stroke="#4a8faf" stroke-width="2.5"/><rect x="5" y="37" width="6" height="6" fill="#78c6ed" stroke="#7b8c96"/><rect x="39" y="5" width="6" height="6" fill="#78c6ed" stroke="#7b8c96"/>',
 'sketch.rectangle':'<path d="M7 10h36v30H7Z" fill="#ecf8ff" stroke="#74bce2" stroke-width="2"/><path d="M7 10v30h36" fill="none" stroke="#6a7f8b" stroke-width="1.5"/><g fill="#67b7e2"><rect x="4" y="7" width="6" height="6"/><rect x="40" y="7" width="6" height="6"/><rect x="4" y="37" width="6" height="6"/><rect x="40" y="37" width="6" height="6"/></g>',
 'sketch.circle':'<circle cx="25" cy="25" r="17" fill="#f1faff" stroke="#67afda" stroke-width="2.5"/><path d="M20 25h10M25 20v10" stroke="#8a9297"/><circle cx="25" cy="25" r="2" fill="#e78d61"/>',
 'sketch.arc':'<path d="M7 36a19 19 0 1 1 36 0" fill="none" stroke="#68b6e1" stroke-width="3"/><path d="m7 36 18-13 18 13" fill="none" stroke="#b2b9bd" stroke-dasharray="3 3"/><circle cx="25" cy="23" r="2" fill="#e5a174"/>',
 'sketch.finish':'<path d="m9 25 11 11L43 10" fill="none" stroke="#48a776" stroke-width="6"/>',
 'system.undo':'<path d="M8 20h23q13 0 11 16M8 20l10-10M8 20l10 10" fill="none" stroke="#89949b" stroke-width="3" stroke-linejoin="round"/>',
 'system.redo':'<path d="M42 20H19Q6 20 8 36M42 20 32 10M42 20 32 30" fill="none" stroke="#89949b" stroke-width="3" stroke-linejoin="round"/>',
 'system.save':'<path d="M8 7h29l6 6v30H8Z" fill="#e3e7e9" stroke="#859097" stroke-width="2"/><path d="M15 7h19v13H15Zm0 22h21v14H15Z" fill="#fafafa" stroke="#859097" stroke-width="2"/><path d="M28 10v7" stroke="#7da6bb" stroke-width="3"/>',
 'system.open':'<path d="M6 15h17l4 4h18l-6 23H6Z" fill="#d2d8dc" stroke="#88959d" stroke-width="2"/><path d="M7 18V9h16l4 6h15" fill="#edf0f1" stroke="#88959d" stroke-width="2"/>',
 'system.new':'<path d="M12 5h20l9 9v30H12Z" fill="#f7f9fa" stroke="#8e9aa1" stroke-width="2"/><path d="M32 5v10h9M25 23v14M18 30h14" fill="none" stroke="#80aec2" stroke-width="2.5"/>',
 'part.cutExtrude':'<path d="m8 15 10-8h25v28l-9 9H8Z" fill="#c4c9cc" stroke="#869199"/><path d="M8 15h26v29H8Z" fill="#e2e8eb" stroke="#869199"/><path d="M18 19h9v25h-9Z" fill="#5f9ebe"/><path d="M43 2v19m-5-6 5 6 5-6" fill="none" stroke="#df8e5a" stroke-width="2.5"/>',
};
// Own vector reconstruction of the observed bevelled block and concentric hole.
const hole='<path d="M6 16 17 6h27v29L33 45H6Z" fill="#b9babc" stroke="#8d9295" stroke-width="1.45" stroke-linejoin="round"/><path d="M6 16 17 6h27L33 16Z" fill="#f2f3f3" stroke="#969b9e" stroke-width="1.2" stroke-linejoin="round"/><path d="M33 16 44 6v29L33 45Z" fill="#b9bbbd" stroke="#8c9296" stroke-width="1.2"/><path d="M6 16h27v29H6Z" fill="#d9dcde" stroke="#92979a" stroke-width="1.25"/><ellipse cx="20" cy="30" rx="10.1" ry="11.1" fill="#a2a7aa" stroke="#969c9f" stroke-width=".75"/><ellipse cx="20" cy="30" rx="8.2" ry="9.1" fill="#f5f7f8" stroke="#d4dde1" stroke-width="1"/><path d="M18 21.2c-3.4.8-6.1 4.4-6.1 8.8 0 5 3.7 9.1 8.1 9.1 3.9 0 7.2-3 8-7.3-4.8-.7-9.1-4.1-10-10.6Z" fill="#66b4e4"/><path d="M16.7 22.5c-2.6 1.6-4 4.1-4 7.5 0 4.3 3.3 8 7.2 8" fill="none" stroke="#90c9eb" stroke-width=".9"/>';
export function LiveIcon({id,size=36}:{id:string;size?:number}){
 const native=id==='part.sketch.create'?'SketchCreate':id==='part.extrude'?'Extrude':id==='part.fillet'?'FusionFilletEdgesCommand':id;
 const body=id==='FusionHoleCommand'?hole:own[id]||sketchIcons[id];
 if(body)return <svg width={size} height={size} viewBox="0 0 50 50" aria-hidden="true" className="live-icon" dangerouslySetInnerHTML={{__html:body}}/>;
 const art=(promotedArtwork as Record<string,{svg:string;status:string}>)[native]
  ||(artwork as Record<string,{svg:string;status:string}>)[native];
 if(art)return <span className="live-icon" style={{width:size,height:size}} data-art-status={art.status} aria-hidden="true" dangerouslySetInnerHTML={{__html:art.svg}}/>;
 return <svg className="live-icon" width={size} height={size} viewBox="0 0 50 50" aria-hidden="true"><path d="M9 10h32v30H9Z" fill="#e8f3f8" stroke="#8eabb9" strokeWidth="1.5"/><path d="M16 18h18M16 25h18M16 32h11" stroke="#639ab7" strokeWidth="2"/></svg>;
}
