# AA Plug 2 — MCP 서버·플러그인 빌드 보고서

> **Update 0.1.1 (2026-11-12):** Default language is now English, and AA Plug 2 supports five languages: English (`en`, default), Korean (`ko`), Thai (`th`), Simplified Chinese (`zh`) and Hindi (`hi`). The web app opens in English (no browser/device-language detection); the header globe button switches language on every screen and the manual pick is saved (`localStorage` key `aaplug2.uiLang`). New `js/i18n-zh.js` and `js/i18n-hi.js` (436 keys each, same as en/ko/th); zh/hi MCP messages and zh/hi store-listing, policy, rating and guide text in `generator.js` / `flow.js`. MCP `lang` accepts `en|ko|th|zh|hi`, default `en`; `normLang` maps `zh-TW`/`zh-CN`/`zh-Hans`/`zh-Hant` → `zh` and anything unknown → `en`. Store-listing languages default to and recommend `["en"]`; ko/th/zh/hi listings stay optional. zh/hi UI text uses system fonts (PingFang SC / Microsoft YaHei / Noto Sans CJK SC; Noto Sans Devanagari / Nirmala UI); no new font files are bundled. Statements below about Korean being the default, device-language detection or KO/EN/TH only describe 0.1.0 and no longer apply.

작성: 2026-11-12 (Asia/Bangkok, UTC+7)
위치: `/workspace/aaplug2` (이 컴퓨터에만 있음)
하지 않은 일: npm 공개, GitHub 공개, 마켓플레이스 제출, motoraa.com 변경

## 1. 만든 것

**MCP 서버 하나로 Grok Bot과 다른 AI를 함께 지원합니다.** Grok Bot의 앱 연결 카탈로그는 Cursor Plugin 형식(`.cursor-plugin/plugin.json` + `mcp.json`)의 MCP 서버를 쓰고, Claude와 Cursor도 같은 MCP 서버를 그대로 연결합니다. 그래서 서버는 하나만 두고, 감싸는 manifest만 형식별로 만들었습니다.

| 경로 | 내용 |
|---|---|
| `mcp/server.mjs` | MCP 서버 진입점. 기본은 stdio, `--http`를 주면 Streamable HTTP(`/mcp`) |
| `mcp/lib/runtime.mjs` | 웹 앱의 `js/*.js`(분석기·생성기·그래픽·흐름)를 Node에서 그대로 불러오는 얇은 실행 환경. linkedom이 DOMParser, @napi-rs/canvas가 canvas 역할 |
| `mcp/lib/engine.mjs` | 흐름 엔진: 연결 → 보고 → 결정 → 그래픽 → 자료 → 안내 → 승인 → 심사 → 출시 완료. 상태는 `~/.aaplug2/projects/<id>/state.json` |
| `mcp/lib/tools.mjs` | 도구 11개, 프롬프트 1개, 서버 instructions |
| `mcp/lib/messages.mjs` | MCP용 안내 문구 en(기본)/ko/th/zh/hi |
| `mcp/test/run.mjs` | 자동 테스트 |
| `mcp/fonts/` | 그래픽용 Pretendard OTF(OFL). 웹 폰트는 잘게 나뉜 파일이라 서버에서는 한글이 깨져서 따로 둠 |
| `mcp/dist/aaplug2-mcp.mjs` | 의존성을 한 파일로 묶은 서버(`npm run bundle`). canvas만 선택 의존성 |
| `js/flow.js` (새 공용 모듈) | 결정 목록, 추천값, 고른 문구, 제출 안내 단계, 묶음 파일 목록. **웹 앱 `app.js`도 이제 이 모듈을 씀**(중복 없음) |
| `plugin-src/` | 플러그인 원본: manifest 2종, `mcp.json`, skill, README, PRIVACY, CHANGELOG |
| `tools/build_plugin.sh` | 플러그인 패키지와 npm 준비본을 만드는 스크립트 |
| `plugin-package/aaplug2/` | 제출용 저장소 내용이 될 폴더(Cursor Plugin과 Claude Code 플러그인 형식을 한 폴더에) |
| `plugin-package/aaplug2-plugin-0.1.0.zip` | 위 폴더를 묶은 ZIP |
| `plugin-package/npm/aaplug2-mcp-0.1.0.tgz` | `npx -y aaplug2-mcp`로 실행되는 npm 패키지 준비본(**공개 안 함**) |

