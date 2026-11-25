# Ark Lens — 로스트아크 캐릭터 조회 웹앱 UI 설계

> 작성일 2026-11-25 · 대상: 구현 담당(Codex) · 상태: 설계/정적 목업 완료, 구현 전
> 목업: `mockup/index.html` (외부 호출 없음, 샘플 데이터) · 스크린샷: `mockup/*.png`
> API 사양 원본: [`research/api/lostark-api-endpoints.md`](../research/api/lostark-api-endpoints.md)

---

## 0. 핵심 결정 요약

| 항목 | 결정 |
|---|---|
| 호출 방식 | **브라우저에서 직접 호출**이 기본입니다(CORS 허용을 확인함, §1). 작은 프록시는 선택 기능으로 둡니다. |
| 키 보관 | 사용자가 `localStorage`(기본)와 `sessionStorage`(공용 PC용) 중에서 고릅니다. 키는 평문으로 저장되며, 이 사실을 화면에 그대로 알립니다. |
| 키 검증 | `GET /news/alarms`를 1회 호출합니다. 200이면 정상, 401이면 거부입니다. |
| 캐릭터 조회 | `GET /armories/characters/{name}?filters=profiles+equipment+avatars+engravings+cards+gems+arkpassive+arkgrid`를 1회, `GET /characters/{name}/siblings`를 1회 호출합니다. 검색 1번에 **2회**를 씁니다. 원정대 목록은 드로어를 처음 열 때 지연 호출합니다. |
| 캐시 | 메모리(TanStack Query)와 `sessionStorage`에 캐릭터별로 **3분 TTL**로 둡니다. 새로고침 버튼은 캐시를 무시합니다. |
| 레이트 리밋 | `X-RateLimit-*` 헤더는 브라우저 JS에서 **읽지 못할 가능성이 높습니다**(Expose 헤더 없음, §1). 그래서 클라이언트 쪽에서 60초 슬라이딩 윈도 카운터로 잔여 횟수를 **추정해** 표시합니다. |
| 스택 | Vite, React 18, TypeScript, TanStack Query v5, CSS Modules 또는 바닐라 CSS 토큰, Vitest. 서버 없이 정적 호스팅합니다. |
| 디자인 | 독자 브랜드 "Ark Lens"입니다(가칭). 참고 이미지에서는 정보 구성과 밀도만 가져오고, 색·형태·로고는 새로 만들었습니다. |

---

## 1. CORS 판단 (키 없이 확인)

### 1.1 확인 방법과 결과 (2026-11-25 실측)

**① curl preflight.** `OPTIONS https://developer-lostark.game.onstove.com/armories/characters/test`를 `Origin: http://localhost:5173`, `Access-Control-Request-Method: GET`, `Access-Control-Request-Headers: authorization`로 보냈습니다.
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:5173      ← 요청 Origin을 그대로 반사
Access-Control-Allow-Headers: authorization             ← 요청한 헤더를 반사(content-type도 반사됨)
Access-Control-Allow-Credentials: true
Vary: Origin
```
- `Origin: null`(file://)과 임의 도메인(`https://evil.example`)도 똑같이 반사되었습니다. **출처 제한이 없습니다.**
- `Access-Control-Allow-Methods`가 없습니다. 하지만 GET/POST는 CORS safelisted method라서 문제가 없습니다(POST `/auctions/items`도 `content-type` 헤더가 반사되므로 통과합니다).

**② 키 없이, 그리고 잘못된 키로 GET.** 응답은 `401` 본문 `{"Message":"Authorization has been denied for this request."}`이었고, 401 응답에도 `Access-Control-Allow-Origin`이 붙어 있었습니다. 그래서 **브라우저에서 401 본문과 상태 코드를 읽을 수 있습니다**.

**③ 실제 브라우저.** 헤드리스 Chrome의 `file://` 페이지에서 `fetch(..., {headers:{authorization:'bearer invalid-test'}})`를 실행했습니다. 결과는 `status=401`이었고, 본문을 정상으로 읽었습니다(CORS 오류 없음). 이때 JS에 보인 헤더는 `content-length`와 `content-type`뿐이었습니다.

### 1.2 결론

