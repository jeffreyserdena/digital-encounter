# Digital Encounter Site Review

Paste a link, get a review with Fix / Improve / Validate / Keep labels and priorities.

## Deploy (GitHub + Vercel)
1. Push this folder to a GitHub repo named digital-encounter-site-review (index.html, api/, vercel.json, package.json and the Digital Encounter logo files at the repo root).
2. On vercel.com: Add New > Project > import the repo. Framework preset: Other. No build command.
3. Before or after the first deploy, open Settings > Environment Variables and add:
   - ANTHROPIC_API_KEY = your key from console.anthropic.com (required)
   - MODEL = claude-haiku-5-5 (optional; default is claude-sonnet-5-5, Haiku is faster and cheaper)
4. If you added the key after deploying, redeploy so the functions can read it.
5. Open the site and paste a link.

## Notes
- Functions are set to run up to 60 seconds in vercel.json.
- Your API key stays on the server. Never put it in index.html.
- Each review costs API usage: about 1 model call per page (up to 6 pages). Before sharing the URL publicly, add a password or rate limit, or anyone can spend your credits.
- Local test: `npm i -g vercel`, then `vercel dev`.
