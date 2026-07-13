import { ensureSchema, sql } from './db';
import { catalogEntry } from '../product-catalog';

const decodeHtml = (s:string) => s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\\u0026/g,'&').replace(/\\\//g,'/');
const absolute = (href:string) => href.startsWith('http') ? href : `https://www.obsbygg.no${href.startsWith('/')?'':'/'}${href}`;
const headers={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36','accept-language':'nb-NO,nb;q=0.9,en;q=0.7','accept':'text/html,application/xhtml+xml'};

async function persist(input:{ean?:string; productName:string; productKey:string; supplier:string; size?:string},imageUrl:string,source:string){
  const q=sql(); await ensureSchema();
  await q`INSERT INTO paint_products(product_key,display_name,supplier,size,ean,image_url,image_source,image_approved,updated_at)
    VALUES(${input.productKey},${input.productName},${input.supplier},${input.size||null},${input.ean||null},${imageUrl},${source},true,now())
    ON CONFLICT(product_key) DO UPDATE SET image_url=excluded.image_url,image_source=excluded.image_source,image_approved=true,ean=COALESCE(excluded.ean,paint_products.ean),updated_at=now()`;
}

function productLinks(html:string){
  const links=new Set<string>();
  const patterns=[/href=["']([^"']+\/\d{5,}(?:[?][^"']*)?)["']/gi,/"url"\s*:\s*"([^"]+\/\d{5,}[^"]*)"/gi,/"canonicalUrl"\s*:\s*"([^"]+)"/gi];
  for(const rx of patterns) for(const m of html.matchAll(rx)){const href=decodeHtml(m[1]);if(/obsbygg\.no|^\//i.test(href))links.add(absolute(href));}
  return [...links].filter(x=>/\/maling\//i.test(x)).slice(0,12);
}
function pageImage(html:string){
  return decodeHtml(html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image/i)?.[1]
    || html.match(/"image"\s*:\s*\[?\s*"([^"]+)"/i)?.[1]
    || html.match(/"imageUrl"\s*:\s*"([^"]+)"/i)?.[1] || '');
}

export async function findObsbyggImage(input:{ean?:string; productName:string; productKey:string; supplier:string; size?:string}) {
  const known=catalogEntry(input.productName);
  if(known?.image){await persist(input,known.image,'Bildeoversikt');return {found:true,imageUrl:known.image,url:'https://www.obsbygg.no',title:known.name,source:'catalog'};}
  const terms=[input.ean,`${input.productName} ${input.size||''}`.trim(),input.productName].filter(Boolean) as string[];
  for(const term of [...new Set(terms)]){
    const searchUrls=[`https://www.obsbygg.no/sok?q=${encodeURIComponent(term)}`,`https://www.obsbygg.no/search?query=${encodeURIComponent(term)}`];
    for(const searchUrl of searchUrls){
      let response:Response;try{response=await fetch(searchUrl,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(12000)});}catch{continue}
      if(!response.ok)continue;const html=await response.text();
      const direct=pageImage(html);if(direct&&/productimages|obsbygg/i.test(direct)){await persist(input,direct,searchUrl);return {found:true,imageUrl:direct,url:searchUrl,title:input.productName,source:'search'};}
      for(const url of productLinks(html)){
        let page:Response;try{page=await fetch(url,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(12000)});}catch{continue}
        if(!page.ok)continue;const productHtml=await page.text();const image=pageImage(productHtml);if(!image)continue;
        const title=decodeHtml(productHtml.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]||productHtml.match(/<title>([^<]+)/i)?.[1]||input.productName);
        await persist(input,image,url);return {found:true,imageUrl:image,url,title,source:'page'};
      }
    }
  }
  return {found:false};
}
