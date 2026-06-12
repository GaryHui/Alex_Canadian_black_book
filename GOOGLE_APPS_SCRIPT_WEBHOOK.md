# Google Apps Script Webhook Setup

> Current recommendation: use `GOOGLE_DRIVE_UPLOADS.md` for the final working setup.
> That newer document includes Google Drive photo upload, per-customer folders, vehicle PDF creation, `DRIVE_ROOT_FOLDER_ID`, and the current `LEAD_WEBHOOK_URL` deployment order.
> This file is kept only for the older Sheet-only webhook reference.

This document explains how to send successful Black Book valuation leads into a website owner's Google Sheet.

The production flow is:

```text
User clicks Generate
> Website saves the valuation lead to Supabase
> Website backend POSTs the same lead to Apps Script
> Apps Script appends the lead to Google Sheet
> Website owner reviews the lead and can do a second valuation manually
```

Supabase is still the main database. Google Sheet is for owner review and manual follow-up.

## 1. Create The Sheet

1. Open Google Sheets.
2. Create a new spreadsheet.
3. Recommended spreadsheet name:

```text
BlackBook Leads
```

4. The bottom sheet tab can be named either:

```text
Leads
```

or:

```text
leads
```

The final script below uses the first sheet in the file, so the tab name is less fragile.

## 2. Open Apps Script

From the Google Sheet top menu:

```text
Extensions > Apps Script
```

If the UI is Chinese, use the same menu position: choose the localized version of `Extensions`, then choose `Apps Script`.

Important: open Apps Script from the Google Sheet. This makes it a bound script. If the script is not bound to the Sheet, it will not write to the Sheet you are looking at.

## 3. Paste The Final Script

Delete all existing code and paste this full script.

This is the final recommended version. It uses `SpreadsheetApp.openById(...)` so the webhook always writes to the intended Google Sheet, even if Apps Script deployment context is confusing.

It also keeps the main `Leads` sheet readable:

- `Leads` only stores the fields that the owner reviews every day.
- `CBB Raw` stores the full CBB JSON and raw payload.
- Both sheets share `Lead ID`, so the owner can match a clean row to the raw technical record when needed.

Before pasting, replace this value with the Google Sheet ID from the Sheet URL:

```javascript
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
```

For example, if the Sheet URL is:

```text
https://docs.google.com/spreadsheets/d/1BKerWbBFaJzXO9fWyfsKCGqKjoWq2jC5bd0W3940MIc/edit
```

then the Sheet ID is:

```text
1BKerWbBFaJzXO9fWyfsKCGqKjoWq2jC5bd0W3940MIc
```

`installHeaders` force-writes the header row to row 1. If A1 has a test value like `TEST HEADER WRITE`, it will be replaced by `Received At`.

If a new field such as `Condition Notes` does not appear in the Google Sheet, save the script, run `installHeaders` again, and update the Web App deployment. The website already sends `conditionNotes`; the Sheet needs the current script below to write it into a visible column.

