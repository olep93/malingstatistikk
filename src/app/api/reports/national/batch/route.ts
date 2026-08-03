import {NextResponse} from "next/server";
import {getSession} from "@/lib/server/auth";
import {ensureSchema,sql} from "@/lib/server/db";
import {aggregateProducts,canonicalizeRow} from "@/lib/data";
import {cleanProductName} from "@/lib/text";

export const maxDuration=60;

export async function POST(req:Request){
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
 try{
  await ensureSchema();
  const body=await req.json();
  const date=String(body.date||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({error:"Ugyldig rapportdato"},{status:400});
  const input=Array.isArray(body.rows)?body.rows:[];
  if(!input.length)return NextResponse.json({error:"Ingen salgslinjer mottatt"},{status:400});
  if(input.length>500)return NextResponse.json({error:"For mange linjer i én batch. Maks 500."},{status:400});
  const rows=aggregateProducts(input.map((row:any)=>canonicalizeRow(row))).map((r:any)=>({
    store_id:String(r.storeId||"unknown"),store_name:String(r.store||"Ukjent varehus"),product_key:String(r.productKey||""),
    item_no:String(r.itemNo||r.ean||""),ean:r.ean?String(r.ean):null,raw_name:cleanProductName(r.rawName||r.product||""),
    product_name:cleanProductName(r.product||"")||"Ukjent produkt",size:String(r.size||""),supplier:String(r.supplier||"Øvrig"),
    category:r.category||null,area:r.area||null,subgroup:r.subgroup||null,quantity:Number(r.quantity||0),revenue:Number(r.revenue||0),profit:Number(r.profit||0),
    image_url:r.image||null,product_url:r.productUrl||null
  }));
  const q=sql();
  await q`INSERT INTO paint_report_rows(report_date,store_id,store_name,product_key,item_no,ean,raw_name,product_name,size,supplier,category,area,subgroup,quantity,revenue,profit,image_url,product_url,source_updated_at)
    SELECT ${date}::date,x.store_id,x.store_name,x.product_key,x.item_no,x.ean,x.raw_name,x.product_name,x.size,x.supplier,x.category,x.area,x.subgroup,x.quantity,x.revenue,x.profit,x.image_url,x.product_url,now()
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(store_id text,store_name text,product_key text,item_no text,ean text,raw_name text,product_name text,size text,supplier text,category text,area text,subgroup text,quantity numeric,revenue numeric,profit numeric,image_url text,product_url text)
    ON CONFLICT(report_date,store_id,product_key) DO UPDATE SET store_name=excluded.store_name,item_no=excluded.item_no,ean=excluded.ean,raw_name=excluded.raw_name,product_name=excluded.product_name,size=excluded.size,supplier=excluded.supplier,category=excluded.category,area=excluded.area,subgroup=excluded.subgroup,quantity=excluded.quantity,revenue=excluded.revenue,profit=excluded.profit,image_url=excluded.image_url,product_url=excluded.product_url,source_updated_at=excluded.source_updated_at`;
  return NextResponse.json({ok:true,written:rows.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke lagre importbatch"},{status:500})}
}
