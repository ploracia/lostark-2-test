import { useEffect, useRef, useState, type ReactNode } from "react";
import { read, write } from "./storage";

export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const themes = ["system", "light", "dark"] as const;
export function ThemeToggle() {
  const [theme, setTheme] = useState<(typeof themes)[number]>(() => {
    try {
      const value = localStorage.getItem("arklens.theme");
      return value === "dark" || value === "light" ? value : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <button
      className="btn"
      onClick={() => {
        const next = themes[(themes.indexOf(theme) + 1) % themes.length];
        setTheme(next);
        try {
          if (next === "system") localStorage.removeItem("arklens.theme");
          else localStorage.setItem("arklens.theme", next);
        } catch {
          /* Theme continues to work in memory. */
        }
      }}
      aria-label={"테마 전환 · 현재 " + theme}
      title="시스템 → 라이트 → 다크"
    >
      {theme === "system" ? "◐" : theme === "light" ? "☀" : "☾"}
    </button>
  );
}

export function useNames(key: "recent" | "favorites") {
  const storageKey = "arklens." + key + ".v1";
  const [names, setNames] = useState<string[]>(() => {
    const saved = read<unknown>("local", storageKey, []);
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string")
      : [];
  });
  return [
    names,
    (next: string[]) => {
      setNames(next);
      write("local", storageKey, next);
    },
  ] as const;
}

export function Card({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <h2>
        {title}
        {extra}
      </h2>
      {children}
    </section>
  );
}
export function Pill({
  children,
  grade,
  className = "",
}: {
  children: ReactNode;
  grade?: string;
  className?: string;
}) {
  return (
    <span
      data-grade={grade}
      className={"pill " + (grade ? "gpill " : "") + className}
    >
      {children}
    </span>
  );
}
export function Empty({ label }: { label: string }) {
  return <p className="muted section-empty">{label}</p>;
}
export function Picture({
  src,
  className,
}: {
  src?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
export function GradeIcon({
  grade,
  label,
  src,
  tier,
  badge,
  small,
  level,
}: {
  grade: string;
  label: string;
  src?: string | null;
  tier?: number | null;
  badge?: number | null;
  small?: boolean;
  level?: number;
}) {
  return (
    <span
      className={"ico" + (small ? " sm" : "")}
      data-grade={grade}
      aria-hidden="true"
    >
      {label}
      <Picture key={src} src={src} className="item-image" />
      {tier != null && <span className="tier">{tier}T</span>}
      {level != null && <span className="lv">{level}</span>}
      {badge != null && <span className="badge">{badge}</span>}
    </span>
  );
}

export function Tooltip({
  lines,
  children,
}: {
  lines?: string[] | null;
  children: ReactNode;
}) {
  if (!lines?.length) return <>{children}</>;
  return (
    <details className="tooltip">
      <summary title={lines.join("\n")}>{children}</summary>
      <div className="tooltip-content">
        {lines.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </div>
    </details>
  );
}

export function Drawer({
  close,
  returnFocus,
  children,
}: {
  close: () => void;
  returnFocus: HTMLButtonElement | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => {
      node?.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={ref}
      className="drawer open"
      aria-labelledby="drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left) close();
      }}
    >
      <div className="row drawer-heading">
        <h2 id="drawer-title">원정대 캐릭터</h2>
        <button className="btn" autoFocus onClick={close}>
          닫기
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Skeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div aria-busy="true" aria-label="캐릭터 정보 불러오는 중">
      {visible && (
        <>
          <div className="card skeleton-hero">
            <div className="skel" />
            <div className="skel" />
          </div>
          <div className="grid">
            <div className="card skeleton-card">
              <div className="skel" />
            </div>
            <div className="card skeleton-card">
              <div className="skel" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
