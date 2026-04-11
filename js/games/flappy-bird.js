/* ============================================================
   FLAPPY BIRD v3.0 - KHATARNAK PREMIUM EDITION
   Fixed Physics + Coins + Diamonds + Daily Rewards + Levels
   ============================================================ */

'use strict';

class FlappyBird {
    constructor(canvas, onScore, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;

        // ============================================
        // SAVE SYSTEM
        // ============================================
        this.saveKey = 'neonarcade_flappybird';
        this.playerData = this.loadPlayerData();

        // ============================================
        // GAME STATES
        // ============================================
        this.STATE = { WAITING: 0, PLAYING: 1, DEAD: 2 };
        this.state = this.STATE.WAITING;

        // ============================================
        // PHYSICS - FIXED! Ab khel payenge :)
        // ============================================
        this.gravity      = 0.28;   // Was 0.42 - ab slow hai
        this.flapPower    = -6.2;   // Was -7.8 - ab controlled hai
        this.maxFallSpeed = 7;      // Was 10   - ab cap hai
        this.pipeSpeed    = 2.2;    // Was 2.8  - ab slow hai
        this.pipeGap      = 175;    // Was 155  - ab bada gap hai

        // ============================================
        // STAGE SYSTEM (every 5 score = 1 stage)
        // ============================================
        this.currentStage = 1;
        this.maxStage = 25;
        this.stageConfig = this.getStageConfig(1);

        // ============================================
        // BIRD
        // ============================================
        this.bird = this.createBird();

        // ============================================
        // PIPES
        // ============================================
        this.pipes = [];
        this.pipeWidth    = 55;
        this.pipeInterval = 2000; // ms between pipes - was 1800
        this.lastPipeTime = 0;

        // ============================================
        // GROUND
        // ============================================
        this.groundY = this.canvas.height - 50;
        this.groundOffset = 0;

        // ============================================
        // SCORE & CURRENCY
        // ============================================
        this.score = 0;
        this.sessionCoins = 0;
        this.sessionDiamonds = 0;
        this.bestScore = this.playerData.bestScore || 0;

        // ============================================
        // MILESTONES for diamonds
        // ============================================
        this.milestones = [5, 10, 20, 30, 40, 50, 75, 100];
        this.milestonesClaimed = new Set();

        // ============================================
        // POWER-UPS
        // ============================================
        this.powerUps = {
            shield:    { count: this.playerData.powerUps?.shield || 1,  cost: 40,  icon: '🛡️', name: 'Shield',   color: '#00d4ff', desc: 'One-time hit protection', active: false, timer: 0, maxTimer: 5000 },
            slowmo:    { count: this.playerData.powerUps?.slowmo || 1,  cost: 60,  icon: '⏱️', name: 'Slow-Mo',  color: '#b347d9', desc: 'Slows everything down',   active: false, timer: 0, maxTimer: 4000 },
            magnet:    { count: this.playerData.powerUps?.magnet || 0,  cost: 80,  icon: '🧲', name: 'Magnet',   color: '#FFD700', desc: 'Auto-collects coins',      active: false, timer: 0, maxTimer: 6000 },
            ghost:     { count: this.playerData.powerUps?.ghost || 0,   cost: 150, icon: '👻', name: 'Ghost',    color: '#00FF88', desc: 'Phase through one pipe',   active: false, timer: 0, uses: 1 }
        };
        this.activePowerUp = null;
        this.inGamePowerups = []; // spawned powerups on canvas

        // ============================================
        // DAILY REWARD
        // ============================================
        this.showDailyReward = false;
        this.dailyRewardClaimed = false;
        this.checkDailyReward();

        // ============================================
        // VISUAL EFFECTS
        // ============================================
        this.particles    = [];
        this.feathers     = [];
        this.dustParticles = [];
        this.coinPickups  = [];
        this.floatingTexts = [];
        this.scorePopups  = [];

        // ============================================
        // BACKGROUND
        // ============================================
        this.stars = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height - 50),
            size: Math.random() * 2 + 0.3,
            twinkle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.02 + 0.01
        }));

        this.clouds = Array.from({ length: 5 }, (_, i) => ({
            x: (canvas.width / 5) * i * 1.4 + 50,
            y: Math.random() * (canvas.height * 0.35) + 30,
            w: Math.random() * 80 + 60,
            h: Math.random() * 25 + 20,
            speed: Math.random() * 0.3 + 0.15
        }));

        // ============================================
        // UI STATE
        // ============================================
        this.nightMode       = false;
        this.dayNightAlpha   = 0;
        this.flashAlpha      = 0;
        this.flashColor      = '#ffffff';
        this.shake           = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.scoreFlash      = 0;
        this.deathOverlayAlpha = 0;
        this.getReadyScale   = 0.5;
        this.scoreDisplayAnim = { scale: 1, timer: 0 };
        this.hudFlash        = {};
        this.showShop        = false;
        this.showLevelUp     = false;
        this.levelUpTimer    = 0;
        this.newBest         = false;

        // Medals config
        this.MEDALS = [
            { min: 0,  color: '#CD7F32', name: 'Bronze',   emoji: '🥉', coins: 10  },
            { min: 5,  color: '#C0C0C0', name: 'Silver',   emoji: '🥈', coins: 25  },
            { min: 10, color: '#FFD700', name: 'Gold',     emoji: '🥇', coins: 50  },
            { min: 20, color: '#b347d9', name: 'Platinum', emoji: '💎', coins: 100 },
            { min: 40, color: '#00d4ff', name: 'Diamond',  emoji: '🔷', coins: 200 }
        ];

        // ============================================
        // EVENTS
        // ============================================
        this.boundInput = this.handleInput.bind(this);
        this.boundTouch = this.handleTouch.bind(this);
        this.boundKey   = this.handleKey.bind(this);

        canvas.addEventListener('click',      this.boundInput);
        canvas.addEventListener('touchstart', this.boundTouch, { passive: false });
        document.addEventListener('keydown',  this.boundKey);

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ============================================================
    // SAVE / LOAD
    // ============================================================

    loadPlayerData() {
        const defaults = {
            coins: 0, diamonds: 0,
            bestScore: 0, totalFlaps: 0,
            totalPipes: 0, gamesPlayed: 0,
            totalCoinsEarned: 0, totalDiamondsEarned: 0,
            dailyStreak: 0, lastDailyReward: null,
            powerUps: { shield: 1, slowmo: 1, magnet: 0, ghost: 0 },
            skinUnlocked: ['default'],
            currentSkin: 'default',
            achievements: [],
            highScores: []
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
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.playerData));
        } catch(e) {}
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
                this.playerData.dailyStreak = diff === 1
                    ? this.playerData.dailyStreak + 1 : 0;
            }
            this.showDailyReward = true;
        }
    }

    claimDailyReward() {
        if (this.dailyRewardClaimed) return;
        const streak = this.playerData.dailyStreak;
        const mult   = Math.min(1 + streak * 0.3, 4);
        const coins  = Math.floor(40 * mult);
        const dias   = Math.floor(1 * Math.max(1, Math.floor(streak / 3)));

        let bonusPup = null;
        if (streak > 0 && streak % 7 === 0) {
            const pkeys = Object.keys(this.powerUps);
            bonusPup = pkeys[Math.floor(Math.random() * pkeys.length)];
            this.powerUps[bonusPup].count++;
        }

        this.playerData.coins            += coins;
        this.playerData.diamonds         += dias;
        this.playerData.totalCoinsEarned += coins;
        this.playerData.totalDiamondsEarned += dias;
        this.playerData.lastDailyReward   = new Date().toDateString();
        this.playerData.dailyStreak++;
        this.dailyRewardClaimed = true;
        this.showDailyReward   = false;

        this.spawnFloatingText(this.canvas.width / 2, this.canvas.height / 2 - 30,
            `+${coins} 🪙`, '#FFD700', 22, 150);
        this.spawnFloatingText(this.canvas.width / 2, this.canvas.height / 2 + 10,
            `+${dias} 💎`, '#00D4FF', 20, 150);
        if (bonusPup) {
            this.spawnFloatingText(this.canvas.width / 2, this.canvas.height / 2 + 50,
                `+1 ${this.powerUps[bonusPup].icon} Bonus!`, '#00FF88', 16, 150);
        }

        if (window.audioManager) audioManager.play('achievement');
        this.savePlayerData();
    }

    // ============================================================
    // STAGE SYSTEM
    // ============================================================

    getStageConfig(stage) {
        const s = Math.min(stage, 25);
        return {
            name:         `Stage ${s}`,
            pipeSpeed:    Math.min(2.2 + s * 0.12, 5.0),  // Starts slow, caps at 5
            pipeGap:      Math.max(175 - s * 5, 110),     // Gets smaller, min 110
            pipeInterval: Math.max(2000 - s * 50, 1200),  // Faster pipes, min 1.2s
            gravity:      Math.min(0.28 + s * 0.008, 0.42),// Slightly heavier
            flapPower:    Math.max(-6.2 - s * 0.04, -7.0), // Slightly stronger flap
            maxFall:      Math.min(7 + s * 0.1, 10),
            coinBonus:    1 + Math.floor(s / 5),
            diamondChance: s >= 10 ? 0.08 : s >= 5 ? 0.04 : 0,
            nightMode:    s >= 8
        };
    }

    updateStage() {
        const newStage = Math.min(Math.floor(this.score / 5) + 1, this.maxStage);
        if (newStage > this.currentStage) {
            this.currentStage = newStage;
            this.stageConfig  = this.getStageConfig(newStage);

            // Apply config
            this.pipeSpeed  = this.stageConfig.pipeSpeed;
            this.pipeGap    = this.stageConfig.pipeGap;
            this.pipeInterval = this.stageConfig.pipeInterval;
            this.gravity    = this.stageConfig.gravity;
            this.flapPower  = this.stageConfig.flapPower;
            this.maxFallSpeed = this.stageConfig.maxFall;

            // Night mode
            if (this.stageConfig.nightMode && !this.nightMode) {
                this.nightMode = true;
            }

            // Stage up notification
            this.showLevelUp  = true;
            this.levelUpTimer = 120;

            this.spawnFloatingText(
                this.canvas.width / 2, this.canvas.height / 2,
                `⬆️ Stage ${newStage}!`, '#FFD700', 24, 120
            );

            // Stage-up coin reward
            const reward = 15 + newStage * 3;
            this.earnCoins(reward, this.canvas.width / 2, this.canvas.height / 2 - 30);

            if (window.audioManager) audioManager.play('levelUp');
        }
    }

    // ============================================================
    // BIRD CREATION
    // ============================================================

    createBird() {
        return {
            x:           this.canvas.width * 0.25,
            y:           this.canvas.height / 2,
            vy:          0,
            rotation:    0,
            radius:      16,
            flapAnim:    0,
            wingAngle:   0,
            deathTimer:  0,
            invincible:  0,
            trail:       [],
            scale:       1,
            ghostAlpha:  1
        };
    }

    // ============================================================
    // INPUT HANDLERS
    // ============================================================

    handleInput(e) {
        this.doAction(e);
    }

    handleTouch(e) {
        e.preventDefault();

        // Check UI button touches
        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / rect.width;
        const sy = this.canvas.height / rect.height;
        const tx = (e.touches[0].clientX - rect.left) * sx;
        const ty = (e.touches[0].clientY - rect.top)  * sy;

        if (this.handleUITap(tx, ty)) return;
        this.doAction(e);
    }

    handleKey(e) {
        if (e.code === 'Space') { e.preventDefault(); this.doAction(e); }
        if (e.key >= '1' && e.key <= '4') {
            const keys = Object.keys(this.powerUps);
            this.activatePowerUp(keys[parseInt(e.key) - 1]);
        }
    }

    handleUITap(x, y) {
        // Power-up buttons
        const btnSize = 36;
        const startX  = 10;
        const btnY    = this.canvas.height - 45;
        let idx = 0;
        for (const [key] of Object.entries(this.powerUps)) {
            const bx = startX + idx * (btnSize + 5);
            if (x >= bx && x <= bx + btnSize && y >= btnY && y <= btnY + btnSize) {
                this.activatePowerUp(key);
                return true;
            }
            idx++;
        }

        // Daily reward claim
        if (this.showDailyReward) {
            this.claimDailyReward();
            return true;
        }

        return false;
    }

    doAction() {
        if (this.paused) return;

        if (this.showDailyReward) {
            this.claimDailyReward();
            return;
        }

        if (this.state === this.STATE.WAITING) {
            this.state        = this.STATE.PLAYING;
            this.lastPipeTime = performance.now();
            this.flap();
            return;
        }

        if (this.state === this.STATE.PLAYING) {
            this.flap();
            return;
        }

        if (this.state === this.STATE.DEAD) {
            if (this.deathOverlayAlpha >= 0.85) {
                this.restartGame();
            }
        }
    }

    // ============================================================
    // FLAP - Core mechanic, feels good now
    // ============================================================

    flap() {
        const speedMult = this.powerUps.slowmo.active ? 0.75 : 1;
        this.bird.vy    = this.flapPower * speedMult;
        this.bird.flapAnim = 1;
        this.bird.scale    = 0.9;
        this.playerData.totalFlaps++;

        // Feathers
        for (let i = 0; i < 2; i++) {
            this.feathers.push({
                x:        this.bird.x + (Math.random() - 0.5) * 8,
                y:        this.bird.y + (Math.random() - 0.5) * 8,
                vx:       (Math.random() - 0.5) * 2.5 - 0.8,
                vy:       Math.random() * 1.5,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.15,
                size:     Math.random() * 5 + 3,
                life:     1,
                decay:    0.022,
                color:    ['#FFD700', '#FFA500', '#FFEE66'][Math.floor(Math.random() * 3)]
            });
        }

        // Dust puff
        this.dustParticles.push({
            x: this.bird.x - 12, y: this.bird.y + 4,
            vx: -1.5, vy: 0,
            size: 6, life: 1, decay: 0.05,
            color: 'rgba(255,255,255,0.35)'
        });

        if (window.audioManager) audioManager.play('jump');
    }

    // ============================================================
    // POWER-UP SYSTEM
    // ============================================================

    activatePowerUp(type) {
        const pup = this.powerUps[type];
        if (!pup || pup.count <= 0 || pup.active) return;
        if (this.state !== this.STATE.PLAYING) return;

        pup.count--;
        pup.active = true;
        pup.timer  = pup.maxTimer || 5000;

        this.flashAlpha = 0.25;
        this.flashColor = pup.color;

        this.spawnFloatingText(
            this.canvas.width / 2, this.canvas.height / 2,
            `${pup.icon} ${pup.name}!`, pup.color, 18, 90
        );

        if (window.audioManager) audioManager.play('powerUp');
        this.savePlayerData();
    }

    buyPowerUp(type) {
        const pup  = this.powerUps[type];
        const cost = pup.cost;
        if (this.playerData.coins >= cost) {
            this.playerData.coins -= cost;
            pup.count++;
            this.savePlayerData();
            return true;
        }
        return false;
    }

    updatePowerUps(dt) {
        for (const [key, pup] of Object.entries(this.powerUps)) {
            if (!pup.active) continue;
            if (pup.maxTimer) {
                pup.timer -= dt;
                if (pup.timer <= 0) {
                    pup.active = false;
                    pup.timer  = 0;
                    this.spawnFloatingText(
                        this.canvas.width / 2, this.canvas.height * 0.35,
                        `${pup.icon} Ended`, '#aaa', 14, 60
                    );
                }
            }
        }
    }

    // ============================================================
    // PIPE SPAWN
    // ============================================================

    spawnPipe(timestamp) {
        const minY = 85;
        const maxY = this.groundY - this.pipeGap - 85;
        const gapY = Math.random() * (maxY - minY) + minY;
        const isNight = this.nightMode;

        this.pipes.push({
            x:          this.canvas.width + 15,
            gapTop:     gapY,
            gapBottom:  gapY + this.pipeGap,
            scored:     false,
            color:      isNight ? '#006644' : '#22aa55',
            glowColor:  isNight ? '#00ff88' : '#55ff88',
            capColor:   isNight ? '#004433' : '#1a8844',
            ghosted:    false,
            coinInGap:  Math.random() < 0.4, // 40% pipes have coin in gap
            coinX:      0,
            coinY:      gapY + this.pipeGap / 2,
            coinCollected: false
        });

        // Last pipe's coin X
        const lastPipe = this.pipes[this.pipes.length - 1];
        lastPipe.coinX = lastPipe.x + this.pipeWidth / 2;

        // Occasional power-up in gap
        if (Math.random() < 0.1 && this.score > 3) {
            const types = ['shield', 'slowmo'];
            this.inGamePowerups.push({
                x:         this.canvas.width + 15,
                y:         gapY + this.pipeGap / 2,
                type:      types[Math.floor(Math.random() * types.length)],
                collected: false,
                wobble:    0
            });
        }
    }

    // ============================================================
    // COIN SYSTEM
    // ============================================================

    earnCoins(amount, x, y) {
        this.playerData.coins            += amount;
        this.playerData.totalCoinsEarned += amount;
        this.sessionCoins                += amount;
        this.hudFlash.coins               = 20;

        this.coinPickups.push({
            x, y,
            text:    `+${amount} 🪙`,
            color:   '#FFD700',
            life:    80,
            opacity: 1,
            vy:      -1.2
        });
    }

    earnDiamonds(amount, x, y) {
        this.playerData.diamonds            += amount;
        this.playerData.totalDiamondsEarned += amount;
        this.sessionDiamonds                += amount;
        this.hudFlash.diamonds               = 20;

        this.coinPickups.push({
            x, y,
            text:    `+${amount} 💎`,
            color:   '#00D4FF',
            life:    100,
            opacity: 1,
            vy:      -1.0
        });

        if (window.audioManager) audioManager.play('achievement');
    }

    checkMilestones() {
        for (const milestone of this.milestones) {
            if (this.score >= milestone && !this.milestonesClaimed.has(milestone)) {
                this.milestonesClaimed.add(milestone);
                const dias = milestone >= 50 ? 3 : milestone >= 20 ? 2 : 1;
                this.earnDiamonds(dias, this.canvas.width / 2, this.canvas.height * 0.3);
                this.spawnFloatingText(
                    this.canvas.width / 2, this.canvas.height * 0.25,
                    `🏆 Milestone ${milestone}! +${dias}💎`,
                    '#00D4FF', 16, 120
                );
            }
        }
    }

    // ============================================================
    // FLOATING TEXT HELPER
    // ============================================================

    spawnFloatingText(x, y, text, color, size = 16, life = 80) {
        this.floatingTexts.push({ x, y, text, color, size, life, opacity: 1 });
    }

    // ============================================================
    // GAME RESTART
    // ============================================================

    restartGame() {
        this.score            = 0;
        this.sessionCoins     = 0;
        this.sessionDiamonds  = 0;
        this.state            = this.STATE.WAITING;
        this.currentStage     = 1;
        this.stageConfig      = this.getStageConfig(1);
        this.milestonesClaimed = new Set();
        this.newBest          = false;

        // Reset physics to stage 1
        this.gravity      = this.stageConfig.gravity;
        this.flapPower    = this.stageConfig.flapPower;
        this.maxFallSpeed = this.stageConfig.maxFall;
        this.pipeSpeed    = this.stageConfig.pipeSpeed;
        this.pipeGap      = this.stageConfig.pipeGap;
        this.pipeInterval = this.stageConfig.pipeInterval;

        this.bird = this.createBird();
        this.pipes = [];
        this.inGamePowerups = [];
        this.particles = [];
        this.feathers  = [];
        this.dustParticles  = [];
        this.coinPickups    = [];
        this.floatingTexts  = [];
        this.scorePopups    = [];

        // Reset power-ups active state
        for (const pup of Object.values(this.powerUps)) {
            pup.active = false;
            pup.timer  = 0;
        }

        this.nightMode         = false;
        this.dayNightAlpha     = 0;
        this.flashAlpha        = 0;
        this.deathOverlayAlpha = 0;
        this.getReadyScale     = 0.5;
        this.showLevelUp       = false;
        this.onScore(0);
    }

    // ============================================================
    // COLLISION CHECK
    // ============================================================

    checkPipeCollision(pipe) {
        const bx = this.bird.x;
        const by = this.bird.y;
        const br = this.bird.radius - 5; // Generous forgiveness

        if (bx + br < pipe.x || bx - br > pipe.x + this.pipeWidth) return false;
        if (by - br < pipe.gapTop)    return true;
        if (by + br > pipe.gapBottom) return true;
        return false;
    }

    // ============================================================
    // BIRD DEATH
    // ============================================================

    birdDie() {
        if (this.state === this.STATE.DEAD) return;
        this.state       = this.STATE.DEAD;
        this.bird.vy     = -4;

        // Death particles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd   = Math.random() * 6 + 2;
            this.particles.push({
                x: this.bird.x, y: this.bird.y,
                vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
                size: Math.random() * 6 + 2, life: 1, decay: 0.022,
                color: ['#FFD700', '#FFA500', '#FF4444', '#fff'][Math.floor(Math.random() * 4)],
                gravity: 0.15
            });
        }

        // Death coin reward
        const medalCoins = (
            [...this.MEDALS].reverse().find(m => this.score >= m.min) || this.MEDALS[0]
        ).coins;
        this.earnCoins(medalCoins + this.sessionCoins, this.canvas.width / 2, this.canvas.height / 2 - 20);

        // Save stats
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            this.playerData.bestScore = this.bestScore;
            this.newBest = true;
            this.earnDiamonds(2, this.canvas.width / 2, this.canvas.height / 2);
        }
        this.playerData.gamesPlayed++;
        this.playerData.totalPipes += this.score;
        this.savePlayerData();

        this.flashAlpha     = 0.6;
        this.flashColor     = '#ffffff';
        this.shake.timer    = 18;
        this.shake.intensity = 10;

        if (window.audioManager) audioManager.play('gameOver');
    }

    // ============================================================
    // MAIN UPDATE
    // ============================================================

    update(timestamp, dt) {
        if (this.paused) return;

        const slowFactor = this.powerUps.slowmo.active ? 0.5 : 1;

        // Stars twinkle
        this.stars.forEach(s => s.twinkle += s.speed);

        // Clouds
        this.clouds.forEach(c => {
            c.x -= c.speed * slowFactor;
            if (c.x + c.w < 0) {
                c.x = this.canvas.width + 50;
                c.y = Math.random() * (this.canvas.height * 0.35) + 30;
            }
        });

        // Ground scroll
        this.groundOffset = (this.groundOffset + this.pipeSpeed * slowFactor) % 40;

        // Screen shake
        if (this.shake.timer > 0) {
            this.shake.x = (Math.random() - 0.5) * this.shake.intensity * (this.shake.timer / 18);
            this.shake.y = (Math.random() - 0.5) * this.shake.intensity * 0.4 * (this.shake.timer / 18);
            this.shake.timer--;
        } else { this.shake.x = 0; this.shake.y = 0; }

        // Flash
        if (this.flashAlpha > 0)   this.flashAlpha   -= 0.05;
        if (this.scoreFlash > 0)   this.scoreFlash--;
        if (this.levelUpTimer > 0) this.levelUpTimer--;
        if (this.levelUpTimer <= 0) this.showLevelUp = false;

        // Score anim
        if (this.scoreDisplayAnim.timer > 0) {
            this.scoreDisplayAnim.scale = 1 + Math.sin(this.scoreDisplayAnim.timer / 4) * 0.12;
            this.scoreDisplayAnim.timer--;
        } else {
            this.scoreDisplayAnim.scale = 1;
        }

        // Day/Night
        if (this.nightMode && this.dayNightAlpha < 1) {
            this.dayNightAlpha = Math.min(1, this.dayNightAlpha + 0.008);
        }

        // HUD flash
        Object.keys(this.hudFlash).forEach(k => {
            if (this.hudFlash[k] > 0) this.hudFlash[k]--;
        });

        // Power-ups
        this.updatePowerUps(dt);

        // ---- WAITING STATE ----
        if (this.state === this.STATE.WAITING) {
            this.bird.y        = this.canvas.height / 2 + Math.sin(timestamp / 500) * 8;
            this.bird.rotation = 0;
            this.bird.wingAngle = Math.sin(timestamp / 220) * 0.4;
            this.getReadyScale = Math.min(1, this.getReadyScale + 0.04);
            return;
        }

        // ---- PLAYING STATE ----
        if (this.state === this.STATE.PLAYING) {
            // Stage update
            this.updateStage();

            // Pipe spawn
            if (timestamp - this.lastPipeTime > this.pipeInterval / slowFactor) {
                this.spawnPipe(timestamp);
                this.lastPipeTime = timestamp;
            }

            // Bird physics - smooth and controlled
            this.bird.vy = Math.min(
                this.bird.vy + this.gravity * slowFactor,
                this.maxFallSpeed
            );
            this.bird.y += this.bird.vy * slowFactor;

            // Smooth rotation
            const targetRot = this.bird.vy > 0
                ? Math.min((this.bird.vy / this.maxFallSpeed) * 1.2, 1.2)
                : Math.max(this.bird.vy * 0.07, -0.4);
            this.bird.rotation += (targetRot - this.bird.rotation) * 0.10;

            // Wing animation
            this.bird.wingAngle += 0.22;
            if (this.bird.flapAnim > 0) {
                this.bird.flapAnim -= 0.07;
                this.bird.scale = Math.min(1, this.bird.scale + 0.05);
            }

            // Trail
            this.bird.trail.push({ x: this.bird.x, y: this.bird.y, r: this.bird.rotation });
            if (this.bird.trail.length > 8) this.bird.trail.shift();

            // In-game powerups
            this.inGamePowerups.forEach(p => {
                p.x     -= this.pipeSpeed * slowFactor;
                p.wobble += 0.06;

                if (!p.collected) {
                    const dx = this.bird.x - p.x;
                    const dy = this.bird.y - p.y;
                    if (Math.sqrt(dx * dx + dy * dy) < 25) {
                        p.collected = true;
                        this.activatePowerUp(p.type);
                        this.powerUps[p.type].count++; // free pick up
                    }
                }
            });
            this.inGamePowerups = this.inGamePowerups.filter(p => !p.collected && p.x > -60);

            // Ghost power-up visual
            this.bird.ghostAlpha = this.powerUps.ghost.active ? 0.5 : 1;

            // Magnet
            if (this.powerUps.magnet.active) {
                this.pipes.forEach(pipe => {
                    if (pipe.coinInGap && !pipe.coinCollected) {
                        const dx = this.bird.x - pipe.coinX;
                        const dy = this.bird.y - pipe.coinY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 120) {
                            pipe.coinX += dx * 0.15;
                            pipe.coinY += dy * 0.15;
                        }
                    }
                });
            }

            // Pipes
            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const pipe = this.pipes[i];
                pipe.x -= this.pipeSpeed * slowFactor;

                // Coin in gap - move with pipe
                if (pipe.coinInGap && !pipe.coinCollected) {
                    pipe.coinX = pipe.x + this.pipeWidth / 2;

                    // Check coin collection
                    const cdx = this.bird.x - pipe.coinX;
                    const cdy = this.bird.y - pipe.coinY;
                    if (Math.sqrt(cdx * cdx + cdy * cdy) < 20) {
                        pipe.coinCollected = true;
                        const coinAmt = this.stageConfig.coinBonus;
                        this.earnCoins(coinAmt, pipe.coinX, pipe.coinY);
                        this.spawnCoinParticles(pipe.coinX, pipe.coinY);
                    }
                }

                // Score pipe
                if (!pipe.scored && pipe.x + this.pipeWidth < this.bird.x) {
                    pipe.scored = true;
                    this.score++;
                    this.onScore(this.score);
                    this.scoreFlash = 12;
                    this.scoreDisplayAnim.timer = 18;

                    // Coin per pipe
                    const earnAmt = 1 + this.stageConfig.coinBonus;
                    this.earnCoins(earnAmt, this.bird.x + 30, this.bird.y - 20);

                    // Diamond chance
                    if (Math.random() < this.stageConfig.diamondChance) {
                        this.earnDiamonds(1, this.bird.x + 30, this.bird.y - 40);
                    }

                    // Best score update
                    if (this.score > this.bestScore) {
                        this.bestScore = this.score;
                        this.playerData.bestScore = this.bestScore;
                    }

                    // Milestone check
                    this.checkMilestones();

                    // Score particles
                    this.spawnScoreParticles();
                    if (window.audioManager) audioManager.play('score');
                }

                // Remove offscreen
                if (pipe.x < -this.pipeWidth - 20) {
                    this.pipes.splice(i, 1);
                    continue;
                }

                // Collision
                if (this.bird.invincible > 0) { this.bird.invincible--; continue; }
                if (this.checkPipeCollision(pipe)) {
                    if (this.powerUps.shield.active) {
                        this.powerUps.shield.active = false;
                        this.powerUps.shield.timer  = 0;
                        this.flashAlpha = 0.4; this.flashColor = '#00d4ff';
                        this.shake.timer = 8; this.shake.intensity = 5;
                        this.pipes.splice(i, 1);
                        this.bird.invincible = 20;
                        this.spawnFloatingText(this.bird.x, this.bird.y - 30, '🛡️ Saved!', '#00d4ff', 16, 60);
                        if (window.audioManager) audioManager.play('powerUp');
                    } else if (this.powerUps.ghost.active) {
                        pipe.ghosted = true; // Pass through
                    } else {
                        this.birdDie();
                        return;
                    }
                }
            }

            // Ground collision
            if (this.bird.y + this.bird.radius >= this.groundY) {
                if (this.powerUps.shield.active) {
                    this.powerUps.shield.active = false;
                    this.bird.y  = this.groundY - this.bird.radius;
                    this.bird.vy = this.flapPower * 0.8;
                    this.spawnFloatingText(this.bird.x, this.bird.y - 30, '🛡️ Saved!', '#00d4ff', 16, 60);
                } else {
                    this.bird.y = this.groundY - this.bird.radius;
                    this.birdDie();
                    return;
                }
            }

            // Ceiling
            if (this.bird.y - this.bird.radius <= 0) {
                this.bird.y  = this.bird.radius;
                this.bird.vy = Math.abs(this.bird.vy) * 0.3;
            }
        }

        // ---- DEAD STATE ----
        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, this.deathOverlayAlpha + 0.015);
            this.bird.deathTimer++;

            if (this.bird.y < this.groundY - this.bird.radius) {
                this.bird.vy        = Math.min(this.bird.vy + 0.5, 10);
                this.bird.y        += this.bird.vy;
                this.bird.rotation  = Math.min(this.bird.rotation + 0.08, Math.PI / 2);
            }
        }

        // ---- PARTICLES ----
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += (p.gravity || 0.08);
            p.vx *= 0.97; p.life -= p.decay; p.size *= 0.97;
            return p.life > 0 && p.size > 0.3;
        });

        this.feathers = this.feathers.filter(f => {
            f.x += f.vx; f.y += f.vy;
            f.vy += 0.04; f.vx *= 0.98;
            f.rotation += f.rotSpeed; f.life -= f.decay;
            return f.life > 0;
        });

        this.dustParticles = this.dustParticles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.size += 0.4; p.life -= p.decay;
            return p.life > 0;
        });

        this.coinPickups = this.coinPickups.filter(p => {
            p.y += p.vy; p.life -= 2;
            p.opacity = Math.min(1, p.life / 40);
            return p.life > 0;
        });

        this.floatingTexts = this.floatingTexts.filter(t => {
            t.y -= 0.7; t.life -= 1;
            t.opacity = Math.min(1, t.life / 40);
            return t.life > 0;
        });
    }

    // ============================================================
    // PARTICLE HELPERS
    // ============================================================

    spawnScoreParticles() {
        for (let i = 0; i < 7; i++) {
            this.particles.push({
                x: this.bird.x + 30, y: this.bird.y,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * -4 - 0.5,
                size: Math.random() * 5 + 2, life: 1, decay: 0.035,
                color: this.currentStage > 15 ? '#b347d9' :
                       this.currentStage > 8  ? '#FFD700' : '#00FF88',
                gravity: 0.04
            });
        }
    }

    spawnCoinParticles(x, y) {
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3 - 1,
                size: 3, life: 1, decay: 0.04,
                color: '#FFD700', gravity: 0.05
            });
        }
    }

    // ============================================================
    // DRAW
    // ============================================================

    draw(timestamp) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.shake.x, this.shake.y);

        this.drawBackground(timestamp);
        this.drawClouds();
        this.drawPipes();
        this.drawInGamePowerups();
        this.drawFeathers();
        this.drawDust();
        this.drawParticles();
        this.drawGround();
        this.drawBird(timestamp);
        this.drawCoinPickups();
        this.drawFloatingTexts();

        // Flash
        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, Math.max(0, this.flashAlpha));
            ctx.fillRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
        }

        // Slow-mo overlay
        if (this.powerUps.slowmo.active) {
            ctx.fillStyle = `rgba(179,71,217,${0.04 + Math.sin(timestamp / 200) * 0.02})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.state === this.STATE.WAITING) this.drawGetReady(timestamp);
        if (this.state !== this.STATE.WAITING) this.drawHUD(timestamp);
        if (this.state === this.STATE.DEAD)    this.drawDeathScreen();
        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyReward();
        if (this.showLevelUp)  this.drawStageUp();

        this.drawPowerUpBar();

        ctx.restore();
    }

    // ============================================================
    // DRAW: BACKGROUND
    // ============================================================

    drawBackground(timestamp) {
        const ctx = this.ctx;
        const W   = this.canvas.width;
        const H   = this.groundY;

        // Sky gradient
        const dayG = ctx.createLinearGradient(0, 0, 0, H);
        dayG.addColorStop(0, '#1a1a4a');
        dayG.addColorStop(0.6, '#0a1530');
        dayG.addColorStop(1, '#050a20');

        const nightG = ctx.createLinearGradient(0, 0, 0, H);
        nightG.addColorStop(0, '#000010');
        nightG.addColorStop(0.6, '#000820');
        nightG.addColorStop(1, '#000510');

        ctx.fillStyle = dayG;
        ctx.fillRect(0, 0, W, H);

        if (this.dayNightAlpha > 0) {
            ctx.globalAlpha = this.dayNightAlpha;
            ctx.fillStyle   = nightG;
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
        }

        // Stars
        this.stars.forEach(s => {
            const nightVisible = this.nightMode
                ? (0.5 + Math.sin(s.twinkle) * 0.4) * Math.min(1, this.dayNightAlpha * 2)
                : 0.1 * (1 - this.dayNightAlpha);
            if (nightVisible <= 0) return;
            ctx.globalAlpha = nightVisible;
            ctx.fillStyle   = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
            if (s.size > 1.2 && this.nightMode) {
                ctx.globalAlpha = nightVisible * 0.25;
                ctx.fillStyle   = '#aaddff';
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;

        // Moon
        if (this.nightMode && this.dayNightAlpha > 0.3) {
            const a = Math.min(1, (this.dayNightAlpha - 0.3) / 0.4);
            ctx.globalAlpha = a;
            ctx.fillStyle   = '#fffde0';
            ctx.shadowBlur  = 25;
            ctx.shadowColor = '#fffde0';
            ctx.beginPath();
            ctx.arc(W - 65, 55, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle  = '#000820'; // crescent
            ctx.beginPath();
            ctx.arc(W - 56, 49, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    drawClouds() {
        const ctx = this.ctx;
        this.clouds.forEach(c => {
            const alpha = this.nightMode
                ? 0.08 * (1 - this.dayNightAlpha) + 0.04
                : 0.22;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#fff';
            // Cloud body
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x - c.w * 0.22, c.y + 5, c.w * 0.36, c.h * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x + c.w * 0.22, c.y + 5, c.w * 0.36, c.h * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // DRAW: PIPES
    // ============================================================

    drawPipes() {
        const ctx = this.ctx;
        this.pipes.forEach(pipe => {
            if (pipe.ghosted && this.powerUps.ghost.active) {
                ctx.globalAlpha = 0.4;
            }

            const pw    = this.pipeWidth;
            const capH  = 22;
            const capEx = 7;

            ctx.shadowBlur  = 8;
            ctx.shadowColor = pipe.glowColor;

            const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pw, 0);
            grad.addColorStop(0,   this.darkenHex(pipe.color, 30));
            grad.addColorStop(0.3, pipe.color);
            grad.addColorStop(0.7, this.lightenHex(pipe.color, 20));
            grad.addColorStop(1,   this.darkenHex(pipe.color, 20));

            // TOP pipe body
            ctx.fillStyle = grad;
            ctx.fillRect(pipe.x, 0, pw, pipe.gapTop - capH);

            // TOP cap
            ctx.fillStyle = this.darkenHex(pipe.color, 10);
            ctx.fillRect(pipe.x - capEx / 2, pipe.gapTop - capH, pw + capEx, capH);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(pipe.x - capEx / 2 + 3, pipe.gapTop - capH + 3, (pw + capEx) * 0.4, capH - 6);

            // BOTTOM pipe body
            ctx.fillStyle = grad;
            ctx.fillRect(pipe.x, pipe.gapBottom + capH, pw, this.groundY - pipe.gapBottom - capH);

            // BOTTOM cap
            ctx.fillStyle = this.darkenHex(pipe.color, 10);
            ctx.fillRect(pipe.x - capEx / 2, pipe.gapBottom, pw + capEx, capH);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(pipe.x - capEx / 2 + 3, pipe.gapBottom + 3, (pw + capEx) * 0.4, capH - 6);

            // Edge shadow
            ctx.fillStyle  = 'rgba(0,0,0,0.15)';
            ctx.fillRect(pipe.x + pw - 5, 0, 5, pipe.gapTop);
            ctx.fillRect(pipe.x + pw - 5, pipe.gapBottom, 5, this.groundY - pipe.gapBottom);

            ctx.shadowBlur = 0;

            // Coin in gap
            if (pipe.coinInGap && !pipe.coinCollected) {
                const pulse = 0.8 + Math.sin(Date.now() / 300) * 0.2;
                ctx.save();
                ctx.translate(pipe.coinX, pipe.coinY);
                ctx.scale(pulse, pulse);

                ctx.shadowBlur  = 12;
                ctx.shadowColor = '#FFD700';
                ctx.fillStyle   = '#FFD700';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#FFF8C0';
                ctx.beginPath();
                ctx.arc(-2, -2, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#AA7700';
                ctx.fillText('$', 0, 4);
                ctx.restore();
                ctx.textAlign = 'left';
            }

            ctx.globalAlpha = 1;
        });
    }

    drawInGamePowerups() {
        const ctx = this.ctx;
        this.inGamePowerups.forEach(p => {
            const pup   = this.powerUps[p.type];
            const pulse = 1 + Math.sin(p.wobble) * 0.1;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(pulse, pulse);

            ctx.shadowBlur  = 15;
            ctx.shadowColor = pup.color;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fill();
            ctx.strokeStyle = pup.color;
            ctx.lineWidth   = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.font        = '18px serif';
            ctx.textAlign   = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pup.icon, 0, 1);
            ctx.restore();
        });
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    // ============================================================
    // DRAW: GROUND
    // ============================================================

    drawGround() {
        const ctx = this.ctx;
        const gH  = this.canvas.height - this.groundY;
        const isN = this.nightMode;

        const gGrad = ctx.createLinearGradient(0, this.groundY, 0, this.canvas.height);
        gGrad.addColorStop(0,   isN ? '#1a2200' : '#2d5a00');
        gGrad.addColorStop(0.3, isN ? '#0f1500' : '#1a3d00');
        gGrad.addColorStop(1,   isN ? '#080a00' : '#0d1f00');
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, this.groundY, this.canvas.width, gH);

        // Grass strip
        const grassG = ctx.createLinearGradient(0, this.groundY, 0, this.groundY + 12);
        grassG.addColorStop(0, isN ? '#2a3800' : '#4a9a00');
        grassG.addColorStop(1, isN ? '#1a2500' : '#2d6a00');
        ctx.fillStyle = grassG;
        ctx.fillRect(0, this.groundY, this.canvas.width, 12);

        // Moving tiles
        ctx.fillStyle = isN ? 'rgba(50,70,0,0.25)' : 'rgba(0,0,0,0.08)';
        for (let x = -this.groundOffset; x < this.canvas.width; x += 40) {
            ctx.fillRect(x, this.groundY + 12, 20, gH - 12);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, this.groundY, this.canvas.width, 3);

        ctx.shadowBlur  = 6;
        ctx.shadowColor = isN ? '#2a3800' : '#4a9a00';
        ctx.strokeStyle = isN ? '#3a5000' : '#6aaa00';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, this.groundY);
        ctx.lineTo(this.canvas.width, this.groundY);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // ============================================================
    // DRAW: BIRD - Beautiful and smooth
    // ============================================================

    drawBird(timestamp) {
        const ctx  = this.ctx;
        const bird = this.bird;

        // Trail
        bird.trail.forEach((t, i) => {
            ctx.globalAlpha = (i / bird.trail.length) * 0.12;
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(t.r);
            ctx.beginPath();
            ctx.ellipse(0, 0, bird.radius * 0.85, bird.radius * 0.7, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#FFD700';
            ctx.fill();
            ctx.restore();
        });
        ctx.globalAlpha = bird.ghostAlpha || 1;

        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.rotation);
        ctx.scale(bird.scale, bird.scale);

        // Shield ring
        if (this.powerUps.shield.active) {
            const sp = 0.6 + Math.sin(timestamp / 100) * 0.3;
            ctx.shadowBlur  = 18;
            ctx.shadowColor = '#00d4ff';
            ctx.strokeStyle = `rgba(0,212,255,${sp})`;
            ctx.lineWidth   = 3;
            ctx.beginPath();
            ctx.arc(0, 0, bird.radius + 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = `rgba(0,212,255,${sp * 0.08})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Ghost visual
        if (this.powerUps.ghost.active) {
            ctx.shadowBlur  = 12;
            ctx.shadowColor = '#00FF88';
        }

        // Body glow
        ctx.shadowBlur  = 15;
        ctx.shadowColor = '#FFD700';

        // Body
        const bGrad = ctx.createRadialGradient(-4, -5, 1, 0, 0, bird.radius);
        bGrad.addColorStop(0,   '#FFEE66');
        bGrad.addColorStop(0.4, '#FFD700');
        bGrad.addColorStop(0.8, '#FFA500');
        bGrad.addColorStop(1,   '#FF8C00');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, bird.radius, bird.radius * 0.88, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Wing
        const wingFlap = bird.flapAnim > 0 ? -bird.flapAnim * 7 : 0;
        const wingY    = Math.sin(bird.wingAngle) * 4;
        ctx.fillStyle  = '#FF8C00';
        ctx.save();
        ctx.translate(-3, wingY + wingFlap);
        ctx.rotate(-0.2 + wingFlap * 0.04);
        ctx.beginPath();
        ctx.ellipse(-6, 2, 10, 5.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // Feather tips
        ctx.fillStyle = '#cc6600';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(-12 + i * 3, 5 + i * 1.5, 3, 4.5, -0.4 + i * 0.1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Belly
        ctx.fillStyle = '#FFFDE0';
        ctx.beginPath();
        ctx.ellipse(3, 3, bird.radius * 0.52, bird.radius * 0.43, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Eye white
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(7, -4, 6, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(8.2, -3.5, 3.3, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(9.2, -5, 1.4, 0, Math.PI * 2);
        ctx.fill();

        // Angry brow when falling
        if (bird.rotation > 0.25) {
            ctx.strokeStyle = '#333';
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.moveTo(4, -9);
            ctx.quadraticCurveTo(8, -11, 13, -9);
            ctx.stroke();
        }

        // Beak
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.moveTo(13, -2);
        ctx.lineTo(21, 1);
        ctx.lineTo(13, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#cc4400';
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.moveTo(13, 1);
        ctx.lineTo(21, 1);
        ctx.stroke();

        // Blush
        ctx.fillStyle = 'rgba(255,100,100,0.3)';
        ctx.beginPath();
        ctx.ellipse(5, 2, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        ctx.fillStyle = '#FF8C00';
        ctx.save();
        ctx.translate(-bird.radius + 2, 2);
        ctx.rotate(bird.rotation * 0.25);
        for (let i = -1; i <= 1; i++) {
            ctx.save();
            ctx.rotate(i * 0.22);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-11, i * 3.5);
            ctx.lineTo(-7, i * 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // DRAW: PARTICLES & EFFECTS
    // ============================================================

    drawFeathers() {
        const ctx = this.ctx;
        this.feathers.forEach(f => {
            ctx.globalAlpha = f.life;
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.rotation);
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, f.size * 0.25, f.size, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    drawDust() {
        const ctx = this.ctx;
        this.dustParticles.forEach(p => {
            ctx.globalAlpha = p.life * 0.4;
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawParticles() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.shadowBlur  = 5;
            ctx.shadowColor = p.color;
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawCoinPickups() {
        const ctx = this.ctx;
        this.coinPickups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font        = `bold 13px Orbitron`;
            ctx.textAlign   = 'center';
            ctx.fillStyle   = p.color;
            ctx.shadowBlur  = 6;
            ctx.shadowColor = p.color;
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'left';
    }

    drawFloatingTexts() {
        const ctx = this.ctx;
        this.floatingTexts.forEach(t => {
            ctx.globalAlpha = t.opacity;
            ctx.font        = `bold ${t.size}px Orbitron`;
            ctx.textAlign   = 'center';
            ctx.fillStyle   = t.color;
            ctx.shadowBlur  = 8;
            ctx.shadowColor = t.color;
            ctx.fillText(t.text, t.x, t.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'left';
    }

    // ============================================================
    // DRAW: HUD
    // ============================================================

    drawGetReady(timestamp) {
        const ctx = this.ctx;
        const cx  = this.canvas.width / 2;

        ctx.save();
        ctx.translate(cx, this.canvas.height * 0.3);
        ctx.scale(this.getReadyScale, this.getReadyScale);

        ctx.fillStyle   = 'rgba(0,0,0,0.6)';
        ctx.strokeStyle = 'rgba(255,215,0,0.5)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.roundRect?.(-115, -38, 230, 76, 15) || ctx.rect(-115, -38, 230, 76);
        ctx.fill();
        ctx.stroke();

        ctx.font        = 'bold 20px Orbitron';
        ctx.textAlign   = 'center';
        ctx.fillStyle   = '#FFD700';
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#FFD700';
        ctx.fillText('GET READY!', 0, -8);
        ctx.shadowBlur  = 0;

        ctx.font        = '13px Rajdhani';
        ctx.fillStyle   = '#aaa';
        ctx.fillText('TAP / SPACE to fly', 0, 18);

        ctx.restore();
        ctx.textAlign = 'left';

        const tapBounce = Math.sin(timestamp / 350) * 7;
        ctx.fillStyle   = 'rgba(255,255,255,0.6)';
        ctx.font        = '26px serif';
        ctx.textAlign   = 'center';
        ctx.fillText('👆', cx, this.bird.y + 50 + tapBounce);
        ctx.textAlign   = 'left';
    }

    drawHUD(timestamp) {
        const ctx = this.ctx;
        const cx  = this.canvas.width / 2;

        // Score
        const sc = this.scoreDisplayAnim.scale;
        ctx.save();
        ctx.translate(cx, 55);
        ctx.scale(sc, sc);
        ctx.font        = 'bold 38px Orbitron';
        ctx.textAlign   = 'center';
        ctx.fillStyle   = '#fff';
        ctx.shadowBlur  = this.scoreFlash > 0 ? 18 : 6;
        ctx.shadowColor = this.scoreFlash > 0 ? '#FFD700' : 'rgba(0,0,0,0.5)';
        ctx.fillText(this.score, 0, 0);
        ctx.shadowBlur  = 0;
        ctx.restore();

        // Best
        if (this.bestScore > 0) {
            ctx.fillStyle = 'rgba(255,215,0,0.65)';
            ctx.font      = '11px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillText(`BEST: ${this.bestScore}`, cx, 74);
        }

        // Stage badge
        ctx.fillStyle   = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.roundRect?.(8, 8, 72, 28, 8) || ctx.rect(8, 8, 72, 28);
        ctx.fill();
        ctx.font        = 'bold 10px Orbitron';
        ctx.fillStyle   = '#b347d9';
        ctx.fillText(`STAGE ${this.currentStage}`, 12, 20);
        ctx.font        = '9px Rajdhani';
        ctx.fillStyle   = '#888';
        ctx.fillText(this.stageConfig.name, 12, 32);

        // Coins & Diamonds HUD (top right)
        const cAlpha = this.hudFlash.coins    > 0 ? 1 : 0.75;
        const dAlpha = this.hudFlash.diamonds > 0 ? 1 : 0.75;

        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect?.(this.canvas.width - 88, 8, 80, 46, 8) ||
            ctx.rect(this.canvas.width - 88, 8, 80, 46);
        ctx.fill();

        ctx.font      = `bold ${this.hudFlash.coins > 0 ? 11 : 10}px Orbitron`;
        ctx.fillStyle = `rgba(255,215,0,${cAlpha})`;
        ctx.textAlign = 'right';
        ctx.fillText(`🪙 ${this.playerData.coins}`, this.canvas.width - 10, 22);

        ctx.font      = `bold ${this.hudFlash.diamonds > 0 ? 11 : 10}px Orbitron`;
        ctx.fillStyle = `rgba(0,212,255,${dAlpha})`;
        ctx.fillText(`💎 ${this.playerData.diamonds}`, this.canvas.width - 10, 40);
        ctx.textAlign = 'left';

        // Power-up timers
        let puY = 100;
        for (const [key, pup] of Object.entries(this.powerUps)) {
            if (!pup.active || !pup.maxTimer) continue;
            const pct = pup.timer / pup.maxTimer;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect?.(8, puY, 90, 18, 5) || ctx.rect(8, puY, 90, 18);
            ctx.fill();
            ctx.fillStyle = pup.color;
            ctx.beginPath();
            ctx.roundRect?.(8, puY, 90 * pct, 18, 5) || ctx.rect(8, puY, 90 * pct, 18);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font      = '10px Rajdhani';
            ctx.fillText(`${pup.icon} ${pup.name}`, 11, puY + 13);
            puY += 24;
        }
    }

    drawPowerUpBar() {
        const ctx     = this.ctx;
        const btnSize = 34;
        const startX  = 8;
        const btnY    = this.canvas.height - 44;
        let idx = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx       = startX + idx * (btnSize + 5);
            const isActive = pup.active;
            const canUse   = pup.count > 0;

            ctx.fillStyle   = isActive
                ? `${pup.color}33`
                : canUse ? 'rgba(179,71,217,0.15)' : 'rgba(50,50,50,0.3)';
            ctx.strokeStyle = isActive ? pup.color : canUse ? 'rgba(179,71,217,0.35)' : 'rgba(100,100,100,0.3)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.roundRect?.(bx, btnY, btnSize, btnSize, 6) || ctx.rect(bx, btnY, btnSize, btnSize);
            ctx.fill();
            ctx.stroke();

            ctx.font          = '14px Arial';
            ctx.textAlign     = 'center';
            ctx.textBaseline  = 'middle';
            ctx.globalAlpha   = canUse ? 1 : 0.4;
            ctx.fillText(pup.icon, bx + btnSize / 2, btnY + btnSize / 2 - 3);

            ctx.font        = 'bold 8px Orbitron';
            ctx.fillStyle   = canUse ? '#00FF88' : '#ff0055';
            ctx.globalAlpha = 1;
            ctx.fillText(`${pup.count}`, bx + btnSize / 2, btnY + btnSize - 5);

            ctx.textAlign     = 'left';
            ctx.textBaseline  = 'alphabetic';
            idx++;
        }
    }

    drawStageUp() {
        if (!this.showLevelUp) return;
        const ctx     = this.ctx;
        const progress = 1 - (this.levelUpTimer / 120);
        const alpha   = this.levelUpTimer > 60
            ? (120 - this.levelUpTimer) / 60
            : this.levelUpTimer / 60;

        ctx.globalAlpha = alpha;
        ctx.font        = 'bold 28px Orbitron';
        ctx.textAlign   = 'center';
        ctx.fillStyle   = '#FFD700';
        ctx.shadowBlur  = 20;
        ctx.shadowColor = '#FFD700';
        ctx.fillText(
            `⬆️ Stage ${this.currentStage}!`,
            this.canvas.width / 2,
            this.canvas.height * 0.45
        );
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'left';
    }

    // ============================================================
    // DRAW: DEATH SCREEN
    // ============================================================

    drawDeathScreen() {
        const ctx   = this.ctx;
        const cx    = this.canvas.width / 2;
        const cy    = this.canvas.height / 2;
        const alpha = this.deathOverlayAlpha;

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.65})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.55) return;

        const pAlpha = Math.min(1, (alpha - 0.55) / 0.45);
        ctx.globalAlpha = pAlpha;

        const panelW = Math.min(this.canvas.width - 30, 310);
        const panelH = 280;
        const panelX = cx - panelW / 2;
        const panelY = cy - panelH / 2 - 10;

        ctx.fillStyle   = 'rgba(8,5,20,0.96)';
        ctx.strokeStyle = 'rgba(179,71,217,0.5)';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.roundRect?.(panelX, panelY, panelW, panelH, 20) ||
            ctx.rect(panelX, panelY, panelW, panelH);
        ctx.fill();
        ctx.shadowBlur  = 20;
        ctx.shadowColor = '#b347d9';
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Top accent
        ctx.fillStyle = 'rgba(179,71,217,0)';
        const acGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
        acGrad.addColorStop(0,   'transparent');
        acGrad.addColorStop(0.5, 'rgba(179,71,217,0.6)');
        acGrad.addColorStop(1,   'transparent');
        ctx.fillStyle = acGrad;
        ctx.fillRect(panelX, panelY, panelW, 2);

        // Title
        ctx.font        = 'bold 26px Orbitron';
        ctx.textAlign   = 'center';
        ctx.fillStyle   = '#FF006E';
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('GAME OVER', cx, panelY + 42);
        ctx.shadowBlur  = 0;

        // Medal
        const medal = [...this.MEDALS].reverse().find(m => this.score >= m.min) || this.MEDALS[0];
        ctx.font = '34px serif';
        ctx.fillText(medal.emoji, cx, panelY + 84);

        // Stage reached
        ctx.font      = '12px Rajdhani';
        ctx.fillStyle = '#b347d9';
        ctx.fillText(`Stage ${this.currentStage} reached`, cx, panelY + 104);

        // Divider
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 18, panelY + 113);
        ctx.lineTo(panelX + panelW - 18, panelY + 113);
        ctx.stroke();

        // Stats
        ctx.font      = 'bold 14px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#888';
        ctx.fillText('SCORE', panelX + 22, panelY + 137);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.score, panelX + panelW - 22, panelY + 137);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#888';
        ctx.fillText('BEST', panelX + 22, panelY + 162);
        ctx.textAlign = 'right';
        ctx.fillStyle = this.newBest ? '#FFD700' : '#fff';
        ctx.fillText(this.bestScore, panelX + panelW - 22, panelY + 162);
        if (this.newBest) {
            ctx.font      = '10px Orbitron';
            ctx.fillStyle = '#FFD700';
            ctx.fillText('NEW BEST! 🎉', panelX + panelW - 22, panelY + 176);
        }

        // Earned this run
        ctx.font      = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 +${this.sessionCoins}`, cx - 35, panelY + 205);
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 +${this.sessionDiamonds}`, cx + 45, panelY + 205);

        // Tap to restart
        const blink = 0.5 + Math.sin(Date.now() / 400) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${blink * pAlpha})`;
        ctx.font      = '13px Rajdhani';
        ctx.fillText('TAP TO PLAY AGAIN', cx, panelY + panelH - 16);

        ctx.globalAlpha = 1;
        ctx.textAlign   = 'left';
    }

    // ============================================================
    // DRAW: DAILY REWARD
    // ============================================================

    drawDailyReward() {
        const ctx = this.ctx;
        const W   = this.canvas.width;
        const H   = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, W, H);

        const cw = Math.min(300, W - 30);
        const ch = 250;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        ctx.fillStyle   = 'rgba(12,8,28,0.97)';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.roundRect?.(cx, cy, cw, ch, 18) || ctx.rect(cx, cy, cw, ch);
        ctx.fill();
        ctx.shadowBlur  = 18;
        ctx.shadowColor = '#FFD700';
        ctx.stroke();
        ctx.shadowBlur  = 0;

        const streak = this.playerData.dailyStreak;
        const mult   = Math.min(1 + streak * 0.3, 4);
        const coins  = Math.floor(40 * mult);
        const dias   = Math.floor(1 * Math.max(1, Math.floor(streak / 3)));

        ctx.font      = 'bold 18px Orbitron';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.fillText('🎁 Daily Reward!', W / 2, cy + 38);

        ctx.font      = '13px Rajdhani';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`Day ${streak + 1} Streak! 🔥`, W / 2, cy + 62);

        ctx.font      = 'bold 22px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 ${coins}`, W / 2, cy + 105);

        ctx.font      = 'bold 18px Arial';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 ${dias}`, W / 2, cy + 138);

        if (streak > 0 && streak % 7 === 0) {
            ctx.font      = '13px Rajdhani';
            ctx.fillStyle = '#00FF88';
            ctx.fillText('+ Bonus Power-up! 🎉', W / 2, cy + 166);
        }

        // Claim button
        const bw  = 150;
        const bh  = 38;
        const bx  = (W - bw) / 2;
        const by  = cy + ch - 52;
        const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        grd.addColorStop(0, '#B347D9');
        grd.addColorStop(1, '#FF006E');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.roundRect?.(bx, by, bw, bh, 20) || ctx.rect(bx, by, bw, bh);
        ctx.fill();

        ctx.font      = 'bold 13px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.fillText('CLAIM! ✨', W / 2, by + 25);
        ctx.textAlign = 'left';
    }

    // ============================================================
    // UTILS
    // ============================================================

    hexToRgba(color, alpha) {
        if (!color.startsWith('#')) return color;
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
    }

    lightenHex(hex, amt) {
        if (!hex.startsWith('#')) return hex;
        return `rgb(${Math.min(255, parseInt(hex.slice(1,3),16)+amt)},${Math.min(255,parseInt(hex.slice(3,5),16)+amt)},${Math.min(255,parseInt(hex.slice(5,7),16)+amt)})`;
    }

    darkenHex(hex, amt) {
        if (!hex.startsWith('#')) return hex;
        return `rgb(${Math.max(0, parseInt(hex.slice(1,3),16)-amt)},${Math.max(0,parseInt(hex.slice(3,5),16)-amt)},${Math.max(0,parseInt(hex.slice(5,7),16)-amt)})`;
    }

    // ============================================================
    // GAME LOOP
    // ============================================================

    loop(timestamp) {
        if (this.destroyed) return;
        const dt = timestamp - (this.lastTime || timestamp);
        this.lastTime = timestamp;
        if (!this.paused) this.update(timestamp, dt);
        this.draw(timestamp);
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused   = !this.paused;
        this.isPaused = this.paused;
        if (!this.paused) this.lastTime = performance.now();
        return this.paused;
    }

    resize() {
        this.groundY = this.canvas.height - 50;
        this.bird.x  = this.canvas.width * 0.25;
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click',      this.boundInput);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
        document.removeEventListener('keydown',       this.boundKey);
        this.savePlayerData();
    }
}