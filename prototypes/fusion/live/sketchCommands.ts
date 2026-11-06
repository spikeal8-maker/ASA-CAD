import type {CadUiAction} from '../../../src/web/CadUiAction';
import nativeReference from '../reference_capture/sketch-native-reference.v1.json';
import activeNativeReference from '../reference_capture/sketch-active-ui-20261106.json';

/** The inventory is verified by Fusion's API. Russian labels and SVG artwork are authored here. */
export const sketchReference = nativeReference;
export const activeSketchReference = activeNativeReference;
export type SketchActionGetter = (id:string)=>CadUiAction;
export type SketchItem = {id:string; nativeId?:string; nativeType?:string; label:string; icon:string; actionId?:string; children?:SketchItem[]; separator?:boolean; authored?:boolean; shortcut?:string};
export type SketchPanel = {id:string; key:string; label:string; items:SketchItem[]; menuItems:SketchItem[]; promoted:SketchItem[]};
type NativeControl = {id:string;type:string;commandDefinition?:{id:string;name:string|null}|null;controls?:NativeControl[]};

export const sketchNativeActions:Readonly<Record<string,string>> = {
 DrawPolyline:'sketch.line',ShapeRectangleTwoPoint:'sketch.rectangle',CircleCenterRadius:'sketch.circle',ArcCenterTwoPoint:'sketch.arc',SketchStop:'sketch.finish',
 ConstraintCoincident:'constraint.coincident',ConstraintTangent:'constraint.tangent',ConstraintEqual:'constraint.equal',ConstraintParallel:'constraint.parallel',ConstraintPerpendicular:'constraint.perpendicular',ConstraintFix:'constraint.fixed',ConstraintConcentric:'constraint.concentric',ConstraintSymmetry:'constraint.symmetric',
};

