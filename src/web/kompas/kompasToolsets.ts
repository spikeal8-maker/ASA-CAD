/* Состав наборов инструментов — перенесено из прототипа #170 (тег ui-reference-20261004).
   Наполнение — скриншоты КОМПАС-3D v23, сетка — layout.json v25 (PR #146).
   cols — видимые столбцы панели (до 3 кнопок), x — кнопки, которые видны только в раскрытой панели (по ▾). */
export type KompasToolsetId = 'solid' | 'surfaces' | 'sketch';
export type KompasVariantKey = 'add' | 'cut' | 'fillet' | 'hole' | 'draft' | 'arrays' | 'planes' | 'axes';
export interface KompasCommand {
  kind: 't' | 'i';
  label: string;
  icon: string;
  /** Command registry id; null — нет в реестре ASA-CAD. */
  id: string | null;
  /** Варианты команды по ◢. */
  v?: KompasVariantKey;
  /** Причина недоступности в эталоне. */
  dis?: string;
}
export interface KompasPanel { label: string; cols: KompasCommand[][]; x?: KompasCommand[][] }
export interface KompasToolset { label: string; icon: string; panels: KompasPanel[] }

type Options = Partial<Pick<KompasCommand, 'v' | 'dis'>>;
const T = (label: string, icon: string, id: string | null = null, o: Options = {}): KompasCommand => ({ kind: 't', label, icon, id, ...o });
const I = (label: string, icon: string, id: string | null = null, o: Options = {}): KompasCommand => ({ kind: 'i', label, icon, id, ...o });

const SYS: KompasPanel = {label:'Системная',cols:[[I('Создать','new','system.new'),I('Печать','print'),I('Отменить','undo','system.undo')],[I('Открыть','open','system.open'),I('Предварительный просмотр','preview'),I('Повторить','redo','system.redo')],[I('Сохранить','save','system.save'),I('Сохранить как','saveas','system.saveAs'),I('Перестроить (F5)','refresh','system.rebuild')]]};
const SKETCH_P: KompasPanel = {label:'Эскиз',cols:[[T('Автолиния','autoline','sketch.polyline'),T('Окружность','circle','sketch.circle'),T('Прямоугольник','rectangle','sketch.rectangle')]],
  x:[[T('Автоосевая','autoaxis'),T('Вспомогательная прямая','auxline','sketch.construction'),T('Спроецировать объект','project','sketch.project')]]};
const AUX_P: KompasPanel = {label:'Вспомогательная геометрия',cols:[[I('Плоскость','plane','part.datum.plane',{v:'planes'}),I('Ось','axis','part.datum.axis',{v:'axes'}),I('Точка','point3','part.datum.point')],[I('Контрольная точка','ctrlpoint','part.controlPoint'),I('Присоединительная точка','connpoint','part.connectionPoint'),I('Локальная система координат','lcs')]]};
const DIAG_P: KompasPanel = {label:'Диагностика',cols:[[I('Расстояние и угол','measure','part.measureDistanceAngle'),I('Взаимное отклонение','interf'),I('Анализ отклонений','checkgeo','part.checkGeometry')],[I('Длина ребра','medge','part.measureEdge'),I('МЦХ модели','mass'),I('Проверка коллизий','boolean')]],
  x:[[I('Проверка гладкости','offsetsurf')],[I('Проверка непрерывности','intcurve')]]};
