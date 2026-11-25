import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { engravingIcon } from "../src/data/engraving-icons";
import { EngravingCard } from "../src/sections";

it("matches official engraving names regardless of whitespace", () => {
  expect(engravingIcon("원한")).toBe(
    "https://cdn-lostark.game.onstove.com/efui_iconatlas/buff/buff_71.png",
  );
  expect(engravingIcon("실드관통")).toBe(
    "https://cdn-lostark.game.onstove.com/efui_iconatlas/buff/buff_89.png",
  );
  expect(engravingIcon(" 실드 관통\t")).toBe(engravingIcon("실드관통"));
  expect(engravingIcon("공격력 감소")).toBeUndefined();
});

it("renders mapped images and retains text for failed or missing icons", () => {
  const { unmount } = render(
    <EngravingCard
      data={{
        ArkPassiveEffects: ["실드 관통", "공격력 감소"].map((Name) => ({
          Name,
          Grade: "유물",
          Level: 4,
        })),
      }}
    />,
  );
  const mappedIcon = screen.getByText("실", { selector: ".ico" });
  const image = mappedIcon.querySelector("img")!;
  expect(image.getAttribute("src")).toBe(engravingIcon("실드관통"));
  expect(
    screen.getByText("공", { selector: ".ico" }).querySelector("img"),
  ).toBeNull();

  fireEvent.error(image);
  expect(mappedIcon.querySelector("img")).toBeNull();
  expect(mappedIcon.textContent).toBe("실");
  unmount();
});
