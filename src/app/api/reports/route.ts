import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { ensureSchema, sql } from '@/lib/server/db';
import { getSession } from '@/lib/server/auth';
import { catalogEntry } from '@/lib/product-catalog';
import { aggregateProducts, canonicalizeRow } from '@/lib/data';

export const maxDuration = 60;

export async function GET() {
  try {
    await ensureSchema();
    const q = sql();
    const rows = await q`SELECT report_data,uploaded_by,created_at,updated_at FROM paint_reports ORDER BY report_date ASC`;
    const products = await q`SELECT product_key,display_name,website_name,image_url,product_url,category,lookup_status FROM paint_products`;
    const productMap = new Map(products.map((x:any)=>[x.product_key,x]));
    const reports = rows.map((r:any)=>{
      const report={...r.report_data,uploadedBy:r.uploaded_by||r.report_data?.uploadedBy||'Ukjent bruker',uploadedAt:(r.updated_at||r.created_at)?.toISOString?.()||String(r.updated_at||r.created_at||r.report_data?.createdAt||'')};
      const canonicalRows=(report.rows||[]).map((rawRow:any)=>{
        const row=canonicalizeRow(rawRow);
        const product=productMap.get(row.productKey);
        const known=catalogEntry(product?.display_name||row.product,row.rawName);
        return {
          ...row,
          product:product?.display_name||row.product,
          image:product?.image_url||known?.image||row.image,
          productUrl:product?.product_url||known?.pageUrl||row.productUrl,
          category:row.category||product?.category||known?.category
        };
      });
      report.rows=aggregateProducts(canonicalRows);
      return report;
    });
    return NextResponse.json({ reports });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Kunne ikke hente rapporter' }, { status: 500 }); }
}

export async function POST(req: Request) {
  const session=await getSession();
  if (!session) return NextResponse.json({error:'Ikke innlogget'}, {status:401});
  try {
    await ensureSchema();
    const form = await req.formData();
    const raw = String(form.get('report') || '');
    if (!raw) return NextResponse.json({error:'Rapportdata mangler'}, {status:400});
    const report = JSON.parse(raw);
    const file = form.get('file');
    let blobUrl: string | null = null;
    if (file instanceof File && file.size) {
      const blob = await put(`excel/${report.date}/${Date.now()}-${file.name}`, file, { access: 'private', addRandomSuffix: true });
      blobUrl = blob.url;
    }

    // Lagre rapporten først. Produktnavn og bilder berikes automatisk i små
    // bakgrunnskall fra nettleseren etter at publiseringen er bekreftet.
    // Dette hindrer at Vercel-funksjonen går på timeout ved mange produkter.
    report.rows=aggregateProducts((report.rows||[]).map((row:any)=>canonicalizeRow(row)));

    const q = sql();
    report.uploadedBy=session.username;report.uploadedAt=new Date().toISOString();
    await q`INSERT INTO paint_reports(report_date,source_name,blob_url,report_data,updated_at,uploaded_by)
      VALUES(${report.date},${report.sourceName || 'Excel-rapport'},${blobUrl},${JSON.stringify(report)}::jsonb,now(),${session.username})
      ON CONFLICT(report_date) DO UPDATE SET source_name=excluded.source_name, blob_url=COALESCE(excluded.blob_url,paint_reports.blob_url), report_data=excluded.report_data, updated_at=now(),uploaded_by=excluded.uploaded_by`;
    return NextResponse.json({ok:true, report, enrichmentPending:false});
  } catch(e){
    console.error('POST /api/reports failed', e);
    return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre rapport'}, {status:500});
  }
}
