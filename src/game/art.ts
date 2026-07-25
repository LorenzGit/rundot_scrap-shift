import { Graphics } from "pixi.js";
import type { SkinDefinition } from "../systems/cosmetics.ts";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./config.ts";
import type {
    EnemyState,
    HazardState,
    PickupState,
    PlayerState,
    PowerupKind,
    PowerupState,
    ProjectileState,
    TreasureState,
} from "./types.ts";

const COLORS = {
    ink: 0x180f2e,
    outline: 0x26133f,
    floor: 0x67217f,
    floorDark: 0x57196e,
    floorLight: 0x762a8e,
    pavement: 0x5b4a86,
    pavementLight: 0x76649f,
    blue: 0x6ff7ff,
    blueDark: 0x2984b8,
    lime: 0xb9ff4a,
    limeDark: 0x55b96c,
    pink: 0xff85dc,
    coral: 0xff5c78,
    orange: 0xff9c38,
    cream: 0xfff3c4,
    steel: 0x7783a7,
    steelDark: 0x3a3b65,
} as const;

interface BladeCarouselStyle {
    blade: number;
    highlight: number;
    hilt: number;
    silhouette: readonly (readonly [number, number])[];
}

export const BLADE_CAROUSEL_STYLES: readonly BladeCarouselStyle[] = [
    {
        blade: COLORS.blue,
        highlight: COLORS.cream,
        hilt: COLORS.blueDark,
        silhouette: [
            [-3, -4],
            [11, -4],
            [17, 0],
            [11, 4],
            [-3, 4],
        ],
    },
    {
        blade: COLORS.lime,
        highlight: COLORS.cream,
        hilt: COLORS.limeDark,
        silhouette: [
            [-3, -6],
            [12, -6],
            [17, -2],
            [15, 5],
            [-3, 4],
        ],
    },
    {
        blade: COLORS.coral,
        highlight: COLORS.orange,
        hilt: 0x923953,
        silhouette: [
            [-3, -4],
            [3, -7],
            [6, -3],
            [11, -6],
            [17, 0],
            [10, 6],
            [6, 3],
            [2, 6],
            [-3, 4],
        ],
    },
    {
        blade: 0x9f91ff,
        highlight: COLORS.blue,
        hilt: 0x5b4a86,
        silhouette: [
            [-3, -5],
            [11, -5],
            [17, -2],
            [10, 0],
            [17, 3],
            [11, 5],
            [-3, 5],
        ],
    },
    {
        blade: COLORS.cream,
        highlight: COLORS.pink,
        hilt: COLORS.steel,
        silhouette: [
            [-3, -2],
            [15, -2],
            [20, 0],
            [15, 2],
            [-3, 2],
        ],
    },
    {
        blade: COLORS.orange,
        highlight: COLORS.cream,
        hilt: 0xa95042,
        silhouette: [
            [-3, -5],
            [4, -5],
            [6, -8],
            [9, -5],
            [11, -7],
            [13, -3],
            [18, 0],
            [13, 4],
            [10, 4],
            [8, 7],
            [5, 4],
            [-3, 4],
        ],
    },
    {
        blade: COLORS.pink,
        highlight: COLORS.cream,
        hilt: 0xa9428b,
        silhouette: [
            [-3, -5],
            [9, -5],
            [15, -1],
            [17, 5],
            [12, 8],
            [11, 2],
            [7, 0],
            [-3, 4],
        ],
    },
    {
        blade: 0x4b72ff,
        highlight: COLORS.blue,
        hilt: 0x2b3470,
        silhouette: [
            [-3, -7],
            [12, -7],
            [17, -4],
            [21, 0],
            [17, 4],
            [12, 7],
            [-3, 7],
        ],
    },
] as const;

interface PowerupCardArt {
    accent: number;
    highlight: number;
    bitmap: readonly string[];
}

