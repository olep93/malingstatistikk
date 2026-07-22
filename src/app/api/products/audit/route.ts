import {NextResponse} from 'next/server';
import {getSession,isAdmin,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';

const STAGES=['names','aliases','mark','clear'] as const;
type Stage=(typeof STAGES)[number];

async function stats(){
  const q=sql();
  const rows=await q`SELECT
    count(*) FILTER (WHERE merged_into IS NULL)::int total,
    count(*) FILTER (WHERE merged_into IS NULL AND audit_status='ok')::int ok,
    count(*) FILTER (WHERE merged_into IS NULL AND audit_status='auto_fixable')::int auto_fixable,
    count(*) FILTER (WHERE merged_into IS NULL AND audit_status='review')::int needs_review,
    count(*) FILTER (WHERE merged_into IS NULL AND (website_name IS NULL OR website_name=''))::int without_website_name,
    count(*) FILTER (WHERE merged_into IS NULL AND (subgroup IS NULL OR subgroup=''))::int without_tag,
    count(*) FILTER (WHERE merged_into IS NULL AND (display_name IS NULL OR display_name='' OR (source_name IS NOT NULL AND lower(display_name)=lower(source_name))))::int source_name_as_display,
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

export async function POST(request:Request){
  if(!(await isAdmin()))return NextResponse.json({error:'Kun Admin kan rydde produktmasteren.'},{status:403});
  const session=await getSession();
  try{
    await ensureSchema();
    const q=sql();
    const body=await request.json().catch(()=>({}));
    const stage=(STAGES.includes(body.stage)?body.stage:'names') as Stage;
    const cursor=String(body.cursor||'');
    const limit=Math.min(Math.max(Number(body.limit)||75,10),200);
    let changed=0,lastCursor=cursor;

    if(stage==='names'){
      const rows=await q`WITH target AS (
        SELECT product_key FROM paint_products
        WHERE merged_into IS NULL AND product_key>${cursor}
          AND COALESCE(display_name_locked,false)=false
          AND website_name IS NOT NULL AND website_name<>''
          AND display_name IS DISTINCT FROM website_name
        ORDER BY product_key LIMIT ${limit}
      ), changed AS (
        UPDATE paint_products p SET display_name=p.website_name,updated_at=now()
        FROM target t WHERE p.product_key=t.product_key RETURNING p.product_key
      ) SELECT product_key FROM changed ORDER BY product_key`;
      changed=rows.length;
      const lastRow=rows.at(-1);
      if(lastRow)lastCursor=lastRow.product_key;
    }else if(stage==='aliases'){
      const rows=await q`WITH target AS (
        SELECT product_key FROM paint_products
        WHERE merged_into IS NULL AND product_key>${cursor}
          AND (aliases IS NULL OR aliases='[]'::jsonb)
        ORDER BY product_key LIMIT ${limit}
      ), changed AS (
        UPDATE paint_products p SET aliases=(
          SELECT COALESCE(jsonb_agg(DISTINCT to_jsonb(v)),'[]'::jsonb)
          FROM unnest(ARRAY[NULLIF(p.source_name,''),NULLIF(p.website_name,''),NULLIF(p.display_name,''),NULLIF(p.ean,'')]) v WHERE v IS NOT NULL
        ),updated_at=now() FROM target t WHERE p.product_key=t.product_key RETURNING p.product_key
      ) SELECT product_key FROM changed ORDER BY product_key`;
      changed=rows.length;
      const lastRow=rows.at(-1);
      if(lastRow)lastCursor=lastRow.product_key;
    }else if(stage==='mark'){
      // Full tilstandsberegning: status og årsaker erstattes med dagens sannhet.
      const rows=await q`WITH target AS (
        SELECT product_key FROM paint_products WHERE merged_into IS NULL AND product_key>${cursor}
        ORDER BY product_key LIMIT ${limit}
      ), calculated AS (
        SELECT p.product_key,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN p.website_name IS NULL OR p.website_name='' THEN 'Mangler nettsidenavn' END,
            CASE WHEN p.subgroup IS NULL OR p.subgroup='' THEN 'Mangler tag' END,
            CASE WHEN p.area IS NULL OR p.area='' THEN 'Mangler vareområde' END,
            CASE WHEN p.display_name IS NULL OR p.display_name='' THEN 'Mangler produktnavn' END
          ],NULL) reasons,
          CASE
            WHEN (p.website_name IS NOT NULL AND p.website_name<>'' AND COALESCE(p.display_name_locked,false)=false AND p.display_name IS DISTINCT FROM p.website_name)
              OR p.aliases IS NULL OR p.aliases='[]'::jsonb THEN 'auto_fixable'
            WHEN p.website_name IS NULL OR p.website_name='' OR p.subgroup IS NULL OR p.subgroup='' OR p.area IS NULL OR p.area='' OR p.display_name IS NULL OR p.display_name='' THEN 'review'
            ELSE 'ok' END status
        FROM paint_products p JOIN target t ON t.product_key=p.product_key
      ), changed AS (
        UPDATE paint_products p SET
          audit_status=c.status,
          audit_reasons=to_jsonb(c.reasons),
          review_reason=CASE WHEN array_length(c.reasons,1)>0 THEN array_to_string(c.reasons,' · ') ELSE NULL END,
          lookup_status=CASE WHEN c.status='ok' THEN COALESCE(NULLIF(p.lookup_status,'pending'),'found') ELSE p.lookup_status END,
          updated_at=now()
        FROM calculated c WHERE p.product_key=c.product_key
        RETURNING p.product_key
      ) SELECT product_key FROM changed ORDER BY product_key`;
      changed=rows.length;
      const lastRow=rows.at(-1);
      if(lastRow)lastCursor=lastRow.product_key;
    }else{
      // En siste passering fjerner utdaterte varsler på produkter som nå er OK.
      const rows=await q`WITH target AS (
        SELECT product_key FROM paint_products
        WHERE merged_into IS NULL AND product_key>${cursor} AND audit_status='ok'
          AND (review_reason IS NOT NULL OR audit_reasons<>'[]'::jsonb)
        ORDER BY product_key LIMIT ${limit}
      ), changed AS (
        UPDATE paint_products p SET review_reason=NULL,audit_reasons='[]'::jsonb,updated_at=now()
        FROM target t WHERE p.product_key=t.product_key RETURNING p.product_key
      ) SELECT product_key FROM changed ORDER BY product_key`;
      changed=rows.length;
      const lastRow=rows.at(-1);
      if(lastRow)lastCursor=lastRow.product_key;
    }

    const done=changed<limit;
    if(done&&stage==='clear')await q`INSERT INTO paint_product_changes(product_key,changed_by,field_name,old_value,new_value)
      SELECT product_key,${session?.username||'admin'},'audit',null,'Produktmaster audit fullført'
      FROM paint_products WHERE merged_into IS NULL LIMIT 1`;
    return NextResponse.json({ok:true,stage,cursor:lastCursor,changed,done,audit:done&&stage==='clear'?await stats():undefined});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke rydde produktmasteren'},{status:500})}
}
