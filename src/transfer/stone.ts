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
/**
 * "Lv.N"은 활성화 포인트(0~4), "활성도 +N"은 세공 노드 수(표9 참고 열)입니다.
 * 단위를 모르는 옛 형식만 0~4를 포인트로, 그 이상을 노드 수로 해석합니다.
 */
const point = (
  level: number | null,
  unit: StoneIn["engravings"][number]["unit"],
) => {
  if (level === null || !Number.isInteger(level)) return null;
  const asLevel = level >= 0 && level <= 4 ? level : null;
  if (unit === "lv") return asLevel;
  if (unit === "node") return NODE_TO_POINT[level] ?? null;
  return asLevel ?? NODE_TO_POINT[level] ?? null;
};
export function convertStone(
  stone: StoneIn,
  className: string,
  overrides: TransferOverrides,
) {
  const positive = stone.engravings.filter((entry) => !entry.harmful);
  const names = positive.map((entry) => entry.name);
  const parsed = positive.map((entry) => point(entry.level, entry.unit));
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
          row
            ? "스톤 Lv 해석 미검증"
            : "표9에 없는 분포(합계 4 미만 등) · 각인 슬롯 반영 없음으로 추정",
        );
  // 표9에 없는 분포는 반영되지 않고 등급별 초월의 가루로 바뀌는 것으로 보입니다(공지 미세공·비유효 스톤 처리 준용).
  const unlisted = Boolean(points && !excluded && !row);
  return { names, points, sum, validPair, upgrade, excluded, unlisted };
}
