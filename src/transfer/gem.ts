import { official, unknown } from "./evidence";
import { CHOICE_BOX, GEM_KIND_TIER, T3_LEVEL_DROP } from "./rules/gem";
import type { GemIn, TransferOverrides } from "./types";

const source = "공지 표10";
const kindTier = GEM_KIND_TIER as Readonly<Record<string, number>>;

/** 툴팁 티어를 먼저 씁니다. 티어 2 보석도 멸화·홍염 이름을 쓰기 때문입니다. */
export function gemTier(gem: Pick<GemIn, "kind" | "tier">) {
  return gem.tier ?? (gem.kind ? kindTier[gem.kind] : undefined);
}

export function convertGems(gems: GemIn[], overrides: TransferOverrides) {
  return gems.map((before) => {
    const tier = gemTier(before);
    const input = overrides.gemSource?.[before.slot];
    const bound = input?.bound ?? before.bound;
    const level = before.level - (tier === 3 ? T3_LEVEL_DROP : 0);
    // 표10 선택 상자: 유료 성장 상품·낙원 획득 8레벨 귀속 보석(사용자 입력)만 해당합니다.
    const choiceBox =
      tier === 4 &&
      level === CHOICE_BOX.bound &&
      input?.bound &&
      input.source !== "normal"
        ? CHOICE_BOX
        : null;
    const after =
      !tier || !Number.isInteger(before.level) || before.level < 1
        ? unknown(source)
        : tier < 3 || level <= 0
          ? ("removed" as const)
          : official({ level, bound }, source);
    return { before, after, choiceBox };
  });
}
