# V12.0.1 – Product Audit pagination fix

Rettet en feil der audit kunne avslutte et steg etter første batch dersom ingen produkter i akkurat den batchen ble endret. Cursor og `done` beregnes nå fra antall undersøkte produkter, ikke antall oppdaterte produkter. Hele produktmasteren blir dermed kontrollert i alle fire steg.
