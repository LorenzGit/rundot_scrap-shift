import { TOTAL_ENEMY_TYPES, UPGRADES } from "../game/config.ts";
import type { CoreSnapshot, PowerupKind, UpgradeOffer } from "../game/types.ts";
import { type CommerceProductId, productCommerceView, skinCommerceView } from "../systems/commerce.ts";
import { SKINS, SKIN_IDS, type SkinId } from "../systems/cosmetics.ts";
import { dailyRewardsView } from "../systems/dailyRewards.ts";
import type { MonetizationDiagnosticsView } from "../systems/monetization/diagnostics.ts";
import { resultsBreakLabel } from "../systems/interstitialAds.ts";
import { rewardedResultsView } from "../systems/rewardedAds.ts";
import { saveSystem } from "../systems/save.ts";
import type { GameProgress, GameRecords, GameSettings, SaveSource } from "../systems/save.ts";
import { floatingStickVector } from "./touchStick.ts";

export interface UiCallbacks {
    onPlay(): void;
    onRetry(rewardedInteracted: boolean): Promise<void>;
    onMenu(rewardedInteracted: boolean): Promise<void>;
    onPause(): void;
    onResume(): void;
    onEndRun(): void;
    onDash(): void;
    onChooseUpgrade(index: number): void;
    onSettingsChanged(settings: GameSettings): void;
    onPerformanceHudChanged(enabled: boolean): void;
    onTapMoveDiscovered(): void;
    onEquipSkin(skinId: SkinId): string;
    onPurchaseProduct(productId: CommerceProductId, placement?: string): Promise<string>;
    onClaimDaily(): Promise<string>;
    onRefreshMonetization(): Promise<void>;
    onRefreshMonetizationDiagnostics(): Promise<MonetizationDiagnosticsView>;
    onTestRewardedAd(): Promise<string>;
    onTestInterstitialAd(): Promise<string>;
    onClaimRewardedResults(baseScrap: number): Promise<string>;
    onMonetizationSurfaceViewed(surfaceId: "outfitter" | "settings"): void;
    onAdOfferViewed(baseScrap: number, status: string): void;
}

function element<T extends HTMLElement>(id: string): T {
    const value = document.getElementById(id);
    if (!value) throw new Error(`Missing #${id}`);
    return value as T;
}

function formatScore(score: number): string {
    return Math.max(0, Math.floor(score)).toString().padStart(6, "0");
}

const OFFER_PRESENTATION: Readonly<
    Record<
        CommerceProductId,
        {
            name: string;
            kicker: string;
            description: string;
            iconClass: string;
            featured?: boolean;
        }
    >
> = {
    blade_skin_foundry: {
        name: "FOUNDRY + VOID PACK",
        kicker: "2 PILOT + BLADE PALETTES",
        description: "UNLOCKS FOUNDRY GOLD AND VOID CHROME FOREVER.",
        iconClass: "offer-icon-blades",
    },
    no_interstitials: {
        name: "AD-FREE FOREVER",
        kicker: "PERMANENT RESULTS-BREAK REMOVAL",
        description: "REMOVES INTERSTITIAL ADS. OPTIONAL REWARD VIDEOS STAY AVAILABLE.",
        iconClass: "offer-icon-noads",
    },
    founder_bundle: {
        name: "FOUNDER BUNDLE",
        kicker: "BEST VALUE · ALL PERMANENT",
        description: "AD-FREE + FOUNDRY + VOID + EXCLUSIVE FIRST SHIFTER.",
        iconClass: "offer-icon-founder",
        featured: true,
    },
};

export function formatTime(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)
        .toString()
        .padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}

export class UiController {
    private readonly callbacks: UiCallbacks;
    private readonly screens = {
        menu: element<HTMLElement>("menu-screen"),
        daily: element<HTMLElement>("daily-screen"),
        skins: element<HTMLElement>("skins-screen"),
        monetizationTest: element<HTMLElement>("monetization-test-screen"),
        settings: element<HTMLElement>("settings-screen"),
        upgrade: element<HTMLElement>("upgrade-screen"),
        pause: element<HTMLElement>("pause-screen"),
        results: element<HTMLElement>("results-screen"),
    };
    private readonly hud = element<HTMLElement>("hud");
    private readonly touchControls = element<HTMLElement>("touch-controls");
    private readonly upgradeCards = element<HTMLElement>("upgrade-cards");
    private readonly appFrame = element<HTMLElement>("app-frame");
    private readonly tapMarker = element<HTMLElement>("tap-marker");
    private readonly tapKnob = element<HTMLElement>("tap-knob");
    private readonly tapTutorial = element<HTMLElement>("tap-tutorial");
    private readonly milestoneElement = element<HTMLElement>("milestone");
    private readonly flowWipe = element<HTMLElement>("flow-wipe");
    private readonly fpsCounterInput = element<HTMLInputElement>("fps-counter");
    private readonly settingsInputs = {
        musicEnabled: element<HTMLInputElement>("music-enabled"),
        musicVolume: element<HTMLInputElement>("music-volume"),
        sfxEnabled: element<HTMLInputElement>("sfx-enabled"),
        sfxVolume: element<HTMLInputElement>("sfx-volume"),
        hapticsEnabled: element<HTMLInputElement>("haptics-enabled"),
        reducedMotion: element<HTMLInputElement>("reduced-motion"),
    };
    private settings: GameSettings;
    private settingsReturn: "menu" | "pause" = "menu";
    private keys = new Set<string>();
    private tapX = 0;
    private tapY = 0;
    private tapPointer: number | null = null;
    private tapOriginX = 0;
    private tapOriginY = 0;
    private tapMoveSeen: boolean;
    private inputEnabled = false;
    private toastTimer = 0;
    private milestoneTimer = 0;
    private flowTimer = 0;
    private resultsScrap = 0;
    private resultsAdOfferRecorded = false;
    private resultsRewardedInteracted = false;
    private resultsExitInFlight = false;
    private versionTapCount = 0;
    private versionTapTimer = 0;
    private monetizationDiagnostics: MonetizationDiagnosticsView | null = null;

