# Fokusprodukter

Første utvalg er de 20 EAN-numrene i bildet «Topp 20 produkter malertilbehør (interiør)». Navnene er avskrift fra bildet og kan erstattes ved å fjerne og legge til EAN med nytt visningsnavn. EAN er koblingsnøkkelen, ikke produktnavnet.

Ved tillegg med bare EAN hentes visningsnavn fra produktregisteret hvis tilgjengelig.

Administrator administrerer listen øverst i Kontrollpanel. Endringer lagres felles i eksisterende `app_settings` under `focus_products`; en tom liste beholdes tom. Fokusprodukter er et separat utvalg og endrer ikke vareområde, produktmaster eller importsummer. Listen starter med standardutvalget hvis ingen liste er lagret.

Kontrollpanelet skiller mellom treff i produktregister (`paint_products`) og treff i det samlede salgsarkivet (`paint_report_rows`). Dette er ikke en kontroll av alle rader i en bestemt originalfil. Direkte databasetilkobling er ikke konfigurert lokalt. Septemberdekning er kontrollert separat i den innloggede produksjonsappen, se nedenfor. Importkontrollen kjøres bare når administrator åpner Kontrollpanel; vanlig dashboardlasting leser kun fokuslisten.

## Dashboardlayout

Implementert førsteversjon:

1. Eksisterende periode-, samvirkelag- og varehusfilter øverst.
2. Fire nøkkeltall: omsetning, fortjeneste, fortjenesteprosent og produkter med positivt nettosalg av totalt antall fokusvarer.
3. Topp fem etter fortjeneste og et oppfølgingspanel med netto antall og varer uten salgslinjer.
4. Søkbar produktoversikt rangert etter omsetning med navn, EAN, antall, omsetning, fortjeneste, margin og status for salgslinjer i valgt periode. Alle utvalgte varer vises, også uten salgslinjer.

Forslag til neste utvidelse: utviklingskurve mot forrige sammenlignbare periode. Deretter varehussammenligning på omsetning og andel fokusvarer med salg. Lagerstatus eller utsolgtvarsler krever en egen lagerkilde; manglende salgslinjer brukes ikke som lagerindikator.

Fokusfanen har et eget dashboard. De øvrige vareområdenes Produktsalg, Historikk og Sammenligning er uendret og tilbys ikke som egne visninger inne i fokusfanen.

## Verifikasjon

Produksjonsbygg, TypeScript-kontroll og ESLint for nye moduler. Dashboard og kontrollpanel er visuelt kontrollert med merkede eksempeldata. Beregninger er kontrollert for returer, varer uten salg, tom liste, eksakt EAN-match og vektet fortjenesteprosent. API-et er kontrollert med isolerte database-/innloggingsstubber for tilgang, validering, navneoppslag og lagring av tom liste. Faktisk lagring i produksjonsdatabasen er ikke kjørt fra den lokale versjonen. Syntetisk nasjonal Excel-rapport med alle 20 EAN bekrefter at parseren bevarer alle EAN, samt kontroll av unik liste, tom liste og ugyldige EAN. Dette bekrefter parserstøtte, ikke at varene finnes i produksjonsimporten.

## Kontroll mot faktisk septemberimport

Kontrollert via innlogget produksjonsapp 27. oktober 2026: månedsrapport for september 2026, avgrenset til Alnabru (varehus 3507), inneholder samtlige 20 EAN fra standardlisten. Svaret oppgir 26 rapportdager. Hvert EAN ble søkt frem i rapportens faktiske JSON-svar. Dette bekrefter at alle 20 finnes i septemberimporten; det bekrefter ikke salg ved alle varehus.

![Dashboardlayout med eksempeldata](screenshots/focus-dashboard-preview.png)

## Grafisk oppdatering 27. oktober 2026

Publisert på eksisterende Malingstatistikk-adresse. Kompakt overskrift, nøkkeltall med ikoner, rangeringsdiagram med valg mellom fortjeneste/omsetning/antall, ringdiagram for andel fokusvarer med positivt nettosalg og produktkort med faktiske produktbilder fra salgsdata/produktregister. Søk og alternativ tabellvisning er beholdt. Mobilvisningen har to kort per rad. Ringdiagrammet bruker ikke lagerstatus eller målverdier.

Bygg og TypeScript bestått. Lokal interaksjonskontroll bekrefter diagramsortering, EAN-søk og visningsbytte. Mobilbredde 390 px er kontrollert uten horisontal sideoverflyt.

## Kompakt navigasjon

Vareområdene vises uten sidescrolling på desktop, med egen menyrad ved 761–1099 px. Kontrollpanel og utskrift bruker 38 px ikonknapper med tilgjengelige navn og native hjelpetekst. Mobil beholder vareområdevelgeren og viser begge ikonknappene. Den tomme sekundærraden er skjult i fokusvisningen på desktop. Kontrollert ved 320, 390, 760, 768, 800, 1024, 1100, 1280 og 1440 px, samt kontrollpanel-, utskrifts- og mobilvalg.
