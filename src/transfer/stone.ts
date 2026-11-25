import { estimated, official, unknown } from "./evidence";
import { SUPPORT_CAPABLE } from "./rules/classes";
import {
  DEALER_ENGRAVINGS,
  NODE_TO_POINT,
  STONE_UPGRADE,
  SUPPORT_ENGRAVINGS,
} from "./rules/stone";
import type { StoneIn, TransferOverrides } from "./types";

const source = "공지 표9";
const point = (level: number | null) =>
  level !== null && Number.isInteger(level)
    ? level >= 0 && level <= 4
      ? level
      : (NODE_TO_POINT[level] ?? null)
    : null;
export function convertStone(
  stone: StoneIn,
  className: string,
  overrides: TransferOverrides,
) {
  const positive = stone.engravings.filter((entry) => !entry.harmful);
  const names = positive.map((entry) => entry.name);
  const parsed = positive.map((entry) => point(entry.level));
  const points =
    parsed.length === 2 && parsed[0] !== null && parsed[1] !== null
      ? ([parsed[0], parsed[1]] as const)
      : null;
  const validPair =
    names.length !== 2
      ? null
      : names.every((name) =>
            (DEALER_ENGRAVINGS as readonly string[]).includes(name),
          )
        ? "dealer"
        : SUPPORT_CAPABLE.includes(className) &&
            names.every((name) =>
              (SUPPORT_ENGRAVINGS as readonly string[]).includes(name),
            )
          ? "support"
          : null;
  const sum = points ? points[0] + points[1] : null;
  const high = points ? Math.max(...points) : null;
  const row = STONE_UPGRADE.find(
    ([total, max]) => total === sum && (max === null || max === high),
  );
  const excluded =
    overrides.stoneCut === false || (names.length === 2 && validPair === null);
  const upgrade = excluded
    ? official({ slots: 0, level: 0, extra: false }, source)
    : !points
      ? unknown(source, "각인 포인트 확인 필요")
      : estimated(
          {
            slots: row?.[2] ?? 0,
            level: row?.[3] ?? 0,
            extra: row?.[4] ?? false,
          },
          source,
          "스톤 Lv 해석 미검증",
        );
  return { names, points, sum, validPair, upgrade, excluded };
}
