import {action,run} from './liveActions';

export type HoleStage='idle'|'support'|'circle'|'finish'|'cut'|'complete';
export interface HoleSketchSnapshot {
 id:string;
 entities:readonly {id:string;type:string}[];
}
export interface HoleFeatureSnapshot {
 id:string;
 type:string;
 sketchId?:string;
}
export interface HoleEditorSnapshot {
 documentId:string|null;
 activeWorkspace:string;
 activeCommand:string|null;
 activeSketchId:string|null;
 bodyCount:number;
 sketches:readonly HoleSketchSnapshot[];
 features:readonly HoleFeatureSnapshot[];
}
/**
 * Presentation-only orchestration of *existing* shared CadUiActions.
 * The wizard never creates geometry, calls app.execute or writes the document.
 */
export interface HoleState {
 stage:HoleStage;
 eligible:boolean;
 disabledReason:string;
 documentId:string|null;
 startSketchIds:readonly string[];
 startFeatureIds:readonly string[];
 holeSketchId:string|null;
 holeFeatureId:string|null;
 sawSupportCommand:boolean;
 message:string;
}
const defaultEditor:HoleEditorSnapshot={
 documentId:null,activeWorkspace:'solid',activeCommand:null,activeSketchId:null,
 bodyCount:0,sketches:[],features:[],
};
let editor:HoleEditorSnapshot=defaultEditor;
let state:HoleState={
 stage:'idle',eligible:false,disabledReason:'Сначала создайте тело выдавливанием',
 documentId:null,startSketchIds:[],startFeatureIds:[],
 holeSketchId:null,holeFeatureId:null,sawSupportCommand:false,message:'',
};
const subscribers=new Set<()=>void>();
function update(patch:Partial<HoleState>){
 const next={...state,...patch};
 if(JSON.stringify(next)===JSON.stringify(state))return;
 state=next;
 for(const fn of subscribers)fn();
}
function availability(e:HoleEditorSnapshot):{eligible:boolean;disabledReason:string}{
 if(!e.documentId)return {eligible:false,disabledReason:'Откройте документ «Деталь»'};
 if(!e.bodyCount)return {eligible:false,disabledReason:'Сначала постройте тело выдавливанием'};
 if(e.features.at(-1)?.type!=='extrude')return {eligible:false,disabledReason:'В этой версии сквозное отверстие доступно сразу после выдавливания'};
 if(e.activeWorkspace==='sketch'||e.activeSketchId)return {eligible:false,disabledReason:'Завершите текущий эскиз'};
 if(e.activeCommand)return {eligible:false,disabledReason:'Завершите текущую операцию'};
 if(!action('part.sketch.create')?.enabled)return {eligible:false,disabledReason:'Создание эскиза недоступно'};
 return {eligible:true,disabledReason:''};
}
export const holeWizard={
 subscribe(fn:()=>void){subscribers.add(fn);return ()=>{subscribers.delete(fn);};},
 snapshot:()=>state,
 sync(next:HoleEditorSnapshot){
  editor=next;
  const eligibility=availability(editor);
  if(state.stage==='idle'){
   update(eligibility);
   return;
  }
  if(next.documentId!==state.documentId){
   update({...eligibility,stage:'idle',message:'Документ изменился: мастер закрыт'});
   return;
  }
  if(state.stage==='support'){
   const newSketch=next.sketches.find(s=>!state.startSketchIds.includes(s.id));
   if(newSketch&&next.activeWorkspace==='sketch'&&next.activeSketchId===newSketch.id){
    update({...eligibility,stage:'circle',holeSketchId:newSketch.id,sawSupportCommand:true,message:'Эскиз создан на выбранной опоре'});
    return;
   }
   if(next.activeCommand==='part.sketch.create'){
    update({...eligibility,sawSupportCommand:true});
    return;
   }
   if(state.sawSupportCommand&&!next.activeCommand&&next.activeWorkspace==='solid'&&!newSketch){
    update({...eligibility,stage:'idle',message:'Создание эскиза отменено'});
    return;
   }
  }
  if(state.stage==='circle'){
   const created=next.sketches.find(s=>s.id===state.holeSketchId);
   if(!created||next.activeSketchId!==state.holeSketchId){
    update({...eligibility,stage:'idle',message:'Эскиз мастера изменился'});
    return;
   }
   if(created.entities.some(e=>e.type==='circle')&&!next.activeCommand){
    update({...eligibility,stage:'finish',message:'Контур отверстия построен'});
    return;
   }
  }
  if(state.stage==='finish'){
   const sketch=next.sketches.find(s=>s.id===state.holeSketchId);
   if(!sketch||!sketch.entities.some(e=>e.type==='circle')){
    update({...eligibility,stage:'idle',message:'Исходный профиль утрачен'});
    return;
   }
   if(next.activeWorkspace!=='sketch'&&!next.activeSketchId&&!next.activeCommand){
    update({...eligibility,stage:'cut',message:'Профиль готов к сквозному вырезу'});
    return;
   }
  }
  if(state.stage==='cut'){
   const cut=next.features.find(f=>!state.startFeatureIds.includes(f.id)&&f.type==='cut-extrude'&&f.sketchId===state.holeSketchId);
   if(cut&&!next.activeCommand){
    update({...eligibility,stage:'complete',holeFeatureId:cut.id,message:'Сквозное отверстие создано настоящим CAD-ядром'});
    return;
   }
  }
  update(eligibility);
 },
 start(){
  const ready=availability(editor);
  if(!ready.eligible){
   update({...ready,message:ready.disabledReason});
   return false;
  }
  update({
   ...ready,stage:'support',documentId:editor.documentId,
   startSketchIds:editor.sketches.map(s=>s.id),startFeatureIds:editor.features.map(f=>f.id),
   holeSketchId:null,holeFeatureId:null,sawSupportCommand:false,
   message:'Выберите опорную плоскость или грань',
  });
  run('part.sketch.create');
  return true;
 },
 beginCircle(){
  if(state.stage!=='circle'||editor.activeCommand||!action('sketch.circle')?.enabled)return false;
  run('sketch.circle');
  return true;
 },
 finishSketch(){
  if(state.stage!=='finish'||editor.activeCommand||!action('sketch.finish')?.enabled)return false;
  run('sketch.finish');
  return true;
 },
 beginCut(){
  if(state.stage!=='cut'||editor.activeCommand||!action('part.cutExtrude')?.enabled)return false;
  run('part.cutExtrude');
  return true;
 },
 dismiss(cancelActive?:()=>void){
  if(state.stage==='idle')return;
  if(editor.activeCommand&&cancelActive)cancelActive();
  update({...availability(editor),stage:'idle',holeSketchId:null,holeFeatureId:null,message:'Мастер закрыт. Ранее созданные операции сохранены в документе.'});
 },
};