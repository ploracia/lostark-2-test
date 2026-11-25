import type { Est, EvidenceLevel } from "./types";

const rank = { unknown: 0, estimated: 1, official: 2 };
export function weakest(...levels: EvidenceLevel[]) {
  return levels.reduce((a, b) => (rank[b] < rank[a] ? b : a), "official");
}
export const official = <T>(value: T, source: string): Est<T> => ({
  kind: "value",
  value,
  evidence: { level: "official", source },
});
export const estimated = <T>(
  value: T,
  source: string,
  note?: string,
): Est<T> => ({
  kind: "value",
  value,
  evidence: { level: "estimated", source, note },
});
export const range = (
  min: number,
  max: number,
  source: string,
  note: string,
): Est<number> => ({
  kind: "range",
  min,
  max,
  evidence: { level: "estimated", source, note },
});
export const unknown = (
  source: string,
  label = "계산 불가",
  note?: string,
): Est<never> => ({
  kind: "none",
  label,
  evidence: { level: "unknown", source, note },
});
