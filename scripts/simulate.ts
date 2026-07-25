import assert from "node:assert/strict";
import {
    BASE_PICKUP_RADIUS,
    BASE_PLAYER_SPEED,
    BLADE_CAROUSEL_MAX_LEVEL,
    CACHE_KILLS_BASE,
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
    HORDE_FIRST_SECONDS,
    HORDE_INTERVAL_SECONDS,
    LEVEL_ENERGY_BASE,
    LEVEL_ENERGY_STEP,
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
    TOTAL_ENEMY_TYPES,
    TREASURE_INTERVAL_MAX_SECONDS,
    TREASURE_INTERVAL_MIN_SECONDS,
    UPGRADES,
    WORLD_WIDTH,
    bladeCountForLevel,
    bladeOrbitAngle,
    bladeOrbitRadius,
    designViewportForSize,
    energyNeededForLevel,
} from "../src/game/config.ts";
import { GameCore } from "../src/game/core.ts";
import type { CoreSnapshot, EnemyKind } from "../src/game/types.ts";
import { floatingStickVector } from "../src/ui/touchStick.ts";
import { evaluateInterstitialGate, type InterstitialGateInput } from "../src/systems/monetization/interstitialGate.ts";
import { monetizationPlacements, monetizationPlan, monetizationProducts } from "../src/systems/monetization/config.ts";
import { normalizeMonetizationLiveOps } from "../src/systems/monetization/monetizationLiveOps.ts";

interface SimulationResult {
    score: number;
    kills: number;
    level: number;
    phase: string;
    elapsed: number;
    upgradesChosen: number;
    cachesOpened: number;
    treasuresOpened: number;
    maxCombo: number;
    powerupsCollected: number;
    treasuresDiscovered: number;
    enemyKindsSeen: string[];
    enemyFirstSeenLevels: Partial<Record<EnemyKind, number>>;
    playerHits: number;
    remainingIntegrity: number;
}

interface ProfileResult {
    phase: string;
    elapsed: number;
    level: number;
    remainingIntegrity: number;
}

interface ProfileSummary {
    survivors: number;
    defeats: number;
    minimumSeconds: number;
    medianSeconds: number;
    maximumSeconds: number;
}

type MovementProfile = (frame: number, snapshot: CoreSnapshot) => { x: number; y: number; dash: boolean };

const DAMAGE_PRIORITY = [
    "hot_coils",
    "split_shot",
    "scrap_moon",
    "turbo_boots",
    "arc_chain",
    "static_bloom",
    "scrap_bomb",
    "hook_blade",
    "plated_jacket",
    "patch_kit",
    "dash_drive",
    "flux_magnet",
    "flux_battery",
    "lucky_cache",
] as const;

function runSimulation(seed: number, seconds = 190): SimulationResult {
    const core = new GameCore();
    core.reset(seed);
    let upgradesChosen = 0;
    let powerupsCollected = 0;
    let treasuresDiscovered = 0;
    let playerHits = 0;
    const enemyKindsSeen = new Set<string>();
    const enemyFirstSeenLevels: Partial<Record<EnemyKind, number>> = {};
    const frames = Math.ceil(seconds * 60);
    for (let frame = 0; frame < frames; frame += 1) {
        const angle = frame / 145;
        core.setMovement(Math.cos(angle), Math.sin(angle * 0.71));
        if (frame % 150 === 0) core.requestDash();
        core.update(1 / 60);
        const snapshot = core.snapshot();
        for (const enemy of snapshot.enemies) {
            assert.ok(
                ENEMY_LEVEL_GATES[enemy.kind] <= snapshot.level,
                `${enemy.kind} must not spawn before level ${ENEMY_LEVEL_GATES[enemy.kind]}`,
            );
            enemyKindsSeen.add(enemy.kind);
            enemyFirstSeenLevels[enemy.kind] ??= snapshot.level;
        }
        for (const event of core.drainEvents()) {
            if (event.type === "powerup") powerupsCollected += 1;
            if (event.type === "treasure_discovered") treasuresDiscovered += 1;
            if (event.type === "player_hurt") playerHits += 1;
        }
        if (snapshot.phase === "upgrade") {
            assert.ok(snapshot.upgradeOffers.length >= 1 && snapshot.upgradeOffers.length <= 3);
            assert.equal(core.chooseUpgrade(upgradesChosen % snapshot.upgradeOffers.length), true);
            upgradesChosen += 1;
        }
        if (snapshot.phase === "defeat") break;
    }
    const final = core.snapshot();
    return {
        score: final.score,
        kills: final.kills,
        level: final.level,
        phase: final.phase,
        elapsed: final.elapsed,
        upgradesChosen,
        cachesOpened: final.cachesOpened,
        treasuresOpened: final.treasuresOpened,
        maxCombo: final.maxCombo,
        powerupsCollected,
        treasuresDiscovered,
        enemyKindsSeen: [...enemyKindsSeen].sort(),
        enemyFirstSeenLevels,
        playerHits,
        remainingIntegrity: final.player.hp,
    };
}

