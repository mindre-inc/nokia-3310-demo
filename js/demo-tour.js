/* ============================================================
 * demo-tour.js — MIN-35 auto-demo driver, MIN-45 manual mode.
 * Walks the phone through its own menus and features, updating
 * the caption bar. Any real key/touch on the phone stops the
 * tour AND the rotation PERMANENTLY (no auto-resume) so a human
 * can actually drive it; "Restart tour" resumes deliberately.
 *
 * Controls (bound here): #btn-spin (Stop/Start rotation, also S),
 * #btn-tour (Restart tour). Rotation itself lives in rotation.js.
 *
 * Relies on the app's globals: S, DLG, go(), handleKey(),
 * powerOn(), applyTheme(). Loaded last (after main.js + rotation.js).
 * ============================================================ */
"use strict";

const DemoTour = { running: false, stepIndex: -1, total: 0, lastLabel: "" };
window.DemoTour = DemoTour;

/* ---------------- tour lifecycle ----------------
   A generation token cancels a running loop cleanly: stopTour()
   bumps TOUR_GEN, and the in-flight sleep()/k()/toMenu() calls
   throw TourStop at their next checkpoint. No 8 s auto-resume —
   once stopped, only an explicit "Restart tour" starts it again. */
let TOUR_GEN = 0;
let suppressed = false; // user took over before the initial start
const TourStop = Symbol("tour-stop");

const rawSleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sleep(ms, gen) {
  const endT = Date.now() + ms;
  while (Date.now() < endT) {
    if (gen !== TOUR_GEN) throw TourStop; // tour stopped — bail quietly
    await rawSleep(Math.min(150, endT - Date.now()));
  }
}
async function k(key, gap = 420, gen) { handleKey(key); await sleep(gap, gen); }

function cap(text) {
  const el = document.getElementById("caption-text");
  if (!el) return;
  el.style.opacity = "0";
  setTimeout(() => { el.textContent = text; el.style.opacity = "1"; }, 120);
}
function stepBadge(n, total) {
  const el = document.getElementById("caption-step");
  if (el) el.textContent = "STEP " + n + "/" + total;
}
function setManualCaption() {
  cap("Manual mode — you're driving");
  const badge = document.getElementById("caption-step");
  if (badge) badge.textContent = "MANUAL";
}

function stopTour() {
  const wasRunning = DemoTour.running;
  TOUR_GEN++;                 // kills the running loop at its next checkpoint
  DemoTour.running = false;
  if (wasRunning) setManualCaption(); // don't re-fade the caption on every keypress in manual mode
}
function restartTour() {
  suppressed = false;
  runTour(++TOUR_GEN);        // fresh generation, starts from step 1
}

/* Drive the phone back to the main menu no matter where it is
   (robust after user takeover or a dropped step). */
async function toMenu(gen) {
  let guard = 0;
  while ((S.screen ? S.screen.name : null) !== "menu" && guard++ < 16) {
    if (gen !== TOUR_GEN) throw TourStop;
    if (S.power === "off") { powerOn(); await sleep(2700, gen); continue; }
    if (S.power === "boot") { await sleep(300, gen); continue; }
    if (DLG.active) { handleKey("select"); await sleep(380, gen); continue; } // OK / Yes
    const cur = S.screen ? S.screen.name : null;
    if (cur === "standby") handleKey("select");  // standby -> menu (centre key)
    else handleKey("end");                        // one level back
    await sleep(430, gen);
  }
}