- **확인됨**: 브라우저에서 `authorization` 헤더를 붙인 직접 호출이 CORS를 통과합니다. 401 같은 오류 응답도 읽을 수 있습니다.
- **미확인**: 유효한 키로 받는 **200 응답**에도 같은 CORS 헤더가 붙는지는 확인하지 못했습니다. 같은 미들웨어일 가능성이 높지만 키가 없어 검증하지 않았습니다. 429/503 응답에 CORS 헤더가 붙는지도 미확인입니다. 붙지 않으면 브라우저에서는 `TypeError: Failed to fetch`(네트워크 오류)로 보입니다.
- **미확인이지만 가능성 높음**: `Access-Control-Expose-Headers`가 없으므로, 200 응답에 `X-RateLimit-*`가 있더라도 JS에서는 **읽을 수 없을 것**입니다. 그래서 설계는 헤더가 없다고 가정하고 클라이언트 추정치를 씁니다. 헤더가 읽히면 그 값을 우선합니다.

### 1.3 설계: 두 가지 모드 모두 지원

```
[브라우저] ──(direct, 기본)── authorization: bearer <키> ──▶ developer-lostark.game.onstove.com
[브라우저] ──(proxy, 선택)── x-lostark-key: <키> ──▶ [작은 프록시] ──▶ developer-lostark...
```
- `apiBase` 설정값을 둡니다. 기본은 `https://developer-lostark.game.onstove.com`이고, 프록시 모드면 `VITE_PROXY_URL`을 씁니다.
- **프록시 사양(선택)**: Cloudflare Worker나 Vercel Edge 함수 하나, 약 40줄입니다.
  - 허용 경로 화이트리스트: `GET /armories/characters/*`, `GET /characters/*/siblings`, `GET /news/alarms`. 나머지는 403입니다.
  - 요청 헤더 `x-lostark-key`를 `authorization: bearer …`로 바꿔 전달합니다. **키를 로그에 남기거나 저장하지 않습니다.**
  - 응답의 `X-RateLimit-*`는 그대로 전달하고, `Access-Control-Expose-Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset`을 붙입니다. 프록시를 쓰는 부가 이점이 바로 이 남은 횟수 헤더입니다.
  - `Access-Control-Allow-Origin`은 배포 도메인 하나로 고정합니다.
- **자동 전환 규칙**: direct 호출이 `TypeError`(네트워크/CORS)로 실패하고 `VITE_PROXY_URL`이 있으면 "프록시로 재시도" 버튼을 보여 줍니다. 자동으로 전환하지는 않습니다. 키가 다른 서버를 지나가게 되므로 사용자가 동의해야 합니다.

---

## 2. 화면 흐름

```
첫 방문 ─▶ [키 있음?] ─아니오─▶ ① API 키 화면 ──검증 성공·저장──▶ ② 캐릭터 화면(빈 검색 상태)
              │                         ▲
              예                         │ 401 발생 / 상단 "키" 칩 클릭
              ▼                         │
        ② 캐릭터 화면 ──검색──▶ 로딩 ──▶ 결과 | 404 | 401 | 429 | 503 | 네트워크 오류
                  │
                  └─ "원정대 캐릭터" ▶ 드로어(siblings) ─클릭─▶ 해당 캐릭터로 검색(URL 변경)
```

**라우팅(해시 또는 history)**
| 경로 | 화면 |
|---|---|
| `/settings/key` | ① API 키 |
| `/` | ② 빈 상태: 검색창, 최근 검색, 즐겨찾기 |
| `/c/:name` | ② 캐릭터 결과. URL을 공유할 수 있습니다(받는 사람도 자기 키가 필요합니다) |

- 키 없이 `/c/:name`에 들어오면 본문에 "no-key" 상태를 보여 줍니다. 강제로 리다이렉트하지 않으므로 URL이 보존됩니다.
- 검색창에서 `/` 키로 포커스, `Enter`로 검색합니다. 캐릭터명은 `trim()` 후 `encodeURIComponent`로 처리합니다.

---

## 3. 화면 ① API 키 (목업: `apikey-*.png`)

### 3.1 구성
1. **입력**: `type=password`, 보기/숨기기 토글, 붙여넣기 버튼(`navigator.clipboard.readText`, 실패하면 숨김), `autocomplete=off`, `spellcheck=false`.
2. **정규화**(저장 전 자동 처리): 앞뒤 공백 제거, 앞의 `bearer `(대소문자 무시) 제거, 감싼 `{}`와 `<>` 제거. 결과가 `^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$`(JWT 3분절)에 맞지 않으면 호출하지 않고 즉시 형식 오류를 띄웁니다.
3. **보관 방식 라디오**: `localStorage`(기본, "이 브라우저에 저장") 또는 `sessionStorage`("이번 탭에서만").
4. **버튼**: `검증 후 저장`(주 버튼), `검증만 하기`, `키 삭제`(위험 색, 확인 다이얼로그 후 두 저장소 모두 삭제하고 쿼리 캐시도 비움).
5. **결과 알림**(`role=status`/`alert`):
   - 200이면 "검증 성공 · 저장 시각 · 마지막 4자리"를 보여 줍니다.
   - 401이면 "키가 거부됨"입니다.
   - 429/503/네트워크 오류면 "지금은 검증할 수 없음, 그래도 저장할까요?"를 묻습니다. 형식이 맞으면 저장을 허용합니다.
