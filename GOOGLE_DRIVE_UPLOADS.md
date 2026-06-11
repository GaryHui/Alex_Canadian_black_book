# Google Drive Photo Uploads And Vehicle PDF

This is the final working setup for sending customer photos to the website owner's Google Drive and creating a PDF summary for each valuation.

## What This Does

When a customer clicks `Generate` successfully:

1. The website saves the valuation lead.
2. The website sends customer data, vehicle data, valuation data, and compressed photos to `LEAD_WEBHOOK_URL`.
3. Google Apps Script writes a readable row into the `Leads` sheet.
4. Apps Script creates a customer folder in Google Drive using the customer's email.
5. Apps Script creates one vehicle folder inside that customer folder.
6. Apps Script saves uploaded photos into that vehicle folder.
7. Apps Script creates a PDF summary with the customer, vehicle, and valuation information.
8. Apps Script writes the Drive folder URL and PDF URL back into the `Leads` sheet.
9. Full raw JSON goes into the `CBB Raw` sheet, not into the readable `Leads` sheet.

## Folder Structure

Create one root folder in Google Drive, for example:

```text
BlackBook Leads
```

Apps Script will create folders like this:

```text
BlackBook Leads
  customer@example.com
    2026-06-11 - 2T2GGCEZ9RC032642 - 2024 Lexus NX-Series NX350 Premium
      01-front.jpg
      02-rear.jpg
      03-interior.jpg
      Vehicle Summary.pdf
```

## Vercel Environment Variable

The website sends leads/photos to Apps Script using this Vercel environment variable:

```text
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Important:

- Use the latest `/exec` URL from Apps Script deployment.
- If you deploy a new Apps Script deployment and the URL changes, update `LEAD_WEBHOOK_URL` in Vercel and redeploy.
- If Vercel still points to an old `/exec` URL, Google Sheet may keep using the old script and old headers.

## Website Upload Limits

The customer page compresses photos before sending them:

```text
Max photos: 6
Max long edge: 1400 px
Format sent to Apps Script: JPEG
```

Supabase stores only photo metadata, not the base64 photo content. The real photos are stored in Google Drive.

## Apps Script Setup

1. Open the Google Sheet.
2. Click `Extensions > Apps Script`.
3. Paste the full script below.
4. Set:

```javascript
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
const DRIVE_ROOT_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID";
```

5. Click `Run`, choose `installHeaders`, and authorize it.
6. Click `Deploy > New deployment`.
7. Type: `Web app`.
8. Execute as: `Me`.
9. Who has access: `Anyone`.
10. Copy the `/exec` URL.
11. Put that URL into Vercel `LEAD_WEBHOOK_URL`.
12. Redeploy Vercel.

## How To Get IDs

Google Sheet ID:

```text
https://docs.google.com/spreadsheets/d/1BKerWbBFaJzXO9fWyfsKCGqKjoWq2jC5bd0W3940MIc/edit
                                      ^ this part is the spreadsheet ID
```

Google Drive folder ID:

```text
https://drive.google.com/drive/folders/1abcDEFghiJKLmnop
                                      ^ this part is the folder ID
```

## Final Apps Script

Replace `SPREADSHEET_ID` and `DRIVE_ROOT_FOLDER_ID` before deployment.

```javascript
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
const DRIVE_ROOT_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID";

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
  "Color",
  "Region",
  "Country",
  "Wholesale AVG",
  "Retail AVG",
  "Trade-In AVG",
  "Lead ID",
  "Auth Email",
  "Status",
  "Photo Count",
  "Photo Names",
  "Drive Folder",
  "PDF"
];

const RAW_HEADERS = [
  "Received At",
  "Lead ID",
  "VIN",
  "UVC",
  "Full CBB JSON",
  "Raw Payload JSON"
];

function installHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const leadsSheet = getOrCreateSheet_(ss, LEADS_SHEET_NAME);
  const rawSheet = getOrCreateSheet_(ss, RAW_SHEET_NAME);

  leadsSheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
  rawSheet.getRange(1, 1, 1, RAW_HEADERS.length).setValues([RAW_HEADERS]);
  leadsSheet.setFrozenRows(1);
  rawSheet.setFrozenRows(1);
  leadsSheet.autoResizeColumns(1, LEADS_HEADERS.length);
  rawSheet.autoResizeColumns(1, RAW_HEADERS.length);
}

