/* AA Plug 2 MCP tests: tool list + full SnapLedger sample flow (stdio) + HTTP endpoint.
   Texts come in en (default) / ko / th / zh / hi; omitted or unknown lang → English.
   Run: npm test  (uses a temporary data folder and removes it at the end) */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = process.env.AAPLUG2_TEST_SERVER || path.join(HERE, '..', 'server.mjs');
let GFX = true;
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aaplug2-test-'));
const KEEP = process.argv.includes('--keep');
let pass = 0, failN = 0;
const check = (cond, name, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const data = r => JSON.parse(r.content[0].text);
const SCRIPT = { ko: /[\uAC00-\uD7A3]/, th: /[\u0E00-\u0E7F]/, zh: /[\u4E00-\u9FFF]/, hi: /[\u0900-\u097F]/ };
const NON_EN = /[\uAC00-\uD7A3\u0E00-\u0E7F\u4E00-\u9FFF\u0900-\u097F]/;   // Hangul, Thai, Han or Devanagari: default texts must be English
const LANGS = ['en', 'ko', 'th', 'zh', 'hi'];

async function call(c, name, args) { return c.callTool({ name, arguments: args }); }

async function stdioFlow() {
  console.log('\n[stdio] node server.mjs');
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], env: { ...process.env, AAPLUG2_HOME: HOME }, stderr: 'pipe' });
  const c = new Client({ name: 'aaplug2-test', version: '1.0.0' });
  await c.connect(transport);
  const info = c.getServerVersion(); check(info && info.name === 'aaplug2', 'initialize → serverInfo aaplug2 ' + (info && info.version));
  check(/AA Plug 2/.test(c.getInstructions() || ''), 'server instructions present');
  const { tools } = await c.listTools();
  const names = tools.map(t => t.name).sort();
  console.log('  tools:', names.join(', '));
  check(names.length === 11, '11 tools listed', names);
  check(tools.every(t => t.description && t.description.length > 60 && t.inputSchema && t.inputSchema.type === 'object'), 'every tool has a description and an input schema');
  const langProps = tools.map(t => t.inputSchema.properties && t.inputSchema.properties.lang).filter(Boolean);
  check(langProps.length === tools.length && langProps.every(p => JSON.stringify(p.enum) === JSON.stringify(LANGS)), 'every tool: lang accepts en, ko, th, zh, hi', langProps.map(p => p.enum));
  const ins = c.getInstructions();
  check(!NON_EN.test(ins) && /en \(English, the default\)/.test(ins) && /zh \(Simplified Chinese\)/.test(ins) && /hi \(Hindi\)/.test(ins) && /Pass the user's language/.test(ins) && !/English only/i.test(ins), 'instructions: five languages, English default, pass the user\'s language');
  const { normLang } = await import('../lib/engine.mjs');
  check(normLang() === 'en' && normLang('xx') === 'en' && normLang('fr') === 'en' && LANGS.every(l => normLang(l) === l) && ['zh-TW', 'zh-CN', 'zh-Hans', 'zh-Hant'].every(l => normLang(l) === 'zh') && normLang('ko-KR') === 'ko', 'normLang: five codes kept, zh-* → zh, omitted/unknown → en');
  const { prompts } = await c.listPrompts(); check(prompts.some(p => p.name === 'launch_my_app'), 'prompt launch_my_app listed');

  // 1. 연결
  let r = await call(c, 'aaplug2_connect_app', { source: 'sample', lang: 'xx' });
  check(r.isError, 'lang "xx" rejected by the schema');
  r = await call(c, 'aaplug2_connect_app', { source: 'sample' }); const rep = data(r);
  const id = rep.project_id;
  check(!r.isError && id && rep.readiness === 26 && rep.counts.block === 6, 'connect sample → readiness 26%, 6 must-fix (Sign in with Apple now required)', rep.counts);
  check(rep.app.name === 'SnapLedger' && rep.app.targetSdk === 34 && rep.app.platforms.join() === 'android,ios', 'app facts: SnapLedger / targetSdk 34 / android+ios', rep.app);
  check(!NON_EN.test(JSON.stringify(rep)), 'connect (no lang) → analysis report fully in English (default en)');
  console.log('  summary:', rep.summary);

  // 2. 결정
  r = await call(c, 'aaplug2_get_decisions', { project_id: id }); let D = data(r);
  check(D.open_count === 25 && D.decisions.every(d => d.options.length >= 1), `get_decisions → ${D.open_count} open, each with options`);
  const adsDec = D.decisions.find(d => d.key === 'fix:adsNpa');
  check(adsDec && adsDec.recommended === 'npa' && !D.decisions.some(d => d.options.some(o => o.value === 'att' || o.value === 'track')), 'sample with ads: non-personalized ads recommended, no ATT option offered', adsDec);
  check(!NON_EN.test(JSON.stringify(D)), 'decisions: every title, reason and option label in English');
  const langsDec = D.decisions.find(d => d.key === 'langs');
  check(JSON.stringify(langsDec.recommended) === '["en"]' && langsDec.options[0].recommended && JSON.stringify(langsDec.options[0].value) === '["en"]' && langsDec.options[0].label === 'English (recommended)', 'store-listing languages: default/recommended = English', langsDec);
  check(['ko', 'th', 'zh', 'hi'].every(l => langsDec.options.some(o => o.value.includes(l))) && langsDec.options.some(o => o.value.length === 5), 'store-listing languages: ko, th, zh, hi stay available as options', langsDec.options.map(o => o.value.join('+')));
  for (const l of ['ko', 'th', 'zh', 'hi']) {
    r = await call(c, 'aaplug2_get_decisions', { project_id: id, lang: l }); const DL = data(r);
    const ld = DL.decisions.find(d => d.key === 'langs');
    check(!r.isError && SCRIPT[l].test(JSON.stringify(DL.decisions.map(d => d.title))) && SCRIPT[l].test(ld.options[0].label), `get_decisions lang=${l} → texts and listing-language labels in ${l}`, ld && ld.options[0].label);
  }
  r = await call(c, 'aaplug2_status', { project_id: id }); check(!NON_EN.test(JSON.stringify(data(r))), 'status without lang → still English after other-language calls');
  const title = D.decisions.find(d => d.key === 'title');
  console.log('  title options:', title.options.map(o => o.label).join(' | '));
  r = await call(c, 'aaplug2_decide', { project_id: id, choices: [{ key: 'title', value: 99 }] });
  check(r.isError, 'decide rejects an out-of-range value');
  r = await call(c, 'aaplug2_generate_store_materials', { project_id: id });
  check(r.isError && /decision/i.test(r.content[0].text), 'generate blocked until every decision is made');
  r = await call(c, 'aaplug2_decide', { project_id: id, choices: [{ key: 'langs', value: ['en', 'xx'] }] });
  check(r.isError, 'decide rejects an unknown store-listing language');
  r = await call(c, 'aaplug2_decide', { project_id: id, choices: [{ key: 'title', value: 1 }, { key: 'fix:targetSdk', value: 'apply' }, { key: 'langs', value: ['en'] }, { key: 'icon', value: 1 }] });
  D = data(r); check(!r.isError && D.applied.length === 4 && D.open_count === 21, 'decide 4 user picks → 21 left', D);
  r = await call(c, 'aaplug2_decide', { project_id: id, choices: [{ key: 'langs', value: ['en', 'zh', 'hi'] }], lang: 'zh' });
  check(!r.isError && SCRIPT.zh.test(JSON.stringify(data(r))), 'decide accepts zh + hi listing languages (reply in zh)', data(r));
  r = await call(c, 'aaplug2_decide', { project_id: id, choices: [{ key: 'langs', value: ['en'] }] });
  r = await call(c, 'aaplug2_decide', { project_id: id, accept_all_recommended: true }); D = data(r);
  check(D.open_count === 0, 'accept_all_recommended → 0 left');

  // 3. 그래픽 미리보기
  r = await call(c, 'aaplug2_preview_graphics', { project_id: id, kind: 'icons' });
  const imgs = r.content.filter(x => x.type === 'image');
  if (data(r).note) { GFX = false; console.log('  - graphics module not installed here: graphics checks skipped (' + data(r).note + ')'); }
  else {
    check(imgs.length === 3 && imgs.every(i => i.mimeType === 'image/png' && i.data.length > 1000), 'preview icons → 3 PNG images');
    r = await call(c, 'aaplug2_preview_graphics', { project_id: id, kind: 'feature', lang: 'en' });
    check(r.content.filter(x => x.type === 'image').length === 3, 'preview feature (en) → 3 PNG images');
    for (const l of ['zh', 'hi']) { r = await call(c, 'aaplug2_preview_graphics', { project_id: id, kind: 'feature', lang: l }); check(!r.isError && r.content.filter(x => x.type === 'image').length === 3, `preview feature (${l}) → 3 PNG images`); }
    r = await call(c, 'aaplug2_preview_graphics', { project_id: id, kind: 'screenshots' });
    check(r.content.filter(x => x.type === 'image').length >= 1 && data(r).images.every(i => /-en\.png$/.test(i.file)), 'preview screenshots → English PNGs');
  }

  // 4. 자료
  r = await call(c, 'aaplug2_generate_store_materials', { project_id: id }); const G = data(r);
  check(!r.isError && fs.existsSync(G.zip) && G.files.length >= (GFX ? 14 : 9), `generate → ${G.files.length} files + ZIP ${G.zip_bytes} bytes`);
  check(Object.keys(G.listing).join() === 'en' && G.listing.en.google_play.title === title.options[1].label && G.listing.en.google_play.title.length <= 30 && G.listing.en.app_store.name, 'listing: English (as picked), chosen EN title ≤ 30 chars, Play + App Store', [Object.keys(G.listing), G.listing.en.google_play.title]);
  check(G.files.includes('listing/en/google-play.txt') && G.files.includes('policy/privacy-policy-en.html') && !G.files.some(f => /\/(ko|th|zh|hi)\/|-(ko|th|zh|hi)\.(html|png)$/.test(f)), 'bundle files follow the picked listing language (listing/en, privacy-policy-en)', G.files);
  check(!NON_EN.test(fs.readFileSync(path.join(G.folder, 'README.txt'), 'utf8')) && !NON_EN.test(G.summary + G.note_privacy_hosting), 'generate summary + README in English');
  check(G.files.includes('fixes/aaplug2-fixes.diff') && G.files.includes('ios/PrivacyInfo.xcprivacy') && (!GFX || G.files.includes('graphics/feature-graphic-1024x500.png')), 'bundle has diff, xcprivacy' + (GFX ? ', feature graphic' : ''));
  check(fs.readFileSync(path.join(G.folder, 'fixes/aaplug2-fixes.diff'), 'utf8').includes('targetSdk = 36'), 'approved targetSdk fix is in the diff');

  // 5. 제출 안내 + 승인 게이트
  r = await call(c, 'aaplug2_submission_guide', { project_id: id, store: 'play' }); let Gd = data(r);
  const last = Gd.steps[Gd.steps.length - 1];
  check(!Gd.approved && last.final && last.locked && last.fields.length === 0, `play guide: ${Gd.steps.length} steps, final step locked`);
  check(!NON_EN.test(JSON.stringify(Gd)) && JSON.stringify(Gd).includes('English (United States) – en-US'), 'play guide in English, default store language en-US');
  r = await call(c, 'aaplug2_report_review', { project_id: id, store: 'play', event: 'submitted' });
  check(r.isError, 'report "submitted" refused before user approval');
  r = await call(c, 'aaplug2_approve_submission', { project_id: id, store: 'play', user_confirmation: 'OK, submit it' }); const Ap = data(r);
  check(Ap.approved && Ap.auto_submit === false && !Ap.final_step.locked && Ap.final_step.fields.length > 0, 'approve → final step unlocked, auto_submit=false');
  r = await call(c, 'aaplug2_submission_guide', { project_id: id, store: 'apple', lang: 'en' }); Gd = data(r);
  check(Gd.steps.length >= 7 && Gd.steps.some(s => s.id === 'a-privacy'), `apple guide (en): ${Gd.steps.length} steps`);
  r = await call(c, 'aaplug2_submission_guide', { project_id: id, store: 'play', lang: 'hi' }); check(!r.isError && SCRIPT.hi.test(JSON.stringify(data(r).steps)), 'play guide lang=hi → Hindi steps');
  r = await call(c, 'aaplug2_submission_guide', { project_id: id, store: 'apple', lang: 'zh' }); check(!r.isError && SCRIPT.zh.test(JSON.stringify(data(r).steps)), 'apple guide lang=zh → Chinese steps');
  r = await call(c, 'aaplug2_approve_submission', { project_id: id, store: 'apple', user_confirmation: 'yes submit' });

  // 6. 심사
  r = await call(c, 'aaplug2_report_review', { project_id: id, store: 'play', event: 'submitted' }); check(data(r).status === 'in_review', 'play submitted → in_review');
  r = await call(c, 'aaplug2_report_review', { project_id: id, store: 'play', event: 'approved' }); let Rv = data(r);
  check(Rv.status === 'live' && !Rv.all_launched && Rv.remaining_stores.join() === 'App Store', 'play approved → live, App Store remaining');
  await call(c, 'aaplug2_report_review', { project_id: id, store: 'apple', event: 'submitted' });
  r = await call(c, 'aaplug2_report_review', { project_id: id, store: 'apple', event: 'rejected' }); Rv = data(r);
  check(Rv.status === 'rejected' && Rv.sample_message_for_demo, 'apple rejected without text → asks for the message (demo text offered)');
  r = await call(c, 'aaplug2_report_review', { project_id: id, store: 'apple', event: 'rejected', rejection_text: Rv.sample_message_for_demo }); Rv = data(r);
  check(Rv.matched && Rv.fix_plan.length >= 2 && /Hello App Review team/.test(Rv.reply_to_reviewer), 'rejection matched → fix plan + reviewer reply');
  console.log('  reason:', Rv.reason);
  await call(c, 'aaplug2_report_review', { project_id: id, store: 'apple', event: 'resubmitted' });
  r = await call(c, 'aaplug2_report_review', { project_id: id, store: 'apple', event: 'approved' }); Rv = data(r);
  check(Rv.all_launched === true && /Launched!/.test(Rv.message) && !NON_EN.test(Rv.message), 'apple approved → all launched (English message)');
  console.log('  message:', Rv.message);
  r = await call(c, 'aaplug2_status', { project_id: id }); check(data(r).step === 'done', 'status → done');
  r = await call(c, 'aaplug2_status', {}); check(data(r).projects.length === 1, 'status list → 1 project');

  // 7. 로컬 폴더 연결 (sample 원본 폴더)
  r = await call(c, 'aaplug2_connect_app', { source: 'path', path: process.env.AAPLUG2_TEST_SAMPLE_DIR || path.join(HERE, '..', '..', 'sample', 'snapledger'), lang: 'en' });
  check(!r.isError && data(r).readiness === 26, 'connect local folder (sample/snapledger) → same analysis', r.isError ? r.content[0].text : undefined);
  r = await call(c, 'aaplug2_connect_app', { source: 'path', path: '/definitely/not/here' });
  check(r.isError, 'missing path → clear error');
  await c.close();
}

