import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import armory from "../fixtures/armory-sample.json";
import { API_BASE, armoryPath, rateGate } from "../src/api";
import { Mokokoloa } from "../src/main";
import { queryClient } from "../src/session";
import { saveKey } from "../src/storage";

const proxyOrigin = vi.hoisted(() => "https://proxy.example");
vi.mock("../src/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/api")>()),
  PROXY_ORIGIN: proxyOrigin,
}));

afterEach(() => {
  cleanup();
  queryClient.clear();
  rateGate.reset();
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("sends the key through the Worker only after consent and returns to direct mode on request", async () => {
  const token = "fixture.proxy.token";
  const name = armory.ArmoryProfile.CharacterName;
  const path = armoryPath(name);
  const request = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError("simulated direct failure"))
    .mockResolvedValueOnce(
      Response.json(armory, {
        headers: {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "73",
          "X-RateLimit-Reset": "60",
        },
      }),
    )
    .mockResolvedValueOnce(Response.json(armory));
  vi.stubGlobal("fetch", request);
  const consent = vi
    .spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  saveKey("local", { token, savedAt: new Date().toISOString(), status: "ok" });
  history.replaceState(null, "", "/#/c/" + encodeURIComponent(name));
  render(<Mokokoloa />);

  const retry = await screen.findByRole("button", { name: "프록시로 재시도" });
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(retry);
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(retry);

  await screen.findByText("잔여 73/100");
  expect(consent).toHaveBeenLastCalledWith(
    expect.stringContaining(proxyOrigin),
  );
  expect(request).toHaveBeenNthCalledWith(
    1,
    API_BASE + path,
    expect.objectContaining({
      headers: { accept: "application/json", authorization: "bearer " + token },
    }),
  );
  expect(request).toHaveBeenNthCalledWith(
    2,
    proxyOrigin + path,
    expect.objectContaining({
      headers: { accept: "application/json", "x-lostark-key": token },
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: "프록시 끄기" }));
  fireEvent.click(await screen.findByRole("button", { name: "새로고침" }));
  await waitFor(() =>
    expect(request).toHaveBeenNthCalledWith(
      3,
      API_BASE + path,
      expect.objectContaining({
        headers: {
          accept: "application/json",
          authorization: "bearer " + token,
        },
      }),
    ),
  );
});
