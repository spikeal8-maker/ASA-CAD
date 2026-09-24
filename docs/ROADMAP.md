# ASA-CAD — воспроизведение КОМПАСа с видимыми поставками

Редакция 2026-09-24. План, не готовность. STATUS/#10 — состояние; SYSTEM_SPEC — полный объём; KOMPAS_SHELL_LAYOUT_SPEC — ТЗ оболочки; VISUAL_REFERENCE_SPEC — эталоны; DEVELOPMENT_QUALITY_GATES — проверки.

## Цель

Воспроизвести согласованную конфигурацию КОМПАС-3D v25 в браузере: интерфейс, структуру, панели, состояния, команды и поведение. Работающий учебный сценарий сам по себе не доказывает визуального паритета.

FULL_M2V = **NOT ACCEPTED**. FULL_KOMPAS_PARITY = **NO**.

## Принятые продуктовые слои

**В1 / CAD-VIS-001 — DONE / accepted regional result.** Верхняя область Детали и responsive repair.

**В2 / CAD-VIS-002 — DONE / accepted regional result.** Один Sketch проходит finish/select/re-edit/reopen с тем же identity; single-Sketch acceptance не закрывает full multi-sketch policy.

**В3 / CAD-VIS-003 — DONE / accepted regional result.** Рабочее меню «Файл», shared New/Open/Save, dirty replacement guard, keyboard/focus. PARITY = PARTIAL.

**В4 / CAD-VIS-004 — DONE / accepted regional result.** Поддерживаемая панель Extrude: section/profile, «На расстояние», distance/reverse/symmetric, invalid/Cancel no-mutation, real B-Rep, Save/Open, XZ/YZ fail-closed. PARITY = PARTIAL.

## CAD-VIS-005 — integration checkpoint

CAD-VIS-005 принят через PR #160, merge `b79e488ed1a42e2f061eecd44fead279a6b335b2`.

Это **integration checkpoint / end-to-end Part verification**, а не отдельная новая функция ASA-CAD и не новый визуальный слой КОМПАСа.

PRODUCT_DELTA = **NONE**.

Checkpoint доказал совместный обычный пользовательский путь уже принятых В1–В4:

`/cad/` → новая Деталь → XY 60×40 → Finish → Extrude 10 → 60→80 → Rebuild → Save/Open → re-edit same Sketch.

Exact-head и post-merge применимые GitHub gates — SUCCESS. Artifact: `asa-cad-vis-005` id `10815509187`, retention 30 days, oldArtifactDependency=false.

Full Repository Health Audit #158 остаётся YELLOW_ACCEPTED; RED findings = NONE; cadence после audit и принятого permanent checkpoint CAD-VIS-005 = **1/3**. Machine registry `spec/process/repository-health.v1.json` считает каждый accepted permanent slice независимо от product delta.

## NEXT — V6A / CAD-VIS-006A

**V6A / CAD-VIS-006A — панель «Вырезать выдавливанием».**

Цель — привести активную панель к структуре КОМПАСа только в пределах реально поддерживаемой ASA семантики:

- реальное сечение / имя Sketch;
- направляющий объект: нормаль к плоскости эскиза;
- способ: «Сквозь всё»;
- «Создать объект» / «Отмена»;
- begin/cancel без мутации document;
- Apply через существующий `part.cutExtrude → feature.cutExtrude`;
- Save/Open сохраняет Sketch / cut Feature / Body identity;
- protected Part regression остаётся GREEN.

V6A не расширяет kernel, CadDocument schema, migrations или persistence protocol.

Не заявлять реализованными:
- «На расстояние»;
- «До объекта»;
- «До ближайшей поверхности»;
- второе направление;
- «Симметрично»;
- уклон;
- тонкую стенку;
- редактирование существующей операции;
- multi-body application scope.

Эти пункты остаются REMAINING_CUT_EXTRUDE_PARITY.

V6A visual evidence:
- BEFORE = exact fresh main после CAD-VIS-005 closeout;
- AFTER = exact V6A PR HEAD;
- ordinary `/cad/`, без primary fixture;
- artifact `asa-cad-vis-006a`, retention >=30 days, oldArtifactDependency=false.

V6A PR остаётся Draft и не merge.

## Дальнейшая очередь

| Пакет | Статус / результат |
|---|---|
| В1 / CAD-VIS-001 | DONE / regional accepted |
| В2 / CAD-VIS-002 | DONE / regional accepted |
| В3 / CAD-VIS-003 | DONE / regional accepted / PARITY PARTIAL |
| В4 / CAD-VIS-004 | DONE / regional accepted / PARITY PARTIAL |
| CAD-VIS-005 | INTEGRATION CHECKPOINT / ACCEPTED / PRODUCT_DELTA NONE |
| V6A / CAD-VIS-006A | NEXT — Cut-Extrude parameters |
| V6B+ | позже, отдельными показанными slices |
| V7 | resize / state matrix позже |
| V8 | закрытая Part/Sketch acceptance позже |

## Gates

Gate A/M2O и M3 core сохраняются. Gate B перед broad M4 остаётся OPEN: M2V, M3 exit, M3X, M3M-009, performance baselines.

Regional acceptance и integration checkpoint не переносят acceptance автоматически на следующий slice или весь КОМПАС.

Работа этой очереди выполняется через GitHub repository/branch/PR/Issues/Actions/artifacts. Локальные ПК, Ali_Robs, Desktop Commander и локальный Docker не являются test environment.
