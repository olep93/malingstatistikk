import {NextResponse} from 'next/server';
import {getSession,isAdmin} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan endre brukere.'},{status:403});
 try{await ensureSchema();const {id}=await params;const body=await req.json();const q=sql();const current=(await q`SELECT id,display_name,email,role FROM app_users WHERE id=${id}::bigint`)[0] as any;if(!current)return NextResponse.json({error:'Brukeren finnes ikke.'},{status:404});const displayName=String(body.displayName||current.display_name).trim(),email=String(body.email??current.email??'').trim().toLowerCase()||null,role=current.role==='admin'?'admin':body.role==='viewer'?'viewer':'uploader',isActive=body.isActive!==false;
 if(email&&!/^[^@\s]+@[^@\s]+$/.test(email))return NextResponse.json({error:'Ugyldig e-post.'},{status:400});
 const session=await getSession();if(String(current.id)===session?.id&&(role!=='admin'||!isActive))return NextResponse.json({error:'Du kan ikke fjerne din egen Admin-tilgang.'},{status:400});
 await q`UPDATE app_users SET display_name=${displayName},email=${email},role=${role},is_active=${isActive},updated_at=now() WHERE id=${id}::bigint`;
 return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke endre bruker'},{status:500})}
}
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan slette brukere.'},{status:403});
 try{await ensureSchema();const {id}=await params;const session=await getSession();const q=sql();const target=(await q`SELECT id::text,role FROM app_users WHERE id=${id}::bigint`)[0] as any;if(!target)return NextResponse.json({error:'Brukeren finnes ikke.'},{status:404});if(target.id===session?.id)return NextResponse.json({error:'Du kan ikke slette brukeren du er logget inn som.'},{status:400});const admins=await q`SELECT count(*)::int AS count FROM app_users WHERE role='admin' AND is_active=true`;if(target.role==='admin'&&(admins[0]?.count||0)<=1)return NextResponse.json({error:'Den siste aktive Admin-brukeren kan ikke slettes.'},{status:400});await q`DELETE FROM app_users WHERE id=${id}::bigint`;return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke slette bruker'},{status:500})}
}
