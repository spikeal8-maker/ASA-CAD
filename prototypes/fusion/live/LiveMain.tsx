import React,{useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {CadShellMainProps} from '../../../src/web/CadShellMain';
import type {DocumentTreeProps} from '../../../src/web/DocumentTree';
import type {ParameterPanelProps} from '../../../src/web/ParameterPanel';
import type {PartModelStageProps} from '../../../src/web/PartModelStage';
import {LiveParameters} from './LiveParameters';
import {LiveIcon} from './LiveIcon';
import {ViewCube} from './ViewCube';
import {MarkingMenu} from './MarkingMenu';
import {HoleWizardPanel} from './HoleWizardPanel';
import {SketchPalette} from './SketchPalette';
import {SketchPlaneCube} from './SketchPlaneCube';
import {useSketchView,toggleSketchDisplay,requestSketchView,setSketchPanMode,registerSketchDimensionEditor,requestSketchWorkspaceExit} from './sketchView';
import {holeWizard} from './HoleWizard';
import {navigation} from './navigation';
import {action,run,repeat,lastAction,reason} from './liveActions';
import type {CadDimensionId} from '../../../src/contracts/ids';
export function CadShellMain(p:CadShellMainProps){
 const [treeOpen,setTreeOpen]=useState(true),[context,setContext]=useState<{x:number;y:number;selectionContext:boolean}|null>(null);
 const contextFrame=useRef<number|null>(null);
 const closeContext=useCallback(()=>{if(contextFrame.current!==null)cancelAnimationFrame(contextFrame.current);contextFrame.current=null;setContext(null);},[]);
 const [editingDimensionId,setEditingDimensionId]=useState<CadDimensionId|null>(null);
 const view=useSyncExternalStore(navigation.subscribe,navigation.snapshot);
 const sketchView=useSketchView();
 const holeState=useSyncExternalStore(holeWizard.subscribe,holeWizard.snapshot);
 const tree=React.isValidElement<DocumentTreeProps>(p.treeContent)?p.treeContent.props:null;
 const params=React.isValidElement<ParameterPanelProps>(p.parametersContent)?p.parametersContent.props:null;
 const part=tree?.document.kind==='part'?tree.document:null;
 const modelProps=React.isValidElement<PartModelStageProps>(p.modelContent)?p.modelContent.props:null;
 const renderModel=modelProps?.renderModel||null;
 const activeSketch=part?.sketches.find(s=>s.id===tree?.activeSketchId);
 const sketchMode=modelProps?.activeWorkspace==='sketch'&&!!activeSketch;
 const selectedEntity=activeSketch?.entities.find(e=>e.id===p.selectedSketchEntityId);
 const editingDimension=part?.dimensions.find(d=>d.id===editingDimensionId);
 const dimensionEditUnit=editingDimension?(editingDimension.type==='angular'?'°':'мм'):'';
 const editDimension=useCallback((id:CadDimensionId)=>{if(tree){setEditingDimensionId(id);tree.onEditDimension(id);}},[tree?.onEditDimension]);
 const treeContent=tree?React.cloneElement(p.treeContent as React.ReactElement<DocumentTreeProps>,{onEditDimension:editDimension}):p.treeContent;
 const orphanedSketchTool=!!part&&!activeSketch&&/^(sketch|constraint)\./.test(p.activeCommand||'');
 useEffect(()=>{if(orphanedSketchTool){p.cancelCommand();requestSketchWorkspaceExit();}},[orphanedSketchTool,p.cancelCommand]);
 function cancel(){
  if(!p.activeCommand)return;
  p.cancelCommand();
  if(sketchMode&&p.activeCommand==='dimension.edit'&&tree?.activeSketchId)tree.onEditSketch(tree.activeSketchId);
 }
 const dimensionCreation=params?.dimensionCreation;
 const missingDimensionTarget=!!dimensionCreation?.mode&&[dimensionCreation.entityId,dimensionCreation.secondaryEntityId].some(id=>id&&!activeSketch?.entities.some(entity=>entity.id===id));
 const missingEditedDimension=p.activeCommand==='dimension.edit'&&!!editingDimensionId&&!editingDimension;
 useEffect(()=>{if(missingDimensionTarget)dimensionCreation?.cancel();},[missingDimensionTarget,dimensionCreation?.cancel]);
 useEffect(()=>{if(missingEditedDimension)cancel();},[missingEditedDimension]);
 const liveParams=params?{...params,onCancel:cancel}:null;
 useEffect(()=>tree?registerSketchDimensionEditor(editDimension):undefined,[editDimension,!!tree]);
 useEffect(()=>{if(p.activeCommand!=='dimension.edit')setEditingDimensionId(null);},[p.activeCommand]);
 useEffect(()=>{navigation.setBounds(renderModel?.bounds||null);},[renderModel]);
 useEffect(()=>{holeWizard.sync({
  documentId:part?.documentId||null,activeWorkspace:modelProps?.activeWorkspace||'solid',
  activeCommand:p.activeCommand||null,activeSketchId:tree?.activeSketchId||null,
  bodyCount:part?.bodies.length||0,
  sketches:(part?.sketches||[]).map(s=>({id:s.id,entities:s.entities.map(e=>({id:e.id,type:e.type}))})),
  features:(part?.features||[]).map(f=>({id:f.id,type:f.type,sketchId:(f.parameters as {sketchId?:string}).sketchId})),
 });},[part,modelProps?.activeWorkspace,p.activeCommand,tree?.activeSketchId]);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!(e.target as Element).closest('.live-context'))closeContext();};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){closeContext();navigation.setMode('select');setSketchPanMode(false);}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);if(contextFrame.current!==null)cancelAnimationFrame(contextFrame.current);};},[closeContext]);
 function fit(){if(sketchMode)requestSketchView('fit');else run('view.fit');}
 function openContext(e:React.MouseEvent<HTMLElement>){
  e.preventDefault();
  let selectionContext=false;
  if(sketchMode&&!p.activeCommand){
   const target=e.target instanceof Element?e.target:null;
   const entityId=target?.closest('[data-sketch-select-id]')?.getAttribute('data-sketch-select-id');
   const entity=activeSketch?.entities.find(item=>item.id===entityId);
   if(entity){modelProps?.onSketchEntitySelect(entity.id);selectionContext=true;}
   else{
    // The public null-selection callback clears the shared sketch selection.
    // A profile/empty context must never act on a previously selected entity.
    modelProps?.onBodySelect(null);
    // Test the already rendered profile. It remains a presentation hit, with
    // no second profile model and no fabricated product selection operation.
    for(const path of e.currentTarget.querySelectorAll<SVGGeometryElement>('[data-sketch-layer="profiles"] path')){
     const matrix=path.getScreenCTM();
     if(matrix&&path.isPointInFill(new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()))){selectionContext=true;break;}
    }
   }
  }
  const nextContext={x:sketchMode?e.clientX:Math.min(e.clientX,innerWidth-265),y:sketchMode?e.clientY:Math.min(e.clientY,innerHeight-305),selectionContext};
  // The shared selection and LiveTop's action bridge commit before menu mount.
  // This avoids rendering availability from the previous selected entity.
  if(contextFrame.current!==null)cancelAnimationFrame(contextFrame.current);
  if(sketchMode)contextFrame.current=requestAnimationFrame(()=>{contextFrame.current=null;setContext(nextContext);});else setContext(nextContext);
 }
 function sketchKeys(e:React.KeyboardEvent<HTMLElement>){
  if(!sketchMode)return;
  if(e.key==='Escape'&&p.activeCommand==='dimension.edit'){e.preventDefault();e.stopPropagation();cancel();return;}
  if((e.target as Element).closest('input,textarea,select,button,[role="button"],[role="menu"],[contenteditable]'))return;
  const key=e.key.toLowerCase(),ctrl=e.ctrlKey||e.metaKey;
  const command=!ctrl&&!e.altKey&&key==='f'?'fit':ctrl&&(key==='+'||key==='=')?'zoom-in':ctrl&&key==='-'?'zoom-out':null;
  if(command){e.preventDefault();e.stopPropagation();requestSketchView(command);return;}
  if(e.key==='Enter'&&p.activeCommand){e.preventDefault();e.stopPropagation();void Promise.resolve(p.commitActiveCommand()).catch(error=>window.dispatchEvent(new CustomEvent('asa-live-error',{detail:String(error)})));}
 }
 return <main className="live-workarea" data-workspace={sketchMode?'sketch':'solid'} data-active-command={p.activeCommand||''}
  onKeyDown={sketchKeys}>
  <section className="live-scene" aria-label="Область моделирования" onContextMenu={openContext}>{p.modelContent}</section>
  <aside className={'live-tree '+(!treeOpen?'collapsed':'')}><header><button type="button" aria-label={treeOpen?'Свернуть обозреватель':'Развернуть обозреватель'} onClick={()=>setTreeOpen(v=>!v)}>{treeOpen?'«':'»'}</button><span>ОБОЗРЕВАТЕЛЬ</span><button type="button" aria-label="Скрыть дерево" onClick={()=>setTreeOpen(false)}>−</button></header>{treeOpen&&treeContent}</aside>
  {sketchMode?<SketchPlaneCube view={sketchView}/>:<ViewCube/>}
  {holeState.stage!=='idle'&&<HoleWizardPanel state={holeState} activeCommand={p.activeCommand||null} cancelActive={p.cancelCommand}/>}
  {sketchMode?<SketchPalette settings={sketchView.settings} unavailable={sketchView.unavailable}
    onToggle={toggleSketchDisplay} supportLabel={sketchView.active?.supportLabel||activeSketch?.support||'Эскиз'}
    onLookAt={()=>requestSketchView('look-at')} construction={action('sketch.construction')}
    constructionChecked={selectedEntity?.type==='line'&&!!selectedEntity.data.construction} finish={action('sketch.finish')}
    parameters={p.activeCommand&&liveParams?<LiveParameters panel={liveParams} fallback={p.parametersContent} dimensionEditUnit={dimensionEditUnit} embedded/>:null}/>
    :p.activeCommand&&liveParams&&<LiveParameters panel={liveParams} fallback={p.parametersContent} dimensionEditUnit={dimensionEditUnit}/>}
  <div className="live-navigation" role="toolbar" aria-label="Навигация по модели">
   <button type="button" aria-label="Орбита" disabled={sketchMode} title={sketchMode?'Вращение при редактировании эскиза пока недоступно':'Орбита · Shift + средняя кнопка'} aria-pressed={!sketchMode&&view.mode==='orbit'} onClick={()=>navigation.setMode(view.mode==='orbit'?'select':'orbit')}>⟳</button>
   <button type="button" aria-label="Панорамирование" title="Панорамирование · средняя кнопка" aria-pressed={sketchMode?sketchView.panMode:view.mode==='pan'} onClick={()=>sketchMode?setSketchPanMode(!sketchView.panMode):navigation.setMode(view.mode==='pan'?'select':'pan')}>✥</button>
   <button type="button" aria-label="Выбор объектов" title="Выбор объектов" aria-pressed={sketchMode?!sketchView.panMode:view.mode==='select'} onClick={()=>sketchMode?setSketchPanMode(false):navigation.setMode('select')}>↖</button><i/>
   <button type="button" aria-label="Приблизить" title="Приблизить" onClick={()=>sketchMode?requestSketchView('zoom-in'):navigation.zoom(.8)}>⌕+</button><button type="button" aria-label="Отдалить" title="Отдалить" onClick={()=>sketchMode?requestSketchView('zoom-out'):navigation.zoom(1.25)}>⌕−</button>
   <button type="button" aria-label="Показать всё" title="Показать всё" onClick={fit}>▣</button><button type="button" aria-label="Главный вид модели" title="Главный вид" onClick={()=>sketchMode?requestSketchView('reset'):navigation.home()}>⌂</button>
  </div>
  <div className="live-timeline" aria-label="История построения">{part?.sketches.map(s=><button type="button" key={s.id} data-timeline-sketch={s.id} title={'Редактировать '+s.name} onClick={()=>tree?.onEditSketch(s.id)}><LiveIcon id="SketchCreate" size={22}/></button>)}{part?.features.map(f=><span key={f.id} data-timeline-feature={f.id} title={f.name}><LiveIcon id={f.type==='extrude'?'Extrude':f.type==='fillet'?'FusionFilletEdgesCommand':'part.cutExtrude'} size={23}/></span>)}<b className="live-timeline-cursor"/></div>
  {context&&<MarkingMenu x={context.x} y={context.y} selectionContext={context.selectionContext} workspace={sketchMode?'sketch':'solid'} activeCommand={p.activeCommand} commit={p.commitActiveCommand} cancel={cancel} close={closeContext}/>}

 </main>;
}
