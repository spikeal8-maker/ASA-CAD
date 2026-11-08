import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {LiveIcon} from './LiveIcon';
import {reason,run} from './liveActions';
import {itemAction,observedMenuWidths,sketchPanels,type SketchActionGetter,type SketchItem,type SketchPanel} from './sketchCommands';

type Menu={items:SketchItem[];left:number;top:number;width:number;anchor:HTMLElement;label:string;id:string};
type Hover={item:SketchItem;left:number;top:number;expanded:boolean};
const lineIllustration=new URL('./sketch-icons/line-instructions.svg',import.meta.url).href;

/** Presentation of observed native controls; execution stays in existing CadUiActions. */
export function SketchRibbon({getAction}:{getAction:SketchActionGetter}){
 const root=useRef<HTMLDivElement>(null);
 const [menus,setMenus]=useState<Menu[]>([]),[activeCommand,setActiveCommand]=useState('');
 const [hover,setHover]=useState<Hover|null>(null);
 const menuState=useRef(menus);menuState.current=menus;
 const pendingMenuFocus=useRef<{level:number;id:string}|null>(null);
 const hoverTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
 useLayoutEffect(()=>{
  const pending=pendingMenuFocus.current;pendingMenuFocus.current=null;
  if(!pending||menus[pending.level]?.id!==pending.id)return;
  const menu=document.querySelector<HTMLDivElement>(`.live-sketch-menu[data-menu-level="${pending.level}"]`);
  if(menu?.getAttribute('data-menu-id')===pending.id)menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
 },[menus]);
 const clearHover=()=>{hoverTimers.current.forEach(clearTimeout);hoverTimers.current=[];setHover(null);};
 const close=(focus=false)=>{pendingMenuFocus.current=null;if(focus)menuState.current[0]?.anchor.focus();setMenus([]);};
 useEffect(()=>{
  const outside=(e:PointerEvent)=>{const target=e.target as Element;if(!root.current?.contains(target)&&!target.closest('.live-sketch-menu'))close();clearHover();};
  const key=(e:KeyboardEvent)=>{clearHover();if(e.key==='Escape'&&menuState.current.length){e.preventDefault();e.stopImmediatePropagation();close(true);}};
  const resize=()=>{close();clearHover();};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',resize);
  const area=document.querySelector('.live-workarea'),update=()=>setActiveCommand(area?.getAttribute('data-active-command')||'');update();
  const observer=new MutationObserver(update);if(area)observer.observe(area,{attributes:true,attributeFilter:['data-active-command']});
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',resize);observer.disconnect();hoverTimers.current.forEach(clearTimeout);};
 },[]);
 const menuWidth=(items:SketchItem[],id:string)=>{
  const context=document.createElement('canvas').getContext('2d');
  if(context)context.font='13px "Segoe UI", Arial, sans-serif';
  const textWidth=Math.max(0,...items.filter(item=>!item.separator).map(item=>context?.measureText(item.label).width??item.label.length*7));
  return Math.min(Math.max(observedMenuWidths[id]||245,Math.ceil(textWidth+61)),innerWidth-16);
 };
 const open=(items:SketchItem[],anchor:HTMLElement,level=0,label='Команды эскиза',focus=false,id='')=>{
  clearHover();
  const rect=anchor.getBoundingClientRect(),width=menuWidth(items,id);
  const height=Math.min(items.reduce((sum,item)=>sum+(item.separator?2:23),3),innerHeight-16);
  let left=level?rect.right-5:rect.left;
  if(left+width>innerWidth-8)left=level?rect.left-width+5:innerWidth-width-8;
  const top=Math.max(8,Math.min(level?rect.top-2:rect.bottom-2,innerHeight-height-8));
  // Hand off keyboard focus in the menu's DOM commit, before another key can
  // reach the caption. Pointer opens cancel a pending keyboard handoff.
  pendingMenuFocus.current=focus?{level,id}:null;
  setMenus(previous=>[...previous.slice(0,level),{items,left:Math.max(8,left),top,width,anchor,label,id}]);
 };
 const invoke=(item:SketchItem)=>{const a=itemAction(item,getAction);if(!a?.enabled)return;clearHover();close();run(a.id);};
 const unavailableReason=(item:SketchItem)=>{const a=itemAction(item,getAction);return !a?.enabled&&!item.children?.length?reason(a):'';};
 const beginHover=(item:SketchItem,anchor:HTMLElement)=>{
  clearHover();if(menuState.current.length)return;
  const rect=anchor.getBoundingClientRect(),bottom=root.current?.getBoundingClientRect().bottom??rect.bottom;
  const left=Math.max(8,Math.min(rect.left-4,innerWidth-393));
  hoverTimers.current.push(setTimeout(()=>setHover({item,left,top:bottom+3,expanded:false}),450));
  if(item.nativeId==='DrawPolyline')hoverTimers.current.push(setTimeout(()=>setHover({item,left,top:bottom,expanded:true}),1450));
 };
 const promotedButton=(item:SketchItem)=>{
  const a=itemAction(item,getAction),active=!!a&&(a.checked===true||activeCommand===a.id);
  const chooser=item.nativeId==='ConstraintHorizontalVertical'&&!!item.children?.length;
  return <div className="live-sketch-tool-slot" key={item.id} onPointerEnter={e=>beginHover(item,e.currentTarget)} onPointerLeave={clearHover}>
   <button type="button" className={`live-tool live-sketch-tool${active?' is-active':''}`} data-native-command={item.nativeId} data-command-id={a?.id||item.actionId}
    aria-label={item.label} aria-pressed={active} aria-haspopup={chooser?'menu':undefined} aria-expanded={chooser?menus.some(menu=>menu.items===item.children):undefined}
    disabled={!chooser&&!a?.enabled} onFocus={e=>beginHover(item,e.currentTarget)} onBlur={clearHover}
    onClick={e=>chooser?open(item.children!,e.currentTarget,0,item.label,false,item.nativeId):invoke(item)}
    onKeyDown={e=>{if(chooser&&e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();open(item.children!,e.currentTarget,0,item.label,true,item.nativeId);}}}>
    <LiveIcon id={item.icon} size={40}/>
   </button>
  </div>;
 };
 const panel=(p:SketchPanel)=><section className={`live-group live-sketch-group live-sketch-${p.key}`} data-native-panel={p.id} key={p.id} aria-label={p.label}>
  <div className="live-tools live-sketch-tools">{p.promoted.map(promotedButton)}</div>
  <button className="live-group-title live-sketch-group-title" type="button" data-sketch-group={p.id} data-sketch-group-key={p.key} data-native-panel={p.id}
   aria-haspopup="menu" aria-expanded={menus[0]?.items===p.menuItems}
   onClick={e=>menus[0]?.items===p.menuItems?close():open(p.menuItems,e.currentTarget,0,p.label,false,p.id)}
   onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();open(p.menuItems,e.currentTarget,0,p.label,true,p.id);}}}>
   {p.label}<span className="live-sketch-chevron" aria-hidden="true"/>
  </button>
 </section>;
 const menuKeyboard=(e:React.KeyboardEvent<HTMLDivElement>,level:number)=>{
  const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
   e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;buttons[next]?.focus();
  }else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();if(level){menus[level].anchor.focus();setMenus(previous=>previous.slice(0,level));}else close(true);}
  else if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();}
  else if(e.key==='Tab')close();
 };
 return <div className="live-sketch-ribbon" ref={root} data-native-tab="SketchTab">
  <div className="live-sketch-scroll" onScroll={()=>{close();clearHover();}}>{sketchPanels.slice(0,-1).map(panel)}</div>
  {panel(sketchPanels[sketchPanels.length-1])}
  {createPortal(<>
   {menus.map((menu,level)=><div className="live-menu live-sketch-menu" role="menu" aria-label={menu.label} key={level} data-menu-level={level} data-menu-id={menu.id}
    style={{position:'fixed',left:menu.left,top:menu.top,maxHeight:innerHeight-menu.top-8,width:menu.width,zIndex:1000+level}} onKeyDown={e=>menuKeyboard(e,level)}>
    {menu.items.map((item,index)=>{
     if(item.separator)return <hr key={`${item.id}-${index}`} role="separator"/>;
     const a=itemAction(item,getAction),hasMenu=!!item.children?.length,active=!!a&&(a.checked===true||activeCommand===a.id),nativeDropdown=item.nativeType==='DropDownControl';
     return <button key={`${item.id}-${index}`} className={`live-sketch-menu-item${active?' is-active':''}`} type="button" role="menuitem"
      data-native-menu-command={nativeDropdown?undefined:item.nativeId} data-native-dropdown={nativeDropdown?item.id:undefined} data-command-id={hasMenu?undefined:a?.id||item.actionId}
      data-authored-command={item.authored||undefined} aria-label={item.label} aria-haspopup={hasMenu?'menu':undefined} aria-expanded={hasMenu?menus[level+1]?.items===item.children:undefined}
      disabled={!hasMenu&&!a?.enabled} title={unavailableReason(item)||undefined}
      onPointerEnter={e=>{if(hasMenu)open(item.children!,e.currentTarget,level+1,item.label,false,item.id);else setMenus(previous=>previous.slice(0,level+1));}}
      onClick={e=>hasMenu?open(item.children!,e.currentTarget,level+1,item.label,false,item.id):invoke(item)}
      onKeyDown={e=>{if(e.key==='ArrowRight'&&hasMenu){e.preventDefault();e.stopPropagation();open(item.children!,e.currentTarget,level+1,item.label,true,item.id);}}}>
      <span className="live-sketch-menu-icon">{!nativeDropdown&&<LiveIcon id={item.icon} size={18}/>}</span>
      <span className="live-sketch-menu-label">{item.label}</span>
      {hasMenu?<span className="live-sketch-menu-arrow" aria-hidden="true"/>:<small className="live-sketch-keycap">{item.shortcut||''}</small>}
     </button>;
    })}
   </div>)}
   {hover&&<div role="tooltip" className={`live-sketch-tooltip${hover.expanded?' is-expanded':''}`} data-native-tooltip={hover.item.nativeId} style={{left:hover.left,top:hover.top}}>
    <strong>{hover.item.label}{hover.item.shortcut?` (${hover.item.shortcut})`:''}</strong>
    {hover.expanded?<>
     <p>Создаёт отрезки и последовательности отрезков.</p>
     <p>Укажите начальную и конечную точки.<br/>Дуга из центра доступна в меню<br/>«Создать → Дуга».</p>
     <img className="live-sketch-line-illustration" src={lineIllustration} alt="Построение отрезка между двумя точками на сетке"/>
     <span className="live-sketch-tooltip-footer">L — команда «Линия»</span>
    </>:unavailableReason(hover.item)&&<span className="live-sketch-tooltip-reason">{unavailableReason(hover.item)}</span>}
   </div>}
  </>,document.body)}
 </div>;
}
