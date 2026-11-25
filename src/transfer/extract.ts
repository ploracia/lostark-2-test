import type { Armory } from "../models";
import { parseTooltip, plainText } from "../parse/tooltip";
import { ARMOR_PAIRS, API_TYPE_ALIAS } from "./rules/slots";
import type { AccessoryIn, Ella, OldPart, TransferInput } from "./types";

const oldParts: readonly string[] = [
  ...ARMOR_PAIRS.map(([part]) => part),
  "무기",
];
const numeric = (text?: string | null) => {
  const value = text?.replace(/,/g, "").trim();
  return value && Number.isFinite(Number(value)) ? Number(value) : null;
};
const honing = (name: string) => numeric(name.match(/^\+(\d+)\s/)?.[1]);

export function extractTransferInput(data: Armory): TransferInput {
  const equipment = (data.ArmoryEquipment ?? []).map((item) => ({
    ...item,
    parsed: parseTooltip(item.Tooltip),
  }));
  const find = (type: string) => equipment.find((item) => item.Type === type);
  const weapon = find("무기");
  const bracelet = find("팔찌");
  const stone = find("어빌리티 스톤");
  const evolution = weapon ? honing(weapon.Name) : null;
  const ella = numeric(
    plainText(weapon?.Tooltip ?? "").match(/엘라\s*([123])\s*단계/)?.[1],
  );
  const indices = { 목걸이: 0, 귀걸이: 0, 반지: 0 };
  const effects = data.ArmoryEngraving?.ArkPassiveEffects ?? [];
  const fallback = effects
    .filter((effect) => effect.AbilityStoneLevel != null)
    .map((effect) => ({
      name: effect.Name,
      level: effect.AbilityStoneLevel ?? null,
      unit: "lv" as const,
      harmful: false,
    }));
  const stoneEngravings = stone?.parsed?.engravings ?? [];
  const vambrace = find("완갑");
  return {
    className: data.ArmoryProfile?.CharacterClassName ?? "",
    profileAvg: numeric(data.ArmoryProfile?.ItemAvgLevel),
    gear: equipment.flatMap((item) => {
      const part = item.Type === "어깨" ? API_TYPE_ALIAS.어깨 : item.Type;
      return oldParts.includes(part)
        ? [
            {
              part: part as OldPart,
              name: item.Name,
              grade: item.Grade,
              itemLevel: numeric(item.parsed?.itemLevel),
              honing: honing(item.Name),
            },
          ]
        : [];
    }),
    esther:
      weapon?.Grade === "에스더"
        ? {
            evolution: evolution ?? -1,
            ella: ella as Ella | null,
            itemLevel: numeric(weapon.parsed?.itemLevel),
          }
        : null,
    vambraceHoning: vambrace ? honing(vambrace.Name) : null,
    accessories: equipment.flatMap((item): AccessoryIn[] => {
      if (
        item.Type !== "목걸이" &&
        item.Type !== "귀걸이" &&
        item.Type !== "반지"
      )
        return [];
      return [
        {
          part: item.Type,
          index: ++indices[item.Type],
          grade: item.Grade,
          quality: item.parsed?.quality ?? null,
          tier: item.parsed?.tier ?? null,
          options: item.parsed?.options ?? null,
        },
      ];
    }),
    bracelet: bracelet
      ? {
          tier: bracelet.parsed?.tier ?? null,
          options: bracelet.parsed?.options ?? null,
        }
      : null,
    stone: stone
      ? {
          engravings:
            stoneEngravings.filter((e) => !e.harmful && e.level !== null)
              .length >= 2
              ? stoneEngravings
              : fallback.length >= 2
                ? fallback
                : stoneEngravings,
        }
      : null,
  };
}
