import {NextResponse} from 'next/server';
import {del,put} from '@vercel/blob';
import {ensureSchema,sql} from '@/lib/server/db';
import {getSession} from '@/lib/server/auth';
import {aggregateProducts,canonicalizeRow} from '@/lib/data';
import {rangeFor,refreshReportCache,ReportPeriod,invalidateReportCache} from '@/lib/server/report-cache';
import {cleanProductName} from '@/lib/text';

export const maxDuration=60;
const isoDate=(v:unknown)=>String(v||'').slice(0,10);

async function loadFastReport(date:string,period:ReportPeriod,storeIds:string[]=[]){
 const q=sql();const {from,to}=rangeFor(date,period);
 const coverage=await q`SELECT EXISTS(
   SELECT 1 FROM paint_reports p
   WHERE p.report_date BETWEEN ${from}::date AND ${to}::date
     AND COALESCE(p.report_data->>'storageMode','json')<>'rows'
     AND (
       NOT EXISTS (SELECT 1 FROM paint_report_rows r WHERE r.report_date=p.report_date)
       OR EXISTS (
         SELECT 1 FROM paint_report_rows r
         WHERE r.report_date=p.report_date AND r.source_updated_at<p.updated_at
       )
     )
 ) AS cache_missing`;
 if(Boolean(coverage[0]?.cache_missing))await refreshReportCache(from,to);
 const rows=await q`WITH c AS MATERIALIZED (
   SELECT store_id,max(store_name) store_name,product_key,max(item_no) item_no,max(ean) ean,
     max(raw_name) raw_name,max(product_name) product_name,max(size) size,max(supplier) supplier,
     max(category) category,max(area) area,max(subgroup) subgroup,
     sum(quantity)::float8 quantity,sum(revenue)::float8 revenue,sum(profit)::float8 profit,
     max(image_url) image_url,max(product_url) product_url
   FROM paint_report_rows
   WHERE report_date BETWEEN ${from}::date AND ${to}::date
     AND (${storeIds.length}=0 OR store_id=ANY(${storeIds}::text[]))
   GROUP BY store_id,product_key
 ), p AS MATERIALIZED (
   SELECT DISTINCT ON (keys.product_key) keys.product_key report_product_key,candidate.*
   FROM (SELECT DISTINCT product_key,ean,item_no FROM c) keys
   JOIN paint_products candidate ON candidate.merged_into IS NULL
     AND (candidate.product_key=keys.product_key
       OR (NULLIF(keys.ean,'') IS NOT NULL AND (candidate.ean=keys.ean OR candidate.item_no=keys.ean))
       OR (NULLIF(keys.item_no,'') IS NOT NULL AND (candidate.ean=keys.item_no OR candidate.item_no=keys.item_no)))
   ORDER BY keys.product_key,CASE WHEN candidate.product_key=keys.product_key THEN 0 ELSE 1 END,
     CASE WHEN candidate.lookup_status='found' THEN 0 ELSE 1 END,candidate.updated_at DESC
 ) SELECT c.store_id,c.store_name,
   c.product_key,c.item_no,c.ean,c.raw_name,
   COALESCE(
     CASE WHEN NULLIF(p.display_name,'') IS NOT NULL
       AND p.display_name !~* '^(ean|vare|varenr|produkt|ukjent)([[:space:]:#-]|$)'
       AND p.display_name !~ '^[0-9]{6,14}$' THEN p.display_name END,
     NULLIF(p.website_name,''),c.product_name
   ) product_name,
   COALESCE(NULLIF(p.size,''),c.size,'') size,
   c.supplier,
   COALESCE(NULLIF(p.category,''),c.category) category,
   COALESCE(NULLIF(p.area,''),c.area) area,
   COALESCE(NULLIF(p.subgroup,''),c.subgroup) subgroup,
   c.quantity,c.revenue,c.profit,
   CASE WHEN p.report_product_key IS NOT NULL THEN NULLIF(p.image_url,'')
     WHEN NULLIF(c.ean,'') IS NOT NULL THEN NULL ELSE c.image_url END image_url,
   COALESCE(NULLIF(p.product_url,''),c.product_url) product_url
 FROM c LEFT JOIN p ON p.report_product_key=c.product_key
 ORDER BY c.store_name,product_name`;
 if(!rows.length)return null;
 const meta=await q`SELECT min(created_at)::text created_at,max(updated_at)::text updated_at,max(uploaded_by) uploaded_by,count(*)::int day_count FROM paint_reports WHERE report_date BETWEEN ${from}::date AND ${to}::date`;
 const mapped=rows.map((r:any)=>({storeId:r.store_id,store:r.store_name,productKey:r.product_key,itemNo:r.item_no||'',ean:r.ean||undefined,rawName:cleanProductName(r.raw_name||r.product_name),product:cleanProductName(r.product_name)||'Ukjent produkt',size:r.size||'',supplier:r.supplier,category:r.category||undefined,area:r.area||undefined,subgroup:r.subgroup||undefined,quantity:Number(r.quantity||0),revenue:Number(r.revenue||0),profit:Number(r.profit||0),margin:Number(r.revenue)?Number(r.profit)/Number(r.revenue)*100:0,image:r.image_url||undefined,productUrl:r.product_url||undefined}));
 // SQL-en har allerede aggregert per butikk og stabil product_key. En ny runde
 // gjennom aggregateProducts/canonicalizeRow ville normalisert fra rawName igjen
 // og dermed overskrevet Product Master-navnet med "EAN …" fra BI-importen.
 return {date,createdAt:String(meta[0]?.created_at||new Date().toISOString()),sourceName:period==='Dag'?'Dagsrapport':`${meta[0]?.day_count||0} rapportdager`,uploadedBy:String(meta[0]?.uploaded_by||''),uploadedAt:String(meta[0]?.updated_at||''),rows:mapped};
}

