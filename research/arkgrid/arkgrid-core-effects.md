# 아크 그리드 코어별 효과 및 장착 젬 데이터 근거·파싱 조사

- 조사일: 2026-11-25 (추가 범위 반영: 코어를 이루는 젬 `ArkGrid.Slots[].Gems[]` 상세 구조·파싱·화면 제안)
- 대상 API: 로스트아크 OpenAPI V9.0.0+ (`GET /armories/characters/{characterName}/arkgrid` 및 통합 조회의 `ArkGrid` 필드)
- 제약 준수: 앱 코드 미수정, 커밋/푸시 없음, API 키가 필요한 실호출 없음 (공개 저장소·공식 Swagger·공식 게임 가이드만 사용)
- 수집 원문 샘플: [`research/arkgrid/samples/`](samples/README.md)

---

## 핵심 결론

| 질문 | 결론 | 근거 |
|---|---|---|
| `ArkGrid.Slots[].Tooltip`에 코어별 포인트 구간 효과가 들어 있는가? | **예** | `artbiit/lostark-api-service` V9.0.0 실제 응답(`characters.json`)의 `ArkGrid.Slots[0].Tooltip` 내부 `Element_006`(`ItemPartBox`, 제목 `코어 옵션`)에 `[10P]`, `[14P]` 등 포인트 구간별 효과 원문이 HTML 문자열로 그대로 포함됨. 실전 앱 `zeratul188/LotsGo` 파서와도 일치. |
| 활성/비활성 판별을 툴팁 색상으로 할 수 있는가? | **아니오 (권장하지 않음)** | `Point: 0`(미활성) 실응답에서도 `[10P]`, `[14P]` 태그가 모두 `#FFD200`으로 내려옴. 활성 여부는 반드시 **`slot.Point >= threshold`**로 판정해야 함. |
| `ArkGrid.Slots[].Gems[].Tooltip`에 젬 이름·의지력·포인트·부여 옵션이 들어 있는가? | **예 (3개 실전 OpenAPI 파서 교차 검증; 원문 JSON 덤프는 미확보)** | `zeratul188/LotsGo`, `jayjung94/arkgrid-gem-viewer`, `Airplaner/lostark-arkgrid-gem-locator-v2` 3곳이 모두 `NameTagBox`(젬 이름) + `ItemPartBox` 제목 `젬 효과`(내부 `필요 의지력 : X (기본 값 Y - 의지력 효율 Z)`, `(질서\|혼돈) 포인트 : N`, `[옵션명] Lv.N`)를 동일 패턴으로 파싱. 단, 개별 젬 옵션에는 **레벨(`Lv.N`)만** 있고 `%` 합산 문구는 `ArkGrid.Effects[].Tooltip`에 제공됨. |
| `ArkGrid.Effects[].Tooltip`은 JSON인가 HTML인가? | **단순 HTML 문자열 (실전 파서 확인)** | `zeratul188/LotsGo`에서 `JSON.parse()` 없이 `cheerio.load(item.Tooltip).text()`로 바로 추출. Ark Lens 현재 `tooltipLines()`(`JSON.parse` 전제)는 무음 실패 위험이 있어 `plainText` fallback 필요. |
| 별도 정적 코어 효과 표가 필요한가? | **불필요 (툴팁 파싱이 1차 소스)** | 툴팁 원문을 파싱하면 전 직업 약 540종 코어와 밸런스 패치를 자동 추종 가능. 정적 표는 파싱 실패 fallback 또는 딜증 수치 시뮬레이션 목적일 때만 필요. |

---

## 1. 공식 API 스키마 및 `ArkGrid.Slots[].Tooltip` 구조

### 1.1 공식 OpenAPI Swagger 모델 (`V9.0.0+`)

출처: 공식 개발자 포털 Swagger 정의 (`https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories`, 발췌본: [`samples/official-swagger-arkgrid.json`](samples/official-swagger-arkgrid.json)), 교차 검증: `DAN-MU-ZI/pyLoa` (`e8c4cdc`, [`samples/pyloa-arkgrid-notes.md`](samples/pyloa-arkgrid-notes.md)).

```ts
interface ArkGrid {
  Slots: ArkGridSlot[] | null;
  Effects: ArkGridEffect[] | null;
}

interface ArkGridSlot {
  Index: number;        // int32
  Icon: string;
  Name: string;         // 예: "질서의 해 코어 : 수라안"
  Point: number;        // int32 — 현재 활성 젬으로 합산된 코어 포인트 (젬 미장착 시 0)
  Grade: string;        // "영웅" | "전설" | "유물" | "고대"
  Tooltip: string;      // JSON 문자열 (Element_000 ~ Element_NNN)
  Gems: ArkGridGem[] | null;
}

interface ArkGridGem {
  Index: number;        // int32
  Icon: string;
  IsActive: boolean;    // 코어 공급 의지력 내 순차 활성화 여부
  Grade: string;        // "전설" | "유물" | "고대" 등
  Tooltip: string;      // JSON 문자열 (Element_000 ~ Element_NNN)
}

interface ArkGridEffect {
  Name: string;         // 활성 젬 전투 옵션 합산 이름 (예: "공격력", "보스 피해", "추가 피해")
  Level: number;        // int32 — 합산 레벨
  Tooltip: string;      // 형식(JSON vs HTML) 실응답 미확인 (섹션 4.2 참고)
}
```

> 참고: `DAN-MU-ZI/pyLoa`의 `tests/models/test_armory_ark_grid.py`는 스키마 역직렬화 검증용 더미 문자열(`"Tooltip Text"`, `"Gem Tooltip"`, `"Effect Tooltip"`)만 들어 있어 툴팁 내부 구조 근거로는 쓸 수 없으며, 모델 필드명 교차 검증 용도로만 유효합니다.

---

### 1.2 실제 응답 샘플 인용 (`artbiit/lostark-api-service` V9.0.0)

