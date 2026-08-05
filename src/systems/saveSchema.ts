import type { PendingPurchaseIntent } from "./monetization/purchaseCoordinator.ts";
import { isSkinId, type SkinId } from "./cosmetics.ts";

export const SAVE_VERSION = 5;

export interface GameSettings {
    musicEnabled: boolean;
    musicVolume: number;
    sfxEnabled: boolean;
    sfxVolume: number;
    hapticsEnabled: boolean;
    reducedMotion: boolean;
}

export interface GameRecords {
    bestScore: number;
    bestTime: number;
    highestLevel: number;
    totalRuns: number;
}

export interface GameProgress {
    lifetimeKills: number;
    lifetimeScrap: number;
    cachesOpened: number;
    tapMoveSeen: boolean;
}

export interface DailyRewardSave {
    lastClaimDay: string | null;
    totalClaims: number;
    /**
     * CONSECUTIVE days claimed, distinct from totalClaims (which never resets).
     * A streak is what makes a return reward escalate and what the 24h reminder
     * can honestly promise; a lifetime count cannot do either.
     */
    streak: number;
    claimIds: string[];
}

export interface RewardedAdsSave {
    day: string | null;
    completedToday: number;
    lastCompletedAtMs: number;
    claimIds: string[];
}

export interface InterstitialAdsSave {
    day: string | null;
    shownToday: number;
    lastShownAtMs: number;
}

export interface GameSaveV5 {
    version: 5;
    settings: GameSettings;
    records: GameRecords;
    progress: GameProgress;
    wallet: {
        salvage: number;
    };
    cosmetics: {
        selectedSkin: SkinId;
        earnedSkinIds: SkinId[];
    };
    dailyRewards: DailyRewardSave;
    monetization: {
        pendingPurchaseIntent: PendingPurchaseIntent | null;
        rewardedAds: RewardedAdsSave;
        interstitialAds: InterstitialAdsSave;
    };
}

export function createDefaultGameSave(reducedMotion: boolean): GameSaveV5 {
    return {
        version: SAVE_VERSION,
        settings: {
            musicEnabled: true,
            musicVolume: 0.34,
            sfxEnabled: true,
            sfxVolume: 0.62,
            hapticsEnabled: true,
            reducedMotion,
        },
        records: {
            bestScore: 0,
            bestTime: 0,
            highestLevel: 1,
            totalRuns: 0,
        },
        progress: {
            lifetimeKills: 0,
            lifetimeScrap: 0,
            cachesOpened: 0,
            tapMoveSeen: false,
        },
        wallet: {
            salvage: 0,
        },
        cosmetics: {
            selectedSkin: "salvage",
            earnedSkinIds: [],
        },
        dailyRewards: {
            lastClaimDay: null,
            totalClaims: 0,
            streak: 0,
            claimIds: [],
        },
        monetization: {
            pendingPurchaseIntent: null,
            rewardedAds: {
                day: null,
                completedToday: 0,
                lastCompletedAtMs: 0,
                claimIds: [],
            },
            interstitialAds: {
                day: null,
                shownToday: 0,
                lastShownAtMs: 0,
            },
        },
    };
}

