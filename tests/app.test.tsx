import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import { ArkLens } from "../src/main";
import { queryClient } from "../src/session";
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
  history.replaceState(null, "", "/" + path);
  return render(<ArkLens />);
}

describe("MSW transport", () => {
  it("requests the encoded name and raw filters with the key in a header", async () => {
    server.use(
      http.get(endpoint, ({ request }) => {
        expect(new URL(request.url).search).toBe("?filters=" + ARMORY_FILTERS);
        expect(request.headers.get("authorization")).toBe("bearer " + token);
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

describe("character views with MSW", () => {
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
  it("preserves a share link without a key and returns to it after validation", async () => {
    server.use(
      http.get(API_BASE + "/news/alarms", () => HttpResponse.json([])),
      http.get(endpoint, () => HttpResponse.json(armory)),
    );
    go(hash, false);
    expect(
      screen.getByRole("heading", { name: "API 키가 필요합니다" }),
    ).toBeTruthy();
    expect(location.hash).toBe(hash);
    fireEvent.click(screen.getByRole("link", { name: "키 등록하기" }));
    fireEvent.change(screen.getByLabelText("API 키", { selector: "input" }), {
      target: { value: "Bearer <" + token + ">" },
    });
    fireEvent.click(screen.getByRole("button", { name: "검증 후 저장" }));
    expect(
      await screen.findByRole("heading", { name: /은하수바리케이드/ }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/검증 성공.*…alue/);
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
    vi.stubGlobal("HTMLDialogElement", window.HTMLDialogElement);
    const dialog = window.HTMLDialogElement.prototype;
    const originalShow = dialog.showModal;
    const originalClose = dialog.close;
    dialog.showModal = function () {
      this.setAttribute("open", "");
    };
    dialog.close = function () {
      this.removeAttribute("open");
    };
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
      fireEvent.click(screen.getByRole("link", { name: "Ark Lens 홈" }));
      const field = screen.getAllByRole("searchbox")[0];
      fireEvent.change(field, { target: { value: name } });
      fireEvent.submit(field.closest("form")!);
      await screen.findByRole("heading", { name: /은하수바리케이드/ });
      expect(armoryCalls).toBe(1);
      expect(siblingsCalls).toBe(1);
    } finally {
      dialog.showModal = originalShow;
      dialog.close = originalClose;
      vi.unstubAllGlobals();
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
    render(<ArkLens />);
    expect(
      await screen.findByRole("heading", { name: /은하수바리케이드/ }),
    ).toBeTruthy();
    expect(calls).toBe(1);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
