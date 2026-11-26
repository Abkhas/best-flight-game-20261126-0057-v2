// hud.js — the top HUD: altitude / speed / heading, score, objective, messages,
// warnings, gear + flaps readout. Reads the flight state every frame.

import { LIMITS } from './flight-model.js';
import { record } from './saves.js';
import { audioOn } from './audio.js';

let msgTimer = 0;
let warnText = '';

// Top-centre compass strip: ticks + cardinal labels around the live heading,
// gold marker on the nose. Drawn every frame while flying.
function drawCompass(deg) {
  const c = document.getElementById('hud-compass-c');
  if (!c) return;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 380, 26);
  g.fillStyle = 'rgba(4,12,24,0.62)'; g.fillRect(0, 0, 380, 26);
  g.strokeStyle = 'rgba(110,200,255,0.35)'; g.strokeRect(0.5, 0.5, 379, 25);
  const card = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  g.textAlign = 'center';
  for (let off = -75; off <= 75; off += 15) {
    const d = (((Math.round(deg) + off) % 360) + 360) % 360;
    const x = 190 + off * 2.4;
    const isCard = d % 45 === 0;
    g.strokeStyle = '#9fd8ff';
    g.beginPath(); g.moveTo(x, isCard ? 4 : 8); g.lineTo(x, 14); g.stroke();
    if (isCard) {
      g.font = 'bold 11px Consolas, monospace';
      g.fillStyle = d === 0 ? '#ffd27f' : '#cfe8ff';
      g.fillText(card[d], x, 24);
    } else if (off % 30 === 0) {
      g.font = '9px Consolas, monospace';
      g.fillStyle = '#7fb8e8';
      g.fillText(String(d).padStart(3, '0'), x, 24);
    }
  }
  g.fillStyle = '#ffd27f';
  g.beginPath(); g.moveTo(190, 0); g.lineTo(185, 6); g.lineTo(195, 6); g.closePath(); g.fill();
}

// The persistent slim bars (proof / title / chase): same session values as
// the full HUD, in the same night style. Called every frame while flying and
// once when a static screen is staged, so the bars never show stale numbers.
export function renderPersistentBars(s, mission, mState, camMode) {
  const hdg = ((s.heading * 180) / Math.PI % 360 + 360) % 360;
  const hdgTxt = String(Math.round(hdg)).padStart(3, '0');
  const sub = mission.id === 1 ? `GATES ${mState?.gatesPassed || 0} / 2 · RINGS ${record.ringsFlown} / 5`
    : mission.id === 2 ? `RINGS ${record.ringsFlown} / 5`
    : `BEACONS ${mState?.waypointsReached || 0} / 4`;
  document.getElementById('pbar-top-c').textContent =
    `HDG ${hdgTxt}° · ${mission.kicker} — ${mission.name} · CAM ${(camMode || 'cockpit').toUpperCase()} · SOUND ${audioOn() ? 'ON' : 'OFF'}`;
  document.getElementById('pbar-top-r').textContent = `SCORE ${record.score} · ${sub}`;
  const pitch = Math.round(s.pitch * 180 / Math.PI);
  const bank = Math.round(s.bank * 180 / Math.PI);
  document.getElementById('pbar-bot').textContent =
    `ATT ${pitch >= 0 ? '+' : ''}${pitch}° · BANK ${bank >= 0 ? '+' : ''}${bank}° · SPD ${Math.round(s.speed * 1.944)} KT · `
    + `ALT ${Math.round(s.y * 3.281)} FT · HDG ${hdgTxt} · THR ${Math.round(s.throttle * 100)}% · `
    + `FUEL ${Math.round(s.fuel)}% · SCORE ${record.score} · ${sub}`;
}

export function setMessage(text, seconds = 4) {
  const el = document.getElementById('hud-msg');
  el.textContent = text;
  msgTimer = seconds;
}

export function setWarning(text) {
  warnText = text;
  document.getElementById('hud-warn').textContent = text;
}

export function updateHUD(s, mission, targetLine, dt, mState, camMode) {
  if (msgTimer > 0) {
    msgTimer -= dt;
    if (msgTimer <= 0) document.getElementById('hud-msg').textContent = '';
  }
  document.getElementById('hud-alt-v').textContent = Math.round(s.y * 3.281).toLocaleString('en-US');
  document.getElementById('hud-spd-v').textContent = Math.round(s.speed * 1.944);
  const hdg = ((s.heading * 180) / Math.PI % 360 + 360) % 360;
  document.getElementById('hud-hdg-v').textContent = String(Math.round(hdg)).padStart(3, '0');
  document.getElementById('hud-fuel-v').textContent = Math.round(s.fuel) + '%';
  document.getElementById('hud-fuel-bar').style.width = s.fuel + '%';
  drawCompass(hdg);
  renderPersistentBars(s, mission, mState, camMode);
  document.getElementById('hud-score-v').textContent = record.score.toLocaleString('en-US');
  // Progress label matches the sortie — GATES in sortie 1, RINGS in sortie 2,
  // BEACONS in sortie 3. Sortie 1 keeps the session rings total beside the
  // gates count, so the earned rings stay visible on the cover.
  const mId = mission.id;
  document.getElementById('hud-score-sub').textContent =
    mId === 1 ? `GATES ${mState?.gatesPassed || 0} / 2 · RINGS ${record.ringsFlown} / 5`
    : mId === 2 ? `RINGS ${record.ringsFlown} / 5`
    : `BEACONS ${mState?.waypointsReached || 0} / 4`;
  document.getElementById('hud-hull-v').textContent = Math.round(100 - s.damage) + '%';
  document.getElementById('hud-hull-bar').style.width = (100 - s.damage) + '%';
  document.getElementById('hud-obj-kicker').textContent = mission.kicker;
  document.getElementById('hud-obj-name').textContent = mission.name;
  document.getElementById('hud-obj-sub').textContent = targetLine;
  document.getElementById('hud-gear').textContent =
    `GEAR ${s.gearDown ? 'DOWN' : 'UP'}   FLAPS ${s.flaps}°`.replace('0°', '0').replace('1°', '15').replace('2°', '30');

  // warnings, in priority order — STALL outranks LOW FUEL: a stall kills in
  // seconds, low fuel gives minutes. Near-stall warns before the wing quits.
  const stallSpeed = LIMITS.stallSpeed + s.flaps * -6;
  if (s.crashed) setWarning('');
  else if (s.stalled) setWarning('STALL — NOSE DOWN, THROTTLE UP');
  else if (s.speed < stallSpeed + 10) setWarning('APPROACHING STALL — THROTTLE UP');
  else if (s.fuel <= 12) setWarning('LOW FUEL — DIVERT TO THE CARRIER');
  else if (s.damage >= 60) setWarning('HULL CRITICAL — FLY HER GENTLE');
  else if (s.y < 25 && !s.onGround) setWarning('PULL UP — WATER');
  else if (warnText && !s.stalled && s.fuel > 12) setWarning('');
}

export function showHUD(on) {
  document.getElementById('hud').classList.toggle('on', on);
  document.getElementById('canopy').classList.toggle('on', on);
  document.getElementById('panel').classList.toggle('on', on);
}
