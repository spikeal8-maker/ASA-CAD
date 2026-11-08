import React,{useRef,useState} from 'react';
import type {ParameterPanelProps} from '../ParameterPanel';
import {action,run} from './liveActions';
import {LiveIcon} from './LiveIcon';
type Props={panel:ParameterPanelProps;fallback:React.ReactNode;embedded?:boolean;dimensionEditUnit?:string};
const names:Record<string,string>={'part.sketch.create':'Создать эскиз','sketch.line':'Отрезок','sketch.arc':'Дуга','sketch.rectangle':'Прямоугольник','sketch.circle':'Окружность','part.extrude':'Выдавливание','part.cutExtrude':'Выдавливание — вырез','part.fillet':'Скругление','dimension.edit':'Изменить размер'};
function Field({name,children}:{name:string;children:React.ReactNode}){return <label className="live-param-row"><span>{name}</span><div>{children}</div></label>;}
function Numeric({name,value,onChange,unit='мм'}:{name:string;value:number;onChange:(n:number)=>void;unit?:string}){return <Field name={name}><input type="number" step="any" aria-label={name} value={Number.isFinite(value)?value:''} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value))}/><small>{unit}</small></Field>;}
const constraintHints:Record<string,string>={
 'constraint.coincident':'Укажите две конечные точки, которые должны совпадать.',
 'constraint.parallel':'Последовательно выберите два отрезка.',
 'constraint.perpendicular':'Последовательно выберите два отрезка.',
 'constraint.tangent':'Выберите отрезок и окружность.',
 'constraint.concentric':'Выберите две окружности с общим центром.',
 'constraint.equal':'Выберите два отрезка одинаковой длины.',
 'constraint.symmetric':'Укажите две точки, затем отрезок — ось симметрии.',
 'constraint.pointOnCurve':'Укажите конец одного отрезка, затем другой отрезок.',
};
export function LiveParameters({panel:p,fallback,embedded=false,dimensionEditUnit=''}:Props){
 const [collapsed,setCollapsed]=useState(false),[position,setPosition]=useState<{x:number;y:number}|null>(null),[busy,setBusy]=useState(false);
 const box=useRef<HTMLElement>(null),drag=useRef<{dx:number;dy:number}|null>(null);
 const id=p.activeCommand||'',x=p.extrude;
 let content:React.ReactNode=null,submit:(()=>void|Promise<void>)|null=null,valid=true;
 if(id==='part.sketch.create'){
  content=<><Field name="Плоскость">{p.requiresFaceSelection?<span>{p.selectedPick?.kind==='face'?'Грань выбрана':'Выберите грань на модели'}</span>:<select aria-label="Плоскость эскиза" value={p.sketchPlane} onChange={e=>p.setSketchPlane(e.target.value as 'XY'|'XZ'|'YZ')}>{['XY','XZ','YZ'].map(v=><option key={v}>{v}</option>)}</select>}</Field><p className="live-param-note">Опору также можно выбрать в рабочей области или дереве.</p></>;
  submit=p.onCreateSketch;valid=!p.requiresFaceSelection||p.selectedPick?.kind==='face';
 }else if(id==='sketch.line'||id==='sketch.arc'){
  content=embedded&&id==='sketch.line'?<div className="sketch-palette-native-row sketch-palette-feature-row">
   <span>Отрезок</span><div className="sketch-palette-line-buttons">
    <button type="button" aria-label="Отрезок по двум точкам" aria-pressed="true" title="Укажите начальную и конечную точки. Esc завершает ввод." onClick={()=>run('sketch.line')}><LiveIcon id="sketch.line" size={24}/></button>
    <button type="button" aria-label="Другой вариант линии — недоступен" title="Этот вариант инструмента пока не подключён." disabled><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 21 18-18" fill="none" stroke="#818181" strokeWidth="1.5" strokeDasharray="7 3"/></svg></button>
   </div>
  </div>:<><p className="live-param-note">{id==='sketch.line'?'Укажите начальную и конечную точки отрезка левой кнопкой мыши.':'Укажите центр, начальную и конечную точки дуги левой кнопкой мыши.'}</p><p className="live-param-note">Колесо мыши изменяет масштаб плоскости эскиза. Esc отменяет текущий ввод, сохраняя уже построенные элементы.</p><button type="button" onClick={p.onCancel}>Завершить ввод</button></>;
 }else if(id==='sketch.rectangle'){
  content=<><Numeric name="Ширина" value={p.rectangleWidth} onChange={p.setRectangleWidth}/><Numeric name="Высота" value={p.rectangleHeight} onChange={p.setRectangleHeight}/><p className="live-param-note">Задайте размеры или укажите две точки на плоскости эскиза.</p></>;
  submit=p.onCreateRectangle;valid=Number.isFinite(p.rectangleWidth)&&p.rectangleWidth>0&&Number.isFinite(p.rectangleHeight)&&p.rectangleHeight>0;
 }else if(id==='sketch.circle'){
  content=<><Numeric name="Диаметр" value={p.circleDiameter} onChange={p.setCircleDiameter}/><p className="live-param-note">Центр и радиус также задаются мышью на эскизе.</p></>;submit=p.onCreateCircle;valid=Number.isFinite(p.circleDiameter)&&p.circleDiameter>0;
 }else if(id==='part.extrude'||id==='part.cutExtrude'){
  const cut=id==='part.cutExtrude';content=<><Field name="Профиль"><span className="live-selected-value">{x.profileName||'Не выбран'}</span></Field><Field name="Начало"><span>Плоскость профиля</span></Field>
   {!cut&&<><Field name="Направление"><select aria-label="Направление" value={x.symmetric?'symmetric':x.reverse?'reverse':'forward'} onChange={e=>{const v=e.target.value;if(v==='symmetric')x.setSymmetric(true);else{x.setSymmetric(false);if((v==='reverse')!==x.reverse)x.toggleReverse();}}}><option value="forward">В одну сторону</option><option value="reverse">В обратную сторону</option><option value="symmetric">Симметрично</option></select></Field><Numeric name="Расстояние" value={x.distance} onChange={x.setDistance}/></>}
   {cut&&<Field name="Протяжённость"><span>Через всё</span></Field>}
   <Field name="Операция"><select aria-label="Операция" value={cut?'cut':'new'} onChange={e=>run(e.target.value==='cut'?'part.cutExtrude':'part.extrude')}><option value="new" disabled={!action('part.extrude')?.enabled}>Новое тело</option><option value="cut" disabled={!action('part.cutExtrude')?.enabled}>Вырезание</option></select></Field>{x.validationError&&!cut&&<p role="alert" className="live-param-error">{x.validationError}</p>}</>;
  submit=cut?p.onCut:x.commit;valid=cut?!!x.profileId:!x.validationError&&!!x.profileId;
 }else if(id==='part.fillet'){
  content=<><Field name="Рёбра"><span>{p.selectedPick?.kind==='edge'?'Ребро выбрано':'Выберите ребро в модели'}</span></Field><Numeric name="Радиус" value={p.filletRadius} onChange={p.setFilletRadius}/></>;
  submit=p.onFillet;valid=p.selectedPick?.kind==='edge'&&Number.isFinite(p.filletRadius)&&p.filletRadius>0;
 }else if(p.dimensionCreation.mode){
  const d=p.dimensionCreation,angular=d.mode==='angular';
  content=<><Field name="Объект"><span>{d.targetKind==='line-pair'?(d.secondaryEntityId?'Выбраны два отрезка':'Выберите два отрезка'):d.targetKind==='circle'?'Окружность':d.targetKind==='arc'?'Дуга':'Отрезок'}</span></Field><Numeric name={angular?'Угол':'Размер'} value={d.value} onChange={d.setValue} unit={angular?'°':'мм'}/><p className="live-param-note">Изменение размера перестраивает геометрию эскиза.</p></>;
  submit=async()=>{await d.commit();};valid=d.canCommit;
 }else if(id==='dimension.edit'){
  content=<Numeric name="Значение" value={p.dimensionEditValue} onChange={p.setDimensionEditValue} unit={dimensionEditUnit}/>;submit=p.onDimensionEdit;valid=Number.isFinite(p.dimensionEditValue)&&p.dimensionEditValue>0;
 }else if(constraintHints[id]){
  content=<><p className="live-param-note">{constraintHints[id]}</p><p className="live-param-note">Esc отменяет выбор.</p></>;
 }
 const commit=async()=>{if(!valid||!submit||busy)return;setBusy(true);try{await submit();}finally{setBusy(false);}};
 const title=names[id]||action(id)?.label||'Параметры команды';
 return <section className={'live-parameters'+(embedded?' live-parameters-embedded':'')} ref={box} role={embedded?'group':'dialog'} aria-label={title} data-command={id} data-feature-compact={embedded&&id==='sketch.line'} style={!embedded&&position?{left:position.x,top:position.y,right:'auto'}:undefined}
  onKeyDown={e=>{if(e.key==='Enter'&&submit&&(e.target as Element).matches('input,select')){e.preventDefault();e.stopPropagation();void commit();}if(e.key==='Escape'){e.stopPropagation();p.onCancel();}}}
  onPointerMove={e=>{if(!drag.current||!box.current)return;const r=box.current.getBoundingClientRect();setPosition({x:Math.max(0,Math.min(innerWidth-r.width,e.clientX-drag.current.dx)),y:Math.max(115,Math.min(innerHeight-42-r.height,e.clientY-drag.current.dy))});}}
  onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}}>
  <header onPointerDown={e=>{if(embedded||e.button!==0||(e.target as Element).closest('button'))return;const r=box.current!.getBoundingClientRect();drag.current={dx:e.clientX-r.left,dy:e.clientY-r.top};box.current!.setPointerCapture(e.pointerId);e.preventDefault();}}><button type="button" aria-label={collapsed?'Развернуть параметры':'Свернуть параметры'} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'+':'−'}</button><strong>{embedded?'Параметры инструмента':title}</strong><button type="button" aria-label="Отменить команду" onClick={p.onCancel}>×</button></header>
  {!collapsed&&<><div className="live-param-body">{content||fallback}</div>{submit&&<footer><small>{id==='dimension.edit'?dimensionEditUnit:p.dimensionCreation.mode==='angular'?'°':'мм'}</small><button type="button" className="live-commit" disabled={!valid||busy} onClick={()=>void commit()}>{busy?'Расчёт…':'ОК'}</button><button type="button" disabled={busy} onClick={p.onCancel}>Отмена</button></footer>}</>}
 </section>;
}
