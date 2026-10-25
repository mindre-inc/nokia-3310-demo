# Nokia 3310 (2000) — Spinning 360° Feature Demo (MIN-35)

A standalone web demo built on the existing Nokia 3310 project (MIN-33 front-face
replica + MIN-34 long rocker). The whole phone spins a continuous 360° in a CSS-3D
scene while an auto-tour drives it through its own menus and features — so you see
the front, both sides, the back, and the bottom caps all in one loop.

## Run it

Any static file server works:

    cd nokia-3310-demo
    python3 -m http.server 8080
    # open http://localhost:8080/

Or just open `index.html` directly in a browser (no build step, no dependencies).

## What you get

- **Full 3D shell** — front face (the complete original replica), back face with the
  NOKIA logo, sealed battery cover and release tab (per reference photo), both side
  walls (left side has the speaker-grille slots), top cap, bottom cap with the
  jack / charger / mic trio, plus a floor shadow. Built with pure CSS 3D transforms
  (`preserve-3d` + `perspective`), no WebGL.
- **Stoppable 360° spin** (`js/rotation.js`) — rAF-driven at the old 16 s/revolution
  cadence, slight 11° tilt so the top/bottom caps catch the light. "Stop rotation"
  pauses in place and eases to a front-facing view (no snap); "Start rotation" resumes
  from the current angle; `S` toggles either way.
- **Auto-tour** (`js/demo-tour.js`) that reuses the app's real `handleKey()` API to walk:
  power-on → standby → main menu → phonebook → contact card → messages → reading a
  sent SMS → call registration → games list → Snake II (actually plays it) →
  Bounce (actually plays it) → calculator (7 + 8 = 15) → clock & alarms (sets the
  time) → settings (cycles the colour shells across the whole phone) → standby —
  then loops forever. A caption bar shows the current step (STEP n/17).
- **Manual mode** — any real interaction with the phone (clicking a key, or pressing a
  mapped keyboard key) stops the auto-tour AND the rotation PERMANENTLY (no auto-resume);
  the caption bar switches to "Manual mode — you're driving" (badge `MANUAL`). An explicit
  "Restart tour" button resumes the tour from step 1; the spin comes back with
  "Start rotation" or `S`.
- **Colour picker** — blue / green / red / grey / yellow glossy shells, recolouring
  every face of the 3D shell (the app's `applyTheme()` is extended in `demo-tour.js`
  to also tag the `.phone3d` container).

## Demo controls (MIN-46)

| Control | Action |
|---------|--------|
| **⏸ Stop rotation / ▶ Start rotation** button | Pause the 360° spin in place — it eases to a front-facing view, no snap — / resume from the current angle. |
| **↻ Restart tour** button | Resume the auto-demo from step 1 after you have taken over. |
| **S** key | Toggle the rotation only. Deliberately free of the phone keys: `js/main.js` maps arrows, Enter/Space, A/L/R, Esc/Backspace/Delete and 0–9 * # — no S. |

Any real key click or mapped keyboard input takes over: tour + spin stop permanently
and the caption bar shows "Manual mode — you're driving". There is no auto-resume.

## Key model (MIN-39 / MIN-40)

The display offers exactly ONE button choice per screen, matching the phone's
single general-purpose key:

- **Centre Navi key** — the only general-purpose button. Its function is the
  single word drawn at the BOTTOM-CENTRE of the LCD (e.g. "Menu", "Open",
  "Call"). No left/right soft-key labels are ever drawn.
- **C key** — fixed implicit clear / back / cancel; never labelled on screen.
- **Scroll rocker** — fixed scroll (hold = power off); never labelled on screen.

Dialogs draw only the primary action centred; the second button is the
implicit C-key cancel and is not drawn in a corner.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell: 3D scene, phone faces, caption bar, palette, hints. Front face + all app CSS carried over from the MIN-33 replica. |
| `js/demo-tour.js` | The auto-tour driver (steps, captions, permanent manual-mode takeover, Restart tour, theme propagation). Loaded last. |
| `js/rotation.js` | Stoppable 360° spin: rAF loop, Stop eases to front-facing (no snap), Start resumes, `S` toggles. Loaded before `demo-tour.js`. |
| `js/lcd.js` `js/audio.js` `js/state.js` `js/screens.js` `js/games.js` `js/main.js` | The app's JS engine — the demo drives the real engine (`S`, `DLG`, `go()`, `handleKey()`). Single-centre key model (MIN-40) lives in `lcd.js`/`screens.js`/`games.js`/`main.js`. |
| `screenshots/` | Verification captures from headless Chromium: front / back / both sides, Snake mid-play, full page. `min43-single-centre/` holds the 13 per-screen LCD captures (12× upscaled) proving exactly one bottom-centre label per screen. |

## Verified (headless Chromium 145 via CDP)

- Zero JS errors across a full tour cycle; all 15 key hooks + 5 swatches present.
- Screen sequence observed live: standby → menu → phonebook → pb_view → messages →
  msg_list → callreg → games → snake → calc → clocks → set_clock → settings (looping).
- Theme switch propagates to back/side/front faces alike (`--b1` blue→yellow on all).
- Screenshots in `screenshots/` confirm the front, back (logo + battery cover + tab),
  sides (grille slots), and the live Snake gameplay render cleanly.

## Re-verified for MIN-43 (retry of MIN-42, 2026-10-24)

- Full 17-step auto-tour run: every step completed; each step lands on its named
  screen (snake→snake, **bounce→bounce** — the Bounce step previously replayed
  Snake II because the games list re-enters with row 1 highlighted; fixed by
  stepping to row 2 before selecting). Zero JS console/page errors.
- Pixel-level check of the bottom label band on all 13 screens (standby, menu,
  phonebook, contact card Call/Delete, compose, calc, dialer, set-clock,
  reminder, snake-ready, bounce-ready, two-button dialog): dark pixels only in
  the centre region — no left/right corner labels anywhere. Captures in
  `screenshots/min43-single-centre/`.

## Re-verified for MIN-46 (2026-10-25)

- `node --check` clean on all 8 JS files; headless Chromium 145 via CDP with zero
  console/page errors across the whole session.
- Auto-tour started on its own; one real keypress took over: tour stopped, spin eased
  to exactly 0° (face-on, no snap), caption switched to "Manual mode — you're driving"
  (badge MANUAL) and stayed stopped after a 9.5 s wait — no auto-resume.
- "Restart tour" resumed the tour from step 1; opening the menu by key left the phone
  perfectly steady (0° angle drift over 700 ms).
- Captures: `screenshots/min46-a-stopped-face-on.png` (rotation + tour stopped, phone
  face-on) and `screenshots/min46-b-manual-menu-steady.png` (user-driven menu, phone steady).
