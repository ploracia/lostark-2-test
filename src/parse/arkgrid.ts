import { plainText, tooltipLines } from "./tooltip";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function blocks(raw?: string | null) {
  if (!raw) return [];
  try {
    return Object.values(record(JSON.parse(raw)) ?? {}).map(record);
  } catch {
    return [];
  }
}

function clean(value: unknown) {
  return typeof value === "string"
    ? plainText(value)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n")
    : "";
}

function parts(tooltip: ReturnType<typeof blocks>) {
  return tooltip.flatMap((block) => {
    const value = block?.type === "ItemPartBox" && record(block.value);
    return value
      ? [{ title: clean(value.Element_000), body: clean(value.Element_001) }]
      : [];
  });
}

export function parseCoreTooltip(slot: {
  Point: number;
  Tooltip?: string | null;
}) {
  const sections = parts(blocks(slot.Tooltip));
  const options = sections.filter(({ title }) => title === "코어 옵션");
  if (options.length !== 1 || !Number.isFinite(slot.Point)) return null;

  const { body } = options[0];
  const markers = [...body.matchAll(/\[(\d+)P\]/gi)];
  if (!markers.length || markers[0].index !== 0) return null;

  const effects = markers.map((marker, index) => {
    const point = Number(marker[1]);
    const text = body
      .slice(marker.index + marker[0].length, markers[index + 1]?.index)
      .trim();
    return { point, text, active: slot.Point >= point };
  });
  if (effects.some(({ point, text }) => !Number.isSafeInteger(point) || !text))
    return null;

  const activationCondition =
    sections.find(({ title }) => title === "코어 옵션 발동 조건")?.body || null;
  return { effects, activationCondition };
}

export function parseGemTooltip(raw?: string | null) {
  const tooltip = blocks(raw);
  const name = clean(
    tooltip.find((block) => block?.type === "NameTagBox")?.value,
  );
  const sections = parts(tooltip);
  const body = sections.find((part) => part.title === "젬 효과")?.body ?? "";
  const willpower = body.match(/(?:^|\n)필요 의지력\s*:\s*(\d+)/);
  const corePoint = body.match(/(?:^|\n)(질서|혼돈)\s*포인트\s*:\s*(\d+)/);
  const gemPoint = sections
    .map((part) => part.body)
    .join("\n")
    .match(/(?:^|\n)젬 포인트\s*:\s*(\d+)/);
  const options = [...body.matchAll(/\[([^\]\n]+)\]\s*Lv\.\s*(\d+)/gi)].map(
    (match) => ({ name: match[1].trim(), level: Number(match[2]) }),
  );
  return {
    name: name || null,
    willpower: willpower ? Number(willpower[1]) : null,
    corePoint: corePoint
      ? { type: corePoint[1], value: Number(corePoint[2]) }
      : null,
    gemPoint: gemPoint ? Number(gemPoint[1]) : null,
    options,
  };
}

export function gridEffectTooltipLines(raw?: string | null) {
  if (!raw) return [];
  if (raw.trimStart().startsWith("{")) return tooltipLines(raw);
  return clean(raw).split("\n").filter(Boolean);
}
