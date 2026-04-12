/* ============================================================
   BOTTLE SHOOTING v2.0 - ULTRA HD MOBILE EDITION
   Crystal Clear Text | DPR Scaled | Zero Blur
   Premium Feel | Real Game Mechanics | Mobile-First
   ============================================================ */

'use strict';

class BottleShooting {
    constructor(canvas, onScore, options = {}) {
        this.canvas  = canvas;
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused    = false;
        this.gameOver  = false;

        // ============================================
        // HD RESOLUTION FIX
        // ============================================
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.setupHDCanvas();

        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });

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
        // GAME STATES
        // ============================================
        this.STATE = { WAITING: 0, PLAYING: 1, LEVEL_UP: 2, DEAD: 3 };
        this.state = this.STATE.WAITING;

        // ============================================
        // SCORE
        // ============================================
        this.score     = 0;
        this.bestScore = parseInt(localStorage.getItem('bottle_best_v2') || '0');

        // ============================================
        // LEVEL & AMMO
        // ============================================
        this.level          = 1;
        this.bullets        = 15;
        this.maxBullets     = 15;
        this.bulletsUsed    = 0;
        this.reloadTime     = 0;
        this.reloadDuration = 1500;
        this.reloading      = false;
        this.accuracy       = 0;
        this.hits           = 0;
        this.shots          = 0;

        // ============================================
        // CROSSHAIR
        // ============================================
        this.crosshair = {
            x: this.W / 2, y: this.H / 2,
            targetX: this.W / 2, targetY: this.H / 2,
            size: this.isMobile ? 18 : 22,
            pulse: 0, spread: 0
        };

        // ============================================
        // BOTTLES & TARGETS
        // ============================================
        this.bottles       = [];
        this.shelves       = [];
        this.movingTargets = [];
        this.bonusTargets  = [];
        this.bottlesHit    = 0;
        this.totalBottles  = 0;
        this.bonusTimer    = 0;
        this.bonusInterval = 6000;

        // ============================================
        // COMBO & STREAK
        // ============================================
        this.combo        = 0;
        this.comboTimer   = 0;
        this.streak       = 0;
        this.streakRecord = 0;

        // ============================================
        // WIND
        // ============================================
        this.wind       = 0;
        this.windTimer  = 0;
        this.windTarget = 0;

        // ============================================
        // SCOPE
        // ============================================
        this.scopeMode  = false;
        this.scopeAlpha = 0;

        // ============================================
        // VISUAL FX
        // ============================================
        this.particles    = [];
        this.glassShards  = [];
        this.splashes     = [];
        this.bulletTrails = [];
        this.hitMarkers   = [];
        this.missMarkers  = [];
        this.scorePopups  = [];
        this.floatingTexts = [];
        this.popRings     = [];

        this.MAX_PARTICLES = this.isMobile ? 60 : 120;
        this.MAX_POP_RINGS = 10;

        // Screen effects
        this.shakeX = 0; this.shakeY = 0;
        this.shakeTimer = 0; this.shakeForce = 0;
        this.flashAlpha = 0; this.flashColor = '#fff';
        this.deathOverlayAlpha = 0;
        this.levelUpTimer = 0;

        // Timing
        this.time  = 0;
        this.frame = 0;
        this.bgTime = 0;

        // ============================================
        // BACKGROUND
        // ============================================
        this.stars     = this.makeStars(this.isMobile ? 35 : 55);
        this.mountains = this.generateMountains();
        this.trees     = this.generateTrees();

        // Init
        this.setupLevel();
        this.bindEvents();

        this.lastTime = 0;
        this.animId   = requestAnimationFrame(t => this.loop(t));
    }

    // ============================================================
    // HD CANVAS
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

    loadFonts() {
        if (document.fonts) {
            document.fonts.ready.then(() => {
                if (document.fonts.check('12px Orbitron')) this.FONT_TITLE = 'Orbitron, monospace';
                if (document.fonts.check('12px Rajdhani')) this.FONT_MONO  = 'Rajdhani, sans-serif';
            });
        }
    }

    // ============================================================
    // DPR HELPERS
    // ============================================================
    dX(x)  { return Math.round(x * this.dpr); }
    dY(y)  { return Math.round(y * this.dpr); }
    dS(s)  { return s * this.dpr; }
    dSr(s) { return Math.round(s * this.dpr); }

    // ============================================================
    // CRISP TEXT
    // ============================================================
    drawText(ctx, text, x, y, opts = {}) {
        const {
            size = 14, weight = 'bold', color = '#FFFFFF',
            align = 'left', baseline = 'alphabetic', family = null,
            glow = false, glowColor = null, glowBlur = 0,
            stroke = false, strokeColor = 'rgba(0,0,0,0.7)', strokeWidth = 3,
            opacity = 1, maxWidth = 0
        } = opts;

        ctx.save();
        ctx.globalAlpha  = opacity;
        ctx.textAlign    = align;
        ctx.textBaseline = baseline;
        ctx.font = `${weight} ${Math.round(size * this.dpr)}px ${family || (size > 16 ? this.FONT_TITLE : this.FONT_UI)}`;

        const px = this.dX(x);
        const py = this.dY(y);
        const mw = maxWidth ? this.dS(maxWidth) : undefined;

        if (stroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth   = strokeWidth * this.dpr;
            ctx.lineJoin    = 'round';
            ctx.miterLimit  = 2;
            ctx.strokeText(text, px, py, mw);
        }

        if (glow && glowBlur > 0) {
            ctx.shadowBlur  = glowBlur * this.dpr;
            ctx.shadowColor = glowColor || color;
            ctx.fillStyle   = glowColor || color;
            ctx.globalAlpha = opacity * 0.45;
            ctx.fillText(text, px, py, mw);
        }

        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = opacity;
        ctx.fillStyle   = color;
        ctx.fillText(text, px, py, mw);

        ctx.restore();
    }

    // ============================================================
    // SHAPE HELPERS
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
        ctx.arcTo(dx + dw, dy,      dx + dw, dy + dh, dr);
        ctx.arcTo(dx + dw, dy + dh, dx,      dy + dh, dr);
        ctx.arcTo(dx,      dy + dh, dx,      dy,      dr);
        ctx.arcTo(dx,      dy,      dx + dw, dy,      dr);
        ctx.closePath();
    }

    drawLine(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(this.dX(x1), this.dY(y1));
        ctx.lineTo(this.dX(x2), this.dY(y2));
    }

    // ============================================================
    // BACKGROUND GENERATION
    // ============================================================
    generateMountains() {
        const mts = [];
        let x = 0;
        while (x < this.W + 100) {
            mts.push({ x, h: Math.random() * 100 + 50 });
            x += Math.random() * 70 + 35;
        }
        return mts;
    }

    generateTrees() {
        const trees = [];
        for (let i = 0; i < 12; i++) {
            trees.push({
                x:    Math.random() * this.W,
                h:    Math.random() * 45 + 25,
                type: Math.floor(Math.random() * 3)
            });
        }
        return trees;
    }

    makeStars(count) {
        return Array.from({ length: count }, () => ({
            x:     Math.random() * this.W,
            y:     Math.random() * this.H * 0.6,
            size:  Math.random() * 1.4 + 0.3,
            phase: Math.random() * 6.28,
            speed: Math.random() * 0.015 + 0.005,
            color: '#ffffff'
        }));
    }

    // ============================================================
    // LEVEL SETUP
    // ============================================================
    setupLevel() {
        this.bottles       = [];
        this.shelves       = [];
        this.movingTargets = [];
        this.bottlesHit    = 0;
        this.streak        = 0;
        this.reloading     = false;
        this.reloadTime    = 0;

        const shelfCount = Math.min(1 + Math.floor(this.level / 2), 3);
        const shelfYs    = [this.H * 0.38, this.H * 0.55, this.H * 0.68];

        for (let s = 0; s < shelfCount; s++) {
            const shelfY      = shelfYs[s];
            const bottleCount = Math.min(4 + this.level, this.isSmallScreen ? 8 : 12);
            this.shelves.push({ y: shelfY });

            const spacing = (this.W - 80) / Math.max(bottleCount - 1, 1);

            for (let b = 0; b < bottleCount; b++) {
                const type = this.getBottleType();
                this.bottles.push({
                    x: 40 + b * spacing,
                    y: shelfY,
                    type,
                    ...this.getBottleData(type),
                    alive: true, hit: false,
                    shimmer: Math.random() * 6.28,
                    wobble: 0,
                    wobbleSpeed: (Math.random() - 0.5) * 0.02,
                    scale: 0
                });
                this.totalBottles++;
            }
        }

        // Moving targets from level 3+
        if (this.level >= 3) {
            const moveCount = Math.min(this.level - 2, 4);
            for (let m = 0; m < moveCount; m++) {
                this.movingTargets.push({
                    x: Math.random() * (this.W - 60) + 30,
                    y: this.H * 0.25,
                    w: 36, h: 36,
                    vx: (Math.random() > 0.5 ? 1 : -1) * (1 + this.level * 0.2),
                    alive: true, shimmer: 0
                });
            }
        }

        // Scale-in bottles
        this.bottles.forEach((b, i) => {
            setTimeout(() => { b.scale = 1; }, i * 50 + 150);
        });
    }

    getBottleType() {
        const r = Math.random();
        if (r < 0.05)  return 'golden';
        if (r < 0.12)  return 'explosive';
        if (r < 0.22)  return 'bonus';
        return 'normal';
    }

    getBottleData(type) {
        const bw = this.isSmallScreen ? 14 : 18;
        const bh = this.isSmallScreen ? 38 : 48;
        const data = {
            normal:    { color: this.randomBottleColor(), points: 10,  w: bw,   h: bh     },
            bonus:     { color: '#00FF88', points: 30,  w: bw+2, h: bh + 4  },
            golden:    { color: '#FFD700', points: 100, w: bw+4, h: bh + 7  },
            explosive: { color: '#FF4400', points: 50,  w: bw+4, h: bh + 2  }
        };
        return data[type] || data.normal;
    }

    randomBottleColor() {
        const colors = ['#00AA88','#22CCAA','#0088AA','#AA4400','#884422','#4488AA','#AA8844'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // ============================================================
    // EVENTS
    // ============================================================
    bindEvents() {
        this.boundMouseMove  = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.crosshair.targetX = (e.clientX - rect.left) * (this.W / rect.width);
            this.crosshair.targetY = (e.clientY - rect.top)  * (this.H / rect.height);
        };
        this.boundClick = (e) => {
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            if (this.state !== this.STATE.PLAYING) return;
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (this.W / rect.width);
            const my = (e.clientY - rect.top)  * (this.H / rect.height);
            this.shoot(mx, my);
        };
        this.boundRightClick = (e) => {
            e.preventDefault();
            this.scopeMode = !this.scopeMode;
        };
        this.boundTouchStart = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.touches[0].clientX - rect.left) * (this.W / rect.width);
            const my = (e.touches[0].clientY - rect.top)  * (this.H / rect.height);
            this.crosshair.x = mx; this.crosshair.y = my;
            this.crosshair.targetX = mx; this.crosshair.targetY = my;
            if (this.state === this.STATE.WAITING) { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            if (this.state !== this.STATE.PLAYING) return;
            setTimeout(() => this.shoot(mx, my), 50);
        };
        this.boundTouchMove = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.crosshair.targetX = (e.touches[0].clientX - rect.left) * (this.W / rect.width);
            this.crosshair.targetY = (e.touches[0].clientY - rect.top)  * (this.H / rect.height);
        };

        this.canvas.addEventListener('mousemove',   this.boundMouseMove);
        this.canvas.addEventListener('click',       this.boundClick);
        this.canvas.addEventListener('contextmenu', this.boundRightClick);
        this.canvas.addEventListener('touchstart',  this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove',   this.boundTouchMove,  { passive: false });
    }

    // ============================================================
    // SHOOTING
    // ============================================================
    shoot(mx, my) {
        if (this.reloading || this.bullets <= 0) { this.startReload(); return; }

        this.bullets--;
        this.shots++;
        this.bulletsUsed++;
        this.crosshair.spread = 15;

        const spread = this.scopeMode ? 2 : 8;
        const bx = mx + (Math.random() - 0.5) * spread;
        const by = my + (Math.random() - 0.5) * spread + this.wind * 5;

        this.bulletTrails.push({
            startX: this.W / 2, startY: this.H - 30,
            endX: bx, endY: by,
            progress: 0, opacity: 1
        });

        if (window.audioManager) audioManager.play('shoot');

        let hitSomething = false;

        // Check moving targets
        for (let i = this.movingTargets.length - 1; i >= 0; i--) {
            const t = this.movingTargets[i];
            if (!t.alive) continue;
            if (bx > t.x - t.w/2 && bx < t.x + t.w/2 &&
                by > t.y - t.h/2 && by < t.y + t.h/2) {
                this.hitMovingTarget(t, i, bx, by);
                hitSomething = true; break;
            }
        }

        // Check bonus targets
        if (!hitSomething) {
            for (let i = this.bonusTargets.length - 1; i >= 0; i--) {
                const t = this.bonusTargets[i];
                if (bx > t.x - t.r && bx < t.x + t.r && by > t.y - t.r && by < t.y + t.r) {
                    this.hitBonusTarget(t, i, bx, by);
                    hitSomething = true; break;
                }
            }
        }

        // Check bottles
        if (!hitSomething) {
            for (let i = this.bottles.length - 1; i >= 0; i--) {
                const b = this.bottles[i];
                if (!b.alive) continue;
                const bTop = b.y - b.h;
                if (bx > b.x - b.w/2 - 5 && bx < b.x + b.w/2 + 5 &&
                    by > bTop - 5           && by < b.y + 5) {
                    this.hitBottle(b, i, bx, by);
                    hitSomething = true; break;
                }
            }
        }

        if (!hitSomething) {
            this.streak = 0; this.combo = 0; this.comboTimer = 0;
            this.missMarkers.push({ x: bx, y: by, life: 1, decay: 0.04 });
            this.spawnMissParticles(bx, by);
            this.shake(3, 2);
        }

        this.hits     = this.shots > 0 ? this.shots - this.missMarkers.length : 0;
        this.accuracy = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;

        if (this.bullets <= 0) this.startReload();

        // Level complete
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
        const comboBonus  = Math.min(this.combo  - 1, 10) * 3;
        const scopeBonus  = this.scopeMode ? 2 : 1;
        let   gained      = (bottle.points + streakBonus + comboBonus) * scopeBonus;

        bottle.alive = false;
        bottle.hit   = true;
        this.bottlesHit++;
        this.score  += gained;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bottle_best_v2', this.bestScore);
        }
        this.onScore(this.score);

        if (bottle.type === 'explosive') {
            this.triggerBottleExplosion(bottle, idx);
            gained += 50; this.score += 50;
            this.onScore(this.score);
        } else {
            this.spawnGlassShards(bottle.x, bottle.y, bottle.color);
            this.spawnLiquidSplash(bottle.x, bottle.y, bottle.color);
        }

        const label = this.streak > 3 ? `${this.streak}x STREAK! +${gained}` : `+${gained}`;
        const col   = this.streak > 3 ? '#FF8C00' : this.combo > 3 ? '#FFD700' : bottle.color;

        this.scorePopups.push({
            x: bottle.x, y: bottle.y - 30,
            text: label, color: col,
            life: 1200, opacity: 1
        });

        if (this.popRings.length < this.MAX_POP_RINGS) {
            this.popRings.push({ x: bx, y: by, radius: 5, opacity: 0.7, color: col });
        }

        this.shake(bottle.type === 'golden' ? 8 : 4, bottle.type === 'golden' ? 6 : 3);
        if (this.streak >= 3) { this.flashAlpha = 0.1; this.flashColor = '#FFD700'; }
        if (window.audioManager) audioManager.play('pop');
    }

    triggerBottleExplosion(bottle, idx) {
        const cx = bottle.x;
        const cy = bottle.y - bottle.h / 2;
        const radius = 80;

        for (let i = this.bottles.length - 1; i >= 0; i--) {
            if (i === idx || !this.bottles[i].alive) continue;
            const b    = this.bottles[i];
            const dist = Math.sqrt((b.x - cx)**2 + ((b.y - b.h/2) - cy)**2);
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

        for (let i = 0; i < 15 && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 3;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 5,
                size: Math.random() * 6 + 3,
                life: 1, decay: 0.025, color: '#FF8C00', grav: 0.2
            });
        }

        this.shake(18, 12);
        this.flashAlpha = 0.35; this.flashColor = '#FF8C00';
        if (window.audioManager) audioManager.play('levelUp');
    }

    hitMovingTarget(target, idx, bx, by) {
        target.alive = false;
        this.hits++;
        this.streak++;
        this.streakRecord = Math.max(this.streakRecord, this.streak);

        const gained = 40 * this.level;
        this.score  += gained;
        this.onScore(this.score);

        this.spawnGlassShards(target.x, target.y, '#88AAFF', 12);
        this.scorePopups.push({
            x: target.x, y: target.y - 20,
            text: `TARGET +${gained}!`, color: '#00D4FF',
            life: 1500, opacity: 1
        });
        this.shake(6, 4);
        if (window.audioManager) audioManager.play('success');
    }

    hitBonusTarget(target, idx, bx, by) {
        this.bonusTargets.splice(idx, 1);
        this.hits++;
        this.streak += 3;

        const gained = target.points;
        this.score  += gained;
        this.onScore(this.score);

        this.spawnGlassShards(target.x, target.y, target.color, 15);
        this.scorePopups.push({
            x: target.x, y: target.y - 20,
            text: `BONUS! +${gained}`, color: '#FFD700',
            life: 2000, opacity: 1
        });
        this.flashAlpha = 0.22; this.flashColor = '#FFD700';
        this.shake(10, 6);
        if (window.audioManager) audioManager.play('levelUp');
    }

    startReload() {
        if (this.reloading) return;
        this.reloading  = true;
        this.reloadTime = this.reloadDuration;
        if (window.audioManager) audioManager.play('fail');
    }

    triggerLevelComplete() {
        if (this.state === this.STATE.LEVEL_UP) return;
        this.state       = this.STATE.LEVEL_UP;
        this.levelUpTimer = 2200;

        const acc   = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
        const bonus = acc * 2 + this.level * 50;
        this.score += bonus;
        this.onScore(this.score);

        this.flashAlpha = 0.35; this.flashColor = '#00FF88';
        this.shake(12, 7);
        this.addFloatingText(this.W/2, this.H/2 - 10, 'STAGE CLEAR!', '#00FF88', 26, 130);
        this.addFloatingText(this.W/2, this.H/2 + 25, `+${bonus} bonus!`, '#FFD700', 14, 110);
        if (window.audioManager) audioManager.play('levelUp');
    }

    restartGame() {
        this.score = 0; this.onScore(0);
        this.state = this.STATE.WAITING; this.gameOver = false;
        this.level = 1; this.bullets = this.maxBullets; this.bulletsUsed = 0;
        this.bottlesHit = 0; this.totalBottles = 0;
        this.shots = 0; this.hits = 0; this.streak = 0; this.combo = 0;
        this.deathOverlayAlpha = 0; this.flashAlpha = 0; this.reloading = false;
        this.particles = []; this.glassShards = []; this.splashes = [];
        this.bulletTrails = []; this.hitMarkers = []; this.missMarkers = [];
        this.scorePopups = []; this.floatingTexts = []; this.bonusTargets = [];
        this.popRings = [];
        this.setupLevel();
    }

    // ============================================================
    // FX HELPERS
    // ============================================================
    spawnGlassShards(x, y, color, count = 10) {
        for (let i = 0; i < count && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 2;
            this.glassShards.push({
                x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 4,
                w: Math.random() * 7 + 3, h: Math.random() * 4 + 2,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                life: 1, decay: 0.025, color, grav: 0.25
            });
        }
    }

    spawnLiquidSplash(x, y, color) {
        for (let i = 0; i < 12 && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 1;
            this.splashes.push({
                x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
                r: Math.random() * 5 + 2,
                life: 1, decay: 0.03, color, grav: 0.18
            });
        }
    }

    spawnMissParticles(x, y) {
        for (let i = 0; i < 5 && this.particles.length < this.MAX_PARTICLES; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                size: Math.random() * 3 + 1,
                life: 1, decay: 0.06, color: '#444', grav: 0.05
            });
        }
    }

    addFloatingText(x, y, text, color, size = 16, life = 80) {
        this.floatingTexts.push({ x, y, text, color, size, life, opacity: 1, scale: 0.3 });
    }

    shake(timer, force) { this.shakeTimer = timer; this.shakeForce = force; }

    fmtNum(n) {
        if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
        return '' + n;
    }

    // ============================================================
    // UPDATE
    // ============================================================
    update(timestamp, dt) {
        if (this.paused || this.gameOver) return;

        this.time   += dt;
        this.frame++;
        this.bgTime += dt * 0.001;

        this.stars.forEach(s => { s.phase += s.speed; });

        // Shake
        if (this.shakeTimer > 0) {
            const f = this.shakeForce * (this.shakeTimer / 15);
            this.shakeX = (Math.random() - 0.5) * f;
            this.shakeY = (Math.random() - 0.5) * f * 0.4;
            this.shakeTimer--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.035);

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
                this.state     = this.STATE.PLAYING;
                this.bullets   = this.maxBullets;
                this.shots     = 0;
                this.hits      = 0;
                this.streak    = 0;
                this.reloading = false;
                this.bonusTargets = [];
                this.setupLevel();
            }
            this.updateFX(dt);
            return;
        }

        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, this.deathOverlayAlpha + 0.014);
            this.updateFX(dt);
            return;
        }

        // Reload
        if (this.reloading) {
            this.reloadTime -= dt;
            if (this.reloadTime <= 0) {
                this.reloading = false;
                this.bullets   = this.maxBullets;
                this.flashAlpha = 0.08; this.flashColor = '#00FF88';
            }
        }

        // Wind
        this.windTimer += dt;
        if (this.windTimer > 3000) {
            this.windTimer  = 0;
            this.windTarget = (Math.random() - 0.5) * (this.level > 5 ? 3 : 1.5);
        }
        this.wind += (this.windTarget - this.wind) * 0.01;

        // Bottles animation
        this.bottles.forEach(b => {
            b.shimmer += 0.04;
            b.wobble  += b.wobbleSpeed;
            b.scale    = Math.min(1, b.scale + 0.08);
        });

        // Moving targets
        this.movingTargets.forEach(t => {
            if (!t.alive) return;
            t.x       += t.vx;
            t.shimmer += 0.05;
            if (t.x < 20 || t.x > this.W - 20) t.vx *= -1;
        });

        // Bonus target spawn
        this.bonusTimer += dt;
        if (this.bonusTimer >= this.bonusInterval && this.bonusTargets.length < 2) {
            this.bonusTimer = 0;
            this.bonusTargets.push({
                x: Math.random() * (this.W - 80) + 40,
                y: this.H * 0.2,
                r: 20,
                vx: (Math.random() > 0.5 ? 1 : -1) * 2,
                vy: (Math.random() > 0.5 ? 1 : -1) * 0.5,
                color: '#FFD700', points: 150,
                pulse: 0, timer: 4000
            });
        }

        for (let i = this.bonusTargets.length - 1; i >= 0; i--) {
            const t = this.bonusTargets[i];
            t.x += t.vx; t.y += t.vy; t.pulse += 0.1; t.timer -= dt;
            if (t.x < t.r || t.x > this.W - t.r) t.vx *= -1;
            if (t.y < t.r || t.y > this.H * 0.4)  t.vy *= -1;
            if (t.timer <= 0) this.bonusTargets.splice(i, 1);
        }

        // Combo timer
        if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }

        // Bullet trails
        this.bulletTrails = this.bulletTrails.filter(t => {
            t.progress += 0.08; t.opacity -= 0.06;
            return t.opacity > 0;
        });

        // Markers
        this.hitMarkers  = this.hitMarkers.filter(h  => { h.life -= h.decay; return h.life > 0; });
        this.missMarkers = this.missMarkers.filter(h => { h.life -= h.decay; return h.life > 0; });

        this.updateFX(dt);

        // Out of ammo check
        if (!this.reloading && this.bullets <= 0) {
            const alive = this.bottles.filter(b => b.alive).length + this.movingTargets.filter(t => t.alive).length;
            if (alive > 0 && this.bulletsUsed >= this.maxBullets * 3) {
                this.gameOver = true;
                this.state    = this.STATE.DEAD;
                setTimeout(() => this.onScore(this.score, true), 1200);
                if (window.audioManager) audioManager.play('gameOver');
            }
        }
    }

    updateFX(dt) {
        const upd = (arr) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                const p = arr[i];
                p.x += p.vx || 0; p.y += p.vy || 0;
                p.vy += p.grav || 0; p.vx *= 0.97;
                p.life -= p.decay;
                if (p.size) p.size *= 0.96;
                if (p.rotation !== undefined) p.rotation += p.rotSpeed || 0;
                if (p.life <= 0 || (p.size !== undefined && p.size < 0.3)) arr.splice(i, 1);
            }
        };
        upd(this.particles);
        upd(this.glassShards);
        upd(this.splashes);

        for (let i = this.popRings.length - 1; i >= 0; i--) {
            this.popRings[i].radius  += 2.5;
            this.popRings[i].opacity -= 0.04;
            if (this.popRings[i].opacity <= 0) this.popRings.splice(i, 1);
        }

        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= dt; p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 0.6; t.life -= 1;
            t.opacity = Math.min(1, t.life / 30);
            t.scale  += (1 - t.scale) * 0.12;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    // ============================================================
    // DRAW — MAIN
    // ============================================================
    draw(timestamp) {
        const ctx = this.ctx;

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.shakeX || this.shakeY)
            ctx.translate(this.dS(this.shakeX), this.dS(this.shakeY));

        this.drawBackground(ctx, timestamp);
        this.drawShelves(ctx);
        this.drawBottles(ctx, timestamp);
        this.drawMovingTargets(ctx, timestamp);
        this.drawBonusTargets(ctx, timestamp);
        this.drawGlassShardsFX(ctx);
        this.drawSplashesFX(ctx);
        this.drawParticlesFX(ctx);
        this.drawPopRingsFX(ctx);
        this.drawBulletTrailsFX(ctx);
        this.drawMissMarkersFX(ctx);
        this.drawScorePopupsFX(ctx);
        this.drawFloatingTextsFX(ctx);

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.scopeAlpha > 0) this.drawScope(ctx, timestamp);
        this.drawCrosshair(ctx, timestamp);
        this.drawHUD(ctx, timestamp);

        if (this.state === this.STATE.WAITING)  this.drawWaiting(ctx, timestamp);
        if (this.state === this.STATE.LEVEL_UP) this.drawLevelUp(ctx, timestamp);
        if (this.state === this.STATE.DEAD)     this.drawDeathScreen(ctx, timestamp);

        ctx.restore();
    }

    // ============================================================
    // DRAW: BACKGROUND
    // ============================================================
    drawBackground(ctx, timestamp) {
        const W = this.W, H = this.H;
        const night = this.level > 5;

        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.dY(H * 0.72));
        skyGrad.addColorStop(0, night ? '#0a0520' : '#0a1a3a');
        skyGrad.addColorStop(1, night ? '#200a30' : '#152a4a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        for (const s of this.stars) {
            const alpha = 0.2 + ((Math.sin(s.phase) + 1) / 2) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = s.color;
            this.drawCircle(ctx, s.x, s.y, s.size);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Moon
        const moonX = W * 0.8, moonY = H * 0.12;
        ctx.save();
        ctx.shadowBlur  = this.dS(18);
        ctx.shadowColor = night ? '#fffde0' : '#FFE4A0';
        ctx.fillStyle   = night ? '#fffde0' : '#FFE4A0';
        this.drawCircle(ctx, moonX, moonY, 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Mountains far
        ctx.fillStyle = night ? '#151025' : '#1a2540';
        ctx.beginPath();
        ctx.moveTo(0, this.dY(H * 0.7));
        this.mountains.forEach(m => ctx.lineTo(this.dX(m.x), this.dY(H * 0.7 - m.h * 0.6)));
        ctx.lineTo(this.dX(W), this.dY(H * 0.7));
        ctx.closePath();
        ctx.fill();

        // Mountains near
        ctx.fillStyle = night ? '#0f0820' : '#142035';
        ctx.beginPath();
        ctx.moveTo(0, this.dY(H * 0.72));
        this.mountains.forEach(m => ctx.lineTo(this.dX(m.x + 20), this.dY(H * 0.72 - m.h * 0.9)));
        ctx.lineTo(this.dX(W), this.dY(H * 0.72));
        ctx.closePath();
        ctx.fill();

        // Ground
        const gGrad = ctx.createLinearGradient(0, this.dY(H*0.72), 0, this.dY(H));
        gGrad.addColorStop(0,   night ? '#1a0a30' : '#1a2a10');
        gGrad.addColorStop(0.3, night ? '#120820' : '#152208');
        gGrad.addColorStop(1,   night ? '#080310' : '#0a1205');
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, this.dY(H * 0.72), this.canvas.width, this.dSr(H * 0.28));

        // Trees
        this.trees.forEach(t => {
            ctx.fillStyle = night ? '#0a0518' : '#0f1a08';
            const tx = this.dX(t.x);
            const ty = this.dY(H * 0.72);
            const th = this.dS(t.h);

            if (t.type === 0) {
                ctx.beginPath();
                ctx.moveTo(tx, ty - th);
                ctx.lineTo(tx - th*0.35, ty);
                ctx.lineTo(tx + th*0.35, ty);
                ctx.closePath();
                ctx.fill();
            } else if (t.type === 1) {
                ctx.fillRect(tx - this.dS(4), ty - th, this.dS(8), th * 0.5);
                ctx.beginPath();
                ctx.arc(tx, ty - th*0.7, th*0.4, 0, Math.PI*2);
                ctx.fill();
            } else {
                for (let l = 0; l < 3; l++) {
                    ctx.beginPath();
                    ctx.moveTo(tx, ty - th + this.dS(l*12));
                    ctx.lineTo(tx - th*0.3, ty - th*0.4 + this.dS(l*15));
                    ctx.lineTo(tx + th*0.3, ty - th*0.4 + this.dS(l*15));
                    ctx.closePath();
                    ctx.fill();
                }
            }
        });
    }

    // ============================================================
    // DRAW: SHELVES
    // ============================================================
    drawShelves(ctx) {
        this.shelves.forEach(shelf => {
            const sg = ctx.createLinearGradient(0, this.dY(shelf.y), this.dX(this.W), this.dY(shelf.y + 8));
            sg.addColorStop(0,   '#3a2a1a');
            sg.addColorStop(0.5, '#6a4a2a');
            sg.addColorStop(1,   '#3a2a1a');
            ctx.fillStyle = sg;
            ctx.fillRect(this.dX(20), this.dY(shelf.y), this.dSr(this.W - 40), this.dSr(8));

            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(this.dX(20), this.dY(shelf.y), this.dSr(this.W - 40), this.dSr(2));

            // Legs
            ctx.fillStyle = '#4a3a2a';
            ctx.fillRect(this.dX(30), this.dY(shelf.y + 8), this.dSr(10), this.dSr(22));
            ctx.fillRect(this.dX(this.W - 40), this.dY(shelf.y + 8), this.dSr(10), this.dSr(22));
        });
    }

    // ============================================================
    // DRAW: BOTTLES
    // ============================================================
    drawBottles(ctx, timestamp) {
        this.bottles.forEach(b => {
            if (!b.alive) return;
            const wobble = Math.sin(b.wobble) * 1.5;
            const shimA  = 0.15 + Math.sin(b.shimmer) * 0.08;

            ctx.save();
            ctx.translate(this.dX(b.x + wobble), this.dY(b.y));
            ctx.scale(b.scale, b.scale);

            // Glow
            if (b.type !== 'normal') {
                const gc = b.type === 'golden' ? '#FFD700' : b.type === 'explosive' ? '#FF4400' : '#00FF88';
                ctx.shadowBlur  = this.dS(b.type === 'explosive' ? 10 + Math.sin(b.shimmer*2)*4 : 12);
                ctx.shadowColor = gc;
            }

            this.drawBottleShape(ctx, b, shimA);
            ctx.restore();
        });
    }

    drawBottleShape(ctx, b, shimA) {
        const w = this.dS(b.w);
        const h = this.dS(b.h);

        // Body
        const bg = ctx.createLinearGradient(-w/2, -h, w/2, 0);
        bg.addColorStop(0,   this.lightenColor(b.color, 55));
        bg.addColorStop(0.3, b.color);
        bg.addColorStop(0.7, this.darkenColor(b.color, 30));
        bg.addColorStop(1,   this.darkenColor(b.color, 50));

        ctx.globalAlpha = 0.85;
        ctx.fillStyle   = bg;
        ctx.beginPath();
        ctx.moveTo(-w/2, 0);
        ctx.quadraticCurveTo(-w/2, -h*0.3, -w*0.4, -h*0.65);
        ctx.lineTo(-w*0.2, -h*0.75);
        ctx.lineTo(-w*0.15, -h);
        ctx.lineTo(w*0.15, -h);
        ctx.lineTo(w*0.2, -h*0.75);
        ctx.lineTo(w*0.4, -h*0.65);
        ctx.quadraticCurveTo(w/2, -h*0.3, w/2, 0);
        ctx.closePath();
        ctx.fill();

        // Liquid
        const lH = h * 0.72;
        const lg = ctx.createLinearGradient(0, -lH, 0, 0);
        lg.addColorStop(0, this.lightenColor(b.color, 25) + 'CC');
        lg.addColorStop(1, b.color + 'AA');
        ctx.fillStyle   = lg;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(-w/2+this.dS(2), 0);
        ctx.quadraticCurveTo(-w/2+this.dS(2), -lH*0.3, -w*0.38, -lH);
        ctx.lineTo(w*0.38, -lH);
        ctx.quadraticCurveTo(w/2-this.dS(2), -lH*0.3, w/2-this.dS(2), 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Glass shine
        const sg = ctx.createLinearGradient(-w/2, -h, -w*0.1, 0);
        sg.addColorStop(0, `rgba(255,255,255,${shimA + 0.18})`);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(-w*0.42, 0);
        ctx.quadraticCurveTo(-w*0.42, -h*0.3, -w*0.35, -h*0.65);
        ctx.lineTo(-w*0.15, -h*0.65);
        ctx.lineTo(-w*0.2, -h*0.3);
        ctx.quadraticCurveTo(-w*0.2, 0, -w*0.42, 0);
        ctx.closePath();
        ctx.fill();

        // Neck
        ctx.fillStyle   = this.darkenColor(b.color, 20);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-w*0.15, -h, w*0.3, h*0.25);
        ctx.globalAlpha = 1;

        // Cap
        let capCol = '#888';
        if (b.type === 'golden')    capCol = '#FFD700';
        if (b.type === 'explosive') capCol = '#FF4400';
        if (b.type === 'bonus')     capCol = '#00FF88';
        ctx.fillStyle = capCol;
        ctx.fillRect(-w*0.18, -h*1.08, w*0.36, h*0.1);

        ctx.shadowBlur = 0;

        // Type label
        if (b.type !== 'normal') {
            const labels = { golden: '$', bonus: '+', explosive: '!' };
            ctx.save();
            ctx.shadowBlur   = 0;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.font         = `bold ${Math.round(w * 0.55)}px ${this.FONT_TITLE}`;
            ctx.fillStyle    = '#ffffff';
            ctx.globalAlpha  = 0.8;
            ctx.fillText(labels[b.type] || '', 0, -h * 0.42);
            ctx.restore();
        } else {
            // Label strip
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(-w*0.35, -h*0.45, w*0.7, h*0.18);
        }
    }

    // ============================================================
    // DRAW: MOVING TARGETS
    // ============================================================
    drawMovingTargets(ctx, timestamp) {
        this.movingTargets.forEach(t => {
            if (!t.alive) return;

            ctx.save();
            ctx.translate(this.dX(t.x), this.dY(t.y));

            ctx.shadowBlur  = this.dS(9);
            ctx.shadowColor = '#00D4FF';

            // Plate
            const pg = ctx.createRadialGradient(0, 0, this.dS(2), 0, 0, this.dS(t.w/2));
            pg.addColorStop(0,   '#ffffff');
            pg.addColorStop(0.3, '#ddddee');
            pg.addColorStop(0.7, '#aaaacc');
            pg.addColorStop(1,   '#8888aa');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.dS(t.w/2), this.dS(t.h/2), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Rings
            for (let r = 1; r <= 3; r++) {
                ctx.strokeStyle = `rgba(0,150,200,${0.28 - r*0.07})`;
                ctx.lineWidth   = this.dS(1.5);
                ctx.beginPath();
                ctx.ellipse(0, 0, this.dS(t.w/2 * (r/3.5)), this.dS(t.h/2 * (r/3.5)), 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath();
            ctx.ellipse(this.dS(-t.w*0.15), this.dS(-t.h*0.2), this.dS(t.w*0.18), this.dS(t.h*0.13), -0.5, 0, Math.PI * 2);
            ctx.fill();

            // Arrow — crisp text
            const dir = t.vx > 0 ? '>' : '<';
            this.drawText(ctx, dir, t.vx > 0 ? t.w/2 + 8 : -t.w/2 - 8, 2, {
                size: 10, weight: 'bold', color: '#00D4FF',
                align: 'center', baseline: 'middle',
                family: this.FONT_UI
            });

            ctx.restore();
        });
    }

    // ============================================================
    // DRAW: BONUS TARGETS
    // ============================================================
    drawBonusTargets(ctx, timestamp) {
        this.bonusTargets.forEach(t => {
            const pulse     = 0.9 + Math.sin(t.pulse) * 0.14;
            const timeAlpha = Math.min(1, t.timer / 1000);

            ctx.save();
            ctx.translate(this.dX(t.x), this.dY(t.y));
            ctx.scale(pulse, pulse);
            ctx.globalAlpha = timeAlpha;

            // Outer ring
            ctx.save();
            ctx.strokeStyle = `rgba(255,215,0,${0.4 + Math.sin(t.pulse*2)*0.3})`;
            ctx.lineWidth   = this.dS(2.5);
            ctx.shadowBlur  = this.dS(18);
            ctx.shadowColor = '#FFD700';
            ctx.beginPath();
            ctx.arc(0, 0, this.dS(t.r + 5), 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();

            // Body
            const bg = ctx.createRadialGradient(
                this.dS(-t.r*0.3), this.dS(-t.r*0.3), 0,
                0, 0, this.dS(t.r)
            );
            bg.addColorStop(0,   '#FFE866');
            bg.addColorStop(0.5, '#FFD700');
            bg.addColorStop(1,   '#CC8800');
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(0, 0, this.dS(t.r), 0, Math.PI * 2);
            ctx.fill();

            // Star label — crisp
            this.drawText(ctx, '*', 0, t.r * 0.15, {
                size: t.r * 1.1, weight: 'bold', color: '#fff',
                align: 'center', baseline: 'middle',
                family: this.FONT_UI
            });

            // Timer arc
            const pct = t.timer / 4000;
            ctx.strokeStyle = `rgba(255,255,255,${timeAlpha * 0.45})`;
            ctx.lineWidth   = this.dS(2);
            ctx.beginPath();
            ctx.arc(0, 0, this.dS(t.r + 10), -Math.PI/2, -Math.PI/2 + Math.PI * 2 * pct);
            ctx.stroke();

            ctx.restore();
        });
    }

    // ============================================================
    // DRAW: FX
    // ============================================================
    drawGlassShardsFX(ctx) {
        ctx.save();
        for (const s of this.glassShards) {
            ctx.globalAlpha = s.life * 0.65;
            ctx.save();
            ctx.translate(this.dX(s.x), this.dY(s.y));
            ctx.rotate(s.rotation);
            ctx.fillStyle = s.color;
            ctx.fillRect(this.dS(-s.w/2), this.dS(-s.h/2), this.dS(s.w), this.dS(s.h));
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(this.dS(-s.w/2+1), this.dS(-s.h/2), this.dS(s.w*0.3), this.dS(s.h));
            ctx.restore();
        }
        ctx.restore();
    }

    drawSplashesFX(ctx) {
        ctx.save();
        for (const s of this.splashes) {
            ctx.globalAlpha = s.life * 0.65;
            ctx.shadowBlur  = this.dS(3);
            ctx.shadowColor = s.color;
            ctx.fillStyle   = s.color;
            this.drawCircle(ctx, s.x, s.y, s.r * s.life);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    drawParticlesFX(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.min(1, p.life);
            ctx.fillStyle   = p.color;
            this.drawCircle(ctx, p.x, p.y, Math.max(0.5, (p.size || 2) * p.life));
            ctx.fill();
        }
        ctx.restore();
    }

    drawPopRingsFX(ctx) {
        ctx.save();
        for (const r of this.popRings) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth   = this.dS(1.5 * r.opacity);
            this.drawCircle(ctx, r.x, r.y, r.radius);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawBulletTrailsFX(ctx) {
        ctx.save();
        for (const t of this.bulletTrails) {
            const prog = Math.min(1, t.progress);
            const ex   = t.startX + (t.endX - t.startX) * prog;
            const ey   = t.startY + (t.endY - t.startY) * prog;

            ctx.globalAlpha = t.opacity * 0.45;
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth   = this.dS(1.5);
            ctx.setLineDash([this.dS(4), this.dS(4)]);
            ctx.lineDashOffset = -t.progress * 20;
            this.drawLine(ctx, t.startX, t.startY, ex, ey);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }

    drawMissMarkersFX(ctx) {
        ctx.save();
        for (const m of this.missMarkers) {
            ctx.globalAlpha = m.life;
            ctx.strokeStyle = '#FF0055';
            ctx.lineWidth   = this.dS(2);
            ctx.beginPath();
            ctx.moveTo(this.dX(m.x - 7), this.dY(m.y - 7));
            ctx.lineTo(this.dX(m.x + 7), this.dY(m.y + 7));
            ctx.moveTo(this.dX(m.x + 7), this.dY(m.y - 7));
            ctx.lineTo(this.dX(m.x - 7), this.dY(m.y + 7));
            ctx.stroke();
        }
        ctx.restore();
    }

    drawScorePopupsFX(ctx) {
        for (const p of this.scorePopups) {
            this.drawText(ctx, p.text, p.x, p.y, {
                size: 12, weight: 'bold', color: p.color,
                align: 'center', opacity: p.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 2.5,
                glow: true, glowColor: p.color, glowBlur: 5,
                family: this.FONT_TITLE
            });
        }
    }

    drawFloatingTextsFX(ctx) {
        for (const t of this.floatingTexts) {
            const sc = Math.min(1, t.scale || 1);
            this.drawText(ctx, t.text, t.x, t.y, {
                size: (t.size || 16) * sc,
                weight: 'bold', color: t.color,
                align: 'center', baseline: 'middle',
                opacity: t.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.5)', strokeWidth: 3,
                glow: true, glowColor: t.color, glowBlur: 8,
                family: this.FONT_TITLE
            });
        }
    }

    // ============================================================
    // DRAW: SCOPE
    // ============================================================
    drawScope(ctx, timestamp) {
        const cx = this.crosshair.x;
        const cy = this.crosshair.y;
        const r  = 65;

        ctx.save();
        ctx.globalAlpha = this.scopeAlpha;

        // Dark background
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        this.drawCircle(ctx, cx, cy, r);
        ctx.fill();

        // Grid
        ctx.strokeStyle = 'rgba(0,255,136,0.35)';
        ctx.lineWidth   = this.dS(0.5);
        for (let i = -3; i <= 3; i++) {
            this.drawLine(ctx, cx - r, cy + i*(r/3), cx + r, cy + i*(r/3));
            ctx.stroke();
            this.drawLine(ctx, cx + i*(r/3), cy - r, cx + i*(r/3), cy + r);
            ctx.stroke();
        }

        // Cross
        ctx.strokeStyle = 'rgba(0,255,136,0.75)';
        ctx.lineWidth   = this.dS(1);
        this.drawLine(ctx, cx - r, cy, cx + r, cy); ctx.stroke();
        this.drawLine(ctx, cx, cy - r, cx, cy + r); ctx.stroke();

        // Ring
        ctx.save();
        ctx.shadowBlur  = this.dS(7);
        ctx.shadowColor = '#00FF88';
        ctx.strokeStyle = 'rgba(0,255,136,0.55)';
        ctx.lineWidth   = this.dS(2);
        this.drawCircle(ctx, cx, cy, r);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.restore();
    }

    // ============================================================
    // DRAW: CROSSHAIR
    // ============================================================
    drawCrosshair(ctx, timestamp) {
        const cx    = this.crosshair.x;
        const cy    = this.crosshair.y;
        const size  = this.crosshair.size + this.crosshair.spread;
        const pulse = Math.sin(this.crosshair.pulse) * 2;
        const color = this.reloading ? '#FFD700' : this.scopeMode ? '#00FF88' : '#FF0055';

        ctx.save();
        ctx.shadowBlur  = this.dS(8);
        ctx.shadowColor = color;

        const gap = 6 + this.crosshair.spread * 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth   = this.dS(2);

        // H lines
        this.drawLine(ctx, cx - size, cy, cx - gap, cy); ctx.stroke();
        this.drawLine(ctx, cx + gap,  cy, cx + size, cy); ctx.stroke();
        // V lines
        this.drawLine(ctx, cx, cy - size, cx, cy - gap); ctx.stroke();
        this.drawLine(ctx, cx, cy + gap,  cx, cy + size); ctx.stroke();

        // Center dot
        ctx.fillStyle = color;
        this.drawCircle(ctx, cx, cy, 2);
        ctx.fill();

        // Outer circle
        ctx.strokeStyle = `rgba(255,0,85,0.25)`;
        ctx.lineWidth   = this.dS(1);
        this.drawCircle(ctx, cx, cy, size + 5 + pulse);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();

        // Wind indicator — crisp text
        if (Math.abs(this.wind) > 0.3) {
            const dir = this.wind > 0 ? '>' : '<';
            const val = Math.abs(this.wind).toFixed(1);
            this.drawText(ctx, `${dir} ${val}`, cx, cy - size - 14, {
                size: 9, color: 'rgba(255,200,0,0.75)',
                align: 'center', family: this.FONT_MONO
            });
        }
    }

    // ============================================================
    // DRAW: HUD
    // ============================================================
    drawHUD(ctx, timestamp) {
        const W = this.W, H = this.H;

        // Top bar
        const hg = ctx.createLinearGradient(0, 0, 0, this.dY(44));
        hg.addColorStop(0, 'rgba(0,0,0,0.72)');
        hg.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, 0, this.canvas.width, this.dY(44));

        ctx.strokeStyle = 'rgba(255,215,0,0.12)';
        ctx.lineWidth   = this.dS(0.5);
        this.drawLine(ctx, 0, 44, W, 44);
        ctx.stroke();

        // Score
        this.drawText(ctx, this.fmtNum(this.score), 12, 22, {
            size: 15, weight: 'bold', color: '#ffffff',
            family: this.FONT_TITLE,
            glow: true, glowColor: '#FFD700', glowBlur: 5
        });
        if (this.bestScore > 0) {
            this.drawText(ctx, `BEST: ${this.fmtNum(this.bestScore)}`, 12, 36, {
                size: 8, color: 'rgba(255,215,0,0.45)', family: this.FONT_MONO
            });
        }

        // Level
        this.drawText(ctx, `LEVEL ${this.level}`, W/2, 20, {
            size: 13, weight: 'bold', color: '#cc66ff',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#b347d9', glowBlur: 4
        });

        // Accuracy
        const acc    = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
        const accCol = acc > 70 ? '#00FF88' : acc > 40 ? '#FFD700' : '#FF0055';
        this.drawText(ctx, `${acc}%`, W/2, 36, {
            size: 10, color: accCol, align: 'center', family: this.FONT_MONO
        });

        // Streak
        if (this.streak >= 3) {
            const sf = 0.7 + Math.sin(this.time / 200) * 0.3;
            this.drawText(ctx, `${this.streak}x STREAK`, W/2, 52, {
                size: 10, weight: 'bold', color: '#FF8C00',
                align: 'center', opacity: sf,
                glow: true, glowColor: '#FF8C00', glowBlur: 5,
                family: this.FONT_TITLE
            });
        }

        // Bullets (right side)
        for (let i = 0; i < this.maxBullets; i++) {
            const bx     = W - 14 - i * (this.isMobile ? 14 : 16);
            const has    = i < this.bullets;
            ctx.fillStyle = has ? '#FFD700' : 'rgba(100,80,0,0.25)';
            if (has) { ctx.shadowBlur = this.dS(4); ctx.shadowColor = '#FFD700'; }
            this.drawRoundRect(ctx, bx - 3, H - 44, 6, 16, 3);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Reload bar
        if (this.reloading) {
            const pct = 1 - (this.reloadTime / this.reloadDuration);
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            this.drawRoundRect(ctx, W/2 - 58, H - 24, 116, 12, 5);
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            this.drawRoundRect(ctx, W/2 - 58, H - 24, 116 * pct, 12, 5);
            ctx.fill();

            this.drawText(ctx, 'RELOADING...', W/2, H - 15, {
                size: 8, weight: 'bold', color: '#ffffff',
                align: 'center', family: this.FONT_TITLE
            });
        } else {
            this.drawText(ctx, this.scopeMode ? 'SCOPE ON' : 'Right Click = Scope', W/2, H - 12, {
                size: 8, color: this.scopeMode ? 'rgba(0,255,136,0.55)' : 'rgba(255,255,255,0.2)',
                align: 'center', family: this.FONT_MONO
            });
        }

        // Bottles left
        const left = this.bottles.filter(b => b.alive).length + this.movingTargets.filter(t => t.alive).length;
        this.drawText(ctx, `${left} left`, 12, H - 12, {
            size: 10, color: 'rgba(180,180,200,0.6)', family: this.FONT_MONO
        });
    }

    // ============================================================
    // DRAW: WAITING
    // ============================================================
    drawWaiting(ctx, timestamp) {
        const cx = this.W / 2, cy = this.H / 2;

        // Card
        ctx.fillStyle = 'rgba(4,2,14,0.88)';
        this.drawRoundRect(ctx, cx - 155, cy - 55, 310, 106, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,0,0.35)';
        ctx.lineWidth   = this.dS(1.5);
        ctx.stroke();

        this.drawText(ctx, 'BOTTLE SHOOTING', cx, cy - 15, {
            size: 20, weight: 'bold', color: '#FFD700',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FFD700', glowBlur: 8
        });

        const bob = Math.sin(this.time / 400) * 3;
        this.drawText(ctx, 'Click / Tap to Shoot', cx, cy + 12 + bob, {
            size: 12, color: 'rgba(180,180,200,0.65)',
            align: 'center', family: this.FONT_MONO
        });
        this.drawText(ctx, 'Right Click = Scope  |  Aim Carefully!', cx, cy + 32, {
            size: 10, color: 'rgba(140,140,160,0.45)',
            align: 'center', family: this.FONT_MONO
        });
    }

    // ============================================================
    // DRAW: LEVEL UP
    // ============================================================
    drawLevelUp(ctx, timestamp) {
        const cx   = this.W / 2, cy = this.H / 2;
        const prog = 1 - this.levelUpTimer / 2200;

        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, prog * 0.6)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Floating texts will handle the display
        this.drawFloatingTextsFX(ctx);
    }

    // ============================================================
    // DRAW: DEATH SCREEN
    // ============================================================
    drawDeathScreen(ctx, timestamp) {
        const cx    = this.W / 2, cy = this.H / 2;
        const alpha = this.deathOverlayAlpha;

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.78})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.5) return;
        const pa = (alpha - 0.5) / 0.5;

        const pw = Math.min(this.W - 36, 310);
        const ph = 290;
        const px = cx - pw/2;
        const py = cy - ph/2;

        // Card
        ctx.globalAlpha = pa;
        ctx.fillStyle   = 'rgba(6,3,16,0.97)';
        this.drawRoundRect(ctx, px, py, pw, ph, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth   = this.dS(1.5);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Accent
        ctx.fillStyle = 'rgba(255,215,0,0.08)';
        this.fillRect(ctx, px, py, pw, 3);

        this.drawText(ctx, 'AMMO OUT!', cx, py + 46, {
            size: 24, weight: 'bold', color: '#FF006E',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FF006E', glowBlur: 12,
            opacity: pa
        });

        // Divider
        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`;
        this.fillRect(ctx, px + 16, py + 60, pw - 32, 1);

        const finalAcc = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
        const rows = [
            { label: 'SCORE',       val: this.fmtNum(this.score),     color: '#ffffff' },
            { label: 'BEST',        val: this.fmtNum(this.bestScore), color: this.score >= this.bestScore ? '#FFD700' : '#ffffff' },
            { label: 'LEVEL',       val: String(this.level),           color: '#cc66ff' },
            { label: 'ACCURACY',    val: `${finalAcc}%`,               color: finalAcc > 70 ? '#00FF88' : '#FFD700' },
            { label: 'BEST STREAK', val: `${this.streakRecord}x`,      color: '#FF8C00' },
            { label: 'BOTTLES HIT', val: String(this.bottlesHit),      color: '#00D4FF' }
        ];

        rows.forEach((r, i) => {
            const ry = py + 82 + i * 26;
            this.drawText(ctx, r.label, px + 22, ry, {
                size: 10, weight: '600', color: `rgba(100,110,140,${pa})`,
                family: this.FONT_TITLE
            });
            this.drawText(ctx, String(r.val), px + pw - 22, ry, {
                size: 12, weight: 'bold', color: r.color,
                align: 'right', family: this.FONT_TITLE,
                opacity: pa
            });
        });

        // Divider
        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`;
        this.fillRect(ctx, px + 16, py + ph - 52, pw - 32, 1);

        const blink = 0.4 + Math.sin(this.time / 400) * 0.45;
        this.drawText(ctx, 'TAP TO PLAY AGAIN', cx, py + ph - 18, {
            size: 11, color: 'rgba(180,180,220,1)',
            align: 'center', family: this.FONT_MONO,
            opacity: blink * pa
        });
    }

    // ============================================================
    // UTILS
    // ============================================================
    lightenColor(color, amt) {
        if (!color || !color.startsWith('#')) return color;
        const r = Math.min(255, parseInt(color.slice(1,3),16) + amt);
        const g = Math.min(255, parseInt(color.slice(3,5),16) + amt);
        const b = Math.min(255, parseInt(color.slice(5,7),16) + amt);
        return `rgb(${r},${g},${b})`;
    }

    darkenColor(color, amt) {
        if (!color || !color.startsWith('#')) return color;
        const r = Math.max(0, parseInt(color.slice(1,3),16) - amt);
        const g = Math.max(0, parseInt(color.slice(3,5),16) - amt);
        const b = Math.max(0, parseInt(color.slice(5,7),16) - amt);
        return `rgb(${r},${g},${b})`;
    }

    hexToRgba(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return hex;
        return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${Math.max(0,Math.min(1,alpha))})`;
    }

    // ============================================================
    // GAME LOOP
    // ============================================================
    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;
        this.update(timestamp, dt);
        this.draw(timestamp);
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) this.lastTime = performance.now();
        return this.paused;
    }

    resize() {
        this.setupHDCanvas();
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile      = this.W < 768 || ('ontouchstart' in window);
        this.isSmallScreen = this.W < 380;
        this.mountains     = this.generateMountains();
        this.trees         = this.generateTrees();
        this.stars         = this.makeStars(this.isMobile ? 35 : 55);
        this.crosshair.x   = this.W / 2;
        this.crosshair.y   = this.H / 2;
        this.calculateTubePositions && this.setupLevel();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('mousemove',   this.boundMouseMove);
        this.canvas.removeEventListener('click',       this.boundClick);
        this.canvas.removeEventListener('contextmenu', this.boundRightClick);
        this.canvas.removeEventListener('touchstart',  this.boundTouchStart);
        this.canvas.removeEventListener('touchmove',   this.boundTouchMove);
    }
}