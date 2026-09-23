# ASA-CAD — приёмка видимых изменений

Редакция 2026-09-23. Machine rules неизменны: repository-health.v1.json и milestone-gates.v1.json. ROADMAP — очередь, VISUAL_REFERENCE_SPEC — эталоны, STATUS/#10 — состояние.

## 1. Единица исполнения

Один пакет — одна область интерфейса с действием либо одна functional/maintenance-проблема. Карточка: exact base/branch, owner, scope, источник, различия ДО, ожидаемое ПОСЛЕ, positive/cancel/error, проверки и STOP. Не весь roadmap.
Контролёр отвечает за эталон/критерии, исполнитель за код/evidence, владелец за visual verdict, оператор preview за отдельно разрешённую публикацию. Не выяснять требования заново после каждого результата.
Визуальный пакет не заканчивается только документацией или «стало лучше»: нужен изменённый реальный build. Functional repair получает нужные слои явно; запрет только CSS не делает его неисполнимым. Нужная локальная декомпозиция допустима, новый универсальный framework — нет.

## 2. Выход UI-пакета

Полный реальный ДО/ПОСЛЕ при одинаковых условиях, одинаковые crops, эталон/источник, устранённые/оставшиеся различия, действие/документ, точные SHA/build/CI обязательны. Контролёр просматривает и показывает ключевой PNG в ответе, а не только ZIP/флаги PASS.
Существующий screenshot Actions минимально дополняется в том же пакете: before/after, semantic wait, manifest, retention >=30 дней. Нельзя завершить UI-пакет с «снимки получим следующей задачей». Требование не равно выполненной настройке.
После результата STOP; следующая правка области после verdict. Отказ превращается в конкретные расхождения, не перепись проекта. Baseline screenshot не обновляется автоматически, иначе дефект становится эталоном.
В1 может получить приёмку регионального прогресса. Полный PARITY запрещён при MISSING/несогласованных отличиях обязательного набора. Промежуточное согласие не снимает конечную цель.

## 3. Независимые статусы

| Статус | Доказательство |
|---|---|
| CORE | Алгоритмы/protected regression |
| USER_PATH | Реальные клики/ввод |
| DOCUMENT | Геометрия/IDs/параметры/история/ссылки/save |
| VISUAL_DELTA | Показанная проверенная разница ДО/ПОСЛЕ |
| PARITY | Соответствие закрытому набору эталонных свойств/состояний |
| PREVIEW | Интерактивная сборка с установленной идентичностью |

NOT_TESTED/BLOCKED не PASS, N/A обосновать. Technical merge по разрешению не visual approval. Docs CI не доказывает продукт. При недоступном сервере кадры обязательны, PREVIEW=BLOCKED; В5/В8 не приняты. Основной сайт/сервер не менять без отдельной команды.

## 4. Работа вместо декораций

Урок на обычном `/cad/` с чистым документом; предмет проверки не создавать hidden API/app.execute/localStorage/fixture. Для изолированной регрессии fixtures допустимы; читать документ для проверки можно.
Start → input/selection → preview где предусмотрен → apply/cancel → edit → Undo/Redo → Save/Open. Ошибка не портит документ, отказ save не сообщает «Сохранено». Выбор не edit; просмотр не мутация; вкладки не разделяют history/dirty/command/selection. До multi-document — ownership contract без второго persistence.
Параметры способов ввода имеют один draft/handler; menu/ribbon/search/mobile используют CadUiAction. Не добавлять пустые активные кнопки, не скрывать неподдержанное ради паритета.
Новая операция: классы входов, минимум два допустимых и один недопустимый плюс релевантный topology corpus. Масштаб одного fixture не новый класс. UI-запрет не снимать без команды/ядра.
Проверять text bounds, focus/клики, дочерние подписи, состояние/содержимое. Assertions не ослаблять, force-click и маскировка overlap через z-index/pointer-events запрещены; штатные popup-слои допустимы.

## 5. Расход и безопасность

