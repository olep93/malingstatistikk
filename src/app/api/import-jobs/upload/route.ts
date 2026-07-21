import {handleUpload,type HandleUploadBody} from '@vercel/blob/client';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/server/auth';

const EXCEL_TYPES=[
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream'
];

export async function POST(request:Request):Promise<NextResponse>{
  const body=(await request.json()) as HandleUploadBody;
  try{
    const jsonResponse=await handleUpload({
      body,
      request,
      onBeforeGenerateToken:async(pathname)=>{
        const session=await getSession();
        if(!session)throw new Error('Ikke innlogget');
        if(!/\.xls(x)?$/i.test(pathname))throw new Error('Bare .xlsx og .xls støttes');
        return {
          allowedContentTypes:EXCEL_TYPES,
          maximumSizeInBytes:100*1024*1024,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({username:session.username})
        };
      },
      onUploadCompleted:async()=>{}
    });
    return NextResponse.json(jsonResponse);
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400});
  }
}
