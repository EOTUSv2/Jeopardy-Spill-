# Jeopardy-spill

Et Jeopardy-inspirert flerspillerspill for lokalt nettverk: vertsskjermen kjører på PC-en/TV-en,
og opptil 10 spillere kobler til og buzzer med mobilen — akkurat som Kahoot/Mentimeter.

## 1. Installer Node.js (kun én gang)

Last ned LTS-versjonen fra https://nodejs.org, eller bruk Homebrew:

```bash
brew install node
```

## 2. Installer avhengigheter

Kjør dette inne i prosjektmappen:

```bash
npm install
```

## 3. Start spillet

For selve spillkvelden, bygg først (kun én gang, og på nytt etter kodeendringer), og start deretter:

```bash
npm run build
npm start
```

Dette kjører spillet i produksjonsmodus: sidene er ferdig kompilert, så de åpnes med en gang.
Under utvikling kan du bruke `npm run dev` i stedet (tregere første lasting, siden hver side
kompileres når den åpnes).

Terminalen skriver ut lenkene:

- **Meny med alle spill (PC):** `http://localhost:3000/`
- **Vertsskjerm (PC):** `http://localhost:3000/host`
- **Spillere (mobil):** `http://<din-lokale-ip>:3000/play`

Alle mobilene må være koblet til **samme WiFi-nettverk** som PC-en som kjører serveren.

**Bare maskinen som kjører serveren kan være vert.** Åpner en spiller `/host` på mobilen, får
vedkommende en beskjed i stedet for brettet (så ingen kan se svarene eller styre spillet). Vil du
bruke en annen enhet som vertsskjerm, start med `ALLOW_REMOTE_HOST=1 npm start`.

## 4. Slik spilles det

1. Åpne `/host` på hovedskjermen. Den viser en 4-tegns kode.
2. Spillerne går til `/play` på mobilen, skriver inn koden og navnet sitt (maks 10 spillere).
3. Verten trykker **Start spill** når alle har koblet til.
4. Brett 1 vises med 6 tilfeldige kategorier og 5 spørsmål hver (100–500 poeng).
   Trykk på det lille **?** i hjørnet av en kategori for en kort forklaring.
5. Verten klikker på et poengfelt for å vise spørsmålet. En **20 sekunders nedtelling** starter,
   og stopper så snart noen buzzer.
6. Spillerne buzzer på mobilen (den vibrerer). Den som buzzer først låser feltet, og navnet
   deres får en tydelig ring på vertsskjermen.
7. Spilleren sier svaret høyt. Verten trykker **Vis svar** for å avsløre fasiten for alle
   (svaret vises aldri av seg selv, så skjermen kan streames).
8. Verten trykker **Riktig** (poeng legges til) eller **Feil** (poeng trekkes fra, og en lyd
   spilles — de andre kan buzze på nytt). Buzzer ingen innen 20 sekunder, avsløres svaret automatisk.
9. Når alle feltene i brett 1 er brukt, går man videre til **brett 2** med doble poeng (200–1000).
10. Etter brett 2 vises sluttresultatet.

**Nytt spill**-knappen på vertsskjermen nullstiller alt (ny kode, nye kategorier, tomme poeng).

## 5. Rediger spørsmålene dine

Alle spørsmål ligger i [`questions.json`](questions.json), som kommer ferdig utfylt med 37 kategorier.
Hver kategori har **5 vanskelighetsgrader**, og hver grad kan ha **flere alternative spørsmål**
(spillet trekker ett tilfeldig av dem hver gang), samt en valgfri `hint` som vises bak **?**-ikonet:

```json
{
  "categories": [
    {
      "name": "Din kategori",
      "hint": "Kort forklaring på hva kategorien handler om",
      "questions": [
        [ { "q": "Lett spørsmål A", "a": "Svar" }, { "q": "Lett spørsmål B", "a": "Svar" } ],
        [ { "q": "Litt vanskeligere", "a": "Svar" } ],
        [ { "q": "Middels", "a": "Svar" } ],
        [ { "q": "Vanskelig", "a": "Svar" } ],
        [ { "q": "Vanskeligst", "a": "Svar" } ]
      ]
    }
  ]
}
```

De 5 elementene i `questions` tilsvarer 100/200/300/400/500 poeng (dobbelt på brett 2). Det må
være **minst 12 gyldige kategorier** totalt. Du trenger ikke restarte serveren etter å ha redigert
filen — trykk bare **Nytt spill**, så leses filen inn på nytt.
