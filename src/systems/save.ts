import { getRunCapabilities, readAppStorage, writeAppStorage } from "../sdk/runSdk.ts";
import {
    createDefaultGameSave,
    nonNegativeInteger,
    parseGameSave,
    type GameSaveV5,
    type GameSettings,
} from "./saveSchema.ts";
import type { SkinId } from "./cosmetics.ts";
import type { PendingPurchaseIntent } from "./monetization/purchaseCoordinator.ts";

import { analytics } from "./analytics/analyticsConfig.ts";
import { isConsecutiveDay } from "./serverTime.ts";
export {
    SAVE_VERSION,
    parseGameSave,
    type GameProgress,
    type GameRecords,
    type DailyRewardSave,
    type GameSaveV5,
    type GameSettings,
    type InterstitialAdsSave,
    type RewardedAdsSave,
} from "./saveSchema.ts";

const SAVE_KEY = "scrap-shift-save";
const LOCAL_SAVE_KEY = "scrap-shift.local-save";
export type SaveSource = "run" | "local" | "defaults";

export const DEFAULT_SAVE = createDefaultGameSave(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

let state: GameSaveV5 = structuredClone(DEFAULT_SAVE);
let lastSerialized = "";
let pendingSerialized: string | null = null;
let flushInFlight: Promise<boolean> | null = null;

function hostedStorage(): boolean {
    const capabilities = getRunCapabilities();
    return capabilities.host && !capabilities.mock && capabilities.storage;
}

function readLocal(): string | null {
    try {
        return window.localStorage.getItem(LOCAL_SAVE_KEY);
    } catch {
        return null;
    }
}

async function persist(serialized: string): Promise<boolean> {
    if (hostedStorage()) return writeAppStorage(SAVE_KEY, serialized);
    try {
        window.localStorage.setItem(LOCAL_SAVE_KEY, serialized);
        return true;
    } catch (error) {
        console.warn("[save] local fallback write failed", error);
        return false;
    }
}

export const saveSystem = {
    async load(): Promise<SaveSource> {
        if (hostedStorage()) {
            const remote = await readAppStorage(SAVE_KEY);
            if (remote.ok) {
                state = parseGameSave(remote.value, DEFAULT_SAVE) ?? structuredClone(DEFAULT_SAVE);
                lastSerialized = remote.value ?? JSON.stringify(state);
                return remote.value ? "run" : "defaults";
            }
            state = structuredClone(DEFAULT_SAVE);
            lastSerialized = JSON.stringify(state);
            return "defaults";
        }
        const localRaw = readLocal();
        const local = parseGameSave(localRaw, DEFAULT_SAVE);
        state = local ?? structuredClone(DEFAULT_SAVE);
        lastSerialized = localRaw ?? JSON.stringify(state);
        return local ? "local" : "defaults";
    },

    get(): Readonly<GameSaveV5> {
        return state;
    },

    updateSettings(patch: Partial<GameSettings>): void {
        state = {
            ...state,
            settings: {
                ...state.settings,
                ...patch,
            },
        };
    },

    markTapMoveSeen(): void {
        if (state.progress.tapMoveSeen) return;
        state = {
            ...state,
            progress: {
                ...state.progress,
                tapMoveSeen: true,
            },
        };
    },

    recordRun(score: number, elapsed: number, level: number, kills: number, scrap: number, cachesOpened: number): void {
        const salvageReward = nonNegativeInteger(scrap);
        // Read BEFORE the write below: once the high-water mark is overwritten,
        // "was this a record?" is unanswerable. A beaten best is the progression
        // beat that predicts a next session, which run_ended alone cannot show.
        if (Math.floor(level) > state.records.highestLevel) {
            analytics.event("milestone_reached", {
                milestone: "deepest_wave",
                value: Math.floor(level),
                previous: state.records.highestLevel,
            });
        }
        state = {
            ...state,
            records: {
                bestScore: Math.max(state.records.bestScore, Math.floor(score)),
                bestTime: Math.max(state.records.bestTime, Math.floor(elapsed)),
                highestLevel: Math.max(state.records.highestLevel, Math.floor(level)),
                totalRuns: state.records.totalRuns + 1,
            },
            progress: {
                ...state.progress,
                lifetimeKills: state.progress.lifetimeKills + nonNegativeInteger(kills),
                lifetimeScrap: state.progress.lifetimeScrap + salvageReward,
                cachesOpened: state.progress.cachesOpened + nonNegativeInteger(cachesOpened),
            },
            wallet: {
                salvage: state.wallet.salvage + salvageReward,
            },
        };
    },

    setSelectedSkin(selectedSkin: SkinId): void {
        state = {
            ...state,
            cosmetics: {
                ...state.cosmetics,
                selectedSkin,
            },
        };
    },

    setPendingPurchaseIntent(pendingPurchaseIntent: PendingPurchaseIntent | null): void {
        state = {
            ...state,
            monetization: {
                ...state.monetization,
                pendingPurchaseIntent,
            },
        };
    },

    applyRewardedAdSalvage(input: { claimId: string; day: string; salvage: number; completedAtMs: number }): {
        ok: boolean;
        reason: "ready" | "already-claimed";
        previous: GameSaveV5;
    } {
        const previous = structuredClone(state);
        if (state.monetization.rewardedAds.claimIds.includes(input.claimId)) {
            return { ok: false, reason: "already-claimed", previous };
        }
        const salvageReward = nonNegativeInteger(input.salvage);
        const completedToday =
            state.monetization.rewardedAds.day === input.day ? state.monetization.rewardedAds.completedToday : 0;
        state = {
            ...state,
            progress: {
                ...state.progress,
                lifetimeScrap: state.progress.lifetimeScrap + salvageReward,
            },
            wallet: {
                salvage: state.wallet.salvage + salvageReward,
            },
            monetization: {
                ...state.monetization,
                rewardedAds: {
                    day: input.day,
                    completedToday: completedToday + 1,
                    lastCompletedAtMs: nonNegativeInteger(input.completedAtMs),
                    claimIds: [...state.monetization.rewardedAds.claimIds, input.claimId].slice(-90),
                },
            },
        };
        return { ok: true, reason: "ready", previous };
    },

    recordInterstitialShown(input: { day: string; shownAtMs: number }): void {
        const shownToday =
            state.monetization.interstitialAds.day === input.day ? state.monetization.interstitialAds.shownToday : 0;
        state = {
            ...state,
            monetization: {
                ...state.monetization,
                interstitialAds: {
                    day: input.day,
                    shownToday: shownToday + 1,
                    lastShownAtMs: nonNegativeInteger(input.shownAtMs),
                },
            },
        };
    },

    applyDailyReward(input: { day: string; salvage: number; skinId?: SkinId }): {
        ok: boolean;
        reason: "ready" | "already-claimed";
        previous: GameSaveV5;
    } {
        const claimId = `daily-reward:${input.day}`;
        const previous = structuredClone(state);
        if (state.dailyRewards.claimIds.includes(claimId)) {
            return { ok: false, reason: "already-claimed", previous };
        }
        const earnedSkinIds =
            input.skinId && !state.cosmetics.earnedSkinIds.includes(input.skinId)
                ? [...state.cosmetics.earnedSkinIds, input.skinId]
                : state.cosmetics.earnedSkinIds;
        state = {
            ...state,
            wallet: {
                salvage: state.wallet.salvage + nonNegativeInteger(input.salvage),
            },
            cosmetics: {
                ...state.cosmetics,
                earnedSkinIds,
            },
            dailyRewards: {
                lastClaimDay: input.day,
                totalClaims: state.dailyRewards.totalClaims + 1,
                // Consecutive only: a gap resets to 1 (this claim), never 0, so
                // a returning player is never told their streak is "zero" on the
                // day they came back. Days are the trusted-time day key, so a
                // device clock change cannot inflate it.
                streak: isConsecutiveDay(state.dailyRewards.lastClaimDay, input.day)
                    ? state.dailyRewards.streak + 1
                    : 1,
                claimIds: [...state.dailyRewards.claimIds, claimId].slice(-90),
            },
        };
        return { ok: true, reason: "ready", previous };
    },

    restore(snapshot: GameSaveV5): void {
        state = structuredClone(snapshot);
    },

    async flush(): Promise<boolean> {
        const serialized = JSON.stringify(state);
        if (serialized === lastSerialized && pendingSerialized === null) return true;
        pendingSerialized = serialized;
        if (flushInFlight) return flushInFlight;
        flushInFlight = (async () => {
            let succeeded = true;
            while (pendingSerialized !== null) {
                const next = pendingSerialized;
                pendingSerialized = null;
                if (next === lastSerialized) continue;
                if (await persist(next)) lastSerialized = next;
                else succeeded = false;
            }
            return succeeded;
        })().finally(() => {
            flushInFlight = null;
        });
        return flushInFlight;
    },
};
