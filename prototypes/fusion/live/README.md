# Fusion Sketch Tools Behavior 003 — изолированный кандидат ASA-CAD

Контекстная русскоязычная среда «Эскиз» поверх общего приложения ASA-CAD. Ветка `visual/fusion-sketch-tools-behavior-v3` создана от текущего PR #206, `visual/fusion-sketch-parity-v2`, точный SHA `c1959b1e84a7c38288022622a9585a38c07d3f7e`. Отдельный Draft PR направляется в эту исходную ветку; merge не выполняется. Приоритет этого изменения — настоящее непрерывное поведение Line. Эталон: установленный Fusion 2706.1.17 на D2-R2, отдельный документ `Untitled*(2)`, наблюдения 7 ноября 2026 года.

`FULL_REPOSITORY_HEALTH_AUDIT` и `productCodeStartAllowed=false` остаются в силе. Код этого кандидата ограничен `prototypes/fusion/` и добавлением проверки в существующий `.github/workflows/fusion-kernel-shell.yml`: продуктовые `src/`, `vendor/`, схемы, основная сборка, `main` и `integration` не изменяются. Это работающая экспериментальная оболочка, а не разрешение на продуктовый merge.

## Запуск

На D2-R2 кандидат предназначен для **http://127.0.0.1:8099/**. Порты 8094 и 8098 принадлежат предыдущим версиям и не используются этим запуском. Адрес доступен в браузере самого D2-R2: сервер слушает только loopback.

Из отдельного checkout:

```sh
npm --prefix vendor/toubkal ci
node prototypes/fusion/live/run.cjs
node prototypes/fusion/live/serve.cjs --port 8099 --open
```

Самостоятельный пакет (manifest version 8, workspace `fusion-sketch-v1`):

```sh
node prototypes/fusion/live/package.cjs --out ../ASA-CAD-Fusion-Sketch-v1
node prototypes/fusion/tests/live-package-smoke.mjs ../ASA-CAD-Fusion-Sketch-v1
```

Пакет содержит приложение, WASM, лицензии, сервер и стартовые скрипты. `Start.cmd` / `start.sh` запускают порт 8099. `delivery-manifest.json` содержит Git SHA и SHA-256 файлов. `/__asa_health` возвращает версию, workspace и `sourceHead` установленного пакета.

Для обновления установленной версии используется `--previous-package` с каталогом полностью проверенного предыдущего пакета. Сборку и упаковку выполняют из чистого checkout точного commit: сам `package.cjs` не доказывает, что рабочее дерево было чистым. Нельзя повторно использовать source SHA предыдущего пакета или перезаписывать существующий каталог доставки. Новая entry ссылается на `/__asa_builds/<sourceHead>/`; старые unversioned JS/WASM остаются закреплены за исходным приложением `2420935`, чтобы открытые вкладки могли догрузить ядро после смены сервера. Manifest включает проверенные retained-копии всех предыдущих поколений и хеш предыдущего manifest. `Rollback.cmd` / `rollback.sh` переключают entry именно на предыдущий SHA, сохраняя ресурсы всей цепочки, включая новый пакет.

`live-package-browser-upgrade.mjs` проверяет обновление на собственном временном порту. В текущей цепочке кандидат становится четвёртым поколением; до обновления открываются вкладки предыдущего и исходного приложений; вкладка предыдущего приложения сохраняет Sketch до загрузки OCC, исходная вкладка открывает тот же сохранённый эскиз. После замены сервера обе выполняют настоящий Extrude; исходная вкладка делает это без Save, сохраняя общие данные неизменными. Новая вкладка открывает сохранённые данные, rollback возвращает entry предыдущего поколения, а холодная загрузка проверяет доступность каждого поколения. Проверяются исходные хеши ресурсов, принадлежность ответов и побайтовая неизменность сохранённых данных. Обязательные переменные: `ASA_FUSION_PREVIOUS_PACKAGE`, `ASA_FUSION_CANDIDATE_PACKAGE`, `ASA_CAD_BROWSER_EXECUTABLE`; `ASA_FUSION_EVIDENCE_DIR` задаёт каталог доказательств вне чистого checkout. Тест не использует пользовательский профиль или установленный порт 8099.

Сохранение использует существующий `LocalStorageCadProjectHost`. Документ хранится в браузере на текущем origin. Открывайте тот же профиль браузера и тот же порт; сохранение в 8098 автоматически не переносится в 8099. «Сохранить» и «Открыть» вызывают штатные команды приложения.

## Быстрая самостоятельная проверка

1. Создать документ «Деталь», нажать «Создать эскиз», выбрать XY / XZ / YZ и подтвердить.
2. Нажать L и последовательно указать пять точек: получатся четыре связанных отрезка без повторного включения команды. Галочка у последней точки завершает цепочку, сохраняя Line активной; Esc выходит из Line. В предпросмотре набрать длину, нажать Tab, ввести угол, нажать Tab и подтвердить щелчком: сегмент создаётся, Line сразу продолжает цепочку. Enter создаёт сегмент и выходит из инструмента, как наблюдено в Fusion. Для первого сегмента угол отсчитывается от оси; для следующих — внутренний угол к обратному лучу предыдущего сегмента, с выбором стороны указателем. Угол задаёт координаты построения; сохраняемый параметрический размер этого угла пока недоступен. R и C включают прежние инструменты прямоугольника и окружности.
3. Выделить геометрию и выбрать подходящий размер в меню эскиза или контекстном меню. Ввести значение и нажать Enter / ОК. Двойной щелчок по размеру в поле открывает его редактирование.
4. В правой палитре проверить сетку, привязки, точки, профили, размеры и значки ограничений. Выбрать отрезок для переключения вспомогательной геометрии.
5. Завершить эскиз. Для гарантированного параметрического прямоугольника 60×40 можно воспользоваться числовыми полями инструмента «Прямоугольник». Выдавить замкнутый профиль на 10 мм.
6. Снова создать эскиз, выбрать настоящую грань тела, построить окружность Ø12, завершить и выполнить сквозной вырез. Сохранить, открыть и изменить диаметр через дерево размеров.

