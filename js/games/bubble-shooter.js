'use strict';

class BubbleShooter {
    constructor(canvasElement, onScoreCallback) {
        this._onScore = onScoreCallback || function () {};
        this._destroyed = false;

        this.COLORS = [
            { hex: '#FF2244', light: '#FF6677', dark: '#AA0022', glow: 'rgba(255,34,68,0.4)',    name: 'Red'      },
            { hex: '#00EE66', light: '#66FFaa', dark: '#007733', glow: 'rgba(0,238,102,0.4)',    name: 'Green'    },
            { hex: '#1166FF', light: '#66AAFF', dark: '#003399', glow: 'rgba(17,102,255,0.4)',   name: 'Blue'     },
            { hex: '#FFD700', light: '#FFE866', dark: '#AA8800', glow: 'rgba(255,215,0,0.4)',    name: 'Yellow'   },
            { hex: '#DD00FF', light: '#EE77FF', dark: '#880099', glow: 'rgba(221,0,255,0.4)',    name: 'Magenta'  },
            { hex: '#00EEFF', light: '#77FFFF', dark: '#007788', glow: 'rgba(0,238,255,0.4)',    name: 'Cyan'     },
            { hex: '#FF7700', light: '#FFAA44', dark: '#993300', glow: 'rgba(255,119,0,0.4)',    name: 'Orange'   },
            { hex: '#9900FF', light: '#CC66FF', dark: '#550099', glow: 'rgba(153,0,255,0.4)',    name: 'Purple'   },
        ];

        this.LEVELS = [
            { colors: 3, rows: 4, emptyTubes: 0 },
            { colors: 4, rows: 5, emptyTubes: 0 },
            { colors: 5, rows: 5, emptyTubes: 0 },
            { colors: 6, rows: 6, emptyTubes: 0 },
            { colors: 7, rows: 6, emptyTubes: 0 },
            { colors: 8, rows: 7, emptyTubes: 0 },
            { colors: 8, rows: 8, emptyTubes: 0 },
            { colors: 8, rows: 9, emptyTubes: 0 },
            { colors: 8, rows: 10, emptyTubes: 0 },
            { colors: 8, rows: 11, emptyTubes: 0 },
        ];

        const isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
        this.isMobile = isMobile;
        this.DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 2);

        // Game state
        this.grid          = [];
        this.currentLevel  = 0;
        this.score         = 0;
        this.moves         = 0;
        this.combo         = 0;
        this.maxCombo      = 0;
        this.bubblesPopped = 0;
        this.gameWon       = false;
        this.gameOver      = false;
        this.timeElapsed   = 0;
        this.timerInterval = null;
        this.history       = [];

        // Shooter state
        this.shooterAngle  = -Math.PI / 2;
        this.targetAngle   = -Math.PI / 2;
        this.currentBubble = 0;
        this.nextBubble    = 0;
        this.projectile    = null;
        this.canShoot      = true;
        this.shootCooldown = 0;
        this.colorsInPlay  = [];
        this.aimDots       = [];

        // Layout
        this.COLS       = 10;
        this.ROWS       = 14;
        this.BUBBLE_R   = 20;
        this.offsetX    = 0;
        this.offsetY    = 0;
        this.shooterX   = 0;
        this.shooterY   = 0;
        this.HUD_H      = 0;
        this.BOTTOM_H   = 0;

        // FX
        this.particles      = [];
        this.fallingBubbles = [];
        this.popRings       = [];
        this.textPopups     = [];
        this.floatingTexts  = [];
        this.MAX_PARTICLES  = isMobile ? 40 : 100;

        // Power-ups
        this.powerUps = {
            bomb:      { count: 1, name: 'Bomb',  color: '#FF7700' },
            precision: { count: 2, name: 'Aim+',  color: '#00EE66' },
        };
        this.activePowerUp = null;

        // Anim & render
        this.globalTime        = 0;
        this.frame             = 0;
        this._lastFrameTime    = 0;
        this.shakeX            = 0;
        this.shakeY            = 0;
        this.shakeTimer        = 0;
        this.shakeForce        = 0;
        this.shootRecoil       = 0;
        this.hoverX            = -1;
        this.hoverY            = -1;
        this.fsBtnRect         = { x: 0, y: 0, w: 0, h: 0 };
        this.bgCache           = null;
        this._bubbleCache      = new Map();
        this._glowCache        = new Map();
        this._gradCache        = new Map();
        this.animationFrameId  = null;
        this.swapAnim          = 0;

        // Daily reward
        this.showDailyReward    = false;
        this.dailyRewardClaimed = false;
        this.dailyAnim          = 0;
        this._checkDailyReward();

        // Level complete overlay
        this.showLevelComplete    = false;
        this.levelCompleteTimer   = 0;
        this.starRating           = 0;
        this.levelCoins           = 0;
        this.levelDiamonds        = 0;

        // Player data
        this.saveKey    = 'neonBubble_v10';
        this.playerData = this._loadPlayerData();

        // Audio
        this.audioCtx = null;
        this._initAudio();

        this.canvas = canvasElement;
        this.ctx    = this.canvas.getContext('2d', { alpha: false });

        this._handleClick     = this._onHandleClick.bind(this);
        this._handleMove      = this._onHandleMove.bind(this);
        this._handleKey       = this._onKey.bind(this);
        this._handleResize    = this._onResize.bind(this);

