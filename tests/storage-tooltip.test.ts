import { afterEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/armory-sample.json";
import {
  accessoryTypes,
  armorOrder,
  gemKind,
  parseTooltip,
} from "../src/parse/tooltip";
import {
  deleteKey,
  getKey,
  KEY,
  maskKey,
  normalizeKey,
  saveKey,
  validKey,
  write,
  type StoredKey,
} from "../src/storage";
import { RateGate } from "../src/rateGate";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
const token = "test.fixture.value";

describe("key storage", () => {
  it.each([
    token,
    "  " + token + "\n",
    "BEARER " + token,
    "{{<" + token + ">}}",
    "< bearer {" + token + "} >",
  ])("normalizes %s", (input) => {
    expect(normalizeKey(input)).toBe(token);
    expect(validKey(normalizeKey(input))).toBe(true);
  });
  it("rejects invalid format and masks the stored value", () => {
    expect(validKey("two.parts")).toBe(false);
    expect(validKey("four.separate.parts.here")).toBe(false);
    expect(maskKey(token)).toBe("…alue");
  });
  it("prefers the session key, replaces the old scope, and clears both stores", () => {
    const entry: StoredKey = {
      token,
      status: "ok",
      savedAt: new Date().toISOString(),
    };
    write("local", KEY, entry);
    write("session", KEY, { ...entry, status: "rejected" });
    expect(getKey()?.value.status).toBe("rejected");
    expect(saveKey("local", entry)).toBe(true);
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(getKey()?.value).toEqual(entry);
    expect(deleteKey()).toBe(true);
    expect(getKey()).toBeNull();
  });
});

describe("tooltips", () => {
  it("reads all six armor pieces and every accessory slot", () => {
    const armor = fixture.ArmoryEquipment.filter((item) =>
      armorOrder.includes(item.Type),
    );
    expect(armor).toHaveLength(6);
    for (const item of armor)
      expect(parseTooltip(item.Tooltip)).toMatchObject({
        tier: 4,
        quality: expect.any(Number),
        itemLevel: expect.any(String),
      });
    expect(
      parseTooltip(armor.find((item) => item.Type === "투구")?.Tooltip)
        ?.advanced,
    ).toBe(20);
    const accessories = fixture.ArmoryEquipment.filter((item) =>
      accessoryTypes.includes(item.Type),
    );
    expect(accessories).toHaveLength(7);
    for (const item of accessories.slice(0, 5))
      expect(parseTooltip(item.Tooltip)?.options.length).toBeGreaterThan(0);
    expect(parseTooltip(accessories[5].Tooltip)?.engravings).toContainEqual({
      name: "공격력 감소",
      level: 0,
      harmful: true,
      bonus: null,
    });
    expect(parseTooltip(accessories[6].Tooltip)?.options[0]?.kind).toBe(
      "changeable",
    );
  });
  it("matches dynamic keys, varying markup, known color and grouped bracelet options", () => {
    const raw = JSON.stringify({
      Element_306: {
        type: "ItemPartBox",
        value: {
          Element_990:
            "<font CoLoR='fe9600'>추가 피해 +2.60%</FoNt><Br/>공격력 +2",
          Element_040: "연마 효과",
        },
      },
      Element_109: {
        type: "ItemPartBox",
        value: {
          Element_210: "팔찌 효과",
          Element_382:
            "<IMG width='10' SRC='emoticon_tooltip_bracelet_changeable'><FONT color='#FE9600'>첫 줄</FONT><Br />둘째 줄<BR><IMG src='emoticon_tooltip_bracelet_locked'>신속 +82",
        },
      },
    });
    expect(parseTooltip(raw)?.options).toEqual([
      { rank: "상", text: "추가 피해 +2.60%", colors: ["#FE9600"] },
      { rank: null, text: "공격력 +2", colors: [] },
      {
        rank: null,
        text: "첫 줄\n둘째 줄",
        colors: ["#FE9600"],
        kind: "changeable",
      },
      { rank: null, text: "신속 +82", colors: [], kind: "locked" },
    ]);
  });
  it("returns null for malformed data and missing fields and extracts gem kinds", () => {
    expect(parseTooltip("<br>")).toBeNull();
    expect(parseTooltip("[]")).toBeNull();
    expect(parseTooltip("{}")).toMatchObject({
      quality: null,
      tier: null,
      advanced: null,
      itemLevel: null,
    });
    expect(fixture.ArmoryGem.Gems.map((gem) => gemKind(gem.Name))).toContain(
      "겁화",
    );
    expect(gemKind("7레벨 작열의 보석")).toBe("작열");
    expect(gemKind("보석")).toBeNull();
  });
});

describe("rate gate", () => {
  it("queues at five remaining and releases after the sliding window", () => {
    const gate = new RateGate();
    for (let i = 0; i < 95; i++) expect(gate.take(1000)).toBeNull();
    expect(gate.take(1001)).toBe(61_000);
    expect(gate.take(61_000)).toBeNull();
  });
  it("uses exposed values and holds requests during a server block", () => {
    const gate = new RateGate();
    expect(
      gate.observe(
        new Headers({
          "X-RateLimit-Remaining": "4",
          "X-RateLimit-Reset": "2",
          "X-RateLimit-Limit": "50",
        }),
        1000,
      ),
    ).toBe(3000);
    expect(gate.snapshot(1000)).toMatchObject({
      remaining: 4,
      limit: 50,
      estimated: false,
    });
    gate.block(5000);
    expect(gate.take(3000)).toBe(5000);
    expect(gate.take(5000)).toBeNull();
  });
});
