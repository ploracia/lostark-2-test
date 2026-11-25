import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import armory from "../fixtures/armory-sample.json";
import siblings from "../fixtures/siblings-sample.json";
import {
  API_BASE,
  ARMORY_FILTERS,
  armoryPath,
  lostark,
  rateGate,
} from "../src/api";
import { Mokokoloa } from "../src/main";
import { engravingIcons } from "../src/data/engraving-icons";
import { RECENT, readRecent } from "../src/recent";
import { clearNotFound, queryClient, writeCache } from "../src/session";
import { getKey, saveKey } from "../src/storage";

const token = "test.fixture.value";
const name = armory.ArmoryProfile.CharacterName;
const hash = "#/c/" + encodeURIComponent(name);
const endpoint = API_BASE + "/armories/characters/:name";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  rateGate.reset();
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  clearNotFound();
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
  delete document.documentElement.dataset.theme;
  history.replaceState(null, "", "/");
});
afterAll(() => server.close());

function go(path = hash, withKey = true) {
  if (withKey)
    saveKey("local", {
      token,
      savedAt: new Date().toISOString(),
      status: "ok",
    });
  history.replaceState(null, "", path.startsWith("/") ? path : "/" + path);
  return render(<Mokokoloa />);
}

describe("address change notice", () => {
  it.each([
    "/?from=ark-lens" + hash,
    "/c/example?from=ark-lens",
    "/settings/key?from=ark-lens",
  ])("shows the notice at key registration after opening %s", async (path) => {
    go(path, false);
    expect(
      await screen.findByText("주소가 바뀌어 키를 다시 등록해야 할 수 있어요"),
    ).toBeTruthy();
  });

  it("omits the notice on an ordinary visit", () => {
    go("/#/settings/key", false);
    expect(
      screen.queryByText("주소가 바뀌어 키를 다시 등록해야 할 수 있어요"),
    ).toBeNull();
  });
});

describe("recent searches", () => {
  function mockCharacters() {
    server.use(
      http.get(endpoint, ({ params }) =>
        params.name === "없는캐릭터"
          ? HttpResponse.json({ ArmoryProfile: null })
          : HttpResponse.json({
              ...armory,
              ArmoryProfile: {
                ...armory.ArmoryProfile,
                CharacterName: params.name,
              },
            }),
      ),
    );
  }

  function search(value: string) {
    const form = screen.getByRole("search", { name: "상단 캐릭터 검색" });
    fireEvent.change(within(form).getByRole("searchbox"), {
      target: { value },
    });
    fireEvent.submit(form);
  }

  it("keeps five successful lookups, moves repeats up, and skips misses", async () => {
    mockCharacters();
    go("");
    const names = ["하나", "둘", "셋", "넷", "다섯", "여섯"];
    for (const value of [...names, "셋"]) {
      search(value);
      await waitFor(() => expect(readRecent("local")[0]?.name).toBe(value));
    }
    expect(readRecent("local").map((entry) => entry.name)).toEqual([
      "셋",
      "여섯",
      "다섯",
      "넷",
      "둘",
    ]);
    expect(readRecent("local")[0]).toMatchObject({
      server: armory.ArmoryProfile.ServerName,
      job: armory.ArmoryProfile.CharacterClassName,
      level: armory.ArmoryProfile.ItemAvgLevel,
    });
    search("없는캐릭터");
    await screen.findByRole("heading", { name: /캐릭터를 찾을 수 없습니다/ });
    expect(readRecent("local").map((entry) => entry.name)).not.toContain(
      "없는캐릭터",
    );
  });

  it("loads legacy names, supports keyboard focus, and deletes one or all chips", () => {
    localStorage.setItem(RECENT, JSON.stringify(["하나", "둘", "하나"]));
    go("");
    const form = screen.getByRole("search", { name: "상단 캐릭터 검색" });
    const input = within(form).getByRole("searchbox");
    act(() => input.focus());
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const first = within(form).getByRole("link", { name: "하나" });
    const second = within(form).getByRole("link", { name: "둘" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "ArrowUp" });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "Escape" });
    expect(document.activeElement).toBe(input);
    expect(within(form).queryByRole("link", { name: "둘" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "하나 검색 기록 삭제" }),
    );
    expect(readRecent("local").map((entry) => entry.name)).toEqual(["둘"]);
    fireEvent.click(screen.getByRole("button", { name: "전체 지우기" }));
    expect(localStorage.getItem(RECENT)).toBeNull();
    expect(screen.queryByRole("link", { name: "둘" })).toBeNull();
  });

  it("keeps tab-only searches in session storage and clears both histories with the key", async () => {
    saveKey("session", {
      token,
      savedAt: new Date().toISOString(),
      status: "ok",
    });
    const legacy = JSON.stringify(["브라우저기록"]);
    localStorage.setItem(RECENT, legacy);
    mockCharacters();
    go("", false);
    expect(screen.queryByRole("link", { name: "브라우저기록" })).toBeNull();
    search(name);
    await waitFor(() => expect(readRecent("session")[0]?.name).toBe(name));
    expect(localStorage.getItem(RECENT)).toBe(legacy);
    fireEvent.click(screen.getByRole("link", { name: /키 …/ }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      fireEvent.click(screen.getByRole("button", { name: "키 삭제" }));
      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining("최근 검색 기록"),
      );
      expect(sessionStorage.getItem(RECENT)).toBeNull();
      expect(localStorage.getItem(RECENT)).toBeNull();
    } finally {
      confirm.mockRestore();
    }
  });
});

