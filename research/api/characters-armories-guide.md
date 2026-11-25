# 로스트아크 Open API 실전 사용 가이드 — CHARACTERS & ARMORIES

> **작성 기준일**: 2026-11-25  
> **기준 스펙**: 공식 Swagger 2.0 (`info.version: v1`), 포털 Changelog 최신 **V10.0.0** `[공식]`  
> **Base URL**: `https://developer-lostark.game.onstove.com` `[공식]`  
> **관련 문서**: 전체 6개 그룹(23개 엔드포인트)의 필드 목록은 기존 정리 문서([`lostark-api-endpoints.md`](lostark-api-endpoints.md))를 참고하세요. 본 문서는 중복 필드 나열을 최소화하고 **실제 구현(요청·타입·응답 처리·Tooltip 파싱·에러/캐싱·원정대 전환 흐름)**에 집중합니다.

### 근거 표기 범례

| 표기 | 의미 |
| --- | --- |
| `[공식]` | 로스트아크 개발자 포털(`/getting-started`, `/usage-guide`, `/changelog`, `/faq`, Swagger JSON)에서 직접 확인한 사항 |
| `[커뮤니티 확인]` | 공개 오픈소스(GitHub)의 클라이언트 코드, 타입 정의, 실제 API V9.0.0 응답 샘플 등에서 교차 확인한 사항 (출처 URL 병기) |
| `[권장]` | 공식 제약(분당 100회, 동기화 지연 등)과 실무 패턴을 바탕으로 제안하는 구현·운영 가이드 |
| `[미확인]` | 공식 문서에 미기재되어 있고 API 키를 통한 직접 호출 검증을 수행하지 않아 확정할 수 없는 사항 |

---

## 1. 빠른 시작: 공통 요청 규칙 & TypeScript 클라이언트

### 1.1 필수 헤더 및 인코딩 규칙

- **인증 헤더** `[공식]`: 모든 요청에 `authorization: bearer <JWT>` 헤더가 필요합니다. (HTTP 헤더명은 대소문자를 구분하지 않으나 Swagger 보안 정의는 소문자 `authorization`입니다.)
  - **올바른 예**: `authorization: bearer <JWT 토큰>`
  - **401 오류 유발 패턴** (`/getting-started#practical-example` `[공식]`): `bearer` 누락, `{토큰}`/`<토큰>` 괄호 포함, `bearer` 뒤 공백 누락
- **응답 포맷** `[공식]`: `accept: application/json` (XML 미지원, `/faq`).
- **한글 캐릭터명 URL 인코딩** `[공식]` / `[커뮤니티 확인]`: 공식 `/usage-guide` 쿼리 예시에 퍼센트 인코딩(`%EB%A3%A8%ED%8E%98%EC%98%A8`)이 사용되며, 경로 파라미터 `{characterName}`에 한글·특수문자가 들어가므로 JavaScript/TypeScript에서는 반드시 `encodeURIComponent(characterName)`을 적용해야 합니다. `curl`에서도 `--get` 또는 사전 인코딩된 문자열을 사용하거나 `--url-query` 등을 활용합니다.
  - 캐릭터명 대소문자 구분 여부(영문 닉네임 등)는 공식 문서에 명시되지 않아 `[미확인]`입니다.
- **API 키 보관** `[공식]`: JWT는 별도 갱신 없이 무기한 유효하며, 브라우저 프론트엔드에 직접 노출하지 말고 **백엔드(BFF/프록시 서버)**에서 호출해야 합니다 (`/getting-started`).

### 1.2 재사용 가능한 공통 Fetch 래퍼 (TypeScript)

아래 베이스 클라이언트를 사용하면 이후 섹션의 모든 엔드포인트 함수를 일관되게 구현할 수 있습니다. `401` / `429` / `503` 처리와 "없는 캐릭터(`200 + null` 또는 `404`)" 방어 로직이 포함되어 있습니다.

```typescript
// lostark-client.ts
export const LOSTARK_API_BASE = 'https://developer-lostark.game.onstove.com';

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  /** 다음 할당량 초기화 시각 (UNIX epoch 초) */
  resetEpochSec: number | null;
}

export class LostArkApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly rateLimit?: RateLimitInfo,
  ) {
    super(message);
    this.name = 'LostArkApiError';
  }
}

export function extractRateLimit(headers: Headers): RateLimitInfo {
  const toNum = (v: string | null) => (v !== null && v !== '' ? Number(v) : null);
  return {
    limit: toNum(headers.get('X-RateLimit-Limit')),
    remaining: toNum(headers.get('X-RateLimit-Remaining')),
    resetEpochSec: toNum(headers.get('X-RateLimit-Reset')),
  };
}

/**
 * 로스트아크 Open API GET 요청 공통 함수
 * - 존재하지 않는 캐릭터에 대해 200 + null 또는 404가 오면 null 반환 [커뮤니티 확인]
 * - 429(Rate Limit) 시 X-RateLimit-Reset 기준으로 1회 자동 대기 후 재시도 [권장]
 */
export async function lostarkGet<T>(
  path: string,
  apiKey: string,
  options?: { retryOn429?: boolean; signal?: AbortSignal },
): Promise<{ data: T | null; rateLimit: RateLimitInfo }> {
  const url = `${LOSTARK_API_BASE}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `bearer ${apiKey}`,
    },
    signal: options?.signal,
  });

  const rateLimit = extractRateLimit(res.headers);

  if (res.status === 404) {
    return { data: null, rateLimit };
  }

  if (res.status === 429 && options?.retryOn429 !== false) {
    const nowSec = Math.floor(Date.now() / 1000);
    const waitMs = rateLimit.resetEpochSec
      ? Math.max(1000, (rateLimit.resetEpochSec - nowSec + 1) * 1000)
      : 5000;
    if (waitMs <= 65_000) {
      await new Promise((r) => setTimeout(r, waitMs));
      return lostarkGet<T>(path, apiKey, { ...options, retryOn429: false });
    }
    throw new LostArkApiError(429, 'Rate limit exceeded (분당 100회 초과)', rateLimit);
  }

  if (res.status === 401) {
    throw new LostArkApiError(401, 'Unauthorized: JWT 토큰 또는 bearer 형식을 확인하세요.', rateLimit);
  }
  if (res.status === 503) {
    throw new LostArkApiError(503, 'Service Unavailable: 로스트아크 점검 중이거나 일시 장애입니다.', rateLimit);
  }
  if (!res.ok) {
    throw new LostArkApiError(res.status, `Lost Ark API error: HTTP ${res.status}`, rateLimit);
  }

  // 공식 API는 없는 캐릭터 조회 시 HTTP 200 + body "null"을 반환할 수 있음 [커뮤니티 확인]
  const text = await res.text();
  if (!text || text.trim() === 'null') {
    return { data: null, rateLimit };
  }
  return { data: JSON.parse(text) as T, rateLimit };
}

/** 콤마가 포함된 숫자 문자열("1,760.00", "4,351.68")을 number로 변환 */
export function parseCommaNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
```

---

## 2. 통합 조회 마스터 가이드: `GET /armories/characters/{characterName}?filters=`

전투정보실(ARMORIES) 12개 엔드포인트 중 **가장 중요하고 실무에서 우선 고려해야 할 엔드포인트**는 V3.0.0에 추가된 통합 조회 엔드포인트입니다 `[공식]`.

### 2.1 `filters` 허용 값 목록 및 응답 키 1:1 매핑 `[공식]`

공식 Swagger(`/swagger-doc/endpoints/armories`)의 `filters` 설명:  
`Filtering the Data e.g., profiles+equipment+avatars+combat-skills+engravings+cards+gems+colosseums+collectibles+arkpassive+arkgrid`

**주의**: `filters` 값(소문자/케밥케이스), 개별 엔드포인트 경로, 그리고 통합 응답 JSON의 최상위 키(PascalCase, 일부 단수/복수 상이)가 **서로 다릅니다**. 아래 매핑 표를 그대로 참조하세요.

| `filters` 값 `[공식]` | 통합 응답 JSON 최상위 키 `[공식]` | 응답 타입 (`ArmoryProfileAll` 하위) `[공식]` | 대응 개별 엔드포인트 |
| --- | --- | --- | --- |
| `profiles` | `ArmoryProfile` | `ArmoryProfile \| null` | `.../profiles` |
| `equipment` | `ArmoryEquipment` | `ArmoryEquipment[] \| null` | `.../equipment` |
| `avatars` | `ArmoryAvatars` | `ArmoryAvatar[] \| null` | `.../avatars` |
| `combat-skills` | `ArmorySkills` | `ArmorySkill[] \| null` | `.../combat-skills` |
| `engravings` | `ArmoryEngraving` | `ArmoryEngraving \| null` | `.../engravings` |
| `cards` | `ArmoryCard` | `ArmoryCard \| null` | `.../cards` |
| `gems` | `ArmoryGem` | `ArmoryGem \| null` | `.../gems` |
| `colosseums` | `ColosseumInfo` | `ColosseumInfo \| null` | `.../colosseums` |
| `collectibles` | `Collectibles` | `Collectible[] \| null` | `.../collectibles` |
| `arkpassive` | `ArkPassive` | `ArkPassive \| null` | `.../arkpassive` |
| `arkgrid` | `ArkGrid` | `ArkGrid \| null` | `.../arkgrid` |

> **흔한 실수 주의** `[공식]`:
> - `combat-skills` → 응답 키는 `ArmoryCombatSkills`가 아니라 **`ArmorySkills`**입니다.
> - `avatars` → **`ArmoryAvatars`** (복수), `engravings` → **`ArmoryEngraving`** (단수), `cards` → **`ArmoryCard`** (단수), `gems` → **`ArmoryGem`** (단수).
> - `colosseums` → `ArmoryColosseums`가 아니라 **`ColosseumInfo`**입니다.

### 2.2 `filters` 조합 방법 (`+` 구분) 및 주의점

- **생략 시**: `?filters=` 없이 `GET /armories/characters/{characterName}`만 호출하면 11개 섹션 전체를 한 번에 반환합니다 `[공식]`, `[커뮤니티 확인]` (`artbiit/lostark-api-service` V9 샘플 `armories/characters.json` 기준 전체 응답 크기 약 468KB).
- **부분 선택 시**: 필요한 섹션명을 `+`로 이어 붙입니다 `[공식]`.
  - 예: 캐릭터 스펙 요약 화면(프로필 + 장비 + 각인 + 보석 + 카드 + 아크패시브 + 아크그리드):
    ```
    GET /armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0?filters=profiles+equipment+engravings+gems+cards+arkpassive+arkgrid
    ```
- **구분자 실수 주의**:
  - 쉼표(`,`)로 구분하는 것은 공식 스펙과 다릅니다. (일부 오픈소스 예: `DAN-MU-ZI/pyLoa`에서 `",".join(filters)`로 작성한 사례가 있으나 공식 Swagger 예시는 `+`입니다.)
  - **URL 인코딩 주의** `[미확인]` / `[권장]`: JavaScript에서 `new URLSearchParams({ filters: 'profiles+equipment' })`를 쓰면 `+`가 `%2B`로 인코딩됩니다. HTTP 쿼리 파서에서 리터럴 `+`는 공백(` `)으로 디코딩되고 `%2B`는 문자 `+`로 디코딩되는데, 로스트아크 서버가 리터럴 `+`와 `%2B` 중 둘 다 허용하는지 한쪽만 허용하는지는 공식 문서에 미기재(`[미확인]`)입니다. `filters` 값은 영문 소문자·하이픈(`-`)만 포함하므로, 쿼리스트링을 직접 조립(`?filters=${filters.join('+')}`)하면 Swagger 예시와 완전히 동일한 형태를 전송할 수 있습니다. (단, 실제 연동 초기 1회 테스트로 `+` vs `%2B` 동작 확인을 권장합니다.)
- **선택하지 않은 섹션의 응답 형태** `[미확인]`: `filters`로 일부 섹션만 요청했을 때 미선택 키가 JSON에서 `null`로 내려오는지 키 자체가 생략되는지는 공식 문서에 명시되지 않아 `[미확인]`입니다. TypeScript 타입에서는 `Partial<ArmoryProfileAll>` 또는 각 필드를 `T | null | undefined`로 선언해 양쪽 모두 안전하게 처리하세요 `[권장]`.

### 2.3 개별 엔드포인트 여러 번 vs 통합 1회 호출 — 요청 수 비교 (분당 100회 기준)

로스트아크 Open API의 기본 호출 제한은 **클라이언트당 분당 100회**입니다 `[공식]`.

| 조회 시나리오 | 개별 엔드포인트 호출 방식 | 통합 호출 방식 (`/armories/characters/{name}`) | 분당 최대 조회 가능 캐릭터 수 (100 req/min 기준) |
| --- | --- | --- | --- |
| **전투정보실 전체 화면** (11개 섹션) | 11회 요청 | **1회 요청** (`filters` 생략) | 개별: **9명/분** vs 통합: **100명/분** (**11배 절감**) |
| **핵심 스펙 탭** (프로필·장비·각인·보석·카드·아크패시브·아크그리드 = 7개) | 7회 요청 | **1회 요청** (`?filters=profiles+equipment+engravings+gems+cards+arkpassive+arkgrid`) | 개별: **14명/분** vs 통합: **100명/분** (**7배 절감**) |
| **전투정보실 전체 + 원정대 목록(`siblings`)** | 12회 요청 (11 + 1) | **2회 요청** (통합 1 + `siblings` 1) | 개별: **8명/분** vs 통합: **50명/분** (**6배 절감**) |
| **단일 섹션 갱신** (예: 수집품만 따로 조회) | **1회 요청** (`/collectibles`) | 1회 요청 (`?filters=collectibles`) | 동일 (**100명/분**) |

> **실무 선택 기준** `[권장]`:
> 1. **2개 이상 섹션이 필요하면 무조건 `GET /armories/characters/{name}`(+ `filters`)**을 쓰세요. 전체 468KB 응답도 현대 네트워크에서 수십 ms 수준이므로, 캐시를 전제로 **아예 `filters` 없이 1회 호출해 전체를 캐시해 두고** 탭 전환(장비 → 스킬 → 카드 → 수집품) 시 추가 API 호출을 0회로 만드는 전략이 가장 효율적입니다 (`artbiit/lostark-api-service` 캐싱 전략과 동일 패턴 `[커뮤니티 확인]`).
> 2. **1개 섹션만 가볍게 필요할 때**(예: 아이템 레벨·전투력만 빠르게 확인하는 봇 명령어, 장비만 스캔하는 배치)는 해당 개별 엔드포인트(`/profiles`, `/equipment`)를 사용하세요.

---

## 3. 엔드포인트별 실전 가이드 (총 13개)

> 모든 `curl` 예시에서 한글 캐릭터명 `"예시캐릭터"`의 UTF-8 퍼센트 인코딩은 `%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0`입니다.  
> 모든 응답 JSON은 실제 API V9.0.0 공개 샘플(`artbiit/lostark-api-service` `[커뮤니티 확인]`) 및 V10.0.0 공식 Swagger 스펙(`[공식]`)을 바탕으로 **가독성을 위해 일부 배열 요소와 긴 `Tooltip` 문자열을 축약한 샘플**입니다. 캐릭터명·길드명·영지명·서버명은 가상 값으로 바꿨습니다. 캐릭터명·길드명·영지명·서버명은 가상 값으로 바꿨습니다.

---

### 3.1 CHARACTERS (1개)

#### 3.1.1 `GET /characters/{characterName}/siblings`

- **언제 쓰는지 (용도)** `[공식]`: 특정 캐릭터명 하나로 **동일 계정(원정대)의 모든 서버·모든 캐릭터 목록**을 가져올 때 사용합니다. 주로 캐릭터 검색 화면의 **"보유 캐릭터(원정대) 목록" 탭**, 본캐/부캐 전환 드롭다운, 원정대 전체 골드/숙제 트래커 초기화에 씁니다.
- **요청 예시**:

```bash
# 캐릭터명 "예시캐릭터" → encodeURIComponent("예시캐릭터") = %EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0
curl -X GET \
  "https://developer-lostark.game.onstove.com/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/siblings" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: CharacterInfo]
