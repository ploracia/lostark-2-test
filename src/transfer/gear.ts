import { estimated, official, range, unknown } from "./evidence";
import { GEAR_TABLE } from "./rules/gear";
import { NEW_SLOTS, SLOT_LAYOUT, WEAPON_LINKED } from "./rules/slots";
import type {
  Est,
  EstherResult,
  GearIn,
  NewSlot,
  NewSlotResult,
  OldPart,
  TransferOverrides,
} from "./types";

const source = "공지 표1";
export function mapGear(ilvl: number | null) {
  const row =
    ilvl === null
      ? undefined
      : GEAR_TABLE.find(([min, max]) => min < ilvl && ilvl <= max);
  if (!row)
    return unknown(
      source,
      "계산 불가",
      ilvl === null ? "아이템 레벨 확인 필요" : "공지 표1 범위 밖",
    );
  const [, , tier, grade, polish, itemLevel] = row;
  return official({ tier, grade, polish, itemLevel }, source);
}

function result(
  slot: NewSlot,
  from: OldPart,
  map: ReturnType<typeof mapGear>,
  honing: Est<number> | undefined,
  ov: TransferOverrides,
): NewSlotResult {
  const mapped = map.kind === "value" ? map.value : null;
  const energy = ov.artisanEnergy?.[from];
  return {
    slot,
    from,
    tier: mapped?.tier ?? null,
    grade: mapped?.grade ?? null,
    polish: mapped ? official(mapped.polish, source) : unknown(source),
    itemLevel: mapped
      ? official(mapped.itemLevel, source)
      : unknown(source, "계산 불가", map.evidence.note),
    slotHoning: honing,
    artisanEnergy:
      honing && energy !== undefined
        ? official(energy, "사용자 입력 · 장인의 기운 유지")
        : undefined,
    isNew: NEW_SLOTS.some((name) => name === slot),
  };
}

const slotHoning = (value: number | null | undefined) =>
  value == null
    ? unknown("공지 표1", "재련 단계 확인 필요")
    : official(value, "공지 표1 · 재련 유지");

export function convertArmor(
  part: Exclude<OldPart, "무기">,
  right: NewSlot,
  gear: GearIn | undefined,
  ov: TransferOverrides,
) {
  const mapped = mapGear(higher(gear?.itemLevel, ov.gearItemLevel?.[part]));
  return [
    result(part, part, mapped, slotHoning(gear?.honing), ov),
    result(right, part, mapped, undefined, ov),
  ];
}
function higher(a?: number | null, b?: number | null) {
  if (a == null) return b ?? null;
  return b == null ? a : Math.max(a, b);
}

export function convertWeapon(
  weapon: GearIn | undefined,
  esther: EstherResult | null,
  vambrace: number | null | undefined,
  ov: TransferOverrides,
) {
  const normalLevel = higher(
    weapon?.grade === "에스더" ? null : weapon?.itemLevel,
    ov.gearItemLevel?.무기,
  );
  const estherLevel = esther?.before.itemLevel;
  const useEsther =
    esther &&
    (normalLevel === null || estherLevel == null || estherLevel >= normalLevel);
  const normalMap = mapGear(normalLevel);
  const linkedLevel = useEsther ? esther.linkedLevel : null;
  const linkedMetadata =
    linkedLevel?.kind === "value"
      ? GEAR_TABLE.find((row) => row[5] === linkedLevel.value)
      : undefined;
  const ambiguous = Boolean(
    useEsther && estherLevel == null && normalLevel !== null,
  );
  const weaponSlot = result(
    "무기",
    "무기",
    normalMap,
    slotHoning(weapon?.grade === "에스더" ? null : weapon?.honing),
    ov,
  );
  if (useEsther) {
    Object.assign(weaponSlot, {
      tier: 4,
      grade: "에스더",
      ella: esther.ella,
      polish: esther.polish,
      itemLevel: esther.itemLevel,
      slotHoning: esther.honing,
    });
  }
  const linked = WEAPON_LINKED.map((slot) => {
    const entry = result(
      slot,
      "무기",
      normalMap,
      slot === "완갑"
        ? slotHoning(ov.vambraceHoning ?? vambrace)
        : slot === "허리띠"
          ? slotHoning(0)
          : undefined,
      ov,
    );
    if (useEsther) {
      entry.itemLevel = esther.linkedLevel;
      entry.tier = linkedMetadata?.[2] ?? null;
      entry.grade = linkedMetadata?.[3] ?? null;
      entry.polish = linkedMetadata
        ? estimated(linkedMetadata[4], esther.linkedLevel.evidence.source)
        : unknown(source);
    }
    return entry;
  });
  return [weaponSlot, ...linked].map((slot) =>
    ambiguous
      ? {
          ...slot,
          tier: null,
          grade: null,
          itemLevel: unknown(
            source,
            "계산 불가",
            "일반 무기와 에스더의 기존 아이템 레벨 비교 필요",
          ),
          polish: unknown(source),
          ella: undefined,
          slotHoning: slot.slot === "무기" ? slotHoning(null) : slot.slotHoning,
        }
      : slot,
  );
}
export function average16(slots: NewSlotResult[]): Est<number> {
  const values = slots.map((slot) => slot.itemLevel);
  if (
    values.length !== SLOT_LAYOUT.flat().length ||
    values.some((value) => value.kind === "none")
  )
    return unknown(
      "공지 표1–4",
      "계산 불가",
      "일부 부위의 이관 아이템 레벨을 확인할 수 없습니다.",
    );
  let min = 0,
    max = 0;
  for (const value of values) {
    if (value.kind === "none") continue;
    min += value.kind === "value" ? value.value : value.min;
    max += value.kind === "value" ? value.value : value.max;
  }
  const notes = [
    ...new Set(
      values.flatMap((value) =>
        value.evidence.note ? [value.evidence.note] : [],
      ),
    ),
  ].join(" ");
  if (min !== max) return range(min / 16, max / 16, "공지 표1–4", notes);
  return values.some((value) => value.evidence.level === "estimated")
    ? estimated(min / 16, "공지 표1–4", notes)
    : official(min / 16, "공지 표1");
}
