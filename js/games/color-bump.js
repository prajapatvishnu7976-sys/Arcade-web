/* ============================================================
   COLOR BUMP v2.0 - ULTRA HD MOBILE EDITION
   Crystal Clear Text | DPR Scaled | Zero Blur
   Premium Feel | Real Game Mechanics | Mobile-First
   ============================================================ */

'use strict';

class ColorBump {
    constructor(canvas, onScore, options = {}) {
        this.canvas  = canvas;
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused    = false;
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
        // GAME STATES
        // ============================================
        this.STATE   = { WAITING: 0, PLAYING: 1, DEAD: 2 };
        this.state   = this.STATE.WAITING;

        // ============================================
        // SCORE
        // ============================================
        this.score     = 0;
        this.bestScore = parseInt(localStorage.getItem('colorbump_best_v2') || '0');

        // ============================================
        // COLOR PALETTE
        // ============================================
        this.COLORS = [
            { fill: '#FF006E', glow: '#ff4499', light: '#FF66AA', dark: '#CC0055', name: 'Pink'   },
            { fill: '#00D4FF', glow: '#66eaff', light: '#66EAFF', dark: '#0099CC', name: 'Cyan'   },
            { fill: '#00FF88', glow: '#66ffb8', light: '#66FFB8', dark: '#00CC66', name: 'Green'  },
            { fill: '#FFD700', glow: '#ffe866', light: '#FFE866', dark: '#CCA800', name: 'Gold'   },
            { fill: '#B94FE3', glow: '#d488f0', light: '#D488F0', dark: '#8833AA', name: 'Purple' },
            { fill: '#FF8C00', glow: '#ffb04d', light: '#FFB04D', dark: '#CC6600', name: 'Orange' }
        ];

        // ============================================
        // PLAYER
        // ============================================
        this.playerColorIdx = 0;
        this.player = {
            x: this.W / 2, y: this.H / 2,
            r: this.isMobile ? 20 : 24,
            targetX: this.W / 2, targetY: this.H / 2,
            vx: 0, vy: 0,
            trail: [],
            scale: 1,
            pulseAnim: 0,
            invincible: 0,
            colorChangeAnim: 0
        };

        // ============================================
        // BALLS
        // ============================================
        this.balls            = [];
        this.ballSpawnTimer   = 0;
        this.ballSpawnInterval = 2000;

        // ============================================
        // LEVEL
        // ============================================
        this.level        = 1;
        this.ballsPopped  = 0;
        this.ballsPerLevel = 10;
        this.combo        = 0;
        this.comboTimer   = 0;
        this.maxCombo     = 0;

        // ============================================
        // POWER-UPS
        // ============================================
        this.activeEffects = {
            rainbow: { active: false, timer: 0, duration: 5000 },
            magnet:  { active: false, timer: 0, duration: 4000 },
            shield:  { active: false, timer: 0, duration: 6000 },
            slow:    { active: false, timer: 0, duration: 5000 }
        };

        // ============================================
        // VISUAL FX
        // ============================================
        this.particles   = [];
        this.explosions  = [];
        this.scorePopups = [];
        this.floatingTexts = [];
        this.ripples     = [];
        this.popRings    = [];

        // Max pool for mobile
        this.MAX_PARTICLES = this.isMobile ? 60 : 120;
        this.MAX_POP_RINGS = 12;

        // Screen effects
        this.shakeX = 0; this.shakeY = 0;
        this.shakeTimer = 0; this.shakeForce = 0;
        this.flashAlpha = 0; this.flashColor = '#fff';
        this.deathOverlayAlpha = 0;

        // Timing
        this.time  = 0;
        this.frame = 0;
        this.bgTime = 0;

        // ============================================
        // BACKGROUND
        // ============================================
        this.stars   = this.makeStars(this.isMobile ? 40 : 65);
        this.hexGrid = this.generateHexGrid();

        // ============================================
        // INPUT
        // ============================================
        this.mousePos = { x: this.W / 2, y: this.H / 2 };

        this.spawnInitialBalls();
        this.bindEvents();

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
    // CRISP TEXT — Two-pass: glow then sharp
    // ============================================================
    drawText(ctx, text, x, y, opts = {}) {
        const {
            size        = 14,
            weight      = 'bold',
            color       = '#FFFFFF',
            align       = 'left',
            baseline    = 'alphabetic',
            family      = null,
            glow        = false,
            glowColor   = null,
            glowBlur    = 0,
            stroke      = false,
            strokeColor = 'rgba(0,0,0,0.7)',
            strokeWidth = 3,
            opacity     = 1,
            maxWidth    = 0
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

        // Glow pass (blurred, low opacity)
        if (glow && glowBlur > 0) {
            ctx.shadowBlur  = glowBlur * this.dpr;
            ctx.shadowColor = glowColor || color;
            ctx.fillStyle   = glowColor || color;
            ctx.globalAlpha = opacity * 0.45;
            ctx.fillText(text, px, py, mw);
        }

        // Sharp pass — zero blur
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
    generateHexGrid() {
        const hexes = [];
        const size  = 40;
        const cols  = Math.ceil(this.W / (size * 1.5)) + 2;
        const rows  = Math.ceil(this.H / (size * Math.sqrt(3))) + 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * size * 1.5 - size;
                const y = r * size * Math.sqrt(3) + (c % 2 === 1 ? size * Math.sqrt(3) / 2 : 0) - size;
                hexes.push({ x, y, size: size * 0.92, alpha: Math.random() * 0.035 + 0.008 });
            }
        }
        return hexes;
    }

    makeStars(count) {
        return Array.from({ length: count }, () => ({
            x:     Math.random() * this.W,
            y:     Math.random() * this.H,
            size:  Math.random() * 1.5 + 0.3,
            phase: Math.random() * 6.28,
            speed: Math.random() * 0.015 + 0.005,
            color: Math.random() > 0.8 ? '#B94FE3' : Math.random() > 0.6 ? '#00D4FF' : '#ffffff'
        }));
    }

    // ============================================================
    // BALL SPAWN
    // ============================================================
    spawnInitialBalls() {
        for (let i = 0; i < 12; i++) this.spawnBall();
    }

    spawnBall() {
        const margin   = 50;
        const colorIdx = Math.floor(Math.random() * this.COLORS.length);
        const r        = Math.random() * 10 + (this.isMobile ? 12 : 14);
        let x, y;
        do {
            x = margin + Math.random() * (this.W - margin * 2);
            y = margin + Math.random() * (this.H - margin * 2);
        } while (Math.sqrt((x - this.player.x)**2 + (y - this.player.y)**2) < 100);

        const speed = (0.8 + this.level * 0.15) * (Math.random() * 0.5 + 0.75);
        const angle = Math.random() * Math.PI * 2;
        const type  = Math.random() < 0.1 ? 'bomb'
                    : Math.random() < 0.08 ? 'powerup' : 'normal';

        const puTypes = ['rainbow', 'magnet', 'shield', 'slow'];
        this.balls.push({
            x, y, r,
            colorIdx,
            color:       this.COLORS[colorIdx].fill,
            glow:        this.COLORS[colorIdx].glow,
            light:       this.COLORS[colorIdx].light,
            dark:        this.COLORS[colorIdx].dark,
            vx:          Math.cos(angle) * speed,
            vy:          Math.sin(angle) * speed,
            pulse:       Math.random() * Math.PI * 2,
            scale:       0,
            type,
            powerupType: type === 'powerup' ? puTypes[Math.floor(Math.random() * puTypes.length)] : null,
            wobble:      0,
            wobbleSpeed: Math.random() * 0.08 + 0.04
        });
    }

    // ============================================================
    // EVENTS
    // ============================================================
    bindEvents() {
        this.boundMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = (e.clientX - rect.left) * (this.W / rect.width);
            this.mousePos.y = (e.clientY - rect.top)  * (this.H / rect.height);
            if (this.state === this.STATE.PLAYING) {
                this.player.targetX = this.mousePos.x;
                this.player.targetY = this.mousePos.y;
            }
        };
        this.boundClick = (e) => {
            if (this.state === this.STATE.WAITING)                                   { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8)     { this.restartGame(); return; }
            this.changeColor();
        };
        this.boundTouchStart = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const tx = (e.touches[0].clientX - rect.left) * (this.W / rect.width);
            const ty = (e.touches[0].clientY - rect.top)  * (this.H / rect.height);
            if (this.state === this.STATE.WAITING)                               { this.state = this.STATE.PLAYING; return; }
            if (this.state === this.STATE.DEAD && this.deathOverlayAlpha > 0.8) { this.restartGame(); return; }
            this.player.targetX = tx;
            this.player.targetY = ty;
        };
        this.boundTouchMove = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.player.targetX = (e.touches[0].clientX - rect.left) * (this.W / rect.width);
            this.player.targetY = (e.touches[0].clientY - rect.top)  * (this.H / rect.height);
        };
        this.boundTouchEnd = (e) => {
            e.preventDefault();
            if (this.state === this.STATE.PLAYING) this.changeColor();
        };

        this.canvas.addEventListener('mousemove',  this.boundMouseMove);
        this.canvas.addEventListener('click',      this.boundClick);
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove',  this.boundTouchMove,  { passive: false });
        this.canvas.addEventListener('touchend',   this.boundTouchEnd,   { passive: false });
    }

    changeColor() {
        if (this.activeEffects.rainbow.active) return;
        this.playerColorIdx = (this.playerColorIdx + 1) % this.COLORS.length;
        this.player.colorChangeAnim = 1;
        this.player.scale = 0.8;
        this.spawnColorChangeParticles();
        if (window.audioManager) audioManager.play('click');
    }

    spawnColorChangeParticles() {
        const c = this.COLORS[this.playerColorIdx];
        for (let i = 0; i < 8 && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            this.particles.push({
                x: this.player.x, y: this.player.y,
                vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
                size: Math.random() * 4 + 2,
                life: 1, decay: 0.05,
                color: c.fill, grav: 0
            });
        }
    }

    restartGame() {
        this.score    = 0;
        this.onScore(0);
        this.state    = this.STATE.WAITING;
        this.gameOver = false;
        this.level    = 1;
        this.ballsPopped = 0;
        this.combo    = 0;
        this.comboTimer = 0;
        this.deathOverlayAlpha = 0;
        this.flashAlpha = 0;
        this.balls         = [];
        this.particles     = [];
        this.ripples       = [];
        this.popRings      = [];
        this.explosions    = [];
        this.scorePopups   = [];
        this.floatingTexts = [];
        this.player.x      = this.W / 2;
        this.player.y      = this.H / 2;
        this.player.vx     = 0;
        this.player.vy     = 0;
        this.player.invincible    = 0;
        this.player.trail         = [];
        this.player.colorChangeAnim = 0;
        this.player.scale = 1;
        Object.keys(this.activeEffects).forEach(k => {
            this.activeEffects[k].active = false;
            this.activeEffects[k].timer  = 0;
        });
        this.spawnInitialBalls();
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
            this.shakeY = (Math.random() - 0.5) * f * 0.5;
            this.shakeTimer--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.035);

        if (this.state === this.STATE.WAITING) {
            this.updateBalls(dt, true);
            return;
        }

        if (this.state === this.STATE.DEAD) {
            this.deathOverlayAlpha = Math.min(1, this.deathOverlayAlpha + 0.014);
            this.updateParticles(dt);
            return;
        }

        // Active effects decay
        Object.keys(this.activeEffects).forEach(key => {
            const ef = this.activeEffects[key];
            if (ef.active && ef.duration > 0) {
                ef.timer -= dt;
                if (ef.timer <= 0) { ef.active = false; ef.timer = 0; }
            }
        });

        // Rainbow color cycle
        if (this.activeEffects.rainbow.active) {
            this.playerColorIdx = Math.floor(timestamp / 150) % this.COLORS.length;
        }

        this.updatePlayer(dt);
        this.updateBalls(dt, false);

        // Spawn balls
        this.ballSpawnTimer += dt;
        if (this.ballSpawnTimer >= this.ballSpawnInterval && this.balls.length < 20 + this.level * 3) {
            this.spawnBall();
            this.ballSpawnTimer    = 0;
            this.ballSpawnInterval = Math.max(800, 2000 - this.level * 100);
        }

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 0;
        }

        // Magnet
        if (this.activeEffects.magnet.active) {
            this.balls.forEach(b => {
                if (b.colorIdx !== this.playerColorIdx && !this.activeEffects.rainbow.active) return;
                const dx = this.player.x - b.x;
                const dy = this.player.y - b.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 180 && dist > 5) {
                    b.vx += (dx / dist) * 0.3;
                    b.vy += (dy / dist) * 0.3;
                }
            });
        }

        // Ripples
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius  += 3;
            r.opacity -= 0.025;
            if (r.opacity <= 0) this.ripples.splice(i, 1);
        }

        // Pop rings
        for (let i = this.popRings.length - 1; i >= 0; i--) {
            const r = this.popRings[i];
            r.radius  += 2.5;
            r.opacity -= 0.04;
            if (r.opacity <= 0) this.popRings.splice(i, 1);
        }

        this.updateParticles(dt);

        // Score popups
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1.2; p.life -= dt;
            p.opacity = Math.min(1, p.life / 500);
            return p.life > 0;
        });

        // Floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 0.6; t.life -= 1;
            t.opacity = Math.min(1, t.life / 30);
            t.scale  += (1 - t.scale) * 0.12;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }

        if (this.player.invincible > 0) this.player.invincible -= dt;
        if (this.player.scale < 1) this.player.scale = Math.min(1, this.player.scale + 0.05);
        if (this.player.colorChangeAnim > 0) this.player.colorChangeAnim -= 0.07;
        this.player.pulseAnim += 0.05;
    }

    updatePlayer(dt) {
        const p          = this.player;
        const slowFactor = this.activeEffects.slow.active ? 0.6 : 1;
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.vx += dx * 0.08;
        p.vy += dy * 0.08;
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x  += p.vx * slowFactor;
        p.y  += p.vy * slowFactor;
        p.x   = Math.max(p.r, Math.min(this.W - p.r, p.x));
        p.y   = Math.max(p.r, Math.min(this.H - p.r, p.y));

        p.trail.push({ x: p.x, y: p.y, color: this.COLORS[this.playerColorIdx].fill });
        if (p.trail.length > 15) p.trail.shift();
    }

    updateBalls(dt, idleMode) {
        const slowFactor = this.activeEffects.slow.active ? 0.5 : 1;

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            b.scale = Math.min(1, b.scale + 0.05);
            b.pulse += b.wobbleSpeed;
            b.wobble = Math.sin(b.pulse) * 0.07;

            // Ball-to-ball collision
            for (let j = i + 1; j < this.balls.length; j++) {
                const b2   = this.balls[j];
                const dx   = b2.x - b.x;
                const dy   = b2.y - b.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const minD = b.r + b2.r;
                if (dist < minD && dist > 0) {
                    const nx  = dx / dist, ny = dy / dist;
                    const ov  = minD - dist;
                    b.x  -= nx * ov * 0.5;
                    b.y  -= ny * ov * 0.5;
                    b2.x += nx * ov * 0.5;
                    b2.y += ny * ov * 0.5;
                    const relVx = b.vx - b2.vx;
                    const relVy = b.vy - b2.vy;
                    const dot   = relVx * nx + relVy * ny;
                    if (dot > 0) {
                        b.vx  -= dot * nx; b.vy  -= dot * ny;
                        b2.vx += dot * nx; b2.vy += dot * ny;
                    }
                }
            }

            b.x += b.vx * slowFactor;
            b.y += b.vy * slowFactor;

            if (b.x - b.r <= 0)       { b.x = b.r;          b.vx =  Math.abs(b.vx); }
            if (b.x + b.r >= this.W)  { b.x = this.W - b.r; b.vx = -Math.abs(b.vx); }
            if (b.y - b.r <= 0)       { b.y = b.r;          b.vy =  Math.abs(b.vy); }
            if (b.y + b.r >= this.H)  { b.y = this.H - b.r; b.vy = -Math.abs(b.vy); }

            if (idleMode) continue;

            // Player collision
            const pdx  = this.player.x - b.x;
            const pdy  = this.player.y - b.y;
            const pdist = Math.sqrt(pdx*pdx + pdy*pdy);

            if (pdist < this.player.r + b.r) {
                const colorMatch = this.activeEffects.rainbow.active || b.colorIdx === this.playerColorIdx;

                if (b.type === 'powerup') {
                    this.collectPowerup(b, i);
                    continue;
                }

                if (b.type === 'bomb') {
                    if (colorMatch) { this.triggerBomb(b, i); continue; }
                    if (this.player.invincible > 0 || this.activeEffects.shield.active) continue;
                    this.playerDie(b);
                    return;
                }

                if (colorMatch) {
                    this.popBall(b, i);
                } else {
                    if (this.player.invincible > 0 || this.activeEffects.shield.active) {
                        if (pdist > 0) { b.vx = -(pdx / pdist) * 5; b.vy = -(pdy / pdist) * 5; }
                    } else {
                        this.playerDie(b);
                        return;
                    }
                }
            }
        }
    }

    popBall(ball, idx) {
        this.combo++;
        this.comboTimer = 2000;
        this.maxCombo   = Math.max(this.maxCombo, this.combo);

        const mult       = this.activeEffects.rainbow.active ? 2 : 1;
        const comboBonus = Math.min(this.combo - 1, 8) * 5;
        const gained     = (10 + comboBonus) * mult;
        this.score      += gained;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('colorbump_best_v2', this.bestScore);
        }
        this.onScore(this.score);

        this.spawnPopParticles(ball.x, ball.y, ball.color, 12);
        this.ripples.push({ x: ball.x, y: ball.y, radius: ball.r, opacity: 0.75, color: ball.color });
        if (this.popRings.length < this.MAX_POP_RINGS)
            this.popRings.push({ x: ball.x, y: ball.y, radius: ball.r * 0.5, opacity: 0.6, color: ball.color });

        this.scorePopups.push({
            x: ball.x, y: ball.y - 20,
            text: this.combo > 1 ? `+${gained} x${this.combo}!` : `+${gained}`,
            color: this.combo > 3 ? '#FFD700' : ball.color,
            life: 1000, opacity: 1
        });

        this.balls.splice(idx, 1);
        this.ballsPopped++;
        if (this.ballsPopped % this.ballsPerLevel === 0) this.levelUp();

        if (window.audioManager) audioManager.play('pop');
        this.player.scale = 1.15;
    }

    triggerBomb(ball, idx) {
        const cx = ball.x, cy = ball.y;
        const radius = 100;
        let killed = 0;

        for (let i = this.balls.length - 1; i >= 0; i--) {
            if (i === idx) continue;
            const b    = this.balls[i];
            const dist = Math.sqrt((b.x - cx)**2 + (b.y - cy)**2);
            if (dist < radius) {
                this.spawnPopParticles(b.x, b.y, b.color, 6);
                this.balls.splice(i, 1);
                killed++;
                if (idx > i) idx--;
            }
        }

        this.balls.splice(idx, 1);
        this.spawnPopParticles(cx, cy, '#FFD700', 20);

        const bonus = (killed + 1) * 20;
        this.score += bonus;
        this.onScore(this.score);

        this.explosions.push({ x: cx, y: cy, radius: 5, maxRadius: radius,       opacity: 1,   color: '#FFD700' });
        this.explosions.push({ x: cx, y: cy, radius: 5, maxRadius: radius * 0.7, opacity: 0.75, color: '#FF8C00' });

        this.scorePopups.push({
            x: cx, y: cy - 30,
            text: `BOMB! +${bonus}`,
            color: '#FFD700', life: 1500, opacity: 1
        });

        this.shake(15, 10);
        this.flashAlpha = 0.28; this.flashColor = '#FFD700';
        if (window.audioManager) audioManager.play('levelUp');
    }

    collectPowerup(ball, idx) {
        const type = ball.powerupType;
        const ef   = this.activeEffects[type];
        if (ef) { ef.active = true; ef.timer = ef.duration; }

        const info = {
            rainbow: { text: 'RAINBOW!', color: '#FF006E' },
            magnet:  { text: 'MAGNET!',  color: '#00D4FF' },
            shield:  { text: 'SHIELD!',  color: '#00FF88' },
            slow:    { text: 'SLOW!',    color: '#B94FE3' }
        };
        const pi = info[type];
        this.spawnPopParticles(ball.x, ball.y, ball.color, 15);
        this.scorePopups.push({
            x: ball.x, y: ball.y - 20,
            text:  pi ? pi.text : 'BONUS!',
            color: pi ? pi.color : '#FFD700',
            life: 1500, opacity: 1
        });

        this.balls.splice(idx, 1);
        this.flashAlpha = 0.18; this.flashColor = ball.color;
        this.player.invincible = 1000;
        if (window.audioManager) audioManager.play('powerup');
    }

    levelUp() {
        this.level++;
        this.score += 100 * this.level;
        this.onScore(this.score);
        this.flashAlpha = 0.28; this.flashColor = '#00FF88';
        this.shake(8, 5);
        this.addFloatingText(this.W/2, this.H/2, `LEVEL ${this.level}!`, '#00FF88', 24, 100);
        if (window.audioManager) audioManager.play('levelUp');
    }

    playerDie(ball) {
        if (this.activeEffects.shield.active) {
            this.activeEffects.shield.active = false;
            this.activeEffects.shield.timer  = 0;
            this.player.invincible = 1500;
            this.spawnPopParticles(this.player.x, this.player.y, '#00FF88', 12);
            this.flashAlpha = 0.28; this.flashColor = '#00FF88';
            if (window.audioManager) audioManager.play('powerup');
            return;
        }

        this.gameOver = true;
        this.state    = this.STATE.DEAD;

        for (let i = 0; i < 22 && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = (Math.PI * 2 * i) / 22;
            const speed = Math.random() * 8 + 3;
            this.particles.push({
                x: this.player.x, y: this.player.y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                size: Math.random() * 8 + 3,
                life: 1, decay: 0.022,
                color: this.COLORS[this.playerColorIdx].fill, grav: 0.15
            });
        }

        this.explosions.push({ x: this.player.x, y: this.player.y, radius: 5, maxRadius: 80, opacity: 1, color: ball.color });
        this.shake(20, 14);
        this.flashAlpha = 0.65; this.flashColor = '#FF0055';

        setTimeout(() => this.onScore(this.score, true), 1000);
        if (window.audioManager) audioManager.play('gameOver');
    }

    spawnPopParticles(x, y, color, count) {
        for (let i = 0; i < count && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                size: Math.random() * 6 + 2,
                life: 1, decay: 0.03,
                color, grav: 0.08
            });
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += p.grav || 0;
            p.vx *= 0.97;
            p.life -= p.decay;
            p.size *= 0.96;
            if (p.life <= 0 || p.size < 0.3) this.particles.splice(i, 1);
        }

        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const e = this.explosions[i];
            e.radius  += 4;
            e.opacity -= 0.04;
            if (e.opacity <= 0 || e.radius >= e.maxRadius) this.explosions.splice(i, 1);
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
    // DRAW — MAIN
    // ============================================================
    draw(timestamp) {
        const ctx = this.ctx;

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.shakeX || this.shakeY) {
            ctx.translate(this.dS(this.shakeX), this.dS(this.shakeY));
        }

        this.drawBackground(ctx, timestamp);
        this.drawRipplesFX(ctx);
        this.drawPopRingsFX(ctx);
        this.drawExplosionsFX(ctx);
        this.drawBalls(ctx, timestamp);
        this.drawParticlesFX(ctx);
        this.drawPlayer(ctx, timestamp);
        this.drawScorePopupsFX(ctx);
        this.drawFloatingTextsFX(ctx);

        // Flash overlay
        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.drawHUD(ctx, timestamp);

        if (this.state === this.STATE.WAITING) this.drawWaiting(ctx, timestamp);
        if (this.state === this.STATE.DEAD)    this.drawDeathScreen(ctx, timestamp);

        ctx.restore();
    }

    // ============================================================
    // DRAW: BACKGROUND
    // ============================================================
    drawBackground(ctx, timestamp) {
        const W = this.W, H = this.H;

        const bg = ctx.createRadialGradient(
            this.dX(W/2), this.dY(H/2), 0,
            this.dX(W/2), this.dY(H/2), this.dS(H)
        );
        bg.addColorStop(0,   '#110825');
        bg.addColorStop(0.6, '#080518');
        bg.addColorStop(1,   '#030210');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        for (const s of this.stars) {
            const alpha = 0.12 + ((Math.sin(s.phase) + 1) / 2) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = s.color;
            this.drawCircle(ctx, s.x, s.y, s.size);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Hex grid
        for (const h of this.hexGrid) {
            ctx.globalAlpha = h.alpha;
            ctx.strokeStyle = 'rgba(185,79,227,0.28)';
            ctx.lineWidth   = this.dS(0.5);
            this.drawHexagon(ctx, h.x, h.y, h.size);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    drawHexagon(ctx, cx, cy, size) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = cx + size * Math.cos(angle);
            const y = cy + size * Math.sin(angle);
            i === 0 ? ctx.moveTo(this.dX(x), this.dY(y)) : ctx.lineTo(this.dX(x), this.dY(y));
        }
        ctx.closePath();
    }

    // ============================================================
    // DRAW: FX
    // ============================================================
    drawRipplesFX(ctx) {
        ctx.save();
        for (const r of this.ripples) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth   = this.dS(2 * r.opacity);
            ctx.shadowBlur  = this.dS(7);
            ctx.shadowColor = r.color;
            this.drawCircle(ctx, r.x, r.y, r.radius);
            ctx.stroke();
            ctx.shadowBlur = 0;
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

    drawExplosionsFX(ctx) {
        ctx.save();
        for (const e of this.explosions) {
            ctx.globalAlpha = e.opacity;
            ctx.shadowBlur  = this.dS(14);
            ctx.shadowColor = e.color;
            ctx.strokeStyle = e.color;
            ctx.lineWidth   = this.dS(3);
            this.drawCircle(ctx, e.x, e.y, e.radius);
            ctx.stroke();
            ctx.globalAlpha = e.opacity * 0.28;
            ctx.fillStyle   = e.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    drawParticlesFX(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.min(1, p.life);
            ctx.shadowBlur  = this.dS(4);
            ctx.shadowColor = p.color;
            ctx.fillStyle   = p.color;
            this.drawCircle(ctx, p.x, p.y, Math.max(0.5, p.size * p.life));
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    drawScorePopupsFX(ctx) {
        for (const p of this.scorePopups) {
            this.drawText(ctx, p.text, p.x, p.y, {
                size: 13, weight: 'bold', color: p.color,
                align: 'center', opacity: p.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 2.5,
                glow: true, glowColor: p.color, glowBlur: 6,
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
    // DRAW: BALLS
    // ============================================================
    drawBalls(ctx, timestamp) {
        for (const b of this.balls) {
            const pulse = 1 + Math.sin(b.pulse) * 0.055;
            const r     = b.r * b.scale * pulse;

            ctx.save();
            ctx.translate(this.dX(b.x), this.dY(b.y));
            ctx.scale(1 + b.wobble, 1 - b.wobble * 0.5);

            if (b.type === 'bomb') {
                // Body
                const bg2 = ctx.createRadialGradient(
                    this.dS(-r * 0.3), this.dS(-r * 0.3), 0,
                    0, 0, this.dS(r)
                );
                bg2.addColorStop(0, '#555');
                bg2.addColorStop(0.5, '#2a2a2a');
                bg2.addColorStop(1, '#111');
                ctx.fillStyle = bg2;
                ctx.shadowBlur  = this.dS(10);
                ctx.shadowColor = '#FF4500';
                this.drawCircle(ctx, 0, 0, r);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Fuse
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth   = this.dS(2);
                ctx.beginPath();
                ctx.moveTo(0, this.dS(-r));
                ctx.quadraticCurveTo(this.dS(r * 0.3), this.dS(-r * 1.4), this.dS(r * 0.1), this.dS(-r * 1.7));
                ctx.stroke();

                // Spark
                if (Math.random() > 0.45) {
                    ctx.fillStyle  = '#FFD700';
                    ctx.shadowBlur  = this.dS(5);
                    ctx.shadowColor = '#FFD700';
                    this.drawCircle(ctx, r * 0.1, -r * 1.7, 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // Skull symbol — crisp
                ctx.save();
                ctx.shadowBlur   = 0;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.font         = `${this.dSr(r)}px serif`;
                ctx.globalAlpha  = 0.55;
                ctx.fillStyle    = '#ffffff';
                ctx.fillText('X', 0, this.dS(r * 0.1));
                ctx.restore();

            } else if (b.type === 'powerup') {
                const puColors = {
                    rainbow: '#FF006E', magnet: '#00D4FF',
                    shield: '#00FF88', slow: '#B94FE3'
                };
                const puColor = puColors[b.powerupType] || '#FFD700';
                const puGrad  = ctx.createRadialGradient(
                    this.dS(-r*0.3), this.dS(-r*0.3), 0,
                    0, 0, this.dS(r)
                );
                puGrad.addColorStop(0, this.lightenColor(puColor, 60));
                puGrad.addColorStop(0.6, puColor);
                puGrad.addColorStop(1, this.darkenColor(puColor, 40));
                ctx.fillStyle  = puGrad;
                ctx.shadowBlur  = this.dS(14);
                ctx.shadowColor = puColor;
                this.drawCircle(ctx, 0, 0, r);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Pulse ring
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth   = this.dS(1.5);
                this.drawCircle(ctx, 0, 0, r + 3 + Math.sin(b.pulse * 2) * 2);
                ctx.stroke();

                // Name label — crisp
                const labels = { rainbow: 'R', magnet: 'M', shield: 'S', slow: 'SL' };
                this.drawText(ctx, labels[b.powerupType] || '?', 0, r * 0.1, {
                    size: r * 0.7, weight: 'bold', color: '#fff',
                    align: 'center', baseline: 'middle',
                    stroke: true, strokeColor: 'rgba(0,0,0,0.4)', strokeWidth: 2,
                    family: this.FONT_TITLE
                });

            } else {
                // Normal ball
                const ballGrad = ctx.createRadialGradient(
                    this.dS(-r*0.3), this.dS(-r*0.35), this.dS(r*0.05),
                    0, 0, this.dS(r)
                );
                ballGrad.addColorStop(0,   this.lightenColor(b.color, 70));
                ballGrad.addColorStop(0.4, b.color);
                ballGrad.addColorStop(0.8, this.darkenColor(b.color, 30));
                ballGrad.addColorStop(1,   this.darkenColor(b.color, 60));
                ctx.fillStyle  = ballGrad;
                ctx.shadowBlur  = this.dS(12);
                ctx.shadowColor = b.glow;
                this.drawCircle(ctx, 0, 0, r);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Specular
                ctx.fillStyle = 'rgba(255,255,255,0.48)';
                ctx.beginPath();
                ctx.ellipse(
                    this.dS(-r*0.28), this.dS(-r*0.32),
                    this.dS(r*0.28), this.dS(r*0.18),
                    -0.5, 0, Math.PI * 2
                );
                ctx.fill();

                // Bottom reflection
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.beginPath();
                ctx.ellipse(
                    this.dS(r*0.2), this.dS(r*0.5),
                    this.dS(r*0.2), this.dS(r*0.09),
                    0.4, 0, Math.PI * 2
                );
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // ============================================================
    // DRAW: PLAYER
    // ============================================================
    drawPlayer(ctx, timestamp) {
        const p         = this.player;
        const colorData = this.COLORS[this.playerColorIdx];
        const rainbow   = this.activeEffects.rainbow.active;

        // Trail
        p.trail.forEach((t, i) => {
            const ratio = i / p.trail.length;
            ctx.save();
            ctx.globalAlpha = ratio * 0.28;
            ctx.shadowBlur  = this.dS(4);
            ctx.shadowColor = t.color;
            ctx.fillStyle   = t.color;
            this.drawCircle(ctx, t.x, t.y, Math.max(1, p.r * ratio * 0.75));
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        if (this.state === this.STATE.DEAD) return;

        const r        = p.r * p.scale;
        const invBlink = p.invincible > 0 && Math.floor(p.invincible / 100) % 2 === 0;
        if (invBlink) return;

        ctx.save();
        ctx.translate(this.dX(p.x), this.dY(p.y));

        // Shield ring — glow pass only (no text near it)
        if (this.activeEffects.shield.active) {
            const sp = 0.6 + Math.sin(timestamp / 150) * 0.4;
            ctx.save();
            ctx.shadowBlur  = this.dS(14);
            ctx.shadowColor = '#00FF88';
            ctx.strokeStyle = `rgba(0,255,136,${sp})`;
            ctx.lineWidth   = this.dS(3);
            ctx.setLineDash([this.dS(5), this.dS(5)]);
            ctx.lineDashOffset = -timestamp / 50;
            this.drawCircle(ctx, 0, 0, r + 12);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Magnet ring
        if (this.activeEffects.magnet.active) {
            const ma = 0.3 + Math.sin(timestamp / 200) * 0.18;
            ctx.save();
            ctx.strokeStyle = `rgba(0,212,255,${ma})`;
            ctx.lineWidth   = this.dS(1.5);
            ctx.setLineDash([this.dS(3), this.dS(8)]);
            ctx.lineDashOffset = timestamp / 30;
            this.drawCircle(ctx, 0, 0, 170);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Color change ring
        if (p.colorChangeAnim > 0) {
            ctx.save();
            ctx.globalAlpha = p.colorChangeAnim * 0.8;
            ctx.shadowBlur  = this.dS(8);
            ctx.shadowColor = '#fff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = this.dS(2.5);
            this.drawCircle(ctx, 0, 0, r + p.colorChangeAnim * 20);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Body gradient
        const bodyColor = rainbow
            ? `hsl(${(timestamp / 10) % 360}, 100%, 60%)`
            : colorData.fill;

        const grad = ctx.createRadialGradient(
            this.dS(-r*0.3), this.dS(-r*0.35), this.dS(r*0.05),
            0, 0, this.dS(r)
        );
        grad.addColorStop(0,   this.lightenColor(bodyColor, 80));
        grad.addColorStop(0.35, bodyColor);
        grad.addColorStop(0.7,  this.darkenColor(bodyColor, 20));
        grad.addColorStop(1,    this.darkenColor(bodyColor, 50));

        // Glow (separate pass, won't leak to text)
        ctx.save();
        ctx.shadowBlur  = this.dS(22);
        ctx.shadowColor = rainbow ? `hsl(${(timestamp/10) % 360}, 100%, 60%)` : colorData.glow;
        ctx.fillStyle   = grad;
        this.drawCircle(ctx, 0, 0, r);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Outer ring
        ctx.strokeStyle = rainbow
            ? `hsl(${((timestamp/10)+60) % 360}, 100%, 80%)`
            : 'rgba(255,255,255,0.48)';
        ctx.lineWidth = this.dS(2.5);
        this.drawCircle(ctx, 0, 0, r);
        ctx.stroke();

        // Inner pulse ring
        const pulseMod = 0.65 + Math.sin(p.pulseAnim) * 0.05;
        ctx.strokeStyle = rainbow
            ? `hsl(${((timestamp/10)+120) % 360}, 100%, 70%)`
            : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = this.dS(1);
        this.drawCircle(ctx, 0, 0, r * pulseMod);
        ctx.stroke();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.48)';
        ctx.beginPath();
        ctx.ellipse(
            this.dS(-r*0.28), this.dS(-r*0.32),
            this.dS(r*0.3), this.dS(r*0.2),
            -0.5, 0, Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }

    // ============================================================
    // DRAW: HUD — fully crisp
    // ============================================================
    drawHUD(ctx, timestamp) {
        const W = this.W;

        // Top bar
        const hudGrad = ctx.createLinearGradient(0, 0, 0, this.dY(44));
        hudGrad.addColorStop(0, 'rgba(0,0,0,0.72)');
        hudGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = hudGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.dY(44));

        ctx.strokeStyle = 'rgba(185,79,227,0.15)';
        ctx.lineWidth   = this.dS(0.5);
        this.drawLine(ctx, 0, 44, W, 44);
        ctx.stroke();

        // Level
        this.drawText(ctx, `LVL ${this.level}`, 10, 22, {
            size: 12, weight: 'bold', color: '#cc66ff',
            family: this.FONT_TITLE,
            glow: true, glowColor: '#b347d9', glowBlur: 4
        });

        // Score (center)
        this.drawText(ctx, this.fmtNum(this.score), W/2, 22, {
            size: 17, weight: 'bold', color: '#ffffff',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: this.COLORS[this.playerColorIdx].glow, glowBlur: 6
        });

        // Best
        if (this.bestScore > 0) {
            this.drawText(ctx, `BEST: ${this.fmtNum(this.bestScore)}`, W/2, 36, {
                size: 8, color: 'rgba(255,215,0,0.45)',
                align: 'center', family: this.FONT_MONO
            });
        }

        // Current color (right)
        const c = this.COLORS[this.playerColorIdx];
        this.drawText(ctx, c.name, W - 12, 22, {
            size: 11, weight: 'bold', color: c.fill,
            align: 'right', family: this.FONT_TITLE,
            glow: true, glowColor: c.glow, glowBlur: 5
        });
        this.drawText(ctx, 'TAP = CHANGE', W - 12, 35, {
            size: 8, color: 'rgba(255,255,255,0.28)',
            align: 'right', family: this.FONT_MONO
        });

        // Combo
        if (this.combo > 1 && this.comboTimer > 0) {
            const ca = Math.min(1, this.comboTimer / 500);
            this.drawText(ctx, `x${this.combo} COMBO!`, W/2, 56, {
                size: 13, weight: 'bold', color: '#FFD700',
                align: 'center', opacity: ca,
                glow: true, glowColor: '#FFD700', glowBlur: 7,
                family: this.FONT_TITLE
            });
        }

        // Active effect bars
        const efInfo = {
            rainbow: { label: 'RAIN',   color: '#FF006E' },
            magnet:  { label: 'MAG',    color: '#00D4FF' },
            shield:  { label: 'SHIELD', color: '#00FF88' },
            slow:    { label: 'SLOW',   color: '#B94FE3' }
        };
        let efX = 8;
        const efY = 48;

        Object.entries(this.activeEffects).forEach(([key, ef]) => {
            if (!ef.active || ef.duration === 0) return;
            const info = efInfo[key];
            if (!info) return;
            const pct  = ef.timer / ef.duration;
            const barW = 44;

            // Bar bg
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            this.drawRoundRect(ctx, efX, efY, barW, 10, 3);
            ctx.fill();

            // Bar fill
            ctx.fillStyle = info.color;
            this.drawRoundRect(ctx, efX, efY, barW * pct, 10, 3);
            ctx.fill();

            // Label
            this.drawText(ctx, info.label, efX + barW/2, efY + 7, {
                size: 6, weight: 'bold', color: '#ffffff',
                align: 'center', family: this.FONT_MONO
            });

            efX += barW + 5;
        });
    }

    // ============================================================
    // DRAW: WAITING SCREEN
    // ============================================================
    drawWaiting(ctx, timestamp) {
        const cx = this.W / 2;
        const cy = this.H / 2;

        // Card bg
        ctx.fillStyle = 'rgba(4,2,14,0.88)';
        this.drawRoundRect(ctx, cx - 155, cy - 55, 310, 106, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(185,79,227,0.35)';
        ctx.lineWidth   = this.dS(1.5);
        ctx.stroke();

        // Title glow pass
        this.drawText(ctx, 'COLOR BUMP', cx, cy - 18, {
            size: 22, weight: 'bold', color: '#FF006E',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FF006E', glowBlur: 10
        });

        this.drawText(ctx, 'Move / drag to control', cx, cy + 10, {
            size: 12, color: 'rgba(180,180,200,0.7)',
            align: 'center', family: this.FONT_MONO
        });

        const bob = Math.sin(this.time / 400) * 3;
        this.drawText(ctx, 'Tap / Click to change color & start', cx, cy + 32 + bob, {
            size: 10, color: 'rgba(140,140,160,0.6)',
            align: 'center', family: this.FONT_MONO
        });
    }

    // ============================================================
    // DRAW: DEATH SCREEN
    // ============================================================
    drawDeathScreen(ctx, timestamp) {
        const cx    = this.W / 2;
        const cy    = this.H / 2;
        const alpha = this.deathOverlayAlpha;

        // Overlay
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.78})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.5) return;
        const pa = (alpha - 0.5) / 0.5;

        const pw = Math.min(this.W - 36, 302);
        const ph = 282;
        const px = cx - pw/2;
        const py = cy - ph/2;

        // Card
        ctx.globalAlpha = pa;
        ctx.fillStyle   = 'rgba(6,3,16,0.97)';
        this.drawRoundRect(ctx, px, py, pw, ph, 18);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,0,110,0.45)';
        ctx.lineWidth   = this.dS(1.5);
        this.drawRoundRect(ctx, px, py, pw, ph, 18);
        ctx.stroke();

        // Top accent
        ctx.fillStyle = 'rgba(255,0,110,0.1)';
        this.fillRect(ctx, px, py, pw, 3);

        ctx.globalAlpha = 1;

        // Title
        this.drawText(ctx, 'GAME OVER', cx, py + 46, {
            size: 24, weight: 'bold', color: '#FF006E',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#FF006E', glowBlur: 12,
            opacity: pa
        });

        // Divider
        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`;
        this.fillRect(ctx, px + 18, py + 60, pw - 36, 1);

        // Stats
        const rows = [
            { label: 'SCORE',        val: this.fmtNum(this.score),    color: '#ffffff' },
            { label: 'BEST',         val: this.fmtNum(this.bestScore), color: this.score >= this.bestScore ? '#FFD700' : '#ffffff' },
            { label: 'LEVEL',        val: String(this.level),          color: '#cc66ff' },
            { label: 'BEST COMBO',   val: `x${this.maxCombo}`,         color: '#FFD700' },
            { label: 'BALLS POPPED', val: String(this.ballsPopped),    color: '#00FF88' }
        ];

        rows.forEach((r, i) => {
            const ry = py + 82 + i * 28;
            this.drawText(ctx, r.label, px + 22, ry, {
                size: 10, weight: '600', color: `rgba(100,110,140,${pa})`,
                family: this.FONT_TITLE
            });
            this.drawText(ctx, r.val, px + pw - 22, ry, {
                size: 12, weight: 'bold', color: r.color,
                align: 'right', family: this.FONT_TITLE,
                opacity: pa
            });
        });

        // Divider
        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`;
        this.fillRect(ctx, px + 18, py + ph - 50, pw - 36, 1);

        // Blink restart
        const blink = 0.45 + Math.sin(this.time / 400) * 0.45;
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
        if (!color.startsWith('#')) return color;
        const r = Math.min(255, parseInt(color.slice(1,3),16) + amt);
        const g = Math.min(255, parseInt(color.slice(3,5),16) + amt);
        const b = Math.min(255, parseInt(color.slice(5,7),16) + amt);
        return `rgb(${r},${g},${b})`;
    }

    darkenColor(color, amt) {
        if (!color.startsWith('#')) return color;
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
        this.stars   = this.makeStars(this.isMobile ? 40 : 65);
        this.hexGrid = this.generateHexGrid();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('mousemove',  this.boundMouseMove);
        this.canvas.removeEventListener('click',      this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchmove',  this.boundTouchMove);
        this.canvas.removeEventListener('touchend',   this.boundTouchEnd);
    }
}