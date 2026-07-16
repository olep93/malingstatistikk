import {catalogEntry} from "./product-catalog";
import {productReference} from "./product-reference";

export type Supplier = "Infra"|"Butinox"|"Jotun";
export type Period = "Dag"|"Uke"|"Måned"|"Hittil i år"|"År";
export type ProductCategory = "Maling / Dekkbeis / Beis"|"Vindu / Dør"|"Murmaling"|"Annet";
export type ProductRow={storeId:string;store:string;itemNo:string;rawName:string;product:string;productKey?:string;productUrl?:string;size:string;supplier:Supplier;category?:ProductCategory;quantity:number;revenue:number;profit:number;margin:number;image?:string};
export type SourceTotal={storeId:string;store:string;quantity:number;revenue:number;profit:number;margin:number};
export type DailyReport={date:string;createdAt:string;sourceName:string;rows:ProductRow[];sourceTotals?:SourceTotal[]};

export const supplierFromVendor=(vendor:string):Supplier|undefined=>{
  const v=(vendor||"").toUpperCase();
  if(v.includes("GJØCO")) return "Infra";
  if(v.includes("SCANOX")) return "Butinox";
  if(v.includes("JOTUN")) return "Jotun";
};

const titleCase=(value:string)=>value.toLowerCase().replace(/(^|\s|\/|-)\S/g,c=>c.toUpperCase())
  .replace(/\bBx\b/g,"Butinox").replace(/\bDryg\b/g,"Drygolin");

export const normalizeSize=(name:string)=>{
  const m=(name||"").toUpperCase().match(/(\d+(?:[,.]\d+)?)\s*(?:L|LITER)\b/);
  if(!m)return "";
  let value=Number(m[1].replace(",","."));
  // 3 L og 2,7 L er samme kommersielle spannstørrelse i rapporteringen.
  if(Math.abs(value-3)<0.01||Math.abs(value-2.7)<0.01)value=2.7;
  const shown=Number.isInteger(value)?String(value):String(value).replace(".",",");
  return `${shown} L`;
};

const canonicalSlug=(value:string)=>value.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/æ/g,"ae").replace(/ø/g,"o").replace(/å/g,"a")
  .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export const categoryForProduct=(product:string,rawName=""):ProductCategory=>{
  const n=`${product} ${rawName}`.toUpperCase();
  if(/MUR|FASADE.*MUR|BETONG|SOKKEL|GRUNNMUR/.test(n)) return "Murmaling";
  if(/VINDU|DØR|DOR|D[&/]V|D\/VINDU|TREVERK.*VIND|VINDUS|DØRMALING/.test(n)) return "Vindu / Dør";
  if(/MALING|DEKKB|DEKKBEIS|BEIS|OLJEMALING|OLJEBEIS|GRUNNING|TAKSITT|TAKSTEIN|SUPERIOR|NORDLYS|RESIDENCE|FUTURA|DRYGOLIN|OPTIMAL|POWER CLEAN|VISIR|TREBITT|TYRILIN|BENAR/.test(n)) return "Maling / Dekkbeis / Beis";
  return "Annet";
};

