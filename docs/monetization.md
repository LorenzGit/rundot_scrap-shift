# Day-zero monetization brief

This is the final monetization design target for SCRAP//SHIFT. The player sees
complete, normally discoverable offers in the Outfitter and Settings, not a
platform-status dashboard. Prices are explicit server-catalog hypotheses,
ownership comes only from RUN Shop/Entitlements, rewarded value is granted only
after host-confirmed completion, and mandatory ads fire only on documented
post-results navigation transitions. The public configuration carries the
final catalog and disables the hidden private-host diagnostic bay.

## Product context

- Game / version: SCRAP//SHIFT source and visible v0.10.4 public-release candidate
- Audience and content rating: Arcade players 10+; stylized machine destruction
- Core loop and typical session: Three-minute arena-survival runs with immediate
  retries and build-defining upgrade cards
- Progression/value moment: Complete one run and encounter the Blade Carousel
- Model: hybrid
- Why this model fits: Short runs create a clean results-screen break, while the
  distinctive pilot and eight Blade Carousel silhouettes support cosmetic
  products without selling combat strength.

## Player promise

- Non-payer promise: Every weapon, enemy, upgrade, run, and standard record is
  available without purchases or rewarded ads.
- Money may personalize/expand: Pilot palettes, sword skin sets, arena
  colorways, and permanent removal of results-screen interstitials.
- Money must never buy: Weapon levels, damage, health, enemy suppression,
  standard-record eligibility, hidden power, or randomized advantage.
- Randomized paid rewards and odds disclosure: None. No paid loot boxes.
- Rewarded-results integrity: A confirmed results ad grants an additional 50%
  of that run's earned salvage to the meta wallet. It never changes run score,
  combat power, or standard records, and each persisted run ID can claim once.

## Unlock and exposure policy

- First monetization-eligible progression point: After one completed run that
  reaches character level 2; the founder bundle requires two completed runs.
- First-session policy: No ads or purchase offers.
- Decline cooldown: Do not repeat a declined purchase offer in the same session;
  wait at least three completed sessions before resurfacing it.
- Purchase/ad stacking exclusions: Never show an interstitial after a rewarded
  ad, purchase, cancellation, or error. Never place monetization over active
  movement, combat, an upgrade choice, or the results reward count-up.
- Subscriber/no-ads policy: `no_interstitials` removes every automatic
  interstitial across devices. Optional rewarded ads remain available because
  they are player-requested value exchanges.
- Desktop/no-ad fallback: Hide the placement. Never substitute an RB charge or
  grant a reward without host-confirmed completion.
- Eligibility: All ad surfaces remain subject to current RUN host readiness,
  age/privacy eligibility, platform policy, and fail-closed LiveOps switches.

## Economy

| Currency/value | Free sources | Paid sources | Sinks | Balance/inflation guardrail |
| --- | --- | --- | --- | --- |
| Run energy | Defeated enemies | None | Automatic level thresholds | Resets each run |
| Scrap / score | Combat and pickups | None | Score and lifetime records | Never sold |
| Salvage wallet | Completed runs and Daily Drops | None | Future earnable cosmetics | Never sold; duplicate daily skins convert to fixed salvage |
| Standard records | Normal play | None | Persistent mastery goals | Ads never modify run records |
| Cosmetics | Daily day 3 and day 7 | Durable Shop products | Equip/collect only | No stat modifiers |
| Results salvage bonus | One confirmed rewarded ad | None | Cosmetic salvage wallet | +50% of earned run salvage; once/run; 2/session; 3/day |

No premium currency is proposed for the first monetized slice. That avoids
selling a currency before the game has enough durable sinks.

## Placements

