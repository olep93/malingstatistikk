import {handleUpload,type HandleUploadBody} from '@vercel/blob/client';
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

    const token=process.env.BLOB_READ_WRITE_TOKEN;
    if(!token){
      return NextResponse.json({
        error:'Vercel Blob er ikke koblet til denne deploymenten. Koble et Blob-lager til prosjektet og kontroller at BLOB_READ_WRITE_TOKEN finnes for Production, Preview og Development, og deploy deretter på nytt.'
      },{status:503});
    }

    const body=(await request.json()) as HandleUploadBody;
    const jsonResponse=await handleUpload({
      token,
      body,
      request,
      onBeforeGenerateToken:async(pathname)=>{
        if(!/\.xls(x)?$/i.test(pathname))throw new Error('Bare .xlsx og .xls støttes');
        return {
          allowedContentTypes:EXCEL_TYPES,
          maximumSizeInBytes:100*1024*1024,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({username:session.username})
        };
      }
    });
    return NextResponse.json(jsonResponse);
  }catch(error){
    const raw=error instanceof Error?error.message:String(error);
    const message=/token|credential|blob/i.test(raw)
      ? `Vercel Blob kunne ikke utstede opplastingstoken. Kontroller BLOB_READ_WRITE_TOKEN i Vercel og deploy på nytt. Teknisk melding: ${raw}`
      : raw;
    return NextResponse.json({error:message},{status:400});
  }
}
