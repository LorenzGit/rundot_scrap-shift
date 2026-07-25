export const SKIN_IDS = ["salvage", "toxic", "ion", "foundry", "void", "founder"] as const;
export type SkinId = (typeof SKIN_IDS)[number];

export type SkinUnlock =
    | { kind: "starter" }
    | { kind: "daily"; day: 3 | 7 }
    | { kind: "entitlement"; entitlementId: string; productId: "blade_skin_foundry" | "founder_bundle" };

export interface SkinDefinition {
    id: SkinId;
    name: string;
    tagline: string;
    cssClass: string;
    unlock: SkinUnlock;
    player: {
        suit: number;
        trim: number;
        visor: number;
        visorShade: number;
        weapon: number;
    };
    blades: readonly [number, number, number, number];
}

export const SKINS: Readonly<Record<SkinId, SkinDefinition>> = {
    salvage: {
        id: "salvage",
        name: "Salvage Ace",
        tagline: "ORIGINAL JUNKYARD RIG",
        cssClass: "skin-salvage",
        unlock: { kind: "starter" },
        player: { suit: 0xff9c38, trim: 0xffd15a, visor: 0x6ff7ff, visorShade: 0x24526e, weapon: 0x6ff7ff },
        blades: [0x6ff7ff, 0xb9ff4a, 0xff5c78, 0x9f91ff],
    },
    toxic: {
        id: "toxic",
        name: "Toxic Runner",
        tagline: "DAY 3 REWARD · ACID TEMPER",
        cssClass: "skin-toxic",
        unlock: { kind: "daily", day: 3 },
        player: { suit: 0x76de52, trim: 0xd9ff62, visor: 0xfff3c4, visorShade: 0x4e8d45, weapon: 0xb9ff4a },
        blades: [0xb9ff4a, 0x6eea65, 0xe8ff7c, 0x55b96c],
    },
    ion: {
        id: "ion",
        name: "Ion Ghost",
        tagline: "DAY 7 REWARD · COLD ARC",
        cssClass: "skin-ion",
        unlock: { kind: "daily", day: 7 },
        player: { suit: 0x536cff, trim: 0x9f91ff, visor: 0xdffcff, visorShade: 0x334b9c, weapon: 0x6ff7ff },
        blades: [0x6ff7ff, 0x4b72ff, 0x9f91ff, 0xdffcff],
    },
    foundry: {
        id: "foundry",
        name: "Foundry Gold",
        tagline: "BLADE SKIN PACK · MOLTEN EDGE",
        cssClass: "skin-foundry",
        unlock: {
            kind: "entitlement",
            entitlementId: "scrap_shift_blade_skin_foundry",
            productId: "blade_skin_foundry",
        },
        player: { suit: 0xe35b2d, trim: 0xffc14f, visor: 0xfff3c4, visorShade: 0xb83c2e, weapon: 0xff9c38 },
        blades: [0xffc14f, 0xff9c38, 0xff5c3e, 0xfff3c4],
    },
    void: {
        id: "void",
        name: "Void Chrome",
        tagline: "BLADE SKIN PACK · DARK MATTER",
        cssClass: "skin-void",
        unlock: {
            kind: "entitlement",
            entitlementId: "scrap_shift_blade_skin_foundry",
            productId: "blade_skin_foundry",
        },
        player: { suit: 0x54226f, trim: 0xff85dc, visor: 0x9f91ff, visorShade: 0x34235f, weapon: 0xff85dc },
        blades: [0xff85dc, 0x9f91ff, 0x6b3fc7, 0x241034],
    },
    founder: {
        id: "founder",
        name: "First Shifter",
        tagline: "FOUNDER BUNDLE · PRISM PROTOTYPE",
        cssClass: "skin-founder",
        unlock: {
            kind: "entitlement",
            entitlementId: "scrap_shift_pilot_skin_founder",
            productId: "founder_bundle",
        },
        player: { suit: 0xfff3c4, trim: 0xff85dc, visor: 0x6ff7ff, visorShade: 0x6b3fc7, weapon: 0xb9ff4a },
        blades: [0xff85dc, 0x6ff7ff, 0xb9ff4a, 0xfff3c4],
    },
};

export function isSkinId(value: unknown): value is SkinId {
    return typeof value === "string" && (SKIN_IDS as readonly string[]).includes(value);
}

export function skinOwnedLocally(id: SkinId, earnedSkinIds: readonly SkinId[]): boolean {
    const unlock = SKINS[id].unlock;
    return unlock.kind === "starter" || (unlock.kind === "daily" && earnedSkinIds.includes(id));
}
