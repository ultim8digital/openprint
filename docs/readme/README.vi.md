# OpenPrint

**Thiết kế một chi tiết và đặt xưởng trong mạng lưới mở gia công.**

<details>
<summary>Choose a language</summary>

[English (US)](../../README.md) · [Español (España)](../../docs/readme/README.es-ES.md) · [العربية](../../docs/readme/README.ar-SA.md) · [Français (France)](../../docs/readme/README.fr-FR.md) · [हिन्दी](../../docs/readme/README.hi.md) · [ไทย](../../docs/readme/README.th.md) · [Русский](../../docs/readme/README.ru.md) · [Deutsch](../../docs/readme/README.de-DE.md) · [Italiano](../../docs/readme/README.it.md) · [Português (Brasil)](../../docs/readme/README.pt-BR.md) · [Nederlands](../../docs/readme/README.nl-NL.md) · [Svenska](../../docs/readme/README.sv.md) · [Dansk](../../docs/readme/README.da.md) · [Norsk bokmål](../../docs/readme/README.no.md) · [Türkçe](../../docs/readme/README.tr.md) · **[Tiếng Việt](../../docs/readme/README.vi.md)** · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [简体中文](../../docs/readme/README.zh-Hans.md) · [繁體中文](../../docs/readme/README.zh-Hant.md) · [English (UK)](../../docs/readme/README.en-GB.md) · [English (Australia)](../../docs/readme/README.en-AU.md) · [English (Canada)](../../docs/readme/README.en-CA.md) · [Español (México)](../../docs/readme/README.es-MX.md) · [Français (Canada)](../../docs/readme/README.fr-CA.md) · [Português (Portugal)](../../docs/readme/README.pt-PT.md) · [Polski](../../docs/readme/README.pl.md) · [Українська](../../docs/readme/README.uk.md) · [Bahasa Indonesia](../../docs/readme/README.id.md) · [Čeština](../../docs/readme/README.cs.md) · [Slovenčina](../../docs/readme/README.sk.md) · [Magyar](../../docs/readme/README.hu.md) · [Română](../../docs/readme/README.ro.md) · [Hrvatski](../../docs/readme/README.hr.md) · [Ελληνικά](../../docs/readme/README.el.md) · [Suomi](../../docs/readme/README.fi.md) · [Slovenščina](../../docs/readme/README.sl-SI.md) · [Català](../../docs/readme/README.ca.md) · [עברית](../../docs/readme/README.he.md) · [Bahasa Melayu](../../docs/readme/README.ms.md) · [বাংলা](../../docs/readme/README.bn-BD.md) · [ગુજરાતી](../../docs/readme/README.gu-IN.md) · [ಕನ್ನಡ](../../docs/readme/README.kn-IN.md) · [മലയാളം](../../docs/readme/README.ml-IN.md) · [मराठी](../../docs/readme/README.mr-IN.md) · [ଓଡ଼ିଆ](../../docs/readme/README.or-IN.md) · [ਪੰਜਾਬੀ](../../docs/readme/README.pa-IN.md) · [தமிழ்](../../docs/readme/README.ta-IN.md) · [తెలుగు](../../docs/readme/README.te-IN.md) · [اردو](../../docs/readme/README.ur-PK.md)

</details>

Tìm một xưởng sản xuất trên bản đồ, kiểm tra năng lực của họ và liên hệ trực tiếp. Nếu xưởng của bạn chưa có trong danh sách, hãy thêm thông tin liên hệ và các dịch vụ của xưởng: thông tin sẽ hiển thị ngay lập tức. Lưu liên kết quản lý riêng để chỉnh sửa hoặc xóa thông tin của bạn sau này. Danh mục mặc định không có tài khoản, xác nhận qua email hoặc quy trình phê duyệt.

Chạy OpenPrint với Node.js 24 và SQLite cục bộ. Vercel, Supabase, một nhà cung cấp dịch vụ email, AI trả phí và đăng nhập bằng tài khoản bên thứ ba không bắt buộc. GitHub lưu trữ mã nguồn và phát hành các bản cập nhật; một trang web chung chấp nhận các bài gửi cần có máy chủ API đang hoạt động. Chỉ riêng [GitHub Trang](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) không thể chạy Node.js API hoặc lưu lại các thay đổi của người dùng.

