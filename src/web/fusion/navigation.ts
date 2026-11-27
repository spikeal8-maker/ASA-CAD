import type {CadRenderBounds} from '../../contracts/render';
import {DEFAULT_FRAME,toWorld,frameFromView,add,scale,type CubeFrame,type Vec3} from './CubeFrame';
import {cameraCaptureEqual,type CameraCapture,type CameraSnapshot} from './LiveCameraSnapshot';
export type {Vec3} from './CubeFrame';
export type Projection='perspective'|'orthographic'|'mixed';
export type NavMode='select'|'pan'|'orbit'|'zoom';
export interface Pose {position:Vec3;target:Vec3;up:Vec3;zoom?:number;viewHeight?:number;actualProjection?:'perspective'|'orthographic';}
export interface NavSnapshot extends Pose {ready:boolean;projection:Projection;mode:NavMode;frame:CubeFrame;homeMode:'fixed'|'fit';}
export interface NavigationDriver {
 read():Pose;orient(direction:Vec3,up?:Vec3):void;pose(pose:Pose):void;orbit(dx:number,dy:number):void;
 roll(angle:number):void;zoom(factor:number):void;projection(mode:Projection):void;mode(mode:NavMode):void;
 fit(direction:Vec3,up:Vec3,bounds:CadRenderBounds|null):void;
 readCamera?():CameraCapture|null;
}
let driver:NavigationDriver|null=null;
let savedHome:{pose:Pose;projection:Projection}|null=null;
let bounds:CadRenderBounds|null=null;
let firstScene=true;
let snapshot:NavSnapshot={position:[1,-1,1],target:[0,0,0],up:[0,0,1],ready:false,projection:'orthographic',mode:'select',frame:DEFAULT_FRAME,homeMode:'fit'};
const listeners=new Set<()=>void>();
let cameraSeq=0;
let cameraCurrent:CameraSnapshot|null=null;
let cameraGeneration:NavigationDriver|null=null;
const cameraListeners=new Set<()=>void>();
function notifyCamera(){cameraListeners.forEach(fn=>fn());}
// Publish only on explicit changedCamera (after final projection update) or attach/detach.
// A new driver is a new generation: always refresh, even with numerically equal matrices.
// The same driver with an equal capture is a no-op; a stale release never clears the newer attach.
function publishCamera(){
 const gen=driver;
 if(gen!==cameraGeneration){
  const next=gen&&gen.readCamera?gen.readCamera():null;
  cameraSeq+=1;
  cameraCurrent=next?{...next,revision:cameraSeq}:null;
  cameraGeneration=gen;
  notifyCamera();
  return;
 }
 if(!gen||!gen.readCamera)return;
 const next=gen.readCamera();
 if(next===null?cameraCurrent!==null:cameraCurrent===null||!cameraCaptureEqual(next,cameraCurrent)){
  cameraSeq+=1;
  cameraCurrent=next?{...next,revision:cameraSeq}:null;
  notifyCamera();
 }
}
function publish(){snapshot={...snapshot,...driver?.read(),ready:!!driver};listeners.forEach(fn=>fn());}
function orientCube(v:Vec3){
 const up:Vec3=Math.abs(v[2])===1&&v[0]===0&&v[1]===0?[0,v[2]>0?1:-1,0]:[0,0,1];
 driver?.orient(toWorld(v,snapshot.frame),toWorld(up,snapshot.frame));publish();
}
export const navigation={
 subscribe(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};},
 snapshot:()=>snapshot,
 cameraSnapshot:()=>cameraCurrent,
 subscribeCamera(fn:()=>void){cameraListeners.add(fn);return ()=>{cameraListeners.delete(fn);};},
 changedCamera:()=>{publishCamera();},
 attach(next:NavigationDriver){const previous=snapshot;driver=next;next.projection(previous.projection);next.mode(previous.mode);if(firstScene){firstScene=false;orientCube([1,-1,1]);}else{next.orient(add(previous.position,scale(previous.target,-1)),previous.up);}publish();publishCamera();return ()=>{if(driver===next){driver=null;if(cameraGeneration===next){cameraSeq+=1;cameraCurrent=null;cameraGeneration=null;notifyCamera();}publish();}};},
 changed:publish,
 setBounds(value:CadRenderBounds|null){bounds=value;},
 orient(v:Vec3){if(v.length!==3||!v.every(Number.isFinite)||v.every(n=>n===0))return;driver?.orient(v);publish();},
 orientCube,
 orbit(dx:number,dy:number){driver?.orbit(dx,dy);publish();},
 roll(angle:number){driver?.roll(angle);publish();},
 zoom(factor:number){if(Number.isFinite(factor)&&factor>0){driver?.zoom(factor);publish();}},
 setProjection(projection:Projection){snapshot={...snapshot,projection};driver?.projection(projection);publish();},
 setMode(mode:NavMode){snapshot={...snapshot,mode};driver?.mode(mode);publish();},
 home(){
  if(!driver)return;
  if(savedHome){snapshot={...snapshot,projection:savedHome.projection};driver.projection(savedHome.projection);if(snapshot.homeMode==='fixed')driver.pose(savedHome.pose);else driver.fit(add(savedHome.pose.position,scale(savedHome.pose.target,-1)),savedHome.pose.up,bounds);}
  else driver.fit(toWorld([1,-1,1],snapshot.frame),snapshot.frame[2],bounds);
  publish();
 },
 saveHome(mode:'fixed'|'fit'='fixed'){if(driver){savedHome={pose:driver.read(),projection:snapshot.projection};snapshot={...snapshot,homeMode:mode};publish();}},
 resetHome(){savedHome=null;snapshot={...snapshot,homeMode:'fit'};publish();},
 setCurrentAs(as:'front'|'top'){if(driver){const p=driver.read();snapshot={...snapshot,frame:frameFromView(add(p.position,scale(p.target,-1)),p.up,as)};publish();}},
 resetFront(){snapshot={...snapshot,frame:DEFAULT_FRAME};publish();},
};
