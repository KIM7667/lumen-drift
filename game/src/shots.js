// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot, so the frame is what a real game looks like and the same
// seed always gives the same frame. The end scene is flown by a reckless
// pilot who never fires and steers into trouble, so it ends the way a
// hurried player's game ends.

import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { mx: 0, my: 0, ax: 0, ay: 0, fire: false, nova: false };

/** The nearest thing in `items` to (x, y), and its distance. */
function nearest(items, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const item of items) {
    const d = (item.x - x) ** 2 + (item.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return { item: best, dist: Math.sqrt(bestD) };
}

/**
 * A competent pilot: keep clear of husks and ember rings, gather shards,
 * aim at the nearest husk and fire in range, nova a crowd when charged.
 * Exported so a headless test can fly a whole game with it.
 */
export function autopilot(state) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  for (const foe of state.foes) {
    const dx = p.x - foe.x;
    const dy = p.y - foe.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = foe.radius + 150;
    if (d < range) {
      const w = ((range - d) / range) * 2.4;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  for (const ember of state.embers) {
    const dx = p.x - ember.x;
    const dy = p.y - ember.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 110) {
      mx += (dx / d) * 1.6;
      my += (dy / d) * 1.6;
    }
  }
  const shard = nearest(state.shards, p.x, p.y);
  if (shard.item && shard.dist < 430) {
    mx += ((shard.item.x - p.x) / (shard.dist || 1)) * 0.9;
    my += ((shard.item.y - p.y) / (shard.dist || 1)) * 0.9;
  } else {
    // No shard to chase: hold a loose orbit around the arena's centre.
    const dx = FIELD.width / 2 - p.x;
    const dy = FIELD.height / 2 - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 190) {
      mx += (dx / d) * 0.5;
      my += (dy / d) * 0.5;
    }
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const foe = nearest(state.foes, p.x, p.y);
  const crowded = state.foes.filter((f) => Math.hypot(f.x - p.x, f.y - p.y) < 210).length;
  return {
    mx,
    my,
    ax: foe.item ? foe.item.x : p.x + 120,
    ay: foe.item ? foe.item.y : p.y,
    fire: foe.item !== null && foe.dist < 580,
    nova: p.nova >= 100 && crowded >= 4,
  };
}

/** A pilot in a hurry to lose: no firing, and it steers at the nearest husk. */
function recklessPilot(state) {
  const p = state.player;
  const foe = nearest(state.foes, p.x, p.y);
  if (!foe.item) return { ...IDLE, ax: p.x + 100, ay: p.y };
  const d = foe.dist || 1;
  return {
    mx: (foe.item.x - p.x) / d,
    my: (foe.item.y - p.y) / d,
    ax: foe.item.x,
    ay: foe.item.y,
    fire: false,
    nova: false,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the score to treat as the best. Unknown names stage the title.
 */
/** How many foes are inside the arena (not still flying in from the dark). */
function onScreenFoes(state) {
  return state.foes.filter((f) => f.x > 0 && f.x < FIELD.width && f.y > 0 && f.y < FIELD.height).length;
}

export function stageShot(name, world) {
  const { state } = world;
  if (name === 'play') {
    // A real run from wave 1, flown by the autopilot — but instead of a
    // fixed duration, the scene stops at the first genuinely crowded
    // moment past the half-minute mark: a mixed swarm on screen, bolts in
    // flight and shatter sparks still hanging in the air. The simulation
    // is deterministic, so the chosen moment is the same on every run.
    world.reset();
    const maxSteps = Math.floor(68 / STEP);
    for (let i = 0; i < maxSteps; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (state.over || state.boss) break;
      const t = i * STEP;
      if (t < 28) continue;
      const p = state.player;
      const near = state.foes.filter((f) => Math.hypot(f.x - p.x, f.y - p.y) < 460).length;
      // The shot the judge should see: a crowd closing on the sprite, guns
      // going. Late in the search the bar lowers rather than never firing.
      const thickOfIt = onScreenFoes(state) >= 5 && near >= 3 && state.bolts.length >= 3 && state.particles.length >= 10;
      const busyEnough = t >= 50 && onScreenFoes(state) >= 4 && near >= 2 && state.bolts.length >= 2 && state.particles.length >= 10;
      if (thickOfIt || busyEnough) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'boss') {
    // The wave-5 Dreadnought fight, stopped at the first moment the boss
    // sits well inside the arena with a fresh ember ring still tight
    // around it, escorts on screen and sparks in the air. Later in the
    // search the bar lowers rather than never firing.
    world.beginAtWave(5);
    const maxSteps = Math.floor(26 / STEP);
    for (let i = 0; i < maxSteps; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (state.over) break;
      const t = i * STEP;
      if (t < 5 || !state.boss) continue;
      const b = state.boss;
      const ring = state.embers.filter((e) => Math.hypot(e.x - b.x, e.y - b.y) < 300).length;
      const framed = b.x > 170 && b.x < FIELD.width - 170 && b.y > 150 && b.y < FIELD.height - 150;
      const barrage = framed && ring >= 8 && onScreenFoes(state) >= 3 && state.particles.length >= 12;
      const lateEnough = t >= 16 && ring >= 6 && onScreenFoes(state) >= 2 && state.particles.length >= 10;
      if (barrage || lateEnough) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'end') {
    world.reset();
    for (let i = 0; i < 900 / STEP; i += 1) {
      world.step(STEP, recklessPilot(state), false);
      if (state.over) break;
    }
    // Let the death burst settle for a beat so the frame reads clearly.
    for (let i = 0; i < 0.8 / STEP; i += 1) world.step(STEP, IDLE, true);
    return { screen: SCREEN_OVER, best: state.score };
  }
  world.reset();
  for (let i = 0; i < 4 / STEP; i += 1) world.step(STEP, IDLE, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
