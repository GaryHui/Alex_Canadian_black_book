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
9. Full raw JSON stays in the website backend/Supabase. Google Sheet only keeps the readable `Leads` table.

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
Max photos for customer page: 1
Max long edge: 1400 px
Format sent to Apps Script: JPEG
```

The customer page asks for one optional photo:

```text
Vehicle photo
```

The uploaded photo is automatically renamed before it is sent to Google Drive. Example:

```text
vehicle-photo-original-name.jpg
```

This makes the Drive folder easier for the dealer to review without opening every image.

Supabase stores only photo metadata, not the base64 photo content. The real photos are stored in Google Drive.

## Inventory Photos For Buy Page

The dealer/admin inventory photo workflow uses the same `LEAD_WEBHOOK_URL` and the same Google Drive root folder.

Admin workflow:

```text
Admin page > Inventory management > Vehicle photos
```

1. Upload one or more vehicle photos for an inventory listing.
2. The website sends those photos to the Apps Script webhook.
3. Apps Script saves the files into Google Drive and returns file URLs.
4. The website stores those returned URLs in Supabase table `listing_photos`.
5. The Buy page displays the first photo for a published vehicle only when `Publish photos` is checked for that listing.

This is different from customer valuation photos:

```text
Customer valuation photos -> stored with the customer lead
Inventory photos -> attached to vehicle_listings/listing_photos for the public Buy page
```

If a published vehicle has photos in admin but the Buy page still shows the placeholder car image, check:

```text
1. The listing status is Published.
2. The listing has uploaded photos in Inventory management.
3. Publish photos is checked.
4. Save listing was clicked after checking Publish photos.
5. The Google Drive file can be displayed publicly enough for an image tag.
```

Privacy note: Google Drive files are owned by the website owner's Google account. If the Buy page image does not render, the Drive file may need a sharing setting that allows the public site to load it. For a production marketplace, consider moving public inventory images to Supabase Storage, Cloudflare R2, or another CDN while keeping private customer documents in Google Drive.

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
6. Confirm the `Leads` sheet tab now has clean headers.
7. Click `Deploy > New deployment`.
8. Type: `Web app`.
9. Execute as: `Me`.
10. Who has access: `Anyone`.
11. Copy the `/exec` URL.
12. Put that URL into Vercel `LEAD_WEBHOOK_URL`.
13. Redeploy Vercel.

## Full Setup Order For A New Owner

Use this order when handing the system to a website owner:

1. In Google Drive, create one root folder, for example:

```text
BlackBook Leads
```

2. Open that folder and copy the folder ID from the browser URL.
3. Open the Google Sheet that will receive leads.
4. Copy the Google Sheet ID from the browser URL.
5. In the Google Sheet, open `Extensions > Apps Script`.
6. Replace the old script with the final script in this document.
7. Fill in both constants:

```javascript
const SPREADSHEET_ID = "PASTE_GOOGLE_SHEET_ID_HERE";
const DRIVE_ROOT_FOLDER_ID = "PASTE_GOOGLE_DRIVE_FOLDER_ID_HERE";
```

8. Save the script.
9. In Apps Script, select `installHeaders` from the function dropdown.
10. Click `Run`.
11. Approve Google permissions if prompted.
12. Check the Google Sheet:
    - `Leads` should have readable columns.
    - Full raw JSON is kept by the website backend/Supabase, not by Google Sheet.
13. Click `Deploy > New deployment`.
14. Select `Web app`.
15. Set `Execute as` to `Me`.
16. Set `Who has access` to `Anyone`.
17. Deploy and copy the new `/exec` URL.
18. In Vercel, set:

```text
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

19. Redeploy Vercel.

Important: Apps Script and Vercel are separate deployments. Changing Apps Script code does not automatically update Vercel. If the Apps Script `/exec` URL changes, Vercel must be updated and redeployed.

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

Step-by-step for the Drive folder ID:

