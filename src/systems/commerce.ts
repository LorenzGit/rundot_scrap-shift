import type { ShopOrderHistoryResponse, ShopPurchaseResponse, StorefrontItem } from "@series-inc/rundot-game-sdk";
import {
    fetchEntitlements,
    fetchShopCatalog,
    fetchShopOrderHistory,
    getRunCapabilities,
    purchaseShopItem,
    recordAnalytics,
} from "../sdk/runSdk.ts";
import { SKINS, skinOwnedLocally, type SkinId } from "./cosmetics.ts";
import { monetizationProducts } from "./monetization/config.ts";
import { getMonetizationRuntime } from "./monetization/runtime.ts";
import {
    createPurchaseCoordinator,
    type PendingPurchaseIntent,
    type PurchaseOutcome,
} from "./monetization/purchaseCoordinator.ts";
import { saveSystem } from "./save.ts";

export interface SkinCommerceView {
    visible: boolean;
    owned: boolean;
    entitlementVerified: boolean;
    purchasable: boolean;
    productId: CommerceProductId | null;
    priceLabel: string;
    statusLabel: string;
}

export type CommerceProductId = "blade_skin_foundry" | "no_interstitials" | "founder_bundle";

export interface ProductCommerceView {
    productId: CommerceProductId;
    visible: boolean;
    owned: boolean;
    entitlementVerified: boolean;
    purchasable: boolean;
    priceLabel: string;
    statusLabel: string;
    name: string;
}

let catalog = new Map<string, StorefrontItem>();
let catalogConfigId: string | null = null;
let entitlementIds = new Set<string>();
let authoritativeEntitlementsLoaded = false;
let refreshInFlight: Promise<void> | null = null;
const DEV_PREVIEW_PRICES: Readonly<Record<CommerceProductId, string>> = {
    blade_skin_foundry: "199 RB",
    no_interstitials: "299 RB",
    founder_bundle: "399 RB",
};

async function syncEntitlements(): Promise<void> {
    const entitlements = await fetchEntitlements();
    if (entitlements === null) {
        authoritativeEntitlementsLoaded = false;
        entitlementIds = new Set();
        return;
    }
    authoritativeEntitlementsLoaded = true;
    entitlementIds = new Set(
        entitlements
            .filter((entry) => entry.status === "active" && entry.quantity > 0)
            .map((entry) => entry.entitlementId),
    );
}

function liveProduct(productId: string): StorefrontItem | null {
    const definition = monetizationProducts.get(productId);
    return definition ? (catalog.get(definition.catalogItemId) ?? null) : null;
}

function formatLivePrice(item: StorefrontItem): string {
    const price = item.resolvedPrice.finalPrice;
    const unit = price.type.toLowerCase() === "bucks" ? "RB" : price.type.toUpperCase();
    return `${price.value} ${unit}`.trim();
}

function requiredRunsForProduct(productId: CommerceProductId): number {
    return productId === "founder_bundle" || productId === "no_interstitials" ? 2 : 1;
}

function productIsEligible(productId: CommerceProductId): boolean {
    const saved = saveSystem.get();
    return saved.records.totalRuns >= requiredRunsForProduct(productId) && saved.records.highestLevel >= 2;
}

const purchaseCoordinator = createPurchaseCoordinator<ShopPurchaseResponse, ShopOrderHistoryResponse>({
    shop: {
        async purchase(itemId, idempotencyKey) {
            const response = await purchaseShopItem(itemId, idempotencyKey);
            if (!response.success) throw new Error("RUN SHOP DID NOT CONFIRM THE ORDER");
            return response;
        },
        getOrderHistory: fetchShopOrderHistory,
    },
    pending: {
        load: () => saveSystem.get().monetization.pendingPurchaseIntent,
        async save(intent) {
            saveSystem.setPendingPurchaseIntent(intent);
            if (!(await saveSystem.flush())) throw new Error("PURCHASE INTENT COULD NOT BE SAVED");
        },
        async clear() {
            saveSystem.setPendingPurchaseIntent(null);
            await saveSystem.flush();
        },
    },
    findConfirmedOrder(history, intent) {
        if (!history.success) return null;
        return (
            history.orders.find(
                (order) =>
                    order.itemId === intent.catalogItemId &&
                    order.idempotencyKey === intent.idempotencyKey &&
                    order.status === "fulfilled",
            ) ?? null
        );
    },
    syncEntitlements,
    classifyError(error) {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (message.includes("cancel")) return "cancelled";
        if (message.includes("declin") || message.includes("insufficient") || message.includes("unavailable")) {
            return "failed";
        }
        return "unknown";
    },
});

