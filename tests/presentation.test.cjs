const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
// Exercise the same TypeScript helpers as the app, without adding a test runtime.
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {marginTone,isoWeekKey}=require('../src/lib/presentation.ts');
const {summarizeFocusProducts}=require('../src/lib/focus-products-summary.ts');
const {DEFAULT_FOCUS_PRODUCTS,validateFocusProducts,focusEan}=require('../src/lib/focus-products.ts');

test('screen and print use identical margin boundaries',()=>{
 for(const [value,tone] of [[-10,'critical'],[0,'critical'],[9.99,'critical'],[10,'low'],[14.99,'low'],[15,'medium'],[24.99,'medium'],[25,'high'],[29.99,'high'],[30,'excellent'],[60,'excellent']])assert.equal(marginTone(value),tone);
});
test('ISO weeks use the week year at calendar boundaries',()=>{
 for(const [date,key] of [['2021-01-01','2020-W53'],['2024-12-30','2025-W01'],['2026-09-30','2026-W40'],['2027-01-01','2026-W53']])assert.equal(isoWeekKey(new Date(`${date}T12:00:00`)),key);
});
test('all twenty reference EAN remain distinct and an empty selection is valid',()=>{
 assert.equal(DEFAULT_FOCUS_PRODUCTS.length,20);assert(validateFocusProducts(DEFAULT_FOCUS_PRODUCTS));assert(validateFocusProducts([]));assert(!validateFocusProducts([...DEFAULT_FOCUS_PRODUCTS,DEFAULT_FOCUS_PRODUCTS[0]]));assert(!validateFocusProducts([{ean:'123',name:'Invalid'}]));
});
test('focus totals include returns, omit unselected EAN and weight the margin',()=>{
 const products=DEFAULT_FOCUS_PRODUCTS.slice(0,3);
 const row=(ean,quantity,revenue,profit)=>({ean,itemNo:ean,quantity,revenue,profit,supplier:'Jordan',image:'/product.jpg'});
 const result=summarizeFocusProducts(products,[row(products[0].ean,3,600,120),row(products[0].ean,-1,-200,-40),row(products[1].ean,1,100,10),row('9999999999999',100,9999,9999)]);
 assert.equal(result.totals.revenue,500);assert.equal(result.totals.profit,90);assert.equal(result.totals.quantity,3);assert.equal(result.margin,18);assert.equal(result.selling,2);assert.equal(result.items[0].image,'/product.jpg');assert.equal(result.items[2].hasRows,false);assert.equal(result.items[2].revenue,0);
});
test('zero and negative net sales are not reported as positive coverage',()=>{
 const products=DEFAULT_FOCUS_PRODUCTS.slice(0,2);
 const result=summarizeFocusProducts(products,[{ean:products[0].ean,quantity:0,revenue:0,profit:0},{ean:products[1].ean,quantity:-1,revenue:-100,profit:-20}]);
 assert.equal(result.selling,0);assert(result.items.every(item=>item.hasRows));assert.equal(summarizeFocusProducts([],[]).margin,0);
});
test('legacy item numbers only act as EAN when they are exactly thirteen digits',()=>{
 assert.equal(focusEan({itemNo:'7311490032413'}),'7311490032413');assert.equal(focusEan({itemNo:'32413'}),'');assert.equal(focusEan({ean:'7311490032413',itemNo:'32413'}),'7311490032413');
});

