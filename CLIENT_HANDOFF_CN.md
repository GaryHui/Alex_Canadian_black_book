# 客户交付与账号迁移中文指南

这份文档是给自己和客户交付时看的。目标是：以后如果要把现在用你自己账号配置的 Vercel、Google、Supabase 等全部换成客户账号，可以按这份清单一步一步做，不用重新回忆当时怎么搭建。

不要把真实密码、API Key、Secret 写进这个文档。这里只写变量名、在哪里设置、怎么检查。真实密钥要放在 Vercel / Supabase / Google / 密码管理器里。

## 1. 交付时要给客户的东西

交付包建议包含：

```text
GitHub 仓库权限
正式网站 URL
Vercel 项目权限或项目转移
Supabase 项目权限或新 Supabase 项目
Google Sheet 链接
Google Drive 根目录链接
Google Apps Script 项目链接
Canadian Black Book API 账号/联系人
老板/Admin 登录邮箱列表
员工/Dealer 登录邮箱列表
英文交付文档 CLIENT_HANDOFF.md
中文交付文档 CLIENT_HANDOFF_CN.md
```

你自己可以另外保存一份“账号位置表”，不要放真实密码：

```text
Vercel 团队/项目名：
GitHub 仓库：
Supabase 项目名：
Google Cloud 项目名：
Google OAuth Client 名称：
Google Sheet 名称：
Google Drive 根目录名称：
Apps Script Deployment 名称：
Cloudflare Turnstile 站点名称：
Resend 发送邮箱/域名：
```

## 2. 客户需要注册或拥有的账号

完整交付通常需要这些账号：

```text
GitHub
Vercel
Supabase
Google 账号或 Google Workspace
Google Cloud Console
Canadian Black Book API 账号
Cloudflare 账号，可选，用于 Turnstile 人机验证
Resend 账号，可选，用于非工作时间自动邮件回复
CRM / Zapier / Make 账号，可选，用于对接外部 CRM
```

建议归属：

```text
客户拥有生产环境的 Vercel、Supabase、Google、Cloudflare、Resend、CRM。
开发者只保留 GitHub 或 Vercel 协作权限，方便后续维护。
```

## 3. 现在系统的组成

整体流程：

```text
浏览器
  -> Vercel 网站和 server.mjs
  -> Supabase：登录、车单、任务、timeline、库存、员工、设置
  -> Canadian Black Book API：车辆估价
  -> Google Apps Script：写 Google Sheet、存 Drive 图片、生成 PDF
  -> 可选 CRM Webhook
  -> 可选 Resend：非工作时间自动回复邮件
```

公开页面：

```text
/ 或 /home.html
/customer.html  卖车/估价页
/buy.html       买车页
/login.html     登录页
```

员工/老板页面：

```text
/admin.html
/dealer.html
/admin-vehicles.html
```

## 4. 换客户账号的正确顺序

建议按这个顺序，不要跳着做：

```text
1. 确定客户正式域名。
2. 创建或转移 Vercel 项目。
3. 创建客户 Supabase 项目。
4. 在客户 Supabase 里运行 supabase.sql。
5. 在客户 Google Cloud 里配置 Google OAuth。
6. 在 Supabase 里启用 Google 登录。
7. 用客户 Google 账号创建 Google Sheet 和 Google Drive 根目录。
8. 用 GOOGLE_DRIVE_UPLOADS.md 部署客户的 Google Apps Script。
9. 把所有环境变量填入 Vercel。
10. Redeploy Vercel。
11. 设置老板 Admin 邮箱和员工 Dealer 邮箱。
12. 按最后的验收清单逐项测试。
```

## 5. Vercel 必填变量

位置：

```text
Vercel > Project > Settings > Environment Variables
```

生产环境至少要设置这些：

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_SITE_URL=

BLACKBOOK_USERNAME=
BLACKBOOK_PASSWORD=
BLACKBOOK_BASE_URL=https://service.canadianblackbook.com
BLACKBOOK_API_PATH=/UsedCarWS/CanUsedAPI

LEAD_WEBHOOK_URL=

