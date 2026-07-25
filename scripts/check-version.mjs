import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const gameConfig = JSON.parse(readFileSync(new URL("../game.config.prod.json", import.meta.url), "utf8"));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const controller = readFileSync(new URL("../src/ui/controller.ts", import.meta.url), "utf8");
const performanceHud = readFileSync(new URL("../src/ui/performanceHud.ts", import.meta.url), "utf8");
const pixiApp = readFileSync(new URL("../src/game/pixiApp.ts", import.meta.url), "utf8");
const art = readFileSync(new URL("../src/game/art.ts", import.meta.url), "utf8");
const scene = readFileSync(new URL("../src/game/scene.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../src/game/config.ts", import.meta.url), "utf8");
const core = readFileSync(new URL("../src/game/core.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/app.css", import.meta.url), "utf8");
const runSdk = readFileSync(new URL("../src/sdk/runSdk.ts", import.meta.url), "utf8");
const audioManager = readFileSync(new URL("../src/audio/audioManager.ts", import.meta.url), "utf8");
const monetizationConfig = readFileSync(new URL("../src/systems/monetization/config.ts", import.meta.url), "utf8");
const rewardedAds = readFileSync(new URL("../src/systems/rewardedAds.ts", import.meta.url), "utf8");
const interstitialAds = readFileSync(new URL("../src/systems/interstitialAds.ts", import.meta.url), "utf8");
const interstitialGate = readFileSync(
    new URL("../src/systems/monetization/interstitialGate.ts", import.meta.url),
    "utf8",
);
const liveOpsConfig = JSON.parse(readFileSync(new URL("../rundot/liveops.config.json", import.meta.url), "utf8"));
const shopConfig = JSON.parse(readFileSync(new URL("../rundot/shop.config.json", import.meta.url), "utf8"));

