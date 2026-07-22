# Malingstatistikk V10.10

Vanlig dagsopplasting bruker samme robuste og gjenopptakbare motor som historikkimport:

1. Excel-filen leses lokalt i nettleseren.
2. Unike produkter synkroniseres ett om gangen med automatisk retry.
3. Rapportdagen publiseres i et separat, kort API-kall via `/api/reports/bulk` i `replace`-modus.
4. Ved feil kan produktsynkronisering eller publisering startes på nytt uten at hele prosessen må gjentas.
