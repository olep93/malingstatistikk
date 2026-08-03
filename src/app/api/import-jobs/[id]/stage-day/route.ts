import {NextResponse} from 'next/server';
import {isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

function productPayload(rows:any[]){
 const products=new Map<string,any>();
 for(const row of rows){
  const key=row.productKey||[row.area,row.subgroup,row.supplier,row.product,row.size||''].join('|');
  if(!products.has(key))products.set(key,{product_key:key,product_data:{productKey:key,productName:row.product,rawName:row.rawName,supplier:row.supplier,size:row.size,ean:row.ean,itemNo:row.itemNo,area:row.area,subgroup:row.subgroup}});
 }
 return [...products.values()];
}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
 try{
  await ensureSchema();
  const {id}=await params;
  const body=await req.json();
  const operation=String(body?.operation||'');
  const date=String(body?.date||body?.report?.date||'').slice(0,10);
  if(!date)return NextResponse.json({error:'Rapportdato mangler'},{status:400});
  const q=sql();

  if(operation==='init'){
   const totalRows=Math.max(0,Number(body.totalRows||0));
   const meta=body.meta&&typeof body.meta==='object'?body.meta:{};
   const existing=await q`SELECT staged_rows::int,total_rows::int,status FROM paint_import_job_days WHERE job_id=${id}::bigint AND report_date=${date}::date`;
   if(existing.length&&existing[0].status==='staging'&&Number(existing[0].total_rows)===totalRows){
    return NextResponse.json({ok:true,stagedRows:Number(existing[0].staged_rows||0),totalRows,resumed:true});
   }
   const report={...meta,date,rows:[]};
   await q`INSERT INTO paint_import_job_days(job_id,report_date,report_data,status,staged_rows,total_rows,error)
    VALUES(${id}::bigint,${date}::date,${JSON.stringify(report)}::jsonb,'staging',0,${totalRows},null)
    ON CONFLICT(job_id,report_date) DO UPDATE SET report_data=excluded.report_data,status='staging',staged_rows=0,total_rows=excluded.total_rows,error=null,updated_at=now()`;
   await q`UPDATE paint_import_jobs SET status='analyzing',updated_at=now() WHERE id=${id}::bigint`;
   return NextResponse.json({ok:true,stagedRows:0,totalRows,resumed:false});
  }

  if(operation==='append'){
   const rows=Array.isArray(body.rows)?body.rows:[];
   const offset=Math.max(0,Number(body.offset||0));
   if(!rows.length)return NextResponse.json({error:'Batchen inneholder ingen rader'},{status:400});
   const current=await q`SELECT staged_rows::int,total_rows::int,status FROM paint_import_job_days WHERE job_id=${id}::bigint AND report_date=${date}::date`;
   if(!current.length)return NextResponse.json({error:'Rapportdagen er ikke klargjort'},{status:409});
   const stagedRows=Number(current[0].staged_rows||0);
   if(offset<stagedRows)return NextResponse.json({ok:true,stagedRows,totalRows:Number(current[0].total_rows||0),duplicate:true});
   if(offset!==stagedRows)return NextResponse.json({error:`Ugyldig batchrekkefølge. Forventet ${stagedRows}, mottok ${offset}.`},{status:409});
   const payload=productPayload(rows);
   await q`UPDATE paint_import_job_days SET
    report_data=jsonb_set(report_data,'{rows}',COALESCE(report_data->'rows','[]'::jsonb) || ${JSON.stringify(rows)}::jsonb,true),
    staged_rows=staged_rows+${rows.length},status='staging',error=null,updated_at=now()
    WHERE job_id=${id}::bigint AND report_date=${date}::date`;
   if(payload.length){
    await q`INSERT INTO paint_import_job_products(job_id,product_key,product_data,status)
     SELECT ${id}::bigint,x.product_key,x.product_data,'pending'
     FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(product_key text,product_data jsonb)
     ON CONFLICT(job_id,product_key) DO NOTHING`;
    // Komplett Product Master-data brukes direkte. Bare nye eller mangelfulle varer
    // blir stående i berikelseskøen.
    await q`UPDATE paint_import_job_products jp SET status='done',error=null,updated_at=now()
     FROM paint_products p
     WHERE jp.job_id=${id}::bigint AND jp.status='pending'
       AND (p.product_key=jp.product_key OR (NULLIF(p.ean,'') IS NOT NULL AND p.ean=jp.product_data->>'ean'))
       AND p.lookup_status='found' AND NULLIF(p.display_name,'') IS NOT NULL AND NULLIF(p.image_url,'') IS NOT NULL`;
   }
   return NextResponse.json({ok:true,stagedRows:stagedRows+rows.length,totalRows:Number(current[0].total_rows||0)});
  }

  if(operation==='finalize'){
   const current=await q`SELECT staged_rows::int,total_rows::int FROM paint_import_job_days WHERE job_id=${id}::bigint AND report_date=${date}::date`;
   if(!current.length)return NextResponse.json({error:'Rapportdagen finnes ikke'},{status:404});
   const stagedRows=Number(current[0].staged_rows||0),totalRows=Number(current[0].total_rows||0);
   if(stagedRows!==totalRows)return NextResponse.json({error:`Rapportdagen er ikke komplett (${stagedRows}/${totalRows}).`},{status:409});
   await q`UPDATE paint_import_job_days SET status='staged',error=null,updated_at=now() WHERE job_id=${id}::bigint AND report_date=${date}::date`;
   const counts=await q`SELECT
    (SELECT count(*)::int FROM paint_import_job_days WHERE job_id=${id}::bigint AND status='staged') staged,
    (SELECT count(*)::int FROM paint_import_job_products WHERE job_id=${id}::bigint) products,
    (SELECT total_days::int FROM paint_import_jobs WHERE id=${id}::bigint) total`;
   const c=counts[0];
   await q`UPDATE paint_import_jobs SET staged_days=${c.staged},total_products=${c.products},
    synced_products=(SELECT count(*) FROM paint_import_job_products WHERE job_id=${id}::bigint AND status='done'),
    failed_products=(SELECT count(*) FROM paint_import_job_products WHERE job_id=${id}::bigint AND status='error'),
    status=CASE WHEN ${c.staged}>=${c.total} THEN 'ready' ELSE 'analyzing' END,analyzed_at=CASE WHEN ${c.staged}>=${c.total} THEN now() ELSE analyzed_at END,updated_at=now() WHERE id=${id}::bigint`;
   return NextResponse.json({ok:true,stagedDays:c.staged,totalDays:c.total,totalProducts:c.products});
  }

  // Bakoverkompatibilitet for små enkelt-dagskall.
  const report=body?.report;
  if(report?.date&&Array.isArray(report?.rows)){
   const meta={...report};delete meta.rows;
   await q`INSERT INTO paint_import_job_days(job_id,report_date,report_data,status,staged_rows,total_rows)
    VALUES(${id}::bigint,${report.date}::date,${JSON.stringify(report)}::jsonb,'staged',${report.rows.length},${report.rows.length})
    ON CONFLICT(job_id,report_date) DO UPDATE SET report_data=excluded.report_data,status='staged',staged_rows=excluded.staged_rows,total_rows=excluded.total_rows,error=null,updated_at=now()`;
   const payload=productPayload(report.rows);
   if(payload.length)await q`INSERT INTO paint_import_job_products(job_id,product_key,product_data,status)
    SELECT ${id}::bigint,x.product_key,x.product_data,'pending' FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(product_key text,product_data jsonb)
    ON CONFLICT(job_id,product_key) DO NOTHING`;
   return NextResponse.json({ok:true,stagedRows:report.rows.length,totalRows:report.rows.length});
  }
  return NextResponse.json({error:'Ugyldig analyseoperasjon'},{status:400});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre rapportdagen'},{status:500})}
}