Числовой прямоугольник использует существующий параметрический владелец и добавляет связи между сторонами. Прямоугольник двумя кликами использует существующую direct-команду: создаёт четыре отрезка, но не добавляет автоматически Coincident/H/V. Его стороны можно размерять и ограничивать существующими командами; произвольное изменение отдельной стороны без связей может разомкнуть контур. Новый Line создаёт настоящие Coincident между последовательными концами и при замыкании, а H/V — только при включённых привязках и действительном указании соответствующей оси. У прежних direct-инструментов координатная привязка сама по себе не создаёт таких ограничений.

## Что подключено

- Лента переключается между Model / Sketch. Контекстная лента следует девяти группам и рекурсивному составу API-экспорта Fusion; неподключённые команды остаются недоступными с причиной.
- Непрерывная цепочка Line с плавающими длиной и углом. Изолированная замена `useSketchLineTool` хранит только transient-ввод; реальные сущности, ограничения, размеры и история создаются существующим CadApplication. Прямоугольник двумя углами, окружность «центр–радиус» и дуга «центр–начало–конец» сохраняют прежние контроллеры.
- Линейный, горизонтальный, вертикальный, диаметральный, радиальный и угловой размеры через штатные `CadUiAction`. Доступность зависит от выбранной геометрии.
- Ограничения, уже представленные общим ядром: горизонтальность, вертикальность, совпадение концов, параллельность, перпендикулярность, касание отрезка и окружности, концентричность окружностей, равенство отрезков, симметрия поддерживаемых точек относительно отрезка, фиксация и конец отрезка на другом отрезке.
- Выбор и перемещение элементов с существующим solver-preview. Удаление и вспомогательная геометрия используют общие команды и историю.
- Палитра управляет фактическими слоями. Профили определяет общий `analyzeSketchProfile`, а не отдельная геометрическая модель. Отображение размеров и ограничений читает реальные коллекции документа.
- Line: endpoint, начало цепочки, H/V, origin и midpoint. Совпадение концов, замыкание, горизонтальность и вертикальность создают реальные связи; origin/midpoint пока задают координаты без сохраняемого геометрического ограничения. Другие direct-инструменты сохраняют прежние привязки к концам, центрам, началу координат и сетке.
- Масштаб колесом в активном инструменте и в режиме выбора, панорамирование средней кнопкой и отдельным режимом левой кнопки, вписывание и сброс.
- Context menu, Enter, Escape, поиск и горячие клавиши. При отмене редактирования размера сохраняется режим эскиза. Сворачивание палитры сохраняет смонтированные параметры, включая защиту повторного подтверждения.
- Сценарий Sketch → Extrude → настоящая грань → Sketch → Cut → Fillet → сохранение/открытие использует OpenCascade B-Rep, единственный CadDocument и существующую историю.

## Line: поведение и границы 003

Статус полного задания: **BLOCKED_PRODUCT_CONTRACT / NATIVE_PARITY_NOT_ACCEPTED**. Прежний тест двух щелчков с немедленным Escape не доказывал непрерывность; новый сценарий проверяет четыре сегмента в одном включении команды и три настоящих Coincident. Пять топологических точек — это пять классов эквивалентности восьми концов по refs, а не пять нарисованных маркеров.

Ввод длины и угла находится у геометрии. Оба поля принимают точку и запятую, Tab/Shift+Tab переключают поле, фиксация одного параметра оставляет другой управляемым курсором. Неверное число не создаёт геометрию. Длина создаёт настоящий driving `dimension.linear`; фиксация угла действует только на координаты создаваемого сегмента, что указано в подсказке поля. Значки постоянных ограничений читаются исключительно из CadDocument. В цепочке ввод 120° означает внутренний угол к предыдущему сегменту; положение указателя выбирает одну из двух допустимых сторон. Плавающие поля не перекрывают начальную точку, рассчитанный endpoint и последнюю точку указателя до числовой фиксации.

| Действие | Подтверждённое поведение |
| --- | --- |
| Щелчок по конечной точке | Создать один сегмент, продолжить цепочку от решённого endpoint |
| Enter в числовом или обычном preview | Создать один сегмент, выйти из Line |
| Галочка у конечной точки | Убрать preview, завершить цепочку; Line ожидает новую первую точку |
| Двойной щелчок по endpoint | Создать один сегмент без дубликата, завершить цепочку; Line остаётся активной |
| Escape из preview | Убрать только незавершённый preview и выйти; уже принятые сегменты остаются |
| Замыкание | Создать последнюю Line и Coincident к началу; оставить Line ожидающей первую точку |
| Повторное нажатие активной Line на ленте | Сохранить текущую цепочку |
| «Повторить: Отрезок» в Marking Menu | Завершить текущую цепочку и начать ожидание новой |
| Escape при открытом Marking Menu | Закрыть меню, сохранить Line |

