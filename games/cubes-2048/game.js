/**
 * ============================================
 * PBG Cubes 2048 — Full Game Engine
 * Snake × 2048 merge arena with AI bots
 * ============================================
 */

/* ─── Constants ─── */
const ARENA_W = 4000;
const ARENA_H = 4000;
const CUBE_SIZE = 30;
const SEG_SPACING = 34;
const BASE_SPEED = 180;      // px/s
const BOOST_SPEED = 340;
const BOOST_DURATION = 2000;  // ms
const BOOST_COOLDOWN = 6000;  // ms
const FREE_CUBE_COUNT = 220;
const DIVISION_COUNT = 8;
const BOT_COUNT = 10;
const MAX_PARTICLES = 300;
const MERGE_CHECK_INTERVAL = 150; // ms
const AI_RETHINK_INTERVAL = 800;  // ms

/* ─── Neon Cube Color Palette ─── */
const CUBE_COLORS = {
  2:    '#43e97b',
  4:    '#38f9d7',
  8:    '#fa709a',
  16:   '#fee140',
  32:   '#c084fc',
  64:   '#60a5fa',
  128:  '#fb923c',
  256:  '#a78bfa',
  512:  '#34d399',
  1024: '#f59e0b',
  2048: '#f43f5e',
  4096: '#a3e635',
  8192: '#e879f9',
};

function cubeColor(val) {
  if (CUBE_COLORS[val]) return CUBE_COLORS[val];
  // Procedural for higher values
  const hue = (Math.log2(val) * 47) % 360;
  return `hsl(${hue}, 80%, 60%)`;
}

const BOT_NAMES = [
  'CubeKing', 'MergeBot', 'BlockSnake', 'NeonWorm', 'PixelViper',
  'GridHunter', 'MegaCube', 'SlitherX', 'BlockChain', 'CubeNinja',
  'DigitWorm', 'NumCrush', 'ByteSnake', 'CubeFury', 'VoxelWorm',
];

/* ─── Utility Functions ─── */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
function dist(x1, y1, x2, y2) { const dx = x1 - x2, dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }
function distSq(x1, y1, x2, y2) { const dx = x1 - x2, dy = y1 - y2; return dx * dx + dy * dy; }
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/* ─── Game Class ─── */
class Game {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = sound;
    this.state = 'menu';  // menu | playing | gameover

    // World
    this.entities = [];
    this.freeCubes = [];
    this.divSigns = [];
    this.particles = [];
    this.player = null;

    // Camera
    this.cam = { x: ARENA_W / 2, y: ARENA_H / 2, zoom: 1, targetZoom: 1 };

    // Input
    this.mouse = { x: 0, y: 0 };       // screen coords
    this.worldMouse = { x: 0, y: 0 };   // world coords
    this.isMouseControl = false;
    this.wantBoost = false;
    this.joystickAngle = null; // mobile joystick

    // Timing
    this.lastTime = 0;
    this.lastMergeCheck = 0;
    this.elapsed = 0;

    // Stats
    this.stats = { maxScore: 0, cubesEaten: 0, merges: 0, botsEaten: 0, timeSurvived: 0 };

    // Leaderboard cache
    this.leaderboard = [];

    // Multiplayer Engine
    this.isMultiplayer = false;
    this.multiplayer = typeof CubesMultiplayerClient !== 'undefined' ? new CubesMultiplayerClient(this) : null;

