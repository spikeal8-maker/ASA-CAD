import React,{useEffect,useState} from 'react';
import type {CadShellBottom as Original} from '../CadShellBottom';
export function CadShellBottom(p:React.ComponentProps<typeof Original>){
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{const onError=(e:Event)=>setError(String((e as CustomEvent).detail));window.addEventListener('asa-live-error',onError);return()=>window.removeEventListener('asa-live-error',onError);},[]);
 useEffect(()=>{setError(null);},[p.notice]);
 return <footer className="live-status" role="status"><span className={'live-status-dot '+(error?'error':p.recomputeStatus)}/><span>{error||p.notice}</span><span className="live-status-runtime">{p.runtimeStatus==='ready'?'OpenCascade · локально':'Ядро загружается по запросу'} · мм</span></footer>;
}