function clamp01(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

export function nonNegativeInteger(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function parsePendingPurchaseIntent(value: unknown): PendingPurchaseIntent | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (
        typeof candidate.intentId !== "string" ||
        typeof candidate.productId !== "string" ||
        typeof candidate.catalogItemId !== "string" ||
        typeof candidate.idempotencyKey !== "string" ||
        typeof candidate.createdAtMs !== "number" ||
        !Number.isFinite(candidate.createdAtMs)
    ) {
        return null;
    }
    return {
        intentId: candidate.intentId,
        productId: candidate.productId,
        catalogItemId: candidate.catalogItemId,
        idempotencyKey: candidate.idempotencyKey,
        createdAtMs: candidate.createdAtMs,
    };
}

export function parseGameSave(
    raw: string | null,
    defaults: GameSaveV5 = createDefaultGameSave(false),
): GameSaveV5 | null {
    if (!raw) return null;
    try {
        const candidate = JSON.parse(raw) as Omit<Partial<GameSaveV5>, "version" | "progress"> & {
            version?: number;
            progress?: Partial<GameProgress>;
        };
        if (
            ![1, 2, 3, 4, SAVE_VERSION].includes(candidate.version ?? -1) ||
            !candidate.settings ||
            !candidate.records
        ) {
            return null;
        }
        const earnedSkinIds = Array.isArray(candidate.cosmetics?.earnedSkinIds)
            ? [...new Set(candidate.cosmetics.earnedSkinIds.filter(isSkinId).filter((id) => id !== "salvage"))]
            : [];
        const selectedCandidate = candidate.cosmetics?.selectedSkin;
        const selectedSkin = isSkinId(selectedCandidate) ? selectedCandidate : "salvage";
        const pendingPurchaseIntent =
            (candidate.version === 3 || candidate.version === 4 || candidate.version === SAVE_VERSION) &&
            candidate.monetization?.pendingPurchaseIntent
                ? parsePendingPurchaseIntent(candidate.monetization.pendingPurchaseIntent)
                : null;
        const rewardedAds =
            candidate.version === 4 || candidate.version === SAVE_VERSION
                ? candidate.monetization?.rewardedAds
                : defaults.monetization.rewardedAds;
        const interstitialAds =
            candidate.version === SAVE_VERSION
                ? candidate.monetization?.interstitialAds
                : defaults.monetization.interstitialAds;
        return {
            version: SAVE_VERSION,
            settings: {
                musicEnabled: booleanOr(candidate.settings.musicEnabled, defaults.settings.musicEnabled),
                musicVolume: clamp01(candidate.settings.musicVolume, defaults.settings.musicVolume),
                sfxEnabled: booleanOr(candidate.settings.sfxEnabled, defaults.settings.sfxEnabled),
                sfxVolume: clamp01(candidate.settings.sfxVolume, defaults.settings.sfxVolume),
                hapticsEnabled: booleanOr(candidate.settings.hapticsEnabled, defaults.settings.hapticsEnabled),
                reducedMotion: booleanOr(candidate.settings.reducedMotion, defaults.settings.reducedMotion),
            },
            records: {
                bestScore: nonNegativeInteger(candidate.records.bestScore),
                bestTime: nonNegativeInteger(candidate.records.bestTime),
                highestLevel: Math.max(1, nonNegativeInteger(candidate.records.highestLevel, 1)),
                totalRuns: nonNegativeInteger(candidate.records.totalRuns),
            },
            progress: {
                lifetimeKills: nonNegativeInteger(candidate.progress?.lifetimeKills),
                lifetimeScrap: nonNegativeInteger(candidate.progress?.lifetimeScrap),
                cachesOpened: nonNegativeInteger(candidate.progress?.cachesOpened),
                tapMoveSeen: booleanOr(candidate.progress?.tapMoveSeen, false),
            },
            wallet: {
                salvage: nonNegativeInteger(candidate.wallet?.salvage),
            },
            cosmetics: {
                selectedSkin,
                earnedSkinIds,
            },
            dailyRewards: {
                lastClaimDay:
                    typeof candidate.dailyRewards?.lastClaimDay === "string"
                        ? candidate.dailyRewards.lastClaimDay
                        : null,
                totalClaims: nonNegativeInteger(candidate.dailyRewards?.totalClaims),
                // Absent on saves written before streaks existed; 0 is correct
                // there — the next claim starts the first streak.
                streak: nonNegativeInteger(candidate.dailyRewards?.streak),
                claimIds: Array.isArray(candidate.dailyRewards?.claimIds)
                    ? candidate.dailyRewards.claimIds.filter((id): id is string => typeof id === "string").slice(-90)
                    : [],
            },
            monetization: {
                pendingPurchaseIntent,
                rewardedAds: {
                    day: typeof rewardedAds?.day === "string" ? rewardedAds.day : null,
                    completedToday: nonNegativeInteger(rewardedAds?.completedToday),
                    lastCompletedAtMs: nonNegativeInteger(rewardedAds?.lastCompletedAtMs),
                    claimIds: Array.isArray(rewardedAds?.claimIds)
                        ? rewardedAds.claimIds.filter((id): id is string => typeof id === "string").slice(-90)
                        : [],
                },
                interstitialAds: {
                    day: typeof interstitialAds?.day === "string" ? interstitialAds.day : null,
                    shownToday: nonNegativeInteger(interstitialAds?.shownToday),
                    lastShownAtMs: nonNegativeInteger(interstitialAds?.lastShownAtMs),
                },
            },
        };
    } catch {
        return null;
    }
}
