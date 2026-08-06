import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {findObsbyggImage} from '@/lib/server/product-images';

const digits=(value:unknown)=>String(value??'').replace(/\D/g,'');

export async function POST(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan berike produkter.'},{status:403});
  try{
    const body=await req.json();
    const ean=digits(body?.ean);
    if(ean.length<6)return NextResponse.json({error:'Gyldig EAN/GTIN kreves.'},{status:400});
    const supplier=String(body?.supplier||'Øvrig');
    const area=String(body?.area||'');
    const subgroup=String(body?.subgroup||'');

    await ensureSchema();
    const q=sql();
    const cached=await q`SELECT ean,item_no,website_name,display_name,size,image_url,product_url,area,subgroup,lookup_method,matched_identifier,match_confidence
      FROM paint_products
      WHERE regexp_replace(COALESCE(ean,''),'[^0-9]','','g')=${ean}
        AND lookup_status='found'
      ORDER BY CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END, updated_at DESC
      LIMIT 1`;
    if(cached.length){
      const p:any=cached[0];
      return NextResponse.json({ok:true,found:true,cached:true,ean,name:p.website_name||p.display_name||`EAN ${ean}`,displayName:p.display_name||p.website_name||`EAN ${ean}`,size:p.size||null,imageUrl:p.image_url||null,productUrl:p.product_url||null,area:p.area||area,subgroup:p.subgroup||subgroup,matchMethod:p.lookup_method||'EXACT_EAN',matchedIdentifier:p.matched_identifier||ean,confidence:Number(p.match_confidence||100)});
    }

    const result=await findObsbyggImage({
      productKey:`national-test|ean|${ean}`,
      ean,
      itemNo:'',
      productName:`EAN ${ean}`,
      rawName:`EAN ${ean}`,
      supplier,
      area,
      subgroup
    },{force:true,persist:false,exactOnly:true});

    if(!result.found)return NextResponse.json({ok:true,found:false,cached:false,ean});
    return NextResponse.json({
      ok:true,found:true,cached:false,ean,
      name:result.websiteName||result.displayName||`EAN ${ean}`,
      displayName:result.displayName||result.websiteName||`EAN ${ean}`,
      size:result.size||null,
      imageUrl:result.imageUrl||null,
      productUrl:result.url||null,
      area,
      subgroup:result.subgroup||subgroup,
      matchMethod:result.matchMethod,
      matchedIdentifier:result.matchedIdentifier,
      confidence:result.confidence||0
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Produktberikelse feilet'},{status:500});
  }
}
