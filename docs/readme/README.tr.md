# OpenPrint

**Baskı stüdyoları ve atölyelerden oluşan açık bir dizin. Kayıt veya moderatör gerektirmez.**

[Languages / Языки](../../docs/i18n/README.md) · [English](../../README.md) · [Русский](../../docs/readme/README.ru.md)

Harita üzerinde bir üretim stüdyosu bulun, yeteneklerini inceleyin ve doğrudan iletişime geçin. Atölyeniz listede yoksa, iletişim bilgilerini ve sunduğu hizmetleri ekleyin: liste anında güncellenecektir. Daha sonra listenizi düzenlemek veya silmek için özel yönetim bağlantısını kaydedin. Varsayılan katalogda herhangi bir hesap, e-posta onayı veya onay kuyruğu bulunmamaktadır.

OpenPrint'i Node.js 24 ve yerel SQLite ile çalıştırın. Vercel, Supabase (bir e-posta sağlayıcısı), ücretli yapay zeka ve üçüncü taraf girişleri gerekli değildir. GitHub, kaynak kodunu ve yayınları barındırır; gönderi kabul eden ortak bir web sitesi için çalışan bir API sunucusu gerekir. Yalnızca [GitHub Sayfaları](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) Node.js API'i çalıştıramaz veya ziyaretçi değişikliklerini kaydedemez.

## Katalog özellikleri

- Ada göre, şehre göre ve teknolojiye göre arama yapın. Harita, liste sayfalama özelliğinden bağımsız olarak eşleşen konumları içerir.
- Hesap oluşturmadan yayınlayın. Bir harita noktası seçin veya koordinatları girin; koordinatsız listeler aranabilir kalır.
- Özel bağlantısıyla birlikte bir listeyi düzenleyin veya silin. Sürüm kontrolleri, farklı sekmelerde yapılan çakışan düzenlemelere karşı koruma sağlar.
- Yayınlamadan önce mevcut stüdyoları bulun. Aynı ada, şehre ve adrese sahip kayıtlar otomatik olarak reddedilir.
- Kaynak belirtilerek bir katalog içe aktarın. Operatörün içe aktarması, kendi yayınladığı listeleri üzerine yazamaz.
- OpenStreetMap sayıda haritayı API anahtarı olmadan görüntüleyin. Haritalar görüntülendiğinde, varsayılan açılış sayfası da dahil olmak üzere harita parçaları yüklenir.
- Dil menüsünden arayüz dilini seçin. Yukarıdaki dil dizini aracılığıyla kendi dilinizdeki tam README dosyasını okuyun.

Yayımlama, işletmenin sahipliğini veya hizmet kalitesini doğrulamaz. Ekipmanı, olanakları ve koşulları stüdyoyla teyit edin. Özel yönetim bağlantısına sahip herkes bu kaydı yönetebilir. Bağlantıyı gizli tutun; erişim e-posta yoluyla kurtarılamaz. [Kendi kaydınızı yayımlama kılavuzunu](../../docs/OPEN_CATALOG.md) okuyun.

## Kendi örneğinizi çalıştırın

Node.js 24'ü yükleyin, bu depoyu klonlayın ve şunu çalıştırın:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Varsayılan `APP_MODE=catalog` için yönetici veya kullanıcı kurulumuna gerek yoktur. `APP_URL`, HTTPS ve yedeklemeleri [kendi kendine barındırma kılavuzu](../../docs/SELF_HOSTING.md) kullanarak yapılandırın. Docker Compose da kullanılabilir: `docker compose up --build -d`.

Desteklenen dağıtım, yerel bir diskte SQLite ile birlikte çalışan tek bir uygulama işlemidir. Otomatik yayınlama ve istek kotaları, bir denetim kuyruğu olmadan kötüye kullanımı sınırlar. Paylaşımlı bir ofis IP adresi, bir yayınlama kotasını paylaşabilir. Genel bir örnek açmadan önce [sınırlar ve yönetim bağlantısı davranışı](../../docs/OPEN_CATALOG.md) bölümüne bakın.

Haklarını kontrol ettikten sonra, mevcut bir veri kümesi için [katalog içe aktarma komut satırı arayüzünü](../../docs/CATALOG_IMPORT.md) kullanın. Örnek veri kümeleri, yüklemeler ve yedeklemeler, depoya veya kapsayıcı görüntülerine dahil edilmez.

## İsteğe bağlı topluluk ve Neofab modu

