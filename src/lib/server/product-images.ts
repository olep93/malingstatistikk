import { ensureSchema, sql } from './db';
import { catalogEntry } from '../product-catalog';

const NORMALIZATION_VERSION=2;
const decodeHtml=(s:string)=>s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&#x2F;/gi,'/').replace(/\\u0026/g,'&').replace(/\\\//g,'/');
const absolute=(href:string)=>!href?'':href.startsWith('//')?`https:${href}`:href.startsWith('http')?href:`https://www.obsbygg.no${href.startsWith('/')?'':'/'}${href}`;
const headers={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36','accept-language':'nb-NO,nb;q=0.9,en;q=0.7','accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8','referer':'https://www.obsbygg.no/'};
type Input={ean?:string;productName:string;productKey:string;supplier:string;size?:string;rawName?:string;area?:string;subgroup?:string};
type Result={found:boolean;imageUrl?:string;displayName?:string;websiteName?:string;url?:string;category?:string;subgroup?:string;source?:string;status?:string};
const cleanTitle=(title:string)=>decodeHtml(title).replace(/\s*[|–-]\s*Obs BYGG.*$/i,'').replace(/\s*\|\s*Coop.*$/i,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

function customerName(title:string,fallback:string,area?:string){
 const clean=cleanTitle(title||fallback)
  .replace(/\s+\d+(?:[.,]\d+)?\s*(?:l|liter|ml)\b/ig,'')
  .replace(/\s+(?:a|b|c|hvit|gul)\s*-?base\b/ig,'')
  .replace(/\s+/g,' ').trim();
 if(area==='exterior') return fallback;
 // For alle nye hovedområder brukes det kundevennlige navnet fra produktsiden.
 // Behold produktbetegnelser som "terrassebeis" og "gulvmaling" fordi de er
 // en viktig del av det faktiske produktnavnet.
 return clean || fallback;
}
function inferSubgroup(area:string|undefined,title:string,html:string,fallback?:string){
 if(area!=='terrace') return fallback;
 const text=`${title} ${html}`.toUpperCase();
 if(/TERRASSEMALING|MALING FOR TERRASSE|DEKKENDE TERRASSE/.test(text))return 'Terrassemaling';
 if(/OLJEBASERT|OLJEBASE|ALKYD|TYRILIN TERRASSEBEIS/.test(text))return 'Oljebasert';
 if(/VANNTYNNET|VANNBASERT|AKRYL/.test(text))return 'Vanntynnet';
 return fallback;
}

async function persist(input:Input,result:Result){
 const q=sql();await ensureSchema();
 const sourceName=input.rawName||input.productName;
 const websiteName=result.websiteName||result.displayName||null;
 const suggested=input.area==='exterior'?input.productName:(result.displayName||input.productName);
 await q`INSERT INTO paint_products(product_key,display_name,source_name,website_name,supplier,size,ean,image_url,image_source,product_url,category,subgroup,image_approved,aliases,lookup_status,last_fetched_at,normalization_version,updated_at)
 VALUES(${input.productKey},${suggested},${sourceName},${websiteName},${input.supplier},${input.size||null},${input.ean||null},${result.imageUrl||null},${result.source||result.url||'automatic'},${result.url||null},${result.category||null},${result.subgroup||input.subgroup||null},${Boolean(result.imageUrl)},${JSON.stringify([input.productName,input.rawName].filter(Boolean))}::jsonb,${result.found?'found':'not_found'},now(),${NORMALIZATION_VERSION},now())
 ON CONFLICT(product_key) DO UPDATE SET
 source_name=COALESCE(excluded.source_name,paint_products.source_name),website_name=COALESCE(excluded.website_name,paint_products.website_name),
 display_name=CASE WHEN paint_products.display_name_locked THEN paint_products.display_name ELSE excluded.display_name END,
 supplier=excluded.supplier,size=COALESCE(excluded.size,paint_products.size),image_url=COALESCE(excluded.image_url,paint_products.image_url),image_source=excluded.image_source,
 product_url=COALESCE(excluded.product_url,paint_products.product_url),category=COALESCE(excluded.category,paint_products.category),subgroup=COALESCE(excluded.subgroup,paint_products.subgroup),image_approved=paint_products.image_approved OR excluded.image_approved,
 ean=COALESCE(excluded.ean,paint_products.ean),aliases=(SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(paint_products.aliases || excluded.aliases) x),lookup_status=excluded.lookup_status,last_fetched_at=now(),normalization_version=${NORMALIZATION_VERSION},updated_at=now()`;
}
function productLinks(html:string){const links=new Set<string>();for(const rx of [/href=["']([^"']+\/\d{5,}(?:[?][^"']*)?)["']/gi,/"url"\s*:\s*"([^"]+\/\d{5,}[^"]*)"/gi,/"canonicalUrl"\s*:\s*"([^"]+)"/gi,/"productUrl"\s*:\s*"([^"]+)"/gi])for(const m of html.matchAll(rx)){const href=decodeHtml(m[1]);if(/obsbygg\.no|^\//i.test(href))links.add(absolute(href));}return [...links].filter(x=>/\/maling\//i.test(x)||/\/verktoy-og-tilbehor\//i.test(x)).slice(0,8);}
function images(html:string){const out:string[]=[];const add=(v?:string)=>{if(v){const u=absolute(decodeHtml(v.split(',')[0].trim().split(/\s+/)[0]));if(/^https?:\/\//.test(u))out.push(u)}};for(const rx of [/property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)/gi,/content=["']([^"']+)["'][^>]*property=["']og:image/gi,/"image"\s*:\s*\[?\s*"([^"]+)"/gi,/"imageUrl"\s*:\s*"([^"]+)"/gi,/(?:src|data-src)=["']([^"']*globalassets\/productimages\/[^"']+)["']/gi])for(const m of html.matchAll(rx))add(m[1]);return [...new Set(out)];}
async function fetchPage(url:string){try{const r=await fetch(url,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(14000)});if(!r.ok)return null;const html=await r.text();const image=images(html)[0];const title=cleanTitle(html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]||html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,' ')||html.match(/<title>([^<]+)/i)?.[1]||'');return title?{image,title,html}:null}catch{return null}}
function score(title:string,input:Input){const a=title.toUpperCase(),b=`${input.productName} ${input.rawName||''}`.toUpperCase();let n=0;for(const word of b.replace(/[^A-ZÆØÅ0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2))if(a.includes(word))n++;if(input.ean&&a.includes(input.ean))n+=8;if(input.size&&a.replace(/\s/g,'').includes(input.size.replace(/\s/g,'')))n+=2;return n;}

export async function findObsbyggImage(input:Input,opts:{force?:boolean}={}):Promise<Result>{
 await ensureSchema();const q=sql();
 const existing=await q`SELECT display_name,website_name,image_url,product_url,category,subgroup,lookup_status,last_fetched_at,normalization_version FROM paint_products WHERE product_key=${input.productKey} LIMIT 1`;
 const row:any=existing[0];const stale=!row?.last_fetched_at||Date.now()-new Date(row.last_fetched_at).getTime()>90*86400000;
 const outdated=(row?.normalization_version||0)<NORMALIZATION_VERSION;
 if(row&&!opts.force&&!stale&&!outdated){return {found:row.lookup_status==='found',imageUrl:row.image_url,displayName:row.display_name,websiteName:row.website_name,url:row.product_url,category:row.category,subgroup:row.subgroup,source:'database',status:row.lookup_status};}
 const known=catalogEntry(input.productName,input.rawName);
 if(known?.pageUrl){const page=await fetchPage(known.pageUrl);if(page){const subgroup=inferSubgroup(input.area,page.title,page.html,input.subgroup);const r={found:true,imageUrl:page.image||known.image,displayName:customerName(page.title,known.name,input.area),websiteName:page.title,url:known.pageUrl,category:known.category,subgroup,source:'catalog-page',status:'found'};await persist(input,r);return r;}}
 if(known?.image&&input.area==='exterior'){const r={found:true,imageUrl:known.image,displayName:known.name,websiteName:known.name,url:known.pageUrl,category:known.category,subgroup:input.subgroup,source:'catalog',status:'found'};await persist(input,r);return r;}
 const terms=[input.ean,`${input.productName} ${input.size||''}`,input.rawName].filter(Boolean) as string[];
 for(const term of [...new Set(terms)])for(const searchUrl of [`https://www.obsbygg.no/sok?q=${encodeURIComponent(term)}`,`https://www.obsbygg.no/sok?query=${encodeURIComponent(term)}`]){
  try{const r=await fetch(searchUrl,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(14000)});if(!r.ok)continue;const html=await r.text();const candidates=[] as {url:string;image?:string;title:string;html:string;score:number}[];for(const url of productLinks(html)){const page=await fetchPage(url);if(page)candidates.push({url,image:page.image,title:page.title,html:page.html,score:score(page.title,input)});}candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];if(best&&best.score>0){const websiteName=best.title;const subgroup=inferSubgroup(input.area,websiteName,best.html,input.subgroup);const result={found:true,imageUrl:best.image,displayName:customerName(websiteName,input.productName,input.area),websiteName,url:best.url,category:known?.category,subgroup,source:'obsbygg-search',status:'found'};await persist(input,result);return result;}}catch{}
 }
 const result={found:false,displayName:known?.name||input.productName,websiteName:undefined,category:known?.category,subgroup:input.subgroup,source:'obsbygg-search',status:'not_found'};await persist(input,result);return result;
}