ADMIN_EMAILS=
OWNER_EMAIL=
OWNER_CONTACT=
```

变量解释：

| 变量 | 作用 | 从哪里拿 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase 项目地址 | Supabase > Project Settings > API |
| `SUPABASE_ANON_KEY` | 前端可用的 Supabase 公钥 | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端数据库密钥 | Supabase > Project Settings > API |
| `PUBLIC_SITE_URL` | 正式网站 URL，用于登录跳转 | Vercel 正式域名或客户域名 |
| `BLACKBOOK_USERNAME` | Canadian Black Book API 用户名 | CBB 账号 |
| `BLACKBOOK_PASSWORD` | Canadian Black Book API 密码或 Key | CBB 账号 |
| `BLACKBOOK_BASE_URL` | CBB API 基础地址 | 通常固定 |
| `BLACKBOOK_API_PATH` | CBB API 路径 | 通常固定 |
| `LEAD_WEBHOOK_URL` | Google Apps Script `/exec` 地址 | Apps Script 部署后复制 |
| `ADMIN_EMAILS` | 老板/管理员 Google 邮箱 | 客户提供 |
| `OWNER_EMAIL` | 对外显示的老板联系邮箱 | 客户提供 |
| `OWNER_CONTACT` | 用户估价次数用完时看到的联系说明 | 客户提供 |

注意：

```text
SUPABASE_SERVICE_ROLE_KEY、BLACKBOOK_PASSWORD 这些是密钥，不能写在前端，也不要发到群里。
Vercel 改完变量后必须 Redeploy，旧部署不会自动使用新变量。
PUBLIC_SITE_URL 生产环境不能填 localhost。
```

## 6. Vercel 可选变量

代码里也支持这些变量，按客户需求选择：

```text
ANNUAL_VALUATION_LIMIT=3
BLACKBOOK_TEMPLATE=12
DEALER_EMAILS=

TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

CRM_WEBHOOK_URL=
CRM_WEBHOOK_TOKEN=

RESEND_API_KEY=
RESEND_FROM_EMAIL=
AUTO_REPLY_FROM_EMAIL=

GOOGLE_FORM_ACTION_URL=
GOOGLE_FORM_ID=
GOOGLE_FORM_FIELD_MAP=
GOOGLE_FORM_JSON_ENTRY=

PORT=3000
```

说明：

```text
ANNUAL_VALUATION_LIMIT：每个用户每年的免费估价次数。
BLACKBOOK_TEMPLATE：Black Book API 模板，一般保持默认 12。
DEALER_EMAILS：员工登录 fallback，建议只做紧急备用。
TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY：Cloudflare 人机验证，两个要同时设置。
CRM_WEBHOOK_URL / CRM_WEBHOOK_TOKEN：对接外部 CRM、Make、Zapier。
RESEND_API_KEY / RESEND_FROM_EMAIL / AUTO_REPLY_FROM_EMAIL：自动邮件回复。
GOOGLE_FORM_*：旧的 Google Form 输出方式，现在主要推荐 LEAD_WEBHOOK_URL。
PORT：本地开发用，Vercel 一般不用设置。
```

## 7. 怎么查看当前 Vercel 设置过什么

如果本机已经登录当前 Vercel 账号，可以用：

```bash
vercel env ls
```

如果要拉取到本地 `.env.local`：

```bash
vercel env pull .env.local
```

注意：

```text
.env.local 不能提交到 GitHub。
不要把里面的密钥复制到文档或聊天里。
交付文档只记录变量名和在哪里找，不记录真实值。
```

## 8. Supabase 设置

客户 Supabase 设置步骤：

```text
1. 登录客户 Supabase。
2. Create Project。
3. Project Settings > API，复制 Project URL、anon key、service_role key。
4. SQL Editor。
5. 打开本项目 supabase.sql，复制完整 SQL。
6. 粘贴并运行。
7. 等 30-60 秒，让 Supabase 刷新 schema。
```

主要表：

```text
valuation_leads
lead_activity
lead_tasks
lead_emails
dealer_staff
user_limits
vehicle_listings
listing_photos
buyer_inquiries
finance_estimates
operations_settings
```

如果后台显示库存表不存在、车单加载失败，先重新运行完整 `supabase.sql`，等一分钟后刷新页面。

## 9. Google 登录 OAuth 设置

这个系统登录是：

```text
Supabase Auth + Google OAuth
```

在 Google Cloud Console：

```text
APIs & Services > Credentials > Create Credentials > OAuth Client ID
Application type: Web application
```

Authorized JavaScript origins 填域名，不带路径：

```text
https://客户正式域名或 Vercel 域名
http://localhost:3000
```

Authorized redirect URI 填 Supabase callback：

```text
https://客户的 Supabase Project.supabase.co/auth/v1/callback
```

然后回到 Supabase：

```text
Authentication > Providers > Google
Enable Google
填 Google Client ID
填 Google Client Secret
```

Supabase URL 设置：

```text
Authentication > URL Configuration
Site URL: https://客户正式域名
Redirect URLs:
https://客户正式域名
http://localhost:3000
```

常见错误：

```text
不要把 /auth/v1/callback 填到 JavaScript origins。
callback 完整地址只放在 Authorized redirect URIs。
```

## 10. Google Sheet、Drive、Apps Script

网站本身不会直接选择 Google Drive 文件夹，它只会把数据发给：

```text
LEAD_WEBHOOK_URL
```

这个 URL 是客户 Google Apps Script 部署出来的 Web App `/exec` 地址。

具体脚本在：

```text
GOOGLE_DRIVE_UPLOADS.md
```

客户账号设置步骤：

```text
1. 在客户 Google Drive 创建根目录，比如 BlackBook Leads。
2. 从 Drive URL 复制 folder ID。
3. 创建或选择客户 Google Sheet。
4. 从 Sheet URL 复制 spreadsheet ID。
5. Google Sheet > Extensions > Apps Script。
6. 粘贴 GOOGLE_DRIVE_UPLOADS.md 里的最终脚本。
7. 替换：
   const SPREADSHEET_ID = "客户 Sheet ID";
   const DRIVE_ROOT_FOLDER_ID = "客户 Drive folder ID";
