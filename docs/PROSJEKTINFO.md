# Malingstatistikk – prosjektinformasjon

## BI-rapport

- **Malnavn i BI Portal:** `Maling statistikk til vercel DSG`
- **Rapportlenke:** https://bi.coop.no/BOE/OpenDocument/opendoc/openDocument.jsp?sIDType=CUID&iDocID=AWy2QvRaEdFMmgGWQNqOsek&BOOKMARK=ATcOyK.4pEFEo.P.L8EaIT4
- **Varegrupper:** 0677, 0685, 0678, 0680, 0662, 0686, 0689 og 0682.

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