웹 앱 쪽 변경:
- `app.js`의 결정·안내·묶음 로직을 `js/flow.js`로 옮기고, `index.html`에 `flow.js`를 넣었습니다.
- `graphics.js`의 줄바꿈을 `Intl.Segmenter` 단어 경계로 바꿔, 띄어쓰기가 없는 태국어 문구가 잘리지 않게 했습니다.
- 바꾼 뒤 웹 앱 자동 클릭 테스트(ko/th/en × 데스크톱/모바일)에서 콘솔 오류 0을 확인했고, 스크린샷 60장도 새로 찍었습니다.

### 도구 목록

| 도구 | 하는 일 |
|---|---|
| `aaplug2_connect_app` | 앱 한 번 연결(source: github / path / sample)과 분석. project_id를 돌려줌 |
| `aaplug2_get_report` | 출시 준비도와 문제 목록(쉬운 말 이유, AI 수정안) |
| `aaplug2_get_decisions` | 사용자가 고를 항목과 추천안(수정안 적용 여부, 스토어, 이름, 짧은 설명, 말투, 카테고리, 언어, 아이콘, 대표 그래픽, 스크린샷, 방침, 데이터 보안, 등급, 출시 방식) |
| `aaplug2_decide` | 사용자가 고른 값 기록. 전체 추천 적용은 사용자가 명시했을 때만. 결정을 바꾸면 이전 승인과 자료는 무효 |
| `aaplug2_preview_graphics` | 아이콘 3안, 대표 그래픽 3안, 스크린샷을 이미지로 보여 줌 |
| `aaplug2_generate_store_materials` | 결정이 모두 끝나야 실행됨. 폴더와 ZIP(샘플 기준 22개 파일)을 만들고 문구 반환 |
| `aaplug2_submission_guide` | Play Console / App Store Connect 단계별 안내와 칸마다 넣을 값. 마지막 단계는 잠김 |
| `aaplug2_approve_submission` | 사용자의 명시적 승인 기록(본인 말을 함께 저장). 마지막 단계만 열고 **제출하지 않음** |
| `aaplug2_report_review` | submitted / rejected(메시지 → 수정 계획·답장) / resubmitted / approved. 고른 스토어가 모두 출시되면 끝 |
| `aaplug2_status` | 현재 단계와 다음 할 일, 또는 프로젝트 목록, 이 컴퓨터에서 배운 심사 교훈 |
| `aaplug2_forget_lesson` | 배운 심사 교훈 하나 지우기 (사용자가 요청할 때만) |
| (공통) `mcp/lib/lessons.mjs`, `js/lessons.js` | 심사 결과 자동 학습: `~/.aaplug2/lessons.json` (원문 없음), `lessons-export.json` (익명) |

- 프롬프트 `launch_my_app` 1개.
- 서버 instructions에 규칙을 넣었습니다: 폼 금지, 사용자가 고른 값만 기록, 자동 제출 없음, 사용자 언어로 답하기.
- 도구마다 annotations(readOnly 등)를 붙였습니다.

안전장치:
- 승인 전에는 `submitted` 보고를 거부합니다.
- 결정이 남아 있으면 자료를 만들지 않습니다.
- 잘못된 값은 거부합니다.
- HTTP 모드: 서버 디스크 경로 연결은 기본으로 꺼져 있습니다. Host·Origin을 확인하고(MCP 사양의 DNS rebinding 경고 반영), 127.0.0.1에만 붙습니다.

## 2. 실행

