// flight-model.js — arcade jet physics: throttle, pitch, bank, stall, fuel, damage.
// No three.js here: pure numbers in, pure numbers out, so the model is testable
// and the renderer just draws what it says.

export const LIMITS = {
  maxSpeed: 185,      // m/s at full throttle, clean
  stallSpeed: 38,     // m/s — below this the wing quits and the nose drops
  approachSpeed: 62,  // m/s — the speed a good trap is flown at
  cruiseAlt: 400,     // m soft ceiling for the sorties
  fuelBurnFull: 0.45, // % per second at full throttle — a sortie lasts minutes
  fuelBurnIdle: 0.08, // % per second at idle
};

export function freshState() {
  return {
    // position in metres: x east, y up, z north-negative (carrier sits at -z)
    x: 30, y: 95, z: -430,
    heading: 0,        // radians, 0 = due north (-z), grows clockwise
    pitch: 0,          // radians, + = nose up
    bank: 0,           // radians, + = right wing down
    speed: 72,         // m/s
    vs: 0,             // vertical speed m/s, for the trap verdict
    throttle: 0.62,
    fuel: 100,         // %
    damage: 0,         // % hull lost
    gearDown: true,
    flaps: 0,          // 0, 1, 2
    rudder: 0,
    stalled: false,
    onGround: false,
    crashed: false,
    landed: false,
  };
}

// input: { pitch: -1..1 (stick back = +), bank: -1..1, rudder: -1..1,
//          throttleDelta: -1..1 per second, dt }
export function step(s, input, dt) {
  if (s.onGround || s.crashed) return s;

  // --- throttle ---
  s.throttle = clamp(s.throttle + input.throttleDelta * dt * 0.55, 0, 1);

  // --- fuel: full throttle drinks, idle sips ---
  const burn = LIMITS.fuelBurnIdle + (LIMITS.fuelBurnFull - LIMITS.fuelBurnIdle) * s.throttle;
  s.fuel = Math.max(0, s.fuel - burn * dt);
  // Flameout is REAL now: fuel-out cuts the throttle to a 0.12 glide setting
  // (was Math.max(throttle, 0.12) — a no-op that never lowered anything).
  // At 0.12 the idle target speed (~70 m/s clean) stays well above stall,
  // so the "FLAMEOUT — GLIDING" message is true and the glide is flyable.
  if (s.fuel <= 0) s.throttle = 0.12;

  // --- speed chases the throttle, flaps and gear add drag ---
  const drag = 1 + s.flaps * 0.18 + (s.gearDown ? 0.12 : 0);
  // Idle target speed (~55 m/s clean, ~42 m/s dirty) sits ABOVE the stall
  // speed (38 clean, 32 flaps 15) — sustained LEVEL idle flight no longer
  // guarantees a stall. Was 28 + throttle * 157: idle target 28 m/s.
  // Climbing trades speed for height (and diving gains it), so the stall
  // stays reachable — and recoverable — the honest way: haul the nose up
  // at idle and the wing still quits; nose down + throttle up recovers.
  let target = (55 + s.throttle * (LIMITS.maxSpeed - 55)) / drag;
  target -= Math.sin(s.pitch) * 45;
  target = Math.max(20, target);
  const accel = s.speed < target ? 14 : 22; // spool up slower than it slows down
  s.speed += clamp(target - s.speed, -accel * dt, accel * dt);

  // --- stall: softer than before — slower nose-drop, gentler sink, so a
  // pilot who hears the warning has seconds to recover, not a cliff edge ---
  const stallSpeed = LIMITS.stallSpeed + s.flaps * -6; // flaps buy a little margin
  s.stalled = s.speed < stallSpeed;
  if (s.stalled) s.pitch -= 0.18 * dt; // nose drops on its own (was 0.35)

  // --- attitude from the stick: stronger authority, slower auto-centre, so
  // a held or tapped input produces a visible, lasting attitude change ---
  const pitchRate = 0.85 * (1 - Math.min(0.5, s.speed / LIMITS.maxSpeed));
  s.pitch = clamp(s.pitch + input.pitch * pitchRate * dt, -0.42, 0.5);
  s.pitch *= Math.pow(0.65, dt); // stick centres itself, slowly (was 0.4^dt)
  const bankRate = 2.0;
  s.bank = clamp(s.bank + input.bank * bankRate * dt, -1.1, 1.1);
  s.bank *= Math.pow(0.75, dt); // was 0.55^dt — attitude persists after release
  s.heading += -Math.sin(s.bank) * (s.speed / 160) * dt * 1.9; // bank turns the jet
  s.heading += input.rudder * 0.18 * dt; // rudder fine-tunes the nose (was 0.12)

  // --- motion ---
  const climb = Math.sin(s.pitch) * s.speed - (s.stalled ? 8 : 0) - (s.speed < 30 ? 2 : 0);
  s.vs = climb;
  s.y += climb * dt;
  const hdg = s.heading;
  s.x += Math.sin(hdg) * Math.cos(s.pitch) * s.speed * dt;
  s.z -= Math.cos(hdg) * Math.cos(s.pitch) * s.speed * dt;

  // soft ceiling: the air gets thin and the jet mushes back down
  if (s.y > LIMITS.cruiseAlt) { s.y = LIMITS.cruiseAlt; s.pitch = Math.min(s.pitch, 0); }
  // keep the jet inside the operating area (a 3.4 km box around the carrier)
  s.x = clamp(s.x, -1700, 1700);
  s.z = clamp(s.z, -2600, 900);
  if (s.y < 0) s.y = 0;
  return s;
}

// Touchdown verdict. Called when the jet reaches deck/water height.
// Returns 'trap' | 'hard' | 'crash' | 'ditch'.
export function touchdown(s, surfaceY) {
  const sink = -s.vs; // positive = descending
  s.onGround = true;
  if (surfaceY <= 0.5) return 'ditch'; // water
  if (!s.gearDown) return 'crash';     // belly landing on the deck
  if (sink <= 3.5 && s.speed <= 78) return 'trap';
  if (sink <= 7 && s.speed <= 95) return 'hard';
  return 'crash';
}

export function applyLanding(s, verdict) {
  if (verdict === 'trap') { s.landed = true; return 0; }
  if (verdict === 'hard') { s.damage = Math.min(100, s.damage + 34); s.landed = true; return 34; }
  s.damage = 100; s.crashed = true; return 100;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
