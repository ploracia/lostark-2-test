import { useEffect, useRef, useState } from "react";
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
import { queryClient, SessionProvider, useSession } from "./session";
import { maskKey } from "./storage";
import { ThemeToggle, useClock, useNames } from "./ui";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";

function SearchBox({
  name,
  onSearch,
  large = false,
}: {
  name: string;
  onSearch: (name: string) => void;
  large?: boolean;
}) {
  const [input, setInput] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
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
      onSubmit={(event) => {
        event.preventDefault();
        const value = input.trim();
        if (!value) return;
        setInput(value);
        onSearch(value);
        navigate(characterUrl(value));
      }}
    >
      <input
        type="search"
        ref={ref}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="캐릭터 이름을 입력하세요"
        aria-label="캐릭터 이름"
      />
      {!large && <kbd aria-hidden="true">/</kbd>}
      <button className="btn primary" disabled={!input.trim()}>
        검색
      </button>
    </form>
  );
}

function TopBar({
  name,
  onSearch,
}: {
  name: string;
  onSearch: (name: string) => void;
}) {
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
      <SearchBox key={name} name={name} onSearch={onSearch} />
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

function NameList({
  title,
  names,
  onSearch,
}: {
  title: string;
  names: string[];
  onSearch: (name: string) => void;
}) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="actions">
        {names.length ? (
          names.map((name) => (
            <Link
              className="chip"
              key={name}
              to={characterUrl(name)}
              onClick={() => onSearch(name)}
            >
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
  const { key, demo } = useSession();
  const [recent, setRecent] = useNames("recent");
  const [favorites, setFavorites] = useNames("favorites");
  const match = location.pathname.match(/^\/c\/([^/]+)\/?$/);
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
  function search(value: string) {
    setRecent(
      [value, ...recent.filter((entry) => entry !== value)].slice(0, 10),
    );
  }
  return (
    <>
      <TopBar name={name} onSearch={search} />
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
            recent={recent}
            favorite={favorites.includes(name)}
            toggleFavorite={() =>
              setFavorites(
                favorites.includes(name)
                  ? favorites.filter((entry) => entry !== name)
                  : [name, ...favorites],
              )
            }
            onSearch={search}
          />
        ) : location.pathname !== "/" ? (
          <Navigate to="/" replace />
        ) : (
          <div className="card empty-home">
            <h1>로스트아크 캐릭터 조회</h1>
            <SearchBox name="" onSearch={search} large />
            <NameList title="최근 검색" names={recent} onSearch={search} />
            <NameList title="즐겨찾기" names={favorites} onSearch={search} />
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
