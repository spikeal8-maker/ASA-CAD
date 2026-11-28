/* Construction panel transcribed from native screenshots and opened Type/Method lists.
 * Only the observed empty-document UI is implemented. No geometric operation is committed. */
(()=>{'use strict';
const f=(id,name,kind,value,options=[])=>({id,name,kind,value,options});
const pick=(id,name)=>f(id,name,'pick','');
const check=(id,name,value=true)=>f(id,name,'check',value);
const extent=()=>f('extent','Протяжённость','choice','Расстояние',['Расстояние','До объекта']);
const plane='Плоскость',axis='Ось',point='Точка';
const rows=[
 ['ConstructionPlaneOffsetFromPlaneCommand',plane,'Смещение',[pick('plane','Плоскость'),extent()]],
 ['ConstructionPlaneAtAngleCommand',plane,'Под углом',[pick('edge','Ребро')]],
 ['ConstructionTangentPlaneCommand',plane,'Касательная',[pick('face','Грань'),pick('reference','Опорная плоскость')]],
 ['ConstructionMidPlaneCommand',plane,'Средняя плоскость',[pick('plane1','Плоскость 1'),pick('plane2','Плоскость 2')]],
 ['ConstructionPlanePerpendicularToPlaneCommand',plane,'Перпендикулярная',[pick('face','Грань'),f('planeDirection','Направление плоскости','buttons','По U',['По U','По V']),extent()]],
 ['ConstructionPlaneFromTwoEdgesCommand',plane,'Через два ребра',[pick('edge1','Ребро 1'),pick('edge2','Ребро 2')]],
 ['ConstructionPlaneFromThreePointsCommand',plane,'Через три точки',[pick('point1','Точка 1'),pick('point2','Точка 2'),pick('point3','Точка 3')]],
 ['ConstructionPlaneAlongPathCommand',plane,'Вдоль траектории',[pick('path','Траектория'),check('chain','Цепочка')]],
 ['ConstructionAxisThroughCylinderCommand',axis,'Через цилиндр / конус / тор',[pick('face','Грань')]],
 ['ConstructionAxisNormalToFaceCommand',axis,'Перпендикулярно грани',[pick('face','Грань'),pick('point','Точка')]],
 ['ConstructionAxisFromTwoPlanesCommand',axis,'Через две плоскости',[pick('plane1','Плоскость 1'),pick('plane2','Плоскость 2')]],
 ['ConstructionAxisThroughTwoPointsCommand',axis,'Через две точки',[pick('point1','Точка 1'),pick('point2','Точка 2')]],
 ['ConstructionAxisThroughEdgeCommand',axis,'Через ребро',[pick('edge','Ребро')]],
 ['ConstructionPointFromPointCommand',point,'В вершине',[pick('point','Точка')]],
 ['ConstructionPointThroughTwoEdgesCommand',point,'Через два ребра',[pick('edge1','Ребро 1'),pick('edge2','Ребро 2')]],
 ['ConstructionPointFromThreePlanesCommand',point,'Через три плоскости',[pick('plane1','Плоскость 1'),pick('plane2','Плоскость 2'),pick('plane3','Плоскость 3')]],
 ['ConstructionPointFromCircleOrSphereCommand',point,'В центре окружности / сферы / тора',[pick('faceEdge','Грань / Ребро')]],
 ['ConstructionPointAtEdgeAndPlaneCommand',point,'На ребре и плоскости',[pick('edge','Ребро'),pick('plane','Плоскость')]],
 ['ConstructionPointAlongPathCommand',point,'Вдоль траектории',[pick('path','Траектория'),check('chain','Цепочка')]],
];
const schemas={CoordinateSystemCommand:{width:286,fields:[pick('snap','Привязка')],nativeObservation:'CoordinateSystemCommand-census-opened'}};
for(const [id,type,method,fields] of rows){schemas[id]={width:286,title:'Вспомогательная геометрия',family:'construction',nativeObservation:id+(id==='ConstructionPlaneOffsetFromPlaneCommand'?'-opened':'-census-opened'),fields:[f('geometryType','Тип','buttons',type,[plane,axis,point]),f('method','Метод','choice',method,rows.filter(r=>r[1]===type).map(r=>r[2])),...fields]};}
function transition(id,field,value){const row=rows.find(r=>r[0]===id);if(!row)return null;
 if(field==='geometryType')return rows.find(r=>r[1]===value)?.[0]||null;
 if(field==='method')return rows.find(r=>r[1]===row[1]&&r[2]===value)?.[0]||null;
 return null;
}
const pen='stroke="#84968d" stroke-width="1.1" stroke-linejoin="round"';
const planar='<path d="M4 8 13 3v21l-9 5Z" fill="#83c898" '+pen+'/><path d="m17 8 10-5v21l-10 5Z" fill="#ecb27d" '+pen+'/><path d="M10 6v20m12-20v20" stroke="#f1f5eb" stroke-width="1.5"/>';
const axial='<ellipse cx="17" cy="14" rx="8" ry="11" transform="rotate(42 17 14)" fill="#81cd98" '+pen+'/><ellipse cx="17" cy="14" rx="4" ry="7" transform="rotate(42 17 14)" fill="#f2f6ed" stroke="#5bac77"/><path d="M3 30 29 2" stroke="#e7a36a" stroke-width="2"/>';
const punctual='<path d="M16 2v28M2 16h28" stroke="#a99d86" stroke-width="1.1"/><path d="m16 7 9 9-9 9-9-9Z" fill="#db9a61" stroke="#ba855f"/><circle cx="16" cy="16" r="3.5" fill="#fff6df"/>';
function typeArt(type,size=22){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="'+size+'" height="'+size+'" aria-hidden="true">'+(type===plane?planar:type===axis?axial:punctual)+'</svg>';}
const extra={
 ConstructionPlaneAtAngleCommand:'<path d="m2 22 16-12 12 9-16 10Z" fill="#f7ddb8" stroke="#c58f65"/>',
 ConstructionTangentPlaneCommand:'<ellipse cx="10" cy="19" rx="7" ry="10" fill="#74c99d" stroke="#649a7f"/>',
 ConstructionMidPlaneCommand:'<path d="M14 1v29" stroke="#ea9a59" stroke-width="2.5"/>',
 ConstructionPlanePerpendicularToPlaneCommand:'<path d="m2 23 27-10M13 13v14" fill="none" stroke="#4eaa85" stroke-width="2.5"/>',
 ConstructionPlaneFromTwoEdgesCommand:'<path d="M3 25 17 4M12 28 29 8" stroke="#e49a59" stroke-width="2.5"/>',
 ConstructionPlaneFromThreePointsCommand:'<circle cx="6" cy="8" r="2.6" fill="#4498bc"/><circle cx="24" cy="4" r="2.6" fill="#4498bc"/><circle cx="26" cy="25" r="2.6" fill="#4498bc"/>',
 ConstructionPlaneAlongPathCommand:'<path d="M2 27Q8 5 29 6" fill="none" stroke="#e2a464" stroke-width="2.5"/>',
 ConstructionAxisNormalToFaceCommand:'<path d="M5 5v22h22" fill="none" stroke="#76ba95" stroke-width="4"/>',
 ConstructionAxisFromTwoPlanesCommand:'<path d="m4 7 9-5v25l-9 4M23 2v26l7-5" fill="#d1e8d5" stroke="#92b49a"/>',
 ConstructionAxisThroughTwoPointsCommand:'<circle cx="5" cy="27" r="3" fill="#599bbc"/><circle cx="27" cy="4" r="3" fill="#599bbc"/>',
 ConstructionAxisThroughEdgeCommand:'<path d="M4 29 28 3" stroke="#e7ab75" stroke-width="3"/>',
 ConstructionPointThroughTwoEdgesCommand:'<path d="M2 5 29 28M5 30 26 3" fill="none" stroke="#83b59a" stroke-width="2"/>',
 ConstructionPointFromThreePlanesCommand:'<path d="m3 9 13-6 13 8-14 6Zm0 0v17l12 5V17m0 14 14-7V11" fill="#c5dfc9" stroke="#8eae98"/>',
 ConstructionPointFromCircleOrSphereCommand:'<circle cx="16" cy="16" r="11" fill="#7dcca0" stroke="#649d7c"/><circle cx="16" cy="16" r="7" fill="#eef6eb" stroke="#91bca0"/>',
 ConstructionPointAtEdgeAndPlaneCommand:'<path d="M4 9h21v19H4Z" fill="#d8e2d7" stroke="#91a59a"/><path d="m4 30 23-27" stroke="#dfa066" stroke-width="2"/>',
 ConstructionPointAlongPathCommand:'<path d="M2 27Q7 5 16 15t14-11" fill="none" stroke="#bd9b7d" stroke-width="2.2"/>',
};
function commandArt(id,size=36){const row=rows.find(r=>r[0]===id);if(!row)return '';const base=row[1]===plane?planar:row[1]===axis?axial:punctual;
 const body=row[1]===point&&extra[id]?extra[id]+'<circle cx="16" cy="16" r="2.8" fill="#e5a16c" stroke="#f7f1e3"/>':base+(extra[id]||'');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="'+size+'" height="'+size+'" aria-hidden="true" data-art-status="redrawn-unaccepted">'+body+'</svg>';
}
const art=window.asaNativeIcon,previousDraw=art.draw,previousStatus=art.status;
art.draw=(id,size)=>rows.some(r=>r[0]===id)?commandArt(id,size):previousDraw(id,size);
art.status=id=>rows.some(r=>r[0]===id)?'redrawn-unaccepted':previousStatus(id);
window.asaNativeConstruction={schemas,rows,transition,typeArt,commandArt,methodIcon:(id,value)=>{const row=rows.find(r=>r[0]===id);return row?rows.find(r=>r[1]===row[1]&&r[2]===value)?.[0]:null;}};
})();
