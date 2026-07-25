import { getRunCapabilities, isRewardedAdReady, recordAnalytics, showRewardedAd } from "../sdk/runSdk.ts";
import { monetizationPlacements } from "./monetization/config.ts";
import type { RewardedPlacement } from "./monetization/placementRegistry.ts";
import { getMonetizationRuntime } from "./monetization/runtime.ts";
import { saveSystem } from "./save.ts";
import { serverNow, trustedTimeGate } from "./serverTime.ts";

const RESULTS_PLACEMENT_ID = "rewarded_results_salvage";
const registeredPlacement = monetizationPlacements.require(RESULTS_PLACEMENT_ID);
if (registeredPlacement.type !== "rewarded") {
    throw new Error(`${RESULTS_PLACEMENT_ID} must be a rewarded placement`);
}
const placement: RewardedPlacement = registeredPlacement;

export interface RewardedResultsView {
    visible: boolean;
    enabled: boolean;
    claimed: boolean;
    reward: number;
    status: string;
    action: string;
}

export interface RewardedAdOutcome {
    granted: boolean;
    reward: number;
    message: string;
}

export interface RewardedAdDiagnostics {
    ready: boolean;
    testReady: boolean;
}

let completedRunsAtSessionStart = 0;
let completedThisSession = 0;
let rewardedReady: boolean | null = null;
let requestInFlight = false;

export function initializeRewardedAdsSession(): void {
    completedRunsAtSessionStart = saveSystem.get().records.totalRuns;
    completedThisSession = 0;
    rewardedReady = null;
    requestInFlight = false;
}

function claimId(): string {
    return `rewarded-results:${saveSystem.get().records.totalRuns}`;
}

function dailyCompleted(day: string): number {
    const saved = saveSystem.get().monetization.rewardedAds;
    return saved.day === day ? saved.completedToday : 0;
}

function placementControls(): {
    enabled: boolean;
    sessionCap: number;
    dailyCap: number;
    cooldownSeconds: number;
    rewardMultiplier: number;
} {
    const runtime = getMonetizationRuntime().controls;
    const remote = runtime.placements[RESULTS_PLACEMENT_ID];
    return {
        enabled: runtime.enabled && runtime.rewardedAdsEnabled && remote?.enabled === true,
        sessionCap: Math.min(placement.sessionCap, remote?.sessionCap ?? 0),
        dailyCap: Math.min(placement.dailyCap, remote?.dailyCap ?? 0),
        cooldownSeconds: Math.max(placement.cooldownSeconds, remote?.cooldownSeconds ?? placement.cooldownSeconds),
        rewardMultiplier: Math.min(2, Math.max(0, remote?.rewardMultiplier ?? 1)),
    };
}

function rewardAmount(baseScrap: number): number {
    const controls = placementControls();
    return Math.max(0, Math.floor(baseScrap * placement.rewardAmount * controls.rewardMultiplier));
}

export function rewardedResultsView(baseScrap: number): RewardedResultsView {
    const saved = saveSystem.get();
    const gate = trustedTimeGate();
    const controls = placementControls();
    const claimed = saved.monetization.rewardedAds.claimIds.includes(claimId());
    const reward = rewardAmount(baseScrap);

    if (claimed) {
        return {
            visible: true,
            enabled: false,
            claimed: true,
            reward,
            status: "BONUS SECURED",
            action: "BONUS CLAIMED",
        };
    }
    if (reward <= 0) {
        return { visible: false, enabled: false, claimed: false, reward, status: "", action: "" };
    }
    if (completedRunsAtSessionStart < placement.unlock.minCompletedSessions) {
        return {
            visible: false,
            enabled: false,
            claimed: false,
            reward,
            status: "",
            action: "",
        };
    }
    if (saved.records.highestLevel < placement.unlock.minProgression) {
        return {
            visible: false,
            enabled: false,
            claimed: false,
            reward,
            status: "",
            action: "",
        };
    }
    if (!controls.enabled) {
        return { visible: false, enabled: false, claimed: false, reward, status: "", action: "" };
    }
    if (!gate.ready || !gate.day) {
        return { visible: false, enabled: false, claimed: false, reward, status: "", action: "" };
    }
    if (completedThisSession >= controls.sessionCap) {
        return { visible: false, enabled: false, claimed: false, reward, status: "", action: "" };
    }
    if (dailyCompleted(gate.day) >= controls.dailyCap) {
        return { visible: false, enabled: false, claimed: false, reward, status: "", action: "" };
    }
    const cooldownMs = controls.cooldownSeconds * 1000;
    if (serverNow() - saved.monetization.rewardedAds.lastCompletedAtMs < cooldownMs) {
        return { visible: false, enabled: false, claimed: false, reward, status: "", action: "" };
    }
    if (!getRunCapabilities().ads) {
        return { visible: false, enabled: false, claimed: false, reward, status: "", action: "" };
    }
    if (rewardedReady !== true || requestInFlight) {
        return {
            visible: requestInFlight,
            enabled: false,
            claimed: false,
            reward,
            status: requestInFlight ? "VIDEO IN PROGRESS" : "",
            action: requestInFlight ? `+${reward} SALVAGE` : "",
        };
    }
    return {
        visible: true,
        enabled: true,
        claimed: false,
        reward,
        status: "OPTIONAL VIDEO REWARD",
        action: `WATCH VIDEO · +${reward} SALVAGE`,
    };
}

