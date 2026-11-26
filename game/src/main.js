// main.js — renderer, input, game loop, screen state, and the window.__kit
// staging API the screenshot harness drives. No network, no build step.

import * as THREE from 'three';
import { buildWorld, DECK_Y } from './ocean.js';
import { buildJet, poseJet, animateJet } from './jet.js';
import { freshState, step, LIMITS } from './flight-model.js';
import { MISSIONS, missionState, resetMissionVisuals, updateMission, nextTarget, nextTargetPos } from './missions.js';
import { drawAll } from './instruments.js';
import { updateHUD, setMessage, showHUD, renderPersistentBars } from './hud.js';
import { makeCamera, updateCamera, CAM_MODES } from './camera.js';
import { ensureAudio, updateAudio, chime, thud, stallWarn } from './audio.js';
import { record, logEvent, addFlightTime, GAME } from './saves.js';
import { radio } from './radio.js';
import { showTitle, showProof, showPause, showEnd, showLog, hideScreens } from './screens.js';

// --- renderer / scene ------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = makeCamera();
const world = buildWorld(scene);
const jet = buildJet();
scene.add(jet);

let flight = freshState();
let missionId = 1;
let mission = missionState(1);
let camMode = 'cockpit';
let camIndex = 0;
let prevCamMode = '';
let screen = 'title'; // title | flying | paused | ended | proof | log
let frozen = false; // capture harness freezes physics after the cover shot
let frames = 0;
let lastT = performance.now();
let msgShown = false;
let wasStalled = false; // stall-entry edge: radio + audio fire once per stall

// --- mission control -------------------------------------------------------
function beginMission(id, count = true) {
  const def = MISSIONS[id - 1];
  missionId = id;
  mission = missionState(id);
  flight = freshState();
  Object.assign(flight, def.spawn);
  flight.pitch = 0; flight.bank = 0; flight.vs = 0;
  flight.fuel = 100; flight.damage = 0;
  resetMissionVisuals(world);
  // Camera resets every sortie: a sortie always starts in the cockpit,
  // never inherits a chase/orbit view left over from a previous run.
  camMode = 'cockpit'; camIndex = 0;
  wasStalled = false;
  if (count) {
    record.sortiesFlown += 1;
    logEvent(`Sortie ${id} started — ${def.name}`);
    if (id === 1) {
      radio('VOSS', 'CLEARED TO LAND — WIND 12 KT');
      radio('VOSS', 'FLY THE GATES, THEN TRAP THE WIRE');
    } else if (id === 2) {
      radio('VOSS', 'NIGHTHAWK-1, CLEARED FOR INTERCEPT');
      radio('VOSS', 'THREAD ALL 5 RINGS, THEN COME HOME');
    } else {
      radio('VOSS', 'NIGHTHAWK-1, PATROL THE COAST');
      radio('VOSS', '4 BEACONS, THEN TRAP ON THE DECK');
    }
  }
  setMessage(def.name + ' — ' + def.brief, 5);
  hideScreens();
  showHUD(true);
  applyCamVisibility();
  screen = 'flying';
  msgShown = false;
}

function parkOnDeck() {
  // Title backdrop: the jet sits on the carrier deck at dusk.
  flight = freshState();
  flight.x = 0; flight.y = DECK_Y + 1.2; flight.z = -700;
  flight.heading = 0.35; flight.speed = 0; flight.throttle = 0;
  flight.onGround = true;
  poseJet(jet, flight);
}

function applyCamVisibility() {
  const cockpit = camMode === 'cockpit';
  document.getElementById('canopy').classList.toggle('on', cockpit && screen === 'flying');
  document.getElementById('panel').classList.toggle('on', cockpit && screen === 'flying');
  document.getElementById('reticle').style.display = cockpit && screen === 'flying' ? 'block' : 'none';
  layoutPersistentBars();
}

// Persistent slim bars: the top compass bar shows on the proof + title
// screens (where the full HUD is hidden); the bottom gauge bar shows there
// too, and in chase view while flying (where the big cockpit panel hides).
// In cockpit flight the panel itself is the bottom bar, so the slim one stays off.
function layoutPersistentBars() {
  const top = document.getElementById('pbar-top');
  const bot = document.getElementById('pbar-bottom');
  const staticScreen = screen === 'proof' || screen === 'title';
  top.style.display = staticScreen ? 'flex' : 'none';
  bot.style.display = (staticScreen || (screen === 'flying' && camMode !== 'cockpit')) ? 'flex' : 'none';
}

