import {
    BASE_PICKUP_RADIUS,
    BASE_PLAYER_SPEED,
    CACHE_KILLS_BASE,
    COMBO_WINDOW_SECONDS,
    DAMAGE_INVULNERABILITY_SECONDS,
    ENEMY_DAMAGE_BONUS_CAP,
    ENEMY_DAMAGE_STEP_SECONDS,
    ENEMY_FORWARD_SPAWN_CHANCE,
    ENEMY_LEVEL_GATES,
    ENEMY_PROJECTILE_SPEED_END,
    ENEMY_PROJECTILE_SPEED_START,
    ENEMY_SPAWN_DISTANCE_MAX,
    ENEMY_SPAWN_DISTANCE_MIN,
    ENEMY_SPEED_RAMP_CAP,
    FIRST_TREASURE_DELAY_SECONDS,
    HORDE_DURATION_SECONDS,
    HORDE_FIRST_SECONDS,
    HORDE_INTERVAL_SECONDS,
    HORDE_WARNING_SECONDS,
    MAX_ACTIVE_ENEMIES,
    MAX_ACTIVE_HAZARDS,
    MAX_ACTIVE_PICKUPS,
    MAX_PLAYER_INTEGRITY,
    PICKUP_LIFETIME_SECONDS,
    PICKUP_RADIUS_PER_MAGNET_LEVEL,
    REPAIR_HEAL,
    SHIELD_BLOCKS,
    STARTING_PLAYER_INTEGRITY,
    SURVIVAL_RAMP_SECONDS,
    TREASURE_INTERVAL_MAX_SECONDS,
    TREASURE_INTERVAL_MIN_SECONDS,
    TREASURE_REPAIR_HEAL,
    TREASURE_SHIELD_BLOCKS,
    UPGRADE_IDS,
    UPGRADES,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    bladeCountForLevel,
    bladeOrbitAngle,
    bladeOrbitRadius,
    energyNeededForLevel,
    type UpgradeId,
} from "./config.ts";
import type {
    ActiveEffects,
    CoreSnapshot,
    EnemyKind,
    EnemyState,
    GameEvent,
    HazardKind,
    HazardState,
    PickupState,
    PlayerState,
    PowerupKind,
    PowerupState,
    ProjectileState,
    RunPhase,
    TreasureState,
    UpgradeOffer,
} from "./types.ts";

const TAU = Math.PI * 2;
const BASE_DASH_COOLDOWN = 1.8;
const ENEMY_SPAWN_WEIGHTS: readonly [EnemyKind, number][] = [
    ["skitter", 28],
    ["brute", 16],
    ["wisp", 13],
    ["spinner", 10],
    ["gunner", 11],
    ["sniper", 8],
    ["splitter", 8],
    ["mine_layer", 7],
    ["charger", 7],
    ["siren", 5],
    ["crusher", 3],
];

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

function normalized(x: number, y: number): { x: number; y: number } {
    const length = Math.hypot(x, y);
    if (length < 0.0001) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
}

function createUpgradeLevels(): Record<UpgradeId, number> {
    return {
        hot_coils: 0,
        split_shot: 0,
        hook_blade: 0,
        scrap_moon: 0,
        static_bloom: 0,
        scrap_bomb: 0,
        arc_chain: 0,
        flux_magnet: 0,
        patch_kit: 0,
        turbo_boots: 0,
        plated_jacket: 0,
        lucky_cache: 0,
        flux_battery: 0,
        dash_drive: 0,
    };
}

function createEffects(): ActiveEffects {
    return {
        overdrive: 0,
        vacuum: 0,
        shield: 0,
        frenzy: 0,
        freeze: 0,
    };
}

export class GameCore {
    private seed = 0x51c8a3d2;
    private nextId = 1;
    private phase: RunPhase = "idle";
    private player: PlayerState = this.createPlayer();
    private enemies: EnemyState[] = [];
    private projectiles: ProjectileState[] = [];
    private hazards: HazardState[] = [];
    private pickups: PickupState[] = [];
    private powerups: PowerupState[] = [];
    private treasures: TreasureState[] = [];
    private upgrades = createUpgradeLevels();
    private effects = createEffects();
    private upgradeOffers: UpgradeOffer[] = [];
    private events: GameEvent[] = [];
    private elapsed = 0;
    private score = 0;
    private scrap = 0;
    private kills = 0;
    private level = 1;
    private energy = 0;
    private energyNeeded = energyNeededForLevel(1);
    private spawnTimer = 0;
    private blasterTimer = 0;
    private hookTimer = 0;
    private bloomTimer = 0;
    private bombTimer = 0;
    private arcTimer = 0;
    private inputX = 0;
    private inputY = 0;
    private dashRequested = false;
    private combo = 0;
    private maxCombo = 0;
    private comboTimer = 0;
    private killsTowardCache = 0;
    private cachesOpened = 0;
    private treasuresOpened = 0;
    private treasureTimer = FIRST_TREASURE_DELAY_SECONDS;
    private hordeNumber = 0;
    private hordeFor = 0;
    private nextHordeAt = HORDE_FIRST_SECONDS;
    private hordeWarningSent = false;

    reset(seed = 0x51c8a3d2): void {
        this.seed = seed >>> 0 || 1;
        this.nextId = 1;
        this.phase = "running";
        this.player = this.createPlayer();
        this.enemies = [];
        this.projectiles = [];
        this.hazards = [];
        this.pickups = [];
        this.powerups = [];
        this.treasures = [];
        this.upgrades = createUpgradeLevels();
        this.effects = createEffects();
        this.upgradeOffers = [];
        this.events = [];
        this.elapsed = 0;
        this.score = 0;
        this.scrap = 0;
        this.kills = 0;
        this.level = 1;
        this.energy = 0;
        this.energyNeeded = energyNeededForLevel(1);
        this.spawnTimer = 0.2;
        this.blasterTimer = 0.06;
        this.hookTimer = 0;
        this.bloomTimer = 0;
        this.bombTimer = 0;
        this.arcTimer = 0;
        this.inputX = 0;
        this.inputY = 0;
        this.dashRequested = false;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.killsTowardCache = 0;
        this.cachesOpened = 0;
        this.treasuresOpened = 0;
        this.treasureTimer = FIRST_TREASURE_DELAY_SECONDS;
        this.hordeNumber = 0;
        this.hordeFor = 0;
        this.nextHordeAt = HORDE_FIRST_SECONDS;
        this.hordeWarningSent = false;
        for (let index = 0; index < 9; index += 1) this.spawnEnemy("skitter", 105 + index * 16);
    }

    setMovement(x: number, y: number): void {
        const length = Math.hypot(x, y);
        const scale = length > 1 ? 1 / length : 1;
        this.inputX = x * scale;
        this.inputY = y * scale;
        if (length > 0.05) {
            const direction = normalized(x, y);
            this.player.facingX = direction.x;
            this.player.facingY = direction.y;
        }
    }

    requestDash(): void {
        this.dashRequested = true;
    }

    pause(): void {
        if (this.phase === "running") this.phase = "paused";
    }

    resume(): void {
        if (this.phase === "paused") this.phase = "running";
    }

    forceResults(): void {
        if (this.phase === "running" || this.phase === "paused" || this.phase === "upgrade") {
            this.finishRun("defeat");
        }
    }

