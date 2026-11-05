import React,{useEffect,useRef,useState} from 'react';
import {requestSketchView,type SketchViewSnapshot} from './sketchView';

/** The current product sketch projection is planar. Unsupported orbit is never sent to a stale 3D camera. */
export function SketchPlaneCube({view}:{view:SketchViewSnapshot}) {
  const [menu,setMenu]=useState(false),root=useRef<HTMLDivElement>(null);
  const plane=view.active?.support;
  const face=(plane==='XY'?'Сверху':plane==='XZ'?'Спереди':plane==='YZ'?'Справа':'На эскиз').toLocaleUpperCase('ru');
  const axes=plane==='XZ'?['X','Z']:plane==='YZ'?['Y','Z']:['X','Y'];
  const reason='Вращение при редактировании эскиза пока недоступно';
  useEffect(()=>{
    const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setMenu(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(false);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};
  },[]);
  const look=()=>{requestSketchView('look-at');setMenu(false);};
  return <div className="live-viewcube live-sketch-cube" ref={root} style={{width:138}}
    data-testid="live-viewcube" data-camera-ready={view.navigationReady} data-projection="orthographic"
    data-sketch-mode="plane-locked" data-sketch-plane={plane||''}
    onContextMenu={event=>{event.preventDefault();event.stopPropagation();setMenu(true);}}>
    <svg viewBox="0 0 140 150" aria-label={'Ориентация эскиза: '+(view.active?.supportLabel||'плоскость')}>
      <ellipse cx="70" cy="125" rx="34" ry="5" fill="#777" opacity=".07"/>
      <rect x="34" y="38" width="72" height="72" fill="#f4f4f4" stroke="#b3b7ba" strokeWidth=".8"/>
      <g role="button" tabIndex={0} aria-label="Вид по нормали к эскизу" className="live-sketch-plane-face"
        onClick={look} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();look();}}}>
        <rect x="38" y="42" width="64" height="64" fill="transparent"/>
        <text x="70" y="75" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#68777f">{face}</text>
      </g>
      <text x="118" y="78" fill="#cc6767" fontSize="11">{axes[0]}</text>
      <text x="67" y="29" fill="#648d79" fontSize="11">{axes[1]}</text>
    </svg>
    <button className="cube-home" title="Показать весь эскиз" aria-label="Главный вид" onClick={()=>requestSketchView('fit')}>⌂</button>
    <div className="cube-roll"><button disabled title={reason} aria-label="Повернуть вид против часовой стрелки">↶</button><button disabled title={reason} aria-label="Повернуть вид по часовой стрелке">↷</button></div>
    <button className="cube-menu-button" aria-label="Меню куба ориентации" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>⌄</button>
    {menu&&<div className="live-menu cube-menu" role="menu" aria-label="Виды эскиза">
      <button type="button" role="menuitem" onClick={look}>Вид на эскиз</button>
      <button type="button" role="menuitem" onClick={()=>{requestSketchView('fit');setMenu(false);}}>Показать весь эскиз</button>
      <hr/><button type="button" role="menuitem" disabled title={reason}>Орбитальное вращение</button>
      <button type="button" role="menuitem" disabled title="Доступна после завершения эскиза">Перспектива</button>
    </div>}
    <div className="live-sketch-cube-caption">{view.active?.supportLabel||'Плоскость эскиза'}</div>
  </div>;
}
