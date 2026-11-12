/* AA Plug 2 — App Store review lessons tests (in-process, local fixture projects).
   Covers: no ATT recommendation for non-personalized ads, ATT / PrivacyInfo / tracking mismatch, aligned tracking kept,
   support URL without contact, third-party login without Sign in with Apple, Android-only secret storage on iOS,
   privacy labels (on-device location, no grouping), BYOK review notes, login gate, store-copy rules, encryption key,
   iPad screenshots, Information Needed handling.
   Run: node test/lessons.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aaplug2-lessons-'));
process.env.AAPLUG2_HOME = HOME;
process.env.AAPLUG2_LESSONS_API = 'http://127.0.0.1:9/api/lessons';   // never production in tests
const E = await import('../lib/engine.mjs');
let pass = 0, failN = 0;
const check = (cond, name, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); } };

const plist = (entries) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${entries}\n</dict>\n</plist>\n`;
const kv = (k, v) => `  <key>${k}</key>\n  ${v === true ? '<true/>' : v === false ? '<false/>' : Array.isArray(v) ? `<array>${v.map(x => `<string>${x}</string>`).join('')}</array>` : `<string>${v}</string>`}`;
const PBX = (family = '1') => `// !$*UTF8*$!\n{ buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.demo; MARKETING_VERSION = 1.0.0; CURRENT_PROJECT_VERSION = 1; IPHONEOS_DEPLOYMENT_TARGET = 15.0; TARGETED_DEVICE_FAMILY = "${family}"; }; }\n`;
const BASE_PLIST = [kv('CFBundleDisplayName', 'Demo Tool'), kv('ITSAppUsesNonExemptEncryption', false)];
const README = '# Demo Tool\n\nA simple calculator and unit converter utility.\n\nContact: help@demo-tool.example\n';
const PRIVACY = '<html><body>Privacy policy</body></html>';

let n = 0;
function project(files) {
  const dir = path.join(HOME, 'fx-' + (++n)); fs.mkdirSync(dir, { recursive: true });
  const all = { 'README.md': README, 'docs/privacy.html': PRIVACY, 'ios/Runner.xcodeproj/project.pbxproj': PBX(), ...files };
  for (const [p, c] of Object.entries(all)) { if (c == null) continue; const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return dir;
}
async function connect(files) { const { st } = await E.connect({ source: 'path', path: project(files) }, { allowPath: true }); return st; }
const ids = st => st.A.issues.map(i => i.id);
const dec = (st) => E.decisions(st, 'en', false).decisions;
const allOptionValues = st => dec(st).flatMap(d => d.options.map(o => JSON.stringify(o.value)));
const findField = (steps, id, re) => { const s = steps.find(x => x.id === id); return s && s.fields.find(f => re.test(f.label)); };
async function finish(st, choices = []) {
  E.decide(st, { choices }, 'en');
  /* These checks are about the first-submit path: the user answers "not submitted yet" for any store stage still open. */
  const stages = dec(st).filter(d => d.key.startsWith('stage:') && !d.decided).map(d => ({ key: d.key, value: 'not_submitted' }));
  if (stages.length) E.decide(st, { choices: stages }, 'en');
  E.decide(st, { accept_all_recommended: true }, 'en');
  const G = await E.generate(st, {}, { allowPath: true });
  return { G, guide: E.guide(st, 'apple', 'en'), st };
}
const read = (G, f) => fs.readFileSync(path.join(G.folder, f), 'utf8');

