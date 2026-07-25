import { Application, Container, Graphics, type GraphicsContext } from "pixi.js";
import { SKINS, type SkinId } from "../systems/cosmetics.ts";
import {
    arenaTileVariant,
    createArenaVariant,
    drawCarouselBladeSprite,
    drawEnemy,
    drawHazard,
    drawPickup,
    drawPlayer,
    drawPowerup,
    drawProjectile,
    drawTreasure,
} from "./art.ts";
import {
    LANDSCAPE_VIEW,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    bladeCountForLevel,
    bladeOrbitAngle,
    bladeOrbitRadius,
    designViewportForSize,
    type DesignViewport,
} from "./config.ts";
import { createPixiApp } from "./pixiApp.ts";
import type { CoreSnapshot, GameEvent, PowerupKind } from "./types.ts";

interface Particle {
    graphic: Graphics;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    world: boolean;
}

const SHAKE_STEP_SECONDS = 1 / 30;
const SHAKE_PATTERN = [
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
] as const;

function createParticleGraphic(color: number, size: number): Graphics {
    const graphic = new Graphics();
    graphic.rect(-Math.ceil(size / 2), -Math.ceil(size / 2), size, size).fill(color);
    return graphic;
}

function powerupColor(kind: PowerupKind): number {
    const colors: Record<PowerupKind, number> = {
        overdrive: 0xff9c38,
        repair: 0xff5c78,
        vacuum: 0x6ff7ff,
        shield: 0x9f91ff,
        frenzy: 0xff85dc,
        freeze: 0x79c9ff,
        nova: 0xb9ff4a,
        jackpot: 0xf6d36b,
    };
    return colors[kind];
}

export class GameScene {
    readonly app: Application;
    private readonly world = new Container();
    private readonly terrain = new Container();
    private readonly actors = new Container();
    private readonly projectiles = new Container();
    private readonly hazards = new Container();
    private readonly pickups = new Container();
    private readonly powerups = new Container();
    private readonly treasures = new Container();
    private readonly effects = new Container();
    private readonly screenEffects = new Container();
    private readonly playerGraphic = new Graphics();
    private readonly bladeCarousel = new Container();
    private readonly bladeGraphics: Graphics[] = [];
    private readonly enemyGraphics = new Map<number, Graphics>();
    private readonly projectileGraphics = new Map<number, Graphics>();
    private readonly hazardGraphics = new Map<number, Graphics>();
    private readonly pickupGraphics = new Map<number, Graphics>();
    private readonly powerupGraphics = new Map<number, Graphics>();
    private readonly treasureGraphics = new Map<number, Graphics>();
    private readonly enemyVisualSignatures = new Map<number, string>();
    private readonly projectileVisualSignatures = new Map<number, string>();
    private readonly hazardVisualSignatures = new Map<number, string>();
    private readonly pickupVisualSignatures = new Map<number, string>();
    private readonly powerupVisualSignatures = new Map<number, string>();
    private readonly treasureVisualSignatures = new Map<number, string>();
    private readonly sharedVisualContexts = new Map<string, GraphicsContext>();
    private readonly arenaContexts = new Map<number, GraphicsContext>();
    private readonly arenaTiles = new Map<string, Graphics>();
    private readonly particles: Particle[] = [];
    private cameraX = WORLD_WIDTH / 2;
    private cameraY = WORLD_HEIGHT / 2;
    private shake = 0;
    private shakeStepFor = 0;
    private shakePatternIndex = 0;
    private shakeOffsetX = 0;
    private shakeOffsetY = 0;
    private coinTrailTimer = 0;
    private reducedMotion = false;
    private redrawsLastFrame = 0;
    private skinId: SkinId = "salvage";
    private playerVisualSignature = "";
    private bladeSkinId: SkinId | null = null;
    private viewport: Readonly<DesignViewport> = LANDSCAPE_VIEW;
    private readonly resizeObserver: ResizeObserver;

    private constructor(
        app: Application,
        private readonly host: HTMLElement,
    ) {
        this.app = app;
        this.world.addChild(
            this.terrain,
            this.pickups,
            this.treasures,
            this.actors,
            this.projectiles,
            this.powerups,
            this.hazards,
            this.effects,
        );
        this.actors.addChild(this.bladeCarousel, this.playerGraphic);
        this.app.stage.addChild(this.world, this.screenEffects);
        this.resizeObserver = new ResizeObserver(() => this.syncViewport());
        this.resizeObserver.observe(host);
        this.syncViewport(true);
        this.prewarmArenaContexts();
        this.syncArenaTiles();
    }

