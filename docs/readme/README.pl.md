# OpenPrint

**Zaprojektuj część i zamów ją w warsztacie należącym do otwartej sieci.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · **[Polski](../../docs/readme/README.pl.md)** · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Znajdź warsztat na mapie, sprawdź jego możliwości i skontaktuj się z nim bezpośrednio. Jeśli Twój warsztat nie jest na liście, dodaj jego dane kontaktowe i informacje o oferowanych usługach: wpis pojawi się natychmiast. Zapisz prywatny link do zarządzania, aby później edytować lub usunąć swój wpis. Domyślny katalog nie wymaga zakładania kont, potwierdzania adresu e-mail ani przechodzenia przez proces akceptacji.

Uruchom OpenPrint z Node.js w wersji 24 oraz lokalną bazą danych SQLite. Vercel, Supabase, dostawca usług pocztowych, płatne rozwiązania AI oraz logowanie przez zewnętrzne serwisy nie są wymagane. GitHub przechowuje kod źródłowy i wersje oprogramowania; do działania wspólnej strony internetowej, na której można przesyłać dane, potrzebny jest działający serwer API. Samodzielne użycie [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) nie pozwala na uruchomienie Node.js API ani na zapisywanie zmian wprowadzanych przez użytkowników.

## Funkcje katalogu

- [Sieć warsztatów](../../docs/WORKSHOP_NETWORK.md). Twoje zamówienie i plik zostaną zapisane w węźle wybranego warsztatu.
- Wyszukuj według nazwy, miasta i technologii. Na mapie wyświetlane są pasujące lokalizacje, niezależnie od numeracji stron w liście.
- Opublikuj bez zakładania konta. Wybierz punkt na mapie lub wprowadź współrzędne; wpisy bez współrzędnych pozostają dostępne w wynikach wyszukiwania.
- Edytuj lub usuń jedną pozycję wraz z jej prywatnym linkiem. Sprawdzanie wersji chroni przed konfliktowymi zmianami w różnych zakładkach.
- Przed opublikowaniem sprawdź, czy dane studio już istnieje. Automatycznie odrzucane są wpisy o identycznej nazwie, mieście i adresie.
- Zaimportuj katalog z informacją o źródle. Operatorzy nie mogą nadpisywać wpisów dodanych przez samych użytkowników.
- Wyświetl OpenStreetMap kafelki bez użycia API klucza. Kafelki są ładowane podczas wyświetlania mapy, w tym domyślnej strony startowej.
- Wybierz język interfejsu z menu języków. Zapoznaj się z pełną wersją pliku README w swoim języku, korzystając ze znajdującego się powyżej indeksu języków.

Publikacja nie potwierdza własności firmy ani jakości świadczonych usług. Należy sprawdzić dostępne urządzenia, możliwości i warunki współpracy bezpośrednio w studiu. Każda osoba posiadająca prywatny link do zarządzania może kontrolować zawartość wpisu. Należy zachować go w tajemnicy; nie ma możliwości odzyskania dostępu przez e-mail. Zapoznaj się z [instrukcją samodzielnego dodawania wpisów](../../docs/OPEN_CATALOG.md).

## Uruchom własną instancję

Zainstaluj Node.js 24, sklonuj to repozytorium i uruchom:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Domyślna `APP_MODE=catalog` nie wymaga konfiguracji przez administratora ani użytkownika. Skonfiguruj `APP_URL`, HTTPS i ustawienia tworzenia kopii zapasowych, korzystając z [instrukcji dotyczącej samodzielnego hostingu](../../docs/SELF_HOSTING.md). Docker Dostępna jest również funkcja Compose: `docker compose up --build -d`.

Obsługiwana konfiguracja to jeden proces aplikacji z SQLite na lokalnym dysku. Automatyczna publikacja i limity zapytań ograniczają nadużycia bez konieczności stosowania kolejki moderacji. Wspólny adres IP biura może korzystać ze wspólnego limitu publikacji. Przed uruchomieniem publicznej instancji zapoznaj się z informacjami dotyczącymi [limitów i zasad zarządzania](../../docs/OPEN_CATALOG.md).

Użyj narzędzia [interfejsu wiersza poleceń do importu katalogu](../../docs/CATALOG_IMPORT.md) dla istniejącego zbioru danych po sprawdzeniu praw do niego. Zbiory danych instancji, pliki przesłane i kopie zapasowe nie są zawarte w repozytorium ani obrazach kontenerów.

