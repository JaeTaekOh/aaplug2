/* AA Plug 2 — 화면·상태·흐름 (프레임워크 없음) */
(function () {
  'use strict';
  const G = window.AAPGen, X = window.AAPGfx, F = window.AAPFlow, CFG = window.AAP_CONFIG;
  const I18N = window.AAPi18n, UI_LANG_KEY = 'aaplug2.uiLang';   // UI language list + saved manual pick
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = G.esc;
  const STEPS = ['home', 'analyze', 'decide', 'assets', 'submit', 'review', 'done'];
  const KEY = 'aaplug2.v1';
  let S = load() || fresh();
  let project = null;          // 원본 파일 (저장하지 않음)
  let GEN = null;              // 생성 자료 캐시 (언어·결정에 따라 다시 만듦)
  let genToken = 0;

  function fresh() { return { lang: detectLang(), step: 'home', A: null, brand: null, dec: {}, done: {}, review: { status: 'none' }, approved: false, sample: false }; }
  /* UI language: English by default (no browser/device detection). Only a pick made in the globe menu is saved (UI_LANG_KEY)
     and wins on later visits. The old 'aaplug2.lang' key and the lang saved inside old sessions are ignored. */
  function detectLang() {
    try { const saved = localStorage.getItem(UI_LANG_KEY); if (I18N.LANGS.includes(saved)) return saved; } catch (e) { }
    return I18N.DEFAULT;
  }
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.A) { s.lang = detectLang(); return s; } } catch (e) { } return null; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { try { const c = JSON.parse(JSON.stringify(S)); if (c.A) c.A.screenshots = []; localStorage.setItem(KEY, JSON.stringify(c)); } catch (e2) { } } }
  const t = (k, v) => window.AAPi18n.t(S.lang, k, v);

  /* ---------------- 공통 조각 ---------------- */
  function toast(msg, kind) {
    const el = document.createElement('div'); el.className = 'toast m-toast ' + (kind || ''); el.setAttribute('role', 'status');
    el.innerHTML = ic(kind === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(el); setTimeout(() => { el.classList.add('m-out'); setTimeout(() => el.remove(), 260); }, 2400);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    toast(t('copied'));
  }
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : (typeof data === 'string' && data.startsWith('data:')) ? dataUrlToBlob(data) : new Blob([data], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function dataUrlToBlob(u) { const [h, b] = u.split(','); const bin = atob(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: h.slice(5).split(';')[0] }); }
  const copyBtn = (text, label) => `<button class="btn ghost sm" data-copy="${esc(text)}" data-press>${ic('copy')}<span>${label || t('copy')}</span></button>`;
  function sevBadge(sev) { return `<span class="sev sev-${sev}">${ic(sev === 'block' ? 'stop' : sev === 'warn' ? 'alert' : 'info')}${t('sev.' + sev)}</span>`; }
  const ix = v => (Number.isInteger(v) ? v : 0);   // 'keep' or unset → first option for previews
  function platChip(p) { return p === 'android' ? `<span class="chip">${ic('android')}Google Play</span>` : p === 'ios' ? `<span class="chip">${ic('apple')}App Store</span>` : `<span class="chip">${ic('store')}${t('bothStores')}</span>`; }
  function adSlot() {
    if (!CFG.showAdSlotPlaceholder) return '';
    return `<aside class="ad-slot" aria-label="${esc(t('ad.label'))}"><span class="ad-tag">${esc(t('ad.label'))}</span><span class="ad-note">${esc(t('ad.note'))}</span></aside>`;
  }
  const appName = () => (S.A ? G.nameOf(S.A, S.lang) : '');
  const stores = () => F.stores(S.A, S.dec);
  /* Review lessons learned on this device (localStorage). Same schema and sanitizing as the MCP server.
     0.1.4: a real (non-demo) learned result also sends { v, event, store, codes, advice_id } to aaplug.com/api/lessons
     (never the store message, app name, ids or any free text), and the aggregated feed of other users' lessons is
     cached in localStorage for 12 hours. Network errors are ignored; nothing here can break the flow. */
  const LS = window.AAPLessons;
  const SHARED_KEY = 'aaplug2.shared.v1', SHARED_TTL = 12 * 3600e3;
  function lessonsDb() { try { return LS.normDb(JSON.parse(localStorage.getItem(LS.KEY))); } catch (e) { return LS.empty(); } }
  function saveLessons(db) { try { localStorage.setItem(LS.KEY, JSON.stringify(LS.normDb(db))); } catch (e) { } }
  function sharedCache() { try { const c = JSON.parse(localStorage.getItem(SHARED_KEY)); return c && Array.isArray(c.items) ? { at: +c.at || 0, items: LS.normShared({ lessons: c.items }) } : null; } catch (e) { return null; } }
  const withTimeout = ms => { try { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; } catch (e) { return undefined; } };
  let sharedBusy = false;
  async function refreshShared() {
    const c = sharedCache(); if ((c && Date.now() - c.at < SHARED_TTL) || sharedBusy) return false;
    sharedBusy = true;
    try {
      const r = await fetch(LS.SHARE_URL, { headers: { Accept: 'application/json' }, signal: withTimeout(5000), credentials: 'omit' });
      if (!r.ok) throw new Error('feed');
      const items = LS.normShared(await r.json());
      localStorage.setItem(SHARED_KEY, JSON.stringify({ at: Date.now(), items }));
      return true;
    } catch (e) { try { localStorage.setItem(SHARED_KEY, JSON.stringify({ at: Date.now() - SHARED_TTL + 15 * 60e3, items: c ? c.items : [] })); } catch (er) { } return false; }
    finally { sharedBusy = false; }
  }
  function shareLesson(lesson, event) {
    if (S.sample) return null;   // the demo never sends
    const p = LS.sharePayload(lesson, event); if (!p) return null;
    try { fetch(LS.SHARE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p), signal: withTimeout(5000), credentials: 'omit', keepalive: true }).catch(() => { }); } catch (e) { }
    return p;
  }
  const relLessons = only => {
    if (!S.A) return [];
    const db = lessonsDb(), st = only || stores(), c = sharedCache();
    return LS.mergeRelevant(LS.relevant(db, S.A, st, S.lang), c ? LS.relevantShared(c.items, S.A, st, S.lang, db) : [], S.lang);
  };
  function lessonsCard(rel) {
    if (!rel.length) return '';
    return `<section class="card">
      <h2 class="h-ic">${ic('sparkle')}${esc(LS.tx(S.lang, 'step'))}</h2>
      <p class="muted">${esc(LS.tx(S.lang, 'stepD'))}</p>
      <ul class="issues">${rel.map(r => `<li class="issue"><div class="issue-top">${sevBadge(r.level === 'warning' ? 'warn' : 'tip')}${platChip(r.store === 'apple' ? 'ios' : 'android')}</div>
        ${r.from ? `<span class="chip small">${esc(r.from)}</span>` : ''}<b>${esc((r.codes.length ? r.codes.join(', ') + ' · ' : '') + (r.title || (r.builtin ? t('rj.' + r.builtin + '.t') : '')))}</b><p>${esc(r.why)}</p>${r.check ? `<p class="ai-fix">${ic('check')}${esc(r.check)}</p>` : ''}${r.passed_note ? `<p class="small muted">${esc(r.passed_note)}</p>` : ''}</li>`).join('')}</ul>
      <p class="small muted">${esc(LS.tx(S.lang, 'shareNote'))} <a href="privacy.html#lessons">${esc(LS.tx(S.lang, 'shareMore'))}</a></p>
    </section>`;
  }

  /* ---------------- 상단 ---------------- */
  function header() {
    const idx = STEPS.indexOf(S.step);
    const steps = STEPS.slice(1).map((s, i) => {
      const n = i + 1, st = idx > n ? 'done' : idx === n ? 'cur' : 'todo';
      const can = S.A && (idx >= n || st === 'done');
      return `<li class="st st-${st}"><button ${can ? '' : 'disabled'} data-go="${s}" aria-current="${st === 'cur' ? 'step' : 'false'}"><span class="st-n">${st === 'done' ? ic('check') : n}</span><span class="st-l">${t('step.' + s)}</span></button></li>`;
    }).join('');
    $('#top').innerHTML = `
      <div class="top-in">
        <button class="brand" data-go="home" aria-label="AA Plug 2 ${esc(t('home'))}">
          <span class="logo" aria-hidden="true"><svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="var(--brand)"/><path d="M9 22.5 15 8.5h2l6 14" fill="none" stroke="var(--on-brand)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17h8" stroke="var(--on-brand)" stroke-width="2.6" stroke-linecap="round"/><circle cx="24.5" cy="8" r="2.4" fill="var(--on-brand)"/></svg></span>
          <span class="brand-t">AA Plug <b>2</b></span>
        </button>
        ${S.step !== 'home' && S.A ? `<ol class="stepper" aria-label="${esc(t('progress'))}">${steps}</ol><span class="step-mini">${idx}/${STEPS.length - 1} · ${t('step.' + S.step)}</span>` : '<span class="flex1"></span>'}
        <div class="lang">
          <button class="btn icon lang-btn" id="langBtn" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t('language'))}" data-press>${ic('globe')}<span>${S.lang.toUpperCase()}</span></button>
          <div class="lang-menu" id="langMenu" role="menu" hidden>
            ${I18N.LANGS.map(c => `<button role="menuitemradio" aria-checked="${S.lang === c}" data-lang="${c}" lang="${c}">${I18N.NATIVE[c]}${S.lang === c ? ic('check') : ''}</button>`).join('')}
          </div>
        </div>
      </div>`;
  }
  function footer() {
    $('#foot').innerHTML = `
      <div class="foot-in">
        <div class="foot-brand"><b>AA Plug 2</b><span>${esc(t('foot.tag'))}</span></div>
        <div class="foot-links">
          <a class="btn ghost sm" href="${CFG.feedbackUrl}" target="_blank" rel="noopener">${ic('mail')}<span>${t('feedback')}</span></a>
          <a class="btn ghost sm" href="privacy.html" target="_blank" rel="noopener">${ic('shield')}<span>${t('foot.privacy')}</span></a>
        </div>
        <p class="foot-small">${esc(t('foot.free'))}<br>${esc(t('foot.tm'))}</p>
      </div>`;
  }

  /* ---------------- 화면 그리기 ---------------- */
  function go(step, opts) {
    const back = STEPS.indexOf(step) < STEPS.indexOf(S.step);
    S.step = step; save(); render(back ? 'back' : 'fwd'); if (!(opts && opts.noScroll)) window.scrollTo({ top: 0, behavior: Motion.reduced() ? 'auto' : 'smooth' });
  }
  function render(dir) {
    document.documentElement.lang = S.lang;
    document.title = 'AA Plug 2 — ' + t('title.' + S.step);
    header(); footer();
    const main = $('#main');
    const fn = { home: vHome, analyze: vAnalyze, decide: vDecide, assets: vAssets, submit: vSubmit, review: vReview, done: vDone }[S.step] || vHome;
    if (S.step !== 'home' && S.step !== 'analyze' && !S.A) { S.step = 'home'; return render(); }
    main.innerHTML = `<div class="screen ${dir === 'back' ? 'm-screen-back' : dir === 'none' ? '' : 'm-screen-fwd'}">${fn()}</div>`;
    after[S.step] && after[S.step]();
    Motion.scan && Motion.scan(main);
  }
  const after = {};

  /* ===== 1. 홈 ===== */
  function vHome() {
    const resume = S.A && S.step === 'home' && load();
    return `
    <section class="home">
      <div class="home-hero m-rise">
        <p class="kicker">${ic('sparkle')}${esc(t('home.kicker'))}</p>
        <h1>${t('home.h1')}</h1>
        <p class="lead">${esc(t('home.lead'))}</p>
        <ol class="flow">
          ${['connect', 'analyze', 'decide', 'launch'].map((k, i) => `<li style="--i:${i}" class="m-stagger"><span class="flow-n">${i + 1}</span><b>${esc(t('flow.' + k))}</b><small>${esc(t('flow.' + k + '.d'))}</small></li>`).join('')}
        </ol>
      </div>
      <div class="connect card m-rise" style="animation-delay:80ms">
        ${resume ? `<button class="resume" data-go="${S.lastStep || 'decide'}" data-press>${S.A.icon ? `<img src="${S.A.icon.dataUrl}" alt="">` : ic('phone')}<span><small>${esc(t('home.resume'))}</small><b>${esc(G.nameOf(S.A, S.lang))}</b></span>${ic('right')}</button>` : ''}
        <h2>${esc(t('home.connect'))}</h2>
        <p class="muted">${esc(t('home.connect.d'))}</p>
        <button class="btn primary xl" id="startSample" data-press data-ripple>${ic('play')}<span>${esc(t('home.sample'))}</span></button>
        <p class="sample-note">${esc(t('home.sample.d'))}</p>
        <div class="or"><span>${esc(t('or'))}</span></div>
        <form class="gh" id="ghForm" autocomplete="off">
          <label for="ghUrl">${ic('github')}${esc(t('home.gh'))}</label>
          <div class="gh-row"><input id="ghUrl" type="url" inputmode="url" placeholder="https://github.com/owner/repo" spellcheck="false"><button class="btn dark" type="submit" data-press>${ic('right')}<span>${esc(t('connect'))}</span></button></div>
          <small class="muted">${esc(t('home.gh.d'))}</small>
        </form>
        <div class="drop" id="drop" tabindex="0">
          ${ic('upload')}
          <div><b>${esc(t('home.drop'))}</b><small>${esc(t('home.drop.d'))}</small></div>
          <div class="drop-btns">
            <label class="btn ghost sm" data-press>${ic('file')}<span>ZIP</span><input type="file" id="zipIn" accept=".zip,application/zip" hidden></label>
            <label class="btn ghost sm" data-press>${ic('folder')}<span>${esc(t('folder'))}</span><input type="file" id="dirIn" webkitdirectory directory multiple hidden></label>
          </div>
        </div>
        <p class="privacy-note">${ic('lock')}<span>${esc(t('home.privacy'))}</span></p>
      </div>
    </section>
    <section class="home-points">
      ${['p1', 'p2', 'p3'].map((k, i) => `<div class="point card m-stagger" style="--i:${i}">${ic(['wand', 'shield', 'rocket'][i])}<b>${esc(t('home.' + k))}</b><p>${esc(t('home.' + k + '.d'))}</p></div>`).join('')}
    </section>
    ${adSlot()}`;
  }
  after.home = () => {
    $('#startSample').onclick = () => start(() => window.AAPSources.sample(), true);
    $('#ghForm').onsubmit = e => { e.preventDefault(); const u = $('#ghUrl').value.trim(); if (!window.AAPSources.parseRepo(u)) { toast(t('err.badurl'), 'err'); $('#ghUrl').focus(); return; } start(step => window.AAPSources.fromGitHub(u, step)); };
    $('#zipIn').onchange = e => { const f = e.target.files[0]; if (f) start(step => window.AAPSources.fromZipFile(f, step)); };
    $('#dirIn').onchange = e => { if (e.target.files.length) start(step => window.AAPSources.fromFileList(e.target.files, step)); };
    const d = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => d.addEventListener(ev, () => d.classList.remove('over')));
    d.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /\.zip$/i.test(f.name)) start(step => window.AAPSources.fromZipFile(f, step)); else toast(t('err.dropzip'), 'err'); });
  };

  /* ===== 2. 분석 ===== */
  let logLines = [], running = false;
  async function start(loader, isSample) {
    S = fresh(); S.lang = detectLang(); S.sample = !!isSample; GEN = null; logLines = []; running = true; S.step = 'analyze'; render('fwd');
    const log = msg => { logLines.push(msg); const el = $('#log'); if (el) { const li = document.createElement('li'); li.className = 'm-fade'; li.innerHTML = ic('check') + '<code>' + esc(msg) + '</code>'; el.appendChild(li); el.scrollTop = el.scrollHeight; } };
    const pause = ms => new Promise(r => setTimeout(r, Motion.reduced() ? 0 : ms));
    try {
      log(t('log.open'));
      project = await loader(p => log(t('log.read', { f: p })));
      await pause(250);
      log(t('log.analyze'));
      const A = window.AAPAnalyzer.analyze(project);
      if (!A.platforms.android && !A.platforms.ios) throw Object.assign(new Error('noapp'), { code: 'noapp' });
      for (const f of A.read.slice(0, 14)) { log(t('log.parsed', { f })); await pause(70); }
      log(t('log.policy')); await pause(320);
      log(t('log.draft')); await pause(320);
      A.brandColor = A.brandColor || await X.avgColor(A.icon && A.icon.dataUrl);
      S.A = A; S.brand = A.brandColor; running = false; save();
      render('none');
    } catch (e) {
      running = false; console.error(e);
      const code = e.code || 'generic';
      S.error = code; render('none');
    }
  }
  function vAnalyze() {
    if (running || (!S.A && !S.error)) return `
      <section class="analyzing">
        <div class="scan-orb m-breathe" aria-hidden="true">${ic('sparkle')}</div>
        <h1>${esc(t('an.running'))}</h1>
        <p class="muted">${esc(t('an.running.d'))}</p>
        <ul class="log" id="log" aria-live="polite">${logLines.map(l => `<li>${ic('check')}<code>${esc(l)}</code></li>`).join('')}</ul>
      </section>`;
    if (S.error) return `
      <section class="analyzing">
        <div class="scan-orb err" aria-hidden="true">${ic('alert')}</div>
        <h1>${esc(t('err.title'))}</h1>
        <p class="muted">${esc(t('err.' + S.error))}</p>
        <div class="row center"><button class="btn primary" data-go="home" data-press>${ic('left')}<span>${esc(t('back'))}</span></button><button class="btn ghost" id="trySample" data-press>${ic('play')}<span>${esc(t('home.sample'))}</span></button></div>
      </section>`;
    const A = S.A, ISS = F.issuesFor(A, S.dec), c = { block: 0, warn: 0, tip: 0 }; ISS.forEach(i => c[i.sev]++);
    const sdk = Object.entries(A.sdk).filter(([, v]) => v).map(([k]) => k);
    const ringC = 2 * Math.PI * 52;
    return `
    <section class="an-head">
      <div class="app-id card m-rise">
        ${A.icon ? `<img class="app-ic" src="${A.icon.dataUrl}" alt="">` : `<span class="app-ic mono">${esc(A.appName.charAt(0))}</span>`}
        <div class="app-meta">
          <h1>${esc(G.nameOf(A, S.lang))}</h1>
          <p class="mono-t">${esc(A.pkg || '—')} · v${esc(A.version)}</p>
          <div class="chips">${A.platforms.android ? platChip('android') : ''}${A.platforms.ios ? platChip('ios') : ''}<span class="chip soft">${ic('code')}${esc(t('fw.' + A.framework))}</span>${S.sample ? `<span class="chip lime">${ic('play')}${esc(t('sampleBadge'))}</span>` : ''}</div>
        </div>
      </div>
      <div class="ready card m-rise" style="animation-delay:60ms">
        <svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" stroke-dasharray="${ringC}" stroke-dashoffset="${ringC * (1 - A.readiness / 100)}"/></svg>
        <div class="ready-n"><b>${A.readiness}%</b><small>${esc(t('an.ready'))}</small></div>
        <p>${esc(t('an.ready.d'))}</p>
      </div>
    </section>
    <section class="counts">
      <div class="count c-block m-stagger" style="--i:0">${ic('stop')}<b>${c.block}</b><span>${esc(t('an.block'))}</span></div>
      <div class="count c-warn m-stagger" style="--i:1">${ic('alert')}<b>${c.warn}</b><span>${esc(t('an.warn'))}</span></div>
      <div class="count c-tip m-stagger" style="--i:2">${ic('info')}<b>${c.tip}</b><span>${esc(t('an.tip'))}</span></div>
    </section>
    <section class="card">
      <h2 class="h-ic">${ic('list')}${esc(t('an.found'))}</h2>
      <p class="muted">${esc(t('an.found.d'))}</p>
      <ul class="issues">${ISS.map((i, k) => `
        <li class="issue m-stagger" style="--i:${Math.min(k, 10)}">
          <div class="issue-top">${sevBadge(i.sev)}${platChip(i.plat)}</div>
          <b>${esc(t('iss.' + i.id + '.t', i.vars))}</b>
          <p>${esc(t('iss.' + i.id + '.w', i.vars))}</p>
          ${i.fix && i.fix !== 'info' ? `<p class="ai-fix">${ic('wand')}${esc(t('iss.' + i.id + '.f', i.vars))}</p>` : ''}
        </li>`).join('')}</ul>
    </section>
    ${lessonsCard(relLessons())}
    <section class="grid2">
      <div class="card">
        <h2 class="h-ic">${ic('target')}${esc(t('an.sdk'))}</h2>
        <div class="chips">${sdk.map(k => `<span class="chip soft">${esc(t('sdk.' + k))}</span>`).join('') || `<span class="muted">—</span>`}</div>
        <h3>${esc(t('an.langs'))}</h3>
        <div class="chips">${A.locales.map(l => `<span class="chip">${esc(l.toUpperCase())}</span>`).join('')}</div>
      </div>
      <div class="card">
        <h2 class="h-ic">${ic('file')}${esc(t('an.files', { n: A.read.length }))}</h2>
        <ul class="files">${A.read.map(f => `<li><code>${esc(f)}</code></li>`).join('')}</ul>
      </div>
    </section>
    <div class="cta-bar"><span class="muted">${esc(t('an.next.d'))}</span><button class="btn primary lg" data-go="decide" data-press data-ripple>${esc(t('an.next'))}${ic('right')}</button></div>
    ${adSlot()}`;
  }
  after.analyze = () => { const b = $('#trySample'); if (b) b.onclick = () => start(() => window.AAPSources.sample(), true); };

  /* ===== 생성 자료 ===== */
  async function ensureGen() {
    const A = S.A; const my = ++genToken;
    const langs = F.LANGS;   /* all five, so the copy shown in the current UI language is always ready */
    const tone = S.dec.tone && S.dec.tone !== 'keep' ? S.dec.tone : 'friendly';
    const listing = {}; langs.forEach(l => listing[l] = G.listing(A, l, tone));
    const brand = S.brand || '#2f6f5e';
    const icons = await X.icons(A, brand);
    const iconUrl = icons[ix(S.dec.icon)].dataUrl;
    const L = S.lang;
    const titleIdx = ix(S.dec.title), shortIdx = ix(S.dec.short);
    const nm = l => listing[l].titles[Math.min(titleIdx, listing[l].titles.length - 1)].split(/ [-–:] /)[0];
    const tg = l => listing[l].shorts[Math.min(shortIdx, listing[l].shorts.length - 1)].replace(/[.。।]$/, '');
    const features = await Promise.all(['split', 'shot', 'minimal'].map(st => X.feature(A, L, st, brand, iconUrl, nm(L), tg(L))));
    if (my !== genToken) return GEN;
    GEN = { listing, icons, features, iconUrl, nm, tg, brand };
    return GEN;
  }
  async function ensureShots() {
    if (GEN.shots && GEN.shotsLang === S.lang && GEN.shotsKey === S.dec.icon) return;
    const caps = G.features(S.A, S.lang);
    GEN.shots = await X.shots(S.A, S.lang, GEN.brand, caps, 'play');
    GEN.shotsLang = S.lang; GEN.shotsKey = S.dec.icon;
  }

  /* ===== 3. 결정 ===== */
  const decisions = () => F.decisions(S.A, S.dec);
  const decided = d => S.dec[d.key] !== undefined;
  const recValue = F.recValue;
  function vDecide() {
    const list = decisions(); const left = list.filter(d => !decided(d)).length;
    const groups = [['stage', 'flag'], ['fix', 'wand'], ['store', 'store'], ['policy', 'shield']];
    return `
    <section class="dec-head">
      <div>
        <p class="kicker">${ic('sparkle')}${esc(t('dec.kicker'))}</p>
        <h1>${esc(t('dec.h1'))}</h1>
        <p class="muted">${esc(t('dec.d'))}</p>
      </div>
      <div class="dec-progress card">
        <div class="bar"><i style="transform:scaleX(${(list.length - left) / list.length})"></i></div>
        <p><b>${list.length - left}</b> / ${list.length} ${esc(t('dec.done'))}</p>
        <button class="btn dark" id="acceptAll" data-press data-ripple ${left ? '' : 'disabled'}>${ic('wand')}<span>${esc(t('dec.all'))}</span></button>
      </div>
    </section>
    <div id="genWait" class="gen-wait" ${GEN ? 'hidden' : ''}><span class="dots"><i></i><i></i><i></i></span>${esc(t('dec.generating'))}</div>
    ${groups.map(([g, icn]) => { const items = list.filter(d => d.group === g); if (!items.length) return ''; return `
      <section class="dec-group">
        <h2 class="h-ic">${ic(icn)}${esc(t('dec.g.' + g))}<span class="cnt">${items.filter(decided).length}/${items.length}</span></h2>
        <div class="cards">${items.map((d, i) => decCard(d, i)).join('')}</div>
      </section>`; }).join('')}
    <div class="cta-bar sticky">
      <span>${left ? esc(t('dec.left', { n: left })) : esc(t('dec.allDone'))}</span>
      <button class="btn primary lg" id="toAssets" data-press data-ripple ${left ? 'disabled' : ''}>${esc(t('dec.next'))}${ic('right')}</button>
    </div>
    ${adSlot()}`;
  }
  function optTile(d, val, label, sub, extra) {
    const cur = S.dec[d.key]; const on = cur !== undefined && JSON.stringify(cur) === JSON.stringify(val);
    const rec = JSON.stringify(recValue(d)) === JSON.stringify(val);
    return `<button class="opt ${on ? 'on' : ''}" data-dec="${d.key}" data-val='${esc(JSON.stringify(val))}' aria-pressed="${on}" data-press>
      ${extra || ''}<span class="opt-t">${label}</span>${sub ? `<span class="opt-s">${sub}</span>` : ''}${rec ? `<span class="rec">${ic('sparkle')}${esc(t('rec'))}</span>` : ''}${on ? `<span class="tick">${ic('check')}</span>` : ''}</button>`;
  }
  function decCard(d, i) {
    const A = S.A, L = S.lang, gl = GEN && GEN.listing[L]; const done = decided(d);
    let title = '', why = '', body = '';
    if (d.group === 'fix') {
      const is = d.issue; title = t('iss.' + is.id + '.t', is.vars); why = t('iss.' + is.id + '.w', is.vars);
      const p = G.patches(A, L)[is.fix];
      const preview = p ? `<details class="diff"><summary>${ic('code')}${esc(t('dec.seeChange'))} <code>${esc(p.file)}</code></summary><pre>${diffHtml(p.diff)}</pre></details>`
        : is.fix === 'gen-privacy' ? `<p class="gen-note">${ic('file')}${esc(t('dec.genPrivacy'))}</p>` : is.fix === 'gen-deletion' ? `<p class="gen-note">${ic('file')}${esc(t('dec.genDeletion'))}</p>` : is.fix === 'gen-xcprivacy' ? `<p class="gen-note">${ic('file')}PrivacyInfo.xcprivacy</p>` : is.fix === 'declare' ? `<p class="gen-note">${ic('file')}${esc(t('dec.genDeclare'))}</p>` : '';
      const sub = o => o === 'apply' ? t('iss.' + is.id + '.f', is.vars) : o === 'later' ? t('opt.later.d') : t('opt.' + o + '.d');
      body = preview + `<div class="opts two">${d.opts.map(o => optTile(d, o, esc(t('opt.' + o)), esc(sub(o)))).join('')}</div>`;
      return wrapCard(d, i, sevBadge(is.sev) + platChip(is.plat), title, why, body, done);
    }
    if (d.group === 'stage') {
      const bin = d.key.startsWith('binary:'), b = bin ? 'binary.' : 'stage.', h = d.hints || { evidence: [] };
      const EVN = { 'play-url': 'Google Play link', 'apple-url': 'App Store link', 'fastlane-play': 'fastlane Play metadata', 'fastlane-apple': 'fastlane App Store metadata', 'fastlane-deliver': 'fastlane deliver', 'play-changelogs': 'Play release notes' };
      title = bin ? `${d.store === 'play' ? 'Google Play' : 'App Store'}: ${t('dec.binary')}` : t('dec.stage.' + d.store);
      why = bin ? t('dec.binary.d') : t('dec.stage.d') + (h.evidence.length ? ' ' + t('stage.hint', { ev: h.evidence.map(e => EVN[e] || e).join(', '), rec: t('stage.' + d.opts[d.rec]) }) : '') + (h.weak ? ' ' + t('stage.hintWeak', { weak: h.weak }) : '');
      body = `<div class="opts two">${d.opts.map(o => optTile(d, o, esc(t(b + o)), esc(t(b + o + '.d')), bin ? '' : ic(o === 'live' ? 'party' : o === 'rejected' ? 'message' : o === 'in_review' ? 'clock' : 'send', 'opt-ic'))).join('')}</div>`;
      return wrapCard(d, i, platChip(d.store === 'play' ? 'android' : 'ios'), title, why, body, done);
    }
    switch (d.key) {
      case 'stores': title = t('dec.stores'); why = t('dec.stores.d');
        body = `<div class="opts three">${d.opts.map(o => optTile(d, o, esc(t('store.' + o)), '', ic(o === 'apple' ? 'apple' : o === 'play' ? 'android' : 'store', 'opt-ic'))).join('')}</div>`; break;
      case 'title': title = t('dec.title'); why = t('dec.title.d');
        body = gl ? `<div class="opts">${gl.titles.map((v, k) => optTile(d, k, esc(v), `${v.length}/30`)).join('')}</div>` : skel(); break;
      case 'short': title = t('dec.short'); why = t('dec.short.d');
        body = gl ? `<div class="opts">${gl.shorts.map((v, k) => optTile(d, k, esc(v), `${v.length}/80`)).join('')}</div>` : skel(); break;
      case 'tone': title = t('dec.tone'); why = t('dec.tone.d');
        body = `<div class="opts two">${['friendly', 'pro'].map(o => optTile(d, o, esc(t('tone.' + o)), esc(G.listing(A, L, o).full.split('\n')[0].slice(0, 90) + '…'))).join('')}</div>`; break;
      case 'category': title = t('dec.category'); why = t('dec.category.d');
        body = `<div class="opts three">${A.categories.map((c, k) => optTile(d, k, esc(G.CAT[c][L][1]), `Play: ${G.CAT[c].play} · Apple: ${G.CAT[c].apple}`)).join('')}</div>`; break;
      case 'langs': { title = t('dec.langs'); why = t('dec.langs.d');
        const cur = S.dec.langs || [];
        body = `<div class="opts three">${F.LANGS.map(c => [c, t('lang.' + c)]).map(([c, n]) => `<button class="opt ${cur.includes(c) ? 'on' : ''}" data-lang-toggle="${c}" aria-pressed="${cur.includes(c)}" data-press><span class="opt-t">${esc(n)}</span><span class="opt-s">${A.locales.includes(c) || (c === 'en') ? esc(t('dec.langs.inApp')) : esc(t('dec.langs.store'))}</span>${cur.includes(c) ? `<span class="tick">${ic('check')}</span>` : ''}</button>`).join('')}</div>
          <div class="row"><button class="btn ghost sm" data-dec="langs" data-val='${JSON.stringify(F.DEFAULT_LANGS)}' data-press>${ic('sparkle')}<span>${esc(t('dec.langs.rec'))}</span></button></div>`; break; }
      case 'icon': title = t('dec.icon'); why = t('dec.icon.d');
        body = GEN ? `<div class="opts three img">${GEN.icons.map((v, k) => optTile(d, k, esc(t('icon.' + v.style)), '512×512', `<img src="${v.dataUrl}" alt="" class="opt-icon">`)).join('')}</div>` : skel(); break;
      case 'feature': title = t('dec.feature'); why = t('dec.feature.d');
        body = GEN ? `<div class="opts three img wide">${GEN.features.map((v, k) => optTile(d, k, esc(t('feat.' + ['split', 'shot', 'minimal'][k])), '1024×500', `<img src="${v}" alt="" class="opt-feature">`)).join('')}</div>` : skel(); break;
      case 'shots': title = t('dec.shots'); why = A.screenshots.length ? t('dec.shots.d', { n: A.screenshots.length }) : t('dec.shots.none');
        body = `<div class="shots-row" id="shotsRow">${GEN && GEN.shots ? GEN.shots.map(s => `<img src="${s}" alt="">`).join('') : skel()}</div><div class="opts two">${optTile(d, 'ok', esc(t('opt.useThese')), '')}</div>`; break;
      case 'privacy': title = t('dec.privacy'); why = t('dec.privacy.d');
        body = `<div class="doc-prev">${policyBody(G.privacyPolicy(A, L, { photoRemoved: S.dec['fix:photoPerm'] === 'apply' }))}</div><div class="opts two">${optTile(d, 'ok', esc(t('opt.approve')), esc(t('dec.privacy.host')))}</div>`; break;
      case 'safety': { title = t('dec.safety'); why = t('dec.safety.d'); const ds = G.dataSafety(A, L, F.privacyOpts(A, S.dec));
        body = safetyTable(ds) + `<div class="opts two">${optTile(d, 'ok', esc(t('opt.approve')), '')}</div>`; break; }
      case 'rating': { title = t('dec.rating'); why = t('dec.rating.d'); const r = G.rating(A, L);
        body = `<div class="rating-res"><span class="badge-big">3+</span><div><b>${esc(r.result.play)}</b><small>App Store: ${r.result.apple}</small></div></div><details class="qa"><summary>${ic('list')}${esc(t('dec.rating.qa'))}</summary><dl>${r.qa.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl></details><div class="opts two">${optTile(d, 'ok', esc(t('opt.approve')), '')}</div>`; break; }
      case 'access': case 'location': title = t('dec.' + d.key); why = t('dec.' + d.key + '.d');
        body = `<div class="opts two">${d.opts.map(o => optTile(d, o, esc(t(d.key + '.' + o)), esc(t(d.key + '.' + o + '.d')))).join('')}</div>`; break;
      case 'track': title = t('dec.track'); why = t('dec.track.d');
        body = `<div class="opts two">${d.opts.map(o => optTile(d, o, esc(t('track.' + o)), esc(t('track.' + o + '.d')))).join('')}</div>`; break;
    }
    /* 0.1.5: an app already in a store keeps its live listing by default. */
    if (d.keep) body = `<div class="opts two">${optTile(d, 'keep', esc(t('opt.keep')), esc(d.key === 'privacy' && A.developer && A.developer.privacyUrl ? A.developer.privacyUrl : t('opt.keep.d')))}</div>` + body;
    return wrapCard(d, i, '', title, why, body, done);
  }
  function wrapCard(d, i, badges, title, why, body, done) {
    const cur = S.dec[d.key];
    let summary = '';
    if (done) {
      const L = S.lang, gl = GEN && GEN.listing[L];
      summary = cur === 'keep' ? t('opt.keep') : d.key.startsWith('stage:') ? t('stage.' + cur) : d.key.startsWith('binary:') ? t('binary.' + cur) : d.key === 'title' && gl ? gl.titles[cur] : d.key === 'short' && gl ? gl.shorts[cur] : d.key === 'langs' ? cur.map(x => x.toUpperCase()).join(' · ') : d.key === 'category' ? G.CAT[S.A.categories[cur]][L][1]
        : d.key === 'icon' ? t('icon.' + ['original', 'brand', 'light'][cur]) : d.key === 'feature' ? t('feat.' + ['split', 'shot', 'minimal'][cur]) : d.key === 'stores' ? t('store.' + cur) : d.key === 'tone' ? t('tone.' + cur) : d.key === 'track' ? t('track.' + cur) : d.key === 'access' || d.key === 'location' ? t(d.key + '.' + cur)
        : cur === 'ok' ? t('approved') : t('opt.' + cur);
    }
    return `<article class="dcard card ${done ? 'is-done' : ''} m-stagger" style="--i:${Math.min(i, 10)}" id="dc-${d.key.replace(/[:]/g, '-')}">
      <header><div class="dc-badges">${badges}</div>${done ? `<button class="btn ghost sm" data-undo="${d.key}" data-press>${ic('pencil')}<span>${esc(t('change'))}</span></button>` : ''}</header>
      <h3>${done ? ic('check', 'ok') : ''}${esc(title)}</h3>
      ${done ? `<p class="dc-sum">${esc(summary)}</p>` : `<p class="muted">${esc(why)}</p>${body}`}
      ${done && d.key.startsWith('stage:') && (cur === 'rejected' || cur === 'in_review') ? `<div class="row"><button class="btn primary sm" data-stage-go="${cur}" data-press>${ic(cur === 'rejected' ? 'message' : 'clock')}<span>${esc(t(cur === 'rejected' ? 'stage.goPaste' : 'stage.goWait'))}</span></button></div>` : ''}
    </article>`;
  }
  /* 생성한 방침 HTML(우리가 만든 것)에서 본문만 꺼내 미리보기 */
  function policyBody(html) { const m = html.match(/<body>([\s\S]*)<\/body>/); return `<article class="policy">${m ? m[1] : ''}</article>`; }
  const skel = () => `<div class="m-skeleton skel"></div>`;
  function diffHtml(d) { return esc(d).split('\n').map(l => l.startsWith('+') ? `<ins>${l}</ins>` : l.startsWith('-') ? `<del>${l}</del>` : l.startsWith('@') ? `<span class="hunk">${l}</span>` : l).join('\n'); }
  function safetyTable(ds) {
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${esc(t('ds.type'))}</th><th>${esc(t('ds.purpose'))}</th><th>${esc(t('ds.shared'))}</th><th>${esc(t('ds.optional'))}</th></tr></thead><tbody>
      ${ds.rows.map(r => `<tr><td><b>${esc(r.label)}</b><small>${esc(r.playType)}</small></td><td>${esc(r.purposes)}</td><td>${r.shared ? esc(t('yes')) : esc(t('no'))}</td><td>${r.optional ? esc(t('yes')) : esc(t('no'))}</td></tr>`).join('')}
      </tbody></table></div><p class="small muted">${ic('lock')} ${esc(t('ds.enc'))} · ${ds.deletable ? esc(t('ds.del')) : ''}${ds.onDevice ? '<br>' + ic('info') + ' ' + esc(ds.onDevice) : ''}</p>`;
  }
  after.decide = async () => {
    bindDecide();
    if (!GEN) { await ensureGen(); await ensureShots(); if (S.step === 'decide') { render('none'); } }
    else if (!GEN.shots || GEN.shotsLang !== S.lang) { await ensureShots(); const r = $('#shotsRow'); if (r) r.innerHTML = GEN.shots.map(s => `<img src="${s}" alt="">`).join(''); }
  };
  function bindDecide() {
    $$('[data-dec]').forEach(b => b.onclick = async () => {
      const key = b.dataset.dec, val = JSON.parse(b.dataset.val);
      S.dec[key] = val;
      if (/^(stage|binary):/.test(key)) {   // a stage change: drop keep / binary values that no longer apply
        const L2 = F.decisions(S.A, S.dec);
        Object.keys(S.dec).forEach(k => { const d2 = L2.find(x => x.key === k); if ((S.dec[k] === 'keep' && !(d2 && d2.keep)) || (k.startsWith('binary:') && !d2)) delete S.dec[k]; });
      }
      save();
      if (['tone', 'icon', 'title', 'short'].includes(key)) { await ensureGen(); if (key === 'icon') { GEN.shots = null; await ensureShots(); } }
      const y = window.scrollY; render('none'); window.scrollTo(0, y);
      const next = decisions().find(d => !decided(d)); const el = next && $('#dc-' + next.key.replace(/[:]/g, '-'));
      if (el && !Motion.reduced()) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $$('[data-lang-toggle]').forEach(b => b.onclick = () => { const c = b.dataset.langToggle; const cur = new Set(S.dec._langsDraft || []); cur.has(c) ? cur.delete(c) : cur.add(c); S.dec._langsDraft = [...cur]; if (cur.size) S.dec.langs = [...cur]; else delete S.dec.langs; save(); const y = window.scrollY; render('none'); window.scrollTo(0, y); });
    $$('[data-undo]').forEach(b => b.onclick = () => { delete S.dec[b.dataset.undo]; if (b.dataset.undo === 'langs') S.dec._langsDraft = []; save(); const y = window.scrollY; render('none'); window.scrollTo(0, y); });
    $$('[data-stage-go]').forEach(b => b.onclick = () => { S.review = { status: b.dataset.stageGo === 'rejected' ? 'rejected' : 'inReview', round: 1, at: Date.now(), external: true }; save(); go('review'); });
    /* Accept-all never picks a store stage when the project hints the app may already be in a store; nothing else is filled until stages are set. */
    const all = $('#acceptAll'); if (all) all.onclick = async () => {
      decisions().forEach(d => { if (d.group === 'stage' && !d.ask && !decided(d)) S.dec[d.key] = recValue(d); });
      const ask = decisions().filter(d => d.group === 'stage' && !decided(d));
      if (!ask.length) decisions().forEach(d => { if (!decided(d)) S.dec[d.key] = recValue(d); });
      save(); await ensureGen(); render('none'); toast(ask.length ? t('stage.askFirst') : t('dec.allApplied'));
    };
    const n = $('#toAssets'); if (n) n.onclick = () => go('assets');
  }

  /* ===== 4. 자료 ===== */
  const chosen = () => F.chosen(S.A, S.dec);
  let assetTab = null;
  function vAssets() {
    if (!GEN) return `<div class="gen-wait"><span class="dots"><i></i><i></i><i></i></span>${esc(t('dec.generating'))}</div>`;
    const A = S.A, C = chosen(); const st = stores(); const L = assetTab && C.langs.includes(assetTab) ? assetTab : (C.langs.includes(S.lang) ? S.lang : C.langs[0]); assetTab = L;
    const field = (label, val, max, multi) => `<div class="field"><div class="field-h"><b>${esc(label)}</b>${max ? `<span class="cc ${val.length > max ? 'over' : ''}">${val.length}/${max}</span>` : ''}${copyBtn(val)}</div>${multi ? `<pre class="field-v">${esc(val)}</pre>` : `<p class="field-v">${esc(val)}</p>`}</div>`;
    const ios = C.ios(L);
    const fixes = F.appliedFixes(A, S.dec, S.lang);
    return `
    <section class="sec-head">
      <p class="kicker">${ic('check')}${esc(t('as.kicker'))}</p>
      <h1>${esc(t('as.h1'))}</h1>
      <p class="muted">${esc(t('as.d'))}</p>
      <div class="row"><button class="btn primary" id="zipAll" data-press data-ripple>${ic('download')}<span>${esc(t('as.zip'))}</span></button><button class="btn ghost" data-go="decide" data-press>${ic('pencil')}<span>${esc(t('as.edit'))}</span></button></div>
    </section>
    <section class="card">
      <div class="card-h"><h2 class="h-ic">${ic('store')}${esc(t('as.listing'))}</h2>
        <div class="seg" role="tablist">${C.langs.map(l => `<button role="tab" aria-selected="${l === L}" data-atab="${l}">${l.toUpperCase()}</button>`).join('')}</div></div>
      ${st.play ? `<h3 class="sub-h">${ic('android')}Google Play</h3>${field(t('f.title'), C.title(L), 30)}${field(t('f.short'), C.short(L), 80)}${field(t('f.full'), C.full(L), 4000, true)}${field(t('f.category'), C.cat[L][1] + ' (' + C.cat.play + ')')}` : ''}
      ${st.apple ? `<h3 class="sub-h">${ic('apple')}App Store</h3>${field(t('f.name'), C.title(L), 30)}${field(t('f.subtitle'), ios.subtitle, 30)}${field(t('f.promo'), ios.promo, 170)}${field(t('f.keywords'), ios.keywords, 100)}${field(t('f.desc'), C.full(L), 4000, true)}${field(t('f.category'), C.cat[L][1] + ' (' + C.cat.apple + ')')}` : ''}
    </section>
    <section class="card">
      <h2 class="h-ic">${ic('image')}${esc(t('as.graphics'))}</h2>
      <div class="gfx">
        <figure><img src="${GEN.icons[ix(S.dec.icon)].dataUrl}" alt="" class="g-icon"><figcaption>${esc(t('g.icon'))} · 512×512 <button class="btn ghost sm" data-dl="icon" data-press>${ic('download')}</button></figcaption></figure>
        <figure class="g-wide"><img src="${GEN.features[ix(S.dec.feature)]}" alt=""><figcaption>${esc(t('g.feature'))} · 1024×500 <button class="btn ghost sm" data-dl="feature" data-press>${ic('download')}</button></figcaption></figure>
      </div>
      <div class="shots-row big">${(GEN.shots || []).map((s, k) => `<figure><img src="${s}" alt=""><figcaption>${k + 1} · 1080×1920 <button class="btn ghost sm" data-dl="shot${k}" data-press>${ic('download')}</button></figcaption></figure>`).join('')}</div>
      ${st.apple ? `<p class="small muted">${ic('apple')} ${esc(t('as.iosShots'))}</p>` : ''}
    </section>
    <section class="grid2">
      <div class="card">
        <h2 class="h-ic">${ic('shield')}${esc(t('as.docs'))}</h2>
        <ul class="docs">
          <li>${ic('file')}<span><b>${esc(t('doc.privacy'))}</b><small>privacy-policy-${C.langs.join('/')}.html</small></span><button class="btn ghost sm" data-dl="privacy" data-press>${ic('download')}</button></li>
          ${A.sdk.auth ? `<li>${ic('file')}<span><b>${esc(t('doc.deletion'))}</b><small>account-deletion.html</small></span><button class="btn ghost sm" data-dl="deletion" data-press>${ic('download')}</button></li>` : ''}
          <li>${ic('list')}<span><b>${esc(t('doc.safety'))}</b><small>data-safety.csv</small></span><button class="btn ghost sm" data-dl="safety" data-press>${ic('download')}</button></li>
          <li>${ic('list')}<span><b>${esc(t('doc.rating'))}</b><small>content-rating.txt</small></span><button class="btn ghost sm" data-dl="rating" data-press>${ic('download')}</button></li>
          <li>${ic('file')}<span><b>${esc(t('doc.support'))}</b><small>support-${C.langs.join('/')}.html</small></span><button class="btn ghost sm" data-dl="support" data-press>${ic('download')}</button></li>
          ${st.apple && A.ios && (!A.ios.privacyManifest || S.dec['fix:trackingMismatch']) ? `<li>${ic('code')}<span><b>PrivacyInfo.xcprivacy</b><small>${esc(t('doc.xcprivacy'))}</small></span><button class="btn ghost sm" data-dl="xcprivacy" data-press>${ic('download')}</button></li>` : ''}
        </ul>
        <p class="small muted">${ic('info')} ${esc(t('as.host'))}</p>
      </div>
      <div class="card">
        <h2 class="h-ic">${ic('code')}${esc(t('as.fixes'))}</h2>
        ${fixes.length ? fixes.map(([k, v]) => `<details class="diff"><summary>${ic('code')}<code>${esc(v.file)}</code></summary><pre>${diffHtml(v.diff)}</pre></details>`).join('') + `<button class="btn ghost sm" data-dl="patch" data-press>${ic('download')}<span>aaplug2-fixes.diff</span></button>` : `<p class="muted">${esc(t('as.noFixes'))}</p>`}
        <p class="small muted">${ic('info')} ${esc(t('as.fixes.d'))}</p>
      </div>
    </section>
    <div class="cta-bar"><span class="muted">${esc(t('as.next.d'))}</span><button class="btn primary lg" data-go="submit" data-press data-ripple>${esc(t('as.next'))}${ic('right')}</button></div>
    ${adSlot()}`;
  }
  function bundleFiles() {
    const A = S.A, slug = F.slugOf(A), files = F.textFiles(A, S.dec, S.lang, t);
    if (S.dec.icon !== 'keep') files.push({ path: 'graphics/icon-512.png', data: dataU8(GEN.icons[ix(S.dec.icon)].dataUrl) });
    if (S.dec.feature !== 'keep') files.push({ path: 'graphics/feature-graphic-1024x500.png', data: dataU8(GEN.features[ix(S.dec.feature)]) });
    if (S.dec.shots !== 'keep') (GEN.shots || []).forEach((s, k) => files.push({ path: `graphics/screenshot-${k + 1}-1080x1920-${S.lang}.png`, data: dataU8(s) }));
    files.push({ path: 'README.txt', data: `AA Plug 2 — ${A.appName} (${A.pkg || ''})\n${new Date().toISOString().slice(0, 10)}\n\n${t('zip.readme')}\n` });
    return { slug, files };
  }
  const dataU8 = u => { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  const ratingTxt = () => F.ratingTxt(S.A, S.lang);
  const patchText = () => F.patchText(S.A, S.dec, S.lang);
  after.assets = async () => {
    if (!GEN) { await ensureGen(); await ensureShots(); return render('none'); }
    if (!GEN.shots || GEN.shotsLang !== S.lang) { await ensureShots(); return render('none'); }
    $$('[data-atab]').forEach(b => b.onclick = () => { assetTab = b.dataset.atab; const y = window.scrollY; render('none'); window.scrollTo(0, y); });
    $('#zipAll').onclick = () => { const { slug, files } = bundleFiles(); download(`aaplug2-${slug}.zip`, window.AAPZip.writeZip(files)); toast(t('downloaded')); };
    $$('[data-dl]').forEach(b => b.onclick = () => {
      const k = b.dataset.dl, A = S.A;
      if (k === 'icon') download('icon-512.png', GEN.icons[ix(S.dec.icon)].dataUrl);
      else if (k === 'feature') download('feature-graphic-1024x500.png', GEN.features[ix(S.dec.feature)]);
      else if (k.startsWith('shot')) download(`screenshot-${+k.slice(4) + 1}.png`, GEN.shots[+k.slice(4)]);
      else if (k === 'privacy') download(`privacy-policy-${S.lang}.html`, G.privacyPolicy(A, S.lang, { photoRemoved: S.dec['fix:photoPerm'] === 'apply', nonPersonalized: !!A.sdk.ads && !F.trackingOn(A, S.dec) }), 'text/html;charset=utf-8');
      else if (k === 'support') download(`support-${S.lang}.html`, G.supportPage(A, S.lang), 'text/html;charset=utf-8');
      else if (k === 'deletion') download(`account-deletion-${S.lang}.html`, G.deletionPage(A, S.lang), 'text/html;charset=utf-8');
      else if (k === 'safety') download('data-safety.csv', G.dataSafetyCsv(A, F.privacyOpts(A, S.dec)), 'text/csv;charset=utf-8');
      else if (k === 'rating') download('content-rating.txt', ratingTxt());
      else if (k === 'xcprivacy') download('PrivacyInfo.xcprivacy', G.xcprivacy(A, F.privacyOpts(A, S.dec)), 'application/xml');
      else if (k === 'patch') download('aaplug2-fixes.diff', patchText());
    });
  };

  /* ===== 5. 제출 안내 ===== */
  let subTab = null;
  const guide = store => {
    const steps = F.guide(S.A, S.dec, S.lang, store, t), extra = LS.reviewNoteLines(relLessons({ [store]: true }));
    const rv = steps.find(s => s.id === 'a-review'); if (rv && extra.length) rv.fields = rv.fields.map(([k, v], i) => (i === 0 ? [k, [v, ...extra].join('\n\n')] : [k, v]));
    return steps;
  };
  function vSubmit() {
    const st = stores(); const tabs = [st.play && 'play', st.apple && 'apple'].filter(Boolean); const tab = tabs.includes(subTab) ? subTab : tabs[0]; subTab = tab;
    const steps = guide(tab); const doneN = steps.filter(s => S.done[s.id]).length;
    return `
    <section class="sec-head">
      <p class="kicker">${ic('flag')}${esc(t('sub.kicker'))}</p>
      <h1>${esc(t('sub.h1'))}</h1>
      <p class="muted">${esc(t('sub.d'))}</p>
    </section>
    <div class="seg big" role="tablist">${tabs.map(s => `<button role="tab" aria-selected="${s === tab}" data-stab="${s}">${ic(s === 'play' ? 'android' : 'apple')}${s === 'play' ? 'Google Play Console' : 'App Store Connect'}</button>`).join('')}</div>
    <div class="bar thin"><i style="transform:scaleX(${doneN / steps.length})"></i></div>
    ${lessonsCard(relLessons({ [tab]: true }).filter(r => r.store === tab))}
    <ol class="guide">${steps.map((s, k) => {
      const locked = s.final && !S.approved; const isDone = !!S.done[s.id];
      return `<li class="gstep card ${isDone ? 'is-done' : ''} ${locked ? 'locked' : ''} m-stagger" style="--i:${Math.min(k, 10)}">
        <div class="g-h"><span class="g-n">${isDone ? ic('check') : k + 1}</span><div><h3>${esc(t('g.' + s.id + '.t'))}</h3><p class="muted">${esc(t('g.' + s.id + '.d'))}</p></div></div>
        ${locked ? `<div class="approve-box">${ic('lock')}<div><b>${esc(t('sub.locked'))}</b><p>${esc(t('sub.locked.d'))}</p></div><button class="btn primary" id="approveBtn" data-press data-ripple>${ic('thumb')}<span>${esc(t('sub.approve'))}</span></button></div>`
          : `${t('g.' + s.id + '.how') !== 'g.' + s.id + '.how' ? `<ol class="how">${t('g.' + s.id + '.how').split('|').map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
          ${s.fields.length ? `<div class="kv">${s.fields.map(([k2, v]) => `<div class="kv-r"><span>${esc(k2)}</span><code class="${String(v).length > 120 ? 'long' : ''}">${esc(v)}</code>${v ? copyBtn(String(v), '') : ''}</div>`).join('')}</div>` : ''}
          <div class="row end"><button class="btn ${isDone ? 'ghost' : 'dark'} sm" data-gdone="${s.id}" data-press>${ic(isDone ? 'refresh' : 'check')}<span>${esc(isDone ? t('g.undo') : t('g.done'))}</span></button></div>`}
      </li>`; }).join('')}</ol>
    <div class="cta-bar"><span class="muted">${esc(S.approved ? t('sub.after') : t('sub.before'))}</span><button class="btn primary lg" id="submitted" data-press data-ripple ${S.approved ? '' : 'disabled'}>${ic('send')}<span>${esc(t('sub.submitted'))}</span></button></div>
    ${adSlot()}`;
  }
  after.submit = () => {
    $$('[data-stab]').forEach(b => b.onclick = () => { subTab = b.dataset.stab; render('none'); });
    $$('[data-gdone]').forEach(b => b.onclick = () => { const id = b.dataset.gdone; S.done[id] = !S.done[id]; save(); const y = window.scrollY; render('none'); window.scrollTo(0, y); });
    const ap = $('#approveBtn'); if (ap) ap.onclick = () => modal({
      icon: 'thumb', title: t('sub.modal.t'), body: `<p>${esc(t('sub.modal.d'))}</p><ul class="mlist">${[stores().play && 'Google Play', stores().apple && 'App Store'].filter(Boolean).map(s => `<li>${ic('check')}${esc(s)} — ${esc(appName())} v${esc(S.A.version)}</li>`).join('')}</ul><p class="small muted">${ic('info')} ${esc(t('sub.modal.note'))}</p>`,
      ok: t('sub.modal.ok'), cancel: t('cancel'), onOk: () => { S.approved = true; save(); render('none'); toast(t('sub.approvedToast')); const f = $('.gstep:last-child'); f && f.scrollIntoView({ behavior: Motion.reduced() ? 'auto' : 'smooth', block: 'center' }); }
    });
    const sb = $('#submitted'); if (sb) sb.onclick = () => { S.review = { status: 'inReview', round: 1, at: Date.now() }; save(); go('review'); };
  };
  function modal(o) {
    const w = document.createElement('div'); w.className = 'modal-w m-scrim-in';
    w.innerHTML = `<div class="modal m-sheet" role="dialog" aria-modal="true" aria-labelledby="mt"><div class="m-ic">${ic(o.icon || 'info')}</div><h2 id="mt">${esc(o.title)}</h2>${o.body}<div class="row end"><button class="btn ghost" data-x data-press>${esc(o.cancel)}</button><button class="btn primary" data-ok data-press data-ripple>${ic('check')}<span>${esc(o.ok)}</span></button></div></div>`;
    document.body.appendChild(w); const close = () => { w.classList.add('m-scrim-out'); w.style.pointerEvents = 'none'; setTimeout(() => w.remove(), 240); };
    w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-x]')) close(); });
    $('[data-ok]', w).onclick = () => { close(); o.onOk && o.onOk(); }; $('[data-ok]', w).focus();
    document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
  }

  /* ===== 6. 심사 ===== */
  function vReview() {
    const R = S.review, st = stores(); const storeKey = st.apple ? 'apple' : 'play';
    const tl = [['submitted', 'send'], ['inReview', 'clock'], ['result', 'flag']];
    const pos = R.status === 'inReview' ? 1 : R.status === 'rejected' || R.status === 'fixing' ? 2 : 2;
    let body = '';
    if (R.status === 'inReview') body = `
      <div class="card review-wait">
        <div class="scan-orb m-breathe">${ic('clock')}</div>
        <h2>${esc(t(R.round > 1 ? 'rv.wait2' : 'rv.wait'))}</h2>
        <p class="muted">${esc(t('rv.wait.d'))}</p>
        <div class="row center wrap">
          <button class="btn primary" id="gotOk" data-press data-ripple>${ic('party')}<span>${esc(t('rv.ok'))}</span></button>
          <button class="btn ghost" id="gotNo" data-press>${ic('message')}<span>${esc(t('rv.no'))}</span></button>
        </div>
        ${S.sample && R.round === 1 ? `<p class="small hint">${ic('sparkle')} ${esc(t('rv.demoHint'))}</p>` : ''}
      </div>`;
    else if (R.status === 'rejected') {
      const sample = (G.REJECTIONS.find(r => r.store === storeKey && (storeKey !== 'apple' || r.id === 'apple-21-demo')) || G.REJECTIONS[0]).sample;
      body = `
      <div class="card">
        <h2 class="h-ic">${ic('message')}${esc(t('rv.paste'))}</h2>
        <p class="muted">${esc(t('rv.paste.d'))}</p>
        <textarea id="rejText" rows="6" spellcheck="false">${esc(R.text || sample)}</textarea>
        ${S.sample ? '' : `<p class="small muted">${esc(LS.tx(S.lang, 'shareNote'))} <a href="privacy.html#lessons">${esc(LS.tx(S.lang, 'shareMore'))}</a></p>`}
        <div class="row end"><button class="btn primary" id="analyzeRej" data-press data-ripple>${ic('wand')}<span>${esc(t('rv.analyze'))}</span></button></div>
      </div>`;
    } else if (R.status === 'fixing' && R.lesson) {
      const L = LS.normDb({ lessons: [R.lesson] }).lessons[0], reply = LS.replyFor(L, appName());
      body = `
      <div class="card m-rise">
        <div class="dc-badges">${sevBadge('block')}${platChip(L.store === 'apple' ? 'ios' : 'android')}</div>
        <h2>${esc((L.codes.length ? L.codes.join(', ') + ' · ' : '') + L.title)}</h2>
        <p class="muted">${esc(L.advice)}</p>
        <h3 class="h-ic">${ic('list')}${esc(t('rv.plan'))}</h3>
        <ol class="how">${LS.planFor(L, S.lang).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        <h3 class="h-ic">${ic('message')}${esc(t('rv.reply'))}</h3>
        <pre class="field-v">${esc(reply)}</pre>
        <div class="row">${copyBtn(reply)}</div>
        <div class="approve-box">${ic('thumb')}<div><b>${esc(t('rv.approveFix'))}</b><p>${esc(t('rv.approveFix.d'))}</p></div><button class="btn primary" id="resubmit" data-press data-ripple>${ic('send')}<span>${esc(t('rv.resubmit'))}</span></button></div>
      </div>`;
    } else if (R.status === 'fixing') {
      const rj = G.REJECTIONS.find(r => r.id === R.rid) || G.REJECTIONS[0]; const reply = rj.reply(appName());
      body = `
      <div class="card m-rise">
        <div class="dc-badges">${sevBadge('block')}${platChip(rj.store === 'apple' ? 'ios' : 'android')}</div>
        <h2>${esc(t('rj.' + rj.id + '.t'))}</h2>
        <p class="muted">${esc(t('rj.' + rj.id + '.w'))}</p>
        <h3 class="h-ic">${ic('list')}${esc(t('rv.plan'))}</h3>
        <ol class="how">${rj.plan[S.lang].map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        <h3 class="h-ic">${ic('message')}${esc(t('rv.reply'))}</h3>
        <pre class="field-v">${esc(reply)}</pre>
        <div class="row">${copyBtn(reply)}${rj.id === 'play-photo' && G.patches(S.A, S.lang)['patch-manifest-photo'] ? `<button class="btn ghost sm" id="dlRejPatch" data-press>${ic('download')}<span>fix.diff</span></button>` : ''}</div>
        <div class="approve-box">${ic('thumb')}<div><b>${esc(t('rv.approveFix'))}</b><p>${esc(t('rv.approveFix.d'))}</p></div><button class="btn primary" id="resubmit" data-press data-ripple>${ic('send')}<span>${esc(t('rv.resubmit'))}</span></button></div>
      </div>`;
    }
    return `
    <section class="sec-head">
      <p class="kicker">${ic('clock')}${esc(t('rv.kicker'))}</p>
      <h1>${esc(t('rv.h1'))}</h1>
    </section>
    <ol class="timeline">${tl.map(([k, icn], i) => `<li class="${i < pos ? 'done' : i === pos ? 'cur' : ''} ${R.status === 'rejected' || R.status === 'fixing' ? (i === 2 ? 'bad' : '') : ''}">${ic(i < pos ? 'check' : icn)}<span>${esc(t('tl.' + k + (i === 2 && (R.status === 'rejected' || R.status === 'fixing') ? 'Bad' : '')))}</span></li>`).join('')}</ol>
    ${body}
    ${adSlot()}`;
  }
  after.review = () => {
    const ok = $('#gotOk'); if (ok) ok.onclick = () => {
      if (!S.sample && (S.lessonIds || []).length) { const pr = LS.recordPass(lessonsDb(), S.lessonIds); saveLessons(pr.db); pr.lessons.forEach(x => shareLesson(x, 'passed')); S.lessonIds = []; }
      S.review.status = 'approved'; S.review.doneAt = Date.now(); save(); go('done'); };
    const no = $('#gotNo'); if (no) no.onclick = () => { S.review.status = 'rejected'; save(); render('none'); };
    const an = $('#analyzeRej'); if (an) an.onclick = () => {
      const text = $('#rejText').value; const st = stores(); const rj = LS.matchKnown(text, st.apple ? null : 'play');
      if (!String(text).trim()) { toast(t('rv.unknown'), 'err'); return; }
      /* Learn on this device: known reasons are counted, unknown ones become a generalized lesson. The demo sample never writes. */
      const store = rj ? rj.store : (!st.apple || (st.play && /google play|issue found|play console/i.test(text)) ? 'play' : 'apple');
      const lr = LS.learn(S.sample ? LS.empty() : lessonsDb(), text, store, rj ? rj.id : null);
      if (!S.sample) { saveLessons(lr.db); S.lessonIds = [...new Set([...(S.lessonIds || []), lr.lesson.id])]; shareLesson(lr.lesson, 'rejected'); }
      if (!rj) { S.review = { ...S.review, status: 'fixing', text, lesson: lr.lesson }; save(); render('none'); if (!S.sample) toast(LS.tx(S.lang, 'saved')); return; }
      S.review = { ...S.review, status: 'fixing', text, rid: rj.id }; save(); render('none');
    };
    const dp = $('#dlRejPatch'); if (dp) dp.onclick = () => download('fix.diff', G.patches(S.A, S.lang)['patch-manifest-photo'].diff);
    const rs = $('#resubmit'); if (rs) rs.onclick = () => modal({ icon: 'send', title: t('rv.modal.t'), body: `<p>${esc(t('rv.modal.d'))}</p>`, ok: t('rv.modal.ok'), cancel: t('cancel'), onOk: () => { S.review = { status: 'inReview', round: (S.review.round || 1) + 1, fixed: S.review.rid || (S.review.lesson && S.review.lesson.id) }; save(); render('none'); toast(t('rv.resubmitted')); } });
  };

  /* ===== 7. 출시 완료 ===== */
  function vDone() {
    const A = S.A, st = stores(), C = GEN ? chosen() : null;
    const n = { docs: 2 + (A.sdk.auth ? 1 : 0) + (st.apple && A.ios && !A.ios.privacyManifest ? 1 : 0), langs: C ? C.langs.length : 1, fixes: Object.entries(S.dec).filter(([k, v]) => k.startsWith('fix:') && v !== 'later').length, gfx: 2 + ((GEN && GEN.shots) || []).length };
    return `
    <section class="done m-rise">
      <div class="confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <div class="done-ic">${GEN ? `<img src="${GEN.icons[ix(S.dec.icon)].dataUrl}" alt="">` : ''}<span class="done-check">${ic('check')}</span></div>
      <p class="kicker">${ic('party')}${esc(t('done.kicker'))}</p>
      <h1>${esc(t('done.h1', { app: appName() }))}</h1>
      <p class="lead">${esc(t('done.d'))}</p>
      <div class="row center wrap">
        ${st.play && A.pkg ? `<a class="btn primary" href="https://play.google.com/store/apps/details?id=${encodeURIComponent(A.pkg)}" target="_blank" rel="noopener">${ic('android')}<span>${esc(t('done.play'))}</span>${ic('external')}</a>` : ''}
        ${st.apple ? `<a class="btn dark" href="https://appstoreconnect.apple.com/apps" target="_blank" rel="noopener">${ic('apple')}<span>${esc(t('done.apple'))}</span>${ic('external')}</a>` : ''}
      </div>
    </section>
    <section class="stats">
      ${[['fixes', 'wand'], ['langs', 'globe'], ['gfx', 'image'], ['docs', 'shield']].map(([k, icn], i) => `<div class="stat card m-stagger" style="--i:${i}">${ic(icn)}<b>${n[k]}</b><span>${esc(t('done.' + k))}</span></div>`).join('')}
    </section>
    <section class="card end-note">
      <h2 class="h-ic">${ic('flag')}${esc(t('done.end'))}</h2>
      <p class="muted">${esc(t('done.end.d'))}</p>
      <div class="row wrap"><button class="btn primary" id="newApp" data-press data-ripple>${ic('refresh')}<span>${esc(t('done.new'))}</span></button><a class="btn ghost" href="${CFG.feedbackUrl}" target="_blank" rel="noopener">${ic('mail')}<span>${esc(t('feedback'))}</span></a></div>
    </section>
    ${adSlot()}`;
  }
  after.done = () => { $('#newApp').onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { } S = fresh(); GEN = null; go('home'); }; if (!GEN) ensureGen().then(() => S.step === 'done' && render('none')); };

  /* ---------------- 전역 이벤트 ---------------- */
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g && !g.disabled) { e.preventDefault(); if (g.dataset.go !== 'home' || S.step !== 'home') { if (S.step !== 'home') S.lastStep = S.step; go(g.dataset.go); } return; }
    const c = e.target.closest('[data-copy]'); if (c) { copy(c.dataset.copy); return; }
    const lb = e.target.closest('#langBtn'); const menu = $('#langMenu');
    if (lb) { const open = menu.hidden; menu.hidden = !open; lb.setAttribute('aria-expanded', String(open)); if (open) menu.classList.add('m-scale-in'); return; }
    const l = e.target.closest('[data-lang]'); if (l) { S.lang = l.dataset.lang; try { localStorage.setItem(UI_LANG_KEY, S.lang); } catch (er) { } save(); if (GEN) { GEN.shots = null; ensureGen().then(() => ensureShots()).then(() => render('none')); } render('none'); $('#main').classList.add('m-lang'); setTimeout(() => $('#main').classList.remove('m-lang'), 400); return; }
    if (menu && !menu.hidden && !e.target.closest('.lang')) { menu.hidden = true; }
  });
  window.addEventListener('DOMContentLoaded', () => {
    Motion.use && Motion.use({ ripple: '[data-ripple]' });
    if (S.A && S.step !== 'home') { ensureGen().then(() => ensureShots()).then(() => render('none')); }
    render('none');
    /* Shared lessons from other reviews: refresh in the background, redraw only screens that list lessons. */
    refreshShared().then(ch => { if (ch && S.A && ['analyze', 'submit'].includes(S.step)) render('none'); });
  });
  window.AAPApp = { state: () => S, go };
})();
