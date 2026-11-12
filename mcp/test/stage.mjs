/* AA Plug 2 0.1.5 — store stage tests: first submit, in review, rejected, live update; targetSdk from variables.gradle; unread targetSdk.
   In-process, local fixture projects, shared-lessons API pointed at a dead local port. Run: node test/stage.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aaplug2-stage-'));
process.env.AAPLUG2_HOME = HOME;
process.env.AAPLUG2_LESSONS_API = 'http://127.0.0.1:9/api/lessons';   // never production in tests
const E = await import('../lib/engine.mjs');
const { Flow } = await import('../lib/runtime.mjs');
let pass = 0, failN = 0;
const check = (cond, name, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''); } };

const GRADLE = (target, vc = 1) => `apply plugin: 'com.android.application'
android {
  namespace "com.example.tool"
  compileSdk rootProject.ext.compileSdkVersion
  defaultConfig {
    applicationId "com.example.tool"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion ${target}
    versionCode ${vc}
    versionName "1.3.0"
  }
}
dependencies { implementation 'com.google.android.gms:play-services-ads:23.0.0' }
`;
const MANIFEST = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><application android:label="Tool Box"><activity android:name=".MainActivity" android:exported="true"/></application></manifest>';
const VARS = 'ext {\n    minSdkVersion = 24\n    compileSdkVersion = 36\n    targetSdkVersion = 36\n}\n';
const README_PLAIN = '# Tool Box\n\nA handy unit converter.\n\nContact: hi@toolbox.example\n';
const README_LIVE = '# Tool Box\n\nA handy unit converter.\n\nGet it on [Google Play](https://play.google.com/store/apps/details?id=com.example.tool)\n\nPrivacy policy: https://toolbox.app/privacy\n\nContact: hi@toolbox.app\n';
let n = 0;
function project(files) {
  const dir = path.join(HOME, 'fx-' + (++n));
  const all = { 'android/app/src/main/AndroidManifest.xml': MANIFEST, 'android/variables.gradle': VARS, 'android/app/build.gradle': GRADLE('rootProject.ext.targetSdkVersion'), 'README.md': README_PLAIN, ...files };
  for (const [p, c] of Object.entries(all)) { if (c == null) continue; const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return dir;
}
const connect = async (files, extra = {}) => (await E.connect({ source: 'path', path: project(files), ...extra }, { allowPath: true })).st;
const keys = st => E.decisions(st, 'en').decisions.map(d => d.key);
const ids = steps => steps.map(s => s.id);

console.log('\n[1] targetSdk via rootProject.ext / variables.gradle');
let st = await connect({});
check(st.A.android.targetSdk === 36, 'variables.gradle targetSdkVersion = 36 → read as 36', st.A.android.targetSdk);
check(!st.A.issues.some(i => i.id === 'targetSdk' || i.id === 'targetSdkUnread'), 'no targetSdk issue when 36 is resolved');

console.log('\n[2] unread targetSdk is a warning, not a block');
st = await connect({ 'android/variables.gradle': null, 'android/app/build.gradle': GRADLE('someVar.target') });
const un = st.A.issues.find(i => i.id === 'targetSdkUnread');
check(un && un.sev === 'warn' && !st.A.issues.some(i => i.id === 'targetSdk' && i.sev === 'block'), 'targetSdkUnread = warn, never block', st.A.issues.map(i => i.id + ':' + i.sev));
check(/could not read targetSdk/.test(E.report(st, 'en').issues.find(i => /could not be read/.test(i.title)).why), 'unread warning explains how to check');
st = await connect({ 'android/variables.gradle': null, 'android/app/build.gradle': GRADLE(34) });
check(st.A.issues.some(i => i.id === 'targetSdk' && i.sev === 'block'), 'targetSdk read as 34 → still a block (real check)');

console.log('\n[3] not_submitted (no store hints): today\'s first-submit path');
st = await connect({});
let rep = E.report(st, 'en');
check(rep.store_stage['Google Play'].recommended === 'not_submitted' && /stage:play/.test(rep.next), 'stage asked first; recommended not_submitted without hints', rep.store_stage);
const w = await connect({ 'android/app/build.gradle': GRADLE('rootProject.ext.targetSdkVersion', 5) });
check(E.decide(w, { accept_all_recommended: true }, 'en').stage_not_picked && !w.dec['stage:play'], 'versionCode 5 alone (earlier uploads?) → stage still asked, not assumed');
check(keys(st)[0] === 'stage:play', 'stage:play is the first decision');
let r = E.decide(st, { accept_all_recommended: true }, 'en');
check(st.dec['stage:play'] === 'not_submitted' && st.dec.track === 'closed' && r.open_count === 0, 'no hints: accept-all may use not_submitted; closed test recommended');
await E.generate(st, {}, { allowPath: true });
let g = E.guide(st, 'play', 'en');
check(ids(g.steps).includes('p-closed') && ids(g.steps).includes('p-create'), 'first-submit guide keeps create + closed test', ids(g.steps));
check(E.report(st, 'en').issues.some(i => /closed test/i.test(i.title)), 'closed-test tip shown for a first submit');

console.log('\n[4] live (update): hints, keep listing, no closed test');
st = await connect({ 'android/app/build.gradle': GRADLE('rootProject.ext.targetSdkVersion', 7), 'README.md': README_LIVE, 'fastlane/metadata/android/en-US/title.txt': 'Tool Box - Unit Converter', 'fastlane/metadata/android/en-US/short_description.txt': 'Convert units fast.' });
rep = E.report(st, 'en');
const sp = rep.store_stage['Google Play'];
check(sp.recommended === 'live' && sp.evidence.includes('Google Play link') && sp.evidence.includes('fastlane Play metadata') && sp.current === null, 'hints (Play URL, fastlane) → live recommended but NOT chosen', sp);
r = E.decide(st, { accept_all_recommended: true }, 'en');
check(!st.dec['stage:play'] && r.stage_not_picked && r.applied.length === 0, 'accept-all never picks a stage when hints exist (and fills nothing until it is chosen)', r);
E.decide(st, { choices: [{ key: 'stage:play', value: 'live' }] }, 'en');
E.decide(st, { accept_all_recommended: true }, 'en');
check(['title', 'short', 'category', 'langs', 'icon', 'feature', 'shots', 'privacy'].every(k => st.dec[k] === 'keep'), 'listing identity kept (title/short/category/langs/graphics/privacy = keep)', st.dec);
check(st.dec.track === 'production', 'live update → production track, no closed test');
rep = E.report(st, 'en');
check(!rep.issues.some(i => /closed test/i.test(i.title)) && !rep.issues.some(i => /No screenshots|No store icon/.test(i.title)), 'no closed-test / icon / screenshot advice for a live app', rep.issues.map(i => i.title));
check(rep.app.privacy_url_found === 'https://toolbox.app/privacy', 'existing privacy URL found in README');
let G = await E.generate(st, {}, { allowPath: true });
check(!G.files.some(f => /^policy\/privacy-policy/.test(f)) && !G.files.some(f => /^graphics\//.test(f)), 'no invented privacy policy or graphics', G.files);
check(G.files.includes('listing/KEEP-CURRENT-LISTING.txt') && G.files.includes('release-notes/whats-new.txt') && G.listing.keep_current_listing === true, 'kit: keep-listing note + What\'s new');
const lt = fs.readFileSync(path.join(G.folder, 'listing/en/google-play.txt'), 'utf8');
check(/Tool Box - Unit Converter/.test(lt) && /Convert units fast\./.test(lt) && /\[keep the current text\]/.test(lt), 'listing file = existing fastlane copy only (missing parts say keep current)', lt);
g = E.guide(st, 'play', 'en');
check(JSON.stringify(ids(g.steps)) === JSON.stringify(['u-version', 'u-whatsnew', 'u-checks', 'u-listing', 'u-submit']), 'live guide: version → What\'s new → checks → listing kept → send update', ids(g.steps));
const uv = g.steps.find(s => s.id === 'u-version').fields;
check(uv.some(f => /Next version/.test(f.label) && f.value === '1.3.1 / 8') && uv.some(f => f.label === 'targetSdk' && f.value === '36'), 'new version suggested (versionCode +1), real targetSdk shown', uv);
check(g.steps.find(s => s.id === 'u-checks').fields.some(f => f.value === 'https://toolbox.app/privacy'), 'privacy URL kept, not replaced');

console.log('\n[5] in_review: wait, no new build unless chosen');
st = await connect({}, { store_stage: 'in_review' });
check(st.dec['stage:play'] === 'in_review' && st.review.play.status === 'in_review' && st.review.play.external, 'store_stage on connect → in review (external)');
rep = E.report(st, 'en');
check(/nothing to submit/.test(rep.next) && /Do not create a new app record/.test(rep.next), 'report next: nothing to submit, no new record/build', rep.next);
check(E.status(st.id, 'en').step === 'in_review' && E.status(st.id, 'en').next === 'aaplug2_report_review', 'status: waiting for review (next = report the result)');
g = E.guide(st, 'play', 'en');
check(JSON.stringify(ids(g.steps)) === JSON.stringify(['i-wait', 'i-keep', 'i-info', 'i-meta']) && !g.steps.some(s => s.final), 'in-review guide: wait / do not replace / Information Needed / metadata; no submit step', ids(g.steps));
check(keys(st).includes('binary:play'), 'binary decision offered while in review');
E.decide(st, { choices: [{ key: 'binary:play', value: 'new_build' }] }, 'en');
g = E.guide(st, 'play', 'en');
const nb = g.steps.find(s => s.id === 'i-newbuild');
check(nb && nb.final && nb.locked, 'new build only after the user chose it, and still locked until approval');
r = E.review(st, { store: 'play', event: 'approved' }, 'en');
check(r.status === 'live', 'in-review result "approved" can be reported without a resubmit');

console.log('\n[6] rejected: paste the rejection first → fix plan → resubmit guide');
st = await connect({}, { store_stage: { play: 'rejected' } });
rep = E.report(st, 'en');
check(/aaplug2_report_review/.test(rep.next) && /rejection/.test(rep.next), 'report next: paste the rejection into aaplug2_report_review', rep.next);
const s6 = E.status(st.id, 'en');
check(s6.step === 'rejected' && s6.next === 'aaplug2_report_review', 'status: rejected → aaplug2_report_review is the next step', s6);
g = E.guide(st, 'play', 'en');
check(ids(g.steps)[0] === 'r-message' && !ids(g.steps).some(x => /^p-/.test(x)), 'rejected guide is a resubmit guide (no first-submit / closed-test steps)', ids(g.steps));
r = E.review(st, { store: 'play', event: 'rejected', rejection_text: 'Issue found: Permissions policy. Your app requests the READ_MEDIA_IMAGES permission but does not have a core use for photo access.' }, 'en');
check(r.status === 'fixing' && Array.isArray(r.fix_plan) && r.fix_plan.length && r.auto_reply === false, 'rejection pasted → fix plan, no auto reply', r);
g = E.guide(st, 'play', 'en');
const rm = g.steps.find(s => s.id === 'r-message');
check(rm.fields.length >= 2, 'resubmit guide shows the fix plan in its first step', rm.fields);
check(g.steps.find(s => s.id === 'r-resubmit').final && g.steps.find(s => s.id === 'r-resubmit').locked, 'resubmit step locked until approval (never auto-submit)');

console.log('\n[7] stage validation and switching');
let bad = null; try { await connect({}, { store_stage: 'launched' }); } catch (e) { bad = e; }
check(bad && bad.code === 'badValue', 'unknown store_stage rejected');
st = await connect({ 'README.md': README_LIVE });
E.decide(st, { choices: [{ key: 'stage:play', value: 'live' }] }, 'en');
E.decide(st, { accept_all_recommended: true }, 'en');
E.decide(st, { choices: [{ key: 'stage:play', value: 'not_submitted' }] }, 'en');
check(st.dec.title === 0 && st.dec.track === 'closed', 'switching back to first submit: auto-filled keep values follow the new recommendation', st.dec);
let kb = null; try { E.decide(st, { choices: [{ key: 'icon', value: 'keep' }] }, 'en'); } catch (e) { kb = e; }
check(kb && kb.code === 'badValue', '"keep" refused for a first submit (nothing live to keep)');

console.log('\n[8] iOS app with ads, live update: still no ATT');
const PL = `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n  <key>CFBundleDisplayName</key><string>Tool Box</string>\n  <key>GADApplicationIdentifier</key><string>ca-app-pub-0000000000000000~0000000000</string>\n  <key>ITSAppUsesNonExemptEncryption</key><false/>\n</dict>\n</plist>\n`;
const PBX = '// !$*UTF8*$!\n{ buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.tool; MARKETING_VERSION = 2.0.0; CURRENT_PROJECT_VERSION = 12; IPHONEOS_DEPLOYMENT_TARGET = 15.0; TARGETED_DEVICE_FAMILY = "1"; }; }\n';
st = await connect({ 'android/app/src/main/AndroidManifest.xml': null, 'android/variables.gradle': null, 'android/app/build.gradle': null, 'ios/Runner/Info.plist': PL, 'ios/Runner.xcodeproj/project.pbxproj': PBX,
  'README.md': '# Tool Box\n\nA handy unit converter.\n\n[App Store](https://apps.apple.com/us/app/tool-box/id1234567890)\n\nContact: hi@toolbox.app\n' });
check(E.report(st, 'en').store_stage['App Store'].recommended === 'live', 'App Store link → live recommended');
E.decide(st, { choices: [{ key: 'stage:apple', value: 'live' }] }, 'en'); E.decide(st, { accept_all_recommended: true }, 'en');
await E.generate(st, {}, { allowPath: true });
g = E.guide(st, 'apple', 'en');
const tf = g.steps.find(s => s.id === 'u-checks').fields.find(f => /tracking/i.test(f.label));
check(tf && /No/.test(tf.value) && !Object.keys(st.dec).some(k => st.dec[k] === 'track'), 'ads alone → App Privacy "No, we do not track", no ATT', tf);
check(g.steps.find(s => s.id === 'u-version').fields.some(f => f.value === '2.0.1 (13)'), 'next iOS version/build suggested (2.0.1 (13))');

console.log('\n[9] texts in five languages');
const D = globalThis.window.AAP_I18N;
const need = ['dec.stage.play', 'stage.not_submitted', 'stage.in_review', 'stage.rejected', 'stage.live', 'opt.keep', 'binary.wait', 'binary.new_build', 'iss.targetSdkUnread.t', 'g.u-version.t', 'g.i-wait.t', 'g.r-resubmit.t'];
check(['en', 'ko', 'th', 'zh', 'hi'].every(l => need.every(k => D[l] && D[l][k])), 'stage texts present in en/ko/th/zh/hi');
check(Flow.STAGES.join() === 'not_submitted,in_review,rejected,live', 'four stages');

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
