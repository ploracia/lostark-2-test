import { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  createPath,
  HashRouter,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { rateGate } from "./api";
import Character, { characterUrl } from "./Character";
import KeySettings from "./KeySettings";
import { RecentSearches } from "./RecentSearches";
import { queryClient, SessionProvider, useSession } from "./session";
import { maskKey } from "./storage";
import { ThemeToggle, useClock, useNames } from "./ui";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";

function SearchBox({ name, large = false }: { name: string; large?: boolean }) {
  const [input, setInput] = useState(name);
  const [open, setOpen] = useState(false);
  const popupId = useId();
  const ref = useRef<HTMLInputElement>(null);
  const { recent } = useSession();
  const navigate = useNavigate();
  const expanded = open && recent.length > 0;
  useEffect(() => {
    if (large) return;
    function shortcut(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) ||
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      ref.current?.focus();
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [large]);

  return (
    <form
      className={"search" + (large ? " search-large" : "")}
      role="search"
      aria-label={large ? "본문 캐릭터 검색" : "상단 캐릭터 검색"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape" && expanded) {
          event.preventDefault();
          ref.current?.focus();
          setOpen(false);
        }
        if (!expanded || (event.key !== "ArrowDown" && event.key !== "ArrowUp"))
          return;
        const links = Array.from(
          event.currentTarget.querySelectorAll<HTMLAnchorElement>(
            "[data-recent-link]",
          ),
        );
        const current = links.findIndex((link) => link === event.target);
        const next =
          event.key === "ArrowDown"
            ? (current + 1) % links.length
            : (current < 0 ? links.length - 1 : current - 1 + links.length) %
              links.length;
        event.preventDefault();
        links[next]?.focus();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const value = input.trim();
        if (!value) return;
        setInput(value);
        setOpen(false);
        navigate(characterUrl(value));
      }}
    >
      <input
        type="search"
        ref={ref}
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        aria-controls={expanded ? popupId : undefined}
        placeholder="캐릭터 이름을 입력하세요"
        aria-label="캐릭터 이름"
      />
      {!large && <kbd aria-hidden="true">/</kbd>}
      <button className="btn primary" disabled={!input.trim()}>
        검색
      </button>
      {expanded && (
        <RecentSearches
          id={popupId}
          close={() => setOpen(false)}
          returnFocus={() => ref.current?.focus()}
        />
      )}
    </form>
  );
}

function TopBar({ name }: { name: string }) {
  const { key, proxyActive, disableProxy } = useSession();
  const now = useClock();
  if (!key)
    return (
      <header className="topbar">
        <span className="logo">
          <i aria-hidden="true" />
          <b>Ark Lens</b>
        </span>
        <span className="spacer" />
        <ThemeToggle />
      </header>
    );
  const rate = rateGate.snapshot(now);
  const status =
    key.value.status === "rejected"
      ? "키 거부됨"
      : key.value.status === "unverified"
        ? "미검증 키"
        : "키 " + maskKey(key.value.token);
  return (
    <header className="topbar">
      <Link className="logo" to="/" aria-label="Ark Lens 홈">
        <i aria-hidden="true" />
        <b>Ark Lens</b>
      </Link>
      <SearchBox key={name} name={name} />
      <span className="spacer" />
      {proxyActive && (
        <button className="chip" onClick={disableProxy}>
          프록시 끄기
        </button>
      )}
      <span
        className={
          "chip rate-chip num" +
          (rate.remaining <= 5 || rate.waitUntil > now ? " warning-text" : "")
        }
        title={
          rate.estimated
            ? "최근 60초 요청을 기준으로 추정"
            : "API 응답 헤더 기준"
        }
      >
        잔여 {rate.estimated && "≈ "}
        {rate.remaining}/{rate.limit}
      </span>
      <Link
        className="chip"
        to="/settings/key"
        state={{ returnTo: name ? characterUrl(name) : "/" }}
      >
        <span
          className={
            "dot " +
            (key.value.status === "rejected"
              ? "bad"
              : key.value.status !== "ok"
                ? "off"
                : "")
          }
        />
        {status}
      </Link>
      <ThemeToggle />
    </header>
  );
}

function Favorites({ names }: { names: string[] }) {
  return (
    <section>
      <h2>즐겨찾기</h2>
      <div className="actions">
        {names.length ? (
          names.map((name) => (
            <Link className="chip" key={name} to={characterUrl(name)}>
              {name}
            </Link>
          ))
        ) : (
          <span className="muted">아직 기록이 없습니다.</span>
        )}
      </div>
    </section>
  );
}

function App() {
  const location = useLocation();
  const { key, demo, recent } = useSession();
  const [favorites, setFavorites] = useNames("favorites");
  const match = location.pathname.match(/^\/c\/([^/]+)(?:\/(transfer))?\/?$/);
  const unknownCharacterTab =
    !match && location.pathname.match(/^\/c\/([^/]+)\//);
  let name = match?.[1] ?? "";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* Preserve malformed input as text. */
  }
  const settings = location.pathname === "/settings/key";
  if (!key && !settings)
    return (
      <Navigate
        to="/settings/key"
        replace
        state={{ returnTo: createPath(location) }}
      />
    );
  if (unknownCharacterTab) {
    return (
      <Navigate
        to={{
          pathname: "/c/" + unknownCharacterTab[1],
          search: location.search,
        }}
        replace
      />
    );
  }
  return (
    <>
      <TopBar name={name} />
      <main>
        {demo && <p className="demo-label small muted">데모 · 가상 데이터</p>}
        {typeof location.state?.keyNotice === "string" && (
          <p className="notice ok" role="status">
            {location.state.keyNotice}
          </p>
        )}
        {settings ? (
          <KeySettings />
        ) : name ? (
          <Character
            key={name}
            name={name}
            tab={match?.[2] === "transfer" ? "transfer" : "current"}
            recent={recent.map((entry) => entry.name)}
            favorite={favorites.includes(name)}
            toggleFavorite={() =>
              setFavorites(
                favorites.includes(name)
                  ? favorites.filter((entry) => entry !== name)
                  : [name, ...favorites],
              )
            }
          />
        ) : location.pathname !== "/" ? (
          <Navigate to="/" replace />
        ) : (
          <div className="card empty-home">
            <h1>로스트아크 캐릭터 조회</h1>
            <SearchBox name="" large />
            <RecentSearches />
            <Favorites names={favorites} />
          </div>
        )}
      </main>
    </>
  );
}

export function ArkLens() {
  // Keep existing hash links and support direct paths served by the SPA fallback.
  const [Router] = useState(() =>
    window.location.pathname === "/" ? HashRouter : BrowserRouter,
  );
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <SessionProvider>
          <App />
        </SessionProvider>
      </Router>
    </QueryClientProvider>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<ArkLens />);
