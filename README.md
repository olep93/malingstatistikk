# Malingstatistikk V2

Next.js-app for dagsrapporter for eksteriørmaling.

## V2 inneholder
- Offentlig, mobiltilpasset dashboard
- Faktiske regions-/leverandørtall fra første opplastede rapport
- Verdier og BTO-prosent direkte i grafene (ingen hover nødvendig)
- A3 liggende utskrift som standard
- Dag/uke/måned-kontroller og kalender
- Produktside med eksempeldata
- Lokal demo-innlogging: Admin / 92205203
- Opplastingsvisning og redigerbar kontrolltabell

## Viktig
Demo-innloggingen ligger i klientkoden og er ikke sikker. Før produksjonsbruk må den erstattes med Firebase Authentication eller en tilsvarende serverbasert løsning. Opplasting og publisering er foreløpig lokal UI; varig lagring krever Firestore og fil-lagring.

## Kjør lokalt
```bash
npm install
npm run dev
```

## Vercel
Importer GitHub-repoet. Framework: Next.js. Ingen miljøvariabler kreves for demoen.
