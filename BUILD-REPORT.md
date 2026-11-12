# AA Plug 2 — 1차 빌드 보고서

> **Update 0.1.1 (2026-11-12):** Default language is now English, and AA Plug 2 supports five languages: English (`en`, default), Korean (`ko`), Thai (`th`), Simplified Chinese (`zh`) and Hindi (`hi`). The web app opens in English (no browser/device-language detection); the header globe button switches language on every screen and the manual pick is saved (`localStorage` key `aaplug2.uiLang`). New `js/i18n-zh.js` and `js/i18n-hi.js` (436 keys each, same as en/ko/th); zh/hi MCP messages and zh/hi store-listing, policy, rating and guide text in `generator.js` / `flow.js`. MCP `lang` accepts `en|ko|th|zh|hi`, default `en`; `normLang` maps `zh-TW`/`zh-CN`/`zh-Hans`/`zh-Hant` → `zh` and anything unknown → `en`. Store-listing languages default to and recommend `["en"]`; ko/th/zh/hi listings stay optional. zh/hi UI text uses system fonts (PingFang SC / Microsoft YaHei / Noto Sans CJK SC; Noto Sans Devanagari / Nirmala UI); no new font files are bundled. Statements below about Korean being the default, device-language detection or KO/EN/TH only describe 0.1.0 and no longer apply.

작성: 2026-11-12 (Asia/Bangkok, UTC+7)
위치: `/workspace/aaplug2` (이 컴퓨터에만 있음. motoraa.com·GitHub에 배포하지 않았고, 기존 motoraa.com 사이트는 건드리지 않음)

## 1. 만든 것

AI로 앱을 만든 사람이 **앱 연결 한 번 → 고르기·승인·거절만으로 출시 완료**까지 가는 웹 도구입니다.

- **연결**: 공개 GitHub 주소, ZIP 파일, 폴더 선택, 내장 샘플(오프라인 동작). 폼 입력 없음, 토큰 요청 없음.
- **분석(규칙 기반, 브라우저 안에서)**: AndroidManifest, Gradle(libs.versions.toml 포함), strings.xml, Info.plist, pbxproj, README를 읽어 SDK·권한·사용 라이브러리(Firebase, AdMob, ML Kit 등)·카테고리를 추정하고 점검 항목을 만듦.
  - 예: targetSdk 36 필요(2026-08-31부터), iOS 26 SDK 필요(2026-04부터), 개인 계정 비공개 테스트(12명 × 14일), 평문 통신, 빈 권한 설명, 사진 권한 → 사진 선택 도구, 광고 ID 신고, 계정 삭제 경로, 개인정보처리방침 등.
- **결정 카드**: 항목마다 AI가 만든 2~3개 안 중 고르기 또는 승인·거절.
- **생성물**
  - 스토어 문구: 이름·짧은 설명·자세한 설명, KO/EN/TH
  - 개인정보처리방침, 계정·데이터 삭제 안내 페이지
  - Data safety(Play) / App Privacy(Apple) 답과 CSV, PrivacyInfo.xcprivacy
  - 연령 등급(IARC) 설문 답
  - 그래픽: 아이콘 3안, 대표 이미지 3안, 스크린샷 1080×1920 (캔버스로 생성)
  - 코드 수정안(diff)
  - Play Console / App Store Connect 단계별 쉬운 말 안내와 복사 버튼
  - 반려 사유별 수정 계획과 답장 문안
  - 전부 한 번에 받는 ZIP(샘플 기준 22개 파일, 예시: `sample-output/aaplug2-com.sample.snapledger-ko.zip`)
