# 로스트아크 Open API 엔드포인트 전체 정리

> **조사 기준일**: 2026-11-25  
> **포털 Base URL**: `https://developer-lostark.game.onstove.com`  
> **API 스펙 형식**: Swagger 2.0 (`info.version: v1`, 포털 Changelog 최신 버전: **V10.0.0**)  
> **주의**: 본 문서는 공식 개발자 포털의 공개 문서와 Swagger JSON 스펙만을 바탕으로 정리하였으며, API 키가 필요한 실제 호출 검증은 수행하지 않았습니다. 공식 문서에 명시되지 않은 사항은 추측하지 않고 **미확인**으로 표기하였습니다.

---

## 1. 그룹별 엔드포인트 요약

현재 공식 포털(`/getting-started`)에 활성화된 그룹은 총 **6개**, 엔드포인트는 총 **23개**입니다. 과거 존재하던 `GUILDS` 그룹 및 `GAMECONTENTS` 일부 엔드포인트는 Changelog 기준으로 제거되었습니다.

| 그룹 | 상태 | 엔드포인트 수 | 출처 (Swagger JSON) |
| --- | --- | ---: | --- |
| **NEWS** | 활성 | 3 | https://developer-lostark.game.onstove.com/swagger-doc/endpoints/news |
| **CHARACTERS** | 활성 | 1 | https://developer-lostark.game.onstove.com/swagger-doc/endpoints/characters |
| **ARMORIES** | 활성 | 12 | https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories |
| **AUCTIONS** | 활성 | 2 | https://developer-lostark.game.onstove.com/swagger-doc/endpoints/auctions |
| **MARKETS** | 활성 | 4 | https://developer-lostark.game.onstove.com/swagger-doc/endpoints/markets |
| **GAMECONTENTS** | 활성 | 1 | https://developer-lostark.game.onstove.com/swagger-doc/endpoints/gamecontents |
| **GUILDS** | 제거됨 (V4.0.0) | 0 | https://developer-lostark.game.onstove.com/changelog |
| **합계 (활성 기준)** | — | **23** | — |

---

## 2. 공통 사항

### 2.1 인증 헤더 형식