    forceUpgrade(): void {
        if (this.phase !== "running") return;
        this.energy = Math.max(this.energy, this.energyNeeded);
        this.checkLevelUp();
    }

    forcePowerup(kind: PowerupKind = "overdrive", distance = 72, angle = 0): void {
        if (this.phase !== "running") return;
        this.spawnPowerup(
            kind,
            this.player.x + Math.cos(angle) * distance,
            this.player.y + Math.sin(angle) * distance,
            false,
        );
    }

    forceEnemy(kind: EnemyKind = "skitter", distance = 140, angle = 0): void {
        if (this.phase !== "running") return;
        this.spawnEnemyAt(kind, this.player.x + Math.cos(angle) * distance, this.player.y + Math.sin(angle) * distance);
    }

    forceHorde(): void {
        if (this.phase !== "running") return;
        this.startHorde();
    }

    forceHazard(kind: HazardKind = "bolt", distance = 90, angle = 0): void {
        if (this.phase !== "running") return;
        const speed = kind === "sniper" ? 330 : kind === "pulse" ? 165 : kind === "bolt" ? 210 : 0;
        const life = kind === "mine" ? 6 : 2.5;
        this.spawnHazard({
            id: this.nextId++,
            kind,
            x: this.player.x + Math.cos(angle) * distance,
            y: this.player.y + Math.sin(angle) * distance,
            vx: -Math.cos(angle) * speed,
            vy: -Math.sin(angle) * speed,
            radius: kind === "mine" ? 13 : kind === "bolt" ? 5 : 4,
            damage: kind === "sniper" || kind === "mine" ? 2 : 1,
            life,
            maxLife: life,
        });
    }

    forceBladeLevel(level: number): void {
        if (this.phase !== "running") return;
        this.upgrades.scrap_moon = bladeCountForLevel(level);
    }

    forcePerformanceStress(): void {
        if (this.phase !== "running") return;
        this.level = 12;
        this.energy = 0;
        this.energyNeeded = energyNeededForLevel(this.level);
        this.effects.shield = 999;
        this.hordeNumber = Math.max(1, this.hordeNumber);
        this.hordeFor = HORDE_DURATION_SECONDS;
        this.spawnTimer = 999;
        this.upgrades.hot_coils = 5;
        this.upgrades.split_shot = 5;
        this.upgrades.hook_blade = 5;
        this.upgrades.scrap_moon = 8;
        this.upgrades.static_bloom = 5;
        this.upgrades.scrap_bomb = 5;
        this.upgrades.arc_chain = 5;

        const kinds = ENEMY_SPAWN_WEIGHTS.map(([kind]) => kind);
        while (this.enemies.length < MAX_ACTIVE_ENEMIES) {
            const index = this.enemies.length;
            const kind = kinds[index % kinds.length] ?? "skitter";
            const angle = (index / MAX_ACTIVE_ENEMIES) * TAU;
            const distance = 155 + (index % 5) * 34;
            this.spawnEnemyAt(
                kind,
                this.player.x + Math.cos(angle) * distance,
                this.player.y + Math.sin(angle) * distance,
                undefined,
                true,
            );
        }

        const hazardKinds: readonly HazardKind[] = ["bolt", "sniper", "mine", "pulse"];
        while (this.hazards.length < Math.min(MAX_ACTIVE_HAZARDS, 96)) {
            const index = this.hazards.length;
            const kind = hazardKinds[index % hazardKinds.length] ?? "bolt";
            this.forceHazard(kind, 92 + (index % 7) * 24, (index / 96) * TAU);
        }

        while (this.pickups.length < Math.min(MAX_ACTIVE_PICKUPS, 96)) {
            const index = this.pickups.length;
            const angle = (index / 96) * TAU;
            const distance = 80 + (index % 6) * 30;
            this.spawnPickup(
                this.player.x + Math.cos(angle) * distance,
                this.player.y + Math.sin(angle) * distance,
                index % 7 === 0 ? 3 : 1,
                0,
                0,
                angle,
            );
        }
    }

    forcePickup(distance = 150, value = 1): void {
        if (this.phase !== "running") return;
        this.spawnPickup(this.player.x + distance, this.player.y, value, 0, 0, 0);
    }

    forceTreasure(kind: PowerupKind = "overdrive", distance = 0): void {
        if (this.phase !== "running") return;
        this.spawnTreasure(kind, this.player.x + distance, this.player.y);
    }

