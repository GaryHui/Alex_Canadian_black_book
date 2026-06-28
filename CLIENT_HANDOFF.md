# Client Handoff And Account Migration Guide

This document is the owner handoff checklist for moving this project from the developer's accounts to a client's accounts.

Use it when replacing:

- Vercel account/project
- Supabase project
- Google OAuth client
- Google Sheet, Google Drive folder, and Apps Script webhook
- Domain / production URL
- Admin and dealer staff emails
- Cloudflare Turnstile for production login protection, plus optional Resend, CRM webhook, and Google Form integrations

Do not send secret values in chat or email. Store them in Vercel environment variables, Supabase, Google Cloud, or the client's password manager.

## 1. Handoff Package

Give the client these items:

```text
GitHub repo access
Production URL
Vercel project access or transferred project
Supabase project access or new Supabase setup
Google Sheet link
Google Drive root folder link
Google Apps Script project link
Canadian Black Book API credential owner/contact
Admin login email list
Dealer staff email list
This document: CLIENT_HANDOFF.md
Setup reference: SETUP.md
Drive/Apps Script reference: GOOGLE_DRIVE_UPLOADS.md
```

Also keep a private handoff record with the non-secret account locations:

```text
Vercel team/project name:
GitHub repo:
Supabase project name:
Google Cloud project name:
Google OAuth Client ID name:
Google Sheet name:
Google Drive root folder name:
Apps Script deployment name:
Cloudflare Turnstile site name:
Resend domain/sender:
```

## 2. Client Accounts Needed

The client should own or invite you to:

```text
GitHub
Vercel
Supabase
Google account / Google Workspace
Google Cloud Console
Canadian Black Book API account
Cloudflare account for Turnstile login protection
Optional Resend account for automatic email replies
Optional CRM / Zapier / Make account
```

Recommended ownership:

```text
Client owns production Vercel, Supabase, Google, Cloudflare, Resend, and CRM accounts.
Developer keeps GitHub maintainer access only if future maintenance is needed.
```

## 3. Deployment Architecture

Current flow:

```text
Browser
  -> Vercel site / server.mjs
  -> Supabase for auth, leads, tasks, inventory, staff, settings
  -> Canadian Black Book API for vehicle values
  -> Google Apps Script webhook for Google Sheet, Drive photos, PDFs
  -> Optional CRM webhook
  -> Optional Resend email for after-hours auto replies
```

Public pages:

```text
/home.html or /
/customer.html
/buy.html
/login.html
```

Protected staff pages:

```text
/admin.html
/dealer.html
/admin-vehicles.html
```

## 3.1 Manual Branding Changes

When the client changes the website name, logo, icon, or hero image, update these code locations before redeploying Vercel.

### Website Name

Current public brand name:

```text
AutoSwitch Canada
```

Manual edit locations:

```text
public/home.html       Header aria-label and visible fallback brand text
public/home.js         English/French brandName text
public/buy.html        Header aria-label and visible fallback brand text
public/buy.js          English/French brandName text
public/customer.html   Header aria-label and visible fallback brand text
public/customer.js     English/French brandName text
public/login.html      Browser title and login page eyebrow
public/admin.js        Dashboard dealership label
```

Also check browser tab titles:

```text
public/home.html       <title>AutoSwitch Canada | Buy or Sell Your Car</title>
public/buy.html        <title>AutoSwitch Canada | Buy A Car</title>
public/customer.html   <title>AutoSwitch Canada | Sell Your Car</title>
public/login.html      <title>Sign in | AutoSwitch Canada</title>
```

Fast check after editing:

```text
Search the repo for the old brand name and confirm no old public-facing name remains.
```

### Header Logo / Icon

Current header mark is text-based:

```html
<span class="brand-mark">HC</span>
```

Manual edit locations:

```text
public/home.html
public/buy.html
public/customer.html
```

Visual styling lives here:

```text
public/customer.css    .brand, .brand-mark
```

If the client wants a real logo image instead of the `HC` text mark:

```text
1. Put the logo file in public/assets/, for example public/assets/client-logo.png.
2. Replace <span class="brand-mark">HC</span> with <img class="brand-logo" src="/assets/client-logo.png" alt="Client name" /> in home.html, buy.html, and customer.html.
3. Add .brand-logo styling in public/customer.css.
4. Keep the brand text beside it for clarity unless the client specifically wants icon-only.
```

