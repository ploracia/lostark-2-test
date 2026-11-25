# Mokokoloa — 캐릭터 화면 "이관" 탭 설계

> 작성일 2026-11-25 · 구현 담당: Codex · 상태: 설계와 정적 목업까지 끝남, 구현 전
> 앱 이름: 이 문서와 목업은 새 이름 **Mokokoloa**로 씁니다. 기존 코드(`Ark Lens` 표기)의 이름 변경은 별도 작업입니다.
> 목업: `docs/mockup-transfer/index.html` (외부 호출 없음, `fixtures/armory-sample.json` 캐릭터 사용) · 스크린샷: `docs/mockup-transfer/*.png`
> 규칙 출처(우선순위 순서):
> 1. 공식 공지 [로스트아크 2부 업데이트에 따른 주요 개편 사항 사전 안내](https://lostark.game.onstove.com/News/Notice/Views/13608) (2026-11-25 게시)
> 2. 2026-11-20 On-Air 방송 정리(인벤). 공지와 다르면 공지를 따릅니다.
> 3. 정리본: [`research/transfer/transfer-analysis.md`](../research/transfer/transfer-analysis.md) (이 문서의 표 번호 `표1`~`표10`은 공지 본문 표 순서입니다)

---

## 0. 핵심 결정 요약

| 항목 | 결정 |
|---|---|
| 탭 | 캐릭터 화면에 `현재` / `이관` 탭 2개를 둡니다. URL은 `/c/:name`(현재)과 `/c/:name/transfer`(이관)입니다. |
| 추가 호출 | **0회.** 이미 받은 armory 응답(`useArmory(name)` 캐시)만으로 계산합니다. 탭을 바꿔도 다시 조회하지 않고, 최근 검색에 다시 기록하지도 않습니다. |
| 계산 위치 | `src/transfer/*` 순수 함수 모듈. React와 API를 모릅니다. 입력은 `TransferInput`(armory에서 뽑은 값 + 사용자 보정값), 출력은 `TransferResult`입니다. |
| 규칙 데이터 | `src/transfer/rules/*.ts`에 `as const` 표로 둡니다. 공지가 바뀌면 표만 고칩니다. 표마다 출처(공지 표 번호)와 `RULES_VERSION`을 붙입니다. |
| 근거 배지 | 모든 결과 값에 `공식 규칙 확정` / `추정` / `미확인(계산 불가)` 중 하나를 붙입니다. 미확인 산식은 값을 지어내지 않고 범위나 "계산 불가"로 표시합니다. |
| API로 못 얻는 값 | 접힌 **"추가 정보 입력"** 패널에서 선택 입력으로 받습니다. 입력하지 않으면 기본 가정을 쓰고, 쓴 가정을 "적용 중인 가정" 목록에 보여 줍니다. 입력값은 이 브라우저의 `localStorage`에만 저장합니다. |
| 평균 아이템 레벨 | 현재 값은 `ArmoryProfile.ItemAvgLevel`(게임 표시값, 6부위 평균)을 그대로 씁니다. 이관 후 값은 엔진이 계산한 16부위 평균입니다. 하나라도 범위로 나온 부위가 있으면 평균도 범위로 표시합니다. |
| 면책 | 탭 맨 위 배너와 맨 아래 푸터에 "공식 공지 기반 예상치이며 실제 결과와 다를 수 있습니다"와 공지 링크를 항상 표시합니다. |
| 디자인 | 기존 토큰(`src/styles/tokens.css`)과 카드, 등급 색, `.pill`, `.notice` 등을 그대로 씁니다. 새로 만드는 것은 근거 배지 3종과 변환 행 레이아웃뿐입니다. |

---

## 1. 탭 구조와 라우팅

### 1.1 URL

| 경로 | 화면 | 비고 |
|---|---|---|
| `/c/:name` | 현재 탭 (지금의 캐릭터 화면 그대로) | 기본 탭. 기존 링크는 바뀌지 않습니다. |
| `/c/:name/transfer` | 이관 탭 | 새로 추가 |
| `/c/:name/그 밖의 하위 경로` | `/c/:name`으로 `replace` 이동 | 알 수 없는 탭 |

- HashRouter(`#/c/...`)와 BrowserRouter 둘 다 같은 경로 규칙을 씁니다.
- `main.tsx`의 경로 정규식을 `^\/c\/([^/]+)(?:\/(transfer))?\/?$`로 넓히고, 두 번째 그룹을 `tab: "current" | "transfer"`로 `Character`에 넘깁니다.
- `characterUrl(name, tab?)`에 선택 인자 `tab`을 추가합니다. `tab === "transfer"`이면 `/transfer`를 붙입니다.
- 상단 검색은 항상 현재 탭(`/c/:name`)으로 갑니다. 원정대 드로어에서 다른 캐릭터를 고르면 **지금 탭을 유지**합니다(이관 탭에서 원정대 캐릭터를 차례로 비교하는 흐름을 위해서입니다).

### 1.2 데이터와 캐시 (요청 0회 원칙)

- `Character`는 `key={name}`으로 마운트되므로 탭만 바뀌면 다시 마운트되지 않습니다. 두 탭 모두 같은 `useArmory(name)` 결과를 씁니다.
- 이관 탭으로 바로 들어온 경우(`/c/:name/transfer` 직접 열기)에는 평소처럼 armory를 **1회** 조회합니다. 이것은 캐릭터 조회 자체이며, 이관 계산 때문에 생기는 추가 요청은 없습니다.
- 계산은 `useMemo(() => computeTransfer(extractTransferInput(data), overrides), [data, overrides])`로 합니다. 새로고침 버튼으로 armory가 갱신되면 다시 계산됩니다.
- **최근 검색 기록**: 지금은 `location.key`가 바뀔 때마다 `recordRecent`를 부릅니다. 탭 전환도 `location.key`를 바꾸므로, 탭 링크는 `state: { tabSwitch: true }`를 넘기고 기록 effect는 이 state가 있으면 건너뛰게 합니다. 완료 기준: 탭을 10번 바꿔도 네트워크 요청 0회, 최근 검색 순서 변화 없음.
- 오류 상태(`ErrorState`), 스켈레톤, 캐시 배너는 두 탭이 공유합니다. 탭 바는 `data`가 있을 때만 그립니다.

### 1.3 탭 UI

- 위치: `ProfileHero` 카드 바로 아래, 본문 그리드 위에 전체 폭으로 둡니다. "캐릭터 정보 옆" 요구에 맞춰 프로필과 붙어 보이도록 위 여백을 8px로 줄입니다.
- 마크업: 라우팅 탭이므로 ARIA tablist 대신 **링크 내비게이션**을 씁니다.
  ```html
  <nav class="view-tabs" aria-label="캐릭터 보기">
    <a href="/c/이름" aria-current="page">현재</a>
    <a href="/c/이름/transfer">이관 <span class="pill new-pill">2부</span></a>
  </nav>
  ```
  `aria-current="page"`가 선택 표시입니다. 키보드는 Tab으로 이동하고 Enter로 엽니다. 이 방식이면 뒤로 가기와 새 탭 열기가 자연스럽게 됩니다.
- 모양: 밑줄형 탭. 높이 40px, 글자 14px/600. 선택 탭은 `--text` + 아래 2px `--accent` 선, 비선택은 `--text-2`. 아래 경계는 1px `--line`. 모바일(≤720px)에서는 두 탭이 50%씩 폭을 나눕니다.
- `이관` 탭 옆 작은 `2부` 알약(`--accent-soft` 배경)은 신규 탭이라는 표시입니다. 2부 업데이트가 끝나 이관 탭의 의미가 사라지면 탭째로 제거합니다(§9 마지막 단계).

---

## 2. 화면 구성 (이관 탭)

### 2.1 레이아웃

데스크톱(≥1025px)은 기존 화면과 같은 `340px | 1fr` 2열입니다. 태블릿 이하는 1열이고 오른쪽 열(결과)을 먼저 보여 줍니다.

```
┌ ProfileHero ─────────────────────────────────────────────────────────┐
├ [현재] [이관 2부] ───────────────────────────────────────────────────┤
│ ⚠ 면책 배너 (공지 링크)                                               │
├ 요약 카드 (전체 폭) ──────────────────────────────────────────────────┤
│  현재 1,742.50 (6부위)  →  이관 후 예상 1,788.75 (16부위)  +46.25      │
│  근거 집계: 확정 n · 추정 n · 계산 불가 n                              │
├──────────────────┬───────────────────────────────────────────────────┤
│ 왼쪽 340px       │ 오른쪽 1fr                                        │
│ · 추가 정보 입력 │ · 장비 변환 (6부위 → 16부위 행)                   │
│   (접힘)         │ · 이관 후 16부위 배치도 (왼쪽 8 / 오른쪽 8)       │
│ · 적용 중인 가정 │ · 에스더 무기                                     │
│ · 환급·지급 목록 │ · 장신구 → 마력 주입 주문서                       │
│ · 계산 범위 밖   │ · 팔찌 → 인장 주문서 · 어빌리티 스톤 → 각인 슬롯  │
│                  │ · 보석 → 광휘                                     │
├──────────────────┴───────────────────────────────────────────────────┤
│ 푸터: 면책 문구 · 공지 링크 · 규칙 버전 · 조회 시각 · 새로고침       │
└──────────────────────────────────────────────────────────────────────┘
```

모바일(390px): 좌우 16px 여백, 1열. 순서는 면책 → 요약 → 장비 변환 → 16부위 → 에스더 → 장신구 → 팔찌 → 스톤 → 보석 → 추가 정보 입력 → 가정 → 환급·지급 → 계산 범위 밖 → 푸터. 장비 변환 행은 "현재 → 이관 후"를 위아래로 쌓습니다. 가로 스크롤은 없어야 합니다.

### 2.2 근거 배지

| 배지 | 키 | 색 | 쓰는 경우 |
|---|---|---|---|
| `공식 확정` | `official` | `--ok` (12% 배경) | 공지 표에서 바로 나온 값이고 입력값도 API에서 확실히 읽은 경우 |
| `추정` | `estimated` | `--warn` (14% 배경) | 규칙은 공지에 있지만 입력 해석이 검증되지 않았거나(예: 스톤 `Lv.N` 의미), 공지 문구에서 합리적으로 추론한 경우(예: 에스더 1800+ 연동 기준 레벨) |
| `미확인` | `unknown` | `--text-3` 테두리만, 점선 | 산식이나 수량이 공개되지 않아 계산하지 않은 경우. 값 대신 "계산 불가" 또는 범위를 씁니다. |

- 배지 텍스트는 항상 글자로 씁니다. 색만으로 구분하지 않습니다.
- 배지에 `title`(또는 탭하면 펼쳐지는 한 줄)로 출처를 붙입니다. 예: `공지 표1`, `공지 표9 + 스톤 Lv 해석 미검증`.
- **집계 규칙**: 여러 값을 합친 값(평균 등)의 배지는 구성 요소 중 가장 약한 배지입니다(`unknown` < `estimated` < `official`). 범위로 나온 값은 최소 `estimated`입니다.
- **추측 값 금지**: `unknown`인 항목에는 숫자를 쓰지 않습니다. "1~21등급 중 미정"처럼 공지가 밝힌 전체 범위만 쓸 수 있습니다.

### 2.3 섹션별 내용

#### ① 면책 배너 (항상)
`.notice.warn`:
> 공식 공지(2026-11-25) 기반 **예상치**입니다. 실제 이관 결과와 다를 수 있습니다. 장착 중인 장비만 보고 계산합니다. [공지 보기 ↗](https://lostark.game.onstove.com/News/Notice/Views/13608)

#### ② 요약 카드
- 큰 숫자 2개: `현재 평균 아이템 레벨`(`ArmoryProfile.ItemAvgLevel`, 부제 "6부위") → `이관 후 예상`(16부위 평균, 소수 둘째 자리). 화살표 오른쪽에 차이(`+46.25`, 양수 `--ok`, 음수 `--danger`).
- 이관 후 값 옆에 근거 배지(집계 규칙).
- 보조 줄: `장착 6부위 계산 1,776.67`. 프로필 값과 0.5 이상 차이 나면 "프로필 값과 장착 장비 평균이 다릅니다. 프로필 갱신 지연이나 프리셋 차이일 수 있습니다." 한 줄을 붙입니다.
- 근거 집계 칩: `확정 21 · 추정 3 · 계산 불가 2`. 누르면 해당 배지가 붙은 첫 행으로 스크롤합니다(선택).
- 평균이 범위이면 `1,781.25 ~ 1,788.75`처럼 쓰고, 범위를 만든 원인(예: "에스더 엘라 단계 미확인")을 한 줄로 밝힙니다.

#### ③ 장비 변환 (6부위 → 16부위)
기존 6부위마다 한 행입니다. 행 순서는 투구, 견갑, 상의, 하의, 장갑, 무기입니다(API `Type` `어깨`는 화면에서 공지 명칭 `견갑`으로 씁니다).

| 열 | 내용 |
|---|---|
| 현재 | 등급 아이콘, 이름, `+재련`, 아이템 레벨, 품질 배지, 상급 재련 단계(있으면) |
| → | 화살표 |
| 이관 후 왼쪽 | 방어구/무기 슬롯: 티어·등급·연마 단계·아이템 레벨, 슬롯 재련 단계 |
| 이관 후 오른쪽 | 장신구/보구 슬롯: 티어·등급·연마 단계·아이템 레벨 |
| 근거 | 배지 |

- 방어구 행: 왼쪽 1칸(같은 부위) + 오른쪽 1칸(투구→목걸이, 견갑→귀걸이1, 상의→귀걸이2, 하의→반지1, 장갑→반지2).
- 무기 행: 왼쪽 3칸(무기, 완갑, 허리띠) + 오른쪽 3칸(성물, 인장, 팔찌).
  - 무기 슬롯 재련 = 기존 무기 재련 단계.
  - 완갑 슬롯 재련 = 기존 완갑 재련 단계. API 노출이 확인되지 않았으므로 입력이 없으면 "재련 단계 확인 필요"(미확인)로 씁니다. 완갑의 아이템 레벨은 무기를 따르므로 확정입니다.
  - 허리띠 슬롯 재련 = 0단계(공지 확정).
- 장인의 기운: 각 왼쪽 칸 아래에 "장인의 기운 유지" 한 줄. 사용자가 % 를 입력했으면 그 값을 씁니다. 평균 계산에는 영향이 없습니다.
- 상급 재련: 공지는 "상급 재련 제거"만 밝혔고 별도 보상을 말하지 않았습니다. 상급 재련 단계가 있는 행에는 "상급 재련 N단계는 제거됩니다(효과는 현재 아이템 레벨에 이미 반영되어 이관 기준에 포함)"를 적습니다. 보상이 있는지는 미확인으로 환급 목록에 둡니다.
- 품질: "품질 시스템 제거, 부위별 최고 품질에 따라 토큰 지급(수량 미확인)"을 환급 목록에 둡니다.

#### ④ 이관 후 16부위 배치도
공지(방송 캡처 inven_05) 배치를 그대로 따릅니다. 왼쪽 8칸 = 투구·견갑·상의·허리띠·하의·장갑 + 무기·완갑, 오른쪽 8칸 = 목걸이·귀걸이1·귀걸이2·반지1·반지2·팔찌 + 성물·인장. 칸마다 등급색 아이콘, 아이템 레벨, 연마 단계, (왼쪽만) 슬롯 재련 단계. 신규 슬롯(허리띠·성물·인장)에는 `신규` 표시. 데스크톱은 2열(8×2), 모바일도 2열(각 칸 폭 축소, 아이콘 36px)입니다.

#### ⑤ 에스더 무기
- 장착 무기가 `Grade === "에스더"`이면: 진화 단계(`Name`의 `+N`), 엘라 단계(툴팁에서 읽을 수 있으면), 아이템 레벨 → 공지 표2~4의 신규 엘라/연마, 신규 아이템 레벨, 무기 슬롯 재련 단계, 환급(에스더의 기운, 로맨틱 재료 키트).
- 엘라 단계를 툴팁에서 못 읽으면(현재 미검증) 먼저 **(진화 단계, 기존 아이템 레벨)** 쌍을 표2의 "기존 아이템 레벨" 열과 맞춰 봅니다. 한 행만 맞으면 그 행을 쓰고 `추정`("아이템 레벨로 엘라 단계 추론")으로 표시합니다(예: 진화 8 + 1715 → 엘라 2단계). 맞는 행이 없거나 아이템 레벨도 못 읽으면 그 진화 단계에서 가능한 행을 모두 뽑아 **범위**로 보여 주고(예: 진화 8 → 엘라 2단계 1625 ~ 엘라 3단계 1735), 입력 패널의 엘라 단계 선택을 안내합니다. 배지는 `추정`.
- 연동 5부위(완갑·허리띠·성물·인장·팔찌): 에스더 기존 아이템 레벨이 1800 미만이면 그 아이템 레벨을 표1에 넣어 정합니다. 공지는 "더 높은 아이템 레벨의 무기를 기준으로 교체 지급"이라고만 썼으므로 이 적용 방식은 `추정`입니다.
- 아이템 레벨이 내려가는 조합(예: 진화 5단계 1600 → 엘라 1단계 1100)은 `--danger` 색 화살표와 "아이템 레벨 하락, 대신 재료 환급" 문구를 붙입니다.
- 일반 무기와 둘 다 가진 경우(입력 패널): 기존 아이템 레벨이 높은 쪽을 기준으로 씁니다(공지 확정). 에스더 무기 아이템 레벨이 1800 이상이면 연동 5부위는 "재련 25단계 무기 기준"인데, 이 기준 아이템 레벨이 1800(→ 고대 3연마 1815)인지는 공지에 숫자가 없으므로 `추정`입니다.
- 에스더 무기가 없으면 카드를 접힌 한 줄로 줄입니다: "장착한 에스더 무기가 없습니다. 보관 중인 에스더 무기가 있으면 추가 정보에 입력하세요."

#### ⑥ 장신구 → 마력 주입 주문서
장신구 5개(목걸이, 귀걸이×2, 반지×2) 행. 열: 현재(등급, 품질, 연마 옵션 상/중/하 칩) → 결과(`목걸이 마력 주입 주문서 4등급` / `영롱한 보석 파편` / `제거`) + 판정 이유 한 줄 + 배지.
- 판정 이유 예: "딜러 기준 1·2옵션 상/중 → 4등급 (3옵션은 상/상/상·상/상/중일 때만 반영)".
- 거래 가능 횟수: "기존 거래 가능 횟수 승계". 툴팁에서 횟수를 읽으면 표시하고, 못 읽으면 "횟수 확인 필요"(미확인)만 씁니다.
- 영롱한 보석 파편 수량은 미확인이므로 수량을 쓰지 않습니다.

#### ⑦ 팔찌 → 인장 마력 주입 주문서
- 결과: `인장 마력 주입 주문서 — 1~21등급 중 계산 불가` + `미확인` 배지. **등급 숫자를 추측해 쓰지 않습니다.**
- 대신 공지 표7/8로 옵션별 티어를 보여 줍니다(이 부분은 `공식 확정`): 딜러 기준 / 서포터 기준(서포터 가능 클래스만) 각각 옵션 → 티어 칩. "공지: 동일 티어 내에서도 성능 차이가 있을 수 있습니다" 주석.
- 대상 여부(공식): 티어 4이고 효과 부여 중/완료 → 대상. 티어 3 → 제거. 효과 미부여 → 분해 결과물(실링 교환). 딜러 클래스인데 서포터 옵션만 있으면 → 대상 제외.
- "보유한 최고 성능 1개만"이므로 "미장착 팔찌가 더 좋으면 그 팔찌가 기준이 됩니다" 안내.

#### ⑧ 어빌리티 스톤 → 각인 슬롯 업그레이드
- 각인 슬롯 원 5개 그림. 채워지는 슬롯 수와 단계(예: 2개 7단계)를 칠합니다. 합계 8이면 "추가 아이템 지급(종류 미확인)".
- 판정 이유: "원한 3 + 아드레날린 2 = 합계 5 (딜러 유효 각인 2개) → 각인 슬롯 2개 7단계".
- 배지: 표9 규칙은 확정이지만 스톤 툴팁 `Lv.N`이 활성 포인트인지 세공 노드 수인지 검증되지 않았으므로 `추정`. 엔진은 값이 0~4이면 활성 포인트로, 6~10이면 노드 수로 보고 `6→1, 7~8→2, 9→3, 10→4`로 바꿉니다(정리본 §6.2). `세공 완료` 여부는 API로 확인하지 못하므로 "장착 스톤은 세공 완료로 가정"을 가정 목록에 넣습니다.
- 비유효 조합(예: 딜러 클래스의 서포터 각인 조합) → "각인 슬롯 반영 없음, 초월의 가루로 교체(수량 미확인)".

#### ⑨ 보석 → 광휘
- 보석 11칸 격자: 현재 칸(종류·레벨) 아래에 이관 후(`광휘 Lv.N`)를 씁니다. 레벨이 바뀌는 칸(티어 3은 -2)만 강조합니다. 제거되는 칸(티어 3 1~2레벨 이하)은 취소선과 `제거`.
- 헤더 요약: `겁화 5 · 작열 6 → 광휘 11 (레벨 변화 없음)`.
- 8레벨 귀속 광휘(유료 성장 상품/낙원 획득)는 선택 상자입니다. 획득처와 귀속 여부를 API로 알 수 없으므로 기본 가정은 "일반 획득"이고, 입력 패널에서 바꾸면 해당 칸에 "선택 상자: 거래 불가 8레벨 / 거래 가능 7레벨"을 표시합니다.
- 공통 안내: "장착 보석은 모두 해제되어 통합 보관함으로 지급됩니다. 귀속 여부 유지."

#### ⑩ 환급·지급 목록 (왼쪽 열)
행마다 `아이템 · 수량 · 근거 · 배지`. 수량이 공개되지 않은 항목은 "수량 미확인"으로만 씁니다.

| 항목 | 이 캐릭터에서 계산 | 배지 |
|---|---|---|
| 에스더의 기운 / 로맨틱 재료 키트 (캐릭터 귀속) | 에스더 무기가 있으면 표2~4 수량 | 공식 확정 (엘라 미확인이면 범위·추정) |
| 2부 성장 재료 교환용 토큰 — 품질 보상 | 대상 부위 품질 나열, 수량 미확인 | 미확인 |
| 2부 성장 재료 교환용 토큰 — 카르마 22레벨 이상 | `ArkPassive.Points[].Description`의 `N레벨`이 22 이상인 항목 나열 | 추정 (Description과 카르마 레벨 대응 미검증), 수량 미확인 |
| 영롱한 보석 파편 | 비대상 장신구 개수 | 대상 판정은 확정, 수량 미확인 |
| 팔찌 분해 결과물 | 효과 미부여 팔찌일 때 | 공식 확정, 수량 미확인 |
| 초월의 가루 / 장신구 슬롯 성장 재료 | 장착 스톤이 비유효일 때 | 공식 확정, 수량 미확인 |
| 상급 재련 제거 | 상급 재련이 있는 부위 나열 | 미확인 (보상 언급 없음) |
| (API로 알 수 없음) 재련 재료, 팔찌 재변환권, 여분 스톤, 비상의 돌 키트, 큐브 입장권 등 | 안내만 | 미확인 |

#### ⑪ 계산 범위 밖 (왼쪽 열, 접힘)
카드·특수 장비·생활·항해·카르마 레벨 외 아크 패시브·스킬 룬·콘텐츠 보상은 장비 이관이 아니어서 계산하지 않습니다. 이름만 나열하고 공지 링크를 겁니다.

#### ⑫ 푸터
`공식 공지 기반 예상치, 실제 결과와 다를 수 있음 · 공지 13608 ↗ · 규칙 버전 2026-11-25 · Lost Ark Open API · 조회 hh:mm:ss · 새로고침`. 새로고침은 기존 동작 그대로입니다.

### 2.4 추가 정보 입력 패널

`<details class="card">`로 기본 접힘. 요약 줄: `추가 정보 입력 (선택) — 입력하지 않으면 아래 가정으로 계산합니다`. 입력이 하나라도 있으면 요약 줄에 `입력 3개 적용 중` 칩과 `모두 지우기` 버튼.

| 입력 | 형태 | 결과에 주는 영향 | 입력 없을 때 가정 |
|---|---|---|---|
| 부위별 더 높은 미장착 장비 아이템 레벨 | 부위 6개 숫자 입력(빈칸 허용) | 그 부위 변환 기준이 됨 (공지: 부위별 최고 아이템 레벨 기준) | 장착 장비가 그 부위 최고 |
| 보관 중인 에스더 무기 | 진화 0~10 선택 + 엘라 없음/1~3 선택 | 무기 기준 비교, 환급 | 에스더 무기 없음 |
| 장착 에스더 무기의 엘라 단계 | 없음/1~3 | 에스더 결과를 범위에서 한 값으로 | 범위로 표시 |
| 기존 완갑 재련 단계 | 0~25 숫자 | 완갑 슬롯 재련 단계 | "확인 필요"로 표시 |
| 부위별 장인의 기운 % | 6개 숫자 | 표시만(유지됨) | "기존 수치 유지"만 표시 |
| 8레벨 광휘 보석 획득처 | 8레벨 보석별 `일반 / 유료 성장 상품 / 낙원` + 귀속 여부 | 선택 상자 표시 | 일반 획득 |
| 장착 스톤 세공 완료 여부 | 체크박스(기본 체크) | 각인 슬롯 반영 여부 | 세공 완료 |

- 저장: `localStorage["mokokoloa.transfer.v1"]`에 `{ [characterName]: TransferOverrides }`. 모든 접근은 기존 `storage.ts`의 `read`/`write`처럼 try/catch. 서버로 보내지 않습니다. 이름 변경 작업 때 키 접두사를 기존 앱과 맞춥니다.
- 숫자 입력은 범위 밖이면 저장하지 않고 필드 아래 오류 한 줄을 띄웁니다(아이템 레벨 0~2000, 재련 0~25, 기운 0~100).
- **적용 중인 가정** 카드(패널 아래, 항상 펼침): 엔진이 돌려준 `assumptions[]`를 나열합니다. 각 줄에 "바꾸기" 링크 → 패널을 열고 해당 필드로 포커스.

---

## 3. 계산 엔진 설계 (`src/transfer/*`)

### 3.1 파일 구조

```
src/transfer/
  rules/
    meta.ts          RULES_VERSION, NOTICE_URL, NOTICE_DATE
    gear.ts          GEAR_TABLE (공지 표1)           [minExclusive, maxInclusive, tier, grade, polish, itemLevel]
    esther.ts        ESTHER_TABLE (공지 표2·3·4)       key `${evolution}_${ella}`
    slots.ts         ARMOR_PAIRS, WEAPON_LINKED, SLOT_LAYOUT (16부위 배치), API_TYPE_ALIAS {어깨: "견갑"}
    accessory.ts     ACCESSORY_VALID_OPTIONS (표6), ACCESSORY_SCROLL_RULES (표5), MIN_QUALITY = 67
    bracelet.ts      BRACELET_TIERS_DEALER (표7), BRACELET_TIERS_SUPPORT (표8), SCROLL_RANGE = [1, 21]
    stone.ts         DEALER_ENGRAVINGS, SUPPORT_ENGRAVINGS (22/11종), STONE_UPGRADE (표9), NODE_TO_POINT
    gem.ts           GEM_KIND_TIER {멸화:3, 홍염:3, 겁화:4, 작열:4, 광휘:4}, T3_LEVEL_DROP = 2, CHOICE_BOX (표10)
    classes.ts       SUPPORT_CAPABLE = ["바드","도화가","홀리나이트","발키리"]
  types.ts           입력·출력·근거 타입
  extract.ts         Armory → TransferInput (parseTooltip 재사용, 유일하게 API 모양을 아는 파일)
  gear.ts            mapGear, convertArmor, convertWeapon
  esther.ts          convertEsther
  accessory.ts       gradeAccessory
  bracelet.ts        analyzeBracelet
  stone.ts           convertStone
  gem.ts             convertGems
  payouts.ts         collectPayouts
  evidence.ts        weakest(), official(), estimated(), unknown() 도우미
  index.ts           computeTransfer(input, overrides): TransferResult
src/features/transfer/ (또는 src/TransferTab.tsx — 기존 평면 구조를 따르면 후자)
  TransferTab.tsx · TransferSummary · GearConversion · SlotLayout16 · EstherCard ·
  AccessoryScrolls · BraceletSeal · StoneSlots · GemConversion · Payouts · OverridesPanel · EvidenceBadge
```

- `rules/*`는 데이터만 담고 함수를 두지 않습니다. 각 표 위에 `/** 출처: 공지 13608 표1, 2026-11-25 */` 주석.
- `src/transfer/*`는 React, `fetch`, `localStorage`를 import하지 않습니다(ESLint `no-restricted-imports`로 막습니다).
- `extract.ts`만 `models.ts`와 `parse/tooltip.ts`를 import합니다. 나머지는 `TransferInput`만 압니다.

### 3.2 타입

```ts
// types.ts
export type EvidenceLevel = "official" | "estimated" | "unknown";
export type Evidence = {
  level: EvidenceLevel;
  source: string;          // "공지 표1", "공지 표9 · 스톤 Lv 해석 미검증"
  note?: string;           // 화면에 보일 한 줄 이유
};
/** 확정값, 범위, 계산 불가 중 하나. unknown이면 숫자를 갖지 않습니다. */
export type Est<T> =
  | { kind: "value"; value: T; evidence: Evidence }
  | { kind: "range"; min: T; max: T; evidence: Evidence }
  | { kind: "none"; label: string; evidence: Evidence };   // "계산 불가", "확인 필요"

export type Grade = "일반" | "고급" | "희귀" | "영웅" | "전설" | "유물" | "고대" | "에스더";
export type OldPart = "투구" | "견갑" | "상의" | "하의" | "장갑" | "무기";
export type NewSlot =
  | "무기" | "완갑" | "투구" | "견갑" | "상의" | "허리띠" | "하의" | "장갑"
  | "목걸이" | "귀걸이1" | "귀걸이2" | "반지1" | "반지2" | "팔찌" | "성물" | "인장";

// ---------- 입력 ----------
export type GearIn = {
  part: OldPart;
  name: string;
  grade: string;
  itemLevel: number | null;   // 툴팁 "아이템 레벨 N" (상급 재련 포함 값)
  honing: number | null;      // Name 앞 "+N"
  advanced: number | null;    // 상급 재련
  quality: number | null;
};
export type EstherIn = { evolution: number; ella: 0 | 1 | 2 | 3 | null; itemLevel: number | null };
export type AccessoryIn = {
  part: "목걸이" | "귀걸이" | "반지";
  index: number;               // 같은 부위 중 몇 번째(귀걸이1/2)
  grade: string; tier: number | null; quality: number | null;
  options: { text: string; rank: "상" | "중" | "하" | null }[];
  tradeCount: number | null;   // 툴팁에서 못 읽으면 null
};
export type BraceletIn = {
  grade: string; tier: number | null;
  options: { text: string; kind?: "locked" | "changeable" }[];
};
export type StoneIn = { engravings: { name: string; level: number | null; harmful: boolean }[] };
export type GemIn = { slot: number; kind: string | null; level: number; bound: boolean | null };
export type TransferInput = {
  className: string;
  profileAvg: number | null;           // ArmoryProfile.ItemAvgLevel
  gear: GearIn[];                       // 6부위 (빠진 부위 허용)
  esther: EstherIn | null;              // 장착 무기가 에스더일 때
  accessories: AccessoryIn[];
  bracelet: BraceletIn | null;
  stone: StoneIn | null;
  gems: GemIn[];
  karma: { name: "진화" | "깨달음" | "도약"; level: number | null }[];
};
export type TransferOverrides = {
  gearItemLevel?: Partial<Record<OldPart, number>>;
  storedEsther?: { evolution: number; ella: 0 | 1 | 2 | 3 };
  equippedElla?: 0 | 1 | 2 | 3;
  vambraceHoning?: number;
  artisanEnergy?: Partial<Record<OldPart, number>>;
  gemSource?: Record<number /*slot*/, { source: "normal" | "paid" | "paradise"; bound: boolean }>;
  stoneCut?: boolean;
};

// ---------- 출력 ----------
export type NewSlotResult = {
  slot: NewSlot;
  from: OldPart;
  tier: number; grade: Grade; polish: Est<number>; itemLevel: Est<number>;
  slotHoning?: Est<number>;            // 왼쪽 8칸만
  artisanEnergy?: Est<number>;         // 입력했을 때만 value
  isNew: boolean;                      // 허리띠·성물·인장
};
export type TransferResult = {
  rulesVersion: string;
  current: { profileAvg: number | null; equippedAvg: number | null };
  after: { avg16: Est<number> };
  slots: NewSlotResult[];              // 16개 (기준 장비가 없으면 Est none)
  esther: EstherResult | null;
  accessories: AccessoryResult[];
  bracelet: BraceletResult | null;
  stone: StoneResult | null;
  gems: GemResult[];
  payouts: PayoutRow[];
  assumptions: { id: string; text: string; field?: keyof TransferOverrides }[];
  counts: Record<EvidenceLevel, number>;
};
```
`EstherResult`, `AccessoryResult`(`{ part, index, outcome: "scroll"|"shard"|"remove", scrollGrade: Est<number> | null, reason, tradeCount: Est<number> }`), `BraceletResult`(`{ eligible: Est<boolean>, scrollGrade: Est<number> /*항상 none 또는 range 1~21*/, tiers: {role, option, tier}[] }`), `StoneResult`(`{ points: [number, number] | null, validPair: "dealer"|"support"|null, upgrade: Est<{slots, level, extra}> }`), `GemResult`(`{ slot, before, after: Est<{level, bound}> | "removed", choiceBox?: boolean }`), `PayoutRow`(`{ item, amount: Est<number>, basis, }`)는 같은 패턴으로 정의합니다.

### 3.3 부위별 규칙 함수

모두 순수 함수이고, 입력이 모자라면 예외 대신 `Est.none`을 돌려줍니다.

| 함수 | 규칙 | 근거 배지 |
|---|---|---|
| `mapGear(ilvl)` | `GEAR_TABLE`에서 `min < ilvl ≤ max` 행. `ilvl ≤ 50` 또는 `> 1800`이면 `none("공지 표 범위 밖")` | official / unknown |
| `convertArmor(g, ov)` | 기준 ilvl = `max(장착, ov.gearItemLevel[part])`. 결과를 같은 부위(슬롯 재련 = `g.honing`)와 짝 장신구 칸에 복사 | official. 툴팁에서 ilvl을 못 읽으면 none |
| `convertWeapon(w, esther, ov)` | 일반/에스더 중 기존 ilvl이 높은 쪽 기준. 일반이면 6칸 모두 `mapGear(ilvl)`. 슬롯 재련: 무기 = honing, 완갑 = `ov.vambraceHoning`(없으면 none "확인 필요"), 허리띠 = 0 | official, 완갑 재련만 unknown |
| `convertEsther(e, ov)` | `ESTHER_TABLE[evo_ella]`. ella가 null이면 (진화, 기존 ilvl)이 유일하게 맞는 행(estimated), 없으면 그 진화의 후보 행 전부로 range. 무기 칸 = 신규 ilvl·무기 슬롯 재련. 연동 5칸 = 기존 ilvl < 1800이면 `mapGear(기존 ilvl)`, ≥ 1800이면 `mapGear(1800)`을 estimated로 | official / estimated |
| `gradeAccessory(a, cls)` | §3.4 | official / estimated / unknown |
| `analyzeBracelet(b, cls)` | 대상 여부와 옵션 티어만. 등급은 `none("계산 불가")` | 대상·티어 official, 등급 unknown |
| `convertStone(s, cls, ov)` | 감소 각인 제외 2개의 포인트(0~4 그대로, 6~10은 `NODE_TO_POINT`). 유효 조합 검사(딜러 2개, 서포터 가능 클래스는 서포터 2개도). 합계·분포 → `STONE_UPGRADE` | 규칙 official이지만 Lv 해석 때문에 estimated |
| `convertGems(gems, ov)` | 티어 3: Lv ≤ 2 제거, Lv ≥ 3 → Lv-2 광휘. 티어 4: 같은 레벨 광휘. 8레벨 + 귀속 + 유료/낙원 → 선택 상자 | official (획득처 기본 가정은 assumptions에) |
| `collectPayouts(...)` | §2.3 ⑩ 표. 수량은 에스더 환급만 value | 항목별 |
| `average16(slots)` | 16칸 모두 value면 평균 value. range가 있으면 min/max 평균으로 range. none이 하나라도 있으면 none("일부 부위 계산 불가") | weakest() |

### 3.4 장신구 등급 판정 상세

1. 티어 ≤ 3 → `remove` (official).
2. 품질 < 67 → `shard` (official). 경계 67은 대상입니다.
3. 역할별로 판정합니다. 각 역할에서 부위의 1·2옵션 목록과 3옵션 목록(표6)에 맞는 옵션만 남깁니다. 옵션 이름 비교는 `text`에서 수치를 뺀 앞부분으로 하고, `%` 유무까지 맞춰야 합니다(예: `공격력 +0.95%`는 귀걸이 1·2옵션 `공격력 %`, `공격력 +80`은 3옵션 `공격력 +`).
4. 고대: 1·2옵션 유효 개수가 2개이면 표5대로(상상+3옵션 상 → 1, 상상+3옵션 중 → 2, 상상 → 3, 상중 → 4, 상하 → 5, 그 밖 → 6). 서포터 귀걸이는 별도 행(상상+최생 상 → 2, 상상+보호막/회복 상 → 3, 상상+중 → 4, 상상 → 5, 그 밖 → 6).
5. 1·2옵션 유효 개수가 1개이면 "6등급인지 파편인지" 공지에 없으므로 `range`가 아니라 `none("6등급 또는 영롱한 보석 파편 — 공지 미명시")`로 둡니다(unknown). 0개이면 shard (official).
6. 유물: 서포터 목걸이/반지 1·2옵션 상상만 5등급, 나머지 shard (official).
7. 두 역할 결과 중 더 좋은(숫자가 작은) 등급을 고릅니다. 고른 결과가 value이고 다른 역할의 결과가 unknown이어도 그 unknown의 가장 좋은 경우(6등급)보다 좋으면 그대로 official입니다. 딜러 클래스가 서포터 기준으로만 등급을 받는 경우는 공지에 제외 규칙이 없어 estimated로 표시합니다.
8. 상/중/하가 `null`인 옵션(툴팁에 `[상]` 표기나 `#FE9600` 색이 없음)이 결과를 바꿀 수 있으면 estimated로 낮추고 note에 "옵션 등급 판별 불확실"을 씁니다. 수치 기준표로 상/중/하를 판별하는 것은 이번 범위 밖입니다(값표가 공지에 없음).

### 3.5 extract.ts 규칙

| 값 | 출처 | 못 읽을 때 |
|---|---|---|
| 클래스 | `ArmoryProfile.CharacterClassName` | 딜러로 처리, 가정에 기록 |
| 6부위 | `ArmoryEquipment[]` `Type ∈ 무기·투구·어깨·상의·하의·장갑` (`어깨` → `견갑`) | 해당 부위 none |
| 아이템 레벨 | `parseTooltip().itemLevel` (쉼표 제거 후 Number) | none |
| 재련 | `Name.match(/^\+(\d+)\s/)` | none |
| 에스더 | `Grade === "에스더"` 무기. 진화 = 재련 숫자, 엘라 = 툴팁 문구 `엘라` 뒤 숫자(형식 미검증 → 못 찾으면 null) | ella null → 아이템 레벨로 추론, 실패 시 range |
| 완갑 | `Type === "완갑"`이 있으면 재련 숫자(노출 미검증) | 입력 또는 none |
| 장신구·팔찌 | `parseTooltip().options`, `quality`, `tier` | 옵션 없음 → 해당 판정 none |
| 스톤 | `parseTooltip().engravings` (감소 각인 `harmful`) | 2차로 `ArmoryEngraving.ArkPassiveEffects[].AbilityStoneLevel` |
| 보석 | `ArmoryGem.Gems[]` `gemKind(Name)`, `Level`, 툴팁 `귀속` 문구 | bound null |
| 카르마 | `ArkPassive.Points[].Description`의 `(\d+)레벨` | level null |

### 3.6 테스트 전략 (Vitest, `tests/transfer/*.test.ts`)

공지 예시와 표 행을 그대로 케이스로 씁니다. 테스트 이름에 공지 표 번호를 넣습니다.

1. **표 무결성** (`rules.test.ts`): `GEAR_TABLE` 구간이 50~1800을 빈틈·겹침 없이 덮음, 신규 ilvl 단조 증가. `ESTHER_TABLE` 20행. 유효 각인 22/11종, `각성`은 양쪽 모두. `STONE_UPGRADE` 7행.
2. **표1** (`gear.test.ts`): 공지 예시 `1725 초과 ~ 1730 이하 → 영웅 1연마 1730`(1726, 1730), 경계 `1770 → 전설 4연마 1770`, `1771 → 유물 2연마 1785`, `1790 → 고대 0연마 1800`, `1795 → 고대 2연마 1810`, `1800 → 고대 3연마 1815`, `1600 → 티어3 전설 1600`, `1601 → 티어4 고급 0연마 1675`, `50 → none`, `1801 → none`.
3. **부위 매핑**: 방어구 5개가 각각 왼쪽+오른쪽 칸 2개, 무기 6칸, 합계 16칸. 허리띠 슬롯 재련 0, 완갑 재련 입력 없음 → none, 입력 12 → 12.
4. **표2~4** (`esther.test.ts`): 공지 예시 `진화 5 → 엘라 1단계 1100, 기운 28, 키트 3,310`(하락 표시 플래그 true), `9_3 → 엘라 4 0연마 1840, 재련 25, 20/10,500`, `10_3 → 1865, 재련 25, 환급 없음`. 엘라 null + 진화 8 + ilvl 1715 → 엘라 2단계 1735·재련 18 estimated, 엘라 null + ilvl null인 진화 8 → range 1625~1735. 일반 1800 무기 + 에스더 10_3 → 무기 1865, 연동 5칸 1815 estimated (방송 계산 예시와 같음: 무기 차이 50).
5. **표5·6** (`accessory.test.ts`): 표5 12행을 모두 케이스로. 품질 66 → shard, 67 → 대상. 1옵션만 유효 → none. 딜러 클래스 + 서포터 옵션 목걸이 → estimated.
6. **표7·8** (`bracelet.test.ts`): 딜러 클래스 + 서포터 옵션만 있는 팔찌 → 대상 제외. 티어 3 → 제거. 효과 미부여 → 분해. 등급은 언제나 `none`(이 테스트가 "추측 값 금지"를 지킵니다).
7. **표9** (`stone.test.ts`): `2+2 → 1개 3단계`, `3+1 → 1개 5단계`, `4+1`·`3+2 → 2개 7단계`, `4+2 → 3개`, `3+3 → 4개`, `4+3 → 5개`, `4+4 → 5개 + 추가`. 노드 수 입력 `9/7 → 3+2`. 딜러 클래스 + 서포터 각인 조합 → 무효.
8. **표10** (`gem.test.ts`): 홍염 3 → 광휘 1, 멸화 10 → 광휘 8, 멸화 2 → 제거, 겁화 7 → 광휘 7, 광휘 8 귀속 + 유료 → 선택 상자, 광휘 8 + 일반 → 광휘 8.
9. **픽스처 통합** (`transfer-fixture.test.ts`): `fixtures/armory-sample.json` → `avg16 = 1788.75`, 배지 **official**(평균은 16칸의 아이템 레벨만 쓰므로 스톤 추정이나 완갑 재련 미확인과 무관), 슬롯 16개, 장신구 결과 `[4, 4, shard, 4, shard]`, 스톤 `2개 7단계 estimated`, 팔찌 등급 none, 보석 11개 모두 같은 레벨 광휘. `TransferResult` 스냅샷.
10. **요청 0회** (`app.test.tsx` 확장): MSW로 armory 1회 응답 후 `현재 → 이관 → 현재 → 이관` 탭 전환, 요청 수 1, 최근 검색 기록 1회.

---

## 4. 픽스처 캐릭터 계산 결과 (목업에 쓴 값)

`은하수바리케이드` · 홀리나이트(서포터 가능) · 프로필 평균 1,742.50 · 장착 6부위 평균 1,776.67

| 기존 | 기존 ilvl | 이관 장비(표1) | 왼쪽 칸 (슬롯 재련) | 오른쪽 칸 |
|---|---|---|---|---|
| 투구 +20 (상급 재련 20) | 1775 | 티어4 유물 2연마 1785 | 투구 1785 (+20) | 목걸이 1785 |
| 견갑 +20 | 1775 | 유물 2연마 1785 | 견갑 1785 (+20) | 귀걸이1 1785 |
| 상의 +20 | 1775 | 유물 2연마 1785 | 상의 1785 (+20) | 귀걸이2 1785 |
| 하의 +20 | 1775 | 유물 2연마 1785 | 하의 1785 (+20) | 반지1 1785 |
| 장갑 +19 | 1770 | 전설 4연마 1770 | 장갑 1770 (+19) | 반지2 1770 |
| 무기 +23 | 1790 | 고대 0연마 1800 | 무기 1800 (+23) · 완갑 1800 (확인 필요) · 허리띠 1800 (0) | 성물 1800 · 인장 1800 · 팔찌 1800 |

16부위 평균 = (1785×8 + 1770×2 + 1800×6) / 16 = 28,620 / 16 = **1,788.75** (공식 확정)

| 항목 | 결과 | 배지 |
|---|---|---|
| 목걸이 고대 품질 82, 상 추피 / 중 적주피 / 하 공+ | 딜러 상/중 → **4등급** | 확정 |
| 귀걸이 고대 품질 67, 상 무공% / 중 공% | 딜러 상/중 → **4등급** (서포터 기준은 1옵션만 유효) | 확정 |
| 귀걸이 유물 품질 45 | 영롱한 보석 파편 (수량 미확인) | 확정 |
| 반지 고대 품질 93, 상 치적 / 중 치피 | 딜러 상/중 → **4등급** | 확정 |
| 반지 고대 품질 58 | 영롱한 보석 파편 (수량 미확인) | 확정 |
| 팔찌 고대 (타대 상, 치명 중, 특화 중) | 인장 주문서 1~21등급 중 **계산 불가** · 딜러 기준 2티어 / 2티어+ / 2티어+, 서포터 기준 특화 2티어 | 등급 미확인, 티어 확정 |
| 스톤 원한 3 + 아드레날린 2 | 합계 5 → **각인 슬롯 2개 7단계** | 추정 (Lv 해석) |
| 보석 겁화 10·10·9·9·8, 작열 10·9·9·8·8·7 | 같은 레벨 광휘 11개 | 확정 (8레벨 3개는 일반 획득 가정) |
| 카르마 | 진화 25레벨(22 이상 대상 추정), 깨달음 19, 도약 20 | 추정, 수량 미확인 |

※ 픽스처는 가상 데이터라 프로필 평균(1,742.50)과 장착 장비 평균(1,776.67)이 다릅니다. 화면은 이 차이를 §2.3 ②의 안내 문구로 보여 줍니다.

---

## 5. 계산 불가·미확인으로 남긴 항목

| 항목 | 화면 처리 | 풀리는 조건 |
|---|---|---|
| 팔찌 → 인장 주문서 1~21등급 산식 | "1~21등급 중 계산 불가" + 옵션 티어만 | 공지·업데이트 노트에 배점표 공개 |
| 장신구 1·2옵션 중 1줄만 유효할 때 6등급/파편 경계 | "6등급 또는 파편" 미확인 | 공지 보완 |
| 영롱한 보석 파편, 초월의 가루, 장신구 슬롯 성장 재료, 팔찌 분해 결과물 수량 | "수량 미확인" | 수량표 공개 |
| 품질·카르마·팔찌 재변환권 등 → 2부 성장 재료 교환용 토큰 수량 | "수량 미확인" | 환산표 공개 |
| 스톤 합계 8 추가 지급 아이템 종류 | "추가 아이템(종류 미확인)" | 공지 보완 |
| 에스더 1800+ 보유 시 연동 5부위 기준 레벨 | 1815로 계산하되 추정 | 공지 보완 |
| 에스더 표 `7단계/엘라 3단계 = 1785` 표기 | 표 그대로 사용, 툴팁에 "공지 원문 수치" 주석 | 공지 정정 여부 |
| 일반 장비 ilvl ≤ 50, > 1800 | 해당 부위 계산 불가 | 공지 보완 |
| 상급 재련 제거 보상 여부 | 환급 목록에 "보상 언급 없음" | 업데이트 노트 |
| (API 검증) 완갑 노출, 에스더 엘라 툴팁 형식, 장신구 거래 횟수 문구, 스톤 `Lv.N` 의미, 카르마 `Description` 레벨 의미, 보석 귀속 문구 | 각각 none/range/estimated + 입력 패널 | 실키 1회 조회로 확인 후 `extract.ts`와 이 표 갱신 |

---

## 6. 시각 디자인

- 토큰: `--ok`/`--warn`/`--text-3`/`--accent-soft`/등급 색 그대로. 새 토큰 없음.
- 새 클래스(전부 `app.css`에 추가):
  - `.view-tabs` (탭 바), `.new-pill`
  - `.ev` + `.ev-official` / `.ev-estimated` / `.ev-unknown` (근거 배지, 11px/700, 반경 6px, `.pill` 기반)
  - `.conv-row` (장비 변환 행: `minmax(200px,1fr) 24px 2fr auto` 그리드 → 모바일에서 1열)
  - `.slot16` (16부위 배치도: 2열, 각 열 8칸)
  - `.scroll-row` (장신구·팔찌 결과 행), `.engr-slots` (원 5개), `.gem-conv` (보석 칸 위아래 2단)
  - `.big-arrow` (요약 화살표), `.delta.up` / `.delta.down`
- 다크/라이트: 모든 색을 토큰으로만 씁니다. 배지 배경은 `color-mix(in srgb, var(--ok) 14%, transparent)` 패턴(기존 `.notice.ok`와 같음).
- 모바일 390px: 요약 숫자 22px → 20px, 장비 변환 행 세로 쌓기, 16부위 아이콘 36px, 보석 격자 `minmax(52px,1fr)`, 입력 패널 필드 1열. 가로 스크롤 0.
- 접근성: 배지는 글자, 화살표는 `aria-hidden` + 행에 `aria-label="투구 1775에서 유물 2연마 1785로"`. 입력 필드마다 `<label>`, 오류는 `aria-describedby`. 요약의 범위 값은 "최소 ~ 최대" 글자로 읽힘.

---

## 7. 구현 단계 (Codex 작업 단위)

각 단계는 따로 리뷰할 수 있는 크기입니다. ✅는 완료 기준입니다. 1~4는 UI 없이 끝납니다.

1. **규칙 표 이식** `src/transfer/rules/*`: 공지 표1~10과 각인 목록, 클래스 목록, `meta.ts`. ✅ `rules.test.ts` 통과(구간 무결성, 행 수, 표 출처 주석).
2. **타입과 근거 도우미** `types.ts`, `evidence.ts`. ✅ `weakest()` 단위 테스트, `Est` none에 숫자가 없는 것을 타입으로 강제.
3. **규칙 함수** `gear.ts`, `esther.ts`, `accessory.ts`, `bracelet.ts`, `stone.ts`, `gem.ts`, `payouts.ts`, `index.ts`. ✅ §3.6의 2~8번 테스트 통과. 팔찌 등급이 어떤 입력에서도 숫자가 아님.
4. **추출** `extract.ts`: armory → `TransferInput`. ✅ 픽스처 통합 테스트(§3.6-9)에서 평균 1788.75, 결과 스냅샷 고정. 필드가 없는 armory(빈 장비, null 툴팁)에서 예외 없이 none.
5. **라우팅과 탭 바**: `main.tsx` 정규식, `characterUrl(name, tab)`, `Character`에 `tab` prop, `.view-tabs`, 드로어 선택 시 탭 유지, 최근 검색 재기록 방지. ✅ §3.6-10 테스트(요청 1회, 기록 1회), 뒤로 가기로 탭 복귀, 알 수 없는 하위 경로 replace.
6. **공용 조각** `EvidenceBadge`, `EstValue`(value/range/none 렌더러), 면책 배너, 푸터 문구. ✅ none일 때 숫자를 렌더링하지 않는 단위 테스트.
7. **요약 카드와 장비 변환·16부위** `TransferSummary`, `GearConversion`, `SlotLayout16`. ✅ 픽스처로 목업 ②·③·④와 같은 값.
8. **에스더·장신구·팔찌·스톤·보석 카드**. ✅ 픽스처로 목업과 같은 결과, 에스더 없는 경우 접힌 한 줄, 데모 에스더 입력 시 범위/값 전환.
9. **추가 정보 입력 패널과 가정 목록** `OverridesPanel`: 저장·검증·모두 지우기, 가정 "바꾸기" 포커스 이동. ✅ 입력 → 결과 즉시 반영, 새로고침 후 유지, 네트워크 요청 0회.
10. **환급·지급 목록과 계산 범위 밖**. ✅ 수량 미확인 항목에 숫자 없음.
11. **반응형·테마·접근성 점검**: 390/768/1280px, 다크/라이트, 키보드만으로 탭 전환과 패널 조작. ✅ 390px 가로 스크롤 없음, 스냅샷/스크린샷이 목업과 같은 구성.
12. **(실키 확인 후)** §5의 API 검증 항목을 실제 응답 1건으로 확인하고 `extract.ts`·배지·이 문서를 갱신. 실키와 실응답은 커밋하지 않습니다.
13. **(2부 적용 후)** 이관 탭 제거 또는 "이관 완료" 안내로 교체. 규칙 모듈은 삭제.

---

## 8. 목업 사용법

- `docs/mockup-transfer/index.html`을 브라우저로 엽니다. 외부 호출이 없습니다.
- 목업 전용 점선 바에서 `현재` / `이관` 탭, 테마, "에스더 무기 예시 입력"(입력 패널 동작 확인용)을 바꿉니다.
- URL 옵션: `?theme=light|dark`, `#current`, `#transfer`(기본), `#esther`(장착 무기를 에스더 진화 8·아이템 레벨 1715·엘라 미확인으로 바꾼 예시. 엘라 단계를 아이템 레벨로 추론해 `추정`으로 표시).
- 목업 안의 `RULES`·`compute()`는 §3의 엔진을 축약한 JS입니다. 숫자는 손으로 쓰지 않고 이 계산으로 그렸습니다. 구현은 이 코드를 옮기지 말고 §3 구조로 새로 작성합니다.
- 스크린샷: `transfer-desktop-light.png`, `transfer-desktop-dark.png`, `transfer-mobile-390.png`(라이트), `transfer-mobile-390-dark.png`.
