import * as XLSX from "xlsx";
import {DailyReport,ImportCheck,ProductRow,SourceTotal,aggregateProducts,categoryForProduct,normalizeProduct,supplierFromVendor} from "./data";
import {productReference} from "./product-reference";
import {DEFAULT_SUBGROUP,subgroupFromName} from "./subgroups";

/**
 * Tall fra Excel. Tekstceller kan ha norsk format ("1 234,50", "1.234,50"), typografisk minus ("−125"),
 * minus i parentes ("(125)") og "kr" eller "%" bak. Før ble slike verdier stille til 0, også negativ brutto.
 */
export const num=(v:unknown)=>{
  if(typeof v==="number")return Number.isFinite(v)?v:0;
  let text=String(v??"").replace(/[\s\u00a0\u202f]/g,"").replace(/[\u2212\u2012\u2013]/g,"-").replace(/kr|nok|%/gi,"");
  const negative=/^\(.*\)$/.test(text);if(negative)text=text.slice(1,-1);
  // Siste skilletegn er desimaltegnet når begge finnes; et enkelt punkt fulgt av tre sifre er tusenskille.
  if(text.includes(",")&&text.includes("."))text=text.lastIndexOf(",")>text.lastIndexOf(".")?text.replace(/\./g,"").replace(",","."):text.replace(/,/g,"");
  else if(text.includes(","))text=(text.match(/,/g)||[]).length>1?text.replace(/,/g,""):text.replace(",",".");
  else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(text))text=text.replace(/\./g,"");
  const value=Number(text);
  return Number.isFinite(value)?(negative?-value:value):0;
};
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
type LegacyParsed={kind:"legacy";grid:unknown[][];groups:{supplier:Supplier;q:number;m:number;p:number;r:number}[];dateCol:number;itemCol:number;nameCol:number;totals:{q:number;m:number;p:number;r:number}};
type FlatParsed={kind:"flat";grid:unknown[][];headerRow:number;cols:{storeId:number;store:number;date:number;ean:number;item:number;name:number;vgrName:number;vendorName:number;q:number;m:number;p:number;r:number}};
type ParsedGrid=LegacyParsed|FlatParsed;

const norm=(v:unknown)=>String(v??"").trim().toLowerCase();
const identifier=(v:unknown)=>{
  if(v===null||v===undefined)return "";
  if(typeof v==="number"&&Number.isFinite(v))return Number.isInteger(v)?String(v):String(v).replace(/\.0+$/,"");
  return String(v).trim().replace(/\s+/g,"").replace(/\.0+$/,"");
};
const column=(headers:string[],aliases:string[])=>headers.findIndex(value=>aliases.some(alias=>value===alias||value.includes(alias)));
const assertCompleteExport=(grid:unknown[][])=>{
  const truncated=grid.some(row=>row.some(cell=>String(cell??'').toLowerCase().includes('exported data exceeded the allowed volume')));
  if(truncated)throw new Error('Power BI har avkortet eksporten. Importer mindre perioder.');
};
async function workbookGrid(file:File):Promise<ParsedGrid>{
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const grid=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:null});
  assertCompleteExport(grid);
  if(grid.length<3)throw new Error("Fant ikke forventet tabell i Excel-filen.");

  // Ny BO-rapport: én rad med måltall, neste rad med dimensjonsoverskrifter.
  for(let headerRow=0;headerRow<Math.min(8,grid.length);headerRow++){
    const h=(grid[headerRow]||[]).map(norm);
    const storeId=column(h,["butikk"]);
    const date=column(h,["dato"]);
    const ean=column(h,["ean/upc","ean","upc","gtin"]);
    const item=column(h,["varenr","varenummer","artikkelnummer"]);
    const itemGroup=column(h,["varenr/navn"]);
    const vgr=column(h,["vare vgr","varegruppe"]);
    const vendor=column(h,["leverandør"]);
    if(storeId>=0&&date>=0&&(item>=0||itemGroup>=0)&&vgr>=0&&vendor>=0){
      const metricRow=(grid[Math.max(0,headerRow-1)]||[]).map(norm);
      const q=column(metricRow,["ant solgt"]);
      const m=column(metricRow,["bto %"]);
      const p=column(metricRow,["bto kr"]);
      const r=column(metricRow,["oms"]);
      if(q<0||p<0||r<0)throw new Error("Fant dimensjonene, men ikke kolonnene Ant solgt, BTO kr og Oms.");
      const actualItem=item>=0?item:itemGroup;
      const name=actualItem+1;
      return {kind:"flat",grid,headerRow,cols:{storeId,store:storeId+1,date,ean,item:actualItem,name,vgrName:vgr+1,vendorName:vendor+1,q,m,p,r}};
    }
  }

  // Eldre rapportformat med én kolonnegruppe per leverandør.
  const vendors=grid[1]||[],metrics=grid[2]||[],header=grid[3]||[];
  const groups:{supplier:Supplier;q:number;m:number;p:number;r:number}[]=[];
  // Hver leverandørgruppe starter med "Ant solgt". Finn de øvrige målene etter navn innen gruppen,
  // slik at en endret kolonnerekkefølge ikke bytter om brutto og omsetning.
  const starts=metrics.map((value,c)=>norm(value).includes("ant solgt")?c:-1).filter(c=>c>=0);
  starts.forEach((c,index)=>{
    const supplier=supplierFromVendor(String(vendors[c]||""));if(!supplier)return;
    const end=starts[index+1]??metrics.length;
    const find=(alias:string,fallback:number)=>{for(let i=c+1;i<end;i++)if(norm(metrics[i]).includes(alias))return i;return fallback;};
    groups.push({supplier,q:c,m:find("bto %",c+1),p:find("bto kr",c+2),r:find("oms",c+3)});
  });
  if(!groups.length)throw new Error("Rapportformatet ble ikke gjenkjent.");
  const normalized=header.map(norm);
  const dateCol=normalized.findIndex(v=>v.includes("dato"));
  const itemHeader=normalized.findIndex(v=>v.includes("varenr")||v.includes("varenummer"));
  const itemCol=itemHeader>=0?itemHeader:dateCol>=0?dateCol+1:2;
  // "Resultat"-raden har totalene i den siste kolonnegruppen.
  const last=groups.at(-1)!;
  return {kind:"legacy",grid,groups,dateCol,itemCol,nameCol:itemCol+1,totals:{q:last.q,m:last.m,p:last.p,r:last.r}};
}

