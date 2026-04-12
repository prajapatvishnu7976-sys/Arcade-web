/* ============================================================
   BUBBLE SHOOTER v5.0 - MOBILE ULTRA HD EDITION
   Crystal Clear Text | 120FPS Smooth | Mobile-First
   Zero Blur | Premium Feel | Addictive Gameplay
   ============================================================ */

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

        // ============================================
        // CRITICAL: HD RESOLUTION FIX
        // ============================================
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.setupHDCanvas();

        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });

        // Force crisp rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Logical dimensions (what we work with)
        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;

        // ============================================
        // MOBILE DETECTION
        // ============================================
        this.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ('ontouchstart' in window)
            || (window.innerWidth < 768);
        this.isSmallScreen = this.W < 380;

        // ============================================
        // FONT SYSTEM - Crisp pixel-perfect text
        // ============================================
        this.fontLoaded = false;
        this.loadFonts();

        // ============================================
        // PRE-RENDER CACHE
        // ============================================
        this.cache = {
            bubbles: new Map(),
            glows: new Map(),
            ui: new Map()
        };

        // ============================================
        // CURRENCY & ECONOMY
        // ============================================
        this.saveKey = 'neonarcade_bubbleshooter_v5';
        this.playerData = this.loadPlayerData();

        // ============================================
        // GAME CONFIG - Mobile optimized
        // ============================================
        this.COLS = this.isSmallScreen ? 8 : 10;
        this.ROWS = 14;
        this.BUBBLE_R = this.calculateBubbleRadius();

        // Premium color palette with full data
        this.COLORS = [
            { hex: '#FF1A6D', r: 255, g: 26,  b: 109, name: 'Rose',   glow: 'rgba(255,26,109,',  light: '#FF4D8A', dark: '#CC1557' },
            { hex: '#00D4FF', r: 0,   g: 212, b: 255, name: 'Cyan',   glow: 'rgba(0,212,255,',   light: '#4DE1FF', dark: '#00A8CC' },
            { hex: '#00FF88', r: 0,   g: 255, b: 136, name: 'Lime',   glow: 'rgba(0,255,136,',   light: '#4DFFA3', dark: '#00CC6D' },
            { hex: '#FFD700', r: 255, g: 215, b: 0,   name: 'Gold',   glow: 'rgba(255,215,0,',   light: '#FFE14D', dark: '#CCAC00' },
            { hex: '#B94FE3', r: 185, g: 79,  b: 227, name: 'Violet', glow: 'rgba(185,79,227,',  light: '#CD7AEB', dark: '#9440B6' },
            { hex: '#FF8811', r: 255, g: 136, b: 17,  name: 'Amber',  glow: 'rgba(255,136,17,',  light: '#FFA34D', dark: '#CC6D0E' },
            { hex: '#FF3864', r: 255, g: 56,  b: 100, name: 'Cherry', glow: 'rgba(255,56,100,',  light: '#FF6B8A', dark: '#CC2D50' },
            { hex: '#18FFAB', r: 24,  g: 255, b: 171, name: 'Mint',   glow: 'rgba(24,255,171,',  light: '#5CFFBF', dark: '#14CC89' }
        ];
        this.colorsInPlay = [];

        // Grid math
        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * 1.73;
        this.offsetX = 0;
        this.offsetY = this.isMobile ? 52 : 58;
        this.recalcGrid();

        // Shooter
        this.shooterX = this.W / 2;
        this.shooterY = this.H - (this.isMobile ? 58 : 65);
        this.angle = -Math.PI / 2;
        this.targetAngle = -Math.PI / 2;
        this.currentBubble = null;
        this.nextBubble = null;
        this.projectile = null;
        this.projectileSpeed = this.isMobile ? 13 : 15;
        this.canShoot = true;
        this.shootCooldown = 0;

        // Animation pools (pre-allocated for performance)
        this.particles = [];
        this.fallingBubbles = [];
        this.aimDots = [];
        this.popRings = [];
        this.textPopups = [];
        this.floatingTexts = [];
        this.ripples = [];

        // Max pool sizes for mobile performance
        this.MAX_PARTICLES = this.isMobile ? 60 : 120;
        this.MAX_FALLING = 20;
        this.MAX_POP_RINGS = 15;
        this.MAX_POPUPS = 10;

        // Screen shake
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeTimer = 0;
        this.shakeForce = 0;

        // Timing
        this.time = 0;
        this.frame = 0;
        this.fps = 0;
        this.fpsTimer = 0;
        this.fpsCount = 0;

        // Game state
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

        // Level system
        this.levelConfig = null;
        this.levelGoal = 0;
        this.levelProgress = 0;
        this.levelComplete = false;
        this.levelTransition = false;
        this.levelTransitionTimer = 0;
        this.starRating = 0;
        this.showLevelComplete = false;
        this.levelCompleteTimer = 0;

        // Drop system
        this.dropTimer = 0;
        this.dropInterval = 30000;
        this.dropWarning = false;

        // Grid animations
        this.gridBounce = {};
        this.gridWobble = {};

        // Shooter animation
        this.shootRecoil = 0;
        this.shootGlow = 0;

        // Power-ups
        this.powerUps = {
            fireball:  { count: this.playerData.powerUps?.fireball  || 1, icon: '🔥', name: 'Fire',    cost: 50,  color: '#FF4500' },
            rainbow:   { count: this.playerData.powerUps?.rainbow   || 1, icon: '🌈', name: 'Rainbow', cost: 75,  color: '#FF00FF' },
            bomb:      { count: this.playerData.powerUps?.bomb      || 1, icon: '💣', name: 'Bomb',    cost: 100, color: '#FF8811' },
            precision: { count: this.playerData.powerUps?.precision || 2, icon: '🎯', name: 'Aim+',    cost: 30,  color: '#00FF88' }
        };
        this.activePowerUp = null;

        // HUD animation state
        this.hudFlash = {};
        this.hudPulse = {};

        // Daily reward
        this.showDailyReward = false;
        this.dailyRewardClaimed = false;
        this.dailyRewardAnim = 0;
        this.checkDailyReward();

        // Background pre-calc
        this.stars = this.makeStars(this.isMobile ? 40 : 70);

        // Initialize everything
        this.initLevel(this.level);
        this.generateShooter();
        this.preRenderAll();

        // ============================================
        // EVENT BINDING - Mobile first
        // ============================================
        this.pointerDown = false;
        this.lastPointerX = this.W / 2;
        this.lastPointerY = this.H / 2;

        this.bindEvents();

        // Start loop
        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ============================================================
    // HD CANVAS SETUP - THE KEY FIX FOR BLUR
    // ============================================================

    setupHDCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width || this.canvas.clientWidth || 400;
        const h = rect.height || this.canvas.clientHeight || 700;

        // Set actual pixel dimensions
        this.canvas.width = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);

        // Keep CSS dimensions
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    // ============================================================
    // FONT LOADING - Eliminates blurry text
    // ============================================================

    loadFonts() {
        // Use system fonts as fallback, load custom async
        this.FONT_UI = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.FONT_TITLE = '"Orbitron", "Rajdhani", "Segoe UI", monospace';
        this.FONT_MONO = '"Rajdhani", "Segoe UI", Roboto, sans-serif';

        // Check if Orbitron is available
        if (document.fonts) {
            document.fonts.ready.then(() => {
                this.fontLoaded = true;
                // Check specific fonts
                if (document.fonts.check('12px Orbitron')) {
                    this.FONT_TITLE = 'Orbitron';
                }
                if (document.fonts.check('12px Rajdhani')) {
                    this.FONT_MONO = 'Rajdhani';
                }
            });
        } else {
            this.fontLoaded = true;
        }
    }

    // ============================================================
    // CRISP TEXT RENDERING
    // ============================================================

    setFont(ctx, weight, size, family) {
        // Scale font size by DPR for crisp rendering
        const scaledSize = Math.round(size * this.dpr);
        ctx.font = `${weight} ${scaledSize}px ${family || this.FONT_UI}`;
    }

    drawText(ctx, text, x, y, options = {}) {
        const {
            size = 14,
            weight = 'bold',
            color = '#FFFFFF',
            align = 'left',
            baseline = 'alphabetic',
            family = null,
            shadow = false,
            shadowColor = null,
            shadowBlur = 0,
            shadowOffX = 0,
            shadowOffY = 0,
            glow = false,
            glowColor = null,
            glowBlur = 0,
            maxWidth = 0,
            stroke = false,
            strokeColor = '#000',
            strokeWidth = 3,
            opacity = 1
        } = options;

        ctx.save();

        // Scale to logical coordinates
        const sx = x * this.dpr;
        const sy = y * this.dpr;

        ctx.globalAlpha = opacity;
        this.setFont(ctx, weight, size, family || (size > 16 ? this.FONT_TITLE : this.FONT_UI));
        ctx.textAlign = align;
        ctx.textBaseline = baseline;

        // Stroke outline for readability
        if (stroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth * this.dpr;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(text, sx, sy, maxWidth ? maxWidth * this.dpr : undefined);
        }

        // Shadow for depth
        if (shadow || glow) {
            ctx.shadowBlur = (glow ? glowBlur : shadowBlur) * this.dpr;
            ctx.shadowColor = glow ? (glowColor || color) : (shadowColor || 'rgba(0,0,0,0.8)');
            ctx.shadowOffsetX = shadowOffX * this.dpr;
            ctx.shadowOffsetY = shadowOffY * this.dpr;
        }

        ctx.fillStyle = color;
        ctx.fillText(text, sx, sy, maxWidth ? maxWidth * this.dpr : undefined);

        ctx.restore();
    }

    // ============================================================
    // CRISP SHAPE DRAWING
    // ============================================================

    // All drawing methods now use DPR-scaled coordinates

    dX(x) { return Math.round(x * this.dpr); }
    dY(y) { return Math.round(y * this.dpr); }
    dS(s) { return s * this.dpr; }

    fillRect(ctx, x, y, w, h) {
        ctx.fillRect(this.dX(x), this.dY(y), this.dS(w), this.dS(h));
    }

    strokeRect(ctx, x, y, w, h) {
        ctx.strokeRect(this.dX(x), this.dY(y), this.dS(w), this.dS(h));
    }

    drawCircle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(this.dX(x), this.dY(y), this.dS(r), 0, Math.PI * 2);
    }

    drawRoundRect(ctx, x, y, w, h, radius) {
        const dx = this.dX(x);
        const dy = this.dY(y);
        const dw = this.dS(w);
        const dh = this.dS(h);
        const dr = this.dS(radius);

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
    // PRE-RENDER ALL CACHED ASSETS
    // ============================================================

    preRenderAll() {
        this.cache.bubbles.clear();
        this.cache.glows.clear();

        const r = this.BUBBLE_R;

        // Render each color bubble at full DPR resolution
        this.COLORS.forEach((col, idx) => {
            // Main bubble
            const bSize = Math.ceil((r + 4) * 2 * this.dpr);
            const bCanvas = document.createElement('canvas');
            bCanvas.width = bSize;
            bCanvas.height = bSize;
            const bCtx = bCanvas.getContext('2d');
            const cx = bSize / 2;
            const cy = bSize / 2;
            const pr = r * this.dpr;

            this.renderHDBubble(bCtx, cx, cy, pr, col);
            this.cache.bubbles.set(idx, bCanvas);

            // Glow
            const gSize = Math.ceil((r + 14) * 2 * this.dpr);
            const gCanvas = document.createElement('canvas');
            gCanvas.width = gSize;
            gCanvas.height = gSize;
            const gCtx = gCanvas.getContext('2d');
            const gcx = gSize / 2;
            const gcy = gSize / 2;

            const glowGrad = gCtx.createRadialGradient(gcx, gcy, pr * 0.3, gcx, gcy, (r + 12) * this.dpr);
            glowGrad.addColorStop(0, col.glow + '0.25)');
            glowGrad.addColorStop(0.6, col.glow + '0.08)');
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            gCtx.fillStyle = glowGrad;
            gCtx.beginPath();
            gCtx.arc(gcx, gcy, (r + 12) * this.dpr, 0, Math.PI * 2);
            gCtx.fill();

            this.cache.glows.set(idx, gCanvas);
        });
    }

    renderHDBubble(ctx, cx, cy, r, col) {
        // Layer 1: Base sphere with 3D gradient
        const baseGrad = ctx.createRadialGradient(
            cx - r * 0.25, cy - r * 0.3, r * 0.05,
            cx + r * 0.05, cy + r * 0.1, r
        );
        baseGrad.addColorStop(0, col.light);
        baseGrad.addColorStop(0.35, col.hex);
        baseGrad.addColorStop(0.75, col.hex);
        baseGrad.addColorStop(1, col.dark);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = baseGrad;
        ctx.fill();

        // Layer 2: Edge shadow for depth
        const edgeGrad = ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, r);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGrad.addColorStop(0.7, 'rgba(0,0,0,0.05)');
        edgeGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = edgeGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Layer 3: Primary highlight (top-left)
        const hl = ctx.createRadialGradient(
            cx - r * 0.3, cy - r * 0.35, 0,
            cx - r * 0.15, cy - r * 0.15, r * 0.55
        );
        hl.addColorStop(0, 'rgba(255,255,255,0.65)');
        hl.addColorStop(0.3, 'rgba(255,255,255,0.2)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Layer 4: Specular dot
        const spec = ctx.createRadialGradient(
            cx - r * 0.22, cy - r * 0.28, 0,
            cx - r * 0.22, cy - r * 0.28, r * 0.13
        );
        spec.addColorStop(0, 'rgba(255,255,255,0.95)');
        spec.addColorStop(0.5, 'rgba(255,255,255,0.3)');
        spec.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = spec;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Layer 5: Bottom rim light
        const rim = ctx.createRadialGradient(
            cx + r * 0.15, cy + r * 0.3, 0,
            cx + r * 0.15, cy + r * 0.3, r * 0.3
        );
        rim.addColorStop(0, 'rgba(255,255,255,0.12)');
        rim.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rim;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Layer 6: Thin outline
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = Math.max(0.5, this.dpr * 0.5);
        ctx.beginPath();
        ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    calculateBubbleRadius() {
        const maxR = Math.floor((this.W - 16) / (this.COLS * 2 + 0.5));
        return Math.min(maxR, this.isMobile ? 18 : 20);
    }

    recalcGrid() {
        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * 1.73;
        const totalW = this.COLS * this.cellW;
        this.offsetX = (this.W - totalW) / 2 + this.BUBBLE_R;
    }

    // ============================================================
    // SAVE / LOAD
    // ============================================================

    loadPlayerData() {
        const defaults = {
            coins: 0, diamonds: 0,
            currentLevel: 1, highestLevel: 1,
            totalScore: 0, totalPopped: 0,
            totalCoinsEarned: 0, totalDiamondsEarned: 0,
            dailyStreak: 0, lastDailyReward: null,
            levelStars: {},
            powerUps: { fireball: 1, rainbow: 1, bomb: 1, precision: 2 },
            gamesPlayed: 0
        };
        try {
            const s = JSON.parse(localStorage.getItem(this.saveKey));
            if (s) return { ...defaults, ...s };
        } catch (e) {}
        return defaults;
    }

    savePlayerData() {
        this.playerData.powerUps = {};
        for (const k in this.powerUps) this.playerData.powerUps[k] = this.powerUps[k].count;
        try { localStorage.setItem(this.saveKey, JSON.stringify(this.playerData)); } catch (e) {}
    }

    // ============================================================
    // DAILY REWARD
    // ============================================================

    checkDailyReward() {
        const today = new Date().toDateString();
        if (this.playerData.lastDailyReward !== today) {
            if (this.playerData.lastDailyReward) {
                const last = new Date(this.playerData.lastDailyReward);
                const diff = Math.floor((new Date() - last) / 86400000);
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

        let bonusPup = null;
        if (streak > 0 && streak % 5 === 0) {
            const keys = Object.keys(this.powerUps);
            bonusPup = keys[Math.floor(Math.random() * keys.length)];
            this.powerUps[bonusPup].count++;
        }

        this.playerData.coins += coins;
        this.playerData.diamonds += diamonds;
        this.playerData.totalCoinsEarned += coins;
        this.playerData.totalDiamondsEarned += diamonds;
        this.playerData.lastDailyReward = new Date().toDateString();
        this.playerData.dailyStreak++;
        this.dailyRewardClaimed = true;
        this.showDailyReward = false;

        this.addFloatingText(this.W / 2, this.H / 2 - 30, `+${coins} 🪙`, '#FFD700', 22);
        this.addFloatingText(this.W / 2, this.H / 2 + 10, `+${diamonds} 💎`, '#00D4FF', 20);
        if (bonusPup) {
            this.addFloatingText(this.W / 2, this.H / 2 + 45, `+1 ${this.powerUps[bonusPup].icon}`, '#00FF88', 18);
        }

        this.spawnCelebration(this.W / 2, this.H / 2, 20);
        if (window.audioManager) audioManager.play('achievement');
        this.savePlayerData();
    }

    // ============================================================
    // LEVEL SYSTEM
    // ============================================================

    getLevelConfig(lvl) {
        const configs = {
            1:  { rows: 4, colors: 3, goal: 25,  drop: 45000, name: 'Warm Up',         layout: 'std' },
            2:  { rows: 4, colors: 3, goal: 30,  drop: 42000, name: 'Getting Started',  layout: 'std' },
            3:  { rows: 5, colors: 4, goal: 40,  drop: 40000, name: 'Color Mix',        layout: 'std' },
            4:  { rows: 5, colors: 4, goal: 45,  drop: 38000, name: 'Rising Tide',      layout: 'std' },
            5:  { rows: 6, colors: 4, goal: 55,  drop: 35000, name: '★ The Wall',       layout: 'boss_wall' },
            6:  { rows: 5, colors: 5, goal: 50,  drop: 35000, name: 'Rainbow Rush',     layout: 'std' },
            7:  { rows: 5, colors: 5, goal: 55,  drop: 33000, name: 'Quick Fire',       layout: 'zigzag' },
            8:  { rows: 6, colors: 5, goal: 60,  drop: 32000, name: 'Deep Colors',      layout: 'std' },
            9:  { rows: 6, colors: 5, goal: 65,  drop: 30000, name: 'Speed Run',        layout: 'diamond' },
            10: { rows: 7, colors: 5, goal: 75,  drop: 28000, name: '★ Pyramid',        layout: 'boss_pyr' },
            11: { rows: 6, colors: 6, goal: 70,  drop: 28000, name: 'Hex Mix',          layout: 'std' },
            12: { rows: 6, colors: 6, goal: 75,  drop: 26000, name: 'Cascade',          layout: 'checker' },
            13: { rows: 7, colors: 6, goal: 80,  drop: 25000, name: 'Tight Squeeze',    layout: 'std' },
            14: { rows: 7, colors: 6, goal: 85,  drop: 24000, name: 'Storm',            layout: 'zigzag' },
            15: { rows: 7, colors: 6, goal: 90,  drop: 22000, name: '★ The Cross',      layout: 'boss_cross' },
            16: { rows: 7, colors: 7, goal: 85,  drop: 22000, name: 'Spectrum',         layout: 'std' },
            17: { rows: 7, colors: 7, goal: 90,  drop: 20000, name: 'Maze Runner',      layout: 'maze' },
            18: { rows: 8, colors: 7, goal: 95,  drop: 20000, name: 'Dense Pack',       layout: 'std' },
            19: { rows: 8, colors: 7, goal: 100, drop: 18000, name: 'Pressure',         layout: 'diamond' },
            20: { rows: 8, colors: 7, goal: 110, drop: 16000, name: '★ Spiral',         layout: 'boss_spiral' },
            21: { rows: 8, colors: 8, goal: 100, drop: 16000, name: 'Octachrome',       layout: 'std' },
            22: { rows: 8, colors: 8, goal: 110, drop: 15000, name: 'Blitz',            layout: 'checker' },
            23: { rows: 9, colors: 8, goal: 120, drop: 14000, name: 'Endurance',        layout: 'zigzag' },
            24: { rows: 9, colors: 8, goal: 130, drop: 12000, name: 'Nightmare',        layout: 'maze' },
            25: { rows: 10,colors: 8, goal: 150, drop: 10000, name: '★ FINAL BOSS',     layout: 'boss_final' }
        };
        if (configs[lvl]) return configs[lvl];
        return {
            rows: Math.min(10, 6 + Math.floor(lvl / 5)),
            colors: Math.min(8, 3 + Math.floor(lvl / 3)),
            goal: 50 + lvl * 10,
            drop: Math.max(8000, 30000 - lvl * 800),
            name: `Endless ${lvl}`,
            layout: ['std','zigzag','diamond','checker','maze'][lvl % 5]
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

        // Clear grid
        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.grid[r] = new Array(this.COLS).fill(null);
        }

        this.buildLayout(this.levelConfig);
        this.updateColorsInPlay();

        // Clear FX
        this.particles = [];
        this.fallingBubbles = [];
        this.popRings = [];
        this.ripples = [];

        // Level intro text
        this.addFloatingText(this.W / 2, this.H / 2 - 35, `Level ${level}`, '#B94FE3', 28);
        this.addFloatingText(this.W / 2, this.H / 2 + 5, this.levelConfig.name, '#00D4FF', 16);
        this.addFloatingText(this.W / 2, this.H / 2 + 35, `Pop ${this.levelGoal} bubbles`, '#FFFFFF80', 12);
    }

    buildLayout(cfg) {
        const n = cfg.colors;
        const rows = cfg.rows;

        switch (cfg.layout) {
            case 'zigzag':
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < this.COLS; c++)
                        if ((r + c) % 2 === 0) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                break;
            case 'diamond':
                const mid = Math.floor(this.COLS / 2);
                for (let r = 0; r < rows; r++) {
                    const half = Math.min(r, rows - 1 - r);
                    for (let c = mid - half; c <= mid + half; c++)
                        if (c >= 0 && c < this.COLS) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                }
                break;
            case 'checker':
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < this.COLS; c++)
                        this.grid[r][c] = this.makeBubble((r + c) % n);
                break;
            case 'maze':
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < this.COLS; c++)
                        if (r % 2 === 0 || c % 3 === 0) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                break;
            case 'boss_wall':
                for (let r = 0; r < 6; r++)
                    for (let c = 0; c < this.COLS; c++)
                        this.grid[r][c] = this.makeBubble(r % n);
                break;
            case 'boss_pyr':
                for (let r = 0; r < 7; r++) {
                    const s = Math.max(0, Math.floor(r / 2));
                    const e = Math.min(this.COLS, this.COLS - Math.floor(r / 2));
                    for (let c = s; c < e; c++) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                }
                break;
            case 'boss_cross': {
                const m = Math.floor(this.COLS / 2);
                for (let r = 0; r < 7; r++) {
                    if (r === 3) for (let c = 0; c < this.COLS; c++) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                    for (let c = m - 1; c <= m + 1; c++)
                        if (c >= 0 && c < this.COLS) this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                }
                break;
            }
            case 'boss_spiral': {
                const cx2 = Math.floor(this.COLS / 2);
                for (let r = 0; r < 8; r++)
                    for (let c = 0; c < this.COLS; c++) {
                        const dx = c - cx2;
                        const d = Math.sqrt(dx * dx + r * r);
                        if (d < 6 && (Math.floor(Math.atan2(r, dx) * 3 + d) % 2 === 0))
                            this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
                    }
                break;
            }
            case 'boss_final':
                for (let r = 0; r < 8; r++)
                    for (let c = 0; c < this.COLS; c++)
                        this.grid[r][c] = this.makeBubble(r < 3 ? (r % n) : Math.floor(Math.random() * n));
                break;
            default:
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < this.COLS; c++)
                        this.grid[r][c] = this.makeBubble(Math.floor(Math.random() * n));
        }
    }

    makeBubble(ci) {
        this.totalBubbles++;
        return {
            ci,                  // color index
            scale: 1,
            flash: 0,
            breathe: Math.random() * 6.28,
            isNew: false
        };
    }

    // ============================================================
    // ECONOMY
    // ============================================================

    earnCoins(amt, x, y) {
        this.playerData.coins += amt;
        this.playerData.totalCoinsEarned += amt;
        this.levelCoins += amt;
        this.addTextPopup(x, y, `+${amt} 🪙`, '#FFD700');
        this.hudFlash.coins = 15;
    }

    earnDiamonds(amt, x, y) {
        this.playerData.diamonds += amt;
        this.playerData.totalDiamondsEarned += amt;
        this.levelDiamonds += amt;
        this.addTextPopup(x, y, `+${amt} 💎`, '#00D4FF');
        this.hudFlash.diamonds = 15;
        if (window.audioManager) audioManager.play('achievement');
    }

    // ============================================================
    // POWER-UPS
    // ============================================================

    activatePowerUp(type) {
        if (!this.powerUps[type] || this.powerUps[type].count <= 0) return;
        if (this.activePowerUp === type) { this.activePowerUp = null; return; }
        if (this.activePowerUp) this.activePowerUp = null;

        this.powerUps[type].count--;
        this.activePowerUp = type;

        this.addFloatingText(this.W / 2, this.H / 2, `${this.powerUps[type].icon} ${this.powerUps[type].name}!`, this.powerUps[type].color, 20);

        // FX burst
        const cx = this.shooterX, cy = this.shooterY;
        for (let i = 0; i < 8; i++) {
            const a = Math.PI * 2 * i / 8;
            this.addParticle(cx, cy, Math.cos(a) * 3, Math.sin(a) * 3, this.powerUps[type].color, 3, 50);
        }

        if (window.audioManager) audioManager.play('powerUp');
        this.savePlayerData();
    }

    // ============================================================
    // INPUT - Mobile First
    // ============================================================

    bindEvents() {
        // Unified pointer events for better mobile support
        if (window.PointerEvent) {
            this.canvas.addEventListener('pointermove', e => this.handlePointerMove(e));
            this.canvas.addEventListener('pointerup', e => this.handlePointerUp(e));
            this.canvas.addEventListener('pointerdown', e => { this.pointerDown = true; });
        } else {
            this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
            this.canvas.addEventListener('click', e => this.handleClick(e));
            this.canvas.addEventListener('touchmove', e => {
                e.preventDefault();
                this.handleTouchMove(e);
            }, { passive: false });
            this.canvas.addEventListener('touchend', e => {
                e.preventDefault();
                this.handleTouchEnd(e);
            });
        }

        document.addEventListener('keydown', e => this.handleKey(e));
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
            cx = e.clientX;
            cy = e.clientY;
        }

        return {
            x: (cx - rect.left) * scaleX,
            y: (cy - rect.top) * scaleY
        };
    }

    handlePointerMove(e) {
        if (this.paused || this.gameOver) return;
        const p = this.getLogicalPos(e);
        this.lastPointerX = p.x;
        this.lastPointerY = p.y;
        this.aimAt(p.x, p.y);
    }

    handlePointerUp(e) {
        const p = this.getLogicalPos(e);
        this.lastPointerX = p.x;
        this.lastPointerY = p.y;

        if (this.handleUIClick(p.x, p.y)) return;
        this.aimAt(p.x, p.y);
        this.tryShoot();
    }

    handleMouseMove(e) {
        if (this.paused || this.gameOver) return;
        const p = this.getLogicalPos(e);
        this.aimAt(p.x, p.y);
    }

    handleClick(e) {
        const p = this.getLogicalPos(e);
        if (this.handleUIClick(p.x, p.y)) return;
        this.aimAt(p.x, p.y);
        this.tryShoot();
    }

    handleTouchMove(e) {
        if (this.paused || this.gameOver) return;
        const p = this.getLogicalPos(e);
        this.aimAt(p.x, p.y);
    }

    handleTouchEnd(e) {
        const p = this.getLogicalPos(e);
        if (this.handleUIClick(p.x, p.y)) return;
        this.aimAt(p.x, p.y);
        this.tryShoot();
    }

    handleKey(e) {
        if (this.destroyed) return;
        if (e.key >= '1' && e.key <= '4') {
            const keys = ['fireball', 'rainbow', 'bomb', 'precision'];
            this.activatePowerUp(keys[parseInt(e.key) - 1]);
        }
        if (e.key === ' ') { e.preventDefault(); this.tryShoot(); }
    }

    handleUIClick(x, y) {
        if (this.showDailyReward && !this.dailyRewardClaimed) { this.claimDailyReward(); return true; }
        if (this.showLevelComplete) { this.goNextLevel(); return true; }

        // Power-up buttons
        const btnS = this.isMobile ? 38 : 34;
        const btnY = this.shooterY + 20;
        const startX = 8;
        let i = 0;
        for (const key in this.powerUps) {
            const bx = startX + i * (btnS + 5);
            if (x >= bx && x <= bx + btnS && y >= btnY && y <= btnY + btnS) {
                this.activatePowerUp(key);
                return true;
            }
            i++;
        }
        return false;
    }

    aimAt(mx, my) {
        let a = Math.atan2(my - this.shooterY, mx - this.shooterX);
        a = Math.max(-Math.PI + 0.1, Math.min(-0.1, a));
        this.targetAngle = a;
        this.calcAimLine();
    }

    tryShoot() {
        if (this.showDailyReward) return;
        if (this.showLevelComplete) return;
        if (this.paused || this.gameOver || !this.canShoot || this.projectile) return;
        if (this.levelComplete || this.levelTransition) return;
        if (this.shootCooldown > 0) return;
        this.shoot();
    }

    // ============================================================
    // AIM LINE
    // ============================================================

    calcAimLine() {
        this.aimDots = [];
        let x = this.shooterX, y = this.shooterY;
        let vx = Math.cos(this.targetAngle), vy = Math.sin(this.targetAngle);
        let bounces = 0;
        const maxB = this.activePowerUp === 'precision' ? 4 : 2;
        const step = 10;
        const maxSteps = this.activePowerUp === 'precision' ? 50 : 30;

        for (let i = 0; i < maxSteps; i++) {
            x += vx * step;
            y += vy * step;

            if (x <= this.BUBBLE_R) { x = this.BUBBLE_R; vx *= -1; bounces++; }
            if (x >= this.W - this.BUBBLE_R) { x = this.W - this.BUBBLE_R; vx *= -1; bounces++; }
            if (y <= this.offsetY || y > this.shooterY + 10) break;
            if (bounces >= maxB) break;

            // Grid collision check
            let hit = false;
            for (let r = 0; r < this.ROWS && !hit; r++) {
                for (let c = 0; c < this.COLS && !hit; c++) {
                    if (!this.grid[r]?.[c]) continue;
                    const pos = this.bubblePos(r, c);
                    const dx = x - pos.x, dy = y - pos.y;
                    if (dx * dx + dy * dy < (this.BUBBLE_R * 1.8) ** 2) hit = true;
                }
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
        this.shootCooldown = 6;
        this.shootRecoil = 6;
        this.shootGlow = 1;

        const isFire = this.activePowerUp === 'fireball';
        const isRain = this.activePowerUp === 'rainbow';
        const isBomb = this.activePowerUp === 'bomb';

        this.projectile = {
            x: this.shooterX, y: this.shooterY,
            vx: Math.cos(this.angle) * this.projectileSpeed,
            vy: Math.sin(this.angle) * this.projectileSpeed,
            ci: isRain ? -1 : this.currentBubble.ci,
            color: isRain ? '#FFF' : this.COLORS[this.currentBubble.ci].hex,
            trail: [],
            isFire, isRain, isBomb,
            fireHits: 0, age: 0
        };

        // Muzzle particles
        for (let i = 0; i < 4; i++) {
            const spread = (Math.random() - 0.5) * 0.4;
            this.addParticle(
                this.shooterX + Math.cos(this.angle) * 25,
                this.shooterY + Math.sin(this.angle) * 25,
                Math.cos(this.angle + spread) * 2, Math.sin(this.angle + spread) * 2,
                isFire ? '#FF4500' : this.currentBubble.color, 2, 30
            );
        }

        this.activePowerUp = null;
        if (window.audioManager) audioManager.play('shoot');
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

        // Daily reward anim
        if (this.showDailyReward) { this.dailyRewardAnim = Math.min(1, this.dailyRewardAnim + 0.05); }

        if (this.showLevelComplete) { this.levelCompleteTimer++; this.updateFX(dt); return; }

        if (this.levelTransition) {
            this.levelTransitionTimer--;
            if (this.levelTransitionTimer <= 0) {
                this.levelTransition = false;
                this.initLevel(this.level);
                this.generateShooter();
            }
            return;
        }

        // Smooth aim
        const diff = this.targetAngle - this.angle;
        this.angle += diff * (this.isMobile ? 0.35 : 0.25);

        // Shooter FX
        if (this.shootRecoil > 0) this.shootRecoil *= 0.82;
        if (this.shootGlow > 0) this.shootGlow *= 0.9;

        // Shake
        if (this.shakeTimer > 0) {
            const f = this.shakeForce * (this.shakeTimer / 12);
            this.shakeX = (Math.random() - 0.5) * f;
            this.shakeY = (Math.random() - 0.5) * f * 0.4;
            this.shakeTimer--;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        // HUD flash decay
        for (const k in this.hudFlash) if (this.hudFlash[k] > 0) this.hudFlash[k]--;

        // Stars
        this.stars.forEach(s => { s.phase += s.speed; });

        // Projectile
        if (this.projectile) this.updateProjectile();

        // Grid anim
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;
                if (b.isNew) {
                    b.scale += (1 - b.scale) * 0.18;
                    if (b.scale > 0.97) { b.scale = 1; b.isNew = false; }
                }
                if (b.flash > 0) b.flash -= 0.6;
                b.breathe += 0.015;
                const bk = `${r},${c}`;
                if (this.gridBounce[bk]) {
                    this.gridBounce[bk] *= 0.85;
                    if (Math.abs(this.gridBounce[bk]) < 0.15) delete this.gridBounce[bk];
                }
            }
        }

        // Drop timer
        this.dropTimer += dt;
        if (this.dropTimer >= this.dropInterval) { this.dropTimer = 0; this.dropRow(); }
        this.dropWarning = (this.dropInterval - this.dropTimer) < 5000;

        // Progress
        this.levelProgress = Math.min(1, this.bubblesPopped / this.levelGoal);

        // Level complete?
        if (this.bubblesPopped >= this.levelGoal && !this.levelComplete) this.completeLevel();

        // Grid clear bonus
        const remaining = this.grid.flat().filter(Boolean).length;
        if (remaining === 0 && !this.levelComplete && this.totalBubbles > 0) {
            this.earnCoins(100, this.W / 2, this.H / 2);
            this.earnDiamonds(3, this.W / 2, this.H / 2 + 25);
            this.completeLevel();
        }

        // Game over check
        this.checkGameOver();

        // Update FX
        this.updateFX(dt);
    }

    updateFX(dt) {
        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += p.grav;
            p.life--;
            p.vx *= 0.97;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Falling bubbles
        for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
            const b = this.fallingBubbles[i];
            b.vy += 0.45; b.y += b.vy; b.x += b.vx;
            b.rot += b.rotSpd; b.life--;
            if (b.life <= 0 || b.y > this.H + 40) this.fallingBubbles.splice(i, 1);
        }

        // Pop rings
        for (let i = this.popRings.length - 1; i >= 0; i--) {
            const r = this.popRings[i];
            r.radius += 2.5; r.opacity -= 0.04;
            if (r.opacity <= 0) this.popRings.splice(i, 1);
        }

        // Text popups
        for (let i = this.textPopups.length - 1; i >= 0; i--) {
            const t = this.textPopups[i];
            t.y -= 1.2; t.life--;
            t.opacity = Math.min(1, t.life / 25);
            if (t.life <= 0) this.textPopups.splice(i, 1);
        }

        // Floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 0.6; t.life--;
            t.opacity = Math.min(1, t.life / 30);
            t.scale += (1 - t.scale) * 0.12;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // Ripples
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += 2; r.opacity -= 0.025;
            if (r.opacity <= 0) this.ripples.splice(i, 1);
        }
    }

    updateProjectile() {
        const p = this.projectile;
        p.age++;

        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 10) p.trail.shift();

        p.x += p.vx;
        p.y += p.vy;

        // Walls
        if (p.x <= this.BUBBLE_R) { p.x = this.BUBBLE_R; p.vx *= -1; }
        if (p.x >= this.W - this.BUBBLE_R) { p.x = this.W - this.BUBBLE_R; p.vx *= -1; }

        // Top
        if (p.y <= this.BUBBLE_R + this.offsetY) {
            if (p.isFire) { this.projectile = null; this.canShoot = true; return; }
            this.snapBubble(); return;
        }

        // Bottom
        if (p.y > this.H + 20) { this.projectile = null; this.canShoot = true; return; }

        // Fireball
        if (p.isFire) { this.fireballCheck(); return; }

        // Grid collision
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.grid[r]?.[c]) continue;
                const pos = this.bubblePos(r, c);
                const dx = p.x - pos.x, dy = p.y - pos.y;
                if (dx * dx + dy * dy < (this.BUBBLE_R * 1.85) ** 2) {
                    this.snapBubble();
                    return;
                }
            }
        }
    }

    fireballCheck() {
        const p = this.projectile;
        if (!p) return;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.grid[r]?.[c]) continue;
                const pos = this.bubblePos(r, c);
                const dx = p.x - pos.x, dy = p.y - pos.y;
                if (dx * dx + dy * dy < (this.BUBBLE_R * 1.9) ** 2) {
                    this.spawnPop(pos.x, pos.y, this.COLORS[this.grid[r][c].ci].hex, 6);
                    this.grid[r][c] = null;
                    this.bubblesPopped++;
                    p.fireHits++;
                    this.score += 10;
                    this.earnCoins(2, pos.x, pos.y);
                    this.onScore(this.score);
                }
            }
        }
        if (p.fireHits > 15) { this.projectile = null; this.canShoot = true; this.dropFloating(); }
    }

    // ============================================================
    // SNAP & MATCH
    // ============================================================

    snapBubble() {
        if (!this.projectile) return;
        const p = this.projectile;

        // Find nearest empty cell
        let bestR = -1, bestC = -1, bestD = Infinity;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) continue;
                const pos = this.bubblePos(r, c);
                const dx = p.x - pos.x, dy = p.y - pos.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < bestD && d < this.BUBBLE_R * 3.5) { bestD = d; bestR = r; bestC = c; }
            }
        }

        if (bestR === -1) {
            bestR = 0;
            bestC = Math.max(0, Math.min(this.COLS - 1, Math.round((p.x - this.offsetX) / this.cellW)));
        }

        if (bestR !== -1 && bestC !== -1) {
            const impactPos = this.bubblePos(bestR, bestC);
            this.ripples.push({ x: impactPos.x, y: impactPos.y, radius: this.BUBBLE_R * 0.5, opacity: 0.5, color: p.color });

            // Bomb
            if (p.isBomb) { this.explodeBomb(bestR, bestC); this.projectile = null; this.canShoot = true; return; }

            // Rainbow color match
            let ci = p.ci;
            if (p.isRain) {
                const nbs = this.getNeighbors(bestR, bestC);
                const counts = {};
                for (const [nr, nc] of nbs) {
                    if (this.grid[nr]?.[nc]) {
                        const c2 = this.grid[nr][nc].ci;
                        counts[c2] = (counts[c2] || 0) + 1;
                    }
                }
                const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                ci = best ? parseInt(best[0]) : 0;
            }

            this.grid[bestR][bestC] = { ci, scale: 0.15, flash: 6, breathe: Math.random() * 6.28, isNew: true };

            // Wobble neighbors
            const nbs = this.getNeighbors(bestR, bestC);
            for (const [nr, nc] of nbs) {
                if (this.grid[nr]?.[nc]) this.gridBounce[`${nr},${nc}`] = 2.5;
            }

            const matches = this.findMatches(bestR, bestC);
            if (matches.length >= 3) {
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this.popMatches(matches, bestR, bestC);
            } else {
                this.combo = 0;
                if (window.audioManager) audioManager.play('pop');
            }

            setTimeout(() => this.dropFloating(), 100);
        }

        this.projectile = null;
        this.canShoot = true;
        this.updateColorsInPlay();
    }

    explodeBomb(r, c) {
        let count = 0;
        const pos = this.bubblePos(r, c);

        for (let dr = -3; dr <= 3; dr++) {
            for (let dc = -3; dc <= 3; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= this.ROWS || nc < 0 || nc >= this.COLS) continue;
                if (!this.grid[nr]?.[nc]) continue;
                if (Math.sqrt(dr * dr + dc * dc) > 2.5) continue;
                const bp = this.bubblePos(nr, nc);
                this.spawnPop(bp.x, bp.y, this.COLORS[this.grid[nr][nc].ci].hex, 6);
                this.grid[nr][nc] = null;
                count++;
            }
        }

        this.bubblesPopped += count;
        this.score += count * 15;
        this.onScore(this.score);
        this.earnCoins(count * 3, pos.x, pos.y);
        this.shake(12, 8);
        this.addTextPopup(pos.x, pos.y - 15, `💣 +${count * 15}`, '#FF8811');
        this.ripples.push({ x: pos.x, y: pos.y, radius: 10, opacity: 0.7, color: '#FF8811' });
        if (window.audioManager) audioManager.play('levelUp');
        setTimeout(() => this.dropFloating(), 150);
    }

    findMatches(sr, sc) {
        if (!this.grid[sr]?.[sc]) return [];
        const target = this.grid[sr][sc].ci;
        const visited = new Set();
        const matches = [];
        const queue = [[sr, sc]];
        while (queue.length) {
            const [r, c] = queue.shift();
            const k = `${r},${c}`;
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
            ? [[r-1,c],[r-1,c+1],[r,c-1],[r,c+1],[r+1,c],[r+1,c+1]]
            : [[r-1,c-1],[r-1,c],[r,c-1],[r,c+1],[r+1,c-1],[r+1,c]];
    }

    bubblePos(r, c) {
        const ox = r % 2 === 1 ? this.BUBBLE_R : 0;
        return { x: this.offsetX + c * this.cellW + ox, y: this.offsetY + r * this.cellH };
    }

    updateColorsInPlay() {
        const used = new Set();
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.grid[r]?.[c]) used.add(this.grid[r][c].ci);
        this.colorsInPlay = [...used];
        if (!this.colorsInPlay.length)
            this.colorsInPlay = Array.from({ length: Math.min(3, this.levelConfig?.colors || 3) }, (_, i) => i);
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

        if (combo >= 3 || (matches.length >= 5 && Math.random() < 0.3)) {
            this.earnDiamonds(combo >= 5 ? 2 : 1, oPos.x, oPos.y - 20);
        }

        // Staggered pop
        matches.forEach(([r, c], i) => {
            setTimeout(() => {
                if (this.destroyed) return;
                const pos = this.bubblePos(r, c);
                const col = this.grid[r]?.[c] ? this.COLORS[this.grid[r][c].ci].hex : '#FFF';
                this.spawnPop(pos.x, pos.y, col, 8);
                if (this.grid[r]) this.grid[r][c] = null;
            }, i * 25);
        });

        const label = combo > 1 ? `x${combo}! +${pts}` : `+${pts}`;
        this.addTextPopup(oPos.x, oPos.y - 12, label, combo > 2 ? '#FFD700' : '#00FF88');

        this.onScore(this.score);
        this.shake(combo > 2 ? 10 : 4, combo > 2 ? 7 : 3);

        if (window.audioManager) { combo >= 3 ? audioManager.play('levelUp') : audioManager.play('success'); }
    }

    dropFloating() {
        const connected = new Set();
        const queue = [];
        for (let c = 0; c < this.COLS; c++) if (this.grid[0]?.[c]) queue.push([0, c]);
        while (queue.length) {
            const [r, c] = queue.shift();
            const k = `${r},${c}`;
            if (connected.has(k)) continue;
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS || !this.grid[r]?.[c]) continue;
            connected.add(k);
            for (const n of this.getNeighbors(r, c)) queue.push(n);
        }

        let dropped = 0;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c] && !connected.has(`${r},${c}`)) {
                    const pos = this.bubblePos(r, c);
                    if (this.fallingBubbles.length < this.MAX_FALLING) {
                        this.fallingBubbles.push({
                            x: pos.x, y: pos.y,
                            vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3 - 1,
                            ci: this.grid[r][c].ci, rot: 0,
                            rotSpd: (Math.random() - 0.5) * 0.2, life: 80
                        });
                    }
                    this.grid[r][c] = null;
                    dropped++;
                    this.bubblesPopped++;
                }
            }
        }

        if (dropped > 0) {
            const bonus = dropped * 15;
            this.score += bonus;
            this.earnCoins(dropped * 2, this.W / 2, this.H / 2);
            this.onScore(this.score);
            this.addTextPopup(this.W / 2, this.H / 2, `${dropped} Drop! +${bonus}`, '#FF8811');
            if (window.audioManager) audioManager.play('levelUp');
        }
    }

    dropRow() {
        for (let r = this.ROWS - 1; r > 0; r--) this.grid[r] = this.grid[r - 1] ? [...this.grid[r - 1]] : new Array(this.COLS).fill(null);
        this.grid[0] = [];
        const n = this.levelConfig?.colors || 4;
        for (let c = 0; c < this.COLS; c++) {
            const b = this.makeBubble(Math.floor(Math.random() * n));
            b.isNew = true; b.scale = 0;
            this.grid[0][c] = b;
        }
        this.updateColorsInPlay();
        this.shake(8, 5);
        if (window.audioManager) audioManager.play('fail');
    }

    // ============================================================
    // LEVEL COMPLETE / GAME OVER
    // ============================================================

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

        if (this.levelConfig?.layout?.startsWith('boss')) {
            this.earnDiamonds(5, this.W / 2, this.H / 2);
            this.earnCoins(200, this.W / 2, this.H / 2 + 20);
        }

        const prev = this.playerData.levelStars[this.level] || 0;
        if (this.starRating > prev) this.playerData.levelStars[this.level] = this.starRating;
        if (this.level >= this.playerData.highestLevel) this.playerData.highestLevel = this.level + 1;
        this.playerData.currentLevel = this.level;
        this.playerData.totalScore += this.score;
        this.playerData.totalPopped += this.bubblesPopped;
        this.playerData.gamesPlayed++;
        this.savePlayerData();

        this.spawnCelebration(this.W / 2, this.H * 0.3, 30);
        if (window.audioManager) audioManager.play('achievement');
    }

    goNextLevel() {
        this.level++;
        this.score = 0;
        this.showLevelComplete = false;
        this.levelTransition = true;
        this.levelTransitionTimer = 50;
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
                setTimeout(() => this.onScore(this.score, true, {
                    level: this.level, coins: this.levelCoins, diamonds: this.levelDiamonds
                }), 1200);
                return;
            }
        }
    }

    // ============================================================
    // FX HELPERS
    // ============================================================

    addParticle(x, y, vx, vy, color, size, life) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        this.particles.push({ x, y, vx, vy, color, size, life, maxLife: life, grav: 0.08 });
    }

    spawnPop(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.PI * 2 * i / count + Math.random() * 0.3;
            const spd = Math.random() * 4 + 1.5;
            this.addParticle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, Math.random() * 3 + 1.5, 40);
        }
        // White sparkles
        for (let i = 0; i < 3; i++) {
            this.addParticle(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 2, -Math.random() * 2 - 1, '#FFF', Math.random() * 2 + 0.5, 30);
        }
        if (this.popRings.length < this.MAX_POP_RINGS) {
            this.popRings.push({ x, y, radius: this.BUBBLE_R * 0.4, opacity: 0.6, color });
        }
    }

    spawnCelebration(cx, cy, count) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (this.destroyed) return;
                const x = cx + (Math.random() - 0.5) * this.W * 0.8;
                const y = cy + (Math.random() - 0.5) * this.H * 0.3;
                this.spawnPop(x, y, this.COLORS[Math.floor(Math.random() * this.COLORS.length)].hex, 5);
            }, i * 40);
        }
    }

    addTextPopup(x, y, text, color) {
        if (this.textPopups.length >= this.MAX_POPUPS) this.textPopups.shift();
        this.textPopups.push({ x, y, text, color, life: 60, opacity: 1, scale: 0.5 });
    }

    addFloatingText(x, y, text, color, size) {
        this.floatingTexts.push({ x, y, text, color, size: size || 16, life: 110, opacity: 1, scale: 0.3 });
    }

    shake(timer, force) {
        this.shakeTimer = timer;
        this.shakeForce = force;
    }

    // ============================================================
    // BACKGROUND
    // ============================================================

    makeStars(count) {
        return Array.from({ length: count }, () => ({
            x: Math.random() * this.W,
            y: Math.random() * this.H,
            size: Math.random() * 1.5 + 0.3,
            phase: Math.random() * 6.28,
            speed: Math.random() * 0.015 + 0.005,
            color: Math.random() > 0.85 ? '#B94FE3' : Math.random() > 0.6 ? '#00D4FF' : '#FFF'
        }));
    }

    fmtNum(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return '' + n;
    }

    // ============================================================
    // DRAW - All DPR scaled for crystal clarity
    // ============================================================

    draw() {
        const ctx = this.ctx;
        const W = this.W;
        const H = this.H;

        // Clear (no alpha mode so this is fast)
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();

        // Apply shake
        if (this.shakeX || this.shakeY) {
            ctx.translate(this.dS(this.shakeX), this.dS(this.shakeY));
        }

        this.drawBG(ctx, W, H);
        this.drawProgressBar(ctx, W);
        this.drawDropWarningFX(ctx, W, H);
        this.drawRipplesFX(ctx);
        this.drawGridBubbles(ctx);
        this.drawFallingBubblesFX(ctx);
        this.drawPopRingsFX(ctx);
        this.drawAimLineFX(ctx);
        this.drawShooterFX(ctx);
        this.drawProjectileFX(ctx);
        this.drawParticlesFX(ctx);
        this.drawTextPopupsFX(ctx);
        this.drawFloatingTextsFX(ctx);
        this.drawHUD(ctx, W, H);
        this.drawPowerUpButtons(ctx);

        ctx.restore();

        // Overlays (no shake)
        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyRewardScreen(ctx, W, H);
        if (this.showLevelComplete) this.drawLevelCompleteScreen(ctx, W, H);
        if (this.levelTransition) this.drawTransition(ctx, W, H);
        if (this.gameOver) this.drawGameOverScreen(ctx, W, H);
    }

    // ---- Background ----

    drawBG(ctx, W, H) {
        // Deep gradient
        const g = ctx.createRadialGradient(
            this.dX(W / 2), this.dY(H * 0.25), 0,
            this.dX(W / 2), this.dY(H * 0.5), this.dS(H)
        );
        g.addColorStop(0, '#110825');
        g.addColorStop(0.4, '#0a0518');
        g.addColorStop(1, '#030210');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Nebula blobs
        const nebula = ctx.createRadialGradient(
            this.dX(W * 0.3), this.dY(H * 0.2), 0,
            this.dX(W * 0.3), this.dY(H * 0.2), this.dS(120)
        );
        nebula.addColorStop(0, 'rgba(185,79,227,0.04)');
        nebula.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = nebula;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        for (const s of this.stars) {
            const alpha = 0.15 + ((Math.sin(s.phase) + 1) / 2) * 0.6;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = s.color;
            this.drawCircle(ctx, s.x, s.y, s.size);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Progress Bar ----

    drawProgressBar(ctx, W) {
        const bw = W - 20;
        const bh = 4;
        const bx = 10;
        const by = this.offsetY - 8;
        const prog = this.levelProgress;

        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this.drawRoundRect(ctx, bx, by, bw, bh, 2);
        ctx.fill();

        if (prog > 0) {
            const fw = bw * prog;
            const gr = ctx.createLinearGradient(this.dX(bx), 0, this.dX(bx + fw), 0);
            gr.addColorStop(0, '#B94FE3');
            gr.addColorStop(0.5, '#FF1A6D');
            gr.addColorStop(1, '#00D4FF');
            ctx.fillStyle = gr;
            this.drawRoundRect(ctx, bx, by, fw, bh, 2);
            ctx.fill();
        }
    }

    // ---- Drop Warning ----

    drawDropWarningFX(ctx, W, H) {
        if (!this.dropWarning) return;
        const pct = (this.dropInterval - this.dropTimer) / 5000;
        const pulse = Math.abs(Math.sin(this.time / 180));
        const alpha = (1 - pct) * 0.1 * pulse;

        const vg = ctx.createRadialGradient(
            this.dX(W / 2), this.dY(H / 2), this.dS(W * 0.3),
            this.dX(W / 2), this.dY(H / 2), this.dS(W * 0.7)
        );
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(255,0,50,${alpha})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ---- Grid Bubbles ----

    drawGridBubbles(ctx) {
        const R = this.BUBBLE_R;

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;

                const pos = this.bubblePos(r, c);
                const scale = b.scale * (1 + Math.sin(b.breathe) * 0.006);
                const bounce = this.gridBounce[`${r},${c}`] || 0;
                const drawX = pos.x;
                const drawY = pos.y - bounce;

                // Glow layer
                const glowImg = this.cache.glows.get(b.ci);
                if (glowImg) {
                    ctx.globalAlpha = 0.3;
                    const gs = (R + 14) * 2 * scale;
                    ctx.drawImage(glowImg,
                        this.dX(drawX) - this.dS(gs / 2),
                        this.dY(drawY) - this.dS(gs / 2),
                        this.dS(gs), this.dS(gs)
                    );
                    ctx.globalAlpha = 1;
                }

                // Flash
                if (b.flash > 0) ctx.globalAlpha = 0.65 + (b.flash / 6) * 0.35;

                // Bubble from cache
                const bubImg = this.cache.bubbles.get(b.ci);
                if (bubImg) {
                    const bs = (R + 4) * 2 * scale;
                    ctx.drawImage(bubImg,
                        this.dX(drawX) - this.dS(bs / 2),
                        this.dY(drawY) - this.dS(bs / 2),
                        this.dS(bs), this.dS(bs)
                    );
                }

                ctx.globalAlpha = 1;
            }
        }
    }

    // ---- Falling Bubbles ----

    drawFallingBubblesFX(ctx) {
        for (const b of this.fallingBubbles) {
            ctx.globalAlpha = Math.min(1, b.life / 40);
            ctx.save();
            ctx.translate(this.dX(b.x), this.dY(b.y));
            ctx.rotate(b.rot);
            const bubImg = this.cache.bubbles.get(b.ci);
            if (bubImg) {
                const bs = (this.BUBBLE_R + 4) * 2;
                ctx.drawImage(bubImg, this.dS(-bs / 2), this.dS(-bs / 2), this.dS(bs), this.dS(bs));
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Pop Rings ----

    drawPopRingsFX(ctx) {
        for (const r of this.popRings) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = this.dS(2 * r.opacity);
            this.drawCircle(ctx, r.x, r.y, r.radius);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Ripples ----

    drawRipplesFX(ctx) {
        for (const r of this.ripples) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = this.dS(1.5 * r.opacity);
            this.drawCircle(ctx, r.x, r.y, r.radius);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Aim Line ----

    drawAimLineFX(ctx) {
        if (!this.aimDots.length || this.projectile) return;

        const anim = this.time / 60;

        for (let i = 0; i < this.aimDots.length; i++) {
            const d = this.aimDots[i];
            const alpha = (1 - d.t) * 0.45;
            const phase = ((i * 0.25 + anim) % 1);
            const a = alpha * (0.3 + phase * 0.7);
            const size = 2 - d.t * 1.2;

            ctx.globalAlpha = a;
            ctx.fillStyle = '#FFFFFF';
            this.drawCircle(ctx, d.x, d.y, Math.max(0.8, size));
            ctx.fill();
        }

        // Endpoint marker
        const last = this.aimDots[this.aimDots.length - 1];
        if (last) {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = '#FF1A6D';
            ctx.lineWidth = this.dS(1);
            this.drawCircle(ctx, last.x, last.y, this.BUBBLE_R + 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    // ---- Shooter ----

    drawShooterFX(ctx) {
        const x = this.shooterX;
        const y = this.shooterY;

        // Platform glow
        const pg = ctx.createRadialGradient(
            this.dX(x), this.dY(y + 28), this.dS(8),
            this.dX(x), this.dY(y + 28), this.dS(50)
        );
        pg.addColorStop(0, 'rgba(185,79,227,0.12)');
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(this.dX(x), this.dY(y + 28), this.dS(50), 0, Math.PI * 2);
        ctx.fill();

        // Base
        ctx.fillStyle = '#1a0f2e';
        ctx.beginPath();
        ctx.ellipse(this.dX(x), this.dY(y + 32), this.dS(38), this.dS(9), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(185,79,227,0.3)';
        ctx.lineWidth = this.dS(1);
        ctx.stroke();

        // Barrel
        ctx.save();
        ctx.translate(this.dX(x), this.dY(y));
        ctx.rotate(this.angle);

        const recoil = -this.shootRecoil;
        const bg = ctx.createLinearGradient(0, this.dS(-5), 0, this.dS(5));
        bg.addColorStop(0, '#9955dd');
        bg.addColorStop(0.5, '#b347d9');
        bg.addColorStop(1, '#7733bb');
        ctx.fillStyle = bg;

        this.drawRoundRect_raw(ctx, this.dS(8 + recoil), this.dS(-5), this.dS(28), this.dS(10), this.dS(3));
        ctx.fill();

        // Barrel tip
        ctx.fillStyle = '#d477ff';
        ctx.beginPath();
        ctx.arc(this.dS(36 + recoil), 0, this.dS(3), 0, Math.PI * 2);
        ctx.fill();

        // Muzzle flash
        if (this.shootGlow > 0.1) {
            ctx.globalAlpha = this.shootGlow;
            const mf = ctx.createRadialGradient(this.dS(36), 0, this.dS(2), this.dS(36), 0, this.dS(15));
            mf.addColorStop(0, '#FFFFFF');
            mf.addColorStop(0.3, '#d477ff');
            mf.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = mf;
            ctx.beginPath();
            ctx.arc(this.dS(36), 0, this.dS(15), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // Current bubble
        const bci = this.currentBubble.ci;
        const bubImg = this.cache.bubbles.get(bci);
        const pulse = 1 + Math.sin(this.time / 500) * 0.03;

        if (this.activePowerUp) {
            // Special bubble rendering
            this.drawSpecialBubble(ctx, x, y, this.activePowerUp);
        } else if (bubImg) {
            const bs = (this.BUBBLE_R + 4) * 2 * pulse;
            ctx.drawImage(bubImg,
                this.dX(x) - this.dS(bs / 2),
                this.dY(y) - this.dS(bs / 2),
                this.dS(bs), this.dS(bs)
            );
        }

        // Active power-up ring
        if (this.activePowerUp) {
            const col = this.powerUps[this.activePowerUp].color;
            ctx.globalAlpha = 0.5 + Math.sin(this.time / 150) * 0.3;
            ctx.strokeStyle = col;
            ctx.lineWidth = this.dS(2);
            this.drawCircle(ctx, x, y, this.BUBBLE_R + 4);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Icon on bubble
            this.drawText(ctx, this.powerUps[this.activePowerUp].icon, x, y, {
                size: 14, align: 'center', baseline: 'middle'
            });
        }

        // Next bubble label + preview
        this.drawText(ctx, 'NEXT', x + 50, y + 4, {
            size: 8, color: 'rgba(255,255,255,0.35)', align: 'center', baseline: 'middle', weight: '600'
        });

        const nci = this.nextBubble.ci;
        const nImg = this.cache.bubbles.get(nci);
        if (nImg) {
            ctx.globalAlpha = 0.75;
            const ns = (this.BUBBLE_R + 4) * 2 * 0.65;
            ctx.drawImage(nImg,
                this.dX(x + 50) - this.dS(ns / 2),
                this.dY(y + 20) - this.dS(ns / 2),
                this.dS(ns), this.dS(ns)
            );
            ctx.globalAlpha = 1;
        }
    }

    drawSpecialBubble(ctx, x, y, type) {
        const R = this.BUBBLE_R;
        const pulse = 1 + Math.sin(this.time / 150) * 0.05;

        if (type === 'fireball') {
            const fg = ctx.createRadialGradient(
                this.dX(x), this.dY(y), 0,
                this.dX(x), this.dY(y), this.dS(R * pulse)
            );
            fg.addColorStop(0, '#FFFFFF');
            fg.addColorStop(0.2, '#FFDD00');
            fg.addColorStop(0.5, '#FF8800');
            fg.addColorStop(1, '#FF4500');
            ctx.fillStyle = fg;
            this.drawCircle(ctx, x, y, R * pulse);
            ctx.fill();
        } else if (type === 'rainbow') {
            const hue = (this.time / 5) % 360;
            const rg = ctx.createRadialGradient(
                this.dX(x - R * 0.3), this.dY(y - R * 0.3), this.dS(R * 0.1),
                this.dX(x), this.dY(y), this.dS(R * pulse)
            );
            rg.addColorStop(0, `hsl(${hue}, 100%, 80%)`);
            rg.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 100%, 60%)`);
            rg.addColorStop(1, `hsl(${(hue + 120) % 360}, 100%, 40%)`);
            ctx.fillStyle = rg;
            this.drawCircle(ctx, x, y, R * pulse);
            ctx.fill();
        } else if (type === 'bomb') {
            const bg2 = ctx.createRadialGradient(
                this.dX(x - R * 0.3), this.dY(y - R * 0.3), this.dS(R * 0.1),
                this.dX(x), this.dY(y), this.dS(R)
            );
            bg2.addColorStop(0, '#777');
            bg2.addColorStop(0.5, '#444');
            bg2.addColorStop(1, '#222');
            ctx.fillStyle = bg2;
            this.drawCircle(ctx, x, y, R);
            ctx.fill();
        } else {
            // Precision - draw normal with green tint
            const bubImg = this.cache.bubbles.get(this.currentBubble.ci);
            if (bubImg) {
                const bs = (R + 4) * 2 * pulse;
                ctx.drawImage(bubImg, this.dX(x) - this.dS(bs / 2), this.dY(y) - this.dS(bs / 2), this.dS(bs), this.dS(bs));
            }
        }
    }

    // ---- Projectile ----

    drawProjectileFX(ctx) {
        if (!this.projectile) return;
        const p = this.projectile;

        // Trail
        for (let i = 0; i < p.trail.length; i++) {
            const t = p.trail[i];
            const prog = i / p.trail.length;
            ctx.globalAlpha = prog * 0.3;
            const s = this.BUBBLE_R * prog * 0.5;
            ctx.fillStyle = p.isFire ? '#FF4500' : p.color;
            this.drawCircle(ctx, t.x, t.y, Math.max(1, s));
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Main bubble
        if (p.isFire) {
            const fg = ctx.createRadialGradient(
                this.dX(p.x), this.dY(p.y), 0,
                this.dX(p.x), this.dY(p.y), this.dS(this.BUBBLE_R)
            );
            fg.addColorStop(0, '#FFFFFF');
            fg.addColorStop(0.2, '#FFDD00');
            fg.addColorStop(0.5, '#FF8800');
            fg.addColorStop(1, '#FF4500');
            ctx.fillStyle = fg;
            this.drawCircle(ctx, p.x, p.y, this.BUBBLE_R);
            ctx.fill();
            this.drawText(ctx, '🔥', p.x, p.y, { size: 12, align: 'center', baseline: 'middle' });
        } else if (p.isBomb) {
            ctx.fillStyle = '#555';
            this.drawCircle(ctx, p.x, p.y, this.BUBBLE_R);
            ctx.fill();
            this.drawText(ctx, '💣', p.x, p.y, { size: 12, align: 'center', baseline: 'middle' });
        } else if (p.isRain) {
            const hue = (this.time / 5) % 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
            this.drawCircle(ctx, p.x, p.y, this.BUBBLE_R);
            ctx.fill();
        } else {
            const bubImg = this.cache.bubbles.get(p.ci);
            if (bubImg) {
                const bs = (this.BUBBLE_R + 4) * 2;
                ctx.drawImage(bubImg, this.dX(p.x) - this.dS(bs / 2), this.dY(p.y) - this.dS(bs / 2), this.dS(bs), this.dS(bs));
            }
        }
    }

    // ---- Particles ----

    drawParticlesFX(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            this.drawCircle(ctx, p.x, p.y, Math.max(0.5, p.size * (p.life / p.maxLife)));
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Text Popups ----

    drawTextPopupsFX(ctx) {
        for (const t of this.textPopups) {
            const scale = Math.min(1.1, 0.5 + (1 - t.life / 60) * 0.8);
            this.drawText(ctx, t.text, t.x, t.y, {
                size: 13 * scale, weight: 'bold', color: t.color,
                align: 'center', baseline: 'middle',
                stroke: true, strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 2.5,
                opacity: t.opacity,
                family: this.FONT_TITLE
            });
        }
    }

    drawFloatingTextsFX(ctx) {
        for (const t of this.floatingTexts) {
            const scale = t.scale || 1;
            this.drawText(ctx, t.text, t.x, t.y, {
                size: (t.size || 16) * Math.min(1, scale),
                weight: 'bold', color: t.color,
                align: 'center', baseline: 'middle',
                stroke: true, strokeColor: 'rgba(0,0,0,0.5)', strokeWidth: 3,
                glow: true, glowColor: t.color, glowBlur: 8,
                opacity: t.opacity,
                family: this.FONT_TITLE
            });
        }
    }

    // ---- HUD ----

    drawHUD(ctx, W, H) {
        // Top bar
        const hudGrad = ctx.createLinearGradient(0, 0, 0, this.dY(44));
        hudGrad.addColorStop(0, 'rgba(0,0,0,0.75)');
        hudGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = hudGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.dY(44));

        // Line
        ctx.strokeStyle = 'rgba(185,79,227,0.15)';
        ctx.lineWidth = this.dS(0.5);
        this.drawLine(ctx, 0, 44, W, 44);
        ctx.stroke();

        // Level
        this.drawText(ctx, `LVL ${this.level}`, 10, 17, {
            size: 12, weight: 'bold', color: '#B94FE3',
            family: this.FONT_TITLE,
            glow: true, glowColor: '#B94FE3', glowBlur: 4
        });

        // Level name
        this.drawText(ctx, this.levelConfig?.name || '', 10, 33, {
            size: 9, weight: '500', color: 'rgba(255,255,255,0.4)',
            family: this.FONT_MONO
        });

        // Center: Goal progress
        this.drawText(ctx, `${this.bubblesPopped}/${this.levelGoal}`, W / 2, 17, {
            size: 11, weight: '600', color: '#00D4FF',
            align: 'center', family: this.FONT_MONO
        });

        // Combo
        if (this.combo > 1) {
            const cp = 1 + Math.sin(this.time / 80) * 0.04;
            this.drawText(ctx, `x${this.combo} COMBO`, W / 2, 33, {
                size: 10 * cp, weight: 'bold', color: '#FFD700',
                align: 'center', family: this.FONT_TITLE,
                glow: true, glowColor: '#FFD700', glowBlur: 5
            });
        }

        // Coins
        const coinFlash = this.hudFlash.coins > 0;
        this.drawText(ctx, `🪙 ${this.fmtNum(this.playerData.coins)}`, W - 10, 17, {
            size: coinFlash ? 12 : 10, weight: 'bold',
            color: coinFlash ? '#FFFFFF' : '#FFD700',
            align: 'right', family: this.FONT_TITLE,
            glow: coinFlash, glowColor: '#FFD700', glowBlur: 6
        });

        // Diamonds
        const diaFlash = this.hudFlash.diamonds > 0;
        this.drawText(ctx, `💎 ${this.fmtNum(this.playerData.diamonds)}`, W - 10, 33, {
            size: diaFlash ? 12 : 10, weight: 'bold',
            color: diaFlash ? '#FFFFFF' : '#00D4FF',
            align: 'right', family: this.FONT_TITLE,
            glow: diaFlash, glowColor: '#00D4FF', glowBlur: 6
        });
    }

    // ---- Power-up Buttons ----

    drawPowerUpButtons(ctx) {
        const btnS = this.isMobile ? 38 : 34;
        const btnY = this.shooterY + 20;
        const startX = 8;
        let idx = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx = startX + idx * (btnS + 5);
            const active = this.activePowerUp === key;
            const has = pup.count > 0;

            // Background
            const bgAlpha = active ? 0.35 : (has ? 0.12 : 0.04);
            ctx.fillStyle = active ? (pup.color + '55') : `rgba(185,79,227,${bgAlpha})`;
            this.drawRoundRect(ctx, bx, btnY, btnS, btnS, 8);
            ctx.fill();

            // Border
            ctx.strokeStyle = active ? pup.color : (has ? 'rgba(185,79,227,0.25)' : 'rgba(80,80,80,0.15)');
            ctx.lineWidth = this.dS(active ? 1.5 : 0.5);
            this.drawRoundRect(ctx, bx, btnY, btnS, btnS, 8);
            ctx.stroke();

            // Icon
            ctx.globalAlpha = has ? 1 : 0.25;
            this.drawText(ctx, pup.icon, bx + btnS / 2, btnY + btnS / 2 - 2, {
                size: this.isMobile ? 16 : 14, align: 'center', baseline: 'middle'
            });

            // Count
            if (has) {
                // Badge bg
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                this.drawCircle(ctx, bx + btnS - 4, btnY + btnS - 4, 7);
                ctx.fill();

                this.drawText(ctx, `${pup.count}`, bx + btnS - 4, btnY + btnS - 4, {
                    size: 7, weight: 'bold', color: '#00FF88',
                    align: 'center', baseline: 'middle',
                    family: this.FONT_TITLE
                });
            }

            ctx.globalAlpha = 1;
            idx++;
        }
    }

    // ============================================================
    // OVERLAY SCREENS
    // ============================================================

    drawDailyRewardScreen(ctx, W, H) {
        const a = this.dailyRewardAnim;
        ctx.fillStyle = `rgba(0,0,0,${0.85 * a})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (a < 0.3) return;

        const cw = Math.min(280, W - 36);
        const ch = 260;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        // Card
        this.drawCardBG(ctx, cx, cy, cw, ch, '#FFD700');

        // Title
        this.drawText(ctx, '🎁 Daily Reward!', W / 2, cy + 38, {
            size: 20, weight: 'bold', color: '#FFD700',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FFD700', glowBlur: 8
        });

        // Streak
        this.drawText(ctx, `Day ${this.playerData.dailyStreak + 1} Streak 🔥`, W / 2, cy + 62, {
            size: 12, color: '#00D4FF', align: 'center', family: this.FONT_MONO
        });

        // Rewards
        const streak = this.playerData.dailyStreak;
        const coins = Math.floor(50 * Math.min(1 + streak * 0.25, 3));
        const dias = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));

        this.drawText(ctx, `🪙 ${coins}`, W / 2, cy + 105, {
            size: 26, weight: 'bold', color: '#FFD700', align: 'center'
        });
        this.drawText(ctx, `💎 ${dias}`, W / 2, cy + 140, {
            size: 22, weight: 'bold', color: '#00D4FF', align: 'center'
        });

        if (streak > 0 && streak % 5 === 0) {
            this.drawText(ctx, '+ Bonus Power-up! 🎉', W / 2, cy + 170, {
                size: 11, color: '#00FF88', align: 'center', family: this.FONT_MONO
            });
        }

        // Button
        this.drawBtn(ctx, W / 2, cy + ch - 45, 150, 38, 'CLAIM!', '#B94FE3', '#FF1A6D');
    }

    drawLevelCompleteScreen(ctx, W, H) {
        const prog = Math.min(1, this.levelCompleteTimer / 25);
        const eased = this.easeOutBack(prog);

        ctx.fillStyle = `rgba(0,0,0,${0.8 * prog})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (prog < 0.25) return;

        const cw = Math.min(300, W - 30);
        const ch = 330;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        ctx.save();
        ctx.translate(this.dX(W / 2), this.dY(H / 2));
        ctx.scale(eased, eased);
        ctx.translate(-this.dX(W / 2), -this.dY(H / 2));

        this.drawCardBG(ctx, cx, cy, cw, ch, '#00FF88');

        this.drawText(ctx, 'LEVEL COMPLETE!', W / 2, cy + 36, {
            size: 20, weight: 'bold', color: '#00FF88',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#00FF88', glowBlur: 8
        });

        // Stars
        for (let i = 0; i < 3; i++) {
            const sx = W / 2 + (i - 1) * 40;
            const starProg = Math.max(0, prog - 0.4 - i * 0.1) * 5;
            const sc = Math.min(1, starProg);
            this.drawText(ctx, i < this.starRating ? '⭐' : '☆', sx, cy + 72, {
                size: 28 * sc, align: 'center', baseline: 'middle',
                opacity: i < this.starRating ? 1 : 0.25
            });
        }

        // Stats
        const stats = [
            `Score: ${this.fmtNum(this.score)}`,
            `Popped: ${this.bubblesPopped}`,
            `Combo: x${this.maxCombo}`,
            `Shots: ${this.shotsUsed}`
        ];
        stats.forEach((s, i) => {
            this.drawText(ctx, s, W / 2, cy + 115 + i * 22, {
                size: 11, color: 'rgba(255,255,255,0.65)', align: 'center', family: this.FONT_MONO
            });
        });

        // Rewards
        this.drawText(ctx, `🪙 +${this.levelCoins}`, W / 2, cy + 220, {
            size: 15, weight: 'bold', color: '#FFD700', align: 'center',
            family: this.FONT_TITLE, glow: true, glowColor: '#FFD700', glowBlur: 4
        });
        if (this.levelDiamonds > 0) {
            this.drawText(ctx, `💎 +${this.levelDiamonds}`, W / 2, cy + 245, {
                size: 14, weight: 'bold', color: '#00D4FF', align: 'center',
                family: this.FONT_TITLE, glow: true, glowColor: '#00D4FF', glowBlur: 4
            });
        }

        if (this.levelCompleteTimer > 35) {
            this.drawBtn(ctx, W / 2, cy + ch - 44, 160, 38, 'NEXT LEVEL →', '#00D4FF', '#00FF88');
        }

        ctx.restore();
    }

    drawTransition(ctx, W, H) {
        const prog = 1 - (this.levelTransitionTimer / 50);
        const alpha = prog < 0.5 ? prog * 2 : 2 - prog * 2;
        ctx.fillStyle = `rgba(3,2,10,${alpha})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (prog > 0.3 && prog < 0.7) {
            this.drawText(ctx, `Level ${this.level}`, W / 2, H / 2, {
                size: 22, weight: 'bold', color: '#B94FE3',
                align: 'center', baseline: 'middle',
                family: this.FONT_TITLE,
                glow: true, glowColor: '#B94FE3', glowBlur: 10,
                opacity: 1 - Math.abs(prog - 0.5) * 4
            });
        }
    }

    drawGameOverScreen(ctx, W, H) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const pulse = 1 + Math.sin(this.time / 250) * 0.03;

        this.drawText(ctx, 'GAME OVER', W / 2, H / 2 - 50, {
            size: 28 * pulse, weight: 'bold', color: '#FF1A6D',
            align: 'center', baseline: 'middle',
            family: this.FONT_TITLE,
            glow: true, glowColor: '#FF1A6D', glowBlur: 15
        });

        this.drawText(ctx, `Score: ${this.fmtNum(this.score)}`, W / 2, H / 2 - 5, {
            size: 14, color: 'rgba(255,255,255,0.7)', align: 'center', baseline: 'middle', family: this.FONT_MONO
        });
        this.drawText(ctx, `Level: ${this.level}   |   Combo: x${this.maxCombo}`, W / 2, H / 2 + 22, {
            size: 12, color: 'rgba(255,255,255,0.5)', align: 'center', baseline: 'middle', family: this.FONT_MONO
        });

        this.drawText(ctx, `🪙 ${this.levelCoins} earned`, W / 2, H / 2 + 60, {
            size: 13, weight: 'bold', color: '#FFD700', align: 'center', baseline: 'middle', family: this.FONT_TITLE
        });
        this.drawText(ctx, `💎 ${this.levelDiamonds} earned`, W / 2, H / 2 + 85, {
            size: 13, weight: 'bold', color: '#00D4FF', align: 'center', baseline: 'middle', family: this.FONT_TITLE
        });
    }

    // ============================================================
    // UI HELPERS
    // ============================================================

    drawCardBG(ctx, x, y, w, h, borderColor) {
        // Background
        ctx.fillStyle = 'rgba(8,5,20,0.95)';
        this.drawRoundRect(ctx, x, y, w, h, 14);
        ctx.fill();

        // Border
        ctx.strokeStyle = borderColor + '50';
        ctx.lineWidth = this.dS(1.5);
        this.drawRoundRect(ctx, x, y, w, h, 14);
        ctx.stroke();

        // Top accent line
        const tg = ctx.createLinearGradient(this.dX(x + 20), 0, this.dX(x + w - 20), 0);
        tg.addColorStop(0, 'rgba(0,0,0,0)');
        tg.addColorStop(0.5, borderColor + '40');
        tg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = tg;
        ctx.fillRect(this.dX(x + 20), this.dY(y + 1), this.dS(w - 40), this.dS(2));
    }

    drawBtn(ctx, cx, cy, w, h, text, c1, c2) {
        const bx = cx - w / 2;
        const by = cy - h / 2;

        const grad = ctx.createLinearGradient(this.dX(bx), this.dY(by), this.dX(bx + w), this.dY(by + h));
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        this.drawRoundRect(ctx, bx, by, w, h, h / 2);
        ctx.fill();

        // Shimmer
        const sg = ctx.createLinearGradient(this.dX(bx), this.dY(by), this.dX(bx + w), this.dY(by));
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.48, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        sg.addColorStop(0.52, 'rgba(255,255,255,0)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        this.drawRoundRect(ctx, bx, by, w, h, h / 2);
        ctx.fill();

        this.drawText(ctx, text, cx, cy + 1, {
            size: 13, weight: 'bold', color: '#FFFFFF',
            align: 'center', baseline: 'middle',
            family: this.FONT_TITLE
        });
    }

    drawRoundRect_raw(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
        this.paused = !this.paused;
        this.isPaused = this.paused;
        return this.paused;
    }

    resize() {
        this.setupHDCanvas();
        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile = this.W < 768 || ('ontouchstart' in window);
        this.isSmallScreen = this.W < 380;
        this.COLS = this.isSmallScreen ? 8 : 10;
        this.BUBBLE_R = this.calculateBubbleRadius();
        this.recalcGrid();
        this.shooterX = this.W / 2;
        this.shooterY = this.H - (this.isMobile ? 58 : 65);
        this.stars = this.makeStars(this.isMobile ? 40 : 70);
        this.preRenderAll();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.cache.bubbles.clear();
        this.cache.glows.clear();
        this.cache.ui.clear();
        this.savePlayerData();
    }
}