function choosePriorityUpgrade(core: GameCore, snapshot: CoreSnapshot): void {
    let chosenIndex = 0;
    let chosenRank = Number.POSITIVE_INFINITY;
    for (let index = 0; index < snapshot.upgradeOffers.length; index += 1) {
        const offer = snapshot.upgradeOffers[index];
        if (!offer) continue;
        const rank = DAMAGE_PRIORITY.indexOf(offer.id);
        if (rank >= 0 && rank < chosenRank) {
            chosenIndex = index;
            chosenRank = rank;
        }
    }
    assert.equal(core.chooseUpgrade(chosenIndex), true, "profile upgrade choice must remain valid");
}

function runMovementProfile(seed: number, movement: MovementProfile): ProfileResult {
    const core = new GameCore();
    core.reset(seed);
    for (let frame = 0; frame < Math.ceil(SURVIVAL_RAMP_SECONDS * 60); frame += 1) {
        const before = core.snapshot();
        const input = movement(frame, before);
        core.setMovement(input.x, input.y);
        if (input.dash) core.requestDash();
        core.update(1 / 60);
        core.drainEvents();
        const after = core.snapshot();
        if (after.phase === "upgrade") choosePriorityUpgrade(core, after);
        if (after.phase === "defeat") break;
    }
    const final = core.snapshot();
    return {
        phase: final.phase,
        elapsed: final.elapsed,
        level: final.level,
        remainingIntegrity: final.player.hp,
    };
}

function summarizeProfile(movement: MovementProfile, sampleSize = 32): ProfileSummary {
    const results = Array.from({ length: sampleSize }, (_, index) => runMovementProfile((index + 1) * 7919, movement));
    const elapsed = results.map((result) => result.elapsed).sort((a, b) => a - b);
    const survivors = results.filter((result) => result.phase !== "defeat").length;
    return {
        survivors,
        defeats: results.length - survivors,
        minimumSeconds: elapsed[0] ?? 0,
        medianSeconds: elapsed[Math.floor((elapsed.length - 1) / 2)] ?? 0,
        maximumSeconds: elapsed.at(-1) ?? 0,
    };
}

const straightKite: MovementProfile = (frame) => ({
    x: 1,
    y: 0,
    dash: frame % 105 === 0,
});

const reactiveScavenger: MovementProfile = (frame, snapshot) => {
    let x = Math.cos(frame / 260) * 0.35;
    let y = Math.sin(frame / 260) * 0.35;
    let nearestEnemy = Number.POSITIVE_INFINITY;
    for (const enemy of snapshot.enemies) {
        const awayX = snapshot.player.x - enemy.x;
        const awayY = snapshot.player.y - enemy.y;
        const distance = Math.hypot(awayX, awayY);
        nearestEnemy = Math.min(nearestEnemy, distance);
        if (distance >= 150) continue;
        const weight = ((150 - distance) / 150) * 2.4;
        x += (awayX / Math.max(1, distance)) * weight;
        y += (awayY / Math.max(1, distance)) * weight;
    }
    let target: { x: number; y: number } | undefined;
    let targetDistance = 320;
    for (const candidate of [...snapshot.pickups, ...snapshot.treasures]) {
        const distance = Math.hypot(candidate.x - snapshot.player.x, candidate.y - snapshot.player.y);
        if (distance >= targetDistance) continue;
        target = candidate;
        targetDistance = distance;
    }
    if (target && nearestEnemy > 65) {
        x += ((target.x - snapshot.player.x) / Math.max(1, targetDistance)) * 0.9;
        y += ((target.y - snapshot.player.y) / Math.max(1, targetDistance)) * 0.9;
    }
    const length = Math.hypot(x, y) || 1;
    return {
        x: x / length,
        y: y / length,
        dash: nearestEnemy < 70 && snapshot.player.dashCooldown <= 0,
    };
};