const POWERUP_CARD_ART: Readonly<Record<PowerupKind, PowerupCardArt>> = {
    overdrive: {
        accent: COLORS.orange,
        highlight: COLORS.lime,
        bitmap: [
            "000111000",
            "001232000",
            "001232000",
            "012220000",
            "000232100",
            "000232000",
            "001220000",
            "001200000",
            "000100000",
        ],
    },
    repair: {
        accent: COLORS.coral,
        highlight: COLORS.cream,
        bitmap: [
            "011000110",
            "122101221",
            "123212321",
            "123333321",
            "012333210",
            "001232100",
            "000121000",
            "000010000",
            "000000000",
        ],
    },
    vacuum: {
        accent: COLORS.blue,
        highlight: COLORS.cream,
        bitmap: [
            "112000211",
            "123000321",
            "123000321",
            "123000321",
            "123000321",
            "123000321",
            "122333221",
            "012222210",
            "001111100",
        ],
    },
    shield: {
        accent: 0x9f91ff,
        highlight: COLORS.blue,
        bitmap: [
            "000111000",
            "011222110",
            "122333221",
            "123232321",
            "123232321",
            "012333210",
            "001232100",
            "000121000",
            "000010000",
        ],
    },
    frenzy: {
        accent: COLORS.pink,
        highlight: COLORS.cream,
        bitmap: [
            "100000001",
            "210000012",
            "321000123",
            "032101230",
            "003232300",
            "032101230",
            "321000123",
            "210000012",
            "100000001",
        ],
    },
    freeze: {
        accent: COLORS.blue,
        highlight: 0xc9ffff,
        bitmap: [
            "100010001",
            "010121010",
            "001232100",
            "012333210",
            "123333321",
            "012333210",
            "001232100",
            "010121010",
            "100010001",
        ],
    },
    nova: {
        accent: COLORS.lime,
        highlight: COLORS.cream,
        bitmap: [
            "000010000",
            "010121010",
            "001232100",
            "012333210",
            "123333321",
            "012333210",
            "001232100",
            "010121010",
            "000010000",
        ],
    },
    jackpot: {
        accent: 0xf6d36b,
        highlight: COLORS.lime,
        bitmap: [
            "000131000",
            "010232010",
            "001232100",
            "112333211",
            "023333320",
            "011232110",
            "001232100",
            "010121010",
            "000010000",
        ],
    },
};

function rect(graphics: Graphics, x: number, y: number, width: number, height: number, color: number): void {
    graphics.rect(Math.round(x), Math.round(y), Math.round(width), Math.round(height)).fill(color);
}

function diamond(graphics: Graphics, x: number, y: number, radius: number, color: number): void {
    graphics
        .poly([
            Math.round(x),
            Math.round(y - radius),
            Math.round(x + radius),
            Math.round(y),
            Math.round(x),
            Math.round(y + radius),
            Math.round(x - radius),
            Math.round(y),
        ])
        .fill(color);
}

function drawBitmap(
    graphics: Graphics,
    bitmap: readonly string[],
    x: number,
    y: number,
    pixelSize: number,
    palette: Readonly<Record<string, number>>,
): void {
    bitmap.forEach((row, rowIndex) => {
        for (let column = 0; column < row.length; column += 1) {
            const color = palette[row[column] ?? "0"];
            if (color === undefined) continue;
            rect(graphics, x + column * pixelSize, y + rowIndex * pixelSize, pixelSize, pixelSize, color);
        }
    });
}

function transformBladePoints(
    points: readonly (readonly [number, number])[],
    x: number,
    y: number,
    angle: number,
    scale = 1,
): number[] {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return points.flatMap(([pointX, pointY]) => [
        Math.round(x + (pointX * cosine - pointY * sine) * scale),
        Math.round(y + (pointX * sine + pointY * cosine) * scale),
    ]);
}

function drawBladePolygon(
    graphics: Graphics,
    points: readonly (readonly [number, number])[],
    x: number,
    y: number,
    angle: number,
    color: number,
    scale = 1,
): void {
    graphics.poly(transformBladePoints(points, x, y, angle, scale)).fill(color);
}

