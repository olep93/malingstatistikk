import {NextResponse} from "next/server";
import {put} from "@vercel/blob";
import {isAdmin} from "@/lib/server/auth";
import {ensureSchema,sql} from "@/lib/server/db";
import {aggregateProducts,canonicalizeRow} from "@/lib/data";
import {parsePaintHistoryWorkbook} from "@/lib/parser";

export const maxDuration=300;

const CHUNK_SIZE=8;

export async function POST(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:"Ikke innlogget"},{status:401});
  try{
    await ensureSchema();
    const form=await req.formData();
    const mode=String(form.get("mode")||"skip");
    const file=form.get("file");
    if(!(file instanceof File)||!file.size)return NextResponse.json({error:"Historikkfil mangler"},{status:400});

    const reports=await parsePaintHistoryWorkbook(file);
    const blob=await put(`excel/history/${Date.now()}-${file.name}`,file,{access:"private",addRandomSuffix:true});
    const q=sql();
    const existing=await q`SELECT report_date::text AS report_date FROM paint_reports`;
    const existingDates=new Set(existing.map((r:any)=>String(r.report_date).slice(0,10)));

    const prepared=reports.map(input=>{
      const report={...input,rows:aggregateProducts((input.rows||[]).map(row=>canonicalizeRow(row)))};
      return {report_date:report.date,source_name:report.sourceName||"Historikkimport",blob_url:blob.url,report_data:report};
    });
    const selected=mode==="replace"?prepared:prepared.filter(row=>!existingDates.has(row.report_date));
    const skipped=prepared.length-selected.length;
    const replaced=mode==="replace"?selected.filter(row=>existingDates.has(row.report_date)).length:0;

    let written=0;
    for(let i=0;i<selected.length;i+=CHUNK_SIZE){
      const chunk=selected.slice(i,i+CHUNK_SIZE);
      await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at)
        SELECT x.report_date::date,x.source_name,x.blob_url,x.report_data,now()
        FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS x(report_date text,source_name text,blob_url text,report_data jsonb)
        ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name,blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url),report_data=excluded.report_data,updated_at=now()`;
      written+=chunk.length;
    }

    const verification=await q`SELECT count(*)::int AS count,min(report_date)::text AS first_date,max(report_date)::text AS last_date FROM paint_reports`;
    const imported=mode==="replace"?written-replaced:written;
    return NextResponse.json({
      ok:true,imported,replaced,skipped,total:reports.length,written,
      firstDate:reports[0]?.date,lastDate:reports.at(-1)?.date,
      databaseCount:verification[0]?.count||0,
      databaseFirstDate:String(verification[0]?.first_date||"").slice(0,10),
      databaseLastDate:String(verification[0]?.last_date||"").slice(0,10)
    });
  }catch(e){
    console.error("POST /api/reports/bulk failed",e);
    return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke importere historikken"},{status:500});
  }
}
