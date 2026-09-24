# ASA-CAD — состояние и следующий видимый результат

Снимок 2026-09-24. Координатор #10, визуальная очередь #19.

## Текущий статус

- В1 / CAD-VIS-001 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В2 / CAD-VIS-002 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В3 / CAD-VIS-003 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- В4 / CAD-VIS-004 — DONE / MERGED / REGIONAL RESULT ACCEPTED.
- CAD-VIS-005 — **INTEGRATION CHECKPOINT / ACCEPTED**.
- CAD-VIS-005 merge: `b79e488ed1a42e2f061eecd44fead279a6b335b2` через PR #160.
- CAD-VIS-005 accepted candidate: `2560e117f3957e9d6bd2cf5b6ac29347cdd20d44`.
- CAD-VIS-005 PRODUCT_DELTA = **NONE**.
- FULL_M2V = **NOT ACCEPTED**.
- FULL_KOMPAS_PARITY = **NO**.
- Full Repository Health Audit #158 = **YELLOW_ACCEPTED**; RED findings = NONE; cadence = **0/3**; feature freeze lifted.

## Что доказал CAD-VIS-005

CAD-VIS-005 не является новой функцией продукта и не является новым слоем визуального паритета КОМПАСа.

Checkpoint доказал, что уже принятые В1–В4 работают одним обычным пользовательским путем:

`/cad/` → новая Деталь → XY-эскиз 60×40 → Finish → Extrude 10 → изменение ширины 60→80 → Rebuild → Save → reload → Open → повторное редактирование того же Sketch.

В PR #160 менялись только evidence/workflow файлы:

- `.github/workflows/m2-browser.yml`
- `.github/workflows/owner-screenshot-capture.yml`
- `tests/m2/part-lesson-browser.mjs`
- `tests/visual/cad-vis-005.mjs`

Product files = **NONE**.

Exact-head #160:
- M2 shell `36019391893` — SUCCESS
- M2 browser `36019391989` — SUCCESS
- M3 browser `36019391969` — SUCCESS
- Docker `36019391961` — SUCCESS
- baseline `36019391923` — SUCCESS
- OWNER_SCREENSHOT_CAPTURE `36019391962` — SUCCESS
- artifact `asa-cad-vis-005`, id `10815509187`, retention 30 days, oldArtifactDependency=false

Post-merge `b79e488e…`:
- M2 shell `36051938366` — SUCCESS
- M2 browser `36051938311` — SUCCESS
- M3 browser `36051938332` — SUCCESS
- Docker `36051938450` — SUCCESS
- baseline `36051938409` — SUCCESS

## Принятые продуктовые слои

- В1: верхняя область Детали / responsive repair — regional result accepted.
- В2: живой Sketch, same-ID finish/select/re-edit/reopen — regional result accepted.
- В3: рабочее меню «Файл», shared New/Open/Save, dirty guard, keyboard/focus — PARITY PARTIAL.
- В4: поддерживаемая панель Extrude, section/profile, «На расстояние», distance/reverse/symmetric, no-mutation, real B-Rep, Save/Open, XZ/YZ fail-closed — PARITY PARTIAL.

Эти результаты не означают полный Part/Sketch parity и не означают полный КОМПАС.

## Следующая продуктовая задача

**NEXT = V6A / CAD-VIS-006A — панель «Вырезать выдавливанием».**

Цель V6A — привести активную панель Cut-Extrude к структуре КОМПАСа в пределах уже поддерживаемой семантики ASA:

- Сечение — реальное имя Sketch;
- Направляющий объект — нормаль к плоскости эскиза;
- Способ — «Сквозь всё»;
- «Создать объект» / «Отмена»;
- без fake end conditions и без расширения kernel/persistence/schema.

V6A не закрывает: расстояние, до объекта, до ближайшей поверхности, второе направление, симметрию, уклон, тонкую стенку, редактирование существующей операции, multi-body application scope, точные proprietary artwork/spacing.

## Gates

Gate A/M2O и M3 core сохраняются. M1 ASA-owned `CadDocument` сохраняет six first-class document kinds: Part, Assembly, Drawing, Fragment, Specification, Text. Gate B остаётся OPEN по M2V, M3 exit, M3X, M3M-009 и performance baselines.

Принятый integration checkpoint CAD-VIS-005 cadence не увеличивает: после #158 остаётся **0/3**, пока machine policy прямо не определит иначе.

ПК, Ali_Robs, Desktop Commander, локальные Docker/browser tests и изменения сети не являются test environment для этой очереди.