6. **키 발급 방법 카드**: https://developer-lostark.game.onstove.com/ 링크(`target=_blank rel="noopener noreferrer"`)와 3단계 안내(로그인 → 클라이언트 생성, 계정당 5개 → API KEY 복사, 무기한 유효하며 클라이언트를 지우면 무효).
7. **보안 안내 카드**(항상 노출):
   - 키는 **평문**으로 브라우저 저장소에 보관됩니다. 같은 기기의 다른 사용자, 브라우저 확장 프로그램, 이 출처에서 실행되는 스크립트(XSS)는 키를 읽을 수 있습니다.
   - 공용 PC에서는 세션 저장을 쓰고, 다 쓰면 삭제하세요.
   - 유출이 의심되면 포털에서 클라이언트를 지우고 다시 발급하세요.
   - 분당 100회 제한이 있고, 검색 1회에 1~2회를 씁니다.
   - 저장 키 이름, 전송 대상 도메인, 검증 엔드포인트를 투명하게 표기합니다.

### 3.2 저장 규약
```ts
// localStorage 또는 sessionStorage, key: "arklens.apiKey.v1"
type StoredKey = { token: string; savedAt: string /*ISO*/; validatedAt?: string; status: "ok" | "unverified" | "rejected" };
```
- 읽을 때는 `sessionStorage`를 먼저 보고 없으면 `localStorage`를 봅니다. 모든 접근은 `try/catch`로 감쌉니다(사생활 보호 모드 대비).
- 화면에는 토큰 전체를 다시 렌더링하지 않고 마스킹(`…` + 마지막 4자리)해서 보여 줍니다.
- 401을 받으면 키를 **지우지 않고** `status:"rejected"`로 바꿉니다. 상단 칩이 빨간 점으로 바뀝니다.

### 3.3 노출 위험 줄이기 (구현 체크리스트)
- `dangerouslySetInnerHTML`을 쓰지 않습니다. 툴팁 HTML은 §6.3의 sanitizer를 거친 뒤에만 렌더링합니다.
- CSP 메타: `default-src 'self'; connect-src 'self' https://developer-lostark.game.onstove.com <proxy>; img-src 'self' https://cdn-lostark.game.onstove.com data:; script-src 'self'`. 이미지 CDN 호스트는 실제 응답의 `Icon` URL로 확인해야 하므로 **미확인**입니다. 구현할 때 첫 응답을 보고 조정합니다.
- 외부 분석 스크립트와 서드파티 위젯을 넣지 않습니다.
- `Referrer-Policy: no-referrer`를 둡니다. 키는 헤더로만 보내고 URL 쿼리에 넣지 않습니다.

---

## 4. 화면 ② 캐릭터 (목업: `character-*.png`, `siblings-drawer-light.png`)

### 4.1 레이아웃
- **데스크톱(≥1025px)**: 최대 폭 1240px입니다. 맨 위에 프로필 히어로가 전체 폭으로 들어갑니다. 그 아래는 2열 그리드 `340px | 1fr`입니다.
  - 좌측 열(요약·빌드): 아크 패시브, 아크 그리드, 각인, 카드.
  - 우측 열(아이템): 보석(전체 폭), 그 아래 2열로 장비/아바타 탭과 악세사리, 마지막에 출처·캐시 푸터.
- **태블릿(721~1024px)**: 1열입니다. 우측 열(아이템)을 먼저, 좌측 열을 그 다음에 배치합니다.
- **모바일(≤720px)**: 좌우 여백 16px. 상단 바가 2줄이 되고 검색창이 전체 폭을 차지합니다. 프로필은 `96px 초상화 | 정보`이고, 버튼은 아래 줄에 가로로 나열합니다. 장비와 악세사리는 1열, 카드는 3열입니다. 가로 스크롤은 없습니다.

### 4.2 컴포넌트 ↔ API 필드 매핑

모든 데이터는 `ArmoryProfileAll` 한 번의 응답(`A`)과 siblings(`S`)에서 옵니다. "파싱"은 `Tooltip` 문자열에서 꺼내야 하는 값입니다(§6.3).

