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
export function stageShot(name, world) {
  const { state } = world;
  if (name === 'play') {
    // A real run from wave 1, flown for 55 seconds: by then the pilot is
    // deep in wave 4's mixed swarm, which is what the frame should show.
    world.reset();
    for (let i = 0; i < 55 / STEP; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (state.over) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'boss') {
    world.beginAtWave(5);
    for (let i = 0; i < 21 / STEP; i += 1) {
      world.step(STEP, autopilot(state), false);
      if (state.over) break;
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
