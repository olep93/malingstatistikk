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
}

