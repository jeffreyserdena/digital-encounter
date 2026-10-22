const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const dns = require('dns').promises, net = require('net');
const priv = ip => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i.test(ip);
async function safe(u) {
  const h = new URL(u).hostname;
  if (net.isIP(h)) return !priv(h);
  if (/^localhost$|\.local$|\.internal$/i.test(h)) return false;
  return !(await dns.lookup(h, { all: true })).some(a => priv(a.address));
}
async function shoot(browser, url, w, h, max, mobile) {
  const pg = await browser.newPage();
  try {
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    await pg.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await pg.evaluate(async () => {
      for (let y = 0; y < 9000 && y < document.documentElement.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
      scrollTo(0, 0); await new Promise(r => setTimeout(r, 300));
    });
    const m = await pg.evaluate(() => {
      const pick = sel => [...document.querySelectorAll(sel)].map(a => ({ text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 50), abs: a.href })).filter(l => l.text);
      return { total: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, vw: innerWidth, nav: pick('header a, nav a'), foot: pick('footer a') };
    });
    const n = Math.max(1, Math.min(max, Math.ceil(m.total / h))), shots = [];
    for (let i = 0; i < n; i++) {
      const buf = await pg.screenshot({ type: 'jpeg', quality: 55, clip: { x: 0, y: i * h, width: w, height: Math.max(1, Math.min(h, m.total - i * h)) } });
      shots.push(Buffer.from(buf).toString('base64'));
    }
    return { shots, ...m, complete: n * h >= m.total };
  } finally { await pg.close().catch(() => {}); }
}
const norm = u => { try { const x = new URL(u); return (x.origin + x.pathname + x.search + x.hash).replace(/\/$/, ''); } catch { return u; } };
function dup(list, where, shot) {
  const g = {};
  list.forEach(l => { if (!l.abs || /^(mailto|tel|javascript)/i.test(l.abs)) return; (g[norm(l.abs)] ??= new Set()).add(l.text); });
  return Object.entries(g).filter(([, s]) => s.size >= 3).map(([href, s]) => {
    let path = href; try { path = new URL(href).pathname + new URL(href).hash || '/'; } catch {}
    return { label: 'Fix', priority: 'Critical', shared: true, shot,
      title: 'The ' + where + ' lists different sections but repeats one destination',
      observed: [...s].slice(0, 6).join(', ') + ' all link to ' + path + '.',
      why: 'Labels announce different pages but lead to the same place, so a visitor cannot continue where they expect.',
      change: 'Give each label its own page address, or remove labels that have no page yet. Check the shared template so the fix applies everywhere.',
      verify: 'Click each link on desktop and mobile and check the destination address and title.',
      rationale: 'Verifiable match between label, intent and destination.' };
  });
}
module.exports = async (req, res) => {
  const out = (c, b) => res.status(c).json(b);
  if (req.method !== 'POST') return out(405, { error: 'Use POST.' });
  let browser;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const url = String(body.url || '');
    if (!/^https?:\/\//i.test(url) || !(await safe(url))) return out(400, { error: 'Address not allowed.' });
    browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
    const d = await shoot(browser, url, 1280, 800, 5, false);
    const m = await shoot(browser, url, 390, 844, 3, true);
    const issues = [...dup(d.nav, 'navigation', 'D0'), ...dup(d.foot, 'footer', d.complete ? 'D' + (d.shots.length - 1) : null)];
    if (m.sw > m.vw + 4) issues.push({ label: 'Fix', priority: 'High', shot: 'M0', title: 'The page scrolls sideways on mobile',
      observed: 'At 390 px wide the content is ' + m.sw + ' px wide, wider than the screen.',
      why: 'Visitors on phones see cut-off content and have to pan sideways.',
      change: 'Find the element wider than the screen (often an image, table or fixed width) and let it shrink to fit.',
      verify: 'Open the page on a phone and swipe left and right.', rationale: 'Mobile layouts should fit the screen width.' });
    return out(200, { desktop: d.shots, mobile: m.shots, issues });
  } catch (e) { return out(500, { error: e.message }); }
  finally { if (browser) await browser.close().catch(() => {}); }
};
