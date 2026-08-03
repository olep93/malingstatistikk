import {NextResponse} from 'next/server';
import {isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {findObsbyggImage} from '@/lib/server/product-images';
export const maxDuration=60;
const BATCH_SIZE=5;
const MAX_RETRIES=2;

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
 const {id}=await params;
 try{
  await ensureSchema();const q=sql();
  // Gjenopprett produkter som ble stående i 'processing' etter avbrudd eller en eldre deploy.
  // Klienten tillater bare én berikelsesløype per jobb, så disse kan trygt settes tilbake i kø.
  await q`UPDATE paint_import_job_products SET status='pending',updated_at=now()
   WHERE job_id=${id}::bigint AND status='processing'`;

  // Produkter som allerede er komplette i Product Master skal ikke slås opp på nytt.
  await q`UPDATE paint_import_job_products jp SET status='done',error=null,updated_at=now()
   FROM paint_products p
   WHERE jp.job_id=${id}::bigint AND jp.status IN ('pending','error')
    AND (p.product_key=jp.product_key OR (NULLIF(p.ean,'') IS NOT NULL AND p.ean=jp.product_data->>'ean'))
    AND p.lookup_status='found' AND NULLIF(p.image_url,'') IS NOT NULL
    AND (NULLIF(p.website_name,'') IS NOT NULL OR (NULLIF(p.display_name,'') IS NOT NULL
      AND p.display_name !~* '^(ean|vare|varenr|produkt|ukjent)([[:space:]:#-]|$)' AND p.display_name !~ '^[0-9]{6,14}$'))`;

  // Ta nye produkter først. Tidligere feil forsøkes på nytt maksimalt MAX_RETRIES ganger.
  const rows=await q`SELECT product_key,product_data,retry_count FROM paint_import_job_products
   WHERE job_id=${id}::bigint
    AND (status='pending' OR (status='error' AND retry_count<${MAX_RETRIES}))
   ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,updated_at
   LIMIT ${BATCH_SIZE}`;

  if(!rows.length){
   const counts=await q`SELECT
    count(*) FILTER (WHERE status='done')::int AS done,
    count(*) FILTER (WHERE status='error')::int AS failed,
    count(*) FILTER (WHERE status='pending' OR (status='error' AND retry_count<${MAX_RETRIES}))::int AS remaining
    FROM paint_import_job_products WHERE job_id=${id}::bigint`;
   const c=counts[0]||{done:0,failed:0,remaining:0};
   const isDone=Number(c.remaining)===0;
   await q`UPDATE paint_import_jobs SET status=CASE WHEN ${isDone} THEN CASE WHEN imported_days>=total_days THEN 'completed' ELSE 'products_ready' END ELSE 'syncing' END,
    synced_products=${c.done},failed_products=${c.failed},updated_at=now() WHERE id=${id}::bigint`;
   return NextResponse.json({ok:true,done:isDone,processed:0,...c});
  }

  // Marker forsøk før eksterne oppslag. Checkpointet beholdes også ved timeout/avbrudd.
  const keys=rows.map((r:any)=>String(r.product_key));
  await q`UPDATE paint_import_job_products SET retry_count=retry_count+1,status='processing',updated_at=now()
   WHERE job_id=${id}::bigint AND product_key=ANY(${keys}::text[])`;

  const results=await Promise.all(rows.map(async(item:any)=>{
   try{
    const result=await findObsbyggImage(item.product_data);
    if(!result.found)return {key:item.product_key,ok:false,error:'Fant ikke eksakt produkt på Obsbygg.no'};
    return {key:item.product_key,ok:true,error:null};
   }catch(e){return {key:item.product_key,ok:false,error:e instanceof Error?e.message:'Oppslag feilet'}}
  }));
  for(const result of results){
   await q`UPDATE paint_import_job_products SET status=${result.ok?'done':'error'},error=${result.error},updated_at=now()
    WHERE job_id=${id}::bigint AND product_key=${result.key}`;
  }
  const counts=await q`SELECT
   count(*) FILTER (WHERE status='done')::int AS done,
   count(*) FILTER (WHERE status='error')::int AS failed,
   count(*) FILTER (WHERE status='pending' OR status='processing' OR (status='error' AND retry_count<${MAX_RETRIES}))::int AS remaining
   FROM paint_import_job_products WHERE job_id=${id}::bigint`;
  const c=counts[0]||{done:0,failed:0,remaining:0};
  const isDone=Number(c.remaining)===0;
  await q`UPDATE paint_import_jobs SET synced_products=${c.done},failed_products=${c.failed},
   status=CASE WHEN ${isDone} THEN CASE WHEN imported_days>=total_days THEN 'completed' ELSE 'products_ready' END ELSE 'syncing' END,
   updated_at=now() WHERE id=${id}::bigint`;
  return NextResponse.json({ok:true,done:isDone,processed:results.length,...c});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Produktberikelse feilet'},{status:500})}
}