    constructor(
        settings: GameSettings,
        records: GameRecords,
        progress: GameProgress,
        saveSource: SaveSource,
        callbacks: UiCallbacks,
    ) {
        this.callbacks = callbacks;
        this.settings = { ...settings };
        try {
            this.tapMoveSeen = window.sessionStorage.getItem("scrap-shift.floating-stick-v1-seen") === "1";
        } catch {
            this.tapMoveSeen = false;
        }
        element("version-label").textContent = `v${__APP_VERSION__}`;
        this.updateRecords(records, progress);
        element("save-badge").textContent = saveSource === "run" ? "RUN CLOUD" : "LOCAL SAVE";
        this.populateSettings();
        this.bindButtons();
        this.bindSettings();
        this.bindInput();
    }

    movement(): { x: number; y: number } {
        if (!this.inputEnabled) return { x: 0, y: 0 };
        const keyX =
            Number(this.keys.has("arrowright") || this.keys.has("d")) -
            Number(this.keys.has("arrowleft") || this.keys.has("a"));
        const keyY =
            Number(this.keys.has("arrowdown") || this.keys.has("s")) -
            Number(this.keys.has("arrowup") || this.keys.has("w"));
        const keyboardActive = Math.abs(keyX) + Math.abs(keyY) > 0;
        const tapActive = this.tapPointer !== null;
        const x = keyboardActive ? keyX : tapActive ? this.tapX : 0;
        const y = keyboardActive ? keyY : tapActive ? this.tapY : 0;
        const length = Math.hypot(x, y);
        return length > 1 ? { x: x / length, y: y / length } : { x, y };
    }

    showMenu(records?: GameRecords, progress?: GameProgress): void {
        if (records && progress) this.updateRecords(records, progress);
        this.refreshMeta();
        this.setInputEnabled(false);
        this.activate("menu");
        this.hud.classList.add("hidden");
        this.touchControls.classList.add("hidden");
        this.tapTutorial.classList.remove("visible");
    }

    showDaily(): void {
        this.setInputEnabled(false);
        this.renderDaily();
        this.activate("daily");
    }

    showSkins(): void {
        this.setInputEnabled(false);
        this.renderSkins();
        this.activate("skins");
        this.callbacks.onMonetizationSurfaceViewed("outfitter");
        void this.callbacks.onRefreshMonetization().then(() => {
            this.renderSkins();
        });
    }

    async showMonetizationTest(): Promise<void> {
        this.setInputEnabled(false);
        const view = await this.callbacks.onRefreshMonetizationDiagnostics();
        if (!view.enabled) {
            this.toast("PRIVATE TEST BAY DISABLED");
            return;
        }
        this.monetizationDiagnostics = view;
        this.renderMonetizationDiagnostics(view);
        this.activate("monetizationTest");
    }

    refreshMeta(): void {
        const saved = saveSystem.get();
        element("wallet-salvage").textContent = String(saved.wallet.salvage);
        element("daily-wallet").textContent = String(saved.wallet.salvage);
        element("skins-wallet").textContent = String(saved.wallet.salvage);
        element("daily-badge").classList.toggle("hidden", !dailyRewardsView().claimable);
    }

    showRunning(): void {
        this.deactivateAll();
        this.hud.classList.remove("hidden");
        this.touchControls.classList.remove("hidden");
        this.setInputEnabled(true);
        this.tapTutorial.classList.toggle("visible", !this.tapMoveSeen);
        this.flow();
    }

