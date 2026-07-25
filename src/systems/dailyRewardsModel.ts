import type { SkinId } from "./cosmetics.ts";

export interface DailyRewardDefinition {
    day: number;
    salvage: number;
    skinId?: SkinId;
    label: string;
}

export const DAILY_REWARDS: readonly DailyRewardDefinition[] = [
    { day: 1, salvage: 100, label: "100 SALVAGE" },
    { day: 2, salvage: 150, label: "150 SALVAGE" },
    { day: 3, salvage: 100, skinId: "toxic", label: "TOXIC RUNNER" },
    { day: 4, salvage: 200, label: "200 SALVAGE" },
    { day: 5, salvage: 250, label: "250 SALVAGE" },
    { day: 6, salvage: 350, label: "350 SALVAGE" },
    { day: 7, salvage: 200, skinId: "ion", label: "ION GHOST" },
] as const;

export function dailyRewardIndex(totalClaims: number): number {
    return Math.max(0, Math.floor(totalClaims)) % DAILY_REWARDS.length;
}

export function dailyRewardClaimId(day: string): string {
    return `daily-reward:${day}`;
}

export function dailyRewardState(
    totalClaims: number,
    claimIds: readonly string[],
    day: string,
): {
    currentIndex: number;
    claimedToday: boolean;
} {
    return {
        currentIndex: dailyRewardIndex(totalClaims),
        claimedToday: claimIds.includes(dailyRewardClaimId(day)),
    };
}
