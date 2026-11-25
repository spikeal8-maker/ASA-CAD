import {PerspectiveCamera,Vector3} from 'three';
/** One camera object and one renderer; exact switchable projection matrices. */
export class FusionProjectionCamera extends PerspectiveCamera {
 projectionMode:'perspective'|'orthographic'='perspective';
 left=-1;right=1;top=1;bottom=-1;
 private halfHeight=100;
 private lastDistance:number|null=null;
 captureScale(){return {zoom:this.zoom,viewHeight:this.halfHeight,actualProjection:this.projectionMode};}
 restoreScale(value:{zoom?:number;viewHeight?:number},distance:number){
  if(value.viewHeight&&Number.isFinite(value.viewHeight)&&value.viewHeight>0)this.halfHeight=value.viewHeight;
  this.zoom=value.zoom&&Number.isFinite(value.zoom)&&value.zoom>0?value.zoom:1;
  this.lastDistance=distance;this.updateProjectionMatrix();
 }
 fitScale(distance:number){this.halfHeight=distance*Math.tan(this.fov*Math.PI/360);this.zoom=1;this.lastDistance=distance;this.updateProjectionMatrix();}
 syncDistance(distance:number){
  if(this.projectionMode==='orthographic'&&this.lastDistance&&Math.abs(distance-this.lastDistance)>1e-7){this.halfHeight*=distance/this.lastDistance;this.updateProjectionMatrix();}
  this.lastDistance=distance;
 }
 constructor(fov=34,aspect=1,near=.1,far=100000){
  super(fov,aspect,near,far);
  Object.defineProperties(this,{
   isPerspectiveCamera:{configurable:true,get:()=>this.projectionMode!=='orthographic'},
   isOrthographicCamera:{configurable:true,get:()=>this.projectionMode==='orthographic'},
  });
 }
 setProjection(mode:'perspective'|'orthographic',target:Vector3){
  if(mode===this.projectionMode)return;
  if(mode==='orthographic')this.halfHeight=this.position.distanceTo(target)*Math.tan(this.fov*Math.PI/360)/this.zoom;
  else {const offset=this.position.clone().sub(target).normalize();this.position.copy(target).addScaledVector(offset,this.halfHeight/this.zoom/Math.tan(this.fov*Math.PI/360));}
  this.lastDistance=this.position.distanceTo(target);this.projectionMode=mode;this.zoom=1;this.updateProjectionMatrix();
 }
 override updateProjectionMatrix(){
  if(this.projectionMode!=='orthographic'){super.updateProjectionMatrix();return;}
  this.top=this.halfHeight;this.bottom=-this.halfHeight;this.left=-this.halfHeight*this.aspect;this.right=-this.left;
  this.projectionMatrix.makeOrthographic(this.left/this.zoom,this.right/this.zoom,this.top/this.zoom,this.bottom/this.zoom,this.near,this.far,this.coordinateSystem);
  this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
 }
}
