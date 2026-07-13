import {catalogEntry} from "./product-catalog";
export type Supplier = "Infra"|"Butinox"|"Jotun";
export type Period = "Dag"|"Uke"|"Måned";
export type ProductRow={storeId:string;store:string;itemNo:string;rawName:string;product:string;size:string;supplier:Supplier;quantity:number;revenue:number;profit:number;margin:number;image?:string};
export type SourceTotal={storeId:string;store:string;quantity:number;revenue:number;profit:number;margin:number};
export type DailyReport={date:string;createdAt:string;sourceName:string;rows:ProductRow[];sourceTotals?:SourceTotal[]};

export const supplierFromVendor=(vendor:string):Supplier|undefined=>{
  const v=(vendor||"").toUpperCase();
  if(v.includes("GJØCO")) return "Infra";
  if(v.includes("SCANOX")) return "Butinox";
  if(v.includes("JOTUN")) return "Jotun";
};
const cleanSize=(name:string)=>{const m=name.toUpperCase().match(/(\d+(?:[,.]\d+)?)\s*L\b/);return m?`${m[1].replace(".",",")} L`:""};
export const normalizeProduct=(raw:string)=>{
  let n=(raw||"").toUpperCase().replace(/\./g," ").replace(/\s+/g," ").trim();
  const size=cleanSize(n);
  n=n.replace(/\b(KL\s*HV|KLHV|HVIT|HV|A|B|C|OK|ORØ|GUL|DY\s*GRÅ)[ -]?(BASE|BA|B)\b/g," ")
    .replace(/\b(BASE|BA)\b/g," ").replace(/\b\d+(?:[,.]\d+)?\s*L\b/g," ").replace(/\s+/g," ").trim();
  let product=n;
  const rules:[RegExp,string][]=[
    [/INFRA PREMIUM RES/,"Infra Premium Residence"],[/INFRA SUPERIOR/,"Infra Superior"],[/INFRA NORDLYS/,"Infra Nordlys"],
    [/BX FUTURA SELV|BUTINOX FUTURA SELV/,"Butinox Futura Selvrensende 12"],[/BX FUTURA DEKKB|BUTINOX FUTURA 16/,"Butinox Futura 16"],
    [/BX FUTURA MATT|BUTINOX FUTURA MATT/,"Butinox Futura Matt"],[/DRYG NORDIC EX|DRYGOLIN NORDIC/,"Drygolin Nordic Extreme"],
    [/DRYGOLIN OPTIMAL/,"Drygolin Optimal"],[/DRYG.*POWER CLEAN/,"Drygolin Power Clean"]
  ];
  for(const [rx,label] of rules){if(rx.test(n)){product=label;break}}
  if(product===n) product=n.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()).replace(/\bBx\b/,"Butinox").replace(/\bDryg\b/,"Drygolin");
  return {product,size};
};
export const imageForProduct=(p:string,rawName="")=>catalogEntry(p,rawName)?.image;
export const aggregateProducts=(rows:ProductRow[])=>{const map=new Map<string,ProductRow>();rows.forEach(r=>{const key=[r.storeId,r.supplier,r.product,r.size].join("|");const x=map.get(key);if(x){x.quantity+=r.quantity;x.revenue+=r.revenue;x.profit+=r.profit;x.margin=x.revenue?x.profit/x.revenue*100:0}else map.set(key,{...r,image:r.image||imageForProduct(r.product,r.rawName)})});return [...map.values()]};
