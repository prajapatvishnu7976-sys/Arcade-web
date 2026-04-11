/* ============================================================
   BUBBLE SHOOTER v3.0 - KHATARNAK PREMIUM EDITION
   Levels, Coins, Diamonds, Daily Rewards, Power-ups
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
        this.COLORS = ['#FF006E', '#00D4FF', '#00FF88', '#FFD700', '#B347D9', '#FF8C00', '#FF3864', '#00FFAB'];
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

        // Animations
        this.particles = [];
        this.fallingBubbles = [];
        this.aimLine = [];
        this.shakeX = 0;
        this.shakeTimer = 0;
        this.popAnimations = [];
        this.scorePopups = [];
        this.coinPopups = [];
        this.diamondPopups = [];
        this.floatingTexts = [];

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
            rainbow: { count: this.playerData.powerUps?.rainbow || 0, active: false, icon: '🌈', name: 'Rainbow', cost: 75, desc: 'Matches any color' },
            bomb: { count: this.playerData.powerUps?.bomb || 0, active: false, icon: '💣', name: 'Bomb', cost: 100, desc: 'Explodes area around impact' },
            precision: { count: this.playerData.powerUps?.precision || 0, active: false, icon: '🎯', name: 'Precision', cost: 30, desc: 'Extended aim guide' }
        };
        this.activePowerUp = null;
        this.powerUpTimer = 0;

        // Daily reward
        this.dailyRewardClaimed = false;
        this.showDailyReward = false;
        this.dailyRewardTimer = 0;
        this.checkDailyReward();

        // Background
        this.stars = Array.from({ length: 60 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 1.5 + 0.3,
            t: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.01 + 0.005
        }));

        // Coin/Diamond pickup animations
        this.pickupAnimations = [];

        // UI state
        this.showPowerUpMenu = false;
        this.showLevelComplete = false;
        this.levelCompleteTimer = 0;
        this.hudFlash = {};

        // Initialize level
        this.initLevel(this.level);
        this.generateShooter();

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
        this.animId = requestAnimationFrame(t => this.loop(t));
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
            // Check streak
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

        // Random bonus power-up every 5 days
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

        // Show popups
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 - 40,
            text: `+${coins} 🪙`, color: '#FFD700', life: 120, opacity: 1, size: 22
        });
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2,
            text: `+${diamonds} 💎`, color: '#00D4FF', life: 120, opacity: 1, size: 20
        });
        if (bonusPowerUp) {
            this.floatingTexts.push({
                x: this.canvas.width / 2, y: this.canvas.height / 2 + 40,
                text: `+1 ${this.powerUps[bonusPowerUp].icon} ${this.powerUps[bonusPowerUp].name}!`,
                color: '#00FF88', life: 120, opacity: 1, size: 16
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

        // Endless mode past 25
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
        this.ROWS = Math.max(10, this.levelConfig.rows + 4);
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

        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = null;
            }
        }

        this.generateLayout(this.levelConfig);
        this.updateColorsInPlay();

        // Level start text
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 - 30,
            text: `Level ${level}`, color: '#B347D9', life: 120, opacity: 1, size: 28
        });
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 + 10,
            text: this.levelConfig.name, color: '#00D4FF', life: 120, opacity: 1, size: 18
        });
        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2 + 40,
            text: `Goal: Pop ${this.levelGoal} bubbles`, color: '#fff', life: 120, opacity: 1, size: 14
        });
    }

    generateLayout(config) {
        const numColors = config.colors;
        const fillRows = config.rows;

        switch (config.layout) {
            case 'standard':
                this.layoutStandard(fillRows, numColors);
                break;
            case 'zigzag':
                this.layoutZigzag(fillRows, numColors);
                break;
            case 'diamond':
                this.layoutDiamond(fillRows, numColors);
                break;
            case 'checkerboard':
                this.layoutCheckerboard(fillRows, numColors);
                break;
            case 'maze':
                this.layoutMaze(fillRows, numColors);
                break;
            case 'boss_wall':
                this.layoutBossWall(numColors);
                break;
            case 'boss_pyramid':
                this.layoutBossPyramid(numColors);
                break;
            case 'boss_cross':
                this.layoutBossCross(numColors);
                break;
            case 'boss_spiral':
                this.layoutBossSpiral(numColors);
                break;
            case 'boss_final':
                this.layoutBossFinal(numColors);
                break;
            default:
                this.layoutStandard(fillRows, numColors);
        }
    }

    layoutStandard(rows, numColors) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const colorIdx = Math.floor(Math.random() * numColors);
                this.grid[r][c] = this.createBubble(colorIdx);
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
                const colorIdx = (r + c) % numColors;
                this.grid[r][c] = this.createBubble(colorIdx);
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
                const colorIdx = r % numColors;
                this.grid[r][c] = this.createBubble(colorIdx);
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
            // Horizontal bar
            if (r === 3) {
                for (let c = 0; c < this.COLS; c++) {
                    this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
                }
            }
            // Vertical bar
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
        // Fill everything - dense boss
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < this.COLS; c++) {
                this.grid[r][c] = this.createBubble(Math.floor(Math.random() * numColors));
            }
        }
        // Add some indestructible-looking (same color clusters)
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
            color: this.COLORS[colorIdx],
            colorIdx,
            popping: false,
            newlyAdded: false,
            scale: 1,
            flash: 0
        };
    }

    // ============================================================
    // COIN & DIAMOND EARN LOGIC
    // ============================================================

    earnCoins(amount, x, y, reason = '') {
        this.playerData.coins += amount;
        this.playerData.totalCoinsEarned += amount;
        this.levelCoins += amount;

        this.coinPopups.push({
            x, y,
            text: `+${amount} 🪙`,
            color: '#FFD700',
            life: 80,
            opacity: 1,
            vy: -1.5
        });

        this.hudFlash.coins = 15;
    }

    earnDiamonds(amount, x, y, reason = '') {
        this.playerData.diamonds += amount;
        this.playerData.totalDiamondsEarned += amount;
        this.levelDiamonds += amount;

        this.diamondPopups.push({
            x, y,
            text: `+${amount} 💎`,
            color: '#00D4FF',
            life: 100,
            opacity: 1,
            vy: -1.2
        });

        this.hudFlash.diamonds = 15;

        if (window.audioManager) audioManager.play('achievement');
    }

    // ============================================================
    // POWER-UP SYSTEM
    // ============================================================

    activatePowerUp(type) {
        if (!this.powerUps[type] || this.powerUps[type].count <= 0) return;
        if (this.activePowerUp) return;

        this.powerUps[type].count--;
        this.activePowerUp = type;
        this.powerUpTimer = 0;

        this.floatingTexts.push({
            x: this.canvas.width / 2, y: this.canvas.height / 2,
            text: `${this.powerUps[type].icon} ${this.powerUps[type].name} Activated!`,
            color: '#FFD700', life: 90, opacity: 1, size: 18
        });

        if (window.audioManager) audioManager.play('powerUp');
        this.savePlayerData();
    }

    buyPowerUp(type) {
        const cost = this.powerUps[type].cost;
        if (this.playerData.coins >= cost) {
            this.playerData.coins -= cost;
            this.powerUps[type].count++;
            this.savePlayerData();
            this.floatingTexts.push({
                x: this.canvas.width / 2, y: this.canvas.height / 2,
                text: `Bought ${this.powerUps[type].icon} ${this.powerUps[type].name}!`,
                color: '#00FF88', life: 80, opacity: 1, size: 16
            });
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

        // Check UI buttons first
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

        // Check power-up buttons
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
        // Power-up buttons at bottom left
        const btnSize = 36;
        const btnY = this.shooterY + 20;
        const startX = 10;
        let idx = 0;
        for (const [key, pup] of Object.entries(this.powerUps)) {
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
    // AIM LINE
    // ============================================================

    calculateAimLine() {
        this.aimLine = [];
        let x = this.shooterX;
        let y = this.shooterY;
        let vx = Math.cos(this.angle) * 20;
        let vy = Math.sin(this.angle) * 20;
        let bounces = 0;
        const maxBounces = this.activePowerUp === 'precision' ? 4 : 2;
        const steps = this.activePowerUp === 'precision' ? 50 : 30;

        for (let i = 0; i < steps; i++) {
            x += vx;
            y += vy;
            if (x <= this.BUBBLE_R || x >= this.canvas.width - this.BUBBLE_R) {
                vx *= -1;
                bounces++;
            }
            if (y <= this.BUBBLE_R) { vy *= -1; bounces++; }
            this.aimLine.push({ x, y, t: i / steps });
            if (bounces >= maxBounces || y > this.shooterY) break;
        }
    }

    // ============================================================
    // SHOOT
    // ============================================================

    shoot() {
        this.canShoot = false;
        this.shotsUsed++;

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
            fireballHits: 0
        };

        // Consume power-up after shot
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

        // Daily reward display timer
        if (this.dailyRewardTimer > 0) this.dailyRewardTimer--;

        // Level complete timer
        if (this.showLevelComplete) {
            this.levelCompleteTimer++;
            return;
        }

        // Level transition
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

        // Shake
        if (this.shakeTimer > 0) {
            this.shakeX = (Math.random() - 0.5) * 6 * (this.shakeTimer / 10);
            this.shakeTimer--;
        } else {
            this.shakeX = 0;
        }

        // HUD flash
        Object.keys(this.hudFlash).forEach(k => {
            if (this.hudFlash[k] > 0) this.hudFlash[k]--;
        });

        // Projectile
        if (this.projectile) {
            this.updateProjectile();
        }

        // Particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
            p.life -= p.decay; p.vx *= 0.98;
            return p.life > 0;
        });

        // Falling bubbles
        this.fallingBubbles = this.fallingBubbles.filter(b => {
            b.vy += 0.4; b.y += b.vy; b.x += b.vx;
            b.rotation += b.rotSpeed; b.life -= 2;
            return b.life > 0 && b.y < this.canvas.height + 50;
        });

        // Pop animations
        this.popAnimations = this.popAnimations.filter(p => {
            p.scale += 0.15; p.opacity -= 0.06;
            return p.opacity > 0;
        });

        // Score popups
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.5; p.life -= 2; p.opacity = p.life / 60;
            return p.life > 0;
        });

        // Coin popups
        this.coinPopups = this.coinPopups.filter(p => {
            p.y += p.vy; p.life -= 2; p.opacity = Math.min(1, p.life / 40);
            return p.life > 0;
        });

        // Diamond popups
        this.diamondPopups = this.diamondPopups.filter(p => {
            p.y += p.vy; p.life -= 1.5; p.opacity = Math.min(1, p.life / 50);
            return p.life > 0;
        });

        // Floating texts
        this.floatingTexts = this.floatingTexts.filter(t => {
            t.y -= 0.8; t.life -= 1; t.opacity = Math.min(1, t.life / 40);
            return t.life > 0;
        });

        // Pickup animations
        this.pickupAnimations = this.pickupAnimations.filter(p => {
            p.progress += 0.03;
            p.x += (p.targetX - p.x) * 0.08;
            p.y += (p.targetY - p.y) * 0.08;
            p.scale *= 0.97;
            return p.progress < 1;
        });

        // Newly added bubble animation
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (b?.newlyAdded) {
                    b.scale = Math.min(1, (b.scale || 0) + 0.12);
                    if (b.scale >= 1) b.newlyAdded = false;
                }
                if (b?.flash > 0) b.flash--;
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
        this.levelProgress = this.bubblesPopped / this.levelGoal;

        // Check level complete
        if (this.bubblesPopped >= this.levelGoal && !this.levelComplete) {
            this.completeLevel();
        }

        // Check grid clear bonus
        const remaining = this.grid.flat().filter(Boolean).length;
        if (remaining === 0 && !this.levelComplete) {
            this.earnCoins(100, this.canvas.width / 2, this.canvas.height / 2, 'Clear Bonus');
            this.earnDiamonds(3, this.canvas.width / 2, this.canvas.height / 2 + 30, 'Perfect Clear');
            this.completeLevel();
        }

        // Check game over
        this.checkGameOver();
    }

    updateProjectile() {
        const p = this.projectile;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 10) p.trail.shift();

        p.x += p.vx;
        p.y += p.vy;

        // Wall bounce
        if (p.x <= this.BUBBLE_R) { p.x = this.BUBBLE_R; p.vx *= -1; }
        if (p.x >= this.canvas.width - this.BUBBLE_R) {
            p.x = this.canvas.width - this.BUBBLE_R; p.vx *= -1;
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

        // Bottom out of bounds
        if (p.y > this.canvas.height) {
            this.projectile = null;
            this.canShoot = true;
            return;
        }

        // Fireball mode - destroy on touch
        if (p.isFireball) {
            this.checkFireballCollision();
            return;
        }

        // Normal grid collision
        this.checkGridCollision();
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
                if (Math.sqrt(dx * dx + dy * dy) < this.BUBBLE_R * 1.8) {
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
                if (Math.sqrt(dx * dx + dy * dy) < this.BUBBLE_R * 1.85) {
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

        let bestR = -1, bestC = -1, bestDist = Infinity;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) continue;
                const pos = this.getBubblePos(r, c);
                const dx = this.projectile.x - pos.x;
                const dy = this.projectile.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist && dist < this.BUBBLE_R * 3.5) {
                    bestDist = dist; bestR = r; bestC = c;
                }
            }
        }

        if (bestR === -1) {
            const c = Math.round((this.projectile.x - this.offsetX) / this.cellW);
            bestR = 0;
            bestC = Math.max(0, Math.min(this.COLS - 1, c));
        }

        if (bestR !== -1 && bestC !== -1) {
            // Bomb power-up
            if (this.projectile.isBomb) {
                this.explodeBomb(bestR, bestC);
                this.projectile = null;
                this.canShoot = true;
                return;
            }

            // Rainbow matches any adjacent color
            let snapColorIdx = this.projectile.colorIdx;
            if (this.projectile.isRainbow) {
                // Find most common adjacent color
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
            }

            this.grid[bestR][bestC] = {
                color: this.COLORS[snapColorIdx] || this.projectile.color,
                colorIdx: snapColorIdx,
                popping: false,
                newlyAdded: true,
                scale: 0.3,
                flash: 0
            };

            const matches = this.findMatches(bestR, bestC);
            if (matches.length >= 3) {
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this.popBubbles(matches, bestR, bestC);
            } else {
                this.combo = 0;
                if (window.audioManager) audioManager.play('pop');
                if (this.grid[bestR]?.[bestC]) this.grid[bestR][bestC].flash = 5;
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

        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= this.ROWS || nc < 0 || nc >= this.COLS) continue;
                if (!this.grid[nr]?.[nc]) continue;

                const dist = Math.sqrt(dr * dr + dc * dc);
                if (dist <= radius + 0.5) {
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

        this.earnCoins(destroyed * 3, this.getBubblePos(r, c).x, this.getBubblePos(r, c).y);

        this.shakeTimer = 12;
        if (window.audioManager) audioManager.play('levelUp');

        this.scorePopups.push({
            x: this.getBubblePos(r, c).x,
            y: this.getBubblePos(r, c).y,
            text: `💣 BOOM! +${bombScore}`,
            color: '#FF8C00', life: 80, opacity: 1
        });

        setTimeout(() => this.dropFloatingBubbles(), 200);
    }

    // ============================================================
    // MATCH FINDING
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

        // COIN REWARDS
        const coinReward = Math.floor(matches.length * (1 + comboMult * 0.5));
        const originPos = this.getBubblePos(originR, originC);
        this.earnCoins(coinReward, originPos.x, originPos.y);

        // DIAMOND - rare drop on big combos or lucky
        if (comboMult >= 3 || (matches.length >= 5 && Math.random() < 0.3)) {
            const diamondAmount = comboMult >= 5 ? 2 : 1;
            this.earnDiamonds(diamondAmount, originPos.x, originPos.y - 20);
        }

        matches.forEach(([r, c]) => {
            const pos = this.getBubblePos(r, c);
            const color = this.grid[r][c].color;
            this.popAnimations.push({ x: pos.x, y: pos.y, color, scale: 0.5, opacity: 1 });
            this.spawnPopParticles(pos.x, pos.y, color, 10);
            this.grid[r][c] = null;
        });

        // Score popup
        this.scorePopups.push({
            x: originPos.x, y: originPos.y,
            text: comboMult > 1 ? `x${comboMult} COMBO! +${comboScore}` : `+${comboScore}`,
            color: comboMult > 2 ? '#FFD700' : '#00FF88',
            life: 70, opacity: 1
        });

        this.onScore(this.score);
        this.shakeTimer = comboMult > 2 ? 10 : 5;

        if (window.audioManager) {
            if (this.combo >= 3) audioManager.play('levelUp');
            else audioManager.play('success');
        }
    }

    dropFloatingBubbles() {
        const connected = new Set();
        const queue = [];

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
            this.earnCoins(dropped * 2, this.canvas.width / 2, this.canvas.height / 2);
            this.onScore(this.score);
            if (window.audioManager) audioManager.play('levelUp');
            this.scorePopups.push({
                x: this.canvas.width / 2, y: this.canvas.height / 2,
                text: `${dropped} Dropped! +${bonus}`, color: '#FF8C00', life: 80, opacity: 1
            });
        }
    }

    dropRow() {
        for (let r = this.ROWS - 1; r > 0; r--) {
            this.grid[r] = this.grid[r - 1] ? [...this.grid[r - 1]] : [];
        }
        this.grid[0] = [];
        const numColors = this.levelConfig?.colors || 4;
        for (let c = 0; c < this.COLS; c++) {
            const colorIdx = Math.floor(Math.random() * numColors);
            this.grid[0][c] = this.createBubble(colorIdx);
        }
        this.updateColorsInPlay();
        if (window.audioManager) audioManager.play('fail');
        this.shakeTimer = 8;
    }

    // ============================================================
    // LEVEL COMPLETE
    // ============================================================

    completeLevel() {
        this.levelComplete = true;
        this.showLevelComplete = true;
        this.levelCompleteTimer = 0;

        // Calculate star rating
        const efficiency = this.levelGoal / Math.max(1, this.shotsUsed);
        if (efficiency >= 0.8) this.starRating = 3;
        else if (efficiency >= 0.5) this.starRating = 2;
        else this.starRating = 1;

        // Level rewards
        const levelCoins = 50 + this.level * 10 + this.starRating * 20;
        const levelDiamonds = this.starRating >= 3 ? 3 : this.starRating >= 2 ? 1 : 0;
        const bonusCoins = this.maxCombo * 5;

        this.earnCoins(levelCoins + bonusCoins, this.canvas.width / 2, this.canvas.height / 2 - 60);
        if (levelDiamonds > 0) {
            this.earnDiamonds(levelDiamonds, this.canvas.width / 2, this.canvas.height / 2 - 30);
        }

        // Boss level bonus
        if (this.levelConfig?.layout?.startsWith('boss')) {
            this.earnDiamonds(5, this.canvas.width / 2, this.canvas.height / 2, 'Boss Defeated!');
            this.earnCoins(200, this.canvas.width / 2, this.canvas.height / 2 + 20, 'Boss Bonus');
        }

        // Save stars
        const prevStars = this.playerData.levelStars[this.level] || 0;
        if (this.starRating > prevStars) {
            this.playerData.levelStars[this.level] = this.starRating;
        }

        // Update highest level
        if (this.level >= this.playerData.highestLevel) {
            this.playerData.highestLevel = this.level + 1;
        }

        this.playerData.currentLevel = this.level;
        this.playerData.totalScore += this.score;
        this.playerData.totalPopped += this.bubblesPopped;
        this.playerData.gamesPlayed++;
        this.savePlayerData();

        // Big celebration particles
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                if (this.destroyed) return;
                this.spawnPopParticles(
                    Math.random() * this.canvas.width,
                    Math.random() * this.canvas.height * 0.5,
                    this.COLORS[Math.floor(Math.random() * this.COLORS.length)],
                    6
                );
            }, i * 60);
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
                this.playerData.totalScore += this.score;
                this.playerData.totalPopped += this.bubblesPopped;
                this.playerData.gamesPlayed++;
                this.savePlayerData();
                setTimeout(() => this.onScore(this.score, true, {
                    level: this.level,
                    coins: this.levelCoins,
                    diamonds: this.levelDiamonds
                }), 1000);
                return;
            }
        }
    }

    // ============================================================
    // PARTICLES
    // ============================================================

    spawnPopParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = Math.random() * 5 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color, size: Math.random() * 5 + 2,
                life: 1, decay: Math.random() * 0.04 + 0.02,
                gravity: 0.12
            });
        }
        for (let i = 0; i < 4; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3,
                color: '#FFFFFF', size: Math.random() * 3 + 1,
                life: 1, decay: 0.05, gravity: 0, sparkle: true
            });
        }
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
        if (this.shakeX) ctx.translate(this.shakeX, 0);

        this.drawBackground();
        this.drawLevelProgress();
        this.drawDropWarning();
        this.drawGrid();
        this.drawFallingBubbles();
        this.drawPopAnimations();
        this.drawAimLine();
        this.drawShooter();
        this.drawProjectile();
        this.drawParticles();
        this.drawScorePopups();
        this.drawCoinPopups();
        this.drawDiamondPopups();
        this.drawFloatingTexts();
        this.drawHUD();
        this.drawPowerUpBar();

        ctx.restore();

        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyReward();
        if (this.showLevelComplete) this.drawLevelComplete();
        if (this.levelTransition) this.drawLevelTransition();
        if (this.gameOver) this.drawGameOver();
    }

    drawBackground() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, H, H);
        grad.addColorStop(0, '#0f0a1f');
        grad.addColorStop(0.5, '#0a0815');
        grad.addColorStop(1, '#050510');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        this.stars.forEach(s => {
            const blink = (Math.sin(s.t) + 1) / 2;
            ctx.globalAlpha = 0.15 + blink * 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Level info area separator
        ctx.strokeStyle = 'rgba(179,71,217,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(0, this.shooterY - 40);
        ctx.lineTo(W, this.shooterY - 40);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawLevelProgress() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const barW = W - 20;
        const barH = 4;
        const barX = 10;
        const barY = 44;
        const progress = Math.min(1, this.levelProgress);

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(barX, barY, barW, barH);

        const grad = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
        grad.addColorStop(0, '#B347D9');
        grad.addColorStop(1, '#00D4FF');
        ctx.fillStyle = grad;
        ctx.fillRect(barX, barY, barW * progress, barH);

        // Glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#B347D9';
        ctx.fillRect(barX, barY, barW * progress, barH);
        ctx.shadowBlur = 0;
    }

    drawDropWarning() {
        if (!this.dropWarning) return;
        const pct = (this.dropInterval - this.dropTimer) / 5000;
        const alpha = (1 - pct) * 0.3 * Math.abs(Math.sin(Date.now() / 200));
        this.ctx.fillStyle = `rgba(255,0,85,${alpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        const ctx = this.ctx;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;
                const pos = this.getBubblePos(r, c);
                let scale = b.scale || 1;

                if (b.flash > 0) {
                    ctx.globalAlpha = 0.5 + (b.flash / 10) * 0.5;
                }

                ctx.save();
                ctx.translate(pos.x, pos.y);
                ctx.scale(scale, scale);
                this.drawBubble(ctx, 0, 0, this.BUBBLE_R, b.color);
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        }
    }

    drawBubble(ctx, x, y, r, color) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;

        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        grad.addColorStop(0, this.lightenColor(color, 60));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, this.darkenColor(color, 40));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Shine
        const shine = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x - r * 0.2, y - r * 0.2, r * 0.6);
        shine.addColorStop(0, 'rgba(255,255,255,0.5)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = shine;
        ctx.fill();
    }

    drawAimLine() {
        if (this.aimLine.length < 2) return;
        const ctx = this.ctx;
        const dashOffset = Math.floor(Date.now() / 50) % 20;

        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -dashOffset;

        for (let i = 1; i < this.aimLine.length; i++) {
            const p = this.aimLine[i - 1];
            const c = this.aimLine[i];
            const alpha = (1 - p.t) * 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(c.x, c.y);
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = this.activePowerUp === 'precision' ? 2.5 : 1.5;
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        const last = this.aimLine[this.aimLine.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
    }

    drawShooter() {
        const ctx = this.ctx;
        const x = this.shooterX;
        const y = this.shooterY;

        // Base
        const baseGrad = ctx.createLinearGradient(x - 35, y + 20, x + 35, y + 40);
        baseGrad.addColorStop(0, '#2a1a3e');
        baseGrad.addColorStop(0.5, '#3d2060');
        baseGrad.addColorStop(1, '#2a1a3e');
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 35, 40, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Barrel
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.angle);
        const barrelGrad = ctx.createLinearGradient(0, -6, 0, 6);
        barrelGrad.addColorStop(0, '#8855cc');
        barrelGrad.addColorStop(0.5, '#b347d9');
        barrelGrad.addColorStop(1, '#6633aa');
        ctx.fillStyle = barrelGrad;
        ctx.beginPath();
        ctx.roundRect?.(8, -5, 30, 10, 3) || (() => {
            ctx.rect(8, -5, 30, 10);
        })();
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#b347d9';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Current bubble
        let bubbleColor = this.currentBubble.color;
        if (this.activePowerUp === 'fireball') {
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 100) * 0.4;
            bubbleColor = '#FF4500';
        } else if (this.activePowerUp === 'rainbow') {
            const hue = (Date.now() / 10) % 360;
            bubbleColor = `hsl(${hue}, 100%, 60%)`;
        } else if (this.activePowerUp === 'bomb') {
            bubbleColor = '#333';
        }
        this.drawBubble(ctx, x, y, this.BUBBLE_R - 2, bubbleColor);
        ctx.globalAlpha = 1;

        // Power-up indicator on bubble
        if (this.activePowerUp) {
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(this.powerUps[this.activePowerUp].icon, x, y);
        }

        // Next bubble
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('NEXT', x + 55, y + 5);
        this.drawBubble(ctx, x + 55, y + 22, this.BUBBLE_R - 6, this.nextBubble.color);
        ctx.textAlign = 'left';
    }

    drawProjectile() {
        if (!this.projectile) return;
        const ctx = this.ctx;
        const p = this.projectile;

        // Trail
        p.trail.forEach((t, i) => {
            const alpha = (i / p.trail.length) * 0.4;
            const size = this.BUBBLE_R * (i / p.trail.length) * 0.7;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(2, size), 0, Math.PI * 2);
            ctx.fillStyle = p.isFireball ? '#FF4500' : p.color;
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        let drawColor = p.color;
        if (p.isFireball) drawColor = '#FF4500';
        if (p.isRainbow) {
            const hue = (Date.now() / 10) % 360;
            drawColor = `hsl(${hue}, 100%, 60%)`;
        }
        if (p.isBomb) drawColor = '#555';

        this.drawBubble(ctx, p.x, p.y, this.BUBBLE_R, drawColor);

        if (p.isFireball) {
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔥', p.x, p.y);
        }
        if (p.isBomb) {
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', p.x, p.y);
        }
    }

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

    drawPopAnimations() {
        const ctx = this.ctx;
        this.popAnimations.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.BUBBLE_R * p.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawParticles() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            if (p.sparkle) {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 5;
                ctx.shadowColor = p.color;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });
        ctx.globalAlpha = 1;
    }

    drawScorePopups() {
        const ctx = this.ctx;
        this.scorePopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 15px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 6;
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
            ctx.font = 'bold 13px Orbitron';
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
            ctx.font = 'bold 14px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 8;
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
            ctx.font = `bold ${t.size || 16}px Orbitron`;
            ctx.textAlign = 'center';
            ctx.fillStyle = t.color;
            ctx.shadowBlur = 10;
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

        // Top bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, 42);

        // Level
        ctx.fillStyle = '#b347d9';
        ctx.font = 'bold 12px Orbitron';
        ctx.fillText(`LVL ${this.level}`, 8, 16);

        // Level name
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px Rajdhani';
        ctx.fillText(this.levelConfig?.name || '', 8, 30);

        // Goal progress
        ctx.fillStyle = '#00D4FF';
        ctx.font = '11px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.bubblesPopped}/${this.levelGoal}`, W / 2, 16);

        // Combo
        if (this.combo > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 12px Orbitron';
            ctx.fillText(`x${this.combo} COMBO`, W / 2, 32);
        }

        // Coins (with flash)
        const coinAlpha = this.hudFlash.coins > 0 ? 1 : 0.8;
        const coinScale = this.hudFlash.coins > 0 ? 1.1 : 1;
        ctx.save();
        ctx.textAlign = 'right';
        ctx.font = `bold ${Math.floor(11 * coinScale)}px Orbitron`;
        ctx.fillStyle = `rgba(255,215,0,${coinAlpha})`;
        ctx.fillText(`🪙 ${this.playerData.coins}`, W - 8, 16);

        // Diamonds
        const diaAlpha = this.hudFlash.diamonds > 0 ? 1 : 0.8;
        const diaScale = this.hudFlash.diamonds > 0 ? 1.1 : 1;
        ctx.font = `bold ${Math.floor(11 * diaScale)}px Orbitron`;
        ctx.fillStyle = `rgba(0,212,255,${diaAlpha})`;
        ctx.fillText(`💎 ${this.playerData.diamonds}`, W - 8, 32);

        ctx.restore();
        ctx.textAlign = 'left';

        // Drop warning
        if (this.dropWarning) {
            const pct = (this.dropInterval - this.dropTimer) / 5000;
            ctx.fillStyle = 'rgba(255,0,85,0.4)';
            ctx.fillRect(0, this.canvas.height - 5, W * pct, 5);
        }
    }

    drawPowerUpBar() {
        const ctx = this.ctx;
        const btnSize = 32;
        const btnY = this.shooterY + 18;
        const startX = 8;
        let idx = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx = startX + idx * (btnSize + 5);
            const isActive = this.activePowerUp === key;

            // Button bg
            ctx.fillStyle = isActive ? 'rgba(255,215,0,0.3)' : 'rgba(179,71,217,0.15)';
            ctx.strokeStyle = isActive ? '#FFD700' : 'rgba(179,71,217,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect?.(bx, btnY, btnSize, btnSize, 6) || ctx.rect(bx, btnY, btnSize, btnSize);
            ctx.fill();
            ctx.stroke();

            // Icon
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pup.icon, bx + btnSize / 2, btnY + btnSize / 2 - 3);

            // Count badge
            ctx.font = 'bold 9px Orbitron';
            ctx.fillStyle = pup.count > 0 ? '#00FF88' : '#ff0055';
            ctx.fillText(`${pup.count}`, bx + btnSize / 2, btnY + btnSize - 4);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            idx++;
        }
    }

    // ============================================================
    // DAILY REWARD SCREEN
    // ============================================================

    drawDailyReward() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Backdrop
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, W, H);

        // Card
        const cw = Math.min(320, W - 40);
        const ch = 260;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        ctx.fillStyle = 'rgba(15,15,36,0.95)';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect?.(cx, cy, cw, ch, 16) || ctx.rect(cx, cy, cw, ch);
        ctx.fill();
        ctx.stroke();

        // Top glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD700';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Title
        ctx.font = 'bold 20px Orbitron';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('🎁 Daily Reward!', W / 2, cy + 40);

        // Streak
        ctx.font = '14px Rajdhani';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`Day ${this.playerData.dailyStreak + 1} Streak! 🔥`, W / 2, cy + 65);

        // Reward preview
        const streak = this.playerData.dailyStreak;
        const mult = Math.min(1 + streak * 0.25, 3);
        const coins = Math.floor(50 * mult);
        const diamonds = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 ${coins}`, W / 2, cy + 110);

        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 ${diamonds}`, W / 2, cy + 145);

        if (streak > 0 && streak % 5 === 0) {
            ctx.font = '14px Rajdhani';
            ctx.fillStyle = '#00FF88';
            ctx.fillText('+ Bonus Power-up! 🎉', W / 2, cy + 175);
        }

        // Claim button
        const btnW = 160;
        const btnH = 40;
        const btnX = (W - btnW) / 2;
        const btnY2 = cy + ch - 55;

        const grad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
        grad.addColorStop(0, '#B347D9');
        grad.addColorStop(1, '#FF006E');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect?.(btnX, btnY2, btnW, btnH, 20) || ctx.rect(btnX, btnY2, btnW, btnH);
        ctx.fill();

        ctx.font = 'bold 14px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.fillText('CLAIM!', W / 2, btnY2 + 26);
        ctx.textAlign = 'left';
    }

    // ============================================================
    // LEVEL COMPLETE SCREEN
    // ============================================================

    drawLevelComplete() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, W, H);

        const cw = Math.min(340, W - 30);
        const ch = 320;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        ctx.fillStyle = 'rgba(15,15,36,0.95)';
        ctx.strokeStyle = '#00FF88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect?.(cx, cy, cw, ch, 16) || ctx.rect(cx, cy, cw, ch);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00FF88';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Title
        ctx.font = 'bold 22px Orbitron';
        ctx.fillStyle = '#00FF88';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL COMPLETE! 🎉', W / 2, cy + 40);

        // Stars
        const starY = cy + 75;
        for (let i = 0; i < 3; i++) {
            const sx = W / 2 + (i - 1) * 40;
            ctx.font = '32px Arial';
            ctx.fillText(i < this.starRating ? '⭐' : '☆', sx, starY);
        }

        // Stats
        ctx.font = '14px Rajdhani';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Score: ${this.score}`, W / 2, cy + 120);
        ctx.fillText(`Bubbles Popped: ${this.bubblesPopped}`, W / 2, cy + 145);
        ctx.fillText(`Best Combo: x${this.maxCombo}`, W / 2, cy + 170);
        ctx.fillText(`Shots Used: ${this.shotsUsed}`, W / 2, cy + 195);

        // Rewards
        ctx.font = 'bold 16px Orbitron';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 +${this.levelCoins}`, W / 2, cy + 230);
        if (this.levelDiamonds > 0) {
            ctx.fillStyle = '#00D4FF';
            ctx.fillText(`💎 +${this.levelDiamonds}`, W / 2, cy + 255);
        }

        // Next button
        const btnW = 160;
        const btnH = 38;
        const btnX = (W - btnW) / 2;
        const btnY = cy + ch - 50;

        const grad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
        grad.addColorStop(0, '#00D4FF');
        grad.addColorStop(1, '#00FF88');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect?.(btnX, btnY, btnW, btnH, 20) || ctx.rect(btnX, btnY, btnW, btnH);
        ctx.fill();

        ctx.font = 'bold 13px Orbitron';
        ctx.fillStyle = '#050508';
        ctx.fillText('NEXT LEVEL →', W / 2, btnY + 24);
        ctx.textAlign = 'left';
    }

    drawLevelTransition() {
        const ctx = this.ctx;
        const progress = 1 - (this.levelTransitionTimer / 60);
        ctx.fillStyle = `rgba(5,5,8,${1 - progress})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGameOver() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#FF006E';
        ctx.font = 'bold 30px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 50);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = '16px Rajdhani';
        ctx.fillText(`Score: ${this.score}`, W / 2, H / 2 - 10);
        ctx.fillText(`Level: ${this.level}`, W / 2, H / 2 + 15);
        ctx.fillText(`Best Combo: x${this.maxCombo}`, W / 2, H / 2 + 40);

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText(`🪙 ${this.levelCoins} earned`, W / 2, H / 2 + 75);
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 ${this.levelDiamonds} earned`, W / 2, H / 2 + 100);
        ctx.textAlign = 'left';
    }

    // ============================================================
    // UTILS
    // ============================================================

    lightenColor(hex, amount) {
        if (!hex.startsWith('#')) return hex;
        const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
        const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
        const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
        return `rgb(${r},${g},${b})`;
    }

    darkenColor(hex, amount) {
        if (!hex.startsWith('#')) return hex;
        const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
        const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
        const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
        return `rgb(${r},${g},${b})`;
    }

    // ============================================================
    // GAME LOOP
    // ============================================================

    loop(timestamp) {
        if (this.destroyed) return;
        const dt = timestamp - (this.lastTime || timestamp);
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
        this.canvas.removeEventListener('click', this.boundClick);
        this.canvas.removeEventListener('touchend', this.boundTouch);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        document.removeEventListener('keydown', this.boundKeyDown);
        this.savePlayerData();
    }
}