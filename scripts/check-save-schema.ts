import assert from "node:assert/strict";
import { createDefaultGameSave, parseGameSave } from "../src/systems/saveSchema.ts";

const defaults = createDefaultGameSave(true);
const legacy = parseGameSave(
    JSON.stringify({
        version: 1,
        settings: {
            musicEnabled: true,
            musicVolume: 0.5,
            sfxEnabled: false,
            sfxVolume: 0.4,
            hapticsEnabled: true,
            reducedMotion: false,
        },
        records: {
            bestScore: 1234,
            bestTime: 80,
            highestLevel: 4,
            totalRuns: 3,
        },
        monetization: {
            pendingPurchaseIntent: null,
        },
    }),
    defaults,
);

assert.ok(legacy, "v1 save should migrate");
assert.equal(legacy.version, 5);
assert.equal(legacy.records.bestScore, 1234);
assert.equal(legacy.settings.sfxEnabled, false);
assert.deepEqual(legacy.progress, {
    lifetimeKills: 0,
    lifetimeScrap: 0,
    cachesOpened: 0,
    tapMoveSeen: false,
});
assert.equal(legacy.wallet.salvage, 0);
assert.equal(legacy.cosmetics.selectedSkin, "salvage");
assert.deepEqual(legacy.dailyRewards.claimIds, []);
assert.deepEqual(legacy.monetization.rewardedAds, {
    day: null,
    completedToday: 0,
    lastCompletedAtMs: 0,
    claimIds: [],
});
assert.deepEqual(legacy.monetization.interstitialAds, {
    day: null,
    shownToday: 0,
    lastShownAtMs: 0,
});

const validated = parseGameSave(
    JSON.stringify({
        version: 2,
        settings: {
            musicEnabled: "bad",
            musicVolume: 7,
            sfxEnabled: true,
            sfxVolume: -3,
            hapticsEnabled: false,
            reducedMotion: "bad",
        },
        records: {
            bestScore: -10,
            bestTime: 9.8,
            highestLevel: 0,
            totalRuns: "6",
        },
        progress: {
            lifetimeKills: 22.9,
            lifetimeScrap: -40,
            cachesOpened: "4",
            tapMoveSeen: true,
        },
    }),
    defaults,
);

assert.ok(validated, "v2 save should validate");
assert.equal(validated.settings.musicEnabled, defaults.settings.musicEnabled);
assert.equal(validated.settings.musicVolume, 1);
assert.equal(validated.settings.sfxVolume, 0);
assert.equal(validated.settings.reducedMotion, true);
assert.deepEqual(validated.records, {
    bestScore: 0,
    bestTime: 9,
    highestLevel: 1,
    totalRuns: 6,
});
assert.deepEqual(validated.progress, {
    lifetimeKills: 22,
    lifetimeScrap: 0,
    cachesOpened: 4,
    tapMoveSeen: true,
});
assert.equal(validated.version, 5);
assert.equal(validated.wallet.salvage, 0);

const versionThree = parseGameSave(
    JSON.stringify({
        ...defaults,
        version: 3,
        monetization: {
            pendingPurchaseIntent: {
                intentId: "intent-v3",
                productId: "blade_skin_foundry",
                catalogItemId: "scrap_shift_blade_skin_foundry",
                idempotencyKey: "run-game:blade_skin_foundry:intent-v3",
                createdAtMs: 321,
            },
        },
    }),
    defaults,
);

assert.ok(versionThree, "v3 save should migrate");
assert.equal(versionThree.version, 5);
assert.equal(versionThree.monetization.pendingPurchaseIntent?.intentId, "intent-v3");
assert.deepEqual(versionThree.monetization.rewardedAds, defaults.monetization.rewardedAds);
assert.deepEqual(versionThree.monetization.interstitialAds, defaults.monetization.interstitialAds);

const versionFour = parseGameSave(
    JSON.stringify({
        ...defaults,
        version: 4,
        monetization: {
            pendingPurchaseIntent: null,
            rewardedAds: {
                day: "2026-07-24",
                completedToday: 1,
                lastCompletedAtMs: 500,
                claimIds: ["rewarded-results:2"],
            },
        },
    }),
    defaults,
);

assert.ok(versionFour, "v4 save should migrate");
assert.equal(versionFour.version, 5);
assert.equal(versionFour.monetization.rewardedAds.completedToday, 1);
assert.deepEqual(versionFour.monetization.interstitialAds, defaults.monetization.interstitialAds);

const current = parseGameSave(
    JSON.stringify({
        ...defaults,
        cosmetics: {
            selectedSkin: "ion",
            earnedSkinIds: ["ion", "bad-skin", "ion"],
        },
        wallet: { salvage: 725.9 },
        dailyRewards: {
            lastClaimDay: "2026-07-24",
            totalClaims: 7.8,
            claimIds: ["daily-reward:2026-07-24", 42],
        },
        monetization: {
            pendingPurchaseIntent: {
                intentId: "intent-1",
                productId: "blade_skin_foundry",
                catalogItemId: "scrap_shift_blade_skin_foundry",
                idempotencyKey: "run-game:blade_skin_foundry:intent-1",
                createdAtMs: 123,
            },
            rewardedAds: {
                day: "2026-07-24",
                completedToday: 2.8,
                lastCompletedAtMs: 9876.9,
                claimIds: ["rewarded-results:4", 42, "rewarded-results:5"],
            },
            interstitialAds: {
                day: "2026-07-24",
                shownToday: 2.8,
                lastShownAtMs: 8765.9,
            },
        },
    }),
    defaults,
);

assert.ok(current, "v3 save should validate");
assert.equal(current.wallet.salvage, 725);
assert.equal(current.cosmetics.selectedSkin, "ion");
assert.deepEqual(current.cosmetics.earnedSkinIds, ["ion"]);
assert.equal(current.dailyRewards.totalClaims, 7);
assert.deepEqual(current.dailyRewards.claimIds, ["daily-reward:2026-07-24"]);
assert.equal(current.monetization.pendingPurchaseIntent?.intentId, "intent-1");
assert.deepEqual(current.monetization.rewardedAds, {
    day: "2026-07-24",
    completedToday: 2,
    lastCompletedAtMs: 9876,
    claimIds: ["rewarded-results:4", "rewarded-results:5"],
});
assert.deepEqual(current.monetization.interstitialAds, {
    day: "2026-07-24",
    shownToday: 2,
    lastShownAtMs: 8765,
});
assert.equal(parseGameSave('{"version":99}', defaults), null);
assert.equal(parseGameSave("not-json", defaults), null);

console.log("save schema check ok: v1-v4 migration, v5 ad state validation, corrupt fallback");
