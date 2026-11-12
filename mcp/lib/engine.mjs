/* AA Plug 2 MCP — 흐름 엔진. 웹 앱과 같은 분석기·생성기·흐름 모듈을 쓰고, 상태는 로컬 JSON 으로 저장한다.
   어떤 함수도 스토어에 제출하지 않는다. 제출은 사용자가 콘솔에서 직접 한다. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Analyzer, Gen, Gfx, Flow, Sources, Zip, CFG, tr, hasGraphics, Lessons } from './runtime.mjs';
import { msg } from './messages.mjs';
import { withLessons, relevantLessons, listLessons } from './lessons.mjs';

/* Texts come in five languages; English is the default whenever lang is omitted or unknown. */
export const LANGS = ['en', 'ko', 'th', 'zh', 'hi'];
export const HOME = process.env.AAPLUG2_HOME || path.join(os.homedir(), '.aaplug2');
const PROJ = path.join(HOME, 'projects');
/* 'ko' → ko, 'zh-TW' / 'zh-CN' / 'zh-Hans' / 'zh-Hant' → zh, 'th_TH' → th; anything else → en */
export const normLang = l => { const p = String(l || '').trim().toLowerCase().split(/[-_]/)[0]; return LANGS.includes(p) ? p : 'en'; };
const STORE_NAME = { play: 'Google Play', apple: 'App Store' };
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.gradle', 'Pods', 'DerivedData', '.dart_tool', '.idea', 'intermediates', 'generated', '.expo', '.next', 'dist', '.cxx']);

export class UserError extends Error { constructor(m, code) { super(m); this.code = code || 'user'; } }

/* ---------- 저장 ---------- */
const idOk = id => typeof id === 'string' && /^[a-z0-9][\w.-]{2,80}$/i.test(id);
const dirOf = id => path.join(PROJ, id);
function save(st) { fs.mkdirSync(dirOf(st.id), { recursive: true }); st.updatedAt = new Date().toISOString(); fs.writeFileSync(path.join(dirOf(st.id), 'state.json'), JSON.stringify(st)); }
export function load(id, lang) {
  if (!idOk(id)) throw new UserError(msg(normLang(lang), 'noProject', { id }), 'noProject');
  const f = path.join(dirOf(id), 'state.json');
  if (!fs.existsSync(f)) throw new UserError(msg(normLang(lang), 'noProject', { id }), 'noProject');
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
const T = lang => (k, v) => tr(lang, k, v);
const appName = (st, lang) => Gen.nameOf(st.A, lang);

/* ---------- 1. 연결 + 분석 ---------- */
async function walkDir(root) {
  const top = path.basename(path.resolve(root)) || 'project'; const out = [];
  async function walk(dir, rel) {
    let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length > 20000) return;
      const abs = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(abs, r); }
      else if (e.isFile()) {
        let size = 0; try { size = (await fs.promises.stat(abs)).size; } catch { continue; }
        out.push({ name: e.name, webkitRelativePath: top + '/' + r, size, arrayBuffer: async () => { const b = await fs.promises.readFile(abs); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
      }
    }
  }
  await walk(path.resolve(root), '');
  return out;
}
export async function connect({ source, github_url, path: p, lang }, { allowPath }) {
  const L = normLang(lang); const t = T(L);
  let project;
  try {
    if (source === 'sample') project = await Sources.sample();
    else if (source === 'github') project = await Sources.fromGitHub(github_url || '');
    else if (source === 'path') {
      if (!allowPath) throw new UserError(msg(L, 'pathDisabled'), 'pathDisabled');
      const abs = path.resolve(String(p || '').replace(/^~(?=$|\/)/, os.homedir()));
      const stat = fs.statSync(abs);
      if (stat.isFile() && /\.zip$/i.test(abs)) { const b = fs.readFileSync(abs); project = await Sources.fromZipFile({ name: path.basename(abs), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }); }
      else if (stat.isDirectory()) project = await Sources.fromFileList(await walkDir(abs));
      else throw new UserError(t('err.noapp'), 'noapp');
    } else throw new UserError('source must be sample | github | path', 'badsource');
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e.code === 'ENOENT') throw new UserError(String(e.message), 'notfound');
    throw new UserError(t('err.' + (e.code || 'generic')) + (e.code ? '' : ' (' + e.message + ')'), e.code || 'generic');
  }
  const A = Analyzer.analyze(project);
  if (!A.platforms.android && !A.platforms.ios) throw new UserError(t('err.noapp'), 'noapp');
  A.brandColor = A.brandColor || (hasGraphics ? await Gfx.avgColor(A.icon && A.icon.dataUrl) : '#2f6f5e');
  const id = Flow.slugOf(A).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 40).replace(/^[^a-z0-9]+/, 'app') + '-' + crypto.randomBytes(5).toString('hex');
  const st = { id, v: 1, createdAt: new Date().toISOString(), lang: L, sample: source === 'sample', source: project.source, A, dec: {}, approved: {}, review: {}, generated: null };
  save(st);
  return { st, report: report(st, L) };
}