function doPost(e) {
  const data = JSON.parse((e.postData && e.postData.contents) || "{}");
  const receivedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const leadsSheet = getOrCreateSheet_(ss, LEADS_SHEET_NAME);
  const rawSheet = getOrCreateSheet_(ss, RAW_SHEET_NAME);

  ensureHeaders_(leadsSheet, LEADS_HEADERS);
  ensureHeaders_(rawSheet, RAW_HEADERS);

  const driveResult = saveDriveFilesAndPdf_(data, receivedAt);

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
    data.color || "",
    data.region || "",
    data.country || "",
    data.wholesaleAvg || "",
    data.retailAvg || "",
    data.tradeInAvg || "",
    data.id || "",
    data.authEmail || "",
    data.status || "",
    data.photoCount || (data.files || []).length || "",
    data.photoNames || "",
    driveResult.leadFolderUrl || "",
    driveResult.pdfUrl || ""
  ]);

  rawSheet.appendRow([
    receivedAt,
    data.id || "",
    data.vin || "",
    data.uvc || "",
    data.cbbJson || "",
    JSON.stringify(redactFileContent_(data))
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      leadFolderUrl: driveResult.leadFolderUrl || "",
      pdfUrl: driveResult.pdfUrl || "",
      savedFiles: driveResult.files || []
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveDriveFilesAndPdf_(data, receivedAt) {
  const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  const customerFolder = getOrCreateChildFolder_(root, customerFolderName_(data));
  const leadFolder = getOrCreateChildFolder_(customerFolder, leadFolderName_(data, receivedAt));
  const savedFiles = [];

  (data.files || []).forEach(function(file, index) {
    if (!file || !file.base64) return;
    const bytes = Utilities.base64Decode(file.base64);
    const fileName = photoFileName_(data, file, index);
    const blob = Utilities.newBlob(bytes, file.mimeType || "image/jpeg", fileName);
    const driveFile = leadFolder.createFile(blob);
    savedFiles.push({
      name: driveFile.getName(),
      id: driveFile.getId(),
      url: driveFile.getUrl()
    });
  });

  const pdfFile = createVehiclePdf_(data, receivedAt, leadFolder, savedFiles);

  return {
    customerFolderUrl: customerFolder.getUrl(),
    leadFolderUrl: leadFolder.getUrl(),
    pdfUrl: pdfFile.getUrl(),
    files: savedFiles
  };
}

function createVehiclePdf_(data, receivedAt, leadFolder, savedFiles) {
  const title = vehicleTitle_(data) || "Vehicle Valuation";
  const doc = DocumentApp.create(summaryFileName_(data, "doc"));
  const body = doc.getBody();

  body.appendParagraph("Vehicle Valuation Summary").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("Received At: " + receivedAt);
  body.appendParagraph("Customer Email: " + (data.email || data.authEmail || ""));
  body.appendParagraph("Phone: " + (data.phone || ""));
  body.appendParagraph("VIN: " + (data.vin || ""));
  body.appendParagraph("UVC: " + (data.uvc || ""));
  body.appendParagraph("Vehicle: " + title);
  body.appendParagraph("Kilometers: " + (data.kilometers || ""));
  body.appendParagraph("Color: " + (data.color || ""));
  body.appendParagraph("Region: " + (data.region || ""));
  body.appendParagraph("Country: " + (data.country || ""));
  body.appendParagraph("Wholesale AVG: " + (data.wholesaleAvg || ""));
  body.appendParagraph("Retail AVG: " + (data.retailAvg || ""));
  body.appendParagraph("Trade-In AVG: " + (data.tradeInAvg || ""));
  body.appendParagraph("Condition Notes: " + (data.conditionNotes || ""));

  if (savedFiles.length) {
    body.appendParagraph("Uploaded Photos").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    savedFiles.forEach(function(file) {
      body.appendParagraph(file.name + ": " + file.url);
    });
  }

  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName(summaryFileName_(data, "pdf"));
  const pdfFile = leadFolder.createFile(pdfBlob);
  docFile.setTrashed(true);
  return pdfFile;
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const same = headers.every(function(header, index) {
    return current[index] === header;
  });
  if (!same) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getOrCreateChildFolder_(parent, folderName) {
  const safeName = sanitizeName_(folderName || "unknown");
  const folders = parent.getFoldersByName(safeName);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(safeName);
}

function customerFolderName_(data) {
  return sanitizeName_(data.email || data.authEmail || "unknown-email");
}

function leadFolderName_(data, receivedAt) {
  const date = String(receivedAt || "").slice(0, 10) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const vehicleId = sanitizeName_(data.vin || data.uvc || data.id || "unknown-vehicle");
  const title = sanitizeName_(vehicleTitle_(data));
  return [date, vehicleId, title].filter(Boolean).join(" - ");
}

function vehicleTitle_(data) {
  return [
    data.year,
    data.make,
    data.model,
    data.series,
    data.style
  ].filter(Boolean).join(" ");
}

function photoFileName_(data, file, index) {
  const vehicleId = sanitizeName_(data.vin || data.uvc || "vehicle");
  const original = sanitizeName_(file.name || "photo.jpg");
  const number = String(index + 1).padStart(2, "0");
  return number + "-" + vehicleId + "-" + original;
}

function summaryFileName_(data, ext) {
  const vehicleId = sanitizeName_(data.vin || data.uvc || data.id || "vehicle");
  return vehicleId + "-valuation-summary." + ext;
}

function redactFileContent_(data) {
  const copy = JSON.parse(JSON.stringify(data || {}));
  copy.files = (copy.files || []).map(function(file) {
    return {
      name: file.name || "",
      originalName: file.originalName || "",
      mimeType: file.mimeType || "",
      size: file.size || "",
      width: file.width || "",
      height: file.height || ""
    };
  });
  return copy;
}

function sanitizeName_(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}
```

## Testing

After deployment:

1. Run `installHeaders` once.
2. Create one valuation on the live site with one small vehicle photo.
3. Confirm the `Leads` sheet has a new row.
4. Confirm `Drive Folder` and `PDF` columns have URLs.
5. Open the Drive folder and confirm the photo and PDF were created.
6. Open `CBB Raw` and confirm raw JSON is there, while the readable `Leads` sheet is not stretched by raw JSON.

## Privacy Notes

- Do not make the Drive root folder public.
- The Apps Script URL is stored only in Vercel as `LEAD_WEBHOOK_URL`.
- Customer photos are sent only after `Generate` succeeds.
- The website does not expose the Apps Script URL on the frontend.
- The PDF and photos are stored under the website owner's Google Drive account.
