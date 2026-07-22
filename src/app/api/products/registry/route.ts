import {NextResponse} from 'next/server';
import {getSession,isAdmin,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {findObsbyggImage} from '@/lib/server/product-images';

export async function GET(){
  if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{await ensureSchema();const q=sql();
    await q`INSERT INTO paint_products(product_key,display_name,supplier,size,ean,source_name,area,subgroup,lookup_status,aliases,first_seen_at,last_seen_at,report_count,updated_at)
      SELECT
        key,
        max(product_name),max(supplier),max(size),max(item_no),max(raw_name),max(area),max(subgroup),'pending',
        jsonb_agg(DISTINCT alias) FILTER (WHERE alias<>''),min(report_date),max(report_date),count(DISTINCT report_date)::int,now()
      FROM (
        SELECT pr.report_date,
          COALESCE(r->>'productKey',concat_ws('|',r->>'area',r->>'subgroup',r->>'supplier',r->>'product',r->>'size')) key,
          COALESCE(NULLIF(r->>'product',''),'Ukjent produkt') product_name,
          COALESCE(NULLIF(r->>'supplier',''),'Ukjent') supplier,
          NULLIF(r->>'size','') size,
          COALESCE(NULLIF(r->>'itemNo',''),NULLIF(r->>'ean','')) item_no,
          COALESCE(NULLIF(r->>'rawName',''),NULLIF(r->>'product','')) raw_name,
          NULLIF(r->>'area','') area,NULLIF(r->>'subgroup','') subgroup,
          unnest(ARRAY[COALESCE(NULLIF(r->>'rawName',''),''),COALESCE(NULLIF(r->>'product',''),'')]) alias
        FROM paint_reports pr CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pr.report_data->'rows','[]'::jsonb)) r
        WHERE COALESCE(r->>'productKey',r->>'product','')<>''
      ) x GROUP BY key
      ON CONFLICT(product_key) DO UPDATE SET
        first_seen_at=LEAST(paint_products.first_seen_at,excluded.first_seen_at),
        last_seen_at=GREATEST(paint_products.last_seen_at,excluded.last_seen_at),
        report_count=GREATEST(paint_products.report_count,excluded.report_count),
        aliases=(SELECT COALESCE(jsonb_agg(DISTINCT v),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(paint_products.aliases,'[]'::jsonb)||COALESCE(excluded.aliases,'[]'::jsonb)) v),
        updated_at=now()`;
    const products=await q`SELECT product_key,ean,source_name,website_name,display_name,display_name_locked,supplier,size,image_url,product_url,category,area,subgroup,subgroup_locked,lookup_status,last_fetched_at,updated_at,aliases,first_seen_at,last_seen_at,report_count,merged_into,review_reason,audit_status,audit_reasons FROM paint_products WHERE merged_into IS NULL ORDER BY CASE WHEN lookup_status<>'found' OR subgroup IS NULL OR subgroup='' THEN 0 ELSE 1 END,updated_at DESC LIMIT 20000`;
    return NextResponse.json({products});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente produktregister'},{status:500})}
}

export async function POST(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan slå opp produkter.'},{status:403});
  try{
    const {action,productKey}=await req.json();
    if(action!=='lookup'||!productKey)return NextResponse.json({error:'Ugyldig handling'},{status:400});
    await ensureSchema();const q=sql();
    const rows=await q`SELECT product_key,ean,source_name,display_name,supplier,size,area,subgroup FROM paint_products WHERE product_key=${productKey} AND merged_into IS NULL LIMIT 1`;
    if(!rows.length)return NextResponse.json({error:'Produktet finnes ikke'},{status:404});
    const p:any=rows[0];
    const result=await findObsbyggImage({productKey:p.product_key,ean:p.ean||'',productName:p.display_name||p.source_name||'Ukjent produkt',rawName:p.source_name||'',supplier:p.supplier||'Ukjent',size:p.size||'',area:p.area||'',subgroup:p.subgroup||''},{force:true});
    const updated=await q`SELECT product_key,ean,source_name,website_name,display_name,supplier,size,image_url,product_url,area,subgroup,lookup_status,report_count FROM paint_products WHERE product_key=${productKey}`;
    return NextResponse.json({ok:true,found:Boolean(result.found),product:updated[0]||null});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke slå opp produktet'},{status:500})}
}

export async function PATCH(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan endre produktmaster.'},{status:403});
  const session=await getSession();
  try{
    const {productKey,displayName,subgroup,area,imageUrl,productUrl,supplier}=await req.json();
    if(!productKey)return NextResponse.json({error:'Produktnøkkel kreves'},{status:400});
    await ensureSchema();const q=sql();
    const oldRows=await q`SELECT display_name,subgroup,area,category,image_url,product_url,supplier FROM paint_products WHERE product_key=${productKey}`;
    if(!oldRows.length)return NextResponse.json({error:'Produktet finnes ikke'},{status:404});
    const old=oldRows[0];
    const normalizeArea=(value:unknown)=>{const v=String(value||'').trim().toLocaleLowerCase('nb-NO');if(['exterior','eksteriør','eksterior','eksteriørmaling'].includes(v))return'exterior';if(['interior','interiør','interiørmaling'].includes(v))return'interior';if(['terrace','terrasse'].includes(v))return'terrace';if(['tools','malerverktøy'].includes(v))return'tools';return String(value||'').trim()};
    const newName=displayName===undefined?old.display_name:String(displayName).trim();
    let newTag=subgroup===undefined?String(old.subgroup||''):String(subgroup).trim();
    let newArea=normalizeArea(area===undefined?(old.area||(['Maling / Dekkbeis / Beis','Vindu / Dør','Murmaling'].includes(old.category)?'exterior':'')):area);
    if(!newName)return NextResponse.json({error:'Produktnavn kan ikke være tomt'},{status:400});
    if(newTag){
      const tag=await q`SELECT area,name FROM paint_tags WHERE is_active=true AND lower(name)=lower(${newTag}) ORDER BY CASE WHEN area=${newArea} THEN 0 ELSE 1 END LIMIT 1`;
      if(!tag.length)return NextResponse.json({error:`Taggen «${newTag}» finnes ikke. Oppdater taglisten og prøv igjen.`},{status:400});
      newArea=String(tag[0].area);newTag=String(tag[0].name);
    }
    // Alle verdier typesettes i en CTE. Det hindrer PostgreSQL-feilen
    // «could not determine data type of parameter $7» når en valgfri verdi er null.
    await q`WITH input AS (
      SELECT
        ${newName}::text AS display_name,
        ${newTag || null}::text AS subgroup,
        ${Boolean(newTag)}::boolean AS subgroup_locked,
        ${newArea || null}::text AS area,
        ${String(old.display_name || '')}::text AS old_display_name,
        ${productKey}::text AS product_key,
        ${imageUrl===undefined?old.image_url:String(imageUrl).trim()||null}::text AS image_url,
        ${productUrl===undefined?old.product_url:String(productUrl).trim()||null}::text AS product_url,
        ${supplier===undefined?old.supplier:String(supplier).trim()||old.supplier}::text AS supplier
    )
    UPDATE paint_products p SET
      display_name=i.display_name,
      display_name_locked=true,
      subgroup=i.subgroup,
      subgroup_locked=i.subgroup_locked,
      area=i.area,
      image_url=i.image_url, image_approved=(i.image_url IS NOT NULL), product_url=i.product_url, supplier=i.supplier,
      category=CASE WHEN i.area='exterior' THEN i.subgroup ELSE p.category END,
      lookup_status=CASE WHEN i.subgroup IS NULL THEN 'pending' ELSE COALESCE(NULLIF(p.lookup_status,'pending'),'found') END,
      review_reason=CASE WHEN i.subgroup IS NULL THEN 'Mangler tag' ELSE null END,
      audit_status=CASE WHEN i.subgroup IS NULL OR i.area IS NULL THEN 'review' ELSE 'ok' END,
      aliases=(SELECT COALESCE(jsonb_agg(DISTINCT v),'[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(p.aliases,'[]'::jsonb)||jsonb_build_array(i.old_display_name,i.display_name,i.subgroup)) v
        WHERE v <> 'null'::jsonb AND v <> '""'::jsonb),
      updated_at=now()
    FROM input i WHERE p.product_key=i.product_key`;

    const changes=[['display_name',old.display_name,newName],['subgroup',old.subgroup,newTag],['area',old.area,newArea]].filter(([,a,b])=>String(a||'')!==String(b||''));
    for(const [field,oldValue,newValue] of changes)await q`INSERT INTO paint_product_changes(product_key,changed_by,field_name,old_value,new_value) VALUES(${productKey},${session?.username||'admin'},${field},${oldValue||null},${newValue||null})`;
    return NextResponse.json({ok:true,product:{product_key:productKey,display_name:newName,subgroup:newTag,area:newArea,image_url:imageUrl===undefined?old.image_url:String(imageUrl).trim()||null,product_url:productUrl===undefined?old.product_url:String(productUrl).trim()||null}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke oppdatere produkt'},{status:500})}
}
