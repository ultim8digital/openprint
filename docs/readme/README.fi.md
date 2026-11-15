# OpenPrint

**Avoin hakemisto painotaloista ja -pajoista. Ei rekisteröintiä tai moderaattoreita.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Etsi valmistaja kartalta, tarkista heidän valmiutensa ja ota heihin suoraan yhteyttä. Jos työpajasi puuttuu, lisää sen yhteystiedot ja palvelut: tiedot näkyvät heti. Tallenna yksityinen hallintalinkki, jotta voit myöhemmin muokata tai poistaa tietojasi. Oletusluettelossa ei ole käyttäjätilejä, sähköpostivahvistusta tai hyväksyntäjonoa.

Suorita OpenPrint käyttämällä Node.js 24:ää ja paikallista SQLite:a. Vercel, Supabase, sähköpostipalveluntarjoaja, maksullinen tekoäly ja kolmannen osapuolen kirjautuminen eivät ole välttämättömiä. GitHub ylläpitää lähdekoodia ja julkaisee päivityksiä; jaettu verkkosivusto, joka hyväksyy lähetettyjä sisältöjä, tarvitsee toimivan API-palvelimen. Pelkät [GitHub-sivut](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) eivät riitä Node.js API:n suorittamiseen tai kävijöiden muutosten tallentamiseen.

## Luettelon ominaisuudet

- Hae nimen, kaupungin ja teknologian perusteella. Kartalla näkyvät kaikki hakuehtoja vastaavat kohteet riippumatta listan sivutuksesta.
- Julkaise ilman käyttäjätiliä. Valitse karttapiste tai syötä koordinaatit; koordinaatit sisältämättömät ilmoitukset ovat edelleen haettavissa.
- Muokkaa tai poista yksi ilmoitus sen yksityisellä linkillä. Versioiden tarkistus estää ristiriitaiset muutokset eri välilehdissä.
- Etsi olemassa olevat studiot ennen niiden julkaisemista. Identtiset nimet, kaupungit ja osoitteet hylätään automaattisesti.
- Tuo luettelo, jossa on mainittu lähde. Käyttäjän tuomat luettelot eivät voi korvata itse julkaistuja tietoja.
- Näytä OpenStreetMap ruutua ilman API-avainta. Ruudut latautuvat, kun kartta näytetään, mukaan lukien oletusaloitussivu.
- Valitse käyttöliittymän kieli kielivalikosta. Lue koko README-tiedosto omalla kielelläsi yllä olevan kieliluettelon kautta.

Julkaisu ei vahvista yrityksen omistajuutta tai palvelun laatua. Varmista studiolta laitteet, valmiudet ja ehdot. Kuka tahansa, jolla on yksityinen hallintalinkki, voi hallita kyseistä ilmoitusta. Pidä se yksityisenä; sähköpostiosoitetta ei voi palauttaa. Lue [itsepalvelujulkaisun opas](../../docs/OPEN_CATALOG.md).

## Käynnistä oma asennuksesi

Asenna Node.js 24, kloonaa tämä arkisto ja suorita:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Oletusasetukset `APP_MODE=catalog` eivät vaadi järjestelmänvalvojan tai käyttäjän määrityksiä. Määritä `APP_URL`, HTTPS ja varmuuskopiot käyttämällä [itsehallintaoppaan](../../docs/SELF_HOSTING.md) ohjeita. Docker Compose on myös käytettävissä: `docker compose up --build -d`.

Tuettu käyttöönotto on yksi sovellusprosessi, jossa on SQLite paikallisella kiintolevyllä. Automaattinen julkaisutoiminto ja pyyntökiintiöt rajoittavat väärinkäyttöä ilman erillistä valvontajonoa. Jaettu toimiston IP-osoite voi jakaa julkaisukiintiön. Katso [kiintiöiden ja hallintalinkin toiminta](../../docs/OPEN_CATALOG.md) ennen julkisen instanssin avaamista.

Käytä [luettelon tuontityökalua](../../docs/CATALOG_IMPORT.md) olemassa olevan tietojoukon kanssa sen käyttöoikeudet tarkistettuasi. Esimerkkitietojoukot, lataukset ja varmuuskopiot eivät sisälly arkistoon tai konttikuviin.

## Valinnainen yhteisö- ja Neofab-tila