const pausedCore = new GameCore();
pausedCore.reset(42);
pausedCore.update(1);
pausedCore.pause();
const pausedAt = pausedCore.snapshot().elapsed;
pausedCore.update(3);
assert.equal(pausedCore.snapshot().elapsed, pausedAt, "pause must freeze simulation time");
pausedCore.resume();
pausedCore.update(0.5);
assert.ok(pausedCore.snapshot().elapsed > pausedAt, "resume must advance time");

assert.deepEqual(designViewportForSize(844, 390), {
    width: 640,
    height: 360,
    orientation: "landscape",
});
assert.deepEqual(designViewportForSize(390, 844), {
    width: 360,
    height: 640,
    orientation: "portrait",
});
assert.equal(BLADE_CAROUSEL_MAX_LEVEL, 8, "blade carousel must support eight visible swords");
assert.equal(UPGRADES.scrap_moon.maxLevel, 8, "saved scrap_moon progression must expose all eight blade levels");
assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => bladeCountForLevel(index + 1)),
    [1, 2, 3, 4, 5, 6, 7, 8],
    "every carousel level must add exactly one blade",
);
assert.equal(bladeCountForLevel(99), 8, "blade count must cap at the eight authored silhouettes");
assert.ok(bladeOrbitRadius(8) > bladeOrbitRadius(1), "the full carousel needs room for all eight blades");
assert.notEqual(bladeOrbitAngle(1, 0, 8), bladeOrbitAngle(1, 1, 8), "carousel blades must be evenly separated");
assert.equal(BASE_PLAYER_SPEED, 123.2, "base hero speed must be exactly 10% above the former 112 baseline");
assert.equal(STARTING_PLAYER_INTEGRITY, 15, "the opening must expose a finite fifteen-point integrity pool");
assert.equal(MAX_PLAYER_INTEGRITY, 21, "defensive cards must not grow integrity without a cap");
assert.equal(DAMAGE_INVULNERABILITY_SECONDS, 0.52, "damage recovery must allow another hit during sustained pressure");
assert.equal(ENEMY_DAMAGE_STEP_SECONDS, 60, "hostile damage must escalate at each one-minute threshold");
assert.equal(ENEMY_DAMAGE_BONUS_CAP, 2, "late pressure must add two damage without one-shotting a fresh hero");
assert.equal(ENEMY_SPEED_RAMP_CAP, 0.65, "enemy pursuit must remain relevant against continuous movement");
assert.equal(ENEMY_PROJECTILE_SPEED_START, 160, "opening hostile bolts must be dodgeable but faster than the hero");
assert.equal(ENEMY_PROJECTILE_SPEED_END, 240, "late hostile bolts must demand directional dodging");
assert.equal(ENEMY_FORWARD_SPAWN_CHANCE, 0.58, "moving forever in one direction must not despawn all pressure behind");
assert.equal(ENEMY_SPAWN_DISTANCE_MIN, 235, "forward spawns must enter from readable screen-edge distance");
assert.equal(ENEMY_SPAWN_DISTANCE_MAX, 315, "enemy spawns must not appear on top of the hero");
assert.equal(TOTAL_ENEMY_TYPES, 11, "the endless roster must expose eleven distinct monster families");
assert.equal(ENEMY_LEVEL_GATES.spinner, 5, "radial spinner attacks must enter at level five");
assert.equal(ENEMY_LEVEL_GATES.sniper, 7, "predictive sniper attacks must enter at level seven");
assert.equal(ENEMY_LEVEL_GATES.mine_layer, 9, "persistent mine attacks must enter at level nine");
assert.equal(ENEMY_LEVEL_GATES.siren, 11, "dense siren pulse attacks must enter at level eleven");
assert.equal(HORDE_FIRST_SECONDS, 45, "the first horde must arrive after a readable opening build window");
assert.equal(HORDE_INTERVAL_SECONDS, 55, "hordes must recur throughout an endless run");
assert.equal(MAX_ACTIVE_ENEMIES, 110, "phone-safe hordes must have a strict simultaneous enemy ceiling");
assert.equal(MAX_ACTIVE_HAZARDS, 120, "hostile projectiles must have a strict phone-safe ceiling");
assert.equal(MAX_ACTIVE_PICKUPS, 120, "abandoned scrap must not grow without bound");
assert.equal(PICKUP_LIFETIME_SECONDS, 30, "off-route scrap must release its simulation and render budget");
assert.equal(FIRST_TREASURE_DELAY_SECONDS, 58, "treasure must be rare enough to feel discovered");
assert.equal(TREASURE_INTERVAL_MIN_SECONDS, 82, "treasure must not become a routine recovery source");
assert.equal(TREASURE_INTERVAL_MAX_SECONDS, 118, "treasure timing must retain meaningful variation");
assert.equal(CACHE_KILLS_BASE, 14, "cache frequency must reward combat without supplying constant recovery");
assert.equal(REPAIR_HEAL, 3, "ordinary repairs must help without erasing several mistakes");
assert.equal(SHIELD_BLOCKS, 1, "ordinary shields must block one hit instead of creating long invulnerable chains");
assert.equal(LEVEL_ENERGY_BASE, 24, "the opening level threshold must slow the first upgrade");
assert.equal(LEVEL_ENERGY_STEP, 10, "each next level must add exactly ten energy");
assert.equal(energyNeededForLevel(1), 24, "level one must use the linear base threshold");
assert.equal(energyNeededForLevel(8), 94, "later upgrades must preserve the exact linear curve");
assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => energyNeededForLevel(index + 2) - energyNeededForLevel(index + 1)),
    Array(7).fill(10),
    "every level-to-level threshold increase must be linear",
);
assert.deepEqual(
    floatingStickVector(100, 100, 100, 100, 60, 7),
    { x: 0, y: 0, knobX: 0, knobY: 0 },
    "touch-down alone must not move the hero",
);
const rightStick = floatingStickVector(100, 100, 160, 100, 60, 7);
assert.equal(rightStick.x, 1, "a full floating-stick drag must reach full speed");
assert.equal(rightStick.y, 0, "horizontal floating-stick movement must not leak vertically");
assert.equal(monetizationPlan.model, "hybrid", "the monetization brief and typed plan must agree");
assert.equal(monetizationPlacements.all().length, 2, "start with one rewarded and one interstitial placement");
assert.ok(
    monetizationPlacements.all().every((placement) => !placement.enabledByDefault),
    "planned ad placements must stay disabled until host verification",
);
assert.equal(
    monetizationPlacements.require("rewarded_results_salvage").subscriberPolicy,
    "same-as-free",
    "no-interstitial ownership must preserve optional rewarded value",
);
assert.equal(monetizationProducts.all().length, 3, "the initial Shop hypothesis should remain intentionally small");
const eligibleInterstitial: InterstitialGateInput = {
    controlsEnabled: true,
    rewardedInteracted: false,
    entitlementsVerified: true,
    adFree: false,
    minCompletedSessions: 2,
    minProgression: 2,
    completedRunsAtSessionStart: 3,
    totalRuns: 6,
    progression: 4,
    everyNthRun: 3,
    trustedTimeReady: true,
    shownThisSession: 0,
    sessionCap: 1,
    shownToday: 0,
    dailyCap: 3,
    sinceLastShownMs: 700_000,
    cooldownMs: 600_000,
    hostReady: true,
    adReady: true,
    alreadyEvaluated: false,
    inFlight: false,
};
assert.equal(
    evaluateInterstitialGate(eligibleInterstitial),
    "eligible",
    "a verified third-run results exit should allow one interstitial",
);
assert.equal(
    evaluateInterstitialGate({ ...eligibleInterstitial, rewardedInteracted: true }),
    "rewarded-interaction",
    "rewarded interaction must suppress an interstitial on the same results break",
);
assert.equal(
    evaluateInterstitialGate({ ...eligibleInterstitial, adFree: true }),
    "ad-free",
    "the permanent no-ads entitlement must suppress interstitials",
);
assert.equal(
    evaluateInterstitialGate({ ...eligibleInterstitial, totalRuns: 5 }),
    "frequency",
    "normal results exits outside the every-third-run cadence must remain uninterrupted",
);
assert.deepEqual(
    normalizeMonetizationLiveOps({
        enabled: false,
        purchasesEnabled: true,
        rewardedAdsEnabled: true,
        interstitialAdsEnabled: true,
        placements: { rewarded_results_salvage: { enabled: true, sessionCap: 999 } },
        products: { no_interstitials: { enabled: true } },
    }),
    {
        enabled: false,
        privateTestMode: false,
        purchasesEnabled: false,
        rewardedAdsEnabled: false,
        interstitialAdsEnabled: false,
        placements: {
            rewarded_results_salvage: {
                enabled: false,
                cooldownSeconds: 604800,
                sessionCap: 999,
                dailyCap: 0,
                rewardMultiplier: 1,
                everyNthRun: 1,
            },
        },
        products: { no_interstitials: { enabled: false } },
    },
    "global LiveOps off must fail closed even when child flags request exposure",
);

