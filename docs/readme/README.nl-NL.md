# OpenPrint

**Ontwerp een onderdeel en bestel het bij een werkplaats in het open netwerk.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · **[Nederlands](../../docs/readme/README.nl-NL.md)** · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Zoek een fabrikant op de kaart, bekijk hun mogelijkheden en neem rechtstreeks contact met hen op. Als uw werkplaats niet vermeld staat, voeg dan de contactgegevens en diensten toe: de vermelding verschijnt onmiddellijk. Bewaar de persoonlijke beheerslink om uw vermelding later te bewerken of te verwijderen. De standaardcatalogus heeft geen accounts, e-mailbevestiging of een goedkeuringsprocedure.

Voer OpenPrint uit met Node.js 24 en een lokale SQLite. Vercel, Supabase, een e-maildienst, betaalde AI en inloggen via derden zijn niet vereist. GitHub host de broncode en de releases; een gedeelde website waar inzendingen kunnen worden gedaan, heeft een actieve API-server nodig. [GitHub Pagina's](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) alleen kunnen de Node.js API niet uitvoeren of de wijzigingen van bezoekers opslaan.

## Functies van de catalogus

- [Werkplaatsennetwerk](../../docs/WORKSHOP_NETWORK.md). Je bestelling en bestand worden opgeslagen op het knooppunt van de gekozen werkplaats.
- Zoek op naam, stad en technologie. De kaart toont de bijbehorende locaties, onafhankelijk van de paginering van de lijst.
- Publiceer zonder een account aan te maken. Kies een punt op de kaart of voer coördinaten in; vermeldingen zonder coördinaten blijven doorzoekbaar.
- Bewerk of verwijder één vermelding, inclusief de bijbehorende persoonlijke link. Versiecontroles voorkomen conflicten bij gelijktijdige bewerkingen in verschillende tabbladen.
- Zoek naar bestaande studio's voordat u ze publiceert. Exacte overeenkomsten in naam, stad en adres worden automatisch geweigerd.
- Importeer een catalogus met vermelding van de bron. Door de beheerder geïmporteerde catalogi kunnen geen zelfgepubliceerde vermeldingen overschrijven.
- Bekijk OpenStreetMap tegels zonder een API sleutel. Tegels worden geladen wanneer een kaart wordt weergegeven, inclusief de standaardwelkomstpagina.
- Selecteer de gewenste taal in het taalmenu. Lees de volledige README in uw taal via de taalindex hierboven.

Publicatie houdt geen controle in op het eigendom van het bedrijf of de kwaliteit van de dienstverlening. Neem contact op met het bedrijf om de apparatuur, mogelijkheden en voorwaarden te bevestigen. Iedereen die de persoonlijke beheerslink heeft, kan deze vermelding beheren. Houd deze link privé; er is geen mogelijkheid om het e-mailadres te herstellen. Lees de [handleiding voor zelfpublicatie](../../docs/OPEN_CATALOG.md).

## Start uw eigen exemplaar

Installeer Node.js 24, kloon deze repository en voer uit:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. De standaard `APP_MODE=catalog` vereist geen configuratie door een beheerder of gebruiker. Configureer `APP_URL`, HTTPS en de back-ups met behulp van de [handleiding voor zelfhosting](../../docs/SELF_HOSTING.md). Docker Compose is ook beschikbaar: `docker compose up --build -d`.

De ondersteunde implementatie omvat één applicatieproces met SQLite op een lokale schijf. Automatische publicatie en quotums voor verzoeken beperken misbruik zonder dat een moderatiewachtrij nodig is. Een gedeeld kantoor-IP-adres kan een publicatiequotum delen. Raadpleeg [limieten en het gedrag van de beheerlink](../../docs/OPEN_CATALOG.md) voordat u een openbare instantie opent.

Gebruik de [catalogusimport-opdrachtregelinterface](../../docs/CATALOG_IMPORT.md) voor een bestaande dataset nadat u de bijbehorende rechten hebt gecontroleerd. Voorbeelddatasets, uploads en back-ups worden niet opgenomen in de repository of containerimages.

## Optionele community- en Neofab-modus

Stel `APP_MODE=community` expliciet in om privéprojecten, offertes van leveranciers, de modelbibliotheek en Neofab Studio in te schakelen. Deze workflows gebruiken hun eigen accounts en machtigingen. Door van modus te wisselen, blijven opgeslagen gegevens behouden. In de catalogusmodus worden geen privégegevens van de community weergegeven via de API, en het onderbreken van lopende CAD taken wordt voorkomen.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) ondersteunt versiebeheer van productiespecificaties, stuklijsten en afgebakende declaratieve CAD met STEP/STL-export. CAD en AI zijn optioneel. AI-voorstellen vereisen beoordeling en een aparte aanvraagprocedure; ze publiceren niet automatisch bestellingen of genereren geometrie. CAM, G-code en fysieke validatie van de productie zijn niet geïmplementeerd.