Вход: STATUS + карточка + AGENTS, затем затронутые файлы. SYSTEM_SPEC — при изменении объёма, ARCHITECTURE — границ. Не читать весь vendor/UIA/docs ради панели.
Одна воспроизводимая проблема/гипотеза, сначала focused tests, итоговые required checks на конечном HEAD. Не коммит API-запросом для каждой строки. Старый GREEN после изменения SHA не свежий. Фиксировать фактический checkout, включая synthetic merge, либо явно собирать exact HEAD.
Две проверенные гипотезы без новой информации → сохранённый diff/checkpoint контролёру. Доказанную причину доводить; это не лимит двух запусков. Повтор внешней ошибки прекращает внешние попытки, не меняет toolchain и не создаёт новый helper.
Без отдельного разрешения запрещены КОМПАС/UIA даже read-only/Desktop Commander, ремонт ПК/среды/worktree/cache/VPN/сети/сервера. Сохранённые данные повторно не добывать. Фактические токены/проверки по доступным метрикам, иначе UNKNOWN; сроки/стоимость не обещать.

## 6. Maintenance

Каждый permanent slice → Slice Quality Gate: owners/budgets/frozen ratchets, дубли/артефакты, regression, compatibility, registry/status/контекст. Cadence считает accepted slices, не commits/CI; задним числом перегруппировывать ради обхода нельзя.
Перед третьим accepted feature touch owner — focused review; раньше при 85% target/новой ответственности. Frozen owner не растёт, extraction снижает ответственность и ceiling. Лимит не повышать ради PASS; bytes авторитетны.
Full Audit после трёх accepted slices и на milestone/integration/release; актуальное evidence переиспользуется, совпавшие триггеры закрывает один полный аудит. План cadence не сбрасывает; промежуточный CSS-edit не отдельный аудит.
GREEN: нет blockers. YELLOW: явный долг/owner/gate, без hard violation/роста/новой ответственности. RED: hard/frozen/architecture/protected regression/compatibility/host drift/запрещённые артефакты; focused repair до расширения. Старый GREEN не отменяет новый product blocker.
Аудит включает upstream/dependencies, schema/persistence/performance, документы/дубли. Tracked caches/logs/backups/build/one-shot workflows запрещены; постоянный screenshot pipeline остаётся. Миграции/pinned vendor не удалять из-за возраста.

## 7. Архитектура, Git и выпуск

UI → typed actions/registries → CadApplication/CadDocument → ASA adapters → OCC/solvers, вычисления клиентские. Без raw OCC/vendor store/UI; сохранять intent, не mesh/pointers. Неоднозначные ссылки отклонять, schema change требует migration/fixture. Upstream автоматически не обновлять.
Protected Part: `60x40 Sketch -> Extrude 10 -> Ø12 cut -> Fillet R1 -> 60→80 -> rebuild -> Save/Open -> edit again`; после M4A — protected Assembly.
Gate B: M2V + M3 exit + M3X обеих сторон + M3M-009 + baselines solve/history/serialization/WASM/recompute + accepted Full Audit. M3X — одинаковые versioned golden fixtures; другой repo отдельно разрешается. Topology corpus: upstream edits/movement/edge-count/reorder/suppress/restore/Save-Open; broken refs never silently bind. До beta — LICENSE/THIRD_PARTY_NOTICE, без неразрешённых High findings, browser/Docker/compatibility/recovery.
Один PR/пакет, review <=6 commits. #147/#149 — historical evidence В1; текущий NEXT берётся из синхронизированных STATUS/#10/#19 и сейчас равен В2 / CAD-VIS-002. Свежие main/PR перед записью, без отката чужого/force-push/автомержа. Docs #148 синхронизирует план/статус и не запускает product-реализацию.
Live STATUS/#10, визуальная карточка #19; исторические NEXT в #5/#145/#143 не текущая задача. Указатели синхронизирует контролёр, history сохраняет. Нет STATUS_V2/AUDIT_FINAL; behavior sync — registry, gate sync — STATUS/Issue, post-merge evidence до следующего пакета.
