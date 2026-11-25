import { describe, expect, it } from "vitest";
import armory from "../../fixtures/armory-sample.json";
import { gradeAccessory } from "../../src/transfer/accessory";
import { analyzeBracelet } from "../../src/transfer/bracelet";
import { convertEsther } from "../../src/transfer/esther";
import { weakest } from "../../src/transfer/evidence";
import { extractTransferInput } from "../../src/transfer/extract";
import { mapGear } from "../../src/transfer/gear";
import { convertGems } from "../../src/transfer/gem";
import { computeTransfer } from "../../src/transfer";
import { ESTHER_TABLE } from "../../src/transfer/rules/esther";
import { GEAR_TABLE } from "../../src/transfer/rules/gear";
import {
  DEALER_ENGRAVINGS,
  STONE_UPGRADE,
  SUPPORT_ENGRAVINGS,
} from "../../src/transfer/rules/stone";
import { convertStone } from "../../src/transfer/stone";
import type { AccessoryIn } from "../../src/transfer/types";

const fixture = extractTransferInput(armory);
describe("공지 13608", () => {
  it("규칙표 범위 및 유효 각인 목록", () => {
    expect(GEAR_TABLE[0][0]).toBe(50);
    expect(GEAR_TABLE.at(-1)?.[1]).toBe(1800);
    GEAR_TABLE.forEach(([min, max, , , , level], i) => {
      expect(max).toBeGreaterThan(min);
      if (i) {
        expect(min).toBe(GEAR_TABLE[i - 1][1]);
        expect(level).toBeGreaterThan(GEAR_TABLE[i - 1][5]);
      }
    });
    expect(Object.keys(ESTHER_TABLE)).toHaveLength(20);
    expect(new Set(DEALER_ENGRAVINGS).size).toBe(22);
    expect(new Set(SUPPORT_ENGRAVINGS).size).toBe(11);
    expect(DEALER_ENGRAVINGS).toContain("각성");
    expect(SUPPORT_ENGRAVINGS).toContain("각성");
    expect(STONE_UPGRADE).toHaveLength(7);
    expect(weakest("official", "estimated", "unknown")).toBe("unknown");
    expect(weakest("official", "estimated")).toBe("estimated");
  });
  it.each([
    [1726, "영웅", 1, 1730],
    [1730, "영웅", 1, 1730],
    [1770, "전설", 4, 1770],
    [1771, "유물", 2, 1785],
    [1790, "고대", 0, 1800],
    [1795, "고대", 2, 1810],
    [1800, "고대", 3, 1815],
    [1600, "전설", 0, 1600],
    [1601, "고급", 0, 1675],
  ])("표1 장비 %i", (input, grade, polish, itemLevel) => {
    expect(mapGear(input)).toMatchObject({
      kind: "value",
      value: { grade, polish, itemLevel },
    });
  });
  it.each([50, 1801, null])("표1 범위 밖 %s", (input) => {
    expect(mapGear(input)).toMatchObject({ kind: "none" });
    expect(mapGear(input)).not.toHaveProperty("value");
  });
  it.each([
    [5, 0, 1600, 1100, 0, 28, 3310],
    [9, 3, 1800, 1840, 25, 20, 10500],
    [10, 3, 1830, 1865, 25, 0, 0],
  ] as const)(
    "표2–4 에스더 %i / %i",
    (evolution, ella, itemLevel, after, honing, energy, kit) => {
      expect(convertEsther({ evolution, ella, itemLevel })).toMatchObject({
        itemLevel: { value: after },
        honing: { value: honing },
        energy: { value: energy },
        kit: { value: kit },
      });
    },
  );
  it("표2–4 기존 엘라 추론과 공개 조합 범위", () => {
    expect(
      convertEsther({ evolution: 8, ella: null, itemLevel: 1715 }),
    ).toMatchObject({
      itemLevel: { value: 1735, evidence: { level: "estimated" } },
      honing: { value: 18 },
    });
    expect(
      convertEsther({ evolution: 8, ella: null, itemLevel: null }).itemLevel,
    ).toMatchObject({ kind: "range", min: 1625, max: 1735 });
    const result = computeTransfer(fixture, {
      gearItemLevel: { 무기: 1800 },
      storedEsther: { evolution: 10, ella: 3 },
    });
    expect(
      result.slots.find((slot) => slot.slot === "무기")?.itemLevel,
    ).toMatchObject({ value: 1865 });
    expect(
      result.slots
        .filter((slot) => slot.from === "무기" && slot.slot !== "무기")
        .map((slot) => slot.itemLevel),
    ).toEqual(
      Array.from({ length: 5 }, () =>
        expect.objectContaining({
          value: 1815,
          evidence: expect.objectContaining({ level: "estimated" }),
        }),
      ),
    );
  });
  const accessory: AccessoryIn = {
    part: "목걸이",
    index: 1,
    quality: 67,
    tier: 4,
    grade: "고대",
    tradeCount: null,
    options: [],
  };
  it.each([
    ["상", "상", "상", 1],
    ["상", "상", "중", 2],
    ["상", "상", "하", 3],
    ["상", "중", "상", 4],
    ["상", "하", "상", 5],
    ["중", "중", "상", 6],
  ] as const)("표5·6 일반 옵션 %s/%s/%s", (a, b, c, grade) => {
    expect(
      gradeAccessory(
        {
          ...accessory,
          options: [
            { text: "추가 피해 +1%", rank: a },
            { text: "적에게 주는 피해 +1%", rank: b },
            { text: "공격력 +100", rank: c },
          ],
        },
        "바드",
      ).scrollGrade,
    ).toMatchObject({ value: grade });
  });
  it.each([
    ["최대 생명력 +100", "상", "상", 2],
    ["파티원 보호막 효과 +1%", "상", "상", 3],
    ["파티원 회복 효과 +1%", "중", "상", 4],
    ["최대 생명력 +100", "하", "상", 5],
    ["최대 생명력 +100", "상", "중", 6],
  ] as const)("표5·6 서포터 귀걸이 %s", (text, rank, second, grade) => {
    expect(
      gradeAccessory(
        {
          ...accessory,
          part: "귀걸이",
          options: [
            { text: "무기 공격력 +1%", rank: "상" },
            { text: "무기 공격력 +100", rank: second },
            { text, rank },
          ],
        },
        "바드",
      ).scrollGrade,
    ).toMatchObject({ value: grade });
  });
  it("표5·6 유물 예외, 품질 경계 및 유효 옵션 한 줄", () => {
    const options = [
      { text: "낙인력 +1%", rank: "상" },
      { text: "세레나데, 신앙, 조화 게이지 획득량 +1%", rank: "상" },
    ] as const;
    expect(
      gradeAccessory(
        { ...accessory, grade: "유물", options: [...options] },
        "바드",
      ).scrollGrade,
    ).toMatchObject({ value: 5 });
    expect(
      gradeAccessory({ ...accessory, options: [...options] }, "소서리스")
        .evidence.level,
    ).toBe("estimated");
    expect(
      gradeAccessory(
        { ...accessory, quality: 66, options: [...options] },
        "바드",
      ).outcome,
    ).toBe("shard");
    expect(
      gradeAccessory({ ...accessory, options: [options[0]] }, "바드")
        .scrollGrade,
    ).toMatchObject({ kind: "none" });
  });
  it("표7·8 팔찌 대상과 티어만 판정", () => {
    const options = [
      { text: "아군 피해량 강화 +1%", kind: "changeable" as const },
    ];
    expect(analyzeBracelet({ tier: 4, options }, "소서리스").status).toBe(
      "exclude",
    );
    expect(analyzeBracelet({ tier: 3, options }, "바드").status).toBe("remove");
    expect(
      analyzeBracelet(
        { tier: 4, options: [{ text: "특화 +70", kind: "locked" }] },
        "바드",
      ).status,
    ).toBe("dismantle");
    expect(analyzeBracelet({ tier: 4, options }, "바드")).toMatchObject({
      status: "eligible",
      tiers: [{ support: "2티어" }],
      scrollGrade: { kind: "none" },
    });
    const grade = analyzeBracelet({ tier: 4, options }, "바드").scrollGrade;
    expect(grade).not.toHaveProperty("value");
    expect(grade).not.toHaveProperty("min");
  });
  it.each([
    [2, 2, 1, 3, false],
    [3, 1, 1, 5, false],
    [4, 1, 2, 7, false],
    [3, 2, 2, 7, false],
    [9, 7, 2, 7, false],
    [4, 2, 3, 7, false],
    [3, 3, 4, 7, false],
    [4, 3, 5, 7, false],
    [4, 4, 5, 7, true],
  ])("표9 스톤 %i/%i", (a, b, slots, level, extra) => {
    expect(
      convertStone(
        {
          engravings: [
            { name: "원한", level: a, harmful: false },
            { name: "아드레날린", level: b, harmful: false },
            { name: "방어력 감소", level: 3, harmful: true },
          ],
        },
        "바드",
        {},
      ).upgrade,
    ).toMatchObject({
      value: { slots, level, extra },
      evidence: { level: "estimated" },
    });
  });
  it("표9 딜러의 서포터 조합 제외", () => {
    expect(
      convertStone(
        {
          engravings: [
            { name: "각성", level: 4, harmful: false },
            { name: "전문의", level: 4, harmful: false },
          ],
        },
        "소서리스",
        {},
      ).excluded,
    ).toBe(true);
  });
  it("표10 보석 티어 전환과 획득처 예외", () => {
    const gems = [
      ["홍염", 3],
      ["멸화", 10],
      ["멸화", 2],
      ["겁화", 7],
      ["광휘", 8],
      ["광휘", 8],
    ] as const;
    const actual = convertGems(
      gems.map(([kind, level], slot) => ({ kind, level, slot, bound: true })),
      {
        gemSource: { 4: { source: "paid", bound: true } },
      },
    );
    expect(
      actual.map((gem) =>
        gem.after === "removed"
          ? gem.after
          : gem.after.kind === "value"
            ? gem.after.value.level
            : null,
      ),
    ).toEqual([1, 8, "removed", 7, 8, 8]);
    expect(actual[4].choiceBox).toEqual({ bound: 8, tradeable: 7 });
    expect(actual[5].choiceBox).toBeNull();
  });
});