export const normalizeProduct=(raw:string,itemNo?:string)=>{
  const reference=productReference(itemNo);
  if(reference){
    return {
      product:reference.name,
      size:reference.size,
      category:reference.category,
      canonicalKey:reference.canonicalKey,
      ean:reference.ean
    };
  }

  let n=(raw||"").toUpperCase().replace(/\./g," ").replace(/\s+/g," ").trim();
  const size=normalizeSize(raw);
  const catalog=catalogEntry(n,raw);
  if(catalog){
    return {
      product:catalog.name,
      size,
      category:(catalog.category==="Vindu / Dør"||catalog.category==="Murmaling"||catalog.category==="Annet"?catalog.category:"Maling / Dekkbeis / Beis") as ProductCategory,
      canonicalKey:`${canonicalSlug(catalog.name)}|${canonicalSlug(size)}`
    };
  }

  const rules:[RegExp,string,ProductCategory][]=[
    [/INFRA PREMIUM RES/,"Infra Premium Residence","Maling / Dekkbeis / Beis"],
    [/INFRA SUPER(?:IOR)?\s+D[&/]?V/,"Infra Superior Vindu / Dør","Vindu / Dør"],
    [/INFRA SUPERIOR/,"Infra Superior","Maling / Dekkbeis / Beis"],
    [/INFRA NORDLYS/,"Infra Nordlys","Maling / Dekkbeis / Beis"],
    [/INFRA PREMIUM MUR/,"Infra Premium Mur","Murmaling"],
    [/BX FUTURA (?:D\/?VINDU|DØR\/VINDU)|FUTURA.*(?:DØR|DOR|VINDU)/,"Butinox Futura Dør / Vindu","Vindu / Dør"],
    [/BX FUT(?:URA)?\s+SELV.*GR(?:UNN)?MUR/,"Butinox Futura Selvrensende Grunnmur","Murmaling"],
    [/BX FUTURA SELVRENS DB/,"Butinox Futura Selvrensende Dekkbeis","Maling / Dekkbeis / Beis"],
    [/BX FUTURA SELV|BX FUTURA SELVR/,"Butinox Futura Selvrensende 12","Maling / Dekkbeis / Beis"],
    [/BX FUTURA 16/,"Butinox Futura 16","Maling / Dekkbeis / Beis"],
    [/BX FUTURA MATT/,"Butinox Futura Matt","Maling / Dekkbeis / Beis"],
    [/BX FUTURA DEKKB|BX FUTURA DB/,"Butinox Futura Dekkbeis","Maling / Dekkbeis / Beis"],
    [/BX FUTURA MALING/,"Butinox Futura Maling","Maling / Dekkbeis / Beis"],
    [/BX FUTURA GRUNN/,"Butinox Futura Grunning","Maling / Dekkbeis / Beis"],
    [/DRYG NOR(?:DIC)?\s+VINDU\/DØR/,"Drygolin Nordic Extreme Vindu / Dør","Vindu / Dør"],
    [/DRYG(?:OLIN)?\s+VINDU\/DØR/,"Drygolin Vindu / Dør","Vindu / Dør"],
    [/DRYG NORD(?:IC)? EX.*S\s*MATT/,"Drygolin Nordic Extreme Supermatt","Maling / Dekkbeis / Beis"],
    [/DRYG NORD(?:IC)? EX/,"Drygolin Nordic Extreme","Maling / Dekkbeis / Beis"],
    [/DRYGOLIN PLUSS ODB/,"Drygolin Pluss Oljedekkbeis","Maling / Dekkbeis / Beis"],
    [/DRYGOLIN PLUSS OM/,"Drygolin Pluss Oljemaling","Maling / Dekkbeis / Beis"],
    [/DRYGOLIN OPTIMAL/,"Drygolin Optimal","Maling / Dekkbeis / Beis"],
    [/DRYG.*POWER CLEAN/,"Drygolin Power Clean","Maling / Dekkbeis / Beis"],
    [/DRYTECH MURMAL/,"Drytech Murmaling","Murmaling"],
    [/DRYTECH MURPRIMER/,"Drytech Murprimer","Murmaling"],
    [/VISIR OLJEGR.*PIG/,"Visir Oljegrunning Pigmentert","Maling / Dekkbeis / Beis"],
    [/VISIR OLJEGR.*KLAR/,"Visir Oljegrunning Klar","Maling / Dekkbeis / Beis"],
  ];
  for(const [rx,product,category] of rules){
    if(rx.test(n))return {product,size,category,canonicalKey:`${canonicalSlug(product)}|${canonicalSlug(size)}`};
  }

  n=n.replace(/^X\s+/," ")
    .replace(/\b(KL\s*HV|KLHV|K\s*HV|HVIT|HV|A|B|C|OKER|OK|ORØD|RØD|GUL|DY\s*GRÅ|MØ\s*GRÅ|L\s*GRÅ|ME\s*GRÅ)[ -]?(BASE|BA|B)\b/g," ")
    .replace(/\b(BASE|BA)\b/g," ")
    .replace(/\b\d+(?:[,.]\d+)?\s*(?:L|LITER)\b/g," ")
    .replace(/\s+/g," ").trim();
  const product=titleCase(n);
  return {product,size,category:categoryForProduct(product,raw),canonicalKey:`${canonicalSlug(product)}|${canonicalSlug(size)}`};
};

export const imageForProduct=(p:string,rawName="")=>catalogEntry(p,rawName)?.image;

export const canonicalizeRow=(row:ProductRow):ProductRow=>{
  const normalized=normalizeProduct(row.rawName||row.product,row.itemNo);
  const productKey=[row.supplier,normalized.canonicalKey].join("|");
  return {
    ...row,
    product:normalized.product,
    size:normalized.size||row.size,
    category:normalized.category,
    productKey,
    image:row.image||imageForProduct(normalized.product,row.rawName)
  };
};

export const aggregateProducts=(rows:ProductRow[])=>{
  const map=new Map<string,ProductRow>();
  rows.forEach(input=>{
    const r=canonicalizeRow(input);
    const key=[r.storeId,r.productKey].join("|");
    const existing=map.get(key);
    if(existing){
      existing.quantity+=r.quantity;
      existing.revenue+=r.revenue;
      existing.profit+=r.profit;
      existing.margin=existing.revenue?existing.profit/existing.revenue*100:0;
      if(!existing.image&&r.image)existing.image=r.image;
      if(!existing.productUrl&&r.productUrl)existing.productUrl=r.productUrl;
    }else{
      map.set(key,{...r,margin:r.revenue?r.profit/r.revenue*100:0});
    }
  });
  return [...map.values()];
};
