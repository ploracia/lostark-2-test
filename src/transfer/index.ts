import { gradeAccessory } from "./accessory";
import { analyzeBracelet } from "./bracelet";
import { convertEsther } from "./esther";
import { average16, convertArmor, convertWeapon } from "./gear";
import { convertGems } from "./gem";
import { collectPayouts } from "./payouts";
import { ESTHER_TABLE } from "./rules/esther";
import { GEM_KIND_TIER } from "./rules/gem";
import { RULES_VERSION } from "./rules/meta";
import { ARMOR_PAIRS } from "./rules/slots";
import { convertStone } from "./stone";
import type { EvidenceLevel, TransferInput, TransferOverrides } from "./types";

export function computeTransfer(
  input: TransferInput,
  ov: TransferOverrides = {},
) {
  const gear = (part: string) => input.gear.find((item) => item.part === part);
  const stored = ov.storedEsther;
  const row = stored
    ? ESTHER_TABLE[
        (stored.evolution + "_" + stored.ella) as keyof typeof ESTHER_TABLE
      ]
    : undefined;
  const equipped =
    input.esther &&
    convertEsther({
      ...input.esther,
      ella: ov.equippedElla ?? input.esther.ella,
    });
  const reserve =
    row && stored ? convertEsther({ ...stored, itemLevel: row[0] }) : null;
  const esther =
    reserve &&
    row &&
    (!equipped ||
      (equipped.before.itemLevel !== null &&
        row[0] > equipped.before.itemLevel))
      ? reserve
      : equipped;
  const slots = [
    ...ARMOR_PAIRS.flatMap(([left, right]) =>
      convertArmor(left, right, gear(left), ov),
    ),
    ...convertWeapon(gear("무기"), esther, input.vambraceHoning, ov),
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
  const stone = input.stone && convertStone(input.stone, input.className, ov);
  const gems = convertGems(input.gems, ov);
  const payouts = collectPayouts(input, esther, accessories, bracelet, stone);
  const assumptions: {
    id: string;
    text: string;
    field?: keyof TransferOverrides;
  }[] = [];
  const add = (field: keyof TransferOverrides, text: string) =>
    assumptions.push({ id: field, text, field });
  add(
    "gearItemLevel",
    "입력하지 않은 부위는 장착 장비가 최고 아이템 레벨이라고 가정합니다.",
  );
  if (!input.esther && !reserve)
    add("storedEsther", "보관 중인 에스더 무기가 없다고 가정합니다.");
  if (input.esther?.ella === null && ov.equippedElla === undefined)
    add(
      "equippedElla",
      "장착 에스더의 엘라 단계는 아이템 레벨로 추론하거나 범위로 표시합니다.",
    );
  if (input.vambraceHoning == null && ov.vambraceHoning === undefined)
    add("vambraceHoning", "완갑 재련 단계는 확인 필요로 표시합니다.");
  add(
    "artisanEnergy",
    "입력하지 않은 장인의 기운은 기존 수치가 유지된다고 표시합니다.",
  );
  if (
    input.gems.some(
      (gem) =>
        gem.level === 8 &&
        gem.kind &&
        (GEM_KIND_TIER as Readonly<Record<string, number>>)[gem.kind] === 4 &&
        !ov.gemSource?.[gem.slot],
    )
  )
    add(
      "gemSource",
      "획득처를 입력하지 않은 8레벨 보석은 일반 획득으로 가정합니다.",
    );
  if (stone && ov.stoneCut === undefined)
    add("stoneCut", "장착 스톤은 세공 완료로 가정합니다.");
  if (bracelet)
    assumptions.push({
      id: "bracelet",
      text: "미장착 팔찌가 더 좋으면 그 팔찌가 기준이 됩니다.",
    });
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
    ...payouts.map((item) => item.amount.evidence),
    ...gems.flatMap((gem) =>
      gem.after === "removed" ? [] : [gem.after.evidence],
    ),
    ...(bracelet
      ? [bracelet.eligible.evidence, bracelet.scrollGrade.evidence]
      : []),
    ...(stone ? [stone.upgrade.evidence] : []),
  ];
  entries.forEach((entry) => counts[entry.level]++);
  return {
    rulesVersion: RULES_VERSION,
    current: { profileAvg: input.profileAvg, equippedAvg },
    after: { avg16 },
    slots,
    esther,
    accessories,
    bracelet,
    stone,
    gems,
    payouts,
    assumptions,
    counts,
  };
}
export type TransferResult = ReturnType<typeof computeTransfer>;
