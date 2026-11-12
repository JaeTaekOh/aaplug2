/* AA Plug 2 shared review lessons — Cloudflare Worker for https://aaplug.com/api/lessons only.
   POST: one anonymized lesson event { v:1, event:"rejected"|"passed", store, codes, advice_id } → increments an aggregate count.
   GET : the aggregated feed { lessons:[{ store, codes, advice_id, title, advice, count, passed, last_seen }] }.
   Privacy: strict allowlist (unknown fields are rejected, never stored or logged); no per-user rows; titles / advice come only
   from the fixed table (src/table.js, generated from js/lessons.js). IPs are only used as a salted hash for a 1-hour
   rate-limit key that expires on its own. Bodies are never logged. Every other path is passed to the origin untouched. */
import { TABLE, PLAY_IDS } from './table.js';

const PATH = /^\/api\/lessons\/?$/;
const MAX_BODY = 2048, MAX_ROWS = 600, RL_LIMIT = 30, RL_TTL = 3600;
const FEED_KEY = 'feed:v1', TEST_KEY = 'feed:test';
const RE_GUIDE = /^\d{1,2}\.\d{1,2}(\.\d{1,2})?(\((?:[a-z]|[ivx]{1,4})\))?$/, RE_ITMS = /^ITMS-\d{5}$/;
const ALLOWED = ['v', 'event', 'store', 'codes', 'advice_id'];
const ORIGIN_OK = o => /^https:\/\/(www\.)?aaplug\.com$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o);

const codeOk = (store, c) => typeof c === 'string' && c.length <= 16 && (store === 'apple' ? (RE_GUIDE.test(c) || RE_ITMS.test(c)) : PLAY_IDS.includes(c));
/* Same rules as validShare in js/lessons.js, plus the test-only advice id "test" (kept apart, never in the public feed). */
export function validate(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  if (Object.keys(p).some(k => !ALLOWED.includes(k))) return null;
  if (p.v !== undefined && p.v !== 1) return null;
  const event = p.event === undefined ? 'rejected' : p.event;
  if (event !== 'rejected' && event !== 'passed') return null;
  if (p.store !== 'apple' && p.store !== 'play') return null;
  if (typeof p.advice_id !== 'string') return null;
  const test = p.advice_id === 'test', E = TABLE[p.advice_id];
  if (!test && (!E || E.store !== p.store)) return null;
  if (!Array.isArray(p.codes) || p.codes.length > 6 || !p.codes.every(c => codeOk(p.store, c))) return null;
  const codes = [...new Set(p.codes)].sort();
  if (p.advice_id === 'apple-codes' && !codes.length) return null;
  return { event, store: p.store, codes, advice_id: p.advice_id, test };
}

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return ORIGIN_OK(o) ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
}
const json = (req, status, body, extra) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...cors(req), ...(extra || {}) } });

async function readDoc(env, key) { try { const d = await env.LESSONS.get(key, 'json'); return d && typeof d.rows === 'object' ? d : { v: 1, rows: {} }; } catch { return { v: 1, rows: {} }; } }
function feedOf(doc, test) {
  const lessons = Object.values(doc.rows).map(r => {
    const E = TABLE[r.advice_id] || { title: 'test', advice: 'test' };
    return { store: r.store, codes: r.codes, advice_id: r.advice_id, title: E.title, advice: E.advice, count: r.count | 0, passed: r.passed | 0, last_seen: r.last_seen };
  }).filter(x => test || TABLE[x.advice_id]).sort((a, b) => b.count - a.count);
  return { v: 1, source: 'aaplug.com', note: 'Aggregated, anonymized store-review lessons. Titles and advice come from AA Plug 2\'s fixed table.', updated: doc.updated || null, lessons };
}
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); }

async function handleGet(req, env, ctx) {
  const url = new URL(req.url), test = url.searchParams.get('test') === '1';
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const ck = new Request(url.origin + '/api/lessons?cache=v1');
  if (!test && cache) { const hit = await cache.match(ck); if (hit) { const r = new Response(hit.body, hit); Object.entries(cors(req)).forEach(([k, v]) => r.headers.set(k, v)); return r; } }
  const body = feedOf(await readDoc(env, test ? TEST_KEY : FEED_KEY), test);
  const res = json(req, 200, body, { 'Cache-Control': test ? 'no-store' : 'public, max-age=900, s-maxage=600' });
  if (!test && cache) { const c = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' } }); ctx.waitUntil(cache.put(ck, c)); }
  return res;
}

async function handlePost(req, env) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return json(req, 413, { error: 'too_large' });
  if (!/application\/json/i.test(req.headers.get('Content-Type') || '')) return json(req, 415, { error: 'json_only' });
  let text = '';
  try { const buf = await req.arrayBuffer(); if (buf.byteLength > MAX_BODY) return json(req, 413, { error: 'too_large' }); text = new TextDecoder().decode(buf); } catch { return json(req, 400, { error: 'invalid' }); }
  let p; try { p = JSON.parse(text); } catch { return json(req, 400, { error: 'invalid' }); }
  text = null;
  const ok = validate(p); p = null;   // drop the original object right away; only the validated copy is used
  if (!ok) return json(req, 400, { error: 'invalid' });
  /* Rate limit: hashed (IP + hour), 1-hour TTL. No IP is ever stored in clear or kept longer. */
  const hour = Math.floor(Date.now() / 3600e3), ip = req.headers.get('CF-Connecting-IP') || 'none';
  const rk = 'rl:' + await sha(ip + '|' + hour + '|' + (env.RL_SALT || 'aaplug2-lessons'));
  const used = Number(await env.LESSONS.get(rk)) || 0;
  if (used >= RL_LIMIT) return json(req, 429, { error: 'rate_limited' }, { 'Retry-After': '3600' });
  await env.LESSONS.put(rk, String(used + 1), { expirationTtl: RL_TTL });
  const key = ok.test ? TEST_KEY : FEED_KEY, doc = await readDoc(env, key);
  const rowKey = ok.store + '|' + ok.advice_id + '|' + ok.codes.join(',');
  const day = new Date().toISOString().slice(0, 10);
  let r = doc.rows[rowKey];
  if (!r) {
    if (Object.keys(doc.rows).length >= MAX_ROWS) return json(req, 202, { ok: true, counted: false });
    r = doc.rows[rowKey] = { store: ok.store, codes: ok.codes, advice_id: ok.advice_id, count: 0, passed: 0, first_seen: day, last_seen: day };
  }
  if (ok.event === 'passed') r.passed = (r.passed | 0) + 1; else { r.count = (r.count | 0) + 1; r.last_seen = day; }
  doc.updated = day;
  await env.LESSONS.put(key, JSON.stringify(doc));
  return json(req, 202, { ok: true, counted: true });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!PATH.test(url.pathname)) return fetch(req);   // never take over site pages
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
      if (req.method === 'GET' || req.method === 'HEAD') return await handleGet(req, env, ctx);
      if (req.method === 'POST') return await handlePost(req, env);
      return json(req, 405, { error: 'method' }, { Allow: 'GET, POST, OPTIONS' });
    } catch (e) {
      console.error('lessons worker error', e && e.name);   // never the body
      return json(req, 500, { error: 'server' });
    }
  }
};