    static async create(host: HTMLElement): Promise<GameScene> {
        return new GameScene(await createPixiApp(host), host);
    }

    setReducedMotion(enabled: boolean): void {
        this.reducedMotion = enabled;
        if (enabled) this.resetShake();
    }

    setSkin(skinId: SkinId): void {
        this.skinId = skinId;
    }

    render(snapshot: CoreSnapshot, delta: number): void {
        this.redrawsLastFrame = 0;
        this.syncViewport();
        this.cameraX = snapshot.player.x;
        this.cameraY = snapshot.player.y;
        this.syncArenaTiles();
        const { x: shakeX, y: shakeY } = this.updateShake(delta);
        this.world.position.set(
            Math.round(this.viewport.width / 2 + shakeX) - Math.round(this.cameraX),
            Math.round(this.viewport.height / 2 + shakeY) - Math.round(this.cameraY),
        );

        this.playerGraphic.position.set(Math.round(snapshot.player.x), Math.round(snapshot.player.y));
        const skin = SKINS[this.skinId];
        this.syncPlayer(snapshot, skin);
        this.syncBladeCarousel(snapshot, skin);
        this.syncEnemies(snapshot);
        this.syncProjectiles(snapshot);
        this.syncHazards(snapshot);
        this.syncPickups(snapshot);
        this.syncPowerups(snapshot);
        this.syncTreasures(snapshot);
        this.updateCoinTrails(snapshot, delta);
        this.updateParticles(delta);
    }

    handleEvent(event: GameEvent): void {
        if (event.type === "shot") {
            this.burst(event.x, event.y, 0x6ff7ff, 1, 16);
        } else if (event.type === "hit") {
            this.burst(event.x, event.y, event.heavy ? 0xb9ff4a : 0xfff3c4, event.heavy ? 4 : 2, 28);
        } else if (event.type === "enemy_down") {
            const color =
                event.kind === "wisp"
                    ? 0xb9ff4a
                    : event.kind === "spinner"
                      ? 0xff85dc
                      : event.kind === "gunner"
                        ? 0x6ff7ff
                        : event.kind === "sniper"
                          ? 0xff85dc
                          : event.kind === "splitter"
                            ? 0xff85dc
                            : event.kind === "mine_layer"
                              ? 0xb9ff4a
                              : event.kind === "siren"
                                ? 0x9f91ff
                                : event.kind === "brute" || event.kind === "charger"
                                  ? 0xff9c38
                                  : 0xff5c78;
            this.burst(event.x, event.y, color, event.kind === "crusher" ? 18 : 9, 50);
        } else if (event.type === "pickup") {
            this.burst(event.x, event.y, 0xe8ff7c, event.value > 2 ? 7 : 3, 25);
        } else if (event.type === "powerup") {
            const color = powerupColor(event.kind);
            this.burst(event.x, event.y, color, 14, 58);
            this.screenFlash(event.kind === "jackpot" ? 0xfff3c4 : color);
        } else if (event.type === "cache_reward") {
            const color = powerupColor(event.kind);
            this.burst(event.x, event.y, color, 20, 72);
            this.screenFlash(0xb9ff4a);
        } else if (event.type === "treasure_discovered") {
            this.burst(event.x, event.y, powerupColor(event.kind), 12, 36);
        } else if (event.type === "treasure_collected") {
            const color = powerupColor(event.kind);
            this.burst(event.x, event.y, color, 28, 86);
            this.screenFlash(color);
        } else if (event.type === "explosion") {
            this.explosion(event.x, event.y, event.radius);
        } else if (event.type === "arc_chain") {
            this.arcFlash(event.points);
        } else if (event.type === "enemy_shot") {
            this.burst(event.x, event.y, 0xff5c78, 3, 22);
        } else if (event.type === "combo") {
            this.screenFlash(0xff85dc);
        } else if (event.type === "threat_unlocked") {
            this.burst(this.cameraX, this.cameraY, 0xff9c38, 18, 68);
            this.screenFlash(0xff9c38);
        } else if (event.type === "horde_warning") {
            this.burst(this.cameraX, this.cameraY, 0xff9c38, 12, 52);
            this.screenFlash(0xff9c38);
        } else if (event.type === "horde_started") {
            this.burst(this.cameraX, this.cameraY, 0xff5c78, 32, 96);
            this.screenFlash(0xff315e);
            this.kickShake(2);
        } else if (event.type === "horde_ended") {
            this.burst(this.cameraX, this.cameraY, 0xb9ff4a, 18, 65);
        } else if (event.type === "player_hurt") {
            this.kickShake(3);
            this.screenFlash(0xff315e);
        } else if (event.type === "dash") {
            this.burst(event.x, event.y, 0x6ff7ff, 9, 42);
        } else if (event.type === "level_up") {
            this.screenFlash(0xb9ff4a);
        } else if (event.type === "upgrade_chosen") {
            this.burst(this.cameraX, this.cameraY, 0xfff3c4, 18, 60);
        } else if (event.type === "run_end") {
            this.screenFlash(0xff315e);
        }
    }

