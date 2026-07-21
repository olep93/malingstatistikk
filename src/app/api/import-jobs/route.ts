import {NextResponse} from 'next/server';
import {put} from '@vercel/blob';
import {getSession,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export const maxDuration=60;

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
    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File)||!file.size)return NextResponse.json({error:'Excel-fil mangler'},{status:400});
    if(!/\.xls(x)?$/i.test(file.name))return NextResponse.json({error:'Bare .xlsx og .xls støttes'},{status:400});
    const blob=await put(`excel/import-jobs/${Date.now()}-${file.name}`,file,{access:'private',addRandomSuffix:true});
    const q=sql();
    const rows=await q`INSERT INTO paint_import_jobs(source_name,status,created_by,blob_url,blob_size) VALUES(${file.name},'uploaded',${session.username},${blob.url},${file.size}) RETURNING id::text`;
    return NextResponse.json({ok:true,id:rows[0].id});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke laste opp serverjobben'},{status:500})}
}
