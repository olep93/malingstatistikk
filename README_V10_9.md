# Malingstatistikk V10.9

Denne versjonen løser Vercel-feilen `FUNCTION_INVOCATION_TIMEOUT` ved å gjøre årsimporten gjenopptakbar og dele arbeidet i svært små serverkall.

## Endringer

- Produktsynkronisering kjøres ett produkt per API-kall.
- Hvert produktkall prøves automatisk opptil tre ganger ved 502/503/504 eller nettverksfeil.
- Historikk lagres én rapportdag per API-kall.
- Rapportkall prøves automatisk opptil tre ganger.
- Produktsynkronisering og rapportimport er to separate knapper.
- Eksisterende produktdata hentes fra Neon, slik at en ny kjøring fortsetter raskt.
- Eksisterende rapportdager hoppes over, slik at en avbrutt årsimport kan startes på nytt uten duplikater.
- Fremdrift vises kontinuerlig med produkt/dag, antall funnet, cache og manglende produkter.
- Siste fremdrift lagres lokalt i nettleseren under kjøringen.
- Nettoppslag mot Obsbygg.no er tidsbegrenset og søker færre kandidater parallelt for å unngå lange Vercel-kall.

## Anbefalt årsimport

1. Velg Excel-filen.
2. Trykk **Analyser historikk**.
3. Trykk **1. Synkroniser produkter**.
4. Når denne er ferdig, trykk **2. Importer rapportdager**.
5. Ved feil: trykk samme knapp på nytt. Lagrede produkter og rapportdager blir gjenbrukt/hoppet over.
