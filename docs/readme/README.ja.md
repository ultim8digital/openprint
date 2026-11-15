# OpenPrint

**印刷スタジオやワークショップのオープンなディレクトリです。登録やモデレーターは必要ありません。**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · **[日本語](../../docs/readme/README.ja.md)** · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

地図上で制作スタジオを探し、その能力を確認して、直接連絡を取ってください。もしワークショップがリストにない場合は、連絡先と提供サービスを追加してください。追加するとすぐにリストに表示されます。後でリストを編集または削除するために、プライベートな管理リンクを保存してください。デフォルトのカタログには、アカウント、メールによる確認、または承認待ちのキューは含まれていません。

OpenPrintを、バージョン24のNode.jsとローカルのSQLiteで実行します。Vercel、Supabase、メールサービス、有料AI、およびサードパーティのログインは不要です。GitHubはソースコードとリリースをホストします。コンテンツ投稿を受け付ける共有ウェブサイトには、稼働中のAPIサーバーが必要です。[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)だけでは、Node.js APIを実行したり、訪問者の変更を保存したりすることはできません。

## カタログの機能

- 名前、都市、技術で検索できます。地図には、リストのページネーションとは独立して、検索結果に一致する場所が表示されます。
- アカウントなしで公開できます。地図上のポイントを選択するか、座標を入力してください。座標のない情報は検索可能のままです。
- プライベートリンク付きの登録情報を編集または削除します。バージョンチェックにより、異なるタブでの競合する編集を防ぎます。
- 公開する前に、既存のスタジオを検索してください。正確な名前、都市名、および住所が重複している場合は、自動的に拒否されます。
- ソースの情報を付加したカタログをインポートします。オペレーターによるインポートは、自身で登録した情報を上書きすることはできません。
- OpenStreetMap個のタイルを、APIキーなしで表示できます。マップが表示されると、デフォルトのランディングページを含め、タイルが読み込まれます。
- 言語メニューからインターフェースの言語を選択してください。上記の言語インデックスから、お使いの言語で書かれた完全なREADMEファイルをお読みください。

掲載によって事業の所有者やサービスの品質が確認されるわけではありません。設備、対応可能な業務、条件についてはスタジオに直接確認してください。非公開の管理リンクを持つ人は誰でも、その掲載情報を管理できます。リンクは秘密に保管してください。メールでアクセス権を復旧することはできません。[自己公開ガイド](../../docs/OPEN_CATALOG.md)をお読みください。

## 独自のインスタンスを実行する

Node.js 24をインストールし、このリポジトリをクローンして、次のコマンドを実行してください。

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`。デフォルトの `APP_MODE=catalog` には、管理者またはユーザーによる設定は不要です。[セルフホスティングガイド](../../docs/SELF_HOSTING.md)を使用して、`APP_URL`、HTTPS、およびバックアップを設定してください。また、Docker Composeも利用できます：`docker compose up --build -d`。

サポートされているデプロイメントは、ローカルディスク上に SQLite を持つ単一のアプリケーションプロセスです。自動公開とリクエストの制限により、モデレーションキューなしで不正利用を抑制します。共有のオフィスIPを使用して、公開制限を共有できます。公開インスタンスを開設する前に、[制限と管理リンクの動作](../../docs/OPEN_CATALOG.md)を確認してください。

既存のデータセットの利用権を確認した後、[カタログインポートCLI](../../docs/CATALOG_IMPORT.md)を使用してインポートしてください。インスタンスデータセット、アップロード、およびバックアップは、リポジトリまたはコンテナイメージにまとめて含まれません。

## オプションのコミュニティ機能とNeofabモード

プライベートプロジェクト、プロバイダーからの見積もり、モデルライブラリ、およびNeofab Studioを有効にするには、`APP_MODE=community`を明示的に設定します。これらのワークフローでは、それぞれ独自の口座と権限を使用します。モードを切り替えても、保存されたデータは保持されます。カタログモードでは、プライベートなコミュニティの履歴がAPIを通じて公開されることはなく、中断されたCADの作業も再開されません。

[Neofab Studio](../../docs/NEOFAB_SETUP.md) は、バージョン管理された製造向け技術仕様書、部品表、対応範囲を限定した宣言型CADとSTEP/STL形式でのエクスポートをサポートします。CADとAIは任意の機能です。AIの提案は内容を確認したうえで別の操作により適用する必要があり、注文を自動公開したり、形状を自動生成したりするものではありません。CAM、G-code、実物による製造適合性の検証は実装されていません。

## データの権利とプライバシー

MITのソフトウェアライセンスは、インポートされたビジネス記録に対する権利を付与しません。単に情報源を明示するだけでは、Google Maps、2GIS、Yandex Maps、またはその他のソースからデータをコピーすることは許可されません。データセットを使用する前に、保存、公開、再配布の許可を確認してください。[データの来歴とレビュー範囲](../../docs/DATA_PROVENANCE.md)を参照してください。

自分で公開した連絡先情報は公開されますが、管理キーは非公開です。データベースとバックアップは、一般公開されているディレクトリから分離し、修正や削除の依頼に対応するための連絡先を設けてください。展開前に[プライバシー](../../PRIVACY.md)と[セキュリティ](../../SECURITY.md)に関する情報を確認してください。

## 開発と翻訳

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHubアクションでは、型、APIブラウザのワークフロー、およびデフォルトとネイティブのCADコンテナがチェックされます。テストでは、架空のレコードが使用されます。正確な証拠、網羅性、および残りの制限は、[検証](../../docs/VALIDATION.md)および[製品範囲](../../docs/PRODUCT.md)に記録されます。

英語版のREADMEファイルは、完全な翻訳版の参照資料です。[言語インデックス](../../docs/i18n/README.md)には、翻訳の維持管理とレビューの範囲について記載されています。インターフェースのローカライズでは、ユーザーが作成したリスト、プロジェクトのコンテンツ、またはすべての外部技術的な診断情報を翻訳しません。

## ライセンスと貢献について

元のソースコード、UI、SVGのイラスト、ドキュメント、およびパラメトリックジェネレーターは[MITのライセンス](../../LICENSE)で提供されます。依存関係はそれぞれのライセンスと通知を保持します。ユーザーモデルには、作成者によって選択された別のライセンスが適用されます。架空のデモプロファイルと簡単なテキスト、および生成された3つのデモデザインは、CC0に基づいて提供されます。ジェネレーター自体はMITのままです。[サードパーティの通知](../../THIRD_PARTY_NOTICES.md)をご覧ください。

これは、[3d-online.app](https://3d-online.app)のコンセプトを基にした独立した実装です。オリジナルの制作アカウント、シークレット、プライベートGit履歴、ユーザーファイルは含まれていません。改良されたMIT Neofab CADコンパイラは、[オリジナルのライセンスと著作権表示](../../cad-worker/NOTICE.md)を維持しています。

貢献には、コード、翻訳の修正、使いやすさの改善、オープンなパラメトリック部品、インストールチェック、および実際のワークショップからのフィードバックなどが含まれます。[CONTRIBUTING.md](../../CONTRIBUTING.md)から始めてください。
