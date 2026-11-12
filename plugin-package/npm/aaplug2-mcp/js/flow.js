/* AA Plug 2 — 흐름 규칙 공용 모듈 (웹 앱 app.js 와 MCP 서버가 같이 쓴다)
   상태(S)에 묶이지 않은 순수 함수만 둔다: 결정 목록, 추천값, 고른 자료, 제출 안내, 묶음 파일. */
(function () {
  'use strict';
  const G = window.AAPGen;
  /* Store-listing languages for the user's app: all five are available; English is the default and the recommendation. */
  const LANGS = ['en', 'ko', 'th', 'zh', 'hi'];
  const DEFAULT_LANGS = ['en'];

  const issueKey = i => 'fix:' + i.id + (i.vars && i.vars.key ? ':' + i.vars.key : '');

  /* ---------- 0.1.5: store stage (per store) ----------
     not_submitted = first submit · in_review = uploaded, waiting · rejected = fix and resubmit · live = update of a live app */
  const STAGES = ['not_submitted', 'in_review', 'rejected', 'live'];
  const storesOf = A => ['play', 'apple'].filter(k => (k === 'play' ? A.platforms.android : A.platforms.ios));
  function stageHints(A, store) {
    const L = (A.listing || {})[store] || { evidence: [] };
    return { evidence: L.evidence || [], weak: L.weak || null, url: L.url || null };
  }
  function stageRec(A, store) { const h = stageHints(A, store); return h.evidence.length ? 'live' : 'not_submitted'; }
  const stageOf = (dec, store) => (dec || {})['stage:' + store] || null;
  /* Stage of every chosen store; a store whose stage is not chosen yet counts as unknown (null). */
  function stagesOf(A, dec) { const o = {}; storesOf(A).forEach(k => { o[k] = stageOf(dec, k); }); return o; }
  /* Does any store already have a listing (in review, rejected or live)? Then listing identity is kept by default. */
  const hasListing = (A, dec) => storesOf(A).some(k => ['in_review', 'rejected', 'live'].includes(stageOf(dec, k)));
  const firstSubmit = (dec, store) => { const s = stageOf(dec, store); return !s || s === 'not_submitted'; };
  const KEEPABLE = ['title', 'short', 'tone', 'category', 'langs', 'icon', 'feature', 'shots'];

  function decisions(A, dec) {
    const list = [];
    /* Stage first: required, per store, recommended from hints. "ask" = hints exist, so accept-all must not pick it for the user. */
    storesOf(A).forEach(k => { const h = stageHints(A, k), rec = stageRec(A, k);
      list.push({ key: 'stage:' + k, group: 'stage', store: k, opts: STAGES.slice(), rec: STAGES.indexOf(rec), hints: h, ask: !!(h.evidence.length || h.weak) }); });
    storesOf(A).forEach(k => { if (stageOf(dec, k) === 'in_review') list.push({ key: 'binary:' + k, group: 'stage', store: k, opts: ['wait', 'new_build'], rec: 0 }); });
    const keep = hasListing(A, dec);
    issuesFor(A, dec).filter(i => i.fix && i.fix !== 'info').forEach(i => {
      /* Tracking: the recommended option is always the aligned no-tracking path (no ATT, NSPrivacyTracking=false, npa=1, App Privacy "No").
         A full tracking path is offered only when the app already declares tracking somewhere, never as "has ads → add ATT". */
      const opts = i.fix === 'choose-tracking' ? (i.id === 'trackingMismatch' ? ['npa', 'track'] : ['npa', 'later']) : i.fix === 'choose-login' ? ['apple', 'later'] : ['apply', 'later'];
      list.push({ key: issueKey(i), group: 'fix', issue: i, opts, rec: 0 });
    });
    const K = d => (keep && KEEPABLE.includes(d.key) ? { ...d, keep: true } : d);
    list.push({ key: 'stores', group: 'store', opts: A.platforms.android && A.platforms.ios ? ['both', 'play', 'apple'] : A.platforms.ios ? ['apple', 'both'] : ['play', 'both'], rec: 0 });
    list.push(...[{ key: 'title', group: 'store', rec: 0 }, { key: 'short', group: 'store', rec: 0 }, { key: 'tone', group: 'store', opts: ['friendly', 'pro'], rec: 0 },
      { key: 'category', group: 'store', rec: 0 }, { key: 'langs', group: 'store', rec: 0 }, { key: 'icon', group: 'store', rec: A.icon ? 0 : 1 }, { key: 'feature', group: 'store', rec: 0 }, { key: 'shots', group: 'store', rec: 0 }].map(K));
    // Browse-first (Guideline 5.1.1(v)): core features without login is the recommended answer.
    if (A.sdk.auth) list.push({ key: 'access', group: 'policy', opts: ['optional', 'required'], rec: 0 });
    // Location used only on the device is "not collected"; the answer must be truthful.
    if (A.sdk.location) list.push({ key: 'location', group: 'policy', opts: ['device', 'server'], rec: A.review && A.review.locationSent ? 1 : 0 });
    /* An existing privacy policy can always be kept. It is the default for an app already in a store or when a public privacy URL was found;
       for a first submit with only a local policy file, a fresh policy remains the default and "keep" is offered. */
    list.push({ key: 'privacy', group: 'policy', rec: 0, keep: !!(A.developer && A.developer.policyFound), keepRec: keep || !!(A.developer && A.developer.privacyUrl) }, { key: 'safety', group: 'policy', rec: 0 }, { key: 'rating', group: 'policy', rec: 0 });
    /* Closed testing is advice for a first Play release only; an app already in review, rejected or live goes to production. */
    if (A.platforms.android) list.push({ key: 'track', group: 'policy', opts: firstSubmit(dec, 'play') ? ['closed', 'production'] : ['production', 'closed'], rec: 0 });
    return list;
  }
  /* Issues as they apply at the chosen stages: no first-release closed-test advice for an app already in review / rejected / live,
     and no "no screenshots" warning when the live listing's screenshots are kept. */
  function issuesFor(A, dec) {
    const keepShots = (dec || {}).shots === 'keep' || hasListing(A, dec);
    const keepIcon = (dec || {}).icon === 'keep' || hasListing(A, dec);
    return A.issues.filter(i => !(i.id === 'closedTest' && !firstSubmit(dec, 'play')) && !(i.id === 'noShots' && keepShots) && !(i.id === 'noIcon' && keepIcon));
  }
  function recValue(d) {
    if (d.keep && d.keepRec !== false) return 'keep';
    if (d.opts) return d.opts[d.rec];
    if (d.key === 'langs') return DEFAULT_LANGS.slice();
    if (['shots', 'privacy', 'safety', 'rating'].includes(d.key)) return 'ok';
    return d.rec;
  }
  function defaultStores(A) { const p = A.platforms; return p.android && p.ios ? 'both' : p.ios ? 'apple' : 'play'; }
  function stores(A, dec) { const v = (dec && dec.stores) || defaultStores(A); return { play: v !== 'apple', apple: v !== 'play' }; }

  /* 사용자가 고른 스토어 문구 (listing 은 언어별로 한 번만 만든다) */
  function chosen(A, dec) {
    const d = dec || {}, tone = d.tone && d.tone !== 'keep' ? d.tone : 'friendly', cache = {};
    const li = l => (cache[l] = cache[l] || G.listing(A, l, tone));
    const idx = v => (typeof v === 'number' ? v : 0);
    /* "keep" = keep the live listing. Use the existing copy found in the project (fastlane metadata) when there is one. */
    const LS = A.listing || { play: { copy: {}, langs: [] }, apple: { copy: {}, langs: [] } };
    const pc = l => (LS.play.copy || {})[l] || {}, ac = l => (LS.apple.copy || {})[l] || {};
    const existingLangs = [...new Set([...(LS.play.langs || []), ...(LS.apple.langs || [])])].filter(l => LANGS.includes(l));
    const keepLangs = existingLangs.length ? existingLangs : [...new Set(['en', ...(A.locales || []).filter(l => LANGS.includes(l))])];
    const langs = d.langs === 'keep' ? keepLangs : (Array.isArray(d.langs) && d.langs.length ? d.langs : DEFAULT_LANGS.slice());
    const keep = { title: d.title === 'keep', short: d.short === 'keep', tone: d.tone === 'keep', category: d.category === 'keep', langs: d.langs === 'keep', icon: d.icon === 'keep', feature: d.feature === 'keep', shots: d.shots === 'keep', privacy: d.privacy === 'keep' };
    return {
      langs, listing: li, keep,
      title: l => { if (keep.title && (pc(l).title || ac(l).name)) return pc(l).title || ac(l).name; const x = li(l).titles; return x[Math.min(idx(d.title), x.length - 1)]; },
      short: l => { if (keep.short && pc(l).short) return pc(l).short; const x = li(l).shorts; return x[Math.min(idx(d.short), x.length - 1)]; },
      full: l => ((keep.tone || keep.title) && (pc(l).full || ac(l).description)) || li(l).full,
      ios: l => { const g = li(l).ios, a = ac(l); return keep.title && (a.subtitle || a.keywords) ? { ...g, subtitle: a.subtitle || g.subtitle, keywords: a.keywords || g.keywords } : g; },
      existing: l => ({ play: pc(l), apple: ac(l) }),
      cat: G.CAT[A.categories[idx(d.category)]] || G.CAT[A.categories[0]]
    };
  }

  /* Tracking on? Only on a fully aligned tracking path: already aligned in the app, or the user chose "track" for a mixed state. */
  function trackingOn(A, dec) {
    if (!A.ios) return false;
    const st = window.AAPAnalyzer && window.AAPAnalyzer.tracking ? window.AAPAnalyzer.tracking(A).state : 'none';
    return st === 'tracking' || (st === 'mixed' && (dec || {})['fix:trackingMismatch'] === 'track');
  }
  function locationAnswer(A, dec) { const d = dec || {}; return !A.sdk.location ? null : d.location || (A.review && A.review.locationSent ? 'server' : 'device'); }
  function loginRequired(A, dec) { return !!A.sdk.auth && (dec || {}).access === 'required'; }
  function privacyOpts(A, dec) { return { tracking: trackingOn(A, dec), location: locationAnswer(A, dec) }; }

  /* Review notes in English (what App Review reads). Placeholders stay placeholders: never real keys or passwords. */
  function reviewNotes(A, dec, l0) {
    const d = dec || {}, R = A.review || {}, out = [];
    if (!A.sdk.auth) out.push('No login required. All features are available on launch.');
    else if (!loginRequired(A, d)) out.push('Signing in is optional. All core features work without an account.' + (A.sdk.appleSignIn || d['fix:loginOption'] === 'apple' ? ' Reviewers can also use Sign in with Apple with their own Apple ID.' : '') + ' No demo account is required.');
    else out.push('Sign-in is required because [explain why the core feature needs an account]. Demo account (working): [username] / [password].');
    if (A.sdk.auth) out.push(`Account deletion: in the app, Settings > Delete account. On the web: https://<your-site>/account-deletion-${l0 || 'en'}.html`);
    if (R.byok) out.push('This app has no in-app purchases or subscriptions. AI features use the user\'s own API key, which the user obtains from a third-party provider (for example, Google AI Studio). We do not sell or provide API keys. A working sample key for review: [attach a review-only key here; never commit a real key].');
    if (A.ios && (A.sdk.ads || A.ios.gad)) out.push(trackingOn(A, d) ? 'The App Tracking Transparency prompt appears [where], right after launch and before any tracking. No login is needed to see it.' : 'The app does not track users and does not show an App Tracking Transparency prompt.');
    return out.join('\n\n');
  }

  /* 0.1.5: guide for an app that is already in review, rejected or live (per store). */
  const WHATS_NEW = { en: 'Bug fixes and improvements.', ko: '버그 수정 및 개선.', th: 'แก้ไขข้อบกพร่องและปรับปรุง', zh: '问题修复和改进。', hi: 'बग फ़िक्स और सुधार।' };
  const bumpName = v => { const m = String(v || '1.0.0').match(/^(\d+)\.(\d+)(?:\.(\d+))?/); return m ? `${m[1]}.${m[2]}.${(+(m[3] || 0)) + 1}` : '[next version]'; };
  function stageGuide(A, dec, lang, store, t, stage) {
    const d = dec || {}, C = chosen(A, d), L = lang, l0 = C.langs.includes(L) ? L : C.langs[0], R = A.review || {}, play = store === 'play';
    const po = privacyOpts(A, d), ads = !!(A.sdk.ads || (A.ios && A.ios.gad)), an = A.android || {}, io = A.ios || {};
    const privacyUrl = (A.developer && A.developer.privacyUrl) || (C.keep.privacy ? t('f.keepCurrent') : 'https://<your-site>/privacy-policy-' + l0 + '.html');
    const vc = +(an.versionCode || 1), build = +(io.build || 1);
    const version = play ? [['applicationId', A.pkg || ''], [t('f.versionNow'), `${an.versionName || A.version} / ${vc}`], [t('f.versionNext'), `${bumpName(an.versionName || A.version)} / ${vc + 1}`], ['targetSdk', an.targetSdk ? String(an.targetSdk) : t('f.unread', { need: 36 })]]
      : [['Bundle ID', io.bundleId || A.pkg || ''], [t('f.versionNow'), `${io.version || A.version} (${build})`], [t('f.versionNext'), `${bumpName(io.version || A.version)} (${build + 1})`], ['Xcode', '26+ (iOS 26 SDK)']];
    const checks = play ? [[t('f.privacyUrl'), privacyUrl], [t('f.dataSafety'), 'data-safety.csv'], [t('f.ads'), A.sdk.ads ? t('yes') : t('no')], ...(A.sdk.ads ? [[t('f.adId'), t('f.adIdYes')]] : []), ...(A.sdk.auth ? [[t('f.deletionUrl'), 'https://<your-site>/account-deletion-' + l0 + '.html']] : [])]
      : [[t('f.trackForm'), po.tracking ? t('f.trackForm.yes') : t('f.trackForm.no')], [t('f.privacyUrl'), privacyUrl], [t('f.supportUrl'), (A.listing && A.listing.supportUrl) || 'https://<your-site>/support/'], [t('f.supportNote'), t('f.supportNote.d')], ...(A.sdk.thirdPartyLogin ? [['Sign in with Apple', A.sdk.appleSignIn || d['fix:loginOption'] === 'apple' ? t('yes') : t('f.required')]] : []), [t('f.reviewNotes'), reviewNotes(A, d, l0)]];
    const keepListing = C.keep.title || C.keep.short;
    const listing = keepListing ? [[t('f.listingKeep'), t('f.listingKeep.d')]] : C.langs.flatMap(l => play ? [[`${t('f.title')} (${l})`, C.title(l)], [`${t('f.short')} (${l})`, C.short(l)]] : [[`${t('f.name')} (${l})`, C.title(l)], [`${t('f.subtitle')} (${l})`, C.ios(l).subtitle]]);
    const submit = play ? [[t('f.track'), t('track.' + (d.track === 'closed' ? 'closed' : 'production'))], [t('f.rollout'), t('f.rollout.d')]] : [[t('f.release'), t('f.releaseManual')], [t('f.infoNeeded'), t('f.infoNeeded.d')]];
    if (stage === 'live') return [
      { id: 'u-version', fields: version },
      { id: 'u-whatsnew', fields: C.langs.map(l => [`${t('f.whatsNew')} (${l})`, WHATS_NEW[l] || WHATS_NEW.en]) },
      { id: 'u-checks', fields: checks },
      { id: 'u-listing', fields: listing },
      { id: 'u-submit', final: true, fields: submit }
    ];
    if (stage === 'in_review') {
      const nb = d['binary:' + store] === 'new_build';
      return [
        { id: 'i-wait', fields: [] },
        { id: 'i-keep', fields: [] },
        { id: 'i-info', fields: [[t('f.infoNeeded'), t('f.infoNeeded.d')], ...(play ? [] : [[t('f.reviewNotes'), reviewNotes(A, d, l0)]])] },
        { id: 'i-meta', fields: checks },
        ...(nb ? [{ id: 'i-newbuild', final: true, fields: version.concat([[t('f.replaceWarn'), t('f.replaceWarn.d')]]) }] : [])
      ];
    }
    return [
      { id: 'r-message', fields: [] },
      { id: 'r-fix', fields: checks },
      { id: 'r-reply', fields: [[t('f.replyWhere'), play ? 'Play Console → Policy status / Inbox' : 'App Store Connect → App Review (Resolution Center)'], [t('f.autoReply'), t('f.autoReply.d')]] },
      { id: 'r-build', fields: version },
      { id: 'r-resubmit', final: true, fields: submit }
    ];
  }

  /* 제출 안내 단계 (마지막 단계 final:true 는 사용자 승인 뒤에만 연다) */
  function guide(A, dec, lang, store, t) {
    const stage = stageOf(dec, store);
    if (stage && stage !== 'not_submitted') return stageGuide(A, dec, lang, store, t, stage);
    const C = chosen(A, dec), L = lang, l0 = C.langs.includes(L) ? L : C.langs[0];
    const closed = dec.track !== 'production';
    if (store === 'play') return [
      { id: 'p-account', fields: [] },
      { id: 'p-create', fields: [[t('f.name'), C.title(l0)], [t('f.defaultLang'), { ko: '한국어 – ko-KR', en: 'English (United States) – en-US', th: 'ภาษาไทย – th', zh: '中文（简体）– zh-CN', hi: 'हिन्दी – hi-IN' }[l0]], [t('f.appOrGame'), A.categories[0] === 'games' ? t('f.game') : t('f.app')], [t('f.freePaid'), t('f.free')]] },
      { id: 'p-content', fields: [[t('f.privacyUrl'), (A.developer && A.developer.privacyUrl) || 'https://<your-site>/privacy-policy-' + l0 + '.html'], [t('f.ads'), A.sdk.ads ? t('yes') : t('no')], [t('f.access'), A.sdk.auth ? (loginRequired(A, dec) ? t('f.accessRequired') : t('f.accessOptional')) : t('f.accessAll')], [t('f.audience'), '18+'], [t('f.rating'), G.rating(A, L).result.play], [t('f.dataSafety'), 'data-safety.csv'], ...(A.sdk.auth ? [[t('f.deletionUrl'), 'https://<your-site>/account-deletion-' + l0 + '.html']] : []), ...(A.sdk.ads ? [[t('f.adId'), t('f.adIdYes')]] : []), ...(A.categories[0] === 'finance' ? [[t('f.finance'), t('f.financeNone')]] : [])] },
      { id: 'p-listing', fields: C.langs.flatMap(l => [[`${t('f.title')} (${l})`, C.title(l)], [`${t('f.short')} (${l})`, C.short(l)], [`${t('f.full')} (${l})`, C.full(l)]]).concat([[t('f.category'), C.cat.play], [t('f.email'), A.developer.email || '']]) },
      { id: 'p-build', fields: [['applicationId', A.pkg || ''], ['versionName / versionCode', `${A.version} / ${(A.android && A.android.versionCode) || 1}`], ['targetSdk', '36']] },
      closed ? { id: 'p-closed', fields: [[t('f.testers'), '12+'], [t('f.days'), '14']] } : null,
      { id: 'p-submit', final: true, fields: [[t('f.releaseNotes') + ` (${l0})`, { ko: '첫 출시입니다. 잘 부탁드려요!', en: 'First release. Thanks for trying it!', th: 'เปิดตัวครั้งแรก ขอบคุณที่ลองใช้!', zh: '首次发布，感谢试用！', hi: 'पहली रिलीज़। आज़माने के लिए धन्यवाद!' }[l0]], [t('f.countries'), t('f.allCountries')]] }
    ].filter(Boolean);
    const ios = C.ios(l0), po = privacyOpts(A, dec), ds = G.dataSafety(A, L, po), rt = G.rating(A, L), ads = !!(A.sdk.ads || (A.ios && A.ios.gad)), R = A.review || {};
    return [
      { id: 'a-account', fields: [] },
      { id: 'a-create', fields: [[t('f.name'), C.title(l0)], [t('f.primaryLang'), { ko: 'Korean', en: 'English (U.S.)', th: 'Thai', zh: 'Simplified Chinese', hi: 'Hindi' }[l0]], ['Bundle ID', (A.ios && A.ios.bundleId) || A.pkg || ''], ['SKU', (A.pkg || 'app').replace(/\./g, '-') + '-001']] },
      { id: 'a-info', fields: [[t('f.category'), C.cat.apple], [t('f.ageRating'), `${rt.result.apple} · ${t('f.ageRating.d')}`], [t('f.ageAds'), ads ? t('f.ageAds.yes') : t('f.ageAds.no')], [t('f.price'), t('f.free')], [t('f.privacyUrl'), (A.developer && A.developer.privacyUrl) || 'https://<your-site>/privacy-policy-' + l0 + '.html']] },
      { id: 'a-privacy', fields: ds.rows.map(r => [r.appleType, `${r.purposes} · ${r.linked ? t('ds.linked') : t('ds.notLinked')} · ${t('f.tracking')}: ${r.tracking ? t('yes') : t('no')}`])
        .concat(ds.notCollected.map(r => [r.appleType, r.note]))
        .concat([[t('f.trackForm'), po.tracking ? t('f.trackForm.yes') : t('f.trackForm.no')], [t('f.privacyNote'), t('f.privacyNote.d')]]) },
      { id: 'a-version', fields: [[t('f.subtitle'), ios.subtitle], [t('f.promo'), ios.promo], [t('f.keywords'), ios.keywords], [t('f.desc'), C.full(l0)], [t('f.supportUrl'), 'https://<your-site>/support/'], [t('f.supportNote'), t('f.supportNote.d')],
        [t('f.shots'), 'iPhone 6.7" (APP_IPHONE_67) · 1320×2868 · ' + t('f.shots.d')], ...(A.ios && A.ios.ipad ? [[t('f.ipadShots'), 'iPad 12.9"/13" (APP_IPAD_PRO_3GEN_129) · 2048×2732 · ' + t('f.required')]] : []), [t('f.preview'), t('f.optional')], [t('f.copyRule'), t('f.copyRule.d')]] },
      { id: 'a-build', fields: [['Xcode', '26+ (iOS 26 SDK)'], ['Version', A.version], ['ITSAppUsesNonExemptEncryption', A.ios && A.ios.encryption === true ? 'YES (export compliance documents)' : 'NO (HTTPS only)'], [t('f.deployment'), 'iOS 15.0+']] },
      { id: 'a-review', fields: [[t('f.reviewNotes'), reviewNotes(A, dec, l0)], [t('f.demoRequired'), loginRequired(A, dec) ? t('yes') : t('no') + ' (demoAccountRequired = false)'], ...(R.byok ? [[t('f.reviewKey'), t('f.reviewKey.d')]] : []), [t('f.contact'), A.developer.email || '']] },
      { id: 'a-submit', final: true, fields: [[t('f.release'), t('f.releaseManual')], [t('f.infoNeeded'), t('f.infoNeeded.d')]] }
    ];
  }

  function ratingTxt(A, lang) { const r = G.rating(A, lang); return r.qa.map(([q, a]) => `${q}: ${a}`).join('\n') + `\n\n=> ${r.result.play}\n=> App Store: ${r.result.apple}\n`; }
  function appliedFixes(A, dec, lang) {
    const p = G.patches(A, lang);
    const tr = A.issues.find(i => i.fix === 'choose-tracking'), trv = tr && dec[issueKey(tr)];
    return Object.entries(p).filter(([k]) => A.issues.some(i => i.fix === k && dec[issueKey(i)] === 'apply') || (trv && trv !== 'later' && k === 'tracking-' + trv));
  }
  function patchText(A, dec, lang) { return appliedFixes(A, dec, lang).map(([, v]) => v.diff).join('\n'); }

  /* 묶음(ZIP) 안의 글자 파일들. 그래픽은 부르는 쪽이 붙인다. */
  function textFiles(A, dec, lang, t) {
    const C = chosen(A, dec), st = stores(A, dec), files = [];
    const keepListing = C.keep.title || C.keep.short;
    if (keepListing) files.push({ path: 'listing/KEEP-CURRENT-LISTING.txt', data: 'Keep the current store listing (name, descriptions, category, screenshots, icon). AA Plug 2 did not write a new listing.\nChange it only if you decide to.\n' });
    if (hasListing(A, dec)) files.push({ path: 'release-notes/whats-new.txt', data: C.langs.map(l => `${l}: ${WHATS_NEW[l] || WHATS_NEW.en}`).join('\n') + '\n' });
    for (const l of C.langs) {
      const ios = C.ios(l), ex = C.existing(l);
      const K = '[keep the current text]';
      if (keepListing) {
        /* Kept listing: only the existing copy found in the project, never invented text. */
        if (ex.play.title || ex.play.short || ex.play.full) files.push({ path: `listing/${l}/google-play.txt`, data: `${t('f.title')}:\n${ex.play.title || K}\n\n${t('f.short')}:\n${ex.play.short || K}\n\n${t('f.full')}:\n${ex.play.full || K}\n` });
        if (st.apple && (ex.apple.name || ex.apple.description)) files.push({ path: `listing/${l}/app-store.txt`, data: `Name:\n${ex.apple.name || K}\n\nSubtitle:\n${ex.apple.subtitle || K}\n\nKeywords:\n${ex.apple.keywords || K}\n\nDescription:\n${ex.apple.description || K}\n` });
      } else {
        files.push({ path: `listing/${l}/google-play.txt`, data: `${t('f.title')}:\n${C.title(l)}\n\n${t('f.short')}:\n${C.short(l)}\n\n${t('f.full')}:\n${C.full(l)}\n` });
        if (st.apple) files.push({ path: `listing/${l}/app-store.txt`, data: `Name:\n${C.title(l)}\n\nSubtitle:\n${ios.subtitle}\n\nPromotional text:\n${ios.promo}\n\nKeywords:\n${ios.keywords}\n\nDescription:\n${C.full(l)}\n` });
      }
      if (!C.keep.privacy) files.push({ path: `policy/privacy-policy-${l}.html`, data: G.privacyPolicy(A, l, { photoRemoved: dec['fix:photoPerm'] === 'apply', nonPersonalized: !!A.sdk.ads && !trackingOn(A, dec) }) });
      if (A.sdk.auth) files.push({ path: `policy/account-deletion-${l}.html`, data: G.deletionPage(A, l) });
      files.push({ path: `policy/support-${l}.html`, data: G.supportPage(A, l) });
    }
    const po = privacyOpts(A, dec);
    files.push({ path: 'forms/data-safety.csv', data: G.dataSafetyCsv(A, po) });
    files.push({ path: 'forms/content-rating.txt', data: ratingTxt(A, lang) });
    if (st.apple && A.ios && (!A.ios.privacyManifest || dec['fix:trackingMismatch'])) files.push({ path: 'ios/PrivacyInfo.xcprivacy', data: G.xcprivacy(A, po) });
    if (st.apple && A.ios) files.push({ path: 'forms/app-review-notes.txt', data: reviewNotes(A, dec, C.langs[0]) + '\n' });
    const pt = patchText(A, dec, lang); if (pt) files.push({ path: 'fixes/aaplug2-fixes.diff', data: pt });
    return files;
  }
  const slugOf = A => (A.pkg || A.appName).replace(/[^\w.-]+/g, '-');

  window.AAPFlow = { issuesFor, STAGES, storesOf, stageHints, stageRec, stageOf, stagesOf, hasListing, firstSubmit, KEEPABLE, WHATS_NEW, LANGS, DEFAULT_LANGS, issueKey, decisions, recValue, defaultStores, stores, chosen, guide, ratingTxt, appliedFixes, patchText, textFiles, slugOf, trackingOn, locationAnswer, loginRequired, privacyOpts, reviewNotes };
})();
