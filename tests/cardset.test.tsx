import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardSet } from "../src/sections";

afterEach(cleanup);

describe("CardSet", () => {
  it("shows the card name below the art without covering the image", () => {
    const name = "아주 긴 이름을 가진 카드 이름 예시입니다 두 줄 넘김 확인";
    const { container } = render(
      <CardSet
        data={{
          Cards: [
            {
              Slot: 0,
              Name: name,
              Icon: "https://example.invalid/card.png",
              AwakeCount: 3,
              AwakeTotal: 5,
              Grade: "전설",
              Tooltip: "",
            },
          ],
          Effects: [],
        }}
      />,
    );
    const card = container.querySelector(".tcard");
    const art = card?.querySelector(".tcard-art");
    const label = card?.querySelector(".card-name");
    expect(art?.querySelector("img")).toBeTruthy();
    expect(label?.textContent).toBe(name);
    expect(art?.contains(label ?? null)).toBe(false);
    expect(art?.querySelector(".awake")).toBeNull();
    expect(card?.lastElementChild).toBe(label);
    expect(card?.getAttribute("title")).toContain(name);
    expect(card?.querySelectorAll(".awake i.on")).toHaveLength(3);
  });
});