function endSortie(title, text) {
  showHUD(false);
  showEnd(title, text);
  screen = 'ended';
}

const hooks = {
  onTrap: (verdict) => {
    thud();
    if (verdict === 'trap') {
      chime(1046);
      endSortie('TRAPPED!', `Wire caught on ${GAME.carrier}. Gentle, slow, gear down — exactly how the deck likes it. `
        + `Sortie ${missionId} complete. Press R to fly again, or 1 / 2 / 3 for another sortie.`);
    } else {
      radio('VOSS', 'DAMAGE REPORT ON DECK — STAND BY');
      endSortie('HARD LANDING', 'You made the deck, but the airframe took damage. '
        + 'Slower next time, and watch the sink rate. Press R to fly again.');
    }
  },
  onCrash: (reason) => {
    thud();
    radio('VOSS', 'MAYDAY — RESCUE LAUNCHED');
    endSortie('SORTIE LOST', reason === 'ditching'
      ? 'Into the sea. The ocean keeps what it catches — press R to fly again.'
      : 'Deck impact. The jet is done — press R to fly again.');
  },
  onComplete: (def) => {
    chime(1318);
    setMessage(def.name + ' COMPLETE', 5);
  },
};

// --- input -----------------------------------------------------------------
const keys = {};
let drag = null; // {x, y, dx, dy} mouse-drag steering

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  ensureAudio();
  const code = e.code;
  if (code === 'KeyC' && screen === 'flying') {
    camIndex = (camIndex + 1) % CAM_MODES.length;
    camMode = CAM_MODES[camIndex];
    applyCamVisibility();
    setMessage('CAMERA — ' + camMode.toUpperCase(), 2);
  }
  if (code === 'KeyG' && screen === 'flying') {
    flight.gearDown = !flight.gearDown;
    setMessage(flight.gearDown ? 'GEAR DOWN' : 'GEAR UP', 2);
  }
  if (code === 'KeyF' && screen === 'flying') {
    flight.flaps = (flight.flaps + 1) % 3;
    setMessage('FLAPS ' + (flight.flaps === 0 ? 'UP' : flight.flaps === 1 ? '15°' : '30°'), 2);
  }
  if (code === 'KeyP') {
    if (screen === 'flying') { screen = 'paused'; showPause(); }
    else if (screen === 'paused') { screen = 'flying'; hideScreens(); }
  }
  if (code === 'KeyR' && (screen === 'flying' || screen === 'ended' || screen === 'paused')) beginMission(missionId);
  if (code === 'KeyM') {
    if (screen === 'flying') { screen = 'log'; showLog(); }
    else if (screen === 'log') { screen = 'flying'; hideScreens(); }
    else if (screen === 'paused') { screen = 'log'; showLog(); }
  }
  if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
    if (screen !== 'title') beginMission(Number(code.slice(-1)));
  }
  if (code === 'Enter' && screen === 'title') beginMission(missionId);
  if (code === 'Escape' && screen === 'log') { screen = 'flying'; hideScreens(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; ensureAudio(); });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y;
});
window.addEventListener('pointerup', () => { drag = null; });

