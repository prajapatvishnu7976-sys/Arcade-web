/* ============================================================
   KNIFE HIT v3.0 - KHATARNAK PREMIUM EDITION
   Original Game Feel + Coins + Diamonds + Daily Rewards
   ============================================================ */

'use strict';

class KnifeHit {
    constructor(canvas, onScore, options = {}) {
        this.canvas  = canvas;
        this.ctx     = canvas.getContext('2d');
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused    = false;
        this.isPaused  = false;
        this.gameOver  = false;

        // ============================================
        // SAVE SYSTEM
        // ============================================
        this.saveKey    = 'neonarcade_knifehit';
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
        this.perfectThrows = 0; // No apple hit streak

        // ============================================
        // KNIVES CONFIG
        // ============================================
        this.knivesTotal  = 0;
        this.knivesLeft   = 0;
        this.knivesThrown = 0;

        // ============================================
        // TARGET (LOG)
        // ============================================
        this.target = this.createTarget();

        // ============================================
        // KNIFE SKINS
        // ============================================
        this.knifeSkins = {
            default:  { blade: ['#999','#ddd','#fff'], handle: ['#3a1a0a','#6a3a1a','#3a1a0a'], guard: '#888', name: 'Classic' },
            neon:     { blade: ['#00d4ff','#66eeff','#fff'], handle: ['#0a1a3a','#1a3a6a','#0a1a3a'], guard: '#00d4ff', name: 'Neon' },
            fire:     { blade: ['#ff4400','#ff8800','#ffcc00'], handle: ['#3a0a00','#6a1a00','#3a0a00'], guard: '#ff4400', name: 'Fire' },
            gold:     { blade: ['#cc9900','#FFD700','#fffacd'], handle: ['#3a2a00','#6a4a00','#3a2a00'], guard: '#FFD700', name: 'Gold' },
            shadow:   { blade: ['#444','#888','#ccc'], handle: ['#1a1a1a','#333','#1a1a1a'], guard: '#555', name: 'Shadow' }
        };
        this.currentSkin = this.playerData.currentSkin || 'default';

        // ============================================
        // OBJECTS
        // ============================================
        this.stuckKnives  = [];
        this.flyingKnife  = null;
        this.idleKnife    = null;
        this.apples       = [];
        this.coins        = []; // Coins orbiting target

        // ============================================
        // VISUAL FX
        // ============================================
        this.particles    = [];
        this.explosions   = [];
        this.scorePopups  = [];
        this.floatingTexts = [];
        this.coinPickups  = [];
        this.breakPieces  = [];
        this.bgParticles  = this.createBgParticles();

        // ============================================
        // STATE FLAGS
        // ============================================
        this.stageComplete      = false;
        this.stageCompleteTimer = 0;
        this.showLevelComplete  = false;
        this.levelCompleteTimer = 0;

        // ============================================
        // SCREEN EFFECTS
        // ============================================
        this.screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.flashTimer  = 0;
        this.flashColor  = '#ff0055';
        this.flashAlpha  = 0;

        // ============================================
        // HUD
        // ============================================
        this.hudFlash = {};

        // ============================================
        // POWER-UPS
        // ============================================
        this.powerUps = {
            extraKnife: { count: this.playerData.powerUps?.extraKnife || 1, cost: 50,  icon: '🗡️', name: 'Extra Knife', color: '#00FF88', desc: '+2 knives this round' },
            slowTarget: { count: this.playerData.powerUps?.slowTarget || 1, cost: 75,  icon: '🐢', name: 'Slow Down',   color: '#00D4FF', desc: 'Slows target for 5s' },
            shield:     { count: this.playerData.powerUps?.shield || 1,     cost: 100, icon: '🛡️', name: 'Shield',     color: '#b347d9', desc: 'Saves from 1 collision' },
            bomb:       { count: this.playerData.powerUps?.bomb || 0,       cost: 150, icon: '💣', name: 'Bomb',       color: '#FF8C00', desc: 'Clears all stuck knives' }
        };
        this.activeEffects = {
            slow: false, slowTimer: 0,
            shield: false
        };

        // ============================================
        // DAILY REWARD
        // ============================================
        this.showDailyReward     = false;
        this.dailyRewardClaimed  = false;
        this.checkDailyReward();

        // ============================================
        // MILESTONES
        // ============================================
        this.milestones = [5, 10, 20, 30, 50, 75, 100, 150, 200];
        this.milestonesClaimed = new Set();

        // Initialize first level
        this.setupLevel();
        this.createIdleKnife();

        // ============================================
        // EVENTS
        // ============================================
        this.boundClick = this.onThrow.bind(this);
        this.boundTouch = this.onTouchThrow.bind(this);
        this.boundKey   = this.onKeyDown.bind(this);

        canvas.addEventListener('click',      this.boundClick);
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
            currentLevel: 1, highestLevel: 1,
            bestScore: 0, totalKnivesThrown: 0,
            totalApplesHit: 0, gamesPlayed: 0,
            totalCoinsEarned: 0, totalDiamondsEarned: 0,
            dailyStreak: 0, lastDailyReward: null,
            levelStars: {}, powerUps: {},
            currentSkin: 'default',
            skinsUnlocked: ['default']
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
                if (diff > 1) this.playerData.dailyStreak = 0;
            }
            this.showDailyReward = true;
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

        this.spawnFloat(this.canvas.width/2, this.canvas.height/2-40, `+${coins} 🪙`, '#FFD700', 22, 160);
        this.spawnFloat(this.canvas.width/2, this.canvas.height/2,    `+${dias} 💎`,  '#00D4FF', 20, 160);
        if (bonusPup) {
            this.spawnFloat(this.canvas.width/2, this.canvas.height/2+40,
                `+1 ${this.powerUps[bonusPup].icon} Bonus!`, '#00FF88', 16, 160);
        }

