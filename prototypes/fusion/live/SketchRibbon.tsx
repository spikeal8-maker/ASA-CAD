import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {LiveIcon} from './LiveIcon';
import {reason,run} from './liveActions';
import {itemAction,sketchPanels,type SketchActionGetter,type SketchItem,type SketchPanel} from './sketchCommands';

type Menu={items:SketchItem[];left:number;top:number;anchor:HTMLElement;label:string};
/** Contextual presentation only: all executable operations are existing CadUiActions. */
export function SketchRibbon({getAction}:{getAction:SketchActionGetter}){
 const root=useRef<HTMLDivElement>(null),[menus,setMenus]=useState<Menu[]>([]),[activeCommand,setActiveCommand]=useState('');
 const menuState=useRef(menus);menuState.current=menus;
 const close=(focus=false)=>{if(focus)menuState.current[0]?.anchor.focus();setMenus([]);};
 useEffect(()=>{
  const outside=(e:PointerEvent)=>{const target=e.target as Element;if(!root.current?.contains(target)&&!target.closest('.live-sketch-menu'))close();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&menuState.current.length){e.preventDefault();e.stopImmediatePropagation();close(true);}};
  const resize=()=>close();
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);window.addEventListener('resize',resize);
  const area=document.querySelector('.live-workarea'),update=()=>setActiveCommand(area?.getAttribute('data-active-command')||'');update();
  const observer=new MutationObserver(update);if(area)observer.observe(area,{attributes:true,attributeFilter:['data-active-command']});
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',resize);observer.disconnect();};
 },[]);
 const open=(items:SketchItem[],anchor:HTMLElement,level=0,label='Команды эскиза',focus=false)=>{
  const rect=anchor.getBoundingClientRect(),width=Math.min(286,innerWidth-16),height=Math.min(items.reduce((n,item)=>n+(item.separator?9:33),8),innerHeight-64);
  let left=level?rect.right-1:rect.left;if(left+width>innerWidth-8)left=level?rect.left-width+1:innerWidth-width-8;
  const top=Math.max(8,Math.min(level?rect.top:rect.bottom,innerHeight-height-8));
  setMenus(previous=>[...previous.slice(0,level),{items,left:Math.max(8,left),top,anchor,label}]);
  if(focus)requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(`.live-sketch-menu[data-menu-level="${level}"] button:not(:disabled)`)?.focus());
 };
 const invoke=(item:SketchItem)=>{const a=itemAction(item,getAction);if(!a?.enabled)return;close();run(a.id);};
 const tooltip=(item:SketchItem)=>{const a=itemAction(item,getAction);return item.label+(item.shortcut?` (${item.shortcut})`:'')+(item.nativeId==='ArcCenterTwoPoint'?' · Центр → начало → конец':'')+(!a?.enabled&&!item.children?` — ${reason(a)}`:'')+(item.nativeId==='ConstraintFix'?' · Фиксация выбранной геометрии':'');};
 const promotedButton=(item:SketchItem,compact:boolean)=>{
  const a=itemAction(item,getAction),active=!!a&&(a.checked===true||activeCommand===a.id),hasMenu=!!item.children?.length,chooser=item.nativeId==='ConstraintHorizontalVertical';
  return <div className="live-sketch-split" key={item.id}>
   <button type="button" className={`live-tool live-sketch-tool${active?' is-active':''}`} data-native-command={item.nativeId} data-command-id={a?.id||item.actionId} data-authored-promotion={item.authored||undefined} aria-label={item.label} aria-pressed={active} aria-haspopup={chooser?'menu':undefined} aria-expanded={chooser?menus.some(menu=>menu.items===item.children):undefined} disabled={!chooser&&!a?.enabled} title={tooltip(item)} onClick={e=>chooser?open(item.children!,e.currentTarget,0,item.label):invoke(item)} onKeyDown={e=>{if(chooser&&e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();open(item.children!,e.currentTarget,0,item.label,true);}}}><LiveIcon id={item.icon} size={compact?22:32}/></button>
   {hasMenu&&!chooser&&<button className="live-sketch-split-arrow" type="button" aria-label={`${item.label}: варианты`} aria-haspopup="menu" aria-expanded={menus.some(menu=>menu.items===item.children)} data-native-submenu={item.nativeId} title={`${item.label}: варианты`} onClick={e=>open(item.children!,e.currentTarget,0,item.label)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();open(item.children!,e.currentTarget,0,item.label,true);}}}>⌄</button>}
  </div>;
 };
 const panel=(p:SketchPanel)=> <section className={`live-group live-sketch-group live-sketch-${p.key}`} data-native-panel={p.id} key={p.id} aria-label={p.label}>
  <div className="live-tools live-sketch-tools">{p.promoted.map(item=>promotedButton(item,p.key==='constraints'))}</div>
  <button className="live-group-title live-sketch-group-title" type="button" data-sketch-group={p.id} data-sketch-group-key={p.key} data-native-panel={p.id} aria-haspopup="menu" aria-expanded={menus[0]?.items===p.items} onClick={e=>menus[0]?.items===p.items?close():open(p.items,e.currentTarget,0,p.label)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();open(p.items,e.currentTarget,0,p.label,true);}}}>{p.label} <span>⌄</span></button>
 </section>;
 const menuKeyboard=(e:React.KeyboardEvent<HTMLDivElement>,level:number)=>{
  const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
   e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;buttons[next]?.focus();
  }else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();if(level){menus[level].anchor.focus();setMenus(previous=>previous.slice(0,level));}else close(true);}
  else if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();}
  else if(e.key==='Tab'){close();}
 };
 return <div className="live-sketch-ribbon" ref={root} data-native-tab="SketchTab">
  <div className="live-sketch-scroll" onScroll={()=>close()}>{sketchPanels.slice(0,-1).map(panel)}</div>
  {panel(sketchPanels[sketchPanels.length-1])}
  {createPortal(menus.map((menu,level)=><div className="live-menu live-sketch-menu" role="menu" aria-label={menu.label} key={level} data-menu-level={level} style={{position:'fixed',left:menu.left,top:menu.top,maxHeight:innerHeight-menu.top-8,width:Math.min(286,innerWidth-16),zIndex:1000+level}} onKeyDown={e=>menuKeyboard(e,level)}>
   {menu.items.map((item,index)=>{if(item.separator)return <hr key={`${item.id}-${index}`} role="separator"/>;const a=itemAction(item,getAction),hasMenu=!!item.children?.length,active=!!a&&(a.checked===true||activeCommand===a.id);return <button key={`${item.id}-${index}`} className={`live-sketch-menu-item${active?' is-active':''}`} type="button" role="menuitem" data-native-menu-command={item.nativeType==='DropDownControl'?undefined:item.nativeId} data-native-dropdown={item.nativeType==='DropDownControl'?item.id:undefined} data-command-id={hasMenu?undefined:a?.id||item.actionId} data-authored-command={item.authored||undefined} aria-label={item.label} aria-haspopup={hasMenu?'menu':undefined} aria-expanded={hasMenu?menus[level+1]?.items===item.children:undefined} disabled={!hasMenu&&!a?.enabled} title={tooltip(item)} onPointerEnter={e=>{if(hasMenu)open(item.children!,e.currentTarget,level+1,item.label);else setMenus(previous=>previous.slice(0,level+1));}} onClick={e=>hasMenu?open(item.children!,e.currentTarget,level+1,item.label):invoke(item)} onKeyDown={e=>{if(e.key==='ArrowRight'&&hasMenu){e.preventDefault();e.stopPropagation();open(item.children!,e.currentTarget,level+1,item.label,true);}}}>
    <LiveIcon id={item.icon} size={20}/><span>{item.label}</span><small className="live-sketch-keycap">{hasMenu?'›':item.shortcut||(!a?.enabled?'—':'')}</small>
   </button>;})}
  </div>),document.body)}
 </div>;
}