const {buildSalesGroups,weightedSalesMargin}=require('../src/lib/sales-visuals.ts');
test('dashboard supplier charts preserve every supplier and signed returns',()=>{
 const rows=[{supplier:'Jotun',revenue:1000,profit:100,quantity:5},{supplier:'Infra',revenue:100,profit:40,quantity:1},{supplier:'Jotun',revenue:-200,profit:-20,quantity:-1},{supplier:'Øvrig',revenue:20,profit:-5,quantity:2}];
 const groups=buildSalesGroups(rows,'exterior');
 assert.equal(groups.length,3);assert.equal(groups.reduce((n,g)=>n+g.revenue,0),920);assert.equal(groups.reduce((n,g)=>n+g.profit,0),115);assert.equal(groups[0].quantity,4);assert.equal(groups[0].margin,10);
 assert.equal(weightedSalesMargin(rows),115/920*100);
});
test('dashboard category charts keep the four sales areas and unknown tool categories',()=>{
 const rows=[{area:'exterior',subgroup:'Maling',revenue:10,profit:2,quantity:1},{area:'interior',revenue:20,profit:6,quantity:1},{area:'terrace',revenue:30,profit:9,quantity:1},{area:'tools',revenue:40,profit:16,quantity:2}];
 const groups=buildSalesGroups(rows,'total');assert.equal(groups.length,4);assert.equal(groups[0].name,'Malerverktøy');assert.equal(groups.reduce((n,g)=>n+g.revenue,0),100);
 assert.equal(buildSalesGroups(rows.slice(3),'tools')[0].name,'Ikke klassifisert');assert.deepEqual(buildSalesGroups([],'total'),[]);assert.equal(weightedSalesMargin([]),0);
});
test('national category leaders use store totals rather than the best individual row',()=>{
 const {salesCategoryLeaders}=require('../src/lib/sales-visuals.ts');
 const leaders=salesCategoryLeaders([{area:'interior',storeId:'a',store:'A',revenue:1000,profit:100},{area:'interior',storeId:'a',store:'A',revenue:10,profit:10},{area:'interior',storeId:'b',store:'B',revenue:100,profit:20},{area:'tools',storeId:'c',store:'C',revenue:-100,profit:-30}]);
 assert.equal(leaders.length,1);assert.equal(leaders[0].store,'B');assert.equal(leaders[0].margin,20);
});

const {highestMarginProduct}=require('../src/lib/sales-visuals.ts');
test('Tønsberg: a positive one-unit sale wins over a negative two-unit product',()=>{
 const rows=[{product:'Drygolin Optimal',quantity:2,revenue:2320,profit:-39,margin:-1.7},{product:'Infra Oljebeis',quantity:1,revenue:388,profit:220,margin:56.7},{product:'Infra Superior Vindu / Dør',quantity:1,revenue:183,profit:87,margin:47.5}];
 const winner=highestMarginProduct(rows);assert.equal(winner.product,'Infra Oljebeis');assert.equal(winner.margin,220/388*100);
 assert.deepEqual(rows.map(row=>row.margin),[-1.7,56.7,47.5]);
});
test('highest sales margin excludes return-only and zero-revenue products',()=>{
 const rows=[{product:'Return',quantity:-1,revenue:-100,profit:-95},{product:'No revenue',quantity:1,revenue:0,profit:10},{product:'No sold units',quantity:0,revenue:100,profit:90},{product:'Sale',quantity:1,revenue:100,profit:20}];
 assert.equal(highestMarginProduct(rows).product,'Sale');assert.equal(highestMarginProduct(rows.slice(0,3)),undefined);assert.equal(highestMarginProduct([]),undefined);
});
test('highest margin remains negative when all actual sales lose money',()=>{
 const rows=[{product:'Loss 20',quantity:1,revenue:100,profit:-20},{product:'Loss 10',quantity:1,revenue:100,profit:-10}];
 assert.equal(highestMarginProduct(rows).product,'Loss 10');assert.equal(highestMarginProduct(rows).margin,-10);
});
test('highest margin is calculated from totals and supports fractional net sales',()=>{
 const rows=[{product:'Stale percentage',quantity:1,revenue:100,profit:10,margin:99},{product:'Actual winner',quantity:0.5,revenue:100,profit:40,margin:1},{product:'Invalid',quantity:1,revenue:100,profit:NaN,margin:999}];
 assert.equal(highestMarginProduct(rows).product,'Actual winner');assert.equal(highestMarginProduct(rows).margin,40);
});