export interface CharacterInfo {
  ServerName: string;
  CharacterName: string;
  CharacterLevel: number;
  CharacterClassName: string;
  /** 천 단위 콤마 포함 문자열 (예: "1,760.00") [커뮤니티 확인] */
  ItemAvgLevel: string;
}

export async function fetchSiblings(characterName: string, apiKey: string) {
  const encoded = encodeURIComponent(characterName.trim());
  return lostarkGet<CharacterInfo[]>(`/characters/${encoded}/siblings`, apiKey);
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/characters/siblings.json`):

```json
[
  {
    "ServerName": "예시서버",
    "CharacterName": "예시캐릭터",
    "CharacterLevel": 70,
    "CharacterClassName": "브레이커",
    "ItemAvgLevel": "1,760.00"
  },
  {
    "ServerName": "예시서버",
    "CharacterName": "예시부캐",
    "CharacterLevel": 70,
    "CharacterClassName": "환수사",
    "ItemAvgLevel": "1,736.67"
  }
]
```

- **화면에 쓸 핵심 필드**: `ServerName`(서버별 그룹핑), `CharacterName`(클릭 시 armories 전환 키), `CharacterClassName`(직업 아이콘/배지), `ItemAvgLevel`(정렬 및 표시), `CharacterLevel`(전투 레벨).
- **주의점**:
  1. **정렬되지 않은 순서**: 응답 배열은 아이템 레벨 내림차순으로 정렬되어 있지 않습니다 `[커뮤니티 확인]`. 화면에 보여줄 때 `parseCommaNumber(b.ItemAvgLevel) - parseCommaNumber(a.ItemAvgLevel)`로 직접 정렬하세요.
  2. **타 서버 캐릭터 포함**: 동일 계정 내 다른 서버 캐릭터도 함께 반환됩니다 `[공식]`. 보통 `ServerName`으로 그룹핑하거나 현재 조회 중인 캐릭터의 서버를 최상단에 배치합니다.
  3. **없는 캐릭터 처리**: `HTTP 200 + null` 또는 `404`가 올 수 있으므로 `data ?? []`로 방어하세요 `[커뮤니티 확인]`.
  4. **버전 변경**: 과거 존재하던 `ItemMaxLevel` 필드는 현재 `CharacterInfo` 스펙에 없고 `ItemAvgLevel`만 제공됩니다 `[공식]`.

---

### 3.2 ARMORIES (12개)

#### 3.2.1 `GET /armories/characters/{characterName}` (통합 조회)

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터 상세 페이지(전투정보실)를 렌더링할 때 **단 1회 호출**로 프로필·장비·각인·보석·카드·스킬·아바타·아크패시브·아크그리드·전적·수집품 전체(또는 `filters`로 지정한 일부)를 가져올 때 사용합니다.
- **요청 예시**:

```bash
# 전체 조회
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"

# 필요한 섹션만 선택 조회 (+ 구분)
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0?filters=profiles+equipment+engravings+gems+arkpassive+arkgrid" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
export type ArmoryFilter =
  | 'profiles'
  | 'equipment'
  | 'avatars'
  | 'combat-skills'
  | 'engravings'
  | 'cards'
  | 'gems'
  | 'colosseums'
  | 'collectibles'
  | 'arkpassive'
  | 'arkgrid';

// TypeScript 타입 [공식 Swagger: ArmoryProfileAll]
export interface ArmoryProfileAll {
  ArmoryProfile: ArmoryProfile | null;
  ArmoryEquipment: ArmoryEquipment[] | null;
  ArmoryAvatars: ArmoryAvatar[] | null;
  ArmorySkills: ArmorySkill[] | null;
  ArmoryEngraving: ArmoryEngraving | null;
  ArmoryCard: ArmoryCard | null;
  ArmoryGem: ArmoryGem | null;
  ArkPassive: ArkPassive | null;
  ArkGrid: ArkGrid | null;
  ColosseumInfo: ColosseumInfo | null;
  Collectibles: Collectible[] | null;
}

export async function fetchArmoryAll(
  characterName: string,
  apiKey: string,
  filters?: ArmoryFilter[],
) {
  const encoded = encodeURIComponent(characterName.trim());
  const query = filters && filters.length > 0 ? `?filters=${filters.join('+')}` : '';
  return lostarkGet<ArmoryProfileAll>(`/armories/characters/${encoded}${query}`, apiKey);
}
```

- **응답 예시 JSON (샘플, 축약)** `[공식]` / `[커뮤니티 확인]`:

```json
{
  "ArmoryProfile": { "CharacterName": "예시캐릭터", "ItemAvgLevel": "1,760.00", "...": "3.2.2 참고" },
  "ArmoryEquipment": [ { "Type": "무기", "Name": "+9 패룡 : 극", "...": "3.2.3 참고" } ],
  "ArmoryAvatars": [ { "Type": "무기 아바타", "...": "3.2.4 참고" } ],
  "ArmorySkills": [ { "Name": "권왕의 진격", "...": "3.2.5 참고" } ],
  "ArmoryEngraving": { "Engravings": null, "Effects": null, "ArkPassiveEffects": [ "..." ] },
  "ArmoryCard": { "Cards": [ "..." ], "Effects": [ "..." ] },
  "ArmoryGem": { "Gems": [ "..." ], "Effects": { "..." } },
  "ArkPassive": { "Title": "수라의 길", "IsArkPassive": true, "...": "3.2.11 참고" },
  "ArkGrid": { "Slots": [ "..." ], "Effects": null },
  "ColosseumInfo": { "Colosseums": [ "..." ] },
  "Collectibles": [ { "Type": "모코코 씨앗", "Point": 1462, "MaxPoint": 1474 } ]
}
```

- **화면에 쓸 핵심 필드**: 하위 섹션별 가이드를 참조하세요.
- **주의점**:
  1. **없는 캐릭터**: `HTTP 200`에 본문 전체가 `null`로 내려온 사례가 확인되어 있습니다 (`artbiit/lostark-api-service` 2026-08-26 실측 `[커뮤니티 확인]`). 반드시 `data?.ArmoryProfile` 존재 여부를 확인하세요.
  2. **개별 섹션이 `null`일 수 있음**: 캐릭터가 아바타/보석/카드를 미장착했거나 아크 패시브·아크 그리드가 미개방인 경우, 또는 `filters`에서 제외한 섹션은 해당 최상위 프로퍼티가 `null`로 올 수 있습니다 `[커뮤니티 확인]`.
  3. **응답 크기**: 전체 조회 시 약 400~500KB 수준의 JSON이 내려옵니다(주로 `Tooltip` 문자열 때문) `[커뮤니티 확인]`. 백엔드에서 필요한 필드만 정규화해 프론트엔드로 전달하면 트래픽을 크게 줄일 수 있습니다 `[권장]`.

---

#### 3.2.2 `GET /armories/characters/{characterName}/profiles`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터 상단 헤더 카드(프로필 이미지, 서버, 직업, 아이템 레벨, 전투력, 원정대 레벨, 칭호, 길드, 영지, 스킬 포인트, 명예 포인트, 꾸미기 배지)와 좌측 기본 특성(치명/특화/신속 등)·성향(지성/담력/매력/친절)을 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/profiles" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArmoryProfile, Stat, Tendency, Decoration]
export interface ArmoryStat {
  Type: string;      // "치명" | "특화" | "제압" | "신속" | "인내" | "숙련" | "최대 생명력" | "공격력" 등
  Value: string;     // 숫자 문자열 (예: "1851", 공격력/생명력 등은 큰 정수 문자열)
  Tooltip: string[]; // JSON 문자열이 아닌 HTML 조각 배열! [커뮤니티 확인]
}

export interface ArmoryTendency {
  Type: string;      // "지성" | "담력" | "매력" | "친절"
  Point: number;
  MaxPoint: number;
}

export interface ArmoryDecoration {
  Symbol: string | null;
  Emblems: string[] | null;
}

export interface ArmoryProfile {
  CharacterImage: string | null;
  ExpeditionLevel: number;
  TownLevel: number | null;       // Swagger default: "null" [공식]
  TownName: string | null;
  Title: string | null;
  GuildMemberGrade: string | null;
  GuildName: string | null;
  UsingSkillPoint: number;
  TotalSkillPoint: number;
  Stats: ArmoryStat[] | null;
  Tendencies: ArmoryTendency[] | null;
  CombatPower: string | null;     // V8.0.0 추가, 콤마 포함 문자열 (예: "4,351.68") [공식]/[커뮤니티 확인]
  Decorations: ArmoryDecoration | null; // V8.0.0 추가 [공식]
  HonorPoint: number;             // V9.0.0 추가 [공식]
  ServerName: string;
  CharacterName: string;
  CharacterLevel: number;
  CharacterClassName: string;
  ItemAvgLevel: string;           // 콤마 포함 문자열 (예: "1,760.00") [커뮤니티 확인]
}

export async function fetchProfile(characterName: string, apiKey: string) {
  return lostarkGet<ArmoryProfile>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/profiles`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/profiles.json`, V10.0.0 제거 필드 `PvpGradeName` 제외):

```json
{
  "CharacterImage": "https://img.lostark.co.kr/armory/.../character.png",
  "ExpeditionLevel": 353,
  "TownLevel": 70,
  "TownName": "예시영지",
  "Title": "심연의 대적자",
  "GuildMemberGrade": "길드장",
  "GuildName": "예시길드",
  "UsingSkillPoint": 482,
  "TotalSkillPoint": 483,
  "Stats": [
    {
      "Type": "치명",
      "Value": "1851",
      "Tooltip": [
        "<textformat indent='-21' leftMargin='10'><font> </font> 치명타 적중률이 <font color='#99ff99'>66.24%</font> 증가합니다.</textformat>"
      ]
    },
    { "Type": "특화", "Value": "72", "Tooltip": ["..."] }
  ],
  "Tendencies": [
    { "Type": "지성", "Point": 701, "MaxPoint": 1000 },
    { "Type": "담력", "Point": 713, "MaxPoint": 1000 }
  ],
  "CombatPower": "4,351.68",
  "Decorations": {
    "Symbol": "https://cdn-lostark.game.onstove.com/efui_iconatlas/playerinfodecoclassdeco_default/playerinfodecoclassdeco_default_3.png",
    "Emblems": [
      "https://cdn-lostark.game.onstove.com/efui_iconatlas/playerinfodecobrooch/playerinfodecobrooch_103.png"
    ]
  },
  "HonorPoint": 0,
  "ServerName": "예시서버",
  "CharacterName": "예시캐릭터",
  "CharacterLevel": 70,
  "CharacterClassName": "브레이커",
  "ItemAvgLevel": "1,760.00"
}
```

- **화면에 쓸 핵심 필드**:
  - 상단 요약: `CharacterName`, `ServerName`, `CharacterClassName`, `ItemAvgLevel`, `CombatPower`, `CharacterLevel`, `ExpeditionLevel`, `Title`, `GuildName`(`GuildMemberGrade`), `CharacterImage`, `HonorPoint`, `Decorations`
  - 특성/성향: `Stats`에서 `"치명"`, `"특화"`, `"신속"`, `"공격력"`, `"최대 생명력"` 추출, `Tendencies` 4종
- **주의점**:
  1. **버전별 제거 필드** `[공식]` (`/changelog`):
     - `ArkPassive` — **V5.0.0 제거** (전용 `/arkpassive` 엔드포인트로 분리)
     - `ItemMaxLevel` — **V8.0.0 제거** (`ItemAvgLevel`만 사용하세요! 구형 블로그/코드가 `ItemMaxLevel`을 참조해 `undefined` 버그가 자주 발생합니다)
     - `PvpGradeName` — **V10.0.0 제거**
  2. **콤마 포함 문자열**: `ItemAvgLevel`(`"1,760.00"`), `CombatPower`(`"4,351.68"`)는 `number`가 아니라 `string`입니다 `[공식]` / `[커뮤니티 확인]`. `Number("1,760.00")`은 `NaN`이 되므로 반드시 쉼표를 제거(`parseCommaNumber`)한 뒤 비교·정렬하세요.
  3. **`null` 가능 필드**: `TownLevel`(공식 Swagger `default: "null"`), `TownName`, `Title`, `GuildName`, `GuildMemberGrade`, `CharacterImage`(일부 저레벨·미갱신 캐릭터), `Decorations`는 영지 미개방/길드 미가입/칭호 미착용 시 `null` 또는 빈 문자열이 될 수 있습니다 `[공식]` / `[커뮤니티 확인]`.
  4. **`Stats[].Tooltip` 타입**: 다른 엔드포인트의 `Tooltip: string`(JSON 문자열)과 달리 **`string[]`(HTML 조각 배열)**입니다 `[공식]` / `[커뮤니티 확인]`. `JSON.parse()`를 호출하면 에러가 납니다.

---

#### 3.2.3 `GET /armories/characters/{characterName}/equipment`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터가 장착 중인 **무기, 방어구 5부위(투구/어깨/상의/하의/장갑), 장신구 5부위(목걸이/귀걸이×2/반지×2), 어빌리티 스톤, 팔찌, 나침반, 부적, 문장**을 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/equipment" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArmoryEquipment]
export interface ArmoryEquipment {
  /** 예: "무기" | "투구" | "상의" | "하의" | "장갑" | "어깨" | "목걸이" | "귀걸이" | "반지" | "어빌리티 스톤" | "팔찌" | "나침반" | "부적" | "문장" */
  Type: string;
  /** 무기/방어구는 "+25 신념의 업화 머리장식"처럼 강화 단계 접두사 포함 [커뮤니티 확인] */
  Name: string;
  Icon: string;
  /** 예: "일반" | "고급" | "희귀" | "영웅" | "전설" | "유물" | "고대" | "에스더" */
  Grade: string;
  /** JSON 직렬화된 문자열 (내부에 HTML 태그 포함) [커뮤니티 확인] */
  Tooltip: string;
}

export async function fetchEquipment(characterName: string, apiKey: string) {
  return lostarkGet<ArmoryEquipment[]>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/equipment`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/equipment.json`):

```json
[
  {
    "Type": "무기",
    "Name": "+9 패룡 : 극",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/ifm_item/ifm_item_01_217.png",
    "Grade": "에스더",
    "Tooltip": "{\"Element_000\":{\"type\":\"NameTagBox\",\"value\":\"...\"},\"Element_001\":{\"type\":\"ItemTitle\",\"value\":{\"qualityValue\":100,\"leftStr2\":\"<FONT SIZE='14'>아이템 레벨 1785</FONT>\"}},\"Element_005\":{\"type\":\"SingleTextBox\",\"value\":\"<FONT SIZE='14'><FONT COLOR='#A8EA6C'>[상급 재련]</FONT> <FONT COLOR='#FFD200'>40</FONT>단계</FONT>\"}}"
  },
  {
    "Type": "목걸이",
    "Name": "도래한 결전의 목걸이",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/acc/acc_217.png",
    "Grade": "고대",
    "Tooltip": "{\"Element_001\":{\"type\":\"ItemTitle\",\"value\":{\"qualityValue\":94,\"leftStr2\":\"<FONT SIZE='14'>아이템 티어 4</FONT>\"}},\"Element_006\":{\"type\":\"ItemPartBox\",\"value\":{\"Element_000\":\"<FONT COLOR='#A9D0F5'>연마 효과</FONT>\",\"Element_001\":\"...\"}}}"
  },
  {
    "Type": "팔찌",
    "Name": "찬란한 구원자의 팔찌",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/acc/acc_324.png",
    "Grade": "고대",
    "Tooltip": "{\"Element_001\":{\"type\":\"ItemTitle\",\"value\":{\"qualityValue\":-1}},\"Element_005\":{\"type\":\"ItemPartBox\",\"value\":{\"Element_000\":\"<FONT COLOR='#A9D0F5'>팔찌 효과</FONT>\",\"Element_001\":\"...\"}}}"
  }
]
```

- **화면에 쓸 핵심 필드**:
  - 기본 표시: `Type`, `Name`, `Icon`, `Grade` (등급별 배경색 매핑)
  - `Tooltip` 파싱 필수 항목 (상세 파싱 코드는 **4장** 참고): 품질(`qualityValue`), 일반 재련 수치, 상급 재련 단계, 초월/엘릭서, 악세서리 연마 효과, 팔찌 옵션, 어빌리티 스톤 세공 각인/감소, 아크 패시브 포인트 효과(진화/깨달음/도약).
- **주의점**:
  1. **동일 `Type` 복수 존재**: `귀걸이` 2개, `반지` 2개가 같은 `Type` 문자열로 내려옵니다 `[커뮤니티 확인]`. React `key`로 `item.Type`만 쓰면 충돌하므로 `${item.Type}-${index}`를 사용하세요.
  2. **품질 없음 표시 (`-1`)**: 팔찌, 어빌리티 스톤, 나침반, 부적 등은 품질이 없으며 `ItemTitle.value.qualityValue`가 **`-1`**로 내려옵니다 `[커뮤니티 확인]`. `qualityValue >= 0`일 때만 품질 바를 렌더링하세요.
  3. **장비 미장착 시**: 장비가 하나도 없거나 미존재 캐릭터인 경우 `null` 또는 `[]`가 올 수 있습니다 `[커뮤니티 확인]`.
  4. **버전 참고**: 팔찌 데이터는 V1.0.1에서 추가되었습니다 `[공식]`.

---

#### 3.2.4 `GET /armories/characters/{characterName}/avatars`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터가 착용 중인 아바타(성능용 내부 아바타 + 외형용 덧입기 아바타)와 아바타 성향/기본 스탯 보너스, 세트 여부를 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/avatars" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArmoryAvatar]
export interface ArmoryAvatar {
  /** 예: "무기 아바타" | "머리 아바타" | "상의 아바타" | "하의 아바타" | "얼굴1 아바타" | "악기 아바타" | "이동 효과" 등 */
  Type: string;
  Name: string;
  Icon: string;
  /** 예: "영웅" | "전설" */
  Grade: string;
  /** 상하의 한벌(세트) 아바타 여부 */
  IsSet: boolean;
  /** true = 성능용(내부) 아바타, false = 외형(덧입기) 아바타 [공식]/[커뮤니티 확인] */
  IsInner: boolean;
  Tooltip: string; // JSON 문자열
}

export async function fetchAvatars(characterName: string, apiKey: string) {
  return lostarkGet<ArmoryAvatar[]>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/avatars`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/avatars.json`):

```json
[
  {
    "Type": "무기 아바타",
    "Name": "유연한 영원 헤비 건틀릿",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/ifm_item/ifm_item_01_218.png",
    "Grade": "전설",
    "IsSet": false,
    "IsInner": true,
    "Tooltip": "{\"Element_000\":{\"type\":\"NameTagBox\",\"value\":\"...\"}}"
  },
  {
    "Type": "머리 아바타",
    "Name": "유연한 영원 머리",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/ifm_item/ifm_item_01_220.png",
    "Grade": "전설",
    "IsSet": false,
    "IsInner": true,
    "Tooltip": "{\"Element_000\":{\"type\":\"NameTagBox\",\"value\":\"...\"}}"
  }
]
```

- **화면에 쓸 핵심 필드**: `Type`, `Name`, `Icon`, `Grade`, `IsInner`(성능용 vs 덧입기 구분 배지), `IsSet`(한벌 표시).
- **주의점**:
  1. **같은 부위에 최대 2개**: 예를 들어 `"무기 아바타"`가 `IsInner: true`(전설 성능용)와 `IsInner: false`(외형 덧입기) 2개 동시에 내려올 수 있습니다 `[커뮤니티 확인]`. 스펙 계산(전설 아바타 착용 여부 등)에서는 `IsInner === true`만 필터링하거나 부위별로 분리해 표시하세요.
  2. **아바타 미착용 시**: 응답이 `null` 또는 빈 배열 `[]`일 수 있습니다 (`DAN-MU-ZI/pyLoa` 방어 코드 확인 `[커뮤니티 확인]`).

---

#### 3.2.5 `GET /armories/characters/{characterName}/combat-skills`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터의 전투 스킬 트리(스킬 레벨, 선택한 트라이포드, 장착 스킬 룬, 각성기/초각성 스킬 구분)를 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/combat-skills" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArmorySkill, SkillTripod, SkillRune]
export interface SkillTripod {
  Tier: number;       // 0 = 1트라이포드, 1 = 2트라이포드, 2 = 3트라이포드 [커뮤니티 확인]
  Slot: number;       // 1, 2, 3
  Name: string;
  Icon: string;
  IsSelected: boolean;
  Tooltip: string;    // HTML 조각 문자열
  // ※ Level 필드는 V8.0.0에서 제거됨 [공식]
}

export interface SkillRune {
  Name: string;       // 예: "속행", "질풍", "단죄", "심판"
  Icon: string;
  Grade: string;      // 예: "영웅" | "전설" | "유물"
  Tooltip: string;    // JSON 문자열
}

export interface ArmorySkill {
  Name: string;
  Icon: string;
  Level: number;      // 1 ~ 14 등
  Type: string;       // 예: "일반" | "콤보" | "차지" | "홀딩" | "지점" 등
  /** V5.0.0 추가 [공식]. 샘플 확인값: 0=일반 스킬, 1=각성기, 100=초각성 스킬, 101=초각성기 [커뮤니티 확인] */
  SkillType: number;
  Tripods: SkillTripod[] | null;
  Rune: SkillRune | null; // 룬 미장착 스킬은 null [커뮤니티 확인]
  Tooltip: string;    // JSON 문자열
}

export async function fetchCombatSkills(characterName: string, apiKey: string) {
  return lostarkGet<ArmorySkill[]>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/combat-skills`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/combat-skills.json`):

```json
[
  {
    "Name": "권왕의 진격",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/ifm_skill/ifm_skill_01_1.png",
    "Level": 10,
    "Type": "일반",
    "SkillType": 0,
    "Tripods": [
      { "Tier": 0, "Slot": 1, "Name": "투지", "Icon": "...", "IsSelected": false, "Tooltip": "..." },
      { "Tier": 0, "Slot": 2, "Name": "강인함", "Icon": "...", "IsSelected": true, "Tooltip": "..." }
    ],
    "Rune": {
      "Name": "속행",
      "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_7_202.png",
      "Grade": "전설",
      "Tooltip": "{\"Element_000\": ...}"
    },
    "Tooltip": "{\"Element_000\": ...}"
  }
]
```

- **화면에 쓸 핵심 필드**:
  - 채용 스킬 필터링 `[권장]`: 모든 습득 스킬(20개 이상)이 반환되므로 보통 `skill.Level > 1 || skill.Rune !== null || skill.SkillType !== 0` 조건으로 실제 사용 스킬만 추려 표시합니다.
  - 선택 트라이포드: `(skill.Tripods ?? []).filter(t => t.IsSelected)` (보통 `Tier`별 `Slot` 번호 조합 예: `2-1-2`로 표기).
  - 장착 룬: `skill.Rune?.Name`, `skill.Rune?.Grade`, `skill.Rune?.Icon`.
- **주의점**:
  1. **버전별 제거/추가 필드** `[공식]`:
     - `Tripods[].Level` — **V8.0.0 제거** (트라이포드 레벨 시스템 개편 반영). 구형 타입 정의에 `Level: number`가 남아있을 수 있으니 제거하세요.
     - `SkillType` — **V5.0.0 추가** (`0`: 일반, `1`: 각성기, `100`: 초각성 스킬, `101`: 초각성기 `[커뮤니티 확인]`).
  2. **`Rune`과 `Tripods`의 `null` 가능성**: 룬을 끼지 않은 스킬은 `Rune: null`이며, 각성기 등 트라이포드가 없는 스킬은 `Tripods`가 빈 배열이거나 `null`일 수 있습니다 `[커뮤니티 확인]`.

---

#### 3.2.6 `GET /armories/characters/{characterName}/engravings`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터의 활성 각인 목록(시즌3 아크 패시브 각인 또는 구 각인 시스템)과 어빌리티 스톤 세공 보너스 단계를 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/engravings" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArmoryEngraving, Engraving, EngravingEffect, ArkPassiveEffect]
export interface LegacyEngravingSlot {
  Slot: number;
  Name: string;
  Icon: string;
  Tooltip: string;
}

export interface LegacyEngravingEffect {
  Icon: string;
  Name: string;        // 예: "원한 Lv. 3"
  Description: string;
}

export interface ArkPassiveEngravingEffect {
  /** 어빌리티 스톤 세공 레벨 (미적용 시 null, Swagger default: "null") [공식] */
  AbilityStoneLevel: number | null;
  /** 각인서 등급 (예: "영웅" | "전설" | "유물") [커뮤니티 확인] */
  Grade: string;
  /** 현재 각인 단계 (0 ~ 4) [커뮤니티 확인] */
  Level: number;
  Name: string;        // 예: "아드레날린", "원한"
  Description: string; // HTML <FONT> 태그 포함 설명 문자열 [커뮤니티 확인]
}

export interface ArmoryEngraving {
  /** 아크 패시브 활성 시 null [커뮤니티 확인] */
  Engravings: LegacyEngravingSlot[] | null;
  /** 아크 패시브 활성 시 null [커뮤니티 확인] */
  Effects: LegacyEngravingEffect[] | null;
  /** V4.0.0 추가 [공식]. 아크 패시브 활성 캐릭터는 여기에 채워짐 [커뮤니티 확인] */
  ArkPassiveEffects: ArkPassiveEngravingEffect[] | null;
}

export async function fetchEngravings(characterName: string, apiKey: string) {
  return lostarkGet<ArmoryEngraving>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/engravings`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 아크 패시브 활성 캐릭터)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/engravings.json`):

```json
{
  "Engravings": null,
  "Effects": null,
  "ArkPassiveEffects": [
    {
      "AbilityStoneLevel": 4,
      "Grade": "유물",
      "Level": 4,
      "Name": "아드레날린",
      "Description": "이동기 및 기본공격을 제외한 스킬 사용 후 <FONT COLOR='#ffff99'>6</FONT>초 동안 공격력이 <FONT COLOR='#99ff99'>1.85%</FONT> 증가하며..."
    },
    {
      "AbilityStoneLevel": null,
      "Grade": "유물",
      "Level": 4,
      "Name": "예리한 둔기",
      "Description": "치명타 피해량이 <FONT COLOR='#99ff99'>56.00%</FONT> 증가하지만..."
    }
  ]
}
```

- **화면에 쓸 핵심 필드**:
  - 시즌3(아크 패시브 활성) 캐릭터: `ArkPassiveEffects`의 `Name`, `Grade`(유물/전설 배지 색상), `Level`, `AbilityStoneLevel`(스톤 보너스 표시, `null`이 아닐 때만), `Description`(HTML 태그 정제 후 툴팁 표시).
  - 구 시스템(아크 패시브 미적용 저레벨 캐릭터): `Effects`의 `Name`, `Icon`, `Description`.
- **주의점**:
  1. **이원화 분기 필수** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `armories-normalizer.ts`): 아크 패시브가 켜진 캐릭터는 `Engravings`와 `Effects`가 **`null`**로 오고 `ArkPassiveEffects`만 채워집니다. 반대로 미적용 캐릭터는 `ArkPassiveEffects`가 `null`입니다. 반드시 `ArkPassiveEffects?.length ? ... : Effects ?? []`로 분기하세요.
  2. **`ArkPassiveEffects`에는 `Icon` 필드가 없음** `[공식]`: 아크 패시브 각인 아이콘이 필요하면 각인명 기준 정적 매핑 테이블을 두어야 합니다.
  3. **`AbilityStoneLevel` nullable**: 스톤에 해당 각인이 없으면 `null`입니다 `[공식]`.
  4. **각인 미장착 시**: 응답 객체 자체가 `null`일 수 있습니다 `[커뮤니티 확인]`.

---

#### 3.2.7 `GET /armories/characters/{characterName}/cards`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터가 장착 중인 카드 6장(각성 단계 포함)과 현재 활성화된 카드 세트 효과(예: 세상을 구하는 빛 30각, 굳센 대지의 숨결 30각 등)를 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/cards" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArmoryCard, Card, CardEffect, Effect]
export interface Card {
  Slot: number;       // 0 ~ 5
  Name: string;
  Icon: string;
  AwakeCount: number; // 현재 각성 수 (0 ~ 5)
  AwakeTotal: number; // 최대 각성 수 (보통 5)
  Grade: string;      // 예: "전설" | "영웅" | "희귀" 등
  Tooltip: string;    // JSON 문자열
}

export interface CardSetEffectItem {
  Name: string;        // 예: "굳센 대지의 숨결 6세트 (30각성합계)"
  Description: string; // 예: "토속성 피해 +4.00%"
}

export interface CardEffect {
  Index: number;
  CardSlots: number[]; // 이 세트 효과에 기여한 카드 Slot 번호 배열 (예: [0,1,2,3,4,5])
  Items: CardSetEffectItem[];
}

export interface ArmoryCard {
  Cards: Card[] | null;
  Effects: CardEffect[] | null;
}

export async function fetchCards(characterName: string, apiKey: string) {
  return lostarkGet<ArmoryCard>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/cards`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/cards.json`):

```json
{
  "Cards": [
    {
      "Slot": 0,
      "Name": "에버그레이스",
      "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/card/card_01_146.png",
      "AwakeCount": 5,
      "AwakeTotal": 5,
      "Grade": "전설",
      "Tooltip": "{\"Element_000\": ...}"
    },
    {
      "Slot": 1,
      "Name": "가디언 루",
      "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/card/card_01_147.png",
      "AwakeCount": 5,
      "AwakeTotal": 5,
      "Grade": "전설",
      "Tooltip": "{\"Element_000\": ...}"
    }
  ],
  "Effects": [
    {
      "Index": 0,
      "CardSlots": [0, 1, 2, 3, 4, 5],
      "Items": [
        { "Name": "굳센 대지의 숨결 6세트 (18각성합계)", "Description": "토속성 피해 +7.00%" },
        { "Name": "굳센 대지의 숨결 6세트 (30각성합계)", "Description": "토속성 피해 +4.00%" }
      ]
    }
  ]
}
```

- **화면에 쓸 핵심 필드**:
  - 카드 요약 배지: `Effects[].Items`의 **마지막 항목 `Name`**을 쓰면 대표 세트 + 최고 각성 단계(예: `"굳센 대지의 숨결 6세트 (30각성합계)"`)를 한 줄로 요약할 수 있습니다 `[권장]`.
  - 개별 카드: `Name`, `Icon`, `Grade`, `AwakeCount`/`AwakeTotal`(별 아이콘 5개 렌더링).
- **주의점**:
  1. **카드 미장착 시**: 전체 응답이 `null`이거나 `Cards`/`Effects`가 빈 배열·`null`일 수 있습니다 `[커뮤니티 확인]`.
  2. **복수 세트 동시 활성화**: 2세트 + 4세트 조합(예: 남바절 + 알고보면 등)에서는 `Effects` 배열에 2개 이상의 `CardEffect` 객체가 들어옵니다. `Effects[0]`만 읽지 말고 배열 전체를 순회하세요.

---

#### 3.2.8 `GET /armories/characters/{characterName}/gems`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터가 장착 중인 보석(최대 11개: 3티어 멸화/홍염, 4티어 겁화/작열/광휘 등)과 각 보석이 적용되는 스킬명·피해/쿨감 수치·기본 공격력 추가 옵션을 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/gems" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArmoryGem, Gem, ArmoryGemEffect, GemEffect]
export interface Gem {
  Slot: number;   // 0 ~ 10 (Effects.Skills[].GemSlot과 조인 키!)
  /** 주의: HTML 태그 포함 문자열! 예: "<P ALIGN='CENTER'><FONT COLOR='#E3C7A1'>10레벨 광휘의 보석</FONT></P>" [커뮤니티 확인] */
  Name: string;
  Icon: string;
  Level: number;  // 1 ~ 10
  Grade: string;  // 예: "영웅" | "전설" | "유물" | "고대"
  Tooltip: string; // JSON 문자열
}

export interface GemSkillEffect {
  GemSlot: number;       // Gems[].Slot과 매칭되는 슬롯 번호
  Name: string;          // 적용 스킬명 (예: "수라결 기본 공격")
  Description: string[]; // 예: ["피해 44.00% 증가"] (V4.0.0에서 string[] 구조) [공식]/[커뮤니티 확인]
  Option: string;        // 예: "기본 공격력 1.20% 증가" (4티어 보석 추가 옵션) [커뮤니티 확인]
  Icon: string;          // 스킬 아이콘 URL
  Tooltip: string | null; // 실샘플에서 null 확인 [커뮤니티 확인]
}

export interface ArmoryGemEffect {
  Description: string | null;
  Skills: GemSkillEffect[] | null;
}

export interface ArmoryGem {
  Gems: Gem[] | null;
  /** V4.0.0에서 배열 → 객체({ Description, Skills })로 구조 변경됨 [공식] */
  Effects: ArmoryGemEffect | null;
}

export async function fetchGems(characterName: string, apiKey: string) {
  return lostarkGet<ArmoryGem>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/gems`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/gems.json`):

```json
{
  "Gems": [
    {
      "Slot": 10,
      "Name": "<P ALIGN='CENTER'><FONT COLOR='#E3C7A1'>10레벨 광휘의 보석</FONT></P>",
      "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_13_55.png",
      "Level": 10,
      "Grade": "고대",
      "Tooltip": "{\"Element_000\": ...}"
    }
  ],
  "Effects": {
    "Description": "",
    "Skills": [
      {
        "GemSlot": 10,
        "Name": "수라결 기본 공격",
        "Description": ["피해 44.00% 증가"],
        "Option": "기본 공격력 1.20% 증가",
        "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/ifm_skill/ifm_skill_01_27.png",
        "Tooltip": null
      }
    ]
  }
}
```

- **화면에 쓸 핵심 필드**:
  - 보석 ↔ 스킬 조인: `Gems`를 `Slot` 기준 `Map<number, Gem>`으로 인덱싱하고, `Effects?.Skills`의 `GemSlot`과 매칭하면 **"10겁 / 10작 / 10광 — [스킬명] 피해 44.00% 증가"** UI를 바로 만들 수 있습니다.
- **주의점**:
  1. **`Gems[].Name`에 HTML 태그가 들어 있음** `[커뮤니티 확인]`: 다른 엔드포인트의 `Name`은 평문인데, 보석 `Name`은 `<P ALIGN='CENTER'><FONT COLOR='#E3C7A1'>10레벨 광휘의 보석</FONT></P>`처럼 HTML 태그가 감싸져 내려옵니다! 출력 전 반드시 태그를 제거하세요 (`name.replace(/<[^>]*>/g, '').trim()`).
  2. **V4.0.0 Breaking Change** `[공식]`: 과거 `Effects`는 배열이었으나 V4.0.0부터 `{ Description: string, Skills: GemEffect[] }` 객체로 바뀌었습니다. 구형 블로그/오픈소스(`Cong0327/LA_Discord_Bot` 등)의 `Effects: GemEffect[]` 타입은 현재 스펙과 맞지 않으므로 주의하세요.
  3. **`Effects.Skills[].Tooltip`은 `null` 가능** `[커뮤니티 확인]`.
  4. **보석 미장착 시**: 전체 응답이 `null`이거나 `Gems: null`일 수 있습니다 `[커뮤니티 확인]`.

---

#### 3.2.9 `GET /armories/characters/{characterName}/colosseums`

- **언제 쓰는지 (용도)** `[공식]`: 캐릭터의 증명의 전장(PvP) 시즌별·모드별(경쟁전, 섬멸전, 대장전, 협동전, 1인 섬멸전 일반/랭크) 전적 탭을 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/colosseums" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ColosseumInfo, Colosseum, Aggregation*]
export interface AggregationBase {
  PlayCount: number;
  VictoryCount: number;
  LoseCount: number;
  TieCount: number;
  KillCount: number;
  AceCount: number;
  DeathCount: number;
}

export interface AggregationCompetitive extends AggregationBase {
  Rank: number;
  RankName: string;
  RankIcon: string;
  RankLastMmr: number;
}

export interface AggregationTeamDeathMatch extends AggregationBase {
  AssistCount: number;
}

export interface AggregationElimination extends AggregationBase {
  FirstWinCount: number;
  SecondWinCount: number;
  ThirdWinCount: number;
  FirstPlayCount: number;
  SecondPlayCount: number;
  ThirdPlayCount: number;
  AllKillCount: number;
}

export interface AggregationOneDeathmatch {
  KillCount: number;
  DeathCount: number;
  AllKillCount: number;
  OutDamage: number; // Swagger int64
  InDamage: number;  // Swagger int64
  FirstWinCount: number;
  SecondWinCount: number;
  ThirdWinCount: number;
  FirstPlayCount: number;
  SecondPlayCount: number;
  ThirdPlayCount: number;
}

export interface ColosseumSeason {
  SeasonName: string;
  Competitive: AggregationCompetitive | null;
  TeamDeathmatch: AggregationTeamDeathMatch | null;
  TeamElimination: AggregationElimination | null;
  CoOpBattle: AggregationBase | null;
  OneDeathmatch: AggregationOneDeathmatch | null;     // V5.1.0 추가 [공식]
  OneDeathmatchRank: AggregationOneDeathmatch | null; // [공식]
}

export interface ColosseumInfo {
  // ※ Rank, PreRank, Exp 필드는 V10.0.0에서 제거됨 [공식]
  Colosseums: ColosseumSeason[] | null;
}

export async function fetchColosseums(characterName: string, apiKey: string) {
  return lostarkGet<ColosseumInfo>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/colosseums`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, V10.0.0 스펙 기준)** `[공식]` / `[커뮤니티 확인]` (`artbiit/lostark-api-service` `colosseums.json`에서 V10.0.0 제거 필드 `Rank`/`PreRank`/`Exp` 제외):