export const sketchLabels:Readonly<Record<string,string>> = {
 DrawPolyline:'Линия',SketchMidpointLine:'Линия от середины',SketchConstrainer:'Автоматические ограничения',
 RectangleDropDown:'Прямоугольник',ShapeRectangleTwoPoint:'Прямоугольник по двум точкам',ShapeRectangleThreePoint:'Прямоугольник по трём точкам',ShapeRectangleCenter:'Прямоугольник из центра',
 CircleDropDown:'Окружность',CircleCenterRadius:'Окружность из центра',CircleTwoPoint:'Окружность по двум точкам',CircleThreePoint:'Окружность по трём точкам',CircleTanTanRadius:'Окружность по двум касательным',CircleThreeTangent:'Окружность по трём касательным',
 ArcDropDown:'Дуга',ArcThreePoint:'Дуга по трём точкам',ArcCenterTwoPoint:'Дуга из центра',ArcTangent:'Касательная дуга',
 PolygonDropDown:'Многоугольник',ShapePolygonCircumscribed:'Описанный многоугольник',ShapePolygonInscribed:'Вписанный многоугольник',ShapePolygonEdge:'Многоугольник по стороне',CircleElipse:'Эллипс',
 SlotDropDown:'Паз',ShapeSlotCenterToCenter:'Паз по двум центрам',ShapeSlotOverall:'Паз по общей длине',ShapeSlotCenterPoint:'Паз из центра',ShapeArcSlotThreePoint:'Дуговой паз по трём точкам',ShapeArcSlotCenterTwoPoint:'Дуговой паз из центра',
 SplineDropDown:'Сплайн',DrawSpline:'Сплайн по точкам',DrawCVMSpline3D:'Сплайн по управляющим точкам (3)',DrawCVMSpline5D:'Сплайн по управляющим точкам (5)',ConicCurveCmd:'Коническая кривая',DrawPoint:'Точка',MTextCmd:'Текст',FitCurvesToSectionCommand:'Кривые по сечению сетки',
 MirrorSketchCommand:'Зеркальное отражение',CircularSketchPatternCommand:'Круговой массив',RectangularSketchPatternCommand:'Прямоугольный массив',ProjectIncludeDropDown:'Проецировать / включить',ProjectNewCmd:'Проецировать',IntersectCmd:'Пересечение',SpunProfileCmd:'Силуэт вращения',Include3DGeometry:'Включить 3D-геометрию',ProjectToSurface:'Проецировать на поверхность',IntersectionCurve:'Кривая пересечения',SketchIsoparametricCurve:'Изопараметрическая кривая',SketchDimension:'Размер эскиза',
 FilletSketchCmd:'Скругление эскиза',SketchChamferDropDown:'Фаска',ChamferSketchEqualDistance:'Фаска с равными расстояниями',ChamferSketchDistanceAngle:'Фаска: расстояние и угол',ChamferSketchDistanceDistance:'Фаска по двум расстояниям',BlendG1CurveSketchCmd:'Плавное сопряжение кривых',Offset:'Смещение',TrimSketchCmd:'Обрезать',ExtendSketchCmd:'Продлить',BreakSketchCmd:'Разорвать',SketchScaleCmd:'Масштаб эскиза',FusionMoveCommand:'Переместить / копировать',ChangeParameterCommand:'Изменить параметры',
 SketchAutoConstraintAndDimCmd:'Автоограничения и размеры',SketchAutoConstraintAndDimFromDatumCmd:'Автоограничения и размеры от базы',ConstraintHorizontalVertical:'Горизонтальность / вертикальность',ConstraintCoincident:'Совпадение',ConstraintTangent:'Касание',ConstraintEqual:'Равенство',ConstraintParallel:'Параллельность',ConstraintPerpendicular:'Перпендикулярность',ConstraintFix:'Зафиксировать',ConstraintMidPoint:'Середина',ConstraintConcentric:'Концентричность',ConstraintCollinear:'Коллинеарность',ConstraintSymmetry:'Симметрия',ConstraintSmooth:'Кривизна',SketchPolygonConstraintCmd:'Ограничение многоугольника',
 FusionStartDesignConfigModeCmd:'Создать конфигурацию',FusionShowDesignConfigPanelCmd:'Таблица конфигураций',FusionConfigurationRulesCmd:'Правила конфигураций',
 MeasureCommand:'Измерить',FusionHalfSectionViewCommand:'Анализ сечения',InterferenceCheckCommand:'Проверка пересечений',FusionCenterOfMassCommand:'Центр масс',FusionCurvatureCombAnalysisCommand:'Гребёнка кривизны',FusionCurvatureMapAnalysisCommand:'Карта кривизны',FusionDraftAnalysisCommand:'Анализ уклонов',FusionEnvironmentMapAnalysisCommand:'Анализ отражений',FusionIsoCurveAnalysisCommand:'Анализ изокривых',FusionZebraAnalysisCommand:'Анализ зебры',FusionSurfaceValidateCommand:'Проверка поверхности',FusionAccessibilityAnalysisCommand:'Анализ доступности',FusionMinimumRadiusAnalysisCommand:'Анализ минимального радиуса',FusionComponentConnectionAnalysisCommand:'Анализ соединений компонентов',FusionFastenerStackAnalysisCommand:'Анализ пакета крепежа',GraphViewCmd:'Граф зависимостей',FusionDOFAnalysisCommand:'Анализ степеней свободы',FusionEditComponentConnectionAnalysisCommand:'Изменить анализ соединений',FusionViewColorCyclingToggleCmd:'Различать компоненты цветом',FacegroupsToggleCmd:'Группы граней',FusionAssemblyStatisticsCommand:'Статистика сборки',SimilarPartsCommand:'Подобные детали',ShowHistoryToolbarCmd:'История изменений',ShowChangeAwarenessToolbarCmd:'Отслеживать изменения',GravityClimate_ManufacturingSustainabilityInsights_MainDialog:'Оценка экологичности производства',
 FusionAddEditDecalCommand:'Декаль',FusionAddCanvasCommand:'Холст',TSplineImportCommand:'Вставить T-сплайн',SketchImportSVG:'Вставить SVG',ImportDxfFileCommand:'Вставить DXF',ParaMeshInsertAlignCommand:'Вставить сетку',FusionImportCommandFromToolbar:'Вставить компонент',FusionFastenersCommand:'Крепёж',FusionDuplicateWithJointsCommand:'Дублировать с соединениями',PullDeriveCommand:'Производный компонент',InsertMcMasterCarrComponentCommand:'Компонент McMaster-Carr',cadenasparts4cad:'Компонент CADENAS',traceparts_insert:'Компонент TraceParts',NewAssemblyFromPartCommand:'Добавить в сборку',
 SelectCommand:'Выбор',selectWindow:'Выбор рамкой',selectFreeForm:'Свободный выбор',selectPaint:'Выбор кистью',SelectionToolsDropDown:'Инструменты выбора',SelectByNameCommand:'Выбрать по имени',SelectByBoundaryCommand:'Выбрать по границе',FusionSelectBodiesBySizeCommand:'Выбрать тела по размеру',SelectByInvertCommand:'Инвертировать выбор',FusionSelectSeedAndBoundaryFacesCommand:'Выбрать исходные и граничные грани',FusionDragCompControlsCmd:'Перетаскивание компонентов',SelectionPriorityCommandsDropDown:'Приоритет выбора',SelectBodyPriorityCommand:'Приоритет тел',SelectFacePriorityCommand:'Приоритет граней',SelectEdgePriorityCommand:'Приоритет рёбер',SelectComponentPriorityCommand:'Приоритет компонентов',SelectionFilterCommand:'Фильтры выбора',SketchStop:'Завершить эскиз',SketchAutoConstrainAndFinish:'Автоограничения и завершение',
};

