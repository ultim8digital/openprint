# OpenPrint

**Oblikujte del in ga naročite pri delavnici v odprtem omrežju.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · **[Slovenščina](../../docs/readme/README.sl-SI.md)** · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Poiščite ustvarjalca na zemljevidu, preverite njegove zmogljivosti in se neposredno obrnite nanj. Če vašega studia ni na seznamu, dodajte njegove kontaktne podatke in storitve: seznam se takoj posodobi. Shranite zasebno povezavo za upravljanje, da boste lahko pozneje uredili ali izbrisali svoj vnos. Privzeti katalog nima uporabniških računov, potrditve prek e-pošte ali sistema za odobritev.

Zaženite OpenPrint s Node.js 24 in lokalno SQLite. Vercel, Supabase, ponudnik e-poštnih storitev, plačljiva umetna inteligenca in prijava prek tretjih oseb niso potrebne. GitHub gosti izvorno kodo in objavlja različice; za skupno spletno stran, ki sprejema vsebine, je potreben delujoč API strežnik. [GitHub strani](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) same po sebi ne morejo izvajati Node.js API ali ohranjati sprememb obiskovalcev.

## Funkcije kataloga

- [Omrežje delavnic](../../docs/WORKSHOP_NETWORK.md). Vaše naročilo in datoteka bosta shranjena v vozlišču izbrane delavnice.
- Iščite po imenu, mestu in tehnologiji. Na zemljevidu so prikazane ustrezne lokacije, ne glede na to, na kateri strani seznama se nahajajo.
- Objavite brez ustvarjanja uporabniškega računa. Izberite točko na zemljevidu ali vnesite koordinate; objave brez koordinat ostanejo dostopne za iskanje.
- Uredite ali izbrišite eno objavo, skupaj z njenim zasebnim povezavo. Preverjanje različic preprečuje nasprotujoče si spremembe v različnih zavihkih.
- Pred objavo poiščite že obstoječe delavnice. Duplikati točnih imen, mest in naslovov bodo samodejno zavrnjeni.
- Uvozite katalog z navedbo vira. Uporabniki ne morejo prepisati seznamov, ki so jih objavili sami.
- Oglejte si OpenStreetMap ploščic brez API ključa. Ploščice se naložijo, ko je prikazan zemljevid, vključno s privzeto začetno stranjo.
- Izberite jezik vmesnika v jezikovnem meniju. Preberite celotno datoteko README v svojem jeziku prek jezikovnega indeksa zgoraj.

Objavljanje ne preverja lastništva podjetja ali kakovosti storitev. Preverite opremo, zmogljivosti in pogoje pri studiu. Vsak, ki ima zasebno povezavo za upravljanje, lahko nadzoruje to vsebino. Ohranjajte jo zasebno; ni možnosti za obnovitev e-poštnega naslova. Preberite [priročnik za samostojno objavljanje](../../docs/OPEN_CATALOG.md).

## Zaženite lastno različico

Namestite Node.js 24, klonirajte to repozitorij in zaženite:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Privzeta nastavitev `APP_MODE=catalog` ne zahteva konfiguracije s strani skrbnika ali uporabnika. Nastavite `APP_URL`, HTTPS in varnostne kopije s pomočjo [navodil za samostojno gostovanje](../../docs/SELF_HOSTING.md). Docker Na voljo je tudi Compose: `docker compose up --build -d`.

Podprta konfiguracija vključuje en sam proces aplikacije z SQLite na lokalnem disku. Samodejna objava in omejitve glede števila zahtev omejujejo zlorabe brez potrebe po čakalni vrsti za moderiranje. Deljena IP-naslova lahko uporablja skupna kvota za objave. Pred odprtjem javne različice si oglejte [omejitve in vedenje povezave za upravljanje](../../docs/OPEN_CATALOG.md).

Uporabite [orodje za uvoz kataloga iz ukazne vrstice](../../docs/CATALOG_IMPORT.md) za obstoječo zbirko podatkov, potem ko preverite njene pravice. Zbirke podatkov, naloženi podatki in varnostne kopije niso združeni v repozitoriju ali v slikah vsebnika.

