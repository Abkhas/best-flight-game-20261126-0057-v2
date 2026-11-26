// jet.js — the modern jet, built from parts: fuselage, swept wings, twin tails,
// glass canopy, afterburner glow, nav lights. No imported models, no copied art.

import * as THREE from 'three';

export function buildJet() {
  const jet = new THREE.Group();
  const skin = new THREE.MeshPhongMaterial({ color: 0x8b98a8, specular: 0xc8d8e8, shininess: 90 });
  const dark = new THREE.MeshPhongMaterial({ color: 0x2c3442, specular: 0x556677, shininess: 60 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x1a2a3a, specular: 0xffffff, shininess: 140, transparent: true, opacity: 0.45,
  });

  // fuselage: tapered nose to tail
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.35, 9.5, 12), skin);
  body.rotation.x = Math.PI / 2; body.position.z = 0.4; jet.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 12), dark);
  // drooped nose: the real jet's nose drops away from the pilot's eye, so
  // the deck and the gates ahead stay visible over it from the cockpit.
  nose.rotation.x = -Math.PI / 2 - 0.12; nose.position.set(0, -0.35, -6.6); jet.add(nose);
  // radome tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 10), new THREE.MeshPhongMaterial({ color: 0x3a4556 }));
  tip.rotation.x = -Math.PI / 2 - 0.12; tip.position.set(0, -0.55, -8.6); jet.add(tip);

  // canopy: glass bubble over the front office
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), glass);
  canopy.scale.set(0.82, 0.62, 1.9); canopy.position.set(0, 0.85, -2.6); jet.add(canopy);
  // canopy frame rails
  for (const x of [-0.85, 0.85]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 3.4), dark);
    rail.position.set(x, 0.95, -2.6); jet.add(rail);
  }

  // main wings: swept, thin, with tip rails
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 2.6), skin);
    wing.position.set(s * 3.1, -0.15, 1.4); wing.rotation.y = s * 0.5; jet.add(wing);
    const tipRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 2.2), dark);
    tipRail.position.set(s * 5.2, -0.12, 2.5); tipRail.rotation.y = s * 0.5; jet.add(tipRail);
  }
  // tailplanes + twin canted fins
  for (const s of [-1, 1]) {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 1.5), skin);
    stab.position.set(s * 1.7, 0.1, 4.6); stab.rotation.y = s * 0.4; jet.add(stab);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 2.2), skin);
    fin.position.set(s * 1.5, 1.35, 4.4); fin.rotation.z = -s * 0.28; fin.rotation.y = s * 0.18; jet.add(fin);
  }

  // twin engines: nozzles + afterburner glow
  const burnMat = new THREE.MeshBasicMaterial({ color: 0xffa63c });
  const nozzles = [];
  for (const s of [-1, 1]) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.6, 12), dark);
    noz.rotation.x = Math.PI / 2; noz.position.set(s * 0.85, -0.1, 5.2); jet.add(noz);
    const flame = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), burnMat);
    flame.position.set(s * 0.85, -0.1, 6.05); jet.add(flame);
    nozzles.push(flame);
  }
  const engineLight = new THREE.PointLight(0xff8a3c, 12, 26);
  engineLight.position.set(0, 0, 6.5); jet.add(engineLight);

  // nav lights: red port, green starboard, white tail (blink in main loop)
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  navL.position.set(-5.35, -0.1, 2.5); jet.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
  navR.position.set(5.35, -0.1, 2.5); jet.add(navR);
  const navT = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navT.position.set(0, 0.6, 5.6); jet.add(navT);

  // The nose the pilot sees from the cockpit: dark spine + pitot, low.
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 4.5), dark);
  spine.position.set(0, 0.3, -4.2); jet.add(spine);
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), dark);
  pitot.rotation.x = Math.PI / 2; pitot.position.set(0, -0.1, -8.2); jet.add(pitot);

  jet.userData = { nozzles, engineLight, navT, burnMat };
  return jet;
}

// Place the jet group from the flight state. Forward is -z in model space.
export function poseJet(jet, s) {
  jet.position.set(s.x, s.y, s.z);
  jet.rotation.order = 'YXZ';
  jet.rotation.y = s.heading;
  jet.rotation.x = -s.pitch; // nose up = rotate about x
  jet.rotation.z = s.bank;
}

// Afterburner + nav strobe animation. throttle 0..1, t seconds.
export function animateJet(jet, throttle, t) {
  const u = jet.userData;
  const glow = 0.35 + throttle * 0.65 + Math.sin(t * 31) * 0.06 * throttle;
  u.nozzles.forEach((n) => n.scale.set(glow, glow, 1));
  u.engineLight.intensity = 4 + throttle * 14;
  u.navT.visible = (t % 1.1) < 0.12; // white strobe
}
