# Malingstatistikk V10.12 – stabilisering

Denne versjonen stabiliserer historikkimport, Produktmaster, søk og tags.

## Historikkimport
- Bruker Vercel Blob presigned uploads med OIDC og `BLOB_STORE_ID`.
- Krever ikke `BLOB_READ_WRITE_TOKEN`.
- Bruker eksisterende `BLOB_WEBHOOK_PUBLIC_KEY` for callback-verifisering.
- Store Excel-filer går direkte fra nettleseren til Blob og omgår Vercel Functions sin 4,5 MB-grense.
- Importjobber og fremdrift lagres i Neon og kan fortsettes fra en annen enhet.

## Produktmaster
- Produkter fra rapportarkivet repareres inn i Produktmasteren automatisk.
- Søk dekker varenummer, EAN, Excel-navn, nettsidenavn, visningsnavn, leverandør, område, tag og aliaser.
- Første/siste rapportdato og antall rapportdager lagres per produkt.
- Admin-endringer av navn og tag lagres permanent og registreres i endringslogg.
- Tagvalg valideres mot produktets område.
- Produktmaster Audit oppdaterer aliaser, tar i bruk nettsidenavn der navnet ikke er låst og setter tydelig kontrollårsak.

## Viktig
Blob Store må være koblet til prosjektet, og Vercels systemvariabler må være aktivert. Følgende variabler brukes:
- `BLOB_STORE_ID`
- `VERCEL_OIDC_TOKEN` (automatisk systemvariabel på Vercel)
- `BLOB_WEBHOOK_PUBLIC_KEY`
