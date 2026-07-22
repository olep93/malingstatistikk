import {NextResponse} from 'next/server';
import {isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
 try{
  await ensureSchema();
  const {id}=await params,{report}=await req.json();
  if(!report?.date||!Array.isArray(report?.rows))return NextResponse.json({error:'Ugyldig rapportdag'},{status:400});
  const products=new Map<string,any>();
  for(const row of report.rows){
   const key=row.productKey||[row.area,row.subgroup,row.supplier,row.product,row.size||''].join('|');
   if(!products.has(key))products.set(key,{product_key:key,product_data:{productKey:key,productName:row.product,rawName:row.rawName,supplier:row.supplier,size:row.size,ean:row.itemNo,area:row.area,subgroup:row.subgroup}});
  }
  const payload=[...products.values()];
  const q=sql();
  await q`INSERT INTO paint_import_job_days(job_id,report_date,report_data,status) VALUES(${id}::bigint,${report.date}::date,${JSON.stringify(report)}::jsonb,'staged') ON CONFLICT(job_id,report_date) DO UPDATE SET report_data=excluded.report_data,status='staged',error=null,updated_at=now()`;
  if(payload.length)await q`INSERT INTO paint_import_job_products(job_id,product_key,product_data,status)
    SELECT ${id}::bigint,x.product_key,x.product_data,'pending'
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(product_key text,product_data jsonb)
    ON CONFLICT(job_id,product_key) DO NOTHING`;
  const counts=await q`SELECT
    (SELECT count(*)::int FROM paint_import_job_days WHERE job_id=${id}::bigint) staged,
    (SELECT count(*)::int FROM paint_import_job_products WHERE job_id=${id}::bigint) products,
    (SELECT total_days::int FROM paint_import_jobs WHERE id=${id}::bigint) total`;
  const c=counts[0];
  await q`UPDATE paint_import_jobs SET staged_days=${c.staged},total_products=${c.products},status=CASE WHEN ${c.staged}>=${c.total} THEN 'ready' ELSE 'staging' END,analyzed_at=CASE WHEN ${c.staged}>=${c.total} THEN now() ELSE analyzed_at END,updated_at=now() WHERE id=${id}::bigint`;
  return NextResponse.json({ok:true,stagedDays:c.staged,totalDays:c.total,totalProducts:c.products});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre rapportdagen'},{status:500})}
}
