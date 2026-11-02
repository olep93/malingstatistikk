# Design- og funksjonskontroll av Malingstatistikk

## Omfang

Gjennomgangen gjelder alle synlige sider i Malingstatistikk. Fokusdashboardets rene uttrykk er videreført til de øvrige sidene. De andre prosjektenes delte navigasjon, logoer og farger er brukt som referanse; koden i de andre prosjektene er ikke endret.

## Rettet

- Felles skjermpresentasjon i `src/app/design-system.css`: overskrifter, overflater, kort, nøkkeltall, filtre, typografi, avstander og tilgjengelig fokusmarkering. A4-reglene er adskilt fra skjermreglene.
- Samme marginskala i fokusvarer, øvrige produkter og utskrift. Negative nøkkeltall skilles tydelig ut. Øvrige leverandører fremgår ved siden av kjernemerkene og i A4-rapporten.
- Produktsalg får søk på navn/EAN/varenummer, 24 kort om gangen og «Vis flere». Nasjonalt produktsalg grupperes over alle varehus i stedet for å slå opp et ikke-eksisterende varehus med id `__all__`.
- Sammenligningen viser alle valgte varehus. Det skjulte andre utvalget som reduserte visningen til ett varehus er fjernet. Fokusvarehus uten salg beholdes med nullverdier. Margin sammenlignes i prosentpoeng mot vektet margin.
- Historikk åpner valgt dato som dag, og viser korrekt antall importerte linjer fra rapportmetadata. ISO-uker bruker riktig ukeår ved årsskiftet.
- Forsinkede svar fra tidligere periodevalg kan ikke overskrive siste valg. Laste- og valgtilstander er tydelige. Samvirkelag kan endres også fra nasjonalvisningen.
- Kontrollpanel har seks administrasjonsvalg: rapportimport, fokusprodukter, produktmaster, lagring, brukere og rapportarkiv. Fokusredigering åpner riktig del direkte. Power BI-periodeimport står før det eldre dagsrapportløpet; eksportveiledningen har samsvarende bilde og tekst.
- Historikk er tilgjengelig i mobilmenyen. Lange nøkkeltall avkortes ikke. Kontrollpanel viser ingen irrelevant analysemeny nederst. Leverandørfelter klippes ikke på smalt nettbrett.
- Utskrift skjuler sammenligningsknappen som tidligere skapte en ekstra side. Sidetall følger områdene med data. Nasjonalvisningen har utskriftsinnhold, og fokusutskrift bruker samme forberedelse av bilder og skrifter som øvrig utskrift.

## Kontroller

- Faktisk septemberutvalg fra den innloggede produksjonsappen: Alnabru, 1 303 produktlinjer. Omsetning og fortjeneste på alle fem hovedområder er avstemt mot dette grunnlaget i lokal kontrollapp.
- 20 kombinasjoner av hovedområde og side på desktop: dashboard, produktsalg, historikk og sammenligning for eksteriør, interiør, terrasse, malerverktøy og total.
- Samme 20 kombinasjoner på 390 px mobilbredde; alle fire navigasjonsvalg er tilgjengelige, uten horisontal sideoverflyt.
- Alle seks administrasjonsdeler på desktop og mobil. Fokusredigering, produktsøk og utvidelse fra 24 til 48 produktkort er prøvd.
- Tilleggskontroll ved 320, 768, 1024 og 1440 px. Også innholdet inni leverandørkortene er kontrollert, ikke bare dokumentbredden.
- To og tre valgte varehus vises samtidig. Kontrollappen bruker faktiske Alnabru-rader og eksplisitt simulerte sammenligningsvarehus; de simulerte tallene er aldri skrevet til produksjon.
- Nasjonalt produktsalg og utskrift kontrollert med samme isolerte sammenligningsgrunnlag.
- Raske dagbytter kontrollert med kunstig forsinket eldre svar: siste dato og tilhørende summer beholdes.
- Lederrolle kontrollert i isolert app: kun rapportimport i kontrollpanelet og ingen hurtigredigering av produkter. Produksjonsinnlogging og roller er ikke endret.
- A4-pakker rendret til PDF/PNG og kontrollert visuelt. Ett varehus og landssummen gir fem sider med grunnlaget som inneholder alle områder. Fokusutskriften er komprimert til én A4-side med diagrammer og alle 20 EAN i kontrollgrunnlaget, uten tom ekstraside.
- `node --test tests/presentation.test.cjs`: seks regresjonstester for marginskala, ISO-ukeår, EAN-utvalg, returer, nullsalg og vektet margin.
- TypeScript, produksjonsbygg og diffkontroll.

Kontrollappen er lokal og bruker stubber for API/innlogging. Ingen import, sletting, produktreparasjon eller brukerendring er utført i produksjon som del av gjennomgangen. De faktiske test-PDF-ene og datasettet er midlertidige kontrollfiler, ikke leveranser eller produksjonsrapporter.


## Oppfølging: salgstall og enheter på mobil

- Rettet en kaskadefeil der gamle flex-stiler skilte enheten spann fra antall solgt. Antall og enhet er nå ett samlet felt.
- Låst mobilens nøkkeltall til vertikal oppstilling, med tydelig rekkefølge og uten ellipser for beløp.
- Kontrollert produktfanene eksteriør, interiør, terrasse, malerverktøy og totalt ved 320, 390, 430, 768 og 1280 px med lokale septemberdata. Ingen avkuttede metrikker eller horisontal sideoverflyt.
- Skjermbilde: docs/screenshots/product-mobile-alignment.png (lokal kontroll).
