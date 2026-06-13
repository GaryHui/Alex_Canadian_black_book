# AutoSwitch Canada MVP Feature Plan

This document records the product direction and development order for turning the current valuation tool into a small vehicle marketplace and dealer CRM MVP.

## MVP Meaning

MVP means **Minimum Viable Product**.

It is the smallest usable version of the product that can be tested with real users and real dealer staff. The goal is not to build every final feature at once. The goal is to build the shortest complete business loop:

```text
Customer wants to sell car
> Customer submits valuation
> Dealer reviews and follows up
> Dealer can turn the vehicle into inventory
> Buyer sees inventory
> Buyer contacts dealer
```

## Product Structure

## Modular Architecture Principle

Each business area should be a module that can work independently, while sharing IDs and events with related modules.

This keeps the project easier to maintain:

- a valuation lead can exist without becoming inventory
- inventory can exist without coming from a valuation lead
- buyer inquiries can exist without a finance estimate
- finance estimates can exist before a real lender integration
- CRM follow-up can manage both seller leads and buyer leads
- Google Sheet, Google Drive, and future CRM webhooks are integrations, not the source of truth

Recommended modules:

```text
Home module
  routes users to Buy or Sell

Sell / Valuation module
  creates valuation_leads

Dealer CRM module
  manages assignment, notes, tasks, follow-up, owner review

Inventory module
  manages vehicle_listings and listing_photos

Buy module
  reads published vehicle_listings and creates buyer_inquiries

Finance module
  calculates and stores finance_estimates

Integration module
  sends data to Google Sheet, Google Drive, CRM webhook, email provider
```

Module relationships:

```text
valuation_leads --optional--> vehicle_listings
vehicle_listings --optional--> buyer_inquiries
vehicle_listings --optional--> finance_estimates
valuation_leads + buyer_inquiries --> Dealer CRM follow-up
```

Important rule:

```text
Supabase is the source of truth.
Google Sheet, Google Drive, and CRM webhooks are output channels.
```

The website should have two main customer paths.

### Buy A Car

Customers who want to buy a vehicle should enter a marketplace-style inventory page.

Core MVP features:

- vehicle inventory list
- vehicle photos
- year, make, model, trim, kilometers, region
- asking price
- estimated monthly payment
- contact dealer button
- financing / leasing monthly payment calculator
- buyer inquiry form

Future features:

- search and filters
- saved vehicles
- full detail pages
- CRM buyer pipeline
- real finance application
- lender or broker API integration

### Sell My Car

Customers who want to sell should enter the current valuation flow.

Core MVP features:

- VIN or Year/Make/Model search
- odometer, postal code, province/region
- ownership type
- color and condition notes
- optional vehicle photo
- Black Book valuation
- quote history
- lead saved to Supabase
- lead sent to Google Sheet and Google Drive
- dealer CRM follow-up

Future features:

- more condition questions
- more photos for dealer/dealer-only workflow
- appointment booking
- automatic customer email
- second offer workflow

## Dealer / Internal CRM Flow

Existing internal CRM flow:

```text
Lead received
> Admin assigns lead to dealer staff
> Staff follows up and records notes/tasks
> Staff marks tasks complete
> Admin reviews progress
```

Next MVP additions:

1. Add inventory table.
2. Add button in admin lead detail: `Convert to inventory`.
3. Admin chooses listing status:
   - draft
   - internal review
   - published
   - sold
   - archived
4. Published inventory appears on the public Buy page.
5. Buyer inquiry goes into CRM and can be assigned to staff.

## Financing / Leasing Monthly Payment

MVP should include a simple calculator only.

Inputs:

- vehicle price
- down payment
- interest rate
- term in months
- tax rate
- trade-in value

Output:

- estimated monthly payment

Important: this is not a final finance approval. The page should say the number is an estimate and dealer/lender approval is required.

Future integration:

- dealer CRM finance module
- lender API
- credit application
- document collection

## Database Tables To Add

### vehicle_listings

Stores inventory vehicles visible to buyers.

Main fields:

- id
- source_lead_id
- status
- title
- vin
- uvc
- year
- make
- model
- series
- style
- kilometers
- color
- region
- asking_price
- monthly_payment_estimate
- description
- published_at
- created_at
- updated_at

### listing_photos

Stores photos for inventory listings.

Main fields:

- id
- listing_id
- url
- label
- sort_order
- created_at

### buyer_inquiries

Stores buyer interest from public inventory pages.

Main fields:

- id
- listing_id
- customer_email
- customer_phone
- customer_name
- message
- preferred_contact_method
- status
- assigned_to
- created_at
- updated_at

### finance_estimates

Stores monthly payment calculations.

Main fields:

- id
- listing_id
- user_email
- price
- down_payment
- trade_in_value
- annual_rate
- term_months
- tax_rate
- estimated_monthly_payment
- created_at

## Development Order