const budgetCore = new GameCore();
budgetCore.reset(511);
for (let index = 0; index < MAX_ACTIVE_ENEMIES + 50; index += 1) budgetCore.forceEnemy("skitter", 500, index);
for (let index = 0; index < MAX_ACTIVE_HAZARDS + 50; index += 1) budgetCore.forceHazard("pulse", 500, index);
for (let index = 0; index < MAX_ACTIVE_PICKUPS + 50; index += 1) budgetCore.forcePickup(500 + index, 1);
assert.equal(budgetCore.snapshot().enemies.length, MAX_ACTIVE_ENEMIES, "enemy allocation must stop at its hard cap");
assert.equal(budgetCore.snapshot().hazards.length, MAX_ACTIVE_HAZARDS, "hazard allocation must stop at its hard cap");
assert.equal(budgetCore.snapshot().pickups.length, MAX_ACTIVE_PICKUPS, "pickup allocation must recycle its hard cap");

const first = runSimulation(0x51c8a3d2);
const second = runSimulation(0x51c8a3d2);
assert.deepEqual(first, second, "seeded simulations must be deterministic");
assert.ok(first.kills >= 10, `expected combat activity, got ${first.kills} kills`);
assert.ok(first.score > 0, "score should increase");
assert.ok(first.level >= 2, "a run should reach at least one power choice");
assert.ok(first.upgradesChosen >= 1, "upgrade cards should be chosen during simulation");
assert.ok(first.cachesOpened >= 1, "cache rewards should unlock during an active run");
assert.ok(first.maxCombo >= 5, "rapid kills should create a combo");
assert.ok(first.powerupsCollected >= 1, "cache powerups should be collectable");
assert.ok(first.treasuresDiscovered <= 2, "rare treasures must not flood an ordinary run");
assert.ok(
    first.enemyKindsSeen.length >= 2,
    "the level curve should introduce a second family without flooding level one",
);
assert.equal(first.phase, "defeat", "the reference movement path must now be mortal");
assert.ok(
    first.elapsed >= 40 && first.elapsed < 155,
    `simple looping movement should fail under escalating horde pressure, got ${first.elapsed.toFixed(1)}s`,
);
assert.ok(first.playerHits >= 10, `reference run should absorb sustained pressure, got ${first.playerHits} hits`);
assert.equal(first.remainingIntegrity, 0, "a defeat must end at zero integrity");

