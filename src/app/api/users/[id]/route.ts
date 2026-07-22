import {NextResponse} from 'next/server';
import {getSession,hashPassword,isAdmin} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan endre brukere.'},{status:403});
 try{await ensureSchema();const {id}=await params;const body=await req.json();const q=sql();const current=(await q`SELECT id,username,role FROM app_users WHERE id=${id}::bigint`)[0] as any;if(!current)return NextResponse.json({error:'Brukeren finnes ikke.'},{status:404});const username=String(body.username||current.username).trim(),displayName=String(body.displayName||username).trim(),role=body.role==='admin'?'admin':'leader',isActive=body.isActive!==false;const password=String(body.password||'');if(password){const p=hashPassword(password);await q`UPDATE app_users SET username=${username},display_name=${displayName},role=${role},is_active=${isActive},password_hash=${p.hash},password_salt=${p.salt},updated_at=now() WHERE id=${id}::bigint`;}else{await q`UPDATE app_users SET username=${username},display_name=${displayName},role=${role},is_active=${isActive},updated_at=now() WHERE id=${id}::bigint`;}
 return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke endre bruker'},{status:500})}
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan slette brukere.'},{status:403});
 try{await ensureSchema();const {id}=await params;const session=await getSession();const q=sql();const target=(await q`SELECT username,role FROM app_users WHERE id=${id}::bigint`)[0] as any;if(!target)return NextResponse.json({error:'Brukeren finnes ikke.'},{status:404});if(target.username===session?.username)return NextResponse.json({error:'Du kan ikke slette brukeren du er logget inn som.'},{status:400});const admins=await q`SELECT count(*)::int AS count FROM app_users WHERE role='admin' AND is_active=true`;if(target.role==='admin'&&(admins[0]?.count||0)<=1)return NextResponse.json({error:'Den siste aktive Admin-brukeren kan ikke slettes.'},{status:400});await q`DELETE FROM app_users WHERE id=${id}::bigint`;return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke slette bruker'},{status:500})}
}