- **출처**: [Getting Started](https://developer-lostark.game.onstove.com/getting-started), [Usage Guide](https://developer-lostark.game.onstove.com/usage-guide), [FAQ](https://developer-lostark.game.onstove.com/faq)
- **방식**: 모든 API 요청에 스토브(STOVE) 계정으로 클라이언트 생성 시 발급되는 **JWT(API Key)**를 HTTP 헤더 `authorization`(또는 `Authorization`)에 포함해야 합니다.
  - 보안 정의(Swagger `securityDefinitions.apiKeyAuth`): `type: apiKey`, `name: authorization`, `in: header`
  - **올바른 형식**:
    ```http
    authorization: bearer {YOUR_JWT}
    ```
    (실제 요청에서는 `{}` 중괄호나 `<>` 꺾쇠 없이 `bearer ` 뒤에 공백 1칸과 토큰 문자열을 그대로 입력합니다.)
  - **공식 문서에 안내된 잘못된 예시 (401 Unauthorized 발생)**:
    - `Authorization: abcdefghijklmnopqrstuvwxyz` (`bearer` 누락)
    - `Authorization: bearer {abcdefghijklmnopqrstuvwxyz}` (중괄호 포함)
    - `Authorization: bearer <abcdefghijklmnopqrstuvwxyz>` (꺾쇠괄호 포함)
    - `Authorization: bearer{abcdefghijklmnopqrstuvwxyz}` (공백 누락 및 중괄호 포함)
    - `Authorization: bearerabcdefghijklmnopqrstuvwxyz` (`bearer` 뒤 공백 누락)
- **JWT 발급 및 유효 기간**:
  - 클라이언트 생성 즉시 발급되며, 별도의 토큰 갱신(Refresh) 절차 없이 **무기한 유효**합니다(단, 키 보안 문제가 판단되거나 사용자가 클라이언트를 삭제한 경우 제외).
  - 계정당 최대 **5개**의 클라이언트를 생성할 수 있습니다.
  - 신뢰할 수 있는 서버 측 애플리케이션 등 안전한 곳에 보관할 것을 강력히 권장합니다.

### 2.2 기본 요청/응답 형식

- **출처**: [Usage Guide](https://developer-lostark.game.onstove.com/usage-guide), [FAQ](https://developer-lostark.game.onstove.com/faq)
- **프로토콜**: HTTPS (`https://developer-lostark.game.onstove.com`)
- **응답 포맷**: `application/json`만 지원합니다(XML 미지원).
- **필수/권장 헤더**:
  - 공통: `accept: application/json`, `authorization: bearer <JWT>`
  - `POST` 요청 시 추가: `Content-Type: application/json`

### 2.3 요청 제한 (Rate Limit / Throttling)

- **출처**: [Getting Started](https://developer-lostark.game.onstove.com/getting-started#throttling), [Usage Guide](https://developer-lostark.game.onstove.com/usage-guide#api-request-limit), [FAQ](https://developer-lostark.game.onstove.com/faq)
- **기본 제한**: 클라이언트당 **분당 100회 (`100 requests per minute`)**.
- **초과 시 동작**: 한도 초과 시 할당량이 초기화될 때까지 `429 Rate Limit Exceeded` 응답을 반환합니다. 할당량은 **1분마다 자동 갱신**됩니다.
- **응답 헤더 메타데이터**:
  | 헤더 | 타입 | 예시 | 설명 |
  | --- | --- | --- | --- |
  | `X-RateLimit-Limit` | `int` | `100` | 분당 허용 요청 수 |
  | `X-RateLimit-Remaining` | `int` | `15` | 현재 남은 사용 가능 요청 수 |
  | `X-RateLimit-Reset` | `long` | `1668659557` | 다음 할당량 갱신 시각 (UNIX epoch 타임스탬프) |
- **한도 상향 신청**: `MY CLIENTS` 페이지에서 클라이언트를 선택해 `REQUEST FOR MONETIZATION & LIMIT INCREASE` 양식을 제출할 수 있습니다. (승인 시 최대 허용 한도 상한은 **미확인**.)

### 2.4 에러 코드 및 점검/API 상태 안내

- **출처**: [Usage Guide](https://developer-lostark.game.onstove.com/usage-guide#api-errors), 각 그룹 Swagger JSON
- **HTTP 상태 코드**:
  | 코드 | 설명 | 비고 |
  | --- | --- | --- |
  | `200` | OK | 요청 성공 |
  | `400` | Bad Request | 모든 Swagger JSON 스펙에 명시 (`/usage-guide` 표에는 미기재) |
  | `401` | Unauthorized | JWT 누락, 잘못된 `bearer` 형식, 유효하지 않은 토큰 등 |
  | `403` | Forbidden | 접근 권한 없음 |
  | `404` | Not Found | 요청 리소스 없음 |
  | `415` | Unsupported Media Type | 지원하지 않는 Content-Type (예: POST 요청 시 `application/json` 누락) |
  | `429` | Rate Limit Exceeded | 분당 요청 제한 초과 (`X-RateLimit-Reset` 이후 재시도 필요) |
  | `500` | Internal Server Error | 서버 내부 오류 |
  | `502` | Bad Gateway | 게이트웨이 오류 |
  | `503` | Service Unavailable | 서버 점검 중 또는 일시적 서비스 불가 |
  | `504` | Gateway Timeout | 게이트웨이 응답 시간 초과 |
  - ※ 에러 응답의 JSON 본문 스키마(필드명/메시지 구조)는 공식 문서에 정의되어 있지 않아 **미확인**입니다.
- **점검 시간 대응 (`/usage-guide#maintenance-error`, `/faq`)**:
  - 로스트아크 공식 웹사이트 점검 시 Open API 포털 및 모든 엔드포인트가 중단되며 **`503 Service Unavailable`**을 반환합니다.
  - `503` 응답 수신 시 추가 요청을 중단하거나 요청 간격을 늘릴 것을 권장합니다.
- **포털 API 상태(API Status) 5단계 (`/usage-guide#api-status`, `/getting-started` 헤더 스크립트)**:
  - 회색 (`NO_DATA`): 상태 메타데이터 동기화 중 (`Syncing...`)
  - 빨간색 (`ERROR`): API 비정상/오류 (`An error occurred in the API.`)
  - 노란색 (`WARNING`): 일부 기능 제한/서버 과부하로 응답 지연 (`All Response is delayed due to API server overload.`)
  - 초록색 (`SUCCESS`): 모든 API 정상 작동 (`All APIs are operational.`)
  - 파란색 (`MAINTENANCE`): 점검 중 (`Maintenance`)

### 2.5 캐싱 권장 사항 및 운영 가이드

- **출처**: [Usage Guide](https://developer-lostark.game.onstove.com/usage-guide#inefficient-api-request), [FAQ](https://developer-lostark.game.onstove.com/faq), [News Swagger JSON](https://developer-lostark.game.onstove.com/swagger-doc/endpoints/news), [Terms of Service](https://developer-lostark.game.onstove.com/agreement)
- **강력한 캐싱 전략 권장**: 요청 제한(Throttling) 때문에 애플리케이션 단에서 반드시 캐싱 전략을 구현해야 합니다.
- **저빈도(1일 1회 ~ 주 1회) 호출 권장 대상**: 예기치 않은 점검으로 리소스나 모델이 바뀌지 않는 한 응답이 대체로 정적(static)이므로, 아래 엔드포인트는 일 1회 또는 주 1회 호출 후 캐싱할 것을 공식 가이드에서 명시적으로 권장합니다.
  - `GET /news/events`
  - `GET /auctions/options`
  - `GET /markets/options`
- **지양해야 할 패턴**: 마이크로초 단위의 과도한 폴링이나, 사용자의 매 인터랙션마다 중복 API 요청을 발생시키는 구조를 피해야 합니다.
- **알람 폴링 간격 권장**: `GET /news/alarms` 응답의 `RequirePolling` 값이 `true`인 경우 **최소 30초 이상 간격**으로 폴링할 것을 권장합니다(`false`이면 폴링 불필요).
- **게임 데이터 동기화 지연**: 일부 인게임 데이터는 실시간이 아니며 동기화에 수 분이 걸릴 수 있습니다. 30분 이상 최신 데이터가 반영되지 않으면 이메일(`developer-lostark@smilegate.com`)로 문의하도록 안내하고 있습니다.
- **이용약관(`/agreement`) 주의 사항**:
  - 사전 승인 없는 영리/광고/수익 창출 활동 금지(운영비 충당 목적의 광고·자발적 기부는 사전 승인 후 허용 가능).
  - API 기반 서비스의 재판매 및 게임 정보 접근에 대한 과금 금지.
  - 콘텐츠 무단 보관/재배포 금지 조항이 약관에 포함되어 있으므로, 캐싱 구현 시 약관 준수 범위에 유의해야 합니다.

### 2.6 버전 관리 및 Deprecation

- **출처**: [Usage Guide](https://developer-lostark.game.onstove.com/usage-guide#api-versioning), [Changelog](https://developer-lostark.game.onstove.com/changelog)
- 엔드포인트 추가·제거 또는 호환되지 않는(breaking) 변경 시 포털 Changelog 버전을 올립니다(현재 **V10.0.0**).
- 게임 데이터 변경으로 인해 엔드포인트, 응답 필드, 파라미터가 **사전 공지 없이** deprecated/제거될 수 있으므로 `/changelog`를 수시로 확인해야 합니다.

---

## 3. 그룹별 엔드포인트 전체 목록

---

### 3.1 NEWS (3개)

- **출처**: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/news

#### 1) `GET /news/notices`
- **한 줄 설명**: 로스트아크 공식 공지사항 목록을 제목 키워드 및 분류별로 조회합니다.
- **OperationId**: `News_GetNotice`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 허용값 / 설명 |
  | --- | --- | --- | :---: | --- |
  | `query` | `searchText` | `string` | X | 공지 제목 검색 키워드 |
  | `query` | `type` | `string` | X | 공지 분류 (`공지`, `점검`, `상점`, `이벤트`) |
- **응답 주요 필드 (`200 OK`: `NoticeList[]`)**:
  - `Title` (`string`): 공지 제목
  - `Date` (`string`, `date-time`): 등록 일시
  - `Link` (`string`): 공지 페이지 URL
  - `Type` (`string`, enum: `공지` | `점검` | `상점` | `이벤트`): 공지 유형

#### 2) `GET /news/events`
- **한 줄 설명**: 현재 진행 중인 로스트아크 이벤트 목록을 조회합니다. (일 1회~주 1회 캐싱 권장)
- **OperationId**: `News_GetEvent`
- **파라미터**: 없음
- **응답 주요 필드 (`200 OK`: `Event[]`)**:
  - `Title` (`string`): 이벤트명
  - `Thumbnail` (`string`): 썸네일 이미지 URL
  - `Link` (`string`): 이벤트 페이지 링크
  - `StartDate` (`string`, `date-time`): 이벤트 시작일
  - `EndDate` (`string`, `date-time`): 이벤트 종료일
  - `RewardDate` (`string`, `date-time`, nullable): 보상 수령 기간

#### 3) `GET /news/alarms`
- **한 줄 설명**: Open API 서비스 사용자에게 전달할 전체/클라이언트별 공지·알람 목록을 조회합니다. (V6.0.0 추가)
- **OperationId**: `News_GetAlarms`
- **파라미터**: 없음
- **응답 주요 필드 (`200 OK`: `OpenAPIUserAlarm`)**:
  - `RequirePolling` (`boolean`): `true`이면 최소 30초 간격 폴링 권장, `false`이면 동작 불필요
  - `Alarms` (`OpenAPIUserAlarmContent[]`): 알람 목록
    - `AlarmType` (`string`, enum: `All` | `Client`): 알람 대상 구분
    - `Contents` (`string`): 알람 내용
    - `StartDate` (`string`, `date-time`): 시작 일시
    - `EndDate` (`string`, `date-time`, nullable): 종료 일시

---

### 3.2 CHARACTERS (1개)

- **출처**: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/characters

#### 1) `GET /characters/{characterName}/siblings`
- **한 줄 설명**: 지정한 캐릭터와 동일 계정(원정대)에 속한 모든 캐릭터의 기본 프로필 목록을 조회합니다.
- **OperationId**: `Characters_GetCharacters`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 조회할 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `CharacterInfo[]`)**:
  - `ServerName` (`string`): 서버명
  - `CharacterName` (`string`): 캐릭터명
  - `CharacterLevel` (`integer`, `int32`): 캐릭터 전투 레벨
  - `CharacterClassName` (`string`): 직업명
  - `ItemAvgLevel` (`string`): 장착 아이템 평균 레벨

---

### 3.3 ARMORIES (12개)

- **출처**: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories

#### 1) `GET /armories/characters/{characterName}`
- **한 줄 설명**: 캐릭터의 전투정보실 전체 데이터를 한 번에 조회하며, `filters` 쿼리로 필요한 섹션만 선택할 수 있습니다. (V3.0.0 추가)
- **OperationId**: `Armories_GetProfileAll`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
  | `query` | `filters` | `string` | X | 조회할 섹션을 `+`로 구분해 지정 (예: `profiles+equipment+avatars+combat-skills+engravings+cards+gems+colosseums+collectibles+arkpassive+arkgrid`) |
- **응답 주요 필드 (`200 OK`: `ArmoryProfileAll`)**:
  - `ArmoryProfile` (`ArmoryProfile`): 기본 프로필
  - `ArmoryEquipment` (`ArmoryEquipment[]`): 장착 장비
  - `ArmoryAvatars` (`ArmoryAvatar[]`): 장착 아바타
  - `ArmorySkills` (`ArmorySkill[]`): 전투 스킬
  - `ArmoryEngraving` (`ArmoryEngraving`): 각인
  - `ArmoryCard` (`ArmoryCard`): 카드
  - `ArmoryGem` (`ArmoryGem`): 보석
  - `ArkPassive` (`ArkPassive`): 아크 패시브
  - `ArkGrid` (`ArkGrid`): 아크 그리드
  - `ColosseumInfo` (`ColosseumInfo`): 증명의 전장 전적
  - `Collectibles` (`Collectible[]`): 수집형 포인트

#### 2) `GET /armories/characters/{characterName}/profiles`
- **한 줄 설명**: 캐릭터의 기본 정보, 능력치, 성향, 전투력, 명예 포인트, 길드·영지 정보 등을 조회합니다.
- **OperationId**: `Armories_GetProfileInfo`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArmoryProfile`)**:
  - 기본 정보: `ServerName`, `CharacterName`, `CharacterLevel`(`int32`), `CharacterClassName`, `ItemAvgLevel`(`string`), `CharacterImage`(`string`), `Title`(`string`), `ExpeditionLevel`(`int32`)
  - 영지·길드: `TownLevel`(`int32`, nullable), `TownName`(`string`), `GuildName`(`string`), `GuildMemberGrade`(`string`)
  - 스킬 포인트·전투력·명예: `UsingSkillPoint`(`int32`), `TotalSkillPoint`(`int32`), `CombatPower`(`string`, V8.0.0 추가), `HonorPoint`(`int32`, V9.0.0 추가)
  - 꾸미기: `Decorations` (`Symbol`: `string`, `Emblems`: `string[]`, V8.0.0 추가)
  - 능력치: `Stats[]` (`Type`, `Value`, `Tooltip`: `string[]`)
  - 성향: `Tendencies[]` (`Type`, `Point`: `int32`, `MaxPoint`: `int32`)
  - ※ 참고: 과거 존재하던 `ArkPassive`(V5.0.0 제거), `ItemMaxLevel`(V8.0.0 제거), `PvpGradeName`(V10.0.0 제거) 필드는 현재 스펙에서 제거되었습니다.

#### 3) `GET /armories/characters/{characterName}/equipment`
- **한 줄 설명**: 캐릭터가 장착 중인 장비(무기, 방어구, 장신구, 어빌리티 스톤, 팔찌 등) 목록과 툴팁을 조회합니다.
- **OperationId**: `Armories_GetEquipment`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArmoryEquipment[]`)**:
  - `Type` (`string`): 장비 부위/유형
  - `Name` (`string`): 장비명
  - `Icon` (`string`): 아이콘 URL
  - `Grade` (`string`): 등급
  - `Tooltip` (`string`): 상세 툴팁 문자열 (내부 구조는 공식 스키마 **미확인**)

#### 4) `GET /armories/characters/{characterName}/avatars`
- **한 줄 설명**: 캐릭터가 장착 중인 아바타 목록과 덧입기/세트 여부를 조회합니다.
- **OperationId**: `Armories_GetAvatars`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArmoryAvatar[]`)**:
  - `Type` (`string`): 아바타 부위
  - `Name` (`string`): 아바타명
  - `Icon` (`string`): 아이콘 URL
  - `Grade` (`string`): 등급
  - `IsSet` (`boolean`): 세트 여부
  - `IsInner` (`boolean`): 내부(성능용) 아바타 여부
  - `Tooltip` (`string`): 상세 툴팁 문자열

#### 5) `GET /armories/characters/{characterName}/combat-skills`
- **한 줄 설명**: 캐릭터의 전투 스킬, 선택한 트라이포드, 장착 스킬 룬 정보를 조회합니다.
- **OperationId**: `Armories_GetSkills`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArmorySkill[]`)**:
  - `Name` (`string`), `Icon` (`string`), `Level` (`int32`), `Type` (`string`), `SkillType` (`int32`, V5.0.0 추가), `Tooltip` (`string`)
  - `Tripods[]` (`SkillTripod`): `Tier`(`int32`), `Slot`(`int32`), `Name`(`string`), `Icon`(`string`), `IsSelected`(`boolean`), `Tooltip`(`string`) *(※ `Level` 필드는 V8.0.0에서 제거됨)*
  - `Rune` (`SkillRune`): `Name`(`string`), `Icon`(`string`), `Grade`(`string`), `Tooltip`(`string`)

#### 6) `GET /armories/characters/{characterName}/engravings`
- **한 줄 설명**: 캐릭터가 장착한 각인, 활성 각인 효과, 아크 패시브 각인 효과를 조회합니다.
- **OperationId**: `Armories_GetEngrave`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArmoryEngraving`)**:
  - `Engravings[]` (`Engraving`): `Slot`(`int32`), `Name`(`string`), `Icon`(`string`), `Tooltip`(`string`)
  - `Effects[]` (`EngravingEffect`): `Icon`(`string`), `Name`(`string`), `Description`(`string`)
  - `ArkPassiveEffects[]` (`ArkPassiveEffect`, V4.0.0 추가): `AbilityStoneLevel`(`int32`, nullable), `Grade`(`string`), `Level`(`int32`), `Name`(`string`), `Description`(`string`)

#### 7) `GET /armories/characters/{characterName}/cards`
- **한 줄 설명**: 캐릭터가 장착 중인 카드 목록과 활성화된 카드 세트 효과를 조회합니다.
- **OperationId**: `Armories_GetCard`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArmoryCard`)**:
  - `Cards[]` (`Card`): `Slot`(`int32`), `Name`(`string`), `Icon`(`string`), `AwakeCount`(`int32`), `AwakeTotal`(`int32`), `Grade`(`string`), `Tooltip`(`string`)
  - `Effects[]` (`CardEffect`): `Index`(`int32`), `CardSlots`(`int32[]`), `Items[]` (`Effect`: `Name`, `Description`)

#### 8) `GET /armories/characters/{characterName}/gems`
- **한 줄 설명**: 캐릭터가 장착한 보석 목록과 보석으로 적용되는 스킬 효과를 조회합니다.
- **OperationId**: `Armories_GetGem`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArmoryGem`)**:
  - `Gems[]` (`Gem`): `Slot`(`int32`), `Name`(`string`), `Icon`(`string`), `Level`(`int32`), `Grade`(`string`), `Tooltip`(`string`)
  - `Effects` (`ArmoryGemEffect`, V4.0.0 구조 변경):
    - `Description` (`string`)
    - `Skills[]` (`GemEffect`): `GemSlot`(`int32`), `Name`(`string`), `Description`(`string[]`), `Option`(`string`), `Icon`(`string`), `Tooltip`(`string`)

#### 9) `GET /armories/characters/{characterName}/colosseums`
- **한 줄 설명**: 캐릭터의 증명의 전장(PvP) 시즌별·모드별 전적 정보를 조회합니다.
- **OperationId**: `Armories_GetColosseumInfo`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ColosseumInfo`)**:
  - `Colosseums[]` (`Colosseum`):
    - `SeasonName` (`string`)
    - `Competitive` (`AggregationTeamDeathMatchRank`): `Rank`, `RankName`, `RankIcon`, `RankLastMmr`, `PlayCount`, `VictoryCount`, `LoseCount`, `TieCount`, `KillCount`, `AceCount`, `DeathCount`
    - `TeamDeathmatch` (`AggregationTeamDeathMatch`): `AssistCount` + 기본 전적(`PlayCount`, `VictoryCount`, `LoseCount`, `TieCount`, `KillCount`, `AceCount`, `DeathCount`)
    - `TeamElimination` (`AggregationElimination`): `First/Second/ThirdWinCount`, `First/Second/ThirdPlayCount`, `AllKillCount` + 기본 전적
    - `CoOpBattle` (`Aggregation`): 기본 전적(`PlayCount`, `VictoryCount`, `LoseCount`, `TieCount`, `KillCount`, `AceCount`, `DeathCount`)
    - `OneDeathmatch`, `OneDeathmatchRank` (`AggregationOneDeathmatch`): `KillCount`, `DeathCount`, `AllKillCount`, `OutDamage`(`int64`), `InDamage`(`int64`), `First/Second/ThirdWinCount`, `First/Second/ThirdPlayCount`
  - ※ 참고: 과거 `Deathmatch`(V5.1.0), `Rank`/`PreRank`/`Exp`(V10.0.0) 필드는 제거되었습니다.

#### 10) `GET /armories/characters/{characterName}/collectibles`
- **한 줄 설명**: 캐릭터의 수집형 포인트(섬의 마음, 오르페우스의 별, 모코코 씨앗 등) 획득 현황을 조회합니다.
- **OperationId**: `Armories_GetCollections`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `Collectible[]`)**:
  - `Type` (`string`): 수집형 포인트 종류
  - `Icon` (`string`): 아이콘 URL
  - `Point` (`int32`): 현재 획득 수
  - `MaxPoint` (`int32`): 최대 획득 수
  - `CollectiblePoints[]` (`CollectiblePoint`): 개별 항목별 `PointName`(`string`), `Point`(`int32`), `MaxPoint`(`int32`)

