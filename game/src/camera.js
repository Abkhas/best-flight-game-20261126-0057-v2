// camera.js — three cameras, one pilot. Cockpit is the default: the camera
// rides the jet and the nose + canopy frame stay in view. Chase shows the
// whole airframe against the dusk; orbit is a slow inspection circle.

import * as THREE from 'three';

export const CAM_MODES = ['cockpit', 'chase', 'orbit'];

export function makeCamera() {
  const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 8000);
  return cam;
}

// cam: THREE camera, s: flight state, mode, t: seconds, orbitTarget: Vector3-ish
export function updateCamera(cam, s, mode, t, snap = false) {
  const hdg = s.heading;
  const fwd = new THREE.Vector3(Math.sin(hdg), 0, -Math.cos(hdg));
  const right = new THREE.Vector3(Math.cos(hdg), 0, Math.sin(hdg));
  const up = new THREE.Vector3(0, 1, 0);

  if (mode === 'cockpit') {
    // Pilot's eye: AT the canopy (local z -2.4, ahead of the jet centre),
    // high over the nose — the nose drops away below, the deck and the
    // gates ahead stay in view. (fwd+ moves FORWARD from the jet centre;
    // a negative offset sits over the tail and the fuselage fills the view.)
    const eye = new THREE.Vector3(s.x, s.y, s.z)
      .addScaledVector(fwd, 2.4)
      .addScaledVector(up, 1.75);
    const look = new THREE.Vector3(s.x, s.y, s.z)
      .addScaledVector(fwd, 60)
      .addScaledVector(up, Math.sin(s.pitch) * 40 - 6);
    cam.position.copy(eye);
    cam.up.set(Math.sin(s.bank), Math.cos(s.bank), 0);
    cam.lookAt(look);
  } else if (mode === 'chase') {
    const eye = new THREE.Vector3(s.x, s.y, s.z)
      .addScaledVector(fwd, -19)
      .addScaledVector(up, 5.5);
    const look = new THREE.Vector3(s.x, s.y, s.z).addScaledVector(fwd, 25);
    if (snap) cam.position.copy(eye); else cam.position.lerp(eye, 0.35);
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
  } else {
    // orbit: wide, high circle around the jet — deck, island and city in frame
    const a = t * 0.12;
    cam.position.set(s.x + Math.sin(a) * 58, s.y + 16, s.z + Math.cos(a) * 58);
    cam.up.set(0, 1, 0);
    cam.lookAt(s.x, s.y + 1, s.z);
  }
}
