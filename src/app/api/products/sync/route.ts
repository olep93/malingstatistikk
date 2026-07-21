import {NextResponse} from 'next/server';
import {isAuthenticated} from '@/lib/server/auth';
import {findObsbyggImage} from '@/lib/server/product-images';

export const maxDuration=60;
export async function POST(req:Request){
 if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
 try{
  const {rows=[],force=false}=await req.json();
  const unique=new Map<string,any>();
  for(const row of rows){const key=row.productKey||[row.area,row.subgroup,row.supplier,row.product,row.size||''].join('|');if(!unique.has(key))unique.set(key,{productKey:key,productName:row.product,rawName:row.rawName,supplier:row.supplier,size:row.size,ean:row.itemNo,area:row.area,subgroup:row.subgroup});}
  const items=[...unique.values()].slice(0,1);const results=[];
  for(const item of items)results.push(await findObsbyggImage(item,{force}).catch((e)=>({found:false,status:'error',error:e instanceof Error?e.message:'Oppslag feilet'})));
  return NextResponse.json({ok:true,checked:items.length,found:results.filter((x:any)=>x.found).length,cached:results.filter((x:any)=>x.source==='database').length,notFound:results.filter((x:any)=>!x.found).length,results});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Produktsynkronisering feilet'},{status:500})}
}
