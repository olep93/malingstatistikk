import {NextResponse} from 'next/server';
import {isAuthenticated} from '@/lib/server/auth';
import {findObsbyggImage} from '@/lib/server/product-images';
import {ensureSchema,sql} from '@/lib/server/db';

export const maxDuration=60;

type SyncItem={productKey:string;productName:string;rawName?:string;supplier:string;size?:string;ean?:string;area?:string;subgroup?:string};

export async function POST(req:Request){
 if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
 try{
  await ensureSchema();
  const {rows=[],force=false}=await req.json();
  const unique=new Map<string,SyncItem>();
  for(const row of rows){
   const key=row.productKey||[row.area,row.subgroup,row.supplier,row.product,row.size||''].join('|');
   if(!unique.has(key))unique.set(key,{productKey:key,productName:row.product,rawName:row.rawName,supplier:row.supplier,size:row.size,ean:row.itemNo||row.ean,area:row.area,subgroup:row.subgroup});
  }
  const items=[...unique.values()].slice(0,75);
  if(!items.length)return NextResponse.json({ok:true,checked:0,found:0,cached:0,notFound:0,results:[]});

  const q=sql();
  const keys=items.map(x=>x.productKey);
  const existing=await q`SELECT product_key,lookup_status,last_fetched_at,normalization_version,image_url,display_name,website_name,product_url,category,subgroup
    FROM paint_products WHERE product_key=ANY(${keys}::text[])`;
  const byKey=new Map((existing as any[]).map(r=>[String(r.product_key),r]));
  const freshCutoff=Date.now()-90*86400000;
  const results:any[]=[];
  const lookups:SyncItem[]=[];

  for(const item of items){
   const row:any=byKey.get(item.productKey);
   const fresh=row?.last_fetched_at&&new Date(row.last_fetched_at).getTime()>freshCutoff;
   const normalized=Number(row?.normalization_version||0)>=3;
   if(!force&&row&&fresh&&normalized){
    results.push({found:row.lookup_status==='found',source:'database',status:row.lookup_status,displayName:row.display_name,websiteName:row.website_name,imageUrl:row.image_url,url:row.product_url,category:row.category,subgroup:row.subgroup});
   }else lookups.push(item);
  }

  // Only genuinely new/stale products hit obsbygg.no. Small parallel groups keep the request fast without overloading the site.
  for(let i=0;i<lookups.length;i+=5){
   const group=lookups.slice(i,i+5);
   const groupResults=await Promise.all(group.map(item=>findObsbyggImage(item,{force}).catch((e)=>({found:false,status:'error',error:e instanceof Error?e.message:'Oppslag feilet'}))));
   results.push(...groupResults);
  }
  return NextResponse.json({ok:true,checked:items.length,found:results.filter(x=>x.found&&x.source!=='database').length,cached:results.filter(x=>x.source==='database').length,notFound:results.filter(x=>!x.found).length,results});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Produktsynkronisering feilet'},{status:500})}
}
