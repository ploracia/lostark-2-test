import { official, unknown } from "./evidence";
import { CHOICE_BOX, GEM_KIND_TIER, T3_LEVEL_DROP } from "./rules/gem";
import type { GemIn, TransferOverrides } from "./types";

export function convertGems(gems: GemIn[], overrides: TransferOverrides) {
  return gems.map((before) => {
    const tier = before.kind
      ? (GEM_KIND_TIER as Readonly<Record<string, number>>)[before.kind]
      : undefined;
    const input = overrides.gemSource?.[before.slot];
    const bound = input?.bound ?? before.bound;
    const level = before.level - (tier === 3 ? T3_LEVEL_DROP : 0);
    const choiceBox =
      tier === 4 &&
      level === CHOICE_BOX.bound &&
      input?.bound &&
      input.source !== "normal"
        ? CHOICE_BOX
        : null;
    const after =
      !tier || !Number.isInteger(before.level) || before.level < 1
        ? unknown("공지 표10")
        : level <= 0
          ? ("removed" as const)
          : official({ level, bound }, "공지 표10");
    return { before, after, choiceBox };
  });
}
