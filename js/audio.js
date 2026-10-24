/* ============================================================
 * audio.js — WebAudio engine: key tones, Nokia tune, ringtones,
 * game SFX, vibration. Square-wave monophonic, like the real 3310.
 * ============================================================ */
"use strict";

const Audio3310 = {
  ctx: null,
  masterGain: null,
  muted: false,

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  tone(freq, durMs, { type = "square", vol = 1, when = 0, slideTo = null } = {}) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + when;
    const t1 = t0 + durMs / 1000;
    const osc = ctx.createOscillator();
    const gn = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t1);
    const v = 0.25 * vol;
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(v, t0 + 0.008);
    gn.gain.setValueAtTime(v, Math.max(t0 + 0.009, t1 - durMs / 3000));
    gn.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gn); gn.connect(this.masterGain);
    osc.start(t0); osc.stop(t1 + 0.02);
  },

  /* short Nokia-style key blip */
  key() { this.tone(987.77, 45, { vol: 0.8 }); },
  select() { this.tone(1318.51, 60, { vol: 0.8 }); },
  back() { this.tone(659.25, 55, { vol: 0.7 }); },

  /* the famous Nokia startup tune: E5 G#5 B5 E6 */
  nokiaTune() {
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((f, i) => this.tone(f, 170, { when: i * 150, vol: 1 }));
  },

  /* game SFX */
  eat() { this.tone(1567.98, 55, { vol: 0.9 }); },
  die() { [880, 660, 440, 293.66].forEach((f, i) => this.tone(f, 140, { when: i * 120, vol: 0.9 })); },
  match() { [783.99, 1046.5, 1318.51].forEach((f, i) => this.tone(f, 70, { when: i * 60, vol: 0.8 })); },
  fire() { this.tone(2093, 35, { type: "sawtooth", vol: 0.4 }); },
  shootHit() { this.tone(1760, 50, { vol: 0.7 }); },
  win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 110, { when: i * 90, vol: 0.9 })); },
  tick() { this.tone(1046.5, 30, { vol: 0.5 }); },

  /* ---------------- ringtones (note sequences) ---------------- */
  RINGTONES: {
    "Nokia Ring": [[659.25, 130], [830.61, 130], [987.77, 130], [1318.51, 240],
                   [659.25, 130], [830.61, 130], [987.77, 130], [1318.51, 420]],
    "Ode to Joy": [[659.25, 120], [659.25, 120], [698.46, 120], [783.99, 120],
                   [783.99, 120], [698.46, 120], [659.25, 120], [587.33, 120],
                   [523.25, 120], [523.25, 120], [587.33, 120], [659.25, 120],
                   [659.25, 200], [587.33, 200], [587.33, 420]],
    "Chopsticks": [[659.25, 100], [523.25, 100], [783.99, 100], [783.99, 100],
                   [880, 100], [783.99, 100], [523.25, 100], [523.25, 100],
                   [587.33, 100], [587.33, 100], [659.25, 100], [659.25, 200]],
    "Jingle Bells": [[659.25, 110], [659.25, 110], [659.25, 240],
                     [659.25, 110], [659.25, 110], [659.25, 240],
                     [659.25, 110], [783.99, 110], [523.25, 110], [587.33, 110], [659.25, 340],
                     [698.46, 110], [698.46, 110], [698.46, 110], [698.46, 110],
                     [698.46, 110], [659.25, 110], [659.25, 110], [659.25, 240]],
    "Greensleeves": [[440, 130], [392, 130], [370, 130], [330, 260],
                     [370, 130], [392, 130], [440, 260],
                     [440, 130], [392, 130], [370, 130], [330, 260]],
    "Beethoven": [[622.25, 120], [622.25, 120], [622.25, 120], [466.16, 300],
                  [622.25, 120], [622.25, 120], [622.25, 120], [466.16, 560]],
    "Off": null,
  },

  _ringTimer: null,
  playRingtone(name, loops = Infinity) {
    const seq = this.RINGTONES[name];
    if (!seq) return;
    this.stopRinging();
    let i = 0, loopCount = 0;
    const step = () => {
      if (this._ringTimer === null) return;
      if (loops !== Infinity && loopCount >= loops) { this.stopRinging(); return; }
      const [f, d] = seq[i % seq.length];
      this.tone(f, d * 0.82, { vol: 1 });
      i++;
      if (i % seq.length === 0) loopCount++;
      const delay = seq[(i - 1) % seq.length][1] + 30;
      this._ringTimer = setTimeout(step, delay);
    };
    step();
  },
  stopRinging() {
    if (this._ringTimer != null) { clearTimeout(this._ringTimer); this._ringTimer = null; }
  },

  vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  },
};
