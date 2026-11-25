import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Armory } from "./models";
import { read, write } from "./storage";
import { computeTransfer, type TransferResult } from "./transfer";
import { extractTransferInput } from "./transfer/extract";
import { NOTICE_DATE, NOTICE_URL } from "./transfer/rules/meta";
import { ARMOR_PAIRS, SLOT_LAYOUT } from "./transfer/rules/slots";
import type {
  Est,
  Evidence,
  GearIn,
  NewSlotResult,
  TransferOverrides,
} from "./transfer/types";
import { Card, GradeIcon } from "./ui";
import { OverridesPanel, countOverrides } from "./TransferOverrides";
import { weakest } from "./transfer/evidence";

const STORAGE_KEY = "mokokoloa.transfer.v1";
const labels = { official: "공식 확정", estimated: "추정", unknown: "미확인" };
const decimal = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("ko-KR");
const numeric = (n: number) => integer.format(n);

/** 여러 근거 중 가장 약한 것(미확인 < 추정 < 공식 확정)을 고릅니다. */
function weakestEvidence(list: Evidence[]): Evidence {
  const level = weakest(...list.map((evidence) => evidence.level));
  return list.find((evidence) => evidence.level === level) ?? list[0];
}

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
}: {
  estimate: Est<number>;
  suffix?: string;
}) {
  return (
    <>
      <EstValue
        estimate={estimate}
        format={(value) => numeric(value) + suffix}
      />{" "}
      <EvidenceBadge evidence={estimate.evidence} />
    </>
  );
}
const notice = (
  <a href={NOTICE_URL} target="_blank" rel="noopener noreferrer">
    공지 보기 ↗
  </a>
);
const partNames = [...ARMOR_PAIRS.map(([part]) => part), "무기"] as const;

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
  compact = false,
}: {
  slot: NewSlotResult;
  compact?: boolean;
}) {
  return (
    <div className={"transfer-slot" + (slot.isNew ? " is-new" : "")}>
      <GradeIcon grade={slot.grade ?? ""} label={slot.slot[0]} />
      <span>
        <b>{slot.slot}</b>{" "}
        {slot.isNew && <small className="pill new-pill">신규</small>}
        <span className="slot-stats">
          <EstValue estimate={slot.itemLevel} format={numeric} />
          {" · "}
          {slot.ella ? (
            <EstValue
              estimate={slot.ella}
              format={(value) => "엘라 " + value}
            />
          ) : (
            slot.grade && "T" + slot.tier + " " + slot.grade
          )}
          {slot.polish.kind !== "none" && (
            <>
              {" "}
              ·{" "}
              <EstValue
                estimate={slot.polish}
                format={(level) => level + "연마"}
              />
            </>
          )}
          {slot.itemLevel.evidence.level === "estimated" && (
            <>
              {" "}
              <EvidenceBadge evidence={slot.itemLevel.evidence} />
            </>
          )}
        </span>
        {slot.slotHoning && (
          <small className="muted">
            <EstValue
              estimate={slot.slotHoning}
              format={(value) => "재련 +" + value}
            />{" "}
            {slot.slotHoning.evidence.level !== "official" && (
              <EvidenceBadge evidence={slot.slotHoning.evidence} />
            )}
          </small>
        )}
        {!compact && slot.slotHoning && (
          <small className="muted">
            장인의 기운{" "}
            {slot.artisanEnergy ? (
              <EstValue
                estimate={slot.artisanEnergy}
                format={(value) => value + "% 유지"}
              />
            ) : (
              "유지"
            )}
          </small>
        )}
      </span>
    </div>
  );
}

