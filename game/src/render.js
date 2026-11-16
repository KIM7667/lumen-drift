// Everything the player sees: the nebula and starfield, the light-sprite and
// the husks drawn as glowing geometric sigils, bolts, embers, shards,
// particles, rings and floating scores, the HUD, and the four screens
// (title, paused, game over, victory). Glow is pre-rendered to offscreen
// sprites at boot so the frame itself stays cheap; the renderer only reads
// the world state, and every wobble derives from state.time, so a staged
// scene always paints the same frame.

import { BOSS_WAVES, FIELD, FONT, FOES, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;

/** A radial glow sprite: bright core falling off to transparent colour. */
function glowSprite(colour, core) {
  const size = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, core);
  grad.addColorStop(0.25, colour);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** The static deep-space backdrop: near-black blue with three nebula blooms. */
function nebulaCanvas() {
  const c = document.createElement('canvas');
  c.width = FIELD.width;
  c.height = FIELD.height;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.deep;
  g.fillRect(0, 0, c.width, c.height);
  const blooms = [
    [300, 180, 420, PALETTE.nebulaA],
    [980, 520, 480, PALETTE.nebulaB],
    [1020, 120, 320, PALETTE.nebulaC],
    [420, 600, 300, PALETTE.nebulaB],
  ];
  for (const [x, y, r, colour] of blooms) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, colour);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.55;
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  return c;
}

