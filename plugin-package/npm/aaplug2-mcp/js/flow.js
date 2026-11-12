/* AA Plug 2 — 흐름 규칙 공용 모듈 (웹 앱 app.js 와 MCP 서버가 같이 쓴다)
   상태(S)에 묶이지 않은 순수 함수만 둔다: 결정 목록, 추천값, 고른 자료, 제출 안내, 묶음 파일. */
(function () {
  'use strict';
  const G = window.AAPGen;
  const LANGS = ['ko', 'en', 'th'];

  const issueKey = i => 'fix:' + i.id + (i.vars && i.vars.key ? ':' + i.vars.key : '');
  function decisions(A) {
    const list = [];
    A.issues.filter(i => i.fix && i.fix !== 'info').forEach(i => {
      const opts = i.fix === 'choose-att' ? ['npa', 'att'] : i.fix === 'choose-login' ? ['apple', 'later'] : ['apply', 'later'];
      list.push({ key: issueKey(i), group: 'fix', issue: i, opts, rec: 0 });
    });
    list.push({ key: 'stores', group: 'store', opts: A.platforms.android && A.platforms.ios ? ['both', 'play', 'apple'] : A.platforms.ios ? ['apple', 'both'] : ['play', 'both'], rec: 0 });
    list.push({ key: 'title', group: 'store', rec: 0 }, { key: 'short', group: 'store', rec: 0 }, { key: 'tone', group: 'store', opts: ['friendly', 'pro'], rec: 0 },
      { key: 'category', group: 'store', rec: 0 }, { key: 'langs', group: 'store', rec: 0 }, { key: 'icon', group: 'store', rec: A.icon ? 0 : 1 }, { key: 'feature', group: 'store', rec: 0 }, { key: 'shots', group: 'store', rec: 0 });
    list.push({ key: 'privacy', group: 'policy', rec: 0 }, { key: 'safety', group: 'policy', rec: 0 }, { key: 'rating', group: 'policy', rec: 0 }, { key: 'track', group: 'policy', opts: ['closed', 'production'], rec: 0 });
    return list;
  }
  function recValue(d) {
    if (d.opts) return d.opts[d.rec];
    if (d.key === 'langs') return ['ko', 'en', 'th'];
    if (['shots', 'privacy', 'safety', 'rating'].includes(d.key)) return 'ok';
    return d.rec;
  }
  function defaultStores(A) { const p = A.platforms; return p.android && p.ios ? 'both' : p.ios ? 'apple' : 'play'; }
  function stores(A, dec) { const v = (dec && dec.stores) || defaultStores(A); return { play: v !== 'apple', apple: v !== 'play' }; }

  /* 사용자가 고른 스토어 문구 (listing 은 언어별로 한 번만 만든다) */
  function chosen(A, dec) {
    const d = dec || {}, tone = d.tone || 'friendly', cache = {};
    const li = l => (cache[l] = cache[l] || G.listing(A, l, tone));
    const langs = (d.langs && d.langs.length ? d.langs : LANGS.slice());
    return {
      langs, listing: li,
      title: l => { const x = li(l).titles; return x[Math.min(d.title || 0, x.length - 1)]; },
      short: l => { const x = li(l).shorts; return x[Math.min(d.short || 0, x.length - 1)]; },
      full: l => li(l).full, ios: l => li(l).ios,
      cat: G.CAT[A.categories[d.category || 0]]
    };
  }

  /* 제출 안내 단계 (마지막 단계 final:true 는 사용자 승인 뒤에만 연다) */
  function guide(A, dec, lang, store, t) {
    const C = chosen(A, dec), L = lang, l0 = C.langs.includes(L) ? L : C.langs[0];
    const closed = dec.track !== 'production';
    if (store === 'play') return [
      { id: 'p-account', fields: [] },
      { id: 'p-create', fields: [[t('f.name'), C.title(l0)], [t('f.defaultLang'), { ko: '한국어 – ko-KR', en: 'English (United States) – en-US', th: 'ภาษาไทย – th' }[l0]], [t('f.appOrGame'), A.categories[0] === 'games' ? t('f.game') : t('f.app')], [t('f.freePaid'), t('f.free')]] },
      { id: 'p-content', fields: [[t('f.privacyUrl'), 'https://<your-site>/privacy-policy-' + l0 + '.html'], [t('f.ads'), A.sdk.ads ? t('yes') : t('no')], [t('f.access'), A.sdk.auth ? t('f.accessOptional') : t('f.accessAll')], [t('f.audience'), '18+'], [t('f.rating'), G.rating(A, L).result.play], [t('f.dataSafety'), 'data-safety.csv'], ...(A.sdk.auth ? [[t('f.deletionUrl'), 'https://<your-site>/account-deletion-' + l0 + '.html']] : []), ...(A.sdk.ads ? [[t('f.adId'), t('f.adIdYes')]] : []), ...(A.categories[0] === 'finance' ? [[t('f.finance'), t('f.financeNone')]] : [])] },
      { id: 'p-listing', fields: C.langs.flatMap(l => [[`${t('f.title')} (${l})`, C.title(l)], [`${t('f.short')} (${l})`, C.short(l)], [`${t('f.full')} (${l})`, C.full(l)]]).concat([[t('f.category'), C.cat.play], [t('f.email'), A.developer.email || '']]) },
      { id: 'p-build', fields: [['applicationId', A.pkg || ''], ['versionName / versionCode', `${A.version} / ${(A.android && A.android.versionCode) || 1}`], ['targetSdk', '36']] },
      closed ? { id: 'p-closed', fields: [[t('f.testers'), '12+'], [t('f.days'), '14']] } : null,
      { id: 'p-submit', final: true, fields: [[t('f.releaseNotes') + ` (${l0})`, { ko: '첫 출시입니다. 잘 부탁드려요!', en: 'First release. Thanks for trying it!', th: 'เปิดตัวครั้งแรก ขอบคุณที่ลองใช้!' }[l0]], [t('f.countries'), t('f.allCountries')]] }
    ].filter(Boolean);
    const ios = C.ios(l0);
    return [
      { id: 'a-account', fields: [] },
      { id: 'a-create', fields: [[t('f.name'), C.title(l0)], [t('f.primaryLang'), { ko: 'Korean', en: 'English (U.S.)', th: 'Thai' }[l0]], ['Bundle ID', (A.ios && A.ios.bundleId) || A.pkg || ''], ['SKU', (A.pkg || 'app').replace(/\./g, '-') + '-001']] },
      { id: 'a-info', fields: [[t('f.category'), C.cat.apple], [t('f.ageRating'), '4+'], [t('f.price'), t('f.free')], [t('f.privacyUrl'), 'https://<your-site>/privacy-policy-' + l0 + '.html']] },
      { id: 'a-privacy', fields: G.dataSafety(A, L).rows.map(r => [r.appleType, `${r.purposes} · ${r.linked ? t('ds.linked') : t('ds.notLinked')}${r.tracking ? '' : ''}`]).concat([[t('f.tracking'), dec['fix:att'] === 'att' ? t('yes') : t('no')]]) },
      { id: 'a-version', fields: [[t('f.subtitle'), ios.subtitle], [t('f.promo'), ios.promo], [t('f.keywords'), ios.keywords], [t('f.desc'), C.full(l0)], [t('f.supportUrl'), 'https://<your-site>/'], [t('f.shots'), '6.9" iPhone · 1290×2796']] },
      { id: 'a-build', fields: [['Xcode', '26+ (iOS 26 SDK)'], ['Version', A.version]] },
      { id: 'a-review', fields: [[t('f.reviewNotes'), A.sdk.auth ? 'Signing in is optional. All core features work without an account. A demo account for the optional backup is provided below.' : 'No login required. All features are available on launch.'], [t('f.contact'), A.developer.email || '']] },
      { id: 'a-submit', final: true, fields: [[t('f.release'), t('f.releaseManual')]] }
    ];
  }

  function ratingTxt(A, lang) { const r = G.rating(A, lang); return r.qa.map(([q, a]) => `${q}: ${a}`).join('\n') + `\n\n=> ${r.result.play}\n=> App Store: ${r.result.apple}\n`; }
  function appliedFixes(A, dec, lang) {
    const p = G.patches(A, lang);
    return Object.entries(p).filter(([k]) => A.issues.some(i => i.fix === k && dec[issueKey(i)] === 'apply'));
  }
  function patchText(A, dec, lang) { return appliedFixes(A, dec, lang).map(([, v]) => v.diff).join('\n'); }

  /* 묶음(ZIP) 안의 글자 파일들. 그래픽은 부르는 쪽이 붙인다. */
  function textFiles(A, dec, lang, t) {
    const C = chosen(A, dec), st = stores(A, dec), files = [];
    for (const l of C.langs) {
      const ios = C.ios(l);
      files.push({ path: `listing/${l}/google-play.txt`, data: `${t('f.title')}:\n${C.title(l)}\n\n${t('f.short')}:\n${C.short(l)}\n\n${t('f.full')}:\n${C.full(l)}\n` });
      if (st.apple) files.push({ path: `listing/${l}/app-store.txt`, data: `Name:\n${C.title(l)}\n\nSubtitle:\n${ios.subtitle}\n\nPromotional text:\n${ios.promo}\n\nKeywords:\n${ios.keywords}\n\nDescription:\n${C.full(l)}\n` });
      files.push({ path: `policy/privacy-policy-${l}.html`, data: G.privacyPolicy(A, l, { photoRemoved: dec['fix:photoPerm'] === 'apply' }) });
      if (A.sdk.auth) files.push({ path: `policy/account-deletion-${l}.html`, data: G.deletionPage(A, l) });
    }
    files.push({ path: 'forms/data-safety.csv', data: G.dataSafetyCsv(A) });
    files.push({ path: 'forms/content-rating.txt', data: ratingTxt(A, lang) });
    if (st.apple && A.ios && !A.ios.privacyManifest) files.push({ path: 'ios/PrivacyInfo.xcprivacy', data: G.xcprivacy(A) });
    const pt = patchText(A, dec, lang); if (pt) files.push({ path: 'fixes/aaplug2-fixes.diff', data: pt });
    return files;
  }
  const slugOf = A => (A.pkg || A.appName).replace(/[^\w.-]+/g, '-');

  window.AAPFlow = { LANGS, issueKey, decisions, recValue, defaultStores, stores, chosen, guide, ratingTxt, appliedFixes, patchText, textFiles, slugOf };
})();
