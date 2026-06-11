# Setup Guide

This guide explains how to configure Google login, Supabase lead storage, Black Book API credentials, and Vercel deployment.

## Setup Order

Follow this order:

```text
1. Create Supabase project.
2. Run database SQL.
3. Configure Google OAuth in Google Cloud.
4. Enable Google provider in Supabase.
5. Configure Supabase URL settings.
6. Add environment variables in Vercel.
7. Redeploy Vercel.
8. Test Google login.
9. Test vehicle lookup and lead capture.
10. Check captured leads in admin page.
```

## 1. Create Supabase Project

Create a Supabase project at:

```text
https://supabase.com
```

After the project is created, open:

```text
Project Settings > API
```

Copy these values:

```text
Project URL
anon public key
service_role key
```

Do not expose the `service_role` key in frontend code. It is only used as a Vercel server environment variable.

## 2. Create Database Table

Open:

```text
Supabase > SQL Editor
```

Run the SQL from:

```text
supabase.sql
```

If the table already exists, run `supabase.sql` again. It includes `alter table ... add column if not exists` for newer fields such as:

```text
auth_user
owner_adjustment
```

It creates:

```text
valuation_leads
```

This table stores:

```text
customer email
customer phone
Google auth user
VIN / UVC / year / make / model / series / style
kilometers
color
region / country
Black Book valuation result
lead status
admin notes
```

## 3. Enable Google Login

Open:

```text
Supabase > Authentication > Providers > Google
```

Enable Google provider.

You need Google OAuth credentials from:

```text
https://console.cloud.google.com/apis/credentials
```

Create an OAuth Client ID:

```text
Application type: Web application
```

In Google Cloud, fill the OAuth fields like this.

Authorized JavaScript origins must contain domains only. Do not include paths such as `/auth/v1/callback`.

For production:

```text
https://blackbook-demo.vercel.app
```

For local testing:

```text
http://localhost:3000
```

Authorized redirect URIs must contain the full Supabase callback URL. Supabase shows it in the Google provider settings. It usually looks like:

```text
https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback
```

For this project, it is:

```text
https://nmxvqpuaupoygkqnhhwu.supabase.co/auth/v1/callback
```

Then paste into Supabase:

```text
Google Client ID
Google Client Secret
```

If Google shows this error:

```text
Invalid Origin: URIs must not contain a path or end with "/".
```

It means the Supabase callback URL was accidentally added under `Authorized JavaScript origins`. Move it to `Authorized redirect URIs`, and put only the domain in `Authorized JavaScript origins`.

## 4. Supabase Redirect URLs

Open:

```text
Supabase > Authentication > URL Configuration
```

Set Site URL:

```text
https://blackbook-demo.vercel.app
```

Do not set the production Site URL to `http://localhost:3000`. If Site URL is localhost, Google login may return to localhost and fail when the local server is not running.

Add Redirect URLs:

```text
https://blackbook-demo.vercel.app
http://localhost:3000
```

Use `http://localhost:3000` only for local testing, and only when the local server is running.

If Google redirects to:

```text
http://localhost:3000/#access_token=...
```

but the browser shows `ERR_CONNECTION_REFUSED`, the local server is not running. Start it first:

```powershell
cd E:\2026\Alex\blackbook-demo
node server.mjs
```

For production testing, open and sign in from:

```text
https://blackbook-demo.vercel.app/login.html
```

The app now uses a separate login page. Users who are not signed in are redirected to `/login.html` and cannot use valuation forms until Google login succeeds.

In Vercel, add this optional but recommended environment variable:

```text
PUBLIC_SITE_URL=https://blackbook-demo.vercel.app
```

This ensures Google OAuth always returns to the production site during production testing.

## 5. Vercel Environment Variables

Open:

```text
Vercel > blackbook-demo > Settings > Environment Variables
```

Add:

```text
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PUBLIC_SITE_URL=https://blackbook-demo.vercel.app
```

Add Black Book credentials:

```text
BLACKBOOK_USERNAME=NovoraAPI
BLACKBOOK_PASSWORD=your_black_book_api_password_or_key
BLACKBOOK_BASE_URL=https://service.canadianblackbook.com
BLACKBOOK_API_PATH=/UsedCarWS/CanUsedAPI
```

Optional: send every successful Generate result to a Google Form:

```text
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_APPS_SCRIPT_WEB_APP_ID/exec
GOOGLE_FORM_ACTION_URL=https://docs.google.com/forms/d/e/YOUR_PUBLIC_FORM_ID/formResponse
GOOGLE_FORM_FIELD_MAP={"email":"entry.111","phone":"entry.222","vin":"entry.333","year":"entry.444","make":"entry.555","model":"entry.666","series":"entry.777","style":"entry.888","kilometers":"entry.999","color":"entry.101","region":"entry.102","wholesaleAvg":"entry.103","retailAvg":"entry.104","tradeInAvg":"entry.105","cbbJson":"entry.106"}
```