- 출처: `https://github.com/artbiit/lostark-api-service/blob/a0df5ffae85f09ad2062f0174db3058491bb1105/docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/characters.json`
- 캐릭터: 브레이커 (캐릭터명은 싣지 않음), 전설 등급 `질서의 해 코어 : 수라안`, `Point: 0`, `Gems: null`, `Effects: null`
- 원문은 위 링크에서 볼 수 있습니다. 이 저장소에는 원문을 싣지 않고, 같은 구조로 만든 가상 샘플만 둡니다: [`samples/synthetic-arkgrid.json`](samples/synthetic-arkgrid.json) / 디코드된 툴팁: [`samples/synthetic-slot0-tooltip-decoded.json`](samples/synthetic-slot0-tooltip-decoded.json)
- 아래 인용은 [`artbiit/lostark-api-service`](https://github.com/artbiit/lostark-api-service) (ISC 형식 [LICENSE](https://github.com/artbiit/lostark-api-service/blob/main/LICENSE)) 샘플에서 짧게 발췌했습니다.

`Slots[0].Tooltip`을 `JSON.parse()`한 실제 `Element_004` ~ `Element_007` 원문 그대로 인용:

```json
  "Element_004": {
    "type": "ItemPartBox",
    "value": {
      "Element_000": "<FONT COLOR='#A9D0F5'>코어 타입</FONT>",
      "Element_001": "질서 - 해"
    }
  },
  "Element_005": {
    "type": "ItemPartBox",
    "value": {
      "Element_000": "<FONT COLOR='#A9D0F5'>코어 공급 의지력</FONT>",
      "Element_001": "<FONT COLOR = '#B7FB00'>11</FONT> 포인트"
    }
  },
  "Element_006": {
    "type": "ItemPartBox",
    "value": {
      "Element_000": "<FONT COLOR='#A9D0F5'>코어 옵션</FONT>",
      "Element_001": "<FONT color='#FFD200'>[10P]</FONT> 수라결 기본 공격의 피해량이 <FONT COLOR='#99ff99'>3.0%</FONT> 증가한다.<br><FONT color='#FFD200'>[14P]</FONT> 수라결 기본 공격의 피해량이 <FONT COLOR='#99ff99'>4.0%</FONT> 증가하고, <FONT COLOR='#bf9ef6'>'운명'</FONT> 발동 시 <FONT COLOR='#ffff99'>6.0</FONT>초 동안 <FONT COLOR='#bf9ef6'>'운명: 수라강기'</FONT> 효과를 획득한다.<BR><FONT COLOR='#bf9ef6'>'운명: 수라강기'</FONT> : 최대 생명력의 <FONT COLOR='#99ff99'>20.0%</FONT>에 해당하는 보호막이 생성된다."
    }
  },
  "Element_007": {
    "type": "ItemPartBox",
    "value": {
      "Element_000": "<FONT COLOR='#A9D0F5'>코어 옵션 발동 조건</FONT>",
      "Element_001": "<img src='emoticon_sign_greenDot' width='0' height='0' vspace='-3'></img>아크 패시브 무아지경 활성화 필요"
    }
  },
```

#### `Slots[0].Tooltip` 전체 Element 매핑 (`artbiit` 실응답 기준)

| 키 | `type` | 실제 내용 요약 | 비고 |
|---|---|---|---|
| `Element_000` | `NameTagBox` | `질서의 해 코어 : 수라안` (`#F99200`) | 코어 이름 |
| `Element_001` | `ItemTitle` | `leftStr0`: `전설 아크 그리드 코어`, `iconGrade: 4`, `qualityValue: -1` | 등급·아이콘 |
| `Element_002` | `SingleTextBox` | `브레이커 전용` | **질서 코어 전용** — 혼돈 코어(전 직업 공용)에서는 생략되어 이후 인덱스가 앞당겨질 수 있음 |
| `Element_003` | `MultiTextBox` | `\|거래 불가` (`#C24B46`) | 귀속/거래 상태 |
| `Element_004` | `ItemPartBox` | `코어 타입` → `질서 - 해` | 속성(`질서`/`혼돈`) + 세부 타입(`해`/`달`/`별`) |
| `Element_005` | `ItemPartBox` | `코어 공급 의지력` → `11 포인트` | 2025-09-24 패치 이전 실응답(현행 전설=12). `<FONT COLOR = '#B7FB00'>` 공백 변형 주의 |
| **`Element_006`** | **`ItemPartBox`** | **`코어 옵션` → `[10P] ...<br>[14P] ...<BR>'운명: 수라강기' : ...`** | **핵심 파싱 대상** |
| `Element_007` | `ItemPartBox` | `코어 옵션 발동 조건` → `emoticon_sign_greenDot` + `아크 패시브 무아지경 활성화 필요` | 질서 코어의 깨달음 아크 패시브 조건 |
| `Element_008` | `null` | `null` | **`null` 방어 필수** |
| `Element_009` | `SingleTextBox` | `분해불가` | |
| `Element_010`~`011` | `Progress` | `value: null` | 빈 프로그레스 블록 |
| `Element_012` | `SingleTextBox` | 획득처 (`[카제로스 레이드] 4막 : 파멸의 성채<BR>[카제로스 레이드] 종막 : 최후의 날`) | |

### 1.3 실응답에서 발견한 4가지 핵심 파싱 함정

1. **제목 부분 일치 함정 (`코어 옵션` vs `코어 옵션 발동 조건`)**
   - `Element_006`의 제목은 `코어 옵션`, 바로 다음 `Element_007`의 제목은 `코어 옵션 발동 조건`입니다.
   - 실제 공개 파서(`jayjung94/arkgrid-gem-viewer/lib/parseArkGrid.js`)에서도 `if (label.includes("코어 옵션"))`으로 순회하다가 `Element_007`에 덮어씌워지는 버그가 있습니다.
   - 반드시 **`plainText(label).trim() === "코어 옵션"` (정확 일치)**으로 매칭해야 합니다.
2. **인덱스 하드코딩 금지**
   - 혼돈 코어는 직업 제한(`브레이커 전용`)이나 `코어 옵션 발동 조건` 블록이 생략될 가능성이 높으므로 `Element_006` 고정 접근 대신 `Object.values(map)` 순회 + `type === "ItemPartBox"` + 제목 매칭을 사용해야 합니다.
3. **줄바꿈 태그 대소문자 혼용 및 멀티라인 효과 (`[xxP]` 없는 후속 설명 줄)**
   - 원문에 `<br>`(소문자)과 `<BR>`(대문자)이 혼용됩니다.
   - `[14P]` 효과 뒤에 `<BR><FONT COLOR='#bf9ef6'>'운명: 수라강기'</FONT> : 최대 생명력의 20.0%에 해당하는 보호막이 생성된다.`처럼 **`[xxP]` 접두사가 없는 부가 설명 줄**이 붙습니다.
   - 따라서 `<br>`로 split해 각 줄을 독립 효과로 처리하면 부가 설명이 누락되거나 깨집니다. **`\[(\d+)P\]` 마커 위치를 기준으로 구간을 슬라이싱**해야 부가 설명 줄이 직전 포인트 구간에 온전히 귀속됩니다.
4. **미활성 상태에서도 `[10P]`/`[14P]` 색상(`#FFD200`)이 유지됨**
   - `artbiit` 실응답은 `Point: 0`, `Gems: null`(전혀 활성화되지 않은 상태)인데도 `[10P]`, `[14P]`가 모두 `<FONT color='#FFD200'>`입니다.
   - 즉 툴팁 색상으로 활성/비활성을 판별할 수 없으며, **`slot.Point >= threshold`** 비교로 `active`를 계산해야 합니다.

---

## 2. 포인트 구간 규칙 및 코어 종류별 효과 형식

### 2.1 공식 근거 (로스트아크 공식 게임 가이드 + 2025-09-24 업데이트)

출처:
- 로스트아크 공식 게임 가이드 — 아크 그리드 (`https://lostark.game.onstove.com/GameGuide/Pages/%EC%95%84%ED%81%AC%20%EA%B7%B8%EB%A6%AC%EB%93%9C`, 2026-11-25 직접 조회)
- 2025-09-24 업데이트 공지 (영웅/전설 코어 공급 의지력 상향 패치)

#### 코어 등급별 공급 의지력 및 활성화 구간 (공식)

| 코어 등급 | 공급 의지력 (현행 공식) | 2025-09-24 패치 이전 | 코어 효과 활성화 구간 | 비고 |
|---|---:|---:|---|---|
| 영웅 | 9 | 7 | `10P` | 1개 구간 |
| 전설 | 12 | 11 (`artbiit` 실응답 확인) | `10P`, `14P` | 2개 구간 |
| 유물 | 15 | 15 | `10P`, `14P`, `17P`, `18P`, `19P`, `20P` | 6개 구간 |
| 고대 | 17 | 17 | `10P`, `14P`, `17P`, `18P`, `19P`, `20P` | 6개 구간, **17P 달성 효과만 유물보다 높은 수치** |

#### 공식 규칙 핵심 요약

- **누적 적용**: "코어 효과 활성화 기준 포인트: `10 / 14 / 17 / 18 / 19 / 20` 포인트 — ※ 각 효과는 누적되어 적용됩니다."
- **등급별 수치 규칙**: "코어 포인트 별 효과는 등급과 관계없이 동일합니다. (예: 10포인트 달성 효과는 각 등급 모두 동일) 단, **고대 등급 코어의 17포인트 달성 효과는 유물 등급보다 높은 수치**로 적용됩니다."
- **코어 구성 (공식)**:
  - **질서 코어**: `해 / 달 / 별` 각 6종 (클래스별 총 **18종**) — 클래스별 고유 효과. **해당 효과에 맞는 '깨달음' 아크 패시브가 활성화된 상태에서만 적용**.
  - **혼돈 코어**: `해 / 달 / 별` 각 6종 (전 직업 공용 총 **18종**) — 모든 클래스가 사용할 수 있는 범용 효과.
  - 동일 세부 타입은 1개씩만 장착 가능 (총 6슬롯: 질서 해/달/별 3 + 혼돈 해/달/별 3).
- **젬과 의지력 연결 (공식)**:
  - 코어당 4개의 젬 슬롯이 순서대로 연결되며, 코어에 가까운 슬롯부터 의지력을 공급.
  - 젬이 비어 있거나 남은 의지력이 부족하면 해당 슬롯과 그 이후 슬롯은 비활성(`IsActive: false`)되며, 활성화된 젬의 코어 포인트만 합산됨 (젬당 최대 5P × 4슬롯 = 최대 20P).

### 2.2 질서 / 혼돈 코어 종류(해/달/별)별 효과 문구 형식 (커뮤니티·인게임 근거)

> 아래 중 `질서의 해 코어 : 수라안`의 `[10P]`/`[14P]`만 API 실응답에서 직접 검증되었으며, 나머지 유물/고대 `[17P]`~`[20P]` 및 혼돈 코어 문구는 인벤/나무위키 등 커뮤니티에 인용된 인게임 툴팁 문구 기준입니다.

| 대분류 | 세부 타입 | 이름 형식 (`Slots[].Name`) | 역할 및 포인트별 문구 패턴 (커뮤니티 인게임 인용 기준) |
|---|---|---|---|
| **질서** (직업 전용) | **해** | `질서의 해 코어 : <이름>` | `[10P]` 스킬/기본공격 피해량 증가 등 기초 옵션<br>`[14P]` 피해량 증가 + `'운명'` 발동 시 추가 버프/보호막 등 (`'운명: ...' : 설명` 부가 줄 동반 — `artbiit` 실응답 검증)<br>`[17P]` 핵심 메커니즘/스킬 피해 대폭 강화 (유물 < 고대)<br>`[18P]`~`[20P]` 주력 스킬/피해량 소폭 가산 |
| **질서** (직업 전용) | **달** | `질서의 달 코어 : <이름>` | 특정 스킬 사용 시 `'운명'` 발동 트리거 + 피해량/쿨감/아덴·버프 강화.<br>`[10P]`/`[14P]`/`[17P]` 핵심 메커니즘, `[18P]`~`[20P]` 소폭 가산(예: 0.17% 등) |
| **질서** (직업 전용) | **별** | `질서의 별 코어 : <이름>` | 특정 주력 스킬 특화(피해량, 시전 속도, 트라이포드/유틸 강화).<br>`[10P]`/`[14P]`/`[17P]` 주력기 강화, `[18P]`~`[20P]` 소폭 가산 |
| **혼돈** (전 직업 공용) | **해** | `혼돈의 해 코어 : <이름>`<br>(예: `현란한 공격`, `안정적인 공격`, `재빠른 공격`, `신념의 강화`, `흐르는 마나`, `불굴의 강화`) | 예(`현란한 공격`, 커뮤니티 인용):<br>`[10P] 치명타 시 적에게 주는 피해가 0.55% 증가한다.`<br>`[14P] 적에게 주는 피해가 0.50% 증가한다.`<br>`[17P]` 적주피/치피 추가 증가 (유물 < 고대)<br>`[18P]`/`[19P]`/`[20P]` `적에게 주는 피해가 0.16% 증가한다.` |
| **혼돈** (전 직업 공용) | **달** | `혼돈의 달 코어 : <이름>`<br>(예: `불타는 일격`, `흡수의 일격`, `부수는 일격`, `낙인의 흔적`, `강철의 흔적`, `치명적인 흔적`) | 예(`불타는 일격`, 고대 기준 커뮤니티 인용):<br>`[10P] 보스 이상 적에게 공격 적중 시 6.0초 간 화상 상태로 만들어 피해를 입힌다.`<br>`[14P] 보스 이상 적에게 주는 피해가 0.50% 증가한다.`<br>`[17P] 보스 이상 적에게 주는 피해가 2.00% 추가로 증가하고, 화상의 피해량이 150% 증가한다.`<br>`[18P]`/`[19P]`/`[20P]` `보스 이상 적에게 주는 피해가 0.16% 증가한다.` |
| **혼돈** (전 직업 공용) | **별** | `혼돈의 별 코어 : <이름>`<br>(예: `공격`, `무기`, `속도`, `생명` 등) | 예(`공격`, 고대 기준 커뮤니티 인용):<br>`[10P] 공격력이 900 증가한다.`<br>`[14P] 공격력이 0.55% 증가한다.`<br>`[17P] 공격력이 1.65% 증가하고, 추가로 2700 증가한다.`<br>`[18P]`/`[19P]`/`[20P]` `공격력이 0.16% 증가한다.` |

---

## 3. 정적 데이터 테이블 대안 평가 (툴팁 파싱 실패 시 또는 보조 용도)

결론적으로 **`ArkGrid.Slots[].Tooltip`에 공식 원문 텍스트가 직접 들어 있으므로 정적 텍스트 테이블을 만들 이유가 없습니다.**

만약 파싱 불가 상황이나 시뮬레이터 확장을 위해 정적 테이블 구축을 검토한다면, 범위와 비용은 다음과 같습니다.

- **코어 종류 규모**:
  - 질서 코어: 공식 가이드 기준 **클래스당 18종** (해 6 + 달 6 + 별 6) × 현행 약 29개 클래스(`LimJinOuk/LostArk` `src/main/resources/arkcore/` 기준 29개 클래스 JSON + `chaos_common.json` 1개 = 총 30개 파일) → **이론상 522종** 이상.
  - 혼돈 코어: 공식 가이드 기준 전 직업 공용 **18종** (해 6 + 달 6 + 별 6).
  - 합계: **약 540종 코어**.
- **항목 수**: 코어당 최대 6개 포인트 구간(`10/14/17/18/19/20P`) + 유물/고대 17P 분기 = **약 3,780개 텍스트 항목**.
- **유지보수 리스크**: 신직업 추가 및 정기 밸런스 패치(특히 코어 수치/효과 리워크)마다 전수 갱신 필요.
- **참고 가능한 공개 정적 데이터 출처 (텍스트 원문은 없음)**:
  - `LimJinOuk/LostArk` (`5eb1303`, `src/main/resources/arkcore/*.json`): 29개 직업 + `chaos_common.json` 총 498개 코어의 유물/고대 포인트별 **수치 요약 맵**(예: `{"적주피": 1.5, "피증": 12.0}`) — 딜 시뮬레이터용이며 게임 내 원문 설명 문장은 수록되어 있지 않음.
  - `Airplaner/lostark-arkgrid-gem-locator-v2` (`196b43b`, `src/lib/models/arkGridCores.ts`): 혼돈 코어 이름·티어·전투력 계수만 수록.
  - 커뮤니티 DB: 로스트아크 인벤 아이템/아크그리드 DB, 나무위키 아크 그리드 문서.

따라서 Ark Lens UI에서는 **100% `Slots[].Tooltip` 파싱**을 기본으로 하고, 파싱 결과가 비어 있을 때만 기존 `tooltipLines(slot.Tooltip)` 평문 표시로 fallback하는 것이 가장 안전하고 유지보수 비용이 낮습니다.

---

## 4. 코어를 이루는 젬 (`ArkGrid.Slots[].Gems[]`) 상세 조사 및 화면 제안

오너 추가 요청에 따라 각 코어를 구성하는 장착 젬(`Index`, `Icon`, `IsActive`, `Grade`, `Tooltip`)의 데이터 근거, 툴팁 내부 구조, 파싱 방법, 그리고 코어 상세 내 UI 배치를 주요 범위로 정리합니다.

### 4.1 API 스키마 및 공식 젬 규칙

- **공식 API 스키마 (`ArkGridGem`)**: `{ Index: number, Icon: string, IsActive: boolean, Grade: string, Tooltip: string }` ([`samples/official-swagger-arkgrid.json`](samples/official-swagger-arkgrid.json)).
  - 젬의 **이름, 세부 타입, 필요 의지력(비용), 의지력 효율, 질서·혼돈 포인트, 부여 전투 옵션 2종**은 최상위 필드에 없고 **모두 `Tooltip` JSON 문자열 내부**에 들어 있습니다.
- **공식 게임 가이드 규칙** (`https://lostark.game.onstove.com/GameGuide/Pages/%EC%95%84%ED%81%AC%20%EA%B7%B8%EB%A6%AC%EB%93%9C`, 2026-11-25 직접 조회):
  - 코어당 4개의 젬 슬롯이 **순서대로(`Index` 0~3)** 연결되며, 코어에 가까운 슬롯부터 의지력을 공급.
  - 빈 슬롯이 있거나 남은 의지력이 부족하면 해당 슬롯과 그 이후 슬롯은 비활성(`IsActive: false`)되며, 활성 젬의 포인트·전투 옵션만 적용됨.
  - 가공 완료 시 젬 포인트 총합에 따라 등급 결정: **전설(4~15) / 유물(16~18) / 고대(19 이상)**.
  - 6종 젬 및 기본 필요 의지력·부여 가능 옵션 (공식):

| 타입 | 세부 타입 (이름) | 기본 필요 의지력 | 부여 가능 옵션 (공격형) | 부여 가능 옵션 (지원형) |
|---|---|---:|---|---|
| 질서 | 안정 (`질서의 젬 : 안정`) | 8 | 공격력, 추가 피해 | 낙인력, 아군 피해 강화 |
| 질서 | 견고 (`질서의 젬 : 견고`) | 9 | 공격력, 보스 피해 | 아군 피해 강화, 아군 공격 강화 |
| 질서 | 불변 (`질서의 젬 : 불변`) | 10 | 추가 피해, 보스 피해 | 낙인력, 아군 공격 강화 |
| 혼돈 | 침식 (`혼돈의 젬 : 침식`) | 8 | 공격력, 추가 피해 | 낙인력, 아군 피해 강화 |
| 혼돈 | 왜곡 (`혼돈의 젬 : 왜곡`) | 9 | 공격력, 보스 피해 | 아군 피해 강화, 아군 공격 강화 |
| 혼돈 | 붕괴 (`혼돈의 젬 : 붕괴`) | 10 | 추가 피해, 보스 피해 | 낙인력, 아군 공격 강화 |

---

### 4.2 `ArkGrid.Slots[].Gems[].Tooltip` 내부 구조 (3개 실전 OpenAPI 파서 교차 검증)

> **샘플 확보 현황 (투명 고지)**: 공개 저장소·블로그에서 `Gems[].Tooltip`의 **원본 JSON 문자열 덤프 자체는 찾지 못했습니다** (`artbiit` 샘플은 `Gems: null`, `pyLoa` 테스트는 `"Gem Tooltip"` 더미 문자열). 대신 실제 로스트아크 OpenAPI `/armories/characters/{name}/arkgrid`를 호출·파싱하는 공개 오픈소스 **3곳**([`samples/community-parsers-links.md`](samples/community-parsers-links.md))이 **동일한 블록 구조와 문자열 패턴**을 사용하고 있어 내부 형식을 3중 교차 검증했습니다:
> 1. `zeratul188/LotsGo` (`490ea6e`, `characterInfo.ts` · `arkGridPrints.ts`)
> 2. `jayjung94/arkgrid-gem-viewer` (`17e21ce`, `lib/parseArkGrid.js`)
> 3. `Airplaner/lostark-arkgrid-gem-locator-v2` (`196b43b`, `AppConfiguration.svelte`)

#### 3개 실전 파서 교차 검증 매핑표

| 추출 항목 | `Tooltip` JSON 내 위치 & `type` | 검증된 문자열 패턴 | 교차 검증 출처 |
|---|---|---|---|
| **젬 이름 / 세부 타입** | `Element_000` (`type: "NameTagBox"`, `value: string`) | `질서의 젬 : 안정` / `견고` / `불변`<br>`혼돈의 젬 : 침식` / `왜곡` / `붕괴` | `LotsGo` (`type === 'NameTagBox'`), `jayjung94` (`Element_000.value`), `Airplaner` (`ArkGridGemNames`) — **3곳 일치** |
| **젬 타입 / 가공 총점** | `Element_004` (`ItemPartBox` 추정, `value.Element_001`) | `젬 타입 : 질서` (또는 `혼돈`)<br>`젬 포인트 : 19` (4~20 총합) | `jayjung94` (`Element_004.value.Element_001`에서 `/젬 타입\s*:\s*(질서\|혼돈)/`, `/젬 포인트\s*:\s*(\d+)/`) — *`Element_000` 제목 원문은 미확인* |
| **젬 효과 블록 제목** | `Element_005` (`ItemPartBox`, `value.Element_000`) | 제목에 **`"젬 효과"`** 포함 | `LotsGo` (`element000.includes('젬 효과')`) + `jayjung94` (`Element_005.value.Element_001`) |
| **필요 의지력 (비용) / 기본 값 / 의지력 효율** | `Element_005.value.Element_001` (`<br>` 구분 1번째 줄) | `필요 의지력 : 3 (기본 값 8 - 의지력 효율 5)`<br>※ 공식: `필요 의지력 = 기본 값 - 의지력 효율` | `jayjung94` (전체 괄호식 정규식), `Airplaner` (`/필요 의지력 : (\d+)/`), `LotsGo` (`의지력 효율` 뒤 숫자 추출) — **3곳 일치** |
| **질서·혼돈 코어 포인트** | `Element_005.value.Element_001` (`<br>` 구분 2번째 줄) | `질서 포인트 : 5` 또는 `혼돈 포인트 : 5` (1~5) | `jayjung94`, `Airplaner`, `LotsGo` — **3곳 일치** |
| **부여 전투 옵션 2종** | `Element_005.value.Element_001` (`<br>` 구분 3~4번째 줄) | `[공격력] Lv.4`<br>`[추가 피해] Lv.5`<br>*(6종 중 2개, 레벨은 1~5)* | `jayjung94` (`/\[([^\]]+)\]\s*Lv\.(\d+)/g`), `Airplaner` (`/\[([^\]]+)] Lv\.(\d+)/g`), `LotsGo` (`[`/`]` 포함 줄 그대로 추출) — **3곳 일치** |

#### 파서 역추정 텍스트 구조 (※ 실응답 원문이 아닌 3개 파서 기반 재구성 예시)

```text
Element_000 (NameTagBox):
  "질서의 젬 : 안정"

Element_004 (ItemPartBox 추정, 제목 원문 미확인):
  Element_001: "젬 타입 : 질서<br>젬 포인트 : 19"

Element_005 (ItemPartBox, Element_000에 "젬 효과" 포함):
  Element_001:
    "필요 의지력 : 3 (기본 값 8 - 의지력 효율 5)<br>질서 포인트 : 5<br>[공격력] Lv.4<br>[추가 피해] Lv.5"
```

#### 젬 툴팁 파싱 시 핵심 발견 3가지

1. **부여 옵션은 `%` 수치가 아니라 `[옵션명] Lv.N` 형태(레벨만)**
   - 3개 실전 파서 모두 젬 개별 툴팁에서 `[옵션명] Lv.N`만 추출하며, `LotsGo`는 젬 칩에 `[`/`]`만 제거해 `공격력 Lv.4` 그대로 표시합니다.
   - 실제 합산 `%` 효과 문구(예: `보스 이상 몬스터에게 주는 피해 +X%`)는 개별 젬이 아니라 `ArkGrid.Effects[]`의 `Tooltip`에서 내려옵니다.
   - 참고(커뮤니티 환산치, `jayjung94/arkgrid-gem-viewer/public/app.js`): 딜러 기준 Lv.1~5 대략치 공격력 `+0.029%~0.172%`, 추가 피해 `+0.060%~0.299%`, 보스 피해 `+0.078%~0.391%` (단, Ark Lens는 시뮬레이터가 아니므로 추측 `%`를 억지로 붙이기보다 **API 원본 `Lv.N`을 그대로 표시**하는 것이 정확합니다).
2. **`필요 의지력(비용)` vs `의지력 효율` 혼동 주의**
   - `필요 의지력 : 3 (기본 값 8 - 의지력 효율 5)`에서 코어가 공급하는 의지력(예: 유물 15, 고대 17)에서 실제로 차감되는 값은 앞의 **`3`(필요 의지력 비용)**입니다.
   - `LotsGo`는 뒤의 `의지력 효율(5)`을 뽑아 `"의지력 5"`라고 표시하는데, 코어 공급 의지력 합산(`사용 14 / 공급 15`)을 계산·표시할 때는 반드시 **앞의 `필요 의지력(willpower = 3)`**을 써야 합산이 맞습니다 (`willpowerEfficiency = 5`는 보조 툴팁/부가 정보로 제공).
3. **`Element_004`/`Element_005` 인덱스 하드코딩 금지**
   - `jayjung94`는 `Element_004`, `Element_005`를 고정 인덱스로 읽지만, `LotsGo`처럼 `type === "NameTagBox"` 및 `type === "ItemPartBox"` 순회(`heading.includes("젬 효과")`)로 탐색하고, 매칭 실패 시 전체 `ItemPartBox` 본문 합산 텍스트에서 정규식으로 추출(`Airplaner` 방식)하는 2단 방어가 안전합니다.

---

### 4.3 `ArkGrid.Effects[].Tooltip` (활성 젬 합산 전투 효과)

- **역할**: 모든 코어의 활성화된 젬(`IsActive: true`)에서 합산된 전투 옵션(`공격력`, `추가 피해`, `보스 피해`, `낙인력`, `아군 공격 강화`, `아군 피해 강화`)의 총 레벨(`Level`)과 합산 효과 설명(`Tooltip`).
- **형식 확인 (`zeratul188/LotsGo` `characterInfo.ts`)**: `Effects[].Tooltip`은 `JSON.parse()` 없이 `cheerio.load(item.Tooltip).text()`로 바로 텍스트를 추출합니다. 즉 **`Element_000` JSON이 아니라 단순 HTML 문자열**입니다 (단, 실응답 원문 문자열 자체는 미확보).
- **옵션명 표기 변형 주의**: `LotsGo` (`combatSimulatorFeat.ts`)는 `"아군 공격 강화"` 외에 `"아군 공격력 강화"`로 올 수 있는 케이스를 방어하고 있습니다.

#### Ark Lens 현재 구현(`plo/ark-lens-character`)에서 발견된 주의점 2건
1. `src/sections.tsx`의 `GridCard`에서 `ArkGrid.Effects` 테이블 `<caption>`이 **`"코어 효과"`**로 되어 있으나, 실제로는 **장착 젬 합산 전투 효과**입니다. 코어별 효과 UI를 추가할 때 `"젬 합산 효과"` 등으로 이름을 분리해야 혼동이 없습니다.
2. `GridCard`가 `effect.Tooltip`을 `tooltipLines(effect.Tooltip)`에 넘기는데, `src/parse/tooltip.ts`의 `tooltipLines()`는 `JSON.parse(raw)` 실패 시 `[]`를 반환합니다. `Effects[].Tooltip`이 단순 HTML 문자열이므로 현재 구현에서는 툴팁이 빈 배열로 무음 실패합니다 → **JSON 파싱 실패 시 `plainText(raw)` fallback** 적용 필요.

---

### 4.4 젬 파싱 방법 제안 (TypeScript 의사코드)

요청된 반환 형태(`{ name, grade, active, willpower?, point?, options: [{ name, level/value }] }`)에 맞춰 `ArkGridGem` 하나를 파싱하는 의사코드입니다.

```ts
export interface ArkGridGemOption {
  name: string;   // 예: "공격력", "추가 피해", "보스 피해", "낙인력", "아군 공격 강화", "아군 피해 강화"
  level?: number; // 예: 4 (API 젬 툴팁 기본 포맷: "[보스 피해] Lv.4")
  value?: string; // 예외적으로 "%"/수치 문구가 붙어 내려올 경우 보존 (기본 포맷에서는 undefined)
}

export interface ParsedArkGridGem {
  index: number;                // gem.Index (0~3, 코어 의지력 순차 공급 순서)
  icon: string;                 // gem.Icon
  name: string;                 // 예: "질서의 젬 : 안정" (파싱 실패 시 `${gem.Grade} 젬`)
  subType?: string;             // 예: "안정" | "견고" | "불변" | "침식" | "왜곡" | "붕괴"
  grade: string;                // gem.Grade ("전설" | "유물" | "고대")
  active: boolean;              // gem.IsActive
  willpower?: number;           // 필요 의지력 비용 (예: 3) — 코어 공급 의지력에서 차감
  willpowerBase?: number;       // 기본 값 (8 / 9 / 10)
  willpowerEfficiency?: number; // 의지력 효율 (1~5)
  point?: number;               // 코어 기여 질서/혼돈 포인트 (1~5)
  gemPointTotal?: number;       // 가공 젬 포인트 총합 (4~20)
  options: ArkGridGemOption[];  // [{ name, level, value? }]
}

/**
 * ArkGrid.Slots[].Gems[] 항목 하나를 UI 표시용 구조로 파싱한다.
 * - Element_XXX 인덱스 번호에 의존하지 않는다.
 * - NameTagBox에서 젬 이름을 추출하고, ItemPartBox(우선 "젬 효과" 블록, 전체 fallback)에서
 *   필요 의지력 / 질서·혼돈 포인트 / [옵션명] Lv.N을 추출한다.
 */
export function parseArkGridGem(gem: {
  Index: number;
  Icon?: string | null;
  IsActive: boolean;
  Grade: string;
  Tooltip?: string | null;
}): ParsedArkGridGem {
  const base: ParsedArkGridGem = {
    index: gem.Index,
    icon: gem.Icon ?? "",
    name: `${gem.Grade} 젬`,
    grade: gem.Grade,
    active: gem.IsActive,
    options: [],
  };

  const map = parseTooltipObject(gem.Tooltip);
  if (!map) return base;

  let nameFromBox: string | null = null;
  let effectBody = "";
  const otherPartBodies: string[] = [];

  for (const block of Object.values(map)) {
    if (!block) continue;

    if (block.type === "NameTagBox" && typeof block.value === "string") {
      const parsed = plainText(block.value).trim();
      if (parsed) nameFromBox = parsed;
      continue;
    }

    if (block.type === "ItemPartBox" && block.value && typeof block.value === "object") {
      const val = block.value as Record<string, unknown>;
      const heading = typeof val.Element_000 === "string" ? plainText(val.Element_000).trim() : "";
      const body = typeof val.Element_001 === "string" ? plainText(val.Element_001) : "";
      if (!body) continue;

      if (heading.includes("젬 효과")) {
        effectBody = body;
      } else {
        otherPartBodies.push(body);
      }
    }
  }

  const name = nameFromBox ?? base.name;
  const subType = name.includes(":") ? name.split(":")[1].trim() || undefined : undefined;

  // "젬 효과" 블록을 우선 검색하고, 블록 제목이 변경됐을 경우를 대비해 전체 텍스트로 fallback
  const primaryText = effectBody || otherPartBodies.join("\n");
  const allText = [effectBody, ...otherPartBodies].filter(Boolean).join("\n");

  const wpDetail = primaryText.match(
    /필요 의지력\s*:\s*(\d+)\s*\(기본\s*값\s*(\d+)\s*[-–]\s*의지력\s*효율\s*(\d+)\)/,
  );
  const wpSimple = primaryText.match(/필요 의지력\s*:\s*(\d+)/);
  const pointMatch = primaryText.match(/(?:질서|혼돈)\s*포인트\s*:\s*(\d+)/);
  const gemPointMatch = allText.match(/젬 포인트\s*:\s*(\d+)/);

  // [옵션명] Lv.N (추가로 같은 줄에 +0.XX% 같은 값이 붙어 오는 변형까지 방어)
  const options: ArkGridGemOption[] = [];
  for (const line of primaryText.split(/\r?\n/)) {
    const m = line.trim().match(/^\[([^\]]+)\]\s*Lv\.(\d+)(?:\s*(.+))?$/i);
    if (!m) continue;
    const opt: ArkGridGemOption = {
      name: m[1].trim(),
      level: Number(m[2]),
    };
    const trailing = m[3]?.trim();
    if (trailing) opt.value = trailing;
    options.push(opt);
  }

  return {
    index: gem.Index,
    icon: gem.Icon ?? "",
    name,
    subType,
    grade: gem.Grade,
    active: gem.IsActive,
    willpower: wpDetail ? Number(wpDetail[1]) : wpSimple ? Number(wpSimple[1]) : undefined,
    willpowerBase: wpDetail ? Number(wpDetail[2]) : undefined,
    willpowerEfficiency: wpDetail ? Number(wpDetail[3]) : undefined,
    point: pointMatch ? Number(pointMatch[1]) : undefined,
    gemPointTotal: gemPointMatch ? Number(gemPointMatch[1]) : undefined,
    options,
  };
}
```

#### 파싱 출력 예시 (가공 완료 고대 `질서의 젬 : 안정` 입력 시)

```json
{
  "index": 0,
  "icon": "https://cdn-lostark.game.onstove.com/...",
  "name": "질서의 젬 : 안정",
  "subType": "안정",
  "grade": "고대",
  "active": true,
  "willpower": 3,
  "willpowerBase": 8,
  "willpowerEfficiency": 5,
  "point": 5,
  "gemPointTotal": 19,
  "options": [
    { "name": "공격력", "level": 4 },
    { "name": "추가 피해", "level": 5 }
  ]
}
```

---

### 4.5 화면 제안: 코어 상세에서 **코어 효과 목록 아래에 젬 목록**

기존 Ark Lens `GridCard`의 코어 목록 행을 클릭(또는 아코디언/상세 패널 펼침)했을 때, 평문 툴팁 덤프 대신 **구조화된 코어 상세 패널**을 아래 순서로 표시하는 구성을 제안합니다.

#### 와이어프레임 (코어 1개 펼침 상세 — 모바일 390px / 데스크톱 공용 세로 흐름)

```text
┌──────────────────────────────────────────────────────────┐
│ [아이콘] 수라안                   유물 · 17P  [접기 ▲]   │
│         질서의 해 코어 · 의지력 14 / 15                  │
│         ● 아크 패시브 무아지경 활성화 필요  (질서 코어)  │
├──────────────────────────────────────────────────────────┤
│ 코어 효과                                  현재 17P 활성 │
│  [10P] 수라결 기본 공격의 피해량이 3.0% 증가한다.   (강조)│
│  [14P] 수라결 기본 공격의 피해량이 4.0% 증가하고,   (강조)│
│        '운명' 발동 시 6.0초 동안 '운명: 수라강기'...     │
│        '운명: 수라강기' : 최대 생명력의 20.0% 보호막...  │
│  [17P] ...                                          (강조)│
│  [18P] ...                                        (흐리게)│
│  [19P] ...                                        (흐리게)│
│  [20P] ...                                        (흐리게)│
├──────────────────────────────────────────────────────────┤
│ 장착 젬  3 / 4 활성                   의지력 14 / 15     │
│  1. [젬아이콘] 안정 · 고대           의지력 3 · +5P      │
│     [공격력 Lv.4]  [추가 피해 Lv.5]                      │
│  2. [젬아이콘] 견고 · 고대           의지력 4 · +5P      │
│     [공격력 Lv.5]  [보스 피해 Lv.4]                      │
│  3. [젬아이콘] 불변 · 유물           의지력 5 · +4P      │
│     [추가 피해 Lv.4]  [보스 피해 Lv.4]                   │
│  4. [젬아이콘] 불변 · 전설 (비활성)  의지력 6 · +3P      │  ← dimmed + 비활성 배지
│     [추가 피해 Lv.2]  [낙인력 Lv.3]                      │
└──────────────────────────────────────────────────────────┘
```

#### 세부 UI 설계 포인트

1. **코어 상세 상단 메타 요약**
   - `의지력 {사용} / {공급}`: `사용`은 `gems.filter(g => g.active).reduce((s, g) => s + (g.willpower ?? 0), 0)`으로 계산, `공급`은 `Slots[].Tooltip`의 `코어 공급 의지력` 값 사용.
   - 질서 코어의 `코어 옵션 발동 조건`(예: `아크 패시브 무아지경 활성화 필요`)은 보조 1줄 배지로 표시.
2. **코어 효과 목록 (상단 섹션)**
   - `[10P]`~`[20P]` 배지 + 설명 2열 그리드(`44px` + `1fr`).
   - `active === true`(`slot.Point >= point`)는 선명한 텍스트 + 포인트 배지 강조, `active === false`는 `opacity` 낮춤 + muted 톤.
   - 설명 내 `\n`(부가 설명 줄)은 `white-space: pre-line`으로 줄바꿈 보존.
   - 파싱 결과가 빈 배열일 때만 기존 `tooltipLines(slot.Tooltip)` 평문으로 fallback.
3. **장착 젬 목록 (코어 효과 목록 아래 섹션)**
   - **순서 유지**: `Index` 오름차순(0 → 3)으로 표시해야 코어 의지력이 앞 슬롯부터 순차 공급되다 끊겨 뒤 슬롯이 `비활성`되는 인게임 규칙이 직관적으로 보임.
   - **각 젬 행 구성**:
     - 1행: 슬롯 순번/등급 테두리 아이콘 + **짧은 이름(`subType` 예: `안정`/`견고`/`불변`, 없으면 `name`)** + 등급 + 우측 핵심 수치 **`의지력 {willpower}` · `+{point}P`** (의지력 hover/aria 설명에 `기본 {base} - 효율 {eff}` 제공).
     - 2행: 부여 옵션 칩 2개(`공격력 Lv.4`, `보스 피해 Lv.5` 등). 딜러 공격형(`공격력`/`추가 피해`/`보스 피해`)과 지원형(`낙인력`/`아군 공격 강화`/`아군 피해 강화`)을 미묘한 톤으로 구분 가능.
   - **비활성 젬(`active === false`)**: 행 전체를 dimmed 처리하고 `"비활성"` 배지를 붙여 `Slot.Point`와 의지력 합계에 포함되지 않음을 명확히 구분.
   - **빈 슬롯 처리**: 모바일(390px) 세로 길이를 아끼기 위해 장착된 젬만 렌더하고 헤더에 `장착 {gems.length}/4` 또는 `활성 {activeCount}/{gems.length}`를 표시하는 구성을 권장 (장착 젬이 0개이면 `"장착된 젬이 없습니다."` 1줄).
4. **카드 하단 `ArkGrid.Effects[]` 테이블 정비**
   - `GridCard` 하단 테이블 캡션을 기존 `"코어 효과"` → **`"젬 합산 효과"`**로 변경하고, `effect.Tooltip`은 단순 HTML 문자열 대응 파서(`parseArkGridEffectTooltipLines`)를 연결해 툴팁이 정상 표시되도록 개선.

---

## 5. TypeScript 파싱 방법 제안 (코어 효과 + `Effects` 요약)

Ark Lens의 기존 `plainText()`(`src/parse/tooltip.ts`)를 그대로 재사용하는 전제로 작성했습니다. (젬 파서 `parseArkGridGem`은 섹션 4.4 참고.)

### 5.1 코어 효과 파서 (`ArkGridSlot` → `{ point, text, active }[]`)

```ts
export interface CoreEffectEntry {
  point: number;    // 10, 14, 17, 18, 19, 20
  text: string;     // 포인트 구간 설명 (부가 설명 줄이 있으면 '\n'으로 포함)
  active: boolean;  // 현재 코어 포인트로 활성 여부
}

export interface ParsedCoreTooltip {
  coreType: string | null;            // 예: "질서 - 해"
  willpowerBudget: number | null;     // 예: 12, 15, 17
  effects: CoreEffectEntry[];         // [{ point, text, active }]
  activationCondition: string | null; // 예: "아크 패시브 무아지경 활성화 필요" (혼돈 코어는 null)
  conditionMet: boolean | null;       // greenDot 감지 시 true, 그 외 null (미충족 아이콘은 추후 검증)
}

interface TooltipBlock {
  type?: string;
  value?: unknown;
}

const POINT_MARKER_RE = /\[(\d+)P\]/gi;

function parseTooltipObject(raw?: string | null): Record<string, TooltipBlock | null> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, TooltipBlock | null>;
  } catch {
    return null;
  }
}

/**
 * HTML이 포함된 코어 옵션 본문(Element_001)에서 [10P], [14P], ... 구간별 효과를 분리한다.
 * - <br> / <BR>을 '\n'으로 변환하고 HTML 태그를 제거한 뒤 [(\d+)P] 마커 위치로 슬라이싱한다.
 * - [14P] 뒤에 [xxP] 없이 <BR>로 이어지는 부가 설명 줄('운명: 수라강기' : ...)도
 *   직전 포인트 구간에 온전히 귀속된다.
 */
function parseCoreOptionBody(rawHtml: string, currentPoint: number): CoreEffectEntry[] {
  const text = plainText(rawHtml).replace(/\r/g, "");
  const matches = [...text.matchAll(POINT_MARKER_RE)];
  if (matches.length === 0) return [];

  const entries: CoreEffectEntry[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const point = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;

    const body = text
      .slice(start, end)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");

    if (Number.isFinite(point) && body) {
      entries.push({
        point,
        text: body,
        active: currentPoint >= point,
      });
    }
  }
  return entries;
}

/**
 * 코어 슬롯 하나에서 포인트별 효과 목록과 메타 정보를 추출한다.
 * - Element_XXX 인덱스 번호에 의존하지 않고 ItemPartBox의 제목 정확 일치로 탐색한다.
 * - "코어 옵션"과 "코어 옵션 발동 조건" 혼동을 방지하기 위해 exact match를 사용한다.
 */
export function parseCoreTooltip(slot: {
  Point: number;
  Tooltip?: string | null;
}): ParsedCoreTooltip {
  const empty: ParsedCoreTooltip = {
    coreType: null,
    willpowerBudget: null,
    effects: [],
    activationCondition: null,
    conditionMet: null,
  };
  const map = parseTooltipObject(slot.Tooltip);
  if (!map) return empty;

  let coreType: string | null = null;
  let willpowerBudget: number | null = null;
  let effects: CoreEffectEntry[] = [];
  let activationCondition: string | null = null;
  let conditionMet: boolean | null = null;

  for (const block of Object.values(map)) {
    if (!block || block.type !== "ItemPartBox") continue;
    const val = block.value as Record<string, unknown> | null | undefined;
    if (!val || typeof val !== "object") continue;

    const rawHeading = typeof val.Element_000 === "string" ? val.Element_000 : "";
    const rawBody = typeof val.Element_001 === "string" ? val.Element_001 : "";
    const heading = plainText(rawHeading).trim();

    if (heading === "코어 타입") {
      coreType = plainText(rawBody).trim() || null;
    } else if (heading === "코어 공급 의지력") {
      const m = plainText(rawBody).match(/(\d+)/);
      willpowerBudget = m ? Number(m[1]) : null;
    } else if (heading === "코어 옵션") {
      effects = parseCoreOptionBody(rawBody, slot.Point);
    } else if (heading === "코어 옵션 발동 조건") {
      activationCondition = plainText(rawBody).trim() || null;
      if (/emoticon_sign_greenDot/i.test(rawBody)) {
        conditionMet = true;
      }
      // 미충족 시 아이콘명(예: redDot 등)은 실응답 확인 후 false 분기 추가
    }
  }

  return { coreType, willpowerBudget, effects, activationCondition, conditionMet };
}

// 요구 시그니처 단축 래퍼: 코어 하나 -> [{ point, text, active }]
export function parseCoreEffects(slot: {
  Point: number;
  Tooltip?: string | null;
}): CoreEffectEntry[] {
  return parseCoreTooltip(slot).effects;
}
```

#### `artbiit` 실응답(`질서의 해 코어 : 수라안`, `Point: 0`) 입력 시 출력 예시

```json
[
  {
    "point": 10,
    "text": "수라결 기본 공격의 피해량이 3.0% 증가한다.",
    "active": false
  },
  {
    "point": 14,
    "text": "수라결 기본 공격의 피해량이 4.0% 증가하고, '운명' 발동 시 6.0초 동안 '운명: 수라강기' 효과를 획득한다.\n'운명: 수라강기' : 최대 생명력의 20.0%에 해당하는 보호막이 생성된다.",
    "active": false
  }
]
```

*(만약 `slot.Point`가 `14`였다면 두 항목 모두 `active: true`, `10`이었다면 `10P`만 `active: true`, `14P`는 `active: false`)*

---

### 5.2 `Effects[].Tooltip` 안전 파서 의사코드

```ts
/**
 * ArkGrid.Effects[].Tooltip은 실전 파서(zeratul188/LotsGo) 기준 단순 HTML 문자열이다.
 * JSON 파싱 실패 시 plainText 줄 단위로 fallback하여 JSON/HTML 양쪽 모두 안전하게 처리한다.
 */
export function parseArkGridEffectTooltipLines(raw?: string | null): string[] {
  if (!raw) return [];
  const jsonLines = tooltipLines(raw); // 기존 Ark Lens JSON 툴팁 파서
  if (jsonLines.length > 0) return jsonLines;
  return plainText(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
```

---

## 6. 미확인 항목 (구현 직전 라이브 응답 1회로 검증 필요)

공개 자료·공식 문서·실전 파서 3곳 교차 검증만으로는 아래 6가지를 **원본 API JSON 문자열 그대로** 직접 확인하지 못했습니다. 구현 직전 실제 캐릭터(유물/고대 코어 + 젬 장착 완료) 응답 1건으로 검증하면 모두 확정됩니다.

1. **`ArkGrid.Slots[].Gems[].Tooltip` 원본 JSON 문자열 전체**: 3개 실전 파서(`LotsGo`, `jayjung94`, `Airplaner`)로 `NameTagBox` 및 `ItemPartBox`(제목 `"젬 효과"`, 본문 `필요 의지력`/`(질서|혼돈) 포인트`/`[옵션명] Lv.N`)를 교차 검증했으나, 실제 원본 JSON 덤프(특히 `Element_004`의 정확한 `Element_000` 라벨명, `<br>`/`<BR>` 대소문자, `[옵션명] Lv.N` 뒤에 `%` 부가 텍스트 유무)는 실응답으로 1회 확인 필요.
2. **유물/고대 코어 `[17P]`~`[20P]` 원문 포맷**: `[10P]`, `[14P]`는 `artbiit` 실응답으로 검증했고 `LotsGo` 파서도 동일 정규식을 쓰지만, `[17P]`~`[20P]` 실제 원문 문자열 확인 필요.
3. **혼돈 코어 `Slots[].Tooltip` 원문 구조**: `전용`(`SingleTextBox`)과 `코어 옵션 발동 조건`(`ItemPartBox`) 블록 생략 여부 및 `코어 옵션` 제목 동일성 확인 필요.
4. **`slot.Point >= 10` 활성 상태에서의 툴팁 색상 변화**: `Point: 0`에서도 `#FFD200`임은 확인했으나, 일부 구간 활성 상태일 때 툴팁 자체의 색상 변화 여부 확인 필요 (판정 로직은 `slot.Point >= point`로 고정).
5. **질서 코어 `코어 옵션 발동 조건` 미충족 상태 표현**: 충족 시 `emoticon_sign_greenDot`은 확인했으나, 미충족 시 아이콘명(`redDot` 등)과 그때 `slot.Point`가 0으로 내려오는지 여부 확인 필요.
6. **`ArkGrid.Effects[].Tooltip` 실제 원문 문자열**: `LotsGo` 파서로 단순 HTML 문자열임은 확인했으나, 실제 HTML 원문 예시(줄바꿈·태그·`%` 문구 형식)와 `"아군 공격 강화"` vs `"아군 공격력 강화"` 표기 확인 필요.
