/* ============================================================
 * rotation.js — MIN-45: stoppable 360° spin.
 * Drives .spin with a rAF loop (replaces the old CSS keyframes)
 * so the demo can pause in place, ease to front-facing (0°),
 * resume without snapping, and set exact angles for QA shots.
 * Speed matches the old `spin360 16s` animation: 22.5 deg/s.
 *
 * API (window.Spin):
 *   Spin.running          bool — is the spin advancing?
 *   Spin.angle            current rotation in degrees (unwrapped)
 *   Spin.stop()           pause + ease to nearest front-facing view
 *   Spin.start()          resume from the current angle (no snap)
 *   Spin.toggle()         stop/start (button + S shortcut)
 *   Spin.setAngle(deg)    QA hook: stop and set an exact angle
 * Dispatches a `spinchange` CustomEvent on window on state flips.
 * ============================================================ */
"use strict";

(function () {
  const SPINNER = document.getElementById("spinner");
  const DEG_PER_MS = 360 / 16000; // same cadence as the old spin360 keyframes
  const EASE_MS = 700;           // stop -> ease to front-facing

  const Spin = { angle: 0, running: true };
  window.Spin = Spin; // stop/start/toggle/setAngle attached below

  let easing = null;   // { from, to, t0 } while easing to front-facing
  let lastTs = 0;

  function apply() {
    if (SPINNER) SPINNER.style.transform = "rotateY(" + Spin.angle.toFixed(3) + "deg)";
  }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function frame(ts) {
    const dt = lastTs ? Math.min(64, ts - lastTs) : 16; // clamp tab-switch jumps
    lastTs = ts;
    if (easing) {
      const p = Math.min(1, (ts - easing.t0) / EASE_MS);
      Spin.angle = easing.from + (easing.to - easing.from) * easeInOutCubic(p);
      if (p >= 1) easing = null; // lands exactly on a multiple of 360 (front)
    } else if (Spin.running) {
      Spin.angle += dt * DEG_PER_MS;
    }
    apply();
    requestAnimationFrame(frame);
  }

  function emit() {
    window.dispatchEvent(new CustomEvent("spinchange", { detail: { running: Spin.running } }));
  }

  function stop() {
    if (!Spin.running) return; // already stopped / mid-ease: leave it be
    Spin.running = false;
    // Ease to the NEAREST multiple of 360 (front-facing) — no snap.
    const a = ((Spin.angle % 360) + 360) % 360;
    const target = a <= 180 ? Math.floor(Spin.angle / 360) * 360
                            : Math.ceil(Spin.angle / 360) * 360;
    easing = { from: Spin.angle, to: target, t0: performance.now() };
    emit();
  }

  function start() {
    easing = null;
    if (!Spin.running) { Spin.running = true; emit(); }
  }

  function toggle() { Spin.running ? stop() : start(); }

  /* QA hook: stop and set an exact angle (0/45/90/135/180/270 …). */
  function setAngle(deg) {
    easing = null;
    if (Spin.running) { Spin.running = false; emit(); }
    Spin.angle = deg;
    apply();
  }

  /* S toggles the spin. Deliberately NOT one of the phone keys mapped in
     main.js (arrows, Enter/Space, a/l/r, Esc/Backspace/Delete, 0-9 * #). */
  window.addEventListener("keydown", (e) => {
    if (e.key === "s" || e.key === "S") toggle();
  });

  Spin.stop = stop;
  Spin.start = start;
  Spin.toggle = toggle;
  Spin.setAngle = setAngle;

  requestAnimationFrame(frame);
})();