function drawCarouselBlade(
    graphics: Graphics,
    x: number,
    y: number,
    angle: number,
    style: Readonly<BladeCarouselStyle>,
): void {
    const guard: readonly (readonly [number, number])[] = [
        [-7, -8],
        [-3, -8],
        [-3, 8],
        [-7, 8],
    ];
    const handle: readonly (readonly [number, number])[] = [
        [-13, -3],
        [-6, -3],
        [-6, 3],
        [-13, 3],
    ];
    const highlight: readonly (readonly [number, number])[] = [
        [-1, -3],
        [8, -3],
        [11, -1],
        [-1, -1],
    ];
    const pommel: readonly (readonly [number, number])[] = [
        [-15, 0],
        [-12, -4],
        [-9, 0],
        [-12, 4],
    ];

    drawBladePolygon(graphics, style.silhouette, x + 2, y + 2, angle, COLORS.ink);
    drawBladePolygon(graphics, style.silhouette, x, y, angle, style.blade, 0.88);
    drawBladePolygon(graphics, highlight, x, y, angle, style.highlight);
    drawBladePolygon(graphics, guard, x + 2, y + 2, angle, COLORS.ink);
    drawBladePolygon(graphics, guard, x, y, angle, style.hilt, 0.78);
    drawBladePolygon(graphics, handle, x + 2, y + 2, angle, COLORS.ink);
    drawBladePolygon(graphics, handle, x, y, angle, COLORS.cream, 0.72);
    drawBladePolygon(graphics, pommel, x + 2, y + 2, angle, COLORS.ink);
    drawBladePolygon(graphics, pommel, x, y, angle, style.hilt, 0.7);
}

function hash(x: number, y: number): number {
    let value = Math.imul(x ^ 0x9e37, 0x85ebca6b) ^ Math.imul(y ^ 0xc2b2, 0x27d4eb2f);
    value ^= value >>> 15;
    return value >>> 0;
}

function drawCar(graphics: Graphics, x: number, y: number, color: number): void {
    rect(graphics, x - 22, y - 11, 44, 22, COLORS.ink);
    rect(graphics, x - 20, y - 9, 40, 18, color);
    rect(graphics, x - 10, y - 7, 22, 7, 0x223c5c);
    rect(graphics, x - 16, y + 5, 7, 3, COLORS.cream);
    rect(graphics, x + 10, y + 5, 7, 3, COLORS.coral);
    rect(graphics, x - 17, y - 13, 8, 4, COLORS.ink);
    rect(graphics, x + 9, y - 13, 8, 4, COLORS.ink);
}

function drawPalm(graphics: Graphics, x: number, y: number): void {
    rect(graphics, x - 3, y - 2, 6, 29, COLORS.outline);
    rect(graphics, x - 1, y, 4, 27, 0xa76b42);
    rect(graphics, x - 17, y - 8, 34, 6, 0x1d534f);
    rect(graphics, x - 13, y - 14, 10, 9, 0x2c7a61);
    rect(graphics, x + 4, y - 15, 10, 10, 0x2c7a61);
    rect(graphics, x - 6, y - 17, 12, 9, 0x3a9a69);
}

function drawBuilding(
    graphics: Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    pavement: number = COLORS.pavement,
    pavementLight: number = COLORS.pavementLight,
): void {
    rect(graphics, x - 4, y - 4, width + 8, height + 8, COLORS.ink);
    rect(graphics, x, y, width, height, pavement);
    for (let tileX = x + 4; tileX < x + width - 3; tileX += 16) {
        for (let tileY = y + 4; tileY < y + height - 3; tileY += 16) {
            const shade = hash(tileX, tileY) % 3 === 0 ? pavementLight : pavement;
            rect(graphics, tileX, tileY, 12, 12, shade);
            rect(graphics, tileX, tileY + 11, 12, 1, COLORS.outline);
        }
    }
    rect(graphics, x + width * 0.58, y + height * 0.45, 24, 20, COLORS.outline);
    rect(graphics, x + width * 0.58 + 3, y + height * 0.45 + 3, 18, 14, 0x367565);
    rect(graphics, x + width * 0.58 + 7, y + height * 0.45 + 7, 10, 6, 0x4b9b65);
    drawPalm(graphics, x + width * 0.24, y + height * 0.24);
}