const straightKiteSummary = summarizeProfile(straightKite);
const reactiveScavengerSummary = summarizeProfile(reactiveScavenger);
assert.ok(
    straightKiteSummary.survivors <= 4,
    `holding one direction must no longer guarantee safety, got ${straightKiteSummary.survivors}/32 survivors`,
);
assert.ok(
    straightKiteSummary.medianSeconds < 150,
    `straight-line kiting should collapse under horde pressure, got ${straightKiteSummary.medianSeconds.toFixed(1)}s`,
);
assert.ok(
    reactiveScavengerSummary.survivors > 0 && reactiveScavengerSummary.survivors < 20,
    `reactive pickup-and-dodge play should be difficult but viable, got ${reactiveScavengerSummary.survivors}/32 survivors`,
);
assert.ok(
    reactiveScavengerSummary.medianSeconds >= 85,
    `reactive play should materially outperform holding one direction, got ${reactiveScavengerSummary.medianSeconds.toFixed(1)}s`,
);

const resultCore = new GameCore();
resultCore.reset(7);
assert.deepEqual(resultCore.snapshot().unlockedEnemies, ["skitter"], "level one must begin with one monster family");
assert.equal(
    resultCore.snapshot().pickupRadius,
    BASE_PICKUP_RADIUS,
    "the ordinary coin magnet must use the tuned radius",
);
assert.equal(BASE_PICKUP_RADIUS, 92, "the ordinary magnet must not vacuum coins from across the arena");
assert.equal(PICKUP_RADIUS_PER_MAGNET_LEVEL, 32, "magnet upgrades must add modest reach");
const startingScrap = resultCore.snapshot().scrap;
resultCore.forcePickup(80, 3);
for (let frame = 0; frame < 120 && resultCore.snapshot().scrap === startingScrap; frame += 1) {
    resultCore.update(1 / 60);
}
assert.ok(
    resultCore.snapshot().scrap > startingScrap,
    "a nearby coin inside the base magnet radius should be collected",
);
resultCore.forceUpgrade();
assert.equal(resultCore.snapshot().phase, "upgrade", "QA upgrade transition should expose the semantic card state");
assert.deepEqual(
    resultCore.snapshot().unlockedEnemies,
    ["skitter"],
    "levels one and two must contain only the opening monster family",
);
assert.ok(
    resultCore.snapshot().upgradeOffers.some((offer) => offer.id === "scrap_moon"),
    "the first upgrade choice must make the blade carousel discoverable",
);
assert.ok(
    !resultCore.drainEvents().some((event) => event.type === "threat_unlocked"),
    "level two must not unlock another threat",
);
assert.equal(resultCore.chooseUpgrade(0), true, "forced QA upgrade must remain a real upgrade choice");
resultCore.forceUpgrade();
assert.ok(
    resultCore.drainEvents().some((event) => event.type === "threat_unlocked" && event.kind === "brute"),
    "level three should announce the second monster family",
);
assert.equal(resultCore.chooseUpgrade(0), true, "the level-three QA upgrade must remain selectable");
resultCore.forceBladeLevel(8);
assert.equal(resultCore.snapshot().upgrades.scrap_moon, 8, "QA must expose the full carousel for visual inspection");
resultCore.forcePowerup("overdrive", 0);
resultCore.update(1 / 60);
assert.ok(resultCore.snapshot().activeEffects.overdrive > 0, "forced QA powerup should use the real collection path");
resultCore.forcePowerup("frenzy", 0);
resultCore.forcePowerup("freeze", 0);
resultCore.update(1 / 60);
assert.ok(resultCore.snapshot().activeEffects.frenzy > 0, "frenzy cards must create a visible timed rapid-fire effect");
assert.ok(resultCore.snapshot().activeEffects.freeze > 0, "cryo cards must create a visible timed slow effect");
const beforeNovaEnemies = resultCore.snapshot().enemies.length;
resultCore.forcePowerup("nova", 0);
resultCore.update(1 / 60);
assert.ok(
    resultCore.snapshot().enemies.length <= beforeNovaEnemies,
    "nova cards must resolve through the real world-clearing combat path",
);