| 컴포넌트 | 사용 필드 | 표시 규칙 |
|---|---|---|
| `TopBar` | (로컬) 키 상태, 레이트 추정치 | 칩: 초록 = 정상, 회색 = 키 없음, 빨강 = rejected. "잔여 ≈ n/100" |
| `SearchBox` | — | 최근 검색 10개(localStorage `arklens.recent.v1`) |
| `ProfileHero` | `A.ArmoryProfile`: `CharacterImage`, `ServerName`, `CharacterClassName`, `CharacterLevel`, `ExpeditionLevel`, `CharacterName`, `Title`, `ItemAvgLevel`, `CombatPower`, `HonorPoint`, `Stats[]`(Type∈치명·특화·신속·제압·인내·숙련), `GuildName`, `TownName`, `TownLevel` | `ItemAvgLevel`과 `CombatPower`는 문자열이므로 그대로 출력합니다(정렬할 때만 쉼표를 제거하고 숫자로 바꿉니다). 이미지가 없으면 직업 첫 글자 플레이스홀더. `Stats` Tooltip은 hover 시 표시 |
| `ArkPassiveCard` | `A.ArkPassive`: `IsArkPassive`, `Title`, `Points[]{Name,Value,Description}`, `Effects[]{Name,Description,Icon,ToolTip}` | 진화/깨달음/도약 3칸 숫자. `Effects`는 `Name`(=진화/깨달음/도약)으로 그룹화하고 `Description`을 나열합니다. **필드명이 `ToolTip`인 것에 주의** |
| `ArkGridCard` | `A.ArkGrid`: `Slots[]{Index,Name,Point,Grade,Icon,Gems[]{IsActive,Grade}}`, `Effects[]{Name,Level,Tooltip}` | `Name`을 " : "로 나눠 부위와 코어명으로 씁니다. 헤더에 질서/혼돈 포인트 합계. 젬은 마름모 점이며 비활성은 회색. `Effects`는 Lv 표로 보여 주고, Lv가 낮으면 흐리게 처리합니다(기준 <5, 조정 가능) |
| `EngravingCard` | `A.ArmoryEngraving.ArkPassiveEffects[]{Name,Grade,Level,AbilityStoneLevel}` (없으면 `Engravings[]`/`Effects[]`로 폴백) | 등급 색 이름과 레벨 바 4칸. `AbilityStoneLevel`이 있으면 "돌 +n" 배지 |
| `CardSetCard` | `A.ArmoryCard.Cards[]{Slot,Name,Icon,Grade,AwakeCount,AwakeTotal}`, `Effects[].Items[]{Name}` | 카드 6장, 각성 점. 세트 효과는 `Items`의 마지막 `Name`(가장 높은 단계)을 대표로 쓰고 나머지는 펼쳐서 봅니다. 각성 합은 `AwakeCount` 합계 |
| `GemStrip` | `A.ArmoryGem.Gems[]{Slot,Name,Icon,Level,Grade}`, `Effects.Skills[]{GemSlot,Name,Option,Description[]}` | `GemSlot`과 `Slot`을 이어서 스킬명을 붙입니다. 보석 종류(예: 겁화/작열)는 `Name`에서 추출합니다. 정규식 `/(\S+)의 보석/`. 헤더에 종류별 개수와 평균 레벨 |
| `EquipmentCard` (탭: 장비) | `A.ArmoryEquipment[]` 중 `Type`∈무기·투구·상의·하의·장갑·어깨: `Name`, `Icon`, `Grade`, Tooltip 파싱(품질, 티어, 아이템 레벨, 상급 재련 등) | 정렬 순서: 투구·어깨·상의·하의·장갑·무기. `Name` 앞의 `+n`은 강화 수치로 강조. 품질 배지 색은 §5.3 |
| `EquipmentCard` (탭: 아바타) | `A.ArmoryAvatars[]{Type,Name,Icon,Grade,IsInner,IsSet}` | `IsInner=true`(덧입기 아래)는 "내부" 라벨로 구분합니다 |
| `AccessoryCard` | `A.ArmoryEquipment[]` 중 `Type`∈목걸이·귀걸이·반지·어빌리티 스톤·팔찌: Tooltip 파싱(연마 효과 상/중/하, 품질, 스톤 각인 수치, 팔찌 효과) | 상/중/하 등급 칩. 스톤의 감소 각인은 위험 색 |
| `SiblingsDrawer` | `S[]{ServerName,CharacterName,CharacterLevel,CharacterClassName,ItemAvgLevel}` | 서버별로 그룹화하고, 그룹 안에서는 `ItemAvgLevel` 내림차순. 현재 캐릭터를 강조. 클릭하면 `/c/:name`으로 이동. 우측 드로어(모바일은 전체 폭), `Esc`나 스크림을 누르면 닫힘 |
| `SourceFooter` | (로컬) 조회 시각, 캐시 남은 시간 | "새로고침"은 `refetch({cancelRefetch:true})`이며 쿨다운 10초 |

