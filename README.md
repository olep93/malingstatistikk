# Malingstatistikk V3

Next.js-app for daglig malingrapport basert på Excel-uttrekket «Salg og svinn i butikk».

## Funksjoner
- Leser `.xlsx` direkte i nettleseren.
- Summerer omsetning, fortjeneste og fortjenesteprosent per varehus og leverandør.
- Samler ulike baser under samme produkt og spannstørrelse.
- Valgbart fokusvarehus.
- Rangering etter fortjenesteprosent, fortjeneste eller omsetning.
- Produktkort med opplastede produktbilder.
- Dag, uke og måned basert på rapporter lagret lokalt i nettleseren.
- Separat utskriftsrapport på to A3-sider i liggende format.
- Midlertidig admininnlogging: `Admin` / `92205203`.

## Vercel
1. Legg innholdet i denne mappen direkte i GitHub-repositoryet.
2. Importer repositoryet i Vercel.
3. Framework: Next.js. Root directory: `./`.
4. Ingen miljøvariabler kreves i V3.

## Viktig
Denne versjonen bruker `localStorage`. Rapporter følger derfor nettleseren og enheten. Neste produksjonstrinn er Firebase Authentication og Firestore.
