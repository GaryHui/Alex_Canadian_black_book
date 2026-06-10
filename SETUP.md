# Setup Guide

This guide explains how to configure Google login, Supabase lead storage, Black Book API credentials, and Vercel deployment.

## 1. Supabase Project

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
```

Add Black Book credentials:

```text
BLACKBOOK_USERNAME=NovoraAPI
BLACKBOOK_PASSWORD=your_black_book_api_password_or_key
BLACKBOOK_BASE_URL=https://service.canadianblackbook.com
BLACKBOOK_API_PATH=/UsedCarWS/CanUsedAPI
```

After adding variables, redeploy:

```text
Vercel > Deployments > Redeploy
```

## 6. Local Environment

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

## 7. Admin Page

Open:

```text
https://blackbook-demo.vercel.app/admin.html
```

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

Important: the current admin page is not yet protected by admin-only login. Before production, restrict it to admin users only.

## 8. CRM Handoff

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

## 9. Production Checklist

Before public launch:

```text
Protect /admin.html with admin login.
Enable email verification in Supabase Auth.
Add yearly valuation limit per user.
Add API logs.
Add reCAPTCHA or Cloudflare Turnstile.
Add privacy policy and terms.
Confirm Black Book production API permissions.
Confirm whether trade-in values require another endpoint/template/account permission.
Enable Supabase backups.
```
