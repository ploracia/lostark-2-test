import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ALARMS_PATH, API_BASE, PORTAL, type ApiError } from "./api";
import { useSession } from "./session";
import { KEY, maskKey, normalizeKey, validKey, type Scope } from "./storage";
import { Card } from "./ui";

type Notice = { style: "ok" | "warn" | "err"; text: string };
export default function KeySettings() {
  const { key, request, store, remove } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    typeof location.state?.returnTo === "string" &&
    location.state.returnTo.startsWith("/c/")
      ? location.state.returnTo
      : "/";
  const [input, setInput] = useState("");
  const [shown, setShown] = useState(false);
  const [clipboard, setClipboard] = useState(
    Boolean(navigator.clipboard?.readText),
  );
  const [scope, setScope] = useState<Scope>(key?.scope ?? "local");
  const [notice, setNotice] = useState<Notice>();
  const [pending, setPending] = useState(false);
  const [candidate, setCandidate] = useState<string>();
  const active = useRef<AbortController>();
  useEffect(() => () => active.current?.abort(), []);

  function persist(token: string, verified: boolean) {
    const savedAt = new Date().toISOString();
    if (
      !store(scope, {
        token,
        savedAt,
        validatedAt: verified ? savedAt : undefined,
        status: verified ? "ok" : "unverified",
      })
    ) {
      setNotice({
        style: "err",
        text: "브라우저 저장소를 사용할 수 없습니다.",
      });
      return;
    }
    setInput("");
    setCandidate(undefined);
    navigate(returnTo, {
      replace: true,
      state: {
        keyNotice: verified
          ? "검증 성공 · " +
            new Date(savedAt).toLocaleString("ko-KR") +
            " · " +
            maskKey(token)
          : "미검증 키를 저장했습니다 · " + maskKey(token),
      },
    });
  }

  async function verify(save: boolean) {
    if (active.current) return;
    setCandidate(undefined);
    const token = normalizeKey(input);
    if (!validKey(token)) {
      setNotice({
        style: "err",
        text: "API 키는 점으로 구분된 JWT 3부분이어야 합니다.",
      });
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setNotice(undefined);
    try {
      await request(ALARMS_PATH, controller.signal, token);
      if (controller.signal.aborted) return;
      if (save) persist(token, true);
      else setNotice({ style: "ok", text: "검증 성공 · " + maskKey(token) });
    } catch (error) {
      if (controller.signal.aborted) return;
      const { kind } = error as ApiError;
      if (kind === "unauthorized")
        setNotice({
          style: "err",
          text: "키가 거부됨. 발급한 키를 확인해 주세요.",
        });
      else if (
        kind === "rate-limited" ||
        kind === "maintenance" ||
        kind === "network"
      ) {
        setNotice({
          style: "warn",
          text: "지금은 검증할 수 없습니다. 그래도 저장할까요?",
        });
        setCandidate(token);
      } else
        setNotice({
          style: "err",
          text: "검증 요청에 실패했습니다. 다시 시도해 주세요.",
        });
    } finally {
      active.current = undefined;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <div className="key-wrap">
      <section className="card key-hero">
        <h1>로스트아크 API 키 등록</h1>
        <p className="muted">
          캐릭터를 조회하려면 로스트아크 개발자 포털에서 발급한 API 키가
          필요합니다.
        </p>
        <form
          className="key-form"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(true);
          }}
        >
          <div className="field">
            <label htmlFor="api-token">API 키</label>
            <div className="keybox">
              <input
                id="api-token"
                type={shown ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                placeholder="발급받은 API 키를 붙여넣으세요"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setCandidate(undefined);
                  setNotice(undefined);
                }}
              />
              <button
                className="btn"
                type="button"
                onClick={() => setShown(!shown)}
                aria-pressed={shown}
              >
                {shown ? "숨기기" : "보기"}
              </button>
              {clipboard && (
                <button
                  className="btn"
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    try {
                      setInput(await navigator.clipboard.readText());
                      setCandidate(undefined);
                      setNotice(undefined);
                    } catch {
                      setClipboard(false);
                    }
                  }}
                >
                  붙여넣기
                </button>
              )}
            </div>
            {key && (
              <span className="small muted">
                저장된 키 {maskKey(key.value.token)} ·{" "}
                {new Date(key.value.savedAt).toLocaleString("ko-KR")}
              </span>
            )}
          </div>
          <fieldset className="radio-row" disabled={pending}>
            <legend>보관 방식</legend>
            <label className="radio">
              <input
                type="radio"
                name="scope"
                checked={scope === "local"}
                onChange={() => setScope("local")}
              />
              <span>
                <b>이 브라우저에 저장</b>
                <small>브라우저를 닫아도 키를 유지합니다.</small>
              </span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name="scope"
                checked={scope === "session"}
                onChange={() => setScope("session")}
              />
              <span>
                <b>이번 탭에서만</b>
                <small>탭을 닫으면 삭제됩니다. 공용 PC에 권장합니다.</small>
              </span>
            </label>
          </fieldset>
          <div className="actions">
            <button className="btn primary" disabled={pending}>
              {pending ? "검증 중…" : "검증 후 저장"}
            </button>
            <button
              className="btn"
              type="button"
              disabled={pending}
              onClick={() => void verify(false)}
            >
              검증만 하기
            </button>
            <button
              className="btn danger"
              type="button"
              disabled={pending || !key}
              onClick={() => {
                if (!window.confirm("저장된 API 키와 캐시를 삭제할까요?"))
                  return;
                const success = remove();
                setInput("");
                setCandidate(undefined);
                setNotice(
                  success
                    ? {
                        style: "ok",
                        text: "저장된 키와 조회 캐시를 삭제했습니다.",
                      }
                    : {
                        style: "err",
                        text: "일부 브라우저 저장소에 접근할 수 없습니다.",
                      },
                );
              }}
            >
              키 삭제
            </button>
          </div>
          {notice && (
            <div
              className={"notice " + notice.style}
              role={notice.style === "ok" ? "status" : "alert"}
            >
              {notice.text}
            </div>
          )}
          {candidate && (
            <div className="actions">
              <button
                type="button"
                className="btn"
                onClick={() => persist(candidate, false)}
              >
                미검증 키 저장
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setCandidate(undefined)}
              >
                취소
              </button>
            </div>
          )}
        </form>
      </section>
      <Card title="키 발급 방법">
        <ol className="steps">
          <li>
            <a href={PORTAL} target="_blank" rel="noopener noreferrer">
              로스트아크 개발자 포털 ↗
            </a>
            에 로그인합니다.
          </li>
          <li>클라이언트를 생성합니다. 계정당 최대 5개를 만들 수 있습니다.</li>
          <li>
            API KEY를 복사합니다. 키는 무기한 유효하며 클라이언트를 삭제하면
            무효가 됩니다.
          </li>
        </ol>
      </Card>
      <Card title="보안 안내">
        <div className="notice warn">
          <span>
            키는 브라우저 저장소에 <strong>평문</strong>으로 보관됩니다. 같은
            기기의 다른 사용자, 브라우저 확장 프로그램, 이 출처에서 실행되는
            스크립트(XSS)가 키를 읽을 수 있습니다.
          </span>
        </div>
        <ul className="steps">
          <li>공용 PC에서는 세션 저장을 선택하고 사용한 키를 삭제하세요.</li>
          <li>
            키가 유출됐다면 포털에서 클라이언트를 삭제하고 다시 발급하세요.
          </li>
          <li>
            분당 100회 제한이 있으며 캐릭터 조회에 1회, 원정대 목록을 열 때
            1회를 사용합니다.
          </li>
        </ul>
        <dl className="kv">
          <dt>저장 키</dt>
          <dd>
            <code>{KEY}</code>
          </dd>
          <dt>전송 대상</dt>
          <dd>
            <code>{API_BASE}</code>
          </dd>
          <dt>검증 경로</dt>
          <dd>
            <code>GET {ALARMS_PATH}</code>
          </dd>
        </dl>
      </Card>
    </div>
  );
}
