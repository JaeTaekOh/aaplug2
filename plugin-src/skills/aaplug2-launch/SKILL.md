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

## Learning from review results
- Every reported review result is learned on this computer automatically; there is no separate save step. A rejection the tools do not know becomes a generalized lesson and returns a fix plan (`matched: "learned"`); a known one returns the built-in plan and is counted. An approval records that the learned checks were part of a later approval.
- Show `learned_lessons` from the report, decisions, guide and generated materials to the user: warnings when the app has related signals, otherwise checks to do before submitting. They add to the built-in checks and never replace them (for example, never suggest ATT because of ads).
- Lessons stay on this computer and contain no original store message. Use `aaplug2_forget_lesson` only when the user asks to drop one. Still never reply to a store yourself.

## App Store review rules to explain (the tools already check them)
- Tracking must tell one story from the first submit: ATT, `PrivacyInfo.xcprivacy`, the App Privacy form, and what the app really does. For apps with ads the default is no ATT prompt and no `NSUserTrackingUsageDescription`, `NSPrivacyTracking` false with no tracking domains, non-personalized ad requests (`npa=1`), and App Privacy "No, we do not track". Never tell the user to add ATT just because the app shows ads. A mixed setup leads to ITMS-91064 or a Guideline 2.1 rejection. If the app already has a fully aligned tracking setup, keep it aligned.
- The App Privacy form is separate from the build. Remind the user to check it right before submitting.
- Core features should work without signing in (Guideline 5.1.1(v)). A third-party login on iOS also needs Sign in with Apple. Apps with accounts need deletion both in the app and on a web page.
- The Support URL must open a page that shows a contact method. Mention ads only in the privacy policy. Keep "free" and other brands' names out of the subtitle and keywords, and keep Android out of App Store text.
- If users bring their own AI API key, the review notes must say there is no in-app purchase or subscription, that users get the key from a third party, and that the developer does not sell keys. Ask the user to attach a review-only key. Never write a real key anywhere.
- In App Store Connect, "Information Needed" also shows as Rejected. It asks for a reply, often without a new build. Draft the reply; the user sends it. Never reply to a store yourself.