For a quick test with only one Google Form paragraph question, use:

```text
GOOGLE_FORM_ACTION_URL=https://docs.google.com/forms/d/e/YOUR_PUBLIC_FORM_ID/formResponse
GOOGLE_FORM_JSON_ENTRY=entry.111
```

Important checks:

```text
PUBLIC_SITE_URL must be https://blackbook-demo.vercel.app
PUBLIC_SITE_URL must not be http://localhost:3000 in Production
BLACKBOOK_USERNAME and BLACKBOOK_PASSWORD must be added to Production, not only Preview/Development
```

If Free Form search says `No matches` for known vehicles, first check whether Vercel has the Black Book credentials. Without them, the app runs in mock mode.

After adding variables, redeploy:

```text
Vercel > Deployments > Redeploy
```

## 6. Apps Script / CRM Webhook Lead Sync

This is the recommended owner workflow. Supabase remains the main database, and the webhook sends a clean copy of every successful `Generate` result to Google Apps Script, Google Sheet automation, Make/Zapier, or a CRM webhook.

Detailed owner handoff steps and the header-aware Apps Script code are in:

```text
GOOGLE_APPS_SCRIPT_WEBHOOK.md
```

Vercel variable:

```text
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_APPS_SCRIPT_WEB_APP_ID/exec
```

The app POSTs JSON like:

```json
{
  "email": "customer@example.com",
  "phone": "604-000-0000",
  "vin": "2T2GGCEZ9RC032642",
  "uvc": "2024500170",
  "year": "2024",
  "make": "Lexus",
  "model": "NX-Series",
  "series": "NX350 Premium",
  "style": "4D Utility AWD",
  "kilometers": 37000,
  "color": "White",
  "region": "British Columbia",
  "country": "C",
  "wholesaleAvg": 44321,
  "retailAvg": 47912,
  "tradeInAvg": "",
  "cbbJson": "{...}",
  "raw": {
    "input": {},
    "valuation": {},
    "auth_user": {}
  }
}
```

For Google Apps Script, the Sheet webhook can read those properties and append them to a row. For a CRM, point `LEAD_WEBHOOK_URL` to the CRM webhook endpoint or to Make/Zapier.

To change to another website owner's Google Sheet later:

1. Deploy a new Apps Script Web App from that owner's Google Sheet.
2. Copy the new `/exec` URL.
3. Replace `LEAD_WEBHOOK_URL` in Vercel Production.
4. Redeploy Vercel.

## 7. Google Form Lead Sync

Google Form sync is optional. Supabase remains the main database. When configured, every successful `Generate` result is also submitted to the Google Form.

Important: use the published form, not the edit form.

The edit URL looks like:

```text
https://docs.google.com/forms/d/FORM_ID/edit
```

That is only for editing. The app needs the submit URL:

```text
https://docs.google.com/forms/d/e/PUBLIC_FORM_ID/formResponse
```

Setup steps:

1. In Google Forms, create one short-answer or paragraph question for each field:

```text
Customer Email
Phone
VIN
Year
Make
Model
Series / Trim
Style
Kilometers
Color
Region
Wholesale AVG
Retail AVG
Trade-In AVG
Full CBB JSON
```

2. Click `Publish`.

3. Open the published form link in a browser.

4. Right click the page and choose `View page source`, then search for `entry.`.

5. Copy each `entry.xxxxx` and map it to the matching field in `GOOGLE_FORM_FIELD_MAP`.

Example:

```text
GOOGLE_FORM_FIELD_MAP={"email":"entry.111111","phone":"entry.222222","vin":"entry.333333","year":"entry.444444","make":"entry.555555","model":"entry.666666","series":"entry.777777","style":"entry.888888","kilometers":"entry.999999","color":"entry.101010","region":"entry.111222","wholesaleAvg":"entry.222333","retailAvg":"entry.333444","tradeInAvg":"entry.444555","cbbJson":"entry.555666"}
```

Supported map keys:

```text
email
phone
vin
uvc
year
make
model
series
style
kilometers
color
region
country
wholesaleAvg
retailAvg
tradeInAvg
cbbJson
```

Quick test option:

If you do not want to create all fields yet, create one paragraph question named `Full Submission JSON`, publish the form, and set:

```text
GOOGLE_FORM_JSON_ENTRY=entry.111111
```

The app will submit the whole lead and valuation result as JSON to that one field.

The current test form must be published before it can receive submissions. If the published form page says `This document is not published`, Google will reject the sync.

