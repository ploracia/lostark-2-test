import { describe, expect, it } from "vitest";
import armory from "../../fixtures/armory-sample.json";
import { gradeAccessory } from "../../src/transfer/accessory";
import { convertEsther } from "../../src/transfer/esther";
import { extractTransferInput } from "../../src/transfer/extract";
import { mapGear } from "../../src/transfer/gear";
import { computeTransfer } from "../../src/transfer";
import { convertStone } from "../../src/transfer/stone";
import type { AccessoryIn, TransferInput } from "../../src/transfer/types";

const base: AccessoryIn = {
  part: "목걸이",
  index: 1,
  quality: 90,
  tier: 4,
  grade: "고대",
  options: [],
};
const stone = (
  a: number,
  b: number,
  unit?: "lv" | "node",
): Parameters<typeof convertStone>[0] => ({
  engravings: [
    { name: "원한", level: a, unit, harmful: false },
    { name: "아드레날린", level: b, unit, harmful: false },
  ],
});

describe("검증 보강 · 표1 구간 경계", () => {
  it.each([
    [50, null],
    [50.5, 100],
    [100, 100],
    [100.01, 150],
    [1675, 1675],
    [1676, 1680],
    [1770, 1770],
    [1785, 1795],
    [1786, 1800],
    [1790, 1800],
    [1791, 1810],
    [1800, 1815],
    [1800.01, null],
  ])("%s → %s", (input, expected) => {
    const result = mapGear(input);
    if (expected === null) expect(result.kind).toBe("none");
    else expect(result).toMatchObject({ value: { itemLevel: expected } });
  });
});

describe("검증 보강 · 표5 장신구", () => {
  it("품질 67은 대상, 66은 파편", () => {
    const options = [
      { text: "추가 피해 +2.6%", rank: "상" as const },
      { text: "적에게 주는 피해 +2.0%", rank: "상" as const },
    ];
    expect(
      gradeAccessory({ ...base, quality: 67, options }, "소서리스").scrollGrade,
    ).toMatchObject({ kind: "value", value: 3 });
    expect(
      gradeAccessory({ ...base, quality: 66, options }, "소서리스").outcome,
    ).toBe("shard");
  });
  it("등급 모르는 옵션은 숫자 하나가 아니라 범위로 표시", () => {
    const result = gradeAccessory(
      {
        ...base,
        options: [
          { text: "추가 피해 +2.6%", rank: "상" },
          { text: "적에게 주는 피해 +1.2%", rank: null },
        ],
      },
      "소서리스",
    );
    expect(result.outcome).toBe("scroll");
    expect(result.scrollGrade).toMatchObject({
      kind: "range",
      min: 3,
      max: 5,
      evidence: { level: "estimated" },
    });
  });
  it("유물 옵션 등급 미확인은 5등급/파편 미확인", () => {
    const result = gradeAccessory(
      {
        ...base,
        grade: "유물",
        options: [
          { text: "낙인력 +8%", rank: null },
          { text: "세레나데, 신앙, 조화 게이지 획득량 +6%", rank: "상" },
        ],
      },
      "바드",
    );
    expect(result.outcome).toBe("unknown");
    expect(result.scrollGrade).toMatchObject({ kind: "none" });
  });
  it("티어 4 고대·유물 외 등급과 null 필드는 확정하지 않음", () => {
    expect(
      gradeAccessory({ ...base, grade: "전설" }, "소서리스").evidence.level,
    ).toBe("unknown");
    expect(gradeAccessory({ ...base, quality: null }, "소서리스").outcome).toBe(
      "unknown",
    );
    expect(gradeAccessory({ ...base, tier: null }, "소서리스").outcome).toBe(
      "unknown",
    );
    expect(gradeAccessory({ ...base, options: null }, "소서리스").outcome).toBe(
      "unknown",
    );
    expect(gradeAccessory({ ...base, tier: 3 }, "소서리스").outcome).toBe(
      "remove",
    );
  });
});

describe("검증 보강 · 표9 스톤 단위", () => {
  it("활성도 +N은 세공 노드 수로 해석", () => {
    expect(convertStone(stone(9, 7, "node"), "소서리스")).toMatchObject({
      points: [3, 2],
      upgrade: { value: { slots: 2, level: 7 } },
    });
  });
  it("노드 4개를 Lv.4로 읽지 않음", () => {
    expect(convertStone(stone(10, 4, "node"), "소서리스").upgrade.kind).toBe(
      "none",
    );
    expect(convertStone(stone(4, 4, "lv"), "소서리스").upgrade).toMatchObject({
      value: { slots: 5, level: 7 },
    });
  });
  it("표9에 없는 합계는 반영 없음으로 추정", () => {
    const input: TransferInput = {
      ...extractTransferInput(armory),
      stone: stone(1, 2, "lv"),
    };
    const result = computeTransfer(input);
    expect(result.stone).toMatchObject({
      upgrade: { value: { slots: 0 }, evidence: { level: "estimated" } },
    });
  });
});

describe("검증 보강 · 에스더 연동", () => {
  it("1800 이상 에스더 연동 5부위는 25단계=1800 가정 추정", () => {
    expect(
      convertEsther({ evolution: 10, ella: 3, itemLevel: 1830 }).linkedLevel,
    ).toMatchObject({
      value: 1815,
      evidence: { level: "estimated", note: expect.stringContaining("1800") },
    });
  });
});

describe("검증 보강 · 순수성", () => {
  it("입력을 바꾸지 않고 같은 입력에 같은 결과", () => {
    const input = extractTransferInput(armory);
    const frozen = JSON.parse(JSON.stringify(input)) as TransferInput;
    const first = computeTransfer(input);
    expect(input).toEqual(frozen);
    expect(computeTransfer(input)).toEqual(first);
  });
  it("빈 장비에서도 16부위를 만들고 숫자를 지어내지 않음", () => {
    const result = computeTransfer(extractTransferInput({}));
    expect(result.slots).toHaveLength(16);
    expect(result.slots.every((slot) => slot.itemLevel.kind === "none")).toBe(
      true,
    );
    expect(result.current.equippedAvg).toBeNull();
    expect(result.after.avg16.kind).toBe("none");
  });
});
