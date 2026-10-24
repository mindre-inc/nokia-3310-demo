/* ============================================================
 * screens.js — all phone UI screens: standby, menu, phonebook,
 * messages, call registration, calculator, clock/alarms,
 * settings/profiles, dialer, and the active-call screen.
 * Built on lcd.js (draw helpers) + state.js (registry/dialogs).
 *
 * Parameterized screens store their argument in a module-level
 * "current" variable set by enter(...args), since go() invokes
 * enter() before draw()/onKey() run.
 * ============================================================ */
"use strict";

/* ---------------- shared: status bar (signal + battery) ---------------- */
function statusBar() {
  signalBars(1, 1, S.signal);
  batteryIcon(LCD.W - 10, 1, S.data.battery);
}

/* ---------------- text wrap helper ---------------- */
function wrapText(str, max) {
  const words = String(str).split(/\s+/);
  const lines = []; let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur.trim()); cur = w; }
    else cur = (cur ? cur + " " : "") + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.length ? lines : [""];
}

/* ============================================================
 * Generic scrolling list screen
 * items: [{ icon?, label, sub?, action }]
 * opts:  { name, title, navi, onBack }
 *
 * Soft-key model (MIN-40 — single centre option): the Navi/select key —
 * the CENTRE button under the display — is the ONLY general-purpose key,
 * and its function is shown as a single label at the BOTTOM-CENTRE. That
 * is the only "button alternative" a screen offers. The C key backs out /
 * clears (implicit, never labelled); the scroll rocker scrolls (implicit).
 * ============================================================ */
function makeList(opts) {
  const st = { idx: 0, top: 0 };
  const rowsVisible = 4;
  function items() { return typeof opts.items === "function" ? opts.items() : opts.items; }
  function clamp() {
    const n = items().length;
    if (st.idx < 0) st.idx = 0;
    if (n && st.idx >= n) st.idx = n - 1;
    if (st.top > st.idx) st.top = st.idx;
    if (st.idx >= st.top + rowsVisible) st.top = st.idx - rowsVisible + 1;
  }
  // Soft-key row: ONE centre label only — the Navi/select action.
  const naviLabel = opts.navi || "Open";                // centre button → open highlighted item
  return {
    name: opts.name,
    enter() { st.idx = opts.start || 0; st.top = 0; clamp(); },
    draw() {
      clear(); statusBar(); titleBar(opts.title);
      const list = items(), y0 = 10, rh = 8;
      if (!list.length) { textC("(empty)", 20); }
      for (let r = 0; r < rowsVisible; r++) {
        const i = st.top + r;
        if (i >= list.length) break;
        const it = list[i], sel = i === st.idx, y = y0 + r * rh;
        if (sel) rect(0, y - 1, LCD.W, rh);
        let tx = 2;
        if (it.icon && ICONS[it.icon]) { withInv(() => icon(it.icon, 3, y)); tx = 13; }
        if (sel) withInv(() => text(it.label, tx, y)); else text(it.label, tx, y);
        if (it.sub) {
          const sw = textWidth(it.sub);
          if (sel) withInv(() => text(it.sub, LCD.W - sw - 2, y));
          else text(it.sub, LCD.W - sw - 2, y);
        }
      }
      softRow(naviLabel);
    },
    onKey(key) {
      const list = items(), n = list.length;
      if (key === "up") { st.idx--; clamp(); Audio3310.tick(); dirty(); return; }
      if (key === "down") { st.idx++; clamp(); Audio3310.tick(); dirty(); return; }
      // Scroll rocker (fixed-function): short press steps down one row.
      if (key === "softR") { if (n > 1) { st.idx++; clamp(); Audio3310.tick(); dirty(); } return; }
      // Centre Navi button = the single bottom-centre choice: open the highlighted item.
      if (key === "select" || key === "enter") {
        const it = list[st.idx]; Audio3310.select();
        if (it && it.action) it.action();
        return;
      }
      // C key / end / c = implicit back out one level.
      if (key === "softL" || key === "end" || key === "c") {
        Audio3310.back();
        if (opts.onBack) opts.onBack(); else go("menu");
        return;
      }
    },
  };
}

