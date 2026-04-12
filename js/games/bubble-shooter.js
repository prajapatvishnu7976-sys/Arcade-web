'use strict';

class BubbleShooter {
    constructor(canvas, onScore, options = {}) {
        this.canvas = canvas;
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;
        this.gameOver = false;

        this.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ('ontouchstart' in window)
            || (window.innerWidth < 768);

        // Clean DPR - no over-scaling
        this.dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 2 : 2);

        this.setupCanvas();

        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });

        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isSmallScreen = this.W < 380;

        // Clean system fonts
        this.FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.FONT_MONO = 'SFMono-Regular, Consolas, "Segoe UI", monospace';

        this.cache = { bubbles: new Map(), glows: new Map() };

        this.saveKey = 'neonarcade_bubbleshooter_v9';
        this.playerData = this.loadPlayerData();

        this.COLS = this.isSmallScreen ? 8 : 10;
        this.ROWS = 14;

        // Screen zones
        this.HUD_HEIGHT = this.isMobile ? 44 : 48;
        this.BOTTOM_ZONE = this.isMobile ? 100 : 110;
        this.GRID_TOP = this.HUD_HEIGHT + 8;

        this.BUBBLE_R = this.calcRadius();

        this.COLORS = [
            { hex: '#FF1A6D', light: '#FF6699', dark: '#CC1557', glow: 'rgba(255,26,109,' },
            { hex: '#00D4FF', light: '#66E8FF', dark: '#00A8CC', glow: 'rgba(0,212,255,' },
            { hex: '#00FF88', light: '#66FFB3', dark: '#00CC6D', glow: 'rgba(0,255,136,' },
            { hex: '#FFD700', light: '#FFE566', dark: '#CCAC00', glow: 'rgba(255,215,0,' },
            { hex: '#B94FE3', light: '#D088EE', dark: '#9440B6', glow: 'rgba(185,79,227,' },
            { hex: '#FF8811', light: '#FFB266', dark: '#CC6D0E', glow: 'rgba(255,136,17,' },
            { hex: '#FF3864', light: '#FF7799', dark: '#CC2D50', glow: 'rgba(255,56,100,' },
            { hex: '#18FFAB', light: '#66FFCC', dark: '#14CC89', glow: 'rgba(24,255,171,' }
        ];
        this.colorsInPlay = [];

        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * 1.732;
        this.offsetX = 0;
        this.offsetY = this.GRID_TOP;
        this.recalcGrid();

        this.shooterX = this.W / 2;
        this.shooterY = this.H - this.BOTTOM_ZONE / 2;
        this.angle = -Math.PI / 2;
        this.targetAngle = -Math.PI / 2;
        this.currentBubble = null;
        this.nextBubble = null;
        this.projectile = null;
        this.projectileSpeed = this.isMobile ? 12 : 14;
        this.canShoot = true;
        this.shootCooldown = 0;

        this.swapAnim = 0;
        this.swapColorIdx = 0;
        this.isFullscreen = false;

        this.particles = [];
        this.fallingBubbles = [];
        this.aimDots = [];
        this.popRings = [];
        this.textPopups = [];
        this.floatingTexts = [];

        this.MAX_PARTICLES = this.isMobile ? 30 : 80;
        this.MAX_FALLING = this.isMobile ? 8 : 16;
        this.MAX_POP_RINGS = this.isMobile ? 6 : 12;
        this.MAX_POPUPS = this.isMobile ? 5 : 10;

        this.shakeX = 0; this.shakeY = 0;
        this.shakeTimer = 0; this.shakeForce = 0;

        this.time = 0;
        this.frame = 0;
        this.fpsHistory = [];
        this.adaptiveMode = false;

        this.grid = [];
        this.score = 0;
        this.level = this.playerData.currentLevel || 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.bubblesPopped = 0;
        this.totalBubbles = 0;
        this.shotsUsed = 0;
        this.levelCoins = 0;
        this.levelDiamonds = 0;

        this.levelConfig = null;
        this.levelGoal = 0;
        this.levelProgress = 0;
        this.levelComplete = false;
        this.levelTransition = false;
        this.levelTransitionTimer = 0;
        this.starRating = 0;
        this.showLevelComplete = false;
        this.levelCompleteTimer = 0;

        this.dropTimer = 0;
        this.dropInterval = 30000;
        this.dropWarning = false;

        this.gridBounce = {};
        this.shootRecoil = 0;
        this.shootGlow = 0;

        this.powerUps = {
            bomb: { count: this.playerData.powerUps?.bomb || 1, icon: 'B', name: 'Bomb', color: '#FF8811' },
            precision: { count: this.playerData.powerUps?.precision || 2, icon: 'A', name: 'Aim+', color: '#00FF88' }
        };
        this.activePowerUp = null;
        this.hudFlash = {};

        this.showDailyReward = false;
        this.dailyRewardClaimed = false;
        this.dailyRewardAnim = 0;
        this.checkDailyReward();

        this.stars = this.makeStars(this.isMobile ? 25 : 55);

        this.initLevel(this.level);
        this.generateShooter();
        this.preRenderBubbles();

        this.pointerDown = false;
        this.lastPointerX = this.W / 2;
        this.lastPointerY = this.H / 2;
        this.bindEvents();

        this.boundFSChange = this.onFullscreenChange.bind(this);
        document.addEventListener('fullscreenchange', this.boundFSChange);
        document.addEventListener('webkitfullscreenchange', this.boundFSChange);

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ============================================================
    // CANVAS SETUP - Screen fit
    // ============================================================
    setupCanvas() {
        const parent = this.canvas.parentElement;
        let w, h;

        if (parent) {
            w = parent.clientWidth;
            h = parent.clientHeight;
        } else {
            w = window.innerWidth;
            h = window.innerHeight;
        }

        // Cap to reasonable size
        w = Math.min(w, 500);
        h = Math.min(h, window.innerHeight);

        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
    }

    // ============================================================
    // CLEAN TEXT - No blur, no glow, just sharp HD text
    // ============================================================
    text(ctx, str, x, y, size, color, opts = {}) {
        const {
            align = 'left',
            baseline = 'top',
            weight = '600',
            font = this.FONT,
            alpha = 1,
            outline = false,
            outlineColor = '#000',
            outlineWidth = 3
        } = opts;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Pixel perfect positioning
        const px = Math.round(x * this.dpr);
        const py = Math.round(y * this.dpr);
        const fs = Math.round(size * this.dpr);

        ctx.font = `${weight} ${fs}px ${font}`;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;

        // NO shadow, NO glow - clean text
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        if (outline) {
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = outlineWidth * this.dpr;
            ctx.lineJoin = 'round';
            ctx.strokeText(str, px, py);
        }

        ctx.fillStyle = color;
        ctx.fillText(str, px, py);
        ctx.restore();
    }

    // ============================================================
    // SHAPES
    // ============================================================
    circle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(Math.round(x * this.dpr), Math.round(y * this.dpr), r * this.dpr, 0, 6.2832);
    }

    roundRect(ctx, x, y, w, h, rad) {
        const dx = Math.round(x * this.dpr);
        const dy = Math.round(y * this.dpr);
        const dw = w * this.dpr;
        const dh = h * this.dpr;
        const dr = Math.min(rad * this.dpr, dw / 2, dh / 2);
        ctx.beginPath();
        ctx.moveTo(dx + dr, dy);
        ctx.arcTo(dx + dw, dy, dx + dw, dy + dh, dr);
        ctx.arcTo(dx + dw, dy + dh, dx, dy + dh, dr);
        ctx.arcTo(dx, dy + dh, dx, dy, dr);
        ctx.arcTo(dx, dy, dx + dw, dy, dr);
        ctx.closePath();
    }

    dX(x) { return Math.round(x * this.dpr); }
    dY(y) { return Math.round(y * this.dpr); }
    dS(s) { return s * this.dpr; }

    // ============================================================
    // PRE-RENDER BUBBLES
    // ============================================================
    preRenderBubbles() {
        this.cache.bubbles.clear();
        this.cache.glows.clear();
        const r = this.BUBBLE_R;

        this.COLORS.forEach((col, idx) => {
            const size = Math.ceil((r + 3) * 2 * this.dpr);
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const cx = c.getContext('2d');
            this.drawBubbleOffscreen(cx, size / 2, size / 2, r * this.dpr, col);
            this.cache.bubbles.set(idx, c);

            // Glow
            if (!this.isMobile) {
                const gs = Math.ceil((r + 12) * 2 * this.dpr);
                const gc = document.createElement('canvas');
                gc.width = gc.height = gs;
                const gx = gc.getContext('2d');
                const gg = gx.createRadialGradient(gs / 2, gs / 2, r * this.dpr * 0.2, gs / 2, gs / 2, (r + 10) * this.dpr);
                gg.addColorStop(0, col.glow + '0.18)');
                gg.addColorStop(1, 'rgba(0,0,0,0)');
                gx.fillStyle = gg;
                gx.beginPath();
                gx.arc(gs / 2, gs / 2, (r + 10) * this.dpr, 0, 6.2832);
                gx.fill();
                this.cache.glows.set(idx, gc);
            }
        });
    }

    drawBubbleOffscreen(ctx, cx, cy, r, col) {
        // Base sphere
        const g1 = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r);
        g1.addColorStop(0, col.light);
        g1.addColorStop(0.4, col.hex);
        g1.addColorStop(1, col.dark);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fillStyle = g1;
        ctx.fill();

        // Rim
        const g2 = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
        g2.addColorStop(0, 'rgba(0,0,0,0)');
        g2.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fill();

        // Highlight
        const g3 = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx - r * 0.15, cy - r * 0.15, r * 0.55);
        g3.addColorStop(0, 'rgba(255,255,255,0.65)');
        g3.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fill();

        // Small specular
        const g4 = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.18);
        g4.addColorStop(0, 'rgba(255,255,255,0.8)');
        g4.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fill();
    }

    // ============================================================
    // RADIUS CALC - Fits screen
    // ============================================================
    calcRadius() {
        const availW = this.W - 8;
        const maxByW = Math.floor(availW / (this.COLS * 2 + 0.5));
        const gridH = this.H - this.HUD_HEIGHT - 8 - this.BOTTOM_ZONE;
        const maxByH = Math.floor(gridH / (this.ROWS * 1.732));
        return Math.min(maxByW, maxByH, this.isMobile ? 17 : 20);
    }

    recalcGrid() {
        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * 1.732;
        const totalW = this.COLS * this.cellW;
        this.offsetX = (this.W - totalW) / 2 + this.BUBBLE_R;
        this.offsetY = this.GRID_TOP;
        this.shooterX = this.W / 2;
        this.shooterY = this.H - this.BOTTOM_ZONE / 2;
    }

    // ============================================================
    // SAVE / LOAD
    // ============================================================
    loadPlayerData() {
        const def = {
            coins: 0, diamonds: 0, currentLevel: 1, highestLevel: 1,
            totalScore: 0, totalPopped: 0, totalCoinsEarned: 0, totalDiamondsEarned: 0,
            dailyStreak: 0, lastDailyReward: null, levelStars: {},
            powerUps: { bomb: 1, precision: 2 }, gamesPlayed: 0
        };
        try {
            const s = JSON.parse(localStorage.getItem(this.saveKey));
            if (s) return { ...def, ...s };
        } catch (e) { }
        return def;
    }

    savePlayerData() {
        this.playerData.powerUps = {};
        for (const k in this.powerUps) this.playerData.powerUps[k] = this.powerUps[k].count;
        try { localStorage.setItem(this.saveKey, JSON.stringify(this.playerData)); } catch (e) { }
    }

    // ============================================================
    // DAILY REWARD
    // ============================================================
    checkDailyReward() {
        const today = new Date().toDateString();
        if (this.playerData.lastDailyReward !== today) {
            if (this.playerData.lastDailyReward) {
                const diff = Math.floor((new Date() - new Date(this.playerData.lastDailyReward)) / 86400000);
                this.playerData.dailyStreak = diff === 1 ? this.playerData.dailyStreak + 1 : 0;
            }
            this.showDailyReward = true;
            this.dailyRewardClaimed = false;
            this.dailyRewardAnim = 0;
        }
    }

    claimDailyReward() {
        if (this.dailyRewardClaimed) return;
        const streak = this.playerData.dailyStreak;
        const coins = Math.floor(50 * Math.min(1 + streak * 0.25, 3));
        const diamonds = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));
        this.playerData.coins += coins;
        this.playerData.diamonds += diamonds;
        this.playerData.totalCoinsEarned += coins;
        this.playerData.totalDiamondsEarned += diamonds;
        this.playerData.lastDailyReward = new Date().toDateString();
        this.playerData.dailyStreak++;
        this.dailyRewardClaimed = true;
        this.showDailyReward = false;
        this.addFloatingText(this.W / 2, this.H / 2 - 30, `+${coins} Coins`, '#FFD700', 22);
        this.addFloatingText(this.W / 2, this.H / 2 + 10, `+${diamonds} Gems`, '#00D4FF', 20);
        this.savePlayerData();
    }

    // ============================================================
    // LEVEL SYSTEM
    // ============================================================
    getLevelConfig(lvl) {
        const configs = {
            1: { rows: 4, colors: 3, goal: 25, drop: 45000, name: 'Warm Up', layout: 'std' },
            2: { rows: 4, colors: 3, goal: 30, drop: 42000, name: 'Getting Started', layout: 'std' },
            3: { rows: 5, colors: 4, goal: 40, drop: 40000, name: 'Color Mix', layout: 'std' },
            4: { rows: 5, colors: 4, goal: 45, drop: 38000, name: 'Rising Tide', layout: 'std' },
            5: { rows: 6, colors: 4, goal: 55, drop: 35000, name: 'The Wall', layout: 'boss_wall' },
            6: { rows: 5, colors: 5, goal: 50, drop: 35000, name: 'Rainbow Rush', layout: 'std' },
            7: { rows: 5, colors: 5, goal: 55, drop: 33000, name: 'Quick Fire', layout: 'zigzag' },
            8: { rows: 6, colors: 5, goal: 60, drop: 32000, name: 'Deep Colors', layout: 'std' },
            9: { rows: 6, colors: 5, goal: 65, drop: 30000, name: 'Speed Run', layout: 'diamond' },
            10: { rows: 7, colors: 5, goal: 75, drop: 28000, name: 'Pyramid', layout: 'boss_pyr' },
            11: { rows: 6, colors: 6, goal: 70, drop: 28000, name: 'Hex Mix', layout: 'std' },
            12: { rows: 6, colors: 6, goal: 75, drop: 26000, name: 'Cascade', layout: 'checker' },
            13: { rows: 7, colors: 6, goal: 80, drop: 25000, name: 'Tight Squeeze', layout: 'std' },
            14: { rows: 7, colors: 6, goal: 85, drop: 24000, name: 'Storm', layout: 'zigzag' },
            15: { rows: 7, colors: 6, goal: 90, drop: 22000, name: 'The Cross', layout: 'boss_cross' },
            16: { rows: 7, colors: 7, goal: 85, drop: 22000, name: 'Spectrum', layout: 'std' },
            17: { rows: 7, colors: 7, goal: 90, drop: 20000, name: 'Maze Runner', layout: 'maze' },
            18: { rows: 8, colors: 7, goal: 95, drop: 20000, name: 'Dense Pack', layout: 'std' },
            19: { rows: 8, colors: 7, goal: 100, drop: 18000, name: 'Pressure', layout: 'diamond' },
            20: { rows: 8, colors: 7, goal: 110, drop: 16000, name: 'Spiral', layout: 'boss_spiral' },
            21: { rows: 8, colors: 8, goal: 100, drop: 16000, name: 'Octachrome', layout: 'std' },
            22: { rows: 8, colors: 8, goal: 110, drop: 15000, name: 'Blitz', layout: 'checker' },
            23: { rows: 9, colors: 8, goal: 120, drop: 14000, name: 'Endurance', layout: 'zigzag' },
            24: { rows: 9, colors: 8, goal: 130, drop: 12000, name: 'Nightmare', layout: 'maze' },
            25: { rows: 10, colors: 8, goal: 150, drop: 10000, name: 'FINAL BOSS', layout: 'boss_final' }
        };
        if (configs[lvl]) return configs[lvl];
        return {
            rows: Math.min(10, 6 + Math.floor(lvl / 5)),
            colors: Math.min(8, 3 + Math.floor(lvl / 3)),
            goal: 50 + lvl * 10,
            drop: Math.max(8000, 30000 - lvl * 800),
            name: `Endless ${lvl}`,
            layout: ['std', 'zigzag', 'diamond', 'checker', 'maze'][lvl % 5]
        };
    }

    initLevel(level) {
        this.levelConfig = this.getLevelConfig(level);
        this.ROWS = Math.max(12, this.levelConfig.rows + 5);
        this.dropInterval = this.levelConfig.drop;
        this.dropTimer = 0;
        this.bubblesPopped = 0;
        this.shotsUsed = 0;
        this.levelCoins = 0;
        this.levelDiamonds = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.levelComplete = false;
        this.showLevelComplete = false;
        this.levelGoal = this.levelConfig.goal;
        this.levelProgress = 0;
        this.activePowerUp = null;
        this.totalBubbles = 0;
        this.gridBounce = {};

        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) this.grid[r] = new Array(this.COLS).fill(null);
        this.buildLayout(this.levelConfig);
        this.updateColorsInPlay();

        this.particles = [];
        this.fallingBubbles = [];
        this.popRings = [];

        this.addFloatingText(this.W / 2, this.H / 2 - 30, `Level ${level}`, '#B94FE3', 24);
        this.addFloatingText(this.W / 2, this.H / 2 + 5, this.levelConfig.name, '#00D4FF', 13);
    }

    buildLayout(cfg) {
        const n = cfg.colors, rows = cfg.rows;
        switch (cfg.layout) {
            case 'zigzag':
                for (let r = 0; r < rows; r++) for (let c = 0; c < this.COLS; c++)
                    if ((r + c) % 2 === 0) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                break;
            case 'diamond': {
                const mid = Math.floor(this.COLS / 2);
                for (let r = 0; r < rows; r++) {
                    const half = Math.min(r, rows - 1 - r);
                    for (let c = mid - half; c <= mid + half; c++)
                        if (c >= 0 && c < this.COLS) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                }
                break;
            }
            case 'checker':
                for (let r = 0; r < rows; r++) for (let c = 0; c < this.COLS; c++)
                    this.grid[r][c] = this.makeBubble((r + c) % n);
                break;
            case 'maze':
                for (let r = 0; r < rows; r++) for (let c = 0; c < this.COLS; c++)
                    if (r % 2 === 0 || c % 3 === 0) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                break;
            case 'boss_wall':
                for (let r = 0; r < 6; r++) for (let c = 0; c < this.COLS; c++)
                    this.grid[r][c] = this.makeBubble(r % n);
                break;
            case 'boss_pyr':
                for (let r = 0; r < 7; r++) {
                    const s = Math.max(0, Math.floor(r / 2)), e = Math.min(this.COLS, this.COLS - Math.floor(r / 2));
                    for (let c = s; c < e; c++) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                }
                break;
            case 'boss_cross': {
                const m = Math.floor(this.COLS / 2);
                for (let r = 0; r < 7; r++) {
                    if (r === 3) for (let c = 0; c < this.COLS; c++) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                    for (let c = m - 1; c <= m + 1; c++) if (c >= 0 && c < this.COLS) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                }
                break;
            }
            case 'boss_spiral': {
                const cx = Math.floor(this.COLS / 2);
                for (let r = 0; r < 8; r++) for (let c = 0; c < this.COLS; c++) {
                    const dx = c - cx, d = Math.sqrt(dx * dx + r * r);
                    if (d < 6 && (Math.floor(Math.atan2(r, dx) * 3 + d) % 2 === 0))
                        this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                }
                break;
            }
            case 'boss_final':
                for (let r = 0; r < 8; r++) for (let c = 0; c < this.COLS; c++)
                    this.grid[r][c] = this.makeBubble(r < 3 ? (r % n) : Math.floor(Math.random() * n));
                break;
            default:
                for (let r = 0; r < rows; r++) for (let c = 0; c < this.COLS; c++)
                    this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
        }
    }

    makeBubble(ci) {
        this.totalBubbles++;
        return { ci, scale: 1, flash: 0, breathe: Math.random() * 6.28, isNew: false };
    }

    // ============================================================
    // ECONOMY
    // ============================================================
    earnCoins(amt, x, y) {
        this.playerData.coins += amt;
        this.playerData.totalCoinsEarned += amt;
        this.levelCoins += amt;
        this.addTextPopup(x, y, `+${amt}`, '#FFD700');
        this.hudFlash.coins = 12;
    }

    earnDiamonds(amt, x, y) {
        this.playerData.diamonds += amt;
        this.playerData.totalDiamondsEarned += amt;
        this.levelDiamonds += amt;
        this.addTextPopup(x, y - 15, `+${amt}`, '#00D4FF');
        this.hudFlash.diamonds = 12;
    }

    // ============================================================
    // POWER-UPS
    // ============================================================
    activatePowerUp(type) {
        if (!this.powerUps[type] || this.powerUps[type].count <= 0) return;
        if (this.activePowerUp === type) { this.activePowerUp = null; return; }
        this.activePowerUp = null;
        this.powerUps[type].count--;
        this.activePowerUp = type;
        this.addFloatingText(this.W / 2, this.H / 2, `${this.powerUps[type].name}!`, this.powerUps[type].color, 18);
        this.savePlayerData();
    }

    // ============================================================
    // INPUT
    // ============================================================
    bindEvents() {
        this.canvas.style.touchAction = 'none';
        this.canvas.style.userSelect = 'none';
        this.canvas.style.webkitUserSelect = 'none';

        if (window.PointerEvent) {
            this.canvas.addEventListener('pointermove', e => { e.preventDefault(); this.onPointerMove(e); }, { passive: false });
            this.canvas.addEventListener('pointerup', e => { e.preventDefault(); this.onPointerUp(e); }, { passive: false });
            this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.pointerDown = true; }, { passive: false });
        } else {
            this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
            this.canvas.addEventListener('click', e => this.onClick(e));
            this.canvas.addEventListener('touchmove', e => { e.preventDefault(); this.onTouchMove(e); }, { passive: false });
            this.canvas.addEventListener('touchend', e => { e.preventDefault(); this.onTouchEnd(e); }, { passive: false });
            this.canvas.addEventListener('touchstart', e => { e.preventDefault(); }, { passive: false });
        }
        document.addEventListener('keydown', e => this.onKey(e));
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.W / rect.width;
        const sy = this.H / rect.height;
        let cx, cy;
        if (e.touches) {
            const t = e.touches[0] || e.changedTouches[0];
            cx = t.clientX; cy = t.clientY;
        } else { cx = e.clientX; cy = e.clientY; }
        return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
    }

    onPointerMove(e) { if (this.paused || this.gameOver) return; const p = this.getPos(e); this.aimAt(p.x, p.y); }
    onPointerUp(e) { const p = this.getPos(e); if (this.onUIClick(p.x, p.y)) return; this.aimAt(p.x, p.y); this.tryShoot(); }
    onMouseMove(e) { if (this.paused || this.gameOver) return; const p = this.getPos(e); this.aimAt(p.x, p.y); }
    onClick(e) { const p = this.getPos(e); if (this.onUIClick(p.x, p.y)) return; this.aimAt(p.x, p.y); this.tryShoot(); }
    onTouchMove(e) { if (this.paused || this.gameOver) return; const p = this.getPos(e); this.aimAt(p.x, p.y); }
    onTouchEnd(e) { const p = this.getPos(e); if (this.onUIClick(p.x, p.y)) return; this.aimAt(p.x, p.y); this.tryShoot(); }

    onKey(e) {
        if (this.destroyed) return;
        if (e.key === '1') this.activatePowerUp('bomb');
        if (e.key === '2') this.activatePowerUp('precision');
        if (e.key === ' ') { e.preventDefault(); this.tryShoot(); }
        if (e.key === 'c' || e.key === 'C') this.swapBubble();
        if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
    }

    // ============================================================
    // UI CLICK
    // ============================================================
    onUIClick(x, y) {
        if (this.showDailyReward && !this.dailyRewardClaimed) { this.claimDailyReward(); return true; }
        if (this.showLevelComplete) { this.goNextLevel(); return true; }

        const fs = this.getFSRect();
        if (x >= fs.x && x <= fs.x + fs.w && y >= fs.y && y <= fs.y + fs.h) { this.toggleFullscreen(); return true; }

        // Tap current bubble = swap
        const dx = x - this.shooterX, dy = y - this.shooterY;
        if (dx * dx + dy * dy < (this.BUBBLE_R + 14) ** 2) { this.swapBubble(); return true; }

        // Power-up buttons
        const btns = this.getPUBtns();
        for (let i = 0; i < btns.length; i++) {
            const b = btns[i];
            if (x >= b.x && x <= b.x + b.s && y >= b.y && y <= b.y + b.s) {
                this.activatePowerUp(b.key);
                return true;
            }
        }
        return false;
    }

    getPUBtns() {
        const s = this.isMobile ? 42 : 36;
        const gap = 8;
        const keys = Object.keys(this.powerUps);
        const total = keys.length * s + (keys.length - 1) * gap;
        const startX = (this.W - total) / 2;
        const by = this.H - s - 6;
        return keys.map((key, i) => ({ x: startX + i * (s + gap), y: by, s, key }));
    }

    getFSRect() {
        const s = this.isMobile ? 34 : 30;
        return { x: this.W - s - 8, y: 7, w: s, h: s };
    }

    // ============================================================
    // SWAP
    // ============================================================
    swapBubble() {
        if (!this.canShoot || this.projectile) return;
        const pool = this.colorsInPlay.length ? this.colorsInPlay : [0, 1, 2];
        const cur = pool.indexOf(this.currentBubble.ci);
        const next = pool[(cur + 1) % pool.length];
        this.swapAnim = 1;
        this.swapColorIdx = next;
        this.currentBubble = { ci: next, color: this.COLORS[next].hex };
        this.calcAimLine();
    }

    // ============================================================
    // FULLSCREEN
    // ============================================================
    toggleFullscreen() {
        const el = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el).catch(() => { });
        } else {
            (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        }
    }

    onFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        setTimeout(() => this.resize(), 250);
    }

    // ============================================================
    // AIM
    // ============================================================
    aimAt(mx, my) {
        let a = Math.atan2(my - this.shooterY, mx - this.shooterX);
        a = Math.max(-Math.PI + 0.1, Math.min(-0.1, a));
        this.targetAngle = a;
        this.calcAimLine();
    }

    tryShoot() {
        if (this.showDailyReward || this.showLevelComplete) return;
        if (this.paused || this.gameOver || !this.canShoot || this.projectile) return;
        if (this.levelComplete || this.levelTransition || this.shootCooldown > 0) return;
        this.shoot();
    }

    calcAimLine() {
        this.aimDots = [];
        let x = this.shooterX, y = this.shooterY;
        let vx = Math.cos(this.targetAngle), vy = Math.sin(this.targetAngle);
        let bounces = 0;
        const maxB = this.activePowerUp === 'precision' ? 4 : 2;
        const step = this.isMobile ? 13 : 10;
        const maxSteps = this.isMobile ? 20 : 30;

        for (let i = 0; i < maxSteps; i++) {
            x += vx * step; y += vy * step;
            if (x <= this.BUBBLE_R) { x = this.BUBBLE_R; vx = -vx; bounces++; }
            if (x >= this.W - this.BUBBLE_R) { x = this.W - this.BUBBLE_R; vx = -vx; bounces++; }
            if (y <= this.offsetY || y > this.shooterY + 10) break;
            if (bounces >= maxB) break;

            let hit = false;
            const r2 = (this.BUBBLE_R * 1.8) ** 2;
            for (let r = 0; r < this.ROWS && !hit; r++)
                for (let c = 0; c < this.COLS && !hit; c++) {
                    if (!this.grid[r]?.[c]) continue;
                    const pos = this.bubblePos(r, c);
                    if ((x - pos.x) ** 2 + (y - pos.y) ** 2 < r2) hit = true;
                }
            this.aimDots.push({ x, y, t: i / maxSteps });
            if (hit) break;
        }
    }

    // ============================================================
    // SHOOT
    // ============================================================
    shoot() {
        this.canShoot = false;
        this.shotsUsed++;
        this.shootCooldown = 5;
        this.shootRecoil = 5;
        this.shootGlow = 1;

        const isBomb = this.activePowerUp === 'bomb';
        this.projectile = {
            x: this.shooterX, y: this.shooterY,
            vx: Math.cos(this.angle) * this.projectileSpeed,
            vy: Math.sin(this.angle) * this.projectileSpeed,
            ci: this.currentBubble.ci,
            color: this.COLORS[this.currentBubble.ci].hex,
            trail: [], isBomb, age: 0
        };

        this.activePowerUp = null;
        this.generateShooter();
    }

    // ============================================================
    // UPDATE
    // ============================================================
    update(dt) {
        if (this.paused || this.gameOver) return;
        this.time += dt;
        this.frame++;
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (this.swapAnim > 0) this.swapAnim = Math.max(0, this.swapAnim - 0.07);

        if (this.showDailyReward) this.dailyRewardAnim = Math.min(1, this.dailyRewardAnim + 0.06);
        if (this.showLevelComplete) { this.levelCompleteTimer++; this.updateFX(); return; }
        if (this.levelTransition) {
            this.levelTransitionTimer--;
            if (this.levelTransitionTimer <= 0) { this.levelTransition = false; this.initLevel(this.level); this.generateShooter(); }
            return;
        }

        this.angle += (this.targetAngle - this.angle) * 0.35;
        if (this.shootRecoil > 0) this.shootRecoil *= 0.8;
        if (this.shootGlow > 0) this.shootGlow *= 0.88;

        if (this.shakeTimer > 0) {
            const f = this.shakeForce * (this.shakeTimer / 10) * (this.isMobile ? 0.5 : 1);
            this.shakeX = (Math.random() - 0.5) * f;
            this.shakeY = (Math.random() - 0.5) * f * 0.3;
            this.shakeTimer--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        for (const k in this.hudFlash) if (this.hudFlash[k] > 0) this.hudFlash[k]--;
        if (!this.isMobile || this.frame % 2 === 0) this.stars.forEach(s => s.phase += s.speed);

        if (this.projectile) this.updateProjectile();

        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            const b = this.grid[r]?.[c];
            if (!b) continue;
            if (b.isNew) { b.scale += (1 - b.scale) * 0.2; if (b.scale > 0.97) { b.scale = 1; b.isNew = false; } }
            if (b.flash > 0) b.flash -= 0.8;
            if (!this.isMobile) b.breathe += 0.015;
            const bk = `${r},${c}`;
            if (this.gridBounce[bk]) { this.gridBounce[bk] *= 0.82; if (Math.abs(this.gridBounce[bk]) < 0.2) delete this.gridBounce[bk]; }
        }

        this.dropTimer += dt;
        if (this.dropTimer >= this.dropInterval) { this.dropTimer = 0; this.dropRow(); }
        this.dropWarning = (this.dropInterval - this.dropTimer) < 5000;

        this.levelProgress = Math.min(1, this.bubblesPopped / this.levelGoal);
        if (this.bubblesPopped >= this.levelGoal && !this.levelComplete) this.completeLevel();

        if (this.grid.flat().filter(Boolean).length === 0 && !this.levelComplete && this.totalBubbles > 0) {
            this.earnCoins(100, this.W / 2, this.H / 2);
            this.completeLevel();
        }

        this.checkGameOver();
        this.updateFX();
    }

    updateFX() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; p.vx *= 0.97;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
            const b = this.fallingBubbles[i];
            b.vy += 0.5; b.y += b.vy; b.x += b.vx; b.life--;
            if (b.life <= 0 || b.y > this.H + 40) this.fallingBubbles.splice(i, 1);
        }
        for (let i = this.popRings.length - 1; i >= 0; i--) {
            const r = this.popRings[i];
            r.radius += 3; r.opacity -= 0.05;
            if (r.opacity <= 0) this.popRings.splice(i, 1);
        }
        for (let i = this.textPopups.length - 1; i >= 0; i--) {
            const t = this.textPopups[i];
            t.y -= 1; t.life--; t.opacity = Math.min(1, t.life / 20);
            if (t.life <= 0) this.textPopups.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 0.5; t.life--; t.opacity = Math.min(1, t.life / 25);
            t.scale += (1 - t.scale) * 0.15;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    updateProjectile() {
        const p = this.projectile;
        p.age++;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > (this.isMobile ? 5 : 8)) p.trail.shift();
        p.x += p.vx; p.y += p.vy;

        if (p.x <= this.BUBBLE_R) { p.x = this.BUBBLE_R; p.vx = -p.vx; }
        if (p.x >= this.W - this.BUBBLE_R) { p.x = this.W - this.BUBBLE_R; p.vx = -p.vx; }
        if (p.y <= this.BUBBLE_R + this.offsetY) { this.snapBubble(); return; }
        if (p.y > this.H + 20) { this.projectile = null; this.canShoot = true; return; }

        const r2 = (this.BUBBLE_R * 1.85) ** 2;
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            if (!this.grid[r]?.[c]) continue;
            const pos = this.bubblePos(r, c);
            if ((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2 < r2) { this.snapBubble(); return; }
        }
    }

    // ============================================================
    // SNAP & MATCH
    // ============================================================
    snapBubble() {
        if (!this.projectile) return;
        const p = this.projectile;
        let bestR = -1, bestC = -1, bestD = Infinity;
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            if (this.grid[r]?.[c]) continue;
            const pos = this.bubblePos(r, c);
            const d = (p.x - pos.x) ** 2 + (p.y - pos.y) ** 2;
            if (d < bestD && d < (this.BUBBLE_R * 3.5) ** 2) { bestD = d; bestR = r; bestC = c; }
        }
        if (bestR === -1) { bestR = 0; bestC = Math.max(0, Math.min(this.COLS - 1, Math.round((p.x - this.offsetX) / this.cellW))); }

        if (bestR !== -1 && bestC !== -1) {
            if (p.isBomb) { this.explodeBomb(bestR, bestC); this.projectile = null; this.canShoot = true; return; }
            this.grid[bestR][bestC] = { ci: p.ci, scale: 0.2, flash: 5, breathe: 0, isNew: true };
            const nbs = this.getNeighbors(bestR, bestC);
            for (const [nr, nc] of nbs) if (this.grid[nr]?.[nc]) this.gridBounce[`${nr},${nc}`] = 2;
            const matches = this.findMatches(bestR, bestC);
            if (matches.length >= 3) { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.popMatches(matches, bestR, bestC); }
            else { this.combo = 0; }
            setTimeout(() => this.dropFloating(), 100);
        }
        this.projectile = null;
        this.canShoot = true;
        this.updateColorsInPlay();
    }

    explodeBomb(r, c) {
        let count = 0;
        const pos = this.bubblePos(r, c);
        for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
            if (dr * dr + dc * dc > 6.25) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= this.ROWS || nc < 0 || nc >= this.COLS || !this.grid[nr]?.[nc]) continue;
            const bp = this.bubblePos(nr, nc);
            this.spawnPop(bp.x, bp.y, this.COLORS[this.grid[nr][nc].ci].hex, this.isMobile ? 3 : 5);
            this.grid[nr][nc] = null;
            count++;
        }
        this.bubblesPopped += count;
        this.score += count * 15;
        this.onScore(this.score);
        this.earnCoins(count * 3, pos.x, pos.y);
        this.shake(8, 6);
        this.addTextPopup(pos.x, pos.y - 15, `BOMB +${count * 15}`, '#FF8811');
        setTimeout(() => this.dropFloating(), 150);
    }

    findMatches(sr, sc) {
        if (!this.grid[sr]?.[sc]) return [];
        const target = this.grid[sr][sc].ci;
        const visited = new Set(), matches = [], queue = [[sr, sc]];
        while (queue.length) {
            const [r, c] = queue.shift();
            const k = r * 100 + c;
            if (visited.has(k)) continue;
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) continue;
            if (!this.grid[r]?.[c] || this.grid[r][c].ci !== target) continue;
            visited.add(k);
            matches.push([r, c]);
            for (const n of this.getNeighbors(r, c)) queue.push(n);
        }
        return matches;
    }

    getNeighbors(r, c) {
        return r % 2 === 1
            ? [[r - 1, c], [r - 1, c + 1], [r, c - 1], [r, c + 1], [r + 1, c], [r + 1, c + 1]]
            : [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c + 1], [r + 1, c - 1], [r + 1, c]];
    }

    bubblePos(r, c) {
        const ox = r % 2 === 1 ? this.BUBBLE_R : 0;
        return { x: this.offsetX + c * this.cellW + ox, y: this.offsetY + r * this.cellH };
    }

    updateColorsInPlay() {
        const used = new Set();
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (this.grid[r]?.[c]) used.add(this.grid[r][c].ci);
        this.colorsInPlay = [...used];
        if (!this.colorsInPlay.length) this.colorsInPlay = Array.from({ length: Math.min(3, this.levelConfig?.colors || 3) }, (_, i) => i);
    }

    generateShooter() {
        this.currentBubble = this.nextBubble || this.randBubble();
        this.nextBubble = this.randBubble();
    }

    randBubble() {
        const pool = this.colorsInPlay.length ? this.colorsInPlay : [0, 1, 2];
        const ci = pool[Math.floor(Math.random() * pool.length)];
        return { ci, color: this.COLORS[ci].hex };
    }

    // ============================================================
    // POP & DROP
    // ============================================================
    popMatches(matches, oR, oC) {
        const combo = Math.min(this.combo, 10);
        const pts = matches.length * 10 * combo;
        this.score += pts;
        this.bubblesPopped += matches.length;
        const oPos = this.bubblePos(oR, oC);
        this.earnCoins(Math.floor(matches.length * (1 + combo * 0.5)), oPos.x, oPos.y);
        if (combo >= 3 || (matches.length >= 5 && Math.random() < 0.3))
            this.earnDiamonds(combo >= 5 ? 2 : 1, oPos.x, oPos.y - 20);

        matches.forEach(([r, c], i) => {
            setTimeout(() => {
                if (this.destroyed) return;
                const pos = this.bubblePos(r, c);
                const col = this.grid[r]?.[c] ? this.COLORS[this.grid[r][c].ci].hex : '#FFF';
                this.spawnPop(pos.x, pos.y, col, this.isMobile ? 3 : 6);
                if (this.grid[r]) this.grid[r][c] = null;
            }, i * (this.isMobile ? 15 : 25));
        });

        this.addTextPopup(oPos.x, oPos.y - 12, combo > 1 ? `x${combo} +${pts}` : `+${pts}`, combo > 2 ? '#FFD700' : '#00FF88');
        this.onScore(this.score);
        this.shake(combo > 2 ? 8 : 3, combo > 2 ? 5 : 2);
    }

    dropFloating() {
        const connected = new Set(), queue = [];
        for (let c = 0; c < this.COLS; c++) if (this.grid[0]?.[c]) queue.push([0, c]);
        while (queue.length) {
            const [r, c] = queue.shift();
            const k = r * 100 + c;
            if (connected.has(k)) continue;
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS || !this.grid[r]?.[c]) continue;
            connected.add(k);
            for (const n of this.getNeighbors(r, c)) queue.push(n);
        }
        let dropped = 0;
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            if (this.grid[r]?.[c] && !connected.has(r * 100 + c)) {
                const pos = this.bubblePos(r, c);
                if (this.fallingBubbles.length < this.MAX_FALLING)
                    this.fallingBubbles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 2.5, vy: -Math.random() * 2.5 - 0.5, ci: this.grid[r][c].ci, life: 60 });
                this.grid[r][c] = null;
                dropped++;
                this.bubblesPopped++;
            }
        }
        if (dropped > 0) {
            this.score += dropped * 15;
            this.earnCoins(dropped * 2, this.W / 2, this.H / 2);
            this.onScore(this.score);
            this.addTextPopup(this.W / 2, this.H / 2, `${dropped} Drop! +${dropped * 15}`, '#FF8811');
        }
    }

    dropRow() {
        for (let r = this.ROWS - 1; r > 0; r--) this.grid[r] = this.grid[r - 1] ? [...this.grid[r - 1]] : new Array(this.COLS).fill(null);
        this.grid[0] = [];
        const n = this.levelConfig?.colors || 4;
        for (let c = 0; c < this.COLS; c++) { const b = this.makeBubble(Math.floor(Math.random() * n)); b.isNew = true; b.scale = 0; this.grid[0][c] = b; }
        this.updateColorsInPlay();
        this.shake(6, 4);
    }

    completeLevel() {
        this.levelComplete = true;
        this.showLevelComplete = true;
        this.levelCompleteTimer = 0;
        const eff = this.levelGoal / Math.max(1, this.shotsUsed);
        this.starRating = eff >= 0.8 ? 3 : eff >= 0.5 ? 2 : 1;
        const lc = 50 + this.level * 10 + this.starRating * 20 + this.maxCombo * 5;
        const ld = this.starRating >= 3 ? 3 : this.starRating >= 2 ? 1 : 0;
        this.earnCoins(lc, this.W / 2, this.H / 2 - 50);
        if (ld > 0) this.earnDiamonds(ld, this.W / 2, this.H / 2 - 25);
        const prev = this.playerData.levelStars[this.level] || 0;
        if (this.starRating > prev) this.playerData.levelStars[this.level] = this.starRating;
        if (this.level >= this.playerData.highestLevel) this.playerData.highestLevel = this.level + 1;
        this.playerData.currentLevel = this.level;
        this.playerData.totalScore += this.score;
        this.playerData.totalPopped += this.bubblesPopped;
        this.playerData.gamesPlayed++;
        this.savePlayerData();
    }

    goNextLevel() {
        this.level++;
        this.score = 0;
        this.showLevelComplete = false;
        this.levelTransition = true;
        this.levelTransitionTimer = 40;
        this.playerData.currentLevel = this.level;
        this.savePlayerData();
    }

    checkGameOver() {
        for (let c = 0; c < this.COLS; c++) {
            if (this.grid[this.ROWS - 2]?.[c]) {
                this.gameOver = true;
                this.playerData.totalScore += this.score;
                this.playerData.totalPopped += this.bubblesPopped;
                this.playerData.gamesPlayed++;
                this.savePlayerData();
                setTimeout(() => this.onScore(this.score, true, { level: this.level, coins: this.levelCoins, diamonds: this.levelDiamonds }), 1200);
                return;
            }
        }
    }

    // ============================================================
    // FX HELPERS
    // ============================================================
    addParticle(x, y, vx, vy, color, size, life) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        this.particles.push({ x, y, vx, vy, color, size, life, maxLife: life });
    }

    spawnPop(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.PI * 2 * i / count;
            const spd = Math.random() * 3 + 1.5;
            this.addParticle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, Math.random() * 2.5 + 1, 35);
        }
        if (this.popRings.length < this.MAX_POP_RINGS)
            this.popRings.push({ x, y, radius: this.BUBBLE_R * 0.3, opacity: 0.55, color });
    }

    addTextPopup(x, y, t, color) {
        if (this.textPopups.length >= this.MAX_POPUPS) this.textPopups.shift();
        this.textPopups.push({ x, y, text: t, color, life: 50, opacity: 1 });
    }

    addFloatingText(x, y, t, color, size) {
        this.floatingTexts.push({ x, y, text: t, color, size: size || 16, life: 90, opacity: 1, scale: 0.4 });
    }

    shake(timer, force) {
        this.shakeTimer = this.isMobile ? Math.ceil(timer * 0.6) : timer;
        this.shakeForce = force;
    }

    makeStars(count) {
        return Array.from({ length: count }, () => ({
            x: Math.random() * this.W, y: Math.random() * this.H,
            size: Math.random() * 1.2 + 0.3, phase: Math.random() * 6.28,
            speed: Math.random() * 0.012 + 0.004
        }));
    }

    fmtNum(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return '' + n;
    }

    // ============================================================
    // MAIN DRAW
    // ============================================================
    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.shakeX || this.shakeY) ctx.translate(this.dS(this.shakeX), this.dS(this.shakeY));

        this.drawBG(ctx);
        this.drawProgress(ctx);
        this.drawGrid(ctx);
        this.drawPopRings(ctx);
        this.drawAimLine(ctx);
        this.drawShooter(ctx);
        this.drawProjectile(ctx);
        this.drawFalling(ctx);
        this.drawParticles(ctx);
        this.drawTextPopups(ctx);
        this.drawFloatingTexts(ctx);
        this.drawHUD(ctx);
        this.drawPowerUps(ctx);
        this.drawFSBtn(ctx);

        ctx.restore();

        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyReward(ctx);
        if (this.showLevelComplete) this.drawLevelCompleteScreen(ctx);
        if (this.levelTransition) this.drawTransition(ctx);
        if (this.gameOver) this.drawGameOverScreen(ctx);
    }

    // ============================================================
    // BG
    // ============================================================
    drawBG(ctx) {
        if (!this._bgGrad || this._bgKey !== `${this.W}x${this.H}`) {
            this._bgGrad = ctx.createRadialGradient(this.dX(this.W / 2), this.dY(this.H * 0.3), 0, this.dX(this.W / 2), this.dY(this.H * 0.5), this.dS(this.H));
            this._bgGrad.addColorStop(0, '#110825');
            this._bgGrad.addColorStop(1, '#030210');
            this._bgKey = `${this.W}x${this.H}`;
        }
        ctx.fillStyle = this._bgGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.isMobile || this.frame % 2 === 0) {
            for (const s of this.stars) {
                ctx.globalAlpha = 0.15 + ((Math.sin(s.phase) + 1) / 2) * 0.5;
                ctx.fillStyle = '#FFF';
                ctx.beginPath();
                ctx.arc(Math.round(s.x * this.dpr), Math.round(s.y * this.dpr), s.size * this.dpr, 0, 6.2832);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    // ============================================================
    // PROGRESS BAR
    // ============================================================
    drawProgress(ctx) {
        const bx = 10, by = this.HUD_HEIGHT + 2, bw = this.W - 20, bh = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this.roundRect(ctx, bx, by, bw, bh, 2); ctx.fill();
        if (this.levelProgress > 0) {
            const fw = bw * this.levelProgress;
            const gr = ctx.createLinearGradient(this.dX(bx), 0, this.dX(bx + fw), 0);
            gr.addColorStop(0, '#B94FE3');
            gr.addColorStop(1, '#00D4FF');
            ctx.fillStyle = gr;
            this.roundRect(ctx, bx, by, fw, bh, 2); ctx.fill();
        }
    }

    // ============================================================
    // GRID BUBBLES
    // ============================================================
    drawGrid(ctx) {
        const R = this.BUBBLE_R;
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
            const b = this.grid[r]?.[c];
            if (!b) continue;
            const pos = this.bubblePos(r, c);
            const scale = b.isNew ? b.scale : (this.isMobile ? 1 : 1 + Math.sin(b.breathe) * 0.005);
            const bounce = this.gridBounce[`${r},${c}`] || 0;
            const px = pos.x, py = pos.y - bounce;

            // Desktop glow
            if (!this.isMobile) {
                const glowImg = this.cache.glows.get(b.ci);
                if (glowImg) {
                    ctx.globalAlpha = 0.25;
                    const gs = (R + 12) * 2 * scale;
                    ctx.drawImage(glowImg, this.dX(px) - this.dS(gs / 2), this.dY(py) - this.dS(gs / 2), this.dS(gs), this.dS(gs));
                    ctx.globalAlpha = 1;
                }
            }

            if (b.flash > 0) ctx.globalAlpha = 0.7 + (b.flash / 5) * 0.3;
            const bubImg = this.cache.bubbles.get(b.ci);
            if (bubImg) {
                const bs = (R + 3) * 2 * scale;
                ctx.drawImage(bubImg, this.dX(px) - this.dS(bs / 2), this.dY(py) - this.dS(bs / 2), this.dS(bs), this.dS(bs));
            }
            ctx.globalAlpha = 1;
        }
    }

    // ============================================================
    // AIM LINE
    // ============================================================
    drawAimLine(ctx) {
        if (!this.aimDots.length || this.projectile) return;
        const col = this.COLORS[this.currentBubble?.ci || 0];
        for (let i = 0; i < this.aimDots.length; i++) {
            const d = this.aimDots[i];
            ctx.globalAlpha = (1 - d.t) * 0.5;
            ctx.fillStyle = col.hex;
            ctx.beginPath();
            ctx.arc(Math.round(d.x * this.dpr), Math.round(d.y * this.dpr), Math.max(1, (2.5 - d.t * 1.2)) * this.dpr, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // SHOOTER
    // ============================================================
    drawShooter(ctx) {
        const x = this.shooterX, y = this.shooterY;

        // Barrel
        ctx.save();
        ctx.translate(this.dX(x), this.dY(y));
        ctx.rotate(this.angle);
        ctx.fillStyle = '#9944cc';
        const rx = this.dS(8 - this.shootRecoil), ry = this.dS(-4.5), rw = this.dS(26), rh = this.dS(9), rr = this.dS(3);
        ctx.beginPath();
        ctx.moveTo(rx + rr, ry);
        ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
        ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
        ctx.arcTo(rx, ry + rh, rx, ry, rr);
        ctx.arcTo(rx, ry, rx + rw, ry, rr);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Current bubble
        const bci = this.currentBubble.ci;
        const bubImg = this.cache.bubbles.get(bci);
        if (bubImg) {
            const bs = (this.BUBBLE_R + 3) * 2;
            ctx.drawImage(bubImg, this.dX(x) - this.dS(bs / 2), this.dY(y) - this.dS(bs / 2), this.dS(bs), this.dS(bs));
        }

        // Swap ring
        if (this.swapAnim > 0) {
            ctx.globalAlpha = this.swapAnim;
            ctx.strokeStyle = this.COLORS[this.swapColorIdx].hex;
            ctx.lineWidth = this.dS(2);
            this.circle(ctx, x, y, this.BUBBLE_R + 4 + (1 - this.swapAnim) * 8);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Tap hint - CLEAN text, no blur
        this.text(ctx, 'TAP = COLOR', x, y + this.BUBBLE_R + 13, 8, 'rgba(255,255,255,0.35)',
            { align: 'center', baseline: 'top', weight: '500', font: this.FONT_MONO });

        // Next bubble
        this.text(ctx, 'NEXT', x + 46, y - 4, 8, 'rgba(255,255,255,0.3)',
            { align: 'center', baseline: 'middle', weight: '600' });

        const nImg = this.cache.bubbles.get(this.nextBubble.ci);
        if (nImg) {
            ctx.globalAlpha = 0.7;
            const ns = (this.BUBBLE_R + 3) * 2 * 0.6;
            ctx.drawImage(nImg, this.dX(x + 46) - this.dS(ns / 2), this.dY(y + 12) - this.dS(ns / 2), this.dS(ns), this.dS(ns));
            ctx.globalAlpha = 1;
        }
    }

    // ============================================================
    // PROJECTILE
    // ============================================================
    drawProjectile(ctx) {
        if (!this.projectile) return;
        const p = this.projectile;
        for (let i = 0; i < p.trail.length; i++) {
            const t = p.trail[i], prog = i / p.trail.length;
            ctx.globalAlpha = prog * 0.25;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(Math.round(t.x * this.dpr), Math.round(t.y * this.dpr), this.BUBBLE_R * prog * 0.4 * this.dpr, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        const bubImg = this.cache.bubbles.get(p.ci);
        if (bubImg) {
            const bs = (this.BUBBLE_R + 3) * 2;
            ctx.drawImage(bubImg, this.dX(p.x) - this.dS(bs / 2), this.dY(p.y) - this.dS(bs / 2), this.dS(bs), this.dS(bs));
        }
    }

    // ============================================================
    // FX DRAW
    // ============================================================
    drawFalling(ctx) {
        for (const b of this.fallingBubbles) {
            ctx.globalAlpha = Math.min(1, b.life / 30);
            const bubImg = this.cache.bubbles.get(b.ci);
            if (bubImg) {
                const bs = (this.BUBBLE_R + 3) * 2;
                ctx.drawImage(bubImg, this.dX(b.x) - this.dS(bs / 2), this.dY(b.y) - this.dS(bs / 2), this.dS(bs), this.dS(bs));
            }
        }
        ctx.globalAlpha = 1;
    }

    drawPopRings(ctx) {
        for (const r of this.popRings) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = this.dS(2 * r.opacity);
            this.circle(ctx, r.x, r.y, r.radius);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    drawParticles(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(Math.round(p.x * this.dpr), Math.round(p.y * this.dpr), Math.max(0.5, p.size * (p.life / p.maxLife)) * this.dpr, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawTextPopups(ctx) {
        for (const t of this.textPopups) {
            this.text(ctx, t.text, t.x, t.y, 12, t.color,
                { align: 'center', baseline: 'middle', weight: '700', alpha: t.opacity, outline: true, outlineColor: 'rgba(0,0,0,0.6)', outlineWidth: 2 });
        }
    }

    drawFloatingTexts(ctx) {
        for (const t of this.floatingTexts) {
            const sz = (t.size || 14) * Math.min(1, t.scale || 1);
            this.text(ctx, t.text, t.x, t.y, sz, t.color,
                { align: 'center', baseline: 'middle', weight: '700', alpha: t.opacity, outline: true, outlineColor: 'rgba(0,0,0,0.5)', outlineWidth: 2.5 });
        }
    }

    // ============================================================
    // HUD - Clean sharp text
    // ============================================================
    drawHUD(ctx) {
        const W = this.W, hh = this.HUD_HEIGHT;

        // BG
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.dY(hh));

        // Bottom line
        ctx.fillStyle = 'rgba(185,79,227,0.3)';
        ctx.fillRect(0, this.dY(hh - 1), this.canvas.width, this.dS(1));

        // Left: Level
        this.text(ctx, `LVL ${this.level}`, 10, 14, 13, '#B94FE3', { weight: '800' });
        if (this.levelConfig?.name) {
            this.text(ctx, this.levelConfig.name, 10, 30, 9, 'rgba(255,255,255,0.35)', { weight: '500', font: this.FONT_MONO });
        }

        // Center: Progress + Combo
        this.text(ctx, `${this.bubblesPopped}/${this.levelGoal}`, W / 2, 14, 11, '#00D4FF',
            { align: 'center', weight: '600', font: this.FONT_MONO });

        if (this.combo > 1) {
            this.text(ctx, `x${this.combo} COMBO`, W / 2, 30, 10, '#FFD700',
                { align: 'center', weight: '800' });
        }

        // Right: Coins & Gems
        const cFlash = this.hudFlash.coins > 0;
        this.text(ctx, `C ${this.fmtNum(this.playerData.coins)}`, W - 10, 14, cFlash ? 11 : 10, cFlash ? '#FFF' : '#FFD700',
            { align: 'right', weight: '700' });

        const dFlash = this.hudFlash.diamonds > 0;
        this.text(ctx, `D ${this.fmtNum(this.playerData.diamonds)}`, W - 10, 30, dFlash ? 11 : 10, dFlash ? '#FFF' : '#00D4FF',
            { align: 'right', weight: '700' });
    }

    // ============================================================
    // POWER-UP BUTTONS
    // ============================================================
    drawPowerUps(ctx) {
        const btns = this.getPUBtns();
        const keys = Object.keys(this.powerUps);

        keys.forEach((key, idx) => {
            const pup = this.powerUps[key];
            const b = btns[idx];
            const active = this.activePowerUp === key;
            const has = pup.count > 0;

            ctx.fillStyle = active ? (pup.color + '33') : `rgba(185,79,227,${has ? 0.08 : 0.03})`;
            this.roundRect(ctx, b.x, b.y, b.s, b.s, 10); ctx.fill();

            ctx.strokeStyle = active ? pup.color : (has ? 'rgba(185,79,227,0.2)' : 'rgba(80,80,80,0.08)');
            ctx.lineWidth = this.dS(active ? 1.5 : 0.5);
            this.roundRect(ctx, b.x, b.y, b.s, b.s, 10); ctx.stroke();

            ctx.globalAlpha = has ? 1 : 0.2;

            this.text(ctx, pup.icon, b.x + b.s / 2, b.y + b.s / 2 - 6, this.isMobile ? 18 : 15, pup.color,
                { align: 'center', baseline: 'middle', weight: '700' });

            this.text(ctx, pup.name, b.x + b.s / 2, b.y + b.s - 8, this.isMobile ? 7 : 6, 'rgba(255,255,255,0.5)',
                { align: 'center', baseline: 'middle', weight: '500', font: this.FONT_MONO });

            if (has) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                this.circle(ctx, b.x + b.s - 6, b.y + 6, 7); ctx.fill();
                this.text(ctx, `${pup.count}`, b.x + b.s - 6, b.y + 6, 7, '#00FF88',
                    { align: 'center', baseline: 'middle', weight: '700' });
            }
            ctx.globalAlpha = 1;
        });

        if (!this.isMobile) {
            this.text(ctx, '1=Bomb  2=Aim+  C=Color  F=Full', this.W / 2, btns[0].y - 6, 6, 'rgba(255,255,255,0.12)',
                { align: 'center', baseline: 'bottom', weight: '400', font: this.FONT_MONO });
        }
    }

    // ============================================================
    // FULLSCREEN BTN
    // ============================================================
    drawFSBtn(ctx) {
        const r = this.getFSRect();
        const isFS = this.isFullscreen;

        ctx.fillStyle = `rgba(185,79,227,${isFS ? 0.15 : 0.08})`;
        this.roundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();

        ctx.strokeStyle = `rgba(185,79,227,${isFS ? 0.4 : 0.2})`;
        ctx.lineWidth = this.dS(0.7);
        this.roundRect(ctx, r.x, r.y, r.w, r.h, 8); ctx.stroke();

        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const sz = 6, arm = 3.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = this.dS(1.5);
        ctx.lineCap = 'round';

        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
            if (!isFS) {
                const tx = cx + sx * sz, ty = cy + sy * sz;
                ctx.beginPath();
                ctx.moveTo(this.dX(tx - sx * arm), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty - sy * arm));
                ctx.stroke();
            } else {
                const ins = sz - arm * 0.6;
                const tx = cx + sx * ins, ty = cy + sy * ins;
                ctx.beginPath();
                ctx.moveTo(this.dX(tx + sx * arm), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty + sy * arm));
                ctx.stroke();
            }
        });
        ctx.lineCap = 'butt';
    }

    // ============================================================
    // OVERLAYS - All clean text, no blur
    // ============================================================
    drawCard(ctx, x, y, w, h, borderColor) {
        ctx.fillStyle = 'rgba(8,5,20,0.96)';
        this.roundRect(ctx, x, y, w, h, 14); ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = this.dS(1.5);
        this.roundRect(ctx, x, y, w, h, 14); ctx.stroke();
        ctx.globalAlpha = 1;
    }

    drawButton(ctx, cx, cy, w, h, label, c1, c2) {
        const bx = cx - w / 2, by = cy - h / 2;
        const gr = ctx.createLinearGradient(this.dX(bx), 0, this.dX(bx + w), 0);
        gr.addColorStop(0, c1); gr.addColorStop(1, c2);
        ctx.fillStyle = gr;
        this.roundRect(ctx, bx, by, w, h, h / 2); ctx.fill();
        this.text(ctx, label, cx, cy + 1, 13, '#FFF', { align: 'center', baseline: 'middle', weight: '700' });
    }

    easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; }

    drawDailyReward(ctx) {
        const a = this.dailyRewardAnim;
        ctx.fillStyle = `rgba(0,0,0,${(0.85 * a).toFixed(2)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (a < 0.3) return;

        const W = this.W, H = this.H;
        const cw = Math.min(270, W - 36), ch = 240;
        const cx = (W - cw) / 2, cy = (H - ch) / 2;
        this.drawCard(ctx, cx, cy, cw, ch, '#FFD700');

        const streak = this.playerData.dailyStreak;
        const coins = Math.floor(50 * Math.min(1 + streak * 0.25, 3));
        const dias = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));

        this.text(ctx, 'Daily Reward!', W / 2, cy + 34, 20, '#FFD700', { align: 'center', weight: '800' });
        this.text(ctx, `Day ${streak + 1} Streak`, W / 2, cy + 58, 11, '#00D4FF', { align: 'center', weight: '600', font: this.FONT_MONO });
        this.text(ctx, `${coins} Coins`, W / 2, cy + 95, 22, '#FFD700', { align: 'center', weight: '800' });
        this.text(ctx, `${dias} Gems`, W / 2, cy + 124, 18, '#00D4FF', { align: 'center', weight: '700' });
        this.drawButton(ctx, W / 2, cy + ch - 38, 145, 34, 'CLAIM!', '#B94FE3', '#FF1A6D');
    }

    drawLevelCompleteScreen(ctx) {
        const prog = Math.min(1, this.levelCompleteTimer / 25);
        const eased = this.easeOutBack(prog);
        ctx.fillStyle = `rgba(0,0,0,${(0.8 * prog).toFixed(2)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (prog < 0.2) return;

        const W = this.W, H = this.H;
        const cw = Math.min(295, W - 30), ch = 310;
        const cx = (W - cw) / 2, cy = (H - ch) / 2;

        ctx.save();
        ctx.translate(this.dX(W / 2), this.dY(H / 2));
        ctx.scale(eased, eased);
        ctx.translate(-this.dX(W / 2), -this.dY(H / 2));

        this.drawCard(ctx, cx, cy, cw, ch, '#00FF88');

        this.text(ctx, 'LEVEL COMPLETE!', W / 2, cy + 32, 19, '#00FF88', { align: 'center', weight: '800' });

        for (let i = 0; i < 3; i++) {
            const sx = W / 2 + (i - 1) * 38;
            this.text(ctx, i < this.starRating ? '★' : '☆', sx, cy + 66, 26, i < this.starRating ? '#FFD700' : 'rgba(255,255,255,0.2)',
                { align: 'center', baseline: 'middle', weight: '400' });
        }

        const stats = [`Score: ${this.fmtNum(this.score)}`, `Popped: ${this.bubblesPopped}`, `Combo: x${this.maxCombo}`, `Shots: ${this.shotsUsed}`];
        stats.forEach((s, i) => {
            this.text(ctx, s, W / 2, cy + 105 + i * 22, 11, 'rgba(255,255,255,0.6)',
                { align: 'center', weight: '500', font: this.FONT_MONO });
        });

        this.text(ctx, `Coins +${this.levelCoins}`, W / 2, cy + 208, 14, '#FFD700', { align: 'center', weight: '700' });
        if (this.levelDiamonds > 0)
            this.text(ctx, `Gems +${this.levelDiamonds}`, W / 2, cy + 230, 13, '#00D4FF', { align: 'center', weight: '700' });

        if (this.levelCompleteTimer > 30)
            this.drawButton(ctx, W / 2, cy + ch - 36, 155, 34, 'NEXT LEVEL', '#00D4FF', '#00FF88');

        ctx.restore();
    }

    drawTransition(ctx) {
        const prog = 1 - (this.levelTransitionTimer / 40);
        const alpha = prog < 0.5 ? prog * 2 : 2 - prog * 2;
        ctx.fillStyle = `rgba(3,2,10,${alpha.toFixed(2)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (prog > 0.3 && prog < 0.7) {
            const a = 1 - Math.abs(prog - 0.5) * 5;
            this.text(ctx, `Level ${this.level}`, this.W / 2, this.H / 2, 22, '#B94FE3',
                { align: 'center', baseline: 'middle', weight: '800', alpha: Math.max(0, a) });
        }
    }

    drawGameOverScreen(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const W = this.W, H = this.H;
        this.text(ctx, 'GAME OVER', W / 2, H / 2 - 48, 26, '#FF1A6D',
            { align: 'center', baseline: 'middle', weight: '800' });
        this.text(ctx, `Score: ${this.fmtNum(this.score)}`, W / 2, H / 2 - 4, 13, 'rgba(255,255,255,0.7)',
            { align: 'center', baseline: 'middle', weight: '600', font: this.FONT_MONO });
        this.text(ctx, `Level ${this.level} | Combo x${this.maxCombo}`, W / 2, H / 2 + 22, 10, 'rgba(255,255,255,0.45)',
            { align: 'center', baseline: 'middle', weight: '500', font: this.FONT_MONO });
        this.text(ctx, `+${this.levelCoins} Coins`, W / 2, H / 2 + 56, 12, '#FFD700',
            { align: 'center', baseline: 'middle', weight: '700' });
        this.text(ctx, `+${this.levelDiamonds} Gems`, W / 2, H / 2 + 78, 12, '#00D4FF',
            { align: 'center', baseline: 'middle', weight: '700' });

        const blink = 0.45 + Math.sin(this.time / 420) * 0.4;
        this.text(ctx, 'Tap restart to play again', W / 2, H / 2 + 115, 10, 'rgba(200,200,220,1)',
            { align: 'center', baseline: 'middle', weight: '500', font: this.FONT_MONO, alpha: blink });
    }

    // ============================================================
    // GAME LOOP
    // ============================================================
    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;

        if (this.isMobile) {
            this.fpsHistory.push(dt);
            if (this.fpsHistory.length > 30) this.fpsHistory.shift();
            if (this.fpsHistory.length === 30) {
                const avg = this.fpsHistory.reduce((a, b) => a + b, 0) / 30;
                this.adaptiveMode = avg > 22;
            }
            if (this.adaptiveMode && this.frame % 2 === 1) {
                if (!this.paused) this.update(dt);
                this.animId = requestAnimationFrame(t => this.loop(t));
                return;
            }
        }

        if (!this.paused) this.update(dt);
        this.draw();
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        this.isPaused = this.paused;
        return this.paused;
    }

    resize() {
        this.dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 2 : 2);
        this.setupCanvas();
        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile = this.W < 768 || ('ontouchstart' in window);
        this.isSmallScreen = this.W < 380;
        this.COLS = this.isSmallScreen ? 8 : 10;
        this.HUD_HEIGHT = this.isMobile ? 44 : 48;
        this.BOTTOM_ZONE = this.isMobile ? 100 : 110;
        this.GRID_TOP = this.HUD_HEIGHT + 8;
        this.BUBBLE_R = this.calcRadius();
        this.recalcGrid();
        this.stars = this.makeStars(this.isMobile ? 25 : 55);
        this._bgGrad = null;
        this.preRenderBubbles();
        this.calcAimLine();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        document.removeEventListener('fullscreenchange', this.boundFSChange);
        document.removeEventListener('webkitfullscreenchange', this.boundFSChange);
        this.cache.bubbles.clear();
        this.cache.glows.clear();
        this.savePlayerData();
    }
}