export const KOMPAS_TOOLSETS: Record<KompasToolsetId, KompasToolset> = {
 solid:{label:'Твердотельное моделирование',icon:'ts_solid',panels:[
  SYS,SKETCH_P,
  {label:'Элементы тела',cols:[
   [T('Элемент выдавливания','extrude','part.extrude',{v:'add'}),T('Вырезать выдавливанием','cut','part.cutExtrude',{v:'cut'}),T('Скругление','fillet','part.fillet',{v:'fillet'})],
   [T('Придать толщину','thicken'),T('Отверстие простое','hole','part.hole.simple',{v:'hole'}),T('Полное скругление','fullfillet')],
   [T('Ребро жесткости','rib','part.rib'),T('Сечение','section'),T('Уклон','draft','part.draft',{v:'draft'})],
   [T('Добавить деталь-заготовку','addpart'),T('Оболочка','shell','part.shell'),T('Булева операция','boolean')]],
   x:[[T('Масштабировать','scale3d'),T('Параллелепипед по точке и трем точкам','pbox')],[T('Изменить положение','move3d')],[T('Разрезать','slice')],[T('Удалить тело/поверхность','delbody')]]},
  {label:'Прямое моделирование',cols:[[T('Удалить грани','delface'),T('Переместить грани','moveface'),T('Заменить грани','replaceface')]],
   x:[[T('Изменить размер скругления','resizefillet'),T('Изменить размер грани','resizeface')]]},
  {label:'Элементы каркаса',cols:[[T('Точка по координатам','pointxyz'),T('Контур','contour'),T('Спираль цилиндрическая','helix')]],
   x:[[T('Сплайн по точкам','spline')]]},
  {label:'Массив, копирование',cols:[[T('Массив по сетке','gridpat','part.pattern.grid',{v:'arrays'}),T('Копировать объекты','copyobj'),T('Коллекция геометрии','collection','part.collection')]]},
  AUX_P,
  {label:'Размеры',cols:[[I('Линейный размер','dimlin'),I('Угловой размер','dimang'),I('Производные размеры','dimauto')],[I('Диаметральный размер','dimdia'),I('Радиальный размер','dimrad'),I('Разместить производные размеры','dimh')]],
   x:[[I('Размер дуги окружности','arc')]]},
  {label:'Обозначения',cols:[[I('Условное изображение резьбы','helix'),I('Линия-выноска','leader'),I('Допуск формы','tolframe')],[I('Осевая линия','centerline'),I('Обозначение позиции','posnum'),I('Знаки','datum')],[I('Шероховатость','rough'),I('База','datum'),I('Надпись','textT')]],
   x:[[I('Таблица','grid')]]},
  DIAG_P,
  {label:'Чертеж',cols:[[I('Создать чертеж','linkdraw',null,{dis:'Сначала сохраните деталь'}),I('Управление связанными чертежами','linkdraw','part.linkedDrawings',{dis:'Связанных чертежей нет'})]]}
 ]},
 surfaces:{label:'Каркас и поверхности',icon:'ts_surf',panels:[
  SYS,SKETCH_P,
  {label:'Каркас',cols:[
   [T('Точка по координатам','pointxyz'),T('Сплайн по точкам','spline'),T('Скругление кривых','filletc')],
   [T('Отрезок по координатам','segxyz'),T('Ломаная','polyline'),T('Усечение кривой','trimc')],
   [T('Дуга по трем точкам','arc3'),T('Спираль цилиндрическая','helix'),T('Продление кривой','extendc')],
   [T('Контур','contour'),T('Эквидистанта кривой','offsetc'),T('Кривая пересечения','intcurve')]],
   x:[[T('Проекционная кривая','project'),T('Линия очерка','contour'),T('Сплайн по объектам','spline')],
      [T('Свернутая кривая','helix'),T('Изопараметрическая кривая','network'),T('Группа точек по кривой','polyline')],
      [T('Развернутая кривая','extendc'),T('Кривая по закону','spline'),T('Импортированная кривая','open')],
      [T('Кривая по двум проекциям','intcurve'),T('Сплайн на поверхности','patch'),T('Коническая кривая по вершинам','conic')]]},
  {label:'Поверхности',cols:[
   [T('Поверхность выдавливания','surfext'),T('Заплатка','patch'),T('Поверхность скругления','surffillet')],
   [T('Линейчатая поверхность','ruled'),T('Эквидистанта поверхности','offsetsurf'),T('Сшивка поверхностей','stitch')],
   [T('Усечение поверхности','trimsurf'),T('Разбиение поверхности','splitsurf'),T('Поверхность соединения','blendsurf')],
   [T('Поверхность по сети кривых','network'),T('Поверхность конического сечения','conic'),T('Скругление','fillet')]],
   x:[[T('Придать толщину','thicken'),T('Продление поверхности','extendc')],[T('Удалить грани','delface'),T('Восстановление поверхности','patch')],[T('Поверхность по сети точек','gridpat'),T('Импортированная поверхность','open')],[T('Поверхность по пласту точек','network')]]},
  {label:'Массив, копирование',cols:[[I('Массив по сетке','gridpat','part.pattern.grid',{v:'arrays'}),I('Копировать объекты','copyobj'),I('Коллекция геометрии','collection','part.collection')]]},
  AUX_P,DIAG_P
 ]},
 sketch:{label:'Инструменты эскиза',icon:'ts_sketch',panels:[
  SYS,
  {label:'Элементы',cols:[[T('Элемент выдавливания','extrude','part.extrude',{v:'add'}),T('Вырезать выдавливанием','cut','part.cutExtrude',{v:'cut'}),T('Ребро жесткости','rib','part.rib')]],
   x:[[T('Сечение','section'),T('Разрезать','slice'),T('Удалить тело/поверхность','delbody')]]},
  {label:'Геометрия',cols:[
   [T('Автолиния','autoline','sketch.polyline'),T('Прямоугольник','rectangle','sketch.rectangle'),T('Отрезок','line','sketch.line')],
   [T('Окружность','circle','sketch.circle'),T('Дуга','arc','sketch.arc'),T('Вспомогательная прямая','auxline','sketch.construction')],
   [T('Фаска','schamfer','sketch.chamfer'),T('Скругление','sfillet','sketch.fillet'),T('Спроецировать объект','project','sketch.project')]],
   x:[[T('Точка','point3','sketch.point'),T('Сплайн по точкам','spline','sketch.spline')],[T('Эквидистанта','offset','sketch.offset'),T('Коническая кривая','conic')],[T('Эллипс','circle','sketch.ellipse'),T('Паз','rectangle')]]},
  {label:'Обозначения',cols:[[T('Автоосевая','autoaxis'),T('Условное пересечение','condint'),T('Надпись','textT')]]},
  {label:'Изменение',cols:[
   [I('Сдвиг','move','sketch.move'),I('Поворот','rotate','sketch.rotate'),I('Масштабирование','scale','sketch.scale')],
   [I('Зеркально отразить','mirror','sketch.mirror'),I('Эквидистанта','offset','sketch.offset'),I('Усечь','trim','sketch.trim')],
   [I('Удлинить','extend','sketch.extend'),I('Разбить кривую','split','sketch.split'),I('Удалить элемент','del','sketch.entity.delete')]],
   x:[[I('Деформировать','scale')],[I('Преобразовать в сплайн','spline')]]},
  {label:'Размеры',cols:[
   [I('Авторазмер','dimauto','dimension.auto'),I('Линейный размер','dimlin','dimension.linear'),I('Диаметральный размер','dimdia','dimension.diameter')],
   [I('Горизонтальный размер','dimh','dimension.horizontal'),I('Вертикальный размер','dimv','dimension.vertical'),I('Радиальный размер','dimrad','dimension.radius')],
   [I('Угловой размер','dimang','dimension.angular')]],
   x:[[I('Линейный цепной размер','dimh'),I('Размер дуги окружности','arc'),I('Линейный с обрывом','dimlin')],[I('Угловой с общей размерной линией','dimang')]]},
  {label:'Ограничения',cols:[
   [I('Горизонтальность','horizontal','constraint.horizontal'),I('Вертикальность','vertical','constraint.vertical'),I('Совпадение','coincident','constraint.coincident')],
   [I('Параллельность','parallel','constraint.parallel'),I('Перпендикулярность','perpendicular','constraint.perpendicular'),I('Касание','tangent','constraint.tangent')],
   [I('Концентричность','concentric','constraint.concentric'),I('Равенство','equal','constraint.equal'),I('Симметрия','symmetric','constraint.symmetric')],
   [I('Фиксация','fixed','constraint.fixed'),I('Точка на кривой','pointon','constraint.pointOnCurve'),I('Показать ограничения','showcons')]],
   x:[[I('Установить значение размера','dimauto')]]},
  {label:'Диагностика',cols:[[I('Расстояние и угол','measure','part.measureDistanceAngle'),I('Взаимное отклонение','interf'),I('Площадь','area','part.measureArea')],[I('Длина кривой','medge'),I('Информация об объекте','helpq'),I('МЦХ плоских фигур','mass')]],
   x:[[I('Расчет МЦХ тел вращения','mass',null,{dis:'Недоступно в режиме эскиза'})],[I('МЦХ модели','mass',null,{dis:'Недоступно в режиме эскиза'})]]},
  {label:'Проверка',cols:[[I('Проверка наложения элементов','checkgeo'),I('Проверка размеров','dimlin'),I('Справка','helpq')],[I('Проверка связей обозначений позиций','posnum'),I('Удалить результаты проверок','del')]]}
 ]}
};
export const KOMPAS_MORE_TOOLSETS: readonly string[] = ['Листовое моделирование','Сплайновая форма','Управление','Валы и механические передачи 3D','Валы и механические передачи 3D+2D','Моделирование кабельных каналов','Моделирование вентиляции','Моделирование металлоконструкций','Моделирование трубопроводов'];