Нативные переходы зафиксированы в [line-003-native-observed.json](../evidence/line-003-native-observed.json): 53 записи кадров с SHA-256 и отдельными UIA metadata. Записи 48, 52 и 53 исключены из доказательств поведения: первая не подтвердила ввод, две последние получены при перемещении native-окна. Последнее принятое числовое наблюдение — кадр 51: длина 30 мм, внутренний угол 120°, щелчок продолжает Line. Оригиналы находятся в указанном там каталоге D2-R2; исходные документы пользователя не редактировались. Снимки интерфейса не заменяют чтение native constraint IDs. У native comma-ввода получено неоднозначное отличие; эквивалентность native expression parser не заявляется.

### Transient FSM и единственный решатель

`LiveLineInteraction` — мост transient-состояния между адаптированным hook и существующим stage. В нём нет CadDocument, dispatcher, solver instance или истории. `run.cjs` подменяет только UI hook в изолированной Fusion-сборке; продуктовый App и обычная сборка остаются прежними.

| Состояние | Назначение |
| --- | --- |
| IDLE | Line выключена |
| AWAITING_START | Ожидание первой точки новой цепочки |
| PREVIEW_SEGMENT | Незавершённая геометрия от текущего начала |
| NUMERIC_INPUT | Редактирование длины/направления preview |
| COMMITTING_SEGMENT | Выполнение принятых команд и ожидание общего solver |
| CONTINUING_CHAIN | Следующий anchor получен из решённого endpoint |
| CLOSING_CHAIN | Создание последнего сегмента и Coincident замыкания |
| CANCELLED | Отмена transient-ввода перед выходом или сбросом |

Синхронный ref-lock закрывает интервал до React render и остаётся установленным до решения PlaneGCS. Stage вызывает собственный существующий `restorePersistedPreview`, связывая запрос с document identity, sketch ID, revision и fingerprint entities/constraints/dimensions. Новый solver не создаётся. Hook принимает только converged snapshot с нужными ID; начало следующего сегмента и начало цепочки берутся из `previewEntities`. Undo/Open или изменение документа во время ожидания не возвращают старый ghost и не объявляют stale IDs завершёнными.

Escape после уже принятого клика отменяет продолжение интерфейса; принятый сегмент завершает свои существующие команды, пока документ не заменён. Ошибка после создания Line сообщается как частичный результат, без скрытого rollback и повторяемого дубликата.

### Что замороженный контракт пока не позволяет

| Требование | Текущее состояние | Точный владелец разрыва |
| --- | --- | --- |
| Параметрический абсолютный угол первой Line | Координаты 40 мм / 30° и настоящий размер длины; абсолютного driving angle нет | `dimension.angular` требует две реальные Line; отсутствует direction input общего adapter contract |
| Параметрический внутренний угол цепочки | Геометрия 30 мм / 120° с выбором стороны указателем; длина сохраняется, угловой размер не создаётся | Текущий directed two-Line contract хранит forward angle; нужны явные angleSense/branch и сохранение native interior value |
| Один Undo на сегмент вместе с автоматическими связями | Реальные Undo/Redo и стабильные ID, но отдельный frame на каждый execute | Нет atomic creation intent у `sketch.line` |
| Origin / midpoint как сохраняемые связи | Только координатные привязки, без ложного constraint glyph | Нет соответствующих semantic refs/commands |
| Line → tangent Arc удержанием endpoint | В native наблюдено; в кандидате не реализовано | Общие Coincident/Tangent owners не принимают нужные Arc refs |
| Полный native lifecycle остальных Sketch tools | Прежнее поведение сохранено | Следующая работа отложена до принятия Line |

[Неприменённый product diff](../evidence/line-003-product-contract.proposed.patch) подготовлен против c1959b1: typed creationIntent для Line/Arc, focused owners, native PlaneGCS primitive mappings для origin/midpoint/direction, Line–Arc refs, сохраняемый `angleSense` с отдельной ветвью поворота, schema 4/migration и regression tests. Внутренние 120° сохраняются как 120°; только adapter получает дополнительный угол 60° и нужный порядок solver refs. `git apply --check` выполнен; patch **не применён**, его TypeScript/solver/CI не проверялись. Он не реализует rollback уже записанного intent при позднем solver conflict. Предложение затрагивает 32 будущих файла (+1108/−63); SHA-256 `aa59bc09789058e4a1c2811b1ea263c96299a937beee193747e3718ef4aa71cb`. Оно требует отдельного разрешённого product review после снятия freeze.

### Проверка нового поведения

`node prototypes/fusion/tests/live-fusion-line-behavior-browser.mjs` всегда поднимает собственный port-0 server и свежие browser contexts; 8094/8098/8099 запрещены для этого локального runner. Через настоящий UI проверяются A–I: цепочка, числовая геометрия, замыкание → OCC Extrude10, Cancel, IDs/history, Save/Open, wheel/MMB, клавиатура/locale/focus, двойные события, повтор команды и актуальность Snap. Десять состояний снимаются отдельно для парного сравнения с native. B absolute driving angle и E atomic segment+constraints остаются **BLOCKED** даже при зелёных исполняемых проверках; I подтверждается отдельными прежними regression gates.