/* ---------- 2. 분석 보고 ---------- */
export function report(st, lang) {
  const L = normLang(lang || st.lang), t = T(L), A = st.A;
  const c = { block: 0, warn: 0, tip: 0 }; A.issues.forEach(i => c[i.sev]++);
  return {
    project_id: st.id,
    summary: msg(L, 'connected', { name: appName(st, L), ready: A.readiness }) + ' ' + msg(L, 'counts', c),
    app: { name: appName(st, L), package: A.pkg || null, version: A.version, platforms: Object.keys(A.platforms).filter(k => A.platforms[k]), framework: A.framework,
      targetSdk: (A.android && A.android.targetSdk) || null, categories: A.categories.map(k => Gen.CAT[k] ? `${Gen.CAT[k][L][1]} (${Gen.CAT[k].play})` : k),
      sdks: Object.entries(A.sdk).filter(([, v]) => v).map(([k]) => k), languages_in_app: A.locales, icon_found: !!A.icon, screenshots_found: A.screenshots.length,
      source: st.source },
    readiness: A.readiness, counts: c,
    issues: A.issues.map(i => ({ key: i.fix && i.fix !== 'info' ? Flow.issueKey(i) : null, severity: t('sev.' + i.sev), sev: i.sev, store: i.plat === 'android' ? 'Google Play' : i.plat === 'ios' ? 'App Store' : 'both',
      title: t('iss.' + i.id + '.t', i.vars), why: t('iss.' + i.id + '.w', i.vars), ai_fix: i.fix && i.fix !== 'info' ? t('iss.' + i.id + '.f', i.vars) : null })),
    ...learned(st, L),
    next: msg(L, 'nextDecide', { n: Flow.decisions(A).length })
  };
}
/* Lessons learned on this machine from earlier store reviews (any project). Warnings or reminders only; built-in checks stay the default. */
function learned(st, L) {
  const rel = relevantLessons(st.A, Flow.stores(st.A, st.dec), L);
  return rel.length ? { learned_lessons: rel, learned_note: msg(L, 'learnedNote', { n: rel.length }) } : {};
}
const withLearnedNotes = (notes, rel) => { const x = Lessons.reviewNoteLines(rel || []); return x.length ? [notes, ...x].filter(Boolean).join('\n\n') : notes; };

