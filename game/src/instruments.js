// instruments.js — the lit instrument panel. Five canvas gauges drawn every
// frame from the flight state, so they always agree with the HUD: attitude,
// airspeed, altimeter, heading tape, throttle + fuel. Glowing on dark glass —
// instruments that look flown, not drawn.

function ctx2d(canvas) { return canvas.getContext('2d'); }

function dial(c, label, color) {
  const g = ctx2d(c); const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04070e'; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a3c58'; g.lineWidth = 2; g.stroke();
  g.fillStyle = color; g.font = 'bold 10px Consolas, monospace'; g.textAlign = 'center';
  g.fillText(label, cx, 20);
  return g;
}

function needle(g, cx, cy, angle, len, color, width = 3) {
  g.save(); g.translate(cx, cy); g.rotate(angle);
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 8); g.lineTo(0, -len); g.stroke(); g.restore();
}

function digital(g, cx, y, text, color = '#eaf6ff', size = 20) {
  g.fillStyle = '#000'; g.fillRect(cx - 42, y - size + 4, 84, size + 8);
  g.strokeStyle = '#2a3c58'; g.lineWidth = 1; g.strokeRect(cx - 42, y - size + 4, 84, size + 8);
  g.fillStyle = color; g.font = `bold ${size}px Consolas, monospace`; g.textAlign = 'center';
  g.fillText(text, cx, y + 5);
}

// --- Attitude indicator: horizon that rolls with bank, pitches with pitch ---
export function drawAttitude(canvas, pitch, bank) {
  const g = dial(canvas, 'ATTITUDE', '#7fd8ff');
  const cx = 66, cy = 68, R = 52;
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.translate(cx, cy); g.rotate(bank);
  const yOff = pitch * 110;
  g.fillStyle = '#1d4a7a'; g.fillRect(-R - 4, -R - 4 + yOff, R * 2 + 8, R + 4 - yOff); // sky
  g.fillStyle = '#7a4a26'; g.fillRect(-R - 4, yOff, R * 2 + 8, R + 4);               // ground
  g.strokeStyle = '#eaf6ff'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-R, yOff); g.lineTo(R, yOff); g.stroke();
  g.strokeStyle = 'rgba(234,246,255,0.5)'; g.lineWidth = 1;
  for (const d of [-20, 20]) {
    g.beginPath(); g.moveTo(-14, yOff + d); g.lineTo(14, yOff + d); g.stroke();
  }
  g.restore();
  // fixed aircraft symbol
  g.strokeStyle = '#ffd27f'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx - 8, cy); g.moveTo(cx + 8, cy); g.lineTo(cx + 26, cy); g.stroke();
  g.fillStyle = '#ffd27f'; g.beginPath(); g.arc(cx, cy, 3.5, 0, Math.PI * 2); g.fill();
  // bank pointer
  needle(g, cx, cy, bank, 58, '#ffd27f', 2);
}

// --- Airspeed: needle + digital knots ---
export function drawAirspeed(canvas, kt) {
  const g = dial(canvas, 'AIRSPEED · KT', '#7fd8ff');
  const cx = 66, cy = 68;
  g.strokeStyle = '#3a5a7a'; g.lineWidth = 1;
  for (let v = 0; v <= 400; v += 50) {
    const a = -Math.PI * 0.75 + (v / 400) * Math.PI * 1.5;
    g.beginPath();
    g.moveTo(cx + Math.sin(a) * 46, cy - Math.cos(a) * 46);
    g.lineTo(cx + Math.sin(a) * 54, cy - Math.cos(a) * 54);
    g.stroke();
    g.fillStyle = '#9fc4e8'; g.font = '10px Consolas, monospace'; g.textAlign = 'center';
    g.fillText(String(v), cx + Math.sin(a) * 36, cy - Math.cos(a) * 36 + 3);
  }
  const a = -Math.PI * 0.75 + (Math.min(kt, 400) / 400) * Math.PI * 1.5;
  needle(g, cx, cy, a, 50, '#ff5d5d', 3);
  g.fillStyle = '#eaf6ff'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
  digital(g, cx, 108, String(Math.round(kt)));
}