8. 保存。
9. 运行 installHeaders。
10. 按提示授权。
11. Deploy > New deployment。
12. Type 选 Web app。
13. Execute as 选 Me。
14. Who has access 选 Anyone。
15. Deploy 后复制 /exec URL。
16. 把 /exec URL 填到 Vercel 的 LEAD_WEBHOOK_URL。
17. Redeploy Vercel。
```

如果 Apps Script 重新部署后 `/exec` URL 变了，Vercel 里的 `LEAD_WEBHOOK_URL` 也必须更新，并且要重新部署 Vercel。

## 11. 老板和员工权限

老板/Admin：

```text
ADMIN_EMAILS=owner@example.com,manager@example.com
```

员工/Dealer：

推荐在后台添加：

```text
/admin.html > Dealer portal access > Add dealer
```

紧急 fallback：

```text
DEALER_EMAILS=sales1@example.com,sales2@example.com
```

建议权限模型：

```text
ADMIN_EMAILS = 老板和可信经理
dealer_staff 表 = 正常员工
DEALER_EMAILS = 紧急备用
```

老板账号可以进老板台，也可以进员工台查看流程，但真正的员工列表最好用后台管理，不要长期依赖 `DEALER_EMAILS`。

## 12. 可选服务设置

### Cloudflare Turnstile

如果客户希望 Google 登录前先做人机验证，需要设置：

```text
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

两个要同时设置。只设一个容易导致登录失败。

### Resend 非工作时间自动回复

