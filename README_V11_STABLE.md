# Malingstatistikk V11.0 Stable

Stabiliseringsendringer i denne pakken:

- Hindrer samtidige databaseinitialiseringer i samme serverinstans.
- Håndterer PostgreSQL-race ved `pg_class_relname_nsp_index` med kontrollert retry.
- Retter TypeScript-feilen ved `rows.at(-1)` i Produktmaster Audit.
- Gjør Obs BYGG-logoen til hjem-knapp.
- Hjem-knappen åpner Eksteriørmaling → Dashboard → Dag.
- Beholder eksisterende Produktmaster, tags, roller, rapportarkiv og serverlagret historikkimport.

Etter deploy bør første innlasting få fullføre databaseinitialiseringen før flere faner åpnes samtidig.
