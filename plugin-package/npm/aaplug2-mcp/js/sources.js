/* AA Plug 2 — 앱 프로젝트 가져오기: 샘플 / GitHub 공개 저장소 / ZIP / 폴더
   결과: { name, source, files: { [path]: { text } | { dataUrl } } }
   모든 파일은 브라우저 안에서만 읽고, 어디에도 올리지 않는다. */
(function () {
  'use strict';
  const TEXT_RE = [
    /(^|\/)AndroidManifest\.xml$/i, /\.gradle(\.kts)?$/i, /(^|\/)gradle\.properties$/i, /(^|\/)libs\.versions\.toml$/i,
    /(^|\/)res\/values[^/]*\/(strings|colors|themes)\.xml$/i,
    /(^|\/)Info\.plist$/i, /project\.pbxproj$/i, /PrivacyInfo\.xcprivacy$/i, /\.entitlements$/i, /(^|\/)Podfile$/i, /(^|\/)Package\.swift$/i,
    /(^|\/)pubspec\.yaml$/i, /(^|\/)package\.json$/i, /(^|\/)app\.json$/i, /(^|\/)app\.config\.(js|ts)$/i, /(^|\/)capacitor\.config\.(json|ts|js)$/i,
    /(^|\/)eas\.json$/i, /(^|\/)README(\.[a-z]+)?$/i, /(^|\/)LICENSE(\.[a-z]+)?$/i, /(^|\/)privacy[^/]*\.(md|html)$/i,
    /fastlane\/metadata\/.*\.txt$/i, /AppIcon\.appiconset\/Contents\.json$/i, /(^|\/)lib\/l10n\/.*\.arb$/i
  ];
  const IMG_RE = [
    /ic_launcher(_round|_foreground)?\.(png|webp)$/i, /ic_launcher-playstore\.png$/i, /playstore[^/]*\.png$/i,
    /AppIcon\.appiconset\/.*\.png$/i, /(^|\/)(icon|app-icon|appicon|logo)\.png$/i,
    /(^|\/)(screenshots?|fastlane\/metadata\/android\/[^/]+\/images\/phoneScreenshots|store)\/[^/]*\.(png|jpe?g|webp)$/i
  ];
  const SKIP_RE = /(^|\/)(node_modules|\.git|build|\.gradle|Pods|DerivedData|\.dart_tool|\.idea|intermediates|generated)\//;
  const MAX_TEXT = 400 * 1024, MAX_IMG = 4 * 1024 * 1024, MAX_FILES = 140;

  function wanted(path) {
    if (SKIP_RE.test(path)) return null;
    if (TEXT_RE.some(r => r.test(path))) return 'text';
    if (IMG_RE.some(r => r.test(path))) return 'img';
    return null;
  }
  function mime(path) { return /\.webp$/i.test(path) ? 'image/webp' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : 'image/png'; }
  function u8ToDataUrl(u8, path) {
    return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(new Blob([u8], { type: mime(path) })); });
  }
  /* 맨 위 공통 폴더 하나를 벗긴다 (repo-main/..., my-app/...) */
  function stripRoot(paths) {
    const tops = new Set(paths.map(p => p.split('/')[0]));
    if (tops.size === 1 && paths.every(p => p.includes('/'))) { const t = [...tops][0] + '/'; return p => p.slice(t.length); }
    return p => p;
  }
  /* 아이콘·스크린샷은 사이즈가 큰 해상도 하나만 남겨도 충분 → 같은 이름 중 xxxhdpi 우선 */
  function rank(path) { const m = path.match(/mipmap-(x*)hdpi/); return m ? m[1].length : 0; }

  async function fromEntries(entries, name, source, onStep) {
    // entries: [{path, size, read: async()=>Uint8Array}]
    const strip = stripRoot(entries.map(e => e.path));
    let picked = entries.map(e => ({ ...e, rel: strip(e.path) })).map(e => ({ ...e, kind: wanted(e.rel) })).filter(e => e.kind);
    // 런처 아이콘은 가장 큰 밀도만
    const launchers = picked.filter(e => /mipmap-[^/]+\/ic_launcher(_round)?\.(png|webp)$/i.test(e.rel)).sort((a, b) => rank(b.rel) - rank(a.rel));
    const keepLaunch = new Set(launchers.slice(0, 2).map(e => e.rel));
    picked = picked.filter(e => !/mipmap-[^/]+\/ic_launcher/i.test(e.rel) || keepLaunch.has(e.rel));
    picked = picked.filter(e => (e.kind === 'text' ? e.size <= MAX_TEXT : e.size <= MAX_IMG)).slice(0, MAX_FILES);
    const files = {};
    for (const e of picked) {
      onStep && onStep(e.rel);
      try {
        const u8 = await e.read();
        files[e.rel] = e.kind === 'text' ? { text: new TextDecoder().decode(u8) } : { dataUrl: await u8ToDataUrl(u8, e.rel) };
      } catch (err) { console.warn('skip', e.rel, err); }
    }
    return { name, source, files, fileCount: entries.length };
  }

  function sample() {
    const S = window.AAP_SAMPLE; const files = {};
    for (const [p, v] of Object.entries(S.files)) files[p] = v.text != null ? { text: v.text } : { dataUrl: 'data:' + mime(p) + ';base64,' + v.b64 };
    return Promise.resolve({ name: S.name, source: { kind: 'sample' }, files, fileCount: Object.keys(files).length });
  }

  async function fromZipFile(file, onStep) {
    const buf = await file.arrayBuffer();
    const entries = window.AAPZip.readZip(buf);
    return fromEntries(entries, file.name.replace(/\.zip$/i, ''), { kind: 'zip', name: file.name }, onStep);
  }
  async function fromFileList(list, onStep) {
    const arr = [...list];
    const entries = arr.map(f => ({ path: f.webkitRelativePath || f.name, size: f.size, read: async () => new Uint8Array(await f.arrayBuffer()) }));
    const top = (arr[0] && (arr[0].webkitRelativePath || '').split('/')[0]) || 'project';
    return fromEntries(entries, top, { kind: 'folder', name: top }, onStep);
  }

  function parseRepo(url) {
    const m = String(url).trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?\/?$/i);
    if (!m) return null;
    return { owner: m[1], repo: m[2], branch: m[3] || null, sub: (m[4] || '').replace(/\/$/, '') };
  }
  /* 브라우저에서 바로 시도 → 막히면 같은 출처의 로컬 프록시(/gh/...)로 재시도 (server.mjs 로 열었을 때만 존재) */
  async function ghFetch(url, as) {
    const tries = [url];
    if (location.protocol.startsWith('http')) tries.push('/gh?u=' + encodeURIComponent(url));
    let lastErr;
    for (const u of tries) {
      try {
        const r = await fetch(u, { headers: as === 'json' ? { Accept: 'application/vnd.github+json' } : {} });
        if (r.status === 403 || r.status === 429) { lastErr = new Error('rate'); continue; }
        if (r.status === 404) throw Object.assign(new Error('notfound'), { fatal: true });
        if (!r.ok) { lastErr = new Error('http ' + r.status); continue; }
        return as === 'json' ? r.json() : new Uint8Array(await r.arrayBuffer());
      } catch (e) { if (e.fatal) throw e; lastErr = e; }
    }
    throw lastErr || new Error('network');
  }
  async function fromGitHub(url, onStep) {
    const R = parseRepo(url);
    if (!R) throw Object.assign(new Error('badurl'), { code: 'badurl' });
    onStep && onStep('github.com/' + R.owner + '/' + R.repo);
    let meta;
    try { meta = await ghFetch(`https://api.github.com/repos/${R.owner}/${R.repo}`, 'json'); }
    catch (e) { throw Object.assign(e, { code: e.message === 'notfound' ? 'notfound' : e.message === 'rate' ? 'rate' : 'network' }); }
    if (meta.private) throw Object.assign(new Error('private'), { code: 'notfound' });
    const branch = R.branch || meta.default_branch || 'main';
    const tree = await ghFetch(`https://api.github.com/repos/${R.owner}/${R.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, 'json');
    let blobs = (tree.tree || []).filter(n => n.type === 'blob');
    if (R.sub) blobs = blobs.filter(n => n.path.startsWith(R.sub + '/')).map(n => ({ ...n, path: n.path }));
    const entries = blobs.map(n => ({
      path: n.path, size: n.size || 0,
      read: () => ghFetch(`https://raw.githubusercontent.com/${R.owner}/${R.repo}/${encodeURIComponent(branch)}/${n.path.split('/').map(encodeURIComponent).join('/')}`, 'bin')
    }));
    const res = await fromEntries(entries.map(e => R.sub ? { ...e, path: e.path.slice(R.sub.length + 1) } : e).map((e, i) => ({ ...e, read: entries[i].read })), R.repo, { kind: 'github', url: `https://github.com/${R.owner}/${R.repo}`, branch }, onStep);
    res.meta = { description: meta.description || '', homepage: meta.homepage || '', owner: meta.owner && meta.owner.login, license: meta.license && meta.license.spdx_id, stars: meta.stargazers_count };
    return res;
  }
  window.AAPSources = { sample, fromZipFile, fromFileList, fromGitHub, parseRepo };
})();
