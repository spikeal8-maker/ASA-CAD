export type Vec3=readonly [number,number,number];
export type CubeFrame=readonly [Vec3,Vec3,Vec3];
export const DEFAULT_FRAME:CubeFrame=[[1,0,0],[0,1,0],[0,0,1]];
export const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const normalize=(a:Vec3):Vec3=>scale(a,1/(Math.hypot(...a)||1));
export const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const toWorld=(v:Vec3,f:CubeFrame):Vec3=>add(add(scale(f[0],v[0]),scale(f[1],v[1])),scale(f[2],v[2]));
export const toLocal=(v:Vec3,f:CubeFrame):Vec3=>[dot(v,f[0]),dot(v,f[1]),dot(v,f[2])];
/** Re-label the view frame only. CAD geometry and document axes are never changed. */
export function frameFromView(direction:Vec3,up:Vec3,as:'front'|'top'):CubeFrame{
 const n=normalize(direction),right=normalize(cross(up,n));
 if(Math.hypot(...right)<.5)throw Error('Невозможно назначить вид: вырожденная ориентация камеры');
 const screenUp=normalize(cross(n,right));
 return as==='front'?[right,scale(n,-1),screenUp]:[right,screenUp,n];
}
