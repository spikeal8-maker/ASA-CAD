# ASA-CAD — актуальное состояние

Снимок: 2026-11-08 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**U2, IN_PROGRESS. Full Repository Health Audit = YELLOW_ACCEPTED**, принят #221 на integration `96083954f0180720e7a51616bc6039bde75fa683`. Audited product — `7bf71e2` (#220); [единый отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md) и immutable evidence сохранены.

#221 CI 4/4, post-merge 5/5 SUCCESS; независимый review APPROVE. Аудит закрыл cadence 3/3 после #218–#220. Этот Numeric Line PR станет первым accepted slice нового отсчёта после собственного exact CI/review/merge. Завершение Line не означает приёмку всего U2.

U2 acceptance: Part → XY → Sketch → Rectangle 60×40 → Undo/Redo → Save/Open → те же intent/IDs. Далее U3 → U4 → U5 с обязательными gates.

## Numeric Line

Числовое размещение использует существующий `sketch.line`, один CadDocument/history. Координаты, длина и абсолютный угол от +X работают до/после первой точки. Это временные placement locks; persistent driving constraints относятся к U3.

- Первый цифровой ввод фокусирует длину; обычные Tab/caret/выделение текста сохраняются.
- Length + angle до anchor позволяют разместить отрезок первым click. После commit Line ждёт новую первую точку.
- Invalid raw длины/угла остаётся видимым и блокирует Enter/canvas commit; некорректные координаты не принимаются по Enter. Поддерживается decimal comma.
- Composing Enter не создаёт Line: synthetic DOM composition flag проверяется, OS IME test не заявляется.
- Esc сбрасывает начатый draft, затем завершает инструмент; × завершает сразу.
- Ordinary route проверяет numeric input, Undo/Redo, повторную Line, Save/Open и IDs; mouse/touch/construction flows остаются обязательными.

Matched before/after capture и numeric browser evidence добавлены в существующие CI workflows, retention 30 дней. Новая база/зависимости проверяются отдельно; старые draft receipts не заменяют exact commit proof. Owner visual parity PENDING.

## Канон

- одна продуктовая оболочка `src/web/kompas` для desktop/tablet/phone, общие typed actions и document/history.
- Main `1f8d2627da7ddfa63b31876d46347d0b8080c154`; main/production отдельно.
- Frozen #170: `ui-reference-20261004`, `88c535c652dac8b04f0d68fa144cf8486afdc926`; UI/UX reference.
- CadDocument/CadApplication → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js отображает результат.
- Six kinds: Part, Assembly, Drawing, Fragment, Specification, Text; готовность редакторов различается.

U1A/U1B/U1C приняты #195/#196, responsive KOMPAS #202, LEGACY-CLEANUP-202 #208. Работающие K1/U1 не реализуются повторно.

## Долги и границы

WEB-TYPES, VENDOR-LIFETIME, DEPENDENCIES закрыты #218–#220. Повторный audit: full web 0; native 14 PASS / 699 created / 0 live до cleanup; полный npm audit 0; STANDARD 106 samples / 20 warmups. Bounded native heap и latency SLO не заявляются.

`NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP` — OPEN/YELLOW, owner `/root`: CI/Docker build Node 20.19.0 после EOL; D2 22.23.3 раньше security patch 22.23.4. Reviewed repair обязателен **до U2 technical acceptance / следующей milestone boundary / beta**, exposure не увеличивать. ASA exploit reachability не доказана; npm audit=0 Node debt не закрывает. Новый D2 runtime — отдельное разрешение по quality gates §5.

Frozen owners не растут; ceilings App/ParameterPanel/editing controller снижаются. LICENSE/THIRD_PARTY_NOTICE — pre-beta gate. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` — KNOWN_RISK.

`OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: Draft PR → exact CI/ordinary-user proof/независимый review → технический merge в integration. Main, production, final visual parity и смена цели требуют владельца; owner acceptance PENDING. #177 — reuse после review; #179 и Fusion #204–#207 отдельно. Installer, пользовательские документы и порты 8094/8098/8099 не изменены.
