import { official, unknown } from "./evidence";
import {
  BRACELET_TIERS_DEALER,
  BRACELET_TIERS_SUPPORT,
  SCROLL_RANGE,
} from "./rules/bracelet";
import { SUPPORT_CAPABLE } from "./rules/classes";
import type { BraceletIn } from "./types";

const source = "공지 표7·8";
export function analyzeBracelet(bracelet: BraceletIn, className: string) {
  const tiers = (bracelet.options ?? []).map((option) => ({
    text: option.text,
    dealer: BRACELET_TIERS_DEALER.find(([pattern]) =>
      pattern.test(option.text),
    )?.[1],
    support: BRACELET_TIERS_SUPPORT.find(([pattern]) =>
      pattern.test(option.text),
    )?.[1],
  }));
  const support = SUPPORT_CAPABLE.includes(className);
  const effects = tiers.filter(
    (_, i) => bracelet.options?.[i].kind === "changeable",
  );
  const supportOnly =
    effects.some((tier) => tier.support) &&
    effects.every(
      (tier) => tier.support && (!tier.dealer || tier.dealer === "4티어"),
    );
  const status: "unknown" | "remove" | "dismantle" | "exclude" | "eligible" =
    bracelet.tier === null || bracelet.options === null
      ? "unknown"
      : bracelet.tier <= 3
        ? "remove"
        : effects.length === 0
          ? bracelet.options.some((option) => option.kind)
            ? "dismantle"
            : "unknown"
          : !support && supportOnly
            ? "exclude"
            : "eligible";
  return {
    status,
    support,
    tiers,
    eligible:
      status === "unknown"
        ? unknown(source, "효과 부여 상태 확인 필요")
        : official(status === "eligible", source),
    scrollGrade: unknown(
      source,
      SCROLL_RANGE.join("~") + "등급 중 계산 불가",
      "배점 및 등급 컷 미공개",
    ),
  };
}