Aseta `APP_MODE=community` nimenomaisesti, jotta yksityiset projektit, palveluntarjoajien tarjoukset, mallikirjasto ja Neofab Studio voidaan ottaa käyttöön. Nämä työnkulut käyttävät omia tilejään ja käyttöoikeuksiaan. Tilan vaihtaminen säilyttää tallennetun datan. Luettelotilassa yksityinen yhteisön historia ei ole näkyvissä sen API kautta, eikä se jatka keskeytettyjä CAD töitä.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) tukee versioituja tuotantovaatimuksia, materiaalien luetteloita ja rajattua deklaratiivista CAD-muotoa, josta voidaan viedä STEP/STL-tiedostoja. CAD ja tekoäly ovat valinnaisia. Tekoälypohjaiset ehdotukset vaativat tarkastuksen ja erillisen käyttöönoton; ne eivät julkaise tilauksia tai luo geometriaa automaattisesti. CAM, G-koodi ja tuotteen fyysisen toteutettavuuden tarkistus eivät ole toteutettuina.

## Tietojen käyttöoikeudet ja yksityisyys

MIT-ohjelmistolisenssi ei anna oikeuksia tuotuihin liiketoimintatietoihin. Pelkkä lähdeviittaus ei oikeuta tietojen kopiointiin Google Mapsista, 2GIS:stä, Yandex Mapsista tai muista lähteistä. Tarkista käyttöoikeudet tietojen tallentamiseen, julkaisemiseen ja uudelleenjakeluun ennen tietokokonaisuuden käyttöä. Katso [tietojen alkuperän ja tarkastuksen rajat](../../docs/DATA_PROVENANCE.md).

Itse julkaistut yhteystiedot ovat julkisia; hallintatunnukset ovat yksityisiä. Pidä tietokannat ja varmuuskopiot erillään julkisesti saatavilla olevista hakemistoista ja tarjoa yhteyshenkilö, johon voi ottaa yhteyttä korjaus- ja poistopyyntöjä varten. Lue [tietosuojakäytäntö](../../PRIVACY.md) ja [tietoturvakäytäntö](../../SECURITY.md) ennen käyttöönottoa.

## Kehitys ja kääntäminen

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Actions tarkistaa tyypit, API- ja selaintyönkulut sekä oletuskontin ja natiivin CAD-kontin. Testeissä käytetään kuvitteellisia tietoja. Tarkka näyttö, testauksen kattavuus ja jäljellä olevat rajoitukset on kirjattu [validointiin](../../docs/VALIDATION.md) ja [tuotteen laajuuteen](../../docs/PRODUCT.md).

Englanninkielinen README-tiedosto on ensisijainen lähde, jota käytetään täydellisten käännettyjen versioiden luomiseen. [Kieliluettelo](../../docs/i18n/README.md) sisältää tietoa käännösten ylläpidosta ja tarkistusprosesseista. Käyttöliittymän lokalisointi ei käännä käyttäjien luomia listauksia, projektin sisältöä tai kaikkia ulkoisia teknisiä vianmääritystietoja.

## Lisenssit ja osallistumismahdollisuudet

Alkuperäinen lähdekoodi, käyttöliittymä, SVG kuvitukset, dokumentaatio ja parametrinen generaattori on [MIT lisensoitu](../../LICENSE). Riippuvuuksilla on omat lisenssinsä ja käyttöehdot. Käyttäjien malleilla on erillinen lisenssi, jonka niiden tekijät ovat valinneet. Kuvitteellinen esittelyprofiili ja lyhyt teksti sekä kolme luotua esittelymallia on julkaistu CC0 -lisenssillä; generaattori pysyy MIT -lisenssin alaisena. Katso [kolmansien osapuolten ilmoitukset](../../THIRD_PARTY_NOTICES.md).

Tämä itsenäinen toteutus kehittää [3d-online.app](https://3d-online.app) -konseptia. Alkuperäisiä tuotantotilejä, salaisuuksia, yksityistä Git-historiaa ja käyttäjätiedostoja ei sisällytetä. Muokattu MIT Neofab CAD -kääntäjä säilyttää [alkuperäisen lisenssinsä ja alkuperämerkinnän](../../cad-worker/NOTICE.md).

Osallistumiset voivat sisältää koodia, käännösten korjauksia, käytettävyyden parannuksia, avoimia parametrisiä osia, asennuksen tarkistuksia ja palautetta todellisista työpajoista. Aloita kohdasta [CONTRIBUTING.md](../../CONTRIBUTING.md).