const GROUND_REGIONS = [
    {
        floor: 0x67217f,
        dark: 0x57196e,
        light: 0x762a8e,
        accent: 0x9d3aa8,
        structure: 0x5b4a86,
        structureLight: 0x76649f,
    },
    {
        floor: 0x6b4038,
        dark: 0x523139,
        light: 0x855044,
        accent: 0xc36a45,
        structure: 0x66506b,
        structureLight: 0x826785,
    },
    {
        floor: 0x315c55,
        dark: 0x284842,
        light: 0x3d7260,
        accent: 0x55b96c,
        structure: 0x405a69,
        structureLight: 0x587a80,
    },
    {
        floor: 0x48486d,
        dark: 0x363754,
        light: 0x5d5b82,
        accent: 0x2984b8,
        structure: 0x555279,
        structureLight: 0x716d99,
    },
] as const;

const ARENA_VARIANT_SEEDS = [
    [-4, 0],
    [-2, 0],
    [0, 0],
    [-1, 0],
] as const;

export function arenaTileVariant(tileX: number, tileY: number): number {
    return hash(tileX * 97 + 19, tileY * 131 - 7) % GROUND_REGIONS.length;
}

export function createArenaArt(tileX = 0, tileY = 0): Graphics {
    const graphics = new Graphics();
    const region = GROUND_REGIONS[arenaTileVariant(tileX, tileY)] ?? GROUND_REGIONS[0];
    rect(graphics, 0, 0, WORLD_WIDTH, WORLD_HEIGHT, region.floor);

    for (let zone = 0; zone < 7; zone += 1) {
        const zoneSeed = hash(tileX * 47 + zone * 13, tileY * 59 - zone * 17);
        const width = 160 + (zoneSeed % 260);
        const height = 110 + ((zoneSeed >>> 5) % 210);
        const x = (zoneSeed >>> 9) % Math.max(1, WORLD_WIDTH - width);
        const y = (zoneSeed >>> 17) % Math.max(1, WORLD_HEIGHT - height);
        const color = zone % 3 === 0 ? region.light : zone % 3 === 1 ? region.dark : region.accent;
        rect(graphics, x, y, width, height, color);
        rect(graphics, x + 8, y + 8, Math.max(8, width - 16), 4, region.floor);
        rect(graphics, x + width - 12, y + 12, 4, Math.max(8, height - 24), region.dark);
    }

    for (let y = 0; y < WORLD_HEIGHT; y += 32) {
        for (let x = 0; x < WORLD_WIDTH; x += 32) {
            const value = hash(x + tileX * 181, y + tileY * 223);
            if (value % 5 === 0) rect(graphics, x, y, 32, 32, region.dark);
            if (value % 11 === 0) rect(graphics, x + 8, y + 8, 16, 16, region.light);
            if (value % 9 === 0) {
                rect(graphics, x + 5, y + 13, 8, 2, region.accent);
                rect(graphics, x + 11, y + 10, 2, 7, region.accent);
            }
        }
    }

    const buildings = [
        [70, 80, 142, 100],
        [410, 44, 126, 92],
        [730, 110, 154, 104],
        [1090, 54, 138, 98],
        [1460, 92, 146, 108],
        [230, 790, 148, 104],
        [620, 824, 144, 96],
        [1010, 770, 150, 106],
        [1390, 812, 136, 98],
    ] as const;
    buildings.forEach(([x, y, width, height], index) => {
        if (hash(tileX * 31 + index, tileY * 43 - index) % 4 !== 0) {
            drawBuilding(graphics, x, y, width, height, region.structure, region.structureLight);
        }
    });

    const cars = [
        [315, 210, 0x236b68],
        [570, 680, 0x90494f],
        [900, 235, 0x2d746d],
        [1260, 640, 0x9e5a37],
        [1570, 330, 0x4c5c84],
    ] as const;
    cars.forEach(([x, y, color], index) => {
        if (hash(tileX * 67 + index, tileY * 79 + index) % 3 !== 0) drawCar(graphics, x, y, color);
    });

    for (let index = 0; index < 34; index += 1) {
        const x = 40 + (hash(index + tileX * 103, 14 + tileY * 71) % (WORLD_WIDTH - 80));
        const y = 40 + (hash(index + tileY * 89, 29 + tileX * 61) % (WORLD_HEIGHT - 80));
        rect(graphics, x, y, 8, 3, COLORS.outline);
        rect(graphics, x + 2, y - 2, 4, 2, COLORS.steel);
        if (index % 4 === 0) {
            rect(graphics, x + 10, y + 8, 4, 7, COLORS.orange);
            rect(graphics, x + 9, y + 14, 6, 2, COLORS.cream);
        }
    }

    return graphics;
}

