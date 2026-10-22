module.exports = async (req, res) => {
  const out = (c, b) => res.status(c).json(b);
  if (req.method !== 'POST') return out(405, { error: 'Use POST.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { page, lang, desktop = [], mobile = [] } = body;
    if (!page) return out(400, { error: 'Missing page.' });
    const L = { en: 'English', fil: 'Filipino (Tagalog), keeping technical terms in English', es: 'Spanish' }[lang] || 'English';
    const content = [];
    desktop.forEach((b, i) => content.push({ type: 'text', text: `Desktop screenshot D${i} (1280 px wide, sections run top to bottom):` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }));
    mobile.forEach((b, i) => content.push({ type: 'text', text: `Mobile screenshot M${i} (390 px wide, sections run top to bottom):` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }));
    content.push({ type: 'text', text: `You are a careful, honest website reviewer writing for the site owner. Review ONE page using the screenshots above (if any) and the extracted text below.
Look for: typos and unclear or contradictory copy, a weak or unclear main message, competing or vague calls to action, low contrast, cramped or uneven spacing, cut-off, overlapping or broken elements, images that did not load, inconsistent styles, confusing navigation, mobile layout problems, missing trust evidence (proof, contact details, testimonials), and unexplained pricing or next steps.
Rules: invent nothing; describe only what is visible or in the text; quote at most a few words. Label each finding Fix (observed problem), Improve (opportunity), Validate (the owner must confirm something) or Keep (strength worth preserving). Priority is Critical, High, Medium or Low. Do not repeat these already-detected issues: ${JSON.stringify(page.auto || [])}.
Write 5 to 7 findings, at least one Keep, each field one or two short sentences. For each finding set "shot" to the id of the screenshot where it is visible (for example "D2" or "M0"), or null if no screenshot shows it. Write all values in ${L}.
Return ONLY JSON: {"summary":"one or two sentences about what to do first on this page","findings":[{"label":"","priority":"","title":"","observed":"","why":"","change":"","verify":"","rationale":"short principle behind the advice","shot":null}]}
Page text: ${JSON.stringify(page).slice(0, 7000)}` });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-5-5', max_tokens: 3000, messages: [{ role: 'user', content }] })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'API error');
    const t = d.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    return out(200, JSON.parse(t));
  } catch (e) { return out(500, { error: e.message }); }
};
