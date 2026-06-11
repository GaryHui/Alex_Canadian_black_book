# Google Apps Script Webhook Setup

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

This is the final tested version. `installHeaders` force-writes the header row to row 1. If A1 has a test value like `TEST HEADER WRITE`, it will be replaced by `Received At`.

```javascript
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
  installHeaders();

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
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

function testWrite() {
  const sheet = getLeadSheet_();
  sheet.getRange("A1").setValue("TEST HEADER WRITE");
}

function getLeadSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName("Leads") ||
    spreadsheet.getSheetByName("leads") ||
    spreadsheet.getSheets()[0];
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
Received At | Customer Email | Phone | VIN | UVC | Year | Make | Model | Series / Trim | Style | Kilometers | Color | Region | Country | Wholesale AVG | Retail AVG | Trade-In AVG | Lead ID | Auth Email | Status | Full CBB JSON | Raw Payload JSON
```

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

## 8. Configure Vercel

Open:

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

After changing this variable, redeploy production:

```text
Vercel > Deployments > Redeploy
```

or:

```powershell
npx vercel --prod --yes
```

## 9. Test From The Website

1. Open the website.
2. Sign in with Google.
3. Select or search a vehicle.
4. Click `Generate`.
5. Go back to Google Sheet.
6. A new row should appear under the header row.

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
