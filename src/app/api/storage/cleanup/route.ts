import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {ensureSchema} from '@/lib/server/db';
import {blobStorageAudit} from '@/lib/server/blob-cleanup';

export const maxDuration=60;
export async function GET(){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan kontrollere lagringsplassen.'},{status:403});
  try{await ensureSchema();return NextResponse.json(await blobStorageAudit(false))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke kontrollere lagringen'},{status:500})}
}
export async function DELETE(){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan rydde lagringsplassen.'},{status:403});
  try{await ensureSchema();return NextResponse.json(await blobStorageAudit(true))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke rydde lagringen'},{status:500})}
}