**필터 문자열(상수)**
```ts
export const ARMORY_FILTERS = "profiles+equipment+avatars+engravings+cards+gems+arkpassive+arkgrid";
// combat-skills, colosseums, collectibles 는 v1 범위 밖 (응답 크기 절약). 이후 탭 추가 시 별도 쿼리.
```
**주의**: `+` 구분자는 URL에 그대로 넣어야 합니다. `URLSearchParams`는 `+`를 `%2B`로 인코딩하는데, 서버가 이것을 받아 주는지는 **미확인**입니다. 문자열을 직접 붙이세요.

### 4.3 아이콘
- `Icon` URL을 `<img loading="lazy" decoding="async" referrerpolicy="no-referrer">`로 씁니다. 로드에 실패하면 등급 그라디언트 위에 부위 첫 글자를 얹은 폴백을 보여 줍니다(목업에 있는 바로 그 모양).
- 아이콘 크기: 장비·악세사리 48px, 각인·코어 36px, 보석 46px.

---

## 5. 시각 디자인 규칙

### 5.1 테마 토큰
`:root`에 라이트 토큰을 두고, 다크는 `@media (prefers-color-scheme: dark)`에 `:root:not([data-theme=light])`와 `:root[data-theme=dark]`로 정의합니다. 토글은 시스템 → 라이트 → 다크 순으로 돌고, 선택은 `localStorage["arklens.theme"]`에 저장합니다.

| 토큰 | 라이트 | 다크 |
|---|---|---|
| `--bg` / `--surface` / `--surface-2` | `#f4f5f8` / `#fff` / `#eef0f5` | `#0f1117` / `#171a23` / `#1f2330` |
| `--line` | `#dde1ea` | `#2a2f3e` |
| `--text` / `--text-2` / `--text-3` | `#1b1f2a` / `#5b6375` / `#9aa1b1` | `#e8eaf0` / `#a3a9b8` / `#6b7183` |
| `--accent` / `--on-accent` | `#4b5bdc` / `#fff` | `#8391ff` / `#0f1117` |
| `--danger` / `--warn` / `--ok` | `#d8443a` / `#c98a12` / `#1f9d6b` | `#ff6b60` / `#f0b43c` / `#3fcf94` |

- 카드: 반경 14px, 1px 테두리. 라이트 모드에서만 그림자를 씁니다.
- 폰트: Pretendard가 있으면 쓰고, 없으면 시스템 한글 폰트입니다(웹폰트는 선택). 숫자는 `font-variant-numeric: tabular-nums`.

### 5.2 등급 색상 (`data-grade` 속성 → `--g` 변수)
문자열 `Grade` 값을 그대로 키로 씁니다. 알 수 없는 값이면 `일반` 색으로 처리합니다.

| Grade | 라이트 | 다크 | 용도 |
|---|---|---|---|
| 일반 | `#8c93a3` | `#a2a8b6` | 기본 |
| 고급 | `#3d9a3a` | `#69c165` | |
| 희귀 | `#2d7fd6` | `#5aa8ff` | |
| 영웅 | `#8a4bd8` | `#b07bff` | |
| 전설 | `#e0901b` | `#ffb03a` | |
| 유물 | `#d65a1f` | `#ff7a3d` | |
| 고대 | `#c9b27c` | `#e6d3a3` | |
| 에스더 | `#1fb5ad` | `#3fe0d6` | |

- 아이콘 배경은 `--g` 기반 그라디언트에 1.5px 안쪽 테두리를 씁니다. 텍스트는 `.gtext`(color `--g`), 칩은 `.gpill`(배경을 `--g` 18%로 섞음)입니다.
- 색만으로 등급을 전달하지 않습니다. 등급명 텍스트를 함께 둡니다(접근성).

### 5.3 품질·연마 색
| 품질 | 0–9 | 10–29 | 30–69 | 70–89 | 90–99 | 100 |
|---|---|---|---|---|---|---|
| 배지 | 빨강 `#c0392b` | 노랑 `#c79a1b` | 초록 `#3d9a3a` | 파랑 `#2d7fd6` | 보라 `#8a4bd8` | 주황 `#e0901b` |

연마 효과 상/중/하 칩은 각각 전설·영웅·희귀 색을 씁니다. 감소 각인은 `--danger`입니다.

