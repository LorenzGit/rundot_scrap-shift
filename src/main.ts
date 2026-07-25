import { audioManager } from "./audio/audioManager.ts";
import { GameCore } from "./game/core.ts";
import { GameScene } from "./game/scene.ts";
import type { CoreSnapshot, GameEvent } from "./game/types.ts";
import { installBrowserQaContract } from "./qa/browserContract.ts";
import {
    bindRunSafeArea,
    initSdk,
    recordAnalytics,
    registerLifecycles,
    requestHostExit,
    triggerHaptic,
} from "./sdk/runSdk.ts";
import {
    type CommerceProductId,
    enforceOwnedSelection,
    purchaseProduct,
    reconcilePendingPurchase,
    refreshCommerce,
    skinIsOwned,
} from "./systems/commerce.ts";
import type { SkinId } from "./systems/cosmetics.ts";
import { claimDailyReward } from "./systems/dailyRewards.ts";
import {
    initializeInterstitialAdsSession,
    maybeShowResultsInterstitial,
    refreshInterstitialAdAvailability,
    testInterstitialAd,
} from "./systems/interstitialAds.ts";
import { monetizationPlacements, monetizationPlan, monetizationProducts } from "./systems/monetization/config.ts";
import { monetizationDiagnosticsView } from "./systems/monetization/diagnostics.ts";
import { refreshMonetizationRuntime } from "./systems/monetization/runtime.ts";
import {
    claimRewardedResultsBonus,
    initializeRewardedAdsSession,
    refreshRewardedAdAvailability,
    testRewardedAd,
} from "./systems/rewardedAds.ts";
import { saveSystem, type GameSettings, type SaveSource } from "./systems/save.ts";
import { refreshServerTime } from "./systems/serverTime.ts";
import { UiController } from "./ui/controller.ts";
import { PerformanceHud } from "./ui/performanceHud.ts";
import "./styles/app.css";

const core = new GameCore();
const performanceHud = new PerformanceHud();
let scene: GameScene;
let ui: UiController;
let saveSource: SaveSource = "defaults";
let lastHudUpdate = 0;
let lastPhase = core.snapshot().phase;
let firstMovementRecorded = false;
let firstKillRecorded = false;
let firstUpgradeRecorded = false;
let runPersisted = false;
let qaSimulationFrozen = false;

function updateBoot(progress: number, copy: string): void {
    const fill = document.getElementById("boot-fill");
    const label = document.getElementById("boot-copy");
    if (fill) fill.style.width = `${Math.max(4, Math.min(100, progress))}%`;
    if (label) label.textContent = copy;
}

function liftBootCover(): void {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const cover = document.getElementById("boot-cover");
            if (!cover) return;
            cover.classList.add("hidden");
            window.setTimeout(() => cover.remove(), 220);
        });
    });
}

function haptic(style: Parameters<typeof triggerHaptic>[0]): void {
    if (saveSystem.get().settings.hapticsEnabled) void triggerHaptic(style);
}

