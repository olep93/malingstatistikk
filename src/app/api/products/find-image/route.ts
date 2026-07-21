import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/server/auth';
import { findObsbyggImage } from '@/lib/server/product-images';
export async function POST(req:Request){
 if(!(await isAuthenticated())) return NextResponse.json({error:'Ikke innlogget'},{status:401});
 try{return NextResponse.json(await findObsbyggImage(await req.json()))}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Bildeoppslag feilet'},{status:500})}
}
