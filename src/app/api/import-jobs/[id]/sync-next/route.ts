import {NextResponse} from 'next/server';
import {isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {findObsbyggImage} from '@/lib/server/product-images';
export const maxDuration=60;
const BATCH_SIZE=5;

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
 const {id}=await params;
 try{
  await ensureSchema();const q=sql();
  await q`UPDATE paint_import_job_products jp SET status='done',error=null,updated_at=now()
   FROM paint_products p
   WHERE jp.job_id=${id}::bigint AND jp.status IN ('pending','error')
    AND (p.product_key=jp.product_key OR (NULLIF(p.ean,'') IS NOT NULL AND p.ean=jp.product_data->>'ean'))
    AND p.lookup_status='found' AND NULLIF(p.display_name,'') IS NOT NULL AND NULLIF(p.image_url,'') IS NOT NULL`;

  const rows=await q`SELECT product_key,product_data FROM paint_import_job_products
   WHERE job_id=${id}::bigint AND status='pending'
   ORDER BY updated_at LIMIT ${BATCH_SIZE}`;
  if(!rows.length){
   await q`UPDATE paint_import_jobs SET status=CASE WHEN imported_days>=total_days THEN 'completed' ELSE 'products_ready' END,
    synced_products=(SELECT count(*) FROM paint_import_job_products WHERE job_id=${id}::bigint AND status='done'),
    failed_products=(SELECT count(*) FROM paint_import_job_products WHERE job_id=${id}::bigint AND status='error'),updated_at=now()
    WHERE id=${id}::bigint`;
   return NextResponse.json({ok:true,done:true,processed:0});
  }
  const results=await Promise.all(rows.map(async(item:any)=>{
   try{await findObsbyggImage(item.product_data);return {key:item.product_key,ok:true,error:null}}
   catch(e){return {key:item.product_key,ok:false,error:e instanceof Error?e.message:'Oppslag feilet'}}
  }));
  for(const result of results){
   await q`UPDATE paint_import_job_products SET status=${result.ok?'done':'error'},error=${result.error},updated_at=now()
    WHERE job_id=${id}::bigint AND product_key=${result.key}`;
  }
  const counts=await q`SELECT
   count(*) FILTER (WHERE status='done')::int AS done,
   count(*) FILTER (WHERE status='error')::int AS failed,
   count(*) FILTER (WHERE status='pending')::int AS remaining
   FROM paint_import_job_products WHERE job_id=${id}::bigint`;
  const c=counts[0]||{done:0,failed:0,remaining:0};
  await q`UPDATE paint_import_jobs SET synced_products=${c.done},failed_products=${c.failed},status='syncing',updated_at=now() WHERE id=${id}::bigint`;
  return NextResponse.json({ok:true,done:Number(c.remaining)===0,processed:results.length,...c});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Produktberikelse feilet'},{status:500})}
}
