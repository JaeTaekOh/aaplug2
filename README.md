# AA Plug 2

A free web tool that helps people who built an Android or iOS app with AI get it all the way to **launched on the stores**.
You give one input. Connect the app (a public GitHub URL, a ZIP, or a folder) and from then on you only **pick, approve or reject**.
Nothing is submitted to a store automatically. The final step unlocks only after you approve.

The interface and the MCP tool texts come in five languages: English (`en`, the default), Korean (`ko`), Thai (`th`), Simplified Chinese (`zh`) and Hindi (`hi`). The web app always opens in English (it does not follow the browser or device language); pick another language from the globe button in the header on any screen, and that choice is remembered on this browser. The docs are in English.

## Use it from your AI (MCP · Grok Bot · Claude · Cursor)

You can also skip the website and tell your AI: "Help me launch my app with AA Plug 2". The MCP server lives in `mcp/` and is published on npm as [`aaplug2-mcp`](https://www.npmjs.com/package/aaplug2-mcp) (`npx -y aaplug2-mcp`). Connection steps are in [PLUGIN.md](PLUGIN.md).

```bash
cd mcp && npm start      # stdio
npm test                 # automated tests
```

## Run the web app

```bash
npm start            # = node server.mjs
# open http://127.0.0.1:5180/ in a browser
```

- Node 18 or newer. Nothing to install.
- Change the port with `PORT=8080 npm start`.
- Opening `index.html` directly (file://) also works for the built-in sample and ZIP/folder connections. Public GitHub connections call the GitHub API from the browser and fall back to the local server's `/gh` proxy when blocked.

## Flow

1. Home: connect an app (GitHub URL / ZIP / folder) or **try the sample**
2. Analyze: launch readiness, must-fix / recommended / good to know
3. Decide: on each card, pick one of the AI-made options, or approve / reject
4. Store assets: name and descriptions (English by default and recommended; Korean, Thai, Simplified Chinese or Hindi listings can be added for your app if you want), icon, feature graphic, screenshots, privacy policy, Data safety / App Privacy, content rating (IARC) answers
5. Submit guide: step-by-step copy buttons for Play Console / App Store Connect; the final step unlocks only after approval
6. Review: approved or rejected. Pick the rejection reason to get a fix plan and a reply to the reviewer
7. Live

## Folders

| Path | Contents |
|---|---|
| `index.html`, `privacy.html` | App screens, this tool's privacy policy |
| `css/` | Design (styles.css), shared motion, self-hosted font definitions |
| `js/` | config, i18n (English), zip, sources, analyzer, generator, graphics, app |
| `js/flow.js` | Flow rules shared by the web app and the MCP server |
| `sample/snapledger/` | Built-in sample app source (SnapLedger) |
| `tools/` | Sample data build, sample images, screenshot automation, plugin build |
| `preview-screenshots/` | Screen captures (desktop 1366 / mobile 390) |
| `sample-output/` | Example ZIP you get after finishing the sample |
| `mcp/` | MCP server (for Grok Bot, Claude, Cursor) |
| `workers/lessons/` | Cloudflare Worker for `https://aaplug.com/api/lessons` (shared, anonymized review lessons) |
| `plugin-src/`, `plugin-package/` | Plugin source and build output (`bash tools/build_plugin.sh`) |

## Settings

`js/config.js`
- `feedbackUrl`: where the feedback button points (https://aaplug.com)
- `showAdSlotPlaceholder`: ad space placeholder (not a real ad). Set `false` to hide it

## Rebuild the sample / recapture screens

```bash
npm run sample   # sample/snapledger → js/sample-data.js
npm run shots    # needs the server running; updates preview-screenshots/
```

## Principles

- Free, static files only, never asks for API keys or tokens
- App files are read only inside the browser and uploaded nowhere (progress is saved only in this browser's localStorage)
- Shared review lessons (0.1.4): a real pasted store result sends only `{store, codes, advice_id, event}` to `https://aaplug.com/api/lessons` so everyone gets better checks; never the store message, app name, ids or free text. Always on, explained in `privacy.html`; the demo never sends
- Shared review lessons (0.1.4): a real pasted store result sends only `{store, codes, advice_id, event}` to `https://aaplug.com/api/lessons` so everyone gets better checks; never the store message, app name, ids or free text. Always on, explained in `privacy.html`; the demo never sends
- Nothing after launch

## License

MIT (see LICENSE). Feedback: https://aaplug.com
