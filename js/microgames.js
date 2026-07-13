/* DESIGN OR DEATH — microgame registry.
   Each microgame is a factory:  create(stage, ctx) -> { destroy() }
     stage : the #stage DOM element to render into
     ctx   : { difficulty, rng, content, onDrag, win(), lose() }
   The ENGINE owns the clock. A microgame renders + wires input, then calls
   ctx.win() or ctx.lose() exactly once (extra calls are ignored by the engine).
   Adding a new microgame = one more entry in MICROGAMES, zero engine changes.

   Design spec (Charles, 2026-07-13): no visible target/guide where possible —
   test JUDGMENT, not mechanical matching. Vary the parameter each round so the
   player can't autopilot. Reward the eye over the ruler. */
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
  const sign = (rng) => (rng() < 0.5 ? -1 : 1);

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

  // HSL -> contrast vs white (for PICK!).
  function hslLum(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
  }

  // HSV(0..360,0..1,0..1) -> "rgb(r,g,b)" — used by the color wheel.
  function hsvRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return "rgb(" + Math.round((r + m) * 255) + "," + Math.round((g + m) * 255) + "," + Math.round((b + m) * 255) + ")";
  }
  const hueDiff = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };
  const DEG = Math.PI / 180;

  const MICROGAMES = {

    // ---------- KERN! — drag the loose letter to fix the spacing ----------
    kern: {
      id: "kern",
      command: "KERN!",
      create(stage, ctx) {
        const words = (ctx.content && ctx.content.words) || ["DESIGN"];
        const word = words[Math.floor(ctx.rng() * words.length)];
        const idx = 1 + Math.floor(ctx.rng() * Math.max(1, word.length - 2));
        const tolerance = Math.max(3, 9 - (ctx.difficulty - 1) * 1.5);
        const maxWrong = 22 + ctx.difficulty * 6;
        let offset = sign(ctx.rng) * (maxWrong * (0.6 + 0.4 * ctx.rng()));

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
          onMove(dx) { if (settled) return; target.style.transform = "translateX(" + (offset + dx) + "px)"; },
          onEnd(dx) {
            if (settled) return; settled = true;
            offset += dx;
            const won = Math.abs(offset) <= tolerance;
            target.style.transform = "translateX(0px)";
            target.classList.add(won ? "kern-good" : "kern-fix");
            if (won) ctx.win(); else ctx.lose();
          }
        });
        return { destroy() { detach(); } };
      }
    },

    // ---------- ALIGN! — no guide; read the group's shared edge, join it ----------
    // The group (varying sizes) establishes the alignment; one stray is off.
    // Which edge (left/right/center · top/bottom/middle) varies every round, so
    // the player must SEE the relationship — not chase a line.
    align: {
      id: "align",
      command: "ALIGN!",
      create(stage, ctx) {
        const horiz = ctx.rng() < 0.6;                        // horizontal vs vertical alignment
        const edge = horiz ? pick(ctx.rng, ["flex-start", "flex-end", "center"])
                           : pick(ctx.rng, ["flex-start", "flex-end", "center"]);
        const n = 4;
        const strayIdx = Math.floor(ctx.rng() * n);
        const tol = Math.max(4, 10 - (ctx.difficulty - 1) * 1.5);
        const maxWrong = 24 + ctx.difficulty * 7;
        let off = sign(ctx.rng) * (maxWrong * (0.6 + 0.4 * ctx.rng()));

        const wrap = el("div", "align-wrap" + (horiz ? "" : " align-vert"));
        const stack = el("div", "align-stack");
        stack.style.alignItems = edge;                        // establishes the shared edge
        let stray = null;
        for (let i = 0; i < n; i++) {
          const bar = el("div", "align-bar");
          if (horiz) bar.style.width = Math.round(rand(ctx.rng, 42, 96)) + "%";
          else bar.style.height = Math.round(rand(ctx.rng, 46, 128)) + "px";
          if (i === strayIdx) {
            bar.classList.add("align-stray");
            bar.style.transform = horiz ? "translateX(" + off + "px)" : "translateY(" + off + "px)";
            stray = bar;
          }
          stack.appendChild(bar);
        }
        wrap.appendChild(stack);
        wrap.appendChild(el("div", "mg-hint", "drag the red one into alignment with the rest"));
        stage.appendChild(wrap);

        let settled = false;
        const detach = drag2d(stray, {
          onMove(dx, dy) {
            if (settled) return;
            const d = horiz ? dx : dy;
            stray.style.transform = horiz ? "translateX(" + (off + d) + "px)" : "translateY(" + (off + d) + "px)";
          },
          onEnd(dx, dy) {
            if (settled) return; settled = true;
            off += horiz ? dx : dy;
            const won = Math.abs(off) <= tol;
            stray.style.transform = "translate(0px,0px)";
            stray.classList.add(won ? "align-good" : "align-fix");
            if (won) ctx.win(); else ctx.lose();
          }
        });
        return { destroy() { detach(); } };
      }
    },

    // ---------- CENTER! — no frame; center the object in the viewport ----------
    // Shape + size vary. The reference is the play area's own edges.
    center: {
      id: "center",
      command: "CENTER!",
      create(stage, ctx) {
        const arena = stage.parentElement || stage;           // the visible play field
        const shape = pick(ctx.rng, ["circle", "square", "triangle", "text"]);
        const scale = pick(ctx.rng, [0.85, 1.15, 1.6]);
        const size = Math.round(34 * scale);
        const tol = Math.max(9, 24 - (ctx.difficulty - 1) * 3);

        // bound the starting offset so the object stays fully on-field
        const rect = arena.getBoundingClientRect();
        const bound = Math.max(60, Math.min(rect.width, rect.height) / 2 - size - 16);
        const maxWrong = Math.min(bound, 60 + ctx.difficulty * 12);
        const ang = ctx.rng() * Math.PI * 2;
        const r = maxWrong * (0.6 + 0.4 * ctx.rng());
        let ox = Math.cos(ang) * r, oy = Math.sin(ang) * r;

        const obj = el("div", "center-obj center-" + shape);
        if (shape === "text") { obj.textContent = "Aa"; obj.style.fontSize = Math.round(size * 0.9) + "px"; }
        else { obj.style.width = size + "px"; obj.style.height = size + "px"; }
        const place = () => { obj.style.transform = "translate(-50%,-50%) translate(" + ox + "px," + oy + "px)"; };
        place();
        arena.appendChild(obj);

        const hint = el("div", "mg-hint center-hint", "drag it dead-center — no frame, trust your eye");
        arena.appendChild(hint);
        const cross = el("div", "center-cross");
        cross.appendChild(el("div", "center-cross-v"));
        cross.appendChild(el("div", "center-cross-h"));
        arena.appendChild(cross);

        let settled = false;
        const detach = drag2d(obj, {
          onMove(dx, dy) {
            if (settled) return;
            obj.style.transform = "translate(-50%,-50%) translate(" + (ox + dx) + "px," + (oy + dy) + "px)";
          },
          onEnd(dx, dy) {
            if (settled) return; settled = true;
            ox += dx; oy += dy;
            const won = Math.hypot(ox, oy) <= tol;
            ox = 0; oy = 0; place();                          // teach: snap to true center
            cross.classList.add("show");
            obj.classList.add(won ? "center-good" : "center-fix");
            if (won) ctx.win(); else ctx.lose();
          }
        });
        return { destroy() { detach(); obj.remove(); hint.remove(); cross.remove(); } };
      }
    },

    // ---------- PICK! — tap the readable chip (contrast). Always 4 options. ----------
    pick: {
      id: "pick",
      command: "PICK!",
      create(stage, ctx) {
        const n = 4;
        const wrongLo = 60 - Math.min(18, (ctx.difficulty - 1) * 6);
        const wrongHi = 80 - Math.min(20, (ctx.difficulty - 1) * 6);
        const correctIdx = Math.floor(ctx.rng() * n);
        const chips = [];
        for (let i = 0; i < n; i++) {
          const h = Math.round(rand(ctx.rng, 0, 360));
          const s = Math.round(rand(ctx.rng, 30, 70));
          const l = i === correctIdx ? Math.round(rand(ctx.rng, 14, 26))
                                     : Math.round(rand(ctx.rng, wrongLo, wrongHi));
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
            if (answered) return; answered = true;
            const won = i === correctIdx;
            row.children[correctIdx].classList.add("pick-answer");
            if (!won) chip.classList.add("pick-wrong");
            if (won) ctx.win(); else ctx.lose();
          });
          row.appendChild(chip);
        });
        wrap.appendChild(row);
        stage.appendChild(wrap);
        return { destroy() {} };
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
        const delta = Math.max(8, 40 - (ctx.difficulty - 1) * 6);
        const oddH = (baseH + sign(ctx.rng) * delta + 360) % 360;

        const wrap = el("div", "odd-wrap");
        wrap.appendChild(el("div", "mg-hint mg-hint-top", "tap the tile that's different"));
        const grid = el("div", "odd-grid");
        grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
        grid.style.maxWidth = Math.min(340, cols * 78) + "px";
        let answered = false;
        for (let i = 0; i < total; i++) {
          const t = el("button", "odd-tile");
          t.style.background = "hsl(" + (i === oddIdx ? oddH : baseH) + "," + s + "%," + l + "%)";
          t.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (answered) return; answered = true;
            const won = i === oddIdx;
            grid.children[oddIdx].classList.add("odd-answer");
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

  // ---------- COLOR wheel (theory) — MATCH! / COMPLEMENT! / TRIAD! ----------
  // One hue+saturation wheel; the mode changes what you're tapping for. The
  // correct spot is never marked — you reason it from color theory.
  function colorGame(mode, command, hint) {
    return {
      id: "color-" + mode,
      command: command,
      create(stage, ctx) {
        const targetH = rand(ctx.rng, 0, 360);
        const targetS = rand(ctx.rng, 0.5, 1);
        let sols;
        if (mode === "match") sols = [{ h: targetH, s: targetS }];
        else if (mode === "complement") sols = [{ h: targetH + 180, s: targetS }];
        else sols = [{ h: targetH + 120, s: targetS }, { h: targetH - 120, s: targetS }];
        const hTol = Math.max(10, 26 - (ctx.difficulty - 1) * 4);
        const sTol = Math.max(0.12, 0.3 - (ctx.difficulty - 1) * 0.035);

        const wrap = el("div", "color-wrap");
        wrap.appendChild(el("div", "mg-hint mg-hint-top", hint));
        const swatch = el("div", "color-target");
        swatch.style.background = hsvRgb(targetH, targetS, 1);
        wrap.appendChild(swatch);

        const wheel = el("div", "color-wheel");
        // conic hue built from analytic HSV so the visual matches the math
        const stops = [];
        for (let h = 0; h <= 360; h += 30) stops.push(hsvRgb(h, 1, 1) + " " + h + "deg");
        wheel.style.background = "conic-gradient(from 90deg at 50% 50%, " + stops.join(",") + ")";
        wheel.appendChild(el("div", "color-sat"));            // radial white = desaturation
        const picker = el("div", "color-picker");
        wheel.appendChild(picker);
        const marker = el("div", "color-marker");             // teach-on-miss: true answer
        wheel.appendChild(marker);
        wrap.appendChild(wheel);
        stage.appendChild(wrap);

        const R = wheel.clientWidth / 2 || 120;
        const toXY = (h, s) => ({ x: Math.cos(h * DEG) * s * R, y: Math.sin(h * DEG) * s * R });
        const setPicker = (h, s) => {
          const p = toXY(h, s);
          picker.style.transform = "translate(-50%,-50%) translate(" + p.x + "px," + p.y + "px)";
          picker.style.background = hsvRgb(h, s, 1);
        };
        setPicker(0, 0);
        // test/teach hook: pixel offset of the (first) correct answer
        const solXY = toXY(sols[0].h, sols[0].s);
        wheel.dataset.sol = Math.round(solXY.x) + "," + Math.round(solXY.y);

        let cur = { h: 0, s: 0 }, settled = false;
        function locate(e) {
          const r = wheel.getBoundingClientRect();
          let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          const dist = Math.hypot(dx, dy);
          if (dist > R) { dx = dx * R / dist; dy = dy * R / dist; }
          return { h: ((Math.atan2(dy, dx) / DEG) + 360) % 360, s: Math.min(1, dist / R) };
        }
        function down(e) { if (settled) return; try { wheel.setPointerCapture(e.pointerId); } catch (_) {}
          e.preventDefault(); cur = locate(e); setPicker(cur.h, cur.s); }
        function move(e) { if (settled || e.buttons === 0) return; cur = locate(e); setPicker(cur.h, cur.s); }
        function up(e) {
          if (settled) return; settled = true;
          cur = locate(e); setPicker(cur.h, cur.s);
          const won = sols.some(so => hueDiff(cur.h, so.h) <= hTol && Math.abs(cur.s - so.s) <= sTol);
          const m = toXY(sols[0].h, sols[0].s);              // reveal the true answer
          marker.style.transform = "translate(-50%,-50%) translate(" + m.x + "px," + m.y + "px)";
          marker.classList.add("show");
          picker.classList.add(won ? "color-good" : "color-bad");
          if (won) ctx.win(); else ctx.lose();
        }
        wheel.style.touchAction = "none";
        wheel.addEventListener("pointerdown", down);
        wheel.addEventListener("pointermove", move);
        wheel.addEventListener("pointerup", up);
        wheel.addEventListener("pointercancel", up);
        return { destroy() {
          wheel.removeEventListener("pointerdown", down);
          wheel.removeEventListener("pointermove", move);
          wheel.removeEventListener("pointerup", up);
          wheel.removeEventListener("pointercancel", up);
        } };
      }
    };
  }
  const cm = colorGame("match", "MATCH!", "find this exact color on the wheel");
  const cc = colorGame("complement", "COMPLEMENT!", "tap this color's complement");
  const ct = colorGame("triad", "TRIAD!", "tap a triad partner of this color");
  MICROGAMES[cm.id] = cm;
  MICROGAMES[cc.id] = cc;
  MICROGAMES[ct.id] = ct;

  window.MICROGAMES = MICROGAMES;
})();
