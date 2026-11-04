/* ASA-CAD Fusion visual controls v4. One UI reference only; it does not modify CadDocument. */
(function(){
"use strict";
const root=document.getElementById('app');
const popup=document.getElementById('popup');
const groups=document.getElementById('groups');
const fly=document.createElement('aside');
fly.id='fusionFlyout';fly.className='fusion-flyout';fly.setAttribute('aria-live','polite');
document.body.append(fly);
const tip=document.createElement('div');tip.id='fusionTip';tip.className='fusion-tip';tip.setAttribute('role','tooltip');
document.body.append(tip);
const descriptions={
 'Создать эскиз':'Создаёт эскиз на выбранной плоскости или плоской грани.',
 'Выдавливание':'Добавляет или удаляет материал вытягиванием выбранного профиля.',
 'Вращение':'Строит тело вращением профиля вокруг оси.',
 'Отверстие':'Создаёт отверстие с настраиваемой геометрией.',
 'Прямоугольный массив':'Копирует элементы в одном или двух направлениях.',
 'Форма':'Рабочее пространство свободного формирования объёмов.',
 'Нажать/Вытянуть':'Изменяет выбранную грань или профиль перетаскиванием.',
 'Скругление':'Скругляет выбранные рёбра детали.',
 'Оболочка':'Создаёт тонкостенную оболочку выбранного тела.',
 'Объединить':'Объединяет, вычитает или пересекает тела.',
 'Фаска':'Создаёт фаску на выбранных рёбрах.',
 'Переместить':'Перемещает или поворачивает выбранные объекты.',
 'Смещённая плоскость':'Создаёт вспомогательную плоскость с отступом.',
 'Измерить':'Измеряет расстояние, угол или размеры геометрии.',
 'Анализ сечения':'Отображает разрез модели выбранной плоскостью.',
 'Холст':'Размещает изображение в качестве подложки.',
 'Наклейка':'Проецирует изображение на поверхность модели.',
 'Соединение':'Определяет взаимное положение компонентов сборки.',
 'Выбрать':'Выбирает объекты и области модели.',
 'Параметры':'Управляет именованными переменными и выражениями.'
};
const escapeHtml=(s)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const disabledGroups=new Set(['\u041d\u0410\u0421\u0422\u0420\u041e\u0419\u041a\u0410']);
const existingRibbon=window.renderRibbon;
window.renderRibbon=function(){
  const tabs=document.getElementById('tabs');
  tabs.innerHTML=Object.keys(rCfg).map(t=>'<button type="button" class="tab '+(t===activeTab?'active':'')+'" data-tab="'+escapeHtml(t)+'" aria-selected="'+String(t===activeTab)+'">'+escapeHtml(t)+'</button>').join('');
  const disabledNames=[];
  groups.innerHTML=rCfg[activeTab].map(([name,oldIcons,names,disabled])=>{
    const inoperative=Boolean(disabled) && disabledGroups.has(name);
    if(inoperative) disabledNames.push(...names);
    return '<section class="rgroup '+(inoperative?'v4-disabled':'')+' '+(names.length<3?'compact':'')+'" aria-label="'+escapeHtml(name)+'" data-group="'+escapeHtml(name)+'">'
    +'<div class="toolrow">'+names.map((label,i)=>{
      const off=inoperative;
      return '<button type="button" class="toolbtn v4-command'+(off?' v4-unavailable':'')+'" data-tool="'+escapeHtml(label)+'" data-icon="'+escapeHtml(label)+'" data-command-index="'+i+'" title="'+escapeHtml(label)+(off?' — недоступно':'')+'" aria-label="'+escapeHtml(label)+'"'+(off?' disabled aria-disabled="true"':'')+'>'+icon(label,39)+'</button>';
    }).join('')+'</div><button type="button" class="groupLabel v4-group-trigger" data-menu="'+escapeHtml(name)+'" aria-haspopup="menu" aria-expanded="false">'+escapeHtml(name)+'<span class="arr" aria-hidden="true">⌄</span></button></section>';
  }).join('');
  root.dataset.fusionIconCoverage=String(document.querySelectorAll('.v4-command').length);
};
const oldHide=window.hideMenu;
window.hideMenu=function(){
  oldHide();
  popup.classList.remove('v4-popup');
  fly.classList.remove('show');
  for(const b of document.querySelectorAll('.v4-group-trigger[aria-expanded]'))b.setAttribute('aria-expanded','false');
};
function showPreview(item,anchor){
  if(!item || !item.name || !window.asaFusionIconAtlas.has(item.name)){fly.classList.remove('show');return;}
  fly.innerHTML='<div class="fusion-flyout-head">'+icon(item.name,67)+'<strong>'+escapeHtml(item.name)+'</strong></div><p>'+escapeHtml(descriptions[item.name]||'Инструмент '+item.name+'. В этой версии доступно визуальное представление команды.')+'</p><div class="fusion-flyout-hint">ASA CAD · визуальный прототип</div>';
  const menur=popup.getBoundingClientRect();
  const w=260,h=fly.offsetHeight||180;
  const availableRight=innerWidth-menur.right;
  const left=availableRight>=w+8 ? menur.right+5 : Math.max(5,menur.left-w-5);
  fly.style.left=left+'px';
  fly.style.top=Math.min(Math.max(5,anchor.getBoundingClientRect().top-12),innerHeight-188)+'px';
  fly.classList.add('show');
}
window.showMenu=function(anchor,title,items){
  hideMenu();
  const safeTitle=escapeHtml(title);
  popup.innerHTML='<header class="v4-popup-header"><span>'+safeTitle+'</span><span class="popup-esc">ESC</span></header>'
  +items.map((item,i)=>{
    if(item.sep)return '<div class="popSep" role="separator"></div>';
    return '<button class="popitem v4-popitem" type="button" role="menuitem" tabindex="'+(i===0?'0':'-1')+'" data-menu-item="'+i+'">'+icon(item.icon||item.name,29)+'<span class="v4-menu-name">'+escapeHtml(item.name)+'</span><span class="shortcut">'+escapeHtml(item.shortcut||'')+'</span></button>';
  }).join('')
  +'<div class="v4-popup-footer">Наведите на инструмент для описания</div>';
  popup.dataset.menuItems=JSON.stringify(items);
  popup.setAttribute('role','menu');popup.setAttribute('aria-label',title);
  popup.classList.add('show','v4-popup');
  const rect=anchor.getBoundingClientRect();
  const popupWidth=Math.min(410,Math.max(264,popup.offsetWidth));
  popup.style.left=Math.min(Math.max(5,rect.left),innerWidth-popupWidth-8)+'px';
  popup.style.top=Math.min(rect.bottom+3,Math.max(5,innerHeight-popup.offsetHeight-8))+'px';
  popupSource=anchor;
  if(anchor.matches('.v4-group-trigger'))anchor.setAttribute('aria-expanded','true');
};
window.groupMenu=function(anchor,name){
  if(popup.classList.contains('show') && popupSource===anchor){hideMenu();return;}
  const group=rCfg[activeTab].find(g=>g[0]===name);if(!group)return;
  const inoperative=Boolean(group[3])&&disabledGroups.has(name);
  showMenu(anchor,name,group[2].map((label,i)=>({name:label,icon:label,disabled:inoperative})));
};
function showTip(el){
  if(popup.classList.contains('show'))return;
  const name=el.dataset.tool;if(!name)return;
  const r=el.getBoundingClientRect();
  tip.textContent=name+(el.disabled?' · недоступно':'');
  tip.style.left=Math.max(4,Math.min(r.left+2,innerWidth-tip.offsetWidth-7))+'px';
  tip.style.top=Math.min(innerHeight-40,r.bottom+7)+'px';
  tip.classList.add('show');
}
document.addEventListener('pointerover',e=>{
  const menuItem=e.target.closest('.v4-popitem');
  if(menuItem&&popup.classList.contains('show')){
    const items=JSON.parse(popup.dataset.menuItems||'[]');
    showPreview(items[+menuItem.dataset.menuItem],menuItem);
    return;
  }
  const tool=e.target.closest('.v4-command');if(tool)showTip(tool);
});
document.addEventListener('pointerout',e=>{
  if(e.target.closest('.v4-command'))tip.classList.remove('show');
  if(e.target.closest('.v4-popup')&& !e.relatedTarget?.closest?.('.v4-popup,.fusion-flyout'))fly.classList.remove('show');
});
document.addEventListener('focusin',e=>{
  if(e.target.matches('.v4-command'))showTip(e.target);
  if(e.target.matches('.v4-popitem')){
    const items=JSON.parse(popup.dataset.menuItems||'[]');
    showPreview(items[+e.target.dataset.menuItem],e.target);
  }
});
document.addEventListener('focusout',()=>tip.classList.remove('show'));
document.addEventListener('keydown',e=>{
  if(!popup.classList.contains('show'))return;
  const list=[...popup.querySelectorAll('.v4-popitem:not([disabled])')];if(!list.length)return;
  const cur=list.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();const next=list[(cur+(e.key==='ArrowDown'?1:-1)+list.length)%list.length];next.focus();
  }
  if(e.key==='Home'){e.preventDefault();list[0].focus();}
  if(e.key==='End'){e.preventDefault();list[list.length-1].focus();}
  if(e.key==='Escape'){fly.classList.remove('show');tip.classList.remove('show');}
});
const oldTool=window.selectedTool;
window.selectedTool=function(tool,key){
  if(disabledGroups.has('\u041d\u0410\u0421\u0422\u0420\u041e\u0419\u041a\u0410')&&rCfg[activeTab].some(g=>g[0]==='\u041d\u0410\u0421\u0422\u0420\u041e\u0419\u041a\u0410'&&g[3]&&g[2].includes(tool))){
    toast('Функция «'+tool+'» будет подключена к ядру');hideMenu();return;
  }
  tip.classList.remove('show');fly.classList.remove('show');
  oldTool(tool,window.asaFusionIconAtlas.has(tool)?tool:key);
};
renderRibbon();
window.asaCadFusionV4={iconCount:window.asaFusionIconAtlas.unique,referenceOnly:true,openGroup:(name)=>{
  const b=[...document.querySelectorAll('.v4-group-trigger')].find(x=>x.dataset.menu===name);
  if(b)b.click();
},getAppearance:()=>({tab:activeTab,visibleButtons:document.querySelectorAll('.v4-command').length,flyout:fly.classList.contains('show'),menu:popup.classList.contains('show')})};
})();