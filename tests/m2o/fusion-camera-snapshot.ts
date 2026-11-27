import assert from 'node:assert/strict';
import {captureSnapshot,cameraCaptureEqual,isCameraSnapshot,projectionRectConsistent} from '../../src/web/fusion/LiveCameraSnapshot';
import type {SnapshotCamera,SnapshotElement} from '../../src/web/fusion/LiveCameraSnapshot';
import {navigation} from '../../src/web/fusion/navigation';
import type {NavigationDriver,Pose} from '../../src/web/fusion/navigation';

const ORTHO=[0.5,0,0,0,0,0.8,0,0,0,0,-2,0,0,0,-1,1];
const WORLD=[1,0,0,0,0,1,0,0,0,0,1,0,5,7,9,1];
const VIEW=[1,0,0,0,0,1,0,0,0,0,1,0,-5,-7,-9,1];

function camera(projection=ORTHO,world=WORLD,orthographic=true):SnapshotCamera{
 return {updateMatrixWorld(){},matrixWorld:{elements:[...world]},projectionMatrix:{elements:[...projection]},isOrthographicCamera:orthographic,isPerspectiveCamera:!orthographic};
}
function mutableElement(r:{left:number;top:number;width:number;height:number}):SnapshotElement{
 return {getBoundingClientRect:()=>r};
}
function mul(a:number[],b:number[]):number[]{
 const r=new Array<number>(16).fill(0);
 for(let c=0;c<4;c++)for(let rw=0;rw<4;rw++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+rw]*b[c*4+k];r[c*4+rw]=s;}
 return r;
}
function nearIdentity(m:number[],label:string){
 for(let i=0;i<16;i++){const expected=Math.floor(i/4)===i%4?1:0;assert.ok(Math.abs(m[i]-expected)<1e-12,`${label}[${i}]=${m[i]}`);}
}

// 1. Actual copied matrix values, exact; inverses consistent; not inferred from shape.
const cam=camera(),el=mutableElement({left:10,top:20,width:320,height:200});
const cap=captureSnapshot(cam,el,2);
assert.ok(cap,'valid camera/rect must capture');
assert.equal(cap.actualProjection,'orthographic');
assert.deepEqual(cap.viewMatrix,VIEW);
assert.deepEqual(cap.inverseViewMatrix,WORLD);
assert.deepEqual(cap.projectionMatrix,ORTHO);
assert.deepEqual(cap.rect,{left:10,top:20,width:320,height:200});
assert.equal(cap.devicePixelRatio,2);
nearIdentity(mul(cap.viewMatrix,cap.inverseViewMatrix),'view*invView');
nearIdentity(mul(cap.projectionMatrix,cap.inverseProjectionMatrix),'proj*invProj');
assert.ok(isCameraSnapshot({revision:7,...cap}));
assert.ok(!isCameraSnapshot({revision:7,viewMatrix:cap.viewMatrix}));

// 1b. Contract matrix: Y90 rotation, det +1, must be ready with exact inverse (the transpose).
const Y90=[0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1];
const yCap=captureSnapshot(camera(ORTHO,Y90),el,1);
assert.ok(yCap,'Y90 rotation must be ready, det +1, never singular');
assert.deepEqual(yCap!.viewMatrix,[0,0,1,0,0,1,0,0,-1,0,0,0,0,0,0,1]);
assert.deepEqual(yCap!.inverseViewMatrix,Y90);

// 1c. Gate: actual projection P[5]/P[0] must match the current CSS rect aspect (1e-7), otherwise unavailable.
assert.ok(projectionRectConsistent(ORTHO,{width:320,height:200}),'consistent aspect is ready');
assert.ok(!projectionRectConsistent(ORTHO,{width:320,height:201}),'aspect off by 1px is not ready');
assert.ok(!projectionRectConsistent([0.5,0,0,0,0,0.5,0,0,0,0,-2,0,0,0,-1,1],{width:320,height:200}),'stale matrix/new rect is not ready');
assert.ok(!projectionRectConsistent(ORTHO,{width:0,height:200}),'zero rect is not ready');
assert.ok(!projectionRectConsistent(ORTHO,null),'missing rect is not ready');
assert.equal(captureSnapshot(camera([0.5,0,0,0,0,0.5,0,0,0,0,-2,0,0,0,-1,1]),el,1),null,'mismatched projection/rect capture is unavailable, not old ready');

// 2. Old capture stays immutable after changing the source camera/element.
const mCam=camera(),mEl=mutableElement({left:1,top:2,width:160,height:100});
const c1=captureSnapshot(mCam,mEl,1.5);
assert.ok(c1);
mCam.matrixWorld.elements[12]=999;
mCam.projectionMatrix.elements[0]=9;
mEl.getBoundingClientRect().width=250;
assert.deepEqual(c1.viewMatrix,VIEW);
assert.deepEqual(c1.projectionMatrix,ORTHO);
assert.deepEqual(c1.rect,{left:1,top:2,width:160,height:100});
assert.equal(c1.devicePixelRatio,1.5);

