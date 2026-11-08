import React from 'react';
import {action} from './liveActions';
import {holeWizard,type HoleState} from './HoleWizard';
import {LiveIcon} from './LiveIcon';

const steps=[
 {id:'support',label:'Опора'},
 {id:'circle',label:'Окружность'},
 {id:'finish',label:'Эскиз'},
 {id:'cut',label:'Вырез'},
] as const;
export function HoleWizardPanel({state,activeCommand,cancelActive}:{
 state:HoleState;activeCommand:string|null;cancelActive():void;
}){
 const step=state.stage==='complete'?4:steps.findIndex(s=>s.id===state.stage);
 const button=state.stage==='circle'
  ? {label:'Нарисовать окружность',execute:()=>holeWizard.beginCircle(),disabled:!!activeCommand||!action('sketch.circle')?.enabled}
  :state.stage==='finish'
  ? {label:'Завершить эскиз',execute:()=>holeWizard.finishSketch(),disabled:!!activeCommand||!action('sketch.finish')?.enabled}
  :state.stage==='cut'
  ? {label:'Вырезать сквозь тело',execute:()=>holeWizard.beginCut(),disabled:!!activeCommand||!action('part.cutExtrude')?.enabled}
  :null;
 return <aside className="live-hole-wizard" role="region" aria-label="Мастер сквозного отверстия" data-hole-stage={state.stage}>
  <header><LiveIcon id="FusionHoleCommand" size={27}/><div><strong>Отверстие</strong><small>Сквозное · базовый режим</small></div><button type="button" aria-label="Закрыть мастер отверстия" onClick={()=>holeWizard.dismiss(cancelActive)}>×</button></header>
  <div className="hole-steps">{steps.map((s,i)=><span key={s.id} data-hole-step={s.id} className={i===step?'current':i<step?'passed':''}>{i+1}. {s.label}</span>)}</div>
  {state.stage==='support'&&<p>Выберите плоскую грань тела и подтвердите создание эскиза в панели параметров. Опорная плоскость также поддерживается, если пересекает тело.</p>}
  {state.stage==='circle'&&<p>Создайте окружность. Положение задаётся двумя кликами мыши на эскизе; диаметр можно ввести в панели параметров справа.</p>}
  {state.stage==='finish'&&<p>Контур создан. Завершите эскиз, чтобы использовать его для реального выреза.</p>}
  {state.stage==='cut'&&<p>Выполните вырез «Через всё». Эта операция использует общий OpenCascade и сохраняется в истории.</p>}
  {state.stage==='complete'&&<p className="hole-done">Сквозное отверстие создано. Результат доступен в дереве модели и истории построения.</p>}
  <div role="status" className="hole-status">{state.message}</div>
  {button&&<button className="hole-primary" type="button" onClick={button.execute} disabled={button.disabled}>{button.label}</button>}
  {state.stage==='complete'&&<button className="hole-primary" type="button" onClick={()=>holeWizard.dismiss()}>Готово</button>}
  <footer>Резьба, зенковка и глухие отверстия пока не поддерживаются. Закрытие мастера не удаляет уже созданные операции.</footer>
 </aside>;
}