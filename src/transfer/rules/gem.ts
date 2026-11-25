/** 공지 13608 표10 "보석 교체 지급". 티어 3 멸화·홍염 3~10 → -2레벨 광휘, 티어 4 → 동일 레벨 광휘. */
export const GEM_KIND_TIER = {
  멸화: 3,
  홍염: 3,
  겁화: 4,
  작열: 4,
  광휘: 4,
} as const;
/** 표10: 유료 성장 상품·낙원 획득 8레벨 귀속 보석은 거래 불가 8레벨 / 거래 가능 7레벨 선택 상자. */
export const T3_LEVEL_DROP = 2;
export const CHOICE_BOX = { bound: 8, tradeable: 7 } as const;
