'use strict';

class ColorUp {
    constructor(canvas, onScore) {
        this.canvas  = canvas;
        this.onScore = onScore;

        // ── FIX 1: DPR max 2 instead of 3 — mobile lag fix ──
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.setupHDCanvas();

        this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

        this.W = canvas.width  / this.dpr;
        this.H = canvas.height / this.dpr;

        this.isMobile = ('ontouchstart' in window) || window.innerWidth < 768;

        this.FONT_TITLE = '"Orbitron", "Segoe UI", monospace';
        this.FONT_UI    = '"Rajdhani", "Segoe UI", sans-serif';
        this.loadFonts();

        this.score      = 0;
        this.bestScore  = parseInt(localStorage.getItem('colorup_best') || '0');
        this.paused     = false;
        this.destroyed  = false;
        this.gameState  = 'playing';
        this.combo      = 0;
        this.maxCombo   = 0;

        this.PALETTE = [
            { fill: '#FF006E', light: '#FF77BB', dark: '#CC0055', name: 'PINK'   },
            { fill: '#00D4FF', light: '#77EEFF', dark: '#0099CC', name: 'CYAN'   },
            { fill: '#00FF88', light: '#77FFB8', dark: '#00CC66', name: 'GREEN'  },
            { fill: '#FFD700', light: '#FFE966', dark: '#CCA800', name: 'GOLD'   },
            { fill: '#B947D9', light: '#D888F0', dark: '#8833AA', name: 'PURPLE' },
        ];

        this.playerColorIdx = 0;
        this.player = {
            x: this.W / 2,
            y: this.H - 80,
            r: this.isMobile ? 20 : 22,
            pulseT: 0,
            trail: []
        };

        this.gates      = [];
        this.speed      = 2.2;
        this.gateTimer  = 0;
        this.gateSpacing = 130;

        this.particles    = [];
        this.floatTexts   = [];
        this.screenShake  = { x: 0, y: 0, timer: 0, force: 0 };
        this.flashAlpha   = 0;
        this.flashColor   = '#fff';
        this.bgTime       = 0;
        this.stars        = this.makeStars(this.isMobile ? 35 : 60);
        this.rings        = [];

        this.colorSwitchAnim = { progress: 0, active: false, fromIdx: 0 };
        this.deathTimer = 0;
        this.playerTargetX = this.W / 2;
        this.lastMoveDir   = 0;

        this.spawnInitialGates();

        this.boundClick     = this.handleClick.bind(this);
        this.boundTouch     = this.handleTouch.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundTouchMove = this.handleTouchMove.bind(this);

        canvas.addEventListener('click',     this.boundClick);
        canvas.addEventListener('touchstart', this.boundTouch,    { passive: false });
        canvas.addEventListener('mousemove',  this.boundMouseMove);
        canvas.addEventListener('touchmove',  this.boundTouchMove, { passive: false });

        this.lastTime = 0;
        this.animId   = requestAnimationFrame(t => this.loop(t));
    }

