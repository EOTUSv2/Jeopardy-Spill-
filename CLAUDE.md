# Jeopardy-spill – prosjektnotater

Spillkveld: en meny (`/`) med selskapsspill på lokalt nettverk. Første spill er Jeopardy: verten (PC/TV) viser brettet på `/host`,
opptil 10 spillere buzzer fra mobilen på `/play`. Alt er på norsk, med poeng.

## Teknisk oppsett
- Next.js 14 (pages router) + Socket.IO på en egen server, `server.js`. Ingen database:
  spilltilstanden ligger i minnet, så **en restart av serveren nullstiller spillet**.
- `lib/gameManager.js`: all spilllogikk og socket-hendelser (`host:*`, `player:*`), 20 sekunders
  nedtelling styrt av serveren.
- `lib/questions.js` + `questions.json`: 37 kategorier, 5 vanskelighetsgrader, flere alternative
  spørsmål per grad (ett trekkes tilfeldig).
- `lib/strings.js`: all UI-tekst. `lib/useCountdown.js`: delt nedtellings-hook.
- `pages/index.js` er spillmenyen («Spillkveld»). Spillene listes i `lib/games.js`; et nytt spill
  legges til med én oppføring der (navn, `href`, beskrivelse, antall spillere og en animert
  forhåndsvisning i `components/`, som spilles ved hover/fokus og automatisk på berøringsskjermer).
- Jeopardy: `pages/jeopardy.js` (velg vert/spiller), `pages/host.js`, `pages/play.js`.
- Nærmest vinner: `pages/naermest/` (index, host, play), logikk i `lib/naermestManager.js`
  (egen Socket.IO-namespace `/naermest`), spørsmål i `questions-naermest.json` (`q`, `answer`,
  `unit`). 10 runder à 30 s; nærmest får 3/2/1 poeng, eksakt treff +2.
- Felles byggeklosser for nye spill: `components/` (HostHeader, Lobby, Scoreboard, Countdown,
  FinalScores, MyScore, JoinScreen, NumberLine) og `lib/playerDevice.js` (`usePlayerSession`,
  vibrasjon, skjermfarge, wake lock), `lib/numbers.js` (norske tall).
  `styles/globals.css` (alle farger er tokens).

## Kjøring
- Spillkvelden: `npm run build` og så `npm start` (produksjon, bygges til `.next-prod`, starter på
  under ett sekund).
- `npm run dev` er veldig tregt her: hver side bruker flere minutter på første kompilering.
- Bare maskinen som kjører serveren kan være vert (`ALLOW_REMOTE_HOST=1` åpner for andre enheter).
- Serveren dør når en økt avsluttes, så start den på nytt med `npm start` når det trengs.
- Bygg på nytt etter kodeendringer. Sjekk først at ingen spillere er koblet til, siden restart
  nullstiller spillet.
- Test på egen port uten å røre det ekte spillet: `PORT=3100 NEXT_DIST_DIR=.next-test`
  (bygg også med `NEXT_DIST_DIR=.next-test`). Ikke send host-kommandoer til port 3000 uten å spørre.

## Design
- Skriften Fredoka (lagret lokalt via `@fontsource-variable/fredoka`). Tekststørrelser går via
  rolle-tokens `--fs-display/headline/question/title/lead/ui/label`, vekter via
  `--fw-body` (450), `--fw-body-on-stage` (500, lys tekst på blått), `--fw-ui` (600), `--fw-bold` (700).
  Bruk rollene i stedet for nye faste verdier.
- Avstander følger 4-px-skalaen `--space-1..8` (4, 8, 12, 16, 24, 32, 48, 64). Spørsmålskort er
  delt i `.panel-stage` (det rommet leser) og `.panel-controls` (vertens knapper: sekundære til
  venstre, hovedhandlingen alltid til høyre).
- Få, sterke farger. `--stage` (knallblå) er bunnen i hele rommet: brett, lobby, resultater.
  `--cell` (blekk) med gull-tall er brettfeltene, kodeflisene og Daily Double-kortet. Kategoriskilt
  og spørsmålskort er lyse flater (`--paper`/`--surface`). Finalen er gull-scenen. Ingen fargede
  kolonner (de ble fjernet fordi det ble rotete).
- `--p-0..9`: én farge per spiller. På mobilen fyller spillerens farge hele skjermen etter
  innlogging (`.player-tinted`), og all tekst blir blekk.
- Tekst på scenen bruker `--on-stage` / `--on-stage-soft`, fokusringen er gull på scenen og
  blekk på lyse flater.
- Grønn = riktig, korall = feil/buzz, gul = handling. Farge er aldri eneste skille (tekst finnes alltid).
- Unngå: gradient-tekst, emoji som ikoner, glødende skygger, standardfonter.
- Detektor (skal gi 0 funn): `IMPECCABLE_NO_TELEMETRY=1 npx impeccable detect pages styles`

## Impeccable
Installert i prosjektet (`.claude/skills/impeccable`, uten hooks). Revisjon (`audit`), `colorize` (ny palett: blå scene, blekk-felt, gull), `animate` og `polish` er
gjort. `PRODUCT.md` finnes nå.
