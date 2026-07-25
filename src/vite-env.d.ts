/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
    __scrapShiftQa?: {
        snapshot(): Record<string, unknown>;
        startRun(): void;
        forceUpgrade(): void;
        forceBladeLevel(level: number): void;
        forcePowerup(
            kind?: "overdrive" | "repair" | "vacuum" | "shield" | "frenzy" | "freeze" | "nova" | "jackpot",
            distance?: number,
            angle?: number,
        ): void;
        forceTreasure(
            kind?: "overdrive" | "repair" | "vacuum" | "shield" | "frenzy" | "freeze" | "nova" | "jackpot",
            distance?: number,
        ): void;
        forceEnemy(
            kind?:
                | "skitter"
                | "brute"
                | "wisp"
                | "spinner"
                | "gunner"
                | "sniper"
                | "splitter"
                | "mine_layer"
                | "charger"
                | "siren"
                | "crusher",
            distance?: number,
            angle?: number,
        ): void;
        forceHorde(): void;
        forcePerformanceStress(): void;
        forceHazard(kind?: "bolt" | "sniper" | "mine" | "pulse", distance?: number, angle?: number): void;
        forcePickup(distance?: number): void;
        chooseUpgrade(index: number): void;
        openSettings(): void;
        openDailyRewards(): void;
        openOutfitter(): void;
        pause(): void;
        resume(): void;
        forceResults(): void;
        freezeSimulation(): void;
        setReducedMotion(enabled: boolean): void;
        setPerformanceHud(enabled: boolean): void;
        showMilestone(
            kicker: string,
            title: string,
            kind?: "overdrive" | "repair" | "vacuum" | "shield" | "frenzy" | "freeze" | "nova" | "jackpot",
        ): void;
    };
}
