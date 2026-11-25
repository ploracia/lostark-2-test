import { useId, useState, type RefObject } from "react";
import { ESTHER_TABLE } from "./transfer/rules/esther";
import { gemTier } from "./transfer/gem";
import { ARMOR_PAIRS } from "./transfer/rules/slots";
import type { Ella, TransferInput, TransferOverrides } from "./transfer/types";

const parts = [...ARMOR_PAIRS.map(([part]) => part), "무기"] as const;
const ellaValues = [0, 1, 2, 3] as const;
const ellaText = (value: Ella) =>
  value === 0 ? "엘라 없음" : "엘라 " + value + "단계";
type Field = keyof TransferOverrides;
type Source = NonNullable<TransferOverrides["gemSource"]>[number]["source"];

export function countOverrides(overrides: TransferOverrides) {
  return (
    Object.keys(overrides.gearItemLevel ?? {}).length +
    Object.keys(overrides.artisanEnergy ?? {}).length +
    Object.keys(overrides.gemSource ?? {}).length +
    [
      overrides.storedEsther,
      overrides.equippedElla,
      overrides.vambraceHoning,
      overrides.stoneCut,
    ].filter((value) => value !== undefined).length
  );
}
function NumericField({
  label,
  field,
  max,
  value,
  step,
  update,
}: {
  label: string;
  field: Field;
  max: number;
  value?: number;
  step?: string;
  update: (value?: number) => void;
}) {
  const id = useId();
  const [invalid, setInvalid] = useState<string>();
  function change(raw: string, badInput: boolean) {
    const number = Number(raw);
    if (
      badInput ||
      (raw !== "" &&
        (!Number.isFinite(number) ||
          number < 0 ||
          number > max ||
          (!step && !Number.isInteger(number))))
    ) {
      setInvalid(raw);
      return;
    }
    setInvalid(undefined);
    update(raw === "" ? undefined : number);
  }
  return (
    <label>
      {label}
      <input
        data-field={field}
        type="number"
        min={0}
        max={max}
        step={step ?? "1"}
        value={invalid ?? value ?? ""}
        aria-invalid={invalid !== undefined}
        aria-describedby={invalid !== undefined ? id : undefined}
        onChange={(event) =>
          change(event.target.value, event.target.validity.badInput)
        }
      />
      {invalid !== undefined && (
        <small id={id} className="delta down">
          0~{max}
          {step ? " 범위의 숫자" : " 사이의 정수"}를 입력하세요.
        </small>
      )}
    </label>
  );
}

