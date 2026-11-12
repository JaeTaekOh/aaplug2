// AA Plug 2 — 로컬 미리보기 서버 (의존성 없음)
// - 정적 파일 제공
// - /gh?u=<url> : 공개 GitHub(api.github.com / raw.githubusercontent.com / codeload.github.com)만 대신 받아 주는 프록시
//   (브라우저가 CORS·한도 문제로 막힐 때만 앱이 자동으로 사용. 토큰·비밀값 없음)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = +(process.env.PORT || 5180);
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const ALLOW = new Set(['api.github.com', 'raw.githubusercontent.com', 'codeload.github.com']);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/gh') {
    let target;
    try { target = new URL(url.searchParams.get('u')); } catch { res.writeHead(400).end('bad url'); return; }
    if (target.protocol !== 'https:' || !ALLOW.has(target.hostname) || req.method !== 'GET') { res.writeHead(403).end('host not allowed'); return; }
    try {
      const r = await fetch(target, { headers: { 'User-Agent': 'AA-Plug-2-local-preview', Accept: req.headers.accept || '*/*' } });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    } catch (e) { res.writeHead(502).end('upstream error'); }
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT) || /(^|\/)\.|node_modules|server\.mjs/.test(p)) { res.writeHead(404).end('not found'); return; }
  try {
    const s = await stat(file); if (!s.isFile()) throw 0;
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('not found'); }
});
server.listen(PORT, HOST, () => console.log(`AA Plug 2 → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`));
