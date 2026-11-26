# 모꼬꼬로아 전체 검증 보고

- 대상: `plo/ark-lens-character` 브랜치 전체 (`origin/main` 대비 127개 파일), PR #1
- 기준 커밋: `07121d9` · 검증일: 2026-11-25
- 방법: 코드·설정·문서·research 정독, `git log --all -p` 전체 이력 검색, 공개 저장소 라이선스 조회(GitHub API, 읽기 전용). 실제 API 키와 실제 호출은 쓰지 않았습니다.

## 1. 빌드·품질 결과

작업 공간의 `node_modules`는 이전 세션에서 띄운 Vite·Wrangler dev 서버들이 `esbuild.exe`를 잡고 있어 `npm ci`가 `EPERM`으로 실패했습니다. 그래서 `git archive HEAD`로 만든 깨끗한 사본에서 Node 22.16.0 / npm 10.9.2로 실행했습니다. 수정 후에도 같은 사본에 변경 파일을 복사해 다시 실행했습니다.

| 단계 | 수정 전 (`07121d9`) | 수정 후 |
| --- | --- | --- |
| `npm ci` | 통과 · 366개 설치 · 취약점 0 | 같음 |
| `npx tsc --noEmit` | 통과 | 통과 |
| `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | 통과 (미사용 지역 변수·매개변수 없음) | 통과 |
| `npm run lint` | 통과 · 경고 0 | 통과 · 경고 0 |
| `npm test` | 10개 파일, 152개 테스트 통과 · stderr 경고 없음 | 10개 파일, 156개 테스트 통과 |
| `npm run build` | 통과 · JS 302.32 kB (gzip 98.61 kB), CSS 23.72 kB | 같음 |
| `prettier --check --end-of-line auto src tests` | `src/models.ts`, 당시 테스트 픽스처 JSON 미정렬 | `models.ts` 정렬함. 픽스처는 §6에서 가상 데이터로 바꿈 |

`npm ci` 경고는 deprecated 알림 3건(`whatwg-encoding`, `node-domexception`은 jsdom/msw 하위 의존성, `eslint@9.39.5` 지원 종료)뿐입니다. 빌드 결과 `dist/_headers`에는 `index.html` 메타 CSP와 같은 정책이 들어갑니다.

## 2. 발견 사항

심각도: **높음** = 공개 저장소에서 바로 문제가 되거나 기능 오류, **중간** = 잘못된 안내나 드문 조건의 오류, **낮음** = 정리·개선.

| # | 심각도 | 위치 | 내용 | 처리 |
| --- | --- | --- | --- | --- |
| 1 | 중간 | `docs/deploy-cloudflare.md` 4단계·프록시 3단계·주소 이전 | `npm run deploy -- --branch main`은 Windows PowerShell 5.1에서 `--`가 사라져 `--branch`가 npm 옵션으로 해석됩니다. | **고침.** `npm run build` 후 `npx wrangler pages deploy dist --project-name mokokoloa --branch main`을 기본으로 바꾸고, 리다이렉트도 `npx wrangler pages deploy redirect/ark-lens --project-name ark-lens --branch main`으로 바꿈. POSIX 셸용 npm 스크립트는 보조 설명으로 남김 |
| 2 | 중간 | `docs/deploy-cloudflare.md` 3단계 | Wrangler 4.168은 AI 에이전트 실행을 감지하면 새 Pages 프로젝트 생성·배포를 Workers로 넘깁니다(`wrangler-dist/cli.js`의 `delegate-to-workers`). 그때는 `--force`가 필요한데 문서에 없었습니다. | **고침.** 언제 `--force`가 필요한지와 명령을 추가. 사람이 터미널에서 실행할 때는 필요 없고, 프로젝트가 생긴 뒤에도 필요 없음을 적음 |
| 3 | 중간 | `README.md` | "선택 범위인 프록시는 v1에서 제외했습니다"라고 했지만 `proxy/worker.ts`와 프록시 재시도 UI가 들어 있습니다. | **고침.** `VITE_PROXY_URL`로 빌드했을 때만 나타나고 동의해야 켜진다고 바꿈 |
| 4 | 중간 | `src/api.ts` `lostark()` | 전송 함수가 `TypeError`가 아닌 오류(예: `SecurityError`, 일반 `Error`, 문자열)로 실패하면 그대로 다시 던졌습니다. 그러면 `ErrorState`·`SiblingsDrawer`의 `errorContent[error.kind]`가 `undefined`가 되어 렌더링 중 예외가 납니다. | **고침.** Abort만 그대로 전달하고 나머지는 `{ kind: "network" }`로 바꿈. 테스트 4개 추가(`tests/app.test.tsx`) |
| 5 | 중간 | `docs/implementation-report.md`, `docs/ui-design.md`, `docs/transfer-tab-design.md`, `research/api/characters-armories-guide.md`, `research/transfer/transfer-analysis.md` | 로컬 절대 경로(`C:\Users\<사용자>\...`, `.orca\bots\...`)가 들어 있어 PC 사용자 이름과 작업 환경 구조가 드러납니다. | **고침.** 저장소 상대 경로 링크로 바꿈. 과거 커밋도 2026-11-26 이력 재작성으로 정리함 (§6) |
| 6 | 낮음 | `src/data/engraving-icons.ts:1` | 출처 주석이 다른 작업 공간 경로(`argonaut/research/...`)를 가리켰습니다. | **고침.** `research/engraving-icons/engraving-icons.json` |
| 7 | 낮음 | `src/models.ts` | Prettier 형식이 맞지 않았습니다. | **고침** |
| 8 | 정보 | 커밋 이력 전체 | 작성자 이메일 2개가 커밋 메타데이터에 공개되어 있습니다(브랜치 커밋 작성자와 `main`의 Initial commit 작성자). | **고침 (2026-11-26).** 이 브랜치 커밋의 작성자·커미터를 GitHub `noreply` 주소로 통일함. `main`의 Initial commit은 오너 지시대로 바꾸지 않음 (§6) |
| 9 | 낮음 | `docs/mockup-transfer` 이전 목업 이력 (`git log -p`) | 키 입력란 예시 값으로 JWT 헤더 앞부분(잘린 값)이 있습니다. 디코드하면 `{"alg":"RS256","typ":"JWT","x5t":"KX2…`이고 서명이나 페이로드가 없어서 키로 쓸 수 없습니다. | 위험은 없었지만 2026-11-26 이력 재작성 때 `demo.fixture.sample`로 바꿈 (§6) |
| 10 | 낮음 | `proxy/worker.ts` | `Origin` 검사는 브라우저만 막고 `curl`처럼 헤더를 꾸며 보내는 요청은 막지 못합니다. 키를 가진 사람은 누구나 Worker를 중계 서버로 쓸 수 있어 무료 한도(일 10만 요청)를 쓸 수 있습니다. 경로 화이트리스트, GET만 허용, `%2f`/`%5c` 차단, JSON 외 본문 폐기, 리다이렉트 차단, 캐시·로그 끄기는 모두 제대로 되어 있습니다. | 제안만. 필요하면 Cloudflare Rate Limiting 규칙이나 WAF로 보완 |
| 11 | 낮음 | `_headers` / `vite.config.ts` | CSP에 `frame-ancestors`가 없습니다(메타 CSP는 이 지시어를 무시함). `X-Frame-Options: DENY`가 같은 역할을 해서 실제 위험은 없습니다. `style-src 'unsafe-inline'`은 React 인라인 스타일 때문에 남아 있습니다. | 제안만. 헤더용 CSP에만 `frame-ancestors 'none'`을 덧붙이는 방법이 있음 |
| 12 | 낮음 | `src/Character.tsx`, `src/session.tsx`, `src/TransferTab.tsx`, `src/models.ts`, `src/parse/tooltip.ts` | 정의한 파일 안에서만 쓰는 export(`errorContent`, `ErrorState`, `NOT_FOUND_TTL`, `SIBLINGS_TTL`, `EstValue`, `EvidenceBadge`, `Avatar`, `ParsedTooltip`)가 있습니다. 동작에는 영향이 없습니다. | 그대로 둠 |
| 13 | 낮음 | `docs/implementation-report.md`, `docs/review-report.md`, `docs/transfer-review-report.md` | 이름이 "Ark Lens v1"이고 "14단계 프록시는 범위에서 제외" 같은 당시 상태가 적혀 있습니다. 시점이 정해진 기록 문서라 고치지 않았습니다. | 그대로 둠 |

### 문제를 찾지 못한 영역

- **키 등록·검증·삭제**: `normalizeKey`(bearer·괄호 제거), JWT 3부분 검사, `/news/alarms` 검증, 401·429·503·network에 따른 분기, 미검증 저장, 삭제할 때 키·조회 캐시·최근 검색을 모두 지우고 프록시도 끄는 동작, 다른 탭과의 `storage` 이벤트 동기화.
- **검색·최근 검색**: 성공한 조회만 5개까지 기록, 중복 제거, 옛 문자열 형식 읽기, 키 보관 방식(local/session)에 맞춘 저장소, `/` 단축키, 방향키·Esc 탐색.
- **캐릭터 섹션**: 아크 패시브(접두어와 `<FONT>` 두 형식 모두 처리), 아크 그리드 코어(`[NP]` 임계치 분리, 의지력·포인트 파싱), 젬, 각인 아이콘 43종 대응표, 카드 세트, 보석 그룹 평균, 장비 정렬(`어깨` 포함), 악세사리 옵션(상중하 표기·색상), 팔찌(locked/changeable), 스톤(Lv와 활성도 단위 구분).
- **원정대**: 서버별 묶기, 레벨 정렬, 404를 빈 목록으로 표시, 네트워크 오류일 때 프록시 재시도.
- **이관 탭**: 16부위 배치(`SLOT_LAYOUT`), 표1 경계값(`초과 < x ≤ 이하`), 에스더 표2·3 조합, 1800 상한 가정을 추정으로 표시, 범위 밖이면 계산 불가, 장신구·팔찌·스톤 판정. `src/transfer/**`에서 React·storage·fetch를 import하지 못하게 lint로 막아 둔 것도 확인.
- **오류 상태**: 401, 404, 200+null, 프로필 누락, 429(Reset 단위 3가지 처리, 자동 재시도 1회, 취소), 503(5분 쿨다운), network, server(1회 재시도). 오류 상세에서 키를 가림.
- **리다이렉트**: 루트 해시 경로 유지, 직접 경로 301 → `/_from-ark-lens/`를 거쳐 원래 경로 복원, `//host` 경로를 `/%2F`로 바꾸는 처리, `returnTo`가 같은 사이트 경로인지 검사.
- **이름 변경 마이그레이션**: `arklens.*`를 `mokokoloa.*`로 옮기고, 새 값이 이미 있으면 새 값을 쓰고, 저장소 오류가 나면 옛 값을 남김. 키·최근 검색·캐시·테마·즐겨찾기 모두 같은 함수를 거침.
- **보안**: `dangerouslySetInnerHTML`·`innerHTML`·`eval` 없음(lint 규칙도 있음). Tooltip은 텍스트로만 렌더링. 외부 링크는 모두 `noopener noreferrer`, 이미지는 `referrerPolicy="no-referrer"`. 요청은 `credentials: "omit"`, `redirect: "error"`, `cache: "no-store"`. `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`. 운영 빌드에는 데모 픽스처가 들어가지 않음(동적 import가 `import.meta.env.DEV` 안에 있음).
- **키·토큰 검색**: 작업 트리와 전체 이력(`git log --all -p`)에서 JWT, `bearer <토큰>`, GitHub·AWS·OpenAI 키 형식, `.env` 파일을 찾았습니다. 실제 키는 0건입니다. 테스트 토큰은 `test.fixture.value`, 데모 토큰은 `demo.fixture.sample` 같은 가짜 값입니다. PNG 26장(목업·구현 화면)은 모두 데모 화면이고 마스킹된 값만 보입니다(`…mple`). PNG 텍스트 메타데이터도 없습니다.

## 3. research/ 제3자 자료 (고치지 않고 목록만 남김, 삭제 여부는 오너가 결정)

라이선스는 2026-11-25에 GitHub API로 확인했습니다.

| # | 위험 | 파일 | 출처 | 라이선스 / 이용 조건 | 문제 |
| --- | --- | --- | --- | --- | --- |
| R1 | **높음** | `research/arkgrid/samples/community-parsers-reference.md` §1, §3 | `jayjung94/arkgrid-gem-viewer` (`lib/parseArkGrid.js`), `zeratul188/LotsGo` (`characterInfo.ts` 등) | **라이선스 없음** (모든 권리 보유) | 소스 코드를 그대로 길게 발췌했습니다(§1 약 70줄, §3 약 120줄). 공개 저장소라도 라이선스가 없으면 복제·재배포 허락이 없습니다. 출처는 적혀 있지만 그것만으로 허락이 되지는 않습니다. 발췌를 지우고 링크와 우리 말로 쓴 요약만 남기는 쪽을 권합니다 |
| R2 | 중간 | 같은 파일 §2 | `Airplaner/lostark-arkgrid-gem-locator-v2` | MIT 계열 (`license.txt`, "copyright notice … shall be included") | 출처는 있지만 MIT가 요구하는 저작권·허락 고지문이 없습니다 |
| R3 | 중간 | `research/arkgrid/samples/pyloa-arkgrid-model-and-test.py` | `DAN-MU-ZI/pyLoa` (`e8c4cdc`) | MIT | 출처 주석은 있지만 MIT 고지문이 없습니다. 고지문을 넣거나 링크로 바꾸면 됩니다 |
| R4 | 중간 | `research/arkgrid/samples/artbiit-v9-arkgrid.json`, `artbiit-slot0-tooltip-decoded.json`, `research/arkpassive/samples/artbiit-v9-characters-arkpassive.json`, **`tests/fixtures-artbiit-v9-arkgrid.json`** (테스트에서 사용) | `artbiit/lostark-api-service` | ISC 형식 (저작권·허락 고지 유지 조건. 다만 그 LICENSE 파일의 저작권자가 ISC 원문 그대로라 실제 권리 관계가 불분명) | (a) 고지문이 없습니다. (b) 내용은 그 저장소가 공식 API에서 받은 **실제 플레이어 캐릭터의 응답 원문**입니다(캐릭터명, 직업·레벨·코어·툴팁). 그 저장소 라이선스가 이 데이터까지 다루는지 분명하지 않고, Smilegate 게임 데이터라 Open API 이용약관도 적용됩니다. 실제 캐릭터명은 개인 식별 위험이 낮지만 0은 아닙니다. 테스트 픽스처도 같은 데이터라, 이름을 가상으로 바꾼 합성본으로 교체하는 방법이 있습니다 |
| R5 | 중간 | `research/arkpassive/enlightenment.json`(8,091줄), `evolution.json`, `leap.json` | 인벤 DB `lostark.inven.co.kr/dataninfo/arkpassive/?code=…` | 인벤 이용약관 (무단 수집·복제·재배포 제한). `_meta.licenseNote`에 "설명 문장은 빼고 구조 메타데이터만"이라고 적혀 있음 | 사실 정보라도 DB를 체계적으로 대량 수집하면 데이터베이스제작자 권리(저작권법 §93)와 사이트 약관 문제가 생길 수 있습니다. 30개 직업의 노드 구조 전체라 양이 많습니다. 출처는 적혀 있습니다 |
| R6 | 낮음 | `research/arkpassive/icon-verification.json` | 위 R5의 아이콘 키를 공식 CDN에 HEAD 요청으로 확인한 결과 | 공식 CDN URL (자산 권리는 Smilegate) | URL 목록과 응답 코드뿐이라 위험이 낮습니다. R5에서 나온 자료라 R5와 함께 결정하면 됩니다 |
| R7 | 낮음 | `research/engraving-icons/*`, **`src/data/engraving-icons.ts`** (앱 코드) | Lost Ark Codex KR, `Jung-Hwi-Hak/lost-ark` (**라이선스 없음**), artbiit | 각인 이름과 공식 CDN 아이콘 URL의 대응표 | 대응 자체는 사실 정보이고 코드를 복제하지 않았으며 CDN에서 직접 확인했습니다. 위험이 낮습니다. 아이콘 이미지의 권리는 Smilegate에 있습니다 |
| R8 | 낮음 | `research/transfer/transfer-analysis.md` | 공식 공지 13608, 인벤 게시판에 올라온 On-Air 방송 캡처(`upload3.inven.co.kr/...` URL 22개와 각 이미지 내용 설명) | 이미지는 `.gitignore`로 제외해 저장소에 없음 | 이미지를 재배포하지 않고 표만 옮겨 적었습니다. 공지 수치는 사실 정보라 위험이 낮습니다. 인벤 업로드 URL은 남아 있습니다 |
| R9 | 낮음 | `research/arkgrid/samples/official-swagger-arkgrid.json`, `research/arkpassive/samples/swagger-arkpassive-schema.json`, `research/api/*` | 공식 Open API Swagger·문서 | Smilegate 개발자 포털 | 공개된 API 스키마 발췌라 보통은 문제가 없습니다. 이용약관 요약이 들어 있음 |

이 밖에 `research/api/characters-armories-guide.md`는 공개 저장소 몇 곳(`cyhcyh100/public-lopec-api`, `Cong0327/LA_Discord_Bot`, `2Herz/LOA-MULTITOOL`)을 링크로만 언급합니다. 코드를 길게 발췌한 곳은 R1·R2뿐입니다.

## 4. 오너가 결정할 것

1. **R1 (라이선스 없는 코드 발췌)**: 발췌를 지우고 링크·요약만 남길지 정해 주세요. 가장 우선입니다.
2. **R2·R3·R4 고지문**: MIT·ISC 고지문을 덧붙일지, 발췌를 링크로 바꿀지 정해 주세요.
3. **R4 실제 캐릭터 응답과 테스트 픽스처**: 실제 캐릭터 데이터를 그대로 둘지, 이름을 가상으로 바꾼 합성본으로 바꿀지 정해 주세요(테스트 스냅샷도 함께 바뀜).
4. **R5 인벤 DB에서 수집한 아크 패시브 JSON**: 공개 저장소에 둘지, 비공개로 옮길지, 앱에 필요한 최소 필드만 남길지 정해 주세요.
5. **커밋 이력의 개인 정보**: 작성자 이메일 2개, 과거 문서 버전에 있는 로컬 절대 경로 6곳(PC 사용자 이름과 작업 폴더 구조), 위 research 자료는 이번 커밋으로 작업 트리에서 지워도 이력에 남습니다. 이력까지 지우려면 `git filter-repo` 등으로 다시 쓰고 force push해야 해서 이번 작업에서는 하지 않았습니다. 앞으로 커밋할 때는 GitHub의 `noreply` 이메일을 쓰는 방법이 있습니다.
6. **프록시 남용 방지(#10)**: Worker를 공개 배포한다면 Cloudflare Rate Limiting을 적용할지 정해 주세요.

## 5. 이번 변경

- `src/api.ts`: Abort가 아닌 전송 오류는 모두 `network`로 분류
- `tests/app.test.tsx`: 일반 Error, `SecurityError`, 문자열 거부, 전송 함수가 던진 AbortError에 대한 테스트 4개
- `README.md`, `docs/deploy-cloudflare.md`: 프록시 설명, PowerShell에서도 되는 배포 명령, `--force` 조건
- `docs/*.md`, `research/api/characters-armories-guide.md`, `research/transfer/transfer-analysis.md`, `src/data/engraving-icons.ts`: 로컬 절대 경로와 잘못된 출처 경로를 저장소 상대 경로로
- `src/models.ts`: Prettier 정렬

## 6. 공개 저장소 정리 (2026-11-26, 오너 승인: §4 추천안)

§3의 R1~R6과 §4의 1~5번을 처리했습니다. 작업 트리만 고친 것이 아니라 `origin/main` 이후의 모든 커밋을 다시 써서 지운 자료가 과거 커밋에도 남지 않게 했습니다(`git filter-branch`, 각 커밋에 같은 정리 스크립트를 적용).

| 항목 | 처리 |
| --- | --- |
| R1·R2 공개 파서 발췌 | `community-parsers-reference.md`를 지우고 [`community-parsers-links.md`](../research/arkgrid/samples/community-parsers-links.md)로 대체. 커밋 고정 링크, 라이선스, 한두 줄 요약만 남김 |
| R3 pyLoa 발췌 | `pyloa-arkgrid-model-and-test.py`를 지우고 [`pyloa-arkgrid-notes.md`](../research/arkgrid/samples/pyloa-arkgrid-notes.md)로 대체(링크, MIT 저작권 표시, 요약) |
| R4 실제 캐릭터 응답 | artbiit 원문 샘플 3개와 테스트 픽스처를 지우고 가상 데이터로 대체: `research/arkgrid/samples/synthetic-arkgrid.json`, `synthetic-slot0-tooltip-decoded.json`, `research/arkpassive/samples/synthetic-arkpassive.json`, `tests/fixtures-arkgrid-synthetic.json`. `tests/arkgrid.test.tsx`의 기대값도 바꿈(스냅샷 영향 없음). 조사 문서에서는 실제 캐릭터명·원정대 캐릭터명·길드명·영지명·서버명을 가상 값으로 바꾸고, 짧은 인용에는 artbiit 저장소와 ISC 라이선스 링크를 붙임 |
| R5·R6 인벤 기반 아크 패시브 JSON | `evolution.json`, `enlightenment.json`, `leap.json`, `icon-verification.json`을 저장소에서 빼고 `.gitignore`에 추가(로컬 보관). `arkpassive-tree.md`에 "데이터는 저장소에 포함하지 않음"을 적음 |
| 로컬 절대 경로 | 과거 문서 버전의 경로를 §2 5번과 같은 상대 경로로 바꿈 |
| 커밋 작성자 | `origin/main` 이후 커밋의 작성자·커미터를 `ploracia <344814254+ploracia@users.noreply.github.com>`로 통일 |
| JWT 모양 문자열 | 목업 입력란 예시 값과 문서의 JWT 헤더 모양 예시를 자리표시 문자열로 바꿈 |
