// Keyboard and mouse, read as one control object the world understands.
// Movement comes from WASD or the arrow keys, aim from the mouse, fire from
// the mouse button or Space, and the nova from Shift, E or the right button.
// One-shot actions (confirm, pause, mute) are queued as bits and drained by
// the caller once a frame, so a press between frames is never lost.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const CONFIRM_KEYS = new Set(['Space', 'Enter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false, rightDown: false, inside: false };
  let queued = 0;
  // The canvas fills the window; the renderer reports where the logical
  // arena sits inside it, so aim can be converted to arena coordinates.
  let view = { scale: 1, offsetX: 0, offsetY: 0 };

  function toArena(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (clientX - rect.left - view.offsetX) / view.scale;
    mouse.y = (clientY - rect.top - view.offsetY) / view.scale;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM_KEYS.has(event.code)) queued |= ACTION_CONFIRM;
    if (PAUSE_KEYS.has(event.code)) queued |= ACTION_PAUSE;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointermove', (event) => {
    mouse.inside = true;
    toArena(event.clientX, event.clientY);
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.inside = true;
    toArena(event.clientX, event.clientY);
    if (event.button === 0) {
      mouse.down = true;
      queued |= ACTION_CONFIRM;
    }
    if (event.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** Tell input where the renderer placed the arena this frame. */
    setView(next) {
      view = next;
    },
    /** The movement direction the keys ask for, as a unit vector (or zero). */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** The full control object for one simulation step. */
    control(player) {
      const move = this.direction();
      return {
        mx: move.x,
        my: move.y,
        ax: mouse.inside ? mouse.x : player.x + 100,
        ay: mouse.inside ? mouse.y : player.y,
        fire: mouse.down || held.has('Space'),
        nova: mouse.rightDown || held.has('ShiftLeft') || held.has('ShiftRight') || held.has('KeyE'),
      };
    },
    /** Drain the one-shot actions pressed since the last call. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
