# Malingstatistikk V12 Enterprise

Denne versjonen viderefører Enterprise-funksjonene og flytter rapportlesing over på den normaliserte tabellen `paint_report_rows`.

## Viktige endringer

- Metadata lastes separat fra rapportlinjer.
- Dag, uke, måned, hittil i år og år aggregeres i Neon med SQL.
- Eksisterende JSON-rapporter migreres automatisk til `paint_report_rows` ved første periodeoppslag.
- Nye og erstattede rapportdager ugyldiggjør bare aktuell dag i hurtigbufferen.
- Produktmasterens manuelle lagring bruker eksplisitte PostgreSQL-typer og retter `$7`-feilen.
- Eksteriørtaggene er gjenopprettet og brukes i Top 3.
- Leverandørmiksen er gjort om til lesbare søyler med omsetning, andel og fortjeneste.
- Utskrift har en isolert A3-layout hvor navigasjon og skjermverktøy skjules.

## Første oppstart

Første åpning av en eldre periode kan bruke noe tid fordi eksisterende rapportdager normaliseres. Etter dette leses perioden direkte fra indekserte rader. Nye rapporter skrives inn i hurtiglaget ved importflyten.
