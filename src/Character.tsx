import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { armoryPath, PORTAL, type ApiError } from "./api";
import type { Sibling } from "./models";
import {
  AccessoryCard,
  CardSet,
  EngravingCard,
  EquipmentCard,
  GemStrip,
  GridCard,
  PassiveCard,
  ProfileHero,
} from "./sections";
import { TTL, useArmory, useSession, useSiblings } from "./session";
import { Drawer, Skeleton, useClock } from "./ui";

export const characterUrl = (name: string) =>
  "/c/" + encodeURIComponent(name.trim());
const NOTICE_URL = "https://lostark.game.onstove.com/News/Notice/List";
export const errorContent = {
  "no-key": [
    "🔑",
    "API 키가 필요합니다",
    "이 캐릭터를 조회하려면 개발자 포털에서 발급받은 키를 등록하세요.",
  ],
  unauthorized: [
    "⛔",
    "API 키가 거부되었습니다",
    "개발자 포털에서 키가 유효한지 확인해 주세요.",
  ],
  "not-found": [
    "🔍",
    "캐릭터를 찾을 수 없습니다",
    "닉네임을 다시 확인해 주세요. 신규 생성이나 변경 사항이 반영되기까지 시간이 걸릴 수 있습니다.",
  ],
  "rate-limited": [
    "⏳",
    "호출 한도에 도달했습니다",
    "호출 한도가 회복되면 다시 조회할 수 있습니다.",
  ],
  maintenance: [
    "🛠",
    "서버 점검 중",
    "로스트아크 API 서버가 일시적으로 응답할 수 없습니다.",
  ],
  network: [
    "📡",
    "서버에 연결할 수 없습니다",
    "네트워크 연결 또는 브라우저의 CORS 제한을 확인해 주세요.",
  ],
  server: ["⚠️", "요청에 실패했습니다", "잠시 후 다시 시도해 주세요."],
} satisfies Record<ApiError["kind"], string[]>;

