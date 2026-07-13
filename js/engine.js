/* DESIGN OR DEATH — engine.
   Object-literal module + a single `state` string, mirroring citydrawer's
   CityMap. The engine runs the round loop, owns the countdown, scores, and
   drives the UI. Seeded RNG / localStorage helpers reused from rapscore. */
(function () {
  "use strict";

  // ---------- reused utils (rapscore/js/app.js) ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ }
    }
  };

  // Pointer-based drag helper — works mouse + touch uniformly.
  // Shared via ctx so every drag microgame reuses it.
  function onDrag(el, handlers) {
    el.style.touchAction = "none";
    let startX = 0, dragging = false;
    function down(e) {
      dragging = true; startX = e.clientX;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    }
    function move(e) { if (dragging) handlers.onMove(e.clientX - startX); }
    function up(e) {
      if (!dragging) return;
      dragging = false;
      handlers.onEnd(e.clientX - startX);
    }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return function detach() {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }

  // ---------- tuning ----------
  const START_LIVES = 3;
  const BASE_MS = 4000, STEP_MS = 150, FLOOR_MS = 1200; // countdown per round
  const INTRO_MS = 700;                                  // command flash
  const RESOLVE_MS = 560;                                // juice / teach hold
  const SPEED_MAX = 50, COMBO_BONUS = 10, BASE_POINTS = 100;

  const Engine = {
    state: "idle",            // idle | intro | playing | resolving | dead
    mode: "gauntlet",
    lives: START_LIVES, maxLives: START_LIVES,
    score: 0, combo: 0, round: 0, best: 0,
    rng: Math.random,
    current: null,
    _resolved: false, _raf: null, _deadline: 0, _duration: 0,

    init() { this.best = store.get("dod_best_gauntlet", 0); },

    start(mode) {
      this.mode = mode || "gauntlet";
      this.lives = START_LIVES;
      this.score = 0; this.combo = 0; this.round = 0;
      this._resolved = false;
      this.rng = Math.random;                 // Daily mode will seed this (M2)
      UI.showPlay();
      UI.updateHUD(this);
      this.next();
    },

    difficulty() { return 1 + Math.floor(this.round / 5); },

    next() {
      this.round++;
      this._resolved = false;
      const ids = Object.keys(MICROGAMES);
      const id = ids[Math.floor(this.rng() * ids.length)];
      this.current = { id: id, game: MICROGAMES[id], api: null };
      this.state = "intro";
      UI.clearStage();
      UI.showCommand(this.current.game.command, INTRO_MS);
      setTimeout(() => this.mountGame(), INTRO_MS);
    },

    mountGame() {
      if (this.state !== "intro") return;
      this.state = "playing";
      const ctx = {
        difficulty: this.difficulty(),
        rng: this.rng,
        content: DOD_CONTENT[this.current.id] || {},
        onDrag: onDrag,
        win: () => this.onResult(true),
        lose: () => this.onResult(false)
      };
      this.current.api = this.current.game.create(UI.stage(), ctx);
      this._duration = Math.max(FLOOR_MS, BASE_MS - this.round * STEP_MS);
      this.startTimer(this._duration);
    },

    startTimer(ms) {
      this._deadline = performance.now() + ms;
      const tick = () => {
        const remain = this._deadline - performance.now();
        UI.setCountdown(Math.max(0, remain / ms));
        if (remain <= 0) { this.onResult(false); return; }
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    },

    stopTimer() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    },

    onResult(win) {
      if (this._resolved || this.state !== "playing") return;
      this._resolved = true;
      const fracLeft = Math.max(0, (this._deadline - performance.now()) / this._duration);
      this.stopTimer();
      this.state = "resolving";

      if (win) {
        this.combo++;
        const gained = BASE_POINTS * this.difficulty()
          + Math.round(fracLeft * SPEED_MAX)
          + (this.combo - 1) * COMBO_BONUS;
        this.score += gained;
        UI.flash(true);
        UI.sound("win");
      } else {
        this.combo = 0;
        this.lives--;
        UI.flash(false);
        UI.sound("lose");
      }
      UI.updateHUD(this);

      setTimeout(() => {
        if (this.current && this.current.api) {
          try { this.current.api.destroy(); } catch (_) {}
        }
        if (this.lives <= 0) this.die();
        else this.next();
      }, RESOLVE_MS);
    },

    die() {
      this.state = "dead";
      if (this.score > this.best) {
        this.best = this.score;
        store.set("dod_best_gauntlet", this.best);
      }
      UI.sound("dead");
      UI.showGameOver(this);
    }
  };

  window.Engine = Engine;
})();
