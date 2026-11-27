# OpenPrint

**Utforma en del och beställ den från en verkstad i det öppna nätverket.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · **[Svenska](../../docs/readme/README.sv.md)** · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Hitta en tillverkare på kartan, kontrollera deras kapacitet och kontakta dem direkt. Om din verkstad saknas kan du lägga till kontaktuppgifter och tjänster: informationen visas omedelbart. Spara länken för privat administration för att redigera eller ta bort din information senare. Standardkatalogen har inga användarkonton, e-postbekräftelse eller ett system för godkännande.

Kör OpenPrint med Node.js 24 och lokalt SQLite. Vercel, Supabase, en e-postleverantör, betald AI och inloggning via tredje part krävs inte. GitHub hostar källkoden och släpper versioner; en delad webbplats som tar emot bidrag behöver en aktiv API-server. [GitHub Sidor](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) kan inte ensamt köra Node.js API eller spara besökares ändringar.

## Katalogens funktioner

- [Verkstadsnätverk](../../docs/WORKSHOP_NETWORK.md). Din beställning och fil sparas på den valda verkstadens nod.
- Sök efter namn, stad och teknik. Kartan visar relevanta platser oberoende av sidindelningen i listan.
- Publicera utan att skapa ett konto. Välj en punkt på kartan eller ange koordinater; objekt utan koordinater kan fortfarande sökas fram.
- Redigera eller ta bort en post tillsammans med dess privata länk. Versionskontroller skyddar mot motstridiga ändringar i olika flikar.
- Sök efter befintliga verkstäder innan du publicerar. Exakta dubbletter av namn, stad och adress avvisas automatiskt.
- Importera en katalog med information om källan. Operatörer kan inte skriva över listor som de själva har publicerat.
- Visa OpenStreetMap rutor utan en API-nyckel. Rutorna laddas när en karta visas, inklusive standardsidan.
- Välj gränssnittets språk i språkmenyn. Läs hela README-filen på ditt språk via språkindexet ovan.

Publicering innebär inte att ägandet av företaget eller kvaliteten på tjänsterna verifieras. Bekräfta utrustning, kapacitet och villkor med studion. Den som innehar den privata länken för administration kan hantera den här informationen. Håll den privat; det finns ingen möjlighet att återställa den via e-post. Läs [guiden för egenpublicering](../../docs/OPEN_CATALOG.md).

## Kör din egen instans

Installera Node.js 24, klona det här arkivet och kör:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Standardinstallationen `APP_MODE=catalog` kräver ingen administratörs- eller användarkonfiguration. Konfigurera `APP_URL`, HTTPS och säkerhetskopiering med hjälp av [guiden för egen drift](../../docs/SELF_HOSTING.md). Docker Compose är också tillgängligt: `docker compose up --build -d`.

Den stödda driftsättningen innebär en applikationsprocess med SQLite på en lokal disk. Automatisk publicering och begränsningar för antalet förfrågningar minskar risken för missbruk utan att det behövs en kö för granskning. En delad IP-adress för kontoret kan användas för att dela en publiceringskvot. Se [gränser och hur hanteringen fungerar](../../docs/OPEN_CATALOG.md) innan du öppnar en publik instans.

Använd [kommandoradsverktyget för katalogimport](../../docs/CATALOG_IMPORT.md) för en befintlig datamängd efter att du har kontrollerat dess användningsrättigheter. Instansdatamängder, uppladdningar och säkerhetskopior inkluderas inte i arkivet eller containeravbildningarna.

## Valfritt communityläge och Neofab-läge

Ställ in `APP_MODE=community` explicit för att aktivera privata projekt, offerter från leverantörer, modellbiblioteket och Neofab Studio. Dessa arbetsflöden använder sina egna konton och behörigheter. Att byta läge bevarar den lagrade datan. Katalogläget exponerar inte privat historik från gemenskapen via dess API eller återupptar köad CAD arbetsuppgift.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) stöder versionshanterade tillverkningsunderlag, materialförteckningar och begränsade deklarativa CAD med STEP/STL-exporter. CAD och AI är valfritt. AI-förslag kräver granskning och ett separat ansökningssteg; de publicerar inte automatiskt beställningar eller skapar geometri. CAM, G-kod och fysisk validering av tillverkningen är inte implementerat.

## Rättigheter till data och integritet

MIT-programvarulicensen ger inte rättigheter till importerade affärsregister. Enbart hänvisning till källan ger inte tillstånd att kopiera data från Google Maps, 2GIS, Yandex Maps eller andra källor. Kontrollera behörigheterna för lagring, publicering och vidare distribution innan du använder en datamängd. Se [information om dataursprung och gränser för granskning](../../docs/DATA_PROVENANCE.md).

Kontaktuppgifter som du själv har publicerat är offentliga; administrationsnycklar är privata. Förvara databaser och säkerhetskopior utanför offentligt tillgängliga kataloger och ange en kontaktperson för rättelser och förfrågningar om borttagning. Läs igenom [integritetspolicyn](../../PRIVACY.md) och [säkerhetsinformationen](../../SECURITY.md) innan du driftsätter systemet.

## Utveckling och översättning

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Åtgärder kontrollerar typer, API och webbläsararbetsflöden, samt standard- och inbyggda CAD behållare. Tester använder fiktiva data. Exakta bevis, täckning och återstående gränser registreras i [validering](../../docs/VALIDATION.md) och [produktens omfattning](../../docs/PRODUCT.md).

Den engelska README-filen är referensen för de fullständiga översatta versionerna. I [språkindexet](../../docs/i18n/README.md) finns dokumentation om underhåll och granskning av översättningar. Lokaliseringsarbetet av användargränssnittet översätter inte användargenererade listor, projektinnehåll eller all extern teknisk diagnostik.

## Licensiering och bidrag

Den ursprungliga källkoden, användargränssnittet, SVG illustrationerna, dokumentationen och den parametriska generatorn är [licensierade enligt MIT](../../LICENSE). Beroenden behåller sina egna licenser och meddelanden. Användarmodeller har en separat licens som väljs av deras skapare. En fiktiv demoprofil och en kort text, samt tre genererade demodesigner, är tillgängliga under CC0; generatorn förblir MIT. Se [meddelanden från tredje part](../../THIRD_PARTY_NOTICES.md).

Denna oberoende implementering utvecklar idén bakom [3d-online.app](https://3d-online.app). Ursprungliga produktionskonton, hemligheter, privat Git-historik och användarfiler ingår inte. Den anpassade MIT Neofab CAD-kompilatorn behåller sin [ursprungliga licens och information om ursprung](../../cad-worker/NOTICE.md).

Bidrag kan omfatta kod, korrigeringar av översättningar, förbättringar av användarvänligheten, öppna parametriska delar, installationskontroller och återkoppling från riktiga verkstäder. Börja med [CONTRIBUTING.md](../../CONTRIBUTING.md).