export function ErrorState({
  error,
  name,
  recent,
  retry,
  cancel,
  cancelled,
  now,
  cooldown,
  banner = false,
}: {
  error: ApiError;
  name: string;
  recent: string[];
  retry: () => void;
  cancel: () => void;
  cancelled: boolean;
  now: number;
  cooldown: number;
  banner?: boolean;
}) {
  const [icon, heading, description] = errorContent[error.kind];
  const seconds =
    error.kind === "rate-limited"
      ? Math.max(0, Math.ceil((error.resetAt - now) / 1000))
      : 0;
  const maintenanceSeconds = Math.max(0, Math.ceil((cooldown - now) / 1000));
  const keyButton = (
    <Link
      className="btn primary"
      to="/settings/key"
      state={{ returnTo: characterUrl(name) }}
    >
      {error.kind === "no-key" ? "키 등록하기" : "키 다시 입력"}
    </Link>
  );
  return (
    <section
      className={banner ? "card state cached-error" : "card state error-page"}
      role="alert"
    >
      <span className="big" aria-hidden="true">
        {icon}
      </span>
      <h2>
        {error.kind === "not-found" ? "‘" + name + "’ " + heading : heading}
      </h2>
      <p>
        {description}
        {error.kind === "server" && " (HTTP " + error.status + ")"}
        {banner && " 저장된 조회 결과를 표시합니다."}
      </p>
      {error.detail && (
        <details>
          <summary>오류 상세</summary>
          <p>{error.detail}</p>
        </details>
      )}
      {error.kind === "rate-limited" && (
        <>
          <p>
            {cancelled
              ? "자동 재시도를 취소했습니다."
              : seconds > 0
                ? seconds + "초 남음"
                : "다시 조회할 수 있습니다."}
          </p>
          <progress
            className="meter"
            aria-label="호출 한도 대기 시간"
            max={60}
            value={Math.max(0, 60 - seconds)}
          />
        </>
      )}
      <div className="actions">
        {(error.kind === "no-key" || error.kind === "unauthorized") &&
          keyButton}
        {error.kind === "no-key" && (
          <a
            className="btn"
            href={PORTAL}
            target="_blank"
            rel="noopener noreferrer"
          >
            키 발급받기 ↗
          </a>
        )}
        {error.kind === "not-found" &&
          recent
            .filter((entry) => entry !== name)
            .map((entry) => (
              <Link className="chip" key={entry} to={characterUrl(entry)}>
                {entry}
              </Link>
            ))}
        {error.kind === "rate-limited" && (
          <>
            <button className="btn" disabled={seconds > 0} onClick={retry}>
              지금 재시도
            </button>
            <button className="btn" disabled={cancelled} onClick={cancel}>
              취소
            </button>
          </>
        )}
        {error.kind === "maintenance" && (
          <>
            <button
              className="btn"
              disabled={maintenanceSeconds > 0}
              onClick={retry}
            >
              상태 확인
              {maintenanceSeconds > 0 ? " (" + maintenanceSeconds + "초)" : ""}
            </button>
            <a
              className="btn"
              href={NOTICE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              공식 공지 ↗
            </a>
          </>
        )}
        {["unauthorized", "network", "server"].includes(error.kind) && (
          <button className="btn" onClick={retry}>
            다시 시도
          </button>
        )}
      </div>
    </section>
  );
}

function SiblingsDrawer({
  name,
  close,
  select,
  returnFocus,
}: {
  name: string;
  close: () => void;
  select: (name: string) => void;
  returnFocus: HTMLButtonElement | null;
}) {
  const query = useSiblings(name, true);
  const groups = new Map<string, Sibling[]>();
  const level = (sibling: Sibling) =>
    Number(sibling.ItemAvgLevel.replaceAll(",", "")) || 0;
  for (const sibling of query.data ?? []) {
    const group = groups.get(sibling.ServerName) ?? [];
    group.push(sibling);
    groups.set(sibling.ServerName, group);
  }
  return (
    <Drawer close={close} returnFocus={returnFocus}>
      {query.isPending && query.fetchStatus === "fetching" && (
        <p role="status">원정대 캐릭터를 불러오는 중…</p>
      )}
      {query.error && <p role="alert">{errorContent[query.error.kind][1]}</p>}
      {query.data?.length === 0 && (
        <p className="muted">표시할 원정대 캐릭터가 없습니다.</p>
      )}
      {[...groups].map(([server, members]) => (
        <section key={server}>
          <h3 className="sib-server">{server}</h3>
          {members
            .sort((a, b) => level(b) - level(a))
            .map((sibling) => (
              <button
                key={sibling.CharacterName}
                className={
                  "sib" + (sibling.CharacterName === name ? " cur" : "")
                }
                aria-current={
                  sibling.CharacterName === name ? "true" : undefined
                }
                onClick={() => {
                  close();
                  select(sibling.CharacterName);
                }}
              >
                <span>
                  <b>{sibling.CharacterName}</b>
                  <small className="muted">
                    {sibling.CharacterClassName} · Lv.{sibling.CharacterLevel}
                  </small>
                </span>
                <span className="ilv num">{sibling.ItemAvgLevel}</span>
              </button>
            ))}
        </section>
      ))}
    </Drawer>
  );
}

export default function Character({
  name,
  recent,
  favorite,
  toggleFavorite,
  onSearch,
}: {
  name: string;
  recent: string[];
  favorite: boolean;
  toggleFavorite: () => void;
  onSearch: (name: string) => void;
}) {
  const { key } = useSession();
  const now = useClock();
  const [drawer, setDrawer] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [refreshAt, setRefreshAt] = useState(0);
  const [maintenanceAt, setMaintenanceAt] = useState(0);
  const automatic = useRef(false);
  const drawerTrigger = useRef<HTMLButtonElement>(null);
  const nav = useNavigate();
  const client = useQueryClient();
  const query = useArmory(name);
  const error: ApiError | null = !key
    ? { kind: "no-key" }
    : key.value.status === "rejected"
      ? query.error?.kind === "unauthorized"
        ? query.error
        : { kind: "unauthorized" }
      : query.error;
  const reset = error?.kind === "rate-limited" ? error.resetAt : null;
  const { refetch, isFetching } = query;

  useEffect(() => {
    if (reset === null || cancelled || automatic.current || isFetching) return;
    const timer = window.setTimeout(
      () => {
        automatic.current = true;
        void refetch({ cancelRefetch: true });
      },
      Math.max(0, reset - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [reset, cancelled, isFetching, refetch]);

  function retry() {
    if (isFetching) return;
    if (error?.kind === "maintenance") {
      if (maintenanceAt > now) return;
      setMaintenanceAt(Date.now() + 300_000);
    }
    if (error?.kind === "rate-limited" && error.resetAt > now) return;
    automatic.current = false;
    setCancelled(false);
    void refetch({ cancelRefetch: true });
  }

  const canShow = Boolean(
    query.data &&
    key &&
    (!error ||
      ["maintenance", "rate-limited", "network", "server"].includes(
        error.kind,
      )),
  );
  const data = canShow ? query.data : undefined;
  const remaining = Math.max(
    0,
    Math.ceil((query.dataUpdatedAt + TTL - now) / 1000),
  );
  const refreshRemaining = Math.max(0, Math.ceil((refreshAt - now) / 1000));
  function refresh() {
    if (isFetching || refreshAt > Date.now()) return;
    setRefreshAt(Date.now() + 10_000);
    automatic.current = false;
    setCancelled(false);
    void refetch({ cancelRefetch: true });
  }

  return (
    <>
      {error && (
        <ErrorState
          error={error}
          name={name}
          recent={recent}
          retry={retry}
          now={now}
          cooldown={maintenanceAt}
          banner={Boolean(data)}
          cancelled={cancelled}
          cancel={() => {
            setCancelled(true);
            void client.cancelQueries({ queryKey: [armoryPath(name)] });
          }}
        />
      )}
      {!error && !data && <Skeleton />}
      {data && (
        <>
          <ProfileHero
            profile={data.ArmoryProfile}
            actions={
              <>
                <button
                  className="btn"
                  aria-pressed={favorite}
                  onClick={toggleFavorite}
                >
                  {favorite ? "★ 즐겨찾기" : "☆ 즐겨찾기"}
                </button>
                <button
                  className="btn"
                  aria-haspopup="dialog"
                  ref={drawerTrigger}
                  onClick={() => setDrawer(true)}
                >
                  원정대 캐릭터
                </button>
              </>
            }
          />
          <div className="grid">
            <div className="col">
              <PassiveCard data={data.ArkPassive} />
              <GridCard data={data.ArkGrid} />
              <EngravingCard data={data.ArmoryEngraving} />
              <CardSet data={data.ArmoryCard} />
            </div>
            <div className="col">
              <GemStrip data={data.ArmoryGem} />
              <div className="two">
                <EquipmentCard
                  equipment={data.ArmoryEquipment}
                  avatars={data.ArmoryAvatars}
                />
                <AccessoryCard equipment={data.ArmoryEquipment} />
              </div>
              <footer className="card source-footer small muted">
                <div>
                  <a href={PORTAL} target="_blank" rel="noopener noreferrer">
                    Lost Ark Open API
                  </a>{" "}
                  · 조회{" "}
                  {new Date(query.dataUpdatedAt).toLocaleTimeString("ko-KR")} ·
                  캐시 {remaining}초
                </div>
                <button
                  className="btn"
                  disabled={
                    refreshRemaining > 0 ||
                    isFetching ||
                    error?.kind === "maintenance" ||
                    (reset !== null && reset > now)
                  }
                  onClick={refresh}
                >
                  {isFetching
                    ? "갱신 중…"
                    : refreshRemaining > 0
                      ? "새로고침 (" + refreshRemaining + "초)"
                      : "새로고침"}
                </button>
              </footer>
            </div>
          </div>
        </>
      )}
      {drawer && (
        <SiblingsDrawer
          name={name}
          returnFocus={drawerTrigger.current}
          close={() => setDrawer(false)}
          select={(next) => {
            onSearch(next);
            nav(characterUrl(next));
          }}
        />
      )}
    </>
  );
}
