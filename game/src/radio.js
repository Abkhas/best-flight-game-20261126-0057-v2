// radio.js — the carrier tower radio log. The depth device: a running feed of
// tower chatter that only ever reports things that actually happened in the
// game (clearances on sortie start, clean passes, traps, warnings). Rendered
// into #radio-log; the last 4 lines show, the full feed lives in the pilot log.

const lines = [];
const MAX = 24;

export function radio(speaker, text) {
  lines.push({ speaker, text });
  if (lines.length > MAX) lines.shift();
  render();
}

export function radioLines() { return lines.slice(); }

function render() {
  const el = document.getElementById('radio-log');
  if (!el) return;
  const last = lines.slice(-4);
  el.innerHTML = '<div class="rhead">RADIO · MERIDIAN TOWER</div>' + last.map((l) =>
    `<div class="rline"><b class="${l.speaker === 'TOWER' ? 'twr' : l.speaker === 'NIGHTHAWK-1' ? 'plt' : 'sys'}">${l.speaker}</b> ${l.text}</div>`,
  ).join('');
}

export function clearRadio() { lines.length = 0; render(); }
