/* ============================================================
 * main.js — bootstrap: power on/off, boot sequence, input
 * binding (3-key row + keypad + keyboard), render loop,
 * keypad tones, colour-theme switching.
 *
 * Key model (MIN-40 — single centre option):
 *   select  = centre Navi button — the ONLY general-purpose key. Its function is
 *             shown as a single label at the BOTTOM-CENTRE of the display
 *             (e.g. "Menu", "Open", "Call"). This is the sole button choice any
 *             screen offers; there are no phantom left/right soft-key labels.
 *   softL   = C key — FIXED function: implicit clear / back / cancel, never labelled.
 *   softR   = scroll rocker — FIXED function: up/down scroll; HOLD = power off.
 *   up/down/left/right  -> list scroll & game input (keyboard arrows)
 *   end/c               -> keyboard aliases for the C key (Esc, R, Backspace)
 * ============================================================ */
"use strict";

const Main = {
  lastFrame: 0,
  bootUntil: 0,
  standbyTimer: null,
};

/* Held-state for directional keys (drives continuous game input like Bounce). */
const KEYS = { up: false, down: false, left: false, right: false };
function isDir(key) { return key === "up" || key === "down" || key === "left" || key === "right"; }

/* ---------------- power / boot ---------------- */
function powerOff() {
  S.power = "off";
  S.call = null;
  Audio3310.stopRinging();
  try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
  if (S.screen && S.screen.exit) { try { S.screen.exit(); } catch (e) {} }
  S.screen = null;
  dirty();
}

function powerOn() {
  if (S.power === "on" || S.power === "boot") return;
  Audio3310.ensure();
  Audio3310.nokiaTune();
  S.power = "boot";
  Main.bootUntil = Date.now() + 2100;
  dirty();
}

function finishBoot() {
  S.power = "on";
  go("standby");
  startStandbyTicker();
}

/* ---------------- standby clock ticker ---------------- */
function startStandbyTicker() {
  if (Main.standbyTimer) clearInterval(Main.standbyTimer);
  Main.standbyTimer = setInterval(() => {
    if (S.power === "on" && S.screen && S.screen.name === "standby" && !DLG.active) dirty();
  }, 1000);
}

/* ---------------- key tones ---------------- */
function keyTone(kind) {
  const st = S.data.settings;
  if (!st || !st.keypadTone) return;
  try {
    if (kind === "key") Audio3310.key();
    else if (kind === "select") Audio3310.select();
    else if (kind === "back") Audio3310.back();
  } catch (e) {}
}

/* ---------------- dialog routing ---------------- */
function dialogKey(key) {
  const d = DLG.active;
  if (!d) return false;
  // Centre Navi key = the primary action (first button, e.g. "Yes" / "OK").
  if (key === "select" || key === "enter") {
    const btn = d.buttons[0];
    Audio3310.select();
    closeDialog();
    if (btn && btn.action) { try { btn.action(); } catch (e) {} }
    return true;
  }
  // C key = implicit cancel/back → second button (e.g. "No") when present, else just dismiss.
  if (key === "softL" || key === "end" || key === "c") {
    const btn = d.buttons.length > 1 ? d.buttons[1] : null;
    Audio3310.back();
    closeDialog();
    if (btn && btn.action) { try { btn.action(); } catch (e) {} }
    return true;
  }
  // Scroll rocker (softR) has no role in a dialog.
  return false;
}

/* ---------------- central key dispatch ---------------- */
function handleKey(key) {
  if (S.power === "off") { powerOn(); return; } // any key wakes the phone
  if (S.power === "boot") return;                // ignore keys during boot

  if (DLG.active) { dialogKey(key); return; }

  const scr = S.screen;
  if (!scr) return;

  // key tones for keypad / select / back (not during games that play their own SFX)
  if (key === "select" || key === "enter") keyTone("select");
  else if (key === "softL" || key === "end" || key === "c") keyTone("back");
  else if (/^[0-9*#]$/.test(key)) keyTone("key");

  try { scr.onKey && scr.onKey(key); } catch (e) { console.error(e); }
}

/* ---------------- hold-to-power on the scroll rocker ---------------- */
let rHoldTimer = null;
let rHeld = false;
function rDown() {
  if (S.power === "off") { powerOn(); return; } // tap when dark = power on
  if (S.power !== "on") return;                  // during boot: ignore
  rHeld = true;
  rHoldTimer = setTimeout(() => {
    rHeld = false;
    Audio3310.back();
    try { Audio3310.vibrate && navigator.vibrate([60, 40, 60]); } catch (e) {}
    powerOff();
  }, 900);
}
function rUp() {
  if (rHoldTimer) { clearTimeout(rHoldTimer); rHoldTimer = null; }
  if (rHeld) { rHeld = false; handleKey("softR"); } // short press = scroll rocker
}

/* ---------------- input binding ---------------- */
function bindButtons() {
  document.querySelectorAll("[data-key]").forEach((btn) => {
    const key = btn.getAttribute("data-key");
    if (key === "softR") {
      // right soft key: short press = softR action, hold >=900ms = power off
      btn.addEventListener("pointerdown", (e) => { e.preventDefault(); rDown(); });
      const up = (e) => { if (e && e.preventDefault) e.preventDefault(); rUp(); };
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("pointerleave", () => { if (rHoldTimer) { clearTimeout(rHoldTimer); rHoldTimer = null; } rHeld = false; });
      return;
    }
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); handleKey(key); });
  });
}

