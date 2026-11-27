# OpenPrint

**Rancang sebuah komponen dan pesan pembuatannya dari bengkel di jaringan terbuka.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · **[Bahasa Indonesia](../../docs/readme/README.id.md)** · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Temukan studio manufaktur di peta, periksa kemampuan mereka, dan hubungi mereka secara langsung. Jika bengkel Anda belum terdaftar, tambahkan informasi kontak dan layanan yang tersedia: daftar tersebut akan segera muncul. Simpan tautan manajemen pribadi untuk mengedit atau menghapus daftar Anda nanti. Katalog bawaan tidak memiliki akun, konfirmasi email, atau antrean persetujuan.

Jalankan OpenPrint dengan Node.js 24 dan SQLite lokal. Vercel, Supabase, penyedia email, AI berbayar, dan login pihak ketiga tidak diperlukan. GitHub menghosting kode sumber dan rilis; situs web bersama yang menerima pengiriman membutuhkan server API yang aktif. [GitHub Halaman](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) saja tidak dapat menjalankan Node.js API atau menyimpan perubahan pengunjung.

## Fitur katalog

- [Jaringan bengkel](../../docs/WORKSHOP_NETWORK.md). Pesanan dan berkas Anda akan disimpan di simpul bengkel yang dipilih.
- Cari berdasarkan nama, kota, dan teknologi. Peta mencakup lokasi yang sesuai, terlepas dari penomoran halaman daftar.
- Terbitkan tanpa membuat akun. Pilih titik di peta atau masukkan koordinat; daftar tanpa koordinat tetap dapat dicari.
- Edit atau hapus satu daftar beserta tautan pribadinya. Pemeriksaan versi melindungi dari perubahan yang saling bertentangan di tab yang berbeda.
- Temukan studio yang sudah ada sebelum memublikasikan. Duplikasi nama, kota, dan alamat yang persis sama akan ditolak secara otomatis.
- Impor katalog dengan menyertakan sumbernya. Operator tidak dapat menimpa daftar yang telah diterbitkan sendiri.
- Lihat OpenStreetMap ubin tanpa kunci API. Ubin akan dimuat saat peta ditampilkan, termasuk halaman utama bawaan.
- Pilih bahasa antarmuka dari menu bahasa. Baca seluruh dokumen README dalam bahasa Anda melalui indeks bahasa di atas.

Publikasi tidak memverifikasi kepemilikan bisnis atau kualitas layanan. Konfirmasikan peralatan, kemampuan, dan ketentuan dengan studio. Siapa pun yang memiliki tautan manajemen pribadi dapat mengontrol daftar tersebut. Jaga kerahasiaannya; tidak ada pemulihan email. Baca [panduan publikasi mandiri](../../docs/OPEN_CATALOG.md).

## Jalankan instans Anda sendiri

Instal Node.js 24, klon repositori ini, dan jalankan:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Pengaturan standar `APP_MODE=catalog` tidak memerlukan pengaturan administrator atau pengguna. Konfigurasikan `APP_URL`, HTTPS, dan cadangan menggunakan [panduan penyediaan mandiri](../../docs/SELF_HOSTING.md). Docker Compose juga tersedia: `docker compose up --build -d`.

Penerapan yang didukung adalah satu proses aplikasi dengan SQLite pada disk lokal. Publikasi otomatis dan kuota permintaan membatasi penyalahgunaan tanpa antrean moderasi. IP kantor bersama dapat berbagi kuota publikasi. Lihat [batasan dan perilaku tautan manajemen](../../docs/OPEN_CATALOG.md) sebelum membuka instans publik.

Gunakan [antarmuka baris perintah impor katalog](../../docs/CATALOG_IMPORT.md) untuk kumpulan data yang sudah ada setelah memeriksa hak aksesnya. Kumpulan data instans, unggahan, dan cadangan tidak termasuk dalam repositori atau citra kontainer.

