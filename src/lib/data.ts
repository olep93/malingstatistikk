export type Supplier = "Infra"|"Butinox"|"Jotun";
export type Period = "Dag"|"Uke"|"Måned";
export type ProductRow={storeId:string;store:string;itemNo:string;rawName:string;product:string;size:string;supplier:Supplier;quantity:number;revenue:number;profit:number;margin:number;image?:string};
export type DailyReport={date:string;createdAt:string;sourceName:string;rows:ProductRow[]};

export const supplierFromVendor=(vendor:string):Supplier|undefined=>{
  const v=(vendor||"").toUpperCase();
  if(v.includes("GJØCO")) return "Infra";
  if(v.includes("SCANOX")) return "Butinox";
  if(v.includes("JOTUN")) return "Jotun";
};
const cleanSize=(name:string)=>{
  const m=name.toUpperCase().match(/(\d+(?:[,.]\d+)?)\s*L\b/);
  return m ? `${m[1].replace(".",",")} L` : "";
};
export const normalizeProduct=(raw:string)=>{
  let n=(raw||"").toUpperCase().replace(/\./g," ").replace(/\s+/g," ").trim();
  const size=cleanSize(n);
  n=n.replace(/\b(KL\.?HV|HVIT|HV|A|B|C|OK|DY\.?GRÅ)[ -]?(BASE|BA|B)\b/g," ")
     .replace(/\b(BASE|BA)\b/g," ").replace(/\b\d+(?:[,.]\d+)?\s*L\b/g," ")
     .replace(/\s+/g," ").trim();
  let product=n;
  const rules:[RegExp,string][]=[
    [/INFRA PREMIUM RES/,"Infra Premium Residence"],[/INFRA SUPERIOR/,"Infra Superior"],[/INFRA NORDLYS/,"Infra Nordlys"],
    [/BX FUTURA SELV|BUTINOX FUTURA SELV/,"Butinox Futura Selvrensende 12"],[/BX FUTURA DEKKB|BUTINOX FUTURA 16/,"Butinox Futura 16"],
    [/BX FUTURA MATT|BUTINOX FUTURA MATT/,"Butinox Futura Matt"],[/DRYG NORDIC EX|DRYGOLIN NORDIC/,"Drygolin Nordic Extreme"],
    [/DRYGOLIN OPTIMAL/,"Drygolin Optimal"],[/DRYG.*POWER CLEAN/,"Drygolin Power Clean"]
  ];
  for(const [rx,label] of rules){if(rx.test(n)){product=label;break}}
  if(product===n){product=n.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()).replace(/\bBx\b/,"Butinox").replace(/\bDryg\b/,"Drygolin")}
  return {product,size};
};
export const imageForProduct=(p:string)=>{
  const names=["Butinox Futura 16","Butinox Futura Matt","Butinox Futura Selvrensende 12","Drygolin Nordic Extreme","Drygolin Optimal","Drygolin Power Clean","Infra Nordlys","Infra Premium Residence","Infra Superior"];
  const found=names.find(x=>p.toLowerCase().includes(x.toLowerCase()));
  return found?`/products/${encodeURIComponent(found)}.jpg`:undefined;
};
export const aggregateProducts=(rows:ProductRow[])=>{
  const map=new Map<string,ProductRow>();
  rows.forEach(r=>{const key=[r.storeId,r.supplier,r.product,r.size].join("|");const x=map.get(key);if(x){x.quantity+=r.quantity;x.revenue+=r.revenue;x.profit+=r.profit;x.margin=x.revenue?x.profit/x.revenue*100:0}else map.set(key,{...r,image:imageForProduct(r.product)})});
  return [...map.values()];
};
export const demoReport:DailyReport={date:"2026-07-12",createdAt:"2026-07-13T07:30:00",sourceName:"Eksempelrapport.xlsx",rows:[
  {storeId:"3588",store:"Tønsberg",itemNo:"7122899",rawName:"INFRA NORDLYS HVIT-BASE 9L",product:"Infra Nordlys",size:"9 L",supplier:"Infra",quantity:4,revenue:2545.6,profit:966.48,margin:37.97,image:"/products/Infra%20Nordlys.jpg"},
  {storeId:"3588",store:"Tønsberg",itemNo:"7132708",rawName:"INFRA PREMIUM RES HV-BA 9L",product:"Infra Premium Residence",size:"9 L",supplier:"Infra",quantity:4,revenue:3676.8,profit:821.04,margin:22.33,image:"/products/Infra%20Premium%20Residence.jpg"},
  {storeId:"3588",store:"Tønsberg",itemNo:"7181586",rawName:"INFRA SUPERIOR HV-BASE 9L",product:"Infra Superior",size:"9 L",supplier:"Infra",quantity:3,revenue:3357.6,profit:1242.51,margin:37.01,image:"/products/Infra%20Superior.jpg"},
  {storeId:"3588",store:"Tønsberg",itemNo:"7278384",rawName:"BX FUTURA SELV KL.HVIT-BA 9L",product:"Butinox Futura Selvrensende 12",size:"9 L",supplier:"Butinox",quantity:3,revenue:4437.6,profit:1384.92,margin:31.21,image:"/products/Butinox%20Futura%20Selvrensende%2012.jpg"},
  {storeId:"3588",store:"Tønsberg",itemNo:"7278391",rawName:"BX FUTURA DEKKB KL.HV-BA 2,7L",product:"Butinox Futura 16",size:"2,7 L",supplier:"Butinox",quantity:2,revenue:1150.4,profit:531.22,margin:46.18,image:"/products/Butinox%20Futura%2016.jpg"},
  {storeId:"3588",store:"Tønsberg",itemNo:"7279624",rawName:"DRYG NORDIC EX 50 K.HV-BA 2,7L",product:"Drygolin Nordic Extreme",size:"2,7 L",supplier:"Jotun",quantity:2,revenue:1902.4,profit:621.86,margin:32.69,image:"/products/Drygolin%20Nordic%20Extreme.jpg"},
  {storeId:"3588",store:"Tønsberg",itemNo:"7279629",rawName:"DRYGOLIN OPTIMAL KL.HV-BASE 9L",product:"Drygolin Optimal",size:"9 L",supplier:"Jotun",quantity:2,revenue:2238.4,profit:260.2,margin:11.62,image:"/products/Drygolin%20Optimal.jpg"},
  {storeId:"3571",store:"Sandefjord",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Infra",quantity:30,revenue:11370,profit:4101,margin:36.07},
  {storeId:"3571",store:"Sandefjord",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Butinox",quantity:50,revenue:29638,profit:9203,margin:31.05},
  {storeId:"3571",store:"Sandefjord",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Jotun",quantity:25,revenue:17046,profit:2361,margin:13.85},
  {storeId:"5087",store:"Skien",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Infra",quantity:60,revenue:7989,profit:3018,margin:37.78},
  {storeId:"5087",store:"Skien",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Butinox",quantity:80,revenue:48218,profit:15405,margin:31.95},
  {storeId:"5087",store:"Skien",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Jotun",quantity:60,revenue:44627,profit:4427,margin:9.92},
  {storeId:"2603",store:"Mjøndalen",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Infra",quantity:20,revenue:11930,profit:4443,margin:37.24},
  {storeId:"2603",store:"Mjøndalen",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Butinox",quantity:40,revenue:26120,profit:7819,margin:29.94},
  {storeId:"2603",store:"Mjøndalen",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Jotun",quantity:25,revenue:21979,profit:177,margin:.8},
  {storeId:"3570",store:"Kongsberg",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Infra",quantity:2,revenue:428,profit:252,margin:58.9},
  {storeId:"3570",store:"Kongsberg",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Butinox",quantity:22,revenue:12915,profit:3020,margin:23.38},
  {storeId:"3570",store:"Kongsberg",itemNo:"x",rawName:"",product:"Region",size:"",supplier:"Jotun",quantity:25,revenue:18980,profit:1314,margin:6.92}
]};
