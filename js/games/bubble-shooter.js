/* ============================================================
   BUBBLE SHOOTER v4.0 - ULTRA PREMIUM EDITION
   Levels, Coins, Diamonds, Daily Rewards, Power-ups
   Visual overhaul: glass bubbles, ghost aim, ring-burst particles,
   combo flash, sci-fi cannon, grid-dot background
   ============================================================ */

'use strict';

class BubbleShooter {
    constructor(canvas, onScore, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;
        this.gameOver = false;

        // ============================================
        // CURRENCY & ECONOMY
        // ============================================
        this.saveKey = 'neonarcade_bubbleshooter';
        this.playerData = this.loadPlayerData();

        // ============================================
        // GAME CONFIG
        // ============================================
        this.COLS = 10;
        this.ROWS = 12;
        this.BUBBLE_R = Math.min(Math.floor(canvas.width / (this.COLS * 2 + 1)), 22);

        // Premium color palette — vivid, distinct, beautiful
        this.COLORS = [
            '#FF2D6B',  // 0 hot pink
            '#00C8FF',  // 1 sky blue
            '#00F5A0',  // 2 mint green
            '#FFD600',  // 3 golden yellow
            '#C040FF',  // 4 violet
            '#FF7A00',  // 5 flame orange
            '#FF4060',  // 6 coral red
            '#00FFCE'   // 7 aqua
        ];

        // Matching inner-glow colors (slightly lighter)
        this.GLOW_COLORS = [
            '#FF6090', '#60E0FF', '#60FFC0', '#FFE860',
            '#D880FF', '#FFA040', '#FF7090', '#80FFE0'
        ];

        this.colorsInPlay = [];

        // Grid
        this.grid = [];
        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * 1.85;
        this.offsetX = (canvas.width - this.COLS * this.cellW) / 2 + this.BUBBLE_R;
        this.offsetY = 50;

        // Shooter
        this.shooterX = canvas.width / 2;
        this.shooterY = canvas.height - 55;
        this.angle = -Math.PI / 2;
        this.currentBubble = null;
        this.nextBubble = null;
        this.projectile = null;
        this.projectileSpeed = 14;
        this.canShoot = true;

        // Shooter idle bob
        this.shooterBob = 0;
        this.shooterBobDir = 1;

        // Ghost bubble (aim preview)
        this.ghostBubble = null; // {r, c, x, y}

        // Animations
        this.particles = [];
        this.fallingBubbles = [];
        this.aimLine = [];
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeTimer = 0;
        this.popAnimations = [];
        this.scorePopups = [];
        this.coinPopups = [];
        this.diamondPopups = [];
        this.floatingTexts = [];
        this.comboFlash = { active: false, alpha: 0, color: '#FFD700' };

        // Game state
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

        // Power-ups
        this.powerUps = {
            fireball: { count: this.playerData.powerUps?.fireball || 0, active: false, icon: '🔥', name: 'Fire Ball', cost: 50, desc: 'Destroys all bubbles it touches' },
            rainbow:  { count: this.playerData.powerUps?.rainbow  || 0, active: false, icon: '🌈', name: 'Rainbow',   cost: 75,  desc: 'Matches any color' },
            bomb:     { count: this.playerData.powerUps?.bomb     || 0, active: false, icon: '💣', name: 'Bomb',      cost: 100, desc: 'Explodes area around impact' },
            precision:{ count: this.playerData.powerUps?.precision|| 0, active: false, icon: '🎯', name: 'Precision', cost: 30,  desc: 'Extended aim guide' }
        };
        this.activePowerUp = null;
        this.powerUpTimer = 0;

        // Daily reward
        this.dailyRewardClaimed = false;
        this.showDailyReward = false;
        this.dailyRewardTimer = 0;
        this.checkDailyReward();

        // Background stars
        this.stars = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 1.8 + 0.2,
            t: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.012 + 0.004
        }));

        // Nebula blobs for atmosphere
        this.nebulae = Array.from({ length: 5 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 0.7,
            r: Math.random() * 120 + 60,
            color: ['#1a0a2e', '#0a1a2e', '#0a2e1a', '#1a1a0a', '#1a0a1a'][Math.floor(Math.random() * 5)],
            t: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.003 + 0.001
        }));

        // UI state
        this.showPowerUpMenu = false;
        this.showLevelComplete = false;
        this.levelCompleteTimer = 0;
        this.hudFlash = {};

        // Pickup animations
        this.pickupAnimations = [];

        // Frame time tracking for smooth animations
        this.time = 0;

        // Initialize level
        this.initLevel(this.level);
        this.generateShooter();

        // Events
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundClick     = this.onClick.bind(this);
        this.boundTouch     = this.onTouch.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundKeyDown   = this.onKeyDown.bind(this);

        canvas.addEventListener('mousemove', this.boundMouseMove);
        canvas.addEventListener('click',     this.boundClick);
        canvas.addEventListener('touchend',  this.boundTouch);
        canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        document.addEventListener('keydown', this.boundKeyDown);

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ============================================================
    // SAVE / LOAD
    // ============================================================

    loadPlayerData() {
        const defaults = {
            coins: 0, diamonds: 0, currentLevel: 1, highestLevel: 1,
            totalScore: 0, totalPopped: 0, totalCoinsEarned: 0, totalDiamondsEarned: 0,
            dailyStreak: 0, lastDailyReward: null, lastPlayDate: null,
            levelStars: {}, powerUps: { fireball: 1, rainbow: 1, bomb: 1, precision: 2 },
            achievements: [], gamesPlayed: 0
        };
        try {
            const saved = JSON.parse(localStorage.getItem(this.saveKey));
            if (saved) return { ...defaults, ...saved };
        } catch(e) {}
        return defaults;
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
        const now  = new Date();
        const today = now.toDateString();
        const last  = this.playerData.lastDailyReward;
        if (last !== today) {
            if (last) {
                const diff = Math.floor((now - new Date(last)) / 86400000);
                if (diff === 1) this.playerData.dailyStreak++;
                else if (diff > 1) this.playerData.dailyStreak = 0;
            }
            this.showDailyReward = true;
            this.dailyRewardClaimed = false;
        }
    }

    claimDailyReward() {
        if (this.dailyRewardClaimed) return;
        const streak = this.playerData.dailyStreak;
        const mult   = Math.min(1 + streak * 0.25, 3);
        const coins  = Math.floor(50 * mult);
        const diamonds = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));
        let bonusPowerUp = null;
        if (streak > 0 && streak % 5 === 0) {
            const pups = Object.keys(this.powerUps);
            bonusPowerUp = pups[Math.floor(Math.random() * pups.length)];
            this.powerUps[bonusPowerUp].count++;
        }
        this.playerData.coins  += coins;
        this.playerData.diamonds += diamonds;
        this.playerData.totalCoinsEarned   += coins;
        this.playerData.totalDiamondsEarned += diamonds;
        this.playerData.lastDailyReward = new Date().toDateString();
        this.playerData.dailyStreak++;
        this.dailyRewardClaimed = true;
        this.showDailyReward = false;
        this.dailyRewardTimer = 180;
        this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2-40, text: `+${coins} 🪙`,  color: '#FFD700', life: 120, opacity: 1, size: 22 });
        this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2,    text: `+${diamonds} 💎`, color: '#00D4FF', life: 120, opacity: 1, size: 20 });
        if (bonusPowerUp) {
            this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2+40, text: `+1 ${this.powerUps[bonusPowerUp].icon} ${this.powerUps[bonusPowerUp].name}!`, color: '#00FF88', life: 120, opacity: 1, size: 16 });
        }
        if (window.audioManager) audioManager.play('achievement');
        this.savePlayerData();
    }

    // ============================================================
    // LEVEL CONFIG — 25 Levels
    // ============================================================

    getLevelConfig(level) {
        const configs = {
            1:  { rows: 4,  colors: 3, goal: 25,  dropInterval: 45000, name: 'Warm Up',         layout: 'standard' },
            2:  { rows: 4,  colors: 3, goal: 30,  dropInterval: 42000, name: 'Getting Started', layout: 'standard' },
            3:  { rows: 5,  colors: 4, goal: 40,  dropInterval: 40000, name: 'Color Mix',        layout: 'standard' },
            4:  { rows: 5,  colors: 4, goal: 45,  dropInterval: 38000, name: 'Rising Tide',      layout: 'standard' },
            5:  { rows: 6,  colors: 4, goal: 55,  dropInterval: 35000, name: '⭐ BOSS: The Wall',     layout: 'boss_wall' },
            6:  { rows: 5,  colors: 5, goal: 50,  dropInterval: 35000, name: 'Rainbow Rush',     layout: 'standard' },
            7:  { rows: 5,  colors: 5, goal: 55,  dropInterval: 33000, name: 'Quick Fire',       layout: 'zigzag' },
            8:  { rows: 6,  colors: 5, goal: 60,  dropInterval: 32000, name: 'Deep Colors',      layout: 'standard' },
            9:  { rows: 6,  colors: 5, goal: 65,  dropInterval: 30000, name: 'Speed Run',        layout: 'diamond' },
            10: { rows: 7,  colors: 5, goal: 75,  dropInterval: 28000, name: '⭐ BOSS: The Pyramid', layout: 'boss_pyramid' },
            11: { rows: 6,  colors: 6, goal: 70,  dropInterval: 28000, name: 'Hex Mix',          layout: 'standard' },
            12: { rows: 6,  colors: 6, goal: 75,  dropInterval: 26000, name: 'Cascade',          layout: 'checkerboard' },
            13: { rows: 7,  colors: 6, goal: 80,  dropInterval: 25000, name: 'Tight Squeeze',    layout: 'standard' },
            14: { rows: 7,  colors: 6, goal: 85,  dropInterval: 24000, name: 'Color Storm',      layout: 'zigzag' },
            15: { rows: 7,  colors: 6, goal: 90,  dropInterval: 22000, name: '⭐ BOSS: The Cross',   layout: 'boss_cross' },
            16: { rows: 7,  colors: 7, goal: 85,  dropInterval: 22000, name: 'Spectrum',         layout: 'standard' },
            17: { rows: 7,  colors: 7, goal: 90,  dropInterval: 20000, name: 'Maze Runner',      layout: 'maze' },
            18: { rows: 8,  colors: 7, goal: 95,  dropInterval: 20000, name: 'Dense Pack',       layout: 'standard' },
            19: { rows: 8,  colors: 7, goal: 100, dropInterval: 18000, name: 'Pressure',         layout: 'diamond' },
            20: { rows: 8,  colors: 7, goal: 110, dropInterval: 16000, name: '⭐ BOSS: The Spiral',  layout: 'boss_spiral' },
            21: { rows: 8,  colors: 8, goal: 100, dropInterval: 16000, name: 'Octachrome',       layout: 'standard' },
            22: { rows: 8,  colors: 8, goal: 110, dropInterval: 15000, name: 'Blitz',            layout: 'checkerboard' },
            23: { rows: 9,  colors: 8, goal: 120, dropInterval: 14000, name: 'Endurance',        layout: 'zigzag' },
            24: { rows: 9,  colors: 8, goal: 130, dropInterval: 12000, name: 'Nightmare',        layout: 'maze' },
            25: { rows: 10, colors: 8, goal: 150, dropInterval: 10000, name: '⭐ FINAL BOSS',        layout: 'boss_final' }
        };
        if (configs[level]) return configs[level];
        return {
            rows: Math.min(10, 6 + Math.floor(level/5)),
            colors: Math.min(8, 3 + Math.floor(level/3)),
            goal: 50 + level * 10,
            dropInterval: Math.max(8000, 30000 - level * 800),
            name: `Endless ${level}`,
            layout: ['standard','zigzag','diamond','checkerboard','maze'][level % 5]
        };
    }

    initLevel(level) {
        this.levelConfig  = this.getLevelConfig(level);
        this.ROWS         = Math.max(10, this.levelConfig.rows + 4);
        this.dropInterval = this.levelConfig.dropInterval;
        this.dropTimer    = 0;
        this.bubblesPopped = 0;
        this.shotsUsed     = 0;
        this.levelCoins    = 0;
        this.levelDiamonds = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.levelComplete    = false;
        this.showLevelComplete = false;
        this.levelGoal     = this.levelConfig.goal;
        this.levelProgress = 0;
        this.activePowerUp = null;
        this.ghostBubble   = null;

        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.COLS; c++) this.grid[r][c] = null;
        }

        this.generateLayout(this.levelConfig);
        this.updateColorsInPlay();

        this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2-30, text: `Level ${level}`, color: '#C040FF', life: 120, opacity: 1, size: 28 });
        this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2+10, text: this.levelConfig.name, color: '#00C8FF', life: 120, opacity: 1, size: 18 });
        this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2+42, text: `Goal: Pop ${this.levelGoal} bubbles`, color: '#fff', life: 120, opacity: 1, size: 14 });
    }

    // ============================================================
    // LAYOUTS
    // ============================================================

    generateLayout(config) {
        const { layout, rows: fillRows, colors: numColors } = config;
        switch (layout) {
            case 'zigzag':      this.layoutZigzag(fillRows, numColors);      break;
            case 'diamond':     this.layoutDiamond(fillRows, numColors);     break;
            case 'checkerboard':this.layoutCheckerboard(fillRows, numColors); break;
            case 'maze':        this.layoutMaze(fillRows, numColors);        break;
            case 'boss_wall':   this.layoutBossWall(numColors);              break;
            case 'boss_pyramid':this.layoutBossPyramid(numColors);           break;
            case 'boss_cross':  this.layoutBossCross(numColors);             break;
            case 'boss_spiral': this.layoutBossSpiral(numColors);            break;
            case 'boss_final':  this.layoutBossFinal(numColors);             break;
            default:            this.layoutStandard(fillRows, numColors);
        }
    }

    layoutStandard(rows, n) {
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < this.COLS; c++)
                this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
    }
    layoutZigzag(rows, n) {
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < this.COLS; c++)
                if ((r + c) % 2 === 0) this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
    }
    layoutDiamond(rows, n) {
        const ctr = Math.floor(this.COLS / 2);
        for (let r = 0; r < rows; r++) {
            const half = Math.min(r, rows - 1 - r);
            for (let c = ctr - half; c <= ctr + half; c++)
                if (c >= 0 && c < this.COLS) this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
        }
    }
    layoutCheckerboard(rows, n) {
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < this.COLS; c++)
                this.grid[r][c] = this.createBubble((r + c) % n);
    }
    layoutMaze(rows, n) {
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < this.COLS; c++)
                if (r % 2 === 0 || c % 3 === 0) this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
    }
    layoutBossWall(n) {
        for (let r = 0; r < 6; r++)
            for (let c = 0; c < this.COLS; c++)
                this.grid[r][c] = this.createBubble(r % n);
    }
    layoutBossPyramid(n) {
        for (let r = 0; r < 7; r++) {
            const s = Math.max(0, Math.floor(r / 2));
            const e = Math.min(this.COLS, this.COLS - Math.floor(r / 2));
            for (let c = s; c < e; c++) this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
        }
    }
    layoutBossCross(n) {
        const mid = Math.floor(this.COLS / 2);
        for (let r = 0; r < 7; r++) {
            if (r === 3) for (let c = 0; c < this.COLS; c++) this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
            for (let c = mid - 1; c <= mid + 1; c++)
                if (c >= 0 && c < this.COLS) this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
        }
    }
    layoutBossSpiral(n) {
        const cx = Math.floor(this.COLS / 2);
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < this.COLS; c++) {
                const dx = c - cx;
                const ang = Math.atan2(r, dx);
                const dist = Math.sqrt(dx * dx + r * r);
                if (dist < 6 && (Math.floor(ang * 3 + dist) % 2 === 0))
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
            }
    }
    layoutBossFinal(n) {
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < this.COLS; c++)
                this.grid[r][c] = this.createBubble(Math.floor(Math.random() * n));
        for (let r = 0; r < 3; r++) {
            const color = Math.floor(Math.random() * n);
            for (let c = 0; c < this.COLS; c++)
                this.grid[r][c] = this.createBubble(color);
        }
    }

    createBubble(colorIdx) {
        this.totalBubbles++;
        return { color: this.COLORS[colorIdx], colorIdx, popping: false, newlyAdded: false, scale: 1, flash: 0, pulse: Math.random() * Math.PI * 2 };
    }

    // ============================================================
    // ECONOMY
    // ============================================================

    earnCoins(amount, x, y) {
        this.playerData.coins += amount;
        this.playerData.totalCoinsEarned += amount;
        this.levelCoins += amount;
        this.coinPopups.push({ x, y, text: `+${amount} 🪙`, color: '#FFD700', life: 80, opacity: 1, vy: -1.5 });
        this.hudFlash.coins = 15;
    }

    earnDiamonds(amount, x, y) {
        this.playerData.diamonds += amount;
        this.playerData.totalDiamondsEarned += amount;
        this.levelDiamonds += amount;
        this.diamondPopups.push({ x, y, text: `+${amount} 💎`, color: '#00D4FF', life: 100, opacity: 1, vy: -1.2 });
        this.hudFlash.diamonds = 15;
        if (window.audioManager) audioManager.play('achievement');
    }

    // ============================================================
    // POWER-UPS
    // ============================================================

    activatePowerUp(type) {
        if (!this.powerUps[type] || this.powerUps[type].count <= 0) return;
        if (this.activePowerUp) return;
        this.powerUps[type].count--;
        this.activePowerUp = type;
        this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2, text: `${this.powerUps[type].icon} ${this.powerUps[type].name} Activated!`, color: '#FFD700', life: 90, opacity: 1, size: 18 });
        if (window.audioManager) audioManager.play('powerUp');
        this.savePlayerData();
        this.calculateAimLine();
    }

    buyPowerUp(type) {
        if (this.playerData.coins >= this.powerUps[type].cost) {
            this.playerData.coins -= this.powerUps[type].cost;
            this.powerUps[type].count++;
            this.savePlayerData();
            this.floatingTexts.push({ x: this.canvas.width/2, y: this.canvas.height/2, text: `Bought ${this.powerUps[type].icon}!`, color: '#00FF88', life: 80, opacity: 1, size: 16 });
            return true;
        }
        return false;
    }

    // ============================================================
    // INPUT
    // ============================================================

    onMouseMove(e) {
        if (this.paused || this.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        this.updateAngle((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    }

    onTouchMove(e) {
        e.preventDefault();
        if (this.paused || this.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        this.updateAngle((e.touches[0].clientX - rect.left) * sx, (e.touches[0].clientY - rect.top) * sy);
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
        if (this.showDailyReward) { this.claimDailyReward(); return; }
        if (this.showLevelComplete) { this.nextLevel(); return; }
        if (e) {
            const rect = this.canvas.getBoundingClientRect();
            const sx = this.canvas.width / rect.width;
            const sy = this.canvas.height / rect.height;
            if (this.handleUITouch((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy)) return;
        }
        if (this.paused || this.gameOver || !this.canShoot || this.projectile) return;
        if (this.levelComplete || this.levelTransition) return;
        this.shoot();
    }

    onKeyDown(e) {
        if (this.destroyed) return;
        switch (e.key) {
            case '1': this.activatePowerUp('fireball'); break;
            case '2': this.activatePowerUp('rainbow');  break;
            case '3': this.activatePowerUp('bomb');     break;
            case '4': this.activatePowerUp('precision');break;
            case ' ': e.preventDefault(); this.onClick(); break;
        }
    }

    handleUITouch(mx, my) {
        const btnSize = 36, startX = 10;
        const btnY = this.shooterY + 20;
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
        angle = Math.max(-Math.PI + 0.15, Math.min(-0.15, angle));
        this.angle = angle;
        this.calculateAimLine();
    }

    // ============================================================
    // AIM LINE + GHOST BUBBLE
    // ============================================================

    calculateAimLine() {
        this.aimLine = [];
        this.ghostBubble = null;

        let x = this.shooterX;
        let y = this.shooterY;
        let vx = Math.cos(this.angle) * 20;
        let vy = Math.sin(this.angle) * 20;
        let bounces = 0;
        const maxBounces = this.activePowerUp === 'precision' ? 4 : 2;
        const steps = this.activePowerUp === 'precision' ? 60 : 40;

        for (let i = 0; i < steps; i++) {
            x += vx;
            y += vy;

            if (x <= this.BUBBLE_R) { x = this.BUBBLE_R; vx *= -1; bounces++; }
            if (x >= this.canvas.width - this.BUBBLE_R) { x = this.canvas.width - this.BUBBLE_R; vx *= -1; bounces++; }
            if (y <= this.BUBBLE_R + this.offsetY) {
                this.ghostBubble = this.findSnapCell(x, y);
                break;
            }

            this.aimLine.push({ x, y, t: i / steps });

            // Check if we'd hit a grid bubble — stop line here and show ghost
            let hit = false;
            for (let r = 0; r < this.ROWS && !hit; r++) {
                for (let c = 0; c < this.COLS && !hit; c++) {
                    if (!this.grid[r]?.[c]) continue;
                    const pos = this.getBubblePos(r, c);
                    const dx = x - pos.x, dy = y - pos.y;
                    if (dx * dx + dy * dy < (this.BUBBLE_R * 1.9) ** 2) {
                        this.ghostBubble = this.findSnapCell(x, y);
                        hit = true;
                    }
                }
            }
            if (hit) break;

            if (bounces >= maxBounces || y > this.shooterY) break;
        }
    }

    // Find best empty snap cell near (x, y) — used for ghost preview
    findSnapCell(px, py) {
        let bestR = -1, bestC = -1, bestDist = Infinity;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) continue;
                const pos = this.getBubblePos(r, c);
                const dx = px - pos.x, dy = py - pos.y;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist && Math.sqrt(dist) < this.BUBBLE_R * 4) {
                    bestDist = dist; bestR = r; bestC = c;
                }
            }
        }
        if (bestR === -1) return null;
        const pos = this.getBubblePos(bestR, bestC);
        return { r: bestR, c: bestC, x: pos.x, y: pos.y };
    }

    // ============================================================
    // SHOOT
    // ============================================================

    shoot() {
        this.canShoot = false;
        this.shotsUsed++;
        const isFireball = this.activePowerUp === 'fireball';
        const isRainbow  = this.activePowerUp === 'rainbow';
        const isBomb     = this.activePowerUp === 'bomb';

        this.projectile = {
            x: this.shooterX, y: this.shooterY,
            vx: Math.cos(this.angle) * this.projectileSpeed,
            vy: Math.sin(this.angle) * this.projectileSpeed,
            color:    isRainbow ? '#FFFFFF' : this.currentBubble.color,
            colorIdx: isRainbow ? -1 : this.currentBubble.colorIdx,
            trail: [],
            isFireball, isRainbow, isBomb,
            fireballHits: 0,
            fireballVisited: new Set()   // FIX: prevent re-hitting same bubble
        };

        if (this.activePowerUp) this.activePowerUp = null;
        this.ghostBubble = null;
        if (window.audioManager) audioManager.play('shoot');
        this.generateShooter();
    }

    // ============================================================
    // UPDATE
    // ============================================================

    update(dt) {
        if (this.paused || this.gameOver) return;
        this.time += dt;

        if (this.dailyRewardTimer > 0) this.dailyRewardTimer--;

        if (this.showLevelComplete) { this.levelCompleteTimer++; return; }

        if (this.levelTransition) {
            this.levelTransitionTimer--;
            if (this.levelTransitionTimer <= 0) {
                this.levelTransition = false;
                this.initLevel(this.level);
                this.generateShooter();
            }
            return;
        }

        // Stars
        this.stars.forEach(s => s.t += s.speed);
        this.nebulae.forEach(n => n.t += n.speed);

        // Shooter idle bob
        this.shooterBob += 0.03 * this.shooterBobDir;
        if (Math.abs(this.shooterBob) > 1.5) this.shooterBobDir *= -1;

        // Bubble pulse clock
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.grid[r]?.[c]) this.grid[r][c].pulse += 0.04;

        // Shake
        if (this.shakeTimer > 0) {
            this.shakeX = (Math.random() - 0.5) * 7 * (this.shakeTimer / 12);
            this.shakeY = (Math.random() - 0.5) * 3 * (this.shakeTimer / 12);
            this.shakeTimer--;
        } else { this.shakeX = this.shakeY = 0; }

        // Combo flash
        if (this.comboFlash.active) {
            this.comboFlash.alpha = Math.max(0, this.comboFlash.alpha - 0.04);
            if (this.comboFlash.alpha <= 0) this.comboFlash.active = false;
        }

        Object.keys(this.hudFlash).forEach(k => { if (this.hudFlash[k] > 0) this.hudFlash[k]--; });

        if (this.projectile) this.updateProjectile();

        // Particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
            p.life -= p.decay; p.vx *= 0.97;
            if (p.isRing) { p.radius += p.expandSpeed; }
            return p.life > 0;
        });

        this.fallingBubbles = this.fallingBubbles.filter(b => {
            b.vy += 0.4; b.y += b.vy; b.x += b.vx;
            b.rotation += b.rotSpeed; b.life -= 2;
            return b.life > 0 && b.y < this.canvas.height + 50;
        });

        this.popAnimations = this.popAnimations.filter(p => { p.scale += 0.18; p.opacity -= 0.07; return p.opacity > 0; });

        this.scorePopups = this.scorePopups.filter(p => { p.y -= 1.5; p.life -= 2; p.opacity = p.life / 60; return p.life > 0; });
        this.coinPopups  = this.coinPopups.filter(p  => { p.y += p.vy; p.life -= 2; p.opacity = Math.min(1, p.life / 40); return p.life > 0; });
        this.diamondPopups = this.diamondPopups.filter(p => { p.y += p.vy; p.life -= 1.5; p.opacity = Math.min(1, p.life / 50); return p.life > 0; });
        this.floatingTexts = this.floatingTexts.filter(t => { t.y -= 0.8; t.life -= 1; t.opacity = Math.min(1, t.life / 40); return t.life > 0; });

        // Newly added bubble entry animation
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (b?.newlyAdded) { b.scale = Math.min(1, (b.scale || 0) + 0.15); if (b.scale >= 1) b.newlyAdded = false; }
                if (b?.flash > 0) b.flash--;
            }

        // Drop row timer
        this.dropTimer += dt;
        if (this.dropTimer >= this.dropInterval) { this.dropTimer = 0; this.dropRow(); }
        this.dropWarning = (this.dropInterval - this.dropTimer) < 5000;

        this.levelProgress = this.bubblesPopped / this.levelGoal;
        if (this.bubblesPopped >= this.levelGoal && !this.levelComplete) this.completeLevel();

        const remaining = this.grid.flat().filter(Boolean).length;
        if (remaining === 0 && !this.levelComplete) {
            this.earnCoins(100, this.canvas.width/2, this.canvas.height/2);
            this.earnDiamonds(3, this.canvas.width/2, this.canvas.height/2+30);
            this.completeLevel();
        }

        this.checkGameOver();
    }

    updateProjectile() {
        const p = this.projectile;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 14) p.trail.shift();

        p.x += p.vx;
        p.y += p.vy;

        // Wall bounce
        if (p.x <= this.BUBBLE_R) { p.x = this.BUBBLE_R; p.vx *= -1; }
        if (p.x >= this.canvas.width - this.BUBBLE_R) { p.x = this.canvas.width - this.BUBBLE_R; p.vx *= -1; }

        // Top wall
        if (p.y <= this.BUBBLE_R + this.offsetY) {
            if (p.isFireball) { this.projectile = null; this.canShoot = true; return; }
            this.snapBubble(); return;
        }

        // Out of bounds
        if (p.y > this.canvas.height) { this.projectile = null; this.canShoot = true; return; }

        if (p.isFireball) { this.checkFireballCollision(); return; }
        this.checkGridCollision();
    }

    checkFireballCollision() {
        const p = this.projectile;
        if (!p) return;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.grid[r]?.[c]) continue;
                const key = `${r},${c}`;
                if (p.fireballVisited.has(key)) continue;
                const pos = this.getBubblePos(r, c);
                const dx = p.x - pos.x, dy = p.y - pos.y;
                if (Math.sqrt(dx*dx + dy*dy) < this.BUBBLE_R * 1.8) {
                    p.fireballVisited.add(key);
                    this.spawnPopParticles(pos.x, pos.y, this.grid[r][c].color, 8);
                    this.popAnimations.push({ x: pos.x, y: pos.y, color: this.grid[r][c].color, scale: 0.5, opacity: 1 });
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
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.grid[r]?.[c]) continue;
                const pos = this.getBubblePos(r, c);
                const dx = this.projectile.x - pos.x;
                const dy = this.projectile.y - pos.y;
                if (dx*dx + dy*dy < (this.BUBBLE_R * 1.9) ** 2) {
                    this.snapBubble(); return;
                }
            }
        }
    }

    // ============================================================
    // SNAP & MATCH
    // ============================================================

    snapBubble() {
        if (!this.projectile) return;

        let bestR = -1, bestC = -1, bestDist = Infinity;
        const snapRadius = this.BUBBLE_R * 3.5;

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) continue;

                // Must be adjacent to an existing bubble OR be in row 0
                let hasNeighbor = (r === 0);
                if (!hasNeighbor) {
                    for (const [nr, nc] of this.getNeighbors(r, c)) {
                        if (this.grid[nr]?.[nc]) { hasNeighbor = true; break; }
                    }
                }
                if (!hasNeighbor) continue;

                const pos = this.getBubblePos(r, c);
                const dx = this.projectile.x - pos.x;
                const dy = this.projectile.y - pos.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < bestDist && dist < snapRadius) { bestDist = dist; bestR = r; bestC = c; }
            }
        }

        // Fallback: place at top row
        if (bestR === -1) {
            bestR = 0;
            bestC = Math.max(0, Math.min(this.COLS - 1, Math.round((this.projectile.x - this.offsetX) / this.cellW)));
        }

        if (bestR !== -1 && bestC !== -1) {
            if (this.projectile.isBomb) {
                this.explodeBomb(bestR, bestC);
                this.projectile = null;
                this.canShoot = true;
                return;
            }

            let snapColorIdx = this.projectile.colorIdx;
            if (this.projectile.isRainbow) {
                const colorCounts = {};
                for (const [nr, nc] of this.getNeighbors(bestR, bestC)) {
                    if (this.grid[nr]?.[nc]) {
                        const ci = this.grid[nr][nc].colorIdx;
                        colorCounts[ci] = (colorCounts[ci] || 0) + 1;
                    }
                }
                const best = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
                if (best) snapColorIdx = parseInt(best[0]);
            }

            const colorIdx = Math.max(0, Math.min(this.COLORS.length - 1, snapColorIdx));
            this.grid[bestR][bestC] = {
                color: this.COLORS[colorIdx],
                colorIdx,
                popping: false, newlyAdded: true, scale: 0.2, flash: 0,
                pulse: Math.random() * Math.PI * 2
            };

            const matches = this.findMatches(bestR, bestC);
            if (matches.length >= 3) {
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this.popBubbles(matches, bestR, bestC);
            } else {
                this.combo = 0;
                if (window.audioManager) audioManager.play('pop');
                if (this.grid[bestR]?.[bestC]) this.grid[bestR][bestC].flash = 6;
            }

            setTimeout(() => this.dropFloatingBubbles(), 150);
        }

        this.projectile = null;
        this.canShoot = true;
        this.updateColorsInPlay();
    }

    explodeBomb(r, c) {
        const radius = 2;
        let destroyed = 0;
        const pos0 = this.getBubblePos(r, c);

        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= this.ROWS || nc < 0 || nc >= this.COLS) continue;
                if (!this.grid[nr]?.[nc]) continue;
                if (Math.sqrt(dr*dr + dc*dc) <= radius + 0.5) {
                    const pos = this.getBubblePos(nr, nc);
                    this.spawnPopParticles(pos.x, pos.y, this.grid[nr][nc].color, 6);
                    this.popAnimations.push({ x: pos.x, y: pos.y, color: this.grid[nr][nc].color, scale: 0.5, opacity: 1 });
                    this.grid[nr][nc] = null;
                    destroyed++;
                }
            }
        }

        this.bubblesPopped += destroyed;
        const bombScore = destroyed * 15;
        this.score += bombScore;
        this.onScore(this.score);
        this.earnCoins(destroyed * 3, pos0.x, pos0.y);
        this.shakeTimer = 14;
        this.spawnShockwave(pos0.x, pos0.y, '#FF8C00');
        if (window.audioManager) audioManager.play('levelUp');
        this.scorePopups.push({ x: pos0.x, y: pos0.y, text: `💣 BOOM! +${bombScore}`, color: '#FF8C00', life: 80, opacity: 1 });
        setTimeout(() => this.dropFloatingBubbles(), 200);
    }

    // ============================================================
    // MATCH
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
            if (visited.has(key) || r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) continue;
            if (!this.grid[r]?.[c] || this.grid[r][c].colorIdx !== target) continue;
            visited.add(key);
            matches.push([r, c]);
            for (const [nr, nc] of this.getNeighbors(r, c)) queue.push([nr, nc]);
        }
        return matches;
    }

    getNeighbors(r, c) {
        return r % 2 === 1
            ? [[r-1,c],[r-1,c+1],[r,c-1],[r,c+1],[r+1,c],[r+1,c+1]]
            : [[r-1,c-1],[r-1,c],[r,c-1],[r,c+1],[r+1,c-1],[r+1,c]];
    }

    getBubblePos(r, c) {
        const offsetX = r % 2 === 1 ? this.BUBBLE_R : 0;
        return { x: this.offsetX + c * this.cellW + offsetX, y: this.offsetY + r * this.cellH };
    }

    updateColorsInPlay() {
        const used = new Set();
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.grid[r]?.[c]) used.add(this.grid[r][c].colorIdx);
        this.colorsInPlay = [...used];
        if (this.colorsInPlay.length === 0)
            this.colorsInPlay = Array.from({ length: Math.min(3, this.levelConfig?.colors || 3) }, (_, i) => i);
    }

    generateShooter() {
        this.currentBubble = this.nextBubble || this.randomBubble();
        this.nextBubble = this.randomBubble();
        this.calculateAimLine();
    }

    randomBubble() {
        const pool = this.colorsInPlay.length > 0 ? this.colorsInPlay : [0, 1, 2];
        const colorIdx = pool[Math.floor(Math.random() * pool.length)];
        return { color: this.COLORS[colorIdx], colorIdx };
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
        const originPos  = this.getBubblePos(originR, originC);
        this.earnCoins(coinReward, originPos.x, originPos.y);

        if (comboMult >= 3 || (matches.length >= 5 && Math.random() < 0.3)) {
            this.earnDiamonds(comboMult >= 5 ? 2 : 1, originPos.x, originPos.y - 20);
        }

        // Combo flash screen
        if (comboMult >= 2) {
            this.comboFlash.active = true;
            this.comboFlash.alpha  = Math.min(0.35, comboMult * 0.06);
            this.comboFlash.color  = comboMult >= 5 ? '#FF2D6B' : '#FFD600';
        }

        matches.forEach(([r, c]) => {
            const pos   = this.getBubblePos(r, c);
            const color = this.grid[r][c].color;
            this.popAnimations.push({ x: pos.x, y: pos.y, color, scale: 0.4, opacity: 1 });
            this.spawnPopParticles(pos.x, pos.y, color, 12);
            this.spawnShockwave(pos.x, pos.y, color);
            this.grid[r][c] = null;
        });

        this.scorePopups.push({
            x: originPos.x, y: originPos.y,
            text: comboMult > 1 ? `x${comboMult} COMBO! +${comboScore}` : `+${comboScore}`,
            color: comboMult > 2 ? '#FFD700' : '#00F5A0',
            life: 70, opacity: 1
        });

        this.onScore(this.score);
        this.shakeTimer = comboMult > 2 ? 10 : 4;
        if (window.audioManager) {
            if (this.combo >= 3) audioManager.play('levelUp');
            else audioManager.play('success');
        }
    }

    dropFloatingBubbles() {
        const connected = new Set();
        const queue = [];
        for (let c = 0; c < this.COLS; c++)
            if (this.grid[0]?.[c]) queue.push([0, c]);

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            if (connected.has(key) || r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) continue;
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
                        vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3,
                        color: this.grid[r][c].color, rotation: 0,
                        rotSpeed: (Math.random() - 0.5) * 0.2,
                        life: 80, r: this.BUBBLE_R
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
            this.earnCoins(dropped * 2, this.canvas.width/2, this.canvas.height/2);
            this.onScore(this.score);
            if (window.audioManager) audioManager.play('levelUp');
            this.scorePopups.push({ x: this.canvas.width/2, y: this.canvas.height/2, text: `${dropped} Dropped! +${bonus}`, color: '#FF8C00', life: 80, opacity: 1 });
        }
    }

    dropRow() {
        for (let r = this.ROWS - 1; r > 0; r--)
            this.grid[r] = this.grid[r - 1] ? [...this.grid[r - 1]] : [];
        this.grid[0] = [];
        const n = this.levelConfig?.colors || 4;
        for (let c = 0; c < this.COLS; c++)
            this.grid[0][c] = this.createBubble(Math.floor(Math.random() * n));
        this.updateColorsInPlay();
        if (window.audioManager) audioManager.play('fail');
        this.shakeTimer = 10;
    }

    // ============================================================
    // LEVEL COMPLETE
    // ============================================================

    completeLevel() {
        this.levelComplete = true;
        this.showLevelComplete = true;
        this.levelCompleteTimer = 0;

        const eff = this.levelGoal / Math.max(1, this.shotsUsed);
        this.starRating = eff >= 0.8 ? 3 : eff >= 0.5 ? 2 : 1;

        const coins  = 50 + this.level * 10 + this.starRating * 20;
        const diamonds = this.starRating >= 3 ? 3 : this.starRating >= 2 ? 1 : 0;
        const bonus  = this.maxCombo * 5;

        this.earnCoins(coins + bonus, this.canvas.width/2, this.canvas.height/2 - 60);
        if (diamonds > 0) this.earnDiamonds(diamonds, this.canvas.width/2, this.canvas.height/2 - 30);

        if (this.levelConfig?.layout?.startsWith('boss')) {
            this.earnDiamonds(5, this.canvas.width/2, this.canvas.height/2);
            this.earnCoins(200, this.canvas.width/2, this.canvas.height/2 + 20);
        }

        const prevStars = this.playerData.levelStars[this.level] || 0;
        if (this.starRating > prevStars) this.playerData.levelStars[this.level] = this.starRating;
        if (this.level >= this.playerData.highestLevel) this.playerData.highestLevel = this.level + 1;

        this.playerData.currentLevel = this.level;
        this.playerData.totalScore   += this.score;
        this.playerData.totalPopped  += this.bubblesPopped;
        this.playerData.gamesPlayed++;
        this.savePlayerData();

        for (let i = 0; i < 35; i++) {
            setTimeout(() => {
                if (this.destroyed) return;
                this.spawnPopParticles(
                    Math.random() * this.canvas.width,
                    Math.random() * this.canvas.height * 0.5,
                    this.COLORS[Math.floor(Math.random() * this.COLORS.length)], 6
                );
            }, i * 55);
        }

        if (window.audioManager) audioManager.play('achievement');
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
                this.playerData.totalScore  += this.score;
                this.playerData.totalPopped += this.bubblesPopped;
                this.playerData.gamesPlayed++;
                this.savePlayerData();
                setTimeout(() => this.onScore(this.score, true, { level: this.level, coins: this.levelCoins, diamonds: this.levelDiamonds }), 1000);
                return;
            }
        }
    }

    // ============================================================
    // PARTICLES — ring-burst, shards, sparkles
    // ============================================================

    spawnPopParticles(x, y, color, count) {
        // Shard particles
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
            const speed = Math.random() * 5 + 2.5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color, size: Math.random() * 4 + 2,
                life: 1, decay: Math.random() * 0.035 + 0.02,
                gravity: 0.14, isRing: false
            });
        }
        // White sparkles
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 16,
                y: y + (Math.random() - 0.5) * 16,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3 - 1,
                color: '#FFFFFF', size: Math.random() * 2.5 + 1,
                life: 1, decay: 0.055, gravity: 0, sparkle: true, isRing: false
            });
        }
    }

    spawnShockwave(x, y, color) {
        this.particles.push({
            x, y, vx: 0, vy: 0, color,
            size: 2, radius: this.BUBBLE_R * 0.4,
            life: 1, decay: 0.06, gravity: 0,
            isRing: true, expandSpeed: this.BUBBLE_R * 0.25
        });
    }

    // ============================================================
    // DRAW
    // ============================================================

    draw() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.clearRect(0, 0, W, H);

        ctx.save();
        if (this.shakeX || this.shakeY) ctx.translate(this.shakeX, this.shakeY);

        this.drawBackground();
        this.drawGridDots();
        this.drawLevelProgress();
        this.drawDropWarning();
        this.drawGrid();
        this.drawFallingBubbles();
        this.drawPopAnimations();
        this.drawParticles();
        this.drawAimLine();
        this.drawGhostBubble();
        this.drawShooter();
        this.drawProjectile();
        this.drawComboFlash();
        this.drawScorePopups();
        this.drawCoinPopups();
        this.drawDiamondPopups();
        this.drawFloatingTexts();
        this.drawHUD();
        this.drawPowerUpBar();

        ctx.restore();

        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyReward();
        if (this.showLevelComplete) this.drawLevelComplete();
        if (this.levelTransition)   this.drawLevelTransition();
        if (this.gameOver)          this.drawGameOver();
    }

    // ---- Background ----

    drawBackground() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;

        // Deep space gradient
        const grad = ctx.createRadialGradient(W/2, 0, 0, W/2, H, H);
        grad.addColorStop(0,   '#0d0820');
        grad.addColorStop(0.5, '#080615');
        grad.addColorStop(1,   '#030308');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Nebula blobs
        this.nebulae.forEach(n => {
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r + Math.sin(n.t) * 15);
            g.addColorStop(0, n.color + 'cc');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r + Math.sin(n.t) * 15, 0, Math.PI * 2);
            ctx.fill();
        });

        // Stars
        this.stars.forEach(s => {
            const blink = (Math.sin(s.t) + 1) / 2;
            ctx.globalAlpha = 0.1 + blink * 0.7;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Play area subtle glow
        const areaGrad = ctx.createLinearGradient(this.offsetX - this.BUBBLE_R, 0, this.offsetX - this.BUBBLE_R + this.COLS * this.cellW, 0);
        areaGrad.addColorStop(0, 'rgba(192,64,255,0.04)');
        areaGrad.addColorStop(0.5, 'rgba(0,200,255,0.03)');
        areaGrad.addColorStop(1, 'rgba(192,64,255,0.04)');
        ctx.fillStyle = areaGrad;
        ctx.fillRect(this.offsetX - this.BUBBLE_R, this.offsetY - 5, this.COLS * this.cellW, this.ROWS * this.cellH);
    }

    // Subtle dots showing empty grid cells
    drawGridDots() {
        const ctx = this.ctx;
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = '#a070ff';
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) continue;
                const pos = this.getBubblePos(r, c);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    // ---- Progress bar ----

    drawLevelProgress() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const barW = W - 20, barH = 5, barX = 10, barY = 43;
        const progress = Math.min(1, this.levelProgress);

        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.roundRect?.(barX, barY, barW, barH, 3) || ctx.fillRect(barX, barY, barW, barH);
        ctx.fill();

        // Fill
        if (progress > 0) {
            const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            g.addColorStop(0, '#C040FF');
            g.addColorStop(0.5, '#00C8FF');
            g.addColorStop(1, '#00F5A0');
            ctx.fillStyle = g;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00C8FF';
            ctx.beginPath();
            ctx.roundRect?.(barX, barY, barW * progress, barH, 3) || ctx.fillRect(barX, barY, barW * progress, barH);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    drawDropWarning() {
        if (!this.dropWarning) return;
        const pct = (this.dropInterval - this.dropTimer) / 5000;
        const pulse = (1 - pct) * 0.25 * Math.abs(Math.sin(this.time / 200));
        this.ctx.fillStyle = `rgba(255,0,80,${pulse})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ---- Grid ----

    drawGrid() {
        const ctx = this.ctx;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;
                const pos = this.getBubblePos(r, c);
                let scale = b.scale || 1;
                const pulse = 1 + Math.sin(b.pulse) * 0.015; // subtle idle pulse

                if (b.flash > 0) ctx.globalAlpha = 0.4 + (b.flash / 10) * 0.6;

                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.scale(scale * pulse, scale * pulse);
                this.drawBubble(ctx, 0, 0, this.BUBBLE_R, b.color, b.colorIdx);
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        }
    }

    // Premium glass bubble with rim light, inner glow, specular
    drawBubble(ctx, x, y, r, color, colorIdx) {
        const glowColor = (colorIdx !== undefined && this.GLOW_COLORS[colorIdx]) ? this.GLOW_COLORS[colorIdx] : this.lightenColor(color, 70);

        // Outer glow
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;

        // Main fill — deep gradient
        const grad = ctx.createRadialGradient(x - r*0.25, y - r*0.3, r*0.05, x, y, r);
        grad.addColorStop(0,   glowColor);
        grad.addColorStop(0.45, color);
        grad.addColorStop(0.78, this.darkenColor(color, 55));
        grad.addColorStop(1,    this.darkenColor(color, 80));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Rim light (bottom-right arc)
        ctx.beginPath();
        ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner bottom rim glow
        const rimGrad = ctx.createRadialGradient(x + r*0.3, y + r*0.35, 0, x + r*0.3, y + r*0.35, r*0.7);
        rimGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
        rimGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = rimGrad;
        ctx.fill();

        // Top-left specular highlight (sharp)
        const shine = ctx.createRadialGradient(x - r*0.38, y - r*0.4, 0, x - r*0.25, y - r*0.3, r*0.52);
        shine.addColorStop(0,   'rgba(255,255,255,0.72)');
        shine.addColorStop(0.4, 'rgba(255,255,255,0.2)');
        shine.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = shine;
        ctx.fill();

        // Small secondary highlight dot
        ctx.beginPath();
        ctx.arc(x + r*0.28, y + r*0.28, r*0.12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
    }

    // ---- Ghost bubble ----

    drawGhostBubble() {
        if (!this.ghostBubble || !this.currentBubble || this.projectile) return;
        const ctx = this.ctx;
        const { x, y } = this.ghostBubble;
        const color = this.activePowerUp === 'rainbow' ? `hsl(${(this.time/10)%360},100%,60%)`
            : this.activePowerUp === 'fireball' ? '#FF4500'
            : this.activePowerUp === 'bomb' ? '#555'
            : this.currentBubble.color;

        ctx.globalAlpha = 0.35 + Math.sin(this.time / 150) * 0.08;
        ctx.save();
        ctx.translate(x, y);
        this.drawBubble(ctx, 0, 0, this.BUBBLE_R, color, this.currentBubble.colorIdx);
        ctx.restore();

        // Dashed outline ring
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -(this.time / 60) % 8;
        ctx.beginPath();
        ctx.arc(x, y, this.BUBBLE_R + 2, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        ctx.globalAlpha = 1;
    }

    // ---- Aim line ----

    drawAimLine() {
        if (this.aimLine.length < 2) return;
        const ctx = this.ctx;
        const dashOffset = (this.time / 50) % 20;

        for (let i = 1; i < this.aimLine.length; i++) {
            const prev = this.aimLine[i - 1];
            const curr = this.aimLine[i];
            const alpha = (1 - prev.t) * 0.65;
            const w     = this.activePowerUp === 'precision' ? 2.5 : 1.8;

            ctx.setLineDash([7, 5]);
            ctx.lineDashOffset = -dashOffset;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = w;
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(180,130,255,0.6)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Tip dot
        const last = this.aimLine[this.aimLine.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#fff';
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ---- Shooter cannon ----

    drawShooter() {
        const ctx = this.ctx;
        const x   = this.shooterX;
        const y   = this.shooterY + this.shooterBob;

        // Platform shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(x, y + 40, 42, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Platform base
        const baseGrad = ctx.createLinearGradient(x-38, y+22, x+38, y+42);
        baseGrad.addColorStop(0,   '#1a0a30');
        baseGrad.addColorStop(0.5, '#3d1870');
        baseGrad.addColorStop(1,   '#1a0a30');
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 34, 38, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Platform rim glow
        ctx.strokeStyle = 'rgba(192,64,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#C040FF';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Barrel
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);

        // Barrel outer
        const barrelGrad = ctx.createLinearGradient(0, -7, 0, 7);
        barrelGrad.addColorStop(0,   '#9050e0');
        barrelGrad.addColorStop(0.5, '#C040FF');
        barrelGrad.addColorStop(1,   '#5020a0');
        ctx.fillStyle = barrelGrad;
        const bx = 10, blen = 34, bh = 12;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, -bh/2, blen, bh, 4);
        else ctx.rect(bx, -bh/2, blen, bh);
        ctx.fill();

        // Barrel glow
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#C040FF';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Muzzle accent
        ctx.fillStyle = '#00C8FF';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00C8FF';
        ctx.fillRect(bx + blen - 4, -bh/2, 4, bh);
        ctx.shadowBlur = 0;

        // Barrel stripe
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(bx + 8, -2, blen - 16, 3);

        ctx.restore();

        // Current bubble in chamber
        let bubbleColor = this.currentBubble.color;
        let bubbleColorIdx = this.currentBubble.colorIdx;
        let extraIcon = null;

        if (this.activePowerUp === 'fireball') {
            ctx.globalAlpha = 0.6 + Math.sin(this.time / 100) * 0.4;
            bubbleColor = '#FF4500'; bubbleColorIdx = undefined; extraIcon = '🔥';
        } else if (this.activePowerUp === 'rainbow') {
            bubbleColor = `hsl(${(this.time/10)%360},100%,60%)`; bubbleColorIdx = undefined; extraIcon = '🌈';
        } else if (this.activePowerUp === 'bomb') {
            bubbleColor = '#444'; bubbleColorIdx = undefined; extraIcon = '💣';
        }

        this.drawBubble(ctx, x, y, this.BUBBLE_R, bubbleColor, bubbleColorIdx);
        ctx.globalAlpha = 1;

        if (extraIcon) {
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(extraIcon, x, y);
        }

        // Next bubble preview
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('NEXT', x + 58, y + 4);
        this.drawBubble(ctx, x + 58, y + 22, this.BUBBLE_R - 7, this.nextBubble.color, this.nextBubble.colorIdx);
        ctx.textAlign = 'left';
    }

    // ---- Projectile ----

    drawProjectile() {
        if (!this.projectile) return;
        const ctx = this.ctx;
        const p = this.projectile;

        // Trail — gradient fade
        p.trail.forEach((t, i) => {
            const alpha = (i / p.trail.length) * 0.45;
            const size  = this.BUBBLE_R * (i / p.trail.length) * 0.75;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(2, size), 0, Math.PI * 2);
            ctx.fillStyle = p.isFireball ? '#FF4500' : p.color;
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        let drawColor = p.color;
        let drawColorIdx = p.colorIdx >= 0 ? p.colorIdx : undefined;
        if (p.isFireball) { drawColor = '#FF4500'; drawColorIdx = undefined; }
        if (p.isRainbow)  { drawColor = `hsl(${(this.time/10)%360},100%,60%)`; drawColorIdx = undefined; }
        if (p.isBomb)     { drawColor = '#555'; drawColorIdx = undefined; }

        this.drawBubble(ctx, p.x, p.y, this.BUBBLE_R, drawColor, drawColorIdx);

        if (p.isFireball || p.isBomb) {
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.isFireball ? '🔥' : '💣', p.x, p.y);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    // ---- Combo flash ----

    drawComboFlash() {
        if (!this.comboFlash.active || this.comboFlash.alpha <= 0) return;
        const ctx = this.ctx;
        ctx.fillStyle = this.comboFlash.color;
        ctx.globalAlpha = this.comboFlash.alpha;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalAlpha = 1;
    }

    // ---- Falling bubbles ----

    drawFallingBubbles() {
        const ctx = this.ctx;
        this.fallingBubbles.forEach(b => {
            ctx.globalAlpha = b.life / 80;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rotation);
            this.drawBubble(ctx, 0, 0, b.r, b.color);
            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    // ---- Pop rings ----

    drawPopAnimations() {
        const ctx = this.ctx;
        this.popAnimations.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 14;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.BUBBLE_R * p.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    // ---- Particles ----

    drawParticles() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            if (p.isRing) {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = p.life * 0.6;
                ctx.shadowBlur = 8;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (p.sparkle) {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 6;
                ctx.shadowColor = p.color;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });
        ctx.globalAlpha = 1;
    }

    // ---- Popups ----

    drawScorePopups() {
        const ctx = this.ctx;
        this.scorePopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 15px Orbitron, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    drawCoinPopups() {
        const ctx = this.ctx;
        this.coinPopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 12px Orbitron, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y);
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    drawDiamondPopups() {
        const ctx = this.ctx;
        this.diamondPopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 13px Orbitron, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00D4FF';
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    drawFloatingTexts() {
        const ctx = this.ctx;
        this.floatingTexts.forEach(t => {
            ctx.globalAlpha = t.opacity;
            ctx.font = `bold ${t.size || 16}px Orbitron, monospace`;
            ctx.textAlign = 'center';
            ctx.fillStyle = t.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = t.color;
            ctx.fillText(t.text, t.x, t.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    // ============================================================
    // HUD
    // ============================================================

    drawHUD() {
        const ctx = this.ctx;
        const W = this.canvas.width;

        // Top bar blur backing
        ctx.fillStyle = 'rgba(5,3,15,0.72)';
        ctx.fillRect(0, 0, W, 42);

        // Left: Level
        ctx.fillStyle = '#C040FF';
        ctx.font = 'bold 12px Orbitron, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`LVL ${this.level}`, 8, 16);

        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '9px monospace';
        ctx.fillText(this.levelConfig?.name || '', 8, 30);

        // Center: goal + combo
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00C8FF';
        ctx.font = '11px Orbitron, monospace';
        ctx.fillText(`${this.bubblesPopped} / ${this.levelGoal}`, W/2, 15);

        if (this.combo > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.font = `bold ${10 + Math.min(this.combo, 6)}px Orbitron, monospace`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#FFD700';
            ctx.fillText(`✦ x${this.combo} COMBO`, W/2, 31);
            ctx.shadowBlur = 0;
        }

        // Right: coins + diamonds
        ctx.textAlign = 'right';
        const cAlpha = this.hudFlash.coins > 0 ? 1 : 0.75;
        ctx.font = `bold 11px Orbitron, monospace`;
        ctx.fillStyle = `rgba(255,214,0,${cAlpha})`;
        if (this.hudFlash.coins > 0) { ctx.shadowBlur = 8; ctx.shadowColor = '#FFD700'; }
        ctx.fillText(`🪙 ${this.playerData.coins}`, W - 8, 16);
        ctx.shadowBlur = 0;

        const dAlpha = this.hudFlash.diamonds > 0 ? 1 : 0.75;
        ctx.fillStyle = `rgba(0,200,255,${dAlpha})`;
        if (this.hudFlash.diamonds > 0) { ctx.shadowBlur = 8; ctx.shadowColor = '#00C8FF'; }
        ctx.fillText(`💎 ${this.playerData.diamonds}`, W - 8, 31);
        ctx.shadowBlur = 0;

        ctx.textAlign = 'left';

        // Drop timer bar (bottom strip)
        if (this.dropWarning) {
            const pct = (this.dropInterval - this.dropTimer) / 5000;
            const g = ctx.createLinearGradient(0, 0, W * pct, 0);
            g.addColorStop(0, '#FF2D6B');
            g.addColorStop(1, '#FF7A00');
            ctx.fillStyle = g;
            ctx.fillRect(0, this.canvas.height - 4, W * pct, 4);
        }
    }

    drawPowerUpBar() {
        const ctx = this.ctx;
        const btnSize = 34;
        const btnY = this.shooterY + 20 + this.shooterBob;
        const startX = 8;
        let idx = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx = startX + idx * (btnSize + 6);
            const isActive = this.activePowerUp === key;

            // bg pill
            ctx.fillStyle = isActive ? 'rgba(255,214,0,0.22)' : 'rgba(192,64,255,0.12)';
            ctx.strokeStyle = isActive ? '#FFD700' : 'rgba(192,64,255,0.35)';
            ctx.lineWidth = 1;
            if (isActive) { ctx.shadowBlur = 10; ctx.shadowColor = '#FFD700'; }
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(bx, btnY, btnSize, btnSize, 7);
            else ctx.rect(bx, btnY, btnSize, btnSize);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Icon
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pup.icon, bx + btnSize/2, btnY + btnSize/2 - 4);

            // Count
            ctx.font = `bold 9px monospace`;
            ctx.fillStyle = pup.count > 0 ? '#00F5A0' : '#FF2D6B';
            ctx.fillText(`${pup.count}`, bx + btnSize/2, btnY + btnSize - 5);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            idx++;
        }

        // Keyboard hints
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.font = '8px monospace';
        ['1','2','3','4'].forEach((k, i) => {
            ctx.fillText(k, startX + i * (btnSize + 6) + btnSize/2 - 3, btnY - 4);
        });
    }

    // ============================================================
    // DAILY REWARD SCREEN
    // ============================================================

    drawDailyReward() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, 0, W, H);

        const cw = Math.min(310, W - 40), ch = 265;
        const cx = (W - cw)/2, cy = (H - ch)/2;

        // Card
        const cardGrad = ctx.createLinearGradient(cx, cy, cx, cy + ch);
        cardGrad.addColorStop(0, 'rgba(20,10,40,0.98)');
        cardGrad.addColorStop(1, 'rgba(10,5,25,0.98)');
        ctx.fillStyle = cardGrad;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#FFD700';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx, cy, cw, ch, 18);
        else ctx.rect(cx, cy, cw, ch);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 19px Orbitron, monospace';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('🎁  Daily Reward!', W/2, cy + 38);

        ctx.font = '13px monospace';
        ctx.fillStyle = '#00C8FF';
        ctx.fillText(`Day ${this.playerData.dailyStreak + 1} Streak 🔥`, W/2, cy + 62);

        const streak = this.playerData.dailyStreak;
        const mult   = Math.min(1 + streak * 0.25, 3);
        const coins  = Math.floor(50 * mult);
        const diamonds = Math.floor(2 * Math.max(1, Math.floor(streak/3)));

        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙  ${coins}`, W/2, cy + 105);

        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#00C8FF';
        ctx.fillText(`💎  ${diamonds}`, W/2, cy + 140);

        if (streak > 0 && streak % 5 === 0) {
            ctx.font = '12px monospace';
            ctx.fillStyle = '#00F5A0';
            ctx.fillText('+ Bonus Power-up! 🎉', W/2, cy + 168);
        }

        // Button
        const bw = 150, bh = 38;
        const bx = (W - bw)/2, by = cy + ch - 52;
        const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        bg.addColorStop(0, '#C040FF');
        bg.addColorStop(1, '#FF2D6B');
        ctx.fillStyle = bg;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#C040FF';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 20);
        else ctx.rect(bx, by, bw, bh);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 13px Orbitron, monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText('CLAIM!', W/2, by + 24);
        ctx.textAlign = 'left';
    }

    // ============================================================
    // LEVEL COMPLETE SCREEN
    // ============================================================

    drawLevelComplete() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, W, H);

        const cw = Math.min(340, W - 30), ch = 320;
        const cx = (W - cw)/2, cy = (H - ch)/2;

        const cardGrad = ctx.createLinearGradient(cx, cy, cx, cy + ch);
        cardGrad.addColorStop(0, 'rgba(5,20,10,0.98)');
        cardGrad.addColorStop(1, 'rgba(3,10,5,0.98)');
        ctx.fillStyle = cardGrad;
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#00F5A0';
        ctx.strokeStyle = '#00F5A0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx, cy, cw, ch, 18);
        else ctx.rect(cx, cy, cw, ch);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 20px Orbitron, monospace';
        ctx.fillStyle = '#00F5A0';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00F5A0';
        ctx.fillText('LEVEL COMPLETE! 🎉', W/2, cy + 38);
        ctx.shadowBlur = 0;

        // Stars
        for (let i = 0; i < 3; i++) {
            ctx.font = '30px Arial';
            const sx = W/2 + (i - 1) * 44;
            ctx.fillText(i < this.starRating ? '⭐' : '☆', sx, cy + 76);
        }

        ctx.font = '13px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`Score: ${this.score}`,             W/2, cy + 115);
        ctx.fillText(`Bubbles Popped: ${this.bubblesPopped}`, W/2, cy + 138);
        ctx.fillText(`Best Combo: x${this.maxCombo}`,   W/2, cy + 161);
        ctx.fillText(`Shots Used: ${this.shotsUsed}`,   W/2, cy + 184);

        ctx.font = 'bold 15px Orbitron, monospace';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 +${this.levelCoins}`, W/2, cy + 220);
        if (this.levelDiamonds > 0) {
            ctx.fillStyle = '#00C8FF';
            ctx.fillText(`💎 +${this.levelDiamonds}`, W/2, cy + 245);
        }

        // Next button
        const bw = 160, bh = 38;
        const bx = (W - bw)/2, by = cy + ch - 50;
        const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        bg.addColorStop(0, '#00C8FF');
        bg.addColorStop(1, '#00F5A0');
        ctx.fillStyle = bg;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00C8FF';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 20);
        else ctx.rect(bx, by, bw, bh);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 12px Orbitron, monospace';
        ctx.fillStyle = '#050510';
        ctx.fillText('NEXT LEVEL →', W/2, by + 24);
        ctx.textAlign = 'left';
    }

    drawLevelTransition() {
        const progress = 1 - (this.levelTransitionTimer / 60);
        this.ctx.fillStyle = `rgba(5,5,14,${1 - progress})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGameOver() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#FF2D6B';
        ctx.font = 'bold 28px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 24;
        ctx.shadowColor = '#FF2D6B';
        ctx.fillText('GAME OVER', W/2, H/2 - 52);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = '14px monospace';
        ctx.fillText(`Score: ${this.score}`,       W/2, H/2 - 10);
        ctx.fillText(`Level: ${this.level}`,       W/2, H/2 + 14);
        ctx.fillText(`Best Combo: x${this.maxCombo}`, W/2, H/2 + 38);

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 13px Orbitron, monospace';
        ctx.fillText(`🪙 ${this.levelCoins} earned`, W/2, H/2 + 74);
        ctx.fillStyle = '#00C8FF';
        ctx.fillText(`💎 ${this.levelDiamonds} earned`, W/2, H/2 + 98);
        ctx.textAlign = 'left';
    }

    // ============================================================
    // UTILS
    // ============================================================

    lightenColor(hex, amt) {
        if (!hex.startsWith('#')) return hex;
        return `rgb(${Math.min(255,parseInt(hex.slice(1,3),16)+amt)},${Math.min(255,parseInt(hex.slice(3,5),16)+amt)},${Math.min(255,parseInt(hex.slice(5,7),16)+amt)})`;
    }

    darkenColor(hex, amt) {
        if (!hex.startsWith('#')) return hex;
        return `rgb(${Math.max(0,parseInt(hex.slice(1,3),16)-amt)},${Math.max(0,parseInt(hex.slice(3,5),16)-amt)},${Math.max(0,parseInt(hex.slice(5,7),16)-amt)})`;
    }

    // ============================================================
    // GAME LOOP
    // ============================================================

    loop(timestamp) {
        if (this.destroyed) return;
        const dt = timestamp - (this.lastTime || timestamp);
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
        this.BUBBLE_R = Math.min(Math.floor(this.canvas.width / (this.COLS * 2 + 1)), 22);
        this.cellW = this.BUBBLE_R * 2;
        this.cellH = this.BUBBLE_R * 1.85;
        this.offsetX = (this.canvas.width - this.COLS * this.cellW) / 2 + this.BUBBLE_R;
        this.shooterX = this.canvas.width / 2;
        this.shooterY = this.canvas.height - 55;
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('click',     this.boundClick);
        this.canvas.removeEventListener('touchend',  this.boundTouch);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        document.removeEventListener('keydown',      this.boundKeyDown);
        this.savePlayerData();
    }
}