```javascript
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
const LEADS_SHEET_NAME = "Leads";
const RAW_SHEET_NAME = "CBB Raw";

const LEADS_HEADERS = [
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
  "Ownership Type",
  "Color",
  "Condition Notes",
  "Region",
  "Country",
  "Average Dealer Purchase Price",
  "Dealer Purchase Low",
  "Dealer Purchase High",
  "If You Prefer To Sell Yourself",
  "Private Sale Low",
  "Private Sale High",
  "Wholesale AVG",
  "Retail AVG",
  "Trade-In AVG",
  "Lead ID",
  "Auth Email",
  "Status"
];

const RAW_HEADERS = [
  "Received At",
  "Lead ID",
  "VIN",
  "UVC",
  "Full CBB JSON",
  "Raw Payload JSON"
];

function doPost(e) {
  const leadsSheet = getOrCreateSheet_(LEADS_SHEET_NAME);
  const rawSheet = getOrCreateSheet_(RAW_SHEET_NAME);
  installHeaders();

  const data = parsePayload_(e);
  const receivedAt = new Date();
  const rawPayload = JSON.stringify(data);

  leadsSheet.appendRow([
    receivedAt,
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
    data.ownershipType || "",
    data.color || "",
    data.conditionNotes || "",
    data.region || "",
    data.country || "",
    data.dealerPurchaseRange || "",
    data.dealerPurchaseLow || "",
    data.dealerPurchaseHigh || "",
    data.privateSaleRange || "",
    data.privateSaleLow || "",
    data.privateSaleHigh || "",
    data.wholesaleAvg || "",
    data.retailAvg || "",
    data.tradeInAvg || "",
    data.id || "",
    data.authEmail || "",
    data.status || ""
  ]);

  rawSheet.appendRow([
    receivedAt,
    data.id || "",
    data.vin || "",
    data.uvc || "",
    data.cbbJson || "",
    rawPayload
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: "BlackBook lead webhook is running",
      spreadsheetId: SPREADSHEET_ID,
      leadsSheetName: getOrCreateSheet_(LEADS_SHEET_NAME).getName(),
      leadsLastRow: getOrCreateSheet_(LEADS_SHEET_NAME).getLastRow(),
      rawSheetName: getOrCreateSheet_(RAW_SHEET_NAME).getName(),
      rawLastRow: getOrCreateSheet_(RAW_SHEET_NAME).getLastRow()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function installHeaders() {
  const leadsSheet = getOrCreateSheet_(LEADS_SHEET_NAME);
  leadsSheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
  leadsSheet.setFrozenRows(1);
  leadsSheet.getDataRange().setWrap(false);
  leadsSheet.autoResizeColumns(1, LEADS_HEADERS.length);
  cleanupOldJsonColumns_(leadsSheet);
  normalizeLeadRowHeights_(leadsSheet);

  const rawSheet = getOrCreateSheet_(RAW_SHEET_NAME);
  rawSheet.getRange(1, 1, 1, RAW_HEADERS.length).setValues([RAW_HEADERS]);
  rawSheet.setFrozenRows(1);
  rawSheet.getDataRange().setWrap(false);
  rawSheet.autoResizeColumns(1, 4);
  rawSheet.setColumnWidth(5, 320);
  rawSheet.setColumnWidth(6, 320);
}

function cleanupOldJsonColumns_(sheet) {
  const firstExtraColumn = LEADS_HEADERS.length + 1;
  const extraColumnCount = sheet.getMaxColumns() - LEADS_HEADERS.length;
  if (extraColumnCount <= 0) return;

  sheet
    .getRange(1, firstExtraColumn, sheet.getMaxRows(), extraColumnCount)
    .clearContent();
  sheet.hideColumns(firstExtraColumn, extraColumnCount);
}

function normalizeLeadRowHeights_(sheet) {
  const rowCount = Math.max(1, sheet.getMaxRows() - 1);
  sheet.setRowHeight(1, 28);
  sheet.setRowHeights(2, rowCount, 28);
}

function testWrite() {
  const sheet = getOrCreateSheet_(LEADS_SHEET_NAME);
  sheet.getRange("A1").setValue("TEST HEADER WRITE");
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet_(sheetName) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) return sheet;
  return spreadsheet.insertSheet(sheetName);
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

## 4. Save And Run installHeaders

1. Press:

```text
Ctrl + S
```

2. Make sure the top bar no longer says:

```text
Unsaved changes
```

3. In the function dropdown at the top, select:

```text
installHeaders
```

4. Click:

```text
Run
```

5. The first time, Google will ask for authorization.

If Google says the app has not been verified, this is normal because the website owner created the script privately:

```text
Advanced > Go to ... unsafe > Allow
```

6. Go back to Google Sheet and refresh.

Row 1 should now show:

```text
Received At | Customer Email | Phone | VIN | UVC | Year | Make | Model | Series / Trim | Style | Kilometers | Ownership Type | Color | Region | Country | Wholesale AVG | Retail AVG | Trade-In AVG | Lead ID | Auth Email | Status
```

The file should also have a second tab named:

```text
CBB Raw
```

That tab stores:

```text
Received At | Lead ID | VIN | UVC | Full CBB JSON | Raw Payload JSON
```

Use `Lead ID` to match a clean row in `Leads` to its full technical JSON in `CBB Raw`.

If `Leads` still shows old columns like:

```text
Full CBB JSON | Raw Payload JSON
```

run `installHeaders` again after pasting this script. The function will:

1. clear old JSON columns after `Status`;
2. hide the extra old columns;
3. turn off text wrapping in `Leads`;
4. reset row heights so the table is easy to scan.

## 5. If Headers Still Do Not Appear

Run this function from Apps Script:

```text
testWrite
```

Then refresh Google Sheet.

If A1 changes to:

```text
TEST HEADER WRITE
```

the script is bound to the correct Sheet. Then run:

```text
installHeaders
```

If A1 does not change, the script is not bound to the Sheet. Open the Sheet again and use:

```text
Extensions > Apps Script
```

Then paste the script again.

## 6. Deploy The Web App

In Apps Script, click:

```text
Deploy > New deployment
```

Choose:

```text
Type: Web app
Execute as: Me
Who has access: Anyone
```

Click:

```text
Deploy
```

Copy the Web App URL. It should look like:

```text
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
```

## 7. Update An Existing Deployment

If you changed the Apps Script code after deployment, update the deployment:

```text
Deploy > Manage deployments > Edit
```

Then select:

```text
Version: New version
```

Click:

```text
Deploy
```

If you do not create a new version, the website may still call the old script code.

Important: running `installHeaders` is not enough after changing the script.

`installHeaders` updates the spreadsheet layout only. The website calls the deployed `/exec` URL, and that URL keeps using the old code until you deploy a new version.

If `Leads` still receives `Full CBB JSON` and `CBB Raw` stays empty, the deployed Web App is still old. Do this exact update:

```text
Deploy > Manage deployments > Edit pencil icon > Version: New version > Deploy
```

Then open the Web App `/exec` URL in a browser. The response must include:

```json
{
  "leadsSheetName": "Leads",
  "rawSheetName": "CBB Raw"
}
```

If the response still says only `sheetName` and `lastRow`, you are still calling the old deployment.

## 8. Configure Vercel

Open the Vercel dashboard:

```text
Vercel > blackbook-demo > Settings > Environment Variables
```

Add or replace:

```text
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
```

Environment:

```text
Production
```

If an old `LEAD_WEBHOOK_URL` already exists, replace it with the new `/exec` URL from the Apps Script deployment.

CLI equivalent:

```powershell
npx vercel env rm LEAD_WEBHOOK_URL production --yes
$env:LEAD_WEBHOOK_VALUE='https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec'
$env:LEAD_WEBHOOK_VALUE | npx vercel env add LEAD_WEBHOOK_URL production
```

After changing this variable, redeploy production:

```text
Vercel > Deployments > Redeploy
```

or:

```powershell
npx vercel --prod --yes
```

Important: updating the environment variable alone is not enough. Vercel must be redeployed before the website starts using the new URL.

### Verify Vercel Is Pointing To The New Apps Script

Open the new Apps Script `/exec` URL directly in a browser.

The current optimized script returns:

```json
{
  "ok": true,
  "leadsSheetName": "Leads",
  "rawSheetName": "CBB Raw"
}
```

If the URL returns this, the Apps Script deployment is new enough.

Then generate one quote from the website. Expected result:

```text
Leads: receives only clean owner-review fields
CBB Raw: receives Full CBB JSON and Raw Payload JSON
```

If `Leads` gets `Full CBB JSON` again and `CBB Raw` stays empty, one of these is still wrong:

1. Apps Script was not deployed as `Version: New version`.
2. Vercel `LEAD_WEBHOOK_URL` still points to the old `/exec`.
3. Vercel was not redeployed after the environment variable changed.

## 9. Test From The Website

1. Open the website.
2. Sign in with Google.
3. Select or search a vehicle.
4. Click `Generate`.
5. Go back to Google Sheet.
6. A new row should appear in `Leads`.
7. A matching raw JSON row should appear in `CBB Raw`.

If the quote appears in the website's `Quote history` but does not appear in Google Sheet:

1. Confirm the Apps Script has the correct `SPREADSHEET_ID`.
2. Confirm the Apps Script was redeployed with:

```text
Deploy > Manage deployments > Edit > Version: New version > Deploy
```

3. Open the Apps Script Web App URL in a browser. The response should show the target Sheet:

```json
{
  "ok": true,
  "spreadsheetId": "YOUR_GOOGLE_SHEET_ID",
  "leadsSheetName": "Leads",
  "leadsLastRow": 3,
  "rawSheetName": "CBB Raw",
  "rawLastRow": 3
}
```

4. If `spreadsheetId` is different from the ID in the Sheet URL, the webhook is deployed from a different Apps Script project or using the wrong code.

## 10. Handoff To Website Owner

When handing off to a new website owner:

Owner steps:

1. Owner creates their own Google Sheet.
2. Owner opens `Extensions > Apps Script` from that Sheet.
3. Owner pastes the final script from this document.
4. Owner saves the script.
5. Owner runs `installHeaders`.
6. Owner deploys the Apps Script as Web App.
7. Owner sends the new `/exec` URL to the developer.

Developer steps:

1. Open Vercel environment variables.
2. Replace `LEAD_WEBHOOK_URL` with the owner's new `/exec` URL.
3. Redeploy Production.
4. Generate one test valuation and confirm the owner's Sheet receives it.

No website code changes are needed when only replacing the owner's Sheet.

## 11. Privacy Notes

Do not make the Google Sheet public.

The Apps Script URL can receive external POST requests, so keep it in the server-side Vercel environment variable only. Do not put the Apps Script URL in frontend JavaScript.

The website still saves the lead to Supabase first. If Apps Script or Google Sheet fails temporarily, the main customer record is still in Supabase.
