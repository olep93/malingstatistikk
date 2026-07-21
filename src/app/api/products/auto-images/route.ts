import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/auth';
import { findObsbyggImage } from '@/lib/server/product-images';

export const maxDuration = 60;
export async function POST(req:Request){
  if(!(await isAdmin())) return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{
    const {rows=[]}=await req.json();
    const unique = new Map<string,any>();
    for(const row of rows){
      const key=row.productKey||[row.supplier,row.product,row.size||''].join('|');
      if(!unique.has(key)) unique.set(key,{productKey:key,productName:row.product,rawName:row.rawName,supplier:row.supplier,size:row.size,ean:row.itemNo,area:row.area,subgroup:row.subgroup});
    }
    const items=[...unique.values()].slice(0,8);
    const results=[];
    for(let i=0;i<items.length;i+=2){
      const batch=items.slice(i,i+2);
      results.push(...await Promise.all(batch.map(x=>findObsbyggImage(x).catch(()=>({found:false})))));
    }
    return NextResponse.json({ok:true,found:results.filter((x:any)=>x.found).length,checked:items.length});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bildeoppslag feilet'},{status:500})}
}
