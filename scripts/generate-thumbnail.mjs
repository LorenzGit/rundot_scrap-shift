import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const size = 512;
const pixels = Buffer.alloc(size * size * 3);

function fill(color) {
    for (let index = 0; index < size * size; index += 1) {
        pixels[index * 3] = color[0];
        pixels[index * 3 + 1] = color[1];
        pixels[index * 3 + 2] = color[2];
    }
}

function rect(x, y, width, height, color) {
    const minX = Math.max(0, Math.floor(x));
    const minY = Math.max(0, Math.floor(y));
    const maxX = Math.min(size, Math.ceil(x + width));
    const maxY = Math.min(size, Math.ceil(y + height));
    for (let py = minY; py < maxY; py += 1) {
        for (let px = minX; px < maxX; px += 1) {
            const offset = (py * size + px) * 3;
            pixels[offset] = color[0];
            pixels[offset + 1] = color[1];
            pixels[offset + 2] = color[2];
        }
    }
}

function diamond(cx, cy, radius, color) {
    for (let y = -radius; y <= radius; y += 1) {
        const half = radius - Math.abs(y);
        rect(cx - half, cy + y, half * 2 + 1, 1, color);
    }
}

function hook(x, y, scale) {
    rect(x, y, 12 * scale, 50 * scale, [22, 14, 43]);
    rect(x, y + 38 * scale, 50 * scale, 12 * scale, [22, 14, 43]);
    rect(x + 4 * scale, y + 3 * scale, 5 * scale, 36 * scale, [185, 255, 74]);
    rect(x + 5 * scale, y + 41 * scale, 39 * scale, 5 * scale, [232, 255, 124]);
}

fill([93, 27, 116]);
for (let y = 0; y < size; y += 32) {
    for (let x = 0; x < size; x += 32) {
        if (((x * 17 + y * 31) >>> 5) % 5 === 0) rect(x, y, 32, 32, [80, 22, 101]);
        if (((x * 13 + y * 7) >>> 4) % 7 === 0) rect(x + 8, y + 8, 16, 16, [111, 36, 135]);
    }
}

rect(0, 382, 512, 130, [49, 20, 68]);
for (let x = 0; x < 512; x += 40) {
    rect(x, 382 + ((x / 40) % 2) * 10, 26, 130, [65, 28, 82]);
}

// Enemy silhouettes
for (const [x, y, s] of [
    [72, 118, 1],
    [405, 105, 1.3],
    [425, 334, 0.9],
    [96, 353, 1.1],
]) {
    rect(x - 20 * s, y - 14 * s, 40 * s, 32 * s, [22, 14, 43]);
    rect(x - 11 * s, y - 7 * s, 7 * s, 7 * s, [185, 255, 74]);
    rect(x + 5 * s, y - 7 * s, 7 * s, 7 * s, [185, 255, 74]);
}

// Runner shadow and body
rect(174, 332, 170, 35, [22, 14, 43]);
rect(204, 212, 105, 130, [22, 14, 43]);
rect(217, 226, 82, 103, [239, 111, 56]);
rect(190, 126, 135, 112, [22, 14, 43]);
rect(204, 140, 108, 83, [255, 156, 56]);
rect(228, 158, 84, 48, [188, 231, 230]);
rect(255, 170, 57, 24, [36, 82, 110]);
rect(200, 119, 87, 18, [255, 243, 196]);
rect(288, 260, 123, 38, [22, 14, 43]);
rect(302, 269, 116, 20, [111, 247, 255]);
rect(230, 329, 30, 58, [22, 14, 43]);
rect(275, 329, 30, 58, [22, 14, 43]);
rect(231, 334, 21, 46, [255, 92, 120]);
rect(277, 334, 21, 46, [255, 92, 120]);

// Projectiles and pickups
hook(42, 205, 2);
hook(378, 207, 1.7);
for (const [x, y] of [
    [148, 90],
    [358, 74],
    [145, 284],
    [374, 316],
]) {
    rect(x - 28, y - 7, 56, 14, [22, 14, 43]);
    rect(x - 21, y - 3, 49, 7, [111, 247, 255]);
    rect(x - 3, y - 12, 8, 24, [255, 243, 196]);
}
for (const [x, y] of [
    [52, 73],
    [458, 173],
    [60, 430],
    [454, 431],
]) {
    diamond(x, y, 15, [22, 14, 43]);
    diamond(x, y, 10, [185, 255, 74]);
    rect(x - 2, y - 7, 5, 14, [232, 255, 124]);
}

// Pixel highlight frame
rect(0, 0, 512, 10, [22, 14, 43]);
rect(0, 502, 512, 10, [22, 14, 43]);
rect(0, 0, 10, 512, [22, 14, 43]);
rect(502, 0, 10, 512, [22, 14, 43]);
rect(10, 10, 492, 5, [255, 133, 220]);
rect(10, 497, 492, 5, [185, 255, 74]);

const projectDir = new URL("../", import.meta.url);
const publicDir = new URL("public/", projectDir);
mkdirSync(publicDir, { recursive: true });
const ppmUrl = new URL("thumbnail-source.ppm", publicDir);
const jpgUrl = new URL("thumbnail.jpg", publicDir);
writeFileSync(ppmUrl, Buffer.concat([Buffer.from(`P6\n${size} ${size}\n255\n`), pixels]));

const result = spawnSync(
    "/usr/bin/sips",
    ["-s", "format", "jpeg", "-s", "formatOptions", "88", ppmUrl.pathname, "--out", jpgUrl.pathname],
    {
        stdio: "inherit",
    },
);
if (result.status !== 0) throw new Error(`sips failed with status ${result.status}`);
unlinkSync(ppmUrl);
console.log(`generated ${jpgUrl.pathname}`);
