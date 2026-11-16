// The whole simulation: the player's light-sprite, its bolts, the husks that
// drift in from the dark, the shards they drop, and every particle, ring and
// floating score the renderer draws. Nothing here touches the canvas or the
// clock — step(dt, control) advances a fixed amount, all randomness comes
// from the seeded generator, and events are returned as a bitmask so the
// caller can play sounds and announcements without the world knowing.

import { BOSS_WAVES, COMBO, FIELD, FINAL_WAVE, FOES, PLAYER, SHARD } from './config.js';

export const EVT_SHOOT = 1;
export const EVT_HIT = 2;
export const EVT_BOOM = 4;
export const EVT_PICKUP = 8;
export const EVT_NOVA = 16;
export const EVT_HURT = 32;
export const EVT_WAVE = 64;
export const EVT_OVER = 128;
export const EVT_VICTORY = 256;
export const EVT_BOSS = 512;

const TAU = Math.PI * 2;

/** The foes a wave sends, in spawn order. Boss waves lead with the dreadnought. */
function waveComposition(random, wave) {
  const list = [];
  if (BOSS_WAVES.includes(wave)) {
    list.push('dreadnought');
    const escorts = wave >= FINAL_WAVE ? 6 : 4;
    for (let i = 0; i < escorts; i += 1) list.push('drifter');
    for (let i = 0; i < escorts; i += 1) list.push('mite');
    if (wave >= FINAL_WAVE) list.push('dasher', 'dasher', 'splitter');
    return list;
  }
  const add = (kind, count) => {
    for (let i = 0; i < count; i += 1) list.push(kind);
  };
  add('drifter', 3 + wave);
  if (wave >= 2) add('mite', 2 + wave);
  if (wave >= 3) add('dasher', wave - 1);
  if (wave >= 4) add('splitter', Math.floor(wave / 2));
  if (wave >= 6) add('bulwark', Math.floor((wave - 4) / 2));
  // Shuffle so kinds arrive mixed, never in blocks.
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    wave: 0,
    waveState: 'announce',
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    player: null,
    boss: null,
    bolts: [],
    embers: [],
    foes: [],
    shards: [],
    particles: [],
    rings: [],
    popups: [],
    stars: [],
    shake: 0,
    flash: 0,
    over: false,
    won: false,
    endless: false,
    banner: null,
  };

  function makePlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      hp: PLAYER.maxHp,
      fireCd: 0,
      invuln: 0,
      nova: 0,
      alive: true,
      thrust: 0,
    };
  }

  function makeStars() {
    const stars = [];
    for (let layer = 0; layer < 3; layer += 1) {
      const count = [70, 50, 30][layer];
      for (let i = 0; i < count; i += 1) {
        stars.push({
          x: random.next() * FIELD.width,
          y: random.next() * FIELD.height,
          layer,
          r: 0.6 + layer * 0.7 + random.next() * 0.8,
          tw: random.range(0.4, 1),
        });
      }
    }
    return stars;
  }

  function burst(x, y, colour, count, speed, size = 3, life = 0.6) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 420) return;
      const a = random.angle();
      const v = speed * (0.25 + random.next() * 0.95);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.5 + random.next() * 0.8),
        maxLife: life,
        size: size * (0.6 + random.next() * 0.9),
        colour,
        drag: 2.6,
      });
    }
  }

  function popup(x, y, text, colour, size = 17) {
    state.popups.push({ x, y, vy: -46, life: 0.9, maxLife: 0.9, text, colour, size });
  }

  function ring(x, y, colour, vr = 620, width = 5) {
    state.rings.push({ x, y, r: 8, vr, life: 0.45, maxLife: 0.45, colour, width });
  }

  function spawnPoint() {
    // On an edge, never near the player: a foe should be seen coming.
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = random.int(0, 3);
      const x = edge === 0 ? -30 : edge === 1 ? FIELD.width + 30 : random.next() * FIELD.width;
      const y = edge === 2 ? -30 : edge === 3 ? FIELD.height + 30 : random.next() * FIELD.height;
      const px = edge === 0 || edge === 1 ? x : random.next() * FIELD.width;
      const py = edge === 2 || edge === 3 ? y : random.next() * FIELD.height;
      const dx = px - state.player.x;
      const dy = py - state.player.y;
      if (dx * dx + dy * dy > 300 * 300 || tries === 11) return { x: px, y: py };
    }
    return { x: -30, y: -30 };
  }

  function spawnFoe(kind) {
    const spec = FOES[kind];
    const at = spawnPoint();
    const foe = {
      kind,
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      hp: spec.hp,
      maxHp: spec.hp,
      radius: spec.radius,
      speed: spec.speed * random.range(0.88, 1.12),
      t: random.range(0, 10),
      phase: random.angle(),
      flash: 0,
      mode: 'stalk',
      modeTimer: random.range(0.7, 1.5),
      dashX: 0,
      dashY: 0,
      shotTimer: 2.2,
      orbitDir: random.chance(0.5) ? 1 : -1,
    };
    state.foes.push(foe);
    if (kind === 'dreadnought') state.boss = foe;
    return foe;
  }

  function dropShards(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const a = random.angle();
      const v = random.range(30, 120);
      state.shards.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        radius: SHARD.radius,
        life: SHARD.lifetime,
        t: random.range(0, 6),
      });
    }
  }

  function killFoe(foe, events) {
    const spec = FOES[foe.kind];
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    const mult = 1 + Math.min(state.combo, 20) * COMBO.step;
    const points = Math.round(spec.score * mult);
    state.score += points;
    popup(foe.x, foe.y - foe.radius, `+${points}`, spec.core, foe.kind === 'dreadnought' ? 30 : 17);
    burst(foe.x, foe.y, spec.colour, foe.radius > 25 ? 34 : 16, 260, 3.4, 0.7);
    burst(foe.x, foe.y, spec.core, 8, 150, 2.2, 0.5);
    ring(foe.x, foe.y, spec.colour, 380, 4);
    state.shake = Math.min(14, state.shake + (foe.radius > 25 ? 9 : 3));
    const shardCount = foe.kind === 'dreadnought' ? 12 : foe.kind === 'bulwark' ? 3 : foe.kind === 'splitter' ? 2 : 1;
    dropShards(foe.x, foe.y, shardCount);
    if (foe.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const mite = spawnFoe('mite');
        mite.x = foe.x + random.range(-14, 14);
        mite.y = foe.y + random.range(-14, 14);
        mite.vx = random.range(-90, 90);
        mite.vy = random.range(-90, 90);
      }
    }
    if (foe === state.boss) {
      state.boss = null;
      state.flash = 0.7;
      if (state.wave >= FINAL_WAVE && !state.endless) {
        state.won = true;
        state.over = true;
        events |= EVT_VICTORY;
      }
    }
    return events | EVT_BOOM;
  }

  function hurtPlayer(events) {
    const player = state.player;
    player.hp -= 1;
    player.invuln = PLAYER.invulnerable;
    state.shake = Math.min(18, state.shake + 10);
    state.flash = 0.35;
    burst(player.x, player.y, '#ff5c7a', 22, 300, 3.4, 0.7);
    ring(player.x, player.y, '#ff5c7a', 460, 5);
    if (player.hp <= 0) {
      player.alive = false;
      state.over = true;
      burst(player.x, player.y, '#7ce7ff', 60, 380, 4, 1.1);
      burst(player.x, player.y, '#ffffff', 24, 220, 2.6, 0.9);
      ring(player.x, player.y, '#7ce7ff', 700, 7);
      return events | EVT_OVER;
    }
    return events | EVT_HURT;
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveState = 'announce';
    state.waveTimer = 2.0;
    state.spawnQueue = waveComposition(random, wave);
    state.spawnTimer = 0.6;
    const bossWave = BOSS_WAVES.includes(wave);
    state.banner = {
      title: bossWave ? `WAVE ${wave} — THE DREADNOUGHT` : `WAVE ${wave}`,
      sub: bossWave ? 'Bring it down. Mind the ember rings.' : wave === 1 ? 'WASD to move · mouse to aim · hold click to fire' : '',
      t: 2.0,
    };
    return bossWave ? EVT_BOSS : EVT_WAVE;
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.wave = 0;
    state.waveState = 'announce';
    state.waveTimer = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.player = makePlayer();
    state.boss = null;
    state.bolts = [];
    state.embers = [];
    state.foes = [];
    state.shards = [];
    state.particles = [];
    state.rings = [];
    state.popups = [];
    state.stars = makeStars();
    state.shake = 0;
    state.flash = 0;
    state.over = false;
    state.won = false;
    state.endless = false;
    state.banner = null;
  }

  /** Jump straight to a wave (the staged boss screenshot uses this). */
  function beginAtWave(wave) {
    reset();
    return startWave(wave);
  }

  /** After victory, keep playing: waves keep coming and keep getting meaner. */
  function continueEndless() {
    state.endless = true;
    state.over = false;
    state.won = true;
    state.player.alive = true;
    if (state.player.hp <= 0) state.player.hp = 1;
    return startWave(state.wave + 1);
  }

  function stepPlayer(dt, control, events) {
    const player = state.player;
    if (!player.alive) return events;
    player.vx += control.mx * PLAYER.accel * dt;
    player.vy += control.my * PLAYER.accel * dt;
    const damp = Math.max(0, 1 - PLAYER.damping * dt);
    player.vx *= damp;
    player.vy *= damp;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
    player.thrust = Math.min(1, speed / PLAYER.maxSpeed);
    if (control.ax !== player.x || control.ay !== player.y) {
      player.angle = Math.atan2(control.ay - player.y, control.ax - player.x);
    }
    if (player.invuln > 0) player.invuln -= dt;
    player.fireCd -= dt;
    if (control.fire && player.fireCd <= 0) {
      player.fireCd = PLAYER.fireInterval;
      const spread = random.range(-0.035, 0.035);
      const a = player.angle + spread;
      state.bolts.push({
        x: player.x + Math.cos(player.angle) * (player.radius + 6),
        y: player.y + Math.sin(player.angle) * (player.radius + 6),
        vx: Math.cos(a) * PLAYER.boltSpeed,
        vy: Math.sin(a) * PLAYER.boltSpeed,
        radius: PLAYER.boltRadius,
        life: 0.95,
      });
      burst(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, '#aef4ff', 2, 90, 1.8, 0.18);
      events |= EVT_SHOOT;
    }
    if (control.nova && player.nova >= PLAYER.novaCost) {
      player.nova = 0;
      state.flash = 0.8;
      state.shake = Math.min(20, state.shake + 12);
      ring(player.x, player.y, '#8dffce', 1500, 10);
      ring(player.x, player.y, '#ffffff', 1100, 5);
      state.embers = [];
      for (const foe of [...state.foes]) {
        foe.hp -= 6;
        foe.flash = 0.12;
        if (foe.hp <= 0) events = killFoe(foe, events);
      }
      state.foes = state.foes.filter((foe) => foe.hp > 0);
      if (state.boss && state.boss.hp <= 0) state.boss = null;
      events |= EVT_NOVA;
    }
    return events;
  }

  function stepFoe(dt, foe, events) {
    const player = state.player;
    const spec = FOES[foe.kind];
    foe.t += dt;
    if (foe.flash > 0) foe.flash -= dt;
    const dx = player.x - foe.x;
    const dy = player.y - foe.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const wobble = Math.sin(foe.t * 2.1 + foe.phase) * 22;

    if (foe.kind === 'dasher') {
      foe.modeTimer -= dt;
      if (foe.mode === 'stalk') {
        foe.vx = ux * foe.speed - uy * wobble * 0.4;
        foe.vy = uy * foe.speed + ux * wobble * 0.4;
        if (foe.modeTimer <= 0) { foe.mode = 'windup'; foe.modeTimer = 0.35; }
      } else if (foe.mode === 'windup') {
        foe.vx *= 0.8;
        foe.vy *= 0.8;
        foe.dashX = ux;
        foe.dashY = uy;
        if (foe.modeTimer <= 0) { foe.mode = 'dash'; foe.modeTimer = 0.32; }
      } else {
        foe.vx = foe.dashX * 540;
        foe.vy = foe.dashY * 540;
        if (foe.modeTimer <= 0) { foe.mode = 'stalk'; foe.modeTimer = random.range(0.8, 1.6); }
      }
    } else if (foe.kind === 'dreadnought') {
      if (dist > 360) {
        foe.vx = ux * foe.speed;
        foe.vy = uy * foe.speed;
      } else {
        foe.vx = (-uy * foe.orbitDir + ux * 0.12) * foe.speed * 1.6;
        foe.vy = (ux * foe.orbitDir + uy * 0.12) * foe.speed * 1.6;
      }
      foe.shotTimer -= dt;
      if (foe.shotTimer <= 0 && player.alive) {
        foe.shotTimer = 2.6;
        const base = random.angle();
        const count = 14;
        for (let i = 0; i < count; i += 1) {
          const a = base + (i / count) * TAU;
          state.embers.push({
            x: foe.x + Math.cos(a) * (foe.radius + 8),
            y: foe.y + Math.sin(a) * (foe.radius + 8),
            vx: Math.cos(a) * 148,
            vy: Math.sin(a) * 148,
            radius: 6,
            life: 6,
          });
        }
        ring(foe.x, foe.y, '#ff9d5c', 420, 4);
      }
    } else {
      foe.vx = ux * foe.speed - uy * wobble * 0.5;
      foe.vy = uy * foe.speed + ux * wobble * 0.5;
    }
    foe.x += (foe.vx + (foe.pushX || 0)) * dt;
    foe.y += (foe.vy + (foe.pushY || 0)) * dt;
    foe.pushX = (foe.pushX || 0) * Math.max(0, 1 - 8 * dt);
    foe.pushY = (foe.pushY || 0) * Math.max(0, 1 - 8 * dt);
    foe.x = Math.min(FIELD.width + 60, Math.max(-60, foe.x));
    foe.y = Math.min(FIELD.height + 60, Math.max(-60, foe.y));
    void spec;
    return events;
  }

  function step(dt, control, ambient = false) {
    let events = 0;
    state.time += dt;
    if (state.banner) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) state.banner = null;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 60 * dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - 1.8 * dt);
    for (const star of state.stars) {
      star.x -= (2 + star.layer * 5) * dt;
      if (star.x < -2) { star.x = FIELD.width + 2; star.y = random.next() * FIELD.height; }
    }

    if (ambient) {
      // Title-screen drift: a few husks wander, nothing can be hurt.
      if (state.foes.length < 6 && random.chance(0.02)) {
        const foe = spawnFoe(random.pick(['drifter', 'splitter', 'dasher']));
        foe.x = random.next() * FIELD.width;
        foe.y = random.next() * FIELD.height;
      }
      for (const foe of state.foes) {
        foe.t += dt;
        foe.x += Math.cos(foe.phase + foe.t * 0.3) * 16 * dt;
        foe.y += Math.sin(foe.phase * 2 + foe.t * 0.23) * 13 * dt;
      }
    } else if (!state.over) {
      // Wave flow.
      if (state.waveState === 'announce') {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) state.waveState = 'active';
      } else if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = Math.max(0.4, 1.05 - state.wave * 0.06);
          spawnFoe(state.spawnQueue.shift());
        }
      } else if (state.foes.length === 0 && state.waveState === 'active') {
        state.waveState = 'clear';
        state.waveTimer = 1.6;
        state.banner = { title: `WAVE ${state.wave} CLEARED`, sub: '', t: 1.6 };
        state.score += 100 * state.wave;
      } else if (state.waveState === 'clear') {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) events |= startWave(state.wave + 1);
      }
      if (state.wave === 0) events |= startWave(1);

      events = stepPlayer(dt, control, events);
      for (const foe of state.foes) events = stepFoe(dt, foe, events);

      // Foe separation, so swarms read as individuals, not a blob.
      for (let i = 0; i < state.foes.length; i += 1) {
        for (let j = i + 1; j < state.foes.length; j += 1) {
          const a = state.foes[i];
          const b = state.foes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          const min = a.radius + b.radius;
          if (d2 > 0.01 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = ((min - d) / d) * 0.5;
            a.x -= dx * push * 0.5;
            a.y -= dy * push * 0.5;
            b.x += dx * push * 0.5;
            b.y += dy * push * 0.5;
          }
        }
      }

      // Bolts against foes.
      for (const bolt of state.bolts) {
        bolt.x += bolt.vx * dt;
        bolt.y += bolt.vy * dt;
        bolt.life -= dt;
        for (const foe of state.foes) {
          if (foe.hp <= 0) continue;
          const dx = foe.x - bolt.x;
          const dy = foe.y - bolt.y;
          const rr = foe.radius + bolt.radius;
          if (dx * dx + dy * dy < rr * rr) {
            bolt.life = 0;
            foe.hp -= PLAYER.boltDamage;
            foe.flash = 0.09;
            foe.pushX = (foe.pushX || 0) + bolt.vx * 0.06 * (30 / foe.radius);
            foe.pushY = (foe.pushY || 0) + bolt.vy * 0.06 * (30 / foe.radius);
            burst(bolt.x, bolt.y, FOES[foe.kind].core, 3, 130, 1.8, 0.3);
            events |= EVT_HIT;
            if (foe.hp <= 0) events = killFoe(foe, events);
            break;
          }
        }
      }
      state.bolts = state.bolts.filter((b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20);
      state.foes = state.foes.filter((foe) => foe.hp > 0);
      if (state.boss && state.boss.hp <= 0) state.boss = null;

      // Embers and body contact against the player.
      const player = state.player;
      if (player.alive) {
        for (const ember of state.embers) {
          ember.x += ember.vx * dt;
          ember.y += ember.vy * dt;
          ember.life -= dt;
          const dx = player.x - ember.x;
          const dy = player.y - ember.y;
          const rr = player.radius + ember.radius - 2;
          if (player.invuln <= 0 && dx * dx + dy * dy < rr * rr) {
            ember.life = 0;
            events = hurtPlayer(events);
            if (!player.alive) break;
          }
        }
        state.embers = state.embers.filter((e) => e.life > 0);
        if (player.alive && player.invuln <= 0) {
          for (const foe of state.foes) {
            const dx = player.x - foe.x;
            const dy = player.y - foe.y;
            const rr = player.radius + foe.radius - 3;
            if (dx * dx + dy * dy < rr * rr) {
              foe.hp = 0;
              events = killFoe(foe, events);
              events = hurtPlayer(events);
              break;
            }
          }
          state.foes = state.foes.filter((foe) => foe.hp > 0);
          if (state.boss && state.boss.hp <= 0) state.boss = null;
        }
      } else {
        state.embers = [];
      }

      // Shards drift, home in, and are gathered.
      for (const shard of state.shards) {
        shard.t += dt;
        shard.life -= dt;
        const dx = state.player.x - shard.x;
        const dy = state.player.y - shard.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (state.player.alive && dist < PLAYER.magnetRadius) {
          const pull = 620 * (1 - dist / (PLAYER.magnetRadius + 40));
          shard.vx += (dx / dist) * pull * dt * 3;
          shard.vy += (dy / dist) * pull * dt * 3;
        }
        shard.vx *= Math.max(0, 1 - 2.4 * dt);
        shard.vy *= Math.max(0, 1 - 2.4 * dt);
        shard.x += shard.vx * dt;
        shard.y += shard.vy * dt;
        if (state.player.alive && dist < state.player.radius + shard.radius + 6) {
          shard.life = 0;
          state.player.nova = Math.min(PLAYER.novaCost, state.player.nova + SHARD.novaGain);
          state.score += 10;
          burst(shard.x, shard.y, '#8dffce', 5, 120, 2, 0.35);
          events |= EVT_PICKUP;
        }
      }
      state.shards = state.shards.filter((s) => s.life > 0);

      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
    }

    // Shared cosmetic updates.
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const r of state.rings) {
      r.life -= dt;
      r.r += r.vr * dt;
    }
    state.rings = state.rings.filter((r) => r.life > 0);
    for (const p of state.popups) {
      p.life -= dt;
      p.y += p.vy * dt;
    }
    state.popups = state.popups.filter((p) => p.life > 0);
    return events;
  }

  return { state, reset, beginAtWave, continueEndless, step };
}