// BI-navnene er forkortet ("BX TERR.BEIS", "INFRA TERR.B 3ÅR"), og Power BI-eksporten har bare
// "EAN …". Klassifiser derfor på rådata, normalisert produktnavn og produktreferansen for EAN/varenr.
function classificationText(raw:string,item?:string,ean?:string){
  const reference=productReference(item)||productReference(ean);
  return [raw,normalizeProduct(raw,item||ean).product,reference?.rawName,reference?.name].filter(Boolean).join(" ").toUpperCase();
}

/** Underkategorier som bare kommer fra produktnavnet (ikke fra varegruppen), og som derfor kan settes på nytt. */
function renameableSubgroup(area:ProductArea,subgroup?:string){
  if(area==="terrace")return true;
  if(area==="interior")return ["Matt","Tak","Supermatt","Silkematt","Tre & Panel","Grunning"].includes(subgroup||"");
  if(area==="tools")return subgroup==="Diverse";
  return false;
}

function classify(vgr:string,raw:string,item?:string,ean?:string):{area:ProductArea;subgroup:string}|undefined{
  const g=vgr.toUpperCase(),n=classificationText(raw,item,ean);
  if(g.includes("EKSTERIØRMALING"))return {area:"exterior",subgroup:"Eksteriør"};
  if(g.includes("TERRASSEBEIS"))return {area:"terrace",subgroup:subgroupFromName("terrace",n)??DEFAULT_SUBGROUP.terrace};
  // SAP-varegruppe 0687 Bygningstape inneholder maskerings- og malertape
  // i den nye BI-rapporten. Hele varegruppen føres derfor som Tape.
  if(g.includes("0687")||g.includes("BYGNINGSTAPE"))return {area:"tools",subgroup:"Tape"};
  if(g.includes("MALETILBEHØR"))return {area:"tools",subgroup:"Maletilbehør"};
  if(g.includes("FUGEMASSE")||g.includes("KITT"))return {area:"tools",subgroup:"Fugemasse & Kitt"};
  if(g.includes("PLEIEMIDLER")&&g.includes("INTERIØR"))return {area:"tools",subgroup:"Rens & vask"};
  // Innen selve malerverktøygruppen kreves fortsatt et eksplisitt tape-navn.
  if(g.includes("MALERVERKTØY"))return {area:"tools",subgroup:subgroupFromName("tools",n)??DEFAULT_SUBGROUP.tools};
  if(g.includes("VASK")&&g.includes("RENS"))return {area:"tools",subgroup:"Rensemidler"};
  if(g.includes("SPARKEL"))return {area:"interior",subgroup:"Sparkel"};
  if(g.includes("LAKK"))return {area:"interior",subgroup:"Lakk"};
  if(g.includes("INTERIØRMALING"))return {area:"interior",subgroup:subgroupFromName("interior",n)??DEFAULT_SUBGROUP.interior};
  return undefined;
}