try {
  console.log('\n[1] Ads with non-personalized requests (npa=1), no tracking anywhere');
  let st = await connect({
    'ios/Runner/Info.plist': plist([...BASE_PLIST, kv('GADApplicationIdentifier', 'ca-app-pub-0000000000000000~0000000000')].join('\n')),
    'ios/Podfile': "pod 'Google-Mobile-Ads-SDK'",
    'ios/Runner/PrivacyInfo.xcprivacy': plist([kv('NSPrivacyTracking', false), '  <key>NSPrivacyTrackingDomains</key><array/>'].join('\n')),
    'ios/Runner/AdsManager.swift': 'let extras = Extras(); extras.additionalParameters = ["npa": "1"]'
  });
  check(st.A.review.npa === true && ids(st).includes('adsNpaOk') && !ids(st).some(i => /tracking|att|adsNpa$/i.test(i)), 'npa=1 detected → aligned no-tracking path, no tracking decision', ids(st));
  check(!allOptionValues(st).some(v => /"att"|"track"/.test(v)), 'no option offers ATT or tracking');
  let F = await finish(st);
  check(/No, we do not track/.test(findField(F.guide.steps, 'a-privacy', /tracking/i).value), 'App Privacy guide: "No, we do not track"');
  check(F.G.data_safety.every(r => r.tracking === false), 'data safety: nothing marked "used for tracking"', F.G.data_safety);
  check(/non-personalized/i.test(read(F.G, 'policy/privacy-policy-en.html')), 'privacy policy: short factual non-personalized ads line');
  check(!/\b(ads?|advert\w*|admob)\b/i.test(JSON.stringify(F.G.listing)), 'store listing (description, subtitle, keywords) never mentions ads');

  console.log('\n[2] Ads without npa and without ATT → recommend npa, never "add ATT"');
  st = await connect({
    'ios/Runner/Info.plist': plist([...BASE_PLIST, kv('GADApplicationIdentifier', 'ca-app-pub-0000000000000000~0000000000')].join('\n')),
    'ios/Podfile': "pod 'Google-Mobile-Ads-SDK'"
  });
  let d = dec(st).find(x => x.key === 'fix:adsNpa');
  check(d && d.recommended === 'npa' && d.options.map(o => o.value).join() === 'npa,later', 'adsNpa decision: options npa / later, npa recommended', d && d.options);
  check(!allOptionValues(st).some(v => /"att"|"track"/.test(v)) && !/add ATT|ATT text/i.test(JSON.stringify(d.options)), 'no ATT option, no "add ATT" text in options');
  check(!ids(st).includes('att'), 'old "att" check is gone');
  F = await finish(st);
  const xp = read(F.G, 'ios/PrivacyInfo.xcprivacy');
  check(/<key>NSPrivacyTracking<\/key><false\/>/.test(xp) && /<key>NSPrivacyTrackingDomains<\/key><array\/>/.test(xp), 'generated PrivacyInfo: NSPrivacyTracking=false, empty domains');
  check(/npa/.test(read(F.G, 'fixes/aaplug2-fixes.diff')) && !/NSUserTrackingUsageDescription<\/key>\n\+/.test(read(F.G, 'fixes/aaplug2-fixes.diff')), 'code fix: npa=1 on ad requests, never adds NSUserTrackingUsageDescription');
  check(/does not track/.test(F.G.app_review_notes) && F.G.app_privacy_tracking === 'No, we do not track', 'review notes + App Privacy answer: no tracking');

  console.log('\n[3] Mixed tracking declaration (ATT string, no prompt, NSPrivacyTracking=true, empty domains)');
  st = await connect({
    'ios/Runner/Info.plist': plist([...BASE_PLIST, kv('GADApplicationIdentifier', 'ca-app-pub-0000000000000000~0000000000'), kv('NSUserTrackingUsageDescription', 'Used to show ads')].join('\n')),
    'ios/Podfile': "pod 'Google-Mobile-Ads-SDK'",
    'ios/Runner/PrivacyInfo.xcprivacy': plist([kv('NSPrivacyTracking', true), '  <key>NSPrivacyTrackingDomains</key><array/>'].join('\n'))
  });
  check(['trackingMismatch', 'itms91064', 'attNoPrompt'].every(i => ids(st).includes(i)) && st.A.issues.find(i => i.id === 'trackingMismatch').sev === 'block', 'mismatch detected: trackingMismatch (block) + ITMS-91064 + ATT without prompt', ids(st));
  d = dec(st).find(x => x.key === 'fix:trackingMismatch');
  check(d && d.recommended === 'npa' && d.options.map(o => o.value).join() === 'npa,track', 'mismatch decision: npa (recommended) or fully aligned tracking — no mixed option', d && d.options);
  F = await finish(st);
  check(/<false\/>/.test(read(F.G, 'ios/PrivacyInfo.xcprivacy').match(/NSPrivacyTracking<\/key>(<\w+\/>)/)[1]) && /-    <key>NSUserTrackingUsageDescription/.test(read(F.G, 'fixes/aaplug2-fixes.diff')), 'npa path: corrected PrivacyInfo + diff removes the ATT string');
  st = await connect({
    'ios/Runner/Info.plist': plist([...BASE_PLIST, kv('NSUserTrackingUsageDescription', 'Used to show ads')].join('\n')),
    'ios/Podfile': "pod 'Google-Mobile-Ads-SDK'"
  });
  F = await finish(st, [{ key: 'fix:trackingMismatch', value: 'track' }]);
  const xp2 = read(F.G, 'ios/PrivacyInfo.xcprivacy');
  check(/NSPrivacyTracking<\/key><true\/>/.test(xp2) && /NSPrivacyTrackingDomains<\/key>\s*<array>\s*<string>/.test(xp2) && /Yes/.test(findField(F.guide.steps, 'a-privacy', /tracking\?/i).value), 'track path: tracking true WITH a domain entry (never empty) + App Privacy "Yes"');

  console.log('\n[4] Fully aligned tracking (string + prompt + PrivacyInfo + domains) is kept, with a warning');
  st = await connect({
    'ios/Runner/Info.plist': plist([...BASE_PLIST, kv('GADApplicationIdentifier', 'ca-app-pub-0000000000000000~0000000000'), kv('NSUserTrackingUsageDescription', 'Used to show ads')].join('\n')),
    'ios/Podfile': "pod 'Google-Mobile-Ads-SDK'",
    'ios/Runner/PrivacyInfo.xcprivacy': plist([kv('NSPrivacyTracking', true), kv('NSPrivacyTrackingDomains', ['ads.example.com'])].join('\n')),
    'ios/Runner/AppDelegate.swift': 'ATTrackingManager.requestTrackingAuthorization { _ in }'
  });
  check(ids(st).includes('trackingAligned') && st.A.issues.find(i => i.id === 'trackingAligned').sev === 'warn' && !dec(st).some(x => /tracking|adsNpa/i.test(x.key)), 'aligned tracking: warning only, ATT not force-removed', ids(st));
  F = await finish(st);
  check(/Yes/.test(findField(F.guide.steps, 'a-privacy', /tracking\?/i).value) && /App Tracking Transparency prompt appears/.test(F.G.app_review_notes), 'guide keeps tracking path aligned (App Privacy "Yes", prompt location in notes)');

  console.log('\n[5] Support URL without a contact method');
  st = await connect({
    'ios/Runner/Info.plist': plist(BASE_PLIST.join('\n')),
    'docs/support/index.html': '<html><body><h1>Demo Tool</h1><p>The best calculator. Download now!</p></body></html>',
    'fastlane/metadata/en-US/support_url.txt': 'https://demo-tool.example/'
  });
  check(ids(st).includes('supportNoContact') && st.A.issues.find(i => i.id === 'supportNoContact').sev === 'block' && ids(st).includes('supportUrlHome'), 'support page without contact → block; homepage support URL → warn', ids(st));
  F = await finish(st);
  const sup = read(F.G, 'policy/support-en.html');
  check(/mailto:help@demo-tool\.example/.test(sup) && sup.indexOf('mailto:') < 700, 'generated support page shows the contact email right at the top');
  check(/\/support\/$/.test(findField(F.guide.steps, 'a-version', /^Support URL$/).value), 'guide Support URL → dedicated /support/ page');
  st = await connect({ 'ios/Runner/Info.plist': plist(BASE_PLIST.join('\n')), 'docs/support.html': '<p>Contact: <a href="mailto:help@demo-tool.example">help@demo-tool.example</a></p>' });
  check(!ids(st).includes('supportNoContact'), 'support page with mailto → no issue');

  console.log('\n[6] Third-party login without Sign in with Apple');
  st = await connect({ 'ios/Runner/Info.plist': plist(BASE_PLIST.join('\n')), 'ios/Podfile': "pod 'FBSDKLoginKit'\npod 'FirebaseAuth'" });
  const lo = st.A.issues.find(i => i.id === 'loginOption');
  check(lo && lo.sev === 'block' && dec(st).find(x => x.key === 'fix:loginOption').recommended === 'apple', 'Facebook login without SIWA → block, recommend Sign in with Apple', ids(st));
  st = await connect({ 'ios/Runner/Info.plist': plist(BASE_PLIST.join('\n')), 'ios/Podfile': "pod 'GoogleSignIn'\npod 'FirebaseAuth'", 'ios/Runner/Runner.entitlements': plist(kv('com.apple.developer.applesignin', ['Default'])) });
  check(!ids(st).includes('loginOption'), 'Google login + SIWA entitlement → no issue');

  console.log('\n[7] Secret storage on iOS');
  const flutter = extra => ({ 'pubspec.yaml': `name: demo_tool\ndependencies:\n  flutter:\n    sdk: flutter\n${extra}`, 'ios/Runner/Info.plist': plist(BASE_PLIST.join('\n')) });
  st = await connect({ ...flutter('  encrypted_shared_preferences: ^3.0.0\n'), 'lib/main.dart': "import 'package:encrypted_shared_preferences/encrypted_shared_preferences.dart';\nvoid main() {}" });
  check(ids(st).includes('iosSecretStorage') && st.A.issues.find(i => i.id === 'iosSecretStorage').sev === 'block', 'Android-only secret storage on iOS → block (Guideline 2.1(a))', ids(st));
  st = await connect({ ...flutter('  flutter_secure_storage: ^9.0.0\n'), 'lib/main.dart': 'void main() {}' });
  check(!ids(st).includes('iosSecretStorage'), 'Keychain-backed storage (flutter_secure_storage) → no issue');

  console.log('\n[8] Privacy labels: on-device location, no grouping with sign-in data');
  const locApp = { ...flutter('  geolocator: ^12.0.0\n  firebase_auth: ^5.0.0\n'), 'lib/main.dart': 'void main() {}' };
  st = await connect(locApp);
  d = dec(st).find(x => x.key === 'location');
  check(d && d.recommended === 'device', 'location decision offered; on-device recommended when nothing sends coordinates', d);
  F = await finish(st);
  check(!F.G.data_safety.some(r => /Location/.test(r.apple)) && findField(F.guide.steps, 'a-privacy', /^Location$/) && /Data Not Collected/.test(findField(F.guide.steps, 'a-privacy', /^Location$/).value), 'on-device location → not collected (“Data Not Collected”)', F.G.data_safety);
  check(!/Location/.test(read(F.G, 'forms/data-safety.csv')), 'data-safety.csv has no location row');
  st = await connect(locApp);
  F = await finish(st, [{ key: 'location', value: 'server' }]);
  const loc = F.G.data_safety.find(r => /Location/.test(r.apple)), nm = F.G.data_safety.find(r => /Name/.test(r.apple));
  check(loc && nm && loc.linked === false && nm.linked === true && loc.purposes !== nm.purposes && F.G.data_safety.filter(r => /Location/.test(r.apple)).length === 1, 'server location → its own row, not grouped with name/email/user ID');
  check(/do not group sign-in data/i.test(findField(F.guide.steps, 'a-privacy', /^Check$/).value), 'guide warns not to mix categories and to re-check the form before submit');
  st = await connect({ ...locApp, 'lib/upload.dart': "void send(lat, lng) { FirebaseFirestore.instance.collection('trips').add({'latitude': lat, 'longitude': lng}); }" });
  check(dec(st).find(x => x.key === 'location').recommended === 'server', 'code sends coordinates to a server → "sent to a server" recommended');

  console.log('\n[9] BYOK (user-supplied AI API key)');
  st = await connect({ ...flutter('  google_generative_ai: ^0.4.0\n'), 'lib/settings_screen.dart': "final apiKeyController = TextEditingController(); // Enter your API key from Google AI Studio\nfinal model = GenerativeModel(model: 'gemini-pro', apiKey: apiKeyController.text);" });
  check(ids(st).includes('byok'), 'BYOK detected', ids(st));
  F = await finish(st);
  const notes = F.G.app_review_notes;
  check(/no in-app purchases or subscriptions/.test(notes) && /Google AI Studio/.test(notes) && /do not sell/.test(notes) && /\[attach a review-only key/.test(notes), 'review notes: no IAP/subscription, third-party key, not sold, review-key placeholder', notes);
  check(!/AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}/.test(notes + read(F.G, 'forms/app-review-notes.txt')), 'no real-looking key in generated notes');
  check(findField(F.guide.steps, 'a-review', /Review-only API key/), 'guide asks the user to attach a review-only key');

  console.log('\n[10] Login gate, demo account, account deletion');
  st = await connect({ ...flutter('  firebase_auth: ^5.0.0\n  google_sign_in: ^6.0.0\n  sign_in_with_apple: ^6.0.0\n'), 'lib/main.dart': 'void main() => runApp(MaterialApp(home: LoginScreen()));' });
  check(ids(st).includes('loginGate') && dec(st).find(x => x.key === 'access').recommended === 'optional', 'login gate warned; browse-first (optional) recommended', ids(st));
  F = await finish(st);
  check(/optional/.test(F.G.app_review_notes) && /Sign in with Apple/.test(F.G.app_review_notes) && /No demo account is required/.test(F.G.app_review_notes) && /demoAccountRequired = false/.test(findField(F.guide.steps, 'a-review', /demo account/i).value), 'optional login → demoAccountRequired=false, reviewer can use Sign in with Apple');
  check(/Settings > Delete account/.test(F.G.app_review_notes) && /account-deletion-en\.html/.test(F.G.app_review_notes), 'review notes mention in-app + web account deletion');
  st = await connect({ ...flutter('  firebase_auth: ^5.0.0\n  sign_in_with_apple: ^6.0.0\n'), 'lib/main.dart': 'void main() {}' });
  F = await finish(st, [{ key: 'access', value: 'required' }]);
  check(/Sign-in is required because/.test(F.G.app_review_notes) && /Demo account/.test(F.G.app_review_notes) && /^Yes/.test(findField(F.guide.steps, 'a-review', /demo account/i).value), 'required login → explain why + working demo account');

  console.log('\n[11] Store copy, encryption, iPad, CarPlay, deployment target');
  st = await connect({
    'ios/Runner/Info.plist': plist(kv('CFBundleDisplayName', 'Demo Tool')),
    'ios/Runner.xcodeproj/project.pbxproj': PBX('1,2').replace('15.0', '13.0'),
    'fastlane/metadata/en-US/keywords.txt': 'calculator,free,converter',
    'fastlane/metadata/th/subtitle.txt': 'เครื่องคิดเลขฟรี',
    'fastlane/metadata/en-US/description.txt': 'Also on Android! No ads in the pro version.',
    'ios/Runner/CarScene.swift': 'import CarPlay\nclass CarScene: CPTemplateApplicationSceneDelegate {}'
  });
  check(['freeInMeta', 'androidInIosCopy', 'adsInCopy', 'encryption', 'ipadShots', 'carplay', 'iosDeployment'].every(i => ids(st).includes(i)), 'free/brand words, Android mention, ads in copy, missing encryption key, iPad, CarPlay, old target all flagged', ids(st));
  F = await finish(st);
  check(/ITSAppUsesNonExemptEncryption<\/key>\n\+    <false\/>/.test(read(F.G, 'fixes/aaplug2-fixes.diff')), 'encryption fix: ITSAppUsesNonExemptEncryption = NO');
  check(findField(F.guide.steps, 'a-version', /iPad/) && /2048×2732/.test(findField(F.guide.steps, 'a-version', /iPad/).value) && /1320×2868/.test(findField(F.guide.steps, 'a-version', /^Screenshots$/).value) && /ads off/.test(findField(F.guide.steps, 'a-version', /^Screenshots$/).value), 'screenshots: iPhone 6.7" 1320×2868 ads off + iPad 13" 2048×2732');
  const { Gen } = await import('../lib/runtime.mjs');
  check(Gen.asoClean('Free budget app for Android') === 'budget app for' && Gen.asoClean('เครื่องคิดเลขฟรี') === 'เครื่องคิดเลข' && Gen.asoClean('免费记账') === '记账', 'subtitle/keyword cleaner strips free words (en/th/zh) and brand names');
  check(/^4\+/.test(findField(F.guide.steps, 'a-info', /Age rating/).value) && /No/.test(findField(F.guide.steps, 'a-info', /Advertising/).value), 'age rating from the questionnaire + ad answer matches this build');

  console.log('\n[12] Review results: ITMS-91064, Information Needed, no auto-reply');
  st = await connect({ 'ios/Runner/Info.plist': plist(BASE_PLIST.join('\n')) });
  await finish(st); E.approve(st, 'apple', 'yes submit', 'en'); E.review(st, { store: 'apple', event: 'submitted' }, 'en');
  let rv = E.review(st, { store: 'apple', event: 'rejected', rejection_text: 'ITMS-91064: Invalid tracking information. NSPrivacyTracking is true but NSPrivacyTrackingDomains is empty.' }, 'en');
  check(rv.matched && /ITMS-91064/.test(rv.reason) && /npa=1/.test(rv.fix_plan.join(' ')) && rv.auto_reply === false, 'ITMS-91064 → aligned no-tracking fix plan, auto_reply=false', rv);
  rv = E.review(st, { store: 'apple', event: 'rejected', rejection_text: 'Guideline 2.1 - Information Needed\n\nPlease explain how users obtain the API key and provide a working key.' }, 'en');
  check(rv.matched && /API key/.test(rv.reason) && /not a new binary|not always a new build|new binary/.test(rv.information_needed) && /never replies to Apple/.test(rv.information_needed), 'Information Needed → BYOK plan + "shows as Rejected, reply only" note', rv);
  for (const l of ['ko', 'th', 'zh', 'hi']) {
    const g = E.guide(st, 'apple', l); const t = JSON.stringify(g.steps);
    check(!/iss\.|f\.\w+\.d\b|g\.a-/.test(t), `apple guide lang=${l}: every new label translated`);
  }
} catch (e) { failN++; console.error('test crashed:', e); }
finally { fs.rmSync(HOME, { recursive: true, force: true }); }
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