// --- Altimeter: needle + digital feet ---
export function drawAltimeter(canvas, ft) {
  const g = dial(canvas, 'ALTITUDE · FT', '#7fd8ff');
  const cx = 66, cy = 68;
  g.strokeStyle = '#3a5a7a'; g.lineWidth = 1;
  for (let v = 0; v < 1000; v += 100) {
    const a = -Math.PI * 0.75 + (v / 1000) * Math.PI * 1.5;
    g.beginPath();
    g.moveTo(cx + Math.sin(a) * 46, cy - Math.cos(a) * 46);
    g.lineTo(cx + Math.sin(a) * 54, cy - Math.cos(a) * 54);
    g.stroke();
    g.fillStyle = '#9fc4e8'; g.font = '10px Consolas, monospace'; g.textAlign = 'center';
    g.fillText(String(v / 100), cx + Math.sin(a) * 36, cy - Math.cos(a) * 36 + 3);
  }
  const a = -Math.PI * 0.75 + ((ft % 1000) / 1000) * Math.PI * 1.5;
  needle(g, cx, cy, a, 50, '#7fd8ff', 3);
  const a2 = -Math.PI * 0.75 + ((ft % 10000) / 10000) * Math.PI * 1.5;
  needle(g, cx, cy, a2, 34, '#ffd27f', 2);
  g.fillStyle = '#eaf6ff'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
  digital(g, cx, 108, String(Math.round(ft)));
}

// --- Heading tape: compass strip with the current heading centred ---
export function drawHeading(canvas, hdgDeg) {
  const g = ctx2d(canvas); const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04070e'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2a3c58'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
  g.fillStyle = '#7fd8ff'; g.font = 'bold 10px Consolas, monospace'; g.textAlign = 'center';
  g.fillText('HEADING', W / 2, 16);
  const pxPerDeg = 1.1;
  const norm = ((hdgDeg % 360) + 360) % 360;
  for (let d = -90; d <= 90; d += 5) {
    const deg = Math.round((norm + d) / 5) * 5;
    const dd = ((deg - norm + 540) % 360) - 180;
    const x = W / 2 + dd * pxPerDeg;
    if (x < 4 || x > W - 4) continue;
    const major = deg % 30 === 0;
    g.strokeStyle = major ? '#eaf6ff' : '#3a5a7a'; g.lineWidth = major ? 2 : 1;
    g.beginPath(); g.moveTo(x, 34); g.lineTo(x, major ? 58 : 48); g.stroke();
    if (major) {
      const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg % 360] || String(deg % 360).padStart(3, '0');
      g.fillStyle = '#eaf6ff'; g.font = 'bold 12px Consolas, monospace';
      g.fillText(label, x, 76);
    }
  }
  // centre caret + digital readout
  g.fillStyle = '#ffd27f';
  g.beginPath(); g.moveTo(W / 2 - 8, 26); g.lineTo(W / 2 + 8, 26); g.lineTo(W / 2, 38); g.fill();
  digital(g, W / 2, 112, String(Math.round(norm)).padStart(3, '0') + '°', '#ffd27f', 18);
}

// --- Throttle quadrant + fuel gauge ---
export function drawThrottle(canvas, throttle, fuel) {
  const g = ctx2d(canvas); const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04070e'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2a3c58'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
  g.fillStyle = '#7fd8ff'; g.font = 'bold 10px Consolas, monospace'; g.textAlign = 'center';
  g.fillText('THROTTLE', 44, 16); g.fillText('FUEL', 100, 16);
  // throttle slot
  g.strokeStyle = '#3a5a7a'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(44, 100); g.lineTo(44, 30); g.stroke();
  const ty = 100 - throttle * 70;
  g.fillStyle = '#ffd27f'; g.fillRect(34, ty - 5, 20, 10);
  g.fillStyle = '#eaf6ff'; g.font = 'bold 13px Consolas, monospace';
  g.fillText(Math.round(throttle * 100) + '%', 44, 122);
  // fuel arc
  const fx = 100, fy = 66;
  g.strokeStyle = '#22314a'; g.lineWidth = 9;
  g.beginPath(); g.arc(fx, fy, 30, -Math.PI * 0.75, Math.PI * 0.75); g.stroke();
  const col = fuel > 30 ? '#37d67a' : fuel > 12 ? '#ffb03a' : '#ff5d5d';
  g.strokeStyle = col; g.lineWidth = 9;
  g.beginPath(); g.arc(fx, fy, 30, -Math.PI * 0.75, -Math.PI * 0.75 + (fuel / 100) * Math.PI * 1.5); g.stroke();
  g.fillStyle = col; g.font = 'bold 14px Consolas, monospace';
  g.fillText(Math.round(fuel) + '%', fx, fy + 5);
  g.fillStyle = fuel <= 12 ? '#ff5d5d' : '#9fc4e8'; g.font = 'bold 10px Consolas, monospace';
  if (fuel <= 12) g.fillText('LOW FUEL', fx, 122);
}

export function drawAll(state) {
  drawAttitude(document.getElementById('g-att'), state.pitch, state.bank);
  drawAirspeed(document.getElementById('g-spd'), state.speed * 1.944); // m/s -> kt
  drawAltimeter(document.getElementById('g-alt'), state.y * 3.281);    // m -> ft
  drawHeading(document.getElementById('g-hdg'), ((state.heading * 180) / Math.PI % 360 + 360) % 360);
  drawThrottle(document.getElementById('g-thr'), state.throttle, state.fuel);
}
