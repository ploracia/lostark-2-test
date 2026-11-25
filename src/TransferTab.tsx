import { useEffect, useMemo, type ReactNode } from "react";
import type { Armory } from "./models";
import { writeRaw } from "./storage";
import { computeTransfer, type TransferResult } from "./transfer";
import { extractTransferInput } from "./transfer/extract";
import { NOTICE_DATE, NOTICE_URL } from "./transfer/rules/meta";
import { SLOT_LAYOUT } from "./transfer/rules/slots";
import type { Est, Evidence, GearIn, NewSlotResult } from "./transfer/types";
import { Card, GradeIcon } from "./ui";

const labels = { official: "공식 확정", estimated: "추정", unknown: "미확인" };
const decimal = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("ko-KR");
const numeric = (n: number) => integer.format(n);

export function EvidenceBadge({ evidence }: { evidence: Evidence }) {
  return (
    <span
      className={"pill ev ev-" + evidence.level}
      title={[evidence.source, evidence.note].filter(Boolean).join(" · ")}
    >
      {labels[evidence.level]}
    </span>
  );
}

export function EstValue<T>({
  estimate,
  format,
}: {
  estimate: Est<T>;
  format: (value: T) => ReactNode;
}) {
  if (estimate.kind === "none")
    return <span className="muted">{estimate.label}</span>;
  if (estimate.kind === "range")
    return (
      <span
        aria-label={
          "최소 " + String(estimate.min) + ", 최대 " + String(estimate.max)
        }
      >
        {format(estimate.min)} ~ {format(estimate.max)}
      </span>
    );
  return <>{format(estimate.value)}</>;
}

function NumberResult({
  estimate,
  suffix = "",
  showEvidence = true,
}: {
  estimate: Est<number>;
  suffix?: string;
  showEvidence?: boolean;
}) {
  return (
    <>
      <EstValue
        estimate={estimate}
        format={(value) => numeric(value) + suffix}
      />
      {showEvidence && (
        <>
          {" "}
          <EvidenceBadge evidence={estimate.evidence} />
        </>
      )}
    </>
  );
}
const notice = (
  <a href={NOTICE_URL} target="_blank" rel="noopener noreferrer">
    공지 보기 ↗
  </a>
);

function TransferSummary({ result }: { result: TransferResult }) {
  const avg = result.after.avg16;
  const { profileAvg, equippedAvg } = result.current;
  const delta =
    profileAvg !== null && avg.kind === "value" ? avg.value - profileAvg : null;
  return (
    <Card title="평균 아이템 레벨">
      <div className="transfer-average">
        <div>
          <span className="muted">현재 평균 · 6부위</span>
          <strong className="num">
            {profileAvg === null ? "확인 필요" : decimal.format(profileAvg)}
          </strong>
        </div>
        <span className="big-arrow muted" aria-hidden="true">
          →
        </span>
        <div>
          <span className="muted">이관 후 예상 · 16부위</span>
          <strong className="num">
            <EstValue
              estimate={avg}
              format={(value) => decimal.format(value)}
            />
          </strong>
          <EvidenceBadge evidence={avg.evidence} />
          {delta !== null && (
            <b className={"delta num " + (delta >= 0 ? "up" : "down")}>
              {delta >= 0 ? "+" : ""}
              {decimal.format(delta)}
            </b>
          )}
        </div>
      </div>
      <p className="small muted">
        장착 6부위 계산{" "}
        {equippedAvg === null ? "확인 필요" : decimal.format(equippedAvg)}
      </p>
      {profileAvg !== null &&
        equippedAvg !== null &&
        Math.abs(profileAvg - equippedAvg) >= 0.5 && (
          <p className="small muted">
            프로필 값과 장착 장비 평균이 다릅니다. 프로필 갱신 지연이나 프리셋
            차이일 수 있습니다.
          </p>
        )}
      {avg.evidence.note && <p className="small muted">{avg.evidence.note}</p>}
      <div className="actions" aria-label="근거 집계">
        <span className="pill ev-official">확정 {result.counts.official}</span>
        <span className="pill ev-estimated">
          추정 {result.counts.estimated}
        </span>
        <span className="pill ev-unknown">
          계산 불가 {result.counts.unknown}
        </span>
      </div>
    </Card>
  );
}

