# OpenPrint

**Otvorený zoznam tlačiarenských štúdií a dielní. Nie je potrebná registrácia ani moderátori.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · **[Slovenčina](../../docs/readme/README.sk.md)** · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Nájdite si na mape výrobcu, zistite, aké má možnosti, a kontaktujte ho priamo. Ak vo zozname chýba vaša dielňa, pridajte jej kontaktné údaje a ponúkané služby: záznam sa zobrazí okamžite. Uložte si osobný odkaz na správu, aby ste mohli neskôr upraviť alebo odstrániť svoj záznam. Predvolený katalóg neobsahuje žiadne používateľské účty, overovanie e-mailom ani systém schvaľovania.

Spustite OpenPrint s Node.js 24 a lokálne SQLite. Vercel, Supabase, poskytovateľ e-mailových služieb, platená AI a prihlásenie prostredníctvom tretej strany nie sú potrebné. GitHub hostuje zdrojový kód a verzie; zdieľaný web, ktorý prijíma príspevky, potrebuje funkčný API server. Samotné [GitHub stránky](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) nemôžu spustiť Node.js API ani uchovávať zmeny návštevníkov.

## Funkcie katalógu

- Vyhľadávajte podľa názvu, mesta a technológie. Na mape sa zobrazujú relevantné lokality bez ohľadu na stránkovanie zoznamu.
- Publikujte bez vytvorenia účtu. Vyberte bod na mape alebo zadajte súradnice; záznamy bez súradníc zostanú vyhľadateľné.
- Upravte alebo odstráňte jednu položku spolu s jej súkromným odkazom. Kontrola verzií chráni pred konfliktmi pri úpravách v rôznych oknách prehliadača.
- Pred publikovaním nájdite existujúce štúdiá. Duplicitné záznamy s presným názvom, mestom a adresou budú automaticky odmietnuté.
- Importujte katalóg so zdrojom informácií. Operátori nemôžu prepísať záznamy, ktoré boli publikované nezávisle.
- Zobrazte OpenStreetMap dlaždíc bez API kľúča. Dlaždice sa načítajú, keď sa zobrazí mapa, vrátane predvolenej úvodnej stránky.
- Vyberte jazyk rozhrania z jazykového menu. Prečítajte si kompletný súbor README vo svojom jazyku prostredníctvom jazykového indexu vyššie.

Uverejnenie neoveruje vlastníctvo podniku ani kvalitu služieb. Overte si vybavenie, možnosti a podmienky priamo v štúdiu. Každý, kto má prístup k súkromnému odkazu na správu, môže túto položku upravovať. Zabezpečte jej súkromnosť; možnosť obnovenia e-mailu neexistuje. Prečítajte si [návod na samostatné uverejnenie](../../docs/OPEN_CATALOG.md).

## Spustite vlastnú inštanciu

Nainštalujte Node.js 24, skopírujte tento repozitár a spustite:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Predvolené nastavenie `APP_MODE=catalog` nevyžaduje konfiguráciu zo strany správcu ani používateľa. Nakonfigurujte `APP_URL`, HTTPS a zálohy pomocou [návodu na samostatné hostovanie](../../docs/SELF_HOSTING.md). Docker K dispozícii je aj Compose: `docker compose up --build -d`.

Podporovaná konfigurácia zahŕňa jeden proces aplikácie s SQLite na lokálnom disku. Automatické publikovanie a kvóty pre požiadavky obmedzujú zneužívanie bez potreby moderátorskej fronty. Zdieľaná kancelárska IP adresa môže zdieľať kvótu pre publikovanie. Pred spustením verejnej inštancie si prečítajte [informácie o limitoch a správaní](../../docs/OPEN_CATALOG.md).

Použite rozhranie príkazového riadka [import katalógu](../../docs/CATALOG_IMPORT.md) pre existujúcu databázu po overení jej práv. Databázy inštancií, nahrávania a zálohy nie sú súčasťou repozitára alebo obrazov kontajnerov.

