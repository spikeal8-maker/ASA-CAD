# ASA-CAD / FUSION-SKETCH-005 — реальные сравнительные скриншоты

Снимки собраны **на D2-R2**: слева — реальный Autodesk Fusion 2706.1.17 (нативная фотография Sketch из подтверждённого коммита `325771d312d757dc98a6e95cb37f07b4eda28bf6`); справа — **действительно установленный на 127.0.0.1:8099** ASA-CAD `ef3a49fb2b1a984f42a312100af5879b1ba1b068` после post-install Playwright.

- [1920×1080](native-vs-asa-1920x1080.png)
- [1366×768](native-vs-asa-1366x768.png)
- Оба приложения представлены в **ориентации FRONT («Спереди»)**, с одним отрезком в эскизе. ASA-CAD использует опору XZ. Исходные координаты концов и масштаб отрезков **различаются**; это сопоставление UI и ориентации, а не доказательство тождественной геометрии или пиксельной точности.
- При снимке 1366×768 Autodesk Fusion имел фактическую минимальную ширину 1393 px и был приведён к сравнимому размеру. Положение элементов на экране сравнивать с учётом этого масштабирования.
- На снимках видны иерархия Browser, Sketch Palette, верхняя Sketch Ribbon, кнопка завершения и ViewCube FRONT.
- Post-install test: Sketch XZ, создание Line, два разрешения, Finish, double-click Reopen, сквозная проверка активного sketchId и куба камеры, 0 JS errors — PASS.
- CI exact-HEAD: [M2 browser 17/17 PASS](https://github.com/spikeal8-maker/ASA-CAD/actions/runs/42615289461), [M2 shell PASS](https://github.com/spikeal8-maker/ASA-CAD/actions/runs/42615289197), [M3 browser PASS](https://github.com/spikeal8-maker/ASA-CAD/actions/runs/42615289329), [Docker PASS](https://github.com/spikeal8-maker/ASA-CAD/actions/runs/42615289256).

**Ограничение:** полная визуальная и функциональная совместимость Autodesk Fusion не заявляется. Скриншоты находятся в отдельной ветке доказательств, не меняющей установленный SHA и состояние PR #229.
