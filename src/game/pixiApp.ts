import { Application, SCALE_MODES, TextureStyle } from "pixi.js";
import { designViewportForSize } from "./config.ts";

type RendererPreference = "webgpu" | "webgl";
type RendererReason =
    | "WEBGPU ACTIVE"
    | "WEBGPU API NOT EXPOSED"
    | "WEBGPU INIT FAILED"
    | "PIXI SELECTED WEBGL"
    | "FORCED WEBGPU QA"
    | "FORCED WEBGL QA";

async function initializeRenderer(host: HTMLElement, preference: RendererPreference): Promise<Application> {
    const viewport = designViewportForSize(
        host.clientWidth || window.innerWidth,
        host.clientHeight || window.innerHeight,
    );
    const app = new Application();
    try {
        await app.init({
            preference,
            width: viewport.width,
            height: viewport.height,
            resolution: 1,
            autoDensity: false,
            background: "#3b104f",
            antialias: false,
        });
        return app;
    } catch (error) {
        try {
            app.destroy({ removeView: true }, { children: true });
        } catch {
            // Renderer initialization can fail before a canvas exists.
        }
        throw error;
    }
}

export async function createPixiApp(host: HTMLElement): Promise<Application> {
    TextureStyle.defaultOptions.scaleMode = SCALE_MODES.NEAREST;
    const forced = new URLSearchParams(window.location.search).get("renderer");
    const webGpuApiAvailable = Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
    let app: Application;
    let rendererReason: RendererReason;
    if (forced === "webgpu" || forced === "webgl") {
        app = await initializeRenderer(host, forced);
        rendererReason = forced === "webgpu" ? "FORCED WEBGPU QA" : "FORCED WEBGL QA";
    } else if (!webGpuApiAvailable) {
        app = await initializeRenderer(host, "webgl");
        rendererReason = "WEBGPU API NOT EXPOSED";
    } else {
        try {
            app = await initializeRenderer(host, "webgpu");
            rendererReason = "WEBGPU ACTIVE";
        } catch (error) {
            console.warn("[renderer] WebGPU unavailable; falling back to WebGL", error);
            app = await initializeRenderer(host, "webgl");
            rendererReason = "WEBGPU INIT FAILED";
        }
    }

    const rendererName = app.renderer.constructor.name.toLowerCase().includes("webgpu") ? "webgpu" : "webgl";
    if (rendererName === "webgl" && rendererReason === "WEBGPU ACTIVE") {
        rendererReason = "PIXI SELECTED WEBGL";
    }
    document.documentElement.dataset.renderer = rendererName;
    document.documentElement.dataset.rendererReason = rendererReason;
    app.canvas.dataset.renderer = rendererName;
    app.canvas.dataset.rendererReason = rendererReason;
    app.canvas.setAttribute("aria-label", "SCRAP SHIFT neon junkyard arena");
    app.canvas.style.imageRendering = "pixelated";
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";
    host.appendChild(app.canvas);
    return app;
}
