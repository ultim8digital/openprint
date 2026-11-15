# OpenPrint

**Direktori terbuka studio dan bengkel percetakan. Tiada pendaftaran atau penyelia.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · **[Bahasa Melayu](../../docs/readme/README.ms.md)** · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Cari pengeluar pada peta, semak keupayaan mereka dan hubungi mereka secara terus. Jika makmal anda tidak tersenarai, tambahkan maklumat hubungan dan perkhidmatannya: senarai akan muncul serta-merta. Simpan pautan pengurusan peribadi untuk mengedit atau memadamkan senarai anda kemudian. Katalog lalai tidak mempunyai akaun, pengesahan e-mel atau proses kelulusan.

Jalankan OpenPrint dengan Node.js 24 dan SQLite tempatan. Vercel, Supabase, penyedia e-mel, AI berbayar dan log masuk pihak ketiga tidak diperlukan. GitHub menjadi tuan rumah kepada sumber dan keluaran; sebuah laman web berkongsi yang menerima penyertaan memerlukan pelayan API yang beroperasi. [GitHub Laman](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) sahaja tidak dapat menjalankan Node.js API atau menyimpan perubahan pelawat.

## Ciri-ciri katalog

- Cari mengikut nama, bandar dan teknologi. Peta tersebut merangkumi lokasi yang sepadan tanpa mengira pengaturcaraan halaman senarai.
- Terbitkan tanpa membuat akaun. Pilih titik pada peta atau masukkan koordinat; senarai tanpa koordinat tetap boleh dicari.
- Edit atau padam satu entri bersama pautan peribadinya. Semakan versi melindungi daripada pengeditan yang bercanggah dalam tab yang berbeza.
- Cari studio yang sedia ada sebelum menerbitkan. Nama, bandar dan alamat yang tepat dan sama akan ditolak secara automatik.
- Import katalog dengan menyatakan sumbernya. Operator tidak boleh mengubah kandungan yang telah diterbitkan sendiri.
- Lihat OpenStreetMap petak tanpa API kunci. Petak dimuatkan apabila peta dipaparkan, termasuk halaman utama lalai.
- Pilih bahasa antarmuka daripada menu bahasa. Baca keseluruhan fail README dalam bahasa anda melalui indeks bahasa di atas.

Penerbitan tidak mengesahkan kepemilikan perniagaan atau kualiti perkhidmatan. Sahkan peralatan, keupayaan dan syarat dengan studio. Sesiapa sahaja yang memiliki pautan pengurusan peribadi boleh mengawal senarai tersebut. Pastikan ia kekal peribadi; tiada pilihan untuk memulihkan emel. Baca [panduan penerbitan sendiri](../../docs/OPEN_CATALOG.md).

## Jalankan contoh anda sendiri

Pasang Node.js 24, klon repositori ini dan jalankan:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. `APP_MODE=catalog` lalai tidak memerlukan persediaan pentadbir atau pengguna. Konfigurasikan `APP_URL`, HTTPS dan sandaran menggunakan [panduan pengendalian sendiri](../../docs/SELF_HOSTING.md). Docker Compose juga tersedia: `docker compose up --build -d`.

Penyebaran yang disokong ialah satu proses aplikasi dengan SQLite pada cakera setempat. Penerbitan automatik dan kuota permintaan mengehadkan penyalahgunaan tanpa keperluan untuk barisan penyederhanaan. IP pejabat yang dikongsi boleh berkongsi kuota penerbitan. Lihat [had dan tingkah laku pautan pengurusan](../../docs/OPEN_CATALOG.md) sebelum membuka contoh awam.

Gunakan [antara muka baris perintah import katalog](../../docs/CATALOG_IMPORT.md) untuk set data yang sedia ada selepas menyemak haknya. Set data contoh, muat naik dan sandaran tidak disertakan dalam repositori atau imej bekas.

## Pilihan untuk komuniti dan mod Neofab

Tetapkan `APP_MODE=community` secara khusus untuk mengaktifkan projek peribadi, sebut harga pembekal, perpustakaan model dan Neofab Studio. Alur kerja ini menggunakan akaun dan kebenaran mereka sendiri. Menukar mod akan mengekalkan data yang disimpan. Mod katalog tidak mendedahkan sejarah komuniti peribadi melalui API atau menyambung semula CAD kerja yang tertunda.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) menyokong dokumen ringkasan pembuatan berversi, senarai bahan dan CAD deklaratif terhad dengan eksport STEP/STL. CAD dan AI adalah pilihan. Cadangan AI memerlukan semakan dan langkah permohonan yang berasingan; ia tidak menerbitkan pesanan atau membina geometri secara automatik. CAM, kod G dan pengesahan pembuatan fizikal tidak dilaksanakan.

## Hak dan privasi data

Lesen perisian MIT tidak memberikan hak untuk rekod perniagaan yang diimport. Pengakuan sahaja tidak membenarkan penyalinan data daripada Google Maps, 2GIS, Yandex Maps atau sumber lain. Pastikan kebenaran untuk penyimpanan, penerbitan dan pengedaran semula sebelum menggunakan set data. Lihat [asal usul data dan sempadan semakan](../../docs/DATA_PROVENANCE.md).

Maklumat perhubungan yang diterbitkan sendiri adalah terbuka kepada umum; kunci pengurusan adalah sulit. Simpan pangkalan data dan sandaran di luar direktori yang boleh diakses oleh umum, dan sediakan maklumat perhubungan untuk permintaan pembetulan dan pengalihan. Baca [privasi](../../PRIVACY.md) dan [keselamatan](../../SECURITY.md) sebelum pelaksanaan.

## Pembangunan dan terjemahan

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Tindakan menyemak jenis, API dan alur kerja penyemak imbas, serta bekas CAD lalai dan asli. Ujian menggunakan rekod khayalan. Bukti tepat, liputan dan had yang masih ada direkodkan dalam [pengesahan](../../docs/VALIDATION.md) dan [skop produk](../../docs/PRODUCT.md).

Dokumen README dalam bahasa Inggeris ialah rujukan untuk semua edisi terjemahan. [Indeks bahasa](../../docs/i18n/README.md) mendokumentasikan had penyelenggaraan dan semakan terjemahan. Penyesuaian antara muka tidak menerjemahkan senarai yang dibuat oleh pengguna, kandungan projek atau setiap diagnostik teknikal luaran.

## Pelesenan dan sumbangan

Sumber asal, UI, SVG ilustrasi, dokumentasi dan penjana parametrik adalah [dilesenkan](../../LICENSE) di bawah MIT. Kebergantungan mengekalkan lesen dan notisnya sendiri. Model pengguna mempunyai lesen berasingan yang dipilih oleh pengarangnya. Profil demo fiksyen dan teks ringkas, serta tiga reka bentuk demo yang dijana, disediakan di bawah CC0; penjana kekal MIT. Lihat [notis pihak ketiga](../../THIRD_PARTY_NOTICES.md).

Implementasi bebas ini mengembangkan idea [3d-online.app](https://3d-online.app). Akaun pengeluaran asal, kata laluan, sejarah Git peribadi dan fail pengguna tidak disertakan. Pengkompil MIT Neofab CAD yang diubah suai mengekalkan [lesen dan notis asal](../../cad-worker/NOTICE.md).

Sumbangan boleh merangkumi kod, pembetulan terjemahan, peningkatan kemudahan penggunaan, bahagian parametrik terbuka, pemeriksaan pemasangan dan maklum balas daripada bengkel sebenar. Mulakan dengan [CONTRIBUTING.md](../../CONTRIBUTING.md).
