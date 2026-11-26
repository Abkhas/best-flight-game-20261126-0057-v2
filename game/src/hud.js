// hud.js — the top HUD: altitude / speed / heading, score, objective, messages,
// warnings, gear + flaps readout. Reads the flight state every frame.

import { record } from './saves.js';

let msgTimer = 0;
let warnText = '';

export function setMessage(text, seconds = 4) {
  const el = document.getElementById('hud-msg');
  el.textContent = text;
  msgTimer = seconds;
}

export function setWarning(text) {
  warnText = text;
  document.getElementById('hud-warn').textContent = text;
}

export function updateHUD(s, mission, targetLine, dt) {
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
  document.getElementById('hud-score-v').textContent = record.score.toLocaleString('en-US');
  document.getElementById('hud-score-sub').textContent = `RINGS ${record.ringsFlown} / 5`;
  document.getElementById('hud-hull-v').textContent = Math.round(100 - s.damage) + '%';
  document.getElementById('hud-hull-bar').style.width = (100 - s.damage) + '%';
  document.getElementById('hud-obj-kicker').textContent = mission.kicker;
  document.getElementById('hud-obj-name').textContent = mission.name;
  document.getElementById('hud-obj-sub').textContent = targetLine;
  document.getElementById('hud-gear').textContent =
    `GEAR ${s.gearDown ? 'DOWN' : 'UP'}   FLAPS ${s.flaps}°`.replace('0°', '0').replace('1°', '15').replace('2°', '30');

  // warnings, in priority order
  if (s.crashed) setWarning('');
  else if (s.fuel <= 12) setWarning('LOW FUEL — DIVERT TO THE CARRIER');
  else if (s.stalled) setWarning('STALL — NOSE DOWN, THROTTLE UP');
  else if (s.damage >= 60) setWarning('HULL CRITICAL — FLY HER GENTLE');
  else if (s.y < 25 && !s.onGround) setWarning('PULL UP — WATER');
  else if (warnText && !s.stalled && s.fuel > 12) setWarning('');
}

export function showHUD(on) {
  document.getElementById('hud').classList.toggle('on', on);
  document.getElementById('canopy').classList.toggle('on', on);
  document.getElementById('panel').classList.toggle('on', on);
}
