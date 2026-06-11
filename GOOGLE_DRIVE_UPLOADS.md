# Google Drive Upload Plan

This document explains how the website owner can use Google Drive as the file storage area for customer vehicle photos and documents.

The goal is:

```text
Customer uploads photos on the website
> website sends files to owner-controlled Apps Script
> Apps Script creates a folder in the owner's Google Drive
> files are saved into that folder
> the folder URL is saved with the lead
```

This avoids buying separate file storage at the beginning.

## Recommended Folder Structure

Create one root folder in the owner's Google Drive:

```text
BlackBook Leads
```

Every customer email gets one folder.

Inside each email folder, every valuation/upload gets one subfolder.

Recommended structure:

```text
BlackBook Leads
└── customer@example.com
    ├── 2026-06-11 - 2T2GGCEZ9RC032642 - 2024 Lexus NX-Series
    └── 2026-07-02 - JTHFN48Y020031764 - 2002 Lexus SC430
```

If there is no VIN, use UVC or Lead ID:

```text
BlackBook Leads
└── customer@example.com
    └── 2026-06-11 - 2024500170 - 2024 Lexus NX-Series
```

This keeps all files from the same customer together.

Recommended customer folder name:

```text
<customer email>
```

Recommended lead subfolder name:

```text
<date> - <VIN or UVC or Lead ID> - <vehicle title>
```

Example:

```text
2026-06-11 - 2T2GGCEZ9RC032642 - 2024 Lexus NX-Series NX350 Premium
```

## What The Website Should Send

When the customer clicks `Generate`, the website already saves the lead.

For uploads, add a later step:

```text
Upload photos
> send files to Apps Script upload URL
> Apps Script saves files to Drive
> Apps Script returns driveFolderUrl and fileUrls
> website saves those URLs to Supabase lead
```

Recommended data:

```json
{
  "leadId": "8ce20f47-de9d-4736-a329-05875264c0d0",
  "email": "customer@example.com",
  "phone": "604-000-0000",
  "vin": "2T2GGCEZ9RC032642",
  "uvc": "2024500170",
  "year": "2024",
  "make": "Lexus",
  "model": "NX-Series",
  "files": [
    {
      "name": "front.jpg",
      "mimeType": "image/jpeg",
      "base64": "..."
    }
  ]
}
```

## Owner Setup

Owner creates a Drive root folder:

```text
Google Drive > New > Folder > BlackBook Leads
```

Open the folder and copy the folder ID from the URL.

Example URL:

```text
https://drive.google.com/drive/folders/1abcDEFghiJKLmnop
```

Folder ID:

```text
1abcDEFghiJKLmnop
```

## Apps Script Upload Example

This can be a separate Apps Script Web App from the Google Sheet lead webhook, or it can be added to the same Apps Script project if preferred.

Replace:

```javascript
const DRIVE_ROOT_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID";
```

with the owner's Drive folder ID.

```javascript
const DRIVE_ROOT_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID";

function doPost(e) {
  const data = JSON.parse(e.postData.contents || "{}");
  const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  const customerFolder = getOrCreateChildFolder_(root, buildCustomerFolderName_(data));
  const leadFolder = getOrCreateChildFolder_(customerFolder, buildLeadFolderName_(data));

  const files = (data.files || []).map(function(file) {
    const bytes = Utilities.base64Decode(file.base64 || "");
    const blob = Utilities.newBlob(bytes, file.mimeType || "application/octet-stream", file.name || "upload");
    const driveFile = leadFolder.createFile(blob);
    return {
      name: driveFile.getName(),
      id: driveFile.getId(),
      url: driveFile.getUrl()
    };
  });

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      customerFolderName: customerFolder.getName(),
      customerFolderId: customerFolder.getId(),
      customerFolderUrl: customerFolder.getUrl(),
      leadFolderName: leadFolder.getName(),
      leadFolderId: leadFolder.getId(),
      leadFolderUrl: leadFolder.getUrl(),
      files: files
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildCustomerFolderName_(data) {
  return sanitize_(data.email || "unknown-email");
}

function buildLeadFolderName_(data) {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const vehicleId = sanitize_(data.vin || data.uvc || data.leadId || "unknown-vehicle");
  const title = sanitize_([
    data.year,
    data.make,
    data.model,
    data.series,
    data.style
  ].filter(Boolean).join(" "));
  return [date, vehicleId, title].filter(Boolean).join(" - ");
}

function getOrCreateChildFolder_(parent, folderName) {
  const safeName = sanitize_(folderName || "unknown");
  const folders = parent.getFoldersByName(safeName);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(safeName);
}

function sanitize_(value) {
  return String(value)
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
```

## How This Works

For each upload:

1. Apps Script opens the root folder `BlackBook Leads`.
2. It checks whether a folder already exists for the customer's email.
3. If the email folder does not exist, it creates it.
4. It creates or reuses a lead/vehicle subfolder under that email folder.
5. It saves uploaded photos/files into that lead subfolder.
6. It returns the Drive URLs to the website.

Example response:

```json
{
  "ok": true,
  "customerFolderUrl": "https://drive.google.com/drive/folders/...",
  "leadFolderUrl": "https://drive.google.com/drive/folders/...",
  "files": [
    {
      "name": "front.jpg",
      "url": "https://drive.google.com/file/d/..."
    }
  ]
}
```

The website should save `customerFolderUrl`, `leadFolderUrl`, and `files` into the Supabase lead record. The admin page can then show a `View Drive folder` link.

## Privacy Notes

Do not make the Drive folder public.

Keep the Apps Script upload URL in a server-side Vercel environment variable. Do not expose it directly in frontend code if the upload contains private customer files.

For production, add file limits:

```text
maximum file count
maximum file size
allowed file types: jpg, png, pdf
rate limiting
admin-only folder visibility
```

## Future Website Environment Variable

When implemented in the website backend:

```text
DRIVE_UPLOAD_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
```

## Recommended First Version

Start simple:

1. Customer enters valuation details.
2. Customer clicks `Generate`.
3. Lead is saved to Supabase and Google Sheet.
4. Owner contacts customer by email or phone.
5. Owner asks customer to send photos manually.

Second version:

1. Add upload fields to the website.
2. Send files to Google Drive through Apps Script.
3. Save Drive folder URL in Supabase and show it in admin.