```json
{
  "Colosseums": [
    {
      "SeasonName": "프리 시즌",
      "Competitive": null,
      "TeamDeathmatch": null,
      "TeamElimination": null,
      "CoOpBattle": null,
      "OneDeathmatch": null,
      "OneDeathmatchRank": null
    }
  ]
}
```

- **화면에 쓸 핵심 필드**: `SeasonName`, 그리고 각 모드가 `!== null`인 시즌만 필터링해 `PlayCount`, `VictoryCount`/`LoseCount`(승률 계산), 경쟁전 `RankName`/`RankLastMmr` 표시.
- **주의점**:
  1. **버전별 제거 필드** `[공식]` (`/changelog`):
     - `Deathmatch` — **V5.1.0 제거** (`OneDeathmatch`로 대체)
     - `Rank`, `PreRank`, `Exp` — **V10.0.0 제거** (V9 샘플에는 존재하나 V10 Swagger에서 완전 삭제됨. 이 필드에 의존하는 코드는 수정 필요)
  2. **모든 모드가 `null` 가능** `[커뮤니티 확인]`: 해당 시즌에 플레이하지 않은 모드는 빈 객체가 아니라 `null`로 내려옵니다.

---

#### 3.2.10 `GET /armories/characters/{characterName}/collectibles`