Доработка превышает review threshold 1500 handwritten changed lines главным образом за счёт UI сценариев и явного FSM; независимый архитектурный review проведён, обнаруженные гонки и focus/navigation defects исправлены. Отдельно проверен `LiveSketchLineTool.ts`: 27 164 байт, 502 строки; review охватывает границы владельца, identity/history, solver settlement и отмену. Prototype path не совпадает с ограниченными `src/web` prefix budgets; продуктовые владельцы и machine policy не изменены. Proposed patch и созданные PNG/JSON учитываются отдельно как неприменённое предложение и доказательства. Старые proof gates не ослабляются, core byte ceilings и audit policy не меняются.

[Десять пар native/ASA-CAD, числовой ввод, Extrude10 и Cancel до/после](../evidence/line-003/README.md) сохранены вместе с полным результатом 17 исполняемых проверок, включая числовое подтверждение щелчком с продолжением цепочки внутренний угол 120° и плавное наведение мыши на поля/фиксацию. Это snapshot рабочей ветки до commit, привязанный к каноническому хешу runtime inputs; exact-HEAD CI подтверждается отдельно для окончательного SHA.

Матрица `sketch-command-matrix.v1.json` сохраняет прежние данные binding/menu coverage и отдельно отмечает `behavior003` каждой каталожной строки. Старый PASS одношагового Line не считается native behavior acceptance. Остальные инструменты не получают новый PASS до своей проверки.

## Размерные линии

Линейные, горизонтальные и вертикальные размеры одного отрезка теперь показывают выносные линии, заполненные стрелки и числовую подпись. Геометрия аннотации строится по фактическим решённым концам; H/V используют проекции на соответствующую ось. Порядок концов не меняет положение надписи, а у короткого отрезка стрелки выносятся наружу. Размеры шрифта, стрелок и отступов сохраняются в CSS-пикселях при zoom.

Оформление сверено с новым кадром настоящего Fusion: [постоянные размеры 60×40](../evidence/fusion-parity-native-linear-dimensions-2048-dpi110.png), metadata — `../reference_capture/sketch-native-dimensions-20261106.json`. Нативные аннотации размещены вручную; у текущего CadDocument нет сохраняемой позиции подписи, поэтому оболочка использует автоматический отступ 54 px. Перетаскивание или сохранение положения размеров этим изменением не добавлены.

Двойной щелчок по подписи вызывает прежний редактор через общий callback. Проверка `fusion-live-sketch-dimensions-checks.json` подтверждает Cancel, изменение 60→80, реальные решённые координаты, Undo/Redo, Save/Open со стабильными ID и размеры элементов отображения при 2048×1137, 1600×900 и 1366×768. Существующая диаметральная аннотация сохранена. Radius, Angular и неподдерживаемые сочетания ссылок остаются текстовыми аннотациями; новая геометрия размерных линий для них не заявляется.

## ViewCube: точная граница текущего результата

В Sketch куб показывает ориентацию текущей опоры; действия «На эскиз», «Показать всё», Home и zoom связаны с действительной 2D-рамкой редактирования. Оси XY/XZ/YZ сохраняются в локальной плоскости соответствующей опоры. При выходе в Solid снова работает исходный 3D ViewCube и общая камера модели.

**Свободная 3D-орбита при редактировании эскиза не подключена.** Недоступные вращения и проекции не изображают работающую камеру. Это проверяемая архитектурная граница:

- `src/web/SketchEditingStage.tsx` передаёт в `CadViewport` `model={null}` и использует отдельную SVG-рамку для ввода и выбора.
- `src/web/viewport/SketchWorkplaneProjection.ts` возвращает `origin/u/v/normal` для базовых плоскостей. Для `stable-reference` (грани) рамка отсутствует, `modelContextReady=false`.
- Сценарий эскиза на грани работает через StableRef и ядро, но её 3D-положение не разрешено для общего редактирующего viewport.

Недостающий контракт: разрешение StableRef в рабочую плоскость; единое преобразование screen/ray → sketch-plane; синхронизация камеры, отображения и hit testing эскиза с 3D-моделью. Изменять этот продуктовый контракт до разрешения текущего аудита нельзя. Замена представления в прототипе не создаёт вторую камеру модели, математический движок или независимый документ.

### Предложенный продуктовый контракт — НЕ РЕАЛИЗОВАН

**Статус: `PROPOSED_NOT_IMPLEMENTED / BLOCKED_PRODUCT_CODE_START`.** Основание — `spec/process/active-work.v1.json`, `productCodeStartAllowed=false`; исходная ревизия анализа — `2420935b7d0642d7994a24231f3e123f42dae19d`. Ни один из следующих интерфейсов или extraction-шагов не применён к `src/`. Это предложение для будущего разрешённого изменения продукта. Оно даёт пространственный вид и редактирование существующего **плоского** эскиза; пространственные сущности «3D Sketch» им не вводятся.

Плоскость грани уже умеет вычислять `OpenCascadePartRuntime.resolveSketchPlane`: StableRef → сохранённая сигнатура → `resolveFace` на текущем `featureShapes.get(ownerFeatureId)` → `captureFace` найденной реальной грани → `sketchPlaneFrame(live.axis, live.centroid)`. Нужно выделить и открыть этот read-only путь, а не повторить геометрию в UI. Поля `locator.axis/centroid` служат сигнатурой поиска и сами по себе не доказывают положение грани после перестроения. `captureReference` приложения для этой задачи непригоден: он создаёт StableRef и меняет документ.

**Минимальный DTO и read API.** Следующие определения предполагаются в новом `src/contracts/sketchScene.ts`; существующие типы, frame-конвенция и `CadRenderModel` переиспользуются без изменения формата документа:

```ts
import type { CadPartDocument, CadSketchSupport } from './document';
import type { CadDocumentId, CadSketchId } from './ids';
import type { CadRenderModel } from './render';
import type { CadSketchPlaneFrame } from './sketchWorkplane';

export interface CadResolvedSketchWorkplane {
  readonly status: 'ready';
  readonly sketchId: CadSketchId;
  readonly support: CadSketchSupport;
  readonly frame: Readonly<CadSketchPlaneFrame>;
  readonly runtimeRevision: string | null;
}

export type CadSketchWorkplaneFailure =
  | 'runtime-unavailable'
  | 'runtime-stale'
  | 'sketch-missing'
  | 'reference-missing'
  | 'reference-unresolved'
  | 'reference-ambiguous'
  | 'support-non-planar';

export type CadSketchWorkplaneResolution =
  | CadResolvedSketchWorkplane
  | {
      readonly status: 'unavailable';
      readonly sketchId: CadSketchId;
      readonly reason: CadSketchWorkplaneFailure;
    };

export interface CadSketchWorkplaneProvider {
  getSketchWorkplane(
    document: Readonly<CadPartDocument>,
    sketchId: CadSketchId,
    expectedRuntimeRevision: string | null,
  ): CadSketchWorkplaneResolution;
}

export interface CadSketchSceneSnapshot {
  readonly documentId: CadDocumentId;
  readonly status: 'ready' | 'rebuilding' | 'unavailable';
  readonly runtimeRevision: string | null;
  readonly model: Readonly<CadRenderModel> | null;
  readonly workplane: CadSketchWorkplaneResolution;
}

export interface CadSketchSceneProvider {
  getSketchScene(
    document: Readonly<CadPartDocument>,
    sketchId: CadSketchId,
  ): CadSketchSceneSnapshot;
}
```

`OpenCascadePartRuntime` предоставляет `CadSketchWorkplaneProvider`; `BrowserPartRuntimeAdapter` предоставляет `CadSketchSceneProvider`. Его `LoadedPartRuntime` получает `workplanes: CadSketchWorkplaneProvider`, ссылающийся на **тот же** `coreRuntime`, который уже обслуживает render adapter и `SolvedSketchPartRuntimeAdapter`. Второй OCC runtime, solver, документ и путь recompute не создаются.

Один вызов `getSketchScene` публикует согласованные model + frame. Для грани `workplane.runtimeRevision === scene.runtimeRevision === model.runtimeRevision`; отсутствие model или несовпадение даёт `unavailable`, ввод выключается с причиной. Origin-plane использует `originPlaneFrame`: без BRep разрешён `runtimeRevision=null`, без загрузки OCC; при наличии model revision совпадает с ним. Provider хранит идентичность документа последнего успешного recompute и отклоняет геометрию другого документа.

Перед перестроением можно сохранить последнюю **целую согласованную пару** для отображения со статусом `rebuilding`; запрещено соединять старый mesh и новую/неразрешённую плоскость. Ввод на такой паре блокируется. Успешное перестроение атомарно заменяет её, неудачное сбрасывает доступность. Ключ кеша — documentId + sketchId + support + runtimeRevision; изменение StableRef, undo/redo, замена документа и сбой rebuild инвалидируют его. Read API не вызывает recompute, не пишет историю и не выдаёт наружу OCC pointers, shape handles или Three objects.

**Камера и единая проекция.** Предлагаемые presentation-интерфейсы находятся в `src/web/viewport/SketchSceneProjection.ts`; они временные и не сериализуются в CAD-документ:

```ts
import type { CadPoint2 } from '../../contracts/document';
import type { CadPoint3 } from '../../contracts/sketchWorkplane';
import type { CadResolvedSketchWorkplane } from '../../contracts/sketchScene';

export type CadMatrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

export interface CadViewportCameraPose {
  readonly position: CadPoint3;
  readonly target: CadPoint3;
  readonly up: CadPoint3;
  readonly projection: 'perspective' | 'orthographic';
  readonly zoom: number;
  readonly viewHeight: number;
  readonly fovDegrees: number;
  readonly near: number;
  readonly far: number;
}

export interface CadViewportCameraSnapshot {
  readonly sequence: number;
  readonly pose: CadViewportCameraPose;
  readonly screen: Readonly<{
    left: number; top: number; width: number; height: number;
  }>;
  readonly viewProjection: CadMatrix4;
  readonly inverseViewProjection: CadMatrix4;
}

export interface CadViewportCameraBridge {
  snapshot(): CadViewportCameraSnapshot;
  restore(pose: CadViewportCameraPose): void;
  normalTo(workplane: CadResolvedSketchWorkplane, scale: 'preserve' | 'fit'): void;
  subscribe(listener: () => void): () => void;
}

export interface CadSketchProjection {
  readonly workplane: CadResolvedSketchWorkplane;
  readonly camera: CadViewportCameraSnapshot;
  project(point: CadPoint2): readonly [clientX: number, clientY: number] | null;
  unproject(clientX: number, clientY: number): CadPoint2 | null;
}
```

Матрицы — column-major, `viewProjection = projectionMatrix × matrixWorldInverse` той же камеры, которой рисуется BRep. `screen` и результаты `project` задаются в CSS-пикселях окна, как `PointerEvent.clientX/clientY`; devicePixelRatio учитывается только на границе renderer, не повторно при выборе. `viewHeight` — видимая высота у target; вместе с pose сохраняются target, zoom и тип проекции. Передача только направления position − target, как в нынешнем prototype navigation attach, не сохраняет полный вид.

