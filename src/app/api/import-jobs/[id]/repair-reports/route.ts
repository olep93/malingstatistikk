import {NextResponse} from 'next/server';
import {getSession} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{
    await ensureSchema();
    const {id}=await params;
    const q=sql();
    const result=await q`UPDATE paint_import_job_days SET status='staged',error=null,updated_at=now()
      WHERE job_id=${id}::bigint RETURNING report_date`;
    await q`UPDATE paint_import_jobs SET imported_days=0,failed_days=0,status='products_ready',updated_at=now()
      WHERE id=${id}::bigint`;
    return NextResponse.json({ok:true,reset:result.length});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke klargjøre rapportdagene for reparasjon'},{status:500})}
}