    pauseTicker(paused: boolean): void {
        if (paused) this.app.ticker.stop();
        else this.app.ticker.start();
    }

    destroy(): void {
        this.resizeObserver.disconnect();
        this.app.destroy({ removeView: true }, { children: true });
        for (const context of this.sharedVisualContexts.values()) context.destroy();
        for (const context of this.arenaContexts.values()) context.destroy();
        this.sharedVisualContexts.clear();
        this.arenaContexts.clear();
    }

    getViewport(): Readonly<DesignViewport> {
        return this.viewport;
    }

    getPerformanceDiagnostics(): {
        redrawsLastFrame: number;
        liveGraphics: number;
        visibleGraphics: number;
        sharedContexts: number;
        terrainContexts: number;
        particles: number;
        cameraShake: number;
        shakeOffsetX: number;
        shakeOffsetY: number;
        worldX: number;
        worldY: number;
    } {
        const graphics = [
            ...this.enemyGraphics.values(),
            ...this.projectileGraphics.values(),
            ...this.hazardGraphics.values(),
            ...this.pickupGraphics.values(),
            ...this.powerupGraphics.values(),
            ...this.treasureGraphics.values(),
        ];
        return {
            redrawsLastFrame: this.redrawsLastFrame,
            liveGraphics: graphics.length,
            visibleGraphics: graphics.filter((graphic) => graphic.visible).length,
            sharedContexts: this.sharedVisualContexts.size,
            terrainContexts: this.arenaContexts.size,
            particles: this.particles.length,
            cameraShake: this.shake,
            shakeOffsetX: this.shakeOffsetX,
            shakeOffsetY: this.shakeOffsetY,
            worldX: this.world.x,
            worldY: this.world.y,
        };
    }

    private kickShake(amount: number): void {
        if (this.reducedMotion) return;
        this.shake = Math.max(this.shake, amount);
        this.shakeStepFor = 0;
    }

    private resetShake(): void {
        this.shake = 0;
        this.shakeStepFor = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
    }

    private updateShake(delta: number): { x: number; y: number } {
        if (this.reducedMotion || this.shake <= 0) {
            this.resetShake();
            return { x: 0, y: 0 };
        }
        this.shake = Math.max(0, this.shake - delta * 18);
        this.shakeStepFor -= delta;
        if (this.shakeStepFor <= 0) {
            this.shakeStepFor += SHAKE_STEP_SECONDS;
            const step = SHAKE_PATTERN[this.shakePatternIndex % SHAKE_PATTERN.length] ?? SHAKE_PATTERN[0];
            const distance = Math.max(1, Math.round(this.shake / 2));
            this.shakeOffsetX = step.x * distance;
            this.shakeOffsetY = step.y * distance;
            this.shakePatternIndex += 1;
        }
        if (this.shake <= 0) this.resetShake();
        return { x: this.shakeOffsetX, y: this.shakeOffsetY };
    }

    private isWorldVisible(x: number, y: number, margin: number): boolean {
        return (
            Math.abs(x - this.cameraX) <= this.viewport.width / 2 + margin &&
            Math.abs(y - this.cameraY) <= this.viewport.height / 2 + margin
        );
    }

