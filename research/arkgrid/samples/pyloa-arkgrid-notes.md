# pyLoa 아크 그리드 모델 (링크와 요약)

- 저장소: [`DAN-MU-ZI/pyLoa`](https://github.com/DAN-MU-ZI/pyLoa) (커밋 `e8c4cdc6d08c69ef31470009242106d59815254c`, 확인일 2026-11-25)
- 확인한 파일: [`pyloa/models/armory.py`](https://github.com/DAN-MU-ZI/pyLoa/blob/e8c4cdc6d08c69ef31470009242106d59815254c/pyloa/models/armory.py), [`tests/models/test_armory_ark_grid.py`](https://github.com/DAN-MU-ZI/pyLoa/blob/e8c4cdc6d08c69ef31470009242106d59815254c/tests/models/test_armory_ark_grid.py)
- 라이선스: MIT License, Copyright (c) 2026 DAN-MU-ZI ([LICENSE](https://github.com/DAN-MU-ZI/pyLoa/blob/main/LICENSE))

## 요약

- `ArkGridGem`(`index`, `icon`, `is_active`, `grade`, `tooltip`), `ArkGridEffect`(`name`, `level`, `tooltip`), `ArkGridSlot`(`index`, `icon`, `name`, `point`, `grade`, `tooltip`, `gems`), `ArkGrid`(`slots`, `effects`) 네 모델이 공식 Swagger 필드와 같은 이름과 형태입니다. `Gems`, `Slots`, `Effects`가 `null`이면 빈 목록으로 바꿉니다.
- 테스트는 슬롯 1개, 젬 1개, 효과 1개가 든 더미 응답(`"Tooltip Text"`, `"Gem Tooltip"` 같은 자리표시 문자열)을 역직렬화합니다. 실제 툴팁 내용의 근거가 아니라 스키마 교차 확인용입니다.

코드는 이 저장소에 옮겨 싣지 않았습니다.
