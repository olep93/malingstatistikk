import fs from 'node:fs/promises';

const origin=process.env.BACKFILL_ORIGIN||'https://malingstatistikk.vercel.app';
const token=process.env.BACKFILL_TOKEN;
if(!token)throw new Error('BACKFILL_TOKEN mangler');
const checkpoint='.product-backfill-checkpoint.json';
const headers={'x-backfill-token':token,'user-agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36','accept-language':'nb-NO,nb;q=0.9'};
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const digits=s=>String(s||'').replace(/\D/g,'');
const meta=(html,property)=>decode(html.match(new RegExp(`property=["']${property}["'][^>]*content=["']([^"']+)`,'i'))?.[1]||'');
const canonical=html=>decode(html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1]||meta(html,'og:url'));
const title=html=>meta(html,'og:title')||decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
const size=html=>{const text=decode(html);const m=text.match(/(?:Størrelse|Valgt størrelse)\s*(\d+(?:[.,]\d+)?)\s*(ml|l|liter)\b/i)||text.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|l|liter)\b/i);return m?`${m[1].replace('.',',')} ${m[2].toLowerCase()==='ml'?'ml':'L'}`:''};
const image=(html,ean)=>{const urls=[...html.matchAll(/https:\/\/www\.obsbygg\.no\/[^"'\s<]*globalassets\/productimages\/[^"'\s<]+/gi)].map(m=>decode(m[0]));return urls.find(u=>digits(u).includes(ean))||meta(html,'og:image')||urls[0]||''};
const links=html=>[...new Set([...html.matchAll(/href=["']([^"']+\/\d{5,}(?:\?[^"']*)?)["']/gi)].map(m=>new URL(decode(m[1]),'https://www.obsbygg.no').toString()))].slice(0,8);
async function fetchHtml(url){const r=await fetch(url,{headers,redirect:'follow',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return {html:await r.text(),url:r.url}}
async function enrich(p){
 const ean=digits(p.ean);if(!ean)return null;
 try{
  const search=await fetchHtml(`https://www.obsbygg.no/sok?q=${ean}`);const directUrl=canonical(search.html)||search.url;let pages=/^https:\/\/www\.obsbygg\.no\/.*\/\d{5,}(?:[?].*)?$/.test(directUrl)?[search]:[];
  if(!pages.length)for(const url of links(search.html)){try{pages.push(await fetchHtml(url))}catch{}}
  for(const page of pages){if(!page.html.includes(ean))continue;const websiteName=title(page.html),productUrl=canonical(page.html)||page.url;if(!websiteName||/^\d{6,14}$/.test(websiteName)||!/^https:\/\/www\.obsbygg\.no\/.*\/\d{5,}(?:[?].*)?$/.test(productUrl))continue;
   const placeholder=/^(?:ean|vare|varenr|produkt|ukjent)(?:[\s:#-]|$)|^\d{6,14}$/i.test(String(p.display_name||'').trim());
   return {productKey:p.product_key,ean,matchedIdentifier:ean,websiteName,displayName:placeholder?websiteName:p.display_name,imageUrl:image(page.html,ean),productUrl,size:size(page.html)};
  }
 }catch(e){return {error:e.message,productKey:p.product_key}}
 return null;
}
async function api(path,options={}){const r=await fetch(`${origin}${path}`,{...options,headers:{...headers,...options.headers}});if(!r.ok)throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);return r.json()}
let state={after:'',checked:0,found:0,updated:0,errors:0};try{state={...state,...JSON.parse(await fs.readFile(checkpoint,'utf8'))}}catch{}
while(true){
 const page=await api(`/api/internal/product-backfill?after=${encodeURIComponent(state.after)}`);if(!page.rows.length)break;
 for(let i=0;i<page.rows.length;i+=6){const batch=page.rows.slice(i,i+6);const enriched=await Promise.all(batch.map(enrich));const good=enriched.filter(x=>x&&!x.error);state.errors+=enriched.filter(x=>x?.error).length;state.checked+=batch.length;state.found+=good.length;
  if(good.length){const saved=await api('/api/internal/product-backfill',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({results:good})});state.updated+=saved.updated||0}
  state.after=batch.at(-1).product_key;await fs.writeFile(checkpoint,JSON.stringify(state,null,2));console.log(JSON.stringify(state));
 }
}
console.log('BACKFILL_DONE',JSON.stringify(state));
