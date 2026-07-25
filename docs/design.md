# SCRAP//SHIFT design brief

- Player fantasy / audience / orientation / session length: Be a quick-footed
  salvage runner turning a cursed neon junkyard against its own machine swarm;
  arcade players 10+, portrait or landscape with live switching, endless runs
  that terminate only when integrity reaches zero or the player ends the run.
- One-sentence core loop and first meaningful action: Tap through the crowd
  while auto-weapons shred the nearest threats, chain kills into multipliers,
  collect energy, open reward caches, and choose build-defining power cards;
  the first meaningful action is one tap that immediately steers out of the
  opening pincer.
- First 10-minute path: The menu shows movement and auto-fire in one line; the
  first run starts amid light pressure, the first kill drops a bright shard,
  the first level pauses safely for a three-card choice, a first hit teaches the
  health/invulnerability feedback, defeat offers instant retry, and the best
  score plus unlocked power combinations encourage another run.
- Controls, accessibility/comfort, and feedback design: Press anywhere on the
  playfield to anchor a floating stick, drag around that first touch point to
  steer with analog strength, and release to stop immediately. The stick
  appears only while held, so the playfield stays clear. A one-time touch
  prompt teaches the gesture, while WASD/arrows, Space, and the BURST button
  remain available. Base movement is 123.2 world units per second, exactly 10%
  above the previous 112 baseline. Portrait uses a
  taller camera, stacked cards, and bottom-corner controls; landscape uses a
  wide camera and horizontal cards. Orientation changes preserve the active
  run. Damage, pickups, upgrades, combo/cache milestones, and results combine
  shape, motion, text, sound, and optional haptics. Reduced motion removes shake,
  trims particles, and collapses decorative transition animations.
- Difficulty/pacing/content cadence and skill/RNG policy: The opening begins
  with skitters only through the end of level 2. Character level strictly gates
  each later family: brute at 3, wisp at 4, radial spinner at 5, gunner at 6,
  predictive sniper at 7, splitter at 8, mine layer at 9, charger at 10, pulse
  siren at 11, and crusher at 12.
  Level energy follows a strict linear formula: `24 + 10 × (level - 1)`.
  This delays the first upgrade and makes every later increase exactly
  predictable while preserving the authored enemy gates.
  A threat meter and unlock banner make the cadence legible. Spawn quantity
  rises continuously, but enemy variety is never unlocked by elapsed time.
  The opening provides 15 integrity, with all max-integrity upgrades capped at
  21. Pursuit speed rises continuously by up to 65%, 58% of moving-player
  spawns arrive inside a broad forward arc at a readable 235–315 unit distance,
  and aimed hostile bolts accelerate from 160 to 240 units per second. Contact
  and projectile damage add one point at 60 seconds and another at 120 seconds.
  The first warned horde arrives at 45 seconds, lasts 13 seconds, and returns
  every 55 seconds. Each breach begins in a readable 250–318 unit perimeter,
  then sends faster forward-biased attackers from 205–270 units. Reinforcements
  are spaced so pressure comes from at most 110 simultaneous enemies; hazards
  and scrap are capped at 120 each, while 30-second scrap expiry prevents
  abandoned infinite-world drops from consuming an unbounded phone budget.
  Ordinary repairs restore 3 and ordinary shields block one hit; only 22% of
  cache rolls supply repair or shielding. This lets early mistakes remain
  recoverable while stopping repeated cache drops from erasing the run's damage.
  Player speed, burst invulnerability, defensive upgrades, forward-spawn
  visibility, and projectile telegraphs preserve agency. Upgrade offerings and
  combat are seeded, capped, and covered by deterministic simulation. The first
  choice always exposes the Blade
  Carousel alongside a blaster improvement. Its eight levels map directly to
  one through eight rotating swords, each adding a new shape/color while the
  orbit widens and accelerates.