async function loadComparisonReport(date:string){
 const q=sql();
 const rows=await q`SELECT store_id,max(store_name) store_name,max(supplier) supplier,
   COALESCE(area,'exterior') area,COALESCE(subgroup,'') subgroup,
   sum(quantity)::float8 quantity,sum(revenue)::float8 revenue,sum(profit)::float8 profit
   FROM paint_report_rows WHERE report_date=${date}::date
   GROUP BY store_id,area,subgroup,supplier`;
 return {date,createdAt:'',sourceName:'Sammenligningsgrunnlag',rows:rows.map((r:any)=>({
   storeId:r.store_id,store:r.store_name,productKey:`summary|${r.store_id}|${r.area}|${r.subgroup}|${r.supplier}`,
   itemNo:'',rawName:'',product:'Sammenligning',size:'',supplier:r.supplier,area:r.area,subgroup:r.subgroup,
   quantity:Number(r.quantity||0),revenue:Number(r.revenue||0),profit:Number(r.profit||0),
   margin:Number(r.revenue)?Number(r.profit)/Number(r.revenue)*100:0
 }))};
}

export async function GET(req:Request){
 try{const q=sql();const url=new URL(req.url);const date=url.searchParams.get('date');const period=(url.searchParams.get('period')||'Dag') as ReportPeriod;const storeIds=(url.searchParams.get('stores')||'').split(',').map(x=>x.trim()).filter(x=>/^\d+$/.test(x)).slice(0,50);
  if(date){const started=Date.now();const report=await loadFastReport(date,period,storeIds);let previousReport=null;if(period==='Dag'){const prev=await q`SELECT report_date::text report_date FROM paint_reports WHERE report_date<${date}::date ORDER BY report_date DESC LIMIT 1`;if(prev[0]?.report_date)previousReport=await loadComparisonReport(isoDate(prev[0].report_date))}return NextResponse.json({report,previousReport},{headers:{'Cache-Control':'private, max-age=60, stale-while-revalidate=300','Server-Timing':`report;dur=${Date.now()-started}`}})}
  const rows=await q`SELECT p.report_date::text report_date,p.source_name,p.uploaded_by,p.created_at,p.updated_at
    FROM paint_reports p ORDER BY p.report_date`;
  return NextResponse.json({reports:rows.map((r:any)=>({date:isoDate(r.report_date),createdAt:String(r.created_at||''),sourceName:r.source_name||'Rapport',rows:[],uploadedBy:r.uploaded_by||'Ukjent bruker',uploadedAt:String(r.updated_at||r.created_at||''),rowCount:Number(r.row_count||0)}))},{headers:{'Cache-Control':'private, max-age=60, stale-while-revalidate=300'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente rapporter'},{status:500})}
}

export async function POST(req:Request){const session=await getSession();if(!session)return NextResponse.json({error:'Ikke innlogget'},{status:401});try{await ensureSchema();const form=await req.formData();const raw=String(form.get('report')||'');if(!raw)return NextResponse.json({error:'Rapportdata mangler'},{status:400});const report=JSON.parse(raw);const file=form.get('file');let blobUrl:string|null=null;if(file instanceof File&&file.size){const blob=await put(`excel/${report.date}/${Date.now()}-${file.name}`,file,{access:'private',addRandomSuffix:true});blobUrl=blob.url}report.rows=aggregateProducts((report.rows||[]).map((row:any)=>canonicalizeRow(row)));const q=sql();const previous=await q`SELECT blob_url FROM paint_reports WHERE report_date=${report.date}`;report.uploadedBy=session.username;report.uploadedAt=new Date().toISOString();await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at,uploaded_by) VALUES(${report.date},${report.sourceName||'Excel-rapport'},${blobUrl},${JSON.stringify(report)}::jsonb,now(),${session.username}) ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name,blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url),report_data=excluded.report_data,updated_at=now(),uploaded_by=excluded.uploaded_by`;const previousUrl=String(previous[0]?.blob_url||'');if(blobUrl&&previousUrl&&previousUrl!==blobUrl){const references=await q`SELECT (SELECT count(*)::int FROM paint_reports WHERE blob_url=${previousUrl})+(SELECT count(*)::int FROM paint_import_jobs WHERE blob_url=${previousUrl}) AS count`;if(Number(references[0]?.count||0)===0)try{await del(previousUrl)}catch{}}await invalidateReportCache(report.date);return NextResponse.json({ok:true,report})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre rapport'},{status:500})}}