## Các tính năng của danh mục

- [Mạng lưới xưởng](../../docs/WORKSHOP_NETWORK.md). Đơn hàng và tệp của bạn sẽ được lưu trên nút của xưởng bạn chọn.
- Tìm kiếm theo tên, thành phố và công nghệ. Bản đồ hiển thị các địa điểm phù hợp, không phụ thuộc vào phân trang của danh sách.
- Đăng tải mà không cần tài khoản. Chọn một điểm trên bản đồ hoặc nhập tọa độ; các mục không có tọa độ vẫn có thể tìm kiếm được.
- Chỉnh sửa hoặc xóa một mục danh sách cùng với liên kết riêng của mục đó. Kiểm tra phiên bản giúp ngăn chặn các chỉnh sửa xung đột trong các tab khác nhau.
- Tìm kiếm các studio hiện có trước khi đăng tải. Các bản sao trùng lặp về tên, thành phố và địa chỉ sẽ bị từ chối tự động.
- Nhập một danh mục kèm theo thông tin nguồn gốc. Người vận hành không được phép nhập dữ liệu để ghi đè lên các danh sách đã được tự công bố.
- Xem OpenStreetMap ô bản đồ mà không cần API khóa. Các ô bản đồ sẽ được tải khi bản đồ hiển thị, bao gồm cả trang đích mặc định.
- Chọn ngôn ngữ giao diện từ menu ngôn ngữ. Đọc toàn bộ tệp README bằng ngôn ngữ của bạn thông qua mục chỉ mục ngôn ngữ ở trên.

Việc đăng thông tin không xác minh quyền sở hữu doanh nghiệp hoặc chất lượng dịch vụ. Vui lòng xác nhận thông tin về thiết bị, năng lực và các điều khoản với studio. Bất kỳ ai có liên kết quản lý riêng tư đều có thể kiểm soát thông tin đó. Hãy giữ thông tin này ở chế độ riêng tư; không có chức năng khôi phục email. Đọc [hướng dẫn tự đăng](../../docs/OPEN_CATALOG.md).

## Chạy phiên bản của riêng bạn

Cài đặt Node.js 24, sao chép kho lưu trữ này và chạy:

```sh
npm ci
npm run build
cp .env.example .env
npm start
```

Open `http://localhost:3000`. Cài đặt mặc định `APP_MODE=catalog` không yêu cầu thiết lập quản trị viên hoặc người dùng. Cấu hình `APP_URL`, HTTPS và sao lưu bằng cách sử dụng [hướng dẫn tự cài đặt](../../docs/SELF_HOSTING.md). Docker Compose cũng có sẵn: `docker compose up --build -d`.

Phương thức triển khai được hỗ trợ là một quy trình ứng dụng với SQLite trên ổ đĩa cục bộ. Việc xuất bản tự động và giới hạn số lượng yêu cầu giúp hạn chế lạm dụng mà không cần hàng đợi kiểm duyệt. Một địa chỉ IP văn phòng dùng chung có thể chia sẻ giới hạn số lượng xuất bản. Xem [giới hạn và hành vi liên kết quản lý](../../docs/OPEN_CATALOG.md) trước khi mở một phiên bản công khai.

Sử dụng [giao diện dòng lệnh nhập danh mục](../../docs/CATALOG_IMPORT.md) cho một tập dữ liệu hiện có sau khi kiểm tra quyền của nó. Các tập dữ liệu phiên bản, tệp đã tải lên và bản sao lưu không được bao gồm trong kho lưu trữ hoặc hình ảnh vùng chứa.

## Chế độ cộng đồng và Neofab (tùy chọn)

Đặt `APP_MODE=community` thành giá trị cụ thể để kích hoạt các dự án riêng tư, báo giá từ nhà cung cấp, thư viện mô hình và Neofab Studio. Các quy trình làm việc này sử dụng tài khoản và quyền riêng của chúng. Việc chuyển đổi chế độ sẽ giữ lại dữ liệu đã lưu. Chế độ danh mục không hiển thị lịch sử cộng đồng riêng tư thông qua API của nó hoặc tiếp tục các công việc đang chờ xử lý CAD.

