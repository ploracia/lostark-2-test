import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCoreTooltip } from "../src/parse/arkgrid";
import { GridCard } from "../src/sections";
import sample from "./fixtures-arkgrid-synthetic.json";

const slot = sample.ArkGrid.Slots[0];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Ark Grid core details", () => {
  it.each([
    [0, [false, false]],
    [10, [true, false]],
    [14, [true, true]],
  ])(
    "reads 10P and 14P from a V9.0.0-shaped core tooltip at %i points",
    (Point, active) => {
      const parsed = parseCoreTooltip({ ...slot, Point });
      expect(parsed?.effects.map((effect) => effect.point)).toEqual([10, 14]);
      expect(parsed?.effects.map((effect) => effect.active)).toEqual(active);
      expect(parsed?.effects[0].text).toContain("3.0%");
      expect(parsed?.effects[1].text).toContain("\n'운명: 예시 방벽'");
      expect(parsed?.activationCondition).toBe(
        "아크 패시브 예시 노드 활성화 필요",
      );
    },
  );

  it("returns null when the exact options block or thresholds are missing", () => {
    expect(parseCoreTooltip({ ...slot, Tooltip: "invalid" })).toBeNull();
    const tooltip = JSON.parse(slot.Tooltip);
    delete tooltip.Element_006;
    expect(
      parseCoreTooltip({ ...slot, Tooltip: JSON.stringify(tooltip) }),
    ).toBeNull();
    tooltip.Element_006 = {
      type: "ItemPartBox",
      value: { Element_000: "코어 옵션", Element_001: "[10P]" },
    };
    expect(
      parseCoreTooltip({ ...slot, Tooltip: JSON.stringify(tooltip) }),
    ).toBeNull();
  });

  it("shows active thresholds and gem data, and returns focus when dismissed", () => {
    const show = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "showModal",
    );
    const close = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      "close",
    );
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
    try {
      // 커뮤니티 파서 기반 합성 픽스처. 실제 젬 툴팁 원문은 공개되지 않았습니다.
      const gemTooltip = JSON.stringify({
        Element_000: {
          type: "NameTagBox",
          value: "<FONT>질서의 젬 : 안정</FONT>",
        },
        Element_005: {
          type: "ItemPartBox",
          value: {
            Element_000: "젬 효과",
            Element_001:
              "필요 의지력 : 3 (기본 값 8 - 의지력 효율 5)<BR>질서 포인트 : 5<br>[공격력] Lv.4",
          },
        },
      });
      render(
        <GridCard
          data={{
            Slots: [
              {
                ...slot,
                Point: 10,
                Gems: [
                  {
                    Index: 0,
                    Grade: "유물",
                    IsActive: true,
                    Tooltip: gemTooltip,
                  },
                  {
                    Index: 1,
                    Grade: "전설",
                    IsActive: false,
                    Tooltip: "unknown",
                  },
                ],
              },
            ],
          }}
        />,
      );
      const trigger = screen.getByRole("button", { name: /예시 연격/ });
      fireEvent.click(trigger);
      const dialog = within(screen.getByRole("dialog", { name: slot.Name }));
      expect(dialog.getByRole("button", { name: "닫기" })).toBe(
        document.activeElement,
      );
      expect(dialog.getByText("10 P 활성")).toBeTruthy();
      expect(dialog.getByText("14 P 필요")).toBeTruthy();
      expect(dialog.getByText("질서의 젬 : 안정")).toBeTruthy();
      expect(dialog.getByText("필요 의지력 3 · 질서 포인트 5")).toBeTruthy();
      expect(dialog.getByText("공격력 Lv.4")).toBeTruthy();
      expect(dialog.getByText("전설 · 비활성")).toBeTruthy();
      expect(dialog.getAllByRole("list", { name: "젬 옵션" })).toHaveLength(1);
      fireEvent(
        screen.getByRole("dialog"),
        new Event("cancel", { cancelable: true }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      cleanup();
      if (show)
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", show);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (close)
        Object.defineProperty(HTMLDialogElement.prototype, "close", close);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });
});