const {aggregateDisplayProducts,productSubtitle}=require('../src/lib/display-products.ts');
const {buildPrintReport,reportGroups}=require('../src/lib/print-report.ts');
const reportRow=(extra={})=>({storeId:'3588',store:'Tønsberg',itemNo:'123',rawName:'Maling 10 L',product:'Maling',size:'10 L',supplier:'Jotun',area:'exterior',subgroup:'Murmaling',quantity:1,revenue:100,profit:25,margin:25,...extra});
test('print and screen share product grouping, returns and weighted margin',()=>{
 const rows=[reportRow({quantity:2,revenue:200,profit:20}),reportRow({ean:'9999999999999',revenue:100,profit:30}),reportRow({size:'3 L',quantity:-1,revenue:-50,profit:-10})];
 const products=aggregateDisplayProducts(rows);assert.equal(products.length,2);const ten=products.find(row=>row.size==='10 L');assert.equal(ten.quantity,3);assert.equal(ten.revenue,300);assert.equal(ten.profit,50);assert.equal(ten.margin,50/300*100);
});
const rollerRow=(ean,quantity,revenue,profit,extra={})=>reportRow({storeId:'3571',store:'Sandefjord',area:'tools',subgroup:'Ruller',supplier:'Jordan',product:'Jordan Ultimate jevne underlag malerull',rawName:`EAN ${ean}`,ean,itemNo:ean,productKey:`tools|Diverse|Jordan|ean-${ean}`,size:'',quantity,revenue,profit,margin:revenue?profit/revenue*100:0,...extra});
const sandefjordRollers=()=>[rollerRow('7311490032147',5,460,223.9),rollerRow('7311490032260',2,184,100.54),rollerRow('7311490032154',3,348,151.77)];
test('Sandefjord 26 October: the 18 cm roller remains 5 units rather than 5 + 2 + 3',()=>{
 const rows=sandefjordRollers(),before=JSON.stringify(rows),products=aggregateDisplayProducts(rows);
 assert.equal(products.length,3);const selected=products.find(row=>row.ean==='7311490032147');
 assert.equal(selected.quantity,5);assert.equal(selected.revenue,460);assert.equal(selected.profit,223.9);assert.equal(selected.margin,223.9/460*100);
 assert.deepEqual(products.map(row=>row.quantity),[5,2,3]);assert.equal(products.reduce((sum,row)=>sum+row.revenue,0),992);assert.equal(JSON.stringify(rows),before);
});
test('tool EAN stays separate even when both variants have the same known size and nearly identical prices',()=>{
 const products=aggregateDisplayProducts([rollerRow('7311490032147',2,200,50,{size:'18 cm'}),rollerRow('7311490032154',3,300,75,{size:'18 cm'})]);
 assert.equal(products.length,2);assert.deepEqual(products.map(row=>row.quantity),[2,3]);
});
test('same tool EAN aggregates exact sales and returns even if the display name or category changes',()=>{
 const products=aggregateDisplayProducts([rollerRow('7311490032147',6,552,268.68),rollerRow('7311490032147',-1,-92,-44.78,{product:'Jordan Ultimate 18 cm rull',subgroup:'Diverse',productKey:'renamed-key'})]);
 assert.equal(products.length,1);assert.equal(products[0].quantity,5);assert.equal(products[0].revenue,460);assert(Math.abs(products[0].profit-223.9)<1e-9);
});
test('legacy tool item numbers identify variants and national aggregation only combines the same EAN',()=>{
 const rows=[rollerRow('7311490032147',5,460,223.9,{ean:undefined}),rollerRow('7311490032147',7,644,313.46,{storeId:'5087',store:'Skien'}),rollerRow('7311490032154',3,348,151.77)];
 assert.equal(aggregateDisplayProducts(rows).length,3);const national=aggregateDisplayProducts(rows,false);
 assert.equal(national.length,2);assert.equal(national.find(row=>row.itemNo==='7311490032147').quantity,12);
 const noEan=[rollerRow('7311490032147',1,92,44.78,{ean:undefined,itemNo:'A1'}),rollerRow('7311490032154',1,116,50.59,{ean:undefined,itemNo:'A2'})];
 assert.equal(aggregateDisplayProducts(noEan).length,2);
});
test('tool subtitles expose variant identity when dimensions are absent',()=>{
 assert.equal(productSubtitle(sandefjordRollers()[0]),'EAN 7311490032147');
 assert.equal(productSubtitle(rollerRow('7311490032147',1,92,44.78,{product:'Jordan malerull 18cm'})),'18 cm');
 assert.equal(productSubtitle(reportRow({size:'2,7 L'})),'3 L');
});
test('print, product cards and the EAN focus list agree on the reported roller quantity',()=>{
 const rows=sandefjordRollers();const report={rows,date:'2026-10-26'};
 const pages=buildPrintReport(report,'3571',DEFAULT_FOCUS_PRODUCTS);
 for(const id of ['tools','total']){
  const page=pages.find(page=>page.id===id);assert.equal(page.products.find(row=>row.ean==='7311490032147').quantity,5);assert.equal(page.totals.quantity,10);assert.equal(page.totals.revenue,992);
 }
 const focus=pages.find(page=>page.id==='focus').focus;assert.equal(focus.items.find(item=>item.ean==='7311490032147').quantity,5);
});
test('one report page per tab, in menu order, including areas without sales',()=>{
 const pages=buildPrintReport({rows:[reportRow()],date:'2026-10-26'},'3588',DEFAULT_FOCUS_PRODUCTS);
 assert.deepEqual(pages.map(page=>page.id),['exterior','interior','terrace','tools','focus','total']);assert.equal(pages.length,6);
 assert.equal(pages[0].totals.revenue,100);assert.equal(pages[1].totals.revenue,0);assert.equal(pages[1].products.length,0);assert.equal(pages[5].totals.revenue,100);assert.equal(pages[4].focus.items.length,20);
});
test('print uses selected-store figures and retains its true rank outside the top five',()=>{
 const rows=Array.from({length:8},(_,i)=>reportRow({storeId:String(i),store:'Varehus '+i,revenue:1000,profit:(8-i)*100}));
 const pages=buildPrintReport({rows,date:'2026-10-26'},'7',[]);assert.equal(pages[0].totals.profit,100);assert.equal(pages[0].selectedRank,8);assert.deepEqual(pages[0].regionalStores.map(store=>store.rank),[1,2,3,4,8]);
 const national=buildPrintReport({rows,date:'2026-10-26'},'__all__',[]);assert.equal(national[0].totals.revenue,8000);assert.equal(national[0].stores.length,8);
});
test('print focus totals equal the focus dashboard and preserve zero-selling selected items',()=>{
 const list=DEFAULT_FOCUS_PRODUCTS.slice(0,3);const rows=[reportRow({ean:list[0].ean,revenue:200,profit:60}),reportRow({ean:list[1].ean,quantity:-1,revenue:-100,profit:-20}),reportRow({ean:'9999999999999',revenue:10000,profit:5000})];
 const page=buildPrintReport({rows,date:'2026-10-26'},'3588',list).find(page=>page.id==='focus');const screen=summarizeFocusProducts(list,rows);
 assert.equal(page.totals.revenue,screen.totals.revenue);assert.equal(page.totals.profit,screen.totals.profit);assert.equal(page.totals.margin,screen.margin);assert.equal(page.focus.items.length,3);assert.equal(page.focus.selling,1);assert.equal(page.focus.items.find(item=>item.ean===list[2].ean).hasRows,false);
});
test('print preserves legacy category fallback and all remaining category totals',()=>{
 const pages=buildPrintReport({rows:[reportRow({subgroup:undefined,category:'Vindu / Dør'})],date:'2026-10-26'},'3588',[]);assert.equal(pages[0].categories[0].name,'Vindu / Dør');
 const groups=Array.from({length:10},(_,i)=>({name:String(i),revenue:100-i,profit:10,quantity:1,margin:10,color:'#000'}));const listed=reportGroups(groups,7);assert.equal(listed.length,8);assert.equal(listed[7].name,'Andre underkategorier');assert.equal(listed.reduce((sum,item)=>sum+item.revenue,0),groups.reduce((sum,item)=>sum+item.revenue,0));
});

