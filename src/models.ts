export type Sibling = {
  ServerName: string;
  CharacterName: string;
  CharacterClassName: string;
  CharacterLevel: number;
  ItemAvgLevel: string;
};
export type Profile = Sibling & {
  CharacterImage?: string | null;
  Title?: string | null;
  CombatPower?: string | null;
  ExpeditionLevel?: number;
  HonorPoint?: number;
  GuildName?: string | null;
  TownName?: string | null;
  TownLevel?: number;
  Stats?: { Type: string; Value: string; Tooltip?: string[] }[] | null;
};
type Item = {
  Name: string;
  Grade: string;
  Icon?: string | null;
  Tooltip?: string | null;
};
export type Equipment = Item & { Type: string };
export type Avatar = Equipment & { IsInner?: boolean; IsSet?: boolean };
export type Armory = {
  ArmoryProfile?: Profile | null;
  ArmoryEquipment?: Equipment[] | null;
  ArmoryAvatars?: Avatar[] | null;
  ArmoryGem?: {
    Gems?: (Item & { Slot: number; Level: number })[] | null;
    Effects?: {
      Skills?:
        | {
            GemSlot: number;
            Name: string;
            Option?: string;
            Description?: string[];
          }[]
        | null;
    } | null;
  } | null;
  ArmoryEngraving?: {
    ArkPassiveEffects?:
      | {
          Name: string;
          Grade: string;
          Level: number;
          AbilityStoneLevel?: number | null;
          Description?: string;
        }[]
      | null;
    Engravings?: (Item & { Slot: number })[] | null;
    Effects?: { Name: string; Description?: string }[] | null;
  } | null;
  ArmoryCard?: {
    Cards?:
      | (Item & { Slot: number; AwakeCount: number; AwakeTotal: number })[]
      | null;
    Effects?:
      | {
          Index: number;
          Items?: { Name: string; Description?: string }[] | null;
        }[]
      | null;
  } | null;
  ArkPassive?: {
    IsArkPassive: boolean;
    Title?: string;
    Points?:
      | {
          Name: string;
          Value: number;
          Description?: string;
          Tooltip?: string;
        }[]
      | null;
    Effects?:
      | { Name: string; Description: string; Icon?: string; ToolTip?: string }[]
      | null;
  } | null;
  ArkGrid?: {
    Slots?:
      | (Item & {
          Index: number;
          Point: number;
          Gems?: {
            Index?: number;
            Icon?: string;
            IsActive: boolean;
            Grade: string;
            Tooltip?: string | null;
          }[] | null;
        })[]
      | null;
    Effects?: { Name: string; Level: number; Tooltip?: string }[] | null;
  } | null;
};
