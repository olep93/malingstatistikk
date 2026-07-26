import {NextResponse} from "next/server";
import {getSession} from "@/lib/server/auth";
import {ensureSchema,sql} from "@/lib/server/db";

const DEFAULT_URL="https://bi.coop.no/BOE/OpenDocument/opendoc/openDocument.jsp?sIDType=CUID&iDocID=AWy2QvRaEdFMmgGWQNqOsek&BOOKMARK=AUubX.RpQhtFiVHTx7t9xXo";

function validBiUrl(value:string){
  try{const url=new URL(value);return url.protocol==="https:"&&url.hostname==="bi.coop.no"&&url.pathname.includes("/BOE/OpenDocument/")&&Boolean(url.searchParams.get("iDocID"))&&Boolean(url.searchParams.get("BOOKMARK"))}catch{return false}
}

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
  try{await ensureSchema();const q=sql();const rows=await q`SELECT setting_value,updated_by,updated_at FROM app_settings WHERE setting_key='bi_report_url'`;return NextResponse.json({url:String(rows[0]?.setting_value||DEFAULT_URL),updatedBy:rows[0]?.updated_by||null,updatedAt:rows[0]?.updated_at||null})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke hente BI-lenken"},{status:500})}
}

export async function POST(req:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
  if(session.role!=="admin")return NextResponse.json({error:"Kun administrator kan endre BI-lenken"},{status:403});
  try{const {url}=await req.json();const value=String(url||"").trim();if(!validBiUrl(value))return NextResponse.json({error:"Lenken må være en gyldig BI-lenke med både iDocID og BOOKMARK"},{status:400});await ensureSchema();const q=sql();await q`INSERT INTO app_settings(setting_key,setting_value,updated_by,updated_at) VALUES('bi_report_url',${value},${session.username},now()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=now()`;return NextResponse.json({ok:true,url:value,updatedBy:session.username,updatedAt:new Date().toISOString()})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke lagre BI-lenken"},{status:500})}
}
