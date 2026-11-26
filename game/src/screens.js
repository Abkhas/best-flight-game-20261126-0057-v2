// screens.js — title, proof, pause, end and log screens. All numbers come
// from saves.js (the single source of truth), so the title slots and the
// proof screen can never disagree.

import { record, proofCells, proofNote, SLOTS, GAME, sortieMedals, sessionMedal, sessionRank, incidentLine } from './saves.js';

const $ = (id) => document.getElementById(id);

function show(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.remove('on');
  if (id) $(id).classList.add('on');
}

export function renderSlots() {
  const wrap = $('slots');
  wrap.innerHTML = '';
  for (const slot of SLOTS) {
    const div = document.createElement('div');
    div.className = 'slot' + (record.slot === slot.id ? ' sel' : '');
    div.innerHTML = `<div class="sname">SLOT ${slot.id} · ${slot.seat}</div>
      <div class="scall">${slot.callsign}</div>
      <div class="sstat">${slot.note}<br>Score ${record.score} · Rings ${record.ringsFlown}<br>Flight ${record.flightMinutes}:${String(Math.floor(record.flightSeconds)).padStart(2, '0')}</div>`;
    div.addEventListener('click', () => {
      record.slot = slot.id;
      record.callsign = slot.callsign;
      $('proof-callsign').textContent = `CALLSIGN ${slot.callsign} · ${GAME.carrier}`;
      renderSlots();
    });
    wrap.appendChild(div);
  }
}

export function showTitle() {
  renderSlots();
  show('title-screen');
  document.getElementById('btn-fly').textContent = `FLY — SORTIE ${window.__game?.missionId || 1}`;
}

export function showProof() {
  const grid = $('proof-grid');
  grid.innerHTML = '';
  for (const cell of proofCells()) {
    const div = document.createElement('div');
    div.className = 'pcell';
    div.innerHTML = `<div class="lab">${cell.lab}</div><div class="val">${cell.val}</div><div class="sub">${cell.sub}</div>`;
    grid.appendChild(div);
  }
  // Session medal + BEST score (real session values) and one score/medal
  // cell per sortie — every sortie shows its state, not just a log line.
  const medal = sessionMedal();
  $('proof-medal').textContent = medal === '—'
    ? 'NO MEDAL YET — FLY A SORTIE · RANK D · BEST SCORE ' + record.score
    : `★ SESSION MEDAL — ${medal} · RANK ${sessionRank()} · BEST SCORE ${record.score}`;
  const row = $('proof-sorties');
  row.innerHTML = '';
  for (const s of sortieMedals()) {
    const div = document.createElement('div');
    div.className = 'scell';
    const cls = s.medal === 'GOLD' ? 'medal-gold' : s.medal === 'SILVER' ? 'medal-silver' : s.medal === 'BRONZE' ? 'medal-bronze' : '';
    div.innerHTML = `<div class="lab">SORTIE ${s.id} · ${s.name}</div>`
      + `<div class="val"><span class="${cls}">${s.medal === '—' ? '— NO MEDAL' : '★ ' + s.medal}</span></div>`
      + `<div class="sub">${s.score} PTS · ${s.note}</div>`;
    row.appendChild(div);
  }
  $('proof-incident').textContent = incidentLine();
  $('proof-note').textContent = proofNote();
  $('proof-callsign').textContent = `CALLSIGN ${record.callsign} · ${GAME.carrier}`;
  show('proof-screen');
}

export function showPause() { show('pause-screen'); }

export function showEnd(title, text) {
  $('end-title').textContent = title;
  $('end-text').textContent = text;
  show('end-screen');
}

export function showLog() {
  const list = $('log-list');
  const lines = record.log.length ? record.log : [{ t: '--:--:--', text: 'No flights logged yet — the deck is waiting.' }];
  list.innerHTML = lines.slice(-12).map((l) => `<div><b>${l.t}</b> — ${l.text}</div>`).join('');
  show('log-screen');
}

export function hideScreens() { show(null); }