/* ---------- 3. 결정 ---------- */
const STYLE = { icon: ['original', 'brand', 'light'], feature: ['split', 'shot', 'minimal'] };
function optionList(st, d, L) {
  const A = st.A, t = T(L), C = Flow.chosen(A, st.dec);
  if (d.group === 'fix') {
    const is = d.issue, p = Gen.patches(A, L)[is.fix];
    return d.opts.map(o => ({ value: o, label: t('opt.' + o), detail: o === 'apply' ? t('iss.' + is.id + '.f', is.vars) + (p ? ` → ${p.file}` : '') : o === 'later' ? t('opt.later.d') : t('opt.' + o + '.d') }));
  }
  switch (d.key) {
    case 'stores': return d.opts.map(o => ({ value: o, label: t('store.' + o) }));
    case 'title': return C.listing(L).titles.map((v, k) => ({ value: k, label: v, detail: `${v.length}/30` }));
    case 'short': return C.listing(L).shorts.map((v, k) => ({ value: k, label: v, detail: `${v.length}/80` }));
    case 'tone': return ['friendly', 'pro'].map(o => ({ value: o, label: t('tone.' + o), detail: Gen.listing(A, L, o).full.split('\n')[0].slice(0, 120) }));
    case 'category': return A.categories.map((c, k) => ({ value: k, label: Gen.CAT[c][L][1], detail: `Play: ${Gen.CAT[c].play} · Apple: ${Gen.CAT[c].apple}` }));
    case 'langs': { const nm = v => v.map(l => t('lang.' + l)).join(' + ');
      return [{ value: Flow.DEFAULT_LANGS.slice(), label: t('dec.langs.rec') }, ...['ko', 'th', 'zh', 'hi'].map(l => ({ value: ['en', l], label: nm(['en', l]) })), { value: LANGS.slice(), label: nm(LANGS) }]; }
    case 'icon': return STYLE.icon.map((s, k) => ({ value: k, label: t('icon.' + s), detail: '512×512 · aaplug2_preview_graphics kind=icons' }));
    case 'feature': return STYLE.feature.map((s, k) => ({ value: k, label: t('feat.' + s), detail: '1024×500 · aaplug2_preview_graphics kind=feature' }));
    case 'shots': return [{ value: 'ok', label: t('opt.useThese'), detail: A.screenshots.length ? t('dec.shots.d', { n: A.screenshots.length }) : t('dec.shots.none') }];
    case 'privacy': return [{ value: 'ok', label: t('opt.approve'), detail: t('dec.privacy.d') + ' (' + C.langs.map(l => `privacy-policy-${l}.html`).join(', ') + ')' }];
    case 'safety': { const ds = Gen.dataSafety(A, L, Flow.privacyOpts(A, st.dec));
      return [{ value: 'ok', label: t('opt.approve'), detail: ds.rows.map(r => `${r.label}: ${r.purposes}${r.shared ? ' · shared' : ''}${r.tracking ? ' · tracking' : ''}`).concat(ds.notCollected.map(r => `${r.label}: ${r.note}`)).join(' / ') }]; }
    case 'access': case 'location': return d.opts.map(o => ({ value: o, label: t(d.key + '.' + o), detail: t(d.key + '.' + o + '.d') }));
    case 'rating': { const r = Gen.rating(A, L); return [{ value: 'ok', label: t('opt.approve'), detail: `Play: ${r.result.play} · App Store: ${r.result.apple}` }]; }
    case 'track': return d.opts.map(o => ({ value: o, label: t('track.' + o), detail: t('track.' + o + '.d') }));
  }
  return [];
}
function decisionTitle(d, L) {
  const t = T(L);
  if (d.group === 'fix') return { title: t('iss.' + d.issue.id + '.t', d.issue.vars), why: t('iss.' + d.issue.id + '.w', d.issue.vars), severity: t('sev.' + d.issue.sev) };
  return { title: t('dec.' + d.key), why: d.key === 'shots' ? '' : t('dec.' + d.key + '.d') };
}
export function decisions(st, lang, onlyOpen) {
  const L = normLang(lang || st.lang); const list = Flow.decisions(st.A);
  const out = list.map(d => {
    const opts = optionList(st, d, L), rec = Flow.recValue(d), cur = st.dec[d.key];
    return { key: d.key, group: d.group, ...decisionTitle(d, L), options: opts.map(o => ({ ...o, recommended: JSON.stringify(o.value) === JSON.stringify(rec) || undefined })), recommended: rec, decided: cur !== undefined, current: cur };
  });
  const open = out.filter(d => !d.decided);
  return { project_id: st.id, open_count: open.length, total: out.length, decisions: onlyOpen ? open : out, ...learned(st, L), next: open.length ? msg(L, 'openLeft', { n: open.length }) : msg(L, 'allDecided') };
}
function validate(st, d, val, L) {
  const bad = () => { throw new UserError(msg(L, 'badValue', { key: d.key, val: JSON.stringify(val) }), 'badValue'); };
  if (d.opts) { if (!d.opts.includes(val)) bad(); return val; }
  const C = Flow.chosen(st.A, st.dec);
  const idx = n => { const k = Number(val); if (!Number.isInteger(k) || k < 0 || k >= n) bad(); return k; };
  switch (d.key) {
    case 'title': return idx(C.listing(L).titles.length);
    case 'short': return idx(C.listing(L).shorts.length);
    case 'category': return idx(st.A.categories.length);
    case 'icon': case 'feature': return idx(3);
    case 'langs': { const a = Array.isArray(val) ? [...new Set(val)] : bad(); if (!a.length || a.some(x => !LANGS.includes(x))) bad(); return a; }
    case 'shots': case 'privacy': case 'safety': case 'rating': if (val !== 'ok') bad(); return 'ok';
  }
  bad();
}
export function decide(st, { choices, accept_all_recommended }, lang) {
  const L = normLang(lang || st.lang); const list = Flow.decisions(st.A); const applied = [];
  for (const c of choices || []) {
    const d = list.find(x => x.key === c.key); if (!d) throw new UserError(msg(L, 'unknownKey', { key: c.key }), 'unknownKey');
    st.dec[d.key] = validate(st, d, c.value, L); applied.push({ key: d.key, value: st.dec[d.key] });
  }
  if (accept_all_recommended) list.forEach(d => { if (st.dec[d.key] === undefined) { st.dec[d.key] = Flow.recValue(d); applied.push({ key: d.key, value: st.dec[d.key], recommended: true }); } });
  if (applied.length) { st.approved = {}; st.generated = null; }   // 결정이 바뀌면 이전 승인·자료는 무효
  save(st);
  const left = list.filter(d => st.dec[d.key] === undefined).map(d => d.key);
  return { project_id: st.id, applied, open_count: left.length, open_keys: left, next: left.length ? msg(L, 'openLeft', { n: left.length }) : msg(L, 'allDecided') };
}
function requireDecided(st, L) {
  const left = Flow.decisions(st.A).filter(d => st.dec[d.key] === undefined).map(d => d.key);
  if (left.length) throw new UserError(msg(L, 'needDecisions', { n: left.length, keys: left.join(', ') }), 'needDecisions');
}