## 8. Local Environment

For local testing, create:

```text
.env.local
```

Use:

```text
BLACKBOOK_USERNAME=NovoraAPI
BLACKBOOK_PASSWORD=your_black_book_api_password_or_key
BLACKBOOK_BASE_URL=https://service.canadianblackbook.com
BLACKBOOK_API_PATH=/UsedCarWS/CanUsedAPI
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_APPS_SCRIPT_WEB_APP_ID/exec
GOOGLE_FORM_ACTION_URL=https://docs.google.com/forms/d/e/YOUR_PUBLIC_FORM_ID/formResponse
GOOGLE_FORM_FIELD_MAP={"email":"entry.111","phone":"entry.222","vin":"entry.333","year":"entry.444","make":"entry.555","model":"entry.666","series":"entry.777","style":"entry.888","kilometers":"entry.999","color":"entry.101","region":"entry.102","wholesaleAvg":"entry.103","retailAvg":"entry.104","tradeInAvg":"entry.105","cbbJson":"entry.106"}
PORT=3000
```

Run:

```powershell
cd E:\2026\Alex\blackbook-demo
node server.mjs
```

Open:

```text
http://localhost:3000
```

## 9. Admin Page

Open:

```text
https://blackbook-demo.vercel.app/admin.html
```

The admin page requires Google login. Only emails listed in this Vercel environment variable can access admin APIs:

```text
ADMIN_EMAILS=owner@example.com,manager@example.com
```

Example for the current owner:

```text
ADMIN_EMAILS=touchdreamwork@gmail.com
```

Important: `/admin.html` is not protected by page secrecy alone. The protected data APIs also verify the Supabase session token and admin email.

The admin page shows captured leads:

```text
Google user email
customer email
phone
VIN / UVC
vehicle description
kilometers
color
region
AVG wholesale
AVG retail
valuation summary
```

The owner can also enter a second/manual review:

```text
status
owner wholesale value
owner retail value
reason for adjustment
admin notes
```

This supports cases where the owner believes the CBB value is too low or too high and wants to manually intervene before contacting the customer.

If the admin page does not show data, check:

```text
1. ADMIN_EMAILS is set on Vercel and includes the Google email you used.
2. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set on Vercel.
3. The latest supabase.sql has been run in Supabase SQL Editor.
4. At least one valuation has been generated after Supabase storage was configured.
```

Note: Vercel runs this demo through `server.mjs`. Admin storage, user limits, and protected admin APIs must therefore be available in `server.mjs`, not only in the `api/` folder.

## 7.1 Yearly Valuation Limits

The app supports a yearly valuation allowance per signed-in Google user.

Default behavior:

```text
Each logged-in user gets 3 successful valuations per year.
```

The default can be changed with this Vercel environment variable:

```text
ANNUAL_VALUATION_LIMIT=3
```

When a user signs in, the front end calls:

```text
GET /api/usage?userId=<supabase_user_id>&email=<email>
```

The main page displays:

```text
Annual valuations
2 left
1 used of 3 in 2026
```

If `remaining` is `0`, the app blocks valuation generation and shows a contact message.

The contact text can be customized with:

```text
OWNER_CONTACT=Please call 604-000-0000 or email sales@example.com for more valuations.
```

### How The Owner Changes A User's Allowance

Open:

```text
https://blackbook-demo.vercel.app/admin.html
```

The `User valuation limits` section shows:

```text
user email
used count this year
remaining count
annual limit
```

The owner can change `Annual limit` and click `Save limit`.

Example:

```text
User used 3 of 3.
Owner changes Annual limit to 5.
User now has 2 valuations left this year.
```

This uses:

```text
GET   /api/user-limits
PATCH /api/user-limits
```

Data is stored in:

```text
valuation_user_limits
```

## 8. How the Website Owner Gets User Data

When a signed-in user completes a valuation, the app saves one row in Supabase:

```text
table: valuation_leads
```

The row includes:

```text
auth_user.email          Google login email
input.email              customer email shown in the form
input.phone              customer phone
input.vin                VIN, if provided
input.uvc                selected Black Book UVC, if selected
input.year
input.make
input.model
input.series
input.style
input.kilometers
input.color
input.region
input.country
valuation.values         CBB wholesale/retail result
valuation.thresholds     kilometer thresholds
status                   lead status
notes                    admin notes
owner_adjustment         owner's second/manual valuation
auth_user_id             Supabase Auth user ID for usage limits
auth_email               user email for owner/admin lookup
valuation_year           year used for annual count
```

The owner can view these records in:

```text
https://blackbook-demo.vercel.app/admin.html
```

Or directly in Supabase:

```text
Supabase > Table Editor > valuation_leads
```

This is the data source for future CRM integration.

