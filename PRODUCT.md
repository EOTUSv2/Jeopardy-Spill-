# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Verten:** personen som kjører serveren på sin egen PC og viser brettet på en TV eller stor
  skjerm. Verten styrer spillet med mus/tastatur, leser spørsmålene høyt og dømmer svarene.
- **Spillerne:** opptil 10 venner på fest, sosiale og gjerne med litt drikke. De sitter i stua,
  ser på TV-en og bruker sin egen mobil bare til å bli med og buzze. Oppmerksomheten deres er på
  TV-en og på hverandre, ikke på mobilen.

## Product Purpose
Et Jeopardy-inspirert selskapsspill på lokalt nettverk, som Kahoot uten konto eller sky.
Det er vellykket når en gjeng kommer i gang på under ett minutt, og når kvelden handler om stemningen
i rommet og ikke om å forstå verktøyet.

## Positioning
Kjører helt lokalt fra én maskin: ingen innlogging, ingen sky og ingen app-installasjon for
spillerne. Verten dømmer svarene muntlig, slik som i ekte Jeopardy, i stedet for at spillerne
velger mellom svaralternativer. Alt innhold og all tekst er på norsk.

## Operating Context
- Verten åpner `/host` på maskinen som kjører serveren. Spillerne åpner `/play` på samme Wi-Fi og
  skriver inn en 4-tegns kode og navnet sitt.
- Gangen i spillet: verten velger et felt, og en 20 sekunders nedtelling starter. Den første som
  buzzer låser feltet og sier svaret høyt. Verten trykker Vis svar og deretter Riktig eller Feil.
  Ved feil trekkes poeng, og de andre kan buzze. Det er to brett, og brett 2 gir doble poeng.
  Til slutt vises sluttresultatet.
- Svaret vises aldri automatisk mens noen buzzer, så vertsskjermen kan streames.
- Ingen spiller «har kontroll» over brettet: verten velger alle feltene.

## Capabilities and Constraints
- Next.js 14 (pages router) og Socket.IO i `server.js`. Spilltilstanden ligger i minnet, så en
  restart nullstiller spillet.
- Spørsmålsbanken er `questions.json` med 37 kategorier, 5 vanskelighetsgrader og flere
  alternativer per grad. Det kreves minst 12 gyldige kategorier.
- All tekst i UI-et ligger i `lib/strings.js`.
- Bare maskinen som kjører serveren kan være vert (`ALLOW_REMOTE_HOST=1` overstyrer).
- Skal kunne deles med andre. Oppsett og første gangs bruk må derfor kunne forstås uten forfatteren
  i rommet.

## Brand Commitments
- Navnet er «Jeopardy». Spillet er inspirert av TV-formatet, men skal ikke etterligne
  varemerkets visuelle identitet.
- Alt er på norsk, med poeng.

## Evidence on Hand
- `questions.json`: ekte spørsmålsbank med 37 kategorier og hint.
- Det finnes ingen brukerhistorier, ingen målinger og ingen sitater. Slikt skal ikke diktes opp.

## Product Principles
1. Rommet er scenen: TV-en og menneskene er i fokus, mens mobilen er en buzzer.
2. Verten er programleder: kontrollene skal være raske og vanskelige å trykke feil på midt i
   stemningen.
3. Alle skal kunne følge med fra sofaen: viktig tilstand må kunne leses på avstand og aldri
   uttrykkes med farge alene.
4. Null friksjon for å bli med: ingen konto og ingen installasjon.

## Accessibility & Inclusion
Teksten må kunne leses fra sofaen på TV-en, og farge er aldri det eneste som skiller tilstander.
