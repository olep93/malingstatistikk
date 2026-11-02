# Feil antall på Ultimate-rull – EAN-gruppering

## Gjenskapt avvik

Brukerens bilder viser Sandefjord 26.10.2026. Power BI viser 5 solgte av Ultimate 18 cm, mens produktkortet viser 10 stk., 992 kr i omsetning og omtrent 476 kr i fortjeneste.

Det tidligere lagrede API-uttrekket fra samme dato inneholder allerede korrekte, separate varelinjer:

| EAN | Antall | Omsetning | Fortjeneste |
| --- | ---: | ---: | ---: |
| 7311490032147 | 5 | 460,00 | 223,90 |
| 7311490032260 | 2 | 184,00 | 100,54 |
| 7311490032154 | 3 | 348,00 | 151,77 |

Alle tre hadde produktnavnet «Jordan Ultimate jevne underlag malerull» og tomt størrelsesfelt. Den gamle funksjonen `aggregateDisplayProducts` slo dem sammen på produktfamilie og størrelse. Dermed ble kortets antall 10, omsetning 992 og fortjeneste 476,21. Dette stemmer nøyaktig med bildet. Samme feil ga 2 i stedet for 1 i Tønsberg og 11 i stedet for 7 i Skien for kortet som representerte denne EAN-en.

## Retting

Verktøyvarer bruker nå EAN som visningsidentitet, med varenummer eller produktnøkkel som reserve. De går ikke gjennom heuristikken som prøver å plassere malingsvarianter uten størrelse ut fra produktnavn og stykkpris. Ulike EAN-er holdes adskilt også når navn, størrelse og priser er like. Samme EAN med salg og returer summeres fortsatt, også ved endret navn eller kategori. Nasjonal visning summerer samme EAN fra flere varehus.

Når størrelsen mangler, viser kortets undertittel EAN eller varenummer, slik at ellers identiske navn kan skilles. Dashboardets toppliste og sammenligning bruker samme undertittel. Den felles rapportmodellen og PDF-en bruker allerede denne grupperingen, og viser dermed også korrekt antall per varevariant. Fokuslisten har hele tiden summert på eksakt EAN og er kontrollert mot den rettede visningen.

Ingen importlinjer eller produktmasterdata er endret.

## Kontroller

- 27 automatiske tester består. Seks nye regresjonstester dekker det nøyaktige 5 + 2 + 3-tilfellet, like navn/størrelser/priser, samme EAN med retur og nytt navn, eldre varenummer, nasjonal aggregering, undertittel og samsvar med fokus/utskrift.
- TypeScript, lint av grupperingsmodulen, produksjonsbygg og `git diff --check` består.
- Sammenlignet alle 520 verktøylinjer med EAN i det faktiske uttrekket for fem varehus. Hver EAN har samme antall, omsetning og fortjeneste som sine kildeposter.
- Sammenlignet antall, omsetning og fortjeneste før/etter for hvert varehus: uendret.
- Sammenlignet alle ordinære malingsprodukter mot forrige publiserte grupperingsfunksjon: identiske resultater.
- Kjørt selve produktvisningen i isolert lokal kontrollapp med faktiske data. Søkt opp hver EAN: henholdsvis 5 stk. / 460 kr, 2 stk. / 184 kr og 3 stk. / 348 kr. EAN `7311490032147` viser 224 kr i avrundet fortjeneste og 48,7 %.

Skjermbilde: `docs/screenshots/sandefjord-ean-quantity-fix.png`. Kontrollappen bruker lokale API-er og endrer ikke produksjonsdata.

## Publisering

Publisert som `dpl_S8828FLtCpas8CDqaBGoB7fbuFjn`, produksjonsstatus `READY`.