function SlotChip({
  slot,
  before,
  linkedLevel,
}: {
  slot: NewSlotResult;
  before?: GearIn;
  linkedLevel?: Est<number>;
}) {
  const hasDistinctEvidence = (field: Est<number>) =>
    field.evidence.level !== slot.itemLevel.evidence.level;
  return (
    <div
      role="group"
      aria-label={slot.slot}
      className={"transfer-slot" + (slot.isNew ? " is-new" : "")}
    >
      <GradeIcon grade={slot.grade ?? ""} label={slot.slot[0]} />
      <div className="transfer-slot-info">
        <div className="transfer-slot-title">
          <b>{slot.slot}</b>
          {slot.isNew && <span className="pill new-pill">신규</span>}
          {slot.grade && (
            <span className="muted">
              T{slot.tier} {slot.grade}
            </span>
          )}
        </div>
        <div className="transfer-slot-level num">
          <NumberResult estimate={slot.itemLevel} />
        </div>
        <div className="transfer-slot-stats">
          {slot.ella && (
            <span>
              엘라{" "}
              <NumberResult
                estimate={slot.ella}
                suffix="단계"
                showEvidence={hasDistinctEvidence(slot.ella)}
              />
            </span>
          )}
          {slot.polish.kind !== "none" && (
            <span>
              연마{" "}
              <NumberResult
                estimate={slot.polish}
                suffix="단계"
                showEvidence={hasDistinctEvidence(slot.polish)}
              />
            </span>
          )}
          {slot.slotHoning && (
            <span>
              <EstValue
                estimate={slot.slotHoning}
                format={(value) => "재련 +" + value}
              />
              {hasDistinctEvidence(slot.slotHoning) && (
                <>
                  {" "}
                  <EvidenceBadge evidence={slot.slotHoning.evidence} />
                </>
              )}
            </span>
          )}
        </div>
        {linkedLevel && (
          <div className="small">
            연동 5부위 <NumberResult estimate={linkedLevel} />
          </div>
        )}
        <small className="transfer-origin muted">
          <span aria-hidden="true">← </span>
          {before?.name.replace(/^\+\d+\s+/, "") ??
            slot.from + " 장착 정보 없음"}
          {before?.itemLevel != null && " · " + numeric(before.itemLevel)}
          {before?.honing != null &&
            (before.grade === "에스더"
              ? " · 진화 " + before.honing + "단계"
              : " · 재련 +" + before.honing)}
        </small>
      </div>
    </div>
  );
}

