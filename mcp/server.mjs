#!/usr/bin/env node
/* AA Plug 2 MCP 서버 (by MOTOR AA)
   stdio (기본):   node server.mjs
   HTTP (로컬):    node server.mjs --http [--port 5181] [--host 127.0.0.1]   →  http://127.0.0.1:5181/mcp  (Streamable HTTP)
   stdout 에는 MCP 메시지만 쓴다. 로그는 stderr. */
import http from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, VERSION } from './lib/tools.mjs';
import { HOME } from './lib/engine.mjs';
import { hasGraphics } from './lib/runtime.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const log = (...a) => console.error('[aaplug2]', ...a);

if (argv.includes('--version')) { console.log(VERSION); process.exit(0); }

if (!argv.includes('--http')) {
  const server = createServer({ allowPath: process.env.AAPLUG2_ALLOW_PATH !== '0', inlineZip: process.env.AAPLUG2_INLINE_ZIP === '1' });
  await server.connect(new StdioServerTransport());
  log(`AA Plug 2 MCP ${VERSION} on stdio · data ${HOME} · graphics ${hasGraphics ? 'on' : 'off'}`);
} else {
  const port = Number(arg('port', process.env.PORT || 5181));
  const host = arg('host', process.env.HOST || '127.0.0.1');
  const local = ['127.0.0.1', 'localhost', '::1'].includes(host);
  /* HTTP 에서는 서버 디스크 경로 읽기를 기본으로 끈다 (원격 호출자가 서버 파일을 읽지 못하게). 내 컴퓨터에서만 쓸 때 AAPLUG2_ALLOW_PATH=1 */
  const allowPath = process.env.AAPLUG2_ALLOW_PATH === '1';
  const allowedOrigins = (process.env.AAPLUG2_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowedHosts = (process.env.AAPLUG2_ALLOWED_HOSTS || (local ? `127.0.0.1:${port},localhost:${port},[::1]:${port}` : '')).split(',').map(s => s.trim()).filter(Boolean);
  const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    /* DNS rebinding 방지: Host·Origin 확인 (MCP 사양 Streamable HTTP 보안 경고) */
    if (allowedHosts.length && !allowedHosts.includes(req.headers.host)) return send(res, 403, { error: 'host not allowed' });
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return send(res, 403, { jsonrpc: '2.0', error: { code: -32000, message: 'origin not allowed' }, id: null });
    if (url.pathname === '/' && req.method === 'GET') return send(res, 200, { name: 'AA Plug 2 MCP', by: 'MOTOR AA', version: VERSION, endpoint: '/mcp', transport: 'streamable-http' });
    if (url.pathname !== '/mcp') return send(res, 404, { error: 'not found' });
    if (req.method !== 'POST') return send(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server: POST only)' }, id: null });
    let body = ''; for await (const c of req) { body += c; if (body.length > 2e6) return send(res, 413, { error: 'too large' }); }
    let parsed; try { parsed = JSON.parse(body); } catch { return send(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }); }
    /* 상태 없는 방식: 요청마다 서버·전송을 새로 만든다 (프로젝트 상태는 디스크의 project_id 로 이어짐) */
    const server = createServer({ allowPath, inlineZip: true });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, parsed); }
    catch (e) { log(e); if (!res.headersSent) send(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }); }
  });
  srv.listen(port, host, () => log(`AA Plug 2 MCP ${VERSION} on http://${host}:${port}/mcp · data ${HOME} · local paths ${allowPath ? 'on' : 'off'} · graphics ${hasGraphics ? 'on' : 'off'}`));
}