```bash
cd /workspace/aaplug2/mcp
npm start                      # stdio (AI 앱이 이 명령을 실행)
npm run http                   # http://127.0.0.1:5181/mcp
npm test                       # 자동 테스트
cd .. && npm run plugin:build  # plugin-package/ 다시 만들기
```
처음 받은 경우 `cd mcp && npm install`이 필요합니다. 이 컴퓨터에는 이미 설치돼 있습니다.

## 3. 테스트 결과 (2026-11-12, UTC+7)

| 테스트 | 결과 |
|---|---|
| `npm test` (소스 서버): 도구 목록 + 샘플 SnapLedger 전체 흐름(stdio) + HTTP | **36 통과 / 0 실패** |
| 같은 테스트, 한 파일 번들(`plugin-package/aaplug2/mcp/dist`, node_modules 없음) | 34 통과 / 0 실패. canvas가 없어 그래픽 2개 항목은 건너뜀. 글자 자료는 정상 |
| 같은 테스트, 번들 + `npm install`(canvas 설치) | 36 / 0 |
| 같은 테스트, npm 패키지 tgz를 설치해 실행 | 36 / 0 (그래픽 포함) |
| 공식 MCP Inspector CLI → `aaplug2_connect_app` github android/sunflower | 정상(준비도 82%, targetSdk 34 → 36 필요) |
| Claude Code 2.1.322 `claude mcp list`: stdio와 HTTP | 둘 다 ✔ Connected |
| Claude Code `--plugin-dir plugin-package/aaplug2` | `plugin:aaplug2:aaplug2 ✔ Connected` |
| Claude Code `claude plugin validate` | Validation passed. 디렉터리 제출 시 LICENSE 필요 안내 |
| Cursor CLI `cursor-agent mcp list` / `list-tools` | stdio와 HTTP 모두 ready, 도구 10개 |
| 웹 앱 회귀(ko/th/en, 데스크톱·모바일) | 콘솔 오류 0 |

샘플 흐름에서 확인한 내용:
- 준비도 35%, 꼭 고칠 것 5개, 결정 23개
- 범위 밖 값 거부, 결정 전 자료 생성 거부, 사용자가 고른 4개 기록, 전체 추천 적용
- 아이콘·대표 그래픽(태국어) PNG
- 22개 파일과 ZIP, 승인한 targetSdk 수정이 diff에 들어감
- Play 안내 7단계(마지막 잠김), 승인 전 제출 보고 거부, 승인 뒤 마지막 단계 열림(auto_submit=false)
- App Store 안내 8단계
- Play 심사 중 → 출시. App Store 반려 → 메시지 매칭 → 수정 계획과 답장 → 재제출 → 출시 → "출시 완료"
- 로컬 폴더 연결 결과가 샘플과 같음, 없는 경로는 오류
- HTTP: 경로 연결 꺼짐, ZIP을 응답 안에 같이 보냄, 다른 Origin은 403

## 4. Grok Bot 앱 연결에 실제로 올리려면 (사실만)

1. **형식:** Cursor Plugin(`.cursor-plugin/plugin.json` + `mcp.json` + skills)을 공개 Git 저장소에 둡니다.
   - Cursor 공식 체크리스트: 유일한 kebab-case 이름, 설명, README, 로고는 저장소 안 상대 경로, 로컬 테스트.
   - → `plugin-package/aaplug2/`가 이 형식입니다.
2. **제출:** `cursor.com/marketplace/publish`(저장소 주소) 또는 SpaceXAI 양식 `x.ai/bot/marketplace/submit-a-plugin`(플러그인/MCP 서버, 조직 핸들, "로컬과 앱 안에서 테스트함" 확인란).
   - 제출하면 Cursor Marketplace Publisher Terms에 동의하게 됩니다(신원·사업 확인, 코드 검토, 거절 사유는 알려 주지 않음).
