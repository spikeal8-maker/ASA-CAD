/* ASA-CAD Fusion shell v4. Original icon drawings, not Autodesk assets.
   Exact per-command mapping: no generic icon reused for different commands. */
(function(){
"use strict";
const P={
 blue:'<path d="M8 13 24 5l17 8-17 9Z" fill="url(#asc-blue-top)" stroke="#7495a8" stroke-width="1.4"/><path d="M8 13v24l16 9V22Z" fill="url(#asc-blue-left)" stroke="#6c9ab7" stroke-width="1.4"/><path d="M24 22 41 13v24l-17 9Z" fill="url(#asc-blue-right)" stroke="#507e9e" stroke-width="1.4"/>',
 grey:'<path d="M8 14 24 6l17 8-17 8Z" fill="url(#asc-grey-top)" stroke="#8998a1"/><path d="M8 14v23l16 8V22Z" fill="url(#asc-grey-face)" stroke="#919fa5"/><path d="M24 22 41 14v23l-17 8Z" fill="#b7c1c8" stroke="#899aa3"/>',
 purple:refinedIco.form,
 sketch:refinedIco.sketch,
 hole:refinedIco.hole,
 fillet:refinedIco.fillet,
 chamfer:refinedIco.chamfer,
 shell:refinedIco.shell,
 combine:refinedIco.combine,
 move:refinedIco.move,
 plane:refinedIco.plane,
 ruler:refinedIco.ruler,
 section:refinedIco.section,
 picture:refinedIco.picture,
 select:refinedIco.select,
 gear:refinedIco.config,
 mesh:ico.mesh,
 scissors:refinedIco.scissors,
 joint:refinedIco.assembly,
 patch:'<path d="M6 30Q12 6 26 13T43 25l-1 12Q25 21 8 42Z" fill="url(#asc-surface)" stroke="#5d94b4" stroke-width="1.6"/><path d="M7 31Q18 18 42 24" fill="none" stroke="#f0faff" stroke-width="2"/>',
 arrowUp:'<path d="M38 42V9m-8 9 8-10 8 10" fill="none" stroke="#39a5d5" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 41V13" stroke="#e4f7ff" stroke-width="1.1"/>',
 arrowDown:'<path d="M37 6v33m-8-9 8 10 8-10" fill="none" stroke="#2d9bc9" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
 plus:'<path d="M39 27v18m-9-9h18" stroke="#0b9f46" stroke-width="5"/><path d="M39 28v16m-8-8h16" stroke="#9cf3b5" stroke-width="1.2"/>',
 cross:'<path d="M9 9 40 40M40 9 9 40" stroke="#e97154" stroke-width="3" stroke-linecap="round"/>',
 axis:'<path d="M24 4v40" stroke="#b0b9bd" stroke-width="1.6" stroke-dasharray="4 3"/>',
 cut:'<path d="m5 39 38-28" stroke="#f29d38" stroke-width="3.5" stroke-dasharray="6 2"/>',
 smallBox:'<path d="m11 15 9-5 9 5-9 5Z" fill="#c5eaff" stroke="#75a4bf"/><path d="M11 15v11l9 5V20Z" fill="#75c3ea" stroke="#6397b1"/><path d="M20 20 29 15v11l-9 5Z" fill="#308fc4" stroke="#527e9a"/>',
 rounded:'<path d="M6 40V24Q6 7 22 7H43v15H25q-5 0-5 6v12Z" fill="#dbe4e8" stroke="#768d9b" stroke-width="1.5"/><path d="M20 26q0-5 7-5h14" stroke="#59b6e3" stroke-width="4" fill="none"/>',
 sweep:'<path d="M5 37Q12 8 30 11t13 25" fill="none" stroke="#68bde3" stroke-width="9" stroke-linecap="round"/><path d="M7 33Q15 11 32 16" fill="none" stroke="#e5f8ff" stroke-width="3"/>',
 warning:'<path d="M22 6 43 43H3Z" fill="#f4c46f" stroke="#a38549" stroke-width="2"/><path d="M22 18v12m0 6v2" stroke="#706d67" stroke-width="3"/>',
 doubleArrow:'<path d="M8 31h32m-9-8 9 8-9 8M18 23l-10 8 10 8" fill="none" stroke="#458db9" stroke-width="3"/>',
 doc:'<path d="M10 4h20l9 10v30H10Z" fill="#f6f8f9" stroke="#82939f" stroke-width="1.7"/><path d="M30 4v10h9M15 21h19M15 28h19M15 35h12" fill="none" stroke="#9bb6c6" stroke-width="2.2"/>',
 table:'<path d="M5 9h40v34H5Z" fill="#e5ebef" stroke="#a6b1b8" stroke-width="1.5"/><path d="M5 18h40M18 9v34M32 9v34M5 31h40" stroke="#b7c6d0" stroke-width="1.8"/>',
 wrench:'<path d="M36 7a11 11 0 0 0-11 13L9 36l6 6 17-16A11 11 0 0 0 44 13l-7 6-7-6Z" fill="#99b9cb" stroke="#5b8ca8" stroke-width="2"/>',
 ring:'<ellipse cx="25" cy="24" rx="18" ry="12" fill="#d6edf9" stroke="#769cac" stroke-width="1.9"/><ellipse cx="25" cy="24" rx="10" ry="6" fill="#f7fbff" stroke="#4c9ccc" stroke-width="1.8"/>',
 cylinder:'<ellipse cx="24" cy="12" rx="13" ry="6" fill="#c9eafb" stroke="#6696b2"/><path d="M11 12v24a13 6 0 0 0 26 0V12" fill="#60aedd" stroke="#6a90a5"/><ellipse cx="24" cy="36" rx="13" ry="6" fill="#98d0ed" stroke="#6696b2"/>',
 dotted:'<path d="M8 9h30v30H8Z" fill="none" stroke="#44a5d5" stroke-width="2.2" stroke-dasharray="4 4"/>'
};
const A={
 'Создать эскиз':P.sketch,
 'Эскиз':P.sketch+'<path d="M5 43h30" stroke="#5aa6c7" stroke-width="1.6"/>',
 'Выдавливание':P.blue+'<path d="M12 10V4m-5 5 5-5 5 5" stroke="#6e9cad" stroke-width="2" fill="none"/>',
 'Вращение':'<path d="M7 29q0-17 19-17t16 17v8Q23 18 7 38Z" fill="url(#asc-surface)" stroke="#6795aa" stroke-width="1.7"/><path d="M10 26q15-13 29 1" fill="none" stroke="#f8fdff" stroke-width="4"/><path d="M29 6Q10 1 6 18m1-6-1 7 8-2" fill="none" stroke="#5886a4" stroke-width="2.3"/>',
 'Отверстие':P.hole,
 'Прямоугольный массив':'<g transform="translate(-2 -1) scale(.62)">'+P.smallBox+'</g><g transform="translate(19 -1) scale(.62)">'+P.smallBox+'</g><g transform="translate(-2 19) scale(.62)">'+P.smallBox+'</g><g transform="translate(19 19) scale(.62)">'+P.smallBox+'</g><path d="M25 8h13m-4-4 4 4-4 4M25 29h13" stroke="#429ccc" stroke-width="1.7" fill="none"/>',
 'Форма':P.purple,
 'Обрезать':P.scissors,
 'Нажать/Вытянуть':'<path d="M6 30 24 20l16 9-18 9Z" fill="#b9e6fa" stroke="#7791a3"/><path d="M6 21 24 11l16 9-18 9Z" fill="#83bde4" stroke="#6c8eab"/><path d="m24 20 16-9" stroke="#e5faff" stroke-width="2"/>'+P.arrowUp,
 'Скругление':P.fillet,
 'Оболочка':P.shell,
 'Объединить':P.combine,
 'Фаска':P.chamfer,
 'Переместить':P.move,
 'Параметры':P.doc+'<text x="17" y="36" font-size="16" fill="#5a91b8" font-weight="700">fx</text>',
 'Конфигурации':P.table+'<path d="M33 8v36" stroke="#64a8d2" stroke-width="3"/>',
 'Свойства':P.doc+'<circle cx="36" cy="35" r="8" fill="#9ec5df" stroke="#688ead"/><path d="M36 30v9" stroke="#e8faff" stroke-width="2"/>',
 'Смещённая плоскость':P.plane+'<path d="m15 8 14 7 14-7" stroke="#63afce" stroke-width="2.4" stroke-dasharray="2 2" fill="none"/>'+P.doubleArrow,
 'Плоскость':P.plane+'<path d="M12 11 26 20" stroke="#b5ddf0" stroke-width="2"/>',
 'Измерить':P.ruler,
 'Измерение':P.ruler+'<path d="m13 11 26 25" stroke="#438faf" stroke-width="2.3"/>',
 'Анализ сечения':P.section,
 'Холст':P.picture,
 'Наклейка':refinedIco.decal,
 'Вставка':P.picture+'<path d="M38 33v14m-7-7h14" stroke="#2da35a" stroke-width="4"/>',
 'Соединение':P.joint,
 'Выбрать':P.select,
 'Поверхность вращения':P.ring+'<path d="M35 8a19 19 0 0 1 8 15m-8-2 8 2 2-8" fill="none" stroke="#4a9ec4" stroke-width="2.5"/>',
 'Поверхность по сечениям':'<path d="M6 32Q17 11 25 21T43 12l-1 16Q24 38 9 43Z" fill="url(#asc-surface)" stroke="#608fae"/><path d="M9 32 14 41M24 23l2 14M42 13v16" stroke="#e7f8fe" stroke-width="2"/>',
 'Лоскут':P.patch+'<path d="M8 30Q21 23 42 25" stroke="#48a5ca" stroke-width="2" stroke-dasharray="3 2" fill="none"/>',
 'Сшить':'<path d="M5 38Q8 4 24 19l2 22Z" fill="#8fd1ed" stroke="#6795ad"/><path d="M26 41 24 19Q41 4 44 38Z" fill="#d6f0f8" stroke="#6795ad"/><path d="m24 19 2 22" stroke="#eb9e46" stroke-width="3" stroke-dasharray="3 2"/>',
 'Удлинить':P.sweep+'<path d="m36 8 8-4-2 9" fill="none" stroke="#4c9cce" stroke-width="3" stroke-linecap="round"/>',
 'Разделить':P.grey+P.cut,
 'Создать сетку':P.mesh+P.plus,
 'Преобразовать':P.mesh+P.arrowUp,
 'Разрезать':P.mesh+P.cut,
 'Упростить':P.mesh+'<path d="m9 37 26-23m-7 0h7v7" stroke="#47a8d2" fill="none" stroke-width="3"/>',
 'Исправить':P.mesh+'<path d="M30 37l6 5 10-15" stroke="#1d9c59" stroke-width="4.2" fill="none"/>',
 'Сгладить':P.patch+'<path d="M10 34q14-23 32-9" stroke="#e9faff" fill="none" stroke-width="3"/>',
 'Полка':P.blue+'<path d="M7 37h31" stroke="#eee" stroke-width="5"/>',
 'Отгиб':'<path d="M4 36h21V15l19 14v9H4Z" fill="#a9d8ef" stroke="#568ea9" stroke-width="2"/><path d="M25 15v23" stroke="#f0f9fe" stroke-width="3"/>',
 'Сгиб':'<path d="M5 38h22Q41 38 41 22V8H27v15H5Z" fill="#a8dff2" stroke="#6693ae"/><path d="M29 38q11-3 11-16" stroke="#3d9ac6" stroke-width="3" fill="none"/>',
 'Развернуть':'<path d="M9 36V11h13v25Z" fill="#b6e0f5" stroke="#6a90a5"/><path d="M23 36 43 21v17H23Z" fill="#66b6e0" stroke="#698a9c"/><path d="m23 15 17-9" stroke="#38a4cf" stroke-width="2" stroke-dasharray="3 2"/>',
 'Корпус':P.shell+'<path d="M13 37h25" stroke="#5a9fc7" stroke-width="2"/>',
 'Бобышка':P.grey+'<ellipse cx="26" cy="14" rx="9" ry="4" fill="#a9d3e8" stroke="#709cba"/><path d="M17 14v11a9 4 0 0 0 18 0V14" fill="#5faee0" stroke="#678dad"/><ellipse cx="26" cy="25" rx="9" ry="4" fill="#8cc4e2" stroke="#7298ab"/>',
 'Уклон':P.grey+'<path d="m23 10 16 5-12 23" fill="#89c8e7" stroke="#3c99cc" stroke-width="1.4"/><path d="M10 37 24 7" stroke="#4c9cc6" stroke-width="3" stroke-dasharray="4 2"/>',
 'Проверка геометрии':P.grey+'<path d="m12 27 10 9 21-22" fill="none" stroke="#1aa66b" stroke-width="4" stroke-linejoin="round"/>',
 'Сценарии':P.doc+'<path d="m15 17 5 5-5 5m10 0h10" fill="none" stroke="#399bca" stroke-width="2.5"/>',
 'Мои сценарии':P.doc+'<path d="m14 23 6 5-6 5M24 33h11" fill="none" stroke="#3194c2" stroke-width="2.8"/><circle cx="37" cy="12" r="4" fill="#9bd0eb"/>',
 'Настройки API':P.doc+'<path d="M24 27a7 7 0 1 0 0 .1M24 18v18M15 27h18" fill="none" stroke="#549dc4" stroke-width="2"/>',
 'Автоматизация':P.wrench+'<path d="m10 15 6 5-6 5m11 0h7" fill="none" stroke="#f3f8fd" stroke-width="2.2"/>'
};
const T=Object.freeze(A);
const required = [...new Set(Object.values(rCfg).flatMap(gs=>gs.flatMap(g=>g[2])))];
const missing=required.filter(name=>!Object.prototype.hasOwnProperty.call(T,name));
if(missing.length){throw new Error('Missing per-tool original SVG: '+missing.join(', '));}
const baseIcon=window.icon;
function svgForTool(tool,size){
  const body=T[tool];if(!body)return baseIcon(tool,size);
  const n=Math.max(16,Math.min(64,Number(size)||39));
  return '<svg class="cad-icon v4-art" data-art="'+tool.replaceAll('"','&quot;')+'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="'+n+'" height="'+n+'" role="img" aria-label="'+tool.replaceAll('"','&quot;')+'">'+ascDefs+body+'</svg>';
}
window.icon=svgForTool;
window.asaFusionIconAtlas={names:required,unique:new Set(required).size,version:4,has:name=>Object.hasOwn(T,name)};
})();