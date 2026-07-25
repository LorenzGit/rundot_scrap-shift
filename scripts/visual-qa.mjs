import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.argv[2] ?? "http://127.0.0.1:5191/?qa=1";
const outputDir = resolve(process.argv[3] ?? "docs/qa");
const profileDir = await mkdtemp(join(tmpdir(), "scrap-shift-visual-qa-"));
const chrome = spawn(
    chromePath,
    [
        "--headless=new",
        "--enable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-port=0",
        `--user-data-dir=${profileDir}`,
        "about:blank",
    ],
    { stdio: "ignore" },
);

let socket;
let nextMessageId = 1;
const pending = new Map();

function delay(ms) {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitForDevToolsPort() {
    const portFile = join(profileDir, "DevToolsActivePort");
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            const [port] = (await readFile(portFile, "utf8")).trim().split("\n");
            return Number(port);
        } catch {
            await delay(50);
        }
    }
    throw new Error("Chrome DevTools port did not become ready");
}

function command(method, params = {}) {
    return new Promise((resolveCommand, rejectCommand) => {
        const id = nextMessageId;
        nextMessageId += 1;
        pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
        socket.send(JSON.stringify({ id, method, params }));
    });
}

async function evaluate(expression) {
    const response = await command("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result?.value;
}

async function waitFor(expression, label) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
        if (await evaluate(expression)) return;
        await delay(50);
    }
    throw new Error(`${label} did not become ready`);
}

async function setViewport(width, height) {
    await command("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: true,
        screenWidth: width,
        screenHeight: height,
        screenOrientation: {
            type: width > height ? "landscapePrimary" : "portraitPrimary",
            angle: width > height ? 90 : 0,
        },
    });
}

async function openGame(width, height) {
    await setViewport(width, height);
    await command("Page.navigate", { url: baseUrl });
    await waitFor("document.readyState === 'complete'", "document");
    await waitFor("Boolean(window.__scrapShiftQa)", "SCRAP SHIFT QA bridge");
}

async function capture(fileName) {
    await delay(350);
    const result = await command("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
    });
    await writeFile(join(outputDir, fileName), Buffer.from(result.data, "base64"));
    console.log(join(outputDir, fileName));
}

const qaSave = {
    version: 5,
    settings: {
        musicEnabled: false,
        musicVolume: 0.34,
        sfxEnabled: false,
        sfxVolume: 0.62,
        hapticsEnabled: false,
        reducedMotion: false,
    },
    records: { bestScore: 26838, bestTime: 180, highestLevel: 8, totalRuns: 6 },
    progress: {
        lifetimeKills: 369,
        lifetimeScrap: 1440,
        cachesOpened: 31,
        tapMoveSeen: true,
    },
    wallet: { salvage: 1440 },
    cosmetics: { selectedSkin: "salvage", earnedSkinIds: ["toxic", "ion"] },
    dailyRewards: { lastClaimDay: null, totalClaims: 0, claimIds: [] },
    monetization: {
        pendingPurchaseIntent: null,
        rewardedAds: { day: null, completedToday: 0, lastCompletedAtMs: 0, claimIds: [] },
        interstitialAds: { day: null, shownToday: 0, lastShownAtMs: 0 },
    },
};

