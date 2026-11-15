# OpenPrint

**Otevřený seznam tiskáren a dílen. Není nutná registrace ani moderátoři.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Najděte výrobce na mapě, zkontrolujte jejich možnosti a kontaktujte je přímo. Pokud ve výpisu chybí vaše dílna, přidejte její kontaktní údaje a nabízené služby: výpis se zobrazí okamžitě. Uložte si odkaz pro soukromou správu, abyste mohli později upravit nebo smazat svůj záznam. Výchozí katalog neobsahuje žádné uživatelské účty, potvrzování e-mailem ani systém schvalování.

Spusťte OpenPrint s Node.js 24 a lokálně SQLite. Vercel, Supabase, poskytovatel e-mailových služeb, placená umělá inteligence a přihlášení prostřednictvím třetí strany nejsou vyžadovány. GitHub hostuje zdrojový kód a verze; sdílená webová stránka, která přijímá příspěvky, potřebuje spuštěný API server. Pouhé [GitHub stránky](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) nemohou spustit Node.js API ani uchovávat změny provedené návštěvníky.

## Funkce katalogu

- Vyhledávejte podle názvu, města a technologie. Na mapě se zobrazují odpovídající lokality, a to nezávisle na stránkování seznamu.
- Publikujte bez nutnosti vytvořit si účet. Vyberte bod na mapě nebo zadejte souřadnice; záznamy bez souřadnic zůstanou vyhledatelné.
- Upravte nebo smažte jednu položku spolu s jejím privátním odkazem. Kontrola verzí chrání před konfliktními úpravami v různých záložkách.
- Před publikováním vyhledejte stávající studia. Duplicitní záznamy se stejným názvem, městem a adresou budou automaticky zamítnuty.
- Importujte katalog s uvedením zdroje. Operátor nemůže přepsat záznamy, které uživatel sám zveřejnil.
- Zobrazte OpenStreetMap dlaždic bez API klíče. Dlaždice se načítají při zobrazení mapy, včetně výchozí úvodní stránky.
- Vyberte jazyk rozhraní z jazykového menu. Přečtěte si kompletní soubor README ve vašem jazyce prostřednictvím jazykového indexu nahoře.

Zveřejnění nezaručuje vlastnictví podniku ani kvalitu služeb. Ověřte si u studia dostupné vybavení, možnosti a podmínky. Kdokoli, kdo má k dispozici soukromý odkaz pro správu, může daný záznam upravovat. Udržujte jej v soukromí; obnova pomocí e-mailu není možná. Přečtěte si [návod pro vlastní zveřejňování](../../docs/OPEN_CATALOG.md).

## Spusťte si vlastní instanci

Nainstalujte Node.js 24, naklonujte toto úložiště a spusťte:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Výchozí `APP_MODE=catalog` nevyžaduje žádné nastavení administrátorem ani uživatelem. Nakonfigurujte `APP_URL`, HTTPS a zálohy pomocí [návodu pro vlastní hostování](../../docs/SELF_HOSTING.md). Docker K dispozici je také Compose: `docker compose up --build -d`.

Podporované nasazení zahrnuje jeden proces aplikace s SQLite na lokálním disku. Automatické publikování a limity pro počet požadavků omezují zneužívání bez nutnosti moderace. Sdílená kancelářská IP adresa může sdílet limit pro publikování. Před spuštěním veřejné instance si přečtěte informace o [limitech a chování při správě](../../docs/OPEN_CATALOG.md).

Použijte nástroj [příkazového řádku pro import katalogu](../../docs/CATALOG_IMPORT.md) pro existující datovou sadu poté, co zkontrolujete její práva. Datové sady instancí, nahrávání a zálohy nejsou součástí repozitáře ani kontejnerových obrazů.

## Volitelný komunitní režim a režim Neofab

Nastavte `APP_MODE=community` explicitně, abyste povolili soukromé projekty, nabídky od poskytovatelů, knihovnu modelů a Neofab Studio. Tyto pracovní postupy používají vlastní účty a oprávnění. Přepínání režimů zachovává uložená data. Režim katalogu nezpřístupňuje soukromou historii komunity prostřednictvím svého API ani neobnovuje pozastavené CAD úlohy.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) podporuje verzované zadání pro výrobu, seznamy materiálů a ohraničené deklarativní CAD s exporty do STEP/STL. CAD a umělá inteligence jsou volitelné. Návrhy vytvořené pomocí umělé inteligence vyžadují kontrolu a samostatný krok aplikace; automaticky nepublikují objednávky ani nevytvářejí geometrii. CAM, G-kód a fyzická validace výroby nejsou implementovány.

## Práva k datům a ochrana soukromí

Licence k softwaru MIT neposkytuje práva k importovaným obchodním záznamům. Pouhé uvedení zdroje neopravňuje ke kopírování dat z Google Maps, 2GIS, Yandex Maps nebo jiných zdrojů. Před použitím datové sady ověřte oprávnění pro ukládání, zveřejňování a další šíření. Viz [hranice původu a kontroly dat](../../docs/DATA_PROVENANCE.md).

Samostatně zveřejněné kontaktní údaje jsou veřejné; správcovská oprávnění jsou soukromá. Ukládejte databáze a zálohy mimo veřejně přístupné adresáře a uveďte kontaktní osobu pro případ oprav a žádostí o odstranění. Před nasazením si přečtěte informace o [ochraně soukromí](../../PRIVACY.md) a [bezpečnosti](../../SECURITY.md).

## Vývoj a překlad

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Funkce kontroluje typy, API a pracovní postupy prohlížeče, a také výchozí a nativní CAD kontejnery. Testy používají fiktivní záznamy. Přesné důkazy, pokrytí a zbývající limity jsou zaznamenány v [ověřování](../../docs/VALIDATION.md) a [rozsahu produktu](../../docs/PRODUCT.md).

Anglický soubor README slouží jako referenční dokument pro kompletní přeložené verze. [Index jazyků](../../docs/i18n/README.md) obsahuje informace o údržbě překladů a limitech pro jejich kontrolu. Lokalizace uživatelského rozhraní nepřekládá uživatelsky vytvořené záznamy, obsah projektů ani veškeré externí technické diagnostické údaje.

## Licencování a příspěvky

Původní zdrojový kód, uživatelské rozhraní, SVG ilustrace, dokumentace a parametrický generátor jsou [licencovány](../../LICENSE) podle MIT. Závislosti si ponechávají vlastní licence a upozornění. Uživatelská data mají samostatnou licenci, kterou si zvolili jejich autoři. Fiktivní ukázkový profil a stručný text a tři generované ukázkové návrhy jsou poskytovány pod licencí CC0; generátor zůstává MIT. Viz [oznámení třetích stran](../../THIRD_PARTY_NOTICES.md).

Tato nezávislá implementace rozvíjí myšlenku [3d-online.app](https://3d-online.app). Původní produkční účty, tajné klíče, privátní historie Gitu a uživatelské soubory nejsou zahrnuty. Upravený MIT Neofab CAD kompilátor si zachovává svou [původní licenci a informaci o původu](../../cad-worker/NOTICE.md).

Příspěvky mohou zahrnovat kód, opravy překladů, vylepšení použitelnosti, otevřené parametrické součásti, kontroly instalace a zpětnou vazbu od skutečných dílen. Začněte zde: [CONTRIBUTING.md](../../CONTRIBUTING.md).