/* ---------- 4. 그래픽 ---------- */
const b64 = u => u.split(',')[1];
async function graphics(st, L, kinds) {
  if (!hasGraphics) return null;
  const A = st.A, brand = A.brandColor || '#2f6f5e', C = Flow.chosen(A, st.dec), out = {};
  const icons = await Gfx.icons(A, brand); out.icons = icons.map(i => i.dataUrl);
  const iconUrl = out.icons[st.dec.icon != null ? st.dec.icon : 0];
  if (kinds.includes('feature')) {
    const nm = C.title(L).split(/ [-–:] /)[0], tg = C.short(L).replace(/[.。]$/, '');
    out.features = await Promise.all(STYLE.feature.map(s => Gfx.feature(A, L, s, brand, iconUrl, nm, tg)));
  }
  if (kinds.includes('screenshots')) out.shots = await Gfx.shots(A, L, brand, Gen.features(A, L), 'play');
  return out;
}
export async function preview(st, kind, lang) {
  const L = normLang(lang || st.lang);
  const g = await graphics(st, L, [kind]);
  if (!g) return { note: msg(L, 'noGraphics'), images: [] };
  const dir = path.join(dirOf(st.id), 'previews'); fs.mkdirSync(dir, { recursive: true });
  const t = T(L); const imgs = [];
  const put = (name, url, label) => { const f = path.join(dir, name); fs.writeFileSync(f, Buffer.from(b64(url), 'base64')); imgs.push({ file: f, label, data: b64(url) }); };
  if (kind === 'icons') g.icons.forEach((u, k) => put(`icon-${k}-${STYLE.icon[k]}.png`, u, `${k}: ${t('icon.' + STYLE.icon[k])} (512×512)`));
  else if (kind === 'feature') g.features.forEach((u, k) => put(`feature-${k}-${STYLE.feature[k]}-${L}.png`, u, `${k}: ${t('feat.' + STYLE.feature[k])} (1024×500)`));
  else g.shots.forEach((u, k) => put(`screenshot-${k + 1}-${L}.png`, u, `${k + 1} (1080×1920)`));
  return { images: imgs };
}

