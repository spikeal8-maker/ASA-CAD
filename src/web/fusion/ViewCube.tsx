import React,{useRef,useState,useSyncExternalStore,useEffect} from 'react';
import {navigation,type Vec3} from './navigation';
import {toWorld,toLocal} from './CubeFrame';
import {ViewCubeMenu,type CubeSize} from './ViewCubeMenu';
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=(a:Vec3):Vec3=>mul(a,1/(Math.hypot(...a)||1));
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const faces:Array<{id:string;label:string;n:Vec3;u:Vec3;v:Vec3;fill:string}>=[
 {id:'front',label:'Спереди',n:[0,-1,0],u:[1,0,0],v:[0,0,1],fill:'#e5e5e5'},
 {id:'back',label:'Сзади',n:[0,1,0],u:[-1,0,0],v:[0,0,1],fill:'#e5e5e5'},
 {id:'right',label:'Справа',n:[1,0,0],u:[0,1,0],v:[0,0,1],fill:'#d7d7d7'},
 {id:'left',label:'Слева',n:[-1,0,0],u:[0,-1,0],v:[0,0,1],fill:'#d7d7d7'},
 {id:'top',label:'Сверху',n:[0,0,1],u:[1,0,0],v:[0,1,0],fill:'#f7f7f7'},
 {id:'bottom',label:'Снизу',n:[0,0,-1],u:[1,0,0],v:[0,-1,0],fill:'#dedede'},
];
export const cubeDirections:Vec3[]=[];
for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)cubeDirections.push([x,y,z]);
export function ViewCube(){
 const view=useSyncExternalStore(navigation.subscribe,navigation.snapshot);
 const [menu,setMenu]=useState(false),[cubeSize,setCubeSize]=useState<CubeSize>('auto');
 const size={auto:138,tiny:88,small:112,normal:138,large:168}[cubeSize];
 const drag=useRef<{x:number;y:number;moved:boolean;direction:Vec3|null}|null>(null);
 const shell=useRef<HTMLDivElement>(null);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!shell.current?.contains(e.target as Node))setMenu(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[]);
 const n=norm(add(view.position,mul(view.target,-1))),r=norm(cross(view.up,n)),u=norm(cross(n,r));
 const project=(p:Vec3):[number,number]=>[70+dot(p,r)*32,76-dot(p,u)*32];
 const localN=toLocal(n,view.frame);
 const faceAligned=Math.max(...localN.map(Math.abs))>.9999;
 const adjacent=(side:'up'|'down'|'left'|'right')=>{const world=side==='up'?u:side==='down'?mul(u,-1):side==='left'?mul(r,-1):r;const v=toLocal(world,view.frame);const index=v.map(Math.abs).indexOf(Math.max(...v.map(Math.abs)));const d:[number,number,number]=[0,0,0];d[index]=Math.sign(v[index]);navigation.orientCube(d);};
 const pts=(ps:Vec3[])=>ps.map(p=>project(p).map(v=>v.toFixed(3)).join(',')).join(' ');
 const cuts=[-1,-.67,.67,1];

 return <div className="live-viewcube" ref={shell} style={{width:size}} data-testid="live-viewcube" data-camera-ready={view.ready} data-projection={view.projection} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setMenu(true);}}>
  <svg viewBox="0 0 140 150" aria-label="Куб ориентации" onPointerDown={e=>{if(e.button!==0)return;const tile=(e.target as Element).closest('[data-cube-direction]');drag.current={x:e.clientX,y:e.clientY,moved:false,direction:tile?tile.getAttribute('data-cube-direction')!.split(',').map(Number) as [number,number,number]:null};e.currentTarget.setPointerCapture(e.pointerId);setMenu(false);e.preventDefault();}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>2||d.moved){d.moved=true;navigation.orbit(dx,dy);d.x=e.clientX;d.y=e.clientY;}}}
   onPointerUp={e=>{const d=drag.current;drag.current=null;if(d&&!d.moved&&d.direction)navigation.orientCube(d.direction);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
   onPointerCancel={()=>{drag.current=null;}}>
   <ellipse cx="70" cy="126" rx="37" ry="7" fill="#777" opacity=".08"/>
   {faces.filter(f=>dot(toWorld(f.n,view.frame),n)>.00001).map(f=>{
    const vertex=(x:number,y:number)=>toWorld(add(f.n,add(mul(f.u,x),mul(f.v,y))),view.frame);
    const center=project(toWorld(f.n,view.frame)),fu=toWorld(f.u,view.frame),fv=toWorld(f.v,view.frame);const a=dot(fu,r),b=-dot(fu,u),c=-dot(fv,r),d=dot(fv,u);
    return <g key={f.id}><polygon points={pts([vertex(-1,-1),vertex(1,-1),vertex(1,1),vertex(-1,1)])} fill={f.fill} stroke="#999" strokeWidth=".65"/>
     {[0,1,2].flatMap(i=>[0,1,2].map(j=>{
      const direction=add(f.n,add(mul(f.u,i-1),mul(f.v,j-1)));
      const label=i===1&&j===1?f.label:'Вид '+direction.join(',');
      return <polygon key={i+'-'+j} role="button" tabIndex={0} aria-label={label} data-cube-face={i===1&&j===1?f.id:undefined} data-cube-direction={direction.join(',')} className="live-cube-tile" points={pts([vertex(cuts[i],cuts[j]),vertex(cuts[i+1],cuts[j]),vertex(cuts[i+1],cuts[j+1]),vertex(cuts[i],cuts[j+1])])} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigation.orientCube(direction);}}}><title>{label}</title></polygon>;
     }))}
     <text transform={`matrix(${a} ${b} ${c} ${d} ${center[0]} ${center[1]})`} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#83898d" pointerEvents="none">{f.label.toLocaleUpperCase('ru')}</text>
    </g>;
   })}
   {([['X',[1.62,0,0],'#e87f7f'],['Y',[0,1.62,0],'#66bf88'],['Z',[0,0,1.62],'#8580e0']] as const).map(([label,p,color])=>{const xy=project(p);return <text key={label} x={xy[0]} y={xy[1]} fill={color} textAnchor="middle" fontSize="12" pointerEvents="none">{label}</text>;})}
  </svg>
  <button className="cube-home" title="Главный вид" aria-label="Главный вид" onClick={()=>navigation.home()}>⌂</button>
  <div className="cube-roll"><button title="Повернуть вид против часовой стрелки" aria-label="Повернуть вид против часовой стрелки" onClick={()=>navigation.roll(Math.PI/2)}>↶</button><button title="Повернуть вид по часовой стрелке" aria-label="Повернуть вид по часовой стрелке" onClick={()=>navigation.roll(-Math.PI/2)}>↷</button></div>
  <button className="cube-menu-button" aria-label="Меню куба ориентации" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>⌄</button>
  {faceAligned&&<div className="cube-adjacent">{(['up','down','left','right'] as const).map((side,i)=><button key={side} type="button" className={'cube-adjacent-'+side} aria-label={['Соседний вид сверху','Соседний вид снизу','Соседний вид слева','Соседний вид справа'][i]} onClick={()=>adjacent(side)}>{['▴','▾','◂','▸'][i]}</button>)}</div>}
  {menu&&<ViewCubeMenu view={view} size={cubeSize} onSize={setCubeSize} onClose={()=>setMenu(false)}/>}

 </div>;
}
