# ASA-CAD — состояние и следующий видимый результат

Снимок 2026-09-24. Координатор #10, визуальная очередь #19. В4 / CAD-VIS-004 принята как региональный результат и merged в #156; post-merge push CI на merge SHA зелёный. Полный M2V и полный паритет КОМПАСа не приняты. Следующий продуктовый пакет — В5 / CAD-VIS-005; этот status-closeout не является началом В5 и не разрешает deploy.

## Зафиксированные версии

- Текущий product main перед этим status-only closeout: `c73ed9a4f3a33b16c96645f162894c8e5f8d9e2e` — merge #156.
- Принятый продуктовый merge В4: `c73ed9a4f3a33b16c96645f162894c8e5f8d9e2e` — merge #156; accepted candidate tree `3a0fda6e553c0c85194123881f55e153346e11ff`.
- В4 exact-head evidence: artifact `asa-cad-vis-004` id `10797593467`, retention 30 days; pre-merge exact-head M2 shell / M2 browser / M3 browser / Docker / baseline / OWNER_SCREENSHOT_CAPTURE — SUCCESS; post-merge M2 shell / M2 browser / M3 browser / Docker / baseline — SUCCESS.
- В4 regional result: section/profile shown; method = `На расстояние`; distance; reverse; symmetric; invalid and Cancel no-mutation; direct/reverse/symmetric real B-Rep; Save/Open; XZ/YZ fail-closed. PARITY = PARTIAL.
- Remaining Extrude parity: full B-Rep phantom; second direction; other end conditions; draft angle; thin wall; application scope; properties; editing existing feature; multi-profile selection; exact proprietary artwork; unmeasured exact spacing.
- Принятый продуктовый merge В3: `0cca7a4fa85eb1fdac648778fb6a1d5340cedaea` — merge #154; accepted candidate tree `25b2b739343a8ec8fbbed2bcdbe38571d1bc602b`.
- В3 exact-head evidence: artifact `asa-cad-vis-003` id `10792069532`, retention 30 days; pre-merge exact-head M2 shell / M2 browser / M3 browser / Docker / baseline / OWNER_SCREENSHOT_CAPTURE — SUCCESS; post-merge M2 shell / M2 browser / M3 browser / Docker / baseline — SUCCESS.
- В3 regional result: working File dropdown; shared New/Open/Save; shared dirty replacement guard; keyboard/focus behavior. PARITY = PARTIAL.
- Remaining File parity: Save As; Close; Recent documents; Export; other KOMPAS File commands; exact proprietary artwork; unmeasured exact dropdown spacing/grouping.
- Принятый продуктовый merge В2: `397229c4ff5e6325aeb169c12fba66398ab2aada` — merge #152; accepted candidate tree `397cf0dbf3567ab05c6cbb25b768fa9b075ef18a`.
- В2 exact-head evidence: artifact `asa-cad-vis-002` id `10775390067`, retention 30 days; pre-merge exact-head gates и post-merge M2 shell / M2 browser / M3 browser / Docker / baseline — SUCCESS.
- Принятый продуктовый merge В1: `cd343bb7219052c2a9b6080466da5b22b44d561f` — merge #150; accepted tree `74a0c8806ea53dbee99e6e7184e817ff9d0f388a`.
- #148 merged в main как историческое plan/status изменение: `e1ef771edc560cd4c697395e8ebeca22097628a9`.
- #147 `d57aa7e8a2696caa53ec66f020aaa866b7911dec` и #149 `812c7eacc1e9303e4f6dc321a80cd310fdcab174` закрыты без merge как superseded; это исторические product/evidence checkpoints.
- #146: `dfa849513ad957c8782c8de4f618ca14b883a59f`, Stage 0 измерений. Повторный сбор остановлен.

## Вердикт

Gate A/M2O и M3 core сохраняются. Angular/DoF/диагностику заново не делать. Six document kinds в CadDocument/CadApplication: Part, Assembly, Drawing, Fragment, Specification, Text. Эти шесть типов документа не означают шесть готовых редакторов.
M2V = NOT ACCEPTED. Общий интерфейс владельцем не принят. Урок и GREEN не доказывают копирование КОМПАСа.

| Пробел | Поставка |
|---|---|
| Группы/контролы трактовались по крупным rect, подписи обрезаны | В1: DONE — regional result accepted, merge `cd343bb7…`; общий Part/Sketch parity не закрыт |
| Эскиз вне edit заменяется сообщением | В2: DONE — regional result accepted, merge `397229c4…`; same Sketch ID/support survives finish/select/re-edit/reopen; multi-sketch policy остаётся позже |
| Названия меню без раскрытия | В3: DONE — regional result accepted, merge `0cca7a4…`; File dropdown/New/Open/Save/dirty guard/keyboard-focus accepted, PARITY PARTIAL |
| Неполная приёмка активных параметров | В4: DONE — regional result accepted, merge `c73ed9a4…`; Extrude supported subset accepted, PARITY PARTIAL; В6 другие команды |
| Целый урок/интерактивная версия не приняты | В5 / CAD-VIS-005: NEXT — первый целый интерактивный урок Детали |
| Дерево/вкладки частично декоративны | В6 с ownership и реальными действиями |
| Не доказан паритет состояний/resize | В7/В8; UNKNOWN не PASS |
| Порядок операций ограничен шаблоном | M4 после Gate B с kernel proof |

## Следующее задание

Единственная следующая продуктовая задача — **В5 / CAD-VIS-005 — первый целый интерактивный урок Детали**. Запуск только отдельной исполнительной командой после принятия этой status-only синхронизации.
В4 / CAD-VIS-004 = MERGED / REGIONAL RESULT ACCEPTED: merge #156 `c73ed9a4f3a33b16c96645f162894c8e5f8d9e2e`, accepted candidate `3a0fda6e553c0c85194123881f55e153346e11ff`; section/profile, method `На расстояние`, distance, reverse, symmetric, invalid/Cancel no-mutation, direct/reverse/symmetric real B-Rep, Save/Open и XZ/YZ fail-closed приняты. PARITY = PARTIAL; remaining Extrude parity остаётся позже.
В3 / CAD-VIS-003 остаётся MERGED / REGIONAL RESULT ACCEPTED: merge #154 `0cca7a4fa85eb1fdac648778fb6a1d5340cedaea`, accepted candidate `25b2b739343a8ec8fbbed2bcdbe38571d1bc602b`.
В5–В8, M4, multi-sketch UX и deploy не запускаются этим closeout.
В1, В2, В3 и В4 = MERGED / REGIONAL RESULT ACCEPTED. Это не означает полный паритет оболочки: M2V = NOT ACCEPTED, FULL_KOMPAS_PARITY = NO.

## Открыто и сохранено

Gate B открыт: M2V, M3 exit, M3X обеих сторон, M3M-009, baselines, Full Audit. #57 009 открыт; cadence/frozen budgets/совместимость сохранены. Счётчик берётся из accepted records, не commits/CI.
Текущая очередь #10/#19; исторические NEXT в #5/#145 и статусный #143 не поручение повторять core/capture. #148 уже merged и является историческим plan/status изменением, не активной задачей. Текущие указатели синхронизирует контролёр, историю сохраняет.
ПК, КОМПАС/UIA/Desktop Commander, сеть/сервер и ремонт worktree/runtime/cache не входят в UI-задачи. Никаких новых clones ради ремонта старой среды. Только сохранённые материалы и изолированный build ASA-CAD.
CORE/USER_PATH/DOCUMENT/VISUAL_DELTA/PARITY/PREVIEW фиксируются отдельно. План не является выполненным продуктовым изменением.