function SlotLayout16({
  gear,
  slots,
  esther,
}: Pick<TransferResult, "slots" | "esther"> & { gear: GearIn[] }) {
  const bySlot = new Map(slots.map((slot) => [slot.slot, slot]));
  return (
    <Card title="이관 후 16부위 배치도">
      <div className="slot16">
        {SLOT_LAYOUT.map((side) => (
          <div key={side[0]}>
            {side.map((name) => {
              const slot = bySlot.get(name);
              return (
                slot && (
                  <SlotChip
                    key={name}
                    slot={slot}
                    before={gear.find((item) => item.part === slot.from)}
                    linkedLevel={
                      name === "무기" && slot.ella
                        ? esther?.linkedLevel
                        : undefined
                    }
                  />
                )
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function AccessoryScrolls({
  accessories,
}: Pick<TransferResult, "accessories">) {
  return (
    <Card title="장신구 → 마력 주입 주문서">
      {!accessories.length && <p className="muted">장착 장신구 없음</p>}
      {accessories.map(
        ({ accessory, outcome, reason, scrollGrade, evidence }) => (
          <div className="scroll-row" key={accessory.part + accessory.index}>
            <div>
              <b>
                {accessory.part}
                {accessory.part !== "목걸이" && accessory.index}
              </b>{" "}
              <span className="muted">{accessory.grade}</span>
              {accessory.quality !== null && (
                <>
                  {" "}
                  <span className="pill">품질 {accessory.quality}</span>
                </>
              )}
              {accessory.options?.map((option, index) => (
                <small className="transfer-option" key={index}>
                  {option.rank && <span className="pill">{option.rank}</span>}{" "}
                  {option.text}
                </small>
              ))}
            </div>
            <div>
              <b>
                {outcome === "scroll"
                  ? accessory.part + " 마력 주입 주문서 "
                  : outcome === "shard"
                    ? "영롱한 보석 파편"
                    : outcome === "remove"
                      ? "제거"
                      : ""}
                {scrollGrade && (
                  <EstValue
                    estimate={scrollGrade}
                    format={(value) => value + "등급"}
                  />
                )}
              </b>{" "}
              <EvidenceBadge evidence={evidence} />
              <p className="small muted">{reason}</p>
            </div>
          </div>
        ),
      )}
    </Card>
  );
}
const braceletStatus = {
  eligible: "대상 · 티어 4 효과 부여",
  remove: "제거 · 티어 3",
  dismantle: "효과 미부여 · 분해 결과물로 교체",
  exclude: "대상 제외 · 서포터 옵션만 부여됨",
  unknown: "대상 여부 확인 필요",
};
function BraceletSeal({ bracelet }: Pick<TransferResult, "bracelet">) {
  return (
    <Card title="팔찌 → 인장 마력 주입 주문서">
      {bracelet ? (
        <>
          <p>
            <b>{braceletStatus[bracelet.status]}</b>{" "}
            <EvidenceBadge evidence={bracelet.eligible.evidence} />
          </p>
          {["eligible", "unknown"].includes(bracelet.status) && (
            <p>
              <NumberResult estimate={bracelet.scrollGrade} />
            </p>
          )}
          {bracelet.tiers.map((tier, index) => (
            <div className="transfer-option" key={index}>
              {tier.text}{" "}
              <span className="pill">딜러 {tier.dealer ?? "표 미포함"}</span>{" "}
              {bracelet.support && (
                <span className="pill">
                  서포터 {tier.support ?? "표 미포함"}
                </span>
              )}
            </div>
          ))}
          <p className="small muted">
            동일 티어 내에서도 성능 차이가 있을 수 있습니다. 미장착 팔찌가 더
            좋으면 그 팔찌가 기준이 됩니다.
          </p>
        </>
      ) : (
        <p className="muted">장착 팔찌 없음</p>
      )}
    </Card>
  );
}

function StoneSlots({ stone }: Pick<TransferResult, "stone">) {
  const upgrade = stone?.upgrade.kind === "value" ? stone.upgrade.value : null;
  return (
    <Card title="어빌리티 스톤 → 각인 슬롯">
      {stone ? (
        <>
          <div className="engr-slots" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={i < (upgrade?.slots ?? 0) ? "filled" : ""}
              >
                {i < (upgrade?.slots ?? 0) ? upgrade?.level : "·"}
              </span>
            ))}
          </div>
          <p>
            <b>
              <EstValue
                estimate={stone.upgrade}
                format={(value) =>
                  value.slots
                    ? value.slots + "개 " + value.level + "단계"
                    : "각인 슬롯 반영 없음"
                }
              />
            </b>{" "}
            <EvidenceBadge evidence={stone.upgrade.evidence} />
          </p>
          {stone.points && (
            <p className="small muted">
              {stone.names[0]} {stone.points[0]} + {stone.names[1]}{" "}
              {stone.points[1]} = 합계 {stone.sum}
              {stone.validPair &&
                (stone.validPair === "dealer"
                  ? " · 딜러 유효 각인 2개"
                  : " · 서포터 유효 각인 2개")}
            </p>
          )}
        </>
      ) : (
        <p className="muted">장착 어빌리티 스톤 없음</p>
      )}
    </Card>
  );
}

export function TransferTab({
  data,
  footer,
}: {
  data: Armory;
  footer: ReactNode;
}) {
  useEffect(() => {
    // Delete retired overrides, including the legacy key handled by writeRaw.
    writeRaw("local", "mokokoloa.transfer.v1", undefined);
  }, []);
  const input = useMemo(() => extractTransferInput(data), [data]);
  const result = useMemo(() => computeTransfer(input), [input]);
  return (
    <div className="transfer-tab">
      <p className="notice warn">
        <span>
          공식 공지({NOTICE_DATE}) 기반 <strong>예상치</strong>입니다. 실제 이관
          결과와 다를 수 있습니다. 기본값은 장착 중인 장비를 기준으로
          계산합니다. {notice}
        </span>
      </p>
      <TransferSummary result={result} />
      <SlotLayout16
        gear={input.gear}
        slots={result.slots}
        esther={result.esther}
      />
      <AccessoryScrolls accessories={result.accessories} />
      <BraceletSeal bracelet={result.bracelet} />
      <StoneSlots stone={result.stone} />
      {footer}
    </div>
  );
}
