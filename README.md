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