Прямое преобразование использует существующий `planeFramePoint(frame, [x,y])`, затем общую viewProjection. Обратное строит луч той же камеры через inverseViewProjection и пересекает его с `dot(normal, point − origin)=0`; локальные координаты — скалярные произведения hit − origin на `u` и `v`. Параллельный луч, нечисловой результат, точка за камерой или вне clip range возвращают `null`. Для лежащего ребром эскиза показывается недоступность ввода, а не произвольная точка.

Тот же неизменяемый snapshot проекции на кадр потребляют SketchOverlay, ghost preview, selection/hit testing, точки привязки, размеры, ограничения, direct-tool input и drag. SVG можно сохранить, но его примитивы и hit shapes должны проектироваться этой камерой; вращать только SVG или передать `renderModel` вместо `null` недостаточно. Кривые при наклонном виде требуют корректной проекции/тесселяции с общей экранной погрешностью, а допуски выбора и snap задаются в CSS-пикселях. ID сущностей и callbacks существующих команд не меняются.

Gesture фиксирует sketchId + support + runtimeRevision + camera.sequence + существующий application revisionToken. Изменение plane/document во время drag отменяет preview; изменение камеры либо отменяет gesture, либо явно пересчитывает его от исходной точки до commit. Нельзя молча применить координаты другого кадра. Один `CadViewport` и одна камера остаются смонтированными при переходе Solid ↔ Sketch; ViewCube, «На эскиз», pan, zoom, orbit и восстановление вида используют один camera bridge. Наблюдённая ниже политика нативной камеры задаёт цель будущей реализации; эти сигнатуры не объявляют её уже воспроизведённой.

**Наблюдённая последовательность нативного Fusion, 6 ноября 2026.** Проверка выполнена в реальном приложении, 2048 × 1137, DPI 110; это свидетельство поведения эталона, не результат prototype E2E.

1. Щелчок по углу ViewCube при активном Sketch переводит эскиз в наклонный вид, сохраняя режим редактирования: [cube-oblique-sketch](../evidence/fusion-parity-native-cube-oblique-sketch-2048-dpi110.png).
2. Запуск Line сохраняет этот наклонный вид; команда активна и ожидает первую точку: [cube-oblique-line-active](../evidence/fusion-parity-native-cube-oblique-line-active-2048-dpi110.png). Само рисование в наклонном виде этим кадром не подтверждается.
3. Look At возвращает вид по нормали к плоскости эскиза: [cube-look-at](../evidence/fusion-parity-native-cube-look-at-2048-dpi110.png).
4. Finish Sketch возвращает Solid с прежней наклонной ориентацией: [finished-solid](../evidence/fusion-parity-native-finished-solid-2048-dpi110.png).
5. Двойной щелчок по эскизу в timeline снова открывает Sketch по нормали: [reopened-sketch](../evidence/fusion-parity-native-reopened-sketch-2048-dpi110.png).

Подтверждены видимая ориентация и переходы режимов в этой последовательности. Равенство полного camera pose, target, zoom и типа проекции пока не измерено. Статус предложения остаётся `PROPOSED_NOT_IMPLEMENTED / BLOCKED_PRODUCT_CODE_START`.

**Точные extraction-шаги после разрешения продуктового изменения.** Замороженные владельцы уже равны byte ceilings; расширение их пределов в это предложение не входит.

| Текущий владелец / предел | Выделение и итоговая ответственность |
| --- | --- |
| `src/runtime/OpenCascadePartRuntime.ts`, 15119 байт | В `OpenCascadeSketchPlaneResolver.ts` перенести существующий resolveSketchPlane и нужное преобразование face signature. Экструзия/вырез и новый read provider вызывают один resolver. Владение featureShapes и OCC остаётся внутри runtime; наружу выходит только numeric DTO. |
| `src/browser/BrowserPartRuntimeAdapter.ts` | Добавить workplanes к существующему LoadedPartRuntime, хранить состояние успешной ревизии/документа и атомарную пару render/frame. Не загружать ядро для origin-only эскиза. |
| `src/web/CadViewport.tsx`, 27374 байта | В `viewport/ViewportSceneController.ts` выделить scene/camera/controls lifetime и публикацию camera snapshot. CadViewport делегирует ему, сохраняя текущие BRep picking и selection callbacks. |
| `src/web/PartModelStage.tsx`, 2561 байт; `src/web/SketchEditingStage.tsx`, 5989 байт | Выделить `PartEditingScene`: один постоянно смонтированный CadViewport, origin planes и model, а поверх — выбранный режим. SketchEditingStage сохраняет существующие solve/drag/command hooks и получает scene projection через context, не монтирует собственную camera scene. |
| `src/web/App.tsx`, 14486 байт | Вынести существующую передачу render/workarea props в `usePartSceneSnapshot`/`PartWorkarea`; подключить один provider read. Сохранить document/controller/history ownership, не добавлять в App геометрию или новый глобальный store. |
| `SketchViewportFrameContext.tsx`, `SketchOverlayLayer.tsx`, `SketchSelectionLayer.tsx`, `SketchInteractionSurface.tsx`, `SketchDirectToolLayers.tsx` и их constraint layers | Ввести projection context, совместно перевести render и input с отдельного square viewBox на общую проекцию. Старое 2D-преобразование допускается только как явно ограниченный fallback, который не заявляет 3D editing. |

