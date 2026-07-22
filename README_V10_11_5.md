# V10.11.5 – Blob-token og Produktmaster Audit

- Stor historikkfil lastes direkte til Vercel Blob.
- Opplastingsendepunktet kontrollerer `BLOB_READ_WRITE_TOKEN` og gir en konkret konfigurasjonsfeil.
- Produktmaster Audit viser manglende nettsidenavn, tags, Excel-navn og mulige dubletter.
- Admin kan kjøre «Rydd produktmaster» for å bruke nettsidenavn på ulåste varer og bygge søkealiaser.
- Søk støtter robuste aliaser og produktets gamle navn.
- Tag-menyen bruker reparert område og viser alle tags som reserve når området mangler.

## Viktig ved deploy
Koble et Vercel Blob-lager til prosjektet og kontroller at miljøvariabelen `BLOB_READ_WRITE_TOKEN` finnes i Production (og Preview ved test). Deretter må prosjektet deployes på nytt.
