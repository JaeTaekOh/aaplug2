# Changelog

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