        if (window.audioManager) audioManager.play('achievement');
        this.savePlayerData();
    }

    // ============================================================
    // LEVEL CONFIG - 25 Levels
    // ============================================================

    getLevelConfig(level) {
        const l = Math.min(level, 25);
        const configs = {
            1:  { knives: 7,  speed: 0.015, pattern: 'constant',  apples: 0, reverseChance: 0,    bossMode: false, name: 'Beginner' },
            2:  { knives: 8,  speed: 0.020, pattern: 'constant',  apples: 1, reverseChance: 0,    bossMode: false, name: 'Warm Up' },
            3:  { knives: 8,  speed: 0.025, pattern: 'wobble',    apples: 1, reverseChance: 0,    bossMode: false, name: 'Wobbler' },
            4:  { knives: 9,  speed: 0.028, pattern: 'wobble',    apples: 2, reverseChance: 0,    bossMode: false, name: 'Two Apples' },
            5:  { knives: 10, speed: 0.032, pattern: 'reverse',   apples: 1, reverseChance: 0.3,  bossMode: true,  name: '👹 Boss 1' },
            6:  { knives: 9,  speed: 0.030, pattern: 'reverse',   apples: 2, reverseChance: 0.3,  bossMode: false, name: 'Reversal' },
            7:  { knives: 10, speed: 0.034, pattern: 'wobble',    apples: 2, reverseChance: 0.4,  bossMode: false, name: 'Speed Up' },
            8:  { knives: 10, speed: 0.038, pattern: 'erratic',   apples: 2, reverseChance: 0.4,  bossMode: false, name: 'Erratic' },
            9:  { knives: 11, speed: 0.040, pattern: 'erratic',   apples: 3, reverseChance: 0.5,  bossMode: false, name: 'Triple Apple' },
            10: { knives: 12, speed: 0.045, pattern: 'erratic',   apples: 2, reverseChance: 0.5,  bossMode: true,  name: '👹 Boss 2' },
            11: { knives: 11, speed: 0.042, pattern: 'reverse',   apples: 3, reverseChance: 0.5,  bossMode: false, name: 'Fast Spin' },
            12: { knives: 12, speed: 0.046, pattern: 'crazy',     apples: 2, reverseChance: 0.6,  bossMode: false, name: 'Going Crazy' },
            13: { knives: 12, speed: 0.050, pattern: 'crazy',     apples: 3, reverseChance: 0.6,  bossMode: false, name: 'Nonstop' },
            14: { knives: 13, speed: 0.054, pattern: 'crazy',     apples: 3, reverseChance: 0.6,  bossMode: false, name: 'Intense' },
            15: { knives: 14, speed: 0.058, pattern: 'crazy',     apples: 4, reverseChance: 0.7,  bossMode: true,  name: '👹 Boss 3' },
            16: { knives: 12, speed: 0.052, pattern: 'erratic',   apples: 3, reverseChance: 0.65, bossMode: false, name: 'Storm' },
            17: { knives: 13, speed: 0.056, pattern: 'crazy',     apples: 3, reverseChance: 0.7,  bossMode: false, name: 'Vortex' },
            18: { knives: 13, speed: 0.060, pattern: 'crazy',     apples: 4, reverseChance: 0.7,  bossMode: false, name: 'Chaos' },
            19: { knives: 14, speed: 0.064, pattern: 'crazy',     apples: 4, reverseChance: 0.75, bossMode: false, name: 'Mayhem' },
            20: { knives: 15, speed: 0.070, pattern: 'crazy',     apples: 4, reverseChance: 0.8,  bossMode: true,  name: '👹 MEGA BOSS' },
            21: { knives: 13, speed: 0.065, pattern: 'crazy',     apples: 4, reverseChance: 0.75, bossMode: false, name: 'Legend' },
            22: { knives: 14, speed: 0.068, pattern: 'crazy',     apples: 4, reverseChance: 0.8,  bossMode: false, name: 'Mythic' },
            23: { knives: 14, speed: 0.072, pattern: 'crazy',     apples: 4, reverseChance: 0.8,  bossMode: false, name: 'Divine' },
            24: { knives: 15, speed: 0.076, pattern: 'crazy',     apples: 4, reverseChance: 0.85, bossMode: false, name: 'Immortal' },
            25: { knives: 16, speed: 0.080, pattern: 'crazy',     apples: 4, reverseChance: 0.9,  bossMode: true,  name: '👹 FINAL BOSS' }
        };

        if (configs[l]) return configs[l];

        // Endless past 25
        return {
            knives:        Math.min(8 + Math.floor(l / 3), 20),
            speed:         Math.min(0.015 + l * 0.004, 0.12),
            pattern:       'crazy',
            apples:        Math.min(Math.floor(l / 4), 4),
            reverseChance: Math.min(0.5 + l * 0.02, 0.95),
            bossMode:      l % 5 === 0,
            name:          `Endless ${l}`
        };
    }

    // ============================================================
    // TARGET CREATION
    // ============================================================

    createTarget() {
        return {
            x:            this.canvas.width  / 2,
            y:            this.canvas.height / 2 - 50,
            radius:       Math.min(this.canvas.width, this.canvas.height) * 0.155,
            angle:        0,
            speed:        0.015,
            baseSpeed:    0.015,
            direction:    1,
            pattern:      'constant',
            patternTimer: 0,
            wobbleY:      0,
            bossMode:     false,
            bossAngle:    0,
            rings:        4,
            config:       null
        };
    }

    // ============================================================
    // LEVEL SETUP
    // ============================================================

    setupLevel() {
        const cfg = this.getLevelConfig(this.level);
        this.levelCfg     = cfg;

        this.stuckKnives  = [];
        this.apples       = [];
        this.coins        = [];
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

        // Target config
        this.target.radius    = Math.min(this.canvas.width, this.canvas.height) * 0.155;
        this.target.angle     = 0;
        this.target.direction = 1;
        this.target.speed     = cfg.speed;
        this.target.baseSpeed = cfg.speed;
        this.target.pattern   = cfg.pattern;
        this.target.patternTimer = 0;
        this.target.bossMode  = cfg.bossMode;
        this.target.bossAngle = 0;
        this.target.wobbleY   = 0;
        this.target.config    = cfg;

        // Spawn apples
        this.spawnApples(cfg.apples);

        // Spawn orbit coins
        this.spawnOrbitCoins();

        // Level announce
        this.spawnFloat(
            this.canvas.width/2, this.canvas.height/2,
            `Level ${this.level} - ${cfg.name}`,
            cfg.bossMode ? '#FF006E' : '#00FF88', 22, 120
        );

        this.createIdleKnife();
    }

    createIdleKnife() {
        this.idleKnife = {
            x:      this.canvas.width / 2,
            y:      this.canvas.height - 90,
            wobble: 0,
            scale:  1,
            bounce: 0
        };
    }

    // ============================================================
    // APPLE SPAWN
    // ============================================================

    spawnApples(count) {
        this.apples = [];
        const used  = [];
        for (let i = 0; i < count; i++) {
            let angle, tries = 0;
            do {
                angle = Math.random() * Math.PI * 2;
                tries++;
            } while (used.some(a => Math.abs(a - angle) < 0.9) && tries < 60);
            used.push(angle);

            const isGolden = Math.random() < 0.25;
            const isDiamond = Math.random() < 0.1;
            this.apples.push({
                angle,
                hit: false,
                scale: 1,
                wobble: 0,
                type: isDiamond ? 'diamond' : isGolden ? 'golden' : 'red',
                collected: false
            });
        }
    }

    // ============================================================
    // ORBIT COINS
    // ============================================================

    spawnOrbitCoins() {
        this.coins = [];
        const count = Math.min(2 + Math.floor(this.level / 3), 5);
        for (let i = 0; i < count; i++) {
            this.coins.push({
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

    onThrow(e) {
        if (this.paused || this.gameOver) return;
        if (this.showDailyReward) { this.claimDailyReward(); return; }

        // Check power-up buttons
        if (e) {
            const rect = this.canvas.getBoundingClientRect();
            const sx = this.canvas.width / rect.width;
            const sy = this.canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * sx;
            const my = (e.clientY - rect.top)  * sy;
            if (this.handleUIClick(mx, my)) return;
        }

        if (this.stageComplete) return;
        if (this.flyingKnife) return;
        if (this.knivesLeft <= 0) return;
        this.throwKnife();
    }

    onTouchThrow(e) {
        e.preventDefault();
        if (this.showDailyReward) { this.claimDailyReward(); return; }

        const rect = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width  / rect.width;
        const sy = this.canvas.height / rect.height;
        const tx = (e.touches[0].clientX - rect.left) * sx;
        const ty = (e.touches[0].clientY - rect.top)  * sy;
        if (this.handleUIClick(tx, ty)) return;

        this.onThrow();
    }

    onKeyDown(e) {
        if (this.destroyed) return;
        if (e.code === 'Space') { e.preventDefault(); this.onThrow(); }
        if (e.key === '1') this.usePowerUp('extraKnife');
        if (e.key === '2') this.usePowerUp('slowTarget');
        if (e.key === '3') this.usePowerUp('shield');
        if (e.key === '4') this.usePowerUp('bomb');
    }

    handleUIClick(mx, my) {
        // Power-up bar at bottom
        const btnSize = 34;
        const startX  = 8;
        const btnY    = this.canvas.height - 45;
        let idx = 0;
        for (const key of Object.keys(this.powerUps)) {
            const bx = startX + idx * (btnSize + 5);
            if (mx >= bx && mx <= bx + btnSize && my >= btnY && my <= btnY + btnSize) {
                this.usePowerUp(key);
                return true;
            }
            idx++;
        }
        return false;
    }

    // ============================================================
    // POWER-UP USE
    // ============================================================

    usePowerUp(type) {
        const pup = this.powerUps[type];
        if (!pup || pup.count <= 0) return;
        if (this.gameOver || this.stageComplete) return;

        pup.count--;

        switch (type) {
            case 'extraKnife':
                this.knivesLeft  += 2;
                this.knivesTotal += 2;
                this.spawnFloat(this.canvas.width/2, this.canvas.height*0.35,
                    '🗡️ +2 Knives!', '#00FF88', 18, 90);
                break;

            case 'slowTarget':
                this.activeEffects.slow      = true;
                this.activeEffects.slowTimer = 5000;
                this.target.speed            = this.target.baseSpeed * 0.35;
                this.spawnFloat(this.canvas.width/2, this.canvas.height*0.35,
                    '🐢 Slow Motion!', '#00D4FF', 18, 90);
                break;

            case 'shield':
                this.activeEffects.shield = true;
                this.spawnFloat(this.canvas.width/2, this.canvas.height*0.35,
                    '🛡️ Shield ON!', '#b347d9', 18, 90);
                break;

            case 'bomb':
                this.bombClearKnives();
                break;
        }

        if (window.audioManager) audioManager.play('powerUp');
        this.savePlayerData();
    }

    bombClearKnives() {
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
        this.spawnFloat(this.canvas.width/2, this.canvas.height/2,
            `💣 BOOM! +${bonus}`, '#FF8C00', 20, 100);
        this.screenShake.timer = 12; this.screenShake.intensity = 8;
        if (window.audioManager) audioManager.play('levelUp');
    }

    // ============================================================
    // THROW KNIFE
    // ============================================================

    throwKnife() {
        this.knivesLeft--;
        this.knivesThrown++;
        this.playerData.totalKnivesThrown++;

        // Idle knife bounce animation
        if (this.idleKnife) this.idleKnife.bounce = 8;

        this.flyingKnife = {
            x:     this.canvas.width / 2,
            y:     this.canvas.height - 90,
            vy:    -18,
            vx:    0,
            angle: -Math.PI / 2,
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

        // Stage complete
        if (this.stageComplete) {
            this.stageCompleteTimer++;
            this.updateBreakPieces();
            this.updateParticles();
            this.updateFloatingTexts();
            if (this.stageCompleteTimer >= 90) {
                this.level++;
                this.stage++;
                this.playerData.currentLevel  = this.level;
                if (this.level > this.playerData.highestLevel) {
                    this.playerData.highestLevel = this.level;
                }
                this.savePlayerData();
                this.setupLevel();
            }
            return;
        }

        // Screen shake
        if (this.screenShake.timer > 0) {
            const t = this.screenShake.timer;
            const i = this.screenShake.intensity;
            this.screenShake.x = (Math.random()-0.5) * i * (t/15);
            this.screenShake.y = (Math.random()-0.5) * i * 0.5 * (t/15);
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashTimer > 0) this.flashTimer--;
        Object.keys(this.hudFlash).forEach(k => { if (this.hudFlash[k] > 0) this.hudFlash[k]--; });

        // Power-up timers
        if (this.activeEffects.slow) {
            this.activeEffects.slowTimer -= dt;
            if (this.activeEffects.slowTimer <= 0) {
                this.activeEffects.slow  = false;
                this.target.speed        = this.target.baseSpeed;
                this.spawnFloat(this.canvas.width/2, this.canvas.height*0.35, '🐢 Ended', '#888', 14, 60);
            }
        }

        // Target rotation
        this.updateTargetRotation(dt);

        // Boss wobble (up/down)
        if (this.target.bossMode) {
            this.target.bossAngle += 0.04;
            this.target.wobbleY   = Math.sin(this.target.bossAngle) * 22;
        } else {
            this.target.wobbleY = 0;
        }

        // Flying knife
        if (this.flyingKnife) {
            this.updateFlyingKnife();
        }

        // Idle knife wobble
        if (this.idleKnife) {
            this.idleKnife.wobble = Math.sin(Date.now() / 600) * 4;
            if (this.idleKnife.bounce > 0) this.idleKnife.bounce--;
        }

        // Orbit coins
        this.updateOrbitCoins(dt);

        // Apple wobble
        this.apples.forEach(a => {
            if (!a.hit) a.wobble = Math.sin(Date.now()/300 + a.angle) * 0.04;
            else        a.scale  = Math.max(0, a.scale - 0.07);
        });

        // Particles & FX
        this.updateParticles();
        this.updateExplosions();
        this.updateScorePopups();
        this.updateFloatingTexts();
        this.updateBgParticles();
        this.updateCoinPickups();
    }

    updateTargetRotation(dt) {
        const t   = this.target;
        t.patternTimer += dt || 16;

        const slow = this.activeEffects.slow ? 0.35 : 1;

        switch (t.pattern) {
            case 'constant':
                t.angle += t.speed * t.direction * slow;
                break;

            case 'wobble':
                t.angle += t.speed * t.direction * slow;
                if (t.patternTimer > 1800) {
                    t.direction   *= -1;
                    t.patternTimer = 0;
                }
                break;

            case 'reverse':
                t.speed = t.baseSpeed * (1 + 0.5 * Math.abs(Math.sin(t.patternTimer / 900)));
                t.angle += t.speed * t.direction * slow;
                if (t.patternTimer > 1200 + Math.random() * 600) {
                    t.direction   *= -1;
                    t.patternTimer = 0;
                }
                break;

            case 'erratic':
                t.speed = t.baseSpeed * (1 + 0.8 * Math.abs(Math.sin(t.patternTimer / 600)));
                t.angle += t.speed * t.direction * slow;
                if (t.patternTimer > 700 + Math.random() * 1000) {
                    t.direction   *= -1;
                    t.patternTimer = 0;
                    this.screenShake.timer = 2; this.screenShake.intensity = 3;
                }
                break;

            case 'crazy':
                t.speed = t.baseSpeed * (1 + Math.abs(Math.sin(t.patternTimer / 400)));
                t.angle += t.speed * t.direction * slow;
                if (Math.random() < 0.006) {
                    t.direction   *= -1;
                    t.patternTimer = 0;
                    this.screenShake.timer = 3; this.screenShake.intensity = 4;
                }
                // Random spike
                if (Math.random() < 0.002) {
                    t.angle += t.direction * 0.3 * slow;
                }
                break;
        }
    }

    updateFlyingKnife() {
        const k = this.flyingKnife;
        k.trail.push({ x: k.x, y: k.y });
        if (k.trail.length > 14) k.trail.shift();

        k.x += k.vx;
        k.y += k.vy;
        k.angle = Math.atan2(k.vy, k.vx) - Math.PI / 2;

        const ty = this.target.y + this.target.wobbleY;
        const dx = k.x - this.target.x;
        const dy = k.y - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.target.radius + 10) {
            this.onKnifeHit(dx, dy, dist);
            return;
        }

        // Out of bounds
        if (k.y < -80 || k.y > this.canvas.height + 80) {
            this.flyingKnife = null;
        }
    }

    updateOrbitCoins(dt) {
        this.coins.forEach(c => {
            c.angle  += 0.018;
            c.wobble += 0.05;

            if (c.collected) return;

            const angle = this.target.angle + c.angle;
            const cx = this.target.x + Math.cos(angle) * c.orbitR;
            const cy = this.target.y + this.target.wobbleY + Math.sin(angle) * c.orbitR;

            // Check if flying knife collected it
            if (this.flyingKnife) {
                const dx = this.flyingKnife.x - cx;
                const dy = this.flyingKnife.y - cy;
                if (Math.sqrt(dx*dx + dy*dy) < 20) {
                    c.collected = true;
                    this.earnCoins(1 + Math.floor(this.level/5), cx, cy);
                    this.spawnParticles(cx, cy, '#FFD700', 6);
                }
            }
        });
    }

    updateParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += (p.gravity || 0.12); p.vx *= 0.98;
            p.life -= p.decay; p.size *= 0.97;
            return p.life > 0 && p.size > 0.3;
        });
    }

    updateExplosions() {
        this.explosions = this.explosions.filter(e => {
            e.radius  += 3.5;
            e.opacity -= 0.055;
            return e.opacity > 0;
        });
    }

    updateScorePopups() {
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= 2; p.opacity = p.life / 60;
            return p.life > 0;
        });
    }

    updateFloatingTexts() {
        this.floatingTexts = this.floatingTexts.filter(t => {
            t.y -= 0.6; t.life -= 1; t.opacity = Math.min(1, t.life / 40);
            return t.life > 0;
        });
    }

    updateCoinPickups() {
        this.coinPickups = this.coinPickups.filter(p => {
            p.y += p.vy; p.life -= 2; p.opacity = Math.min(1, p.life / 40);
            return p.life > 0;
        });
    }

    updateBgParticles() {
        this.bgParticles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = this.canvas.width;
            if (p.x > this.canvas.width)  p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
        });
    }

    updateBreakPieces() {
        this.breakPieces = this.breakPieces.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.28; p.rotation += p.rotSpeed;
            p.vx *= 0.99; p.life--;
            return p.life > 0;
        });
    }

    // ============================================================
    // KNIFE HIT TARGET
    // ============================================================

    onKnifeHit(dx, dy, dist) {
        const k       = this.flyingKnife;
        const relAngle = Math.atan2(dy, dx) - this.target.angle;

        // Check collision with stuck knives
        let hitStuck = false;
        for (const sk of this.stuckKnives) {
            let diff = Math.abs(relAngle - sk.angle) % (Math.PI * 2);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 0.20) { hitStuck = true; break; }
        }

        if (hitStuck) {
            if (this.activeEffects.shield) {
                // Shield absorbs collision
                this.activeEffects.shield = false;
                this.flashTimer = 8; this.flashColor = '#b347d9';
                this.screenShake.timer = 6; this.screenShake.intensity = 4;
                this.spawnFloat(this.canvas.width/2, this.target.y - 40, '🛡️ Blocked!', '#b347d9', 18, 80);
                this.flyingKnife = null;
                this.combo = 0;
                if (this.knivesLeft > 0) this.createIdleKnife();
                return;
            }
            this.onCollision();
            return;
        }

        // Check apple hit
        let hitApple = false;
        for (let i = 0; i < this.apples.length; i++) {
            const a = this.apples[i];
            if (a.hit) continue;
            let diff = Math.abs(relAngle - a.angle) % (Math.PI * 2);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 0.38) {
                this.hitApple(i, a);
                hitApple = true;
                break;
            }
        }

        // Stick knife
        this.stuckKnives.push({ angle: relAngle, skin: k.skin });

        // Score calculation
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const comboBonus = Math.min(this.combo, 8);
        const scoreGain  = 10 * comboBonus + (this.level * 2);
        this.score      += scoreGain;
        this.onScore(this.score);

        // Coins per throw
        const coinEarn = 1 + Math.floor(this.combo / 3) + Math.floor(this.level / 5);
        this.earnCoins(coinEarn, k.x, k.y - 20);

        // Diamond on big combos
        if (this.combo > 0 && this.combo % 5 === 0) {
            this.earnDiamonds(1, k.x, k.y - 40);
        }

        // Milestone
        this.checkMilestones();

        this.scorePopups.push({
            x: k.x + (Math.random()-0.5)*40, y: k.y - 25,
            text: this.combo > 1 ? `x${comboBonus} +${scoreGain}` : `+${scoreGain}`,
            color: this.combo > 3 ? '#FFD700' : this.combo > 1 ? '#00FF88' : '#fff',
            life: 65, opacity: 1
        });

        // Hit FX
        const ty = this.target.y + this.target.wobbleY;
        const ex = this.target.x + Math.cos(this.target.angle + relAngle) * this.target.radius;
        const ey = ty + Math.sin(this.target.angle + relAngle) * this.target.radius;

        this.spawnParticles(ex, ey, this.getSkinColor(), 8);
        this.spawnParticles(ex, ey, '#fff', 4);

        if (this.combo > 1) {
            this.flashTimer = 4; this.flashColor = '#00FF88';
        }

        if (window.audioManager) audioManager.play('hit');
        this.screenShake.timer = 3; this.screenShake.intensity = 3;

        this.flyingKnife = null;

        // All knives thrown?
        if (this.knivesLeft === 0) {
            // Check all apples hit?
            const allApples = this.apples.every(a => a.hit);
            setTimeout(() => this.completeStage(allApples), 350);
        }
    }

    onCollision() {
        this.lives--;
        this.combo = 0;
        this.screenShake.timer = 22; this.screenShake.intensity = 12;
        this.flashTimer = 18; this.flashColor = '#ff0055';

        const k = this.flyingKnife;
        this.explosions.push({ x: k.x, y: k.y, radius: 5, opacity: 1, color: '#ff0055' });
        this.spawnParticles(k.x, k.y, '#ff0055', 22);
        this.spawnParticles(k.x, k.y, '#FFD700', 10);

        this.spawnFloat(this.canvas.width/2, this.canvas.height/2 - 20,
            `💥 COLLISION! Lives: ${this.lives}`, '#FF0055', 18, 100);

        if (window.audioManager) audioManager.play('fail');

        this.flyingKnife = null;

        if (this.lives <= 0) {
            this.gameOver = true;
            this.playerData.totalCoinsEarned    += this.sessionCoins;
            this.playerData.totalDiamondsEarned += this.sessionDias;
            this.playerData.gamesPlayed++;
            if (this.score > this.playerData.bestScore) {
                this.playerData.bestScore = this.score;
            }
            this.savePlayerData();
            setTimeout(() => this.onScore(this.score, true, {
                level: this.level, coins: this.sessionCoins,
                diamonds: this.sessionDias
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
            diamond: { score: 80,  coins: 15, dias: 3,  color: '#00D4FF', text: '💎 DIAMOND!' },
            golden:  { score: 50,  coins: 10, dias: 1,  color: '#FFD700', text: '🍎 GOLDEN!' },
            red:     { score: 25,  coins: 4,  dias: 0,  color: '#FF4444', text: '🍎 APPLE!' }
        };
        const r = rewards[apple.type];

        this.score += r.score;
        this.onScore(this.score);
        this.earnCoins(r.coins, pos.x, pos.y);
        if (r.dias > 0) this.earnDiamonds(r.dias, pos.x, pos.y - 20);

        this.spawnAppleParticles(pos.x, pos.y, apple.type);
        this.explosions.push({ x: pos.x, y: pos.y, radius: 5, opacity: 0.9, color: r.color });

        this.scorePopups.push({
            x: pos.x, y: pos.y - 30,
            text: r.text + ` +${r.score}`,
            color: r.color, life: 90, opacity: 1
        });

        this.flashTimer = 10; this.flashColor = r.color;
        this.screenShake.timer = 7; this.screenShake.intensity = 5;
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
        const perfectBonus = allApples ? 100 : 0;
        const totalBonus   = levelBonus + comboBonus + perfectBonus;

        this.score += totalBonus;
        this.onScore(this.score);

        // Rewards
        const coins = 30 + this.level * 8 + this.maxCombo * 3;
        const dias  = (this.levelCfg?.bossMode ? 5 : 1) + (allApples ? 2 : 0);
        this.earnCoins(coins, this.canvas.width/2, this.canvas.height/2 - 50);
        this.earnDiamonds(dias, this.canvas.width/2, this.canvas.height/2 - 20);

        // Save star rating
        const shots = this.knivesThrown;
        const stars = shots <= this.knivesTotal * 0.7 ? 3 :
                      shots <= this.knivesTotal * 0.9 ? 2 : 1;
        if (!this.playerData.levelStars[this.level] ||
             stars > this.playerData.levelStars[this.level]) {
            this.playerData.levelStars[this.level] = stars;
        }

        this.spawnBreakPieces();
        this.screenShake.timer = 18; this.screenShake.intensity = 10;
        this.flashTimer = 25; this.flashColor = '#00FF88';

        this.spawnFloat(
            this.canvas.width/2, this.canvas.height/2 - 30,
            allApples ? '🏆 PERFECT CLEAR!' : '🎉 STAGE CLEAR!',
            '#00FF88', 26, 140
        );
        this.spawnFloat(this.canvas.width/2, this.canvas.height/2 + 20,
            `+${totalBonus} pts  🪙${coins}  💎${dias}`, '#FFD700', 16, 130);

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
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                w: Math.random() * 22 + 10,
                h: Math.random() * 22 + 10,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random()-0.5) * 0.22,
                life: 70,
                color: this.target.bossMode ? '#aa2200' : '#8B4513'
            });
        }
        // Stuck knives also fly off
        this.stuckKnives.forEach(sk => {
            const angle = this.target.angle + sk.angle;
            this.breakPieces.push({
                x: tx + Math.cos(angle) * this.target.radius,
                y: ty + Math.sin(angle) * this.target.radius,
                vx: Math.cos(angle) * (Math.random()*4+2),
                vy: Math.sin(angle) * (Math.random()*4+2) - 2,
                w: 4, h: 35, rotation: angle,
                rotSpeed: (Math.random()-0.5)*0.2,
                life: 55, color: '#ccc'
            });
        });
    }

    // ============================================================
    // COINS / DIAMONDS
    // ============================================================

    earnCoins(amount, x, y) {
        this.playerData.coins            += amount;
        this.playerData.totalCoinsEarned += amount;
        this.sessionCoins                += amount;
        this.hudFlash.coins               = 18;

        this.coinPickups.push({
            x, y, text: `+${amount}🪙`,
            color: '#FFD700', life: 75, opacity: 1, vy: -1.2
        });
    }

    earnDiamonds(amount, x, y) {
        this.playerData.diamonds            += amount;
        this.playerData.totalDiamondsEarned += amount;
        this.sessionDias                    += amount;
        this.hudFlash.diamonds               = 18;

        this.coinPickups.push({
            x, y, text: `+${amount}💎`,
            color: '#00D4FF', life: 90, opacity: 1, vy: -1.0
        });
        if (window.audioManager) audioManager.play('achievement');
    }

    checkMilestones() {
        for (const m of this.milestones) {
            if (this.score >= m * 10 && !this.milestonesClaimed.has(m)) {
                this.milestonesClaimed.add(m);
                this.earnDiamonds(1, this.canvas.width/2, this.canvas.height*0.3);
                this.spawnFloat(
                    this.canvas.width/2, this.canvas.height*0.28,
                    `🏆 ${m*10} pts! +1💎`, '#00D4FF', 16, 110
                );
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

    getSkinColor() {
        const skin = this.knifeSkins[this.currentSkin];
        return skin?.blade[1] || '#ddd';
    }

    spawnFloat(x, y, text, color, size = 16, life = 80) {
        this.floatingTexts.push({ x, y, text, color, size, life, opacity: 1 });
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
                color, size: Math.random() * 5 + 2,
                life: 1, decay: Math.random()*0.04+0.02, gravity: 0.14
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
        for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            this.particles.push({
                x, y,
                vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed - 3,
                color: cols[Math.floor(Math.random()*cols.length)],
                size: Math.random()*6+2, life: 1, decay: 0.022, gravity: 0.18
            });
        }
    }

    createBgParticles() {
        return Array.from({ length: 45 }, () => ({
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random()-0.5) * 0.25,
            vy: (Math.random()-0.5) * 0.25,
            size: Math.random() * 1.8 + 0.4,
            color: ['#b347d9','#00d4ff','#ff006e','#00ff88'][Math.floor(Math.random()*4)],
            alpha: Math.random() * 0.35 + 0.08
        }));
    }

    // ============================================================
    // DRAW
    // ============================================================

    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);

        this.drawBackground();

        // Flash overlay
        if (this.flashTimer > 0) {
            const a = (this.flashTimer / 18) * 0.28;
            ctx.fillStyle = this.hexToRgba(this.flashColor, a);
            ctx.fillRect(-10, -10, this.canvas.width+20, this.canvas.height+20);
        }

        if (this.stageComplete) {
            this.drawStageComplete();
        } else {
            this.drawOrbitCoins();
            this.drawTarget();
            this.drawExplosions();
            this.drawParticles();
            if (this.flyingKnife) this.drawFlyingKnife();
            else                   this.drawIdleKnife();
            this.drawScorePopups();
            this.drawCoinPickups();
            this.drawFloatingTexts();
        }

        this.drawHUD();
        this.drawPowerUpBar();

        ctx.restore();

        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyReward();
        if (this.gameOver) this.drawGameOver();
    }

    // ============================================================
    // DRAW: BACKGROUND
    // ============================================================

    drawBackground() {
        const ctx = this.ctx;
        const W   = this.canvas.width;
        const H   = this.canvas.height;

        const bg = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H/2, H);
        bg.addColorStop(0, this.target.bossMode ? '#1a0408' : '#120828');
        bg.addColorStop(0.5, this.target.bossMode ? '#0d0208' : '#080518');
        bg.addColorStop(1, '#040210');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // BG particles
        this.bgParticles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Platform glow
        const pg = ctx.createRadialGradient(W/2, H-90, 10, W/2, H-90, 90);
        pg.addColorStop(0, 'rgba(179,71,217,0.18)');
        pg.addColorStop(1, 'transparent');
        ctx.fillStyle = pg;
        ctx.fillRect(0, H-180, W, 180);

        // Vignette
        const vg = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H*0.85);
        vg.addColorStop(0, 'transparent');
        vg.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    // ============================================================
    // DRAW: TARGET (LOG)
    // ============================================================

    drawTarget() {
        const ctx = this.ctx;
        const t   = this.target;
        const ty  = t.y + t.wobbleY;

        ctx.save();
        ctx.translate(t.x, ty);

        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(8, t.radius + 18, t.radius * 0.75, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Outer glow
        const glowColor = t.bossMode
            ? `rgba(255,0,50,${0.3 + Math.abs(Math.sin(Date.now()/250))*0.35})`
            : 'rgba(255,140,60,0.18)';
        ctx.shadowBlur  = t.bossMode ? 35 : 20;
        ctx.shadowColor = t.bossMode ? '#ff0050' : '#ff8c00';
        ctx.beginPath();
        ctx.arc(0, 0, t.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth   = 6;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        ctx.rotate(t.angle);

        // Log body gradient
        const lg = ctx.createRadialGradient(-t.radius*0.25, -t.radius*0.25, t.radius*0.08, 0, 0, t.radius);
        if (t.bossMode) {
            lg.addColorStop(0, '#b03500');
            lg.addColorStop(0.35, '#881000');
            lg.addColorStop(0.7,  '#6a0800');
            lg.addColorStop(1,    '#3a0000');
        } else {
            lg.addColorStop(0, '#d08030');
            lg.addColorStop(0.35, '#a86020');
            lg.addColorStop(0.7,  '#7a4015');
            lg.addColorStop(1,    '#5a2d0a');
        }
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = lg;
        ctx.fill();

        // Clip for interior details
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.clip();

        // Wood grain lines
        ctx.globalAlpha = 0.07;
        for (let i = -t.radius; i < t.radius; i += 9) {
            ctx.beginPath();
            ctx.moveTo(i, -t.radius);
            ctx.bezierCurveTo(i+4, -t.radius/2, i-4, 0, i+2, t.radius);
            ctx.strokeStyle = t.bossMode ? '#ff4400' : '#c8a060';
            ctx.lineWidth   = 2;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Ring marks (growth rings)
        const ringAlphas = t.bossMode
            ? [0.18, 0.13, 0.10, 0.07]
            : [0.14, 0.10, 0.07, 0.05];
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, t.radius * (i / 4.8), 0, Math.PI * 2);
            ctx.strokeStyle = t.bossMode
                ? `rgba(255,80,0,${ringAlphas[i-1]})`
                : `rgba(255,200,140,${ringAlphas[i-1]})`;
            ctx.lineWidth = i === 1 ? 2.5 : 1.5;
            ctx.stroke();
        }

        ctx.restore();

        // Center bullseye
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, t.radius*0.14);
        cg.addColorStop(0, t.bossMode ? '#ff6600' : '#f0b060');
        cg.addColorStop(1, t.bossMode ? '#cc2200' : '#b07030');
        ctx.beginPath();
        ctx.arc(0, 0, t.radius * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.shadowBlur  = t.bossMode ? 12 : 5;
        ctx.shadowColor = t.bossMode ? '#ff4400' : '#ff8c00';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Stuck knives (rotate with target)
        this.stuckKnives.forEach(sk => {
            ctx.save();
            ctx.rotate(sk.angle);
            this.drawKnifeShape(ctx, t.radius - 6, 0, sk.skin || this.currentSkin, 0.92);
            ctx.restore();
        });

        // Apples
        this.apples.forEach(a => {
            if (a.hit && a.scale <= 0) return;
            ctx.save();
            ctx.rotate(a.angle);
            ctx.translate(t.radius, 0);
            ctx.rotate(-a.angle - t.angle + a.wobble);
            ctx.scale(a.scale, a.scale);
            this.drawApple(ctx, 0, 0, a.type);
            ctx.restore();
        });

        ctx.restore();

        // Boss label
        if (t.bossMode) {
            const pulse = 0.7 + Math.sin(Date.now()/180) * 0.3;
            ctx.fillStyle   = `rgba(255,0,55,${pulse})`;
            ctx.font        = 'bold 12px Orbitron';
            ctx.textAlign   = 'center';
            ctx.shadowBlur  = 10;
            ctx.shadowColor = '#ff0055';
            ctx.fillText('👹 BOSS', t.x, ty - t.radius - 14);
            ctx.shadowBlur = 0;
            ctx.textAlign  = 'left';
        }
    }

    // ============================================================
    // DRAW: KNIFE SHAPE (Premium look)
    // ============================================================

    drawKnifeShape(ctx, x, y, skinName = 'default', scale = 1) {
        const skin = this.knifeSkins[skinName] || this.knifeSkins.default;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // Blade glow
        ctx.shadowBlur  = 8;
        ctx.shadowColor = skin.blade[1];

        // Blade
        const bg = ctx.createLinearGradient(-3, -36, 3, 0);
        bg.addColorStop(0, skin.blade[2]);
        bg.addColorStop(0.4, skin.blade[1]);
        bg.addColorStop(1, skin.blade[0]);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-3.5, -10);
        ctx.lineTo(-2,   -34);
        ctx.lineTo(0,    -38);
        ctx.lineTo(2,    -34);
        ctx.lineTo(3.5,  -10);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Blade center shine
        ctx.fillStyle = `rgba(255,255,255,0.45)`;
        ctx.beginPath();
        ctx.moveTo(0.5,  -6);
        ctx.lineTo(-0.3, -30);
        ctx.lineTo(1.8,  -30);
        ctx.lineTo(1.8,  -6);
        ctx.closePath();
        ctx.fill();

        // Blade edge bevel
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.moveTo(-3.5, -10);
        ctx.lineTo(-2, -34);
        ctx.lineTo(0, -38);
        ctx.stroke();

        // Guard
        ctx.fillStyle = skin.guard;
        ctx.fillRect(-7, -5, 14, 6);

        const guardGrad = ctx.createLinearGradient(0, -5, 0, 1);
        guardGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
        guardGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = guardGrad;
        ctx.fillRect(-7, -5, 14, 6);

        // Handle
        const hg = ctx.createLinearGradient(-5.5, 0, 5.5, 0);
        hg.addColorStop(0,   skin.handle[0]);
        hg.addColorStop(0.5, skin.handle[1]);
        hg.addColorStop(1,   skin.handle[2]);
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.roundRect?.(-5.5, 1, 11, 24, 3) || ctx.rect(-5.5, 1, 11, 24);
        ctx.fill();

        // Handle grip lines
        ctx.strokeStyle = 'rgba(255,200,100,0.35)';
        ctx.lineWidth   = 1;
        for (let i = 5; i < 22; i += 4.5) {
            ctx.beginPath();
            ctx.moveTo(-5, i);
            ctx.lineTo(5, i);
            ctx.stroke();
        }

        // Handle end cap
        ctx.fillStyle = skin.handle[0];
        ctx.beginPath();
        ctx.ellipse(0, 25, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Blade tip flash
        ctx.shadowBlur  = 4;
        ctx.shadowColor = '#fff';
        ctx.fillStyle   = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(0, -34, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

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
        ctx.translate(x, y);

        ctx.shadowBlur  = 14;
        ctx.shadowColor = s.glow;

        // Body
        const ag = ctx.createRadialGradient(-3, -3, 1, 0, 1, 11);
        ag.addColorStop(0, s.shine);
        ag.addColorStop(0.5, s.body);
        ag.addColorStop(1, this.darkenHex(s.body, 30));
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.ellipse(0, 2, 9, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Shine
        ctx.fillStyle = s.shine;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.ellipse(-3, -2, 3, 4, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Stem
        ctx.strokeStyle = s.stem;
        ctx.lineWidth   = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.quadraticCurveTo(5, -14, 2, -17);
        ctx.stroke();

        // Leaf
        ctx.fillStyle = s.leaf;
        ctx.beginPath();
        ctx.ellipse(3.5, -13, 5.5, 3, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Leaf vein
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.moveTo(1, -13);
        ctx.lineTo(6, -13);
        ctx.stroke();

        // Diamond sparkle
        if (type === 'diamond') {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            const sparkles = [[0,-4],[6,2],[-5,4]];
            sparkles.forEach(([sx,sy]) => {
                ctx.beginPath();
                ctx.arc(sx, sy, 1.5, 0, Math.PI*2);
                ctx.fill();
            });
        }

        ctx.restore();
    }

    // ============================================================
    // DRAW: FLYING KNIFE
    // ============================================================

    drawFlyingKnife() {
        const ctx = this.ctx;
        const k   = this.flyingKnife;

        // Motion trail
        k.trail.forEach((t, i) => {
            const ratio = i / k.trail.length;
            ctx.globalAlpha = ratio * 0.3;
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(k.angle);
            ctx.scale(1, ratio * 0.65);
            this.drawKnifeShape(ctx, 0, 0, k.skin, 0.75);
            ctx.restore();
        });
        ctx.globalAlpha = 1;

        // Knife
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.rotate(k.angle);
        this.drawKnifeShape(ctx, 0, 0, k.skin, 1);
        ctx.restore();
    }

    // ============================================================
    // DRAW: IDLE KNIFE (at shooter)
    // ============================================================

    drawIdleKnife() {
        if (!this.idleKnife || this.knivesLeft <= 0) return;
        const ctx = this.ctx;
        const k   = this.idleKnife;
        const bY  = k.bounce > 0 ? k.bounce * -1.5 : k.wobble;

        ctx.save();
        ctx.translate(k.x, k.y + bY);
        ctx.rotate(-Math.PI / 2);
        this.drawKnifeShape(ctx, 0, 0, this.currentSkin, 1);
        ctx.restore();

        // Platform glow
        const pg = ctx.createRadialGradient(k.x, k.y + 32, 5, k.x, k.y + 32, 55);
        pg.addColorStop(0, 'rgba(179,71,217,0.22)');
        pg.addColorStop(1, 'transparent');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(k.x, k.y + 32, 55, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Knives remaining dots
        const total = this.knivesTotal;
        const left  = this.knivesLeft;
        const dotW  = total * 14;
        const startX = k.x - dotW / 2;

        for (let i = 0; i < total; i++) {
            const dx = startX + i * 14;
            const dy = k.y + 52;
            ctx.save();
            if (i < left) {
                ctx.shadowBlur  = 6;
                ctx.shadowColor = '#b347d9';
                ctx.fillStyle   = '#b347d9';
            } else {
                ctx.fillStyle = 'rgba(120,120,120,0.3)';
            }
            // Mini knife shape
            ctx.beginPath();
            ctx.fillRect(dx - 1.5, dy - 8, 3, 16);
            ctx.restore();
        }

        // "TAP TO THROW" hint
        if (this.knivesThrown === 0) {
            const pulse = 0.5 + Math.sin(Date.now()/400) * 0.5;
            ctx.fillStyle = `rgba(255,255,255,${pulse * 0.7})`;
            ctx.font      = '12px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillText('TAP TO THROW', k.x, k.y + 72);
            ctx.textAlign = 'left';
        }
    }

    // ============================================================
    // DRAW: ORBIT COINS
    // ============================================================

    drawOrbitCoins() {
        const ctx = this.ctx;
        const t   = this.target;

        this.coins.forEach(c => {
            if (c.collected) return;
            const angle = t.angle + c.angle;
            const cx    = t.x + Math.cos(angle) * c.orbitR;
            const cy    = t.y + t.wobbleY + Math.sin(angle) * c.orbitR;
            const pulse = 0.85 + Math.sin(c.wobble) * 0.15;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(pulse, pulse);

            ctx.shadowBlur  = 10;
            ctx.shadowColor = '#FFD700';
            ctx.fillStyle   = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#FFF8C0';
            ctx.beginPath();
            ctx.arc(-2, -2, 2.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.font      = 'bold 8px Arial';
            ctx.fillStyle = '#AA7700';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 1);
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'alphabetic';

            ctx.restore();
        });
    }

    // ============================================================
    // DRAW: PARTICLES & FX
    // ============================================================

    drawExplosions() {
        const ctx = this.ctx;
        this.explosions.forEach(e => {
            ctx.globalAlpha = e.opacity;
            ctx.shadowBlur  = 15;
            ctx.shadowColor = e.color;
            ctx.strokeStyle = e.color;
            ctx.lineWidth   = 3;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = e.opacity * 0.25;
            ctx.fillStyle   = e.color;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
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

    drawScorePopups() {
        const ctx = this.ctx;
        this.scorePopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font        = `bold 14px Orbitron`;
            ctx.textAlign   = 'center';
            ctx.fillStyle   = p.color;
            ctx.shadowBlur  = 7;
            ctx.shadowColor = p.color;
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'left';
    }

    drawCoinPickups() {
        const ctx = this.ctx;
        this.coinPickups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font        = `bold 12px Orbitron`;
            ctx.textAlign   = 'center';
            ctx.fillStyle   = p.color;
            ctx.fillText(p.text, p.x, p.y);
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
            ctx.shadowBlur  = 10;
            ctx.shadowColor = t.color;
            ctx.fillText(t.text, t.x, t.y);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'left';
    }

    // ============================================================
    // DRAW: STAGE COMPLETE
    // ============================================================

    drawStageComplete() {
        this.drawBackground();

        const ctx  = this.ctx;
        const prog = Math.min(1, this.stageCompleteTimer / 90);

        // Break pieces
        this.breakPieces.forEach(p => {
            ctx.globalAlpha = p.life / 70;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            if (p.h > 25) { // Knife piece
                ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
            } else {
                ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
            }
            ctx.restore();
        });
        ctx.globalAlpha = 1;

        this.drawParticles();
        this.drawFloatingTexts();
        this.drawCoinPickups();
    }

    // ============================================================
    // DRAW: HUD
    // ============================================================

    drawHUD() {
        const ctx = this.ctx;
        const W   = this.canvas.width;

        // Top bar bg
        ctx.fillStyle = 'rgba(0,0,0,0.52)';
        ctx.fillRect(0, 0, W, 36);

        // Level
        ctx.fillStyle   = '#b347d9';
        ctx.font        = 'bold 12px Orbitron';
        ctx.shadowBlur  = 8;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`LV.${this.level}`, 10, 22);
        ctx.shadowBlur = 0;

        // Level name
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font      = '9px Rajdhani';
        ctx.fillText(this.levelCfg?.name || '', 10, 32);

        // Stage center
        ctx.fillStyle = '#00D4FF';
        ctx.font      = '11px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(`STAGE ${this.stage}`, W/2, 20);

        // Pattern
        const patNames = {
            constant: '▶ STEADY',
            wobble:   '↔ WOBBLE',
            reverse:  '↩ REVERSE',
            erratic:  '⚡ ERRATIC',
            crazy:    '🌀 CRAZY'
        };
        ctx.fillStyle = 'rgba(255,200,0,0.55)';
        ctx.font      = '9px Orbitron';
        ctx.fillText(patNames[this.target.pattern] || '', W/2, 32);

        // Coins + Diamonds (top right)
        const cA = this.hudFlash.coins    > 0 ? 1 : 0.75;
        const dA = this.hudFlash.diamonds > 0 ? 1 : 0.75;

        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath();
        ctx.roundRect?.(W-92, 4, 84, 30, 6) || ctx.rect(W-92, 4, 84, 30);
        ctx.fill();

        ctx.font      = `bold ${this.hudFlash.coins > 0 ? 11 : 10}px Orbitron`;
        ctx.fillStyle = `rgba(255,215,0,${cA})`;
        ctx.textAlign = 'right';
        ctx.fillText(`🪙 ${this.playerData.coins}`, W-8, 18);

        ctx.font      = `bold ${this.hudFlash.diamonds > 0 ? 11 : 10}px Orbitron`;
        ctx.fillStyle = `rgba(0,212,255,${dA})`;
        ctx.fillText(`💎 ${this.playerData.diamonds}`, W-8, 32);
        ctx.textAlign = 'left';

        // Lives
        for (let i = 0; i < this.maxLives; i++) {
            const alive = i < this.lives;
            ctx.font      = '18px serif';
            ctx.fillStyle = alive ? '#ff0055' : 'rgba(255,255,255,0.12)';
            ctx.shadowBlur  = alive ? 8 : 0;
            ctx.shadowColor = '#ff0055';
            ctx.textAlign   = 'right';
            ctx.fillText('❤', W - 100 - i * 22, 22);
        }
        ctx.shadowBlur = 0;
        ctx.textAlign  = 'left';

        // Slow down timer bar
        if (this.activeEffects.slow) {
            const pct = this.activeEffects.slowTimer / 5000;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(8, 38, 80, 6);
            ctx.fillStyle = '#00D4FF';
            ctx.fillRect(8, 38, 80 * pct, 6);
            ctx.fillStyle = '#fff';
            ctx.font      = '8px Orbitron';
            ctx.fillText('🐢 SLOW', 10, 50);
        }

        // Shield indicator
        if (this.activeEffects.shield) {
            ctx.fillStyle   = '#b347d9';
            ctx.font        = '11px Orbitron';
            ctx.textAlign   = 'center';
            ctx.shadowBlur  = 8;
            ctx.shadowColor = '#b347d9';
            ctx.fillText('🛡️ SHIELD', W/2, 50);
            ctx.shadowBlur = 0;
            ctx.textAlign  = 'left';
        }

        // Combo indicator
        if (this.combo > 1) {
            const ca = 0.7 + Math.sin(Date.now()/120) * 0.3;
            ctx.fillStyle   = `rgba(255,215,0,${ca})`;
            ctx.font        = 'bold 14px Orbitron';
            ctx.textAlign   = 'center';
            ctx.shadowBlur  = 10;
            ctx.shadowColor = '#FFD700';
            ctx.fillText(`x${this.combo} COMBO`, W/2, this.canvas.height - 18);
            ctx.shadowBlur = 0;
            ctx.textAlign  = 'left';
        }

        // Boss mode pulsing label
        if (this.target.bossMode && !this.stageComplete) {
            const ba = 0.7 + Math.sin(Date.now()/200) * 0.3;
            ctx.fillStyle   = `rgba(255,0,55,${ba})`;
            ctx.font        = 'bold 13px Orbitron';
            ctx.textAlign   = 'center';
            ctx.shadowBlur  = 12;
            ctx.shadowColor = '#ff0055';
            ctx.fillText('👹 BOSS STAGE!', W/2, 56);
            ctx.shadowBlur = 0;
            ctx.textAlign  = 'left';
        }
    }

    // ============================================================
    // DRAW: POWER-UP BAR
    // ============================================================

    drawPowerUpBar() {
        const ctx     = this.ctx;
        const btnSize = 34;
        const startX  = 8;
        const btnY    = this.canvas.height - 44;
        let idx = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx    = startX + idx * (btnSize + 5);
            const canUse = pup.count > 0;

            ctx.fillStyle   = canUse ? `${pup.color}22` : 'rgba(30,30,30,0.35)';
            ctx.strokeStyle = canUse ? `${pup.color}88` : 'rgba(80,80,80,0.3)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.roundRect?.(bx, btnY, btnSize, btnSize, 6) || ctx.rect(bx, btnY, btnSize, btnSize);
            ctx.fill();
            ctx.stroke();

            ctx.font          = '14px Arial';
            ctx.textAlign     = 'center';
            ctx.textBaseline  = 'middle';
            ctx.globalAlpha   = canUse ? 1 : 0.35;
            ctx.fillText(pup.icon, bx + btnSize/2, btnY + btnSize/2 - 3);

            ctx.font        = 'bold 8px Orbitron';
            ctx.fillStyle   = canUse ? '#00FF88' : '#ff0055';
            ctx.globalAlpha = 1;
            ctx.fillText(`${pup.count}`, bx + btnSize/2, btnY + btnSize - 5);

            ctx.textAlign    = 'left';
            ctx.textBaseline = 'alphabetic';
            idx++;
        }
    }

    // ============================================================
    // DRAW: DAILY REWARD
    // ============================================================

    drawDailyReward() {
        const ctx = this.ctx;
        const W   = this.canvas.width;
        const H   = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.87)';
        ctx.fillRect(0, 0, W, H);

        const cw = Math.min(290, W - 30);
        const ch = 245;
        const cx = (W - cw) / 2;
        const cy = (H - ch) / 2;

        ctx.fillStyle   = 'rgba(10,5,25,0.97)';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 18;
        ctx.shadowColor = '#FFD700';
        ctx.beginPath();
        ctx.roundRect?.(cx, cy, cw, ch, 18) || ctx.rect(cx, cy, cw, ch);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        const streak = this.playerData.dailyStreak;
        const mult   = Math.min(1 + streak * 0.3, 4);
        const coins  = Math.floor(60 * mult);
        const dias   = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));

        ctx.textAlign = 'center';
        ctx.font      = 'bold 17px Orbitron';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('🎁 Daily Reward!', W/2, cy + 36);

        ctx.font      = '12px Rajdhani';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`Day ${streak + 1} Streak! 🔥`, W/2, cy + 58);

        ctx.font      = 'bold 20px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🪙 ${coins}`, W/2, cy + 100);

        ctx.font      = 'bold 18px Arial';
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 ${dias}`, W/2, cy + 132);

        if (streak > 0 && streak % 5 === 0) {
            ctx.font      = '12px Rajdhani';
            ctx.fillStyle = '#00FF88';
            ctx.fillText('+ Bonus Power-up! 🎉', W/2, cy + 158);
        }

        const bw  = 140;
        const bh  = 36;
        const bx  = (W - bw) / 2;
        const by  = cy + ch - 50;
        const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        grd.addColorStop(0, '#B347D9');
        grd.addColorStop(1, '#FF006E');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.roundRect?.(bx, by, bw, bh, 18) || ctx.rect(bx, by, bw, bh);
        ctx.fill();

        ctx.font      = 'bold 12px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.fillText('CLAIM! ✨', W/2, by + 24);
        ctx.textAlign = 'left';
    }

    // ============================================================
    // DRAW: GAME OVER
    // ============================================================

    drawGameOver() {
        const ctx = this.ctx;
        const W   = this.canvas.width;
        const H   = this.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, W, H);

        const pw = Math.min(W - 30, 300);
        const ph = 280;
        const px = (W - pw) / 2;
        const py = (H - ph) / 2;

        ctx.fillStyle   = 'rgba(10,4,20,0.97)';
        ctx.strokeStyle = 'rgba(179,71,217,0.5)';
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 18;
        ctx.shadowColor = '#b347d9';
        ctx.beginPath();
        ctx.roundRect?.(px, py, pw, ph, 18) || ctx.rect(px, py, pw, ph);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font        = 'bold 26px Orbitron';
        ctx.textAlign   = 'center';
        ctx.fillStyle   = '#FF006E';
        ctx.shadowBlur  = 15;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('GAME OVER', W/2, py + 45);
        ctx.shadowBlur = 0;

        ctx.font      = '14px Rajdhani';
        ctx.fillStyle = '#888';
        ctx.fillText(`Level ${this.level} • ${this.levelCfg?.name || ''}`, W/2, py + 70);

        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(px+18, py+82);
        ctx.lineTo(px+pw-18, py+82);
        ctx.stroke();

        ctx.font      = 'bold 14px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#888';
        ctx.fillText('SCORE',       px+20, py+108);
        ctx.fillText('BEST',        px+20, py+132);
        ctx.fillText('KNIVES',      px+20, py+156);
        ctx.fillText('APPLES',      px+20, py+180);
        ctx.fillText('BEST COMBO',  px+20, py+204);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.score,                    px+pw-20, py+108);
        ctx.fillStyle = this.score >= this.playerData.bestScore ? '#FFD700' : '#fff';
        ctx.fillText(this.playerData.bestScore,     px+pw-20, py+132);
        ctx.fillStyle = '#fff';
        ctx.fillText(this.knivesThrown,             px+pw-20, py+156);
        ctx.fillText(this.playerData.totalApplesHit, px+pw-20, py+180);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`x${this.maxCombo}`,           px+pw-20, py+204);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.font      = 'bold 13px Orbitron';
        ctx.fillText(`🪙 +${this.sessionCoins}`, W/2 - 35, py+235);
        ctx.fillStyle = '#00D4FF';
        ctx.fillText(`💎 +${this.sessionDias}`,  W/2 + 45, py+235);

        const blink = 0.45 + Math.sin(Date.now()/400)*0.45;
        ctx.fillStyle = `rgba(255,255,255,${blink})`;
        ctx.font      = '12px Rajdhani';
        ctx.fillText('Tap restart to play again', W/2, py+ph-14);
        ctx.textAlign = 'left';
    }

    // ============================================================
    // UTILS
    // ============================================================

    hexToRgba(hex, alpha) {
        if (!hex.startsWith('#')) return hex;
        return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${Math.max(0,alpha)})`;
    }

    darkenHex(hex, amt) {
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
        this.paused   = !this.paused;
        this.isPaused = this.paused;
        if (!this.paused) this.lastTime = performance.now();
        return this.paused;
    }

    resize() {
        this.target.x      = this.canvas.width  / 2;
        this.target.y      = this.canvas.height / 2 - 50;
        this.target.radius = Math.min(this.canvas.width, this.canvas.height) * 0.155;
        if (this.idleKnife) {
            this.idleKnife.x = this.canvas.width / 2;
            this.idleKnife.y = this.canvas.height - 90;
        }
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