### Browser Favicon

The current temporary favicon uses:

```text
public/assets/home-hero-car.png
```

For a final client brand, replace it with a dedicated favicon:

```text
1. Add public/assets/favicon.ico or public/assets/favicon.png.
2. Update this line inside the `<head>` of public/home.html, public/buy.html, public/customer.html, public/login.html, public/admin.html, public/admin-vehicles.html, and public/index.html. `public/index.html` is the dealer workbench page:
   <link rel="icon" href="/assets/favicon.png" />
3. Redeploy and hard-refresh the browser because favicons are heavily cached.
```

### Homepage Car Image

The homepage hero vehicle image is:

```text
public/assets/home-hero-car.png
```

To replace it:

```text
1. Save the new image with the same size/style if possible.
2. Replace public/assets/home-hero-car.png, or update the image path in public/home.html.
3. Check desktop and mobile after redeploy.
```

## 4. Migration Order

Follow this exact order for a clean client handoff:

```text
1. Decide final production domain.
2. Create or transfer Vercel project.
3. Create client Supabase project.
4. Run supabase.sql in client Supabase.
5. Configure Google OAuth in client's Google Cloud.
6. Enable Google provider in Supabase.
7. Create Google Sheet and Drive root folder in client's Google account.
8. Deploy Google Apps Script from GOOGLE_DRIVE_UPLOADS.md.
9. Add all environment variables to Vercel.
10. Redeploy Vercel.
11. Add admin emails and dealer staff.
12. Run the final acceptance checklist.
```

## 5. Vercel Environment Variables

Open:

```text
Vercel > Project > Settings > Environment Variables
```

Set variables for `Production`. If the client uses preview deployments, also add the safe values to `Preview`.

### Required For Production

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

PUBLIC_DEALER_NAME=
PUBLIC_DEALER_PHONE=
PUBLIC_DEALER_ADDRESS=
```

What they do:

| Variable | Purpose | Where To Get It |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL | Supabase > Project Settings > API |
| `SUPABASE_ANON_KEY` | Browser-safe Supabase auth key | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database key | Supabase > Project Settings > API |
| `PUBLIC_SITE_URL` | Production site URL for login redirects | Final Vercel/domain URL |
| `BLACKBOOK_USERNAME` | Canadian Black Book API username | CBB account |
| `BLACKBOOK_PASSWORD` | Canadian Black Book API password/key | CBB account |
| `BLACKBOOK_BASE_URL` | CBB API base URL | Usually fixed |
| `BLACKBOOK_API_PATH` | CBB API path | Usually fixed |
| `LEAD_WEBHOOK_URL` | Google Apps Script `/exec` URL | Apps Script deployment |
| `ADMIN_EMAILS` | Comma-separated admin Google emails | Client/admin list |
| `OWNER_EMAIL` | Owner contact email shown to users | Client |
| `OWNER_CONTACT` | Contact message when valuation limit is reached | Client |
| `PUBLIC_DEALER_NAME` | Public website dealer name in the contact footer | Client |
| `PUBLIC_DEALER_PHONE` | Public phone number shown on home, buy, and sell pages | Client |
| `PUBLIC_DEALER_ADDRESS` | Public address shown on home, buy, and sell pages | Client |

### Optional But Supported

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

Notes:

- `SUPABASE_SERVICE_ROLE_KEY`, `BLACKBOOK_PASSWORD`, `CRM_WEBHOOK_TOKEN`, `TURNSTILE_SECRET_KEY`, and `RESEND_API_KEY` are secrets.
- Never put secrets into frontend JavaScript.
- After changing Vercel variables, redeploy Vercel. Existing deployments do not automatically use new environment values.
- `PORT` is mainly for local development. Vercel does not normally need it.

## 6. How To See Existing Vercel Variables

If you are logged in to the current Vercel account locally, use:

```bash
vercel env ls
```

To pull local development variables into `.env.local`:

```bash
vercel env pull .env.local
```

Important:

- Do not commit `.env.local`.
- Do not paste secret values into GitHub issues, chat, or docs.
- The docs should record variable names and where to find values, not the actual secret values.

## 7. Supabase Setup

In the client's Supabase account:

1. Create a new project.
2. Open `Project Settings > API`.
3. Copy:

```text
Project URL
anon public key
service_role key
```

4. Open `SQL Editor`.
5. Run the full `supabase.sql` file.
6. Wait 30-60 seconds for Supabase schema cache.

Main tables expected:

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
dealer_settings
```

