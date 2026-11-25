import { Link } from "react-router-dom";
import { characterUrl } from "./Character";
import { useSession } from "./session";

export function RecentSearches({
  id,
  close,
  returnFocus,
}: {
  id?: string;
  close?: () => void;
  returnFocus?: () => void;
}) {
  const { recent, deleteRecent } = useSession();

  function remove(name?: string) {
    returnFocus?.();
    deleteRecent(name);
  }

  return (
    <section id={id} className={id ? "recent recent-popup" : "recent"}>
      <div className="recent-heading">
        <h2>최근 검색</h2>
        {recent.length > 0 && (
          <button
            className="recent-clear"
            type="button"
            onClick={() => remove()}
          >
            전체 지우기
          </button>
        )}
      </div>
      {recent.length ? (
        <ul className="recent-list">
          {recent.map(({ name, server, job, level }) => {
            const detail = [server, job, level && "Lv. " + level]
              .filter(Boolean)
              .join(" · ");
            return (
              <li className="recent-item" key={name}>
                <Link to={characterUrl(name)} onClick={close} data-recent-link>
                  <b>{name}</b>
                  {detail && <small className="muted">{detail}</small>}
                </Link>
                <button
                  className="recent-remove"
                  type="button"
                  aria-label={name + " 검색 기록 삭제"}
                  onClick={() => remove(name)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">아직 기록이 없습니다.</p>
      )}
    </section>
  );
}
