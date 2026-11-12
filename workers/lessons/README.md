# AA Plug 2 shared lessons API (Cloudflare Worker)

`https://aaplug.com/api/lessons` — the only path this Worker handles. Every other path is passed to the origin (the site on GitHub Pages).

- `POST` — body must be exactly `{ "v": 1, "event": "rejected" | "passed", "store": "apple" | "play", "codes": [...], "advice_id": "..." }`
  (`v` and `event` optional). `codes`: App Review guideline numbers (`5.1.1(v)`), `ITMS-#####`, or a fixed Google Play policy id.
  `advice_id`: a key of the fixed table (`src/table.js`, generated from `js/lessons.js`). Any other field, free text, or body over 2 KB is rejected.
  Rate limit: 30 posts per hour per salted IP hash (KV key expires after 1 hour). Returns `202`.
- `GET` — `{ lessons: [{ store, codes, advice_id, title, advice, count, passed, last_seen }] }`, titles / advice only from the fixed table.
  Cached (`Cache-Control: public, max-age=900`). `?test=1` shows only the test-only rows (`advice_id: "test"`), which never appear in the public feed.
- Storage: one KV namespace (`LESSONS`), key `feed:v1` = aggregate rows (store + advice id + codes → count / passed / first / last day). No per-user rows, no IPs, no bodies.

## Build and test
```bash
node workers/lessons/build-table.mjs        # after changing js/lessons.js tables
node workers/lessons/test/worker.test.mjs   # local tests with an in-memory KV
```

## Deploy
Free tier only (Workers + KV) on the Cloudflare account that holds the aaplug.com zone. Upload `src/index.js` + `src/table.js` as an ES module
Worker named `aaplug2-lessons` with the KV binding `LESSONS`, and add the routes `aaplug.com/api/lessons*` and `www.aaplug.com/api/lessons*`.
Routes only run when the hostname's DNS record is proxied (orange cloud).
