export type GameOrientation = "landscape" | "portrait";

export interface DesignViewport {
    width: number;
    height: number;
    orientation: GameOrientation;
}

export const LANDSCAPE_VIEW: Readonly<DesignViewport> = {
    width: 640,
    height: 360,
    orientation: "landscape",
};

export const PORTRAIT_VIEW: Readonly<DesignViewport> = {
    width: 360,
    height: 640,
    orientation: "portrait",
};

export function designViewportForSize(width: number, height: number): Readonly<DesignViewport> {
    return height >= width ? PORTRAIT_VIEW : LANDSCAPE_VIEW;
}

export const WORLD_WIDTH = 1800;
export const WORLD_HEIGHT = 1000;
export const SURVIVAL_RAMP_SECONDS = 180;
export const HORDE_FIRST_SECONDS = 45;
export const HORDE_INTERVAL_SECONDS = 55;
export const HORDE_WARNING_SECONDS = 4;
export const HORDE_DURATION_SECONDS = 13;
export const MAX_ACTIVE_ENEMIES = 110;
export const MAX_ACTIVE_HAZARDS = 120;
export const MAX_ACTIVE_PICKUPS = 120;
export const PICKUP_LIFETIME_SECONDS = 30;
export const CACHE_KILLS_BASE = 14;
export const COMBO_WINDOW_SECONDS = 3.2;
export const BLADE_CAROUSEL_MAX_LEVEL = 8;
export const BASE_PLAYER_SPEED = 123.2;
export const STARTING_PLAYER_INTEGRITY = 15;
export const MAX_PLAYER_INTEGRITY = 21;
export const DAMAGE_INVULNERABILITY_SECONDS = 0.52;
export const ENEMY_DAMAGE_STEP_SECONDS = 60;
export const ENEMY_DAMAGE_BONUS_CAP = 2;
export const ENEMY_SPEED_RAMP_CAP = 0.65;
export const ENEMY_PROJECTILE_SPEED_START = 160;
export const ENEMY_PROJECTILE_SPEED_END = 240;
export const ENEMY_FORWARD_SPAWN_CHANCE = 0.58;
export const ENEMY_SPAWN_DISTANCE_MIN = 235;
export const ENEMY_SPAWN_DISTANCE_MAX = 315;
export const REPAIR_HEAL = 3;
export const TREASURE_REPAIR_HEAL = 5;
export const SHIELD_BLOCKS = 1;
export const TREASURE_SHIELD_BLOCKS = 2;
export const LEVEL_ENERGY_BASE = 24;
export const LEVEL_ENERGY_STEP = 10;
export const BASE_PICKUP_RADIUS = 92;
export const PICKUP_RADIUS_PER_MAGNET_LEVEL = 32;
export const FIRST_TREASURE_DELAY_SECONDS = 58;
export const TREASURE_INTERVAL_MIN_SECONDS = 82;
export const TREASURE_INTERVAL_MAX_SECONDS = 118;

export function energyNeededForLevel(level: number): number {
    const normalizedLevel = Math.max(1, Math.floor(level));
    return LEVEL_ENERGY_BASE + (normalizedLevel - 1) * LEVEL_ENERGY_STEP;
}

export function bladeCountForLevel(level: number): number {
    return Math.max(0, Math.min(BLADE_CAROUSEL_MAX_LEVEL, Math.floor(level)));
}

export function bladeOrbitRadius(level: number): number {
    const count = bladeCountForLevel(level);
    return count === 0 ? 0 : 38 + (count - 1) * 3;
}

export function bladeOrbitSpeed(level: number): number {
    return 2.45 + bladeCountForLevel(level) * 0.1;
}

export function bladeOrbitAngle(elapsed: number, index: number, level: number): number {
    const count = bladeCountForLevel(level);
    if (count === 0) return 0;
    return elapsed * bladeOrbitSpeed(level) + (index / count) * Math.PI * 2;
}

export const ENEMY_LEVEL_GATES = {
    skitter: 1,
    brute: 3,
    wisp: 4,
    spinner: 5,
    gunner: 6,
    sniper: 7,
    splitter: 8,
    mine_layer: 9,
    charger: 10,
    siren: 11,
    crusher: 12,
} as const;

export const TOTAL_ENEMY_TYPES = Object.keys(ENEMY_LEVEL_GATES).length;

export type UpgradeId =
    | "hot_coils"
    | "split_shot"
    | "hook_blade"
    | "scrap_moon"
    | "static_bloom"
    | "scrap_bomb"
    | "arc_chain"
    | "flux_magnet"
    | "patch_kit"
    | "turbo_boots"
    | "plated_jacket"
    | "lucky_cache"
    | "flux_battery"
    | "dash_drive";

