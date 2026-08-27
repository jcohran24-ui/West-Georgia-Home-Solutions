# West Georgia Home Solutions — Live Starter

This package contains:
- `public/index.html` — mobile-first prototype with homeowner funnel, contractor pricing, partner application, service areas, demo lead routing, and admin dashboard.
- `server/server.js` — minimal Express server scaffold.
- `routing-config.json` — initial launch markets and lead pricing.
- `LAUNCH_CHECKLIST.md` — recommended path to production.
- `.env.example` — placeholders for production integrations.

## Easiest preview
Open `public/index.html` directly in Chrome. It is a single-file app and does not require the server.

## Run locally with Node.js
1. Install Node.js 20+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## What is production-ready vs demo
The front-end experience and routing model are ready to test. The current data layer is still demo-only and stores entries in browser localStorage.

Before taking real homeowner information, connect a secure hosted database, server-side validation, authenticated admin access, consent logging, spam protection, and proper privacy/terms language.

## Recommended production stack
- Hosting: Vercel, Render, Railway, or similar
- Database/auth: Supabase/Postgres
- SMS: Twilio
- Email: Resend
- Billing: Stripe
- Analytics: GA4 + Search Console


## Current service categories
Sell My House Fast, Roofing, HVAC, Concrete, Tree Removal, Electrical, Drywall Finishing, Painting, and Plumbing.
