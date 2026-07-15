import * as XLSX from "xlsx";
import {DailyReport,ProductRow,SourceTotal,aggregateProducts,categoryForProduct,normalizeProduct,supplierFromVendor} from "./data";
const num=(v:unknown)=>typeof v==="number"?v:Number(String(v??"").replace(/\s/g,"").replace(",","."))||0;
const shortStore=(s:string)=>String(s||"").replace(/^OBS BYGG\s+/i,"").replace(/,.*$/,'').trim().toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
export async function parsePaintWorkbook(file:File,date:string):Promise<DailyReport>{
 const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const grid=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:null});
 if(grid.length<5) throw new Error("Fant ikke forventet tabell i Excel-filen.");
 const vendors=grid[1]||[],metrics=grid[2]||[];const groups:{supplier:"Infra"|"Butinox"|"Jotun";q:number;m:number;p:number;r:number}[]=[];
 for(let c=0;c<metrics.length;c++){const supplier=supplierFromVendor(String(vendors[c]||""));if(supplier&&String(metrics[c]||"").toLowerCase().includes("ant solgt"))groups.push({supplier,q:c,m:c+1,p:c+2,r:c+3})}
 if(!groups.length) throw new Error("Leverandørkolonnene ble ikke gjenkjent.");
 const rows:ProductRow[]=[],sourceTotals:SourceTotal[]=[];
 for(let i=4;i<grid.length;i++){const row=grid[i]||[];const item=String(row[2]??"");const raw=String(row[3]??"");const storeId=String(row[0]??"");const store=shortStore(String(row[1]??""));
   if(item.toLowerCase()==="resultat"&&storeId&&store){const revenue=num(row[19]),profit=num(row[18]),quantity=num(row[16]);sourceTotals.push({storeId,store,quantity,revenue,profit,margin:revenue?profit/revenue*100:num(row[17])});continue}
   if(!storeId||!raw)continue;
   for(const g of groups){const q=num(row[g.q]),revenue=num(row[g.r]),profit=num(row[g.p]);if(!q&&!revenue&&!profit)continue;const n=normalizeProduct(raw,item);rows.push({storeId,store,itemNo:item,rawName:raw,product:n.product,productKey:[g.supplier,n.canonicalKey].join("|"),size:n.size,supplier:g.supplier,category:n.category||categoryForProduct(n.product,raw),quantity:q,revenue,profit,margin:revenue?profit/revenue*100:num(row[g.m])})}
 }
 if(!rows.length) throw new Error("Fant ingen produktlinjer med salg.");
 return {date,createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),sourceTotals};
}