/* ---------- 5. 스토어 자료 ---------- */
export async function generate(st, { output_dir, lang }, { allowPath }) {
  const L = normLang(lang || st.lang), t = T(L); requireDecided(st, L);
  const A = st.A, C = Flow.chosen(A, st.dec), stores = Flow.stores(A, st.dec);
  const files = Flow.textFiles(A, st.dec, L, t);
  const rel = relevantLessons(A, stores, L);
  const nf = files.find(f => f.path === 'forms/app-review-notes.txt'); if (nf) nf.data = withLearnedNotes(String(nf.data).trimEnd(), rel) + '\n';
  const g = await graphics(st, L, ['feature', 'screenshots']);
  if (g) {
    files.push({ path: 'graphics/icon-512.png', data: Buffer.from(b64(g.icons[st.dec.icon || 0]), 'base64') });
    files.push({ path: 'graphics/feature-graphic-1024x500.png', data: Buffer.from(b64(g.features[st.dec.feature || 0]), 'base64') });
    g.shots.forEach((s, k) => files.push({ path: `graphics/screenshot-${k + 1}-1080x1920-${L}.png`, data: Buffer.from(b64(s), 'base64') }));
  }
  files.push({ path: 'README.txt', data: `AA Plug 2 — ${A.appName} (${A.pkg || ''})\n${new Date().toISOString().slice(0, 10)}\n\n${t('zip.readme')}\n\nFeedback: ${CFG.feedbackUrl}\n` });
  const base = output_dir && allowPath ? path.resolve(String(output_dir).replace(/^~(?=$|\/)/, os.homedir())) : path.join(dirOf(st.id), 'store-materials');
  const slug = Flow.slugOf(A), folder = path.join(base, 'aaplug2-' + slug);
  fs.rmSync(folder, { recursive: true, force: true });
  for (const f of files) { const p = path.join(folder, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.data); }
  const zipBlob = Zip.writeZip(files.map(f => ({ path: f.path, data: typeof f.data === 'string' ? f.data : new Uint8Array(f.data) })));
  const zipBuf = Buffer.from(await zipBlob.arrayBuffer()); const zipPath = folder + '.zip'; fs.writeFileSync(zipPath, zipBuf);
  st.generated = { at: new Date().toISOString(), folder, zip: zipPath, lang: L }; save(st);
  const listing = {};
  for (const l of C.langs) {
    listing[l] = { google_play: stores.play ? { title: C.title(l), short_description: C.short(l), full_description: C.full(l), category: C.cat.play } : undefined,
      app_store: stores.apple ? { name: C.title(l), subtitle: C.ios(l).subtitle, promotional_text: C.ios(l).promo, keywords: C.ios(l).keywords, description: C.full(l), category: C.cat.apple } : undefined };
  }
  const r = Gen.rating(A, L);
  return {
    project_id: st.id, summary: msg(L, 'generated', { n: files.length }) + (g ? '' : ' ' + msg(L, 'noGraphics')),
    folder, zip: zipPath, zip_bytes: zipBuf.length, files: files.map(f => f.path), stores: Object.keys(stores).filter(k => stores[k]).map(k => STORE_NAME[k]),
    listing, data_safety: Gen.dataSafety(A, L, Flow.privacyOpts(A, st.dec)).rows.map(x => ({ play: x.playType, apple: x.appleType, collected: x.collected, shared: x.shared, optional: x.optional, linked: x.linked, tracking: x.tracking, purposes: x.purposes })),
    content_rating: { play: r.result.play, apple: r.result.apple, answers: r.qa.map(([q, a]) => ({ q, a })) },
    applied_code_fixes: Flow.appliedFixes(A, st.dec, L).map(([, v]) => v.file),
    app_review_notes: stores.apple && A.ios ? withLearnedNotes(Flow.reviewNotes(A, st.dec, C.langs[0]), rel) : undefined,
    learned_lessons: rel.length ? rel : undefined,
    app_privacy_tracking: stores.apple && A.ios ? (Flow.trackingOn(A, st.dec) ? 'Yes, we track (ATT prompt + tracking domains must match)' : 'No, we do not track') : undefined,
    note_privacy_hosting: t('as.host'),
    next: 'aaplug2_submission_guide',
    _zipBase64: zipBuf.toString('base64')
  };
}

