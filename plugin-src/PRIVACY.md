# AA Plug 2: Privacy

Contact: https://aaplug.com

- **What is read:** project files of the app you connect, such as the manifest, build files, Info.plist, string files, README, icons and screenshots. They are read only on the computer running the AA Plug 2 server.
- **Network:** only when you connect a public GitHub repository. The server then reads that repository through `api.github.com` and `raw.githubusercontent.com`. AA Plug 2 runs no servers of its own and has no analytics, ads, accounts or telemetry.
- **Stored:** analysis results, your choices and generated files are saved in `~/.aaplug2` on that computer (or in `AAPLUG2_HOME`). Delete that folder to remove everything.
- **Not collected:** no tokens, passwords or store credentials are requested, and nothing is ever submitted to Google Play or the App Store by AA Plug 2.
- **Your AI client:** the assistant you use (Grok Bot, Claude, Cursor, …) sees the tool results under its own privacy terms.