## 9. Search vs Generate

The app has two actions with different meanings.

### Search

Search is used to find or narrow down the vehicle.

Examples:

```text
Free Form: "2017 Honda O"
Year / Make / Model: 2017 Honda Odyssey LX 4D Wagon
VIN: 2T2GGCEZ9RC032642
```

Search may call:

```text
Autocomplete
UsedVehicle by VIN
UsedVehicle by year/make/model
```

If CBB returns multiple possible vehicles, the app asks the user to choose the correct trim/UVC.

### Generate

Generate creates the actual valuation result after the vehicle is known.

Generate saves:

```text
user contact info
vehicle input
selected UVC/VIN
CBB valuation result
thresholds
lead status
```

In short:

```text
Search = find/identify the vehicle.
Generate = create valuation and capture the lead.
```

## 10. CRM Handoff

The current lead structure is ready for CRM sync:

```text
valuation_leads.input
valuation_leads.auth_user
valuation_leads.valuation
valuation_leads.status
valuation_leads.notes
```

Future CRM integration options:

```text
1. Supabase Edge Function sends new leads to CRM.
2. Vercel Cron checks new leads and syncs them.
3. Zapier / Make reads Supabase rows and pushes to CRM.
4. Manual export from Supabase.
```

Recommended lead status values:

```text
new
reviewing
manual_adjustment
contacted
sent_to_crm
closed
```

## 11. Canadian Trade Value API

Trade-In values are not returned by the standard Used Car Web API response currently used by the demo.
Canadian Black Book documents a separate Trade Value API that should be used together with the standard Used Car Web API.

Base URI:

```text
https://tradevalue.blackbookcloud.com/api
```

Main workflow:

```text
1. Identify the vehicle with the standard Used Car Web API.
2. Get a UVC for the selected vehicle.
3. Get add/deduct options from UsedVehicle/UVC.
4. Call Trade Value Questions to build the condition questionnaire.
5. Optionally call Analytics after each completed question.
6. Post answers to Trade Value Valuation to receive the trade value.
```

### Questions

Returns the question list for the UI.

```text
GET /CanTradeValue/Questions/{versionID}
```

Optional vehicle parameters can be added when the question set needs damage ranges:

```text
vin
uvc
mileage
state
adcodes
```

Example:

```text
https://tradevalue.blackbookcloud.com/api/CanTradeValue/Questions/2?vin=2C4RDGBG1CR385500&uvc=2012240363&mileage=100000&state=NB&adcodes=08,N5
```

The response contains questions, parent/child relationships, input types, and valid answers.

### Analytics

Called each time the user completes a question.

```text
GET /CanTradeValue/Analytics/{versionID}/{visitorID}/{uvc}/{questionID}?answer={answerText}
```

Example:

```text
https://tradevalue.blackbookcloud.com/api/CanTradeValue/Analytics/2/a1b239/2012020080/1001000?answer=Y
```

Expected response:

```text
OK
```

### Valuation

Returns the final trade value.

```text
POST /CanTradeValue/Valuation/{versionID}/{visitorID}
```

Request body shape:

```json
{
  "vin": "",
  "uvc": "2010020057",
  "mileage": 30000,
  "state": "NB",
  "basevalue": 25000,
  "adcodes": ["CH", "09"],
  "answers": [
    { "questionID": 1001000, "answerText": "1" },
    { "questionID": 4001000, "answerText": "N" }
  ]
}
```

Response shape:

```json
{
  "ResponseCode": 0,
  "ResponseMessage": "Success",
  "Valued": true,
  "Value": 0
}
```

### Current Test Result

The current Used Car API credentials work for:

```text
https://service.canadianblackbook.com/UsedCarWS/CanUsedAPI
```

But the same credentials returned `401 Unauthorized` for:

```text
GET  https://tradevalue.blackbookcloud.com/api/CanTradeValue/Questions/2
POST https://tradevalue.blackbookcloud.com/api/CanTradeValue/Valuation/2/a1b239
```

Ask Canadian Black Book to confirm:

```text
1. Enable Canadian Trade Value API for the API user.
2. Confirm the versionID to use.
3. Confirm authentication method: Basic Auth, query string credentials, IP allowlist, domain auth, or token auth.
4. Provide the question/answer spreadsheet.
5. Confirm whether Analytics is mandatory before Valuation.
```

## 12. Production Checklist

Before public launch:

```text
Protect /admin.html with admin login.
Enable email verification in Supabase Auth.
Add yearly valuation limit per user.
Add API logs.
Add reCAPTCHA or Cloudflare Turnstile.
Add privacy policy and terms.
Confirm Black Book production API permissions.
Confirm Canadian Trade Value API access and versionID.
Enable Supabase backups.
```
