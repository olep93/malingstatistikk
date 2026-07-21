# Malingstatistikk V10.10.1

Denne versjonen inkluderer gjenopptakbar dagsimport, produktregister med scroll og prioritert kontroll, rollebasert tilgang (Admin/Leder), brukeradministrasjon kun for Admin og kompakt rapportarkiv gruppert som År → Måned → Uke → Dag.

## Roller
- **Admin:** Alle funksjoner, brukeradministrasjon og sletting av rapportdager.
- **Leder:** Dashboard, rapportimport, historikkimport, produktsynkronisering og produktregister. Kan ikke administrere brukere eller slette rapportdager.
- Eksisterende **Linn** migreres/opprettes som Leder.

# Malingstatistikk V7 – Executive Edition

Grafisk hovedoppgradering basert på Executive Dashboard-designet.

## Nytt
- Executive-header og KPI-kort med ikoner
- KPI-endring mot forrige rapportdag
- Leverandørkort med tydeligere andelssøyler
- A3-rapport med samme grafiske uttrykk som dashboardet
- Oppgradert produktkortdesign
- Neon, Blob, rapporthistorikk og automatisk produktberikelse beholdt

## Deploy
Last opp innholdet i mappen direkte til roten av GitHub-repositoryet.

## V7.3 – Performance & store switching
- Product lists are pre-indexed per warehouse.
- Switching focus warehouse remounts the product view with the correct warehouse key.
- Product filters reset when the warehouse changes.
- Derived rows and rankings are memoized to avoid unnecessary recalculation.

## Første testutgave – juli 2026

- Kontrollpanel med lenke til Coop BI-rapport og datoinstruks.
- Grønn/rød kontroll av om valgt rapportdato allerede finnes.
- Opplastingsmetadata (`uploaded_by`, tidspunkt) og ekstra adminbruker `Linn`.
- Historikk som År → Måned → Uke → Dag.
- Måned velges med separat år- og månedsmeny.
- Parser støtter både tidligere Excel-format og nytt BO-format med kolonnene Butikk, Dato, Varenr/navn, Vare VGR, Leverandør, Ant solgt, BTO og Oms.

### Miljøvariabler

- `DATABASE_URL` / `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`
- `SESSION_SECRET` (minst 24 tegn)
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `LINN_PASSWORD` (valgfri overstyring av testpassordet)

## V10.1.1 – navigasjonskontrast

- Undermenyen Dashboard / Produktsalg / Historikk har fått tydelig mørk tekst på lyse knapper.
- Aktiv visning markeres med mørk blå bakgrunn, hvit tekst og oransje understrek.
- Valgt vareområde vises i et eget tydelig informasjonsfelt.
- Mobilvisningen har horisontal rulling uten at kontrasten forsvinner.


## V10.2 – Datatest for alle hovedområder

- Én Excel-opplasting leser nå Eksteriørmaling, Interiørmaling, Terrasse og Malerverktøy.
- Vareområde Maling summerer alle fire områder.
- SAP-varegruppene 0677, 0678, 0689, 0662, 0682, 0686, 0687 og 0680 klassifiseres ved import.
- Fugemasse/kit (0685) importeres ikke som eget område i denne testversjonen.
- Undergrupper er første testklassifisering og skal kvalitetssikres mot produktregisteret.
- En ny opplasting på en eksisterende dato erstatter dagsrapporten og lagrer alle områdene.


## V10.5
- SAP-varegruppe 0687 Bygningstape er inkludert og klassifiseres som Malerverktøy → Tape.
- BI-lenken i Kontrollpanel er oppdatert til den nye rapportbokmerken.
- Valgt eksisterende rapportdag kan slettes direkte ved datovelgeren før ny opplasting.
