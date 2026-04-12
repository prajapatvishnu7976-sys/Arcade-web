'use strict';

class FlappyBird {
    constructor(canvas, onScore) {
        this.canvas  = canvas;
        this.onScore = onScore;

        // ✅ MOBILE FIX: DPR cap
        this.isMobile = ('ontouchstart' in window) || window.innerWidth < 768;
        this.dpr = this.isMobile
            ? Math.min(window.devicePixelRatio || 1, 1.5)
            : Math.min(window.devicePixelRatio || 1, 2);

        this.setupHDCanvas();

        this.ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: false
        });

        // ✅ MOBILE FIX: No smoothing on mobile
        this.ctx.imageSmoothingEnabled = !this.isMobile;

        this.W = canvas.width  / this.dpr;
        this.H = canvas.height / this.dpr;

        this.FONT_TITLE = '"Segoe UI", monospace';
        this.FONT_UI    = '"Segoe UI", sans-serif';
        this.loadFonts();

        this.gameState = 'menu';
        this.score     = 0;
        this.bestScore = parseInt(localStorage.getItem('flappy_best') || '0');
        this.paused    = false;
        this.destroyed = false;

        this.bird = {
            x:        this.W * 0.25,
            y:        this.H * 0.45,
            r:        this.isMobile ? 15 : 17,
            vy:       0,
            gravity:  0.38,
            flapPow:  -7.2,
            rotation: 0,
            flapAnim: 0,
            trail:    [],
            pulseT:   0,
            alive:    true
        };

        this.pipes        = [];
        this.pipeW        = this.isMobile ? 55 : 64;
        this.pipeGap      = this.isMobile ? 165 : 180;
        this.pipeSpeed    = 2.0;
        this.pipeDist     = this.isMobile ? 230 : 260;
        this.nextPipeX    = 0;
        this.pipeCount    = 0;

        this.groundH  = this.isMobile ? 60 : 68;
        this.groundX  = 0;

        // ✅ MOBILE FIX: Reduced counts
        this.particles  = [];
        this.floatTexts = [];
        this.rings      = [];
        this.MAX_PARTICLES = this.isMobile ? 30 : 80;

        this.stars     = this.makeStars(this.isMobile ? 30 : 70);
        this.clouds    = this.makeClouds();
        this.bgLayers  = this.makeBgLayers();

        // ✅ Pre-render bird canvas
        this.birdCanvas = null;
        this.birdCi     = -1;
        this.prebuildBird();

        this.screenShake = { x: 0, y: 0, timer: 0, force: 0 };
        this.flashAlpha  = 0;
        this.flashColor  = '#fff';
        this.bgTime      = 0;

        // ✅ Cached static bg
        this.bgCache      = null;
        this.bgCacheValid = false;

        this.deathTimer = 0;
        this.menuBirdY  = this.H * 0.4;
        this.menuBirdT  = 0;

        // ✅ FPS tracking
        this.frame        = 0;
        this.fpsHistory   = [];
        this.adaptiveMode = false;

        this.boundClick = this.handleInput.bind(this);
        this.boundKey   = this.handleKey.bind(this);
        this.boundTouch = this.handleTouch.bind(this);

        canvas.addEventListener('click',      this.boundClick);
        canvas.addEventListener('touchstart', this.boundTouch, { passive: false });
        document.addEventListener('keydown',  this.boundKey);

        this.lastTime = 0;
        this.animId   = requestAnimationFrame(t => this.loop(t));
    }

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
                if (document.fonts.check('12px Rajdhani')) this.FONT_UI    = 'Rajdhani, sans-serif';
            });
        }
    }

    // ✅ Fast integer math
    dX(x)  { return x * this.dpr | 0; }
    dY(y)  { return y * this.dpr | 0; }
    dS(s)  { return s * this.dpr; }
    dSr(s) { return s * this.dpr | 0; }

    // ══════════════════════════════════════════
    // TEXT
    // ══════════════════════════════════════════
    drawText(ctx, text, x, y, opts = {}) {
        const {
            size        = 14,
            weight      = 'bold',
            color       = '#fff',
            align       = 'left',
            baseline    = 'alphabetic',
            family      = null,
            glow        = false,
            glowColor   = null,
            glowBlur    = 0,
            stroke      = false,
            strokeColor = 'rgba(0,0,0,0.88)',
            strokeWidth = 3,
            opacity     = 1,
        } = opts;

        if (opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha  = Math.min(1, opacity);
        ctx.textAlign    = align;
        ctx.textBaseline = baseline;
        ctx.font = `${weight} ${Math.round(size * this.dpr)}px ${family || this.FONT_UI}`;

        const px = this.dX(x), py = this.dY(y);

        if (stroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth   = strokeWidth * this.dpr;
            ctx.lineJoin    = 'round';
            ctx.strokeText(text, px, py);
        }

        // ✅ Glow only on desktop
        if (glow && glowBlur > 0 && !this.isMobile) {
            ctx.shadowBlur  = glowBlur * this.dpr * 1.5;
            ctx.shadowColor = glowColor || color;
        }

        ctx.fillStyle = color;
        ctx.fillText(text, px, py);
        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
        ctx.restore();
    }

    drawRoundRect(ctx, x, y, w, h, r) {
        const dx = this.dX(x), dy = this.dY(y);
        const dw = this.dSr(w), dh = this.dSr(h), dr = this.dS(r);
        ctx.beginPath();
        ctx.moveTo(dx + dr, dy);
        ctx.arcTo(dx+dw, dy,    dx+dw, dy+dh, dr);
        ctx.arcTo(dx+dw, dy+dh, dx,    dy+dh, dr);
        ctx.arcTo(dx,    dy+dh, dx,    dy,    dr);
        ctx.arcTo(dx,    dy,    dx+dw, dy,    dr);
        ctx.closePath();
    }

    hexToRgba(hex, a) {
        if (!hex || hex[0] !== '#') return hex;
        return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${Math.max(0,Math.min(1,a))})`;
    }

    fmtNum(n) {
        if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
        if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
        return ''+n;
    }

    // ══════════════════════════════════════════
    // ✅ PRE-RENDER BIRD
    // ══════════════════════════════════════════
    prebuildBird() {
        const r    = this.bird.r;
        const pad  = 12;
        const size = Math.ceil((r + pad) * 2 * this.dpr);
        const bc   = document.createElement('canvas');
        bc.width = bc.height = size;
        const bx = bc.getContext('2d');
        const cx = size / 2, cy = size / 2;
        const dr = r * this.dpr;

        // Body gradient
        const bg = bx.createRadialGradient(
            cx - dr*0.3, cy - dr*0.3, dr*0.05,
            cx, cy, dr
        );
        bg.addColorStop(0,   '#88F0FF');
        bg.addColorStop(0.4, '#00D4FF');
        bg.addColorStop(1,   '#004488');
        bx.fillStyle = bg;
        bx.beginPath();
        bx.arc(cx, cy, dr, 0, Math.PI*2);
        bx.fill();

        // Border
        bx.strokeStyle = 'rgba(255,255,255,0.6)';
        bx.lineWidth   = 1.5 * this.dpr;
        bx.stroke();

        // Eye white
        const ex = cx + dr*0.3, ey = cy - dr*0.2;
        bx.fillStyle = '#fff';
        bx.beginPath();
        bx.arc(ex, ey, dr*0.27, 0, Math.PI*2);
        bx.fill();

        // Pupil
        bx.fillStyle = '#001830';
        bx.beginPath();
        bx.arc(ex + 1.5*this.dpr, ey, dr*0.13, 0, Math.PI*2);
        bx.fill();

        // Eye shine
        bx.fillStyle = 'rgba(255,255,255,0.85)';
        bx.beginPath();
        bx.arc(ex + 2*this.dpr, ey - 2*this.dpr, dr*0.065, 0, Math.PI*2);
        bx.fill();

        // Beak
        bx.fillStyle   = '#FFB820';
        bx.strokeStyle = '#BB8800';
        bx.lineWidth   = 0.7 * this.dpr;
        bx.beginPath();
        bx.moveTo(cx + dr*0.62,  cy - dr*0.07);
        bx.lineTo(cx + dr*1.02,  cy);
        bx.lineTo(cx + dr*0.62,  cy + dr*0.11);
        bx.closePath();
        bx.fill(); bx.stroke();

        // Body shine
        bx.fillStyle = 'rgba(255,255,255,0.18)';
        bx.beginPath();
        bx.arc(cx - dr*0.2, cy - dr*0.23, dr*0.3, 0, Math.PI*2);
        bx.fill();

        this.birdCanvas = bc;
        this.birdSize   = size;
    }

    // ══════════════════════════════════════════
    // WORLD
    // ══════════════════════════════════════════
    makeStars(n) {
        return Array.from({ length: n }, () => ({
            x:     Math.random() * (this.W || 400),
            y:     Math.random() * (this.H || 700) * 0.75,
            r:     Math.random() * 1.4 + 0.2,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.012 + 0.003,
            color: Math.random() > 0.7 ? '#B947D9' : '#fff'
        }));
    }

    makeClouds() {
        return Array.from({ length: this.isMobile ? 5 : 7 }, (_, i) => ({
            x:     (this.W || 400) * (i / 7) + Math.random() * 60,
            y:     Math.random() * (this.H || 700) * 0.45 + 30,
            w:     Math.random() * 65 + 45,
            h:     Math.random() * 20 + 12,
            speed: Math.random() * 0.25 + 0.1,
            alpha: Math.random() * 0.1 + 0.04,
            color: Math.random() > 0.5 ? '#B947D9' : '#00D4FF'
        }));
    }

    makeBgLayers() {
        const W = this.W || 400, H = this.H || 700;
        const groundY = H - (this.groundH || 64);
        const count = this.isMobile ? 12 : 18;
        return Array.from({ length: count }, (_, i) => ({
            x:     (W / count) * i + Math.random() * 10,
            w:     Math.random() * 20 + 10,
            h:     Math.random() * 75 + 28,
            color: Math.random() > 0.5
                ? `rgba(185,71,217,${(Math.random()*0.07+0.02).toFixed(3)})`
                : `rgba(0,212,255,${(Math.random()*0.06+0.02).toFixed(3)})`,
            speed: Math.random() * 0.3 + 0.12,
            baseY: groundY
        }));
    }

    // ══════════════════════════════════════════
    // INPUT
    // ══════════════════════════════════════════
    handleInput() {
        if (this.paused) return;
        if (this.gameState === 'menu')    { this.startGame(); return; }
        if (this.gameState === 'dead')    { if (this.deathTimer > 700) this.restart(); return; }
        if (this.gameState === 'playing') this.flap();
    }

    handleTouch(e) { e.preventDefault(); this.handleInput(); }
    handleKey(e) {
        if (['Space','ArrowUp','KeyW'].includes(e.code)) {
            e.preventDefault();
            this.handleInput();
        }
    }

    flap() {
        if (!this.bird.alive) return;
        this.bird.vy       = this.bird.flapPow;
        this.bird.flapAnim = 1;
        // ✅ Fewer particles on mobile
        if (!this.isMobile) {
            this.spawnParticles(this.bird.x - 6, this.bird.y + 5, '#00D4FF', 3, { spread: 2, vy: 1.2 });
        }
        this.rings.push({ x: this.bird.x, y: this.bird.y, r: this.bird.r, opacity: 0.45, color: '#00D4FF' });
        if (window.audioManager) audioManager.play('click');
    }

    startGame() {
        this.gameState  = 'playing';
        this.score      = 0;
        this.pipes      = [];
        this.pipeCount  = 0;
        this.pipeSpeed  = 2.0;
        this.pipeGap    = this.isMobile ? 165 : 180;
        this.pipeDist   = this.isMobile ? 230 : 260;
        this.particles  = [];
        this.floatTexts = [];
        this.rings      = [];

        this.bird.y        = this.H * 0.42;
        this.bird.vy       = 0;
        this.bird.rotation = 0;
        this.bird.trail    = [];
        this.bird.alive    = true;
        this.bird.flapAnim = 0;

        this.nextPipeX = this.W + 80;
        this.bgCacheValid = false;
        this.onScore(0);
    }

    restart() {
        this.deathTimer = 0;
        this.startGame();
    }

    // ══════════════════════════════════════════
    // PIPE SPAWN
    // ══════════════════════════════════════════
    spawnPipe() {
        const margin  = this.H * 0.14;
        const minTop  = margin;
        const maxTop  = this.H - this.groundH - this.pipeGap - margin;
        const gapTop  = minTop + Math.random() * (maxTop - minTop);

        const themes = [
            { body: '#00D4FF', shine: '#AAEEFF', dark: '#0077AA', glow: '#00D4FF' },
            { body: '#00FF88', shine: '#AAFFCC', dark: '#008844', glow: '#00FF88' },
            { body: '#B947D9', shine: '#DDA0F0', dark: '#7722AA', glow: '#B947D9' },
            { body: '#FFD700', shine: '#FFEE88', dark: '#AA8800', glow: '#FFD700' },
        ];
        const theme = themes[this.pipeCount % themes.length];

        this.pipes.push({
            x:      this.nextPipeX,
            gapTop,
            gapBot: gapTop + this.pipeGap,
            passed: false,
            scored: false,
            theme,
            // ✅ Pre-cache pipe canvas
            topH:   gapTop,
            botH:   this.H - this.groundH - (gapTop + this.pipeGap)
        });

        this.nextPipeX = this.nextPipeX + this.pipeDist;
        this.pipeCount++;
    }

    // ══════════════════════════════════════════
    // UPDATE
    // ══════════════════════════════════════════
    update(dt) {
        if (this.paused) return;

        this.frame++;
        this.bgTime += dt * 0.001;

        // Stars — every 2nd frame on mobile
        if (!this.isMobile || this.frame % 2 === 0) {
            this.stars.forEach(s => s.phase += s.speed);
        }

        // Shake
        if (this.screenShake.timer > 0) {
            const f = this.screenShake.force * (this.screenShake.timer / 14) * (this.isMobile ? 0.55 : 1);
            this.screenShake.x = (Math.random()-0.5)*f;
            this.screenShake.y = (Math.random()-0.5)*f*0.35;
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.025);

        // Rings
        for (let i = this.rings.length-1; i >= 0; i--) {
            const rg = this.rings[i];
            rg.r      += this.isMobile ? 3.5 : 3;
            rg.opacity -= 0.05;
            if (rg.opacity <= 0) this.rings.splice(i, 1);
        }

        // Clouds — every 2nd frame on mobile
        if (!this.isMobile || this.frame % 2 === 0) {
            this.clouds.forEach(c => {
                c.x -= c.speed * (dt/16.67);
                if (c.x + c.w < 0) c.x = this.W + c.w;
            });
            this.bgLayers.forEach(b => {
                b.x -= b.speed * (dt/16.67);
                if (b.x + b.w < 0) b.x = this.W + b.w;
            });
        }

        if (this.gameState === 'menu') {
            this.menuBirdT += dt * 0.002;
            this.menuBirdY = this.H * 0.4 + Math.sin(this.menuBirdT * 1.4) * 12;
            this.updateParticles();
            return;
        }

        if (this.gameState === 'dead') {
            this.deathTimer += dt;
            const groundTop = this.H - this.groundH - this.bird.r;
            if (this.bird.y < groundTop) {
                this.bird.vy  += this.bird.gravity * (dt/16.67);
                this.bird.y   += this.bird.vy * (dt/16.67);
                this.bird.rotation = Math.min(Math.PI * 0.75, this.bird.rotation + 0.07);
                if (this.bird.y >= groundTop) {
                    this.bird.y  = groundTop;
                    this.bird.vy = 0;
                    if (!this.isMobile) {
                        this.spawnParticles(this.bird.x, this.bird.y, '#FF006E', 6, { spread: 3, vy: -2 });
                    }
                }
            }
            this.updateParticles();
            this.updateFloatTexts();
            return;
        }

        // ── PLAYING ──
        const spd = dt / 16.67;

        // Bird physics
        this.bird.vy       += this.bird.gravity * spd;
        this.bird.y        += this.bird.vy * spd;
        this.bird.rotation  = Math.max(-0.42, Math.min(Math.PI * 0.4, this.bird.vy * 0.052));
        this.bird.pulseT   += dt * 0.005;
        if (this.bird.flapAnim > 0) this.bird.flapAnim = Math.max(0, this.bird.flapAnim - dt/160);

        // Trail — shorter on mobile
        this.bird.trail.unshift({ x: this.bird.x, y: this.bird.y });
        const maxTrail = this.isMobile ? 6 : 11;
        if (this.bird.trail.length > maxTrail) this.bird.trail.pop();

        // Ground scroll
        this.groundX = ((this.groundX - this.pipeSpeed * 1.4 * spd) % 40 + 40) % 40;

        // Pipes
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            p.x -= this.pipeSpeed * spd;

            if (!p.scored && p.x + this.pipeW < this.bird.x - this.bird.r) {
                p.scored = true;
                this.score++;

                if (this.score > this.bestScore) {
                    this.bestScore = this.score;
                    localStorage.setItem('flappy_best', this.bestScore);
                }
                this.onScore(this.score);

                this.pipeSpeed = Math.min(5.2, 2.0 + this.score * 0.065);
                this.pipeGap   = Math.max(
                    this.isMobile ? 120 : 132,
                    (this.isMobile ? 165 : 180) - this.score * 2
                );
                this.pipeDist  = Math.max(
                    this.isMobile ? 190 : 210,
                    (this.isMobile ? 230 : 260) - this.score * 1.5
                );

                this.floatTexts.push({
                    x: this.W * 0.5, y: 80,
                    text: '+1', color: '#FFD700',
                    life: 40, maxLife: 40, vy: -0.8, scale: 0.4, opacity: 0
                });
                this.rings.push({ x: this.bird.x, y: this.bird.y, r: 10, opacity: 0.6, color: '#FFD700' });

                if (!this.isMobile) {
                    this.spawnParticles(this.bird.x, this.bird.y, '#FFD700', 5);
                }

                if (this.score > 0 && this.score % 5 === 0) {
                    this.floatTexts.push({
                        x: this.W/2, y: this.H/2 - 50,
                        text: `${this.score} ★`, color: '#00FF88',
                        life: 65, maxLife: 65, vy: -0.5, scale: 0.3, opacity: 0
                    });
                    this.screenShake.timer = this.isMobile ? 3 : 5;
                    this.screenShake.force = this.isMobile ? 1.8 : 2.5;
                }
                if (window.audioManager) audioManager.play('score');
            }

            if (p.x + this.pipeW < -20) this.pipes.splice(i, 1);
        }

        this.nextPipeX -= this.pipeSpeed * spd;
        if (this.nextPipeX <= this.W + this.pipeW) {
            this.spawnPipe();
        }

        if (this.bird.alive) this.checkCollisions();
        this.updateParticles();
        this.updateFloatTexts();
    }

    // ══════════════════════════════════════════
    // COLLISION
    // ══════════════════════════════════════════
    checkCollisions() {
        const b  = this.bird;
        const cr = b.r * 0.72;

        if (b.y - cr < 0)                    { this.die(); return; }
        if (b.y + cr > this.H - this.groundH) { this.die(); return; }

        for (const p of this.pipes) {
            const pLeft  = p.x;
            const pRight = p.x + this.pipeW;
            if (b.x + cr < pLeft || b.x - cr > pRight) continue;

            if (this.circleRectCollide(b.x, b.y, cr, pLeft, 0,          pRight, p.gapTop)) { this.die(); return; }
            if (this.circleRectCollide(b.x, b.y, cr, pLeft, p.gapBot,   pRight, this.H - this.groundH)) { this.die(); return; }
        }
    }

    circleRectCollide(cx, cy, r, x1, y1, x2, y2) {
        const nearX = Math.max(x1, Math.min(cx, x2));
        const nearY = Math.max(y1, Math.min(cy, y2));
        const dx = cx - nearX, dy = cy - nearY;
        return (dx*dx + dy*dy) < (r*r);
    }

    die() {
        if (!this.bird.alive) return;
        this.bird.alive = false;
        this.gameState  = 'dead';
        this.deathTimer = 0;

        this.spawnParticles(this.bird.x, this.bird.y, '#FF006E', this.isMobile ? 12 : 22, { spread: 6 });
        this.flashAlpha = 0.45; this.flashColor = '#FF0033';
        this.screenShake.timer = this.isMobile ? 10 : 18;
        this.screenShake.force = this.isMobile ? 5  : 9;

        this.floatTexts.push({
            x: this.W/2, y: this.H/2 - 55,
            text: 'CRASH!', color: '#FF006E',
            life: 75, maxLife: 75, vy: -0.45, scale: 0.2, opacity: 0
        });

        if (window.audioManager) audioManager.play('fail');
        this.onScore(this.score, true);
    }

    updateParticles() {
        for (let i = this.particles.length-1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.vx *= 0.97;
            p.life--; p.size *= 0.95;
            if (p.life <= 0 || p.size < 0.3) this.particles.splice(i, 1);
        }
    }

    updateFloatTexts() {
        for (let i = this.floatTexts.length-1; i >= 0; i--) {
            const t = this.floatTexts[i];
            t.y += t.vy; t.life--;
            t.opacity = t.life < 15 ? t.life/15 : (t.maxLife - t.life < 8 ? (t.maxLife - t.life)/8 : 1);
            t.scale  += (1 - t.scale) * 0.18;
            if (t.life <= 0) this.floatTexts.splice(i, 1);
        }
    }

    spawnParticles(x, y, color, count, opts = {}) {
        const spread = opts.spread || 5;
        const baseVY = opts.vy    || 0;
        const c = Math.min(count, this.MAX_PARTICLES - this.particles.length);
        for (let i = 0; i < c; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = Math.random() * spread + 1;
            this.particles.push({
                x, y,
                vx: Math.cos(a)*sp, vy: Math.sin(a)*sp*0.5 + baseVY,
                color, size: Math.random()*4+1.5,
                life: Math.floor(Math.random()*16+10)
            });
        }
    }

    // ══════════════════════════════════════════
    // DRAW
    // ══════════════════════════════════════════
    draw(timestamp) {
        const ctx = this.ctx;

        // ✅ Fill base
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.screenShake.x || this.screenShake.y)
            ctx.translate(this.dS(this.screenShake.x), this.dS(this.screenShake.y));

        this.drawBackground(ctx);
        if (!this.isMobile || this.frame % 2 === 0) this.drawClouds(ctx);
        this.drawCityBg(ctx);
        this.drawPipes(ctx);
        this.drawGround(ctx);
        this.drawRingsFX(ctx);

        if (this.gameState === 'menu') {
            this.drawMenuBird(ctx);
            this.drawMenu(ctx);
        } else {
            this.drawBirdTrail(ctx);
            this.drawBird(ctx);
            this.drawParticles(ctx);
            this.drawFloatTexts(ctx);
        }

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.gameState === 'playing') this.drawHUD(ctx);

        if (this.gameState === 'dead') {
            this.drawParticles(ctx);
            this.drawFloatTexts(ctx);
            this.drawDeathScreen(ctx);
        }

        ctx.restore();
    }

    // ✅ Simplified BG for mobile
    drawBackground(ctx) {
        const W = this.W, H = this.H;

        // Static sky — recreate only when needed
        if (!this.skyGrad || this._skyW !== W) {
            this.skyGrad = ctx.createLinearGradient(0, 0, 0, this.dY(H * 0.78));
            this.skyGrad.addColorStop(0,    '#050215');
            this.skyGrad.addColorStop(0.45, '#090420');
            this.skyGrad.addColorStop(1,    '#0d0e2e');
            this._skyW = W;
        }
        ctx.fillStyle = this.skyGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars — skip every other frame on mobile
        if (!this.isMobile || this.frame % 2 === 0) {
            for (const s of this.stars) {
                const alpha = 0.12 + ((Math.sin(s.phase)+1)/2)*0.5;
                ctx.globalAlpha = alpha;
                ctx.fillStyle   = s.color;
                ctx.beginPath();
                ctx.arc(this.dX(s.x), this.dY(s.y), Math.max(0.4, this.dS(s.r)), 0, Math.PI*2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // Moon — desktop only or every 3rd frame
        if (!this.isMobile) {
            const mx = W*0.82, my = H*0.1, mr = 27;
            const mg = ctx.createRadialGradient(
                this.dX(mx - mr*0.3), this.dY(my - mr*0.3), this.dS(mr*0.08),
                this.dX(mx), this.dY(my), this.dS(mr)
            );
            mg.addColorStop(0,   'rgba(235,235,255,0.88)');
            mg.addColorStop(0.6, 'rgba(180,180,240,0.62)');
            mg.addColorStop(1,   'rgba(100,100,200,0.22)');
            ctx.fillStyle = mg;
            ctx.beginPath();
            ctx.arc(this.dX(mx), this.dY(my), this.dS(mr), 0, Math.PI*2);
            ctx.fill();
        }

        // Vignette — simplified
        if (!this.vigGrad || this._vigW !== W) {
            this.vigGrad = ctx.createRadialGradient(
                this.dX(W/2), this.dY(H/2), this.dS(H*0.08),
                this.dX(W/2), this.dY(H/2), this.dS(H*0.95)
            );
            this.vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
            this.vigGrad.addColorStop(1, 'rgba(0,0,0,0.48)');
            this._vigW = W;
        }
        ctx.fillStyle = this.vigGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawClouds(ctx) {
        for (const c of this.clouds) {
            ctx.globalAlpha = c.alpha;
            ctx.fillStyle   = c.color + '22';
            ctx.beginPath();
            ctx.ellipse(this.dX(c.x), this.dY(c.y), this.dS(c.w*0.55), this.dS(c.h*0.7), 0, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawCityBg(ctx) {
        for (const b of this.bgLayers) {
            ctx.fillStyle = b.color;
            ctx.fillRect(this.dX(b.x), this.dY(b.baseY - b.h), this.dSr(b.w), this.dSr(b.h));
        }
    }

    // ══════════════════════════════════════════
    // PIPES — ✅ No shadow on mobile
    // ══════════════════════════════════════════
    drawPipes(ctx) {
        this.pipes.forEach(p => {
            const th = p.theme;
            const pW = this.pipeW;
            this.drawOnePipe(ctx, p.x, 0,       pW, p.gapTop,                          th, 'top');
            this.drawOnePipe(ctx, p.x, p.gapBot, pW, this.H - this.groundH - p.gapBot, th, 'bot');
        });
    }

    drawOnePipe(ctx, px, py, pw, ph, theme, side) {
        if (ph <= 2) return;
        const capH   = 20;
        const capExt = 5;
        const isTop  = side === 'top';
        const capY   = isTop ? py + ph - capH : py;

        // ✅ Body — no shadow on mobile
        const bg = ctx.createLinearGradient(this.dX(px), 0, this.dX(px+pw), 0);
        bg.addColorStop(0,    this.hexToRgba(theme.dark,  0.9));
        bg.addColorStop(0.25, this.hexToRgba(theme.body,  0.95));
        bg.addColorStop(0.5,  this.hexToRgba(theme.shine, 0.8));
        bg.addColorStop(0.75, this.hexToRgba(theme.body,  0.92));
        bg.addColorStop(1,    this.hexToRgba(theme.dark,  0.86));

        if (!this.isMobile) {
            ctx.shadowBlur  = this.dS(8);
            ctx.shadowColor = theme.glow;
        }
        ctx.fillStyle = bg;
        ctx.fillRect(this.dX(px), this.dY(py), this.dSr(pw), this.dSr(ph));
        ctx.shadowBlur = 0;

        // Shine stripe
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(this.dX(px + pw*0.2), this.dY(py), this.dSr(pw*0.14), this.dSr(ph));

        // Cap
        const cg = ctx.createLinearGradient(this.dX(px-capExt), 0, this.dX(px+pw+capExt), 0);
        cg.addColorStop(0,   this.hexToRgba(theme.dark,  0.94));
        cg.addColorStop(0.25,this.hexToRgba(theme.body,  1));
        cg.addColorStop(0.5, this.hexToRgba(theme.shine, 0.9));
        cg.addColorStop(0.75,this.hexToRgba(theme.body,  1));
        cg.addColorStop(1,   this.hexToRgba(theme.dark,  0.94));

        if (!this.isMobile) {
            ctx.shadowBlur  = this.dS(11);
            ctx.shadowColor = theme.glow;
        }
        ctx.fillStyle = cg;
        this.drawRoundRect(ctx, px-capExt, capY, pw+capExt*2, capH, 5);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = this.hexToRgba(theme.shine, 0.5);
        ctx.lineWidth   = this.dS(1.2);
        this.drawRoundRect(ctx, px-capExt, capY, pw+capExt*2, capH, 5);
        ctx.stroke();
    }

    // ══════════════════════════════════════════
    // GROUND
    // ══════════════════════════════════════════
    drawGround(ctx) {
        const W = this.W, H = this.H, gh = this.groundH, gy = H - gh;

        if (!this.groundGrad || this._groundH !== H) {
            this.groundGrad = ctx.createLinearGradient(0, this.dY(gy), 0, this.dY(H));
            this.groundGrad.addColorStop(0,   '#1a0935');
            this.groundGrad.addColorStop(0.2, '#110720');
            this.groundGrad.addColorStop(1,   '#080410');
            this._groundH = H;
        }
        ctx.fillStyle = this.groundGrad;
        ctx.fillRect(0, this.dY(gy), this.canvas.width, this.dSr(gh));

        // Top neon line
        if (!this.isMobile) ctx.shadowBlur = this.dS(10);
        ctx.shadowColor = '#B947D9';
        ctx.strokeStyle = 'rgba(185,71,217,0.82)';
        ctx.lineWidth   = this.dS(2);
        ctx.beginPath();
        ctx.moveTo(0, this.dY(gy));
        ctx.lineTo(this.canvas.width, this.dY(gy));
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Grid lines — every 2nd frame on mobile
        if (!this.isMobile || this.frame % 2 === 0) {
            ctx.globalAlpha = 0.14;
            ctx.strokeStyle = '#B947D9';
            ctx.lineWidth   = this.dS(0.6);
            const tW = 38;
            const off = this.groundX % tW;
            for (let x = -tW + off; x < W + tW; x += tW) {
                ctx.beginPath();
                ctx.moveTo(this.dX(x), this.dY(gy + 5));
                ctx.lineTo(this.dX(x), this.dY(H));
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    }

    drawRingsFX(ctx) {
        for (const rg of this.rings) {
            ctx.globalAlpha = rg.opacity;
            ctx.strokeStyle = rg.color;
            ctx.lineWidth   = this.dS(2 * rg.opacity);
            if (!this.isMobile) {
                ctx.shadowBlur  = this.dS(7);
                ctx.shadowColor = rg.color;
            }
            ctx.beginPath();
            ctx.arc(this.dX(rg.x), this.dY(rg.y), this.dS(rg.r), 0, Math.PI*2);
            ctx.stroke();
            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 1;
        }
    }

    drawBirdTrail(ctx) {
        const trail = this.bird.trail;
        const len   = trail.length;
        for (let i = 0; i < len; i++) {
            const pt    = trail[i];
            const alpha = (1 - i/len) * 0.22;
            const r     = this.bird.r * (1 - i/len) * 0.55;
            if (r < 0.5 || alpha < 0.02) continue;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#00D4FF';
            ctx.beginPath();
            ctx.arc(this.dX(pt.x), this.dY(pt.y), Math.max(0.4, this.dS(r)), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ══════════════════════════════════════════
    // ✅ BIRD — uses pre-rendered canvas + wing overlay
    // ══════════════════════════════════════════
    _drawBirdAt(ctx, cx, cy, rot, flapAnim, pulseT) {
        const r    = this.bird.r;
        const pad  = 12;
        const size = this.birdSize;

        ctx.save();
        ctx.translate(this.dX(cx), this.dY(cy));
        ctx.rotate(rot);

        // Outer ring — desktop only
        if (!this.isMobile) {
            ctx.strokeStyle = 'rgba(0,212,255,0.32)';
            ctx.lineWidth   = this.dS(2);
            ctx.beginPath();
            ctx.arc(0, 0, this.dS(r + 6), 0, Math.PI*2);
            ctx.stroke();
        }

        // Draw pre-rendered bird body
        if (this.birdCanvas) {
            ctx.drawImage(this.birdCanvas, -size/2, -size/2, size, size);
        }

        // Wing — drawn live (animated)
        const dr        = r * this.dpr;
        const wingBaseY = dr * 0.22;
        const wingAng   = flapAnim > 0
            ? -Math.PI * 0.48 * flapAnim
            : Math.PI * 0.1 * Math.sin(pulseT * 2.8);
        const wingLen   = dr * 1.02;
        const wingEX    = Math.cos(wingAng + Math.PI*0.18) * wingLen;
        const wingEY    = wingBaseY + Math.sin(wingAng + Math.PI*0.18) * wingLen;

        ctx.strokeStyle = 'rgba(0,195,235,0.88)';
        ctx.lineWidth   = dr * 0.23;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(-dr*0.12, wingBaseY);
        ctx.quadraticCurveTo(-dr*0.52, wingBaseY + dr*0.26, wingEX, wingEY);
        ctx.stroke();
        ctx.lineCap = 'butt';

        ctx.restore();
    }

    drawBird(ctx) {
        const b = this.bird;
        this._drawBirdAt(ctx, b.x, b.y, b.rotation, b.flapAnim, b.pulseT);
    }

    drawMenuBird(ctx) {
        const t   = this.menuBirdT;
        const rot = Math.sin(t * 1.4) * 0.1;
        this._drawBirdAt(ctx, this.W * 0.5, this.menuBirdY, rot, 0, t);
    }

    // ══════════════════════════════════════════
    // MENU
    // ══════════════════════════════════════════
    drawMenu(ctx) {
        const W = this.W, H = this.H, t = this.bgTime;

        // Title card
        ctx.fillStyle = 'rgba(4,1,16,0.86)';
        this.drawRoundRect(ctx, W/2-155, H*0.12, 310, 105, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,212,255,0.22)';
        ctx.lineWidth   = this.dS(1.2);
        this.drawRoundRect(ctx, W/2-155, H*0.12, 310, 105, 16);
        ctx.stroke();

        this.drawText(ctx, 'FLAPPY', W/2, H*0.14 + 26, {
            size: 28, weight: '900', color: '#00D4FF',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#00D4FF', glowBlur: 12,
            stroke: true, strokeColor: 'rgba(0,0,0,0.88)', strokeWidth: 4,
            family: this.FONT_TITLE
        });
        this.drawText(ctx, 'NEON BIRD', W/2, H*0.14 + 60, {
            size: 17, weight: '900', color: '#B947D9',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#B947D9', glowBlur: 8,
            stroke: true, strokeColor: 'rgba(0,0,0,0.88)', strokeWidth: 3,
            family: this.FONT_TITLE
        });
        this.drawText(ctx, 'CINEMATIC EDITION', W/2, H*0.14 + 84, {
            size: 8, weight: '600', color: 'rgba(180,180,220,0.42)',
            align: 'center', baseline: 'middle', family: this.FONT_UI
        });

        if (this.bestScore > 0) {
            this.drawText(ctx, `BEST: ${this.bestScore}`, W/2, H*0.60, {
                size: 13, weight: '800', color: '#FFD700',
                align: 'center', baseline: 'middle',
                glow: true, glowColor: '#FFD700', glowBlur: 6,
                family: this.FONT_TITLE
            });
        }

        const pulse = 0.62 + Math.sin(t * 2.8) * 0.32;
        this.drawText(ctx, '▶  TAP  TO  FLY', W/2, H*0.70, {
            size: 13, weight: '800', color: '#00FF88',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#00FF88', glowBlur: 7,
            family: this.FONT_TITLE, opacity: pulse
        });
        this.drawText(ctx, 'SPACE / CLICK / TAP', W/2, H*0.76, {
            size: 9, color: 'rgba(180,180,220,0.35)',
            align: 'center', baseline: 'middle', family: this.FONT_UI
        });

        const tips = ['Tap to flap wings', 'Fly through the gaps', "Don't touch the pipes!"];
        tips.forEach((tip, i) => {
            this.drawText(ctx, tip, W/2, H*0.84 + i*17, {
                size: 9, color: 'rgba(155,155,200,0.38)',
                align: 'center', baseline: 'middle', family: this.FONT_UI
            });
        });
    }

    drawParticles(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = Math.min(1, p.life / 10);
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(this.dX(p.x), this.dY(p.y), Math.max(0.4, this.dS(p.size)), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawFloatTexts(ctx) {
        for (const t of this.floatTexts) {
            const sc = Math.min(1, t.scale);
            this.drawText(ctx, t.text, t.x, t.y, {
                size: 12 * sc, weight: '900', color: t.color,
                align: 'center', baseline: 'middle', opacity: t.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.65)', strokeWidth: 2.5,
                glow: !this.isMobile, glowColor: t.color, glowBlur: 7,
                family: this.FONT_TITLE
            });
        }
    }

    // ══════════════════════════════════════════
    // HUD
    // ══════════════════════════════════════════
    drawHUD(ctx) {
        const W = this.W;

        this.drawText(ctx, String(this.score), W/2, 50, {
            size: 32, weight: '900', color: '#fff',
            align: 'center', baseline: 'middle',
            glow: !this.isMobile, glowColor: '#00D4FF', glowBlur: 9,
            stroke: true, strokeColor: 'rgba(0,0,0,0.65)', strokeWidth: 4,
            family: this.FONT_TITLE
        });

        this.drawText(ctx, `BEST: ${this.bestScore}`, W - 10, 20, {
            size: 10, weight: '700', color: 'rgba(255,215,0,0.5)',
            align: 'right', baseline: 'middle', family: this.FONT_UI
        });

        const sc = Math.min(1, (this.pipeSpeed - 2.0) / 3.2);
        const speedCol = sc < 0.4 ? '#00FF88' : sc < 0.75 ? '#FFD700' : '#FF006E';
        this.drawText(ctx, `${this.pipeSpeed.toFixed(1)}x`, 10, 20, {
            size: 10, weight: '700', color: speedCol,
            baseline: 'middle', family: this.FONT_UI
        });
    }

    // ══════════════════════════════════════════
    // DEATH SCREEN
    // ══════════════════════════════════════════
    drawDeathScreen(ctx) {
        const W = this.W, H = this.H;
        const elapsed = this.deathTimer;
        const alpha   = Math.min(1, elapsed / 400);

        ctx.fillStyle = `rgba(0,0,0,${(alpha * 0.68).toFixed(3)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.25) return;
        const cA = Math.min(1, (alpha - 0.25) / 0.75);
        const cx = W/2, cy = H/2;

        ctx.globalAlpha = cA * 0.94;
        ctx.fillStyle   = 'rgba(3,1,16,0.94)';
        this.drawRoundRect(ctx, cx-155, cy-112, 310, 224, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,0,60,0.3)';
        ctx.lineWidth   = this.dS(1.5);
        this.drawRoundRect(ctx, cx-155, cy-112, 310, 224, 20);
        ctx.stroke();
        ctx.globalAlpha = 1;

        this.drawText(ctx, 'GAME OVER', cx, cy - 74, {
            size: 23, weight: '900', color: '#FF006E',
            align: 'center', baseline: 'middle',
            glow: !this.isMobile, glowColor: '#FF006E', glowBlur: 10,
            family: this.FONT_TITLE, opacity: cA
        });

        this.drawText(ctx, 'SCORE', cx, cy - 33, {
            size: 9, weight: '700', color: 'rgba(180,180,220,0.5)',
            align: 'center', baseline: 'middle', family: this.FONT_UI, opacity: cA
        });

        this.drawText(ctx, String(this.score), cx, cy + 5, {
            size: 38, weight: '900', color: '#fff',
            align: 'center', baseline: 'middle',
            glow: !this.isMobile, glowColor: '#00D4FF', glowBlur: 9,
            stroke: true, strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 5,
            family: this.FONT_TITLE, opacity: cA
        });

        this.drawText(ctx, `BEST:  ${this.bestScore}`, cx, cy + 45, {
            size: 13, weight: '800', color: '#FFD700',
            align: 'center', baseline: 'middle',
            glow: !this.isMobile, glowColor: '#FFD700', glowBlur: 5,
            family: this.FONT_TITLE, opacity: cA
        });

        if (this.score > 0 && this.score >= this.bestScore) {
            this.drawText(ctx, '★  NEW BEST!  ★', cx, cy + 72, {
                size: 11, weight: '900', color: '#00FF88',
                align: 'center', baseline: 'middle',
                glow: !this.isMobile, glowColor: '#00FF88', glowBlur: 7,
                family: this.FONT_TITLE, opacity: cA
            });
        }

        if (elapsed > 700) {
            const blink = Math.sin(elapsed / 280) > 0;
            if (blink) {
                this.drawText(ctx, '▶  TAP TO RESTART', cx, cy + 100, {
                    size: 12, weight: '800', color: '#00FF88',
                    align: 'center', baseline: 'middle',
                    glow: !this.isMobile, glowColor: '#00FF88', glowBlur: 7,
                    family: this.FONT_TITLE, opacity: cA * 0.9
                });
            }
        } else {
            this.drawText(ctx, 'Wait...', cx, cy + 100, {
                size: 9, color: 'rgba(160,160,200,0.25)',
                align: 'center', baseline: 'middle',
                family: this.FONT_UI, opacity: cA
            });
        }
    }

    // ══════════════════════════════════════════
    // LOOP — ✅ Adaptive frame skip
    // ══════════════════════════════════════════
    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;

        // ✅ Adaptive: skip draw on weak mobile
        if (this.isMobile) {
            this.fpsHistory.push(dt);
            if (this.fpsHistory.length > 20) this.fpsHistory.shift();
            if (this.fpsHistory.length === 20) {
                const avg = this.fpsHistory.reduce((a,b)=>a+b,0)/20;
                this.adaptiveMode = avg > 22;
            }
            if (this.adaptiveMode && this.frame % 2 === 1) {
                if (!this.paused) this.update(dt);
                this.animId = requestAnimationFrame(t => this.loop(t));
                return;
            }
        }

        if (!this.paused) this.update(dt);
        this.draw(timestamp);
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) this.lastTime = performance.now();
        return this.paused;
    }

    resize() {
        this.dpr = this.isMobile
            ? Math.min(window.devicePixelRatio||1, 1.5)
            : Math.min(window.devicePixelRatio||1, 2);
        this.setupHDCanvas();
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.bird.x  = this.W * 0.25;
        this.groundH = this.isMobile ? 60 : 68;
        this.stars    = this.makeStars(this.isMobile ? 30 : 70);
        this.clouds   = this.makeClouds();
        this.bgLayers = this.makeBgLayers();
        // Reset cached gradients
        this.skyGrad  = null;
        this.vigGrad  = null;
        this.groundGrad = null;
        this.prebuildBird();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click',      this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
        document.removeEventListener('keydown',       this.boundKey);
    }
}