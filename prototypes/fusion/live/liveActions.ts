import type {CadUiAction} from '../../../src/web/CadUiAction';
import reference from '../native-reference.v5.json';
import '../native-labels.ru.v5.js';
export const ref=reference;
export const russian=(window as unknown as {asaFusionRussianLabels:Record<string,string>}).asaFusionRussianLabels;
export const tr=(name:string)=>russian[name]||name;
export const nativeMap:Readonly<Record<string,string>>={
 SketchCreate:'part.sketch.create',Extrude:'part.extrude',FusionFilletEdgesCommand:'part.fillet',FusionComputeAllCommand:'system.rebuild',
};
let getAction:((id:string)=>CadUiAction)|null=null;
let last:string|null=null;
export function bindActions(get:(id:string)=>CadUiAction){getAction=get;}
export function action(id:string):CadUiAction|null{try{return getAction?.(id)||null;}catch{return null;}}
export function forNative(id:string){const a=nativeMap[id]?action(nativeMap[id]):null;if(id==='Extrude'&&!a?.enabled&&action('part.cutExtrude')?.enabled)return action('part.cutExtrude');return a;}
export function run(id:string){const a=action(id);if(!a?.enabled)return;if(!id.startsWith('system.')&&!id.startsWith('view.'))last=id;void Promise.resolve().then(()=>a.execute()).catch(err=>window.dispatchEvent(new CustomEvent('asa-live-error',{detail:err instanceof Error?err.message:String(err)})));}
export function repeat(){if(last)run(last);}
export function lastAction(){return last;}
export function nativeLabel(id:string){return tr((ref.commands as Record<string,{name:string}>)[id]?.name||id);}
export function reason(a:CadUiAction|null){const r=a?.disabledReason;if(r&&/[А-Яа-яЁё]/.test(r))return r;return a?'Команда недоступна в текущем состоянии':'Операция пока не реализована в ядре ASA-CAD';}
