/* Independently drawn geometric symbols; no generic document icon for sketch commands. */
const blue='#6db8df',grey='#7f8f99';
const lines=(d:string)=>`<path d="${d}" fill="none" stroke="${blue}" stroke-width="2.8" stroke-linecap="round"/>`;
const mark=(d:string)=>`<path d="${d}" fill="none" stroke="${grey}" stroke-width="2.2" stroke-linecap="round"/>`;
const circle=(x:number,y:number,r:number)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${blue}" stroke-width="2.4"/>`;
const dot=(x:number,y:number)=>`<circle cx="${x}" cy="${y}" r="2.8" fill="#e39b63" stroke="#a26e46" stroke-width=".8"/>`;
const dashed=(d:string)=>`<path d="${d}" fill="none" stroke="${grey}" stroke-width="1.6" stroke-dasharray="3 3"/>`;
const word=(text:string,x=25,y=29)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="${grey}">${text}</text>`;
const cube=lines('m8 17 17-10 17 10v20L25 47 8 37Zm0 0 17 10 17-10M25 27v20');
const arrow=mark('M25 5v20m-6-6 6 6 6-6');
const cursor='<path d="m12 6 25 20-12 2-6 13Z" fill="#eff5f8" stroke="#728d9b" stroke-width="2.3"/>';
const spline=lines('M5 37C15 37 10 7 25 11s7 28 20 5');
const rectangle=lines('M8 11h34v28H8Z');
const polygon=lines('m25 6 18 13-7 23H14L7 19Z');
const slot=lines('M16 12h18a12 12 0 0 1 0 24H16a12 12 0 0 1 0-24Z');
const mesh=lines('M6 38 18 9 34 11 44 39ZM6 38l28-27M18 9l26 30M6 38l20-14 18 15M18 9l8 15 8-13');
const native:Record<string,string>={};
const assign=(ids:string[],svg:string)=>{for(const id of ids)native[`sketch.native.${id}`]=svg;};
// Each family is drawn from elementary geometry, with explicit native-ID assignments.
assign(['SketchMidpointLine'],lines('M6 37 44 10')+dot(25,24)+mark('M14 15v10M19 11v10'));
assign(['SketchConstrainer','SketchAutoConstraintAndDimCmd'],lines('M8 36h33M15 36V13')+mark('m30 6 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z'));
assign(['SketchAutoConstraintAndDimFromDatumCmd'],lines('M11 38h31M11 38V9')+dot(11,38)+mark('M23 12h16M23 20h11M27 29l5 5 9-11'));
assign(['RectangleDropDown'],rectangle+dot(8,11)+dot(42,39));
assign(['ShapeRectangleThreePoint'],lines('m7 25 26-17 12 18-26 17Z')+dot(7,25)+dot(33,8)+dot(45,26));
assign(['ShapeRectangleCenter'],rectangle+dashed('M8 11 42 39M42 11 8 39')+dot(25,25));
assign(['CircleDropDown'],circle(25,25,17)+dot(25,25));
assign(['CircleTwoPoint'],circle(25,25,17)+lines('M8 25h34')+dot(8,25)+dot(42,25));
assign(['CircleThreePoint'],circle(25,25,17)+dot(8,25)+dot(37,13)+dot(37,37));
assign(['CircleTanTanRadius'],circle(25,25,14)+mark('M3 39h43M11 4v42')+dot(11,25)+dot(25,39));
assign(['CircleThreeTangent'],circle(25,26,13)+mark('M5 39h40M4 39 25 3 46 39'));
assign(['ArcDropDown','ArcThreePoint'],lines('M7 37Q12-5 43 25')+dot(7,37)+dot(22,13)+dot(43,25));
assign(['ArcTangent'],lines('M6 38h15a20 20 0 0 0 20-20')+dot(21,38)+dashed('M21 38V12'));
assign(['PolygonDropDown'],polygon);
assign(['ShapePolygonCircumscribed'],polygon+circle(25,26,12));
assign(['ShapePolygonInscribed'],circle(25,25,19)+lines('m25 6 18 13-7 21H14L7 19Z'));
assign(['ShapePolygonEdge'],polygon+mark('M14 45h22')+dot(14,42)+dot(36,42));
assign(['CircleElipse'],'<ellipse cx="25" cy="25" rx="20" ry="13" fill="none" stroke="#6db8df" stroke-width="2.7"/>'+dashed('M4 25h42M25 9v32'));
assign(['SlotDropDown','ShapeSlotCenterToCenter'],slot+dashed('M16 24h18')+dot(16,24)+dot(34,24));
assign(['ShapeSlotOverall'],slot+mark('M4 8v34M46 8v34M4 8h42'));
assign(['ShapeSlotCenterPoint'],slot+dashed('M25 6v38')+dot(25,24));
assign(['ShapeArcSlotThreePoint'],lines('M6 32a21 21 0 0 1 38 0 5 5 0 0 1-10 0 11 11 0 0 0-18 0 5 5 0 0 1-10 0Z')+dot(11,32)+dot(25,16)+dot(39,32));
assign(['ShapeArcSlotCenterTwoPoint'],lines('M6 32a21 21 0 0 1 38 0 5 5 0 0 1-10 0 11 11 0 0 0-18 0 5 5 0 0 1-10 0Z')+dot(25,34)+dashed('M25 34V8'));
assign(['SplineDropDown','DrawSpline'],spline+dot(5,37)+dot(25,11)+dot(45,16));
assign(['DrawCVMSpline3D'],spline+dashed('M5 37 13 4 33 6 45 16')+dot(13,4)+dot(33,6));
assign(['DrawCVMSpline5D'],spline+dashed('M5 37 11 27 16 6 31 8 38 30 45 16')+dot(16,6)+dot(38,30));
assign(['ConicCurveCmd'],lines('M7 40Q13 5 43 7')+dashed('M7 40 7 7 43 7')+dot(7,40)+dot(43,7));
assign(['DrawPoint'],mark('M25 7v36M7 25h36')+dot(25,25));
assign(['MTextCmd'],mark('M7 10h36M25 10v32M17 42h16M7 10v7M43 10v7'));
assign(['FitCurvesToSectionCommand'],mesh+spline);
assign(['MirrorSketchCommand'],lines('M7 38V12l12 26Zm36 0V12L31 38Z')+dashed('M25 4v42'));
assign(['CircularSketchPatternCommand'],circle(25,25,6)+circle(25,7,3)+circle(42,25,3)+circle(25,43,3)+circle(7,25,3)+dashed('M25 10V40M10 25h30'));
assign(['RectangularSketchPatternCommand'],lines('M6 7h10v10H6ZM22 7h10v10H22ZM38 7h7v10h-7ZM6 28h10v10H6ZM22 28h10v10H22ZM38 28h7v10h-7Z'));
assign(['ProjectIncludeDropDown','ProjectNewCmd'],lines('M8 33 30 21 44 29 22 42Z')+mark('M14 7v20m-4-4 4 4 4-4M32 6v15m-4-4 4 4 4-4'));
assign(['IntersectCmd','IntersectionCurve'],lines('M6 36 38 9M7 12l36 28')+dot(24,25));
assign(['SpunProfileCmd'],lines('M17 7Q5 18 15 25 4 36 18 43M33 7q12 11 2 18 11 11-3 18')+dashed('M25 4v42'));
assign(['Include3DGeometry'],cube+mark('M7 5h13M13 1v12'));
assign(['ProjectToSurface'],lines('M7 37q15-18 36-8M7 31v6l5-1M22 25V6m-5 13 5 6 5-6'));
assign(['SketchIsoparametricCurve','FusionIsoCurveAnalysisCommand'],lines('M5 39Q18 18 43 9M7 30Q22 9 43 5M10 44Q27 27 47 17M9 8q-1 25 14 36M21 5q-2 21 16 30'));
assign(['FilletSketchCmd'],lines('M8 41V23A15 15 0 0 1 23 8h18')+dashed('M8 23V8h15'));
assign(['SketchChamferDropDown','ChamferSketchEqualDistance'],lines('M8 42V23L23 8h19')+mark('M12 8h6M8 12v6'));
assign(['ChamferSketchDistanceAngle'],lines('M8 42V23L23 8h19')+mark('M8 33a10 10 0 0 1 7-6'));
assign(['ChamferSketchDistanceDistance'],lines('M8 42V29L29 8h13')+mark('M8 4h21M4 8v21'));
assign(['BlendG1CurveSketchCmd'],lines('M5 39h10c13 0 5-28 20-28h10')+dashed('M15 39 35 11'));
assign(['Offset'],lines('M8 40V20L25 8h17M17 43V25L29 17h16')+mark('m6 7 14 14m-9-1 9 1-1-9'));
assign(['TrimSketchCmd'],circle(12,37,6)+circle(34,37,6)+mark('M15 32 38 6M31 32 9 6')+lines('M3 18h41'));
assign(['ExtendSketchCmd'],lines('M6 38 36 8')+dashed('M22 22 36 8')+mark('M6 8h38m-17 0h9v9'));
assign(['BreakSketchCmd'],lines('M5 39 19 25M29 15 44 1')+mark('m15 14 9 4-4 9M24 28l6-6-6-6'));
assign(['SketchScaleCmd'],lines('M7 43V23h20v20ZM7 43V7h36v36Z')+mark('M25 25 40 10m-9 0h9v9'));
assign(['FusionMoveCommand'],lines('M25 5v40M5 25h40')+mark('m20 10 5-5 5 5M20 40l5 5 5-5M10 20l-5 5 5 5m30-10 5 5-5 5'));
assign(['ChangeParameterCommand'],mark('M18 43 23 9q3-5 10-1M16 20h17')+word('x',35,34));
assign(['ConstraintMidPoint'],lines('M6 34h38')+dot(25,34)+mark('m18 10 7 12 7-12Z'));
assign(['ConstraintCollinear'],lines('M4 39 20 23M29 14 44 0')+dashed('M4 39 44 0')+mark('M12 14h12M18 8v12'));
assign(['ConstraintSmooth'],lines('M4 37Q24 37 24 25T45 7')+mark('M4 29q20 0 20-12M29 37q0-21 16-21'));
assign(['SketchPolygonConstraintCmd'],polygon+circle(25,25,5));
assign(['FusionStartDesignConfigModeCmd'],lines('M9 7h32v36H9ZM9 19h32M9 31h32M20 7v36')+mark('M30 9v8M26 13h8'));
assign(['FusionShowDesignConfigPanelCmd'],lines('M6 8h38v34H6ZM6 19h38M6 30h38M20 8v34M33 8v34'));
assign(['FusionConfigurationRulesCmd'],lines('M7 10h12v12H7ZM31 29h12v12H31Z')+mark('M19 16h18v13m-4-5 4 5 4-5'));
assign(['MeasureCommand'],lines('m6 35 29-29 9 9-29 29Z')+mark('m12 29 5 5m1-11 5 5m1-11 5 5m1-11 5 5'));
assign(['FusionHalfSectionViewCommand'],cube+'<path d="m8 29 17-10 17 10-17 10Z" fill="#e5bd8f" stroke="#a98460" stroke-width="1.4"/>');
assign(['InterferenceCheckCommand'],lines('M5 7h25v26H5ZM20 20h25v26H20Z')+'<path d="M20 20h10v13H20Z" fill="#d68d74"/>');
assign(['FusionCenterOfMassCommand'],circle(25,25,16)+mark('M25 4v42M4 25h42')+'<path d="M25 9a16 16 0 0 1 16 16H25ZM25 41A16 16 0 0 1 9 25h16Z" fill="#8ea8b7"/>');
assign(['FusionCurvatureCombAnalysisCommand'],spline+mark('M9 32 1 26M15 18 7 11M23 11 24 1M32 17l10-7M38 23l8 8'));
assign(['FusionCurvatureMapAnalysisCommand'],'<path d="M6 38 13 10 43 6 35 39Z" fill="#c5dca1" stroke="#8d9c85" stroke-width="1.5"/><path d="M13 10q18 9 22 29M18 9q17 4 20 21" fill="none" stroke="#e0b57e" stroke-width="7"/>');
assign(['FusionDraftAnalysisCommand'],lines('M7 41 18 8h16l10 33Z')+dashed('M25 5v39')+mark('M18 39a7 7 0 0 1 7-7'));
assign(['FusionEnvironmentMapAnalysisCommand'],circle(25,25,18)+'<path d="M8 22q17-10 34 0M8 29q17 10 34 0" fill="none" stroke="#9baab0" stroke-width="4"/>');
assign(['FusionZebraAnalysisCommand'],lines('M7 9q15 20 35 0M7 18q15 20 35 0M7 27q15 20 35 0M7 36q15 20 35 0'));
assign(['FusionSurfaceValidateCommand'],lines('M6 35 13 11l28-5-7 29Z')+mark('m24 37 7 7 15-18'));
assign(['FusionAccessibilityAnalysisCommand'],cube+mark('M25 2v20m-6-6 6 6 6-6'));
assign(['FusionMinimumRadiusAnalysisCommand'],lines('M8 41V23A15 15 0 0 1 23 8h18')+mark('M9 8 23 22m-7-2 7 2-2-7')+word('R',35,37));
assign(['FusionComponentConnectionAnalysisCommand','FusionEditComponentConnectionAnalysisCommand'],lines('M5 8h14v15H5ZM31 28h14v15H31Z')+mark('M19 15h19v13')+circle(26,22,4));
assign(['FusionFastenerStackAnalysisCommand'],mark('M18 6h14v8H18ZM25 14v31M7 23h36M7 31h36M7 39h36')+lines('M20 17h10v26H20Z'));
assign(['GraphViewCmd'],circle(10,10,5)+circle(39,11,5)+circle(25,38,5)+mark('M15 10h19M12 15l10 18M37 16 28 33'));
assign(['FusionDOFAnalysisCommand'],cube+mark('M3 26h19M16 20l6 6-6 6M35 1v17m-5-6 5 6 5-6'));
assign(['FusionViewColorCyclingToggleCmd'],circle(17,17,11)+'<circle cx="32" cy="18" r="11" fill="#efc77f" fill-opacity=".7"/><circle cx="25" cy="32" r="11" fill="#9fc195" fill-opacity=".7"/>');
assign(['FacegroupsToggleCmd'],'<path d="M8 9h17v16H8Z" fill="#9dc8db"/><path d="M25 9h17v16H25Z" fill="#e6ba8b"/><path d="M8 25h17v16H8Z" fill="#b4cc9e"/><path d="M25 25h17v16H25Z" fill="#b9acd0"/>');
assign(['FusionAssemblyStatisticsCommand'],mark('M6 7v36h39')+lines('M13 38V26h6v12M25 38V16h6v22M37 38V7h6v31'));
assign(['SimilarPartsCommand'],lines('M4 10h18v20H4ZM28 20h18v20H28Z')+mark('M14 37h10M19 32v10'));
assign(['ShowHistoryToolbarCmd'],circle(25,25,18)+mark('M25 12v13l10 7'));
assign(['ShowChangeAwarenessToolbarCmd'],circle(23,25,17)+mark('M23 12v13l10 6M38 3v13M32 9h12'));
assign(['GravityClimate_ManufacturingSustainabilityInsights_MainDialog'],lines('M8 40Q8 12 43 6 42 39 8 40ZM8 40 35 15')+mark('M18 30V19M27 23h10'));
assign(['FusionAddEditDecalCommand'],cube+'<path d="M14 23 21 27v12l-7-4Z" fill="#e9bf84" stroke="#9c8c6e"/>');
assign(['FusionAddCanvasCommand'],rectangle+circle(17,20,3)+lines('m8 35 12-10 9 8 7-7 6 9'));
assign(['TSplineImportCommand'],mesh+word('T',24,34));
assign(['SketchImportSVG'],lines('M5 39C9 8 32 5 45 34')+dot(5,39)+dot(45,34)+word('SVG',25,45));
assign(['ImportDxfFileCommand'],rectangle+mark('M5 45h40M8 41v7M42 41v7')+word('DXF'));
assign(['ParaMeshInsertAlignCommand'],mesh);
assign(['FusionImportCommandFromToolbar'],cube+arrow);
assign(['FusionFastenersCommand'],lines('M16 6h18v9H16ZM21 15h8v27h-8Z')+mark('M21 21h8M21 27h8M21 33h8M21 39h8'));
assign(['FusionDuplicateWithJointsCommand'],lines('M5 8h17v17H5ZM28 25h17v17H28Z')+circle(25,25,5));
assign(['PullDeriveCommand'],cube+mark('M5 3h12v11m-5-5 5 5 5-5'));
assign(['InsertMcMasterCarrComponentCommand'],cube+word('M',25,37));
assign(['cadenasparts4cad'],cube+word('C',25,37));
assign(['traceparts_insert'],cube+word('T',25,37));
assign(['NewAssemblyFromPartCommand'],lines('m7 10 8-5 8 5v10l-8 5-8-5Zm20 18 8-5 8 5v10l-8 5-8-5Z')+mark('M15 25v10h12'));
assign(['SelectCommand','SelectionToolsDropDown'],cursor);
assign(['selectWindow'],dashed('M6 7h37v35H6Z')+cursor);
assign(['selectFreeForm'],dashed('M6 27Q0 8 18 8T43 15q8 26-13 28T6 27Z')+cursor);
assign(['selectPaint'],lines('m16 30 20-23 9 7-21 23Z')+'<path d="M16 30c-12 1-2 12-12 15 15 2 21-3 20-8Z" fill="#9ac3d8" stroke="#7d98a7"/>');
assign(['SelectByNameCommand'],mark('M7 10h35M7 19h23M7 28h17')+`<g transform="translate(22 20) scale(.55)">${cursor}</g>`);
assign(['SelectByBoundaryCommand'],dashed('M5 5h40v40H5Z')+lines('M13 13h24v24H13Z'));
assign(['FusionSelectBodiesBySizeCommand'],lines('M5 23h16v18H5ZM26 8h19v33H26Z')+mark('M5 46h40'));
assign(['SelectByInvertCommand'],circle(25,25,18)+'<path d="M25 7a18 18 0 0 1 0 36Z" fill="#9cbaca"/>'+mark('M7 5h12m-5-4 5 4-5 4M43 45H31m5-4-5 4 5 4'));
assign(['FusionSelectSeedAndBoundaryFacesCommand'],lines('M6 7h38v36H6ZM6 19h38M6 31h38M19 7v36M31 7v36')+'<path d="M19 19h12v12H19Z" fill="#e7b374"/>');
assign(['FusionDragCompControlsCmd'],cube+`<g transform="translate(20 14) scale(.65)">${cursor}</g>`);
assign(['SelectionPriorityCommandsDropDown','SelectBodyPriorityCommand'],cube);
assign(['SelectFacePriorityCommand'],cube+'<path d="M8 17 25 27v20L8 37Z" fill="#acd2e5" stroke="#7695a6"/>');
assign(['SelectEdgePriorityCommand'],cube+'<path d="M25 27v20" stroke="#e49459" stroke-width="4"/>');
assign(['SelectComponentPriorityCommand'],cube+circle(25,27,6));
assign(['SelectionFilterCommand'],lines('M6 7h38L29 24v17l-8 4V24Z'));
assign(['SketchAutoConstrainAndFinish'],mark('m29 5 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z')+'<path d="m8 30 11 11L42 18" fill="none" stroke="#48a776" stroke-width="4.5"/>');
// SVG files are independent editable redraws of the observed November 2026
// Sketch controls. Static URLs let the bundler ship the original vector files.
const observedAssets:Record<string,string>={
 'DrawPolyline':new URL('./sketch-icons/DrawPolyline.svg',import.meta.url).href,
 'ShapeRectangleTwoPoint':new URL('./sketch-icons/ShapeRectangleTwoPoint.svg',import.meta.url).href,
 'CircleCenterRadius':new URL('./sketch-icons/CircleCenterRadius.svg',import.meta.url).href,
 'DrawSpline':new URL('./sketch-icons/DrawSpline.svg',import.meta.url).href,
 'MirrorSketchCommand':new URL('./sketch-icons/MirrorSketchCommand.svg',import.meta.url).href,
 'SketchDimension':new URL('./sketch-icons/SketchDimension.svg',import.meta.url).href,
 'FilletSketchCmd':new URL('./sketch-icons/FilletSketchCmd.svg',import.meta.url).href,
 'TrimSketchCmd':new URL('./sketch-icons/TrimSketchCmd.svg',import.meta.url).href,
 'Offset':new URL('./sketch-icons/Offset.svg',import.meta.url).href,
 'BlendG1CurveSketchCmd':new URL('./sketch-icons/BlendG1CurveSketchCmd.svg',import.meta.url).href,
 'SketchAutoConstraintAndDimCmd':new URL('./sketch-icons/SketchAutoConstraintAndDimCmd.svg',import.meta.url).href,
 'ConstraintHorizontalVertical':new URL('./sketch-icons/ConstraintHorizontalVertical.svg',import.meta.url).href,
 'ConstraintCoincident':new URL('./sketch-icons/ConstraintCoincident.svg',import.meta.url).href,
 'ConstraintTangent':new URL('./sketch-icons/ConstraintTangent.svg',import.meta.url).href,
 'ConstraintEqual':new URL('./sketch-icons/ConstraintEqual.svg',import.meta.url).href,
 'ConstraintParallel':new URL('./sketch-icons/ConstraintParallel.svg',import.meta.url).href,
 'ConstraintPerpendicular':new URL('./sketch-icons/ConstraintPerpendicular.svg',import.meta.url).href,
 'ConstraintFix':new URL('./sketch-icons/ConstraintFix.svg',import.meta.url).href,
 'ConstraintMidPoint':new URL('./sketch-icons/ConstraintMidPoint.svg',import.meta.url).href,
 'ConstraintConcentric':new URL('./sketch-icons/ConstraintConcentric.svg',import.meta.url).href,
 'ConstraintCollinear':new URL('./sketch-icons/ConstraintCollinear.svg',import.meta.url).href,
 'ConstraintSymmetry':new URL('./sketch-icons/ConstraintSymmetry.svg',import.meta.url).href,
 'FusionStartDesignConfigModeCmd':new URL('./sketch-icons/FusionStartDesignConfigModeCmd.svg',import.meta.url).href,
 'FusionShowDesignConfigPanelCmd':new URL('./sketch-icons/FusionShowDesignConfigPanelCmd.svg',import.meta.url).href,
 'FusionConfigurationRulesCmd':new URL('./sketch-icons/FusionConfigurationRulesCmd.svg',import.meta.url).href,
 'MeasureCommand':new URL('./sketch-icons/MeasureCommand.svg',import.meta.url).href,
 'FusionHalfSectionViewCommand':new URL('./sketch-icons/FusionHalfSectionViewCommand.svg',import.meta.url).href,
 'PullDeriveCommand':new URL('./sketch-icons/PullDeriveCommand.svg',import.meta.url).href,
 'FusionAddCanvasCommand':new URL('./sketch-icons/FusionAddCanvasCommand.svg',import.meta.url).href,
 'ParaMeshInsertAlignCommand':new URL('./sketch-icons/ParaMeshInsertAlignCommand.svg',import.meta.url).href,
 'NewAssemblyFromPartCommand':new URL('./sketch-icons/NewAssemblyFromPartCommand.svg',import.meta.url).href,
 'SelectCommand':new URL('./sketch-icons/SelectCommand.svg',import.meta.url).href,
 'SketchStop':new URL('./sketch-icons/SketchStop.svg',import.meta.url).href,
 'SketchMidpointLine':new URL('./sketch-icons/SketchMidpointLine.svg',import.meta.url).href,
 'ShapeRectangleThreePoint':new URL('./sketch-icons/ShapeRectangleThreePoint.svg',import.meta.url).href,
 'ShapeRectangleCenter':new URL('./sketch-icons/ShapeRectangleCenter.svg',import.meta.url).href,
 'CircleTwoPoint':new URL('./sketch-icons/CircleTwoPoint.svg',import.meta.url).href,
 'CircleThreePoint':new URL('./sketch-icons/CircleThreePoint.svg',import.meta.url).href,
 'CircleTanTanRadius':new URL('./sketch-icons/CircleTanTanRadius.svg',import.meta.url).href,
 'CircleThreeTangent':new URL('./sketch-icons/CircleThreeTangent.svg',import.meta.url).href,
 'ArcThreePoint':new URL('./sketch-icons/ArcThreePoint.svg',import.meta.url).href,
 'ArcCenterTwoPoint':new URL('./sketch-icons/ArcCenterTwoPoint.svg',import.meta.url).href,
 'ArcTangent':new URL('./sketch-icons/ArcTangent.svg',import.meta.url).href,
 'ShapePolygonCircumscribed':new URL('./sketch-icons/ShapePolygonCircumscribed.svg',import.meta.url).href,
 'ShapePolygonInscribed':new URL('./sketch-icons/ShapePolygonInscribed.svg',import.meta.url).href,
 'ShapePolygonEdge':new URL('./sketch-icons/ShapePolygonEdge.svg',import.meta.url).href,
 'CircleElipse':new URL('./sketch-icons/CircleElipse.svg',import.meta.url).href,
 'ShapeSlotCenterToCenter':new URL('./sketch-icons/ShapeSlotCenterToCenter.svg',import.meta.url).href,
 'ShapeSlotOverall':new URL('./sketch-icons/ShapeSlotOverall.svg',import.meta.url).href,
 'ShapeSlotCenterPoint':new URL('./sketch-icons/ShapeSlotCenterPoint.svg',import.meta.url).href,
 'ShapeArcSlotThreePoint':new URL('./sketch-icons/ShapeArcSlotThreePoint.svg',import.meta.url).href,
 'ShapeArcSlotCenterTwoPoint':new URL('./sketch-icons/ShapeArcSlotCenterTwoPoint.svg',import.meta.url).href,
 'DrawCVMSpline3D':new URL('./sketch-icons/DrawCVMSpline3D.svg',import.meta.url).href,
 'ConicCurveCmd':new URL('./sketch-icons/ConicCurveCmd.svg',import.meta.url).href,
 'DrawPoint':new URL('./sketch-icons/DrawPoint.svg',import.meta.url).href,
 'MTextCmd':new URL('./sketch-icons/MTextCmd.svg',import.meta.url).href,
 'CircularSketchPatternCommand':new URL('./sketch-icons/CircularSketchPatternCommand.svg',import.meta.url).href,
 'RectangularSketchPatternCommand':new URL('./sketch-icons/RectangularSketchPatternCommand.svg',import.meta.url).href,
 'ProjectNewCmd':new URL('./sketch-icons/ProjectNewCmd.svg',import.meta.url).href,
 'IntersectCmd':new URL('./sketch-icons/IntersectCmd.svg',import.meta.url).href,
 'SpunProfileCmd':new URL('./sketch-icons/SpunProfileCmd.svg',import.meta.url).href,
 'Include3DGeometry':new URL('./sketch-icons/Include3DGeometry.svg',import.meta.url).href,
 'ProjectToSurface':new URL('./sketch-icons/ProjectToSurface.svg',import.meta.url).href,
 'IntersectionCurve':new URL('./sketch-icons/IntersectionCurve.svg',import.meta.url).href,
 'SketchIsoparametricCurve':new URL('./sketch-icons/SketchIsoparametricCurve.svg',import.meta.url).href,
 'DrawCVMSpline5D':new URL('./sketch-icons/DrawCVMSpline5D.svg',import.meta.url).href,
};
for(const [id,href] of Object.entries(observedAssets))native[`sketch.native.${id}`]=`<image href="${href}" width="50" height="50"/>`;
export const sketchIcons:Readonly<Record<string,string>>={...native,
 'sketch.entity.delete':mark('M10 13h30M18 13V7h14v6M14 13l2 30h19l2-30M22 20v16M29 20v16'),
 'sketch.construction':dashed('M7 40 43 7')+dot(7,40)+dot(43,7),
 'constraint.coincident':lines('M7 39 25 25 41 8')+'<circle cx="25" cy="25" r="5" fill="#fff" stroke="#6db8df" stroke-width="2.2"/>'+mark('M12 7h10M17 2v10'),
 'constraint.horizontal':lines('M6 29h38')+mark('M17 11v12M30 11v12M17 17h13'),
 'constraint.vertical':lines('M23 6v38')+mark('m31 15 5 15 6-15'),
 'constraint.parallel':lines('m7 38 18-30M23 42 18-30')+mark('m20 24 4 5M33 26l4 5'),
 'constraint.perpendicular':lines('M7 39h35M15 39V7')+mark('M15 30h9v9'),
 'constraint.tangent':circle(24,22,13)+lines('M5 35h40')+mark('M22 35h5'),
 'constraint.concentric':circle(25,25,17)+circle(25,25,8)+mark('M22 25h6M25 22v6'),
 'constraint.equal':lines('M7 13h36M7 38h36')+mark('M18 21h14M18 28h14'),
 'constraint.symmetric':lines('M8 8v34M42 8v34')+mark('M25 5v7M25 18v8M25 32v13M11 24h28m-24-4-4 4 4 4m20-8 4 4-4 4'),
 'constraint.fixed':'<path d="M12 22h27v22H12Z" fill="#d7eaf5" stroke="#8299a6" stroke-width="2"/>'+mark('M18 22v-8a8 8 0 0 1 16 0v8M25 30v7'),
 'constraint.pointOnCurve':lines('M6 38Q18 6 43 17')+'<circle cx="22" cy="19" r="4" fill="#7cbbd8" stroke="#81949f"/>',
 'dimension.linear':lines('M9 37 38 10')+mark('M5 27 17 40M29 3 44 19M10 33 35 10m-21 22-4 1 1-5m21-17 3-1-1 4'),
 'dimension.horizontal':lines('M8 35h35')+mark('M8 12v28M43 12v28M8 19h35m-28-4-7 4 7 4m21-8 7 4-7 4'),
 'dimension.vertical':lines('M15 8v34')+mark('M11 8h28M11 35h28M31 8v27m-4-20 4-7 4 7m-8 13 4 7 4-7'),
 'dimension.diameter':circle(25,25,17)+mark('M7 43 43 7m-8 5 8-5-4 9M8 36l-1 7 8-4'),
 'dimension.radius':circle(25,25,17)+mark('M25 25 42 8m-8 3 8-3-3 9')+'<text x="10" y="29" font-size="12" fill="#6c8392">R</text>',
 'dimension.angular':lines('M8 40h35M8 40 24 6')+mark('M20 40a12 12 0 0 0-7-10m3-1-3 1 2 3'),
 'system.rebuild':mark('M39 18a16 16 0 1 0 1 12M39 7v12H27'),
};
