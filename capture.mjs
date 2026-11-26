// capture.mjs — 4-shot capture + checks for NIGHT DECK.
// Headless Chromium over CDP (Node built-in WebSocket), game/ served from
// localhost, three.js vendored. Run: node capture.mjs
// Output: screenshots/01-cover.jpg, 02-night.jpg, 03-proof.jpg, 04-title.jpg
//         contact-sheet.jpg + checks.json at the repo root (NOT in screenshots/,
//         so the dossier holds exactly the 4 judged images).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8332;
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/game/index.html`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nightdeck-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--use-gl=angle', '--use-angle=swiftshader',
    '--window-size=1280,993', '--hide-scrollbars',
    `--user-data-dir=${profile}`, '--remote-debugging-port=9225',
    '--enable-logging=stderr', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeLog = '';
  chrome.stderr.on('data', (d) => { chromeLog += d.toString(); });
  const checks = {};
  const check = (name, ok, detail = '') => {
    checks[name] = { pass: !!ok, detail: String(detail).slice(0, 300) };
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };
  const failedRequests = [];
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try { const r = await fetch('http://127.0.0.1:9225/json/list'); targets = await r.json(); if (targets?.length) break; } catch {}
    }
    if (!targets?.length) throw new Error('devtools never came up');
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result?.result?.value;
    };
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
    };
    const key = async (type, k, code, kc) => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: kc });
    const keyDown = (k, code, kc) => key('rawKeyDown', k, code, kc);
    const keyUp = (k, code, kc) => key('keyUp', k, code, kc);

    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    const consoleErrors = [];
    const origOnMsg = ws.onmessage;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Network.loadingFailed') failedRequests.push(m.params?.errorText || 'failed');
      if (m.method === 'Network.responseReceived' && m.params?.response?.status >= 400) failedRequests.push(m.params.response.status + ' ' + m.params.response.url);
      if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(JSON.stringify(m.params?.exceptionDetails).slice(0, 200));
      origOnMsg(ev);
    };
    await send('Page.navigate', { url: BASE });
    await sleep(5000);
    check('boot: game object + first frames rendered', await evalJs(`!!window.__game && window.__game.frames > 5`), `frames=${await evalJs('window.__game.frames')}`);
    check('boot: title screen visible', await evalJs(`document.getElementById('title-screen').classList.contains('on')`));
    check('boot: 3 save slots on title', await evalJs(`document.querySelectorAll('#slots .slot').length === 3`));

    const snapshot = () => evalJs(`(() => { const s = window.__game.save; return { callsign: s.callsign, score: s.score, sortiesFlown: s.sortiesFlown, rings: s.ringsFlown, traps: s.carrierLandings, flight: s.flightMinutes + ':' + Math.floor(s.flightSeconds) }; })()`);
    const legibility = async () => evalJs(`(() => {
      const problems = [];
      const els = document.querySelectorAll('.hud-box, #hud-msg, #hud-warn, #hud-gear, #radio-log, .slot, .pcell, .controls, .big-btn, #title-screen h1, #title-screen h2, #proof-screen h1, #proof-screen h2, #end-screen h1');
      for (const el of els) {
        if (getComputedStyle(el).display === 'none') continue;
        const scr = el.closest('.screen');
        if (scr && getComputedStyle(scr).display === 'none') continue;
        if (el.closest('#hud') && getComputedStyle(document.getElementById('hud')).display === 'none') continue;
        if (el.closest('#panel') && getComputedStyle(document.getElementById('panel')).display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -1 || r.top < -1 || r.right > 1281 || r.bottom > 801) problems.push('out-of-frame ' + (el.id || el.className));
        if (el.scrollWidth > el.clientWidth + 1) problems.push('h-overflow ' + (el.id || el.className) + ' ' + el.scrollWidth + '>' + el.clientWidth);
      }
      const tops = [...document.querySelectorAll('#hud > .hud-box')].filter((e) => getComputedStyle(e).display !== 'none');
      for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
        const a = tops[i].getBoundingClientRect(), b = tops[j].getBoundingClientRect();
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)
          problems.push('overlap ' + tops[i].id + ' x ' + tops[j].id);
      }
      return problems;
    })()`);

    // --- SHOT 2 FIRST: night intercept — earn the score honestly before the
    // cover. Chase view, thread ring 1 over the coast (+250, radio log line).
    await evalJs(`window.__kit.stageNight()`);
    await keyDown('w', 'KeyW', 87); await sleep(1200); await keyUp('w', 'KeyW', 87);
    // SwiftShader frame rate varies, so poll (not a fixed sleep) until the
    // jet actually threads ring 1 — then shoot immediately, ring 2 ahead.
    let rings = 0;
    for (let i = 0; i < 24; i++) {
      await sleep(400);
      rings = await evalJs(`window.__game.save.ringsFlown`);
      if (rings >= 1) break;
    }
    const speed = await evalJs(`Math.round(window.__game.flight.speed * 1.944)`);
    check('play: jet flies (W raises speed)', speed > 100, `speed=${speed} kt`);
    check('play: ring threaded for real (ringsFlown = 1)', rings === 1, `ringsFlown=${rings}`);
    check('play: score earned (+250 for the clean ring)', await evalJs(`window.__game.save.score`) === 250, `score=${await evalJs('window.__game.save.score')}`);
    check('play: radio log reports the clean pass', await evalJs(`document.getElementById('radio-log').textContent.includes('RING 1 CLEAN +250')`));
    check('play: chase camera shows the jet', await evalJs(`window.__game.camMode === 'chase'`));
    check('play: slim bottom bar visible in chase (persistent HUD)', await evalJs(`getComputedStyle(document.getElementById('pbar-bottom')).display === 'flex'`));
    check('play: compass strip drawn (top-centre)', await evalJs(
      `(() => { const c = document.getElementById('hud-compass-c'); const g = c.getContext('2d'); const d = g.getImageData(0,0,c.width,c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 40) if (d[i]+d[i+1]+d[i+2] > 60) lit++; return lit > 5; })()`));
    await shot('02-night.jpg');
    const snap1 = await snapshot();
    check('legibility: night shot', (await legibility()).length === 0, JSON.stringify(await legibility()));

    // --- SHOT 1: cover — cockpit, final approach: lit deck + gate ahead,
    // score 250 + rings 1/5 + radio log already earned in the intercept.
    // NOTE: the jet keeps flying while checks run, so the shot goes FIRST —
    // fast geometric evals, then the shutter, then the slow DOM checks.
    await evalJs(`window.__kit.stageCover()`);
    await keyDown('w', 'KeyW', 87); await sleep(500); await keyUp('w', 'KeyW', 87);
    await sleep(500);
    const gatePos = await evalJs(`window.__kit.inFrame(0, 48, -640)`);
    const deckPos = await evalJs(`window.__kit.inFrame(0, 8, -800)`);
    await shot('01-cover.jpg');
    await evalJs(`window.__kit.freeze()`); // record frozen at the cover state
    const snap0 = await snapshot();
    check('cover: approach gate ahead in frame', gatePos.visible, JSON.stringify(gatePos));
    check('cover: lit carrier deck ahead in frame', deckPos.visible, JSON.stringify(deckPos));
    check('play: HUD shows altitude + speed + heading', await evalJs(
      `['hud-alt-v','hud-spd-v','hud-hdg-v'].every(id => document.getElementById(id).textContent.trim() !== '0')`));
    check('play: cockpit panel lit (5 gauges drawn)', await evalJs(
      `['g-att','g-spd','g-alt','g-hdg','g-thr'].every(id => { const c = document.getElementById(id); const g = c.getContext('2d'); const d = g.getImageData(0,0,c.width,c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 400) if (d[i]+d[i+1]+d[i+2] > 60) lit++; return lit > 20; })`));
    check('cover: earned score on the HUD (>= 250, matches the record)', await evalJs(
      `document.getElementById('hud-score-v').textContent.replace(/,/g,'') === String(window.__game.save.score) && window.__game.save.score >= 250`), `score=${snap0.score}`);
    check('cover: gates progress + session rings on the HUD', await evalJs(`document.getElementById('hud-score-sub').textContent`) === 'GATES 0 / 2 · RINGS 1 / 5');
    check('cover: objective shows live distance to the next target', await evalJs(`document.getElementById('hud-obj-sub').textContent.includes(' m ')`), await evalJs(`document.getElementById('hud-obj-sub').textContent`));
    check('cover: fuel burned (raw float, not 100%)', await evalJs(`window.__game.flight.fuel`) < 99.9, `fuel=${await evalJs('window.__game.flight.fuel')}`);
    check('cover: radio log visible with tower lines', await evalJs(`document.querySelectorAll('#radio-log .rline').length >= 2`));
    check('cover: radio log has the named tower voice (VOSS)', await evalJs(`document.getElementById('radio-log').textContent.includes('VOSS')`));
    check('legibility: cover (no overflow / overlap / out-of-frame)', (await legibility()).length === 0, JSON.stringify(await legibility()));

    // --- SHOT 3: proof screen ---
    await evalJs(`window.__kit.stageProof()`);
    await sleep(700);
    await shot('03-proof.jpg');
    const snap2 = await snapshot();
    check('legibility: proof screen', (await legibility()).length === 0, JSON.stringify(await legibility()));
    check('proof: 6 honest total cells shown', await evalJs(`document.querySelectorAll('.pcell').length === 6`));
    check('proof: score cell shows the session score', await evalJs(
      `document.querySelector('.pcell:nth-child(1) .lab').textContent === 'SCORE' && document.querySelector('.pcell:nth-child(1) .val').textContent === String(${snap2.score})`));
    check('proof: rings total matches the game (1 flown, 5 in build)', await evalJs(
      `document.querySelector('.pcell:nth-child(3) .val').textContent === '1' && document.querySelector('.pcell:nth-child(3) .sub').textContent.includes('5 rings')`));
    check('proof: session medal + best score shown (real values)', await evalJs(
      `document.getElementById('proof-medal').textContent.includes('BEST SCORE 250')`));
    check('proof: rank letter computed from the session', await evalJs(
      `document.getElementById('proof-medal').textContent.includes('RANK C')`));
    check('proof: incident line from the record (clean session)', await evalJs(
      `document.getElementById('proof-incident').textContent.includes('INCIDENT LOG — Clean session')`));
    check('proof: all 3 sorties show a score/medal state', await evalJs(
      `document.querySelectorAll('#proof-sorties .scell').length === 3 && document.getElementById('proof-sorties').textContent.includes('NIGHT INTERCEPT')`));
    check('proof: pilot-log progress line in the debrief note', await evalJs(
      `document.getElementById('proof-note').textContent.includes('PILOT LOG — 0 of 3 sorties complete')`));
    check('proof: persistent top + bottom bars visible', await evalJs(
      `getComputedStyle(document.getElementById('pbar-top')).display === 'flex' && getComputedStyle(document.getElementById('pbar-bottom')).display === 'flex'`));

    // --- SHOT 4: title screen ---
    await evalJs(`window.__kit.stageTitle()`);
    await sleep(700);
    await shot('04-title.jpg');
    const snap3 = await snapshot();
    check('legibility: title screen', (await legibility()).length === 0, JSON.stringify(await legibility()));
    check('title: persistent top + bottom bars visible', await evalJs(
      `getComputedStyle(document.getElementById('pbar-top')).display === 'flex' && getComputedStyle(document.getElementById('pbar-bottom')).display === 'flex'`));
    check('title: top bar shows the session score', await evalJs(
      `document.getElementById('pbar-top-r').textContent.includes('SCORE 250')`));

    // --- Consistency: proof and title show the same pilot record ---
    const same = snap2.callsign === snap3.callsign && snap2.rings === snap3.rings
      && snap2.traps === snap3.traps && snap2.sortiesFlown === snap3.sortiesFlown
      && snap2.score === snap3.score;
    check('consistency: proof vs title record identical', same, JSON.stringify([snap2, snap3]));

    // --- Console / network ---
    await sleep(300);
    const errs = chromeLog.split('\n').filter((l) => /Uncaught|net::ERR_|Failed to load resource/.test(l));
    check('zero console errors', errs.length === 0 && consoleErrors.length === 0, [...errs.slice(0, 2), ...consoleErrors.slice(0, 2)].join(' | '));
    check('zero failed network requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

    // --- Files exist + size/dimension limits (gate: each ≤256 KiB, long side ≤1280, short ≥480) ---
    for (const f of ['01-cover.jpg', '02-night.jpg', '03-proof.jpg', '04-title.jpg']) {
      const st = fs.statSync(path.join(OUT, f));
      check(`file: ${f} exists (${Math.round(st.size / 1024)} KB, ≤256 KiB)`, st.size > 20000 && st.size <= 262144, `${st.size} bytes`);
    }

    // --- Contact sheet: cover large on top, 3 small below (PIL), at repo root ---
    const sheetOk = await new Promise((res) => {
      execFile('python3', ['-c', `
