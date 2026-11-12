# AA Plug 2 MCP server

- Run: `npm start` (stdio) · `npm run http` (http://127.0.0.1:5181/mcp) · `npm test`
- Single-file bundle: `npm run bundle` → `dist/aaplug2-mcp.mjs`
- How to connect: `../PLUGIN.md`
- The analysis and generation logic loads the web app's `../js/*.js` as-is (`lib/runtime.mjs`).
- Languages: the optional `lang` argument accepts `en` (default), `ko`, `th`, `zh` (Simplified Chinese) and `hi` (Hindi). Omitted → English. Store listings default to English; ko/th/zh/hi listings are optional.