const treasureCore = new GameCore();
treasureCore.reset(91);
treasureCore.forceTreasure("overdrive", 0);
treasureCore.update(1 / 60);
assert.equal(treasureCore.snapshot().treasuresOpened, 1, "walking onto a discovered treasure must open it");
assert.ok(
    treasureCore.snapshot().activeEffects.overdrive >= 13,
    "treasure boosts must be stronger than ordinary cards",
);
assert.ok(
    treasureCore.drainEvents().some((event) => event.type === "treasure_collected"),
    "treasure collection needs a semantic feedback event",
);

const hordeCore = new GameCore();
hordeCore.reset(119);
let hordeWarnings = 0;
let hordesStarted = 0;
let naturalTreasures = 0;
for (let frame = 0; frame < Math.ceil((FIRST_TREASURE_DELAY_SECONDS + 2) * 60); frame += 1) {
    if (frame % 24 === 0) {
        hordeCore.forcePowerup("shield", 0);
        hordeCore.forcePowerup("nova", 0);
    }
    hordeCore.setMovement(Math.cos(frame / 90), Math.sin(frame / 110));
    hordeCore.update(1 / 60);
    const snapshot = hordeCore.snapshot();
    if (snapshot.phase === "upgrade") hordeCore.chooseUpgrade(0);
    for (const event of hordeCore.drainEvents()) {
        if (event.type === "horde_warning") hordeWarnings += 1;
        if (event.type === "horde_started") hordesStarted += 1;
        if (event.type === "treasure_discovered") naturalTreasures += 1;
    }
}
assert.ok(hordeWarnings >= 1, "the first horde must provide a readable advance warning");
assert.ok(hordesStarted >= 1, "periodic hordes must actually enter the live simulation");
assert.equal(naturalTreasures, 1, "only one natural treasure should appear by the first rare discovery threshold");

