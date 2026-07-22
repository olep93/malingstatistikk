'use client';
import {useEffect,useState} from 'react';
import {parsePaintHistoryWorkbook} from '@/lib/parser';
import {uploadPresigned} from '@vercel/blob/client';
import {AlertCircle,CalendarDays,CheckCircle2,FileSpreadsheet,LoaderCircle,PackageSearch,Play,RefreshCw,Search,Trash2,UploadCloud} from 'lucide-react';

async function json(res:Response){const text=await res.text();try{return text?JSON.parse(text):{}}catch{return {error:text||'Ugyldig serversvar'}}}
const statusLabel=(status:string)=>({uploaded:'Fil lagret – klar for analyse',analyzing:'Analyserer filen',analysis_error:'Analyse feilet',ready:'Klar for produktsynkronisering',products_ready:'Produkter ferdig – klar for rapportimport',completed:'Import fullført'}[status]||status);

export default function ServerImportJobs({isAdmin,onImported}:{isAdmin:boolean;onImported:()=>Promise<void>}){
 const [file,setFile]=useState<File>();
 const [jobs,setJobs]=useState<any[]>([]);
 const [busy,setBusy]=useState('');
 const [status,setStatus]=useState<{type:'working'|'success'|'error';text:string}|null>(null);
 const load=async()=>{const r=await fetch('/api/import-jobs',{cache:'no-store'}),j=await json(r);if(r.ok)setJobs(j.jobs||[])};
 useEffect(()=>{load()},[]);

 const upload=async()=>{if(!file)return;setBusy('upload');setStatus({type:'working',text:'Kontrollerer Blob-tilkoblingen og laster Excel-filen direkte til serverlageret …'});try{const blob=await uploadPresigned(`excel/import-jobs/${Date.now()}-${file.name}`,file,{access:'private',handleUploadUrl:'/api/import-jobs/upload',multipart:true});setStatus({type:'working',text:'Filen er lastet opp. Oppretter serverjobben …'});const r=await fetch('/api/import-jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sourceName:file.name,blobUrl:blob.url,blobSize:file.size})}),j=await json(r);if(!r.ok)throw new Error(j.error);setStatus({type:'success',text:'Filen er lagret som en serverjobb. Du kan analysere den nå eller fortsette senere fra en annen enhet.'});await load()}catch(e){const raw=e instanceof Error?e.message:'Opplastingen feilet';const text=raw.includes('Failed to retrieve')?'Vercel Blob kunne ikke opprette en sikker opplastingsadresse. Kontroller at Blob-lageret er koblet til prosjektet og deploy på nytt.':raw;setStatus({type:'error',text})}finally{setBusy('')}};
 const analyze=async(id:string,sourceName:string)=>{
  if(!file){setStatus({type:'error',text:'Velg den samme Excel-filen på denne enheten først. Selve analysen gjøres lokalt for å unngå tidsavbrudd på Vercel.'});return;}
  if(file.name!==sourceName&&!confirm(`Valgt fil heter ${file.name}, mens serverjobben heter ${sourceName}. Fortsette likevel?`))return;
  setBusy(`analyze-${id}`);
  let wakeLock:any=null;
  try{
   try{wakeLock=await (navigator as any).wakeLock?.request?.('screen')}catch{}
   setStatus({type:'working',text:'Leser Excel-filen lokalt på PC-en. Skjermen holdes våken mens rapportdagene lagres på serveren …'});
   const reports=await parsePaintHistoryWorkbook(file);
   const prep=await fetch(`/api/import-jobs/${id}/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({totalDays:reports.length})}),pj=await json(prep);
   if(!prep.ok)throw new Error(pj.error);
   const stagedDates=new Set<string>((pj.stagedDates||[]).map((v:string)=>String(v).slice(0,10)));
   const remaining=reports.filter((report:any)=>!stagedDates.has(String(report.date).slice(0,10)));
   if(stagedDates.size){setStatus({type:'working',text:`Fortsetter fra lagret fremdrift: ${stagedDates.size} av ${reports.length} rapportdager ligger allerede på serveren.`});}
   for(let i=0;i<remaining.length;i++){
    const completed=stagedDates.size+i+1;
    setStatus({type:'working',text:`Lagrer rapportdag ${completed} av ${reports.length} på serveren … Allerede lagrede dager hoppes over.`});
    let ok=false,last='';
    for(let attempt=0;attempt<3&&!ok;attempt++){
     const r=await fetch(`/api/import-jobs/${id}/stage-day`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({report:remaining[i]})}),j=await json(r);
     if(r.ok)ok=true;else{last=j.error||'Lagring feilet';await new Promise(res=>setTimeout(res,800*(attempt+1)));}
    }
    if(!ok)throw new Error(`${last} (rapportdag ${completed} av ${reports.length})`);
    if(i%5===0)await load();
   }
   setStatus({type:'success',text:`Gjennomført: alle ${reports.length} rapportdager er lagret server-wide. Du kan nå synkronisere produkter her eller senere fra mobilen.`});
   await load();
  }catch(e){setStatus({type:'error',text:`${e instanceof Error?e.message:'Analysen feilet'} Fremdriften som allerede er lagret, beholdes.`})}
  finally{try{await wakeLock?.release?.()}catch{}setBusy('')}
 };
 const run=async(id:string,mode:'sync-next'|'import-next')=>{setBusy(`${mode}-${id}`);let processed=0;try{for(let i=0;i<100000;i++){const r=await fetch(`/api/import-jobs/${id}/${mode}`,{method:'POST'}),j=await json(r);if(!r.ok)throw new Error(j.date?`${j.error} (${j.date})`:j.error);if(j.done)break;processed++;if(mode==='import-next'&&j.date)setStatus({type:'working',text:`Importerer ${j.date} · ${j.rowCount||0} varelinjer lagret og kontrollert.`});if(i%5===0)await load()}setStatus({type:'success',text:mode==='sync-next'?'Produktsynkroniseringen er ferdig. Du kan nå importere rapportdagene.':`Gjennomført: ${processed} rapportdager ble skrevet til databasen og kontrollert.`});await load();if(mode==='import-next')await onImported()}catch(e){setStatus({type:'error',text:`${e instanceof Error?e.message:'Operasjonen stoppet.'} Fremdriften er lagret. Feildagen kan kjøres på nytt etter at årsaken er rettet.`})}finally{setBusy('')}};
 const repairReports=async(id:string)=>{if(!confirm('Dette skriver alle rapportdagene fra denne importjobben på nytt og erstatter eventuelle tomme eller ufullstendige dager. Fortsette?'))return;setBusy(`repair-${id}`);try{const reset=await fetch(`/api/import-jobs/${id}/repair-reports`,{method:'POST'}),rj=await json(reset);if(!reset.ok)throw new Error(rj.error);setStatus({type:'working',text:`${rj.reset||0} rapportdager er klargjort. Skriver dem nå på nytt med dato og varelinjekontroll …`});for(let i=0;i<100000;i++){const r=await fetch(`/api/import-jobs/${id}/import-next`,{method:'POST'}),j=await json(r);if(!r.ok)throw new Error(j.date?`${j.error} (${j.date})`:j.error);if(j.done)break;if(j.date)setStatus({type:'working',text:`Reparerer ${j.date} · ${j.rowCount||0} varelinjer kontrollert.`});if(i%5===0)await load()}setStatus({type:'success',text:'Gjennomført: alle rapportdagene er skrevet på nytt. Eksisterende tomme eller feilplasserte dager er erstattet.'});await load();await onImported()}catch(e){setStatus({type:'error',text:e instanceof Error?e.message:'Reparasjon av rapportdagene feilet'})}finally{setBusy('')}};
 const remove=async(id:string)=>{if(!confirm('Slette denne serverlagrede importjobben?'))return;await fetch(`/api/import-jobs/${id}`,{method:'DELETE'});await load()};

 return <section className="panel serverImportJobs">
  <div className="panelHead"><div><span className="eyebrow">SERVERLAGRET HISTORIKKIMPORT</span><h2>Last opp på PC – fortsett på mobil</h2><p className="panelIntro">Excel-filen lagres først som én serverjobb. Deretter analyseres den, produktene synkroniseres og rapportdagene importeres i tydelige, separate steg.</p></div><button className="secondary" onClick={load}><RefreshCw size={16}/>Oppdater</button></div>
  <div className="serverJobUpload"><label className="drop"><UploadCloud/><b>{file?.name||'Velg stor historikkfil'}</b><span>.xlsx eller .xls – filen lastes opp uten lokal analyse</span><input type="file" accept=".xlsx,.xls" onChange={e=>setFile(e.target.files?.[0])}/></label><button className="primary" disabled={!file||Boolean(busy)} onClick={upload}>{busy==='upload'?<LoaderCircle className="spin"/>:<UploadCloud/>}1. Last opp fil til server</button></div>
  {status&&<div className={`operationStatus ${status.type}`}>{status.type==='working'?<LoaderCircle className="spin"/>:status.type==='success'?<CheckCircle2/>:<AlertCircle/>}<div><b>Status</b><span>{status.text}</span></div></div>}
  <div className="serverJobList">{jobs.map(job=>{const uploaded=['uploaded','analysis_error'].includes(job.status);const analyzed=!uploaded&&job.status!=='analyzing';const productsDone=job.total_products>0&&job.synced_products>=job.total_products;const importDone=job.total_days>0&&job.imported_days>=job.total_days;return <article key={job.id} className="serverJobCard"><header><div><b>{job.source_name}</b><span>Opprettet av {job.created_by||'ukjent'}{job.blob_size?` · ${(Number(job.blob_size)/1024/1024).toFixed(1)} MB`:''}</span></div><small>{statusLabel(job.status)}</small></header>
   <div className="serverJobSteps"><div className="jobStep done"><span>1</span><div><b>Fil lagret</b><small>Klar på alle enheter</small></div></div><div className={`jobStep ${analyzed?'done':job.status==='analyzing'?'active':''}`}><span>2</span><div><b>Analysert</b><small>{job.staged_days}/{job.total_days||'–'} rapportdager</small></div></div><div className={`jobStep ${productsDone?'done':analyzed?'active':''}`}><span>3</span><div><b>Produkter</b><small>{job.synced_products}/{job.total_products||'–'} synkronisert</small></div></div><div className={`jobStep ${importDone&&Number(job.verified_days||0)>=Number(job.total_days||0)?'done':productsDone?'active':''}`}><span>4</span><div><b>Rapportdager</b><small>{job.imported_days}/{job.total_days||'–'} importert · {job.verified_days||0} kontrollert</small></div></div></div>
   <div className="serverJobActions"><button className="primary" disabled={Boolean(busy)||!uploaded||!file} onClick={()=>analyze(job.id,job.source_name)}>{busy===`analyze-${job.id}`?<LoaderCircle className="spin"/>:<Search size={15}/>}2. Analyser / fortsett</button><button className="secondary" disabled={Boolean(busy)||!analyzed||productsDone} onClick={()=>run(job.id,'sync-next')}><Play size={15}/>{busy===`sync-next-${job.id}`?'Synkroniserer …':'3. Synkroniser produkter'}</button><button className="successBtn" disabled={Boolean(busy)||!analyzed||!productsDone||importDone} onClick={()=>run(job.id,'import-next')}><CheckCircle2 size={15}/>{busy===`import-next-${job.id}`?'Importerer …':'4. Importer rapportdager'}</button>{importDone&&<button className="secondary" disabled={Boolean(busy)} onClick={()=>repairReports(job.id)}><RefreshCw size={15}/>{busy===`repair-${job.id}`?'Reparerer …':'Reparer rapportdager'}</button>}{isAdmin&&<button className="dangerBtn iconOnly" onClick={()=>remove(job.id)}><Trash2 size={16}/></button>}</div>
  </article>})}{!jobs.length&&<div className="empty"><CalendarDays/><p>Ingen serverlagrede importjobber.</p></div>}</div>
 </section>
}
