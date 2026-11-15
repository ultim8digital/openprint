# OpenPrint

**Otvoreni popis tiskarskih studija i radionica. Nije potrebna registracija, niti postoje moderatori.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · **[Hrvatski](../../docs/readme/README.hr.md)** · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Pronađite proizvođača na karti, provjerite njegove mogućnosti i izravno ga kontaktirajte. Ako vaše radionice nema na popisu, dodajte njezine kontakte i usluge: unos se odmah pojavljuje. Spremite privatnu poveznicu za upravljanje kako biste kasnije mogli urediti ili izbrisati svoj unos. Zadani katalog nema korisničkih računa, potvrde e-poštom ni reda za odobravanje.

Pokrenite OpenPrint s Node.js 24 i lokalnim SQLite. Vercel, Supabase, pružatelj e-pošte, plaćeni AI i prijava putem treće strane nisu potrebni. GitHub hostira izvorni kod i objavljuje verzije; zajednička web-stranica koja prihvaća prijedloge treba pokrenuti API poslužitelj. [GitHub stranice](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) same po sebi ne mogu pokretati Node.js API niti pohranjivati promjene posjetitelja.

## Značajke kataloga

- Pretražujte po nazivu, gradu i tehnologiji. Na karti su prikazane odgovarajuće lokacije, neovisno o podjeli na stranice u popisu.
- Objavite bez potrebe za računom. Odaberite točku na karti ili unesite koordinate; unosi bez koordinata ostaju pretraživi.
- Uredite ili izbrišite 1 unos zajedno s njegovom privatnom poveznicom. Provjera verzija štiti od sukobljenih izmjena u različitim karticama.
- Pronađite postojeće studije prije objavljivanja. Točne duplikate naziva, grada i adrese sustav automatski odbija.
- Uvezite katalog s navođenjem izvora. Operateri ne mogu prepisivati objave koje su sami objavili.
- Pregledajte OpenStreetMap pločica bez API ključa. Pločice se učitavaju kada se prikaže karta, uključujući i zadanu početnu stranicu.
- Odaberite jezik sučelja iz izbornika jezika. Pročitajte cijeli dokument README na vašem jeziku putem indeksa jezika koji se nalazi iznad.

Objavljivanje ne potvrđuje vlasništvo nad tvrtkom niti kvalitetu usluge. Potvrdite opremu, mogućnosti i uvjete sa studijem. Svaka osoba koja posjeduje privatnu poveznicu za upravljanje može kontrolirati taj unos. Držite je privatnom; nema mogućnosti oporavka putem e-pošte. Pročitajte [vodič za samostalno objavljivanje](../../docs/OPEN_CATALOG.md).

## Pokrenite vlastitu instancu

Instalirajte Node.js 24, klonirajte ovo spremište i pokrenite:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Zadani `APP_MODE=catalog` ne zahtijeva postavljanje od strane administratora ili korisnika. Konfigurirajte `APP_URL`, HTTPS i sigurnosne kopije pomoću [vodiča za samostalno hostiranje](../../docs/SELF_HOSTING.md). Docker Dostupan je i Compose: `docker compose up --build -d`.

Podržana konfiguracija uključuje jedan proces aplikacije s SQLite na lokalnom disku. Automatska publikacija i ograničenja broja zahtjeva smanjuju mogućnost zlouporabe bez potrebe za sustavom za moderiranje. Zajednička IP adresa ureda može dijeliti kvotu za publikaciju. Prije otvaranja javne instance pogledajte [ograničenja i ponašanje povezano s upravljanjem](../../docs/OPEN_CATALOG.md).

Koristite [CLI za uvoz kataloga](../../docs/CATALOG_IMPORT.md) za postojeći skup podataka nakon što provjerite njegova prava. Primjerci skupova podataka, učitavanja i sigurnosne kopije nisu uključeni u repozitorij ili slike kontejnera.

## Izborna zajednička funkcionalnost i način rada Neofab

Postavite `APP_MODE=community` na određenu vrijednost kako biste omogućili privatne projekte, ponude pružatelja usluga, biblioteku modela i Neofab Studio. Ovi se načini rada koriste vlastitim računima i dopuštenjima. Promjena načina rada čuva pohranjene podatke. Način rada kataloga ne otkriva privatnu povijest zajednice putem svoje API niti nastavlja zaustavljene CAD zadatke.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) podržava verzije proizvodnih uputa, popise materijala i ograničene deklarativne CAD s STEP/STL izvozima. CAD i umjetna inteligencija (UI) su opcionalni. Prijedlozi UI-a zahtijevaju pregled i zaseban korak pri podnošenju zahtjeva; oni ne objavljuju narudžbe ili generiraju geometriju automatski. CAM, G-kod i fizička validacija proizvodnje nisu implementirani.

## Prava na podatke i zaštita privatnosti

Licenca za MIT softver ne daje prava na uvozane poslovne podatke. Samo navođenje izvora ne ovlašćuje kopiranje podataka s Google Maps, 2GIS, Yandex Maps ili drugih izvora. Provjerite dopuštenja za pohranu, objavljivanje i ponovnu distribuciju prije korištenja skupa podataka. Pogledajte [izvor i granice provjere podataka](../../docs/DATA_PROVENANCE.md).

Podaci za kontakt koje korisnik sam objavljuje javno su dostupni; upravljački ključevi su privatni. Držite baze podataka i sigurnosne kopije izvan javno dostupnih direktorija i osigurajte kontakt osobu za ispravke i zahtjeve za uklanjanje. Pročitajte [politiku privatnosti](../../PRIVACY.md) i [politiku sigurnosti](../../SECURITY.md) prije implementacije.

## Razvoj i prijevod

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Funkcija provjerava vrste, API i tijekove rada u pregledniku, te zadane i izvorne CAD kontejnere. Testovi koriste izmišljene zapise. Točni dokazi, obuhvat i preostala ograničenja zabilježeni su u [validaciji](../../docs/VALIDATION.md) i [opsegu proizvoda](../../docs/PRODUCT.md).

Engleski dokument README služi kao izvor za potpune prevedene verzije. U [popisu jezika](../../docs/i18n/README.md) opisano je održavanje prijevoda i opseg provjere. Lokalizacija sučelja ne prevodi korisničke kartice, sadržaj projekata ni sve vanjske tehničke poruke.

## Licenciranje i doprinosi

Izvorni kod, korisničko sučelje, SVG ilustracije, dokumentacija i parametarski generator licencirani su prema [MIT](../../LICENSE). Ovisnosti zadržavaju vlastite licence i obavijesti. Korisnički modeli imaju zasebnu licencu koju su odabrali njihovi autori. Fiktivni demo profil i kratki tekst, te tri generirana demo dizajna, dostupni su pod CC0; generator ostaje MIT. Pogledajte [obavijesti trećih strana](../../THIRD_PARTY_NOTICES.md).

Ova neovisna implementacija razvija ideju projekta [3d-online.app](https://3d-online.app). Originalni proizvodni računi, tajni podaci, privatna Git povijest i korisničke datoteke nisu uključeni. Prilagođeni MIT Neofab CAD kompilator zadržava svoju [originalnu licencu i obavijest o podrijetlu](../../cad-worker/NOTICE.md).

Doprinosi mogu uključivati kod, ispravke prijevoda, poboljšanja upotrebljivosti, otvorene parametrizirane dijelove, provjere instalacije i povratne informacije iz stvarnih radionica. Počnite s [CONTRIBUTING.md](../../CONTRIBUTING.md).
