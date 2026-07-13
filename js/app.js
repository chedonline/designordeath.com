/* DESIGN OR DEATH — boot.
   Single IIFE: feature-check, wire the UI, seed the home screen. Mirrors
   citydrawer's app.js guard-chain-then-hand-off pattern. */
(function boot() {
  "use strict";

  // Minimum capability: pointer events + rAF. Every modern browser has these;
  // if not, the page is still readable, it just won't animate.
  const ok = "PointerEvent" in window && "requestAnimationFrame" in window;
  if (!ok) {
    const b = document.getElementById("btn-play");
    if (b) { b.textContent = "Unsupported browser"; b.disabled = true; }
    return;
  }

  UI.init();
  Engine.init();
  document.getElementById("home-best").textContent = Engine.best;
})();