/* ---------- 6. 제출 안내 + 승인 ---------- */
function storeCheck(st, store, L) {
  if (!['play', 'apple'].includes(store)) throw new UserError('store must be play | apple', 'badStore');
  if (!Flow.stores(st.A, st.dec)[store]) throw new UserError(msg(L, 'notChosenStore', { store: STORE_NAME[store] }), 'notChosenStore');
}
export function guide(st, store, lang) {
  const L = normLang(lang || st.lang), t = T(L); requireDecided(st, L); storeCheck(st, store, L);
  const approved = !!st.approved[store];
  const steps = Flow.guide(st.A, st.dec, L, store, t).map((s, k) => {
    const locked = s.final && !approved;
    return { n: k + 1, id: s.id, title: t('g.' + s.id + '.t'), what: t('g.' + s.id + '.d'), how: t('g.' + s.id + '.how').split('|').filter(x => x && !x.startsWith('g.')),
      final: !!s.final || undefined, locked: locked || undefined, fields: locked ? [] : s.fields.map(([label, value]) => ({ label, value: String(value) })) };
  });
  const rel = relevantLessons(st.A, { [store]: true }, L).filter(r => r.store === store);
  const rv = steps.find(s => s.id === 'a-review'); const nf = rv && rv.fields.find(f => f.label === t('f.reviewNotes')); if (nf) nf.value = withLearnedNotes(nf.value, rel);
  if (rel.length) {
    const fin = steps.findIndex(s => s.final); const at = fin < 0 ? steps.length : fin;
    steps.splice(at, 0, { n: 0, id: 'learned-checks', title: Lessons.tx(L, 'step'), what: Lessons.tx(L, 'stepD'), how: [],
      fields: rel.map(r => ({ label: `${r.codes.length ? r.codes.join(', ') + ' · ' : ''}${r.title || r.builtin}${r.times_seen ? ' (' + Lessons.tx(L, 'seen', { n: r.times_seen }) + ')' : ''}`, value: [r.check || r.why, r.passed_note].filter(Boolean).join(' ') })) });
    steps.forEach((s, k) => { s.n = k + 1; });
  }
  return { project_id: st.id, store: STORE_NAME[store], approved, materials: st.generated ? { folder: st.generated.folder, zip: st.generated.zip } : null,
    note: approved ? msg(L, 'guideUnlocked') : msg(L, 'guideLocked'), steps, learned_lessons: rel.length ? rel : undefined };
}
export function approve(st, store, userWords, lang) {
  const L = normLang(lang || st.lang); requireDecided(st, L); storeCheck(st, store, L);
  st.approved[store] = { at: new Date().toISOString(), user_words: String(userWords || '').slice(0, 300) }; save(st);
  const g = guide(st, store, L);
  return { project_id: st.id, store: STORE_NAME[store], approved: true, message: msg(L, 'approved', { store: STORE_NAME[store] }), final_step: g.steps[g.steps.length - 1], auto_submit: false };
}

