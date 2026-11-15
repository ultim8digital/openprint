# OpenPrint

**Nyílt adatbázis nyomdákról és műhelyekről. Nincs regisztráció vagy moderátor.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Keressen gyártót a térképen, nézze meg a képességeit, és vegye fel velük a kapcsolatot közvetlenül. Ha a műhelye nem szerepel a listában, adja hozzá a kapcsolattartási adatait és a szolgáltatásait: a bejegyzés azonnal megjelenik. Mentse el a privát kezelési linket, hogy később szerkeszthesse vagy törölhesse a bejegyzését. Az alapértelmezett katalógus nem tartalmaz felhasználói fiókokat, e-mail-meghirdetést vagy jóváhagyási folyamatot.

Futtassa a OpenPrint-et a Node.js 24-gyel és a helyi SQLite-mal. A Vercel, a Supabase (egy e-mail szolgáltató), a fizetős mesterséges intelligencia és a harmadik fél által biztosított bejelentkezés nem szükséges. A GitHub tárolja a forráskódot és teszi közzé a frissítéseket; egy közös weboldal, amely beküldéseket fogad, egy futó API szerverre van szüksége. A [GitHub Oldalak](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) önmagukban nem tudják futtatni a Node.js API-et, és nem tudják megőrizni a látogatók által végrehajtott változtatásokat.

## A katalógus funkciói

- Kereshet név, város vagy technológia alapján. A térképen a listában megjelenő találatokhoz tartozó helyszínek szerepelnek, függetlenül a lapozástól.
- Tegye közzé anélkül, hogy regisztrálnia kellene. Válasszon ki egy pontot a térképen, vagy adja meg a koordinátákat; a koordináták nélküli bejegyzések továbbra is kereshetők lesznek.
- Szerkesztheti vagy törölheti az egyik bejegyzést, beleértve a hozzá tartozó privát linket is. A verzióellenőrzés megvédi a bejegyzést az eltérő böngészőablakokban végzett, egymással ütköző szerkesztésektől.
- Keressen meglévő műhelyeket, mielőtt közzétenné az új műhely adatait. A pontosan megegyező névvel, várossal és címmel rendelkező bejegyzések automatikusan elutasításra kerülnek.
- Importáljon katalógust, feltüntetve a forrást. Az operátor által végzett import nem írja felül a felhasználó által közzétett listákat.
- Tekintse meg a OpenStreetMap csempét API kulcs nélkül. A csempék betöltődnek, amikor egy térkép megjelenik, beleértve az alapértelmezett kezdőlapot.
- Válassza ki a felület nyelvét a nyelvi menüből. Olvassa el a teljes README dokumentumot a saját nyelvén a fenti nyelvi indexen keresztül.

A közzététel nem ellenőrzi a vállalkozás tulajdonjogát vagy a szolgáltatás minőségét. Ellenőrizze a műhelyben elérhető berendezéseket, képességeket és feltételeket. Bárki, aki rendelkezik a privát kezelői linkkel, irányíthatja az adott bejegyzést. Tartsa privátban; nincs lehetőség az e-mail visszaállítására. Olvassa el a [saját közzétételre vonatkozó útmutatót](../../docs/OPEN_CATALOG.md).

## Indítsa el a saját példányát

Telepítse a Node.js verzió 24-ét, klónozza ezt a tárat, és futtassa a következő parancsot:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Nyisd meg az `http://localhost:3000`-et. Az alapértelmezett `APP_MODE=catalog`-höz nincs szükség rendszergazdai vagy felhasználói beállításra. Konfiguráld a `APP_URL`-at, a HTTPS-et és az adatmentéseket a [saját szerveren való üzemeltetés útmutatója](../../docs/SELF_HOSTING.md) segítségével. A Docker Compose szintén elérhető: `docker compose up --build -d`.

A támogatott telepítési mód egy alkalmazásfolyamat, amely a SQLite-en található egy helyi lemezen. Az automatikus közzététel és a kérésekre vonatkozó kvóták korlátozzák a visszaéléseket, anélkül, hogy moderálási sorra lenne szükség. Egy megosztott irodai IP-cím megoszthatja a közzétételi kvótát. A nyilvános példány megnyitása előtt tekintse meg a [korlátokat és a kezelési link viselkedését](../../docs/OPEN_CATALOG.md).

A meglévő adatkészlet jogainak ellenőrzése után használja a [katalógus-importálási parancssori felületet](../../docs/CATALOG_IMPORT.md). A példányadatkészletek, feltöltések és biztonsági másolatok nem tartoznak a tárolóba vagy a tárolóképekbe.

