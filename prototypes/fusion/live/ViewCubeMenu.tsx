import React,{useState} from 'react';
import {navigation,type NavSnapshot,type Projection} from './navigation';
export type CubeSize='auto'|'tiny'|'small'|'normal'|'large';
export function ViewCubeMenu({view,size,onSize,onClose}:{view:NavSnapshot;size:CubeSize;onSize:(s:CubeSize)=>void;onClose:()=>void}){
 const [sub,setSub]=useState<string|null>(null);
 const item=(text:string,fn:()=>void,checked=false)=><button key={text} type="button" role="menuitem" onClick={()=>{fn();onClose();}}><span aria-hidden="true">{checked?'✓':''}</span><span>{text}</span></button>;
 const nested=(id:string,text:string,children:React.ReactNode)=><div className="cube-menu-branch" onPointerEnter={()=>setSub(id)}>
  <button type="button" role="menuitem" aria-label={text} aria-haspopup="menu" aria-expanded={sub===id} onClick={()=>setSub(id)} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();const parent=e.currentTarget.parentElement;setSub(id);requestAnimationFrame(()=>parent?.querySelector<HTMLButtonElement>('.cube-submenu button')?.focus());}}}><span/><span>{text}</span><b aria-hidden="true">›</b></button>
  {sub===id&&<div className="live-menu cube-submenu" role="menu" aria-label={text} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();setSub(null);e.currentTarget.parentElement?.querySelector('button')?.focus();}}}>{children}</div>}
 </div>;
 const keys=(e:React.KeyboardEvent)=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const menu=(e.target as Element).closest('[role=menu]');if(!menu)return;const buttons=[...menu.querySelectorAll<HTMLButtonElement>('button')].filter(b=>b.closest('[role=menu]')===menu&&!b.disabled);const i=buttons.indexOf(document.activeElement as HTMLButtonElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;e.preventDefault();e.stopPropagation();buttons[next]?.focus();};
 return <div className="live-menu cube-menu" role="menu" aria-label="Настройки куба ориентации" onKeyDown={keys}>
  {item('Главный вид',()=>navigation.home())}<hr/>
  {([['Ортографическая','orthographic'],['Перспектива','perspective'],['Перспектива с ортогональными гранями','mixed']] as Array<[string,Projection]>).map(([label,mode])=>item(label,()=>navigation.setProjection(mode),view.projection===mode))}<hr/>
  {nested('home','Текущий вид сделать главным',<>{item('Фиксированное расстояние',()=>navigation.saveHome('fixed'),view.homeMode==='fixed')}{item('Вписать в окно',()=>navigation.saveHome('fit'),view.homeMode==='fit')}</>)}
  {item('Сбросить главный вид',()=>navigation.resetHome())}<hr/>
  {nested('front','Назначить текущий вид',<>{item('Спереди',()=>navigation.setCurrentAs('front'))}{item('Сверху',()=>navigation.setCurrentAs('top'))}</>)}
  {item('Сбросить вид спереди',()=>navigation.resetFront())}<hr/>
  {nested('size','Размер куба',([['Автоматически','auto'],['Очень маленький куб','tiny'],['Маленький куб','small'],['Средний куб','normal'],['Большой куб','large']] as Array<[string,CubeSize]>).map(([name,s])=>item(name,()=>onSize(s),s===size)))}
 </div>;
}
