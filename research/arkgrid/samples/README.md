# ArkGrid 조사 샘플 목록

조사일: 2026-11-25 (API 키를 쓰는 실호출 없이 공개 저장소와 공식 공개 문서만 참고)

실제 캐릭터의 API 응답과 라이선스 없는 저장소의 코드는 이 저장소에 싣지 않습니다. 실제 응답 구조는 아래 출처 링크에서 확인하고, 여기에는 같은 구조로 만든 가상 데이터와 링크·요약만 둡니다.

| 파일 | 성격 | 참고한 출처 | 비고 |
|---|---|---|---|
| `synthetic-arkgrid.json` | **가상 데이터** (`ArkGrid` 블록) | 구조: [`artbiit/lostark-api-service`](https://github.com/artbiit/lostark-api-service) (ISC 형식 [LICENSE](https://github.com/artbiit/lostark-api-service/blob/main/LICENSE))의 [`V9.0.0/sample-data/armories/characters.json`](https://github.com/artbiit/lostark-api-service/blob/a0df5ffae85f09ad2062f0174db3058491bb1105/docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/characters.json) | 전설 질서 코어 1개, `Point: 0`, `Gems: null`, `Effects: null`. 코어 이름·직업·효과 문구·획득처는 가상 값입니다. `tests/fixtures-arkgrid-synthetic.json`과 같은 내용입니다 |
| `synthetic-slot0-tooltip-decoded.json` | 위 샘플의 `Slots[0].Tooltip`을 디코드한 것 | 같음 | `Element_000`~`Element_012` 구조 확인용. `Element_006`에 `[10P]`/`[14P]` 코어 옵션 |
| `official-swagger-arkgrid.json` | **공식 OpenAPI Swagger 스키마** | `https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories` | `ArkGrid`, `ArkGridSlot`, `ArkGridGem`, `ArkGridEffect` 공식 정의와 엔드포인트 명세 |
| `pyloa-arkgrid-notes.md` | 공개 Python SDK 모델·테스트 링크와 요약 | `DAN-MU-ZI/pyLoa` (`e8c4cdc`, MIT) | 코드는 싣지 않음 |
| `community-parsers-links.md` | 공개 파서 세 곳의 링크와 요약 | `jayjung94/arkgrid-gem-viewer` (`17e21ce`), `Airplaner/lostark-arkgrid-gem-locator-v2` (`196b43b`), `zeratul188/LotsGo` (`490ea6e`) | 코드는 싣지 않음. `Gems[].Tooltip` 구조(`NameTagBox`, 제목 `"젬 효과"`인 `ItemPartBox`, `필요 의지력`/`포인트`/`[옵션] Lv.N`) 교차 확인 |
