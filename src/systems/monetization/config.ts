import { createMonetizationPlan } from "./monetizationPlan.ts";
import { createPlacementRegistry } from "./placementRegistry.ts";
import { createProductRegistry } from "./productRegistry.ts";

export const monetizationPlan = createMonetizationPlan({
    version: 2,
    model: "hybrid",
    nonPayerPromise:
        "Every weapon, enemy, upgrade, run, and standard record remains available without purchases or rewarded ads.",
    purchaseArchitecture: "shop-entitlements",
    architectureRationale:
        "Durable cosmetics and no-interstitial ownership require the RUN Shop ledger plus authoritative Entitlements for idempotency, refunds, revocation, and cross-device restore.",
    firstExposure: {
        valueMoment: "Complete one run and encounter the Blade Carousel before any ad or purchase offer can activate.",
        minCompletedSessions: 1,
        minProgression: 2,
    },
    primaryKpis: ["rewarded_completion_rate", "game_payer_conversion", "monetization_revenue_per_dau"],
    guardrails: {
        retention: "D1/D7 retention for eligible exposed players versus holdout",
        sessionHealth: "Post-exposure abandonment and completed runs per session",
        economyHealth: "No paid combat power; assisted revives cannot set standard records",
        reliability: "Purchase/ad error rate, duplicate grants, and entitlement reconciliation failures",
    },
});

export const monetizationPlacements = createPlacementRegistry([
    {
        id: "rewarded_results_salvage",
        displayName: "Results Salvage Boost",
        type: "rewarded",
        enabledByDefault: false,
        unlock: {
            minCompletedSessions: 1,
            minProgression: 2,
            requireValueMoment: true,
        },
        cooldownSeconds: 180,
        sessionCap: 2,
        dailyCap: 3,
        subscriberPolicy: "same-as-free",
        noAdFallback: "disable-with-message",
        rewardId: "run_salvage_bonus",
        rewardAmount: 0.5,
    },
    {
        id: "interstitial_results_break",
        displayName: "Results Break",
        type: "interstitial",
        enabledByDefault: false,
        unlock: {
            minCompletedSessions: 2,
            minProgression: 2,
            requireValueMoment: true,
        },
        cooldownSeconds: 600,
        sessionCap: 1,
        dailyCap: 3,
        subscriberPolicy: "skip",
        noAdFallback: "hide",
        naturalBreak: "After the complete results tally, before the player explicitly starts another run",
        excludeFirstSession: true,
        everyNthRun: 3,
    },
]);

export const monetizationProducts = createProductRegistry([
    {
        id: "no_interstitials",
        catalogItemId: "scrap_shift_no_interstitials",
        kind: "durable",
        expectedEntitlementIds: ["scrap_shift_no_interstitials"],
        unique: true,
        unlockDescription: "Visible after the player becomes eligible for results-screen interstitials.",
    },
    {
        id: "blade_skin_foundry",
        catalogItemId: "scrap_shift_blade_skin_foundry",
        kind: "durable",
        expectedEntitlementIds: ["scrap_shift_blade_skin_foundry"],
        unique: true,
        unlockDescription: "Visible after one completed run reaching character level 2.",
    },
    {
        id: "founder_bundle",
        catalogItemId: "scrap_shift_founder_bundle",
        kind: "bundle",
        expectedEntitlementIds: [
            "scrap_shift_no_interstitials",
            "scrap_shift_blade_skin_foundry",
            "scrap_shift_pilot_skin_founder",
        ],
        unique: true,
        unlockDescription: "Visible after two completed runs; combines no-interstitials with cosmetic skins.",
    },
]);
