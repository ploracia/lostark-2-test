import { useId, useState, type ReactNode } from "react";
import { engravingIcon } from "./data/engraving-icons";
import type { Armory, Equipment, Profile } from "./models";
import {
  accessoryTypes,
  armorOrder,
  gemKind,
  parseTooltip,
  plainText,
  qualityClass,
  tooltipLines,
} from "./parse/tooltip";
import { Card, Empty, GradeIcon, Pill, Picture, Tooltip } from "./ui";

export function ProfileHero({
  profile: p,
  actions,
}: {
  profile?: Profile | null;
  actions: ReactNode;
}) {
  if (!p)
    return (
      <div className="card profile-empty">
        <Empty label="프로필 정보가 없습니다." />
        {actions}
      </div>
    );
  const statTypes = ["치명", "특화", "신속", "제압", "인내", "숙련"];
  return (
    <section className="card profile">
      <div className="portrait" aria-hidden="true">
        <span>{p.CharacterClassName?.[0]}</span>
        <small>{p.CharacterClassName}</small>
        <Picture
          key={p.CharacterImage}
          src={p.CharacterImage}
          className="item-image"
        />
      </div>
      <div className="pmeta">
        <div className="line1">
          <Pill className="accent-pill">{p.ServerName}</Pill>
          <span>{p.CharacterClassName}</span>
          <span>Lv.{p.CharacterLevel}</span>
          {p.ExpeditionLevel != null && (
            <span>원정대 Lv.{p.ExpeditionLevel}</span>
          )}
        </div>
        <h1>
          {p.CharacterName}
          {p.Title && <small>{p.Title}</small>}
        </h1>
        <div className="bignums num">
          <div>
            <span>아이템 레벨</span>
            <b>{p.ItemAvgLevel}</b>
          </div>
          {p.CombatPower && (
            <div>
              <span>전투력</span>
              <b>{p.CombatPower}</b>
            </div>
          )}
          {p.HonorPoint != null && (
            <div>
              <span>명예</span>
              <b>{p.HonorPoint.toLocaleString("ko-KR")}</b>
            </div>
          )}
        </div>
        <div className="stats">
          {statTypes.map((type) => {
            const stat = p.Stats?.find((stat) => stat.Type === type);
            if (!stat) return null;
            return (
              <span
                className="stat num"
                key={type}
                title={stat.Tooltip?.map(plainText).join("\n")}
              >
                {type}
                <b>{stat.Value}</b>
              </span>
            );
          })}
        </div>
        <p className="small muted profile-info">
          {[
            p.GuildName && "길드 " + p.GuildName,
            p.TownName &&
              "영지 " +
                p.TownName +
                (p.TownLevel != null ? " Lv." + p.TownLevel : ""),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="pside">{actions}</div>
    </section>
  );
}

export function PassiveCard({ data }: { data: Armory["ArkPassive"] }) {
  const groups = ["진화", "깨달음", "도약"];
  return (
    <Card
      title="아크 패시브"
      extra={data?.Title && <span className="sub">{data.Title}</span>}
    >
      {!data?.IsArkPassive || !(data.Points?.length || data.Effects?.length) ? (
        <Empty label="활성화된 아크 패시브가 없습니다." />
      ) : (
        <>
          <div className="ap-points">
            {groups.map((name) => {
              const point = data.Points?.find((point) => point.Name === name);
              if (!point) return null;
              return (
                <div
                  key={name}
                  title={point.Tooltip && plainText(point.Tooltip)}
                >
                  <span>{name}</span>
                  <b className="num">{point.Value}</b>
                  <span>
                    {point.Description && plainText(point.Description)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="list">
            {groups.map((name) => {
              const effects = data.Effects?.filter(
                (effect) => effect.Name === name,
              );
              return effects?.length ? (
                <div key={name} className="small">
                  <strong>{name}</strong>
                  <div className="muted">
                    {effects.map((effect, index) => (
                      <Tooltip key={index} lines={tooltipLines(effect.ToolTip)}>
                        <span className="passive-effect">
                          {plainText(effect.Description)}
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </>
      )}
    </Card>
  );
}

export function GridCard({ data }: { data: Armory["ArkGrid"] }) {
  const slots = data?.Slots ?? [];
  const effects = data?.Effects ?? [];
  const sum = (kind: string) =>
    slots
      .filter((slot) => slot.Name.includes(kind))
      .reduce((total, slot) => total + slot.Point, 0);
  return (
    <Card
      title="아크 그리드"
      extra={
        slots.length > 0 && (
          <span className="right small muted">
            질서 {sum("질서")} · 혼돈 {sum("혼돈")}
          </span>
        )
      }
    >
      {!slots.length && !effects.length && (
        <Empty label="장착한 코어가 없습니다." />
      )}
      <div className="cores">
        {slots.map((slot) => {
          const [type, name] = slot.Name.split(" : ");
          const gems = slot.Gems ?? [];
          return (
            <div key={slot.Index} className="core" data-grade={slot.Grade}>
              <GradeIcon
                small
                grade={slot.Grade}
                label={type.slice(0, 1)}
                src={slot.Icon}
              />
              <div className="core-name">
                <Tooltip lines={tooltipLines(slot.Tooltip)}>
                  <strong>{name ?? type}</strong>
                </Tooltip>
                <div className="small muted">
                  {name && type + " · "}
                  {slot.Grade} · {slot.Point}P
                </div>
              </div>
              <div
                className="gemdots"
                aria-label={
                  "활성 젬 " +
                  gems.filter((gem) => gem.IsActive).length +
                  "/" +
                  gems.length
                }
              >
                {gems.map((gem, index) => (
                  <i
                    title={gem.Grade + (gem.IsActive ? " 활성" : " 비활성")}
                    key={index}
                    data-grade={gem.Grade}
                    className={gem.IsActive ? "" : "off"}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {effects.length > 0 && (
        <table className="grid-effects">
          <caption>코어 효과</caption>
          <tbody>
            {effects.map((effect, index) => (
              <tr key={index} className={effect.Level < 5 ? "muted" : ""}>
                <th scope="row">
                  <Tooltip lines={tooltipLines(effect.Tooltip)}>
                    {effect.Name}
                  </Tooltip>
                </th>
                <td className="num">Lv.{effect.Level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function EngravingCard({ data }: { data: Armory["ArmoryEngraving"] }) {
  const passive = data?.ArkPassiveEffects ?? [];
  const engravings = data?.Engravings ?? [];
  const effects = data?.Effects ?? [];
  return (
    <Card title="각인">
      {!passive.length && !engravings.length && !effects.length && (
        <Empty label="활성화된 각인이 없습니다." />
      )}
      <div className="list">
        {passive.map((item, index) => (
          <div className="row engr" key={index} data-grade={item.Grade}>
            <GradeIcon
              small
              grade={item.Grade}
              label={item.Name.trim()[0]}
              src={engravingIcon(item.Name)}
            />
            <div className="engr-details">
              <strong className="gtext">{item.Name}</strong>
              <div className="small muted">
                {item.Grade} · Lv.{item.Level}
              </div>
            </div>
            <div className="lvl" aria-hidden="true">
              {[1, 2, 3, 4].map((level) => (
                <i key={level} className={item.Level >= level ? "on" : ""} />
              ))}
            </div>
            {item.AbilityStoneLevel != null && (
              <Pill className="accent-pill">돌 +{item.AbilityStoneLevel}</Pill>
            )}
          </div>
        ))}
        {!passive.length &&
          engravings.map((item, index) => (
            <div className="row" key={index}>
              <GradeIcon
                small
                grade={item.Grade}
                label={item.Name[0]}
                src={item.Icon}
              />
              <Tooltip lines={tooltipLines(item.Tooltip)}>
                {item.Name} · {item.Grade}
              </Tooltip>
            </div>
          ))}
        {!passive.length &&
          effects.map((item, index) => (
            <div
              key={index}
              title={item.Description && plainText(item.Description)}
            >
              {item.Name}
            </div>
          ))}
      </div>
    </Card>
  );
}

export function CardSet({ data }: { data: Armory["ArmoryCard"] }) {
  const cards = data?.Cards ?? [];
  const effects = data?.Effects ?? [];
  const total = cards.reduce((sum, item) => sum + item.AwakeCount, 0);
  return (
    <Card
      title="카드"
      extra={
        cards.length > 0 && (
          <span className="right small muted">각성 합계 {total}</span>
        )
      }
    >
      {!cards.length && !effects.length && (
        <Empty label="장착한 카드가 없습니다." />
      )}
      {cards.length > 0 && (
        <div className="cardset">
          {cards.map((item) => (
            <div
              key={item.Slot}
              className="tcard"
              data-grade={item.Grade}
              title={
                item.Name +
                " · " +
                item.Grade +
                " · " +
                item.AwakeCount +
                "/" +
                item.AwakeTotal +
                " 각성"
              }
            >
              <div className="tcard-art">
                <Picture
                  key={item.Icon}
                  src={item.Icon}
                  className="item-image"
                />
              </div>
              <div
                className="awake"
                aria-label={item.AwakeCount + "/" + item.AwakeTotal + " 각성"}
              >
                {Array.from(
                  { length: Math.min(20, item.AwakeTotal) },
                  (_, index) => (
                    <i
                      key={index}
                      className={index < item.AwakeCount ? "on" : ""}
                    />
                  ),
                )}
              </div>
              <span className="card-name">{item.Name}</span>
            </div>
          ))}
        </div>
      )}
      {effects.map((effect) => {
        const items = effect.Items ?? [];
        const last = items.at(-1);
        if (!last) return null;
        return (
          <div key={effect.Index} className="small">
            <b>{last.Name}</b>
            {last.Description && (
              <div className="muted">{plainText(last.Description)}</div>
            )}
            {items.length > 1 && (
              <details>
                <summary>이전 단계 효과</summary>
                <ul>
                  {items.slice(0, -1).map((item, index) => (
                    <li key={index}>{item.Name}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })}
    </Card>
  );
}

export function GemStrip({ data }: { data: Armory["ArmoryGem"] }) {
  const gems = data?.Gems ?? [];
  const groups = new Map<string, { count: number; total: number }>();
  for (const gem of gems) {
    const kind = gemKind(gem.Name) ?? "기타";
    const group = groups.get(kind) ?? { count: 0, total: 0 };
    groups.set(kind, {
      count: group.count + 1,
      total: group.total + gem.Level,
    });
  }
  return (
    <Card
      title="보석"
      extra={
        gems.length > 0 && (
          <>
            <span className="sub">{gems.length}개</span>
            <span className="right small muted">
              {Array.from(
                groups,
                ([kind, group]) =>
                  kind +
                  " " +
                  group.count +
                  " · 평균 Lv." +
                  (group.total / group.count).toFixed(1),
              ).join("　|　")}
            </span>
          </>
        )
      }
    >
      {!gems.length ? (
        <Empty label="장착한 보석이 없습니다." />
      ) : (
        <div className="gems">
          {gems.map((gem) => {
            const skills =
              data?.Effects?.Skills?.filter(
                (skill) => skill.GemSlot === gem.Slot,
              ) ?? [];
            const kind = gemKind(gem.Name);
            const lines = [
              gem.Name,
              gem.Grade,
              ...skills.flatMap((skill) => [
                skill.Name,
                skill.Option ?? "",
                ...(skill.Description ?? []),
              ]),
              ...tooltipLines(gem.Tooltip),
            ];
            return (
              <div className="gem" key={gem.Slot}>
                <Tooltip lines={lines.filter(Boolean).map(plainText)}>
                  <span className="gem-mark">
                    <GradeIcon
                      grade={gem.Grade}
                      label={kind?.[0] ?? "보"}
                      src={gem.Icon}
                      level={gem.Level}
                    />
                  </span>
                  <span>{kind ?? gem.Name}</span>
                  <span className="gem-skill">
                    {skills.map((skill) => skill.Name).join(", ")}
                  </span>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  accessory = false,
}: {
  item: Equipment & { IsInner?: boolean; IsSet?: boolean };
  accessory?: boolean;
}) {
  const tooltip = parseTooltip(item.Tooltip);
  const quality = tooltip?.quality;
  const name = item.Name.match(/^(\+\d+)\s+(.+)$/);
  return (
    <div
      className={"row eq" + (accessory ? " acc" : "")}
      data-grade={item.Grade}
    >
      <GradeIcon
        grade={item.Grade}
        label={item.Type.slice(0, 1)}
        src={item.Icon}
        tier={tooltip?.tier}
        badge={accessory ? undefined : quality}
      />
      <div className="item-text">
        <span className="name" title={item.Name}>
          {name ? (
            <>
              <b className="gtext">{name[1]}</b> {name[2]}
            </>
          ) : (
            item.Name
          )}
        </span>
        <div className="meta">
          {item.Type} · {item.Grade}
          {tooltip?.itemLevel && <span>Lv.{tooltip.itemLevel}</span>}
          {tooltip?.advanced != null && (
            <span>상급 재련 +{tooltip.advanced}</span>
          )}
          {quality != null && (
            <Pill className={"q " + qualityClass(quality)}>품질 {quality}</Pill>
          )}
          {item.IsInner && <Pill className="accent-pill">내부</Pill>}
          {item.IsSet && <Pill className="accent-pill">세트</Pill>}
        </div>
        {accessory && tooltip && (
          <div className="opts">
            {tooltip.options.map((option, index) => (
              <div key={index}>
                {option.rank && (
                  <Pill
                    grade={{ 상: "전설", 중: "영웅", 하: "희귀" }[option.rank]}
                  >
                    {option.rank}
                  </Pill>
                )}
                {option.kind && (
                  <Pill className="accent-pill">
                    {option.kind === "locked" ? "고정" : "변환"}
                  </Pill>
                )}
                <span className="option-text">{option.text}</span>
              </div>
            ))}
            {tooltip.engravings.map((entry, index) => (
              <div key={index} className={entry.harmful ? "danger-text" : ""}>
                {entry.name}
                {entry.level != null && " +" + entry.level}
                {entry.bonus && " · " + entry.bonus}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function EquipmentCard({
  equipment,
  avatars,
}: {
  equipment: Armory["ArmoryEquipment"];
  avatars: Armory["ArmoryAvatars"];
}) {
  const [tab, setTab] = useState(0);
  const id = useId();
  const armor = (equipment ?? [])
    .filter((item) => armorOrder.includes(item.Type))
    .sort((a, b) => armorOrder.indexOf(a.Type) - armorOrder.indexOf(b.Type));
  const items = tab === 0 ? armor : (avatars ?? []);
  return (
    <Card
      title="장비 / 아바타"
      extra={
        <div className="tabs" role="tablist" aria-label="장비와 아바타">
          {["장비", "아바타"].map((label, index) => (
            <button
              key={label}
              id={id + index}
              role="tab"
              aria-selected={tab === index}
              aria-controls={id + "panel-" + index}
              tabIndex={tab === index ? 0 : -1}
              onClick={() => setTab(index)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 1
                      : 1 - index;
                setTab(next);
                document.getElementById(id + next)?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {[0, 1].map((index) => (
        <div
          key={index}
          role="tabpanel"
          id={id + "panel-" + index}
          aria-labelledby={id + index}
          hidden={tab !== index}
          tabIndex={0}
          className="equip"
        >
          {tab === index &&
            (items.length > 0 ? (
              items.map((item, index) => <ItemRow item={item} key={index} />)
            ) : (
              <Empty
                label={
                  tab === 0
                    ? "장착한 장비가 없습니다."
                    : "장착한 아바타가 없습니다."
                }
              />
            ))}
        </div>
      ))}
    </Card>
  );
}

export function AccessoryCard({
  equipment,
}: {
  equipment: Armory["ArmoryEquipment"];
}) {
  const items = equipment?.filter((item) => accessoryTypes.includes(item.Type));
  return (
    <Card title="악세사리">
      {items?.length ? (
        <div className="list">
          {items.map((item, index) => (
            <ItemRow item={item} key={index} accessory />
          ))}
        </div>
      ) : (
        <Empty label="장착한 악세사리가 없습니다." />
      )}
    </Card>
  );
}
