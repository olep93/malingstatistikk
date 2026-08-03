## V16.1.1 – Produktberikelse og størrelsestekst

- Produktberikelsen fortsetter automatisk gjennom alle batcher.
- Feilede nettsideoppslag prøves kontrollert på nytt, maksimalt to ganger.
- Ferdigstatus vises først når alle produkter enten er beriket eller sendt til kontroll.
- Produkter uten sikkert treff telles separat og låser ikke importjobben.
- Liter-/pakningsstørrelse hentes fra produktsiden eller råvarenavnet og lagres i Product Master.
- Produktkort og utskriftsrapport viser ikke lenger standardteksten «Produkt»; størrelse utledes som fallback fra råvarenavnet.

# V16.1.0 – Importflyt 1

- Rapportdager importeres før produktberikelse.
- Produktberikelse er valgfri og blokkerer ikke historikkimport.
- Komplette varer i Product Master hoppes over automatisk.
- Berikelse kjører fem oppslag parallelt per serverkall.
- Fremdrift viser produkter behandlet og gjenstående.

## V16.0.0 Import Center Test 2

- Historisk analyse lagres nå i batcher på 200 varelinjer for å unngå Vercel `FUNCTION_PAYLOAD_TOO_LARGE`.
- Delvis analyserte rapportdager lagrer checkpoint (`staged_rows`) og fortsetter fra siste lagrede batch.
- Ferdige rapportdager hoppes over ved ny kjøring.
- Analyseknappen kan brukes igjen mens en jobb står i `analyzing` eller `staging`.
- Product Master-køen bygges fortløpende fra hver lagrede batch.

# V16 live pilot

- Adminfanen er endret fra testmiljø til **Power BI-import (pilot)**.
- Nasjonal Power BI-import publiserer fortsatt batchvis til hoveddatabasen.
- Etter vellykket publisering åpnes hoveddashboardet automatisk på den publiserte datoen.
- Samvirkelag- og varehusfiltrering brukes på hovedsiden for nasjonale rapportdager.
- Gammel import beholdes som fallback i pilotperioden.

## V16.0.0-test.2
- Flyttet «Test kun for Ole» til første fane før Eksteriørmaling.
- Testfanen vises kun for innlogget admin, også i mobilvelgeren.
- Klikk på et ordinært vareområde forlater testmiljøet og går tilbake til ordinært dashboard.

# V16.0.0-test.1

- Nasjonalt Power BI-testmiljø kun for admin.
- Samvirkelag → fokusvarehus basert på 66 Obs BYGG-varehus.
- Ny parser for Power BI-eksport med GTIN/EAN uten varenavn.
- Nye verktøytagger: Rens & vask, Maletilbehør og Fugemasse & Kitt.
- Utskriftsrapport viser topp 4 + fokusvarehus på faktisk plass dersom fokus er utenfor topp 5.
- Testimporten lagres ikke i databasen i denne iterasjonen.

# Changelog

## 15.4.3 – Variantkorrekte produktbilder
- Produktoppslag velger nå bilde fra eksakt EAN-variant når bilde-URL-en inneholder EAN.
- Produktlenken lagres med riktig `?v=ObsBygg-<EAN>` når varianten kan identifiseres.
- Historiske produkter uten EAN bruker rapportert størrelse før sidens standardvariant.
- Variant-EAN kan utledes fra valgt produktbilde og brukes til et nytt, variantspesifikt sideoppslag.
- Normaliseringsversjonen er økt slik at gamle produktkoblinger kan oppdateres ved nytt oppslag.

# 15.4.1

- Product Master rydder nå også produkter som bare har varenummer.
- Godkjent produktreferanse gjenoppretter EAN, navn, størrelse og eksteriør-tag automatisk ved eksakt varenummer/EAN.
- Eksakte EAN-treff fra Obsbygg.no oppdateres automatisk; eksakte varenummertreff uten kjent EAN sendes til kontroll.
- Synkroniseringen viser EAN gjenopprettet, produkter til kontroll, ikke funnet og feil.
- BI-knappen blokkeres ikke lenger mens en bakgrunnssjekk av lenken pågår.

# Changelog

## 15.3.0 – 2026-07-26

### Added
- Støtte for ny BI-rapport med egen `EAN/UPC`-kolonne.
- Separat lagring av EAN og varenummer i Product Master.
- Eksakt EAN-først-oppslag med varenummer som reserve og bekreftelsesdialog.
- Uavhengig lasting og Neon-lagring av BI-rapportlenken.

### Fixed
- BI-knappen kan ikke lenger åpnes før korrekt filtrert rapportlenke er lastet.
- Product Master lagrer ikke lenger varenummer feilaktig i EAN-feltet.

## 15.2.0

- Støtte for den nye daglige BI-rapporten med egen `EAN/UPC`-kolonne før varenummer og varenavn.
- EAN lagres separat fra varenummer gjennom parser, rapportdata, hurtigbuffer og Product Master-synkronisering.
- Eksakt Obsbygg-oppslag prioriterer rapportens EAN/UPC når den finnes.
- Administrator kan endre og lagre lenken til Coop BI-rapporten direkte i Kontrollpanel uten ny commit.
- Standardlenken er oppdatert til den nye rapportmalen og bookmarken.

## 15.1.0

- La til **Hent manuelt fra Obsbygg.no** i Produktmaster.
- Oppslag søker kun etter eksakt EAN/PLU og endrer ikke data ved søk.
- La til forhåndsvisning av produktnavn, bilde, URL, treffmetode og treffsikkerhet.
- Produktdata lagres først etter eksplisitt bekreftelse.
- Bekreftede produkter oppdateres i Produktmaster og fjernes fra behandlingskøen når de er komplette.

