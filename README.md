# Lumen Drift

The dark is eating the stars. You are the last light-sprite, and the husks
are coming in waves to finish the job.

**Lumen Drift** is a wave-survival arena game for a desktop browser, written
in plain JavaScript on a 2D canvas — no engine, no build step, no network.
Shatter the geometric husks, gather the light shards they drop, and spend
them on a Nova that clears the sky. Survive ten waves and bring down the
Dreadnoughts on waves 5 and 10 to restore the dawn — then keep drifting in
endless mode and see how long the light lasts.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold click / Space | Fire |
| Shift / E / right click | Nova, once charged |
| P / Esc | Pause |
| M | Mute |

- **Goal.** Clear all 10 waves. The wave-10 Dreadnought's death wins the game.
- **Losing.** Your hull has 5 points. A husk that reaches you, or one of the
  Dreadnought's ember rings, costs one. At zero, the light goes out.
- **Score.** Every husk shattered pays out, more while your combo is alive:
  chain kills within 3 seconds to raise the multiplier up to x3.
- **The Nova.** Shards charge it (a kill is worth a trickle, a shard much
  more). At full charge the Nova hits everything on screen and sweeps ember
  rings away — save it for a crowd or a boss ring.

The husks come in five kinds: **drifters** home slowly, **mites** are quick
and fragile, **dashers** pause, flash a warning ring, then lunge,
**splitters** break into mites when shattered, and **bulwarks** are slow,
armoured and worth a fortune. The **Dreadnought** is a boss: it orbits at
range and breathes rings of embers.

## Run it

```
node serve.ts          # then open http://localhost:8080
```

Any static file server pointed at `game/` works just as well; open
`game/index.html` through it in a desktop browser. Everything the game
loads lives under `game/`, and all of its sound is synthesised live with
WebAudio — there are no asset files at all.

Deterministic scenes for screenshots: append `?shot=start|play|boss|end`
and `&seed=N` to the URL (see `shots.json`). The staged scene plays the
real rules forward under an autopilot and sets `window.__shotReady` when
the frame is ready to capture.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library.
- `vendor/makefun-game.ts` — make.fun's dossier library, copied unchanged.
- `game/index.html` — the page: a canvas and a screen-reader status line.
- `game/src/config.js` — every tuning number and colour.
- `game/src/random.js` — the seeded generator the whole simulation shares.
- `game/src/world.js` — the simulation: player, bolts, husks, shards,
  particles, waves and the boss. Pure logic, no DOM.
- `game/src/render.js` — all drawing: nebula, glow sprites, HUD, screens.
- `game/src/input.js` — keyboard and mouse as one control object.
- `game/src/audio.js` — the WebAudio synth: every sound, made in code.
- `game/src/shots.js` — the autopilot that stages the screenshot scenes.
- `game/src/main.js` — boot, the fixed-step loop and the screen flow.
- `screenshots/` — four real renders of the game, taken in Chrome.

## License

MIT — see `LICENSE`.
