# Malingstatistikk V11.0.5 – ytelse, produktmaster, tags og utskrift

- Normalisert rapporthurtigbuffer i Neon. Dag/uke/måned/YTD/år aggregeres i databasen og returnerer kun ferdige tall.
- Eksisterende rapporter bygges automatisk inn i hurtigbufferen første gang perioden åpnes. Senere åpninger er vesentlig raskere.
- Produktmaster-audit markerer ikke lenger produkter bare fordi nettsidenavn mangler.
- Aliasregisteret flettes og oppdateres i stedet for bare å fylle tomme aliaser.
- Taglagring normaliserer vareområde og finner taggen case-insensitivt.
- Standardtags gjenopprettes hver gang tag-API-et åpnes, inkludert alle tre eksteriørtags.
- Eksteriørutskrift viser alltid de tre faste kategoriene.
- Leverandørmiks er forenklet til lesbare søyler med andel, omsetning, fortjeneste og margin.
- Navigasjon og menyer skjules konsekvent ved utskrift.