### 5.4 접근성
- 모든 인터랙티브 요소에 `:focus-visible` 2px accent 아웃라인을 둡니다.
- 탭은 `role=tablist/tab`과 `aria-selected`를 씁니다. 드로어는 `aria-label`, 포커스 트랩, `Esc`로 닫기입니다.
- 오류 알림은 `role=alert`, 성공은 `role=status`입니다. 로딩 영역은 `aria-busy`입니다.
- `prefers-reduced-motion`이면 스켈레톤 애니메이션과 드로어 트랜지션을 끕니다.

---

## 6. 데이터 계층

### 6.1 API 클라이언트
```ts
type ApiError =
  | { kind: "no-key" } | { kind: "unauthorized" }            // 401
  | { kind: "not-found" }                                     // 404 또는 200+null
  | { kind: "rate-limited"; resetAt?: number }                // 429
  | { kind: "maintenance" }                                   // 503
  | { kind: "server"; status: number }                        // 500/502/504/400/403/415
  | { kind: "network" };                                      // fetch TypeError (CORS 포함)

async function lostark<T>(path: string, signal?: AbortSignal): Promise<T>
// headers: { accept: "application/json", authorization: `bearer ${token}` }  (proxy 모드면 x-lostark-key)
// 응답 status → ApiError 매핑. 200인데 body가 `null`이면 not-found.
```
- **없는 캐릭터**: armories는 404가 아니라 **200 + `null` 본문**을 돌려줄 수 있습니다(커뮤니티에 알려진 동작이지만 **미확인**). 두 경우 모두 `not-found`로 처리합니다.
- `AbortController`로 이전 검색을 취소합니다.
- 오류 본문 스키마는 미확인입니다(확인된 401 본문은 `{"Message": "..."}`). `Message`가 있으면 상세 정보 접기 영역에만 보여 줍니다.

### 6.2 레이트 리밋 관리
- `RateGate`: 최근 60초 요청 타임스탬프 큐입니다. 잔여량 = `100 - 큐 길이`입니다. 응답에서 `X-RateLimit-Remaining`/`Reset`이 읽히면 그 값으로 덮어씁니다.
- 잔여가 5 이하면 새 요청을 큐에 대기시키고 상단 칩을 경고색으로 바꿉니다.
- 429를 받으면 `Reset` 헤더가 읽힐 때 그 시각을, 아니면 큐에서 가장 오래된 요청 + 60초를 재시도 시각으로 잡습니다. 카운트다운 후 **1회만** 자동 재시도하고, 그 뒤로는 수동입니다.
- 503: 자동 재시도는 없습니다. "상태 확인" 버튼에 5분 쿨다운을 둡니다.
- TanStack Query 설정: `retry: (n, e) => e.kind === "server" && n < 1`, `staleTime: 180_000`, `gcTime: 600_000`, `refetchOnWindowFocus: false`.

### 6.3 Tooltip 파싱 (내부 구조 미확인)
- 스펙상 `Tooltip`은 `string`입니다. 커뮤니티에서는 "JSON을 문자열로 만든 것이고 안에 HTML 조각(`<FONT COLOR=…>`, `<BR>`)이 있다"고 알려져 있지만 **미확인**입니다.
- `parseTooltip(raw): ParsedTooltip | null` 순수 함수로 격리합니다.
  1. `JSON.parse`를 시도합니다. 실패하면 `null`입니다.
  2. 객체 값을 재귀로 돌면서 문자열을 모으고, HTML 태그를 제거한 평문 줄 배열을 만듭니다.
  3. 정규식 추출기 집합을 적용합니다. 품질 `/품질\s*(\d+)/` 또는 `qualityValue` 숫자 키, 티어 `/티어\s*(\d)/`, 아이템 레벨 `/아이템 레벨\s*([\d,]+)/`, 연마 효과 줄 `/(추가 피해|적에게 주는 피해|…)\s*\+[\d.]+%?/`, 스톤 각인 `/\[(.+?)\]\s*활성도\s*\+?(\d+)/` 등입니다.
- 추출에 실패하면 해당 배지를 **숨깁니다**. 추측한 값은 표시하지 않습니다.
- 상세 hover/탭 팝오버에는 평문 줄 배열만 보여 줍니다(HTML 렌더링 금지 → XSS 차단).
- **구현 첫 단계에서 실제 응답 1건을 `fixtures/armory-sample.json`으로 저장**하고 이것으로 단위 테스트를 씁니다(개인 키 사용, 커밋 전 키는 제거).

---

## 7. 상태 화면 (목업: `states-desktop-dark.png`)