function polygon(g, x, y, radius, sides, rotation) {
  g.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

const FOE_SIDES = { drifter: 3, mite: 3, dasher: 4, splitter: 5, bulwark: 6, dreadnought: 10 };

export function createRenderer(canvas) {
  const g = canvas.getContext('2d');
  const nebula = nebulaCanvas();
  const sprites = {};
  for (const [kind, spec] of Object.entries(FOES)) sprites[kind] = glowSprite(spec.colour, spec.core);
  sprites.shard = glowSprite('#8dffce', '#eafff5');
  sprites.bolt = glowSprite('#aef4ff', '#ffffff');
  sprites.ember = glowSprite('#ff9d5c', '#fff0dd');
  sprites.player = glowSprite('#7ce7ff', '#ffffff');

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawGlow(sprite, x, y, size, alpha) {
    g.globalAlpha = alpha;
    g.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    g.globalAlpha = 1;
  }

  function drawFoe(foe) {
    const spec = FOES[foe.kind];
    const spin = foe.t * (foe.kind === 'dreadnought' ? 0.25 : 0.7) + foe.phase;
    drawGlow(sprites[foe.kind], foe.x, foe.y, foe.radius * 4.4, 0.5);
    if (foe.kind === 'dasher') {
      // A dart, drawn pointing along its motion rather than as a polygon.
      const a = Math.atan2(foe.vy, foe.vx);
      g.save();
      g.translate(foe.x, foe.y);
      g.rotate(a);
      g.beginPath();
      g.moveTo(foe.radius * 1.5, 0);
      g.lineTo(-foe.radius, foe.radius * 0.72);
      g.lineTo(-foe.radius * 0.45, 0);
      g.lineTo(-foe.radius, -foe.radius * 0.72);
      g.closePath();
      g.fillStyle = foe.flash > 0 ? '#ffffff' : spec.colour;
      g.fill();
      g.restore();
    } else {
      polygon(g, foe.x, foe.y, foe.radius, FOE_SIDES[foe.kind], spin);
      g.fillStyle = foe.flash > 0 ? '#ffffff' : spec.colour;
      g.globalAlpha = 0.92;
      g.fill();
      g.globalAlpha = 1;
      polygon(g, foe.x, foe.y, foe.radius * 0.55, FOE_SIDES[foe.kind], -spin * 1.4);
      g.fillStyle = spec.core;
      g.globalAlpha = 0.85;
      g.fill();
      g.globalAlpha = 1;
    }
    if (foe.kind === 'dasher' && foe.mode === 'windup') {
      g.strokeStyle = 'rgba(255,92,138,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(foe.x, foe.y, foe.radius + 6 + Math.sin(foe.t * 40) * 2, 0, TAU);
      g.stroke();
    }
    if (foe.maxHp > 4 && foe.kind !== 'dreadnought' && foe.hp < foe.maxHp) {
      const w = foe.radius * 1.7;
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(foe.x - w / 2, foe.y - foe.radius - 12, w, 4);
      g.fillStyle = spec.colour;
      g.fillRect(foe.x - w / 2, foe.y - foe.radius - 12, (w * foe.hp) / foe.maxHp, 4);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    if (p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0 && state.time > 1) {
      // Blink while invulnerable — but not during the first staged second.
      if (p.invuln < PLAYER.invulnerable - 0.05) { /* still draw, softer */ }
    }
    const blink = p.invuln > 0.15 && Math.floor(state.time * 12) % 2 === 0;
    drawGlow(sprites.player, p.x, p.y, 120, blink ? 0.25 : 0.6);
    // Engine flame, behind the hull, sized by thrust.
    const flame = (10 + p.thrust * 16) * (0.85 + 0.3 * Math.sin(state.time * 31));
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.angle);
    g.beginPath();
    g.moveTo(-p.radius - flame, 0);
    g.lineTo(-p.radius + 2, -5);
    g.lineTo(-p.radius + 2, 5);
    g.closePath();
    g.fillStyle = 'rgba(255,170,80,0.85)';
    g.fill();
    // The hull: a sleek arrow of light.
    g.beginPath();
    g.moveTo(p.radius + 7, 0);
    g.lineTo(-p.radius, -p.radius * 0.85);
    g.lineTo(-p.radius * 0.45, 0);
    g.lineTo(-p.radius, p.radius * 0.85);
    g.closePath();
    g.fillStyle = blink ? 'rgba(124,231,255,0.45)' : PALETTE.hull;
    g.fill();
    g.beginPath();
    g.arc(0, 0, 4.5, 0, TAU);
    g.fillStyle = PALETTE.hullCore;
    g.fill();
    g.restore();
    if (p.nova >= PLAYER.novaCost) {
      g.strokeStyle = `rgba(141,255,206,${0.55 + 0.35 * Math.sin(state.time * 6)})`;
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(p.x, p.y, p.radius + 10, 0, TAU);
      g.stroke();
    }
  }

  function drawWorld(state) {
    const driftX = Math.sin(state.time * 0.05) * 5;
    const driftY = Math.cos(state.time * 0.04) * 4;
    g.drawImage(nebula, driftX - 6, driftY - 5, FIELD.width + 12, FIELD.height + 10);
    for (const star of state.stars) {
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(state.time * star.tw + star.x));
      g.globalAlpha = twinkle * (0.35 + star.layer * 0.3);
      g.fillStyle = '#dfe9ff';
      g.beginPath();
      g.arc(star.x, star.y, star.r, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    for (const shard of state.shards) {
      const fade = shard.life < 3 ? (Math.floor(shard.life * 6) % 2 === 0 ? 0.35 : 1) : 1;
      const pulse = 1 + 0.18 * Math.sin(shard.t * 5);
      drawGlow(sprites.shard, shard.x, shard.y, 44 * pulse, 0.75 * fade);
      g.save();
      g.translate(shard.x, shard.y);
      g.rotate(shard.t * 2);
      g.globalAlpha = fade;
      g.fillStyle = '#8dffce';
      g.fillRect(-4.5, -4.5, 9, 9);
      g.restore();
      g.globalAlpha = 1;
    }
    for (const ember of state.embers) drawGlow(sprites.ember, ember.x, ember.y, 34, 0.9);
    for (const foe of state.foes) drawFoe(foe);
    for (const bolt of state.bolts) drawGlow(sprites.bolt, bolt.x, bolt.y, 30, 0.95);
    drawPlayer(state);
    for (const p of state.particles) {
      g.globalAlpha = Math.max(0, p.life / p.maxLife);
      g.fillStyle = p.colour;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    for (const r of state.rings) {
      g.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
      g.strokeStyle = r.colour;
      g.lineWidth = r.width;
      g.beginPath();
      g.arc(r.x, r.y, r.r, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    for (const p of state.popups) {
      g.globalAlpha = Math.max(0, p.life / p.maxLife);
      g.font = `700 ${p.size}px ${FONT}`;
      g.fillStyle = p.colour;
      g.fillText(p.text, p.x, p.y);
    }
    g.globalAlpha = 1;
  }

  function heart(x, y, size, filled) {
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    g.fillStyle = filled ? PALETTE.danger : 'rgba(255,92,122,0.22)';
    g.fillRect(-size / 2, -size / 2, size, size);
    g.restore();
  }

  function drawHud(state, best) {
    const p = state.player;
    g.textAlign = 'left';
    for (let i = 0; i < PLAYER.maxHp; i += 1) heart(34 + i * 26, 34, 13, i < p.hp);
    g.font = `600 12px ${FONT}`;
    g.fillStyle = PALETTE.muted;
    g.fillText('HULL', 22, 58);
    g.textAlign = 'right';
    g.font = `800 30px ${FONT}`;
    g.fillStyle = PALETTE.text;
    g.fillText(String(state.score).padStart(6, '0'), FIELD.width - 24, 42);
    g.font = `600 13px ${FONT}`;
    g.fillStyle = PALETTE.muted;
    g.fillText(`BEST ${Math.max(best, state.score)}`, FIELD.width - 24, 62);
    if (state.combo > 1) {
      const mult = (1 + Math.min(state.combo, 20) * 0.1).toFixed(1);
      g.font = `800 17px ${FONT}`;
      g.fillStyle = PALETTE.gold;
      g.fillText(`COMBO x${mult}`, FIELD.width - 24, 88);
      g.fillStyle = 'rgba(255,215,106,0.3)';
      g.fillRect(FIELD.width - 24 - 92, 94, 92, 3);
      g.fillStyle = PALETTE.gold;
      g.fillRect(FIELD.width - 24 - 92, 94, 92 * Math.max(0, state.comboTimer / 3), 3);
    }
    g.textAlign = 'center';
    g.font = `800 19px ${FONT}`;
    g.fillStyle = PALETTE.text;
    g.fillText(BOSS_WAVES.includes(state.wave) ? `WAVE ${state.wave} — DREADNOUGHT` : `WAVE ${state.wave}`, FIELD.width / 2, 38);
    if (state.boss) {
      const w = 420;
      const frac = Math.max(0, state.boss.hp / state.boss.maxHp);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(FIELD.width / 2 - w / 2, 48, w, 8);
      g.fillStyle = '#ff3860';
      g.fillRect(FIELD.width / 2 - w / 2, 48, w * frac, 8);
    }
    // Nova charge, bottom centre.
    const w = 300;
    const x = FIELD.width / 2 - w / 2;
    const y = FIELD.height - 30;
    const ready = p.nova >= PLAYER.novaCost;
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(x, y, w, 9);
    g.fillStyle = ready ? '#8dffce' : 'rgba(141,255,206,0.55)';
    g.fillRect(x, y, (w * p.nova) / PLAYER.novaCost, 9);
    g.font = `700 12px ${FONT}`;
    g.fillStyle = ready ? '#8dffce' : PALETTE.muted;
    const label = ready ? 'NOVA READY — SHIFT / E / RIGHT CLICK' : 'NOVA — gather light shards';
    g.fillText(label, FIELD.width / 2, y - 8);
  }

  function drawBanner(state) {
    if (!state.banner) return;
    const b = state.banner;
    const alpha = Math.min(1, b.t / 0.5, (2.0 - b.t) / 0.4 + 0.6);
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, alpha));
    g.textAlign = 'center';
    g.font = `800 44px ${FONT}`;
    g.fillStyle = PALETTE.text;
    g.shadowColor = 'rgba(124,231,255,0.8)';
    g.shadowBlur = 24;
    g.fillText(b.title, FIELD.width / 2, 150);
    g.shadowBlur = 0;
    if (b.sub) {
      g.font = `600 17px ${FONT}`;
      g.fillStyle = PALETTE.muted;
      g.fillText(b.sub, FIELD.width / 2, 182);
    }
    g.restore();
  }

  function panel(alpha = 0.55) {
    g.fillStyle = `rgba(4,5,12,${alpha})`;
    g.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function bigTitle(text, y, size, colourA, colourB) {
    const grad = g.createLinearGradient(0, y - size, 0, y);
    grad.addColorStop(0, colourA);
    grad.addColorStop(1, colourB);
    g.font = `900 ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.shadowColor = colourB;
    g.shadowBlur = 34;
    g.fillStyle = grad;
    g.fillText(text, FIELD.width / 2, y);
    g.shadowBlur = 0;
  }

  function drawTitle(state, best) {
    panel(0.34);
    bigTitle('LUMEN DRIFT', 268, 92, '#eafcff', '#4fc3f7');
    g.textAlign = 'center';
    g.font = `600 21px ${FONT}`;
    g.fillStyle = PALETTE.text;
    g.fillText('The dark is eating the stars. Take the light back.', FIELD.width / 2, 316);
    g.font = `500 17px ${FONT}`;
    g.fillStyle = PALETTE.muted;
    const lines = [
      'Pilot the last light-sprite through 10 waves of husks.',
      'Gather the shards they drop to charge your Nova.',
      'Bring down the Dreadnoughts on waves 5 and 10 — restore the dawn.',
      '',
      'WASD / arrows — move        Mouse — aim        Click / Space — fire',
      'Shift / E / right click — Nova (when charged)        P — pause        M — mute',
    ];
    lines.forEach((line, i) => g.fillText(line, FIELD.width / 2, 372 + i * 26));
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    g.globalAlpha = pulse;
    g.font = `800 23px ${FONT}`;
    g.fillStyle = PALETTE.gold;
    g.fillText('CLICK OR PRESS SPACE TO FLY', FIELD.width / 2, 592);
    g.globalAlpha = 1;
    if (best > 0) {
      g.font = `600 15px ${FONT}`;
      g.fillStyle = PALETTE.muted;
      g.fillText(`Best score ${best}`, FIELD.width / 2, 632);
    }
  }

  function statsLines(state, best) {
    return [
      `SCORE  ${state.score}`,
      `BEST  ${Math.max(best, state.score)}`,
      `WAVE REACHED  ${state.wave} / 10`,
      `HUSKS SHATTERED  ${state.kills}`,
    ];
  }

  function drawOver(state, best) {
    panel(0.6);
    bigTitle('THE LIGHT GOES OUT', 250, 58, '#ffd9e2', '#ff3860');
    g.textAlign = 'center';
    g.font = `600 19px ${FONT}`;
    g.fillStyle = PALETTE.text;
    statsLines(state, best).forEach((line, i) => g.fillText(line, FIELD.width / 2, 330 + i * 32));
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    g.globalAlpha = pulse;
    g.font = `800 22px ${FONT}`;
    g.fillStyle = PALETTE.gold;
    g.fillText('PRESS SPACE OR CLICK TO FLY AGAIN', FIELD.width / 2, 520);
    g.globalAlpha = 1;
  }

  function drawVictory(state, best) {
    panel(0.5);
    bigTitle('DAWN RESTORED', 250, 64, '#fff6dd', '#ffd76a');
    g.textAlign = 'center';
    g.font = `600 19px ${FONT}`;
    g.fillStyle = PALETTE.text;
    g.fillText('The last Dreadnought breaks apart, and the stars come back on.', FIELD.width / 2, 300);
    statsLines(state, best).forEach((line, i) => g.fillText(line, FIELD.width / 2, 348 + i * 32));
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3.2);
    g.globalAlpha = pulse;
    g.font = `800 22px ${FONT}`;
    g.fillStyle = PALETTE.gold;
    g.fillText('PRESS SPACE TO KEEP DRIFTING — ENDLESS', FIELD.width / 2, 540);
    g.globalAlpha = 1;
  }

  function draw(state, screen, best) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.translate(offsetX, offsetY);
    g.scale(scale, scale);
    if (state.shake > 0.2) {
      const sx = Math.sin(state.time * 91) * state.shake * 0.55;
      const sy = Math.cos(state.time * 113) * state.shake * 0.55;
      g.translate(sx, sy);
    }
    g.save();
    g.beginPath();
    g.rect(0, 0, FIELD.width, FIELD.height);
    g.clip();
    drawWorld(state);
    if (screen !== SCREEN_TITLE) drawHud(state, best);
    drawBanner(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_PAUSED) {
      panel(0.5);
      bigTitle('PAUSED', 340, 54, '#eafcff', '#4fc3f7');
      g.textAlign = 'center';
      g.font = `600 18px ${FONT}`;
      g.fillStyle = PALETTE.text;
      g.fillText('Press P or Space to keep flying', FIELD.width / 2, 396);
    }
    if (screen === SCREEN_OVER) drawOver(state, best);
    if (screen === SCREEN_VICTORY) drawVictory(state, best);
    if (state.flash > 0) {
      g.fillStyle = `rgba(255,246,220,${(state.flash * 0.4).toFixed(3)})`;
      g.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (state.player && state.player.hp === 1 && state.player.alive && screen === SCREEN_PLAY) {
      const pulse = 0.1 + 0.08 * Math.sin(state.time * 5);
      const grad = g.createRadialGradient(640, 360, 260, 640, 360, 720);
      grad.addColorStop(0, 'rgba(255,40,70,0)');
      grad.addColorStop(1, `rgba(255,40,70,${pulse.toFixed(3)})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    g.restore();
  }

  return {
    draw,
    /** Where the arena sits in the window, for input's aim conversion. */
    view() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      return { scale: scale / dpr, offsetX: offsetX / dpr, offsetY: offsetY / dpr };
    },
  };
}
