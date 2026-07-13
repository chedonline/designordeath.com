/* DESIGN OR DEATH — UI layer.
   Screens (home / play / over), HUD, command flash, countdown, juice, and a
   tiny WebAudio blip kit. All DOM lives in index.html; UI just drives it. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function show(id) {
    const screens = document.querySelectorAll(".screen");
    for (let i = 0; i < screens.length; i++) screens[i].classList.add("hidden");
    $(id).classList.remove("hidden");
  }

  // ---------- tiny sound kit (quiet, refined) ----------
  const Sound = {
    ctx: null, muted: false,
    ensure() {
      if (this.muted) return null;
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    blip(freq, dur, type, gain) {
      const ac = this.ensure();
      if (!ac) return;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ac.destination);
      const t = ac.currentTime;
      g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
      o.start(t); o.stop(t + (dur || 0.12) + 0.02);
    },
    play(kind) {
      if (kind === "win") this.blip(660, 0.10, "sine", 0.045);
      else if (kind === "lose") this.blip(150, 0.16, "triangle", 0.06);
      else if (kind === "dead") { this.blip(120, 0.30, "sawtooth", 0.05); }
    },
    toggle() {
      this.muted = !this.muted;
      const b = $("btn-mute");
      if (b) { b.textContent = this.muted ? "♪̷" : "♪"; b.classList.toggle("off", this.muted); }
      return this.muted;
    }
  };

  const UI = {
    stage() { return $("stage"); },
    clearStage() { $("stage").innerHTML = ""; },

    showHome(engine) {
      if (engine) $("home-best").textContent = engine.best;
      show("screen-home");
    },
    showPlay() { show("screen-play"); },

    showCommand(text, ms) {
      const c = $("command");
      c.textContent = text;
      c.classList.remove("show");
      void c.offsetWidth;            // restart the animation
      c.classList.add("show");
      setTimeout(() => c.classList.remove("show"), ms);
    },

    setCountdown(frac) {
      const bar = $("bar");
      bar.style.transform = "scaleX(" + frac + ")";
      bar.classList.toggle("low", frac < 0.3);
    },

    updateHUD(e) {
      $("score").textContent = e.score;
      $("combo").textContent = e.combo > 1 ? "×" + e.combo : "";
      let hearts = "";
      for (let i = 0; i < e.maxLives; i++) hearts += (i < e.lives ? "♥" : "♡");
      $("hearts").textContent = hearts;
    },

    flash(win) {
      const f = $("flash"), st = $("stage");
      f.classList.remove("win", "lose"); void f.offsetWidth;
      f.classList.add(win ? "win" : "lose");
      if (!win) { st.classList.remove("shake"); void st.offsetWidth; st.classList.add("shake"); }
      setTimeout(() => { f.classList.remove("win", "lose"); st.classList.remove("shake"); }, 420);
    },

    showGameOver(e) {
      $("final-score").textContent = e.score;
      $("final-best").textContent = e.best;
      show("screen-over");
    },

    sound(kind) { Sound.play(kind); },

    init() {
      $("btn-play").addEventListener("click", () => Engine.start("gauntlet"));
      $("btn-again").addEventListener("click", () => Engine.start("gauntlet"));
      $("btn-home").addEventListener("click", () => UI.showHome(Engine));
      $("btn-mute").addEventListener("click", () => Sound.toggle());
    }
  };

  window.UI = UI;
})();
