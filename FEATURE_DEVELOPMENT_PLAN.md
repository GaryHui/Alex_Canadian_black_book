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

- Sell valuation flow exists.
- Dealer/admin CRM lead follow-up exists.
- Buy/Sell homepage is being added.
- Buy inventory page starts as a front-end MVP with sample data.
- Database schema is prepared for future real inventory.