const {createPrintReportPdf}=require('../src/lib/print-pdf.ts');
const {PDFDocument}=require('pdf-lib');
const pdfFonts={regular:fs.readFileSync(require.resolve('../public/fonts/NotoSans-Regular.ttf')),bold:fs.readFileSync(require.resolve('../public/fonts/NotoSans-Bold.ttf'))};
const pdfInput=(rows,extra={})=>({report:{rows,date:'2026-10-26'},selectedStoreId:'3588',storeName:'Tønsberg',periodLabel:'Dag · mandag 26. oktober 2026',period:'Dag',focusProducts:DEFAULT_FOCUS_PRODUCTS,fonts:pdfFonts,...extra});
test('print button output is a physical six-page A4 PDF, including empty areas',async()=>{
 const bytes=await createPrintReportPdf(pdfInput([reportRow({area:'interior'})]));
 const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),6);
 for(const page of pdf.getPages()){assert(Math.abs(page.getWidth()-595.2756)<0.01);assert(Math.abs(page.getHeight()-841.8898)<0.01)}
 assert.match(pdf.getTitle(),/Tønsberg/);
});
test('dense interiors, long names, returns and large annual figures remain six fixed PDF pages',async()=>{
 const rows=Array.from({length:1200},(_,i)=>reportRow({product:`Butinox interiørmaling for treverk, vegg og tak – glans ${i%12}`,area:['exterior','interior','terrace','tools'][i%4],subgroup:`Underkategori ${i%10}`,ean:DEFAULT_FOCUS_PRODUCTS[i%20].ean,revenue:i%7?-123456.7:3456789.2,profit:i%7?-12345.7:456789,quantity:i%7?-1:4}));
 const pdf=await PDFDocument.load(await createPrintReportPdf(pdfInput(rows,{period:'År',periodLabel:'År · 2026',storeName:'Et ekstra langt varehusnavn for kontroll av rapportens tekstfelt'})));
 assert.equal(pdf.getPageCount(),6);
});
test('failed or invalid product images do not remove any PDF report pages',async()=>{
 let imageRequests=0;
 const bytes=await createPrintReportPdf(pdfInput([reportRow({ean:DEFAULT_FOCUS_PRODUCTS[0].ean})],{loadImage:async()=>{imageRequests++;throw new Error('Unavailable image')}}));
 assert(imageRequests>1);assert.equal((await PDFDocument.load(bytes)).getPageCount(),6);
});

