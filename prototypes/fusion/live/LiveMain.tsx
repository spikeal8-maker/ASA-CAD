import React,{useEffect,useState,useSyncExternalStore} from 'react';
import type {CadShellMainProps} from '../../../src/web/CadShellMain';
import type {DocumentTreeProps} from '../../../src/web/DocumentTree';
import type {ParameterPanelProps} from '../../../src/web/ParameterPanel';
import {LiveParameters} from './LiveParameters';
import {LiveIcon} from './LiveIcon';
import {ViewCube} from './ViewCube';
import {MarkingMenu} from './MarkingMenu';
import {HoleWizardPanel} from './HoleWizardPanel';
import {holeWizard} from './HoleWizard';
import {navigation} from './navigation';
import {action,run,repeat,lastAction,reason} from './liveActions';
import type {CadRenderModel} from '../../../src/contracts/render';
export function CadShellMain(p:CadShellMainProps){
 const [treeOpen,setTreeOpen]=useState(true),[context,setContext]=useState<{x:number;y:number}|null>(null);
 const view=useSyncExternalStore(navigation.subscribe,navigation.snapshot);
 const holeState=useSyncExternalStore(holeWizard.subscribe,holeWizard.snapshot);
 const tree=React.isValidElement<DocumentTreeProps>(p.treeContent)?p.treeContent.props:null;
 const params=React.isValidElement<ParameterPanelProps>(p.parametersContent)?p.parametersContent.props:null;
 const part=tree?.document.kind==='part'?tree.document:null;
 const modelProps=React.isValidElement<{renderModel?:CadRenderModel|null;activeWorkspace:string}>(p.modelContent)?p.modelContent.props:null;
 const renderModel=modelProps?.renderModel||null;
 useEffect(()=>{navigation.setBounds(renderModel?.bounds||null);},[renderModel]);
 useEffect(()=>{holeWizard.sync({
  documentId:part?.documentId||null,activeWorkspace:modelProps?.activeWorkspace||'solid',
  activeCommand:p.activeCommand||null,activeSketchId:tree?.activeSketchId||null,
  bodyCount:part?.bodies.length||0,
  sketches:(part?.sketches||[]).map(s=>({id:s.id,entities:s.entities.map(e=>({id:e.id,type:e.type}))})),
  features:(part?.features||[]).map(f=>({id:f.id,type:f.type,sketchId:(f.parameters as {sketchId?:string}).sketchId})),
 });},[part,modelProps?.activeWorkspace,p.activeCommand,tree?.activeSketchId]);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!(e.target as Element).closest('.live-context'))setContext(null);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setContext(null);navigation.setMode('select');}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[]);
 function fit(){run('view.fit');}
 return <main className="live-workarea" data-active-command={p.activeCommand||''}>
  <section className="live-scene" aria-label="Область моделирования" onContextMenu={e=>{e.preventDefault();setContext({x:Math.min(e.clientX,innerWidth-265),y:Math.min(e.clientY,innerHeight-305)});}}>{p.modelContent}</section>
  <aside className={'live-tree '+(!treeOpen?'collapsed':'')}><header><button type="button" aria-label={treeOpen?'Свернуть обозреватель':'Развернуть обозреватель'} onClick={()=>setTreeOpen(v=>!v)}>{treeOpen?'«':'»'}</button><span>ОБОЗРЕВАТЕЛЬ</span><button type="button" aria-label="Скрыть дерево" onClick={()=>setTreeOpen(false)}>−</button></header>{treeOpen&&p.treeContent}</aside>
  <ViewCube/>
  {holeState.stage!=='idle'&&<HoleWizardPanel state={holeState} activeCommand={p.activeCommand||null} cancelActive={p.cancelCommand}/>}
  {p.activeCommand&&params&&<LiveParameters panel={params} fallback={p.parametersContent}/>}
  <div className="live-navigation" role="toolbar" aria-label="Навигация по модели">
   <button type="button" aria-label="Орбита" title="Орбита · Shift + средняя кнопка" aria-pressed={view.mode==='orbit'} onClick={()=>navigation.setMode(view.mode==='orbit'?'select':'orbit')}>⟳</button>
   <button type="button" aria-label="Панорамирование" title="Панорамирование · средняя кнопка" aria-pressed={view.mode==='pan'} onClick={()=>navigation.setMode(view.mode==='pan'?'select':'pan')}>✥</button>
   <button type="button" aria-label="Выбор объектов" title="Выбор объектов" aria-pressed={view.mode==='select'} onClick={()=>navigation.setMode('select')}>↖</button><i/>
   <button type="button" aria-label="Приблизить" title="Приблизить" onClick={()=>navigation.zoom(.8)}>⌕+</button><button type="button" aria-label="Отдалить" title="Отдалить" onClick={()=>navigation.zoom(1.25)}>⌕−</button>
   <button type="button" aria-label="Показать всё" title="Показать всё" onClick={fit}>▣</button><button type="button" aria-label="Главный вид модели" title="Главный вид" onClick={()=>navigation.home()}>⌂</button>
  </div>
  <div className="live-timeline" aria-label="История построения">{part?.sketches.map(s=><button type="button" key={s.id} data-timeline-sketch={s.id} title={'Редактировать '+s.name} onClick={()=>tree?.onEditSketch(s.id)}><LiveIcon id="SketchCreate" size={22}/></button>)}{part?.features.map(f=><span key={f.id} data-timeline-feature={f.id} title={f.name}><LiveIcon id={f.type==='extrude'?'Extrude':f.type==='fillet'?'FusionFilletEdgesCommand':'part.cutExtrude'} size={23}/></span>)}<b className="live-timeline-cursor"/></div>
  {context&&<MarkingMenu x={context.x} y={context.y} activeCommand={p.activeCommand} commit={p.commitActiveCommand} cancel={p.cancelCommand} close={()=>setContext(null)}/>}

 </main>;
}