| Stable ID | Type | Exact trigger | Unlock | Cooldown and caps | Exclusions and fallback |
| --- | --- | --- | --- | --- | --- |
| `rewarded_results_salvage` | Rewarded | Display the offer after the complete results tally; request the video only when the player taps `WATCH VIDEO · +N SALVAGE` | One prior completed run reaching level 2; current run result unclaimed | 180 s; once/run; 2/session; 3/day | Hide on no-fill/unsupported host; cancellation/error grants nothing; never followed by an interstitial on this result |
| `interstitial_results_break` | Interstitial | After the complete results tally, when an eligible player taps `RUN IT BACK` or `MAIN MENU`; request the ad before performing that chosen navigation | At least two prior completed runs; only every third eligible completed run; never first session | 600 s minimum; 1/session; 3/day | Suppress after rewarded-ad interaction, purchase/checkout, cancellation/error, or active no-ads entitlement; no-fill/error continues navigation immediately |

The final strategy deliberately includes no banner ads, launch/session-start
ads, pause-menu ads, upgrade-card ads, mid-run ads, or ads that automatically
cover a results tally. Both placements remain fail-closed and remotely
controllable. The rewarded placement is always opt-in. The interstitial is the
only mandatory format and can occur only after explicit post-results navigation.

## Ad-removal contract

`no_interstitials` means one-time, permanent removal of every mandatory ad in
this game across devices. It suppresses `interstitial_results_break` before any
ad SDK call. Optional rewarded videos remain available because the player
requests them for a clearly stated reward; purchase copy must say this directly.
The offer appears as a permanent `AD-FREE FOREVER` card in both Outfitter and
Settings after the player becomes interstitial-eligible. Ownership replaces the
buy action with `OWNED · AUTOMATIC ADS OFF`.

## Products

| Stable ID | Final RB price | Entitlements/value | Eligibility and purchase location | Unique/renewing | Reconciliation |
| --- | ---: | --- | --- | --- | --- |
| `blade_skin_foundry` | 199 RB | Foundry Gold and Void Chrome pilot/blade palettes; visual only | After one completed run reaching level 2; two linked cards in Outfitter, each clearly states that one purchase unlocks both | Unique durable | Shop order + `scrap_shift_blade_skin_foundry` entitlement |
| `no_interstitials` | 299 RB | Permanent removal of all mandatory interstitials; optional rewarded videos remain | After interstitial eligibility; `AD-FREE FOREVER` card in Outfitter and Settings | Unique durable | Shop order + `scrap_shift_no_interstitials` entitlement |
| `founder_bundle` | 399 RB | Ad-Free Forever, Foundry Gold, Void Chrome, and exclusive First Shifter palette | After two completed runs reaching level 2; featured Outfitter card | Unique bundle | Reconcile `scrap_shift_no_interstitials`, `scrap_shift_blade_skin_foundry`, and `scrap_shift_pilot_skin_founder` |

These are final launch hypotheses, not immutable facts. They are stored only in
the RUN Shop configuration and rendered from the resolved catalog. The 399 RB
founder bundle is a coherent lower-cost alternative to
the 498 RB standalone total and adds one exclusive cosmetic without selling
power.

### Pricing evidence and review

- Recorded: 2026-07-24.
- RUN workspace guidance places small one-time purchases in the 99–499 RB range,
  simple cosmetic recolors in the 100–500 RB range, and casual permanent
  ad-removal in the 299–499 RB range.
