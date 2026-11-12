# AA Plug 2 연결 안내 (Grok Bot · Claude · Cursor · 다른 MCP 앱)

AA Plug 2는 **MCP 서버 하나**로 동작합니다. Grok Bot, Claude, Cursor 같은 AI에 한 번만 연결해 두면, 사용자는 웹사이트를 열 필요 없이 AI에게 이렇게 말하면 됩니다.

> "AA Plug 2로 내 앱 출시 도와줘: https://github.com/내아이디/내앱"
> "AA Plug 2 샘플로 한번 보여줘"

그다음부터 사용자는 AI가 보여 주는 안에서 **고르기·승인·거절**만 합니다. 스토어 제출은 사용자가 승인한 뒤 콘솔에서 직접 누르고, AA Plug 2가 자동으로 제출하는 일은 없습니다.

- 운영: MOTOR AA · 의견: motoraathailand@gmail.com · 무료 · API 키·토큰 없음
- 서버 위치(이 컴퓨터): `/workspace/aaplug2/mcp/server.mjs`
- 필요한 것: Node.js 20 이상

아래에서 ✅ 표시는 이 컴퓨터에서 실제로 연결해 확인한 방법, 📄 표시는 공식 문서에만 근거하고 직접 눌러 보지는 못한 방법입니다.

---

## 1. Grok Bot (앱 연결)

### 1-1. 지금 바로 쓸 수 있는 방법: 내 Grok Bot에 "Command" 서버로 추가 📄

Grok Bot의 모든 Bot은 같은 클라우드 컴퓨터를 씁니다. AA Plug 2 파일이 이미 그 컴퓨터의 `/workspace/aaplug2`에 있으므로, Jae Taek 님의 Bot들은 아래처럼 추가하면 됩니다.

**방법 A: Bot에게 말하기**
> "MCP 서버 추가해줘. 이름 AA Plug 2, 명령 `node`, 인자 `/workspace/aaplug2/mcp/server.mjs`"

**방법 B: 데스크톱 앱에서 직접**
1. 왼쪽 사이드바에서 **Connect apps**를 엽니다.
2. 맨 아래 **Add a custom connector**를 누릅니다.
3. Name: `AA Plug 2`
4. Type: **Command**
5. Command: `node` (안 되면 `/usr/bin/node`)
6. Arguments: `/workspace/aaplug2/mcp/server.mjs`
7. **Add plugin**을 누릅니다.
8. 다음 메시지부터 Bot이 `aaplug2_…` 도구 10개를 씁니다.