- **승인 게이트**: 제출 직전 승인 창. 승인 전에는 마지막 단계가 잠겨 있음. 자동 제출 없음.
- **언어**: 한국어 우선, KO/EN/TH 전환. 기기 언어 자동 감지, 사용자가 고른 언어가 우선. 지원하지 않는 기기 언어면 한국어.
- **운영 표시**: 0.1.1부터 화면·패키지에 운영자 이름을 표시하지 않음. 의견·문의는 https://aaplug.com.
- **광고**: 실제 광고 네트워크 없음. "광고 자리" 라벨이 붙은 자리 표시만 있음(`js/config.js`의 `showAdSlotPlaceholder`로 끄기 가능).
- **디자인**: 잉크(#15171a) + 시그널 라임(#c8f03c), 셀프 호스팅 폰트(Pretendard, IBM Plex Sans/Thai), 모든 버튼에 아이콘, AA 공통 모션, 모바일 대응(하단 고정 진행 버튼).

## 2. 실행

```bash
cd /workspace/aaplug2
npm start
```
→ http://127.0.0.1:5180/ (포트 변경: `PORT=8080 npm start`)

서버 없이: `/workspace/aaplug2/index.html`을 브라우저로 직접 열어도 샘플·ZIP·폴더는 동작.

## 3. 확인한 것

- 샘플로 홈 → 분석 → 결정 → 자료 → 등록 안내 → 승인 → 반려·수정 → 재심사 통과 → 출시 완료까지 자동 클릭 테스트: ko / th / en, 데스크톱·모바일 모두 콘솔 오류 0.
- 실제 공개 저장소(github.com/android/sunflower) 연결·분석 확인(targetSdk를 버전 카탈로그에서 읽음).
- file://로 열었을 때 샘플 동작 확인.

## 4. 스크린샷

`/workspace/aaplug2/preview-screenshots/` — 60장
`{desktop|mobile}-{ko|th|en}-NN-이름.png`

| 번호 | 화면 |
|---|---|
| 01-home | 홈(앱 연결) |
| 02-analysis | 분석 결과 |
| 03-decisions | 결정 카드 |
| 04-decisions-done | 결정 완료 |
| 05-assets | 스토어 자료(문구·그래픽·방침·양식) |
| 06-submit-guide | 등록 안내 |
| 07-submit-approve-modal | 제출 승인 창 |
| 08-review | 심사 상태 |
| 09-rejection-fix | 반려 수정 계획·답장 |
| 10-launched | 출시 완료 |

예: `preview-screenshots/desktop-ko-01-home.png`, `preview-screenshots/mobile-ko-05-assets.png`
(데스크톱은 전체 페이지 캡처라 하단 고정 바가 페이지 중간에 찍혀 보일 수 있음. 실제 화면에서는 아래에 고정됨.)

## 5. 한계

- 분석은 규칙 기반 추정입니다. 실제 AI 모델을 부르지 않습니다(비용 0 원칙). 문구·답변은 템플릿 조합이라 사용자가 확인해야 합니다.
- 스토어에 실제로 올리지 않습니다(심사 화면은 사용자가 결과를 알려 주는 방식).
- GitHub는 **공개** 저장소만. 비로그인 API 한도(시간당 60회)가 있어 큰 저장소는 일부 파일만 읽습니다.
- Flutter/React Native/Expo 등은 기본 정보 위주로 읽습니다. 네이티브 Android가 가장 정확합니다.
- 그래픽은 Play 규격(아이콘 512, 대표 이미지 1024×500, 스크린샷 1080×1920)만 생성. App Store 규격 스크린샷(6.9"/6.5"/13")은 아직 없음.
- 진행 상태는 그 브라우저의 localStorage에만 저장(기기 간 이어 하기 없음).
- 정책 날짜(targetSdk 36, iOS 26 SDK 등)는 2026-11 기준이며 `js/analyzer.js`에서 수동 갱신이 필요합니다.

## 6. AA 공통 규칙과 맞춘 점 / 다른 점

- 공통 테마 토큰·모션·셀프 호스팅 폰트·버튼 아이콘·기기 언어 감지 규칙을 따름. 브랜드 색(시그널 라임)은 이 도구용으로 새로 정함. theme-base.md 색 표는 수정하지 않음.
- 공통 규칙은 5개 언어(th/en/ko/zh/hi)를 권하지만 이번 요청대로 KO/EN/TH 3개만. zh/hi는 나중에.
- 공통 규칙의 "허브/소개/가입/테스터 페이지에 광고 언급 금지"는 이 도구 화면에 해당하지 않는다고 보고 광고 자리 표시를 넣음. 문제가 되면 `showAdSlotPlaceholder: false`로 바로 숨길 수 있음.
- AA-common-rules.md는 수정하지 않음.

## 7. 나중에 할 일

- Grok Bot 마켓플레이스 등록(MCP 서버는 만들었음, npm·GitHub 공개와 제출은 남음 → PLUGIN-BUILD.md)
- 실제 광고(AdSense 등) 연결: 심사·정책 확인 후
- 자체 도메인 연결(주소는 이번에 보류함), 정적 호스팅 배포
- 실제 스토어 API(Play Developer API, App Store Connect API) 연동: 사용자 승인 후 제출. 지금은 안내만
- App Store 스크린샷 규격, zh/hi 언어, 비공개 저장소(사용자 기기에서만 처리하는 방식) 검토

## 8. 추가: MCP 서버·플러그인 (2026-11-12)

Grok Bot 앱 연결과 다른 AI(Claude, Cursor 등)에서 쓰는 MCP 서버를 만들었습니다. 자세한 내용은 [PLUGIN-BUILD.md](PLUGIN-BUILD.md), 연결 방법은 [PLUGIN.md](PLUGIN.md)에 있습니다. 이때 웹 앱의 흐름 규칙을 `js/flow.js`로 옮겼고(웹과 MCP가 함께 씀), 태국어 그래픽 줄바꿈을 고쳤습니다. 회귀 테스트에서 콘솔 오류는 0이었고, 스크린샷은 새로 찍었습니다.
