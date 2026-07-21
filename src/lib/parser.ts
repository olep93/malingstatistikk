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
  return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:"";
};

type Supplier="Infra"|"Butinox"|"Jotun"|"Jordan"|"Øvrig";
type ProductArea="exterior"|"interior"|"terrace"|"tools";
type LegacyParsed={kind:"legacy";grid:unknown[][];groups:{supplier:Supplier;q:number;m:number;p:number;r:number}[];dateCol:number;itemCol:number;nameCol:number};
type FlatParsed={kind:"flat";grid:unknown[][];headerRow:number;cols:{storeId:number;store:number;date:number;item:number;name:number;vgrName:number;vendorName:number;q:number;m:number;p:number;r:number}};
type ParsedGrid=LegacyParsed|FlatParsed;

const norm=(v:unknown)=>String(v??"").trim().toLowerCase();
async function workbookGrid(file:File):Promise<ParsedGrid>{
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const grid=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:null});
  if(grid.length<3)throw new Error("Fant ikke forventet tabell i Excel-filen.");

  // Ny BO-rapport: én rad med måltall, neste rad med dimensjonsoverskrifter.
  for(let headerRow=0;headerRow<Math.min(8,grid.length);headerRow++){
    const h=(grid[headerRow]||[]).map(norm);
    const storeId=h.findIndex(x=>x==="butikk");
    const date=h.findIndex(x=>x==="dato");
    const item=h.findIndex(x=>x.includes("varenr"));
    const vgrName=h.findIndex(x=>x.includes("vare vgr"));
    const vendorName=h.findIndex(x=>x==="leverandør");
    if(storeId>=0&&date>=0&&item>=0&&vgrName>=0&&vendorName>=0){
      const metricRow=(grid[Math.max(0,headerRow-1)]||[]).map(norm);
      const q=metricRow.findIndex(x=>x.includes("ant solgt"));
      const m=metricRow.findIndex(x=>x.includes("bto %"));
      const p=metricRow.findIndex(x=>x.includes("bto kr"));
      const r=metricRow.findIndex(x=>x==="oms"||x.startsWith("oms "));
      if(q<0||p<0||r<0)throw new Error("Fant dimensjonene, men ikke kolonnene Ant solgt, BTO kr og Oms.");
      return {kind:"flat",grid,headerRow,cols:{storeId,store:storeId+1,date,item,name:item+1,vgrName:vgrName+1,vendorName:vendorName+1,q,m,p,r}};
    }
  }

  // Eldre rapportformat med én kolonnegruppe per leverandør.
  const vendors=grid[1]||[],metrics=grid[2]||[],header=grid[3]||[];
  const groups:{supplier:Supplier;q:number;m:number;p:number;r:number}[]=[];
  for(let c=0;c<metrics.length;c++){
    const supplier=supplierFromVendor(String(vendors[c]||""));
    if(supplier&&norm(metrics[c]).includes("ant solgt"))groups.push({supplier,q:c,m:c+1,p:c+2,r:c+3});
  }
  if(!groups.length)throw new Error("Rapportformatet ble ikke gjenkjent.");
  const normalized=header.map(norm);
  const dateCol=normalized.findIndex(v=>v.includes("dato"));
  const itemHeader=normalized.findIndex(v=>v.includes("varenr")||v.includes("varenummer"));
  const itemCol=itemHeader>=0?itemHeader:dateCol>=0?dateCol+1:2;
  return {kind:"legacy",grid,groups,dateCol,itemCol,nameCol:itemCol+1};
}

function classify(vgr:string,raw:string):{area:ProductArea;subgroup:string}|undefined{
  const g=vgr.toUpperCase(),n=raw.toUpperCase();
  if(g.includes("EKSTERIØRMALING"))return {area:"exterior",subgroup:"Eksteriør"};
  if(g.includes("TERRASSEBEIS")){
    const subgroup=/MALING/.test(n)?"Terrassemaling":/OLJE|OLJEB|OLJEBAS|\bOB\b/.test(n)?"Oljebasert":"Vanntynnet";return {area:"terrace",subgroup};
  }
  // SAP-varegruppe 0687 Bygningstape inneholder maskerings- og malertape
  // i den nye BI-rapporten. Hele varegruppen føres derfor som Tape.
  if(g.includes("0687")||g.includes("BYGNINGSTAPE"))return {area:"tools",subgroup:"Tape"};
  if(g.includes("MALERVERKTØY")) {
    // Maskeringsblad er et skjære-/hjelpeverktøy, ikke maskeringstape.
    // Innen selve malerverktøygruppen kreves fortsatt et eksplisitt tape-navn.
    const subgroup=/MASKERINGSTAPE|MASK\.?\s*TAPE|MALERTAPE|PRECISION TAPE|SCOTCH.*TAPE/.test(n)?"Tape"
      :/DEKK|TILDEKN|PLAST|FOLIE|PAPP|DUK|MASKERINGSPAPIR/.test(n)?"Tildekning"
      :/PENSEL|STREKP|KOST|FORDRIVER/.test(n)?"Pensler"
      :/RULL|MINIR|BØYLE|RULLESETT|MALERULL/.test(n)?"Ruller"
      :"Diverse";
    return {area:"tools",subgroup};
  }
  if(g.includes("VASK")&&g.includes("RENS"))return {area:"tools",subgroup:"Rensemidler"};
  if(g.includes("SPARKEL"))return {area:"interior",subgroup:"Sparkel"};
  if(g.includes("LAKK"))return {area:"interior",subgroup:"Lakk"};
  if(g.includes("INTERIØRMALING")){
    const subgroup=/TAK/.test(n)?"Tak":/SUPERMATT|PURE COLOR/.test(n)?"Supermatt":/SILKEMATT|KLASSISK SM/.test(n)?"Silkematt":/PANEL|TRE|LIST|DØR|DOR/.test(n)?"Tre & Panel":/GRUNN/.test(n)?"Grunning":"Matt";return {area:"interior",subgroup};
  }
  return undefined;
}

