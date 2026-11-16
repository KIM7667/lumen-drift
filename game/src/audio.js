// All sound is synthesised with WebAudio — no files, no samples, nothing to
// load. Short oscillator blips and filtered noise bursts, one voice per game
// event, behind a master gain the player can mute with M. The context is
// created lazily on the first user gesture, as browsers require.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    const length = Math.floor(context.sampleRate * 0.5);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone({ freq, freqEnd = null, type = 'square', dur = 0.12, vol = 0.2, delay = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function noise({ dur = 0.3, vol = 0.3, freq = 1200, delay = 0 }) {
    if (!ensure()) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, start);
    filter.frequency.exponentialRampToValueAtTime(120, start + dur);
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    source.stop(start + dur + 0.02);
  }

  return {
    /** Call from any user gesture so later sounds are allowed to play. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone({ freq: 880, freqEnd: 320, type: 'square', dur: 0.07, vol: 0.05 });
    },
    hit() {
      tone({ freq: 300, freqEnd: 180, type: 'triangle', dur: 0.05, vol: 0.08 });
    },
    explode(big) {
      noise({ dur: big ? 0.55 : 0.28, vol: big ? 0.5 : 0.28, freq: big ? 2400 : 1600 });
      tone({ freq: big ? 160 : 220, freqEnd: 40, type: 'sawtooth', dur: big ? 0.5 : 0.25, vol: 0.22 });
    },
    pickup(combo) {
      const base = 620 + Math.min(combo, 12) * 40;
      tone({ freq: base, freqEnd: base * 1.5, type: 'sine', dur: 0.09, vol: 0.14 });
    },
    nova() {
      tone({ freq: 180, freqEnd: 1400, type: 'sawtooth', dur: 0.5, vol: 0.3 });
      noise({ dur: 0.6, vol: 0.3, freq: 3000 });
    },
    hurt() {
      tone({ freq: 200, freqEnd: 60, type: 'sawtooth', dur: 0.3, vol: 0.3 });
      noise({ dur: 0.25, vol: 0.25, freq: 900 });
    },
    wave() {
      tone({ freq: 392, type: 'triangle', dur: 0.12, vol: 0.18 });
      tone({ freq: 587, type: 'triangle', dur: 0.16, vol: 0.18, delay: 0.1 });
    },
    boss() {
      tone({ freq: 98, freqEnd: 65, type: 'sawtooth', dur: 0.7, vol: 0.3 });
      tone({ freq: 147, freqEnd: 98, type: 'sawtooth', dur: 0.7, vol: 0.2, delay: 0.05 });
    },
    victory() {
      [523, 659, 784, 1046].forEach((freq, i) => tone({ freq, type: 'triangle', dur: 0.22, vol: 0.2, delay: i * 0.12 }));
    },
    gameOver() {
      [440, 349, 262, 196].forEach((freq, i) => tone({ freq, type: 'triangle', dur: 0.25, vol: 0.2, delay: i * 0.14 }));
    },
  };
}
