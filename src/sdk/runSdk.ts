import { HapticFeedbackStyle } from "@series-inc/rundot-game-sdk";
import type {
    Entitlement,
    LiveOpsConfigResult,
    ShopOrderHistoryResponse,
    ShopPurchaseResponse,
    StorefrontResponse,
    Subscription,
} from "@series-inc/rundot-game-sdk";
import RundotGameAPI from "@series-inc/rundot-game-sdk/api";
import { safeAreaOffsetsForFrame, type EdgeInsets } from "./safeArea.ts";

export interface RunCapabilities {
    host: boolean;
    mock: boolean;
    storage: boolean;
    analytics: boolean;
    haptics: boolean;
    ads: boolean;
    liveops: boolean;
    shop: boolean;
    entitlements: boolean;
}

const OFFLINE_CAPABILITIES: RunCapabilities = {
    host: false,
    mock: false,
    storage: false,
    analytics: false,
    haptics: false,
    ads: false,
    liveops: false,
    shop: false,
    entitlements: false,
};

let ready = false;
let capabilities: RunCapabilities = OFFLINE_CAPABILITIES;
let safeAreaResizeBound = false;
let safeAreaFrame = 0;

function namespaceAvailable(name: string): boolean {
    return typeof (RundotGameAPI as unknown as Record<string, unknown>)[name] === "object";
}

function snapshotCapabilities(): RunCapabilities {
    if (!ready) return OFFLINE_CAPABILITIES;
    const environment = RundotGameAPI._environmentData?.capabilities;
    let haptics = false;
    try {
        const device = RundotGameAPI.system.getDevice();
        haptics = device?.haptics?.supported === true && device?.haptics?.enabled === true;
    } catch {
        haptics = false;
    }
    return {
        host: true,
        mock: RundotGameAPI.isMock(),
        storage: namespaceAvailable("appStorage"),
        analytics: namespaceAvailable("analytics"),
        haptics,
        ads: namespaceAvailable("ads") && environment?.ads !== false,
        liveops: namespaceAvailable("liveops"),
        shop: namespaceAvailable("shop") && environment?.purchases === true,
        entitlements: namespaceAvailable("entitlements"),
    };
}

export function getRunCapabilities(): Readonly<RunCapabilities> {
    return capabilities;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutId = 0;
    const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });
    try {
        return await Promise.race([operation, timeout]);
    } finally {
        window.clearTimeout(timeoutId);
    }
}

