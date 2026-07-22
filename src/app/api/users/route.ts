import {NextResponse} from 'next/server';
import {ensureDefaultUsers,hashPassword,isAdmin} from '@/lib/server/auth';
import {sql} from '@/lib/server/db';

export async function GET(){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan administrere brukere.'},{status:403});
 try{await ensureDefaultUsers();const q=sql();const users=await q`SELECT id::text,username,display_name,role,is_active,created_at,updated_at,last_login_at FROM app_users ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END,lower(display_name)`;return NextResponse.json({users});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente brukere'},{status:500})}
}
export async function POST(req:Request){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan opprette brukere.'},{status:403});
 try{await ensureDefaultUsers();const body=await req.json();const username=String(body.username||'').trim(),displayName=String(body.displayName||username).trim(),password=String(body.password||''),role=body.role==='admin'?'admin':'leader';if(!username||!displayName||password.length<6)return NextResponse.json({error:'Brukernavn, navn og passord på minst 6 tegn kreves.'},{status:400});const p=hashPassword(password);const q=sql();const rows=await q`INSERT INTO app_users(username,display_name,role,password_hash,password_salt,is_active) VALUES(${username},${displayName},${role},${p.hash},${p.salt},true) RETURNING id::text,username,display_name,role,is_active`;return NextResponse.json({ok:true,user:rows[0]});}
 catch(e:any){const msg=String(e?.message||'');return NextResponse.json({error:msg.includes('unique')?'Brukernavnet finnes allerede.':msg||'Kunne ikke opprette bruker'},{status:500})}
}