    // ── FIX 2: setupHDCanvas uses parent element for reliable mobile height ──
    setupHDCanvas() {
        const parent = this.canvas.parentElement;
        let w, h;

        if (parent && parent.clientWidth > 10 && parent.clientHeight > 10) {
            w = parent.clientWidth;
            h = parent.clientHeight;
        } else {
            const rect = this.canvas.getBoundingClientRect();
            w = (rect.width  > 10 ? rect.width  : this.canvas.clientWidth)  || window.innerWidth;
            h = (rect.height > 10 ? rect.height : this.canvas.clientHeight) || window.innerHeight;
        }

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
            strokeColor = 'rgba(0,0,0,0.85)',
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

        // Glow — skip on mobile for performance
        if (glow && glowBlur > 0 && !this.isMobile) {
            ctx.save();
            ctx.shadowBlur  = glowBlur * this.dpr * 2;
            ctx.shadowColor = glowColor || color;
            ctx.fillStyle   = glowColor || color;
            ctx.globalAlpha = Math.min(1, opacity) * 0.5;
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

    drawCircle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(this.dX(x), this.dY(y), Math.max(0.5, this.dS(r)), 0, Math.PI * 2);
    }

    hexToRgba(hex, a) {
        if (!hex || hex[0] !== '#') return hex;
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`;
    }

    makeStars(n) {
        return Array.from({ length: n }, () => ({
            x:     Math.random() * (this.W || 400),
            y:     Math.random() * (this.H || 700),
            r:     Math.random() * 1.4 + 0.2,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.016 + 0.004,
            color: Math.random() > 0.8 ? '#B947D9' : Math.random() > 0.6 ? '#00D4FF' : '#fff'
        }));
    }

    spawnInitialGates() {
        for (let i = 0; i < 5; i++)
            this.addGate(-i * this.gateSpacing - 40);
    }

    addGate(y) {
        const leftColor = Math.floor(Math.random() * this.PALETTE.length);
        let rightColor;
        do { rightColor = Math.floor(Math.random() * this.PALETTE.length); }
        while (rightColor === leftColor);

        const isBonus = Math.random() < 0.08;

        this.gates.push({
            y,
            leftColor:  isBonus ? leftColor : leftColor,
            rightColor: isBonus ? leftColor : rightColor,
            isBonus,
            passed: false,
            hitFlash: 0,
            midX: this.W / 2,
            h: 28
        });
    }

    handleClick(e) {
        if (this.gameState === 'dead') { this.restart(); return; }
        if (this.paused) return;
        this.switchColor();
    }

    handleTouch(e) {
        e.preventDefault();
        if (this.gameState === 'dead') { this.restart(); return; }
        if (this.paused) return;
        this.switchColor();
    }

    handleMouseMove(e) {
        if (this.gameState !== 'playing' || this.paused) return;
        const rect = this.canvas.getBoundingClientRect();
        this.playerTargetX = (e.clientX - rect.left) * (this.W / rect.width);
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.gameState !== 'playing' || this.paused) return;
        const rect = this.canvas.getBoundingClientRect();
        this.playerTargetX = (e.touches[0].clientX - rect.left) * (this.W / rect.width);
    }

    switchColor() {
        this.colorSwitchAnim = {
            active: true,
            progress: 0,
            fromIdx: this.playerColorIdx
        };
        this.playerColorIdx = (this.playerColorIdx + 1) % this.PALETTE.length;
        if (window.audioManager) audioManager.play('click');

        this.rings.push({
            x: this.player.x,
            y: this.player.y,
            r: this.player.r,
            maxR: 60,
            opacity: 0.7,
            color: this.PALETTE[this.playerColorIdx].fill
        });
    }

    restart() {
        this.score          = 0;
        this.combo          = 0;
        this.maxCombo       = 0;
        this.speed          = 2.2;
        this.gates          = [];
        this.particles      = [];
        this.floatTexts     = [];
        this.rings          = [];
        this.player.x       = this.W / 2;
        this.playerTargetX  = this.W / 2;
        this.playerColorIdx = 0;
        this.player.trail   = [];
        this.player.pulseT  = 0;
        this.deathTimer     = 0;
        this.gameState      = 'playing';
        this.onScore(0);
        this.spawnInitialGates();
    }

    update(dt) {
        if (this.paused) return;

        this.bgTime += dt * 0.001;
        this.stars.forEach(s => s.phase += s.speed);

        if (this.screenShake.timer > 0) {
            const f = this.screenShake.force * (this.screenShake.timer / 12);
            this.screenShake.x = (Math.random()-0.5)*f;
            this.screenShake.y = (Math.random()-0.5)*f*0.4;
            this.screenShake.timer--;
        } else { this.screenShake.x = 0; this.screenShake.y = 0; }

        if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.025);

        for (let i = this.rings.length-1; i >= 0; i--) {
            const rg = this.rings[i];
            rg.r      += 3.5;
            rg.opacity -= 0.045;
            if (rg.opacity <= 0) this.rings.splice(i, 1);
        }

        if (this.colorSwitchAnim.active) {
            this.colorSwitchAnim.progress += dt / 160;
            if (this.colorSwitchAnim.progress >= 1) this.colorSwitchAnim.active = false;
        }

        if (this.gameState === 'dead') {
            this.deathTimer += dt;
            this.updateParticles();
            this.updateFloatTexts();
            return;
        }

        const px  = this.player.x;
        const tx  = Math.max(this.player.r + 5, Math.min(this.W - this.player.r - 5, this.playerTargetX));
        this.player.x += (tx - px) * 0.14;

        this.player.trail.unshift({ x: this.player.x, y: this.player.y });
        if (this.player.trail.length > 14) this.player.trail.pop();

        this.player.pulseT += dt * 0.005;

        for (let i = this.gates.length - 1; i >= 0; i--) {
            this.gates[i].y += this.speed * (dt / 16.67);
            if (this.gates[i].hitFlash > 0) this.gates[i].hitFlash--;
            if (this.gates[i].y > this.H + 50) this.gates.splice(i, 1);
        }

        this.gateTimer += dt;
        const spawnInterval = Math.max(55, 105 - this.speed * 8);
        if (this.gateTimer > spawnInterval) {
            this.gateTimer = 0;
            const topY = this.gates.length > 0 ? Math.min(...this.gates.map(g => g.y)) : 0;
            if (topY > 60) this.addGate(-30);
        }

        for (let i = this.gates.length - 1; i >= 0; i--) {
            const g = this.gates[i];
            if (g.passed) continue;

            const py  = this.player.y;
            const pr  = this.player.r;
            const gTop = g.y - g.h / 2;
            const gBot = g.y + g.h / 2;

            if (py + pr > gTop && py - pr < gBot) {
                g.passed = true;
                const isLeft    = this.player.x < g.midX;
                const gateColor = isLeft ? g.leftColor : g.rightColor;

                if (g.isBonus || gateColor === this.playerColorIdx) {
                    this.combo++;
                    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

                    const pts = g.isBonus ? 25 : (10 + (this.combo > 1 ? (this.combo-1)*5 : 0));
                    this.score += pts;
                    if (this.score > this.bestScore) {
                        this.bestScore = this.score;
                        localStorage.setItem('colorup_best', this.bestScore);
                    }
                    this.onScore(this.score);

                    const col = this.PALETTE[this.playerColorIdx].fill;
                    this.spawnParticles(this.player.x, g.y, col, 14);
                    g.hitFlash = 12;

                    const label = this.combo > 2
                        ? `x${this.combo} COMBO  +${pts}`
                        : `+${pts}`;
                    const textCol = this.combo > 2 ? '#FFD700' : '#00FF88';
                    this.floatTexts.push({ x: this.player.x, y: g.y - 20, text: label, color: textCol, life: 65, maxLife: 65, vy: -1.1, scale: 0.3, opacity: 0 });

                    if (this.combo > 2) {
                        this.rings.push({ x: this.player.x, y: g.y, r: 10, maxR: 90, opacity: 0.8, color: '#FFD700' });
                        this.screenShake.timer = 5; this.screenShake.force = 3;
                    }

                    this.speed = Math.min(6.5, 2.2 + this.score / 120);
                    this.gateSpacing = Math.max(90, 130 - this.score / 30);

                    if (window.audioManager) audioManager.play('score');
                } else {
                    this.combo = 0;
                    this.spawnParticles(this.player.x, g.y, '#FF006E', 20);
                    this.flashAlpha = 0.38; this.flashColor = '#FF006E';
                    this.screenShake.timer = 14; this.screenShake.force = 8;
                    this.floatTexts.push({ x: this.W/2, y: this.H/2-30, text: 'WRONG COLOR!', color: '#FF006E', life: 80, maxLife: 80, vy: -0.6, scale: 0.2, opacity: 0 });
                    this.gameState = 'dead';
                    if (window.audioManager) audioManager.play('fail');
                    this.onScore(this.score, true);
                }
            }
        }

        this.updateParticles();
        this.updateFloatTexts();
    }

    updateParticles() {
        for (let i = this.particles.length-1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.97;
            p.life--; p.size *= 0.955;
            if (p.life <= 0 || p.size < 0.3) this.particles.splice(i, 1);
        }
    }

    updateFloatTexts() {
        for (let i = this.floatTexts.length-1; i >= 0; i--) {
            const t = this.floatTexts[i];
            t.y    += t.vy; t.life--;
            t.opacity = t.life < 20 ? t.life/20 : (t.maxLife - t.life < 12 ? (t.maxLife - t.life)/12 : 1);
            t.scale  += (1 - t.scale) * 0.16;
            if (t.life <= 0) this.floatTexts.splice(i, 1);
        }
    }

    spawnParticles(x, y, color, count) {
        // Limit particles on mobile
        const maxNew = this.isMobile ? Math.min(count, 8) : count;
        for (let i = 0; i < maxNew; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = Math.random() * 6 + 2;
            this.particles.push({
                x, y,
                vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1.5,
                color, size: Math.random()*6+2,
                life: Math.floor(Math.random()*18+14), decay: 0.035
            });
        }
    }

    draw(timestamp) {
        const ctx = this.ctx;

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.screenShake.x || this.screenShake.y)
            ctx.translate(this.dS(this.screenShake.x), this.dS(this.screenShake.y));

        this.drawBackground(ctx);
        this.drawLaneDivider(ctx);
        this.drawRingsFX(ctx);
        this.drawGates(ctx);
        this.drawPlayerTrail(ctx);
        this.drawPlayer(ctx, timestamp);
        this.drawParticles(ctx);
        this.drawFloatTexts(ctx);

        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.drawHUD(ctx);

        if (this.gameState === 'dead') this.drawDeathScreen(ctx);

        ctx.restore();
    }

    drawBackground(ctx) {
        const W = this.W, H = this.H, t = this.bgTime;

        if (this.isMobile) {
            // Simplified BG for mobile
            ctx.fillStyle = '#080518';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            const bg = ctx.createRadialGradient(
                this.dX(W*(0.5+Math.sin(t*0.4)*0.08)), this.dY(H*0.38), 0,
                this.dX(W/2), this.dY(H/2), this.dS(H)
            );
            bg.addColorStop(0,   '#0e0520');
            bg.addColorStop(0.5, '#070415');
            bg.addColorStop(1,   '#030210');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Stars — skip every other on mobile
        const step = this.isMobile ? 2 : 1;
        for (let i = 0; i < this.stars.length; i += step) {
            const s = this.stars[i];
            const alpha = 0.08 + ((Math.sin(s.phase)+1)/2)*0.55;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = s.color;
            ctx.beginPath();
            ctx.arc(this.dX(s.x), this.dY(s.y), Math.max(0.5, this.dS(s.r)), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Vignette — skip on mobile
        if (!this.isMobile) {
            const vg = ctx.createRadialGradient(
                this.dX(W/2), this.dY(H/2), this.dS(H*0.1),
                this.dX(W/2), this.dY(H/2), this.dS(H*0.95)
            );
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(0,0,0,0.58)');
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawLaneDivider(ctx) {
        const col = this.PALETTE[this.playerColorIdx].fill;
        ctx.save();
        ctx.globalAlpha = 0.08 + Math.sin(this.bgTime*2)*0.02;
        ctx.strokeStyle = col;
        ctx.lineWidth   = this.dS(1.5);
        ctx.setLineDash([this.dSr(8), this.dSr(14)]);
        ctx.beginPath();
        ctx.moveTo(this.dX(this.W/2), 0);
        ctx.lineTo(this.dX(this.W/2), this.dY(this.H));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawRingsFX(ctx) {
        for (const rg of this.rings) {
            ctx.save();
            ctx.globalAlpha = rg.opacity;
            ctx.strokeStyle = rg.color;
            ctx.lineWidth   = this.dS(2.5 * rg.opacity);
            if (!this.isMobile) { ctx.shadowBlur = this.dS(12); ctx.shadowColor = rg.color; }
            ctx.beginPath();
            ctx.arc(this.dX(rg.x), this.dY(rg.y), this.dS(rg.r), 0, Math.PI*2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    drawGates(ctx) {
        const W = this.W;

        this.gates.forEach(g => {
            const leftCol  = this.PALETTE[g.leftColor];
            const rightCol = this.PALETTE[g.rightColor];
            const gw = g.midX - 6;
            const gh = g.h;
            const flashBoost = g.hitFlash > 0 ? 0.35 : 0;

            // LEFT gate
            ctx.save();
            const lgFill = ctx.createLinearGradient(0, this.dY(g.y - gh/2), 0, this.dY(g.y + gh/2));
            lgFill.addColorStop(0,   this.hexToRgba(leftCol.light, 0.28 + flashBoost));
            lgFill.addColorStop(0.5, this.hexToRgba(leftCol.fill,  0.38 + flashBoost));
            lgFill.addColorStop(1,   this.hexToRgba(leftCol.dark,  0.24 + flashBoost));
            ctx.fillStyle = lgFill;
            this.drawRoundRect(ctx, 2, g.y - gh/2, gw - 2, gh, 6);
            ctx.fill();

            ctx.save();
            if (!this.isMobile) { ctx.shadowBlur = this.dS(g.hitFlash > 0 ? 18 : 8); ctx.shadowColor = leftCol.fill; }
            ctx.strokeStyle = this.hexToRgba(leftCol.fill, 0.85);
            ctx.lineWidth   = this.dS(g.hitFlash > 0 ? 2.5 : 1.5);
            this.drawRoundRect(ctx, 2, g.y - gh/2, gw - 2, gh, 6);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();

            const isMatchLeft = g.leftColor === this.playerColorIdx;
            this.drawText(ctx, leftCol.name, gw/2, g.y, {
                size: 9.5, weight: '800', color: leftCol.light,
                align: 'center', baseline: 'middle',
                opacity: 0.65 + (isMatchLeft ? 0.3 : 0),
                stroke: true, strokeColor: 'rgba(0,0,0,0.7)', strokeWidth: 2.5,
                family: this.FONT_TITLE
            });

            if (isMatchLeft) {
                ctx.save();
                ctx.globalAlpha = 0.7 + Math.sin(this.bgTime*4)*0.2;
                ctx.fillStyle   = leftCol.light;
                ctx.beginPath();
                ctx.arc(this.dX(gw/2), this.dY(g.y - gh/2 - 9), this.dS(4), 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();

            // RIGHT gate
            ctx.save();
            const rgFill = ctx.createLinearGradient(0, this.dY(g.y - gh/2), 0, this.dY(g.y + gh/2));
            rgFill.addColorStop(0,   this.hexToRgba(rightCol.light, 0.28 + flashBoost));
            rgFill.addColorStop(0.5, this.hexToRgba(rightCol.fill,  0.38 + flashBoost));
            rgFill.addColorStop(1,   this.hexToRgba(rightCol.dark,  0.24 + flashBoost));
            ctx.fillStyle = rgFill;
            this.drawRoundRect(ctx, g.midX + 4, g.y - gh/2, W - g.midX - 6, gh, 6);
            ctx.fill();

            ctx.save();
            if (!this.isMobile) { ctx.shadowBlur = this.dS(g.hitFlash > 0 ? 18 : 8); ctx.shadowColor = rightCol.fill; }
            ctx.strokeStyle = this.hexToRgba(rightCol.fill, 0.85);
            ctx.lineWidth   = this.dS(g.hitFlash > 0 ? 2.5 : 1.5);
            this.drawRoundRect(ctx, g.midX + 4, g.y - gh/2, W - g.midX - 6, gh, 6);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();

            const isMatchRight = g.rightColor === this.playerColorIdx;
            const rightCx = g.midX + (W - g.midX) / 2;
            this.drawText(ctx, rightCol.name, rightCx, g.y, {
                size: 9.5, weight: '800', color: rightCol.light,
                align: 'center', baseline: 'middle',
                opacity: 0.65 + (isMatchRight ? 0.3 : 0),
                stroke: true, strokeColor: 'rgba(0,0,0,0.7)', strokeWidth: 2.5,
                family: this.FONT_TITLE
            });

            if (isMatchRight) {
                ctx.save();
                ctx.globalAlpha = 0.7 + Math.sin(this.bgTime*4)*0.2;
                ctx.fillStyle   = rightCol.light;
                ctx.beginPath();
                ctx.arc(this.dX(rightCx), this.dY(g.y - gh/2 - 9), this.dS(4), 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
            }

            if (g.isBonus) {
                this.drawText(ctx, '★ BONUS', W/2, g.y - gh/2 - 14, {
                    size: 9, weight: '900', color: '#FFD700',
                    align: 'center', baseline: 'middle',
                    family: this.FONT_TITLE
                });
            }

            ctx.restore();
        });
    }

    drawPlayerTrail(ctx) {
        const col = this.PALETTE[this.playerColorIdx].fill;
        // Reduce trail on mobile
        const step = this.isMobile ? 2 : 1;
        for (let i = 0; i < this.player.trail.length; i += step) {
            const pt = this.player.trail[i];
            const alpha = (1 - i/this.player.trail.length) * 0.35;
            const r     = this.player.r * (1 - i/this.player.trail.length) * 0.7;
            if (r < 0.5) continue;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = col;
            ctx.beginPath();
            ctx.arc(this.dX(pt.x), this.dY(pt.y), Math.max(0.5, this.dS(r)), 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    }

    drawPlayer(ctx, timestamp) {
        const pl  = this.player;
        const col = this.PALETTE[this.playerColorIdx];
        const pulse = 1 + Math.sin(pl.pulseT * 2.2) * 0.06;
        const r   = pl.r * pulse;

        // Outer glow ring — skip on mobile
        if (!this.isMobile) {
            ctx.save();
            ctx.shadowBlur  = this.dS(22);
            ctx.shadowColor = col.fill;
            ctx.strokeStyle = this.hexToRgba(col.fill, 0.5);
            ctx.lineWidth   = this.dS(2.5);
            ctx.beginPath();
            ctx.arc(this.dX(pl.x), this.dY(pl.y), this.dS(r + 6), 0, Math.PI*2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        ctx.save();
        const grad = ctx.createRadialGradient(
            this.dX(pl.x - r*0.3), this.dY(pl.y - r*0.3), this.dS(r*0.1),
            this.dX(pl.x),         this.dY(pl.y),          this.dS(r)
        );
        grad.addColorStop(0,   col.light);
        grad.addColorStop(0.5, col.fill);
        grad.addColorStop(1,   col.dark);
        ctx.fillStyle = grad;
        if (!this.isMobile) { ctx.shadowBlur = this.dS(16); ctx.shadowColor = col.fill; }
        ctx.beginPath();
        ctx.arc(this.dX(pl.x), this.dY(pl.y), this.dS(r), 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth   = this.dS(1.8);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.arc(this.dX(pl.x - r*0.25), this.dY(pl.y - r*0.25), this.dS(r*0.38), 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        if (this.colorSwitchAnim.active) {
            const prog  = this.colorSwitchAnim.progress;
            const eased = 1 - Math.pow(1-prog, 2);
            ctx.save();
            ctx.globalAlpha = (1 - prog) * 0.6;
            ctx.strokeStyle = this.PALETTE[this.colorSwitchAnim.fromIdx].fill;
            ctx.lineWidth   = this.dS(2.5 * (1-prog));
            ctx.beginPath();
            ctx.arc(this.dX(pl.x), this.dY(pl.y), this.dS(r + 10*eased), 0, Math.PI*2);
            ctx.stroke();
            ctx.restore();
        }

        this.drawText(ctx, col.name, pl.x, pl.y - r - 10, {
            size: 8.5, weight: '800', color: col.light,
            align: 'center', baseline: 'middle',
            family: this.FONT_TITLE
        });
    }

    drawParticles(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.min(1, p.life / 14);
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(this.dX(p.x), this.dY(p.y), Math.max(0.4, this.dS(p.size)), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawFloatTexts(ctx) {
        for (const t of this.floatTexts) {
            const sc = Math.min(1, t.scale);
            this.drawText(ctx, t.text, t.x, t.y, {
                size: 13 * sc, weight: '900', color: t.color,
                align: 'center', baseline: 'middle',
                opacity: t.opacity,
                stroke: true, strokeColor: 'rgba(0,0,0,0.7)', strokeWidth: 3,
                family: this.FONT_TITLE
            });
        }
    }

    drawHUD(ctx) {
        const W = this.W, H = this.H;
        const col = this.PALETTE[this.playerColorIdx];

        const topGrd = ctx.createLinearGradient(0, 0, 0, this.dY(52));
        topGrd.addColorStop(0, 'rgba(0,0,0,0.82)');
        topGrd.addColorStop(1, 'rgba(0,0,0,0.04)');
        ctx.fillStyle = topGrd;
        ctx.fillRect(0, 0, this.canvas.width, this.dY(52));

        this.drawText(ctx, this.fmtNum(this.score), W/2, 22, {
            size: 18, weight: '900', color: '#00D4FF',
            align: 'center', family: this.FONT_TITLE
        });
        this.drawText(ctx, `BEST: ${this.fmtNum(this.bestScore)}`, W/2, 38, {
            size: 8, color: 'rgba(255,215,0,0.4)',
            align: 'center', family: this.FONT_UI
        });

        const speedPct = Math.min(1, (this.speed - 2.2) / 4.3);
        const speedCol = speedPct < 0.4 ? '#00FF88' : speedPct < 0.75 ? '#FFD700' : '#FF006E';
        this.drawText(ctx, `SPD`, 14, 18, {
            size: 8, weight: '700', color: 'rgba(200,200,220,0.5)',
            family: this.FONT_UI
        });
        this.drawText(ctx, `${this.speed.toFixed(1)}x`, 14, 34, {
            size: 11, weight: '800', color: speedCol,
            family: this.FONT_TITLE
        });

        if (this.combo > 1) {
            this.drawText(ctx, `×${this.combo}`, W - 14, 18, {
                size: 15, weight: '900', color: '#FFD700',
                align: 'right', family: this.FONT_TITLE
            });
            this.drawText(ctx, 'COMBO', W - 14, 35, {
                size: 7.5, weight: '700', color: 'rgba(255,215,0,0.55)',
                align: 'right', family: this.FONT_UI
            });
        }

        this.drawColorBar(ctx);

        if (this.score === 0) {
            this.drawText(ctx, 'MOVE  to aim  •  TAP  to switch color', W/2, H - 22, {
                size: 9.5, weight: '600', color: 'rgba(180,180,220,0.55)',
                align: 'center', family: this.FONT_UI
            });
        }
    }

    drawColorBar(ctx) {
        const W = this.W, H = this.H;
        const total = this.PALETTE.length;
        const bw = 30, bh = 8, gap = 6;
        const totalW = total * bw + (total-1) * gap;
        const sx = (W - totalW) / 2;
        const by = H - 14;

        this.PALETTE.forEach((col, i) => {
            const bx = sx + i*(bw+gap);
            const isActive = i === this.playerColorIdx;

            ctx.save();
            ctx.fillStyle = isActive ? col.fill : this.hexToRgba(col.fill, 0.25);
            this.drawRoundRect(ctx, bx, by - (isActive ? 4 : 0), bw, isActive ? bh+4 : bh, 3);
            ctx.fill();

            if (isActive) {
                ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                ctx.lineWidth   = this.dS(1);
                this.drawRoundRect(ctx, bx, by - 4, bw, bh+4, 3);
                ctx.stroke();
            }
            ctx.restore();
        });
    }

    drawDeathScreen(ctx) {
        const W = this.W, H = this.H;
        const elapsed = this.deathTimer;
        const alpha   = Math.min(1, elapsed / 400);

        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.72})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (alpha < 0.3) return;

        const cardAlpha = (alpha - 0.3) / 0.7;
        const cx = W/2, cy = H/2;

        ctx.save();
        ctx.globalAlpha = cardAlpha * 0.95;
        ctx.fillStyle   = 'rgba(4,2,18,0.92)';
        this.drawRoundRect(ctx, cx - 155, cy - 100, 310, 200, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,0,110,0.4)';
        ctx.lineWidth   = this.dS(1.5);
        this.drawRoundRect(ctx, cx - 155, cy - 100, 310, 200, 20);
        ctx.stroke();
        ctx.restore();

        this.drawText(ctx, 'GAME OVER', cx, cy - 62, {
            size: 24, weight: '900', color: '#FF006E',
            align: 'center', baseline: 'middle',
            family: this.FONT_TITLE, opacity: cardAlpha
        });

        this.drawText(ctx, `SCORE: ${this.fmtNum(this.score)}`, cx, cy - 26, {
            size: 16, weight: '800', color: '#00D4FF',
            align: 'center', baseline: 'middle',
            family: this.FONT_TITLE, opacity: cardAlpha
        });

        this.drawText(ctx, `BEST: ${this.fmtNum(this.bestScore)}`, cx, cy + 2, {
            size: 11, weight: '700', color: 'rgba(255,215,0,0.7)',
            align: 'center', baseline: 'middle',
            family: this.FONT_UI, opacity: cardAlpha
        });

        if (this.maxCombo > 1) {
            this.drawText(ctx, `MAX COMBO  ×${this.maxCombo}`, cx, cy + 26, {
                size: 11, weight: '700', color: '#FFD700',
                align: 'center', baseline: 'middle',
                family: this.FONT_TITLE, opacity: cardAlpha
            });
        }

        const blink = Math.sin(this.deathTimer / 320) > 0;
        if (blink) {
            this.drawText(ctx, '▶  TAP TO RESTART', cx, cy + 66, {
                size: 13, weight: '800', color: '#00FF88',
                align: 'center', baseline: 'middle',
                family: this.FONT_TITLE, opacity: cardAlpha * 0.9
            });
        }
    }

    fmtNum(n) {
        if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
        if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
        return ''+n;
    }

    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;
        this.update(dt);
        this.draw(timestamp);
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) this.lastTime = performance.now();
        return this.paused;
    }

    resize() {
        // FIX: resize bhi parent-based use karo
        const parent = this.canvas.parentElement;
        if (parent && parent.clientWidth > 10 && parent.clientHeight > 10) {
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            this.canvas.width  = Math.round(w * this.dpr);
            this.canvas.height = Math.round(h * this.dpr);
            this.canvas.style.width  = w + 'px';
            this.canvas.style.height = h + 'px';
        } else {
            this.setupHDCanvas();
        }
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.player.x      = this.W / 2;
        this.player.y      = this.H - 80;
        this.playerTargetX = this.W / 2;
        this.stars = this.makeStars(this.isMobile ? 35 : 60);
        this.gates.forEach(g => g.midX = this.W / 2);
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click',     this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
        this.canvas.removeEventListener('mousemove',  this.boundMouseMove);
        this.canvas.removeEventListener('touchmove',  this.boundTouchMove);
    }
}