/* AA Plug 2 MCP 자동 테스트: 도구 목록 + 샘플 SnapLedger 전체 흐름 (stdio) + HTTP 엔드포인트 확인
   실행: npm test  (임시 데이터 폴더를 쓰고 끝나면 지운다) */
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
  check(names.length === 10, '10 tools listed', names);
  check(tools.every(t => t.description && t.description.length > 60 && t.inputSchema && t.inputSchema.type === 'object'), 'every tool has a description and an input schema');
  const { prompts } = await c.listPrompts(); check(prompts.some(p => p.name === 'launch_my_app'), 'prompt launch_my_app listed');

  // 1. 연결
  let r = await call(c, 'aaplug2_connect_app', { source: 'sample', lang: 'ko' }); const rep = data(r);
  const id = rep.project_id;
  check(!r.isError && id && rep.readiness === 35 && rep.counts.block === 5, 'connect sample → readiness 35%, 5 must-fix', rep.counts);
  check(rep.app.name === '스냅가계부' && rep.app.targetSdk === 34 && rep.app.platforms.join() === 'android,ios', 'app facts: 스냅가계부 / targetSdk 34 / android+ios');
  console.log('  summary:', rep.summary);

  // 2. 결정
  r = await call(c, 'aaplug2_get_decisions', { project_id: id }); let D = data(r);
  check(D.open_count === 23 && D.decisions.every(d => d.options.length >= 1), `get_decisions → ${D.open_count} open, each with options`);
  const title = D.decisions.find(d => d.key === 'title');
  console.log('  title options:', title.options.map(o => o.label).join(' | '));
  r = await call(c, 'aaplug2_decide', { project_id: id, choices: [{ key: 'title', value: 99 }] });
  check(r.isError, 'decide rejects an out-of-range value');
  r = await call(c, 'aaplug2_generate_store_materials', { project_id: id });
  check(r.isError && /결정|decision/i.test(r.content[0].text), 'generate blocked until every decision is made');
  r = await call(c, 'aaplug2_decide', { project_id: id, choices: [{ key: 'title', value: 1 }, { key: 'fix:targetSdk', value: 'apply' }, { key: 'langs', value: ['ko', 'en', 'th'] }, { key: 'icon', value: 1 }] });
  D = data(r); check(!r.isError && D.applied.length === 4 && D.open_count === 19, 'decide 4 user picks → 19 left', D);
  r = await call(c, 'aaplug2_decide', { project_id: id, accept_all_recommended: true }); D = data(r);
  check(D.open_count === 0, 'accept_all_recommended → 0 left');

  // 3. 그래픽 미리보기
  r = await call(c, 'aaplug2_preview_graphics', { project_id: id, kind: 'icons' });
  const imgs = r.content.filter(x => x.type === 'image');
  if (data(r).note) { GFX = false; console.log('  - graphics module not installed here: graphics checks skipped (' + data(r).note + ')'); }
  else {
    check(imgs.length === 3 && imgs.every(i => i.mimeType === 'image/png' && i.data.length > 1000), 'preview icons → 3 PNG images');
    r = await call(c, 'aaplug2_preview_graphics', { project_id: id, kind: 'feature', lang: 'th' });
    check(r.content.filter(x => x.type === 'image').length === 3, 'preview feature (th) → 3 PNG images');
  }

  // 4. 자료
  r = await call(c, 'aaplug2_generate_store_materials', { project_id: id }); const G = data(r);
  check(!r.isError && fs.existsSync(G.zip) && G.files.length >= (GFX ? 20 : 15), `generate → ${G.files.length} files + ZIP ${G.zip_bytes} bytes`);
  check(G.listing.ko.google_play.title === '스냅가계부 - 영수증 찍으면 가계부 끝' && G.listing.th.google_play.title.length <= 30, 'listing: chosen KO title, TH title ≤ 30 chars', [G.listing.ko.google_play.title, G.listing.th.google_play.title]);
  check(G.files.includes('fixes/aaplug2-fixes.diff') && G.files.includes('ios/PrivacyInfo.xcprivacy') && (!GFX || G.files.includes('graphics/feature-graphic-1024x500.png')), 'bundle has diff, xcprivacy' + (GFX ? ', feature graphic' : ''));
  check(fs.readFileSync(path.join(G.folder, 'fixes/aaplug2-fixes.diff'), 'utf8').includes('targetSdk = 36'), 'approved targetSdk fix is in the diff');

  // 5. 제출 안내 + 승인 게이트
  r = await call(c, 'aaplug2_submission_guide', { project_id: id, store: 'play' }); let Gd = data(r);
  const last = Gd.steps[Gd.steps.length - 1];
  check(!Gd.approved && last.final && last.locked && last.fields.length === 0, `play guide: ${Gd.steps.length} steps, final step locked`);
  r = await call(c, 'aaplug2_report_review', { project_id: id, store: 'play', event: 'submitted' });
  check(r.isError, 'report "submitted" refused before user approval');
  r = await call(c, 'aaplug2_approve_submission', { project_id: id, store: 'play', user_confirmation: '좋아요, 제출할게요' }); const Ap = data(r);
  check(Ap.approved && Ap.auto_submit === false && !Ap.final_step.locked && Ap.final_step.fields.length > 0, 'approve → final step unlocked, auto_submit=false');
  r = await call(c, 'aaplug2_submission_guide', { project_id: id, store: 'apple', lang: 'en' }); Gd = data(r);
  check(Gd.steps.length >= 7 && Gd.steps.some(s => s.id === 'a-privacy'), `apple guide (en): ${Gd.steps.length} steps`);
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
  check(Rv.all_launched === true && /출시 완료/.test(Rv.message), 'apple approved → all launched (출시 완료)');
  console.log('  message:', Rv.message);
  r = await call(c, 'aaplug2_status', { project_id: id }); check(data(r).step === 'done', 'status → done');
  r = await call(c, 'aaplug2_status', {}); check(data(r).projects.length === 1, 'status list → 1 project');

  // 7. 로컬 폴더 연결 (sample 원본 폴더)
  r = await call(c, 'aaplug2_connect_app', { source: 'path', path: process.env.AAPLUG2_TEST_SAMPLE_DIR || path.join(HERE, '..', '..', 'sample', 'snapledger'), lang: 'en' });
  check(!r.isError && data(r).readiness === 35, 'connect local folder (sample/snapledger) → same analysis', r.isError ? r.content[0].text : undefined);
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
    const { tools } = await c.listTools(); check(tools.length === 10, 'HTTP: 10 tools listed');
    let r = await c.callTool({ name: 'aaplug2_connect_app', arguments: { source: 'sample', lang: 'th' } });
    const id = data(r).project_id; check(!!id, 'HTTP: connect sample (th) → ' + data(r).summary);
    r = await c.callTool({ name: 'aaplug2_connect_app', arguments: { source: 'path', path: '/etc' } });
    check(r.isError, 'HTTP: local path source disabled by default');
    r = await c.callTool({ name: 'aaplug2_decide', arguments: { project_id: id, accept_all_recommended: true } });
    r = await c.callTool({ name: 'aaplug2_generate_store_materials', arguments: { project_id: id } });
    const zip = r.content.find(x => x.type === 'resource');
    check(zip && zip.resource.mimeType === 'application/zip' && zip.resource.blob.length > 5000, 'HTTP: generate returns the ZIP inline as a resource');
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