如果客户希望非工作时间收到车单/询价后自动回邮件：

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=
AUTO_REPLY_FROM_EMAIL=
```

上班时间和自动回复内容在老板台设置，Resend 负责真正发邮件。

### CRM Webhook

如果客户有外部 CRM、Make、Zapier：

```text
CRM_WEBHOOK_URL=
CRM_WEBHOOK_TOKEN=
```

如果设置了 token，网站会发送：

```text
Authorization: Bearer TOKEN
```

### Google Form 旧接口

支持但不推荐作为主流程：

```text
GOOGLE_FORM_ACTION_URL=
GOOGLE_FORM_ID=
GOOGLE_FORM_FIELD_MAP=
GOOGLE_FORM_JSON_ENTRY=
```

主流程优先用 `LEAD_WEBHOOK_URL`。

## 13. 换客户域名 Checklist

从 demo 域名换到客户正式域名时：

```text
1. 在 Vercel 添加客户域名。
2. 在域名服务商设置 DNS。
3. Vercel 设置 PUBLIC_SITE_URL=https://客户域名。
4. Supabase Site URL 改成 https://客户域名。
5. Supabase Redirect URLs 加 https://客户域名。
6. Google OAuth Authorized JavaScript origins 加 https://客户域名。
7. localhost 保留给本地测试。
8. Redeploy Vercel。
9. 用无痕浏览器测试 Google 登录。
```

## 14. 最终验收清单

### 公开页面

```text
打开 /
打开 /customer.html
打开 /buy.html
打开 /login.html
手机宽度检查页面不乱
登录后确认 Sign out 正常显示
```

### 登录权限

```text
用老板 Google 邮箱登录，可以进 /admin.html。
登出。
用员工 Google 邮箱登录，可以进 /dealer.html。
用非员工邮箱测试，确认进不了老板台/员工台。
```

### 卖车/估价流程

```text
提交一个卖车估价单。
Supabase valuation_leads 有记录。
Google Sheet 有记录。
Google Drive 有客户文件夹。
PDF 生成成功。
老板台能看到车单。
派给员工后，员工台能看到车单。
```

### CRM 流程

```text
老板派单给员工。
员工加 timeline 更新。
老板收到更新提醒。
老板派 Task。
员工收到 Task/更新。
点开车单后提醒消失。
SOP progress 和 Next action 显示合理。
```

### 库存和买车页

```text
把卖车车单转入库存。
上传库存图片。
发布 listing。
打开 /buy.html。
确认车辆显示。
打开车辆详情。
提交买家询价。
确认买家询价进入 CRM lead。
```

### 非工作时间自动回复

如果客户启用：

```text
老板台设置当前为非工作时间。
提交一个询价。
确认自动回复已发送或已排队。
老板台能看到对应车单。
```

## 15. 常见问题排查

| 问题 | 优先检查 |
| --- | --- |
| Google 登录跳到 localhost | `PUBLIC_SITE_URL`、Supabase Site URL |
| 老板台提示未配置权限 | Vercel `ADMIN_EMAILS` |
| 员工看不到车单 | 是否派单、dealer_staff 表、`DEALER_EMAILS` fallback |
| 估价结果 mock 或找不到车 | `BLACKBOOK_USERNAME`、`BLACKBOOK_PASSWORD` |
| 车单没保存 | `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` |
| Google Sheet 没记录 | `LEAD_WEBHOOK_URL`、Apps Script 是否最新部署、Vercel 是否 redeploy |
| Drive 没照片/PDF | Apps Script 的 `DRIVE_ROOT_FOLDER_ID`、权限、脚本版本 |
| 买车页图片不显示 | listing 是否 published、是否上传图片、是否勾选 publish photos、Drive 图片权限 |
| 自动回复没发 | `RESEND_API_KEY`、发送邮箱、上班时间设置 |

## 16. 交付前要问客户的问题

迁移前问客户：

```text
正式域名：
老板/Admin Google 邮箱：
员工/Dealer Google 邮箱：
公司名称：
公司电话：
公司邮箱：
公司地址：
用于 Google Sheet/Drive 的 Google 账号：
Canadian Black Book API 账号或联系人：
是否需要 Turnstile 人机验证：
是否需要非工作时间自动回复：
是否需要外部 CRM webhook：
```

密钥类内容不要让客户直接发在微信/邮件里，最好让客户自己填到 Vercel，或者通过密码管理器分享。

## 17. 最终交付给客户的链接

交付时整理一页给客户：

```text
正式网站 URL：
老板台：/admin.html
员工台：/dealer.html
买车页：/buy.html
Google Sheet URL：
Google Drive 根目录 URL：
Supabase Project URL：
Vercel Project URL：
GitHub Repo URL：
交付文档：CLIENT_HANDOFF.md / CLIENT_HANDOFF_CN.md
```

最后确认：

```text
客户老板能登录 Vercel。
客户老板能登录 Supabase。
客户老板能打开 Google Sheet 和 Drive。
客户老板能登录 /admin.html。
至少一个员工能登录 /dealer.html。
```

## 18. 是否已经包含所有要注册和设置的东西

按当前代码实际读取的环境变量和系统功能来看，这份中文文档已经包含：

```text
所有必须注册/准备的账号
所有生产环境必填变量
所有代码支持的可选变量
Google OAuth 设置
Supabase 设置
Vercel 设置
Google Sheet / Drive / Apps Script 设置
老板和员工权限设置
域名更换设置
最终功能验收清单
常见问题排查
```

以后如果新增第三方服务，例如短信、真实贷款 API、独立图片 CDN、正式 CRM SDK，再把对应账号和变量追加到这里。