function GearConversion({
  gear,
  slots,
}: {
  gear: GearIn[];
  slots: NewSlotResult[];
}) {
  return (
    <Card
      title="장비 변환"
      extra={<span className="sub muted">6부위 → 16부위</span>}
    >
      {partNames.map((part) => {
        const before = gear.find((item) => item.part === part);
        const next = slots.filter((slot) => slot.from === part);
        const description =
          part +
          " " +
          (before?.itemLevel ?? "레벨 확인 필요") +
          "에서 " +
          next
            .map(
              (slot) =>
                slot.slot +
                " " +
                (slot.itemLevel.kind === "value"
                  ? slot.itemLevel.value
                  : slot.itemLevel.kind === "range"
                    ? slot.itemLevel.min + "~" + slot.itemLevel.max
                    : slot.itemLevel.label),
            )
            .join(", ") +
          "로 이관";
        return (
          <div
            key={part}
            className="conv-row"
            role="group"
            aria-label={description}
          >
            <div>
              <div className="transfer-source">
                <GradeIcon
                  grade={before?.grade ?? ""}
                  label={part[0]}
                  src={before?.icon}
                />
                <span>
                  <b>{part}</b>
                  <small className="muted">
                    {before?.name ?? "장착 장비 없음"}
                  </small>
                  <span className="num">
                    {before?.itemLevel == null
                      ? "레벨 확인 필요"
                      : numeric(before.itemLevel)}
                  </span>
                  {before?.quality != null && (
                    <>
                      {" "}
                      <span className="pill">품질 {before.quality}</span>
                    </>
                  )}
                </span>
              </div>
              {!!before?.advanced && (
                <p className="small muted">
                  상급 재련 {before.advanced}단계 제거 · 현재 아이템 레벨에 이미
                  반영되어 이관 기준에 포함됩니다.
                </p>
              )}
            </div>
            <span className="conv-arrow muted" aria-hidden="true">
              →
            </span>
            <div className="conv-destinations">
              {[true, false].map((left) => (
                <div key={String(left)}>
                  {next
                    .filter((slot) => Boolean(slot.slotHoning) === left)
                    .map((slot) => (
                      <SlotChip slot={slot} key={slot.slot} />
                    ))}
                </div>
              ))}
            </div>
            {next.length > 0 && (
              <EvidenceBadge
                evidence={weakestEvidence(
                  next.flatMap((slot) => [
                    slot.itemLevel.evidence,
                    slot.polish.evidence,
                  ]),
                )}
              />
            )}
          </div>
        );
      })}
    </Card>
  );
}