export function createArenaVariant(variant: number): Graphics {
    const [tileX, tileY] = ARENA_VARIANT_SEEDS[variant % ARENA_VARIANT_SEEDS.length] ?? ARENA_VARIANT_SEEDS[0];
    return createArenaArt(tileX, tileY);
}

export function drawPlayer(
    graphics: Graphics,
    player: Readonly<PlayerState>,
    elapsed: number,
    skin: Readonly<SkinDefinition>,
): void {
    graphics.clear();
    const blink = player.invulnerableFor > 0 && Math.floor(elapsed * 18) % 2 === 0;
    graphics.alpha = blink ? 0.45 : 1;
    graphics.scale.x = player.facingX < -0.05 ? -1 : 1;
    const bob = Math.abs(player.dashFor) > 0 ? 0 : Math.floor(elapsed * 8) % 2;

    rect(graphics, -9, 8, 19, 5, COLORS.ink);
    rect(graphics, -5, 5 + bob, 5, 6, 0x4c385d);
    rect(graphics, 2, 5 - bob, 5, 6, 0x4c385d);
    rect(graphics, -7, -2, 14, 10, COLORS.outline);
    rect(graphics, -5, -1, 11, 8, skin.player.suit);
    rect(graphics, -7, -10, 15, 12, COLORS.outline);
    rect(graphics, -5, -9, 12, 9, skin.player.suit);
    rect(graphics, -2, -7, 8, 5, skin.player.visor);
    rect(graphics, 1, -6, 5, 3, skin.player.visorShade);
    rect(graphics, -8, -7, 3, 8, skin.player.trim);
    rect(graphics, 7, 0, 8, 4, COLORS.outline);
    rect(graphics, 9, 1, 8, 2, skin.player.weapon);
    rect(graphics, -2, -12, 7, 2, COLORS.cream);
}