function addRow(target:ProductRow[],args:{storeId:string;store:string;item:string;raw:string;supplier:Supplier;area:ProductArea;subgroup:string;q:number;revenue:number;profit:number;margin:number}){
  const n=normalizeProduct(args.raw,args.item);
  target.push({storeId:args.storeId,store:args.store,itemNo:args.item,rawName:args.raw,product:n.product,productKey:[args.area,args.subgroup,args.supplier,n.canonicalKey].join("|"),size:n.size,supplier:args.supplier,area:args.area,subgroup:args.subgroup,category:n.category||categoryForProduct(n.product,args.raw),quantity:args.q,revenue:args.revenue,profit:args.profit,margin:args.revenue?args.profit/args.revenue*100:args.margin});
}

function parseRows(parsed:ParsedGrid,forcedDate?:string){
  const rowsByDate=new Map<string,ProductRow[]>();
  const sourceTotalsByDate=new Map<string,SourceTotal[]>();
  if(parsed.kind==="flat"){
    const {grid,headerRow,cols:c}=parsed;
    for(let i=headerRow+1;i<grid.length;i++){
      const row=grid[i]||[];
      const reportDate=forcedDate||isoDate(row[c.date]); if(!reportDate)continue;
      const storeId=String(row[c.storeId]??"").trim(),store=shortStore(String(row[c.store]??""));
      const item=String(row[c.item]??"").trim(),raw=String(row[c.name]??"").trim();
      const vgr=String(row[c.vgrName]??"").trim();
      const supplier=supplierFromVendor(String(row[c.vendorName]??""));
      const classification=classify(vgr,raw);
      if(!storeId||!store||!item||!raw||!supplier||!classification)continue;
      const target=rowsByDate.get(reportDate)||[];
      addRow(target,{storeId,store,item,raw,supplier,area:classification.area,subgroup:classification.subgroup,q:num(row[c.q]),margin:num(row[c.m]),profit:num(row[c.p]),revenue:num(row[c.r])});
      rowsByDate.set(reportDate,target);
    }
    return {rowsByDate,sourceTotalsByDate};
  }

  const {grid,groups,dateCol,itemCol,nameCol}=parsed;
  for(let i=4;i<grid.length;i++){
    const row=grid[i]||[];const reportDate=forcedDate||isoDate(dateCol>=0?row[dateCol]:undefined);if(!reportDate)continue;
    const item=String(row[itemCol]??"").trim(),raw=String(row[nameCol]??"").trim();
    const storeId=String(row[0]??"").trim(),store=shortStore(String(row[1]??""));
    if(item.toLowerCase()==="resultat"&&storeId&&store){const revenue=num(row[19]),profit=num(row[18]),quantity=num(row[16]);const totals=sourceTotalsByDate.get(reportDate)||[];totals.push({storeId,store,quantity,revenue,profit,margin:revenue?profit/revenue*100:num(row[17])});sourceTotalsByDate.set(reportDate,totals);continue;}
    if(!storeId||!raw||!item)continue;
    const target=rowsByDate.get(reportDate)||[];
    for(const g of groups){const q=num(row[g.q]),revenue=num(row[g.r]),profit=num(row[g.p]);if(!q&&!revenue&&!profit)continue;addRow(target,{storeId,store,item,raw,supplier:g.supplier,area:"exterior",subgroup:"Eksteriør",q,revenue,profit,margin:num(row[g.m])});}
    rowsByDate.set(reportDate,target);
  }
  return {rowsByDate,sourceTotalsByDate};
}

export async function parsePaintWorkbook(file:File,date:string):Promise<DailyReport>{const parsed=await workbookGrid(file);const {rowsByDate,sourceTotalsByDate}=parseRows(parsed,date);const rows=[...rowsByDate.values()].flat();if(!rows.length)throw new Error("Fant ingen produktlinjer i de valgte varegruppene.");return {date,createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),sourceTotals:sourceTotalsByDate.get(date)||[]};}
export async function parsePaintHistoryWorkbook(file:File):Promise<DailyReport[]>{const parsed=await workbookGrid(file);const {rowsByDate,sourceTotalsByDate}=parseRows(parsed);const reports=[...rowsByDate.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>({date,createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),sourceTotals:sourceTotalsByDate.get(date)||[]}));if(!reports.length)throw new Error("Fant ingen daterte produktlinjer.");return reports;}
