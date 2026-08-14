import { neon } from '@neondatabase/serverless';
import {PRODUCT_REFERENCE} from '@/lib/product-reference';

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL || '';
}

export function sql() {
  const url = connectionString();
  if (!url) throw new Error('Database er ikke koblet til. Kontroller Neon-miljøvariablene i Vercel.');
  return neon(url);
}

let schemaPromise: Promise<void> | null = null;
const SCHEMA_VERSION = 167;

async function currentSchemaVersion() {
  const q = sql();
  const relation = await q`SELECT to_regclass('public.paint_schema_version')::text AS name`;
  if (!relation[0]?.name) return 0;
  const rows = await q`SELECT version::int FROM paint_schema_version WHERE id=1`;
  return Number(rows[0]?.version || 0);
}

async function runSchemaMigration() {
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS paint_reports (
    report_date date PRIMARY KEY,
    source_name text NOT NULL,
    blob_url text,
    report_data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    uploaded_by text
  )`;
  await q`ALTER TABLE paint_reports ADD COLUMN IF NOT EXISTS uploaded_by text`;
  await q`CREATE TABLE IF NOT EXISTS paint_report_rows (
    report_date date NOT NULL REFERENCES paint_reports(report_date) ON DELETE CASCADE,
    store_id text NOT NULL, store_name text NOT NULL, product_key text NOT NULL, item_no text, ean text, raw_name text, product_name text NOT NULL, size text, supplier text NOT NULL, category text, area text, subgroup text,
    quantity numeric NOT NULL DEFAULT 0, revenue numeric NOT NULL DEFAULT 0, profit numeric NOT NULL DEFAULT 0, image_url text, product_url text, source_updated_at timestamptz NOT NULL,
    PRIMARY KEY(report_date,store_id,product_key)
  )`;
  await q`ALTER TABLE paint_report_rows ADD COLUMN IF NOT EXISTS ean text`;
  await q`CREATE INDEX IF NOT EXISTS paint_report_rows_period_idx ON paint_report_rows(report_date,area,store_id)`;
  await q`CREATE INDEX IF NOT EXISTS paint_report_rows_product_idx ON paint_report_rows(product_key)`;
  await q`CREATE INDEX IF NOT EXISTS paint_report_rows_fast_period_idx ON paint_report_rows(report_date,store_id,area,subgroup,supplier) INCLUDE (quantity,revenue,profit)`;
  await q`CREATE TABLE IF NOT EXISTS paint_products (
    product_key text PRIMARY KEY,
    display_name text NOT NULL,
    supplier text NOT NULL,
    size text,
    ean text,
    image_url text,
    image_source text,
    product_url text,
    category text,
    image_approved boolean NOT NULL DEFAULT false,
    aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS product_url text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS item_no text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS category text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS source_name text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS website_name text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS lookup_status text NOT NULL DEFAULT 'pending'`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS last_fetched_at timestamptz`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS display_name_locked boolean NOT NULL DEFAULT false`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS subgroup text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS subgroup_locked boolean NOT NULL DEFAULT false`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS area text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS first_seen_at date`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS last_seen_at date`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS merged_into text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS review_reason text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'review'`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS audit_reasons jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS lookup_method text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS matched_identifier text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS match_confidence integer`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS raw_size text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS normalized_size text`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS variant_id text`;
  await q`UPDATE paint_products SET normalized_size=COALESCE(normalized_size,size),raw_size=COALESCE(raw_size,size) WHERE normalized_size IS NULL OR raw_size IS NULL`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_audit_status_idx ON paint_products(audit_status)`;
  await q`CREATE TABLE IF NOT EXISTS paint_tags (
    id bigserial PRIMARY KEY,
    area text NOT NULL,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(area,name)
  )`;
  await q`INSERT INTO paint_tags(area,name) VALUES
    ('interior','Tak'),('interior','Supermatt'),('interior','Matt'),('interior','Silkematt'),('interior','Tre & Panel'),('interior','Grunning'),('interior','Sparkel'),('interior','Lakk'),
    ('terrace','Vanntynnet'),('terrace','Terrassemaling'),('terrace','Oljebasert'),
    ('tools','Pensler'),('tools','Ruller'),('tools','Tape'),('tools','Tildekning'),('tools','Rensemidler'),('tools','Rens & vask'),('tools','Maletilbehør'),('tools','Fugemasse & Kitt'),('tools','Diverse'),
    ('exterior','Maling / Dekkbeis / Beis'),('exterior','Vindu / Dør'),('exterior','Murmaling')
    ON CONFLICT(area,name) DO NOTHING`;

  // Restore the original exterior product classification. The historical product
  // reference was built from the approved Excel list and remains the source of
  // truth for exterior tags. This migration is idempotent and never overwrites
  // an Admin-locked tag.
  const commercialSize=(value:string)=>{
    const size=String(value||'').replace(/\s/g,'').replace(',','.').toLowerCase();
    if(['0.68l','1l','1.0l'].includes(size))return '1 L';
    if(['2.7l','3l','3.0l'].includes(size))return '3 L';
    if(['4.5l','5l','5.0l'].includes(size))return '5 L';
    if(['9l','9.0l','10l','10.0l'].includes(size))return '10 L';
    return value;
  };
  const exteriorMappings = Object.entries(PRODUCT_REFERENCE).map(([itemNo, product]) => ({
    item_no: itemNo,
    ean: product.ean || '',
    name: product.name,
    size: commercialSize(product.size),
    subgroup: product.category === 'Vindu / Dør'
      ? 'Vindu / Dør'
      : product.category === 'Murmaling'
        ? 'Murmaling'
        : 'Maling / Dekkbeis / Beis'
  }));
  await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(exteriorMappings)}::jsonb)
      AS x(item_no text, ean text, name text, size text, subgroup text)
  )
  UPDATE paint_products p
  SET area='exterior',
      subgroup=m.subgroup,
      category=m.subgroup,
      updated_at=now()
  FROM mappings m
  WHERE COALESCE(p.subgroup_locked,false)=false
    AND (p.ean=m.ean OR p.ean=m.item_no)`;

  // Reparasjon av eldre nasjonale importer: produktnavnet fra produktsiden kan
  // vise standardvarianten (ofte 2,7 L), mens EAN identifiserer riktig spann.
  // Oppdater både Product Master og allerede importerte rapportlinjer fra EAN.
  await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(exteriorMappings)}::jsonb)
      AS x(item_no text, ean text, name text, size text, subgroup text)
  )
  UPDATE paint_products p SET
    display_name=CASE WHEN COALESCE(p.display_name_locked,false) THEN p.display_name ELSE m.name END,
    size=m.size,raw_size=m.size,normalized_size=m.size,variant_id=COALESCE(NULLIF(p.ean,''),NULLIF(p.item_no,''),m.ean),updated_at=now()
  FROM mappings m
  WHERE m.size<>'' AND (
    p.ean=m.ean OR p.item_no=m.ean OR p.ean=m.item_no OR p.item_no=m.item_no
  )`;
  await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(exteriorMappings)}::jsonb)
      AS x(item_no text, ean text, name text, size text, subgroup text)
  )
  UPDATE paint_report_rows r SET product_name=m.name,size=m.size,source_updated_at=now()
  FROM mappings m
  WHERE m.size<>'' AND (
    r.ean=m.ean OR r.item_no=m.ean OR r.ean=m.item_no OR r.item_no=m.item_no
  )`;

  // Older database rows already contain the approved category in `category`, but
  // predate the new area/subgroup columns. Promote those values as well.
  await q`UPDATE paint_products
    SET area='exterior',
        subgroup=CASE
          WHEN category='Vindu / Dør' THEN 'Vindu / Dør'
          WHEN category='Murmaling' THEN 'Murmaling'
          ELSE 'Maling / Dekkbeis / Beis'
        END,
        updated_at=now()
    WHERE COALESCE(subgroup_locked,false)=false
      AND (area IS NULL OR area='' OR area='exterior')
      AND category IS NOT NULL
      AND category<>''
      AND (subgroup IS NULL OR subgroup='')`;
  // Normaliser leverandørenes parallelle spannbetegnelser til kommersielle salgsstørrelser.
  // Rå EAN og råvarenavn beholdes, slik at faktisk variant fortsatt er sporbar.
  await q`UPDATE paint_products SET size=CASE
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('0,68l','0.68l','1l','1,0l','1.0l') THEN '1 L'
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('2,7l','2.7l','3l','3,0l','3.0l') THEN '3 L'
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('4,5l','4.5l','5l','5,0l','5.0l') THEN '5 L'
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('9l','9,0l','9.0l','10l','10,0l','10.0l') THEN '10 L'
      ELSE size END
    WHERE size IS NOT NULL AND size<>''`;
  await q`UPDATE paint_report_rows SET size=CASE
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('0,68l','0.68l','1l','1,0l','1.0l') THEN '1 L'
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('2,7l','2.7l','3l','3,0l','3.0l') THEN '3 L'
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('4,5l','4.5l','5l','5,0l','5.0l') THEN '5 L'
      WHEN replace(lower(trim(coalesce(size,''))),' ','') IN ('9l','9,0l','9.0l','10l','10,0l','10.0l') THEN '10 L'
      ELSE size END
    WHERE size IS NOT NULL AND size<>''`;

  // V166: tidligere reparasjoner brukte en bred OR-kobling mot EAN og varenummer.
  // Dersom eldre data hadde EAN i feil kolonne kunne PostgreSQL velge en vilkårlig
  // variant. Velg nå nøyaktig én fasit per produkt, med eksakt EAN som førstevalg.
  await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(exteriorMappings)}::jsonb)
      AS x(item_no text, ean text, name text, size text, subgroup text)
  ), resolved AS (
    SELECT DISTINCT ON (p.product_key) p.product_key,m.ean,m.item_no,m.name,m.size,m.subgroup
    FROM paint_products p
    JOIN mappings m ON p.ean=m.ean OR p.item_no=m.item_no OR p.ean=m.item_no OR p.item_no=m.ean
    WHERE m.size<>''
    ORDER BY p.product_key,
      CASE WHEN p.ean=m.ean THEN 0 WHEN p.item_no=m.item_no THEN 1 WHEN p.ean=m.item_no THEN 2 ELSE 3 END
  )
  UPDATE paint_products p SET
    display_name=CASE WHEN COALESCE(p.display_name_locked,false) THEN p.display_name ELSE r.name END,
    size=r.size,raw_size=r.size,normalized_size=r.size,variant_id=r.ean,
    area='exterior',
    subgroup=CASE WHEN COALESCE(p.subgroup_locked,false) THEN p.subgroup ELSE r.subgroup END,
    category=CASE WHEN COALESCE(p.subgroup_locked,false) THEN p.category ELSE r.subgroup END,
    image_url=CASE
      WHEN p.image_url LIKE '%blob.vercel-storage.com/%' THEN p.image_url
      WHEN p.image_url LIKE '/products/%' THEN NULL
      WHEN substring(COALESCE(p.image_url,'') from '([0-9]{13})') IS NOT NULL
        AND substring(p.image_url from '([0-9]{13})')<>r.ean THEN NULL
      ELSE p.image_url END,
    image_approved=CASE
      WHEN p.image_url LIKE '%blob.vercel-storage.com/%' THEN p.image_approved
      WHEN p.image_url LIKE '/products/%' THEN false
      WHEN substring(COALESCE(p.image_url,'') from '([0-9]{13})') IS NOT NULL
        AND substring(p.image_url from '([0-9]{13})')<>r.ean THEN false
      ELSE p.image_approved END,
    normalization_version=9,updated_at=now()
  FROM resolved r WHERE p.product_key=r.product_key`;
  await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(exteriorMappings)}::jsonb)
      AS x(item_no text, ean text, name text, size text, subgroup text)
  ), resolved AS (
    SELECT DISTINCT ON (r.report_date,r.store_id,r.product_key)
      r.report_date,r.store_id,r.product_key,m.name,m.size
    FROM paint_report_rows r
    JOIN mappings m ON r.ean=m.ean OR r.item_no=m.item_no OR r.ean=m.item_no OR r.item_no=m.ean
    WHERE m.size<>''
    ORDER BY r.report_date,r.store_id,r.product_key,
      CASE WHEN r.ean=m.ean THEN 0 WHEN r.item_no=m.item_no THEN 1 WHEN r.ean=m.item_no THEN 2 ELSE 3 END
  )
  UPDATE paint_report_rows r SET product_name=x.name,size=x.size,source_updated_at=now()
  FROM resolved x
  WHERE r.report_date=x.report_date AND r.store_id=x.store_id AND r.product_key=x.product_key`;
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS normalization_version integer NOT NULL DEFAULT 1`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_ean_idx ON paint_products(ean)`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_item_no_idx ON paint_products(item_no)`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_lookup_status_idx ON paint_products(lookup_status)`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_area_subgroup_idx ON paint_products(area,subgroup)`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_merged_into_idx ON paint_products(merged_into)`;
  await q`CREATE TABLE IF NOT EXISTS paint_product_changes (
    id bigserial PRIMARY KEY,
    product_key text NOT NULL,
    changed_by text,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS paint_product_changes_product_idx ON paint_product_changes(product_key,created_at DESC)`;

  await q`CREATE TABLE IF NOT EXISTS app_settings (
    setting_key text PRIMARY KEY,
    setting_value text NOT NULL,
    updated_by text,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`INSERT INTO app_settings(setting_key,setting_value) VALUES
    ('bi_report_url','https://bi.coop.no/BOE/OpenDocument/opendoc/openDocument.jsp?sIDType=CUID&iDocID=AWy2QvRaEdFMmgGWQNqOsek&BOOKMARK=AUubX.RpQhtFiVHTx7t9xXo')
    ON CONFLICT(setting_key) DO NOTHING`;
  await q`CREATE TABLE IF NOT EXISTS app_users (
    id bigserial PRIMARY KEY,
    username text NOT NULL UNIQUE,
    display_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin','leader')),
    password_hash text NOT NULL,
    password_salt text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
  )`;
  await q`CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_idx ON app_users(lower(username))`;

  await q`CREATE TABLE IF NOT EXISTS paint_import_jobs (
    id bigserial PRIMARY KEY,
    source_name text NOT NULL,
    source_type text NOT NULL DEFAULT 'lumira',
    import_mode text NOT NULL DEFAULT 'historical',
    status text NOT NULL DEFAULT 'staging',
    total_days integer NOT NULL DEFAULT 0,
    staged_days integer NOT NULL DEFAULT 0,
    total_products integer NOT NULL DEFAULT 0,
    synced_products integer NOT NULL DEFAULT 0,
    imported_days integer NOT NULL DEFAULT 0,
    failed_products integer NOT NULL DEFAULT 0,
    failed_days integer NOT NULL DEFAULT 0,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    blob_url text,
    blob_size bigint,
    analyzed_at timestamptz
  )`;
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'lumira'`;
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS import_mode text NOT NULL DEFAULT 'historical'`;
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS blob_url text`;
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS blob_size bigint`;
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS analyzed_at timestamptz`;
  await q`CREATE TABLE IF NOT EXISTS paint_import_job_days (
    job_id bigint NOT NULL REFERENCES paint_import_jobs(id) ON DELETE CASCADE,
    report_date date NOT NULL,
    report_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'staged',
    staged_rows integer NOT NULL DEFAULT 0,
    total_rows integer NOT NULL DEFAULT 0,
    error text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(job_id,report_date)
  )`;
  await q`ALTER TABLE paint_import_job_days ADD COLUMN IF NOT EXISTS staged_rows integer NOT NULL DEFAULT 0`;
  await q`ALTER TABLE paint_import_job_days ADD COLUMN IF NOT EXISTS total_rows integer NOT NULL DEFAULT 0`;
  await q`CREATE TABLE IF NOT EXISTS paint_import_job_products (
    job_id bigint NOT NULL REFERENCES paint_import_jobs(id) ON DELETE CASCADE,
    product_key text NOT NULL,
    product_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    error text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(job_id,product_key)
  )`;
  await q`ALTER TABLE paint_import_job_products ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0`;
  await q`CREATE INDEX IF NOT EXISTS paint_import_job_products_status_idx ON paint_import_job_products(job_id,status)`;
  await q`CREATE INDEX IF NOT EXISTS paint_import_job_days_status_idx ON paint_import_job_days(job_id,status)`;
  // Ferdige rapporter hadde tidligere hele varelinjearrayet både i JSON og i
  // den normaliserte tabellen. Behold metadata, men fjern den doble kopien.
  await q`UPDATE paint_reports p SET report_data=(p.report_data-'rows')||jsonb_build_object(
      'storageMode','rows','rowCount',(SELECT count(*)::int FROM paint_report_rows r WHERE r.report_date=p.report_date)
    )
    WHERE jsonb_typeof(p.report_data->'rows')='array'
      AND jsonb_array_length(p.report_data->'rows')>0
      AND EXISTS (SELECT 1 FROM paint_report_rows r WHERE r.report_date=p.report_date)`;
  // Fullførte serverjobber er kun historikk/status. Stagingdataene er allerede
  // verifisert i hovedtabellene og kan trygt frigjøres.
  await q`DELETE FROM paint_import_job_days d USING paint_import_jobs j WHERE d.job_id=j.id AND j.status='completed'`;
  await q`DELETE FROM paint_import_job_products p USING paint_import_jobs j WHERE p.job_id=j.id AND j.status='completed'`;

  await q`CREATE TABLE IF NOT EXISTS paint_schema_version (
    id integer PRIMARY KEY CHECK (id=1),
    version integer NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`INSERT INTO paint_schema_version(id,version,updated_at) VALUES(1,${SCHEMA_VERSION},now())
    ON CONFLICT(id) DO UPDATE SET version=excluded.version,updated_at=now()`;

}

function isConcurrentSchemaRace(error: unknown) {
  const value = error as { code?: string; constraint?: string; message?: string };
  return value?.code === '40P01' || value?.code === '40001' || (value?.code === '23505' && (
    value?.constraint === 'pg_class_relname_nsp_index' ||
    String(value?.message || '').includes('pg_class_relname_nsp_index')
  ));
}

async function migrateWithRetry() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const version=await currentSchemaVersion();
      if (version >= SCHEMA_VERSION) return;
      // V166-produktreparasjonen ble skrevet før den tunge historikkdelen.
      // Historikken bruker Product Master dynamisk og trenger ikke omskrives.
      // Marker oppgraderingen ferdig uten å kjøre hele migrasjonsrekken på hvert
      // kaldt serverless-kall dersom databasen allerede var på moderne skjema.
      if(version>=165){const q=sql();await q`UPDATE paint_schema_version SET version=${SCHEMA_VERSION},updated_at=now() WHERE id=1`;return;}
      await runSchemaMigration();
      return;
    } catch (error) {
      if (!isConcurrentSchemaRace(error) || attempt === 5) throw error;
      // En annen serverless-instans oppretter samme tabell eller indeks akkurat nå.
      // Alle migrasjonene er idempotente, så vent kort og kjør dem på nytt.
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = migrateWithRetry().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
