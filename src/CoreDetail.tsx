import { useEffect, useId, useRef } from "react";
import type { Armory } from "./models";
import { parseCoreTooltip, parseGemTooltip } from "./parse/arkgrid";
import { GradeIcon } from "./ui";

type Core = NonNullable<NonNullable<Armory["ArkGrid"]>["Slots"]>[number];

export function CoreDetail({
  slot,
  trigger,
  onDismiss,
}: {
  slot: Core;
  trigger: HTMLButtonElement;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const detail = parseCoreTooltip(slot);
  const gems = slot.Gems ?? [];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const place = () => {
      const anchor = trigger.getBoundingClientRect();
      const { width, height } = dialog.getBoundingClientRect();
      dialog.style.setProperty(
        "--core-detail-left",
        Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16)) +
          "px",
      );
      dialog.style.setProperty(
        "--core-detail-top",
        Math.max(
          16,
          Math.min(anchor.bottom + 8, window.innerHeight - height - 16),
        ) + "px",
      );
    };
    place();
    window.addEventListener("resize", place);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("resize", place);
      dialog.close();
      if (trigger.isConnected) trigger.focus();
    };
  }, [trigger]);

  return (
    <dialog
      ref={ref}
      className="core-detail"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div className="core-detail-content">
        <header className="core-detail-heading">
          <GradeIcon grade={slot.Grade} label={slot.Name[0]} src={slot.Icon} />
          <div>
            <h2 id={titleId}>{slot.Name}</h2>
            <span className="small muted">
              {slot.Grade} · {slot.Point} P
            </span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn"
            onClick={onDismiss}
          >
            닫기
          </button>
        </header>
        <section>
          <h3>포인트 구간별 효과</h3>
          {detail ? (
            <>
              <ul className="core-thresholds">
                {detail.effects.map(({ point, text, active }, index) => (
                  <li key={index} data-active={active}>
                    <strong>
                      {point} P {active ? "활성" : "필요"}
                    </strong>
                    <div>{text}</div>
                  </li>
                ))}
              </ul>
              {detail.activationCondition && (
                <p className="small muted">
                  발동 조건 · {detail.activationCondition}
                </p>
              )}
            </>
          ) : (
            <p className="small muted">
              포인트 효과 정보를 확인할 수 없습니다.
            </p>
          )}
        </section>
        <section>
          <h3>장착한 젬</h3>
          {gems.length ? (
            <ul className="core-gems">
              {gems.map((gem, index) => {
                const parsed = parseGemTooltip(gem.Tooltip);
                const stats = [
                  parsed.willpower != null && `필요 의지력 ${parsed.willpower}`,
                  parsed.corePoint &&
                    `${parsed.corePoint.type} 포인트 ${parsed.corePoint.value}`,
                  parsed.gemPoint != null && `젬 포인트 ${parsed.gemPoint}`,
                ].filter(Boolean);
                return (
                  <li key={gem.Index ?? index}>
                    <GradeIcon
                      small
                      grade={gem.Grade}
                      label="젬"
                      src={gem.Icon}
                    />
                    <div>
                      <strong>
                        {parsed.name ?? `젬 ${(gem.Index ?? index) + 1}`}
                      </strong>
                      <div className="small muted">
                        {gem.Grade} · {gem.IsActive ? "활성" : "비활성"}
                      </div>
                      {stats.length > 0 && (
                        <div className="small">{stats.join(" · ")}</div>
                      )}
                      {parsed.options.length > 0 && (
                        <ul
                          className="core-gem-options small"
                          aria-label="젬 옵션"
                        >
                          {parsed.options.map(
                            ({ name, level }, optionIndex) => (
                              <li key={optionIndex}>
                                {name} Lv.{level}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="small muted">장착한 젬이 없습니다.</p>
          )}
        </section>
      </div>
    </dialog>
  );
}
