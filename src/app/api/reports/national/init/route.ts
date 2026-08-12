import {NextResponse} from "next/server";
import {del,put} from "@vercel/blob";
import {getSession} from "@/lib/server/auth";
import {ensureSchema,sql} from "@/lib/server/db";

export const maxDuration=60;

export async function POST(req:Request){
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
 try{
  await ensureSchema();
  const form=await req.formData();
  const date=String(form.get("date")||"").slice(0,10);
  const sourceName=String(form.get("sourceName")||"Power BI nasjonal");
  const rowCount=Number(form.get("rowCount")||0);
  const storeCount=Number(form.get("storeCount")||0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({error:"Ugyldig rapportdato"},{status:400});
  const file=form.get("file");
  let blobUrl:string|null=null;
  if(file instanceof File&&file.size){
   const blob=await put(`excel/${date}/${Date.now()}-${file.name}`,file,{access:"private",addRandomSuffix:true});
   blobUrl=blob.url;
  }
  const q=sql();
  const previous=await q`SELECT blob_url FROM paint_reports WHERE report_date=${date}::date`;
  const now=new Date().toISOString();
  const metadata={date,createdAt:now,sourceName,uploadedBy:session.username,uploadedAt:now,storageMode:"rows",rowCount,storeCount,rows:[]};
  await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at,uploaded_by)
    VALUES(${date}::date,${sourceName},${blobUrl},${JSON.stringify(metadata)}::jsonb,now(),${session.username})
    ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name,blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url),report_data=excluded.report_data,updated_at=now(),uploaded_by=excluded.uploaded_by`;
  const previousUrl=String(previous[0]?.blob_url||'');
  if(blobUrl&&previousUrl&&previousUrl!==blobUrl){
   const references=await q`SELECT
     (SELECT count(*)::int FROM paint_reports WHERE blob_url=${previousUrl})+
     (SELECT count(*)::int FROM paint_import_jobs WHERE blob_url=${previousUrl}) AS count`;
   if(Number(references[0]?.count||0)===0)try{await del(previousUrl)}catch{}
  }
  await q`DELETE FROM paint_report_rows WHERE report_date=${date}::date`;
  return NextResponse.json({ok:true,date,rowCount,storeCount});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke starte importen"},{status:500})}
}
