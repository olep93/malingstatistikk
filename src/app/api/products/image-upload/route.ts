import {NextResponse} from 'next/server';
import {put} from '@vercel/blob';
import {isAdmin} from '@/lib/server/auth';
export const maxDuration=30;
export async function POST(req:Request){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan laste opp produktbilder.'},{status:403});
 try{const form=await req.formData();const file=form.get('file');const productKey=String(form.get('productKey')||'produkt').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,80);
 if(!(file instanceof File)||!file.size)return NextResponse.json({error:'Velg et bilde.'},{status:400});
 if(!file.type.startsWith('image/'))return NextResponse.json({error:'Filen må være et bilde.'},{status:400});
 if(file.size>8*1024*1024)return NextResponse.json({error:'Bildet kan ikke være større enn 8 MB.'},{status:400});
 const blob=await put(`product-images/${productKey}-${Date.now()}-${file.name}`,file,{access:'public',addRandomSuffix:true});return NextResponse.json({ok:true,url:blob.url});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke laste opp bilde'},{status:500})}}
