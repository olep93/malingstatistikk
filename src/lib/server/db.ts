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
    store_id text NOT NULL, store_name text NOT NULL, product_key text NOT NULL, item_no text, raw_name text, product_name text NOT NULL, size text, supplier text NOT NULL, category text, area text, subgroup text,
    quantity numeric NOT NULL DEFAULT 0, revenue numeric NOT NULL DEFAULT 0, profit numeric NOT NULL DEFAULT 0, image_url text, product_url text, source_updated_at timestamptz NOT NULL,
    PRIMARY KEY(report_date,store_id,product_key)
  )`;
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
    ('tools','Pensler'),('tools','Ruller'),('tools','Tape'),('tools','Tildekning'),('tools','Rensemidler'),('tools','Diverse'),
    ('exterior','Maling / Dekkbeis / Beis'),('exterior','Vindu / Dør'),('exterior','Murmaling')
    ON CONFLICT(area,name) DO NOTHING`;

  // Restore the original exterior product classification. The historical product
  // reference was built from the approved Excel list and remains the source of
  // truth for exterior tags. This migration is idempotent and never overwrites
  // an Admin-locked tag.
  const exteriorMappings = Object.entries(PRODUCT_REFERENCE).map(([itemNo, product]) => ({
    item_no: itemNo,
    ean: product.ean || '',
    subgroup: product.category === 'Vindu / Dør'
      ? 'Vindu / Dør'
      : product.category === 'Murmaling'
        ? 'Murmaling'
        : 'Maling / Dekkbeis / Beis'
  }));
  await q`WITH mappings AS (
    SELECT * FROM jsonb_to_recordset(${JSON.stringify(exteriorMappings)}::jsonb)
      AS x(item_no text, ean text, subgroup text)
  )
  UPDATE paint_products p
  SET area='exterior',
      subgroup=m.subgroup,
      category=m.subgroup,
      updated_at=now()
  FROM mappings m
  WHERE COALESCE(p.subgroup_locked,false)=false
    AND (p.ean=m.ean OR p.ean=m.item_no)`;

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
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS normalization_version integer NOT NULL DEFAULT 1`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_ean_idx ON paint_products(ean)`;
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
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS blob_url text`;
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS blob_size bigint`;
  await q`ALTER TABLE paint_import_jobs ADD COLUMN IF NOT EXISTS analyzed_at timestamptz`;
  await q`CREATE TABLE IF NOT EXISTS paint_import_job_days (
    job_id bigint NOT NULL REFERENCES paint_import_jobs(id) ON DELETE CASCADE,
    report_date date NOT NULL,
    report_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'staged',
    error text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(job_id,report_date)
  )`;
  await q`CREATE TABLE IF NOT EXISTS paint_import_job_products (
    job_id bigint NOT NULL REFERENCES paint_import_jobs(id) ON DELETE CASCADE,
    product_key text NOT NULL,
    product_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    error text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(job_id,product_key)
  )`;
  await q`CREATE INDEX IF NOT EXISTS paint_import_job_products_status_idx ON paint_import_job_products(job_id,status)`;
  await q`CREATE INDEX IF NOT EXISTS paint_import_job_days_status_idx ON paint_import_job_days(job_id,status)`;

}

function isConcurrentSchemaRace(error: unknown) {
  const value = error as { code?: string; constraint?: string; message?: string };
  return value?.code === '23505' && (
    value?.constraint === 'pg_class_relname_nsp_index' ||
    String(value?.message || '').includes('pg_class_relname_nsp_index')
  );
}

async function migrateWithRetry() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await runSchemaMigration();
      return;
    } catch (error) {
      if (!isConcurrentSchemaRace(error) || attempt === 3) throw error;
      // En annen serverless-instans oppretter samme tabell eller indeks akkurat nå.
      // Alle migrasjonene er idempotente, så vent kort og kjør dem på nytt.
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
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
