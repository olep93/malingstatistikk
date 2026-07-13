import { ensureSchema, sql } from './db';
import { catalogEntry } from '../product-catalog';

const decodeHtml = (s:string) => s
  .replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"')
  .replace(/&#x2F;/gi,'/').replace(/\\u0026/g,'&').replace(/\\\//g,'/');
const absolute = (href:string) => {
  if (!href) return '';
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('http')) return href;
  return `https://www.obsbygg.no${href.startsWith('/')?'':'/'}${href}`;
};
const headers={
  'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36',
  'accept-language':'nb-NO,nb;q=0.9,en;q=0.7',
  'accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'referer':'https://www.obsbygg.no/'
};

type Input={ean?:string; productName:string; productKey:string; supplier:string; size?:string};

async function persist(input:Input,imageUrl:string,source:string){
  const q=sql(); await ensureSchema();
  await q`INSERT INTO paint_products(product_key,display_name,supplier,size,ean,image_url,image_source,image_approved,updated_at)
    VALUES(${input.productKey},${input.productName},${input.supplier},${input.size||null},${input.ean||null},${imageUrl},${source},true,now())
    ON CONFLICT(product_key) DO UPDATE SET display_name=excluded.display_name,supplier=excluded.supplier,size=excluded.size,
      image_url=excluded.image_url,image_source=excluded.image_source,image_approved=true,
      ean=COALESCE(excluded.ean,paint_products.ean),updated_at=now()`;
}

function productLinks(html:string){
  const links=new Set<string>();
  const patterns=[
    /href=["']([^"']+\/\d{5,}(?:[?][^"']*)?)["']/gi,
    /"url"\s*:\s*"([^"]+\/\d{5,}[^"]*)"/gi,
    /"canonicalUrl"\s*:\s*"([^"]+)"/gi,
    /"productUrl"\s*:\s*"([^"]+)"/gi
  ];
  for(const rx of patterns) for(const m of html.matchAll(rx)){
    const href=decodeHtml(m[1]);
    if(/obsbygg\.no|^\//i.test(href)) links.add(absolute(href));
  }
  return [...links].filter(x=>/\/maling\//i.test(x)).slice(0,24);
}

function imageCandidates(html:string){
  const candidates:string[]=[];
  const add=(value?:string)=>{if(value){const url=absolute(decodeHtml(value));if(url && !url.endsWith('/'))candidates.push(url)}};
  const patterns=[
    /property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)/gi,
    /content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/gi,
    /name=["']twitter:image["'][^>]*content=["']([^"']+)/gi,
    /"image"\s*:\s*\[?\s*"([^"]+)"/gi,
    /"imageUrl"\s*:\s*"([^"]+)"/gi,
    /"url"\s*:\s*"([^"]*globalassets\/productimages\/[^"]+)"/gi,
    /(?:src|data-src)=["']([^"']*globalassets\/productimages\/[^"']+)["']/gi,
    /srcset=["']([^"']*globalassets\/productimages\/[^"']+)["']/gi
  ];
  for(const rx of patterns){for(const m of html.matchAll(rx)){
    const raw=m[1]?.split(',')[0]?.trim().split(/\s+/)[0]; add(raw);
  }}
  return [...new Set(candidates)].filter(u=>/^https?:\/\//i.test(u));
}

async function fetchProductPage(url:string){
  try{
    const page=await fetch(url,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(12000)});
    if(!page.ok)return null;
    const html=await page.text();
    const image=imageCandidates(html)[0];
    if(!image)return null;
    const title=decodeHtml(
      html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]
      ||html.match(/<title>([^<]+)/i)?.[1]||''
    );
    return {image,title};
  }catch{return null}
}

export async function findObsbyggImage(input:Input) {
  await ensureSchema();
  const q=sql();
  const existing=await q`SELECT image_url FROM paint_products WHERE product_key=${input.productKey} AND image_url IS NOT NULL LIMIT 1`;
  if(existing[0]?.image_url)return {found:true,imageUrl:existing[0].image_url,source:'database'};

  const known=catalogEntry(input.productName);
  if(known?.image){
    await persist(input,known.image,'product-catalog');
    return {found:true,imageUrl:known.image,url:known.pageUrl||'https://www.obsbygg.no',title:known.name,source:'catalog'};
  }
  if(known?.pageUrl){
    const exact=await fetchProductPage(known.pageUrl);
    if(exact){
      await persist(input,exact.image,known.pageUrl);
      return {found:true,imageUrl:exact.image,url:known.pageUrl,title:exact.title||known.name,source:'catalog-page'};
    }
  }

  const terms=[input.ean,`${input.productName} ${input.size||''}`.trim(),input.productName].filter(Boolean) as string[];
  for(const term of [...new Set(terms)]){
    const searchUrls=[
      `https://www.obsbygg.no/sok?q=${encodeURIComponent(term)}`,
      `https://www.obsbygg.no/sok?query=${encodeURIComponent(term)}`,
      `https://www.obsbygg.no/search?query=${encodeURIComponent(term)}`
    ];
    for(const searchUrl of searchUrls){
      let response:Response;
      try{response=await fetch(searchUrl,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(12000)});}catch{continue}
      if(!response.ok)continue;
      const html=await response.text();
      for(const url of productLinks(html)){
        const result=await fetchProductPage(url);
        if(!result)continue;
        await persist(input,result.image,url);
        return {found:true,imageUrl:result.image,url,title:result.title||input.productName,source:'search-page'};
      }
      // Category/search pages often contain the product image directly even when links are client-rendered.
      const direct=imageCandidates(html)[0];
      if(direct){
        await persist(input,direct,searchUrl);
        return {found:true,imageUrl:direct,url:searchUrl,title:input.productName,source:'search-html'};
      }
    }
  }
  return {found:false};
}
