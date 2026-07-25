import { ENEMY_LEVEL_GATES, type UpgradeId } from "./config.ts";

export type RunPhase = "idle" | "running" | "upgrade" | "paused" | "defeat";
export type EnemyKind = keyof typeof ENEMY_LEVEL_GATES;
export type ProjectileKind = "blaster" | "hook" | "star" | "bomb";
export type PowerupKind = "overdrive" | "repair" | "vacuum" | "shield" | "frenzy" | "freeze" | "nova" | "jackpot";
export type HazardKind = "bolt" | "sniper" | "mine" | "pulse";

export interface PlayerState {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    invulnerableFor: number;
    dashFor: number;
    dashCooldown: number;
    facingX: number;
    facingY: number;
}

export interface EnemyState {
    id: number;
    kind: EnemyKind;
    x: number;
    y: number;
    radius: number;
    hp: number;
    maxHp: number;
    speed: number;
    contactDamage: number;
    horde: boolean;
    hitFlash: number;
    touchCooldown: number;
    orbitCooldown: number;
    attackCooldown: number;
    chargeCooldown: number;
    chargeFor: number;
    chargeX: number;
    chargeY: number;
}

export interface ProjectileState {
    id: number;
    kind: ProjectileKind;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    damage: number;
    life: number;
    maxLife: number;
    pierce: number;
    turned: boolean;
    hitIds: number[];
}

export interface HazardState {
    id: number;
    kind: HazardKind;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    damage: number;
    life: number;
    maxLife: number;
}

export interface PickupState {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    value: number;
    phase: number;
    age: number;
}

export interface PowerupState {
    id: number;
    kind: PowerupKind;
    x: number;
    y: number;
    phase: number;
    life: number;
}

export interface TreasureState {
    id: number;
    kind: PowerupKind;
    x: number;
    y: number;
    phase: number;
    life: number;
}

export interface ActiveEffects {
    overdrive: number;
    vacuum: number;
    shield: number;
    frenzy: number;
    freeze: number;
}

export interface UpgradeOffer {
    id: UpgradeId;
    nextLevel: number;
}

export interface CoreSnapshot {
    phase: RunPhase;
    player: Readonly<PlayerState>;
    enemies: readonly Readonly<EnemyState>[];
    projectiles: readonly Readonly<ProjectileState>[];
    hazards: readonly Readonly<HazardState>[];
    pickups: readonly Readonly<PickupState>[];
    powerups: readonly Readonly<PowerupState>[];
    treasures: readonly Readonly<TreasureState>[];
    upgrades: Readonly<Record<UpgradeId, number>>;
    upgradeOffers: readonly Readonly<UpgradeOffer>[];
    elapsed: number;
    score: number;
    scrap: number;
    kills: number;
    level: number;
    energy: number;
    energyNeeded: number;
    wave: number;
    dashReady: boolean;
    dashProgress: number;
    waveProgress: number;
    combo: number;
    maxCombo: number;
    comboProgress: number;
    scoreMultiplier: number;
    cacheProgress: number;
    cacheNeeded: number;
    cachesOpened: number;
    treasuresOpened: number;
    activeEffects: Readonly<ActiveEffects>;
    pickupRadius: number;
    unlockedEnemies: readonly EnemyKind[];
    nextThreatLevel: number | null;
    hordeActive: boolean;
    hordeNumber: number;
    hordeProgress: number;
    nextHordeIn: number;
}

export type GameEvent =
    | { type: "shot"; x: number; y: number }
    | { type: "hit"; x: number; y: number; heavy: boolean }
    | { type: "enemy_down"; x: number; y: number; kind: EnemyKind }
    | { type: "pickup"; x: number; y: number; value: number }
    | { type: "powerup"; x: number; y: number; kind: PowerupKind; label: string }
    | { type: "cache_reward"; x: number; y: number; kind: PowerupKind; cache: number }
    | { type: "treasure_discovered"; x: number; y: number; kind: PowerupKind }
    | { type: "treasure_collected"; x: number; y: number; kind: PowerupKind; label: string; treasure: number }
    | { type: "explosion"; x: number; y: number; radius: number }
    | { type: "arc_chain"; points: readonly { x: number; y: number }[] }
    | { type: "enemy_shot"; x: number; y: number }
    | { type: "combo"; count: number; multiplier: number }
    | { type: "threat_unlocked"; kind: EnemyKind; level: number }
    | { type: "horde_warning"; horde: number; seconds: number }
    | { type: "horde_started"; horde: number }
    | { type: "horde_ended"; horde: number }
    | { type: "player_hurt"; hp: number }
    | { type: "dash"; x: number; y: number }
    | { type: "level_up"; level: number }
    | { type: "upgrade_chosen"; id: UpgradeId; level: number }
    | { type: "run_end"; outcome: "defeat"; score: number };
