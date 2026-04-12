/* ============================================================
   BUBBLE SHOOTER v4.0 - ULTRA PREMIUM EDITION
   Professional Grade - Smooth Physics, HD Rendering
   Levels, Coins, Diamonds, Daily Rewards, Power-ups
   ============================================================ */

'use strict';

class BubbleShooter {
    constructor(canvas, onScore, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;
        this.gameOver = false;

        // High DPI support
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.setupHighDPI();

        // Pre-render cache for performance
        this.bubbleCache = new Map();
        this.glowCache = new Map();

        // ============================================
        // CURRENCY & ECONOMY
        // ============================================
        this.saveKey = 'neonarcade_bubbleshooter';
        this.playerData = this.loadPlayerData();

        // ============================================
        // GAME CONFIG
        // ============================================
        this.COLS = 10;
        this.ROWS = 14;
        this.BUBBLE_R = this.calculateBubbleRadius();
        this.COLORS = [
            { hex: '#FF006E', name: 'Pink',    glow: '#FF339B', dark: '#CC0058', light: '#FF4D9A' },
            { hex: '#00D4FF', name: 'Cyan',    glow: '#33DDFF', dark: '#00A8CC', light: '#4DE1FF' },
            { hex: '#00FF88', name: 'Green',   glow: '#33FF9F', dark: '#00CC6D', light: '#4DFFA3' },
            { hex: '#FFD700', name: 'Gold',    glow: '#FFE033', dark: '#CCAC00', light: '#FFE14D' },
            { hex: '#B347D9', name: 'Purple',  glow: '#C76EE3', dark: '#8F39AD', light: '#C76EE3' },
            { hex: '#FF8C00', name: 'Orange',  glow: '#FFA333', dark: '#CC7000', light: '#FFA333' },
            { hex: '#FF3864', name: 'Red',     glow: '#FF5E83', dark: '#CC2D50', light: '#FF5E83' },
            { hex: '#00FFAB', name: 'Mint',    glow: '#33FFBB', dark: '#00CC89', light: '#4DFFBE' }
        ];
        this.colorsInPlay = [];

        // Grid calculations - proper hexagonal
        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * Math.sqrt(3);
        this.offsetX = 0;
        this.offsetY = 60;
        this.recalculateGrid();

        // Shooter
        this.shooterX = canvas.width / 2;
        this.shooterY = canvas.height - 65;
        this.angle = -Math.PI / 2;
        this.targetAngle = -Math.PI / 2;
        this.currentBubble = null;
        this.nextBubble = null;
        this.projectile = null;
        this.projectileSpeed = 16;
        this.canShoot = true;
        this.shootCooldown = 0;

        // Animations
        this.particles = [];
        this.fallingBubbles = [];
        this.aimLine = [];
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.popAnimations = [];
        this.scorePopups = [];
        this.coinPopups = [];
        this.diamondPopups = [];
        this.floatingTexts = [];
        this.ripples = [];
        this.sparkles = [];
        this.trailParticles = [];
        this.impactWaves = [];

        // Smooth animation timing
        this.time = 0;
        this.frameCount = 0;

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

        // Drop row timer
        this.dropTimer = 0;
        this.dropInterval = 30000;
        this.dropWarning = false;
        this.dropAnimating = false;
        this.dropAnimProgress = 0;

        // Power-ups
        this.powerUps = {
            fireball: { count: this.playerData.powerUps?.fireball || 1, active: false, icon: '🔥', name: 'Fire Ball', cost: 50, desc: 'Destroys all bubbles it touches', color: '#FF4500' },
            rainbow: { count: this.playerData.powerUps?.rainbow || 1, active: false, icon: '🌈', name: 'Rainbow', cost: 75, desc: 'Matches any color', color: '#FF00FF' },
            bomb: { count: this.playerData.powerUps?.bomb || 1, active: false, icon: '💣', name: 'Bomb', cost: 100, desc: 'Explodes area around impact', color: '#FF8C00' },
            precision: { count: this.playerData.powerUps?.precision || 2, active: false, icon: '🎯', name: 'Precision', cost: 30, desc: 'Extended aim guide', color: '#00FF88' }
        };
        this.activePowerUp = null;
        this.powerUpTimer = 0;
        this.powerUpGlow = 0;

        // Daily reward
        this.dailyRewardClaimed = false;
        this.showDailyReward = false;
        this.dailyRewardTimer = 0;
        this.checkDailyReward();

        // Background system
        this.bgStars = this.generateStarField(80);
        this.bgNebulas = this.generateNebulas(3);
        this.bgGridLines = [];

        // Coin/Diamond pickup animations
        this.pickupAnimations = [];

        // UI state
        this.showPowerUpMenu = false;
        this.showLevelComplete = false;
        this.levelCompleteTimer = 0;
        this.hudFlash = {};
        this.uiAnimations = {};

        // Shooter rotation animation
        this.shooterRecoil = 0;
        this.shooterGlow = 0;
        this.shooterPulse = 0;

        // Grid bounce animation on snap
        this.gridBounce = {};

        // Initialize
        this.initLevel(this.level);
        this.generateShooter();
        this.preRenderBubbles();

        // Events
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundClick = this.onClick.bind(this);
        this.boundTouch = this.onTouch.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);

        canvas.addEventListener('mousemove', this.boundMouseMove);
        canvas.addEventListener('click', this.boundClick);
        canvas.addEventListener('touchend', this.boundTouch);
        canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        document.addEventListener('keydown', this.boundKeyDown);

        this.lastTime = 0;
        this.deltaAccumulator = 0;
        this.fixedDt = 1000 / 60;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ============================================================
    // HIGH DPI & RENDERING SETUP
    // ============================================================

    setupHighDPI() {
        // Canvas already sized by parent, just ensure crisp rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    calculateBubbleRadius() {
        const maxR = Math.floor((this.canvas.width - 20) / (this.COLS * 2));
        return Math.min(maxR, 20);
    }

    recalculateGrid() {
        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * 1.75;
        const totalWidth = this.COLS * this.cellW;
        this.offsetX = (this.canvas.width - totalWidth) / 2 + this.BUBBLE_R;
    }

    // ============================================================
    // PRE-RENDER BUBBLES FOR PERFORMANCE
    // ============================================================

    preRenderBubbles() {
        this.bubbleCache.clear();
        this.glowCache.clear();

        const sizes = [this.BUBBLE_R, this.BUBBLE_R - 3, this.BUBBLE_R - 6];

        this.COLORS.forEach((colorData, idx) => {
            sizes.forEach(radius => {
                const key = `${idx}_${radius}`;

                // Main bubble
                const bCanvas = document.createElement('canvas');
                const size = (radius + 8) * 2;
                bCanvas.width = size;
                bCanvas.height = size;
                const bCtx = bCanvas.getContext('2d');
                const cx = size / 2;
                const cy = size / 2;

                this.renderBubbleToContext(bCtx, cx, cy, radius, colorData);
                this.bubbleCache.set(key, bCanvas);

                // Glow effect
                const gCanvas = document.createElement('canvas');
                const gSize = (radius + 20) * 2;
                gCanvas.width = gSize;
                gCanvas.height = gSize;
                const gCtx = gCanvas.getContext('2d');
                const gcx = gSize / 2;
                const gcy = gSize / 2;

                const glowGrad = gCtx.createRadialGradient(gcx, gcy, radius * 0.5, gcx, gcy, radius + 15);
                glowGrad.addColorStop(0, colorData.hex + '40');
                glowGrad.addColorStop(0.5, colorData.hex + '15');
                glowGrad.addColorStop(1, 'transparent');
                gCtx.fillStyle = glowGrad;
                gCtx.beginPath();
                gCtx.arc(gcx, gcy, radius + 15, 0, Math.PI * 2);
                gCtx.fill();

                this.glowCache.set(key, gCanvas);
            });
        });

        // Special bubbles
        this.preRenderSpecialBubble('fireball', '#FF4500', '#FF6B35', '🔥');
        this.preRenderSpecialBubble('bomb', '#444444', '#666666', '💣');
    }

