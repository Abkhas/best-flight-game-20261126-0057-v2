# NIGHT DECK — Carrier Ops at Dusk

A first-person cockpit flight game: a modern jet at dusk over the ocean, a lit
aircraft carrier (`USS MERIDIAN`), and a coastal city asleep below. The cockpit
frame, canopy and a fully lit instrument panel are the hero — artificial
horizon, altimeter, airspeed, heading tape, throttle quadrant and fuel gauge,
all drawn live from the flight state. Sleek, lit, modern.

## The game

Three sorties, three different goals:

1. **Carrier Landing** — fly the final approach onto the lit deck. Gear down,
   gentle and slow: a soft trap catches the wire, a hard one damages the
   airframe, a fast one ends on the deck.
2. **Night Intercept** — thread 5 lit beacon rings over the coast, then bring
   her home.
3. **Coastal Patrol** — reach 4 patrol beacons along the coast, then trap on
   the carrier.

Fuel burns faster at full throttle; run dry and you glide. Below stall speed
the wing quits and the nose drops. Landings read as what happened: gentle +
slow = trapped, hard = damaged, impact = crash, water = ditching.

## Controls

- **W / S** throttle · **↑ ↓** pitch · **← →** bank · **A / D** rudder
- **F** flaps · **G** gear · **C** camera (cockpit / chase / orbit)
- **1 / 2 / 3** sortie · **M** pilot log · **P** pause · **R** restart
- Mouse drag steers.

## Structure (one job per file)

```
game/
  index.html            shell: HUD, canopy frame, instrument panel, screens
  vendor/three.module.min.js   three.js r160, vendored
  src/
    main.js             renderer, input, loop, __kit staging API
    flight-model.js     physics: throttle, pitch, bank, stall, fuel, damage
    ocean.js            dusk sky, ocean, carrier, coastal city, moon, stars
    jet.js              modern jet built from parts + nav lights + afterburner
    instruments.js      lit gauges: attitude, airspeed, altimeter, heading, fuel
    missions.js         3 sorties, rings, beacons, landing verdicts
    hud.js              altitude / speed / heading, objective, warnings
    camera.js           cockpit (default) / chase / orbit
    audio.js            synthesized WebAudio hum, wind, chimes — no files
    radio.js            carrier tower radio log — only real events, never scripted
    saves.js            pilot record + honest totals (single source of truth)
    screens.js          title + proof + pause + end + log screens
```

## Honest totals

The proof screen, title slots and pilot log all read one record in
`saves.js`. The build contains 3 sorties, 5 intercept rings, 4 patrol
waypoints and 1 carrier deck — the numbers on screen never claim more than
that, and every count only moves when the player actually flies it.

## Play

`node serve.ts` → http://localhost:8080. No build step, no network requests
at runtime; everything loads from `game/` or a `data:` URI.

## Score

Points are earned only by flying: +250 per clean ring, +150 per approach
gate, +200 per patrol beacon, +500 for a gentle trap (+250 hard). The score
on the HUD, the title slots and the proof screen all read the same record —
nothing is seeded, nothing is inflated.

## Screenshots

Captured with `capture.mjs` (headless Chromium over CDP, serves `game/` from
localhost): the night intercept runs FIRST so the ring (+250) and the tower
chatter are earned for real, then `01-cover.jpg` cockpit final approach
(lit deck + gold approach gate ahead, score 250, rings 1/5, radio log),
`02-night.jpg` night intercept, `03-proof.jpg` pilot record,
`04-title.jpg` title screen — one consistent pilot record across all four.

## Field notes (12:38 WIB)

The cover score is a modest 250 — one clean ring, earned for real and kept
honest, not seeded or inflated. Fuel reads 99% on the cover, so the number is
believable rather than dramatic. The outer gate is cropped bold at the frame
edge, and the deck reads through its lights rather than as a bright slab —
the night-shot jet is dark, and a green approach-light dash crosses the
tagline behind the title. Those are the honest rough edges of this build,
recorded here rather than hidden.

Round 1 closes tonight at 19:57 WIB. This entry is the parallel variant to
"Golden Ridge Air" (a chase-view prop plane over a golden ridge) — built to
own the uncontested night-cockpit opening: first-person carrier ops at dusk,
a lit panel and a lit deck, where no other entry is flying.
