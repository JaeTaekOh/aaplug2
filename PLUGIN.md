# Connecting AA Plug 2 (Grok Bot · Claude · Cursor · other MCP apps)

AA Plug 2 runs as **one MCP server**. Connect it once to an AI such as Grok Bot, Claude or Cursor, and the user never has to open a website. They just tell the AI:

> "Help me launch my app with AA Plug 2: https://github.com/me/my-app"
> "Show me AA Plug 2 with the sample app"

From then on the user only **picks, approves or rejects** the options the AI shows. Store submission is pressed by the user in the console after they approve; AA Plug 2 never submits anything by itself.

- Contact: https://aaplug.com · Free · No API keys or tokens
- Languages: tool texts in English (default), Korean, Thai, Simplified Chinese and Hindi via the `lang` argument (`en`, `ko`, `th`, `zh`, `hi`); store listings default to English
- npm package: [`aaplug2-mcp`](https://www.npmjs.com/package/aaplug2-mcp), run with `npx -y aaplug2-mcp`
- Source: https://github.com/JaeTaekOh/aaplug2 (MIT)
- Requires: Node.js 20 or newer

✅ = connection verified on a real client. 📄 = based on official docs only, not clicked through.

---

## 1. Grok Bot

### 1-1. Add it as a "Command" server 📄

**Option A: ask your Bot**
> "Add an MCP server. Name AA Plug 2, command `npx`, arguments `-y aaplug2-mcp`"

**Option B: in the desktop app**
1. Open **Connect apps** in the left sidebar.
2. Click **Add a custom connector** at the bottom.
3. Name: `AA Plug 2`
4. Type: **Command**
5. Command: `npx`
6. Arguments: `-y aaplug2-mcp`
7. Click **Add plugin**.
8. From the next message on, the Bot can use the 10 `aaplug2_…` tools.

Source: [Use the computer and apps](https://docs.x.ai/grok-bot/computer-and-apps): a Bot can add an MCP server that is not in the catalog by URL or by a command run on the Bot's computer, choosing Remote HTTPS or Command under Add a custom connector.

### 1-2. Remote HTTPS 📄 (not available yet)

Grok Bot also accepts MCP servers at a public HTTPS address. AA Plug 2 has an HTTP mode (`--http`), but no public HTTPS deployment exists. A local address (`http://127.0.0.1`) cannot be used by Grok Bot, because it connects from the cloud.

### 1-3. Marketplace listing (not submitted)

| Item | What we found | Source |
|---|---|---|
| Channel 1 | SpaceXAI form `x.ai/bot/marketplace/submit-a-plugin`: submit a plugin or MCP server to be distributed to Grok, Grok Bot and Cursor users after review | The form page |
| Channel 2 | Cursor Marketplace `cursor.com/marketplace/publish`: submit a **public Git repository**, reviewed by the Cursor team | [Cursor Plugins reference](https://cursor.com/docs/reference/plugins) |
| Package format | Cursor Plugin: `.cursor-plugin/plugin.json` (required `name`) + `mcp.json` + `skills/` | Cursor docs |
| Terms | Submitting means agreeing to the Cursor Marketplace Publisher Terms | [Publisher Terms](https://cursor.com/marketplace-publisher-terms) |

---

## 2. Claude ✅ (verified in Claude Code)

### Claude Code (terminal)
```bash
claude mcp add aaplug2 -- npx -y aaplug2-mcp
claude mcp list        # → aaplug2: ... ✔ Connected
```
Local HTTP mode:
```bash
npx -y aaplug2-mcp --http          # http://127.0.0.1:5181/mcp
claude mcp add --transport http aaplug2-http http://127.0.0.1:5181/mcp
```

**As a local plugin:** `claude --plugin-dir plugin-package/aaplug2` shows `plugin:aaplug2:aaplug2 … ✔ Connected`. `claude plugin validate` passes.

### Claude Desktop 📄
Settings → Developer → **Edit Config** opens `claude_desktop_config.json`. Add the block below, then fully quit and reopen the app.
```json
{
  "mcpServers": {
    "aaplug2": { "command": "npx", "args": ["-y", "aaplug2-mcp"] }
  }
}
```
File location: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Source: [MCP docs](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

---

## 3. Cursor ✅ (verified in Cursor CLI)

Project `.cursor/mcp.json` or `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "aaplug2": { "command": "npx", "args": ["-y", "aaplug2-mcp"] }
  }
}
```
With the Cursor CLI, `mcp enable aaplug2` → `mcp list` shows `aaplug2: ready` and `mcp list-tools aaplug2` shows 11 tools. HTTP mode (`"url": "http://127.0.0.1:5181/mcp"`) is also ready.
Cursor IDE asks you to approve the server the first time.

---

## 4. Other MCP apps ✅

- **stdio:** command `npx -y aaplug2-mcp` (or `node mcp/server.mjs` from a checkout). Verified with the MCP Inspector CLI:
  ```bash
  npx @modelcontextprotocol/inspector --cli npx -y aaplug2-mcp --method tools/list
  ```
- **Streamable HTTP:** `npx -y aaplug2-mcp --http [--port 5181] [--host 127.0.0.1]` → endpoint `http://127.0.0.1:5181/mcp` (POST, stateless).
  - Host and Origin headers are checked; other Origins get 403.
  - In HTTP mode, reading paths on the server's disk (`source: "path"`) is off by default (turn on with `AAPLUG2_ALLOW_PATH=1`), and the result ZIP is returned inline.

## Environment variables

| Name | Default | Meaning |
|---|---|---|
| `AAPLUG2_HOME` | `~/.aaplug2` | Folder for progress and generated materials |
| `AAPLUG2_ALLOW_PATH` | on for stdio / off for HTTP | Allow connecting local folders and ZIPs |
| `AAPLUG2_ALLOWED_ORIGINS` | none | Origins allowed in HTTP mode (comma separated) |
| `AAPLUG2_ALLOWED_HOSTS` | localhost port | Hosts allowed in HTTP mode |

Tool texts come in `en` (default), `ko`, `th`, `zh` (Simplified Chinese) and `hi` (Hindi). The AI passes the user's language as the optional `lang` argument on each call; when it is left out, texts are in English. Store listings for the user's app default to English (`langs: ["en"]`, recommended); Korean, Thai, Chinese and Hindi listings can be added if the user picks them.

## Example conversation

1. User: "My app is done. Help me launch it with AA Plug 2. github.com/me/myapp"
2. The AI calls `aaplug2_connect_app` and says: "Launch readiness is 35%. There are 5 must-fix items."
3. The AI calls `aaplug2_get_decisions` and asks: "For the store name: ① SnapLedger ② SnapLedger - Budget tracker. Which one?" Icons and feature graphics are shown as images via `aaplug2_preview_graphics`.
4. User: "Number 2. Recommended for the rest." → `aaplug2_decide`
5. The AI makes the store text, policies, form answers, graphics and ZIP with `aaplug2_generate_store_materials`.
6. The AI walks through Play Console with `aaplug2_submission_guide`, giving the value to paste at each step. The final step is locked.
7. User: "OK, I'll submit." → `aaplug2_approve_submission`. The user presses the submit button in the console.
8. User: "Apple rejected it. (pastes message)" → `aaplug2_report_review` returns a fix plan and a reply.
9. User: "Both are live!" → Launched. AA Plug 2's job ends here.