## Mode komunitas opsional dan Neofab

Atur `APP_MODE=community` secara eksplisit untuk mengaktifkan proyek pribadi, penawaran harga dari penyedia, perpustakaan model, dan Neofab Studio. Alur kerja ini menggunakan akun dan izinnya sendiri. Mengganti mode akan mempertahankan data yang disimpan. Mode katalog tidak menampilkan riwayat komunitas pribadi melalui API-nya atau melanjutkan pekerjaan yang tertunda CAD.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) mendukung dokumen spesifikasi produksi, daftar bahan, dan deklarasi CAD yang terstruktur dengan ekspor STEP/STL. CAD dan AI bersifat opsional. Usulan AI memerlukan peninjauan dan langkah aplikasi terpisah; usulan tersebut tidak secara otomatis mempublikasikan pesanan atau membuat geometri. CAM, kode G, dan validasi manufaktur fisik belum diimplementasikan.

## Hak data dan privasi

Lisensi perangkat lunak MIT tidak memberikan hak atas catatan bisnis yang diimpor. Atribusi saja tidak mengizinkan penyalinan data dari Google Maps, 2GIS, Yandex Maps, atau sumber lainnya. Verifikasi izin untuk penyimpanan, publikasi, dan redistribusi sebelum menggunakan kumpulan data. Lihat [asal-usul data dan batasan peninjauan](../../docs/DATA_PROVENANCE.md).

Detail kontak yang dipublikasikan sendiri bersifat publik; kunci manajemen bersifat pribadi. Simpan basis data dan cadangan di luar direktori yang dapat diakses publik, dan sediakan kontak untuk permintaan koreksi dan penghapusan. Baca [kebijakan privasi](../../PRIVACY.md) dan [keamanan](../../SECURITY.md) sebelum penerapan.

## Pengembangan dan penerjemahan

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Tindakan memeriksa jenis, API dan alur kerja peramban, serta kontainer bawaan dan asli CAD. Pengujian menggunakan data fiktif. Bukti yang tepat, cakupan, dan batasan yang tersisa dicatat dalam [validasi](../../docs/VALIDATION.md) dan [cakupan produk](../../docs/PRODUCT.md).

Berkas README dalam bahasa Inggris adalah referensi untuk edisi terjemahan lengkap. [Indeks bahasa](../../docs/i18n/README.md) mendokumentasikan batasan pemeliharaan dan peninjauan terjemahan. Lokalisasi antarmuka tidak menerjemahkan daftar yang dibuat pengguna, konten proyek, atau setiap diagnostik teknis eksternal.

## Perizinan dan kontribusi

Sumber asli, antarmuka pengguna, SVG ilustrasi, dokumentasi, dan generator parametrik dilisensikan di bawah [MIT](../../LICENSE). Ketergantungan tetap menggunakan lisensi dan pemberitahuan masing-masing. Model pengguna memiliki lisensi terpisah yang dipilih oleh pembuatnya. Profil demo fiktif dan teks singkat, serta tiga desain demo yang dihasilkan, didedikasikan di bawah CC0; generator tetap MIT. Lihat [pemberitahuan pihak ketiga](../../THIRD_PARTY_NOTICES.md).

Implementasi independen ini mengembangkan ide dari [3d-online.app](https://3d-online.app). Akun produksi asli, kunci rahasia, riwayat Git pribadi, dan berkas pengguna tidak disertakan. Kompiler MIT Neofab CAD yang telah disesuaikan tetap mempertahankan [lisensi asli dan pemberitahuan asal](../../cad-worker/NOTICE.md).

Kontribusi dapat berupa kode, koreksi terjemahan, peningkatan kegunaan, komponen parametrik terbuka, pemeriksaan instalasi, dan umpan balik dari bengkel-bengkel yang sebenarnya. Mulailah dengan [CONTRIBUTING.md](../../CONTRIBUTING.md).
