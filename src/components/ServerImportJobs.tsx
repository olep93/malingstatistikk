'use client';
import {useEffect,useState} from 'react';
import {parseNationalPowerBiHistoryWorkbook,parsePaintHistoryWorkbook} from '@/lib/parser';
import {uploadPresigned} from '@vercel/blob/client';
import {AlertCircle,CalendarDays,CheckCircle2,Database,FileSpreadsheet,LoaderCircle,Play,RefreshCw,Search,Trash2,UploadCloud} from 'lucide-react';

type SourceType='powerbi'|'lumira';
async function json(res:Response){const text=await res.text();try{return text?JSON.parse(text):{}}catch{return {error:text||'Ugyldig serversvar'}}}
const statusLabel=(status:string)=>({uploaded:'Fil lagret – klar for analyse',analyzing:'Analyserer filen',analysis_error:'Analyse feilet',ready:'Analysert – klar for rapportimport',products_ready:'Produktberikelse ferdig',completed:'Import fullført'}[status]||status);
const sourceLabel=(source:SourceType|string)=>source==='powerbi'?'Power BI':'Lumira / BI Portal';

export default function ServerImportJobs({isAdmin,onImported}:{isAdmin:boolean;onImported:()=>Promise<void>}){
 const [files,setFiles]=useState<Partial<Record<SourceType,File>>>({});
 const [jobs,setJobs]=useState<any[]>([]);
 const [busy,setBusy]=useState('');
 const [status,setStatus]=useState<{type:'working'|'success'|'error';text:string}|null>(null);
 const load=async()=>{const r=await fetch('/api/import-jobs',{cache:'no-store'}),j=await json(r);if(r.ok)setJobs(j.jobs||[])};
 useEffect(()=>{load()},[]);

 const upload=async(sourceType:SourceType)=>{const file=files[sourceType];if(!file)return;setBusy(`upload-${sourceType}`);setStatus({type:'working',text:`Laster ${sourceLabel(sourceType)}-filen direkte til serverlageret …`});try{const blob=await uploadPresigned(`excel/import-jobs/${sourceType}/${Date.now()}-${file.name}`,file,{access:'private',handleUploadUrl:'/api/import-jobs/upload',multipart:true});const r=await fetch('/api/import-jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sourceName:file.name,blobUrl:blob.url,blobSize:file.size,sourceType,importMode:'historical'})}),j=await json(r);if(!r.ok)throw new Error(j.error);setStatus({type:'success',text:`${sourceLabel(sourceType)}-filen er lagret som en historisk importjobb. Analysen kan fortsettes senere uten at jobben forsvinner.`});await load()}catch(e){const raw=e instanceof Error?e.message:'Opplastingen feilet';setStatus({type:'error',text:raw.includes('Failed to retrieve')?'Vercel Blob kunne ikke opprette en sikker opplastingsadresse. Kontroller Blob-tilkoblingen og deploy på nytt.':raw})}finally{setBusy('') }};

 const analyze=async(job:any)=>{
  const sourceType:SourceType=job.source_type==='powerbi'?'powerbi':'lumira';
  const file=files[sourceType];
  if(!file){setStatus({type:'error',text:`Velg den samme ${sourceLabel(sourceType)}-filen på denne enheten først. Analysen gjøres lokalt for å unngå Vercel-timeout.`});return}
  if(file.name!==job.source_name&&!confirm(`Valgt fil heter ${file.name}, mens serverjobben heter ${job.source_name}. Fortsette likevel?`))return;
  setBusy(`analyze-${job.id}`);let wakeLock:any=null;
  try{
   try{wakeLock=await (navigator as any).wakeLock?.request?.('screen')}catch{}
   setStatus({type:'working',text:`Leser ${sourceLabel(sourceType)}-filen lokalt og deler den opp i rapportdager …`});
   const reports=sourceType==='powerbi'?await parseNationalPowerBiHistoryWorkbook(file):await parsePaintHistoryWorkbook(file);
   const prep=await fetch(`/api/import-jobs/${job.id}/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({totalDays:reports.length})}),pj=await json(prep);if(!prep.ok)throw new Error(pj.error);
   const stagedDates=new Set<string>((pj.stagedDates||[]).map((v:string)=>String(v).slice(0,10)));
   const remaining=reports.filter((report:any)=>!stagedDates.has(String(report.date).slice(0,10)));
   const batchSize=200;
   for(let dayIndex=0;dayIndex<remaining.length;dayIndex++){
    const report:any=remaining[dayIndex];
    const date=String(report.date).slice(0,10);
    const rows=Array.isArray(report.rows)?report.rows:[];
    const meta={...report};delete meta.rows;
    const initResponse=await fetch(`/api/import-jobs/${job.id}/stage-day`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'init',date,totalRows:rows.length,meta})});
    const init=await json(initResponse);if(!initResponse.ok)throw new Error(init.error);
    let offset=Math.max(0,Number(init.stagedRows||0));
    while(offset<rows.length){
     const batch=rows.slice(offset,offset+batchSize);
     const completedDays=stagedDates.size+dayIndex;
     setStatus({type:'working',text:`Analyserer ${date} · ${Math.min(offset+batch.length,rows.length).toLocaleString('nb-NO')} / ${rows.length.toLocaleString('nb-NO')} varelinjer · rapportdag ${completedDays+1} av ${reports.length}.`});
     let saved:any=null,last='';
     for(let attempt=0;attempt<4&&!saved;attempt++){
      const r=await fetch(`/api/import-jobs/${job.id}/stage-day`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'append',date,offset,rows:batch})});
      const j=await json(r);
      if(r.ok)saved=j;else{last=j.error||'Lagring feilet';await new Promise(res=>setTimeout(res,900*(attempt+1)))}
     }
     if(!saved)throw new Error(`${last} (${date}, rad ${offset})`);
     offset=Number(saved.stagedRows||offset+batch.length);
    }
    const finalizeResponse=await fetch(`/api/import-jobs/${job.id}/stage-day`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'finalize',date})});
    const finalized=await json(finalizeResponse);if(!finalizeResponse.ok)throw new Error(finalized.error);
    await load();
   }
   setStatus({type:'success',text:`Analysen er ferdig: ${reports.length} rapportdager er lagret i små batcher. Rapportdagene kan nå importeres direkte. Produktberikelse er valgfritt og kan kjøres etterpå.`});await load();
  }catch(e){setStatus({type:'error',text:`${e instanceof Error?e.message:'Analysen feilet'} Fremdriften som allerede er lagret, beholdes. Trykk «Analyser / fortsett» for å fortsette fra siste lagrede batch.`})}finally{try{await wakeLock?.release?.()}catch{}setBusy('')}
 };
 const run=async(id:string,mode:'sync-next'|'import-next')=>{
  setBusy(`${mode}-${id}`);let processed=0;let finalFailed=0;let wakeLock:any=null;
  try{
   try{wakeLock=await (navigator as any).wakeLock?.request?.('screen')}catch{}
   for(let i=0;i<100000;i++){
    const r=await fetch(`/api/import-jobs/${id}/${mode}`,{method:'POST'}),j=await json(r);
    if(!r.ok)throw new Error(j.date?`${j.error} (${j.date})`:j.error);
    processed+=mode==='sync-next'?Number(j.processed||0):(j.done?0:1);
    finalFailed=Number(j.failed||0);
    setStatus({type:'working',text:mode==='sync-next'
      ?`Beriker nye og mangelfulle produkter · ${processed} behandlet · ${Number(j.remaining||0)} gjenstår${finalFailed?` · ${finalFailed} uten sikkert treff`:''}.`
      :`Importerer ${j.date||'rapportdag'} · ${j.rowCount||0} varelinjer kontrollert.`});
    if(i%3===0)await load();
    if(j.done){
     setStatus({type:'success',text:mode==='sync-next'
      ?`Produktberikelsen er ferdig. ${finalFailed?`${finalFailed} produkter fikk ikke sikkert treff og ligger til kontroll.`:'Navn, størrelse og bilder er oppdatert også i historikken.'}`
      :`Import fullført: ${processed} rapportdager ble skrevet til hoveddatabasen.`});
     break;
    }
    await new Promise(resolve=>setTimeout(resolve,150));
   }
   await load();if(mode==='import-next')await onImported();
  }catch(e){setStatus({type:'error',text:`${e instanceof Error?e.message:'Operasjonen stoppet.'} Fremdriften er lagret og kan fortsettes.`})}
  finally{try{await wakeLock?.release?.()}catch{}setBusy('')}
 };
 const remove=async(id:string)=>{if(!confirm('Slette denne serverlagrede importjobben?'))return;await fetch(`/api/import-jobs/${id}`,{method:'DELETE'});await load()};
 const uploadCard=(sourceType:SourceType,title:string,text:string)=><article className="importSourceCard"><div className="importSourceTitle"><Database/><div><span className="eyebrow">{sourceLabel(sourceType)}</span><h3>{title}</h3><p>{text}</p></div></div><label className="drop"><UploadCloud/><b>{files[sourceType]?.name||`Velg ${sourceLabel(sourceType)}-fil`}</b><span>.xlsx eller .xls</span><input type="file" accept=".xlsx,.xls" onChange={e=>setFiles(current=>({...current,[sourceType]:e.target.files?.[0]}))}/></label><button className="primary full" disabled={!files[sourceType]||Boolean(busy)} onClick={()=>upload(sourceType)}>{busy===`upload-${sourceType}`?<LoaderCircle className="spin"/>:<UploadCloud/>}Opprett historisk importjobb</button></article>;

 return <section className="panel serverImportJobs">
  <div className="panelHead"><div><span className="eyebrow">HISTORISK MASSEIMPORT</span><h2>Velg datakilde</h2><p className="panelIntro">Begge kilder bruker samme sikre jobb- og checkpointmotor. Power BI kan inneholde alle varehus; Lumira importerer de varehusene som finnes i uttrekket.</p></div><button className="secondary" onClick={load}><RefreshCw size={16}/>Oppdater</button></div>
  <div className="importSourceGrid">{uploadCard('powerbi','Nasjonal periodeimport','For nye uttrekk med dato, varehus og EAN. Støtter flere datoer og alle Obs BYGG-varehus.')}{uploadCard('lumira','Historikk fra gammel BI Portal','For eksisterende Lumira-format. Bare varehus med data i filen blir importert.')}</div>
  {status&&<div className={`operationStatus ${status.type}`}>{status.type==='working'?<LoaderCircle className="spin"/>:status.type==='success'?<CheckCircle2/>:<AlertCircle/>}<div><b>Status</b><span>{status.text}</span></div></div>}
  <div className="serverJobList">{jobs.map(job=>{const canAnalyze=['uploaded','analysis_error','analyzing','staging'].includes(job.status);const analyzed=['ready','products_ready','syncing','importing','import_error','completed'].includes(job.status);const productsDone=job.total_products===0||(Number(job.synced_products||0)+Number(job.failed_products||0)>=Number(job.total_products||0));const importDone=job.total_days>0&&job.imported_days>=job.total_days;const remainingProducts=Math.max(0,Number(job.total_products||0)-Number(job.synced_products||0)-Number(job.failed_products||0));return <article key={job.id} className="serverJobCard"><header><div><b>{job.source_name}</b><span><strong>{sourceLabel(job.source_type)}</strong> · Opprettet av {job.created_by||'ukjent'}{job.blob_size?` · ${(Number(job.blob_size)/1024/1024).toFixed(1)} MB`:''}</span></div><small>{statusLabel(job.status)}</small></header><div className="serverJobSteps"><div className="jobStep done"><span>1</span><div><b>Fil lagret</b><small>Klar på alle enheter</small></div></div><div className={`jobStep ${analyzed?'done':job.status==='analyzing'?'active':''}`}><span>2</span><div><b>Analysert</b><small>{job.staged_days}/{job.total_days||'–'} rapportdager</small></div></div><div className={`jobStep ${importDone?'done':analyzed?'active':''}`}><span>3</span><div><b>Hoveddatabase</b><small>{job.imported_days}/{job.total_days||'–'} dager importert</small></div></div><div className={`jobStep ${productsDone?'done':importDone?'active':''}`}><span>4</span><div><b>Produktberikelse</b><small>{remainingProducts>0?`${remainingProducts} gjenstår`:Number(job.failed_products||0)>0?`${job.synced_products} klare · ${job.failed_products} til kontroll`:`${job.synced_products}/${job.total_products||0} klare`}</small></div></div></div><div className="serverJobActions"><button className="primary" disabled={Boolean(busy)||!canAnalyze||!files[job.source_type==='powerbi'?'powerbi':'lumira']} onClick={()=>analyze(job)}>{busy===`analyze-${job.id}`?<LoaderCircle className="spin"/>:<Search size={15}/>}2. Analyser / fortsett</button><button className="successBtn" disabled={Boolean(busy)||!analyzed||importDone} onClick={()=>run(job.id,'import-next')}><CheckCircle2 size={15}/>{Number(job.imported_days||0)>0?`Fortsett import (${job.imported_days}/${job.total_days})`:'3. Importer rapportdager'}</button><button className="secondary" disabled={Boolean(busy)||!analyzed||productsDone} onClick={()=>run(job.id,'sync-next')}><Play size={15}/>4. Berik {remainingProducts||''} produkter</button>{isAdmin&&<button className="dangerBtn iconOnly" onClick={()=>remove(job.id)}><Trash2 size={16}/></button>}</div></article>})}{!jobs.length&&<div className="empty"><CalendarDays/><p>Ingen serverlagrede importjobber.</p></div>}</div>
 </section>
}