export function drawEnemy(graphics: Graphics, enemy: Readonly<EnemyState>, elapsed: number): void {
    graphics.clear();
    graphics.alpha = 1;
    const flash = enemy.hitFlash > 0 ? COLORS.cream : null;
    const bob = Math.floor((elapsed * 6 + enemy.id) % 2);
    rect(graphics, -enemy.radius, enemy.radius - 2, enemy.radius * 2, 4, COLORS.ink);

    if (enemy.kind === "skitter") {
        rect(graphics, -9, 1 + bob, 18, 7, flash ?? COLORS.steelDark);
        rect(graphics, -7, -5 + bob, 14, 9, flash ?? 0x536181);
        rect(graphics, -4, -3 + bob, 8, 3, COLORS.coral);
        rect(graphics, -11, 5, 4, 2, COLORS.outline);
        rect(graphics, 7, 5, 4, 2, COLORS.outline);
    } else if (enemy.kind === "brute") {
        rect(graphics, -13, -8 + bob, 26, 18, flash ?? COLORS.steelDark);
        rect(graphics, -10, -11 + bob, 20, 14, flash ?? COLORS.steel);
        rect(graphics, -6, -7 + bob, 12, 6, COLORS.orange);
        rect(graphics, -4, -5 + bob, 8, 2, COLORS.cream);
        rect(graphics, -15, -1, 5, 8, COLORS.outline);
        rect(graphics, 10, -1, 5, 8, COLORS.outline);
    } else if (enemy.kind === "wisp") {
        graphics.poly([-9, 7, -12, 0, -7, -9, 0, -12, 8, -7, 11, 1, 7, 10, 0, 7, -5, 11]).fill(flash ?? COLORS.ink);
        rect(graphics, -5, -4, 3, 3, COLORS.lime);
        rect(graphics, 3, -4, 3, 3, COLORS.lime);
        rect(graphics, -2, 2, 5, 2, 0x68214e);
    } else if (enemy.kind === "spinner") {
        diamond(graphics, 0, -1 + bob, 12, flash ?? COLORS.outline);
        diamond(graphics, 0, -1 + bob, 8, flash ?? 0x774c92);
        rect(graphics, -14, -2 + bob, 28, 4, COLORS.pink);
        rect(graphics, -2, -15 + bob, 4, 28, COLORS.blue);
        diamond(graphics, 0, -1 + bob, 4, COLORS.cream);
    } else if (enemy.kind === "gunner") {
        rect(graphics, -11, -7 + bob, 22, 16, flash ?? 0x315b72);
        rect(graphics, -8, -10 + bob, 16, 8, flash ?? COLORS.blueDark);
        rect(graphics, -5, -7 + bob, 10, 3, COLORS.blue);
        rect(graphics, 8, -3, 10, 5, COLORS.outline);
        rect(graphics, 10, -2, 10, 3, COLORS.coral);
    } else if (enemy.kind === "sniper") {
        rect(graphics, -10, -9 + bob, 20, 18, flash ?? 0x41365e);
        rect(graphics, -7, -11 + bob, 14, 7, flash ?? COLORS.pink);
        rect(graphics, -4, -8 + bob, 8, 3, COLORS.cream);
        rect(graphics, 7, -4, 15, 5, COLORS.outline);
        rect(graphics, 9, -3, 15, 3, COLORS.pink);
        rect(graphics, -13, 4, 5, 5, COLORS.blue);
    } else if (enemy.kind === "splitter") {
        diamond(graphics, 0, -1 + bob, 14, flash ?? COLORS.outline);
        diamond(graphics, 0, -1 + bob, 10, flash ?? 0x765c99);
        rect(graphics, -8, -3 + bob, 6, 4, COLORS.pink);
        rect(graphics, 3, -3 + bob, 6, 4, COLORS.lime);
        rect(graphics, -2, -12 + bob, 4, 24, COLORS.ink);
    } else if (enemy.kind === "mine_layer") {
        rect(graphics, -14, -9 + bob, 28, 19, flash ?? COLORS.outline);
        rect(graphics, -11, -7 + bob, 22, 15, flash ?? 0x4e6b62);
        rect(graphics, -7, -5 + bob, 14, 7, COLORS.limeDark);
        rect(graphics, -3, -3 + bob, 6, 3, COLORS.lime);
        rect(graphics, -17, 3, 7, 7, COLORS.ink);
        rect(graphics, 10, 3, 7, 7, COLORS.ink);
        rect(graphics, -5, 8, 10, 5, COLORS.orange);
    } else if (enemy.kind === "charger") {
        rect(graphics, -14, -8 + bob, 28, 18, flash ?? 0x6d3d59);
        rect(graphics, -10, -12 + bob, 20, 12, flash ?? 0xa34d5b);
        rect(graphics, -7, -8 + bob, 14, 5, COLORS.orange);
        rect(graphics, -18, -4, 7, 4, COLORS.outline);
        rect(graphics, 11, -4, 7, 4, COLORS.outline);
        rect(graphics, -3, 5, 6, 8, COLORS.coral);
    } else if (enemy.kind === "siren") {
        diamond(graphics, 0, -1 + bob, 16, flash ?? COLORS.outline);
        diamond(graphics, 0, -1 + bob, 12, flash ?? 0x713f75);
        rect(graphics, -12, -4 + bob, 24, 7, COLORS.pink);
        rect(graphics, -7, -2 + bob, 14, 3, COLORS.cream);
        rect(graphics, -3, -15 + bob, 6, 7, COLORS.blue);
        rect(graphics, -3, 8 + bob, 6, 7, COLORS.blue);
    } else {
        rect(graphics, -19, -10 + bob, 38, 22, flash ?? COLORS.outline);
        rect(graphics, -15, -14 + bob, 30, 20, flash ?? 0x4c4d71);
        rect(graphics, -10, -10 + bob, 20, 7, 0x92455c);
        rect(graphics, -6, -8 + bob, 12, 3, COLORS.orange);
        rect(graphics, -21, 4, 8, 8, COLORS.ink);
        rect(graphics, 13, 4, 8, 8, COLORS.ink);
        rect(graphics, -2, 5, 4, 8, COLORS.coral);
    }

    if (enemy.horde) {
        rect(graphics, -enemy.radius, -enemy.radius - 4, 5, 3, COLORS.coral);
        rect(graphics, enemy.radius - 5, -enemy.radius - 4, 5, 3, COLORS.coral);
    }

    if (enemy.hp < enemy.maxHp && enemy.kind !== "skitter") {
        rect(graphics, -enemy.radius, -enemy.radius - 7, enemy.radius * 2, 3, COLORS.ink);
        rect(
            graphics,
            -enemy.radius + 1,
            -enemy.radius - 6,
            (enemy.radius * 2 - 2) * Math.max(0, enemy.hp / enemy.maxHp),
            1,
            COLORS.coral,
        );
    }
}

