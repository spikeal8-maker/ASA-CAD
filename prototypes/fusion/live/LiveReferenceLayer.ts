import {createViewportReferenceLayer as original} from '../../../src/web/viewport/ViewportReferenceLayer.ts';
import type {ViewportReferenceScene} from '../../../src/web/viewport/PartReferenceGeometry';
import type {ViewportSelectionSnapshot} from '../../../src/web/viewport/ViewportSelectionController';
/** Keep original plane hit-testing and selection. Only origin presentation changes. */
export function createViewportReferenceLayer(THREE:typeof import('three'),reference:ViewportReferenceScene){
 const layer=original(THREE,reference);
 const span=Math.max(500,...Object.values(reference.bounds).map(Math.abs).map(n=>n*6));
 const grid=new THREE.GridHelper(span,100,0xd0d3d6,0xe4e6e8);grid.rotation.x=Math.PI/2;grid.position.z=-.01;
 const materials=Array.isArray(grid.material)?grid.material:[grid.material];
 for(const m of materials){m.transparent=true;m.opacity=.65;m.depthWrite=false;}
 const outlines=layer.group.children.filter(c=>c instanceof THREE.LineLoop&&c.userData.cadPlaneId);
 outlines.forEach(c=>{c.visible=false;});
 layer.group.add(grid);
 const refresh=(snapshot:Readonly<ViewportSelectionSnapshot>)=>{
  layer.refresh(snapshot);
  const hover=snapshot.hoverCandidate?.kind==='base-plane'?snapshot.hoverCandidate.planeId:null;
  const selected=snapshot.selectedCommandCandidate?.kind==='base-plane'?snapshot.selectedCommandCandidate.planeId:snapshot.selectedPlaneId;
  for(const outline of outlines)outline.visible=outline.userData.cadPlaneId===hover||outline.userData.cadPlaneId===selected;
 };
 const dispose=()=>{grid.geometry.dispose();materials.forEach(m=>m.dispose());layer.dispose();};
 return {...layer,refresh,dispose};
}
