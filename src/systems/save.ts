import { getRunCapabilities, readAppStorage, writeAppStorage } from "../sdk/runSdk.ts";
import {
    createDefaultGameSave,
    nonNegativeInteger,
    parseGameSave,
    SAVE_VERSION,
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
/** "unavailable": RUN storage could not be read; defaults are in memory but never written to the cloud. */
export type SaveSource = "run" | "local" | "defaults" | "unavailable";

export const DEFAULT_SAVE = createDefaultGameSave(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

let state: GameSaveV5 = structuredClone(DEFAULT_SAVE);
let lastSerialized = "";
let pendingSerialized: string | null = null;
let flushInFlight: Promise<boolean> | null = null;

/**
 * Remote-write guard. A failed or timed-out RUN storage read is not a new
 * player: writing defaults then would replace the real cloud save. Remote
 * writes stay blocked until one read has succeeded. "blocked" means the cloud
 * holds a save from a newer build, which this build must never overwrite.
 */
type RemoteState = "unverified" | "verified" | "blocked";
let remoteState: RemoteState = "unverified";
let verifyInFlight: Promise<void> | null = null;
let verifyRetryTimer = 0;
const VERIFY_RETRY_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const;

function hostedStorage(): boolean {
    const capabilities = getRunCapabilities();
    return capabilities.host && !capabilities.mock && capabilities.storage;
}

function isNewerSave(raw: string): boolean {
    try {
        const version = (JSON.parse(raw) as { version?: unknown } | null)?.version;
        return typeof version === "number" && version > SAVE_VERSION;
    } catch {
        return false;
    }
}

type RemoteRead = "found" | "empty" | "failed" | "newer";

async function readRemote(): Promise<RemoteRead> {
    const remote = await readAppStorage(SAVE_KEY);
    if (!remote.ok) return "failed";
    if (remote.value === null) return "empty";
    const save = parseGameSave(remote.value, DEFAULT_SAVE);
    if (!save) {
        if (isNewerSave(remote.value)) return "newer";
        // Unreadable, not newer: keep a copy before it can be replaced.
        console.warn("[save] unreadable remote save; backing it up");
        await writeAppStorage(`${SAVE_KEY}-unreadable-backup`, remote.value);
        return "empty";
    }
    state = save;
    lastSerialized = remote.value;
    return "found";
}

function settleRemote(result: RemoteRead): void {
    if (result === "failed") return;
    remoteState = result === "newer" ? "blocked" : "verified";
    if (result === "newer") console.warn("[save] cloud save is from a newer build; cloud writes disabled");
}

/**
 * Retry the read in the background. flush() never awaits this: a caller that
 * reverts on a failed flush must not revert against a freshly applied save.
 */
function verifyRemote(attempt = 0): void {
    if (remoteState !== "unverified" || verifyInFlight || verifyRetryTimer) return;
    verifyInFlight = (async () => {
        if (hostedStorage()) settleRemote(await readRemote());
    })().finally(() => {
        verifyInFlight = null;
        if (remoteState !== "unverified" || attempt >= VERIFY_RETRY_MS.length) return;
        verifyRetryTimer = window.setTimeout(() => {
            verifyRetryTimer = 0;
            verifyRemote(attempt + 1);
        }, VERIFY_RETRY_MS[attempt]);
    });
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
            state = structuredClone(DEFAULT_SAVE);
            const result = await readRemote();
            settleRemote(result);
            if (result === "found") return "run";
            lastSerialized = JSON.stringify(state);
            if (result === "failed") {
                console.warn("[save] cloud save unreadable at boot; cloud writes paused until a read succeeds");
                verifyRemote();
                return "unavailable";
            }
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

    /**
     * Undo a granted-but-unsaved daily reward by DELTA against the current
     * state, not by restoring the pre-claim snapshot: anything else the player
     * earned between the grant and the failed flush must survive the rollback.
     */
    revertDailyReward(input: {
        day: string;
        salvage: number;
        skinId?: SkinId;
        previousLastClaimDay: string | null;
        previousStreak: number;
    }): void {
        const claimId = `daily-reward:${input.day}`;
        if (!state.dailyRewards.claimIds.includes(claimId)) return;
        const salvageReward = nonNegativeInteger(input.salvage);
        state = {
            ...state,
            wallet: {
                salvage: Math.max(0, state.wallet.salvage - salvageReward),
            },
            cosmetics: {
                ...state.cosmetics,
                earnedSkinIds: input.skinId
                    ? state.cosmetics.earnedSkinIds.filter((id) => id !== input.skinId)
                    : state.cosmetics.earnedSkinIds,
            },
            dailyRewards: {
                lastClaimDay: input.previousLastClaimDay,
                totalClaims: Math.max(0, state.dailyRewards.totalClaims - 1),
                streak: nonNegativeInteger(input.previousStreak),
                claimIds: state.dailyRewards.claimIds.filter((id) => id !== claimId),
            },
        };
    },

    restore(snapshot: GameSaveV5): void {
        state = structuredClone(snapshot);
    },

    async flush(): Promise<boolean> {
        if (hostedStorage() && remoteState !== "verified") {
            // Never write over a cloud save this session has not read. A host
            // that attached after load() lands here too.
            verifyRemote();
            return false;
        }
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
