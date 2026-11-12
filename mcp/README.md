# AA Plug 2 MCP 서버

- 실행: `npm start` (stdio) · `npm run http` (http://127.0.0.1:5181/mcp) · `npm test`
- 한 파일 번들: `npm run bundle` → `dist/aaplug2-mcp.mjs`
- 연결 방법: `../PLUGIN.md` · 빌드 보고서: `../PLUGIN-BUILD.md`
- 분석·생성 로직은 웹 앱의 `../js/*.js` 를 그대로 불러 씁니다 (`lib/runtime.mjs`).
