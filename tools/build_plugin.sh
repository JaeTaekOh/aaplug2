#!/usr/bin/env bash
# AA Plug 2 — 플러그인 패키지 만들기 (Cursor Plugin 형식 + Claude Code 플러그인 형식, 같은 폴더)
# 결과: plugin-package/aaplug2/  (제출용 공개 Git 저장소의 내용이 될 폴더) + plugin-package/aaplug2-plugin-<버전>.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/plugin-package/aaplug2"
VER=$(node -p "require('$ROOT/plugin-src/.cursor-plugin/plugin.json').version")
cd "$ROOT/mcp" && npm run -s bundle >/dev/null
rm -rf "$OUT" && mkdir -p "$OUT"/{js,fonts,assets,mcp/dist,mcp/fonts}
cp -r "$ROOT/plugin-src/." "$OUT/"
# UI strings: English (default) + Korean, Thai, Simplified Chinese, Hindi. Every one must exist.
I18N_LANGS="en ko th zh hi"
for l in $I18N_LANGS; do test -f "$ROOT/js/i18n-$l.js" || { echo "ERROR: js/i18n-$l.js missing" >&2; exit 1; }; done
test -f "$ROOT/plugin-src/LICENSE" || { echo "ERROR: plugin-src/LICENSE missing" >&2; exit 1; }
for f in config i18n-en i18n-ko i18n-th i18n-zh i18n-hi i18n-stage i18n zip sample-data sources analyzer generator graphics flow lessons; do cp "$ROOT/js/$f.js" "$OUT/js/"; done
cp -r "$ROOT/fonts/plex-sans" "$ROOT/fonts/plex-thai" "$ROOT/fonts/LICENSES" "$OUT/fonts/"
cp "$ROOT/mcp/dist/aaplug2-mcp.mjs" "$OUT/mcp/dist/"
cp "$ROOT"/mcp/fonts/* "$OUT/mcp/fonts/"
cp "$ROOT/assets/favicon.svg" "$OUT/assets/logo.svg"
# 512px PNG 로고 (제출 양식의 1:1 PNG 용)
(cd "$ROOT/mcp" && node -e "
const {createCanvas,loadImage}=require('@napi-rs/canvas');const fs=require('fs');
const s=fs.readFileSync('$ROOT/assets/favicon.svg','utf8').replace('<svg ','<svg width=\"512\" height=\"512\" ');
loadImage(Buffer.from(s)).then(i=>{const c=createCanvas(512,512);c.getContext('2d').drawImage(i,0,0,512,512);fs.writeFileSync('$OUT/assets/logo-512.png',c.toBuffer('image/png'));});")
# 그래픽을 켜려면 mcp/ 에서 npm install (선택)
cat > "$OUT/mcp/package.json" <<JSON
{
  "name": "aaplug2-mcp-runtime",
  "version": "$VER",
  "private": true,
  "type": "module",
  "description": "Optional: run 'npm install' here to turn on store graphics (icon, feature graphic, screenshots).",
  "license": "MIT",
  "optionalDependencies": { "@napi-rs/canvas": "^1.1.0" }
}
JSON
cd "$ROOT/plugin-package" && rm -f aaplug2-plugin-*.zip && python3 -c "
import os,zipfile,sys
z=zipfile.ZipFile('aaplug2-plugin-$VER.zip','w',zipfile.ZIP_DEFLATED)
for d,_,fs in os.walk('aaplug2'):
    if 'node_modules' in d: continue
    for f in fs: p=os.path.join(d,f); z.write(p, os.path.relpath(p,'aaplug2'))
z.close()"
echo "built $OUT ($(du -sh "$OUT" | cut -f1)) + plugin-package/aaplug2-plugin-$VER.zip"

# npm 패키지 준비본 (공개하지 않음: npm publish 는 소유자 승인 뒤). npx -y aaplug2-mcp 로 실행되는 형태.
NPM="$ROOT/plugin-package/npm/aaplug2-mcp"
rm -rf "$ROOT/plugin-package/npm" && mkdir -p "$NPM"/{js,fonts,mcp/dist,mcp/fonts}
cp "$OUT"/js/*.js "$NPM/js/"; cp -r "$OUT"/fonts/* "$NPM/fonts/"; cp "$OUT/mcp/dist/aaplug2-mcp.mjs" "$NPM/mcp/dist/"; cp "$OUT"/mcp/fonts/* "$NPM/mcp/fonts/"
cp "$OUT/README.md" "$OUT/PRIVACY.md" "$OUT/CHANGELOG.md" "$OUT/LICENSE" "$NPM/"
cat > "$NPM/package.json" <<JSON
{
  "name": "aaplug2-mcp",
  "version": "$VER",
  "description": "AA Plug 2 MCP server: from a finished app to launched on Google Play / App Store. You only pick and approve. Free, no API keys.",
  "type": "module",
  "bin": { "aaplug2-mcp": "mcp/dist/aaplug2-mcp.mjs" },
  "files": ["mcp", "js", "fonts", "README.md", "PRIVACY.md", "CHANGELOG.md", "LICENSE"],
  "engines": { "node": ">=20" },
  "optionalDependencies": { "@napi-rs/canvas": "^1.1.0" },
  "keywords": ["mcp", "mcp-server", "google-play", "app-store", "app-launch", "privacy-policy", "data-safety"],
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/JaeTaekOh/aaplug2.git" },
  "bugs": { "url": "https://github.com/JaeTaekOh/aaplug2/issues" },
  "homepage": "https://github.com/JaeTaekOh/aaplug2"
}
JSON
# 확인: 다섯 언어 UI 문구 파일과 LICENSE 가 모두 들어갔는지 (빠지면 실패), npm 메타데이터
for d in "$OUT" "$NPM"; do
  for l in $I18N_LANGS; do test -f "$d/js/i18n-$l.js" || { echo "ERROR: js/i18n-$l.js missing in $d" >&2; exit 1; }; done
  test -f "$d/LICENSE" || { echo "ERROR: LICENSE missing in $d" >&2; exit 1; }
done
node -e "
const p=require('$NPM/package.json');
const ok=p.license==='MIT'&&p.files.includes('LICENSE')&&p.repository.url==='git+https://github.com/JaeTaekOh/aaplug2.git'&&p.bugs&&p.homepage&&!('author' in p)&&!/ by /i.test(p.description)&&p.version==='$VER';
if(!ok){console.error('ERROR: npm package.json metadata regressed');process.exit(1);}"

(cd "$ROOT/plugin-package/npm" && npm pack ./aaplug2-mcp --silent >/dev/null && ls aaplug2-mcp-*.tgz)
