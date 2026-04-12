/* ============================================================
   KNIFE HIT v5.0 - ULTRA HD MOBILE EDITION
   Crystal Clear Text | DPR Scaled | Zero Blur
   Premium Feel | Addictive Gameplay | Mobile-First
   ============================================================ */

'use strict';

class KnifeHit {
    constructor(canvas, onScore, options = {}) {
        this.canvas  = canvas;
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused    = false;
        this.isPaused  = false;
        this.gameOver  = false;

        // ============================================
        // HD RESOLUTION FIX - CRITICAL
        // ============================================
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.setupHDCanvas();

        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });

        // Logical dimensions
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;

        // ============================================
        // MOBILE DETECTION
        // ============================================
        this.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ('ontouchstart' in window)
            || (window.innerWidth < 768);
        this.isSmallScreen = this.W < 380;

        // ============================================
        // FONT SYSTEM
        // ============================================
        this.FONT_TITLE = '"Orbitron", "Rajdhani", "Segoe UI", monospace';
        this.FONT_UI    = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.FONT_MONO  = '"Rajdhani", "Segoe UI", Roboto, sans-serif';
        this.loadFonts();

        // ============================================
        // SAVE SYSTEM
        // ============================================
        this.saveKey    = 'neonarcade_knifehit_v5';
        this.playerData = this.loadPlayerData();

        // ============================================
        // GAME STATE
        // ============================================
        this.score        = 0;
        this.level        = this.playerData.currentLevel || 1;
        this.stage        = 1;
        this.lives        = 3;
        this.maxLives     = 3;
        this.sessionCoins = 0;
        this.sessionDias  = 0;
        this.combo        = 0;
        this.maxCombo     = 0;

        // ============================================
        // KNIFE CONFIG
        // ============================================
        this.knivesTotal  = 0;
        this.knivesLeft   = 0;
        this.knivesThrown = 0;

        // ============================================
        // TARGET
        // ============================================
        this.target = this.createTarget();

        // ============================================
        // KNIFE SKINS
        // ============================================
        this.knifeSkins = {
            default: { blade: ['#aaa','#e8e8e8','#fff'], handle: ['#2a0e04','#5a2a0e','#2a0e04'], guard: '#777',    name: 'Classic' },
            neon:    { blade: ['#00c4ef','#55e8ff','#fff'], handle: ['#081828','#10305a','#081828'], guard: '#00c4ef', name: 'Neon'    },
            fire:    { blade: ['#ee3300','#ff7700','#ffbb00'], handle: ['#2a0600','#500e00','#2a0600'], guard: '#ee3300', name: 'Fire'    },
            gold:    { blade: ['#bb8800','#FFD700','#fff8dc'], handle: ['#2a1e00','#5a3e00','#2a1e00'], guard: '#FFD700', name: 'Gold'    },
            shadow:  { blade: ['#333','#777','#bbb'],         handle: ['#111','#222','#111'],         guard: '#444',    name: 'Shadow'  }
        };
        this.currentSkin = this.playerData.currentSkin || 'default';

        // ============================================
        // OBJECTS
        // ============================================
        this.stuckKnives   = [];
        this.flyingKnife   = null;
        this.idleKnife     = null;
        this.apples        = [];
        this.orbitCoins    = [];

        // ============================================
        // VISUAL FX POOLS
        // ============================================
        this.particles     = [];
        this.explosions    = [];
        this.scorePopups   = [];
        this.floatingTexts = [];
        this.coinPickups   = [];
        this.breakPieces   = [];
        this.popRings      = [];

        // Max pool sizes for mobile
        this.MAX_PARTICLES = this.isMobile ? 60 : 120;
        this.MAX_POP_RINGS = 12;

        // ============================================
        // SCREEN EFFECTS
        // ============================================
        this.shakeX = 0; this.shakeY = 0;
        this.shakeTimer = 0; this.shakeForce = 0;
        this.flashTimer = 0; this.flashColor = '#ff0055'; this.flashAlpha = 0;

        // ============================================
        // TIMING
        // ============================================
        this.time  = 0;
        this.frame = 0;

        // ============================================
        // STATE FLAGS
        // ============================================
        this.stageComplete      = false;
        this.stageCompleteTimer = 0;

        // ============================================
        // HUD
        // ============================================
        this.hudFlash = {};

        // ============================================
        // POWER-UPS
        // ============================================
        this.powerUps = {
            extraKnife: { count: this.playerData.powerUps?.extraKnife ?? 1, cost: 50,  icon: '🗡', name: 'Extra',  color: '#00FF88' },
            slowTarget: { count: this.playerData.powerUps?.slowTarget ?? 1, cost: 75,  icon: '🐢', name: 'Slow',   color: '#00D4FF' },
            shield:     { count: this.playerData.powerUps?.shield     ?? 1, cost: 100, icon: '🛡', name: 'Shield', color: '#b347d9' },
            bomb:       { count: this.playerData.powerUps?.bomb       ?? 0, cost: 150, icon: '💣', name: 'Bomb',   color: '#FF8C00' }
        };
        this.activeEffects = { slow: false, slowTimer: 0, shield: false };

        // ============================================
        // DAILY REWARD
        // ============================================
        this.showDailyReward    = false;
        this.dailyRewardClaimed = false;
        this.dailyRewardAnim    = 0;
        this.checkDailyReward();

        // ============================================
        // MILESTONES
        // ============================================
        this.milestones        = [5, 10, 20, 30, 50, 75, 100, 150, 200];
        this.milestonesClaimed = new Set();

        // ============================================
        // BACKGROUND
        // ============================================
        this.stars = this.makeStars(this.isMobile ? 40 : 70);

        // Init level
        this.setupLevel();
        this.createIdleKnife();

        // ============================================
        // EVENTS
        // ============================================
        this.boundClick = this.handleClick.bind(this);
        this.boundTouch = this.handleTouch.bind(this);
        this.boundKey   = this.handleKey.bind(this);

        canvas.addEventListener('click',      this.boundClick);
        canvas.addEventListener('touchstart', this.boundTouch, { passive: false });
        document.addEventListener('keydown',  this.boundKey);

        this.lastTime = 0;
        this.animId   = requestAnimationFrame(t => this.loop(t));
    }

    // ============================================================
    // HD CANVAS SETUP
    // ============================================================
    setupHDCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width  || this.canvas.clientWidth  || 400;
        const h = rect.height || this.canvas.clientHeight || 700;
        this.canvas.width  = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
        this.canvas.style.width  = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    // ============================================================
    // FONT LOADING
    // ============================================================
    loadFonts() {
        if (document.fonts) {
            document.fonts.ready.then(() => {
                if (document.fonts.check('12px Orbitron'))  this.FONT_TITLE = 'Orbitron, monospace';
                if (document.fonts.check('12px Rajdhani'))  this.FONT_MONO  = 'Rajdhani, sans-serif';
            });
        }
    }

    // ============================================================
    // DPR HELPERS — all drawing uses these
    // ============================================================
    dX(x)   { return Math.round(x * this.dpr); }
    dY(y)   { return Math.round(y * this.dpr); }
    dS(s)   { return s * this.dpr; }
    dSr(s)  { return Math.round(s * this.dpr); }

    // ============================================================
    // CRISP TEXT — Two-pass: glow then sharp
    // ============================================================
    drawText(ctx, text, x, y, opts = {}) {
        const {
            size      = 14,
            weight    = 'bold',
            color     = '#FFFFFF',
            align     = 'left',
            baseline  = 'alphabetic',
            family    = null,
            glow      = false,
            glowColor = null,
            glowBlur  = 0,
            stroke    = false,
            strokeColor = 'rgba(0,0,0,0.7)',
            strokeWidth = 3,
            opacity   = 1,
            maxWidth  = 0
        } = opts;

        ctx.save();
        ctx.globalAlpha  = opacity;
        ctx.textAlign    = align;
        ctx.textBaseline = baseline;
        ctx.font = `${weight} ${Math.round(size * this.dpr)}px ${family || (size > 16 ? this.FONT_TITLE : this.FONT_UI)}`;

        const px = this.dX(x);
        const py = this.dY(y);
        const mw = maxWidth ? this.dS(maxWidth) : undefined;

        // Stroke outline first
        if (stroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth   = strokeWidth * this.dpr;
            ctx.lineJoin    = 'round';
            ctx.miterLimit  = 2;
            ctx.strokeText(text, px, py, mw);
        }

        // Glow pass (blurred, low opacity)
        if (glow && glowBlur > 0) {
            ctx.shadowBlur  = glowBlur * this.dpr;
            ctx.shadowColor = glowColor || color;
            ctx.fillStyle   = glowColor || color;
            ctx.globalAlpha = opacity * 0.5;
            ctx.fillText(text, px, py, mw);
        }

        // Sharp pass (zero blur)
        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = opacity;
        ctx.fillStyle   = color;
        ctx.fillText(text, px, py, mw);

        ctx.restore();
    }

    // ============================================================
    // CRISP SHAPE HELPERS
    // ============================================================
    fillRect(ctx, x, y, w, h) {
        ctx.fillRect(this.dX(x), this.dY(y), this.dSr(w), this.dSr(h));
    }

    drawCircle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(this.dX(x), this.dY(y), this.dS(r), 0, Math.PI * 2);
    }

    drawRoundRect(ctx, x, y, w, h, r) {
        const dx = this.dX(x), dy = this.dY(y);
        const dw = this.dSr(w), dh = this.dSr(h);
        const dr = this.dS(r);
        ctx.beginPath();
        ctx.moveTo(dx + dr, dy);
        ctx.arcTo(dx + dw, dy, dx + dw, dy + dh, dr);
        ctx.arcTo(dx + dw, dy + dh, dx, dy + dh, dr);
        ctx.arcTo(dx, dy + dh, dx, dy, dr);
        ctx.arcTo(dx, dy, dx + dw, dy, dr);
        ctx.closePath();
    }

    drawLine(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(this.dX(x1), this.dY(y1));
        ctx.lineTo(this.dX(x2), this.dY(y2));
    }

    // ============================================================
    // SAVE / LOAD
    // ============================================================
    loadPlayerData() {
        const defaults = {
            coins: 0, diamonds: 0,
            currentLevel: 1, highestLevel: 1,
            bestScore: 0, totalKnivesThrown: 0,
            totalApplesHit: 0, gamesPlayed: 0,
            totalCoinsEarned: 0, totalDiamondsEarned: 0,
            dailyStreak: 0, lastDailyReward: null,
            levelStars: {}, powerUps: {},
            currentSkin: 'default', skinsUnlocked: ['default']
        };
        try {
            const s = JSON.parse(localStorage.getItem(this.saveKey));
            return s ? { ...defaults, ...s } : defaults;
        } catch { return defaults; }
    }

    savePlayerData() {
        this.playerData.powerUps = {};
        Object.keys(this.powerUps).forEach(k => {
            this.playerData.powerUps[k] = this.powerUps[k].count;
        });
        try { localStorage.setItem(this.saveKey, JSON.stringify(this.playerData)); } catch(e) {}
    }

    // ============================================================
    // DAILY REWARD
    // ============================================================
    checkDailyReward() {
        const today = new Date().toDateString();
        const last  = this.playerData.lastDailyReward;
        if (last !== today) {
            if (last) {
                const diff = Math.floor((new Date() - new Date(last)) / 86400000);
                if (diff > 1) this.playerData.dailyStreak = 0;
            }
            this.showDailyReward    = true;
            this.dailyRewardClaimed = false;
            this.dailyRewardAnim    = 0;
        }
    }

    claimDailyReward() {
        if (this.dailyRewardClaimed) return;
        const streak = this.playerData.dailyStreak;
        const mult   = Math.min(1 + streak * 0.3, 4);
        const coins  = Math.floor(60 * mult);
        const dias   = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));

        let bonusPup = null;
        if (streak > 0 && streak % 5 === 0) {
            const keys = Object.keys(this.powerUps);
            bonusPup   = keys[Math.floor(Math.random() * keys.length)];
            this.powerUps[bonusPup].count++;
        }

        this.playerData.coins               += coins;
        this.playerData.diamonds            += dias;
        this.playerData.totalCoinsEarned    += coins;
        this.playerData.totalDiamondsEarned += dias;
        this.playerData.lastDailyReward      = new Date().toDateString();
        this.playerData.dailyStreak++;
        this.dailyRewardClaimed = true;
        this.showDailyReward    = false;

        this.addFloatingText(this.W/2, this.H/2 - 40, `+${coins} Coins`,    '#FFD700', 22, 160);
        this.addFloatingText(this.W/2, this.H/2,      `+${dias} Diamonds`,  '#00D4FF', 20, 160);
        if (bonusPup) this.addFloatingText(this.W/2, this.H/2 + 40, `+1 ${this.powerUps[bonusPup].name}!`, '#00FF88', 16, 160);

        this.spawnCelebration(this.W/2, this.H/2, 18);
        if (window.audioManager) audioManager.play('achievement');
        this.savePlayerData();
    }

    // ============================================================
    // LEVEL CONFIG
    // ============================================================
    getLevelConfig(level) {
        const l = Math.min(level, 25);
        const map = {
            1:  { knives: 7,  speed: 0.015, pattern: 'constant', apples: 0, bossMode: false, name: 'Beginner'    },
            2:  { knives: 8,  speed: 0.020, pattern: 'constant', apples: 1, bossMode: false, name: 'Warm Up'     },
            3:  { knives: 8,  speed: 0.025, pattern: 'wobble',   apples: 1, bossMode: false, name: 'Wobbler'     },
            4:  { knives: 9,  speed: 0.028, pattern: 'wobble',   apples: 2, bossMode: false, name: 'Two Apples'  },
            5:  { knives: 10, speed: 0.032, pattern: 'reverse',  apples: 1, bossMode: true,  name: 'BOSS 1'      },
            6:  { knives: 9,  speed: 0.030, pattern: 'reverse',  apples: 2, bossMode: false, name: 'Reversal'    },
            7:  { knives: 10, speed: 0.034, pattern: 'wobble',   apples: 2, bossMode: false, name: 'Speed Up'    },
            8:  { knives: 10, speed: 0.038, pattern: 'erratic',  apples: 2, bossMode: false, name: 'Erratic'     },
            9:  { knives: 11, speed: 0.040, pattern: 'erratic',  apples: 3, bossMode: false, name: 'Triple Apple'},
            10: { knives: 12, speed: 0.045, pattern: 'erratic',  apples: 2, bossMode: true,  name: 'BOSS 2'      },
            11: { knives: 11, speed: 0.042, pattern: 'reverse',  apples: 3, bossMode: false, name: 'Fast Spin'   },
            12: { knives: 12, speed: 0.046, pattern: 'crazy',    apples: 2, bossMode: false, name: 'Going Crazy' },
            13: { knives: 12, speed: 0.050, pattern: 'crazy',    apples: 3, bossMode: false, name: 'Nonstop'     },
            14: { knives: 13, speed: 0.054, pattern: 'crazy',    apples: 3, bossMode: false, name: 'Intense'     },
            15: { knives: 14, speed: 0.058, pattern: 'crazy',    apples: 4, bossMode: true,  name: 'BOSS 3'      },
            16: { knives: 12, speed: 0.052, pattern: 'erratic',  apples: 3, bossMode: false, name: 'Storm'       },
            17: { knives: 13, speed: 0.056, pattern: 'crazy',    apples: 3, bossMode: false, name: 'Vortex'      },
            18: { knives: 13, speed: 0.060, pattern: 'crazy',    apples: 4, bossMode: false, name: 'Chaos'       },
            19: { knives: 14, speed: 0.064, pattern: 'crazy',    apples: 4, bossMode: false, name: 'Mayhem'      },
            20: { knives: 15, speed: 0.070, pattern: 'crazy',    apples: 4, bossMode: true,  name: 'MEGA BOSS'   },
            21: { knives: 13, speed: 0.065, pattern: 'crazy',    apples: 4, bossMode: false, name: 'Legend'      },
            22: { knives: 14, speed: 0.068, pattern: 'crazy',    apples: 4, bossMode: false, name: 'Mythic'      },
            23: { knives: 14, speed: 0.072, pattern: 'crazy',    apples: 4, bossMode: false, name: 'Divine'      },
            24: { knives: 15, speed: 0.076, pattern: 'crazy',    apples: 4, bossMode: false, name: 'Immortal'    },
            25: { knives: 16, speed: 0.080, pattern: 'crazy',    apples: 4, bossMode: true,  name: 'FINAL BOSS'  }
        };
        if (map[l]) return map[l];
        return {
            knives: Math.min(8 + Math.floor(l/3), 20),
            speed:  Math.min(0.015 + l*0.004, 0.12),
            pattern: 'crazy', apples: Math.min(Math.floor(l/4), 4),
            bossMode: l % 5 === 0, name: `Endless ${l}`
        };
    }

    // ============================================================
    // TARGET CREATION
    // ============================================================
    createTarget() {
        return {
            x: this.W / 2,
            y: this.H / 2 - 60,
            radius: Math.min(this.W, this.H) * 0.155,
            angle: 0, speed: 0.015, baseSpeed: 0.015,
            direction: 1, pattern: 'constant',
            patternTimer: 0, wobbleY: 0,
            bossMode: false, bossAngle: 0,
            config: null
        };
    }

    // ============================================================
    // LEVEL SETUP
    // ============================================================
    setupLevel() {
        const cfg      = this.getLevelConfig(this.level);
        this.levelCfg  = cfg;

        this.stuckKnives  = [];
        this.apples       = [];
        this.orbitCoins   = [];
        this.flyingKnife  = null;

        this.knivesTotal  = cfg.knives;
        this.knivesLeft   = cfg.knives;
        this.knivesThrown = 0;
        this.combo        = 0;

        this.stageComplete      = false;
        this.stageCompleteTimer = 0;
        this.breakPieces        = [];
        this.particles          = [];
        this.explosions         = [];
        this.scorePopups        = [];
        this.popRings           = [];

        this.target.radius      = Math.min(this.W, this.H) * 0.155;
        this.target.angle       = 0;
        this.target.direction   = 1;
        this.target.speed       = cfg.speed;
        this.target.baseSpeed   = cfg.speed;
        this.target.pattern     = cfg.pattern;
        this.target.patternTimer = 0;
        this.target.bossMode    = cfg.bossMode;
        this.target.bossAngle   = 0;
        this.target.wobbleY     = 0;
        this.target.config      = cfg;
        this.target.x           = this.W / 2;
        this.target.y           = this.H / 2 - 60;

        this.spawnApples(cfg.apples);
        this.spawnOrbitCoins();

        this.addFloatingText(
            this.W/2, this.H/2,
            `Level ${this.level} - ${cfg.name}`,
            cfg.bossMode ? '#FF006E' : '#00FF88', 20, 120
        );
        this.createIdleKnife();
    }

    createIdleKnife() {
        this.idleKnife = {
            x:      this.W / 2,
            y:      this.H - (this.isMobile ? 75 : 90),
            wobble: 0,
            bounce: 0
        };
    }

    // ============================================================
    // SPAWN APPLES
    // ============================================================
    spawnApples(count) {
        this.apples = [];
        const used  = [];
        for (let i = 0; i < count; i++) {
            let angle, tries = 0;
            do { angle = Math.random() * Math.PI * 2; tries++; }
            while (used.some(a => Math.abs(a - angle) < 0.9) && tries < 60);
            used.push(angle);
            const isDiamond = Math.random() < 0.1;
            const isGolden  = !isDiamond && Math.random() < 0.25;
            this.apples.push({
                angle, hit: false, scale: 1, wobble: 0,
                type: isDiamond ? 'diamond' : isGolden ? 'golden' : 'red'
            });
        }
    }

    // ============================================================
    // ORBIT COINS
    // ============================================================
    spawnOrbitCoins() {
        this.orbitCoins = [];
        const count = Math.min(2 + Math.floor(this.level / 3), 5);
        for (let i = 0; i < count; i++) {
            this.orbitCoins.push({
                angle:     (Math.PI * 2 * i) / count,
                orbitR:    this.target.radius + 28,
                collected: false,
                wobble:    0
            });
        }
    }

    // ============================================================
    // INPUT
    // ============================================================
    handleClick(e) {
        if (this.paused || this.gameOver) return;
        if (this.showDailyReward) { this.claimDailyReward(); return; }

        const p = this.getLogicalPos(e);
        if (this.handleUIClick(p.x, p.y)) return;
        if (this.stageComplete || this.flyingKnife || this.knivesLeft <= 0) return;
        this.throwKnife();
    }

    handleTouch(e) {
        e.preventDefault();
        if (this.showDailyReward) { this.claimDailyReward(); return; }
        const p = this.getLogicalPos(e);
        if (this.handleUIClick(p.x, p.y)) return;
        if (this.paused || this.gameOver) return;
        if (this.stageComplete || this.flyingKnife || this.knivesLeft <= 0) return;
        this.throwKnife();
    }

    handleKey(e) {
        if (this.destroyed) return;
        if (e.code === 'Space') { e.preventDefault(); this.throwKnife(); }
        const keys = ['extraKnife','slowTarget','shield','bomb'];
        if (e.key >= '1' && e.key <= '4') this.usePowerUp(keys[+e.key - 1]);
    }

    getLogicalPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.W / rect.width;
        const scaleY = this.H / rect.height;
        let cx, cy;
        if (e.touches) {
            cx = e.touches[0] ? e.touches[0].clientX : e.changedTouches[0].clientX;
            cy = e.touches[0] ? e.touches[0].clientY : e.changedTouches[0].clientY;
        } else {
            cx = e.clientX; cy = e.clientY;
        }
        return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
    }

    handleUIClick(mx, my) {
        const btnS = this.isMobile ? 40 : 36;
        const btnY = this.idleKnife ? this.idleKnife.y + 42 : this.H - 46;
        const startX = 8;
        let idx = 0;
        for (const key of Object.keys(this.powerUps)) {
            const bx = startX + idx * (btnS + 6);
            if (mx >= bx && mx <= bx + btnS && my >= btnY && my <= btnY + btnS) {
                this.usePowerUp(key);
                return true;
            }
            idx++;
        }
        return false;
    }

    // ============================================================
    // POWER-UPS
    // ============================================================
    usePowerUp(type) {
        const pup = this.powerUps[type];
        if (!pup || pup.count <= 0 || this.gameOver || this.stageComplete) return;
        pup.count--;
        switch (type) {
            case 'extraKnife':
                this.knivesLeft  += 2;
                this.knivesTotal += 2;
                this.addFloatingText(this.W/2, this.H*0.35, '+2 Knives!', '#00FF88', 18, 90);
                break;
            case 'slowTarget':
                this.activeEffects.slow      = true;
                this.activeEffects.slowTimer = 5000;
                this.target.speed            = this.target.baseSpeed * 0.35;
                this.addFloatingText(this.W/2, this.H*0.35, 'Slow Motion!', '#00D4FF', 18, 90);
                break;
            case 'shield':
                this.activeEffects.shield = true;
                this.addFloatingText(this.W/2, this.H*0.35, 'Shield ON!', '#b347d9', 18, 90);
                break;
            case 'bomb':
                this.bombClear();
                break;
        }
        if (window.audioManager) audioManager.play('powerUp');
        this.savePlayerData();
    }

    bombClear() {
        const count = this.stuckKnives.length;
        if (count === 0) return;
        this.stuckKnives.forEach(sk => {
            const pos = this.getKnifeWorldPos(sk);
            this.spawnParticles(pos.x, pos.y, '#FF8C00', 8);
            this.explosions.push({ x: pos.x, y: pos.y, radius: 5, opacity: 0.9, color: '#FF8C00' });
        });
        this.stuckKnives = [];
        const bonus = count * 5;
        this.score  += bonus;
        this.onScore(this.score);
        this.earnCoins(count * 2, this.target.x, this.target.y);
        this.addFloatingText(this.W/2, this.H/2, `BOOM! +${bonus}`, '#FF8C00', 20, 100);
        this.shake(12, 8);
        if (window.audioManager) audioManager.play('levelUp');
    }

    // ============================================================
    // THROW KNIFE
    // ============================================================
    throwKnife() {
        this.knivesLeft--;
        this.knivesThrown++;
        this.playerData.totalKnivesThrown++;
        if (this.idleKnife) this.idleKnife.bounce = 8;

        this.flyingKnife = {
            x:     this.W / 2,
            y:     this.idleKnife ? this.idleKnife.y : this.H - 90,
            vy:    -(this.isMobile ? 14 : 17),
            vx:    0,
            trail: [],
            skin:  this.currentSkin
        };
        if (window.audioManager) audioManager.play('knife');
    }

    // ============================================================
    // UPDATE
    // ============================================================
    update(dt) {
        if (this.paused || this.gameOver) return;
        this.time  += dt;
        this.frame++;

        if (this.showDailyReward) {
            this.dailyRewardAnim = Math.min(1, this.dailyRewardAnim + 0.05);
        }

        if (this.stageComplete) {
            this.stageCompleteTimer++;
            this.updateBreakPieces();
            this.updateParticles();
            this.updateFloatingTexts();
            if (this.stageCompleteTimer >= 90) {
                this.level++;
                this.stage++;
                this.playerData.currentLevel = this.level;
                if (this.level > this.playerData.highestLevel) this.playerData.highestLevel = this.level;
                this.savePlayerData();
                this.setupLevel();
            }
            return;
        }

        // Shake
        if (this.shakeTimer > 0) {
            const f = this.shakeForce * (this.shakeTimer / 12);
            this.shakeX = (Math.random() - 0.5) * f;
            this.shakeY = (Math.random() - 0.5) * f * 0.4;
            this.shakeTimer--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        if (this.flashTimer > 0) this.flashTimer--;
        Object.keys(this.hudFlash).forEach(k => { if (this.hudFlash[k] > 0) this.hudFlash[k]--; });

        // Slow timer
        if (this.activeEffects.slow) {
            this.activeEffects.slowTimer -= dt;
            if (this.activeEffects.slowTimer <= 0) {
                this.activeEffects.slow = false;
                this.target.speed       = this.target.baseSpeed;
                this.addFloatingText(this.W/2, this.H*0.35, 'Slow Ended', '#888', 13, 60);
            }
        }

        this.updateTargetRotation(dt);

        // Boss wobble
        if (this.target.bossMode) {
            this.target.bossAngle += 0.04;
            this.target.wobbleY   = Math.sin(this.target.bossAngle) * 22;
        } else {
            this.target.wobbleY = 0;
        }

        if (this.flyingKnife) this.updateFlyingKnife();

        if (this.idleKnife) {
            this.idleKnife.wobble = Math.sin(this.time / 600) * 4;
            if (this.idleKnife.bounce > 0) this.idleKnife.bounce--;
        }

        this.updateOrbitCoins();

        this.apples.forEach(a => {
            if (!a.hit) a.wobble = Math.sin(this.time/300 + a.angle) * 0.04;
            else        a.scale  = Math.max(0, a.scale - 0.07);
        });

        this.stars.forEach(s => { s.phase += s.speed; });

        this.updateParticles();
        this.updateExplosions();
        this.updateScorePopups();
        this.updateFloatingTexts();
        this.updateCoinPickups();
        this.updatePopRings();
    }

    updateTargetRotation(dt) {
        const t    = this.target;
        t.patternTimer += dt || 16;
        const slow = this.activeEffects.slow ? 0.35 : 1;

        switch (t.pattern) {
            case 'constant':
                t.angle += t.speed * t.direction * slow;
                break;
            case 'wobble':
                t.angle += t.speed * t.direction * slow;
                if (t.patternTimer > 1800) { t.direction *= -1; t.patternTimer = 0; }
                break;
            case 'reverse':
                t.speed = t.baseSpeed * (1 + 0.5 * Math.abs(Math.sin(t.patternTimer / 900)));
                t.angle += t.speed * t.direction * slow;
                if (t.patternTimer > 1200 + Math.random()*600) { t.direction *= -1; t.patternTimer = 0; }
                break;
            case 'erratic':
                t.speed = t.baseSpeed * (1 + 0.8 * Math.abs(Math.sin(t.patternTimer / 600)));
                t.angle += t.speed * t.direction * slow;
                if (t.patternTimer > 700 + Math.random()*1000) {
                    t.direction *= -1; t.patternTimer = 0;
                    this.shake(2, 3);
                }
                break;
            case 'crazy':
                t.speed = t.baseSpeed * (1 + Math.abs(Math.sin(t.patternTimer / 400)));
                t.angle += t.speed * t.direction * slow;
                if (Math.random() < 0.006) { t.direction *= -1; t.patternTimer = 0; this.shake(3, 4); }
                if (Math.random() < 0.002)  t.angle += t.direction * 0.3 * slow;
                break;
        }
    }

    updateFlyingKnife() {
        const k = this.flyingKnife;
        k.trail.push({ x: k.x, y: k.y });
        if (k.trail.length > 14) k.trail.shift();

        k.x += k.vx;
        k.y += k.vy;

        const ty   = this.target.y + this.target.wobbleY;
        const dx   = k.x - this.target.x;
        const dy   = k.y - ty;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= this.target.radius + 10) {
            this.onKnifeHitTarget(dx, dy, dist);
            return;
        }
        if (k.y < -80 || k.y > this.H + 80) this.flyingKnife = null;
    }

    updateOrbitCoins() {
        this.orbitCoins.forEach(c => {
            c.angle  += 0.018;
            c.wobble += 0.05;
            if (c.collected) return;
            const angle = this.target.angle + c.angle;
            const cx    = this.target.x + Math.cos(angle) * c.orbitR;
            const cy    = this.target.y + this.target.wobbleY + Math.sin(angle) * c.orbitR;
            if (this.flyingKnife) {
                const dx = this.flyingKnife.x - cx;
                const dy = this.flyingKnife.y - cy;
                if (Math.sqrt(dx*dx + dy*dy) < 20) {
                    c.collected = true;
                    this.earnCoins(1 + Math.floor(this.level/5), cx, cy);
                    this.spawnParticles(cx, cy, '#FFD700', 6);
                    this.popRings.push({ x: cx, y: cy, radius: 5, opacity: 0.7, color: '#FFD700' });
                }
            }
        });
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += p.grav || 0.12; p.vx *= 0.98;
            p.life -= p.decay; p.size *= 0.97;
            if (p.life <= 0 || p.size < 0.3) this.particles.splice(i, 1);
        }
    }

    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const e = this.explosions[i];
            e.radius  += 3.5;
            e.opacity -= 0.055;
            if (e.opacity <= 0) this.explosions.splice(i, 1);
        }
    }

    updateScorePopups() {
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            const p = this.scorePopups[i];
            p.y -= 1.2; p.life -= 2; p.opacity = p.life / 60;
            if (p.life <= 0) this.scorePopups.splice(i, 1);
        }
    }

    updateFloatingTexts() {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 0.6; t.life -= 1;
            t.opacity = Math.min(1, t.life / 40);
            t.scale  += (1 - t.scale) * 0.12;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    updateCoinPickups() {
        for (let i = this.coinPickups.length - 1; i >= 0; i--) {
            const p = this.coinPickups[i];
            p.y += p.vy; p.life -= 2;
            p.opacity = Math.min(1, p.life / 40);
            if (p.life <= 0) this.coinPickups.splice(i, 1);
        }
    }

    updatePopRings() {
        for (let i = this.popRings.length - 1; i >= 0; i--) {
            const r = this.popRings[i];
            r.radius  += 2.5;
            r.opacity -= 0.04;
            if (r.opacity <= 0) this.popRings.splice(i, 1);
        }
    }

    updateBreakPieces() {
        for (let i = this.breakPieces.length - 1; i >= 0; i--) {
            const p = this.breakPieces[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.28; p.rotation += p.rotSpeed;
            p.vx *= 0.99; p.life--;
            if (p.life <= 0) this.breakPieces.splice(i, 1);
        }
    }

    // ============================================================
    // KNIFE HIT TARGET
    // ============================================================
    onKnifeHitTarget(dx, dy, dist) {
        const k        = this.flyingKnife;
        const relAngle = Math.atan2(dy, dx) - this.target.angle;

        // Check stuck knife collision
        let hitStuck = false;
        for (const sk of this.stuckKnives) {
            let diff = Math.abs(relAngle - sk.angle) % (Math.PI * 2);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 0.20) { hitStuck = true; break; }
        }

        if (hitStuck) {
            if (this.activeEffects.shield) {
                this.activeEffects.shield = false;
                this.flashTimer = 8; this.flashColor = '#b347d9';
                this.shake(6, 4);
                this.addFloatingText(this.W/2, this.target.y - 50, 'Shield Blocked!', '#b347d9', 17, 80);
                this.flyingKnife = null;
                this.combo = 0;
                if (this.knivesLeft > 0) this.createIdleKnife();
                return;
            }
            this.onCollision();
            return;
        }

        // Apple check
        for (let i = 0; i < this.apples.length; i++) {
            const a = this.apples[i];
            if (a.hit) continue;
            let diff = Math.abs(relAngle - a.angle) % (Math.PI * 2);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 0.38) { this.hitApple(i, a); break; }
        }

        // Stick knife
        this.stuckKnives.push({ angle: relAngle, skin: k.skin });

        // Score
        this.combo++;
        this.maxCombo   = Math.max(this.maxCombo, this.combo);
        const comboMult = Math.min(this.combo, 8);
        const scoreGain = 10 * comboMult + this.level * 2;
        this.score     += scoreGain;
        this.onScore(this.score);

        const coinEarn = 1 + Math.floor(this.combo/3) + Math.floor(this.level/5);
        this.earnCoins(coinEarn, k.x, k.y - 20);
        if (this.combo > 0 && this.combo % 5 === 0) this.earnDiamonds(1, k.x, k.y - 40);

        this.checkMilestones();

        this.scorePopups.push({
            x: k.x + (Math.random()-0.5)*40,
            y: k.y - 25,
            text: this.combo > 1 ? `x${comboMult} +${scoreGain}` : `+${scoreGain}`,
            color: this.combo > 3 ? '#FFD700' : this.combo > 1 ? '#00FF88' : '#ffffff',
            life: 65, opacity: 1
        });

        const ty = this.target.y + this.target.wobbleY;
        const ex = this.target.x + Math.cos(this.target.angle + relAngle) * this.target.radius;
        const ey = ty + Math.sin(this.target.angle + relAngle) * this.target.radius;

        this.spawnParticles(ex, ey, this.getSkinColor(), 8);
        this.spawnParticles(ex, ey, '#fff', 4);
        if (this.popRings.length < this.MAX_POP_RINGS) {
            this.popRings.push({ x: ex, y: ey, radius: 5, opacity: 0.6, color: this.getSkinColor() });
        }

        if (this.combo > 1) { this.flashTimer = 4; this.flashColor = '#00FF88'; }
        if (window.audioManager) audioManager.play('hit');
        this.shake(3, 3);

        this.flyingKnife = null;

        if (this.knivesLeft === 0) {
            const allApples = this.apples.every(a => a.hit);
            setTimeout(() => this.completeStage(allApples), 350);
        }
    }

    onCollision() {
        this.lives--;
        this.combo = 0;
        this.shake(22, 12);
        this.flashTimer = 18; this.flashColor = '#ff0055';

        const k = this.flyingKnife;
        this.explosions.push({ x: k.x, y: k.y, radius: 5, opacity: 1, color: '#ff0055' });
        this.spawnParticles(k.x, k.y, '#ff0055', 22);
        this.spawnParticles(k.x, k.y, '#FFD700', 10);

        this.addFloatingText(this.W/2, this.H/2 - 20, `COLLISION! Lives: ${this.lives}`, '#FF0055', 17, 100);
        if (window.audioManager) audioManager.play('fail');
        this.flyingKnife = null;

        if (this.lives <= 0) {
            this.gameOver = true;
            this.playerData.totalCoinsEarned    += this.sessionCoins;
            this.playerData.totalDiamondsEarned += this.sessionDias;
            this.playerData.gamesPlayed++;
            if (this.score > this.playerData.bestScore) this.playerData.bestScore = this.score;
            this.savePlayerData();
            setTimeout(() => this.onScore(this.score, true, {
                level: this.level, coins: this.sessionCoins, diamonds: this.sessionDias
            }), 900);
        } else {
            this.createIdleKnife();
        }
    }

    hitApple(idx, apple) {
        apple.hit = true;
        this.playerData.totalApplesHit++;
        const pos = this.getAppleWorldPos(apple);

        const rewards = {
            diamond: { score: 80,  coins: 15, dias: 3, color: '#00D4FF', text: 'DIAMOND! +80' },
            golden:  { score: 50,  coins: 10, dias: 1, color: '#FFD700', text: 'GOLDEN! +50'  },
            red:     { score: 25,  coins: 4,  dias: 0, color: '#FF4444', text: 'APPLE! +25'   }
        };
        const r = rewards[apple.type];

        this.score += r.score;
        this.onScore(this.score);
        this.earnCoins(r.coins, pos.x, pos.y);
        if (r.dias > 0) this.earnDiamonds(r.dias, pos.x, pos.y - 20);

        this.spawnAppleParticles(pos.x, pos.y, apple.type);
        this.explosions.push({ x: pos.x, y: pos.y, radius: 5, opacity: 0.9, color: r.color });
        this.scorePopups.push({ x: pos.x, y: pos.y - 30, text: r.text, color: r.color, life: 90, opacity: 1 });
        if (this.popRings.length < this.MAX_POP_RINGS)
            this.popRings.push({ x: pos.x, y: pos.y, radius: 8, opacity: 0.8, color: r.color });

        this.flashTimer = 10; this.flashColor = r.color;
        this.shake(7, 5);
        if (window.audioManager) audioManager.play('success');
    }

    // ============================================================
    // STAGE COMPLETE
    // ============================================================
    completeStage(allApples = false) {
        this.stageComplete      = true;
        this.stageCompleteTimer = 0;

        const levelBonus  = 50 + this.level * 25;
        const comboBonus  = this.maxCombo * 10;
        const perfBonus   = allApples ? 100 : 0;
        const totalBonus  = levelBonus + comboBonus + perfBonus;

        this.score += totalBonus;
        this.onScore(this.score);

        const coins = 30 + this.level * 8 + this.maxCombo * 3;
        const dias  = (this.levelCfg?.bossMode ? 5 : 1) + (allApples ? 2 : 0);
        this.earnCoins(coins, this.W/2, this.H/2 - 50);
        this.earnDiamonds(dias, this.W/2, this.H/2 - 20);

        const stars = this.knivesThrown <= this.knivesTotal*0.7 ? 3 :
                      this.knivesThrown <= this.knivesTotal*0.9 ? 2 : 1;
        if (!this.playerData.levelStars[this.level] || stars > this.playerData.levelStars[this.level]) {
            this.playerData.levelStars[this.level] = stars;
        }

        this.spawnBreakPieces();
        this.shake(18, 10);
        this.flashTimer = 25; this.flashColor = '#00FF88';

        this.addFloatingText(
            this.W/2, this.H/2 - 30,
            allApples ? 'PERFECT CLEAR!' : 'STAGE CLEAR!',
            '#00FF88', 24, 140
        );
        this.addFloatingText(
            this.W/2, this.H/2 + 20,
            `+${totalBonus} pts  +${coins} Coins  +${dias} Dia`,
            '#FFD700', 13, 130
        );
        this.spawnCelebration(this.W/2, this.H/3, 20);
        if (window.audioManager) audioManager.play('levelUp');
    }

    spawnBreakPieces() {
        const tx = this.target.x;
        const ty = this.target.y + this.target.wobbleY;
        for (let i = 0; i < 14; i++) {
            const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
            const speed = Math.random() * 6 + 3;
            this.breakPieces.push({
                x: tx, y: ty,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
                w: Math.random() * 22 + 10, h: Math.random() * 22 + 10,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random()-0.5) * 0.22,
                life: 70,
                color: this.target.bossMode ? '#aa2200' : '#8B4513'
            });
        }
        this.stuckKnives.forEach(sk => {
            const angle = this.target.angle + sk.angle;
            this.breakPieces.push({
                x: tx + Math.cos(angle) * this.target.radius,
                y: ty + Math.sin(angle) * this.target.radius,
                vx: Math.cos(angle) * (Math.random()*4+2),
                vy: Math.sin(angle) * (Math.random()*4+2) - 2,
                w: 4, h: 35, rotation: angle,
                rotSpeed: (Math.random()-0.5)*0.2,
                life: 55, color: '#cccccc'
            });
        });
    }

    // ============================================================
    // ECONOMY
    // ============================================================
    earnCoins(amount, x, y) {
        this.playerData.coins            += amount;
        this.playerData.totalCoinsEarned += amount;
        this.sessionCoins                += amount;
        this.hudFlash.coins               = 18;
        this.coinPickups.push({ x, y, text: `+${amount} Coins`, color: '#FFD700', life: 75, opacity: 1, vy: -1.2 });
    }

    earnDiamonds(amount, x, y) {
        this.playerData.diamonds            += amount;
        this.playerData.totalDiamondsEarned += amount;
        this.sessionDias                    += amount;
        this.hudFlash.diamonds               = 18;
        this.coinPickups.push({ x, y, text: `+${amount} Diamonds`, color: '#00D4FF', life: 90, opacity: 1, vy: -1.0 });
        if (window.audioManager) audioManager.play('achievement');
    }

    checkMilestones() {
        for (const m of this.milestones) {
            if (this.score >= m * 10 && !this.milestonesClaimed.has(m)) {
                this.milestonesClaimed.add(m);
                this.earnDiamonds(1, this.W/2, this.H * 0.3);
                this.addFloatingText(this.W/2, this.H*0.28, `${m*10} pts! +1 Diamond`, '#00D4FF', 15, 110);
            }
        }
    }

    // ============================================================
    // HELPERS
    // ============================================================
    getAppleWorldPos(apple) {
        const angle = this.target.angle + apple.angle;
        return {
            x: this.target.x + Math.cos(angle) * this.target.radius,
            y: this.target.y + this.target.wobbleY + Math.sin(angle) * this.target.radius
        };
    }

    getKnifeWorldPos(sk) {
        const angle = this.target.angle + sk.angle;
        return {
            x: this.target.x + Math.cos(angle) * this.target.radius,
            y: this.target.y + this.target.wobbleY + Math.sin(angle) * this.target.radius
        };
    }

    getSkinColor() { return this.knifeSkins[this.currentSkin]?.blade[1] || '#ddd'; }

    addFloatingText(x, y, text, color, size = 16, life = 80) {
        this.floatingTexts.push({ x, y, text, color, size, life, opacity: 1, scale: 0.3 });
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
                color, size: Math.random() * 5 + 2,
                life: 1, decay: Math.random()*0.04+0.02, grav: 0.14
            });
        }
    }

    spawnAppleParticles(x, y, type) {
        const colors = {
            diamond: ['#00D4FF','#88eeff','#fff'],
            golden:  ['#FFD700','#FFA500','#fff'],
            red:     ['#FF4444','#FF8888','#fff']
        };
        const cols = colors[type] || colors.red;
        for (let i = 0; i < 22 && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            this.particles.push({
                x, y,
                vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 3,
                color: cols[Math.floor(Math.random()*cols.length)],
                size: Math.random()*6+2, life: 1, decay: 0.022, grav: 0.18
            });
        }
    }

    spawnCelebration(cx, cy, count) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (this.destroyed) return;
                const x = cx + (Math.random()-0.5) * this.W * 0.7;
                const y = cy + (Math.random()-0.5) * this.H * 0.25;
                this.spawnParticles(x, y, this.getSkinColor(), 6);
                if (this.popRings.length < this.MAX_POP_RINGS)
                    this.popRings.push({ x, y, radius: 5, opacity: 0.6, color: this.getSkinColor() });
            }, i * 40);
        }
    }

    shake(timer, force) { this.shakeTimer = timer; this.shakeForce = force; }

    makeStars(count) {
        return Array.from({ length: count }, () => ({
            x: Math.random() * this.W,
            y: Math.random() * this.H,
            size: Math.random() * 1.5 + 0.3,
            phase: Math.random() * 6.28,
            speed: Math.random() * 0.015 + 0.005,
            color: Math.random() > 0.85 ? '#b347d9' : Math.random() > 0.6 ? '#00d4ff' : '#ffffff'
        }));
    }

    fmtNum(n) {
        if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
        return '' + n;
    }

    // ============================================================
    // DRAW — MAIN
    // ============================================================
    draw() {
        const ctx = this.ctx;

        // Clear with solid color (fast, no alpha)
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();

        // Shake
        if (this.shakeX || this.shakeY) {
            ctx.translate(this.dS(this.shakeX), this.dS(this.shakeY));
        }

        this.drawBackground(ctx);

        // Flash overlay
        if (this.flashTimer > 0) {
            const a = (this.flashTimer / 18) * 0.22;
            ctx.fillStyle = this.hexToRgba(this.flashColor, a);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.stageComplete) {
            this.drawStageComplete(ctx);
        } else {
            this.drawOrbitCoins(ctx);
            this.drawTarget(ctx);
            this.drawExplosions(ctx);
            this.drawPopRings(ctx);
            this.drawParticles(ctx);
            this.drawScorePopups(ctx);
            this.drawCoinPickups(ctx);
            if (this.flyingKnife) this.drawFlyingKnife(ctx);
            else                   this.drawIdleKnife(ctx);
            this.drawFloatingTexts(ctx);
        }

        this.drawHUD(ctx);
        this.drawPowerUpBar(ctx);

        ctx.restore();

        // Overlays — no shake
        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyReward(ctx);
        if (this.gameOver) this.drawGameOver(ctx);
    }

    // ============================================================
    // DRAW: BACKGROUND
    // ============================================================
    drawBackground(ctx) {
        const W = this.W, H = this.H;

        const bg = ctx.createRadialGradient(
            this.dX(W/2), this.dY(H*0.4), 0,
            this.dX(W/2), this.dY(H/2), this.dS(H)
        );
        bg.addColorStop(0,   this.target.bossMode ? '#1a0408' : '#120828');
        bg.addColorStop(0.5, this.target.bossMode ? '#0d0208' : '#080518');
        bg.addColorStop(1,   '#040210');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        for (const s of this.stars) {
            const alpha = 0.15 + ((Math.sin(s.phase) + 1) / 2) * 0.55;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = s.color;
            this.drawCircle(ctx, s.x, s.y, s.size);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Vignette
        const vg = ctx.createRadialGradient(
            this.dX(W/2), this.dY(H/2), this.dS(H*0.15),
            this.dX(W/2), this.dY(H/2), this.dS(H*0.85)
        );
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ============================================================
    // DRAW: TARGET (LOG)
    // ============================================================
    drawTarget(ctx) {
        const t  = this.target;
        const tx = this.dX(t.x);
        const ty = this.dY(t.y + t.wobbleY);
        const tr = this.dS(t.radius);

        ctx.save();
        ctx.translate(tx, ty);

        // Outer glow ring
        ctx.save();
        ctx.shadowBlur  = t.bossMode ? this.dS(30) : this.dS(18);
        ctx.shadowColor = t.bossMode ? '#ff0050' : '#ff8c00';
        const glowA = 0.25 + Math.abs(Math.sin(this.time/250)) * 0.28;
        ctx.strokeStyle = t.bossMode
            ? `rgba(255,0,50,${glowA})`
            : `rgba(255,140,60,${glowA * 0.7})`;
        ctx.lineWidth   = this.dS(5);
        ctx.beginPath();
        ctx.arc(0, 0, tr + this.dS(4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.rotate(t.angle);

        // Log body
        const lg = ctx.createRadialGradient(
            -tr*0.22, -tr*0.22, tr*0.07,
            0, 0, tr
        );
        if (t.bossMode) {
            lg.addColorStop(0,   '#b03500');
            lg.addColorStop(0.35,'#881000');
            lg.addColorStop(0.7, '#6a0800');
            lg.addColorStop(1,   '#3a0000');
        } else {
            lg.addColorStop(0,   '#d08030');
            lg.addColorStop(0.35,'#a86020');
            lg.addColorStop(0.7, '#7a4015');
            lg.addColorStop(1,   '#5a2d0a');
        }
        ctx.beginPath();
        ctx.arc(0, 0, tr, 0, Math.PI * 2);
        ctx.fillStyle = lg;
        ctx.fill();

        // Wood details clipped
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, tr, 0, Math.PI * 2);
        ctx.clip();

        // Grain lines
        ctx.globalAlpha = 0.06;
        for (let i = -tr; i < tr; i += this.dS(9)) {
            ctx.beginPath();
            ctx.moveTo(i, -tr);
            ctx.bezierCurveTo(i + this.dS(4), -tr/2, i - this.dS(4), 0, i + this.dS(2), tr);
            ctx.strokeStyle = t.bossMode ? '#ff4400' : '#c8a060';
            ctx.lineWidth   = this.dS(2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Growth rings
        const ringA = t.bossMode
            ? [0.15, 0.10, 0.07, 0.05]
            : [0.12, 0.08, 0.06, 0.04];
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, tr * (i/4.8), 0, Math.PI * 2);
            ctx.strokeStyle = t.bossMode
                ? `rgba(255,80,0,${ringA[i-1]})`
                : `rgba(255,200,140,${ringA[i-1]})`;
            ctx.lineWidth = i === 1 ? this.dS(2.5) : this.dS(1.5);
            ctx.stroke();
        }
        ctx.restore();

        // Bullseye
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, tr*0.13);
        cg.addColorStop(0, t.bossMode ? '#ff6600' : '#f0b060');
        cg.addColorStop(1, t.bossMode ? '#cc2200' : '#b07030');
        ctx.beginPath();
        ctx.arc(0, 0, tr * 0.11, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();

        // Stuck knives — VERTICAL (pointing up from rim)
        this.stuckKnives.forEach(sk => {
            ctx.save();
            ctx.rotate(sk.angle);
            ctx.translate(t.radius - 6, 0); // move to rim in logical space...
            // Draw knife vertically (pointing away from center = outward)
            this.drawKnifeVertical(ctx, sk.skin || this.currentSkin, 0.9);
            ctx.restore();
        });

        // Apples
        this.apples.forEach(a => {
            if (a.hit && a.scale <= 0) return;
            ctx.save();
            ctx.rotate(a.angle);
            ctx.translate(tr, 0);
            ctx.rotate(-a.angle - t.angle + a.wobble);
            ctx.scale(a.scale, a.scale);
            this.drawApple(ctx, 0, 0, a.type);
            ctx.restore();
        });

        ctx.restore(); // un-translate

        // Boss label — crisp
        if (t.bossMode) {
            const pulse = 0.65 + Math.sin(this.time/180) * 0.35;
            this.drawText(ctx, 'BOSS', t.x, t.y + t.wobbleY - t.radius - 14, {
                size: 12, weight: 'bold', color: '#ff3355',
                align: 'center', family: this.FONT_TITLE,
                glow: true, glowColor: '#ff0055', glowBlur: 8,
                opacity: pulse
            });
        }
    }

    // ============================================================
    // DRAW: KNIFE VERTICAL (pointing UP = outward from log rim)
    // Called when ctx is already rotated to sk.angle and translated to rim
    // The tip points outward (positive local X), handle inward
    // ============================================================
    drawKnifeVertical(ctx, skinName = 'default', scale = 1) {
        const skin = this.knifeSkins[skinName] || this.knifeSkins.default;

        ctx.save();
        ctx.scale(this.dpr * scale, this.dpr * scale);

        // Knife is drawn pointing in +X direction (outward from center)
        // Tip at +X, handle at -X

        // Blade glow
        ctx.shadowBlur  = 6;
        ctx.shadowColor = skin.blade[1];

        const bg = ctx.createLinearGradient(38, -3, 0, 3);
        bg.addColorStop(0,   skin.blade[2]);
        bg.addColorStop(0.4, skin.blade[1]);
        bg.addColorStop(1,   skin.blade[0]);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(0,  0);
        ctx.lineTo(10,  -3.5);
        ctx.lineTo(34,  -2);
        ctx.lineTo(38,   0);
        ctx.lineTo(34,   2);
        ctx.lineTo(10,   3.5);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Blade shine
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.beginPath();
        ctx.moveTo(8,  -0.5);
        ctx.lineTo(32, -1.5);
        ctx.lineTo(32,  0.5);
        ctx.lineTo(8,   1.0);
        ctx.closePath();
        ctx.fill();

        // Guard
        ctx.fillStyle = skin.guard;
        ctx.fillRect(-5, -7, 6, 14);
        const guardGrad = ctx.createLinearGradient(-5, -7, 1, -7);
        guardGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
        guardGrad.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = guardGrad;
        ctx.fillRect(-5, -7, 6, 14);

        // Handle
        const hg = ctx.createLinearGradient(-5.5, -5, -5.5, 5);
        hg.addColorStop(0,   skin.handle[0]);
        hg.addColorStop(0.5, skin.handle[1]);
        hg.addColorStop(1,   skin.handle[2]);
        ctx.fillStyle = hg;
        ctx.fillRect(-26, -5.5, 22, 11);

        // Grip lines
        ctx.strokeStyle = 'rgba(255,200,100,0.28)';
        ctx.lineWidth   = 1;
        for (let i = -24; i < -5; i += 4.5) {
            ctx.beginPath();
            ctx.moveTo(i, -5); ctx.lineTo(i, 5);
            ctx.stroke();
        }

        // End cap
        ctx.fillStyle = skin.handle[0];
        ctx.beginPath();
        ctx.ellipse(-26, 0, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ============================================================
    // DRAW: APPLE
    // ============================================================
    drawApple(ctx, x, y, type) {
        const styles = {
            diamond: { body: '#00D4FF', shine: '#aaeeff', stem: '#2a5a8a', leaf: '#1a4a6a', glow: '#00D4FF' },
            golden:  { body: '#FFD700', shine: '#FFF8C0', stem: '#5a3a10', leaf: '#2a8a2a', glow: '#FFD700' },
            red:     { body: '#FF3333', shine: '#FF9999', stem: '#5a3010', leaf: '#2a8a2a', glow: '#FF3333' }
        };
        const s = styles[type] || styles.red;

        ctx.save();
        ctx.translate(0, 0); // already translated by caller

        ctx.shadowBlur  = this.dS(10);
        ctx.shadowColor = s.glow;

        const ag = ctx.createRadialGradient(
            -this.dS(3), -this.dS(3), this.dS(1),
            0, this.dS(1), this.dS(11)
        );
        ag.addColorStop(0, s.shine);
        ag.addColorStop(0.5, s.body);
        ag.addColorStop(1, this.darkenHex(s.body, 30));
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.ellipse(0, this.dS(2), this.dS(9), this.dS(10), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shine
        ctx.globalAlpha = 0.4;
        ctx.fillStyle   = s.shine;
        ctx.beginPath();
        ctx.ellipse(this.dS(-3), this.dS(-2), this.dS(3), this.dS(4), -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Stem
        ctx.strokeStyle = s.stem;
        ctx.lineWidth   = this.dS(1.8);
        ctx.beginPath();
        ctx.moveTo(0, this.dS(-8));
        ctx.quadraticCurveTo(this.dS(5), this.dS(-14), this.dS(2), this.dS(-17));
        ctx.stroke();

        // Leaf
        ctx.fillStyle = s.leaf;
        ctx.beginPath();
        ctx.ellipse(this.dS(3.5), this.dS(-13), this.dS(5.5), this.dS(3), 0.5, 0, Math.PI * 2);
        ctx.fill();

        if (type === 'diamond') {
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            [[0,-4],[6,2],[-5,4]].forEach(([sx,sy]) => {
                ctx.beginPath();
                ctx.arc(this.dS(sx), this.dS(sy), this.dS(1.5), 0, Math.PI*2);
                ctx.fill();
            });
        }
        ctx.restore();
    }

    // ============================================================
    // DRAW: FLYING KNIFE (vertical, pointing UP)
    // ============================================================
    drawFlyingKnife(ctx) {
        const k = this.flyingKnife;

        // Trail
        k.trail.forEach((t, i) => {
            const ratio = i / k.trail.length;
            ctx.save();
            ctx.globalAlpha = ratio * 0.25;
            ctx.translate(this.dX(t.x), this.dY(t.y));
            // Trail shows knife moving upward
            this.drawKnifeAtShooter(ctx, k.skin, ratio * 0.65);
            ctx.restore();
        });
        ctx.globalAlpha = 1;

        ctx.save();
        ctx.translate(this.dX(k.x), this.dY(k.y));
        this.drawKnifeAtShooter(ctx, k.skin, 1);
        ctx.restore();
    }

    // Knife pointing UP (for shooter position and flying)
    drawKnifeAtShooter(ctx, skinName = 'default', scale = 1) {
        const skin = this.knifeSkins[skinName] || this.knifeSkins.default;

        ctx.save();
        ctx.scale(this.dpr * scale, this.dpr * scale);

        // Blade points UP (negative Y), handle DOWN (+Y)

        // Glow
        ctx.shadowBlur  = 7;
        ctx.shadowColor = skin.blade[1];

        const bg = ctx.createLinearGradient(-3, -38, 3, 0);
        bg.addColorStop(0,   skin.blade[2]);
        bg.addColorStop(0.4, skin.blade[1]);
        bg.addColorStop(1,   skin.blade[0]);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(0,    0);
        ctx.lineTo(-3.5, -10);
        ctx.lineTo(-2,   -34);
        ctx.lineTo(0,    -38);
        ctx.lineTo(2,    -34);
        ctx.lineTo(3.5,  -10);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(0.5,  -6);
        ctx.lineTo(-0.3, -30);
        ctx.lineTo(1.8,  -30);
        ctx.lineTo(1.8,  -6);
        ctx.closePath();
        ctx.fill();

        // Guard
        ctx.fillStyle = skin.guard;
        ctx.fillRect(-7, -5, 14, 6);
        const gg = ctx.createLinearGradient(0, -5, 0, 1);
        gg.addColorStop(0, 'rgba(255,255,255,0.18)');
        gg.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = gg;
        ctx.fillRect(-7, -5, 14, 6);

        // Handle
        const hg = ctx.createLinearGradient(-5.5, 0, 5.5, 0);
        hg.addColorStop(0,   skin.handle[0]);
        hg.addColorStop(0.5, skin.handle[1]);
        hg.addColorStop(1,   skin.handle[2]);
        ctx.fillStyle = hg;
        ctx.fillRect(-5.5, 1, 11, 24);

        // Grip lines
        ctx.strokeStyle = 'rgba(255,200,100,0.28)';
        ctx.lineWidth   = 1;
        for (let i = 5; i < 22; i += 4.5) {
            ctx.beginPath();
            ctx.moveTo(-5, i); ctx.lineTo(5, i);
            ctx.stroke();
        }

        // End cap
        ctx.fillStyle = skin.handle[0];
        ctx.beginPath();
        ctx.ellipse(0, 25, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ============================================================
    // DRAW: IDLE KNIFE (at shooter, pointing UP)
    // ============================================================
    drawIdleKnife(ctx) {
        if (!this.idleKnife || this.knivesLeft <= 0) return;
        const k  = this.idleKnife;
        const bY = k.bounce > 0 ? k.bounce * -1.5 : k.wobble;

        ctx.save();
        ctx.translate(this.dX(k.x), this.dY(k.y + bY));
        this.drawKnifeAtShooter(ctx, this.currentSkin, 1);
        ctx.restore();

        // Platform glow
        const pg = ctx.createRadialGradient(
            this.dX(k.x), this.dY(k.y + 32), this.dS(8),
            this.dX(k.x), this.dY(k.y + 32), this.dS(50)
        );
        pg.addColorStop(0, 'rgba(179,71,217,0.15)');
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(this.dX(k.x), this.dY(k.y + 32), this.dS(52), this.dS(11), 0, 0, Math.PI*2);
        ctx.fill();

        // Knives-remaining dots
        const total  = this.knivesTotal;
        const left   = this.knivesLeft;
        const dotSpacing = 13;
        const dotsW  = total * dotSpacing;
        const startX = k.x - dotsW / 2;

        for (let i = 0; i < total; i++) {
            const dx = startX + i * dotSpacing;
            const dy = k.y + 50;
            ctx.save();
            ctx.shadowBlur  = i < left ? this.dS(5) : 0;
            ctx.shadowColor = '#b347d9';
            ctx.fillStyle   = i < left ? '#b347d9' : 'rgba(120,120,120,0.25)';
            this.fillRect(ctx, dx - 1.5, dy - 8, 3, 16);
            ctx.restore();
        }

        // Tap hint
        if (this.knivesThrown === 0) {
            const pulse = 0.45 + Math.sin(this.time/400) * 0.45;
            this.drawText(ctx, 'TAP TO THROW', k.x, k.y + 72, {
                size: 10, weight: '600', color: '#ffffff',
                align: 'center', opacity: pulse * 0.7,
                family: this.FONT_MONO
            });
        }
    }

    // ============================================================
    // DRAW: ORBIT COINS
    // ============================================================
    drawOrbitCoins(ctx) {
        const t = this.target;
        this.orbitCoins.forEach(c => {
            if (c.collected) return;
            const angle = t.angle + c.angle;
            const cx    = t.x + Math.cos(angle) * c.orbitR;
            const cy    = t.y + t.wobbleY + Math.sin(angle) * c.orbitR;
            const pulse = 0.85 + Math.sin(c.wobble) * 0.15;

            ctx.save();
            ctx.translate(this.dX(cx), this.dY(cy));
            ctx.scale(pulse, pulse);

            ctx.shadowBlur  = this.dS(9);
            ctx.shadowColor = '#FFD700';
            ctx.fillStyle   = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, 0, this.dS(7), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#FFF8C0';
            ctx.beginPath();
            ctx.arc(this.dS(-2), this.dS(-2), this.dS(2.5), 0, Math.PI * 2);
            ctx.fill();

            // Coin symbol — crisp
            ctx.shadowBlur   = 0;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.font         = `bold ${this.dSr(8)}px Arial`;
            ctx.fillStyle    = '#AA7700';
            ctx.fillText('$', 0, this.dS(1));

            ctx.restore();
        });
    }

    // ============================================================
    // DRAW: PARTICLES & FX
    // ============================================================
    drawExplosions(ctx) {
        ctx.save();
        this.explosions.forEach(e => {
            ctx.globalAlpha = e.opacity;
            ctx.shadowBlur  = this.dS(12);
            ctx.shadowColor = e.color;
            ctx.strokeStyle = e.color;
            ctx.lineWidth   = this.dS(3);
            ctx.beginPath();
            ctx.arc(this.dX(e.x), this.dY(e.y), this.dS(e.radius), 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = e.opacity * 0.2;
            ctx.fillStyle   = e.color;
            ctx.beginPath();
            ctx.arc(this.dX(e.x), this.dY(e.y), this.dS(e.radius * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.restore();
    }

    drawPopRings(ctx) {
        ctx.save();
        for (const r of this.popRings) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth   = this.dS(2 * r.opacity);
            ctx.beginPath();
            ctx.arc(this.dX(r.x), this.dY(r.y), this.dS(r.radius), 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawParticles(ctx) {
        ctx.save();
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.min(1, p.life);
            ctx.shadowBlur  = this.dS(4);
            ctx.shadowColor = p.color;
            ctx.fillStyle   = p.color;
            this.drawCircle(ctx, p.x, p.y, Math.max(0.5, p.size * p.life));
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.restore();
    }

    drawScorePopups(ctx) {
        this.scorePopups.forEach(p => {
            this.drawText(ctx, p.text, p.x, p.y, {
                size: 13, weight: 'bold', color: p.color,
                align: 'center', opacity: p.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 2.5,
                glow: true, glowColor: p.color, glowBlur: 6,
                family: this.FONT_TITLE
            });
        });
    }

    drawCoinPickups(ctx) {
        this.coinPickups.forEach(p => {
            this.drawText(ctx, p.text, p.x, p.y, {
                size: 11, weight: 'bold', color: p.color,
                align: 'center', opacity: p.opacity,
                family: this.FONT_TITLE
            });
        });
    }

    drawFloatingTexts(ctx) {
        this.floatingTexts.forEach(t => {
            const sc = t.scale || 1;
            this.drawText(ctx, t.text, t.x, t.y, {
                size: (t.size || 16) * Math.min(1, sc),
                weight: 'bold', color: t.color,
                align: 'center', opacity: t.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.5)', strokeWidth: 3,
                glow: true, glowColor: t.color, glowBlur: 8,
                family: this.FONT_TITLE
            });
        });
    }

    // ============================================================
    // DRAW: STAGE COMPLETE
    // ============================================================
    drawStageComplete(ctx) {
        this.drawBackground(ctx);

        this.breakPieces.forEach(p => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life / 70);
            ctx.translate(this.dX(p.x), this.dY(p.y));
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            this.fillRect(ctx, -p.w/2, -p.h/2, p.w, p.h);
            ctx.restore();
        });

        this.drawParticles(ctx);
        this.drawPopRings(ctx);
        this.drawFloatingTexts(ctx);
        this.drawCoinPickups(ctx);
    }

    // ============================================================
    // DRAW: HUD
    // ============================================================
    drawHUD(ctx) {
        const W = this.W;

        // Top bar
        const hudGrad = ctx.createLinearGradient(0, 0, 0, this.dY(40));
        hudGrad.addColorStop(0, 'rgba(0,0,0,0.72)');
        hudGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = hudGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.dY(40));

        // Bottom separator
        ctx.strokeStyle = 'rgba(179,71,217,0.15)';
        ctx.lineWidth   = this.dS(0.5);
        this.drawLine(ctx, 0, 40, W, 40);
        ctx.stroke();

        // Level label
        this.drawText(ctx, `LV.${this.level}`, 10, 18, {
            size: 12, weight: 'bold', color: '#cc66ff',
            family: this.FONT_TITLE,
            glow: true, glowColor: '#b347d9', glowBlur: 5
        });

        // Level name
        this.drawText(ctx, this.levelCfg?.name || '', 10, 32, {
            size: 9, weight: '500', color: 'rgba(200,200,255,0.4)',
            family: this.FONT_MONO
        });

        // Stage label (center)
        this.drawText(ctx, `STAGE ${this.stage}`, W/2, 19, {
            size: 11, weight: '600', color: '#44ddff',
            align: 'center', family: this.FONT_MONO
        });

        // Pattern label (center)
        const patNames = { constant:'STEADY', wobble:'WOBBLE', reverse:'REVERSE', erratic:'ERRATIC', crazy:'CRAZY' };
        this.drawText(ctx, patNames[this.target.pattern] || '', W/2, 32, {
            size: 8, weight: '600', color: 'rgba(255,200,0,0.5)',
            align: 'center', family: this.FONT_TITLE
        });

        // Coins (right)
        const coinFlash = this.hudFlash.coins > 0;
        const diaFlash  = this.hudFlash.diamonds > 0;

        // Currency bg
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        this.drawRoundRect(ctx, W - 92, 4, 84, 34, 6);
        ctx.fill();

        this.drawText(ctx, `C ${this.fmtNum(this.playerData.coins)}`, W - 10, 18, {
            size: coinFlash ? 11 : 10, weight: 'bold',
            color: coinFlash ? '#ffffff' : '#FFD700',
            align: 'right', family: this.FONT_TITLE,
            glow: coinFlash, glowColor: '#FFD700', glowBlur: 5
        });

        this.drawText(ctx, `D ${this.fmtNum(this.playerData.diamonds)}`, W - 10, 32, {
            size: diaFlash ? 11 : 10, weight: 'bold',
            color: diaFlash ? '#ffffff' : '#00D4FF',
            align: 'right', family: this.FONT_TITLE,
            glow: diaFlash, glowColor: '#00D4FF', glowBlur: 5
        });

        // Hearts
        for (let i = 0; i < this.maxLives; i++) {
            const alive = i < this.lives;
            ctx.save();
            ctx.shadowBlur  = alive ? this.dS(6) : 0;
            ctx.shadowColor = '#ff0055';
            ctx.font        = `${this.dSr(16)}px serif`;
            ctx.textAlign   = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.globalAlpha = alive ? 1 : 0.18;
            ctx.fillStyle   = '#ff0055';
            ctx.fillText('\u2665', this.dX(W - 96 - i*21), this.dY(23));
            ctx.restore();
        }

        // Slow bar
        if (this.activeEffects.slow) {
            const pct = this.activeEffects.slowTimer / 5000;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            this.fillRect(ctx, 8, 42, 82, 7);
            const slg = ctx.createLinearGradient(this.dX(8), 0, this.dX(8 + 82*pct), 0);
            slg.addColorStop(0, '#00D4FF');
            slg.addColorStop(1, '#00FF88');
            ctx.fillStyle = slg;
            this.fillRect(ctx, 8, 42, 82 * pct, 7);
            this.drawText(ctx, 'SLOW', 10, 58, { size: 8, color: '#00D4FF', family: this.FONT_TITLE });
        }

        // Shield
        if (this.activeEffects.shield) {
            this.drawText(ctx, 'SHIELD ACTIVE', W/2, 52, {
                size: 10, weight: 'bold', color: '#cc77ff',
                align: 'center', family: this.FONT_TITLE,
                glow: true, glowColor: '#b347d9', glowBlur: 6
            });
        }

        // Combo
        if (this.combo > 1) {
            const ca  = 0.7 + Math.sin(this.time/120) * 0.3;
            this.drawText(ctx, `x${this.combo} COMBO`, W/2, this.H - 18, {
                size: 15, weight: 'bold', color: '#FFD700',
                align: 'center', opacity: ca,
                glow: true, glowColor: '#FFD700', glowBlur: 8,
                family: this.FONT_TITLE
            });
        }

        // Boss pulsing label
        if (this.target.bossMode && !this.stageComplete) {
            const ba = 0.65 + Math.sin(this.time/200) * 0.35;
            this.drawText(ctx, 'BOSS STAGE!', W/2, 60, {
                size: 13, weight: 'bold', color: '#ff3366',
                align: 'center', opacity: ba,
                glow: true, glowColor: '#ff0055', glowBlur: 10,
                family: this.FONT_TITLE
            });
        }
    }

    // ============================================================
    // DRAW: POWER-UP BAR
    // ============================================================
    drawPowerUpBar(ctx) {
        const btnS   = this.isMobile ? 40 : 36;
        const btnY   = this.idleKnife ? this.idleKnife.y + 42 : this.H - 46;
        const startX = 8;
        let   idx    = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx     = startX + idx * (btnS + 6);
            const canUse = pup.count > 0;

            // BG
            ctx.fillStyle = canUse ? `rgba(${this.hexToRgbParts(pup.color)},0.1)` : 'rgba(20,20,20,0.28)';
            this.drawRoundRect(ctx, bx, btnY, btnS, btnS, 8);
            ctx.fill();

            // Border
            ctx.strokeStyle = canUse ? `rgba(${this.hexToRgbParts(pup.color)},0.45)` : 'rgba(70,70,70,0.22)';
            ctx.lineWidth   = this.dS(1);
            this.drawRoundRect(ctx, bx, btnY, btnS, btnS, 8);
            ctx.stroke();

            // Icon
            ctx.save();
            ctx.globalAlpha  = canUse ? 1 : 0.25;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur   = 0;
            ctx.font         = `${this.dSr(this.isMobile ? 16 : 14)}px Arial`;
            ctx.fillStyle    = '#fff';
            ctx.fillText(pup.icon, this.dX(bx + btnS/2), this.dY(btnY + btnS/2 - 4));
            ctx.restore();

            // Count badge
            if (canUse) {
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.beginPath();
                ctx.arc(this.dX(bx + btnS - 4), this.dY(btnY + btnS - 5), this.dS(7), 0, Math.PI*2);
                ctx.fill();

                this.drawText(ctx, `${pup.count}`, bx + btnS - 4, btnY + btnS - 5, {
                    size: 7, weight: 'bold', color: '#00FF88',
                    align: 'center', baseline: 'middle',
                    family: this.FONT_TITLE
                });
            }

            // Key hint
            this.drawText(ctx, `${idx+1}`, bx + 3, btnY + 10, {
                size: 7, color: 'rgba(255,255,255,0.28)', family: this.FONT_UI
            });

            idx++;
        }
    }

    // ============================================================
    // DRAW: DAILY REWARD
    // ============================================================
    drawDailyReward(ctx) {
        const a = this.dailyRewardAnim;
        ctx.fillStyle = `rgba(0,0,0,${0.88 * a})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (a < 0.3) return;

        const W  = this.W, H = this.H;
        const cw = Math.min(282, W - 30);
        const ch = 258;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        this.drawCardBG(ctx, cx, cy, cw, ch, '#FFD700');

        const streak = this.playerData.dailyStreak;
        const mult   = Math.min(1 + streak * 0.3, 4);
        const coins  = Math.floor(60 * mult);
        const dias   = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));

        this.drawText(ctx, 'Daily Reward!', W/2, cy + 38, {
            size: 19, weight: 'bold', color: '#FFD700',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FFD700', glowBlur: 7
        });

        this.drawText(ctx, `Day ${streak + 1} Streak!`, W/2, cy + 60, {
            size: 12, color: '#00D4FF', align: 'center', family: this.FONT_MONO
        });

        // Divider
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        this.fillRect(ctx, cx + 16, cy + 68, cw - 32, 1);

        this.drawText(ctx, `${coins} Coins`, W/2, cy + 106, {
            size: 24, weight: 'bold', color: '#FFD700',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FFD700', glowBlur: 5
        });

        this.drawText(ctx, `${dias} Diamonds`, W/2, cy + 140, {
            size: 20, weight: 'bold', color: '#00D4FF',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#00D4FF', glowBlur: 5
        });

        if (streak > 0 && streak % 5 === 0) {
            this.drawText(ctx, '+ Bonus Power-up!', W/2, cy + 166, {
                size: 11, color: '#00FF88', align: 'center', family: this.FONT_MONO
            });
        }

        this.drawBtn(ctx, W/2, cy + ch - 44, 150, 38, 'CLAIM!', '#B94FE3', '#FF006E');
    }

    // ============================================================
    // DRAW: GAME OVER
    // ============================================================
    drawGameOver(ctx) {
        const W = this.W, H = this.H;

        ctx.fillStyle = 'rgba(0,0,0,0.84)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const pw = Math.min(W - 28, 302);
        const ph = 292;
        const px = (W - pw) / 2;
        const py = (H - ph) / 2;

        this.drawCardBG(ctx, px, py, pw, ph, '#b347d9');

        // Top accent
        ctx.fillStyle = 'rgba(255,0,110,0.12)';
        this.fillRect(ctx, px, py, pw, 3);

        this.drawText(ctx, 'GAME OVER', W/2, py + 46, {
            size: 26, weight: 'bold', color: '#FF006E',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FF006E', glowBlur: 14
        });

        this.drawText(ctx, `Level ${this.level}  ${this.levelCfg?.name || ''}`, W/2, py + 68, {
            size: 12, color: '#555577', align: 'center', family: this.FONT_MONO
        });

        // Divider
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        this.fillRect(ctx, px + 16, py + 78, pw - 32, 1);

        const rows = [
            ['SCORE',      String(this.score),                       '#ffffff'],
            ['BEST',       String(this.playerData.bestScore),        this.score >= this.playerData.bestScore ? '#FFD700' : '#ffffff'],
            ['KNIVES',     String(this.knivesThrown),                '#ffffff'],
            ['APPLES HIT', String(this.playerData.totalApplesHit),   '#ffffff'],
            ['BEST COMBO', `x${this.maxCombo}`,                      '#FFD700']
        ];

        rows.forEach((row, i) => {
            const ry = py + 102 + i * 26;
            this.drawText(ctx, row[0], px + 20, ry, {
                size: 10, weight: 'bold', color: '#445566',
                family: this.FONT_TITLE
            });
            this.drawText(ctx, row[1], px + pw - 20, ry, {
                size: 12, weight: 'bold', color: row[2],
                align: 'right', family: this.FONT_TITLE
            });
        });

        // Divider
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        this.fillRect(ctx, px + 16, py + ph - 74, pw - 32, 1);

        this.drawText(ctx, `+${this.sessionCoins} Coins`, W/2 - 42, py + ph - 48, {
            size: 13, weight: 'bold', color: '#FFD700',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FFD700', glowBlur: 4
        });
        this.drawText(ctx, `+${this.sessionDias} Dia`, W/2 + 48, py + ph - 48, {
            size: 13, weight: 'bold', color: '#00D4FF',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#00D4FF', glowBlur: 4
        });

        const blink = 0.4 + Math.sin(this.time/400) * 0.45;
        this.drawText(ctx, 'Tap restart to play again', W/2, py + ph - 14, {
            size: 11, color: '#8888aa',
            align: 'center', opacity: blink, family: this.FONT_MONO
        });
    }

    // ============================================================
    // UI HELPERS
    // ============================================================
    drawCardBG(ctx, x, y, w, h, borderColor) {
        ctx.fillStyle = 'rgba(6,3,16,0.97)';
        this.drawRoundRect(ctx, x, y, w, h, 14);
        ctx.fill();

        ctx.strokeStyle = borderColor + '48';
        ctx.lineWidth   = this.dS(1.5);
        this.drawRoundRect(ctx, x, y, w, h, 14);
        ctx.stroke();

        // Top accent
        const tg = ctx.createLinearGradient(this.dX(x + 20), 0, this.dX(x + w - 20), 0);
        tg.addColorStop(0,   'rgba(0,0,0,0)');
        tg.addColorStop(0.5, borderColor + '35');
        tg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = tg;
        ctx.fillRect(this.dX(x + 20), this.dY(y + 1), this.dSr(w - 40), this.dSr(2));
    }

    drawBtn(ctx, cx, cy, w, h, text, c1, c2) {
        const bx = cx - w/2, by = cy - h/2;
        const grd = ctx.createLinearGradient(this.dX(bx), 0, this.dX(bx + w), 0);
        grd.addColorStop(0, c1);
        grd.addColorStop(1, c2);
        ctx.fillStyle = grd;
        this.drawRoundRect(ctx, bx, by, w, h, h/2);
        ctx.fill();

        // Shimmer
        const sg = ctx.createLinearGradient(this.dX(bx), 0, this.dX(bx + w), 0);
        sg.addColorStop(0,    'rgba(255,255,255,0)');
        sg.addColorStop(0.48, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5,  'rgba(255,255,255,0.1)');
        sg.addColorStop(0.52, 'rgba(255,255,255,0)');
        sg.addColorStop(1,    'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        this.drawRoundRect(ctx, bx, by, w, h, h/2);
        ctx.fill();

        this.drawText(ctx, text, cx, cy + 1, {
            size: 13, weight: 'bold', color: '#ffffff',
            align: 'center', baseline: 'middle',
            family: this.FONT_TITLE
        });
    }

    // ============================================================
    // UTILS
    // ============================================================
    hexToRgba(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return hex;
        return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${Math.max(0,Math.min(1,alpha))})`;
    }

    hexToRgbParts(hex) {
        if (!hex || !hex.startsWith('#')) return '255,255,255';
        return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
    }

    darkenHex(hex, amt) {
        if (!hex || !hex.startsWith('#')) return hex;
        return `rgb(${Math.max(0,parseInt(hex.slice(1,3),16)-amt)},${Math.max(0,parseInt(hex.slice(3,5),16)-amt)},${Math.max(0,parseInt(hex.slice(5,7),16)-amt)})`;
    }

    // ============================================================
    // GAME LOOP
    // ============================================================
    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;
        if (!this.paused) this.update(dt);
        this.draw();
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused   = !this.paused;
        this.isPaused = this.paused;
        return this.paused;
    }

    resize() {
        this.setupHDCanvas();
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile      = this.W < 768 || ('ontouchstart' in window);
        this.isSmallScreen = this.W < 380;
        this.target.x      = this.W / 2;
        this.target.y      = this.H / 2 - 60;
        this.target.radius = Math.min(this.W, this.H) * 0.155;
        if (this.idleKnife) {
            this.idleKnife.x = this.W / 2;
            this.idleKnife.y = this.H - (this.isMobile ? 75 : 90);
        }
        this.stars = this.makeStars(this.isMobile ? 40 : 70);
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click',      this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
        document.removeEventListener('keydown',       this.boundKey);
        this.savePlayerData();
    }
}