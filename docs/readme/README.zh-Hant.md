# OpenPrint

**設計零件，並向開放網路中的工坊下單製作。**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · **[繁體中文](../../docs/readme/README.zh-Hant.md)** · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

在地圖上尋找製造工作室，查看其能力，並直接與之聯繫。如果您的工作室未列出，請添加其聯絡方式和服務：資訊將立即顯示。將私有管理連結儲存起來，以便稍後編輯或刪除您的工作室資訊。預設目錄沒有帳戶、電子郵件驗證或審核流程。

執行 OpenPrint，搭配 Node.js 24 和本地 SQLite。Vercel、Supabase（一家電子郵件服務提供商）、付費 AI 和第三方登入都不需要。GitHub 託管原始碼並發布版本；一個接受投稿的共享網站需要一個正在運行的 API 伺服器。僅使用 [GitHub 頁面](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) 無法執行 Node.js API，也無法保存訪客的更改。

## 目錄功能

- [工坊網路](../../docs/WORKSHOP_NETWORK.md). 您的訂單和檔案將儲存在所選工坊的節點上。
- 按名稱、城市和技術進行搜尋。地圖包含符合搜尋條件的地點，與列表分頁無關。
- 無需帳戶即可發布。選擇地圖上的某個點，或輸入坐標；沒有坐標的列表仍然可以被搜尋。
- 編輯或刪除一筆包含其私有連結的列表。版本檢查可防止在不同分頁中同時進行的編輯產生衝突。
- 在發布之前，先搜尋現有的工作室。如果工作室名稱、城市和地址完全相同，系統會自動拒絕。
- 導入包含來源資訊的目錄。操作者導入的內容不能覆蓋自行發布的列表。
- 無需 API 金鑰即可檢視 OpenStreetMap 個地圖圖塊。地圖圖塊會在顯示地圖時載入，包括預設的起始頁面。
- 從語言選單中選擇介面語言。透過上方語言索引，以您的語言閱讀完整的 README 文件。

本平台不驗證商家所有權或服務品質。請與工作室確認設備、能力和條款。任何持有私有管理連結的人都可以控制該列表。請將其保密；沒有電子郵件恢復功能。請閱讀[自助發布指南](../../docs/OPEN_CATALOG.md)。

## 運行您自己的實例

安裝 Node.js 24，複製此儲存庫，然後執行：

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`。預設的 `APP_MODE=catalog` 無需管理員或使用者設定。使用 [自助託管指南](../../docs/SELF_HOSTING.md) 配置 `APP_URL`、HTTPS 和備份。Docker Compose 也可用：`docker compose up --build -d`。

支援的部署方式是在本機磁碟上使用一個應用程式程序，並設定為 SQLite。自動發布和請求配額可限制濫用，而無需建立審核佇列。共享辦公室 IP 可以共享發布配額。在啟用公共實例之前，請參閱 [配額和管理連結行為](../../docs/OPEN_CATALOG.md)。

在確認其權限後，使用 [目錄導入 CLI](../../docs/CATALOG_IMPORT.md) 來導入現有的資料集。實例資料集、上傳檔案和備份不會包含在儲存庫或容器映像中。

## 可選的社群模式和 Neofab 模式

將 `APP_MODE=community` 明確設定為啟用，以啟用私人專案、供應商報價、模型庫和 Neofab 工作室。這些工作流程使用各自的帳戶和權限。切換模式會保留已儲存的資料。目錄模式不會透過其 API 公開私人社群歷史記錄，也不會繼續處理已排隊的 CAD 工作。

[Neofab 工作室](../../docs/NEOFAB_SETUP.md) 支援版本化的製造需求文件、物料清單，以及受限制的宣告式 CAD，並可匯出 STEP/STL 格式。CAD 和人工智慧 (AI) 是可選功能。AI 提案需要審核，並且需要單獨的申請步驟；它們不會自動發布訂單或建立幾何圖形。CAM、G 代碼和實際製造驗證尚未實作。

## 資料權利與隱私權

MIT 軟體授權並未授予使用導入的商業記錄的權利。僅僅標明出處並不能授權複製來自 Google 地圖、2GIS、Yandex 地圖或其他來源的資料。在使用資料集之前，請驗證儲存、發布和重新分發的權限。請參閱[資料來源和審查範圍](../../docs/DATA_PROVENANCE.md)。

自行發布的聯絡資訊是公開的；管理金鑰是私有的。請將資料庫和備份檔案置於非公開伺服目錄之外，並提供聯絡人以處理更正和刪除請求。在部署之前，請閱讀[隱私權](../../PRIVACY.md)和[安全性](../../SECURITY.md)相關資訊。

## 開發與翻譯

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub「動作」會檢查類型、API瀏覽器工作流程，以及預設和原生CAD容器。測試使用虛構的記錄。確切的證據、覆蓋範圍和剩餘限制會記錄在[驗證](../../docs/VALIDATION.md)和[產品範圍](../../docs/PRODUCT.md)中。

英文版的 README 文件是完整翻譯版本的參考依據。[語言索引](../../docs/i18n/README.md) 文件記錄了翻譯維護和審核的限制。介面本地化不會翻譯使用者撰寫的列表、專案內容或所有外部技術診斷。

## 授權和貢獻

原始程式碼、使用者介面、SVG 插圖、文件和參數化產生器均以 [MIT 授權](../../LICENSE) 方式提供。依賴項保留其各自的授權和聲明。使用者模型擁有其作者選擇的獨立授權。虛構的示範個人資料和簡短文字，以及三個產生的示範設計，均以 CC0 方式提供；產生器仍為 MIT。請參閱 [第三方聲明](../../THIRD_PARTY_NOTICES.md)。

此獨立實作進一步發展了 [3d-online.app](https://3d-online.app) 的概念。原始的生產帳戶、密鑰、私有 Git 歷史記錄和用戶檔案均未包含在內。經過調整的 MIT Neofab CAD 編譯器保留了其 [原始許可證和出處聲明](../../cad-worker/NOTICE.md)。

您可以貢獻程式碼、翻譯修正、使用者體驗優化、開放的參數化零件、安裝檢查，以及來自實際工作坊的回饋。從[CONTRIBUTING.md](../../CONTRIBUTING.md)開始。
