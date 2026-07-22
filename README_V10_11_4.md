# Malingstatistikk V10.11.4

## Rettelser

- Store Excel-filer lastes nå direkte fra nettleseren til Vercel Blob med klientopplasting og multipart.
- Filen går ikke lenger gjennom en Vercel Function, og rammes derfor ikke av `FUNCTION_PAYLOAD_TOO_LARGE` ved filer over 4,5 MB.
- Maksimal historikkfil er satt til 100 MB.
- Etter Blob-opplastingen opprettes serverjobben med en liten JSON-forespørsel.
- Produktmasteren fyller automatisk inn produkter som finnes i tidligere rapporter, men som mangler i `paint_products`.
- Søk inkluderer nå produktnøkkel, EAN/PLU, Excel-navn, nettsidenavn, produktnavn, leverandør, område, tag og aliaser.
- Søk normaliserer tegnsetting, mellomrom og diakritiske tegn og støtter flere søkeord uavhengig av rekkefølge.
- Eksempel: `terr beis` finner `Butinox Terr Beis` når produktet finnes i en rapport eller i produktmasteren.
