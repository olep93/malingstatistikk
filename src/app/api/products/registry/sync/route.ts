import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {findObsbyggImage} from '@/lib/server/product-images';

export const maxDuration=60;

export async function POST(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan synkronisere Product Master.'},{status:403});
  try{
    const body=await req.json();
    const productKeys=Array.isArray(body.productKeys)?body.productKeys.map(String).filter(Boolean).slice(0,10):[];
    if(!productKeys.length)return NextResponse.json({ok:true,checked:0,updated:0,notFound:0,errors:0,results:[]});
    await ensureSchema();
    const q=sql();
    const rows=await q`SELECT product_key,ean,item_no,source_name,display_name,supplier,size,area,subgroup
      FROM paint_products WHERE product_key=ANY(${productKeys}::text[]) AND merged_into IS NULL`;
    const results:any[]=[];
    for(const p of rows as any[]){
      if(!String(p.ean||'').trim()){
        results.push({productKey:p.product_key,status:'skipped',reason:'Mangler EAN'});
        continue;
      }
      try{
        const result=await findObsbyggImage({
          productKey:p.product_key,
          ean:String(p.ean||''),
          itemNo:'',
          productName:p.display_name||p.source_name||'Ukjent produkt',
          rawName:p.source_name||'',
          supplier:p.supplier||'Ukjent',
          size:p.size||'',
          area:p.area||'',
          subgroup:p.subgroup||''
        },{force:true,persist:true,exactOnly:true});
        const exactEan=result.found&&result.matchMethod==='EXACT_EAN'&&String(result.matchedIdentifier||'').replace(/\D/g,'')===String(p.ean||'').replace(/\D/g,'');
        if(exactEan)results.push({productKey:p.product_key,status:'updated',matchedIdentifier:result.matchedIdentifier});
        else results.push({productKey:p.product_key,status:'not_found'});
      }catch(e){results.push({productKey:p.product_key,status:'error',error:e instanceof Error?e.message:'Oppslag feilet'});}
    }
    return NextResponse.json({ok:true,checked:rows.length,updated:results.filter(x=>x.status==='updated').length,notFound:results.filter(x=>x.status==='not_found'||x.status==='skipped').length,errors:results.filter(x=>x.status==='error').length,results});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Synkronisering av Product Master feilet'},{status:500});}
}