const STEPS = [
  { label: "Power on — NOKIA tune & boot bar", run: async (gen) => {
      if (S.power === "off") { powerOn(); await sleep(2700, gen); } else { await sleep(600, gen); }
  }},
  { label: "Standby — clock, signal bars, battery", run: async (gen) => { await sleep(3400, gen); }},

  { label: "Main menu — seven features, rocker scrolling", run: async (gen) => {
      await toMenu(gen); await k("down", 420, gen); await k("up", 650, gen);
  }},
  { label: "Phonebook — seeded contacts", run: async (gen) => {
      await toMenu(gen); await k("select", 420, gen); await sleep(2400, gen);
  }},
  { label: "Contact card — NOKIA CARE · 123", run: async (gen) => {
      await k("select", 420, gen); await sleep(2800, gen);
  }},
  { label: "The C key backs out of any screen", run: async (gen) => {
      await k("end", 420, gen); await k("end", 520, gen);
  }},

  { label: "Messages — Inbox / Outbox / Write", run: async (gen) => {
      await toMenu(gen); await k("down", 420, gen); await k("select", 420, gen); await sleep(2300, gen);
  }},
  { label: "Outbox — reading a sent SMS", run: async (gen) => {
      await k("down", 420, gen); await k("select", 420, gen); await k("select", 420, gen); await sleep(3100, gen);
  }},
  { label: "Back to the menu", run: async (gen) => {
      await k("end", 420, gen); await k("end", 420, gen); await k("end", 520, gen);
  }},

  { label: "Call registration — missed / received / dialed", run: async (gen) => {
      await toMenu(gen); await k("down", 420, gen); await k("down", 420, gen);
      await k("select", 420, gen); await sleep(2600, gen); await k("end", 520, gen);
  }},

  { label: "Games — Snake II & Bounce", run: async (gen) => {
      await toMenu(gen); await k("down", 420, gen); await k("down", 420, gen);
      await k("down", 420, gen); await k("select", 420, gen); await sleep(1900, gen);
  }},
  { label: "Snake II — the immortal game (walls kill!)", run: async (gen) => {
      if ((S.screen && S.screen.name) !== "games") {
        await toMenu(gen); for (let i = 0; i < 3; i++) await k("down", 420, gen); await k("select", 420, gen);
      }
      await k("select", 420, gen); await sleep(750, gen);           // snake screen, "PRESS OK TO START"
      await handleKey("right"); await sleep(350, gen);              // start (moving right)
      // gentle rectangle in the middle of the field — no wall, no self-hit
      for (const [d, ms] of [["up", 720], ["right", 720], ["down", 720], ["left", 720]]) {
        await handleKey(d); await sleep(ms, gen);
      }
      await sleep(500, gen);
      await handleKey("end"); await sleep(450, gen);                // "Quit Snake?" (or straight to games if over)
      if (DLG.active) { await handleKey("select"); await sleep(520, gen); }  // Yes -> games list
  }},
  { label: "Bounce — keep the ball alive", run: async (gen) => {
      if ((S.screen && S.screen.name) !== "games") {
        await toMenu(gen); for (let i = 0; i < 3; i++) await k("down", 420, gen); await k("select", 420, gen);
      }
      // The games list always re-enters with Snake II highlighted (row 1), so
      // step down to Bounce (row 2) first — otherwise this step replays Snake.
      await k("down", 300, gen);
      await k("select", 420, gen); await sleep(750, gen);           // bounce screen
      await handleKey("left"); await sleep(300, gen);               // start playing
      await sleep(2100, gen);                                       // let the ball fly
      await handleKey("end"); await sleep(450, gen);                // "Quit Bounce?" (or straight to games if over)
      if (DLG.active) { await handleKey("select"); await sleep(520, gen); }  // Yes -> games list
      await k("end", 560, gen);                                     // games -> menu
  }},

  { label: "Calculator — 7 + 8 = 15", run: async (gen) => {
      await toMenu(gen); await k("down", 420, gen); await k("down", 420, gen);
      await k("down", 420, gen); await k("down", 420, gen);
      await k("select", 420, gen); await sleep(600, gen);           // calc screen
      await k("7", 420, gen); await k("up", 420, gen); await k("8", 420, gen); await k("select", 420, gen);
      await sleep(2500, gen);
      await k("end", 420, gen); await k("end", 560, gen);           // C clear, then exit to menu
  }},

  { label: "Clock & alarms — adjusting the time", run: async (gen) => {
      await toMenu(gen);
      for (let i = 0; i < 5; i++) await k("down", 420, gen);
      await k("select", 420, gen); await sleep(650, gen);           // clocks -> Set clock
      await k("right", 420, gen); await k("up", 420, gen); await k("right", 420, gen);
      await k("right", 420, gen); await k("up", 420, gen);
      await handleKey("select"); await sleep(1500, gen);            // OK -> "Clock set to …" dialog
      await handleKey("select"); await sleep(600, gen);             // close dialog (on clocks list)
      await k("end", 560, gen);                                     // clocks -> menu
  }},

  { label: "Settings — and the glossy colour shells", run: async (gen) => {
      await toMenu(gen);
      for (let i = 0; i < 6; i++) await k("down", 420, gen);
      await k("select", 420, gen); await sleep(1400, gen);          // settings list
      applyTheme("green"); await sleep(1900, gen);
      applyTheme("yellow"); await sleep(1900, gen);
      applyTheme("blue"); await sleep(1000, gen);
      await k("end", 560, gen);                                     // settings -> menu
  }},

  { label: "Standby — and the tour loops again", run: async (gen) => {
      await toMenu(gen); await k("end", 420, gen); await sleep(2800, gen);
  }},
];
DemoTour.total = STEPS.length;

