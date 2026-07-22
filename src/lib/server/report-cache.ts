import {sql} from '@/lib/server/db';

export type ReportPeriod='Dag'|'Uke'|'Måned'|'Hittil i år'|'År';

export function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function rangeFor(date:string,period:ReportPeriod){const d=new Date(`${date}T12:00:00Z`);if(period==='Dag')return{from:date,to:date};if(period==='Måned')return{from:`${date.slice(0,7)}-01`,to:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10)};if(period==='År')return{from:`${d.getUTCFullYear()}-01-01`,to:`${d.getUTCFullYear()}-12-31`};if(period==='Hittil i år')return{from:`${d.getUTCFullYear()}-01-01`,to:date};const day=d.getUTCDay()||7;const monday=addDays(date,1-day);return{from:monday,to:addDays(monday,6)}}

/**
 * Normaliserer bare rapportdager som mangler eller er endret.
 * Den gamle spørringen åpnet JSON-arrayet for alle dager før NOT EXISTS-filteret
 * slo inn. På YTD kunne det gi 30–180 sekunders ventetid på hvert oppslag.
 */
export async function refreshReportCache(from:string,to:string){
 const q=sql();
 await q`WITH stale_days AS (
   SELECT DISTINCT c.report_date
   FROM paint_report_rows c
   JOIN paint_reports p ON p.report_date=c.report_date
   WHERE p.report_date BETWEEN ${from}::date AND ${to}::date
     AND c.source_updated_at<p.updated_at
 )
 DELETE FROM paint_report_rows c USING stale_days s WHERE c.report_date=s.report_date`;

 await q`WITH missing_reports AS MATERIALIZED (
   SELECT p.report_date,p.report_data,p.updated_at
   FROM paint_reports p
   WHERE p.report_date BETWEEN ${from}::date AND ${to}::date
     AND NOT EXISTS (
       SELECT 1 FROM paint_report_rows c WHERE c.report_date=p.report_date
     )
 )
 INSERT INTO paint_report_rows(
   report_date,store_id,store_name,product_key,item_no,raw_name,product_name,size,supplier,category,area,subgroup,quantity,revenue,profit,image_url,product_url,source_updated_at
 )
 SELECT p.report_date,
   COALESCE(NULLIF(r->>'storeId',''),'unknown'),COALESCE(NULLIF(r->>'store',''),'Ukjent varehus'),
   COALESCE(NULLIF(r->>'productKey',''),concat_ws('|',COALESCE(r->>'area',''),COALESCE(r->>'subgroup',''),COALESCE(r->>'supplier',''),COALESCE(r->>'product',''),COALESCE(r->>'size',''))),
   COALESCE(NULLIF(r->>'itemNo',''),NULLIF(r->>'ean','')),COALESCE(NULLIF(r->>'rawName',''),NULLIF(r->>'product','')),
   COALESCE(NULLIF(r->>'product',''),'Ukjent produkt'),COALESCE(r->>'size',''),COALESCE(NULLIF(r->>'supplier',''),'Øvrig'),
   NULLIF(r->>'category',''),NULLIF(r->>'area',''),NULLIF(r->>'subgroup',''),
   COALESCE(NULLIF(r->>'quantity','')::numeric,0),COALESCE(NULLIF(r->>'revenue','')::numeric,0),COALESCE(NULLIF(r->>'profit','')::numeric,0),
   NULLIF(r->>'image',''),NULLIF(r->>'productUrl',''),p.updated_at
 FROM missing_reports p
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.report_data->'rows','[]'::jsonb)) r
 ON CONFLICT(report_date,store_id,product_key) DO UPDATE SET
   store_name=excluded.store_name,item_no=excluded.item_no,raw_name=excluded.raw_name,product_name=excluded.product_name,size=excluded.size,
   supplier=excluded.supplier,category=excluded.category,area=excluded.area,subgroup=excluded.subgroup,
   quantity=excluded.quantity,revenue=excluded.revenue,profit=excluded.profit,image_url=excluded.image_url,product_url=excluded.product_url,source_updated_at=excluded.source_updated_at`;
}

export async function invalidateReportCache(date:string){const q=sql();await q`DELETE FROM paint_report_rows WHERE report_date=${date}::date`}