export interface UpgradeDefinition {
    id: UpgradeId;
    name: string;
    description: (nextLevel: number) => string;
    accent: string;
    weaponLabel?: string;
    icon:
        | "bolt"
        | "split"
        | "hook"
        | "blade"
        | "star"
        | "bomb"
        | "arc"
        | "magnet"
        | "heart"
        | "boot"
        | "shield"
        | "gift"
        | "battery"
        | "dash";
    maxLevel: number;
}

export const UPGRADES: Readonly<Record<UpgradeId, UpgradeDefinition>> = {
    hot_coils: {
        id: "hot_coils",
        name: "HOT COILS",
        description: (level) => `Blaster damage +${level === 1 ? 35 : 22}%`,
        accent: "#ff6b88",
        weaponLabel: "AUTO BLASTER · DAMAGE",
        icon: "bolt",
        maxLevel: 5,
    },
    split_shot: {
        id: "split_shot",
        name: "SPLIT SHOT",
        description: (level) => (level === 1 ? "Adds a second ice bolt" : "Faster fire and wider spread"),
        accent: "#6ff7ff",
        weaponLabel: "AUTO BLASTER · EXTRA BOLTS",
        icon: "split",
        maxLevel: 5,
    },
    hook_blade: {
        id: "hook_blade",
        name: "HOOK BLADE",
        description: (level) => (level === 1 ? "Launches a returning neon blade" : "More blades, speed, and damage"),
        accent: "#b9ff4a",
        weaponLabel: "RETURNING HOOK BLADE",
        icon: "hook",
        maxLevel: 5,
    },
    scrap_moon: {
        id: "scrap_moon",
        name: "BLADE CAROUSEL",
        description: (level) =>
            level === 1 ? "Adds the first rotating scrap sword" : `${level} rotating swords · new shape and color`,
        accent: "#9b8cff",
        weaponLabel: "ROTATING SWORDS",
        icon: "blade",
        maxLevel: BLADE_CAROUSEL_MAX_LEVEL,
    },
    static_bloom: {
        id: "static_bloom",
        name: "STATIC BLOOM",
        description: (level) => (level === 1 ? "Fires a radial starburst" : "More star bolts and faster bursts"),
        accent: "#ff85dc",
        weaponLabel: "RADIAL STAR BURST",
        icon: "star",
        maxLevel: 5,
    },
    scrap_bomb: {
        id: "scrap_bomb",
        name: "SCRAP BOMB",
        description: (level) =>
            level === 1 ? "Lobs a junk bomb with a wide blast" : "Bigger, faster, harder explosions",
        accent: "#ff9c38",
        weaponLabel: "LOB BOMB",
        icon: "bomb",
        maxLevel: 5,
    },
    arc_chain: {
        id: "arc_chain",
        name: "ARC CHAIN",
        description: (level) =>
            level === 1 ? "Lightning jumps through nearby monsters" : `Chains through ${2 + level} targets`,
        accent: "#6ff7ff",
        weaponLabel: "CHAIN LIGHTNING",
        icon: "arc",
        maxLevel: 5,
    },
    flux_magnet: {
        id: "flux_magnet",
        name: "FLUX MAGNET",
        description: () => `Coin magnet radius +${PICKUP_RADIUS_PER_MAGNET_LEVEL} and stronger pull`,
        accent: "#f6d36b",
        icon: "magnet",
        maxLevel: 4,
    },
    patch_kit: {
        id: "patch_kit",
        name: "PATCH KIT",
        description: () => "Max integrity +1 and repair 3",
        accent: "#ff567b",
        icon: "heart",
        maxLevel: 4,
    },
    turbo_boots: {
        id: "turbo_boots",
        name: "TURBO BOOTS",
        description: (level) => `Move speed +${level * 10}%`,
        accent: "#6ff7ff",
        icon: "boot",
        maxLevel: 5,
    },
    plated_jacket: {
        id: "plated_jacket",
        name: "PLATED JACKET",
        description: (level) => (level === 1 ? "Gain 1 integrity and soften hits" : "More armor and +1 integrity"),
        accent: "#9b8cff",
        icon: "shield",
        maxLevel: 4,
    },
    lucky_cache: {
        id: "lucky_cache",
        name: "LUCKY CACHE",
        description: () => "Reward caches arrive sooner and pay more",
        accent: "#f6d36b",
        icon: "gift",
        maxLevel: 4,
    },
    flux_battery: {
        id: "flux_battery",
        name: "FLUX BATTERY",
        description: (level) => `Energy gain +${level * 15}%`,
        accent: "#b9ff4a",
        icon: "battery",
        maxLevel: 4,
    },
    dash_drive: {
        id: "dash_drive",
        name: "DASH DRIVE",
        description: () => "Burst recharges faster and travels farther",
        accent: "#ff85dc",
        icon: "dash",
        maxLevel: 4,
    },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
