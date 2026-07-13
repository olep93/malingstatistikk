import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { ensureSchema, sql } from '@/lib/server/db';
import { isAdmin } from '@/lib/server/auth';

export async function GET() {
  try {
    await ensureSchema();
    const q = sql();
    const rows = await q`SELECT report_data FROM paint_reports ORDER BY report_date ASC`;
    const images = await q`SELECT product_key,image_url FROM paint_products WHERE image_url IS NOT NULL`;
    const imageMap = new Map(images.map((x:any)=>[x.product_key,x.image_url]));
    const reports = rows.map((r:any)=>{ const report=r.report_data; report.rows=(report.rows||[]).map((row:any)=>({ ...row, image: row.image || imageMap.get([row.supplier,row.product,row.size||''].join('|')) })); return report; });
    return NextResponse.json({ reports });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Kunne ikke hente rapporter' }, { status: 500 }); }
}
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({error:'Ikke innlogget'}, {status:401});
  try {
    await ensureSchema();
    const form = await req.formData();
    const raw = String(form.get('report') || '');
    const report = JSON.parse(raw);
    const file = form.get('file');
    let blobUrl: string | null = null;
    if (file instanceof File && file.size) {
      const blob = await put(`excel/${report.date}/${Date.now()}-${file.name}`, file, { access: 'private', addRandomSuffix: true });
      blobUrl = blob.url;
    }
    const q = sql();
    await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at)
      VALUES(${report.date},${report.sourceName || 'Excel-rapport'},${blobUrl},${JSON.stringify(report)}::jsonb,now())
      ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name, blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url), report_data=excluded.report_data, updated_at=now()`;
    return NextResponse.json({ok:true, report});
  } catch(e){ return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre rapport'}, {status:500}); }
}