    this.resize();
    this.setupInput();
    window.addEventListener('resize', () => this.resize());
  }

  /* ── Resize ── */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.screenW = window.innerWidth;
    this.screenH = window.innerHeight;
  }

  /* ── Input Setup ── */
  setupInput() {
    // Mouse move → target direction (desktop)
    this.canvas.addEventListener('mousemove', e => {
      this.isMouseControl = true;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    // Boost: left-click or space (desktop)
    this.canvas.addEventListener('mousedown', e => { if (e.button === 0) this.wantBoost = true; });
    this.canvas.addEventListener('mouseup', e => { if (e.button === 0) this.wantBoost = false; });
    window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); this.wantBoost = true; } });
    window.addEventListener('keyup', e => { if (e.code === 'Space') this.wantBoost = false; });

    // Touch controls: dynamic floating joystick & right-screen touch boost
    this.setupTouchControls();

    // Mobile leaderboard toggle
    this.setupLeaderboardToggle();
  }

  setupTouchControls() {
    const el = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const boostBtn = document.getElementById('mobile-boost-btn');

    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.boostTouchIds = new Set();

    // Dedicated mobile boost button
    if (boostBtn) {
      boostBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          this.boostTouchIds.add(e.changedTouches[i].identifier);
        }
        this.wantBoost = true;
      }, { passive: false });

      const endBoostBtn = e => {
        e.preventDefault();
        e.stopPropagation();
        for (let i = 0; i < e.changedTouches.length; i++) {
          this.boostTouchIds.delete(e.changedTouches[i].identifier);
        }
        if (this.boostTouchIds.size === 0) this.wantBoost = false;
      };
      boostBtn.addEventListener('touchend', endBoostBtn, { passive: false });
      boostBtn.addEventListener('touchcancel', endBoostBtn, { passive: false });
    }

    const isInteractiveUI = target => {
      return target && (
        target.closest('#hud-top') ||
        target.closest('#hud-leaderboard') ||
        target.closest('#mobile-boost-btn') ||
        target.closest('.overlay-card') ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input')
      );
    };

    window.addEventListener('touchstart', e => {
      // Tap outside open mobile leaderboard to close it
      const lb = document.getElementById('hud-leaderboard');
      if (lb && lb.classList.contains('mobile-open') && !e.target.closest('#hud-leaderboard') && !e.target.closest('#btn-lb-toggle')) {
        lb.classList.remove('mobile-open');
      }

      if (isInteractiveUI(e.target)) return;
      if (this.state !== 'playing') return;

      e.preventDefault();
      this.isMouseControl = false;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.joystickTouchId === null && el && knob) {
          // Dynamic floating joystick under thumb
          this.joystickTouchId = t.identifier;
          this.joystickOrigin = { x: t.clientX, y: t.clientY };

          el.style.left = `${t.clientX}px`;
          el.style.top = `${t.clientY}px`;
          knob.style.transform = 'translate(-50%, -50%)';
          el.classList.add('active');
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      if (this.state !== 'playing') return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (t.identifier === this.joystickTouchId && knob) {
          e.preventDefault();
          const dx = t.clientX - this.joystickOrigin.x;
          const dy = t.clientY - this.joystickOrigin.y;
          const maxDist = 42;
          const d = Math.hypot(dx, dy);
          const clamped = Math.min(d, maxDist);
          const angle = Math.atan2(dy, dx);
          const kx = Math.cos(angle) * clamped;
          const ky = Math.sin(angle) * clamped;

          knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

          if (d > 6) {
            this.joystickAngle = angle;
          }
        }
      }
    }, { passive: false });

    const handleTouchEnd = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (t.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.joystickAngle = null;
          if (el) el.classList.remove('active');
          if (knob) knob.style.transform = 'translate(-50%, -50%)';
        }

        if (this.boostTouchIds.has(t.identifier)) {
          this.boostTouchIds.delete(t.identifier);
          if (this.boostTouchIds.size === 0) {
            this.wantBoost = false;
          }
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  setupLeaderboardToggle() {
    const toggleBtn = document.getElementById('btn-lb-toggle');
    const closeBtn = document.getElementById('lb-close');
    const lb = document.getElementById('hud-leaderboard');

    if (toggleBtn && lb) {
      toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        lb.classList.toggle('mobile-open');
      });
    }

    if (closeBtn && lb) {
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        lb.classList.remove('mobile-open');
      });
    }
  }

  /* ── World → Screen transforms ── */
  w2sx(wx) { return (wx - this.cam.x) * this.cam.zoom + this.screenW / 2; }
  w2sy(wy) { return (wy - this.cam.y) * this.cam.zoom + this.screenH / 2; }
  s2wx(sx) { return (sx - this.screenW / 2) / this.cam.zoom + this.cam.x; }
  s2wy(sy) { return (sy - this.screenH / 2) / this.cam.zoom + this.cam.y; }

  /* ── Create Entity (Snake) ── */
  createEntity(name, x, y, isPlayer, startValue = 2, startLen = 1) {
    const hue = Math.floor(rand(0, 360));
    const segments = [];
    for (let i = 0; i < startLen; i++) {
      segments.push({ x: x - i * SEG_SPACING, y: y, value: startValue, scale: 1.0, isAttaching: false });
    }
    return {
      segments,
      angle: 0,
      targetAngle: 0,
      speed: BASE_SPEED,
      boosting: false,
      boostTimer: 0,
      boostCooldown: 0,
      name,
      hue,
      alive: true,
      isPlayer,
      currentAnim: null,
      // AI state
      aiState: 'wander',
      aiTarget: { x: rand(200, ARENA_W - 200), y: rand(200, ARENA_H - 200) },
      aiTimer: 0,
    };
  }

  /* ── Create Bot with Valid Descending Cubes ── */
  createBotEntity(name, x, y, maxVal) {
    const values = [maxVal];
    let curr = maxVal;
    const extra = randInt(0, 3);
    for (let i = 0; i < extra; i++) {
      curr = Math.floor(curr / 2);
      if (curr < 2) break;
      if (Math.random() > 0.35) {
        values.push(curr);
      }
    }
    const e = this.createEntity(name, x, y, false, values[0], values.length);
    for (let i = 0; i < values.length; i++) {
      e.segments[i].value = values[i];
      e.segments[i].scale = 1.0;
      e.segments[i].isAttaching = false;
    }
    return e;
  }

  /* ── Compute entity total score ── */
  entityScore(e) {
    let s = 0;
    for (const seg of e.segments) s += seg.value;
    return s;
  }

  /* ── Start a New Game ── */
  startGame(playerName, isMultiplayer = false) {
    this.isMultiplayer = isMultiplayer;
    if (!isMultiplayer && this.multiplayer) {
      this.multiplayer.leave();
    }
    this.sound.init();
    this.entities = [];
    this.freeCubes = [];
    this.divSigns = [];
    this.particles = [];
    this.stats = { maxScore: 0, cubesEaten: 0, merges: 0, botsEaten: 0, timeSurvived: 0 };
    this.elapsed = 0;
    this.wantBoost = false;
    this.joystickAngle = null;
    this.joystickTouchId = null;
    this.isMouseControl = false;
    if (this.boostTouchIds) this.boostTouchIds.clear();
    const el = document.getElementById('joystick-zone');
    if (el) el.classList.remove('active');
    const lb = document.getElementById('hud-leaderboard');
    if (lb) lb.classList.remove('mobile-open');

    // Spawn player at center with length 1 (value 2)
    this.player = this.createEntity(playerName || 'Player', ARENA_W / 2, ARENA_H / 2, true, 2, 1);
    this.entities.push(this.player);

    // Spawn bots with descending powers of 2
    const usedNames = new Set();
    const botCount = isMultiplayer ? 4 : BOT_COUNT;
    for (let i = 0; i < botCount; i++) {
      let name;
      do { name = pick(BOT_NAMES); } while (usedNames.has(name));
      usedNames.add(name);
      const x = rand(300, ARENA_W - 300);
      const y = rand(300, ARENA_H - 300);
      const startVal = pick([2, 4, 4, 8, 8, 16, 32]);
      const bot = this.createBotEntity(name, x, y, startVal);
      this.entities.push(bot);
    }

    // Spawn free cubes
    for (let i = 0; i < FREE_CUBE_COUNT; i++) {
      this.freeCubes.push(this.spawnFreeCube());
    }

    // Spawn division signs
    for (let i = 0; i < DIVISION_COUNT; i++) {
      this.divSigns.push({
        x: rand(200, ARENA_W - 200),
        y: rand(200, ARENA_H - 200),
        alive: true,
        respawn: 0,
      });
    }

    this.cam.x = this.player.segments[0].x;
    this.cam.y = this.player.segments[0].y;
    this.state = 'playing';
  }

  /* ── Start Multiplayer Match ── */
  startMultiplayerGame(playerName, roomCode, isHost) {
    this.startGame(playerName, true);
  }

  createRemoteEntity(socketId, name, hue) {
    const e = this.createEntity(name || 'Online Player', rand(500, ARENA_W - 500), rand(500, ARENA_H - 500), false, 2, 1);
    e.socketId = socketId;
    e.isRemotePlayer = true;
    e.hue = hue !== undefined ? hue : 280;
    e.targetX = e.segments[0].x;
    e.targetY = e.segments[0].y;
    e.targetAngle = 0;
    e.remoteSegments = [{ value: 2, x: e.targetX, y: e.targetY }];
    this.entities.push(e);
    return e;
  }

  spawnFreeCube() {
    return {
      id: Math.random().toString(36).substring(2, 9),
      x: rand(80, ARENA_W - 80),
      y: rand(80, ARENA_H - 80),
      value: pick([2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 8, 8, 16]),
      alive: true,
      bobPhase: rand(0, Math.PI * 2),
    };
  }

  /* ── Main Update ── */
  update(dt) {
    this.elapsed += dt * 1000;
    this.stats.timeSurvived += dt;

    // Player target angle from mouse/joystick
    if (this.player && this.player.alive) {
      if (this.joystickAngle !== null) {
        this.player.targetAngle = this.joystickAngle;
      } else if (this.isMouseControl) {
        const head = this.player.segments[0];
        const sx = this.w2sx(head.x);
        const sy = this.w2sy(head.y);
        this.player.targetAngle = Math.atan2(this.mouse.y - sy, this.mouse.x - sx);
      }
      // If neither is actively driving an angle (e.g. mobile joystick was released):
      // The snake continues in whichever direction it was already heading!
    }

    // Multiplayer state sync & remote player interpolation
    if (this.isMultiplayer && this.multiplayer) {
      this.multiplayer.broadcastState(performance.now());

      for (const [sId, rem] of this.multiplayer.remotePlayers.entries()) {
        if (!rem || !rem.alive) continue;
        const head = rem.segments[0];
        if (head && rem.targetX !== undefined) {
          head.x += (rem.targetX - head.x) * 0.28;
          head.y += (rem.targetY - head.y) * 0.28;
          rem.angle = lerpAngle(rem.angle, rem.targetAngle || 0, 0.25);
        }
        if (rem.remoteSegments && rem.remoteSegments.length) {
          while (rem.segments.length < rem.remoteSegments.length) {
            rem.segments.push({
              x: head.x,
              y: head.y,
              value: 2,
              scale: 1,
              isAttaching: false,
            });
          }
          while (rem.segments.length > rem.remoteSegments.length) {
            rem.segments.pop();
          }
          for (let s = 0; s < rem.remoteSegments.length; s++) {
            rem.segments[s].value = rem.remoteSegments[s].value;
            rem.segments[s].x += (rem.remoteSegments[s].x - rem.segments[s].x) * 0.28;
            rem.segments[s].y += (rem.remoteSegments[s].y - rem.segments[s].y) * 0.28;
          }
        }
      }
    }

    // Update all local entities
    for (const e of this.entities) {
      if (!e.alive) continue;
      if (!e.isPlayer && !e.isRemotePlayer) this.updateAI(e, dt);
      if (!e.isRemotePlayer) this.updateEntity(e, dt);
    }

    // Collision checks
    this.checkFreeCubeCollisions();
    this.checkDivisionCollisions();
    this.checkEntityCollisions();

    // Update particles
    this.updateParticles(dt);

    // Respawn free cubes
    while (this.freeCubes.filter(c => c.alive).length < FREE_CUBE_COUNT * 0.8) {
      this.freeCubes.push(this.spawnFreeCube());
    }

    // Respawn division signs
    for (const d of this.divSigns) {
      if (!d.alive) {
        d.respawn -= dt * 1000;
        if (d.respawn <= 0) {
          d.alive = true;
          d.x = rand(200, ARENA_W - 200);
          d.y = rand(200, ARENA_H - 200);
        }
      }
    }

    // Prune dead bots (preserve local player and remote players)
    this.entities = this.entities.filter(e => e.alive || e.isPlayer || e.isRemotePlayer);

    // Respawn dead bots
    const targetBots = this.isMultiplayer ? 4 : BOT_COUNT;
    const aliveBots = this.entities.filter(e => !e.isPlayer && !e.isRemotePlayer && e.alive).length;
    if (aliveBots < targetBots - 2) {
      const name = pick(BOT_NAMES);
      const x = rand(300, ARENA_W - 300);
      const y = rand(300, ARENA_H - 300);
      const startVal = pick([2, 4, 8, 16]);
      const bot = this.createBotEntity(name, x, y, startVal);
      this.entities.push(bot);
    }

    // Camera follow
    this.updateCamera();

    // Update leaderboard
    this.updateLeaderboard();

    // Update HUD
    this.updateHUD();

    // Track max score
    if (this.player && this.player.alive) {
      const sc = this.entityScore(this.player);
      if (sc > this.stats.maxScore) this.stats.maxScore = sc;
    }
  }

  /* ── Update Single Entity ── */
  updateEntity(e, dt) {
    const head = e.segments[0];

    // Boost handling
    if (e.isPlayer ? this.wantBoost : (e.aiState === 'chase' || e.aiState === 'flee')) {
      if (e.boostCooldown <= 0 && !e.boosting) {
        e.boosting = true;
        e.boostTimer = BOOST_DURATION;
        if (e.isPlayer) this.sound.boost();
      }
    }
    if (e.boosting) {
      e.boostTimer -= dt * 1000;
      e.speed = BOOST_SPEED;
      if (e.boostTimer <= 0) {
        e.boosting = false;
        e.boostCooldown = BOOST_COOLDOWN;
        e.speed = BASE_SPEED;
      }
    } else {
      e.boostCooldown = Math.max(0, e.boostCooldown - dt * 1000);
      e.speed = BASE_SPEED;
    }

    // Angle interpolation
    e.angle = lerpAngle(e.angle, e.targetAngle, e.isPlayer ? 0.12 : 0.08);

    // Move head
    head.x += Math.cos(e.angle) * e.speed * dt;
    head.y += Math.sin(e.angle) * e.speed * dt;

    // Clamp to arena
    head.x = clamp(head.x, CUBE_SIZE, ARENA_W - CUBE_SIZE);
    head.y = clamp(head.y, CUBE_SIZE, ARENA_H - CUBE_SIZE);

    // Body follow
    for (let i = 1; i < e.segments.length; i++) {
      const prev = e.segments[i - 1];
      const curr = e.segments[i];
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > SEG_SPACING) {
        const a = Math.atan2(dy, dx);
        curr.x = prev.x - Math.cos(a) * SEG_SPACING;
        curr.y = prev.y - Math.sin(a) * SEG_SPACING;
      }
    }

    // Update animations (attach swooping, slide merge, slide swap, scale spring)
    this.updateEntityAnimations(e, dt);
  }

  /* ── Attach Cube to Tail with Smooth Motion ── */
  attachCube(entity, value, fromX, fromY) {
    if (!entity.segments || entity.segments.length === 0) return;
    const tail = entity.segments[entity.segments.length - 1];
    const prev = entity.segments.length > 1 ? entity.segments[entity.segments.length - 2] : tail;

    let dx = tail.x - prev.x;
    let dy = tail.y - prev.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0.001) {
      dx = (dx / d) * SEG_SPACING;
      dy = (dy / d) * SEG_SPACING;
    } else {
      dx = -Math.cos(entity.angle) * SEG_SPACING;
      dy = -Math.sin(entity.angle) * SEG_SPACING;
    }

    const targetX = tail.x + dx;
    const targetY = tail.y + dy;

    const newSeg = {
      x: targetX,
      y: targetY,
      value: value,
      scale: 0.6,
      spawnX: fromX !== undefined ? fromX : targetX,
      spawnY: fromY !== undefined ? fromY : targetY,
      attachProgress: 0,
      isAttaching: true,
    };
    entity.segments.push(newSeg);

    // Spawn pickup sparkle particles
    this.spawnParticles(newSeg.spawnX, newSeg.spawnY, cubeColor(value), 6);
  }

  /* ── Smooth Segment Animations (Attach, Merge Slide, Sort Swap) ── */
  updateEntityAnimations(e, dt) {
    if (!e.segments || e.segments.length === 0) return;

    // 1. Spring scale back to 1.0
    for (const seg of e.segments) {
      if (seg.scale !== undefined && seg.scale !== 1.0) {
        seg.scale += (1.0 - seg.scale) * Math.min(1, dt * 10);
        if (Math.abs(seg.scale - 1.0) < 0.01) seg.scale = 1.0;
      }
    }

    // 2. Advance attach progress on attaching segments
    let anyAttaching = false;
    for (const seg of e.segments) {
      if (seg.isAttaching) {
        anyAttaching = true;
        seg.attachProgress += dt / 0.16; // 160ms attach duration
        if (seg.attachProgress >= 1) {
          seg.attachProgress = 1;
          seg.isAttaching = false;
          seg.scale = 1.18; // little pop on attach
        }
      }
    }

    // Off-screen bot optimization: resolve immediately to save CPU
    const isOffscreenBot = !e.isPlayer && this.player && this.player.segments && this.player.segments[0] &&
      distSq(e.segments[0].x, e.segments[0].y, this.player.segments[0].x, this.player.segments[0].y) > 2560000; // 1600^2
    if (isOffscreenBot) {
      if (!anyAttaching) this.organizeAndMergeInstant(e);
      return;
    }

    // 3. Advance active animation (merge slide or swap)
    if (e.currentAnim) {
      const anim = e.currentAnim;
      const maxIdx = e.segments.length - 1;

      // Guard against sliced/removed segments
      if ((anim.type === 'merge' && (anim.fromIndex > maxIdx || anim.toIndex > maxIdx)) ||
          (anim.type === 'swap' && (anim.indexA > maxIdx || anim.indexB > maxIdx))) {
        e.currentAnim = null;
        return;
      }

      anim.progress += dt / anim.duration;
      if (anim.progress >= 1) {
        if (anim.type === 'merge') {
          const toSeg = e.segments[anim.toIndex];
          toSeg.value *= 2;
          toSeg.scale = 1.45; // juicy bounce pop!
          e.segments.splice(anim.fromIndex, 1);
          this.spawnParticles(toSeg.x, toSeg.y, cubeColor(toSeg.value), 12);
          if (e.isPlayer) {
            this.sound.merge();
            this.stats.merges++;
          }
        } else if (anim.type === 'swap') {
          const segA = e.segments[anim.indexA];
          const segB = e.segments[anim.indexB];
          const tempVal = segA.value;
          segA.value = segB.value;
          segB.value = tempVal;
          segA.scale = 1.15;
          segB.scale = 1.15;
        }
        e.currentAnim = null;
      }
      return;
    }

    // 4. If no animation is active and no cubes are attaching, check for next step:
    if (!anyAttaching) {
      // Step A: Check for adjacent equal values to merge (slide tailward into headward)
      for (let i = e.segments.length - 2; i >= 0; i--) {
        if (e.segments[i].value === e.segments[i + 1].value) {
          e.currentAnim = {
            type: 'merge',
            fromIndex: i + 1,
            toIndex: i,
            progress: 0,
            duration: 0.18, // 180ms smooth slide
          };
          return;
        }
      }

      // Step B: Check for descending order (swap if lower cube precedes higher cube)
      for (let i = 0; i < e.segments.length - 1; i++) {
        if (e.segments[i].value < e.segments[i + 1].value) {
          e.currentAnim = {
            type: 'swap',
            indexA: i,
            indexB: i + 1,
            progress: 0,
            duration: 0.16, // 160ms smooth swap
          };
          return;
        }
      }
    }
  }

  /* ── AI Logic ── */
  updateAI(bot, dt) {
    bot.aiTimer -= dt * 1000;
    if (bot.aiTimer <= 0) {
      bot.aiTimer = AI_RETHINK_INTERVAL + rand(-200, 200);
      this.aiDecide(bot);
    }

    // Steer toward target
    const head = bot.segments[0];
    bot.targetAngle = Math.atan2(bot.aiTarget.y - head.y, bot.aiTarget.x - head.x);

    // If close to target or edge, pick new target
    if (dist(head.x, head.y, bot.aiTarget.x, bot.aiTarget.y) < 80 ||
        head.x < 150 || head.x > ARENA_W - 150 ||
        head.y < 150 || head.y > ARENA_H - 150) {
      bot.aiTarget.x = rand(400, ARENA_W - 400);
      bot.aiTarget.y = rand(400, ARENA_H - 400);
      bot.aiState = 'wander';
    }
  }

  aiDecide(bot) {
    const head = bot.segments[0];
    const headVal = head.value;
    const botScore = this.entityScore(bot);

    // 1. Check for nearby threats (bigger entities)
    let nearestThreat = null, threatDist = 500;
    // 2. Check for nearby prey (smaller entities)
    let nearestPrey = null, preyDist = 600;
    // 3. Find nearest free cube
    let nearestCube = null, cubeDist = Infinity;

    for (const e of this.entities) {
      if (e === bot || !e.alive) continue;
      const d = dist(head.x, head.y, e.segments[0].x, e.segments[0].y);
      if (e.segments[0].value > headVal && d < threatDist) {
        threatDist = d;
        nearestThreat = e;
      }
      if (e.segments[0].value < headVal && d < preyDist) {
        preyDist = d;
        nearestPrey = e;
      }
    }

    for (const c of this.freeCubes) {
      if (!c.alive || c.value > headVal) continue; // Cannot take higher cube than us
      const d = dist(head.x, head.y, c.x, c.y);
      if (d < cubeDist) {
        cubeDist = d;
        nearestCube = c;
      }
    }

    // Priority: flee > chase > seek cube > wander
    if (nearestThreat && threatDist < 350) {
      // Flee: go opposite direction
      const a = Math.atan2(head.y - nearestThreat.segments[0].y, head.x - nearestThreat.segments[0].x);
      bot.aiTarget.x = head.x + Math.cos(a) * 600;
      bot.aiTarget.y = head.y + Math.sin(a) * 600;
      bot.aiTarget.x = clamp(bot.aiTarget.x, 300, ARENA_W - 300);
      bot.aiTarget.y = clamp(bot.aiTarget.y, 300, ARENA_H - 300);
      bot.aiState = 'flee';
    } else if (nearestPrey && preyDist < 400 && botScore > this.entityScore(nearestPrey) * 0.8) {
      bot.aiTarget.x = nearestPrey.segments[0].x;
      bot.aiTarget.y = nearestPrey.segments[0].y;
      bot.aiState = 'chase';
    } else if (nearestCube) {
      bot.aiTarget.x = nearestCube.x;
      bot.aiTarget.y = nearestCube.y;
      bot.aiState = 'seek';
    } else {
      bot.aiTarget.x = rand(400, ARENA_W - 400);
      bot.aiTarget.y = rand(400, ARENA_H - 400);
      bot.aiState = 'wander';
    }
  }

  /* ── Collision: Free Cubes ── */
  checkFreeCubeCollisions() {
    for (const e of this.entities) {
      if (!e.alive || !e.segments.length) continue;
      const head = e.segments[0];
      const collectRadius = CUBE_SIZE * 1.2;

      for (const c of this.freeCubes) {
        if (!c.alive) continue;
        // RULE: Cannot take higher cube than head value!
        if (c.value > head.value) continue;

        if (distSq(head.x, head.y, c.x, c.y) < collectRadius * collectRadius) {
          c.alive = false;
          // First attach cube to tail with smooth animation
          this.attachCube(e, c.value, c.x, c.y);
          if (e.isPlayer) {
            this.sound.collect();
            this.stats.cubesEaten++;
            if (this.isMultiplayer && this.multiplayer && c.id) {
              this.multiplayer.broadcastCubeConsumed(c.id);
            }
          }
        }
      }
    }
    // Clean up dead free cubes
    this.freeCubes = this.freeCubes.filter(c => c.alive);
  }

  /* ── Collision: Division Signs ── */
  checkDivisionCollisions() {
    for (const e of this.entities) {
      if (!e.alive || !e.segments.length) continue;
      const head = e.segments[0];
      for (const d of this.divSigns) {
        if (!d.alive) continue;
        if (distSq(head.x, head.y, d.x, d.y) < (CUBE_SIZE * 1.3) * (CUBE_SIZE * 1.3)) {
          d.alive = false;
          d.respawn = 8000; // 8s respawn
          // Halve segment values (min 2, remove if below 2 unless only 1 left)
          for (let s = e.segments.length - 1; s >= 0; s--) {
            const seg = e.segments[s];
            if (seg.value > 2) {
              seg.value = Math.floor(seg.value / 2);
            } else if (e.segments.length > 1) {
              e.segments.splice(s, 1);
            }
          }
          this.spawnParticles(d.x, d.y, '#f87171', 12);
          if (e.isPlayer) this.sound.divide();
          e.currentAnim = null;
          this.organizeAndMergeInstant(e);
        }
      }
    }
  }

  /* ── Collision: Entity vs Entity ── */
  checkEntityCollisions() {
    for (let i = 0; i < this.entities.length; i++) {
      const a = this.entities[i];
      if (!a.alive || !a.segments.length) continue;
      const aHead = a.segments[0];

      for (let j = 0; j < this.entities.length; j++) {
        if (i === j) continue;
        const b = this.entities[j];
        if (!b.alive || !b.segments.length) continue;

        // Check a's head vs b's body segments
        for (let k = 0; k < b.segments.length; k++) {
          const bSeg = b.segments[k];
          if (distSq(aHead.x, aHead.y, bSeg.x, bSeg.y) < (CUBE_SIZE * 0.9) * (CUBE_SIZE * 0.9)) {
            if (k === 0) {
              // Head-on collision
              if (aHead.value > bSeg.value) {
                this.eatEntity(a, b);
              } else if (aHead.value < bSeg.value) {
                this.eatEntity(b, a);
              } else {
                // Equal: bounce off each other
                const bounceAngle = Math.atan2(aHead.y - bSeg.y, aHead.x - bSeg.x);
                a.angle = bounceAngle;
                b.angle = bounceAngle + Math.PI;
                aHead.x += Math.cos(bounceAngle) * 5;
                aHead.y += Math.sin(bounceAngle) * 5;
              }
            } else {
              // a's head hit b's body
              if (aHead.value >= bSeg.value) {
                // a is >= b's body segment: cut b from segment k onward and attach to a
                this.cutAndAbsorb(a, b, k);
              } else {
                // a's head is lower than b's segment: cannot take higher cube than us -> a dies!
                this.killEntity(a, b);
              }
            }
            break; // Only first collision matters
          }
        }
        if (!a.alive) break;
      }
    }
  }

  eatEntity(eater, victim) {
    const eaterHeadVal = eater.segments[0].value;
    for (const seg of victim.segments) {
      if (seg.value <= eaterHeadVal) {
        this.attachCube(eater, seg.value, seg.x, seg.y);
      }
    }
    this.spawnParticles(victim.segments[0].x, victim.segments[0].y, cubeColor(victim.segments[0].value), 20);
    victim.alive = false;

    if (eater.isPlayer) {
      this.sound.eat();
      this.stats.botsEaten++;
      if (this.isMultiplayer && this.multiplayer && victim.isRemotePlayer) {
        this.multiplayer.broadcastKill(victim.socketId, this.entityScore(victim));
      }
    }
    if (victim.isPlayer) {
      this.sound.death();
      this.gameOver();
    }
  }

  cutAndAbsorb(eater, victim, fromIndex) {
    const cut = victim.segments.splice(fromIndex);
    const eaterHeadVal = eater.segments[0].value;
    for (const seg of cut) {
      if (seg.value <= eaterHeadVal) {
        this.attachCube(eater, seg.value, seg.x, seg.y);
      }
    }
    this.spawnParticles(cut[0].x, cut[0].y, cubeColor(cut[0].value), 12);
    if (victim.segments.length === 0) {
      victim.alive = false;
      if (eater.isPlayer && victim.isRemotePlayer && this.isMultiplayer && this.multiplayer) {
        this.multiplayer.broadcastKill(victim.socketId, this.entityScore(victim));
      }
    } else {
      victim.currentAnim = null;
    }

    if (eater.isPlayer) {
      this.sound.eat();
      this.stats.cubesEaten += cut.length;
    }
    if (victim.isPlayer && !victim.alive) {
      this.sound.death();
      this.gameOver();
    }
  }

  killEntity(victim, killer) {
    // Scatter victim's segments as free cubes
    for (const seg of victim.segments) {
      this.freeCubes.push({
        id: Math.random().toString(36).substring(2, 9),
        x: clamp(seg.x + rand(-30, 30), 80, ARENA_W - 80),
        y: clamp(seg.y + rand(-30, 30), 80, ARENA_H - 80),
        value: seg.value,
        alive: true,
        bobPhase: rand(0, Math.PI * 2),
      });
    }
    this.spawnParticles(victim.segments[0].x, victim.segments[0].y, '#f87171', 25);
    victim.alive = false;

    if (killer && killer.isPlayer && victim.isRemotePlayer && this.isMultiplayer && this.multiplayer) {
      this.multiplayer.broadcastKill(victim.socketId, this.entityScore(victim));
    }

    if (victim.isPlayer) {
      this.sound.death();
      this.gameOver();
    }
  }

  /* ── Instant Organize & Merge (used for division signs, off-screen bots, and fallbacks) ── */
  organizeAndMergeInstant(entity) {
    if (!entity || !entity.alive || !entity.segments || entity.segments.length === 0) return;

    const values = entity.segments.map(s => s.value);
    values.sort((a, b) => b - a);

    let mergeCount = 0;
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < values.length - 1; i++) {
        if (values[i] === values[i + 1]) {
          values[i] *= 2;
          values.splice(i + 1, 1);
          values.sort((a, b) => b - a);
          merged = true;
          mergeCount++;
          break;
        }
      }
    }

    if (entity.segments.length > values.length) {
      entity.segments.length = values.length;
    }
    while (entity.segments.length < values.length) {
      const len = entity.segments.length;
      const last = entity.segments[len - 1];
      const prev = len > 1 ? entity.segments[len - 2] : last;
      let dx = last.x - prev.x;
      let dy = last.y - prev.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.001) {
        dx = (dx / d) * SEG_SPACING;
        dy = (dy / d) * SEG_SPACING;
      } else {
        dx = -Math.cos(entity.angle) * SEG_SPACING;
        dy = -Math.sin(entity.angle) * SEG_SPACING;
      }
      entity.segments.push({ x: last.x + dx, y: last.y + dy, value: 2, scale: 1.0, isAttaching: false });
    }

    for (let i = 0; i < values.length; i++) {
      entity.segments[i].value = values[i];
      entity.segments[i].scale = 1.0;
      entity.segments[i].isAttaching = false;
    }
  }

  // Aliases for compatibility
  organizeAndMerge(entity) {
    this.organizeAndMergeInstant(entity);
  }

  tryMerge(entity) {
    this.organizeAndMergeInstant(entity);
  }

  /* ── Particles ── */
  spawnParticles(wx, wy, color, count) {
    const rgb = color.startsWith('#') ? hexToRgb(color) : { r: 255, g: 255, b: 255 };
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(40, 180);
      this.particles.push({
        x: wx, y: wy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        decay: rand(1.5, 3.5),
        r: rgb.r, g: rgb.g, b: rgb.b,
        size: rand(3, 7),
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  /* ── Camera ── */
  updateCamera() {
    if (!this.player || !this.player.alive) return;
    const head = this.player.segments[0];
    this.cam.x += (head.x - this.cam.x) * 0.08;
    this.cam.y += (head.y - this.cam.y) * 0.08;

    // Zoom out as snake grows
    const len = this.player.segments.length;
    this.cam.targetZoom = clamp(1.0 - (len - 3) * 0.012, 0.45, 1.0);
    this.cam.zoom += (this.cam.targetZoom - this.cam.zoom) * 0.03;
  }

  /* ── Leaderboard ── */
  updateLeaderboard() {
    const entries = this.entities
      .filter(e => e.alive)
      .map(e => ({
        name: e.isPlayer ? `${e.name} (You)` : (e.isRemotePlayer ? `🌐 ${e.name}` : e.name),
        score: this.entityScore(e),
        isPlayer: e.isPlayer,
        isRemote: !!e.isRemotePlayer,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    this.leaderboard = entries;
  }

  /* ── HUD Updates ── */
  updateHUD() {
    if (!this.player) return;
    const scoreEl = document.getElementById('hud-score-val');
    const headEl = document.getElementById('hud-head-val');
    const boostFill = document.getElementById('boost-fill');
    const boostBtn = document.getElementById('mobile-boost-btn');

    if (scoreEl) scoreEl.textContent = formatNum(this.entityScore(this.player));

    if (headEl && this.player.segments && this.player.segments[0]) {
      const headVal = this.player.segments[0].value;
      headEl.textContent = formatNum(headVal);
      headEl.style.color = cubeColor(headVal);
    }

    if (boostFill) {
      const p = this.player;
      let pct;
      if (p.boosting) {
        pct = (p.boostTimer / BOOST_DURATION) * 100;
        boostFill.classList.remove('on-cooldown');
      } else if (p.boostCooldown > 0) {
        pct = (1 - p.boostCooldown / BOOST_COOLDOWN) * 100;
        boostFill.classList.add('on-cooldown');
      } else {
        pct = 100;
        boostFill.classList.remove('on-cooldown');
      }
      boostFill.style.width = pct + '%';
    }

    if (boostBtn) {
      const p = this.player;
      if (p.boostCooldown > 0 && !p.boosting) {
        boostBtn.classList.add('on-cooldown');
      } else {
        boostBtn.classList.remove('on-cooldown');
      }
    }

    // Leaderboard HTML
    const lbEl = document.getElementById('lb-body');
    if (lbEl) {
      lbEl.innerHTML = this.leaderboard.map((e, i) => `
        <div class="lb-row">
          <div class="lb-rank ${i < 3 ? 'rank-' + (i + 1) : ''}">${i + 1}</div>
          <div class="lb-name ${e.isPlayer ? 'is-player' : (e.isRemote ? 'is-remote' : '')}">${e.name}</div>
          <div class="lb-score-val">${formatNum(e.score)}</div>
        </div>
      `).join('');
    }
  }

  /* ── Game Over ── */
  gameOver(reason) {
    this.state = 'gameover';
    this.wantBoost = false;
    this.joystickAngle = null;
    this.joystickTouchId = null;
    if (this.boostTouchIds) this.boostTouchIds.clear();
    const el = document.getElementById('joystick-zone');
    if (el) el.classList.remove('active');
    const lb = document.getElementById('hud-leaderboard');
    if (lb) lb.classList.remove('mobile-open');

    if (this.isMultiplayer && this.multiplayer) {
      this.multiplayer.leave();
    }

    const ov = document.getElementById('gameover-overlay');
    if (ov) ov.classList.remove('hidden');

    const sub = document.getElementById('go-subtitle');
    if (sub) {
      sub.textContent = reason || 'You were consumed by a bigger snake!';
    }

    document.getElementById('go-score').textContent = formatNum(this.stats.maxScore);
    document.getElementById('go-cubes').textContent = this.stats.cubesEaten;
    document.getElementById('go-merges').textContent = this.stats.merges;
    document.getElementById('go-time').textContent = Math.floor(this.stats.timeSurvived) + 's';
  }

  /* ═══════════════════════════════════════════
     RENDERING
     ═══════════════════════════════════════════ */
  render() {
    const ctx = this.ctx;
    const W = this.screenW;
    const H = this.screenH;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'menu') return;

    ctx.save();

    // Draw arena
    this.renderArena(ctx);

    // Free cubes
    this.renderFreeCubes(ctx);

    // Division signs
    this.renderDivisionSigns(ctx);

    // Entities (sorted by score ascending so biggest renders on top)
    const sorted = this.entities.filter(e => e.alive).sort((a, b) => this.entityScore(a) - this.entityScore(b));
    for (const e of sorted) {
      this.renderEntity(ctx, e);
    }

    // Particles
    this.renderParticles(ctx);

    ctx.restore();

    // Minimap
    this.renderMinimap(ctx);
  }

  /* ── Arena Grid + Borders ── */
  renderArena(ctx) {
    const z = this.cam.zoom;
    const gridSize = 100;

    // Visible world bounds
    const vx1 = this.s2wx(0);
    const vy1 = this.s2wy(0);
    const vx2 = this.s2wx(this.screenW);
    const vy2 = this.s2wy(this.screenH);

    // Arena fill
    const ax1 = this.w2sx(0), ay1 = this.w2sy(0);
    const ax2 = this.w2sx(ARENA_W), ay2 = this.w2sy(ARENA_H);
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(ax1, ay1, ax2 - ax1, ay2 - ay1);

    // Grid lines
    ctx.strokeStyle = 'rgba(56, 78, 120, 0.15)';
    ctx.lineWidth = 1;

    const startX = Math.floor(Math.max(0, vx1) / gridSize) * gridSize;
    const startY = Math.floor(Math.max(0, vy1) / gridSize) * gridSize;
    const endX = Math.min(ARENA_W, vx2);
    const endY = Math.min(ARENA_H, vy2);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      const sx = this.w2sx(x);
      ctx.moveTo(sx, Math.max(ay1, 0));
      ctx.lineTo(sx, Math.min(ay2, this.screenH));
    }
    for (let y = startY; y <= endY; y += gridSize) {
      const sy = this.w2sy(y);
      ctx.moveTo(Math.max(ax1, 0), sy);
      ctx.lineTo(Math.min(ax2, this.screenW), sy);
    }
    ctx.stroke();

    // Arena border glow
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 3 * z;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 12;
    ctx.strokeRect(ax1, ay1, ax2 - ax1, ay2 - ay1);
    ctx.shadowBlur = 0;
  }

  /* ── Free Cubes ── */
  renderFreeCubes(ctx) {
    const vx1 = this.s2wx(-50), vy1 = this.s2wy(-50);
    const vx2 = this.s2wx(this.screenW + 50), vy2 = this.s2wy(this.screenH + 50);
    const pHeadVal = (this.player && this.player.alive && this.player.segments && this.player.segments[0])
      ? this.player.segments[0].value
      : 2;

    for (const c of this.freeCubes) {
      if (!c.alive) continue;
      if (c.x < vx1 || c.x > vx2 || c.y < vy1 || c.y > vy2) continue;

      const sx = this.w2sx(c.x);
      const sy = this.w2sy(c.y) + Math.sin(this.elapsed * 0.003 + c.bobPhase) * 3;
      const size = CUBE_SIZE * 0.7 * this.cam.zoom;
      const canEat = c.value <= pHeadVal;

      this.drawCube(ctx, sx, sy, c.value, size, false, 0, canEat ? 0.9 : 0.4, !canEat);
    }
  }

  /* ── Division Signs ── */
  renderDivisionSigns(ctx) {
    for (const d of this.divSigns) {
      if (!d.alive) continue;
      const sx = this.w2sx(d.x);
      const sy = this.w2sy(d.y);
      if (sx < -40 || sx > this.screenW + 40 || sy < -40 || sy > this.screenH + 40) continue;

      const size = CUBE_SIZE * 0.9 * this.cam.zoom;
      const pulse = 0.9 + Math.sin(this.elapsed * 0.004) * 0.1;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(pulse, pulse);

      // Red glow circle
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(248, 113, 113, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // ÷ symbol
      ctx.fillStyle = '#f87171';
      ctx.font = `bold ${size * 1.4}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('÷', 0, 0);

      ctx.restore();
    }
  }

  /* ── Entity (Snake) ── */
  renderEntity(ctx, entity) {
    const segs = entity.segments;
    if (segs.length === 0) return;

    // 1. Calculate interpolated render coordinates and scale for each segment
    const renderPositions = [];
    const renderScales = [];

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      let rx = seg.x;
      let ry = seg.y;
      let sc = seg.scale || 1.0;

      // Handle attach animation (swooping from pickup position to tail)
      if (seg.isAttaching) {
        const t = clamp(seg.attachProgress, 0, 1);
        const easeT = easeOutQuad(t);
        rx = lerp(seg.spawnX, seg.x, easeT);
        ry = lerp(seg.spawnY, seg.y, easeT);
        sc = lerp(0.6, 1.15, easeT);
      }

      renderPositions.push({ x: rx, y: ry });
      renderScales.push(sc);
    }

    // 2. Apply active merge or swap animation to render positions
    const anim = entity.currentAnim;
    if (anim) {
      const t = clamp(anim.progress, 0, 1);
      const easeT = easeInOutQuad(t);

      if (anim.type === 'merge' && anim.fromIndex < renderPositions.length && anim.toIndex < renderPositions.length) {
        const fromPos = renderPositions[anim.fromIndex];
        const toPos = renderPositions[anim.toIndex];
        // Slide fromPos smoothly along the curve towards toPos
        fromPos.x = lerp(fromPos.x, toPos.x, easeT);
        fromPos.y = lerp(fromPos.y, toPos.y, easeT);
        // Subtle magnetic anticipation pulse while sliding
        renderScales[anim.fromIndex] *= (1.0 + Math.sin(t * Math.PI) * 0.22);
      } else if (anim.type === 'swap' && anim.indexA < renderPositions.length && anim.indexB < renderPositions.length) {
        const posA = renderPositions[anim.indexA];
        const posB = renderPositions[anim.indexB];
        const origAx = posA.x, origAy = posA.y;
        posA.x = lerp(origAx, posB.x, easeT);
        posA.y = lerp(origAy, posB.y, easeT);
        posB.x = lerp(posB.x, origAx, easeT);
        posB.y = lerp(posB.y, origAy, easeT);
      }
    }

    // 3. Draw body connectors
    ctx.strokeStyle = `hsla(${entity.hue}, 60%, 50%, 0.25)`;
    ctx.lineWidth = CUBE_SIZE * 0.5 * this.cam.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.w2sx(renderPositions[0].x), this.w2sy(renderPositions[0].y));
    for (let i = 1; i < segs.length; i++) {
      ctx.lineTo(this.w2sx(renderPositions[i].x), this.w2sy(renderPositions[i].y));
    }
    ctx.stroke();

    // 4. Draw segments (back to front so head renders on top)
    for (let i = segs.length - 1; i >= 0; i--) {
      const seg = segs[i];
      const pos = renderPositions[i];
      const sx = this.w2sx(pos.x);
      const sy = this.w2sy(pos.y);
      if (sx < -60 || sx > this.screenW + 60 || sy < -60 || sy > this.screenH + 60) continue;
      const isHead = (i === 0);
      const size = (isHead ? CUBE_SIZE * 1.15 : CUBE_SIZE) * this.cam.zoom * renderScales[i];
      this.drawCube(ctx, sx, sy, seg.value, size, isHead, entity.hue, 1);
    }

    // Boost trail effect
    if (entity.boosting) {
      const lastPos = renderPositions[renderPositions.length - 1];
      this.spawnParticles(lastPos.x + rand(-10, 10), lastPos.y + rand(-10, 10),
        `hsl(${entity.hue}, 80%, 65%)`, 1);
    }

    // Name label above head
    const headPos = renderPositions[0];
    const hsx = this.w2sx(headPos.x);
    const hsy = this.w2sy(headPos.y);
    const nameY = hsy - CUBE_SIZE * 1.1 * this.cam.zoom;

    ctx.font = `bold ${Math.max(10, 12 * this.cam.zoom)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const displayName = entity.isRemotePlayer ? `🌐 ${entity.name}` : entity.name;

    // Name shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(displayName, hsx + 1, nameY + 1);

    // Name color: Cyan for local player, violet for remote online player, Red for threat, Green for prey, Yellow for equal
    if (entity.isPlayer) {
      ctx.fillStyle = '#22d3ee';
    } else if (entity.isRemotePlayer) {
      ctx.fillStyle = '#c084fc';
    } else if (this.player && this.player.alive && this.player.segments && this.player.segments[0]) {
      const pHead = this.player.segments[0].value;
      const bHead = segs[0].value;
      if (bHead > pHead) {
        ctx.fillStyle = '#f87171'; // Bigger enemy = danger!
      } else if (bHead < pHead) {
        ctx.fillStyle = '#4ade80'; // Smaller enemy = prey!
      } else {
        ctx.fillStyle = '#fbbf24'; // Equal
      }
    } else {
      ctx.fillStyle = '#e2e8f0';
    }
    ctx.fillText(displayName, hsx, nameY);
  }

  /* ── Draw Single Cube ── */
  drawCube(ctx, sx, sy, value, size, isHead, entityHue, alpha, locked = false) {
    const half = size / 2;
    const color = cubeColor(value);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, sx - half + 2, sy - half + 2, size, size, size * 0.18);
    ctx.fill();

    // Main cube body
    const grad = ctx.createLinearGradient(sx - half, sy - half, sx + half, sy + half);
    const rgb = hexToRgb(color.startsWith('#') ? color : '#ffffff');
    grad.addColorStop(0, `rgba(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)}, 1)`);
    grad.addColorStop(1, `rgba(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)}, 1)`);
    ctx.fillStyle = grad;
    roundRect(ctx, sx - half, sy - half, size, size, size * 0.18);
    ctx.fill();

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, sx - half + 2, sy - half + 2, size - 4, size * 0.4, size * 0.14);
    ctx.fill();

    // Border
    ctx.strokeStyle = locked ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = locked ? 1.5 : 1.2;
    roundRect(ctx, sx - half, sy - half, size, size, size * 0.18);
    ctx.stroke();

    // Number text
    const fontSize = Math.max(8, size * (value >= 1000 ? 0.3 : value >= 100 ? 0.35 : 0.42));
    ctx.font = `800 ${fontSize}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText(formatNum(value), sx + 0.8, sy + 0.8);
    ctx.fillStyle = locked ? '#94a3b8' : '#fff';
    ctx.fillText(formatNum(value), sx, sy);

    // Lock indicator if higher than player
    if (locked && size >= 14) {
      ctx.fillStyle = '#f87171';
      ctx.font = `bold ${Math.max(8, size * 0.28)}px sans-serif`;
      ctx.fillText('🔒', sx + half - 5, sy - half + 6);
    }

    // Head glow
    if (isHead) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(ctx, sx - half - 2, sy - half - 2, size + 4, size + 4, size * 0.22);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── Particles ── */
  renderParticles(ctx) {
    for (const p of this.particles) {
      const sx = this.w2sx(p.x);
      const sy = this.w2sy(p.y);
      if (sx < -20 || sx > this.screenW + 20 || sy < -20 || sy > this.screenH + 20) continue;
      const sz = p.size * p.life * this.cam.zoom;
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.life * 0.8})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── Minimap ── */
  renderMinimap(ctx) {
    const isMobile = this.screenW <= 768;
    const size = isMobile ? 86 : 130;
    const pad = isMobile ? 12 : 18;
    // Position at top right
    const mx = this.screenW - size - pad;
    const my = isMobile ? 62 : 68;

    // Background
    ctx.fillStyle = 'rgba(10, 15, 30, 0.75)';
    roundRect(ctx, mx - 4, my - 4, size + 8, size + 8, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 120, 180, 0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, mx - 4, my - 4, size + 8, size + 8, 10);
    ctx.stroke();

    // Arena area
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(mx, my, size, size);

    // Arena border
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, size, size);

    // Entities as dots
    const scale = size / ARENA_W;
    for (const e of this.entities) {
      if (!e.alive) continue;
      const head = e.segments[0];
      const dx = mx + head.x * scale;
      const dy = my + head.y * scale;
      const dotSize = e.isPlayer ? (isMobile ? 3.5 : 4) : (isMobile ? 2 : 2.5);
      ctx.fillStyle = e.isPlayer ? '#22d3ee' : (e.isRemotePlayer ? '#c084fc' : `hsl(${e.hue}, 60%, 55%)`);
      ctx.beginPath();
      ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera view rect
    const cx1 = mx + this.s2wx(0) * scale;
    const cy1 = my + this.s2wy(0) * scale;
    const cx2 = mx + this.s2wx(this.screenW) * scale;
    const cy2 = my + this.s2wy(this.screenH) * scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      clamp(cx1, mx, mx + size),
      clamp(cy1, my, my + size),
      clamp(cx2 - cx1, 0, size),
      clamp(cy2 - cy1, 0, size)
    );
  }

  /* ── Main Loop ── */
  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    if (this.state === 'playing') {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame(t => this.loop(t));
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }
}

/* ═══════════════════════════════════════════
   PAGE INITIALIZATION
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const sound = new SoundEngine();
  const game = new Game(canvas, sound);
  game.start();

  // Mode tabs & panels
  const tabSolo = document.getElementById('tab-solo');
  const tabMultiplayer = document.getElementById('tab-multiplayer');
  const panelSolo = document.getElementById('panel-solo');
  const panelMultiplayer = document.getElementById('panel-multiplayer');

  if (tabSolo && tabMultiplayer && panelSolo && panelMultiplayer) {
    tabSolo.addEventListener('click', () => {
      tabSolo.classList.add('active');
      tabMultiplayer.classList.remove('active');
      panelSolo.style.display = 'block';
      panelMultiplayer.style.display = 'none';
    });

    tabMultiplayer.addEventListener('click', () => {
      tabMultiplayer.classList.add('active');
      tabSolo.classList.remove('active');
      panelSolo.style.display = 'none';
      panelMultiplayer.style.display = 'block';

      // Verify / initiate socket connection if needed
      if (game.multiplayer) {
        if (!game.multiplayer.connected) {
          game.multiplayer.initSocket();
        } else {
          game.multiplayer.updateNetworkBadge(true);
        }
      }
    });
  }

  // Start overlay inputs & buttons
  const startOverlay = document.getElementById('start-overlay');
  const nameInput = document.getElementById('player-name');
  const playBtn = document.getElementById('btn-start');
  const btnQuickMatch = document.getElementById('btn-quick-match');
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const inputRoomCode = document.getElementById('input-room-code');
  const btnCopyRoom = document.getElementById('btn-copy-room');

  // Solo Start
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim().slice(0, 16) || 'Player' : 'Player';
      if (startOverlay) startOverlay.classList.add('hidden');
      game.startGame(name, false);
    });
  }

  // Quick Match
  if (btnQuickMatch) {
    btnQuickMatch.addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim().slice(0, 16) || 'Player' : 'Player';
      if (game.multiplayer) {
        game.multiplayer.quickMatch(name);
      }
    });
  }

  // Create Private Room
  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      const name = nameInput ? nameInput.value.trim().slice(0, 16) || 'Player' : 'Player';
      if (game.multiplayer) {
        game.multiplayer.createRoom(name);
      }
    });
  }

  // Join Room by Code
  if (btnJoinRoom && inputRoomCode) {
    const handleJoin = () => {
      const name = nameInput ? nameInput.value.trim().slice(0, 16) || 'Player' : 'Player';
      const code = inputRoomCode.value.trim().toUpperCase();
      if (!code) {
        if (game.multiplayer) game.multiplayer.showToast('Please enter a room code.', 'error');
        return;
      }
      if (game.multiplayer) {
        game.multiplayer.joinRoom(code, name);
      }
    };

    btnJoinRoom.addEventListener('click', handleJoin);
    inputRoomCode.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleJoin();
    });
    inputRoomCode.addEventListener('input', () => {
      inputRoomCode.value = inputRoomCode.value.toUpperCase();
    });
  }

  // Copy In-Game Room Code
  if (btnCopyRoom) {
    btnCopyRoom.addEventListener('click', () => {
      const codeEl = document.getElementById('mp-room-code-val');
      const code = codeEl ? codeEl.textContent.trim() : (game.multiplayer ? game.multiplayer.roomCode : '');
      if (code) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            if (game.multiplayer) game.multiplayer.showToast(`Room code ${code} copied!`, 'success');
          }).catch(() => {
            if (game.multiplayer) game.multiplayer.showToast(`Room code: ${code}`, 'info');
          });
        } else {
          if (game.multiplayer) game.multiplayer.showToast(`Room code: ${code}`, 'info');
        }
      }
    });
  }

  // Nickname Enter Key
  if (nameInput) {
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (tabSolo && tabSolo.classList.contains('active') && playBtn) {
          playBtn.click();
        } else if (btnQuickMatch) {
          btnQuickMatch.click();
        }
      }
    });
  }

  // Game over overlay: Play Again returns to start menu with choices
  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      const goOverlay = document.getElementById('gameover-overlay');
      if (goOverlay) goOverlay.classList.add('hidden');
      const roomBadge = document.getElementById('mp-room-badge');
      if (roomBadge) roomBadge.classList.add('hidden');
      if (startOverlay) startOverlay.classList.remove('hidden');
    });
  }
});