assert.match(packageJson.version, /^\d+\.\d+\.\d+$/, "package version must be semantic");
assert.match(html, /id="version-label"/, "main menu must contain one version label");
assert.equal((html.match(/id="version-label"/g) ?? []).length, 1, "version label must be unique");
assert.match(main, /`v\$\{__APP_VERSION__\}`|__APP_VERSION__/, "UI must render the injected package version");
assert.equal(String(gameConfig.orientation).toLowerCase(), "both", "RUN metadata must allow portrait and landscape");
assert.ok(!html.includes("rotate-guard"), "portrait must remain playable instead of showing a rotation blocker");
assert.match(html, /id="tap-tutorial"/, "touch steering must have visible onboarding");
assert.match(html, /id="tap-marker"/, "touch steering must have visible feedback");
assert.match(html, /id="tap-knob"/, "floating touch steering must show its directional knob");
assert.match(html, />OUTFITTER</, "the main menu must name the cosmetic collection in player language");
assert.match(html, /id="skins-title">OUTFITTER</, "the cosmetic screen must retain the Outfitter identity");
assert.doesNotMatch(
    html,
    /SHOP \+ ADS|NOT ACTIVATED|RUN SHOP|REWARDED ADS/,
    "host capability and monetization implementation language must never appear in the player UI",
);
assert.match(html, /id="results-ad-button"/, "results must include the explicit rewarded-ad affordance");
assert.match(
    html,
    /id="monetization-test-screen"/,
    "the host-gated monetization diagnostic implementation must remain available for private QA configs",
);
assert.match(
    html,
    /TEST PURCHASES USE REAL RB AND PERSIST/,
    "the tester bay must disclose that checkout is real before a purchase action",
);
assert.match(controller, /versionTapCount >= 5/, "five version taps must request the host-gated diagnostic bay");
assert.equal(
    liveOpsConfig.client.values.monetization.privateTestMode,
    false,
    "public LiveOps must disable the private monetization test bay",
);
const finalCatalog = new Map(shopConfig.items.map((item) => [item.itemId, item]));
assert.equal(finalCatalog.size, 3, "the private deploy must carry the three-product final catalog");
assert.deepEqual(
    Object.fromEntries([...finalCatalog].map(([itemId, item]) => [itemId, item.price.value])),
    {
        scrap_shift_blade_skin_foundry: "199",
        scrap_shift_no_interstitials: "299",
        scrap_shift_founder_bundle: "399",
    },
    "final prices must be explicit RB values in the server catalog",
);
const privateTestItem = finalCatalog.get("scrap_shift_blade_skin_foundry");
assert.ok(privateTestItem, "the catalog must include the Foundry + Void product");
assert.ok(
    privateTestItem.entitlements.some(
        (entry) => entry.entitlementId === "scrap_shift_blade_skin_foundry" && entry.consumable === false,
    ),
    "the checkout test must grant the durable skin entitlement",
);
assert.deepEqual(
    finalCatalog
        .get("scrap_shift_founder_bundle")
        ?.entitlements.map((entry) => entry.entitlementId)
        .sort(),
    ["scrap_shift_blade_skin_foundry", "scrap_shift_no_interstitials", "scrap_shift_pilot_skin_founder"],
    "the founder bundle must grant every advertised permanent entitlement",
);
assert.equal(
    liveOpsConfig.client.values.monetization.interstitialAdsEnabled,
    true,
    "results-break interstitials must be deliberately enabled in the private LiveOps snapshot",
);
assert.equal(
    liveOpsConfig.client.values.monetization.placements.interstitial_results_break.everyNthRun,
    3,
    "normal interstitials must evaluate only every third eligible completed run",
);
assert.match(html, /id="storefront-offers"/, "the Outfitter must expose normal player purchase offers");
assert.match(html, /id="settings-noads-offer"/, "Settings must expose the permanent ad-free offer");
assert.match(html, /AD-FREE FOREVER/, "the ad-removal product must use clear player language");
assert.match(
    html,
    /id="results-ad-offer" class="results-ad-offer pixel-frame hidden"/,
    "the rewarded offer must start hidden and appear only when a video is genuinely available",
);
assert.match(controller, /if \(!commerce\.visible\) continue;/, "unavailable paid cosmetics must stay hidden");
assert.match(
    controller,
    /offer\.classList\.toggle\("hidden", !view\.visible\)/,
    "unavailable video offers must stay hidden",
);
assert.doesNotMatch(
    `${html}\n${controller}\n${styles}`,
    /run-progress|run-fill|wave-fill/,
    "the redundant unlabeled run-progress line must not cross the integrity panel",
);
assert.match(
    controller,
    /appFrame\.addEventListener\("pointerdown"/,
    "the whole game frame must accept touch steering",
);
assert.match(
    controller,
    /event\.target instanceof Element && event\.target\.closest\("button, \.screen\.active"\)/,
    "touch steering must not steal pause, burst, or modal input",
);
assert.match(
    controller,
    /releaseTouchStick\(\)[\s\S]*?this\.tapPointer = null;[\s\S]*?this\.tapX = 0;[\s\S]*?this\.tapY = 0;/,
    "touch release must stop the hero immediately",
);
assert.doesNotMatch(controller, /tapUntil|performance\.now\(\) \+ 700/, "touch release must not leave movement active");
assert.match(art, /POWERUP_CARD_ART/, "powerups must use the game-owned pixel-card art set");
assert.ok((art.match(/bitmap:/g) ?? []).length >= 8, "all eight powerups must define embedded bitmap data");
assert.match(config, /BLADE_CAROUSEL_MAX_LEVEL\s*=\s*8/, "the blade carousel must progress from one to eight");
assert.match(config, /name:\s*"BLADE CAROUSEL"/, "the rotating weapon needs a clear player-facing identity");
assert.match(config, /weaponLabel:\s*"ROTATING SWORDS"/, "weapon cards must identify the rotating sword family");
assert.match(config, /icon:\s*"blade"/, "the blade carousel card must use a sword icon");
assert.equal(
    (art.match(/\n    \{\n        blade:/g) ?? []).length,
    8,
    "all eight carousel levels need distinct blade silhouettes",
);
assert.match(art, /drawCarouselBladeSprite/, "the world renderer must draw the authored sword carousel");
assert.match(scene, /bladeOrbitAngle/, "blade rendering must share orbit math with combat collision");
assert.match(core, /bladeOrbitAngle/, "blade collision must share orbit math with rendering");
assert.doesNotMatch(
    `${art}\n${readFileSync(new URL("../src/game/scene.ts", import.meta.url), "utf8")}`,
    /drawMagnetField|magnetGraphic|markerCount/,
    "the coin magnet must not render a misleading dotted radius ring",
);
assert.match(html, /id="power-blades"/, "the loadout must identify the blade carousel");
assert.match(controller, /card-family/, "upgrade cards must label their weapon family and add-or-upgrade action");
assert.match(styles, /\.icon-blade::before/, "carousel upgrade cards must show a recognizable sword");
assert.doesNotMatch(
    `${html}\n${styles}\n${art}`,
    /power-moon|icon-moon|drawOrbitals/,
    "legacy crescent-shard visuals must not obscure the rotating sword identity",
);
assert.match(config, /ENEMY_LEVEL_GATES/, "monster families must have explicit character-level gates");
assert.match(monetizationConfig, /model:\s*"hybrid"/, "the typed monetization plan must match the hybrid brief");
assert.match(
    monetizationConfig,
    /id:\s*"rewarded_results_salvage"/,
    "the first rewarded vertical slice needs a stable placement ID",
);
assert.match(runSdk, /RundotGameAPI\.ads\.isRewardedAdReadyAsync\(\)/, "rewarded ads must preflight RUN ad readiness");
assert.match(
    runSdk,
    /RundotGameAPI\.ads\.showRewardedAdAsync\(\{/,
    "rewarded ads must use the namespaced RUN API with placement attribution",
);
assert.match(
    rewardedAds,
    /if \(!completed\)[\s\S]*?NOTHING CHANGED/,
    "an incomplete or unavailable rewarded ad must never grant salvage",
);
assert.match(
    runSdk,
    /RundotGameAPI\.ads\.isInterstitialAdReadyAsync\(\)/,
    "interstitials must preflight RUN ad readiness",
);
assert.match(
    runSdk,
    /RundotGameAPI\.ads\.showInterstitialAd\(\{/,
    "interstitials must use the namespaced RUN API with placement attribution",
);
assert.match(
    interstitialAds,
    /hasVerifiedEntitlement\(NO_INTERSTITIALS_ENTITLEMENT\)/,
    "the permanent no-ads entitlement must suppress results-break interstitials",
);
assert.match(
    interstitialGate,
    /rewardedInteracted[\s\S]*?return "rewarded-interaction"/,
    "rewarded-ad interaction must suppress an interstitial on the same results break",
);
assert.match(
    rewardedAds,
    /if \(!applied\.ok\)[\s\S]*?BONUS ALREADY CLAIMED/,
    "the rewarded results bonus must reject duplicate claims",
);
assert.match(
    monetizationConfig,
    /id:\s*"interstitial_results_break"/,
    "results-screen interstitials need a stable placement ID",
);
assert.equal(
    (monetizationConfig.match(/enabledByDefault:\s*false/g) ?? []).length,
    2,
    "every planned ad placement must remain disabled by default",
);
assert.match(monetizationConfig, /id:\s*"no_interstitials"/, "the Shop plan must include durable ad removal");
assert.match(monetizationConfig, /id:\s*"blade_skin_foundry"/, "the Shop plan must monetize cosmetic swords");
assert.match(core, /basePickupRadius\(\)/, "coins must have a baseline magnet mechanic");
assert.match(core, /spawnTreasure/, "the infinite world must periodically reveal collectible treasure");
assert.match(art, /drawTreasure/, "treasures must have dedicated pixel-art chest rendering");
assert.match(scene, /syncArenaTiles/, "terrain must stream around the unbounded camera");
assert.match(scene, /applySharedContext/, "static pixel geometry must be shared instead of rebuilt per actor");
assert.match(scene, /sharedVisualContexts/, "actors must reuse cross-entity GPU geometry");
assert.match(scene, /prewarmArenaContexts/, "infinite terrain variants must be built before live movement");
assert.doesNotMatch(
    `${html}\n${styles}`,
    /class="scanlines"|\.scanlines/,
    "full-screen scanlines must not shimmer against moving pixel terrain",
);
assert.match(scene, /this\.cameraX = snapshot\.player\.x/, "the player camera must stay locked to player motion");
assert.match(
    scene,
    /Math\.round\(this\.viewport\.width \/ 2 \+ shakeX\) - Math\.round\(this\.cameraX\)/,
    "camera transforms must remain pixel-stable across variable frame times",
);
assert.match(scene, /SHAKE_STEP_SECONDS = 1 \/ 30/, "intentional impacts must use restrained pixel-stepped motion");
const ordinaryKillFeedback = scene.slice(
    scene.indexOf('event.type === "enemy_down"'),
    scene.indexOf('event.type === "pickup"'),
);
assert.doesNotMatch(ordinaryKillFeedback, /shake|kickShake/, "ordinary enemy deaths must never retrigger camera shake");
assert.match(html, /id="fps-counter"/, "Settings must expose the production FPS-counter switch");
assert.match(html, /id="performance-hud"/, "the private build must include an on-device FPS counter");
assert.match(html, /id="performance-renderer-reason"/, "the performance HUD must explain the selected renderer path");
assert.match(performanceHud, /p95FrameMs/, "the FPS counter must report frame-time tail latency");
assert.match(performanceHud, /rendererReason/, "the FPS counter must expose the WebGPU fallback reason");
assert.match(pixiApp, /WEBGPU API NOT EXPOSED/, "a missing WebGPU API must be distinguished from init failure");
assert.match(pixiApp, /WEBGPU INIT FAILED/, "WebGPU initialization failure must be reported explicitly");
assert.match(scene, /isWorldVisible/, "off-camera actors must be culled before rendering");
assert.match(scene, /enemyVisualSignatures/, "enemy redraws must be limited to meaningful visual-state changes");
assert.match(scene, /pickupVisualSignatures/, "large scrap fields must not rebuild every coin on every frame");
assert.match(html, /id="threat-fill"/, "the HUD must communicate monster progression");
assert.match(html, /id="milestone-card"/, "reward notices must carry a compact pixel-card badge");
assert.match(
    styles,
    /\.milestone\s*\{[\s\S]*?top:\s*calc\(max\(8px,\s*var\(--run-safe-top\)\)\s*\+\s*clamp\(50px,\s*9vw,\s*66px\)\s*\+\s*6px\)[\s\S]*?left:\s*max\(9px,\s*var\(--run-safe-left\)\)/,
    "reward notices must sit directly below the integrity panel",
);
assert.doesNotMatch(styles, /card-scan|mini-card-flip|icon-pixel-float/, "cards must not use looping CSS VFX");
assert.doesNotMatch(art, /flipFrames|orbit sparks/, "world cards must remain visually stable");
assert.match(
    styles,
    /--portrait-hud-top:\s*var\(--run-safe-top\)/,
    "portrait HUD must attach directly to the frame-local top safe edge",
);
assert.match(
    styles,
    /--portrait-hud-bottom:\s*var\(--run-safe-bottom\)/,
    "portrait HUD must attach directly to the frame-local bottom safe edge",
);
assert.match(
    runSdk,
    /safeAreaOffsetsForFrame\(safeArea,\s*frame\.getBoundingClientRect\(\)/,
    "RUN insets must become signed frame offsets",
);
assert.match(main, /bindRunSafeArea\(\)/, "safe-area conversion must be rebound when the game frame resizes");
assert.match(audioManager, /scrapyard-loop\.mp3/, "the bundled soundtrack must be owned by AudioManager");
assert.match(audioManager, /new Audio\(scrapyardLoopUrl\)/, "the soundtrack must use one managed media element");
assert.match(audioManager, /musicVolume:\s*0\.34/, "the persisted default music slider must remain stable");
assert.match(
    audioManager,
    /this\.music\.volume\s*=\s*this\.settings\.musicVolume/,
    "the soundtrack must play at the persisted 34% default without an extra mix reduction",
);
assert.match(audioManager, /this\.music\.pause\(\)/, "pause and lifecycle state must stop the soundtrack");
assert.match(
    styles,
    /@media \(orientation:\s*portrait\)[\s\S]*?#app-frame\s*\{[\s\S]*?overflow:\s*visible/,
    "portrait HUD must be allowed to reach safe boundaries outside the 9:16 play frame",
);
assert.match(
    styles,
    /\.combat-progress\s*\{[\s\S]*?top:\s*auto;[\s\S]*?right:\s*max\(9px,\s*var\(--run-safe-right\)\);[\s\S]*?bottom:\s*calc\(var\(--portrait-hud-bottom\)\s*\+\s*30px\);[\s\S]*?left:\s*auto/,
    "portrait combat progress must dock at bottom-right after the requested swap",
);
assert.match(
    styles,
    /\.dash-button\s*\{[\s\S]*?right:\s*auto;[\s\S]*?bottom:\s*calc\(var\(--portrait-hud-bottom\)\s*\+\s*32px\);[\s\S]*?left:\s*max\(12px,\s*var\(--run-safe-left\)\)/,
    "portrait burst control must dock at bottom-left after the requested swap",
);
assert.match(
    styles,
    /\.energy-wrap\s*\{[\s\S]*?bottom:\s*var\(--portrait-hud-bottom\)/,
    "portrait level progress must touch the bottom safe boundary",
);

console.log(`version check ok: ${packageJson.version}`);
