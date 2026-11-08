# ASA-CAD — актуальное состояние

Снимок: 2026-11-08 UTC. Live GitHub и machine pointer имеют приоритет.

## Действующая точка

**FULL_REPOSITORY_HEALTH_AUDIT, IN_PROGRESS; U2 не завершён.** Предыдущий Full Repository Health Audit = YELLOW_ACCEPTED, принят #221 на integration `96083954f0180720e7a51616bc6039bde75fa683`. Audited product — `7bf71e2`; [отчёт](FULL_REPOSITORY_HEALTH_AUDIT.md) и измерения Node22.23.3 сохранены.

Numeric Line #222 и CI/build Node repair #223 приняты. Integration `5781e3930cd08d9bada0e0b921ddf28e8a83dcbc`; у каждого PR latest CI 9/9 и post-merge 8/8 SUCCESS, review APPROVE. До приёмки Rectangle пакета cadence **2/3**; после его CI/review/merge — **3/3**. Проверка неизменного дерева на D2 не добавляет repository slice.

Rectangle 60×40 → Undo/Redo → Save/Open: focused Windows proof PASS, те же Sketch intent/IDs и live scene IDs. Сравнивается проекция из десяти полей, не полный CadPartDocument. Третий accepted slice требует Full Repository Health Audit; machine pointer активирует этот gate. Новые функции U2–U5 запрещены до принятого audit. U2 целиком не принят.

## Numeric Line

Существующий `sketch.line`, один CadDocument/history. Координаты, длина и абсолютный угол от +X работают до/после anchor. Placement locks временные; persistent constraints — U3.

- Первый цифровой ввод фокусирует длину; Tab/caret/выделение сохраняются.
- Length + angle до anchor размещают Line первым click; после commit — новая первая точка.
- Invalid длина/угол блокируют Enter/canvas; invalid координаты — Enter. Decimal comma поддерживается.
- Composing Enter сохраняет draft: synthetic DOM flag проверен, OS IME не заявлен.
- Esc сбрасывает draft, затем завершает инструмент; × завершает сразу.
- Ordinary route: numeric, Undo/Redo, повтор, Save/Open и IDs; mouse/touch/construction сохранены.

Matched before/after и numeric evidence — CI, retention 30 дней. **Owner visual verdict PENDING**; текущий пакет панель не меняет.

## Канон

- одна продуктовая оболочка `src/web/kompas`, общие typed actions и document/history.
- Main `1f8d2627da7ddfa63b31876d46347d0b8080c154`; main/production отдельно.
- Frozen #170: `ui-reference-20261004`, `88c535c652dac8b04f0d68fa144cf8486afdc926`.
- CadDocument/CadApplication → ASA adapters → PlaneGCS/OpenCascade B-Rep; Three.js — отображение.
- Part, Assembly, Drawing, Fragment, Specification, Text: готовность различается.

U1A/U1B/U1C приняты #195/#196, responsive KOMPAS #202, LEGACY-CLEANUP-202 #208. K1/U1 повторно не реализуются.

## Долги и границы

WEB-TYPES, VENDOR-LIFETIME, DEPENDENCIES закрыты #218–#220. `NODE_TOOLCHAIN_EOL_AND_SECURITY_PATCH_GAP` закрыт для CI/build #223 и выбранного ASA runtime D2: **Node22.23.4/npm10.9.9**, official ZIP/exe SHA проверены. Новые задачи D2 используют absolute executable из `IZO-ASA-Docker/toolchains/node-v22.23.4-win-x64`; global PATH и прежние процессы сохранены.

Windows proof на `5781e393`: fresh private dependencies, npm run check, checkpoint/canonical и три Line browser entrypoints PASS; 810 tracked files неизменны, порт закрыт. Native lifetime: 14 PASS, 699 created/0 live; whole-heap claim отсутствует. Optional SolveSpace SKIPPED; canonical PlaneGCS/OCC проверены. Evidence/review — #184 и `resolvedAuditDebts`; #221 остаётся историческим audit.

Frozen owners не растут. LICENSE/THIRD_PARTY_NOTICE — pre-beta. `DETECT_ONLY` / `ADMIN_BRANCH_PROTECTION_NOT_ENFORCED` — KNOWN_RISK.

`OWNER_APPROVED_CONTINUOUS_ROADMAP_20261008`: Draft PR → exact CI/ordinary proof/review → technical merge integration. Main, production, final visual parity — решение владельца. #177 — reuse после review; #179/Fusion #204–#207 отдельно. Пользовательские документы и порты 8094/8098/8099 сохранены.
