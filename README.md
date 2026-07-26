
## V15.3.0 – EAN-first import og Product Master 2.0

- Leser både eldre BI-uttrekk og ny rapportmal med `EAN/UPC`, `Varenr/navn`, varegruppe og leverandør.
- Bevarer EAN og varenummer som separate identifikatorer gjennom import, rapportbuffer og Product Master.
- Manuelt Obsbygg-oppslag søker først eksakt EAN, deretter eksakt varenummer. Navnelikhet godkjennes aldri automatisk.
- Treff vises i en forhåndsvisning og lagres først etter eksplisitt bekreftelse.
- BI-rapportlenken lastes separat fra salgs- og produktdata. Knappen er deaktivert til en validert lenke med `iDocID` og `BOOKMARK` er klar.
- Administrator kan endre BI-lenken i Kontrollpanel; verdien lagres i Neon uten commit eller ny deploy.

<div align="center">
  <img src="public/logos/obsbygg.png" alt="Obs BYGG" width="220" />

# Malingstatistikk Enterprise

**Internt BI-, rapporterings- og produktstyringssystem for vareområde maling i Obs BYGG**

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E599)](https://neon.tech/)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel-black)](https://vercel.com/)

**Versjon 15.0.0** · Intern løsning · Ikke for offentlig distribusjon
</div>

---

## Oversikt

Malingstatistikk Enterprise samler salgsdata fra Coop BI og gjør dem om til operative styringsdata for malingsavdelingen. Løsningen gir ledere et samlet bilde av omsetning, fortjeneste, margin, produktmiks, varehusplassering og utvikling over tid.

Systemet kombinerer tre hovedområder:

1. **Analyse og rapportering** – dashboard, historikk, sammenligning og utskriftsrapporter.
2. **Produktmaster** – sentral kilde for produktnavn, leverandør, kategori, tag, bilde og produktlenke.
3. **Import og administrasjon** – Excel-import, validering, brukerroller og vedlikehold av rapportarkivet.

## Funksjoner

### Dashboard og nøkkeltall

- Dag, uke, måned, hittil i år og år.
- Omsetning, fortjeneste, fortjenesteprosent og antall solgte enheter.
- Regionsplassering med endring fra forrige sammenlignbare periode.
- Leverandørfordeling for Infra, Butinox og Jotun.
- Fordeling på hovedområder og underkategorier.
- Fokusvarehus og sammenligning mellom varehus.

### Vareområder

- Vareområde Maling
- Eksteriørmaling
- Interiørmaling
- Terrasse
- Malerverktøy

### Produktsalg

- Rangering av produkter etter salg og fortjeneste.
- Filtrering på leverandør, vareområde og underkategori.
- Samling av produktbaser og kommersielle spannstørrelser.
- Produktbilder, marginindikator og salgsinformasjon.
- **Admin Quick Edit** direkte fra produktkortet.

### Product Master 2.0

Product Master er systemets sentrale sannhetskilde for produktmetadata.

- Produktnavn og navn fra rapporten.
- EAN/PLU og intern produktnøkkel.
- Leverandør, vareområde og tag.
- Produktbilde og produktlenke.
- Første og siste observerte rapportdato.
- Antall rapportdager produktet forekommer i.
- Oppslagsstatus, kontrollstatus og endringshistorikk.

#### Eksakt produktkobling i V15

Automatiske treff godkjennes bare når identiteten kan dokumenteres med:

- eksakt EAN, eller
- eksakt PLU/varenummer.

Navnelikhet alene brukes ikke til permanent kobling. Treff uten bekreftet nummer blir stående til manuell kontroll og overskriver ikke eksisterende produktdata.

### Admin Quick Edit

Administrator kan redigere et produkt uten å forlate Produktsalg:

- navn
- leverandør
- vareområde
- tag/underkategori
- bilde-URL
- produktlenke

Panelet støtter også nytt eksakt oppslag og fjerning av feil produktkobling. Endringen lagres i Product Master og lastes inn i rapportvisningene uten ny Excel-import.

### Rapportmotor

- A4-tilpassede rapporter for alle hovedområder.
- KPI-er, automatisk innsikt og periodeinformasjon.
- Leverandørmiks eller område-/underkategorifordeling.
- Topp 5-produkter og regional rangering.
- Dynamisk høydefordeling basert på antall underkategorier.
- Kompakt og tett modus for å hindre overlapp ved utskrift.

### Import og historikk

- Opplasting av dagsrapport fra Excel.
- Kontroll mot resultatlinjer i BI-uttrekket.
- Separat produktsynkronisering før publisering.
- Historikkimport med oppdeling i mindre jobber.
- Gjenopptakbar import og kontroll av eksisterende rapportdager.
- Rapportarkiv med sletting for administrator.

### Roller og tilgang

| Rolle | Tilgang |
|---|---|
| **Leder** | Dashboard, Produktsalg, Historikk, Sammenligning, utskrift og dagsopplasting |
| **Admin** | Alle lederfunksjoner samt Product Master, produktredigering, historikkimport, brukeradministrasjon og sletting |

## Dataflyt

```text
Coop BI
   │
   ├── Eksporter Excel
   ▼
Validering og normalisering
   │
   ├── Produkt finnes i Product Master ──► bruk lagrede metadata
   │
   └── Nytt produkt
          │
          ├── eksakt EAN/PLU-treff ──► lagre permanent
          └── ingen eksakt match ────► manuell kontroll
   ▼
Neon PostgreSQL
   │
   ├── Dashboard
   ├── Produktsalg
   ├── Historikk
   ├── Sammenligning
   └── Utskriftsrapport
```

## Teknologistack

| Lag | Teknologi |
|---|---|
| Applikasjon | Next.js 16, React 19, TypeScript |
| Database | Neon PostgreSQL |
| Fil- og bildelagring | Vercel Blob |
| Excel | SheetJS / XLSX |
| Autentisering | Signerte sesjoner med JOSE |
| Ikoner | Lucide React |
| Hosting | Vercel |

## Prosjektstruktur

```text
malingstatistikk/
├── docs/
│   └── screenshots/          Dokumentasjon av BI-arbeidsflyten
├── public/
│   ├── logos/                Logoer til skjerm og rapport
│   └── products/             Lokale produktbilder og fallback-bilder
├── src/
│   ├── app/
│   │   ├── api/              API-ruter for rapporter, produkter og autentisering
│   │   ├── globals.css       Skjerm-, mobil- og utskriftsdesign
│   │   └── page.tsx          Applikasjonens inngangspunkt
│   ├── components/
│   │   ├── PaintDashboard.tsx
│   │   └── ServerImportJobs.tsx
│   └── lib/
│       ├── data.ts           Domeneobjekter og normalisering
│       ├── parser.ts         Excel-parser og rapportgruppering
│       ├── product-*.ts      Produktreferanser og katalogregler
│       └── server/           Database, autentisering og produktoppslag
├── CHANGELOG.md
├── package.json
└── README.md
```

## Lokal utvikling

### Krav

- Node.js 22 eller nyere
- npm 10 eller nyere
- Tilgang til en PostgreSQL-database

### Installasjon

```bash
git clone <repository-url>
cd malingstatistikk
npm ci
cp .env.example .env.local
npm run dev
```

Applikasjonen blir tilgjengelig på `http://localhost:3000`.

### Kvalitetskontroll

```bash
npm run lint
npm run build
```

Begge kommandoene skal fullføres før en endring merges til `main`.

## Miljøvariabler

| Variabel | Påkrevd | Formål |
|---|---:|---|
| `DATABASE_URL` eller `POSTGRES_URL` | Ja | Neon/PostgreSQL-tilkobling |
| `SESSION_SECRET` | Ja | Signering av innloggingssesjoner |
| `ADMIN_USERNAME` | Anbefalt | Første administratorkonto |
| `ADMIN_PASSWORD` | Anbefalt | Passord for første administratorkonto |
| `LINN_PASSWORD` | Valgfri | Kompatibilitet med eksisterende lederkonto |
| `BLOB_READ_WRITE_TOKEN` | Ved Blob-bruk | Tilgang til Vercel Blob |
| `STORAGE_URL` | Valgfri | Eksisterende lagringsintegrasjon |

Hemmeligheter skal aldri lagres i Git eller skrives inn direkte i kildekoden.

## Database og migrering

Applikasjonen kjører idempotente `CREATE TABLE IF NOT EXISTS`- og `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`-operasjoner gjennom `ensureSchema()`. Dette gjør at V15 kan oppgradere en eksisterende database uten å slette rapporthistorikk eller Product Master.

V15 legger blant annet til metadata for produktoppslag:

- `lookup_method`
- `matched_identifier`
- `match_confidence`
- `review_reason`
- `audit_status`

Ta alltid databasebackup før større produksjonsoppgraderinger.

## Deploy til Vercel

1. Opprett eller bruk en egen oppgraderingsbranch.
2. Push branchen til GitHub.
3. Kontroller Vercel Preview Deployment.
4. Test innlogging, rapportlasting, produktredigering og utskrift.
5. Merge til `main` først når preview-build og funksjonstest er godkjent.

Det anbefales ikke å tømme `main` før den nye versjonen har bygget grønt i Vercel.

## Sjekkliste før produksjon

- [ ] `npm run build` er grønn.
- [ ] Databasevariabler er lagt inn i Vercel.
- [ ] Admin- og lederinnlogging fungerer.
- [ ] En eksisterende rapportdag kan åpnes.
- [ ] En ny dagsrapport kan valideres og publiseres.
- [ ] Quick Edit oppdaterer Product Master.
- [ ] Feil EAN/PLU-treff overskriver ikke produktdata.
- [ ] Alle fem A4-sider kan forhåndsvises uten overlapp.
- [ ] Mobilvisning og desktopvisning er kontrollert.

## Versjonering

Prosjektet følger semantisk versjonering:

- **Major** – arkitektur eller arbeidsflyt med mulig migreringsbehov.
- **Minor** – ny funksjonalitet som er bakoverkompatibel.
- **Patch** – feilretting og mindre forbedringer.

Se [CHANGELOG.md](CHANGELOG.md) for versjonshistorikk.

## Sikkerhet og bruk

Dette er en intern virksomhetsapplikasjon. Kildekode, innloggingsinformasjon, rapportdata og produktdata skal behandles i henhold til virksomhetens interne sikkerhetsrutiner. Prosjektet er ikke lisensiert for offentlig distribusjon.

---

<div align="center">
  <strong>Malingstatistikk Enterprise V15.0.0</strong><br />
  Utviklet som operativt beslutningsstøtteverktøy for Obs BYGG.
</div>


## Manuelt produktoppslag med bekreftelse

I Produktmaster kan en administrator velge **Hent manuelt fra Obsbygg.no**. Systemet søker kun etter en eksakt EAN-/PLU-match, viser navn, bilde, URL og treffinformasjon i en forhåndsvisning, og lagrer ingenting før administratoren velger **Bekreft og lagre**. Etter bekreftelse oppdateres Produktmaster, og produktet forsvinner automatisk fra behandlingskøen når obligatoriske data er komplette.


## Konfigurerbar BI-rapport

Den daglige Excel-parseren støtter nå en egen `EAN/UPC`-kolonne foran `Varenr/navn`. EAN lagres separat og brukes som førstevalg ved eksakte produktoppslag mot Obsbygg.no. Administrator kan endre feltet **Lenke til rapport BI portal** i Kontrollpanel. Lenken lagres i databasen og krever derfor ikke kodeendring eller ny deploy.
