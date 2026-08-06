import {NextResponse} from "next/server";
import {getSession} from "@/lib/server/auth";
import {ensureSchema,sql} from "@/lib/server/db";

const LEGACY_URL="https://app.powerbi.com/groups/me/apps/f783e097-ebcd-40a4-804f-407f5c336100/reports/62ba850e-b3df-4293-bc24-a646aaa1521f/1ebd391c27bd209ada9b?ctid=ad12c024-e320-4b19-aa0b-b0c36c136e70&experience=power-bi";
const DEFAULT_URL="https://app.powerbi.com/groups/me/apps/f783e097-ebcd-40a4-804f-407f5c336100/reports/62ba850e-b3df-4293-bc24-a646aaa1521f/1ebd391c27bd209ada9b?action=OpenReport&ctid=ad12c024-e320-4b19-aa0b-b0c36c136e70&pbi_source=ChatInTeams&bookmarkGuid=4506ec57-1b8b-45f8-9977-639d8c25af91";

function validBiUrl(value:string){
  try{const url=new URL(value);return url.protocol==="https:"&&url.hostname==="app.powerbi.com"&&url.pathname.includes("/reports/")&&Boolean(url.searchParams.get("ctid"))}catch{return false}
}

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
  try{await ensureSchema();const q=sql();const rows=await q`SELECT setting_value,updated_by,updated_at FROM app_settings WHERE setting_key='bi_report_url'`;const saved=String(rows[0]?.setting_value||"");const url=saved===LEGACY_URL?DEFAULT_URL:validBiUrl(saved)?saved:DEFAULT_URL;return NextResponse.json({url,updatedBy:rows[0]?.updated_by||null,updatedAt:rows[0]?.updated_at||null})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke hente BI-lenken"},{status:500})}
}

export async function POST(req:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Ikke innlogget"},{status:401});
  if(session.role!=="admin")return NextResponse.json({error:"Kun administrator kan endre BI-lenken"},{status:403});
  try{const {url}=await req.json();const value=String(url||"").trim();if(!validBiUrl(value))return NextResponse.json({error:"Lenken må være en gyldig rapportlenke fra app.powerbi.com"},{status:400});await ensureSchema();const q=sql();await q`INSERT INTO app_settings(setting_key,setting_value,updated_by,updated_at) VALUES('bi_report_url',${value},${session.username},now()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=now()`;return NextResponse.json({ok:true,url:value,updatedBy:session.username,updatedAt:new Date().toISOString()})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kunne ikke lagre BI-lenken"},{status:500})}
}
