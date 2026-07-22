import {NextResponse} from 'next/server';
import {getSession,isAdmin,isAuthenticated} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {findObsbyggImage} from '@/lib/server/product-images';
import {classifyProduct} from '@/lib/server/product-classifier';
import {cleanProductName} from '@/lib/text';

const STAGES=['lookup','names','classify','aliases','mark','clear'] as const;
type Stage=(typeof STAGES)[number];

type BatchResult={cursor:string|null;scanned:number;changed:number};

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
    let result:BatchResult={cursor:null,scanned:0,changed:0};

    if(stage==='lookup'){
      const lookupLimit=Math.min(limit,20);
      const products=await q`SELECT product_key,ean,source_name,display_name,supplier,size,area,subgroup,lookup_status,last_fetched_at,normalization_version
        FROM paint_products WHERE merged_into IS NULL AND product_key>${cursor}
          AND (lookup_status IS DISTINCT FROM 'found' OR last_fetched_at IS NULL OR last_fetched_at<now()-interval '90 days' OR COALESCE(normalization_version,0)<3)
        ORDER BY product_key LIMIT ${lookupLimit}`;
      let changed=0;
      for(const p of products as any[]){
        const before=String(p.lookup_status||'');
        const result=await findObsbyggImage({productKey:p.product_key,ean:p.ean||undefined,productName:p.display_name||p.source_name||'Ukjent produkt',rawName:p.source_name||undefined,supplier:p.supplier||'Ukjent',size:p.size||undefined,area:p.area||undefined,subgroup:p.subgroup||undefined},{force:false});
        if(result.found||before!==String(result.status||''))changed++;
      }
      result={cursor:products.at(-1)?.product_key||cursor,scanned:products.length,changed};
    }else if(stage==='names'){
      const products=await q`SELECT product_key,source_name,website_name,display_name,display_name_locked
        FROM paint_products WHERE merged_into IS NULL AND product_key>${cursor}
        ORDER BY product_key LIMIT ${limit}`;
      let changed=0;
      for(const p of products as any[]){
        const source=cleanProductName(p.source_name);
        const website=cleanProductName(p.website_name);
        const current=cleanProductName(p.display_name);
        const next=!p.display_name_locked?(website||current||source):(current||source);
        const rows=await q`UPDATE paint_products SET
          source_name=${source||null},website_name=${website||null},display_name=${next||'Ukjent produkt'},updated_at=now()
          WHERE product_key=${p.product_key}
            AND (source_name IS DISTINCT FROM ${source||null} OR website_name IS DISTINCT FROM ${website||null} OR display_name IS DISTINCT FROM ${next||'Ukjent produkt'})
          RETURNING product_key`;
        changed+=rows.length;
      }
      result={cursor:products.at(-1)?.product_key||cursor,scanned:products.length,changed};
    }else if(stage==='classify'){
      const products=await q`SELECT product_key,source_name,website_name,display_name,supplier,category,area,subgroup,subgroup_locked
        FROM paint_products WHERE merged_into IS NULL AND product_key>${cursor}
        ORDER BY product_key LIMIT ${limit}`;
      let changed=0;
      for(const p of products as any[]){
        if(p.subgroup_locked)continue;
        const c=classifyProduct({area:p.area,subgroup:p.subgroup,category:p.category,sourceName:p.source_name,websiteName:p.website_name,displayName:p.display_name,supplier:p.supplier});
        if(c.confidence==='low'||!c.area||!c.subgroup)continue;
        const tag=await q`SELECT name FROM paint_tags WHERE is_active=true AND area=${c.area} AND lower(name)=lower(${c.subgroup}) LIMIT 1`;
        if(!tag.length)continue;
        const rows=await q`UPDATE paint_products SET area=${c.area},subgroup=${tag[0].name},category=CASE WHEN ${c.area}='exterior' THEN ${tag[0].name} ELSE category END,
          audit_status='ok',audit_reasons='[]'::jsonb,review_reason=NULL,updated_at=now()
          WHERE product_key=${p.product_key} AND (area IS DISTINCT FROM ${c.area} OR subgroup IS DISTINCT FROM ${tag[0].name}) RETURNING product_key`;
        changed+=rows.length;
      }
      result={cursor:products.at(-1)?.product_key||cursor,scanned:products.length,changed};
    }else if(stage==='aliases'){
      const rows=await q`WITH target AS MATERIALIZED (
        SELECT product_key FROM paint_products
        WHERE merged_into IS NULL AND product_key>${cursor}
        ORDER BY product_key LIMIT ${limit}
      ), changed AS (
        UPDATE paint_products p SET aliases=(
          SELECT COALESCE(jsonb_agg(DISTINCT v),'[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(p.aliases,'[]'::jsonb)||jsonb_build_array(NULLIF(p.source_name,''),NULLIF(p.website_name,''),NULLIF(p.display_name,''),NULLIF(p.ean,''))) v
          WHERE v <> 'null'::jsonb AND v <> '""'::jsonb
        ),updated_at=now()
        FROM target t WHERE p.product_key=t.product_key
          AND (p.aliases IS NULL OR NOT (COALESCE(p.aliases,'[]'::jsonb) @> jsonb_build_array(COALESCE(NULLIF(p.source_name,''),NULLIF(p.display_name,''),NULLIF(p.website_name,''),NULLIF(p.ean,'')))))
        RETURNING p.product_key
      ) SELECT
        (SELECT max(product_key) FROM target)::text cursor,
        (SELECT count(*) FROM target)::int scanned,
        (SELECT count(*) FROM changed)::int changed`;
      result=rows[0] as BatchResult;
    }else if(stage==='mark'){
      const rows=await q`WITH target AS MATERIALIZED (
        SELECT product_key FROM paint_products WHERE merged_into IS NULL AND product_key>${cursor}
        ORDER BY product_key LIMIT ${limit}
      ), calculated AS (
        SELECT p.product_key,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN p.subgroup IS NULL OR p.subgroup='' THEN 'Mangler tag' END,
            CASE WHEN p.area IS NULL OR p.area='' THEN 'Mangler vareområde' END,
            CASE WHEN p.display_name IS NULL OR p.display_name='' THEN 'Mangler produktnavn' END
          ],NULL) reasons,
          CASE
            WHEN (p.website_name IS NOT NULL AND p.website_name<>'' AND COALESCE(p.display_name_locked,false)=false AND p.display_name IS DISTINCT FROM p.website_name)
              OR p.aliases IS NULL OR p.aliases='[]'::jsonb THEN 'auto_fixable'
            WHEN p.subgroup IS NULL OR p.subgroup='' OR p.area IS NULL OR p.area='' OR p.display_name IS NULL OR p.display_name='' THEN 'review'
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
          AND (p.audit_status,p.audit_reasons,p.review_reason) IS DISTINCT FROM
              (c.status,to_jsonb(c.reasons),CASE WHEN array_length(c.reasons,1)>0 THEN array_to_string(c.reasons,' · ') ELSE NULL END)
        RETURNING p.product_key
      ) SELECT
        (SELECT max(product_key) FROM target)::text cursor,
        (SELECT count(*) FROM target)::int scanned,
        (SELECT count(*) FROM changed)::int changed`;
      result=rows[0] as BatchResult;
    }else{
      const rows=await q`WITH target AS MATERIALIZED (
        SELECT product_key FROM paint_products
        WHERE merged_into IS NULL AND product_key>${cursor}
        ORDER BY product_key LIMIT ${limit}
      ), changed AS (
        UPDATE paint_products p SET review_reason=NULL,audit_reasons='[]'::jsonb,updated_at=now()
        FROM target t WHERE p.product_key=t.product_key AND p.audit_status='ok'
          AND (p.review_reason IS NOT NULL OR p.audit_reasons<>'[]'::jsonb)
        RETURNING p.product_key
      ) SELECT
        (SELECT max(product_key) FROM target)::text cursor,
        (SELECT count(*) FROM target)::int scanned,
        (SELECT count(*) FROM changed)::int changed`;
      result=rows[0] as BatchResult;
    }

    const scanned=Number(result?.scanned||0);
    const changed=Number(result?.changed||0);
    const lastCursor=String(result?.cursor||cursor);
    const effectiveLimit=stage==='lookup'?Math.min(limit,20):limit;
    const done=scanned<effectiveLimit;
    if(done&&stage==='clear')await q`INSERT INTO paint_product_changes(product_key,changed_by,field_name,old_value,new_value)
      SELECT product_key,${session?.username||'admin'},'audit',null,'Produktmaster audit fullført'
      FROM paint_products WHERE merged_into IS NULL LIMIT 1`;
    return NextResponse.json({ok:true,stage,cursor:lastCursor,scanned,changed,done,audit:done&&stage==='clear'?await stats():undefined});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke rydde produktmasteren'},{status:500})}
}
