import type { ARMOR_PAIRS, SLOT_LAYOUT } from "./rules/slots";

export type EvidenceLevel = "official" | "estimated" | "unknown";
export type Evidence = { level: EvidenceLevel; source: string; note?: string };
export type Est<T> =
  | {
      kind: "value";
      value: T;
      evidence: Evidence & { level: "official" | "estimated" };
    }
  | {
      kind: "range";
      min: T;
      max: T;
      evidence: Evidence & { level: "estimated" };
    }
  | { kind: "none"; label: string; evidence: Evidence & { level: "unknown" } };
export type OldPart = (typeof ARMOR_PAIRS)[number][0] | "무기";
export type NewSlot = (typeof SLOT_LAYOUT)[number][number];
export type GearIn = {
  part: OldPart;
  name: string;
  grade: string;
  icon?: string | null;
  itemLevel: number | null;
  honing: number | null;
  advanced: number | null;
  quality: number | null;
};
export type Ella = 0 | 1 | 2 | 3;
export type EstherIn = {
  evolution: number;
  ella: Ella | null;
  itemLevel: number | null;
};
export type Option = { text: string; rank: "상" | "중" | "하" | null };
export type AccessoryIn = {
  part: "목걸이" | "귀걸이" | "반지";
  index: number;
  grade: string;
  quality: number | null;
  tier: number | null;
  options: Option[] | null;
  tradeCount: number | null;
};
export type BraceletIn = {
  tier: number | null;
  options: { text: string; kind?: "locked" | "changeable" }[] | null;
};
export type StoneIn = {
  engravings: {
    name: string;
    level: number | null;
    unit?: "lv" | "node";
    harmful: boolean;
  }[];
};
export type GemIn = {
  slot: number;
  kind: string | null;
  /** 툴팁의 "티어 N". 없으면 보석 이름으로 추정합니다. */
  tier?: number | null;
  level: number;
  bound: boolean | null;
};
export type TransferInput = {
  className: string;
  profileAvg: number | null;
  gear: GearIn[];
  esther: EstherIn | null;
  vambraceHoning?: number | null;
  accessories: AccessoryIn[];
  bracelet: BraceletIn | null;
  stone: StoneIn | null;
  gems: GemIn[];
  karma: { name: string; level: number | null }[];
};
export type TransferOverrides = {
  gearItemLevel?: Partial<Record<OldPart, number>>;
  storedEsther?: { evolution: number; ella: Ella };
  equippedElla?: Ella;
  vambraceHoning?: number;
  artisanEnergy?: Partial<Record<OldPart, number>>;
  gemSource?: Record<
    number,
    { source: "normal" | "paid" | "paradise"; bound: boolean }
  >;
  stoneCut?: boolean;
};
export type NewSlotResult = {
  slot: NewSlot;
  from: OldPart;
  tier: number | null;
  grade: string | null;
  ella?: Est<number>;
  polish: Est<number>;
  itemLevel: Est<number>;
  slotHoning?: Est<number>;
  artisanEnergy?: Est<number>;
  isNew: boolean;
};
export type EstherResult = {
  before: EstherIn;
  itemLevel: Est<number>;
  ella: Est<number>;
  polish: Est<number>;
  honing: Est<number>;
  energy: Est<number>;
  kit: Est<number>;
  linkedLevel: Est<number>;
};
export type PayoutRow = { item: string; amount: Est<number>; basis: string };
