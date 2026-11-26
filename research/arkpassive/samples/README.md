# 아크 패시브 API 샘플 모음

실제 Lost Ark Open API 호출(API 키 필요)을 수행하지 않고, 공개 저장소와 공식 공개 문서를 참고했습니다. 실제 캐릭터의 응답 원문은 이 저장소에 싣지 않고, 같은 구조로 만든 가상 샘플만 둡니다.

## 파일 목록

| 파일 | 출처 | 시점 / 버전 | 내용 |
| --- | --- | --- | --- |
| `synthetic-arkpassive.json` | 가상 데이터. 구조 참고: [`artbiit/lostark-api-service`](https://github.com/artbiit/lostark-api-service) (ISC 형식 [LICENSE](https://github.com/artbiit/lostark-api-service/blob/main/LICENSE)) `docs/contracts/upstream-lostark-api/V9.0.0/sample-data/armories/characters.json` | API V9.0.0 형식 | `ArkPassive` 객체 형식(`Points` 3개, 카테고리별 `Effects` 1개씩, 각 `Icon`·`ToolTip` JSON). 노드 이름과 수치는 예시입니다 |
| `swagger-arkpassive-schema.json` | [공식 로스트아크 Open API Swagger](https://developer-lostark.game.onstove.com/swagger-doc/endpoints/armories) | 2026-11-25 조회 / Swagger 2.0 (API V10.0.0 기준) | `GET /armories/characters/{characterName}/arkpassive` 엔드포인트 정의 및 `ArkPassive`, `ArkPassivePoint`, `ArkPassiveEffectSkill`, `ArkPassiveEffect` 공식 스키마 |

## 추가 확인한 공개 샘플·저장소

- **비활성/미개방 케이스 (`artbiit/lostark-api-service`)**: `tests/fixtures/armories/character-no-ark-passive.json` 확인 결과, 아크 패시브 미개방 캐릭터의 통합 armory 응답에서 `"ArkPassive": null`로 내려옵니다.
- **Ark Lens 내부 합성 샘플 (`plo/ark-lens-character:fixtures/armory-sample.json`)**: `Description`이 HTML 태그 없는 `"1티어 치명 Lv.30"` 형태이며 `Icon`·`ToolTip`이 생략된 합성 픽스처입니다. 실측 API의 `"<FONT color='#F1D594'>진화</FONT> 1티어 <FONT color='#F1D594'>치명 Lv.30</FONT>"`과 형식이 다르므로 파서는 두 형식(카테고리 접두어·`<FONT>` 태그 유무)을 모두 수용해야 합니다.
- **pyLoa / KorLARK(`korlark/loapy`)**: 웹·GitHub 검색 결과 `pyLoa` 이름의 공개 저장소나 `ArkPassive` 실측 JSON 샘플은 확인되지 않았습니다(Python 비공식 SDK로는 `korlark/loapy`가 존재).
- **패치 시점 차이 주의**: 참고한 artbiit 원본 샘플은 **2025-01-15** 수집본으로, 이후 엘릭서·초월의 진화 4티어 통합 패치(진화 1~5티어, 총 140P) 이전 스냅샷입니다. 따라서 원본 샘플에서는 `진화 Value: 120`, `뭉툭한 가시`가 `4티어`로 기록되어 있으며, 현행(2026-11 기준) 진화 트리에서는 4티어에 엘릭서 노드 6종이 신설되고 `뭉툭한 가시` 등은 **5티어**로 이동했습니다.
