import scrapyardLoopUrl from "../assets/audio/scrapyard-loop.mp3";

export type SoundCue =
    | "ui"
    | "shot"
    | "hit"
    | "down"
    | "pickup"
    | "hurt"
    | "dash"
    | "upgrade"
    | "bomb"
    | "arc"
    | "powerup"
    | "reward"
    | "combo"
    | "warning"
    | "defeat";

interface AudioSettings {
    musicEnabled: boolean;
    musicVolume: number;
    sfxEnabled: boolean;
    sfxVolume: number;
}

class AudioManager {
    private context: AudioContext | null = null;
    private readonly music = new Audio(scrapyardLoopUrl);
    private settings: AudioSettings = {
        musicEnabled: true,
        musicVolume: 0.34,
        sfxEnabled: true,
        sfxVolume: 0.62,
    };
    private unlocked = false;
    private paused = false;
    private readonly lastCueAt = new Map<SoundCue, number>();

    constructor() {
        this.music.loop = true;
        this.music.preload = "auto";
        this.music.volume = this.settings.musicVolume;
    }

    bindUnlock(): void {
        const unlock = (): void => {
            this.unlocked = true;
            this.ensureContext();
            const context = this.context;
            if (context) void context.resume().catch(() => undefined);
            this.syncMusic();
        };
        window.addEventListener("pointerdown", unlock, { once: true, passive: true });
        window.addEventListener("keydown", unlock, { once: true });
    }

    applySettings(settings: AudioSettings): void {
        this.settings = { ...settings };
        this.music.volume = Math.max(0, Math.min(1, settings.musicVolume));
        this.syncMusic();
    }

    setPaused(paused: boolean): void {
        this.paused = paused;
        if (paused) {
            this.music.pause();
            const context = this.context;
            if (context) void context.suspend().catch(() => undefined);
        } else {
            const context = this.context;
            if (context) void context.resume().catch(() => undefined);
            this.syncMusic();
        }
    }

    play(cue: SoundCue): void {
        if (!this.settings.sfxEnabled || this.paused) return;
        const context = this.ensureContext();
        if (!context) return;
        const minimumGap: Record<SoundCue, number> = {
            ui: 0.035,
            shot: 0.055,
            hit: 0.045,
            down: 0.07,
            pickup: 0.045,
            hurt: 0.1,
            dash: 0.08,
            upgrade: 0.15,
            bomb: 0.18,
            arc: 0.12,
            powerup: 0.14,
            reward: 0.22,
            combo: 0.18,
            warning: 0.32,
            defeat: 0.4,
        };
        const now = context.currentTime;
        if (now - (this.lastCueAt.get(cue) ?? -10) < minimumGap[cue]) return;
        this.lastCueAt.set(cue, now);
        const mapping: Record<SoundCue, [number, number, OscillatorType, number]> = {
            ui: [440, 620, "square", 0.05],
            shot: [720, 420, "square", 0.035],
            hit: [170, 110, "sawtooth", 0.04],
            down: [130, 65, "square", 0.09],
            pickup: [520, 880, "triangle", 0.07],
            hurt: [95, 48, "sawtooth", 0.18],
            dash: [260, 980, "sawtooth", 0.1],
            upgrade: [330, 990, "square", 0.28],
            bomb: [115, 38, "sawtooth", 0.24],
            arc: [880, 240, "square", 0.13],
            powerup: [440, 1174, "triangle", 0.24],
            reward: [523.25, 1396.91, "square", 0.34],
            combo: [659.25, 987.77, "triangle", 0.2],
            warning: [196, 82, "sawtooth", 0.32],
            defeat: [164.81, 65.41, "sawtooth", 0.45],
        };
        const values = mapping[cue];
        this.tone(context, values[0], values[1], values[2], values[3], this.settings.sfxVolume * 0.11);
    }

    destroy(): void {
        this.music.pause();
        this.music.currentTime = 0;
        const context = this.context;
        if (context) void context.close().catch(() => undefined);
        this.context = null;
    }

    private ensureContext(): AudioContext | null {
        if (this.context) return this.context;
        try {
            this.context = new AudioContext();
            return this.context;
        } catch {
            return null;
        }
    }

    private syncMusic(): void {
        if (!this.unlocked || this.paused || !this.settings.musicEnabled) {
            this.music.pause();
            return;
        }
        void this.music.play().catch(() => undefined);
    }

    private tone(
        context: AudioContext,
        from: number,
        to: number,
        type: OscillatorType,
        duration: number,
        volume: number,
    ): void {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
    }
}

export const audioManager = new AudioManager();
