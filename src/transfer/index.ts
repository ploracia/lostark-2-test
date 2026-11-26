import { gradeAccessory } from "./accessory";
import { analyzeBracelet } from "./bracelet";
import { convertEsther } from "./esther";
import { average16, convertArmor, convertWeapon } from "./gear";
import { ARMOR_PAIRS } from "./rules/slots";
import { convertStone } from "./stone";
import type { EvidenceLevel, TransferInput } from "./types";

export function computeTransfer(input: TransferInput) {
  const gear = (part: string) => input.gear.find((item) => item.part === part);
  const esther = input.esther && convertEsther(input.esther);
  const slots = [
    ...ARMOR_PAIRS.flatMap(([left, right]) =>
      convertArmor(left, right, gear(left)),
    ),
    ...convertWeapon(gear("무기"), esther, input.vambraceHoning),
  ];
  const avg16 = average16(slots);
  const levels = [...ARMOR_PAIRS.map(([part]) => part), "무기"].map(
    (part) => gear(part)?.itemLevel,
  );
  const equippedAvg = levels.every((level) => level != null)
    ? levels.reduce<number>((sum, level) => sum + (level ?? 0), 0) / 6
    : null;
  const accessories = input.accessories.map((item) =>
    gradeAccessory(item, input.className),
  );
  const bracelet =
    input.bracelet && analyzeBracelet(input.bracelet, input.className);
  const stone = input.stone && convertStone(input.stone, input.className);
  const counts: Record<EvidenceLevel, number> = {
    official: 0,
    estimated: 0,
    unknown: 0,
  };
  const entries = [
    avg16.evidence,
    ...slots.flatMap((slot) => [
      slot.itemLevel.evidence,
      ...(slot.slotHoning ? [slot.slotHoning.evidence] : []),
    ]),
    ...accessories.map((item) => item.evidence),
    ...(bracelet
      ? [bracelet.eligible.evidence, bracelet.scrollGrade.evidence]
      : []),
    ...(stone ? [stone.upgrade.evidence] : []),
  ];
  entries.forEach((entry) => counts[entry.level]++);
  return {
    current: { profileAvg: input.profileAvg, equippedAvg },
    after: { avg16 },
    slots,
    esther,
    accessories,
    bracelet,
    stone,
    counts,
  };
}
export type TransferResult = ReturnType<typeof computeTransfer>;