1. Create Buy / Sell homepage.
2. Keep Sell flow connected to the existing valuation page.
3. Add public Buy page with inventory cards and monthly payment calculator.
4. Add database schema for inventory, photos, buyer inquiries, and finance estimates.
5. Add admin button to convert a valuation lead into an inventory listing.
6. Add admin listing management.
7. Add buyer inquiry form.
8. Connect buyer inquiries into CRM assignment and follow-up.
9. Add optional CRM webhook mapping.
10. Add real financing/leasing provider integration only after a provider/API is selected.

## Current Implementation Status

- Buy / Sell homepage exists at `/`.
- Sell valuation flow exists at `/sell.html`.
- Dealer valuation tool exists at `/dealer.html`.
- Admin backend exists at `/admin.html`.
- Buy inventory page exists at `/buy.html`.
- Dealer/admin CRM lead follow-up exists.
- Admin can publish a valuation lead into `vehicle_listings`.
- Buy page reads published listings from `/api/inventory`.
- Buy page falls back to sample inventory only when no published listings are available.
- Database schema is prepared for inventory, listing photos, buyer inquiries, and finance estimates.

## Current Page Map

| Path | Audience | Purpose |
| --- | --- | --- |
| `/` | Public visitors | Main entry page. User chooses Buy or Sell. |
| `/sell.html` | Customers selling a vehicle | Customer valuation flow. Requires login before valuation. |
| `/buy.html` | Customers buying a vehicle | Public inventory preview and monthly payment calculator. |
| `/dealer.html` | Dealer staff | Dealer valuation tool and assigned lead follow-up. |
| `/admin.html` | Admins only | Manage leads, staff access, user limits, and publish inventory. |

Important separation:

- Customer sell flow creates `valuation_leads`.
- Admin CRM manages `valuation_leads`.
- Inventory module creates and reads `vehicle_listings`.
- Buy page reads only published inventory listings.
- Future buyer inquiries should create `buyer_inquiries`, not valuation leads.

## Implemented API Map

| API | Purpose |
| --- | --- |
| `POST /api/valuation` | Calls Black Book valuation. |
| `GET /api/autocomplete` | Searches vehicle descriptions / VIN-like input. |
| `GET /api/drilldown` | Gets year/make/model drilldown options. |
| `POST /api/leads` | Saves customer valuation lead to Supabase and sends webhook outputs. |
| `GET /api/my-leads` | Customer quote history. |
| `DELETE /api/my-leads?id=...` | Customer deletes quote history without restoring valuation allowance. |
| `GET /api/leads` | Admin lead list. |
| `PATCH /api/leads` | Admin updates owner review, assignment, status, priority, notes. |
| `DELETE /api/leads?id=...` | Admin deletes one lead. |
| `DELETE /api/leads?confirm=DELETE%20ALL%20LEADS` | Admin clears all Supabase lead records. |
| `GET /api/lead-activity` | Notes, tasks, and email/activity history. |
| `POST /api/lead-activity` | Adds note or task. |
| `PATCH /api/lead-activity` | Marks task complete or incomplete. |
| `GET /api/dealer-leads` | Dealer staff assigned leads. |
| `GET /api/dealer-staff` | Admin lists dealer staff. |
| `POST /api/dealer-staff` | Admin adds dealer staff email. |
| `DELETE /api/dealer-staff?email=...` | Admin removes dealer staff email. |
| `GET /api/inventory` | Public buy page reads published inventory. |
| `POST /api/inventory/from-lead` | Admin publishes a valuation lead into inventory. |

## Admin Workflow: Publish A Lead To Inventory

This is the first connection between Sell and Buy.

1. Customer submits a sell valuation on `/sell.html`.
2. Admin opens `/admin.html`.
3. In `Captured leads`, expand `Manage lead`.
4. Review the vehicle and customer data.
5. In `Publish to buy page`, fill:
   - `Listing title`
   - `Asking price`
   - `Status`
   - `Listing description`
6. Choose `Published` if the vehicle should appear on `/buy.html`.
7. Click `Publish inventory listing`.
8. Visit `/buy.html`.
9. The listing should appear if Supabase table `vehicle_listings` exists and the publish request succeeded.

If `/buy.html` still shows sample inventory:

- Run the latest `supabase.sql`.
- Confirm Vercel has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Confirm the admin publish action returned `Inventory listing published` or `Inventory listing updated`.
- Reload `/buy.html`.

## Supabase Setup Checklist

Run the latest `supabase.sql` in Supabase SQL Editor whenever new tables are added.

Current required groups:

- `valuation_leads`
- `valuation_user_limits`
- `dealer_staff`
- `lead_notes`
- `lead_tasks`
- `lead_emails`
- `vehicle_listings`
- `listing_photos`
- `buyer_inquiries`
- `finance_estimates`

For MVP scale, Supabase is enough. Even the free/small paid plans can handle far more rows than a 10-person dealership will create during early testing. The larger storage concern is photos and PDFs, which this project sends to Google Drive instead of storing in Supabase Storage.

