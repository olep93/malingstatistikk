import { NextResponse } from 'next/server';
import {canUpload} from '@/lib/server/auth';
import { findObsbyggImage } from '@/lib/server/product-images';
export async function POST(req:Request){
 if(!(await canUpload())) return NextResponse.json({error:'Rollen din kan bare se rapporter.'},{status:403});
 try{return NextResponse.json(await findObsbyggImage(await req.json()))}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bildeoppslag feilet'},{status:500})}
}