/* ---------- 7. 심사 결과 ---------- */
export function review(st, { store, event, rejection_text }, lang) {
  const L = normLang(lang || st.lang), t = T(L); storeCheck(st, store, L);
  const R = st.review[store] || { status: 'none', round: 0 }; const S = STORE_NAME[store];
  let out = { project_id: st.id, store: S };
  if (event === 'submitted' || event === 'resubmitted') {
    if (!st.approved[store]) throw new UserError(msg(L, 'needApproval'), 'needApproval');
    st.review[store] = { status: 'in_review', round: (R.round || 0) + 1, fixed: event === 'resubmitted' ? R.rid : undefined };
    out = { ...out, status: 'in_review', round: st.review[store].round, message: msg(L, 'inReview', { store: S }) };
  } else if (event === 'rejected') {
    if (!rejection_text) {
      const sample = st.sample ? (Gen.REJECTIONS.find(r => r.store === store && r.demo) || Gen.REJECTIONS.find(r => r.store === store) || {}).sample : undefined;
      st.review[store] = { ...R, status: 'rejected' };
      out = { ...out, status: 'rejected', message: msg(L, 'pasteRejection'), sample_message_for_demo: sample };
    } else {
      const rj = Lessons.matchKnown(rejection_text, store);
      const infoNeeded = store === 'apple' && /information needed/i.test(rejection_text) ? msg(L, 'infoNeeded') : undefined;
      /* Learn automatically: a known reason only counts an occurrence; an unknown one becomes a new generalized lesson on this machine. */
      const learnFn = db => Lessons.learn(db, rejection_text, store, rj ? rj.id : null);
      const lr = st.sample ? learnFn(Lessons.empty()) : withLessons(learnFn);   // the built-in demo never writes to the user's lessons
      const les = lr && lr.lesson;
      if (les && !st.sample) { st.lessonIds = st.lessonIds || {}; const a = st.lessonIds[store] || []; if (!a.includes(les.id)) a.push(les.id); st.lessonIds[store] = a; }
      if (!rj && les) {
        st.review[store] = { ...R, status: 'fixing', text: rejection_text, lesson: les.id };
        out = { ...out, status: 'fixing', matched: 'learned', information_needed: infoNeeded, reason: les.title, why: les.advice, fix_plan: Lessons.planFor(les, L), auto_reply: false,
          reply_to_reviewer: Lessons.replyFor(les, appName(st, 'en')), lesson: { ...Lessons.compact(les), created: lr.created, saved: !st.sample }, message: msg(L, 'learnedRejection'),
          next: t('rv.approveFix.d') + ' → aaplug2_report_review event=resubmitted' };
      } else if (!rj) { st.review[store] = { ...R, status: 'rejected', text: rejection_text }; out = { ...out, status: 'rejected', matched: false, information_needed: infoNeeded, message: msg(L, 'unknownRejection') }; }
      else {
        st.review[store] = { ...R, status: 'fixing', text: rejection_text, rid: rj.id };
        const p = rj.id === 'play-photo' ? Gen.patches(st.A, L)['patch-manifest-photo'] : null;
        out = { ...out, status: 'fixing', matched: true, information_needed: infoNeeded, reason: t('rj.' + rj.id + '.t'), why: t('rj.' + rj.id + '.w'), fix_plan: rj.plan[L] || rj.plan.en, auto_reply: false,
          reply_to_reviewer: rj.reply(appName(st, 'en')), code_fix: p ? { file: p.file, diff: p.diff } : undefined,
          lesson: les ? { ...Lessons.compact(les), note: msg(L, 'builtinRecorded') } : undefined,
          next: t('rv.approveFix.d') + ' → aaplug2_report_review event=resubmitted' };
      }
    }
  } else if (event === 'approved') {
    st.review[store] = { ...R, status: 'live', liveAt: new Date().toISOString() };
    const chosen = Object.entries(Flow.stores(st.A, st.dec)).filter(([, v]) => v).map(([k]) => k);
    const allLive = chosen.every(k => st.review[k] && st.review[k].status === 'live');
    if (allLive) st.done = new Date().toISOString();
    /* A lesson's checks were part of a later approval: count once per project and store. */
    const pend = ((st.lessonIds || {})[store] || []).filter(id => !((st.lessonsPassed || {})[store] || []).includes(id));
    const pr = pend.length ? withLessons(db => Lessons.recordPass(db, pend)) : null;
    if (pr) { st.lessonsPassed = st.lessonsPassed || {}; st.lessonsPassed[store] = [...((st.lessonsPassed[store]) || []), ...pend]; }
    out = { ...out, status: 'live', message: allLive ? msg(L, 'allLive', { url: CFG.feedbackUrl }) : msg(L, 'live', { store: S }), all_launched: allLive,
      remaining_stores: chosen.filter(k => !(st.review[k] && st.review[k].status === 'live')).map(k => STORE_NAME[k]),
      lessons_confirmed: pr && pr.lessons.length ? pr.lessons.map(Lessons.compact) : undefined, lessons_note: pr && pr.lessons.length ? msg(L, 'lessonsPassed') + ' ' + Lessons.tx(L, 'passed') : undefined };
  } else throw new UserError('event must be submitted | rejected | resubmitted | approved', 'badEvent');
  save(st);
  return out;
}