## Rechten op gegevens en privacy

De MIT softwarelicentie verleent geen rechten op geïmporteerde bedrijfsgegevens. Alleen het vermelden van de bron geeft niet het recht om gegevens te kopiëren van Google Maps, 2GIS, Yandex Maps of andere bronnen. Controleer de rechten voor opslag, publicatie en herdistributie voordat u een dataset gebruikt. Zie [gegevensherkomst en beoordelingsrichtlijnen](../../docs/DATA_PROVENANCE.md).

Zelfgepubliceerde contactgegevens zijn openbaar; beheersleutels zijn privé. Bewaar databases en back-ups buiten openbaar toegankelijke mappen en zorg voor een contactpersoon voor correcties en verzoeken om gegevens te verwijderen. Lees de informatie over [privacy](../../PRIVACY.md) en [beveiliging](../../SECURITY.md) voordat u de software implementeert.

## Ontwikkeling en vertaling

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Acties controleren typen, API en browserworkflows, en de standaard- en native CAD containers. Tests maken gebruik van fictieve gegevens. Exacte bewijzen, de omvang van de tests en de resterende limieten worden vastgelegd in [validatie](../../docs/VALIDATION.md) en [productomvang](../../docs/PRODUCT.md).

De Engelse README-tekst is de referentie voor de volledige vertaalde versies. De [taalindex](../../docs/i18n/README.md) beschrijft de procedures voor het onderhouden en beoordelen van de vertalingen. De lokalisatie van de gebruikersinterface omvat niet de vertaling van door gebruikers aangemaakte vermeldingen, projectinhoud of alle externe technische diagnostische gegevens.

## Licenties en bijdragen

De originele broncode, de gebruikersinterface, de SVG illustraties, de documentatie en de parametrische generator zijn onder een [MIT licentie](../../LICENSE) beschikbaar gesteld. Afhankelijke componenten behouden hun eigen licenties en vermeldingen. Gebruikersmodellen hebben een afzonderlijke licentie, gekozen door de auteurs. Een fictief demoprofiel en een korte tekst, en drie gegenereerde demo-ontwerpen, zijn onder CC0 beschikbaar gesteld; de generator blijft MIT. Zie [vermeldingen van derden](../../THIRD_PARTY_NOTICES.md).

Deze onafhankelijke implementatie bouwt voort op het idee van [3d-online.app](https://3d-online.app). Originele productieaccounts, geheimen, de persoonlijke Git-geschiedenis en gebruikersbestanden zijn niet inbegrepen. De aangepaste MIT Neofab CAD compiler behoudt zijn [oorspronkelijke licentie en vermelding van de herkomst](../../cad-worker/NOTICE.md).

Bijdragen kunnen bestaan uit code, correcties in de vertaling, verbeteringen aan de gebruiksvriendelijkheid, open parametrische onderdelen, installatiecontroles en feedback van echte werkplaatsen. Begin met [CONTRIBUTING.md](../../CONTRIBUTING.md).
