# 로스트아크 아크 패시브 각인 공식 아이콘 URL 조사

- **조사 일자**: 2026-11-25
- **대응표 파일**: `research/engraving-icons/engraving-icons.json`
- **대응 현황**: 현행 전투 각인 **43 / 43종** 전체 매핑 완료 (공식 CDN HTTP 200 / PNG 검증 43성공, 0실패)

---

## 1. 배경 및 `Engravings[].Icon` 아크 패시브 이후 동작 근거

Ark Lens의 각인 카드는 `GET /armories/characters/{characterName}/engravings` 응답의 `ArkPassiveEffects[]`(`Name`, `Grade`, `Level`, `AbilityStoneLevel`, `Description`)를 사용하지만, 이 모델에는 아이콘 URL 필드가 없다.

### 아크 패시브 이후 `Engravings[].Icon` 채워짐 여부
- **결론: 아크 패시브가 적용된 현행 캐릭터에서는 `Engravings`와 `Effects`가 `null`로 내려오며 `Engravings[].Icon`을 얻을 수 없다.**
- **근거 1 (실제 V9.0.0 API 응답 샘플)**:
  - `artbiit/lostark-api-service` 저장소의 실제 공식 API V9.0.0 응답 샘플(`docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/engravings.json`, `armories/characters.json`, `tests/fixtures/armories/character-ark-passive.json`)에서 아크 패시브 활성 캐릭터는 다음과 같이 반환된다:
    ```json
    {
      "Engravings": null,
      "Effects": null,
      "ArkPassiveEffects": [
        { "AbilityStoneLevel": 4, "Grade": "유물", "Level": 4, "Name": "아드레날린", "Description": "..." },
        ...
      ]
    }
    ```
  - 해당 저장소의 2026-05-17 아크 패시브 전환 리라이트 문서(`docs/changes/2026-05-17-armories-arkpassive-rewrite.md`, `docs/work-log/2026-05-17-armories-arkpassive-rewrite/index.md`)에서도 아크 패시브 비활성 분기를 폐기하고 `ArkPassiveEffects` 단일 모드로 전환했음이 확인된다.
- **근거 2 (게임 시스템 패치)**:
  - 2024년 12월 18일 패치로 아크 패시브가 저레벨·T3 포함 전 구간에 확대 적용되면서, 현행 활성 캐릭터 대부분이 아크 패시브 각인 체계를 사용한다.
  - 레거시 `Engravings[].Icon`은 아크 패시브 전 구간 확대 이전에 마지막으로 접속해 갱신되지 않은 장기 미접속 캐릭터 등 극히 예외적인 경우에만 남아 있을 수 있다.

---

## 2. 현재 게임 내 각인 전체 목록 및 분류 기준

| 분류 | 개수 | `ArkPassiveEffects[]` 포함 여부 | `engraving-icons.json` 포함 여부 | 근거 |
| --- | ---: | :---: | :---: | --- |
| **전투 각인 (공용 각인)** | **43종** | **포함** | **포함 (43종)** | 공식 API V9 `auctions/options.json`(`EtcOptions` Value=3 `각인 효과`) 43종과 Lost Ark Codex KR(`type=battle`, 2026년 30개 클래스 기준 최신화) 43종이 ID·한글명 100% 일치 |
| **직업 각인 (구 시즌2)** | 52종(폐지) | 미포함 | 제외 | 시즌3 아크 패시브에서 직업 각인·각인서 폐지 후 아크 패시브 `[깨달음]` 노드로 완전 이관. 공식 API V9 `auctions/options.json` `각인 효과` 목록에서도 제거됨 |
| **감소 효과 (페널티)** | 4종 | 미포함 | 제외 | `공격력 감소`(800), `방어력 감소`(801), `공격속도 감소`(802), `이동속도 감소`(803). 공식 API에서 `EtcOptions` Value=6(`감소 효과`)로 분리되며, 아크 패시브 환경에서는 어빌리티 스톤 장비 툴팁(`ArmoryEquipment`)에만 표시되고 `ArkPassiveEffects[]`에는 미포함(`artbiit/lostark-api-service` 동일 캐릭터 `equipment.json` + `engravings.json` 대조 확인) |