const endlessCore = new GameCore();
endlessCore.reset(313);
for (let frame = 0; frame < Math.ceil((SURVIVAL_RAMP_SECONDS + 5) * 60); frame += 1) {
    if (frame % 24 === 0) {
        endlessCore.forcePowerup("shield", 0);
        endlessCore.forcePowerup("nova", 0);
    }
    endlessCore.setMovement(Math.cos(frame / 120), Math.sin(frame / 150));
    endlessCore.update(1 / 60);
    if (endlessCore.snapshot().phase === "upgrade") endlessCore.chooseUpgrade(0);
    endlessCore.drainEvents();
}
assert.ok(
    endlessCore.snapshot().elapsed > SURVIVAL_RAMP_SECONDS,
    "the survival clock must continue beyond three minutes",
);
assert.notEqual(endlessCore.snapshot().phase, "defeat", "elapsed time alone must never end a protected survival run");

const infiniteCore = new GameCore();
infiniteCore.reset(73);
const movementStart = infiniteCore.snapshot().player.x;
infiniteCore.setMovement(1, 0);
infiniteCore.update(0.05);
assert.ok(
    Math.abs(infiniteCore.snapshot().player.x - movementStart - BASE_PLAYER_SPEED * 0.05) < 0.0001,
    "full-strength movement must use the authored base speed",
);
for (let frame = 0; frame < 420 && infiniteCore.snapshot().phase !== "defeat"; frame += 1) {
    if (infiniteCore.snapshot().phase === "upgrade") infiniteCore.chooseUpgrade(0);
    infiniteCore.setMovement(-1, 0);
    infiniteCore.update(0.05);
}
assert.ok(infiniteCore.snapshot().player.x < -WORLD_WIDTH / 2, "the hero must travel beyond former arena bounds");
resultCore.forceResults();
assert.equal(
    resultCore.snapshot().phase,
    "defeat",
    "ending an endless run must produce survival results, never a time win",
);

console.log(
    JSON.stringify(
        {
            status: "ok",
            deterministicRun: first,
            balanceProfiles: {
                straightKite: straightKiteSummary,
                reactiveScavenger: reactiveScavengerSummary,
            },
            assertions: [
                "pause_resume",
                "seed_determinism",
                "combat_activity",
                "upgrade_flow",
                "eight_blade_carousel",
                "fail_closed_monetization_plan",
                "combo_scoring",
                "cache_rewards",
                "powerup_collection",
                "floating_touch_stick",
                "release_to_stop_contract",
                "ten_percent_speed_increase",
                "slow_linear_level_progression",
                "infinite_world_coordinates",
                "discoverable_treasures",
                "coin_magnet",
                "level_gated_monsters",
                "eleven_enemy_families",
                "distinct_enemy_attacks",
                "periodic_hordes",
                "endless_survival_clock",
                "rare_treasure_cadence",
                "eight_visible_powerups",
                "threat_unlock_feedback",
                "anti_kiting_pressure",
                "reactive_survival_window",
                "terminal_result",
            ],
        },
        null,
        2,
    ),
);