/** Linjer som ikke kom med fordi varegruppe eller leverandør er ukjent, slik at totalen kan forklares. */
const emptyCheck=():ImportCheck=>({skippedLines:0,skippedRevenue:0,skippedProfit:0,skippedGroups:[]});
function skip(check:ImportCheck,group:string,revenue:number,profit:number){
  if(!revenue&&!profit)return;
  check.skippedLines++;check.skippedRevenue+=revenue;check.skippedProfit+=profit;
  if(group&&!check.skippedGroups.includes(group)&&check.skippedGroups.length<20)check.skippedGroups.push(group);
}

function addRow(target:ProductRow[],args:{storeId:string;store:string;item:string;ean?:string;raw:string;supplier:Supplier;area:ProductArea;subgroup:string;q:number;revenue:number;profit:number;margin:number}){
  const n=normalizeProduct(args.raw,args.item);
  target.push({storeId:args.storeId,store:args.store,itemNo:args.item,ean:args.ean||undefined,rawName:args.raw,product:n.product,productKey:[args.area,args.subgroup,args.supplier,n.canonicalKey].join("|"),size:n.size,supplier:args.supplier,area:args.area,subgroup:args.subgroup,category:n.category||categoryForProduct(n.product,args.raw),quantity:args.q,revenue:args.revenue,profit:args.profit,margin:args.revenue?args.profit/args.revenue*100:args.margin});
}

function parseRows(parsed:ParsedGrid,forcedDate?:string){
  const rowsByDate=new Map<string,ProductRow[]>();
  const sourceTotalsByDate=new Map<string,SourceTotal[]>();
  const checksByDate=new Map<string,ImportCheck>();
  const checkFor=(date:string)=>{let c=checksByDate.get(date);if(!c){c=emptyCheck();checksByDate.set(date,c);}return c;};
  if(parsed.kind==="flat"){
    const {grid,headerRow,cols:c}=parsed;
    for(let i=headerRow+1;i<grid.length;i++){
      const row=grid[i]||[];
      const reportDate=forcedDate||isoDate(row[c.date]); if(!reportDate)continue;
      const storeId=String(row[c.storeId]??"").trim(),store=shortStore(String(row[c.store]??""));
      const ean=c.ean>=0?identifier(row[c.ean]):"";
      const item=identifier(row[c.item]),raw=String(row[c.name]??"").trim();
      const vgr=String(row[c.vgrName]??"").trim();
      const supplier=supplierFromVendor(String(row[c.vendorName]??""));
      const classification=classify(vgr,raw,item,ean);
      if(!storeId||!store||!item||!raw)continue;
      if(!supplier||!classification){skip(checkFor(reportDate),vgr,num(row[c.r]),num(row[c.p]));continue;}
      const target=rowsByDate.get(reportDate)||[];
      addRow(target,{storeId,store,item,ean,raw,supplier,area:classification.area,subgroup:classification.subgroup,q:num(row[c.q]),margin:num(row[c.m]),profit:num(row[c.p]),revenue:num(row[c.r])});
      rowsByDate.set(reportDate,target);
    }
    return {rowsByDate,sourceTotalsByDate,checksByDate};
  }

  const {grid,groups,dateCol,itemCol,nameCol,totals:t}=parsed;
  for(let i=4;i<grid.length;i++){
    const row=grid[i]||[];const reportDate=forcedDate||isoDate(dateCol>=0?row[dateCol]:undefined);if(!reportDate)continue;
    const item=String(row[itemCol]??"").trim(),raw=String(row[nameCol]??"").trim();
    const storeId=String(row[0]??"").trim(),store=shortStore(String(row[1]??""));
    if(item.toLowerCase()==="resultat"&&storeId&&store){const revenue=num(row[t.r]),profit=num(row[t.p]),quantity=num(row[t.q]);const totals=sourceTotalsByDate.get(reportDate)||[];totals.push({storeId,store,quantity,revenue,profit,margin:revenue?profit/revenue*100:num(row[t.m])});sourceTotalsByDate.set(reportDate,totals);continue;}
    if(!storeId||!raw||!item)continue;
    const target=rowsByDate.get(reportDate)||[];
    for(const g of groups){const q=num(row[g.q]),revenue=num(row[g.r]),profit=num(row[g.p]);if(!q&&!revenue&&!profit)continue;addRow(target,{storeId,store,item,raw,supplier:g.supplier,area:"exterior",subgroup:"Eksteriør",q,revenue,profit,margin:num(row[g.m])});}
    rowsByDate.set(reportDate,target);
  }
  return {rowsByDate,sourceTotalsByDate,checksByDate};
}

