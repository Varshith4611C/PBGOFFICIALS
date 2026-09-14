/* ============================================
   PBG Business Board Game — Audio Engine
   Web Audio API Sound Effects & Background Music
   ============================================ */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.sfxEnabled = true;
    this.musicEnabled = false; // Started on user interaction
    this.sfxVolume = 0.8;
    this.musicVolume = 0.35;
    this.musicPlaying = false;
    this.musicInterval = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;

    // Load user preferences from localStorage
    const savedSfx = localStorage.getItem('pbg_game_sfx');
    const savedMusic = localStorage.getItem('pbg_game_music');
    if (savedSfx !== null) this.sfxEnabled = savedSfx === 'true';
    if (savedMusic !== null) this.musicEnabled = savedMusic === 'true';
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      if (this.musicEnabled) {
        this.startMusic();
      }
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ══════════════════════════════════════════
  // SOUND EFFECTS (SFX)
  // ══════════════════════════════════════════

  /** Dice Rolling Tumbling Sound */
  playDiceRoll() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const count = 7;
    for (let i = 0; i < count; i++) {
      const time = now + i * 0.05 + Math.random() * 0.02;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 + Math.random() * 180, time);
      osc.frequency.exponentialRampToValueAtTime(60, time + 0.04);

      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(time);
      osc.stop(time + 0.045);
    }
  }

  /** Token Movement Hop / Step */
  playTokenStep() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Cash / Property Purchase Chime ("Cha-Ching!") */
  playCash() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Two bright bell notes + metal coin rattle
    const notes = [987.77, 1318.51, 1567.98]; // B5, E6, G6
    notes.forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /** Rent Payment Sound */
  playRent() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [587.33, 440.00]; // D5, A4
    notes.forEach((freq, i) => {
      const t = now + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  /** Building Construction Hammer / Chime */
  playBuild() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  /** Pass GO Bonus Chime */
  playPassGo() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
    chord.forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  /** Card Draw / Modal Flip Sound */
  playCardDraw() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  /** Jail Siren / Arrest Sound */
  playJail() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(300, now + 0.2);
    osc.frequency.linearRampToValueAtTime(600, now + 0.4);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.52);
  }

  /** Bankruptcy Sound */
  playBankrupt() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [392.00, 369.99, 349.23, 311.13]; // G4, F#4, F4, D#4
    notes.forEach((freq, i) => {
      const t = now + i * 0.15;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  /** Victory Fanfare */
  playVictory() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [
      { f: 523.25, d: 0.12 }, // C5
      { f: 523.25, d: 0.12 }, // C5
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.35 }, // E5
      { f: 587.33, d: 0.15 }, // D5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.60 }, // G5
    ];

    let t = now;
    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + n.d + 0.05);

      t += n.d * 0.95;
    });
  }

  /** UI Button Click */
  playClick() {
    if (!this.sfxEnabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // ══════════════════════════════════════════
  // BACKGROUND MUSIC (BGM) — SYNTH LOUNGE GROOVE
  // ══════════════════════════════════════════

  startMusic() {
    if (this.musicPlaying) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.musicPlaying = true;
    this.musicEnabled = true;
    localStorage.setItem('pbg_game_music', 'true');

    // Relaxed upbeat jazz / lo-fi business chord progression
    // Chord sequence in key of F Major: Fmaj7 -> Dm7 -> Gm7 -> C7
    const chords = [
      [349.23, 440.00, 523.25, 659.25], // F4, A4, C5, E5
      [293.66, 349.23, 440.00, 523.25], // D4, F4, A4, C5
      [392.00, 466.16, 587.33, 698.46], // G4, Bb4, D5, F5
      [261.63, 329.63, 392.00, 466.16], // C4, E4, G4, Bb4
    ];

    const bassNotes = [174.61, 146.83, 196.00, 130.81]; // F3, D3, G3, C3
    let chordIdx = 0;
    const stepDuration = 1.6; // seconds per chord measure

    const playMeasure = () => {
      if (!this.musicPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;
      const currentChord = chords[chordIdx % chords.length];
      const currentBass = bassNotes[chordIdx % bassNotes.length];

      // 1. Play Soft Electric Piano Chord
      currentChord.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.002, now + stepDuration * 0.9);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + stepDuration);
      });

      // 2. Play Mellow Bass Note
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(currentBass, now);
      bassGain.gain.setValueAtTime(0.12, now);
      bassGain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 0.85);

      bassOsc.connect(bassGain);
      bassGain.connect(this.musicGain);

      bassOsc.start(now);
      bassOsc.stop(now + stepDuration);

      // 3. Subtle Hi-Hat Rhythm
      for (let b = 0; b < 4; b++) {
        const beatTime = now + b * (stepDuration / 4);
        const noiseOsc = this.ctx.createOscillator();
        const noiseGain = this.ctx.createGain();

        noiseOsc.type = 'square';
        noiseOsc.frequency.setValueAtTime(4000 + Math.random() * 2000, beatTime);

        noiseGain.gain.setValueAtTime(0.015, beatTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, beatTime + 0.03);

        noiseOsc.connect(noiseGain);
        noiseGain.connect(this.musicGain);

        noiseOsc.start(beatTime);
        noiseOsc.stop(beatTime + 0.035);
      }

      chordIdx++;
    };

    playMeasure();
    this.musicInterval = setInterval(playMeasure, stepDuration * 1000);
  }

  stopMusic() {
    this.musicPlaying = false;
    this.musicEnabled = false;
    localStorage.setItem('pbg_game_music', 'false');
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  toggleMusic() {
    if (this.musicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    localStorage.setItem('pbg_game_sfx', this.sfxEnabled.toString());
    return this.sfxEnabled;
  }
}

// Global Sound Engine Instance
const sound = new SoundEngine();

// Enable audio on first user click anywhere
document.addEventListener('click', () => {
  sound.ensureContext();
}, { once: true });
