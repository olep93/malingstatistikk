# Malingstatistikk V5

## Vercel-miljøvariabler

Neon-integrasjonen må levere én av: `DATABASE_URL`, `POSTGRES_URL` eller `STORAGE_URL`.
Blob-integrasjonen leverer `BLOB_READ_WRITE_TOKEN` automatisk.

Legg i tillegg inn:

- `ADMIN_USERNAME` – for eksempel `Admin`
- `ADMIN_PASSWORD` – et nytt sterkt passord
- `SESSION_SECRET` – minst 32 tilfeldige tegn

Etter at variablene er lagt inn må prosjektet deployes på nytt.

## V5

- Rapporter lagres permanent i Neon.
- Original Excel-fil lagres privat i Vercel Blob.
- Opplasting på eksisterende dato erstatter dagen i stedet for å doble den.
- Dager kan slettes fra admin; tilhørende Blob-fil slettes samtidig.
- Admininnlogging bruker serversignert HttpOnly-cookie.
- Dag, uke og måned summerer hvert varehus én gang.
- Omsetningsandel og fortjenesteandel viser prosent direkte i søylene.
- A3 bruker samme leverandørkort som dashboardet.
- Serverrute `/api/products/find-image` kan forsøke bildeoppslag hos Obsbygg.no.

Databasetabellene opprettes automatisk ved første forespørsel.

## V5.3
- Korrekt Obs BYGG-logo i toppmenyen.
- Andelssøyler har fast layout: etikett til venstre, grafisk søyle i midten og prosent til høyre.
- Produktbilder hentes automatisk ved publisering av Excel-rapporten.
- Kjente produkter kobles mot produktbiblioteket; manglende bilder forsøkes hentet fra Obsbygg.no og lagres i Neon.
- Ingen manuell «Hent manglende bilder»-knapp.