// 3. actualProjection is the actual camera flag; mixed/absent flags are unavailable.
const persp=captureSnapshot(camera(ORTHO,WORLD,false),el,1);
assert.ok(persp&&persp.actualProjection==='perspective','perspective flag wins over ortho-shaped matrix');
const both={...camera(),isOrthographicCamera:true,isPerspectiveCamera:true};
const neither={...camera(),isOrthographicCamera:false,isPerspectiveCamera:false};
assert.equal(captureSnapshot(both,el,1),null,'both flags unavailable');
assert.equal(captureSnapshot(neither,el,1),null,'no flag unavailable');

// 4. Invalid input is unavailable, never identity/zero fallback.
const singular=[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1];
assert.equal(captureSnapshot(camera(ORTHO,singular),el,1),null,'singular world');
assert.equal(captureSnapshot(camera(singular,WORLD),el,1),null,'singular projection');
assert.equal(captureSnapshot(cam,mutableElement({left:0,top:0,width:0,height:200}),1),null,'zero width');
assert.equal(captureSnapshot(cam,mutableElement({left:0,top:0,width:300,height:0}),1),null,'zero height');
assert.equal(captureSnapshot(camera([NaN,0,0,0,0,0.5,0,0,0,0,-2,0,0,0,-1,1],WORLD),el,1),null,'NaN matrix');
assert.equal(captureSnapshot(cam,el,0),null,'zero DPR');
assert.equal(captureSnapshot(cam,el,NaN),null,'NaN DPR');
assert.equal(captureSnapshot(null,el,1),null,'no camera');
assert.equal(captureSnapshot(cam,null,1),null,'no element');

// 5. Equality drives the no-op publish guard.
const again=captureSnapshot(cam,el,2);
assert.ok(again&&cameraCaptureEqual(again,cap));
const other=captureSnapshot(camera(ORTHO,[1,0,0,0,0,1,0,0,0,0,1,0,5,7,9,2],false),el,2);
assert.ok(other&&again&&!cameraCaptureEqual(other,again));

// 6. navigation: single published snapshot, monotonic revision, no-op, detach, stale release, reattach.
const navCam=camera(),navEl=mutableElement({left:1,top:2,width:160,height:100});
const pose:Pose={position:[1,2,3],target:[4,5,6],up:[0,0,1]};
const makeDriver=():NavigationDriver=>({read:()=>pose,orient(){},pose(){},orbit(){},roll(){},zoom(){},projection(){},mode(){},fit(){},readCamera:()=>captureSnapshot(navCam,navEl,2)});
const driverA=makeDriver(),driverB=makeDriver();
const releaseA=navigation.attach(driverA);
const s1=navigation.cameraSnapshot();
assert.ok(s1&&isCameraSnapshot(s1),'attach publishes actual snapshot');
assert.ok(s1!.revision>=1,'revision positive');
let ticks=0;
const unsubscribe=navigation.subscribeCamera(()=>{ticks+=1;});
navigation.changedCamera();
assert.equal(ticks,0,'no-op capture publishes nothing');
assert.equal(navigation.cameraSnapshot()!.revision,s1!.revision,'no-op does not bump revision');
navEl.getBoundingClientRect().width=320;
navEl.getBoundingClientRect().height=200;
navCam.projectionMatrix.elements[0]=0.25;
navCam.projectionMatrix.elements[5]=0.4;
navigation.changedCamera();
const s2=navigation.cameraSnapshot()!;
assert.equal(ticks,1,'resize publishes once');
assert.ok(s2.revision>s1!.revision,'change bumps revision');
assert.equal(s2.rect.width,320,'resize rect applied');
assert.equal(s2.projectionMatrix[0],0.25,'resize projection applied');
navigation.orbit(10,5);
assert.equal(navigation.cameraSnapshot()!.revision,s2.revision,'pose-only publish does not bump camera revision');
assert.equal(ticks,1,'pose-only publish does not publish camera');
releaseA();
assert.equal(navigation.cameraSnapshot(),null,'detach invalidates snapshot');
assert.equal(ticks,2,'detach publishes invalidation');
const releaseB=navigation.attach(driverB);
const s3=navigation.cameraSnapshot()!;
assert.ok(s3.revision>s2.revision,'new attach revision monotonic, never reset');
assert.equal(s3.rect.width,320,'new attach reads actual values');
const releaseA2=navigation.attach(driverA);
const s4=navigation.cameraSnapshot()!;
assert.ok(s4.revision>s3.revision,'new attach bumps revision even with equal matrices');
releaseB();
assert.equal(navigation.cameraSnapshot()!.revision,s4.revision,'stale release keeps new snapshot');
releaseA2();
assert.equal(navigation.cameraSnapshot(),null,'final detach invalidates');
unsubscribe();

console.log('FUS/A03 camera snapshot PASS (actual matrices/inverses, rect/DPR, immutable capture, revision lifecycle)');
