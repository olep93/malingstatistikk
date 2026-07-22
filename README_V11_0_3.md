# Malingstatistikk V11.0.3

## Import og daglig statistikk

- Retter en feil der serverimport brukte `ON CONFLICT DO NOTHING`. Eksisterende rapportdatoer kunne derfor bli markert som importert uten at de nye varelinjene erstattet en tom eller eldre rapport.
- Rapportdatoen i Neon er nå fasit når rapportene leses. Dette hindrer at en feil eller manglende dato inne i JSON-data gjør at statistikken ikke vises på riktig dag.
- Hver rapportdag aggregeres, lagres med upsert og kontrolleres for faktisk antall varelinjer før den markeres som importert.
- Importen stopper med konkret dato og feilmelding dersom en dag lagres uten varelinjer.
- Fullførte importjobber viser både antall importerte og antall kontrollerte dager.
- Ny knapp `Reparer rapportdager` skriver alle staged rapportdager på nytt og erstatter tomme/ufullstendige datoer. Den kan brukes på importjobben som allerede er fullført.

## Produktmaster Audit

- Inkluderer batchbasert audit fra V11.0.2.
- Audit beregner status på nytt for alle produkter.
- Gamle kontrollårsaker fjernes når produktet nå er OK.
- Produkter får status `OK`, `Kan ryddes automatisk` eller `Må kontrolleres`.
- Kontrollårsaker lagres eksplisitt, eksempelvis manglende nettsidenavn, tag, vareområde eller produktnavn.
- Fremdrift, gjennomførtmelding og faktisk serverfeil beholdes.

## Historikkanalyse

- Inkluderer gjenopptakbar lokal analyse og serverlagret fremdrift fra V11.0.1.
