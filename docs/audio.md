# SCRAP//SHIFT audio brief

## Direction

- Mood and palette: Fast junkyard electro built around the user-provided
  “Scrapyard Loop,” with clipped procedural SFX, metallic downbeats, bright
  salvage chirps, and short arcade outcomes. Avoid realistic gunfire, speech,
  and harsh full-scale noise.
- Listening contexts: Portrait or landscape on phone speakers first, with
  headphones and desktop embeds as secondary contexts.

## Music states

- Menu/gameplay share one bundled, looping MP3 owned by `AudioManager`. The
  persisted music slider directly controls the media element, so the existing
  0.34 default produces 34% effective playback. Pause or host sleep pauses both
  the media element and SFX `AudioContext`; resume restarts only after the
  first player gesture.
- Victory and defeat use distinct bounded stingers. Muted or unavailable audio
  never removes the corresponding screen flash, copy, particles, or haptic.

## Feedback map

- Input: UI click, blaster shot, and burst cues.
- Combat: rate-limited impact/down, bomb, and arc cues.
- Rewards/progression: pickup, powerup, cache reward, combo milestone, upgrade,
  horde-warning and defeat cues, paired with banners, meters, particles, and optional
  haptics.
- Each named cue has a minimum repeat interval so dense fights cannot create
  unbounded oscillators.

## Settings and accessibility

- Music and SFX each have enabled/volume controls in save schema v3. Haptics and
  reduced motion are separate settings.
- Web Audio unlocks on the first pointer or keyboard gesture and remains a
  recoverable enhancement. There is no voice or required audio-only signal.

## Asset plan

- `src/assets/audio/scrapyard-loop.mp3` is bundled by Vite and fingerprinted.
  The supplied 173.52-second, approximately 192 kbps MP3 was re-encoded once
  with the project `music` preset to 128 kbps stereo at 44.1 kHz. Embedded
  cover art was stripped; size fell from 4.2 MB to 2.8 MB (33.4%).
- SFX remain local procedural Web Audio. Oscillators use short gain envelopes
  and stop immediately after each cue. No RUN credits or remote generation
  were used.
- The source file was supplied by the owner. Redistribution rights and any
  required music attribution must be confirmed before publishing the open
  repository.

## QA

- Automated duration/size verification passes. Remaining acceptance: first
  unlock/retry, loop-boundary audition, mute combinations, lifecycle
  interruption, sustained overlap review, and mix/haptic review on
  representative phone speakers and headphones.
