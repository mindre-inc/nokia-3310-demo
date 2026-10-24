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
- **Continuous 360° spin** — 16 s per revolution (`.spin` keyframes), slight 11° tilt
  so the top/bottom caps catch the light.
- **Auto-tour** (`js/demo-tour.js`) that reuses the app's real `handleKey()` API to walk:
  power-on → standby → main menu → phonebook → contact card → messages → reading a
  sent SMS → call registration → games list → Snake II (actually plays it) →
  Bounce (actually plays it) → calculator (7 + 8 = 15) → clock & alarms (sets the
  time) → settings (cycles the colour shells across the whole phone) → standby —
  then loops forever. A caption bar shows the current step (STEP n/17).
- **Human takeover** — touch any key or press a keyboard key and the tour pauses for
  a few seconds so you can drive the phone yourself; it resumes automatically.
- **Colour picker** — blue / green / red / grey / yellow glossy shells, recolouring
  every face of the 3D shell (the app's `applyTheme()` is extended in `demo-tour.js`
  to also tag the `.phone3d` container).

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
| `js/demo-tour.js` | The auto-tour driver (steps, captions, pause-on-interaction, theme propagation). Loaded last. |
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
