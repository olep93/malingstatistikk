import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {findObsbyggImage} from '@/lib/server/product-images';
import {PRODUCT_REFERENCE} from '@/lib/product-reference';

export const maxDuration=60;

type SyncResult={
  productKey:string;
  status:'updated'|'review'|'not_found'|'error';
  source?:'reference'|'obsbygg-ean'|'obsbygg-item';
  reason?:string;
  matchedIdentifier?:string;
  eanRecovered?:boolean;
  error?:string;
};

const digits=(value:unknown)=>String(value||'').replace(/\D/g,'');
const subgroupFor=(category:string)=>category==='Vindu / Dør'?'Vindu / Dør':category==='Murmaling'?'Murmaling':'Maling / Dekkbeis / Beis';

export async function POST(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan synkronisere Product Master.'},{status:403});
  try{
    const body=await req.json();
    const productKeys=Array.isArray(body.productKeys)?body.productKeys.map(String).filter(Boolean).slice(0,20):[];
    if(!productKeys.length)return NextResponse.json({ok:true,checked:0,updated:0,referenceUpdated:0,webUpdated:0,eanRecovered:0,review:0,notFound:0,errors:0,results:[]});

    await ensureSchema();
    const q=sql();
    const rows=await q`SELECT product_key,ean,item_no,source_name,display_name,display_name_locked,supplier,size,area,subgroup,subgroup_locked,image_url,product_url,website_name
      FROM paint_products WHERE product_key=ANY(${productKeys}::text[]) AND merged_into IS NULL`;
    const results:SyncResult[]=[];
    const referenceByEan=new Map(Object.entries(PRODUCT_REFERENCE).filter(([,v])=>v.ean).map(([itemNo,v])=>[digits(v.ean),{itemNo,...v}]));

    for(const p of rows as any[]){
      try{
        const originalEan=digits(p.ean);
        const itemNo=digits(p.item_no);
        const reference=(itemNo&&PRODUCT_REFERENCE[itemNo])?{itemNo,...PRODUCT_REFERENCE[itemNo]}:referenceByEan.get(originalEan);
        let effectiveEan=originalEan;
        let referenceChanged=false;
        let eanRecovered=false;

        // Den godkjente produktreferansen er den raskeste og sikreste oppryddingen.
        // Den kobler eksakt varenummer/EAN til korrekt EAN, navn, størrelse og eksteriør-tag.
        if(reference){
          effectiveEan=digits(reference.ean)||effectiveEan;
          eanRecovered=!originalEan&&Boolean(effectiveEan);
          const subgroup=subgroupFor(reference.category);
          await q`UPDATE paint_products SET
            ean=COALESCE(NULLIF(${effectiveEan},''),ean),
            item_no=COALESCE(NULLIF(${reference.itemNo},''),item_no),
            display_name=CASE WHEN display_name_locked THEN display_name ELSE ${reference.name} END,
            source_name=COALESCE(source_name,${reference.rawName}),
            size=COALESCE(NULLIF(${reference.size},''),size),
            area='exterior',
            subgroup=CASE WHEN subgroup_locked THEN subgroup ELSE ${subgroup} END,
            category=${subgroup},
            lookup_status='found',
            lookup_method=${itemNo&&PRODUCT_REFERENCE[itemNo]?'EXACT_ITEM_NO':'EXACT_EAN'},
            matched_identifier=${itemNo&&PRODUCT_REFERENCE[itemNo]?reference.itemNo:effectiveEan},
            match_confidence=100,
            review_reason=null,
            audit_status='ok',
            aliases=(SELECT COALESCE(jsonb_agg(DISTINCT v),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(aliases,'[]'::jsonb)||jsonb_build_array(${reference.name},${reference.rawName})) v WHERE v<>'null'::jsonb AND v<>'""'::jsonb),
            updated_at=now()
          WHERE product_key=${p.product_key}`;
          referenceChanged=true;
        }

        // Forsøk deretter å hente bilde, nett-navn og URL med eksakt EAN.
        // Referansedataene beholdes selv om Obsbygg.no ikke svarer.
        if(effectiveEan){
          const result=await findObsbyggImage({
            productKey:p.product_key,
            ean:effectiveEan,
            itemNo:itemNo,
            productName:reference?.name||p.display_name||p.source_name||'Ukjent produkt',
            rawName:reference?.rawName||p.source_name||'',
            supplier:p.supplier||'Ukjent',
            size:reference?.size||p.size||'',
            area:reference?'exterior':p.area||'',
            subgroup:reference?subgroupFor(reference.category):p.subgroup||''
          },{force:true,persist:true,exactOnly:true});
          const exactEan=result.found&&result.matchMethod==='EXACT_EAN'&&digits(result.matchedIdentifier)===effectiveEan;
          if(exactEan){results.push({productKey:p.product_key,status:'updated',source:'obsbygg-ean',matchedIdentifier:result.matchedIdentifier,eanRecovered});continue;}
          if(referenceChanged){results.push({productKey:p.product_key,status:'updated',source:'reference',matchedIdentifier:itemNo||effectiveEan,eanRecovered});continue;}
        }

        // Produkter som bare har varenummer blir ikke kastet bort lenger.
        // Et eksakt varenummertreff lagres som forslag til manuell kontroll.
        if(itemNo){
          const result=await findObsbyggImage({
            productKey:p.product_key,ean:'',itemNo,
            productName:p.display_name||p.source_name||'Ukjent produkt',rawName:p.source_name||'',supplier:p.supplier||'Ukjent',size:p.size||'',area:p.area||'',subgroup:p.subgroup||''
          },{force:true,persist:false,exactOnly:true});
          if(result.found&&result.matchMethod==='EXACT_ITEM_NO'){
            await q`UPDATE paint_products SET lookup_status='needs_review',lookup_method='EXACT_ITEM_NO',matched_identifier=${itemNo},match_confidence=100,review_reason='Eksakt varenummertreff funnet. Kontroller og godkjenn før nettdata lagres.',audit_status='review',updated_at=now() WHERE product_key=${p.product_key}`;
            results.push({productKey:p.product_key,status:'review',source:'obsbygg-item',matchedIdentifier:itemNo,reason:'Eksakt varenummertreff krever godkjenning'});continue;
          }
        }

        results.push({productKey:p.product_key,status:'not_found',reason:effectiveEan||itemNo?'Ingen eksakt match':'Mangler både EAN og varenummer'});
      }catch(e){results.push({productKey:p.product_key,status:'error',error:e instanceof Error?e.message:'Oppslag feilet'});}
    }

    const updated=results.filter(x=>x.status==='updated').length;
    return NextResponse.json({
      ok:true,checked:rows.length,updated,
      referenceUpdated:results.filter(x=>x.status==='updated'&&x.source==='reference').length,
      webUpdated:results.filter(x=>x.status==='updated'&&x.source==='obsbygg-ean').length,
      eanRecovered:results.filter(x=>x.eanRecovered).length,
      review:results.filter(x=>x.status==='review').length,
      notFound:results.filter(x=>x.status==='not_found').length,
      errors:results.filter(x=>x.status==='error').length,
      results
    });
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Synkronisering av Product Master feilet'},{status:500});}
}