const KEYMAP = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Enter: "select", " ": "select",
  a: "softL", l: "softR", A: "softL", L: "softR",
  r: "end", R: "end",
  Backspace: "end", Delete: "end", Escape: "end",
};
function bindKeyboard() {
  let kbEndDown = false, kbEndTimer = null;
  window.addEventListener("keydown", (e) => {
    let key = null;
    if (KEYMAP[e.key] != null) key = KEYMAP[e.key];
    else if (/^[0-9*#]$/.test(e.key)) key = e.key;
    if (!key) return;
    e.preventDefault();

    // track held directional keys for continuous game input
    if (isDir(key)) {
      KEYS[key] = true;
      if (!e.repeat) handleKey(key);
      return;
    }
    if (e.repeat) return; // block auto-repeat for discrete keys

    if (key === "end") {
      if (S.power !== "on") { handleKey("end"); return; }
      if (!kbEndDown) {
        kbEndDown = true;
        kbEndTimer = setTimeout(() => {
          kbEndDown = false; clearTimeout(kbEndTimer); kbEndTimer = null;
          Audio3310.back(); powerOff();
        }, 900);
      }
      return;
    }
    handleKey(key);
  });
  window.addEventListener("keyup", (e) => {
    let key = null;
    if (KEYMAP[e.key] != null) key = KEYMAP[e.key];
    if (key && isDir(key)) KEYS[key] = false;
    // any quick release of an "end"-mapped key (r/R, Esc, Backspace, Delete)
    // cancels the hold-to-power-off timer and acts as a single back/clear press
    if (key === "end" && kbEndDown) {
      kbEndDown = false;
      if (kbEndTimer) { clearTimeout(kbEndTimer); kbEndTimer = null; handleKey("end"); }
    }
  });
}

/* ---------------- colour themes ---------------- */
function applyTheme(name) {
  const phone = document.getElementById("phone");
  if (!phone) return;
  phone.setAttribute("data-theme", name);
  const sw = document.querySelectorAll(".swatch");
  sw.forEach((s) => s.classList.toggle("sel", s.getAttribute("data-c") === name));
  try { localStorage.setItem("n3310_theme", name); } catch (e) {}
}
function bindPalette() {
  document.querySelectorAll("#palette .swatch").forEach((s) => {
    s.addEventListener("click", () => applyTheme(s.getAttribute("data-c")));
  });
  let saved = null;
  try { saved = localStorage.getItem("n3310_theme"); } catch (e) {}
  if (saved) applyTheme(saved);
}

/* ---------------- render loop ---------------- */
function drawFrame() {
  clear();
  if (S.power === "off") {
    // dark, unlit LCD
    g.fillStyle = "#0c120b";
    g.fillRect(0, 0, LCD.W, LCD.H);
    return;
  }
  if (S.power === "boot") {
    drawBoot();
    if (Date.now() >= Main.bootUntil) finishBoot();
    return;
  }
  if (DLG.active) {
    if (S.screen && S.screen.draw) S.screen.draw(); // dim base under dialog
    drawDialog();
  } else if (S.screen && S.screen.draw) {
    S.screen.draw();
  }
}

function loop(ts) {
  const dt = Main.lastFrame ? ts - Main.lastFrame : 16;
  Main.lastFrame = ts;

  let animate = false;
  if (S.power === "on" && !DLG.active && S.screen && S.screen.update) {
    try { animate = !!S.screen.update(dt); } catch (e) { console.error(e); }
  }
  // boot must draw every frame so the progress bar animates and finishBoot() runs
  if (S.power === "boot" || takeDirty() || animate) drawFrame();

  requestAnimationFrame(loop);
}

/* ---------------- boot + dialog drawing ---------------- */
function drawBoot() {
  clear();
  const t = (Date.now() - (Main.bootUntil - 2100)) / 2100; // 0..1
  textC("NOKIA", 8);
  textC("3310", 20);
  // progress bar
  hollowRect(22, 34, 40, 8);
  const w = Math.floor(38 * Math.min(1, t));
  if (w > 0) rect(23, 35, w, 6);
}

function drawDialog() {
  const d = DLG.active;
  // translucent dark band behind dialog to lift it off the base screen
  g.fillStyle = "rgba(185,196,171,0.55)";
  g.fillRect(0, 0, LCD.W, LCD.H);

  const boxW = 76, boxH = 34;
  const bx = Math.floor((LCD.W - boxW) / 2), by = 6;
  rect(bx - 1, by - 1, boxW + 2, boxH + 2);          // outer (dark border)
  g.fillStyle = BG; g.fillRect(bx, by, boxW, boxH);   // inner fill
  hollowRect(bx, by, boxW, boxH);

  let ty = by + 3;
  if (d.icon && ICONS[d.icon]) { icon(d.icon, bx + 4, ty); }
  const tx = d.icon ? bx + 14 : bx + 4;
  // wrap text into lines of ~20 chars
  const words = String(d.text || "").split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 20 && cur) { lines.push(cur.trim()); cur = w; }
    else cur = (cur ? cur + " " : "") + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const maxLines = 4;
  for (let i = 0; i < Math.min(maxLines, lines.length); i++) text(lines[i], tx, ty + i * 8);

  // Soft-key row: ONE centre label — the primary action (first button).
  // A second button is the implicit C-key cancel and is never drawn as a corner label.
  if (d.buttons.length && d.buttons[0].label) textC(d.buttons[0].label, LCD.H - 7);
}

/* ---------------- init ---------------- */
function init() {
  load();
  bindButtons();
  bindKeyboard();
  bindPalette();
  S.power = "off";
  dirty();
  requestAnimationFrame(loop);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
