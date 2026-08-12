import {NextResponse} from "next/server";
import {getSession} from "@/lib/server/auth";
import {aggregateProducts,canonicalizeRow} from "@/lib/data";
import {ensureSchema,sql} from "@/lib/server/db";
import {refreshReportCache} from "@/lib/server/report-cache";

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
  const {id}=await params;
  try{
    await ensureSchema();
    const q=sql();
    const days=await q`SELECT report_date::text AS report_date,report_data
      FROM paint_import_job_days
      WHERE job_id=${id}::bigint AND status IN ('staged','error')
      ORDER BY report_date LIMIT 1`;
    if(!days.length){
      const counts=await q`SELECT
        count(*) FILTER (WHERE status='imported')::int imported,
        count(*) FILTER (WHERE status='error')::int failed,
        count(*)::int total
        FROM paint_import_job_days WHERE job_id=${id}::bigint`;
      const c=counts[0]||{imported:0,failed:0,total:0};
      await q`UPDATE paint_import_jobs SET
        status=CASE WHEN ${c.failed}>0 THEN 'import_error' ELSE 'completed' END,
        imported_days=${c.imported},failed_days=${c.failed},updated_at=now()
        WHERE id=${id}::bigint`;
      if(Number(c.failed||0)===0)await q`DELETE FROM paint_import_job_days WHERE job_id=${id}::bigint`;
      return NextResponse.json({ok:true,done:true,...c});
    }

    const day=days[0];
    const reportDate=String(day.report_date).slice(0,10);
    const source=day.report_data||{};
    const rows=aggregateProducts((Array.isArray(source.rows)?source.rows:[]).map((row:any)=>canonicalizeRow(row)));
    if(!rows.length)throw new Error(`Rapportdagen ${reportDate} inneholder ingen produktlinjer.`);
    const report={...source,date:reportDate,rows,uploadedBy:session.username,uploadedAt:new Date().toISOString()};

    try{
      // report_date i databasen er alltid fasit. Eksisterende/ufullstendige dager
      // erstattes i stedet for å bli hoppet over.
      await q`INSERT INTO paint_reports(report_date,source_name,report_data,uploaded_by,updated_at)
        VALUES(${reportDate}::date,${report.sourceName||'Serverimport'},${JSON.stringify(report)}::jsonb,${session.username},now())
        ON CONFLICT(report_date) DO UPDATE SET
          source_name=excluded.source_name,
          report_data=excluded.report_data,
          uploaded_by=excluded.uploaded_by,
          updated_at=now()`;
      // Materialiser én gang og fjern deretter den store JSON-kopien. Tidligere
      // ble samme rapport liggende både i JSON og i paint_report_rows.
      await refreshReportCache(reportDate,reportDate);
      const verify=await q`SELECT report_date::text AS report_date,
        (SELECT count(*)::int FROM paint_report_rows WHERE report_date=${reportDate}::date) AS row_count
        FROM paint_reports WHERE report_date=${reportDate}::date`;
      const rowCount=Number(verify[0]?.row_count||0);
      if(!verify.length||rowCount===0)throw new Error(`Kontroll av ${reportDate} feilet: rapporten ble lagret uten varelinjer.`);
      await q`UPDATE paint_reports SET report_data=(report_data-'rows')||jsonb_build_object('storageMode','rows','rowCount',${rowCount}) WHERE report_date=${reportDate}::date`;
      await q`UPDATE paint_import_job_days SET status='imported',error=null,updated_at=now()
        WHERE job_id=${id}::bigint AND report_date=${reportDate}::date`;
      await q`UPDATE paint_import_jobs SET
        imported_days=(SELECT count(*) FROM paint_import_job_days WHERE job_id=${id}::bigint AND status='imported'),
        failed_days=(SELECT count(*) FROM paint_import_job_days WHERE job_id=${id}::bigint AND status='error'),
        status='importing',updated_at=now() WHERE id=${id}::bigint`;
      return NextResponse.json({ok:true,done:false,date:reportDate,rowCount});
    }catch(e){
      const message=e instanceof Error?e.message:'Import feilet';
      await q`UPDATE paint_import_job_days SET status='error',error=${message},updated_at=now()
        WHERE job_id=${id}::bigint AND report_date=${reportDate}::date`;
      await q`UPDATE paint_import_jobs SET
        failed_days=(SELECT count(*) FROM paint_import_job_days WHERE job_id=${id}::bigint AND status='error'),
        status='import_error',updated_at=now() WHERE id=${id}::bigint`;
      return NextResponse.json({error:message,date:reportDate},{status:500});
    }
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Rapportimport feilet'},{status:500});
  }
}
