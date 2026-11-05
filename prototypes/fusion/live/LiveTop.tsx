import React,{useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {CadShellTopProps} from '../../../src/web/CadShellTop';
import {LiveIcon} from './LiveIcon';
import {ref,tr,bindActions,forNative,nativeLabel,reason,run,action,nativeMap} from './liveActions';
import {holeWizard} from './HoleWizard';
import {SketchRibbon} from './SketchRibbon';
import {registerSketchWorkspaceExit} from './sketchView';
import {contextualDimension,itemAction,sketchSearchItems} from './sketchCommands';
type Item={id:string;kind:string;name?:string;commandId?:string;enabled?:boolean;children?:Item[]};
type Menu={items:Item[];left:number;top:number};
export function CadShellTop(p:CadShellTopProps){
 useLayoutEffect(()=>registerSketchWorkspaceExit(()=>p.setActiveWorkspace('solid')),[p.setActiveWorkspace]);
 const [tab,setTab]=useState('SolidTab'),[menus,setMenus]=useState<Menu[]>([]),[search,setSearch]=useState('');
 const holeState=useSyncExternalStore(holeWizard.subscribe,holeWizard.snapshot);
 const root=useRef<HTMLDivElement>(null);
 const hasSketch=p.getAction('sketch.finish').enabled;
 const sketchWorkspace=p.activeWorkspace==='sketch'&&hasSketch;
 useLayoutEffect(()=>bindActions(p.getAction));
 useEffect(()=>{if(p.activeWorkspace==='sketch'&&!hasSketch)p.setActiveWorkspace('solid');},[p.activeWorkspace,hasSketch,p.setActiveWorkspace]);
 useEffect(()=>{setMenus([]);},[p.activeWorkspace]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setMenus([]);};const key=(e:KeyboardEvent)=>{
  if(e.key==='Escape'){setMenus([]);setSearch('');}
  if(e.ctrlKey||e.altKey||e.metaKey||(e.target as Element).closest('input,textarea,select,[contenteditable]'))return;
  if(e.key.toLowerCase()==='h'&&holeWizard.snapshot().eligible&&holeWizard.snapshot().stage==='idle'){e.preventDefault();holeWizard.start();return;}
  if(e.key.toLowerCase()==='d'&&document.querySelector('.live-sketch-ribbon')){const a=contextualDimension(id=>action(id)!);if(a?.enabled){e.preventDefault();run(a.id);}return;}
  const id=({e:'part.extrude',f:'part.fillet',r:'sketch.rectangle',c:'sketch.circle',l:'sketch.line'} as Record<string,string>)[e.key.toLowerCase()];
  if(id&&action(id)?.enabled){e.preventDefault();run(id);}if(e.key.toLowerCase()==='s'){e.preventDefault();root.current?.querySelector<HTMLInputElement>('.live-search')?.focus();}
 };document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[]);
 const invoke=(id:string)=>{setMenus([]);run(id);};
 const isHole=(id:string)=>id==='FusionHoleCommand';
 const holeEnabled=holeState.eligible&&p.documentKind==='part'&&p.activeWorkspace==='solid'&&holeState.stage==='idle';
 const nativeEnabled=(id:string)=>isHole(id)?holeEnabled:!!forNative(id)?.enabled;
 const nativeReason=(id:string)=>isHole(id)?holeState.disabledReason:reason(forNative(id));
 const invokeNative=(id:string)=>{
  setMenus([]);
  if(isHole(id)){holeWizard.start();return;}
  const a=forNative(id);if(a?.enabled)run(a.id);
 };
 const group=(items:Item[],el:HTMLElement,level=0)=>{const r=el.getBoundingClientRect(),width=280;let left=level?r.right-1:r.left;if(left+width>innerWidth-5)left=level?Math.max(4,r.left-width):innerWidth-width-5;setMenus(prev=>[...prev.slice(0,level),{items,left:Math.max(4,left),top:Math.max(32,Math.min(level?r.top:r.bottom,innerHeight-120))}]);};
 const nativeButton=(id:string)=>{const a=forNative(id),name=nativeLabel(id),enabled=nativeEnabled(id);return <button key={id} type="button" className="live-tool" data-native-command={id} data-command-id={isHole(id)?'fusion.hole.guided':a?.id||nativeMap[id]} aria-label={name} disabled={!enabled} title={name+(isHole(id)?' · Сквозное отверстие, базовый режим':'')+(!enabled?' — '+nativeReason(id):'')} onClick={()=>invokeNative(id)}><LiveIcon id={id}/></button>;};
 const panel=(ref.panels as unknown as Record<string,{name:string;menu:Item[];promoted:Item[]}>);
 const active=ref.tabs.find(t=>t.id===tab)!;
 const sketchResults=search&&sketchWorkspace?sketchSearchItems.filter(item=>item.label.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))&&(!item.children||itemAction(item,p.getAction))).slice(0,15):[];
 const results=search?Object.entries(ref.commands).filter(([id])=>nativeLabel(id).toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).slice(0,15):[];
 return <div className="live-top" ref={root}>
  <div className="live-quickbar"><div className="live-quickbuttons">{['system.new','system.open','system.save','system.undo','system.redo'].map(id=>{const a=p.getAction(id);return <button key={id} type="button" disabled={!a.enabled} data-command-id={id} title={a.label} aria-label={a.label} onClick={()=>invoke(id)}><LiveIcon id={id} size={17}/></button>;})}</div><div className="live-document"><span className="live-document-cube">⬢</span>{p.documentTitle}{p.dirty?' *':''}</div><input className="live-search" aria-label="Поиск команд" placeholder="Поиск команд (S)" value={search} onChange={e=>setSearch(e.target.value)}/><span className="live-brand">ASA CAD</span></div>
  <section className="live-ribbon" aria-label="Лента инструментов"><div className="live-workspace">МОДЕЛЬ <span>⌄</span></div><div className="live-ribbon-content">
   <div className="live-tabs" role="tablist">{sketchWorkspace?<button role="tab" aria-selected="true">ЭСКИЗ</button>:ref.tabs.map(t=><button key={t.id} type="button" role="tab" aria-selected={tab===t.id} onClick={()=>{setTab(t.id);setMenus([]);}}>{tr(t.name).toLocaleUpperCase('ru')}</button>)}</div>
   <div className="live-groups">{sketchWorkspace?<SketchRibbon getAction={p.getAction}/>:active.panels.map(id=><section className="live-group" data-native-panel={id} key={id}><div className="live-tools">{panel[id].promoted.map(c=>nativeButton(c.commandId!))}</div><button className="live-group-title" data-native-group={id} type="button" aria-haspopup="menu" onClick={e=>menus.length?setMenus([]):group(panel[id].menu,e.currentTarget)}>{tr(panel[id].name)} <span>⌄</span></button></section>)}
   </div>
  </div></section>
  {menus.map((menu,level)=><div className="live-menu" key={level} role="menu" data-menu-level={level} style={{left:menu.left,top:menu.top,maxHeight:innerHeight-menu.top-8}} onKeyDown={e=>{const list=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=list.indexOf(document.activeElement as HTMLButtonElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();list[(i+(e.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();}if(e.key==='Escape'){e.stopPropagation();setMenus([]);}}}>
   {menu.items.map(c=>{if(c.kind==='SeparatorControl')return <hr key={c.id}/>;const a=c.commandId?forNative(c.commandId):null;const name=c.commandId?nativeLabel(c.commandId):tr(c.name||c.id);const enabled=c.commandId?nativeEnabled(c.commandId):false;return <button key={c.id} type="button" role="menuitem" data-native-menu-command={c.commandId} disabled={!c.children&&!enabled} title={!c.children&&!enabled?nativeReason(c.commandId||''):name} onPointerEnter={e=>{if(c.children)group(c.children,e.currentTarget,level+1);else setMenus(prev=>prev.slice(0,level+1));}} onClick={e=>c.children?group(c.children,e.currentTarget,level+1):invokeNative(c.commandId!)}><LiveIcon id={c.commandId||c.id} size={20}/><span>{name}</span><small>{c.children?'›':!a?.enabled?'—':''}</small></button>;})}
  </div>)}
  {search&&sketchWorkspace&&<div className="live-menu live-search-results" role="menu">{sketchResults.map(item=>{const a=itemAction(item,p.getAction);return <button key={item.id} type="button" role="menuitem" data-native-menu-command={item.nativeId} data-command-id={a?.id||item.actionId} disabled={!a?.enabled} title={item.label+(!a?.enabled?' — '+reason(a):'')} onClick={()=>{setSearch('');if(a?.enabled)invoke(a.id);}}><LiveIcon id={item.icon} size={20}/><span>{item.label}</span></button>;})}{!sketchResults.length&&<p>Команды не найдены</p>}</div>}
  {search&&!sketchWorkspace&&<div className="live-menu live-search-results" role="menu">{results.map(([id])=>{const enabled=nativeEnabled(id);return <button key={id} type="button" disabled={!enabled} title={!enabled?nativeReason(id):nativeLabel(id)} onClick={()=>{setSearch('');invokeNative(id);}}><LiveIcon id={id} size={20}/><span>{nativeLabel(id)}</span></button>;})}{!results.length&&<p>Команды не найдены</p>}</div>}
 </div>;
}
