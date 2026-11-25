# 아크 패시브 트리 시각화 조사 보고서

- **조사 일시**: 2026-11-25 (로스트아크 KR 2026-11-18 패치 및 Open API V10.0.0 기준)
- **목적**: Ark Lens의 현행 텍스트 목록(`1티어 치명 Lv.30` 등)을 게임 화면과 유사한 **진화 / 깨달음 / 도약 탭 + 티어별 노드 격자 트리**로 개선하기 위한 API 응답 분석, 전체 트리 정적 데이터 확보 가능성, 아이콘 검증, 화면·스키마·파싱 설계 제안.
- **제약 준수**: 앱 코드 변경·커밋·푸시·PR 없음, API 키가 필요한 실제 Lost Ark Open API 호출 없음.
- **데이터 보관**: 인벤 아크 패시브 DB에서 정리한 `evolution.json`, `enlightenment.json`, `leap.json`과 그 아이콘 키로 만든 `icon-verification.json`은 **저장소에 포함하지 않습니다**(로컬 보관, `.gitignore`로 제외). 아래 수치와 규칙은 그 데이터를 조사한 결과 요약입니다.
- **인용 출처**: 1장의 응답 원문 인용은 [`artbiit/lostark-api-service`](https://github.com/artbiit/lostark-api-service) (ISC 형식 [LICENSE](https://github.com/artbiit/lostark-api-service/blob/main/LICENSE))의 V9.0.0 공개 샘플에서 짧게 발췌했습니다.

---

## 요약 (Executive Summary)

1. **API 응답 한계**: `GET /armories/characters/{characterName}/arkpassive`는 **찍은(Lv.1 이상) 노드만** `Effects[]`에 반환한다(브레이커 기준 전체 52노드 중 14노드만 반환). 안 찍은 노드까지 포함한 트리 전체를 그리려면 **정적 트리 메타데이터**가 필수다.
2. **전체 트리 정적 데이터 확보 결과 (30개 전 직업 100%)**:
   - **진화**: 전 직업 공통 **5티어 × 6열 = 30노드** (`evolution.json`)
   - **깨달음**: **30개 전 직업 × 12노드(4행 × 4열) = 360노드** (`enlightenment.json`)
   - **도약**: **1티어 전 직업 공통 6노드 + 2티어 30개 전 직업 124노드**(28직업 각 4노드, 데빌헌터·건슬링어 3스탠스 각 6노드) = 총 304노드 인스턴스 / 고유 130노드 (`leap.json`)
3. **공식 CDN 아이콘 검증 결과**: 전체 고유 아이콘 **451개 중 451개(100%)가 스마일게이트 공식 CDN(`cdn-lostark.game.onstove.com`)에서 HTTP 200 OK** 확인 완료 (`icon-verification.json`). 단, `dr_skill_01_24`(환수사 `환수 각성`) 1건만 폴더명 예외(`dr_skill/`) 존재.
4. **추천안**: 30개 전 직업 트리 구조와 공식 CDN 아이콘이 100% 확보·검증되었으므로 **완전안(전체 트리 + 안 찍은 노드 흐리게)** 을 추천하되, 신규 직업·패치 드리프트로 미매칭 노드가 생기면 **최소안(찍은 노드 아이콘 격자)** 으로 안전 폴백하는 **하이브리드 구조**로 구현하는 것이 최선이다.

---

## 1. Open API로 알 수 있는 것 (`ArkPassive`)

공식 Swagger 스키마([swagger-arkpassive-schema.json](./samples/swagger-arkpassive-schema.json), V10.0.0 기준 V8.0.0 이후 `ArkPassive` 변경 없음)와 공개 실측 응답([artbiit 원본 샘플](https://github.com/artbiit/lostark-api-service/blob/main/docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/characters.json), 2025-01-15 브레이커 캐릭터, 가상 샘플: [synthetic-arkpassive.json](./samples/synthetic-arkpassive.json)) 분석 결과다.

### 1.1 최상위 구조 및 비활성 상태

```json
{
  "Title": "수라의 길",
  "IsArkPassive": true,
  "Points": [ ... ],
  "Effects": [ ... ]
}
```

- `Title`: 활성화된 **깨달음 1티어 직업 각인명**(예: `"수라의 길"`). 깨달음 1T 미투자 시 빈 문자열 또는 null 가능.
- `IsArkPassive`: 아크 패시브 활성화 여부(`boolean`).
- **미개방/비활성 응답**: `artbiit/lostark-api-service`의 `character-no-ark-passive.json` 실측 결과, 통합 armory 응답에서 `"ArkPassive": null`이 내려온다. `Points`/`Effects` 배열 자체도 `null`일 수 있다.

### 1.2 `Points[]` 구조 — `Value`는 "총 보유 포인트", `Description`은 "카르마"

실측 원문 ([artbiit 원본 샘플](https://github.com/artbiit/lostark-api-service/blob/main/docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/characters.json)에서 발췌):

```json
{
  "Name": "깨달음",
  "Value": 101,
  "Tooltip": "<img src='emoticon_ark_realization' width='25' height='28' vspace='-8'></img><FONT COLOR='#a2ccf6'> 깨달음 아크 패시브 포인트</font><br><textformat indent='-21' leftMargin='10'><font> </font><img src='emoticon_expedition_dot_Blue' width='0' height='0' vspace='-3'></img> 캐릭터 전투 레벨 상승 및 장착한 악세서리 아이템을 통해 깨달음 아크 패시브 포인트를 상승 시킬 수 있습니다.",
  "Description": "6랭크 30레벨"
}
```

- **`Value`의 의미 검증**: 브레이커 샘플에서 깨달음 `Effects[]`의 실제 투자 포인트 합계는 `24(수라의 길 Lv.1) + 24(치명적인 주먹 Lv.3) + 24(수라강체 Lv.3) + 4(전면전 Lv.2) + 24(무아지경 Lv.3) = 100`이지만, `Points[깨달음].Value`는 **`101`** 이다. 즉 `Value`는 **캐릭터가 보유한 총 가용 포인트**이며, 투자 포인트(`spent`)는 찍은 노드들의 `level * cost` 합계로 계산해야 한다(남은 포인트 = `Value - spent`).
- **`Description`** (V8.0.0 추가): 카르마 성장 수치(`"6랭크 30레벨"`). 정규식 `/(\d+)\s*랭크\s*(\d+)\s*레벨/`로 파싱 가능.
- **색상 코드**: 진화 `#ffd200` / `#F1D594`, 깨달음 `#a2ccf6` / `#83E9FF`, 도약 `#d4ff88` / `#C2EA55`.

### 1.3 `Effects[]` 구조 — 찍은 노드만 반환

실측 원문 발췌 ([artbiit 원본 샘플](https://github.com/artbiit/lostark-api-service/blob/main/docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/characters.json)):

```json
{
  "Name": "진화",
  "Description": "<FONT color='#F1D594'>진화</FONT> 1티어 <FONT color='#F1D594'>치명 Lv.30</FONT>",
  "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/ark_passive_evolution/ark_passive_evolution_1.png",
  "ToolTip": "{\"Element_000\":{\"type\":\"NameTagBox\",\"value\":\"치명\"},\"Element_001\":{\"type\":\"CommonSkillTitle\",\"value\":{\"leftText\":\"아크 패시브 레벨 <FONT COLOR='#FFD200'>30</FONT>\",\"level\":\"\",\"name\":\"<FONT SIZE='13' COLOR='#FFFFAC'>진화</FONT>\",\"slotData\":{\"iconGrade\":0,\"iconPath\":\"https://cdn-lostark.game.onstove.com/efui_iconatlas/ark_passive_evolution/ark_passive_evolution_1.png\",\"imagePath\":\"\"}}},\"Element_002\":{\"type\":\"MultiTextBox\",\"value\":\"치명이 <FONT COLOR='#99ff99'>1500</FONT>증가합니다.||<BR>\"}}"
}
```

다른 카테고리 원문 예시:
- 깨달음: `"<FONT color='#83E9FF'>깨달음</FONT> 1티어 <FONT color='#83E9FF'>수라의 길 Lv.1</FONT>"` / `Icon`: `.../efui_iconatlas/ark_passive_ifm/ark_passive_ifm_4.png`
- 도약: `"<FONT color='#C2EA55'>도약</FONT> 2티어 <FONT color='#C2EA55'>사방 타격 Lv.3</FONT>"` / `Icon`: `.../efui_iconatlas/ark_passive_ifm/ark_passive_ifm_14.png`

핵심 확인 사항:
1. **찍은 노드만 온다**: 브레이커는 전체 52개 노드(진화 30 + 깨달음 12 + 도약 10)를 가지나, API `Effects[]`에는 Lv.1 이상 투자한 **14개만** 반환된다(깨달음 5, 진화 6, 도약 3). 배열 순서는 `깨달음 → 진화 → 도약` 순으로 오며 반드시 `진화 → 깨달음 → 도약` 순이 아니다.
2. **`Description` 형식**: HTML 태그 제거 시 `"{카테고리} {N}티어 {노드명} Lv.{M}"` 형식이다. 단, Ark Lens 내부 합성 픽스처(`fixtures/armory-sample.json`)에는 카테고리 접두어 없이 `"1티어 치명 Lv.30"`으로 들어 있으므로 파서는 선택적 접두어 `(?:(?:진화|깨달음|도약)\s+)?`를 허용해야 한다.
3. **`ToolTip` 3단 고정 구조** (14개 전수 확인):
   - `Element_000` (`NameTagBox`): `value`에 **정규화된 순수 노드명**이 그대로 들어 있다(예: `"수라의 길"`, `"권왕십이식 : 낙화 강화"`). 정규식 파싱보다 안전하므로 1순위 노드명 소스로 활용 가능.
   - `Element_001` (`CommonSkillTitle`): `leftText` = `"아크 패시브 레벨 <FONT COLOR='#FFD200'>{level}</FONT>"`, `name` = 카테고리명, `slotData.iconPath` = 공식 CDN URL.
   - `Element_002` (`MultiTextBox`): 현재 레벨의 효과 설명 HTML. **항상 끝에 `||<BR>` 구분자가 붙어 온다.**
   - **Ark Lens 기존 파서 주의점**: 현행 `src/parse/tooltip.ts`의 `tooltipLines()`는 `Element_001.value`를 재귀 순회하여 `slotData.iconPath` URL 문자열까지 텍스트 줄에 섞어 넣고, `Element_002` 끝의 `||`를 제거하지 않는다. 전용 아크 패시브 툴팁 파서로 분리해야 한다.
4. **패치에 따른 티어 이동 실증**: 2025-01-15 샘플에서 `뭉툭한 가시`는 `4티어`였으나, 엘릭서 통합 패치 이후 현행(2026-11) 게임에서는 `5티어`다. 따라서 API 응답과 정적 트리를 매칭할 때는 **`(category, nodeName)`을 기본 키**로 쓰고 `tier`는 보조 검증/폴백 정렬 용도로만 사용해야 과거 스냅샷과 향후 패치 모두에 견고하다.

---

## 2. 트리 전체 정적 데이터 조사 및 확보 현황

### 2.1 공개 소스 비교 및 선정

| 소스 | 커버리지 | 아이콘 키 / URL | 최신성 (2026-11 기준) | 라이선스 / 이용 주의 |
| --- | --- | --- | --- | --- |
| **로스트아크 인벤 아크 패시브 DB** (`lostark.inven.co.kr/dataninfo/arkpassive/?code={jobCode}`) | 진화 5T(30) + 깨달음 30직업(360) + 도약 30직업(6+124) **전수** + `row/col`, `max_level`, `point`, 선행/배타 조건 | 내부 게임 아이콘 키(`ark_passive_*`) 포함 (페이지 렌더링은 `static.inven.co.kr` 미러 사용) | **최신** (2026-07 차원술사, 2026-11-18 뭉툭한 가시 9.5%/19% 개편 반영 확인) | `robots.txt`는 `User-agent: *` 허용(`Wget`만 차단). 단, 인벤 DB 페이지의 HTML 서술 텍스트(`desc`)와 `static.inven.co.kr` 이미지 미러는 인벤 자산이므로 **앱에 `desc` 문장 복제 및 인벤 이미지 핫링크 금지**. 순수 게임 구조 메타데이터(이름·좌표·레벨·비용·조건)만 추출하고 아이콘은 **스마일게이트 공식 CDN**을 직접 사용. |
| `LostSheet/Evolution-Caculator` (GitHub) | 진화 표 + 인벤 DB에서 빌드한 30직업 깨달음/도약 구조(`arkpassive-tree.js`) | 아이콘 없음(SVG 심볼 대체) | 2026-09-29 기준 | GitHub **라이선스 미표기(All Rights Reserved)** → 코드·파일 복제 금지, 구조 교차검증 참고만. |
| `Noisywhitecat-dev/loa-engraving-optimizer` (GitHub) | 진화 1~5T 계산 모델 | 아이콘 없음 | 2026-11-20 (11-18 패치 반영) | **라이선스 미표기** → 패치 수치 교차검증 참고만. |
| 나무위키 / Maxroll / Lost Ark Codex | 진화·직업별 텍스트 정리 | 비정형(HTML/영문 위주) | 패치 지연 편차 큼 | 나무위키 CC BY-NC-SA 2.0 KR (상업적 이용 제한/동일조건 변경허락 주의). |
| **스마일게이트 공식 CDN** (`cdn-lostark.game.onstove.com/efui_iconatlas/...`) | Open API `Effects[].Icon`과 동일한 공식 아이콘 PNG | **451/451 (100%) HTTP 200 확인** | 게임 클라이언트와 실시간 동일 | 로스트아크 게임 자산 저작권은 Smilegate RPG 귀속. Open API 이용약관(비영리/팬사이트 가이드라인, 출처 표기, 과도한 크롤링 금지) 준수 필요. 브라우저 `<img src="https://cdn-lostark.game.onstove.com/...">` 직접 참조는 기존 장비·보석·스킬 아이콘과 동일 패턴. |

### 2.2 카테고리별 확보 현황 (`research/arkpassive/*.json`)

| 카테고리 | 파일 | 직업 수 | 노드 수 | 격자 크기 | 비고 |
| --- | --- | ---: | ---: | --- | --- |
| **진화** | `evolution.json` (저장소에 없음) | 전 직업 공통 (30/30 동일 검증) | **30** | `5행 × 6열` | 1T~5T 각 6노드, 총 상한 140P |
| **깨달음** | `enlightenment.json` (저장소에 없음) | **30 / 30** | **360** (직업당 12) | `4행 × 4열` | 30개 전 직업 슬롯 좌표 100% 동일 |
| **도약** | `leap.json` (저장소에 없음) | **30 / 30** | **공통 1T 6 + 직업별 2T 124** (고유 130 / 인스턴스 304) | `2행 × 6열` (2T는 28직업 4열, 2직업 6열) | 데빌헌터·건슬링어만 2T 6노드(3스탠스) |

**포함된 30개 전체 클래스 (2026-11 기준)**:
- 전사(6): 버서커(102), 디스트로이어(103), 워로드(104), 홀리나이트(105), 슬레이어(112), 발키리(113)
- 마법사(4): 아르카나(202), 서머너(203), 바드(204), 소서리스(205)
- 무도가(6): 배틀마스터(302), 인파이터(303), 기공사(304), 창술사(305), 스트라이커(312), 브레이커(313)
- 암살자(4): 블레이드(402), 데모닉(403), 리퍼(404), 소울이터(405)
- 헌터(5): 호크아이(502), 데빌헌터(503), 블래스터(504), 스카우터(505), 건슬링어(512)
- 스페셜리스트(4): 도화가(602), 기상술사(603), 환수사(604), 차원술사(612)
- 가디언나이트(1): 가디언나이트(702)

### 2.3 공식 CDN 아이콘 전수 검증 결과 (`icon-verification.json`, 저장소에 없음)

- **검증 대상**: 30개 전 직업의 진화·깨달음·도약 노드에서 추출한 고유 아이콘 키 **451개** (진화 30 + 깨달음 293 + 도약 130, 이 중 `ark_passive_01_10`·`ark_passive_01_54` 2개는 깨달음·도약 공용).
- **URL 매핑 규칙**:
  - 기본 규칙 (450/451): `https://cdn-lostark.game.onstove.com/efui_iconatlas/{trailing _숫자 제거 폴더}/{iconKey}.png`
    - 예: `ark_passive_evolution_1` → `efui_iconatlas/ark_passive_evolution/ark_passive_evolution_1.png`
    - 예: `buff_601` (스카우터 `전술 재장전`) → `efui_iconatlas/buff/buff_601.png`
  - **유일한 예외 (1/451)**: `dr_skill_01_24` (환수사 깨달음 1T `환수 각성`) → 기본 규칙(`dr_skill_01/`)은 HTTP 404이며, 실제 공식 CDN 경로는 `https://cdn-lostark.game.onstove.com/efui_iconatlas/dr_skill/dr_skill_01_24.png` (**HTTP 200 OK**).
- **최종 결과**: **451 / 451 (100.0%) HTTP 200 OK**, 실패 0건 (`image/png`). 또한 artbiit 원본 샘플에 실린 브레이커 14개 실제 API `Icon` URL과 100% 문자 단위 일치 검증 완료.

---

## 3. 게임 화면 배치 규칙 및 오너 스크린샷 요청 목록

### 3.1 진화 (Evolution) — `5행 × 6열`, 총 상한 140P

| 티어(행) | 티어 포인트 상한 | 이전 티어 개방 조건 | 레벨당 비용 | 최대 레벨 | 배치 노드 (`col 1 → 6`) |
| --- | ---: | --- | ---: | ---: | --- |
| **1T** | 40 | 없음 | 1 | 30 | 치명 · 특화 · 제압 · 신속 · 인내 · 숙련 |
| **2T** | 30 | 1T **40P** 사용 | 10 | 2~3 | 끝없는 마나(2) · 금단의 주문(2) · 예리한 감각(2) · 한계 돌파(3) · 최적화 훈련(2) · 축복의 여신(3) |
| **3T** | 20 | 2T **20P** 사용 | 10 | 2 | 무한한 마력 · 혼신의 강타 · 일격 · 파괴 전차 · 타이밍 지배 · 정열의 춤사위* |
| **4T** | 20 | 3T **20P** 사용 | 10 | 1 | 회심 · 달인 · 분쇄 · 선각자 · 진군 · 기원 *(최대 2종 선택)* |
| **5T** | 30 | 4T **20P** 사용 | 15 | 2 | 뭉툭한 가시 · 음속 돌파 · 인파이팅 · 입식 타격가 · 마나 용광로 · 안정된 관리자 |

- \*유일한 노드 간 선행 연결: **3T col 6 `정열의 춤사위`** 는 **2T col 6 `축복의 여신` Lv.3** 습득 필요.
- 특징: 2T는 상한이 30P이지만 3T 개방은 20P만 쓰면 된다(나머지 10P는 2T에 추가 투자).

### 3.2 깨달음 (Enlightenment) — `4행 × 4열`, 통상 최대 보유 101P (투자 최대 100P)

전 30개 직업이 아래 **12슬롯 대칭 격자**를 100% 동일하게 따른다 (`col 1~4`):

```text
          col 1 (좌 사이드)   col 2 (좌 메인)     col 3 (우 메인)     col 4 (우 사이드)
1티어           —            [직업각인 A]  ✕    [직업각인 B]              —
                                  │                   │
2티어 (1T 24P)  —            [A-2 메인]          [B-2 메인]               —
                                  │                   │
3티어 (2T 24P) [사이드 3L]    [A-3 메인]          [B-3 메인]         [사이드 3R]
                                  │                   │
4티어 (3T 24P) [사이드 4L]    [A-4 메인]          [B-4 메인]         [사이드 4R]
```

- **메인 노드(`col 2`, `col 3`)**: 모든 30개 직업에서 예외 없이 수직 선행 연결(`Anomalous edges: 0`).
  - 1T는 상호 배타(택1). 풀레벨 비용은 항상 **24P**(`max1×24P` 25건, `max3×8P` 35건).
  - 2T도 풀레벨 비용은 항상 **24P**(`max1×24P` 6건, `max2×12P` 3건, `max3×8P` 51건).
  - 3T·4T 메인은 60건 전부 `max3×8P` = **24P**.
- **사이드 노드(`col 1`, `col 4`)**: 30개 전 직업 120건 전부 `max5×2P` (최대 10P), 선행 노드 없음(티어 포인트 24P만 충족하면 양쪽 사이드 모두 투자 가능).
  - **예외 상호 배타 2건**: 스트라이커 `완전 충전`(4T c4) ↔ `오의 집중`(4T c2), 블래스터 `오버히트`(4T c4) ↔ `포격 출력 강화`(4T c2).

### 3.3 도약 (Leap) — `2행 × 6열` (또는 2T 4열), 총 상한 70P

- **1티어 (전 직업 공통 6열)**: `초월적인 힘`(5/4P), `충전된 분노`(5/4P), `각성 증폭기`(3/2P), `풀려난 힘`(5/4P), `잠재력 해방`(5/4P), `즉각적인 주문`(3/2P). 총 40P 투자 시 2티어 개방.
- **2티어 (직업 전용, 1T 40P 필요, 2T 내 전원 상호 배타 택1, `max3×10P = 30P`)**:
  - 28개 직업: **4노드** (`col 1~4`, 초각성 스킬 2종 × 각 2변형)
  - **데빌헌터 · 건슬링어**: **6노드** (`col 1~6`, 3스탠스 초각성 스킬 3종 × 각 2변형)

### 3.4 오너에게 요청할 게임 스크린샷 목록 (시각 디테일 확정용)

정적 데이터(좌표·이름·비용·아이콘)는 이미 확보했으나, **인게임 시각 문법(테두리·연결선·배경·숫자 배지·2T 4열 정렬)** 을 게임과 최대한 닮게 맞추기 위해 아래 6장(최소 3장)을 받으면 정확도가 크게 올라간다.

| 우선순위 | 요청 화면 | 확인하려는 시각 요소 |
| :---: | --- | --- |
| **필수 1** | **진화 탭 전체 화면** (1T~5T 전부 보이게, 카르마 포함) | 티어 라벨(`1티어` + `40/40`), 노드 프레임 모양(원형/육각/사각), 찍은 노드 vs 안 찍은 노드 대비, `축복의 여신 → 정열의 춤사위` 연결선 스타일 |
| **필수 2** | **깨달음 탭 전체 화면** (임의 1개 직업, 1T~4T) | `4×4` 중앙 2열(메인)과 좌우 사이드 열의 간격·선 연결 여부, 선택되지 않은 반대편 직업 각인 갈래의 흐림/잠금 표현, 상단 포인트 + 카르마 표시 위치 |
| **필수 3** | **도약 탭 전체 화면** (일반 4노드 직업 1개) | 1T 6열 아래에 2T 4열이 **가운데 정렬**되는지 좌측 정렬되는지, 초각성 스킬별 그룹 구분선 유무 |
| 선택 4 | **도약 탭 — 데빌헌터 또는 건슬링어** (6노드 직업) | 2T가 6열일 때 1T와 열 폭/정렬이 정확히 1:1로 맞는지 |
| 선택 5 | **노드 호버 툴팁 1장** (찍은 노드 vs 안 찍은 노드) | 레벨 표시(`Lv.2/2`), 효과 본문 색상 강조 규칙 |
| 선택 6 | **아크 패시브 포인트 미충족/잠긴 티어 화면** (배럭/저레벨) | 잠금 아이콘·오버레이 처리 방식 (미개방 캐릭터 UI 참고) |

---

## 4. Ark Lens 화면 제안 (완전안 vs 최소안 비교 및 추천)

### 4.1 완전안(전체 트리) 화면 구성

기존 `PassiveCard`의 텍스트 목록을 아래 구조로 교체한다.

- **카드 헤더**: 타이틀 `아크 패시브` + 활성 직업 각인 배지(`data.Title`, 예: `수라의 길`) + 상단 **3탭 스위처(`진화` · `깨달음` · `도약`)**.
  - 각 탭 버튼에 포인트 요약 표시: 예) `진화 140/140` (`투자/보유`), 보조 텍스트로 카르마 `6랭크 30레벨`.
  - 탭 전환 시에도 3개 탭 포인트를 한눈에 보도록 탭 바 자체에 숫자를 유지.
- **트리 캔버스 (탭 내부)**:
  - **행 = 티어**: 좌측(데스크톱) 또는 행 헤더(모바일)에 `1T` + 해당 티어 투자 포인트(`40/40`, 깨달음/도약은 `24P` 등).
  - **노드 셀**:
    - **찍은 노드 (`level > 0`)**: 공식 CDN 아이콘 풀컬러, 카테고리 강조 테두리(진화 금 `#F1D594` / 깨달음 청 `#83E9FF` / 도약 녹 `#C2EA55`), 하단 레벨 배지 `n/max`(만렙이면 강조), 노드명 1~2줄 말줄임.
    - **안 찍은 노드 (`level === 0`)**: `opacity: 0.32; filter: grayscale(0.85)`, 중립 테두리, 배지 `0/max`(또는 호버 시 표시).
    - **연결선**: 깨달음 `col 2`·`col 3` 수직선(찍은 경로는 카테고리 컬러, 미투자 경로는 옅은 회색), 진화 `축복의 여신 → 정열의 춤사위` 수직선 1개.
  - **도약 2T 정렬**: 4노드 직업은 6열 그리드 중앙 정렬(`grid-column: 2 / span 4` 또는 flex center), 6노드 직업(데빌헌터·건슬링어)은 6열 풀폭.
  - **툴팁 (호버/탭)**:
    - 찍은 노드: API `Effect.ToolTip` 원문 파싱 결과(정확한 현재 패치 수치 + `||` 제거) 표시.
    - 안 찍은 노드: 정적 메타데이터 요약(노드명, 티어, `0 / maxLevel`, `레벨당 N포인트`, 선행/배타 조건)만 표시 *(저작권 보호 및 패치 드리프트 방지를 위해 인벤 서술 문장은 싣지 않음)*.
- **모바일(390px) 대응**:
  - 진화(6열)와 도약 1T(6열)는 390px에서 셀당 ~52px(아이콘 36px + 이름 10px)로 6열 유지 가능하며, 깨달음(4열)은 셀당 ~76px로 여유롭게 배치 가능. 좁은 화면에서는 노드명 1줄 말줄임 + 탭 시 바텀시트/팝오버 툴팁.

### 4.2 최소안 vs 완전안 비교 및 추천

| 항목 | 최소안 (찍은 노드만 아이콘 격자) | 완전안 (전체 트리 정적 데이터) | **하이브리드 추천안 (완전안 + 최소안 자동 폴백)** |
| --- | --- | --- | --- |
| 정적 데이터 필요량 | 없음 (0 KB) | ~35 KB (minified / gzip ~8 KB) | ~35 KB (gzip ~8 KB) |
| 게임 화면 유사도 | 낮음 (티어별 칩 목록 수준, 안 찍은 선택지 맥락 부재) | **매우 높음** (게임과 동일한 격자·갈래·미선택 노드 확인) | **매우 높음** |
| 신규 직업/패치 내성 | 높음 (API만으로 즉시 동작) | 신규 직업·노드 개명 시 미표시 위험 | **높음** (신규 직업은 최소안 폴백, 미매칭 노드는 하단 `기타/신규 노드` 행에 API `Icon`으로 자동 노출) |
| 아이콘 신뢰성 | API `Effect.Icon` 사용 | 공식 CDN 451/451 검증 완료 | 찍은 노드는 API `Effect.Icon` 우선, 안 찍은 노드는 정적 공식 CDN URL 사용 |

**결론 및 추천**: **하이브리드(완전안 기본 + 최소안 자동 폴백)** 를 추천한다.
- 30개 전 직업의 트리 구조와 공식 CDN 아이콘 451개가 이미 100% 확보·검증되었고 번들 부담도 gzip 기준 ~8KB 수준으로 경미하다.
- 동시에 "캐릭터 클래스가 정적 DB에 없거나(신규 클래스 출시 당일), 특정 `Effect`가 정적 노드명과 매칭되지 않을 때(밸런스 패치 개명)" 자동으로 API 응답의 `Icon`·`Description`·`ToolTip`으로 최소안 아이콘 격자/추가 행을 그리면 **유지보수 공백에도 UI가 깨지지 않는다**.

---

## 5. 데이터 형식 제안 (JSON 스키마) 및 파싱 의사코드

### 5.1 정적 트리 JSON 스키마

실제 앱 번들용 정적 데이터는 본 조사의 `evolution.json`, `enlightenment.json`, `leap.json` 구조를 그대로 쓰거나 TypeScript 모듈로 직렬화할 수 있다. 핵심 스키마는 다음과 같다:

```ts
export type ArkPassiveCategory = "진화" | "깨달음" | "도약";

export interface StaticNode {
  code: number;          // 게임 내부 노드 코드 (예: 101010001)
  groupCode: number;     // 선행 참조용 그룹 코드 (예: 1010100)
  name: string;          // 정규화된 노드명 (예: "뭉툭한 가시", "권왕십이식 : 낙화 강화")
  tier: number;          // 1..5 (진화), 1..4 (깨달음), 1..2 (도약)
  row: number;           // 1-based 그리드 행 (= tier)
  col: number;           // 1-based 그리드 열 (진화/도약1T: 1..6, 깨달음: 1..4, 도약2T: 1..4|6)
  role?: "main" | "side";// 깨달음 전용 (col 2,3 = main / col 1,4 = side)
  branchIndex?: 0 | 1;   // 깨달음 전용 (좌 갈래 0, 우 갈래 1)
  maxLevel: number;
  cost: number;          // 레벨당 포인트 비용
  iconKey: string;       // 예: "ark_passive_evolution_20"
  iconUrl: string;       // 공식 CDN URL (예외 dr_skill_01_24 반영 완료)
  requires: { name: string; level: number }[];
  excludes: string[];    // 상호 배타 노드명 목록
}

export interface EvolutionTree {
  totalBudget: number;   // 140
  grid: { rows: 5; cols: 6 };
  tiers: { tier: number; limitPoint: number; prevTierRequiredPoints: number }[];
  nodes: StaticNode[];
}

export interface EnlightenmentCatalog {
  typicalMaxPoints: number;   // 101
  spendableMaxPoints: number; // 100
  grid: { rows: 4; cols: 4 };
  tierGates: { tier: number; prevTierRequiredPoints: number }[];
  classes: Record<string, {
    jobCode: number;
    className: string;
    branches: [string, string]; // 1T 좌/우 직업 각인명
    nodes: StaticNode[];
  }>;
}

export interface LeapCatalog {
  totalBudget: number;        // 70
  tierGates: { tier: number; prevTierRequiredPoints: number }[];
  commonTier1Nodes: StaticNode[];
  classes: Record<string, {
    jobCode: number;
    className: string;
    tier2Cols: number;        // 4 (일반) | 6 (데빌헌터, 건슬링어)
    tier2Nodes: StaticNode[];
  }>;
}
```

### 5.2 API 파싱 · 툴팁 정제 · 트리 매핑 의사코드

```ts
// 1) Effect.ToolTip 전용 파서 (slotData.iconPath URL 혼입 및 trailing "||" 제거)
interface ParsedEffectTooltip {
  nodeName: string | null;
  level: number | null;
  category: ArkPassiveCategory | null;
  bodyLines: string[];
}

function parseArkPassiveTooltip(raw?: string | null): ParsedEffectTooltip | null {
  if (!raw) return null;
  let obj: Record<string, { type?: string; value?: unknown }>;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }

  let nodeName: string | null = null;
  let level: number | null = null;
  let category: ArkPassiveCategory | null = null;
  const bodyLines: string[] = [];

  for (const block of Object.values(obj)) {
    if (!block || typeof block !== "object") continue;

    if (block.type === "NameTagBox" && typeof block.value === "string") {
      nodeName = plainText(block.value).trim();
    } else if (block.type === "CommonSkillTitle" && block.value && typeof block.value === "object") {
      const v = block.value as { leftText?: string; name?: string };
      const lvMatch = plainText(v.leftText ?? "").match(/(\d+)/);
      if (lvMatch) level = Number(lvMatch[1]);
      const cat = plainText(v.name ?? "").trim();
      if (cat === "진화" || cat === "깨달음" || cat === "도약") category = cat;
      // 주의: v.slotData.iconPath는 의도적으로 무시 (텍스트 툴팁에 URL 누출 방지)
    } else if (block.type === "MultiTextBox" && typeof block.value === "string") {
      const cleaned = plainText(block.value.replace(/\|\|\s*(?:<br\s*\/?>\s*)*$/i, ""));
      for (const line of cleaned.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) bodyLines.push(trimmed);
      }
    }
  }
  return { nodeName, level, category, bodyLines };
}

// 2) Effect.Description + ToolTip 결합 파싱 (실측 HTML 및 합성 픽스처 양쪽 호환)
interface ActiveEffect {
  category: ArkPassiveCategory;
  apiTier: number | null;     // API 응답상 티어 (패치 이동 가능 → 보조 용도)
  name: string;
  level: number;
  iconUrl: string | null;     // API가 내려준 최신 공식 CDN URL
  tooltipLines: string[];
}

const DESC_RE = /^(?:(진화|깨달음|도약)\s+)?(\d+)티어\s+(.+?)\s+Lv\.?\s*(\d+)$/i;

function parseEffect(effect: ApiArkPassiveEffect): ActiveEffect | null {
  const tt = parseArkPassiveTooltip(effect.ToolTip);
  const descText = plainText(effect.Description ?? "").replace(/\s+/g, " ").trim();
  const m = descText.match(DESC_RE);

  const category = (effect.Name || tt?.category || m?.[1]) as ArkPassiveCategory | undefined;
  if (category !== "진화" && category !== "깨달음" && category !== "도약") return null;

  // 노드명 우선순위: ToolTip NameTagBox > Description regex
  const name = tt?.nodeName || m?.[3]?.trim();
  const level = tt?.level ?? (m ? Number(m[4]) : null);
  if (!name || level == null) return null;

  return {
    category,
    apiTier: m ? Number(m[2]) : null,
    name,
    level,
    iconUrl: effect.Icon ?? null,
    tooltipLines: tt?.bodyLines ?? [],
  };
}

// 3) 정적 트리 + API 응답 결합 (완전안 + 미매칭/신규 직업 자동 폴백)
function buildTreeViewModel(
  arkPassive: Armory["ArkPassive"],
  className: string,
  catalog: { evolution: EvolutionTree; enlightenment: EnlightenmentCatalog; leap: LeapCatalog },
) {
  if (!arkPassive?.IsArkPassive) return { active: false as const };

  const activeEffects = (arkPassive.Effects ?? [])
    .map(parseEffect)
    .filter((x): x is ActiveEffect => x !== null);

  const pointsByCat = new Map(
    (arkPassive.Points ?? []).map((p) => {
      const karma = plainText(p.Description ?? "").trim() || null; // 예: "6랭크 30레벨"
      return [p.Name, { available: p.Value, karma, tooltip: plainText(p.Tooltip ?? "") }];
    }),
  );

  // 카테고리별 매칭 함수: (1) 정확 이름 일치 → (2) iconKey(파일명) 일치 → (3) 미매칭은 fallback 목록으로
  function bindTab(category: ArkPassiveCategory, staticNodes: StaticNode[] | null) {
    const effects = activeEffects.filter((e) => e.category === category);
    if (!staticNodes) {
      // 신규 직업 등 정적 트리 미존재 → 최소안(찍은 노드 아이콘 격자) 자동 폴백
      return { mode: "minimal-fallback" as const, points: pointsByCat.get(category), effects };
    }

    const byName = new Map(staticNodes.map((n) => [n.name, n]));
    const byIcon = new Map(staticNodes.map((n) => [n.iconKey, n]));
    const matched = new Map<number, ActiveEffect>(); // node.code -> ActiveEffect
    const unmatched: ActiveEffect[] = [];

    for (const eff of effects) {
      const iconKey = eff.iconUrl?.match(/\/([^/]+)\.png(?:\?|$)/i)?.[1];
      const target = byName.get(eff.name) ?? (iconKey ? byIcon.get(iconKey) : undefined);
      if (target) matched.set(target.code, eff);
      else unmatched.push(eff); // 패치로 신설/개명된 노드 → 하단 보조 행으로 표시
    }

    const nodes = staticNodes.map((node) => {
      const hit = matched.get(node.code);
      return {
        ...node,
        level: hit?.level ?? 0,
        active: Boolean(hit && hit.level > 0),
        iconUrl: hit?.iconUrl || node.iconUrl, // 찍은 노드는 API 최신 아이콘 우선
        tooltipLines: hit?.tooltipLines ?? [],
      };
    });

    const spentPoints = nodes.reduce((sum, n) => sum + n.level * n.cost, 0);
    return {
      mode: "full-tree" as const,
      points: pointsByCat.get(category),
      spentPoints,
      nodes,
      unmatched,
    };
  }

  const enlClass = catalog.enlightenment.classes[className];
  const leapClass = catalog.leap.classes[className];

  return {
    active: true as const,
    title: arkPassive.Title ?? null,
    tabs: {
      진화: bindTab("진화", catalog.evolution.nodes),
      깨달음: bindTab("깨달음", enlClass?.nodes ?? null),
      도약: bindTab("도약", leapClass ? [...catalog.leap.commonTier1Nodes, ...leapClass.tier2Nodes] : null),
    },
  };
}
```

---

## 6. 미확인 항목 및 운영 리스크

1. **엘릭서 4T 통합(진화 1~5티어) 이후 실제 API 응답 원문 미확보**: 공개 저장소에서 확보한 유일한 실측 원문(`artbiit` V9.0.0)은 2025-01-15 수집본(진화 1~4티어, 120P)이다. 현행(2026-11) 실측 응답에서 진화 4티어(`회심` 등)·5티어(`뭉툭한 가시` 등)의 `Description` 문자열이 정확히 `4티어` / `5티어`로 내려오는지, `ToolTip` 3단 구조에 변경이 없는지 오너의 API 키로 1회 교차 검증이 필요하다.
2. **예외 상태 실제 API 응답 미확보**:
   - 아크 패시브 활성화(`IsArkPassive: true`) 직후 깨달음 1T 미선택 상태일 때 `Title` 값(`""` vs `null`).
   - 일부 탭 포인트가 0일 때 `Points[]`에 해당 카테고리 항목이 `Value: 0`으로 포함되는지 생략되는지.
   - 2026년 신규 클래스(차원술사·가디언나이트)의 실제 API `ArmoryProfile.CharacterClassName` 문자열이 인벤 DB 직업명(`"차원술사"`, `"가디언나이트"`)과 띄어쓰기까지 정확히 일치하는지(`가디언 나이트` vs `가디언나이트` 확인 필요).
3. **인게임 시각 레이아웃 세부 디테일**: 도약 2T 4노드 정렬 방식, 연결선·잠금 티어·비선택 갈래의 정확한 시각 표현은 §3.4의 오너 스크린샷으로 최종 확인 필요.
4. **패치 동기화 유지보수**: 신규 클래스 출시(연 1~2회) 또는 대규모 밸런스 패치(노드 개명/이동) 시 `evolution.json`·`enlightenment.json`·`leap.json` 갱신이 필요하다. §5.2의 `iconKey` 2차 매칭 + `unmatched` 자동 폴백을 두어 갱신 전에도 앱이 깨지지 않게 방어한다.
5. **저작권/약관 준수**: 정적 JSON은 게임 사실 메타데이터(좌표·이름·비용·선행/배타)만 포함하며, 인벤 서술 텍스트(`desc`)와 `static.inven.co.kr` 이미지 미러는 사용하지 않는다. 스마일게이트 공식 CDN 아이콘은 Open API 이용약관 범위 내에서 클라이언트 직접 참조한다.