export async function initSdk(): Promise<boolean> {
    const embedded = window.parent !== window;
    const deadline = performance.now() + (embedded ? 1500 : 0);
    do {
        try {
            if (RundotGameAPI.isAvailable() || RundotGameAPI.isMock()) {
                ready = true;
                break;
            }
        } catch {
            break;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    } while (performance.now() < deadline);

    capabilities = snapshotCapabilities();
    if (!ready) console.info("[runSdk] RUN host unavailable; local fallbacks active");
    return ready;
}

export function applyRunSafeArea(): void {
    let safeArea: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    if (ready) {
        try {
            const hostSafeArea = RundotGameAPI.system.getSafeArea();
            safeArea = {
                top: Math.max(0, Number(hostSafeArea.top) || 0),
                right: Math.max(0, Number(hostSafeArea.right) || 0),
                bottom: Math.max(0, Number(hostSafeArea.bottom) || 0),
                left: Math.max(0, Number(hostSafeArea.left) || 0),
            };
        } catch {
            // Keep CSS env fallbacks.
        }
    }
    const frame = document.getElementById("app-frame");
    if (frame) {
        safeArea = safeAreaOffsetsForFrame(safeArea, frame.getBoundingClientRect(), {
            width: window.innerWidth,
            height: window.innerHeight,
        });
    }
    const root = document.documentElement;
    root.style.setProperty("--run-safe-top", `${safeArea.top}px`);
    root.style.setProperty("--run-safe-right", `${safeArea.right}px`);
    root.style.setProperty("--run-safe-bottom", `${safeArea.bottom}px`);
    root.style.setProperty("--run-safe-left", `${safeArea.left}px`);
}

export function bindRunSafeArea(): void {
    applyRunSafeArea();
    if (safeAreaResizeBound) return;
    safeAreaResizeBound = true;
    window.addEventListener(
        "resize",
        () => {
            window.cancelAnimationFrame(safeAreaFrame);
            safeAreaFrame = window.requestAnimationFrame(applyRunSafeArea);
        },
        { passive: true },
    );
}

export async function readAppStorage(key: string): Promise<{ ok: boolean; value: string | null }> {
    if (!capabilities.storage) return { ok: false, value: null };
    try {
        return {
            ok: true,
            value: await withTimeout(RundotGameAPI.appStorage.getItem(key), 2000, "appStorage.getItem"),
        };
    } catch (error) {
        console.warn("[runSdk] save read failed", error);
        return { ok: false, value: null };
    }
}

export async function writeAppStorage(key: string, value: string): Promise<boolean> {
    if (!capabilities.storage) return false;
    try {
        await withTimeout(RundotGameAPI.appStorage.setItem(key, value), 2000, "appStorage.setItem");
        return true;
    } catch (error) {
        console.warn("[runSdk] save write failed", error);
        return false;
    }
}

export async function requestServerEpochMs(): Promise<number | null> {
    if (!capabilities.host) return null;
    try {
        const result = await withTimeout(RundotGameAPI.requestTimeAsync(), 2000, "requestTimeAsync");
        return typeof result.serverTime === "number" ? result.serverTime : null;
    } catch (error) {
        console.warn("[runSdk] trusted time unavailable", error);
        return null;
    }
}

export async function fetchLiveOpsConfig(): Promise<LiveOpsConfigResult | null> {
    if (!capabilities.liveops) return null;
    try {
        return await withTimeout(RundotGameAPI.liveops.getConfigAsync(), 3000, "liveops.getConfigAsync");
    } catch (error) {
        console.warn("[runSdk] LiveOps unavailable", error);
        return null;
    }
}

export async function isRewardedAdReady(): Promise<boolean> {
    if (!capabilities.ads) return false;
    try {
        return await withTimeout(RundotGameAPI.ads.isRewardedAdReadyAsync(), 2500, "ads.isRewardedAdReadyAsync");
    } catch (error) {
        console.warn("[runSdk] rewarded ad readiness unavailable", error);
        return false;
    }
}

export async function showRewardedAd(placementId: string, placementName: string): Promise<boolean> {
    // Offered vs complete: one without the other cannot separate a weak reward
    // from missing inventory. Emitted here so every placement is covered once.
    void recordAnalytics("rewarded_ad_offered", { ad_display_id: placementId });
    if (!capabilities.ads) return false;
    try {
        const completed = await withTimeout(
            RundotGameAPI.ads.showRewardedAdAsync({
                adDisplayId: placementId,
                adDisplayName: placementName,
            }),
            120_000,
            "ads.showRewardedAdAsync",
        );
        // Only a confirmed completion earned the reward — a falsy result covers
        // both "no ad shown" and "player closed early".
        if (completed) void recordAnalytics("rewarded_ad_complete", { ad_display_id: placementId });
        return completed;
    } catch (error) {
        console.warn("[runSdk] rewarded ad unavailable", error);
        return false;
    }
}

export async function isInterstitialAdReady(): Promise<boolean> {
    if (!capabilities.ads) return false;
    try {
        return await withTimeout(
            RundotGameAPI.ads.isInterstitialAdReadyAsync(),
            2500,
            "ads.isInterstitialAdReadyAsync",
        );
    } catch (error) {
        console.warn("[runSdk] interstitial ad readiness unavailable", error);
        return false;
    }
}

export async function showInterstitialAd(placementId: string, placementName: string): Promise<boolean> {
    // Interstitial load is the number to weigh against D1 when tuning ads.
    void recordAnalytics("interstitial_shown", { ad_display_id: placementId });
    if (!capabilities.ads) return false;
    try {
        return await withTimeout(
            RundotGameAPI.ads.showInterstitialAd({
                adDisplayId: placementId,
                adDisplayName: placementName,
            }),
            120_000,
            "ads.showInterstitialAd",
        );
    } catch (error) {
        console.warn("[runSdk] interstitial ad unavailable", error);
        return false;
    }
}

export async function fetchShopCatalog(): Promise<StorefrontResponse | null> {
    if (!capabilities.shop || capabilities.mock) return null;
    try {
        return await withTimeout(RundotGameAPI.shop.getCatalog(), 3000, "shop.getCatalog");
    } catch (error) {
        console.warn("[runSdk] shop catalog unavailable", error);
        return null;
    }
}

export async function fetchEntitlements(): Promise<Entitlement[] | null> {
    if (!capabilities.entitlements || capabilities.mock) return null;
    try {
        return await withTimeout(RundotGameAPI.entitlements.listEntitlements(), 3000, "entitlements.list");
    } catch (error) {
        console.warn("[runSdk] entitlements unavailable", error);
        return null;
    }
}

export async function purchaseShopItem(itemId: string, idempotencyKey: string): Promise<ShopPurchaseResponse> {
    if (!capabilities.shop || capabilities.mock) throw new Error("RUN SHOP UNAVAILABLE");
    return RundotGameAPI.shop.purchase(itemId, idempotencyKey);
}

export async function fetchShopOrderHistory(): Promise<ShopOrderHistoryResponse> {
    if (!capabilities.shop || capabilities.mock) throw new Error("RUN SHOP UNAVAILABLE");
    return withTimeout(RundotGameAPI.shop.getOrderHistory({ limit: 50 }), 3500, "shop.getOrderHistory");
}

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export async function triggerHaptic(style: HapticStyle): Promise<boolean> {
    if (capabilities.haptics) {
        const styleMap: Record<HapticStyle, HapticFeedbackStyle> = {
            light: HapticFeedbackStyle.Light,
            medium: HapticFeedbackStyle.Medium,
            heavy: HapticFeedbackStyle.Heavy,
            success: HapticFeedbackStyle.Success,
            warning: HapticFeedbackStyle.Warning,
            error: HapticFeedbackStyle.Error,
        };
        try {
            await withTimeout(RundotGameAPI.triggerHapticAsync(styleMap[style]), 1000, "triggerHapticAsync");
            return true;
        } catch {
            // Continue into web vibration fallback.
        }
    }
    try {
        const webNavigator = navigator as Navigator & {
            vibrate?: (pattern: number | number[]) => boolean;
        };
        if (!webNavigator.vibrate) return false;
        const patterns: Record<HapticStyle, number | number[]> = {
            light: 10,
            medium: 18,
            heavy: 36,
            success: [12, 35, 12],
            warning: [22, 36, 22],
            error: [34, 45, 34],
        };
        return webNavigator.vibrate(patterns[style]);
    } catch {
        return false;
    }
}

export function recordAnalytics(eventName: string, payload: Record<string, unknown> = {}): void {
    if (!capabilities.analytics) return;
    void RundotGameAPI.analytics.recordCustomEvent(eventName, payload).catch(() => undefined);
}

/**
 * Register an ordered funnel step. Distinct from recordAnalytics: a custom
 * event is a point in time, whereas a funnel step belongs to a named, ordered
 * sequence the dashboard can draw a drop-off curve for. Step numbers and names
 * are frozen once deployed.
 */
export function recordFunnelStep(step: number, name: string, funnel: string, funnelOrder = 0): void {
    if (!capabilities.analytics) return;
    void RundotGameAPI.analytics.trackFunnelStep(step, name, funnel, funnelOrder).catch(() => undefined);
}

export interface LifecycleConfig {
    onPause?: () => void;
    onResume?: () => void;
    onSleep?: () => void;
    onAwake?: () => void;
    onQuit?: () => void;
    onBackButton?: () => void;
}

export function registerLifecycles(config: LifecycleConfig): { unsubscribeAll(): void } {
    if (!ready) return { unsubscribeAll() {} };
    const subscriptions: Subscription[] = [];
    const add = (handler: (() => void) | undefined, register: (callback: () => void) => Subscription): void => {
        if (!handler) return;
        try {
            subscriptions.push(register(handler));
        } catch (error) {
            console.warn("[runSdk] lifecycle registration failed", error);
        }
    };
    add(config.onPause, (callback) => RundotGameAPI.lifecycles.onPause(callback));
    add(config.onResume, (callback) => RundotGameAPI.lifecycles.onResume(callback));
    add(config.onSleep, (callback) => RundotGameAPI.lifecycles.onSleep(callback));
    add(config.onAwake, (callback) => RundotGameAPI.lifecycles.onAwake(callback));
    add(config.onQuit, (callback) => RundotGameAPI.lifecycles.onQuit(callback));
    add(config.onBackButton, (callback) => RundotGameAPI.lifecycles.onBackButton(callback));
    return {
        unsubscribeAll(): void {
            for (const subscription of subscriptions) {
                try {
                    subscription.unsubscribe();
                } catch {
                    // Already detached.
                }
            }
        },
    };
}

export async function requestHostExit(): Promise<boolean> {
    if (!ready) return false;
    try {
        return await withTimeout(
            RundotGameAPI.requestPopOrQuit({ reason: "scrap-shift-root-back" }),
            4000,
            "requestPopOrQuit",
        );
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Return reminders. This game shipped with no way to reach a player after they
// left, which is the single most common cause of a game that onboards fine and
// still has no D1. Every call is capability-gated and swallowing: a host with
// no notification support must not break boot.
// ---------------------------------------------------------------------------

function notificationsAvailable(): boolean {
    return typeof (RundotGameAPI as unknown as Record<string, unknown>).notifications === "object";
}

/** True once the player has granted local-notification permission. */
export async function notificationsEnabled(): Promise<boolean> {
    if (!notificationsAvailable()) return false;
    try {
        return (await RundotGameAPI.notifications.isLocalNotificationsEnabled()) === true;
    } catch {
        return false;
    }
}

/** Ask for (or revoke) local-notification permission. Must be user-initiated. */
export async function setNotificationPreference(enabled: boolean): Promise<boolean> {
    if (!notificationsAvailable()) return false;
    try {
        await RundotGameAPI.notifications.setLocalNotificationsEnabled(enabled);
        return (await RundotGameAPI.notifications.isLocalNotificationsEnabled()) === enabled;
    } catch {
        return false;
    }
}

/**
 * Cancel-then-schedule a local notification, so re-arming re-anchors the timer
 * instead of stacking a second copy. Returns true only when the host confirms.
 */
export async function rearmLocalNotification(input: {
    id: string;
    title: string;
    body: string;
    delaySeconds: number;
}): Promise<boolean> {
    if (!notificationsAvailable()) return false;
    try {
        await RundotGameAPI.notifications.cancelNotification(input.id);
        const result = await RundotGameAPI.notifications.submitMessageAsync({
            channels: ["local"],
            title: input.title,
            body: input.body,
            delaySeconds: Math.max(60, input.delaySeconds),
            notificationId: input.id,
            collapseKey: input.id,
            // Rides back as LaunchIntent.params on tap — without it a
            // notification-driven return looks identical to an organic one.
            payload: { reminder_id: input.id },
        });
        return result.results.some((channel) => channel.channel === "local" && channel.status === "scheduled");
    } catch {
        return false;
    }
}

/** Cancel a scheduled reminder once the thing it promised has been done. */
export async function cancelLocalNotification(id: string): Promise<void> {
    if (!notificationsAvailable()) return;
    try {
        await RundotGameAPI.notifications.cancelNotification(id);
    } catch {
        // a reminder that will not cancel must not break the beat that
        // completed the task it was promising
    }
}

/**
 * How this session was launched. `timed_out` is treated as unknown rather than
 * organic, so notification attribution never over-counts cold starts.
 */
export async function resolveLaunchIntent(): Promise<{ kind: string; params: Record<string, string> } | null> {
    try {
        const intent = await RundotGameAPI.app.resolveLaunchIntent({ maxWaitMs: 800 });
        if (!intent || intent.kind === "timed_out") return null;
        return { kind: intent.kind, params: intent.params ?? {} };
    } catch {
        return null;
    }
}
