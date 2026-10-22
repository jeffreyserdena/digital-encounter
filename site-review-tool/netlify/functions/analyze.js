exports.handler = async ev => {
  const h = { 'content-type': 'application/json' }, out = (c, b) => ({ statusCode: c, headers: h, body: JSON.stringify(b) });
  try {
    const { page, lang } = JSON.parse(ev.body || '{}');
    const L = { en: 'English', fil: 'Filipino (Tagalog), keeping technical terms in English', es: 'Spanish' }[lang] || 'English';
    const prompt = `You are a careful, honest website reviewer writing for the site owner. Review ONE page using only the evidence below (text, headings, link labels). You cannot see the design, screenshots or mobile layout, so never comment on them.
Rules: invent nothing; quote at most a few words; label each finding Fix (observed problem such as a typo, contradiction, unclear or missing information), Improve (opportunity in copy or clarity), Validate (the owner must confirm something) or Keep (a strength worth preserving). Priority is Critical, High, Medium or Low. Do not repeat these already-detected issues: ${JSON.stringify(page.auto)}.
Write 4 to 6 findings, at least one Keep, each field one or two short sentences. Write all values in ${L}.
Return ONLY JSON: {"summary":"one sentence about the page","findings":[{"label":"","priority":"","title":"","observed":"","why":"","change":"","verify":""}]}
Page: ${JSON.stringify(page).slice(0, 9000)}`;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.MODEL || 'claude-haiku-5-5', max_tokens: 1800, messages: [{ role: 'user', content: prompt }] })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'API error');
    const t = d.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    return out(200, JSON.parse(t));
  } catch (e) { return out(500, { error: e.message }); }
};