3. **실행 방식:** 카탈로그의 Firebase 플러그인은 `npx -y firebase-tools@latest mcp` 명령형이고, 이 Grok Bot에서 동작 중입니다.
   - 우리도 npm에 `aaplug2-mcp`를 공개하고 `mcp.json`을 `{"command":"npx","args":["-y","aaplug2-mcp"]}`로 바꾸는 방식이 가장 확실합니다.
   - 지금 `mcp.json`은 `${CURSOR_PLUGIN_ROOT}/mcp/dist/aaplug2-mcp.mjs`를 씁니다. 이 변수를 Cursor는 펼쳐 주지만, Grok Bot이 펼쳐 주는지는 문서로 확인하지 못했습니다.
4. **제출 전에 정할 것:**
   - npm 계정으로 `aaplug2-mcp` 공개(무료)
   - 공개 GitHub 저장소 (현재: https://github.com/JaeTaekOh/aaplug2)
   - 라이선스(예: MIT. Claude 플러그인 디렉터리는 필수)
   - 조직 핸들
   - 연락처 (현재: https://aaplug.com, 이메일 없음)
   - Grok Bot 앱 안에서 1-1 방식으로 직접 테스트(양식의 필수 확인란)
5. **모르는 것:** 검토 기준과 기간, 양식의 전체 칸, `${CURSOR_PLUGIN_ROOT}` 지원 여부, 원격 HTTPS 서버만 받는지 여부(명령형인 Firebase가 있으니 명령형도 되는 것으로 보이지만 제3자 플러그인 기준은 미확인).

출처:
- docs.x.ai/grok-bot/computer-and-apps (Add a custom connector, Remote HTTPS / Command)
- docs.x.ai/grok-bot/team-bots
- x.ai/bot/marketplace/submit-a-plugin
- cursor.com/docs/reference/plugins
- cursor.com/marketplace-publisher-terms
- code.claude.com/docs/en/plugins-reference
- modelcontextprotocol.io/specification/2025-11-25 (transports: stdio, Streamable HTTP)
- 이 컴퓨터의 `/home/box/agent-data/plugins/cache/cursor-public/*` (firebase, gmail, google-drive, finance, cloudflare 설치본)
- 참고만 한 제3자 글: grokmag.com, theopenapps.com, bests.one

## 5. 한계

- 분석과 문구는 웹 앱과 같은 규칙·템플릿 기반입니다. 반려 사유 매칭은 4종이고, 답장 문안은 샘플 앱(영수증·가계부) 내용에 맞춰져 있어 다른 앱에서는 손봐야 합니다(웹 앱과 같은 한계).
- 원격(HTTPS) 공개 서버가 아닙니다. 다른 사람이 Grok Bot에서 쓰려면 npm 공개와 마켓플레이스 등록, 또는 HTTPS 호스팅이 필요합니다.
- HTTP 모드에는 인증이 없습니다. project_id(무작위 10자리 hex)를 아는 사람은 그 프로젝트를 볼 수 있으니, 공개 호스팅 전에 인증을 붙여야 합니다.
- 그래픽은 선택 의존성 `@napi-rs/canvas`가 있어야 합니다. npm 패키지로 설치하면 자동으로 깔립니다. 한 파일 번들만 있으면 그래픽 없이 글자 자료만 만듭니다.
- App Store용 스크린샷 규격은 아직 없습니다(Play 1080×1920만).
- 비공개 GitHub 저장소는 지원하지 않습니다(토큰을 받지 않는 원칙). 로컬 폴더나 ZIP으로 연결하면 됩니다.
- GitHub 비로그인 API 한도는 시간당 60회입니다.

## 6. 남은 일 (소유자 결정 대기)

- npm 공개 → `mcp.json`을 npx 방식으로 바꾸기 → 공개 GitHub 저장소 → Grok Bot 앱 안에서 테스트 → 마켓플레이스 제출(한 창구로 한 번만)
- 라이선스와 조직 핸들 정하기
- (선택) 원격 HTTPS 호스팅 + 인증
- zh/hi 언어, App Store 스크린샷 규격, 반려 사유 확장
