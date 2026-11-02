import {normalizeCommercialSize,type ProductRow} from "./data";

function productEan(row:ProductRow){return String(row.ean||(/^\d{13}$/.test(row.itemNo)?row.itemNo:'')).trim()}
/** EAN-en produktoppslaget fant for et gammelt varenummer: produktlenken peker på varianten (?v=ObsBygg-<EAN>). */
function eanFromProductUrl(row:ProductRow){return String(row.productUrl||'').match(/ObsBygg-(\d{8,14})/)?.[1]||''}
/** Bare maling har baser som er samme vare. Malerverktøy og sparkel er ulike varer selv med likt navn. */
function isPaintProduct(row:ProductRow){return row.area!=='tools'&&row.subgroup!=='Sparkel'}
// Verktøy med ekte volum. Andre verktøy har fått literstørrelser fra tekst på produktsiden ("3 L" på ruller og tape).
const LIQUID_TOOL_TAGS=new Set(['Rensemidler','Rens & vask','Fugemasse & Kitt']);
function trustedSize(row:ProductRow){
 const size=String(row.size||'').trim();
 if(row.area!=='tools'||LIQUID_TOOL_TAGS.has(row.subgroup||''))return size;
 return /\d\s*(?:l|ml|liter)$/i.test(size)?'':size;
}
export function productSubtitle(row:ProductRow){
 const explicit=trustedSize(row);
 // Eldre importer kunne lagre generiske plassholdere i størrelsesfeltet.
 // De skal aldri vises som undertittel på produktkortet.
 if(explicit&&!/^(produkt|product|vare|artikkel|ukjent|n\/?a)$/i.test(explicit))return normalizeCommercialSize(explicit)||explicit;
 const source=`${row.rawName||''} ${row.product||''}`;
 if(row.area==='tools'){
  const dimensions=source.match(/(?:^|\s)((?:\d+(?:[.,]\d+)?\s*[x×]\s*)*\d+(?:[.,]\d+)?\s*(?:cm|mm)\b)/i)?.[1];
  if(dimensions)return dimensions.toLowerCase().replace(/\s*[x×]\s*/g,' × ').replace(/(\d)(cm|mm)\b/,'$1 $2').replace(/\s+/g,' ').trim();
  const ean=productEan(row);
  return ean?`EAN ${ean}`:row.itemNo?`Varenr. ${row.itemNo}`:'';
 }
 const match=source.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(ml|l|liter)\b/i);
 if(!match)return '';
 const raw=`${match[1]} ${match[2]}`;
 return normalizeCommercialSize(raw)||`${match[1].replace('.',',')} ${match[2].toLowerCase()==='ml'?'ml':'L'}`;
}
/**
 * Samme produkt kan komme som flere EAN-er (baser, gamle og nye varenummer) med litt ulike navn fra
 * Obsbygg ("kvist-og sperregrunn" / "Kvist og sperregrunning") og med eller uten størrelse. Kortene
 * samles derfor på leverandør, produktfamilie og størrelse; underkategorien er ikke en del av nøkkelen.
 * Malerverktøy må beholde EAN/varenummer: ulike bredder og pakninger kan ha identiske nettbutikk-navn.
 */
const FAMILY_STOP=new Set(["interiormaling","eksteriormaling","og","til","for","med"]);
function productFamily(product:string){
 return String(product||"").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ø/g,"o").replace(/æ/g,"ae").replace(/å/g,"a")
  .replace(/[^a-z0-9]+/g," ").split(" ").filter(word=>word&&!FAMILY_STOP.has(word))
  .map(word=>word.replace(/grunning$/,"grunn").replace(/maling$/,"mal")).join("-");
}
function displaySize(row:ProductRow){return normalizeCommercialSize(row.size||"")||productSubtitle(row)||""}
function displayProductKey(row:ProductRow,includeStore=true,oldItemEans?:Map<string,string>){
 if(!isPaintProduct(row)){
  // Samme vare kan ligge under gammelt varenummer (eldre importer) og EAN (nye importer).
  const ean=productEan(row)||oldItemEans?.get(row.itemNo)||'';
  const identity=ean?`ean-${ean}`:row.itemNo?`item-${row.itemNo}`:row.productKey||`${row.supplier}|${row.rawName||row.product}|${row.size}`;
  return [includeStore?row.storeId:'',row.area||'exterior','vare',identity].join('|');
 }
 return [includeStore?row.storeId:"",row.area||"exterior",row.supplier,productFamily(row.product),productFamily(displaySize(row))].join("|");
}
/** Gammelt varenummer til EAN, bare der EAN-en peker tilbake på ett eneste varenummer. Ellers er koblingen usikker. */
function oldItemEanMap(rows:ProductRow[]){
 const items=new Map<string,Set<string>>();
 for(const row of rows){
  if(isPaintProduct(row)||productEan(row)||!row.itemNo)continue;
  const ean=eanFromProductUrl(row);if(!ean)continue;
  const set=items.get(ean)||new Set<string>();set.add(row.itemNo);items.set(ean,set);
 }
 const map=new Map<string,string>();
 for(const [ean,set] of items)if(set.size===1)map.set([...set][0],ean);
 return map;
}
export function aggregateDisplayProducts(rows:ProductRow[],includeStore=true){
 const products=new Map<string,ProductRow>();
 const oldItemEans=oldItemEanMap(rows);
 const add=(key:string,row:ProductRow)=>{const current=products.get(key);
  if(!current){products.set(key,{...row,storeId:includeStore?row.storeId:"__all__",store:includeStore?row.store:"Hele Norge"});return}
  // Tag og navn følger varianten som selger mest.
  if(row.revenue>current.revenue){current.subgroup=row.subgroup||current.subgroup;current.product=row.product||current.product}
  current.quantity+=row.quantity;current.revenue+=row.revenue;current.profit+=row.profit;current.margin=current.revenue?current.profit/current.revenue*100:0;
  if(!current.size&&row.size)current.size=row.size;
  if(!current.ean&&row.ean)current.ean=row.ean;
  if(!current.image&&row.image){current.image=row.image;current.ean=row.ean||current.ean;current.itemNo=row.itemNo||current.itemNo;current.productKey=row.productKey||current.productKey}
  if(!current.productUrl&&row.productUrl)current.productUrl=row.productUrl;
 };
 // Varianter med størrelse samles først. Varianter uten størrelse plasseres hver for seg, så snittprisen
 // ikke blandes på tvers av størrelser.
 const unknown:{key:string;row:ProductRow}[]=[];
 for(const row of rows){const key=displayProductKey(row,includeStore,oldItemEans);if(!isPaintProduct(row)||displaySize(row))add(key,row);else unknown.push({key,row})}
 const unit=(item:ProductRow)=>item.quantity?item.revenue/item.quantity:0;
 for(const {key,row} of unknown){
  const family=key.replace(/\|[^|]*$/,"|");
  const siblings=[...products.keys()].filter(other=>other!==key&&other.startsWith(family)&&other!==family);
  // Én størrelse: legg den til der. Flere: velg den med nærmest lik stykkpris (innen ±25 %).
  const price=unit(row);
  const match=siblings.length===1?siblings[0]:price>0?siblings.map(other=>({other,ratio:unit(products.get(other)!)/price})).filter(x=>x.ratio>0.75&&x.ratio<1.33).sort((a,b)=>Math.abs(Math.log(a.ratio))-Math.abs(Math.log(b.ratio)))[0]?.other:undefined;
  if(match)add(match,{...row,size:products.get(match)!.size||row.size});else add(key,row);
 }
 return [...products.values()];
}