test('an old item number and its EAN are one tool card, and goods sharing a name stay apart',()=>{
 const url=ean=>`https://www.obsbygg.no/tape/1?v=ObsBygg-${ean}`;
 const row=(itemNo,ean,quantity,revenue,extra={})=>({storeId:'1',store:'A',itemNo,ean,rawName:'',product:'Tesa tape',size:'3 L',supplier:'Jordan',area:'tools',subgroup:'Tape',quantity,revenue,profit:revenue/2,margin:50,productKey:itemNo,productUrl:url(ean||'4042448563378'),...extra});
 const merged=aggregateDisplayProducts([row('7146827',undefined,11,1404),row('4042448563378','4042448563378',23,1183)]);
 assert.equal(merged.length,1);assert.equal(merged[0].quantity,34);assert.equal(merged[0].revenue,2587);assert.equal(merged[0].ean,'4042448563378');
 const widths=aggregateDisplayProducts([row('1',undefined,1,10,{productUrl:'',rawName:'RULL 10CM'}),row('2',undefined,1,10,{productUrl:'',rawName:'RULL 18CM'}),row('3',undefined,1,10,{productUrl:'',rawName:'RULL 25CM'})]);
 assert.equal(widths.length,3);
 const unsure=aggregateDisplayProducts([row('5317615',undefined,1,10),row('3705001',undefined,1,10)]);
 assert.equal(unsure.length,2);
});
test('tools do not show litres from the product page, but liquids and paint keep their size',()=>{
 const base={storeId:'1',store:'A',itemNo:'1',rawName:'',product:'Jordan rull',supplier:'Jordan',quantity:1,revenue:1,profit:1,margin:100};
 assert.equal(productSubtitle({...base,area:'tools',subgroup:'Ruller',size:'3 L',rawName:'JORDAN RULL 18CM'}),'18 cm');
 assert.equal(productSubtitle({...base,area:'tools',subgroup:'Tape',size:'3 L',ean:'123'}),'EAN 123');
 assert.equal(productSubtitle({...base,area:'tools',subgroup:'Rensemidler',size:'1 L'}),'1 L');
 assert.equal(productSubtitle({...base,area:'interior',subgroup:'Matt',size:'3 L'}),'3 L');
});
test('filler is never merged like paint',()=>{
 const row=(ean,size)=>({storeId:'1',store:'A',itemNo:ean,ean,rawName:'',product:'Butinox finsparkel',size,supplier:'Butinox',area:'interior',subgroup:'Sparkel',quantity:1,revenue:100,profit:50,margin:50});
 assert.equal(aggregateDisplayProducts([row('1111111111111',''),row('2222222222222','3 L')]).length,2);
});