## Opcionális közösségi funkció és Neofab mód

Állítsa a `APP_MODE=community` értéket explicit módon, hogy engedélyezze a privát projekteket, a szolgáltatói árajánlatokat, a modellkönyvtárat és a Neofab Stúdiót. Ezek a munkafolyamatok saját fiókokat és jogosultságokat használnak. A módok közötti váltás megőrzi a tárolt adatokat. A katalógus mód nem teszi közzé a privát közösségi előzményeket a API segítségével, és nem folytatja a várakozó CAD feladatokat.

A [Neofab Studio](../../docs/NEOFAB_SETUP.md) támogatja a verziókezeléses gyártási specifikációkat, az alkatrészlistákat és a korlátozott deklaratív CAD formátumot, melyből STEP/STL formátumban lehet exportálni. A CAD és a mesterséges intelligencia (AI) használata opcionális. A mesterséges intelligencia által generált javaslatok felülvizsgálatra és különleges jóváhagyási eljárásra szorulnak; ezek nem teszik lehetővé a rendelések automatikus közzétételét vagy a geometriai modellek automatikus generálását. A CAM, a G-kód és a fizikai gyártási validáció funkciói jelenleg nem valósítottak meg.

## Adatokhoz fűződő jogok és adatvédelem

A MIT szoftverlicenc nem biztosít jogokat a beimportált üzleti adatokhoz. A forrásmegjelölés önmagában nem teszi lehetővé adatok másolását a Google Térképek, a 2GIS, a Yandex Térképek vagy más forrásokból. A használat előtt ellenőrizze az engedélyeket az adattárolásra, a közzétételre és az újraelosztásra. Lásd a [adatok eredetének és az ellenőrzési határok](../../docs/DATA_PROVENANCE.md) dokumentációját.

A felhasználók által megadott kapcsolattartási adatok nyilvánosak; az adminisztrációs kulcsok privátak. A nyilvánosan elérhető könyvtárakból ki kell záni az adatbázisokat és a biztonsági másolatokat, és meg kell adni egy kapcsolattartót a helyesbítésekkel és a törlési kérelmekkel kapcsolatban. A telepítés előtt olvassa el a [adatvédelmi](../../PRIVACY.md) és a [biztonsági](../../SECURITY.md) irányelveket.

## Fejlesztés és fordítás

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

A GitHub műveletek ellenőrzik a típusokat, a API böngészőben futó munkafolyamatokat, valamint az alapértelmezett és natív CAD tárolókat. A tesztek fiktív adatokat használnak. A pontos eredmények, a lefedettség és a fennmaradó korlátok a [validálás](../../docs/VALIDATION.md) és a [terméktartomány](../../docs/PRODUCT.md) dokumentációban kerülnek rögzítésre.

Az angol README a teljes fordított változatok referenciája. A [nyelvi index](../../docs/i18n/README.md) a fordítások karbantartásával és felülvizsgálatával kapcsolatos korlátokat dokumentálja. A felület lokalizálása nem fordítja a felhasználók által létrehozott listákat, a projekt tartalmát vagy minden külső, technikai jellegű információt.

## Licencelés és hozzájárulások

Az eredeti forráskód, a felhasználói felület, a SVG illusztrációk, a dokumentáció és a paraméteres generátor [a MIT licenc](../../LICENSE) alatt kerülnek közzétételre. A függőségek a saját licenceik és jogi nyilatkozataik szerint kerülnek felhasználásra. A felhasználói modellek külön, a szerzőik által kiválasztott licenccel rendelkeznek. A fiktív bemutatóprofil, a rövid szöveg és a három generált bemutatóterv a CC0 alatt kerülnek közzétételre; a generátor továbbra is MIT marad. Lásd a [harmadik fél jogi nyilatkozatait](../../THIRD_PARTY_NOTICES.md).

Ez a független implementáció továbbfejleszti a [3d-online.app](https://3d-online.app) koncepcióját. Az eredeti gyártási adatok, titkos információk, privát Git-verziótörténet és felhasználói fájlok nem szerepelnek benne. A módosított MIT Neofab CAD fordító megőrzi az [eredeti licencet és a forrásmegjelölést](../../cad-worker/NOTICE.md).

A hozzájárulások a következők lehetnek: forráskód, fordítási javítások, a használhatóság fejlesztése, nyílt, paraméteres alkatrészek, telepítési ellenőrzések és visszajelzések valós műhelyekből. Kezdje a [CONTRIBUTING.md](../../CONTRIBUTING.md) ponttal.