function startRun(): void {
    const seed = 0x51c8a3d2 + saveSystem.get().records.totalRuns * 7919;
    core.reset(seed);
    runPersisted = false;
    firstMovementRecorded = false;
    lastPhase = "running";
    qaSimulationFrozen = false;
    ui.showRunning();
    audioManager.setPaused(false);
    audioManager.play("ui");
    recordAnalytics("run_started", { inputMode: matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard" });
}

function pauseRun(): void {
    const phase = core.snapshot().phase;
    if (phase === "running") {
        core.pause();
        ui.showPause();
        audioManager.setPaused(true);
        void saveSystem.flush();
    } else if (phase === "paused") {
        resumeRun();
    }
}

function resumeRun(): void {
    if (core.snapshot().phase !== "paused") return;
    core.resume();
    ui.showRunning();
    audioManager.setPaused(false);
}

function backToMenu(): void {
    core.pause();
    const saved = saveSystem.get();
    ui.showMenu(saved.records, saved.progress);
    audioManager.setPaused(false);
}

function applySettings(settings: GameSettings): void {
    saveSystem.updateSettings(settings);
    audioManager.applySettings(settings);
    scene.setReducedMotion(settings.reducedMotion);
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
    recordAnalytics("setting_changed", {
        music: settings.musicEnabled,
        sfx: settings.sfxEnabled,
        haptics: settings.hapticsEnabled,
        reducedMotion: settings.reducedMotion,
    });
    void saveSystem.flush();
}

async function refreshMonetization(): Promise<void> {
    await refreshMonetizationRuntime();
    await Promise.all([refreshCommerce(), refreshRewardedAdAvailability(), refreshInterstitialAdAvailability()]);
}

async function exitResults(destination: "retry" | "menu", rewardedInteracted: boolean): Promise<void> {
    recordAnalytics("results_exit_tapped", { destination, rewardedInteracted });
    await maybeShowResultsInterstitial(rewardedInteracted, (visible) => audioManager.setPaused(visible));
    if (destination === "retry") startRun();
    else backToMenu();
}

function handleEvent(event: GameEvent): void {
    scene.handleEvent(event);
    if (event.type === "shot") {
        audioManager.play("shot");
    } else if (event.type === "hit") {
        audioManager.play("hit");
    } else if (event.type === "enemy_down") {
        audioManager.play("down");
        if (!firstKillRecorded) {
            firstKillRecorded = true;
            recordAnalytics("first_enemy_defeated");
        }
    } else if (event.type === "pickup") {
        audioManager.play("pickup");
    } else if (event.type === "powerup") {
        audioManager.play("powerup");
        haptic("success");
        ui.toast(event.label);
        if (event.kind === "jackpot") ui.milestone("RARE POWERUP", event.label, event.kind);
    } else if (event.type === "cache_reward") {
        audioManager.play("reward");
        haptic("success");
        ui.milestone(`CACHE #${event.cache} UNLOCKED`, `${event.kind.toUpperCase()} INBOUND`, event.kind);
        recordAnalytics("cache_reward", { cache: event.cache, powerup: event.kind });
    } else if (event.type === "treasure_discovered") {
        audioManager.play("ui");
        ui.toast("TREASURE SIGNAL · SEARCH NEARBY");
        recordAnalytics("treasure_discovered", { boost: event.kind });
    } else if (event.type === "treasure_collected") {
        audioManager.play("reward");
        haptic("success");
        ui.milestone(`TREASURE #${event.treasure}`, event.label, event.kind);
        recordAnalytics("treasure_collected", { treasure: event.treasure, boost: event.kind });
    } else if (event.type === "explosion") {
        audioManager.play("bomb");
        haptic("medium");
    } else if (event.type === "arc_chain") {
        audioManager.play("arc");
    } else if (event.type === "combo") {
        audioManager.play("combo");
        haptic("light");
        ui.milestone(`${event.count} HIT COMBO`, `SCORE x${event.multiplier.toFixed(2)}`);
    } else if (event.type === "threat_unlocked") {
        audioManager.play("reward");
        haptic("warning");
        ui.milestone(`LEVEL ${event.level} THREAT`, `${event.kind.toUpperCase()} UNLOCKED`);
        recordAnalytics("threat_unlocked", { enemyKind: event.kind, level: event.level });
    } else if (event.type === "horde_warning") {
        audioManager.play("warning");
        haptic("warning");
        ui.milestone(`HORDE ${event.horde} IN ${event.seconds}`, "HOSTILES CLOSING IN");
        recordAnalytics("horde_warning", { horde: event.horde });
    } else if (event.type === "horde_started") {
        audioManager.play("warning");
        haptic("warning");
        ui.milestone(`HORDE ${event.horde}`, "SWARM BREACH");
        recordAnalytics("horde_started", { horde: event.horde });
    } else if (event.type === "horde_ended") {
        audioManager.play("reward");
        haptic("success");
        ui.toast(`HORDE ${event.horde} CLEARED`);
        recordAnalytics("horde_cleared", { horde: event.horde });
    } else if (event.type === "player_hurt") {
        audioManager.play("hurt");
        haptic("warning");
        recordAnalytics("player_damaged", { remainingHp: event.hp });
    } else if (event.type === "dash") {
        audioManager.play("dash");
        haptic("medium");
    } else if (event.type === "level_up") {
        audioManager.play("upgrade");
        haptic("success");
        ui.milestone(`LEVEL ${event.level}`, "CHOOSE AN UPGRADE");
    } else if (event.type === "upgrade_chosen") {
        if (!firstUpgradeRecorded) {
            firstUpgradeRecorded = true;
            recordAnalytics("first_upgrade_chosen", { upgradeId: event.id, level: event.level });
        }
    } else if (event.type === "run_end") {
        audioManager.play("defeat");
        haptic("error");
    }
}

function persistRun(snapshot: CoreSnapshot): void {
    if (runPersisted) return;
    runPersisted = true;
    saveSystem.recordRun(
        snapshot.score,
        snapshot.elapsed,
        snapshot.level,
        snapshot.kills,
        snapshot.scrap,
        snapshot.cachesOpened,
    );
    void saveSystem.flush();
    recordAnalytics("run_ended", {
        outcome: snapshot.phase,
        elapsed: Math.round(snapshot.elapsed),
        score: snapshot.score,
        level: snapshot.level,
        kills: snapshot.kills,
    });
}

function updateUiForPhase(snapshot: CoreSnapshot): void {
    if (snapshot.phase === lastPhase) return;
    lastPhase = snapshot.phase;
    if (snapshot.phase === "upgrade") {
        ui.showUpgrade(snapshot.upgradeOffers);
    } else if (snapshot.phase === "defeat") {
        audioManager.setPaused(false);
        persistRun(snapshot);
        ui.showResults(snapshot);
    } else if (snapshot.phase === "running") {
        ui.showRunning();
    } else if (snapshot.phase === "paused") {
        ui.showPause();
    }
}

function frame(): void {
    const delta = Math.min(0.05, scene.app.ticker.deltaMS / 1000);
    const profiling = performanceHud.isEnabled();
    const simulationStarted = profiling ? performance.now() : 0;
    const movement = ui.movement();
    if (!qaSimulationFrozen) {
        core.setMovement(movement.x, movement.y);
        if (
            !firstMovementRecorded &&
            Math.abs(movement.x) + Math.abs(movement.y) > 0.1 &&
            core.snapshot().phase === "running"
        ) {
            firstMovementRecorded = true;
            recordAnalytics("first_movement");
        }
        core.update(delta);
    }
    const snapshot = core.snapshot();
    for (const event of core.drainEvents()) handleEvent(event);
    const renderStarted = profiling ? performance.now() : 0;
    scene.render(snapshot, delta);
    const hudStarted = profiling ? performance.now() : 0;
    if (performance.now() - lastHudUpdate > 80) {
        ui.updateHud(snapshot);
        lastHudUpdate = performance.now();
    }
    updateUiForPhase(snapshot);
    if (profiling) {
        const finished = performance.now();
        performanceHud.recordFrame({
            frameMs: scene.app.ticker.deltaMS,
            simulationMs: renderStarted - simulationStarted,
            renderMs: hudStarted - renderStarted,
            hudMs: finished - hudStarted,
        });
    }
}

async function boot(): Promise<void> {
    updateBoot(12, "LINKING RUN SYSTEMS");
    await initSdk();
    bindRunSafeArea();

    updateBoot(30, "RESTORING YOUR RECORDS");
    saveSource = await saveSystem.load();
    const saved = saveSystem.get();
    initializeRewardedAdsSession();
    initializeInterstitialAdsSession();
    await Promise.all([refreshServerTime(), refreshMonetizationRuntime()]);
    await Promise.all([refreshCommerce(), refreshRewardedAdAvailability(), refreshInterstitialAdAvailability()]);
    await reconcilePendingPurchase();
    audioManager.applySettings(saved.settings);
    audioManager.bindUnlock();
    document.documentElement.dataset.reducedMotion = String(saved.settings.reducedMotion);

    updateBoot(54, "DRAWING TOXIC DUSK");
    const host = document.getElementById("scene-host");
    if (!host) throw new Error("Missing #scene-host");
    scene = await GameScene.create(host);
    scene.setReducedMotion(saved.settings.reducedMotion);
    scene.setSkin(enforceOwnedSelection());
    scene.render(core.snapshot(), 0);

    updateBoot(84, "ARMING THE BLASTER");
    ui = new UiController(saved.settings, saved.records, saved.progress, saveSource, {
        onPlay: startRun,
        onRetry: async (rewardedInteracted) => {
            recordAnalytics("retry_tapped");
            await exitResults("retry", rewardedInteracted);
        },
        onMenu: async (rewardedInteracted) => {
            await exitResults("menu", rewardedInteracted);
        },
        onPause: pauseRun,
        onResume: resumeRun,
        onEndRun: () => {
            audioManager.setPaused(false);
            core.forceResults();
        },
        onDash: () => core.requestDash(),
        onChooseUpgrade: (index) => {
            if (core.chooseUpgrade(index)) {
                audioManager.play("ui");
                haptic("light");
            }
        },
        onSettingsChanged: applySettings,
        onPerformanceHudChanged: (enabled) => performanceHud.setEnabled(enabled),
        onTapMoveDiscovered: () => {
            saveSystem.markTapMoveSeen();
            void saveSystem.flush();
            recordAnalytics("tap_move_discovered");
        },
        onEquipSkin: (skinId: SkinId) => {
            if (!skinIsOwned(skinId)) return "SKIN OWNERSHIP NOT VERIFIED";
            saveSystem.setSelectedSkin(skinId);
            scene.setSkin(skinId);
            void saveSystem.flush();
            audioManager.play("upgrade");
            haptic("success");
            recordAnalytics("skin_equipped", { skinId });
            return `${skinId.toUpperCase()} EQUIPPED`;
        },
        onPurchaseProduct: async (productId: CommerceProductId, placement = "outfitter") => {
            recordAnalytics("purchase_tapped", { productId, placement });
            const outcome = await purchaseProduct(productId, placement);
            if (!outcome) return "PURCHASE CURRENTLY UNAVAILABLE";
            await refreshCommerce();
            const selected = enforceOwnedSelection();
            scene.setSkin(selected);
            if (outcome.status === "confirmed") {
                audioManager.play("reward");
                haptic("success");
                if (productId === "no_interstitials") return "PURCHASE VERIFIED · AD-FREE FOREVER ACTIVE";
                if (productId === "founder_bundle") return "FOUNDER BUNDLE VERIFIED · ALL UNLOCKS ACTIVE";
                return "PURCHASE VERIFIED · FOUNDRY + VOID UNLOCKED";
            }
            if (outcome.status === "cancelled") return "PURCHASE CANCELLED";
            if (outcome.status === "failed") return "PURCHASE FAILED · NOTHING GRANTED";
            return "ORDER PENDING · RUN WILL RECONCILE";
        },
        onClaimDaily: async () => {
            const result = await claimDailyReward();
            recordAnalytics("daily_reward_claim", { ok: result.ok, reward: result.message });
            if (result.ok) {
                audioManager.play("reward");
                haptic("success");
            }
            return result.message;
        },
        onRefreshMonetization: refreshMonetization,
        onRefreshMonetizationDiagnostics: async () => {
            await refreshMonetization();
            return monetizationDiagnosticsView();
        },
        onTestRewardedAd: async () => {
            const outcome = await testRewardedAd((visible) => audioManager.setPaused(visible));
            if (outcome.granted) {
                audioManager.play("reward");
                haptic("success");
            }
            return outcome.message;
        },
        onTestInterstitialAd: async () => {
            return testInterstitialAd((visible) => audioManager.setPaused(visible));
        },
        onClaimRewardedResults: async (baseScrap: number) => {
            const outcome = await claimRewardedResultsBonus(baseScrap, (visible) => audioManager.setPaused(visible));
            if (outcome.granted) {
                audioManager.play("reward");
                haptic("success");
            }
            return outcome.message;
        },
        onMonetizationSurfaceViewed: (surfaceId) => {
            recordAnalytics("monetization_surface_viewed", {
                surfaceId,
                placement: "main_menu",
                progression: saveSystem.get().records.highestLevel,
            });
        },
        onAdOfferViewed: (baseScrap: number, status: string) => {
            recordAnalytics("ad_offer_viewed", {
                placementId: "rewarded_results_salvage",
                adType: "rewarded",
                rewardId: "run_salvage_bonus",
                amount: Math.floor(baseScrap * 0.5),
                status,
            });
        },
    });
    scene.app.ticker.add(frame);

    registerLifecycles({
        onPause: pauseRun,
        onResume: resumeRun,
        onSleep: () => {
            core.pause();
            audioManager.setPaused(true);
            void saveSystem.flush();
        },
        onAwake: () => {
            void refreshServerTime();
            void refreshMonetization();
            resumeRun();
        },
        onQuit: () => void saveSystem.flush(),
        onBackButton: () => {
            const phase = core.snapshot().phase;
            if (phase === "running") pauseRun();
            else if (phase === "paused") backToMenu();
            else void requestHostExit();
        },
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseRun();
    });

    installBrowserQaContract(core, scene, ui, performanceHud, startRun, () => {
        qaSimulationFrozen = true;
    });
    if (import.meta.env.DEV && monetizationPlan.model !== "none") {
        console.info(
            `[monetization] ${monetizationPlacements.all().length} visible placements and ${monetizationProducts.all().length} products remain fail-closed until RUN catalog and LiveOps controls are activated.`,
        );
    }
    recordAnalytics("game_loaded", {
        version: __APP_VERSION__,
        saveSource,
        orientation: scene.getViewport().orientation,
    });

    updateBoot(100, "SHIFT READY");
    window.setTimeout(liftBootCover, 120);
}

function preventBrowserChrome(event: Event): void {
    event.preventDefault();
}

document.addEventListener("selectstart", preventBrowserChrome);
document.addEventListener("contextmenu", preventBrowserChrome);
document.addEventListener("dragstart", preventBrowserChrome);

window.addEventListener("unhandledrejection", (event) => {
    console.warn("[runtime] guarded unhandled rejection", event.reason);
    event.preventDefault();
});

void boot().catch((error) => {
    console.error("[boot] fatal startup failure", error);
    updateBoot(100, "BOOT FAILED · RELOAD TO RETRY");
});
