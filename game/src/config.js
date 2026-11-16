// Lumen Drift — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical arena; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-drift.best';

export const PLAYER = {
  radius: 13,
  accel: 2400,
  maxSpeed: 335,
  damping: 4.2,
  fireInterval: 0.135,
  boltSpeed: 780,
  boltRadius: 4,
  boltDamage: 1,
  maxHp: 5,
  invulnerable: 1.6,
  magnetRadius: 120,
  novaCost: 100,
};

/** Enemy archetypes: shape, colour, toughness and behaviour in one table. */
export const FOES = {
  drifter: { radius: 15, hp: 2, speed: 74, score: 50, colour: '#b388ff', core: '#ede7ff' },
  mite: { radius: 9, hp: 1, speed: 128, score: 25, colour: '#ff8a5c', core: '#fff3e2' },
  dasher: { radius: 13, hp: 2, speed: 66, score: 80, colour: '#ff5c8a', core: '#ffe3ee' },
  splitter: { radius: 20, hp: 4, speed: 52, score: 120, colour: '#ffc44d', core: '#fff6dd' },
  wraith: { radius: 14, hp: 3, speed: 92, score: 100, colour: '#e05cff', core: '#fbe9ff' },
  bulwark: { radius: 30, hp: 14, speed: 30, score: 300, colour: '#ff5252', core: '#ffe1e1' },
  dreadnought: { radius: 58, hp: 90, speed: 17, score: 2500, colour: '#ff3860', core: '#ffd9e2' },
};

/** Waves run 1..10; clearing the wave-10 dreadnought wins the game. */
export const FINAL_WAVE = 10;
export const BOSS_WAVES = [5, 10];

/** Shards are the light a foe drops: they heal nothing, they charge the nova. */
export const SHARD = { radius: 6, novaGain: 9, killGain: 1, lifetime: 11, blinkAt: 3 };

export const COMBO = { window: 3.0, step: 0.1, maxBonus: 2.0 };

export const PALETTE = {
  deep: '#070812',
  nebulaA: '#1b1040',
  nebulaB: '#0a2340',
  nebulaC: '#300f33',
  hull: '#7ce7ff',
  hullCore: '#eafcff',
  bolt: '#aef4ff',
  ember: '#ff9d5c',
  shard: '#8dffce',
  text: '#eef4ff',
  muted: '#93a0bd',
  danger: '#ff5c7a',
  gold: '#ffd76a',
};

export const FONT = '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif';
