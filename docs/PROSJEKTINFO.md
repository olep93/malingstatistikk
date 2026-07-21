# Malingstatistikk – prosjektinformasjon

## BI-rapport

- **Malnavn i BI Portal:** `Maling statistikk til vercel DSG`
- **Rapportlenke:** https://bi.coop.no/BOE/OpenDocument/opendoc/openDocument.jsp?sIDType=CUID&iDocID=AWy2QvRaEdFMmgGWQNqOsek&BOOKMARK=AYaB3u8gVmJGqv2jSPK8iAs
- **Varegrupper:** 0677, 0685, 0678, 0680, 0662, 0686, 0687, 0689 og 0682.

## Daglig oppdatering

1. Åpne rapportlenken.
2. Endre datofilteret til datoen rapporten skal gjelde.
3. Klikk eksportikonet øverst til høyre.
4. Velg **Export to Microsoft Excel**.
5. Last opp Excel-filen i Kontrollpanel i Malingstatistikk.

> **NB:** Husk å endre dato til dagen du ønsker at rapporten skal gjelde.

## Skjermbilder

- `docs/screenshots/bi-portal-datofilter.png`
- `docs/screenshots/bi-portal-rapportvisning.png`
- `docs/screenshots/bi-portal-eksport-excel.png`

Excel-formatet er den autoritative importkilden. PDF og CSV skal ikke brukes til den daglige importen.


## V10.3 – produktnormalisering

- Interiør- og terrasseprodukter får kundevennlige visningsnavn fra et lokalt, varenummerstyrt produktregister/regellag.
- A-, B-, C- og hvitbase summeres som samme produkt når produktserie og spannstørrelse er lik.
- Obsbygg.no brukes som referanse for kundevennlige navn og bilder, men dashboardet er ikke avhengig av live oppslag ved visning.
- Eksempler: `Butinox Elegant Matt`, `TreStjerner Gulvmaling Matt`, `LADY Pure Color` og `Trebitt Terrassebeis`.
- Produktserie og spannstørrelse holdes adskilt, slik at 2,7 L og 9 L fortsatt vises som separate produktlinjer.


## V10.4
- Eksportbildet vises i Kontrollpanel sammen med datofilterbildet.
- Malerverktøy bruker «artikler»/«stk.» i stedet for «spann».
- Maskeringsblad klassifiseres ikke lenger som tape. Tape krever eksplisitt tape-navn i kildedata.
- Produktnavn som blir funnet på Obsbygg.no brukes som visningsnavn etter automatisk produktberikelse.


## V10.5
- Varegruppe 0687 Bygningstape er lagt til i BI-uttrekket og importeres som Malerverktøy → Tape.
- Kontrollpanelet bruker ny BI-lenke/bokmerke.
- Eksisterende valgt dato kan slettes direkte i opplastingsdelen.

## V10.6 – Produktregister og Obsbygg-cache

Ved publisering samler appen alle unike produktnøkler fra Excel-filen og sjekker dem mot Neon-tabellen `paint_products`.

- Lagrede produktdata yngre enn 90 dager brukes direkte.
- Bare nye eller utdaterte produkter søkes opp på Obsbygg.no.
- SAP-navn lagres som `source_name`.
- Navn fra nettsiden lagres som `website_name`.
- Dashboardnavnet lagres som `display_name`.
- Manuelt endrede navn beskyttes med `display_name_locked`.
- Oppslagsstatus og tidspunkt lagres i `lookup_status` og `last_fetched_at`.
- Rapporten publiseres først når produktsynkroniseringen er ferdig.

API:
- `POST /api/products/sync` – synkroniserer produktgrupper i små puljer.
- `GET /api/products/registry` – viser produktregisteret.
- `PATCH /api/products/registry` – låser et manuelt visningsnavn.