try {
    const port = await waitForDevToolsPort();
    const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(baseUrl)}`, {
        method: "PUT",
    }).then((response) => response.json());
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, rejectOpen) => {
        socket.addEventListener("open", resolveOpen, { once: true });
        socket.addEventListener("error", rejectOpen, { once: true });
    });
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (!message.id) return;
        const handler = pending.get(message.id);
        if (!handler) return;
        pending.delete(message.id);
        if (message.error) handler.reject(new Error(message.error.message));
        else handler.resolve(message.result);
    });
    await Promise.all([command("Page.enable"), command("Runtime.enable")]);

    await openGame(390, 844);
    await evaluate(
        `localStorage.setItem("scrap-shift.local-save", ${JSON.stringify(JSON.stringify(qaSave))}); location.reload();`,
    );
    await waitFor("document.readyState === 'complete'", "reloaded document");
    await waitFor("Boolean(window.__scrapShiftQa)", "reloaded SCRAP SHIFT QA bridge");
    await evaluate("window.__scrapShiftQa.openOutfitter()");
    await capture("scrap-shift-v0103-portrait-outfitter.png");

    await evaluate("window.__scrapShiftQa.openSettings()");
    await capture("scrap-shift-v0103-portrait-settings.png");

    await evaluate("window.__scrapShiftQa.startRun(); window.__scrapShiftQa.forceResults()");
    await capture("scrap-shift-v0103-portrait-results.png");

    await evaluate(`
        window.__scrapShiftQa.startRun();
        document.getElementById("tap-tutorial").style.display = "none";
        document.getElementById("app-frame").style.setProperty("--run-safe-top", "24px");
        document.getElementById("app-frame").style.setProperty("--run-safe-bottom", "28px");
        window.__scrapShiftQa.forcePowerup("frenzy", 142, 0.15);
        window.__scrapShiftQa.forcePowerup("freeze", 148, 1.7);
        window.__scrapShiftQa.forcePowerup("nova", 138, 3.1);
        window.__scrapShiftQa.forcePowerup("shield", 146, 4.7);
        window.__scrapShiftQa.showMilestone("CACHE #8 UNLOCKED", "CRYO FIELD INBOUND", "freeze");
        window.__scrapShiftQa.freezeSimulation();
    `);
    await capture("scrap-shift-v0103-portrait-gameplay-notice-powerups.png");

    await openGame(844, 390);
    await evaluate("window.__scrapShiftQa.openOutfitter()");
    await capture("scrap-shift-v0103-landscape-outfitter.png");

    await evaluate(`
        window.__scrapShiftQa.startRun();
        document.getElementById("tap-tutorial").style.display = "none";
        document.getElementById("app-frame").style.setProperty("--run-safe-top", "18px");
        document.getElementById("app-frame").style.setProperty("--run-safe-bottom", "18px");
        window.__scrapShiftQa.forceEnemy("spinner", 92, 0.15);
        window.__scrapShiftQa.forceEnemy("sniper", 112, 0.72);
        window.__scrapShiftQa.forceEnemy("mine_layer", 104, 2.65);
        window.__scrapShiftQa.forceEnemy("siren", 112, 5.15);
        window.__scrapShiftQa.forceHorde();
        window.__scrapShiftQa.forceHazard("sniper", 148, 0.05);
        window.__scrapShiftQa.forceHazard("mine", 128, 2.2);
        window.__scrapShiftQa.forceHazard("pulse", 122, 4.45);
        window.__scrapShiftQa.forcePowerup("nova", 78, 2.25);
        window.__scrapShiftQa.showMilestone("HORDE 1", "SWARM BREACH");
        window.__scrapShiftQa.freezeSimulation();
    `);
    await capture("scrap-shift-v0103-landscape-horde-roster.png");

    await openGame(390, 844);
    const motionResult = await evaluate(`(async () => {
        window.__scrapShiftQa.startRun();
        document.getElementById("tap-tutorial").style.display = "none";
        window.__scrapShiftQa.setReducedMotion(true);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
        const screenPositions = [];
        const shakeFrames = [];
        const started = performance.now();
        await new Promise((resolve) => {
            const sample = (now) => {
                const qa = window.__scrapShiftQa.snapshot();
                screenPositions.push({
                    x: Math.round(qa.playerX) + qa.worldX,
                    y: Math.round(qa.playerY) + qa.worldY,
                });
                if (qa.cameraShake > 0 || qa.shakeOffsetX !== 0 || qa.shakeOffsetY !== 0) {
                    shakeFrames.push({
                        shake: qa.cameraShake,
                        x: qa.shakeOffsetX,
                        y: qa.shakeOffsetY,
                    });
                }
                if (now - started >= 1800) resolve();
                else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "d" }));
        window.__scrapShiftQa.setReducedMotion(false);
        const xs = screenPositions.map((position) => position.x);
        const ys = screenPositions.map((position) => position.y);
        return {
            samples: screenPositions.length,
            horizontalDrift: Math.max(...xs) - Math.min(...xs),
            verticalDrift: Math.max(...ys) - Math.min(...ys),
            shakeFrames: shakeFrames.length,
        };
    })()`);
    console.log(`MOTION ${JSON.stringify(motionResult)}`);
    if (motionResult.horizontalDrift !== 0 || motionResult.verticalDrift !== 0) {
        throw new Error(
            `Camera regression: player drifted ${motionResult.horizontalDrift}x${motionResult.verticalDrift} pixels`,
        );
    }
    if (motionResult.shakeFrames !== 0) {
        throw new Error(`Camera regression: ${motionResult.shakeFrames} ordinary movement frames shook`);
    }

    await command("Emulation.setCPUThrottlingRate", { rate: 4 });
    const performanceResult = await evaluate(`(async () => {
        window.__scrapShiftQa.startRun();
        document.getElementById("tap-tutorial").style.display = "none";
        window.__scrapShiftQa.forcePerformanceStress();
        window.__scrapShiftQa.setPerformanceHud(true);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
        const frameTimes = [];
        let previous = performance.now();
        const started = previous;
        await new Promise((resolve) => {
            const sample = (now) => {
                frameTimes.push(now - previous);
                previous = now;
                if (now - started >= 12000) resolve();
                else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        });
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "d" }));
        const sorted = [...frameTimes].sort((a, b) => a - b);
        const averageMs = frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length;
        return {
            cpuThrottle: 4,
            sampleSeconds: (previous - started) / 1000,
            frames: frameTimes.length,
            averageFps: 1000 / averageMs,
            averageFrameMs: averageMs,
            p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            p99FrameMs: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
            qa: window.__scrapShiftQa.snapshot(),
        };
    })()`);
    console.log(`PERFORMANCE ${JSON.stringify(performanceResult)}`);
    if (performanceResult.averageFps < 55) {
        throw new Error(`Performance regression: ${performanceResult.averageFps.toFixed(1)} average FPS`);
    }
    if (performanceResult.p95FrameMs > 24) {
        throw new Error(`Performance regression: ${performanceResult.p95FrameMs.toFixed(1)} ms p95 frame`);
    }
    if (performanceResult.qa.renderRedraws > 4) {
        throw new Error(`Performance regression: ${performanceResult.qa.renderRedraws} geometry rebuilds`);
    }
    if (!performanceResult.qa.performance.enabled) {
        throw new Error("Production FPS overlay did not activate");
    }
    if (!performanceResult.qa.performance.rendererReason) {
        throw new Error("Production FPS overlay did not explain the renderer path");
    }
    await capture("scrap-shift-v0103-portrait-performance-hud.png");
    await command("Emulation.setCPUThrottlingRate", { rate: 1 });
} finally {
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (chrome.exitCode === null) {
        const exited = new Promise((resolveExit) => chrome.once("exit", resolveExit));
        chrome.kill("SIGTERM");
        await exited;
    }
    await rm(profileDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
