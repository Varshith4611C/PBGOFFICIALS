/**
 * PBG Cubes 2048 — Web Audio Sound Engine
 * Synthesized SFX with zero external dependencies
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported');
      this.enabled = false;
    }
  }

  _play(fn) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    try { fn(this.ctx); } catch (e) { /* graceful fail */ }
  }

  /** Short bright blip when collecting a free cube */
  collect() {
    this._play(ctx => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(1000, t + 0.08);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.12);
    });
  }

  /** Two-tone ascending pop when cubes merge */
  merge() {
    this._play(ctx => {
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(440, t);
      osc1.frequency.exponentialRampToValueAtTime(880, t + 0.12);
      osc2.frequency.setValueAtTime(550, t);
      osc2.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc1.connect(gain); osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(t); osc2.start(t);
      osc1.stop(t + 0.2); osc2.stop(t + 0.2);
    });
  }

  /** Sawtooth whoosh for speed boost */
  boost() {
    this._play(ctx => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.25);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.35);
    });
  }

  /** Low crunch + chomp when eating another snake */
  eat() {
    this._play(ctx => {
      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(160, t);
      osc1.frequency.exponentialRampToValueAtTime(70, t + 0.18);
      g1.gain.setValueAtTime(0.09, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc1.connect(g1).connect(ctx.destination);
      osc1.start(t); osc1.stop(t + 0.25);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(350, t + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(120, t + 0.14);
      g2.gain.setValueAtTime(0.1, t + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(t + 0.04); osc2.stop(t + 0.18);
    });
  }

  /** Descending boom + noise burst on death */
  death() {
    this._play(ctx => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.55);

      const len = ctx.sampleRate * 0.25;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const ns = ctx.createBufferSource();
      ns.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.08, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      ns.connect(ng).connect(ctx.destination);
      ns.start(t);
    });
  }

  /** Descending triangle tone for division sign hit */
  divide() {
    this._play(ctx => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.25);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.3);
    });
  }
}
