# Malingstatistikk V9 – kanonisk produktregister

V9 bygger produktgrupperingen på et fast referanseregister med varenummer fra det komplette produktuttrekket.

## Hovedendringer
- 303 unike varenumre er lagt inn som fasit.
- A-, B-, C-, hvit-, klar/hvit-, oker-, gul- og rød-base samles under samme produkt.
- 3 L og 2,7 L behandles som samme spannstørrelse: 2,7 L.
- Produkter med ulik reell variant eller spannstørrelse holdes adskilt.
- Vindu/dør-varianter gjenkjennes deterministisk fra varenummer.
- Kategorien blir korrekt for Maling/Dekkbeis/Beis, Vindu/Dør og Murmaling.
- Rangeringen beregnes etter sammenslåing og filtrering, slik at nummereringen alltid er 1, 2, 3 ...
- Fortjenesteprosent beregnes fra samlet fortjeneste / samlet omsetning.
- Også gamle rapporter i Neon blir kanonisert og gruppert på nytt når de hentes.

## Eksempel
- Butinox Futura 16 2,7 L A-base: 2 salg
- Butinox Futura 16 2,7 L B-base: 3 salg

Vises som én post:
- Butinox Futura 16 – 2,7 L
- 5 spann
- samlet omsetning og fortjeneste

## Deploy
Last opp innholdet i mappen `Malingstatistikk` til roten av GitHub-repositoryet. Vercel bygger prosjektet automatisk.
