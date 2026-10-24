/* ============================================================
 * games.js — Snake II and Bounce, tuned for the 84x48 LCD.
 * Both use a state machine: ready | play | pause | over.
 * update(dt) drives animation; returns true when a redraw is
 * needed so main.js's rAF loop repaints only when it matters.
 * ============================================================ */
"use strict";

/* ---------------- shared game chrome ---------------- */
function gameHeader(title, score, extra) {
  clear();
  text(title, 1, 1);
  const label = "SCORE " + score;
  text(label, LCD.W - textWidth(label) - 1, 1);
  if (extra) { const ew = textWidth(extra); text(extra, Math.floor((LCD.W - ew) / 2), 1); }
  lineH(0, 8, LCD.W);
}

function bestFor(name) { return (S.data.scores && S.data.scores[name]) || 0; }
function setBest(name, score) { if (!S.data.scores) S.data.scores = {}; if (score > (S.data.scores[name] || 0)) { S.data.scores[name] = score; save(); } }

/* ============================================================
 * SNAKE II
 * Playfield: 84 wide x 40 tall, 4px cells -> 21 cols x 10 rows.
 * Walls kill (classic). Speed rises with level and score.
 * ============================================================ */
const SNAKE = {
  state: "ready",
  cols: 21, rows: 10, cell: 4, ox: 0, oy: 9,
  snake: [], dir: { x: 1, y: 0 }, queue: [],
  food: null, score: 0, level: 1,
  acc: 0, interval: 240,
  grow: 0,
};

