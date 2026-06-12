# Project Structure

This project is a lightweight vehicle valuation and lead-management MVP.

## Main Runtime

- `server.mjs`  
  Local development server. It serves static files from `public/` and routes `/api/*` requests to the API modules.

- `vercel.json`  
  Vercel deployment routing.

- `package.json`  
  Minimal scripts for local development.

## Frontend

- `public/index.html`, `public/customer.html`, `public/customer.js`, `public/customer.css`  
  Customer-facing valuation flow. Customers sign in with Google, search or identify a vehicle, confirm details, upload photos, and request a valuation.

- `public/admin.html`, `public/admin.js`  
  Internal admin/dealer workflow. Admins can manage dealer access, valuation limits, captured leads, assignment, priority, follow-up dates, notes, and tasks.

- `public/login.html`, `public/login.js`  
  Shared login helper pages.

- `public/styles.css`  
  Shared styling for admin, customer, and dealer screens.

- `public/turnstile.js`  
  Cloudflare Turnstile helper used before Google sign-in.

## API

- `api/config.js`  
  Sends safe public config to the browser, such as Supabase URL/anon key and Turnstile site key.

- `api/valuation.js`  
  Server-side Canadian Black Book valuation call. The Black Book key stays on the server.

- `api/autocomplete.js`, `api/drilldown.js`  
  Vehicle search and drilldown helpers.

- `api/leads.js`  
  Creates and lists captured leads. Also sends leads to Google Apps Script / CRM webhooks.

- `api/lead-activity.js`  
  MVP CRM activity endpoint for notes, tasks, and email records.

- `api/my-leads.js`  
  Customer quote history.

- `api/usage.js`, `api/user-limits.js`  
  Annual valuation limit checks and admin limit management.

- `api/_admin.js`  
  Admin authentication helper.

- `api/turnstile-verify.js`  
  Human-verification endpoint.

## Database

- `supabase.sql`  
  Supabase PostgreSQL schema and migrations. Run this in Supabase SQL Editor whenever database fields or tables are added.

Core tables:

- `valuation_leads`  
  Main valuation lead records.

- `valuation_user_limits`  
  Annual valuation allowance per user.

- `dealer_staff`  
  Dealer portal access list.

- `lead_notes`  
  Communication, inspection, offer, and internal follow-up notes.

- `lead_tasks`  
  Follow-up tasks and due dates.

- `lead_emails`  
  Email records. Later this can connect to Resend, SendGrid, Gmail API, or a CRM.

## Google Integration

- `GOOGLE_DRIVE_UPLOADS.md`  
  Final Apps Script for saving leads, photos, PDF summaries, and spreadsheets into Google Drive.

- `GOOGLE_APPS_SCRIPT_WEBHOOK.md`  
  Older webhook notes and Google Sheet setup notes.

- `DEALER_AND_DRIVE_SETTINGS.md`  
  Dealer portal and Drive setup notes.

## Setup

- `SETUP.md`  
  Supabase, Google OAuth, Vercel, Black Book, Turnstile, and deployment setup.

- `.env.example`  
  Example environment variables.
