# MVP Roadmap

MVP means Minimum Viable Product: the smallest version that can support the real business workflow end to end.

For this project, the MVP is not only a valuation form. It is a working lead workflow:

1. Customer signs in and submits a vehicle valuation.
2. The system saves the lead, quote, photos, PDF, and sheet record.
3. Admin assigns the lead to a dealer staff member.
4. Staff records calls, emails, inspection notes, offers, and next steps.
5. The system highlights overdue follow-ups.
6. Management can see status, owner, priority, and progress.

## Supabase Capacity

Supabase is enough for the MVP if we store structured data in Supabase and keep large files in Google Drive.

Supabase stores:

- user email and auth ID
- lead status
- vehicle fields
- assignment
- notes and tasks
- quote numbers
- Drive/PDF links

Google Drive stores:

- uploaded photos
- generated PDF
- generated spreadsheet summary

This keeps Supabase small. A lead row plus notes/tasks is usually only a few KB. The heavy files are outside Supabase.

Recommended approach:

- Development / demo: Supabase free tier is usually enough.
- Real launch / customer traffic: use Supabase Pro for better limits, backups, and reliability.
- Do not store photo base64 or full PDF files in Supabase.
- Store only Drive URLs and file metadata in Supabase.

Official pricing and limits should be checked before production: https://supabase.com/pricing

## Phase 1: Lead Assignment And Follow-Up Foundation

Status: in progress.

Database:

- Add `assigned_to`, `priority`, `next_follow_up_at`, and `last_activity_at` to `valuation_leads`.
- Add `lead_notes`.
- Add `lead_tasks`.
- Add `lead_emails`.

Admin:

- Show assigned owner.
- Set lead status.
- Set priority.
- Set next follow-up time.
- Add notes.
- Add tasks.
- Mark tasks complete.
- Show overdue leads.

## Phase 2: Staff Workflow

Status: started.

- Dealer staff sees only assigned leads in the dealer portal.
- Dealer staff can add follow-up notes and tasks.
- Admin can still see all leads and reassign them from the admin portal.
- Activity updates are permission checked: non-admin dealer staff can only access leads assigned to their email.

Next:

- Allow dealer staff to update status from the dealer portal.
- Add dealer-side follow-up date editing.
- Add a management dashboard for overdue and unassigned leads.
- Admin can reassign leads.

## Phase 3: Email Workflow

Planned.

- Add email template buttons.
- Send customer follow-up email through a server-side provider.
- Save each email to `lead_emails`.
- Optional providers: Resend, SendGrid, Gmail API, or CRM email API.

## Phase 4: Management Dashboard

Planned.

- New leads today.
- Unassigned leads.
- Overdue leads.
- Leads by staff member.
- Leads by status.
- Won / lost / closed totals.

## Phase 5: CRM Integration

Planned.

- Add `CRM_WEBHOOK_URL`.
- Add `CRM_WEBHOOK_TOKEN`.
- Send lead, quote, photos/PDF links, owner, and notes to the CRM.
- For AutoRaptor, request official inbound lead API or webhook details from their team.

## Required Supabase Step After This Phase

After deployment, run the latest `supabase.sql` in Supabase SQL Editor.

If this SQL is not run, the new admin assignment and activity features will fail because the new columns and tables will not exist yet.