async function runTour(gen) {
  DemoTour.running = true;
  let i = 0;
  while (gen === TOUR_GEN) {
    const step = STEPS[i % STEPS.length];
    DemoTour.stepIndex = i % STEPS.length;
    DemoTour.lastLabel = step.label;
    cap(step.label);
    stepBadge((i % STEPS.length) + 1, STEPS.length);
    try { await step.run(gen); }
    catch (e) {
      if (e === TourStop || gen !== TOUR_GEN) return; // deliberate stop — not an error
      console.error("demo-tour step failed:", e);
      cap("Demo hiccup — recovering…");
      await rawSleep(1600);
    }
    i++;
    // after each full cycle, skip the power-on + standby beats (toMenu()
    // re-powers the phone if a user switched it off in the meantime)
    if (i % STEPS.length === 0) i += 2;
  }
}

/* ---------------- manual mode (MIN-45) ----------------
   Any real interaction with the phone — a key click inside #phone
   or any keyboard key the app maps in main.js — stops the tour AND
   the rotation permanently. There is no auto-resume; the user must
   press "Restart tour" / "Start rotation" (or S) to continue. */
function userTakeover() {
  suppressed = true;
  stopTour();
  if (window.Spin) Spin.stop(); // ease to front-facing, no snap
}

/* Phone keys mapped in main.js's KEYMAP + the raw keypad characters.
   Note: 's'/'S' is deliberately absent — it toggles the spin. */
const PHONE_KEYS = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ",
  "a", "A", "l", "L", "r", "R", "Backspace", "Delete", "Escape",
]);
window.addEventListener("keydown", (e) => {
  if (PHONE_KEYS.has(e.key) || /^[0-9*#]$/.test(e.key)) userTakeover();
}, true);
window.addEventListener("pointerdown", (e) => {
  const t = e.target;
  if (t && t.closest && t.closest("#phone")) userTakeover();
}, true);

/* ---------------- demo chrome controls ---------------- */
function bindControls() {
  const spinBtn = document.getElementById("btn-spin");
  const tourBtn = document.getElementById("btn-tour");
  if (spinBtn) {
    const sync = () => {
      const running = !!(window.Spin && Spin.running);
      spinBtn.textContent = running ? "⏸ Stop rotation" : "▶ Start rotation";
      spinBtn.setAttribute("aria-pressed", String(!running));
    };
    spinBtn.addEventListener("click", () => { if (window.Spin) Spin.toggle(); });
    window.addEventListener("spinchange", sync); // keeps label in sync with S key / takeover
    sync();
  }
  if (tourBtn) tourBtn.addEventListener("click", () => restartTour());
}

/* applyTheme() (main.js) only sets data-theme on #phone — extend it so the
   whole 3D shell (back / sides / caps) recolours with the front face. */
const __origApplyTheme = applyTheme;
applyTheme = function (name) {
  __origApplyTheme(name);
  const p3 = document.querySelector(".phone3d");
  if (p3) p3.setAttribute("data-theme", name);
};

function boot() {
  bindControls();
  // Initial auto-start, unless the user already grabbed the phone.
  setTimeout(() => {
    if (!suppressed && !DemoTour.running) restartTour();
  }, 900);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