    showUpgrade(offers: readonly Readonly<UpgradeOffer>[]): void {
        this.setInputEnabled(false);
        this.upgradeCards.replaceChildren();
        offers.forEach((offer, index) => {
            const definition = UPGRADES[offer.id];
            const button = document.createElement("button");
            button.type = "button";
            button.className = "upgrade-card pixel-frame";
            if (definition.weaponLabel) button.classList.add("weapon-card");
            button.style.setProperty("--card-accent", definition.accent);
            button.style.setProperty("--card-order", String(index));
            button.dataset.icon = definition.icon;
            button.dataset.level = String(offer.nextLevel);
            button.setAttribute(
                "aria-label",
                `${definition.weaponLabel ? `${definition.weaponLabel}. ` : ""}${definition.name}, level ${offer.nextLevel}. ${definition.description(offer.nextLevel)}`,
            );

            const icon = document.createElement("span");
            icon.className = `upgrade-icon icon-${definition.icon}`;
            icon.setAttribute("aria-hidden", "true");
            const family = document.createElement("span");
            family.className = "card-family";
            const addsWeapon = offer.nextLevel === 1 && offer.id !== "hot_coils" && offer.id !== "split_shot";
            family.textContent = definition.weaponLabel
                ? `${addsWeapon ? "ADD WEAPON" : "UPGRADE"} · ${definition.weaponLabel}`
                : "SYSTEM UPGRADE";
            const level = document.createElement("span");
            level.className = "card-level";
            level.textContent = `LV ${offer.nextLevel}`;
            const name = document.createElement("strong");
            name.textContent = definition.name;
            const description = document.createElement("span");
            description.className = "card-description";
            description.textContent = definition.description(offer.nextLevel);
            button.append(icon, family, level, name, description);
            button.addEventListener("click", () => this.callbacks.onChooseUpgrade(index));
            this.upgradeCards.appendChild(button);
        });
        this.activate("upgrade");
    }

    showPause(): void {
        this.setInputEnabled(false);
        this.activate("pause");
    }

    showResults(snapshot: CoreSnapshot): void {
        this.setInputEnabled(false);
        this.resultsScrap = snapshot.scrap;
        this.resultsAdOfferRecorded = false;
        this.resultsRewardedInteracted = false;
        this.resultsExitInFlight = false;
        const retryButton = element<HTMLButtonElement>("retry-button");
        const menuButton = element<HTMLButtonElement>("menu-button");
        retryButton.disabled = false;
        retryButton.textContent = "RUN IT BACK";
        menuButton.disabled = false;
        menuButton.textContent = "MAIN MENU";
        element("results-kicker").textContent = "SHIFT ENDED";
        element("results-title").textContent = "RUN OVER";
        element("results-score").textContent = formatScore(snapshot.score);
        element("results-time").textContent = formatTime(snapshot.elapsed);
        element("results-level").textContent = String(snapshot.level);
        element("results-kills").textContent = String(snapshot.kills);
        element("results-scrap").textContent = String(snapshot.scrap);
        element("results-combo").textContent = String(snapshot.maxCombo);
        element("results-caches").textContent = String(snapshot.cachesOpened);
        element("results-treasures").textContent = String(snapshot.treasuresOpened);
        element("results-reward").textContent = `+${snapshot.scrap} SCRAP`;
        element("results-break-note").textContent = resultsBreakLabel();
        this.renderResultsAd();
        this.activate("results");
        this.hud.classList.add("hidden");
        this.touchControls.classList.add("hidden");
        this.tapTutorial.classList.remove("visible");
        void this.callbacks.onRefreshMonetization().then(() => this.renderResultsAd());
    }

    updateHud(snapshot: CoreSnapshot): void {
        const hpRatio = snapshot.player.hp / snapshot.player.maxHp;
        element("hp-fill").style.width = `${Math.max(0, hpRatio) * 100}%`;
        element("hp-text").textContent = `${Math.ceil(snapshot.player.hp)}/${snapshot.player.maxHp}`;
        element("score-text").textContent = formatScore(snapshot.score);
        element("time-text").textContent = formatTime(snapshot.elapsed);
        element("wave-text").textContent = snapshot.hordeActive
            ? `HORDE ${snapshot.hordeNumber}`
            : `SURVIVE · W${snapshot.wave}`;
        element("level-text").textContent = `LEVEL ${snapshot.level}`;
        element("energy-text").textContent = `${snapshot.energy}/${snapshot.energyNeeded}`;
        element("energy-fill").style.width = `${Math.min(100, (snapshot.energy / snapshot.energyNeeded) * 100)}%`;
        element("power-blaster").textContent = String(
            1 + Math.max(snapshot.upgrades.hot_coils, snapshot.upgrades.split_shot),
        );
        element("power-hook").textContent = String(snapshot.upgrades.hook_blade);
        element("power-blades").textContent = String(snapshot.upgrades.scrap_moon);
        element("power-bloom").textContent = String(snapshot.upgrades.static_bloom);
        element("power-bomb").textContent = String(snapshot.upgrades.scrap_bomb);
        element("power-arc").textContent = String(snapshot.upgrades.arc_chain);
        element("combo-text").textContent = `COMBO ${snapshot.combo}`;
        element("multiplier-text").textContent = `x${snapshot.scoreMultiplier.toFixed(2)}`;
        element("combo-fill").style.width = `${snapshot.comboProgress * 100}%`;
        element("cache-text").textContent =
            `${Math.round(snapshot.cacheProgress * snapshot.cacheNeeded)}/${snapshot.cacheNeeded}`;
        element("cache-fill").style.width = `${snapshot.cacheProgress * 100}%`;
        element("threat-text").textContent =
            `${snapshot.unlockedEnemies.length}/${TOTAL_ENEMY_TYPES}${snapshot.nextThreatLevel ? ` · NEXT ${snapshot.nextThreatLevel}` : " · ALL LIVE"}`;
        element("threat-fill").style.width = `${(snapshot.unlockedEnemies.length / TOTAL_ENEMY_TYPES) * 100}%`;
        element("dash-cooldown-fill").style.height = `${snapshot.dashProgress * 100}%`;
        element("dash-button").classList.toggle("cooldown", !snapshot.dashReady);
        this.updateEffect("overdrive", snapshot.activeEffects.overdrive, "s");
        this.updateEffect("vacuum", snapshot.activeEffects.vacuum, "s");
        this.updateEffect("shield", snapshot.activeEffects.shield, "x");
        this.updateEffect("frenzy", snapshot.activeEffects.frenzy, "s");
        this.updateEffect("freeze", snapshot.activeEffects.freeze, "s");
    }

