import {NextResponse} from 'next/server';
import {isAdmin,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

async function stats(){
  const q=sql();
  const rows=await q`SELECT
    count(*)::int total,
    count(*) FILTER (WHERE website_name IS NULL OR website_name='')::int without_website_name,
    count(*) FILTER (WHERE subgroup IS NULL OR subgroup='')::int without_tag,
    count(*) FILTER (WHERE display_name IS NULL OR display_name='' OR (source_name IS NOT NULL AND lower(display_name)=lower(source_name)))::int source_name_as_display,
    count(*) FILTER (WHERE lookup_status<>'found')::int needs_review,
    count(*) FILTER (WHERE display_name_locked OR subgroup_locked)::int manually_locked
    FROM paint_products`;
  const duplicates=await q`SELECT count(*)::int count FROM (
    SELECT lower(regexp_replace(COALESCE(NULLIF(display_name,''),NULLIF(website_name,''),source_name),'[^a-zA-Z0-9æøåÆØÅ]+','','g')) key
    FROM paint_products
    WHERE COALESCE(display_name,website_name,source_name) IS NOT NULL
    GROUP BY 1 HAVING count(*)>1
  ) d`;
  return {...rows[0],possible_duplicates:duplicates[0]?.count||0};
}

export async function GET(){
  if(!(await isAuthenticated()))return NextResponse.json({error:'Ikke innlogget'},{status:401});
  try{await ensureSchema();return NextResponse.json({audit:await stats()});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke kontrollere produktmasteren'},{status:500})}
}

export async function POST(){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan rydde produktmasteren.'},{status:403});
  try{
    await ensureSchema();
    const q=sql();
    // Bruk nettsidenavn som visningsnavn når Admin ikke har låst navnet.
    await q`UPDATE paint_products SET display_name=website_name,updated_at=now()
      WHERE COALESCE(display_name_locked,false)=false
        AND website_name IS NOT NULL AND website_name<>''
        AND display_name IS DISTINCT FROM website_name`;
    // Sørg for at nåværende navn alltid er søkbart som alias.
    await q`UPDATE paint_products SET aliases=(
      SELECT COALESCE(jsonb_agg(DISTINCT to_jsonb(v)), '[]'::jsonb)
      FROM unnest(ARRAY[NULLIF(source_name,''),NULLIF(website_name,''),NULLIF(display_name,'')]) v
      WHERE v IS NOT NULL
    ),updated_at=now()`;
    // Produkter uten nettstedstreff skal ligge i kontrollkøen, ikke feilaktig som funnet.
    await q`UPDATE paint_products SET lookup_status='pending',updated_at=now()
      WHERE (website_name IS NULL OR website_name='') AND lookup_status='found'`;
    return NextResponse.json({ok:true,audit:await stats()});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke rydde produktmasteren'},{status:500})}
}