export async function refreshCommerce(): Promise<void> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
        const [nextCatalog] = await Promise.all([fetchShopCatalog(), syncEntitlements()]);
        catalogConfigId = nextCatalog?.configId ?? null;
        catalog = new Map((nextCatalog?.items ?? []).filter((item) => item.active).map((item) => [item.itemId, item]));
    })().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

export function skinIsOwned(id: SkinId): boolean {
    const saved = saveSystem.get();
    if (skinOwnedLocally(id, saved.cosmetics.earnedSkinIds)) return true;
    const unlock = SKINS[id].unlock;
    return unlock.kind === "entitlement" && authoritativeEntitlementsLoaded && entitlementIds.has(unlock.entitlementId);
}

export function commerceEntitlementsReady(): boolean {
    return authoritativeEntitlementsLoaded;
}

export function hasVerifiedEntitlement(entitlementId: string): boolean {
    return authoritativeEntitlementsLoaded && entitlementIds.has(entitlementId);
}

export function productCommerceView(productId: CommerceProductId): ProductCommerceView {
    const definition = monetizationProducts.get(productId);
    if (!definition) throw new Error(`Missing commerce product ${productId}`);
    const item = liveProduct(productId);
    const capabilities = getRunCapabilities();
    const runtime = getMonetizationRuntime();
    const productEnabled = runtime.controls.products[productId]?.enabled === true;
    const controlsEnabled = runtime.controls.enabled && runtime.controls.purchasesEnabled && productEnabled;
    const hostReady = controlsEnabled && capabilities.shop && !capabilities.mock && item !== null;
    const devPreview = import.meta.env.DEV && (!capabilities.host || capabilities.mock);
    const eligible = productIsEligible(productId);
    const owned =
        authoritativeEntitlementsLoaded &&
        definition.expectedEntitlementIds.every((entitlementId) => entitlementIds.has(entitlementId));
    const requiredRuns = requiredRunsForProduct(productId);
    return {
        productId,
        visible: owned || eligible,
        owned,
        entitlementVerified: authoritativeEntitlementsLoaded,
        purchasable: eligible && !owned && hostReady,
        priceLabel:
            item && eligible
                ? formatLivePrice(item)
                : eligible && devPreview
                  ? DEV_PREVIEW_PRICES[productId]
                  : eligible
                    ? "PRICE SYNC REQUIRED"
                    : `UNLOCKS AFTER ${requiredRuns} RUN${requiredRuns === 1 ? "" : "S"}`,
        statusLabel: owned
            ? "OWNED"
            : !eligible
              ? `COMPLETE ${requiredRuns} RUN${requiredRuns === 1 ? "" : "S"}`
              : devPreview
                ? `${DEV_PREVIEW_PRICES[productId]} · PREVIEW`
                : hostReady
                  ? "PERMANENT UNLOCK"
                  : "SYNCING OFFER",
        name: item?.name ?? definition.catalogItemId,
    };
}

