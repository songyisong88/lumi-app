// LUMI AI pre-moderation worker — scaffold, NOT deployed, no keys. Runs after the virus scans (ai_review_claim only
// returns listings whose files are all scanned clean). LUMI applies the verdict using settings.ai_review:
// approve -> live only if auto_approve=true and confidence >= min_confidence_approve; reject -> needs_changes with the Thai reason
// only if auto_reject=true; anything else (and sw/game/bot/hire always) -> moderator queue (moderation_queue()).
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI_PROVIDER (openai_moderation|openai_chat|gemini|aws_rekognition), AI_MODEL, provider key
import { providers } from './providers.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
const E = process.env, H = { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
const run = providers[E.AI_PROVIDER]; if (!run || !E.SUPABASE_URL) { console.error('set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI_PROVIDER'); process.exit(1); }
const rpc = async (fn, body) => { const r = await fetch(`${E.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${fn} ${r.status} ${await r.text()}`); return r.json(); };
const img = (bucket, p) => `${E.SUPABASE_URL}/storage/v1/object/public/${bucket}/${p}`;
for (;;) {
  let job;
  try {
    [job] = await rpc('ai_review_claim', { p_worker: `ai-${process.pid}` });
    if (!job) { await sleep(+(E.POLL_MS || 20000)); continue; }
    const l = job.listing, out = await run(l, (l.images || []).map(p => /^https?:/.test(p) ? p : img(l.image_bucket, p)), E);
    const res = await rpc('ai_review_finish', { p_job: job.job_id, p_verdict: out.verdict, p_reason_code: out.reason_code, p_reason: out.reason, p_confidence: out.confidence,
      p_categories: out.categories ?? null, p_provider: E.AI_PROVIDER, p_model: E.AI_MODEL ?? null, p_cost_usd: out.cost_usd ?? null, p_error: null });
    console.log(new Date().toISOString(), job.target_type, job.target_id, out.verdict, '->', res);
  } catch (e) {
    console.error('ai-review', e.message);
    if (job) await rpc('ai_review_finish', { p_job: job.job_id, p_error: String(e.message).slice(0, 300) }).catch(() => {});
    await sleep(10000);
  }
}
