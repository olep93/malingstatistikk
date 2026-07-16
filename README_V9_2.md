# Malingstatistikk V9.2 – korrigert historikkimport

- Historikk lagres i små grupper for å unngå Vercel/Neon-grenser.
- Importen verifiserer antall datoer som faktisk finnes i Neon.
- Dashboardet henter rapportlisten på nytt etter import uten å stole på nettlesercache.
- Dager som allerede finnes beholdes når importmodus er «skip».
