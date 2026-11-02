# Grafisk gjennomgang – 28. oktober 2026

## Endringen

Eget salgsdashboard med isolerte komponentstiler, tydelig hovedtall, stolpediagram med bytte mellom omsetning og fortjeneste, omsetningsfordeling, rangering og topprodukter. Produktkortene har nye semantiske rader som holder antall og enhet samlet. Menyer og filtre er komprimert, og nasjonal oversikt er flyttet til en fast knapp i navigasjonen. Fokusdashboardets innhold er bevart, med felles typografi og hovedfarge. Sammenligningsvelgeren er komprimert, og topprodukter er aggregert med synlig størrelse.

## Verifisering

- Fem ordinære vareområder × Dashboard/Produktsalg × 320/390/768/1440 px (40 tilstander). Kontrollert faktisk DOM og skjermbilder. Rettet innvendig klipping av store KPI-beløp og År-knappen, og kontrollert alle fem områder igjen ved 320 px.
- Alle fem perioder ved 390 px: ingen sideoverflyt, alle periodeknapper synlige.
- Alle seks kontrollpanelfaner ved 390 og 1440 px. Ingen sideoverflyt.
- Fokusdashboard og sammenligning kontrollert visuelt ved 390 px; ingen avkuttede beløp i kontrollgrunnlaget.
- Bytte av diagrammåltall, rangering og nasjonal oversikt kontrollert i UI. Nasjonalt fokus beholdes i rangeringen.
- A4-rapport: fem sider for ordinære områder; fokusrapport: én side med alle 20 varer. Førstesiden og fokusrapporten rendret til PNG og inspisert.
- Ni automatiske tester for marginskala, ISO-uker, fokusutvalg, summer/returer, gruppering, vektet margin og kategoriledere. Nye moduler lintet uten feil. Produksjonsbygg og TypeScript bestått.

## Datagrunnlag og begrensninger

Kontrollappen bruker den lagrede Alnabru-importen for september 2026. Haugenstua og Hønefoss i kontrollappen er uttrykkelig simulerte sammenligningsvarehus. Kun denne lokale kontrollappen har mock-API og kontrollmerke; de publiseres ikke. Ingen produksjonsimporter, passord eller brukerrettigheter er endret i denne oppgaven.

Den innloggede Chrome-nettleseren var utilgjengelig fordi Mac-en var låst. Visuell kontroll er derfor utført i isolert nettleser med ekte Alnabru-data. Publisering verifiseres gjennom Vercels produksjonsstatus og publiserte ressurser.

## Skjermbilder

- `docs/screenshots/dashboard-redesign-desktop.png`
- `docs/screenshots/dashboard-redesign-mobile.png`
- `docs/screenshots/products-redesign-mobile.png`


## Oppfølging: høyest fortjenesteprosent

Gjenskapt i innlogget livevisning for Eksteriørmaling / Tønsberg / Dag 26.10.2026. Drygolin Optimal (to spann, −1,7 %) ble vist fordi en skjult minimumsgrense på to enheter utelot Infra Oljebeis (ett spann, 56,7 %) og Infra Superior Vindu / Dør (ett spann, 47,5 %). Grensen er fjernet. Returer uten positivt nettosalg og varer med null omsetning deltar ikke i rangeringen. Fire nye regresjonstester består (13 totalt). Produksjonsbygg og lint av beregningsmodulen bestod.

Publisert som `dpl_8r98iZtwzrBehTs4JWtv8M8tzAXo`. Bekreftet etter omlasting på jobbverktoy.no/malingstatistikk: feltet viser Infra Oljebeis med 56,7 %. Skjermbilde: `docs/screenshots/tonsberg-highest-margin-live.png`.
