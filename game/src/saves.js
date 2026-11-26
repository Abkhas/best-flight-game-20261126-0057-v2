// saves.js — the pilot record. SINGLE SOURCE OF TRUTH for every number the
// HUD, proof screen, title slots and log show. Totals here are HONEST: they
// count only what this build actually contains (3 sorties, 5 intercept rings,
// 4 patrol waypoints, 1 carrier deck). Never inflate them.

export const GAME = {
  title: 'NIGHT DECK',
  subtitle: 'CARRIER OPS AT DUSK',
  carrier: 'USS MERIDIAN',
  callsign: 'NIGHTHAWK-1',
  sorties: 3,          // missions.js defines exactly 3
  interceptRings: 5,   // mission 2 has exactly 5 rings
  patrolWaypoints: 4,  // mission 3 has exactly 4 waypoints
  decks: 1,            // one carrier deck
};

// Three pilot slots on the title screen. All three fly the same record;
// the slot is the pilot's seat, not a separate save file.
export const SLOTS = [
  { id: 1, callsign: 'NIGHTHAWK-1', seat: 'LEAD · CAT 1', note: 'Deck-qualified' },
  { id: 2, callsign: 'NIGHTHAWK-2', seat: 'WING · CAT 2', note: 'Ring runner' },
  { id: 3, callsign: 'NIGHTHAWK-3', seat: 'SPARE · CAT 3', note: 'Coast patrol' },
];

// The record. Everything starts at zero and only moves when the player
// actually does it in the game.
export function freshRecord() {
  return {
    callsign: GAME.callsign,
    slot: 1,
    score: 0,            // earned points, session total — only moves on real events
    sortiesFlown: 0,       // sorties started
    sortiesComplete: 0,    // sorties finished (landed / all rings / all waypoints)
    carrierLandings: 0,    // gentle traps on the deck
    hardLandings: 0,       // landed but damaged the airframe
    crashes: 0,            // impacts that ended the sortie
    ringsFlown: 0,         // intercept rings threaded (of 5 per run)
    waypointsReached: 0,   // patrol waypoints reached (of 4 per run)
    flightMinutes: 0,      // whole minutes actually flown
    flightSeconds: 0,      // leftover seconds, for the display
    bestTrapVs: null,      // gentlest touchdown vertical speed (m/s), null until first trap
    log: [],               // pilot log lines, newest last
  };
}

export const record = freshRecord();

export function logEvent(text) {
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  record.log.push({ t: stamp, text });
  if (record.log.length > 24) record.log.shift();
}

// Points are only ever added by real game events (ring, gate, beacon, trap).
export function addScore(n, reason) {
  record.score += n;
  logEvent(`+${n} — ${reason}`);
  return record.score;
}

export function addFlightTime(dtSeconds) {
  record.flightSeconds += dtSeconds;
  while (record.flightSeconds >= 60) {
    record.flightSeconds -= 60;
    record.flightMinutes += 1;
  }
}

export function flightTimeText() {
  const s = Math.floor(record.flightSeconds);
  return `${record.flightMinutes}:${String(s).padStart(2, '0')}`;
}

// Proof-screen cells. Built from the record + the honest build totals, so
// the proof screen can never claim more than the game contains.
export function proofCells() {
  return [
    { lab: 'SCORE', val: String(record.score), sub: 'earned in this session' },
    { lab: 'CARRIER TRAPS', val: String(record.carrierLandings), sub: `on ${GAME.carrier} · ${GAME.decks} deck` },
    { lab: 'RINGS THREADED', val: String(record.ringsFlown), sub: `${GAME.interceptRings} rings in Sortie 2` },
    { lab: 'WAYPOINTS', val: String(record.waypointsReached), sub: `${GAME.patrolWaypoints} beacons in Sortie 3` },
    { lab: 'FLIGHT TIME', val: flightTimeText(), sub: 'minutes actually flown' },
    { lab: 'HARD LANDINGS / CRASHES', val: `${record.hardLandings} / ${record.crashes}`, sub: 'the deck keeps score' },
  ];
}

export function proofNote() {
  const trap = record.bestTrapVs === null
    ? 'No trap yet — the deck is waiting.'
    : `Gentlest trap so far: ${record.bestTrapVs.toFixed(1)} m/s down.`;
  return `${record.sortiesComplete} of ${GAME.sorties} sorties complete · ${GAME.interceptRings} intercept rings, `
    + `${GAME.patrolWaypoints} patrol waypoints, 1 carrier deck — every number on this screen comes from flying them. ${trap}`;
}
