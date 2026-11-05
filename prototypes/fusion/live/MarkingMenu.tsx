import React,{useEffect,useRef,useState} from 'react';
import {action,run,repeat,lastAction,reason,forNative} from './liveActions';
import {LiveIcon} from './LiveIcon';
import {navigation} from './navigation';
import {holeWizard} from './HoleWizard';
import {requestSketchView,setSketchPanMode} from './sketchView';
type Props={x:number;y:number;workspace?:'solid'|'sketch';activeCommand?:string|null;commit:()=>void|Promise<void>;cancel:()=>void;close:()=>void};
type Slot={label:string;id?:string;native?:string;callback?:()=>void;enabled?:boolean;icon:string;submenu?:boolean};
/** Radial/context presentation delegates to the same product action objects as the ribbon. */
export function MarkingMenu(p:Props){
 const [sketch,setSketch]=useState(p.workspace==='sketch'),ref=useRef<HTMLDivElement>(null);
 const editingSketch=p.workspace==='sketch';
 const choose=(fn:()=>void)=>{fn();p.close();};
 const last=lastAction(),lastLabel=last?action(last)?.label:null;
 const root:Slot[]=[
  {label:lastLabel?'Повторить: '+lastLabel:'Повторить',callback:repeat,enabled:!!last&&!!action(last)?.enabled,icon:'system.redo'},
  {label:'Нажать/Вытянуть',native:'FusionPressPullCommand',icon:'FusionPressPullCommand'},
  {label:'Повторить действие',id:'system.redo',icon:'system.redo'},
  {label:'Отверстие',native:'FusionHoleCommand',icon:'FusionHoleCommand'},
  {label:'Эскиз',callback:()=>setSketch(true),enabled:true,icon:'SketchCreate',submenu:true},
  {label:'Переместить/Копировать',native:'FusionMoveCommand',icon:'FusionMoveCommand'},
  {label:'Отменить действие',id:'system.undo',icon:'system.undo'},
  {label:'Удалить',id:'sketch.entity.delete',icon:'sketch.entity.delete'},
 ];
 const sketchSlots:Slot[]=[
  {label:'Завершить эскиз',id:'sketch.finish',icon:'sketch.finish'},
  {label:'Прямоугольник',id:'sketch.rectangle',icon:'sketch.rectangle'},
  {label:'Сплайн',icon:'sketch.line',enabled:false},
  {label:'Проецировать',icon:'SketchCreate',enabled:false},
  {label:'Отрезок',id:'sketch.line',icon:'sketch.line'},
  {label:'Смещение',icon:'sketch.line',enabled:false},
  {label:'Размер эскиза',id:'dimension.linear',icon:'dimension.linear'},
  {label:'Окружность',id:'sketch.circle',icon:'sketch.circle'},
 ];
 const resolve=(s:Slot)=>s.id?action(s.id):s.native?forNative(s.native):null;
 const enabled=(s:Slot)=>s.enabled??(s.native==='FusionHoleCommand'?holeWizard.snapshot().eligible&&holeWizard.snapshot().stage==='idle':!!resolve(s)?.enabled);
 const execute=(s:Slot)=>{if(!enabled(s))return;if(s.submenu){s.callback?.();return;}if(s.native==='FusionHoleCommand'){choose(()=>{holeWizard.start();});return;}choose(()=>s.callback?s.callback():run(resolve(s)!.id));};
 const positions=[[0,-102],[105,-66],[127,-29],[108,8],[0,44],[-112,8],[-133,-29],[-107,-66]];
 const origin={left:Math.max(195,Math.min(innerWidth-195,p.x)),top:Math.max(240,Math.min(innerHeight-445,p.y))};
 useEffect(()=>{ref.current?.focus();},[]);
 const normal=(label:string,id:string)=>{const a=action(id);return <button key={id} type="button" role="menuitem" data-context-command={id} disabled={!a?.enabled} title={!a?.enabled?reason(a):label} onClick={()=>choose(()=>run(id))}><LiveIcon id={id} size={19}/><span>{label}</span></button>;};
 const unsupported=(label:string)=><button type="button" key={label} role="menuitem" disabled title="Команда пока не реализована в общем ядре"><span className="marking-symbol" aria-hidden="true">—</span><span>{label}</span></button>;
 return <div className="live-context live-marking" ref={ref} tabIndex={-1} role="menu" aria-label="Контекстное меню модели" style={origin} data-marking-level={sketch?'sketch':'root'} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{
  if(e.key==='Escape'){e.stopPropagation();p.close();return;}if(e.key==='ArrowLeft'&&sketch&&!editingSketch){e.preventDefault();setSketch(false);return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const bs=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=bs.indexOf(document.activeElement as HTMLButtonElement);bs[e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowUp'?-1:1)+bs.length)%bs.length]?.focus();}
 }}>
  <div className="marking-center" aria-hidden="true"/>
  {(sketch?sketchSlots:root).map((s,i)=><button key={(sketch?'sketch-':'root-')+i} type="button" role="menuitem" className="marking-slot" aria-label={s.label} data-marking-slot={i} aria-haspopup={s.submenu?'menu':undefined} disabled={!enabled(s)} title={!enabled(s)?s.native==='FusionHoleCommand'?holeWizard.snapshot().disabledReason:reason(resolve(s)):s.label} style={{left:positions[i][0],top:positions[i][1]}} onClick={()=>execute(s)}><LiveIcon id={s.icon} size={17}/><span>{s.label}</span>{s.submenu&&<b>▾</b>}</button>)}
  <div className="live-menu marking-list" style={{maxHeight:Math.max(150,innerHeight-origin.top-78)}}>
   {sketch&&!editingSketch&&<button type="button" role="menuitem" onClick={()=>setSketch(false)}><span>‹</span><span>Основное меню</span></button>}
   <button type="button" role="menuitem" disabled={!p.activeCommand} onClick={()=>{p.close();void p.commit();}}><span className="marking-symbol" aria-hidden="true">✓</span><span>ОК</span><small>Enter</small></button>
   <button type="button" role="menuitem" onClick={()=>choose(p.cancel)}><span className="marking-symbol cancel">×</span><span>Отмена</span><small>Esc</small></button>
   <button type="button" role="menuitem" onClick={()=>choose(()=>editingSketch?setSketchPanMode(true):navigation.setMode('pan'))}><span className="marking-symbol" aria-hidden="true">✥</span><span>Панорамирование</span></button>
   {editingSketch?<><button type="button" role="menuitem" onClick={()=>choose(()=>{requestSketchView('zoom-in');})}><span className="marking-symbol">⌕+</span><span>Приблизить</span></button><button type="button" role="menuitem" onClick={()=>choose(()=>{requestSketchView('zoom-out');})}><span className="marking-symbol">⌕−</span><span>Отдалить</span></button></>:<button type="button" role="menuitem" onClick={()=>choose(()=>navigation.setMode('zoom'))}><span className="marking-symbol" aria-hidden="true">⌕</span><span>Масштабирование</span></button>}
   <button type="button" role="menuitem" disabled={editingSketch} title={editingSketch?'Вращение при редактировании эскиза пока недоступно':'Орбита'} onClick={()=>choose(()=>navigation.setMode('orbit'))}><span className="marking-symbol" aria-hidden="true">⟳</span><span>Орбита</span></button>
   {editingSketch?<><hr/>{normal('Удалить выбранный элемент','sketch.entity.delete')}{normal('Вспомогательная геометрия','sketch.construction')}{normal('Горизонтальность','constraint.horizontal')}{normal('Вертикальность','constraint.vertical')}{normal('Зафиксировать','constraint.fixed')}<hr/>{normal('Линейный размер','dimension.linear')}{normal('Диаметр','dimension.diameter')}{normal('Радиус','dimension.radius')}<button type="button" role="menuitem" onClick={()=>choose(()=>{requestSketchView('fit');})}>Показать весь эскиз</button></>:<>{unsupported('Задать центр орбиты')}{unsupported('Сбросить центр орбиты')}<hr/>{unsupported('Переключить конфигурацию')}{unsupported('Удалить из модели')}{unsupported('Показать все объекты')}{unsupported('Отменить изоляцию')}<hr/>{normal('Создать эскиз','part.sketch.create')}{normal('Выдавливание','part.extrude')}{normal('Вырезать выдавливанием','part.cutExtrude')}{normal('Скругление','part.fillet')}{normal('Вписать модель','view.fit')}</>}
  </div>
 </div>;
}
