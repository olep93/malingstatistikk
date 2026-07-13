import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/auth';
import { ensureSchema, sql } from '@/lib/server/db';

function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"')}
export async function POST(req:Request){
 if(!(await isAdmin())) return NextResponse.json({error:'Ikke innlogget'},{status:401});
 try{
  const {ean,productName,productKey,supplier,size}=await req.json();
  const query=encodeURIComponent(ean || productName);
  const search=await fetch(`https://www.obsbygg.no/sok?q=${query}`,{headers:{'user-agent':'Mozilla/5.0'}});
  const html=await search.text();
  const hrefs=[...html.matchAll(/href=["']([^"']+)["']/g)].map(m=>decode(m[1])).filter(x=>x.includes('obsbygg.no')||x.startsWith('/'));
  const candidate=hrefs.find(x=>/\/(maling|trebeskyttelse|beis|grunning|interi)/i.test(x)) || hrefs.find(x=>/\/\d{5,}/.test(x));
  if(!candidate) return NextResponse.json({found:false});
  const url=candidate.startsWith('http')?candidate:`https://www.obsbygg.no${candidate}`;
  const page=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}}); const phtml=await page.text();
  const img=phtml.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] || phtml.match(/content=["']([^"']+)["'][^>]*property=["']og:image/i)?.[1];
  const title=phtml.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1];
  if(!img) return NextResponse.json({found:false,url});
  await ensureSchema(); const q=sql();
  await q`INSERT INTO paint_products(product_key,display_name,supplier,size,ean,image_url,image_source,image_approved,updated_at)
    VALUES(${productKey},${productName},${supplier},${size||null},${ean||null},${decode(img)},${url},false,now())
    ON CONFLICT(product_key) DO UPDATE SET image_url=excluded.image_url,image_source=excluded.image_source,ean=COALESCE(excluded.ean,paint_products.ean),updated_at=now()`;
  return NextResponse.json({found:true,imageUrl:decode(img),url,title:decode(title||productName)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bildeoppslag feilet'},{status:500})}
}
