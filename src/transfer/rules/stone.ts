/** Official notice 13608 (2026-11-25), table 9. */
export const DEALER_ENGRAVINGS = [
  "각성",
  "결투의 대가",
  "기습의 대가",
  "달인의 저력",
  "돌격대장",
  "마나 효율 증가",
  "바리케이드",
  "부러진 뼈",
  "속전속결",
  "슈퍼 차지",
  "시선 집중",
  "아드레날린",
  "안정된 상태",
  "약자 무시",
  "에테르 포식자",
  "예리한 둔기",
  "원한",
  "저주받은 인형",
  "정밀 단도",
  "질량 증가",
  "추진력",
  "타격의 대가",
] as const;
/** Official notice 13608 (2026-11-25), table 9. */
export const SUPPORT_ENGRAVINGS = [
  "각성",
  "구슬동자",
  "급소 타격",
  "마나의 흐름",
  "분쇄의 주먹",
  "위기 모면",
  "전문의",
  "정기 흡수",
  "중갑 착용",
  "최대 마나 증가",
  "폭발물 전문가",
] as const;
/** 공지 13608 표9, 2026-11-25. [합계, 높은 포인트, 슬롯, 단계, 추가 지급] */
export const STONE_UPGRADE = [
  [4, 2, 1, 3, false],
  [4, 3, 1, 5, false],
  [5, null, 2, 7, false],
  [6, 4, 3, 7, false],
  [6, 3, 4, 7, false],
  [7, 4, 5, 7, false],
  [8, 4, 5, 7, true],
] as const;
export const NODE_TO_POINT: Readonly<Record<number, number>> = {
  6: 1,
  7: 2,
  8: 2,
  9: 3,
  10: 4,
};
