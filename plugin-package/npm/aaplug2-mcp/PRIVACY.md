# AA Plug 2: Privacy

Contact: https://aaplug.com

- **What is read:** project files of the app you connect, such as the manifest, build files, Info.plist, string files, README, icons and screenshots. They are read only on the computer running the AA Plug 2 server.
- **Network:** only when you connect a public GitHub repository. The server then reads that repository through `api.github.com` and `raw.githubusercontent.com`. AA Plug 2 runs no servers of its own and has no analytics, ads, accounts or telemetry.
- **Stored:** analysis results, your choices and generated files are saved in `~/.aaplug2` on that computer (or in `AAPLUG2_HOME`). Delete that folder to remove everything.
- **Review lessons:** when you report a store review result, AA Plug 2 learns from it on this computer only. A generalized lesson (store, guideline or ITMS code, short advice, counters) is saved in `~/.aaplug2/lessons.json`, with an anonymized copy in `lessons-export.json` for your own review. Lessons are never uploaded or sent anywhere. The shared lessons file never keeps the store's original message, app names, emails or keys; the original message stays only in that project's own folder. Delete those files to forget every lesson.
- **Not collected:** no tokens, passwords or store credentials are requested, and nothing is ever submitted to Google Play or the App Store by AA Plug 2.
- **Your AI client:** the assistant you use (Grok Bot, Claude, Cursor, …) sees the tool results under its own privacy terms.
