# OpenPrint

**一个开放的印刷工作室和工坊目录。无需注册或管理员。**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · [Tiếng Việt](../../docs/readme/README.vi.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · **[简体中文](../../docs/readme/README.zh-Hans.md)** · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

在地图上查找制造商，查看他们的能力，并直接联系他们。如果您的工作室未列出，请添加其联系方式和服务：信息将立即显示。保存私有管理链接，以便稍后编辑或删除您的信息。默认目录中没有账户、电子邮件验证或审批队列。

运行 OpenPrint，使用 Node.js 24 和本地 SQLite。Vercel、Supabase（一种电子邮件服务提供商）、付费人工智能和第三方登录都不需要。GitHub 托管源代码并发布；一个接受提交内容的共享网站需要一个正在运行的 API 服务器。[GitHub 页面](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) 单独无法运行 Node.js API，也无法保存访问者的更改。

## 目录功能

- 按名称、城市和技术进行搜索。地图包含匹配的位置，与列表分页无关。
- 无需注册账户即可发布。选择地图上的一个点，或输入坐标；不带坐标的列表仍然可以被搜索到。
- 编辑或删除一个列表及其私有链接。版本检查功能可防止在不同标签页中进行冲突的编辑。
- 在发布之前，请先查找已有的工作室。如果工作室名称、城市和地址与现有工作室完全相同，系统将自动拒绝。
- 导入带有来源信息的目录。操作员导入的内容不能覆盖自行发布的列表。
- 无需 API 密钥即可查看 OpenStreetMap 个图块。当显示地图时，图块会加载，包括默认的起始页面。
- 从语言菜单中选择界面语言。通过上面的语言索引，阅读您所选语言的完整 README 文件。

发布信息并不代表对商家所有权或服务质量的验证。请与工作室确认设备、能力和条款。任何拥有私有管理链接的人都可以控制该信息。请妥善保管，因为无法恢复。请阅读[自助发布指南](../../docs/OPEN_CATALOG.md)。

## 运行您自己的实例

安装 Node.js 24，克隆此仓库，然后运行：

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`。默认的 `APP_MODE=catalog` 无需管理员或用户设置。使用[自助托管指南](../../docs/SELF_HOSTING.md)配置 `APP_URL`、HTTPS 和备份。Docker Compose 也可用：`docker compose up --build -d`。

支持的部署方式是在本地磁盘上运行一个应用程序进程，该进程使用 SQLite。自动发布和请求配额限制了滥用行为，无需设置审核队列。共享办公 IP 可以共享发布配额。在开放公共实例之前，请参阅[配额和管理行为](../../docs/OPEN_CATALOG.md)。

在检查数据集的使用权限后，使用[目录导入命令行界面](../../docs/CATALOG_IMPORT.md)导入现有数据集。实例数据集、上传文件和备份文件不会包含在存储库或容器镜像中。

## 可选的社区模式和 Neofab 模式

将 `APP_MODE=community` 显式设置为启用私有项目、供应商报价、模型库和 Neofab 工作室。这些工作流程使用各自的账户和权限。切换模式会保留已存储的数据。目录模式不会通过其 API 公开私有社区历史记录，也不会恢复排队的 CAD 工作。

[Neofab工作室](../../docs/NEOFAB_SETUP.md)支持版本化的制造需求文档、物料清单和受限的声明式CAD，并提供STEP/STL格式的导出功能。CAD和人工智能是可选功能。人工智能生成的方案需要审核，并需要单独的申请步骤；它们不会自动发布订单或生成几何模型。CAM、G代码和物理制造验证功能尚未实现。

## 数据权利和隐私

MIT 软件许可不授予使用导入的商业记录的权利。仅标注来源并不能授权复制来自 Google 地图、2GIS、Yandex 地图或其他来源的数据。在使用数据集之前，请验证存储、发布和再分发的权限。请参阅[数据来源和审查范围](../../docs/DATA_PROVENANCE.md)。

自行发布的联系方式是公开的；管理密钥是私有的。请将数据库和备份文件存储在不属于公开访问目录的位置，并提供一个联系方式，以便处理更正和删除请求。在部署之前，请阅读[隐私](../../PRIVACY.md)和[安全](../../SECURITY.md)相关文档。

## 开发和翻译

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub“操作”会检查类型、API浏览器工作流程以及默认和原生CAD容器。测试使用虚构的记录。确切的证据、覆盖范围和剩余限制记录在[验证](../../docs/VALIDATION.md)和[产品范围](../../docs/PRODUCT.md)中。

英文版的 README 文件是完整翻译版本的参考。[语言索引](../../docs/i18n/README.md) 记录了翻译维护和审核的范围。界面本地化不会翻译用户创建的列表、项目内容或所有外部技术诊断信息。

## 许可和贡献

原始资源、用户界面、SVG插图、文档和参数化生成器均采用[MIT许可协议](../../LICENSE)。依赖项保留各自的许可协议和声明。用户模型采用其作者选择的单独许可协议。虚构的演示配置文件和简短文本，以及三个生成的演示设计，均采用CC0；生成器仍采用MIT。请参阅[第三方声明](../../THIRD_PARTY_NOTICES.md)。

此独立实现是对 [3d-online.app](https://3d-online.app) 理念的进一步发展。原始生产账户、密钥、私有 Git 历史记录和用户文件均不包含在内。经过调整的 MIT Neofab CAD 编译器保留了其[原始许可协议和来源声明](../../cad-worker/NOTICE.md)。

您可以贡献代码、翻译修正、可用性改进、开源参数化零件、安装检查以及来自实际工作室的反馈。请从[CONTRIBUTING.md](../../CONTRIBUTING.md)开始。
