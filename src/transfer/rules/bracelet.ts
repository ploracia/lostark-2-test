/** 공지 13608 표7(딜러)·표8(서포터) 팔찌 효과 티어 = inven_15·16.png. 1~21등급 컷은 미공개. 복합 효과를 먼저 대조합니다. */
export const SCROLL_RANGE = [1, 21] as const;
const party =
  /(?:방어력|치명타 저항|치명타 피해 저항|보호 효과).*아군 공격력 강화/s;
const weaponPlus = /^무기 공격력.*(?:생명력 50%|120초).*무기 공격력/s;
const weapon = /^(?:무기 공격력|공격 적중.*무기 공격력)/s;
const stats = /^(힘|민첩|지능)\s*\+/;
export const BRACELET_TIERS_DEALER = [
  [
    /^(?:치명타 (?:적중률|피해).*치명타 시 피해|추가 피해.*악마|재사용 대기시간.*적에게 주는 피해|적에게 주는 피해.*무력화)/s,
    "1티어",
  ],
  [/^(치명|특화|신속)\s*\+/, "2티어+"],
  [
    /방향성 공격이 아닌|백어택|헤드어택|^(?:추가 피해|적에게 주는 피해|치명타 피해|치명타 적중률)/,
    "2티어",
  ],
  [weaponPlus, "3티어+"],
  [weapon, "3티어"],
  [party, "4티어"],
  [stats, "5티어"],
] as const;
export const BRACELET_TIERS_SUPPORT = [
  [party, "1티어"],
  [/^(특화|신속)\s*\+|아군 (피해량|공격력) 강화/, "2티어"],
  [weaponPlus, "3티어+"],
  [weapon, "3티어"],
  [stats, "4티어"],
] as const;
