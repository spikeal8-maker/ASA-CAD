/* Главное меню — пункты сняты с КОМПАС-3D v23 (2026-10-02), перенесено из прототипа #170 (тег ui-reference-20261004).
   l — подпись, i — значок, k — сочетание клавиш, d — недоступен, s — подменю, a — действие оболочки, id — команда реестра ASA-CAD. */
import { M, S, leaf, NOT_CAPTURED, type KompasMenuContext, type KompasMenuEntry, type KompasViewName } from './kompasMenuTypes';
import { kompasApplicationsMenu, kompasModelingMenu } from './kompasModelingMenus';

export interface KompasMenuLists {
  menus: Record<string, () => KompasMenuEntry[]>;
  zoom(): KompasMenuEntry[];
  display(withEdges?: boolean): KompasMenuEntry[];
  hide(): KompasMenuEntry[];
  vis(): KompasMenuEntry[];
  filter(): KompasMenuEntry[];
}

export function kompasMenus(ctx: KompasMenuContext): KompasMenuLists {
  const OBJ_TYPES=[['Системы координат','lcs'],['Конструктивные плоскости','plane'],['Конструктивные оси','axis'],['Эскизы','ts_sketch'],['Поверхности','patch'],['Полигональные объекты','network'],['Условные изображения резьбы','helix'],['Элементы каркаса','spline'],['Контрольные точки','ctrlpoint'],['Размеры','dimlin'],['Условные обозначения','rough'],['Надписи','textT'],['Таблицы','grid'],['Компоновочную геометрию','collection'],['Надписи объектов','textT'],['Объекты диагностики','checkgeo']];
  const FILTER_TYPES=[['Грани','delface'],['Ребра','medge'],['Вершины','point3'],S,['Компоненты','part'],['Тела','ts_solid'],['Поверхности','patch'],['Полигональные объекты','network'],['Кривые','spline'],['Точки','point3'],['Эскизы','ts_sketch'],['Системы координат','lcs'],['Контрольные точки','ctrlpoint'],S,['Оси','axis'],['Плоскости','plane'],['Элементы оформления','rough'],['Надписи','textT'],['Таблицы','grid'],['Резьбы','helix']];
  const ZOOM_ITEMS=():KompasMenuEntry[]=>[M('Показать все',{i:'zoom',k:'F9',a:()=>ctx.fit()}),S,M('Увеличить масштаб рамкой',{i:'zoomwin'}),M('Приблизить/отдалить',{i:'zoomin'}),M('Увеличить масштаб',{i:'zoomin',k:'Ctrl+NumPad+',a:()=>ctx.zoom('in')}),M('Уменьшить масштаб',{i:'zoomout',k:'Ctrl+NumPad-',a:()=>ctx.zoom('out')}),S,M('Масштаб по выделенным объектам',{i:'zoomsel',d:true}),M('Предыдущий масштаб',{i:'zoomsel',d:true}),M('Последующий масштаб',{i:'zoomsel',d:true})];
  const ORIENT_ITEMS=():KompasMenuEntry[]=>[...[['Спереди','v_front','front'],['Сзади','v_back','back'],['Сверху','v_top','top'],['Снизу','v_bottom','bottom'],['Слева','v_left','left'],['Справа','v_right','right'],['Изометрия','orient','iso'],['Диметрия','orient','dim']].map(([l,i,v])=>v==='dim'?M(l,{i,a:()=>ctx.view('dim')}):M(l,{i,id:v==='iso'?'view.iso':`view.${v}`})),S,M('Настройка ориентации...',{i:'gear'})];
  const DISPLAY_MODES=[['Каркас','wire','wire'],['Без невидимых линий','wire','hidden'],['Невидимые линии тонкие','wire','thin'],['Полутоновое','ts_solid','shaded'],['Полутоновое с каркасом','shaded','shadedEdges']];
  const DISPLAY_ITEMS=(withEdges=true):KompasMenuEntry[]=>DISPLAY_MODES.filter(m=>withEdges||m[2]!=='shadedEdges').map(([l,i])=>M(l,{i}));
  const HIDE_ITEMS=():KompasMenuEntry[]=>OBJ_TYPES.map(([l,i])=>M(l,{i}));
  const VIS_ITEMS=():KompasMenuEntry[]=>OBJ_TYPES.map(([l,i])=>M(l,{i}));
  const FILTER_ITEMS=():KompasMenuEntry[]=>FILTER_TYPES.map(t=>t===S?S:M(t[0],{i:t[1]}));
  const menus: Record<string, () => KompasMenuEntry[]> = {
 'Файл':()=>[M('Создать...',{i:'new',k:'Ctrl+N',id:'system.new'}),M('Открыть...',{i:'open',k:'Ctrl+O',id:'system.open'}),M('Открыть с проверкой...'),S,
   M('Недавние',{s:()=>[M('Нет недавних документов',{d:true}),S,M('Очистить список недавних',{d:true})]}),M('Специализация',{s:NOT_CAPTURED}),S,
   M('Закрыть',{k:'Ctrl+W'}),M('Закрыть все документы'),S,
   M('Сохранить',{i:'save',k:'Ctrl+S',id:'system.save'}),M('Сохранить как...',{i:'saveas',id:'system.saveAs'}),M('Сохранить все'),M('Сохранить как шаблон...'),S,
   M('Экспорт',{id:'system.export'}),S,
   M('Предварительный просмотр...',{i:'preview'}),M('Отправить выделенное в предварительный просмотр...',{i:'preview',d:true}),M('Настроить предварительный просмотр',{s:NOT_CAPTURED}),M('Задание на печать',{s:NOT_CAPTURED}),M('Печать...',{i:'print',k:'Ctrl+P'}),M('Специальная печать...',{i:'grid'}),S,
   M('Отправить'),S,M('Информация о документе...',{a:()=>ctx.openDocInfo()}),S,M('Выйти')],
 'Правка':()=>[M('Отменить',{i:'undo',k:'Ctrl+Z',id:'system.undo',d:!ctx.canUndo}),M('Повторить',{i:'redo',k:'Ctrl+Y',id:'system.redo',d:!ctx.canRedo}),S,
   M('Повторить последнюю команду',{k:'F4'}),S,M('Перенести на слой'),S,M('Изолировать связи',{d:true}),S,
   M('Редактировать',{i:'pipette',d:true}),M('Разрушить',{d:true}),M('Удалить историю построения'),M('Удалить',{i:'del',k:'Del',d:true}),S,
   M('Обновить операции копирования',{i:'rotate'}),M('Восстановить операции Контекстных связей',{s:NOT_CAPTURED})],
 'Выделить':()=>[M('Рамкой',{i:'zoomwin'}),M('Секущей рамкой',{i:'zoomwin'}),M('По слою',{s:NOT_CAPTURED}),M('По зоне',{s:NOT_CAPTURED}),M('По видимости',{s:NOT_CAPTURED}),S,M('Фильтровать объекты',{s:FILTER_ITEMS})],
 'Вид':()=>[M('Масштаб',{s:ZOOM_ITEMS}),M('Сдвинуть',{i:'move'}),M('Повернуть',{i:'rotate'}),M('Нормально к...',{i:'normal',a:()=>ctx.normal()}),M('Нормально с выравниванием',{i:'normal'}),M('Ориентация модели',{s:ORIENT_ITEMS}),S,
   M('Перспектива',{i:'persp'}),S,M('Отображение модели',{s:()=>DISPLAY_ITEMS(true)}),M('Схема освещения',{s:NOT_CAPTURED}),S,
   M('Скрыть',{s:()=>HIDE_ITEMS().concat([S,M('Скрыть все вспомогательные объекты',{i:'hide'})])}),M('Скрыть в компонентах',{s:NOT_CAPTURED}),S,
   M('Режим сечения модели',{s:NOT_CAPTURED}),S,M('Зоны модели',{s:NOT_CAPTURED}),S,M('Отображать',{s:NOT_CAPTURED}),S,
   M('Изолировать объекты',{i:'grid',d:true}),S,M('Упрощенное отображение',{i:'shaded',on:()=>false}),S,M('Обновить изображение',{i:'refresh',k:'Ctrl+F9',a:()=>ctx.refreshView()})],
 'Эскиз':()=>[M('Создать эскиз',{i:'ts_sketch',id:'part.sketch.create'}),S,M('Автолиния',{i:'autoline',id:'sketch.polyline'}),M('Окружность',{s:()=>[M('Окружность',{i:'circle',id:'sketch.circle'})]}),M('Прямоугольник',{s:()=>[M('Прямоугольник',{i:'rectangle',id:'sketch.rectangle'})]}),M('Автоосевая',{i:'autoaxis'}),M('Спроецировать объект',{i:'project',id:'sketch.project'})],
 'Моделирование':kompasModelingMenu,
 'Оформление':()=>[M('Условное изображение резьбы',{i:'helix'}),M('Осевая линия',{i:'centerline'}),S,M('Линейный размер',{i:'dimlin'}),M('Угловой размер',{i:'dimang'}),M('Радиальный размер',{i:'dimrad'}),M('Диаметральный размер',{i:'dimdia'}),M('Размер дуги окружности',{i:'arc'}),S,
   M('Производные размеры',{i:'dimauto'}),M('Разместить производные размеры',{i:'dimh'}),S,M('Шероховатость',{i:'rough'}),M('База',{i:'datum'}),M('Линия-выноска',{i:'leader'}),M('Обозначение позиции',{i:'posnum'}),M('Допуск формы',{i:'tolframe'}),
   M('Знаки',{s:NOT_CAPTURED}),M('Надпись',{i:'textT'}),M('Таблица',{i:'grid'}),S,M('Технические требования',{s:NOT_CAPTURED}),M('Неуказанная шероховатость',{i:'rough'})],
 'Диагностика':()=>[M('Расстояние и угол',{i:'measure',id:'part.measureDistanceAngle'}),M('Длина ребра',{i:'medge',id:'part.measureEdge'}),M('Площадь',{i:'area',id:'part.measureArea'}),M('Взаимное отклонение',{i:'interf'}),S,
   M('МЦХ модели',{i:'mass'}),M('Информация об объекте',{i:'helpq'}),S,M('Проверка коллизий',{i:'boolean'}),M('Проверка гладкости',{s:NOT_CAPTURED}),M('Анализ кривых и поверхностей',{s:NOT_CAPTURED}),M('Анализ отклонений',{i:'checkgeo',id:'part.checkGeometry'})],
 'Управление':()=>[M('Свойства редактируемой модели',{i:'params'}),S,M('Атрибуты...',{d:true}),M('Атрибуты документа...'),S,
   M('Создать чертеж',{i:'linkdraw',k:'Ctrl+D',d:true}),M('Создать чертеж по шаблону',{i:'linkdraw',d:true}),M('Управление связанными чертежами',{i:'linkdraw',id:'part.linkedDrawings',d:true}),S,
   M('Управление исполнениями',{i:'collection'}),M('Создать исполнение',{i:'addpart'}),M('Создать вариант',{i:'copyobj'}),M('Передать в исполнения',{d:true}),S,M('Семейство моделей',{i:'gridpat'}),S,M('Преобразовать в деталь'),S,
   M('Макроэлемент',{s:NOT_CAPTURED}),M('Коллекция геометрии',{i:'collection',id:'part.collection'}),S,M('Управление слоями...',{i:'layers'}),S,M('Пересчет размеров',{s:NOT_CAPTURED}),S,M('Отчеты',{s:NOT_CAPTURED}),S,M('Спецификация',{s:NOT_CAPTURED})],
 'Настройка':()=>[M('Панели',{s:()=>[M('Показывать панели',{ck:()=>ctx.panelsOpen,a:()=>ctx.togglePanels()}),M('Дерево документа',{i:'tree',a:()=>ctx.showTab('tree')}),M('Параметры',{i:'params',a:()=>ctx.showTab('params')}),M('Переменные',{i:'fx',a:()=>ctx.showTab('vars')}),M('Библиотеки',{i:'libs',a:()=>ctx.showTab('libs')}),M('Состав изделия',{i:'tree'})]}),S,
   M('Восстановить лицензии',{d:true}),S,M('Библиотеки стилей',{s:NOT_CAPTURED}),S,M('Параметры...',{i:'gear',a:()=>ctx.openSettings()}),M('Загрузить параметры...'),M('Сохранить параметры...')],
 'Приложения':kompasApplicationsMenu,
 'Окно':()=>[M('Закрыть текущую вкладку',{k:'Ctrl+F4'})],
 'Справка':()=>[M('Содержание'),S,M('Обучающие материалы'),M('Ресурсы в Интернете'),S,M('Использовать онлайн-справку',{}),S,
   M('Лицензионное соглашение'),M('Утилита ключа защиты...'),M('Просмотр списка обновлений...'),M('О программе...',{a:()=>ctx.openAbout()})],
 /* меню режима эскиза */
 'Вставка':()=>[M('Фрагмент...',{i:'collection'}),M('Изображение из вида другого чертежа...',{i:'linkdraw',d:true}),S,M('Рисунок...',{i:'layout'}),M('Гиперссылка...',{k:'Ctrl+L',d:true})],
 'Черчение':()=>[M('Вспомогательные прямые и точки',{s:()=>[M('Вспомогательная прямая',{i:'auxline',id:'sketch.construction'}),M('Точка',{i:'point3',id:'sketch.point'})]}),M('Локальная система координат',{i:'lcs'}),S,
   M('Спроецировать объект',{i:'project',id:'sketch.project'}),M('Объекты пересечения',{i:'condint'}),S,
   M('Отрезок',{s:()=>[M('Отрезок',{i:'line',id:'sketch.line'})]}),M('Окружность',{s:()=>[M('Окружность',{i:'circle',id:'sketch.circle'})]}),M('Дуга',{s:()=>[M('Дуга',{i:'arc',id:'sketch.arc'})]}),M('Эллипс',{s:()=>[M('Эллипс',{i:'circle',id:'sketch.ellipse'})]}),M('Коническая кривая',{i:'conic'}),S,
   M('Автолиния',{i:'autoline',id:'sketch.polyline'}),S,M('Ломаная',{i:'polyline',id:'sketch.polyline'}),M('Сплайн по точкам',{i:'spline',id:'sketch.spline'}),M('Сплайн по полюсам',{i:'spline'}),M('Кривая Безье',{i:'spline'}),M('Преобразовать в сплайн',{i:'spline'}),S,
   M('Фаска/Скругление',{s:()=>[M('Фаска',{i:'schamfer',id:'sketch.chamfer'}),M('Скругление',{i:'sfillet',id:'sketch.fillet'})]}),M('Прямоугольник',{s:()=>[M('Прямоугольник',{i:'rectangle',id:'sketch.rectangle'})]}),M('Паз',{s:()=>[M('Паз',{i:'rectangle'})]}),
   M('Надпись',{i:'textT'}),M('Обозначение центра',{i:'connpoint'}),M('Круговая сетка центров',{i:'gridpat'}),M('Линейная сетка центров',{i:'grid'}),M('Автоосевая',{i:'autoaxis'}),S,
   M('Многоугольник',{i:'contour',id:'sketch.polygon'}),S,M('Собрать контур',{i:'contour'}),M('Эквидистанта',{i:'offset',id:'sketch.offset'}),S,
   M('Преобразовать',{s:()=>[M('Сдвиг',{i:'move',id:'sketch.move'}),M('Поворот',{i:'rotate',id:'sketch.rotate'}),M('Масштабирование',{i:'scale',id:'sketch.scale'}),M('Зеркально отразить',{i:'mirror',id:'sketch.mirror'})]}),
   M('Деформировать',{s:NOT_CAPTURED}),M('Копировать',{s:NOT_CAPTURED}),M('Усечь',{s:()=>[M('Усечь',{i:'trim',id:'sketch.trim'})]})],
 'Ограничения':()=>[M('Выравнивание',{i:'horizontal',id:'constraint.horizontal'}),S,M('Объединить точки',{i:'coincident',id:'constraint.coincident'}),M('Точка на середине кривой',{i:'pointon'}),M('Точка на кривой',{i:'pointon',id:'constraint.pointOnCurve'}),M('Симметрия двух точек',{i:'symmetric',id:'constraint.symmetric'}),M('Концентричность',{i:'concentric',id:'constraint.concentric'}),S,
   M('Параллельность',{i:'parallel',id:'constraint.parallel'}),M('Перпендикулярность',{i:'perpendicular',id:'constraint.perpendicular'}),M('Коллинеарность',{i:'line'}),M('Биссектриса',{i:'dimang'}),M('Касание',{i:'tangent',id:'constraint.tangent'}),S,
   M('Зафиксировать',{s:()=>[M('Зафиксировать',{i:'fixed',id:'constraint.fixed'})]}),M('Равенство',{i:'equal',id:'constraint.equal'}),M('Установить значение размера',{i:'dimauto'}),M('Параметризовать объекты',{i:'dimang'}),S,
   M('Ограничения объекта',{i:'concentric'}),M('Удалить все ограничения',{i:'del'}),S,M('Отображать ограничения',{i:'showcons'}),M('Отображать степени свободы',{i:'showcons'})]
  };
  return { menus, zoom: ZOOM_ITEMS, display: DISPLAY_ITEMS, hide: HIDE_ITEMS, vis: VIS_ITEMS, filter: FILTER_ITEMS };
}

export const KOMPAS_PART_MENU=['Файл','Правка','Выделить','Вид','Эскиз','Моделирование','Оформление','Диагностика','Управление','Настройка','Приложения','Окно','Справка'];
export const KOMPAS_SKETCH_MENU=['Файл','Правка','Выделить','Вид','Вставка','Черчение','Ограничения','Моделирование','Диагностика','Настройка','Приложения','Окно','Справка'];
