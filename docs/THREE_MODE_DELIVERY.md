# Доставка общей оболочки ASA CAD

Этот документ описывает команды сборки и отката THREE-MODE-LAUNCHER-001. Фактическая готовность и SHA находятся в `STATUS.md`, PR и `/__asa_health`; наличие инструкции не означает выполненный preflight.

## Границы проекта

`/` открывает выбор редактора. `/cad/kompas/:projectId` и `/cad/fusion/:projectId` используют один CadDocument, application, history и persistence session. Смена mode того же projectId меняет представление. `/cad` остаётся самостоятельным редактором. Server-project и viewer routes распознаются; серверный CAD требует своего API, published viewer пока сообщает недоступность. Локальный delivery server не является API proxy.

Гостевые проекты хранятся в браузере текущего origin. Старый ключ `asa-cad-m2-shell-document` и его `:state` envelope не переписываются при чтении. Новые UUID slots независимы. Не переносите их заменой всего LocalStorage. Повреждённые данные сохраняются без скрытой миграции и остаются доступны raw backup.

Третья карточка Vassalite отображается **недоступной**. Исходники существующего редактора Vassalite не обнаружены в 48 ветках и истории ASA-CAD (проверка 2026-11-08). Создавать редактор заново или подменять его внешним приложением запрещено. Действия «Создать проект» и «Открыть проект» для Vassalite отключены; на главной странице нет переходов в ASA Lab. Выпуск трёх работающих редакторов в `main` заблокирован до появления оригинальной реализации Vassalite и прохождения её проверок.

## Preflight до смены 8099

1. Зафиксировать listener PID, полную командную строку, выбранный Node и JSON `/__asa_health`. Сохранить предыдущие manifest, server и Start/Rollback scripts.
2. Через разрешённый пользовательский браузер открыть прежний сохранённый проект. Зафиксировать геометрию и identity; исходную пользовательскую вкладку не перезагружать.
3. Экспортировать сохранённые CAD slots и все recovery records через реальную кнопку backup. Проверить `complete: true`, origin, counts, наличие скачанного файла и его SHA-256. Несохранённая память вкладки не является частью backup; сохраните такие изменения через редактор. Partial export блокирует установку.
4. Собрать отдельный clean-HEAD delivery package. Проверить кандидат на временном port 0 и старые проекты перед переключением. Постоянные дополнительные порты не создавать.
5. Подтвердить exact-head CI и независимый review. Не считать их заменой browser flow.

Backup JSON содержит исходные строки LocalStorage и raw IndexedDB `asa-cad-recovery/projects`, включая orphan/server records. `undefinedPaths` сохраняет optional undefined fields. Экспорт не открывает отсутствующую базу и не мигрирует записи. `complete` означает успешные чтения; LocalStorage/IndexedDB не образуют одну атомарную snapshot. Скачивание отдельно проверяется на диске. Пользовательские backup files не коммитятся в репозиторий.

## Сборка

На D2 используется выбранный portable Node 22.23.4, без изменения global/default Node. Из чистого checkout:

```powershell
$asaSource = 'C:\Users\spike\Documents\ASA-CAD-Three-Mode-Launcher-20261108'
$asaNode = 'C:\Users\spike\IZO-ASA-Docker\toolchains\node-v22.23.4-win-x64\node.exe'
Set-Location $asaSource
$asaHead = (git rev-parse HEAD).Trim()
$asaDelivery = 'C:\Users\spike\Downloads\ASA-CAD-Three-Mode-' + $asaHead.Substring(0, 7)
& $asaNode build/three-mode-build.cjs --out $asaDelivery --previous-package 'C:\Users\spike\Downloads\ASA-CAD-Fusion-Sketch-Parity-002-c1959b1'
```

Builder отклоняет dirty tree и существующий output. Использует существующий Rspack entry/runtime, добавляет самостоятельную backup page и проверяет все размеры/SHA-256 после копирования. Нельзя подставлять другую source SHA вручную. Для обычного precommit build остаётся `npm run build:asa`; он не становится trusted delivery package.

Отдельная пользовательская страница экспорта до установки:

```powershell
& $asaNode build/three-mode-backup.cjs --out 'C:\Users\spike\Documents\ASA-CAD-Backup-Page' --asset-prefix '/__asa_builds/c1959b1e84a7c38288022622a9585a38c07d3f7e/preflight-backup/'
```

Она состоит только из HTML и одного JS, без CAD/WASM. Её можно добавить как новую папку `preflight-backup` в прежний `app`, не заменяя root entry/server/старые assets, и открыть точный versioned `index.html`. После проверенного download эту добавленную папку перемещают за пределы старого app. Manifest страницы отдельно отмечает её source/dirty состояние и не выдаёт utility за старую CAD-сборку.

## Запуск и откат

Сначала проверить пакет на свободном временном listener:

```powershell
& $asaNode (Join-Path $asaDelivery 'three-mode-server.cjs') --package $asaDelivery --port 0
```

Сервер печатает фактически выделенный адрес. После проверки временный процесс завершается. Остановить разрешается только повторно проверенный прежний PID 8099; прочие службы остаются нетронутыми. Для установленной версии:

```powershell
& $asaNode (Join-Path $asaDelivery 'three-mode-server.cjs') --package $asaDelivery --port 8099
```

Откат: после проверки владельца 8099 остановить только новый listener и запустить тот же пакет с прежним активным entry:

```powershell
& $asaNode (Join-Path $asaDelivery 'three-mode-server.cjs') --package $asaDelivery --port 8099 --active-build c1959b1e84a7c38288022622a9585a38c07d3f7e
```

Это сохраняет origin и данные браузера. Все JS/CSS/WASM по `/__asa_builds/{sha}/` остаются закреплены за своим владельцем; unversioned assets сохраняют прежнего владельца `2420935b7d0642d7994a24231f3e123f42dae19d`. Пакет сохраняет c1959, 242093 и cb7006, а также другие уже retained builds. Отсутствующий asset возвращает 404, а не чужой bundle. Старый оригинальный пакет и его launch scripts дополнительно сохраняются для независимого возврата.

## Postflight и выпуск

Проверить HTTP 200 и source/package SHA health, главную, Компас, Fusion, недоступность Vassalite и отсутствие внешних ссылок, Save → Home → Reopen, F5, clean Back/Forward, dirty Back → Back → Stay, Save-and-leave, mode switch с Undo/Redo и responsive widths. Сравнить старые persisted bytes с backup после чтения новым редактором. Реально переключить rollback и вернуть candidate, проверив тот же документ.

`npm run test:launcher` включает storage/recovery, typed routes, асинхронную навигацию и настоящий HTTP delivery. Этот gate включён в required shell-build. Native browser tests и real user-profile backup выполняются дополнительно.

Release PR должен описывать полный main→integration diff: canonical KOMPAS, strict semantic ingress, async ownership, recovery acknowledgement, stable references/solved profiles, native lifetime, dependency/toolchain repair и numeric Line/Rectangle/Arc. Для накопленных 60 commits лимит review branch — 6; отдельная release branch от main может содержать проверенное squashed дерево с traceability, без переписывания integration или ослабления gate. Перед merge сравнить release tree с принятой integration + launcher.

`NODE_SECURITY_RELEASE_20261111_PENDING` остаётся OPEN до опубликованного fix/reachability review и применимого проверенного обновления. Loopback-only read-only server не доказывает недостижимость неизвестной уязвимости. U2 acceptance, beta и native visual parity не следуют из выпуска launcher автоматически.