If admin inventory or leads fail to load, rerun `supabase.sql`, wait one minute, then reload the admin page.

## 8. Google OAuth Setup

The login uses Supabase Auth with Google provider.

In Google Cloud Console:

```text
APIs & Services > Credentials > Create Credentials > OAuth Client ID
Application type: Web application
```

Authorized JavaScript origins:

```text
https://CLIENT_DOMAIN_OR_VERCEL_URL
http://localhost:3000
```

Authorized redirect URI:

```text
https://CLIENT_SUPABASE_PROJECT.supabase.co/auth/v1/callback
```

Then in Supabase:

```text
Authentication > Providers > Google
Enable Google
Paste Google Client ID
Paste Google Client Secret
```

In Supabase URL configuration:

```text
Authentication > URL Configuration
Site URL: https://CLIENT_DOMAIN_OR_VERCEL_URL
Redirect URLs:
https://CLIENT_DOMAIN_OR_VERCEL_URL
http://localhost:3000
```

Common mistake:

```text
Do not put /auth/v1/callback under JavaScript origins.
That full URL belongs only in Authorized redirect URIs.
```

## 9. Google Sheet, Drive, And Apps Script

The website does not directly write into Google Drive. It sends data to:

```text
LEAD_WEBHOOK_URL
```

That URL points to a Google Apps Script Web App owned by the client's Google account.

Use:

```text
GOOGLE_DRIVE_UPLOADS.md
```

Client setup:

```text
1. Create a Google Drive root folder, for example "BlackBook Leads".
2. Copy the folder ID from the Drive URL.
3. Create or choose a Google Sheet for lead records.
4. Copy the Sheet ID from the Sheet URL.
5. Open Sheet > Extensions > Apps Script.
6. Paste the final script from GOOGLE_DRIVE_UPLOADS.md.
7. Replace:
   const SPREADSHEET_ID = "CLIENT_SHEET_ID";
   const DRIVE_ROOT_FOLDER_ID = "CLIENT_DRIVE_FOLDER_ID";
8. Run installHeaders and approve permissions.
9. Deploy as Web App.
10. Execute as: Me.
11. Who has access: Anyone.
12. Copy the /exec URL.
13. Put that URL into Vercel LEAD_WEBHOOK_URL.
14. Redeploy Vercel.
```

If the Apps Script `/exec` URL changes, update Vercel `LEAD_WEBHOOK_URL` and redeploy.

## 10. Admin And Staff Access

Admin access:

```text
ADMIN_EMAILS=owner@example.com,manager@example.com
```

Dealer staff access:

Preferred method:

```text
/admin.html > Dealer portal access > Add dealer
```

Emergency fallback:

```text
DEALER_EMAILS=sales1@example.com,sales2@example.com
```

Recommended permission model:

```text
ADMIN_EMAILS = owner and trusted managers
dealer_staff table = normal staff
DEALER_EMAILS = emergency fallback only
```

## 11. Production Security And Optional Services

### Cloudflare Turnstile

Recommended for every production site. It adds human verification before staff, manager, and customer login actions so bots cannot repeatedly trigger Google or email login flows.

```text
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Set both values in Vercel and redeploy. If only one is set, login verification can fail. For local testing or a temporary demo, the site can run without these values, but final production should enable them.

### Resend After-Hours Auto Reply

Use if the client wants automatic email replies outside business hours.

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=
AUTO_REPLY_FROM_EMAIL=
```

The admin page stores business hours and reply message in Supabase. Resend sends the actual email if configured.

### CRM Webhook

Use if the client has Make, Zapier, AutoRaptor, or another CRM webhook.

```text
CRM_WEBHOOK_URL=
CRM_WEBHOOK_TOKEN=
```

If `CRM_WEBHOOK_TOKEN` is set, the website sends:

```text
Authorization: Bearer TOKEN
```

### Google Form Legacy Output

These are supported but not the recommended main flow:

