import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {action,run,repeat,lastAction,reason,forNative} from './liveActions';
import {LiveIcon} from './LiveIcon';
import {navigation} from './navigation';
import {holeWizard} from './HoleWizard';
import {requestSketchView,setSketchPanMode} from './sketchView';
import {contextualDimension} from './sketchCommands';
import './sketchMarking.css';

type Props={x:number;y:number;workspace?:'solid'|'sketch';selectionContext?:boolean;activeCommand?:string|null;commit:()=>void|Promise<void>;cancel:()=>void;close:()=>void};
type Slot={label:string;id?:string;native?:string;callback?:()=>void;enabled?:boolean;icon:string;submenu?:boolean};
type ContextGlyphName='ok'|'cancel'|'orbit'|'orbit-center'|'orbit-reset'|'configuration'|'selection-set'|'fixed'|'delete-coincident'|'blank';

function ContextGlyph({name}:{name:ContextGlyphName}){
 return <svg className="sketch-context-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
  {name==='ok'&&<path d="m2 9 4 4L16 3" fill="none" stroke="#6e9b59" strokeWidth="3" strokeLinejoin="round"/>}
  {name==='cancel'&&<path d="m3 3 12 12M15 3 3 15" fill="none" stroke="#e86464" strokeWidth="2.5"/>}
  {name==='orbit'&&<><ellipse cx="9" cy="9" rx="7" ry="3" fill="none" stroke="#7a8c91"/><path d="M9 2v14" stroke="#4d8da8"/><path d="m7 3 2-2 2 2" fill="none" stroke="#7a8c91"/></>}
  {name==='orbit-center'&&<><circle cx="9" cy="9" r="6" fill="#e5ece6" stroke="#9faa9e"/><circle cx="9" cy="9" r="3" fill="#82bf91"/></>}
  {name==='orbit-reset'&&<><circle cx="5" cy="12" r="4" fill="#88c79a"/><path d="M7 7h9M7 7l4-4M7 7l4 4" fill="none" stroke="#8d9694" strokeWidth="1.5"/></>}
  {name==='configuration'&&<><path d="M3 5h7v9H3ZM9 2h6v9H9Z" fill="#f4f6f7" stroke="#a4afb2"/><path d="m1 1 15 15" stroke="#d48f8f"/></>}
  {name==='selection-set'&&<><path d="M2 6h11v10H2Z" fill="#accb9f" stroke="#6f9673"/><path d="M5 3h10v10H5Z" fill="#f5f5e4" stroke="#7f9a79"/><path d="M13 1v5m-2-2h5" stroke="#d39a45" strokeWidth="1.5"/></>}
  {name==='fixed'&&<><rect x="4" y="7" width="10" height="9" rx=".5" fill="#f9d1d1" stroke="#df5c5c"/><path d="M6 7V4a3 3 0 0 1 6 0v3M9 10v3" fill="none" stroke="#df5c5c" strokeWidth="1.2"/></>}
  {name==='delete-coincident'&&<><path d="M2 2v14h14" fill="none" stroke="#888" strokeDasharray="2 2"/><path d="m5 3 9 10m0-10L5 13" fill="none" stroke="#d31818" strokeWidth="2"/></>}
 </svg>;
}

