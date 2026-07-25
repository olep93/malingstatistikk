import {NextResponse} from 'next/server';
import {isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  const {id}=await params;
  try{
    await ensureSchema();
    const body=await req.json().catch(()=>({}));
    const totalDays=Math.max(0,Number(body?.totalDays||0));
    if(!totalDays)return NextResponse.json({error:'Fant ingen rapportdager i filen'},{status:400});
    const q=sql();
    const jobs=await q`SELECT id,total_days FROM paint_import_jobs WHERE id=${id}::bigint`;
    if(!jobs.length)return NextResponse.json({error:'Importjobben finnes ikke'},{status:404});

    // Behold allerede lagrede rapportdager. Dette gjør analysen reelt gjenopptakbar
    // etter dvale, nettverksbrudd eller ny innlogging.
    await q`UPDATE paint_import_jobs SET
      status='staging',
      total_days=${totalDays},
      staged_days=(SELECT count(*)::int FROM paint_import_job_days WHERE job_id=${id}::bigint),
      total_products=(SELECT count(*)::int FROM paint_import_job_products WHERE job_id=${id}::bigint),
      updated_at=now()
      WHERE id=${id}::bigint`;

    const staged=await q`SELECT report_date::text date FROM paint_import_job_days WHERE job_id=${id}::bigint ORDER BY report_date`;
    return NextResponse.json({ok:true,totalDays,stagedDates:staged.map((r:any)=>String(r.date)),stagedDays:staged.length});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke klargjøre analysen'},{status:500})}
}
