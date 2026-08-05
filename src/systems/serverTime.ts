import { getRunCapabilities, requestServerEpochMs } from "../sdk/runSdk.ts";

let serverBaseMs: number | null = null;
let monotonicBaseMs: number | null = null;

export async function refreshServerTime(): Promise<boolean> {
    const epochMs = await requestServerEpochMs();
    if (epochMs === null) return false;
    serverBaseMs = epochMs;
    monotonicBaseMs = performance.now();
    return true;
}

export function hasServerTime(): boolean {
    return serverBaseMs !== null && monotonicBaseMs !== null;
}

export function serverNow(): number {
    if (serverBaseMs !== null && monotonicBaseMs !== null) {
        return serverBaseMs + (performance.now() - monotonicBaseMs);
    }
    return Date.now();
}

export function localDayKey(epochMs: number): string {
    const date = new Date(epochMs);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

export function msUntilNextLocalMidnight(epochMs: number): number {
    const next = new Date(epochMs);
    next.setHours(24, 0, 0, 0);
    return Math.max(0, next.getTime() - epochMs);
}

export function formatDailyCountdown(durationMs: number): string {
    const totalMinutes = Math.max(0, Math.ceil(durationMs / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}H ${String(minutes).padStart(2, "0")}M`;
}

export function trustedTimeGate(): {
    ready: boolean;
    authoritative: boolean;
    day: string | null;
    label: string;
} {
    const capabilities = getRunCapabilities();
    const authoritative = capabilities.host && !capabilities.mock;
    if (authoritative && !hasServerTime()) {
        return {
            ready: false,
            authoritative: true,
            day: null,
            label: "WAITING FOR TRUSTED RUN TIME",
        };
    }
    return {
        ready: true,
        authoritative,
        day: localDayKey(serverNow()),
        label: authoritative ? "TRUSTED RUN TIME" : "LOCAL PREVIEW · NON-AUTHORITATIVE",
    };
}

/**
 * True when `day` is exactly one calendar day after `previous`.
 *
 * Both are `localDayKey` strings (YYYY-MM-DD), parsed as UTC so the comparison
 * cannot be skewed by the host's timezone — only the difference matters, and
 * both keys were produced by the same clock.
 */
export function isConsecutiveDay(previous: string | null, day: string): boolean {
    if (!previous) return false;
    const a = Date.parse(`${previous}T00:00:00Z`);
    const b = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return b - a === 86_400_000;
}