from PIL import Image
import os
out = r'${OUT}'
root = r'${ROOT}'
cover = Image.open(os.path.join(out, '01-cover.jpg')).convert('RGB').resize((1280, 800))
print('cover size', Image.open(os.path.join(out, '01-cover.jpg')).size)
small = [Image.open(os.path.join(out, f)).convert('RGB').resize((416, 260)) for f in ['02-night.jpg', '03-proof.jpg', '04-title.jpg']]
sheet = Image.new('RGB', (1280, 800 + 8 + 260), (16, 16, 16))
sheet.paste(cover, (0, 0))
for i, im in enumerate(small):
    sheet.paste(im, (i * 424 + 4, 808))
sheet.save(os.path.join(root, 'contact-sheet.jpg'), quality=88)
print('sheet', sheet.size)
`], (err, stdout, stderr) => { if (err) console.log('sheet build failed:', stderr); else console.log(stdout.trim()); res(!err); });
    });
    check('contact sheet built', sheetOk && fs.existsSync(path.join(ROOT, 'contact-sheet.jpg')));

    fs.writeFileSync(path.join(ROOT, 'checks.json'), JSON.stringify({ shots: [snap0, snap1, snap2, snap3], checks }, null, 2));
    const fails = Object.values(checks).filter((c) => !c.pass).length;
    console.log(`\n${fails} FAILURES`);
    if (fails) process.exitCode = 1;
  } finally {
    chrome.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    server.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
