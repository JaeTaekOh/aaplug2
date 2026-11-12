---
name: aaplug2-launch
description: Publish an app the user already built (Android and/or iOS) to Google Play and the App Store with the AA Plug 2 tools. Use when the user says their app is finished, asks how to release or publish it, needs store listing text, a privacy policy, Data safety or App Privacy answers, a content rating, store graphics, or help with a store rejection.
---

# Launch an app with AA Plug 2

AA Plug 2 takes an app the user already built and gets it to "launched" on Google Play and/or the App Store. It stops at launch. It is free and never needs API keys, tokens, or passwords.

## Rules
- The user does not fill forms. Connect the app once, then only show choices. The user picks, approves, or rejects.
- Call `aaplug2_decide` only with options the user actually chose. Use `accept_all_recommended` only when the user says to accept all recommendations.
- Never say the app was submitted. AA Plug 2 never submits. The user presses the submit button in Play Console or App Store Connect after approving with `aaplug2_approve_submission`.
- Tool texts come in five languages: `en` (English, the default), `ko` (Korean), `th` (Thai), `zh` (Simplified Chinese) and `hi` (Hindi). Pass the user's language as `lang` on every call; if you leave it out, texts are in English. Reply to the user in their language.
- Store listings default to English (`langs: ["en"]`, the recommended choice). Korean (`ko`), Thai (`th`), Simplified Chinese (`zh`) or Hindi (`hi`) listings for the user's app can be added when the user picks them.

## Flow
1. `aaplug2_connect_app`: use a public GitHub URL (`source: "github"`), a folder or .zip on the computer running the server (`source: "path"`), or the demo (`source: "sample"`). Keep the returned `project_id`.
2. Summarize the readiness percentage and must-fix items in plain words.
3. `aaplug2_get_decisions`: present the options, recommended first. Use `aaplug2_preview_graphics` to show icon, feature graphic, and screenshot options.
4. `aaplug2_decide` with the user's picks. Repeat until `open_count` is 0.
5. `aaplug2_generate_store_materials`: show the listing text and tell the user where the folder and ZIP are.
6. `aaplug2_submission_guide` for each store: walk through the steps and the values to paste.
7. When the user explicitly approves, call `aaplug2_approve_submission`. This unlocks the final step.
8. `aaplug2_report_review` with `submitted`, `rejected` (with the store's message, which returns a fix plan and a reply), `resubmitted`, or `approved`. When every chosen store is live, congratulate the user. The job is done.

Use `aaplug2_status` to resume in a new conversation.