Порядок будущего изменения: (1) разрешённая extraction без изменения поведения и byte ceilings; (2) read-only runtime/frame provider с revision checks; (3) постоянная scene/camera + projection context; (4) одновременное переключение всех overlay/input потребителей; (5) подключение ViewCube и подтверждённой нативной camera policy. Текущий prototype может исправлять компоновку, палитру, grid/fit/pan/snap и обратимые настройки отображения, используя существующие команды. Указанные runtime, projection и scene-lifetime шаги — **product-owned blocker**, они не закрываются CSS или вторым CAD-движком.

Приёмка будущего slice: XY/XZ/YZ и реальная плоская грань; совпадение локальной системы с направлением extrusion; round-trip local → screen → plane после orbit/pan/zoom в обеих проекциях; мышью line/circle/drag/dimension на наклонном виде; одинаковые frame/revision для overlay и mesh после изменения upstream размера, undo/redo и save/open; честный отказ при ambiguous/unresolved/non-planar support; отсутствие ввода со stale frame после failed rebuild; один canvas/camera и сохранение полного pose при переходах. Ни один такой тест этим разделом не объявляется выполненным.

## Источник ленты и визуальная приёмка

Основной API-источник этой переработки — `../reference_capture/sketch-active-ui-20261106.json`, захваченный при действительно активной вкладке `FusionSolidEnvironment / SketchTab`:

- Fusion **2706.1.17**, захват **2026-11-06T00:43:13.217889+00:00**; exporter errors отсутствуют.
- SHA-256 полного исходного JSON: `6296518a467ed73ce8b91281bf8727db1788cb8eb6999fbfb70bab245eeb4c1c`; компактного active capture: `18be2710ecd716650df37cf1ecff3ff14ff783ddadbdc5d08c438d8de00a9434`.
- Девять групп; из 155 исторических позиций 134 представлены в активном меню, 21 скрыта или является удалённым при нормализации разделителем. Скрытые позиции не считаются проверенными disabled-командами.
- В исходном историческом `sketch-native-reference.v1.json` сохранён экспорт от 4 ноября, когда была активна SolidTab. Он служит перечнем позиций; видимость активного Sketch определяется новым capture.
- Физически видимые большие кнопки проверяются по снимкам отдельно от API promotion: 33 при 2048 × 1137, 24 при 1600 × 900, 19 в узком окне.

`../reference_capture/sketch-native-observations-20261106.json` хранит измеренные границы, порядок физических кнопок и ограничения сравнения. Оригиналы `../evidence/fusion-parity-native-*.png` получены из реального клиентского окна без ресэмплинга. `GetDpiForWindow` вернул **110 DPI**, то есть примерно 114,6% от 96 DPI; это не «110%». Окно приняло 2048 × 1137 и 1600 × 900; запрос 1366 × 768 был ограничен самим Fusion до **1375 × 768**. Имя узкого снимка сохраняет запрошенную ширину, фактическая ширина записана в metadata. Поэтому строгая нативная приёмка при DPR 1 ещё не доказана.

SVG в `sketch-icons/` нарисованы отдельно по наблюдённым значкам. Ресурсы и брендинг Autodesk не извлекались. Русские переводы и дополнительные прямые входы к поддерживаемым операциям — авторская адаптация.

`sketch-command-matrix.v1.json` содержит покомандное соответствие Native ID → русский перевод → SVG → меню → CadUiAction. Результаты поведения отделены от проверки состава и disabled-состояний: проверка наличия кнопки не выдаётся за исполнение операции. Для подключённых, но не исполненных в данном браузерном сценарии команд сохраняется `NOT_BROWSER_TESTED`. Матрица содержит SHA-256 использованных отчётов E2E. Исходный workspace-сценарий подтверждает десять уникальных действий; новый `fusion-live-sketch-actions-checks.json` добавляет остальные четырнадцать: Coincident, Tangent, Equal, Parallel, Perpendicular, Fixed, Concentric, Symmetric, PointOnCurve, Horizontal/Vertical/Radius/Angular Dimension и Delete. Итого выполнены все 24 уже подключённых CadUiAction. Это исполнение перечисленных маршрутов, а не подтверждение всех вариантов нативных команд. Дополнительный отчёт допускается только при совпадении текущих хешей теста, helper и binding, revision/capture, PASS и пустых pageErrors; каждая команда отдельно требует solver, persistence, Undo/Redo и Save/Open. Отсутствующее или устаревшее доказательство не повышается до PASS.

Воспроизведение после браузерных проверок:

```sh
node --import ./vendor/toubkal/node_modules/tsx/dist/loader.mjs prototypes/fusion/live/generate-sketch-matrix.mjs
```

**Статус полного визуального совпадения: NOT_ACCEPTED.** Реальные снимки активного Sketch, меню, палитры, подсказок и переходов камеры теперь есть. Парный браузерный сценарий приводит поле к измеренному масштабу настоящим wheel input и записывает измерения границ с допуском ±2 CSS px. Это не доказывает индивидуальную точность всех SVG, типографики и всех hover/pressed-состояний. API-состав, исполнение команд, совпадение измеренных границ и окончательная визуальная приёмка имеют разные статусы.

Наши снимки при 2048×1137, 1600×900 и 1366×768, DPR 1, сохраняются как `../evidence/fusion-live-sketch-workspace-*.png` и `../evidence/fusion-live-sketch-parity-*.png`. JSON результатов не присваивает им full native visual parity. Поле использует одну рамку для grid, overlay, выбора и ввода по всей ширине; round-trip и изотропность проверяются отдельными frame/field-сценариями. Начальный span общего продукта остаётся 100; его масштаб отличается от нативного и в парных снимках согласуется реальным колесом мыши, а не подменой модели.