    private sharedContext(key: string, draw: (template: Graphics) => void): GraphicsContext {
        const cached = this.sharedVisualContexts.get(key);
        if (cached) return cached;
        const template = new Graphics({ roundPixels: true });
        draw(template);
        const context = template.context;
        template.destroy({ context: false });
        this.sharedVisualContexts.set(key, context);
        this.redrawsLastFrame += 1;
        return context;
    }

    private applySharedContext(
        signatures: Map<number, string>,
        id: number,
        signature: string,
        graphic: Graphics,
        draw: (template: Graphics) => void,
    ): void {
        if (signatures.get(id) === signature) return;
        signatures.set(id, signature);
        graphic.context = this.sharedContext(signature, draw);
    }

    private syncPlayer(snapshot: CoreSnapshot, skin: (typeof SKINS)[SkinId]): void {
        const bob = snapshot.player.dashFor > 0 ? 0 : Math.floor(snapshot.elapsed * 8) % 2;
        const signature = `player:${this.skinId}:${bob}`;
        if (signature !== this.playerVisualSignature) {
            this.playerVisualSignature = signature;
            this.playerGraphic.context = this.sharedContext(signature, (template) =>
                drawPlayer(template, snapshot.player, snapshot.elapsed, skin),
            );
        }
        const blinking = snapshot.player.invulnerableFor > 0 && Math.floor(snapshot.elapsed * 18) % 2 === 0;
        this.playerGraphic.alpha = blinking ? 0.45 : 1;
        this.playerGraphic.scale.set(snapshot.player.facingX < -0.05 ? -1 : 1, 1);
    }

