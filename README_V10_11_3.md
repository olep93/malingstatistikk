# Malingstatistikk V10.11.3

## Serverlagret historikkimport

Historikkimporten er nå én tydelig firetrinnsflyt:

1. Last opp Excel-filen til Vercel Blob.
2. Analyser den lagrede serverfilen.
3. Synkroniser produkter.
4. Importer rapportdager.

Den gamle parallelle historikkimporten i Kontrollpanel er fjernet for å unngå to konkurrerende arbeidsflyter.

### Viktige egenskaper

- Selve opplastingen gjør ingen lokal Excel-analyse.
- Importjobben vises på alle enheter etter opplasting.
- Analyse lagrer alle rapportdager og unike produkter i Neon med noen få serveroperasjoner i stedet for ett kall per rapportdag.
- Knapper aktiveres bare når forrige trinn er ferdig.
- Fremdrift for produkter og rapportdager lagres fortløpende.
- Jobben kan fortsettes fra mobil eller en annen PC.
- Sletting av en importjobb rydder også den lagrede Blob-filen.