    chooseUpgrade(index: number): boolean {
        if (this.phase !== "upgrade") return false;
        const offer = this.upgradeOffers[index];
        if (!offer) return false;
        this.upgrades[offer.id] = offer.nextLevel;
        if (offer.id === "patch_kit") {
            this.player.maxHp = Math.min(MAX_PLAYER_INTEGRITY, this.player.maxHp + 1);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + REPAIR_HEAL);
        } else if (offer.id === "plated_jacket") {
            this.player.maxHp = Math.min(MAX_PLAYER_INTEGRITY, this.player.maxHp + 1);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        }
        this.events.push({ type: "upgrade_chosen", id: offer.id, level: offer.nextLevel });
        this.upgradeOffers = [];
        this.phase = "running";
        return true;
    }

    update(rawDelta: number): void {
        if (this.phase !== "running") {
            this.dashRequested = false;
            return;
        }

        const delta = clamp(rawDelta, 0, 0.05);
        this.elapsed += delta;
        this.comboTimer = Math.max(0, this.comboTimer - delta);
        if (this.comboTimer <= 0) this.combo = 0;
        this.effects.overdrive = Math.max(0, this.effects.overdrive - delta);
        this.effects.vacuum = Math.max(0, this.effects.vacuum - delta);
        this.effects.frenzy = Math.max(0, this.effects.frenzy - delta);
        this.effects.freeze = Math.max(0, this.effects.freeze - delta);
        this.updateHordeSchedule(delta);

        this.updatePlayer(delta);
        this.updateWeapons(delta);
        this.updateProjectiles(delta);
        this.updateEnemies(delta);
        if (this.phase !== "running") return;
        this.updateHazards(delta);
        if (this.phase !== "running") return;
        this.updatePickups(delta);
        this.updatePowerups(delta);
        this.updateTreasures(delta);
        this.removeDefeatedEnemies();

        this.treasureTimer -= delta;
        if (this.treasureTimer <= 0 && this.treasures.length < 1) {
            this.spawnTreasure();
            this.treasureTimer =
                TREASURE_INTERVAL_MIN_SECONDS +
                this.random() * (TREASURE_INTERVAL_MAX_SECONDS - TREASURE_INTERVAL_MIN_SECONDS);
        }

        this.spawnTimer -= delta;
        const hordeSpawnMultiplier = this.hordeFor > 0 ? 0.65 : 1;
        const spawnInterval = Math.max(0.105, 0.52 - this.elapsed * 0.00225) * hordeSpawnMultiplier;
        while (this.spawnTimer <= 0 && this.enemies.length < MAX_ACTIVE_ENEMIES) {
            const batch = this.hordeFor > 0 ? Math.min(3, 2 + Math.floor(this.hordeNumber / 5)) : 1;
            for (let index = 0; index < batch && this.enemies.length < MAX_ACTIVE_ENEMIES; index += 1) {
                this.spawnEnemy(this.chooseEnemyKind(), undefined, this.hordeFor > 0);
            }
            this.spawnTimer += spawnInterval;
        }
        this.checkLevelUp();
    }

    snapshot(): CoreSnapshot {
        const cacheNeeded = this.cacheNeeded();
        const dashCooldown = this.dashCooldownDuration();
        return {
            phase: this.phase,
            player: this.player,
            enemies: this.enemies,
            projectiles: this.projectiles,
            hazards: this.hazards,
            pickups: this.pickups,
            powerups: this.powerups,
            treasures: this.treasures,
            upgrades: this.upgrades,
            upgradeOffers: this.upgradeOffers,
            elapsed: this.elapsed,
            score: this.score,
            scrap: this.scrap,
            kills: this.kills,
            level: this.level,
            energy: this.energy,
            energyNeeded: this.energyNeeded,
            wave: 1 + Math.floor(this.elapsed / 30),
            dashReady: this.player.dashCooldown <= 0,
            dashProgress: clamp(1 - this.player.dashCooldown / dashCooldown, 0, 1),
            waveProgress: clamp((this.elapsed % 30) / 30, 0, 1),
            combo: this.combo,
            maxCombo: this.maxCombo,
            comboProgress: clamp(this.comboTimer / COMBO_WINDOW_SECONDS, 0, 1),
            scoreMultiplier: this.scoreMultiplier(),
            cacheProgress: clamp(this.killsTowardCache / cacheNeeded, 0, 1),
            cacheNeeded,
            cachesOpened: this.cachesOpened,
            treasuresOpened: this.treasuresOpened,
            activeEffects: this.effects,
            pickupRadius: this.basePickupRadius(),
            unlockedEnemies: this.unlockedEnemies(),
            nextThreatLevel: this.nextThreatLevel(),
            hordeActive: this.hordeFor > 0,
            hordeNumber: this.hordeNumber,
            hordeProgress: clamp(this.hordeFor / HORDE_DURATION_SECONDS, 0, 1),
            nextHordeIn: Math.max(0, this.nextHordeAt - this.elapsed),
        };
    }

    drainEvents(): GameEvent[] {
        const drained = this.events;
        this.events = [];
        return drained;
    }

    private createPlayer(): PlayerState {
        return {
            x: WORLD_WIDTH / 2,
            y: WORLD_HEIGHT / 2,
            hp: STARTING_PLAYER_INTEGRITY,
            maxHp: STARTING_PLAYER_INTEGRITY,
            invulnerableFor: 0,
            dashFor: 0,
            dashCooldown: 0,
            facingX: 1,
            facingY: 0,
        };
    }

    private random(): number {
        let value = this.seed;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.seed = value >>> 0;
        return this.seed / 0x1_0000_0000;
    }

    private updateHordeSchedule(delta: number): void {
        if (this.hordeFor > 0) {
            const previous = this.hordeFor;
            this.hordeFor = Math.max(0, this.hordeFor - delta);
            if (previous > 0 && this.hordeFor === 0) {
                this.events.push({ type: "horde_ended", horde: this.hordeNumber });
            }
        }
        if (!this.hordeWarningSent && this.elapsed >= this.nextHordeAt - HORDE_WARNING_SECONDS) {
            this.hordeWarningSent = true;
            this.events.push({
                type: "horde_warning",
                horde: this.hordeNumber + 1,
                seconds: HORDE_WARNING_SECONDS,
            });
        }
        if (this.elapsed < this.nextHordeAt) return;
        this.startHorde();
        this.nextHordeAt = this.elapsed + HORDE_INTERVAL_SECONDS;
        this.hordeWarningSent = false;
    }

    private startHorde(): void {
        if (this.hordeFor > 0) return;
        this.hordeNumber += 1;
        this.hordeFor = HORDE_DURATION_SECONDS;
        const count = Math.min(30, 16 + this.hordeNumber * 3);
        for (let index = 0; index < count && this.enemies.length < MAX_ACTIVE_ENEMIES; index += 1) {
            const angle = (index / count) * TAU + this.random() * 0.16;
            const distance = 250 + this.random() * 68;
            this.spawnEnemyAt(
                this.chooseEnemyKind(),
                this.player.x + Math.cos(angle) * distance,
                this.player.y + Math.sin(angle) * distance,
                1 + this.elapsed / 190 + 0.35 + this.hordeNumber * 0.08,
                true,
            );
        }
        this.spawnTimer = Math.min(this.spawnTimer, 0.06);
        this.events.push({ type: "horde_started", horde: this.hordeNumber });
    }

    private updatePlayer(delta: number): void {
        const player = this.player;
        player.invulnerableFor = Math.max(0, player.invulnerableFor - delta);
        player.dashCooldown = Math.max(0, player.dashCooldown - delta);
        player.dashFor = Math.max(0, player.dashFor - delta);

        if (this.dashRequested && player.dashCooldown <= 0 && Math.abs(this.inputX) + Math.abs(this.inputY) > 0.1) {
            player.dashFor = 0.19 + this.upgrades.dash_drive * 0.018;
            player.dashCooldown = this.dashCooldownDuration();
            player.invulnerableFor = Math.max(player.invulnerableFor, 0.3);
            this.events.push({ type: "dash", x: player.x, y: player.y });
        }
        this.dashRequested = false;

        const overdrive = this.effects.overdrive > 0 ? 1.24 : 1;
        const baseSpeed = BASE_PLAYER_SPEED * (1 + this.upgrades.turbo_boots * 0.1) * overdrive;
        const dashSpeed = 315 + this.upgrades.dash_drive * 24;
        const speed = player.dashFor > 0 ? dashSpeed : baseSpeed;
        player.x += this.inputX * speed * delta;
        player.y += this.inputY * speed * delta;
    }

    private dashCooldownDuration(): number {
        return Math.max(0.9, BASE_DASH_COOLDOWN - this.upgrades.dash_drive * 0.17);
    }

    private updateWeapons(delta: number): void {
        const overdrive = this.effects.overdrive > 0 ? 0.66 : 1;
        const frenzy = this.effects.frenzy > 0 ? 0.54 : 1;
        const cadenceBoost = overdrive * frenzy;
        const damageBoost = (this.effects.overdrive > 0 ? 1.35 : 1) * (this.effects.frenzy > 0 ? 1.22 : 1);

        this.blasterTimer -= delta;
        const rapidLevel = this.upgrades.split_shot;
        const fireInterval = Math.max(0.085, 0.4 - rapidLevel * 0.047) * cadenceBoost;
        while (this.blasterTimer <= 0) {
            this.fireBlaster(damageBoost);
            this.blasterTimer += fireInterval;
        }

        const hookLevel = this.upgrades.hook_blade;
        if (hookLevel > 0) {
            this.hookTimer -= delta;
            if (this.hookTimer <= 0) {
                const count = 1 + Math.floor((hookLevel - 1) / 2);
                for (let index = 0; index < count; index += 1) {
                    const angle = (index - (count - 1) / 2) * 0.24;
                    this.fireHook(angle, hookLevel, damageBoost);
                }
                this.hookTimer = Math.max(0.58, 1.55 - hookLevel * 0.15) * cadenceBoost;
            }
        }

        const bloomLevel = this.upgrades.static_bloom;
        if (bloomLevel > 0) {
            this.bloomTimer -= delta;
            if (this.bloomTimer <= 0) {
                const count = 6 + bloomLevel * 2;
                for (let index = 0; index < count; index += 1) {
                    const angle = (index / count) * TAU + this.elapsed * 0.85;
                    this.spawnProjectile("star", angle, 145, (3.4 + bloomLevel * 0.9) * damageBoost, 1.55, 0);
                }
                this.bloomTimer = Math.max(0.9, 2.75 - bloomLevel * 0.27) * cadenceBoost;
            }
        }

        const bombLevel = this.upgrades.scrap_bomb;
        if (bombLevel > 0) {
            this.bombTimer -= delta;
            if (this.bombTimer <= 0) {
                this.fireBomb(bombLevel, damageBoost);
                this.bombTimer = Math.max(1.15, 2.8 - bombLevel * 0.28) * cadenceBoost;
            }
        }

        const arcLevel = this.upgrades.arc_chain;
        if (arcLevel > 0) {
            this.arcTimer -= delta;
            if (this.arcTimer <= 0) {
                this.fireArc(arcLevel, damageBoost);
                this.arcTimer = Math.max(0.7, 2.25 - arcLevel * 0.2) * cadenceBoost;
            }
        }

        const bladeLevel = this.upgrades.scrap_moon;
        if (bladeLevel > 0) {
            const bladeCount = bladeCountForLevel(bladeLevel);
            const orbitRadius = bladeOrbitRadius(bladeLevel);
            for (const enemy of this.enemies) {
                enemy.orbitCooldown = Math.max(0, enemy.orbitCooldown - delta);
                if (enemy.orbitCooldown > 0) continue;
                for (let index = 0; index < bladeCount; index += 1) {
                    const angle = bladeOrbitAngle(this.elapsed, index, bladeLevel);
                    const bladeX = this.player.x + Math.cos(angle) * orbitRadius;
                    const bladeY = this.player.y + Math.sin(angle) * orbitRadius;
                    if (distanceSquared(bladeX, bladeY, enemy.x, enemy.y) <= (enemy.radius + 10) ** 2) {
                        this.damageEnemy(enemy, (4.4 + bladeLevel * 0.75) * damageBoost, true);
                        enemy.orbitCooldown = 0.24;
                        break;
                    }
                }
            }
        }
    }

    private fireBlaster(damageBoost: number): void {
        const target = this.closestEnemy();
        const aim = target
            ? normalized(target.x - this.player.x, target.y - this.player.y)
            : { x: this.player.facingX, y: this.player.facingY };
        if (!target && Math.abs(aim.x) + Math.abs(aim.y) < 0.1) return;
        const baseAngle = Math.atan2(aim.y, aim.x);
        const shotCount = 1 + Math.min(3, Math.floor((this.upgrades.split_shot + 1) / 2));
        for (let index = 0; index < shotCount; index += 1) {
            const spread = (index - (shotCount - 1) / 2) * 0.12;
            const damage = 5.4 * (1 + this.upgrades.hot_coils * 0.24) * damageBoost;
            this.spawnProjectile(
                "blaster",
                baseAngle + spread,
                215,
                damage,
                1.65,
                this.upgrades.hot_coils >= 4 ? 1 : 0,
            );
        }
        this.events.push({ type: "shot", x: this.player.x, y: this.player.y });
    }

    private fireHook(angleOffset: number, level: number, damageBoost: number): void {
        const target = this.closestEnemy();
        const aim = target
            ? normalized(target.x - this.player.x, target.y - this.player.y)
            : { x: this.player.facingX, y: this.player.facingY };
        const angle = Math.atan2(aim.y, aim.x) + angleOffset;
        this.spawnProjectile("hook", angle, 158 + level * 9, (7.5 + level * 2.5) * damageBoost, 1.95, 4 + level);
    }

    private fireBomb(level: number, damageBoost: number): void {
        const target = this.closestEnemy();
        const aim = target
            ? normalized(target.x - this.player.x, target.y - this.player.y)
            : { x: this.player.facingX, y: this.player.facingY };
        const angle = Math.atan2(aim.y, aim.x);
        this.spawnProjectile("bomb", angle, 92 + level * 6, (18 + level * 7) * damageBoost, 0.78, 0);
    }

    private fireArc(level: number, damageBoost: number): void {
        const first = this.closestEnemy();
        if (!first) return;
        const points = [{ x: this.player.x, y: this.player.y }];
        const hit = new Set<number>();
        let current: EnemyState | null = first;
        for (let index = 0; index < 2 + level && current; index += 1) {
            hit.add(current.id);
            points.push({ x: current.x, y: current.y });
            this.damageEnemy(current, (5.5 + level * 2.2) * damageBoost, true);
            let next: EnemyState | null = null;
            let nextDistance = (118 + level * 16) ** 2;
            for (const candidate of this.enemies) {
                if (candidate.hp <= 0 || hit.has(candidate.id)) continue;
                const distance = distanceSquared(current.x, current.y, candidate.x, candidate.y);
                if (distance < nextDistance) {
                    next = candidate;
                    nextDistance = distance;
                }
            }
            current = next;
        }
        if (points.length > 1) this.events.push({ type: "arc_chain", points });
    }

    private spawnProjectile(
        kind: ProjectileState["kind"],
        angle: number,
        speed: number,
        damage: number,
        life: number,
        pierce: number,
    ): void {
        this.projectiles.push({
            id: this.nextId++,
            kind,
            x: this.player.x + Math.cos(angle) * 10,
            y: this.player.y + Math.sin(angle) * 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: kind === "hook" ? 7 : kind === "bomb" ? 7 : kind === "star" ? 3 : 3.5,
            damage,
            life,
            maxLife: life,
            pierce,
            turned: false,
            hitIds: [],
        });
    }

    private updateProjectiles(delta: number): void {
        for (const projectile of this.projectiles) {
            projectile.life -= delta;
            if (projectile.kind === "bomb") {
                projectile.vx *= Math.pow(0.2, delta);
                projectile.vy *= Math.pow(0.2, delta);
                projectile.x += projectile.vx * delta;
                projectile.y += projectile.vy * delta;
                if (projectile.life <= 0) {
                    const radius = 58 + this.upgrades.scrap_bomb * 8;
                    this.explode(projectile.x, projectile.y, radius, projectile.damage);
                }
                continue;
            }
            if (projectile.kind === "hook" && !projectile.turned && projectile.life <= projectile.maxLife * 0.52) {
                const speed = Math.hypot(projectile.vx, projectile.vy);
                const home = normalized(this.player.x - projectile.x, this.player.y - projectile.y);
                projectile.vx = home.x * speed;
                projectile.vy = home.y * speed;
                projectile.turned = true;
                projectile.hitIds = [];
            }
            projectile.x += projectile.vx * delta;
            projectile.y += projectile.vy * delta;
            for (const enemy of this.enemies) {
                if (enemy.hp <= 0 || projectile.hitIds.includes(enemy.id)) continue;
                const hitRadius = projectile.radius + enemy.radius;
                if (distanceSquared(projectile.x, projectile.y, enemy.x, enemy.y) > hitRadius * hitRadius) continue;
                projectile.hitIds.push(enemy.id);
                this.damageEnemy(enemy, projectile.damage, projectile.kind === "hook");
                projectile.pierce -= 1;
                if (projectile.pierce < 0) {
                    projectile.life = 0;
                    break;
                }
            }
        }
        this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
    }

    private explode(x: number, y: number, radius: number, damage: number): void {
        const radiusSquared = radius * radius;
        for (const enemy of this.enemies) {
            const distance = distanceSquared(x, y, enemy.x, enemy.y);
            if (distance > radiusSquared) continue;
            const falloff = 1 - Math.sqrt(distance) / radius;
            this.damageEnemy(enemy, damage * (0.65 + falloff * 0.35), true);
        }
        this.events.push({ type: "explosion", x, y, radius });
    }

    private updateEnemies(delta: number): void {
        for (const enemy of this.enemies) {
            enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
            enemy.touchCooldown = Math.max(0, enemy.touchCooldown - delta);
            enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
            enemy.chargeCooldown = Math.max(0, enemy.chargeCooldown - delta);
            enemy.chargeFor = Math.max(0, enemy.chargeFor - delta);
            if (enemy.hp <= 0) continue;

            const toward = normalized(this.player.x - enemy.x, this.player.y - enemy.y);
            const playerDistance = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
            let dx = toward.x;
            let dy = toward.y;
            let speed = enemy.speed * this.enemySpeedMultiplier() * (this.effects.freeze > 0 ? 0.58 : 1);

            if (enemy.kind === "spinner") {
                const turn = enemy.id % 2 === 0 ? 1 : -1;
                if (playerDistance < 112) {
                    dx = -toward.x;
                    dy = -toward.y;
                } else if (playerDistance < 190) {
                    dx = -toward.y * turn;
                    dy = toward.x * turn;
                    speed *= 0.86;
                }
                if (enemy.attackCooldown <= 0 && playerDistance < 330) {
                    this.fireRadialBurst(enemy, 6, "pulse", 142, 1);
                    enemy.attackCooldown = 1.85 + this.random() * 0.5;
                }
            } else if (enemy.kind === "gunner") {
                if (playerDistance < 125) {
                    dx = -toward.x;
                    dy = -toward.y;
                } else if (playerDistance < 195) {
                    dx = -toward.y;
                    dy = toward.x;
                    speed *= 0.72;
                }
                if (enemy.attackCooldown <= 0 && playerDistance < 340) {
                    this.fireEnemyBolt(enemy, toward);
                    enemy.attackCooldown = 1.1 + this.random() * 0.45;
                }
            } else if (enemy.kind === "sniper") {
                if (playerDistance < 220) {
                    dx = -toward.x;
                    dy = -toward.y;
                } else if (playerDistance < 350) {
                    const turn = enemy.id % 2 === 0 ? 1 : -1;
                    dx = -toward.y * turn;
                    dy = toward.x * turn;
                    speed *= 0.62;
                } else {
                    speed *= 0.72;
                }
                if (enemy.attackCooldown <= 0 && playerDistance < 510) {
                    this.fireSniperShot(enemy, toward);
                    enemy.attackCooldown = 2.1 + this.random() * 0.55;
                }
            } else if (enemy.kind === "mine_layer") {
                const turn = enemy.id % 2 === 0 ? 1 : -1;
                if (playerDistance < 105) {
                    dx = -toward.x;
                    dy = -toward.y;
                } else if (playerDistance < 220) {
                    dx = -toward.y * turn;
                    dy = toward.x * turn;
                    speed *= 0.76;
                }
                if (enemy.attackCooldown <= 0 && playerDistance < 330) {
                    this.dropMine(enemy);
                    enemy.attackCooldown = 2.55 + this.random() * 0.75;
                }
            } else if (enemy.kind === "charger") {
                if (enemy.chargeFor > 0) {
                    dx = enemy.chargeX;
                    dy = enemy.chargeY;
                    speed *= 4.1;
                } else if (enemy.chargeCooldown <= 0 && playerDistance < 310) {
                    enemy.chargeFor = 0.56;
                    enemy.chargeCooldown = 3.1 + this.random() * 0.7;
                    enemy.chargeX = toward.x;
                    enemy.chargeY = toward.y;
                    this.events.push({ type: "enemy_shot", x: enemy.x, y: enemy.y });
                }
            } else if (enemy.kind === "siren") {
                const turn = enemy.id % 2 === 0 ? 1 : -1;
                if (playerDistance < 130) {
                    dx = -toward.x;
                    dy = -toward.y;
                } else if (playerDistance < 215) {
                    dx = -toward.y * turn;
                    dy = toward.x * turn;
                    speed *= 0.68;
                }
                if (enemy.attackCooldown <= 0 && playerDistance < 360) {
                    this.fireRadialBurst(enemy, 10, "pulse", 172, 1);
                    enemy.attackCooldown = 3 + this.random() * 0.7;
                }
            } else if (enemy.kind === "wisp") {
                const wobble = Math.sin(this.elapsed * 6 + enemy.id) * 0.42;
                const cos = Math.cos(wobble);
                const sin = Math.sin(wobble);
                dx = toward.x * cos - toward.y * sin;
                dy = toward.x * sin + toward.y * cos;
            }

            enemy.x += dx * speed * delta;
            enemy.y += dy * speed * delta;

            const touchRadius = enemy.radius + 8;
            if (
                enemy.touchCooldown <= 0 &&
                this.player.invulnerableFor <= 0 &&
                distanceSquared(enemy.x, enemy.y, this.player.x, this.player.y) <= touchRadius * touchRadius
            ) {
                enemy.touchCooldown = 0.75;
                enemy.x -= toward.x * 16;
                enemy.y -= toward.y * 16;
                if (this.hurtPlayer(enemy.contactDamage)) return;
            }
        }
    }

    private fireEnemyBolt(enemy: EnemyState, direction: { x: number; y: number }): void {
        const progress = clamp(this.elapsed / SURVIVAL_RAMP_SECONDS, 0, 1);
        const speed =
            ENEMY_PROJECTILE_SPEED_START + (ENEMY_PROJECTILE_SPEED_END - ENEMY_PROJECTILE_SPEED_START) * progress;
        const leadSeconds = 0.28 + progress * 0.12;
        const targetX = this.player.x + this.inputX * BASE_PLAYER_SPEED * leadSeconds;
        const targetY = this.player.y + this.inputY * BASE_PLAYER_SPEED * leadSeconds;
        const aimedDirection = normalized(targetX - enemy.x, targetY - enemy.y);
        const shotDirection =
            Math.abs(aimedDirection.x) + Math.abs(aimedDirection.y) > 0.1 ? aimedDirection : direction;
        this.spawnHazard({
            kind: "bolt",
            id: this.nextId++,
            x: enemy.x,
            y: enemy.y,
            vx: shotDirection.x * speed,
            vy: shotDirection.y * speed,
            radius: 5,
            damage: 1 + this.enemyDamageBonus(),
            life: 3.5,
            maxLife: 3.5,
        });
        this.events.push({ type: "enemy_shot", x: enemy.x, y: enemy.y });
    }

    private fireSniperShot(enemy: EnemyState, fallback: { x: number; y: number }): void {
        const leadSeconds = 0.48;
        const targetX = this.player.x + this.inputX * BASE_PLAYER_SPEED * leadSeconds;
        const targetY = this.player.y + this.inputY * BASE_PLAYER_SPEED * leadSeconds;
        const aimed = normalized(targetX - enemy.x, targetY - enemy.y);
        const direction = Math.abs(aimed.x) + Math.abs(aimed.y) > 0.1 ? aimed : fallback;
        this.spawnHazard({
            id: this.nextId++,
            kind: "sniper",
            x: enemy.x,
            y: enemy.y,
            vx: direction.x * 330,
            vy: direction.y * 330,
            radius: 4,
            damage: 2 + this.enemyDamageBonus(),
            life: 2.4,
            maxLife: 2.4,
        });
        this.events.push({ type: "enemy_shot", x: enemy.x, y: enemy.y });
    }

    private fireRadialBurst(
        enemy: EnemyState,
        count: number,
        kind: HazardState["kind"],
        speed: number,
        baseDamage: number,
    ): void {
        const offset = this.elapsed * 0.7 + (enemy.id % 7) * 0.2;
        for (let index = 0; index < count; index += 1) {
            const angle = offset + (index / count) * TAU;
            this.spawnHazard({
                id: this.nextId++,
                kind,
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 4,
                damage: baseDamage + this.enemyDamageBonus(),
                life: 2.8,
                maxLife: 2.8,
            });
        }
        this.events.push({ type: "enemy_shot", x: enemy.x, y: enemy.y });
    }

    private dropMine(enemy: EnemyState): void {
        this.spawnHazard({
            id: this.nextId++,
            kind: "mine",
            x: enemy.x,
            y: enemy.y,
            vx: 0,
            vy: 0,
            radius: 13,
            damage: 2 + this.enemyDamageBonus(),
            life: 7,
            maxLife: 7,
        });
        this.events.push({ type: "enemy_shot", x: enemy.x, y: enemy.y });
    }

    private spawnHazard(hazard: HazardState): void {
        if (this.hazards.length >= MAX_ACTIVE_HAZARDS) return;
        this.hazards.push(hazard);
    }

    private updateHazards(delta: number): void {
        for (const hazard of this.hazards) {
            hazard.life -= delta;
            hazard.x += hazard.vx * delta;
            hazard.y += hazard.vy * delta;
            const armed = hazard.kind !== "mine" || hazard.life < hazard.maxLife - 0.55;
            if (
                hazard.life > 0 &&
                armed &&
                this.player.invulnerableFor <= 0 &&
                distanceSquared(hazard.x, hazard.y, this.player.x, this.player.y) <= (hazard.radius + 7) ** 2
            ) {
                hazard.life = 0;
                if (this.hurtPlayer(hazard.damage)) return;
            }
        }
        this.hazards = this.hazards.filter((hazard) => hazard.life > 0);
    }

    private hurtPlayer(rawDamage: number): boolean {
        if (this.effects.shield > 0) {
            this.effects.shield -= 1;
            this.player.invulnerableFor = 0.4;
            this.events.push({
                type: "powerup",
                x: this.player.x,
                y: this.player.y,
                kind: "shield",
                label: "SHIELD BLOCK",
            });
            return false;
        }
        const reduction = Math.ceil(this.upgrades.plated_jacket / 2);
        const damage = Math.max(1, Math.round(rawDamage) - reduction);
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.player.invulnerableFor = DAMAGE_INVULNERABILITY_SECONDS;
        this.events.push({ type: "player_hurt", hp: this.player.hp });
        if (this.player.hp <= 0) {
            this.finishRun("defeat");
            return true;
        }
        return false;
    }

    private updatePickups(delta: number): void {
        const baseMagnetRadius = this.basePickupRadius();
        for (const pickup of this.pickups) {
            pickup.phase += delta * 6;
            pickup.age += delta;
            const distance = Math.hypot(this.player.x - pickup.x, this.player.y - pickup.y);
            const mercyRadius = Math.min(100, Math.max(0, pickup.age - 4) * 16);
            const magnetRadius = this.effects.vacuum > 0 ? 900 : baseMagnetRadius + mercyRadius;
            if (distance < magnetRadius) {
                const direction = normalized(this.player.x - pickup.x, this.player.y - pickup.y);
                const pull = this.effects.vacuum > 0 ? 680 : 85 + (magnetRadius - distance) * 2.2;
                pickup.vx += direction.x * pull * delta;
                pickup.vy += direction.y * pull * delta;
            }
            pickup.vx *= Math.pow(0.09, delta);
            pickup.vy *= Math.pow(0.09, delta);
            pickup.x += pickup.vx * delta;
            pickup.y += pickup.vy * delta;
        }

        const collected: PickupState[] = [];
        this.pickups = this.pickups.filter((pickup) => {
            if (distanceSquared(pickup.x, pickup.y, this.player.x, this.player.y) <= 18 * 18) {
                collected.push(pickup);
                return false;
            }
            return pickup.age < PICKUP_LIFETIME_SECONDS;
        });
        for (const pickup of collected) {
            const energyValue = Math.max(1, Math.round(pickup.value * (1 + this.upgrades.flux_battery * 0.15)));
            this.energy += energyValue;
            this.scrap += pickup.value;
            this.score += Math.round(pickup.value * 3 * this.scoreMultiplier());
            this.events.push({ type: "pickup", x: pickup.x, y: pickup.y, value: pickup.value });
        }
    }

    private spawnPickup(x: number, y: number, value: number, vx: number, vy: number, phase: number): void {
        if (this.pickups.length >= MAX_ACTIVE_PICKUPS) this.pickups.shift();
        this.pickups.push({
            id: this.nextId++,
            x,
            y,
            vx,
            vy,
            value,
            phase,
            age: 0,
        });
    }

    private updatePowerups(delta: number): void {
        for (const powerup of this.powerups) {
            powerup.phase += delta * 3.2;
            powerup.life -= delta;
            const distance = Math.hypot(this.player.x - powerup.x, this.player.y - powerup.y);
            if (distance < 170 || this.effects.vacuum > 0) {
                const direction = normalized(this.player.x - powerup.x, this.player.y - powerup.y);
                const pull = this.effects.vacuum > 0 ? 620 : 105 + Math.max(0, 170 - distance) * 1.15;
                powerup.x += direction.x * pull * delta;
                powerup.y += direction.y * pull * delta;
            }
        }
        const collected: PowerupState[] = [];
        this.powerups = this.powerups.filter((powerup) => {
            if (distanceSquared(powerup.x, powerup.y, this.player.x, this.player.y) <= 23 * 23) {
                collected.push(powerup);
                return false;
            }
            return powerup.life > 0;
        });
        for (const powerup of collected) this.collectPowerup(powerup);
    }

    private collectPowerup(powerup: PowerupState): void {
        const label = this.applyPowerup(powerup.kind, false);
        this.events.push({ type: "powerup", x: powerup.x, y: powerup.y, kind: powerup.kind, label });
    }

    private updateTreasures(delta: number): void {
        for (const treasure of this.treasures) {
            treasure.phase += delta * 3.5;
            treasure.life -= delta;
        }
        const collected: TreasureState[] = [];
        this.treasures = this.treasures.filter((treasure) => {
            if (distanceSquared(treasure.x, treasure.y, this.player.x, this.player.y) <= 26 * 26) {
                collected.push(treasure);
                return false;
            }
            return treasure.life > 0;
        });
        for (const treasure of collected) {
            this.treasuresOpened += 1;
            this.energy += 2 + this.upgrades.flux_battery;
            const label = this.applyPowerup(treasure.kind, true);
            this.events.push({
                type: "treasure_collected",
                x: treasure.x,
                y: treasure.y,
                kind: treasure.kind,
                label,
                treasure: this.treasuresOpened,
            });
        }
    }

    private applyPowerup(kind: PowerupKind, treasure: boolean): string {
        let label = "POWER ONLINE";
        if (kind === "overdrive") {
            const duration = treasure ? 14 : 9;
            this.effects.overdrive = Math.max(this.effects.overdrive, duration);
            label = `OVERDRIVE · ${duration} SEC`;
        } else if (kind === "repair") {
            const healed = Math.min(treasure ? TREASURE_REPAIR_HEAL : REPAIR_HEAL, this.player.maxHp - this.player.hp);
            this.player.hp += healed;
            label = healed > 0 ? `REPAIRED +${healed}` : "FULL INTEGRITY";
        } else if (kind === "vacuum") {
            const duration = treasure ? 15 : 10;
            this.effects.vacuum = Math.max(this.effects.vacuum, duration);
            label = `FLUX VACUUM · ${duration} SEC`;
        } else if (kind === "shield") {
            const blocks = treasure ? TREASURE_SHIELD_BLOCKS : SHIELD_BLOCKS;
            this.effects.shield += blocks;
            label = `SHIELD · ${blocks} BLOCKS`;
        } else if (kind === "frenzy") {
            const duration = treasure ? 16 : 10;
            this.effects.frenzy = Math.max(this.effects.frenzy, duration);
            label = `BLADE FRENZY · ${duration} SEC`;
        } else if (kind === "freeze") {
            const duration = treasure ? 14 : 9;
            this.effects.freeze = Math.max(this.effects.freeze, duration);
            label = `CRYO FIELD · ${duration} SEC`;
        } else if (kind === "nova") {
            const radius = treasure ? 310 : 225;
            const damage = treasure ? 110 : 62;
            this.explode(this.player.x, this.player.y, radius, damage);
            label = treasure ? "MEGA NOVA · FIELD CLEARED" : "SCRAP NOVA · BLAST";
        } else {
            const payout = (treasure ? 42 : 24) + this.cachesOpened * 3 + this.upgrades.lucky_cache * 6;
            this.scrap += payout;
            this.energy += (treasure ? 8 : 5) + this.upgrades.flux_battery;
            this.score += payout * 8;
            label = `JACKPOT +${payout} SCRAP`;
        }
        return label;
    }

    private damageEnemy(enemy: EnemyState, damage: number, heavy: boolean): void {
        if (enemy.hp <= 0) return;
        enemy.hp -= damage;
        enemy.hitFlash = 0.08;
        this.events.push({ type: "hit", x: enemy.x, y: enemy.y, heavy });
    }

    private removeDefeatedEnemies(): void {
        const defeated = this.enemies.filter((enemy) => enemy.hp <= 0);
        if (defeated.length === 0) return;
        this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
        for (const enemy of defeated) {
            this.kills += 1;
            this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
            this.comboTimer = COMBO_WINDOW_SECONDS;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            if (this.combo === 5 || this.combo % 10 === 0) {
                this.events.push({ type: "combo", count: this.combo, multiplier: this.scoreMultiplier() });
            }

            const scoreValue = this.enemyScore(enemy.kind);
            this.score += Math.round(scoreValue * this.scoreMultiplier());
            const pickupValue =
                enemy.kind === "crusher"
                    ? 8
                    : enemy.kind === "brute" ||
                        enemy.kind === "charger" ||
                        enemy.kind === "siren" ||
                        enemy.kind === "mine_layer"
                      ? 3
                      : enemy.kind === "gunner" ||
                          enemy.kind === "splitter" ||
                          enemy.kind === "sniper" ||
                          enemy.kind === "spinner"
                        ? 2
                        : 1;
            this.spawnPickup(
                enemy.x,
                enemy.y,
                pickupValue,
                (this.random() - 0.5) * 42,
                (this.random() - 0.5) * 42,
                this.random() * TAU,
            );

            if (enemy.kind === "splitter") {
                const childDifficulty = 1 + this.elapsed / 190;
                this.spawnEnemyAt("skitter", enemy.x - 8, enemy.y + 5, childDifficulty * 0.8, enemy.horde);
                this.spawnEnemyAt("skitter", enemy.x + 8, enemy.y - 5, childDifficulty * 0.8, enemy.horde);
            }

            this.killsTowardCache += 1;
            if (this.killsTowardCache >= this.cacheNeeded()) {
                this.killsTowardCache -= this.cacheNeeded();
                this.cachesOpened += 1;
                const kind = this.rollPowerup();
                const angle = this.random() * TAU;
                const distance = 86 + this.random() * 34;
                this.spawnPowerup(
                    kind,
                    this.player.x + Math.cos(angle) * distance,
                    this.player.y + Math.sin(angle) * distance,
                    true,
                );
            } else if (this.random() < 0.028 + this.upgrades.lucky_cache * 0.012) {
                this.spawnPowerup(this.rollPowerup(), enemy.x, enemy.y, false);
            }
            this.events.push({ type: "enemy_down", x: enemy.x, y: enemy.y, kind: enemy.kind });
        }
    }

    private enemyScore(kind: EnemyKind): number {
        const scores: Record<EnemyKind, number> = {
            skitter: 20,
            brute: 60,
            wisp: 38,
            spinner: 68,
            gunner: 72,
            sniper: 104,
            splitter: 82,
            mine_layer: 112,
            charger: 95,
            siren: 145,
            crusher: 210,
        };
        return scores[kind];
    }

    private scoreMultiplier(): number {
        return 1 + Math.min(2, Math.floor(this.combo / 5) * 0.25);
    }

    private cacheNeeded(): number {
        return Math.max(8, CACHE_KILLS_BASE - this.upgrades.lucky_cache);
    }

    private rollPowerup(): PowerupKind {
        const roll = this.random();
        if (roll < 0.18) return "overdrive";
        if (roll < 0.26) return "repair";
        if (roll < 0.4) return "vacuum";
        if (roll < 0.5) return "shield";
        if (roll < 0.65) return "frenzy";
        if (roll < 0.79) return "freeze";
        if (roll < 0.9) return "nova";
        return "jackpot";
    }

    private spawnPowerup(kind: PowerupKind, x: number, y: number, cache: boolean): void {
        this.powerups.push({
            id: this.nextId++,
            kind,
            x,
            y,
            phase: this.random() * TAU,
            life: cache ? 22 : 16,
        });
        if (cache) {
            this.events.push({ type: "cache_reward", x, y, kind, cache: this.cachesOpened });
        }
    }

    private spawnTreasure(kind = this.rollPowerup(), x?: number, y?: number): void {
        const angle = this.random() * TAU;
        const distance = 145 + this.random() * 65;
        const treasureX = x ?? this.player.x + Math.cos(angle) * distance;
        const treasureY = y ?? this.player.y + Math.sin(angle) * distance * 0.78;
        this.treasures.push({
            id: this.nextId++,
            kind,
            x: treasureX,
            y: treasureY,
            phase: this.random() * TAU,
            life: 42,
        });
        this.events.push({ type: "treasure_discovered", x: treasureX, y: treasureY, kind });
    }

    private closestEnemy(): EnemyState | null {
        let closest: EnemyState | null = null;
        let closestDistance = 480 * 480;
        for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            const distance = distanceSquared(this.player.x, this.player.y, enemy.x, enemy.y);
            if (distance < closestDistance) {
                closest = enemy;
                closestDistance = distance;
            }
        }
        return closest;
    }

    private chooseEnemyKind(): EnemyKind {
        const unlocked = ENEMY_SPAWN_WEIGHTS.filter(([kind]) => this.level >= ENEMY_LEVEL_GATES[kind]);
        const totalWeight = unlocked.reduce((total, [, weight]) => total + weight, 0);
        let roll = this.random() * totalWeight;
        for (const [kind, weight] of unlocked) {
            roll -= weight;
            if (roll <= 0) return kind;
        }
        return "skitter";
    }

    private basePickupRadius(): number {
        return BASE_PICKUP_RADIUS + this.upgrades.flux_magnet * PICKUP_RADIUS_PER_MAGNET_LEVEL;
    }

    private unlockedEnemies(): EnemyKind[] {
        return (Object.keys(ENEMY_LEVEL_GATES) as EnemyKind[]).filter((kind) => ENEMY_LEVEL_GATES[kind] <= this.level);
    }

    private nextThreatLevel(): number | null {
        let next: number | null = null;
        for (const kind of Object.keys(ENEMY_LEVEL_GATES) as EnemyKind[]) {
            const requiredLevel = ENEMY_LEVEL_GATES[kind];
            if (requiredLevel <= this.level) continue;
            next = next === null ? requiredLevel : Math.min(next, requiredLevel);
        }
        return next;
    }

    private spawnEnemy(kind: EnemyKind, fixedDistance?: number, horde = false): void {
        const moving = Math.abs(this.inputX) + Math.abs(this.inputY) > 0.1;
        const forwardSpawn =
            fixedDistance === undefined && moving && (horde || this.random() < ENEMY_FORWARD_SPAWN_CHANCE);
        const angle = forwardSpawn
            ? Math.atan2(this.inputY, this.inputX) + (this.random() - 0.5) * Math.PI * (horde ? 0.82 : 1.2)
            : this.random() * TAU;
        const distance =
            fixedDistance ??
            (horde
                ? 205 + this.random() * 65
                : ENEMY_SPAWN_DISTANCE_MIN + this.random() * (ENEMY_SPAWN_DISTANCE_MAX - ENEMY_SPAWN_DISTANCE_MIN));
        const x = this.player.x + Math.cos(angle) * distance;
        const y = this.player.y + Math.sin(angle) * distance;
        this.spawnEnemyAt(kind, x, y, undefined, horde);
    }

    private spawnEnemyAt(kind: EnemyKind, x: number, y: number, difficultyOverride?: number, horde = false): void {
        if (this.enemies.length >= MAX_ACTIVE_ENEMIES) return;
        const difficulty = difficultyOverride ?? 1 + this.elapsed / 190;
        const damageBonus = this.enemyDamageBonus();
        const stats: Record<EnemyKind, Pick<EnemyState, "radius" | "hp" | "speed" | "contactDamage">> = {
            skitter: { radius: 8, hp: 8.5 * difficulty, speed: 54, contactDamage: 1 },
            brute: { radius: 12, hp: 30 * difficulty, speed: 31, contactDamage: 2 },
            wisp: { radius: 9, hp: 17 * difficulty, speed: 70, contactDamage: 1 },
            spinner: { radius: 10, hp: 23 * difficulty, speed: 46, contactDamage: 1 },
            gunner: { radius: 10, hp: 24 * difficulty, speed: 38, contactDamage: 1 },
            sniper: { radius: 10, hp: 27 * difficulty, speed: 34, contactDamage: 1 },
            splitter: { radius: 13, hp: 36 * difficulty, speed: 34, contactDamage: 2 },
            mine_layer: { radius: 13, hp: 48 * difficulty, speed: 32, contactDamage: 2 },
            charger: { radius: 12, hp: 42 * difficulty, speed: 38, contactDamage: 2 },
            siren: { radius: 15, hp: 68 * difficulty, speed: 30, contactDamage: 2 },
            crusher: { radius: 18, hp: 125 * difficulty, speed: 28, contactDamage: 3 },
        };
        const stat = stats[kind];
        this.enemies.push({
            id: this.nextId++,
            kind,
            x,
            y,
            radius: stat.radius,
            hp: stat.hp,
            maxHp: stat.hp,
            speed: stat.speed * (horde ? 1.55 : 1),
            contactDamage: stat.contactDamage + damageBonus + (horde ? 1 : 0),
            horde,
            hitFlash: 0,
            touchCooldown: 0,
            orbitCooldown: 0,
            attackCooldown: 0.5 + this.random(),
            chargeCooldown: 1.1 + this.random() * 1.5,
            chargeFor: 0,
            chargeX: 0,
            chargeY: 0,
        });
    }

    private enemyDamageBonus(): number {
        return Math.min(ENEMY_DAMAGE_BONUS_CAP, Math.floor(this.elapsed / ENEMY_DAMAGE_STEP_SECONDS));
    }

    private enemySpeedMultiplier(): number {
        return 1 + clamp(this.elapsed / SURVIVAL_RAMP_SECONDS, 0, 1) * ENEMY_SPEED_RAMP_CAP;
    }

    private checkLevelUp(): void {
        if (this.energy < this.energyNeeded || this.phase !== "running") return;
        this.energy -= this.energyNeeded;
        this.level += 1;
        this.energyNeeded = energyNeededForLevel(this.level);
        this.upgradeOffers = this.buildUpgradeOffers();
        this.phase = "upgrade";
        this.events.push({ type: "level_up", level: this.level });
        for (const kind of Object.keys(ENEMY_LEVEL_GATES) as EnemyKind[]) {
            if (ENEMY_LEVEL_GATES[kind] === this.level) {
                this.events.push({ type: "threat_unlocked", kind, level: this.level });
            }
        }
    }

    private buildUpgradeOffers(): UpgradeOffer[] {
        const available = UPGRADE_IDS.filter((id) => this.upgrades[id] < UPGRADES[id].maxLevel);
        if (available.length === 0) {
            return [{ id: "patch_kit", nextLevel: Math.min(this.upgrades.patch_kit + 1, UPGRADES.patch_kit.maxLevel) }];
        }
        for (let index = available.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(this.random() * (index + 1));
            const current = available[index];
            const swap = available[swapIndex];
            if (current === undefined || swap === undefined) continue;
            available[index] = swap;
            available[swapIndex] = current;
        }
        const offers = available.slice(0, 3);
        if (
            this.level <= 4 &&
            !offers.includes("hot_coils") &&
            !offers.includes("split_shot") &&
            this.upgrades.hot_coils < 2
        ) {
            offers[0] = "hot_coils";
        }
        if (this.level === 2 && this.upgrades.scrap_moon === 0 && !offers.includes("scrap_moon")) {
            offers[1] = "scrap_moon";
        }
        if (
            this.level === 3 &&
            !offers.some((id) => ["hook_blade", "scrap_moon", "scrap_bomb", "arc_chain"].includes(id))
        ) {
            offers[1] = "scrap_bomb";
        }
        return offers.map((id) => ({ id, nextLevel: this.upgrades[id] + 1 }));
    }

    private finishRun(outcome: "defeat"): void {
        if (this.phase === "defeat") return;
        this.phase = outcome;
        this.inputX = 0;
        this.inputY = 0;
        this.events.push({ type: "run_end", outcome, score: this.score });
    }
}
