# Dealership Maturity Acceptance Audit

Date: 2026-06-28
Scope: public home page, buy page, vehicle detail, sell page, login, dealer workbench, owner/admin workbench, and mobile public pages.

## Verdict

The site is now close to a usable small-dealership CRM and public website MVP. The core business loop is present: buyer lead intake, seller lead intake, staff workbench, owner/admin review, task tracking, timeline feedback, inventory/listing management, and public vehicle browsing.

It is not yet a fully finished client handoff until the production environment and client content are completed. The largest remaining issues are configuration/data quality issues, not basic page availability issues.

## Evidence Captured

Local desktop screenshots:

```text
01-home-desktop.png
02-buy-desktop.png
03-buy-detail-desktop.png
04-sell-desktop.png
05-login-desktop.png
06-dealer-desktop.png
07-admin-desktop.png
08-home-fixed.png
09-buy-fixed.png
10-sell-fixed.png
11-login-fixed.png
12-dealer-fixed.png
13-admin-fixed.png
```

Live authenticated screenshots:

```text
14-live-dealer-dashboard.png
15-live-dealer-workspace.png
16-live-admin-dashboard.png
17-live-admin-workspace.png
```

Mobile screenshots:

```text
18-mobile-home.png
19-mobile-buy.png
20-mobile-buy-detail.png
21-mobile-sell.png
```

## Fixed In This Pass

1. Added public SEO descriptions to home, buy, sell, login, dealer, admin, and vehicle cluster pages.
2. Added favicon links to all main pages. The current favicon is temporary and uses the homepage car image until the client supplies a final icon.
3. Added a public dealer contact footer to home, buy, and sell pages.
4. Added Vercel-configurable public dealer contact fields:
   - `PUBLIC_DEALER_NAME`
   - `PUBLIC_DEALER_PHONE`
   - `PUBLIC_DEALER_EMAIL`
   - `PUBLIC_DEALER_ADDRESS`
5. Updated internal browser titles so staff/admin pages no longer look like a generic demo in the tab title.
6. Updated handoff documentation with the new contact variables and corrected the settings table name to `dealer_settings`.

## Page Acceptance Notes

### Home Page

Status: pass for MVP.

The page clearly directs users to buy or sell, has a polished vehicle-led visual direction, and works on mobile. The footer now exposes the dealer contact layer or a clear fallback if no contact information is configured.

Remaining client setup:

```text
Set final dealer name, phone, email, address, logo, favicon, and production domain.
```

### Buy Page

Status: pass for MVP, conditional for production inventory quality.

Search/filter browsing and vehicle detail opening work. Mobile display is usable. The listing experience is acceptable for a small dealer.

Production requirement:

```text
Do not publish listings without year, make, model, trim/style, VIN where appropriate, price, photos, and availability status.
```

Future improvement:

```text
Move from modal-only details to shareable vehicle detail URLs for stronger SEO and sales sharing.
```

### Sell Page

Status: pass for MVP.

The sell/valuation intake path is clear and mobile-friendly. This page can create seller leads when production integrations are configured.

Production requirement:

```text
Verify Google Apps Script webhook, Google Sheet, Drive photo upload, and Canadian Black Book credentials in the client's accounts.
```

### Login Page

Status: pass for MVP.

Google login entry is clear. Production depends on Supabase Google OAuth callback and `PUBLIC_SITE_URL` being set to the final domain.

### Dealer Workbench

Status: pass for CRM structure, needs true staff-account verification before final delivery.

Observed live page includes assigned lead queue, updates, tasks, valuation, quotes, inventory access, and workspace actions. This matches the intended staff flow: know assigned work, update progress, and send feedback through timeline/tasks.

Acceptance gap:

```text
The live session used a manager/owner-capable account. Before client handoff, verify one normal staff account can see only its assigned leads and can open the lead drawer/workspace correctly.
```

### Owner/Admin Workbench

Status: pass for CRM structure, blocked by one production database/configuration issue.

Observed live page includes owner dashboard, lead updates, totals, staff access, inventory, settings, and workspace navigation.

Production issue:

```text
The live admin page reports that the dealer_settings table must be created to save operations settings. Run the latest supabase.sql in the production Supabase project and redeploy/retest settings.
```

This affects work-hours settings and after-hours auto reply persistence.

### Mobile

Status: pass for public pages checked.

Home, buy, vehicle detail modal, and sell pages remain usable at mobile width. Public contact footer remains readable.

## Mature Dealership CRM Checklist

| Area | Current Status | Notes |
| --- | --- | --- |
| Seller lead intake | Implemented | Needs production webhook/API check |
| Buyer inquiry intake | Implemented | Needs production inquiry submission check |
| Staff assignment | Implemented | Verify with true staff account |
| Owner review | Implemented | Admin dashboard present |
| Tasks and next actions | Implemented | Staff/admin CRM loop present |
| Timeline feedback | Implemented | Update feed present |
| Vehicle photos | Implemented | Keep max photo rules and publish checklist |
| Valuation | Implemented | Depends on CBB production credentials |
| Inventory/listings | Implemented | Data quality gate required |
| Work hours / auto reply | Implemented in UI/API | Production `dealer_settings` table must exist |
| Public SEO basics | Improved | Meta descriptions added |
| Brand handoff | Documented | Client must supply final assets |

## Final Client Handoff Blockers

These should be resolved before saying the client's production site is fully accepted:

1. Run the latest `supabase.sql` in production Supabase and confirm `dealer_settings` exists.
2. Fill public dealer contact variables in Vercel.
3. Replace the temporary favicon with the client favicon/logo.
4. Test a normal staff account, not only owner/manager access.
5. Submit one test seller lead and confirm Sheet/Drive/PDF output.
6. Submit one test buyer inquiry and confirm owner/staff notification path.
7. Publish one real vehicle listing with complete data and photos, then inspect it on desktop and mobile.

## Verification Performed

```text
node --check public/contact.js
node --check public/app.js
node --check public/buy.js
git diff --check
Browser inspection on local public pages
Browser inspection on live logged-in dealer/admin pages
Mobile viewport inspection for home, buy, vehicle detail, and sell pages
```