export async function refreshRewardedAdAvailability(): Promise<void> {
    rewardedReady = placementControls().enabled && getRunCapabilities().ads ? await isRewardedAdReady() : false;
}

export function rewardedAdDiagnostics(): RewardedAdDiagnostics {
    const runtime = getMonetizationRuntime();
    const capabilities = getRunCapabilities();
    return {
        ready: rewardedReady === true,
        testReady:
            runtime.controls.privateTestMode &&
            placementControls().enabled &&
            capabilities.host &&
            !capabilities.mock &&
            capabilities.ads &&
            rewardedReady === true &&
            !requestInFlight,
    };
}

export async function testRewardedAd(onPresentationChange?: (visible: boolean) => void): Promise<RewardedAdOutcome> {
    const runtime = getMonetizationRuntime();
    const capabilities = getRunCapabilities();
    if (!runtime.controls.privateTestMode) {
        return { granted: false, reward: 0, message: "PRIVATE TEST MODE DISABLED" };
    }
    if (!placementControls().enabled || !capabilities.host || capabilities.mock || !capabilities.ads) {
        return { granted: false, reward: 0, message: "RUN MOBILE AD HOST REQUIRED" };
    }
    rewardedReady = await isRewardedAdReady();
    if (!rewardedReady) return { granted: false, reward: 0, message: "NO VIDEO AVAILABLE RIGHT NOW" };
    if (requestInFlight) return { granted: false, reward: 0, message: "VIDEO ALREADY IN PROGRESS" };

    const rewardDay = trustedTimeGate().day;
    if (!rewardDay) return { granted: false, reward: 0, message: "TRUSTED TIME UNAVAILABLE" };
    requestInFlight = true;
    recordAnalytics("ad_requested", {
        placementId: RESULTS_PLACEMENT_ID,
        adType: "rewarded",
        source: "private_test_bay",
    });
    onPresentationChange?.(true);
    const completed = await showRewardedAd(placement.id, `${placement.displayName} · Private Test`);
    onPresentationChange?.(false);
    requestInFlight = false;
    recordAnalytics("ad_result", {
        placementId: RESULTS_PLACEMENT_ID,
        adType: "rewarded",
        source: "private_test_bay",
        result: completed ? "completed" : "unavailable_or_cancelled",
    });
    if (!completed) {
        rewardedReady = false;
        return { granted: false, reward: 0, message: "VIDEO NOT COMPLETED · NOTHING GRANTED" };
    }

    const reward = 1;
    const applied = saveSystem.applyRewardedAdSalvage({
        claimId: `rewarded-private-test:${rewardDay}`,
        day: rewardDay,
        salvage: reward,
        completedAtMs: serverNow(),
    });
    if (!applied.ok) {
        return { granted: true, reward: 0, message: "VIDEO CONFIRMED · TODAY'S TEST REWARD ALREADY CLAIMED" };
    }
    completedThisSession += 1;
    await saveSystem.flush();
    recordAnalytics("reward_granted", {
        placementId: RESULTS_PLACEMENT_ID,
        rewardId: "private_test_salvage",
        amount: reward,
        source: "private_test_bay",
    });
    return { granted: true, reward, message: "VIDEO CONFIRMED · +1 SALVAGE SAVED" };
}

export async function claimRewardedResultsBonus(
    baseScrap: number,
    onPresentationChange?: (visible: boolean) => void,
): Promise<RewardedAdOutcome> {
    const before = rewardedResultsView(baseScrap);
    if (!before.enabled || requestInFlight) {
        return { granted: false, reward: 0, message: before.status };
    }
    const rewardDay = trustedTimeGate().day;
    if (!rewardDay) return { granted: false, reward: 0, message: "TRUSTED TIME UNAVAILABLE" };
    requestInFlight = true;
    recordAnalytics("ad_requested", { placementId: RESULTS_PLACEMENT_ID, adType: "rewarded" });
    onPresentationChange?.(true);
    const completed = await showRewardedAd(placement.id, placement.displayName);
    onPresentationChange?.(false);
    requestInFlight = false;
    recordAnalytics("ad_result", {
        placementId: RESULTS_PLACEMENT_ID,
        adType: "rewarded",
        result: completed ? "completed" : "unavailable_or_cancelled",
    });
    if (!completed) {
        rewardedReady = false;
        return { granted: false, reward: 0, message: "VIDEO NOT COMPLETED · NOTHING CHANGED" };
    }

    const reward = before.reward;
    const applied = saveSystem.applyRewardedAdSalvage({
        claimId: claimId(),
        day: rewardDay,
        salvage: reward,
        completedAtMs: serverNow(),
    });
    if (!applied.ok) {
        return { granted: false, reward: 0, message: "BONUS ALREADY CLAIMED" };
    }
    completedThisSession += 1;
    const saved = await saveSystem.flush();
    recordAnalytics("reward_granted", {
        placementId: RESULTS_PLACEMENT_ID,
        rewardId: placement.rewardId,
        amount: reward,
    });
    return {
        granted: true,
        reward,
        message: saved ? `VIDEO COMPLETE · +${reward} SALVAGE` : `+${reward} SALVAGE · SAVE WILL RETRY`,
    };
}
