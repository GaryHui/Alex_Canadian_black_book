# Dealer Portal And Google Drive Settings

This document explains two owner settings:

1. Which Google Drive receives uploaded customer photos and generated PDFs.
2. Which emails can sign in to the dealer portal.

## Where Photos And PDFs Go

The website does not directly choose the Google Drive folder.

Photos and PDFs are sent to the Google Apps Script URL configured in Vercel:

```text
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

That Apps Script decides which Google Drive folder receives the files.

Inside Apps Script, this line controls the destination:

```javascript
const DRIVE_ROOT_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID";
```

To change the Drive destination:

1. Open the website owner's Google Drive.
2. Create or choose a root folder, for example `BlackBook Leads`.
3. Copy the folder ID from the Drive URL.
4. Open the connected Google Sheet.
5. Click `Extensions > Apps Script`.
6. Replace `DRIVE_ROOT_FOLDER_ID`.
7. Deploy the Apps Script web app again.
8. If the `/exec` URL changes, update `LEAD_WEBHOOK_URL` in Vercel.
9. Redeploy Vercel.

The final Apps Script is in:

```text
GOOGLE_DRIVE_UPLOADS.md
```

## Dealer Portal Access

`/admin.html` is for website owners/admins.

`/dealer.html` is for dealership staff.

Admins are controlled by this Vercel environment variable:

```text
ADMIN_EMAILS=owner@example.com,manager@example.com
```

Admins can also open the dealer portal automatically, so the website owner is not locked out.

Dealer staff can be managed in:

```text
https://blackbook-demo.vercel.app/admin.html
```

Open `Dealer portal access`, enter the staff Google email, then click `Add dealer`.

## Required Supabase Table

Run this in Supabase SQL Editor:

```sql
create table if not exists public.dealer_staff (
  email text primary key,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Optional Vercel Fallback

Dealer emails can also be controlled by Vercel:

```text
DEALER_EMAILS=sales1@example.com,sales2@example.com
```

Emails in `DEALER_EMAILS` can sign in to `/dealer.html`, but they cannot be removed from the admin page. To remove them, edit the Vercel environment variable and redeploy.

## Recommended Permission Model

Use this setup:

```text
ADMIN_EMAILS = website owner and trusted managers
dealer_staff table = dealership staff
DEALER_EMAILS = emergency fallback only
```

