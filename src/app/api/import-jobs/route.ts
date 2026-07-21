import {NextResponse} from 'next/server';
import {getSession,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function GET(){
  if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{
    await ensureSchema();
    const q=sql();
    const jobs=await q`SELECT id::text,source_name,status,total_days,staged_days,total_products,synced_products,imported_days,failed_products,failed_days,created_by,created_at,updated_at,blob_size,analyzed_at FROM paint_import_jobs ORDER BY created_at DESC LIMIT 25`;
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
