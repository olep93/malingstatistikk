# V10.12.1 – Mobil og stabil historikkanalyse

- Historikkfilen analyseres lokalt i nettleseren, ikke i én lang Vercel Function.
- Rapportdager og produkter lagres trinnvis i Neon med automatisk retry.
- Wake Lock forsøkes aktivert under analysen slik at PC-en ikke går i dvale.
- Etter at analyse/lagring er ferdig kan produktsynk og rapportimport fortsettes fra mobil.
- Mobilvisningen er bygget om med kortbasert produktmaster, vertikale importsteg og fullbreddeknapper.