/** The radial and list delegate to the same product actions as the ribbon. */
export function MarkingMenu(p:Props){
 const [sketch,setSketch]=useState(false),[commandsOpen,setCommandsOpen]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 const editingSketch=p.workspace==='sketch';
 const [viewport,setViewport]=useState({width:innerWidth,height:innerHeight});
 const [sketchOrigin,setSketchOrigin]=useState({left:p.x,top:p.y});
 const [menuScale,setMenuScale]=useState(1);
 const choose=(fn:()=>void)=>{fn();p.close();};
 const last=lastAction(),lastLabel=last?action(last)?.label:null;
 const root:Slot[]=[
  {label:lastLabel?'Повторить: '+lastLabel:'Повторить',callback:repeat,enabled:!!last&&!!action(last)?.enabled,icon:editingSketch&&last?last:'system.redo'},
  {label:'Нажать/Вытянуть',native:'FusionPressPullCommand',icon:'FusionPressPullCommand'},
  {label:editingSketch?'Вернуть':'Повторить действие',id:'system.redo',icon:'system.redo'},
  {label:'Отверстие',native:'FusionHoleCommand',icon:'FusionHoleCommand'},
  {label:'Эскиз',callback:()=>setSketch(true),enabled:true,icon:'SketchCreate',submenu:true},
  {label:'Переместить/Копировать',native:'FusionMoveCommand',icon:'FusionMoveCommand'},
  {label:editingSketch?'Отменить':'Отменить действие',id:'system.undo',icon:'system.undo'},
  {label:'Удалить',id:'sketch.entity.delete',icon:'sketch.entity.delete'},
 ];
 const dimension=editingSketch?contextualDimension(id=>action(id)!):null;
 const sketchSlots:Slot[]=[
  {label:'Завершить эскиз',id:'sketch.finish',icon:'sketch.finish'},
  {label:'Прямоугольник',id:'sketch.rectangle',icon:'sketch.rectangle'},
  {label:editingSketch?'Сплайн по точкам':'Сплайн',icon:editingSketch?'sketch.native.DrawSpline':'sketch.line',enabled:false},
  {label:'Проецировать',icon:editingSketch?'sketch.native.ProjectNewCmd':'SketchCreate',enabled:false},
  {label:'Отрезок',id:'sketch.line',icon:'sketch.line'},
  {label:'Смещение',icon:editingSketch?'sketch.native.Offset':'sketch.line',enabled:false},
  {label:'Размер эскиза',id:dimension?.id??'dimension.linear',icon:'dimension.linear'},
  {label:editingSketch?'Окружность по центру':'Окружность',id:'sketch.circle',icon:'sketch.circle'},
 ];
 const resolve=(slot:Slot)=>slot.id?action(slot.id):slot.native?forNative(slot.native):null;
 const enabled=(slot:Slot)=>slot.enabled??(slot.native==='FusionHoleCommand'?holeWizard.snapshot().eligible&&holeWizard.snapshot().stage==='idle':!!resolve(slot)?.enabled);
 const execute=(slot:Slot)=>{
  if(!enabled(slot))return;
  if(slot.submenu){slot.callback?.();return;}
  if(slot.native==='FusionHoleCommand'){choose(()=>{holeWizard.start();});return;}
  choose(()=>slot.callback?slot.callback():run(resolve(slot)!.id));
 };
 const legacyPositions=[[0,-102],[105,-66],[127,-29],[108,8],[0,44],[-112,8],[-133,-29],[-107,-66]];
 const nativePositions=[[0,-68],[80,-32],[91,0],[80,32],[0,68],[-84,32],[-91,0],[-68,-32]];
 const nativeSketchPositions=[[0,0],[102,36],[119,68],[73,100],[0,136],[-67,100],[-125,68],[-114,36]];
 const positions=editingSketch?(sketch?nativeSketchPositions:nativePositions):legacyPositions;
 const origin=editingSketch?sketchOrigin:{left:Math.max(195,Math.min(innerWidth-195,p.x)),top:Math.max(240,Math.min(innerHeight-445,p.y))};
 const listTop=editingSketch?89:68;
 const listMaxHeight=editingSketch?Math.max(80,viewport.height-(sketch?252:194)):Math.max(150,innerHeight-origin.top-78);

 useEffect(()=>{ref.current?.focus();},[]);
 useEffect(()=>{
  if(!editingSketch)return;
  const resize=()=>setViewport({width:innerWidth,height:innerHeight});
  window.addEventListener('resize',resize);
  return()=>window.removeEventListener('resize',resize);
 },[editingSketch]);
 useLayoutEffect(()=>{
  if(!editingSketch||!ref.current)return;
  const host=ref.current.getBoundingClientRect();
  const boxes=[...ref.current.querySelectorAll<HTMLElement>('.marking-slot,.marking-list,.sketch-marking-home,.sketch-context-authored')].map(node=>node.getBoundingClientRect());
  if(!boxes.length)return;
  const left=Math.min(...boxes.map(box=>(box.left-host.left)/menuScale)),right=Math.max(...boxes.map(box=>(box.right-host.left)/menuScale));
  const top=Math.min(...boxes.map(box=>(box.top-host.top)/menuScale)),bottom=Math.max(...boxes.map(box=>(box.bottom-host.top)/menuScale));
  const scale=Math.min(1,Math.max(1,viewport.width-16)/Math.max(1,right-left),Math.max(1,viewport.height-16)/Math.max(1,bottom-top));
  const next={left:Math.max(8-left*scale,Math.min(viewport.width-8-right*scale,p.x)),top:Math.max(8-top*scale,Math.min(viewport.height-8-bottom*scale,p.y))};
  setMenuScale(previous=>Math.abs(previous-scale)<.0001?previous:scale);
  setSketchOrigin(previous=>Math.abs(previous.left-next.left)<.1&&Math.abs(previous.top-next.top)<.1?previous:next);
 },[editingSketch,sketch,commandsOpen,p.x,p.y,p.selectionContext,viewport.width,viewport.height,lastLabel,menuScale]);

 const normal=(label:string,id:string)=>{
  const a=action(id);
  return <button key={id} type="button" role="menuitem" data-context-command={id} disabled={!a?.enabled} title={!a?.enabled?reason(a):label} onClick={()=>choose(()=>run(id))}><LiveIcon id={id} size={19}/><span>{label}</span></button>;
 };
 const unsupported=(label:string)=><button type="button" key={label} role="menuitem" disabled title="Команда пока не реализована в общем ядре"><span className="marking-symbol" aria-hidden="true">—</span><span>{label}</span></button>;
 const sketchUnsupported=(label:string,key:string,icon:ContextGlyphName='blank',shortcut?:string,detail='Команда пока не подключена к общему ядру.')=><button type="button" role="menuitem" data-context-unavailable={key} disabled title={detail}><ContextGlyph name={icon}/><span>{label}</span>{shortcut&&<small>{shortcut}</small>}</button>;
 const fixed=action('constraint.fixed');
 const commandSection=<>
  <button type="button" role="menuitem" className="sketch-context-section" data-context-section="sketch-commands" aria-expanded={commandsOpen} aria-controls="sketch-context-commands" title="Дополнительные команды ASA-CAD" onClick={()=>setCommandsOpen(value=>!value)}><span className="marking-symbol" aria-hidden="true">{commandsOpen?'▾':'▸'}</span><span>Команды эскиза</span><small>ASA-CAD</small></button>
  {commandsOpen&&<div role="group" id="sketch-context-commands" aria-label="Команды эскиза" data-context-authored="true">
   {normal('Удалить выбранный элемент','sketch.entity.delete')}
   {normal('Вспомогательная геометрия','sketch.construction')}
   {normal('Горизонтальность','constraint.horizontal')}
   {normal('Вертикальность','constraint.vertical')}
   {normal('Зафиксировать','constraint.fixed')}<hr/>
   {normal('Линейный размер','dimension.linear')}
   {normal('Диаметр','dimension.diameter')}
   {normal('Радиус','dimension.radius')}<hr/>
   <button type="button" role="menuitem" onClick={()=>choose(()=>setSketchPanMode(true))}><span className="marking-symbol" aria-hidden="true">✥</span><span>Панорамирование</span></button>
   <button type="button" role="menuitem" onClick={()=>choose(()=>{requestSketchView('zoom-in');})}><span className="marking-symbol" aria-hidden="true">⌕+</span><span>Приблизить</span></button>
   <button type="button" role="menuitem" onClick={()=>choose(()=>{requestSketchView('zoom-out');})}><span className="marking-symbol" aria-hidden="true">⌕−</span><span>Отдалить</span></button>
   <button type="button" role="menuitem" onClick={()=>choose(()=>{requestSketchView('fit');})}><span className="marking-symbol" aria-hidden="true">▣</span><span>Показать весь эскиз</span></button>
  </div>}
 </>;
 const sketchList=<>
  <button type="button" role="menuitem" disabled={!p.activeCommand} title={!p.activeCommand?'Нет активной команды для подтверждения.':'Подтвердить текущую команду'} onClick={()=>{p.close();void p.commit();}}><ContextGlyph name="ok"/><span>ОК</span><small>Enter</small></button>
  <button type="button" role="menuitem" onClick={()=>choose(p.cancel)}><ContextGlyph name="cancel"/><span>Отмена</span><small>Esc</small></button>
  {!p.selectionContext&&<>
   {sketchUnsupported('Ограниченная орбита','orbit','orbit',undefined,'Вращение во время редактирования эскиза требует общего моста 3D-камеры и выбора.')}
   {sketchUnsupported('Задать центр орбиты','orbit-center','orbit-center',undefined,'Центр 3D-орбиты в активном эскизе пока недоступен.')}
   {sketchUnsupported('Сбросить центр орбиты','orbit-reset','orbit-reset',undefined,'Центр 3D-орбиты в активном эскизе пока недоступен.')}<hr/>
  </>}
  {sketchUnsupported('Сменить конфигурацию','configuration','configuration')}<hr/>
  {sketchUnsupported('Создать набор выбора','selection-set','selection-set')}<hr/>
  <button type="button" role="menuitem" data-context-command="constraint.fixed" disabled={!fixed?.enabled}
   title={fixed?.enabled?'Зафиксировать выбранный отрезок. Снятие фиксации пока не поддерживается.':reason(fixed)}
   onClick={()=>choose(()=>run('constraint.fixed'))}><ContextGlyph name="fixed"/><span>Зафиксировать</span></button>
  {sketchUnsupported('Удалить совпадения','delete-coincident','delete-coincident',undefined,'Команда «Удалить совпадения» пока не подключена.')}<hr/>
  {sketchUnsupported('Копировать','copy','blank','Ctrl+C')}<hr/>
  {sketchUnsupported('Найти в обозревателе','find-browser')}
  {sketchUnsupported('Найти в окне','find-window')}
 </>;

 return <div className="live-context live-marking" ref={ref} tabIndex={-1} role="menu" aria-label={editingSketch?'Контекстное меню эскиза':'Контекстное меню модели'} style={{...origin,...(editingSketch?{transform:'scale('+menuScale+')',transformOrigin:'0 0'}:{})}}
  data-marking-workspace={editingSketch?'sketch':'solid'} data-marking-context={p.selectionContext?'selection':'empty'}
  data-marking-reference-status={editingSketch?'verified':'existing'} data-marking-level={sketch?'sketch':'root'}
  onContextMenu={event=>event.preventDefault()} onKeyDown={event=>{
   if(event.key==='Escape'){event.stopPropagation();p.close();return;}
   if(event.key==='ArrowLeft'&&sketch){event.preventDefault();setSketch(false);setCommandsOpen(false);return;}
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();
   }
  }}>
  <div className="marking-center" aria-hidden="true"/>
  {(sketch?sketchSlots:root).map((slot,index)=><button key={(sketch?'sketch-':'root-')+index} type="button" role="menuitem" className="marking-slot" aria-label={slot.label} data-marking-slot={index} aria-haspopup={slot.submenu?'menu':undefined} disabled={!enabled(slot)} title={!enabled(slot)?slot.native==='FusionHoleCommand'?holeWizard.snapshot().disabledReason:reason(resolve(slot)):slot.label} style={{left:positions[index][0],top:positions[index][1]}}
   onMouseEnter={()=>{if(editingSketch&&slot.submenu&&enabled(slot))setSketch(true);}} onClick={()=>execute(slot)}><LiveIcon id={slot.icon} size={17}/><span>{slot.label}</span>{slot.submenu&&<b>▾</b>}</button>)}
  {editingSketch&&sketch?<>
   <button type="button" className="sketch-marking-home" role="menuitem" aria-label="Основное контекстное меню" data-context-back="root" title="Основное меню" onClick={()=>{setSketch(false);setCommandsOpen(false);}}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m3 10 7-7 7 7h-4v7H7v-7Z" fill="#303030"/></svg></button>
   <section className="live-menu sketch-context-authored" aria-label="Дополнительные команды ASA-CAD" style={{maxHeight:listMaxHeight}}>{commandSection}</section>
  </>:<div className="live-menu marking-list" style={{maxHeight:listMaxHeight,...(editingSketch?{top:listTop}:{})}}>
   {editingSketch?sketchList:<>
    {sketch&&<button type="button" role="menuitem" onClick={()=>setSketch(false)}><span>‹</span><span>Основное меню</span></button>}
    <button type="button" role="menuitem" disabled={!p.activeCommand} onClick={()=>{p.close();void p.commit();}}><span className="marking-symbol" aria-hidden="true">✓</span><span>ОК</span><small>Enter</small></button>
    <button type="button" role="menuitem" onClick={()=>choose(p.cancel)}><span className="marking-symbol cancel">×</span><span>Отмена</span><small>Esc</small></button>
    <button type="button" role="menuitem" onClick={()=>choose(()=>navigation.setMode('pan'))}><span className="marking-symbol" aria-hidden="true">✥</span><span>Панорамирование</span></button>
    <button type="button" role="menuitem" onClick={()=>choose(()=>navigation.setMode('zoom'))}><span className="marking-symbol" aria-hidden="true">⌕</span><span>Масштабирование</span></button>
    <button type="button" role="menuitem" title="Орбита" onClick={()=>choose(()=>navigation.setMode('orbit'))}><span className="marking-symbol" aria-hidden="true">⟳</span><span>Орбита</span></button>
    {unsupported('Задать центр орбиты')}{unsupported('Сбросить центр орбиты')}<hr/>{unsupported('Переключить конфигурацию')}{unsupported('Удалить из модели')}{unsupported('Показать все объекты')}{unsupported('Отменить изоляцию')}<hr/>{normal('Создать эскиз','part.sketch.create')}{normal('Выдавливание','part.extrude')}{normal('Вырезать выдавливанием','part.cutExtrude')}{normal('Скругление','part.fillet')}{normal('Вписать модель','view.fit')}
   </>}
  </div>}
 </div>;
}
