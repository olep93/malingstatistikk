import {get} from '@vercel/blob';
import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {sql} from '@/lib/server/db';

export const maxDuration=60;

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan laste ned private importfiler'},{status:403});
  try{
    const {id}=await params;
    const q=sql();
    const rows=await q`SELECT source_name,blob_url FROM paint_import_jobs WHERE id=${id}::bigint LIMIT 1`;
    if(!rows.length||!rows[0].blob_url)return NextResponse.json({error:'Originalfilen finnes ikke'},{status:404});
    const result=await get(String(rows[0].blob_url),{access:'private'});
    if(!result||result.statusCode!==200||!result.stream)return NextResponse.json({error:'Kunne ikke hente originalfilen'},{status:404});
    const filename=String(rows[0].source_name||'import.xlsx').replace(/["\r\n]/g,'');
    return new Response(result.stream,{headers:{
      'Content-Type':result.blob.contentType||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
    }});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Nedlasting feilet'},{status:500})}
}
