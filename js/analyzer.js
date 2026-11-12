/* AA Plug 2 — 프로젝트 정적 분석 (매니페스트·gradle·Info.plist·strings·README 등)
   네트워크·API 키 없이 브라우저 안에서만 동작한다. */
(function () {
  'use strict';
  const PLAY_TARGET = 36;          // 2026-08-31부터 신규 앱·업데이트 targetSdk 36 이상 (Play Console 도움말)
  const IOS_SDK_NOTE = 26;         // 2026-04부터 iOS 26 SDK(Xcode 26)로 빌드해야 업로드 가능

  const find = (files, re) => Object.keys(files).filter(p => re.test(p) && files[p].text != null);
  const shortest = arr => arr.slice().sort((a, b) => a.length - b.length)[0];
  const txt = (files, p) => (p && files[p] && files[p].text) || '';

  function parseXml(s) { try { const d = new DOMParser().parseFromString(s, 'application/xml'); return d.querySelector('parsererror') ? null : d; } catch (e) { return null; } }
  function aAttr(el, name) { return el.getAttribute('android:' + name) ?? el.getAttributeNS('http://schemas.android.com/apk/res/android', name); }

  function parseStrings(s) {
    const out = {}; const d = parseXml(s); if (!d) return out;
    d.querySelectorAll('string').forEach(n => { out[n.getAttribute('name')] = n.textContent.replace(/\\'/g, "'").replace(/\\n/g, '\n').trim(); });
    return out;
  }
  function parsePlist(s) {
    const out = {}; const d = parseXml(s); if (!d) return out;
    const dict = d.querySelector('plist > dict'); if (!dict) return out;
    const kids = [...dict.children];
    for (let i = 0; i < kids.length; i++) if (kids[i].tagName === 'key') {
      const v = kids[i + 1]; if (!v) continue;
      out[kids[i].textContent] = v.tagName === 'string' ? v.textContent : v.tagName === 'true' ? true : v.tagName === 'false' ? false : v.tagName === 'array' ? [...v.children].map(c => c.textContent) : v.textContent;
    }
    return out;
  }
  function gradleVal(g, key) {
    const m = g.match(new RegExp('\\b' + key + '(?:Version)?\\s*(?:=|\\s)\\s*(?:Integer\\.parseInt\\()?["\']?([\\w.\\-]+)["\']?')); return m ? m[1] : null;
  }
  function gradleDeps(g) {
    const out = []; const re = /(?:implementation|api|kapt|ksp)\s*\(?\s*(?:platform\()?\s*["']([^"']+)["']/g; let m;
    while ((m = re.exec(g))) out.push(m[1]);
    const re2 = /(?:implementation|api)\s*\(\s*libs\.([\w.]+)/g; while ((m = re2.exec(g))) out.push('libs.' + m[1]);
    return out;
  }
  function readme(s) {
    if (!s) return { title: '', summary: '', features: [] };
    const lines = s.split(/\r?\n/);
    const title = ((lines.find(l => /^#\s+/.test(l)) || '').replace(/^#\s+/, '')).replace(/[*_`]/g, '').trim();
    let summary = ''; let i = lines.findIndex(l => /^#\s+/.test(l)) + 1;
    for (; i < lines.length; i++) { const l = lines[i].trim(); if (!l) { if (summary) break; continue; } if (/^[#!\[<|-]/.test(l)) { if (summary) break; continue; } summary += (summary ? ' ' : '') + l; }
    const features = []; let inF = false;
    for (const l of lines) {
      if (/^#+\s*(features?|기능|주요 기능|ฟีเจอร์)/i.test(l)) { inF = true; continue; }
      if (inF && /^#+\s/.test(l)) break;
      if (inF && /^\s*[-*]\s+/.test(l)) features.push(l.replace(/^\s*[-*]\s+/, '').replace(/[*_`]/g, '').trim());
    }
    return { title, summary: summary.replace(/[*_`]/g, ''), features: features.slice(0, 8) };
  }
  const has = (hay, re) => re.test(hay);

  const CATS = {
    finance: /budget|expense|ledger|money|receipt|spending|finance|wallet|가계부|예산|지출|영수증|งบ|รายจ่าย|ใบเสร็จ/i,
    health: /health|fitness|workout|step|sleep|water|diet|calorie|건강|운동|수면|สุขภาพ|ออกกำลัง/i,
    education: /learn|study|quiz|vocab|lesson|course|flashcard|공부|학습|단어|เรียน/i,
    productivity: /todo|task|note|calendar|planner|reminder|memo|할 ?일|메모|일정|โน้ต|งาน/i,
    photography: /photo|camera|filter|edit image|사진|ภาพถ่าย/i,
    travel: /travel|trip|map|route|hotel|flight|여행|เที่ยว/i,
    food: /recipe|food|restaurant|menu|cafe|coffee|요리|음식|메뉴|อาหาร/i,
    shopping: /shop|store|cart|deal|coupon|쇼핑|ร้านค้า/i,
    tools: /calculator|scanner|converter|utility|qr|flashlight|계산기|도구|เครื่องคิดเลข/i,
    games: /game|puzzle|score|level|게임|เกม/i,
    lifestyle: /lifestyle|diary|habit|daily|일기|습관|ไลฟ์สไตล์/i
  };

  function analyze(project) {
    const F = project.files; const P = Object.keys(F);
    const A = { name: project.name, source: project.source, fileCount: project.fileCount || P.length, read: [], android: null, ios: null, framework: 'unknown', platforms: { android: false, ios: false }, strings: {}, names: {}, sdk: {}, issues: [] };
    const note = p => p && A.read.push(p);

    // ---------- 프레임워크 ----------
    const pubspec = shortest(find(F, /(^|\/)pubspec\.yaml$/)), pkgJson = shortest(find(F, /(^|\/)package\.json$/)), appJson = shortest(find(F, /(^|\/)app\.json$/)), capCfg = shortest(find(F, /capacitor\.config\.(json|ts|js)$/));
    const pkg = (() => { try { return JSON.parse(txt(F, pkgJson)); } catch (e) { return null; } })();
    const deps = pkg ? Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }) : [];
    if (pubspec) A.framework = 'flutter';
    else if (deps.includes('expo')) A.framework = 'expo';
    else if (deps.includes('react-native')) A.framework = 'react-native';
    else if (capCfg || deps.some(d => d.startsWith('@capacitor/'))) A.framework = 'capacitor';
    [pubspec, pkgJson, appJson, capCfg].forEach(note);

    // ---------- Android ----------
    const manifests = find(F, /AndroidManifest\.xml$/).filter(p => !/(debug|test|androidTest)\//.test(p));
    const manPath = manifests.find(p => /app\/src\/main\//.test(p)) || shortest(manifests.filter(p => /src\/main\//.test(p))) || shortest(manifests);
    const gradles = find(F, /\.gradle(\.kts)?$/);
    const appGradle = gradles.find(p => /com\.android\.application|id\s*\(?["']com\.android\.application/.test(F[p].text)) || gradles.find(p => /(^|\/)app\/build\.gradle/.test(p));
    let expo = null; try { expo = appJson ? (JSON.parse(txt(F, appJson)).expo || null) : null; } catch (e) { }
    if (manPath || appGradle || (expo && expo.android)) {
      A.platforms.android = true; if (A.framework === 'unknown') A.framework = 'android-native';
      const an = { permissions: [], features: [], activities: [], deps: [], cleartext: false, debuggable: false, allowBackup: null, adId: false, adsAppId: null };
      if (manPath) {
        note(manPath); const d = parseXml(F[manPath].text);
        if (d) {
          an.manifestPackage = d.documentElement.getAttribute('package');
          d.querySelectorAll('uses-permission, uses-permission-sdk-23').forEach(n => an.permissions.push(aAttr(n, 'name')));
          d.querySelectorAll('uses-feature').forEach(n => an.features.push(aAttr(n, 'name')));
          d.querySelectorAll('activity').forEach(n => an.activities.push(aAttr(n, 'name')));
          const app = d.querySelector('application');
          if (app) { an.label = aAttr(app, 'label'); an.cleartext = aAttr(app, 'usesCleartextTraffic') === 'true'; an.debuggable = aAttr(app, 'debuggable') === 'true'; an.allowBackup = aAttr(app, 'allowBackup'); an.iconRef = aAttr(app, 'icon'); }
          d.querySelectorAll('meta-data').forEach(n => { if (/ads\.APPLICATION_ID/.test(aAttr(n, 'name') || '')) an.adsAppId = aAttr(n, 'value'); });
        }
      }
      if (appGradle) {
        note(appGradle); const g = F[appGradle].text;
        an.pkg = gradleVal(g, 'applicationId'); an.namespace = gradleVal(g, 'namespace');
        an.minSdk = +gradleVal(g, 'minSdk') || null; an.targetSdk = +gradleVal(g, 'targetSdk') || null; an.compileSdk = +gradleVal(g, 'compileSdk') || null;
        an.versionCode = gradleVal(g, 'versionCode'); an.versionName = gradleVal(g, 'versionName'); an.deps = gradleDeps(g); an.gradlePath = appGradle;
        an.gradleKts = /\.kts$/.test(appGradle);
      }
      const toml = shortest(find(F, /libs\.versions\.toml$/)); if (toml) { note(toml); an.deps.push(...(F[toml].text.match(/module\s*=\s*"([^"]+)"/g) || []).map(s => s.replace(/.*"([^"]+)"/, '$1'))); }
      if (toml) { // libs.versions.targetSdk 같은 버전 카탈로그 값 풀기
        const tv = F[toml].text; const ver = k => { const m = tv.match(new RegExp('^\\s*' + k.replace(/[.\-]/g, '[.\\-_]?') + '\\s*=\\s*"?(\\d+)"?', 'mi')); return m ? +m[1] : null; };
        for (const k of ['minSdk', 'targetSdk', 'compileSdk']) if (!an[k] && appGradle) { const m = F[appGradle].text.match(new RegExp(k + '(?:Version)?\\s*=?\\s*libs\\.versions\\.([\\w.]+?)\\.get')); const v = m ? ver(m[1]) : ver(k) || ver(k.replace('Sdk', '-sdk')) || ver(k.replace('Sdk', '_sdk')); if (v) an[k] = v; }
      }
      if (expo && expo.android) { an.pkg = an.pkg || expo.android.package; an.permissions.push(...(expo.android.permissions || [])); an.versionCode = an.versionCode || expo.android.versionCode; }
      an.pkg = an.pkg || an.manifestPackage || an.namespace || null;
      an.permissions = [...new Set(an.permissions.filter(Boolean).map(p => p.startsWith('android.permission.') || p.includes('.') ? p : 'android.permission.' + p))];
      an.adId = an.permissions.includes('com.google.android.gms.permission.AD_ID');
      an.manifestPath = manPath;
      A.android = an;
    }

    // ---------- iOS ----------
    const plists = find(F, /(^|\/)Info\.plist$/).filter(p => !/(Tests?|Pods|\.framework)\//.test(p));
    const plistPath = plists.find(p => /ios\/Runner\//.test(p)) || shortest(plists);
    const pbx = shortest(find(F, /project\.pbxproj$/));
    if (plistPath || pbx || (expo && expo.ios)) {
      A.platforms.ios = true; if (A.framework === 'unknown' || A.framework === 'android-native') A.framework = A.platforms.android ? A.framework : 'ios-native';
      const io = { usage: {}, plistPath };
      if (plistPath) { note(plistPath); const pl = parsePlist(F[plistPath].text); io.plist = pl; io.displayName = pl.CFBundleDisplayName || pl.CFBundleName; for (const k in pl) if (/^NS\w+UsageDescription$/.test(k)) io.usage[k] = String(pl[k] || ''); io.gad = pl.GADApplicationIdentifier || null; }
      if (pbx) { note(pbx); const t = F[pbx].text; const g = k => (t.match(new RegExp(k + '\\s*=\\s*"?([^";]+)"?;')) || [])[1] || null; io.bundleId = g('PRODUCT_BUNDLE_IDENTIFIER'); io.version = g('MARKETING_VERSION'); io.build = g('CURRENT_PROJECT_VERSION'); io.deployment = g('IPHONEOS_DEPLOYMENT_TARGET'); }
      if (expo && expo.ios) { io.bundleId = io.bundleId || expo.ios.bundleIdentifier; Object.assign(io.usage, expo.ios.infoPlist || {}); }
      io.privacyManifest = !!find(F, /PrivacyInfo\.xcprivacy$/).length;
      io.appleSignIn = find(F, /\.entitlements$/).some(p => /applesignin/.test(F[p].text));
      A.ios = io;
    }

    // ---------- 문자열·이름 ----------
    find(F, /res\/values(-[\w+-]+)?\/strings\.xml$/).forEach(p => {
      if (/(debug|test)\//.test(p)) return; note(p);
      const q = (p.match(/values-([\w+-]+)\//) || [])[1]; const lang = q ? q.replace(/^b\+/, '').split(/[-+]r?/)[0] : 'default';
      A.strings[lang] = Object.assign(A.strings[lang] || {}, parseStrings(F[p].text));
    });
    find(F, /lib\/l10n\/.*\.arb$/).forEach(p => { note(p); try { const lang = (p.match(/_(\w+)\.arb$/) || [])[1] || 'default'; const j = JSON.parse(F[p].text); A.strings[lang] = Object.assign(A.strings[lang] || {}, Object.fromEntries(Object.entries(j).filter(([k]) => !k.startsWith('@')))); } catch (e) { } });
    const def = A.strings.default || A.strings.en || {};
    const labelRef = A.android && A.android.label;
    const labelKey = labelRef && labelRef.startsWith('@string/') ? labelRef.slice(8) : 'app_name';
    for (const [lang, s] of Object.entries(A.strings)) if (s[labelKey]) A.names[lang === 'default' ? 'en' : lang] = s[labelKey];
    if (labelRef && !labelRef.startsWith('@')) A.names.en = labelRef;
    const rm = readme(txt(F, shortest(find(F, /(^|\/)README(\.md)?$/i)))); if (rm.title) note(shortest(find(F, /(^|\/)README(\.md)?$/i)));
    A.readme = rm;
    A.appName = A.names.en || (A.ios && A.ios.displayName) || (expo && expo.name) || (pkg && (pkg.displayName || pkg.name)) || rm.title || project.name;
    if (!A.names.en) A.names.en = A.appName;
    A.tagline = { };
    for (const [lang, s] of Object.entries(A.strings)) { const t = s.tagline || s.app_tagline || s.slogan || s.app_description; if (t) A.tagline[lang === 'default' ? 'en' : lang] = t; }
    if (!A.tagline.en && project.meta && project.meta.description) A.tagline.en = project.meta.description;
    if (!A.tagline.en && rm.summary) A.tagline.en = rm.summary.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
    A.locales = [...new Set(Object.keys(A.strings).map(l => l === 'default' ? 'en' : l))];
    A.pkg = (A.android && A.android.pkg) || (A.ios && A.ios.bundleId) || null;
    A.version = (A.android && A.android.versionName) || (A.ios && A.ios.version) || (pkg && pkg.version) || '1.0.0';

    // ---------- 연락처 ----------
    const lic = txt(F, shortest(find(F, /(^|\/)LICENSE/i)));
    const holder = (lic.match(/Copyright\s*(?:\(c\)|©)?\s*\d{4}(?:-\d{4})?\s+(.+)/i) || [])[1];
    const allText = Object.values(F).filter(v => v.text).map(v => v.text).join('\n').slice(0, 600000);
    const email = (allText.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).find(e => !/noreply|example\.com|users\.noreply|android\.com|apple\.com|googlegroups/.test(e));
    A.developer = { name: (holder || (project.meta && project.meta.owner) || '').trim() || null, email: email || null, policyFound: !!find(F, /privacy[^/]*\.(md|html)$/i).length };

    // ---------- SDK ----------
    const hay = [(A.android && A.android.deps.join(' ')) || '', deps.join(' '), txt(F, pubspec), txt(F, shortest(find(F, /Podfile$/))), txt(F, plistPath), (A.android && A.android.permissions.join(' ')) || '', JSON.stringify((A.ios && A.ios.usage) || {})].join(' ');
    A.sdk = {
      ads: has(hay, /play-services-ads|google_mobile_ads|google-mobile-ads|admob|Google-Mobile-Ads|GADApplicationIdentifier|applovin|unity-ads|audience-network/i) || !!(A.android && A.android.adsAppId),
      analytics: has(hay, /firebase-analytics|firebase_analytics|\/analytics|FirebaseAnalytics|amplitude|mixpanel/i),
      crash: has(hay, /crashlytics|sentry|bugsnag/i),
      auth: has(hay, /firebase-auth|firebase_auth|play-services-auth|google_sign_in|google-signin|auth0|supabase|credentials-play-services|googleid/i),
      googleSignIn: has(hay, /play-services-auth|google_sign_in|google-signin|googleid/i),
      cloudDb: has(hay, /firestore|firebase-database|firebase_database|supabase|realm/i),
      billing: has(hay, /billing|in_app_purchase|react-native-iap|revenuecat|purchases/i),
      location: has(hay, /LOCATION|play-services-location|geolocator|NSLocation/i),
      camera: has(hay, /permission\.CAMERA|camera-camera2|camerax|NSCameraUsageDescription|image_picker|expo-camera/i),
      ocr: has(hay, /text-recognition|mlkit|vision/i),
      photos: has(hay, /READ_MEDIA_IMAGES|READ_EXTERNAL_STORAGE|NSPhotoLibrary/i),
      notifications: has(hay, /POST_NOTIFICATIONS|firebase-messaging|firebase_messaging|notifications/i),
      localDb: has(hay, /room-runtime|sqflite|realm|sqlite|coredata|hive/i),
      contacts: has(hay, /READ_CONTACTS|NSContacts/i),
      mic: has(hay, /RECORD_AUDIO|NSMicrophone/i)
    };
    A.sdk.appleSignIn = !!(A.ios && A.ios.appleSignIn) || has(hay, /sign_in_with_apple|apple-authentication/i);

    // ---------- 카테고리 ----------
    const corpus = [rm.title, rm.summary, rm.features.join(' '), ...Object.values(def), ...Object.values(A.tagline), A.pkg || ''].join(' ');
    const scores = Object.entries(CATS).map(([k, re]) => [k, (corpus.match(new RegExp(re.source, 'gi')) || []).length]).sort((a, b) => b[1] - a[1]);
    A.categories = scores.filter(s => s[1] > 0).map(s => s[0]);
    if (A.sdk.ocr) A.categories = A.categories.filter(c => c !== 'photography');
    if (!A.categories.length) A.categories = ['tools'];
    if (!A.categories.includes('productivity')) A.categories.push('productivity');
    A.categories = A.categories.slice(0, 3);

    // ---------- 그림 ----------
    const imgs = P.filter(p => F[p].dataUrl);
    const iconPath = imgs.find(p => /playstore/i.test(p)) || imgs.find(p => /AppIcon.*1024/i.test(p)) || imgs.find(p => /mipmap-xxxhdpi\/ic_launcher\./i.test(p)) || imgs.find(p => /ic_launcher\./i.test(p)) || imgs.find(p => /AppIcon/i.test(p)) || imgs.find(p => /(^|\/)(icon|app-icon|appicon|logo)\.png$/i.test(p));
    A.icon = iconPath ? { path: iconPath, dataUrl: F[iconPath].dataUrl } : null;
    A.screenshots = imgs.filter(p => /(screenshots?|phoneScreenshots|store)\//i.test(p)).sort().slice(0, 8).map(p => ({ path: p, dataUrl: F[p].dataUrl }));
    const colors = txt(F, shortest(find(F, /res\/values\/colors\.xml$/)));
    const cm = colors.match(/name="(?:brand|primary|colorPrimary|purple_500|accent)[^"]*"\s*>\s*#(?:FF)?([0-9a-f]{6})\b/i) || colors.match(/#(?:FF)?([0-9a-f]{6})\b/i);
    A.brandColor = cm ? '#' + cm[1].toLowerCase() : null;

    A.issues = checks(A);
    const blocks = A.issues.filter(i => i.sev === 'block').length, warns = A.issues.filter(i => i.sev === 'warn').length;
    A.readiness = Math.max(18, Math.min(96, 100 - blocks * 9 - warns * 4 - (A.icon ? 0 : 6) - (A.screenshots.length ? 0 : 6)));
    return A;
  }

  /* ---------- 검수 규칙: id·심각도·플랫폼·수정안 종류 (문구는 i18n 'iss.<id>.*') ---------- */
  function checks(A) {
    const out = []; const add = (id, sev, plat, fix, vars) => out.push({ id, sev, plat, fix: fix || null, vars: vars || {} });
    const an = A.android, io = A.ios, s = A.sdk;
    if (an) {
      if (!an.targetSdk || an.targetSdk < PLAY_TARGET) add('targetSdk', 'block', 'android', 'patch-gradle', { cur: an.targetSdk || '—', need: PLAY_TARGET });
      if (an.debuggable) add('debuggable', 'block', 'android', 'patch-manifest-debug');
      if (an.cleartext) add('cleartext', 'warn', 'android', 'patch-manifest-cleartext');
      if (an.permissions.some(p => /READ_MEDIA_IMAGES|READ_MEDIA_VIDEO/.test(p))) add('photoPerm', 'warn', 'android', 'patch-manifest-photo');
      if (an.permissions.some(p => /ACCESS_BACKGROUND_LOCATION/.test(p))) add('bgLocation', 'block', 'android', 'declare');
      if (an.permissions.some(p => /READ_SMS|RECEIVE_SMS|READ_CALL_LOG|PROCESS_OUTGOING_CALLS/.test(p))) add('smsCall', 'block', 'android', 'declare');
      if (an.permissions.some(p => /QUERY_ALL_PACKAGES|MANAGE_EXTERNAL_STORAGE|REQUEST_INSTALL_PACKAGES/.test(p))) add('specialPerm', 'block', 'android', 'declare');
      if (an.permissions.some(p => /FOREGROUND_SERVICE/.test(p))) add('fgs', 'warn', 'android', 'declare');
      if (s.ads || an.adId) add('adsDeclare', 'warn', 'android', 'declare');
      add('closedTest', 'tip', 'android', 'info', { testers: 12, days: 14 });
    }
    if (s.auth) add('accountDeletion', 'block', 'both', 'gen-deletion');
    if (!A.developer.policyFound) add('privacyPolicy', 'block', 'both', 'gen-privacy');
    if (io) {
      for (const [k, v] of Object.entries(io.usage)) if (!String(v).trim()) add('emptyUsage', 'block', 'ios', 'patch-plist', { key: k });
      if (s.camera && !io.usage.NSCameraUsageDescription) add('missingUsage', 'block', 'ios', 'patch-plist', { key: 'NSCameraUsageDescription' });
      if (!io.privacyManifest) add('privacyManifest', 'block', 'ios', 'gen-xcprivacy');
      if ((s.ads || io.gad) && !io.usage.NSUserTrackingUsageDescription) add('att', 'warn', 'ios', 'choose-att');
      if (s.googleSignIn && !s.appleSignIn) add('loginOption', 'warn', 'ios', 'choose-login');
      if (s.auth) add('demoAccount', 'tip', 'both', 'info');
      add('iosSdk', 'tip', 'ios', 'info', { sdk: IOS_SDK_NOTE });
    }
    if (!A.icon) add('noIcon', 'warn', 'both', 'gen-icon');
    if (!A.screenshots.length) add('noShots', 'warn', 'both', 'info');
    if (A.appName && A.appName.length > 30) add('longName', 'warn', 'both', 'choose-name', { len: A.appName.length });
    const order = { block: 0, warn: 1, tip: 2 };
    return out.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  window.AAPAnalyzer = { analyze, PLAY_TARGET };
})();