export function OverridesPanel({
  panel,
  input,
  value,
  onChange,
}: {
  panel: RefObject<HTMLDetailsElement>;
  input: TransferInput;
  value: TransferOverrides;
  onChange: (value: TransferOverrides) => void;
}) {
  const stored = value.storedEsther;
  const allowed = (evolution: number) =>
    ellaValues.filter((ella) =>
      Object.hasOwn(ESTHER_TABLE, evolution + "_" + ella),
    );
  function selectEvolution(raw: string) {
    const evolution = Number(raw);
    const ella =
      stored && allowed(evolution).includes(stored.ella)
        ? stored.ella
        : allowed(evolution)[0];
    onChange({
      ...value,
      storedEsther: raw === "" ? undefined : { evolution, ella },
    });
  }
  return (
    <details className="card transfer-details" ref={panel}>
      <summary>
        추가 정보 입력 <small className="muted">(선택)</small>{" "}
        {countOverrides(value) > 0 && (
          <span className="pill">입력 {countOverrides(value)}개 적용 중</span>
        )}
      </summary>
      <p className="small muted">
        입력하지 않으면 아래 가정으로 계산합니다. 입력값은 이 브라우저에
        저장됩니다.
      </p>
      <fieldset>
        <legend>더 높은 미장착 장비 아이템 레벨</legend>
        <div className="override-fields">
          {parts.map((part) => (
            <NumericField
              key={part}
              label={part}
              field="gearItemLevel"
              max={2000}
              step="any"
              value={value.gearItemLevel?.[part]}
              update={(number) => {
                const levels = { ...value.gearItemLevel, [part]: number };
                if (number === undefined) delete levels[part];
                onChange({ ...value, gearItemLevel: levels });
              }}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>에스더 무기</legend>
        <label>
          보관 중인 에스더 진화
          <select
            data-field="storedEsther"
            value={stored?.evolution ?? ""}
            onChange={(event) => selectEvolution(event.target.value)}
          >
            <option value="">보관 무기 없음</option>
            {Array.from({ length: 11 }, (_, i) => (
              <option value={i} key={i}>
                {i}단계
              </option>
            ))}
          </select>
        </label>
        {stored && (
          <label>
            보관 무기 엘라
            <select
              value={stored.ella}
              onChange={(event) =>
                onChange({
                  ...value,
                  storedEsther: {
                    ...stored,
                    ella: Number(event.target.value) as Ella,
                  },
                })
              }
            >
              {allowed(stored.evolution).map((ella) => (
                <option value={ella} key={ella}>
                  {ellaText(ella)}
                </option>
              ))}
            </select>
          </label>
        )}
        {input.esther && (
          <label>
            장착 무기 엘라
            <select
              data-field="equippedElla"
              value={value.equippedElla ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  equippedElla:
                    event.target.value === ""
                      ? undefined
                      : (Number(event.target.value) as Ella),
                })
              }
            >
              <option value="">자동 추론</option>
              {allowed(input.esther.evolution).map((ella) => (
                <option value={ella} key={ella}>
                  {ellaText(ella)}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      <NumericField
        label="기존 완갑 재련 단계"
        field="vambraceHoning"
        max={25}
        value={value.vambraceHoning}
        update={(number) => onChange({ ...value, vambraceHoning: number })}
      />
      <fieldset>
        <legend>장인의 기운 (%)</legend>
        <div className="override-fields">
          {parts.map((part) => (
            <NumericField
              key={part}
              label={part}
              field="artisanEnergy"
              max={100}
              step="any"
              value={value.artisanEnergy?.[part]}
              update={(number) => {
                const energy = { ...value.artisanEnergy, [part]: number };
                if (number === undefined) delete energy[part];
                onChange({ ...value, artisanEnergy: energy });
              }}
            />
          ))}
        </div>
      </fieldset>
      {input.gems
        .filter((gem) => gem.level === 8 && gemTier(gem) === 4)
        .map((gem) => {
          const source = value.gemSource?.[gem.slot]?.source ?? "normal";
          const bound =
            value.gemSource?.[gem.slot]?.bound ?? gem.bound ?? false;
          const update = (source: Source, bound: boolean) =>
            onChange({
              ...value,
              gemSource: { ...value.gemSource, [gem.slot]: { source, bound } },
            });
          return (
            <fieldset key={gem.slot}>
              <legend>
                {gem.kind} 8레벨 · 슬롯 {gem.slot + 1}
              </legend>
              <label>
                획득처
                <select
                  data-field="gemSource"
                  value={source}
                  onChange={(event) =>
                    update(event.target.value as Source, bound)
                  }
                >
                  <option value="normal">일반</option>
                  <option value="paid">유료 성장 상품</option>
                  <option value="paradise">낙원</option>
                </select>
              </label>
              <label className="override-check">
                <input
                  type="checkbox"
                  checked={bound}
                  onChange={(event) => update(source, event.target.checked)}
                />{" "}
                귀속
              </label>
            </fieldset>
          );
        })}
      {input.stone && (
        <label className="override-check">
          <input
            data-field="stoneCut"
            type="checkbox"
            checked={value.stoneCut ?? true}
            onChange={(event) =>
              onChange({ ...value, stoneCut: event.target.checked })
            }
          />{" "}
          장착 스톤 세공 완료
        </label>
      )}
    </details>
  );
}