- **언제 쓰는지 (용도)** `[공식]`: 내실(수집형 포인트 — 모코코 씨앗, 섬의 마음, 위대한 미술품, 거인의 심장, 이그네아의 징표, 항해 모험물, 세계수의 잎, 오르페우스의 별, 기억의 오르골, 크림스네일의 해도 등) 진행률 및 세부 획득 내역을 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/collectibles" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: Collectible, CollectiblePoint]
export interface CollectiblePoint {
  PointName: string; // 예: "아르테미스", "유디아"
  Point: number;
  MaxPoint: number;
}

export interface Collectible {
  Type: string;      // 예: "모코코 씨앗", "섬의 마음", "거인의 심장" 등
  Icon: string;
  Point: number;     // 현재 획득 수
  MaxPoint: number;  // 전체 최대 수
  CollectiblePoints: CollectiblePoint[];
}

export async function fetchCollectibles(characterName: string, apiKey: string) {
  return lostarkGet<Collectible[]>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/collectibles`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/collectibles.json`):

```json
[
  {
    "Type": "모코코 씨앗",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_2_9.png",
    "Point": 1462,
    "MaxPoint": 1474,
    "CollectiblePoints": [
      { "PointName": "아르테미스", "Point": 51, "MaxPoint": 51 },
      { "PointName": "유디아", "Point": 37, "MaxPoint": 37 }
    ]
  },
  {
    "Type": "섬의 마음",
    "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_6_100.png",
    "Point": 103,
    "MaxPoint": 104,
    "CollectiblePoints": [
      { "PointName": "외로운 섬 오페르", "Point": 1, "MaxPoint": 1 }
    ]
  }
]
```

