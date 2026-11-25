type Rank = "상" | "중" | "하";
type Option = {
  rank: Rank | null;
  text: string;
  colors: string[];
  kind?: "locked" | "changeable";
};
export type ParsedTooltip = {
  lines: string[];
  quality: number | null;
  tier: number | null;
  itemLevel: string | null;
  advanced: number | null;
  options: Option[];
  engravings: {
    name: string;
    level: number | null;
    harmful: boolean;
    bonus: string | null;
  }[];
};

export function plainText(value: string) {
  return value
    .replace(/<\s*(?:br\s*\/?|\/p|\/div)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

const accessoryEffect =
  /^(?:추가 피해|적에게 주는 피해|공격력|무기 공격력|최대 생명력|치명타 적중률|치명타 피해|아군 공격력 강화|아군 피해량 강화|낙인력|치명|특화|신속|제압|인내|숙련)\s*\+[\d,.]+%?/u;
const br = /<br\s*\/?>/i;

function record(node: unknown): Record<string, unknown> | null {
  return node && typeof node === "object"
    ? (node as Record<string, unknown>)
    : null;
}

function strings(node: unknown): string[] {
  if (typeof node === "string") return [node];
  return Object.values(record(node) ?? {}).flatMap(strings);
}

function colors(raw: string) {
  return [...raw.matchAll(/\bcolor\s*=\s*['"]?#?([a-f\d]{6})\b/gi)].map(
    (match) => "#" + match[1].toUpperCase(),
  );
}

function option(raw: string, kind?: Option["kind"]): Option {
  const text = plainText(raw).trim();
  const explicit = text.match(/^\[([상중하])\]\s*/u);
  const hex = colors(raw);
  const rank = explicit
    ? (explicit[1] as Rank)
    : kind === undefined && hex.includes("#FE9600")
      ? "상"
      : null;
  return {
    text: explicit ? text.slice(explicit[0].length) : text,
    rank,
    colors: hex,
    kind,
  };
}

function braceletOptions(raw: string) {
  const markers = [
    ...raw.matchAll(
      /<img\b[^>]*\bsrc\s*=\s*['"]emoticon_tooltip_bracelet_(locked|changeable)['"][^>]*>\s*(?:<\/img>)?/gi,
    ),
  ];
  if (!markers.length)
    return raw
      .split(br)
      .map((line) => option(line))
      .filter((entry) => entry.text);
  return markers
    .map((marker, index) =>
      option(
        raw.slice(marker.index + marker[0].length, markers[index + 1]?.index),
        marker[1].toLowerCase() as Option["kind"],
      ),
    )
    .filter((entry) => entry.text);
}

export function parseTooltip(raw?: string | null): ParsedTooltip | null {
  if (!raw) return null;
  try {
    const root: unknown = JSON.parse(raw);
    const map = record(root);
    if (!map || Array.isArray(root)) return null;
    const blocks = Object.values(map)
      .map(record)
      .filter((block) => block !== null);
    const lines = Object.entries(map)
      .flatMap(([key, value]) => {
        const block = record(value);
        return strings(block && "type" in block ? block.value : map[key]);
      })
      .flatMap((raw) =>
        plainText(raw)
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      );
    let quality: number | null = null;
    const title = record(
      blocks.find((block) => block.type === "ItemTitle")?.value,
    );
    const qualityValue = title?.qualityValue;
    if (
      typeof qualityValue === "number" &&
      qualityValue >= 0 &&
      qualityValue <= 100
    )
      quality = qualityValue;
    const titleText = title
      ? strings(title).map(plainText).join("\n")
      : lines.join("\n");
    const qualityMatch = titleText.match(/품질\s*(\d+)/)?.[1];
    const tier = titleText.match(/티어\s*(\d+)/)?.[1];
    const refinement = blocks
      .filter((block) => block.type === "SingleTextBox")
      .flatMap((block) => strings(block.value))
      .map(plainText)
      .join("\n");
    const advanced = refinement.match(
      /\[?상급 재련\]?\s*(?:단계\s*)?\+?\s*(\d+)/,
    )?.[1];
    const options: Option[] = [];
    const engravings: ParsedTooltip["engravings"] = [];
    for (const block of blocks) {
      if (block.type === "ItemPartBox") {
        const values = strings(block.value);
        const heading = values.findIndex((raw) =>
          /^(?:연마 효과|팔찌 효과)\s*$/u.test(plainText(raw).trim()),
        );
        if (heading < 0) continue;
        const body = values
          .filter((_, index) => index !== heading)
          .join("<BR>");
        if (plainText(values[heading]).includes("팔찌"))
          options.push(...braceletOptions(body));
        else
          options.push(
            ...body
              .split(br)
              .map((line) => option(line))
              .filter((entry) => entry.text),
          );
      }
      if (block.type === "IndentStringGroup") {
        for (const group of Object.values(record(block.value) ?? {}).map(
          record,
        )) {
          if (
            !group ||
            typeof group.topStr !== "string" ||
            !plainText(group.topStr).includes("무작위 각인 효과")
          )
            continue;
          for (const raw of strings(group.contentStr)) {
            const text = plainText(raw).trim();
            const name = text.match(/\[([^\]]+)\]/)?.[1]?.trim();
            if (!name) continue;
            const level = text.match(/(?:Lv\.|활성도\s*\+?)\s*(\d+)/i)?.[1];
            const hex = colors(raw);
            const bonus =
              name.includes("레벨 보너스") || hex.includes("#73DC04")
                ? text.slice(text.indexOf("]") + 1).trim() || null
                : null;
            if (level || bonus)
              engravings.push({
                name,
                level: level ? Number(level) : null,
                harmful: name.includes("감소") || hex.includes("#FE2E2E"),
                bonus,
              });
          }
        }
      }
    }
    if (!options.length) {
      options.push(
        ...lines
          .filter(
            (line) => /^\[[상중하]\]/u.test(line) || accessoryEffect.test(line),
          )
          .map((line) => option(line)),
      );
    }
    if (!engravings.length) {
      for (const [, name, level] of lines
        .join("\n")
        .matchAll(/\[(.+?)\]\s*활성도\s*\+?(\d+)/g)) {
        engravings.push({
          name,
          level: Number(level),
          harmful: name.includes("감소"),
          bonus: null,
        });
      }
    }
    return {
      lines,
      quality:
        quality ??
        (qualityMatch && Number(qualityMatch) <= 100
          ? Number(qualityMatch)
          : null),
      tier: tier ? Number(tier) : null,
      itemLevel: titleText.match(/아이템\s*레벨\s*([\d,.]+)/)?.[1] ?? null,
      advanced: advanced ? Number(advanced) : null,
      options,
      engravings,
    };
  } catch {
    return null;
  }
}

export const gemKind = (name: string) =>
  name.match(/(\S+)의 보석/u)?.[1] ?? null;
export const armorOrder = ["투구", "어깨", "상의", "하의", "장갑", "무기"];
export const accessoryTypes = [
  "목걸이",
  "귀걸이",
  "반지",
  "어빌리티 스톤",
  "팔찌",
];
export const qualityClass = (q: number) =>
  q >= 100
    ? "q5"
    : q >= 90
      ? "q4"
      : q >= 70
        ? "q3"
        : q >= 30
          ? "q2"
          : q >= 10
            ? "q1"
            : "q0";