## Vercel Environment Variables

Required for core app:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BLACKBOOK_BASE_URL=https://service.canadianblackbook.com
BLACKBOOK_API_PATH=/UsedCarWS/CanUsedAPI
BLACKBOOK_USERNAME=
BLACKBOOK_API_KEY=
ADMIN_EMAILS=owner@example.com,manager@example.com
OWNER_CONTACT=Please email owner@example.com for more valuations.
```

Optional but recommended:

```text
DEALER_EMAILS=sales1@example.com,sales2@example.com
ANNUAL_VALUATION_LIMIT=3
LEAD_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
CRM_WEBHOOK_URL=
CRM_WEBHOOK_TOKEN=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. Never expose it in frontend code.
- `BLACKBOOK_API_KEY` must stay server-side only.
- `ADMIN_EMAILS` are full admins.
- `DEALER_EMAILS` are fallback dealer staff emails. Preferred dealer staff management is inside `/admin.html`.
- If Apps Script deployment URL changes, update `LEAD_WEBHOOK_URL` in Vercel and redeploy.

## Google Sheet / Drive Output

Supabase is the source of truth. Google Sheet and Google Drive are owner-friendly outputs.

Use:

- `GOOGLE_DRIVE_UPLOADS.md` for the final working Apps Script.
- `DEALER_AND_DRIVE_SETTINGS.md` for owner handoff settings.
- `GOOGLE_APPS_SCRIPT_WEBHOOK.md` only as older reference/history.

Current intended flow:

```text
Customer valuation succeeds
> Website saves lead to Supabase
> Website sends payload to LEAD_WEBHOOK_URL
> Apps Script writes clean summary to Google Sheet
> Apps Script creates/uses customer folder in Google Drive
> Apps Script saves photos and PDF summary if files are included
```

Drive folder setup:

1. Create a root folder, for example `BlackBook Leads`.
2. Open that folder in Google Drive.
3. Copy only the folder ID from the URL:

```text
https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID
```

4. Put that ID into Apps Script:

```javascript
const DRIVE_ROOT_FOLDER_ID = "THIS_IS_THE_FOLDER_ID";
```

Do not paste the full Drive URL into `DRIVE_ROOT_FOLDER_ID`.

## CRM Handoff Strategy

The current system already acts as a small CRM MVP:

- admin assigns lead
- staff sees assigned leads
- notes and tasks can be recorded
- status and priority can be tracked
- next follow-up time can be stored
- admin can review progress

For a real CRM such as AutoRaptor, keep this project as the intake and valuation source, then push data outward.

Recommended future integration:

```text
Supabase lead
> Integration module
> CRM webhook/API
> CRM creates customer/opportunity
> CRM returns external CRM ID
> Store CRM ID on valuation_leads or buyer_inquiries
```

Do not build AutoRaptor-specific code until the dealer provides:

- API documentation or webhook endpoint
- authentication method
- required fields
- test account
- lead assignment rules

## Development Priorities From Here

### Phase 1: Inventory Management

Goal: let admin manage published vehicles without touching raw leads.

Tasks:

- add admin inventory list
- edit listing price/status/description
- archive listing
- add listing photo support
- connect listing photos from Google Drive or future storage

### Phase 2: Buyer Inquiry

Goal: buyer can contact dealer from `/buy.html`.

Tasks:

- add inquiry form
- save to `buyer_inquiries`
- show buyer inquiries in admin CRM
- allow assignment to staff
- add notes/tasks for buyer inquiries

### Phase 3: CRM Unification

Goal: seller leads and buyer inquiries share one staff follow-up model.

Tasks:

- create unified activity component
- show seller leads and buyer inquiries in separate tabs
- add overdue / due today filters
- add "complete follow-up" workflow

### Phase 4: Finance Module

Goal: monthly payment calculator becomes a real lead source.

Tasks:

- save finance estimates to `finance_estimates`
- link estimate to listing or buyer inquiry
- show estimate in admin
- later connect lender / broker API

### Phase 5: External CRM

Goal: send qualified records to a dealership CRM.

Tasks:

- finalize CRM field mapping
- configure `CRM_WEBHOOK_URL`
- send seller lead and buyer inquiry payloads
- store external CRM ID
- add retry/error log

## Testing Checklist

Before handing to a site owner:

1. Sign in as customer.
2. Submit one sell valuation.
3. Confirm customer quote history shows it.
4. Confirm `/admin.html` shows the lead.
5. Assign lead to a dealer staff email.
6. Confirm dealer staff can see it on `/dealer.html`.
7. Add note and task.
8. Publish the lead to inventory.
9. Confirm `/buy.html` shows the vehicle.
10. Confirm Google Sheet receives the lead.
11. Confirm Google Drive receives folder/files if photos were uploaded.
12. Confirm annual valuation limit is shown correctly.
13. Confirm non-admin cannot open `/admin.html`.
14. Confirm non-dealer cannot open dealer-only CRM tools.
