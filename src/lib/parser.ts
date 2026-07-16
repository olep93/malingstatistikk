import * as XLSX from "xlsx";
import {DailyReport,ProductRow,SourceTotal,aggregateProducts,categoryForProduct,normalizeProduct,supplierFromVendor} from "./data";

const num=(v:unknown)=>typeof v==="number"?v:Number(String(v??"").replace(/\s/g,"").replace(",","."))||0;
const shortStore=(s:string)=>String(s||"").replace(/^OBS BYGG\s+/i,"").replace(/,.*$/,'').trim().toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
const isoDate=(v:unknown)=>{
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
  if(typeof v==="number"){
    const d=XLSX.SSF.parse_date_code(v);
    if(d)return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const text=String(v??"").trim();
  const no=text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if(no)return `${no[3]}-${no[2].padStart(2,"0")}-${no[1].padStart(2,"0")}`;
  const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso?text:"";
};

type ParsedGrid={grid:unknown[][];groups:{supplier:"Infra"|"Butinox"|"Jotun";q:number;m:number;p:number;r:number}[];dateCol:number;itemCol:number;nameCol:number};

async function workbookGrid(file:File):Promise<ParsedGrid>{
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const grid=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:null});
  if(grid.length<5)throw new Error("Fant ikke forventet tabell i Excel-filen.");
  const vendors=grid[1]||[],metrics=grid[2]||[],header=grid[3]||[];
  const groups:{supplier:"Infra"|"Butinox"|"Jotun";q:number;m:number;p:number;r:number}[]=[];
  for(let c=0;c<metrics.length;c++){
    const supplier=supplierFromVendor(String(vendors[c]||""));
    if(supplier&&String(metrics[c]||"").toLowerCase().includes("ant solgt"))groups.push({supplier,q:c,m:c+1,p:c+2,r:c+3});
  }
  if(!groups.length)throw new Error("Leverandørkolonnene ble ikke gjenkjent.");
  const normalized=header.map(v=>String(v??"").trim().toLowerCase());
  const dateCol=normalized.findIndex(v=>v.includes("dato"));
  const itemHeader=normalized.findIndex(v=>v.includes("varenr")||v.includes("varenummer"));
  const itemCol=itemHeader>=0?itemHeader:dateCol>=0?dateCol+1:2;
  const nameCol=itemCol+1;
  return {grid,groups,dateCol,itemCol,nameCol};
}

function parseRows(parsed:ParsedGrid,forcedDate?:string){
  const {grid,groups,dateCol,itemCol,nameCol}=parsed;
  const rowsByDate=new Map<string,ProductRow[]>();
  const sourceTotalsByDate=new Map<string,SourceTotal[]>();
  for(let i=4;i<grid.length;i++){
    const row=grid[i]||[];
    const reportDate=forcedDate||isoDate(dateCol>=0?row[dateCol]:undefined);
    if(!reportDate)continue;
    const item=String(row[itemCol]??"").trim();
    const raw=String(row[nameCol]??"").trim();
    const storeId=String(row[0]??"").trim();
    const store=shortStore(String(row[1]??""));
    if(item.toLowerCase()==="resultat"&&storeId&&store){
      const revenue=num(row[19]),profit=num(row[18]),quantity=num(row[16]);
      const totals=sourceTotalsByDate.get(reportDate)||[];
      totals.push({storeId,store,quantity,revenue,profit,margin:revenue?profit/revenue*100:num(row[17])});
      sourceTotalsByDate.set(reportDate,totals);
      continue;
    }
    if(!storeId||!raw||!item)continue;
    const target=rowsByDate.get(reportDate)||[];
    for(const g of groups){
      const q=num(row[g.q]),revenue=num(row[g.r]),profit=num(row[g.p]);
      if(!q&&!revenue&&!profit)continue;
      const n=normalizeProduct(raw,item);
      target.push({storeId,store,itemNo:item,rawName:raw,product:n.product,productKey:[g.supplier,n.canonicalKey].join("|"),size:n.size,supplier:g.supplier,category:n.category||categoryForProduct(n.product,raw),quantity:q,revenue,profit,margin:revenue?profit/revenue*100:num(row[g.m])});
    }
    rowsByDate.set(reportDate,target);
  }
  return {rowsByDate,sourceTotalsByDate};
}

export async function parsePaintWorkbook(file:File,date:string):Promise<DailyReport>{
  const parsed=await workbookGrid(file);
  const {rowsByDate,sourceTotalsByDate}=parseRows(parsed,date);
  const rows=[...rowsByDate.values()].flat();
  if(!rows.length)throw new Error("Fant ingen produktlinjer med salg.");
  return {date,createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),sourceTotals:sourceTotalsByDate.get(date)||[]};
}

export async function parsePaintHistoryWorkbook(file:File):Promise<DailyReport[]>{
  const parsed=await workbookGrid(file);
  if(parsed.dateCol<0)throw new Error("Historikkfilen mangler en gjenkjennelig datokolonne.");
  const {rowsByDate,sourceTotalsByDate}=parseRows(parsed);
  const reports=[...rowsByDate.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>({
    date,
    createdAt:new Date().toISOString(),
    sourceName:file.name,
    rows:aggregateProducts(rows),
    sourceTotals:sourceTotalsByDate.get(date)||[]
  }));
  if(!reports.length)throw new Error("Fant ingen daterte produktlinjer med salg.");
  return reports;
}