const unrecognizedReport=(error:unknown)=>error instanceof Error&&/rapportformatet ble ikke gjenkjent/i.test(error.message);
export async function parsePaintWorkbook(file:File,date:string):Promise<DailyReport>{try{const parsed=await workbookGrid(file);const {rowsByDate,sourceTotalsByDate,checksByDate}=parseRows(parsed,date);const rows=[...rowsByDate.values()].flat();if(!rows.length)throw new Error("Fant ingen produktlinjer i de valgte varegruppene.");return {date,createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),sourceTotals:sourceTotalsByDate.get(date)||[],importCheck:checksByDate.get(date)||emptyCheck()}}catch(error){if(!unrecognizedReport(error))throw error;const national=await parseNationalPowerBiWorkbook(file);return {...national,date}}}
export async function parsePaintHistoryWorkbook(file:File):Promise<DailyReport[]>{try{const parsed=await workbookGrid(file);const {rowsByDate,sourceTotalsByDate,checksByDate}=parseRows(parsed);const reports=[...rowsByDate.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>({date,createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),sourceTotals:sourceTotalsByDate.get(date)||[],importCheck:checksByDate.get(date)||emptyCheck()}));if(!reports.length)throw new Error("Fant ingen daterte produktlinjer.");return reports}catch(error){if(!unrecognizedReport(error))throw error;return parseNationalPowerBiHistoryWorkbook(file)}}

export async function parseNationalPowerBiWorkbook(file:File):Promise<DailyReport>{
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const grid=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:null});
  assertCompleteExport(grid);
  if(grid.length<2)throw new Error("Excel-filen er tom.");
  const headers=(grid[0]||[]).map(norm);
  const dateCol=column(headers,["dato"]),storeCol=column(headers,["butikknr/navn","butikk"]),vendorCol=column(headers,["leverandørnavn","leverandør"]),groupCol=column(headers,["vare vgr navn","varegruppe"]),eanCol=column(headers,["gtin (ean/upc)","gtin","ean/upc","ean"]),qCol=column(headers,["antall solgt","ant solgt"]),rCol=column(headers,["omsetning","oms"]),mCol=column(headers,["brutto %","bto %"]),pCol=column(headers,["brutto kr","bto kr"]);
  if([dateCol,storeCol,vendorCol,groupCol,eanCol,qCol,rCol,pCol].some(x=>x<0))throw new Error("Det nasjonale Power BI-formatet ble ikke gjenkjent.");
  const rows:ProductRow[]=[];let reportDate="";const check=emptyCheck();
  for(let i=1;i<grid.length;i++){
    const row=grid[i]||[];const date=isoDate(row[dateCol]);if(date)reportDate=reportDate||date;
    const storeText=String(row[storeCol]??"").trim(),vendor=String(row[vendorCol]??"").trim(),vgr=String(row[groupCol]??"").trim(),ean=identifier(row[eanCol]);
    // Totalraden nederst i Power BI-eksporten er kontrollsummen for hele filen.
    if(norm(row[0])==="total"||storeText.toLowerCase()==="total"){check.expectedRevenue=num(row[rCol]);check.expectedProfit=num(row[pCol]);continue;}
    if(!storeText||storeText.toLowerCase()==="total"||!vendor||vendor.toLowerCase()==="total"||!vgr||vgr.toLowerCase()==="total"||!ean||ean.toLowerCase()==="total")continue;
    const match=storeText.match(/^(\d+)\s+(.+?)(?:,\s*[^,]+)?$/);if(!match)continue;
    const storeId=match[1],store=shortStore(match[2]);const supplier=supplierFromVendor(vendor);const classification=classify(vgr,`EAN ${ean}`,undefined,ean);
    if(!supplier||!classification){skip(check,vgr,num(row[rCol]),num(row[pCol]));continue;}
    addRow(rows,{storeId,store,item:ean,ean,raw:`EAN ${ean}`,supplier,area:classification.area,subgroup:classification.subgroup,q:num(row[qCol]),revenue:num(row[rCol]),profit:num(row[pCol]),margin:mCol>=0?num(row[mCol])*100:0});
  }
  if(!rows.length)throw new Error("Fant ingen gyldige salgslinjer i Power BI-filen.");
  return {date:reportDate||new Date().toISOString().slice(0,10),createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),importCheck:check};
}