- **화면에 쓸 핵심 필드**: 요약 카드는 `Type`, `Icon`, `Point`, `MaxPoint` + 달성률(`Math.round((Point / MaxPoint) * 100)`), 상세 아코디언은 `CollectiblePoints` 중 미획득(`p.Point < p.MaxPoint`) 필터링 기능 제공 `[권장]`.
- **주의점**:
  1. **원정대 공유 데이터**: 수집형 포인트는 게임 구조상 원정대 공유 데이터이므로, 같은 원정대의 다른 캐릭터로 전환할 때 매번 다시 호출할 필요 없이 원정대 단위로 재사용할 수 있습니다 `[권장]`.
  2. **0 나눗셈 방어**: `MaxPoint > 0` 체크 후 퍼센트를 계산하세요.

---

#### 3.2.11 `GET /armories/characters/{characterName}/arkpassive`

- **언제 쓰는지 (용도)** `[공식]`: V5.0.0에서 `/profiles`로부터 분리 신설된 엔드포인트로, 시즌3 핵심 성장 시스템인 **아크 패시브 활성화 여부, 직업 타이틀(깨달음 빌드명), 진화/깨달음/도약 포인트 및 랭크·레벨, 활성 노드 목록**을 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/arkpassive" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArkPassive, ArkPassivePoint, ArkPassiveEffectSkill]
export interface ArkPassivePoint {
  Name: string;        // "진화" | "깨달음" | "도약" [커뮤니티 확인]
  Value: number;       // 예: 120, 101, 70
  /** 주의: JSON 문자열이 아닌 HTML 조각! [커뮤니티 확인] */
  Tooltip: string;
  /** V8.0.0 추가 [공식]. 예: "6랭크 30레벨" [커뮤니티 확인] */
  Description: string;
}

export interface ArkPassiveEffectSkill {
  Name: string;        // "진화" | "깨달음" | "도약"
  /** HTML 태그 포함 문자열. 예: "<FONT color='#83E9FF'>깨달음</FONT> 1티어 <FONT color='#83E9FF'>수라의 길 Lv.1</FONT>" */
  Description: string;
  Icon: string;
  /** ⚠️ 대소문자 주의! 다른 필드는 Tooltip이지만 여기는 대문자 T인 'ToolTip' [공식] (JSON 문자열) */
  ToolTip: string;
}

export interface ArkPassive {
  Title: string | null;     // 예: "수라의 길" (직업 깨달음 타이틀)
  IsArkPassive: boolean;
  Points: ArkPassivePoint[] | null;
  Effects: ArkPassiveEffectSkill[] | null;
}

export async function fetchArkPassive(characterName: string, apiKey: string) {
  return lostarkGet<ArkPassive>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/arkpassive`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/characters.json` 내 `ArkPassive`):

```json
{
  "Title": "수라의 길",
  "IsArkPassive": true,
  "Points": [
    {
      "Name": "진화",
      "Value": 120,
      "Tooltip": "<img src='emoticon_ark_evolution' ...></img><FONT COLOR='#ffd200'> 진화 아크 패시브 포인트</font><br>...",
      "Description": "6랭크 30레벨"
    },
    { "Name": "깨달음", "Value": 101, "Tooltip": "...", "Description": "6랭크 30레벨" },
    { "Name": "도약", "Value": 70, "Tooltip": "...", "Description": "2랭크 70레벨" }
  ],
  "Effects": [
    {
      "Name": "깨달음",
      "Description": "<FONT color='#83E9FF'>깨달음</FONT> 1티어 <FONT color='#83E9FF'>수라의 길 Lv.1</FONT>",
      "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/ark_passive_ifm/ark_passive_ifm_4.png",
      "ToolTip": "{\"Element_000\":{\"type\":\"NameTagBox\",\"value\":\"수라의 길\"},\"Element_001\":{\"type\":\"CommonSkillTitle\",...}}"
    }
  ]
}
```

- **화면에 쓸 핵심 필드**:
  - 상단 배지: `IsArkPassive`, `Title`(직업 각인/빌드명), `Points` 3종의 `Name`/`Value`/`Description`(예: `진화 120 · 6랭크 30레벨`).
  - 노드 트리: `Effects`를 `Name`("진화"/"깨달음"/"도약")별로 그룹핑해 `Icon` + `Description`(HTML 태그 제거) + `ToolTip`(JSON 파싱) 표시.
- **주의점**:
  1. **⚠️ 대소문자 함정 (`Tooltip` vs `ToolTip`)** `[공식]`: 같은 `ArkPassive` 응답 안에서 **`Points[].Tooltip`**은 소문자 `t`, **`Effects[].ToolTip`**은 **대문자 `T`**입니다! (`effect.Tooltip`으로 접근하면 항상 `undefined`가 됩니다.)
  2. **툴팁 포맷 차이** `[커뮤니티 확인]`: `Points[].Tooltip`은 JSON이 아닌 **순수 HTML 문자열**이고, `Effects[].ToolTip`은 **`JSON.parse()`가 필요한 JSON 문자열**입니다.
  3. **저티어/미개방 캐릭터**: 응답 자체가 `null`이거나 `IsArkPassive: false` + `Effects: null`일 수 있습니다 (`artbiit/lostark-api-service` 확인 `[커뮤니티 확인]`).
  4. **버전 변경** `[공식]`: V4.0.0에서는 `/profiles` 내부 모델이었으나 **V5.0.0에서 `/profiles`에서 제거되고 `/arkpassive`로 독립**, **V8.0.0에서 `Points[].Description`이 추가**되었습니다.

---

#### 3.2.12 `GET /armories/characters/{characterName}/arkgrid`

- **언제 쓰는지 (용도)** `[공식]`: V9.0.0에서 신설된 엔드포인트로, 엔드게임 성장 시스템인 **아크 그리드(코어 슬롯 6종, 슬롯별 장착 젬, 활성화 포인트 및 최종 그리드 효과)**를 표시할 때 사용합니다.
- **요청 예시**:

```bash
curl -X GET \
  "https://developer-lostark.game.onstove.com/armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/arkgrid" \
  -H "accept: application/json" \
  -H "authorization: bearer YOUR_JWT_TOKEN"
```

```typescript
// TypeScript 타입 [공식 Swagger: ArkGrid, ArkGridSlot, ArkGridGem, ArkGridEffect]
export interface ArkGridGem {
  Index: number;
  Icon: string;
  IsActive: boolean; // 현재 슬롯에서 활성화 여부
  Grade: string;     // 예: "영웅" | "전설" | "유물" | "고대"
  Tooltip: string;   // JSON 문자열
}

export interface ArkGridSlot {
  Index: number;
  Icon: string;
  Name: string;      // 예: "질서의 해 코어 : 수라안"
  Point: number;     // 코어 활성 포인트
  Grade: string;     // 예: "전설" | "유물" | "고대"
  Tooltip: string;   // JSON 문자열 (코어 타입, 코어 옵션 포함)
  Gems: ArkGridGem[] | null; // 젬 미장착 슬롯은 null 가능 [커뮤니티 확인]
}

export interface ArkGridEffect {
  Name: string;
  Level: number;
  Tooltip: string;
}

export interface ArkGrid {
  Slots: ArkGridSlot[] | null;
  Effects: ArkGridEffect[] | null; // 활성 효과 없을 때 null 가능 [커뮤니티 확인]
}

export async function fetchArkGrid(characterName: string, apiKey: string) {
  return lostarkGet<ArkGrid>(
    `/armories/characters/${encodeURIComponent(characterName.trim())}/arkgrid`,
    apiKey,
  );
}
```

- **응답 예시 JSON (샘플, 축약)** `[커뮤니티 확인]` (`artbiit/lostark-api-service` `V9.0.0/sample-data/armories/characters.json` 내 `ArkGrid` + `DAN-MU-ZI/pyLoa` `tests/models/test_armory_ark_grid.py` 구조 조합):

