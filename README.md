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