describe("이관 엔진 통합", () => {
  it("픽스처 1,742.50 → 1,788.75", () => {
    const result = computeTransfer(fixture);
    expect(result.current.profileAvg).toBe(1742.5);
    expect(result.after.avg16).toMatchObject({
      kind: "value",
      value: 1788.75,
      evidence: { level: "official" },
    });
    expect(result.slots).toHaveLength(16);
    expect(result.slots.filter((slot) => slot.from === "무기")).toHaveLength(6);
    expect(
      result.slots.find((slot) => slot.slot === "완갑")?.slotHoning,
    ).toMatchObject({ kind: "none" });
    expect(
      result.slots.find((slot) => slot.slot === "허리띠")?.slotHoning,
    ).toMatchObject({ value: 0 });
    expect(
      computeTransfer(fixture, { vambraceHoning: 12 }).slots.find(
        (slot) => slot.slot === "완갑",
      )?.slotHoning,
    ).toMatchObject({ value: 12 });
    expect(
      result.accessories.map((entry) =>
        entry.scrollGrade?.kind === "value"
          ? entry.scrollGrade.value
          : entry.outcome,
      ),
    ).toEqual([4, 4, "shard", 4, "shard"]);
    expect(result.stone?.upgrade).toMatchObject({
      value: { slots: 2, level: 7 },
      evidence: { level: "estimated" },
    });
    expect(result.bracelet?.scrollGrade.kind).toBe("none");
    expect(result.gems).toHaveLength(11);
    expect(
      result.gems.every(
        (gem) =>
          gem.after !== "removed" &&
          gem.after.kind === "value" &&
          gem.after.value.level === gem.before.level,
      ),
    ).toBe(true);
    expect(result).toMatchSnapshot();
  });
  it("빈 응답과 미확인 수량의 숫자를 만들지 않음", () => {
    const result = computeTransfer(
      extractTransferInput({
        ArmoryEquipment: [
          { Type: "투구", Name: "투구", Grade: "고대", Tooltip: null },
        ],
      }),
    );
    expect(result.slots).toHaveLength(16);
    expect(result.after.avg16.kind).toBe("none");
    expect(
      result.payouts.every(
        (row) => row.amount.kind === "none" && !("value" in row.amount),
      ),
    ).toBe(true);
  });
});
