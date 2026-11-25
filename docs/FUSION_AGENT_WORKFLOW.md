# Fusion: одна задача для агента

Протокол для Qwen 27B и контролёра: одна задача, проверяемый результат в общем CAD-ядре.

## 1. Где брать задание

1. `spec/process/active-work.v1.json` и свежий GitHub определяют текущий checkpoint, базовую ветку и разрешение на продуктовую работу.
2. `spec/process/fusion-tasks.v1.json` хранит определения, зависимости, предлагаемые границы срезов и ссылки на Issues; `docs/FUSION_BROWSER_SPEC.md` — требования.
3. [#237](https://github.com/spikeal8-maker/ASA-CAD/issues/237) ведёт очередь; Issue карточки — статус исполнения, контракт контролёра, назначение и evidence.

При `productCodeStartAllowed=false` новую функцию не начинать. Разрешённая read-only карточка R01 не открывает product gate. Расхождение источников передать контролёру со ссылками.

## 2. Что должно быть в READY

Контролёр публикует в Issue один конкретный контракт:

- ID карточки, `planned_slice_id`, исполнитель, scope и ожидаемый результат;
- актуальная base branch и полный base SHA, рабочая ветка;
- `read_first`, разрешённые файлы/owners, существующие command IDs, budgets/frozen limits;
- reference и наблюдаемая проблема; positive, cancel и error сценарии;
- проверенные зависимости, focused checks, применимый browser/geometry/history/Save-Open proof;
- критерий окончания, ограничения и условия BLOCKED.

Новая операция: минимум два допустимых класса входа и один недопустимый. Внутренняя зависимость — `work_verified` на указанном SHA той же ветки; необходимый внешний срез принят и включён в базу. `needs_detailed_contract=true` требует контракта; BLOCK требует декомпозиции. Номер карточки не означает READY.

## 3. Статусы

| Статус | Кто и когда устанавливает |
| --- | --- |
| PROPOSED | Контролёр зарегистрировал будущую работу; исполняемого контракта ещё нет. |
| NEEDS_BREAKDOWN | Контролёр должен выделить небольшие задачи и уточнить границы/критерии. |
| BLOCKED | Указаны препятствие, evidence и условие возобновления; исполнитель сохраняет достигнутое. |
| READY | Контролёр проверил gate, зависимости и полный контракт, назначил исполнителя. |
| IN_PROGRESS | Назначенный исполнитель подтвердил актуальную базу и начал только эту карточку. |
| REVIEW | Исполнитель передал конкретный diff и отчёт; проверка контролёром/reviewer ещё не завершена. |
| ACCEPTED | Контролёр подтвердил независимое review, обязательный CI точного кандидата, merge и фактический merge SHA; применимые post-merge gates выполнены. |

Переход: PROPOSED → READY → IN_PROGRESS → REVIEW → ACCEPTED. Из PROPOSED возможен NEEDS_BREAKDOWN; из активного состояния — BLOCKED. Возобновление подтверждает контролёр. Review может вернуть доработку в IN_PROGRESS. Новый HEAD требует применимого нового evidence/CI.

`work_verified=true` означает проверку карточки на candidate SHA, без приёмки среза. Карточки одного PR могут оставаться REVIEW с этим признаком. Их ACCEPTED связывается с фактическим merge общего среза.

## 4. Выполнение

1. Прочитать AGENTS, active-work, canonicalDocuments, свою карточку и необходимые `read_first`/owners. Проверить свежие base/main HEAD и блокирующие PR.
2. Подтвердить назначение и допустимый scope в Issue. **Первоначально работает один активный Qwen-исполнитель.** Контролёр последовательно выдаёт работу. Комментарий IN_PROGRESS не является атомарной блокировкой; при конкурирующем назначении остановить запись и сообщить контролёру.
3. Воспроизвести gap; исправить через существующий typed action/общий draft. Сохранить один document/history/solver/persistence.
4. Выполнить focused checks и positive/cancel/error. Предмет USER_PATH создать обычными действиями; hidden `app.execute`/запись localStorage недопустимы. Изолированные fixtures проверять отдельно.
5. Проверить geometry, Undo/Redo, Save/Open, selection/focus по контракту. Для UI сохранить сопоставимые ДО/ПОСЛЕ с build/SHA; baseline автоматически не обновлять.
6. Записать отчёт по форме ниже и поставить REVIEW. Контролёр организует независимое read-only review, обязательные проверки финального HEAD и PR в `integration/ui-core-unification` по действующим правилам.
7. Контролёр записывает merge SHA/evidence в Issue, синхронизирует registry/STATUS/active-work/#184 и проверяет gates перед следующей выдачей.

Исполнитель не сливает собственную работу, не делает direct/force push integration/main и не меняет установленное приложение или среду без действующего разрешения на соответствующее действие. Техническая приёмка и owner visual verdict учитываются отдельно.

## 5. Карточка, срез и аудит

Карточка — единица выдачи; permanent product slice — заранее определённый законченный результат по machine policy. Планирование, контроль и helper не становятся product slices автоматически. В одном PR допустимо несколько связанных карточек; review ≤6 commits.

Каждый permanent slice проходит Slice Quality Gate. Full Audit обязателен после трёх принятых permanent slices и на применимых milestone/integration/release границах; совпавшие триггеры закрывает один аудит. `work_verified`, число Issues, commits или запусков CI cadence не увеличивают и не сбрасывают. Перегруппировывать уже принятые срезы для обхода cadence нельзя.

Owner pressure, extraction и frozen limits — по AGENTS, `repository-health.v1.json` и `milestone-gates.v1.json`; лимиты не повышать ради PASS.

## 6. Стартовый prompt

`node scripts/fusion-tasks.mjs show R01` показывает одну карточку; `next` — ссылку на живую READY-очередь, `validate` проверяет определения. CLI не назначает работу.

Скопировать после назначения контролёром одной READY-карточки:

> Выполни только READY-карточку, назначенную тебе контролёром в GitHub ASA-CAD. Сверь её Issue с spec/process/fusion-tasks.v1.json и актуальным spec/process/active-work.v1.json. Прочитай AGENTS, canonicalDocuments и read_first карточки. Проверь полный base SHA, scope, owners и зависимости. Если единственное действующее назначение или разрешение на этот вид работы не подтверждается, верни BLOCKED с конкретной причиной. Подтверди IN_PROGRESS и реализуй один ожидаемый результат. Используй существующие команды и общее состояние. Проверь positive, cancel и error, затем применимые geometry, Undo/Redo, Save/Open и обычный browser flow. Не ослабляй assertions и не объявляй NOT_RUN успешным. Передай REVIEW с отчётом по восьми пунктам ниже. ACCEPTED, merge и следующую выдачу определяет контролёр по evidence и gates.

## 7. Отчёт в Issue карточки

1. **Задача:** ID, planned slice, статус и назначенный исполнитель.
2. **Версия:** base branch/full SHA, candidate full SHA, PR и фактический checkout проверок; если commit ещё нет — явно uncommitted.
3. **Изменение:** проблема → результат; изменённые файлы/owners и состояние budgets.
4. **Сценарии:** positive/cancel/error; действия, ожидаемое и наблюдаемое; PASS/FAIL/BLOCKED/NOT_RUN.
5. **Проверки:** команды, exit codes, CI URLs; отдельно geometry/history/persistence/USER_PATH, применимое N/A с причиной.
6. **Визуал:** ссылки на ДО/ПОСЛЕ и manifest, просмотренные состояния, оставшиеся расхождения; owner verdict отдельно.
7. **Осталось:** blockers/ограничения, причина незапущенного, сохранённый checkpoint; нужен review или уточнение контракта.
8. **Приёмка контролёра:** independent review, CI точного HEAD, проверенный merge SHA и post-merge результаты, task verified/slice accepted и изменение cadence. До выполнения условий — PENDING.

Публиковать проверенные evidence без секретов, частных документов/путей и raw streams. Приватное evidence хранить отдельно.

## 8. Когда вернуть BLOCKED

Неоговорённая schema/kernel/migration change; второй authoritative state; риск потери данных/неверного StableRef; рост frozen owner; конфликт исполнителей; недоступный обязательный gate; отказ автоматической проверки действия. Передать конкретный факт и сохранённый diff, не менять правила ради обхода. После двух проверенных гипотез без новой информации передать checkpoint контролёру; доказанную причину довести до результата в разрешённом scope.