        this._init();
    }

    // ══════════════════ INIT ══════════════════

    _init() {
        this._setupCanvas();
        const savedLevel = this.playerData.currentLevel || 0;
        this._startLevel(savedLevel);
        this._preCacheBubbles();

        this.canvas.addEventListener('click',      this._handleClick,  { passive: false });
        this.canvas.addEventListener('touchend',   this._handleClick,  { passive: false });
        this.canvas.addEventListener('mousemove',  this._handleMove);
        this.canvas.addEventListener('touchmove',  this._handleMove,   { passive: false });
        this.canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
        window.addEventListener('keydown', this._handleKey);
        window.addEventListener('resize',  this._handleResize);

        this._resumeAudio = () => {
            if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
            document.removeEventListener('click',      this._resumeAudio);
            document.removeEventListener('touchstart', this._resumeAudio);
        };
        document.addEventListener('click',      this._resumeAudio);
        document.addEventListener('touchstart', this._resumeAudio);

        this._mainLoop();
    }

    destroy() {
        this._destroyed = true;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this._stopTimer();

        this.canvas.removeEventListener('click',     this._handleClick);
        this.canvas.removeEventListener('touchend',  this._handleClick);
        this.canvas.removeEventListener('mousemove', this._handleMove);
        this.canvas.removeEventListener('touchmove', this._handleMove);
        window.removeEventListener('keydown', this._handleKey);
        window.removeEventListener('resize',  this._handleResize);

        if (this._resumeAudio) {
            document.removeEventListener('click',      this._resumeAudio);
            document.removeEventListener('touchstart', this._resumeAudio);
        }

        try { this.audioCtx?.close(); } catch (e) {}
        this._bubbleCache.clear();
        this._glowCache.clear();
        this._gradCache.clear();
        this._savePlayerData();
    }

    resize() { this._setupCanvas(); }
    togglePause() { return false; }

    // ══════════════════ CANVAS SETUP ══════════════════

    _setupCanvas() {
        const parent = this.canvas.parentElement;
        let cw = parent ? (parent.clientWidth  || parent.offsetWidth)  : window.innerWidth;
        let ch = parent ? (parent.clientHeight || parent.offsetHeight) : window.innerHeight;
        if (cw < 10) cw = window.innerWidth;
        if (ch < 10) ch = window.innerHeight;
        cw = Math.max(cw, 320);
        ch = Math.max(ch, 480);

        this.canvas.width  = Math.round(cw * this.DPR);
        this.canvas.height = Math.round(ch * this.DPR);
        this.canvas.style.width  = cw + 'px';
        this.canvas.style.height = ch + 'px';

        this.bgCache = null;
        this._bubbleCache.clear();
        this._glowCache.clear();
        this._gradCache.clear();
        this._calculateLayout();
        this._preCacheBubbles();
    }

    // ══════════════════ LAYOUT ══════════════════

    _calculateLayout() {
        const cw = this.canvas.width, ch = this.canvas.height, D = this.DPR;
        const isMob = this.isMobile;

        this.HUD_H    = 72 * D;
        this.BOTTOM_H = isMob ? 110 * D : 120 * D;

        const gridH = ch - this.HUD_H - this.BOTTOM_H;
        const gridW = cw;

        this.COLS = this.isMobile ? (this.canvas.width < 340 * D ? 8 : 9) : 10;
        const lvl = this.LEVELS[Math.min(this.currentLevel, this.LEVELS.length - 1)];
        this.ROWS = Math.max(12, lvl.rows + 5);

        const maxByW = Math.floor((gridW - 8 * D) / (this.COLS * 2 + 0.5));
        const maxByH = Math.floor(gridH / (this.ROWS * 1.732));
        this.BUBBLE_R = Math.min(maxByW, maxByH, isMob ? 18 * D : 22 * D);

        this.cellW   = this.BUBBLE_R * 2;
        this.cellH   = this.BUBBLE_R * 1.732;
        const totalW = this.COLS * this.cellW;
        this.offsetX = (cw - totalW) / 2 + this.BUBBLE_R;
        this.offsetY = this.HUD_H + 8 * D;

        this.shooterX = cw / 2;
        this.shooterY = ch - this.BOTTOM_H / 2;
    }

    // ══════════════════ BUBBLE CACHE ══════════════════

    _preCacheBubbles() {
        this._bubbleCache.clear();
        this._glowCache.clear();
        const r = this.BUBBLE_R;
        if (r <= 0) return;

        this.COLORS.forEach((col, idx) => {
            // Bubble
            const bSize = Math.ceil((r + 3) * 2);
            const bc    = document.createElement('canvas');
            bc.width = bc.height = bSize;
            const bctx  = bc.getContext('2d');
            this._renderBubble(bctx, bSize / 2, bSize / 2, r, col);
            this._bubbleCache.set(idx, bc);

            // Glow (desktop only)
            if (!this.isMobile) {
                const gs  = Math.ceil((r + 14) * 2);
                const gc  = document.createElement('canvas');
                gc.width = gc.height = gs;
                const gctx = gc.getContext('2d');
                const gg   = gctx.createRadialGradient(gs / 2, gs / 2, r * 0.1, gs / 2, gs / 2, r + 12);
                gg.addColorStop(0, col.glow.replace('0.4)', '0.25)'));
                gg.addColorStop(1, 'rgba(0,0,0,0)');
                gctx.fillStyle = gg;
                gctx.beginPath();
                gctx.arc(gs / 2, gs / 2, r + 12, 0, Math.PI * 2);
                gctx.fill();
                this._glowCache.set(idx, gc);
            }
        });
    }

    _renderBubble(ctx, cx, cy, r, col) {
        // Base sphere
        const g1 = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
        g1.addColorStop(0, col.light);
        g1.addColorStop(0.4, col.hex);
        g1.addColorStop(1, col.dark);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = g1; ctx.fill();

        // Rim darkening
        const g2 = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
        g2.addColorStop(0, 'rgba(0,0,0,0)');
        g2.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

        // Main highlight
        const g3 = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx - r * 0.15, cy - r * 0.15, r * 0.55);
        g3.addColorStop(0, 'rgba(255,255,255,0.65)');
        g3.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g3;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

        // Specular dot
        const g4 = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.18);
        g4.addColorStop(0, 'rgba(255,255,255,0.8)');
        g4.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g4;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }

    // ══════════════════ AUDIO ══════════════════

    _initAudio() {
        try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }

    _playTone(freq, dur, type = 'sine', vol = 0.1) {
        if (!this.audioCtx) return;
        try {
            const osc  = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain); gain.connect(this.audioCtx.destination);
            osc.frequency.value = freq; osc.type = type;
            gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + dur);
            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + dur);
        } catch (e) {}
    }

    _playShoot()  { this._playTone(440, 0.12, 'sine', 0.08); }
    _playPop()    { this._playTone(660, 0.15, 'sine', 0.1);  setTimeout(() => this._playTone(880, 0.1, 'sine', 0.08), 80); }
    _playSwap()   { this._playTone(540, 0.1,  'sine', 0.08); }
    _playError()  { this._playTone(180, 0.2,  'square', 0.06); }
    _playCombo()  { [440, 550, 660].forEach((f, i) => setTimeout(() => this._playTone(f, 0.12, 'sine', 0.09), i * 70)); }
    _playWin()    { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._playTone(f, 0.25, 'sine', 0.12), i * 150)); }

    // ══════════════════ SAVE / LOAD ══════════════════

    _loadPlayerData() {
        const def = { coins: 0, diamonds: 0, currentLevel: 0, levelStars: {}, dailyStreak: 0, lastDaily: null, powerUps: { bomb: 1, precision: 2 } };
        try { const s = JSON.parse(localStorage.getItem(this.saveKey)); if (s) return { ...def, ...s }; } catch (e) {}
        return def;
    }

    _savePlayerData() {
        this.playerData.powerUps = { bomb: this.powerUps.bomb.count, precision: this.powerUps.precision.count };
        try { localStorage.setItem(this.saveKey, JSON.stringify(this.playerData)); } catch (e) {}
    }

    // ══════════════════ DAILY REWARD ══════════════════

    _checkDailyReward() {
        const today = new Date().toDateString();
        if (this.playerData?.lastDaily !== today) {
            this.showDailyReward = true;
            this.dailyRewardClaimed = false;
            this.dailyAnim = 0;
        }
    }

    _claimDailyReward() {
        if (this.dailyRewardClaimed) return;
        const streak = this.playerData.dailyStreak || 0;
        const coins  = Math.floor(50 * Math.min(1 + streak * 0.25, 3));
        const dias   = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));
        this.playerData.coins    = (this.playerData.coins    || 0) + coins;
        this.playerData.diamonds = (this.playerData.diamonds || 0) + dias;
        this.playerData.lastDaily     = new Date().toDateString();
        this.playerData.dailyStreak   = streak + 1;
        this.dailyRewardClaimed = true;
        this.showDailyReward    = false;
        this._addFloatingText(this.canvas.width / 2 / this.DPR, this.canvas.height / 2 / this.DPR - 30, `+${coins} Coins`, '#FFD700', 20);
        this._addFloatingText(this.canvas.width / 2 / this.DPR, this.canvas.height / 2 / this.DPR + 10, `+${dias} Gems`,  '#00EEFF', 18);
        this._savePlayerData();
    }

    // ══════════════════ LEVEL GENERATION ══════════════════

    _startLevel(lvl) {
        this.currentLevel  = Math.min(lvl, this.LEVELS.length - 1);
        const cfg          = this.LEVELS[this.currentLevel];
        this.moves         = 0;
        this.combo         = 0;
        this.maxCombo      = 0;
        this.bubblesPopped = 0;
        this.gameWon       = false;
        this.gameOver      = false;
        this.score         = 0;
        this.levelCoins    = 0;
        this.levelDiamonds = 0;
        this.starRating    = 0;
        this.projectile    = null;
        this.canShoot      = true;
        this.shootCooldown = 0;
        this.activePowerUp = null;
        this.history       = [];
        this.particles     = [];
        this.fallingBubbles = [];
        this.popRings      = [];
        this.textPopups    = [];
        this.floatingTexts = [];
        this.showLevelComplete = false;
        this.timeElapsed   = 0;
        this.bgCache       = null;

        this.COLS = this.isMobile ? 9 : 10;
        this.ROWS = Math.max(12, cfg.rows + 5);
        this._calculateLayout();
        this._buildGrid(cfg);
        this._updateColorsInPlay();
        this._generateShooter();
        this._calcAimLine();
        this._startTimer();

        this._addFloatingText(this.canvas.width / 2 / this.DPR, this.canvas.height / 2 / this.DPR - 30, `Level ${this.currentLevel + 1}`, '#DD00FF', 24);
        this._addFloatingText(this.canvas.width / 2 / this.DPR, this.canvas.height / 2 / this.DPR + 8,  cfg.name || '', '#00EEFF', 13);

        this.playerData.currentLevel = this.currentLevel;
        this._savePlayerData();
    }

    _buildGrid(cfg) {
        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) this.grid[r] = new Array(this.COLS).fill(null);
        const n = cfg.colors;
        for (let r = 0; r < cfg.rows; r++) {
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = { ci: Math.floor(Math.random() * n), scale: 1, flash: 0, breathe: Math.random() * 6.28 };
            }
        }
    }

    _levelGoal() { return this.LEVELS[Math.min(this.currentLevel, this.LEVELS.length - 1)].rows * this.COLS; }

    // ══════════════════ GAME LOGIC ══════════════════

    _updateColorsInPlay() {
        const used = new Set();
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (this.grid[r]?.[c]) used.add(this.grid[r][c].ci);
        this.colorsInPlay = [...used];
        if (!this.colorsInPlay.length) this.colorsInPlay = [0, 1, 2];
    }

    _generateShooter() {
        this.currentBubble = this.nextBubble ?? this._randColor();
        this.nextBubble    = this._randColor();
    }

    _randColor() {
        const pool = this.colorsInPlay.length ? this.colorsInPlay : [0, 1, 2];
        return pool[Math.floor(Math.random() * pool.length)];
    }

    _swapBubble() {
        if (!this.canShoot || this.projectile) return;
        const pool = this.colorsInPlay.length ? this.colorsInPlay : [0, 1, 2];
        const idx  = pool.indexOf(this.currentBubble);
        this.currentBubble = pool[(idx + 1) % pool.length];
        this.swapAnim = 1;
        this._playSwap();
        this._calcAimLine();
    }

    _bubblePos(r, c) {
        const ox = r % 2 === 1 ? this.BUBBLE_R : 0;
        return { x: this.offsetX + c * this.cellW + ox, y: this.offsetY + r * this.cellH };
    }

    _calcAimLine() {
        this.aimDots = [];
        const D    = this.DPR;
        let x      = this.shooterX / D, y = this.shooterY / D;
        let vx     = Math.cos(this.shooterAngle), vy = Math.sin(this.shooterAngle);
        const R    = this.BUBBLE_R / D;
        const maxB = this.activePowerUp === 'precision' ? 4 : 2;
        const step = this.isMobile ? 12 : 9;
        let bounces = 0;

        for (let i = 0; i < (this.isMobile ? 22 : 35); i++) {
            x += vx * step; y += vy * step;
            const lx = x * D, ly = y * D;
            if (lx <= R * D)              { x = R; vx = -vx; bounces++; }
            if (lx >= this.canvas.width / D - R) { x = this.canvas.width / D - R; vx = -vx; bounces++; }
            if (ly <= this.offsetY / D + R) break;
            if (ly > this.shooterY / D + 10) break;
            if (bounces >= maxB) break;

            let hit = false;
            const r2 = (R * 1.85) ** 2;
            for (let r = 0; r < this.ROWS && !hit; r++) for (let c = 0; c < this.COLS && !hit; c++) {
                if (!this.grid[r]?.[c]) continue;
                const pos = this._bubblePosLogical(r, c);
                if ((x - pos.x) ** 2 + (y - pos.y) ** 2 < r2) hit = true;
            }
            this.aimDots.push({ x, y, t: i / 35 });
            if (hit) break;
        }
    }

    _bubblePosLogical(r, c) {
        const D  = this.DPR;
        const ox = r % 2 === 1 ? this.BUBBLE_R / D : 0;
        return { x: this.offsetX / D + c * (this.cellW / D) + ox, y: this.offsetY / D + r * (this.cellH / D) };
    }

    _shoot() {
        if (!this.canShoot || this.projectile || this.shootCooldown > 0) return;
        this.canShoot      = false;
        this.shootCooldown = 6;
        this.shootRecoil   = 6;
        this.moves++;

        this.projectile = {
            x: this.shooterX, y: this.shooterY,
            vx: Math.cos(this.shooterAngle) * (this.isMobile ? 11 : 14) * this.DPR,
            vy: Math.sin(this.shooterAngle) * (this.isMobile ? 11 : 14) * this.DPR,
            ci: this.currentBubble, isBomb: this.activePowerUp === 'bomb',
            trail: [], age: 0,
        };
        this.activePowerUp = null;
        this._playShoot();
        this._generateShooter();
    }

    _updateProjectile() {
        const p = this.projectile;
        if (!p) return;
        p.age++;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > (this.isMobile ? 5 : 8)) p.trail.shift();
        p.x += p.vx; p.y += p.vy;

        const R = this.BUBBLE_R;
        if (p.x <= R)                        { p.x = R;                         p.vx = -p.vx; }
        if (p.x >= this.canvas.width - R)    { p.x = this.canvas.width - R;     p.vx = -p.vx; }
        if (p.y <= this.BUBBLE_R + this.offsetY) { this._snapBubble(); return; }
        if (p.y > this.canvas.height + 30)   { this.projectile = null; this.canShoot = true; return; }

        const r2 = (R * 1.85) ** 2;
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            if (!this.grid[r]?.[c]) continue;
            const pos = this._bubblePos(r, c);
            if ((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2 < r2) { this._snapBubble(); return; }
        }
    }

    _snapBubble() {
        const p = this.projectile;
        if (!p) return;
        let bestR = -1, bestC = -1, bestD = Infinity;
        const snap2 = (this.BUBBLE_R * 3.5) ** 2;

        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            if (this.grid[r]?.[c]) continue;
            const pos = this._bubblePos(r, c);
            const d   = (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2;
            if (d < bestD && d < snap2) { bestD = d; bestR = r; bestC = c; }
        }

        if (bestR === -1) {
            bestR = 0;
            bestC = Math.max(0, Math.min(this.COLS - 1, Math.round((p.x - this.offsetX) / this.cellW)));
        }

        if (bestR !== -1 && bestC !== -1) {
            if (p.isBomb) { this._explodeBomb(bestR, bestC); this.projectile = null; this.canShoot = true; return; }
            this.grid[bestR][bestC] = { ci: p.ci, scale: 0.2, flash: 6, breathe: 0, isNew: true };
            const matches = this._findMatches(bestR, bestC);
            if (matches.length >= 3) {
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this._popMatches(matches, bestR, bestC);
                if (this.combo >= 2) this._playCombo();
            } else {
                this.combo = 0;
            }
            setTimeout(() => this._dropFloating(), 80);
        }

        this.projectile = null;
        this.canShoot   = true;
        this._updateColorsInPlay();
    }

    _explodeBomb(r, c) {
        let count = 0;
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
            if (dr * dr + dc * dc > 5) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= this.ROWS || nc < 0 || nc >= this.COLS || !this.grid[nr]?.[nc]) continue;
            const pos = this._bubblePos(nr, nc);
            this._spawnPop(pos.x, pos.y, this.COLORS[this.grid[nr][nc].ci].hex, 4);
            this.grid[nr][nc] = null;
            count++;
        }
        this.bubblesPopped += count;
        this.score         += count * 15;
        this._addEarnCoins(count * 3);
        this._addTextPopup(this.shooterX / this.DPR, this.shooterY / this.DPR - 30, `BOMB +${count * 15}`, '#FF7700');
        this._shake(8, 6);
        this._onScore(this.score);
        setTimeout(() => this._dropFloating(), 100);
    }

    _findMatches(sr, sc) {
        if (!this.grid[sr]?.[sc]) return [];
        const target  = this.grid[sr][sc].ci;
        const visited = new Set(), matches = [], queue = [[sr, sc]];
        while (queue.length) {
            const [r, c] = queue.shift();
            const k = r * 100 + c;
            if (visited.has(k) || r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) continue;
            if (!this.grid[r]?.[c] || this.grid[r][c].ci !== target) continue;
            visited.add(k); matches.push([r, c]);
            for (const n of this._neighbors(r, c)) queue.push(n);
        }
        return matches;
    }

    _neighbors(r, c) {
        return r % 2 === 1
            ? [[r-1,c],[r-1,c+1],[r,c-1],[r,c+1],[r+1,c],[r+1,c+1]]
            : [[r-1,c-1],[r-1,c],[r,c-1],[r,c+1],[r+1,c-1],[r+1,c]];
    }

    _popMatches(matches, oR, oC) {
        const combo = Math.min(this.combo, 10);
        const pts   = matches.length * 10 * combo;
        this.score  += pts;
        this.bubblesPopped += matches.length;
        this._addEarnCoins(Math.floor(matches.length * (1 + combo * 0.5)));
        if (combo >= 3 || matches.length >= 5) this._addEarnDiamonds(combo >= 5 ? 2 : 1);

        matches.forEach(([r, c], i) => {
            setTimeout(() => {
                if (this._destroyed) return;
                const pos = this._bubblePos(r, c);
                const hex = this.grid[r]?.[c] ? this.COLORS[this.grid[r][c].ci].hex : '#fff';
                this._spawnPop(pos.x, pos.y, hex, this.isMobile ? 4 : 7);
                if (this.grid[r]) this.grid[r][c] = null;
            }, i * (this.isMobile ? 15 : 22));
        });

        const oPos = this._bubblePos(oR, oC);
        this._addTextPopup(oPos.x / this.DPR, oPos.y / this.DPR - 10, combo > 1 ? `x${combo} +${pts}` : `+${pts}`, combo > 2 ? '#FFD700' : '#00EE66');
        this._onScore(this.score);
        this._shake(combo > 2 ? 8 : 3, combo > 2 ? 5 : 2);
        this._playPop();
    }

    _dropFloating() {
        const connected = new Set(), queue = [];
        for (let c = 0; c < this.COLS; c++) if (this.grid[0]?.[c]) queue.push([0, c]);
        while (queue.length) {
            const [r, c] = queue.shift();
            const k = r * 100 + c;
            if (connected.has(k) || r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS || !this.grid[r]?.[c]) continue;
            connected.add(k);
            for (const n of this._neighbors(r, c)) queue.push(n);
        }
        let dropped = 0;
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            if (this.grid[r]?.[c] && !connected.has(r * 100 + c)) {
                const pos = this._bubblePos(r, c);
                if (this.fallingBubbles.length < this.MAX_PARTICLES / 2) {
                    this.fallingBubbles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 2.5 * this.DPR, vy: -Math.random() * 2 * this.DPR, ci: this.grid[r][c].ci, life: 1 });
                }
                this.grid[r][c] = null;
                dropped++;
                this.bubblesPopped++;
            }
        }
        if (dropped > 0) {
            this.score += dropped * 15;
            this._addEarnCoins(dropped * 2);
            this._addTextPopup(this.canvas.width / 2 / this.DPR, this.canvas.height / 2 / this.DPR - 20, `${dropped} Drop! +${dropped * 15}`, '#FF7700');
            this._onScore(this.score);
        }
        this._checkWin();
    }

    _checkWin() {
        const remaining = this.grid.flat().filter(Boolean).length;
        if (remaining === 0 && !this.gameWon && !this.gameOver) {
            this.gameWon = true;
            const eff = this._levelGoal() / Math.max(1, this.moves);
            this.starRating = eff >= 0.9 ? 3 : eff >= 0.6 ? 2 : 1;
            this.score += Math.max(0, 600 - this.moves * 5 - this.timeElapsed * 2);
            const lc = 50 + (this.currentLevel + 1) * 10 + this.starRating * 20 + this.maxCombo * 5;
            const ld = this.starRating >= 3 ? 3 : this.starRating >= 2 ? 1 : 0;
            this.levelCoins    = lc;
            this.levelDiamonds = ld;
            this.playerData.coins    = (this.playerData.coins    || 0) + lc;
            this.playerData.diamonds = (this.playerData.diamonds || 0) + ld;
            this.showLevelComplete = true;
            this.levelCompleteTimer = 0;
            this._stopTimer();
            this._playWin();
            this._createWinParticles();
            this._onScore(this.score, true);
            this._savePlayerData();
        }
    }

    _checkGameOver() {
        for (let c = 0; c < this.COLS; c++) {
            if (this.grid[this.ROWS - 2]?.[c]) {
                this.gameOver = true;
                this._stopTimer();
                this._savePlayerData();
                setTimeout(() => this._onScore(this.score, true, { level: this.currentLevel + 1, coins: this.levelCoins, diamonds: this.levelDiamonds }), 1200);
                return;
            }
        }
    }

    _goNextLevel() {
        const next = this.currentLevel + 1 >= this.LEVELS.length ? 0 : this.currentLevel + 1;
        this._startLevel(next);
    }

    // ══════════════════ FX ══════════════════

    _addEarnCoins(amt) {
        this.playerData.coins = (this.playerData.coins || 0) + amt;
        this.levelCoins += amt;
    }

    _addEarnDiamonds(amt) {
        this.playerData.diamonds = (this.playerData.diamonds || 0) + amt;
        this.levelDiamonds += amt;
    }

    _addParticle(arr, p) { if (arr.length < this.MAX_PARTICLES) arr.push(p); }

    _spawnPop(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a   = (Math.PI * 2 * i) / count + Math.random() * 0.4;
            const spd = (Math.random() * 3 + 1.5) * this.DPR;
            this._addParticle(this.particles, { x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, color, size: (Math.random() * 2.5 + 1) * this.DPR });
        }
        if (this.popRings.length < 12) this.popRings.push({ x, y, radius: this.BUBBLE_R * 0.3, opacity: 0.6, color });
    }

    _createWinParticles() {
        const count = this.isMobile ? 50 : 90;
        for (let i = 0; i < count; i++) {
            this._addParticle(this.particles, {
                x: this.canvas.width / 2 + (Math.random() - 0.5) * this.canvas.width * 0.8,
                y: this.canvas.height / 2 + (Math.random() - 0.5) * this.canvas.height * 0.5,
                vx: (Math.random() - 0.5) * 10 * this.DPR,
                vy: (Math.random() - 0.5) * 10 * this.DPR - this.DPR,
                life: 1, color: `hsl(${Math.random() * 360},100%,65%)`,
                size: (Math.random() * 4 + 2) * this.DPR,
            });
        }
    }

    _addTextPopup(x, y, text, color) {
        if (this.textPopups.length >= 10) this.textPopups.shift();
        this.textPopups.push({ x, y, text, color, life: 1 });
    }

    _addFloatingText(x, y, text, color, size) {
        this.floatingTexts.push({ x, y, text, color, size: size || 14, life: 1, scale: 0.4 });
    }

    _shake(timer, force) {
        this.shakeTimer = this.isMobile ? Math.ceil(timer * 0.6) : timer;
        this.shakeForce = force;
    }

    _activatePowerUp(type) {
        if (!this.powerUps[type] || this.powerUps[type].count <= 0) return;
        if (this.activePowerUp === type) { this.activePowerUp = null; return; }
        this.powerUps[type].count--;
        this.activePowerUp = type;
        this._addFloatingText(this.canvas.width / 2 / this.DPR, this.canvas.height / 2 / this.DPR, `${this.powerUps[type].name}!`, this.powerUps[type].color, 18);
        this._savePlayerData();
    }

    // ══════════════════ UPDATE ══════════════════

    _update(dt) {
        this.frame++;
        this.globalTime += dt;
        if (this.showDailyReward) { this.dailyAnim = Math.min(1, this.dailyAnim + 0.06); }
        if (this.showLevelComplete) { this.levelCompleteTimer++; }
        if (this.swapAnim > 0) this.swapAnim = Math.max(0, this.swapAnim - 0.07);

        // Angle lerp
        this.shooterAngle += (this.targetAngle - this.shooterAngle) * 0.3;
        if (this.shootRecoil > 0) this.shootRecoil *= 0.78;
        if (this.shootCooldown > 0) this.shootCooldown--;

        // Shake
        if (this.shakeTimer > 0) {
            const f = this.shakeForce * (this.shakeTimer / 10) * (this.isMobile ? 0.5 : 1);
            this.shakeX = (Math.random() - 0.5) * f * this.DPR;
            this.shakeY = (Math.random() - 0.5) * f * this.DPR * 0.3;
            this.shakeTimer--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        // Grid bubbles
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            const b = this.grid[r]?.[c];
            if (!b) continue;
            if (b.isNew) { b.scale += (1 - b.scale) * 0.2; if (b.scale > 0.97) { b.scale = 1; b.isNew = false; } }
            if (b.flash > 0) b.flash -= 0.9;
            if (!this.isMobile) b.breathe += 0.015;
        }

        if (!this.gameWon && !this.gameOver) {
            if (this.projectile) this._updateProjectile();
            this._checkGameOver();
        }

        this._updateFX();
    }

    _updateFX() {
        const g = 0.18 * this.DPR;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += g; p.life -= 0.018; p.vx *= 0.97;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
            const b = this.fallingBubbles[i];
            b.vy += g * 0.9; b.y += b.vy; b.x += b.vx; b.life -= 0.022;
            if (b.life <= 0 || b.y > this.canvas.height + 40) this.fallingBubbles.splice(i, 1);
        }
        for (let i = this.popRings.length - 1; i >= 0; i--) {
            const r = this.popRings[i];
            r.radius += 3 * this.DPR; r.opacity -= 0.055;
            if (r.opacity <= 0) this.popRings.splice(i, 1);
        }
        for (let i = this.textPopups.length - 1; i >= 0; i--) {
            const t = this.textPopups[i];
            t.y -= 0.9; t.life -= 0.02;
            if (t.life <= 0) this.textPopups.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 0.5; t.life -= 0.012;
            t.scale += (1 - t.scale) * 0.14;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    // ══════════════════ TIMER ══════════════════

    _startTimer() {
        this._stopTimer();
        this.timerInterval = setInterval(() => { if (!this.gameWon && !this.gameOver) this.timeElapsed++; }, 1000);
    }

    _stopTimer() {
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    }

    // ══════════════════ INPUT ══════════════════

    _getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width, sy = this.canvas.height / rect.height;
        const src = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : e);
        return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
    }

    _aimAt(px, py) {
        let a = Math.atan2(py - this.shooterY, px - this.shooterX);
        a = Math.max(-Math.PI + 0.08, Math.min(-0.08, a));
        this.targetAngle = a;
        this._calcAimLine();
    }

    _getPUButtons() {
        const D  = this.DPR, s = (this.isMobile ? 44 : 38) * D, gap = 10 * D;
        const keys = Object.keys(this.powerUps), total = keys.length * s + (keys.length - 1) * gap;
        const sx = (this.canvas.width - total) / 2, by = this.canvas.height - s - 8 * D;
        return keys.map((key, i) => ({ x: sx + i * (s + gap), y: by, s, key }));
    }

    _getFSRect() {
        const D = this.DPR, sz = 36 * D, mg = 8 * D;
        return { x: this.canvas.width - sz - mg, y: 10 * D, w: sz, h: sz };
    }

    _isInRect(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

    _onHandleClick(e) {
        e.preventDefault();
        if (this.projectile) return;
        const pos = this._getPos(e);

        if (this._isInRect(pos.x, pos.y, this._getFSRect())) { this._toggleFullscreen(); return; }
        if (this.showDailyReward) { this._claimDailyReward(); return; }
        if (this.showLevelComplete || this.gameWon) { this._goNextLevel(); return; }
        if (this.gameOver) return;

        // Power-up buttons
        for (const b of this._getPUButtons()) {
            if (pos.x >= b.x && pos.x <= b.x + b.s && pos.y >= b.y && pos.y <= b.y + b.s) {
                this._activatePowerUp(b.key); return;
            }
        }

        // Tap current bubble = swap
        const dx = pos.x - this.shooterX, dy = pos.y - this.shooterY;
        if (dx * dx + dy * dy < (this.BUBBLE_R + 14 * this.DPR) ** 2) { this._swapBubble(); return; }

        this._aimAt(pos.x, pos.y);
        this._shoot();
    }

    _onHandleMove(e) {
        if (e.cancelable) e.preventDefault();
        if (this.gameOver || this.gameWon || this.projectile) return;
        const pos = this._getPos(e);
        this.hoverX = pos.x; this.hoverY = pos.y;
        this._aimAt(pos.x, pos.y);
    }

    _onKey(e) {
        if (this._destroyed) return;
        if (e.key === '1') this._activatePowerUp('bomb');
        if (e.key === '2') this._activatePowerUp('precision');
        if (e.key === 'c' || e.key === 'C') this._swapBubble();
        if (e.key === ' ') { e.preventDefault(); this._shoot(); }
        if (e.key === 'f' || e.key === 'F') this._toggleFullscreen();
        if (e.key === 'r') this._startLevel(this.currentLevel);
        if (e.key === 'n' && (this.gameWon || this.showLevelComplete)) this._goNextLevel();
    }

    _onResize() { this._setupCanvas(); }

    _toggleFullscreen() {
        const el = document.documentElement;
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (!isFS) (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el);
        else (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
        setTimeout(() => this._setupCanvas(), 250);
    }

    // ══════════════════ RENDERING ══════════════════

    _mainLoop(ts) {
        if (this._destroyed) return;
        const dt = Math.min((ts || 0) - this._lastFrameTime, 50);
        if (dt < 14) { this.animationFrameId = requestAnimationFrame(t => this._mainLoop(t)); return; }
        this._lastFrameTime = ts || 0;

        this._update(dt);

        const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height;

        ctx.save();
        if (this.shakeX || this.shakeY) ctx.translate(Math.round(this.shakeX), Math.round(this.shakeY));

        this._drawBackground();
        this._drawTopBar();
        this._drawProgressBar();
        this._drawGrid();
        this._drawAimLine();
        this._drawShooter();
        this._drawProjectile();
        this._drawFallingBubbles();
        this._drawPopRings();
        this._drawParticles();
        this._drawTextPopups();
        this._drawFloatingTexts();
        this._drawPowerUpButtons();
        this._drawBottomHUD();
        this._drawFullscreenBtn();

        ctx.restore();

        if (this.showDailyReward && !this.dailyRewardClaimed) this._drawDailyReward();
        if (this.showLevelComplete || this.gameWon) this._drawLevelComplete();
        if (this.gameOver) this._drawGameOver();

        this.animationFrameId = requestAnimationFrame(t => this._mainLoop(t));
    }

    // ══════════════════ DRAW: BACKGROUND ══════════════════

    _drawBackground() {
        const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height;
        if (!this.bgCache || this.bgCache.w !== cw || this.bgCache.h !== ch) {
            const off = document.createElement('canvas');
            off.width = cw; off.height = ch;
            const oc = off.getContext('2d');
            const g  = oc.createLinearGradient(0, 0, 0, ch);
            g.addColorStop(0, '#06061a'); g.addColorStop(0.5, '#0a0a24'); g.addColorStop(1, '#06061a');
            oc.fillStyle = g; oc.fillRect(0, 0, cw, ch);
            const D = this.DPR, gs = 70 * D;
            oc.strokeStyle = 'rgba(100,120,255,0.03)'; oc.lineWidth = D;
            for (let x = 0; x < cw; x += gs) { oc.beginPath(); oc.moveTo(x, 0); oc.lineTo(x, ch); oc.stroke(); }
            for (let y = 0; y < ch; y += gs) { oc.beginPath(); oc.moveTo(0, y); oc.lineTo(cw, y); oc.stroke(); }
            const v = oc.createRadialGradient(cw / 2, ch / 2, ch * 0.2, cw / 2, ch / 2, ch * 0.85);
            v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
            oc.fillStyle = v; oc.fillRect(0, 0, cw, ch);
            this.bgCache = { img: off, w: cw, h: ch };
        }
        ctx.drawImage(this.bgCache.img, 0, 0);
    }

    // ══════════════════ DRAW: TOP BAR ══════════════════

    _drawTopBar() {
        const ctx = this.ctx, cw = this.canvas.width, D = this.DPR;
        const pd = 16 * D, midY = 38 * D;
        const bW = 100 * D, bH = 28 * D, bX = pd, bY = midY - bH / 2;

        // Level badge
        ctx.fillStyle = 'rgba(0,200,150,0.1)';
        ctx.strokeStyle = 'rgba(0,255,200,0.35)';
        ctx.lineWidth = 1.5 * D;
        this._roundRect(ctx, bX, bY, bW, bH, 7 * D, true, true);
        ctx.fillStyle = '#00ffcc';
        ctx.font = `bold ${11 * D}px "Segoe UI",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 6 * D;
        ctx.fillText(`LEVEL ${this.currentLevel + 1}`, bX + bW / 2, midY);
        ctx.shadowBlur = 0;

        // Score center
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${15 * D}px "Segoe UI",sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${this.score} pts`, cw / 2, midY);

        // Right: time + moves
        const mins = Math.floor(this.timeElapsed / 60).toString().padStart(2, '0');
        const secs = (this.timeElapsed % 60).toString().padStart(2, '0');
        ctx.fillStyle = '#aabbdd';
        ctx.font = `${10 * D}px "Segoe UI",sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(`Moves: ${this.moves}  ${mins}:${secs}`, cw - pd, midY - 6 * D);

        // Coins & gems
        ctx.fillStyle = '#FFD700';
        ctx.font = `bold ${10 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`C:${this.playerData.coins || 0}  D:${this.playerData.diamonds || 0}`, cw - pd, midY + 7 * D);

        // Bottom line
        const lineY = 66 * D;
        ctx.strokeStyle = 'rgba(0,255,200,0.25)';
        ctx.lineWidth = D;
        ctx.beginPath(); ctx.moveTo(pd, lineY); ctx.lineTo(cw - pd, lineY); ctx.stroke();
    }

    // ══════════════════ DRAW: PROGRESS BAR ══════════════════

    _drawProgressBar() {
        const ctx = this.ctx, D = this.DPR, cw = this.canvas.width;
        const bx = 10 * D, by = this.HUD_H - 10 * D, bw = cw - 20 * D, bh = 4 * D;
        const total   = this._levelGoal();
        const progress = Math.min(1, this.bubblesPopped / total);

        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this._roundRect(ctx, bx, by, bw, bh, 2 * D, true, false);

        if (progress > 0) {
            const gr = ctx.createLinearGradient(bx, 0, bx + bw * progress, 0);
            gr.addColorStop(0, '#9900FF'); gr.addColorStop(1, '#00EEFF');
            ctx.fillStyle = gr;
            this._roundRect(ctx, bx, by, bw * progress, bh, 2 * D, true, false);
        }
    }

    // ══════════════════ DRAW: GRID ══════════════════

    _drawGrid() {
        const ctx = this.ctx, D = this.DPR, R = this.BUBBLE_R;
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            const b = this.grid[r]?.[c];
            if (!b) continue;
            const pos    = this._bubblePos(r, c);
            const scale  = b.isNew ? b.scale : (this.isMobile ? 1 : 1 + Math.sin(b.breathe) * 0.005);
            const px     = pos.x, py = pos.y;

            // Glow (desktop)
            if (!this.isMobile) {
                const glowImg = this._glowCache.get(b.ci);
                if (glowImg) {
                    ctx.globalAlpha = 0.25;
                    const gs = (R + 14) * 2 * scale;
                    ctx.drawImage(glowImg, px - gs / 2, py - gs / 2, gs, gs);
                    ctx.globalAlpha = 1;
                }
            }

            if (b.flash > 0) ctx.globalAlpha = 0.65 + (b.flash / 6) * 0.35;
            const img = this._bubbleCache.get(b.ci);
            if (img) {
                const bs = (R + 3) * 2 * scale;
                ctx.drawImage(img, px - bs / 2, py - bs / 2, bs, bs);
            }
            ctx.globalAlpha = 1;
        }
    }

    // ══════════════════ DRAW: AIM LINE ══════════════════

    _drawAimLine() {
        if (!this.aimDots.length || this.projectile) return;
        const ctx = this.ctx, D = this.DPR;
        const col = this.COLORS[this.currentBubble];
        for (const d of this.aimDots) {
            ctx.globalAlpha = (1 - d.t) * 0.55;
            ctx.fillStyle   = col.hex;
            ctx.beginPath();
            ctx.arc(d.x * D, d.y * D, Math.max(D, (2.5 - d.t * 1.2) * D), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ══════════════════ DRAW: SHOOTER ══════════════════

    _drawShooter() {
        const ctx = this.ctx, D = this.DPR, R = this.BUBBLE_R;
        const x = this.shooterX, y = this.shooterY;

        // Barrel
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.shooterAngle);
        const bx = (8 - this.shootRecoil) * D, by = -4.5 * D, bw = 26 * D, bh = 9 * D, br = 3 * D;
        const bGrad = ctx.createLinearGradient(0, -4.5 * D, 0, 4.5 * D);
        bGrad.addColorStop(0, '#CC77FF'); bGrad.addColorStop(1, '#770099');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.moveTo(bx + br, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, br);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, br); ctx.arcTo(bx, by + bh, bx, by, br);
        ctx.arcTo(bx, by, bx + bw, by, br); ctx.closePath(); ctx.fill();
        ctx.restore();

        // Shoot glow pulse
        if (!this.isMobile) {
            const pulse = 0.1 + Math.abs(Math.sin(this.globalTime / 500)) * 0.1;
            ctx.globalAlpha = pulse;
            ctx.shadowColor = this.COLORS[this.currentBubble].hex;
            ctx.shadowBlur  = 20 * D;
            ctx.fillStyle   = this.COLORS[this.currentBubble].hex;
            ctx.beginPath(); ctx.arc(x, y, R * 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }

        // Current bubble
        const img = this._bubbleCache.get(this.currentBubble);
        if (img) { const bs = (R + 3) * 2; ctx.drawImage(img, x - bs / 2, y - bs / 2, bs, bs); }

        // Swap ring anim
        if (this.swapAnim > 0) {
            ctx.globalAlpha = this.swapAnim;
            ctx.strokeStyle = this.COLORS[this.currentBubble].hex;
            ctx.lineWidth   = 2 * D;
            ctx.beginPath(); ctx.arc(x, y, R + (4 + (1 - this.swapAnim) * 8) * D, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Tap hint
        const ha = 0.18 + Math.sin(this.globalTime / 500) * 0.15;
        ctx.globalAlpha = ha;
        ctx.fillStyle = '#aabbdd';
        ctx.font = `${8 * D}px "Segoe UI",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('TAP = COLOR', x, y + R + 13 * D);
        ctx.globalAlpha = 1;

        // Next bubble label + preview
        ctx.fillStyle = 'rgba(170,187,221,0.35)';
        ctx.font = `${8 * D}px "Segoe UI",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('NEXT', x + 46 * D, y - 4 * D);
        const nImg = this._bubbleCache.get(this.nextBubble);
        if (nImg) {
            ctx.globalAlpha = 0.7;
            const ns = (R + 3) * 2 * 0.6;
            ctx.drawImage(nImg, x + 46 * D - ns / 2, y + 12 * D - ns / 2, ns, ns);
            ctx.globalAlpha = 1;
        }
    }

    // ══════════════════ DRAW: PROJECTILE ══════════════════

    _drawProjectile() {
        const p = this.projectile;
        if (!p) return;
        const ctx = this.ctx, R = this.BUBBLE_R;
        for (let i = 0; i < p.trail.length; i++) {
            const t = p.trail[i], prog = i / p.trail.length;
            ctx.globalAlpha = prog * 0.25;
            ctx.fillStyle   = this.COLORS[p.ci].hex;
            ctx.beginPath(); ctx.arc(t.x, t.y, R * prog * 0.45, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        const img = this._bubbleCache.get(p.ci);
        if (img) { const bs = (R + 3) * 2; ctx.drawImage(img, p.x - bs / 2, p.y - bs / 2, bs, bs); }
    }

    // ══════════════════ DRAW: FX ══════════════════

    _drawFallingBubbles() {
        const ctx = this.ctx, R = this.BUBBLE_R;
        for (const b of this.fallingBubbles) {
            ctx.globalAlpha = Math.max(0, b.life);
            const img = this._bubbleCache.get(b.ci);
            if (img) { const bs = (R + 3) * 2 * 0.85; ctx.drawImage(img, b.x - bs / 2, b.y - bs / 2, bs, bs); }
        }
        ctx.globalAlpha = 1;
    }

    _drawPopRings() {
        const ctx = this.ctx, D = this.DPR;
        for (const r of this.popRings) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth   = 2 * D * r.opacity;
            ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    _drawParticles() {
        const ctx = this.ctx;
        if (!this.particles.length) return;
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle   = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    _drawTextPopups() {
        const ctx = this.ctx, D = this.DPR;
        for (const t of this.textPopups) {
            ctx.globalAlpha = Math.max(0, t.life);
            ctx.fillStyle   = t.color;
            ctx.font        = `bold ${12 * D}px "Segoe UI",sans-serif`;
            ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            ctx.lineWidth   = 2.5 * D; ctx.lineJoin = 'round';
            ctx.strokeText(t.text, t.x * D, t.y * D);
            ctx.fillText(t.text, t.x * D, t.y * D);
        }
        ctx.globalAlpha = 1;
    }

    _drawFloatingTexts() {
        const ctx = this.ctx, D = this.DPR;
        for (const t of this.floatingTexts) {
            const sz = (t.size || 14) * Math.min(1, t.scale) * D;
            ctx.globalAlpha = Math.max(0, t.life);
            ctx.fillStyle   = t.color;
            ctx.font        = `bold ${sz}px "Segoe UI",sans-serif`;
            ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth   = 2.5 * D; ctx.lineJoin = 'round';
            ctx.strokeText(t.text, t.x * D, t.y * D);
            ctx.fillText(t.text, t.x * D, t.y * D);
        }
        ctx.globalAlpha = 1;
    }

    // ══════════════════ DRAW: BOTTOM HUD ══════════════════

    _drawBottomHUD() {
        const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height, D = this.DPR;
        const pd = 16 * D, lineY = ch - this.BOTTOM_H + 6 * D;
        ctx.strokeStyle = 'rgba(0,255,200,0.2)';
        ctx.lineWidth = D;
        ctx.beginPath(); ctx.moveTo(pd, lineY); ctx.lineTo(cw - pd, lineY); ctx.stroke();

        // Combo display
        if (this.combo > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8 * D;
            ctx.font = `bold ${13 * D}px "Segoe UI",sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(`x${this.combo} COMBO`, cw / 2, lineY - 10 * D);
            ctx.shadowBlur = 0;
        }
    }

    // ══════════════════ DRAW: POWER-UP BUTTONS ══════════════════

    _drawPowerUpButtons() {
        const ctx = this.ctx, D = this.DPR;
        const btns = this._getPUButtons();
        const keys = Object.keys(this.powerUps);
        keys.forEach((key, idx) => {
            const pup    = this.powerUps[key];
            const b      = btns[idx];
            const active = this.activePowerUp === key;
            const has    = pup.count > 0;

            ctx.fillStyle   = active ? pup.color + '33' : 'rgba(0,255,200,0.05)';
            ctx.strokeStyle = active ? pup.color : (has ? 'rgba(0,255,200,0.22)' : 'rgba(80,80,80,0.1)');
            ctx.lineWidth   = (active ? 1.8 : 0.7) * D;
            this._roundRect(ctx, b.x, b.y, b.s, b.s, 10 * D, true, true);

            ctx.globalAlpha = has ? 1 : 0.22;
            ctx.fillStyle   = pup.color;
            ctx.font        = `bold ${this.isMobile ? 17 * D : 14 * D}px "Segoe UI",sans-serif`;
            ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(pup.name[0], b.x + b.s / 2, b.y + b.s / 2 - 5 * D);

            ctx.font      = `${this.isMobile ? 7 * D : 6 * D}px "Segoe UI",sans-serif`;
            ctx.fillStyle = 'rgba(170,187,221,0.55)';
            ctx.fillText(pup.name, b.x + b.s / 2, b.y + b.s - 8 * D);

            if (has) {
                ctx.globalAlpha = 1;
                ctx.fillStyle   = 'rgba(0,0,0,0.7)';
                ctx.beginPath(); ctx.arc(b.x + b.s - 6 * D, b.y + 6 * D, 7 * D, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#00ffcc';
                ctx.font      = `bold ${7 * D}px "Segoe UI",sans-serif`;
                ctx.fillText(`${pup.count}`, b.x + b.s - 6 * D, b.y + 6 * D);
            }
            ctx.globalAlpha = 1;
        });

        if (!this.isMobile) {
            ctx.fillStyle = 'rgba(170,187,221,0.12)';
            ctx.font      = `${6 * D}px "Segoe UI",sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('1=Bomb  2=Aim+  C=Color  F=Full', this.canvas.width / 2, btns[0].y - 6 * D);
        }
    }

    // ══════════════════ DRAW: FULLSCREEN BTN ══════════════════

    _drawFullscreenBtn() {
        const ctx = this.ctx, D = this.DPR;
        const r = this._getFSRect();
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle   = 'rgba(0,10,20,0.55)';
        ctx.strokeStyle = 'rgba(0,255,200,0.25)';
        ctx.lineWidth   = 1.5 * D;
        this._roundRect(ctx, r.x, r.y, r.w, r.h, 8 * D, true, true);
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2, ic = 6 * D;
        ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2 * D; ctx.lineCap = 'round';
        [[-ic,-(ic-3*D),-ic,-ic,-(ic-3*D),-ic],
         [ic-3*D,-ic,ic,-ic,ic,-(ic-3*D)],
         [-ic,ic-3*D,-ic,ic,-(ic-3*D),ic],
         [ic-3*D,ic,ic,ic,ic,ic-3*D]
        ].forEach(([x1,y1,x2,y2,x3,y3]) => {
            ctx.beginPath(); ctx.moveTo(cx+x1,cy+y1); ctx.lineTo(cx+x2,cy+y2); ctx.lineTo(cx+x3,cy+y3); ctx.stroke();
        });
        ctx.restore();
    }

    // ══════════════════ OVERLAYS ══════════════════

    _roundRect(ctx, x, y, w, h, r, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
        if (fill)   ctx.fill();
        if (stroke) ctx.stroke();
    }

    _easeOutBack(t) { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; }

    _drawDailyReward() {
        const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height, D = this.DPR;
        const a = this.dailyAnim;
        ctx.fillStyle = `rgba(5,5,20,${0.82 * a})`; ctx.fillRect(0, 0, cw, ch);
        if (a < 0.3) return;
        const bW = Math.min(400 * D, cw - 40 * D), bH = 230 * D, bX = (cw - bW) / 2, bY = (ch - bH) / 2;
        ctx.save();
        ctx.translate(cw / 2, ch / 2); ctx.scale(this._easeOutBack(Math.min(1, a * 1.2)), this._easeOutBack(Math.min(1, a * 1.2)));
        ctx.translate(-cw / 2, -ch / 2);
        ctx.fillStyle = 'rgba(0,30,50,0.97)'; ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2 * D;
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 20 * D;
        this._roundRect(ctx, bX, bY, bW, bH, 14 * D, true, true);
        ctx.shadowBlur = 0;
        const streak = this.playerData.dailyStreak || 0;
        const coins  = Math.floor(50 * Math.min(1 + streak * 0.25, 3));
        const dias   = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFD700'; ctx.font = `bold ${18 * D}px "Segoe UI",sans-serif`;
        ctx.fillText('Daily Reward!', cw / 2, bY + 36 * D);
        ctx.fillStyle = '#00EEFF'; ctx.font = `${11 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`Day ${streak + 1} Streak`, cw / 2, bY + 60 * D);
        ctx.fillStyle = '#FFD700'; ctx.font = `bold ${22 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`${coins} Coins`, cw / 2, bY + 100 * D);
        ctx.fillStyle = '#00EEFF'; ctx.font = `bold ${18 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`${dias} Gems`, cw / 2, bY + 130 * D);
        const btnW = 160 * D, btnH = 38 * D, btnX = (cw - btnW) / 2, btnY = bY + bH - 52 * D;
        const bg = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
        bg.addColorStop(0, '#9900FF'); bg.addColorStop(1, '#FF2244');
        ctx.fillStyle = bg; this._roundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2, true, false);
        ctx.fillStyle = '#fff'; ctx.font = `bold ${12 * D}px "Segoe UI",sans-serif`;
        ctx.fillText('CLAIM!', cw / 2, btnY + btnH / 2);
        ctx.restore();
    }

    _drawLevelComplete() {
        const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height, D = this.DPR;
        const prog  = Math.min(1, this.levelCompleteTimer / 25);
        const eased = this._easeOutBack(prog);
        ctx.fillStyle = `rgba(5,5,20,${0.8 * prog})`; ctx.fillRect(0, 0, cw, ch);
        if (prog < 0.15) return;
        const bW = Math.min(420 * D, cw - 30 * D), bH = 310 * D, bX = (cw - bW) / 2, bY = (ch - bH) / 2;
        ctx.save();
        ctx.translate(cw / 2, ch / 2); ctx.scale(eased, eased); ctx.translate(-cw / 2, -ch / 2);
        ctx.fillStyle = 'rgba(0,30,50,0.97)'; ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2.5 * D;
        ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 30 * D;
        this._roundRect(ctx, bX, bY, bW, bH, 16 * D, true, true);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#00ffcc'; ctx.font = `bold ${18 * D}px "Segoe UI",sans-serif`;
        ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 10 * D;
        ctx.fillText('LEVEL COMPLETE!', cw / 2, bY + 38 * D);
        ctx.shadowBlur = 0;
        // Stars
        for (let i = 0; i < 3; i++) {
            const sx = cw / 2 + (i - 1) * 40 * D;
            const lit = i < this.starRating;
            ctx.fillStyle = lit ? '#FFD700' : 'rgba(255,255,255,0.15)';
            ctx.font      = `${26 * D}px "Segoe UI",sans-serif`;
            ctx.fillText(lit ? '★' : '☆', sx, bY + 76 * D);
        }
        // Stats
        const stats = [
            { l: 'SCORE',  v: `${this.score}` },
            { l: 'POPPED', v: `${this.bubblesPopped}` },
            { l: 'COMBO',  v: `x${this.maxCombo}` },
            { l: 'MOVES',  v: `${this.moves}` },
        ];
        const colW = bW / 4;
        stats.forEach((s, i) => {
            const sx = bX + colW * i + colW / 2;
            ctx.fillStyle = 'rgba(0,255,200,0.06)'; ctx.strokeStyle = 'rgba(0,255,200,0.18)'; ctx.lineWidth = D;
            this._roundRect(ctx, sx - colW / 2 + 5 * D, bY + 108 * D, colW - 10 * D, 46 * D, 7 * D, true, true);
            ctx.fillStyle = 'rgba(150,200,220,0.55)'; ctx.font = `${8 * D}px "Segoe UI",sans-serif`;
            ctx.fillText(s.l, sx, bY + 120 * D);
            ctx.fillStyle = '#fff'; ctx.font = `bold ${14 * D}px "Segoe UI",sans-serif`;
            ctx.fillText(s.v, sx, bY + 138 * D);
        });
        // Rewards
        ctx.fillStyle = '#FFD700'; ctx.font = `bold ${13 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`+${this.levelCoins} Coins`, cw / 2 - 45 * D, bY + 185 * D);
        ctx.fillStyle = '#00EEFF'; ctx.font = `bold ${13 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`+${this.levelDiamonds} Gems`, cw / 2 + 45 * D, bY + 185 * D);
        // Button
        if (this.levelCompleteTimer > 28) {
            const btnW = 170 * D, btnH = 42 * D, btnX = (cw - btnW) / 2, btnBY = bY + bH - 58 * D;
            const bg = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
            bg.addColorStop(0, '#00aaff'); bg.addColorStop(1, '#00ffcc');
            ctx.fillStyle = bg; ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 14 * D;
            this._roundRect(ctx, btnX, btnBY, btnW, btnH, 11 * D, true, false);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#061518'; ctx.font = `bold ${12 * D}px "Segoe UI",sans-serif`;
            ctx.fillText('NEXT LEVEL →', cw / 2, btnBY + btnH / 2);
        }
        ctx.restore();
    }

    _drawGameOver() {
        const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height, D = this.DPR;
        ctx.fillStyle = 'rgba(5,5,20,0.86)'; ctx.fillRect(0, 0, cw, ch);
        const bW = Math.min(400 * D, cw - 30 * D), bH = 260 * D, bX = (cw - bW) / 2, bY = (ch - bH) / 2;
        ctx.fillStyle = 'rgba(0,20,35,0.97)'; ctx.strokeStyle = '#FF2244'; ctx.lineWidth = 2 * D;
        ctx.shadowColor = '#FF2244'; ctx.shadowBlur = 25 * D;
        this._roundRect(ctx, bX, bY, bW, bH, 16 * D, true, true);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF2244'; ctx.font = `bold ${22 * D}px "Segoe UI",sans-serif`;
        ctx.shadowColor = '#FF2244'; ctx.shadowBlur = 10 * D;
        ctx.fillText('GAME OVER', cw / 2, bY + 44 * D);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.font = `bold ${18 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`${this.score} pts`, cw / 2, bY + 90 * D);
        ctx.fillStyle = 'rgba(150,180,200,0.7)'; ctx.font = `${11 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`Level ${this.currentLevel + 1}  |  Combo x${this.maxCombo}  |  ${this.bubblesPopped} Popped`, cw / 2, bY + 122 * D);
        ctx.fillStyle = '#FFD700'; ctx.font = `bold ${12 * D}px "Segoe UI",sans-serif`;
        ctx.fillText(`+${this.levelCoins} Coins  +${this.levelDiamonds} Gems`, cw / 2, bY + 155 * D);
        const blink = 0.4 + Math.abs(Math.sin(this.globalTime / 450)) * 0.55;
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#aabbdd'; ctx.font = `${10 * D}px "Segoe UI",sans-serif`;
        ctx.fillText('Tap restart to play again', cw / 2, bY + bH - 30 * D);
        ctx.globalAlpha = 1;
    }
}