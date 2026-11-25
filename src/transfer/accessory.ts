import { estimated, official, unknown } from "./evidence";
import {
  ACCESSORY_SCROLL_RULES as RULES,
  ACCESSORY_VALID_OPTIONS,
  MIN_QUALITY,
} from "./rules/accessory";
import { SUPPORT_CAPABLE } from "./rules/classes";
import type { AccessoryIn, Est } from "./types";

const source = "공지 표5·6";
const roles = ["딜러", "서포터"] as const;
function optionKey(text: string) {
  const match = text.match(/^(.+?)\s*\+\s*[\d,.]+\s*(%?)$/);
  return match
    ? match[1].replace(/ 효과$/, "").replace(/^세레나데, 신앙, 조화 /, "") +
        (match[2] || "+")
    : "";
}
export function gradeAccessory(accessory: AccessoryIn, className: string) {
  const tradeCount =
    accessory.tradeCount === null
      ? unknown(source, "횟수 확인 필요")
      : official(accessory.tradeCount, source);
  function result(
    outcome: "remove" | "shard" | "scroll" | "unknown",
    reason: string,
    scrollGrade: Est<number> | null = null,
  ) {
    return {
      accessory,
      outcome,
      reason,
      scrollGrade,
      tradeCount,
      evidence: (scrollGrade ?? official(outcome, source)).evidence,
    };
  }
  if (accessory.tier === null)
    return result("unknown", "티어 확인 필요", unknown(source));
  if (accessory.tier <= 3) return result("remove", "티어 3 이하 장신구");
  if (accessory.quality === null)
    return result("unknown", "품질 확인 필요", unknown(source));
  if (accessory.quality < MIN_QUALITY) return result("shard", "품질 67 미만");
  if (!accessory.options?.length)
    return result("unknown", "연마 옵션 확인 필요", unknown(source));
  const options = accessory.options.map((option) => ({
    ...option,
    key: optionKey(option.text),
  }));
  const scores = roles.map((role) => {
    const [primary, third] = ACCESSORY_VALID_OPTIONS[role][accessory.part];
    const first = options.filter((option) =>
      (primary as readonly string[]).includes(option.key),
    );
    const thirdOptions = options.filter((option) =>
      (third as readonly string[]).includes(option.key),
    );
    const uncertain = [...first, ...thirdOptions].some(
      (option) => option.rank === null,
    );
    const order = "상중하";
    const pair = first
      .map((option) => option.rank ?? "하")
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .slice(0, 2)
      .join("");
    const supportEarring = role === "서포터" && accessory.part === "귀걸이";
    let grade: number | null = null;
    if (accessory.grade === "유물") {
      if (role === "서포터" && !supportEarring && pair === "상상")
        grade = RULES.relic;
    } else if (accessory.grade === "고대" && first.length >= 2) {
      const keys = thirdOptions.map(
        (option) =>
          pair +
          (supportEarring &&
          option.key === "최대 생명력+" &&
          option.rank === "상"
            ? "생명력상"
            : (option.rank ?? "")),
      );
      const table: Readonly<Record<string, number>> = supportEarring
        ? RULES.supportEarring
        : RULES.regular;
      grade = Math.min(
        table[pair] ?? table.fallback,
        ...keys.map((key) => table[key] ?? table.fallback),
      );
    }
    return {
      role,
      pair,
      grade,
      uncertain: uncertain && first.length >= 2,
      one: accessory.grade === "고대" && first.length === 1,
    };
  });
  const best = scores
    .flatMap((score) =>
      score.grade === null ? [] : [{ ...score, grade: score.grade }],
    )
    .sort((a, b) => a.grade - b.grade)[0];
  if (best) {
    const isEstimated =
      scores.some((score) => score.uncertain) ||
      (best.role === "서포터" && !SUPPORT_CAPABLE.includes(className));
    const reason =
      best.role +
      " 기준 1·2옵션 " +
      best.pair.split("").join("/") +
      " → " +
      best.grade +
      "등급";
    return result(
      "scroll",
      reason,
      isEstimated
        ? estimated(
            best.grade,
            source,
            "옵션 등급 또는 클래스별 적용 확인 필요",
          )
        : official(best.grade, source),
    );
  }
  if (scores.some((score) => score.uncertain))
    return result("unknown", "옵션 등급 확인 필요", unknown(source));
  if (scores.some((score) => score.one))
    return result(
      "unknown",
      "유효 1·2옵션이 한 줄",
      unknown(source, "6등급 또는 영롱한 보석 파편"),
    );
  return result("shard", "유효 옵션 조합 없음");
}