#### 11) `GET /armories/characters/{characterName}/arkpassive`
- **한 줄 설명**: 캐릭터의 아크 패시브 활성화 여부, 진화/깨달음/도약 포인트 및 적용 효과를 조회합니다. (V5.0.0 추가)
- **OperationId**: `Armories_GetArkPassive`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArkPassive`)**:
  - `Title` (`string`): 아크 패시브 타이틀
  - `IsArkPassive` (`boolean`): 아크 패시브 활성화 여부
  - `Points[]` (`ArkPassivePoint`): `Name`(`string`), `Value`(`int32`), `Tooltip`(`string`), `Description`(`string`, V8.0.0 추가)
  - `Effects[]` (`ArkPassiveEffectSkill`): `Name`(`string`), `Description`(`string`), `Icon`(`string`), `ToolTip`(`string`) *(※ 대소문자 표기 `ToolTip` 주의)*

#### 12) `GET /armories/characters/{characterName}/arkgrid`
- **한 줄 설명**: 캐릭터의 아크 그리드 슬롯, 장착 젬 및 활성화 효과를 조회합니다. (V9.0.0 추가)
- **OperationId**: `Armories_GetArkGrid`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `characterName` | `string` | O | 캐릭터명 |
- **응답 주요 필드 (`200 OK`: `ArkGrid`)**:
  - `Slots[]` (`ArkGridSlot`): `Index`(`int32`), `Icon`(`string`), `Name`(`string`), `Point`(`int32`), `Grade`(`string`), `Tooltip`(`string`), `Gems[]` (`ArkGridGem`: `Index`(`int32`), `Icon`(`string`), `IsActive`(`boolean`), `Grade`(`string`), `Tooltip`(`string`))
  - `Effects[]` (`ArkGridEffect`): `Name`(`string`), `Level`(`int32`), `Tooltip`(`string`)

---

### 3.4 AUCTIONS (2개)

- **출처**: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/auctions

#### 1) `GET /auctions/options`
- **한 줄 설명**: 경매장 검색 시 사용하는 카테고리, 등급, 티어, 클래스, 스킬/기타 옵션 목록을 조회합니다. (일 1회~주 1회 캐싱 권장)
- **OperationId**: `Auctions_GetOptions`
- **파라미터**: 없음
- **응답 주요 필드 (`200 OK`: `AuctionOption`)**:
  - `MaxItemLevel` (`int32`): 검색 가능한 최대 아이템 레벨
  - `ItemGradeQualities` (`int32[]`): 품질 필터 목록
  - `SkillOptions[]` (`SkillOption`): `Value`(`int32`), `Class`(`string`), `Text`(`string`), `IsSkillGroup`(`boolean`), `Tripods[]` (`Tripod`: `Value`, `Text`, `IsGem`(`boolean`), `Tiers`(`int32[]`))
  - `EtcOptions[]` (`EtcOption`): `Value`(`int32`), `Text`(`string`), `Tiers`(`int32[]`), `EtcSubs[]` (`EtcSub`: `Value`, `Text`, `Class`, `Categorys`(`int32[]`, ※ 스펙 원문 철자 `Categorys`), `Tiers`(`int32[]`), `EtcValues[]` (`DisplayValue`, `Value`, `IsPercentage`))
  - `Categories[]` (`Category`): `Code`(`int32`), `CodeName`(`string`), `Subs[]` (`CategoryItem`: `Code`, `CodeName`)
  - `ItemGrades` (`string[]`), `ItemTiers` (`int32[]`), `Classes` (`string[]`)

#### 2) `POST /auctions/items`
- **한 줄 설명**: 지정한 검색 조건에 해당하는 현재 경매장 등록 매물 목록을 조회합니다.
- **OperationId**: `Auctions_GetItems`
- **파라미터**:
  - **Body** (`requestAuctionItems`, `application/json`, 필수: O, 스키마: `RequestAuctionItems`):
    | 필드 | 타입 | 허용값 / 설명 |
    | --- | --- | --- |
    | `ItemLevelMin` | `int32` | 최소 아이템 레벨 |
    | `ItemLevelMax` | `int32` | 최대 아이템 레벨 |
    | `ItemGradeQuality` | `int32` (nullable) | 최소 품질 |
    | `ItemUpgradeLevel` | `int32` (nullable) | 연마 단계 |
    | `ItemTradeAllowCount` | `int32` (nullable) | 거래 가능 횟수 |
    | `SkillOptions` | `SearchDetailOption[]` | 스킬 상세 옵션 (`FirstOption`, `SecondOption`, `MinValue`, `MaxValue` 모두 `int32`, nullable) |
    | `EtcOptions` | `SearchDetailOption[]` | 기타 상세 옵션 (`FirstOption`, `SecondOption`, `MinValue`, `MaxValue` 모두 `int32`, nullable) |
    | `Sort` | `string` (enum) | `BIDSTART_PRICE`, `BUY_PRICE`, `EXPIREDATE`, `ITEM_GRADE`, `ITEM_LEVEL`, `ITEM_QUALITY` |
    | `CategoryCode` | `int32` | 카테고리 코드 (`/auctions/options` 참조) |
    | `CharacterClass` | `string` | 직업명 |
    | `ItemTier` | `int32` (nullable) | 아이템 티어 |
    | `ItemGrade` | `string` | 아이템 등급 |
    | `ItemName` | `string` | 아이템명 검색어 |
    | `PageNo` | `int32` | 페이지 번호 (시작 인덱스 0/1 여부 스펙상 **미확인**) |
    | `SortCondition` | `string` (enum) | `ASC`, `DESC` |
    *(※ 개별 하위 필드의 필수 여부는 Swagger `required` 배열이 비어 있어 **미확인**.)*
- **응답 주요 필드 (`200 OK`: `Auction`)**:
  - `PageNo` (`int32`), `PageSize` (`int32`), `TotalCount` (`int64`)
  - `Items[]` (`AuctionItem`):
    - 기본: `Name`, `Grade`, `Tier`(`int32`), `Level`(`int32`, nullable), `Icon`, `GradeQuality`(`int32`, nullable)
    - `AuctionInfo`: `StartPrice`(`int64`), `BuyPrice`(`int64`, nullable), `BidPrice`(`int64`), `EndDate`(`date-time`), `BidCount`(`int32`), `BidStartPrice`(`int64`), `IsCompetitive`(`boolean`), `TradeAllowCount`(`int32`), `UpgradeLevel`(`int32`, nullable)
    - `Options[]` (`ItemOption`): `Type` (enum: `None`, `SKILL`, `STAT`, `ABILITY_ENGRAVE`, `BRACELET_SPECIAL_EFFECTS`, `GEM_SKILL_DAMAGE`, `GEM_SKILL_COOLDOWN_REDUCTION`, `GEM_SKILL_SUPPORT`, `ACCESSORY_UPGRADE`, `ARK_PASSIVE`, `BRACELET_RANDOM_SLOT`), `OptionName`, `OptionNameTripod`, `Value`(`double`), `IsPenalty`(`boolean`), `ClassName`, `IsValuePercentage`(`boolean`)

---

### 3.5 MARKETS (4개)

- **출처**: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/markets

#### 1) `GET /markets/options`
- **한 줄 설명**: 거래소 검색 시 사용하는 카테고리, 등급, 티어, 클래스 옵션 목록을 조회합니다. (일 1회~주 1회 캐싱 권장)
- **OperationId**: `Markets_GetOptions`
- **파라미터**: 없음
- **응답 주요 필드 (`200 OK`: `MarketOption`)**:
  - `Categories[]` (`Category`): `Code`(`int32`), `CodeName`(`string`), `Subs[]` (`CategoryItem`: `Code`, `CodeName`)
  - `ItemGrades` (`string[]`): 아이템 등급 목록
  - `ItemTiers` (`int32[]`): 아이템 티어 목록
  - `Classes` (`string[]`): 클래스 목록

#### 2) `GET /markets/items/{itemId}`
- **한 줄 설명**: 특정 거래소 아이템 ID의 일자별 평균 거래가·거래량 통계와 툴팁 정보를 조회합니다.
- **OperationId**: `Markets_GetStats`
- **파라미터**:
  | 위치 | 이름 | 타입 | 필수 | 설명 |
  | --- | --- | --- | :---: | --- |
  | `path` | `itemId` | `integer` (`int64`) | O | 거래소 아이템 ID (`POST /markets/items` 응답의 `Id`) |
- **응답 주요 필드 (`200 OK`: `MarketItemStats[]`)**:
  - `Name` (`string`): 아이템명
  - `TradeRemainCount` (`int32`, nullable): 거래 가능 횟수
  - `BundleCount` (`int32`): 묶음 단위 개수
  - `Stats[]` (`MarketStatsInfo`): 일자별 거래 통계 (`Date`: `string`, `AvgPrice`: `double`, `TradeCount`: `int32`)
  - `ToolTip` (`string`): 아이템 툴팁 문자열 (V1.1.0 추가, ※ 대소문자 `ToolTip` 주의)

#### 3) `POST /markets/items`
- **한 줄 설명**: 지정한 검색 조건에 해당하는 현재 거래소 등록 아이템 목록 및 시세 정보를 조회합니다.
- **OperationId**: `Markets_GetItems`
- **파라미터**:
  - **Body** (`requestMarketItems`, `application/json`, 필수: O, 스키마: `RequestMarketItems`):
    | 필드 | 타입 | 허용값 / 설명 |
    | --- | --- | --- |
    | `Sort` | `string` (enum) | `GRADE`, `YDAY_AVG_PRICE`, `RECENT_PRICE`, `CURRENT_MIN_PRICE` |
    | `CategoryCode` | `int32` | 카테고리 코드 (`/markets/options` 참조) |
    | `CharacterClass` | `string` | 직업명 |
    | `ItemTier` | `int32` (nullable) | 아이템 티어 |
    | `ItemGrade` | `string` | 아이템 등급 |
    | `ItemName` | `string` | 아이템명 검색어 |
    | `PageNo` | `int32` | 페이지 번호 (시작 인덱스 0/1 여부 스펙상 **미확인**) |
    | `SortCondition` | `string` (enum) | `ASC`, `DESC` |
    *(※ 개별 하위 필드의 필수 여부는 Swagger `required` 배열이 비어 있어 **미확인**.)*
- **응답 주요 필드 (`200 OK`: `MarketList`)**:
  - `PageNo` (`int32`), `PageSize` (`int32`), `TotalCount` (`int32`)
  - `Items[]` (`MarketItem`): `Id`(`int64`), `Name`(`string`), `Grade`(`string`), `Icon`(`string`), `BundleCount`(`int32`), `TradeRemainCount`(`int32`, nullable), `YDayAvgPrice`(`double`), `RecentPrice`(`int32`), `CurrentMinPrice`(`int32`)

#### 4) `POST /markets/trades`
- **한 줄 설명**: 지정한 검색 조건에 해당하는 거래소 최근 거래 아이템 목록을 조회합니다. (V10.0.0 추가)
- **OperationId**: `Markets_GetTrades`
- **비고**: `/changelog` V10.0.0 본문에는 `POST /market/trades`로 오기되어 있으나, 공식 Swagger JSON 스펙상 실제 경로는 **`POST /markets/trades`**입니다.
- **파라미터**:
  - **Body** (`requestMarketItems`, `application/json`, 필수: O, 스키마: `RequestMarketItems`): `POST /markets/items`와 동일
- **응답 주요 필드 (`200 OK`: `MarketTradeList`)**:
  - `PageNo` (`int32`), `PageSize` (`int32`), `TotalCount` (`int32`)
  - `Items[]` (`TradeMarketItem`): `Id`(`int64`), `Name`(`string`), `Grade`(`string`), `Icon`(`string`), `BundleCount`(`int32`), `TradeRemainCount`(`int32`, nullable), `YDayAvgPrice`(`double`), `RecentPrice`(`int32`) *(※ `MarketItem`과 달리 `CurrentMinPrice` 필드가 없음)*

---

### 3.6 GAMECONTENTS (1개)

- **출처**: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/gamecontents

#### 1) `GET /gamecontents/calendar`
- **한 줄 설명**: 이번 주 로스트아크 게임 콘텐츠(모험 섬, 필드보스, 카오스게이트 등) 일정과 레벨별 보상 정보를 조회합니다.
- **OperationId**: `GameContents_GetContentsCalendar`
- **파라미터**: 없음
- **응답 주요 필드 (`200 OK`: `ContentsCalendar[]`)**:
  - `CategoryName` (`string`): 콘텐츠 카테고리명
  - `ContentsName` (`string`): 콘텐츠명
  - `ContentsIcon` (`string`): 콘텐츠 아이콘 URL
  - `MinItemLevel` (`int32`): 최소 입장 아이템 레벨
  - `StartTimes` (`string[]`, `date-time`): 시작 일시 목록
  - `Location` (`string`): 위치
  - `RewardItems[]` (`LevelRewardItems`, V4.0.0 아이템 레벨별 세분화):
    - `ItemLevel` (`int32`): 보상 기준 아이템 레벨
    - `Items[]` (`RewardItem`): `Name`(`string`), `Icon`(`string`), `Grade`(`string`), `StartTimes`(`string[]`, `date-time`)

---

### 3.7 제거된 그룹 및 엔드포인트 (Changelog 기준)

- **출처**: https://developer-lostark.game.onstove.com/changelog, https://developer-lostark.game.onstove.com/getting-started

| 그룹 | 메서드 및 경로 | 추가 버전 | 제거 버전 | 비고 |
| --- | --- | :---: | :---: | --- |
| **GUILDS** | `GET /guilds/rankings` | V1.0.0 | **V4.0.0** | 길드 랭킹 API 제거. 현재 `/getting-started` 사이드바 및 `/swagger-doc/endpoints/guilds`에서 제공되지 않음. (단, `/usage-guide` GET 예시에 `serverName` 쿼리 파라미터 사용 흔적이 남아 있음. 응답 스키마는 **미확인**.) |
| **GAMECONTENTS** | `GET /gamecontents/challenge-abyss-dungeons` | V2.0.0 | **V7.0.0** | 도전 어비스 던전 API 제거. 상세 스키마 **미확인**. |
| **GAMECONTENTS** | `GET /gamecontents/challenge-guardian-raids` | V2.0.0 | **V7.0.0** | 도전 가디언 토벌 API 제거. 상세 스키마 **미확인**. |

---

## 4. 미확인 항목 정리

공식 개발자 포털 페이지 및 Swagger JSON 스펙에 명시되어 있지 않으며, API 키를 이용한 실제 호출을 수행하지 않았기 때문에 아래 항목은 **미확인** 상태입니다.

1. **에러 응답 본문 스키마**: HTTP 상태 코드(`400`~`504`)의 실제 응답 JSON 형식(예: 에러 메시지 필드명, 에러 코드 체계 등)은 Swagger 스펙 및 `/usage-guide`에 정의되지 않음.
2. **POST 요청 본문 내부 필드별 필수 여부 및 기본값**: `RequestAuctionItems`, `RequestMarketItems` 스키마에 `required` 목록과 기본값이 명시되지 않음. 또한 `PageNo`의 시작 값(0 기준인지 1 기준인지) 및 기본 `PageSize`도 문서에 미기재.
3. **존재하지 않는 리소스 조회 시 실제 응답 동작**: 존재하지 않는 `characterName` 또는 `itemId` 조회 시 `200 OK`로 `null`/빈 배열을 반환하는지, `404 Not Found`를 반환하는지 공식 문서에 명시되지 않음.
4. **URL 인코딩 및 대소문자 처리 규칙**: `/usage-guide` 예시에 한글 쿼리 파라미터 퍼센트 인코딩(`%EB%A3%A8%ED%8E%98%EC%98%A8`)이 보이나, `characterName` 경로 파라미터의 인코딩 요구 사항이나 대소문자 구분 여부는 공식 문서에 별도 설명 없음.
5. **HTTP 캐시 헤더 제공 여부 및 엔드포인트별 정확한 캐시 TTL**: 서버가 `Cache-Control`·`ETag` 등을 반환하는지 여부와 각 엔드포인트별 데이터 갱신 주기는 명시되지 않음(단, `/usage-guide`의 3개 정적 API 캐싱 권장 및 `/faq`의 수 분 지연 안내만 확인됨).
6. **Rate Limit 상향 승인 시 최대 한도 기준**: 기본 분당 100회 외 상향 신청(`REQUEST FOR MONETIZATION & LIMIT INCREASE`) 승인 시 적용되는 최대 허용치는 비공개.
7. **`Tooltip` / `ToolTip` 문자열 내부 구조**: `ArmoryEquipment.Tooltip`, `ArmoryAvatar.Tooltip`, `ArmorySkill.Tooltip`, `MarketItemStats.ToolTip` 등은 Swagger 스펙상 단순 `string`으로만 정의되어 있으며, 내부 JSON/HTML 마크업 구조에 대한 공식 스키마 문서는 없음.
8. **제거된 엔드포인트의 과거 스키마**: `GET /guilds/rankings`, `GET /gamecontents/challenge-abyss-dungeons`, `GET /gamecontents/challenge-guardian-raids`의 과거 파라미터 및 응답 스키마는 현재 포털 Swagger에서 제거되어 확인 불가.

---

## 5. 출처 URL 목록

- 개발자 포털 메인: https://developer-lostark.game.onstove.com/
- Getting Started (API 목록·인증·Throttling): https://developer-lostark.game.onstove.com/getting-started
- Usage Guide (요청 예시·에러 코드·캐싱·RateLimit 헤더·API Status·버전 관리): https://developer-lostark.game.onstove.com/usage-guide
- Changelog (V1.0.0 ~ V10.0.0 변경 이력): https://developer-lostark.game.onstove.com/changelog
- FAQ: https://developer-lostark.game.onstove.com/faq
- 이용약관 (Terms of Service): https://developer-lostark.game.onstove.com/agreement
- Swagger JSON — NEWS: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/news
- Swagger JSON — CHARACTERS: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/characters
- Swagger JSON — ARMORIES: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories
- Swagger JSON — AUCTIONS: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/auctions
- Swagger JSON — MARKETS: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/markets
- Swagger JSON — GAMECONTENTS: https://developer-lostark.game.onstove.com/swagger-doc/endpoints/gamecontents