## Voliteľný komunitný režim a režim Neofab

Nastavte `APP_MODE=community` explicitne, aby ste povolili súkromné projekty, ponuky od poskytovateľov, knižnicu modelov a Neofab Studio. Tieto pracovné postupy používajú vlastné účty a oprávnenia. Prepínanie medzi režimami zachováva uložené údaje. Režim katalógu nezobrazuje súkromnú históriu komunity prostredníctvom svojho API a neobnovuje prerušenú CAD prácu.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) podporuje verzie výrobných zadávaní, zoznamy materiálov a obmedzené deklaratívne CAD s exportmi do STEP/STL. CAD a umelá inteligencia sú voliteľné. Návrhy využívajúce umelú inteligenciu vyžadujú kontrolu a samostatný krok pri podávaní žiadosti; automaticky nezverejňujú objednávky ani nevytvárajú geometriu. CAM, G-kód a fyzická validácia výroby nie sú implementované.

## Práva na údaje a ochrana súkromia

Licencia MIT softvéru neposkytuje práva na používanie importovaných obchodných záznamov. Samotné uvedenie zdroja neoprávňuje kopírovať údaje z Google Maps, 2GIS, Yandex Maps alebo iných zdrojov. Pred použitím súboru údajov overte povolenia na ukladanie, publikovanie a ďalšiu distribúciu. Pozrite si [informácie o pôvode údajov a rozsahu ich použitia](../../docs/DATA_PROVENANCE.md).

Samostatne zverejnené kontaktné údaje sú verejne dostupné; administratívne kľúče sú súkromné. Udržujte databázy a zálohy mimo verejne dostupných priečinkov a poskytnite kontaktnú osobu pre opravy a žiadosti o odstránenie. Pred nasadením si prečítajte [pravidlá ochrany súkromia](../../PRIVACY.md) a [pravidlá zabezpečenia](../../SECURITY.md).

## Vývoj a preklad

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Funkcia overuje typy, API a pracovné postupy prehliadača, a štandardné a natívne CAD kontajnery. Testy používajú fiktívne záznamy. Presné dôkazy, rozsah a zostávajúce limity sú zaznamenané v časti [overenie](../../docs/VALIDATION.md) a [rozsah produktu](../../docs/PRODUCT.md).

Anglický súbor README slúži ako referenčný materiál pre kompletné preložené verzie. Dokument [zoznam jazykov](../../docs/i18n/README.md) popisuje údržbu prekladov a rozsahy ich kontroly. Lokalizácia používateľského rozhrania neprekladá používateľom vytvorené záznamy, obsah projektov ani všetky externé technické správy.

## Licencovanie a príspevky

Pôvodný zdroj, používateľské rozhranie, SVG ilustrácie, dokumentácia a parametrický generátor sú [licencované](../../LICENSE) podľa MIT. Závislosti si ponechávajú svoje vlastné licencie a upozornenia. Používateľské modely majú samostatnú licenciu, ktorú si zvolili ich autori. Fiktívny ukážkový profil a stručný text, ako aj tri vygenerované ukážkové návrhy, sú poskytnuté pod CC0; generátor zostáva MIT. Pozrite si [upozornenia tretích strán](../../THIRD_PARTY_NOTICES.md).

Táto nezávislá implementácia rozvíja myšlienku [3d-online.app](https://3d-online.app). Pôvodné produkčné účty, tajné údaje, súkromná história Gitu a používateľské súbory nie sú zahrnuté. Upravený kompilátor MIT Neofab CAD si zachováva [pôvodnú licenciu a informácie o pôvode](../../cad-worker/NOTICE.md).

Príspevky môžu zahŕňať kód, opravy prekladov, zlepšenia použiteľnosti, otvorené parametrické súčiastky, kontroly inštalácie a spätnú väzbu od reálnych dielní. Začnite s [CONTRIBUTING.md](../../CONTRIBUTING.md).