> **표기 주의 (`실드관통`)**: 공식 API `auctions/options.json`(ID 237) 및 Lost Ark Codex 모두 띄어쓰기 없이 **`실드관통`**으로 표기한다(일부 커뮤니티 계산기에서 쓰는 `실드 관통`과 다름). 대응표 키는 공식 API 문자열과 정확히 일치시켰다.

---

## 3. 출처 및 CDN 경로 규칙

### 주요 출처
1. **공식 API V9.0.0 실제 응답 샘플**: [`artbiit/lostark-api-service`](https://github.com/artbiit/lostark-api-service)
   - `docs/contracts/upstream-lostark-api/V9.0.0/sample-data/auctions/options.json` — 현행 전투 각인 43종 공식 ID 및 한글명, 감소 효과 4종
   - `docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/engravings.json`, `characters.json`, `equipment.json` — `Engravings: null` 및 `ArkPassiveEffects[]` 구조, 어빌리티 스톤 툴팁 확인
   - `docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/combat-skills.json`, `equipment.json` — 공식 API가 반환하는 CDN URL 소문자 규칙 확인
2. **게임 클라이언트 아이콘 아틀라스 매핑**: Lost Ark Codex KR (`https://lostarkcodex.com/query.php?a=engravings&type=battle&l=kr`)
   - 2026년 최신 클래스(환수사, 발키리, 차원술사, 가디언나이트 포함 총 30개 클래스)까지 반영된 KR 클라이언트 추출 DB
   - 공식 API `auctions/options.json`과 43/43 ID·이름 100% 일치
3. **공개 오픈소스·커뮤니티 교차 검증**:
   - [`Jung-Hwi-Hak/lost-ark`](https://github.com/Jung-Hwi-Hak/lost-ark) (`src/utils/efuiData.ts`) — 전투 각인 22종 공식 CDN URL 매핑 수록, **22/22(100%) 완전 일치**
   - 커뮤니티 API 연동 자료(Tistory 등) — `원한`(`buff_71`), `아드레날린`(`ability_235`), `바리케이드`(`buff_170`), `결투의 대가`(`ability_224`) 추가 확인
   - 2021년 추가 전투 각인 10종(ID `288`, `295`~`303`)의 `ability_(ID - 64)` 연속 인덱스 규칙 일치 확인
4. **공식 이미지 CDN 직접 검증**: `https://cdn-lostark.game.onstove.com/efui_iconatlas/...` (API 키 불필요)

### 공식 CDN URL 규칙
- 형식: `https://cdn-lostark.game.onstove.com/efui_iconatlas/<폴더>/<파일명>.png`
- 전투 각인 43종은 다음 3개 아틀라스 폴더에 분포한다:
  - `buff/buff_<번호>.png` — **29종** (`64×64` PNG)
  - `ability/ability_<번호>.png` — **10종** (`64×64` PNG, 2021년 추가 각인군: `ID - 64` 번호 일치)
  - `achieve/achieve_<그룹>_<번호>.png` — **4종** (`128×128` PNG: 약자 무시, 슈퍼 차지, 예리한 둔기, 선수필승)
- **대소문자**: CDN 서버는 소문자(`efui_iconatlas/buff/buff_71.png`)와 대소문자 혼용(`EFUI_IconAtlas/Buff/Buff_71.png`) 모두 HTTP 200을 반환하나, 공식 API V9 응답(`combat-skills.json`, `equipment.json`)이 **전부 소문자** 경로를 반환하므로 `engraving-icons.json`은 소문자 표준으로 통일했다.

---

## 4. URL 확인 방법 및 검증 결과

API 키 없이 `engraving-icons.json`의 43개 URL 전체에 대해 2026-11-25 기준 직접 검증을 수행했다.

- **HTTP 상태 및 헤더 검증 (`curl -I` / GET)**:
  - **성공: 43 / 43 (100%)**
  - **실패: 0 / 43**
  - 전 항목 `HTTP/1.1 200 OK`, `Content-Type: image/png`
  - 응답 헤더 확인: `Access-Control-Allow-Origin: *`, 외부 `Referer` 헤더 포함 요청도 차단 없이 `200 OK`, `ETag` / `Last-Modified` 지원
- **PNG 바이너리 무결성 검증**:
  - 전 항목 PNG 시그니처(`89 50 4E 47`) 확인, 크기 `8,147B` ~ `45,314B`
  - IHDR 해상도 분포: `64×64` 39개, `128×128` 4개(`achieve_*` 4종)

### 전체 43종 대응표 및 검증 상세

| 공식 ID | 각인명 | 아이콘 경로 (`efui_iconatlas/...`) | 해상도 | CDN 검증 | 교차 검증 출처 |
| ---: | --- | --- | :---: | :---: | --- |
| 255 | 각성 | `buff/buff_113.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 243 | 강령술 | `buff/buff_29.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 242 | 강화 방패 | `buff/buff_239.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 288 | 결투의 대가 | `ability/ability_224.png` | 64×64 | 200 PNG | Codex + 커뮤니티 API 자료 + `ID-64` 규칙 |
| 134 | 구슬동자 | `buff/buff_18.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 123 | 굳은 의지 | `buff/buff_44.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 142 | 급소 타격 | `buff/buff_168.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 249 | 기습의 대가 | `buff/buff_148.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 302 | 긴급구조 | `ability/ability_238.png` | 64×64 | 200 PNG | Codex + `ID-64` 연속 규칙 |
| 238 | 달인의 저력 | `buff/buff_147.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 254 | 돌격대장 | `buff/buff_210.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 168 | 마나 효율 증가 | `buff/buff_166.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 251 | 마나의 흐름 | `buff/buff_63.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 253 | 바리케이드 | `buff/buff_170.png` | 64×64 | 200 PNG | Codex + 커뮤니티 API 자료 |
| 246 | 번개의 분노 | `buff/buff_191.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 245 | 부러진 뼈 | `buff/buff_94.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 236 | 분쇄의 주먹 | `buff/buff_83.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 235 | 불굴 | `buff/buff_66.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 244 | 선수필승 | `achieve/achieve_08_62.png` | 128×128 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 300 | 속전속결 | `ability/ability_236.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` + `ID-64` |
| 121 | 슈퍼 차지 | `achieve/achieve_06_14.png` | 128×128 | 200 PNG | Codex (2차 소스 미확보) |
| 248 | 승부사 | `buff/buff_136.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 298 | 시선 집중 | `ability/ability_234.png` | 64×64 | 200 PNG | Codex + `ID-64` 연속 규칙 |
| 237 | 실드관통 | `buff/buff_89.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 299 | 아드레날린 | `ability/ability_235.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` + `ID-64` |
| 111 | 안정된 상태 | `buff/buff_105.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 107 | 약자 무시 | `achieve/achieve_04_30.png` | 128×128 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 110 | 에테르 포식자 | `buff/buff_74.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 239 | 여신의 가호 | `buff/buff_229.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 141 | 예리한 둔기 | `achieve/achieve_03_40.png` | 128×128 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 118 | 원한 | `buff/buff_71.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 140 | 위기 모면 | `buff/buff_162.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 247 | 저주받은 인형 | `buff/buff_237.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 301 | 전문의 | `ability/ability_237.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` + `ID-64` |
| 109 | 정기 흡수 | `buff/buff_65.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 303 | 정밀 단도 | `ability/ability_239.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` + `ID-64` |
| 240 | 중갑 착용 | `buff/buff_46.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 295 | 질량 증가 | `ability/ability_231.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` + `ID-64` |
| 167 | 최대 마나 증가 | `buff/buff_122.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` |
| 296 | 추진력 | `ability/ability_232.png` | 64×64 | 200 PNG | Codex + `ID-64` 연속 규칙 |
| 297 | 타격의 대가 | `ability/ability_233.png` | 64×64 | 200 PNG | Codex + `Jung-Hwi-Hak/lost-ark` + `ID-64` |
| 202 | 탈출의 명수 | `buff/buff_10.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |
| 241 | 폭발물 전문가 | `buff/buff_121.png` | 64×64 | 200 PNG | Codex (2차 소스 미확보) |

---

## 5. 빠진 각인 및 미확인 항목

- **빠진 각인**: 현행 아크 패시브 전투 각인 43종 기준 **0건** (43/43 전체 대응).
- **2차 외부 소스 교차 미확인 16종**:
  - 위 표에서 `Codex (2차 소스 미확보)`로 표시한 16종(`강령술`, `강화 방패`, `굳은 의지`, `달인의 저력`, `번개의 분노`, `부러진 뼈`, `분쇄의 주먹`, `불굴`, `슈퍼 차지`, `실드관통`, `안정된 상태`, `에테르 포식자`, `여신의 가호`, `위기 모면`, `탈출의 명수`, `폭발물 전문가`)은 Lost Ark Codex 클라이언트 추출 DB 매핑과 공식 CDN HTTP 200 / PNG 무결성 검증은 완료했으나, 공개 오픈소스의 실제 `Engravings[].Icon` 응답 텍스트와의 2차 대조는 확보하지 못했다.
  - 다만 동일 DB 출처에서 대조한 24종(및 연속 인덱스 3종 포함 27종)이 **단 1건의 불일치도 없이 100% 일치**했으므로 정확도는 매우 높다. 앱 반영 전 QA 단계에서 16종 이미지를 육안으로 한 번 확인하면 완벽하다.
- **향후 신규 각인**: 게임 패치로 신규 전투 각인이 추가될 경우 정적 대응표에 수동 추가가 필요하다.

---

## 6. 라이선스 및 이용 주의

- **저작권 귀속**: 로스트아크 게임 내 아이콘 이미지 및 데이터의 모든 지식재산권·저작권은 **(주)스마일게이트알피지(Smilegate RPG, Inc.)**에 귀속된다.
- **재배포 금지 / 공식 CDN 직접 참조 권장**: PNG 파일을 앱 저장소에 다운로드해 복제·번들링하지 말고, 공식 Open API 응답과 동일한 방식인 공식 CDN(`https://cdn-lostark.game.onstove.com/...`) 직접 참조를 유지하는 것이 안전하다.
- **비공식 서비스 고지(Disclaimer)**: 앱 푸터 또는 정보 화면에 스마일게이트알피지와의 비제휴 및 게임 리소스 저작권 귀속 고지를 명시하는 것을 권장한다.
- **CDN 변경·장애 대비**: 스마일게이트 측의 CDN 경로 변경이나 일시적 네트워크 오류 가능성에 대비해 반드시 텍스트 폴백을 함께 구현한다.

---

## 7. Ark Lens 앱 적용 제안

1. **정적 매핑 포함**: `engraving-icons.json`(약 3.5KB)을 앱의 정적 데이터 모듈(예: `src/data/engraving-icons.json` 또는 `ENGRAVING_ICON_MAP`)로 포함해 네트워크 추가 호출 없이 즉시 조회한다.
2. **조회 우선순위 + 텍스트 폴백**:
   - (1순위) 만약 응답의 레거시 `ArmoryEngraving.Engravings[]`에 동일 `Name`의 `Icon`이 있으면 해당 URL 사용
   - (2순위) `ENGRAVING_ICON_MAP[effect.Name]` 조회 (필요 시 `effect.Name.trim()` 정규화)
   - (3순위) 대응표에 없거나 `<img onError>`가 발생하면 깨진 이미지를 숨기고 **기존 글자/배지 표시를 그대로 유지**
   ```tsx
   function EngravingIcon({ name, apiIcon }: { name: string; apiIcon?: string | null }) {
     const src = apiIcon || ENGRAVING_ICON_MAP[name.trim()];
     const [failed, setFailed] = useState(false);

     if (!src || failed) {
       return <span className="engraving-fallback-badge">{name.slice(0, 2)}</span>; // 기존 글자 표시 유지
     }

     return (
       <img
         src={src}
         alt={name}
         width={32}
         height={32}
         loading="lazy"
         decoding="async"
         onError={() => setFailed(true)}
         className="h-8 w-8 shrink-0 rounded object-cover"
       />
     );
   }
   ```
3. **해상도 통일**: `achieve_*` 4종은 `128×128`, 나머지 39종은 `64×64`이므로 반드시 CSS 고정 크기(`width`/`height` + `object-cover`)로 렌더링 크기를 통일한다.
4. **지속 유지보수**: 신규 각인 추가 시 대응표에 없더라도 3순위 폴백으로 UI가 깨지지 않으며, 패치 후 `auctions/options` 또는 클라이언트 DB를 통해 1줄만 추가하면 된다.