function snakeReset(level) {
  SNAKE.level = level || 1;
  const cy = Math.floor(SNAKE.rows / 2);
  SNAKE.snake = [{ x: 5, y: cy }, { x: 4, y: cy }, { x: 3, y: cy }];
  SNAKE.dir = { x: 1, y: 0 };
  SNAKE.queue = [];
  SNAKE.score = 0;
  SNAKE.grow = 0;
  SNAKE.acc = 0;
  SNAKE.interval = [240, 200, 160][SNAKE.level - 1] || 240;
  snakePlaceFood();
}
function snakePlaceFood() {
  const free = [];
  for (let y = 0; y < SNAKE.rows; y++) for (let x = 0; x < SNAKE.cols; x++) {
    if (!SNAKE.snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
  }
  SNAKE.food = free.length ? free[(Math.random() * free.length) | 0] : null;
}
function snakeStep() {
  // apply one queued direction (no 180° reversal)
  while (SNAKE.queue.length) {
    const d = SNAKE.queue.shift();
    if (d.x === -SNAKE.dir.x && d.y === -SNAKE.dir.y) continue;
    if (d.x === SNAKE.dir.x && d.y === SNAKE.dir.y) continue;
    SNAKE.dir = d; break;
  }
  const head = SNAKE.snake[0];
  const nx = head.x + SNAKE.dir.x, ny = head.y + SNAKE.dir.y;
  // wall or self -> death
  if (nx < 0 || ny < 0 || nx >= SNAKE.cols || ny >= SNAKE.rows) return snakeDie();
  const willGrow = SNAKE.grow > 0;
  for (let i = 0; i < SNAKE.snake.length - (willGrow ? 0 : 1); i++) {
    if (SNAKE.snake[i].x === nx && SNAKE.snake[i].y === ny) return snakeDie();
  }
  SNAKE.snake.unshift({ x: nx, y: ny });
  if (SNAKE.food && nx === SNAKE.food.x && ny === SNAKE.food.y) {
    SNAKE.score += 10;
    SNAKE.grow += 1;
    Audio3310.eat();
    // speed up a touch every 5 foods
    if (SNAKE.score % 50 === 0 && SNAKE.interval > 120) SNAKE.interval -= 12;
    snakePlaceFood();
  } else if (SNAKE.grow > 0) {
    SNAKE.grow--;
    SNAKE.snake.pop(); // didn't grow this step -> drop tail
  } else {
    SNAKE.snake.pop();
  }
}
function snakeDie() {
  SNAKE.state = "over";
  Audio3310.die();
  setBest("snake", SNAKE.score);
}

registerScreen("snake", {
  name: "snake",
  enter(level) { snakeReset(level || 1); SNAKE.state = "ready"; },
  draw() {
    gameHeader("SNAKE II", SNAKE.score, "L" + SNAKE.level);
    const c = SNAKE.cell, ox = SNAKE.ox, oy = SNAKE.oy;
    // playfield border
    hollowRect(0, oy - 1, LCD.W, SNAKE.rows * c + 2);
    if (SNAKE.state === "ready") {
      textC("PRESS OK", oy + 16);
      textC("TO START", oy + 24);
      softRow("Start");
      return;
    }
    // food (inverted diamond)
    if (SNAKE.food) {
      const fx = ox + SNAKE.food.x * c, fy = oy + SNAKE.food.y * c;
      withInv(() => { rect(fx + 1, fy + 1, c - 2, c - 2); });
    }
    // snake body (head solid, tail slightly inset)
    for (let i = 0; i < SNAKE.snake.length; i++) {
      const s = SNAKE.snake[i];
      const x = ox + s.x * c, y = oy + s.y * c;
      if (i === 0) rect(x, y, c, c);
      else rect(x + 1, y + 1, c - 2, c - 2);
    }
    if (SNAKE.state === "pause") { clear(); gameHeader("SNAKE II", SNAKE.score, "PAUSED"); softRow("Resume"); return; }
    if (SNAKE.state === "over") {
      clear(); gameHeader("GAME OVER", SNAKE.score);
      textC("SCORE " + SNAKE.score, 18);
      textC("BEST  " + bestFor("snake"), 26);
      softRow("Retry");
      return;
    }
    softRow("Pause");
  },
  update(dt) {
    if (SNAKE.state !== "play") return false;
    SNAKE.acc += dt;
    let moved = false;
    while (SNAKE.acc >= SNAKE.interval) { SNAKE.acc -= SNAKE.interval; snakeStep(); moved = true; if (SNAKE.state !== "play") break; }
    return moved;
  },
  onKey(key) {
    const dirs = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    if (SNAKE.state === "ready") {
      if (dirs[key]) { SNAKE.queue.push(dirs[key]); SNAKE.state = "play"; Audio3310.select(); return; }
      if (key === "select" || key === "enter") { SNAKE.state = "play"; Audio3310.select(); return; }
      if (key === "softL" || key === "end" || key === "c") { Audio3310.back(); go("games"); return; }
      return;
    }
    if (SNAKE.state === "play") {
      if (dirs[key]) { SNAKE.queue.push(dirs[key]); if (SNAKE.queue.length > 3) SNAKE.queue.shift(); return; }
      if (key === "select" || key === "enter") { SNAKE.state = "pause"; Audio3310.select(); dirty(); return; }
      if (key === "softL" || key === "end" || key === "c") {
        dialog({ text: "Quit Snake?", icon: "cross", buttons: [
          { label: "Yes", action: () => go("games") }, { label: "No" },
        ]});
        return;
      }
      return;
    }
    if (SNAKE.state === "pause") {
      if (key === "select" || key === "enter") { SNAKE.state = "play"; Audio3310.select(); dirty(); return; }
      if (key === "softL" || key === "end" || key === "c") { Audio3310.back(); go("games"); return; }
      return;
    }
    if (SNAKE.state === "over") {
      if (key === "select" || key === "enter") { snakeReset(SNAKE.level); SNAKE.state = "play"; Audio3310.select(); dirty(); return; }
      if (key === "softL" || key === "end" || key === "c") { Audio3310.back(); go("games"); return; }
      return;
    }
  },
});

/* ============================================================
 * BOUNCE — paddle keeps the ball alive; miss = lose a life.
 * Continuous physics driven by update(dt).
 * ============================================================ */
const BOUNCE = {
  state: "ready",
  bx: 42, by: 20, vx: 1.6, vy: 1.2,
  px: 36, pw: 14,          // paddle x (left) and width
  pvx: 0,
  lives: 3, score: 0, speed: 1,
};
function bounceReset() {
  BOUNCE.bx = 42; BOUNCE.by = 20;
  const a = (Math.random() * 0.6 - 0.3);
  BOUNCE.vx = 1.7 * Math.cos(a) * (Math.random() < 0.5 ? -1 : 1);
  BOUNCE.vy = 1.4 * Math.sin(a) + 1.2;
  if (BOUNCE.vy < 0.8) BOUNCE.vy = 0.8;
  BOUNCE.px = 36; BOUNCE.pvx = 0;
  BOUNCE.lives = 3; BOUNCE.score = 0; BOUNCE.speed = 1;
}
function bounceStep(dt) {
  const f = dt / 16.67; // normalize to ~60fps units
  // paddle movement (held direction read from global key state)
  if (typeof KEYS !== "undefined") {
    if (KEYS.left) BOUNCE.px -= 2.2 * f;
    if (KEYS.right) BOUNCE.px += 2.2 * f;
  }
  BOUNCE.px = Math.max(1, Math.min(LCD.W - 1 - BOUNCE.pw, BOUNCE.px));
  // ball
  BOUNCE.bx += BOUNCE.vx * f;
  BOUNCE.by += BOUNCE.vy * f;
  if (BOUNCE.bx < 1) { BOUNCE.bx = 1; BOUNCE.vx = Math.abs(BOUNCE.vx); }
  if (BOUNCE.bx > LCD.W - 2) { BOUNCE.bx = LCD.W - 2; BOUNCE.vx = -Math.abs(BOUNCE.vx); }
  if (BOUNCE.by < 10) { BOUNCE.by = 10; BOUNCE.vy = Math.abs(BOUNCE.vy); Audio3310.tick(); }
  // paddle collision (paddle top at y=42)
  const py = 42;
  if (BOUNCE.vy > 0 && BOUNCE.by >= py - 1 && BOUNCE.by <= py + 2 && BOUNCE.bx >= BOUNCE.px - 1 && BOUNCE.bx <= BOUNCE.px + BOUNCE.pw + 1) {
    BOUNCE.by = py - 1;
    const rel = (BOUNCE.bx - (BOUNCE.px + BOUNCE.pw / 2)) / (BOUNCE.pw / 2); // -1..1
    BOUNCE.vx = rel * 2.0;
    BOUNCE.vy = -Math.abs(BOUNCE.vy) * 1.02;
    BOUNCE.score += 5; Audio3310.shootHit();
    if (BOUNCE.score % 50 === 0 && BOUNCE.speed < 2.2) BOUNCE.speed *= 1.08;
  }
  // missed
  if (BOUNCE.by > LCD.H) {
    BOUNCE.lives--; Audio3310.die();
    if (BOUNCE.lives <= 0) { BOUNCE.state = "over"; setBest("bounce", BOUNCE.score); return; }
    bounceReset(); BOUNCE.lives = Math.max(1, BOUNCE.lives); // keep remaining lives
  }
}

registerScreen("bounce", {
  name: "bounce",
  enter() { bounceReset(); BOUNCE.state = "ready"; },
  draw() {
    gameHeader("BOUNCE", BOUNCE.score, "x" + Math.max(0, BOUNCE.lives));
    if (BOUNCE.state === "ready") { textC("PRESS OK", 24); textC("TO START", 32); softRow("Start"); return; }
    // ball
    rect(BOUNCE.bx | 0, BOUNCE.by | 0, 2, 2);
    // paddle
    rect(BOUNCE.px | 0, 42, BOUNCE.pw, 2);
    if (BOUNCE.state === "over") {
      clear(); gameHeader("GAME OVER", BOUNCE.score);
      textC("SCORE " + BOUNCE.score, 18);
      textC("BEST  " + bestFor("bounce"), 26);
      softRow("Retry");
      return;
    }
    // no label row while playing — C key implicitly offers Quit
  },
  update(dt) {
    if (BOUNCE.state !== "play") return false;
    bounceStep(dt * BOUNCE.speed);
    return true;
  },
  onKey(key) {
    if (BOUNCE.state === "ready") {
      if (key === "left" || key === "right" || key === "select" || key === "enter") { BOUNCE.state = "play"; Audio3310.select(); return; }
      if (key === "softL" || key === "end" || key === "c") { Audio3310.back(); go("games"); return; }
      return;
    }
    if (BOUNCE.state === "play") {
      if (key === "softL" || key === "end" || key === "c") {
        dialog({ text: "Quit Bounce?", icon: "cross", buttons: [
          { label: "Yes", action: () => go("games") }, { label: "No" },
        ]});
      }
      return;
    }
    if (BOUNCE.state === "over") {
      if (key === "select" || key === "enter") { bounceReset(); BOUNCE.state = "play"; Audio3310.select(); dirty(); return; }
      if (key === "softL" || key === "end" || key === "c") { Audio3310.back(); go("games"); return; }
    }
  },
  exit() { /* paddle held-state lives in global KEYS; nothing to clear */ },
});
