# AA Plug 2 (by MOTOR AA)

AI로 Android·iOS 앱을 만든 사람이 **스토어 출시 완료**까지 갈 수 있게 도와주는 무료 웹 도구입니다.
입력은 한 번뿐입니다. 앱을 연결하면(공개 GitHub 주소, ZIP, 폴더 중 하나) 그다음부터는 **고르기·승인·거절**만 하면 됩니다.
스토어 제출은 자동으로 하지 않습니다. 사용자가 승인한 다음에만 마지막 단계가 열립니다.

## AI에 연결해서 쓰기 (MCP · Grok Bot · Claude · Cursor)

웹사이트를 열지 않고 AI에게 "AA Plug 2로 내 앱 출시 도와줘"라고 말하는 방식도 있습니다. MCP 서버는 `mcp/`에 있고, 연결 방법은 [PLUGIN.md](PLUGIN.md), 빌드 보고서는 [PLUGIN-BUILD.md](PLUGIN-BUILD.md)에 있습니다.

```bash
cd /workspace/aaplug2/mcp && npm start      # stdio
npm test                                    # 자동 테스트
```

## 실행 방법

```bash
cd /workspace/aaplug2
npm start            # = node server.mjs
# 브라우저에서 http://127.0.0.1:5180/ 열기
```

- Node 18 이상이면 됩니다. 설치할 패키지는 없습니다.
- 포트를 바꾸려면 `PORT=8080 npm start` 처럼 실행합니다.
- 서버 없이 `index.html`을 바로 열어도(file://) 내장 샘플과 ZIP/폴더 연결은 동작합니다. 공개 GitHub 연결은 브라우저가 GitHub API를 직접 부르고, 막히면 로컬 서버의 `/gh` 프록시를 씁니다.

## 흐름

1. 홈: 앱 연결(GitHub 주소 / ZIP / 폴더) 또는 **샘플로 체험**
2. 분석: 출시 준비도, 꼭 고칠 것 / 확인 권장 / 참고
3. 결정: 카드마다 AI가 만든 안을 고르거나 승인·거절
4. 스토어 자료: 이름·설명(KO/EN/TH), 아이콘·대표 이미지·스크린샷, 개인정보처리방침, Data safety / App Privacy, 연령 등급(IARC) 답
5. 등록 안내: Play Console / App Store Connect 단계별 복사 버튼, 마지막 단계는 승인 후에만 열림
6. 심사: 통과 또는 반려. 반려 사유를 고르면 수정 계획과 답장 문안을 만듭니다
7. 출시 완료

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html`, `privacy.html` | 앱 화면, 이 도구의 개인정보처리방침 |
| `css/` | 디자인(styles.css), 공통 모션, 셀프 호스팅 폰트 정의 |
| `js/` | config, i18n(ko/en/th), zip, sources, analyzer, generator, graphics, app |
| `sample/snapledger/` | 내장 샘플 앱 원본(스냅가계부) |
| `tools/` | 샘플 데이터 빌드, 샘플 이미지 생성, 화면 자동 캡처 스크립트 |
| `preview-screenshots/` | 주요 화면 캡처 (데스크톱 1366 / 모바일 390, ko·th·en) |
| `sample-output/` | 샘플로 끝까지 진행했을 때 내려받는 ZIP 예시 |
| `mcp/` | MCP 서버(Grok Bot·Claude·Cursor 연결용) |
| `plugin-src/`, `plugin-package/` | 플러그인 원본과 빌드 결과(제출 안 함) |
| `js/flow.js` | 웹 앱과 MCP가 함께 쓰는 흐름 규칙 |

## 설정

`js/config.js`
- `operator`: 화면에 보이는 운영 주체 (MOTOR AA)
- `feedbackEmail`: 의견 보내기 주소
- `showAdSlotPlaceholder`: 광고 자리 표시(실제 광고 아님). `false`로 두면 숨김

## 샘플 다시 만들기 / 화면 다시 캡처

```bash
npm run sample   # sample/snapledger → js/sample-data.js
npm run shots    # 서버가 켜져 있어야 함. preview-screenshots/ 갱신
```

## 원칙

- 무료, 정적 파일만 사용, API 키·토큰을 묻지 않음
- 앱 파일은 브라우저 안에서만 읽고 어디에도 올리지 않음 (진행 상태는 이 브라우저의 localStorage에만 저장)
- 출시 완료 이후 기능은 없음
