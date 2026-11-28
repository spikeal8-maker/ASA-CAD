/* Standalone F1 verification mode. Open fusion-v4.html?icons=1 to inspect every command. */
(function(){
"use strict";
const source=window.asaFusionIconAtlas;
const button=document.createElement('button');
button.type='button';button.className='fusion-audit-close';button.textContent='Закрыть ×';button.setAttribute('aria-label','Закрыть проверку значков');
const layer=document.createElement('section');
layer.className='fusion-audit';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');
layer.setAttribute('aria-label','Проверка значков инструментов');
layer.innerHTML='<header class="fusion-audit-head"><div><h1>Значки инструментов · Fusion UI</h1><p>51 индивидуальный SVG · визуальное соответствие эталону требует проверки</p></div></header><div class="fusion-audit-grid"></div><footer>Проверка визуального интерфейса, не проверка геометрических CAD-команд.</footer>';
layer.querySelector('.fusion-audit-head').append(button);
const grid=layer.querySelector('.fusion-audit-grid');
grid.innerHTML=source.names.map((name,index)=>
'<article class="fusion-audit-item" data-artwork="'+name.replaceAll('"','&quot;')+'"><div class="fusion-audit-index">'+String(index+1).padStart(2,'0')+'</div><div class="fusion-audit-icon">'+icon(name,54)+'</div><div class="fusion-audit-label">'+name.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</div><div class="fusion-audit-state">СВЕРИТЬ С ЭТАЛОНОМ</div></article>'
).join('');
function hide(){layer.remove();document.body.classList.remove('fusion-audit-open');}
function show(){document.body.append(layer);document.body.classList.add('fusion-audit-open');button.focus();}
button.addEventListener('click',hide);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&layer.isConnected)hide();});
window.asaCadFusionV4.showIconAudit=show;
window.asaCadFusionV4.hideIconAudit=hide;
if(new URL(location.href).searchParams.has('icons'))show();
})();