В финальной парной последовательности измерения основных границ 13 состояний укладываются в допуск; это `MATCHES_REFERENCE_CLIENT_PX`, а не приёмка всех пикселей изображения. Реальный «Вид на эскиз» вызывает общее вписывание: после него span меняется с 177,02096 на 143, center — с `[0,0]` на `[5,7.5]`, начало координат смещается относительно нативного примерно на `[-33.08,+50.62]` CSS px. Этот кадр имеет `DIFF`; переход в Solid снят, но его геометрия интерфейса не измерена.

У парной сцены есть отдельный обычный отрезок рядом с прямоугольником и окружностью. Нативный Fusion заливает замкнутую область; текущий общий `analyzeSketchProfile` отклоняет весь профиль при свободном конце, поэтому prototype не рисует эту заливку. Сценарий workspace с вспомогательным отрезком подтверждает действующую голубую заливку и настоящую экструзию. Извлечение отдельных замкнутых областей среди открытых цепочек требует отдельного разрешённого изменения общего profile contract; независимый анализатор контуров в оболочку не добавлен. Также direct-прямоугольник не получает нативные автоматические связи, поэтому индивидуальные цвета определённости и значки связей могут различаться. Эти различия сохраняются в настоящих снимках.

## Проверки

```sh
node prototypes/fusion/live/typecheck.cjs
npm run test:process
node prototypes/fusion/live/run.cjs
node prototypes/fusion/live/package.cjs --out ../ASA-CAD-Fusion-Sketch-v1
node prototypes/fusion/tests/live-package-smoke.mjs ../ASA-CAD-Fusion-Sketch-v1
node prototypes/fusion/tests/live-promoted-artwork.mjs
node prototypes/fusion/tests/live-ribbon-browser.mjs
node prototypes/fusion/tests/live-kernel-browser.mjs
node prototypes/fusion/tests/live-protected-part-browser.mjs
node prototypes/fusion/tests/live-hole-wizard-browser.mjs
node prototypes/fusion/tests/live-navigation-browser.mjs
node prototypes/fusion/tests/live-interaction-browser.mjs
node prototypes/fusion/tests/live-sketch-input-browser.mjs
node prototypes/fusion/tests/live-sketch-dimensions.mjs
node --import ./vendor/toubkal/node_modules/tsx/dist/loader.mjs prototypes/fusion/tests/sketch-matrix-proof-gate.mjs
node prototypes/fusion/tests/live-server-upgrade.mjs
```

`ASA_FUSION_URL` указывает на уже работающий сервер. `ASA_CAD_BROWSER_EXECUTABLE` необязателен для UI-сценариев: по умолчанию используется установленный Chromium pinned Playwright. `live-sketch-input-browser.mjs` после исходного direct-input сценария запускает workspace, frame, field, paired parity, размерные линии и четырнадцать дополнительных действий. Существующий exact-HEAD CI выполняет эти проверки; отдельный добавленный step запускает новый `live-fusion-line-behavior-browser.mjs` на его собственном временном порту. Локальные дополнительные action-тесты запрещают установленные 8099/8098 и используют отдельный порт; 8094 разрешён только disposable-серверу GitHub Actions.

Новые сценарии создают геометрию через pointer/keyboard UI. Чтение сохранённого JSON используется для проверок. Тесты не записывают документы в localStorage и не вызывают скрытые функции создания модели. Исходные отдельные регрессии камеры сохраняют свои существующие изолированные fixtures.

Новый E2E обходит все девять групп и десять нативных подменю; исполняет вертикальность через комбинированную кнопку H/V, проверяет клавишу D, привязки on/off по сохранённым координатам, трёхточечный ввод поддерживаемой дуги из центра, реальное перетаскивание с Undo, создание на XY/XZ/YZ и удаление цели активного размера через Undo. Размер в Create остаётся нативным leaf; шесть существующих действий доступны через поиск и дополнительный раздел контекстного меню. Панель не оставляет доступное подтверждение для исчезнувшего объекта. Правый клик по пустому полю или профилю очищает прежний выбор через общий callback и не оставляет Delete/Fix включёнными для старой цели.

Typecheck сравнивает кандидата с исходной базой: **8 существующих ошибок; допустимо 0 новых**. `NO_NEW_DIAGNOSTICS` не означает чистый полный TypeScript. Исходные диагностики сохраняются в evidence; фильтры не ослаблены.

Процессные проверки запускаются до сборки или в чистом checkout: действующий аудит проверяет также локальные `dist/` и считает сгенерированные бандлы файлами репозитория. Прототип не меняет правила этого аудита. Exact-HEAD CI публикует `fusion-live-*.json/png` с retention 30 дней.

## Что ещё недоступно

Сплайны, дополнительные виды прямоугольников/окружностей/дуг, пазы, многоугольники, Trim/Extend/Offset/Fillet в эскизе, массивы, проецирование, 3D Sketch, общее автоматическое наложение ограничений за пределами нового Line и прочие команды, не имеющие действующего CadUiAction, отображаются как disabled. Нативная широта Fusion не заявляется.

Сохранённый мастер базового отверстия v7 использует существующие Sketch + Circle + Cut-команды и остаётся ограничен простым сквозным отверстием. Глухие, резьбовые и зенкованные отверстия, самостоятельная Hole-фича и полный rollback/suppression истории не добавлены этим кандидатом.
