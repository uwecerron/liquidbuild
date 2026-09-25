# Liquid Build: website, CRM and AI agent server

Everything runs on Vercel from this folder.

| Part | Where | What it does |
|---|---|---|
| Website | `/`, `/home-development`, `/design-build`, `/commercial`, `/schools`, `/data-centers`, `/agents` | Pages, ballpark estimator, quote form |
| CRM | `/crm` | Pipeline board, texts, emails, notes, bids, team logins |
| MCP server | `/api/mcp` | Lets AI assistants get estimates, plan projects and request quotes |
| SEO files | `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt`, `/.well-known/mcp.json` | Help Google, Bing and AI assistants find and understand the site |

## 1. Deploy

Push to GitHub (`git push`). Vercel builds automatically. No build command is needed.

## 2. Turn on the CRM (about 10 minutes)

In Vercel, open the project and go to **Storage**, then **Create Database**, then **Neon (Postgres)**. Connect it to this project.
Vercel adds `DATABASE_URL` for you.

Then go to **Settings**, then **Environment Variables**, and add:

| Name | Value |
|---|---|
| `SESSION_SECRET` | A long random string (40+ characters). Keeps logins secure. |
| `ADMIN_EMAIL` | The email you will log in with, e.g. `uwecerron@gmail.com` |
| `ADMIN_PASSWORD` | A strong password for your first login (8+ characters) |
| `ADMIN_NAME` | Your name |
| `SITE_URL` | Your live address, e.g. `https://liquidbuild.com` |

Redeploy, open `/crm` and log in. Tables are created on first use. Add your team under **Team**.
After the first login you can delete `ADMIN_PASSWORD` from Vercel. The account stays.

## 3. Turn on texting (Twilio)

1. Create a Twilio account and buy a local number.
2. Register the number for business texting (A2P 10DLC) in the Twilio console. US carriers require this. It usually takes 1 to 3 weeks.
3. Add to Vercel: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (the number, like `+19545551234`).
4. In Twilio, set the number's "A message comes in" webhook to `https://<your-site>/api/sms` (HTTP POST).
5. Optional: `OWNER_PHONE` (your cell) to get a text for every new lead. `AUTO_TEXT_TEMPLATE` to change the automatic reply. You can use `{name}` and `{project}`.

New leads who tick "Text me about this request" get an automatic text right away. Replies show up in the CRM.
If someone texts STOP, the CRM blocks further texts to them.

## 4. Turn on email (Resend)

1. Create a Resend account and verify your domain (it gives you DNS records to add).
2. Add to Vercel: `RESEND_API_KEY` and `RESEND_FROM` (for example `Liquid Build <quotes@liquidbuild.com>`).

Until Resend is set up, new-lead alerts go to `uwecerron@gmail.com` through FormSubmit. The first alert asks you to click
"Activate". Do it once. Change the inbox with `LEAD_EMAIL`.

## 5. Turn on file uploads (plans and photos)

In Vercel, go to **Storage**, then **Create Database**, then **Blob**. Choose **Private** and connect it to this project.
Vercel adds `BLOB_READ_WRITE_TOKEN` for you. Redeploy. The quote form's "I have plans or photos" step starts accepting files
(PDF, JPG, PNG, HEIC, DWG, up to 50 MB each). Files open from the lead in the CRM and are never public.
If you created a public store instead, add `BLOB_ACCESS=public`.

After changing the upload library, rebuild the browser file: `npx esbuild scripts/blob-entry.mjs --bundle --minify --format=iife --outfile=public/vendor/blob-upload.js`.

## 6. Review the estimate ranges

`data/estimating.json` holds the ballpark price ranges used by the website and the MCP server.
**These are starting numbers. Replace them with your real pricing**, then fill in `reviewedBy` and `reviewedOn`.

## 7. Get found

- Google Search Console and Bing Webmaster Tools: add the site and submit `https://<your-site>/sitemap.xml`.
- Create a Google Business Profile with the same name, phone and service area.
- `robots.txt` welcomes GPTBot, ClaudeBot, PerplexityBot, Google-Extended and other AI crawlers. `/crm` stays private.
- When you get a custom domain, set `SITE_URL`, change `url` in `data/company.json`, then run `python3 build.py`.

## 8. License number

Once the license is qualified for Liquid Build LLC, add `LICENSE_NUMBER` in Vercel. The footer shows it automatically.

## Editing

- Page copy: `build.py`. Company facts, services and FAQs: `data/company.json`. Then run `python3 build.py`.
- Preview locally: `npm install`, then `npm run dev`, then open http://localhost:3000. The CRM needs `DATABASE_URL` locally too.

## Connect an AI assistant (MCP)

Add `https://<your-site>/api/mcp` as a remote MCP server or custom connector.
Tools: `get_company_info`, `list_projects`, `get_ballpark_estimate`, `ground_project_idea`, `request_quote`.
Quote requests from agents land in the CRM tagged "AI agent".
