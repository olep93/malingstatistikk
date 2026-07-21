import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function GET(){
  if(!(await isAdmin()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{await ensureSchema();const q=sql();const products=await q`SELECT product_key,ean,source_name,website_name,display_name,display_name_locked,supplier,size,image_url,product_url,subgroup,lookup_status,last_fetched_at,updated_at FROM paint_products ORDER BY updated_at DESC LIMIT 500`;return NextResponse.json({products});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente produktregister'},{status:500})}
}
export async function PATCH(req:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{const {productKey,displayName}=await req.json();if(!productKey||!String(displayName||'').trim())return NextResponse.json({error:'Produktnøkkel og visningsnavn kreves'},{status:400});await ensureSchema();const q=sql();await q`UPDATE paint_products SET display_name=${String(displayName).trim()},display_name_locked=true,updated_at=now() WHERE product_key=${productKey}`;return NextResponse.json({ok:true});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke oppdatere produkt'},{status:500})}
}
