/* ============================================
   BOTTLE SHOOTING - KHATARNAK EDITION
   Real Game Mechanics Like Play Store
   ============================================ */

class BottleShooting {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onScore = onScore;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bottle_best') || '0');
        this.paused = false;
        this.destroyed = false;
        this.gameOver = false;

        // Game States
        this.STATE = { WAITING: 0, PLAYING: 1, RELOADING: 2, DEAD: 2, LEVEL_UP: 3 };
        this.state = this.STATE.WAITING;

        // Level & bullets
        this.level = 1;
        this.bullets = 15;
        this.maxBullets = 15;
        this.bulletsUsed = 0;
        this.reloadTime = 0;
        this.reloadDuration = 1500;
        this.reloading = false;
        this.accuracy = 0;
        this.hits = 0;
        this.shots = 0;

        // Crosshair
        this.crosshair = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            targetX: canvas.width / 2,
            targetY: canvas.height / 2,
            size: 22,
            pulse: 0,
            spread: 0
        };

        // Bottles
        this.bottles = [];
        this.shelves = [];
        this.bottlesHit = 0;
        this.totalBottles = 0;

        // Moving targets
        this.movingTargets = [];

        // Special targets
        this.bonusTargets = [];
        this.bonusTimer = 0;
        this.bonusInterval = 6000;

        // Bullets trail
        this.bulletTrails = [];

        // Hit markers
        this.hitMarkers = [];

        // Miss markers
        this.missMarkers = [];

        // Particles
        this.particles = [];
        this.glassShards = [];
        this.splashes = [];

        // Screen effects
        this.screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
        this.flashAlpha = 0;
        this.flashColor = '#fff';
        this.deathOverlayAlpha = 0;
        this.scorePopups = [];
        this.levelUpTimer = 0;

        // Combo & streak
        this.combo = 0;
        this.comboTimer = 0;
        this.streak = 0;
        this.streakRecord = 0;

        // Wind effect
        this.wind = 0;
        this.windTimer = 0;
        this.windTarget = 0;

        // Background
        this.stars = Array.from({ length: 50 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            s: Math.random() * 1.5 + 0.3,
            t: Math.random() * Math.PI * 2
        }));
        this.bgTime = 0;
        this.mountains = this.generateMountains();
        this.trees = this.generateTrees();

        // Scope mode
        this.scopeMode = false;
        this.scopeAlpha = 0;

        this.setupLevel();
        this.bindEvents();

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    // ==================== SETUP ====================

    generateMountains() {
        const mts = [];
        let x = 0;
        while (x < this.canvas.width + 100) {
            const h = Math.random() * 120 + 60;
            mts.push({ x, h });
            x += Math.random() * 80 + 40;
        }
        return mts;
    }

    generateTrees() {
        const trees = [];
        for (let i = 0; i < 12; i++) {
            trees.push({
                x: Math.random() * this.canvas.width,
                h: Math.random() * 50 + 30,
                type: Math.floor(Math.random() * 3)
            });
        }
        return trees;
    }

    setupLevel() {
        this.bottles = [];
        this.shelves = [];
        this.movingTargets = [];
        this.bottlesHit = 0;
        this.streak = 0;
        this.reloading = false;
        this.reloadTime = 0;

        const shelfCount = Math.min(1 + Math.floor(this.level / 2), 3);
        const shelfYs = [
            this.canvas.height * 0.38,
            this.canvas.height * 0.55,
            this.canvas.height * 0.68
        ];

        for (let s = 0; s < shelfCount; s++) {
            const shelfY = shelfYs[s];
            const bottleCount = 4 + this.level;
            this.shelves.push({ y: shelfY });

            const spacing = (this.canvas.width - 80) / (bottleCount - 1);

            for (let b = 0; b < bottleCount; b++) {
                const type = this.getBottleType();
                this.bottles.push({
                    x: 40 + b * spacing,
                    y: shelfY,
                    shelfY,
                    type,
                    ...this.getBottleData(type),
                    alive: true,
                    hit: false,
                    hitTimer: 0,
                    shatterAnim: 0,
                    shimmer: Math.random() * Math.PI * 2,
                    wobble: 0,
                    wobbleSpeed: (Math.random() - 0.5) * 0.02,
                    scale: 0,
                    moveDir: 0,
                    speed: 0
                });
                this.totalBottles++;
            }
        }

        // Moving targets from level 3+
        if (this.level >= 3) {
            const moveCount = Math.min(this.level - 2, 4);
            for (let m = 0; m < moveCount; m++) {
                this.movingTargets.push({
                    x: Math.random() * (this.canvas.width - 60) + 30,
                    y: this.canvas.height * 0.25,
                    w: 40, h: 40,
                    vx: (Math.random() > 0.5 ? 1 : -1) * (1 + this.level * 0.2),
                    alive: true,
                    type: 'plate',
                    shimmer: 0,
                    hit: false,
                    hitTimer: 0
                });
            }
        }

        // Scale in bottles
        this.bottles.forEach((b, i) => {
            setTimeout(() => { b.scale = 1; }, i * 60 + 200);
        });
    }

    getBottleType() {
        const r = Math.random();
        if (r < 0.05) return 'golden';
        if (r < 0.12) return 'explosive';
        if (r < 0.22) return 'bonus';
        return 'normal';
    }

    getBottleData(type) {
        const data = {
            normal: { color: this.randomBottleColor(), points: 10, w: 18, h: 48 },
            bonus: { color: '#00FF88', points: 30, w: 20, h: 52 },
            golden: { color: '#FFD700', points: 100, w: 22, h: 55 },
            explosive: { color: '#FF4400', points: 50, w: 22, h: 50 }
        };
        return data[type] || data.normal;
    }

    randomBottleColor() {
        const colors = ['#00AA88', '#22CCAA', '#0088AA', '#AA4400', '#884422', '#4488AA', '#AA8844'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // ==================== EVENTS ====================

    bindEvents() {
        this.boundMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.crosshair.targetX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.crosshair.targetY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        };
        this.boundClick = (e) => {
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            if (this.state !== this.STATE.PLAYING) return;
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            this.shoot(mx, my);
        };
        this.boundRightClick = (e) => {
            e.preventDefault();
            this.scopeMode = !this.scopeMode;
        };
        this.boundTouchStart = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
            const my = (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height);
            this.crosshair.x = mx;
            this.crosshair.y = my;
            this.crosshair.targetX = mx;
            this.crosshair.targetY = my;
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            if (this.state !== this.STATE.PLAYING) return;
            setTimeout(() => this.shoot(mx, my), 50);
        };
        this.boundTouchMove = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.crosshair.targetX = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
            this.crosshair.targetY = (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height);
        };

        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('click', this.boundClick);
        this.canvas.addEventListener('contextmenu', this.boundRightClick);
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    }

    shoot(mx, my) {
        if (this.reloading || this.bullets <= 0) {
            this.startReload();
            return;
        }

        this.bullets--;
        this.shots++;
        this.bulletsUsed++;
        this.crosshair.spread = 15;

        // Bullet trail
        const spread = this.scopeMode ? 2 : 8;
        const bx = mx + (Math.random() - 0.5) * spread;
        const by = my + (Math.random() - 0.5) * spread + this.wind * 5;

        this.bulletTrails.push({
            startX: this.canvas.width / 2,
            startY: this.canvas.height - 30,
            endX: bx, endY: by,
            progress: 0, opacity: 1
        });

        if (window.audioManager) audioManager.play('shoot');

        // Check what we hit
        let hitSomething = false;

        // Check moving targets
        for (let i = this.movingTargets.length - 1; i >= 0; i--) {
            const t = this.movingTargets[i];
            if (!t.alive) continue;
            if (bx > t.x - t.w / 2 && bx < t.x + t.w / 2 &&
                by > t.y - t.h / 2 && by < t.y + t.h / 2) {
                this.hitMovingTarget(t, i, bx, by);
                hitSomething = true;
                break;
            }
        }

        // Check bonus targets
        for (let i = this.bonusTargets.length - 1; i >= 0; i--) {
            const t = this.bonusTargets[i];
            if (bx > t.x - t.r && bx < t.x + t.r &&
                by > t.y - t.r && by < t.y + t.r) {
                this.hitBonusTarget(t, i, bx, by);
                hitSomething = true;
                break;
            }
        }

        // Check bottles
        if (!hitSomething) {
            for (let i = this.bottles.length - 1; i >= 0; i--) {
                const b = this.bottles[i];
                if (!b.alive) continue;
                const bTop = b.y - b.h;
                const bLeft = b.x - b.w / 2;
                const bRight = b.x + b.w / 2;
                if (bx > bLeft - 5 && bx < bRight + 5 && by > bTop - 5 && by < b.y + 5) {
                    this.hitBottle(b, i, bx, by);
                    hitSomething = true;
                    break;
                }
            }
        }

        if (!hitSomething) {
            // Miss
            this.streak = 0;
            this.combo = 0;
            this.comboTimer = 0;
            this.missMarkers.push({ x: bx, y: by, life: 1, decay: 0.04 });
            this.spawnMissParticles(bx, by);
            this.screenShake.timer = 3;
            this.screenShake.intensity = 2;
        }

        this.hits = this.shots - this.missMarkers.length;
        this.accuracy = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;

        // Auto reload
        if (this.bullets <= 0) this.startReload();

        // Check level complete
        if (this.bottles.every(b => !b.alive) && this.movingTargets.every(t => !t.alive)) {
            this.triggerLevelComplete();
        }
    }

    hitBottle(bottle, idx, bx, by) {
        this.hits++;
        this.streak++;
        this.streakRecord = Math.max(this.streakRecord, this.streak);
        this.combo++;
        this.comboTimer = 3000;

        const streakBonus = Math.min(this.streak - 1, 10) * 5;
        const comboBonus = Math.min(this.combo - 1, 10) * 3;
        const scopeBonus = this.scopeMode ? 2 : 1;
        let gained = (bottle.points + streakBonus + comboBonus) * scopeBonus;

        bottle.alive = false;
        bottle.hit = true;
        this.bottlesHit++;
        this.score += gained;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bottle_best', this.bestScore);
        }
        this.onScore(this.score);

        // Special effects based on type
        if (bottle.type === 'explosive') {
            this.triggerBottleExplosion(bottle, idx);
            gained += 50;
            this.score += 50;
            this.onScore(this.score);
        } else {
            this.spawnGlassShards(bottle.x, bottle.y, bottle.color);
            this.spawnLiquidSplash(bottle.x, bottle.y, bottle.color);
        }

        // Hit marker
        this.hitMarkers.push({
            x: bx, y: by,
            text: this.streak > 3 ? `🔥 ${this.streak}x STREAK! +${gained}` : `+${gained}`,
            color: this.streak > 3 ? '#FF8C00' :
                   this.combo > 3 ? '#FFD700' :
                   bottle.type === 'golden' ? '#FFD700' :
                   bottle.color,
            life: 1, decay: 0.025
        });

        this.scorePopups.push({
            x: bottle.x, y: bottle.y - 30,
            text: this.hitMarkers[this.hitMarkers.length - 1].text,
            color: this.hitMarkers[this.hitMarkers.length - 1].color,
            life: 1200, opacity: 1
        });

        this.screenShake.timer = bottle.type === 'golden' ? 8 : 4;
        this.screenShake.intensity = bottle.type === 'golden' ? 6 : 3;

        if (this.streak >= 3) {
            this.flashAlpha = 0.1;
            this.flashColor = '#FFD700';
        }

        if (window.audioManager) audioManager.play('pop');
    }

    triggerBottleExplosion(bottle, idx) {
        const cx = bottle.x;
        const cy = bottle.y - bottle.h / 2;
        const radius = 80;

        // Destroy nearby bottles
        for (let i = this.bottles.length - 1; i >= 0; i--) {
            if (i === idx || !this.bottles[i].alive) continue;
            const b = this.bottles[i];
            const dist = Math.sqrt((b.x - cx) ** 2 + ((b.y - b.h / 2) - cy) ** 2);
            if (dist < radius) {
                b.alive = false;
                this.bottlesHit++;
                this.score += b.points;
                this.spawnGlassShards(b.x, b.y, b.color);
            }
        }

        this.onScore(this.score);
        this.spawnGlassShards(cx, cy, '#FF4400', 20);
        this.spawnLiquidSplash(cx, cy, '#FF8800');

        this.particles.push(...Array.from({ length: 15 }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            return { x: cx, y: cy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 5, size: Math.random() * 6 + 3, life: 1, decay: 0.025, color: '#FF8C00', gravity: 0.2 };
        }));

        this.screenShake.timer = 18;
        this.screenShake.intensity = 12;
        this.flashAlpha = 0.4;
        this.flashColor = '#FF8C00';
        if (window.audioManager) audioManager.play('levelUp');
    }

    hitMovingTarget(target, idx, bx, by) {
        target.alive = false;
        target.hit = true;
        this.hits++;
        this.streak++;
        this.streakRecord = Math.max(this.streakRecord, this.streak);

        const gained = 40 * this.level;
        this.score += gained;
        this.onScore(this.score);

        this.spawnGlassShards(target.x, target.y, '#88AAFF', 12);
        this.scorePopups.push({
            x: target.x, y: target.y - 20,
            text: `🎯 MOVING +${gained}!`,
            color: '#00D4FF', life: 1500, opacity: 1
        });

        this.screenShake.timer = 6;
        this.screenShake.intensity = 4;
        if (window.audioManager) audioManager.play('success');
    }

    hitBonusTarget(target, idx, bx, by) {
        this.bonusTargets.splice(idx, 1);
        this.hits++;
        this.streak += 3;

        const gained = target.points;
        this.score += gained;
        this.onScore(this.score);

        this.spawnGlassShards(target.x, target.y, target.color, 15);
        this.scorePopups.push({
            x: target.x, y: target.y - 20,
            text: `⭐ BONUS! +${gained}`,
            color: '#FFD700', life: 2000, opacity: 1
        });

        this.flashAlpha = 0.25;
        this.flashColor = '#FFD700';
        this.screenShake.timer = 10;
        this.screenShake.intensity = 6;
        if (window.audioManager) audioManager.play('levelUp');
    }

    startReload() {
        if (this.reloading) return;
        this.reloading = true;
        this.reloadTime = this.reloadDuration;
        if (window.audioManager) audioManager.play('fail');
    }

    triggerLevelComplete() {
        if (this.state === this.STATE.LEVEL_UP) return;
        this.state = this.STATE.LEVEL_UP;
        this.levelUpTimer = 2000;

        const accuracy = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
        const bonus = accuracy * 2 + this.level * 50;
        this.score += bonus;
        this.onScore(this.score);

        this.flashAlpha = 0.4;
        this.flashColor = '#00FF88';
        this.screenShake.timer = 12;
        this.screenShake.intensity = 7;
        if (window.audioManager) audioManager.play('levelUp');
    }

    spawnGlassShards(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 2;
            this.glassShards.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                w: Math.random() * 8 + 3,
                h: Math.random() * 4 + 2,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                life: 1, decay: 0.025,
                color, gravity: 0.25
            });
        }
    }

    spawnLiquidSplash(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 1;
            this.splashes.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                r: Math.random() * 6 + 2,
                life: 1, decay: 0.03,
                color, gravity: 0.18
            });
        }
    }

    spawnMissParticles(x, y) {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                size: Math.random() * 3 + 1,
                life: 1, decay: 0.06,
                color: '#444', gravity: 0.05
            });
        }
    }

    restartGame() {
        this.score = 0;
        this.onScore(0);
        this.state = this.STATE.WAITING;
        this.gameOver = false;
        this.level = 1;
        this.bullets = this.maxBullets;
        this.bulletsUsed = 0;
        this.bottlesHit = 0;
        this.totalBottles = 0;
        this.shots = 0;
        this.hits = 0;
        this.streak = 0;
        this.combo = 0;
        this.deathOverlayAlpha = 0;
        this.flashAlpha = 0;
        this.reloading = false;
        this.particles = [];
        this.glassShards = [];
        this.splashes = [];
        this.bulletTrails = [];
        this.hitMarkers = [];
        this.missMarkers = [];
        this.scorePopups = [];
        this.bonusTargets = [];
        this.setupLevel();
    }

    // ==================== UPDATE ====================

    update(timestamp, dt) {
        if (this.paused || this.gameOver) return;

        this.bgTime += dt * 0.001;
        this.stars.forEach(s => s.t += 0.015);

        if (this.screenShake.timer > 0) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * (this.screenShake.timer / 20);
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 0.4 * (this.screenShake.timer / 20);
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha -= 0.04;

        // Crosshair smooth
        this.crosshair.x += (this.crosshair.targetX - this.crosshair.x) * 0.15;
        this.crosshair.y += (this.crosshair.targetY - this.crosshair.y) * 0.15;
        this.crosshair.pulse += 0.05;
        if (this.crosshair.spread > 0) this.crosshair.spread -= 0.8;

        // Scope alpha
        this.scopeAlpha = this.scopeMode
            ? Math.min(1, this.scopeAlpha + 0.1)
            : Math.max(0, this.scopeAlpha - 0.1);

        if (this.state === this.STATE.WAITING) return;

        if (this.state === this.STATE.LEVEL_UP) {
            this.levelUpTimer -= dt;
            if (this.levelUpTimer <= 0) {
                this.level++;
                this.state = this.STATE.PLAYING;
                this.bullets = this.maxBullets;
                this.shots = 0;
                this.hits = 0;
                this.streak = 0;
                this.reloading = false;
                this.bonusTargets = [];
                this.setupLevel();
            }
            this.updateParticles(dt);
            return;
        }

        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, this.deathOverlayAlpha + 0.015);
            this.updateParticles(dt);
            return;
        }

        // Reload
        if (this.reloading) {
            this.reloadTime -= dt;
            if (this.reloadTime <= 0) {
                this.reloading = false;
                this.bullets = this.maxBullets;
                this.flashAlpha = 0.1;
                this.flashColor = '#00FF88';
            }
        }

        // Wind
        this.windTimer += dt;
        if (this.windTimer > 3000) {
            this.windTimer = 0;
            this.windTarget = (Math.random() - 0.5) * (this.level > 5 ? 3 : 1.5);
        }
        this.wind += (this.windTarget - this.wind) * 0.01;

        // Update bottles shimmer & wobble
        this.bottles.forEach(b => {
            b.shimmer += 0.04;
            b.wobble += b.wobbleSpeed;
            b.scale = Math.min(1, b.scale + 0.08);
        });

        // Moving targets
        this.movingTargets.forEach(t => {
            if (!t.alive) return;
            t.x += t.vx;
            t.shimmer += 0.05;
            if (t.x < 20 || t.x > this.canvas.width - 20) t.vx *= -1;
            if (t.hitTimer > 0) { t.hitTimer -= dt; if (t.hitTimer <= 0) t.hit = false; }
        });

        // Bonus target spawn
        this.bonusTimer += dt;
        if (this.bonusTimer >= this.bonusInterval && this.bonusTargets.length < 2) {
            this.bonusTimer = 0;
            this.bonusTargets.push({
                x: Math.random() * (this.canvas.width - 80) + 40,
                y: this.canvas.height * 0.2,
                r: 22,
                vx: (Math.random() > 0.5 ? 1 : -1) * 2,
                vy: (Math.random() > 0.5 ? 1 : -1) * 0.5,
                color: '#FFD700',
                glow: '#FFE866',
                points: 150,
                pulse: 0,
                timer: 4000
            });
        }

        // Bonus targets move & expire
        for (let i = this.bonusTargets.length - 1; i >= 0; i--) {
            const t = this.bonusTargets[i];
            t.x += t.vx;
            t.y += t.vy;
            t.pulse += 0.1;
            t.timer -= dt;
            if (t.x < t.r || t.x > this.canvas.width - t.r) t.vx *= -1;
            if (t.y < t.r || t.y > this.canvas.height * 0.4) t.vy *= -1;
            if (t.timer <= 0) this.bonusTargets.splice(i, 1);
        }

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) { this.combo = 0; }
        }

        // Bullet trails
        this.bulletTrails = this.bulletTrails.filter(t => {
            t.progress += 0.08;
            t.opacity -= 0.06;
            return t.opacity > 0;
        });

        // Hit markers
        this.hitMarkers = this.hitMarkers.filter(h => { h.life -= h.decay; return h.life > 0; });
        this.missMarkers = this.missMarkers.filter(h => { h.life -= h.decay; return h.life > 0; });

        this.updateParticles(dt);

        // Score popups
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= dt;
            p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });

        // Check out of bullets with no bottles
        if (!this.reloading && this.bullets <= 0) {
            const alive = this.bottles.filter(b => b.alive).length + this.movingTargets.filter(t => t.alive).length;
            if (alive > 0 && this.bulletsUsed >= this.maxBullets * 3) {
                this.gameOver = true;
                this.state = this.STATE.DEAD;
                setTimeout(() => this.onScore(this.score, true), 1200);
                if (window.audioManager) audioManager.play('gameOver');
            }
        }
    }

    updateParticles(dt) {
        const updateList = (arr) => arr.filter(p => {
            p.x += p.vx; p.y += p.vy;
            p.vy += p.gravity || 0;
            p.vx *= 0.97;
            p.life -= p.decay;
            if (p.size) p.size *= 0.96;
            if (p.rotation !== undefined) p.rotation += p.rotSpeed || 0;
            return p.life > 0 && (p.size === undefined || p.size > 0.3);
        });

        this.particles = updateList(this.particles);
        this.glassShards = updateList(this.glassShards);
        this.splashes = updateList(this.splashes);
    }

    // ==================== DRAW ====================

    draw(timestamp) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);

        this.drawBackground(timestamp);
        this.drawShelves();
        this.drawBottles(timestamp);
        this.drawMovingTargets(timestamp);
        this.drawBonusTargets(timestamp);
        this.drawGlassShards();
        this.drawSplashes();
        this.drawParticlesD();
        this.drawBulletTrails();
        this.drawMissMarkers();
        this.drawScorePopupsD();

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
        }

        if (this.scopeAlpha > 0) this.drawScope(timestamp);

        this.drawCrosshair(timestamp);
        this.drawHUD(timestamp);

        if (this.state === this.STATE.WAITING) this.drawWaiting(timestamp);
        if (this.state === this.STATE.LEVEL_UP) this.drawLevelUp(timestamp);
        if (this.state === this.STATE.DEAD) this.drawDeathScreen(timestamp);

        ctx.restore();
    }

    drawBackground(timestamp) {
        const ctx = this.ctx;

        // Sky gradient (day to sunset based on level)
        const skyTop = this.level > 5 ? '#0a0520' : '#0a1a3a';
        const skyBottom = this.level > 5 ? '#200a30' : '#152a4a';
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.canvas.height * 0.7);
        skyGrad.addColorStop(0, skyTop);
        skyGrad.addColorStop(1, skyBottom);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        this.stars.forEach(s => {
            const a = 0.25 + Math.sin(s.t) * 0.3;
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y * 0.6, s.s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Moon/Sun
        const moonX = this.canvas.width * 0.8;
        const moonY = this.canvas.height * 0.15;
        ctx.fillStyle = this.level > 5 ? '#fffde0' : '#FFE4A0';
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.level > 5 ? '#fffde0' : '#FFE4A0';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Mountains (far)
        ctx.fillStyle = this.level > 5 ? '#151025' : '#1a2540';
        ctx.beginPath();
        ctx.moveTo(0, this.canvas.height * 0.7);
        this.mountains.forEach(m => {
            ctx.lineTo(m.x, this.canvas.height * 0.7 - m.h * 0.6);
        });
        ctx.lineTo(this.canvas.width, this.canvas.height * 0.7);
        ctx.closePath();
        ctx.fill();

        // Mountains (near)
        ctx.fillStyle = this.level > 5 ? '#0f0820' : '#142035';
        ctx.beginPath();
        ctx.moveTo(0, this.canvas.height * 0.72);
        this.mountains.forEach((m, i) => {
            ctx.lineTo(m.x + 20, this.canvas.height * 0.72 - m.h * 0.9);
        });
        ctx.lineTo(this.canvas.width, this.canvas.height * 0.72);
        ctx.closePath();
        ctx.fill();

        // Ground
        const groundGrad = ctx.createLinearGradient(0, this.canvas.height * 0.72, 0, this.canvas.height);
        groundGrad.addColorStop(0, this.level > 5 ? '#1a0a30' : '#1a2a10');
        groundGrad.addColorStop(0.3, this.level > 5 ? '#120820' : '#152208');
        groundGrad.addColorStop(1, this.level > 5 ? '#080310' : '#0a1205');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, this.canvas.height * 0.72, this.canvas.width, this.canvas.height * 0.28);

        // Trees
        this.trees.forEach(t => {
            const tx = t.x;
            const ty = this.canvas.height * 0.72;
            ctx.fillStyle = this.level > 5 ? '#0a0518' : '#0f1a08';

            if (t.type === 0) {
                // Pine
                ctx.beginPath();
                ctx.moveTo(tx, ty - t.h);
                ctx.lineTo(tx - t.h * 0.35, ty);
                ctx.lineTo(tx + t.h * 0.35, ty);
                ctx.closePath();
                ctx.fill();
            } else if (t.type === 1) {
                // Round
                ctx.fillRect(tx - 4, ty - t.h, 8, t.h * 0.5);
                ctx.beginPath();
                ctx.arc(tx, ty - t.h * 0.7, t.h * 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Tall pine
                for (let l = 0; l < 3; l++) {
                    ctx.beginPath();
                    ctx.moveTo(tx, ty - t.h + l * 12);
                    ctx.lineTo(tx - t.h * 0.3, ty - t.h * 0.4 + l * 15);
                    ctx.lineTo(tx + t.h * 0.3, ty - t.h * 0.4 + l * 15);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        });
    }

    drawShelves() {
        const ctx = this.ctx;
        this.shelves.forEach(shelf => {
            const sg = ctx.createLinearGradient(0, shelf.y, this.canvas.width, shelf.y + 8);
            sg.addColorStop(0, '#3a2a1a');
            sg.addColorStop(0.5, '#6a4a2a');
            sg.addColorStop(1, '#3a2a1a');
            ctx.fillStyle = sg;
            ctx.shadowBlur = 5;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillRect(20, shelf.y, this.canvas.width - 40, 8);

            // Shelf shine
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(20, shelf.y, this.canvas.width - 40, 2);

            // Shelf legs
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(30, shelf.y + 8, 12, 25);
            ctx.fillRect(this.canvas.width - 42, shelf.y + 8, 12, 25);
            ctx.shadowBlur = 0;
        });
    }

    drawBottles(timestamp) {
        const ctx = this.ctx;
        this.bottles.forEach(b => {
            if (!b.alive) return;

            const wobble = Math.sin(b.wobble) * 1.5;
            const shimmerAlpha = 0.15 + Math.sin(b.shimmer) * 0.08;

            ctx.save();
            ctx.translate(b.x + wobble, b.y);
            ctx.scale(b.scale, b.scale);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(0, 3, b.w * 0.5, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bottle glow (special types)
            if (b.type === 'golden') {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#FFD700';
            } else if (b.type === 'explosive') {
                ctx.shadowBlur = 12 + Math.sin(b.shimmer * 2) * 5;
                ctx.shadowColor = '#FF4400';
            } else if (b.type === 'bonus') {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00FF88';
            }

            this.drawBottleShape(ctx, b, shimmerAlpha);

            ctx.restore();
            ctx.shadowBlur = 0;
        });
    }

    drawBottleShape(ctx, b, shimmerAlpha) {
        const w = b.w;
        const h = b.h;

        // Bottle body gradient
        const bodyGrad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
        bodyGrad.addColorStop(0, this.lightenColor(b.color, 60));
        bodyGrad.addColorStop(0.3, b.color);
        bodyGrad.addColorStop(0.7, this.darkenColor(b.color, 30));
        bodyGrad.addColorStop(1, this.darkenColor(b.color, 50));

        ctx.globalAlpha = 0.85;
        ctx.fillStyle = bodyGrad;

        // Body
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.quadraticCurveTo(-w / 2, -h * 0.3, -w * 0.4, -h * 0.65);
        ctx.lineTo(-w * 0.2, -h * 0.75);
        ctx.lineTo(-w * 0.15, -h);
        ctx.lineTo(w * 0.15, -h);
        ctx.lineTo(w * 0.2, -h * 0.75);
        ctx.lineTo(w * 0.4, -h * 0.65);
        ctx.quadraticCurveTo(w / 2, -h * 0.3, w / 2, 0);
        ctx.closePath();
        ctx.fill();

        // Liquid fill (slightly less than full)
        const liquidH = h * 0.75;
        const liquidGrad = ctx.createLinearGradient(0, -liquidH, 0, 0);
        liquidGrad.addColorStop(0, this.lightenColor(b.color, 30) + 'CC');
        liquidGrad.addColorStop(1, b.color + 'AA');
        ctx.fillStyle = liquidGrad;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 2, 0);
        ctx.quadraticCurveTo(-w / 2 + 2, -liquidH * 0.3, -w * 0.38, -liquidH);
        ctx.lineTo(w * 0.38, -liquidH);
        ctx.quadraticCurveTo(w / 2 - 2, -liquidH * 0.3, w / 2 - 2, 0);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1;

        // Glass shine (left)
        const shineGrad = ctx.createLinearGradient(-w / 2, -h, -w * 0.1, 0);
        shineGrad.addColorStop(0, `rgba(255,255,255,${shimmerAlpha + 0.2})`);
        shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shineGrad;
        ctx.beginPath();
        ctx.moveTo(-w * 0.42, 0);
        ctx.quadraticCurveTo(-w * 0.42, -h * 0.3, -w * 0.35, -h * 0.65);
        ctx.lineTo(-w * 0.15, -h * 0.65);
        ctx.lineTo(-w * 0.2, -h * 0.3);
        ctx.quadraticCurveTo(-w * 0.2, 0, -w * 0.42, 0);
        ctx.closePath();
        ctx.fill();

        // Bottle neck
        ctx.fillStyle = this.darkenColor(b.color, 20);
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(-w * 0.15, -h, w * 0.3, h * 0.25, [2, 2, 0, 0]);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Cap
        let capColor = '#888';
        if (b.type === 'golden') capColor = '#FFD700';
        else if (b.type === 'explosive') capColor = '#FF4400';
        else if (b.type === 'bonus') capColor = '#00FF88';

        ctx.fillStyle = capColor;
        ctx.shadowBlur = b.type !== 'normal' ? 8 : 0;
        ctx.shadowColor = capColor;
        ctx.beginPath();
        ctx.roundRect(-w * 0.18, -h * 1.08, w * 0.36, h * 0.1, 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        if (b.type !== 'normal') {
            const labels = { golden: '💰', bonus: '⭐', explosive: '💥' };
            ctx.font = `${w * 0.7}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(labels[b.type] || '', 0, -h * 0.5 + w * 0.35);
        } else {
            // Normal bottle label strip
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.roundRect(-w * 0.35, -h * 0.45, w * 0.7, h * 0.2, 3);
            ctx.fill();
        }

        ctx.textAlign = 'left';
    }

    drawMovingTargets(timestamp) {
        const ctx = this.ctx;
        this.movingTargets.forEach(t => {
            if (!t.alive) return;
            t.shimmer += 0.05;

            ctx.save();
            ctx.translate(t.x, t.y);

            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00D4FF';

            // Plate
            const plateGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, t.w / 2);
            plateGrad.addColorStop(0, '#ffffff');
            plateGrad.addColorStop(0.3, '#ddddee');
            plateGrad.addColorStop(0.7, '#aaaacc');
            plateGrad.addColorStop(1, '#8888aa');
            ctx.fillStyle = plateGrad;
            ctx.beginPath();
            ctx.ellipse(0, 0, t.w / 2, t.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Rings
            for (let r = 1; r <= 3; r++) {
                ctx.strokeStyle = `rgba(0,150,200,${0.3 - r * 0.08})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(0, 0, t.w / 2 * (r / 3.5), t.h / 2 * (r / 3.5), 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.ellipse(-t.w * 0.15, -t.h * 0.2, t.w * 0.2, t.h * 0.15, -0.5, 0, Math.PI * 2);
            ctx.fill();

            // Motion indicator
            ctx.strokeStyle = 'rgba(0,212,255,0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(-t.w / 2 - 15, 0);
            ctx.lineTo(t.w / 2 + 15, 0);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;

            // Arrow
            const arrowX = t.vx > 0 ? t.w / 2 + 8 : -t.w / 2 - 8;
            ctx.fillStyle = '#00D4FF';
            ctx.font = '12px serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.vx > 0 ? '▶' : '◀', arrowX, 4);

            ctx.restore();
        });
        ctx.textAlign = 'left';
    }

    drawBonusTargets(timestamp) {
        const ctx = this.ctx;
        this.bonusTargets.forEach(t => {
            const pulse = 0.9 + Math.sin(t.pulse) * 0.15;
            const timeAlpha = Math.min(1, t.timer / 1000);

            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.scale(pulse, pulse);
            ctx.globalAlpha = timeAlpha;

            // Outer ring
            ctx.strokeStyle = `rgba(255,215,0,${0.4 + Math.sin(t.pulse * 2) * 0.3})`;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, 0, t.r + 5, 0, Math.PI * 2);
            ctx.stroke();

            // Body
            const grad = ctx.createRadialGradient(-t.r * 0.3, -t.r * 0.3, 0, 0, 0, t.r);
            grad.addColorStop(0, '#FFE866');
            grad.addColorStop(0.5, '#FFD700');
            grad.addColorStop(1, '#CC8800');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, t.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Star inside
            ctx.font = `${t.r * 1.2}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText('⭐', 0, t.r * 0.42);

            // Timer bar
            const pct = t.timer / 4000;
            ctx.strokeStyle = `rgba(255,255,255,${timeAlpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, t.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
            ctx.stroke();

            ctx.restore();
        });
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    drawGlassShards() {
        const ctx = this.ctx;
        this.glassShards.forEach(s => {
            ctx.globalAlpha = s.life;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rotation);
            ctx.fillStyle = s.color;
            ctx.globalAlpha = s.life * 0.7;
            ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.globalAlpha = s.life * 0.3;
            ctx.fillRect(-s.w / 2 + 1, -s.h / 2, s.w * 0.3, s.h);
            ctx.restore();
        });
        ctx.globalAlpha = 1;
    }

    drawSplashes() {
        const ctx = this.ctx;
        this.splashes.forEach(s => {
            ctx.globalAlpha = s.life * 0.7;
            ctx.fillStyle = s.color;
            ctx.shadowBlur = 4;
            ctx.shadowColor = s.color;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawParticlesD() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawBulletTrails() {
        const ctx = this.ctx;
        this.bulletTrails.forEach(t => {
            const prog = t.progress;
            const ex = t.startX + (t.endX - t.startX) * Math.min(1, prog);
            const ey = t.startY + (t.endY - t.startY) * Math.min(1, prog);

            ctx.globalAlpha = t.opacity * 0.5;
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#FFD700';
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -prog * 20;
            ctx.beginPath();
            ctx.moveTo(t.startX, t.startY);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    drawMissMarkers() {
        const ctx = this.ctx;
        this.missMarkers.forEach(m => {
            ctx.globalAlpha = m.life;
            ctx.strokeStyle = '#FF0055';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(m.x - 8, m.y - 8);
            ctx.lineTo(m.x + 8, m.y + 8);
            ctx.moveTo(m.x + 8, m.y - 8);
            ctx.lineTo(m.x - 8, m.y + 8);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    drawScorePopupsD() {
        const ctx = this.ctx;
        this.scorePopups.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.font = 'bold 13px Orbitron';
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

    drawScope(timestamp) {
        const ctx = this.ctx;
        const cx = this.crosshair.x;
        const cy = this.crosshair.y;
        const r = 70;

        ctx.globalAlpha = this.scopeAlpha;

        // Scope circle
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Scope grid
        ctx.strokeStyle = 'rgba(0,255,136,0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let i = -3; i <= 3; i++) {
            ctx.moveTo(cx - r, cy + i * (r / 3));
            ctx.lineTo(cx + r, cy + i * (r / 3));
            ctx.moveTo(cx + i * (r / 3), cy - r);
            ctx.lineTo(cx + i * (r / 3), cy + r);
        }
        ctx.stroke();

        // Scope crosshair
        ctx.strokeStyle = 'rgba(0,255,136,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx, cy + r);
        ctx.stroke();

        // Scope outline
        ctx.strokeStyle = 'rgba(0,255,136,0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00FF88';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Lens glare
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    drawCrosshair(timestamp) {
        const ctx = this.ctx;
        const cx = this.crosshair.x;
        const cy = this.crosshair.y;
        const size = this.crosshair.size + this.crosshair.spread;
        const pulse = Math.sin(this.crosshair.pulse) * 2;
        const color = this.reloading ? '#FFD700' : this.scopeMode ? '#00FF88' : '#FF0055';

        ctx.shadowBlur = 10;
        ctx.shadowColor = color;

        // Gap crosshair
        const gap = 6 + this.crosshair.spread * 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(cx - size, cy);
        ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy);
        ctx.lineTo(cx + size, cy);
        // Vertical lines
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap);
        ctx.lineTo(cx, cy + size);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();

        // Outer circle
        ctx.strokeStyle = `rgba(255,0,85,0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, size + 5 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Wind indicator
        if (Math.abs(this.wind) > 0.3) {
            const windStr = Math.abs(this.wind).toFixed(1);
            const windDir = this.wind > 0 ? '→' : '←';
            ctx.fillStyle = 'rgba(255,200,0,0.8)';
            ctx.font = '11px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillText(`${windDir} ${windStr}`, cx, cy - size - 12);
        }
        ctx.textAlign = 'left';
    }

    drawHUD(timestamp) {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Top bar
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, 42);

        // Score
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Orbitron';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#FFD700';
        ctx.fillText(`${this.score}`, 12, 26);
        ctx.shadowBlur = 0;
        if (this.bestScore > 0) {
            ctx.fillStyle = 'rgba(255,215,0,0.5)';
            ctx.font = '10px Rajdhani';
            ctx.fillText(`BEST: ${this.bestScore}`, 12, 38);
        }

        // Level
        ctx.fillStyle = '#b347d9';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#b347d9';
        ctx.fillText(`LEVEL ${this.level}`, W / 2, 22);
        ctx.shadowBlur = 0;

        // Accuracy
        const acc = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
        ctx.fillStyle = acc > 70 ? '#00FF88' : acc > 40 ? '#FFD700' : '#FF0055';
        ctx.font = '11px Rajdhani';
        ctx.fillText(`🎯 ${acc}%`, W / 2, 36);

        // Streak
        if (this.streak >= 3) {
            const sf = 0.7 + Math.sin(timestamp / 200) * 0.3;
            ctx.globalAlpha = sf;
            ctx.fillStyle = '#FF8C00';
            ctx.font = 'bold 11px Orbitron';
            ctx.fillText(`🔥 ${this.streak}x STREAK`, W / 2, 52);
            ctx.globalAlpha = 1;
        }

        // Bullets
        ctx.textAlign = 'right';
        const bulletW = 14;
        const bulletH = 20;
        const bulletSpacing = 18;
        const startBX = W - 15;

        for (let i = 0; i < this.maxBullets; i++) {
            const bx = startBX - i * bulletSpacing;
            const hasBullet = i < this.bullets;

            if (hasBullet) {
                ctx.fillStyle = '#FFD700';
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#FFD700';
            } else {
                ctx.fillStyle = 'rgba(100,80,0,0.3)';
                ctx.shadowBlur = 0;
            }

            // Bullet shape
            ctx.beginPath();
            ctx.roundRect(bx - 3, H - 45, 6, 18, [3, 3, 0, 0]);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Reload bar
        if (this.reloading) {
            const pct = 1 - (this.reloadTime / this.reloadDuration);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.roundRect(W / 2 - 60, H - 25, 120, 12, 5);
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.roundRect(W / 2 - 60, H - 25, 120 * pct, 12, 5);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText('RELOADING...', W / 2, H - 16);
        } else {
            // Scope mode hint
            ctx.fillStyle = this.scopeMode ? 'rgba(0,255,136,0.6)' : 'rgba(255,255,255,0.2)';
            ctx.font = '9px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillText(this.scopeMode ? '🔭 SCOPE ON' : 'Right Click = Scope', W / 2, H - 12);
        }

        // Bottles left
        const bottlesLeft = this.bottles.filter(b => b.alive).length +
                           this.movingTargets.filter(t => t.alive).length;
        ctx.fillStyle = '#aaa';
        ctx.font = '11px Rajdhani';
        ctx.textAlign = 'left';
        ctx.fillText(`🍾 ${bottlesLeft} left`, 12, H - 12);

        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
    }

    drawWaiting(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(cx - 155, cy - 55, 310, 105, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 24px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FFD700';
        ctx.fillText('BOTTLE SHOOTING', cx, cy - 15);
        ctx.shadowBlur = 0;

        const bob = Math.sin(timestamp / 400) * 4;
        ctx.font = '13px Rajdhani';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Click / Tap to Shoot', cx, cy + 12 + bob);
        ctx.font = '11px Rajdhani';
        ctx.fillStyle = '#666';
        ctx.fillText('Right Click = Scope  •  Aim Carefully!', cx, cy + 32);
        ctx.textAlign = 'left';
    }

    drawLevelUp(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const prog = 1 - this.levelUpTimer / 2000;

        ctx.fillStyle = `rgba(0,0,0,${prog * 0.6})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.globalAlpha = Math.min(1, prog * 2);
        ctx.font = 'bold 34px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00FF88';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00FF88';
        ctx.fillText('STAGE CLEAR!', cx, cy - 20);
        ctx.shadowBlur = 0;

        const acc = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
        ctx.font = '16px Rajdhani';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Accuracy: ${acc}%  •  Streak: ${this.streakRecord}x`, cx, cy + 20);
        ctx.font = '14px Rajdhani';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Level ${this.level + 1} incoming...`, cx, cy + 46);

        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    drawDeathScreen(timestamp) {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const alpha = this.deathOverlayAlpha;

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.75})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.5) return;
        const pa = (alpha - 0.5) / 0.5;
        ctx.globalAlpha = pa;

        const pw = Math.min(this.canvas.width - 40, 310);
        const ph = 255;

        ctx.fillStyle = 'rgba(5,3,15,0.97)';
        ctx.strokeStyle = 'rgba(255,215,0,0.5)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD700';
        ctx.beginPath();
        ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 18);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 30px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF006E';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FF006E';
        ctx.fillText('AMMO OUT!', cx, cy - ph / 2 + 48);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - pw / 2 + 20, cy - ph / 2 + 64);
        ctx.lineTo(cx + pw / 2 - 20, cy - ph / 2 + 64);
        ctx.stroke();

        const finalAcc = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
        const rows = [
            { label: 'SCORE', val: this.score, color: '#fff' },
            { label: 'BEST', val: this.bestScore, color: this.score >= this.bestScore ? '#FFD700' : '#fff' },
            { label: 'LEVEL', val: this.level, color: '#b347d9' },
            { label: 'ACCURACY', val: `${finalAcc}%`, color: finalAcc > 70 ? '#00FF88' : '#FFD700' },
            { label: 'BEST STREAK', val: `${this.streakRecord}x`, color: '#FF8C00' },
            { label: 'BOTTLES HIT', val: this.bottlesHit, color: '#00D4FF' }
        ];

        rows.forEach((r, i) => {
            const ry = cy - ph / 2 + 92 + i * 26;
            ctx.font = '12px Rajdhani';
            ctx.fillStyle = '#777';
            ctx.textAlign = 'left';
            ctx.fillText(r.label, cx - pw / 2 + 22, ry);
            ctx.font = 'bold 13px Orbitron';
            ctx.fillStyle = r.color;
            ctx.textAlign = 'right';
            ctx.fillText(r.val, cx + pw / 2 - 22, ry);
        });

        const tap = 0.5 + Math.sin(Date.now() / 400) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${tap})`;
        ctx.font = '12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO PLAY AGAIN', cx, cy + ph / 2 - 16);

        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    // ==================== UTILS ====================

    lightenColor(color, amt) {
        if (!color.startsWith('#')) return color;
        const r = Math.min(255, parseInt(color.slice(1, 3), 16) + amt);
        const g = Math.min(255, parseInt(color.slice(3, 5), 16) + amt);
        const b = Math.min(255, parseInt(color.slice(5, 7), 16) + amt);
        return `rgb(${r},${g},${b})`;
    }

    darkenColor(color, amt) {
        if (!color.startsWith('#')) return color;
        const r = Math.max(0, parseInt(color.slice(1, 3), 16) - amt);
        const g = Math.max(0, parseInt(color.slice(3, 5), 16) - amt);
        const b = Math.max(0, parseInt(color.slice(5, 7), 16) - amt);
        return `rgb(${r},${g},${b})`;
    }

    hexToRgba(hex, alpha) {
        if (!hex.startsWith('#')) return hex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // ==================== LOOP ====================

    loop(timestamp) {
        if (this.destroyed) return;
        const dt = timestamp - (this.lastTime || timestamp);
        this.lastTime = timestamp;
        this.update(timestamp, dt);
        this.draw(timestamp);
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) {
            this.lastTime = performance.now();
            this.animId = requestAnimationFrame(t => this.loop(t));
        }
    }

    resize() {
        this.mountains = this.generateMountains();
        this.crosshair.x = this.canvas.width / 2;
        this.crosshair.y = this.canvas.height / 2;
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('click', this.boundClick);
        this.canvas.removeEventListener('contextmenu', this.boundRightClick);
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    }
}