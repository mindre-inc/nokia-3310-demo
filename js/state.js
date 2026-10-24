/* ============================================================
 * state.js — global state, persistence, screen switching,
 * dialogs, multi-tap text input field.
 * ============================================================ */
"use strict";

const STORE_KEY = "nokia3310_emu_v2";

function defaultData() {
  return {
    phonebook: [
      { name: "NOKIA CARE", number: "123" },
      { name: "VOICE MAIL", number: "+448000788788" },
      { name: "FRIEND", number: "07700 900123" },
    ],
    inbox: [],
    outbox: [
      { to: "+447700900123", body: "HI! HOW ARE YOU?", time: Date.now() - 86400000 },
    ],
    callreg: { missed: [], received: [], dialed: [] },
    scores: {},          // game -> best score
    reminders: [],       // {time:"HH:MM", text, fired}
    alarm: { on: false, time: "07:30" },
    settings: {
      profile: "normal",
      ringtone: "Nokia Ring",
      ringVol: 3,
      keypadTone: true,
      vibrateAlert: true,
      messageAlert: true,
      warningTones: true,
      screensaver: "None",
      autoRedial: true,
      speedDialing: true,
      callWaiting: true,
      language: "English",
      cellInfo: false,
      welcomeNote: "",
      networkSel: "Automatic",
      lights: true,
      confirmSIM: true,
      pinRequest: "Off",
      secCode: "12345",
      clockFormat: "24h",
      autoSync: true,
      timeOverride: null,   // "HH:MM"
      dateOverride: null,   // "DD/MM/YYYY"
      divert: { busy: false, noReply: false, unreachable: false, unconditional: false },
      showDuration: true,
      showCosts: false,
      voicemail: "+448000788788",
    },
    battery: 100,
    myTone: null,          // composer sequence [freq,dur,...]
  };
}

const S = {
  power: "off",           // off | boot | on
  locked: false,
  screen: null,
  standbyBuf: "",
  call: null,             // {number, state:'calling'|'active', startedAt, muted, vol:3}
  signal: 4,
  data: defaultData(),
  lastMenuEnter: 0,       // for keypad-lock combo timing
  softLPressTime: 0,      // for unlock combo timing
};

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S.data)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    S.data = Object.assign(defaultData(), d);
    S.data.settings = Object.assign(defaultData().settings, d.settings || {});
    S.data.callreg = Object.assign({ missed: [], received: [], dialed: [] }, d.callreg || {});
  } catch (e) { S.data = defaultData(); }
}

/* ---------------- screen switching ---------------- */
const SCREENS = {};       // name -> screen object (registered by screens.js / games.js)
function registerScreen(name, scr) { SCREENS[name] = scr; }
function go(name, ...args) {
  const scr = SCREENS[name];
  if (!scr) return;
  S.screen = Object.assign({}, scr, { name });
  if (scr.enter) scr.enter(...args);
  dirty();
}

let _dirty = true;
function dirty() { _dirty = true; }
function takeDirty() { const d = _dirty; _dirty = false; return d; }

/* ---------------- dialog system ---------------- */
const DLG = { active: null, prev: null };
function dialog(opts) {
  // opts: { text, buttons: [{label, action}], icon? } — modal over current screen
  DLG.active = Object.assign({ icon: null, buttons: [{ label: "OK", action: null }] }, opts);
  dirty();
}
function closeDialog() { DLG.active = null; dirty(); }

/* ---------------- multi-tap text input ---------------- */
const TAPMAP = { "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ" };
const SYMS = ".,?!@()/'\"&;%-";

function makeField(initial) {
  const f = { val: String(initial || ""), pending: "", lastKey: null, lastTime: 0, symIdx: 0 };
  f.commit = () => { if (f.pending) { f.val += f.pending; f.pending = ""; } };
  f.press = (k) => {
    const now = Date.now();
    if (k === "end") {            // C key deletes
      if (f.pending) f.pending = "";
      else f.val = f.val.slice(0, -1);
      return true;
    }
    if (k === "0") { f.commit(); f.val += " "; f.lastKey = null; return true; } // space
    if (k === "*") {              // cycle symbols
      f.commit();
      f.val += SYMS[f.symIdx % SYMS.length];
      f.symIdx++; f.lastKey = null;
      return true;
    }
    if (TAPMAP[k]) {
      if (f.lastKey === k && now - f.lastTime < 1200) {
        f.pending = TAPMAP[k][(TAPMAP[k].indexOf(f.pending) + 1) % TAPMAP[k].length];
      } else {
        f.commit();
        f.pending = TAPMAP[k][0];
        f.lastKey = k;
      }
      f.lastTime = now;
      return true;
    }
    return false;
  };
  f.display = () => {
    const s = f.val + (f.pending ? f.pending : "");
    return s.slice(-LCD.W); // keep last line visible
  };
  return f;
}

/* ---------------- time helpers ---------------- */
function nowDate() {
  if (S.data.settings.autoSync || !S.data.settings.timeOverride) return new Date();
  const d = new Date();
  const [hh, mm] = S.data.settings.timeOverride.split(":").map(Number);
  if (S.data.settings.dateOverride) {
    const [dd, mo, yy] = S.data.settings.dateOverride.split("/").map(Number);
    d.setFullYear(yy, mo - 1, dd);
  }
  d.setHours(hh, mm, 0, 0);
  return d;
}
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function fmtTime(d) {
  let h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  if (S.data.settings.clockFormat === "12h") {
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${String(h).padStart(2, "0")}:${m} ${ap}`;
  }
  return `${String(h).padStart(2, "0")}:${m}`;
}
function fmtDate(d) {
  if (S.data.settings.dateOverride && !S.data.settings.autoSync) {
    const [dd, mo] = S.data.settings.dateOverride.split("/");
    return `${DAYS[d.getDay()]} ${dd}/${mo}`;
  }
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
