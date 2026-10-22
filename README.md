# Digital Encounter Site Review

Paste a link. The tool opens the site in a real headless browser, takes desktop (1280 px) and mobile (390 px) screenshots, checks links and basics, then an AI reviews each page and writes findings (Fix / Improve / Validate / Keep, with priority, what to change, how to check it, and the screenshot section it refers to).

## Deploy (GitHub + Vercel)
1. Push this folder to a GitHub repo named digital-encounter-site-review (index.html, api/, vercel.json, package.json and the logo files at the repo root).
2. On vercel.com: Add New > Project > import the repo. Framework preset: Other. No build command. Vercel installs the dependencies in package.json automatically.
3. Settings > Environment Variables:
   - ANTHROPIC_API_KEY = your key from console.anthropic.com (required)
   - MODEL = claude-haiku-5-5 (optional; default is claude-sonnet-5-5, Haiku is cheaper and faster but less sharp)
4. Redeploy if you added the key after the first deploy.

## If something fails
- A finding page says "Screenshots unavailable: ..." : the headless Chrome did not start. Open Vercel > Logs for api/capture. Typical fixes: raise function memory (Settings > Functions), or pin matching versions of puppeteer-core and @sparticuz/chromium in package.json (see the Chromium support table in the @sparticuz/chromium README), then redeploy.
- Timeouts: each function is limited to 60 s in vercel.json. Heavy sites may need fewer pages or Haiku.

## Notes
- A full review of 6 pages takes roughly 2 to 4 minutes and about 6 vision model calls. Add a password or rate limit before sharing the URL, or anyone can spend your credits.
- Your API key stays on the server. Never put it in index.html.
- Only the first URL is checked against private addresses; do not expose this tool to untrusted users without further limits.
- Local test: `npm i`, `npm i -g vercel`, then `vercel dev` (needs a local Chrome; set CHROMIUM_PATH if required).
