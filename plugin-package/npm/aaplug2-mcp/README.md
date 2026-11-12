# AA Plug 2

**From "my app is done" to "launched" on Google Play and the App Store. You only pick and approve.**
Free · no API keys · English (default) + 한국어 · ภาษาไทย · 中文 · हिन्दी · feedback: https://aaplug.com

AA Plug 2 is an MCP server (plus a skill) for people who built an Android and/or iOS app with AI. Connect the app once, and your AI assistant can:

- find what blocks store review (target SDK, permissions, missing privacy policy, account deletion, iOS privacy manifest, empty permission texts, ads ID, closed-test rule…)
- prepare code fixes as a diff, so you choose to apply or skip each one
- write store listings (title, short and full description, App Store subtitle, keywords, promo text) in English by default; Korean, Thai, Simplified Chinese or Hindi listings for your app can be added if you pick them
- write a privacy policy and an account-deletion page that match what the app really uses
- answer Google Play Data safety, Apple App Privacy and the IARC content-rating questionnaire
- make store graphics: 512×512 icon, 1024×500 feature graphic, 1080×1920 screenshots
- guide Play Console and App Store Connect step by step, with the value for every field
- turn a rejection message into a fix plan and a reply to the reviewer

**Nothing is submitted automatically.** The final step unlocks only after you approve, and you press the store's submit button yourself.

## Tools

| Tool | What it does |
|---|---|
| `aaplug2_connect_app` | Connect once (public GitHub URL, local folder/ZIP, or the built-in sample) and analyze |
| `aaplug2_get_report` | Readiness score and issues in plain language |
| `aaplug2_get_decisions` | Choices with ready-made options and a recommendation |
| `aaplug2_decide` | Record what the user picked |
| `aaplug2_preview_graphics` | Show icon / feature graphic / screenshot options |
| `aaplug2_generate_store_materials` | Build the full launch kit (folder + ZIP) |
| `aaplug2_submission_guide` | Console steps per store; final step locked until approval |
| `aaplug2_approve_submission` | Record the user's explicit approval (does not submit) |
| `aaplug2_report_review` | submitted / rejected / resubmitted / approved |
| `aaplug2_status` | Where am I, what's next, and the review lessons learned on this computer |
| `aaplug2_forget_lesson` | Remove one learned review lesson (only when the user asks) |

## Try it

Ask your assistant: *"Use AA Plug 2 with the sample app."* or *"My app is finished: https://github.com/you/your-app. Help me launch it with AA Plug 2."*

## Requirements and data

- Node.js 20 or later. The server runs on the computer of the AI client (stdio).
- App files are read only on that computer. Public GitHub repos are read through the GitHub public API. Apart from the anonymized review-lesson record below, nothing is uploaded. No telemetry, no accounts.
- Progress is saved in `~/.aaplug2` (change it with `AAPLUG2_HOME`).
- Review results you report are learned locally: an unknown rejection becomes a generalized lesson in `~/.aaplug2/lessons.json` (no original store message, app names or emails) and is reused as warnings, pre-submit checks and review-note lines for your later apps. To improve checks for everyone, an anonymized record (store, guideline / ITMS / Play policy codes, a fixed advice id; never the store message, app name or ids) is sent to `https://aaplug.com/api/lessons`, and other users' combined lessons are shown as "From other reviews" reminders. Sharing is always on; the demo never sends; the plugin works normally if the server is unreachable.
- Graphics need the optional `@napi-rs/canvas` package. Run `npm install` in `mcp/` to turn graphics on. Without it, everything else still works.

- Languages: tool texts come in English (default), Korean, Thai, Simplified Chinese and Hindi (`lang`: `en`, `ko`, `th`, `zh`, `hi`); without `lang` they are in English. Store listings default to English.

See PRIVACY.md. Source: https://github.com/JaeTaekOh/aaplug2 · MIT License (see LICENSE).