근거: SpaceXAI 공식 문서 [Use the computer and apps](https://docs.x.ai/grok-bot/computer-and-apps). 원문 요지는 "Bot은 카탈로그에 없는 MCP 서버를 URL이나 Bot 컴퓨터에서 실행하는 명령으로 추가할 수 있고, Add a custom connector에서 Type을 Remote HTTPS 또는 Command로 고른다"입니다.

이 작업을 한 하위 에이전트에게는 서버를 추가하는 도구가 없었습니다. 또 계정 설정을 바꾸는 일이라, 실제 추가는 하지 않았습니다. 서버 자체는 같은 명령으로 Claude Code·Cursor·MCP Inspector에서 연결을 확인했습니다(아래 2·3·4절).

참고:
- 이 방법은 **이 클라우드 컴퓨터에 파일이 있는 계정**(Jae Taek 님 계정)에서만 됩니다. 다른 사람에게 공유하려면 1-3의 공개 배포가 필요합니다.
- 공식 문서에 따르면 명령으로 추가한 서버는 같은 계정의 다른 Bot에서도 쓸 수 있습니다.

### 1-2. 원격 주소(Remote HTTPS)로 추가 📄 (지금은 불가)

Grok Bot은 공개 HTTPS 주소의 MCP 서버도 받습니다. AA Plug 2에는 HTTP 모드(`node mcp/server.mjs --http`)가 있지만, 공개 HTTPS 주소로 배포하는 일은 이번 범위가 아니라서 하지 않았습니다. 로컬 주소(`http://127.0.0.1`)는 Grok Bot이 쓸 수 없습니다(클라우드에서 접속하기 때문).

### 1-3. Grok Bot "앱 연결" 목록에 올리기 (마켓플레이스 등록, 아직 안 함)

조사한 사실만 적습니다.

| 항목 | 확인한 내용 | 출처 |
|---|---|---|
| 제출 창구 1 | SpaceXAI 양식 `x.ai/bot/marketplace/submit-a-plugin`. "플러그인 또는 MCP 서버를 Grok(곧), Grok Bot, Cursor 사용자에게 배포하도록 제출하면 검토한다." 조직 핸들(소문자·공백 없음)과 "로컬과 앱 안에서 테스트했다" 확인란이 있음 | 양식 페이지(직접 열어 봄) |
| 제출 창구 2 | Cursor 마켓플레이스 `cursor.com/marketplace/publish`에 **공개 Git 저장소** 주소를 제출하고, Cursor 팀이 직접 검토 | [Cursor Plugins reference](https://cursor.com/docs/reference/plugins) |
| 패키지 형식 | Cursor Plugin: `.cursor-plugin/plugin.json`(필수 `name`) + `mcp.json` + `skills/` 등. Grok Bot의 앱 연결에 깔린 플러그인도 이 형식임(이 컴퓨터의 설치본: firebase, gmail, google-drive, finance. `minClientVersions.grokbot` 필드 사용) | Cursor 문서 + 이 컴퓨터의 플러그인 캐시 |
| 명령형 서버 | 카탈로그 플러그인 중 Firebase는 `npx -y firebase-tools@latest mcp` 명령으로 실행되고, 이 Grok Bot에서 실제로 동작 중 | 이 컴퓨터의 플러그인 캐시 |
| 약관 | 제출하면 Cursor Marketplace Publisher Terms에 동의. 신원·사업 확인과 코드 검토가 있고, 승인·거절 이유는 알려 주지 않음 | [Publisher Terms](https://cursor.com/marketplace-publisher-terms) |

**아직 모르는 것:**
- 검토 기준과 기간
- 양식의 전체 입력 칸(로고 1:1 SVG/PNG, 설명, 테스트 방법 등은 제3자 글에만 나옴)
- Grok Bot이 카탈로그 플러그인의 `${CURSOR_PLUGIN_ROOT}` 변수를 펼쳐 주는지(Cursor 문서는 Cursor 기준으로만 설명)

그래서 실제 등록용으로는 Firebase처럼 **npm에 공개한 패키지를 `npx -y aaplug2-mcp`로 실행**하는 방식이 가장 확실해 보입니다. 패키지 준비본은 만들어 두었지만 공개하지 않았습니다(`plugin-package/npm/`).

등록 신청은 Jae Taek 님 결정을 기다립니다.

---

## 2. Claude ✅ (Claude Code에서 확인)

### Claude Code (터미널)
```bash
claude mcp add aaplug2 -- node /workspace/aaplug2/mcp/server.mjs
claude mcp list        # → aaplug2: ... ✔ Connected
```
이 컴퓨터에서 Claude Code 2.1.322로 연결(✔ Connected)을 확인했습니다. 로컬 HTTP 모드도 확인했습니다.
```bash
node /workspace/aaplug2/mcp/server.mjs --http          # http://127.0.0.1:5181/mcp
claude mcp add --transport http aaplug2-http http://127.0.0.1:5181/mcp
```

**플러그인으로 설치(로컬):**
`claude --plugin-dir /workspace/aaplug2/plugin-package/aaplug2`로 실행하면 `plugin:aaplug2:aaplug2 … ✔ Connected`가 뜹니다(확인함).
`claude plugin validate`도 통과했습니다. 다만 Claude 플러그인 디렉터리에 제출하려면 LICENSE가 필요하다고 안내합니다(라이선스는 소유자 결정).

### Claude Desktop 📄
설정 → Developer → **Edit Config**로 `claude_desktop_config.json`을 열고 아래를 넣은 뒤, 앱을 완전히 껐다 켭니다.
```json
{
  "mcpServers": {
    "aaplug2": { "command": "node", "args": ["/절대경로/aaplug2/mcp/server.mjs"] }
  }
}
```
파일 위치: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
근거: [MCP 공식 안내](https://modelcontextprotocol.io/docs/develop/connect-local-servers). 이 컴퓨터에는 Claude Desktop이 없어 직접 확인하지 못했습니다. 사용자 컴퓨터에 AA Plug 2 폴더가 있어야 합니다(npm 공개 뒤에는 `"command": "npx", "args": ["-y", "aaplug2-mcp"]`).

---

## 3. Cursor ✅ (Cursor CLI에서 확인)

프로젝트의 `.cursor/mcp.json` 또는 `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "aaplug2": { "command": "node", "args": ["/workspace/aaplug2/mcp/server.mjs"] }
  }
}
```
Cursor CLI(`cursor-agent`)로 `mcp enable aaplug2` → `mcp list`에 `aaplug2: ready`, `mcp list-tools aaplug2`에 도구 10개가 나오는 것을 확인했습니다. HTTP 모드(`"url": "http://127.0.0.1:5181/mcp"`)도 ready를 확인했습니다.
Cursor IDE에서는 처음 쓸 때 서버 승인을 묻습니다. Cursor 플러그인 형태의 로컬 설치(`~/.cursor/plugins/local/aaplug2`)는 IDE가 없어 확인하지 못했습니다.

---

## 4. 그 밖의 MCP 앱 ✅

- **stdio:** 실행 명령 `node /workspace/aaplug2/mcp/server.mjs`. 공식 MCP Inspector CLI로 확인했습니다.
  ```bash
  npx @modelcontextprotocol/inspector --cli node /workspace/aaplug2/mcp/server.mjs --method tools/list
  ```
- **Streamable HTTP:** `node /workspace/aaplug2/mcp/server.mjs --http [--port 5181] [--host 127.0.0.1]` → 엔드포인트 `http://127.0.0.1:5181/mcp` (POST, 상태 없음).
  - Host와 Origin 머리글을 확인하고, 다른 Origin은 403으로 막습니다.
  - HTTP 모드에서는 서버 디스크 경로 읽기(`source: "path"`)가 기본으로 꺼져 있고(`AAPLUG2_ALLOW_PATH=1`로 켬), 결과 ZIP을 응답 안에 같이 보냅니다.

## 환경 변수

| 이름 | 기본값 | 뜻 |
|---|---|---|
| `AAPLUG2_HOME` | `~/.aaplug2` | 진행 상태와 만든 자료를 저장하는 폴더 |
| `AAPLUG2_LANG` | `ko` | 결과 문구 기본 언어 (ko/en/th) |
| `AAPLUG2_ALLOW_PATH` | stdio 켬 / HTTP 끔 | 로컬 폴더·ZIP 연결 허용 |
| `AAPLUG2_ALLOWED_ORIGINS` | 없음 | HTTP 모드에서 허용할 Origin (쉼표로 구분) |
| `AAPLUG2_ALLOWED_HOSTS` | localhost 포트 | HTTP 모드에서 허용할 Host |

## 사용자가 AI와 나누는 대화 예

1. 사용자: "앱 다 만들었어. AA Plug 2로 출시 도와줘. github.com/me/myapp"
2. AI가 `aaplug2_connect_app`을 부르고 알려 줍니다. "출시 준비도 35%예요. 꼭 고칠 것 5개가 있어요."
3. AI가 `aaplug2_get_decisions`를 부르고 묻습니다. "스토어 이름은 ① 스냅가계부 ② 스냅가계부 - 영수증 찍으면 가계부 끝, 어느 쪽으로 할까요?" 아이콘·대표 이미지는 `aaplug2_preview_graphics`로 그림을 보여 줍니다.
4. 사용자: "2번. 나머지는 추천대로." → `aaplug2_decide`
5. AI가 `aaplug2_generate_store_materials`로 스토어 문구, 방침, 양식 답, 그래픽, ZIP을 만듭니다.
6. AI가 `aaplug2_submission_guide`로 Play Console 단계별로 붙여 넣을 값을 알려 줍니다. 마지막 단계는 잠겨 있습니다.
7. 사용자: "좋아, 제출할게." → `aaplug2_approve_submission`. 사용자가 콘솔에서 직접 제출 버튼을 누릅니다.
8. 사용자: "애플에서 반려됐어. (메시지 붙여 넣기)" → `aaplug2_report_review`가 수정 계획과 답장 문안을 줍니다.
9. 사용자: "둘 다 출시됐어!" → 출시 완료. AA Plug 2의 역할은 여기서 끝납니다.