## Opcjonalny tryb społecznościowy i tryb Neofab

Ustaw `APP_MODE=community` na wartość, aby włączyć prywatne projekty, oferty dostawców, bibliotekę modeli i Neofab Studio. W tych procesach wykorzystywane są oddzielne konta i uprawnienia. Zmiana trybów zachowuje zapisane dane. Tryb katalogowy nie udostępnia prywatnej historii społeczności poprzez API ani nie wznawia przerwanych CAD zadań.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) obsługuje wersjonowane specyfikacje produkcji, listy materiałów oraz ograniczone deklaratywne CAD z eksportem do STEP/STL. CAD i sztuczna inteligencja są opcjonalne. Propozycje generowane przez sztuczną inteligencję wymagają weryfikacji i oddzielnego etapu zatwierdzania; nie powodują automatycznego publikowania zamówień ani generowania geometrii. CAM, kod G oraz fizyczna weryfikacja procesu produkcji nie są zaimplementowane.

## Prawa do danych i ochrona prywatności

Licencja MIT nie przyznaje praw do wykorzystywania zaimportowanych danych biznesowych. Samo wskazanie źródła nie upoważnia do kopiowania danych z Google Maps, 2GIS, Yandex Maps lub innych źródeł. Przed użyciem zbioru danych należy sprawdzić uprawnienia dotyczące przechowywania, publikacji i redystrybucji. Więcej informacji można znaleźć w sekcji [pochodzenie danych i zakres kontroli](../../docs/DATA_PROVENANCE.md).

Samodzielnie opublikowane dane kontaktowe są dostępne publicznie, natomiast klucze administracyjne są prywatne. Przechowuj bazy danych i kopie zapasowe poza katalogami dostępnymi publicznie i udostępnij dane kontaktowe do zgłaszania poprawek i wniosków o usunięcie danych. Przed wdrożeniem zapoznaj się z informacjami dotyczącymi [prywatności](../../PRIVACY.md) i [bezpieczeństwa](../../SECURITY.md).

## Rozwój i tłumaczenie

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Funkcja sprawdza typy, API oraz przepływy pracy w przeglądarce, a także domyślne i natywne CAD kontenery. Testy wykorzystują fikcyjne dane. Dokładne dowody, zakres testów i pozostałe limity są rejestrowane w sekcji [walidacja](../../docs/VALIDATION.md) i [zakres produktu](../../docs/PRODUCT.md).

Angielska wersja pliku README jest wzorcem dla pełnych, przetłumaczonych wersji. W [indeksie języków](../../docs/i18n/README.md) znajdują się informacje dotyczące zasad utrzymania i zakresu weryfikacji tłumaczeń. Lokalizacja interfejsu nie obejmuje tłumaczenia treści dodawanych przez użytkowników, treści projektów ani wszystkich zewnętrznych danych diagnostycznych.

## Licencjonowanie i możliwość wnoszenia wkładu

Oryginalny kod źródłowy, interfejs użytkownika, SVG ilustracje, dokumentacja i generator parametryczny są objęte [licencją MIT](../../LICENSE). Zależności zachowują własne licencje i informacje o nich. Modele użytkowników mają oddzielną licencję wybraną przez ich autorów. Fikcyjny profil demonstracyjny i krótki tekst, a także trzy wygenerowane projekty demonstracyjne, są udostępnione na licencji CC0; generator pozostaje na licencji MIT. Zobacz [informacje o licencjach firm trzecich](../../THIRD_PARTY_NOTICES.md).

Ta niezależna implementacja rozwija koncepcję [3d-online.app](https://3d-online.app). Oryginalne konta produkcyjne, dane uwierzytelniające, prywatna historia Git i pliki użytkowników nie są uwzględnione. Zmodyfikowany kompilator MIT Neofab CAD zachowuje [oryginalną licencję i informację o pochodzeniu](../../cad-worker/NOTICE.md).

Wkład może obejmować kod, poprawki do tłumaczeń, ulepszenia w zakresie użyteczności, otwarte, parametryczne modele, testy instalacji oraz opinie od rzeczywistych warsztatów. Zacznij od [CONTRIBUTING.md](../../CONTRIBUTING.md).
