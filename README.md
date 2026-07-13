# Design or Death

**WarioWare for design** — rapid-fire microgames, each testing one design instinct in ~5 seconds, at escalating speed. Miss three and you're dead.

Refined design-nerd aesthetic. No build, no server, no dependencies — pure HTML/CSS/vanilla JS (house Variant A).

## Run it

Double-click `index.html`. It runs from `file://` — data loads as a plain script, so no server is needed. (For a clean localhost run: `python -m http.server 8000` then open `http://localhost:8000`.)

## M1 scope (current)

- The **microgame engine**: `js/engine.js` — round loop, countdown, scoring, `onDrag` helper, state machine (`idle → intro → playing → resolving → dead`).
- **One microgame — KERN!** (`js/microgames.js`): drag the loose letter to fix the spacing. Teach-on-miss snaps it correct.
- **Gauntlet mode**: endless, 3 lives, speed ramps each round, difficulty tier every 5 rounds. Best score persists in localStorage (`dod_best_gauntlet`).

## Structure

```
index.html          3 screens (home / play / over) + script order
css/style.css        refined dark theme + juice
js/microgames.js     MICROGAMES registry — add a game = one entry, no engine change
js/engine.js         Engine state machine (owns the clock + scoring)
js/ui.js             screens, HUD, command flash, countdown, sound
js/app.js            boot(): feature check → wire UI → seed home
data/content.js      DOD_CONTENT — per-microgame content pools
```

## Adding a microgame

Add an entry to `MICROGAMES` in `js/microgames.js`:

```js
mygame: {
  id: "mygame",
  command: "SNAP!",
  create(stage, ctx) {
    // render into `stage`; call ctx.win() or ctx.lose() once.
    // ctx = { difficulty, rng, content, onDrag, win, lose }
    return { destroy() { /* cleanup listeners */ } };
  }
}
```
The engine handles the timer, scoring, lives, and juice automatically.

## Deploy

Push to `main` → GitHub Pages (repo `chedonline/designordeath.com`). `CNAME` points at the custom domain.
⚠️ **Domain expires 08/29/2026 — renew before the DNS/custom-domain cutover.**

## Roadmap (M2+)

More microgames (TAP!, PICK!, ALIGN!, CENTER!, MATCH!, REAL?, ODD ONE!, TYPE!, STRAIGHTEN!) · **Daily Death** seeded run + emoji-grid share · boss/themed sets.
