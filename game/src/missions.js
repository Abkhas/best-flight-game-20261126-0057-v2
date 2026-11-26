// missions.js — the 3 sorties. Each has a different goal, a spawn, and a
// completion rule. Counts here are the honest totals in saves.js (3 sorties,
// 5 rings, 4 waypoints) — change them here and saves.js follows by hand.

import { CARRIER, DECK_Y, overDeck } from './ocean.js';
import { record, logEvent, addScore } from './saves.js';
import { radio } from './radio.js';
import { touchdown, applyLanding } from './flight-model.js';

export const MISSIONS = [
  {
    id: 1, name: 'CARRIER LANDING', kicker: 'SORTIE 1 OF 3',
    brief: 'Land on the lit deck — gear down, gentle and slow.',
    spawn: { x: 30, y: 95, z: -430, heading: 0, speed: 72, throttle: 0.62, gearDown: true, flaps: 1 },
  },
  {
    id: 2, name: 'NIGHT INTERCEPT', kicker: 'SORTIE 2 OF 3',
    brief: 'Thread all 5 beacon rings over the coast — then bring her home.',
    spawn: { x: 380, y: 130, z: -180, heading: -0.9, speed: 95, throttle: 0.72, gearDown: false, flaps: 0 },
  },
  {
    id: 3, name: 'COASTAL PATROL', kicker: 'SORTIE 3 OF 3',
    brief: 'Reach all 4 patrol beacons, then trap on the carrier.',
    spawn: { x: 180, y: 160, z: 120, heading: -0.5, speed: 88, throttle: 0.68, gearDown: false, flaps: 0 },
  },
];

export function missionState(id) {
  return { id, ringsPassed: 0, waypointsReached: 0, gatesPassed: 0, done: false, result: null };
}

// Reset ring/beacon/gate visuals for a fresh run.
export function resetMissionVisuals(world) {
  world.rings.forEach((r) => { r.passed = false; r.mesh.visible = true; r.glow.visible = true; });
  world.beacons.forEach((b) => { b.reached = false; b.diamond.visible = true; b.pillar.visible = true; });
  world.gates.forEach((g) => { g.passed = false; g.mesh.visible = true; g.glow.visible = true; });
}