describe("MSW transport", () => {
  it("requests the encoded name and raw filters with the key in a header", async () => {
    server.use(
      http.get(endpoint, ({ request }) => {
        expect(new URL(request.url).search).toBe("?filters=" + ARMORY_FILTERS);
        expect(request.headers.get("authorization")).toBe("bearer " + token);
        expect(request.url).not.toContain(token);
        return HttpResponse.json(armory);
      }),
    );
    expect(await lostark(armoryPath(" " + name + " "), token)).toEqual(armory);
  });
  it.each([
    [HttpResponse.json(null), "not-found"],
    [HttpResponse.json({ ArmoryProfile: null }), "not-found"],
    [HttpResponse.json(null, { status: 401 }), "unauthorized"],
    [HttpResponse.json(null, { status: 404 }), "not-found"],
    [HttpResponse.json(null, { status: 429 }), "rate-limited"],
    [HttpResponse.json(null, { status: 503 }), "maintenance"],
    [HttpResponse.error(), "network"],
  ] as const)("maps simulated response %# to %s", async (response, kind) => {
    server.use(http.get(endpoint, () => response));
    await expect(lostark(armoryPath(name), token)).rejects.toMatchObject({
      kind,
    });
  });
  it("propagates abort without classifying it as a network error", async () => {
    server.use(
      http.get(endpoint, async () => {
        await delay(40);
        return HttpResponse.json(armory);
      }),
    );
    const controller = new AbortController();
    const request = lostark(armoryPath(name), token, controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("first visit onboarding", () => {
  it("opens key settings from the home page", () => {
    go("", false);
    expect(
      screen.getByRole("heading", { name: "로스트아크 API 키 등록" }),
    ).toBeTruthy();
    expect(location.hash).toBe("#/settings/key");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it.each([hash, hash.slice(1)])(
    "returns to the exact character URL from %s after validation",
    async (route) => {
      const originalUrl = route.startsWith("#")
        ? "/" + route + "?tab=gems#detail"
        : route + "?tab=gems#detail";
      const armoryRequest = vi.fn(() => HttpResponse.json(armory));
      server.use(
        http.get(API_BASE + "/news/alarms", () => HttpResponse.json([])),
        http.get(endpoint, armoryRequest),
      );
      history.replaceState(null, "", originalUrl);
      render(<Mokokoloa />);
      expect(
        screen.getByRole("heading", { name: "로스트아크 API 키 등록" }),
      ).toBeTruthy();
      expect(location.pathname + location.hash).toBe(
        route.startsWith("#") ? "/#/settings/key" : "/settings/key",
      );
      expect(armoryRequest).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("API 키", { selector: "input" }), {
        target: { value: "Bearer <" + token + ">" },
      });
      fireEvent.click(screen.getByRole("button", { name: "검증 후 저장" }));
      expect(
        await screen.findByRole("heading", { name: /은하수바리케이드/ }),
      ).toBeTruthy();
      expect(location.pathname + location.search + location.hash).toBe(
        originalUrl,
      );
      expect(screen.getByRole("status").textContent).toMatch(
        /검증 성공.*…alue/,
      );
    },
  );
});

describe("character views with MSW", () => {
  it.each([hash, hash.slice(1)])(
    "switches character tabs without requesting or recording again from %s",
    async (route) => {
      const armoryRequest = vi.fn(() => HttpResponse.json(armory));
      const writes = vi.spyOn(Storage.prototype, "setItem");
      try {
        server.use(http.get(endpoint, armoryRequest));
        go(route);
        const current = await screen.findByRole("tab", { name: "현재" });
        const tabs = within(
          screen.getByRole("tablist", { name: "캐릭터 보기" }),
        );
        current.focus();
        fireEvent.keyDown(current, { key: "ArrowRight" });
        expect(await screen.findByText("1,788.75")).toBeTruthy();
        expect(screen.getByText("1~21등급 중 계산 불가")).toBeTruthy();
        expect(tabs.getByRole("tab", { selected: true }).textContent).toContain(
          "이관",
        );
        expect(document.activeElement).toBe(
          tabs.getByRole("tab", { selected: true }),
        );
        const path = () => location.pathname + location.hash;
        expect(path()).toMatch(/\/transfer$/);
        await act(async () => history.back());
        await waitFor(() =>
          expect(tabs.getByRole("tab", { selected: true }).textContent).toBe(
            "현재",
          ),
        );
        for (let i = 0; i < 10; i++) {
          fireEvent.click(screen.getByRole("tab", { name: /이관/ }));
          fireEvent.click(screen.getByRole("tab", { name: "현재" }));
        }
        expect(armoryRequest).toHaveBeenCalledTimes(1);
        expect(
          writes.mock.calls.filter(([key]) => key === RECENT),
        ).toHaveLength(1);
      } finally {
        writes.mockRestore();
      }
    },
  );

  it.each([hash, hash.slice(1)])(
    "loads the transfer deep link and redirects unknown tabs from %s",
    async (route) => {
      const armoryRequest = vi.fn(() => HttpResponse.json(armory));
      server.use(http.get(endpoint, armoryRequest));
      go(route + "/transfer");
      expect(await screen.findByText("1,788.75")).toBeTruthy();
      expect(armoryRequest).toHaveBeenCalledTimes(1);
      cleanup();
      go(route + "/unknown");
      expect(
        (await screen.findByRole("tab", { selected: true, name: "현재" }))
          .textContent,
      ).toBe("현재");
      expect(location.pathname + location.hash).not.toContain("/unknown");
    },
  );

  it("consolidates the transfer layout and discards retired overrides", async () => {
    const armoryRequest = vi.fn(() => HttpResponse.json(armory));
    server.use(http.get(endpoint, armoryRequest));
    localStorage.setItem(
      "mokokoloa.transfer.v1",
      JSON.stringify({ [name]: { vambraceHoning: 12 } }),
    );
    localStorage.setItem(
      "arklens.transfer.v1",
      JSON.stringify({ [name]: { gearItemLevel: { 무기: 1800 } } }),
    );
    go(hash + "/transfer");
    expect(await screen.findByText("1,788.75")).toBeTruthy();
    expect(screen.getAllByRole("group")).toHaveLength(16);
    const weapon = within(screen.getByRole("group", { name: "무기" }));
    expect(weapon.getByText(/광휘의 수호 검.*재련 \+23/)).toBeTruthy();
    expect(weapon.getAllByText("공식 확정").length).toBeGreaterThan(0);
    expect(weapon.queryByText(/엘라|연동 5부위/)).toBeNull();
    expect(
      within(screen.getByRole("group", { name: "허리띠" })).getByText("신규"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("group", { name: "완갑" })).getByText(
        "재련 단계 확인 필요",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        /장비 변환|보석 → 광휘|적용 중인 가정|추가 정보 입력|환급·지급 아이템|이 화면이 계산하지 않는 것|기존 거래 가능 횟수 승계/,
      ),
    ).toBeNull();
    expect(localStorage.getItem("mokokoloa.transfer.v1")).toBeNull();
    expect(localStorage.getItem("arklens.transfer.v1")).toBeNull();
    expect(armoryRequest).toHaveBeenCalledTimes(1);
  });

  it("shows the equipped Esther weapon and linked estimate inside the weapon slot", async () => {
    const equipment = armory.ArmoryEquipment.map((item) =>
      item.Type !== "무기"
        ? item
        : {
            ...item,
            Grade: "에스더",
            Name: "+10 에스더 무기",
            Tooltip: JSON.stringify({
              Element_001: {
                type: "ItemTitle",
                value: { leftStr2: "<FONT>아이템 레벨 1830</FONT>" },
              },
              Element_002: { type: "SingleTextBox", value: "엘라 3단계" },
            }),
          },
    );
    server.use(
      http.get(endpoint, () =>
        HttpResponse.json({ ...armory, ArmoryEquipment: equipment }),
      ),
    );
    go(hash + "/transfer");
    const weapon = within(await screen.findByRole("group", { name: "무기" }));
    expect(weapon.getByText("T4 에스더")).toBeTruthy();
    expect(weapon.getByText(/1,865/)).toBeTruthy();
    expect(weapon.getByText(/엘라 4단계/)).toBeTruthy();
    expect(weapon.getByText(/연동 5부위 1,815/)).toBeTruthy();
    expect(weapon.getByText("추정")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "에스더 무기" })).toBeNull();
  });

  it.each([
    [401, "API 키가 거부되었습니다"],
    [404, "캐릭터를 찾을 수 없습니다"],
    [429, "호출 한도에 도달했습니다"],
    [503, "서버 점검 중"],
    [0, "서버에 연결할 수 없습니다"],
  ] as const)("shows HTTP %s state", async (status, heading) => {
    server.use(
      http.get(endpoint, () =>
        status ? HttpResponse.json(null, { status }) : HttpResponse.error(),
      ),
    );
    go();
    const alert = await screen.findByRole("alert");
    expect(alert.querySelector("h2")?.textContent).toContain(heading);
    expect({
      title: alert.querySelector("h2")?.textContent,
      actions: Array.from(
        alert.querySelectorAll("button, a"),
        (item) => item.textContent,
      ),
      countdown: Boolean(alert.querySelector("progress")),
    }).toMatchSnapshot();
    if (status === 401) expect(getKey()?.value.status).toBe("rejected");
  });
  it("shows equipment, accessory and avatar summaries without expandable details", async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(armory)));
    go();
    await screen.findByRole("heading", { name: /은하수바리케이드/ });

    const rows = [...document.querySelectorAll(".eq")];
    expect(rows).toHaveLength(13);
    expect(
      rows.every((row) => !row.querySelector("details, summary, button")),
    ).toBe(true);
    expect(screen.getByText("광휘의 수호 검").textContent).toBe(
      "+23 광휘의 수호 검",
    );
    expect(screen.getAllByText(/품질/).length).toBeGreaterThan(0);
    expect(
      screen
        .getByText("찬란한 구원자의 팔찌")
        .closest(".eq")
        ?.querySelector(".option-text"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "아바타" }));
    const avatar = screen.getByText("새벽 성채 무기").closest(".eq");
    expect(avatar).toBeTruthy();
    expect(avatar?.querySelector("details, summary, button")).toBeNull();
    expect(document.querySelector(".gem .tooltip summary")).toBeTruthy();
  });
  it("defers siblings, reuses cached results and switches equipment tabs with the keyboard", async () => {
    let armoryCalls = 0;
    let siblingsCalls = 0;
    server.use(
      http.get(endpoint, () => {
        armoryCalls++;
        return HttpResponse.json(armory);
      }),
      http.get(API_BASE + "/characters/:name/siblings", () => {
        siblingsCalls++;
        return HttpResponse.json(siblings);
      }),
    );
    const restore = stubDialog();
    try {
      go();
      await screen.findByRole("heading", { name: /은하수바리케이드/ });
      expect(siblingsCalls).toBe(0);
      fireEvent.keyDown(screen.getByRole("tab", { name: "장비" }), {
        key: "ArrowRight",
      });
      expect(
        screen
          .getByRole("tab", { name: "아바타" })
          .getAttribute("aria-selected"),
      ).toBe("true");
      const openDrawer = screen.getByRole("button", { name: "원정대 캐릭터" });
      openDrawer.focus();
      fireEvent.click(openDrawer);
      expect(
        await screen.findByRole("button", { name: /새벽별빛/ }),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(document.activeElement).toBe(openDrawer);
      fireEvent.click(screen.getByRole("button", { name: "원정대 캐릭터" }));
      expect(screen.getByRole("button", { name: /새벽별빛/ })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      fireEvent.click(screen.getByRole("link", { name: "모꼬꼬로아 홈" }));
      const field = screen.getAllByRole("searchbox")[0];
      fireEvent.change(field, { target: { value: name } });
      fireEvent.submit(field.closest("form")!);
      await screen.findByRole("heading", { name: /은하수바리케이드/ });
      expect(armoryCalls).toBe(1);
      expect(siblingsCalls).toBe(1);
    } finally {
      restore();
    }
  });
  it("keeps cached sections above a maintenance refresh failure and sets the cooldown", async () => {
    const handler = http.get(endpoint, () => HttpResponse.json(armory));
    server.use(handler);
    go();
    await screen.findByRole("heading", { name: /은하수바리케이드/ });
    server.use(
      http.get(endpoint, () => HttpResponse.json(null, { status: 503 })),
    );
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    const state = await screen.findByRole("alert");
    expect(state.textContent).toContain("저장된 조회 결과");
    expect(state.className).toMatchInlineSnapshot('"card state cached-error"');
    expect(
      screen.getByRole("heading", { name: /은하수바리케이드/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "상태 확인" }));
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /상태 확인.*초/ })
        .disabled,
    ).toBe(true);
  });
  it("delays the skeleton while the lookup is pending", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    server.use(
      http.get(endpoint, async () => {
        await pending;
        return HttpResponse.json(armory);
      }),
    );
    const { container } = go();
    expect(container.querySelector(".skeleton-hero")).toBeNull();
    await waitFor(() =>
      expect(container.querySelector(".skeleton-hero")).toBeTruthy(),
    );
    await act(async () => {
      finish();
    });
    await screen.findByRole("heading", { name: /은하수바리케이드/ });
  });

  it("automatically retries a 429 once and then waits for a manual action", async () => {
    let calls = 0;
    server.use(
      http.get(endpoint, () => {
        calls++;
        return HttpResponse.json(null, {
          status: 429,
          headers: { "X-RateLimit-Reset": "0" },
        });
      }),
    );
    go();
    await screen.findByRole("heading", { name: "호출 한도에 도달했습니다" });
    await waitFor(() => expect(calls).toBe(2), { timeout: 2500 });
    await waitFor(
      () => {
        expect(
          screen.getByRole<HTMLButtonElement>("button", { name: "지금 재시도" })
            .disabled,
        ).toBe(false);
      },
      { timeout: 2500 },
    );
    expect(calls).toBe(2);
  });

  it("persists the theme and 3-minute character cache across a reload", async () => {
    let calls = 0;
    server.use(
      http.get(endpoint, () => {
        calls++;
        return HttpResponse.json(armory);
      }),
    );
    const first = go();
    await screen.findByRole("heading", { name: /은하수바리케이드/ });
    fireEvent.click(screen.getByRole("button", { name: /테마 전환.*system/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    first.unmount();
    queryClient.clear();
    render(<Mokokoloa />);
    expect(
      await screen.findByRole("heading", { name: /은하수바리케이드/ }),
    ).toBeTruthy();
    expect(calls).toBe(1);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

function stubDialog() {
  const dialog = window.HTMLDialogElement.prototype;
  const originalShow = dialog.showModal;
  const originalClose = dialog.close;
  dialog.showModal = function () {
    this.setAttribute("open", "");
  };
  dialog.close = function () {
    this.removeAttribute("open");
  };
  return () => {
    cleanup();
    dialog.showModal = originalShow;
    dialog.close = originalClose;
  };
}

describe("review fixes", () => {
  it("percent-encodes reserved characters in the name but keeps literal + in filters", () => {
    expect(armoryPath(" a b/#?+ ")).toBe(
      "/armories/characters/a%20b%2F%23%3F%2B?filters=" + ARMORY_FILTERS,
    );
    expect(ARMORY_FILTERS).not.toMatch(/%2B|,|\s/);
  });

  it("negative-caches a missing character so a repeat search spends no quota", async () => {
    let calls = 0;
    server.use(
      http.get(endpoint, () => {
        calls++;
        return HttpResponse.json(null);
      }),
    );
    const first = go();
    await screen.findByRole("heading", { name: /캐릭터를 찾을 수 없습니다/ });
    first.unmount();
    render(<Mokokoloa />);
    await screen.findByRole("heading", { name: /캐릭터를 찾을 수 없습니다/ });
    expect(calls).toBe(1);
  });

  it("promotes an unverified key to ok after a successful lookup", async () => {
    server.use(http.get(endpoint, () => HttpResponse.json(armory)));
    saveKey("local", {
      token,
      savedAt: new Date().toISOString(),
      status: "unverified",
    });
    go(hash, false);
    await screen.findByRole("heading", { name: /은하수바리케이드/ });
    await waitFor(() => expect(getKey()?.value.status).toBe("ok"));
    expect(getKey()?.value.validatedAt).toEqual(expect.any(String));
  });

  it("shows a null siblings response as an empty roster, not an error", async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json(armory)),
      http.get(API_BASE + "/characters/:name/siblings", () =>
        HttpResponse.json(null),
      ),
    );
    const restore = stubDialog();
    try {
      go();
      await screen.findByRole("heading", { name: /은하수바리케이드/ });
      fireEvent.click(screen.getByRole("button", { name: "원정대 캐릭터" }));
      expect(
        await screen.findByText("표시할 원정대 캐릭터가 없습니다."),
      ).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      restore();
    }
  });

  it("drops the oldest cache entries when sessionStorage is full", () => {
    const setItem = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (value.length > 400)
          throw new DOMException("full", "QuotaExceededError");
        setItem.call(this, key, value);
      });
    try {
      const entry = (n: number) =>
        ["/p" + n, { at: n, keySavedAt: "k", data: "x".repeat(100) }] as [
          string,
          { at: number; keySavedAt: string; data: unknown },
        ];
      writeCache([1, 2, 3, 4, 5].map(entry));
      const saved = JSON.parse(sessionStorage.getItem("mokokoloa.cache.v1")!);
      expect(Object.keys(saved).length).toBeGreaterThan(0);
      expect(Object.keys(saved).at(-1)).toBe("/p5");
      expect(saved["/p1"]).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it("allows the profile and engraving image hosts and keeps scripts self-only", async () => {
    const html = (await import("../index.html?raw")).default;
    const csp = html.match(/content="(default-src[^"]+)"/)?.[1] ?? "";
    const directive = (name: string) =>
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(name + " "));
    expect(directive("img-src")).toContain("https://img.lostark.co.kr");
    const engravingOrigins = new Set(
      Object.values(engravingIcons).map((src) => new URL(src).origin),
    );
    for (const origin of engravingOrigins) {
      expect(directive("img-src")?.split(/\s+/)).toContain(origin);
    }
    expect(directive("script-src")).toBe("script-src 'self'");
    expect(directive("connect-src")).toBe(
      "connect-src 'self' https://developer-lostark.game.onstove.com",
    );
    expect(html).toContain('name="referrer" content="no-referrer"');
  });
});
