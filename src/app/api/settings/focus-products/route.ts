import {NextResponse} from 'next/server';
import {getSession} from '@/lib/server/auth';
import {ensureSchema,sql} from '@/lib/server/db';
import {DEFAULT_FOCUS_PRODUCTS,validateFocusProducts} from '@/lib/focus-products';
export async function GET(req:Request){
 const session=await getSession();
 if(!session)return NextResponse.json({error:'Ikke innlogget'},{status:401});
 try{await ensureSchema();const q=sql();const settings=await q`SELECT setting_value FROM app_settings WHERE setting_key='focus_products'`;
 const products=settings.length?JSON.parse(settings[0].setting_value):DEFAULT_FOCUS_PRODUCTS;
 if(!validateFocusProducts(products))throw new Error('Ugyldig lagret fokusliste');
 const eans=products.map(p=>p.ean);
 const audit=session.role==='admin'&&new URL(req.url).searchParams.get('audit')==='1';
 const matches=audit&&eans.length?await q`WITH sales AS MATERIALIZED (
   SELECT DISTINCT ean,item_no FROM paint_report_rows WHERE ean=ANY(${eans}::text[]) OR item_no=ANY(${eans}::text[])
 ) SELECT e.ean,EXISTS(SELECT 1 FROM paint_products p WHERE p.merged_into IS NULL AND (p.ean=e.ean OR p.item_no=e.ean)) AS registered,
 EXISTS(SELECT 1 FROM sales r WHERE r.ean=e.ean OR r.item_no=e.ean) AS imported FROM unnest(${eans}::text[]) AS e(ean)`:[];
 return NextResponse.json({products,matches},{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke hente fokusprodukter'},{status:500})}
}
export async function POST(req:Request){
 const session=await getSession();if(!session)return NextResponse.json({error:'Ikke innlogget'},{status:401});
 if(session.role!=='admin')return NextResponse.json({error:'Kun administrator kan endre fokuslisten'},{status:403});
 try{const {products}=await req.json();if(!validateFocusProducts(products))return NextResponse.json({error:'Listen må ha unike EAN med 13 sifre (maks 200 produkter).'},{status:400});await ensureSchema();const q=sql();
 const unnamed=products.filter(product=>!product.name.trim()||product.name===product.ean).map(product=>product.ean);
 if(unnamed.length){
   const names=await q`SELECT e.ean,p.name FROM unnest(${unnamed}::text[]) e(ean) LEFT JOIN LATERAL (
     SELECT COALESCE(NULLIF(display_name,''),NULLIF(website_name,''),NULLIF(source_name,'')) name
     FROM paint_products WHERE merged_into IS NULL AND (ean=e.ean OR item_no=e.ean) ORDER BY updated_at DESC LIMIT 1
   ) p ON true`;
   for(const product of products){const name=names.find(row=>row.ean===product.ean)?.name;if(unnamed.includes(product.ean)&&name)product.name=String(name).slice(0,160)}
 }
 await q`INSERT INTO app_settings(setting_key,setting_value,updated_by) VALUES('focus_products',${JSON.stringify(products)},${session.username}) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=now()`;return NextResponse.json({products})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Kunne ikke lagre fokuslisten'},{status:500})}
}