## 15.0.0 – Product Master 2.0, Exact Lookup og Admin Quick Edit

- Automatisk produktkobling krever nå eksakt EAN/PLU-match på Obsbygg.no.
- Navnelikhet alene godkjennes ikke lenger automatisk.
- Oppslagsmetode, bekreftet nummer og match confidence lagres i Produktmaster.
- Produkter uten eksakt treff merkes for manuell kontroll uten å overskrive eksisterende data.
- Admin kan redigere navn, leverandør, vareområde, tag, bilde og produktlenke direkte fra Produktsalg.
- Admin kan søke eksakt på nytt eller fjerne en feil kobling fra Quick Edit-panelet.
- Etter lagring lastes valgt rapportperiode på nytt fra Produktmaster.
- Leverandørfeltet i Quick Edit er typesikkert og begrenset til gyldige `Supplier`-verdier.
- Profesjonell README, miljøvariabelmal og produksjonssjekkliste er lagt til.

## 14.2.1

- Dynamisk høydefordeling i A4-rapporten basert på antall solgte underkategorier.
- Underkategorier og nøkkeltall komprimeres gradvis ved 6–7 kategorier.
- Topp 5 og regionsrangering flyttes ned i normal dokumentflyt og får resterende tilgjengelig sidehøyde.
- Produkter og regionrader skaleres innenfor tilgjengelig høyde slik at rapporten holder seg på én side.

# Changelog

## 15.2.0

- Støtte for den nye daglige BI-rapporten med egen `EAN/UPC`-kolonne før varenummer og varenavn.
- EAN lagres separat fra varenummer gjennom parser, rapportdata, hurtigbuffer og Product Master-synkronisering.
- Eksakt Obsbygg-oppslag prioriterer rapportens EAN/UPC når den finnes.
- Administrator kan endre og lagre lenken til Coop BI-rapporten direkte i Kontrollpanel uten ny commit.
- Standardlenken er oppdatert til den nye rapportmalen og bookmarken.

## 14.2.0
- Felles kategori-/vareområdefiltrering i Produktsalg.
- KPI-er og topplister følger aktive filtre.
- Malerverktøy og Vareområde Maling sammenlignes etter underkategori/vareområde i stedet for leverandør.
- Utskriftsrapport: Topp 5 produkter, regionsrangering, korte varehusnavn og kollisjonssikker bunnlayout.


## 14.0.0 – Enterprise baseline

- Reintegrated the missing `Admin` component that blocked the Next.js build.
- Kept the V13.1 Product Master pilot as the primary admin workflow.
- Product Master now separates new, incomplete, approved and all products.
- Approved products are reused instead of being automatically audited on every import.
- Manual product completion supports display name, area, tag, image and product URL.
- Retains the V13 A4 report overhaul, tool-specific report layout and fixed Top 10 ordering.
- Updated package version to 14.0.0.

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

## 15.4.0 – Product Master Sync og grensesnittforbedringer

- BI-rapportlenken leses umiddelbart fra lokal, validert cache og synkroniseres mot Neon i bakgrunnen.
- Når administrator lagrer en ny BI-lenke, oppdateres både Neon og lokal cache med én gang.
- Ny **Synkroniser Product Master**-funksjon behandler ufullstendige produkter med EAN i grupper.
- Kun verifiserte, eksakte EAN-treff kan godkjennes automatisk. Produkter uten treff blir stående til manuell kontroll.
- Fremdrift viser antall kontrollert, oppdatert, ikke funnet og feil.
- Rediger-knappen på produktkort er flyttet under produktbildet.
- Sammenligningskort skalerer og bryter responsivt ved 4–5 valgte varehus, slik at nøkkeltall ikke går utenfor kortene.
- Mobilmenyen viser Dashboard, Produktsalg og Sammenligning.

## 15.4.2
- Rettet kolonnejustering i regionsrangeringen på A4-rapporten.
- Overskrift og datarader bruker nå identisk CSS-grid.
- Omsetning, fortjeneste og fortjenesteprosent høyrejusteres mot samme kolonner.
- Tabellen holder seg innenfor rapportkortet også ved større tall.

## V16.0.0-test.4
- Admin-testfanen har nå klientstyrt Product Master-synk i puljer, både for manglende produkter og full kontroll av alle produkter med EAN/varenummer.
- Nasjonal Power BI-fil kan analyseres, berikes og publiseres som ordinær rapportdag.
- Publisering bruker eksisterende rapport-API og erstatter dermed eventuell tidligere rapport for samme dato, i stedet for å doble salgstall.
- Etter publisering oppdateres rapportlisten, og historiske visninger henter løpende navn/bilder fra Product Master.

## 16.0.0-test.5
- Nasjonal Power BI-publisering sendes i batcher på 250 aggregerte produktlinjer for å unngå Vercel 413-grensen.
- Rapportdagen opprettes, eksisterende cached-rader erstattes og batchene skrives direkte til `paint_report_rows`.
- Hovedsiden lastes på nytt til den publiserte datoen når importen er ferdig.
- Hovedsiden har nå filterrekkefølgen Samvirkelag → Fokusvarehus, og regional rangering avgrenses til valgt samvirkelag.
- Rapporter lagret direkte som rader blir ikke overskrevet av den gamle JSON-cachebyggeren.

## V16.1.3
- Gjenoppretter spannstørrelse i produktkort og rapporter.
- Normaliserer 0,68/1 L til 1 L, 2,7/3 L til 3 L, 4,5/5 L til 5 L og 9/10 L til 10 L.
- Beholder EAN og råvarenavn for sporbarhet, og slår kun sammen samme produktserie/type innen normalisert størrelse.
- Product Master-oppslag kan kobles via EAN dersom produktnøkkelen er endret av størrelsesnormaliseringen.
