/* AA Plug 2 MCP — shared review lessons (0.1.4).
   After a real (non-demo) learned review result, an anonymized event goes to https://aaplug.com/api/lessons:
   { v:1, event, store, codes, advice_id } — built by Lessons.sharePayload from fixed tables only. Never the store
   message, app name, bundle / package id, project id, e-mail, URL, path or any free text.
   The aggregated feed is fetched (5 s timeout) and cached in $AAPLUG2_HOME/shared-lessons.json for 12 hours.
   Every network error is swallowed: the local flow never depends on the server. */
import fs from 'node:fs';
import path from 'node:path';
import { Lessons } from './runtime.mjs';
import os from 'node:os';

/* Endpoint override exists only for tests and local development (point it at a mock server). */
export const API = process.env.AAPLUG2_LESSONS_API || Lessons.SHARE_URL;
const LHOME = process.env.AAPLUG2_HOME || path.join(os.homedir(), '.aaplug2');
export const SHARED_FILE = path.join(LHOME, 'shared-lessons.json');
const TTL = 12 * 3600e3, RETRY_AFTER_FAIL = 15 * 60e3, TIMEOUT = 5000;
const pending = new Set();
let lastFail = 0, mem = null;

const timeoutSignal = ms => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
function track(p) { const q = Promise.resolve(p).catch(() => null).finally(() => pending.delete(q)); pending.add(q); return q; }
/* Tests: wait for background posts. */
export const flushShared = () => Promise.all([...pending]);

/* Send one anonymized event in the background. Returns the exact payload (or null) so callers can show what was shared. */
export function shareLesson(lesson, event) {
  let payload = null;
  try { payload = Lessons.sharePayload(lesson, event); } catch { payload = null; }
  if (!payload) return null;
  try {
    track(fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'aaplug2-mcp' }, body: JSON.stringify(payload), signal: timeoutSignal(TIMEOUT) })
      .then(r => { try { r.body && r.body.cancel && r.body.cancel(); } catch { } }));
  } catch { /* fetch missing or threw synchronously: ignore */ }
  return payload;
}

function readCache() {
  try { const c = JSON.parse(fs.readFileSync(SHARED_FILE, 'utf8')); return { at: Number(c.fetched_at) || 0, items: Lessons.normShared(c.feed) }; } catch { return null; }
}
/* Refresh the cached feed when it is older than 12 hours. Never throws; at most one 5 s wait. */
export async function ensureShared() {
  const c = mem || readCache(); mem = c;
  const now = Date.now();
  if (c && now - c.at < TTL) return c.items;
  if (now - lastFail < RETRY_AFTER_FAIL) return c ? c.items : [];
  try {
    const r = await track(fetch(API, { headers: { Accept: 'application/json', 'User-Agent': 'aaplug2-mcp' }, signal: timeoutSignal(TIMEOUT) }));
    if (!r || !r.ok) throw new Error('feed ' + (r && r.status));
    const txt = await r.text(); if (txt.length > 512 * 1024) throw new Error('feed too large');
    const feed = JSON.parse(txt), items = Lessons.normShared(feed);
    const clean = { lessons: items };   // only validated fields are written to disk
    try { fs.mkdirSync(LHOME, { recursive: true }); fs.writeFileSync(SHARED_FILE, JSON.stringify({ fetched_at: now, source: API, feed: clean }, null, 1), { mode: 0o600 }); } catch { }
    mem = { at: now, items }; return items;
  } catch { lastFail = now; return c ? c.items : []; }
}
/* Synchronous read of what is cached (memory or disk). */
export function sharedItems() { const c = mem || readCache(); mem = c; return c ? c.items : []; }
/* Tests only. */
export function _resetShared() { mem = null; lastFail = 0; }
