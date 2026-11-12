# Changelog

## 0.1.1
- Default language is English, and five languages are supported: English, Korean, Thai, Simplified Chinese and Hindi (new: Chinese and Hindi UI strings, MCP messages and store-listing text).
- Web app: always opens in English (no browser/device language detection). The globe button in the header switches language on every screen; a manual pick is saved and wins on later visits. Older saved sessions open in English until a language is picked.
- MCP: `lang` accepts `en`, `ko`, `th`, `zh`, `hi`; default `en` when omitted. Server instructions ask the AI to pass the user's language.
- Store-listing languages for your app now default to and recommend English (`["en"]`); Korean, Thai, Simplified Chinese and Hindi listings stay available.
- Docs are in English.
- Operator and author credit removed from the product, the web app footer, the privacy policy, the plugin manifests and the npm package (no `author` field). Contact and feedback: https://aaplug.com (no email).

## 0.1.0
- First version: 10 MCP tools (connect, report, decisions, decide, preview graphics, generate materials, submission guide, approve, review result, status), the `aaplug2-launch` skill and the `launch_my_app` prompt.