// Per-frame mission logic. Returns an event string when something happens,
// or null. `hooks` = { onTrap(verdict), onCrash(reason), onComplete(mission) }.
export function updateMission(m, s, world, hooks) {
  // --- approach gates (mission 1): gold glide-slope gates on the final ---
  if (!m.done && m.id === 1) {
    for (const g of world.gates) {
      if (g.passed) continue;
      const dx = s.x - g.x, dy = s.y - g.y, dz = s.z - g.z;
      if (dx * dx + dy * dy + dz * dz < 17 * 17) {
        g.passed = true; g.mesh.visible = false; g.glow.visible = false;
        m.gatesPassed = (m.gatesPassed || 0) + 1;
        addScore(150, 'approach gate clean');
        radio('TOWER', `GATE ${m.gatesPassed} CLEAN +150 — ON GLIDE SLOPE`);
        logEvent(`Approach gate ${m.gatesPassed} of 2 clean — +150`);
        return `GATE ${m.gatesPassed} OF 2 — CLEAN PASS +150`;
      }
    }
  }

  if (!m.done && m.id === 2) {
    for (const r of world.rings) {
      if (r.passed) continue;
      const dx = s.x - r.x, dy = s.y - r.y, dz = s.z - r.z;
      if (dx * dx + dy * dy + dz * dz < 17 * 17) {
        r.passed = true; r.mesh.visible = false; r.glow.visible = false;
        m.ringsPassed += 1; record.ringsFlown += 1;
        addScore(250, `ring ${m.ringsPassed} clean`);
        radio('TOWER', `RING ${m.ringsPassed} CLEAN +250`);
        logEvent(`Ring ${m.ringsPassed} of 5 threaded over the coast`);
        if (m.ringsPassed >= 5) {
          m.done = true; m.result = 'rings';
          record.sortiesComplete += 1;
          radio('TOWER', 'ALL RINGS CLEAN — BRING HER HOME');
          logEvent('Sortie 2 complete — all 5 rings threaded');
          hooks.onComplete?.(MISSIONS[1]);
          return 'RINGS COMPLETE — ALL 5 THREADED';
        }
        return `RING ${m.ringsPassed} OF 5 — CLEAN PASS +250`;
      }
    }
  }

  if (!m.done && m.id === 3) {
    for (const b of world.beacons) {
      if (b.reached) continue;
      const dx = s.x - b.x, dz = s.z - b.z;
      if (dx * dx + dz * dz < 55 * 55 && s.y > 40 && s.y < 320) {
        b.reached = true; b.diamond.visible = false; b.pillar.visible = false;
        m.waypointsReached += 1; record.waypointsReached += 1;
        addScore(200, `patrol beacon ${m.waypointsReached}`);
        radio('TOWER', `BEACON ${m.waypointsReached} CONFIRMED +200`);
        logEvent(`Patrol beacon ${m.waypointsReached} of 4 reached`);
        if (m.waypointsReached >= 4) {
          m.done = true; m.result = 'patrol';
          record.sortiesComplete += 1;
          logEvent('Sortie 3 complete — coast patrolled, bring her home');
          hooks.onComplete?.(MISSIONS[2]);
          return 'PATROL COMPLETE — ALL 4 BEACONS';
        }
        return `BEACON ${m.waypointsReached} OF 4 — NEXT LIGHT AHEAD`;
      }
    }
  }

  // --- ground contact: deck or water, for every mission ---
  if (s.y <= DECK_Y + 0.6 && overDeck(s.x, s.z)) {
    const verdict = touchdown(s, DECK_Y);
    const dmg = applyLanding(s, verdict);
    if (verdict === 'trap') {
      record.carrierLandings += 1;
      const sink = -s.vs;
      if (record.bestTrapVs === null || sink < record.bestTrapVs) record.bestTrapVs = sink;
      addScore(500, 'carrier trap');
      radio('TOWER', 'TRAP CONFIRMED +500 — WELCOME HOME');
      if (m.id === 1 && !m.done) {
        m.done = true; m.result = 'trap';
        record.sortiesComplete += 1;
        logEvent(`Trap on ${'USS MERIDIAN'} — ${sink.toFixed(1)} m/s down`);
      }
      hooks.onTrap?.(verdict);
      return 'TRAPPED — WIRE CAUGHT, WELCOME HOME';
    }
    if (verdict === 'hard') {
      record.hardLandings += 1;
      addScore(250, 'hard landing on deck');
      radio('TOWER', 'HARD LANDING — AIRFRAME CHECK ON DECK');
      logEvent(`Hard landing — airframe damaged ${dmg}%`);
      hooks.onTrap?.(verdict);
      return 'HARD LANDING — AIRFRAME DAMAGED';
    }
    record.crashes += 1;
    logEvent('Crash on deck — sortie over');
    hooks.onCrash?.('deck impact');
    return 'CRASH — DECK IMPACT';
  }
  if (s.y <= 0.5) {
    const verdict = touchdown(s, 0);
    applyLanding(s, verdict);
    record.crashes += 1;
    logEvent('Ditched in the ocean — sortie over');
    hooks.onCrash?.('ditching');
    return 'DITCHED — INTO THE SEA';
  }
  // out of fuel: glide ends in the water eventually; warn early instead
  return null;
}

// Next ring / beacon / gate the pilot should fly toward (for the objective line).
export function nextTarget(m, world) {
  if (m.id === 1) {
    const g = world.gates.find((g) => !g.passed);
    return g ? `Gate ${((m.gatesPassed || 0) + 1)} of 2 ahead — fly the glide slope to the deck` : 'Gates clean — land on the lit deck, gear down';
  }
  if (m.id === 2) {
    const r = world.rings.find((r) => !r.passed);
    return r ? `Next ring ${m.ringsPassed + 1} of 5 — follow the coloured lights` : 'All rings threaded';
  }
  if (m.id === 3) {
    const b = world.beacons.find((b) => !b.reached);
    return b ? `Next beacon ${m.waypointsReached + 1} of 4 — follow the light pillar` : 'All beacons reached — land on the carrier';
  }
  return 'Land on the lit deck — gear down, gentle and slow';
}
