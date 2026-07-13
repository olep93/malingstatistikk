# Malingstatistikk – V1

Første fungerende prototype av et offentlig, utskriftsvennlig maling-dashboard med et separat adminområde.

## Innhold

- Offentlig dagsdashboard
- KPI-er og endring mot forrige rapportdag
- Leverandørgrafer og regionbenchmark
- Produktside med søk og leverandørfilter
- Rapporthistorikk
- A4-utskriftsvisning / PDF via nettleseren
- Demo-admin med filopplasting, kontrolltabell og publisering
- Responsivt design for mobil og PC

## Start lokalt

```bash
npm install
npm run dev
```

Åpne `http://localhost:3000`.

## Deploy til Vercel

1. Opprett GitHub-repositoryet `Malingstatistikk`.
2. Last opp alle filene fra denne mappen.
3. Importer repositoryet i Vercel.
4. Vercel finner Next.js automatisk og bygger prosjektet.

## Viktig om V1

Tallene ligger foreløpig som demo-data i `src/data/demo.ts`. Admininnlogging og bildeanalyse er simulert i grensesnittet. Dette er bevisst, slik at design, navigasjon, produktvisning og utskrift kan testes før Firebase og AI-tolkning kobles til.

## Neste integrasjoner

- Firebase Authentication for administrator
- Firestore for dagsrapporter og historikk
- Vercel Blob eller Firebase Storage for originale SAP-bilder
- Serverbasert AI-tolkning av opplastet datagrunnlag
- Kontroll og publisering til offentlig dashboard
