import { estimated, official, range, unknown } from "./evidence";
import { mapGear } from "./gear";
import { ESTHER_TABLE } from "./rules/esther";
import type { EstherIn, EstherResult } from "./types";

const source = "공지 표2–4";
export function convertEsther(before: EstherIn): EstherResult {
  const candidates = Object.entries(ESTHER_TABLE).filter(([key]) =>
    key.startsWith(before.evolution + "_"),
  );
  const matches = candidates.filter(([, row]) => row[0] === before.itemLevel);
  const rows =
    before.ella !== null
      ? candidates.filter(([key]) => key.endsWith("_" + before.ella))
      : matches.length === 1
        ? matches
        : candidates;
  const note =
    before.ella !== null
      ? undefined
      : matches.length === 1
        ? "아이템 레벨로 엘라 단계를 추론했습니다."
        : "에스더 엘라 단계 미확인";
  function field(values: number[]) {
    if (!values.length) return unknown(source);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min !== max)
      return range(min, max, source, note ?? "가능한 조합의 범위");
    return note ? estimated(min, source, note) : official(min, source);
  }
  const linked = (
    before.itemLevel === null
      ? rows.map(([, row]) => row[0])
      : [before.itemLevel]
  ).map((level) => mapGear(Math.min(level, 1800)));
  const linkedSource = "공지 표1 · 에스더 연동 기준";
  const linkedValues = linked.flatMap((row) =>
    row.kind === "value" ? [row.value.itemLevel] : [],
  );
  const lo = Math.min(...linkedValues);
  const hi = Math.max(...linkedValues);
  return {
    before,
    itemLevel: field(rows.map(([, row]) => row[3])),
    ella: field(rows.map(([, row]) => row[1])),
    polish: field(rows.map(([, row]) => row[2])),
    honing: field(rows.map(([, row]) => row[4])),
    energy: field(rows.map(([, row]) => row[5])),
    kit: field(rows.map(([, row]) => row[6])),
    linkedLevel:
      !linked.length || linkedValues.length !== linked.length
        ? unknown(linkedSource)
        : lo === hi
          ? estimated(
              lo,
              linkedSource,
              "기존 무기 레벨을 기준으로 연동 장비 레벨을 추정합니다.",
            )
          : range(lo, hi, linkedSource, "에스더 엘라 단계 미확인"),
  };
}
