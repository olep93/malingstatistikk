# A4-rapport – gjennomgang 28. oktober 2026

## Omfang og bevaring av innhold

Ny utskriftskomponent og isolert utskriftsstil. Rapportpakken henter det lastede periodeutvalget uavhengig av aktiv skjermfane. Den gir seks sider i samme rekkefølge som navigasjonen: Eksteriørmaling, Interiørmaling, Terrasse, Malerverktøy, Fokusprodukter og Vareområde Maling. Hver side er satt opp for A4 stående med 10 mm marger.

Kontrollert mot den tidligere `PrintReportPack`:

- Logo, område, varehus, full periode og sidetall.
- Fire nøkkeltall, inkludert vektet fortjenesteprosent og regionplassering eller solgte enheter.
- «Dette bør du vite», leverandørmiks og underkategorier med andel, omsetning, fortjeneste og fortjenesteprosent.
- De opprinnelige tre malingsleverandørene vises også ved null salg. Andre leverandører inngår og vises med egne summer.
- De seks største underkategoriene, syv for verktøy. Resterende kategorier oppsummeres som «Andre underkategorier».
- Topp fem produkter med bilde, navn, størrelse, antall, omsetning, fortjeneste og prosent. Produktgrupperingen deles med skjermvisningen.
- Regionsrangering med topp fem og valgt varehus på faktisk plass. Er varehuset utenfor topp fem, beholdes topp fire pluss fokusvarehuset.
- Verktøysidens snittomsetning og snittfortjeneste per enhet, største kategori og kategori med lavest margin.
- Fokusrapportens topp fem etter fortjeneste, dekningsdiagram og alle 20 varene med EAN og salgstall. Ved en fremtidig liste over 24 varer viser én A4 de 24 største med tydelig merking; alle inngår fortsatt i nøkkeltallene.
- Tydelig nullstatus på områder uten salg, slik at en side ikke forsvinner.

## Data og visuell kontroll

En isolert lokal kontrollapp brukte to datasett:

1. Lagret Alnabru-grunnlag for september 2026, med uttrykkelig simulerte sammenligningsvarehus for å teste tettfylte sider.
2. Faktisk API-uttrekk for Coop Sørøst og 26.10.2026, med alle fem varehus. Tønsberg ble valgt for den endelige eksempelrapporten.

Alle seks sider fra begge kontrollutskriftene ble rendret til PNG og gjennomgått visuelt. Første prøve avdekket for liten avstand nederst i verktøykategoriene og fokuslisten. Radavstand og panelhøyder er justert, deretter kontrollert på nytt. Endelig kontroll viste ingen overlapp eller innvendig overflyt i paneler, nøkkeltall og innsiktsfelt.

Den endelige eksempelrapporten har seks sider i A4-format. Dato, varehus og riktig sidetall finnes på hver side. Fokusrapporten har alle 20 EAN. Eksteriørsiden viser Tønsbergs faktiske omsetning 2 891 kr, fortjeneste 268 kr og vektet margin 9,3 %. Terrassesiden viser null salg. Fokusutvalget har 6 av 20 varer med positivt nettosalg.

Rapportpakken ble også kontrollert fra alle seks vareområder, Produktsalg, Historikk, Sammenligning, Kontrollpanel og nasjonalt utvalg. Skjermvisningen skjuler utskriftspakken; utskriftsvisningen skjuler skjerminnholdet.

Lokale mock-API-er, datauttrekk og kontrollmerking publiseres ikke. Ingen importdata eller brukertilganger er endret.

## Tekniske kontroller

- `node --test tests/presentation.test.cjs`: 18 bestått. Fem nye tester dekker felles produktgruppering, returer, seks sider inkludert nullområder, korrekte summer og faktisk regionplassering, fokusvarer og gamle kategorifelt.
- `npx tsc --noEmit --incremental false`: bestått.
- `npm run build`: bestått.
- Lint av nye moduler: ingen feil; kun forventede Next.js-advarsler for vanlige produktbilder.
- `git diff --check`: bestått.

## Eksempel

- `output/pdf/rapport-tonsberg-2026-10-26.pdf`
- `docs/screenshots/a4-report-exterior-preview.png`

## Publisering og siste kontroll

Publisert som `dpl_2zUm8FUMd5UGo6ZujhFusmNYgoYE`, produksjonsstatus `READY`. Både ny rapportkomponent og ny A4-stil ble hentet og innholdskontrollert gjennom `jobbverktoy.no/malingstatistikk/_next/static/` med HTTP 200.

Utskriftsknappens komplette bildeforberedelse og kall til `window.print()` ble kontrollert i den isolerte appen fra Produktsalg. Kontrollappen observerte dialogkallet, og valgt skjermfane og rapportutvalg ble beholdt. Denne observasjonen er kun lokal testinstrumentering og inngår ikke i publisert kildekode.

Direkte kontroll av den innloggede produksjonsdialogen etter publisering var ikke mulig fordi Mac-en var låst. Påstanden om seks A4-sider bygger på de faktisk genererte og visuelt gjennomgåtte PDF-ene, ikke på en bekreftet ny produksjonsdialog.

## Oppfølging: marger og tomme mellomsider

Brukeren meldte om ekstra sider i både Safari og Chrome og ønsket å fjerne «Dette bør du vite». Boksen og tilhørende beregning/stiler er fjernet fra alle seks sider. De øvrige feltene beholder de samme høydene og skriftstørrelsene.

Den gamle ytterrammen var en grid med fast høyde 276 mm. Ny ytterramme bruker vanlig blokkflyt, med 255 mm samlet innholdshøyde. Den begrenser bredden til utskriftsområdet og setter sideskift bare før en ny rapportside. Dermed er det 21 mm større høydereserve.

Feilen er gjenskapt i Chromium-PDF med 20 mm topp-/bunnmarg og 10 mm sidemarger: gammel rapport gir 12 sider, med bunntekst og enkelte siste prosentverdier på nesten tomme mellomsider. Ny rapport gir seks sider med samme margoppsett. Margene ble endret direkte i den lokale kontrollappens stilark; bare ekstra `@page`-regler i sideinnholdet viste seg utilstrekkelig for å endre de faktiske PDF-margene.

Ny rapport er også kontrollert med reelle 12,7 mm og 20 mm marger på alle kanter. Alle prøvene har seks sider, inkludert alle 20 EAN i fokusrapporten. Den faktiske PDF-en med 20 mm marger ble rendret og de tetteste sidene (verktøy og fokus) inspisert visuelt. Hele den nye Tønsberg-rapporten med vanlige marger er rendret og alle seks sider inspisert. Tett Alnabru-grunnlag for september er også kontrollert; ingen paneler eller nøkkeltall viste innvendig overflyt.

De 18 beregningstestene, TypeScript-kontroll, produksjonsbygg og `git diff --check` består. Lint gir ingen feil, kun de to forventede bilde-advarslene. Safari er ikke kontrollert direkte i denne gjennomgangen fordi den lokale Mac-en er låst. Eksempel-PDF og forhåndsvisning er erstattet med den nye varianten uten innsiktsboks.

Rettingen er publisert som `dpl_C6CUL2iuJpxovqC9DVN4irhgWqwJ`, produksjonsstatus `READY`. Ny komponent uten innsiktsboks og ny utskriftsstil er hentet med HTTP 200 gjennom portalens offentlige statiske ressurser og sammenlignet med de kontrollerte byggefilene.