export function drawProjectile(graphics: Graphics, projectile: Readonly<ProjectileState>): void {
    graphics.clear();
    const angle = Math.atan2(projectile.vy, projectile.vx);
    graphics.rotation = angle;
    if (projectile.kind === "blaster") {
        rect(graphics, -5, -2, 11, 5, COLORS.outline);
        rect(graphics, -3, -1, 9, 3, COLORS.blue);
        rect(graphics, -1, -3, 3, 7, 0xc9ffff);
    } else if (projectile.kind === "hook") {
        rect(graphics, -8, -7, 6, 16, COLORS.outline);
        rect(graphics, -7, 2, 16, 6, COLORS.outline);
        rect(graphics, -5, -5, 3, 10, COLORS.lime);
        rect(graphics, -4, 3, 11, 3, 0xe7ff7a);
    } else if (projectile.kind === "star") {
        diamond(graphics, 0, 0, 5, COLORS.outline);
        rect(graphics, -1, -5, 3, 11, COLORS.pink);
        rect(graphics, -5, -1, 11, 3, COLORS.cream);
    } else {
        graphics.rotation = 0;
        rect(graphics, -7, -6, 14, 13, COLORS.outline);
        rect(graphics, -5, -4, 10, 9, COLORS.orange);
        rect(graphics, -2, -7, 4, 5, COLORS.steel);
        rect(graphics, 1, -9, 5, 3, COLORS.lime);
    }
}

export function drawPickup(graphics: Graphics, pickup: Readonly<PickupState>): void {
    graphics.clear();
    const bounce = Math.round(Math.sin(pickup.phase) * 2);
    const highValue = pickup.value > 2;
    const coin = highValue ? COLORS.cream : 0xf6d36b;
    rect(graphics, -7, 7, 14, 3, COLORS.ink);
    rect(graphics, -5, -7 + bounce, 10, 15, COLORS.outline);
    rect(graphics, -7, -5 + bounce, 14, 11, COLORS.outline);
    rect(graphics, -4, -5 + bounce, 8, 11, coin);
    rect(graphics, -5, -3 + bounce, 10, 7, coin);
    rect(graphics, -2, -3 + bounce, 3, 7, highValue ? COLORS.orange : COLORS.limeDark);
    rect(graphics, 2, -3 + bounce, 2, 4, COLORS.cream);
}

export function drawHazard(graphics: Graphics, hazard: Readonly<HazardState>): void {
    graphics.clear();
    graphics.rotation = hazard.kind === "mine" ? 0 : Math.atan2(hazard.vy, hazard.vx);
    if (hazard.kind === "sniper") {
        rect(graphics, -12, -3, 22, 7, COLORS.outline);
        rect(graphics, -10, -1, 20, 3, COLORS.pink);
        rect(graphics, 3, -2, 6, 5, COLORS.cream);
    } else if (hazard.kind === "mine") {
        const armed = hazard.life < hazard.maxLife - 0.55;
        diamond(graphics, 0, 0, 14, COLORS.outline);
        diamond(graphics, 0, 0, 10, armed ? COLORS.orange : COLORS.steelDark);
        rect(graphics, -3, -3, 7, 7, armed ? COLORS.coral : COLORS.cream);
        rect(graphics, -18, -2, 7, 5, COLORS.outline);
        rect(graphics, 11, -2, 7, 5, COLORS.outline);
        rect(graphics, -2, -18, 5, 7, COLORS.outline);
        rect(graphics, -2, 11, 5, 7, COLORS.outline);
    } else if (hazard.kind === "pulse") {
        diamond(graphics, 0, 0, 6, COLORS.outline);
        diamond(graphics, 0, 0, 3, COLORS.lime);
        rect(graphics, -9, -1, 18, 3, COLORS.pink);
    } else {
        rect(graphics, -7, -4, 13, 8, COLORS.outline);
        rect(graphics, -5, -2, 10, 4, COLORS.coral);
        rect(graphics, 1, -3, 4, 6, COLORS.orange);
    }
}

