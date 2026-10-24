/* ============================================================
 * demo-tour.js — MIN-35 auto-demo driver.
 * The phone spins 360° continuously (CSS) while this script
 * walks it through its own menus and features, updating the
 * caption bar. Any real key/touch pauses the tour briefly so
 * a human can take over.
 *
 * Relies on the app's globals: S, DLG, go(), handleKey(),
 * powerOn(), applyTheme(). Loaded last (after main.js).
 * ============================================================ */
"use strict";

const DemoTour = { running: false, stepIndex: -1, total: 0, lastLabel: "" };
window.DemoTour = DemoTour;

let holdUntil = 0;
function hold(ms) { holdUntil = Math.max(holdUntil, Date.now() + ms); }
/* pause-on-interaction: any real key/touch lets a human drive */
window.addEventListener("keydown", () => hold(8000), true);
window.addEventListener("pointerdown", () => hold(6000), true);

/* applyTheme() (main.js) only sets data-theme on #phone — extend it so the
   whole 3D shell (back / sides / caps) recolours with the front face. */
const __origApplyTheme = applyTheme;
applyTheme = function (name) {
  __origApplyTheme(name);
  const p3 = document.querySelector(".phone3d");
  if (p3) p3.setAttribute("data-theme", name);
};

const rawSleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function sleep(ms) {
  const endT = Date.now() + ms;
  while (Date.now() < endT) {
    const until = Math.max(endT, holdUntil);
    await rawSleep(Math.min(150, until - Date.now()));
  }
}

async function k(key, gap = 420) { handleKey(key); await sleep(gap); }

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

/* Drive the phone back to the main menu no matter where it is
   (robust after user takeover or a dropped step). */
async function toMenu() {
  let guard = 0;
  while ((S.screen ? S.screen.name : null) !== "menu" && guard++ < 16) {
    if (S.power === "off") { powerOn(); await sleep(2700); continue; }
    if (S.power === "boot") { await sleep(300); continue; }
    if (DLG.active) { handleKey("select"); await sleep(380); continue; } // OK / Yes
    const cur = S.screen ? S.screen.name : null;
    if (cur === "standby") handleKey("select");  // standby -> menu (centre key)
    else handleKey("end");                        // one level back
    await sleep(430);
  }
}

const STEPS = [
  { label: "Power on — NOKIA tune & boot bar", run: async () => {
      if (S.power === "off") { powerOn(); await sleep(2700); } else { await sleep(600); }
  }},
  { label: "Standby — clock, signal bars, battery", run: async () => { await sleep(3400); }},

  { label: "Main menu — seven features, rocker scrolling", run: async () => {
      await toMenu(); await k("down"); await k("up", 650);
  }},
  { label: "Phonebook — seeded contacts", run: async () => {
      await toMenu(); await k("select"); await sleep(2400);
  }},
  { label: "Contact card — NOKIA CARE · 123", run: async () => {
      await k("select"); await sleep(2800);
  }},
  { label: "The C key backs out of any screen", run: async () => {
      await k("end"); await k("end", 520);
  }},

  { label: "Messages — Inbox / Outbox / Write", run: async () => {
      await toMenu(); await k("down"); await k("select"); await sleep(2300);
  }},
  { label: "Outbox — reading a sent SMS", run: async () => {
      await k("down"); await k("select"); await k("select"); await sleep(3100);
  }},
  { label: "Back to the menu", run: async () => {
      await k("end"); await k("end"); await k("end", 520);
  }},

  { label: "Call registration — missed / received / dialed", run: async () => {
      await toMenu(); await k("down"); await k("down"); await k("select"); await sleep(2600); await k("end", 520);
  }},

  { label: "Games — Snake II & Bounce", run: async () => {
      await toMenu(); await k("down"); await k("down"); await k("down"); await k("select"); await sleep(1900);
  }},
  { label: "Snake II — the immortal game (walls kill!)", run: async () => {
      if ((S.screen && S.screen.name) !== "games") {
        await toMenu(); for (let i = 0; i < 3; i++) await k("down"); await k("select");
      }
      await k("select"); await sleep(750);           // snake screen, "PRESS OK TO START"
      await handleKey("right"); await sleep(350);    // start (moving right)
      // gentle rectangle in the middle of the field — no wall, no self-hit
      for (const [d, ms] of [["up", 720], ["right", 720], ["down", 720], ["left", 720]]) {
        await handleKey(d); await sleep(ms);
      }
      await sleep(500);
      await handleKey("end"); await sleep(450);      // "Quit Snake?" (or straight to games if over)
      if (DLG.active) { await handleKey("select"); await sleep(520); }  // Yes -> games list
  }},
  { label: "Bounce — keep the ball alive", run: async () => {
      if ((S.screen && S.screen.name) !== "games") {
        await toMenu(); for (let i = 0; i < 3; i++) await k("down"); await k("select");
      }
      // The games list always re-enters with Snake II highlighted (row 1), so
      // step down to Bounce (row 2) first — otherwise this step replays Snake.
      await k("down", 300);
      await k("select"); await sleep(750);            // bounce screen
      await handleKey("left"); await sleep(300);      // start playing
      await sleep(2100);                              // let the ball fly
      await handleKey("end"); await sleep(450);       // "Quit Bounce?" (or straight to games if over)
      if (DLG.active) { await handleKey("select"); await sleep(520); }  // Yes -> games list
      await k("end", 560);                            // games -> menu
  }},

  { label: "Calculator — 7 + 8 = 15", run: async () => {
      await toMenu(); await k("down"); await k("down"); await k("down"); await k("down");
      await k("select"); await sleep(600);             // calc screen
      await k("7"); await k("up"); await k("8"); await k("select");
      await sleep(2500);
      await k("end"); await k("end", 560);             // C clear, then exit to menu
  }},

  { label: "Clock & alarms — adjusting the time", run: async () => {
      await toMenu();
      for (let i = 0; i < 5; i++) await k("down");
      await k("select"); await sleep(650);             // clocks -> Set clock
      await k("right"); await k("up"); await k("right"); await k("right"); await k("up");
      await handleKey("select"); await sleep(1500);    // OK -> "Clock set to …" dialog
      await handleKey("select"); await sleep(600);     // close dialog (on clocks list)
      await k("end", 560);                             // clocks -> menu
  }},

  { label: "Settings — and the glossy colour shells", run: async () => {
      await toMenu();
      for (let i = 0; i < 6; i++) await k("down");
      await k("select"); await sleep(1400);            // settings list
      applyTheme("green"); await sleep(1900);
      applyTheme("yellow"); await sleep(1900);
      applyTheme("blue"); await sleep(1000);
      await k("end", 560);                             // settings -> menu
  }},

  { label: "Standby — and the tour loops again", run: async () => {
      await toMenu(); await k("end"); await sleep(2800);
  }},
];
DemoTour.total = STEPS.length;

async function runTour() {
  DemoTour.running = true;
  let i = 0;
  while (true) {
    const step = STEPS[i % STEPS.length];
    DemoTour.stepIndex = i % STEPS.length;
    DemoTour.lastLabel = step.label;
    cap(step.label);
    stepBadge((i % STEPS.length) + 1, STEPS.length);
    try { await step.run(); }
    catch (e) {
      console.error("demo-tour step failed:", e);
      cap("Demo hiccup — recovering…");
      await sleep(1600);
    }
    i++;
    // after each full cycle, skip the power-on + standby beats (toMenu()
    // re-powers the phone if a user switched it off in the meantime)
    if (i % STEPS.length === 0) i += 2;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(runTour, 900));
} else {
  setTimeout(runTour, 900);
}
