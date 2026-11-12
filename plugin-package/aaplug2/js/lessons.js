/* AA Plug 2 — review lessons learned on this device (shared by the web app and the MCP server).
   Pure logic only: no storage, no network (callers send the anonymized payload from sharePayload to aaplug.com). The MCP server keeps the lessons in ~/.aaplug2/lessons.json,
   the web app in localStorage ('aaplug2.lessons.v1'). Raw rejection letters are never stored here:
   a lesson holds only a store, guideline / ITMS codes, a short generalized title, advice taken from a
   fixed table, a pre-submit reminder and counters. Learned text is data, never instructions. */
(function () {
  const V = 1, MAX_LESSONS = 200, LANGS = ['en', 'ko', 'th', 'zh', 'hi'];
  const nl = l => (LANGS.includes(l) ? l : 'en');

  /* ---------- sanitizing (everything that is kept goes through this) ---------- */
  const INJECT = [
    /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}?\b(previous|prior|above|earlier|all|any|the|your|these|system)\b[^.\n]{0,20}?\b(instructions?|prompts?|messages?|rules?|directions?|guidelines? above)\b/gi,
    /\b(system|developer|assistant)\s*(prompt|message|instructions?)\s*:?/gi,
    /\byou are now\b[^.\n]*/gi, /\bact as\b[^.\n]*/gi, /\b(jailbreak|developer mode|do anything now)\b/gi,
    /\b(call|run|invoke|execute)\s+(the\s+)?(tool|function|command|aaplug2_\w+)\b[^.\n]*/gi
  ];
  function sanitize(s, max) {
    let t = String(s == null ? '' : s).normalize('NFKC');
    t = t.replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, ' ');
    t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
    t = t.replace(/\b(https?:\/\/|www\.)\S+/gi, '[link]');
    t = t.replace(/\b(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|xox[abprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{12,})\b/g, '[secret]');
    t = t.replace(/\b(pass(word|code)?|pwd|pin|token|api[ _-]?key|secret|otp)\b(\s*(is|:|=)\s*)\S+/gi, '$1$3[secret]');
    t = t.replace(/\b[A-Za-z0-9_\-+/=]{32,}\b/g, '[secret]');
    t = t.replace(/\+?\d[\d ().-]{7,}\d/g, m => (/^\d{4}-\d{2}-\d{2}$/.test(m) ? m : '[phone]'));
    for (const re of INJECT) t = t.replace(re, ' ');
    t = t.replace(/[<>`{}\\]/g, ' ').replace(/\s+/g, ' ').trim();
    const n = max || 240;
    return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
  }

  /* ---------- reading a store message (never stored) ---------- */
  function codesOf(text) {
    const t = String(text || ''), g = new Set(), itms = new Set();
    const norm = x => x.replace(/\s+/g, '').replace(/\((\w+)\)/, (m, a) => '(' + a.toLowerCase() + ')');
    let m; const reG = /Guideline\s+(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?(?:\s*\((?:[a-z]|[ivx]{1,4})\))?)/gi;
    while ((m = reG.exec(t))) g.add(norm(m[1]));
    const reH = /^\s*(\d\.\d{1,2}(?:\.\d{1,2})?(?:\s*\((?:[a-z]|[ivx]{1,4})\))?)\s+[-–—]\s+[A-Z]/gm;
    while ((m = reH.exec(t))) g.add(norm(m[1]));
    const reI = /\bITMS-(\d{5})\b/gi; while ((m = reI.exec(t))) itms.add('ITMS-' + m[1]);
    return { guidelines: [...g].slice(0, 6), itms: [...itms].slice(0, 6) };
  }

  /* Fixed advice table: where advice comes from, so nothing from a letter is ever repeated as advice. English data. */
  const AREAS = {
    '1.2': { t: 'Safety - User-generated content', a: 'If users can post or share content, offer a way to report and block content and users, filter objectionable material and publish contact info.', s: [] },
    '1.5': { t: 'Safety - Developer information', a: 'The Support URL must open a page with a working contact method (for example an email address), not just a marketing page.', s: [] },
    '2.1': { t: 'Performance - App completeness', a: 'Submit a final, working build: every button works, no placeholder content, and the review notes explain how to reach every feature (with a demo account only if login is truly required).', s: ['auth'] },
    '2.3': { t: 'Performance - Accurate metadata', a: 'Make the name, subtitle, keywords, description and screenshots describe only what the app really does, with no prices, other brands or other platforms.', s: [] },
    '2.3.3': { t: 'Accurate metadata - Screenshots', a: 'Screenshots must show the app in use on the right device size (iPad screenshots if the app runs on iPad), not only splash or login screens.', s: ['ipad'] },
    '2.3.7': { t: 'Accurate metadata - Name, subtitle, keywords', a: 'Keep price words ("free") and other apps\' or brands\' names out of the subtitle and keywords.', s: [] },
    '2.3.8': { t: 'Accurate metadata - Age-appropriate', a: 'Icon, screenshots and preview must fit the 4+ audience even if the app has a higher rating.', s: [] },
    '2.3.10': { t: 'Accurate metadata - Other platforms', a: 'Remove mentions of Android, Google Play or other platforms from the listing, screenshots and in-app text shown on iOS.', s: [] },
    '2.5.1': { t: 'Software requirements - Public APIs', a: 'Use only public APIs and frameworks for their intended purpose; remove private or undocumented API calls.', s: [] },
    '2.5.4': { t: 'Software requirements - Background modes', a: 'Declare only the background modes (UIBackgroundModes) the app really uses, and explain each in the review notes.', s: [] },
    '3.1.1': { t: 'Payments - In-app purchase', a: 'Digital content or features must be unlocked with in-app purchase; no links or buttons to outside payment for them.', s: ['billing'], n: 'Purchases: digital features are unlocked only through in-app purchase [or: the app sells no digital content].' },
    '3.1.2': { t: 'Payments - Subscriptions', a: 'Show the subscription price, period and what is included before purchase, with working Terms of Use (EULA) and privacy policy links in the app and the listing.', s: ['billing'] },
    '4.0': { t: 'Design', a: 'Check layout on every supported device size (including iPad if enabled), readable text and no broken or cut-off screens.', s: ['ipad'] },
    '4.2': { t: 'Design - Minimum functionality', a: 'The app must offer real native value beyond a repackaged website; make the core features clear on first launch.', s: [], n: 'Core features: [list the main features and where to find them on first launch].' },
    '4.3': { t: 'Design - Spam', a: 'Avoid near-duplicate apps or templates; make the app clearly different and do not submit several similar apps.', s: [] },
    '4.8': { t: 'Design - Login services', a: 'If the iOS app offers third-party or social login, also offer Sign in with Apple (or an equivalent privacy-focused option).', s: ['thirdPartyLogin'] },
    '5.1.1': { t: 'Privacy - Data collection and storage', a: 'Core features should work without login, every permission prompt needs a clear purpose string, and accounts need in-app deletion.', s: ['auth', 'camera', 'photos', 'location', 'mic', 'contacts'] },
    '5.1.2': { t: 'Privacy - Data use and sharing', a: 'Make tracking declarations match: by default no tracking, non-personalized ads only, PrivacyInfo NSPrivacyTracking=false and App Privacy "No, we do not track". Do not add a tracking prompt just because the app shows ads.', s: ['ads'] },
    '5.1.5': { t: 'Privacy - Location services', a: 'Request location only when a feature needs it, explain why in the purpose string, and do not require it for unrelated features.', s: ['location'] },
    '5.2': { t: 'Legal - Intellectual property', a: 'Use only names, logos, images and content you own or are licensed to use, in the app and the listing.', s: [] },
    '5.3': { t: 'Legal - Gaming, gambling and contests', a: 'Contests or real-money features need official rules and the right legal setup; remove them if not intended.', s: [] },
    '5.6': { t: 'Developer code of conduct', a: 'Keep the listing honest, avoid manipulative reviews or prompts, and respond to the review team through the Resolution Center.', s: [] },
    'ITMS-90683': { t: 'Missing purpose string', a: 'Every permission the app or its SDKs can request needs a clear purpose string in Info.plist (camera, photos, location, microphone, contacts…).', s: ['camera', 'photos', 'location', 'mic', 'contacts'] },
    'ITMS-91053': { t: 'Missing required-reason API declaration', a: 'Declare every required-reason API (file timestamp, UserDefaults, system boot time, disk space…) with an approved reason in PrivacyInfo.xcprivacy.', s: [] },
    'ITMS-91061': { t: 'Missing SDK privacy manifest', a: 'Update third-party SDKs to versions that ship their own privacy manifest and signature.', s: [] },
    'ITMS-90725': { t: 'Outdated SDK / Xcode', a: 'Build with the current Xcode and iOS SDK required by App Store Connect.', s: [] }
  };
  const PLAY = [
    [/background location/i, 'play-background-location', 'Background location', 'Use background location only for a core user-facing feature, show a prominent in-app disclosure first and complete the location declaration.', ['location']],
    [/target (api|sdk) level/i, 'play-target-api', 'Target API level', 'Raise targetSdk to the level Google Play currently requires before uploading a new build.', []],
    [/broken functionality|minimum functionality|crash|does not load|doesn.t work/i, 'play-broken', 'Broken or minimum functionality', 'Test a fresh install on a real device: the app opens, core features work and nothing is a placeholder.', []],
    [/families|children|kids|teacher approved/i, 'play-families', 'Families policy', 'Match the target audience setting, ads SDKs and content to the Families policy; avoid child-directed settings if the app is not for children.', ['ads']],
    [/deceptive|misleading|metadata|impersonat/i, 'play-metadata', 'Metadata / deceptive behavior', 'Make the title, descriptions and graphics describe only what the app does, without other brands or misleading claims.', []],
    [/payments?|billing/i, 'play-payments', 'Payments policy', 'Sell digital content through Google Play Billing and describe prices clearly.', ['billing']],
    [/foreground service/i, 'play-fgs', 'Foreground service permissions', 'Declare only the foreground service types the app really uses and complete the declaration in Play Console.', []],
    [/permission/i, 'play-permissions', 'Permissions policy', 'Request only the permissions the core feature needs, and keep the Play Console declarations in line with the manifest.', ['camera', 'photos', 'location', 'mic', 'contacts']],
    [/account deletion|delete (the|their|an) account/i, 'play-account-deletion', 'Account deletion', 'Offer account deletion in the app and on a web page, and add the web link in Play Console.', ['auth']]
  ];
  const VOCAB = [
    [/\b(sign[- ]?in|log[- ]?in|account|demo account)\b/i, 'auth'], [/\b(google|facebook|social|third[- ]party) (sign[- ]?in|login)\b/i, 'thirdPartyLogin'],
    [/\b(in[- ]app purchase|subscription|payment|purchase)s?\b/i, 'billing'], [/\blocation\b/i, 'location'], [/\bcamera\b/i, 'camera'],
    [/\bphotos?\b/i, 'photos'], [/\bmicrophone\b/i, 'mic'], [/\bcontacts\b/i, 'contacts'], [/\bipad\b/i, 'ipad'],
    [/\b(advertis\w*|ads|admob)\b/i, 'ads'], [/\bapi[ -]?keys?\b/i, 'byok']
  ];
  const areaOf = code => { let c = String(code).replace(/\(.*\)$/, ''); while (c) { if (AREAS[c]) return c; const i = c.lastIndexOf('.'); if (i < 0) break; c = c.slice(0, i); } return null; };

  /* Turn a store message into a generalized lesson draft. Nothing from the message is copied except codes and fixed-vocabulary signals. */
  function parse(text, store) {
    const raw = String(text || ''), st = store === 'play' ? 'play' : 'apple';
    const { guidelines, itms } = codesOf(raw);
    const codes = [...itms, ...guidelines];
    const infoNeeded = st === 'apple' && /information needed/i.test(raw);
    const sig = new Set(); VOCAB.forEach(([re, s]) => { if (re.test(raw)) sig.add(s); });
    let key = null, title = '', advice = '', note = null;
    if (st === 'apple') {
      const first = itms.find(c => AREAS[c]) || guidelines.map(areaOf).find(Boolean) || null;
      if (first) { key = first; const A = AREAS[first]; title = A.t; advice = A.a; note = A.n || null; A.s.forEach(x => sig.add(x)); }
      if (!title && codes.length) { title = 'App Review ' + codes.join(', '); advice = 'Re-read ' + codes.join(', ') + ' in the App Review Guidelines and confirm the app, metadata and review notes meet it before the next submit.'; }
    } else {
      const p = PLAY.find(([re]) => re.test(raw));
      if (p) { key = p[1]; title = p[2]; advice = p[3]; p[4].forEach(x => sig.add(x)); codes.push(p[1]); }
      else {
        const h = raw.match(/Issue found:\s*([A-Za-z][A-Za-z &/-]{2,60}?)\s*(policy|\n|$)/i);
        if (h) { const nm = sanitize(h[1], 60); key = 'play-' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); title = nm + ' policy'; codes.push(key); advice = 'Read the Google Play ' + nm + ' policy and make the app, the listing and the Play Console declarations match it before the next submit.'; }
      }
    }
    if (infoNeeded && !title) { title = 'Information Needed'; advice = 'Answer the reviewer\'s questions in the Resolution Center and put the same explanation in the review notes of the next submit.'; }
    if (!title) { title = st === 'apple' ? 'App Review rejection (no guideline number)' : 'Google Play rejection (no policy name)'; advice = 'Compare the store message with the app, the listing and the review notes, and fix every point it raises before resubmitting.'; }
    const reminder = 'Before submitting: ' + advice.charAt(0).toLowerCase() + advice.slice(1);
    return { store: st, codes: codes.slice(0, 8), area: key, title: sanitize(title, 90), advice: sanitize(advice, 400), reminder: sanitize(reminder, 420),
      review_note: note ? sanitize(note, 240) : null, information_needed: infoNeeded, signals: [...sig].slice(0, 10) };
  }

  /* ---------- lesson database ---------- */
  const empty = () => ({ v: V, lessons: [] });
  function normDb(db) {
    if (!db || typeof db !== 'object' || !Array.isArray(db.lessons)) return empty();
    return { v: V, lessons: db.lessons.filter(x => x && typeof x === 'object' && x.id).slice(0, MAX_LESSONS).map(clean) };
  }
  const arr = (a, n, m) => (Array.isArray(a) ? a : []).map(x => sanitize(x, m || 40)).filter(Boolean).slice(0, n);
  function clean(x) {   // re-sanitize on every load: a hand-edited file is still data only
    return { id: String(x.id).replace(/[^\w.-]/g, '').slice(0, 80), store: x.store === 'play' ? 'play' : 'apple', codes: arr(x.codes, 8, 40), area: x.area ? sanitize(x.area, 40) : null,
      builtin: x.builtin ? String(x.builtin).replace(/[^\w.-]/g, '').slice(0, 40) : null, title: sanitize(x.title, 90), advice: sanitize(x.advice, 400), reminder: sanitize(x.reminder, 420),
      review_note: x.review_note ? sanitize(x.review_note, 240) : null, information_needed: !!x.information_needed, signals: arr(x.signals, 10, 20), fix_plan: arr(x.fix_plan, 6, 300),
      times_seen: Math.max(0, x.times_seen | 0), times_passed_after: Math.max(0, x.times_passed_after | 0),
      first_seen: x.first_seen ? String(x.first_seen).slice(0, 30) : null, last_seen: x.last_seen ? String(x.last_seen).slice(0, 30) : null, last_passed: x.last_passed ? String(x.last_passed).slice(0, 30) : null };
  }
  const words = s => new Set(String(s || '').toLowerCase().split(/[^a-z0-9.]+/).filter(w => w.length > 2));
  function similar(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return false; let i = 0; A.forEach(w => { if (B.has(w)) i++; }); return i / (A.size + B.size - i) >= 0.75; }
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  const keyOf = (store, codes) => store + ':' + [...codes].map(c => c.toLowerCase()).sort().join('|');

  /* Learn from a store message. builtin = id of the matched built-in rejection (its plan stays the answer; we only count it). */
  function learn(db, text, store, builtin, now) {
    db = normDb(db); const at = now || new Date().toISOString();
    const d = parse(text, store);
    if (builtin) {
      const id = 'builtin-' + String(builtin).replace(/[^\w.-]/g, '');
      let L = db.lessons.find(x => x.id === id), created = false;
      if (!L) { L = clean({ id, store: d.store, codes: d.codes, builtin, title: '', advice: '', reminder: '', signals: [], times_seen: 0, first_seen: at }); db.lessons.unshift(L); created = true; }
      L.times_seen++; L.last_seen = at; L.codes = [...new Set([...L.codes, ...d.codes])].slice(0, 8);
      return { db, lesson: L, created, builtin: true };
    }
    const k = keyOf(d.store, d.codes);
    let L = db.lessons.find(x => !x.builtin && x.store === d.store && ((d.codes.length && keyOf(x.store, x.codes) === k) || (d.area && x.area === d.area) || similar(x.title, d.title)));
    if (L) {
      L.times_seen++; L.last_seen = at; L.codes = [...new Set([...L.codes, ...d.codes])].slice(0, 8);
      L.signals = [...new Set([...L.signals, ...d.signals])].slice(0, 10); L.information_needed = L.information_needed || d.information_needed;
      return { db, lesson: L, created: false };
    }
    L = clean({ id: 'lesson-' + d.store + '-' + hash(k + '|' + d.title), ...d, builtin: null, fix_plan: outline(d), times_seen: 1, times_passed_after: 0, first_seen: at, last_seen: at });
    db.lessons.unshift(L);
    if (db.lessons.length > MAX_LESSONS) db.lessons.length = MAX_LESSONS;
    return { db, lesson: L, created: true };
  }
  const outline = d => [d.advice, d.information_needed ? 'Reply to the reviewer in the Resolution Center; a new build may not be needed.' : 'Fix it in the app or the listing, then test a fresh install before uploading.', 'Check this again right before the next submit.'];
  function recordPass(db, ids, now) {
    db = normDb(db); const at = now || new Date().toISOString(); const hit = [];
    for (const id of ids || []) { const L = db.lessons.find(x => x.id === id); if (L) { L.times_passed_after++; L.last_passed = at; hit.push(L); } }
    return { db, lessons: hit };
  }
  function forget(db, id) { db = normDb(db); const n = db.lessons.length; db.lessons = db.lessons.filter(x => x.id !== id); return { db, removed: n !== db.lessons.length }; }
  const compact = L => ({ id: L.id, store: L.store, codes: L.codes, title: L.title || (L.builtin ? 'built-in: ' + L.builtin : ''), builtin: L.builtin || undefined, times_seen: L.times_seen, times_passed_after: L.times_passed_after });
  /* Anonymized export for a human to review later: no project ids, no app identity, no raw text. */
  function exportDb(db) {
    db = normDb(db);
    return { format: 'aaplug2-lessons-export', v: V, note: 'Generalized review lessons learned on this device. No app names, project ids or store messages. Only store, codes and a fixed advice id per lesson are shared with aaplug.com.',
      lessons: db.lessons.map(L => ({ store: L.store, codes: L.codes, area: L.area, builtin: L.builtin, title: L.title, advice: L.advice, reminder: L.reminder, review_note: L.review_note, information_needed: L.information_needed, signals: L.signals, fix_plan: L.fix_plan, times_seen: L.times_seen, times_passed_after: L.times_passed_after })) };
  }

  /* ---------- applying lessons to an app ---------- */
  function signalsOf(A) {
    const s = new Set(), k = (A && A.sdk) || {};
    ['auth', 'billing', 'location', 'camera', 'photos', 'mic', 'contacts', 'ads'].forEach(x => { if (k[x]) s.add(x); });
    if (k.googleSignIn || k.thirdPartyLogin) s.add('thirdPartyLogin');
    if (A && A.ios && A.ios.ipad) s.add('ipad');
    if (A && A.review && A.review.byok) s.add('byok');
    return s;
  }
  const TX = {
    en: { shareNote: 'Lessons are shared anonymously: only the store, guideline / policy codes and a fixed advice id go to aaplug.com — never the store message, app name or IDs.', shareMore: 'What is shared', saved: 'Saved as a lesson on this device. Only anonymized codes went to aaplug.com (no store message, no app name).', fromLocal: 'From your reviews', fromShared: 'From other reviews', sharedWarn: 'Other AA Plug 2 users were rejected for this ({n}×), and this app has related signals ({sig}). Check it before submitting.', sharedRemind: 'Other AA Plug 2 users were rejected for this ({n}×). Check it before submitting.', sharedBuiltin: 'Other AA Plug 2 users were rejected for this ({n}×); AA Plug 2\'s built-in check covers it.', warn: 'Learned from an earlier rejection on this computer, and this app has related signals ({sig}). Check it before submitting.', remind: 'Learned from an earlier rejection on this computer. AA Plug 2 cannot confirm it from the code, so check it yourself before submitting.', passed: 'This check was part of a later approval.', seen: 'seen {n}×', step: 'Checks learned from earlier reviews', stepD: 'Lessons saved on this computer from earlier store reviews. Go through each before the final submit.', builtin: 'An earlier rejection on this computer had this cause; AA Plug 2\'s built-in check covers it.' },
    ko: { shareNote: '교훈은 익명으로 공유돼요. 스토어, 가이드라인·정책 코드, 고정 조언 ID만 aaplug.com에 보내고, 스토어 메시지·앱 이름·ID는 절대 보내지 않아요.', shareMore: '공유되는 내용', saved: '이 기기에 교훈으로 저장했어요. 익명 코드만 aaplug.com에 보냈어요(반려 메시지·앱 이름 제외).', fromLocal: '내 심사에서', fromShared: '다른 사용자 심사에서', sharedWarn: '다른 AA Plug 2 사용자가 이 이유로 반려됐어요({n}회). 이 앱에도 관련 신호({sig})가 있어요. 제출 전에 확인하세요.', sharedRemind: '다른 AA Plug 2 사용자가 이 이유로 반려됐어요({n}회). 제출 전에 확인하세요.', sharedBuiltin: '다른 AA Plug 2 사용자가 이 이유로 반려됐어요({n}회). AA Plug 2 기본 검사에 포함되어 있어요.', warn: '이 컴퓨터의 이전 반려에서 배운 점이에요. 이 앱에도 관련 신호({sig})가 있어요. 제출 전에 확인하세요.', remind: '이 컴퓨터의 이전 반려에서 배운 점이에요. 코드로는 확인할 수 없으니 제출 전에 직접 확인하세요.', passed: '이 확인은 이후 승인에 포함된 적이 있어요.', seen: '{n}회', step: '이전 심사에서 배운 확인 사항', stepD: '이전 스토어 심사에서 이 컴퓨터에 저장한 교훈이에요. 최종 제출 전에 하나씩 확인하세요.', builtin: '이 컴퓨터의 이전 반려 사유예요. AA Plug 2 기본 검사에 포함되어 있어요.' },
    th: { shareNote: 'บทเรียนแชร์แบบไม่ระบุตัวตน: ส่งเฉพาะสโตร์ รหัสแนวทาง / นโยบาย และรหัสคำแนะนำคงที่ไปที่ aaplug.com ไม่ส่งข้อความจากสโตร์ ชื่อแอป หรือ ID', shareMore: 'สิ่งที่แชร์', saved: 'บันทึกเป็นบทเรียนบนอุปกรณ์นี้แล้ว ส่งเฉพาะรหัสแบบไม่ระบุตัวตนไปที่ aaplug.com (ไม่มีข้อความจากสโตร์ ไม่มีชื่อแอป)', fromLocal: 'จากการรีวิวของคุณ', fromShared: 'จากการรีวิวของผู้อื่น', sharedWarn: 'ผู้ใช้ AA Plug 2 คนอื่นถูกปฏิเสธด้วยเหตุนี้ ({n} ครั้ง) และแอปนี้มีสัญญาณที่เกี่ยวข้อง ({sig}) ตรวจสอบก่อนส่ง', sharedRemind: 'ผู้ใช้ AA Plug 2 คนอื่นถูกปฏิเสธด้วยเหตุนี้ ({n} ครั้ง) ตรวจสอบก่อนส่ง', sharedBuiltin: 'ผู้ใช้ AA Plug 2 คนอื่นถูกปฏิเสธด้วยเหตุนี้ ({n} ครั้ง) การตรวจในตัวของ AA Plug 2 ครอบคลุมแล้ว', warn: 'เรียนรู้จากการถูกปฏิเสธครั้งก่อนบนคอมพิวเตอร์เครื่องนี้ และแอปนี้มีสัญญาณที่เกี่ยวข้อง ({sig}) ตรวจสอบก่อนส่ง', remind: 'เรียนรู้จากการถูกปฏิเสธครั้งก่อนบนคอมพิวเตอร์เครื่องนี้ AA Plug 2 ยืนยันจากโค้ดไม่ได้ โปรดตรวจสอบเองก่อนส่ง', passed: 'การตรวจสอบนี้เคยเป็นส่วนหนึ่งของการอนุมัติครั้งต่อมา', seen: '{n} ครั้ง', step: 'สิ่งที่ต้องตรวจจากการรีวิวครั้งก่อน', stepD: 'บทเรียนจากการรีวิวครั้งก่อนที่บันทึกไว้บนคอมพิวเตอร์เครื่องนี้ ตรวจทีละข้อก่อนส่งขั้นสุดท้าย', builtin: 'สาเหตุนี้เคยทำให้ถูกปฏิเสธบนคอมพิวเตอร์เครื่องนี้ การตรวจในตัวของ AA Plug 2 ครอบคลุมแล้ว' },
    zh: { shareNote: '经验以匿名方式共享：只向 aaplug.com 发送商店、准则 / 政策代码和固定建议 ID，绝不发送商店消息、应用名称或 ID。', shareMore: '共享哪些内容', saved: '已作为经验保存在此设备上。只有匿名代码发送到 aaplug.com（不含商店消息和应用名称）。', fromLocal: '来自你的审核', fromShared: '来自其他人的审核', sharedWarn: '其他 AA Plug 2 用户因此被拒（{n} 次），而且此应用有相关迹象（{sig}）。提交前请检查。', sharedRemind: '其他 AA Plug 2 用户因此被拒（{n} 次）。提交前请检查。', sharedBuiltin: '其他 AA Plug 2 用户因此被拒（{n} 次）；AA Plug 2 的内置检查已覆盖。', warn: '从这台电脑上之前的拒绝中学到的，而且此应用有相关迹象（{sig}）。提交前请检查。', remind: '从这台电脑上之前的拒绝中学到的。AA Plug 2 无法从代码确认，请在提交前自行检查。', passed: '此项检查曾是之后一次通过审核的一部分。', seen: '{n} 次', step: '从之前审核中学到的检查项', stepD: '这台电脑上保存的之前商店审核的经验。最终提交前逐项检查。', builtin: '这台电脑上之前的拒绝原因；AA Plug 2 的内置检查已覆盖。' },
    hi: { shareNote: 'सबक गुमनाम रूप से साझा होते हैं: केवल स्टोर, गाइडलाइन / नीति कोड और एक तय सलाह ID aaplug.com को जाते हैं — स्टोर संदेश, ऐप का नाम या ID कभी नहीं।', shareMore: 'क्या साझा होता है', saved: 'इस डिवाइस पर सबक के रूप में सहेजा गया। केवल गुमनाम कोड aaplug.com को भेजे गए (स्टोर संदेश और ऐप का नाम नहीं)।', fromLocal: 'आपकी समीक्षाओं से', fromShared: 'दूसरों की समीक्षाओं से', sharedWarn: 'दूसरे AA Plug 2 उपयोगकर्ता इस कारण अस्वीकृत हुए ({n} बार), और इस ऐप में इससे जुड़े संकेत ({sig}) हैं। सबमिट करने से पहले जाँचें।', sharedRemind: 'दूसरे AA Plug 2 उपयोगकर्ता इस कारण अस्वीकृत हुए ({n} बार)। सबमिट करने से पहले जाँचें।', sharedBuiltin: 'दूसरे AA Plug 2 उपयोगकर्ता इस कारण अस्वीकृत हुए ({n} बार); AA Plug 2 की बिल्ट-इन जाँच इसे कवर करती है।', warn: 'इस कंप्यूटर पर पिछली अस्वीकृति से सीखा गया, और इस ऐप में इससे जुड़े संकेत ({sig}) हैं। सबमिट करने से पहले जाँचें।', remind: 'इस कंप्यूटर पर पिछली अस्वीकृति से सीखा गया। AA Plug 2 कोड से इसकी पुष्टि नहीं कर सकता, इसलिए सबमिट करने से पहले खुद जाँचें।', passed: 'यह जाँच बाद की एक मंज़ूरी का हिस्सा रही है।', seen: '{n} बार', step: 'पिछली समीक्षाओं से सीखी जाँचें', stepD: 'पिछली स्टोर समीक्षाओं से इस कंप्यूटर पर सहेजे सबक। अंतिम सबमिट से पहले हर एक जाँचें।', builtin: 'इस कंप्यूटर पर पिछली अस्वीकृति का यही कारण था; AA Plug 2 की बिल्ट-इन जाँच इसे कवर करती है।' }
  };
  const tx = (l, k, v) => { let s = (TX[nl(l)] || TX.en)[k] || TX.en[k]; if (v) s = s.replace(/\{(\w+)\}/g, (m, x) => (v[x] != null ? v[x] : m)); return s; };

  /* Lessons that apply to this app. Learned lessons are warnings when signals match, otherwise pre-submit reminders. Never must-fix. */
  function relevant(db, A, stores, lang) {
    db = normDb(db); const sig = signalsOf(A), out = [];
    const on = s => (!stores || stores[s]) && (s === 'apple' ? !!(A && A.ios) : !!(A && A.android));
    for (const L of db.lessons) {
      if (!on(L.store)) continue;
      if (L.builtin) { out.push({ id: L.id, store: L.store, codes: L.codes, builtin: L.builtin, level: 'reminder', times_seen: L.times_seen, times_passed_after: L.times_passed_after, why: tx(lang, 'builtin') }); continue; }
      const hit = L.signals.filter(x => sig.has(x));
      out.push({ id: L.id, store: L.store, codes: L.codes, title: L.title, level: hit.length ? 'warning' : 'reminder', why: hit.length ? tx(lang, 'warn', { sig: hit.join(', ') }) : tx(lang, 'remind'),
        check: L.reminder, review_note: L.review_note || undefined, times_seen: L.times_seen, times_passed_after: L.times_passed_after, passed_note: L.times_passed_after ? tx(lang, 'passed') : undefined });
    }
    return out.sort((a, b) => (a.builtin ? 1 : 0) - (b.builtin ? 1 : 0) || (a.level === 'warning' ? -1 : 0) - (b.level === 'warning' ? -1 : 0) || b.times_seen - a.times_seen);
  }
  /* Extra lines for the English App Review notes: only fixed-table notes of lessons with matching signals. */
  function reviewNoteLines(rel) { return [...new Set(rel.filter(r => r.store === 'apple' && r.level === 'warning' && r.review_note).map(r => r.review_note))].slice(0, 4); }

  /* Fix plan for a learned rejection, in the user's language (advice itself is English table data). */
  const PLAN = {
    en: ['The store cited {codes}: {title}.', 'What to check: {advice}', 'Fix it in the app, the listing or the review notes, then test a fresh install before uploading.', 'If it is "Information Needed", reply in the Resolution Center; a new build may not be needed.', 'Saved as a lesson on this computer: AA Plug 2 will remind you before your next submits. Only the anonymized codes were shared with aaplug.com to improve checks for everyone; the store message and app name stay here.'],
    ko: ['스토어가 지적한 항목 {codes}: {title}.', '확인할 것: {advice}', '앱·스토어 정보·심사 메모에서 고친 뒤, 새로 설치해 확인하고 업로드하세요.', '"정보 필요(Information Needed)"라면 Resolution Center에 답장하세요. 새 빌드가 필요 없을 수도 있어요.', '이 컴퓨터에 교훈으로 저장했어요. 다음 제출 전에 AA Plug 2가 알려 드려요. 모든 사용자의 검사를 개선하도록 익명 코드만 aaplug.com에 공유했어요. 스토어 메시지와 앱 이름은 여기 남아요.'],
    th: ['สโตร์อ้างถึง {codes}: {title}', 'สิ่งที่ต้องตรวจ: {advice}', 'แก้ในแอป ข้อมูลสโตร์ หรือบันทึกถึงผู้ตรวจ แล้วทดสอบติดตั้งใหม่ก่อนอัปโหลด', 'หากเป็น "Information Needed" ให้ตอบใน Resolution Center อาจไม่ต้องใช้บิลด์ใหม่', 'บันทึกเป็นบทเรียนบนคอมพิวเตอร์เครื่องนี้แล้ว AA Plug 2 จะเตือนก่อนส่งครั้งต่อไป แชร์เฉพาะรหัสแบบไม่ระบุตัวตนกับ aaplug.com เพื่อปรับปรุงการตรวจสำหรับทุกคน ข้อความจากสโตร์และชื่อแอปยังอยู่ที่นี่'],
    zh: ['商店指出的条款 {codes}：{title}。', '需要检查：{advice}', '在应用、商店信息或审核备注中修正，然后全新安装测试后再上传。', '如果是“Information Needed”，请在 Resolution Center 回复；可能不需要新构建。', '已作为经验保存在这台电脑上：之后提交前 AA Plug 2 会提醒你。只有匿名代码与 aaplug.com 共享，用于改进所有人的检查；商店消息和应用名称留在这里。'],
    hi: ['स्टोर ने {codes} का हवाला दिया: {title}।', 'क्या जाँचें: {advice}', 'ऐप, लिस्टिंग या रिव्यू नोट्स में ठीक करें, फिर अपलोड से पहले नए इंस्टॉल पर जाँचें।', 'अगर यह "Information Needed" है, तो Resolution Center में जवाब दें; नया बिल्ड शायद ज़रूरी न हो।', 'इस कंप्यूटर पर सबक के रूप में सहेजा गया: अगली बार सबमिट से पहले AA Plug 2 याद दिलाएगा। सबके लिए जाँच बेहतर करने को केवल गुमनाम कोड aaplug.com के साथ साझा किए गए; स्टोर संदेश और ऐप का नाम यहीं रहते हैं।']
  };
  function planFor(L, lang) {
    const p = PLAN[nl(lang)] || PLAN.en, v = { codes: L.codes.length ? L.codes.join(', ') : '—', title: L.title, advice: L.advice };
    return p.filter((x, i) => i !== 3 || L.information_needed).map(s => s.replace(/\{(\w+)\}/g, (m, k) => v[k]));
  }
  /* English reply draft with placeholders. The user edits and sends it; AA Plug 2 never replies to a store. */
  function replyFor(L, app) {
    const team = L.store === 'play' ? 'Google Play team' : 'App Review team', c = L.codes.length ? ' regarding ' + L.codes.join(', ') : '';
    return `Hello ${team},\n\nThank you for reviewing ${app || 'our app'}${c}. We have addressed the issue: [describe exactly what you changed].${L.information_needed ? '\n\n[Answer each question from the message here.]' : ' A new build has been uploaded.'}\n\nBest regards`;
  }

  /* Built-in matching with a guard: when the message cites guideline numbers that are outside a built-in's area,
     the loose keyword match (for example "log in" in a 4.8 letter) is not trusted and the message is learned instead. */
  const BUILTIN_AREAS = { 'apple-91064': ['2.1', '5.1'], 'apple-21-att': ['2.1', '5.1'], 'apple-21a-launch': ['2.1'], 'apple-15-support': ['1.5'], 'apple-237': ['2.3'], 'apple-info-byok': ['2.1', '3.1'], 'apple-21-demo': ['2.1', '5.1.1'], 'apple-511': ['5.1.1'] };
  const under = (c, p) => c === p || c.startsWith(p + '.') || c.startsWith(p + '(');
  function builtinFits(id, text) {
    const g = codesOf(text).guidelines, a = BUILTIN_AREAS[id];
    return !a || !g.length || g.some(c => a.some(p => under(c, p)));
  }
  function matchKnown(text, store) {
    const G = window.AAPGen; if (!G) return null; const t = String(text || '');
    const ok = r => r.match.test(t) && builtinFits(r.id, t);
    return G.REJECTIONS.find(r => (!store || r.store === store) && ok(r)) || G.REJECTIONS.find(ok) || null;
  }


  /* ---------- shared lessons (0.1.4) ----------
     What leaves the device after a real (non-demo) learned review result: { v, event, store, codes, advice_id } and nothing else.
     codes match fixed patterns (App Review guideline numbers, ITMS-#####, or a fixed Google Play policy id from the table above);
     advice_id is a key of the fixed tables below. No letter text, app name, bundle / package id, project id, e-mail, URL or path.
     The shared feed is read back the same way: only codes, advice ids and counts are trusted; titles and advice always
     come from this file's own tables, never from the server. Shared lessons are reminders or warnings, never must-fix. */
  const SHARE_URL = 'https://aaplug.com/api/lessons';
  const PLAY_IDS = PLAY.map(p => p[1]);
  const BUILTIN_IDS = ['apple-91064', 'apple-21-att', 'apple-21a-launch', 'apple-15-support', 'apple-237', 'apple-info-byok', 'apple-21-demo', 'play-photo', 'play-datasafety', 'apple-511'];
  const GENERIC = {
    'apple-codes': { store: 'apple', t: 'App Review guideline', a: 'Re-read the cited guideline numbers in the App Review Guidelines and confirm the app, metadata and review notes meet them before the next submit.', s: [] },
    'apple-info-needed': { store: 'apple', t: 'Information Needed', a: 'Answer the reviewer\'s questions in the Resolution Center and put the same explanation in the review notes of the next submit.', s: [] }
  };
  const RE_GUIDE = /^\d{1,2}\.\d{1,2}(\.\d{1,2})?(\((?:[a-z]|[ivx]{1,4})\))?$/, RE_ITMS = /^ITMS-\d{5}$/;
  const codeOk = (store, c) => typeof c === 'string' && c.length <= 16 && (store === 'apple' ? (RE_GUIDE.test(c) || RE_ITMS.test(c)) : PLAY_IDS.includes(c));
  /* Every advice id the shared feed knows, with the store it belongs to and the fixed English title / advice / signals. */
  function shareTable() {
    const T = {};
    Object.entries(AREAS).forEach(([k, A]) => { T[k] = { store: 'apple', title: A.t, advice: A.a, signals: A.s }; });
    PLAY.forEach(p => { T[p[1]] = { store: 'play', title: p[2], advice: p[3], signals: p[4] }; });
    Object.entries(GENERIC).forEach(([k, A]) => { T[k] = { store: A.store, title: A.t, advice: A.a, signals: A.s }; });
    BUILTIN_IDS.forEach(id => { T['builtin-' + id] = { store: id.startsWith('play-') ? 'play' : 'apple', builtin: id }; });
    return T;
  }
  const TABLE = shareTable();
  /* Strict check of a payload (same rules as the server). Returns a clean copy or null. Unknown fields → null. */
  function validShare(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    const allowed = ['v', 'event', 'store', 'codes', 'advice_id'];
    if (Object.keys(p).some(k => !allowed.includes(k))) return null;
    if (p.v !== undefined && p.v !== 1) return null;
    const event = p.event === undefined ? 'rejected' : p.event;
    if (event !== 'rejected' && event !== 'passed') return null;
    if (p.store !== 'apple' && p.store !== 'play') return null;
    const E = TABLE[p.advice_id]; if (typeof p.advice_id !== 'string' || !E || E.store !== p.store) return null;
    if (!Array.isArray(p.codes) || p.codes.length > 6 || !p.codes.every(c => codeOk(p.store, c))) return null;
    const codes = [...new Set(p.codes)].sort();
    if (p.advice_id === 'apple-codes' && !codes.length) return null;
    return { v: 1, event, store: p.store, codes, advice_id: p.advice_id };
  }
  /* Anonymized payload for one local lesson, or null when it cannot be expressed with fixed table ids
     (for example a Google Play policy name read from the letter: that stays on this device only). */
  function sharePayload(L, event) {
    if (!L || typeof L !== 'object') return null;
    const store = L.store === 'play' ? 'play' : 'apple';
    let advice_id = null;
    if (L.builtin) advice_id = 'builtin-' + L.builtin;
    else if (L.area && TABLE[L.area] && TABLE[L.area].store === store) advice_id = L.area;
    else if (store === 'apple' && (L.codes || []).some(c => codeOk('apple', c))) advice_id = 'apple-codes';
    else if (store === 'apple' && L.information_needed) advice_id = 'apple-info-needed';
    if (!advice_id) return null;
    const codes = (L.codes || []).filter(c => codeOk(store, c)).slice(0, 6);
    return validShare({ v: 1, event: event || 'rejected', store, codes, advice_id });
  }
  /* Clean a feed from the server. Text from the server is ignored; title / advice come from TABLE. */
  function normShared(feed) {
    const list = feed && Array.isArray(feed.lessons) ? feed.lessons : [];
    const out = [];
    for (const x of list.slice(0, 300)) {
      if (!x || typeof x !== 'object' || x.advice_id === 'test') continue;
      const p = validShare({ store: x.store, codes: Array.isArray(x.codes) ? x.codes : [], advice_id: x.advice_id });
      if (!p) continue;
      const count = Math.min(1e6, Math.max(0, Math.floor(Number(x.count) || 0))); if (!count) continue;
      const passed = Math.min(count, Math.max(0, Math.floor(Number(x.passed) || 0)));
      const last = typeof x.last_seen === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x.last_seen) ? x.last_seen.slice(0, 10) : null;
      out.push({ store: p.store, codes: p.codes, advice_id: p.advice_id, count, passed, last_seen: last });
    }
    return out;
  }
  const sharedKey = x => x.store + ':' + x.advice_id;
  /* Shared lessons that apply to this app, labeled as coming from other people's reviews. Lessons this device already
     learned (same store + advice id) are left out so the local one is shown. Warnings only when signals match. */
  function relevantShared(items, A, stores, lang, db, max) {
    const sig = signalsOf(A), mine = new Set();
    normDb(db).lessons.forEach(L => { const p = sharePayload(L); if (p) mine.add(sharedKey(p)); });
    const on = s => (!stores || stores[s]) && (s === 'apple' ? !!(A && A.ios) : !!(A && A.android));
    const merged = new Map();
    for (const x of items || []) {
      if (!on(x.store) || mine.has(sharedKey(x))) continue;
      const k = sharedKey(x), m = merged.get(k);
      if (m) { m.count += x.count; m.passed += x.passed; m.codes = [...new Set([...m.codes, ...x.codes])].sort().slice(0, 8); if ((x.last_seen || '') > (m.last_seen || '')) m.last_seen = x.last_seen; }
      else merged.set(k, { ...x, codes: x.codes.slice() });
    }
    const out = [];
    for (const x of merged.values()) {
      const E = TABLE[x.advice_id], n = x.count;
      if (E.builtin) { out.push({ id: 'shared-' + x.advice_id, source: 'shared', store: x.store, codes: x.codes, builtin: E.builtin, level: 'reminder', times_seen: n, times_passed_after: x.passed, from: tx(lang, 'fromShared'), why: tx(lang, 'sharedBuiltin', { n }) }); continue; }
      const hit = E.signals.filter(s => sig.has(s));
      const title = x.advice_id === 'apple-codes' && x.codes.length ? 'App Review ' + x.codes.join(', ') : E.title;
      out.push({ id: 'shared-' + x.advice_id, source: 'shared', store: x.store, codes: x.codes, title, level: hit.length ? 'warning' : 'reminder', from: tx(lang, 'fromShared'),
        why: hit.length ? tx(lang, 'sharedWarn', { n, sig: hit.join(', ') }) : tx(lang, 'sharedRemind', { n }),
        check: 'Before submitting: ' + E.advice.charAt(0).toLowerCase() + E.advice.slice(1), times_seen: n, times_passed_after: x.passed, last_seen: x.last_seen || undefined });
    }
    return out.sort((a, b) => (a.builtin ? 1 : 0) - (b.builtin ? 1 : 0) || (a.level === 'warning' ? -1 : 0) - (b.level === 'warning' ? -1 : 0) || b.times_seen - a.times_seen).slice(0, max || 8);
  }
  /* Local lessons first ("from your reviews"), then shared ones ("from other reviews"). */
  function mergeRelevant(local, shared, lang) {
    return [...(local || []).map(r => ({ ...r, source: 'local', from: tx(lang, 'fromLocal') })), ...(shared || [])];
  }

  window.AAPLessons = { matchKnown, builtinFits, V, KEY: 'aaplug2.lessons.v1', sanitize, codesOf, parse, empty, normDb, learn, recordPass, forget, compact, exportDb, signalsOf, relevant, reviewNoteLines, planFor, replyFor, tx, AREAS,
    SHARE_URL, TABLE, validShare, sharePayload, normShared, relevantShared, mergeRelevant };
})();