    private syncBladeCarousel(snapshot: CoreSnapshot, skin: (typeof SKINS)[SkinId]): void {
        const count = bladeCountForLevel(snapshot.upgrades.scrap_moon);
        if (this.bladeSkinId !== this.skinId) {
            this.bladeSkinId = this.skinId;
            for (let index = 0; index < this.bladeGraphics.length; index += 1) {
                const graphic = this.bladeGraphics[index];
                if (graphic) {
                    graphic.context = this.sharedContext(`blade:${this.skinId}:${index}`, (template) =>
                        drawCarouselBladeSprite(template, index, skin),
                    );
                }
            }
        }
        while (this.bladeGraphics.length < count) {
            const index = this.bladeGraphics.length;
            const graphic = new Graphics({
                context: this.sharedContext(`blade:${this.skinId}:${index}`, (template) =>
                    drawCarouselBladeSprite(template, index, skin),
                ),
                roundPixels: true,
            });
            this.bladeGraphics.push(graphic);
            this.bladeCarousel.addChild(graphic);
        }
        this.bladeCarousel.position.set(Math.round(snapshot.player.x), Math.round(snapshot.player.y));
        const radius = bladeOrbitRadius(snapshot.upgrades.scrap_moon);
        for (let index = 0; index < this.bladeGraphics.length; index += 1) {
            const graphic = this.bladeGraphics[index];
            if (!graphic) continue;
            graphic.visible = index < count;
            if (!graphic.visible) continue;
            const angle = bladeOrbitAngle(snapshot.elapsed, index, snapshot.upgrades.scrap_moon);
            graphic.position.set(Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius));
            graphic.rotation = angle;
        }
    }

    private syncEnemies(snapshot: CoreSnapshot): void {
        const live = new Set<number>();
        for (const enemy of snapshot.enemies) {
            live.add(enemy.id);
            let graphic = this.enemyGraphics.get(enemy.id);
            if (!graphic) {
                graphic = new Graphics();
                this.enemyGraphics.set(enemy.id, graphic);
                this.actors.addChildAt(graphic, Math.max(0, this.actors.children.length - 1));
            }
            graphic.position.set(Math.round(enemy.x), Math.round(enemy.y));
            graphic.visible = this.isWorldVisible(enemy.x, enemy.y, enemy.radius + 28);
            if (graphic.visible) {
                const bob = Math.floor((snapshot.elapsed * 6 + enemy.id) % 2);
                const hpBucket = Math.round((Math.max(0, enemy.hp) / enemy.maxHp) * 5);
                const signature = `enemy:${enemy.kind}:${bob}:${enemy.hitFlash > 0 ? 1 : 0}:${hpBucket}:${enemy.horde ? 1 : 0}`;
                this.applySharedContext(this.enemyVisualSignatures, enemy.id, signature, graphic, (template) =>
                    drawEnemy(template, enemy, snapshot.elapsed),
                );
            }
        }
        for (const [id, graphic] of this.enemyGraphics) {
            if (live.has(id)) continue;
            graphic.destroy({ context: false });
            this.enemyGraphics.delete(id);
            this.enemyVisualSignatures.delete(id);
        }
    }

    private syncProjectiles(snapshot: CoreSnapshot): void {
        const live = new Set<number>();
        for (const projectile of snapshot.projectiles) {
            live.add(projectile.id);
            let graphic = this.projectileGraphics.get(projectile.id);
            if (!graphic) {
                graphic = new Graphics();
                this.projectileGraphics.set(projectile.id, graphic);
                this.projectiles.addChild(graphic);
            }
            graphic.position.set(Math.round(projectile.x), Math.round(projectile.y));
            graphic.visible = this.isWorldVisible(projectile.x, projectile.y, projectile.radius + 18);
            if (graphic.visible) {
                graphic.rotation = projectile.kind === "bomb" ? 0 : Math.atan2(projectile.vy, projectile.vx);
                const signature = `projectile:${projectile.kind}`;
                this.applySharedContext(
                    this.projectileVisualSignatures,
                    projectile.id,
                    signature,
                    graphic,
                    (template) => drawProjectile(template, projectile),
                );
            }
        }
        for (const [id, graphic] of this.projectileGraphics) {
            if (live.has(id)) continue;
            graphic.destroy({ context: false });
            this.projectileGraphics.delete(id);
            this.projectileVisualSignatures.delete(id);
        }
    }

    private syncHazards(snapshot: CoreSnapshot): void {
        const live = new Set<number>();
        for (const hazard of snapshot.hazards) {
            live.add(hazard.id);
            let graphic = this.hazardGraphics.get(hazard.id);
            if (!graphic) {
                graphic = new Graphics();
                this.hazardGraphics.set(hazard.id, graphic);
                this.hazards.addChild(graphic);
            }
            graphic.position.set(Math.round(hazard.x), Math.round(hazard.y));
            graphic.visible = this.isWorldVisible(hazard.x, hazard.y, hazard.radius + 20);
            if (graphic.visible) {
                const armed = hazard.kind !== "mine" || hazard.life < hazard.maxLife - 0.55;
                graphic.rotation = hazard.kind === "mine" ? 0 : Math.atan2(hazard.vy, hazard.vx);
                const signature = `hazard:${hazard.kind}:${armed ? 1 : 0}`;
                this.applySharedContext(this.hazardVisualSignatures, hazard.id, signature, graphic, (template) =>
                    drawHazard(template, hazard),
                );
            }
        }
        for (const [id, graphic] of this.hazardGraphics) {
            if (live.has(id)) continue;
            graphic.destroy({ context: false });
            this.hazardGraphics.delete(id);
            this.hazardVisualSignatures.delete(id);
        }
    }

    private syncPickups(snapshot: CoreSnapshot): void {
        const live = new Set<number>();
        for (const pickup of snapshot.pickups) {
            live.add(pickup.id);
            let graphic = this.pickupGraphics.get(pickup.id);
            if (!graphic) {
                graphic = new Graphics();
                this.pickupGraphics.set(pickup.id, graphic);
                this.pickups.addChild(graphic);
            }
            graphic.position.set(Math.round(pickup.x), Math.round(pickup.y));
            graphic.visible = this.isWorldVisible(pickup.x, pickup.y, 22);
            if (graphic.visible) {
                const bounce = Math.round(Math.sin(pickup.phase) * 2);
                const signature = `pickup:${pickup.value > 2 ? 1 : 0}:${bounce}`;
                this.applySharedContext(this.pickupVisualSignatures, pickup.id, signature, graphic, (template) =>
                    drawPickup(template, pickup),
                );
            }
        }
        for (const [id, graphic] of this.pickupGraphics) {
            if (live.has(id)) continue;
            graphic.destroy({ context: false });
            this.pickupGraphics.delete(id);
            this.pickupVisualSignatures.delete(id);
        }
    }

    private syncPowerups(snapshot: CoreSnapshot): void {
        const live = new Set<number>();
        for (const powerup of snapshot.powerups) {
            live.add(powerup.id);
            let graphic = this.powerupGraphics.get(powerup.id);
            if (!graphic) {
                graphic = new Graphics();
                this.powerupGraphics.set(powerup.id, graphic);
                this.powerups.addChild(graphic);
            }
            graphic.position.set(Math.round(powerup.x), Math.round(powerup.y));
            graphic.visible = this.isWorldVisible(powerup.x, powerup.y, 38);
            if (graphic.visible) {
                const bob = Math.round(Math.sin(powerup.phase) * 1.5);
                const blink = powerup.life < 2 && Math.floor(powerup.life * 10) % 2 === 0;
                graphic.alpha = blink ? 0.45 : 1;
                const signature = `powerup:${powerup.kind}:${bob}`;
                this.applySharedContext(this.powerupVisualSignatures, powerup.id, signature, graphic, (template) =>
                    drawPowerup(template, powerup),
                );
            }
        }
        for (const [id, graphic] of this.powerupGraphics) {
            if (live.has(id)) continue;
            graphic.destroy({ context: false });
            this.powerupGraphics.delete(id);
            this.powerupVisualSignatures.delete(id);
        }
    }

    private syncTreasures(snapshot: CoreSnapshot): void {
        const live = new Set<number>();
        for (const treasure of snapshot.treasures) {
            live.add(treasure.id);
            let graphic = this.treasureGraphics.get(treasure.id);
            if (!graphic) {
                graphic = new Graphics();
                this.treasureGraphics.set(treasure.id, graphic);
                this.treasures.addChild(graphic);
            }
            graphic.position.set(Math.round(treasure.x), Math.round(treasure.y));
            graphic.visible = this.isWorldVisible(treasure.x, treasure.y, 42);
            if (graphic.visible) {
                const bob = Math.round(Math.sin(treasure.phase) * 2);
                const sparkle = Math.sin(treasure.phase * 1.6) > 0 ? 1 : 0;
                const blink = treasure.life < 4 && Math.floor(treasure.life * 8) % 2 === 0;
                graphic.alpha = blink ? 0.45 : 1;
                const signature = `treasure:${treasure.kind}:${bob}:${sparkle}`;
                this.applySharedContext(this.treasureVisualSignatures, treasure.id, signature, graphic, (template) =>
                    drawTreasure(template, treasure),
                );
            }
        }
        for (const [id, graphic] of this.treasureGraphics) {
            if (live.has(id)) continue;
            graphic.destroy({ context: false });
            this.treasureGraphics.delete(id);
            this.treasureVisualSignatures.delete(id);
        }
    }

    private prewarmArenaContexts(): void {
        for (let variant = 0; variant < 4; variant += 1) {
            const template = createArenaVariant(variant);
            const context = template.context;
            template.destroy({ context: false });
            this.arenaContexts.set(variant, context);
        }
    }

    private syncArenaTiles(): void {
        const margin = 48;
        const minTileX = Math.floor((this.cameraX - this.viewport.width / 2 - margin) / WORLD_WIDTH);
        const maxTileX = Math.floor((this.cameraX + this.viewport.width / 2 + margin) / WORLD_WIDTH);
        const minTileY = Math.floor((this.cameraY - this.viewport.height / 2 - margin) / WORLD_HEIGHT);
        const maxTileY = Math.floor((this.cameraY + this.viewport.height / 2 + margin) / WORLD_HEIGHT);
        const live = new Set<string>();
        for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
            for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
                const key = `${tileX},${tileY}`;
                live.add(key);
                let graphic = this.arenaTiles.get(key);
                if (!graphic) {
                    const variant = arenaTileVariant(tileX, tileY);
                    const context = this.arenaContexts.get(variant);
                    if (!context) continue;
                    graphic = new Graphics({ context, roundPixels: true });
                    this.arenaTiles.set(key, graphic);
                    this.terrain.addChild(graphic);
                }
                graphic.position.set(tileX * WORLD_WIDTH, tileY * WORLD_HEIGHT);
            }
        }
        for (const [key, graphic] of this.arenaTiles) {
            if (live.has(key)) continue;
            graphic.destroy({ context: false });
            this.arenaTiles.delete(key);
        }
    }

    private explosion(x: number, y: number, radius: number): void {
        this.burst(x, y, 0xff9c38, 24, 90);
        const ring = new Graphics();
        ring.circle(x, y, radius).stroke({ color: 0xfff3c4, width: 4, alpha: 0.9 });
        this.effects.addChild(ring);
        this.particles.push({
            graphic: ring,
            vx: 0,
            vy: 0,
            life: this.reducedMotion ? 0.08 : 0.24,
            maxLife: this.reducedMotion ? 0.08 : 0.24,
            world: true,
        });
    }

    private arcFlash(points: readonly { x: number; y: number }[]): void {
        if (points.length < 2) return;
        const graphic = new Graphics();
        const first = points[0];
        if (!first) return;
        graphic.moveTo(first.x, first.y);
        for (const point of points.slice(1)) graphic.lineTo(point.x, point.y);
        graphic.stroke({ color: 0x6ff7ff, width: 5, alpha: 0.95 });
        this.effects.addChild(graphic);
        this.particles.push({
            graphic,
            vx: 0,
            vy: 0,
            life: this.reducedMotion ? 0.07 : 0.16,
            maxLife: this.reducedMotion ? 0.07 : 0.16,
            world: true,
        });
    }

    private updateCoinTrails(snapshot: CoreSnapshot, delta: number): void {
        if (this.reducedMotion) return;
        this.coinTrailTimer -= delta;
        if (this.coinTrailTimer <= 0) {
            this.coinTrailTimer += 0.1;
            let emitted = 0;
            for (const pickup of snapshot.pickups) {
                if (Math.hypot(pickup.vx, pickup.vy) < 72) continue;
                this.pixelSpark(
                    pickup.x - pickup.vx * 0.025,
                    pickup.y - pickup.vy * 0.025,
                    pickup.value > 2 ? 0xfff3c4 : 0xf6d36b,
                    2,
                    0.2,
                );
                emitted += 1;
                if (emitted >= 6) break;
            }
        }
    }

    private pixelSpark(x: number, y: number, color: number, size: number, life: number): void {
        if (this.particles.length >= 280) return;
        const graphic = createParticleGraphic(color, size);
        graphic.position.set(Math.round(x), Math.round(y));
        this.effects.addChild(graphic);
        this.particles.push({
            graphic,
            vx: 0,
            vy: -8,
            life,
            maxLife: life,
            world: true,
        });
    }

    private burst(x: number, y: number, color: number, requestedCount: number, speed: number): void {
        const count = this.reducedMotion ? Math.min(3, requestedCount) : requestedCount;
        for (let index = 0; index < count; index += 1) {
            const angle = (index / Math.max(1, count)) * Math.PI * 2 + Math.random() * 0.8;
            const velocity = speed * (0.45 + Math.random() * 0.7);
            const graphic = createParticleGraphic(color, index % 3 === 0 ? 3 : 2);
            graphic.position.set(x, y);
            this.effects.addChild(graphic);
            this.particles.push({
                graphic,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                life: 0.28 + Math.random() * 0.32,
                maxLife: 0.6,
                world: true,
            });
        }
    }

    private screenFlash(color: number): void {
        const graphic = new Graphics();
        graphic.rect(0, 0, this.viewport.width, this.viewport.height).fill({ color, alpha: 0.16 });
        this.screenEffects.addChild(graphic);
        this.particles.push({
            graphic,
            vx: 0,
            vy: 0,
            life: this.reducedMotion ? 0.08 : 0.18,
            maxLife: this.reducedMotion ? 0.08 : 0.18,
            world: false,
        });
    }

    private updateParticles(delta: number): void {
        for (let index = this.particles.length - 1; index >= 0; index -= 1) {
            const particle = this.particles[index];
            if (!particle) continue;
            particle.life -= delta;
            if (particle.life <= 0) {
                particle.graphic.destroy();
                this.particles.splice(index, 1);
                continue;
            }
            if (particle.world) {
                particle.graphic.x += particle.vx * delta;
                particle.graphic.y += particle.vy * delta;
                particle.vx *= Math.pow(0.08, delta);
                particle.vy *= Math.pow(0.08, delta);
            }
            particle.graphic.alpha = Math.max(0, particle.life / particle.maxLife);
        }
    }

    private syncViewport(force = false): void {
        const next = designViewportForSize(
            this.host.clientWidth || window.innerWidth,
            this.host.clientHeight || window.innerHeight,
        );
        if (!force && next.orientation === this.viewport.orientation) return;
        this.viewport = next;
        this.app.renderer.resize(next.width, next.height);
        document.documentElement.dataset.orientation = next.orientation;
        this.app.canvas.dataset.orientation = next.orientation;
    }
}
