/* DESIGN OR DEATH — microgame registry.
   Each microgame is a factory:  create(stage, ctx) -> { destroy() }
     stage : the #stage DOM element to render into
     ctx   : { difficulty, rng, content, onDrag, win(), lose() }
   The ENGINE owns the clock. A microgame renders + wires input, then calls
   ctx.win() or ctx.lose() exactly once (extra calls are ignored by the engine).
   Adding a new microgame = one more entry in MICROGAMES, zero engine changes. */
(function () {
  "use strict";

  // ---------- tiny shared helpers (private to this module) ----------
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const rand = (rng, lo, hi) => lo + (hi - lo) * rng();
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  // A 2D pointer drag (the shared ctx.onDrag is horizontal-only). Returns detach.
  function drag2d(node, handlers) {
    node.style.touchAction = "none";
    let sx = 0, sy = 0, on = false;
    function down(e) { on = true; sx = e.clientX; sy = e.clientY;
      try { node.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); }
    function move(e) { if (on) handlers.onMove(e.clientX - sx, e.clientY - sy); }
    function up(e) { if (!on) return; on = false; handlers.onEnd(e.clientX - sx, e.clientY - sy); }
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
    };
  }

  // HSL -> relative luminance, and contrast vs white (for PICK!).
  function hslLum(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
  }
  const contrastWhite = (h, s, l) => 1.05 / (hslLum(h, s, l) + 0.05); // white L=1 -> 1.05

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

        const wrap = el("div", "kern-wrap");
        const row = el("div", "kern-word");
        const letters = [];
        for (let i = 0; i < word.length; i++) {
          const s = el("span", "kern-letter", word[i]);
          if (i === idx) {
            s.classList.add("kern-target");
            s.style.transform = "translateX(" + offset + "px)";
          }
          row.appendChild(s);
          letters.push(s);
        }
        wrap.appendChild(row);
        wrap.appendChild(el("div", "mg-hint", "drag the highlighted letter to fix the spacing"));
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
            target.style.transform = "translateX(0px)";       // teach: snap to true position
            target.classList.add(won ? "kern-good" : "kern-fix");
            if (won) ctx.win(); else ctx.lose();
          }
        });
        return { destroy() { detach(); } };
      }
    },

    // ---------- ALIGN! — drag the stray bar flush to the shared edge ----------
    align: {
      id: "align",
      command: "ALIGN!",
      create(stage, ctx) {
        const n = Math.min(5, 4 + (ctx.difficulty > 2 ? 1 : 0));
        const strayIdx = Math.floor(ctx.rng() * n);
        const tolerance = Math.max(4, 10 - (ctx.difficulty - 1) * 1.5);   // px
        const maxWrong = 26 + ctx.difficulty * 7;                         // px
        let offset = (ctx.rng() < 0.5 ? -1 : 1) * (maxWrong * (0.6 + 0.4 * ctx.rng()));

        const wrap = el("div", "align-wrap");
        wrap.appendChild(el("div", "align-guide"));   // faint reference edge
        const stack = el("div", "align-stack");
        let stray = null;
        for (let i = 0; i < n; i++) {
          const bar = el("div", "align-bar");
          bar.style.width = Math.round(rand(ctx.rng, 55, 92)) + "%";
          if (i === strayIdx) {
            bar.classList.add("align-stray");
            bar.style.transform = "translateX(" + offset + "px)";
            stray = bar;
          }
          stack.appendChild(bar);
        }
        wrap.appendChild(stack);
        wrap.appendChild(el("div", "mg-hint", "drag the red bar flush with the others"));
        stage.appendChild(wrap);

        let settled = false;
        const detach = ctx.onDrag(stray, {
          onMove(dx) {
            if (settled) return;
            stray.style.transform = "translateX(" + (offset + dx) + "px)";
          },
          onEnd(dx) {
            if (settled) return;
            settled = true;
            offset = offset + dx;
            const won = Math.abs(offset) <= tolerance;
            stray.style.transform = "translateX(0px)";        // teach: snap flush
            stray.classList.add(won ? "align-good" : "align-fix");
            if (won) ctx.win(); else ctx.lose();
          }
        });
        return { destroy() { detach(); } };
      }
    },

    // ---------- CENTER! — drag the dot to the exact center of the frame ----------
    center: {
      id: "center",
      command: "CENTER!",
      create(stage, ctx) {
        const tolerance = Math.max(10, 26 - (ctx.difficulty - 1) * 3);    // px radius
        const maxWrong = Math.min(95, 55 + ctx.difficulty * 10);         // px
        const ang = ctx.rng() * Math.PI * 2;
        const r = maxWrong * (0.6 + 0.4 * ctx.rng());
        let ox = Math.cos(ang) * r, oy = Math.sin(ang) * r;

        const wrap = el("div", "center-wrap");
        const frame = el("div", "center-frame");
        frame.appendChild(el("div", "center-cross center-cross-v"));
        frame.appendChild(el("div", "center-cross center-cross-h"));
        const dot = el("div", "center-dot");
        const place = () => { dot.style.transform =
          "translate(-50%,-50%) translate(" + ox + "px," + oy + "px)"; };
        place();
        frame.appendChild(dot);
        wrap.appendChild(frame);
        wrap.appendChild(el("div", "mg-hint", "drag the dot dead-center"));
        stage.appendChild(wrap);

        let settled = false;
        const detach = drag2d(dot, {
          onMove(dx, dy) {
            if (settled) return;
            dot.style.transform =
              "translate(-50%,-50%) translate(" + (ox + dx) + "px," + (oy + dy) + "px)";
          },
          onEnd(dx, dy) {
            if (settled) return;
            settled = true;
            ox += dx; oy += dy;
            const won = Math.hypot(ox, oy) <= tolerance;
            ox = 0; oy = 0; place();                          // teach: snap to true center
            frame.classList.add("show-cross");
            dot.classList.add(won ? "center-good" : "center-fix");
            if (won) ctx.win(); else ctx.lose();
          }
        });
        return { destroy() { detach(); } };
      }
    },

    // ---------- PICK! — tap the readable chip (contrast) ----------
    pick: {
      id: "pick",
      command: "PICK!",
      create(stage, ctx) {
        const n = Math.min(5, 3 + Math.floor((ctx.difficulty - 1) / 1));
        // Wrong chips get darker (harder) as difficulty climbs; correct stays dark.
        const wrongLo = 60 - Math.min(18, (ctx.difficulty - 1) * 6);
        const wrongHi = 80 - Math.min(20, (ctx.difficulty - 1) * 6);

        const chips = [];
        const correctIdx = Math.floor(ctx.rng() * n);
        for (let i = 0; i < n; i++) {
          const h = Math.round(rand(ctx.rng, 0, 360));
          const s = Math.round(rand(ctx.rng, 30, 70));
          const l = i === correctIdx
            ? Math.round(rand(ctx.rng, 14, 26))     // dark -> high contrast w/ white
            : Math.round(rand(ctx.rng, wrongLo, wrongHi)); // light/mid -> low contrast
          chips.push({ h, s, l });
        }

        const wrap = el("div", "pick-wrap");
        wrap.appendChild(el("div", "mg-hint mg-hint-top", "tap the one you can actually read"));
        const row = el("div", "pick-row");
        let answered = false;
        chips.forEach((c, i) => {
          const chip = el("button", "pick-chip", "Aa");
          chip.style.background = "hsl(" + c.h + "," + c.s + "%," + c.l + "%)";
          chip.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (answered) return;
            answered = true;
            const won = i === correctIdx;
            row.children[correctIdx].classList.add("pick-answer"); // teach: reveal correct
            if (!won) chip.classList.add("pick-wrong");
            if (won) ctx.win(); else ctx.lose();
          });
          row.appendChild(chip);
        });
        wrap.appendChild(row);
        stage.appendChild(wrap);
        return { destroy() {} };   // listeners die with the cleared stage
      }
    },

    // ---------- ODD ONE! — tap the tile that doesn't match ----------
    odd: {
      id: "odd",
      command: "ODD ONE!",
      create(stage, ctx) {
        const cols = Math.min(5, 3 + Math.floor((ctx.difficulty - 1) / 2));
        const total = cols * cols;
        const oddIdx = Math.floor(ctx.rng() * total);
        const baseH = Math.round(rand(ctx.rng, 0, 360));
        const s = 55, l = 55;
        const delta = Math.max(8, 40 - (ctx.difficulty - 1) * 6);        // hue shift, deg
        const oddH = (baseH + (ctx.rng() < 0.5 ? -delta : delta) + 360) % 360;

        const wrap = el("div", "odd-wrap");
        wrap.appendChild(el("div", "mg-hint mg-hint-top", "tap the tile that's different"));
        const grid = el("div", "odd-grid");
        grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
        grid.style.maxWidth = Math.min(340, cols * 78) + "px";
        let answered = false;
        for (let i = 0; i < total; i++) {
          const t = el("button", "odd-tile");
          const h = i === oddIdx ? oddH : baseH;
          t.style.background = "hsl(" + h + "," + s + "%," + l + "%)";
          t.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (answered) return;
            answered = true;
            const won = i === oddIdx;
            grid.children[oddIdx].classList.add("odd-answer"); // teach: reveal the odd one
            if (!won) t.classList.add("odd-wrong");
            if (won) ctx.win(); else ctx.lose();
          });
          grid.appendChild(t);
        }
        wrap.appendChild(grid);
        stage.appendChild(wrap);
        return { destroy() {} };
      }
    }

  };

  window.MICROGAMES = MICROGAMES;
})();
