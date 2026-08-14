import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {normalizeCommercialSize} from '@/lib/data';
import {PRODUCT_REFERENCE} from '@/lib/product-reference';
import {ensureSchema,sql} from '@/lib/server/db';

export const maxDuration=60;

export async function POST(){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan reparere hele Product Master.'},{status:403});
 try{
  await ensureSchema();const q=sql();
  const mappings=Object.entries(PRODUCT_REFERENCE).map(([itemNo,p])=>({item_no:itemNo,ean:p.ean||'',name:p.name,size:normalizeCommercialSize(p.size),subgroup:p.category==='Vindu / Dør'?'Vindu / Dør':p.category==='Murmaling'?'Murmaling':'Maling / Dekkbeis / Beis'}));
  const products=await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(mappings)}::jsonb) AS x(item_no text,ean text,name text,size text,subgroup text)
  ), resolved AS (
    SELECT DISTINCT ON (p.product_key) p.product_key,m.ean,m.name,m.size,m.subgroup
    FROM paint_products p JOIN mappings m ON p.ean=m.ean OR p.item_no=m.item_no OR p.ean=m.item_no OR p.item_no=m.ean
    WHERE m.size<>'' ORDER BY p.product_key,CASE WHEN p.ean=m.ean THEN 0 WHEN p.item_no=m.item_no THEN 1 WHEN p.ean=m.item_no THEN 2 ELSE 3 END
  ), changed AS (
    UPDATE paint_products p SET
      display_name=CASE WHEN COALESCE(p.display_name_locked,false) THEN p.display_name ELSE r.name END,
      size=r.size,raw_size=r.size,normalized_size=r.size,variant_id=r.ean,area='exterior',
      subgroup=CASE WHEN COALESCE(p.subgroup_locked,false) THEN p.subgroup ELSE r.subgroup END,
      category=CASE WHEN COALESCE(p.subgroup_locked,false) THEN p.category ELSE r.subgroup END,
      image_url=CASE WHEN p.image_url LIKE '%blob.vercel-storage.com/%' THEN p.image_url WHEN p.image_url LIKE '/products/%' THEN NULL WHEN substring(COALESCE(p.image_url,'') from '([0-9]{13})') IS NOT NULL AND substring(p.image_url from '([0-9]{13})')<>r.ean THEN NULL ELSE p.image_url END,
      image_approved=CASE WHEN p.image_url LIKE '%blob.vercel-storage.com/%' THEN p.image_approved WHEN p.image_url LIKE '/products/%' THEN false WHEN substring(COALESCE(p.image_url,'') from '([0-9]{13})') IS NOT NULL AND substring(p.image_url from '([0-9]{13})')<>r.ean THEN false ELSE p.image_approved END,
      normalization_version=9,updated_at=now()
    FROM resolved r WHERE p.product_key=r.product_key RETURNING p.product_key
  ) SELECT count(*)::int count FROM changed`;
  const reports=await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(mappings)}::jsonb) AS x(item_no text,ean text,name text,size text,subgroup text)
  ), resolved AS (
    SELECT DISTINCT ON (r.report_date,r.store_id,r.product_key) r.report_date,r.store_id,r.product_key,m.name,m.size
    FROM paint_report_rows r JOIN mappings m ON r.ean=m.ean OR r.item_no=m.item_no OR r.ean=m.item_no OR r.item_no=m.ean
    WHERE m.size<>'' ORDER BY r.report_date,r.store_id,r.product_key,CASE WHEN r.ean=m.ean THEN 0 WHEN r.item_no=m.item_no THEN 1 WHEN r.ean=m.item_no THEN 2 ELSE 3 END
  ), changed AS (
    UPDATE paint_report_rows r SET product_name=x.name,size=x.size,source_updated_at=now()
    FROM resolved x WHERE r.report_date=x.report_date AND r.store_id=x.store_id AND r.product_key=x.product_key RETURNING r.product_key
  ) SELECT count(*)::int count FROM changed`;
  return NextResponse.json({ok:true,products:Number(products[0]?.count||0),reportRows:Number(reports[0]?.count||0)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke reparere produktvariantene'},{status:500});}
}
