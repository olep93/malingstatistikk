# Malingstatistikk V14 Enterprise

Stabil enterprise-baseline for rapportering, Produktmaster, import og administrasjon.

# Malingstatistikk Enterprise

Malingstatistikk er et internt Business Intelligence-verktøy for analyse av salget i vareområde maling hos Obs BYGG. Løsningen importerer Excel-rapporter fra Coop BI, lagrer historiske salgsdata og presenterer nøkkeltall for dag, uke, måned, hittil i år og år.

## Formål

Systemet skal gjøre det enkelt for ledere og ansatte å forstå:

- omsetning, fortjeneste og fortjenesteprosent
- salgsutvikling per varehus og periode
- leverandørmiks for Infra, Butinox og Jotun
- utvikling per hovedområde og underkategori
- topprodukter og solgte enheter
- sammenligning mellom varehus

## Hovedområder

- Vareområde Maling
- Eksteriørmaling
- Interiørmaling
- Terrasse
- Malerverktøy

## Rapportflyt

1. Brukeren åpner Coop BI-rapporten fra kontrollpanelet.
2. Riktig rapportdato velges i BI.
3. Rapporten eksporteres til Excel.
4. Excel-filen leses og valideres i Malingstatistikk.
5. Produktregisteret synkroniseres.
6. Rapportdagen publiseres til databasen.
7. Dataene blir tilgjengelige i dashboard, historikk, sammenligning og utskriftsrapport.

## Roller

### Leder

- se dashboard og historikk
- sammenligne varehus
- laste opp dagsrapport
- skrive ut dag-, uke-, måneds-, YTD- og årsrapport

### Admin

Har alle lederfunksjoner, i tillegg til:

- produktmaster og Product Audit
- historikkimport og serverjobber
- brukeradministrasjon
- sletting og vedlikehold av rapportdager

## Rapportmotor

Utskriftsrapporten består av fem gjenkjennelige A4-sider med samme oppsett for alle periodetyper:

1. Vareområde Maling
2. Eksteriørmaling
3. Interiørmaling
4. Terrasse
5. Malerverktøy

Hver side inneholder KPI-er, automatisk innsikt, underkategorier og topp 10 produkter. Vanlige malingsområder viser leverandørmiks. Malerverktøy bruker i stedet operative nøkkeltall og underkategoriøkonomi, fordi leverandørmiks har begrenset styringsverdi der.

## Teknologi

- Next.js 16
- React 19
- TypeScript
- Neon PostgreSQL
- Vercel og Vercel Blob
- XLSX for Excel-import
- Jose for sesjon og autentisering

## Lokal oppstart

```bash
npm install
npm run dev
```

Åpne deretter `http://localhost:3000`.

Produksjonsbygg:

```bash
npm run build
npm start
```

## Miljøvariabler

Kopier `.env.example` til `.env.local` og fyll inn nødvendige verdier. Hemmeligheter skal aldri legges i Git.

De viktigste variablene er:

- `DATABASE_URL` eller `POSTGRES_URL`
- `SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `LINN_PASSWORD`
- `STORAGE_URL`

## Deploy

Prosjektet er laget for Vercel. Koble GitHub-repositoriet til et Vercel-prosjekt, legg inn miljøvariablene i Vercel og deploy fra en branch. Test endringer i Preview Deployment før de merges til `main`.

## Prosjektstruktur

```text
src/app/              Next.js-sider, API-ruter og global CSS
src/components/       Dashboard, rapporter og kontrollpanel
src/lib/              Parser, datamodell, produktlogikk og serverfunksjoner
public/                Logoer, produktbilder og BI-instruksjoner
docs/screenshots/      Dokumentasjonsbilder fra Coop BI
```

## Versjonering

Prosjektet følger semantisk versjonering. Endringer dokumenteres i [`CHANGELOG.md`](CHANGELOG.md). Versjon 13.0.0 er første ryddede og dokumenterte baseline.
