# OpenPrint

**Design en del og bestill den fra et verksted i det åpne nettverket.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · **[Norsk bokmål](../../docs/readme/README.no.md)** · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Finn en produsent på kartet, sjekk deres kapasitet og kontakt dem direkte. Hvis verkstedet ditt mangler, legg til kontaktinformasjon og tjenester: oppføringen vises umiddelbart. Lagre den private administrasjonslenken for å redigere eller slette oppføringen senere. Standardkatalogen har ingen kontoer, e-postbekreftelse eller godkjenningskø.

Kjør OpenPrint med Node.js 24 og lokal SQLite. Vercel, Supabase, en e-postleverandør, betalt AI og innlogging via tredjepart er ikke nødvendig. GitHub hoster kildekoden og utgir versjoner; et felles nettsted som aksepterer bidrag, trenger en kjørende API-server. [GitHub-sider](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) alene kan ikke kjøre Node.js API eller lagre endringer fra besøkende.

## Katalogfunksjoner

- [Verkstednettverk](../../docs/WORKSHOP_NETWORK.md). Bestillingen og filen din lagres på noden til verkstedet du velger.
- Søk etter navn, by og teknologi. Kartet viser relevante steder uavhengig av sideinndelingen i listen.
- Publiser uten å opprette en konto. Velg et punkt på kartet eller skriv inn koordinater; oppføringer uten koordinater kan fortsatt søkes frem.
- Rediger eller slett én oppføring sammen med dens private lenke. Versjonskontroller beskytter mot motstridende endringer i forskjellige faner.
- Finn eksisterende studioer før du publiserer. Nøyaktige duplikater av navn, by og adresse blir automatisk avvist.
- Importer en katalog med kildeangivelse. Operatørimporter kan ikke overskrive selvpubliserte oppføringer.
- Vis OpenStreetMap fliser uten en API-nøkkel. Flisene lastes inn når et kart vises, inkludert standardsiden.
- Velg grensesnittspråket fra språkmenyen. Les hele README-filen på ditt språk via språklisten ovenfor.

Publisering bekrefter ikke eierskap til virksomheten eller kvaliteten på tjenestene. Bekreft utstyr, kapasitet og vilkår med studioet. Alle som har den private administrasjonslenken, kan kontrollere denne oppføringen. Hold den privat; det finnes ingen mulighet for å gjenopprette den via e-post. Les [veiledningen for egenpublisering](../../docs/OPEN_CATALOG.md).

## Kjør din egen instans

Installer Node.js 24, klon dette depotet og kjør:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Standard `APP_MODE=catalog` krever ingen administrator- eller brukeroppsett. Konfigurer `APP_URL`, HTTPS og sikkerhetskopier ved hjelp av [veiledningen for egen hosting](../../docs/SELF_HOSTING.md). Docker Compose er også tilgjengelig: `docker compose up --build -d`.

Den støttede distribusjonsmetoden er én applikasjonsprosess med SQLite på en lokal disk. Automatisk publisering og forespørselskvoter begrenser misbruk uten en modereringskø. En delt kontor-IP-adresse kan dele en publiseringskvote. Se [grenser og oppførsel knyttet til administrasjonslenken](../../docs/OPEN_CATALOG.md) før du åpner en offentlig instans.

Bruk [katalogimportkommandoen](../../docs/CATALOG_IMPORT.md) for et eksisterende datasett etter å ha sjekket rettighetene. Datasettinstanser, opplastinger og sikkerhetskopier er ikke inkludert i depotet eller containerbildene.

## Valgfritt fellesskaps- og Neofab-modus

Sett `APP_MODE=community` eksplisitt for å aktivere private prosjekter, tilbud fra leverandører, modellbiblioteket og Neofab Studio. Disse arbeidsflytene bruker sine egne kontoer og tillatelser. Ved å bytte modus bevares lagret data. Katalogmodus viser ikke privat historikk fra fellesskapet via sin API eller fortsetter ventende CAD arbeid.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) støtter versjonskontrollerte produksjonsbeskrivelser, materiallister og begrensede deklarative CAD med STEP/STL-eksport. CAD og kunstig intelligens (AI) er valgfritt. AI-forslag krever gjennomgang og et separat søknadstrinn; de publiserer ikke automatisk bestillinger eller genererer geometri. CAM, G-kode og fysisk produksjonsvalidering er ikke implementert.

## Rettigheter til data og personvern

MIT-programvarelisensen gir ikke rettigheter til importerte forretningsdata. Å oppgi kilden alene gir ikke tillatelse til å kopiere data fra Google Maps, 2GIS, Yandex Maps eller andre kilder. Bekreft tillatelsene for lagring, publisering og videredistribusjon før du bruker et datasett. Se [datakilde og retningslinjer for gjennomgang](../../docs/DATA_PROVENANCE.md).

Selvpubliserte kontaktopplysninger er offentlige; administrasjonsnøkler er private. Oppbevar databaser og sikkerhetskopier utenfor offentlig tilgjengelige mapper, og oppgi en kontaktperson for korreksjoner og forespørsler om fjerning. Les [personvern](../../PRIVACY.md) og [sikkerhet](../../SECURITY.md) før du tar i bruk systemet.

## Utvikling og oversettelse

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Handlinger kontrollerer typer, API og nettleserarbeidsflyter, samt standard- og native CAD containere. Tester bruker fiktive data. Nøyaktige bevis, omfang og gjenværende grenser registreres i [validering](../../docs/VALIDATION.md) og [produktomfang](../../docs/PRODUCT.md).

Den engelske README-filen er referansen for fullstendige oversatte versjoner. [Språkindeksen](../../docs/i18n/README.md) dokumenterer vedlikehold og retningslinjer for oversettelser. Lokalisering av brukergrensesnittet oversetter ikke brukergenererte oppføringer, prosjektinnhold eller all ekstern teknisk dokumentasjon.

## Lisensiering og bidrag

Den opprinnelige koden, brukergrensesnittet, SVG illustrasjonene, dokumentasjonen og den parametriske generatoren er [lisensiert under MIT](../../LICENSE). Avhengigheter beholder sine egne lisenser og opphavsrettsmerknader. Brukermodeller har en separat lisens valgt av deres opphavspersoner. En fiktiv demoprofil og en kort tekst, samt tre genererte demodesign, er publisert under CC0; generatoren forblir MIT. Se [opphavsrettsmerknader fra tredjeparter](../../THIRD_PARTY_NOTICES.md).

Denne uavhengige implementeringen videreutvikler ideen bak [3d-online.app](https://3d-online.app). Originale produksjonskontoer, hemmeligheter, privat Git-historikk og brukerfiler er ikke inkludert. Den tilpassede MIT Neofab CAD-kompilatoren beholder sin [opprinnelige lisens og opphavsrettserklæring](../../cad-worker/NOTICE.md).

Bidrag kan omfatte kode, korrektur av oversettelser, forbedringer av brukervennlighet, åpne parametriske deler, installasjonstester og tilbakemeldinger fra faktiske verksteder. Start med [CONTRIBUTING.md](../../CONTRIBUTING.md).
