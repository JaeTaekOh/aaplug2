/* AA Plug 2 MCP — 웹 앱의 브라우저 모듈(js/*.js)을 Node 에서 그대로 불러 쓰는 얇은 실행 환경.
   분석·생성 로직은 다시 쓰지 않고 웹 앱과 같은 파일을 공유한다. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DOMParser as LinkeDOMParser } from 'linkedom';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.AAPLUG2_ROOT || path.resolve(HERE, '..', '..');
const JS = path.join(ROOT, 'js');

let canvasLib = null;
try { canvasLib = await import('@napi-rs/canvas'); } catch { canvasLib = null; }
export const hasGraphics = !!canvasLib;

const g = globalThis;
g.window = g;
if (!g.location) g.location = { protocol: 'file:' };   // 웹 앱의 /gh 프록시 재시도를 끈다 (Node 는 GitHub 에 바로 접속)

/* DOMParser: 웹 앱은 'application/xml' 로 부른다 → linkedom 의 XML 파서로 넘긴다 */
class DOMParserShim {
  parseFromString(s, type) {
    const doc = new LinkeDOMParser().parseFromString(s, /xml/.test(type) ? 'text/xml' : type);
    return doc;
  }
}
g.DOMParser = DOMParserShim;

/* FileReader.readAsDataURL 만 쓴다 */
g.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(b => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onload && this.onload(); },
      e => { this.error = e; this.onerror && this.onerror(e); });
  }
};

if (canvasLib) {
  const { createCanvas, loadImage, GlobalFonts } = canvasLib;
  const reg = (file, fam) => { try { GlobalFonts.registerFromPath(file, fam); } catch { } };
  const fontDirs = [[path.join(HERE, '..', 'fonts'), 'Pretendard Variable', /\.otf$/i], [path.join(ROOT, 'fonts', 'plex-sans'), 'IBM Plex Sans', /\.woff2$/i], [path.join(ROOT, 'fonts', 'plex-thai'), 'IBM Plex Sans Thai', /\.woff2$/i]];
  for (const [dir, fam, re] of fontDirs) { try { for (const f of fs.readdirSync(dir)) if (re.test(f)) reg(path.join(dir, f), fam); } catch { } }
  /* Image: 웹 코드처럼 onload/onerror 뒤에 src 를 넣는 방식 지원 */
  g.Image = class {
    constructor() { this.onload = null; this.onerror = null; this._img = null; this.width = 0; this.height = 0; }
    set src(v) {
      const m = String(v).match(/^data:[^;,]*;base64,(.*)$/);
      if (!m) { setImmediate(() => this.onerror && this.onerror(new Error('only data URLs'))); return; }
      loadImage(Buffer.from(m[1], 'base64')).then(img => { this._img = img; this.width = img.width; this.height = img.height; this.onload && this.onload(); },
        e => this.onerror && this.onerror(e));
    }
  };
  /* drawImage 에 shim Image 를 넘기면 내부 이미지로 바꿔 준다 */
  const wrapCtx = ctx => {
    const di = ctx.drawImage.bind(ctx);
    ctx.drawImage = (im, ...a) => di(im && im._img ? im._img : im, ...a);
    return ctx;
  };
  g.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error('unsupported element ' + tag);
      const c = createCanvas(300, 150); const gc = c.getContext.bind(c); let ctx = null;
      c.getContext = (k) => (ctx = ctx || wrapCtx(gc(k)));
      return c;
    },
    fonts: { load: async () => [] }
  };
} else {
  g.document = { createElement() { throw new Error('graphics unavailable'); }, fonts: { load: async () => [] } };
}

const ORDER = ['config.js', 'i18n-en.js', 'i18n-ko.js', 'i18n-th.js', 'i18n-zh.js', 'i18n-hi.js', 'i18n-stage.js', 'i18n.js', 'zip.js', 'sample-data.js', 'sources.js', 'analyzer.js', 'generator.js', 'graphics.js', 'flow.js', 'lessons.js'];
for (const f of ORDER) {
  const file = path.join(JS, f);
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

export const CFG = g.AAP_CONFIG, Analyzer = g.AAPAnalyzer, Gen = g.AAPGen, Gfx = g.AAPGfx, Flow = g.AAPFlow, Sources = g.AAPSources, Zip = g.AAPZip, Lessons = g.AAPLessons;
export const tr = (lang, k, v) => g.AAPi18n.t(lang, k, v);
