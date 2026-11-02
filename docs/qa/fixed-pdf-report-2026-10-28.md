# Faste A4-sider fra rapportknappen

## Bakgrunn og løsning

Brukeren meldte fortsatt oppdeling av blant annet interiørmaling i Safari og Chrome. På iPhone passet rapporten først ved 85 % skalering. De tidligere Chromium-kontrollene av HTML-utskriften fanget ikke denne oppførselen.

Rapportknappen genererer nå en faktisk PDF i nettleseren, med nøyaktig seks sider på 210 × 297 mm. PDF-en har faste posisjoner, innebygde Noto Sans-skrifter og skarp tekst/grafikk. Dermed deler ikke nettleserens HTML-utskrift rapportinnholdet på nytt. Knappen åpner PDF-en i et nytt rapportvindu; selve utskriften skjer fra PDF-viseren. Hvis et rapportvindu ikke kan åpnes, lastes PDF-en ned.

Den eksisterende rapportmodellen brukes fortsatt, med samme periode, varehus, returer, summering, produktgruppering og vektede margin. Alle tidligere rapportfelt utenom den uttrykkelig fjernede innsiktsboksen er beholdt. Fokusrapporten har topp fem, dekning og alle 20 valgte EAN. For fremtidige utvalg over 24 varer beholdes den tidligere tydelig merkede begrensningen til topp 24 på papirsiden; alle varer inngår i nøkkeltallene.

Produktbilder bygges inn i PDF-en. Bilder uten CORS-støtte kan hentes som bildedata gjennom eksisterende autentiserte produktbilde-endepunkt; serveren bruker bare adressen produktregisteret allerede har funnet. Bilde- eller nettverksfeil fjerner ikke varelinjer eller rapportsider.

## Verifisering

- 21 automatiske tester. Tre nye tester åpner de faktiske PDF-bytene og bekrefter seks fysiske A4-sider, også med tomme vareområder, 1 200 varelinjer, lange navn, store årsbeløp, returer og mislykkede bildeoppslag. Testene bruker de samme innebygde skriftene som produksjon.
- TypeScript og produksjonsbygg består. Lint av de nye modulene og bilde-endepunktet gir ingen feil. `git diff --check` består.
- Tønsberg 26.10.2026: faktisk API-uttrekk med 858 varelinjer og alle fem varehus i Coop Sørøst. Eksempelrapporten inkluderer 19 unike produktbilder, samt logo.
- Alnabru september 2026: faktisk lagret månedsgrunnlag med 1 303 varelinjer. Valgt varehus er `3507`, og rapporten bruker det ene faktiske varehuset i dette grunnlaget. Ingen simulerte regionvarehus. 25 unike produktbilder, samt logo.
- Begge PDF-er er åpnet med pypdf. Alle seks områdenavn, sidemål, omsetnings- og fortjenestesummer og ordinære topproduktnavn er sammenlignet med rapportmodellens forventede verdier. Alle 20 EAN finnes på hver fokusrapport.
- Alle tolv sider er rendret til PNG og visuelt gjennomgått, med ekstra kontroll av interiørmaling, verktøy og fokus. Rettet tett avstand mellom kategorirader og mellom tabellkolonner. Ingen innhold går over sidekanten.
- Den faktiske knappen er kjørt i kontrollappen fra Interiørmaling / Alnabru / Måned september og ved 390 px bredde fra Interiørmaling / Tønsberg / Dag 26. oktober. I begge tilfeller åpnet en gyldig PDF med korrekt dokumenttittel. Mobiltilfellet beholdt interiørfanen og valgt rapportperiode og viste ingen feil.

## Avgrensning

Direkte kontroll i en fysisk iPhone/AirPrint-dialog er ikke utført. Den lokale Mac-en var låst. Kontrollappen bruker faktiske data, men egne lokale API-er og ingen produksjonsinnlogging. PDF-viserens blob-adresse kan ikke styres gjennom nettleserverktøyet; sidekontrollen gjelder de faktiske PDF-filene generert av samme kode, med riktige A4-mål og seks sider.

Den eksisterende HTML-rapporten er beholdt for nettleserens egen sideutskrift, med eksplisitt normal tekstskalering. Den testede og anbefalte utskriftsveien er knappen «Skriv ut rapport», som åpner den faste PDF-en.

## Artefakter

- `output/pdf/rapport-tonsberg-2026-10-26.pdf`
- `docs/screenshots/a4-report-interior-verified.png`
- `docs/screenshots/a4-report-exterior-preview.png`

Ingen rapportimporter, salgstall eller brukertilganger er endret.

## Publisering

Publisert som `dpl_EMXfv1ei74XdrRqnKgEhd17L9ops`, produksjonsstatus `READY`. Koden for den nye rapportknappen og den faste PDF-generatoren er hentet gjennom portalens statiske ressurser med HTTP 200 og sammenlignet med det kontrollerte produksjonsbygget. Fontfilene følger publiseringen og lastes med brukerens vanlige innlogging; en anonym forespørsel til disse fontadressene videresendes til innlogging.