const actionLabels:Readonly<Record<string,string>>={
 'dimension.linear':'Линейный размер','dimension.horizontal':'Горизонтальный размер','dimension.vertical':'Вертикальный размер','dimension.diameter':'Диаметр','dimension.radius':'Радиус','dimension.angular':'Угловой размер',
 'constraint.horizontal':'Горизонтальность','constraint.vertical':'Вертикальность','constraint.pointOnCurve':'Точка на кривой','sketch.entity.delete':'Удалить выбранное','sketch.construction':'Вспомогательная геометрия',
};
export const dimensionActionIds=['dimension.linear','dimension.horizontal','dimension.vertical','dimension.diameter','dimension.radius','dimension.angular'] as const;
const authoredAction=(id:string,nativeId?:string):SketchItem=>({id:`asa:${id}`,nativeId,label:actionLabels[id],icon:id,actionId:id,authored:true});
export function sketchAction(get:SketchActionGetter,id?:string):CadUiAction|null{if(!id)return null;try{return get(id);}catch{return null;}}
/** The native dimension button chooses an enabled core operation; search retains every kind. */
export function contextualDimension(get:SketchActionGetter):CadUiAction|null{
 for(const id of ['dimension.diameter','dimension.radius','dimension.linear','dimension.horizontal','dimension.vertical','dimension.angular']){const a=sketchAction(get,id);if(a?.enabled)return a;}
 return sketchAction(get,'dimension.linear');
}
export function itemAction(item:SketchItem,get:SketchActionGetter):CadUiAction|null{
 if(item.nativeId==='SketchDimension'&&!item.actionId)return contextualDimension(get);
 if(item.nativeId==='ConstraintHorizontalVertical'&&!item.actionId)return null;
 return sketchAction(get,item.actionId);
}
const fromNative=(c:NativeControl):SketchItem=>{
 if(c.type==='SeparatorControl')return {id:c.id,label:'',icon:'',separator:true};
 const id=c.commandDefinition?.id||c.id;
 const item:SketchItem={id:c.id,nativeId:id,nativeType:c.type,label:sketchLabels[id]||c.commandDefinition?.name||id,icon:`sketch.native.${id}`,actionId:sketchNativeActions[id]};
 if(c.controls?.length)item.children=c.controls.map(fromNative);
 if(id==='SketchDimension'){item.children=dimensionActionIds.map(actionId=>authoredAction(actionId,id));item.shortcut='D';}
 if(id==='ConstraintHorizontalVertical'){item.children=['constraint.horizontal','constraint.vertical'].map(actionId=>authoredAction(actionId,id));}
 if(id==='DrawPolyline')item.shortcut='L';if(id==='ShapeRectangleTwoPoint')item.shortcut='R';if(id==='CircleCenterRadius')item.shortcut='C';
 return item;
};
const panelLabels:Readonly<Record<string,[string,string]>>={SketchCreatePanel:['create','Создать'],SketchModifyPanel:['modify','Изменить'],SketchConstraintsPanel:['constraints','Ограничения'],ConfigurePanel:['configure','Конфигурация'],InspectPanel:['inspect','Проверить'],InsertPanel:['insert','Вставить'],PartAssemblePanel:['assemble','Собрать'],SelectPanel:['select','Выбрать'],StopSketchPanel:['finish','Завершить эскиз']};
function findItem(items:SketchItem[],id:string):SketchItem|undefined{for(const item of items){if(item.nativeId===id)return item;const nested=item.children&&findItem(item.children,id);if(nested)return nested;}return undefined;}
/** Actual visible promotion at 2048 × 1137 / 110 native DPI, November 6, 2026.
 * The historical API inventory remains intact in sketchReference and panel.items.
 * Source: evidence/fusion-parity-native-sketch-empty-2048-dpi110.png. */
