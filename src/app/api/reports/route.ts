import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { ensureSchema, sql } from '@/lib/server/db';
import { getSession } from '@/lib/server/auth';
import { catalogEntry } from '@/lib/product-catalog';
import { aggregateProducts, canonicalizeRow } from '@/lib/data';

export const maxDuration = 60;

type Period = 'Dag'|'Uke'|'Måned'|'Hittil i år'|'År';

function isoDate(value: unknown){ return String(value || '').slice(0,10); }
function addDays(date:string, days:number){ const d=new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
function rangeFor(date:string, period:Period){
  const d=new Date(`${date}T12:00:00Z`);
  if(period==='Dag') return {from:date,to:date};
  if(period==='Måned') return {from:`${date.slice(0,7)}-01`,to:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10)};
  if(period==='År') return {from:`${d.getUTCFullYear()}-01-01`,to:`${d.getUTCFullYear()}-12-31`};
  if(period==='Hittil i år') return {from:`${d.getUTCFullYear()}-01-01`,to:date};
  const day=d.getUTCDay()||7; const monday=addDays(date,1-day); return {from:monday,to:addDays(monday,6)};
}
function monthChunks(from:string,to:string){
  const chunks:{from:string;to:string}[]=[]; let cursor=from;
  while(cursor<=to){ const d=new Date(`${cursor}T12:00:00Z`); const monthEnd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10); const end=monthEnd<to?monthEnd:to; chunks.push({from:cursor,to:end}); cursor=addDays(end,1); }
  return chunks;
}

async function loadAggregatedReport(date:string,period:Period){
  const q=sql(); const {from,to}=rangeFor(date,period);
  const products=await q`SELECT product_key,display_name,website_name,image_url,product_url,category,subgroup,lookup_status FROM paint_products`;
  const productMap=new Map(products.map((x:any)=>[x.product_key,x]));
  const allRows:any[]=[]; let sourceName=''; let createdAt=''; let uploadedBy=''; let uploadedAt='';
  for(const chunk of monthChunks(from,to)){
    const days=await q`SELECT report_date::text AS report_date,report_data,source_name,uploaded_by,created_at,updated_at FROM paint_reports WHERE report_date BETWEEN ${chunk.from}::date AND ${chunk.to}::date ORDER BY report_date`;
    for(const r of days as any[]){
      const report=r.report_data||{}; sourceName=period==='Dag'?(r.source_name||report.sourceName||'Rapport'):`${from}–${to}`; createdAt=String(r.created_at||report.createdAt||''); uploadedBy=r.uploaded_by||report.uploadedBy||''; uploadedAt=String(r.updated_at||r.created_at||report.uploadedAt||'');
      for(const rawRow of report.rows||[]){
        const row=canonicalizeRow(rawRow); const product=productMap.get(row.productKey); const known=catalogEntry(product?.display_name||row.product,row.rawName);
        allRows.push({...row,product:product?.display_name||row.product,image:product?.image_url||known?.image||row.image,productUrl:product?.product_url||known?.pageUrl||row.productUrl,category:row.category||product?.category||known?.category,subgroup:row.area==='exterior'?row.subgroup:(product?.subgroup||row.subgroup)});
      }
    }
  }
  if(!allRows.length) return null;
  return {date,createdAt:createdAt||new Date().toISOString(),sourceName,uploadedBy,uploadedAt,rows:aggregateProducts(allRows)};
}

export async function GET(req:Request) {
  try {
    await ensureSchema(); const q=sql(); const url=new URL(req.url); const date=url.searchParams.get('date'); const period=(url.searchParams.get('period')||'Dag') as Period;
    if(date){
      const report=await loadAggregatedReport(date,period);
      let previousReport=null;
      if(period==='Dag'){
        const prev=await q`SELECT report_date::text AS report_date FROM paint_reports WHERE report_date < ${date}::date ORDER BY report_date DESC LIMIT 1`;
        if(prev[0]?.report_date) previousReport=await loadAggregatedReport(isoDate(prev[0].report_date),'Dag');
      }
      return NextResponse.json({report,previousReport});
    }
    const rows=await q`SELECT report_date::text AS report_date,source_name,uploaded_by,created_at,updated_at,jsonb_array_length(COALESCE(report_data->'rows','[]'::jsonb))::int AS row_count FROM paint_reports ORDER BY report_date ASC`;
    const reports=rows.map((r:any)=>({date:isoDate(r.report_date),createdAt:String(r.created_at||''),sourceName:r.source_name||'Rapport',rows:[],uploadedBy:r.uploaded_by||'Ukjent bruker',uploadedAt:String(r.updated_at||r.created_at||''),rowCount:Number(r.row_count||0)}));
    return NextResponse.json({reports});
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Kunne ikke hente rapporter' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const session=await getSession(); if (!session) return NextResponse.json({error:'Ikke innlogget'}, {status:401});
  try {
    await ensureSchema(); const form = await req.formData(); const raw = String(form.get('report') || ''); if (!raw) return NextResponse.json({error:'Rapportdata mangler'}, {status:400});
    const report = JSON.parse(raw); const file = form.get('file'); let blobUrl: string | null = null;
    if (file instanceof File && file.size) { const blob = await put(`excel/${report.date}/${Date.now()}-${file.name}`, file, { access: 'private', addRandomSuffix: true }); blobUrl = blob.url; }
    report.rows=aggregateProducts((report.rows||[]).map((row:any)=>canonicalizeRow(row)));
    const q = sql(); report.uploadedBy=session.username;report.uploadedAt=new Date().toISOString();
    await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at,uploaded_by) VALUES(${report.date},${report.sourceName || 'Excel-rapport'},${blobUrl},${JSON.stringify(report)}::jsonb,now(),${session.username}) ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name, blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url), report_data=excluded.report_data, updated_at=now(),uploaded_by=excluded.uploaded_by`;
    return NextResponse.json({ok:true, report, enrichmentPending:false});
  } catch(e){ console.error('POST /api/reports failed', e); return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre rapport'}, {status:500}); }
}
