# Site review tool

Paste a link, get a review with Fix / Improve / Validate / Keep labels and priorities.

## Deploy (Netlify)
1. Put this folder in a GitHub repo (or drag the folder into app.netlify.com/drop — functions need the Git or CLI deploy, so GitHub is easier).
2. New site from Git, pick the repo. No build command.
3. Site settings > Environment variables:
   - ANTHROPIC_API_KEY = your key from console.anthropic.com (required)
   - MODEL = claude-sonnet-5-5 (optional; default is claude-haiku-5-5, which is faster and cheaper)
4. Deploy, open the site, paste a link.

## Notes
- Netlify functions time out at 10 s by default. If a review fails with a timeout, keep the Haiku default or raise the function timeout.
- Your API key stays on the server. Never put it in index.html.
- Each review costs API usage: about 1 model call per page (up to 6 pages).
- Local test: `npm i -g netlify-cli`, then `netlify dev`.
