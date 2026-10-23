import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

// Users are created in the portal (jobbverktoy.no) and appear here the first time they open the app.
export async function GET(){
 if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan administrere brukere.'},{status:403});
 try{await ensureSchema();const q=sql();const users=await q`SELECT id::text,username,display_name,email,role,is_active,supabase_sub IS NOT NULL AS linked,created_at,updated_at,last_login_at FROM app_users ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END,lower(display_name)`;return NextResponse.json({users});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente brukere'},{status:500})}
}
