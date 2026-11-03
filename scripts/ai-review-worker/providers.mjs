// Provider adapters for LUMI AI pre-moderation. Each returns
// { verdict: 'approve'|'reject'|'needs_human', reason_code, reason (Thai, shown to the seller), confidence 0..1, categories, cost_usd }
// NO keys are configured; nothing here runs until the owner picks a provider and sets settings.ai_review.enabled = true.
export const RULES = `คุณคือผู้ตรวจประกาศขายสินค้าดิจิทัลของ LUMI (ตลาดไทย). ตอบเป็น JSON เท่านั้น:
{"verdict":"approve|reject|needs_human","reason_code":"ok|sexual|violence|hate|scam|illegal|copyright|low_quality|mismatch|other","reason":"เหตุผลสั้นๆ ภาษาไทยสำหรับผู้ขาย","confidence":0-1}
reject เมื่อ: เนื้อหาทางเพศ/เด็ก, ความรุนแรง, ยาเสพติด/อาวุธ, หลอกลวง, ของละเมิดลิขสิทธิ์ (crack/keygen/บัญชีขโมย), รูปไม่ตรงกับสินค้า.
needs_human เมื่อไม่แน่ใจ. approve เฉพาะเมื่อมั่นใจว่าปลอดภัยและตรงปก.`;

const userText = l => `ประเภท: ${l.type}\nชื่อ: ${l.title}\nใช้ทำอะไร: ${l.use_text || ''}\nรายละเอียด: ${(l.description || '').slice(0, 4000)}\nแท็ก: ${(l.tags || []).join(', ')}\nราคา: ${l.is_free ? 'ฟรี' : l.price}\nไฟล์: ${(l.files || []).map(f => f.name).join(', ')}`;
const parse = t => { const j = JSON.parse(String(t).replace(/^```json|```$/g, '').trim()); return { ...j, confidence: Math.max(0, Math.min(1, +j.confidence || 0)) }; };

// prices per 1M tokens (USD) — official pages, 3 Nov 2026; update if they change
const PRICE = { 'gpt-4.1-mini': [0.40, 1.60], 'gpt-4o-mini': [0.15, 0.60], 'gpt-5-mini': [0.25, 2.00], 'gemini-2.5-flash-lite': [0.10, 0.40], 'gemini-3.5-flash-lite': [0.30, 2.50], 'gemini-3.8-flash': [0.75, 3.75] };
const cost = (m, i, o) => PRICE[m] ? (i * PRICE[m][0] + o * PRICE[m][1]) / 1e6 : null;

export const providers = {
  // free: harmful-content classifier only (no scam / copyright / quality judgement) -> approve never, reject on flags
  async openai_moderation(l, imgs, env) {
    const input = [{ type: 'text', text: userText(l) }, ...imgs.map(u => ({ type: 'image_url', image_url: { url: u } }))];
    const r = await fetch('https://api.openai.com/v1/moderations', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'omni-moderation-latest', input }) });
    if (!r.ok) throw new Error(`openai ${r.status}`);
    const res = (await r.json()).results[0], top = Object.entries(res.category_scores).sort((a, b) => b[1] - a[1])[0];
    return res.flagged ? { verdict: 'reject', reason_code: top[0].split('/')[0], reason: 'เนื้อหาหรือรูปภาพไม่เหมาะสมตามนโยบาย LUMI', confidence: top[1], categories: res.category_scores, cost_usd: 0 }
                       : { verdict: 'needs_human', reason_code: 'ok', reason: null, confidence: 1 - top[1], categories: res.category_scores, cost_usd: 0 };
  },
  async openai_chat(l, imgs, env, model = env.AI_MODEL || 'gpt-4.1-mini') {
    const content = [{ type: 'text', text: userText(l) }, ...imgs.map(u => ({ type: 'image_url', image_url: { url: u, detail: 'low' } }))];
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, response_format: { type: 'json_object' }, max_completion_tokens: 300, messages: [{ role: 'system', content: RULES }, { role: 'user', content }] }) });
    if (!r.ok) throw new Error(`openai ${r.status}`);
    const d = await r.json();
    return { ...parse(d.choices[0].message.content), cost_usd: cost(model, d.usage.prompt_tokens, d.usage.completion_tokens) };
  },
  async gemini(l, imgs, env, model = env.AI_MODEL || 'gemini-2.5-flash-lite') {
    const parts = [{ text: userText(l) }];
    for (const u of imgs) { const b = await fetch(u); parts.push({ inline_data: { mime_type: b.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await b.arrayBuffer()).toString('base64') } }); }
    // paid tier only: on the free tier Google may use the content to improve its products (not OK for users' listings)
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: RULES }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 300 } }) });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const d = await r.json(), u = d.usageMetadata || {};
    return { ...parse(d.candidates[0].content.parts[0].text), cost_usd: cost(model, u.promptTokenCount || 0, (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)) };
  },
  // images only ($0.001/image). Text still needs a human or another provider -> never approves on its own.
  async aws_rekognition(l, imgs, env) {
    const { RekognitionClient, DetectModerationLabelsCommand } = await import('@aws-sdk/client-rekognition');
    const c = new RekognitionClient({ region: env.AWS_REGION || 'ap-southeast-1' }); const labels = [];
    for (const u of imgs) { const b = new Uint8Array(await (await fetch(u)).arrayBuffer()); labels.push(...(await c.send(new DetectModerationLabelsCommand({ Image: { Bytes: b }, MinConfidence: 60 }))).ModerationLabels); }
    const top = labels.sort((a, b) => b.Confidence - a.Confidence)[0];
    return top && top.Confidence >= 80 ? { verdict: 'reject', reason_code: 'image_' + (top.ParentName || top.Name).toLowerCase().replace(/\W+/g, '_'), reason: 'รูปภาพไม่เหมาะสมตามนโยบาย LUMI', confidence: top.Confidence / 100, categories: labels, cost_usd: imgs.length * 0.001 }
                                       : { verdict: 'needs_human', reason_code: 'ok', reason: null, confidence: 0.5, categories: labels, cost_usd: imgs.length * 0.001 };
  },
};