    toast(message: string): void {
        const toast = element("toast");
        toast.textContent = message;
        toast.classList.remove("visible");
        void toast.offsetWidth;
        toast.classList.add("visible");
        if (this.toastTimer) window.clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1500);
    }

    milestone(kicker: string, title: string, cardKind?: PowerupKind): void {
        element("milestone-kicker").textContent = kicker;
        element("milestone-title").textContent = title;
        element("milestone-card").classList.toggle("hidden", cardKind === undefined);
        this.milestoneElement.classList.toggle("has-card", cardKind !== undefined);
        this.milestoneElement.dataset.card = cardKind ?? "";
        this.milestoneElement.classList.remove("visible");
        void this.milestoneElement.offsetWidth;
        this.milestoneElement.classList.add("visible");
        if (this.milestoneTimer) window.clearTimeout(this.milestoneTimer);
        this.milestoneTimer = window.setTimeout(() => this.milestoneElement.classList.remove("visible"), 1550);
    }

    openSettings(from: "menu" | "pause" = "menu"): void {
        this.settingsReturn = from;
        this.populateSettings();
        this.renderSettingsOffer();
        this.setInputEnabled(false);
        this.activate("settings");
        if (from === "menu") this.callbacks.onMonetizationSurfaceViewed("settings");
        void this.callbacks.onRefreshMonetization().then(() => this.renderSettingsOffer());
    }

    setPerformanceHudEnabled(enabled: boolean): void {
        this.fpsCounterInput.checked = enabled;
        this.callbacks.onPerformanceHudChanged(enabled);
    }

    private updateRecords(records: GameRecords, progress: GameProgress): void {
        element("best-score").textContent = formatScore(records.bestScore);
        element("best-level").textContent = String(records.highestLevel);
        element("total-runs").textContent = String(records.totalRuns);
        element("lifetime-kills").textContent = String(progress.lifetimeKills);
        element("lifetime-scrap").textContent = String(progress.lifetimeScrap);
        element("lifetime-caches").textContent = String(progress.cachesOpened);
    }

    private renderDaily(): void {
        const view = dailyRewardsView();
        const grid = element<HTMLElement>("daily-grid");
        grid.replaceChildren();
        view.rewards.forEach((reward, index) => {
            const tile = document.createElement("article");
            const completed = index < Math.min(view.totalClaims, view.rewards.length);
            const current = index === view.currentIndex;
            tile.className = `daily-tile pixel-frame${completed ? " claimed" : ""}${current ? " current" : ""}`;
            tile.style.setProperty("--reward-order", String(index));

            const day = document.createElement("span");
            day.className = "daily-day";
            day.textContent = `DAY ${reward.day}`;
            const icon = document.createElement("i");
            icon.className = reward.skinId ? `reward-skin ${SKINS[reward.skinId].cssClass}` : "reward-salvage";
            icon.setAttribute("aria-hidden", "true");
            const label = document.createElement("strong");
            label.textContent = reward.label;
            const state = document.createElement("small");
            state.textContent = completed ? "CLAIMED" : current ? "NEXT" : "LOCKED";
            tile.append(day, icon, label, state);
            grid.appendChild(tile);
        });
        // Show the streak, not just the schedule: the number a player is
        // protecting is what makes them come back tomorrow, and it is what the
        // 24h reminder promises.
        element("daily-authority").textContent =
            view.streak > 1 ? `${view.streak} DAY STREAK · ${view.authorityLabel}` : view.authorityLabel;
        element("daily-next").textContent = view.nextLabel;
        const claim = element<HTMLButtonElement>("daily-claim");
        claim.disabled = !view.claimable;
        claim.textContent = view.claimedToday
            ? "CLAIMED TODAY"
            : view.claimable
              ? "CLAIM TODAY"
              : "TIME CHECK REQUIRED";
        this.refreshMeta();
    }

    private renderSkins(): void {
        this.renderProductOffers();
        const grid = element<HTMLElement>("skin-grid");
        const selectedSkin = saveSystem.get().cosmetics.selectedSkin;
        grid.replaceChildren();
        for (const id of SKIN_IDS) {
            const skin = SKINS[id];
            const commerce = skinCommerceView(id);
            if (!commerce.visible) continue;
            const card = document.createElement("article");
            card.className = `skin-card pixel-frame ${skin.cssClass}${selectedSkin === id ? " equipped" : ""}`;

            const art = document.createElement("div");
            art.className = "skin-preview";
            art.setAttribute("aria-hidden", "true");
            art.innerHTML =
                '<i class="skin-pilot"><b></b></i><i class="skin-sword sword-a"></i><i class="skin-sword sword-b"></i>';
            const copy = document.createElement("div");
            copy.className = "skin-copy";
            const kicker = document.createElement("span");
            kicker.textContent = commerce.statusLabel;
            const name = document.createElement("strong");
            name.textContent = skin.name;
            const tagline = document.createElement("small");
            tagline.textContent = skin.tagline;
            const price = document.createElement("em");
            price.textContent = commerce.priceLabel;
            copy.append(kicker, name, tagline, price);

            const action = document.createElement("button");
            action.type = "button";
            action.className = `pixel-button ${commerce.owned ? "secondary-button" : "skin-buy-button"}`;
            if (commerce.owned) {
                action.textContent = selectedSkin === id ? "EQUIPPED" : "EQUIP";
                action.disabled = selectedSkin === id;
                action.addEventListener("click", () => {
                    this.toast(this.callbacks.onEquipSkin(id));
                    this.renderSkins();
                });
            } else if (commerce.productId) {
                const productId = commerce.productId;
                action.textContent = commerce.purchasable ? `BUY · ${commerce.priceLabel}` : commerce.statusLabel;
                action.disabled = !commerce.purchasable;
                action.addEventListener("click", async () => {
                    action.disabled = true;
                    action.textContent = "CHECKING PRICE…";
                    this.toast(await this.callbacks.onPurchaseProduct(productId, "outfitter_skin"));
                    this.renderSkins();
                });
            } else {
                action.textContent = commerce.statusLabel;
                action.disabled = true;
            }
            card.append(art, copy, action);
            grid.appendChild(card);
        }
        this.refreshMeta();
    }

    private renderProductOffers(): void {
        const section = element("storefront-offers");
        const grid = element("offer-grid");
        grid.replaceChildren();
        const productIds: readonly CommerceProductId[] = ["founder_bundle", "blade_skin_foundry", "no_interstitials"];
        for (const productId of productIds) {
            const commerce = productCommerceView(productId);
            if (!commerce.visible) continue;
            const presentation = OFFER_PRESENTATION[productId];
            const card = document.createElement("article");
            card.className = `offer-card pixel-frame${presentation.featured ? " featured" : ""}${
                commerce.owned ? " owned" : ""
            }`;

            const icon = document.createElement("i");
            icon.className = `offer-icon ${presentation.iconClass}`;
            icon.setAttribute("aria-hidden", "true");
            const copy = document.createElement("div");
            copy.className = "offer-copy";
            const kicker = document.createElement("span");
            kicker.textContent = commerce.owned ? "OWNED · VERIFIED" : presentation.kicker;
            const name = document.createElement("strong");
            name.textContent = presentation.name;
            const description = document.createElement("small");
            description.textContent = presentation.description;
            copy.append(kicker, name, description);

            const action = document.createElement("button");
            action.type = "button";
            action.className = `pixel-button ${commerce.owned ? "secondary-button" : "skin-buy-button"}`;
            action.disabled = commerce.owned || !commerce.purchasable;
            action.textContent = commerce.owned
                ? "OWNED"
                : commerce.purchasable
                  ? `BUY · ${commerce.priceLabel}`
                  : commerce.statusLabel;
            action.addEventListener("click", async () => {
                await this.purchaseOffer(productId, action, "outfitter_offer");
                this.renderSkins();
                this.renderSettingsOffer();
            });
            card.append(icon, copy, action);
            grid.appendChild(card);
        }
        section.classList.toggle("hidden", grid.childElementCount === 0);
    }

    private renderSettingsOffer(): void {
        const commerce = productCommerceView("no_interstitials");
        const offer = element("settings-noads-offer");
        const button = element<HTMLButtonElement>("settings-noads-button");
        offer.classList.toggle("hidden", !commerce.visible);
        offer.classList.toggle("owned", commerce.owned);
        button.disabled = commerce.owned || !commerce.purchasable;
        button.textContent = commerce.owned
            ? "OWNED · ACTIVE"
            : commerce.purchasable
              ? `BUY · ${commerce.priceLabel}`
              : commerce.statusLabel;
        button.onclick = async () => {
            await this.purchaseOffer("no_interstitials", button, "settings");
            this.renderSettingsOffer();
        };
    }

    private async purchaseOffer(
        productId: CommerceProductId,
        button: HTMLButtonElement,
        placement: string,
    ): Promise<void> {
        button.disabled = true;
        button.textContent = "OPENING CHECKOUT…";
        this.toast(await this.callbacks.onPurchaseProduct(productId, placement));
    }

    private renderResultsAd(): void {
        const view = rewardedResultsView(this.resultsScrap);
        const button = element<HTMLButtonElement>("results-ad-button");
        const offer = element("results-ad-offer");
        element("results-ad-status").textContent = view.status;
        button.textContent = view.action;
        button.disabled = !view.enabled;
        offer.classList.toggle("hidden", !view.visible);
        offer.classList.toggle("claimed", view.claimed);
        element("results-break-note").textContent = resultsBreakLabel();
        if (view.visible && !this.resultsAdOfferRecorded) {
            this.resultsAdOfferRecorded = true;
            this.callbacks.onAdOfferViewed(this.resultsScrap, view.status);
        }
    }

    private renderMonetizationDiagnostics(view: MonetizationDiagnosticsView): void {
        const mock = view.environment === "LOCAL MOCK";
        const setStatus = (id: string, ready: boolean, mockLabel?: string): void => {
            const target = element(id);
            target.textContent = mock && mockLabel ? mockLabel : ready ? "READY" : "BLOCKED";
            target.classList.toggle("ready", ready && !(mock && mockLabel));
        };
        element("monetization-test-environment").textContent = view.environment;
        setStatus("test-host-status", view.hostReady);
        setStatus("test-liveops-status", view.liveOpsReady, "MOCK CONFIG");
        setStatus("test-shop-status", view.shopReady);
        setStatus("test-entitlements-status", view.entitlementsReady, "MOCK ONLY");
        setStatus("test-ads-status", view.adsReady, "MOCK ONLY");
        setStatus("test-ad-fill-status", view.adFillReady, "MOCK ONLY");
        setStatus("test-interstitial-fill-status", view.interstitialFillReady, "MOCK ONLY");
        element("test-config-id").textContent = view.configVersion;
        element("test-catalog-id").textContent = view.catalogConfigId;
        element("test-catalog-count").textContent = String(view.catalogItemCount);
        element("test-entitlement-count").textContent = String(view.entitlementCount);
        element("test-product-name").textContent = view.testProductName;
        element("test-product-state").textContent = view.testProductOwned
            ? "ENTITLEMENT VERIFIED"
            : `${view.testProductId} · ${view.testProductPrice}`;
        const purchaseButton = element<HTMLButtonElement>("test-purchase-button");
        purchaseButton.disabled = !view.purchaseReady || view.testProductOwned;
        purchaseButton.textContent = view.testProductOwned
            ? "ALREADY OWNED"
            : view.purchaseReady
              ? `TEST PURCHASE · ${view.testProductPrice}`
              : "PURCHASE BLOCKED";
        const adButton = element<HTMLButtonElement>("test-ad-button");
        adButton.disabled = !view.adTestReady;
        adButton.textContent = view.adTestReady ? "TEST VIDEO · +1 SALVAGE" : "VIDEO UNAVAILABLE";
        const interstitialButton = element<HTMLButtonElement>("test-interstitial-button");
        interstitialButton.disabled = !view.interstitialTestReady;
        interstitialButton.textContent = view.interstitialTestReady ? "TEST RESULTS AD" : "INTERSTITIAL UNAVAILABLE";
    }

    private async refreshMonetizationDiagnostics(log = "CHECKS REFRESHED"): Promise<void> {
        const view = await this.callbacks.onRefreshMonetizationDiagnostics();
        this.monetizationDiagnostics = view;
        this.renderMonetizationDiagnostics(view);
        element("monetization-test-log").textContent = log;
    }

    private updateEffect(
        kind: "overdrive" | "vacuum" | "shield" | "frenzy" | "freeze",
        value: number,
        suffix: string,
    ): void {
        const chip = element(`effect-${kind}`);
        chip.classList.toggle("hidden", value <= 0);
        const counter = chip.querySelector("b");
        if (counter) counter.textContent = `${Math.ceil(value)}${suffix}`;
    }

    private populateSettings(): void {
        this.settingsInputs.musicEnabled.checked = this.settings.musicEnabled;
        this.settingsInputs.musicVolume.value = String(this.settings.musicVolume);
        this.settingsInputs.sfxEnabled.checked = this.settings.sfxEnabled;
        this.settingsInputs.sfxVolume.value = String(this.settings.sfxVolume);
        this.settingsInputs.hapticsEnabled.checked = this.settings.hapticsEnabled;
        this.settingsInputs.reducedMotion.checked = this.settings.reducedMotion;
    }

    private readSettings(): GameSettings {
        return {
            musicEnabled: this.settingsInputs.musicEnabled.checked,
            musicVolume: Number(this.settingsInputs.musicVolume.value),
            sfxEnabled: this.settingsInputs.sfxEnabled.checked,
            sfxVolume: Number(this.settingsInputs.sfxVolume.value),
            hapticsEnabled: this.settingsInputs.hapticsEnabled.checked,
            reducedMotion: this.settingsInputs.reducedMotion.checked,
        };
    }

    private bindButtons(): void {
        element("play-button").addEventListener("click", this.callbacks.onPlay);
        element("retry-button").addEventListener("click", () => void this.exitResults("retry"));
        element("menu-button").addEventListener("click", () => void this.exitResults("menu"));
        element("pause-button").addEventListener("click", this.callbacks.onPause);
        element("resume-button").addEventListener("click", this.callbacks.onResume);
        element("quit-run-button").addEventListener("click", this.callbacks.onEndRun);
        element("dash-button").addEventListener("pointerdown", (event) => {
            event.preventDefault();
            this.callbacks.onDash();
        });
        element("settings-button").addEventListener("click", () => this.openSettings("menu"));
        element("daily-button").addEventListener("click", () => this.showDaily());
        element("skins-button").addEventListener("click", () => this.showSkins());
        element("version-label").addEventListener("click", () => {
            this.versionTapCount += 1;
            if (this.versionTapTimer) window.clearTimeout(this.versionTapTimer);
            this.versionTapTimer = window.setTimeout(() => {
                this.versionTapCount = 0;
            }, 1800);
            if (this.versionTapCount >= 5) {
                this.versionTapCount = 0;
                void this.showMonetizationTest();
            }
        });
        element("performance-hud").addEventListener("click", () => this.setPerformanceHudEnabled(false));
        element("daily-back").addEventListener("click", () => this.showMenu());
        element("skins-back").addEventListener("click", () => this.showMenu());
        element("monetization-test-back").addEventListener("click", () => this.showMenu());
        element("monetization-test-refresh").addEventListener("click", () => {
            element("monetization-test-log").textContent = "CHECKING PRIVATE RUN HOST…";
            void this.refreshMonetizationDiagnostics();
        });
        element("test-purchase-button").addEventListener("click", async () => {
            const view = this.monetizationDiagnostics;
            if (!view?.purchaseReady || view.testProductOwned) return;
            const button = element<HTMLButtonElement>("test-purchase-button");
            button.disabled = true;
            button.textContent = "OPENING CHECKOUT…";
            const message = await this.callbacks.onPurchaseProduct(
                view.testProductId as CommerceProductId,
                "private_test_bay",
            );
            await this.refreshMonetizationDiagnostics(message);
        });
        element("test-ad-button").addEventListener("click", async () => {
            const button = element<HTMLButtonElement>("test-ad-button");
            button.disabled = true;
            button.textContent = "OPENING VIDEO…";
            const message = await this.callbacks.onTestRewardedAd();
            this.refreshMeta();
            await this.refreshMonetizationDiagnostics(message);
        });
        element("test-interstitial-button").addEventListener("click", async () => {
            const button = element<HTMLButtonElement>("test-interstitial-button");
            button.disabled = true;
            button.textContent = "OPENING RESULTS AD…";
            const message = await this.callbacks.onTestInterstitialAd();
            await this.refreshMonetizationDiagnostics(message);
        });
        element("results-ad-button").addEventListener("click", async () => {
            const button = element<HTMLButtonElement>("results-ad-button");
            this.resultsRewardedInteracted = true;
            button.disabled = true;
            button.textContent = "OPENING VIDEO…";
            this.toast(await this.callbacks.onClaimRewardedResults(this.resultsScrap));
            this.refreshMeta();
            this.renderResultsAd();
            void this.callbacks.onRefreshMonetization().then(() => this.renderResultsAd());
        });
        element("daily-claim").addEventListener("click", async () => {
            const button = element<HTMLButtonElement>("daily-claim");
            button.disabled = true;
            button.textContent = "SECURING DROP…";
            this.toast(await this.callbacks.onClaimDaily());
            this.renderDaily();
        });
        element("pause-settings-button").addEventListener("click", () => this.openSettings("pause"));
        element("settings-back").addEventListener("click", () => {
            if (this.settingsReturn === "pause") this.showPause();
            else this.showMenu();
        });
    }

    private async exitResults(destination: "retry" | "menu"): Promise<void> {
        if (this.resultsExitInFlight) return;
        this.resultsExitInFlight = true;
        const retry = element<HTMLButtonElement>("retry-button");
        const menu = element<HTMLButtonElement>("menu-button");
        retry.disabled = true;
        menu.disabled = true;
        const target = destination === "retry" ? retry : menu;
        target.textContent = "CONTINUING…";
        if (destination === "retry") await this.callbacks.onRetry(this.resultsRewardedInteracted);
        else await this.callbacks.onMenu(this.resultsRewardedInteracted);
    }

    private bindSettings(): void {
        for (const input of Object.values(this.settingsInputs)) {
            input.addEventListener("input", () => {
                this.settings = this.readSettings();
                this.callbacks.onSettingsChanged(this.settings);
            });
        }
        this.fpsCounterInput.addEventListener("input", () => {
            this.callbacks.onPerformanceHudChanged(this.fpsCounterInput.checked);
        });
    }

    private bindInput(): void {
        window.addEventListener("keydown", (event) => {
            const key = event.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(key)) {
                event.preventDefault();
            }
            this.keys.add(key);
            if (key === " " && !event.repeat) this.callbacks.onDash();
            if ((key === "escape" || key === "p") && !event.repeat) this.callbacks.onPause();
        });
        window.addEventListener("keyup", (event) => this.keys.delete(event.key.toLowerCase()));
        window.addEventListener("blur", () => {
            this.keys.clear();
            this.clearTouchMovement();
        });

        this.appFrame.addEventListener("pointerdown", (event) => {
            if (!this.inputEnabled || !event.isPrimary) return;
            if (event.target instanceof Element && event.target.closest("button, .screen.active")) return;
            event.preventDefault();
            this.tapPointer = event.pointerId;
            this.tapOriginX = event.clientX;
            this.tapOriginY = event.clientY;
            this.tapX = 0;
            this.tapY = 0;
            try {
                this.appFrame.setPointerCapture(event.pointerId);
            } catch {
                // Older WebViews can still deliver the initial tap without capture.
            }
            this.beginTouchStick(event);
            this.discoverTapMovement();
        });
        this.appFrame.addEventListener("pointermove", (event) => {
            if (event.pointerId !== this.tapPointer) return;
            event.preventDefault();
            this.updateTapMovement(event);
        });
        const releaseTap = (event: PointerEvent): void => {
            if (event.pointerId !== this.tapPointer) return;
            this.releaseTouchStick();
        };
        const cancelTap = (event: PointerEvent): void => {
            if (event.pointerId !== this.tapPointer) return;
            this.releaseTouchStick();
        };
        this.appFrame.addEventListener("pointerup", releaseTap);
        this.appFrame.addEventListener("pointercancel", cancelTap);
        window.addEventListener("pointerup", releaseTap);
        window.addEventListener("pointercancel", cancelTap);
    }

    private beginTouchStick(event: PointerEvent): void {
        const bounds = this.appFrame.getBoundingClientRect();
        this.tapMarker.style.left = `${event.clientX - bounds.left}px`;
        this.tapMarker.style.top = `${event.clientY - bounds.top}px`;
        this.tapMarker.classList.add("active");
        this.tapKnob.style.transform = "translate(0, 0)";
    }

    private updateTapMovement(event: PointerEvent): void {
        const bounds = this.appFrame.getBoundingClientRect();
        const maxDistance = Math.max(42, Math.min(62, Math.min(bounds.width, bounds.height) * 0.13));
        const vector = floatingStickVector(
            this.tapOriginX,
            this.tapOriginY,
            event.clientX,
            event.clientY,
            maxDistance,
            7,
        );
        this.tapX = vector.x;
        this.tapY = vector.y;
        this.tapKnob.style.transform = `translate(${vector.knobX}px, ${vector.knobY}px)`;
    }

    private releaseTouchStick(): void {
        this.tapPointer = null;
        this.tapX = 0;
        this.tapY = 0;
        this.tapMarker.classList.remove("active");
        this.tapKnob.style.transform = "translate(0, 0)";
    }

    private discoverTapMovement(): void {
        if (this.tapMoveSeen) return;
        this.tapMoveSeen = true;
        try {
            window.sessionStorage.setItem("scrap-shift.floating-stick-v1-seen", "1");
        } catch {
            // The in-memory flag still prevents repeat prompts for this page.
        }
        this.tapTutorial.classList.remove("visible");
        this.callbacks.onTapMoveDiscovered();
        this.toast("FLOAT STICK ONLINE · RELEASE TO STOP");
    }

    private setInputEnabled(enabled: boolean): void {
        this.inputEnabled = enabled;
        this.touchControls.classList.toggle("passive", !enabled);
        if (!enabled) this.clearTouchMovement();
    }

    private clearTouchMovement(): void {
        this.releaseTouchStick();
    }

    private activate(name: keyof UiController["screens"]): void {
        this.deactivateAll();
        this.screens[name].classList.add("active");
        this.flow();
    }

    private deactivateAll(): void {
        for (const screen of Object.values(this.screens)) screen.classList.remove("active");
    }

    private flow(): void {
        this.flowWipe.classList.remove("play");
        void this.flowWipe.offsetWidth;
        this.flowWipe.classList.add("play");
        if (this.flowTimer) window.clearTimeout(this.flowTimer);
        this.flowTimer = window.setTimeout(() => this.flowWipe.classList.remove("play"), 520);
    }
}
