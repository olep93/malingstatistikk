import {NextResponse} from 'next/server';
import {getSession,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function GET(){
  if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{
    await ensureSchema();
    const q=sql();
    const jobs=await q`SELECT j.id::text,j.source_name,j.status,j.total_days,j.staged_days,j.total_products,j.synced_products,j.imported_days,j.failed_products,j.failed_days,j.created_by,j.created_at,j.updated_at,j.blob_size,j.analyzed_at,
      (SELECT count(*)::int FROM paint_import_job_days d JOIN paint_reports r ON r.report_date=d.report_date
        WHERE d.job_id=j.id AND jsonb_array_length(COALESCE(r.report_data->'rows','[]'::jsonb))>0) verified_days
      FROM paint_import_jobs j ORDER BY j.created_at DESC LIMIT 25`;
    return NextResponse.json({jobs});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente importjobber'},{status:500})}
}

export async function POST(req:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{
    await ensureSchema();
    const body=await req.json();
    const sourceName=String(body?.sourceName||'').trim();
    const blobUrl=String(body?.blobUrl||'').trim();
    const blobSize=Number(body?.blobSize||0);
    if(!sourceName||!blobUrl||!blobSize)return NextResponse.json({error:'Filinformasjon mangler'},{status:400});
    if(!/\.xls(x)?$/i.test(sourceName))return NextResponse.json({error:'Bare .xlsx og .xls støttes'},{status:400});
    if(blobSize>100*1024*1024)return NextResponse.json({error:'Filen er større enn 100 MB'},{status:400});
    if(!/^https:\/\/.*\.blob\.vercel-storage\.com\//i.test(blobUrl))return NextResponse.json({error:'Ugyldig Blob-adresse'},{status:400});
    const q=sql();
    const rows=await q`INSERT INTO paint_import_jobs(source_name,status,created_by,blob_url,blob_size) VALUES(${sourceName},'uploaded',${session.username},${blobUrl},${blobSize}) RETURNING id::text`;
    return NextResponse.json({ok:true,id:rows[0].id});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke opprette serverjobben'},{status:500})}
}
