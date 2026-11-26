# 커뮤니티 공개 OpenAPI 파서 (링크와 요약)

`ArkGrid.Gems[].Tooltip`의 원본 JSON 샘플은 공개 저장소에서 찾지 못했습니다. 그래서 공식 OpenAPI 응답을 파싱하는 공개 프로젝트 세 곳이 젬 툴팁을 같은 방식으로 읽는지 비교했습니다. 이 문서에는 코드를 옮겨 싣지 않고 링크와 요약만 남깁니다. 확인일은 2026-11-25입니다.

| 저장소 | 확인한 파일 (커밋 고정 링크) | 라이선스 | 요약 |
| --- | --- | --- | --- |
| `jayjung94/arkgrid-gem-viewer` | [`lib/parseArkGrid.js`](https://github.com/jayjung94/arkgrid-gem-viewer/blob/17e21cef1d600ec7f13e770c12a2fec28c96bbe9/lib/parseArkGrid.js) | 표시 없음 (모든 권리 보유) | 젬 툴팁에서 `NameTagBox`를 이름으로, 제목이 `젬 효과`인 `ItemPartBox`에서 의지력·포인트·`[옵션] Lv.N`을 읽습니다. 코어 툴팁은 제목에 `코어 옵션`이 *포함*되는지로 찾아서 `코어 옵션 발동 조건` 블록에 덮어쓰이는 문제가 있습니다. |
| `Airplaner/lostark-arkgrid-gem-locator-v2` | [`src/components/Header/AppConfiguration.svelte`](https://github.com/Airplaner/lostark-arkgrid-gem-locator-v2/blob/196b43b2992e7fdd6601fedf70e4cac3fd6206cd/src/components/Header/AppConfiguration.svelte) | MIT 계열 ([`license.txt`](https://github.com/Airplaner/lostark-arkgrid-gem-locator-v2/blob/main/license.txt), Copyright 2026 Airplaner) | OpenAPI 젬을 앱 모델로 바꿀 때 `젬 효과` 본문에서 `필요 의지력 : X`, `(질서\|혼돈) 포인트 : N`, `[옵션명] Lv.N`을 정규식으로 뽑습니다. |
| `zeratul188/LotsGo` | [`characterInfo.ts`](https://github.com/zeratul188/LotsGo/blob/490ea6e7386401216fff49fa10fce978180f3da1/src/app/character/lib/characterInfo.ts), [`arkGridPrints.ts`](https://github.com/zeratul188/LotsGo/blob/490ea6e7386401216fff49fa10fce978180f3da1/src/app/character/lib/arkGridPrints.ts) | 표시 없음 (모든 권리 보유) | 코어 툴팁의 `[NP]` 구간을 나눠 효과 목록을 만들고, `ArkGrid.Effects[].Tooltip`은 JSON이 아닌 HTML 문자열로 보고 텍스트만 꺼냅니다. 젬 포인트와 옵션 줄도 같은 패턴으로 읽습니다. |

세 곳 모두 같은 툴팁 구조를 전제로 하므로, 모꼬꼬로아 파서(`src/parse/arkgrid.ts`)도 그 구조를 따르되 제목은 정확히 일치할 때만 매칭합니다.
