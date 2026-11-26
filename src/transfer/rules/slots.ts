/** 공지 13608 본문 "기존 장비 → 신규 장비" 매핑 = inven_11.png. 기존 부위별 최고 아이템 레벨 장비 기준. */
export const ARMOR_PAIRS = [
  ["투구", "목걸이"],
  ["견갑", "귀걸이1"],
  ["상의", "귀걸이2"],
  ["하의", "반지1"],
  ["장갑", "반지2"],
] as const;
export const API_TYPE_ALIAS = { 어깨: "견갑" } as const;
export const SLOT_LAYOUT = [
  ["투구", "견갑", "상의", "허리띠", "하의", "장갑", "무기", "완갑"],
  ["목걸이", "귀걸이1", "귀걸이2", "반지1", "반지2", "팔찌", "성물", "인장"],
] as const;
export const WEAPON_LINKED = [
  "완갑",
  "허리띠",
  "성물",
  "인장",
  "팔찌",
] as const;
export const NEW_SLOTS = ["허리띠", "성물", "인장"] as const;
