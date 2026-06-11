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

Every customer lead gets its own subfolder.

Recommended folder name:

```text
<date> - <customer email> - <VIN or UVC>
```

Example:

```text
2026-06-11 - customer@example.com - 2T2GGCEZ9RC032642
```

If there is no VIN:

```text
2026-06-11 - customer@example.com - 2024500170
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

This is a separate Apps Script Web App from the Google Sheet lead webhook, or it can be added to the same Apps Script project if preferred.

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
  const folderName = buildFolderName_(data);
  const folder = root.createFolder(folderName);

  const files = (data.files || []).map(function(file) {
    const bytes = Utilities.base64Decode(file.base64 || "");
    const blob = Utilities.newBlob(bytes, file.mimeType || "application/octet-stream", file.name || "upload");
    const driveFile = folder.createFile(blob);
    return {
      name: driveFile.getName(),
      id: driveFile.getId(),
      url: driveFile.getUrl()
    };
  });

  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      folderName: folder.getName(),
      folderId: folder.getId(),
      folderUrl: folder.getUrl(),
      files: files
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildFolderName_(data) {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const email = sanitize_(data.email || "unknown-email");
  const vehicleId = sanitize_(data.vin || data.uvc || data.leadId || "unknown-vehicle");
  return date + " - " + email + " - " + vehicleId;
}

function sanitize_(value) {
  return String(value)
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
```

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

