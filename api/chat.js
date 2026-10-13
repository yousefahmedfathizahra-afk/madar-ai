'use strict';
// MADAR uses Gemini free-tier-capable text models only. No OpenAI API calls.
// Free-tier availability and usage quotas are determined by Google per project.
const SYSTEM = 'You are MADAR, a reliable, helpful and friendly AI assistant. Respond in English by default. When the user writes in another language, respond in their language. Be clear and accurate, admit uncertainty, and never claim to have tools or internet access you do not have. Never expose secrets.';
const FREE_MODELS = Object.freeze([
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
]);
const counters = new Map();
let modelCache = null;
let preferredModel = null;
function send(res, status, body) { return res.status(status).json(body); }
async function getModels(key, signal) {
  const now = Date.now();
  if (modelCache && modelCache.expires > now) return modelCache.models;
  try {
    // The authenticated models listing is specific to the actual Google API key.
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
      headers: { 'x-goog-api-key': key }, signal
    });
    if (!response.ok) return FREE_MODELS;
    const json = await response.json();
    if (!Array.isArray(json.models)) return FREE_MODELS;
    const available = new Set(json.models.filter(model =>
      Array.isArray(model.supportedGenerationMethods) &&
      model.supportedGenerationMethods.some(method => method.toLowerCase() === 'generatecontent')
    ).map(model => String(model.name || '').replace(/^models\//, '')));
    const models = FREE_MODELS.filter(name => available.has(name));
    modelCache = { models, expires: now + 15 * 60 * 1000 };
    return models;
  } catch {
    return FREE_MODELS; // If discovery fails, the request itself can still work.
  }
}
module.exports = async function chat(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host)
        return send(res, 403, { error: 'Origin denied.' });
    } catch { return send(res, 403, { error: 'Invalid origin.' }); }
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(res, 503, {
    error: 'Gemini key missing. Add GEMINI_API_KEY for Production in Vercel, then redeploy.'
  });
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json'))
    return send(res, 415, { error: 'Content-Type must be application/json.' });
  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); }
    catch { return send(res, 400, { error: 'Invalid JSON request.' }); }
  }
  const messages = data && data.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 18
      || messages[messages.length - 1]?.role !== 'user'
      || messages.some(m => !m || !['user', 'assistant'].includes(m.role)
           || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 5000)
      || messages.reduce((sum, m) => sum + m.content.length, 0) > 16000)
    return send(res, 400, { error: 'Invalid conversation or message too long.' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  let limit = counters.get(ip);
  if (!limit || now - limit.start >= 15 * 60 * 1000) limit = { start: now, count: 0 };
  if (limit.count >= 16) return send(res, 429, {
    error: 'MADAR free demo: temporary request limit reached. Try again later.'
  });
  limit.count++;
  counters.set(ip, limit);
  if (counters.size > 1000) {
    for (const [addr, entry] of counters) {
      if (now - entry.start >= 15 * 60 * 1000) counters.delete(addr);
    }
  }

  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), 30000);
  try {
    const available = await getModels(key, aborter.signal);
    const models = preferredModel && available.includes(preferredModel)
      ? [preferredModel, ...available.filter(name => name !== preferredModel)]
      : available;
    if (!models.length) return send(res, 502, {
      error: 'This Google API key has no supported free Gemini text model. Check the key project in Google AI Studio.'
    });

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    for (const model of models) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'
          + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.65 }
        }),
        signal: aborter.signal
      });
      const answer = await response.json().catch(() => ({}));
      if (response.status === 404) {
        console.warn('MADAR free model unavailable:', model);
        continue; // Try a different free-tier-capable model.
      }
      if (!response.ok) {
        const code = String(answer?.error?.status || '');
        if (response.status === 429 || code === 'RESOURCE_EXHAUSTED')
          return send(res, 429, { error: 'Gemini free quota reached. Try again after Google resets your limit.' });
        if (response.status === 401 || response.status === 403)
          return send(res, 502, { error: 'Google rejected the Gemini API key or this account lacks access. Check Google AI Studio.' });
        if (response.status === 400)
          return send(res, 502, { error: 'Google could not process this request. Please try a shorter question.' });
        console.error('MADAR Gemini upstream status:', response.status, code.slice(0, 40));
        return send(res, 502, { error: 'Gemini is temporarily unavailable. Try again later.' });
      }
      preferredModel = model;
      const reply = (answer?.candidates?.[0]?.content?.parts || [])
        .filter(p => typeof p?.text === 'string')
        .map(p => p.text).join('\n').trim();
      if (!reply) return send(res, 422, {
        error: 'Gemini returned no text. Try asking the question another way.'
      });
      return send(res, 200, { reply });
    }
    return send(res, 502, {
      error: 'No available free Gemini model works with this Google project. Check AI Studio model access.'
    });
  } catch (error) {
    if (error?.name === 'AbortError') return send(res, 504, {
      error: 'The free AI request timed out. Try again.'
    });
    console.error('MADAR Gemini request failed:', error?.name);
    return send(res, 502, { error: 'Cannot connect to Gemini right now.' });
  } finally { clearTimeout(timer); }
};
