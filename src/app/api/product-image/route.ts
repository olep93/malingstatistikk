import { NextRequest, NextResponse } from 'next/server';
import { findObsbyggImage } from '@/lib/server/product-images';

export const maxDuration = 30;

function placeholder(){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420"><rect width="420" height="420" fill="#f5f8fb"/><g fill="none" stroke="#8ea0b3" stroke-width="12" stroke-linecap="round"><rect x="110" y="120" width="200" height="190" rx="18"/><path d="M145 120v-22h130v22M135 170h150M170 220h80"/></g><text x="210" y="350" text-anchor="middle" font-family="Arial" font-size="22" fill="#718397">Bilde ikke funnet</text></svg>`;
  return new NextResponse(svg,{status:200,headers:{'content-type':'image/svg+xml','cache-control':'public, max-age=300'}});
}

export async function GET(req:NextRequest){
  const p=req.nextUrl.searchParams;
  const productName=p.get('product')||'';
  const supplier=p.get('supplier')||'';
  const size=p.get('size')||'';
  const ean=p.get('ean')||'';
  const productKey=p.get('key')||[supplier,productName,size].join('|');
  if(!productName)return placeholder();
  try{
    const result=await findObsbyggImage({productName,supplier,size,ean,productKey});
    if(result.found && result.imageUrl){
      return NextResponse.redirect(result.imageUrl,302);
    }
  }catch{}
  return placeholder();
}