본문 영역만 바뀌고 상단 바는 유지됩니다.

| 상태 | 트리거 | 표시 | 액션 |
|---|---|---|---|
| empty | `/`, 검색 전 | 큰 검색창, 최근 검색, 즐겨찾기 칩 | — |
| loading | 쿼리 pending | 섹션 모양 스켈레톤(프로필, 2열). **300ms 지연 후** 표시 | — |
| no-key | 저장된 키 없음 | 🔑 "API 키가 필요합니다" | `키 등록하기`(→①), `키 발급받기 ↗` |
| unauthorized | 401 | ⛔ "API 키가 거부되었습니다". 키 상태를 rejected로 바꿈 | `키 다시 입력`, `다시 시도` |
| not-found | 404 또는 200+null | 🔍 "'{name}' 캐릭터를 찾을 수 없습니다" + 반영 지연 안내 | 최근 검색 칩 |
| rate-limited | 429 또는 RateGate 대기 | ⏳ 카운트다운과 진행 바. 캐시 결과가 있으면 그 위에 배너로만 표시 | `지금 재시도`(카운트다운 동안 비활성), `취소` |
| maintenance | 503 | 🛠 "서버 점검 중" | `상태 확인`(5분 쿨다운), 공식 공지 링크 |
| network | fetch TypeError | 📡 연결 불가, CORS 가능성 언급 | `다시 시도`, (프록시 설정 시) `프록시로 재시도` |
| server | 5xx/400/403/415 | 일반 오류와 상태 코드 | `다시 시도` |
| section-empty | 해당 필드 null 또는 빈 배열 | 카드는 유지하고 "장착한 ○○이 없습니다" 한 줄 | — |

- **부분 실패**: siblings만 실패하면 드로어 안에서만 오류를 보여 주고, 본문은 정상으로 표시합니다.
- **캐시 우선**: 캐시된 결과가 있는 상태에서 429/503이 나면 결과를 유지하고, 상단에 얇은 배너로 알립니다.

---

## 8. 추천 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 빌드 | Vite 5 + TypeScript 5 (strict) | 정적 결과물, 빠른 개발 서버 |
| UI | React 18 | 컴포넌트 단위가 섹션 카드와 1:1로 맞음 |
| 라우팅 | React Router 6 (`createHashRouter`) | 정적 호스팅에서 404 없이 동작(GitHub Pages 등) |
| 서버 상태 | TanStack Query 5 | 캐시, 취소, 재시도 정책 |
| 스타일 | 전역 CSS 토큰(목업의 `:root`를 그대로 이식) + CSS Modules | 런타임 비용 없음, 테마 전환이 단순 |
| 테스트 | Vitest + Testing Library + MSW | 상태 화면을 MSW로 401/404/429/503 재현 |
| 프록시(선택) | Cloudflare Worker (`proxy/worker.ts`) | 무료 티어, 40줄 |
| 품질 | ESLint + Prettier, `tsc --noEmit` | |

**디렉터리 제안**
```
src/
  api/        client.ts (lostark fetch, ApiError) · rateGate.ts · endpoints.ts (ARMORY_FILTERS)
  storage/    apiKey.ts (정규화·저장·마스킹) · prefs.ts (theme, recent, favorites)
  parse/      tooltip.ts · equipment.ts · gems.ts · grade.ts
  features/
    key/      KeySettingsPage.tsx · KeyGuide.tsx · SecurityNotice.tsx
    character/CharacterPage.tsx · ProfileHero · ArkPassiveCard · ArkGridCard · EngravingCard ·
              CardSetCard · GemStrip · EquipmentCard · AccessoryCard · SiblingsDrawer · states/*
  ui/         Card · GradeIcon · Pill · Tabs · Drawer · Skeleton · ThemeToggle · TopBar
  styles/     tokens.css · base.css
fixtures/     armory-sample.json (실응답 1건, 개인정보 확인 후)
proxy/        worker.ts (선택)
```

---

## 9. 구현 단계 (작업 단위)

각 단계는 독립적으로 리뷰할 수 있는 크기입니다. ✅는 완료 기준입니다.

