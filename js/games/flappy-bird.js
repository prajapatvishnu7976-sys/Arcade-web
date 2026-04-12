'use strict';

class FlappyBird {
    constructor(canvas, onScore) {
        this.canvas  = canvas;
        this.onScore = onScore;

        this.dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.setupHDCanvas();

        this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

        this.W = canvas.width  / this.dpr;
        this.H = canvas.height / this.dpr;

        this.isMobile = ('ontouchstart' in window) || window.innerWidth < 768;

        this.FONT_TITLE = '"Orbitron", "Segoe UI", monospace';
        this.FONT_UI    = '"Rajdhani", "Segoe UI", sans-serif';
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

        // ── Pipe config ──
        this.pipes        = [];
        this.pipeW        = this.isMobile ? 55 : 64;
        // Gap is generous at start
        this.pipeGap      = this.isMobile ? 165 : 180;
        this.pipeSpeed    = 2.0;
        this.pipeTimer    = 0;
        // Distance between pipe PAIRS (in pixels, not time)
        this.pipeDist     = this.isMobile ? 230 : 260;
        this.nextPipeX    = 0;   // tracks where next pipe should spawn
        this.pipeCount    = 0;   // total pipes spawned

        this.groundH  = this.isMobile ? 60 : 68;
        this.groundX  = 0;

        this.particles  = [];
        this.floatTexts = [];
        this.rings      = [];
        this.stars      = this.makeStars(70);
        this.clouds     = this.makeClouds();
        this.bgLayers   = this.makeBgLayers();

        this.screenShake = { x: 0, y: 0, timer: 0, force: 0 };
        this.flashAlpha  = 0;
        this.flashColor  = '#fff';
        this.bgTime      = 0;

        this.deathTimer = 0;
        this.menuBirdY  = this.H * 0.4;
        this.menuBirdT  = 0;

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

    dX(x)  { return Math.round(x * this.dpr); }
    dY(y)  { return Math.round(y * this.dpr); }
    dS(s)  { return s * this.dpr; }
    dSr(s) { return Math.round(s * this.dpr); }

    // ══════════════════════════════════════════
    // CRISP TEXT
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
        ctx.font = `${weight} ${Math.round(size * this.dpr)}px ${family || (size > 15 ? this.FONT_TITLE : this.FONT_UI)}`;

        const px = this.dX(x), py = this.dY(y);

        if (stroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth   = strokeWidth * this.dpr;
            ctx.lineJoin    = 'round';
            ctx.strokeText(text, px, py);
        }

        if (glow && glowBlur > 0) {
            ctx.save();
            ctx.shadowBlur  = glowBlur * this.dpr * 2;
            ctx.shadowColor = glowColor || color;
            ctx.fillStyle   = glowColor || color;
            ctx.globalAlpha = Math.min(1, opacity) * 0.5;
            ctx.fillText(text, px, py);
            ctx.shadowBlur  = glowBlur * this.dpr * 0.7;
            ctx.globalAlpha = Math.min(1, opacity) * 0.28;
            ctx.fillText(text, px, py);
            ctx.restore();
        }

        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = Math.min(1, opacity);
        ctx.fillStyle   = color;
        ctx.fillText(text, px, py);
        ctx.restore();
    }

