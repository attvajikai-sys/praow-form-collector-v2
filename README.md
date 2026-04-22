# Praow Form Collector v2

Modern blue/white customer intake page (Next.js + Firebase + Vercel) with 2 flows:
- ซื้อดื่มเอง
- จำหน่าย

## Features (v2)
- Welcome slide + smooth transitions
- Blue/white modern mobile-first UI
- Thai phone validation (10 digits)
- Anti-spam: honeypot + cooldown
- Firebase Firestore live collection
- Optional Google Sheet sync (Apps Script)
- Vercel-ready

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`

## Firebase
Create Firestore and set rules for collection `customer_requests`.

## Deploy
Push to GitHub and import to Vercel. Add env vars from `.env.example`.

## Google Sheet Sync
Deploy the Apps Script in `google-apps-script-Code.gs` as a Web App and set `GOOGLE_SCRIPT_WEBAPP_URL`.