- The current US App Store lists the comparable
  [Brotato: Premium](https://apps.apple.com/us/app/brotato-premium/id1668755109)
  at $4.99; the complete 399 RB founder offer stays below that full-game anchor
  while the 199/299 RB products remain low-friction choices.
- [Vampire Survivors mobile](https://apps.apple.com/us/app/vampire-survivors/id6444525702)
  demonstrates a player-friendly contextual rewarded pattern at
  failure/results rather than mandatory mid-run interruption; this strategy
  retains the results reward while limiting forced ads to capped post-results
  navigation.
- Review after at least 500 eligible views per product and 30 days of exposure.
  Change a price or disable a placement on material retention harm, refund
  spikes, ownership mismatch, or sustained non-cancellation failures. Do not
  claim any price “optimal” before that evidence exists.

## Architecture decision

- Architecture: RUN Shop + Entitlements.
- Reason and accepted tradeoffs: Durable cosmetics and no-interstitial ownership
  need authoritative idempotent orders, cross-device restore, refunds, and
  revocation. Low-level RB deduction is rejected for this production path.
- Idempotency strategy: Persist one pending intent before checkout and reuse its
  idempotency key until order-history reconciliation resolves it.
- Ownership/refund/cross-device source of truth: RUN Shop order history and
  Entitlements, never analytics or local booleans.
- Pending purchase persistence and resume behavior: The v5 save writes
  `pendingPurchaseIntent` before checkout, reuses its idempotency key for the
  same unresolved logical purchase, and reconciles order history on boot.

## Telemetry and KPIs

- Primary outcomes: Rewarded completion rate, game payer conversion, and
  monetization revenue per DAU.
- Driver metrics: Offer-view to purchase, ad-offer to completion, time to first
  game purchase, and ads per eligible active player.
- Guardrails: D1/D7 retention versus an eligible holdout, post-exposure
  abandonment, completed runs/session, refund/revocation rate, duplicate-grant
  rate, and purchase/ad errors.
- Economy/fairness guardrail: Zero paid combat power and zero ad modification
  of standard records.
- Experiment dimensions: Placement, platform, version, completed-run band,
  payer/no-ads state, and exposure holdout.
- Cadence/owner: Daily reliability and pressure review; weekly cohort and
  conversion review by the game owner. Do not expand exposure from revenue alone.

Use the existing stable events:
`monetization_surface_viewed`, `offer_viewed`, `purchase_tapped`,
`checkout_started`, `checkout_result`, `entitlement_synced`,
`ad_offer_viewed`, `ad_requested`, `ad_result`, and `reward_granted`.

## LiveOps and rollback

- Global kill switch: `monetization.enabled`, default false.
- Category switches: `purchasesEnabled`, `rewardedAdsEnabled`, and
  `interstitialAdsEnabled`, all default false.
- Placement/product switches: One explicit flag per stable ID, all default false.
- Safe defaults: Missing or malformed configuration hides every surface and
  leaves the free loop unchanged.
- Rollback threshold: Disable the affected category on any duplicate grant or
  ownership mismatch; also roll back on material retention/abandonment harm or
  sustained non-cancellation error spikes.
- Interstitial-specific rollback: disable on any mid-run/first-session firing,
  any no-ads entitlement breach, any stacking after rewarded/purchase activity,
  or a five-percentage-point or greater D1 retention decline in an eligible
  exposed cohort versus holdout.
- Responsible owner: Game owner until a named LiveOps operator is assigned.

## Verification authority

- Local tests: Plan validation, placement/product registry validation, doubled
  leveling thresholds, cap and eligibility state machines, duplicate-claim
  suppression, fail-closed LiveOps parsing, and unavailable/cancelled outcomes.
- Playground tests: Ad readiness/completion/no-fill, Shop catalog validation,
  checkout cancel/success/timeout, pending-intent reconciliation, entitlements,
  cross-device restore, and refund/revocation.
- Approved host-test environment: RUN Playground or a separately configured
  private/review tag in the RUN mobile host.
- Explicit purchase/credit budget: the exact final live price selected by an
  approved tester and confirmed in RUN checkout. Deployment does not initiate
  a purchase or ad.
- Attached public configuration: Shop, rewarded ads, interstitial ads, and all
  three products are enabled; private diagnostics are disabled.
- Live dependencies still unverified: transaction success on a chosen account,
  ad inventory/completion on an eligible device, cross-device restore, and
  refund/revocation behavior.

## Current implementation boundary

The typed plan, two placement definitions, three product/entitlement contracts,
live-price catalog rendering, normal Outfitter and Settings checkout surfaces,
entitlement restore, persisted purchase coordinator, rewarded-results grant
path, v5 ad counters, authoritative no-ads suppression, exact post-results
interstitial gating, and fail-closed LiveOps parser are implemented. The hidden
`MONETIZATION TEST BAY` implementation exposes capability, catalog,
entitlement, rewarded-fill, and interstitial-fill diagnostics only when
`privateTestMode` is remotely enabled on a non-public QA configuration. The
public LiveOps source sets that flag to `false`. When deliberately enabled for
private QA, value is granted only after the RUN host confirms success.