- Economy sources/sinks/caps and non-payer promise: Run-local energy is consumed
  automatically at each level threshold. Scrap coins enter a 92-pixel baseline
  magnet radius; each magnet upgrade adds 32 pixels. Their pull acceleration is
  less than half the former value, and old coins gain only a slow, capped
  100-pixel recovery radius after four seconds. The invisible radius avoids a misleading dotted
  debug-ring effect; moving coins and their short trails communicate attraction.
  Every 10–14 kills earns a pixel-art cache card carrying overdrive, repair,
  vacuum, shield, frenzy, cryo, nova, or jackpot power. The larger 38×48 pixel
  cards spawn 86–120 pixels from cache unlocks and use restrained attraction so
  their embedded 9×9 icon is actually visible before collection. In addition, a
  deterministic 82–118 second discovery cadence places one nearby pixel
  treasure chest after an initial 58-second grace period. Treasures remain long
  enough to route toward and grant stronger versions of all eight boosts.
  Salvage, kills, caches, records, and touch
  onboarding persist as progression counters. Every mechanic and power remains
  available without ads or payment. The planned fail-closed hybrid model sells
  only cosmetic pilot/blade skins and permanent interstitial removal at the
  explicit 199/299/399 RB catalog documented in `docs/monetization.md`. An
  optional confirmed results ad adds 50% of that run's earned salvage to the
  cosmetic wallet without altering run score or combat power. The only
  mandatory placement begins no earlier than the third completed run and can
  request an interstitial only after the results tally when an eligible player
  taps `RUN IT BACK` or `MAIN MENU`; rewarded interaction, checkout activity,
  no-ads ownership, cooldowns, and caps suppress it. No banner, launch, pause,
  upgrade, or mid-run ads exist. No spendable premium currency is proposed.
- Return reason and LiveOps/content seams: Best score, best survival time,
  highest level, lifetime kills/salvage/caches, combo mastery, and build
  experimentation across six weapon families and fourteen upgrade lines. Cards
  label `ADD WEAPON` versus `UPGRADE` and name the affected weapon family so
  build decisions remain clear on a phone.
  Enemy, weapon, upgrade, and powerup definitions use stable typed IDs.
- World structure: Simulation coordinates are unbounded and the camera follows
  without edge clamps. Deterministic 1800×1000 terrain chunks stream around the
  camera and vary among violet, rust, toxic-green, and steel regions, so moving
  indefinitely in any direction never reveals an arena wall or empty void.
- FTUE, core-loop, progression-stall, retention, and trust metrics:
  `run_started`, first movement, tap-control discovery, first kill, first
  upgrade, cache reward, damage taken, run end, retry, and settings changes; no
  private text or PII.
- Vertical slice, player-test plan, owner, and next decision date: One complete
  endless-survival loop with both orientations, tap/drag/stick/keyboard input,
  six weapons, fourteen upgrade lines, eleven level-gated enemies, eight
  bitmap-card powerups, warned recurring hordes, defeat results, save migration,
  sound, and lifecycle pause. The deterministic looping reference now fails at
  roughly 50 seconds after 13 registered hits. A 32-seed straight-line-kiting
  matrix has no survivors at the 180-second sample and a 50-second median, while
  a reactive dodge-and-pickup controller has 5 survivors and a 107-second
  median. This directly covers the infinite-world escape exploit while
  preserving a small but real skilled survival tail. Review this new lethality curve,
  restrained coin pull, and card legibility on a physical phone after the next
  owner playtest.

## Balance risks

- Dense projectile readability can collapse on small phones; procedural
  silhouettes, hostile-bolt coloring, bounded audio overlap, and reduced-motion
  particle caps preserve separation.
- The new curve deliberately makes recovery scarce enough for mistakes to
  accumulate. Watch first-60-second deaths, forward-spawn readability, and
  defensive-card dependence; if they spike, widen spawn distance before
  weakening the one- and two-minute pressure steps.
- Auto-targeting can feel passive; positioning, dash timing, pickup collection,
  and upgrade choices carry the skill expression.
- Early unlucky offers can stall a build; the seeded offer builder always
  includes at least one damage or cadence option until both reach level three,
  while the first choice also guarantees the Blade Carousel.
