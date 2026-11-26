// flight-model.js — arcade jet physics: throttle, pitch, bank, stall, fuel, damage.
// No three.js here: pure numbers in, pure numbers out, so the model is testable
// and the renderer just draws what it says.

export const LIMITS = {
  maxSpeed: 185,      // m/s at full throttle, clean
  stallSpeed: 46,     // m/s — below this the wing quits and the nose drops
  approachSpeed: 62,  // m/s — the speed a good trap is flown at
  cruiseAlt: 400,     // m soft ceiling for the sorties
  fuelBurnFull: 1.6,  // % per second at full throttle — fuel is a real decision
  fuelBurnIdle: 0.35, // % per second at idle
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
  if (s.fuel <= 0) s.throttle = Math.max(s.throttle, 0.12); // flameout glide

  // --- speed chases the throttle, flaps and gear add drag ---
  const drag = 1 + s.flaps * 0.18 + (s.gearDown ? 0.12 : 0);
  const target = (28 + s.throttle * (LIMITS.maxSpeed - 28)) / drag;
  const accel = s.speed < target ? 14 : 22; // spool up slower than it slows down
  s.speed += clamp(target - s.speed, -accel * dt, accel * dt);

  // --- stall ---
  const stallSpeed = LIMITS.stallSpeed + s.flaps * -6; // flaps buy a little margin
  s.stalled = s.speed < stallSpeed;
  if (s.stalled) s.pitch -= 0.35 * dt; // nose drops on its own

  // --- attitude from the stick ---
  const pitchRate = 0.55 * (1 - Math.min(0.5, s.speed / LIMITS.maxSpeed));
  s.pitch = clamp(s.pitch + input.pitch * pitchRate * dt, -0.42, 0.5);
  s.pitch *= Math.pow(0.4, dt); // stick centres itself; hold to hold attitude
  const bankRate = 1.5;
  s.bank = clamp(s.bank + input.bank * bankRate * dt, -1.1, 1.1);
  s.bank *= Math.pow(0.55, dt);
  s.heading += -Math.sin(s.bank) * (s.speed / 160) * dt * 1.9; // bank turns the jet
  s.heading += input.rudder * 0.12 * dt; // rudder fine-tunes the nose

  // --- motion ---
  const climb = Math.sin(s.pitch) * s.speed - (s.stalled ? 14 : 0) - (s.speed < 55 ? 3 : 0);
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
