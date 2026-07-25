import type { GameCore } from "../game/core.ts";
import type { GameScene } from "../game/scene.ts";
import type { UiController } from "../ui/controller.ts";
import type { PerformanceHud } from "../ui/performanceHud.ts";

export function installBrowserQaContract(
    core: GameCore,
    scene: GameScene,
    ui: UiController,
    performanceHud: PerformanceHud,
    startRun: () => void,
    freezeSimulation: () => void,
): void {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get("qa") !== "1") return;
    window.__scrapShiftQa = {
        snapshot: () => {
            const snapshot = core.snapshot();
            const viewport = scene.getViewport();
            const performance = scene.getPerformanceDiagnostics();
            return {
                phase: snapshot.phase,
                orientation: viewport.orientation,
                viewport: `${viewport.width}x${viewport.height}`,
                elapsed: snapshot.elapsed,
                score: snapshot.score,
                kills: snapshot.kills,
                level: snapshot.level,
                hp: snapshot.player.hp,
                playerX: snapshot.player.x,
                playerY: snapshot.player.y,
                enemies: snapshot.enemies.length,
                projectiles: snapshot.projectiles.length,
                hazards: snapshot.hazards.length,
                pickups: snapshot.pickups.length,
                powerups: snapshot.powerups.map((powerup) => powerup.kind),
                treasures: snapshot.treasures.map((treasure) => treasure.kind),
                combo: snapshot.combo,
                maxCombo: snapshot.maxCombo,
                scoreMultiplier: snapshot.scoreMultiplier,
                cacheProgress: snapshot.cacheProgress,
                cachesOpened: snapshot.cachesOpened,
                treasuresOpened: snapshot.treasuresOpened,
                activeEffects: snapshot.activeEffects,
                pickupRadius: snapshot.pickupRadius,
                unlockedEnemies: snapshot.unlockedEnemies,
                nextThreatLevel: snapshot.nextThreatLevel,
                hordeActive: snapshot.hordeActive,
                hordeNumber: snapshot.hordeNumber,
                nextHordeIn: snapshot.nextHordeIn,
                bladeLevel: snapshot.upgrades.scrap_moon,
                upgradeOffers: snapshot.upgradeOffers.map((offer) => offer.id),
                renderRedraws: performance.redrawsLastFrame,
                liveGraphics: performance.liveGraphics,
                visibleGraphics: performance.visibleGraphics,
                sharedContexts: performance.sharedContexts,
                terrainContexts: performance.terrainContexts,
                particles: performance.particles,
                cameraShake: performance.cameraShake,
                shakeOffsetX: performance.shakeOffsetX,
                shakeOffsetY: performance.shakeOffsetY,
                worldX: performance.worldX,
                worldY: performance.worldY,
                performance: performanceHud.snapshot(),
            };
        },
        startRun,
        forceUpgrade: () => core.forceUpgrade(),
        forceBladeLevel: (level) => core.forceBladeLevel(level),
        forcePowerup: (kind, distance, angle) => core.forcePowerup(kind, distance, angle),
        forceEnemy: (kind, distance, angle) => core.forceEnemy(kind, distance, angle),
        forceHorde: () => core.forceHorde(),
        forcePerformanceStress: () => core.forcePerformanceStress(),
        forceHazard: (kind, distance, angle) => core.forceHazard(kind, distance, angle),
        forceTreasure: (kind, distance) => core.forceTreasure(kind, distance),
        forcePickup: (distance) => core.forcePickup(distance),
        chooseUpgrade: (index) => core.chooseUpgrade(index),
        openSettings: () => ui.openSettings("menu"),
        openDailyRewards: () => ui.showDaily(),
        openOutfitter: () => ui.showSkins(),
        pause: () => {
            core.pause();
            ui.showPause();
        },
        resume: () => {
            core.resume();
            ui.showRunning();
        },
        forceResults: () => core.forceResults(),
        freezeSimulation,
        setReducedMotion: (enabled) => scene.setReducedMotion(enabled),
        setPerformanceHud: (enabled) => ui.setPerformanceHudEnabled(enabled),
        showMilestone: (kicker, title, kind) => ui.milestone(kicker, title, kind),
    };
}