```json
{
  "Slots": [
    {
      "Index": 0,
      "Icon": "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_13_96.png",
      "Name": "질서의 해 코어 : 수라안",
      "Point": 0,
      "Grade": "전설",
      "Tooltip": "{\"Element_000\":{\"type\":\"NameTagBox\",\"value\":\"...\"},\"Element_004\":{\"type\":\"ItemPartBox\",\"value\":{\"Element_000\":\"<FONT COLOR='#A9D0F5'>코어 타입</FONT>\",\"Element_001\":\"...\"}}}",
      "Gems": null
    }
  ],
  "Effects": null
}
```

- **화면에 쓸 핵심 필드**: `Slots[]`의 `Name`, `Grade`, `Point`, `Icon`, `Gems`(장착 젬 중 `IsActive === true` 강조), `Effects[]`의 `Name`, `Level`, `Tooltip`.
- **주의점**:
  1. **광범위한 `null` 가능성** `[커뮤니티 확인]`: 아크 그리드 미개방 캐릭터는 전체 응답이 `null`일 수 있고, 코어만 끼고 젬을 끼지 않은 슬롯은 `Slots[i].Gems: null`, 활성 효과가 없으면 `Effects: null`로 내려옵니다(V9.0.0 실제 샘플에서 직접 확인). 모든 하위 배열에 `?? []` 방어 코드를 넣으세요.
  2. **`ArkGridGem.Tooltip` / `ArkGridEffect.Tooltip` 내부 상세 스키마** `[미확인]`: `ArkGridSlot.Tooltip`은 장비와 동일한 `Element_000` JSON 구조임이 샘플로 확인되었으나, 젬이 채워진 실제 `ArkGridGem.Tooltip`과 `ArkGridEffect.Tooltip`이 JSON 문자열인지 순수 HTML인지는 공개 실제 샘플 부족으로 `[미확인]`입니다. 파싱 시 `try { JSON.parse(...) } catch { /* HTML 폴백 */ }` 패턴을 사용하세요 `[권장]`.

---

## 4. `Tooltip` 문자열 파싱 실전 가이드

> **출처 구분**: 공식 Swagger 스펙에서는 `Tooltip` / `ToolTip`을 단순 `string`으로만 정의하며 내부 스키마를 문서화하지 않습니다 `[공식]`. 아래 구조와 추출 방법은 실제 API V9.0.0 공개 응답 샘플 및 오픈소스 파서에서 확인한 내용입니다 **`[커뮤니티 확인]`** (근거: `artbiit/lostark-api-service` `V9.0.0/sample-data/armories/equipment.json`, `armories-normalizer.ts`, `2Herz/LOA-MULTITOOL`).

### 4.1 툴팁의 2가지 유형과 `Element_XXX` 동적 키 구조

로스트아크 API의 툴팁 필드는 **두 가지 포맷**이 섞여 있습니다 `[커뮤니티 확인]`.

| 유형 | 해당 엔드포인트/필드 | 형태 | 파싱 방법 |
| --- | --- | --- | --- |
| **JSON 문자열 툴팁** | `ArmoryEquipment[].Tooltip`, `ArmoryAvatar[].Tooltip`, `ArmorySkill[].Tooltip`, `SkillRune.Tooltip`, `Card.Tooltip`, `Gem.Tooltip`, `ArkPassive.Effects[].ToolTip`, `ArkGrid.Slots[].Tooltip` | `JSON.parse()`하면 `Element_000`, `Element_001`, ... 키를 가진 객체가 나옴. 각 값 내부 문자열에 HTML 조각 포함 | `JSON.parse()` 후 `Object.values()` 순회 |
| **순수 HTML 조각** | `ArmoryProfile.Stats[].Tooltip[]`, `ArkPassive.Points[].Tooltip`, `SkillTripod.Tooltip` | JSON이 아니라 `<textformat>`, `<FONT>`, `<img>` 등이 바로 들어있는 HTML 문자열 | `JSON.parse()` 금지, HTML 정제/정규식 직접 적용 |

#### 핵심 원칙: `Element_005` 같은 고정 인덱스를 절대 하드코딩하지 마세요 `[커뮤니티 확인]`

장비의 등급(에스더 vs 고대), 귀속 여부, 거래 가능 횟수, 상급 재련·초월·엘릭서 유무에 따라 **`Element_XXX` 번호가 매번 밀립니다**. 실제로 같은 캐릭터의 V9.0.0 샘플(`equipment.json`)에서도:
- 에스더 무기의 슬롯 효과(초월)는 **`Element_010`**, 고대 투구의 슬롯 효과(초월)는 **`Element_009`**입니다.
- 반드시 `Object.values(tooltipObj)`로 순회하면서 **`el.type` + 내부 헤더 키워드(`"연마 효과"`, `"팔찌 효과"`, `"[상급 재련]"` 등)**로 매칭해야 합니다.

자주 마주치는 `type` 값 요약 `[커뮤니티 확인]`:
- `NameTagBox`: 아이템 이름 (`<P ALIGN='CENTER'><FONT ...>+25 ...</FONT></P>`)
- `ItemTitle`: `value`가 객체 — `qualityValue` (`0~100`, 품질 없는 장비는 `-1`), `leftStr0`(등급+부위), `leftStr2`(아이템 레벨·티어)
- `SingleTextBox`: 단일 텍스트 블록 (`[상급 재련] 40단계`, 전용 직업, 귀속, 획득처 등)
- `ItemPartBox`: `value.Element_000`이 소제목(`기본 효과`, `추가 효과`, `연마 효과`, `팔찌 효과`, `세공 단계 보너스`, `아크 패시브 포인트 효과`), `value.Element_001`이 본문
- `IndentStringGroup`: 들여쓰기 그룹 (`value.Element_000.topStr`이 제목, `value.Element_000.contentStr`이 항목 목록 — 초월, 엘릭서, 어빌리티 스톤 `무작위 각인 효과` 등)

### 4.2 HTML 조각 파싱 시 실전 함정 `[커뮤니티 확인]`

실제 V9.0.0 응답 샘플(`artbiit/lostark-api-service` `equipment.json`)에서 확인된 **파서가 자주 깨지는 원인 4가지**:

1. **태그·속성 대소문자 혼재**: 같은 문자열 안에서도 `<FONT COLOR='FE9600'>`와 `<FONT color='FE9600'>`, `<BR>`과 `<br>`이 섞여 나옵니다. 모든 정규식에 **`i` 플래그**를 반드시 붙이세요.
2. **HEX 색상 앞 `#` 누락**: 팔찌는 `COLOR='#FE9600'`인데, 악세서리 연마 효과는 `COLOR='FE9600'`처럼 `#` 없이 내려옵니다. 정규식은 `#?([0-9a-f]{6})`로 작성하세요.
3. **줄바꿈과 복합 옵션**: 팔찌의 4티어 부여 옵션 중 일부는 **하나의 옵션이 `<BR>`로 2줄에 걸쳐** 내려옵니다(첫 줄에만 `<img src='emoticon_tooltip_bracelet_changeable'>`가 있고, 둘째 줄에는 `<img>`가 없음). 단순 `split('<BR>')`하면 하나의 옵션이 2개로 쪼개집니다.
4. **HTML 엔티티**: `&nbsp;` 등이 섞일 수 있으므로 공백 치환(`replace(/&nbsp;/gi, ' ')`)을 함께 처리하세요.

### 4.3 바로 쓰는 TypeScript 툴팁 파서 모듈

아래 코드는 실제 V9.0.0 샘플의 무기·방어구·장신구·팔찌·어빌리티 스톤·보석 데이터 구조에 맞춰 작성된 실전 파서입니다 `[커뮤니티 확인]` / `[권장]`.

```typescript
// tooltip-parser.ts

export interface TooltipElement {
  type?: string;
  value?: unknown;
}

export type TooltipMap = Record<string, TooltipElement | null | undefined>;

/** HTML 태그 제거 + &nbsp; 정규화 */
export function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** 안전한 Tooltip JSON 파싱 (순수 HTML 문자열이나 깨진 문자열이면 null) */
export function parseTooltipJson(tooltip: string | null | undefined): TooltipMap | null {
  if (!tooltip) return null;
  const trimmed = tooltip.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? (parsed as TooltipMap) : null;
  } catch {
    return null;
  }
}

/** ItemPartBox 중 제목(Element_000)에 keyword가 포함된 본문(Element_001) 찾기 */
function findPartBoxBody(map: TooltipMap, keyword: string): string | null {
  for (const el of Object.values(map)) {
    if (el?.type !== 'ItemPartBox' || !el.value || typeof el.value !== 'object') continue;
    const val = el.value as Record<string, unknown>;
    if (typeof val.Element_000 === 'string' && stripHtml(val.Element_000).includes(keyword)) {
      return typeof val.Element_001 === 'string' ? val.Element_001 : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. 장비 기본 정보: 품질 / 일반 재련(연마) / 아이템 레벨 / 티어 / 상급 재련
// ---------------------------------------------------------------------------
export interface ParsedEquipmentSummary {
  /** 일반 재련(강화) 단계 (예: "+25 신념의 업화 머리장식" -> 25, 없으면 null) */
  honingLevel: number | null;
  /** 품질 (0~100). 팔찌·어빌리티 스톤·나침반 등 품질 없는 부위는 null */
  quality: number | null;
  /** 아이템 레벨 (예: 1755, 장신구 등 미표기 시 null) */
  itemLevel: number | null;
  /** 아이템 티어 (예: 4, 에스더 무기 등 미표기 시 null) */
  tier: number | null;
  /** 상급 재련 단계 (예: 40, 미적용 시 0) */
  advancedHoning: number;
  /** 아크 패시브 포인트 효과 원문 (예: "진화 +...", "깨달음 +13", "도약 +18") */
  arkPassivePointText: string | null;
}

export function parseEquipmentSummary(item: { Name: string; Tooltip: string }): ParsedEquipmentSummary {
  const honingMatch = item.Name.match(/^\+(\d+)\s/);
  const honingLevel = honingMatch ? Number(honingMatch[1]) : null;

  const map = parseTooltipJson(item.Tooltip);
  if (!map) {
    return { honingLevel, quality: null, itemLevel: null, tier: null, advancedHoning: 0, arkPassivePointText: null };
  }

  let quality: number | null = null;
  let itemLevel: number | null = null;
  let tier: number | null = null;
  let advancedHoning = 0;

  for (const el of Object.values(map)) {
    if (!el) continue;

    // 품질, 아이템 레벨, 티어 (ItemTitle)
    if (el.type === 'ItemTitle' && el.value && typeof el.value === 'object') {
      const v = el.value as Record<string, unknown>;
      if (typeof v.qualityValue === 'number' && v.qualityValue >= 0) {
        quality = v.qualityValue;
      }
      if (typeof v.leftStr2 === 'string') {
        const clean = stripHtml(v.leftStr2);
        const lvMatch = clean.match(/아이템\s*레벨\s*(\d+)/);
        if (lvMatch) itemLevel = Number(lvMatch[1]);
        const tierMatch = clean.match(/티어\s*(\d+)/);
        if (tierMatch) tier = Number(tierMatch[1]);
      }
    }

    // 상급 재련 단계 (SingleTextBox)
    if (el.type === 'SingleTextBox' && typeof el.value === 'string' && el.value.includes('[상급 재련]')) {
      const clean = stripHtml(el.value);
      const advMatch = clean.match(/\[상급 재련\]\s*(\d+)\s*단계/);
      if (advMatch) advancedHoning = Number(advMatch[1]);
    }
  }

  const arkPointRaw = findPartBoxBody(map, '아크 패시브 포인트 효과');
  return {
    honingLevel,
    quality,
    itemLevel,
    tier,
    advancedHoning,
    arkPassivePointText: arkPointRaw ? stripHtml(arkPointRaw) : null,
  };
}

// ---------------------------------------------------------------------------
// 2. 악세서리 연마 효과 추출 (목걸이 / 귀걸이 / 반지)
// ---------------------------------------------------------------------------
export interface AccessoryPolishOption {
  /** 옵션명 (예: "무기 공격력", "추가 피해", "적에게 주는 피해", "치명타 적중률") */
  name: string;
  /** 수치 문자열 (예: "+960", "+2.60%") */
  value: string;
  /**
   * 툴팁 색상 HEX (대문자 #XXXXXX 정규화).
   * 샘플 확인: "#FE9600"(상) 등 [커뮤니티 확인].
   * 중/하 옵션 색상 매핑은 전체 등급 실샘플이 없어 참고용으로만 활용하세요 [미확인].
   */
  colorHex: string | null;
  rawText: string;
}

export function parseAccessoryPolishEffects(tooltip: string): AccessoryPolishOption[] {
  const map = parseTooltipJson(tooltip);
  if (!map) return [];
  const rawBody = findPartBoxBody(map, '연마 효과');
  if (!rawBody) return [];

  return rawBody
    .split(/<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // COLOR='FE9600' / color='#FE9600' 모두 대응 [커뮤니티 확인]
      const colorMatch = line.match(/color\s*=\s*['"]#?([0-9a-f]{6})['"]/i);
      const colorHex = colorMatch ? `#${colorMatch[1]!.toUpperCase()}` : null;
      const rawText = stripHtml(line);
      const kv = rawText.match(/^(.+?)\s*([+-]?\d+(?:\.\d+)?%?)$/);
      return {
        name: kv ? kv[1]!.trim() : rawText,
        value: kv ? kv[2]!.trim() : '',
        colorHex,
        rawText,
      };
    });
}

