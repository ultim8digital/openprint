# OpenPrint

**Design en del, og bestil den hos et værksted i det åbne netværk.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · **[Dansk](../../docs/readme/README.da.md)** · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Find en producent på kortet, se deres muligheder, og kontakt dem direkte. Hvis din værksted ikke er på listen, kan du tilføje kontaktoplysninger og beskrive de tjenester, I tilbyder: oplysningerne vises straks. Gem linket til den private administrationsside, så du senere kan redigere eller slette din oplysning. Standardkataloget indeholder ingen brugerkonti, kræver ikke e-mailbekræftelse eller godkendelsesproces.

Kør OpenPrint med Node.js 24 og lokal SQLite. Vercel, Supabase, en e-mailudbyder, betalt AI og login via tredjepart er ikke påkrævet. GitHub hoster kildekoden og udgiver nye versioner; et fælles websted, der accepterer bidrag, har brug for en kørende API-server. [GitHub-sider](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) alene kan ikke køre Node.js API eller gemme ændringer foretaget af besøgende.

## Katalogets funktioner

- [Værkstedsnetværk](../../docs/WORKSHOP_NETWORK.md). Din bestilling og fil gemmes på det valgte værksteds node.
- Søg efter navn, by og teknologi. Kortet viser relevante steder, uanset hvordan listen er opdelt i sider.
- Offentliggør uden at oprette en konto. Vælg et punkt på kortet, eller indtast koordinater; opslag uden koordinater kan stadig søges frem.
- Rediger eller slet én opslagspost sammen med dens private link. Versionskontrol beskytter mod modstridende ændringer i forskellige faner.
- Find eksisterende studier, før du offentliggør dem. Præcise dubletter af navn, by og adresse afvises automatisk.
- Importer en katalog med angivelse af kilden. Operatørers import kan ikke overskrive selvoprettede opslag.
- Vis OpenStreetMap kortfliser uden en API nøgle. Kortfliser indlæses, når et kort vises, inklusive den standardmæssige startside.
- Vælg interfacesproget i sprogmenuen. Læs hele README-filen på dit sprog via sprogindekset ovenfor.

Offentliggørelse indebærer ikke en bekræftelse af virksomhedens ejerskab eller kvaliteten af tjenesterne. Bekræft udstyr, kompetencer og betingelser med studiet. Enhver, der har det private administrationslink, kan administrere denne profil. Hold det privat; der er ingen mulighed for at gendanne det via e-mail. Læs [vejledningen til selvpublicering](../../docs/OPEN_CATALOG.md).

## Kør din egen version

Installer Node.js 24, klon dette arkiv, og kør:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Standardinstallationen `APP_MODE=catalog` kræver ingen administrator- eller brugeropsætning. Konfigurer `APP_URL`, HTTPS og sikkerhedskopier ved hjælp af [vejledningen til selvhosting](../../docs/SELF_HOSTING.md). Docker Compose er også tilgængeligt: `docker compose up --build -d`.

Den understøttede implementering består af én applikationsproces med SQLite på en lokal disk. Automatisk publicering og kvoter for anmodninger begrænser misbrug uden behov for en kø til moderering. En delt kontor-IP-adresse kan dele en publiceringskvote. Se [grænser og adfærden for administrationslinket](../../docs/OPEN_CATALOG.md), før du åbner en offentlig instans.

Brug [katalogimportens kommandolinjeværktøj](../../docs/CATALOG_IMPORT.md) til et eksisterende datasæt, efter at du har kontrolleret dets rettigheder. Eksemplarer af datasæt, uploads og sikkerhedskopier er ikke inkluderet i depotet eller containerbillederne.

## Valgfrit fællesskabs- og Neofab-tilstand

Indstil `APP_MODE=community` eksplicit for at aktivere private projekter, tilbud fra leverandører, modelbiblioteket og Neofab Studio. Disse arbejdsgange bruger deres egne konti og tilladelser. Ved skift af tilstand bevares de gemte data. Katalogtilstand afslører ikke privat historik fra fællesskabet via dets API eller genoptager afventende CAD arbejde.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) understøtter versionsstyrede produktionsspecifikationer, materialelister og afgrænset deklarativ CAD med STEP/STL-eksport. CAD og kunstig intelligens (AI) er valgfrit. AI-forslag kræver gennemgang og et separat ansøgningsskridt; de udgiver ikke automatisk ordrer eller genererer geometri. CAM, G-kode og fysisk validering af produktion er ikke implementeret.

## Datarettigheder og privatliv

MIT-softwarelicensen giver ikke rettigheder til importerede forretningsdata. Alene angivelse af kilde giver ikke tilladelse til at kopiere data fra Google Maps, 2GIS, Yandex Maps eller andre kilder. Kontroller tilladelserne til lagring, offentliggørelse og videregivelse, før du bruger et datasæt. Se [dataoprindelse og grænser for gennemgang](../../docs/DATA_PROVENANCE.md).

Selvoprettede kontaktoplysninger er offentlige; administrationsnøgler er private. Opbevar databaser og sikkerhedskopier uden for offentligt tilgængelige mapper, og angiv en kontaktperson for rettelser og anmodninger om fjernelse. Læs [privatlivspolitikken](../../PRIVACY.md) og [sikkerhedspolitikken](../../SECURITY.md), før du implementerer systemet.

## Udvikling og oversættelse

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Handlinger kontrollerer typer, API og browser-arbejdsgange samt de standardmæssige og indbyggede CAD containere. Testene bruger fiktive data. Præcise beviser, dækning og resterende grænser registreres i [validering](../../docs/VALIDATION.md) og [produktets omfang](../../docs/PRODUCT.md).

Den engelske README-fil er referencepunktet for de fuldt oversatte versioner. [Sprogindekset](../../docs/i18n/README.md) indeholder dokumentation om vedligeholdelse af oversættelser og grænser for korrekturlæsning. Lokalisering af brugergrænsefladen oversætter ikke brugeroprettede opslag, projektindhold eller alle eksterne tekniske diagnostiske værktøjer.

## Licensering og bidrag

Den originale kildekode, brugergrænsefladen, SVG illustrationer, dokumentationen og den parametriske generator er [licenseret under MIT](../../LICENSE). Afhængigheder bevarer deres egne licenser og meddelelser. Brugermodeller har en separat licens, der er valgt af deres skabere. En fiktiv demoprofil og en kort tekst samt tre genererede demodesigns er dedikeret under CC0; generatoren forbliver MIT. Se [meddelelser fra tredjeparter](../../THIRD_PARTY_NOTICES.md).

Denne uafhængige implementering videreudvikler idéen bag [3d-online.app](https://3d-online.app). Oprindelige produktionskonti, hemmeligheder, privat Git-historik og brugerfiler er ikke inkluderet. Den tilpassede MIT Neofab CAD-kompilator bevarer sin [oprindelige licens og angivelse af oprindelse](../../cad-worker/NOTICE.md).

Bidrag kan omfatte kode, rettelser til oversættelser, forbedringer af brugervenligheden, åbne parametriske dele, kontrol af installationen og feedback fra faktiske værksteder. Start med [CONTRIBUTING.md](../../CONTRIBUTING.md).
