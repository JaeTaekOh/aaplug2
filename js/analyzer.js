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
  /* 0.1.5: resolve SDK levels that point at a variable (rootProject.ext.targetSdkVersion, variables.gradle, gradle.properties).
     Returns a number, or null when the value cannot actually be read (for example flutter.targetSdkVersion). */
  function resolveSdk(raw, F, gradles) {
    if (raw == null) return null;
    if (/^\d+$/.test(raw)) return +raw;
    if (/^flutter\./.test(raw)) return null;
    const name = String(raw).replace(/^(rootProject\.ext\.|project\.ext\.|rootProject\.|project\.|ext\.)/, '').replace(/\.get$/, '');
    if (!/^[A-Za-z_][\w]*$/.test(name)) return null;
    const re = new RegExp('(?:^|[\\s{;.,(])' + name + '\\s*(?:=|:)?\\s*["\']?(\\d{2})\\b', 'm');
    const texts = gradles.map(p => F[p].text).concat(find(F, /(^|\/)gradle\.properties$/).map(p => F[p].text));
    for (const t of texts) { const m = t.match(re); if (m) return +m[1]; }
    return null;
  }
  const LISTING_LANG = l => { const x = String(l).toLowerCase(); return x.startsWith('en') ? 'en' : x.startsWith('ko') ? 'ko' : x.startsWith('th') ? 'th' : x.startsWith('zh') ? 'zh' : x.startsWith('hi') ? 'hi' : null; };
  /* 0.1.5: evidence that the app already has a store listing (store URLs, fastlane metadata, version history) and existing listing copy. */
  function listingOf(F, A) {
    const P = Object.keys(F), texts = P.filter(p => F[p].text != null && !F[p].code), all = texts.map(p => F[p].text).join('\n').slice(0, 800000);
    const L = { play: { evidence: [], copy: {} }, apple: { evidence: [], copy: {} }, privacyUrl: null, supportUrl: null };
    const pm = all.match(/play\.google\.com\/store\/apps\/details\?id=([\w.]+)/i);
    if (pm) { L.play.evidence.push('play-url'); L.play.url = 'https://play.google.com/store/apps/details?id=' + pm[1]; }
    const am = all.match(/(?:apps|itunes)\.apple\.com\/[^\s"'<>)]*?\/?id(\d{6,12})/i);
    if (am) { L.apple.evidence.push('apple-url'); L.apple.appId = am[1]; L.apple.url = 'https://apps.apple.com/app/id' + am[1]; }
    const rd = (p) => (F[p] && F[p].text || '').trim();
    for (const p of texts) {
      let m = p.match(/(?:^|\/)fastlane\/metadata\/android\/([^/]+)\/(title|short_description|full_description)\.txt$/i);
      if (m) { const l = LISTING_LANG(m[1]); if (l && rd(p)) { (L.play.copy[l] = L.play.copy[l] || {})[{ title: 'title', short_description: 'short', full_description: 'full' }[m[2].toLowerCase()]] = rd(p); } continue; }
      m = p.match(/(?:^|\/)fastlane\/metadata\/(?!android\/)([^/]+)\/(name|subtitle|description|keywords|privacy_url|support_url)\.txt$/i);
      if (m) {
        const k = m[2].toLowerCase(), v = rd(p);
        if (k === 'privacy_url' && /^https?:\/\//.test(v)) { L.privacyUrl = L.privacyUrl || v; continue; }
        if (k === 'support_url' && /^https?:\/\//.test(v)) { L.supportUrl = L.supportUrl || v; continue; }
        const l = LISTING_LANG(m[1]); if (l && v) (L.apple.copy[l] = L.apple.copy[l] || {})[k] = v;
      }
    }
    if (Object.keys(L.play.copy).length) L.play.evidence.push('fastlane-play');
    if (Object.keys(L.apple.copy).length) L.apple.evidence.push('fastlane-apple');
    if (P.some(p => /(^|\/)fastlane\/(Deliverfile|metadata\/review_information)/i.test(p))) L.apple.evidence.push('fastlane-deliver');
    if (P.some(p => /(^|\/)fastlane\/metadata\/android\/[^/]+\/changelogs\//i.test(p))) L.play.evidence.push('play-changelogs');
    const vc = A.android && +A.android.versionCode; if (vc >= 2) L.play.weak = 'versionCode ' + vc;
    const bn = A.ios && +A.ios.build; if (bn >= 2) L.apple.weak = 'build ' + bn;
    if (!L.privacyUrl) { const u = (all.match(/https?:\/\/[^\s"'<>)\]]*privacy[^\s"'<>)\]]*/gi) || []).find(x => !/(apple|google|firebase|android|admob|policies\.google)\.com|developer\.|example\.|<your-site>/i.test(x)); if (u) L.privacyUrl = u.replace(/[.,;]+$/, ''); }
    L.play.langs = Object.keys(L.play.copy); L.apple.langs = Object.keys(L.apple.copy);
    return L;
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
        an.targetSdkRaw = gradleVal(g, 'targetSdk');
        an.minSdk = resolveSdk(gradleVal(g, 'minSdk'), F, gradles); an.targetSdk = resolveSdk(an.targetSdkRaw, F, gradles); an.compileSdk = resolveSdk(gradleVal(g, 'compileSdk'), F, gradles);
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
      if (pbx) { const fam = (F[pbx].text.match(/TARGETED_DEVICE_FAMILY\s*=\s*"?([\d,]+)"?;/g) || []).join(' '); io.ipad = /[",=\s]2\b/.test(fam); }
      if (io.plist) { if (io.plist['UISupportedInterfaceOrientations~ipad']) io.ipad = true; if (io.plist.ITSAppUsesNonExemptEncryption !== undefined) io.encryption = io.plist.ITSAppUsesNonExemptEncryption; }
      if (expo && expo.ios) {
        io.bundleId = io.bundleId || expo.ios.bundleIdentifier; const ip = expo.ios.infoPlist || {};
        for (const k in ip) if (/^NS\w+UsageDescription$/.test(k)) io.usage[k] = String(ip[k] || '');
        if (ip.ITSAppUsesNonExemptEncryption !== undefined) io.encryption = ip.ITSAppUsesNonExemptEncryption;
        if (expo.ios.config && expo.ios.config.usesNonExemptEncryption !== undefined) io.encryption = expo.ios.config.usesNonExemptEncryption;
        if (expo.ios.supportsTablet) io.ipad = true;
      }
      const xps = find(F, /PrivacyInfo\.xcprivacy$/);
      io.privacyManifest = !!xps.length;
      if (xps.length) {
        const xpPath = xps.find(p => /(^|\/)ios\//.test(p)) || shortest(xps), xt = F[xpPath].text, xpl = parsePlist(xt);
        io.xcprivacy = { path: xpPath, tracking: xpl.NSPrivacyTracking === true ? true : xpl.NSPrivacyTracking === false ? false : null,
          domains: Array.isArray(xpl.NSPrivacyTrackingDomains) ? xpl.NSPrivacyTrackingDomains.map(x => String(x).trim()).filter(Boolean) : [],
          types: [...new Set(xt.match(/NSPrivacyCollectedDataType(?!Linked|Tracking|Purpose|s\b)[A-Za-z]+/g) || [])] };
      }
      io.appleSignIn = find(F, /\.entitlements$/).some(p => /applesignin/.test(F[p].text));
      io.carplayEntitlement = find(F, /\.entitlements$/).some(p => /com\.apple\.developer\.carplay/.test(F[p].text));
      io.deploymentNum = io.deployment ? parseFloat(io.deployment) : null;
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
    const allText = Object.values(F).filter(v => v.text && !v.code).map(v => v.text).join('\n').slice(0, 600000);
    const email = (allText.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).find(e => !/noreply|example\.com|users\.noreply|android\.com|apple\.com|googlegroups/.test(e));
    A.listing = listingOf(F, A);
    A.developer = { name: (holder || (project.meta && project.meta.owner) || '').trim() || null, email: email || null, policyFound: !!find(F, /privacy[^/]*\.(md|html)$/i).length || !!A.listing.privacyUrl, privacyUrl: A.listing.privacyUrl || null };

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
    A.sdk.appleSignIn = !!(A.ios && A.ios.appleSignIn) || has(hay, /sign_in_with_apple|apple-authentication|AuthenticationServices|ASAuthorizationAppleIDProvider|appleAuth|AppleAuthProvider/i);
    A.sdk.thirdPartyLogin = A.sdk.googleSignIn || has(hay, /flutter_facebook_auth|facebook-login|FBSDKLoginKit|react-native-fbsdk|kakao[\w.-]*(login|user|auth)|kakao_flutter_sdk|naveridlogin|flutter_naver_login|line-sdk|LineSDK|flutter_line_sdk|twitter_login|react-native-app-auth/i);
    A.review = reviewSignals(A, F, hay);

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

  /* ---------- App review signals from code and metadata (general App Store review lessons) ---------- */
  function reviewSignals(A, F, hay) {
    const codeP = Object.keys(F).filter(p => F[p].code);
    const code = codeP.map(p => F[p].text).join('\n').slice(0, 4000000);
    const any = code + '\n' + hay;
    const io = A.ios, R = {};
    // Ads: non-personalized requests (npa=1) and remote on/off flags
    R.npa = /["']npa["']\s*[:,=\]]\s*["']?1|\bnpa\s*=\s*["']?1|nonPersonalizedAds\s*:\s*true|requestNonPersonalizedAdsOnly\s*:\s*true|setRequestNonPersonalizedAdsOnly|NonPersonalized(Ads)?\s*=\s*true/i.test(code);
    R.remoteAds = !!A.sdk.ads && (/firebase[-_]?remote[-_]?config|remoteConfig|RemoteConfig/.test(any) && /(ads?_?enabled|show_?ads|enable_?ads|ad_?flag|ads_?on)/i.test(code));
    // Tracking: ATT usage string, ATT request in code, PrivacyInfo, App Store Connect usesIdfa
    R.attString = !!(io && io.usage.NSUserTrackingUsageDescription && String(io.usage.NSUserTrackingUsageDescription).trim());
    R.attCode = /requestTrackingAuthorization|ATTrackingManager|AppTrackingTransparency\.|app_tracking_transparency|expo-tracking-transparency|react-native-tracking-transparency|requestTrackingPermissionsAsync|requestTrackingAuthorizationWithCompletionHandler/.test(any);
    const allMeta = Object.keys(F).filter(p => F[p].text != null && !F[p].code).map(p => F[p].text).join('\n');
    R.usesIdfa = /usesIdfa["']?\s*[:=]\s*true/i.test(allMeta + code) ? true : /usesIdfa["']?\s*[:=]\s*false/i.test(allMeta + code) ? false : null;
    const xp = io && io.xcprivacy;
    R.manifestTracking = !!(xp && xp.tracking === true);
    R.trackingDomains = xp ? xp.domains.length : 0;
    // Secret storage: Keychain (or a cross-platform plugin that uses it on iOS) vs Android-only storage
    R.iosKeychain = /Keychain|kSecClass|SecItemAdd|SecItemCopyMatching|flutter_secure_storage|expo-secure-store|react-native-keychain|react-native-encrypted-storage|KeychainAccess|SAMKeychain|capacitor-secure-storage|@aparajita\/capacitor-secure-storage|secure_storage|KeychainSwift/i.test(any);
    R.androidOnlySecrets = /encrypted_shared_preferences|EncryptedSharedPreferences|androidx\.security[:.]security-crypto|MasterKey(s)?\.Builder|AndroidKeyStore/.test(any);
    // User-supplied AI API keys (bring your own key)
    const ai = /generativelanguage\.googleapis|google_generative_ai|@google\/generative-ai|@google\/genai|aistudio\.google|GenerativeModel\(|api\.openai\.com|\bopenai\b|api\.anthropic\.com|anthropic|dart_openai|langchain/i.test(any);
    const keyEntry = /(enter|paste|your|user'?s?|own)\s+(\w+\s+)?api[\s_-]?key|api[\s_-]?key\s*(field|input|setting|controller|textfield)|apiKey(Controller|Field|Input|TextField|Setting)|setApiKey|saveApiKey|byok|bring your own key|API ?키|คีย์ API|API 密钥|API कुंजी/i.test(any + '\n' + JSON.stringify(A.strings || {}));
    R.byok = ai && keyEntry;
    // Login gate: the first screen is a sign-in screen (core features may need login, Guideline 5.1.1(v))
    R.loginGate = /initialRoute\s*:\s*['"]\/?(login|signin|sign-in|auth|welcome-login)['"]|startDestination\s*=\s*["'](login|signin|sign_in|auth)["']|home\s*:\s*(const\s+)?(Login|SignIn|Auth)\w*(Screen|Page|View)\b|initialRouteName\s*=\s*["'](Login|SignIn|Auth)\w*["']|rootViewController\s*=\s*(Login|SignIn)\w*|WindowGroup\s*\{\s*(Login|SignIn)\w*View/.test(code) || /(requires?|must)\s+(a\s+)?(log ?in|sign[ -]?in)|login (is )?required|sign[- ]in (is )?required/i.test((A.readme && A.readme.summary) || '');
    // Location: does code send coordinates to a server?
    R.locationSent = codeP.some(p => { const t = F[p].text; return /latitude|longitude|GeoPoint|CLLocation|LatLng/.test(t) && /firestore|collection\(|\.setData\(|\bfetch\(|axios|http\.post|\bdio\b|Retrofit|URLSession|HttpClient/.test(t); });
    // CarPlay
    R.carplay = /CPTemplateApplicationScene|CPInterfaceController|import\s+CarPlay|flutter_carplay|react-native-carplay|CPTemplateApplicationSceneSessionRoleApplication/.test(any);
    // Store metadata in the repo (fastlane): iOS = fastlane/metadata/<locale>/, Android = fastlane/metadata/android/
    const meta = Object.keys(F).filter(p => /fastlane\/metadata\//i.test(p) && F[p].text != null);
    const iosMeta = meta.filter(p => !/fastlane\/metadata\/android\//i.test(p));
    const field = (list, re) => list.filter(p => re.test(p)).map(p => ({ path: p, text: F[p].text }));
    const FREE = /\bfree\b|무료|ฟรี|免费|免費|मुफ़्त|मुफ्त|फ्री/i, BRANDS = /\b(google|android|iphone|ipad|apple|app store|play store|facebook|instagram|whatsapp|tiktok|youtube|chatgpt|gemini)\b/i;
    R.freeInMeta = field(iosMeta, /(subtitle|keywords)\.txt$/i).filter(x => FREE.test(x.text) || BRANDS.test(x.text)).map(x => x.path);
    R.androidInIosMeta = field(iosMeta, /(description|subtitle|keywords|promotional_text|release_notes|name)\.txt$/i).filter(x => /android|android auto|google play/i.test(x.text)).map(x => x.path);
    R.adsInCopy = field(meta, /(description|subtitle|keywords|promotional_text|release_notes|title|short_description|full_description|changelogs\/[^/]+)\.txt$/i)
      .filter(x => /\b(ads?|advert\w*|admob|banner ads?)\b|광고|โฆษณา|广告|विज्ञापन/i.test(x.text)).map(x => x.path);
    const supUrl = field(iosMeta, /support_url\.txt$/i).map(x => x.text.trim()).find(Boolean);
    R.supportUrl = supUrl || null;
    R.supportUrlHome = !!supUrl && /^https?:\/\/[^/]+\/?(index\.html?)?$/i.test(supUrl);
    const sup = Object.keys(F).filter(p => /(^|\/)(support|contact)([^/]*\.(md|html?)|\/index\.(md|html?))$/i.test(p) && F[p].text != null && !F[p].code);
    R.supportPage = sup[0] || null;
    R.supportNoContact = sup.length > 0 && !sup.some(p => /mailto:|[\w.+-]+@[\w-]+\.[\w.]+|<form\b|tel:|wa\.me|line\.me|m\.me\//i.test(F[p].text));
    return R;
  }

  /* ---------- 검수 규칙: id·심각도·플랫폼·수정안 종류 (문구는 i18n 'iss.<id>.*') ---------- */
  function checks(A) {
    const out = []; const add = (id, sev, plat, fix, vars) => out.push({ id, sev, plat, fix: fix || null, vars: vars || {} });
    const an = A.android, io = A.ios, s = A.sdk;
    if (an) {
      /* Only a value that was actually read can block. An unread value ("—") is a warning to check, never a must-fix. */
      if (an.targetSdk && an.targetSdk < PLAY_TARGET) add('targetSdk', 'block', 'android', 'patch-gradle', { cur: an.targetSdk, need: PLAY_TARGET });
      else if (!an.targetSdk) add('targetSdkUnread', 'warn', 'android', 'info', { raw: an.targetSdkRaw || '—', need: PLAY_TARGET });
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
    const R = A.review || {};
    if (s.auth) add('accountDeletion', 'block', 'both', 'gen-deletion');
    if (!A.developer.policyFound) add('privacyPolicy', 'block', 'both', 'gen-privacy');
    // Support URL: a page where an official contact method is visible right away (Guideline 1.5)
    if (R.supportNoContact) add('supportNoContact', 'block', 'both', 'info', { file: R.supportPage });
    if (R.supportUrlHome) add('supportUrlHome', 'warn', io ? 'ios' : 'both', 'info', { url: R.supportUrl });
    if (!A.developer.email) add('supportContact', 'warn', 'both', 'info');
    if (R.adsInCopy && R.adsInCopy.length) add('adsInCopy', 'warn', 'both', 'info', { files: R.adsInCopy.join(', ') });
    if (io) {
      for (const [k, v] of Object.entries(io.usage)) if (!String(v).trim()) add('emptyUsage', 'block', 'ios', 'patch-plist', { key: k });
      if (s.camera && !io.usage.NSCameraUsageDescription) add('missingUsage', 'block', 'ios', 'patch-plist', { key: 'NSCameraUsageDescription' });
      if (!io.privacyManifest) add('privacyManifest', 'block', 'ios', 'gen-xcprivacy');
      /* Tracking: ATT usage string, ATT prompt in code, PrivacyInfo (NSPrivacyTracking + domains), the App Privacy form and
         runtime ad requests must tell one story from the first submit. Default and recommended: no tracking + npa=1.
         Never recommend "has ads → add ATT". */
      const tr = tracking(A);
      if (tr.state === 'mixed') {
        add('trackingMismatch', 'block', 'ios', 'choose-tracking', { found: tr.found.join(', '), missing: tr.missing.join(', ') });
        if (R.manifestTracking && !R.trackingDomains) add('itms91064', 'block', 'ios', 'info');
        if (R.attString && !R.attCode) add('attNoPrompt', 'block', 'ios', 'info');
      } else if (tr.state === 'tracking') add('trackingAligned', 'warn', 'ios', 'info');
      else if ((s.ads || io.gad) && !R.npa) add('adsNpa', 'warn', 'ios', 'choose-tracking');
      else if (s.ads || io.gad) add('adsNpaOk', 'tip', 'ios', 'info');
      if (R.remoteAds) add('remoteAds', 'warn', 'both', 'info');
      if (s.thirdPartyLogin && !s.appleSignIn) add('loginOption', 'block', 'ios', 'choose-login');
      if (s.auth && R.loginGate) add('loginGate', 'warn', 'ios', 'info');
      if (s.auth) add('demoAccount', 'tip', 'ios', 'info');
      if (R.androidOnlySecrets && !R.iosKeychain) add('iosSecretStorage', 'block', 'ios', 'info');
      if (R.byok) add('byok', 'warn', 'ios', 'info');
      if (io.encryption === undefined && io.plistPath) add('encryption', 'warn', 'ios', 'patch-plist-encryption');
      if (io.ipad) add('ipadShots', 'warn', 'ios', 'info');
      if (R.carplay && !io.carplayEntitlement) add('carplay', 'warn', 'ios', 'info');
      if (R.freeInMeta && R.freeInMeta.length) add('freeInMeta', 'warn', 'ios', 'info', { files: R.freeInMeta.join(', ') });
      if (R.androidInIosMeta && R.androidInIosMeta.length) add('androidInIosCopy', 'warn', 'ios', 'info', { files: R.androidInIosMeta.join(', ') });
      if (io.deploymentNum && io.deploymentNum < 15) add('iosDeployment', 'tip', 'ios', 'info', { cur: io.deployment });
      add('iosSdk', 'tip', 'ios', 'info', { sdk: IOS_SDK_NOTE });
    }
    if (!A.icon) add('noIcon', 'warn', 'both', 'gen-icon');
    if (!A.screenshots.length) add('noShots', 'warn', 'both', 'info');
    if (A.appName && A.appName.length > 30) add('longName', 'warn', 'both', 'choose-name', { len: A.appName.length });
    const order = { block: 0, warn: 1, tip: 2 };
    return out.sort((a, b) => order[a.sev] - order[b.sev]);
  }

  /* Tracking state of the iOS app: 'none' (no tracking anywhere), 'tracking' (ATT string + ATT prompt + PrivacyInfo tracking + domains
     all present) or 'mixed' (some but not all — the state that causes ITMS-91064 or a Guideline 2.1 rejection). */
  function tracking(A) {
    const R = A.review || {};
    const parts = [['NSUserTrackingUsageDescription', !!R.attString], ['ATT prompt in code', !!R.attCode], ['NSPrivacyTracking=true', !!R.manifestTracking], ['NSPrivacyTrackingDomains', R.trackingDomains > 0]];
    if (R.usesIdfa === true || R.usesIdfa === false) parts.push(['usesIdfa=true', R.usesIdfa === true]);
    const found = parts.filter(p => p[1]).map(p => p[0]), missing = parts.filter(p => !p[1]).map(p => p[0]);
    const state = !found.length ? 'none' : !missing.length ? 'tracking' : 'mixed';
    return { state, found, missing };
  }

  window.AAPAnalyzer = { analyze, tracking, PLAY_TARGET };
})();
