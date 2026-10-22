const dns = require('dns').promises, net = require('net');
const priv = ip => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i.test(ip);
async function safe(u) {
  const h = new URL(u).hostname;
  if (net.isIP(h)) return !priv(h);
  if (/^localhost$|\.local$|\.internal$/i.test(h)) return false;
  return !(await dns.lookup(h, { all: true })).some(a => priv(a.address));
}
async function get(u, ms = 6000, method = 'GET') {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms), s = Date.now();
  try {
    const r = await fetch(u, { method, redirect: 'follow', signal: c.signal, headers: { 'user-agent': 'SiteReviewBot/1.0' } });
    let body = '';
    if (method === 'GET' && /html/.test(r.headers.get('content-type') || '')) body = (await r.text()).slice(0, 1500000);
    return { status: r.status, body, ms: Date.now() - s, url: r.url };
  } catch (e) { return { status: 0, body: '', ms: Date.now() - s, url: u, err: e.name }; }
  finally { clearTimeout(t); }
}
const strip = h => h.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const attr = (tag, n) => { const m = tag.match(new RegExp('\\s' + n + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] ?? m[3] ?? m[4]) : null; };
function parse(html) {
  const f = {};
  f.lang = attr((html.match(/<html[^>]*>/i) || [''])[0], 'lang');
  f.title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]);
  const metas = [...html.matchAll(/<meta[^>]*>/gi)].map(m => m[0]);
  const meta = n => { const m = metas.find(t => (attr(t, 'name') || attr(t, 'property') || '').toLowerCase() === n); return m ? attr(m, 'content') : null; };
  f.desc = meta('description'); f.viewport = meta('viewport');
  const hs = l => [...html.matchAll(new RegExp('<h' + l + '[^>]*>([\\s\\S]*?)</h' + l + '>', 'gi'))].map(m => strip(m[1])).filter(Boolean);
  f.h1 = hs(1).slice(0, 5); f.h2 = hs(2).slice(0, 12);
  const imgs = [...html.matchAll(/<img[^>]*>/gi)].map(m => m[0]);
  f.imgs = imgs.length; f.noAlt = imgs.filter(t => attr(t, 'alt') === null).length;
  f.links = [...html.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({ href: attr(m[0], 'href'), text: strip(m[1]).slice(0, 60) }));
  f.linkTexts = f.links.map(l => l.text).filter(Boolean).slice(0, 30);
  f.text = strip(html).slice(0, 2500);
  return f;
}
const I = (label, priority, title, observed, change, verify) => ({ label, priority, title, observed, change, verify });
function issues(r, f, isHome, origin, bad, clean) {
  const o = [];
  if (!r.status || r.status >= 400) o.push(I('Fix', 'Critical', 'Page does not load', 'Status: ' + (r.status || 'no response') + '.', 'Fix the page or remove links that point to it.', 'Open it in a private window.'));
  if (!f) return o;
  if (isHome && !origin.startsWith('https')) o.push(I('Fix', 'High', 'Site is not served over HTTPS', 'The address uses http.', 'Enable HTTPS and redirect http to https.', 'Visit the http address and confirm it redirects.'));
  if (!f.title) o.push(I('Fix', 'High', 'Missing page title', 'No <title> found.', 'Add a short title naming the page and the business.', 'Check the browser tab.'));
  if (!f.desc) o.push(I('Improve', 'Medium', 'No meta description', 'No description for search results.', 'Write one clear sentence of about 140 characters.', 'View page source and search for name="description".'));
  if (!f.h1.length) o.push(I('Improve', 'Medium', 'No main heading (h1)', 'No <h1> found in the HTML.', 'Add one h1 that states what the page is about.', 'Inspect the page headings.'));
  else if (f.h1.length > 1) o.push(I('Improve', 'Low', 'More than one h1', f.h1.length + ' h1 headings: ' + f.h1.slice(0, 3).join(' | '), 'Keep one h1 and use h2 for sections.', 'Inspect the page headings.'));
  if (!f.viewport) o.push(I('Fix', 'High', 'No mobile viewport tag', 'The viewport meta tag is missing.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', 'Open on a phone.'));
  if (!f.lang) o.push(I('Improve', 'Low', 'No page language', 'The html tag has no lang attribute.', 'Add lang, for example lang="en".', 'View page source.'));
  if (f.noAlt) o.push(I('Fix', 'Medium', f.noAlt + ' of ' + f.imgs + ' images have no alt attribute', 'Screen readers and search engines get no description.', 'Add alt text, or alt="" for decorative images.', 'Inspect the images.'));
  if (r.ms > 2500) o.push(I('Improve', 'Medium', 'Slow response', 'The server took ' + r.ms + ' ms to respond.', 'Check hosting, caching and page weight.', 'Test again at a different time.'));
  const dead = f.links.filter(l => l.href === '' || l.href === '#' || /^javascript:/i.test(l.href || ''));
  if (dead.length) o.push(I('Fix', 'High', dead.length + ' links go nowhere', 'Links with an empty or placeholder destination: ' + dead.slice(0, 4).map(l => l.text || '(no text)').join(', ') + '.', 'Point each one to a real page or remove it.', 'Click each one.'));
  const brk = [...new Set(f.links.map(l => l.href && !/^(#|javascript|mailto|tel)/i.test(l.href) ? clean(l.href, r.url) : null).filter(x => x && bad.has(x)))];
  if (brk.length) o.push(I('Fix', 'Critical', brk.length + ' broken internal link(s)', brk.slice(0, 4).join(', '), 'Fix the destination or remove the link.', 'Open each address.'));
  return o;
}
exports.handler = async ev => {
  const h = { 'content-type': 'application/json' }, out = (c, b) => ({ statusCode: c, headers: h, body: JSON.stringify(b) });
  try {
    let u = (JSON.parse(ev.body || '{}').url || '').trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    new URL(u);
    if (!(await safe(u))) return out(400, { error: 'That address is not allowed.' });
    const home = await get(u);
    if (!home.status) return out(502, { error: 'Could not reach the site (' + (home.err || 'no response') + ').' });
    const origin = new URL(home.url).origin, hf = parse(home.body);
    const clean = (href, base) => { try { const x = new URL(href, base); x.hash = ''; x.search = ''; return x.origin === origin && !/\.(pdf|jpe?g|png|webp|gif|svg|zip|mp4|css|js)$/i.test(x.pathname) ? x.href.replace(/\/$/, '') : null; } catch { return null; } };
    const homeKey = home.url.replace(/\/$/, '');
    const urls = [...new Set(hf.links.map(l => l.href && !/^(#|javascript|mailto|tel)/i.test(l.href) ? clean(l.href, home.url) : null).filter(Boolean))].filter(x => x !== homeKey);
    const rest = await Promise.all(urls.slice(0, 5).map(x => get(x)));
    const chk = await Promise.all(urls.slice(0, 25).map(async x => [x, (await get(x, 4000, 'HEAD')).status]));
    const bad = new Set(chk.filter(([, s]) => s === 0 || (s >= 400 && ![403, 405, 429].includes(s))).map(([x]) => x));
    const raw = [{ r: home, f: hf }, ...rest.map(r => ({ r, f: r.body ? parse(r.body) : null }))];
    const pages = raw.map(({ r, f }, i) => ({
      url: r.url, path: new URL(r.url).pathname || '/', status: r.status, ms: r.ms,
      facts: f ? { title: f.title, desc: f.desc, h1: f.h1, h2: f.h2, text: f.text, linkTexts: f.linkTexts } : { text: '' },
      issues: issues(r, f, i === 0, origin, bad, clean)
    }));
    return out(200, { origin, pages, checked: chk.length });
  } catch (e) { return out(500, { error: e.message }); }
};
