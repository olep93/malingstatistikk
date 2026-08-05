import {issueSignedToken} from '@vercel/blob';
import {handleUploadPresigned,type HandleUploadPresignedBody} from '@vercel/blob/client';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/server/auth';

const EXCEL_TYPES=[
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream'
];

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request):Promise<NextResponse>{
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:'Innloggingen er utløpt. Logg inn på nytt og prøv igjen.'},{status:401});
    if(!['admin','leader'].includes(session.role))return NextResponse.json({error:'Du har ikke tilgang til historikkimport.'},{status:403});

    const body=(await request.json()) as HandleUploadPresignedBody;
    const jsonResponse=await handleUploadPresigned({
      body,
      request,
      webhookPublicKey:process.env.BLOB_WEBHOOK_PUBLIC_KEY,
      getSignedToken:async(pathname)=>{
        if(!/\.xls(x)?$/i.test(pathname))throw new Error('Bare .xlsx og .xls støttes');
        const token=await issueSignedToken({
          pathname,
          operations:['put'],
          allowedContentTypes:EXCEL_TYPES,
          maximumSizeInBytes:100*1024*1024,
          validUntil:Date.now()+60*60*1000
        });
        return {
          token,
          urlOptions:{
            allowedContentTypes:EXCEL_TYPES,
            maximumSizeInBytes:100*1024*1024,
            validUntil:Date.now()+15*60*1000,
            addRandomSuffix:true,
            allowOverwrite:false
          }
        };
      }
    });
    return NextResponse.json(jsonResponse);
  }catch(error){
    const raw=error instanceof Error?error.message:String(error);
    const message=/oidc|store.?id|blob/i.test(raw)
      ? `Vercel Blob kunne ikke opprette en sikker opplastingsadresse. Kontroller at Blob-lageret er koblet til prosjektet og at BLOB_STORE_ID, BLOB_WEBHOOK_PUBLIC_KEY og Vercels systemvariabler er tilgjengelige. Teknisk melding: ${raw}`
      : raw;
    return NextResponse.json({error:message},{status:400});
  }
}
