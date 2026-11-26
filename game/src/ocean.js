// ocean.js — the world: dusk sky, ocean, carrier, coastal city, moon, stars.
// Everything the jet flies over lives here. The carrier deck is at y = DECK_Y.

import * as THREE from 'three';

export const DECK_Y = 8;                 // carrier deck height above the water
export const CARRIER = { x: 0, z: -800 }; // deck centre
export const DECK = { length: 300, width: 72 };

// Canvas texture helpers -------------------------------------------------
function gradientTexture(stops, w = 16, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [at, col] of stops) grad.addColorStop(at, col);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture() {
  // City windows: a dark facade sprinkled with warm lit windows.
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0d16'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 12) {
    for (let x = 8; x < 120; x += 10) {
      if (Math.random() < 0.42) {
        g.fillStyle = Math.random() < 0.75 ? '#ffca6a' : '#9fd8ff';
        g.globalAlpha = 0.55 + Math.random() * 0.45;
        g.fillRect(x, y, 5, 7);
      }
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(color = '#ffd27f') {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, color); grad.addColorStop(0.35, color + 'aa'); grad.addColorStop(1, color + '00');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// World build -------------------------------------------------------------
export function buildWorld(scene) {
  const world = { tick: () => {}, rings: [], beacons: [], gates: [], lighthouseBeam: null, oceanGeo: null };

  // --- dusk sky dome: deep blue overhead, ember band on the horizon ---
  const skyTex = gradientTexture([
    [0.0, '#02040a'], [0.42, '#0a1530'], [0.62, '#1d2f55'],
    [0.72, '#7a4a3a'], [0.78, '#e08a4e'], [0.82, '#3a2a33'], [1.0, '#05070f'],
  ]);
  const sky = new THREE.Mesh(
    new THREE.CylinderGeometry(3400, 3400, 1600, 32, 1, true),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  sky.position.y = 300; scene.add(sky);

  // --- stars ---
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 1400; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.35, r = 3200;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r + 100, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfeaff, size: 2.2, sizeAttenuation: false, fog: false })));

  // --- moon + halo ---
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xf4ecd8, fog: false }),
  );
  moon.position.set(-1500, 1050, -2900); moon.lookAt(0, 0, 0); scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite('#fff3d0'), transparent: true, opacity: 0.5, fog: false, depthWrite: false,
  }));
  halo.scale.set(520, 520, 1); halo.position.copy(moon.position); scene.add(halo);

  // --- lights: low dusk sun + cool moonlight ---
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.1);
  sun.position.set(-800, 220, 600); scene.add(sun);
  const moonLight = new THREE.DirectionalLight(0x8fb4e8, 0.55);
  moonLight.position.set(-600, 900, -1200); scene.add(moonLight);
  scene.add(new THREE.AmbientLight(0x24344f, 1.05));
  scene.fog = new THREE.Fog(0x0a1226, 700, 3400);

  // --- ocean: dark swell, moon glint ---
  const oceanGeo = new THREE.PlaneGeometry(7000, 7000, 48, 48);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshPhongMaterial({
    color: 0x0a1a2e, specular: 0x4a6a8a, shininess: 90, flatShading: false,
  }));
  ocean.position.y = 0; scene.add(ocean);
  world.oceanGeo = oceanGeo;
  const oceanBase = oceanGeo.attributes.position.array.slice();

  // moon glint: a pale streak on the water under the moon
  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 2600),
    new THREE.MeshBasicMaterial({ color: 0xd8c9a0, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  glint.rotation.x = -Math.PI / 2; glint.position.set(-900, 0.4, -1500); scene.add(glint);

  // sunset shimmer: warm dusk light lying on the water toward the west
  const shimC = document.createElement('canvas'); shimC.width = 256; shimC.height = 64;
  const shimG = shimC.getContext('2d');
  const shimGrad = shimG.createLinearGradient(0, 0, 256, 0);
  shimGrad.addColorStop(0, 'rgba(224,138,78,0)'); shimGrad.addColorStop(0.5, 'rgba(224,138,78,0.85)');
  shimGrad.addColorStop(1, 'rgba(224,138,78,0)');
  shimG.fillStyle = shimGrad; shimG.fillRect(0, 0, 256, 64);
  const shimTex = new THREE.CanvasTexture(shimC); shimTex.colorSpace = THREE.SRGBColorSpace;
  const shimmer = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 420),
    new THREE.MeshBasicMaterial({ map: shimTex, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  shimmer.rotation.x = -Math.PI / 2; shimmer.rotation.z = 0.35;
  shimmer.position.set(-1200, 0.6, -300); scene.add(shimmer);

  // --- coastline + city (east, x 700..1500) ---
  const land = new THREE.Mesh(
    new THREE.BoxGeometry(1100, 6, 2400),
    new THREE.MeshPhongMaterial({ color: 0x0c1220, specular: 0x111111, shininess: 5 }),
  );
  land.position.set(1250, -1, -600); scene.add(land);
  const beach = new THREE.Mesh(
    new THREE.BoxGeometry(24, 7, 2400),
    new THREE.MeshPhongMaterial({ color: 0x2a2118, specular: 0x111111, shininess: 5 }),
  );
  beach.position.set(695, -1, -600); scene.add(beach);

  const winTex = windowTexture();
  const cityMat = new THREE.MeshPhongMaterial({ color: 0x11151f, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9 });
  const city = new THREE.Group();
  for (let i = 0; i < 150; i++) {
    const w = 14 + Math.random() * 22, d = 14 + Math.random() * 22, h = 12 + Math.random() * 58;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cityMat);
    b.position.set(760 + Math.random() * 620, h / 2 + 2, -1750 + Math.random() * 2200);
    city.add(b);
  }
  scene.add(city);
  // street lights along the coast road
  const streetGeo = new THREE.BufferGeometry();
  const streetPos = [];
  for (let z = -1700; z < 500; z += 90) streetPos.push(730, 8, z);
  streetGeo.setAttribute('position', new THREE.Float32BufferAttribute(streetPos, 3));
  scene.add(new THREE.Points(streetGeo, new THREE.PointsMaterial({ color: 0xffc46a, size: 5, sizeAttenuation: false })));

  // --- lighthouse at the headland, rotating beam ---
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 7, 46, 12),
    new THREE.MeshPhongMaterial({ color: 0xd8d2c4, emissive: 0x222222 }),
  );
  tower.position.y = 23; lh.add(tower);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  );
  lamp.position.y = 49; lh.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(26, 320, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2; beam.position.set(160, 49, 0); lh.add(beam);
  lh.position.set(700, 2, 420); scene.add(lh);
  world.lighthouseBeam = beam;

  // --- carrier: USS MERIDIAN ---
  const carrier = new THREE.Group();
  const hullMat = new THREE.MeshPhongMaterial({ color: 0x2a2f38, specular: 0x223344, shininess: 30 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(64, 14, DECK.length + 30), hullMat);
  hull.position.y = -2; carrier.add(hull);
  const deckMat = new THREE.MeshPhongMaterial({ color: 0x39404e, specular: 0x556677, shininess: 60 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(DECK.width, 4, DECK.length), deckMat);
  deck.position.y = DECK_Y - 2; carrier.add(deck);
  // deck edge lights: amber port / green starboard, white aft
  const edgeMatA = new THREE.MeshBasicMaterial({ color: 0xffb03a });
  const edgeMatG = new THREE.MeshBasicMaterial({ color: 0x39e07a });
  const edgeMatW = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let z = -DECK.length / 2 + 8; z <= DECK.length / 2 - 8; z += 16) {
    for (const [x, m] of [[-DECK.width / 2 + 1, edgeMatA], [DECK.width / 2 - 1, edgeMatG]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3), m);
      l.position.set(x, DECK_Y + 0.5, z); carrier.add(l);
    }
  }
  // deck floodlight glow: a warm halo over the landing area
  const deckGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite('#ffc46a'), transparent: true, opacity: 0.22, depthWrite: false,
  }));
  deckGlow.scale.set(420, 150, 1); deckGlow.position.set(0, DECK_Y + 26, 0); carrier.add(deckGlow);
  // centreline dashes + landing box (emissive paint, big enough to read at 200 m)
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (let z = -110; z <= 110; z += 22) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 14), lineMat);
    dash.position.set(0, DECK_Y + 0.15, z); carrier.add(dash);
  }
  const boxMat = new THREE.MeshBasicMaterial({ color: 0xffc46a });
  for (const x of [-14, 14]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 150), boxMat);
    rail.position.set(x, DECK_Y + 0.15, 0); carrier.add(rail);
  }
  // approach lights: a green ladder stretching out behind the deck
  const apprMat = new THREE.MeshBasicMaterial({ color: 0x2aff7a });
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 2), apprMat);
    l.position.set(0, DECK_Y + 1, DECK.length / 2 + 24 + i * 26); carrier.add(l);
  }
  // island superstructure with lit windows
  const island = new THREE.Mesh(
    new THREE.BoxGeometry(14, 26, 52),
    new THREE.MeshPhongMaterial({ color: 0x39404d, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.55 }),
  );
  island.position.set(DECK.width / 2 - 8, DECK_Y + 13, -40); carrier.add(island);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 22, 8), hullMat);
  mast.position.set(DECK.width / 2 - 8, DECK_Y + 36, -40); carrier.add(mast);
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  mastLight.position.set(DECK.width / 2 - 8, DECK_Y + 48, -40); carrier.add(mastLight);
  // parked jets on the deck, wings folded, lit by deck floods
  for (const [x, z, ry] of [[-22, -120, 0.3], [22, -100, -0.2], [-22, 120, 0.1]]) {
    const parked = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 11, 10), new THREE.MeshPhongMaterial({ color: 0x4a5568, specular: 0x8899aa, shininess: 60 }));
    body.rotation.x = Math.PI / 2; parked.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 3.4), body.material);
    parked.add(wing);
    parked.position.set(x, DECK_Y + 1.6, z); parked.rotation.y = ry; carrier.add(parked);
  }
  carrier.position.set(CARRIER.x, 0, CARRIER.z);
  scene.add(carrier);

  // --- approach gates (mission 1): gold glide-slope gates on the final ---
  // Outer gate is big (r 22) so it frames the deck from 100 m out; inner is r 16.
  const gateDefs = [
    { r: 22, x: 0, y: 48, z: -640 },
    { r: 16, x: 0, y: 25, z: -730 },
  ];
  for (const gd of gateDefs) {
    const gate = new THREE.Mesh(new THREE.TorusGeometry(gd.r, 1.6, 10, 32), new THREE.MeshBasicMaterial({ color: 0xffb03a }));
    gate.position.set(gd.x, gd.y, gd.z);
    scene.add(gate);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('#ffb03a'), transparent: true, opacity: 0.5, depthWrite: false,
    }));
    glow.scale.set(gd.r * 4, gd.r * 4, 1); glow.position.copy(gate.position); scene.add(glow);
    world.gates.push({ mesh: gate, glow, x: gd.x, y: gd.y, z: gd.z, passed: false });
  }
  const ringGeo = new THREE.TorusGeometry(16, 1.6, 10, 28);
  const ringCols = [0xffb03a, 0x39e0ff, 0xff5d8a, 0x7dff5d, 0xc07dff];
  const ringPath = [
    [430, 130, -260], [620, 165, -620], [820, 140, -980],
    [640, 190, -1330], [480, 150, -1650],
  ];
  ringPath.forEach(([x, y, z], i) => {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: ringCols[i] }));
    ring.position.set(x, y, z);
    ring.rotation.y = Math.PI / 2.4;
    scene.add(ring);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('#' + ringCols[i].toString(16).padStart(6, '0')),
      transparent: true, opacity: 0.55, depthWrite: false,
    }));
    glow.scale.set(70, 70, 1); glow.position.copy(ring.position); scene.add(glow);
    world.rings.push({ mesh: ring, glow, x, y, z, passed: false });
  });

  // --- patrol beacons (mission 3) — light pillars over the coast ---
  const beaconPath = [
    [760, -1400], [1150, -700], [900, 60], [560, -420],
  ];
  beaconPath.forEach(([x, z], i) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 190, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x39e0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.set(x, 95, z); scene.add(pillar);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(7),
      new THREE.MeshBasicMaterial({ color: 0x39e0ff }),
    );
    diamond.position.set(x, 120, z); scene.add(diamond);
    world.beacons.push({ pillar, diamond, x, z, reached: false });
  });

  // --- animation tick: swell, beam sweep, ring pulse ---
  world.tick = (t) => {
    const pos = oceanGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = oceanBase[i * 3], by = oceanBase[i * 3 + 1];
      pos.array[i * 3 + 2] = Math.sin(bx * 0.012 + t * 0.7) * 1.1 + Math.cos(by * 0.014 + t * 0.5) * 0.9;
    }
    pos.needsUpdate = true;
    oceanGeo.computeVertexNormals();
    world.lighthouseBeam.rotation.y = t * 0.35;
    world.rings.forEach((r, i) => {
      const s = 1 + Math.sin(t * 2.2 + i) * 0.05;
      r.mesh.scale.set(s, s, 1);
    });
    world.beacons.forEach((b, i) => { b.diamond.rotation.y = t * 1.2 + i; });
    world.gates.forEach((g, i) => {
      const s = 1 + Math.sin(t * 2.4 + i * 2) * 0.05;
      g.mesh.scale.set(s, s, 1);
    });
  };

  return world;
}

// Is the point over the deck? Used for the trap verdict.
export function overDeck(x, z) {
  return Math.abs(x - CARRIER.x) <= DECK.width / 2 - 4
    && Math.abs(z - CARRIER.z) <= DECK.length / 2 - 6;
}