1. Open [Google Drive](https://drive.google.com/).
2. Create or open the root folder, for example `BlackBook Leads`.
3. Look at the browser address bar.
4. The URL normally looks like this:

```text
https://drive.google.com/drive/folders/1AbCDefGhijkLmNoPQRstuVwxyz123456
```

5. Copy only the part after `/folders/`:

```text
1AbCDefGhijkLmNoPQRstuVwxyz123456
```

6. Paste it into Apps Script:

```javascript
const DRIVE_ROOT_FOLDER_ID = "1AbCDefGhijkLmNoPQRstuVwxyz123456";
```

Do not paste the full Google Drive URL into `DRIVE_ROOT_FOLDER_ID`. Paste only the ID string.

## When To Update Vercel `LEAD_WEBHOOK_URL`

You only need to change Vercel `LEAD_WEBHOOK_URL` when the Apps Script Web App `/exec` URL changes.

Usually the `/exec` URL changes when:

- You create a brand-new Apps Script project.
- You create a brand-new Web App deployment instead of editing the existing deployment.
- The website owner replaces the Google Sheet and creates a new script.

If you only edit code inside the same Apps Script project and update the existing deployment, the URL may stay the same. Still, always confirm the latest `/exec` URL after deployment.

After changing `LEAD_WEBHOOK_URL` in Vercel:

1. Save the environment variable.
2. Redeploy the Vercel project.
3. Run a test valuation.
4. Confirm:
   - One readable row appears in `Leads`.
   - The website backend still has the raw response if the admin opens the raw lead summary.
   - Photos and PDF appear under the correct Google Drive folder.

## Optional CRM Webhook

The website also reserves a generic CRM webhook output. This is useful for AutoRaptor, Make, Zapier, or another dealer CRM after the CRM provider gives a real webhook/API endpoint.

Add these Vercel environment variables only when a CRM endpoint is ready:

```text
CRM_WEBHOOK_URL=https://crm-or-automation-webhook.example.com/lead
CRM_WEBHOOK_TOKEN=optional_secret_token
```

When `CRM_WEBHOOK_URL` is configured, the website sends a JSON payload after the Google Drive webhook finishes. The CRM payload includes:

- customer email and phone
- VIN, UVC, year, make, model, trim, style
- kilometers, color, region, country
- wholesale, retail, and trade-in average values
- Google Drive folder URL
- PDF URL
- saved photo file URLs
- raw input and valuation data

If `CRM_WEBHOOK_TOKEN` is set, the request includes:

```text
Authorization: Bearer YOUR_TOKEN
```

For AutoRaptor specifically, the marketing page is not enough to connect directly. Ask AutoRaptor for one of these:

- inbound lead webhook URL
- REST API endpoint for creating leads
- API token / bearer token
- required field mapping

After those are provided, put the endpoint in `CRM_WEBHOOK_URL`, put the token in `CRM_WEBHOOK_TOKEN`, redeploy Vercel, and run one test valuation.

## Final Apps Script

Replace `SPREADSHEET_ID` and `DRIVE_ROOT_FOLDER_ID` before deployment.

If you add or move any column, run `installHeaders` again after saving the Apps Script. For example, `Condition Notes` is a normal lead column in the script below; if the Sheet does not show it, the owner is still running an older deployed Apps Script or has not rerun `installHeaders`.

```javascript
const SPREADSHEET_ID = "YOUR_GOOGLE_SHEET_ID";
const DRIVE_ROOT_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID";

const LEADS_SHEET_NAME = "Leads";

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
  "Status",
  "Photo Count",
  "Photo Names",
  "Drive Folder",
  "PDF",
  "Spreadsheet"
];

function installHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const leadsSheet = getOrCreateSheet_(ss, LEADS_SHEET_NAME);

  leadsSheet.getRange(1, 1, 1, LEADS_HEADERS.length).setValues([LEADS_HEADERS]);
  leadsSheet.setFrozenRows(1);
  leadsSheet.autoResizeColumns(1, LEADS_HEADERS.length);
}

function doPost(e) {
  const data = JSON.parse((e.postData && e.postData.contents) || "{}");
  const receivedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const leadsSheet = getOrCreateSheet_(ss, LEADS_SHEET_NAME);

  ensureHeaders_(leadsSheet, LEADS_HEADERS);

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
    data.status || "",
    data.photoCount || (data.files || []).length || "",
    data.photoNames || "",
    driveResult.leadFolderUrl || "",
    driveResult.pdfUrl || "",
    driveResult.spreadsheetUrl || ""
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      leadFolderUrl: driveResult.leadFolderUrl || "",
      pdfUrl: driveResult.pdfUrl || "",
      spreadsheetUrl: driveResult.spreadsheetUrl || "",
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
  const spreadsheetFile = createVehicleSpreadsheet_(data, receivedAt, leadFolder, savedFiles, pdfFile);

  return {
    customerFolderUrl: customerFolder.getUrl(),
    leadFolderUrl: leadFolder.getUrl(),
    pdfUrl: pdfFile.getUrl(),
    spreadsheetUrl: spreadsheetFile.getUrl(),
    files: savedFiles
  };
}

function createVehiclePdf_(data, receivedAt, leadFolder, savedFiles) {
  const title = vehicleTitle_(data) || "Vehicle Valuation";
  const doc = DocumentApp.create(summaryFileName_(data, "doc"));
  const body = doc.getBody();

  body.appendParagraph("Funfhundert Plus").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph([
    data.kilometers ? data.kilometers + " km" : "",
    data.region || "",
    data.color ? "Color: " + data.color : ""
  ].filter(Boolean).join(" | "));

  body.appendParagraph("Estimated Value").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  addPdfRow_(body, "Average Dealer Purchase Price", data.dealerPurchaseRange || "");
  addPdfRow_(body, "Dealer Purchase Average", data.wholesaleAvg || "");
  addPdfRow_(body, "If You Prefer To Sell Yourself", data.privateSaleRange || "");
  addPdfRow_(body, "Private Sale Average", data.retailAvg || "");

  body.appendParagraph("Vehicle Details").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  addPdfRow_(body, "VIN", data.vin || "");
  addPdfRow_(body, "UVC", data.uvc || "");
  addPdfRow_(body, "Year", data.year || "");
  addPdfRow_(body, "Make", data.make || "");
  addPdfRow_(body, "Model", data.model || "");
  addPdfRow_(body, "Series / Trim", data.series || "");
  addPdfRow_(body, "Style", data.style || "");
  addPdfRow_(body, "Kilometers", data.kilometers || "");
  addPdfRow_(body, "Ownership Type", data.ownershipType || "");
  addPdfRow_(body, "Region", data.region || "");
  addPdfRow_(body, "Country", data.country || "");

  body.appendParagraph("Customer And Follow-Up").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  addPdfRow_(body, "Received At", receivedAt);
  addPdfRow_(body, "Customer Email", data.email || data.authEmail || "");
  addPdfRow_(body, "Phone", data.phone || "");
  addPdfRow_(body, "Condition Notes", data.conditionNotes || "");

  if (savedFiles.length) {
    body.appendParagraph("Uploaded Photos").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    savedFiles.forEach(function(file) {
      body.appendParagraph(file.name).setBold(true);
      try {
        const image = body.appendImage(DriveApp.getFileById(file.id).getBlob());
        scaleImage_(image, 460);
      } catch (error) {
        body.appendParagraph("Photo could not be embedded: " + file.url);
      }
    });
  }

  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName(summaryFileName_(data, "pdf"));
  const pdfFile = leadFolder.createFile(pdfBlob);
  docFile.setTrashed(true);
  return pdfFile;
}

function createVehicleSpreadsheet_(data, receivedAt, leadFolder, savedFiles, pdfFile) {
  const spreadsheet = SpreadsheetApp.create(summaryFileName_(data, "sheet"));
  const sheet = spreadsheet.getActiveSheet();
  sheet.setName("Valuation Summary");

  const rows = [
    ["Received At", receivedAt],
    ["Customer Email", data.email || data.authEmail || ""],
    ["Phone", data.phone || ""],
    ["VIN", data.vin || ""],
    ["UVC", data.uvc || ""],
    ["Vehicle", vehicleTitle_(data)],
    ["Year", data.year || ""],
    ["Make", data.make || ""],
    ["Model", data.model || ""],
    ["Series / Trim", data.series || ""],
    ["Style", data.style || ""],
    ["Kilometers", data.kilometers || ""],
    ["Ownership Type", data.ownershipType || ""],
    ["Color", data.color || ""],
    ["Region", data.region || ""],
    ["Country", data.country || ""],
    ["Average Dealer Purchase Price", data.dealerPurchaseRange || ""],
    ["Dealer Purchase Low", data.dealerPurchaseLow || ""],
    ["Dealer Purchase High", data.dealerPurchaseHigh || ""],
    ["If You Prefer To Sell Yourself", data.privateSaleRange || ""],
    ["Private Sale Low", data.privateSaleLow || ""],
    ["Private Sale High", data.privateSaleHigh || ""],
    ["Wholesale AVG", data.wholesaleAvg || ""],
    ["Retail AVG", data.retailAvg || ""],
    ["Trade-In AVG", data.tradeInAvg || ""],
    ["Condition Notes", data.conditionNotes || ""],
    ["Drive Folder", leadFolder.getUrl()],
    ["PDF", pdfFile.getUrl()]
  ];

  savedFiles.forEach(function(file, index) {
    rows.push(["Photo " + (index + 1), file.name + " - " + file.url]);
  });

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, rows.length, 1).setFontWeight("bold");
  sheet.autoResizeColumns(1, 2);

  const spreadsheetFile = DriveApp.getFileById(spreadsheet.getId());
  leadFolder.addFile(spreadsheetFile);
  try {
    DriveApp.getRootFolder().removeFile(spreadsheetFile);
  } catch (error) {
    // If Drive root removal is unavailable, the file still exists in the lead folder.
  }
  return spreadsheetFile;
}

function addPdfRow_(body, label, value) {
  body.appendParagraph(label + ": " + (value || ""));
}

function scaleImage_(image, maxWidth) {
  const width = image.getWidth();
  const height = image.getHeight();
  if (!width || width <= maxWidth) return;
  const ratio = maxWidth / width;
  image.setWidth(maxWidth);
  image.setHeight(Math.round(height * ratio));
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
6. Open the website admin lead detail if raw technical data is needed. The Google Sheet intentionally stays readable and does not store full raw JSON.

## About Removing `CBB Raw`

The `CBB Raw` Google Sheet tab is no longer required.

You can delete the `CBB Raw` tab from Google Sheet after deploying the script above. This does not delete or affect the website backend raw data, because the admin raw summary comes from Supabase/the website database, not from Google Sheet.

## Troubleshooting: Sheet Row Exists But Drive Folder/PDF/Photos Are Missing

If a valuation row appears in `Leads`, but no customer folder, no vehicle folder, no photos, or no PDF appears in Google Drive, check these items in order:

1. Confirm Vercel `LEAD_WEBHOOK_URL` points to the newest Apps Script `/exec` URL.
   - Old Sheet-only scripts can still write rows, but they cannot create Drive folders or PDFs.
   - If the Apps Script deployment URL changed, update `LEAD_WEBHOOK_URL` in Vercel and redeploy Vercel.

2. Confirm Apps Script contains the final Drive script from this document.
   - The final script must include `DRIVE_ROOT_FOLDER_ID`.
   - It must include `saveDriveFilesAndPdf_`.
   - It must include `createVehiclePdf_`.

3. Confirm `DRIVE_ROOT_FOLDER_ID` is only the folder ID, not the full Drive URL.

```javascript
// Correct
const DRIVE_ROOT_FOLDER_ID = "1AbCDefGhijkLmNoPQRstuVwxyz123456";

// Wrong
const DRIVE_ROOT_FOLDER_ID = "https://drive.google.com/drive/folders/1AbCDefGhijkLmNoPQRstuVwxyz123456";
```

4. Confirm the Apps Script Web App is deployed as:
   - Execute as: `Me`
   - Who has access: `Anyone`

5. Confirm you tested from the live Vercel site after redeploying Vercel.
   - Editing Apps Script alone is not enough if Vercel still has the old webhook URL.
   - Editing Vercel environment variables is not enough until Vercel is redeployed.

6. Use one small image first.
   - The website compresses images before sending them.
   - Very large or unsupported files may be skipped.
   - Supported image types are JPG, PNG, and WebP.

Expected result after a successful test:

- `Leads` has a readable row.
- `Drive Folder` column has a Google Drive folder URL.
- `PDF` column has a PDF file URL.
- The Drive root folder contains a customer email folder.
- The customer email folder contains a vehicle/lead folder.
- The vehicle/lead folder contains the uploaded photos and PDF summary.

### Quick Webhook Response Check

You can tell whether the Apps Script `/exec` URL is running the final Drive/PDF script by checking its response after a valuation.

Final Drive/PDF script response should look like this:

```json
{
  "ok": true,
  "leadFolderUrl": "https://drive.google.com/...",
  "pdfUrl": "https://drive.google.com/...",
  "savedFiles": []
}
```

If the response is only:

```json
{ "ok": true }
```

then the `/exec` URL is still running an old Sheet-only script. That old script can write rows to Google Sheet, but it cannot create Drive folders, save photos, or generate PDFs.

To fix this:

1. Open the Apps Script project.
2. Confirm the code is replaced with the final Drive/PDF script in this document.
3. Click `Deploy > Manage deployments`.
4. Click the pencil/edit icon on the Web App deployment.
5. Under `Version`, choose `New version`.
6. Confirm:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Click `Deploy`.
8. Copy the `/exec` URL shown after deployment.
9. If the URL changed, update Vercel `LEAD_WEBHOOK_URL`.
10. Redeploy Vercel.

## Privacy Notes

- Do not make the Drive root folder public.
- The Apps Script URL is stored only in Vercel as `LEAD_WEBHOOK_URL`.
- Customer photos are sent only after `Generate` succeeds.
- The website does not expose the Apps Script URL on the frontend.
- The PDF and photos are stored under the website owner's Google Drive account.