function SlotLayout16({ slots }: { slots: NewSlotResult[] }) {
  const bySlot = new Map(slots.map((slot) => [slot.slot, slot]));
  return (
    <Card title="이관 후 16부위 배치도">
      <div className="slot16">
        {SLOT_LAYOUT.map((side) => (
          <div key={side[0]}>
            {side.map((name) => {
              const slot = bySlot.get(name);
              return slot && <SlotChip key={name} slot={slot} compact />;
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function EstherCard({ esther }: Pick<TransferResult, "esther">) {
  if (!esther)
    return (
      <details className="card transfer-details">
        <summary>
          에스더 무기 <small className="muted">· 장착한 에스더 무기 없음</small>
        </summary>
        <p className="small muted">
          장착한 에스더 무기가 없습니다. 보관 중인 에스더 무기가 있으면 추가
          정보에 입력하세요.
        </p>
      </details>
    );
  const down =
    esther.itemLevel.kind === "value" &&
    esther.before.itemLevel !== null &&
    esther.itemLevel.value < esther.before.itemLevel;
  return (
    <Card title="에스더 무기">
      <p>
        진화{" "}
        {esther.before.evolution >= 0
          ? esther.before.evolution + "단계"
          : "확인 필요"}{" "}
        ·{" "}
        {esther.before.ella === null
          ? "엘라 확인 필요"
          : esther.before.ella === 0
            ? "엘라 미부여"
            : "엘라 " + esther.before.ella + "단계"}
      </p>
      <p>
        <span className="num">
          {esther.before.itemLevel ?? "레벨 확인 필요"}
        </span>{" "}
        <span className={down ? "delta down" : ""} aria-hidden="true">
          →
        </span>{" "}
        <NumberResult estimate={esther.itemLevel} />
      </p>
      {down && <p className="delta down">아이템 레벨 하락, 대신 재료 환급</p>}
      {esther.before.evolution === 7 && esther.before.ella === 3 && (
        <p className="small muted">
          기존 아이템 레벨 1785는 공지 원문 수치입니다.
        </p>
      )}
      <p>
        신규 엘라 <NumberResult estimate={esther.ella} suffix="단계" /> · 연마{" "}
        <NumberResult estimate={esther.polish} suffix="단계" />
      </p>
      <p>
        무기 슬롯 재련 <NumberResult estimate={esther.honing} suffix="단계" /> ·
        연동 5부위 <NumberResult estimate={esther.linkedLevel} />
      </p>
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
        ({ accessory, outcome, reason, scrollGrade, tradeCount, evidence }) => (
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
              {outcome === "scroll" && (
                <p className="small muted">
                  기존 거래 가능 횟수 승계 ·{" "}
                  <NumberResult estimate={tradeCount} suffix="회" />
                </p>
              )}
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
          {upgrade?.extra && <p>추가 아이템 지급 · 종류 미확인</p>}
          {stone.excluded && (
            <p className="small muted">초월의 가루로 교체 · 수량 미확인</p>
          )}
        </>
      ) : (
        <p className="muted">장착 어빌리티 스톤 없음</p>
      )}
    </Card>
  );
}

function GemConversion({ gems }: Pick<TransferResult, "gems">) {
  const kinds = new Map<string, number>();
  gems.forEach(({ before }) => {
    const kind = before.kind ?? "기타";
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  });
  const converted = gems.filter(
    (gem) => gem.after !== "removed" && gem.after.kind === "value",
  );
  const unchanged =
    converted.length > 0 &&
    converted.length === gems.length &&
    gems.every(
      ({ before, after }) =>
        after !== "removed" &&
        after.kind === "value" &&
        before.level === after.value.level,
    );
  return (
    <Card
      title="보석 → 광휘"
      extra={
        gems.length ? (
          <span className="sub muted">
            {[...kinds].map(([kind, count]) => kind + " " + count).join(" · ") +
              " → 광휘 " +
              converted.length +
              (unchanged ? " (레벨 변화 없음)" : "")}
          </span>
        ) : undefined
      }
    >
      <div className="gem-conv">
        {gems.map(({ before, after, choiceBox }) => (
          <div
            key={before.slot}
            className={
              "transfer-gem" +
              (after === "removed" ||
              (after.kind === "value" && after.value.level !== before.level)
                ? " changed"
                : "")
            }
          >
            {after === "removed" ? (
              <>
                <s>
                  {before.kind} Lv.{before.level}
                </s>
                <b>제거</b>
              </>
            ) : (
              <>
                <span>
                  {before.kind ?? "미확인"} Lv.{before.level}
                </span>
                <b>
                  <EstValue
                    estimate={after}
                    format={(value) => "광휘 Lv." + value.level}
                  />
                </b>
                <EvidenceBadge evidence={after.evidence} />
                {choiceBox && (
                  <small>
                    선택 상자 · 거래 불가 {choiceBox.bound}레벨 / 거래 가능{" "}
                    {choiceBox.tradeable}레벨
                  </small>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <p className="small muted">
        장착 보석은 모두 해제되어 통합 보관함으로 지급됩니다. 귀속 여부 유지.
      </p>
    </Card>
  );
}

function Payouts({ payouts }: Pick<TransferResult, "payouts">) {
  return (
    <Card title="환급·지급 아이템">
      {payouts.map((row) => (
        <div className="transfer-payout" key={row.item}>
          <b>{row.item}</b>
          <div>
            <NumberResult estimate={row.amount} />
          </div>
          <small className="muted">{row.basis}</small>
        </div>
      ))}
    </Card>
  );
}

export function TransferTab({
  data,
  name,
  footer,
}: {
  data: Armory;
  name: string;
  footer: ReactNode;
}) {
  const [ov, setOverrides] = useState<TransferOverrides>(() => {
    const saved = read<Record<string, TransferOverrides>>(
      "local",
      STORAGE_KEY,
      {},
    );
    return saved?.[name] ?? {};
  });
  const input = useMemo(() => extractTransferInput(data), [data]);
  const result = useMemo(() => computeTransfer(input, ov), [input, ov]);
  const panel = useRef<HTMLDetailsElement>(null);
  const count = countOverrides(ov);
  function change(next: TransferOverrides) {
    setOverrides(next);
    const saved = {
      ...read<Record<string, TransferOverrides>>("local", STORAGE_KEY, {}),
    };
    if (countOverrides(next))
      Object.defineProperty(saved, name, {
        value: next,
        enumerable: true,
        configurable: true,
      });
    else delete saved[name];
    write("local", STORAGE_KEY, saved);
  }
  function edit(field: keyof TransferOverrides) {
    if (!panel.current) return;
    panel.current.open = true;
    panel.current
      .querySelector<HTMLElement>("[data-field=" + field + "]")
      ?.focus();
  }
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
      <div className="grid transfer-grid">
        <div className="col transfer-results">
          <GearConversion gear={input.gear} slots={result.slots} />
          <SlotLayout16 slots={result.slots} />
          <EstherCard esther={result.esther} />
          <AccessoryScrolls accessories={result.accessories} />
          <BraceletSeal bracelet={result.bracelet} />
          <StoneSlots stone={result.stone} />
          <GemConversion gems={result.gems} />
        </div>
        <div className="col transfer-aside">
          <div>
            <OverridesPanel
              panel={panel}
              input={input}
              value={ov}
              onChange={change}
            />
            {count > 0 && (
              <div className="actions transfer-reset">
                <button className="btn" onClick={() => change({})}>
                  모두 지우기
                </button>
              </div>
            )}
          </div>
          <Card
            title="적용 중인 가정"
            extra={
              <span className="sub muted">{result.assumptions.length}개</span>
            }
          >
            <ul className="transfer-assumptions">
              {result.assumptions.map(({ id, text, field }) => (
                <li key={id}>
                  {text}{" "}
                  {field && (
                    <button className="btn" onClick={() => edit(field)}>
                      바꾸기
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Payouts payouts={result.payouts} />
          <details className="card transfer-details">
            <summary>이 화면이 계산하지 않는 것</summary>
            <p className="small muted">
              카드 · 특수 장비 · 생활 · 항해 · 카르마 레벨 외 아크 패시브 · 스킬
              룬 · 콘텐츠 보상. {notice}
            </p>
          </details>
        </div>
      </div>
      {footer}
    </div>
  );
}
