import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { ensureSchema, sql } from '@/lib/server/db';
import { isAdmin } from '@/lib/server/auth';
export async function DELETE(_:Request,{params}:{params:Promise<{date:string}>}){
  if(!(await isAdmin())) return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{ await ensureSchema(); const {date}=await params; const q=sql(); const rows=await q`SELECT blob_url FROM paint_reports WHERE report_date=${date}`; if(rows[0]?.blob_url){ try{await del(rows[0].blob_url)}catch{} } await q`DELETE FROM paint_reports WHERE report_date=${date}`; return NextResponse.json({ok:true}); }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke slette'},{status:500})}
}
