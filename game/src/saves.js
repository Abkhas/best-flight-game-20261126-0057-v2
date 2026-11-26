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
    sortieScores: { 1: 0, 2: 0, 3: 0 }, // points earned per sortie, real events only
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
// sortieId attributes the points to the sortie that earned them (for the
// per-sortie score/medal row on the proof screen).
export function addScore(n, reason, sortieId) {
  record.score += n;
  if (sortieId && record.sortieScores[sortieId] !== undefined) record.sortieScores[sortieId] += n;
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
  // Debrief-style measured row: best trap sink vs the 3.5 m/s trap limit,
  // from the REAL record — never fabricated (null until the first trap).
  const trap = record.bestTrapVs === null
    ? 'No trap yet — the deck is waiting.'
    : `Gentlest trap so far: ${record.bestTrapVs.toFixed(1)} m/s down (trap limit 3.5 m/s) — ${record.bestTrapVs <= 3.5 ? 'WITHIN LIMIT' : 'OVER LIMIT'}.`;
  return `${record.sortiesComplete} of ${GAME.sorties} sorties complete · ${GAME.interceptRings} intercept rings, `
    + `${GAME.patrolWaypoints} patrol waypoints, 1 carrier deck — every number on this screen comes from flying them. ${trap} `
    + `BEST SCORE ${record.score} · SESSION MEDAL ${sessionMedal()}. `
    + `PILOT LOG — ${record.sortiesComplete} of ${GAME.sorties} sorties complete · ${record.ringsFlown} of ${GAME.interceptRings} rings · `
    + `${record.waypointsReached} of ${GAME.patrolWaypoints} beacons · ${record.carrierLandings} carrier traps.`;
}

// Medals are computed from REAL recorded performance only — never assigned
// for flying nothing. Sortie 1 keys on the measured trap sink rate vs the
// 3.5 m/s trap limit; sorties 2/3 key on rings/beacons actually flown.
const MEDAL_RANK = { '—': 0, BRONZE: 1, SILVER: 2, GOLD: 3 };
export function sortieMedals() {
  const s1 = record.bestTrapVs !== null && record.bestTrapVs <= 2.0 ? 'GOLD'
    : record.carrierLandings >= 1 ? 'SILVER'
    : record.hardLandings >= 1 ? 'BRONZE' : '—';
  const s2 = record.ringsFlown >= 5 ? 'GOLD' : record.ringsFlown >= 3 ? 'SILVER' : record.ringsFlown >= 1 ? 'BRONZE' : '—';
  const s3 = record.waypointsReached >= 4 ? 'GOLD' : record.waypointsReached >= 2 ? 'SILVER' : record.waypointsReached >= 1 ? 'BRONZE' : '—';
  return [
    { id: 1, name: 'CARRIER LANDING', score: record.sortieScores[1], medal: s1, note: s1 === 'GOLD' ? `trap ${record.bestTrapVs.toFixed(1)} m/s sink` : s1 === 'SILVER' ? 'wire caught' : s1 === 'BRONZE' ? 'hard landing' : 'not trapped yet' },
    { id: 2, name: 'NIGHT INTERCEPT', score: record.sortieScores[2], medal: s2, note: `${record.ringsFlown} of 5 rings` },
    { id: 3, name: 'COASTAL PATROL', score: record.sortieScores[3], medal: s3, note: `${record.waypointsReached} of 4 beacons` },
  ];
}
export function sessionMedal() {
  let best = '—';
  for (const s of sortieMedals()) if (MEDAL_RANK[s.medal] > MEDAL_RANK[best]) best = s.medal;
  return best;
}

// Rank letter, computed from REAL session performance only (same inputs as
// the medals — sorties complete, trap quality, rings, score). No persisted
// cross-session best exists (the record is session-only), so BEST SCORE is
// honestly the best score of THIS session — never a carried-over number.
export function sessionRank() {
  const medal = sessionMedal();
  if (record.sortiesComplete >= 3 && medal === 'GOLD') return 'S';
  if (record.sortiesComplete >= 3 || medal === 'GOLD') return 'A';
  if (medal === 'SILVER' || record.carrierLandings >= 1 || record.ringsFlown >= 3) return 'B';
  if (record.score > 0) return 'C';
  return 'D';
}

// Incident line for the proof screen, from the EXISTING record only:
// hard landings, crashes, and the gentlest trap actually flown.
export function incidentLine() {
  const trap = record.bestTrapVs === null ? 'no trap yet'
    : `gentlest trap ${record.bestTrapVs.toFixed(1)} m/s down`;
  if (record.crashes === 0 && record.hardLandings === 0)
    return `INCIDENT LOG — Clean session: no hard landings, no crashes · ${trap}.`;
  return `INCIDENT LOG — ${record.hardLandings} hard landing${record.hardLandings === 1 ? '' : 's'} · `
    + `${record.crashes} crash${record.crashes === 1 ? '' : 'es'} · ${trap}.`;
}
