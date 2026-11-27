import {OrbitControls as BaseOrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {MOUSE,Vector3,Quaternion,type Camera} from 'three';
import {navigation,type NavMode,type Projection,type Pose,type Vec3} from './navigation';
import {FusionProjectionCamera} from './ProjectionCamera';
import {captureSnapshot} from './LiveCameraSnapshot';
import {fitDistance} from '../viewport/ViewportCameraController';
import type {CadRenderBounds} from '../../contracts/render';

/** Adapter around the existing viewport's controls, not a second scene or renderer. */
export class OrbitControls extends BaseOrbitControls {
 private release:(()=>void)|null=null;
 private ended=false;
 private requested:Projection='perspective';
 private currentMode:NavMode='select';
 private resizeObserver:ResizeObserver|null=null;
 private resizeFrame=0;
 private scheduleCameraRefresh=()=>{if(this.ended||this.resizeFrame)return;this.resizeFrame=requestAnimationFrame(this.refreshCameraFrame);};
 private refreshCameraFrame=()=>{this.resizeFrame=0;if(this.ended)return;navigation.changedCamera();this.syncCameraDebug();};
 private syncCameraDebug(){const host=this.domElement;if(!host)return;const s=navigation.cameraSnapshot();if(s)host.dataset.cameraSnapshot=JSON.stringify(s);else delete host.dataset.cameraSnapshot;}
 private announce=()=>{this.applyProjection();this.writeCameraDebug();navigation.changed();this.syncCameraDebug();};
 private writeCameraDebug(){
  if(this.object instanceof FusionProjectionCamera&&this.domElement){
   this.domElement.dataset.projection=this.object.projectionMode;
   this.domElement.dataset.cameraZoom=String(this.object.zoom);
   this.domElement.dataset.projectionMatrix=this.object.projectionMatrix.elements.join(',');
  }
 }
 private preventNavigationClick=(e:MouseEvent)=>{if(this.currentMode!=='select'){e.preventDefault();e.stopImmediatePropagation();}};
 constructor(camera:Camera,element:HTMLElement){
  super(camera,element);
  this.addEventListener('change',this.announce);
  element.addEventListener('click',this.preventNavigationClick,true);
  // Piggyback on the existing host/canvas resize: one coalesced capture after the applied aspect/projection, no OrbitControls.change.
  if(this.domElement){
   this.resizeObserver=new ResizeObserver(this.scheduleCameraRefresh);
   this.resizeObserver.observe(this.domElement);
   window.addEventListener('resize',this.scheduleCameraRefresh,{passive:true});
   window.addEventListener('scroll',this.scheduleCameraRefresh,{passive:true,capture:true});
  }
  // CadViewport assigns its baseline profile immediately after construction.
  queueMicrotask(()=>{
   if(this.ended)return;
   this.mouseButtons.RIGHT=null as unknown as MOUSE;
   this.mouseButtons.MIDDLE=MOUSE.PAN;
   this.release=navigation.attach({read:()=>this.readPose(),readCamera:()=>captureSnapshot(this.object as Camera,this.domElement,window.devicePixelRatio),orient:(v,u)=>this.orient(v,u),pose:p=>this.applyPose(p),fit:(v,u,b)=>this.fit(v,u,b),
    orbit:(x,y)=>this.orbitCube(x,y),roll:a=>this.rollCube(a),zoom:f=>this.zoomCamera(f),
    projection:p=>{this.requested=p;this.applyProjection();this.update();this.dispatchEvent({type:'change'});},mode:m=>this.setMode(m)});
   this.dispatchEvent({type:'change'});
  });
 }
 override update(deltaTime?:number){
  // The pinned OrbitControls caches this basis. Refresh after top/bottom/roll commands.
  const q=this as unknown as {_quat?:Quaternion;_quatInverse?:Quaternion};
  if(q._quat&&q._quatInverse){q._quat.setFromUnitVectors(this.object.up.clone().normalize(),new Vector3(0,1,0));q._quatInverse.copy(q._quat).invert();}
  const result=super.update(deltaTime);
  if(this.object instanceof FusionProjectionCamera){
   this.object.syncDistance(this.object.position.distanceTo(this.target));
   if(this.domElement){this.domElement.dataset.projection=this.object.projectionMode;this.domElement.dataset.cameraZoom=String(this.object.zoom);this.domElement.dataset.projectionMatrix=this.object.projectionMatrix.elements.join(',');}
  }
  return result;
 }
 private readPose():Pose{return {...(this.object instanceof FusionProjectionCamera?this.object.captureScale():{}),position:this.object.position.toArray() as [number,number,number],target:this.target.toArray() as [number,number,number],up:this.object.up.toArray() as [number,number,number]};}
 private orient(v:Vec3,up?:Vec3){
  const dir=new Vector3(...v).normalize(),distance=this.object.position.distanceTo(this.target);
  this.object.position.copy(this.target).addScaledVector(dir,Math.max(distance,this.minDistance));
  this.object.up.set(...(up||[0,0,1]));
  if(!up&&Math.abs(dir.z)>.999)this.object.up.set(0,dir.z>0?1:-1,0);
  this.applyProjection();this.update();this.dispatchEvent({type:'change'});
 }
 private applyPose(p:Pose){
  this.object.position.set(...p.position);this.target.set(...p.target);this.object.up.set(...p.up);
  if(this.object instanceof FusionProjectionCamera){if(p.actualProjection)this.object.setProjection(p.actualProjection,this.target);this.object.position.set(...p.position);this.object.restoreScale(p,this.object.position.distanceTo(this.target));}
  this.applyProjection();this.update();this.dispatchEvent({type:'change'});
 }
 private fit(direction:Vec3,up:Vec3,b:CadRenderBounds|null){
  const center=b?new Vector3((b.minX+b.maxX)/2,(b.minY+b.maxY)/2,(b.minZ+b.maxZ)/2):new Vector3();
  const diagonal=b?Math.max(10,Math.hypot(b.maxX-b.minX,b.maxY-b.minY,b.maxZ-b.minZ)):150;
  const camera=this.object;
  const distance=fitDistance({position:camera.position.toArray() as [number,number,number],target:this.target.toArray() as [number,number,number],up,fovDegrees:camera instanceof FusionProjectionCamera?camera.fov:34,aspect:camera instanceof FusionProjectionCamera?camera.aspect:1,minDistance:this.minDistance,maxDistance:this.maxDistance},diagonal);
  this.target.copy(center);camera.position.copy(center).addScaledVector(new Vector3(...direction).normalize(),distance);camera.up.set(...up);
  if(camera instanceof FusionProjectionCamera)camera.fitScale(distance);
  this.applyProjection();this.update();this.dispatchEvent({type:'change'});
 }
 private applyProjection(){
  if(!(this.object instanceof FusionProjectionCamera))return;
  const direction=this.object.position.clone().sub(this.target).normalize();
  const isFace=Math.max(Math.abs(direction.x),Math.abs(direction.y),Math.abs(direction.z))>.9999;
  this.object.setProjection(this.requested==='orthographic'||this.requested==='mixed'&&isFace?'orthographic':'perspective',this.target);
  this.object.updateProjectionMatrix();this.writeCameraDebug();
 }
 private orbitCube(dx:number,dy:number){
  const offset=this.object.position.clone().sub(this.target),up=this.object.up.clone().normalize();
  const right=new Vector3().crossVectors(up,offset).normalize();
  offset.applyAxisAngle(up,-dx*.009).applyAxisAngle(right,-dy*.009);
  this.object.up.applyAxisAngle(right,-dy*.009).normalize();
  this.object.position.copy(this.target).add(offset);
  this.applyProjection();this.update();this.dispatchEvent({type:'change'});
 }
 private rollCube(angle:number){
  const axis=this.target.clone().sub(this.object.position).normalize();
  this.object.up.applyAxisAngle(axis,angle).normalize();this.update();this.dispatchEvent({type:'change'});
 }
 private zoomCamera(factor:number){
  if(this.object instanceof FusionProjectionCamera&&this.object.projectionMode==='orthographic'){
   this.object.zoom=Math.max(.02,Math.min(100,this.object.zoom/factor));this.object.updateProjectionMatrix();
  }else{const offset=this.object.position.clone().sub(this.target);offset.setLength(Math.max(this.minDistance,Math.min(this.maxDistance,offset.length()*factor)));this.object.position.copy(this.target).add(offset);}
  this.update();this.dispatchEvent({type:'change'});
 }
 private setMode(mode:NavMode){this.currentMode=mode;this.mouseButtons.LEFT=(mode==='pan'?MOUSE.PAN:mode==='orbit'?MOUSE.ROTATE:mode==='zoom'?MOUSE.DOLLY:null) as unknown as MOUSE;}
 override dispose(){
  this.ended=true;
  if(this.resizeFrame){cancelAnimationFrame(this.resizeFrame);this.resizeFrame=0;}
  this.resizeObserver?.disconnect();this.resizeObserver=null;
  window.removeEventListener('resize',this.scheduleCameraRefresh);
  window.removeEventListener('scroll',this.scheduleCameraRefresh,true);
  this.release?.();
  this.removeEventListener('change',this.announce);
  if(this.domElement)delete this.domElement.dataset.cameraSnapshot;
  this.domElement?.removeEventListener('click',this.preventNavigationClick,true);
  super.dispose();
 }
}
