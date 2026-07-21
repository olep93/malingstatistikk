import {NextResponse} from 'next/server';
import {get} from '@vercel/blob';
import {isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {parsePaintHistoryWorkbook} from '@/lib/parser';

export const maxDuration=60;

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  const {id}=await params;
  try{
    await ensureSchema();
    const q=sql();
    const jobs=await q`SELECT source_name,blob_url,status FROM paint_import_jobs WHERE id=${id}::bigint`;
    if(!jobs.length)return NextResponse.json({error:'Importjobben finnes ikke'},{status:404});
    const job=jobs[0];
    if(!job.blob_url)return NextResponse.json({error:'Importjobben mangler lagret fil'},{status:400});
    await q`UPDATE paint_import_jobs SET status='analyzing',updated_at=now() WHERE id=${id}::bigint`;

    const result=await get(job.blob_url,{access:'private'});
    if(!result?.stream)throw new Error('Kunne ikke lese den lagrede Excel-filen fra Blob.');
    const response=new Response(result.stream);
    const bytes=await response.arrayBuffer();
    const file=new File([bytes],job.source_name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const reports=await parsePaintHistoryWorkbook(file);
    const products=new Map<string,any>();
    for(const report of reports){
      for(const row of report.rows||[]){
        const key=row.productKey||[row.area,row.subgroup,row.supplier,row.product,row.size||''].join('|');
        if(!products.has(key))products.set(key,{productKey:key,productName:row.product,rawName:row.rawName,supplier:row.supplier,size:row.size,ean:row.itemNo,area:row.area,subgroup:row.subgroup});
      }
    }
    const dayPayload=reports.map(r=>({report_date:r.date,report_data:r}));
    const productPayload=[...products.entries()].map(([product_key,product_data])=>({product_key,product_data}));

    await q`DELETE FROM paint_import_job_days WHERE job_id=${id}::bigint`;
    await q`DELETE FROM paint_import_job_products WHERE job_id=${id}::bigint`;
    await q`INSERT INTO paint_import_job_days(job_id,report_date,report_data,status)
      SELECT ${id}::bigint,x.report_date::date,x.report_data,'staged'
      FROM jsonb_to_recordset(${JSON.stringify(dayPayload)}::jsonb) AS x(report_date text,report_data jsonb)`;
    await q`INSERT INTO paint_import_job_products(job_id,product_key,product_data,status)
      SELECT ${id}::bigint,x.product_key,x.product_data,'pending'
      FROM jsonb_to_recordset(${JSON.stringify(productPayload)}::jsonb) AS x(product_key text,product_data jsonb)`;
    await q`UPDATE paint_import_jobs SET status='ready',total_days=${reports.length},staged_days=${reports.length},total_products=${products.size},synced_products=0,imported_days=0,failed_products=0,failed_days=0,analyzed_at=now(),updated_at=now() WHERE id=${id}::bigint`;
    return NextResponse.json({ok:true,totalDays:reports.length,totalProducts:products.size});
  }catch(e){
    try{const q=sql();await q`UPDATE paint_import_jobs SET status='analysis_error',updated_at=now() WHERE id=${id}::bigint`;}catch{}
    return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke analysere historikkfilen'},{status:500});
  }
}
