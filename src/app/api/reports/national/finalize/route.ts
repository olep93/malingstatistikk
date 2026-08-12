import {NextResponse} from "next/server";
import {getSession} from "@/lib/server/auth";
import {ensureSchema,sql} from "@/lib/server/db";
import {blobStorageAudit} from "@/lib/server/blob-cleanup";

export async function POST(req:Request){
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
 try{
  await ensureSchema();
  const body=await req.json();
  const date=String(body.date||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({error:"Ugyldig rapportdato"},{status:400});
  const q=sql();
  const counts=await q`SELECT count(*)::int row_count,count(DISTINCT store_id)::int store_count,sum(revenue)::float8 revenue,sum(profit)::float8 profit FROM paint_report_rows WHERE report_date=${date}::date`;
  const rowCount=Number(counts[0]?.row_count||0),storeCount=Number(counts[0]?.store_count||0);
  if(!rowCount)return NextResponse.json({error:"Ingen linjer ble lagret. Importen kan ikke fullføres."},{status:400});
  await q`UPDATE paint_reports SET report_data=jsonb_set(jsonb_set(jsonb_set(COALESCE(report_data,'{}'::jsonb),'{rowCount}',to_jsonb(${rowCount}::int),true),'{storeCount}',to_jsonb(${storeCount}::int),true),'{completedAt}',to_jsonb(now()::text),true),updated_at=now(),uploaded_by=${session.username} WHERE report_date=${date}::date`;
  // En adminpublisering rydder samtidig tidligere opplastinger som ikke lenger
  // er koblet til rapportarkivet. Lederopplastinger får ingen ekstra ventetid.
  if(session.role==="admin")try{await blobStorageAudit(true)}catch{}
  return NextResponse.json({ok:true,date,rowCount,storeCount,revenue:Number(counts[0]?.revenue||0),profit:Number(counts[0]?.profit||0)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke fullføre importen"},{status:500})}
}