export async function parseNationalPowerBiHistoryWorkbook(file:File):Promise<DailyReport[]>{
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const grid=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:null});
  assertCompleteExport(grid);
  if(grid.length<2)throw new Error("Excel-filen er tom.");
  const headers=(grid[0]||[]).map(norm);
  const dateCol=column(headers,["dato"]),storeCol=column(headers,["butikknr/navn","butikk"]),vendorCol=column(headers,["leverandørnavn","leverandør"]),groupCol=column(headers,["vare vgr navn","varegruppe"]),eanCol=column(headers,["gtin (ean/upc)","gtin","ean/upc","ean"]),qCol=column(headers,["antall solgt","ant solgt"]),rCol=column(headers,["omsetning","oms"]),mCol=column(headers,["brutto %","bto %"]),pCol=column(headers,["brutto kr","bto kr"]);
  if([dateCol,storeCol,vendorCol,groupCol,eanCol,qCol,rCol,pCol].some(x=>x<0))throw new Error("Det nasjonale Power BI-formatet ble ikke gjenkjent.");
  const byDate=new Map<string,ProductRow[]>();const checks=new Map<string,ImportCheck>();
  let currentDate="";
  for(let i=1;i<grid.length;i++){
    const row=grid[i]||[];
    const parsedDate=isoDate(row[dateCol]);
    if(parsedDate)currentDate=parsedDate;
    if(!currentDate)continue;
    const storeText=String(row[storeCol]??"").trim(),vendor=String(row[vendorCol]??"").trim(),vgr=String(row[groupCol]??"").trim(),ean=identifier(row[eanCol]);
    if(!storeText||storeText.toLowerCase()==="total"||!vendor||vendor.toLowerCase()==="total"||!vgr||vgr.toLowerCase()==="total"||!ean||ean.toLowerCase()==="total")continue;
    const match=storeText.match(/^(\d+)\s+(.+?)(?:,\s*[^,]+)?$/);if(!match)continue;
    const storeId=match[1],store=shortStore(match[2]);const supplier=supplierFromVendor(vendor);const classification=classify(vgr,`EAN ${ean}`,undefined,ean);
    if(!supplier||!classification){const c=checks.get(currentDate)||emptyCheck();skip(c,vgr,num(row[rCol]),num(row[pCol]));checks.set(currentDate,c);continue;}
    const target=byDate.get(currentDate)||[];
    addRow(target,{storeId,store,item:ean,ean,raw:`EAN ${ean}`,supplier,area:classification.area,subgroup:classification.subgroup,q:num(row[qCol]),revenue:num(row[rCol]),profit:num(row[pCol]),margin:mCol>=0?num(row[mCol])*100:0});
    byDate.set(currentDate,target);
  }
  const reports=[...byDate.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>({date,createdAt:new Date().toISOString(),sourceName:file.name,rows:aggregateProducts(rows),importCheck:checks.get(date)||emptyCheck()}));
  if(!reports.length)throw new Error("Fant ingen daterte salgslinjer i Power BI-filen.");
  return reports;
}

export type NationalProductEnrichment={ean:string;name:string;displayName?:string;size?:string|null;imageUrl?:string|null;productUrl?:string|null};
export function applyNationalProductEnrichment(report:DailyReport,enrichments:Record<string,NationalProductEnrichment>):DailyReport{
  const rows=report.rows.map(row=>{
    const ean=identifier(row.ean||row.itemNo);
    const hit=enrichments[ean];
    if(!hit)return row;
    const raw=String(hit.name||hit.displayName||row.rawName||row.product).trim();
    const normalized=normalizeProduct(raw,row.itemNo);
    // Power BI-linjene ble klassifisert på "EAN …". Med ekte navn kan underkategorien settes riktig.
    const subgroup=row.area&&renameableSubgroup(row.area as ProductArea,row.subgroup)?subgroupFromName(row.area as ProductArea,`${raw} ${normalized.product}`)??DEFAULT_SUBGROUP[row.area as ProductArea]??row.subgroup:row.subgroup;
    return {...row,subgroup,rawName:raw,product:normalized.product,size:hit.size||normalized.size||row.size,category:normalized.category||row.category,productKey:[row.area||'',subgroup||'',row.supplier,`ean-${ean}`].join('|'),image:hit.imageUrl||row.image,productUrl:hit.productUrl||row.productUrl};
  });
  return {...report,rows:aggregateProducts(rows)};
}
