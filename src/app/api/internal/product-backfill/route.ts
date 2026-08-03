import {createHash,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {ensureSchema,sql} from '@/lib/server/db';

export const maxDuration=60;
const TOKEN_HASH='69d065e92a2e102a2995895cb68a0dc9ce937812c79a234a6c86d99d39e2f57e';
const digits=(value:unknown)=>String(value||'').replace(/\D/g,'');
const authorized=(req:Request)=>{
 const token=req.headers.get('x-backfill-token')||'';
 const actual=Buffer.from(createHash('sha256').update(token).digest('hex'));
 const expected=Buffer.from(TOKEN_HASH);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
};

export async function GET(req:Request){
 if(!authorized(req))return NextResponse.json({error:'Ikke autorisert'},{status:401});
 await ensureSchema();const q=sql();const url=new URL(req.url);const after=url.searchParams.get('after')||'';
 const rows=await q`SELECT product_key,ean,item_no,source_name,website_name,display_name,supplier,size,area,subgroup,image_url,product_url,lookup_status,matched_identifier
  FROM paint_products
  WHERE merged_into IS NULL AND product_key>${after}
    AND regexp_replace(COALESCE(ean,''),'[^0-9]','','g') ~ '^[0-9]{13}$'
  ORDER BY product_key LIMIT 200`;
 return NextResponse.json({rows,next:rows.length?rows.at(-1)?.product_key:null},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 if(!authorized(req))return NextResponse.json({error:'Ikke autorisert'},{status:401});
 const body=await req.json();const results=Array.isArray(body.results)?body.results.slice(0,50):[];
 await ensureSchema();const q=sql();let updated=0,rejected=0;
 for(const r of results){
  const ean=digits(r.ean),matched=digits(r.matchedIdentifier);
  if(!r.productKey||!ean||ean!==matched||!String(r.websiteName||'').trim()||!String(r.productUrl||'').startsWith('https://www.obsbygg.no/')){rejected++;continue}
  const rows=await q`UPDATE paint_products SET
    website_name=${String(r.websiteName).trim()},
    display_name=CASE WHEN display_name_locked THEN display_name ELSE ${String(r.displayName||r.websiteName).trim()} END,
    size=COALESCE(NULLIF(${String(r.size||'').trim()},''),size),
    raw_size=COALESCE(NULLIF(${String(r.size||'').trim()},''),raw_size),
    normalized_size=COALESCE(NULLIF(${String(r.size||'').trim()},''),normalized_size),
    image_url=COALESCE(NULLIF(${String(r.imageUrl||'').trim()},''),image_url),
    image_source='one-time-local-backfill',product_url=${String(r.productUrl)},
    lookup_status='found',lookup_method='EXACT_EAN',matched_identifier=${ean},match_confidence=100,
    last_fetched_at=now(),updated_at=now(),review_reason=null,audit_status='ok'
   WHERE product_key=${String(r.productKey)} AND regexp_replace(COALESCE(ean,''),'[^0-9]','','g')=${ean}
   RETURNING product_key`;
  if(rows.length)updated++;else rejected++;
 }
 return NextResponse.json({ok:true,updated,rejected});
}