/* ---------- 상태 ---------- */
function stepOf(st, L) {
  const open = Flow.decisions(st.A).filter(d => st.dec[d.key] === undefined).length;
  const stores = Object.entries(Flow.stores(st.A, st.dec)).filter(([, v]) => v).map(([k]) => k);
  if (st.done) return { step: 'done', label: msg(L, 'stepDone'), next: null };
  if (open) return { step: 'decide', label: msg(L, 'stepDecide'), next: 'aaplug2_get_decisions', open_decisions: open };
  if (!st.generated) return { step: 'generate', label: msg(L, 'stepGenerate'), next: 'aaplug2_generate_store_materials' };
  const notApproved = stores.filter(k => !st.approved[k]);
  const notSent = stores.filter(k => !st.review[k] || st.review[k].status === 'none');
  if (notApproved.length || notSent.length) return { step: 'submit', label: msg(L, 'stepSubmit'), next: 'aaplug2_submission_guide', stores_waiting_approval: notApproved.map(k => STORE_NAME[k]) };
  return { step: 'review', label: msg(L, 'stepReview'), next: 'aaplug2_report_review', review: Object.fromEntries(stores.map(k => [STORE_NAME[k], (st.review[k] || {}).status])) };
}
export function status(id, lang) {
  const L = normLang(lang);
  if (id) { const st = load(id, L); return { project_id: st.id, app: appName(st, L), readiness: st.A.readiness, ...stepOf(st, L), materials: st.generated, approvals: st.approved, review: st.review, lessons: listLessons() }; }
  let ids = []; try { ids = fs.readdirSync(PROJ); } catch { }
  const list = ids.map(i => { try { const st = load(i, L); return { project_id: st.id, app: appName(st, L), updated: st.updatedAt, ...stepOf(st, L) }; } catch { return null; } }).filter(Boolean)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  return { projects: list, data_dir: HOME, lessons: listLessons() };
}

/* Remove one learned lesson from this machine (lessons.json and the export). Project state is not touched. */
export function forgetLesson(id, lang) {
  const L = normLang(lang);
  const r = withLessons(db => Lessons.forget(db, String(id || '')));
  if (!r || !r.removed) throw new UserError(msg(L, 'lessonNotFound', { id }), 'lessonNotFound');
  return { removed: id, message: msg(L, 'lessonForgotten', { id }), lessons: listLessons() };
}