export const observedPromotedIds:Readonly<Record<string,readonly string[]>>={
 SketchCreatePanel:['DrawPolyline','ShapeRectangleTwoPoint','CircleCenterRadius','DrawSpline','MirrorSketchCommand','SketchDimension'],
 SketchModifyPanel:['FilletSketchCmd','TrimSketchCmd','Offset','BlendG1CurveSketchCmd'],
 SketchConstraintsPanel:['SketchAutoConstraintAndDimCmd','ConstraintHorizontalVertical','ConstraintCoincident','ConstraintTangent','ConstraintEqual','ConstraintParallel','ConstraintPerpendicular','ConstraintFix','ConstraintMidPoint','ConstraintConcentric','ConstraintCollinear','ConstraintSymmetry'],
 ConfigurePanel:['FusionStartDesignConfigModeCmd','FusionShowDesignConfigPanelCmd','FusionConfigurationRulesCmd'],
 InspectPanel:['MeasureCommand','FusionHalfSectionViewCommand'],
 InsertPanel:['PullDeriveCommand','FusionAddCanvasCommand','ParaMeshInsertAlignCommand'],
 PartAssemblePanel:['NewAssemblyFromPartCommand'],SelectPanel:['SelectCommand'],StopSketchPanel:['SketchStop'],
};
/** Captured popup geometry is an English reference minimum. Russian labels may
 * widen a menu so the translated command names stay readable. */
export const observedMenuWidths:Readonly<Record<string,number>>={
 SketchCreatePanel:245,RectangleDropDown:245,CircleDropDown:245,ArcDropDown:161,
 PolygonDropDown:199,SlotDropDown:189,SplineDropDown:182,ProjectIncludeDropDown:189,
};
type ObservedControl={id:string;isVisible:boolean|null;children?:ObservedControl[]};
function presentedItem(item:SketchItem):SketchItem{
 if(item.nativeId==='SketchDimension')return {...item,children:undefined};
 if(item.nativeId==='DrawCVMSpline5D')return {...item,label:'Сплайн по управляющим точкам'};
 return {...item};
}
/** Active native visibility controls presentation only. Native isEnabled never
 * authorizes execution; enabled state comes exclusively from CadUiAction. */
function presentedMenu(items:SketchItem[],controls:ObservedControl[]):SketchItem[]{
 const byId=new Map(controls.map(control=>[control.id,control]));
 const visible:SketchItem[]=[];
 for(const item of items){
  const control=byId.get(item.id);
  if(control?.isVisible!==true)continue;
  const next=presentedItem(item);
  if(item.nativeType==='DropDownControl')next.children=presentedMenu(item.children||[],control.children||[]);
  if(next.separator&&(!visible.length||visible[visible.length-1].separator))continue;
  visible.push(next);
 }
 while(visible[visible.length-1]?.separator)visible.pop();
 return visible;
}
export const sketchPanels:SketchPanel[]=nativeReference.panels.map(panel=>{
 const items=(panel.controls as NativeControl[]).map(fromNative);
 const observedPanel=activeNativeReference.tab.panels.find(candidate=>candidate.id===panel.id);
 const menuItems=presentedMenu(items,(observedPanel?.controls||[]) as ObservedControl[]);
 const promoted=(observedPromotedIds[panel.id]||[]).map(id=>findItem(items,id)).filter((item):item is SketchItem=>!!item).map(presentedItem);
 if(panel.id==='SketchModifyPanel')items.push({id:'asa:modify-separator',label:'',icon:'',separator:true},authoredAction('sketch.entity.delete'),authoredAction('sketch.construction'));
 if(panel.id==='SketchConstraintsPanel')items.push({id:'asa:constraints-separator',label:'',icon:'',separator:true},authoredAction('constraint.pointOnCurve'));
 return {id:panel.id,key:panelLabels[panel.id][0],label:panelLabels[panel.id][1],items,menuItems,promoted};
});
export function flattenSketchItems(items:SketchItem[]):SketchItem[]{return items.flatMap(item=>[item,...(item.children?flattenSketchItems(item.children):[])]);}
export const sketchSearchItems=sketchPanels.flatMap(panel=>flattenSketchItems(panel.items)).filter(item=>!item.separator);
