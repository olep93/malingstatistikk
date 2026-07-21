import {NextResponse} from 'next/server';
import {isAdmin,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function GET(){
  if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{await ensureSchema();const q=sql();
    // Sørg for at alle produkter som faktisk finnes i rapportene også finnes i Produktmasteren.
    // Dette reparerer eldre rapporter der visningsnavnet fantes på produktsiden, men produktet
    // aldri ble opprettet som egen rad i paint_products.
    await q`INSERT INTO paint_products(product_key,display_name,supplier,size,ean,source_name,area,subgroup,lookup_status,aliases,updated_at)
      SELECT DISTINCT ON (COALESCE(r->>'productKey',concat_ws('|',r->>'area',r->>'subgroup',r->>'supplier',r->>'product',r->>'size')))
        COALESCE(r->>'productKey',concat_ws('|',r->>'area',r->>'subgroup',r->>'supplier',r->>'product',r->>'size')),
        COALESCE(NULLIF(r->>'product',''),'Ukjent produkt'),
        COALESCE(NULLIF(r->>'supplier',''),'Ukjent'),
        NULLIF(r->>'size',''),
        COALESCE(NULLIF(r->>'itemNo',''),NULLIF(r->>'ean','')),
        COALESCE(NULLIF(r->>'rawName',''),NULLIF(r->>'product','')),
        NULLIF(r->>'area',''),
        NULLIF(r->>'subgroup',''),
        'pending',
        jsonb_build_array(COALESCE(NULLIF(r->>'rawName',''),''),COALESCE(NULLIF(r->>'product',''),'')),
        now()
      FROM paint_reports pr
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pr.report_data->'rows','[]'::jsonb)) r
      WHERE COALESCE(r->>'productKey',r->>'product','')<>''
      ORDER BY COALESCE(r->>'productKey',concat_ws('|',r->>'area',r->>'subgroup',r->>'supplier',r->>'product',r->>'size')),pr.report_date DESC
      ON CONFLICT(product_key) DO NOTHING`;
    const products=await q`SELECT product_key,ean,source_name,website_name,display_name,display_name_locked,supplier,size,image_url,product_url,category,area,subgroup,subgroup_locked,lookup_status,last_fetched_at,updated_at,aliases FROM paint_products ORDER BY updated_at DESC LIMIT 10000`;return NextResponse.json({products});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente produktregister'},{status:500})}
}
export async function PATCH(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan endre produktmaster.'},{status:403});
  try{const {productKey,displayName,subgroup}=await req.json();if(!productKey)return NextResponse.json({error:'Produktnøkkel kreves'},{status:400});await ensureSchema();const q=sql();
    if(String(displayName||'').trim()&&String(subgroup||'').trim()) await q`UPDATE paint_products SET display_name=${String(displayName).trim()},display_name_locked=true,subgroup=${String(subgroup).trim()},subgroup_locked=true,updated_at=now() WHERE product_key=${productKey}`;
    else if(String(displayName||'').trim()) await q`UPDATE paint_products SET display_name=${String(displayName).trim()},display_name_locked=true,updated_at=now() WHERE product_key=${productKey}`;
    else if(String(subgroup||'').trim()) await q`UPDATE paint_products SET subgroup=${String(subgroup).trim()},subgroup_locked=true,updated_at=now() WHERE product_key=${productKey}`;
    else return NextResponse.json({error:'Produktnavn eller tag må fylles ut'},{status:400});
    return NextResponse.json({ok:true});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke oppdatere produkt'},{status:500})}
}
