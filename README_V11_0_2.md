# Malingstatistikk V11.0.2

Inkluderer alle rettelser fra V11.0.1 og bygger om Produktmaster Audit til en separat batchprosess.

## Produktmaster Audit
- Fire separate steg: produktnavn, søkealiaser, kontrollmerking og fjerning av ferdige kontrollmarkeringer.
- Små batcher for å redusere risikoen for Vercel-timeout.
- Produktlisten fullrefreshes ikke mens audit kjører.
- Aktivt steg og batch vises fortløpende.
- Konkrete serverfeil vises i grensesnittet.
- Etter fullføring hentes bare nye kontrolltall.
- Resultatet viser antall utførte endringer og automatisk opprydding som gjenstår.

## Historikkimport
Alle rettelser fra V11.0.1 er beholdt, inkludert gjenopptakbar analyse og hopping over rapportdager som allerede er lagret server-side.
