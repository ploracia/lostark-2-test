import { estimated, official, range, unknown } from "./evidence";
import { mapGear } from "./gear";
import { ESTHER_TABLE } from "./rules/esther";
import type { EstherIn, EstherResult } from "./types";

const source = "공지 표2–4";
const ESTHER_LINK_CAP = 1800;
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
  const oldLevels =
    before.itemLevel === null
      ? rows.map(([, row]) => row[0])
      : [before.itemLevel];
  // 공지: 1800 이상 에스더는 연동 5부위를 "재련 25단계 무기" 기준으로 지급. 그 무기의 레벨은
  // 공지에 없어 On-Air 예시(일반 무기 25강 = 1800)를 따라 1800으로 가정합니다(추정).
  const capped = oldLevels.some((level) => level >= ESTHER_LINK_CAP);
  const linked = oldLevels.map((level) =>
    mapGear(Math.min(level, ESTHER_LINK_CAP)),
  );
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
              capped
                ? "재련 25단계 무기를 1800으로 가정해 연동 장비 레벨을 추정합니다."
                : "기존 무기 레벨을 기준으로 연동 장비 레벨을 추정합니다.",
            )
          : range(lo, hi, linkedSource, "에스더 엘라 단계 미확인"),
  };
}