[Neofab Studio](../../docs/NEOFAB_SETUP.md) hỗ trợ các phiên bản khác nhau của tài liệu yêu cầu sản xuất, danh sách vật liệu và mô hình CAD giới hạn, có thể xuất ra định dạng STEP/STL. CAD và Trí tuệ nhân tạo (AI) là tùy chọn. Các đề xuất sử dụng AI cần được xem xét và thực hiện riêng; chúng không tự động tạo đơn hàng hoặc xây dựng mô hình. CAM, mã G và quy trình kiểm tra tính khả thi trong sản xuất thực tế chưa được triển khai.

## Quyền sở hữu dữ liệu và quyền riêng tư

Giấy phép phần mềm MIT không cấp quyền cho việc sử dụng các bản ghi kinh doanh đã nhập. Chỉ việc ghi nguồn không đủ để cho phép sao chép dữ liệu từ Google Maps, 2GIS, Yandex Maps hoặc các nguồn khác. Xác minh quyền cho việc lưu trữ, công bố và phân phối lại trước khi sử dụng một tập dữ liệu. Xem [nguồn gốc và phạm vi kiểm tra dữ liệu](../../docs/DATA_PROVENANCE.md).

Thông tin liên hệ tự công bố là công khai; khóa quản lý là riêng tư. Giữ cơ sở dữ liệu và bản sao lưu bên ngoài các thư mục được phục vụ công khai và cung cấp thông tin liên hệ để xử lý các yêu cầu chỉnh sửa và xóa. Đọc [chính sách bảo mật](../../PRIVACY.md) và [chính sách bảo mật](../../SECURITY.md) trước khi triển khai.

## Phát triển và dịch thuật

```sh
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
npm run format:check
```

GitHub Các thao tác kiểm tra các loại, API và quy trình làm việc của trình duyệt, cũng như các CAD vùng chứa mặc định và gốc. Các bài kiểm tra sử dụng dữ liệu giả. Bằng chứng chính xác, phạm vi kiểm tra và các giới hạn còn lại được ghi lại trong [xác thực](../../docs/VALIDATION.md) và [phạm vi sản phẩm](../../docs/PRODUCT.md).

Tài liệu README bằng tiếng Anh là tài liệu tham khảo cho các phiên bản dịch đầy đủ. [Mục lục ngôn ngữ](../../docs/i18n/README.md) cung cấp thông tin về quy trình bảo trì và giới hạn đánh giá bản dịch. Quá trình bản địa hóa giao diện không dịch các danh sách do người dùng tạo, nội dung dự án hoặc tất cả các tài liệu kỹ thuật bên ngoài.

## Cấp phép và đóng góp

Nguồn gốc, giao diện người dùng, SVG hình minh họa, tài liệu và trình tạo tham số đều được cấp phép theo [MIT](../../LICENSE). Các thư viện phụ vẫn giữ giấy phép và thông báo riêng của chúng. Các mô hình do người dùng tạo có giấy phép riêng do tác giả của chúng lựa chọn. Hồ sơ demo hư cấu và đoạn văn ngắn, cùng với ba bản thiết kế demo được tạo, được cung cấp theo CC0; trình tạo vẫn thuộc MIT. Xem [thông báo của bên thứ ba](../../THIRD_PARTY_NOTICES.md).

Phiên bản độc lập này phát triển ý tưởng của [3d-online.app](https://3d-online.app). Các tài khoản sản xuất ban đầu, thông tin bí mật, lịch sử Git riêng và tệp người dùng không được bao gồm. Trình biên dịch MIT Neofab CAD đã được điều chỉnh vẫn giữ nguyên [giấy phép và thông báo nguồn gốc ban đầu](../../cad-worker/NOTICE.md).

Các đóng góp có thể bao gồm mã nguồn, sửa lỗi bản dịch, cải thiện khả năng sử dụng, các bộ phận tham số mở, kiểm tra cài đặt và phản hồi từ các xưởng thực tế. Bắt đầu với [CONTRIBUTING.md](../../CONTRIBUTING.md).
