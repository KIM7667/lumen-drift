// A small seeded random generator (mulberry32). The whole simulation draws
// from one of these, so a seed plus a sequence of steps always replays the
// same game — that is what makes the staged screenshots reproducible.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of the array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** An angle in radians, anywhere on the circle. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}
