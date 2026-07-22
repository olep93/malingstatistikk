import {NextResponse} from 'next/server';
import {put} from '@vercel/blob';
import {ensureSchema,sql} from '@/lib/server/db';
import {getSession} from '@/lib/server/auth';
import {aggregateProducts,canonicalizeRow} from '@/lib/data';
import {rangeFor,refreshReportCache,ReportPeriod,invalidateReportCache} from '@/lib/server/report-cache';

export const maxDuration=60;
const isoDate=(v:unknown)=>String(v||'').slice(0,10);

async function loadFastReport(date:string,period:ReportPeriod){
 const q=sql();const {from,to}=rangeFor(date,period);await refreshReportCache(from,to);
 const rows=await q`SELECT c.store_id,c.store_name,
   c.product_key,c.item_no,c.raw_name,
   COALESCE(NULLIF(p.display_name,''),NULLIF(p.website_name,''),c.product_name) product_name,
   COALESCE(NULLIF(p.size,''),c.size,'') size,
   c.supplier,
   COALESCE(NULLIF(p.category,''),c.category) category,
   COALESCE(NULLIF(p.area,''),c.area) area,
   COALESCE(NULLIF(p.subgroup,''),c.subgroup) subgroup,
   sum(c.quantity)::float8 quantity,sum(c.revenue)::float8 revenue,sum(c.profit)::float8 profit,
   COALESCE(NULLIF(p.image_url,''),c.image_url) image_url,
   COALESCE(NULLIF(p.product_url,''),c.product_url) product_url
 FROM paint_report_rows c LEFT JOIN paint_products p ON p.product_key=c.product_key AND p.merged_into IS NULL
 WHERE c.report_date BETWEEN ${from}::date AND ${to}::date
 GROUP BY c.store_id,c.store_name,c.product_key,c.item_no,c.raw_name,p.display_name,p.website_name,c.product_name,p.size,c.size,c.supplier,p.category,c.category,p.area,c.area,p.subgroup,c.subgroup,p.image_url,c.image_url,p.product_url,c.product_url
 ORDER BY c.store_name,product_name`;
 if(!rows.length)return null;
 const meta=await q`SELECT min(created_at)::text created_at,max(updated_at)::text updated_at,max(uploaded_by) uploaded_by,count(*)::int day_count FROM paint_reports WHERE report_date BETWEEN ${from}::date AND ${to}::date`;
 return {date,createdAt:String(meta[0]?.created_at||new Date().toISOString()),sourceName:period==='Dag'?'Dagsrapport':`${meta[0]?.day_count||0} rapportdager`,uploadedBy:String(meta[0]?.uploaded_by||''),uploadedAt:String(meta[0]?.updated_at||''),rows:rows.map((r:any)=>({storeId:r.store_id,store:r.store_name,productKey:r.product_key,itemNo:r.item_no||'',rawName:r.raw_name||r.product_name,product:r.product_name,size:r.size||'',supplier:r.supplier,category:r.category||undefined,area:r.area||undefined,subgroup:r.subgroup||undefined,quantity:Number(r.quantity||0),revenue:Number(r.revenue||0),profit:Number(r.profit||0),margin:Number(r.revenue)?Number(r.profit)/Number(r.revenue)*100:0,image:r.image_url||undefined,productUrl:r.product_url||undefined}))};
}

export async function GET(req:Request){
 try{await ensureSchema();const q=sql();const url=new URL(req.url);const date=url.searchParams.get('date');const period=(url.searchParams.get('period')||'Dag') as ReportPeriod;
  if(date){const report=await loadFastReport(date,period);let previousReport=null;if(period==='Dag'){const prev=await q`SELECT report_date::text report_date FROM paint_reports WHERE report_date<${date}::date ORDER BY report_date DESC LIMIT 1`;if(prev[0]?.report_date)previousReport=await loadFastReport(isoDate(prev[0].report_date),'Dag')}return NextResponse.json({report,previousReport},{headers:{'Cache-Control':'private, max-age=30, stale-while-revalidate=120'}})}
  const rows=await q`SELECT report_date::text report_date,source_name,uploaded_by,created_at,updated_at,jsonb_array_length(COALESCE(report_data->'rows','[]'::jsonb))::int row_count FROM paint_reports ORDER BY report_date`;
  return NextResponse.json({reports:rows.map((r:any)=>({date:isoDate(r.report_date),createdAt:String(r.created_at||''),sourceName:r.source_name||'Rapport',rows:[],uploadedBy:r.uploaded_by||'Ukjent bruker',uploadedAt:String(r.updated_at||r.created_at||''),rowCount:Number(r.row_count||0)}))});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente rapporter'},{status:500})}
}

export async function POST(req:Request){const session=await getSession();if(!session)return NextResponse.json({error:'Ikke innlogget'},{status:401});try{await ensureSchema();const form=await req.formData();const raw=String(form.get('report')||'');if(!raw)return NextResponse.json({error:'Rapportdata mangler'},{status:400});const report=JSON.parse(raw);const file=form.get('file');let blobUrl:string|null=null;if(file instanceof File&&file.size){const blob=await put(`excel/${report.date}/${Date.now()}-${file.name}`,file,{access:'private',addRandomSuffix:true});blobUrl=blob.url}report.rows=aggregateProducts((report.rows||[]).map((row:any)=>canonicalizeRow(row)));const q=sql();report.uploadedBy=session.username;report.uploadedAt=new Date().toISOString();await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at,uploaded_by) VALUES(${report.date},${report.sourceName||'Excel-rapport'},${blobUrl},${JSON.stringify(report)}::jsonb,now(),${session.username}) ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name,blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url),report_data=excluded.report_data,updated_at=now(),uploaded_by=excluded.uploaded_by`;await invalidateReportCache(report.date);return NextResponse.json({ok:true,report})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre rapport'},{status:500})}}
