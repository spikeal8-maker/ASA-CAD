import React,{useRef,useState} from 'react';
import type {ParameterPanelProps} from '../../../src/web/ParameterPanel';
import {action,run} from './liveActions';
type Props={panel:ParameterPanelProps;fallback:React.ReactNode};
const names:Record<string,string>={'part.sketch.create':'Создать эскиз','sketch.line':'Отрезок','sketch.arc':'Дуга','sketch.rectangle':'Прямоугольник','sketch.circle':'Окружность','part.extrude':'Выдавливание','part.cutExtrude':'Выдавливание — вырез','part.fillet':'Скругление','dimension.edit':'Изменить размер'};
function Field({name,children}:{name:string;children:React.ReactNode}){return <label className="live-param-row"><span>{name}</span><div>{children}</div></label>;}
function Numeric({name,value,onChange}:{name:string;value:number;onChange:(n:number)=>void}){return <Field name={name}><input type="number" step="any" aria-label={name} value={Number.isFinite(value)?value:''} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value))}/><small>мм</small></Field>;}
export function LiveParameters({panel:p,fallback}:Props){
 const [collapsed,setCollapsed]=useState(false),[position,setPosition]=useState<{x:number;y:number}|null>(null),[busy,setBusy]=useState(false);
 const box=useRef<HTMLElement>(null),drag=useRef<{dx:number;dy:number}|null>(null);
 const id=p.activeCommand||'',x=p.extrude;
 let content:React.ReactNode=null,submit:(()=>void|Promise<void>)|null=null,valid=true;
 if(id==='part.sketch.create'){
  content=<><Field name="Плоскость">{p.requiresFaceSelection?<span>{p.selectedPick?.kind==='face'?'Грань выбрана':'Выберите грань на модели'}</span>:<select aria-label="Плоскость эскиза" value={p.sketchPlane} onChange={e=>p.setSketchPlane(e.target.value as 'XY'|'XZ'|'YZ')}>{['XY','XZ','YZ'].map(v=><option key={v}>{v}</option>)}</select>}</Field><p className="live-param-note">Опору также можно выбрать в рабочей области или дереве.</p></>;
  submit=p.onCreateSketch;valid=!p.requiresFaceSelection||p.selectedPick?.kind==='face';
 }else if(id==='sketch.line'||id==='sketch.arc'){
  content=<><p className="live-param-note">{id==='sketch.line'?'Укажите начальную и конечную точки отрезка левой кнопкой мыши.':'Укажите центр, начальную и конечную точки дуги левой кнопкой мыши.'}</p><p className="live-param-note">Колесо мыши изменяет масштаб плоскости эскиза. Esc отменяет текущий ввод, сохраняя уже построенные элементы.</p><button type="button" onClick={p.onCancel}>Завершить ввод</button></>;
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
 }else if(id==='dimension.edit'){
  content=<Numeric name="Значение" value={p.dimensionEditValue} onChange={p.setDimensionEditValue}/>;submit=p.onDimensionEdit;valid=Number.isFinite(p.dimensionEditValue)&&p.dimensionEditValue>0;
 }
 const commit=async()=>{if(!valid||!submit||busy)return;setBusy(true);try{await submit();}finally{setBusy(false);}};
 return <section className="live-parameters" ref={box} role="dialog" aria-label={names[id]||'Параметры команды'} data-command={id} style={position?{left:position.x,top:position.y,right:'auto'}:undefined}
  onPointerMove={e=>{if(!drag.current||!box.current)return;const r=box.current.getBoundingClientRect();setPosition({x:Math.max(0,Math.min(innerWidth-r.width,e.clientX-drag.current.dx)),y:Math.max(115,Math.min(innerHeight-42-r.height,e.clientY-drag.current.dy))});}}
  onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}}>
  <header onPointerDown={e=>{if(e.button!==0||(e.target as Element).closest('button'))return;const r=box.current!.getBoundingClientRect();drag.current={dx:e.clientX-r.left,dy:e.clientY-r.top};box.current!.setPointerCapture(e.pointerId);e.preventDefault();}}><button type="button" aria-label={collapsed?'Развернуть параметры':'Свернуть параметры'} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'+':'−'}</button><strong>{names[id]||'Параметры команды'}</strong><button type="button" aria-label="Отменить команду" onClick={p.onCancel}>×</button></header>
  {!collapsed&&<><div className="live-param-body">{content||fallback}</div>{submit&&<footer><small>мм</small><button type="button" className="live-commit" disabled={!valid||busy} onClick={()=>void commit()}>{busy?'Расчёт…':'ОК'}</button><button type="button" disabled={busy} onClick={p.onCancel}>Отмена</button></footer>}</>}
 </section>;
}
