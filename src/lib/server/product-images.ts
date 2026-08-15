import { ensureSchema, sql } from './db';
import { catalogEntry } from '../product-catalog';
import { cleanProductName, decodeHtmlEntities } from '../text';
import { normalizeCommercialSize } from '../data';
import { productReference } from '../product-reference';

const NORMALIZATION_VERSION=10;
const decodeHtml=(s:string)=>decodeHtmlEntities(s);
const absolute=(href:string)=>{const clean=String(href||'').replace(/\\u002[fF]/g,'/').replace(/\\\//g,'/');return !clean?'':clean.startsWith('//')?`https:${clean}`:clean.startsWith('http')?clean:`https://www.obsbygg.no${clean.startsWith('/')?'':'/'}${clean}`};
const headers={'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36','accept-language':'nb-NO,nb;q=0.9,en;q=0.7','accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8','referer':'https://www.obsbygg.no/'};
type Input={ean?:string;itemNo?:string;productName:string;productKey:string;supplier:string;size?:string;rawName?:string;area?:string;subgroup?:string};
type Result={found:boolean;imageUrl?:string;displayName?:string;websiteName?:string;size?:string;url?:string;category?:string;subgroup?:string;source?:string;status?:string;matchMethod?:'EXACT_EAN'|'EXACT_ITEM_NO'|'CATALOG'|'NONE';matchedIdentifier?:string;confidence?:number};
const cleanTitle=(title:string)=>cleanProductName(title);

function validSize(value?:string){
 const clean=String(value||'').trim();
 return clean&&!/^(produkt|product|vare|artikkel|ukjent|n\/?a)$/i.test(clean)?clean:undefined;
}

function extractSize(...values:(string|undefined)[]){
 const text=values.filter(Boolean).join(' ');
 const match=text.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(ml|l|liter)\b/i);
 if(!match)return undefined;
 const amount=match[1].replace('.',',');
 const unit=match[2].toLowerCase()==='ml'?'ml':'L';
 return unit==='L'?normalizeCommercialSize(`${amount} L`):`${amount} ml`;
}

function customerName(title:string,fallback:string,area?:string){
 const clean=cleanTitle(title||fallback)
  .replace(/\s+\d+(?:[.,]\d+)?\s*(?:l|liter|ml)\b/ig,'')
  .replace(/\s+(?:a|b|c|hvit|gul)\s*-?base\b/ig,'')
  .replace(/\s+/g,' ').trim();
 // Eksteriør beholdt historisk navnet fra Excel. Det er riktig når Excel har
 // et faktisk produktnavn, men nye BI-eksporter kan bare inneholde "EAN 123…".
 // Da må det validerte navnet fra Obsbygg brukes.
 const placeholder=/^(?:ean|vare|varenr|produkt|ukjent)(?:[\s:#-]|$)|^\d{6,14}$/i.test(String(fallback||'').trim());
 if(area==='exterior'&&!placeholder) return fallback;
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

function digits(value?:string){return String(value||'').replace(/\D/g,'')}
function identifiersFromPage(url:string,html:string){
 const found=new Set<string>();
 const add=(v?:string)=>{const d=digits(v);if(d.length>=6)found.add(d)};
 for(const m of url.matchAll(/(?:ObsBygg-|[?&](?:v|variant|ean|sku)=)(\d{6,14})/gi))add(m[1]);
 for(const rx of [/(?:ean|gtin|sku|productNumber|itemNumber|varenummer|artikkelnummer)["'\s:=\\]+(?:ObsBygg-)?(\d{6,14})/gi,/ObsBygg-(\d{6,14})/gi])for(const m of html.matchAll(rx))add(m[1]);
 return found;
}
function exactMatch(url:string,html:string,input:Input){
 const ids=identifiersFromPage(url,html);
 const ean=digits(input.ean),itemNo=digits(input.itemNo);
 if(ean&&ids.has(ean))return {method:'EXACT_EAN' as const,identifier:ean};
 if(itemNo&&ids.has(itemNo))return {method:'EXACT_ITEM_NO' as const,identifier:itemNo};
 return null;
}
async function persist(input:Input,result:Result){
 const q=sql();await ensureSchema();
 const sourceName=input.rawName||input.productName;
 const websiteName=result.websiteName||result.displayName||null;
 const suggested=input.area==='exterior'?input.productName:(result.displayName||input.productName);
 const normalizedSize=normalizeCommercialSize(validSize(result.size)||validSize(input.size)||'');
 await q`INSERT INTO paint_products(product_key,display_name,source_name,website_name,supplier,size,raw_size,normalized_size,variant_id,ean,item_no,image_url,image_source,product_url,category,subgroup,image_approved,aliases,lookup_status,last_fetched_at,normalization_version,area,updated_at,lookup_method,matched_identifier,match_confidence,review_reason,audit_status)
 VALUES(${input.productKey},${suggested},${sourceName},${websiteName},${input.supplier},${normalizedSize||null},${validSize(result.size)||validSize(input.size)||null},${normalizedSize||null},${result.matchedIdentifier||input.ean||null},${input.ean||null},${input.itemNo||null},${result.imageUrl||null},${result.source||result.url||'automatic'},${result.url||null},${result.category||null},${result.subgroup||input.subgroup||null},${Boolean(result.imageUrl)},${JSON.stringify([input.productName,input.rawName].filter(Boolean))}::jsonb,${result.found?'found':result.status||'not_found'},now(),${NORMALIZATION_VERSION},${input.area||null},now(),${result.matchMethod||'NONE'},${result.matchedIdentifier||null},${result.confidence||0},${result.found?null:'Ingen eksakt nummermatch på Obsbygg.no'},${result.found?'ok':'review'})
 ON CONFLICT(product_key) DO UPDATE SET
 source_name=COALESCE(excluded.source_name,paint_products.source_name),
 website_name=CASE WHEN excluded.lookup_status='found' THEN COALESCE(NULLIF(excluded.website_name,''),paint_products.website_name) ELSE paint_products.website_name END,
 display_name=CASE WHEN paint_products.display_name_locked OR excluded.lookup_status<>'found' THEN paint_products.display_name ELSE COALESCE(NULLIF(excluded.display_name,''),paint_products.display_name) END,
 supplier=COALESCE(NULLIF(excluded.supplier,''),paint_products.supplier),size=COALESCE(NULLIF(excluded.size,''),NULLIF(CASE WHEN lower(trim(paint_products.size)) IN ('produkt','product','vare','artikkel','ukjent','n/a') THEN NULL ELSE paint_products.size END,'')),
 raw_size=COALESCE(NULLIF(excluded.raw_size,''),paint_products.raw_size),normalized_size=COALESCE(NULLIF(excluded.normalized_size,''),paint_products.normalized_size),variant_id=COALESCE(NULLIF(excluded.variant_id,''),paint_products.variant_id),
 image_url=CASE WHEN excluded.lookup_status='found' THEN CASE
   WHEN paint_products.image_url LIKE '%blob.vercel-storage.com/%' THEN paint_products.image_url
   ELSE excluded.image_url END ELSE paint_products.image_url END,
 image_source=CASE WHEN excluded.lookup_status='found' THEN CASE
   WHEN paint_products.image_url LIKE '%blob.vercel-storage.com/%' THEN paint_products.image_source
   ELSE NULLIF(excluded.image_source,'') END ELSE paint_products.image_source END,
 product_url=CASE WHEN excluded.lookup_status='found' THEN COALESCE(NULLIF(excluded.product_url,''),paint_products.product_url) ELSE paint_products.product_url END,
 category=CASE WHEN excluded.lookup_status='found' THEN COALESCE(excluded.category,paint_products.category) ELSE paint_products.category END,
 subgroup=CASE WHEN paint_products.subgroup_locked OR excluded.lookup_status<>'found' THEN paint_products.subgroup ELSE COALESCE(excluded.subgroup,paint_products.subgroup) END,
 image_approved=CASE WHEN paint_products.image_url LIKE '%blob.vercel-storage.com/%' THEN paint_products.image_approved ELSE (excluded.lookup_status='found' AND excluded.image_approved) END,
 ean=COALESCE(excluded.ean,paint_products.ean),item_no=COALESCE(excluded.item_no,paint_products.item_no),aliases=(SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(paint_products.aliases || excluded.aliases) x),
 lookup_status=excluded.lookup_status,last_fetched_at=now(),normalization_version=${NORMALIZATION_VERSION},area=COALESCE(excluded.area,paint_products.area),updated_at=now(),
 lookup_method=excluded.lookup_method,matched_identifier=excluded.matched_identifier,match_confidence=excluded.match_confidence,
 review_reason=excluded.review_reason,audit_status=excluded.audit_status`;
}

function productLinks(html:string){const links=new Set<string>();for(const rx of [/href=["']([^"']+\/\d{5,}(?:[?][^"']*)?)["']/gi,/(?:property=["']og:url["'][^>]*content|rel=["']canonical["'][^>]*href)=["']([^"']+)/gi,/"url"\s*:\s*"([^"]+\/\d{5,}[^"]*)"/gi,/"canonicalUrl"\s*:\s*"([^"]+)"/gi,/"productUrl"\s*:\s*"([^"]+)"/gi])for(const m of html.matchAll(rx)){const href=decodeHtml(m[1]);if(/obsbygg\.no|^\//i.test(href))links.add(absolute(href));}return [...links].slice(0,12);}
function images(html:string){const out:string[]=[];const add=(v?:string)=>{if(v){const u=absolute(decodeHtml(v.split(',')[0].trim().split(/\s+/)[0]));if(/^https?:\/\//.test(u))out.push(u)}};for(const rx of [/property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)/gi,/content=["']([^"']+)["'][^>]*property=["']og:image/gi,/"image"\s*:\s*\[?\s*"([^"]+)"/gi,/"imageUrl"\s*:\s*"([^"]+)"/gi,/(?:src|data-src)=["']([^"']*globalassets\/productimages\/[^"']+)["']/gi])for(const m of html.matchAll(rx))add(m[1]);return [...new Set(out)];}
function normalizeSize(value?:string){return String(value||'').toLocaleLowerCase('nb-NO').replace(/,/g,'.').replace(/\s+/g,'').replace(/liter/g,'l')}
function variantUrl(url:string,ean?:string){const id=digits(ean);if(!id)return url;try{const parsed=new URL(url);parsed.searchParams.set('v',`ObsBygg-${id}`);return parsed.toString()}catch{return url}}
function balancedObjectAround(html:string,index:number){
 // Variantdata ligger normalt i serialisert JSON. Finn det minste JSON-objektet
 // rundt identifikatoren i stedet for å lese hele siden med standardbildet.
 let start=-1,depth=0,inString=false,escaped=false;
 for(let i=index;i>=0;i--){
  const c=html[i];
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue;}
  if(c==='"'){inString=true;continue;}
  if(c==='}')depth++;
  else if(c==='{'){if(depth===0){start=i;break;}depth--;}
 }
 if(start<0)return '';
 depth=0;inString=false;escaped=false;
 for(let i=start;i<html.length;i++){
  const c=html[i];
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;continue;}
  if(c==='"'){inString=true;continue;}
  if(c==='{')depth++;
  else if(c==='}'&&--depth===0)return html.slice(start,i+1);
 }
 return '';
}
function variantObjectForIdentifier(html:string,identifier:string){
 if(!identifier)return '';
 let from=0;
 while(from<html.length){
  const index=html.indexOf(identifier,from);if(index<0)break;
  const object=balancedObjectAround(html,index);
  if(object&&object.length<250000&&images(object).length)return object;
  from=index+identifier.length;
 }
 return '';
}
function sizeFromVariantObject(html:string,identifier:string){
 // Obsbygg serialiserer hver variant med eksakt EAN og størrelse. Les feltet
 // rett etter identifikatoren før vi forsøker den mer tolerante objektleseren.
 // Produktsidens tittel beskriver ofte standardvarianten og er ikke en sikker kilde.
 const escaped=identifier.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const exact=html.match(new RegExp(`(?:sku|code|ean|gtin)["'\\s:=\\-]+(?:ObsBygg-)?${escaped}[\\s\\S]{0,1800}?(?:size|størrelse|volume|volum)["'\\s:=]+(\\d+(?:[.,]\\d+)?)\\s*(ml|l|liter)\\b`,'i'));
 if(exact)return extractSize(`${exact[1]} ${exact[2]}`);
 const object=variantObjectForIdentifier(html,identifier);
 if(!object)return undefined;
 const labelled=object.match(/(?:size|størrelse|volume|volum|label|value)["'\\\s:=]+(\d+(?:[.,]\d+)?)\s*(ml|l|liter)\b/i);
 if(labelled)return extractSize(`${labelled[1]} ${labelled[2]}`);
 return extractSize(object);
}
function imageFromIdentifierWindow(html:string,identifier:string){
 if(!identifier)return undefined;
 const object=variantObjectForIdentifier(html,identifier);
 if(object){
  const candidates=images(object);
  // Bildets filnavn trenger ikke inneholde EAN. Det avgjørende er at bildet
  // ligger i samme variantobjekt som identifikatoren.
  if(candidates.length)return candidates[0];
 }
 return undefined;
}
function imageNearSize(html:string,size:string){
 if(!size)return undefined;
 const lower=html.toLocaleLowerCase('nb-NO');
 const numeric=size.replace(/l$/,'');
 const tokens=[size,size.replace('.',','),`${numeric} l`,`${numeric.replace('.',',')} l`,`${numeric}l`,`${numeric.replace('.',',')}l`];
 for(const token of [...new Set(tokens)]){
  let from=0;
  while(from<lower.length){
   const idx=lower.indexOf(token,from);if(idx<0)break;
   const object=balancedObjectAround(html,idx);
   if(object&&object.length<250000){const candidates=images(object);if(candidates[0])return candidates[0];}
   from=idx+token.length;
  }
 }
 return undefined;
}
function verifiedSiblingVariantImage(html:string,input:Input){
 const expected=normalizeCommercialSize(input.size||extractSize(input.rawName,input.productName)||'');
 if(!expected)return undefined;
 for(const image of images(html)){
  const siblingEan=eanFromImageUrl(image);
  if(!siblingEan||siblingEan===digits(input.ean))continue;
  const siblingSize=normalizeCommercialSize(sizeFromVariantObject(html,siblingEan)||'');
  if(siblingSize&&siblingSize===expected)return image;
 }
 return undefined;
}
function eanFromImageUrl(url?:string){
 const values=String(url||'').match(/\d{13}/g)||[];
 return values.find(v=>/^(?:70|73|50|57|64|87)/.test(v))||values[0];
}
function chooseVariantImage(html:string,input:Input,matchedIdentifier?:string){
 const all=images(html);if(!all.length)return undefined;
 const ean=digits(input.ean),matched=digits(matchedIdentifier),size=normalizeSize(input.size);
 // EAN/variantobjekt er eneste sikre automatiske kilde. Bildenummeret i URL-en
 // er ofte et internt assetnummer og vil derfor normalt ikke inneholde EAN.
 const exactEan=ean?all.find(url=>digits(url).includes(ean)):undefined;if(exactEan)return exactEan;
 const exactMatched=matched?all.find(url=>digits(url).includes(matched)):undefined;if(exactMatched)return exactMatched;
 const nearEan=imageFromIdentifierWindow(html,ean);if(nearEan)return nearEan;
 const nearMatched=imageFromIdentifierWindow(html,matched);if(nearMatched)return nearMatched;
 const sizeImage=imageNearSize(html,size);if(sizeImage)return sizeImage;
 const siblingImage=verifiedSiblingVariantImage(html,input);if(siblingImage)return siblingImage;
 // Ikke lagre sidens og:image som korrekt variant når siden har flere varianter.
 // Da er manglende bilde bedre enn et dokumentert feil bilde.
 if((ean||matched)&&identifiersFromPage('',html).size>1)return undefined;
 return all[0];
}
async function fetchPage(url:string,input?:Input,matchedIdentifier?:string){try{const r=await fetch(url,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(7000)});if(!r.ok)return null;const html=await r.text();const image=input?chooseVariantImage(html,input,matchedIdentifier):images(html)[0];const title=cleanTitle(html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]||html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,' ')||html.match(/<title>([^<]+)/i)?.[1]||'');return title?{image,title,html}:null}catch{return null}}
function score(title:string,input:Input){const a=title.toUpperCase(),b=`${input.productName} ${input.rawName||''}`.toUpperCase();let n=0;for(const word of b.replace(/[^A-ZÆØÅ0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2))if(a.includes(word))n++;if(input.ean&&a.includes(input.ean))n+=8;if(input.size&&a.replace(/\s/g,'').includes(input.size.replace(/\s/g,'')))n+=2;return n;}

export async function findObsbyggImage(input:Input,opts:{force?:boolean;persist?:boolean;exactOnly?:boolean}={}):Promise<Result>{
 await ensureSchema();const q=sql();
 const existing=await q`SELECT display_name,website_name,size,image_url,product_url,category,subgroup,lookup_status,last_fetched_at,normalization_version FROM paint_products WHERE product_key=${input.productKey} LIMIT 1`;
 const row:any=existing[0];const stale=!row?.last_fetched_at||Date.now()-new Date(row.last_fetched_at).getTime()>90*86400000;
 const outdated=(row?.normalization_version||0)<NORMALIZATION_VERSION;
 // En tidligere variantkontroll kan ha fjernet et feil bilde, samtidig som
 // produktet fortsatt står som "found". Det er ikke en komplett cachepost:
 // gjør ett nytt eksakt oppslag slik at kortet kan reparere seg selv.
 if(row&&!opts.force&&!stale&&!outdated&&(row.lookup_status!=='found'||row.image_url)){return {found:row.lookup_status==='found',imageUrl:row.image_url,displayName:row.display_name,websiteName:row.website_name,size:row.size,url:row.product_url,category:row.category,subgroup:row.subgroup,source:'database',status:row.lookup_status};}
 const shouldPersist=opts.persist!==false;
 const reference=productReference(digits(input.ean))||productReference(digits(input.itemNo));
 const authoritativeSize=normalizeCommercialSize(reference?.size||extractSize(input.rawName||'')||input.size||'');
 const known=opts.exactOnly?undefined:catalogEntry(input.productName,input.rawName);
 if(known?.pageUrl){const page=await fetchPage(known.pageUrl);if(page){const subgroup=inferSubgroup(input.area,page.title,page.html,input.subgroup);const r:Result={found:true,imageUrl:page.image||known.image,displayName:customerName(page.title,known.name,input.area),websiteName:page.title,size:extractSize(page.title,input.rawName,input.size),url:known.pageUrl,category:known.category,subgroup,source:'catalog-page',status:'found',matchMethod:'CATALOG',matchedIdentifier:digits(input.ean)||undefined,confidence:100};if(shouldPersist)await persist(input,r);return r;}}
 if(known?.image&&input.area==='exterior'){const r:Result={found:true,imageUrl:known.image,displayName:known.name,websiteName:known.name,size:extractSize(input.rawName,input.size),url:known.pageUrl,category:known.category,subgroup:input.subgroup,source:'catalog',status:'found',matchMethod:'CATALOG',matchedIdentifier:digits(input.ean)||undefined,confidence:100};if(shouldPersist)await persist(input,r);return r;}
 const terms=[digits(input.ean),digits(input.itemNo)].filter(Boolean) as string[];
 for(const term of [...new Set(terms)].slice(0,2)){
  const searchUrl=`https://www.obsbygg.no/sok?q=${encodeURIComponent(term)}`;
  try{const r=await fetch(searchUrl,{headers,cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(7000)});if(!r.ok)continue;const html=await r.text();const directTitle=cleanTitle(html.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]||html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,' ')||'');const directMatch=exactMatch(r.url,html,input);const directImage=directMatch?chooseVariantImage(html,input,directMatch.identifier):undefined;if(directMatch?.method==='EXACT_EAN'&&directImage){const exactLink=productLinks(html).find(url=>url.includes(directMatch.identifier));const exactUrl=variantUrl(exactLink||r.url,directMatch.identifier);const websiteName=reference?.name||input.productName||directTitle;const subgroup=inferSubgroup(input.area,websiteName,html,input.subgroup);const result:Result={found:true,imageUrl:directImage,displayName:reference?.name||input.productName,websiteName,size:authoritativeSize||sizeFromVariantObject(html,directMatch.identifier),url:exactUrl,category:reference?.category||known?.category,subgroup,source:eanFromImageUrl(directImage)&&eanFromImageUrl(directImage)!==digits(input.ean)?'obsbygg-validated-sibling-size':'obsbygg-exact-search-result',status:'found',matchMethod:'EXACT_EAN',matchedIdentifier:directMatch.identifier,confidence:100};if(shouldPersist)await persist(input,result);return result;}const direct=directTitle&&directMatch?{url:r.url,image:directImage,title:directTitle,html,score:score(directTitle,input)}:null;const urls=productLinks(html).filter(url=>url!==r.url);const pages=await Promise.all(urls.map(async url=>{const page=await fetchPage(url);return page?{url,image:page.image,title:page.title,html:page.html,score:score(page.title,input)}:null}));const candidates=[direct,...pages].filter(Boolean) as {url:string;image?:string;title:string;html:string;score:number}[];candidates.sort((a,b)=>b.score-a.score);for(const candidate of candidates){const match=exactMatch(candidate.url,candidate.html,input);if(!match)continue;const initialImage=chooseVariantImage(candidate.html,input,match.identifier);const variantEan=match.method==='EXACT_EAN'?match.identifier:eanFromImageUrl(initialImage);const exactUrl=variantEan?variantUrl(candidate.url,variantEan):candidate.url;const variantPage=exactUrl!==candidate.url?await fetchPage(exactUrl,input,variantEan||match.identifier):null;const page=variantPage||candidate;const image=chooseVariantImage(page.html,{...input,ean:input.ean||variantEan},variantEan||match.identifier)||initialImage;const websiteName=page.title;const subgroup=inferSubgroup(input.area,websiteName,page.html,input.subgroup);const result:Result={found:true,imageUrl:image,displayName:customerName(websiteName,input.productName,input.area),websiteName,size:authoritativeSize||sizeFromVariantObject(page.html,match.identifier)||extractSize(websiteName),url:exactUrl,category:known?.category,subgroup,source:eanFromImageUrl(image)&&eanFromImageUrl(image)!==digits(input.ean)?'obsbygg-validated-sibling-size':'obsbygg-exact-variant',status:'found',matchMethod:match.method,matchedIdentifier:match.identifier,confidence:image?100:90};if(shouldPersist)await persist(input,result);return result;}}catch{}
 }
 const result:Result={found:false,displayName:known?.name||input.productName,websiteName:undefined,size:extractSize(input.rawName,input.productName,input.size),category:known?.category,subgroup:input.subgroup,source:'obsbygg-exact-search',status:'needs_review',matchMethod:'NONE',confidence:0};if(shouldPersist)await persist(input,result);return result;
}