export function skinCommerceView(id: SkinId): SkinCommerceView {
    const unlock = SKINS[id].unlock;
    const owned = skinIsOwned(id);
    if (unlock.kind !== "entitlement") {
        return {
            visible: true,
            owned,
            entitlementVerified: false,
            purchasable: false,
            productId: null,
            priceLabel: unlock.kind === "starter" ? "INCLUDED" : `DAILY DAY ${unlock.day}`,
            statusLabel: owned ? "OWNED" : unlock.kind === "daily" ? `EARN ON DAY ${unlock.day}` : "INCLUDED",
        };
    }
    const item = liveProduct(unlock.productId);
    const capabilities = getRunCapabilities();
    const runtime = getMonetizationRuntime();
    const productEnabled = runtime.controls.products[unlock.productId]?.enabled === true;
    const purchaseControlsEnabled = runtime.controls.enabled && runtime.controls.purchasesEnabled && productEnabled;
    const live = purchaseControlsEnabled && capabilities.shop && !capabilities.mock && item !== null;
    const product = productCommerceView(unlock.productId);
    const requiredRuns = requiredRunsForProduct(unlock.productId);
    const eligible = productIsEligible(unlock.productId);
    return {
        visible: owned || (eligible && live),
        owned,
        entitlementVerified: authoritativeEntitlementsLoaded,
        purchasable: !owned && product.purchasable,
        productId: unlock.productId,
        priceLabel: product.priceLabel,
        statusLabel: owned
            ? "OWNED"
            : !eligible
              ? `COMPLETE ${requiredRuns} RUN${requiredRuns === 1 ? "" : "S"}`
              : live
                ? "AVAILABLE"
                : "LOCKED",
    };
}

export interface CommerceDiagnostics {
    catalogConfigId: string | null;
    catalogItems: readonly {
        itemId: string;
        name: string;
        price: string;
    }[];
    entitlementIds: readonly string[];
    purchaseReady: boolean;
    testProductId: string;
    testProductName: string;
    testProductPrice: string;
    testProductOwned: boolean;
}

export function commerceDiagnostics(): CommerceDiagnostics {
    const testProductId = "blade_skin_foundry";
    const definition = monetizationProducts.get(testProductId);
    if (!definition) throw new Error(`Missing diagnostic product ${testProductId}`);
    const item = liveProduct(testProductId);
    const runtime = getMonetizationRuntime();
    const capabilities = getRunCapabilities();
    const productEnabled = runtime.controls.products[testProductId]?.enabled === true;
    return {
        catalogConfigId,
        catalogItems: [...catalog.values()].map((entry) => ({
            itemId: entry.itemId,
            name: entry.name,
            price: formatLivePrice(entry),
        })),
        entitlementIds: [...entitlementIds].sort(),
        purchaseReady:
            runtime.controls.privateTestMode &&
            runtime.controls.enabled &&
            runtime.controls.purchasesEnabled &&
            productEnabled &&
            capabilities.host &&
            !capabilities.mock &&
            capabilities.shop &&
            item !== null,
        testProductId,
        testProductName: item?.name ?? definition.catalogItemId,
        testProductPrice: item ? formatLivePrice(item) : "NO LIVE PRICE",
        testProductOwned: entitlementIds.has("scrap_shift_blade_skin_foundry"),
    };
}

export async function purchaseProduct(
    productId: CommerceProductId,
    placement = "outfitter",
): Promise<PurchaseOutcome<ShopPurchaseResponse> | null> {
    const definition = monetizationProducts.get(productId);
    const item = definition ? liveProduct(productId) : null;
    const runtime = getMonetizationRuntime();
    const enabled =
        runtime.controls.enabled &&
        runtime.controls.purchasesEnabled &&
        runtime.controls.products[productId]?.enabled === true;
    if (!enabled || !definition || !item || !getRunCapabilities().shop || getRunCapabilities().mock) return null;
    recordAnalytics("checkout_started", { productId, placement });
    const outcome = await purchaseCoordinator.purchase(productId, definition.catalogItemId);
    recordAnalytics("checkout_result", { productId, placement, result: outcome.status });
    return outcome;
}

export const purchaseSkinProduct = purchaseProduct;

export async function reconcilePendingPurchase(): Promise<void> {
    const pending: PendingPurchaseIntent | null = purchaseCoordinator.pendingIntent();
    if (!pending) return;
    const outcome = await purchaseCoordinator.reconcilePending();
    if (outcome) {
        recordAnalytics("checkout_result", {
            productId: pending.productId,
            placement: "resume_reconciliation",
            result: outcome.status,
        });
    }
}

export function enforceOwnedSelection(): SkinId {
    const selected = saveSystem.get().cosmetics.selectedSkin;
    if (skinIsOwned(selected)) return selected;
    saveSystem.setSelectedSkin("salvage");
    void saveSystem.flush();
    return "salvage";
}