```text
GOOGLE_FORM_ACTION_URL=
GOOGLE_FORM_ID=
GOOGLE_FORM_FIELD_MAP=
GOOGLE_FORM_JSON_ENTRY=
```

Prefer `LEAD_WEBHOOK_URL` and Apps Script.

## 12. Domain Change Checklist

When moving from the demo URL to the client's domain:

```text
1. Add the domain in Vercel.
2. Update DNS at the domain provider.
3. Set Vercel PUBLIC_SITE_URL=https://CLIENT_DOMAIN.
4. Update Supabase Site URL to https://CLIENT_DOMAIN.
5. Add https://CLIENT_DOMAIN to Supabase Redirect URLs.
6. Add https://CLIENT_DOMAIN to Google OAuth Authorized JavaScript origins.
7. Keep http://localhost:3000 for local testing if needed.
8. Redeploy Vercel.
9. Test login from a fresh browser session.
```

## 13. Final Acceptance Checklist

Run this before handoff is complete.

### Public Site

```text
Open /
Open /customer.html
Open /buy.html
Open /login.html
Confirm mobile layout works
Confirm Sign out appears after login
```

### Login

```text
Log in with admin Google email
Log out
Log in with dealer staff Google email
Try a non-staff Google email and confirm admin/dealer access is blocked
```

### Sell / Valuation Flow

```text
Submit a seller valuation lead
Confirm Supabase valuation_leads row exists
Confirm Google Sheet row exists
Confirm Google Drive customer folder exists
Confirm PDF exists
Confirm admin sees the lead
Confirm assigned dealer staff sees the lead
```

### CRM Workflow

```text
Admin assigns a lead to staff
Staff adds timeline update
Admin receives update alert
Admin adds task
Staff receives task/update
Opening the lead clears the update alert
SOP progress and next action display correctly
```

### Inventory / Buy Page

```text
Move a seller vehicle into inventory
Upload inventory photos
Publish listing
Open /buy.html
Confirm vehicle appears
Open vehicle details
Submit buyer inquiry
Confirm buyer inquiry becomes a CRM lead
```

### After-Hours Auto Reply

If configured:

```text
Set business hours to closed
Submit a buyer/seller inquiry
Confirm auto-reply is queued or sent
Confirm admin can see the lead
```

## 14. Troubleshooting Map

| Problem | Check First |
| --- | --- |
| Google login returns to localhost | Supabase Site URL and `PUBLIC_SITE_URL` |
| Admin says access not configured | `ADMIN_EMAILS` in Vercel |
| Dealer sees no leads | lead assignment, dealer staff table, `DEALER_EMAILS` fallback |
| Valuation returns mock/no matches | `BLACKBOOK_USERNAME` and `BLACKBOOK_PASSWORD` |
| Leads not saved | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| Google Sheet not updated | `LEAD_WEBHOOK_URL`, Apps Script deployment, Vercel redeploy |
| Drive photos/PDF missing | Apps Script `DRIVE_ROOT_FOLDER_ID`, permissions, final script version |
| Buy page photos not visible | listing published, photos uploaded, publish photos checked, Drive public image access |
| Auto reply not sent | `RESEND_API_KEY`, sender email, business hours settings |

## 15. What To Ask The Client For

Before migration, ask the client to provide:

```text
Final domain:
Admin Google emails:
Dealer staff Google emails:
Business name:
Business phone:
Business email:
Business address:
Google account that owns Drive/Sheet:
Canadian Black Book API contact or credentials:
Turnstile login protection: required for production unless client explicitly accepts the risk
Whether after-hours auto reply is required:
Whether CRM webhook is required:
```

For secrets, ask them to enter values directly into Vercel/Supabase/Google or share through a password manager.

## 16. Recommended Final Handoff

At handoff, give the client:

```text
Production URL
Admin URL: /admin.html
Dealer URL: /dealer.html
Buy page URL: /buy.html
Google Sheet URL
Google Drive root folder URL
Supabase project URL
Vercel project URL
GitHub repo URL
This document
```

Then confirm:

```text
Client owner can log into Vercel
Client owner can log into Supabase
Client owner can open Google Sheet and Drive folder
Client owner can log into /admin.html
At least one staff account can log into /dealer.html
```
