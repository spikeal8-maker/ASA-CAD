// Ephemeral immutable capture of the actual Fusion driver camera. Copied values only: no renderer, no second state.
export type CameraProjectionKind='orthographic'|'perspective';
export interface CameraRect{left:number;top:number;width:number;height:number;}
export interface CameraCapture{
 actualProjection:CameraProjectionKind;
 viewMatrix:readonly number[];
 inverseViewMatrix:readonly number[];
 projectionMatrix:readonly number[];
 inverseProjectionMatrix:readonly number[];
 rect:CameraRect;
 devicePixelRatio:number;
}
export interface CameraSnapshot extends CameraCapture{revision:number;}
export interface SnapshotCamera{
 updateMatrixWorld?():void;
 matrixWorld:{elements:ArrayLike<number>};
 projectionMatrix:{elements:ArrayLike<number>};
 isPerspectiveCamera?:boolean;
 isOrthographicCamera?:boolean;
}
export interface SnapshotElement{getBoundingClientRect():CameraRect;}

function finite16(m:ArrayLike<number>|null|undefined):boolean{
 if(!m||m.length!==16)return false;
 for(let i=0;i<16;i++)if(!Number.isFinite(m[i]))return false;
 return true;
}
function toArray(v:ArrayLike<number>|null|undefined):number[]{
 if(!v||v.length!==16)return[];
 const out=new Array<number>(16);
 for(let i=0;i<16;i++){const x=v[i];out[i]=x===0?0:x;}
 return out;
}
// Cofactor determinant, same expansion as invert4: a Y90 rotation (det +1) must never read singular.
function det4(m:ReadonlyArray<number>):number{
 const a00=m[0],a01=m[1],a02=m[2],a03=m[3],a10=m[4],a11=m[5],a12=m[6],a13=m[7];
 const a20=m[8],a21=m[9],a22=m[10],a23=m[11],a30=m[12],a31=m[13],a32=m[14],a33=m[15];
 const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11;
 const b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30;
 const b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
 return b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
}
function invert4(m:ReadonlyArray<number>):number[]{
 const a00=m[0],a01=m[1],a02=m[2],a03=m[3],a10=m[4],a11=m[5],a12=m[6],a13=m[7];
 const a20=m[8],a21=m[9],a22=m[10],a23=m[11],a30=m[12],a31=m[13],a32=m[14],a33=m[15];
 const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11;
 const b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30;
 const b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
 const det=det4(m);
 if(!det)return[];
 const inv=1/det;
 const norm=(x:number)=>x===0?0:x;
 return[
 (a11*b11-a12*b10+a13*b09)*inv,(a02*b10-a01*b11-a03*b09)*inv,(a31*b05-a32*b04+a33*b03)*inv,(a22*b04-a21*b05-a23*b03)*inv,
 (a12*b08-a10*b11-a13*b07)*inv,(a00*b11-a02*b08+a03*b07)*inv,(a32*b02-a30*b05-a33*b01)*inv,(a20*b05-a22*b02+a23*b01)*inv,
 (a10*b10-a11*b08+a13*b06)*inv,(a01*b08-a00*b10-a03*b06)*inv,(a30*b04-a31*b02+a33*b00)*inv,(a21*b02-a20*b04-a23*b00)*inv,
 (a11*b07-a10*b09-a12*b06)*inv,(a00*b09-a01*b07+a02*b06)*inv,(a31*b01-a30*b03-a32*b00)*inv,(a20*b03-a21*b01+a22*b00)*inv,
].map(norm);
}
// Capture the actual camera after matrixWorld update. Invalid input is unavailable, never a fallback.
export function captureSnapshot(camera:SnapshotCamera|null,element:SnapshotElement|null,devicePixelRatio:number):CameraCapture|null{
 if(!camera||!element)return null;
 if(camera.isOrthographicCamera===camera.isPerspectiveCamera)return null;
 const kind=camera.isOrthographicCamera?'orthographic':'perspective';
 if(!Number.isFinite(devicePixelRatio)||devicePixelRatio<=0)return null;
 camera.updateMatrixWorld?.();
 const world=toArray(camera.matrixWorld?.elements);
 const projection=toArray(camera.projectionMatrix?.elements);
 if(!finite16(world)||!finite16(projection)||det4(world)===0||det4(projection)===0)return null;
 const viewMatrix=invert4(world);
 const inverseViewMatrix=invert4(viewMatrix);
 const inverseProjectionMatrix=invert4(projection);
 if(!finite16(viewMatrix)||!finite16(inverseViewMatrix)||!finite16(inverseProjectionMatrix))return null;
 const rect=element.getBoundingClientRect();
 if(!rect||!Number.isFinite(rect.left)||!Number.isFinite(rect.top)||!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)return null;
 return{
 actualProjection:kind,
 viewMatrix,
 inverseViewMatrix,
 projectionMatrix:projection.slice(),
 inverseProjectionMatrix,
 rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},
 devicePixelRatio,
};
}
const same=(a:readonly number[],b:readonly number[]):boolean=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export function cameraCaptureEqual(a:CameraCapture,b:CameraCapture):boolean{
 return a.actualProjection===b.actualProjection
 &&a.devicePixelRatio===b.devicePixelRatio
 &&same(a.viewMatrix,b.viewMatrix)
 &&same(a.inverseViewMatrix,b.inverseViewMatrix)
 &&same(a.projectionMatrix,b.projectionMatrix)
 &&same(a.inverseProjectionMatrix,b.inverseProjectionMatrix)
 &&a.rect.left===b.rect.left&&a.rect.top===b.rect.top&&a.rect.width===b.rect.width&&a.rect.height===b.rect.height;
}
export function isCameraSnapshot(value:unknown):value is CameraSnapshot{
 if(typeof value!=='object'||value===null)return false;
 const s=value as CameraSnapshot;
 if(typeof s.revision!=='number'||!Number.isFinite(s.revision))return false;
 if(s.actualProjection!=='orthographic'&&s.actualProjection!=='perspective')return false;
 if(!s.rect||!Number.isFinite(s.rect.left)||!Number.isFinite(s.rect.top)||s.rect.width<=0||s.rect.height<=0)return false;
 if(!Number.isFinite(s.devicePixelRatio)||s.devicePixelRatio<=0)return false;
 return finite16(s.viewMatrix)&&finite16(s.inverseViewMatrix)&&finite16(s.projectionMatrix)&&finite16(s.inverseProjectionMatrix);
}