1. **스캐폴드**: Vite, React, TS, Router, Query, Vitest, ESLint. `styles/tokens.css`에 목업 토큰과 등급 색을 이식하고 ThemeToggle을 만듭니다. ✅ 시스템/라이트/다크 전환과 새로고침 후 유지.
2. **키 저장소** `storage/apiKey.ts`: 정규화, JWT 형식 검사, 두 저장소 읽기/쓰기/삭제, 마스킹, try/catch. ✅ 단위 테스트(접두사, 중괄호, 공백 케이스).
3. **API 클라이언트** `api/client.ts`와 `rateGate.ts`: 상태 코드 → ApiError, 200+null → not-found, AbortSignal, Expose 헤더를 선택적으로 읽기. ✅ MSW 테스트 7종(200/null/401/404/429/503/network).
4. **키 설정 화면**: 입력, 보기, 붙여넣기, 라디오, 검증(`/news/alarms`), 저장/삭제, 발급 안내, 보안 안내. ✅ 목업 ①과 동일, 키 삭제 시 쿼리 캐시도 비움.
5. **TopBar와 SearchBox**: 키 상태 칩, 잔여 추정치, `/` 단축키, 최근 검색. ✅ 검색하면 `/c/:name`으로 이동.
6. **캐릭터 쿼리 훅** `useArmory(name)`, `useSiblings(name, enabled)`: 필터 상수, staleTime 3분, sessionStorage 영속화(선택). ✅ 같은 이름을 다시 검색하면 네트워크 호출 0회.
7. **실응답 픽스처 확보와 Tooltip 파서**: 개인 키로 1회 호출해 `fixtures/`에 저장하고 `parse/*`를 작성합니다. ✅ 장비 6, 악세 5, 스톤, 팔찌, 보석 종류 추출 테스트 통과. 실패 필드는 null.
8. **공용 UI**: Card, GradeIcon(이미지 + 폴백), Pill, Tabs, Drawer(포커스 트랩), Skeleton.
9. **섹션 카드 구현**(병렬 가능): ProfileHero → GemStrip → EquipmentCard(장비/아바타) → AccessoryCard → ArkPassiveCard → ArkGridCard → EngravingCard → CardSetCard. 각 카드에 section-empty를 처리합니다. ✅ 픽스처로 렌더링한 결과가 목업과 같은 구성.
10. **SiblingsDrawer**: 지연 로드, 서버별 그룹, 정렬, 현재 강조, 클릭하면 이동, Esc로 닫기. ✅ 드로어를 처음 열 때만 siblings 호출.
11. **상태 화면 전부**(§7): loading 지연, 429 카운트다운과 1회 자동 재시도, 503 쿨다운, 캐시 우선 배너. ✅ MSW 시나리오별 스냅샷.
12. **반응형과 접근성 점검**: 390/768/1280px, 키보드만으로 조작, 대비 확인. ✅ 390px에서 가로 스크롤 없음.
13. **보안 마감**: CSP 메타, `noopener`, `Referrer-Policy`, `dangerouslySetInnerHTML` 금지 lint 규칙. ✅ 빌드 결과물에서 키 문자열이 URL이나 로그에 나오지 않음.
14. **(선택) 프록시**: `proxy/worker.ts`(화이트리스트, 헤더 변환, Expose 헤더, 고정 Origin)와 앱의 `VITE_PROXY_URL` 토글. ✅ 프록시 모드에서 잔여 횟수가 실제 헤더 값으로 표시됨.
15. **(구현 직후 확인)** 유효한 키로 200 응답의 CORS 헤더, `X-RateLimit-*` 노출 여부, 없는 캐릭터 응답 형태(404인지 200+null인지), 아이콘 CDN 호스트를 확인하고 이 문서의 "미확인" 항목을 갱신합니다.

---

## 10. 범위 밖 (v1)

- 전투 스킬/트라이포드, 증명의 전장, 수집형 포인트. 필터에 추가하고 탭을 확장하는 방식으로 v2에서 다룹니다.
- 경매장/거래소 시세, 뉴스/이벤트.
- 서버 쪽 캐시나 DB. 이용약관의 "무단 보관/재배포 금지" 조항 때문에 브라우저 메모리와 세션 캐시만 씁니다.
- 광고와 수익화. 약관상 사전 승인이 필요합니다.

## 11. 목업 사용법
- `mockup/index.html`을 브라우저로 엽니다. 상단 점선 바(목업 전용)에서 ① API 키 / ② 캐릭터 / ③ 상태 화면 / 원정대 드로어로 전환합니다.
- URL 옵션: `#key`, `#char`, `#states`, `#drawer`, `?theme=light|dark`.
- 샘플 데이터 `SAMPLE`은 실제 응답 필드명을 따릅니다. `_parsed.*`는 Tooltip 파서가 만들어 내야 할 값을 뜻합니다.
- 스크린샷: `character-desktop-light.png`, `character-desktop-dark.png`, `character-mobile-dark.png`, `apikey-desktop-light.png`, `apikey-mobile-light.png`, `states-desktop-dark.png`, `siblings-drawer-light.png`.