/* ============================================================
 * STANDBY — clock, date, signal, battery
 * Single centre option: "Menu". C key = implicit (no-op on standby).
 * ============================================================ */
registerScreen("standby", {
  name: "standby",
  draw() {
    clear(); statusBar();
    const d = nowDate();
    textC(fmtTime(d), 12);
    textC(fmtDate(d), 24);
    softRow("Menu");
  },
  onKey(key) {
    if (key === "select" || key === "enter") { Audio3310.select(); go("menu"); return; }
    // C key on standby: nothing to clear, nowhere to back out — no-op.
    if (/^[0-9*#]$/.test(key)) { Audio3310.key(); go("dialer", key); return; }
  },
});

/* ============================================================
 * MAIN MENU
 * ============================================================ */
registerScreen("menu", makeList({
  name: "menu", title: "Menu", navi: "Select",
  onBack: () => go("standby"),
  items: [
    { icon: "person",    label: "Phonebook",         action: () => go("phonebook") },
    { icon: "envelope",  label: "Messages",          action: () => go("messages") },
    { icon: "handset",   label: "Call reg.",         action: () => go("callreg") },
    { icon: "gamepad",   label: "Games",             action: () => go("games") },
    { icon: "calc",      label: "Calculator",        action: () => go("calc") },
    { icon: "clockface", label: "Clock & alarms",    action: () => go("clocks") },
    { icon: "gear",      label: "Settings",          action: () => go("settings") },
  ],
}));

/* ============================================================
 * PHONEBOOK — list / view / add
 * "New contact" is a plain list item (single centre option model).
 * ============================================================ */
registerScreen("phonebook", makeList({
  name: "phonebook", title: "Phonebook", navi: "Open",
  onBack: () => go("menu"),
  items: () => [
    ...S.data.phonebook.map((p) => ({ icon: "person", label: p.name, action: () => go("pb_view", p) })),
    { icon: "person", label: "New contact", action: () => go("pb_add") },
  ],
}));

let __pbEntry = null, __pbSel = 0;
registerScreen("pb_view", {
  name: "pb_view",
  enter(e) { __pbEntry = e; __pbSel = 0; },
  draw() {
    const e = __pbEntry; if (!e) return;
    clear(); statusBar(); titleBar("Contact");
    // row 0 — the contact (centre key: Call)
    let y = 12, sel = (__pbSel === 0);
    if (sel) rect(0, y - 1, LCD.W, 8);
    icon("person", 3, y);
    if (sel) withInv(() => text(e.name, 14, y)); else text(e.name, 14, y);
    // info line — the number
    text("Number " + e.number, 2, 22);
    // row 1 — delete (centre key: Delete)
    y = 32; sel = (__pbSel === 1);
    if (sel) rect(0, y - 1, LCD.W, 8);
    icon("cross", 3, y);
    if (sel) withInv(() => text("Delete", 14, y)); else text("Delete", 14, y);
    // ONE centre label — the action of the highlighted row
    softRow(__pbSel === 0 ? "Call" : "Delete");
  },
  onKey(key) {
    const e = __pbEntry; if (!e) return;
    if (key === "up" || key === "down") { __pbSel = (__pbSel + 1) % 2; Audio3310.tick(); dirty(); return; }
    if (key === "softR") { __pbSel = (__pbSel + 1) % 2; Audio3310.tick(); dirty(); return; }
    // Centre Navi key = the single bottom-centre choice.
    if (key === "select" || key === "enter") {
      Audio3310.select();
      if (__pbSel === 0) go("dialer", e.number);
      else dialog({ text: "Delete this contact?", icon: "cross", buttons: [
        { label: "Yes", action: () => { S.data.phonebook = S.data.phonebook.filter((p) => p !== e); save(); go("phonebook"); } },
        { label: "No" },
      ]});
      return;
    }
    // C key = implicit back to the phonebook list.
    if (key === "softL" || key === "end" || key === "c") { Audio3310.back(); go("phonebook"); return; }
  },
});

let __pbStage = "name", __pbName = "", __pbNumber = "", __pbField = null;
registerScreen("pb_add", {
  name: "pb_add",
  enter() { __pbStage = "name"; __pbName = ""; __pbNumber = ""; __pbField = makeField(""); },
  draw() {
    clear(); statusBar();
    titleBar(__pbStage === "name" ? "New: Name" : "New: Number");
    const cur = __pbStage === "name" ? __pbField.display() : __pbNumber;
    text(cur + "_", 2, 14);
    if (__pbStage === "name") text("multi-tap letters", 2, 30);
    else text("digits only", 2, 30);
    softRow(__pbStage === "name" ? "OK" : "Save");
  },
  onKey(key) {
    if (key === "select" || key === "enter") {
      Audio3310.select();
      if (__pbStage === "name") {
        __pbField.commit();
        if (!__pbField.val.trim()) { dialog({ text: "Name is empty." }); return; }
        __pbName = __pbField.val.trim().toUpperCase();
        __pbStage = "number"; dirty(); return;
      }
      S.data.phonebook.push({ name: __pbName, number: __pbNumber.trim() });
      save(); Audio3310.win(); go("phonebook"); return;
    }
    if (key === "softL" || key === "end" || key === "c") {
      // C key = implicit clear: delete last char; once empty, back out.
      if (__pbStage === "name") {
        if ((__pbField.val + __pbField.pending).length) { __pbField.press("end"); dirty(); }
        else { Audio3310.back(); go("phonebook"); }
        return;
      }
      if (__pbNumber.length) { __pbNumber = __pbNumber.slice(0, -1); Audio3310.back(); dirty(); }
      else { Audio3310.back(); go("phonebook"); }
      return;
    }
    if (__pbStage === "name") {
      // multi-tap T9 entry (2-9 letters, 0 space, * symbols)
      if (/^[0-9*]$/.test(key) && __pbField.press(key)) { Audio3310.tick(); dirty(); }
    } else {
      if (/^[0-9*#+ ]$/.test(key)) { keyTone("key"); __pbNumber += key; dirty(); }
    }
  },
});

/* ============================================================
 * MESSAGES — inbox / outbox / compose / view
 * ============================================================ */
registerScreen("messages", makeList({
  name: "messages", title: "Messages", navi: "Open",
  onBack: () => go("menu"),
  items: [
    { icon: "envelope", label: "Inbox", sub: String(S.data.inbox.length), action: () => go("msg_list", "inbox") },
    { icon: "envelope", label: "Outbox", sub: String(S.data.outbox.length), action: () => go("msg_list", "outbox") },
    { icon: "chat", label: "Write message", action: () => go("msg_compose") },
  ],
}));

let __msgBox = "inbox";
registerScreen("msg_list", makeList({
  name: "msg_list", title: "Messages", navi: "Open",
  onBack: () => go("messages"),
  enter(box) { __msgBox = box || "inbox"; },
  items: () => S.data[__msgBox].map((m, i) => ({
    icon: m.unread ? "chat" : "envelope",
    label: (m.to || "FROM") + " #" + (i + 1),
    action: () => go("msg_view", __msgBox, m),
  })),
}));

let __msgView = null;
registerScreen("msg_view", {
  name: "msg_view",
  enter(box, m) { __msgView = { box: box || "inbox", m }; if (m && m.unread) { m.unread = false; save(); } },
  draw() {
    const v = __msgView; const m = (v && v.m) || {};
    clear(); statusBar(); titleBar((v && v.box) === "outbox" ? "Outbox" : "Inbox");
    text(String(m.to || ""), 2, 10);
    const lines = wrapText(m.body || "", 20);
    for (let i = 0; i < lines.length && i < 3; i++) text(lines[i], 2, 18 + i * 8);
    // no soft-key row: C key implicitly backs out to the list
  },
  onKey(key) {
    if (key === "end" || key === "c" || key === "softL") { Audio3310.back(); go("msg_list", __msgView ? __msgView.box : "inbox"); return; }
  },
});

let __mcStage = "to", __mcTo = "", __mcBody = "", __mcField = null;
registerScreen("msg_compose", {
  name: "msg_compose",
  enter() { __mcStage = "to"; __mcTo = ""; __mcBody = ""; __mcField = makeField(""); },
  draw() {
    clear(); statusBar();
    titleBar(__mcStage === "to" ? "To:" : "Message");
    const cur = __mcStage === "to" ? __mcTo : __mcField.display();
    text(cur + "_", 2, 14);
    if (__mcStage === "body") text("multi-tap letters", 2, 30);
    softRow(__mcStage === "to" ? "OK" : "Send");
  },
  onKey(key) {
    if (key === "select" || key === "enter") {
      Audio3310.select();
      if (__mcStage === "to") {
        if (!__mcTo) { dialog({ text: "Enter a number." }); return; }
        __mcStage = "body"; dirty(); return;
      }
      __mcField.commit();
      S.data.outbox.push({ to: __mcTo, body: __mcField.val.trim() || "(empty)", time: Date.now() });
      save(); Audio3310.win(); go("messages"); return;
    }
    if (key === "softL" || key === "end" || key === "c") {
      // C key = implicit clear/back cascade.
      if (__mcStage === "body") {
        if ((__mcField.val + __mcField.pending).length) { __mcField.press("end"); dirty(); return; }
        Audio3310.back(); __mcStage = "to"; dirty(); return; // body empty → step back to To:
      }
      if (__mcTo.length) { __mcTo = __mcTo.slice(0, -1); Audio3310.back(); dirty(); return; }
      Audio3310.back(); go("messages"); return;
    }
    if (__mcStage === "to") {
      if (/^[0-9*#+ ]$/.test(key)) { keyTone("key"); __mcTo += key; dirty(); }
    } else {
      // multi-tap T9 entry (2-9 letters, 0 space, * symbols)
      if (/^[0-9*]$/.test(key) && __mcField.press(key)) { Audio3310.tick(); dirty(); }
    }
  },
});

/* ============================================================
 * CALL REGISTRATION — missed / received / dialed
 * ============================================================ */
registerScreen("callreg", makeList({
  name: "callreg", title: "Call reg.", navi: "Open",
  onBack: () => go("menu"),
  items: [
    { icon: "handset", label: "Missed calls", sub: String(S.data.callreg.missed.length), action: () => go("cr_list", "missed") },
    { icon: "handset", label: "Received", sub: String(S.data.callreg.received.length), action: () => go("cr_list", "received") },
    { icon: "handset", label: "Dialed", sub: String(S.data.callreg.dialed.length), action: () => go("cr_list", "dialed") },
  ],
}));

let __crKind = "missed";
registerScreen("cr_list", makeList({
  name: "cr_list", title: "Calls", navi: "Redial",
  onBack: () => go("callreg"),
  enter(kind) { __crKind = kind || "missed"; },
  items: () => S.data.callreg[__crKind].map((c) => ({ icon: "handset", label: c.number, sub: c.time ? fmtDate(new Date(c.time)).slice(0, 10) : "", action: () => go("dialer", c.number) })),
}));

/* ============================================================
 * CALCULATOR — + - x / with direct entry
 * ============================================================ */
const __calc = { a: null, op: null, b: "", fresh: true };
function calcApply() {
  if (__calc.op == null) return;
  const x = parseFloat(__calc.a), y = parseFloat(__calc.b || "0");
  let r = NaN;
  if (__calc.op === "+") r = x + y; else if (__calc.op === "-") r = x - y;
  else if (__calc.op === "x") r = x * y; else if (__calc.op === "/") r = y === 0 ? NaN : x / y;
  __calc.a = isFinite(r) ? String(Math.round(r * 10000) / 10000) : "ERR";
  __calc.op = null; __calc.b = ""; __calc.fresh = true;
}
registerScreen("calc", {
  name: "calc",
  enter() { __calc.a = null; __calc.op = null; __calc.b = ""; __calc.fresh = true; },
  draw() {
    clear(); statusBar(); titleBar("Calc");
    const disp = __calc.op != null ? (__calc.a + " " + __calc.op + (__calc.b ? " " + __calc.b : "")) : (__calc.a != null ? __calc.a : "0");
    text(String(disp).slice(-18), 2, 16);
    softRow("=");
  },
  onKey(key) {
    if (key === "select" || key === "enter") { Audio3310.select(); calcApply(); dirty(); return; }
    if (key === "softL" || key === "end" || key === "c") {
      // C key = implicit clear; pressing C again from a cleared display exits to Menu
      if (__calc.a == null && __calc.op == null && __calc.b === "") { Audio3310.back(); go("menu"); return; }
      __calc.a = null; __calc.op = null; __calc.b = ""; __calc.fresh = true; Audio3310.back(); dirty(); return;
    }
    if (/^[0-9.]$/.test(key)) {
      keyTone("key");
      if (__calc.op != null) {
        __calc.b += key; // building the second operand
      } else {
        __calc.a = (__calc.fresh ? "" : __calc.a) + key; // building the first operand
        __calc.fresh = false;
      }
      dirty(); return;
    }
    if (key === "up") { __calc.op = "+"; Audio3310.select(); dirty(); return; }
    if (key === "down") { __calc.op = "-"; Audio3310.select(); dirty(); return; }
    if (key === "left") { __calc.op = "x"; Audio3310.select(); dirty(); return; }
    if (key === "right") { __calc.op = "/"; Audio3310.select(); dirty(); return; }
  },
});

/* ============================================================
 * CLOCK & ALARMS — set time / alarm / reminders
 * ============================================================ */
registerScreen("clocks", makeList({
  name: "clocks", title: "Clock & alarms", navi: "Open",
  onBack: () => go("menu"),
  items: [
    { icon: "clockface", label: "Set clock", action: () => go("set_clock") },
    { icon: "alarm", label: S.data.alarm.on ? "Alarm ON" : "Alarm OFF", sub: S.data.alarm.time, action: () => { S.data.alarm.on = !S.data.alarm.on; save(); Audio3310.select(); dialog({ text: "Alarm " + (S.data.alarm.on ? "ON at " + S.data.alarm.time : "OFF"), icon: S.data.alarm.on ? "alarm" : "cross" }); } },
    { icon: "bell", label: "Reminders", sub: String(S.data.reminders.length), action: () => go("reminders") },
  ],
}));

let __clkVal = "", __clkPos = 0;
registerScreen("set_clock", {
  name: "set_clock",
  enter() { __clkVal = fmtTime(nowDate()).replace(" ", ""); __clkPos = 0; },
  draw() {
    clear(); statusBar(); titleBar("Set clock");
    textC(__clkVal.slice(0, __clkPos) + "_" + __clkVal.slice(__clkPos), 16);
    textC("L/R move - U/D change", 30);
    softRow("OK");
  },
  onKey(key) {
    if (key === "select" || key === "enter") {
      Audio3310.select(); S.data.settings.timeOverride = __clkVal; S.data.settings.autoSync = false; save();
      dialog({ text: "Clock set to " + __clkVal, icon: "check" }); go("clocks"); return;
    }
    if (key === "softL" || key === "end" || key === "c") { Audio3310.back(); go("clocks"); return; }
    if (key === "left") { __clkPos = Math.max(0, __clkPos - 1); dirty(); return; }
    if (key === "right") { __clkPos = Math.min(__clkVal.length - 1, __clkPos + 1); dirty(); return; }
    const ch = __clkVal[__clkPos];
    if ((key === "up" || key === "down") && /[0-9]/.test(ch)) {
      let n = parseInt(ch) + (key === "up" ? 1 : -1);
      const max = __clkPos < 2 ? 23 : 59;
      n = ((n % (max + 1)) + (max + 1)) % (max + 1);
      __clkVal = __clkVal.slice(0, __clkPos) + String(n).padStart(2, "0") + __clkVal.slice(__clkPos + 1);
      Audio3310.tick(); dirty(); return;
    }
  },
});

registerScreen("reminders", makeList({
  name: "reminders", title: "Reminders", navi: "Open",
  onBack: () => go("clocks"),
  items: [
    ...S.data.reminders.map((r) => ({ icon: "bell", label: r.time + " " + (r.text || "").slice(0, 8), sub: r.fired ? "done" : "" })),
    { icon: "bell", label: "New reminder", action: () => go("rem_add") },
    { icon: "cross", label: "Clear all", action: () => { S.data.reminders = []; save(); dialog({ text: "Reminders cleared", icon: "check" }); } },
  ],
}));

let __remVal = "";
registerScreen("rem_add", {
  name: "rem_add",
  enter() { __remVal = ""; },
  draw() { clear(); statusBar(); titleBar("Reminder time"); text(__remVal + "_", 2, 14); softRow("Save"); },
  onKey(key) {
    if (key === "select" || key === "enter") {
      Audio3310.select();
      const m = /^([0-2][0-9]):([0-5][0-9])$/.exec(__remVal.trim());
      if (!m) { dialog({ text: "Use HH:MM (e.g. 07:30)." }); return; }
      S.data.reminders.push({ time: __remVal.trim(), text: "", fired: false }); save();
      dialog({ text: "Reminder set", icon: "check" }); go("clocks"); return;
    }
    if (key === "softL" || key === "end" || key === "c") {
      // C key = implicit clear: delete last char; once empty, back out.
      if (__remVal.length) { __remVal = __remVal.slice(0, -1); Audio3310.back(); dirty(); return; }
      Audio3310.back(); go("clocks"); return;
    }
    if (/^[0-9:]$/.test(key)) { keyTone("key"); __remVal += key; dirty(); }
  },
});

/* ============================================================
 * SETTINGS — profiles, ringtone, tones, etc.
 * ============================================================ */
registerScreen("settings", makeList({
  name: "settings", title: "Settings", navi: "Open",
  onBack: () => go("menu"),
  items: [
    { icon: "profile", label: "Profiles", sub: S.data.settings.profile, action: () => go("profiles") },
    { icon: "note", label: "Ringtone", sub: (S.data.settings.ringtone || "").slice(0, 10), action: () => go("ringtone") },
    { icon: "speaker", label: "Keypad tones", sub: S.data.settings.keypadTone ? "On" : "Off", action: () => { S.data.settings.keypadTone = !S.data.settings.keypadTone; save(); Audio3310.select(); } },
    { icon: "bell", label: "Vibrate alert", sub: S.data.settings.vibrateAlert ? "On" : "Off", action: () => { S.data.settings.vibrateAlert = !S.data.settings.vibrateAlert; save(); Audio3310.select(); } },
    { icon: "clockface", label: "Clock format", sub: S.data.settings.clockFormat, action: () => { S.data.settings.clockFormat = S.data.settings.clockFormat === "24h" ? "12h" : "24h"; save(); Audio3310.select(); } },
  ],
}));

registerScreen("profiles", makeList({
  name: "profiles", title: "Profiles", navi: "Set",
  onBack: () => go("settings"),
  items: [
    { icon: "bell", label: "Normal", sub: S.data.settings.profile === "normal" ? "*" : "", action: () => { S.data.settings.profile = "normal"; save(); Audio3310.select(); dialog({ text: "Profile: Normal", icon: "check" }); } },
    { icon: "cross", label: "Silent", sub: S.data.settings.profile === "silent" ? "*" : "", action: () => { S.data.settings.profile = "silent"; save(); Audio3310.select(); dialog({ text: "Profile: Silent", icon: "check" }); } },
    { icon: "speaker", label: "Loud", sub: S.data.settings.profile === "loud" ? "*" : "", action: () => { S.data.settings.profile = "loud"; save(); Audio3310.select(); dialog({ text: "Profile: Loud", icon: "check" }); } },
  ],
}));

registerScreen("ringtone", makeList({
  name: "ringtone", title: "Ringtone", navi: "Try",
  onBack: () => go("settings"),
  items: Object.keys(Audio3310.RINGTONES).filter((n) => n !== "Off").map((n) => ({
    icon: "note", label: n, sub: S.data.settings.ringtone === n ? "*" : "",
    action: () => { S.data.settings.ringtone = n; save(); Audio3310.playRingtone(n, 1); setTimeout(() => Audio3310.stopRinging(), 2500); dialog({ text: "Ringtone: " + n, icon: "check" }); },
  })),
}));

/* ============================================================
 * DIALER — type number, call / clear
 * ============================================================ */
let __dialNum = "";
registerScreen("dialer", {
  name: "dialer",
  enter(initial) { __dialNum = String(initial || ""); },
  draw() {
    clear(); statusBar(); titleBar("Dial");
    text((__dialNum || "") + "_", 2, 16);
    softRow("Call");
  },
  onKey(key) {
    if (key === "select" || key === "enter") { Audio3310.select(); if (!__dialNum) { dialog({ text: "No number." }); return; } startCall(__dialNum); return; }
    // C key = implicit clear: delete last digit; once empty, back to standby.
    if (key === "softL" || key === "end" || key === "c") { if (__dialNum) __dialNum = __dialNum.slice(0, -1); else { Audio3310.back(); go("standby"); } dirty(); return; }
    if (/^[0-9*#+ ]$/.test(key)) { keyTone("key"); __dialNum += key.slice(0, 1); dirty(); return; }
  },
});

/* ---------------- simulated call ---------------- */
function startCall(number) {
  S.call = { number, state: "calling", startedAt: Date.now(), muted: false };
  go("call");
  const profile = S.data.settings.profile;
  if (profile !== "silent") Audio3310.playRingtone(S.data.settings.ringtone, 2);
  if (S.data.settings.vibrateAlert && profile !== "silent") Audio3310.vibrate([80, 60, 80]);
  setTimeout(() => {
    if (!S.call) return;
    Audio3310.stopRinging();
    S.call.state = "active";
    S.data.callreg.dialed.unshift({ number, time: Date.now() }); save();
    dirty();
  }, 2600);
}

registerScreen("call", {
  name: "call",
  draw() {
    if (!S.call) return;
    clear(); statusBar(); titleBar(S.call.state === "calling" ? "Calling" : "Call");
    icon("handset", 3, 14); text(S.call.number, 14, 14);
    if (S.call.state === "active") {
      const secs = Math.floor((Date.now() - S.call.startedAt) / 1000);
      const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
      text(mm + ":" + ss, 3, 28);
    } else { text("ringing...", 3, 28); }
    // No soft-key row: the C key implicitly ends the call.
  },
  update() { return true; }, // keep the call timer ticking
  exit() { Audio3310.stopRinging(); },
  onKey(key) {
    if (!S.call) return;
    // C key = implicit back → end the call (logged as missed while still calling).
    if (key === "softL" || key === "end" || key === "c") {
      Audio3310.back();
      if (S.call.state === "calling") S.data.callreg.missed.unshift({ number: S.call.number, time: Date.now() });
      save(); S.call = null; go("standby"); return;
    }
  },
});

/* ============================================================
 * GAMES menu (Snake + Bounce are registered in games.js)
 * ============================================================ */
registerScreen("games", makeList({
  name: "games", title: "Games", navi: "Play",
  onBack: () => go("menu"),
  items: [
    { icon: "bean", label: "Snake II", action: () => go("snake") },
    { icon: "gamepad", label: "Bounce", action: () => go("bounce") },
    { icon: "cross", label: "Exit games", action: () => go("menu") },
  ],
}));
