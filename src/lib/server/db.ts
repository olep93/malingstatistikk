import { neon } from '@neondatabase/serverless';

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL || '';
}

export function sql() {
  const url = connectionString();
  if (!url) throw new Error('Database er ikke koblet til. Kontroller Neon-miljøvariablene i Vercel.');
  return neon(url);
}

export async function ensureSchema() {
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
  await q`ALTER TABLE paint_products ADD COLUMN IF NOT EXISTS normalization_version integer NOT NULL DEFAULT 1`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_ean_idx ON paint_products(ean)`;
  await q`CREATE INDEX IF NOT EXISTS paint_products_lookup_status_idx ON paint_products(lookup_status)`;
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
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
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