Özel projeleri, sağlayıcı tekliflerini, model kitaplığını ve Neofab Studio'yu etkinleştirmek için `APP_MODE=community` değerini açıkça ayarlayın. Bu iş akışları kendi hesaplarını ve izinlerini kullanır. Modlar arasında geçiş yapmak, kaydedilmiş verileri korur. Katalog modu, API aracılığıyla özel topluluk geçmişini açığa çıkarmaz veya bekleyen CAD işi devam ettirmez.

[Neofab Studio](../../docs/NEOFAB_SETUP.md), sürümlendirilmiş üretim talimatlarını, malzeme listelerini ve STEP/STL dışa aktarma özellikleriyle sınırlı, bildirimsel CAD'ü destekler. CAD ve yapay zeka isteğe bağlıdır. Yapay zeka önerileri için inceleme ve ayrı bir başvuru adımı gereklidir; bunlar otomatik olarak siparişleri yayınlamaz veya geometrileri oluşturmaz. CAM, G-kodu ve fiziksel üretim doğrulaması henüz uygulanmamıştır.

## Veri hakları ve gizlilik

MIT yazılım lisansı, içe aktarılan iş kayıtları için herhangi bir hak sağlamaz. Sadece kaynak belirtmek, Google Haritalar, 2GIS, Yandex Haritalar veya diğer kaynaklardan veri kopyalamaya izin vermez. Bir veri kümesini kullanmadan önce depolama, yayınlama ve yeniden dağıtım için izinleri doğrulayın. [veri kaynağı ve inceleme sınırları](../../docs/DATA_PROVENANCE.md) bölümüne bakın.

Kullanıcı tarafından eklenen iletişim bilgileri herkese açıktır; yönetim anahtarları ise gizlidir. Veritabanlarını ve yedeklemeleri, genel olarak erişilebilen dizinlerin dışında tutun ve düzeltme ve silme talepleri için bir iletişim kişisi sağlayın. Dağıtımdan önce [gizlilik](../../PRIVACY.md) ve [güvenlik](../../SECURITY.md) bilgilerini okuyun.

## Geliştirme ve çeviri

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub İşlemler, türleri, API ve tarayıcı iş akışlarını ve varsayılan ve yerel CAD kapsayıcıları kontrol eder. Testler, kurgusal kayıtlar kullanır. Kesin kanıtlar, kapsam ve kalan sınırlar [doğrulama](../../docs/VALIDATION.md) ve [ürün kapsamı](../../docs/PRODUCT.md) içinde kaydedilir.

İngilizce README dosyası, tam çevrilmiş sürümler için referans niteliğindedir. [Dil dizini](../../docs/i18n/README.md), çeviri bakımını ve gözden geçirme sınırlarını belgelemektedir. Arayüzün yerelleştirilmesi, kullanıcılar tarafından oluşturulan listeleri, proje içeriğini veya her türlü harici teknik teşhis verisini çevirmez.

## Lisanslama ve katkılar

Orijinal kaynak kodu, kullanıcı arayüzü, SVG çizimleri, dokümantasyon ve parametrik oluşturucu [MIT lisansı](../../LICENSE) altında yayınlanmıştır. Bağımlılıklar kendi lisanslarını ve bildirimlerini korur. Kullanıcı modelleri, yazarları tarafından seçilen ayrı bir lisansa sahiptir. Kurgusal örnek profil metinleri ve örnek teknik gereksinim metinleri ile üç oluşturulmuş örnek tasarım, CC0 kapsamında sunulmuştur; oluşturucu MIT kapsamında kalır. Ayrıntılar için [üçüncü taraf bildirimlerine](../../THIRD_PARTY_NOTICES.md) bakın.

Bu bağımsız uygulama, [3d-online.app](https://3d-online.app) fikrini geliştirir. Orijinal üretim hesapları, gizli bilgiler, özel Git geçmişi ve kullanıcı dosyaları dahil edilmemiştir. Uyarlanan MIT Neofab CAD derleyicisi, [orijinal lisansını ve kaynak bildirimini](../../cad-worker/NOTICE.md) korur.

Katkılar, kod, çeviri düzeltmeleri, kullanılabilirlik iyileştirmeleri, açık parametrik parçalar, kurulum kontrolleri ve gerçek atölyelerden gelen geri bildirimler içerebilir. [CONTRIBUTING.md](../../CONTRIBUTING.md) ile başlayın.