document.getElementById('btn-fly').addEventListener('click', () => { ensureAudio(); beginMission(missionId); });
document.getElementById('btn-resume').addEventListener('click', () => { screen = 'flying'; hideScreens(); });
document.getElementById('btn-again').addEventListener('click', () => beginMission(missionId));
document.getElementById('btn-proof-back').addEventListener('click', () => {
  if (screen === 'proof') { screen = 'flying'; hideScreens(); showHUD(true); }
});
document.getElementById('btn-log-back').addEventListener('click', () => { screen = 'flying'; hideScreens(); });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- main loop -------------------------------------------------------------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0.016);
  lastT = now;
  frames += 1;
  const t = now / 1000;
  world.tick(t);

  if (screen === 'flying' && !frozen) {
    const pitchIn = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)
      + (drag ? -drag.dy / 120 : 0);
    const rudderIn = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    // A/D is a coordinated turn now: rudder plus a half-bank, so WASD
    // steering visibly rolls the jet instead of doing almost nothing.
    const bankIn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)
      + (drag ? drag.dx / 120 : 0) + rudderIn * 0.5;
    const thrIn = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    step(flight, {
      pitch: Math.max(-1, Math.min(1, pitchIn)),
      bank: Math.max(-1, Math.min(1, bankIn)),
      rudder: rudderIn,
      throttleDelta: thrIn,
    }, dt);
    // Stall ENTRY (edge, not every frame): tower radio call + audio cue.
    if (flight.stalled && !wasStalled) {
      radio('VOSS', "NIGHTHAWK-1, YOU'RE STALLING — THROTTLE UP");
      stallWarn();
    }
    wasStalled = flight.stalled;
    // The next target gets the pulsing marker + light beam (ocean.js).
    world.markNext?.(nextTargetPos(mission, world), flight);
    addFlightTime(dt);
    const event = updateMission(mission, flight, world, hooks);
    if (event) { setMessage(event, 4); if (/RING|BEACON/.test(event)) chime(988); }
    updateHUD(flight, MISSIONS[missionId - 1], nextTarget(mission, world, flight), dt, mission, camMode);
    drawAll(flight);
    updateAudio(flight.throttle, flight.speed);
    if (flight.fuel <= 0 && !msgShown) { msgShown = true; setMessage('FLAMEOUT — GLIDING, FIND THE DECK', 5); }
  }

  poseJet(jet, flight);
  animateJet(jet, flight.throttle, t);
  const camForView = screen === 'title' ? 'orbit' : camMode;
  const snapCam = camForView !== prevCamMode;
  prevCamMode = camForView;
  updateCamera(camera, flight, camForView, t, snapCam);
  renderer.render(scene, camera);
}

// --- public handles for the capture harness + debugging --------------------
window.__game = {
  get frames() { return frames; },
  get screen() { return screen; },
  get missionId() { return missionId; },
  get camMode() { return camMode; },
  get save() { return record; },
  get flight() { return flight; },
  get mission() { return mission; },
  jet, world, camera,
};

window.__kit = {
  // Freeze physics (rendering continues) so the record can't move between
  // the cover shutter and the proof screen — one consistent state, all 4 shots.
  freeze() { frozen = true; },
  unfreeze() { frozen = false; },
  // Project a world point into screen space: {x, y (px), visible} — used by
  // the capture harness to prove the deck + gate are actually in frame.
  inFrame(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return {
      x: Math.round((v.x + 1) / 2 * window.innerWidth),
      y: Math.round((1 - v.y) / 2 * window.innerHeight),
      visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
    };
  },
  // Shot 1 — cover: cockpit view on final approach to the lit carrier.
  stageCover() {
    beginMission(1);
    flight.x = 0; flight.y = 55; flight.z = -540;
    flight.heading = 0; flight.speed = 62; flight.throttle = 0.55;
    flight.gearDown = true; flight.flaps = 1;
    camMode = 'cockpit'; camIndex = 0; applyCamVisibility();
    setMessage('FINAL APPROACH — CALL THE BALL', 6);
  },
  // Shot 2 — night intercept: chase view threading the lit rings over the coast.
  stageNight() {
    beginMission(2);
    flight.x = 380; flight.y = 130; flight.z = -180;
    flight.heading = 0.56; flight.speed = 95; flight.throttle = 0.72;
    flight.gearDown = false; flight.flaps = 0;
    camMode = 'chase'; camIndex = 1; applyCamVisibility();
    setMessage('INTERCEPT — THREAD THE RINGS', 6);
  },
  // Shot 3 — proof screen.
  stageProof() {
    screen = 'proof'; showHUD(false);
    renderPersistentBars(flight, MISSIONS[missionId - 1], mission, camMode);
    layoutPersistentBars(); showProof();
  },
  // Shot 4 — title screen with the 3 slots.
  stageTitle() {
    parkOnDeck(); missionId = 1; screen = 'title'; showHUD(false);
    renderPersistentBars(flight, MISSIONS[0], missionState(1), camMode);
    layoutPersistentBars(); showTitle();
  },
};

// --- boot ------------------------------------------------------------------
parkOnDeck();
showTitle();
requestAnimationFrame(loop);
