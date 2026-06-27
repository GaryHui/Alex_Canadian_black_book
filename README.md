# Black Book Valuation Demo

Local demo for testing the Canadian Black Book VIN valuation flow.

## Run

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Edit `.env.local` and add the real Black Book username/password if you want live API calls.
Without credentials, the app returns mock data so the UI can still be tested.

Open:

```text
http://localhost:3000
```

## Setup Docs

- `FEATURE_DEVELOPMENT_PLAN.md`: main MVP feature, module, page, API, database, and next-development guide. Start here.
- `SETUP.md`: Supabase, Google OAuth, Vercel, admin, and deployment setup.
- `CLIENT_HANDOFF.md`: client account migration, Vercel variables, Google/Supabase handoff, and final acceptance checklist.
- `CLIENT_HANDOFF_CN.md`: Chinese handoff checklist for account migration, variables, URLs, and final delivery testing.
- `PROJECT_STRUCTURE.md`: current file structure and responsibility of each module.
- `MVP_ROADMAP.md`: MVP meaning, Supabase capacity notes, and staged CRM workflow plan.
- `GOOGLE_DRIVE_UPLOADS.md`: final Google Apps Script for Sheet, Drive folders, photos, PDFs, and spreadsheet summaries.
- `DEALER_AND_DRIVE_SETTINGS.md`: owner-facing dealer staff, admin, and Google Drive handoff notes.
- `GOOGLE_APPS_SCRIPT_WEBHOOK.md`: older Google Sheet webhook reference. Prefer `GOOGLE_DRIVE_UPLOADS.md` for the current working setup.
