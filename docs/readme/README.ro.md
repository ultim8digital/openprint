# OpenPrint

**Proiectează o piesă și comand-o de la un atelier din rețeaua deschisă.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · **[Română](../../docs/readme/README.ro.md)** · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Găsiți un atelier pe hartă, verificați capacitățile acestuia și contactați-l direct. Dacă atelierul dumneavoastră nu este listat, adăugați datele de contact și serviciile oferite: listarea va apărea imediat. Salvați link-ul privat de gestionare pentru a edita sau șterge listarea mai târziu. Catalogul implicit nu are conturi, confirmare prin e-mail sau o listă de așteptare pentru aprobare.

Rulează OpenPrint cu Node.js 24 și cu SQLite local. Vercel, Supabase, un furnizor de servicii de e-mail, AI plătit și autentificarea prin intermediul unor terțe părți nu sunt necesare. GitHub găzduiește codul sursă și versiunile; un site web comun, care acceptă trimiteri, necesită un server API funcțional. [GitHub Pagini](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) singure nu pot rula Node.js API sau salva modificările vizitatorilor.

## Funcționalitățile catalogului

- [Rețea de ateliere](../../docs/WORKSHOP_NETWORK.md). Comanda și fișierul vor fi stocate pe nodul atelierului ales.
- Caută după nume, oraș și tehnologie. Harta include locațiile corespunzătoare, indiferent de paginarea listei.
- Publicați fără a crea un cont. Alegeți un punct de pe hartă sau introduceți coordonatele; listările fără coordonate pot fi căutate în continuare.
- Editați sau ștergeți o înregistrare, împreună cu link-ul său privat. Verificările de versiune protejează împotriva modificărilor conflictuale în file diferite.
- Găsiți studiourile existente înainte de a le publica. Numele, orașul și adresele identice sunt respinse automat.
- Importați un catalog cu menționarea sursei. Operatorii nu pot suprascrie listările publicate de ei înșiși.
- Vizualizați OpenStreetMap elemente fără o API cheie. Elementele se încarcă atunci când este afișată o hartă, inclusiv pagina implicită de pornire.
- Alegeți limba interfeței din meniul de limbi. Citiți fișierul README complet în limba dumneavoastră, accesând indexul de limbi de mai sus.

Publicarea nu verifică proprietatea asupra afacerii sau calitatea serviciilor. Verificați echipamentele, capacitățile și condițiile direct la studio. Oricine deține link-ul privat de gestionare poate controla acea listare. Păstrați-l privat; nu există posibilitatea de recuperare prin e-mail. Citiți [ghidul de publicare independentă](../../docs/OPEN_CATALOG.md).

## Rulează propria ta instanță

Instalați Node.js 24, clonați acest depozit și executați:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Setările implicite `APP_MODE=catalog` nu necesită configurare din partea administratorului sau a utilizatorului. Configurați `APP_URL`, HTTPS și creați copii de siguranță folosind [ghidul de auto-găzduire](../../docs/SELF_HOSTING.md). Docker Compose este, de asemenea, disponibil: `docker compose up --build -d`.

Implementarea acceptată presupune un singur proces de aplicație cu SQLite pe un disc local. Publicarea automată și cotele de cereri limitează abuzurile, fără a fi necesară o coadă de moderare. O adresă IP partajată pentru birou poate partaja o cotă de publicare. Consultați [limitele și comportamentul legăturii de gestionare](../../docs/OPEN_CATALOG.md) înainte de a deschide o instanță publică.

Utilizați interfața în linie de comandă [pentru importul catalogului](../../docs/CATALOG_IMPORT.md) pentru un set de date existent, după ce ați verificat drepturile aferente. Seturile de date de instanță, încărcările și copiile de rezervă nu sunt incluse în depozit sau în imaginile container.

## Opțional: comunitate și modul Neofab

Setează `APP_MODE=community` în mod explicit pentru a permite proiectele private, cotațiile furnizorilor, biblioteca de modele și Neofab Studio. Aceste fluxuri de lucru utilizează propriile conturi și permisiuni. Schimbarea modurilor păstrează datele stocate. Modul catalog nu expune istoricul privat al comunității prin intermediul API și nu reia lucrările puse în așteptare CAD.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) acceptă documente de specificații de producție cu versiuni, liste de materiale și declarații CAD limitate, cu exporturi în STEP/STL. CAD și inteligența artificială sunt opționale. Propunerile bazate pe inteligență artificială necesită o analiză și un pas de aplicare separat; acestea nu publică automat comenzile sau nu generează geometrii. CAM, codul G și validarea fizică a producției nu sunt implementate.

## Drepturile asupra datelor și confidențialitatea

Licența software MIT nu acordă drepturi asupra datelor comerciale importate. Simplul fapt că se menționează sursa nu autorizează copierea datelor din Google Maps, 2GIS, Yandex Maps sau alte surse. Verificați permisiunile pentru stocare, publicare și redistribuire înainte de a utiliza un set de date. Consultați [limitele privind proveniența și verificarea datelor](../../docs/DATA_PROVENANCE.md).

Informațiile de contact publicate de utilizator sunt accesibile publicului; cheile de administrare sunt confidențiale. Păstrați bazele de date și copiile de rezervă în afara directoarelor accesibile publicului și oferiți o modalitate de contact pentru solicitări de corectare și eliminare. Citiți [politica de confidențialitate](../../PRIVACY.md) și [politica de securitate](../../SECURITY.md) înainte de implementare.

## Dezvoltare și traducere

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Verifică tipurile de acțiuni, API și fluxurile de lucru ale browserului, precum și containerele implicite și native CAD. Testele utilizează înregistrări fictive. Dovezile exacte, acoperirea și limitele rămase sunt înregistrate în [validare](../../docs/VALIDATION.md) și [domeniul de aplicare al produsului](../../docs/PRODUCT.md).

Fișierul README în limba engleză reprezintă referința pentru toate versiunile traduse. [Indexul de limbi](../../docs/i18n/README.md) documentează limitele privind întreținerea și revizuirea traducerilor. Localizarea interfeței nu traduce listările create de utilizatori, conținutul proiectelor sau fiecare element tehnic extern de diagnosticare.

## Licențiere și contribuții

Sursa originală, interfața utilizator, SVG ilustrațiile, documentația și generatorul parametric sunt [licențiate](../../LICENSE) conform MIT. Dependențele își păstrează propriile licențe și notificări. Modelele utilizatorilor au o licență separată, aleasă de autorii lor. Profilul demonstrativ fictiv și textul scurt, precum și cele trei modele demonstrative generate, sunt oferite sub licența CC0; generatorul rămâne MIT. Consultați [notificările terților](../../THIRD_PARTY_NOTICES.md).

Această implementare independentă dezvoltă ideea [3d-online.app](https://3d-online.app). Conturile originale de producție, secretele, istoricul privat Git și fișierele utilizatorilor nu sunt incluse. Compilatorul adaptat MIT Neofab CAD își păstrează [licența originală și mențiunea privind proveniența](../../cad-worker/NOTICE.md).

Contribuțiile pot include cod, corecturi de traducere, îmbunătățiri ale gradului de utilizare, modele parametrice deschise, verificări ale instalării și feedback de la ateliere reale. Începeți cu [CONTRIBUTING.md](../../CONTRIBUTING.md).