async function httpFlow() {
  const port = 5300 + Math.floor(Math.random() * 500);
  console.log(`\n[http] node server.mjs --http --port ${port}`);
  const p = spawn(process.execPath, [SERVER, '--http', '--port', String(port)], { env: { ...process.env, AAPLUG2_HOME: HOME }, stdio: ['ignore', 'ignore', 'pipe'] });
  await new Promise((res, rej) => { p.stderr.on('data', d => /on http/.test(String(d)) && res()); p.on('exit', rej); setTimeout(() => rej(new Error('timeout')), 15000); });
  try {
    const c = new Client({ name: 'aaplug2-test-http', version: '1.0.0' });
    await c.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
    const { tools } = await c.listTools(); check(tools.length === 11, 'HTTP: 11 tools listed');
    let r = await c.callTool({ name: 'aaplug2_connect_app', arguments: { source: 'sample' } });
    const id = data(r).project_id; check(!!id && !NON_EN.test(data(r).summary), 'HTTP: connect sample (default en) → ' + data(r).summary);
    r = await c.callTool({ name: 'aaplug2_connect_app', arguments: { source: 'path', path: '/etc' } });
    check(r.isError, 'HTTP: local path source disabled by default');
    r = await c.callTool({ name: 'aaplug2_decide', arguments: { project_id: id, accept_all_recommended: true } });
    r = await c.callTool({ name: 'aaplug2_generate_store_materials', arguments: { project_id: id } });
    const zip = r.content.find(x => x.type === 'resource');
    check(zip && zip.resource.mimeType === 'application/zip' && zip.resource.blob.length > 5000, 'HTTP: generate returns the ZIP inline as a resource');
    check(Object.keys(data(r).listing).join() === 'en', 'HTTP: accept all recommended → English store listing');
    r = await c.callTool({ name: 'aaplug2_decide', arguments: { project_id: id, choices: [{ key: 'langs', value: LANGS }] } });
    check(!r.isError, 'HTTP: all five store-listing languages can be picked');
    r = await c.callTool({ name: 'aaplug2_generate_store_materials', arguments: { project_id: id } }); const G5 = data(r);
    check(!r.isError && Object.keys(G5.listing).join() === LANGS.join() && ['ko', 'th', 'zh', 'hi'].every(l => SCRIPT[l].test(JSON.stringify(G5.listing[l])) && G5.files.includes(`policy/privacy-policy-${l}.html`) && G5.files.includes(`listing/${l}/google-play.txt`)), 'HTTP: five-language kit → listings + privacy policies in en/ko/th/zh/hi', G5.files);
    check(LANGS.every(l => G5.listing[l].google_play.title.length <= 30 && G5.listing[l].google_play.short_description.length <= 80), 'HTTP: every language keeps store limits (title ≤ 30, short ≤ 80)', LANGS.map(l => G5.listing[l].google_play));
    await c.close();
    const bad = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    check(bad.status === 403, 'HTTP: foreign Origin rejected (403)');
  } finally { p.kill(); }
}

try { await stdioFlow(); await httpFlow(); }
catch (e) { failN++; console.error('test crashed:', e); }
finally { if (!KEEP) fs.rmSync(HOME, { recursive: true, force: true }); else console.log('data kept in', HOME); }
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
