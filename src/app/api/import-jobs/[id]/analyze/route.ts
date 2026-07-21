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
    const jobs=await q`SELECT id FROM paint_import_jobs WHERE id=${id}::bigint`;
    if(!jobs.length)return NextResponse.json({error:'Importjobben finnes ikke'},{status:404});
    await q`DELETE FROM paint_import_job_days WHERE job_id=${id}::bigint`;
    await q`DELETE FROM paint_import_job_products WHERE job_id=${id}::bigint`;
    await q`UPDATE paint_import_jobs SET status='staging',total_days=${totalDays},staged_days=0,total_products=0,synced_products=0,imported_days=0,failed_products=0,failed_days=0,analyzed_at=null,updated_at=now() WHERE id=${id}::bigint`;
    return NextResponse.json({ok:true,totalDays});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke klargjøre analysen'},{status:500})}
}
