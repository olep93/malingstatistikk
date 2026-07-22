# Changelog

## 13.1.0 – Product Master-pilot
- Erstatter den synlige flertrinns-auditen med Produktmaster-dashboard.
- Nye produkter, manglende informasjon, godkjente produkter og alle produkter er egne visninger.
- Manuelt nettsøk utføres kun ved behov.
- Admin kan angi navn, vareområde, tag, bilde-URL og laste opp bilde.
- Godkjente produkter brukes videre uten automatiske gjentatte oppslag.


Alle vesentlige endringer i Malingstatistikk dokumenteres her.

Formatet følger prinsippene i Keep a Changelog, og prosjektet bruker semantisk versjonering.

## [13.0.1] - 2026-07-22

### Fixed
- Topp 10 i A4-rapporten vises nå i fast rekkefølge: 1–5 i venstre kolonne og 6–10 i høyre kolonne.
- Produktrekkefølgen kan ikke lenger endres av CSS-gridens automatiske plassering.
- Produkthøyden er komprimert og låst slik at fem produkter får plass i hver kolonne på alle rapportsider.
- Rapporten viser tydelig når valgt periode faktisk har færre enn ti produkter med salg.

## [13.0.0] - 2026-07-22

### Added

- Ny ryddet prosjektbaseline med én README og én changelog.
- Topp 10 produkter på hver A4-rapportside.
- Dedikert rapportoppsett for Malerverktøy.
- Operative nøkkeltall for Malerverktøy: solgte enheter, snitt omsetning per enhet, snitt fortjeneste per enhet, beste kategori og kategori med lavest margin.
- Sidenummer i rapportfot.

### Changed

- Underkategorier følger nå samme visuelle og økonomiske mal som leverandørmiks.
- Underkategorier viser omsetningsandel, omsetning i kroner, fortjeneste i kroner og fortjenesteprosent.
- Produktradene i rapporten er komprimert kontrollert for å utnytte A4-siden uten å redusere lesbarheten.
- Pakkeversjon oppdatert til 13.0.0.

### Removed

- Historiske README-filer fra V8–V12.
- Utdatert `docs/PROSJEKTINFO.md`.
- Lokal TypeScript build-cache.
- Leverandørmiks og KPI-en «Største leverandør» fra Malerverktøy-rapporten.

## Eldre versjoner

Versjonene før 13.0.0 ble utviklet iterativt og var dokumentert i separate README-filer. V13.0.0 erstatter disse med én kontrollert baseline. Git-historikken skal brukes ved behov for detaljert historikk.
