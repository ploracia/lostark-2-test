import type { gradeAccessory } from "./accessory";
import type { analyzeBracelet } from "./bracelet";
import { unknown } from "./evidence";
import type { convertStone } from "./stone";
import type { EstherResult, PayoutRow, TransferInput } from "./types";

export function collectPayouts(
  input: TransferInput,
  esther: EstherResult | null,
  accessories: ReturnType<typeof gradeAccessory>[],
  bracelet: ReturnType<typeof analyzeBracelet> | null,
  stone: ReturnType<typeof convertStone> | null,
) {
  const rows: PayoutRow[] = [];
  const pending = (
    item: string,
    source: string,
    basis: string,
    label = "수량 미확인",
  ) => rows.push({ item, amount: unknown(source, label), basis });
  if (esther) {
    rows.push(
      { item: "에스더의 기운", amount: esther.energy, basis: "캐릭터 귀속" },
      { item: "로맨틱 재료 키트", amount: esther.kit, basis: "캐릭터 귀속" },
    );
  }
  const quality = input.gear.filter(
    (gear) => gear.grade !== "에스더" && gear.quality !== null,
  );
  pending(
    "2부 성장 재료 교환용 토큰 · 품질",
    "공지 품질 개편",
    "부위별 최고 품질 기준. " +
      quality.map((gear) => gear.part + " " + gear.quality).join(" · "),
  );
  const karma = input.karma.filter(
    (point) => point.level !== null && point.level >= 22,
  );
  if (karma.length)
    pending(
      "2부 성장 재료 교환용 토큰 · 카르마",
      "공지 카르마 환급",
      "22레벨 이상 대상 추정 · " +
        karma.map((point) => point.name + " " + point.level).join(" · "),
    );
  const shards = accessories.filter((entry) => entry.outcome === "shard");
  if (shards.length)
    pending(
      "영롱한 보석 파편",
      "공지 표5·6",
      "비대상 장신구 " + shards.length + "개",
    );
  if (
    bracelet &&
    (bracelet.status === "dismantle" || bracelet.status === "exclude")
  )
    pending("팔찌 분해 결과물", "공지 팔찌 이관", "실링 교환");
  if (stone?.excluded)
    pending(
      "초월의 가루 / 장신구 슬롯 성장 재료",
      "공지 표9",
      "각인 슬롯 반영 없음",
    );
  if (stone?.upgrade.kind === "value" && stone.upgrade.value.extra)
    pending(
      "추가 지급 아이템",
      "공지 표9",
      "활성화 포인트 합계 8",
      "종류 미확인",
    );
  const advanced = input.gear.filter((gear) => gear.advanced);
  if (advanced.length)
    pending(
      "상급 재련 제거",
      "공지 상급 재련 제거",
      advanced
        .map((gear) => gear.part + " " + gear.advanced + "단계")
        .join(" · "),
      "보상 언급 없음",
    );
  pending(
    "보관함 아이템",
    "공지 교체 지급",
    "재련 재료 · 팔찌 재변환권 · 여분 스톤 · 비상의 돌 키트 · 큐브 입장권",
  );
  return rows;
}
