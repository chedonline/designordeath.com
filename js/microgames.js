/* DESIGN OR DEATH — microgame registry.
   Each microgame is a factory:  create(stage, ctx) -> { destroy() }
     stage : the #stage DOM element to render into
     ctx   : { difficulty, rng, content, onDrag, win(), lose() }
   The ENGINE owns the clock. A microgame renders + wires input, then calls
   ctx.win() or ctx.lose() exactly once (extra calls are ignored by the engine).
   Adding a new microgame = one more entry here, zero engine changes. */
const MICROGAMES = {

  // ---------- KERN! — drag the loose letter to fix the spacing ----------
  kern: {
    id: "kern",
    command: "KERN!",
    create(stage, ctx) {
      const words = (ctx.content && ctx.content.words) || ["DESIGN"];
      const word = words[Math.floor(ctx.rng() * words.length)];

      // Pick an interior letter (never first/last) as the loose one.
      const idx = 1 + Math.floor(ctx.rng() * Math.max(1, word.length - 2));

      // Harder = smaller tolerance, bigger initial displacement.
      const tolerance = Math.max(3, 9 - (ctx.difficulty - 1) * 1.5);   // px
      const maxWrong = 22 + ctx.difficulty * 6;                        // px
      let offset = (ctx.rng() < 0.5 ? -1 : 1) * (maxWrong * (0.6 + 0.4 * ctx.rng()));

      const wrap = document.createElement("div");
      wrap.className = "kern-wrap";

      const row = document.createElement("div");
      row.className = "kern-word";
      const letters = [];
      for (let i = 0; i < word.length; i++) {
        const s = document.createElement("span");
        s.className = "kern-letter";
        s.textContent = word[i];
        if (i === idx) {
          s.classList.add("kern-target");
          s.style.transform = "translateX(" + offset + "px)";
        }
        row.appendChild(s);
        letters.push(s);
      }

      const hint = document.createElement("div");
      hint.className = "kern-hint";
      hint.textContent = "drag the highlighted letter to fix the spacing";

      wrap.appendChild(row);
      wrap.appendChild(hint);
      stage.appendChild(wrap);

      const target = letters[idx];
      let settled = false;

      const detach = ctx.onDrag(target, {
        onMove(dx) {
          if (settled) return;
          target.style.transform = "translateX(" + (offset + dx) + "px)";
        },
        onEnd(dx) {
          if (settled) return;
          settled = true;
          offset = offset + dx;
          const won = Math.abs(offset) <= tolerance;
          // teach-on-miss: snap to the correct position so the eye learns it
          target.style.transform = "translateX(0px)";
          target.classList.add(won ? "kern-good" : "kern-fix");
          if (won) ctx.win(); else ctx.lose();
        }
      });

      return { destroy() { detach(); } };
    }
  }

};