    drawRoundRect(ctx, x, y, w, h, r) {
        const dx = this.dX(x), dy = this.dY(y);
        const dw = this.dSr(w), dh = this.dSr(h);
        const dr = this.dS(r);
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
    // WORLD GENERATION
    // ══════════════════════════════════════════
    makeStars(n) {
        return Array.from({ length: n }, () => ({
            x:     Math.random() * (this.W || 400),
            y:     Math.random() * (this.H || 700) * 0.75,
            r:     Math.random() * 1.5 + 0.2,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.014 + 0.003,
            color: Math.random() > 0.8 ? '#B947D9' : Math.random() > 0.6 ? '#00D4FF' : '#fff'
        }));
    }

    makeClouds() {
        return Array.from({ length: 7 }, (_, i) => ({
            x:     (this.W || 400) * (i / 7) + Math.random() * 60,
            y:     Math.random() * (this.H || 700) * 0.45 + 30,
            w:     Math.random() * 70 + 50,
            h:     Math.random() * 22 + 14,
            speed: Math.random() * 0.28 + 0.12,
            alpha: Math.random() * 0.12 + 0.05,
            color: Math.random() > 0.5 ? '#B947D9' : '#00D4FF'
        }));
    }

    makeBgLayers() {
        const W = this.W || 400, H = this.H || 700;
        const groundY = H - (this.groundH || 64);
        return Array.from({ length: 18 }, (_, i) => ({
            x:     (W / 18) * i + Math.random() * 10,
            w:     Math.random() * 22 + 10,
            h:     Math.random() * 80 + 30,
            color: Math.random() > 0.5
                ? `rgba(185,71,217,${Math.random()*0.08+0.03})`
                : `rgba(0,212,255,${Math.random()*0.07+0.02})`,
            speed: Math.random() * 0.35 + 0.15,
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

        this.spawnParticles(this.bird.x - 6, this.bird.y + 5, '#00D4FF', 4, { spread: 2, vy: 1.2 });
        this.rings.push({ x: this.bird.x, y: this.bird.y, r: this.bird.r, opacity: 0.5, color: '#00D4FF' });

        if (window.audioManager) audioManager.play('click');
    }

    startGame() {
        this.gameState  = 'playing';
        this.score      = 0;
        this.pipes      = [];
        this.pipeTimer  = 0;
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

        // First pipe spawns well ahead so player has time to react
        this.nextPipeX = this.W + 80;

        this.onScore(0);
    }

    restart() {
        this.deathTimer = 0;
        this.startGame();
    }

    // ══════════════════════════════════════════
    // PIPE SPAWNING — distance-based (not timer)
    // ══════════════════════════════════════════
    spawnPipe() {
        // Safe zone: never too close to top or ground
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
            theme
        });

        // Schedule next pipe
        this.nextPipeX = this.nextPipeX + this.pipeDist;
        this.pipeCount++;
    }

    // ══════════════════════════════════════════
    // UPDATE
    // ══════════════════════════════════════════
    update(dt) {
        if (this.paused) return;

        this.bgTime += dt * 0.001;
        this.stars.forEach(s => s.phase += s.speed);

        // Shake
        if (this.screenShake.timer > 0) {
            const f = this.screenShake.force * (this.screenShake.timer / 14);
            this.screenShake.x = (Math.random()-0.5)*f;
            this.screenShake.y = (Math.random()-0.5)*f*0.4;
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.02);

        // Rings
        for (let i = this.rings.length-1; i >= 0; i--) {
            const rg = this.rings[i];
            rg.r      += 3;
            rg.opacity -= 0.045;
            if (rg.opacity <= 0) this.rings.splice(i, 1);
        }

        // Clouds
        this.clouds.forEach(c => {
            c.x -= c.speed * (dt/16.67);
            if (c.x + c.w < 0) c.x = this.W + c.w;
        });

        // City
        this.bgLayers.forEach(b => {
            b.x -= b.speed * (dt/16.67);
            if (b.x + b.w < 0) b.x = this.W + b.w;
        });

        if (this.gameState === 'menu') {
            this.menuBirdT += dt * 0.002;
            this.menuBirdY = this.H * 0.4 + Math.sin(this.menuBirdT * 1.4) * 13;
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
                    // Ground hit bounce particles
                    this.spawnParticles(this.bird.x, this.bird.y, '#FF006E', 8, { spread: 3, vy: -2 });
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

        // Trail
        this.bird.trail.unshift({ x: this.bird.x, y: this.bird.y });
        if (this.bird.trail.length > 11) this.bird.trail.pop();

        // Ground scroll
        this.groundX = ((this.groundX - this.pipeSpeed * 1.4 * spd) % 40 + 40) % 40;

        // ── PIPE LOGIC ──
        // Move all existing pipes
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const p = this.pipes[i];
            p.x -= this.pipeSpeed * spd;

            // Score: bird fully passed this pipe
            if (!p.scored && p.x + this.pipeW < this.bird.x - this.bird.r) {
                p.scored = true;
                this.score++;

                if (this.score > this.bestScore) {
                    this.bestScore = this.score;
                    localStorage.setItem('flappy_best', this.bestScore);
                }
                this.onScore(this.score);

                // Increase difficulty gradually
                this.pipeSpeed = Math.min(5.2, 2.0 + this.score * 0.065);
                this.pipeGap   = Math.max(
                    this.isMobile ? 120 : 132,
                    (this.isMobile ? 165 : 180) - this.score * 2
                );
                this.pipeDist  = Math.max(
                    this.isMobile ? 190 : 210,
                    (this.isMobile ? 230 : 260) - this.score * 1.5
                );

                // FX
                const midY = p.gapTop + this.pipeGap / 2;
                this.floatTexts.push({
                    x: this.W * 0.5, y: 80,
                    text: `+1`, color: '#FFD700',
                    life: 45, maxLife: 45, vy: -0.9, scale: 0.3, opacity: 0
                });
                this.rings.push({
                    x: this.bird.x, y: this.bird.y,
                    r: 10, opacity: 0.65, color: '#FFD700'
                });
                this.spawnParticles(this.bird.x, this.bird.y, '#FFD700', 7);

                if (this.score > 0 && this.score % 5 === 0) {
                    this.floatTexts.push({
                        x: this.W/2, y: this.H/2 - 50,
                        text: `${this.score} ★`, color: '#00FF88',
                        life: 75, maxLife: 75, vy: -0.6, scale: 0.2, opacity: 0
                    });
                    this.screenShake.timer = 5; this.screenShake.force = 2.5;
                }
                if (window.audioManager) audioManager.play('score');
            }

            // Remove pipes far off left
            if (p.x + this.pipeW < -20) {
                this.pipes.splice(i, 1);
            }
        }

        // Spawn new pipe when rightmost pipe crosses threshold
        // nextPipeX tracks the x of the next pipe to be placed
        // When pipeSpeed moves it, we check when screen needs it
        this.nextPipeX -= this.pipeSpeed * spd;
        if (this.nextPipeX <= this.W + this.pipeW) {
            this.spawnPipe();
        }

        // Collision
        if (this.bird.alive) this.checkCollisions();

        this.updateParticles();
        this.updateFloatTexts();
    }

    // ══════════════════════════════════════════
    // COLLISION — pixel-perfect circle vs rect
    // ══════════════════════════════════════════
    checkCollisions() {
        const b  = this.bird;
        // Use 72% of visual radius for hitbox (forgiving)
        const cr = b.r * 0.72;

        // Ceiling
        if (b.y - cr < 0) { this.die(); return; }

        // Ground
        if (b.y + cr > this.H - this.groundH) { this.die(); return; }

        // Pipes — circle vs axis-aligned rect collision
        for (const p of this.pipes) {
            const pLeft  = p.x;
            const pRight = p.x + this.pipeW;

            // Bird must be horizontally overlapping pipe column
            if (b.x + cr < pLeft || b.x - cr > pRight) continue;

            // Check top pipe rect: (pLeft, 0) → (pRight, gapTop)
            // Closest point on rect to circle center
            const topRectBot = p.gapTop;
            const botRectTop = p.gapBot;

            // Top pipe collision
            if (this.circleRectCollide(b.x, b.y, cr, pLeft, 0, pRight, topRectBot)) {
                this.die(); return;
            }
            // Bottom pipe collision
            if (this.circleRectCollide(b.x, b.y, cr, pLeft, botRectTop, pRight, this.H - this.groundH)) {
                this.die(); return;
            }
        }
    }

    // Circle (cx,cy,r) vs axis-aligned rect (x1,y1)→(x2,y2)
    circleRectCollide(cx, cy, r, x1, y1, x2, y2) {
        // Clamp circle center to rect
        const nearX = Math.max(x1, Math.min(cx, x2));
        const nearY = Math.max(y1, Math.min(cy, y2));
        const dx = cx - nearX;
        const dy = cy - nearY;
        return (dx * dx + dy * dy) < (r * r);
    }

    die() {
        if (!this.bird.alive) return;   // prevent double-die
        this.bird.alive = false;
        this.gameState  = 'dead';
        this.deathTimer = 0;

        this.spawnParticles(this.bird.x, this.bird.y, '#FF006E', 24, { spread: 7 });
        this.flashAlpha = 0.48; this.flashColor = '#FF0033';
        this.screenShake.timer = 18; this.screenShake.force = 9;

        this.floatTexts.push({
            x: this.W/2, y: this.H/2 - 55,
            text: 'CRASH!', color: '#FF006E',
            life: 85, maxLife: 85, vy: -0.5, scale: 0.15, opacity: 0
        });

        if (window.audioManager) audioManager.play('fail');
        this.onScore(this.score, true);
    }

    updateParticles() {
        for (let i = this.particles.length-1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.vx *= 0.97;
            p.life--; p.size *= 0.955;
            if (p.life <= 0 || p.size < 0.3) this.particles.splice(i, 1);
        }
    }

    updateFloatTexts() {
        for (let i = this.floatTexts.length-1; i >= 0; i--) {
            const t = this.floatTexts[i];
            t.y += t.vy; t.life--;
            t.opacity = t.life < 18 ? t.life/18 : (t.maxLife - t.life < 10 ? (t.maxLife - t.life)/10 : 1);
            t.scale  += (1 - t.scale) * 0.15;
            if (t.life <= 0) this.floatTexts.splice(i, 1);
        }
    }

    spawnParticles(x, y, color, count, opts = {}) {
        const spread = opts.spread || 5;
        const baseVY = opts.vy    || 0;
        for (let i = 0; i < count; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = Math.random() * spread + 1.2;
            this.particles.push({
                x, y,
                vx: Math.cos(a)*sp, vy: Math.sin(a)*sp*0.55 + baseVY,
                color, size: Math.random()*5+2,
                life: Math.floor(Math.random()*18+12)
            });
        }
    }

    // ══════════════════════════════════════════
    // DRAW
    // ══════════════════════════════════════════
    draw(timestamp) {
        const ctx = this.ctx;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.screenShake.x || this.screenShake.y)
            ctx.translate(this.dS(this.screenShake.x), this.dS(this.screenShake.y));

        this.drawBackground(ctx);
        this.drawClouds(ctx);
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

    // ── Background ──
    drawBackground(ctx) {
        const W = this.W, H = this.H, t = this.bgTime;
        const sky = ctx.createLinearGradient(0, 0, 0, this.dY(H * 0.78));
        sky.addColorStop(0,    '#050215');
        sky.addColorStop(0.4,  '#090420');
        sky.addColorStop(0.75, '#0c082a');
        sky.addColorStop(1,    '#0d0e2e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Nebula
        const neb = ctx.createRadialGradient(
            this.dX(W*0.65), this.dY(H*0.2), 0,
            this.dX(W*0.65), this.dY(H*0.2), this.dS(W*0.55)
        );
        neb.addColorStop(0,   'rgba(185,71,217,0.09)');
        neb.addColorStop(0.5, 'rgba(0,212,255,0.04)');
        neb.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = neb;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        for (const s of this.stars) {
            const alpha = 0.1 + ((Math.sin(s.phase)+1)/2)*0.52;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = s.color;
            ctx.beginPath();
            ctx.arc(this.dX(s.x), this.dY(s.y), Math.max(0.4, this.dS(s.r)), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Moon
        const mx = W*0.82, my = H*0.1, mr = this.isMobile ? 22 : 27;
        ctx.save();
        ctx.shadowBlur  = this.dS(16);
        ctx.shadowColor = 'rgba(200,200,255,0.35)';
        const mg = ctx.createRadialGradient(
            this.dX(mx - mr*0.3), this.dY(my - mr*0.3), this.dS(mr*0.08),
            this.dX(mx), this.dY(my), this.dS(mr)
        );
        mg.addColorStop(0,   'rgba(235,235,255,0.9)');
        mg.addColorStop(0.6, 'rgba(180,180,240,0.65)');
        mg.addColorStop(1,   'rgba(100,100,200,0.25)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(this.dX(mx), this.dY(my), this.dS(mr), 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Vignette
        const vg = ctx.createRadialGradient(
            this.dX(W/2), this.dY(H/2), this.dS(H*0.08),
            this.dX(W/2), this.dY(H/2), this.dS(H*0.95)
        );
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.52)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawClouds(ctx) {
        for (const c of this.clouds) {
            ctx.save();
            ctx.globalAlpha = c.alpha;
            const g = ctx.createRadialGradient(
                this.dX(c.x), this.dY(c.y), 0,
                this.dX(c.x), this.dY(c.y), this.dS(c.w*0.6)
            );
            g.addColorStop(0,   this.hexToRgba(c.color, 0.38));
            g.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(this.dX(c.x-c.w), this.dY(c.y-c.h), this.dSr(c.w*2), this.dSr(c.h*2));
            ctx.restore();
        }
    }

    drawCityBg(ctx) {
        for (const b of this.bgLayers) {
            ctx.fillStyle = b.color;
            ctx.fillRect(this.dX(b.x), this.dY(b.baseY - b.h), this.dSr(b.w), this.dSr(b.h));
        }
    }

    // ── Pipes ──
    drawPipes(ctx) {
        this.pipes.forEach(p => {
            const th  = p.theme;
            const pW  = this.pipeW;

            this.drawOnePipe(ctx, p.x, 0,       pW, p.gapTop,                         th, 'top');
            this.drawOnePipe(ctx, p.x, p.gapBot, pW, this.H - this.groundH - p.gapBot, th, 'bot');

            // Soft gap glow
            const midY = p.gapTop + this.pipeGap / 2;
            ctx.save();
            ctx.globalAlpha = 0.055 + Math.sin(this.bgTime*2.2)*0.018;
            const gg = ctx.createRadialGradient(
                this.dX(p.x + pW/2), this.dY(midY), 0,
                this.dX(p.x + pW/2), this.dY(midY), this.dS(this.pipeGap*0.55)
            );
            gg.addColorStop(0,   th.glow);
            gg.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.fillStyle = gg;
            ctx.fillRect(this.dX(p.x - 5), this.dY(p.gapTop), this.dSr(pW + 10), this.dSr(this.pipeGap));
            ctx.restore();
        });
    }

    drawOnePipe(ctx, px, py, pw, ph, theme, side) {
        if (ph <= 2) return;
        const capH   = 22;
        const capExt = 6;
        const isTop  = side === 'top';
        const capY   = isTop ? py + ph - capH : py;

        ctx.save();

        // Body
        const bg = ctx.createLinearGradient(this.dX(px), 0, this.dX(px+pw), 0);
        bg.addColorStop(0,    this.hexToRgba(theme.dark,  0.92));
        bg.addColorStop(0.22, this.hexToRgba(theme.body,  0.96));
        bg.addColorStop(0.52, this.hexToRgba(theme.shine, 0.82));
        bg.addColorStop(0.78, this.hexToRgba(theme.body,  0.94));
        bg.addColorStop(1,    this.hexToRgba(theme.dark,  0.88));

        ctx.shadowBlur  = this.dS(9);
        ctx.shadowColor = theme.glow;
        ctx.fillStyle   = bg;
        ctx.fillRect(this.dX(px), this.dY(py), this.dSr(pw), this.dSr(ph));
        ctx.shadowBlur  = 0;

        // Body border
        ctx.strokeStyle = this.hexToRgba(theme.shine, 0.45);
        ctx.lineWidth   = this.dS(1.1);
        ctx.strokeRect(this.dX(px), this.dY(py), this.dSr(pw), this.dSr(ph));

        // Body shine stripe
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.fillRect(this.dX(px + pw*0.2), this.dY(py), this.dSr(pw*0.15), this.dSr(ph));

        // Cap
        const cg = ctx.createLinearGradient(this.dX(px-capExt), 0, this.dX(px+pw+capExt), 0);
        cg.addColorStop(0,    this.hexToRgba(theme.dark,  0.96));
        cg.addColorStop(0.2,  this.hexToRgba(theme.body,  1));
        cg.addColorStop(0.5,  this.hexToRgba(theme.shine, 0.92));
        cg.addColorStop(0.8,  this.hexToRgba(theme.body,  1));
        cg.addColorStop(1,    this.hexToRgba(theme.dark,  0.96));

        ctx.shadowBlur  = this.dS(13);
        ctx.shadowColor = theme.glow;
        ctx.fillStyle   = cg;
        this.drawRoundRect(ctx, px-capExt, capY, pw+capExt*2, capH, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = this.hexToRgba(theme.shine, 0.6);
        ctx.lineWidth   = this.dS(1.4);
        this.drawRoundRect(ctx, px-capExt, capY, pw+capExt*2, capH, 6);
        ctx.stroke();

        ctx.restore();
    }

    // ── Ground ──
    drawGround(ctx) {
        const W = this.W, H = this.H, gh = this.groundH, gy = H - gh;

        const grd = ctx.createLinearGradient(0, this.dY(gy), 0, this.dY(H));
        grd.addColorStop(0,   '#1a0935');
        grd.addColorStop(0.18,'#110720');
        grd.addColorStop(1,   '#080410');
        ctx.fillStyle = grd;
        ctx.fillRect(0, this.dY(gy), this.canvas.width, this.dSr(gh));

        // Top neon line (purple)
        ctx.save();
        ctx.shadowBlur  = this.dS(12);
        ctx.shadowColor = '#B947D9';
        ctx.strokeStyle = 'rgba(185,71,217,0.82)';
        ctx.lineWidth   = this.dS(2);
        ctx.beginPath();
        ctx.moveTo(0, this.dY(gy)); ctx.lineTo(this.canvas.width, this.dY(gy));
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Second line (cyan)
        ctx.shadowBlur  = this.dS(7);
        ctx.shadowColor = '#00D4FF';
        ctx.strokeStyle = 'rgba(0,212,255,0.32)';
        ctx.lineWidth   = this.dS(1);
        ctx.beginPath();
        ctx.moveTo(0, this.dY(gy+3)); ctx.lineTo(this.canvas.width, this.dY(gy+3));
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Scrolling vertical grid
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = '#B947D9';
        ctx.lineWidth   = this.dS(0.7);
        const tW = 38;
        const off = this.groundX % tW;
        for (let x = -tW + off; x < W + tW; x += tW) {
            ctx.beginPath();
            ctx.moveTo(this.dX(x), this.dY(gy + 5));
            ctx.lineTo(this.dX(x), this.dY(H));
            ctx.stroke();
        }
        // Horizontal grid
        ctx.globalAlpha = 0.09;
        for (let y = gy + 13; y < H; y += 17) {
            ctx.beginPath();
            ctx.moveTo(0, this.dY(y)); ctx.lineTo(this.canvas.width, this.dY(y));
            ctx.stroke();
        }
        ctx.restore();
    }

    drawRingsFX(ctx) {
        for (const rg of this.rings) {
            ctx.save();
            ctx.globalAlpha = rg.opacity;
            ctx.strokeStyle = rg.color;
            ctx.lineWidth   = this.dS(2 * rg.opacity);
            ctx.shadowBlur  = this.dS(9);
            ctx.shadowColor = rg.color;
            ctx.beginPath();
            ctx.arc(this.dX(rg.x), this.dY(rg.y), this.dS(rg.r), 0, Math.PI*2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    drawBirdTrail(ctx) {
        this.bird.trail.forEach((pt, i) => {
            const alpha = (1 - i/this.bird.trail.length) * 0.28;
            const r     = this.bird.r * (1 - i/this.bird.trail.length) * 0.62;
            if (r < 0.5) return;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#00D4FF';
            ctx.shadowBlur  = this.dS(4);
            ctx.shadowColor = '#00D4FF';
            ctx.beginPath();
            ctx.arc(this.dX(pt.x), this.dY(pt.y), Math.max(0.4, this.dS(r)), 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        });
    }

    // ── Bird drawing (shared by game + menu) ──
    _drawBirdAt(ctx, cx, cy, r, rot, flapAnim, pulseT) {
        ctx.save();
        ctx.translate(this.dX(cx), this.dY(cy));
        ctx.rotate(rot);

        // Outer ring glow
        ctx.save();
        ctx.shadowBlur  = this.dS(18);
        ctx.shadowColor = '#00D4FF';
        ctx.strokeStyle = 'rgba(0,212,255,0.38)';
        ctx.lineWidth   = this.dS(2.2);
        ctx.beginPath();
        ctx.arc(0, 0, this.dS(r + 7), 0, Math.PI*2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Body
        const bg = ctx.createRadialGradient(
            this.dS(-r*0.3), this.dS(-r*0.3), this.dS(r*0.05),
            0, 0, this.dS(r)
        );
        bg.addColorStop(0,    '#88F0FF');
        bg.addColorStop(0.4,  '#00D4FF');
        bg.addColorStop(1,    '#004488');

        ctx.shadowBlur  = this.dS(13);
        ctx.shadowColor = '#00D4FF';
        ctx.fillStyle   = bg;
        ctx.beginPath();
        ctx.arc(0, 0, this.dS(r), 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.62)';
        ctx.lineWidth   = this.dS(1.6);
        ctx.stroke();

        // Wing
        const wingBaseY = this.dS(r * 0.22);
        const wingAng   = flapAnim > 0
            ? -Math.PI * 0.5 * flapAnim
            : Math.PI * 0.1 * Math.sin(pulseT * 2.8);
        const wingLen   = this.dS(r * 1.05);
        const wingEX    = Math.cos(wingAng + Math.PI*0.18) * wingLen;
        const wingEY    = wingBaseY + Math.sin(wingAng + Math.PI*0.18) * wingLen;

        ctx.save();
        ctx.shadowBlur  = this.dS(5);
        ctx.shadowColor = '#00BBDD';
        ctx.strokeStyle = 'rgba(0,195,235,0.92)';
        ctx.lineWidth   = this.dS(3.8);
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(this.dS(-r*0.12), wingBaseY);
        ctx.quadraticCurveTo(this.dS(-r*0.55), wingBaseY + this.dS(r*0.28), wingEX, wingEY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Eye white
        const ex = this.dS(r*0.3), ey = this.dS(-r*0.2);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, this.dS(r*0.27), 0, Math.PI*2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#001830';
        ctx.beginPath();
        ctx.arc(ex + this.dS(1.5), ey, this.dS(r*0.13), 0, Math.PI*2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.arc(ex + this.dS(2), ey - this.dS(2), this.dS(r*0.065), 0, Math.PI*2);
        ctx.fill();

        // Beak
        ctx.fillStyle   = '#FFB820';
        ctx.strokeStyle = '#BB8800';
        ctx.lineWidth   = this.dS(0.7);
        ctx.beginPath();
        ctx.moveTo(this.dS(r*0.62),  this.dS(-r*0.07));
        ctx.lineTo(this.dS(r*0.62 + r*0.4), 0);
        ctx.lineTo(this.dS(r*0.62),  this.dS(r*0.11));
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Body shine
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(this.dS(-r*0.2), this.dS(-r*0.23), this.dS(r*0.3), 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }

    drawBird(ctx) {
        const b = this.bird;
        this._drawBirdAt(ctx, b.x, b.y, b.r, b.rotation, b.flapAnim, b.pulseT);
    }

    drawMenuBird(ctx) {
        const t   = this.menuBirdT;
        const rot = Math.sin(t * 1.4) * 0.1;
        this._drawBirdAt(ctx, this.W * 0.5, this.menuBirdY, this.bird.r, rot, 0, t);
    }

    // ── Menu ──
    drawMenu(ctx) {
        const W = this.W, H = this.H, t = this.bgTime;

        // Title card
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle   = 'rgba(4,1,16,0.85)';
        this.drawRoundRect(ctx, W/2-160, H*0.12, 320, 108, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,212,255,0.28)';
        ctx.lineWidth   = this.dS(1.5);
        this.drawRoundRect(ctx, W/2-160, H*0.12, 320, 108, 18);
        ctx.stroke();
        ctx.restore();

        this.drawText(ctx, 'FLAPPY', W/2, H*0.14 + 27, {
            size: 30, weight: '900', color: '#00D4FF',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#00D4FF', glowBlur: 14,
            stroke: true, strokeColor: 'rgba(0,0,0,0.9)', strokeWidth: 4,
            family: this.FONT_TITLE
        });
        this.drawText(ctx, 'NEON BIRD', W/2, H*0.14 + 62, {
            size: 18, weight: '900', color: '#B947D9',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#B947D9', glowBlur: 10,
            stroke: true, strokeColor: 'rgba(0,0,0,0.9)', strokeWidth: 3,
            family: this.FONT_TITLE
        });
        this.drawText(ctx, 'CINEMATIC EDITION', W/2, H*0.14 + 86, {
            size: 8.5, weight: '600', color: 'rgba(180,180,220,0.48)',
            align: 'center', baseline: 'middle', family: this.FONT_UI
        });

        if (this.bestScore > 0) {
            this.drawText(ctx, `BEST: ${this.bestScore}`, W/2, H*0.60, {
                size: 14, weight: '800', color: '#FFD700',
                align: 'center', baseline: 'middle',
                glow: true, glowColor: '#FFD700', glowBlur: 7,
                family: this.FONT_TITLE
            });
        }

        const pulse = 0.62 + Math.sin(t * 2.8) * 0.32;
        this.drawText(ctx, '▶  TAP  TO  FLY', W/2, H*0.70, {
            size: 14, weight: '800', color: '#00FF88',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#00FF88', glowBlur: 8,
            family: this.FONT_TITLE, opacity: pulse
        });
        this.drawText(ctx, 'SPACE  /  CLICK  /  TAP', W/2, H*0.76, {
            size: 9, color: 'rgba(180,180,220,0.38)',
            align: 'center', baseline: 'middle', family: this.FONT_UI
        });

        const tips = ['Tap to flap wings', 'Fly through the gaps', 'Don\'t touch the pipes!'];
        tips.forEach((tip, i) => {
            this.drawText(ctx, tip, W/2, H*0.84 + i*18, {
                size: 9.5, color: 'rgba(155,155,200,0.42)',
                align: 'center', baseline: 'middle', family: this.FONT_UI
            });
        });
    }

    drawParticles(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.min(1, p.life / 12);
            ctx.shadowBlur  = this.dS(4);
            ctx.shadowColor = p.color;
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(this.dX(p.x), this.dY(p.y), Math.max(0.4, this.dS(p.size)), 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    drawFloatTexts(ctx) {
        for (const t of this.floatTexts) {
            const sc = Math.min(1, t.scale);
            this.drawText(ctx, t.text, t.x, t.y, {
                size: 13 * sc, weight: '900', color: t.color,
                align: 'center', baseline: 'middle', opacity: t.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.7)', strokeWidth: 3,
                glow: true, glowColor: t.color, glowBlur: 8,
                family: this.FONT_TITLE
            });
        }
    }

    // ── HUD ──
    drawHUD(ctx) {
        const W = this.W;

        // Score big center
        this.drawText(ctx, String(this.score), W/2, 50, {
            size: 34, weight: '900', color: '#fff',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#00D4FF', glowBlur: 10,
            stroke: true, strokeColor: 'rgba(0,0,0,0.7)', strokeWidth: 4,
            family: this.FONT_TITLE
        });

        this.drawText(ctx, `BEST: ${this.bestScore}`, W - 12, 20, {
            size: 10, weight: '700', color: 'rgba(255,215,0,0.52)',
            align: 'right', baseline: 'middle', family: this.FONT_UI
        });

        const sc = Math.min(1, (this.pipeSpeed - 2.0) / 3.2);
        const speedCol = sc < 0.4 ? '#00FF88' : sc < 0.75 ? '#FFD700' : '#FF006E';
        this.drawText(ctx, `${this.pipeSpeed.toFixed(1)}x`, 12, 20, {
            size: 10, weight: '700', color: speedCol,
            baseline: 'middle', family: this.FONT_UI,
            glow: true, glowColor: speedCol, glowBlur: 4
        });
    }

    // ── Death Screen ──
    drawDeathScreen(ctx) {
        const W = this.W, H = this.H;
        const elapsed = this.deathTimer;
        const alpha   = Math.min(1, elapsed / 400);

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.26) return;
        const cA = Math.min(1, (alpha - 0.26) / 0.74);
        const cx = W/2, cy = H/2;

        ctx.save();
        ctx.globalAlpha = cA * 0.95;
        ctx.fillStyle   = 'rgba(3,1,16,0.94)';
        this.drawRoundRect(ctx, cx-160, cy-115, 320, 230, 22);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,0,60,0.35)';
        ctx.lineWidth   = this.dS(1.5);
        this.drawRoundRect(ctx, cx-160, cy-115, 320, 230, 22);
        ctx.stroke();
        ctx.restore();

        this.drawText(ctx, 'GAME OVER', cx, cy - 76, {
            size: 25, weight: '900', color: '#FF006E',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#FF006E', glowBlur: 12,
            family: this.FONT_TITLE, opacity: cA
        });

        this.drawText(ctx, 'SCORE', cx, cy - 34, {
            size: 9, weight: '700', color: 'rgba(180,180,220,0.52)',
            align: 'center', baseline: 'middle',
            family: this.FONT_UI, opacity: cA
        });

        this.drawText(ctx, String(this.score), cx, cy + 6, {
            size: 40, weight: '900', color: '#fff',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#00D4FF', glowBlur: 10,
            stroke: true, strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 5,
            family: this.FONT_TITLE, opacity: cA
        });

        this.drawText(ctx, `BEST:  ${this.bestScore}`, cx, cy + 46, {
            size: 14, weight: '800', color: '#FFD700',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#FFD700', glowBlur: 6,
            family: this.FONT_TITLE, opacity: cA
        });

        if (this.score > 0 && this.score >= this.bestScore) {
            this.drawText(ctx, '★  NEW BEST!  ★', cx, cy + 74, {
                size: 12, weight: '900', color: '#00FF88',
                align: 'center', baseline: 'middle',
                glow: true, glowColor: '#00FF88', glowBlur: 8,
                family: this.FONT_TITLE, opacity: cA
            });
        }

        if (elapsed > 700) {
            const blink = Math.sin(elapsed / 280) > 0;
            if (blink) {
                this.drawText(ctx, '▶  TAP TO RESTART', cx, cy + 102, {
                    size: 13, weight: '800', color: '#00FF88',
                    align: 'center', baseline: 'middle',
                    glow: true, glowColor: '#00FF88', glowBlur: 8,
                    family: this.FONT_TITLE, opacity: cA * 0.92
                });
            }
        } else {
            this.drawText(ctx, 'Wait...', cx, cy + 102, {
                size: 10, color: 'rgba(160,160,200,0.28)',
                align: 'center', baseline: 'middle',
                family: this.FONT_UI, opacity: cA
            });
        }
    }

    // ══════════════════════════════════════════
    // LOOP
    // ══════════════════════════════════════════
    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;
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
        this.setupHDCanvas();
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.bird.x  = this.W * 0.25;
        this.groundH = this.isMobile ? 60 : 68;
        this.stars   = this.makeStars(70);
        this.clouds  = this.makeClouds();
        this.bgLayers = this.makeBgLayers();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click',      this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
        document.removeEventListener('keydown',       this.boundKey);
    }
}