# OpenPrint

**Un directori obert d’estudis i tallers d’impressió. No cal registrar-se ni hi ha moderadors.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Trobeu un taller a la mapa, consulteu les seves capacitats i poseu-vos en contacte directament amb ells. Si el vostre taller no apareix, afegiu-ne les dades de contacte i els serveis: l'anunci apareixerà immediatament. Guardeu l'enllaç de gestió privada per editar o eliminar l'anunci més endavant. El catàleg per defecte no té comptes, confirmació per correu electrònic ni cua d'aprovació.

Executa OpenPrint amb Node.js 24 i SQLite local. Vercel, Supabase, un proveïdor de correu electrònic, la IA de pagament i l’inici de sessió de tercers no són necessaris. GitHub allotja el codi font i les versions; un lloc web compartit que accepta enviaments necessita un servidor API en funcionament. [GitHub pàgines](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) per si soles no poden executar el Node.js API ni mantenir els canvis dels visitants.

## Funcionalitats del catàleg

- Cerqueu per nom, ciutat i tecnologia. El mapa inclou les ubicacions que coincideixen, independentment de la paginació de la llista.
- Publica sense crear un compte. Selecciona un punt al mapa o introdueix les coordenades; els anuncis sense coordenades continuaran sent accessibles a través de la cerca.
- Editeu o suprimiu un element de la llista juntament amb el seu enllaç privat. Les comprovacions de versió protegeixen contra edicions conflictives en diferents pestanyes.
- Busqueu estudis existents abans de publicar-los. Les coincidències exactes de nom, ciutat i adreça es rebutgen automàticament.
- Importeu un catàleg amb la indicació de la font. Les importacions realitzades per l’operador no poden substituir les publicacions realitzades per l’usuari.
- Visualitza OpenStreetMap fitxes sense una API clau. Les fitxes es carreguen quan es mostra un mapa, inclosa la pàgina d’inici predeterminada.
- Trieu l’idioma de la interfície al menú d’idiomes. Llegiu el fitxer README complet en el vostre idioma a través de l’índex d’idiomes que hi ha a dalt.

La publicació no verifica la propietat de l’empresa ni la qualitat del servei. Confirmeu l’equipament, les capacitats i les condicions amb l’estudi. Qualsevol persona que tingui l’enllaç de gestió privada pot controlar aquesta entrada. Mantingueu-lo en privat; no hi ha cap opció de recuperació per correu electrònic. Llegiu la [guia d’autopublicació](../../docs/OPEN_CATALOG.md).

## Executa la teva pròpia instància

Instal·leu Node.js 24, cloneu aquest repositori i executeu:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. La configuració per defecte `APP_MODE=catalog` no requereix cap configuració d'administrador ni d'usuari. Configureu `APP_URL`, HTTPS i les còpies de seguretat mitjançant la [guia d'autoallotjament](../../docs/SELF_HOSTING.md). Docker També hi ha disponible `docker compose up --build -d`.

La configuració admesa és un sol procés d'aplicació amb SQLite en un disc local. La publicació automàtica i les quotes de sol·licitud limiten l'ús indegut sense necessitat d'una cua de moderació. Una adreça IP d'oficina compartida pot compartir una quota de publicació. Consulteu [els límits i el comportament de l'enllaç de gestió](../../docs/OPEN_CATALOG.md) abans d'obrir una instància pública.

Utilitzeu l’[eina de línia de comandos per importar el catàleg](../../docs/CATALOG_IMPORT.md) per a un conjunt de dades existent després de comprovar-ne els drets. Els conjunts de dades d’instància, les càrregues i les còpies de seguretat no s’inclouen al repositori ni a les imatges del contenidor.

## Mode comunitari opcional i Neofab

Estableix `APP_MODE=community` explícitament per activar els projectes privats, les cotitzacions dels proveïdors, la biblioteca de models i Neofab Studio. Aquests fluxos de treball utilitzen els seus propis comptes i permisos. Canviar de mode conserva les dades emmagatzemades. El mode de catàleg no mostra l’historial privat de la comunitat a través del seu API ni repren les CAD tasques en pausa.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) admet versions de documents de disseny, llistes de materials i declaracions CAD amb exportacions STEP/STL. CAD i la IA són opcionals. Les propostes d’IA requereixen revisió i un pas d’aplicació separat; no publiquen automàticament les comandes ni creen la geometria. CAM, el codi G i la validació física de la fabricació no s’han implementat.

## Drets de dades i privacitat

La llicència del programari MIT no concedeix drets sobre els registres empresarials importats. La simple menció de la font no autoritza la còpia de dades de Google Maps, 2GIS, Yandex Maps o altres fonts. Verifiqueu els permisos per a l’emmagatzematge, la publicació i la redistribució abans d’utilitzar un conjunt de dades. Consulteu [els límits de la procedència i la revisió de les dades](../../docs/DATA_PROVENANCE.md).

Les dades de contact auto-publicades són públiques; les claus d'administració són privades. Mantingueu les bases de dades i les còpies de seguretat fora dels directoris accessibles al públic i proporcioneu una persona de contacte per a les sol·licituds de correcció i eliminació. Llegiu [la política de privacitat](../../PRIVACY.md) i [la política de seguretat](../../SECURITY.md) abans de la implementació.

## Desenvolupament i traducció

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Les accions comproven els tipus, API els fluxos de treball del navegador i els contenidors per defecte i natius. CAD Les proves utilitzen registres ficticis. Les dades exactes, la cobertura i les limitacions restants es registren a [la validació](../../docs/VALIDATION.md) i a [l'àmbit del producte](../../docs/PRODUCT.md).

El fitxer README en anglès és la referència per a les versions traduïdes completes. L'[índex d'idiomes](../../docs/i18n/README.md) documenta els límits del manteniment i la revisió de la traducció. La localització de la interfície no tradueix les llistes creades pels usuaris, el contingut del projecte ni tots els elements tècnics externs.

## Llicències i contribucions

El codi original, la interfície d’usuari, les SVG il·lustracions, la documentació i el generador paramètric estan [lliscenciats](../../LICENSE) sota MIT. Les dependències mantenen les seves pròpies llicències i avisos. Els models d’usuari tenen una llicència separada escollida pels seus autors. Un perfil de demostració fictici i un text breu, i tres dissenys de demostració generats, estan dedicats sota CC0; el generador continua sent MIT. Consulteu els [avisos de tercers](../../THIRD_PARTY_NOTICES.md).

Aquesta implementació independent desenvolupa la idea de [3d-online.app](https://3d-online.app). No s'inclouen els comptes de producció originals, els secrets, l'historial privat de Git ni els fitxers d'usuari. El compilador MIT Neofab CAD adaptat conserva la [seva llicència original i l'avís de procedència](../../cad-worker/NOTICE.md).

Les contribucions poden incloure codi, correccions de traducció, millores en la usabilitat, peces paramètriques obertes, comprovacions d’instal·lació i comentaris de tallers reals. Comenceu amb [CONTRIBUTING.md](../../CONTRIBUTING.md).
