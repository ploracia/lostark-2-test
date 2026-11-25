import { afterEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/armory-sample.json";
import {
  accessoryTypes,
  armorOrder,
  gemKind,
  parseTooltip,
  tooltipLines,
  plainText,
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

describe("tooltip parser against guide §4 structures", () => {
  it("reads quality, level, tier and advanced honing by block type, not by index", () => {
    const raw = JSON.stringify({
      Element_000: {
        type: "NameTagBox",
        value:
          "<P ALIGN='CENTER'><FONT COLOR='#E3C7A1'>+25 신념의 업화 머리장식</FONT></P>",
      },
      // Index shifted on purpose: ItemTitle is not at Element_001.
      Element_007: {
        type: "ItemTitle",
        value: {
          qualityValue: 97,
          leftStr0:
            "<FONT SIZE='12'><FONT COLOR='#E3C7A1'>고대 투구</FONT></FONT>",
          leftStr2: "<FONT SIZE='14'>아이템 레벨 1755 (티어 4)</FONT>",
        },
      },
      Element_011: {
        type: "SingleTextBox",
        value:
          "<FONT SIZE='12'><FONT COLOR='#FFD200'>[상급 재련]</FONT> 40단계</FONT>",
      },
    });
    expect(parseTooltip(raw)).toMatchObject({
      quality: 97,
      itemLevel: "1755",
      tier: 4,
      advanced: 40,
    });
  });

  it("hides quality when the item has none (qualityValue -1)", () => {
    const raw = JSON.stringify({
      Element_001: {
        type: "ItemTitle",
        value: { qualityValue: -1, leftStr2: "아이템 티어 4" },
      },
    });
    expect(parseTooltip(raw)?.quality).toBeNull();
  });

  it("reads ability stone engravings with debuff colour and level bonus", () => {
    const raw = JSON.stringify({
      Element_006: {
        type: "IndentStringGroup",
        value: {
          Element_000: {
            topStr: "<FONT COLOR='#A9D0F5'>무작위 각인 효과</FONT>",
            contentStr: {
              Element_000: {
                contentStr: "[<FONT COLOR='#FFFFAC'>원한</FONT>] Lv.3",
              },
              Element_001: {
                contentStr: "[<FONT COLOR='#FFFFAC'>예리한 둔기</FONT>] Lv.2",
              },
              Element_002: {
                contentStr: "[<FONT COLOR='#FE2E2E'>공격속도 감소</FONT>] Lv.1",
              },
            },
          },
        },
      },
    });
    expect(parseTooltip(raw)?.engravings).toEqual([
      { name: "원한", level: 3, harmful: false, bonus: null },
      { name: "예리한 둔기", level: 2, harmful: false, bonus: null },
      { name: "공격속도 감소", level: 1, harmful: true, bonus: null },
    ]);
  });

  it("splits accessory polish lines on <BR>/<br> and reads HEX without #", () => {
    const raw = JSON.stringify({
      Element_005: {
        type: "ItemPartBox",
        value: {
          Element_000: "<FONT COLOR='#A9D0F5'>연마 효과</FONT>",
          Element_001:
            "<FONT COLOR='FE9600'>무기 공격력 +960</FONT><BR><font color='fe9600'>추가&nbsp;피해 +2.60%</font><br>적에게 주는 피해 +2.00%",
        },
      },
    });
    expect(parseTooltip(raw)?.options).toEqual([
      { rank: "상", text: "무기 공격력 +960", colors: ["#FE9600"] },
      { rank: "상", text: "추가 피해 +2.60%", colors: ["#FE9600"] },
      { rank: null, text: "적에게 주는 피해 +2.00%", colors: [] },
    ]);
  });

  it("decodes entities once and never yields markup", () => {
    expect(plainText("a&amp;lt;b&gt;&nbsp;&#39;c&#39;")).toBe("a&lt;b> 'c'");
    const lines = tooltipLines(
      JSON.stringify({
        Element_000: {
          type: "SingleTextBox",
          value: "&lt;img src=x onerror=alert(1)&gt;<script>x</script>",
        },
      }),
    );
    // Rendered as React text only; the parser output contains no live tags.
    expect(lines.join("")).not.toMatch(/<script/i);
  });
});
