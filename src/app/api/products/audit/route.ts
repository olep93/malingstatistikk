import {NextResponse} from 'next/server';
import {getSession,isAdmin,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

async function stats(){
  const q=sql();
  const rows=await q`SELECT
    count(*) FILTER (WHERE merged_into IS NULL)::int total,
    count(*) FILTER (WHERE merged_into IS NULL AND (website_name IS NULL OR website_name=''))::int without_website_name,
    count(*) FILTER (WHERE merged_into IS NULL AND (subgroup IS NULL OR subgroup=''))::int without_tag,
    count(*) FILTER (WHERE merged_into IS NULL AND (display_name IS NULL OR display_name='' OR (source_name IS NOT NULL AND lower(display_name)=lower(source_name))))::int source_name_as_display,
    count(*) FILTER (WHERE merged_into IS NULL AND (lookup_status<>'found' OR subgroup IS NULL OR subgroup=''))::int needs_review,
    count(*) FILTER (WHERE merged_into IS NULL AND (display_name_locked OR subgroup_locked))::int manually_locked,
    count(*) FILTER (WHERE merged_into IS NULL AND report_count>0)::int used_in_reports
    FROM paint_products`;
  const duplicates=await q`SELECT count(*)::int count FROM (
    SELECT lower(regexp_replace(COALESCE(NULLIF(display_name,''),NULLIF(website_name,''),source_name),'[^a-zA-Z0-9æøåÆØÅ]+','','g')) key
    FROM paint_products WHERE merged_into IS NULL AND COALESCE(display_name,website_name,source_name) IS NOT NULL
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
  const session=await getSession();
  try{
    await ensureSchema();const q=sql();
    await q`UPDATE paint_products SET display_name=website_name,updated_at=now()
      WHERE merged_into IS NULL AND COALESCE(display_name_locked,false)=false
        AND website_name IS NOT NULL AND website_name<>'' AND display_name IS DISTINCT FROM website_name`;
    await q`UPDATE paint_products SET aliases=(
      SELECT COALESCE(jsonb_agg(DISTINCT to_jsonb(v)),'[]'::jsonb)
      FROM unnest(ARRAY[NULLIF(source_name,''),NULLIF(website_name,''),NULLIF(display_name,''),NULLIF(ean,'')]) v WHERE v IS NOT NULL
    ),updated_at=now() WHERE merged_into IS NULL`;
    await q`UPDATE paint_products SET lookup_status='pending',review_reason=CASE
        WHEN subgroup IS NULL OR subgroup='' THEN 'Mangler tag'
        WHEN website_name IS NULL OR website_name='' THEN 'Mangler nettsidenavn'
        ELSE review_reason END,updated_at=now()
      WHERE merged_into IS NULL AND ((website_name IS NULL OR website_name='') OR (subgroup IS NULL OR subgroup=''))`;
    await q`UPDATE paint_products SET review_reason=null,updated_at=now()
      WHERE merged_into IS NULL AND website_name IS NOT NULL AND website_name<>'' AND subgroup IS NOT NULL AND subgroup<>''`;
    await q`INSERT INTO paint_product_changes(product_key,changed_by,field_name,old_value,new_value)
      SELECT product_key,${session?.username||'admin'},'audit',null,'Produktmaster audit kjørt'
      FROM paint_products WHERE merged_into IS NULL LIMIT 1`;
    return NextResponse.json({ok:true,audit:await stats()});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke rydde produktmasteren'},{status:500})}
}