// ---------------------------------------------------------------------------
// 3. 팔찌 옵션 추출 (고정/변환 구분 + 2줄 복합 옵션 그룹핑)
// ---------------------------------------------------------------------------
export interface BraceletOption {
  /** 'locked' = 고정 옵션, 'changeable' = 부여(변환) 옵션 */
  kind: 'locked' | 'changeable';
  /** 2줄 복합 옵션은 '\n'으로 연결된 정제 텍스트 */
  text: string;
  /** 옵션 텍스트 내 강조 색상 HEX 목록 */
  colors: string[];
}

export function parseBraceletOptions(tooltip: string): BraceletOption[] {
  const map = parseTooltipJson(tooltip);
  if (!map) return [];
  const rawBody = findPartBoxBody(map, '팔찌 효과');
  if (!rawBody) return [];

  // <img src='emoticon_tooltip_bracelet_locked|changeable' ...></img> 기준으로 옵션 경계 분리 [커뮤니티 확인]
  const markerRe = /<img\s+src=['"]emoticon_tooltip_bracelet_(locked|changeable)['"][^>]*>\s*(?:<\/img>)?/gi;
  const matches = [...rawBody.matchAll(markerRe)];
  if (matches.length === 0) {
    // <img> 마커가 없는 구형/예외 포맷 폴백
    return rawBody
      .split(/<br\s*\/?>/i)
      .map((s) => stripHtml(s))
      .filter(Boolean)
      .map((text) => ({ kind: 'changeable' as const, text, colors: [] }));
  }

  const options: BraceletOption[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const kind = (m[1]!.toLowerCase() === 'locked' ? 'locked' : 'changeable') as 'locked' | 'changeable';
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? rawBody.length) : rawBody.length;
    const chunk = rawBody.slice(start, end);

    const colors = [...chunk.matchAll(/color\s*=\s*['"]#?([0-9a-f]{6})['"]/gi)].map(
      (cm) => `#${cm[1]!.toUpperCase()}`,
    );
    const text = stripHtml(chunk).replace(/\n+/g, '\n').trim();
    if (text) options.push({ kind, text, colors });
  }
  return options;
}

// ---------------------------------------------------------------------------
// 4. 어빌리티 스톤 세공 각인/감소/레벨 보너스 추출 [커뮤니티 확인: artbiit/lostark-api-service]
// ---------------------------------------------------------------------------
export interface AbilityStoneOption {
  name: string;
  level: number;
  kind: 'engraving' | 'debuff' | 'level-bonus';
  bonusText: string | null;
}

export function parseAbilityStoneOptions(tooltip: string): AbilityStoneOption[] {
  const map = parseTooltipJson(tooltip);
  if (!map) return [];

  for (const el of Object.values(map)) {
    if (el?.type !== 'IndentStringGroup' || !el.value || typeof el.value !== 'object') continue;
    const inner = (el.value as Record<string, any>).Element_000;
    if (!inner || typeof inner.topStr !== 'string' || !inner.topStr.includes('무작위 각인 효과')) continue;
    if (!inner.contentStr || typeof inner.contentStr !== 'object') continue;

    return Object.values(inner.contentStr as Record<string, any>)
      .map((entry) => entry?.contentStr)
      .filter((s): s is string => typeof s === 'string')
      .map((raw) => {
        const clean = stripHtml(raw);
        const nameMatch = clean.match(/\[([^\]]+)\]/);
        const name = nameMatch ? nameMatch[1]!.trim() : clean;
        const lvMatch = clean.match(/Lv\.(\d+)/i);
        const level = lvMatch ? Number(lvMatch[1]) : 0;

        if (raw.includes('레벨 보너스') || /#73DC04/i.test(raw)) {
          const after = clean.includes(']') ? clean.slice(clean.indexOf(']') + 1).trim() : clean;
          return { name: name || '레벨 보너스', level: 0, kind: 'level-bonus' as const, bonusText: after || null };
        }
        if (/#FE2E2E/i.test(raw)) {
          return { name, level, kind: 'debuff' as const, bonusText: null };
        }
        return { name, level, kind: 'engraving' as const, bonusText: null };
      });
  }
  return [];
}
```

> **실제 V9.0.0 샘플 입력 시 위 파서의 추출 결과 예시** `[커뮤니티 확인]`:
> - 투구 `"+25 신념의 업화 머리장식"` → `{ honingLevel: 25, quality: 100, itemLevel: 1755, tier: 4, advancedHoning: 40 }`
> - 목걸이 `"도래한 결전의 목걸이"` → `parseAccessoryPolishEffects`:
>   `[{ name: "무기 공격력", value: "+960", colorHex: "#FE9600" }, { name: "추가 피해", value: "+2.60%", colorHex: "#FE9600" }, { name: "적에게 주는 피해", value: "+2.00%", colorHex: "#FE9600" }]`
> - 팔찌 `"찬란한 구원자의 팔찌"` → `parseBraceletOptions`:
>   고정 2줄(`신속 +82`, `치명 +118`) + 변환 3개(2줄 복합 옵션 `"치명타 피해가 6.8% 증가한다.\n공격이 치명타로 적중 시 적에게 주는 피해가 1.5% 증가한다."`가 쪼개지지 않고 1개 항목으로 유지됨)

---

## 5. 에러·예외 처리 및 캐싱 전략

### 5.1 존재하지 않는 캐릭터 / 미갱신 캐릭터 처리

| 상황 | 확인된 응답 | 근거 | 권장 대응 `[권장]` |
| --- | --- | --- | --- |
| **없는 캐릭터 조회** (`/armories/characters/{name}` 등) | **`HTTP 200 OK` + 본문 `null`** (실측) 또는 **`HTTP 404 Not Found`** | `[커뮤니티 확인]` (`artbiit/lostark-api-service` 2026-08-26 실측: `200 + null`, `cyhcyh100/public-lopec-api`: `404` catch). 공식 Swagger는 `404` 정의만 있고 없는 캐릭터 규칙 미기재 `[미확인]` | **`HTTP 404`와 `HTTP 200 + body null`을 동일하게 "캐릭터 없음"으로 처리**하세요. `ArmoryProfileAll` 조회 시에는 `data?.ArmoryProfile == null`까지 함께 확인하세요. |
| **삭제/닉변/장기 미접속 캐릭터** | `siblings`는 `null`/`[]`, `armories`는 `null` 또는 일부 섹션(`ArkPassive`, `ArkGrid` 등)만 `null` | `[커뮤니티 확인]` (`2Herz/LOA-MULTITOOL`, `artbiit/lostark-api-service`) | 프론트엔드에 `"캐릭터를 찾을 수 없거나 최근 접속 기록이 없습니다."` 안내 문구 노출 및 **짧은 네거티브 캐시(30~60초)** 적용으로 반복 오타 검색의 쿼터 낭비 방지 `[권장]`. |

### 5.2 `401` / `429` / `503` 처리 가이드

#### ① `401 Unauthorized` `[공식]`
- **원인**: `authorization` 헤더 누락, `bearer ` 접두사 누락/공백 누락, 중괄호/꺾쇠 포함, 삭제되었거나 보안상 비활성화된 클라이언트 키.
- **대응**: 재시도해도 해결되지 않으므로 **즉시 재시도를 중단**하고 운영 알람을 발생시키세요 `[권장]`.

#### ② `429 Rate Limit Exceeded` `[공식]`
- **원인**: 클라이언트당 **분당 100회** 한도 초과 (`/getting-started#throttling`, `/usage-guide#api-request-limit`).
- **응답 헤더 활용** `[공식]`:
  - `X-RateLimit-Limit`: `100` (분당 허용량)
  - `X-RateLimit-Remaining`: 남은 호출 수 (예: `15`, `0`이면 즉시 스로틀링 필요)
  - `X-RateLimit-Reset`: 다음 할당량 초기화 시각(UNIX epoch 초, 예: `1668659557`)
- **대응 전략** `[권장]`:
  1. **사전 예방(클라이언트 측 Token Bucket / Sliding Window)**: 백엔드에서 자체적으로 분당 90~95회 상한 큐를 두거나, `X-RateLimit-Remaining <= 5`가 되면 비긴급 요청(배치/워밍업)을 지연시키세요.
  2. **429 수신 시 대기**: `waitMs = (X-RateLimit-Reset - nowEpochSec + 1) * 1000`만큼 대기 후 1회 재시도(단, 웹 요청 타임아웃 방지를 위해 대기 시간이 길면 사용자에게 "요청이 몰려 잠시 후 다시 시도해 주세요" 즉시 반환).
  3. **배치 작업 간격**: 다수 캐릭터를 순차 수집할 때는 요청당 최소 **0.65~0.7초 이상 간격**을 두어 분당 100회 아래로 유지하세요 (`2Herz/LOA-MULTITOOL`: `0.7s` 간격 사례 `[커뮤니티 확인]`).
  4. **한도 상향**: 공식 포털 `MY CLIENTS` → `REQUEST FOR MONETIZATION & LIMIT INCREASE`로 상향 신청 가능 `[공식]` (승인 최대 한도는 `[미확인]`).

#### ③ `503 Service Unavailable` `[공식]`
- **원인**: 로스트아크 공식 웹사이트 정기/임시 점검 시 Open API 포털과 모든 엔드포인트가 함께 중단되며 `503`을 반환합니다 (`/usage-guide#maintenance-error`, `/faq`).
- **대응 전략** `[공식]` / `[권장]`:
  - 공식 가이드는 `503` 수신 시 **추가 요청을 중단하거나 요청 간격을 늘릴 것**을 명시적으로 권고합니다 `[공식]`.
  - 실무에서는 **서킷 브레이커**(예: 연속 3회 `503` 수신 시 60초간 업스트림 호출 차단)를 열고, 만료된 캐시라도 있으면 **Stale-While-Error**(점검 중 안내 배너 + 마지막 캐시 데이터 표시)로 서비스 중단을 완화하는 것을 권장합니다 `[권장]`.
- ※ **참고**: 에러 응답(`400`~`504`)의 실제 JSON 본문 구조(필드명/에러 코드 포맷)는 공식 문서에 정의되어 있지 않아 `[미확인]`이므로, 본문 파싱에 의존하지 말고 **HTTP 상태 코드 + `X-RateLimit-*` 헤더** 기준으로 분기하세요 `[권장]`.

### 5.3 캐싱 전략 (`[공식]` 기준 + `[권장]` 설계)

- **공식 근거** `[공식]` (`/usage-guide#inefficient-api-request`, `/faq`, `/agreement`):
  1. 분당 100회 제한 때문에 애플리케이션 단의 **강력한 캐싱 전략이 필수**입니다.
  2. 인게임 데이터는 완전 실시간이 아니며 **API 동기화에 수 분이 걸릴 수 있습니다** (30분 이상 미반영 시 문의 안내).
  3. 사용자의 매 클릭·인터랙션마다 동일 캐릭터를 중복 호출하는 패턴을 금지·지양합니다.
  4. **약관 주의(`/agreement`)**: 콘텐츠 무단 보관·재배포 금지 조항이 있으므로, 단기 성능 캐시(TTL 만료 기반)를 넘어선 영구 미러링/재배포 설계 시 이용약관 준수 범위를 검토해야 합니다.
  5. 서버가 `Cache-Control` / `ETag` 헤더를 제공하는지 여부는 공식 문서에 미기재(`[미확인]`)이므로, **애플리케이션 측 TTL 캐시**를 직접 관리해야 합니다.

#### 엔드포인트별 TTL 및 캐시 전략 `[권장]`

| 대상 | 권장 TTL `[권장]` | 근거 및 운영 팁 |
| --- | --- | --- |
| `GET /armories/characters/{name}` (통합 응답) | **3~5분** (고빈도 조회) ~ **10분** (일반 조회) | 공식 FAQ의 "수 분 동기화 지연"을 고려하면 1~2분 미만으로 갱신해도 동일 데이터가 돌아올 확률이 높습니다. `artbiit/lostark-api-service`도 5~10분 TTL + L1(메모리)/L2(Redis) 구조를 채택했습니다 `[커뮤니티 확인]`. |
| `GET /characters/{name}/siblings` | **10~30분** | 원정대 캐릭터 목록은 장비 교체보다 변동 빈도가 훨씬 낮습니다. 동일 원정대의 어떤 캐릭터로 조회해도 같은 목록이 나오므로 **원정대 키로 공유 캐시**하면 호출을 크게 줄일 수 있습니다. |
| `GET .../collectibles` (단독 호출 시) | **30분 ~ 1시간** | 내실 수집형 포인트는 원정대 공유이며 변동이 매우 드뭅니다. |
| **없는 캐릭터 (`null`/`404`) 네거티브 캐시** | **30~60초** | 오타나 봇 트래픽이 분당 100회 쿼터를 소진하는 것을 방지합니다. |
| **사용자 "갱신(새로고침)" 버튼 쿨다운** | **캐릭터당 2~3분** | 연타 방지. 캐시 저장 시각(`fetchedAt`)을 UI에 `"3분 전 갱신"` 형태로 표시하고 쿨다운 내에는 캐시를 그대로 반환하세요. |
| **동시 요청 합치기 (Singleflight / In-flight Dedup)** | **필수 적용** | 같은 캐릭터를 여러 사용자가 동시에 조회할 때 진행 중인 `Promise`를 Map에 공유해 업스트림 API는 **1회만** 호출하세요. |

---

## 6. 실전 흐름: `siblings`로 원정대 목록 → 캐릭터 전환 구현

전투정보실 웹앱에서 가장 흔한 UX 흐름인 **"캐릭터 검색 → 상세 정보 + 원정대 목록 로드 → 원정대 내 다른 캐릭터 클릭 시 빠른 전환"**의 권장 설계입니다 `[권장]`.

### 6.1 요청 흐름도

```text
[사용자: "예시캐릭터" 검색]
   │
   ├──(병렬 1회)──▶ GET /armories/characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0   (캐시 키: armory:예시캐릭터, TTL 5분)
   └──(병렬 1회)──▶ GET /characters/%EC%98%88%EC%8B%9C%EC%BA%90%EB%A6%AD%ED%84%B0/siblings  (캐시 키: siblings:예시캐릭터, TTL 15분)
                         │
                         ▼ (응답: 같은 원정대 캐릭터 20명)
               [서버별 그룹핑 + ItemAvgLevel 내림차순 정렬]
               [★ 핵심 최적화: 응답받은 20명 모두의 캐시 키를 동일 siblings 데이터로 역인덱싱!]
                         │
[사용자: 원정대 목록에서 부캐 "예시부캐" 클릭]
   │
   ├──(호출 1회)──▶ GET /armories/characters/%EA%B3%A1%EC%B8%84%ED%95%91  (신규 조회)
   └──(호출 0회!)──▶ siblings 캐시 히트! (이미 "예시캐릭터" 조회 때 확보한 원정대 목록 즉시 재사용)
```

> **쿼터 절감 효과** `[권장]`:
> - 순진하게 캐릭터 전환마다 `armories` + `siblings`를 매번 호출하면 10명 둘러볼 때 **20회** 호출합니다.
> - 위처럼 `siblings` 결과를 원정대 전원의 캐릭터명으로 캐시 인덱싱하면 10명 둘러볼 때 **11회**(최초 2회 + 전환 9회)로 약 **45% 절감**됩니다.

### 6.2 TypeScript 구현 예시 (In-flight 중복 제거 + 원정대 역인덱싱 캐시)

```typescript
// roster-service.ts
import { lostarkGet, parseCommaNumber } from './lostark-client';
import type { CharacterInfo, ArmoryProfileAll } from './types';

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
}

export interface RosterGroup {
  serverName: string;
  characters: Array<CharacterInfo & { itemLevelNum: number }>;
}

export class LostArkRosterService {
  private armoryCache = new Map<string, CacheEntry<ArmoryProfileAll | null>>();
  private siblingsCache = new Map<string, CacheEntry<CharacterInfo[]>>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly apiKey: string) {}

  /** 단일 캐릭터 전투정보실 조회 (캐시 + Singleflight) */
  async getArmory(characterName: string, forceRefresh = false): Promise<{
    data: ArmoryProfileAll | null;
    fetchedAt: number;
    fromCache: boolean;
  }> {
    const key = characterName.trim();
    const now = Date.now();
    const cached = this.armoryCache.get(key);

    // 갱신 쿨다운(예: 2분) 내에는 forceRefresh 요청도 캐시 반환 [권장]
    const withinCooldown = cached && now - cached.fetchedAt < 2 * 60_000;
    if (cached && ((!forceRefresh && cached.expiresAt > now) || withinCooldown)) {
      return { data: cached.value, fetchedAt: cached.fetchedAt, fromCache: true };
    }

    const reqKey = `armory:${key}`;
    let promise = this.inflight.get(reqKey) as Promise<ArmoryProfileAll | null> | undefined;
    if (!promise) {
      promise = lostarkGet<ArmoryProfileAll>(
        `/armories/characters/${encodeURIComponent(key)}`,
        this.apiKey,
      )
        .then(({ data }) => {
          const ttlMs = data?.ArmoryProfile ? 5 * 60_000 : 60_000; // 정상 5분, 미존재 1분 [권장]
          this.armoryCache.set(key, {
            value: data?.ArmoryProfile ? data : null,
            fetchedAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
          });
          return data?.ArmoryProfile ? data : null;
        })
        .finally(() => this.inflight.delete(reqKey));
      this.inflight.set(reqKey, promise);
    }

    const data = await promise;
    const entry = this.armoryCache.get(key);
    return { data, fetchedAt: entry?.fetchedAt ?? Date.now(), fromCache: false };
  }

  /** 원정대 목록 조회 + 원정대 전원 캐릭터명 역인덱싱 캐시 */
  async getSiblings(characterName: string): Promise<CharacterInfo[]> {
    const key = characterName.trim();
    const now = Date.now();
    const cached = this.siblingsCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    const { data } = await lostarkGet<CharacterInfo[]>(
      `/characters/${encodeURIComponent(key)}/siblings`,
      this.apiKey,
    );
    const list = data ?? [];
    const entry: CacheEntry<CharacterInfo[]> = {
      value: list,
      fetchedAt: now,
      expiresAt: now + (list.length > 0 ? 15 * 60_000 : 60_000),
    };

    // 원정대에 속한 모든 캐릭터명으로 캐시를 공유 등록 -> 캐릭터 전환 시 siblings 재호출 0회!
    this.siblingsCache.set(key, entry);
    for (const ch of list) {
      this.siblingsCache.set(ch.CharacterName, entry);
    }
    return list;
  }

  /** 화면용: 현재 캐릭터 서버를 맨 위에 두고 서버별 + 아이템 레벨 내림차순 정렬 */
  groupSiblingsByServer(siblings: CharacterInfo[], currentServer?: string): RosterGroup[] {
    const map = new Map<string, Array<CharacterInfo & { itemLevelNum: number }>>();
    for (const ch of siblings) {
      const enriched = { ...ch, itemLevelNum: parseCommaNumber(ch.ItemAvgLevel) };
      const arr = map.get(ch.ServerName) ?? [];
      arr.push(enriched);
      map.set(ch.ServerName, arr);
    }

    return [...map.entries()]
      .map(([serverName, chars]) => ({
        serverName,
        characters: chars.sort((a, b) => b.itemLevelNum - a.itemLevelNum),
      }))
      .sort((a, b) => {
        if (a.serverName === currentServer) return -1;
        if (b.serverName === currentServer) return 1;
        return (b.characters[0]?.itemLevelNum ?? 0) - (a.characters[0]?.itemLevelNum ?? 0);
      });
  }

  /** 초기 검색 및 원정대 캐릭터 전환 통합 진입점 */
  async loadCharacterPage(characterName: string) {
    // 초기 진입: 2회 호출 / 원정대 내 캐릭터 전환: 1회 호출(siblings 캐시 히트)
    const [armoryRes, siblings] = await Promise.all([
      this.getArmory(characterName),
      this.getSiblings(characterName),
    ]);

    if (!armoryRes.data?.ArmoryProfile) {
      return { found: false as const, characterName };
    }

    const currentServer = armoryRes.data.ArmoryProfile.ServerName;
    return {
      found: true as const,
      fetchedAt: armoryRes.fetchedAt,
      fromCache: armoryRes.fromCache,
      armory: armoryRes.data,
      rosterGroups: this.groupSiblingsByServer(siblings, currentServer),
    };
  }
}
```

---

## 7. 출처 요약 및 미확인 항목

### 7.1 공식 출처 (`[공식]`)

- 개발자 포털 Getting Started (인증 헤더·잘못된 예시·JWT·분당 100회 Throttling): https://developer-lostark.game.onstove.com/getting-started
- 개발자 포털 Usage Guide (HTTP 헤더·에러 코드·503 점검·캐싱·`X-RateLimit-*` 헤더): https://developer-lostark.game.onstove.com/usage-guide
- 개발자 포털 Changelog (V1.0.0 ~ V10.0.0 추가·제거·구조 변경 이력): https://developer-lostark.game.onstove.com/changelog
- 개발자 포털 FAQ (동기화 지연 수 분/30분, XML 미지원, 503 점검, 한도 상향): https://developer-lostark.game.onstove.com/faq
- Swagger JSON — CHARACTERS: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/characters
- Swagger JSON — ARMORIES: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories

### 7.2 커뮤니티 보조 출처 (`[커뮤니티 확인]`)

- **artbiit/lostark-api-service** (V9.0.0 실제 응답 샘플, `200 + null` 미존재 캐릭터 실측, Tooltip 파싱 및 정규화, 캐싱 전략):
  - 샘플 데이터: https://github.com/artbiit/lostark-api-service/tree/main/docs/contracts/upstream-lostark-api/V9.0.0/sample-data
  - 정규화기 (`200 + null` 실측, 어빌리티 스톤·아크 패시브·각인 파싱): https://github.com/artbiit/lostark-api-service/blob/main/packages/data-service/src/normalizers/armories-normalizer.ts
  - 캐싱 전략 문서: https://github.com/artbiit/lostark-api-service/blob/main/docs/contracts/upstream-lostark-api/V9.0.0/caching-strategies.md
- **cyhcyh100/public-lopec-api** (lopec.kr 백엔드 공개 스냅샷 — `404` 방어 처리, `siblings`/`equipment` 클라이언트):
  - https://github.com/cyhcyh100/public-lopec-api/blob/main/src/main/kotlin/kr/lopec/gateway/lostark/LostArkClient.kt
- **2Herz/LOA-MULTITOOL** (`0.7s` 요청 간격, `null` 방어, 아크 패시브 체크):
  - https://github.com/2Herz/LOA-MULTITOOL/blob/main/tools/Fetch-RegressionArmory.py
- **DAN-MU-ZI/pyLoa** (Python SDK — `ArkGrid` 모델 테스트, 빈/null 섹션 방어 패턴, `filters` 쉼표 오용 반례):
  - https://github.com/DAN-MU-ZI/pyLoa/blob/main/pyloa/endpoints/armories.py
  - https://github.com/DAN-MU-ZI/pyLoa/blob/main/tests/models/test_armory_ark_grid.py
- **Cong0327/LA_Discord_Bot** (`encodeURIComponent` 적용 및 V4 이전 구형 `ArmoryGem.Effects` 반례 확인):
  - https://github.com/Cong0327/LA_Discord_Bot/blob/main/src/services/armories.ts

### 7.3 남은 미확인 항목 (`[미확인]`)

API 키를 이용한 실호출을 수행하지 않았고 공식 문서에도 명문화되어 있지 않아 아래 7개 항목은 `[미확인]`으로 남겨두었습니다. 실제 키 발급 후 초기 스모크 테스트에서 1회 확인하는 것을 권장합니다.

1. **`?filters=` 쿼리의 `+` vs `%2B` 인코딩 허용 범위**: 공식 Swagger는 `+` 구분을 예시로 들지만, `URLSearchParams`가 생성하는 `%2B`와 리터럴 `+` 중 서버가 양쪽 모두 허용하는지 여부는 미확인.
2. **`?filters=`로 미선택한 섹션의 JSON 표현**: 부분 필터 조회 시 요청하지 않은 키가 `null`로 포함되는지, JSON 키 자체가 생략되는지 공식 명세 미확인.
3. **에러 응답(`400`~`504`)의 실제 JSON 본문 스키마**: HTTP 상태 코드별 에러 응답 바디의 필드명·메시지 형식 미확인.
4. **없는 캐릭터 조회 시 `200 + null` vs `404`의 정확한 분기 조건**: 커뮤니티에서 `200 + null` 실측(2026-08)과 `404` 핸들링 사례가 공존하며, 엔드포인트나 캐릭터 상태(삭제·미생성·장기 미접속)별 정확한 공식 규칙은 미확인.
5. **캐릭터명 대소문자 구분 여부**: 영문 포함 캐릭터명 조회 시 대소문자를 구분하는지 여부 미확인.
6. **`ArkGridGem.Tooltip` / `ArkGridEffect.Tooltip` 및 악세서리 연마 효과 중/하 등급 색상의 전체 매핑**: 공개 샘플에서 상급(`#FE9600`) 및 코어 슬롯 `Tooltip` JSON 구조는 확인되었으나, 젬이 활성화된 실제 `ArkGrid` 응답 툴팁과 악세서리 연마 효과 전 등급(상/중/하) 색상 코드 전체는 미확인.
7. **HTTP 캐시 헤더(`Cache-Control`, `ETag`) 제공 여부 및 Rate Limit 상향 승인 최대 한도**: 공식 문서 미공개.
