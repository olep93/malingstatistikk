import { ensureSchema, sql } from './db';

const decodeHtml = (s:string) => s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\\u0026/g,'&').replace(/\\\//g,'/');
const absolute = (href:string) => href.startsWith('http') ? href : `https://www.obsbygg.no${href.startsWith('/')?'':'/'}${href}`;

export async function findObsbyggImage(input:{ean?:string; productName:string; productKey:string; supplier:string; size?:string}) {
  const terms = [input.ean, `${input.productName} ${input.size||''}`.trim()].filter(Boolean) as string[];
  for (const term of terms) {
    const searchUrl = `https://www.obsbygg.no/sok?q=${encodeURIComponent(term)}`;
    const response = await fetch(searchUrl,{headers:{'user-agent':'Mozilla/5.0 (compatible; Malingstatistikk/1.0)','accept-language':'nb-NO,nb;q=0.9'},cache:'no-store'});
    if (!response.ok) continue;
    const html = await response.text();
    const candidates = new Set<string>();
    for (const match of html.matchAll(/(?:href=|"url":)\s*["']([^"']+)["']/gi)) {
      const href = decodeHtml(match[1]);
      if (/\/maling\//i.test(href) && /\/\d{5,}(?:[?"'#]|$)/.test(href)) candidates.add(absolute(href.split('"')[0]));
    }
    for (const url of candidates) {
      const page = await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; Malingstatistikk/1.0)','accept-language':'nb-NO,nb;q=0.9'},cache:'no-store'});
      if (!page.ok) continue;
      const productHtml = await page.text();
      const image = productHtml.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1]
        || productHtml.match(/content=["']([^"']+)["'][^>]*property=["']og:image/i)?.[1]
        || productHtml.match(/"image"\s*:\s*\[?\s*"([^"]+)"/i)?.[1];
      const title = productHtml.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]
        || productHtml.match(/<title>([^<]+)/i)?.[1];
      if (!image) continue;
      const q = sql(); await ensureSchema();
      await q`INSERT INTO paint_products(product_key,display_name,supplier,size,ean,image_url,image_source,image_approved,updated_at)
        VALUES(${input.productKey},${input.productName},${input.supplier},${input.size||null},${input.ean||null},${decodeHtml(image)},${url},true,now())
        ON CONFLICT(product_key) DO UPDATE SET image_url=excluded.image_url,image_source=excluded.image_source,image_approved=true,ean=COALESCE(excluded.ean,paint_products.ean),updated_at=now()`;
      return {found:true,imageUrl:decodeHtml(image),url,title:decodeHtml(title||input.productName)};
    }
  }
  return {found:false};
}
