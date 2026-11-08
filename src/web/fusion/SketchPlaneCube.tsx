import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {requestSketchView,type SketchViewSnapshot} from './sketchView';

/** The current product sketch projection is planar. Unsupported orbit is never sent to a stale 3D camera. */
export function SketchPlaneCube({view}:{view:SketchViewSnapshot}) {
  const [menu,setMenu]=useState(false),root=useRef<HTMLDivElement>(null);
  const [sceneHeight,setSceneHeight]=useState(946);
  const faceFillId=useId();
  const plane=view.active?.support;
  const originPlane=plane==='XY'||plane==='XZ'||plane==='YZ';
  const face=(plane==='XY'?'Сверху':plane==='XZ'?'Спереди':plane==='YZ'?'Справа':'На эскиз').toLocaleUpperCase('ru');
  const axisColors:Record<string,string>={X:'#ff8e8e',Y:'#70ed76',Z:'#8176ff',u:'#858b90',v:'#858b90',n:'#858b90'};
  const axes=plane==='XZ'?['X','Z','Y']:plane==='YZ'?['Y','Z','X']:plane==='XY'?['X','Y','Z']:['u','v','n'];
  const reason='Вращение при редактировании эскиза пока недоступно';
  useLayoutEffect(()=>{
    const scene=root.current?.parentElement?.querySelector('.live-scene');
    if(!scene)return;
    const measure=()=>{const height=scene.getBoundingClientRect().height;if(height>0)setSceneHeight(height);};
    measure();
    const observer=new ResizeObserver(measure);observer.observe(scene);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setMenu(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(false);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};
  },[]);
  const look=()=>{requestSketchView('look-at');setMenu(false);};
  return <div className={'live-viewcube live-sketch-cube'+(menu?' menu-open':'')} ref={root}
    style={{'--sketch-cube-unit':`${sceneHeight/946}px`} as React.CSSProperties}
    data-testid="live-viewcube" data-camera-ready={view.navigationReady} data-projection="orthographic"
    data-sketch-mode="plane-locked" data-sketch-plane={plane||''} data-world-up="Z"
    onContextMenu={event=>{event.preventDefault();event.stopPropagation();setMenu(true);}}>
    <svg viewBox="0 0 110 116" aria-label={'Ориентация эскиза: '+(view.active?.supportLabel||'плоскость')}>
      <defs><linearGradient id={faceFillId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f4f4f4" stopOpacity=".92"/><stop offset="1" stopColor="#d9d9d9" stopOpacity=".92"/>
      </linearGradient></defs>
      <rect x="23" y="92" width="72" height="7" fill="#777" opacity=".16"/>
      <g role="button" tabIndex={0} aria-label="Вид по нормали к эскизу" className="live-sketch-plane-face" data-origin-plane={originPlane}
        onClick={look} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();look();}}}>
        <rect data-sketch-cube-face="true" x="22" y="22" width="70" height="70" fill={`url(#${faceFillId})`} stroke="#8f8f8f" strokeWidth="1"/>
        <text x="57" y="59" textAnchor="middle" dominantBaseline="middle">{face}</text>
      </g>
      <text x="97" y="92" fill={axisColors[axes[0]]} fontSize="18">{axes[0]}</text>
      <text x="22" y="17" fill={axisColors[axes[1]]} fontSize="18">{axes[1]}</text>
      <text x="12" y="103" fill={axisColors[axes[2]]} fontSize="18">{axes[2]}</text>
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
