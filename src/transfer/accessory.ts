import { estimated, official, range, unknown } from "./evidence";
import {
  ACCESSORY_SCROLL_RULES as RULES,
  ACCESSORY_VALID_OPTIONS,
  MIN_QUALITY,
} from "./rules/accessory";
import { SUPPORT_CAPABLE } from "./rules/classes";
import type { AccessoryIn, Est, Option } from "./types";

const source = "공지 표5·6";
const roles = ["딜러", "서포터"] as const;
type Role = (typeof roles)[number];
type Rank = NonNullable<Option["rank"]>;
const order = "상중하";

function optionKey(text: string) {
  const match = text.match(/^(.+?)\s*\+\s*[\d,.]+\s*(%?)$/);
  return match
    ? match[1].replace(/ 효과$/, "").replace(/^세레나데, 신앙, 조화 /, "") +
        (match[2] || "+")
    : "";
}

type Keyed = Option & { key: string };

/**
 * 한 역할(딜러/서포터) 기준 주문서 등급. 등급을 모르는 옵션(rank null)은 `fill`로 채워
 * 최선(상)·최악(하) 두 번 계산해 범위를 만듭니다.
 */
function scoreRole(
  accessory: AccessoryIn,
  options: Keyed[],
  role: Role,
  fill: Rank,
) {
  const [primary, third] = ACCESSORY_VALID_OPTIONS[role][accessory.part];
  const first = options.filter((option) =>
    (primary as readonly string[]).includes(option.key),
  );
  const thirdOptions = options.filter((option) =>
    (third as readonly string[]).includes(option.key),
  );
  const pair = first
    .map((option) => option.rank ?? fill)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .slice(0, 2)
    .join("");
  const supportEarring = role === "서포터" && accessory.part === "귀걸이";
  let grade: number | null = null;
  if (accessory.grade === "유물") {
    if (role === "서포터" && !supportEarring && pair === "상상")
      grade = RULES.relic;
  } else if (first.length >= 2) {
    const keys = thirdOptions.map((option) => {
      const rank = option.rank ?? fill;
      return (
        pair +
        (supportEarring && option.key === "최대 생명력+" && rank === "상"
          ? "생명력상"
          : rank)
      );
    });
    const table: Readonly<Record<string, number>> = supportEarring
      ? RULES.supportEarring
      : RULES.regular;
    grade = Math.min(
      table[pair] ?? table.fallback,
      ...keys.map((key) => table[key] ?? table.fallback),
    );
  }
  const uncertain = [...first, ...thirdOptions].some(
    (option) => option.rank === null,
  );
  return { role, pair, grade, uncertain, one: first.length === 1 };
}

function bestOf(scores: ReturnType<typeof scoreRole>[]) {
  return scores
    .flatMap((score) =>
      score.grade === null ? [] : [{ ...score, grade: score.grade }],
    )
    .sort((a, b) => a.grade - b.grade)[0];
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
  // 공지는 티어 4 고대·유물만 다룹니다. 그 밖의 등급은 처리 기준이 없어 미확인입니다.
  if (accessory.grade !== "고대" && accessory.grade !== "유물")
    return result(
      "unknown",
      "티어 4 " +
        (accessory.grade || "등급 미확인") +
        " 장신구 처리 기준 미공개",
      unknown(source, "처리 기준 미확인"),
    );
  if (accessory.quality === null)
    return result("unknown", "품질 확인 필요", unknown(source));
  if (accessory.quality < MIN_QUALITY) return result("shard", "품질 67 미만");
  if (!accessory.options?.length)
    return result("unknown", "연마 옵션 확인 필요", unknown(source));
  const options = accessory.options.map((option) => ({
    ...option,
    key: optionKey(option.text),
  }));
  const optimistic = roles.map((role) =>
    scoreRole(accessory, options, role, "상"),
  );
  const pessimistic = roles.map((role) =>
    scoreRole(accessory, options, role, "하"),
  );
  const best = bestOf(optimistic);
  const worst = bestOf(pessimistic);
  const uncertain = optimistic.some((score) => score.uncertain);
  if (best && worst) {
    const classCheck =
      (best.role === "서포터" || worst.role === "서포터") &&
      !SUPPORT_CAPABLE.includes(className);
    const reason =
      worst.role +
      " 기준 1·2옵션 " +
      worst.pair.split("").join("/") +
      " → " +
      (best.grade === worst.grade
        ? best.grade + "등급"
        : best.grade + "~" + worst.grade + "등급");
    const grade =
      best.grade !== worst.grade
        ? range(
            best.grade,
            worst.grade,
            source,
            "옵션 등급(상/중/하) 확인 필요",
          )
        : uncertain || classCheck
          ? estimated(
              best.grade,
              source,
              classCheck
                ? "딜러 클래스의 서포터 옵션 적용 여부 확인 필요"
                : "옵션 등급 확인 필요",
            )
          : official(best.grade, source);
    return result("scroll", reason, grade);
  }
  if (best)
    return result(
      "unknown",
      "옵션 등급 확인 필요",
      unknown(source, best.grade + "등급 또는 영롱한 보석 파편"),
    );
  if (accessory.grade === "고대" && optimistic.some((score) => score.one))
    return result(
      "unknown",
      "유효 1·2옵션이 한 줄",
      unknown(source, "6등급 또는 영롱한 보석 파편"),
    );
  return result("shard", "유효 옵션 조합 없음");
}
