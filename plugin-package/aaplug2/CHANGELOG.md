# Changelog

## 0.1.4
- Review lessons are now shared so every user gets better checks. After a real (non-demo) learned review result, AA Plug 2 sends one anonymized record to `https://aaplug.com/api/lessons` in the background: `store`, `codes` (guideline / ITMS / fixed Google Play policy ids), `advice_id` (a key of the fixed advice table) and `event` (`rejected` or `passed`). Never the store message, app name, bundle / package id, project id, e-mail, paths or any free text. The result shows the exact record in `lesson.shared`.
- The aggregated feed of other users' lessons is fetched (5-second timeout, cached in `~/.aaplug2/shared-lessons.json` for 12 hours) by `aaplug2_connect_app`, `aaplug2_get_report`, `aaplug2_get_decisions`, `aaplug2_generate_store_materials` and `aaplug2_submission_guide`, and merged into `learned_lessons` with `source: "shared"` / `from: "From other reviews"` (local ones: `source: "local"`, "From your reviews"). Titles and advice come only from the fixed table; server text is ignored. Shared lessons are reminders or warnings, never must-fix, and never recommend ATT because of ads.
- Sharing is always on (no switch). The built-in demo never sends. Network errors and timeouts never affect the tools.
- Web app: the same sharing and "From other reviews" items; a short privacy sentence next to the rejection box and the lessons card.
- Server: a small Cloudflare Worker (`workers/lessons/`) with strict validation (unknown fields rejected), aggregate counts only, hashed one-hour rate limit and no body logging.

## 0.1.3
- Learns from store review results automatically, on this computer only. `aaplug2_report_review` is the trigger: a rejection that is not in the built-in list is no longer forgotten. It becomes a generalized lesson (store, guideline numbers such as 5.1.1(v) or 4.8, ITMS codes, a short title, advice from a fixed table, a pre-submit reminder) and the result returns a fix plan from it (`matched: "learned"`, `status: "fixing"`, `auto_reply: false`), plus an English reply draft with placeholders. Known reasons keep the built-in fix plan and are only counted. Similar rejections update one lesson (`times_seen`) instead of creating duplicates. An approval after a rejection records `times_passed_after`.
- Built-in matching is stricter: when a message cites guideline numbers outside a built-in reason's area (for example a 4.8 or 3.1.1 letter that mentions "log in"), it is learned instead of being mistaken for the demo-account reason.
- Lessons are applied to every later app on this computer: `aaplug2_get_report`, `aaplug2_get_decisions`, `aaplug2_generate_store_materials` and `aaplug2_submission_guide` include `learned_lessons` (a warning when the app has related signals, otherwise a pre-submit check, never a must-fix), the App Store guide gets a "Checks learned from earlier reviews" step before the final step, and App Review notes get the matching note line when one applies. Built-in checks stay the default; learned lessons never recommend ATT because of ads.
- `aaplug2_status` lists the lessons (id, store, codes, title, times_seen, times_passed_after). New tool `aaplug2_forget_lesson` removes one when the user asks.
- Privacy: lessons live in `~/.aaplug2/lessons.json` (or `AAPLUG2_HOME`) with an anonymized `lessons-export.json` for human review. Nothing is uploaded. The shared file never stores the original store message, app names, emails, phone numbers or keys, and learned text is sanitized and treated as data. The built-in demo never writes lessons.
- Web app: pasting a rejection learns the same way, stored only in this browser (`localStorage` key `aaplug2.lessons.v1`); the analysis and the submission guide show the lessons for later apps.

## 0.1.2
- App Store review lessons built into the analysis, the choices, the generated files and the submission guide.
- Tracking: ATT, `PrivacyInfo.xcprivacy`, the App Privacy form and real behavior are checked together. The recommended path for apps with ads is now always no tracking: no ATT prompt or `NSUserTrackingUsageDescription`, `NSPrivacyTracking` false with no tracking domains, non-personalized ad requests (`npa=1`), and App Privacy "No, we do not track". Fixed: earlier versions offered "add ATT" as an option for any app with ads. Mixed declarations are a must-fix (ITMS-91064 or Guideline 2.1). A fully aligned tracking setup is kept, with a warning to keep it aligned.
- Data safety and App Privacy answers no longer mark the advertising ID as "used for tracking" unless the app is on an aligned tracking path. Location used only on the device is declared as not collected. Each data type is listed on its own and is not grouped with sign-in data.
- New checks: core features behind a login (5.1.1(v)), third-party login without Sign in with Apple (now a must-fix), a support page with no contact (1.5), a support URL that points to a homepage, ads mentioned in store text, Android mentioned in App Store text, "free" or brand names in the subtitle or keywords (2.3.7), Android-only secret storage on iOS (2.1(a)), user-supplied AI API keys, a missing `ITSAppUsesNonExemptEncryption`, iPad screenshot sizes, CarPlay without its entitlement, ads turned on by a remote flag, and an iOS deployment target below 15.
- New choices: whether core features work without signing in, and whether location leaves the device.
- New files: a support page in each store language with the contact email at the top, and `forms/app-review-notes.txt`. The review notes cover optional login (`demoAccountRequired = false`), account deletion paths, user-supplied API keys (with a placeholder for a review-only key, never a real key) and tracking.
- The App Store guide covers iPhone 6.7" screenshots (1320×2868, ads off, 3 or more), iPad 13" (2048×2732) when the app supports iPad, the age rating's advertising question for this build, encryption, iOS 15+ and the iOS 26 SDK, and what to do with "Information Needed".
- Rejection help now recognizes ITMS-91064, ATT not seen (2.1), launch failures (2.1(a)), the support URL (1.5), metadata (2.3.7), and Information Needed about API keys. AA Plug 2 never replies to a store itself.
- App Store subtitles and keywords have "free" words (in all five languages) and other brands' names removed.

## 0.1.1
- Default language is English, and five languages are supported: English, Korean, Thai, Simplified Chinese and Hindi (new: Chinese and Hindi UI strings, MCP messages and store-listing text).
- Web app: always opens in English (no browser/device language detection). The globe button in the header switches language on every screen; a manual pick is saved and wins on later visits. Older saved sessions open in English until a language is picked.
- MCP: `lang` accepts `en`, `ko`, `th`, `zh`, `hi`; default `en` when omitted. Server instructions ask the AI to pass the user's language.
- Store-listing languages for your app now default to and recommend English (`["en"]`); Korean, Thai, Simplified Chinese and Hindi listings stay available.
- Docs are in English.
- Operator and author credit removed from the product, the web app footer, the privacy policy, the plugin manifests and the npm package (no `author` field). Contact and feedback: https://aaplug.com (no email).

## 0.1.0
- First version: 10 MCP tools (connect, report, decisions, decide, preview graphics, generate materials, submission guide, approve, review result, status), the `aaplug2-launch` skill and the `launch_my_app` prompt.