## Neobvezna možnost za skupnost in način Neofab

Nastavite `APP_MODE=community` na določeno vrednost, da omogočite zasebne projekte, ponudbe ponudnikov, knjižnico modelov in Neofab Studio. Ti delovni poteki uporabljajo svoje račune in dovoljenja. Preklapljanje med načini ohranja shranjene podatke. Način kataloga ne prikazuje zasebne zgodovine skupnosti prek API ali ne nadaljuje začasno ustavljenega CAD dela.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) podpira različice proizvodnih navodil, seznamov materialov in omejene deklarativne CAD z izvozi v STEP/STL. CAD in umetna inteligenca (AI) sta neobvezna. Predlogi, ki jih ustvari umetna inteligenca, zahtevajo pregled in ločen korak prijave; ne objavljajo samodejno naročil ali ustvarjajo geometrije. CAM, G-koda in fizična validacija proizvodnje nista implementirani.

## Pravice do podatkov in varstvo zasebnosti

Licenca za programsko opremo MIT ne podeljuje pravic za uvožene poslovne zapise. Samo navajanje vira ne omogoča kopiranja podatkov iz Google Maps, 2GIS, Yandex Maps ali drugih virov. Pred uporabo nabora podatkov preverite dovoljenja za shranjevanje, objavljanje in ponovno distribucijo. Glejte [izvor in obseg preverjanja podatkov](../../docs/DATA_PROVENANCE.md).

Podatki za stik, ki jih uporabnik sam vnese, so javni; ključi za upravljanje pa so zasebni. Ohranjajte baze podatkov in varnostne kopije izven javno dostopnih map in zagotovite kontaktno osebo za popravke in zahteve za odstranitev. Pred uporabo preberite [politiko zasebnosti](../../PRIVACY.md) in [politiko varnosti](../../SECURITY.md).

## Razvoj in prevajanje

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Funkcija preverja vrste, API in poteke delovanja v brskalniku, ter privzete in izvorne CAD vsebnike. Testi uporabljajo fiktivne zapise. Natančni dokazi, obseg in preostale omejitve so zabeleženi v [validaciji](../../docs/VALIDATION.md) in [obsegu izdelka](../../docs/PRODUCT.md).

Angleška datoteka README je osnova za vse prevedene različice. [Kazalo jezikov](../../docs/i18n/README.md) vsebuje dokumentacijo o vzdrževanju in omejitvah pregleda prevodov. Lokalizacija uporabniškega vmesnika ne prevede seznamov, ki jih ustvarijo uporabniki, vsebine projektov ali vseh zunanjih tehničnih diagnostičnih podatkov.

## Licenciranje in prispevki

Izvorna koda, uporabniški vmesnik, SVG ilustracije, dokumentacija in parametrični generator so [licencirani](../../LICENSE) v skladu z MIT. Odvisnosti ohranijo svoje lastne licence in obvestila. Uporabniški modeli imajo ločeno licenco, ki jo izberejo njihovi avtorji. Fiktivni demonstracijski profil in kratek tekst ter tri generirani demonstracijski modeli so namenjeni v skladu z CC0; generator ostaja MIT. Glejte [obvestila tretjih oseb](../../THIRD_PARTY_NOTICES.md).

Ta neodvisna različica razvija idejo [3d-online.app](https://3d-online.app). Izvorne proizvodne račune, gesla, zasebno zgodovino Git in uporabniške datoteke niso vključeni. Prilagojeni prevajalnik MIT Neofab CAD ohranja svojo [izvirno licenco in obvestilo o izvoru](../../cad-worker/NOTICE.md).

Prispevki lahko vključujejo kodo, popravke prevodov, izboljšave uporabnosti, odprte parametrizirane komponente, preverjanje namestitve in povratne informacije iz resničnih delavnic. Začnite z [CONTRIBUTING.md](../../CONTRIBUTING.md).