    preRenderSpecialBubble(type, mainColor, secondColor, emoji) {
        const bCanvas = document.createElement('canvas');
        const size = (this.BUBBLE_R + 8) * 2;
        bCanvas.width = size;
        bCanvas.height = size;
        const ctx = bCanvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const r = this.BUBBLE_R;

        // Main sphere
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, secondColor);
        grad.addColorStop(0.6, mainColor);
        grad.addColorStop(1, this.darkenHex(mainColor, 60));
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Highlight
        const shine = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.2, cy - r * 0.2, r * 0.5);
        shine.addColorStop(0, 'rgba(255,255,255,0.6)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        this.bubbleCache.set(type, bCanvas);
    }

    renderBubbleToContext(ctx, cx, cy, radius, colorData) {
        const r = radius;

        // Outer glow ring (subtle)
        ctx.shadowBlur = 6;
        ctx.shadowColor = colorData.hex + '80';

        // Main sphere gradient - 3D effect
        const mainGrad = ctx.createRadialGradient(
            cx - r * 0.3, cy - r * 0.35, r * 0.05,
            cx + r * 0.1, cy + r * 0.1, r * 1.1
        );
        mainGrad.addColorStop(0, colorData.light);
        mainGrad.addColorStop(0.3, colorData.hex);
        mainGrad.addColorStop(0.7, colorData.hex);
        mainGrad.addColorStop(1, colorData.dark);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = mainGrad;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner dark edge for depth
        const edgeGrad = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
        edgeGrad.addColorStop(0, 'transparent');
        edgeGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = edgeGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Primary highlight (top-left)
        const highlight1 = ctx.createRadialGradient(
            cx - r * 0.35, cy - r * 0.35, 0,
            cx - r * 0.15, cy - r * 0.15, r * 0.55
        );
        highlight1.addColorStop(0, 'rgba(255,255,255,0.7)');
        highlight1.addColorStop(0.4, 'rgba(255,255,255,0.2)');
        highlight1.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = highlight1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Secondary small highlight (crisp reflection dot)
        const highlight2 = ctx.createRadialGradient(
            cx - r * 0.25, cy - r * 0.3, 0,
            cx - r * 0.25, cy - r * 0.3, r * 0.15
        );
        highlight2.addColorStop(0, 'rgba(255,255,255,0.9)');
        highlight2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = highlight2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Bottom rim light (environment reflection)
        const rimGrad = ctx.createRadialGradient(
            cx + r * 0.2, cy + r * 0.35, 0,
            cx + r * 0.2, cy + r * 0.35, r * 0.35
        );
        rimGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
        rimGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle outline
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // ============================================================
    // BACKGROUND GENERATION
    // ============================================================

    generateStarField(count) {
        return Array.from({ length: count }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            size: Math.random() * 1.8 + 0.2,
            brightness: Math.random(),
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            twinkleOffset: Math.random() * Math.PI * 2,
            color: Math.random() > 0.8 ? '#B347D9' : Math.random() > 0.5 ? '#00D4FF' : '#FFFFFF'
        }));
    }

    generateNebulas(count) {
        return Array.from({ length: count }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height * 0.6,
            radius: Math.random() * 100 + 60,
            color: ['#B347D9', '#FF006E', '#00D4FF'][Math.floor(Math.random() * 3)],
            opacity: Math.random() * 0.03 + 0.01,
            drift: Math.random() * 0.1
        }));
    }

    // ============================================================
    // SAVE / LOAD SYSTEM
    // ============================================================

    loadPlayerData() {
        const defaults = {
            coins: 0,
            diamonds: 0,
            currentLevel: 1,
            highestLevel: 1,
            totalScore: 0,
            totalPopped: 0,
            totalCoinsEarned: 0,
            totalDiamondsEarned: 0,
            dailyStreak: 0,
            lastDailyReward: null,
            lastPlayDate: null,
            levelStars: {},
            powerUps: { fireball: 1, rainbow: 1, bomb: 1, precision: 2 },
            achievements: [],
            gamesPlayed: 0
        };
        try {
            const saved = JSON.parse(localStorage.getItem(this.saveKey));
            if (saved) return { ...defaults, ...saved };
        } catch (e) {}
        return defaults;
    }

    savePlayerData() {
        this.playerData.powerUps = {};
        Object.keys(this.powerUps).forEach(key => {
            this.playerData.powerUps[key] = this.powerUps[key].count;
        });
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.playerData));
        } catch (e) {}
    }

    // ============================================================
    // DAILY REWARD SYSTEM
    // ============================================================

    checkDailyReward() {
        const now = new Date();
        const today = now.toDateString();
        const last = this.playerData.lastDailyReward;

        if (last !== today) {
            if (last) {
                const lastDate = new Date(last);
                const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    this.playerData.dailyStreak++;
                } else if (diffDays > 1) {
                    this.playerData.dailyStreak = 0;
                }
            }
            this.showDailyReward = true;
            this.dailyRewardClaimed = false;
        }
    }

    claimDailyReward() {
        if (this.dailyRewardClaimed) return;

        const streak = this.playerData.dailyStreak;
        const baseCoins = 50;
        const baseDiamonds = 2;

        const streakMultiplier = Math.min(1 + streak * 0.25, 3);
        const coins = Math.floor(baseCoins * streakMultiplier);
        const diamonds = Math.floor(baseDiamonds * Math.max(1, Math.floor(streak / 3)));

        let bonusPowerUp = null;
        if (streak > 0 && streak % 5 === 0) {
            const pups = Object.keys(this.powerUps);
            bonusPowerUp = pups[Math.floor(Math.random() * pups.length)];
            this.powerUps[bonusPowerUp].count++;
        }

        this.playerData.coins += coins;
        this.playerData.diamonds += diamonds;
        this.playerData.totalCoinsEarned += coins;
        this.playerData.totalDiamondsEarned += diamonds;
        this.playerData.lastDailyReward = new Date().toDateString();
        this.playerData.dailyStreak++;

        this.dailyRewardClaimed = true;
        this.showDailyReward = false;
        this.dailyRewardTimer = 180;

        // Celebration particles
        for (let i = 0; i < 20; i++) {
            this.spawnCelebrationParticle(
                this.canvas.width / 2 + (Math.random() - 0.5) * 100,
                this.canvas.height / 2 + (Math.random() - 0.5) * 80
            );
        }

        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 - 40,
            text: `+${coins} 🪙`, color: '#FFD700', life: 120, opacity: 1, size: 24, vy: -1
        });
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 + 10,
            text: `+${diamonds} 💎`, color: '#00D4FF', life: 120, opacity: 1, size: 22, vy: -0.8
        });
        if (bonusPowerUp) {
            this.floatingTexts.push({
                x: this.canvas.width / 2, y: this.canvas.height / 2 + 50,
                text: `+1 ${this.powerUps[bonusPowerUp].icon} ${this.powerUps[bonusPowerUp].name}!`,
                color: '#00FF88', life: 120, opacity: 1, size: 16, vy: -0.6
            });
        }

        if (window.audioManager) audioManager.play('achievement');
        this.savePlayerData();
    }

    // ============================================================
    // LEVEL SYSTEM - 25 Levels
    // ============================================================

    getLevelConfig(level) {
        const configs = {
            1:  { rows: 4, colors: 3, goal: 25,  dropInterval: 45000, name: 'Warm Up', layout: 'standard' },
            2:  { rows: 4, colors: 3, goal: 30,  dropInterval: 42000, name: 'Getting Started', layout: 'standard' },
            3:  { rows: 5, colors: 4, goal: 40,  dropInterval: 40000, name: 'Color Mix', layout: 'standard' },
            4:  { rows: 5, colors: 4, goal: 45,  dropInterval: 38000, name: 'Rising Tide', layout: 'standard' },
            5:  { rows: 6, colors: 4, goal: 55,  dropInterval: 35000, name: '⭐ BOSS: The Wall', layout: 'boss_wall' },
            6:  { rows: 5, colors: 5, goal: 50,  dropInterval: 35000, name: 'Rainbow Rush', layout: 'standard' },
            7:  { rows: 5, colors: 5, goal: 55,  dropInterval: 33000, name: 'Quick Fire', layout: 'zigzag' },
            8:  { rows: 6, colors: 5, goal: 60,  dropInterval: 32000, name: 'Deep Colors', layout: 'standard' },
            9:  { rows: 6, colors: 5, goal: 65,  dropInterval: 30000, name: 'Speed Run', layout: 'diamond' },
            10: { rows: 7, colors: 5, goal: 75,  dropInterval: 28000, name: '⭐ BOSS: The Pyramid', layout: 'boss_pyramid' },
            11: { rows: 6, colors: 6, goal: 70,  dropInterval: 28000, name: 'Hex Mix', layout: 'standard' },
            12: { rows: 6, colors: 6, goal: 75,  dropInterval: 26000, name: 'Cascade', layout: 'checkerboard' },
            13: { rows: 7, colors: 6, goal: 80,  dropInterval: 25000, name: 'Tight Squeeze', layout: 'standard' },
            14: { rows: 7, colors: 6, goal: 85,  dropInterval: 24000, name: 'Color Storm', layout: 'zigzag' },
            15: { rows: 7, colors: 6, goal: 90,  dropInterval: 22000, name: '⭐ BOSS: The Cross', layout: 'boss_cross' },
            16: { rows: 7, colors: 7, goal: 85,  dropInterval: 22000, name: 'Spectrum', layout: 'standard' },
            17: { rows: 7, colors: 7, goal: 90,  dropInterval: 20000, name: 'Maze Runner', layout: 'maze' },
            18: { rows: 8, colors: 7, goal: 95,  dropInterval: 20000, name: 'Dense Pack', layout: 'standard' },
            19: { rows: 8, colors: 7, goal: 100, dropInterval: 18000, name: 'Pressure', layout: 'diamond' },
            20: { rows: 8, colors: 7, goal: 110, dropInterval: 16000, name: '⭐ BOSS: The Spiral', layout: 'boss_spiral' },
            21: { rows: 8, colors: 8, goal: 100, dropInterval: 16000, name: 'Octachrome', layout: 'standard' },
            22: { rows: 8, colors: 8, goal: 110, dropInterval: 15000, name: 'Blitz', layout: 'checkerboard' },
            23: { rows: 9, colors: 8, goal: 120, dropInterval: 14000, name: 'Endurance', layout: 'zigzag' },
            24: { rows: 9, colors: 8, goal: 130, dropInterval: 12000, name: 'Nightmare', layout: 'maze' },
            25: { rows: 10, colors: 8, goal: 150, dropInterval: 10000, name: '⭐ FINAL BOSS', layout: 'boss_final' }
        };

        if (configs[level]) return configs[level];

        return {
            rows: Math.min(10, 6 + Math.floor(level / 5)),
            colors: Math.min(8, 3 + Math.floor(level / 3)),
            goal: 50 + level * 10,
            dropInterval: Math.max(8000, 30000 - level * 800),
            name: `Endless ${level}`,
            layout: ['standard', 'zigzag', 'diamond', 'checkerboard', 'maze'][level % 5]
        };
    }

    initLevel(level) {
        this.levelConfig = this.getLevelConfig(level);
        this.ROWS = Math.max(12, this.levelConfig.rows + 5);
        this.dropInterval = this.levelConfig.dropInterval;
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
        this.gridBounce = {};
        this.totalBubbles = 0;

        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = null;
            }
        }

        this.generateLayout(this.levelConfig);
        this.updateColorsInPlay();

        // Clear old animations
        this.particles = [];
        this.fallingBubbles = [];
        this.popAnimations = [];
        this.scorePopups = [];
        this.ripples = [];
        this.sparkles = [];
        this.impactWaves = [];

        // Level intro animations
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 - 40,
            text: `Level ${level}`, color: '#B347D9', life: 140, opacity: 1, size: 30, vy: -0.5,
            scale: 0, targetScale: 1
        });
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 + 5,
            text: this.levelConfig.name, color: '#00D4FF', life: 130, opacity: 1, size: 18, vy: -0.3
        });
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 + 40,
            text: `Pop ${this.levelGoal} bubbles`, color: 'rgba(255,255,255,0.7)', life: 120, opacity: 1, size: 13, vy: -0.2
        });
    }

    generateLayout(config) {
        const numColors = config.colors;
        const fillRows = config.rows;

        switch (config.layout) {
            case 'zigzag': this.layoutZigzag(fillRows, numColors); break;
            case 'diamond': this.layoutDiamond(fillRows, numColors); break;
            case 'checkerboard': this.layoutCheckerboard(fillRows, numColors); break;
            case 'maze': this.layoutMaze(fillRows, numColors); break;
            case 'boss_wall': this.layoutBossWall(numColors); break;
            case 'boss_pyramid': this.layoutBossPyramid(numColors); break;
            case 'boss_cross': this.layoutBossCross(numColors); break;
            case 'boss_spiral': this.layoutBossSpiral(numColors); break;
            case 'boss_final': this.layoutBossFinal(numColors); break;
            default: this.layoutStandard(fillRows, numColors);
        }
    }

    layoutStandard(rows, numColors) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
            }
        }
    }

    layoutZigzag(rows, numColors) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if ((r + c) % 2 === 0) {
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
                }
            }
        }
    }

    layoutDiamond(rows, numColors) {
        const centerC = Math.floor(this.COLS / 2);
        for (let r = 0; r < rows; r++) {
            const half = Math.min(r, rows - 1 - r);
            for (let c = centerC - half; c <= centerC + half; c++) {
                if (c >= 0 && c < this.COLS) {
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
                }
            }
        }
    }

    layoutCheckerboard(rows, numColors) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = this.createBubble((r + c) % numColors);
            }
        }
    }

    layoutMaze(rows, numColors) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (r % 2 === 0 || c % 3 === 0) {
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
                }
            }
        }
    }

    layoutBossWall(numColors) {
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = this.createBubble(r % numColors);
            }
        }
    }

    layoutBossPyramid(numColors) {
        for (let r = 0; r < 7; r++) {
            const start = Math.max(0, Math.floor(r / 2));
            const end = Math.min(this.COLS, this.COLS - Math.floor(r / 2));
            for (let c = start; c < end; c++) {
                this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
            }
        }
    }

    layoutBossCross(numColors) {
        const mid = Math.floor(this.COLS / 2);
        for (let r = 0; r < 7; r++) {
            if (r === 3) {
                for (let c = 0; c < this.COLS; c++) {
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
                }
            }
            for (let c = mid - 1; c <= mid + 1; c++) {
                if (c >= 0 && c < this.COLS) {
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
                }
            }
        }
    }

    layoutBossSpiral(numColors) {
        const cx = Math.floor(this.COLS / 2);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const dx = c - cx;
                const angle = Math.atan2(r, dx);
                const dist = Math.sqrt(dx * dx + r * r);
                if (dist < 6 && (Math.floor(angle * 3 + dist) % 2 === 0)) {
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
                }
            }
        }
    }

    layoutBossFinal(numColors) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
            }
        }
        for (let r = 0; r < 3; r++) {
            const color = Math.floor(Math.random() * numColors);
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = this.createBubble(color);
            }
        }
    }

    createBubble(colorIdx) {
        this.totalBubbles++;
        return {
            color: this.COLORS[colorIdx].hex,
            colorIdx,
            popping: false,
            newlyAdded: false,
            scale: 1,
            flash: 0,
            wobble: 0,
            wobbleSpeed: 0,
            offsetY: 0,
            breathe: Math.random() * Math.PI * 2
        };
    }

    // ============================================================
    // COIN & DIAMOND EARN LOGIC
    // ============================================================

    earnCoins(amount, x, y) {
        this.playerData.coins += amount;
        this.playerData.totalCoinsEarned += amount;
        this.levelCoins += amount;

        this.coinPopups.push({
            x, y, text: `+${amount} 🪙`,
            color: '#FFD700', life: 90, opacity: 1, vy: -1.8, vx: (Math.random() - 0.5) * 0.5
        });

        this.hudFlash.coins = 20;

        // Sparkle at coin location
        for (let i = 0; i < 3; i++) {
            this.sparkles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                size: Math.random() * 3 + 1,
                life: 1, decay: 0.04,
                color: '#FFD700',
                rotation: Math.random() * Math.PI * 2
            });
        }
    }

    earnDiamonds(amount, x, y) {
        this.playerData.diamonds += amount;
        this.playerData.totalDiamondsEarned += amount;
        this.levelDiamonds += amount;

        this.diamondPopups.push({
            x, y, text: `+${amount} 💎`,
            color: '#00D4FF', life: 110, opacity: 1, vy: -1.2, vx: (Math.random() - 0.5) * 0.3
        });

        this.hudFlash.diamonds = 20;

        // Diamond sparkle burst
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            this.sparkles.push({
                x: x + Math.cos(angle) * 15,
                y: y + Math.sin(angle) * 15,
                size: Math.random() * 4 + 2,
                life: 1, decay: 0.03,
                color: '#00D4FF',
                rotation: Math.random() * Math.PI * 2
            });
        }

        if (window.audioManager) audioManager.play('achievement');
    }

    // ============================================================
    // POWER-UP SYSTEM
    // ============================================================

    activatePowerUp(type) {
        if (!this.powerUps[type] || this.powerUps[type].count <= 0) return;
        if (this.activePowerUp) {
            // Deactivate current
            this.activePowerUp = null;
        }

        this.powerUps[type].count--;
        this.activePowerUp = type;
        this.powerUpTimer = 0;
        this.powerUpGlow = 1;

        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2,
            text: `${this.powerUps[type].icon} ${this.powerUps[type].name}!`,
            color: this.powerUps[type].color, life: 80, opacity: 1, size: 20, vy: -1
        });

        // Power-up activation particles
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            this.particles.push({
                x: this.shooterX, y: this.shooterY,
                vx: Math.cos(angle) * 4,
                vy: Math.sin(angle) * 4,
                color: this.powerUps[type].color,
                size: Math.random() * 4 + 2,
                life: 1, decay: 0.03, gravity: 0
            });
        }

        if (window.audioManager) audioManager.play('powerUp');
        this.savePlayerData();
    }

    buyPowerUp(type) {
        const cost = this.powerUps[type].cost;
        if (this.playerData.coins >= cost) {
            this.playerData.coins -= cost;
            this.powerUps[type].count++;
            this.savePlayerData();
            return true;
        }
        return false;
    }

    // ============================================================
    // INPUT HANDLERS
    // ============================================================

    onMouseMove(e) {
        if (this.paused || this.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * sx;
        const my = (e.clientY - rect.top) * sy;
        this.updateAngle(mx, my);
    }

    onTouchMove(e) {
        e.preventDefault();
        if (this.paused || this.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        const mx = (e.touches[0].clientX - rect.left) * sx;
        const my = (e.touches[0].clientY - rect.top) * sy;
        this.updateAngle(mx, my);
    }

    onTouch(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        const mx = (e.changedTouches[0].clientX - rect.left) * sx;
        const my = (e.changedTouches[0].clientY - rect.top) * sy;

        if (this.handleUITouch(mx, my)) return;

        this.updateAngle(mx, my);
        this.onClick();
    }

    onClick(e) {
        if (this.showDailyReward) {
            this.claimDailyReward();
            return;
        }
        if (this.showLevelComplete) {
            this.nextLevel();
            return;
        }

        if (e) {
            const rect = this.canvas.getBoundingClientRect();
            const sx = this.canvas.width / rect.width;
            const sy = this.canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * sx;
            const my = (e.clientY - rect.top) * sy;
            if (this.handleUITouch(mx, my)) return;
        }

        if (this.paused || this.gameOver || !this.canShoot || this.projectile) return;
        if (this.levelComplete || this.levelTransition) return;
        if (this.shootCooldown > 0) return;
        this.shoot();
    }

    onKeyDown(e) {
        if (this.destroyed) return;
        switch (e.key) {
            case '1': this.activatePowerUp('fireball'); break;
            case '2': this.activatePowerUp('rainbow'); break;
            case '3': this.activatePowerUp('bomb'); break;
            case '4': this.activatePowerUp('precision'); break;
            case ' ':
                e.preventDefault();
                this.onClick();
                break;
        }
    }

    handleUITouch(mx, my) {
        const btnSize = 36;
        const btnY = this.shooterY + 22;
        const startX = 10;
        let idx = 0;
        for (const [key] of Object.entries(this.powerUps)) {
            const bx = startX + idx * (btnSize + 6);
            if (mx >= bx && mx <= bx + btnSize && my >= btnY && my <= btnY + btnSize) {
                this.activatePowerUp(key);
                return true;
            }
            idx++;
        }
        return false;
    }

    updateAngle(mx, my) {
        let angle = Math.atan2(my - this.shooterY, mx - this.shooterX);
        angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, angle));
        this.targetAngle = angle;
        this.calculateAimLine();
    }

    // ============================================================
    // AIM LINE (Smooth with reflection physics)
    // ============================================================

    calculateAimLine() {
        this.aimLine = [];
        let x = this.shooterX;
        let y = this.shooterY;
        let vx = Math.cos(this.targetAngle);
        let vy = Math.sin(this.targetAngle);
        let bounces = 0;
        const maxBounces = this.activePowerUp === 'precision' ? 5 : 2;
        const steps = this.activePowerUp === 'precision' ? 60 : 35;
        const stepSize = 12;

        for (let i = 0; i < steps; i++) {
            x += vx * stepSize;
            y += vy * stepSize;

            // Wall reflection
            if (x <= this.BUBBLE_R) {
                x = this.BUBBLE_R;
                vx *= -1;
                bounces++;
                // Add reflection marker
                this.aimLine.push({ x, y, t: i / steps, reflect: true });
                if (bounces >= maxBounces) break;
                continue;
            }
            if (x >= this.canvas.width - this.BUBBLE_R) {
                x = this.canvas.width - this.BUBBLE_R;
                vx *= -1;
                bounces++;
                this.aimLine.push({ x, y, t: i / steps, reflect: true });
                if (bounces >= maxBounces) break;
                continue;
            }

            if (y <= this.offsetY) break;
            if (y > this.shooterY + 20) break;

            // Check collision with grid bubbles
            let hitGrid = false;
            for (let r = 0; r < this.ROWS && !hitGrid; r++) {
                for (let c = 0; c < this.COLS && !hitGrid; c++) {
                    if (!this.grid[r]?.[c]) continue;
                    const pos = this.getBubblePos(r, c);
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    if (Math.sqrt(dx * dx + dy * dy) < this.BUBBLE_R * 1.9) {
                        hitGrid = true;
                    }
                }
            }
            if (hitGrid) {
                this.aimLine.push({ x, y, t: i / steps, end: true });
                break;
            }

            this.aimLine.push({ x, y, t: i / steps });
        }
    }

    // ============================================================
    // SHOOT
    // ============================================================

    shoot() {
        this.canShoot = false;
        this.shotsUsed++;
        this.shootCooldown = 8;

        const isFireball = this.activePowerUp === 'fireball';
        const isRainbow = this.activePowerUp === 'rainbow';
        const isBomb = this.activePowerUp === 'bomb';

        this.projectile = {
            x: this.shooterX,
            y: this.shooterY,
            vx: Math.cos(this.angle) * this.projectileSpeed,
            vy: Math.sin(this.angle) * this.projectileSpeed,
            color: isRainbow ? '#FFFFFF' : this.currentBubble.color,
            colorIdx: isRainbow ? -1 : this.currentBubble.colorIdx,
            trail: [],
            isFireball,
            isRainbow,
            isBomb,
            fireballHits: 0,
            age: 0
        };

        // Shooter recoil
        this.shooterRecoil = 8;
        this.shooterGlow = 1;

        // Muzzle flash particles
        for (let i = 0; i < 6; i++) {
            const spread = (Math.random() - 0.5) * 0.5;
            this.particles.push({
                x: this.shooterX + Math.cos(this.angle) * 30,
                y: this.shooterY + Math.sin(this.angle) * 30,
                vx: Math.cos(this.angle + spread) * (Math.random() * 3 + 1),
                vy: Math.sin(this.angle + spread) * (Math.random() * 3 + 1),
                color: isFireball ? '#FF4500' : this.currentBubble.color,
                size: Math.random() * 3 + 1,
                life: 1, decay: 0.06, gravity: 0
            });
        }

        if (this.activePowerUp) {
            this.activePowerUp = null;
        }

        if (window.audioManager) audioManager.play('shoot');
        this.generateShooter();
    }

    // ============================================================
    // UPDATE LOOP
    // ============================================================

    update(dt) {
        if (this.paused || this.gameOver) return;

        this.time += dt;
        this.frameCount++;

        if (this.dailyRewardTimer > 0) this.dailyRewardTimer--;
        if (this.shootCooldown > 0) this.shootCooldown--;

        if (this.showLevelComplete) {
            this.levelCompleteTimer++;
            this.updateParticleSystems();
            return;
        }

        if (this.levelTransition) {
            this.levelTransitionTimer--;
            if (this.levelTransitionTimer <= 0) {
                this.levelTransition = false;
                this.initLevel(this.level);
                this.generateShooter();
            }
            return;
        }

        // Smooth angle interpolation
        const angleDiff = this.targetAngle - this.angle;
        this.angle += angleDiff * 0.3;

        // Shooter animations
        if (this.shooterRecoil > 0) this.shooterRecoil *= 0.85;
        if (this.shooterGlow > 0) this.shooterGlow *= 0.92;
        this.shooterPulse = Math.sin(this.time / 600) * 0.15;

        // Power-up glow
        if (this.powerUpGlow > 0) this.powerUpGlow *= 0.95;

        // Stars twinkle
        this.bgStars.forEach(s => {
            s.brightness = (Math.sin(this.time / 1000 * s.twinkleSpeed * 60 + s.twinkleOffset) + 1) / 2;
        });

        // Shake
        if (this.shakeTimer > 0) {
            const intensity = this.shakeIntensity * (this.shakeTimer / 15);
            this.shakeX = (Math.random() - 0.5) * intensity;
            this.shakeY = (Math.random() - 0.5) * intensity * 0.5;
            this.shakeTimer--;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        // HUD flash
        Object.keys(this.hudFlash).forEach(k => {
            if (this.hudFlash[k] > 0) this.hudFlash[k]--;
        });

        // Projectile
        if (this.projectile) {
            this.updateProjectile();
        }

        // Update all particle systems
        this.updateParticleSystems();

        // Grid bubble animations
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;

                // Newly added scale-in animation
                if (b.newlyAdded) {
                    b.scale += (1 - b.scale) * 0.15;
                    if (b.scale > 0.98) {
                        b.scale = 1;
                        b.newlyAdded = false;
                    }
                }

                // Flash decay
                if (b.flash > 0) b.flash -= 0.5;

                // Wobble decay
                if (b.wobble !== 0) {
                    b.wobble *= 0.9;
                    if (Math.abs(b.wobble) < 0.01) b.wobble = 0;
                }

                // Breathing animation
                b.breathe += 0.02;

                // Grid bounce
                const bounceKey = `${r},${c}`;
                if (this.gridBounce[bounceKey]) {
                    this.gridBounce[bounceKey] *= 0.88;
                    if (Math.abs(this.gridBounce[bounceKey]) < 0.1) {
                        delete this.gridBounce[bounceKey];
                    }
                }
            }
        }

        // Drop row timer
        this.dropTimer += dt;
        if (this.dropTimer >= this.dropInterval) {
            this.dropTimer = 0;
            this.dropRow();
        }
        this.dropWarning = (this.dropInterval - this.dropTimer) < 5000;

        // Level progress
        this.levelProgress = Math.min(1, this.bubblesPopped / this.levelGoal);

        // Check level complete
        if (this.bubblesPopped >= this.levelGoal && !this.levelComplete) {
            this.completeLevel();
        }

        // Check grid clear bonus
        const remaining = this.grid.flat().filter(Boolean).length;
        if (remaining === 0 && !this.levelComplete && this.totalBubbles > 0) {
            this.earnCoins(100, this.canvas.width / 2, this.canvas.height / 2);
            this.earnDiamonds(3, this.canvas.width / 2, this.canvas.height / 2 + 30);
            this.completeLevel();
        }

        // Check game over
        this.checkGameOver();
    }

    updateParticleSystems() {
        // Main particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += (p.gravity || 0.12);
            p.life -= (p.decay || 0.03);
            p.vx *= 0.98;
            p.size *= 0.995;
            return p.life > 0;
        });

        // Falling bubbles with proper physics
        this.fallingBubbles = this.fallingBubbles.filter(b => {
            b.vy += 0.5;
            b.y += b.vy;
            b.x += b.vx;
            b.vx *= 0.99;
            b.rotation += b.rotSpeed;
            b.scale *= 0.995;
            b.life -= 1.5;
            return b.life > 0 && b.y < this.canvas.height + 50;
        });

        // Pop ring animations
        this.popAnimations = this.popAnimations.filter(p => {
            p.scale += 0.12;
            p.opacity -= 0.045;
            p.lineWidth = Math.max(0.5, 3 * p.opacity);
            return p.opacity > 0;
        });

        // Score popups with easing
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2;
            p.life -= 1.5;
            p.opacity = this.easeOutCubic(Math.max(0, p.life / 70));
            if (p.scale !== undefined) {
                p.scale += (1 - p.scale) * 0.1;
            }
            return p.life > 0;
        });

        // Coin popups
        this.coinPopups = this.coinPopups.filter(p => {
            p.y += p.vy;
            p.x += (p.vx || 0);
            p.life -= 1.5;
            p.opacity = Math.min(1, p.life / 40);
            return p.life > 0;
        });

        // Diamond popups
        this.diamondPopups = this.diamondPopups.filter(p => {
            p.y += p.vy;
            p.x += (p.vx || 0);
            p.life -= 1.2;
            p.opacity = Math.min(1, p.life / 50);
            return p.life > 0;
        });

        // Floating texts
        this.floatingTexts = this.floatingTexts.filter(t => {
            t.y += (t.vy || -0.8);
            t.life -= 1;
            t.opacity = Math.min(1, t.life / 40);
            if (t.targetScale !== undefined) {
                t.scale = t.scale || 0;
                t.scale += (t.targetScale - t.scale) * 0.1;
            }
            return t.life > 0;
        });

        // Ripples
        this.ripples = this.ripples.filter(r => {
            r.radius += r.speed;
            r.opacity -= r.decay;
            return r.opacity > 0;
        });

        // Sparkles
        this.sparkles = this.sparkles.filter(s => {
            s.life -= s.decay;
            s.rotation += 0.1;
            return s.life > 0;
        });

        // Impact waves
        this.impactWaves = this.impactWaves.filter(w => {
            w.radius += w.speed;
            w.opacity -= 0.03;
            return w.opacity > 0;
        });
    }

    updateProjectile() {
        const p = this.projectile;
        if (!p) return;

        p.age++;

        // Store trail positions
        p.trail.push({ x: p.x, y: p.y, age: 0 });
        if (p.trail.length > 12) p.trail.shift();
        p.trail.forEach(t => t.age++);

        p.x += p.vx;
        p.y += p.vy;

        // Wall bounce with slight speed preservation
        if (p.x <= this.BUBBLE_R) {
            p.x = this.BUBBLE_R;
            p.vx *= -1;
            this.spawnWallBounceParticles(p.x, p.y, p.color);
        }
        if (p.x >= this.canvas.width - this.BUBBLE_R) {
            p.x = this.canvas.width - this.BUBBLE_R;
            p.vx *= -1;
            this.spawnWallBounceParticles(p.x, p.y, p.color);
        }

        // Top wall
        if (p.y <= this.BUBBLE_R + this.offsetY) {
            if (p.isFireball) {
                this.projectile = null;
                this.canShoot = true;
                return;
            }
            this.snapBubble();
            return;
        }

        // Bottom out
        if (p.y > this.canvas.height + 20) {
            this.projectile = null;
            this.canShoot = true;
            return;
        }

        // Fireball collision
        if (p.isFireball) {
            this.checkFireballCollision();
            return;
        }

        // Normal grid collision
        this.checkGridCollision();
    }

    spawnWallBounceParticles(x, y, color) {
        for (let i = 0; i < 4; i++) {
            this.particles.push({
                x, y,
                vx: (x < this.canvas.width / 2 ? 1 : -1) * Math.random() * 2,
                vy: (Math.random() - 0.5) * 3,
                color: '#FFFFFF',
                size: Math.random() * 2 + 0.5,
                life: 1, decay: 0.06, gravity: 0
            });
        }
    }

    checkFireballCollision() {
        const p = this.projectile;
        if (!p) return;

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.grid[r]?.[c]) continue;
                const pos = this.getBubblePos(r, c);
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                if (Math.sqrt(dx * dx + dy * dy) < this.BUBBLE_R * 1.9) {
                    const color = this.grid[r][c].color;
                    this.spawnPopParticles(pos.x, pos.y, color, 10, true);
                    this.popAnimations.push({ x: pos.x, y: pos.y, color, scale: 0.5, opacity: 1 });
                    this.grid[r][c] = null;
                    this.bubblesPopped++;
                    p.fireballHits++;
                    this.score += 10;
                    this.earnCoins(2, pos.x, pos.y);
                    this.onScore(this.score);
                }
            }
        }

        if (p.fireballHits > 15) {
            this.projectile = null;
            this.canShoot = true;
            this.dropFloatingBubbles();
        }
    }

    checkGridCollision() {
        if (!this.projectile) return;
        const p = this.projectile;

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.grid[r]?.[c]) continue;
                const pos = this.getBubblePos(r, c);
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.BUBBLE_R * 1.85) {
                    this.snapBubble();
                    return;
                }
            }
        }
    }

    // ============================================================
    // SNAP & MATCH
    // ============================================================

    snapBubble() {
        if (!this.projectile) return;
        const p = this.projectile;

        let bestR = -1, bestC = -1, bestDist = Infinity;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) continue;
                const pos = this.getBubblePos(r, c);
                const dx = p.x - pos.x;
                const dy = p.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist && dist < this.BUBBLE_R * 3.5) {
                    bestDist = dist;
                    bestR = r;
                    bestC = c;
                }
            }
        }

        if (bestR === -1) {
            const c = Math.round((p.x - this.offsetX) / this.cellW);
            bestR = 0;
            bestC = Math.max(0, Math.min(this.COLS - 1, c));
        }

        if (bestR !== -1 && bestC !== -1) {
            // Impact effect
            const impactPos = this.getBubblePos(bestR, bestC);
            this.impactWaves.push({
                x: impactPos.x, y: impactPos.y,
                radius: 5, speed: 3,
                opacity: 0.6, color: p.color
            });

            // Bomb
            if (p.isBomb) {
                this.explodeBomb(bestR, bestC);
                this.projectile = null;
                this.canShoot = true;
                return;
            }

            // Rainbow color detection
            let snapColorIdx = p.colorIdx;
            if (p.isRainbow) {
                const neighbors = this.getNeighbors(bestR, bestC);
                const colorCounts = {};
                for (const [nr, nc] of neighbors) {
                    if (this.grid[nr]?.[nc]) {
                        const ci = this.grid[nr][nc].colorIdx;
                        colorCounts[ci] = (colorCounts[ci] || 0) + 1;
                    }
                }
                const best = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
                if (best) snapColorIdx = parseInt(best[0]);
                else snapColorIdx = 0;
            }

            this.grid[bestR][bestC] = {
                color: this.COLORS[snapColorIdx]?.hex || p.color,
                colorIdx: snapColorIdx,
                popping: false,
                newlyAdded: true,
                scale: 0.2,
                flash: 8,
                wobble: 0.15,
                wobbleSpeed: 0,
                offsetY: 0,
                breathe: Math.random() * Math.PI * 2
            };

            // Wobble neighbors on impact
            const neighbors = this.getNeighbors(bestR, bestC);
            for (const [nr, nc] of neighbors) {
                if (this.grid[nr]?.[nc]) {
                    this.grid[nr][nc].wobble = 0.08;
                    this.gridBounce[`${nr},${nc}`] = 3;
                }
            }

            const matches = this.findMatches(bestR, bestC);
            if (matches.length >= 3) {
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this.popBubbles(matches, bestR, bestC);
            } else {
                this.combo = 0;
                if (window.audioManager) audioManager.play('pop');
            }

            setTimeout(() => this.dropFloatingBubbles(), 120);
        }

        this.projectile = null;
        this.canShoot = true;
        this.updateColorsInPlay();
    }

    explodeBomb(r, c) {
        const radius = 2.5;
        let destroyed = 0;

        // Explosion impact wave
        const pos = this.getBubblePos(r, c);
        this.impactWaves.push({
            x: pos.x, y: pos.y,
            radius: 10, speed: 5,
            opacity: 0.8, color: '#FF8C00'
        });
        this.impactWaves.push({
            x: pos.x, y: pos.y,
            radius: 5, speed: 3,
            opacity: 0.5, color: '#FFD700'
        });

        for (let dr = -3; dr <= 3; dr++) {
            for (let dc = -3; dc <= 3; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= this.ROWS || nc < 0 || nc >= this.COLS) continue;
                if (!this.grid[nr]?.[nc]) continue;

                const dist = Math.sqrt(dr * dr + dc * dc);
                if (dist <= radius) {
                    const bPos = this.getBubblePos(nr, nc);
                    this.spawnPopParticles(bPos.x, bPos.y, this.grid[nr][nc].color, 8, true);
                    this.popAnimations.push({ x: bPos.x, y: bPos.y, color: this.grid[nr][nc].color, scale: 0.5, opacity: 1 });
                    this.grid[nr][nc] = null;
                    destroyed++;
                }
            }
        }

        this.bubblesPopped += destroyed;
        const bombScore = destroyed * 15;
        this.score += bombScore;
        this.onScore(this.score);

        this.earnCoins(destroyed * 3, pos.x, pos.y);

        this.shakeTimer = 15;
        this.shakeIntensity = 10;

        this.scorePopups.push({
            x: pos.x, y: pos.y - 20,
            text: `💣 BOOM! +${bombScore}`,
            color: '#FF8C00', life: 90, opacity: 1, scale: 0.5
        });

        if (window.audioManager) audioManager.play('levelUp');

        setTimeout(() => this.dropFloatingBubbles(), 150);
    }

    // ============================================================
    // MATCH FINDING (BFS)
    // ============================================================

    findMatches(startR, startC) {
        if (!this.grid[startR]?.[startC]) return [];
        const target = this.grid[startR][startC].colorIdx;
        const visited = new Set();
        const matches = [];
        const queue = [[startR, startC]];

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            if (visited.has(key)) continue;
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) continue;
            if (!this.grid[r]?.[c]) continue;
            if (this.grid[r][c].colorIdx !== target) continue;

            visited.add(key);
            matches.push([r, c]);

            for (const [nr, nc] of this.getNeighbors(r, c)) {
                queue.push([nr, nc]);
            }
        }
        return matches;
    }

    getNeighbors(r, c) {
        const isOdd = r % 2 === 1;
        return isOdd
            ? [[r-1,c],[r-1,c+1],[r,c-1],[r,c+1],[r+1,c],[r+1,c+1]]
            : [[r-1,c-1],[r-1,c],[r,c-1],[r,c+1],[r+1,c-1],[r+1,c]];
    }

    getBubblePos(r, c) {
        const offsetX = r % 2 === 1 ? this.BUBBLE_R : 0;
        return {
            x: this.offsetX + c * this.cellW + offsetX,
            y: this.offsetY + r * this.cellH
        };
    }

    updateColorsInPlay() {
        const used = new Set();
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) used.add(this.grid[r][c].colorIdx);
            }
        }
        this.colorsInPlay = [...used];
        if (this.colorsInPlay.length === 0) {
            this.colorsInPlay = Array.from({ length: Math.min(3, this.levelConfig?.colors || 3) }, (_, i) => i);
        }
    }

    generateShooter() {
        this.currentBubble = this.nextBubble || this.randomBubble();
        this.nextBubble = this.randomBubble();
    }

    randomBubble() {
        const pool = this.colorsInPlay.length > 0 ? this.colorsInPlay : [0, 1, 2];
        const colorIdx = pool[Math.floor(Math.random() * pool.length)];
        return { color: this.COLORS[colorIdx].hex, colorIdx };
    }

    // ============================================================
    // POP & DROP
    // ============================================================

    popBubbles(matches, originR, originC) {
        const comboMult = Math.min(this.combo, 10);
        const baseScore = matches.length * 10;
        const comboScore = baseScore * comboMult;
        this.score += comboScore;
        this.bubblesPopped += matches.length;

        const coinReward = Math.floor(matches.length * (1 + comboMult * 0.5));
        const originPos = this.getBubblePos(originR, originC);
        this.earnCoins(coinReward, originPos.x, originPos.y);

        if (comboMult >= 3 || (matches.length >= 5 && Math.random() < 0.3)) {
            const diamondAmount = comboMult >= 5 ? 2 : 1;
            this.earnDiamonds(diamondAmount, originPos.x, originPos.y - 25);
        }

        // Staggered pop for dramatic effect
        matches.forEach(([r, c], index) => {
            setTimeout(() => {
                if (this.destroyed) return;
                const pos = this.getBubblePos(r, c);
                const color = this.grid[r]?.[c]?.color || '#FFFFFF';
                this.popAnimations.push({ x: pos.x, y: pos.y, color, scale: 0.3, opacity: 1 });
                this.spawnPopParticles(pos.x, pos.y, color, 12, comboMult > 2);
                if (this.grid[r]) this.grid[r][c] = null;
            }, index * 30);
        });

        // Score popup
        const popupText = comboMult > 1 ? `x${comboMult} COMBO! +${comboScore}` : `+${comboScore}`;
        this.scorePopups.push({
            x: originPos.x, y: originPos.y - 15,
            text: popupText,
            color: comboMult > 2 ? '#FFD700' : '#00FF88',
            life: 80, opacity: 1, scale: 0.3
        });

        this.onScore(this.score);
        this.shakeTimer = comboMult > 2 ? 12 : 5;
        this.shakeIntensity = comboMult > 2 ? 8 : 4;

        if (window.audioManager) {
            if (this.combo >= 3) audioManager.play('levelUp');
            else audioManager.play('success');
        }
    }

    dropFloatingBubbles() {
        const connected = new Set();
        const queue = [];

        // All bubbles connected to top row
        for (let c = 0; c < this.COLS; c++) {
            if (this.grid[0]?.[c]) queue.push([0, c]);
        }

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            if (connected.has(key)) continue;
            if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) continue;
            if (!this.grid[r]?.[c]) continue;
            connected.add(key);
            for (const [nr, nc] of this.getNeighbors(r, c)) queue.push([nr, nc]);
        }

        let dropped = 0;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c] && !connected.has(`${r},${c}`)) {
                    const pos = this.getBubblePos(r, c);
                    this.fallingBubbles.push({
                        x: pos.x, y: pos.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -Math.random() * 4 - 2,
                        color: this.grid[r][c].color,
                        colorIdx: this.grid[r][c].colorIdx,
                        rotation: 0,
                        rotSpeed: (Math.random() - 0.5) * 0.3,
                        life: 90,
                        r: this.BUBBLE_R,
                        scale: 1
                    });
                    this.grid[r][c] = null;
                    dropped++;
                    this.bubblesPopped++;
                }
            }
        }

        if (dropped > 0) {
            const bonus = dropped * 15;
            this.score += bonus;
            this.earnCoins(dropped * 2, this.canvas.width / 2, this.canvas.height / 2);
            this.onScore(this.score);
            if (window.audioManager) audioManager.play('levelUp');
            this.scorePopups.push({
                x: this.canvas.width / 2, y: this.canvas.height / 2,
                text: `${dropped} Dropped! +${bonus}`,
                color: '#FF8C00', life: 80, opacity: 1, scale: 0.5
            });
        }
    }

    dropRow() {
        // Shift grid down
        for (let r = this.ROWS - 1; r > 0; r--) {
            this.grid[r] = this.grid[r - 1] ? [...this.grid[r - 1]] : [];
        }

        // New row at top
        this.grid[0] = [];
        const numColors = this.levelConfig?.colors || 4;
        for (let c = 0; c < this.COLS; c++) {
            const bubble = this.createBubble(Math.floor(Math.random() * numColors));
            bubble.newlyAdded = true;
            bubble.scale = 0;
            this.grid[0][c] = bubble;
        }

        this.updateColorsInPlay();
        this.shakeTimer = 10;
        this.shakeIntensity = 6;
        if (window.audioManager) audioManager.play('fail');
    }

    // ============================================================
    // LEVEL COMPLETE
    // ============================================================

    completeLevel() {
        this.levelComplete = true;
        this.showLevelComplete = true;
        this.levelCompleteTimer = 0;

        // Star rating based on efficiency
        const efficiency = this.levelGoal / Math.max(1, this.shotsUsed);
        if (efficiency >= 0.8) this.starRating = 3;
        else if (efficiency >= 0.5) this.starRating = 2;
        else this.starRating = 1;

        // Rewards
        const levelCoins = 50 + this.level * 10 + this.starRating * 20;
        const levelDiamonds = this.starRating >= 3 ? 3 : this.starRating >= 2 ? 1 : 0;
        const bonusCoins = this.maxCombo * 5;

        this.earnCoins(levelCoins + bonusCoins, this.canvas.width / 2, this.canvas.height / 2 - 60);
        if (levelDiamonds > 0) {
            this.earnDiamonds(levelDiamonds, this.canvas.width / 2, this.canvas.height / 2 - 30);
        }

        // Boss bonus
        if (this.levelConfig?.layout?.startsWith('boss')) {
            this.earnDiamonds(5, this.canvas.width / 2, this.canvas.height / 2);
            this.earnCoins(200, this.canvas.width / 2, this.canvas.height / 2 + 20);
        }

        // Save stars
        const prevStars = this.playerData.levelStars[this.level] || 0;
        if (this.starRating > prevStars) {
            this.playerData.levelStars[this.level] = this.starRating;
        }

        if (this.level >= this.playerData.highestLevel) {
            this.playerData.highestLevel = this.level + 1;
        }

        this.playerData.currentLevel = this.level;
        this.playerData.totalScore += this.score;
        this.playerData.totalPopped += this.bubblesPopped;
        this.playerData.gamesPlayed++;
        this.savePlayerData();

        // Celebration fireworks
        this.spawnCelebration();

        if (window.audioManager) audioManager.play('achievement');
    }

    spawnCelebration() {
        for (let i = 0; i < 40; i++) {
            setTimeout(() => {
                if (this.destroyed) return;
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height * 0.5;
                const colorData = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
                this.spawnPopParticles(x, y, colorData.hex, 8, true);
            }, i * 50);
        }
    }

    spawnCelebrationParticle(x, y) {
        const colorData = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                color: colorData.hex,
                size: Math.random() * 4 + 2,
                life: 1, decay: 0.02, gravity: 0.08
            });
        }
    }

    nextLevel() {
        this.level++;
        this.showLevelComplete = false;
        this.levelTransition = true;
        this.levelTransitionTimer = 60;
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
                    level: this.level,
                    coins: this.levelCoins,
                    diamonds: this.levelDiamonds
                }), 1200);
                return;
            }
        }
    }

    // ============================================================
    // PARTICLES (Premium Quality)
    // ============================================================

    spawnPopParticles(x, y, color, count, intense = false) {
        const multiplier = intense ? 1.5 : 1;

        // Main directional particles
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
            const speed = (Math.random() * 4 + 2) * multiplier;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: Math.random() * 4 + 1.5,
                life: 1,
                decay: Math.random() * 0.025 + 0.015,
                gravity: 0.1
            });
        }

        // Sparkle particles (white)
        const sparkleCount = intense ? 6 : 3;
        for (let i = 0; i < sparkleCount; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 15,
                y: y + (Math.random() - 0.5) * 15,
                vx: (Math.random() - 0.5) * 3,
                vy: -Math.random() * 3 - 1,
                color: '#FFFFFF',
                size: Math.random() * 2 + 0.5,
                life: 1, decay: 0.04, gravity: -0.02,
                sparkle: true
            });
        }

        // Glow particles (larger, softer)
        if (intense) {
            for (let i = 0; i < 3; i++) {
                this.particles.push({
                    x: x + (Math.random() - 0.5) * 10,
                    y: y + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    color: color,
                    size: Math.random() * 8 + 5,
                    life: 0.6, decay: 0.015, gravity: 0,
                    glow: true
                });
            }
        }

        // Ripple
        this.ripples.push({
            x, y,
            radius: this.BUBBLE_R * 0.5,
            speed: intense ? 3 : 2,
            opacity: 0.5,
            decay: 0.02,
            color
        });
    }

    // ============================================================
    // DRAW - PREMIUM RENDERING
    // ============================================================

    draw() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.save();

        // Screen shake
        if (this.shakeX || this.shakeY) {
            ctx.translate(this.shakeX, this.shakeY);
        }

        this.drawBackground(ctx, W, H);
        this.drawDangerZone(ctx, W, H);
        this.drawLevelProgress(ctx, W);
        this.drawDropWarning(ctx, W, H);
        this.drawRipples(ctx);
        this.drawGrid(ctx);
        this.drawFallingBubbles(ctx);
        this.drawPopAnimations(ctx);
        this.drawImpactWaves(ctx);
        this.drawAimLine(ctx);
        this.drawShooter(ctx);
        this.drawProjectile(ctx);
        this.drawParticles(ctx);
        this.drawSparkles(ctx);
        this.drawScorePopups(ctx);
        this.drawCoinPopups(ctx);
        this.drawDiamondPopups(ctx);
        this.drawFloatingTexts(ctx);
        this.drawHUD(ctx, W, H);
        this.drawPowerUpBar(ctx);

        ctx.restore();

        // Overlays (no shake)
        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyReward(ctx, W, H);
        if (this.showLevelComplete) this.drawLevelComplete(ctx, W, H);
        if (this.levelTransition) this.drawLevelTransition(ctx, W, H);
        if (this.gameOver) this.drawGameOver(ctx, W, H);
    }

    drawBackground(ctx, W, H) {
        // Deep space gradient
        const grad = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.5, H);
        grad.addColorStop(0, '#12082a');
        grad.addColorStop(0.3, '#0d0620');
        grad.addColorStop(0.6, '#080415');
        grad.addColorStop(1, '#03020a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Nebula effects
        this.bgNebulas.forEach(n => {
            const nebulaGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            nebulaGrad.addColorStop(0, n.color + '0D');
            nebulaGrad.addColorStop(0.5, n.color + '06');
            nebulaGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = nebulaGrad;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Stars with proper twinkle
        this.bgStars.forEach(s => {
            const alpha = 0.1 + s.brightness * 0.7;
            ctx.globalAlpha = alpha;

            // Star glow
            if (s.size > 1) {
                ctx.fillStyle = s.color + '30';
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Subtle grid lines at bottom
        ctx.strokeStyle = 'rgba(179,71,217,0.06)';
        ctx.lineWidth = 0.5;
        for (let y = this.shooterY - 60; y < H; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
    }

    drawDangerZone(ctx, W, H) {
        // Red zone near bottom where game over happens
        const dangerY = this.offsetY + (this.ROWS - 3) * this.cellH;
        if (dangerY < this.shooterY - 40) {
            const grad = ctx.createLinearGradient(0, dangerY - 20, 0, dangerY + 10);
            grad.addColorStop(0, 'transparent');
            grad.addColorStop(1, 'rgba(255,0,50,0.05)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, dangerY - 20, W, 30);

            // Danger line
            ctx.strokeStyle = 'rgba(255,0,50,0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(0, dangerY);
            ctx.lineTo(W, dangerY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawLevelProgress(ctx, W) {
        const barW = W - 24;
        const barH = 5;
        const barX = 12;
        const barY = 48;
        const progress = Math.min(1, this.levelProgress);

        // Background
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this.roundRect(ctx, barX, barY, barW, barH, 2.5);
        ctx.fill();

        if (progress > 0) {
            // Progress fill
            const fillW = barW * progress;
            const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
            grad.addColorStop(0, '#B347D9');
            grad.addColorStop(0.5, '#FF006E');
            grad.addColorStop(1, '#00D4FF');
            ctx.fillStyle = grad;
            this.roundRect(ctx, barX, barY, fillW, barH, 2.5);
            ctx.fill();

            // Glow on progress bar
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#B347D9';
            this.roundRect(ctx, barX, barY, fillW, barH, 2.5);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Shimmer effect
            const shimmerX = barX + (((this.time / 15) % (fillW + 30)) - 15);
            if (shimmerX >= barX && shimmerX <= barX + fillW) {
                const shimmerGrad = ctx.createLinearGradient(shimmerX - 15, 0, shimmerX + 15, 0);
                shimmerGrad.addColorStop(0, 'transparent');
                shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
                shimmerGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = shimmerGrad;
                ctx.fillRect(barX, barY, fillW, barH);
            }
        }
    }

    drawDropWarning(ctx, W, H) {
        if (!this.dropWarning) return;
        const pct = (this.dropInterval - this.dropTimer) / 5000;
        const pulse = Math.abs(Math.sin(this.time / 200));
        const alpha = (1 - pct) * 0.15 * pulse;

        // Vignette-style warning
        const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.8);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, `rgba(255,0,50,${alpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Warning text
        if (pct < 0.4) {
            ctx.globalAlpha = (0.4 - pct) * 2 * pulse;
            ctx.font = 'bold 12px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#FF3864';
            ctx.fillText('⚠ ROW DROPPING SOON', W / 2, this.offsetY + 20);
            ctx.globalAlpha = 1;
            ctx.textAlign = 'left';
        }
    }

    drawGrid(ctx) {
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;

                const pos = this.getBubblePos(r, c);
                const scale = b.scale || 1;
                const bounceKey = `${r},${c}`;
                const bounce = this.gridBounce[bounceKey] || 0;
                const breathe = 1 + Math.sin(b.breathe) * 0.008;

                // Calculate final scale
                const finalScale = scale * breathe;
                const wobbleOffset = b.wobble ? Math.sin(this.time / 50) * b.wobble * 5 : 0;

                const drawX = pos.x + wobbleOffset;
                const drawY = pos.y - bounce;

                // Draw from cache for performance
                const cacheKey = `${b.colorIdx}_${this.BUBBLE_R}`;
                const cachedBubble = this.bubbleCache.get(cacheKey);
                const cachedGlow = this.glowCache.get(cacheKey);

                if (cachedBubble) {
                    // Glow layer (subtle)
                    if (cachedGlow) {
                        ctx.globalAlpha = 0.35;
                        const glowSize = (this.BUBBLE_R + 20) * 2 * finalScale;
                        ctx.drawImage(cachedGlow,
                            drawX - glowSize / 2, drawY - glowSize / 2,
                            glowSize, glowSize
                        );
                        ctx.globalAlpha = 1;
                    }

                    // Bubble
                    if (b.flash > 0) {
                        ctx.globalAlpha = 0.6 + (b.flash / 8) * 0.4;
                    }

                    const bubbleSize = (this.BUBBLE_R + 8) * 2 * finalScale;
                    ctx.drawImage(cachedBubble,
                        drawX - bubbleSize / 2, drawY - bubbleSize / 2,
                        bubbleSize, bubbleSize
                    );

                    ctx.globalAlpha = 1;
                } else {
                    // Fallback if cache miss
                    ctx.save();
                    ctx.translate(drawX, drawY);
                    ctx.scale(finalScale, finalScale);
                    this.drawBubbleDirect(ctx, 0, 0, this.BUBBLE_R, b.color, b.colorIdx);
                    ctx.restore();
                }
            }
        }
    }

    drawBubbleDirect(ctx, x, y, r, color, colorIdx) {
        const colorData = this.COLORS[colorIdx] || { hex: color, light: color, dark: color, glow: color };

        ctx.shadowBlur = 8;
        ctx.shadowColor = colorData.glow + '60';

        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x + r * 0.1, y + r * 0.1, r * 1.1);
        grad.addColorStop(0, colorData.light);
        grad.addColorStop(0.4, colorData.hex);
        grad.addColorStop(1, colorData.dark);

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Highlight
        const shine = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x - r * 0.2, y - r * 0.2, r * 0.5);
        shine.addColorStop(0, 'rgba(255,255,255,0.6)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Edge darken
        const edge = ctx.createRadialGradient(x, y, r * 0.7, x, y, r);
        edge.addColorStop(0, 'transparent');
        edge.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = edge;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Specular dot
        const spec = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x - r * 0.25, y - r * 0.3, r * 0.12);
        spec.addColorStop(0, 'rgba(255,255,255,0.9)');
        spec.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = spec;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle outline
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r - 0.3, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawRipples(ctx) {
        this.ripples.forEach(r => {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 2 * r.opacity;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    drawImpactWaves(ctx) {
        this.impactWaves.forEach(w => {
            ctx.globalAlpha = w.opacity;
            ctx.strokeStyle = w.color;
            ctx.lineWidth = 3 * w.opacity;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    drawAimLine(ctx) {
        if (this.aimLine.length < 2) return;
        if (this.projectile) return; // Hide while shooting

        const animOffset = this.time / 80;

        // Draw dotted line with fade
        for (let i = 0; i < this.aimLine.length; i++) {
            const p = this.aimLine[i];
            const alpha = (1 - p.t) * 0.5;

            // Animated dots
            const dotPhase = ((i * 0.3 + animOffset) % 1);
            const dotAlpha = alpha * (0.3 + dotPhase * 0.7);

            const dotSize = p.reflect ? 4 : (p.end ? 5 : 2.5 - p.t * 1.5);

            ctx.globalAlpha = dotAlpha;
            ctx.fillStyle = p.reflect ? '#FFD700' : (p.end ? '#FF006E' : '#FFFFFF');
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, dotSize), 0, Math.PI * 2);
            ctx.fill();

            if (p.reflect) {
                // Reflection marker
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // End point crosshair
        const last = this.aimLine[this.aimLine.length - 1];
        if (last) {
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#FF006E';
            ctx.lineWidth = 1;

            // Circle
            ctx.beginPath();
            ctx.arc(last.x, last.y, this.BUBBLE_R + 3, 0, Math.PI * 2);
            ctx.stroke();

            // Cross
            const cs = 6;
            ctx.beginPath();
            ctx.moveTo(last.x - cs, last.y);
            ctx.lineTo(last.x + cs, last.y);
            ctx.moveTo(last.x, last.y - cs);
            ctx.lineTo(last.x, last.y + cs);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    drawShooter(ctx) {
        const x = this.shooterX;
        const y = this.shooterY;

        // Platform glow
        const platformGrad = ctx.createRadialGradient(x, y + 30, 10, x, y + 30, 60);
        platformGrad.addColorStop(0, 'rgba(179,71,217,0.15)');
        platformGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = platformGrad;
        ctx.beginPath();
        ctx.arc(x, y + 30, 60, 0, Math.PI * 2);
        ctx.fill();

        // Base platform
        const baseGrad = ctx.createLinearGradient(x - 40, y + 25, x + 40, y + 45);
        baseGrad.addColorStop(0, '#1a0f2e');
        baseGrad.addColorStop(0.5, '#2d1852');
        baseGrad.addColorStop(1, '#1a0f2e');
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 35, 42, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base rim
        ctx.strokeStyle = 'rgba(179,71,217,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y + 35, 42, 10, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Barrel with recoil
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);

        const recoilOffset = -this.shooterRecoil;

        // Barrel outer
        const barrelGrad = ctx.createLinearGradient(0, -7, 0, 7);
        barrelGrad.addColorStop(0, '#9955dd');
        barrelGrad.addColorStop(0.3, '#b347d9');
        barrelGrad.addColorStop(0.7, '#b347d9');
        barrelGrad.addColorStop(1, '#7733bb');
        ctx.fillStyle = barrelGrad;

        this.roundRect(ctx, 10 + recoilOffset, -6, 32, 12, 4);
        ctx.fill();

        // Barrel glow
        ctx.shadowBlur = this.shooterGlow > 0.1 ? 15 : 6;
        ctx.shadowColor = '#b347d9';
        this.roundRect(ctx, 10 + recoilOffset, -6, 32, 12, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Barrel inner detail
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        this.roundRect(ctx, 10 + recoilOffset, -6, 32, 12, 4);
        ctx.stroke();

        // Muzzle tip
        ctx.fillStyle = '#d477ff';
        ctx.beginPath();
        ctx.arc(42 + recoilOffset, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Muzzle glow when shooting
        if (this.shooterGlow > 0.1) {
            ctx.globalAlpha = this.shooterGlow;
            const muzzleGrad = ctx.createRadialGradient(42, 0, 2, 42, 0, 20);
            muzzleGrad.addColorStop(0, '#FFFFFF');
            muzzleGrad.addColorStop(0.3, '#d477ff');
            muzzleGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = muzzleGrad;
            ctx.beginPath();
            ctx.arc(42, 0, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // Current bubble
        let bubbleColor = this.currentBubble.color;
        let bubbleColorIdx = this.currentBubble.colorIdx;
        let specialDraw = false;

        if (this.activePowerUp === 'fireball') {
            specialDraw = true;
            bubbleColor = '#FF4500';
        } else if (this.activePowerUp === 'rainbow') {
            specialDraw = true;
            const hue = (this.time / 8) % 360;
            bubbleColor = `hsl(${hue}, 100%, 60%)`;
        } else if (this.activePowerUp === 'bomb') {
            specialDraw = true;
            bubbleColor = '#444';
        }

        // Bubble pulse
        const pulseScale = 1 + this.shooterPulse * 0.1;

        if (specialDraw) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(pulseScale, pulseScale);
            this.drawSpecialShooterBubble(ctx, 0, 0, this.BUBBLE_R - 2, bubbleColor);
            ctx.restore();
        } else {
            const cacheKey = `${bubbleColorIdx}_${this.BUBBLE_R}`;
            const cached = this.bubbleCache.get(cacheKey);
            if (cached) {
                const size = (this.BUBBLE_R + 8) * 2 * pulseScale;
                ctx.drawImage(cached, x - size / 2, y - size / 2, size, size);
            } else {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(pulseScale, pulseScale);
                this.drawBubbleDirect(ctx, 0, 0, this.BUBBLE_R - 2, bubbleColor, bubbleColorIdx);
                ctx.restore();
            }
        }

        // Active power-up indicator on bubble
        if (this.activePowerUp) {
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#000';
            ctx.fillText(this.powerUps[this.activePowerUp].icon, x, y);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            // Power-up ring
            ctx.strokeStyle = this.powerUps[this.activePowerUp].color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5 + Math.sin(this.time / 200) * 0.3;
            ctx.beginPath();
            ctx.arc(x, y, this.BUBBLE_R + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Next bubble
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '9px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('NEXT', x + 55, y + 6);

        const nextCacheKey = `${this.nextBubble.colorIdx}_${this.BUBBLE_R}`;
        const nextCached = this.bubbleCache.get(nextCacheKey);
        const nextR = this.BUBBLE_R - 6;
        const nextSize = (this.BUBBLE_R + 8) * 2 * (nextR / this.BUBBLE_R);
        if (nextCached) {
            ctx.globalAlpha = 0.8;
            ctx.drawImage(nextCached, x + 55 - nextSize / 2, y + 22 - nextSize / 2, nextSize, nextSize);
            ctx.globalAlpha = 1;
        } else {
            ctx.globalAlpha = 0.8;
            this.drawBubbleDirect(ctx, x + 55, y + 22, nextR, this.nextBubble.color, this.nextBubble.colorIdx);
            ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'left';
    }

    drawSpecialShooterBubble(ctx, x, y, r, color) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;

        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        grad.addColorStop(0, this.lightenHex(color, 40));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, this.darkenHex(color, 30));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shine
        const shine = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x - r * 0.2, y - r * 0.2, r * 0.5);
        shine.addColorStop(0, 'rgba(255,255,255,0.5)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    drawProjectile(ctx) {
        if (!this.projectile) return;
        const p = this.projectile;

        // Trail
        for (let i = 0; i < p.trail.length; i++) {
            const t = p.trail[i];
            const progress = i / p.trail.length;
            const alpha = progress * 0.35;
            const size = this.BUBBLE_R * progress * 0.6;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(1.5, size), 0, Math.PI * 2);

            if (p.isFireball) {
                const fireGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size);
                fireGrad.addColorStop(0, '#FFAA00');
                fireGrad.addColorStop(1, '#FF4500');
                ctx.fillStyle = fireGrad;
            } else if (p.isRainbow) {
                const hue = (this.time / 5 + i * 20) % 360;
                ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
            } else {
                ctx.fillStyle = p.color;
            }
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Main projectile
        let drawColor = p.color;
        let colorIdx = p.colorIdx;

        if (p.isFireball) {
            // Fire effect
            ctx.save();
            ctx.translate(p.x, p.y);

            // Outer fire glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#FF4500';

            const fireGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.BUBBLE_R + 3);
            fireGrad.addColorStop(0, '#FFFFFF');
            fireGrad.addColorStop(0.2, '#FFDD00');
            fireGrad.addColorStop(0.5, '#FF8800');
            fireGrad.addColorStop(1, '#FF4500');
            ctx.fillStyle = fireGrad;
            ctx.beginPath();
            ctx.arc(0, 0, this.BUBBLE_R, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Fire particles around
            for (let i = 0; i < 4; i++) {
                const angle = (this.time / 50 + i * Math.PI / 2) % (Math.PI * 2);
                const dist = this.BUBBLE_R + Math.sin(this.time / 30 + i) * 3;
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = '#FFAA00';
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText('🔥', 0, 0);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            ctx.restore();
        } else if (p.isRainbow) {
            const hue = (this.time / 8) % 360;
            drawColor = `hsl(${hue}, 100%, 60%)`;
            this.drawSpecialShooterBubble(ctx, p.x, p.y, this.BUBBLE_R, drawColor);

            // Rainbow ring
            ctx.strokeStyle = `hsl(${(hue + 60) % 360}, 100%, 60%)`;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.BUBBLE_R + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (p.isBomb) {
            this.drawSpecialShooterBubble(ctx, p.x, p.y, this.BUBBLE_R, '#555');

            // Bomb fuse glow
            const fuseGlow = Math.sin(this.time / 50) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255,100,0,${fuseGlow})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y - this.BUBBLE_R * 0.5, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', p.x, p.y);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        } else {
            // Normal bubble from cache
            const cacheKey = `${colorIdx}_${this.BUBBLE_R}`;
            const cached = this.bubbleCache.get(cacheKey);
            if (cached) {
                const size = (this.BUBBLE_R + 8) * 2;

                // Motion glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.drawImage(cached, p.x - size / 2, p.y - size / 2, size, size);
                ctx.shadowBlur = 0;
            } else {
                this.drawBubbleDirect(ctx, p.x, p.y, this.BUBBLE_R, p.color, colorIdx);
            }
        }
    }

    drawFallingBubbles(ctx) {
        this.fallingBubbles.forEach(b => {
            const alpha = Math.min(1, b.life / 50);
            ctx.globalAlpha = alpha;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rotation);
            ctx.scale(b.scale, b.scale);

            const cacheKey = `${b.colorIdx}_${this.BUBBLE_R}`;
            const cached = this.bubbleCache.get(cacheKey);
            if (cached) {
                const size = (this.BUBBLE_R + 8) * 2;
                ctx.drawImage(cached, -size / 2, -size / 2, size, size);
            } else {
                this.drawBubbleDirect(ctx, 0, 0, b.r, b.color, b.colorIdx || 0);
            }

            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    drawPopAnimations(ctx) {
        this.popAnimations.forEach(p => {
            ctx.globalAlpha = p.opacity;

            // Outer ring
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.lineWidth || 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.BUBBLE_R * p.scale, 0, Math.PI * 2);
            ctx.stroke();

            // Inner glow ring
            ctx.globalAlpha = p.opacity * 0.3;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.BUBBLE_R * p.scale * 0.7, 0, Math.PI * 2);
            ctx.stroke();

            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawParticles(ctx) {
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.min(1, p.life);

            if (p.glow) {
                // Soft glow particle
                const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                glowGrad.addColorStop(0, p.color + '60');
                glowGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.sparkle) {
                // Diamond-shaped sparkle
                ctx.fillStyle = p.color;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(this.time / 200);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            } else {
                // Standard particle with glow
                ctx.shadowBlur = 4;
                ctx.shadowColor = p.color;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });
        ctx.globalAlpha = 1;
    }

    drawSparkles(ctx) {
        this.sparkles.forEach(s => {
            ctx.globalAlpha = s.life;
            ctx.fillStyle = s.color;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rotation);

            // 4-point star shape
            const size = s.size;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI / 2) * i;
                const outerX = Math.cos(angle) * size;
                const outerY = Math.sin(angle) * size;
                const innerAngle = angle + Math.PI / 4;
                const innerX = Math.cos(innerAngle) * size * 0.3;
                const innerY = Math.sin(innerAngle) * size * 0.3;

                if (i === 0) ctx.moveTo(outerX, outerY);
                else ctx.lineTo(outerX, outerY);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    drawScorePopups(ctx) {
        this.scorePopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            const scale = p.scale !== undefined ? Math.min(1.2, p.scale) : 1;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(scale, scale);

            ctx.font = 'bold 15px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Text shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText(p.text, 1, 1);

            // Text glow
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, 0, 0);
            ctx.shadowBlur = 0;

            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    drawCoinPopups(ctx) {
        this.coinPopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 13px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
            ctx.fillText(p.text, p.x + 1, p.y + 1);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
        });
        ctx.globalAlpha = 1;
    }

    drawDiamondPopups(ctx) {
        this.diamondPopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 14px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#00D4FF';
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawFloatingTexts(ctx) {
        this.floatingTexts.forEach(t => {
            ctx.globalAlpha = t.opacity;
            const scale = t.scale !== undefined ? t.scale : 1;
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.scale(scale, scale);

            ctx.font = `bold ${t.size || 16}px Orbitron`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText(t.text, 2, 2);

            // Glow
            ctx.shadowBlur = 12;
            ctx.shadowColor = t.color;
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, 0, 0);
            ctx.shadowBlur = 0;

            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // HUD (Premium)
    // ============================================================

    drawHUD(ctx, W, H) {
        // Top bar background
        const hudGrad = ctx.createLinearGradient(0, 0, 0, 46);
        hudGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
        hudGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = hudGrad;
        ctx.fillRect(0, 0, W, 46);

        // Bottom separator line
        ctx.strokeStyle = 'rgba(179,71,217,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 46);
        ctx.lineTo(W, 46);
        ctx.stroke();

        // Level
        ctx.font = 'bold 13px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#B347D9';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#B347D9';
        ctx.fillText(`LVL ${this.level}`, 10, 18);
        ctx.shadowBlur = 0;

        // Level name
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Rajdhani';
        ctx.fillText(this.levelConfig?.name || '', 10, 33);

        // Center: Progress
        ctx.textAlign = 'center';
        ctx.font = '12px Rajdhani';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`${this.bubblesPopped}/${this.levelGoal}`, W / 2, 18);

        // Combo
        if (this.combo > 1) {
            const comboScale = 1 + Math.sin(this.time / 100) * 0.05;
            ctx.save();
            ctx.translate(W / 2, 34);
            ctx.scale(comboScale, comboScale);
            ctx.font = 'bold 11px Orbitron';
            ctx.fillStyle = '#FFD700';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#FFD700';
            ctx.fillText(`x${this.combo} COMBO`, 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Right side: Currency
        ctx.textAlign = 'right';

        // Coins
        const coinFlash = this.hudFlash.coins > 0;
        const coinColor = coinFlash ? '#FFFFFF' : '#FFD700';
        const coinSize = coinFlash ? 13 : 11;
        ctx.font = `bold ${coinSize}px Orbitron`;
        ctx.fillStyle = coinColor;
        if (coinFlash) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#FFD700';
        }
        ctx.fillText(`🪙 ${this.formatNumber(this.playerData.coins)}`, W - 10, 18);
        ctx.shadowBlur = 0;

        // Diamonds
        const diaFlash = this.hudFlash.diamonds > 0;
        const diaColor = diaFlash ? '#FFFFFF' : '#00D4FF';
        const diaSize = diaFlash ? 13 : 11;
        ctx.font = `bold ${diaSize}px Orbitron`;
        ctx.fillStyle = diaColor;
        if (diaFlash) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00D4FF';
        }
        ctx.fillText(`💎 ${this.formatNumber(this.playerData.diamonds)}`, W - 10, 35);
        ctx.shadowBlur = 0;

        ctx.textAlign = 'left';

        // Score display (small, below progress bar)
        ctx.font = '10px Rajdhani';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.fillText(`Score: ${this.formatNumber(this.score)}`, W / 2, 57);
        ctx.textAlign = 'left';

        // Drop timer bar at very bottom
        if (this.dropWarning) {
            const pct = (this.dropInterval - this.dropTimer) / this.dropInterval;
            const timerGrad = ctx.createLinearGradient(0, 0, W * pct, 0);
            timerGrad.addColorStop(0, '#FF006E');
            timerGrad.addColorStop(1, '#FF3864');
            ctx.fillStyle = timerGrad;
            ctx.fillRect(0, H - 3, W * pct, 3);
        }
    }

    drawPowerUpBar(ctx) {
        const btnSize = 34;
        const btnY = this.shooterY + 22;
        const startX = 8;
        let idx = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx = startX + idx * (btnSize + 5);
            const isActive = this.activePowerUp === key;
            const hasCharges = pup.count > 0;

            // Button background
            if (isActive) {
                // Active glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = pup.color;
            }

            const bgAlpha = isActive ? 0.4 : (hasCharges ? 0.15 : 0.05);
            ctx.fillStyle = isActive ? (pup.color + '66') : `rgba(179,71,217,${bgAlpha})`;
            this.roundRect(ctx, bx, btnY, btnSize, btnSize, 8);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Border
            ctx.strokeStyle = isActive ? pup.color : (hasCharges ? 'rgba(179,71,217,0.3)' : 'rgba(100,100,100,0.2)');
            ctx.lineWidth = isActive ? 1.5 : 0.5;
            this.roundRect(ctx, bx, btnY, btnSize, btnSize, 8);
            ctx.stroke();

            // Icon
            ctx.globalAlpha = hasCharges ? 1 : 0.3;
            ctx.font = '15px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pup.icon, bx + btnSize / 2, btnY + btnSize / 2 - 2);

            // Count badge
            if (hasCharges) {
                // Badge background
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.beginPath();
                ctx.arc(bx + btnSize - 4, btnY + btnSize - 4, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = 'bold 8px Orbitron';
                ctx.fillStyle = pup.count > 0 ? '#00FF88' : '#FF3864';
                ctx.fillText(`${pup.count}`, bx + btnSize - 4, btnY + btnSize - 3);
            }

            ctx.globalAlpha = 1;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            idx++;
        }
    }

    // ============================================================
    // OVERLAY SCREENS (Premium UI)
    // ============================================================

    drawDailyReward(ctx, W, H) {
        // Backdrop with blur effect
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, W, H);

        // Card
        const cw = Math.min(300, W - 40);
        const ch = 280;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        // Card glow
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#FFD700';
        this.drawCard(ctx, cx, cy, cw, ch, '#FFD700', 'rgba(10,8,25,0.95)');
        ctx.shadowBlur = 0;

        // Decorative top ornament
        const ornGrad = ctx.createLinearGradient(cx, cy, cx + cw, cy);
        ornGrad.addColorStop(0, 'transparent');
        ornGrad.addColorStop(0.5, '#FFD70040');
        ornGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ornGrad;
        ctx.fillRect(cx + 20, cy + 1, cw - 40, 3);

        // Title
        ctx.font = 'bold 22px Orbitron';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFD700';
        ctx.fillText('🎁 Daily Reward!', W / 2, cy + 45);
        ctx.shadowBlur = 0;

        // Streak
        ctx.font = '14px Rajdhani';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`Day ${this.playerData.dailyStreak + 1} Streak 🔥`, W / 2, cy + 72);

        // Rewards
        const streak = this.playerData.dailyStreak;
        const mult = Math.min(1 + streak * 0.25, 3);
        const coins = Math.floor(50 * mult);
        const diamonds = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));

        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 ${coins}`, W / 2, cy + 120);

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 ${diamonds}`, W / 2, cy + 155);

        if (streak > 0 && streak % 5 === 0) {
            ctx.font = '13px Rajdhani';
            ctx.fillStyle = '#00FF88';
            ctx.fillText('+ Bonus Power-up! 🎉', W / 2, cy + 185);
        }

        // Claim button
        this.drawButton(ctx, W / 2, cy + ch - 50, 160, 42, 'CLAIM!', '#B347D9', '#FF006E');

        ctx.textAlign = 'left';
    }

    drawLevelComplete(ctx, W, H) {
        const progress = Math.min(1, this.levelCompleteTimer / 30);
        const eased = this.easeOutBack(progress);

        ctx.fillStyle = `rgba(0,0,0,${0.8 * progress})`;
        ctx.fillRect(0, 0, W, H);

        if (progress < 0.3) return;

        const cw = Math.min(320, W - 30);
        const ch = 340;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(eased, eased);
        ctx.translate(-W / 2, -H / 2);

        // Card
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#00FF88';
        this.drawCard(ctx, cx, cy, cw, ch, '#00FF88', 'rgba(10,8,25,0.95)');
        ctx.shadowBlur = 0;

        // Title
        ctx.font = 'bold 22px Orbitron';
        ctx.fillStyle = '#00FF88';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00FF88';
        ctx.fillText('LEVEL COMPLETE!', W / 2, cy + 40);
        ctx.shadowBlur = 0;

        // Stars with animation
        const starY = cy + 80;
        for (let i = 0; i < 3; i++) {
            const sx = W / 2 + (i - 1) * 45;
            const starDelay = Math.max(0, progress - 0.5 - i * 0.1) * 5;
            const starScale = Math.min(1, starDelay);

            ctx.save();
            ctx.translate(sx, starY);
            ctx.scale(starScale, starScale);

            if (i < this.starRating) {
                // Filled star
                ctx.font = '36px Arial';
                ctx.fillText('⭐', 0, 0);
            } else {
                ctx.font = '32px Arial';
                ctx.globalAlpha = 0.3;
                ctx.fillText('☆', 0, 0);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
        }

        // Stats
        ctx.font = '13px Rajdhani';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const statsX = W / 2;
        ctx.fillText(`Score: ${this.formatNumber(this.score)}`, statsX, cy + 125);
        ctx.fillText(`Bubbles Popped: ${this.bubblesPopped}`, statsX, cy + 148);
        ctx.fillText(`Best Combo: x${this.maxCombo}`, statsX, cy + 171);
        ctx.fillText(`Shots: ${this.shotsUsed}`, statsX, cy + 194);

        // Rewards
        ctx.font = 'bold 16px Orbitron';
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#FFD700';
        ctx.fillText(`🪙 +${this.levelCoins}`, statsX, cy + 232);
        ctx.shadowBlur = 0;

        if (this.levelDiamonds > 0) {
            ctx.fillStyle = '#00D4FF';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#00D4FF';
            ctx.fillText(`💎 +${this.levelDiamonds}`, statsX, cy + 258);
            ctx.shadowBlur = 0;
        }

        // Next button
        if (this.levelCompleteTimer > 40) {
            this.drawButton(ctx, W / 2, cy + ch - 48, 170, 40, 'NEXT LEVEL →', '#00D4FF', '#00FF88');
        }

        ctx.restore();
        ctx.textAlign = 'left';
    }

    drawLevelTransition(ctx, W, H) {
        const progress = 1 - (this.levelTransitionTimer / 60);
        const alpha = progress < 0.5 ? progress * 2 : 2 - progress * 2;
        ctx.fillStyle = `rgba(5,5,16,${alpha})`;
        ctx.fillRect(0, 0, W, H);

        if (progress > 0.3 && progress < 0.7) {
            ctx.font = 'bold 20px Orbitron';
            ctx.fillStyle = `rgba(179,71,217,${1 - Math.abs(progress - 0.5) * 4})`;
            ctx.textAlign = 'center';
            ctx.fillText(`Level ${this.level}`, W / 2, H / 2);
            ctx.textAlign = 'left';
        }
    }

    drawGameOver(ctx, W, H) {
        const pulse = Math.sin(this.time / 300) * 0.05 + 1;

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, W, H);

        // Vignette
        const vigGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.7);
        vigGrad.addColorStop(0, 'transparent');
        vigGrad.addColorStop(1, 'rgba(255,0,50,0.15)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, W, H);

        // Title
        ctx.save();
        ctx.translate(W / 2, H / 2 - 55);
        ctx.scale(pulse, pulse);
        ctx.font = 'bold 32px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF006E';
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('GAME OVER', 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Stats
        ctx.font = '15px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`Score: ${this.formatNumber(this.score)}`, W / 2, H / 2 - 5);
        ctx.fillText(`Level: ${this.level}`, W / 2, H / 2 + 20);
        ctx.fillText(`Best Combo: x${this.maxCombo}`, W / 2, H / 2 + 45);

        // Earnings
        ctx.font = 'bold 14px Orbitron';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 ${this.levelCoins} earned`, W / 2, H / 2 + 80);
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 ${this.levelDiamonds} earned`, W / 2, H / 2 + 105);

        ctx.textAlign = 'left';
    }

    // ============================================================
    // UI HELPER DRAWING
    // ============================================================

    drawCard(ctx, x, y, w, h, borderColor, bgColor) {
        // Background
        ctx.fillStyle = bgColor;
        this.roundRect(ctx, x, y, w, h, 16);
        ctx.fill();

        // Border
        ctx.strokeStyle = borderColor + '60';
        ctx.lineWidth = 2;
        this.roundRect(ctx, x, y, w, h, 16);
        ctx.stroke();

        // Inner glow
        const innerGrad = ctx.createLinearGradient(x, y, x, y + h);
        innerGrad.addColorStop(0, borderColor + '10');
        innerGrad.addColorStop(0.1, 'transparent');
        innerGrad.addColorStop(0.9, 'transparent');
        innerGrad.addColorStop(1, borderColor + '08');
        ctx.fillStyle = innerGrad;
        this.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 15);
        ctx.fill();
    }

    drawButton(ctx, centerX, centerY, w, h, text, color1, color2) {
        const bx = centerX - w / 2;
        const by = centerY - h / 2;

        // Button gradient
        const grad = ctx.createLinearGradient(bx, by, bx + w, by + h);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        this.roundRect(ctx, bx, by, w, h, h / 2);
        ctx.fill();

        // Button glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = color1;
        this.roundRect(ctx, bx, by, w, h, h / 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shimmer
        const shimmer = ctx.createLinearGradient(bx, by, bx + w, by);
        shimmer.addColorStop(0, 'transparent');
        shimmer.addColorStop(0.45, 'transparent');
        shimmer.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        shimmer.addColorStop(0.55, 'transparent');
        shimmer.addColorStop(1, 'transparent');
        ctx.fillStyle = shimmer;
        this.roundRect(ctx, bx, by, w, h, h / 2);
        ctx.fill();

        // Text
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, centerX, centerY + 1);
    }

    // ============================================================
    // UTILS
    // ============================================================

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
        } else {
            r = Math.min(r, w / 2, h / 2);
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
    }

    lightenHex(hex, amount) {
        if (!hex || !hex.startsWith('#')) return hex;
        try {
            const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
            const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
            const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
            return `rgb(${r},${g},${b})`;
        } catch(e) { return hex; }
    }

    darkenHex(hex, amount) {
        if (!hex || !hex.startsWith('#')) return hex;
        try {
            const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
            const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
            const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
            return `rgb(${r},${g},${b})`;
        } catch(e) { return hex; }
    }

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    easeOutElastic(t) {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    }

    // ============================================================
    // GAME LOOP
    // ============================================================

    loop(timestamp) {
        if (this.destroyed) return;

        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50); // Cap delta
        this.lastTime = timestamp;

        if (!this.paused) {
            this.update(dt);
        }
        this.draw();

        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        this.isPaused = this.paused;
        return this.paused;
    }

    resize() {
        this.BUBBLE_R = this.calculateBubbleRadius();
        this.recalculateGrid();
        this.shooterX = this.canvas.width / 2;
        this.shooterY = this.canvas.height - 65;
        this.bgStars = this.generateStarField(80);
        this.bgNebulas = this.generateNebulas(3);
        this.preRenderBubbles();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('click', this.boundClick);
        this.canvas.removeEventListener('touchend', this.boundTouch);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        document.removeEventListener('keydown', this.boundKeyDown);
        this.bubbleCache.clear();
        this.glowCache.clear();
        this.savePlayerData();
    }
}