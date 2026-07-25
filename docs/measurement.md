# SCRAP//SHIFT measurement plan

- Decision and owner: Determine whether movement, auto-fire, and the first power
  card are understood without a tutorial modal; owner reviews after playtest.
- Primary metric: Players reaching `first_upgrade_chosen` divided by
  `run_started`; no target until a trustworthy baseline exists.
- Guardrails: Pre-upgrade abandonment, runtime errors, damage-before-first-kill,
  input-mode mix, and retry rate.
- Event names/properties: `game_loaded`, `run_started`, `first_movement`,
  `tap_move_discovered`, `first_enemy_defeated`, `first_upgrade_chosen`,
  `cache_reward`, `threat_unlocked`, `player_damaged`, `run_ended`, `retry_tapped`,
  `setting_changed`; bounded run time, level, score, input mode, cache/powerup
  IDs, orientation, and reason only. Prohibit credentials, raw host errors, PII,
  and private text.
- Funnel/cohort: First-session run start → touch discovery/movement → first coin
  magnet pickup → first kill → first cache card → first upgrade → threat unlock
  → run end. Expected volume is unknown.
- Experiment: None.
- QA evidence: Local events safely no-op without a RUN host. Host delivery needs
  Playground verification after initialization; analytics never grants value.
