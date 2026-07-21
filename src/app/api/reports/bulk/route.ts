import {NextResponse} from "next/server";
import {put} from "@vercel/blob";
import {getSession} from "@/lib/server/auth";
import {ensureSchema,sql} from "@/lib/server/db";
import {aggregateProducts,canonicalizeRow,DailyReport} from "@/lib/data";
import {parsePaintHistoryWorkbook} from "@/lib/parser";

export const maxDuration=60;
const DB_CHUNK_SIZE=1;

async function storeReports(reports:DailyReport[],mode:string,session:{username:string},blobUrl:string|null){
  const q=sql();
  const existing=await q`SELECT report_date::text AS report_date FROM paint_reports`;
  const existingDates=new Set(existing.map((r:any)=>String(r.report_date).slice(0,10)));
  const prepared=reports.map(input=>{
    const report={...input,rows:aggregateProducts((input.rows||[]).map(row=>canonicalizeRow(row)))};
    report.uploadedBy=session.username;report.uploadedAt=new Date().toISOString();
    return {report_date:report.date,source_name:report.sourceName||"Historikkimport",blob_url:blobUrl,report_data:report,uploaded_by:session.username};
  });
  const selected=mode==="replace"?prepared:prepared.filter(row=>!existingDates.has(row.report_date));
  const skipped=prepared.length-selected.length;
  const replaced=mode==="replace"?selected.filter(row=>existingDates.has(row.report_date)).length:0;
  let written=0;
  for(let i=0;i<selected.length;i+=DB_CHUNK_SIZE){
    const chunk=selected.slice(i,i+DB_CHUNK_SIZE);
    await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at,uploaded_by)
      SELECT x.report_date::date,x.source_name,x.blob_url,x.report_data,now(),x.uploaded_by
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS x(report_date text,source_name text,blob_url text,report_data jsonb,uploaded_by text)
      ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name,blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url),report_data=excluded.report_data,updated_at=now(),uploaded_by=excluded.uploaded_by`;
    written+=chunk.length;
  }
  const verification=await q`SELECT count(*)::int AS count,min(report_date)::text AS first_date,max(report_date)::text AS last_date FROM paint_reports`;
  return {ok:true,imported:mode==="replace"?written-replaced:written,replaced,skipped,total:reports.length,written,firstDate:reports[0]?.date,lastDate:reports.at(-1)?.date,databaseCount:verification[0]?.count||0,databaseFirstDate:String(verification[0]?.first_date||"").slice(0,10),databaseLastDate:String(verification[0]?.last_date||"").slice(0,10)};
}

export async function POST(req:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
  try{
    await ensureSchema();
    const type=req.headers.get("content-type")||"";
    if(type.includes("application/json")){
      const body=await req.json();
      const reports=Array.isArray(body.reports)?body.reports:[];
      if(!reports.length)return NextResponse.json({error:"Ingen rapportdager mottatt"},{status:400});
      return NextResponse.json(await storeReports(reports,String(body.mode||"skip"),session,null));
    }
    const form=await req.formData();
    const mode=String(form.get("mode")||"skip");
    const file=form.get("file");
    if(!(file instanceof File)||!file.size)return NextResponse.json({error:"Historikkfil mangler"},{status:400});
    const reports=await parsePaintHistoryWorkbook(file);
    const blob=await put(`excel/history/${Date.now()}-${file.name}`,file,{access:"private",addRandomSuffix:true});
    return NextResponse.json(await storeReports(reports,mode,session,blob.url));
  }catch(e){
    console.error("POST /api/reports/bulk failed",e);
    return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke importere historikken"},{status:500});
  }
}
