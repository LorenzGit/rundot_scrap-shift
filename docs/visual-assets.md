# SCRAP//SHIFT visual asset brief

## Art direction

- Palette, lighting, camera/composition, shape language, materials/texture:
  16-bit “toxic dusk” palette—plum asphalt, violet shadows, acid-lime pickups,
  ice-blue player fire, coral impacts, cream highlights; top-down camera;
  chunky two-pixel highlights, stepped corners, and dense but readable debris.
- Typography/UI treatment and forbidden traits: Heavy monospace labels, cream
  faces, navy drop-shadows, beveled pixel frames. No emoji, smooth gradients,
  glossy app-store UI, photorealism, stretched sprites, or generated text.
- Permitted reference sources and rights: The user-provided video is used only
  for mechanics, pacing, palette, and composition reference. All shipped art is
  original procedural geometry drawn by this project.

## Deliverables

| Asset | Purpose | Dimensions/aspect | Alpha? | Format | In-game scale | Delivery path |
| --- | --- | --- | --- | --- | --- | --- |
| Arena art | Gameplay world | 1800×1000 logical | n/a | Pixi geometry | 640×360 view | source code |
| Pixel actors/effects | Gameplay | 8–38 px shapes | yes | Pixi geometry | native logical px | source code |
| Blade Carousel | Signature orbit weapon | 1–8 swords / 20–42 px silhouettes | yes | Eight authored Pixi polygons | native logical px | `src/game/art.ts` |
| Powerup cards | Gameplay rewards | 26×34 px card / 9×9 px icon | yes | Embedded bitmap strings + Pixi geometry | native logical px | `src/game/art.ts` |
| Branded splash | Honest boot state | responsive 9:16 + 16:9 | n/a | HTML/CSS | viewport | `index.html` |
| Thumbnail | RUN catalog tile | 512×512 | no | JPG | tile/full | `public/thumbnail.jpg` |

## Production

- Method: Local, deterministic procedural geometry, five embedded 9×9 bitmap
  card illustrations, and a locally generated thumbnail; no generative model
  and zero RUN credits/ChatGPT image quota.
- Paid generation approval: Not requested or used.
- Edit history: Source art lives in `src/game/art.ts` and the thumbnail generator.

## Acceptance

- Landscape uses a 640×360 logical frame; portrait uses 360×640. The renderer
  changes dimensions and camera bounds instead of stretching the canvas.
- Phone/tablet/desktop layouts preserve their 16:9 or 9:16 playable frame with
  a decorative full-viewport backdrop and safe-area-padded controls. Live
  orientation changes preserve the world and run state.
- Pixel edges remain crisp at DPR 1–3; silhouettes retain shape without color;
  no alpha extraction or third-party asset path is involved.
- Blade Carousel levels one through eight add one sword each: cyan longsword,
  lime cleaver, coral flame blade, violet twin-fang, cream rapier, orange saw
  sword, pink hook sword, and blue greatsword. Rendering and collision share
  the same count, radius, and angle helpers so visible blade contact is honest.
- Upgrade cards use static weapon-family badges (`ADD WEAPON` or `UPGRADE`),
  explicit weapon names, and matching pixel icons. The Blade Carousel replaces
  the ambiguous crescent icon with a large sword silhouette in both the card
  and the run loadout.
- Each powerup card has a distinct silhouette, accent/highlight pair, dark card
  field, bright reward ribbon, static foil glint, and expiry flicker. Cards
  deliberately avoid looping flip, orbit, trail, scan, and hover effects so
  their embedded 9×9 bitmap art remains stable and readable.
- Magnetized coins retain bounded square-pixel trails. Card collection uses
  only the existing brief color-matched reward burst and flash.
- The magnet has no radius ring or orbiting marker dots; pull motion and short
  coin trails carry the feedback without competing with the sword carousel.
  Its ordinary 92-pixel reach, modest +32 upgrades, and slow capped mercy pull
  keep collection intentional; only the temporary Vacuum powerup has arena-wide
  attraction.
- Reward milestones use a compact top-center strip at the highest device-safe
  position with a static mini-card badge, keeping the active playfield clear.
- RUN provides safe boundaries in host-viewport coordinates, while the HUD is
  positioned inside a centered aspect-ratio frame. They are converted to signed
  frame offsets before CSS receives them: positive when host chrome overlaps
  the frame, negative when HUD must cross the frame edge into a letterbox
  gutter. Portrait HUD overflow is intentional so pilot/status/reward UI can
  touch the real top-safe boundary and the level-energy bar the real bottom-safe
  boundary. BURST docks immediately above it at bottom-left; combat progress
  sits bottom-right and the joystick clears both panels.
- The production build keeps core art code-local and the thumbnail at exactly
  512×512 JPG. Final screenshots are reviewed after the last visual change.