export function drawTreasure(graphics: Graphics, treasure: Readonly<TreasureState>): void {
    graphics.clear();
    const art = POWERUP_CARD_ART[treasure.kind];
    const bob = Math.round(Math.sin(treasure.phase) * 2);
    const sparkle = Math.sin(treasure.phase * 1.6) > 0 ? 1 : 0;
    graphics.alpha = treasure.life < 4 && Math.floor(treasure.life * 8) % 2 === 0 ? 0.45 : 1;

    rect(graphics, -20, 12, 40, 5, COLORS.ink);
    rect(graphics, -18, -10 + bob, 36, 24, COLORS.ink);
    rect(graphics, -16, -8 + bob, 32, 20, 0x7e4a35);
    rect(graphics, -16, -8 + bob, 32, 7, art.accent);
    rect(graphics, -13, -5 + bob, 26, 3, art.highlight);
    rect(graphics, -16, 1 + bob, 32, 4, 0x4c2f3c);
    rect(graphics, -5, -1 + bob, 10, 12, COLORS.ink);
    rect(graphics, -3, 1 + bob, 6, 7, art.highlight);
    rect(graphics, -1, 2 + bob, 2, 4, COLORS.cream);

    rect(graphics, -25, -2 + bob, 3 + sparkle, 3 + sparkle, art.accent);
    rect(graphics, 21, -7 + bob, 4 + sparkle, 4 + sparkle, art.highlight);
    rect(graphics, -7, -17 + bob, 3 + sparkle, 3 + sparkle, COLORS.cream);
}

export function drawPowerup(graphics: Graphics, powerup: Readonly<PowerupState>): void {
    graphics.clear();
    graphics.rotation = 0;
    graphics.scale.x = 1;
    graphics.scale.y = 1;
    const art = POWERUP_CARD_ART[powerup.kind];
    const bob = Math.round(Math.sin(powerup.phase) * 1.5);
    const cardY = -24 + bob;
    diamond(graphics, 0, 0, 25, 0x241838);
    rect(graphics, -23, -2, 5, 5, art.highlight);
    rect(graphics, 19, -2, 5, 5, art.accent);
    rect(graphics, -2, -30 + bob, 5, 5, COLORS.cream);
    rect(graphics, -2, 26 + bob, 5, 5, art.highlight);
    rect(graphics, -20, 23 + bob, 40, 5, COLORS.ink);
    rect(graphics, -19, cardY, 38, 48, COLORS.ink);
    rect(graphics, -16, cardY + 3, 32, 42, art.accent);
    rect(graphics, -14, cardY + 5, 28, 30, 0x3a2852);
    rect(graphics, -14, cardY + 37, 28, 5, art.highlight);
    rect(graphics, -11, cardY + 38, 15, 3, COLORS.cream);
    drawBitmap(graphics, art.bitmap, -13, cardY + 7, 3, {
        "1": COLORS.ink,
        "2": art.accent,
        "3": art.highlight,
    });
    rect(graphics, 10, cardY + 5, 3, 4, COLORS.cream);
    graphics.alpha = powerup.life < 2 && Math.floor(powerup.life * 10) % 2 === 0 ? 0.45 : 1;
}

export function drawCarouselBladeSprite(graphics: Graphics, index: number, skin: Readonly<SkinDefinition>): void {
    graphics.clear();
    const baseStyle = BLADE_CAROUSEL_STYLES[index];
    if (!baseStyle) return;
    const blade = skin.blades[index % skin.blades.length] ?? baseStyle.blade;
    drawCarouselBlade(graphics, 0, 0, 0, {
        ...baseStyle,
        blade,
        highlight: index % 2 === 0 ? skin.player.visor : skin.player.trim,
        hilt: skin.player.visorShade,
    });
}

export const ART_COLORS = COLORS;
