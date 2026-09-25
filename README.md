# liquid build — website

Static pages in `public/` + one Vercel function (`api/quote.js`) that emails quote requests.

## Deploy to Vercel
1. `npx vercel` in this folder (first time: log in, accept defaults — no framework, no build command).
2. `npx vercel --prod` to publish.
   Or push this folder to GitHub and import it at vercel.com/new.

## Quote form email
Leads go to `uwecerron@gmail.com` (change with the `LEAD_EMAIL` env var).
- **Default (no setup):** relayed through FormSubmit. The FIRST submission on the live site sends an
  "Activate form" email to that inbox — click it once, then every lead arrives.
- **Better (optional):** create a free Resend account, add `RESEND_API_KEY` in Vercel → Settings →
  Environment Variables, and redeploy. Leads then come straight from Resend.
Every lead is also printed in Vercel → Project → Logs, so nothing is lost if email fails.

## License number
Set `LICENSE_NUMBER` (e.g. `CGC000231`) in Vercel env vars once the license is qualified for
Liquid Build LLC; the footer shows it automatically. No code change needed.

## Edit pages
Copy lives in `build.py`. Edit it, run `python3 build.py`, then redeploy.
Preview locally: `npm run dev` → http://localhost:3000
