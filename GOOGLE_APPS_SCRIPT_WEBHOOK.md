# Google Apps Script Webhook 操作文档

这个方案用于把网站上 `Generate` 成功后的客户资料、车辆资料和 CBB 报价结果写入网站拥有者的 Google Sheet。

推荐正式流程：

```text
用户 Google 登录
> 用户点击 Generate
> 网站保存记录到 Supabase
> 网站后端 POST 到 Apps Script Webhook
> Apps Script 写入 Google Sheet
> 网站拥有者在 Sheet 里查看和二次估价
```

Supabase 仍然是主数据库。Google Sheet 是给网站拥有者人工查看、跟进和二次报价用。

## 1. 创建 Google Sheet

1. 打开 Google Sheets。
2. 新建一个表格。
3. 表格文件名建议：

```text
BlackBook Leads
```

4. 底部 Sheet 名称必须改成：

```text
Leads
```

如果没有 `Leads` 这个工作表，下面的脚本会自动创建。

## 2. 打开 Apps Script

在 Google Sheet 顶部菜单点击：

```text
Extensions > Apps Script
```

中文界面通常是：

```text
扩展程序 > Apps Script
```

## 3. 粘贴完整 Apps Script 代码

删除默认代码，粘贴下面这一整段。

这个版本会自动创建字段表头，所以 Sheet 第一行会显示每个字段代表什么。

```javascript
const SHEET_NAME = "Leads";

const HEADERS = [
  "Received At",
  "Customer Email",
  "Phone",
  "VIN",
  "UVC",
  "Year",
  "Make",
  "Model",
  "Series / Trim",
  "Style",
  "Kilometers",
  "Color",
  "Region",
  "Country",
  "Wholesale AVG",
  "Retail AVG",
  "Trade-In AVG",
  "Lead ID",
  "Auth Email",
  "Status",
  "Full CBB JSON",
  "Raw Payload JSON"
];

function doPost(e) {
  const sheet = getLeadSheet_();
  ensureHeaders_(sheet);

  const data = parsePayload_(e);

  sheet.appendRow([
    new Date(),
    data.email || "",
    data.phone || "",
    data.vin || "",
    data.uvc || "",
    data.year || "",
    data.make || "",
    data.model || "",
    data.series || "",
    data.style || "",
    data.kilometers || "",
    data.color || "",
    data.region || "",
    data.country || "",
    data.wholesaleAvg || "",
    data.retailAvg || "",
    data.tradeInAvg || "",
    data.id || "",
    data.authEmail || "",
    data.status || "",
    data.cbbJson || "",
    JSON.stringify(data)
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "BlackBook lead webhook is running" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function installHeaders() {
  const sheet = getLeadSheet_();
  ensureHeaders_(sheet);
}

function getLeadSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const exactMatch = spreadsheet.getSheetByName(SHEET_NAME);
  if (exactMatch) return exactMatch;

  const caseInsensitiveMatch = spreadsheet
    .getSheets()
    .find((sheet) => sheet.getName().toLowerCase() === SHEET_NAME.toLowerCase());

  return caseInsensitiveMatch || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = existing.some(Boolean);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    return {
      status: "parse_error",
      cbbJson: e.postData.contents
    };
  }
}
```

## 4. 第一次运行表头安装

在 Apps Script 顶部函数下拉菜单选择：

```text
installHeaders
```

然后点击运行。

第一次会要求授权：

1. 选择 Google 账号。
2. 如果看到 `This app hasn't been verified by Google`，点击 `Advanced`。
3. 点击 `Go to ... unsafe`。
4. 点击 `Allow`。

运行成功后，回到 Google Sheet，第一行应该已经有字段名。

注意：Google Sheet 的工作表标签名称要和脚本里的 `SHEET_NAME` 对上。推荐把底部标签改成：

```text
Leads
```

如果你的标签是 `leads` 小写，最新版脚本也能自动识别，但旧版脚本可能会写到另一个新建的 `Leads` 标签里。

## 5. 部署 Web App

在 Apps Script 右上角点击：

```text
Deploy > New deployment
```

设置：

```text
Type: Web app
Execute as: Me
Who has access: Anyone
```

然后点击 `Deploy`。

部署成功后复制 Web App URL，格式类似：

```text
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
```

## 6. 配置 Vercel

打开：

```text
Vercel > blackbook-demo > Settings > Environment Variables
```

添加或替换：

```text
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
```

环境选择：

```text
Production
```

保存后必须重新部署：

```text
Vercel > Deployments > Redeploy
```

或者使用 CLI：

```powershell
npx vercel --prod --yes
```

## 7. 如何测试

测试方式一：在网站上真实测试。

1. 打开网站。
2. Google 登录。
3. 输入车辆信息。
4. 点击 `Generate`。
5. 回到 Google Sheet 查看是否新增一行。

测试方式二：直接测试 Apps Script。

用 Postman 或命令 POST JSON 到 Web App URL：

```json
{
  "email": "test@example.com",
  "phone": "604-000-0000",
  "vin": "TESTVIN",
  "year": "2024",
  "make": "Lexus",
  "model": "NX",
  "kilometers": 37000,
  "wholesaleAvg": 44321,
  "retailAvg": 47912,
  "tradeInAvg": "",
  "cbbJson": "manual test"
}
```

成功时返回：

```json
{ "ok": true }
```

## 8. 交付给网站拥有者时怎么替换 Sheet

如果以后要交付给真正的网站拥有者，不需要改网站代码，只需要换 Apps Script Web App URL。

网站拥有者操作：

1. 网站拥有者用自己的 Google 账号新建 Google Sheet。
2. Sheet 名称建议为 `BlackBook Leads`。
3. 工作表名称改成 `Leads`。
4. 打开 `Extensions > Apps Script`。
5. 粘贴本文件第 3 节的完整代码。
6. 运行 `installHeaders`，完成授权。
7. `Deploy > New deployment > Web app`。
8. `Execute as` 选择 `Me`。
9. `Who has access` 选择 `Anyone`。
10. 复制新的 `/exec` URL。

开发者操作：

1. 打开 Vercel 项目环境变量。
2. 把 `LEAD_WEBHOOK_URL` 改成网站拥有者的新 `/exec` URL。
3. 重新部署 Production。
4. 用网站 Generate 一次，确认新 Sheet 收到记录。

## 9. 权限和隐私说明

Google Sheet 不要设置为公开分享。

Apps Script 的 Web App URL 可以被外部 POST，所以不要把 URL 放到前端代码里。本项目是在服务器端使用 `LEAD_WEBHOOK_URL`，用户浏览器看不到这个 URL。

如果担心垃圾提交，可以后续给 Apps Script 加一个 secret token，例如：

```text
LEAD_WEBHOOK_SECRET=some-long-random-value
```

然后网站后端请求时带 header，Apps Script 校验 header 后才写入 Sheet。

当前阶段 Supabase 仍然保存主记录，即使 Google Sheet 暂时失败，后台数据库里仍然有客户报价记录。
