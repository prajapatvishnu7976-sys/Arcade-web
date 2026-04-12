/* ============================================================
   LIQUID SORT PUZZLE v2.0 - ULTRA HD MOBILE EDITION
   Crystal Clear Text | DPR Scaled | Zero Blur
   Premium Feel | Real Game Mechanics | Mobile-First
   ============================================================ */

'use strict';

class LiquidSort {
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
        // SAVE / SCORE
        // ============================================
        this.score     = 0;
        this.bestScore = parseInt(localStorage.getItem('liquid_best_v2') || '0');

        // ============================================
        // GAME STATE
        // ============================================
        this.level     = 1;
        this.moves     = 0;
        this.undoStack = [];
        this.maxUndo   = 3;
        this.undoLeft  = this.maxUndo;

        // ============================================
        // PREMIUM COLOR PALETTE
        // ============================================
        this.COLORS = [
            { fill: '#FF006E', light: '#FF66AA', dark: '#CC0055', name: 'Pink'   },
            { fill: '#00D4FF', light: '#66EAFF', dark: '#0099CC', name: 'Cyan'   },
            { fill: '#00FF88', light: '#66FFB8', dark: '#00CC66', name: 'Green'  },
            { fill: '#FFD700', light: '#FFE866', dark: '#CCA800', name: 'Gold'   },
            { fill: '#B94FE3', light: '#D488F0', dark: '#8833AA', name: 'Purple' },
            { fill: '#FF8C00', light: '#FFB04D', dark: '#CC6600', name: 'Orange' },
            { fill: '#FF3864', light: '#FF7799', dark: '#CC1144', name: 'Red'    },
            { fill: '#00FFF5', light: '#66FFF8', dark: '#00CCBB', name: 'Teal'   }
        ];

        // ============================================
        // TUBE CONFIG
        // ============================================
        this.tubes         = [];
        this.TUBE_CAPACITY = 4;
        this.selectedTube  = -1;
        this.pourAnim      = null;

        // ============================================
        // VISUAL FX
        // ============================================
        this.particles   = [];
        this.scorePopups = [];
        this.floatingTexts = [];
        this.popRings    = [];
        this.winAnim     = { active: false, timer: 0, stars: [] };

        // Max pool for mobile
        this.MAX_PARTICLES = this.isMobile ? 50 : 100;
        this.MAX_POP_RINGS = 10;

        // Screen effects
        this.shakeX = 0; this.shakeY = 0;
        this.shakeTimer = 0; this.shakeForce = 0;
        this.flashAlpha = 0; this.flashColor = '#fff';

        // Timing
        this.time  = 0;
        this.frame = 0;
        this.bgTime = 0;

        // ============================================
        // BACKGROUND
        // ============================================
        this.stars   = this.makeStars(this.isMobile ? 40 : 65);
        this.bubbles = [];

        // ============================================
        // HINT SYSTEM
        // ============================================
        this.hintActive = null;
        this.hintFlash  = 0;

        // Init
        this.generateLevel();

        // ============================================
        // EVENTS
        // ============================================
        this.boundClick = this.handleClick.bind(this);
        this.boundTouch = this.handleTouch.bind(this);
        canvas.addEventListener('click',      this.boundClick);
        canvas.addEventListener('touchstart', this.boundTouch, { passive: false });

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
    // CRISP SHAPE HELPERS
    // ============================================================
    fillRect(ctx, x, y, w, h) {
        ctx.fillRect(this.dX(x), this.dY(y), this.dSr(w), this.dSr(h));
    }

    strokeRect(ctx, x, y, w, h) {
        ctx.strokeRect(this.dX(x), this.dY(y), this.dSr(w), this.dSr(h));
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

    // Rounded rect with per-corner radii [tl, tr, br, bl]
    drawRoundRectCorners(ctx, x, y, w, h, radii) {
        const [tl, tr, br, bl] = radii.map(r => this.dS(r));
        const dx = this.dX(x), dy = this.dY(y);
        const dw = this.dSr(w), dh = this.dSr(h);
        ctx.beginPath();
        ctx.moveTo(dx + tl, dy);
        ctx.lineTo(dx + dw - tr, dy);
        ctx.arcTo(dx + dw, dy,      dx + dw, dy + tr,      tr);
        ctx.lineTo(dx + dw, dy + dh - br);
        ctx.arcTo(dx + dw, dy + dh, dx + dw - br, dy + dh, br);
        ctx.lineTo(dx + bl, dy + dh);
        ctx.arcTo(dx,      dy + dh, dx,      dy + dh - bl, bl);
        ctx.lineTo(dx,      dy + tl);
        ctx.arcTo(dx,      dy,      dx + tl, dy,           tl);
        ctx.closePath();
    }

    drawLine(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(this.dX(x1), this.dY(y1));
        ctx.lineTo(this.dX(x2), this.dY(y2));
    }

    // ============================================================
    // LEVEL GENERATION
    // ============================================================
    generateLevel() {
        this.selectedTube = -1;
        this.pourAnim     = null;
        this.hintActive   = null;
        this.hintFlash    = 0;
        this.undoStack    = [];
        this.undoLeft     = this.maxUndo;
        this.moves        = 0;
        this.particles    = [];
        this.popRings     = [];
        this.floatingTexts = [];

        const numColors = Math.min(3 + this.level, this.COLORS.length);
        const numTubes  = numColors + 2;
        const layers    = [];

        for (let c = 0; c < numColors; c++)
            for (let l = 0; l < this.TUBE_CAPACITY; l++)
                layers.push(c);

        // Fisher-Yates shuffle
        for (let i = layers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [layers[i], layers[j]] = [layers[j], layers[i]];
        }

        this.tubes = [];
        let layerIdx = 0;

        for (let t = 0; t < numColors; t++) {
            const tube = { layers: [], x: 0, y: 0, shake: 0, highlight: 0, completePulse: 0 };
            for (let l = 0; l < this.TUBE_CAPACITY; l++) {
                tube.layers.push({ colorIdx: layers[layerIdx++], fillAnim: 1 });
            }
            this.tubes.push(tube);
        }

        // Empty tubes
        for (let t = 0; t < 2; t++) {
            this.tubes.push({ layers: [], x: 0, y: 0, shake: 0, highlight: 0, completePulse: 0 });
        }

        this.calculateTubePositions();
        this.spawnBubbles();

        this.addFloatingText(
            this.W / 2, this.H / 2,
            `Level ${this.level}`,
            '#B94FE3', 24, 90
        );
    }

    calculateTubePositions() {
        const n      = this.tubes.length;
        const tw     = this.isMobile ? (this.isSmallScreen ? 38 : 44) : 48;
        const th     = this.isMobile ? (this.isSmallScreen ? 130 : 150) : 160;
        const gap    = this.isMobile ? 10 : 14;
        const perRow = Math.ceil(n / 2);
        const rowW   = perRow * (tw + gap) - gap;
        const startX = (this.W - rowW) / 2;
        const row1Y  = this.H * 0.23;
        const row2Y  = this.H * 0.60;

        this.tubeW = tw;
        this.tubeH = th;

        this.tubes.forEach((tube, i) => {
            const row = i < perRow ? 0 : 1;
            const col = i < perRow ? i : i - perRow;
            tube.x    = startX + col * (tw + gap) + tw / 2;
            tube.y    = row === 0 ? row1Y : row2Y;
        });
    }

    spawnBubbles() {
        this.bubbles = [];
        for (let i = 0; i < 8; i++) {
            this.bubbles.push({
                x:     Math.random() * this.W,
                y:     this.H + Math.random() * 50,
                r:     Math.random() * 6 + 3,
                speed: Math.random() * 0.5 + 0.2,
                drift: (Math.random() - 0.5) * 0.5,
                color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)].fill,
                alpha: Math.random() * 0.28 + 0.08
            });
        }
    }

    // ============================================================
    // EVENTS
    // ============================================================
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (this.W / rect.width);
        const my = (e.clientY - rect.top)  * (this.H / rect.height);
        this.processClick(mx, my);
    }

    handleTouch(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = (e.touches[0].clientX - rect.left) * (this.W / rect.width);
        const my = (e.touches[0].clientY - rect.top)  * (this.H / rect.height);
        this.processClick(mx, my);
    }

    processClick(mx, my) {
        if (this.paused || this.pourAnim) return;

        // Win screen
        if (this.winAnim.active) return;

        // Undo button
        const undoBx = this.W - 82, undoBy = this.H - 52;
        if (mx > undoBx && mx < undoBx + 74 && my > undoBy && my < undoBy + 38) {
            this.undo(); return;
        }

        // Hint button
        const hintBx = 8, hintBy = this.H - 52;
        if (mx > hintBx && mx < hintBx + 72 && my > hintBy && my < hintBy + 38) {
            this.showHint(); return;
        }

        const tubeIdx = this.getTubeAt(mx, my);
        if (tubeIdx === -1) { this.selectedTube = -1; return; }

        if (this.selectedTube === -1) {
            if (this.tubes[tubeIdx].layers.length === 0) return;
            this.selectedTube = tubeIdx;
            if (window.audioManager) audioManager.play('click');
        } else {
            if (tubeIdx === this.selectedTube) { this.selectedTube = -1; return; }
            this.pourTube(this.selectedTube, tubeIdx);
            this.selectedTube = -1;
        }
    }

    getTubeAt(mx, my) {
        const tw = this.tubeW;
        const th = this.tubeH;
        for (let i = 0; i < this.tubes.length; i++) {
            const t  = this.tubes[i];
            const tx = t.x;
            const ty = t.y - (this.selectedTube === i ? 18 : 0);
            if (mx > tx - tw/2 - 10 && mx < tx + tw/2 + 10 &&
                my > ty - 24       && my < ty + th + 20) {
                return i;
            }
        }
        return -1;
    }

    pourTube(fromIdx, toIdx) {
        const from = this.tubes[fromIdx];
        const to   = this.tubes[toIdx];

        if (from.layers.length === 0) { this.selectedTube = -1; return; }
        if (to.layers.length >= this.TUBE_CAPACITY) { this.shakeTube(toIdx); return; }

        const topColor = from.layers[from.layers.length - 1].colorIdx;

        if (to.layers.length > 0 && to.layers[to.layers.length - 1].colorIdx !== topColor) {
            this.shakeTube(toIdx);
            this.shakeTube(fromIdx);
            return;
        }

        // Save undo state
        this.undoStack.push(JSON.parse(JSON.stringify(this.tubes.map(t => t.layers))));
        if (this.undoStack.length > 5) this.undoStack.shift();

        // Count pour layers
        let pourCount = 0;
        for (let i = from.layers.length - 1; i >= 0; i--) {
            if (from.layers[i].colorIdx === topColor && to.layers.length + pourCount < this.TUBE_CAPACITY) {
                pourCount++;
            } else break;
        }

        this.pourAnim = {
            fromIdx, toIdx,
            colorIdx:  topColor,
            count:     pourCount,
            progress:  0,
            duration:  280 + pourCount * 90,
            layers:    []
        };

        for (let i = 0; i < pourCount; i++) {
            this.pourAnim.layers.push(from.layers.pop());
        }

        this.moves++;
        if (window.audioManager) audioManager.play('pop');
    }

    shakeTube(idx) {
        this.tubes[idx].shake = 15;
        if (window.audioManager) audioManager.play('fail');
    }

    undo() {
        if (this.undoStack.length === 0 || this.undoLeft <= 0 || this.pourAnim) return;
        const prev = this.undoStack.pop();
        this.tubes.forEach((t, i) => {
            t.layers = prev[i].map(l => ({ ...l }));
        });
        this.undoLeft--;
        this.selectedTube = -1;
        if (window.audioManager) audioManager.play('click');
        this.flashAlpha = 0.1;
        this.flashColor = '#00D4FF';
    }

    showHint() {
        for (let from = 0; from < this.tubes.length; from++) {
            if (this.tubes[from].layers.length === 0) continue;
            const topColor = this.tubes[from].layers[this.tubes[from].layers.length - 1].colorIdx;
            for (let to = 0; to < this.tubes.length; to++) {
                if (from === to) continue;
                if (this.tubes[to].layers.length >= this.TUBE_CAPACITY) continue;
                const toTop = this.tubes[to].layers.length > 0
                    ? this.tubes[to].layers[this.tubes[to].layers.length - 1].colorIdx
                    : -1;
                if (toTop === -1 || toTop === topColor) {
                    this.hintActive = { from, to };
                    this.hintFlash  = 35;
                    if (window.audioManager) audioManager.play('hover');
                    return;
                }
            }
        }
        this.addFloatingText(this.W/2, this.H/2, 'No moves found!', '#FF006E', 16, 80);
    }

    checkWin() {
        for (const tube of this.tubes) {
            if (tube.layers.length === 0) continue;
            if (tube.layers.length !== this.TUBE_CAPACITY) return false;
            const c = tube.layers[0].colorIdx;
            if (!tube.layers.every(l => l.colorIdx === c)) return false;
        }
        return true;
    }

    triggerWin() {
        const bonus = Math.max(0, 200 - this.moves * 5) + this.level * 100;
        this.score += bonus;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('liquid_best_v2', this.bestScore);
        }
        this.onScore(this.score);

        this.winAnim = {
            active: true,
            timer:  2600,
            stars:  Array.from({ length: 22 }, () => ({
                x:        Math.random() * this.W,
                y:        Math.random() * this.H,
                vx:       (Math.random() - 0.5) * 4,
                vy:       (Math.random() - 0.5) * 4 - 2,
                color:    this.COLORS[Math.floor(Math.random() * this.COLORS.length)].fill,
                size:     Math.random() * 12 + 6,
                life:     1,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2
            }))
        };

        this.flashAlpha = 0.35;
        this.flashColor = '#00FF88';
        this.shake(10, 5);

        if (window.audioManager) audioManager.play('levelUp');

        setTimeout(() => {
            this.level++;
            this.winAnim.active = false;
            this.generateLevel();
        }, 2600);
    }

    // ============================================================
    // FX HELPERS
    // ============================================================
    addFloatingText(x, y, text, color, size = 16, life = 80) {
        this.floatingTexts.push({ x, y, text, color, size, life, opacity: 1, scale: 0.3 });
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count && this.particles.length < this.MAX_PARTICLES; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 1.5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
                color, size: Math.random() * 5 + 2,
                life: 1, decay: Math.random()*0.04+0.02, grav: 0.12
            });
        }
    }

    shake(timer, force) { this.shakeTimer = timer; this.shakeForce = force; }

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

    fmtNum(n) {
        if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
        return '' + n;
    }

    hexToRgba(hex, alpha) {
        if (!hex || !hex.startsWith('#')) return hex;
        return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${Math.max(0,Math.min(1,alpha))})`;
    }

    // ============================================================
    // UPDATE
    // ============================================================
    update(timestamp, dt) {
        if (this.paused) return;

        this.time   += dt;
        this.frame++;
        this.bgTime += dt * 0.001;

        // Stars twinkle
        this.stars.forEach(s => { s.phase += s.speed; });

        // Shake
        if (this.shakeTimer > 0) {
            const f = this.shakeForce * (this.shakeTimer / 12);
            this.shakeX = (Math.random() - 0.5) * f;
            this.shakeY = (Math.random() - 0.5) * f * 0.4;
            this.shakeTimer--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - 0.025);
        if (this.hintFlash  > 0) this.hintFlash--;

        // Tube shakes & complete pulse
        this.tubes.forEach(t => {
            if (t.shake > 0) t.shake--;
            if (t.completePulse > 0) t.completePulse -= 0.05;
        });

        // Pour animation
        if (this.pourAnim) {
            this.pourAnim.progress += dt / this.pourAnim.duration;
            if (this.pourAnim.progress >= 1) {
                const to = this.tubes[this.pourAnim.toIdx];
                this.pourAnim.layers.forEach(l => to.layers.push({ colorIdx: l.colorIdx, fillAnim: 0 }));

                // Animate fill in
                to.layers.forEach((l, i) => {
                    if (l.fillAnim < 1) {
                        setTimeout(() => { l.fillAnim = 1; }, i * 30);
                    }
                });

                // Check complete tube
                if (to.layers.length === this.TUBE_CAPACITY) {
                    const allSame = to.layers.every(l => l.colorIdx === to.layers[0].colorIdx);
                    if (allSame) {
                        to.completePulse = 1;
                        const pos = this.tubeTopPos(this.pourAnim.toIdx);
                        this.spawnParticles(pos.x, pos.y - 20, this.COLORS[to.layers[0].colorIdx].fill, 14);
                        if (this.popRings.length < this.MAX_POP_RINGS)
                            this.popRings.push({ x: pos.x, y: to.y + this.tubeH/2, radius: 8, opacity: 0.7, color: this.COLORS[to.layers[0].colorIdx].fill });
                    }
                }

                this.pourAnim = null;

                if (this.checkWin()) this.triggerWin();
                if (window.audioManager) audioManager.play('splash');

                this.spawnPourParticles();
            }
        }

        // Win animation
        if (this.winAnim.active) {
            this.winAnim.timer -= dt;
            this.winAnim.stars.forEach(s => {
                s.x += s.vx; s.y += s.vy;
                s.vy += 0.06;
                s.rotation += s.rotSpeed;
                s.life -= 0.007;
            });
            this.winAnim.stars = this.winAnim.stars.filter(s => s.life > 0);
        }

        // Bubbles
        this.bubbles.forEach(b => {
            b.y -= b.speed;
            b.x += b.drift;
            if (b.y < -20) {
                b.y     = this.H + 20;
                b.x     = Math.random() * this.W;
                b.color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)].fill;
            }
        });

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += p.grav || 0.1; p.vx *= 0.97;
            p.life -= p.decay; p.size *= 0.96;
            if (p.life <= 0 || p.size < 0.3) this.particles.splice(i, 1);
        }

        // Pop rings
        for (let i = this.popRings.length - 1; i >= 0; i--) {
            const r = this.popRings[i];
            r.radius  += 2.5;
            r.opacity -= 0.038;
            if (r.opacity <= 0) this.popRings.splice(i, 1);
        }

        // Score popups
        this.scorePopups = this.scorePopups.filter(p => {
            p.y -= 1; p.life -= dt;
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
    }

    tubeTopPos(idx) {
        const t = this.tubes[idx];
        return { x: t.x, y: t.y };
    }

    spawnPourParticles() {
        const pa = this.pourAnim;
        if (!pa) return;
        const to        = this.tubes[pa.toIdx];
        if (!to) return;
        const colorData = this.COLORS[pa.colorIdx] || this.COLORS[0];
        for (let i = 0; i < 8 && this.particles.length < this.MAX_PARTICLES; i++) {
            this.particles.push({
                x: to.x + (Math.random() - 0.5) * 18,
                y: to.y + 10,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * -3 - 1,
                size: Math.random() * 5 + 2,
                life: 1, decay: 0.04,
                color: colorData.fill, grav: 0.1
            });
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
        if (this.shakeX || this.shakeY) {
            ctx.translate(this.dS(this.shakeX), this.dS(this.shakeY));
        }

        this.drawBackground(ctx);
        this.drawBubbles(ctx);
        this.drawTubes(ctx, timestamp);
        this.drawPourAnimation(ctx, timestamp);
        this.drawParticlesFX(ctx);
        this.drawPopRingsFX(ctx);
        this.drawScorePopupsFX(ctx);
        this.drawFloatingTextsFX(ctx);
        this.drawWinAnimation(ctx, timestamp);

        // Flash overlay
        if (this.flashAlpha > 0) {
            ctx.fillStyle = this.hexToRgba(this.flashColor, this.flashAlpha);
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.drawHUD(ctx);

        ctx.restore();
    }

    // ============================================================
    // DRAW: BACKGROUND
    // ============================================================
    drawBackground(ctx) {
        const W = this.W, H = this.H;

        const bg = ctx.createRadialGradient(
            this.dX(W/2), this.dY(H*0.35), 0,
            this.dX(W/2), this.dY(H/2), this.dS(H)
        );
        bg.addColorStop(0,   '#110825');
        bg.addColorStop(0.5, '#080518');
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

        // Vignette
        const vg = ctx.createRadialGradient(
            this.dX(W/2), this.dY(H/2), this.dS(H*0.15),
            this.dX(W/2), this.dY(H/2), this.dS(H*0.9)
        );
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ============================================================
    // DRAW: FLOATING BUBBLES
    // ============================================================
    drawBubbles(ctx) {
        for (const b of this.bubbles) {
            ctx.save();
            ctx.globalAlpha = b.alpha;
            ctx.strokeStyle = b.color;
            ctx.lineWidth   = this.dS(1);
            this.drawCircle(ctx, b.x, b.y, b.r);
            ctx.stroke();
            ctx.globalAlpha = b.alpha * 0.25;
            ctx.fillStyle   = b.color;
            ctx.fill();
            ctx.restore();
        }
    }

    // ============================================================
    // DRAW: TUBES
    // ============================================================
    drawTubes(ctx, timestamp) {
        const tw      = this.tubeW;
        const th      = this.tubeH;
        const layerH  = th / this.TUBE_CAPACITY;

        this.tubes.forEach((tube, idx) => {
            const shakeOff   = tube.shake > 0 ? Math.sin(tube.shake * 0.8) * 4 : 0;
            const selectedOff = this.selectedTube === idx ? -18 : 0;
            const isSelected = this.selectedTube === idx;
            const isHintFrom = this.hintActive && this.hintActive.from === idx && this.hintFlash > 0;
            const isHintTo   = this.hintActive && this.hintActive.to   === idx && this.hintFlash > 0;
            const isHint     = isHintFrom || isHintTo;

            // Is complete?
            const isComplete = tube.layers.length === this.TUBE_CAPACITY &&
                               tube.layers.every(l => l.colorIdx === tube.layers[0].colorIdx);

            ctx.save();
            ctx.translate(
                this.dX(tube.x + shakeOff),
                this.dY(tube.y + selectedOff)
            );

            // Glow effect (separate low-opacity pass, doesn't blur text)
            if (isSelected || isHint || isComplete) {
                const glowColor = isComplete ? '#FFD700'
                    : isSelected ? '#00D4FF'
                    : `rgba(255,215,0,${this.hintFlash / 35})`;
                const glowSize  = this.dS(isComplete ? 22 : 18);

                ctx.save();
                ctx.shadowBlur  = glowSize;
                ctx.shadowColor = glowColor;
                ctx.strokeStyle = glowColor;
                ctx.lineWidth   = this.dS(isComplete ? 2.5 : 2);
                this.drawTubeOutline_raw(ctx, tw, th);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
            }

            // Tube body
            this.drawTubeBody(ctx, tw, th, isSelected, isHint);

            // Liquid layers
            tube.layers.forEach((layer, li) => {
                const colorData = this.COLORS[layer.colorIdx];
                const lx  = -tw/2 + 4;
                const lw  = tw - 8;
                const lh  = layerH - 2;
                const ly  = th - (li + 1) * layerH + 2;
                const isBottom = li === 0;
                const isTop    = li === tube.layers.length - 1;

                // Clip to tube interior
                ctx.save();
                this.drawTubeInteriorClip(ctx, tw, th);
                ctx.clip();

                // Liquid gradient
                const lg = ctx.createLinearGradient(
                    this.dX(lx), this.dY(ly),
                    this.dX(lx + lw), this.dY(ly + lh)
                );
                lg.addColorStop(0,   colorData.light);
                lg.addColorStop(0.5, colorData.fill);
                lg.addColorStop(1,   colorData.dark);

                ctx.fillStyle = lg;
                // Glow for liquid (subtle, won't blur text)
                ctx.shadowBlur  = this.dS(5);
                ctx.shadowColor = colorData.fill;

                const radii = isBottom ? [0, 0, 12, 12] : isTop ? [4, 4, 0, 0] : [0, 0, 0, 0];
                this.drawRoundRectCorners(ctx, lx, ly, lw, lh, radii);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Liquid shine
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                this.drawRoundRect(ctx, lx + 2, ly + 2, lw * 0.38, lh - 4, 2);
                ctx.fill();

                // Top wave (topmost layer)
                if (isTop) {
                    const waveY = ly + 3;
                    ctx.strokeStyle = colorData.light;
                    ctx.lineWidth   = this.dS(1.5);
                    ctx.globalAlpha = 0.45;
                    ctx.beginPath();
                    const wSteps = Math.ceil(this.dS(lw) / 6);
                    for (let wx = 0; wx <= wSteps; wx++) {
                        const logX = lx + (wx / wSteps) * lw;
                        const wave = Math.sin((logX * 0.5 + this.time / 300)) * 1.8;
                        const px   = this.dX(logX);
                        const py   = this.dY(waveY + wave);
                        wx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }

                ctx.restore();
            });

            // Glass overlay
            this.drawTubeGlassOverlay(ctx, tw, th);

            // Complete indicator — crisp gold border + checkmark
            if (isComplete) {
                // Gold border (glow pass already done above)
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth   = this.dS(2.5);
                this.drawTubeOutline_raw(ctx, tw, th);
                ctx.stroke();

                // Checkmark above tube
                this.drawText(ctx, '✓', 0, -12, {
                    size: 14, weight: 'bold', color: '#FFD700',
                    align: 'center', baseline: 'middle',
                    glow: true, glowColor: '#FFD700', glowBlur: 6,
                    family: this.FONT_UI
                });
            }

            ctx.restore();
        });
    }

    // Raw tube outline path (ctx already translated to tube origin)
    drawTubeOutline_raw(ctx, tw, th) {
        const halfW = this.dS(tw / 2);
        const fullH = this.dS(th);
        const rBot  = halfW;
        ctx.beginPath();
        ctx.moveTo(-halfW, 0);
        ctx.lineTo(-halfW, fullH - rBot);
        ctx.arc(0, fullH - rBot, rBot, Math.PI, 0, false);
        ctx.lineTo(halfW, 0);
    }

    drawTubeInteriorClip(ctx, tw, th) {
        const halfW = this.dS(tw/2 - 3);
        const fullH = this.dS(th);
        const rBot  = halfW;
        ctx.beginPath();
        ctx.moveTo(-halfW, 0);
        ctx.lineTo(-halfW, fullH - rBot);
        ctx.arc(0, fullH - rBot, rBot, Math.PI, 0, false);
        ctx.lineTo(halfW, 0);
        ctx.closePath();
    }

    drawTubeBody(ctx, tw, th, selected, hint) {
        // Background fill
        ctx.fillStyle = 'rgba(14,8,32,0.55)';
        this.drawTubeOutline_raw(ctx, tw, th);
        ctx.fill();

        // Border — crisp, no shadow blur here
        const borderColor = selected ? '#00D4FF'
            : hint ? `rgba(255,215,0,${this.hintFlash / 35})`
            : 'rgba(255,255,255,0.22)';

        ctx.strokeStyle = borderColor;
        ctx.lineWidth   = this.dS(selected ? 2.5 : 1.5);
        this.drawTubeOutline_raw(ctx, tw, th);
        ctx.stroke();

        // Top rim
        ctx.strokeStyle = borderColor;
        ctx.lineWidth   = this.dS(2);
        ctx.beginPath();
        ctx.moveTo(this.dS(-tw/2 - 3), 0);
        ctx.lineTo(this.dS(tw/2 + 3),  0);
        ctx.stroke();
    }

    drawTubeGlassOverlay(ctx, tw, th) {
        const halfW = this.dS(tw / 2);
        const fullH = this.dS(th);
        const rBot  = halfW;

        // Left-side glass shine
        ctx.save();
        this.drawTubeInteriorClip(ctx, tw, th);
        ctx.clip();

        const glassGrad = ctx.createLinearGradient(
            -halfW, 0,
            this.dS(-tw/2 + tw*0.4), 0
        );
        glassGrad.addColorStop(0,   'rgba(255,255,255,0.10)');
        glassGrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
        glassGrad.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = glassGrad;
        ctx.fillRect(-halfW, 0, this.dS(tw * 0.45), fullH);

        ctx.restore();
    }

    // ============================================================
    // DRAW: POUR ANIMATION
    // ============================================================
    drawPourAnimation(ctx, timestamp) {
        if (!this.pourAnim) return;

        const prog      = Math.min(1, this.pourAnim.progress);
        const from      = this.tubes[this.pourAnim.fromIdx];
        const to        = this.tubes[this.pourAnim.toIdx];
        const colorData = this.COLORS[this.pourAnim.colorIdx];
        const selOff    = this.selectedTube === this.pourAnim.fromIdx ? -18 : 0;

        const fx = from.x;
        const fy = from.y + selOff;
        const tx = to.x;
        const ty = to.y;

        // Arc stream
        const steps = 22;
        const drawn = Math.floor(steps * prog);

        for (let i = 0; i < drawn; i++) {
            const t    = i / steps;
            const bx   = fx + (tx - fx) * t;
            const by   = fy + (ty - fy) * t - Math.sin(t * Math.PI) * 38;
            const size = Math.max(1.2, 5 - t * 2.5);

            ctx.globalAlpha = 0.75 - t * 0.35;
            ctx.fillStyle   = colorData.fill;
            ctx.shadowBlur  = this.dS(7);
            ctx.shadowColor = colorData.fill;
            this.drawCircle(ctx, bx, by, size);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        // Leading drips
        for (let i = 0; i < 3; i++) {
            const dp  = (prog + i / 3) % 1;
            const ddx = fx + (tx - fx) * dp;
            const ddy = fy + (ty - fy) * dp - Math.sin(dp * Math.PI) * 38;
            ctx.globalAlpha = 0.55 - dp * 0.35;
            ctx.fillStyle   = colorData.light;
            this.drawCircle(ctx, ddx, ddy, Math.max(0.8, 3 - dp * 2));
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // DRAW: WIN ANIMATION
    // ============================================================
    drawWinAnimation(ctx, timestamp) {
        if (!this.winAnim.active) return;

        // Confetti stars
        for (const s of this.winAnim.stars) {
            ctx.save();
            ctx.translate(this.dX(s.x), this.dY(s.y));
            ctx.rotate(s.rotation);
            ctx.globalAlpha = s.life;
            ctx.fillStyle   = s.color;
            ctx.shadowBlur  = this.dS(7);
            ctx.shadowColor = s.color;
            // Star shape
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle      = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const innerAngle = angle + Math.PI / 5;
                const or = this.dS(s.size);
                const ir = this.dS(s.size * 0.4);
                if (i === 0) ctx.moveTo(Math.cos(angle) * or, Math.sin(angle) * or);
                else         ctx.lineTo(Math.cos(angle) * or, Math.sin(angle) * or);
                ctx.lineTo(Math.cos(innerAngle) * ir, Math.sin(innerAngle) * ir);
            }
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Win card
        const prog      = 1 - this.winAnim.timer / 2600;
        const textAlpha = prog < 0.8 ? prog / 0.8 : (1 - (prog - 0.8) / 0.2);
        const textScale = Math.min(1, 0.5 + prog * 1.2);

        ctx.save();
        ctx.translate(this.dX(this.W / 2), this.dY(this.H / 2 - 20));
        ctx.scale(textScale, textScale);
        ctx.globalAlpha = textAlpha;

        // Card bg
        this.drawRoundRect(ctx, -135, -50, 270, 96, 16);
        ctx.fillStyle = 'rgba(4,2,14,0.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,255,136,0.35)';
        ctx.lineWidth   = this.dS(1.5);
        ctx.stroke();

        ctx.restore();

        // Win text — drawn at screen coords, no scale distortion
        const mx = this.W / 2;
        const my = this.H / 2 - 22;

        this.drawText(ctx, 'LEVEL CLEAR!', mx, my, {
            size: 22, weight: 'bold', color: '#00FF88',
            align: 'center', baseline: 'middle',
            glow: true, glowColor: '#00FF88', glowBlur: 10,
            family: this.FONT_TITLE, opacity: textAlpha
        });

        const bonus = Math.max(0, 200 - this.moves * 5) + this.level * 100;
        this.drawText(ctx, `+${bonus} bonus!`, mx, my + 26, {
            size: 14, weight: '600', color: '#FFD700',
            align: 'center', baseline: 'middle',
            family: this.FONT_MONO, opacity: textAlpha
        });
    }

    // ============================================================
    // DRAW: FX
    // ============================================================
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

    drawPopRingsFX(ctx) {
        ctx.save();
        for (const r of this.popRings) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth   = this.dS(2 * r.opacity);
            this.drawCircle(ctx, r.x, r.y, r.radius);
            ctx.stroke();
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
    // DRAW: HUD — fully crisp
    // ============================================================
    drawHUD(ctx) {
        const W = this.W, H = this.H;

        // Top bar bg
        const hudGrad = ctx.createLinearGradient(0, 0, 0, this.dY(44));
        hudGrad.addColorStop(0, 'rgba(0,0,0,0.72)');
        hudGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = hudGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.dY(44));

        // Separator
        ctx.strokeStyle = 'rgba(185,79,227,0.15)';
        ctx.lineWidth   = this.dS(0.5);
        this.drawLine(ctx, 0, 44, W, 44);
        ctx.stroke();

        // Level label
        this.drawText(ctx, `LEVEL ${this.level}`, 12, 22, {
            size: 12, weight: 'bold', color: '#cc66ff',
            family: this.FONT_TITLE,
            glow: true, glowColor: '#b347d9', glowBlur: 5
        });

        // Score (center)
        this.drawText(ctx, this.fmtNum(this.score), W/2, 22, {
            size: 15, weight: 'bold', color: '#00D4FF',
            align: 'center', family: this.FONT_TITLE,
            glow: true, glowColor: '#00D4FF', glowBlur: 5
        });

        // Best (center sub)
        this.drawText(ctx, `BEST: ${this.fmtNum(this.bestScore)}`, W/2, 36, {
            size: 8, weight: '500', color: 'rgba(255,215,0,0.45)',
            align: 'center', family: this.FONT_MONO
        });

        // Moves (right)
        this.drawText(ctx, `Moves: ${this.moves}`, W - 12, 22, {
            size: 11, color: 'rgba(180,180,200,0.7)',
            align: 'right', family: this.FONT_MONO
        });

        // ---- UNDO BUTTON ----
        const undoBx = W - 82, undoBy = H - 52;
        const canUndo = this.undoLeft > 0 && this.undoStack.length > 0;

        ctx.fillStyle = canUndo ? 'rgba(0,150,200,0.22)' : 'rgba(40,40,60,0.18)';
        this.drawRoundRect(ctx, undoBx, undoBy, 74, 38, 9);
        ctx.fill();

        ctx.strokeStyle = canUndo ? 'rgba(0,212,255,0.45)' : 'rgba(80,80,80,0.22)';
        ctx.lineWidth   = this.dS(1);
        this.drawRoundRect(ctx, undoBx, undoBy, 74, 38, 9);
        ctx.stroke();

        this.drawText(ctx, 'UNDO', undoBx + 37, undoBy + 16, {
            size: 11, weight: 'bold',
            color: canUndo ? '#00D4FF' : '#445566',
            align: 'center', family: this.FONT_TITLE
        });
        this.drawText(ctx, `${this.undoLeft} left`, undoBx + 37, undoBy + 30, {
            size: 8, color: canUndo ? 'rgba(0,212,255,0.55)' : 'rgba(80,80,80,0.4)',
            align: 'center', family: this.FONT_MONO
        });

        // ---- HINT BUTTON ----
        const hintBx = 8, hintBy = H - 52;

        ctx.fillStyle = 'rgba(200,150,0,0.18)';
        this.drawRoundRect(ctx, hintBx, hintBy, 72, 38, 9);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth   = this.dS(1);
        this.drawRoundRect(ctx, hintBx, hintBy, 72, 38, 9);
        ctx.stroke();

        this.drawText(ctx, 'HINT', hintBx + 36, hintBy + 16, {
            size: 11, weight: 'bold', color: '#FFD700',
            align: 'center', family: this.FONT_TITLE
        });
        this.drawText(ctx, 'find move', hintBx + 36, hintBy + 30, {
            size: 8, color: 'rgba(255,215,0,0.45)',
            align: 'center', family: this.FONT_MONO
        });

        // ---- LEVEL PROGRESS BAR ----
        const numColors = Math.min(3 + this.level, this.COLORS.length);
        const totalTubes = numColors;
        let completedTubes = 0;
        for (const tube of this.tubes) {
            if (tube.layers.length === this.TUBE_CAPACITY &&
                tube.layers.every(l => l.colorIdx === tube.layers[0].colorIdx)) {
                completedTubes++;
            }
        }
        const prog = completedTubes / Math.max(1, totalTubes);
        const pbx  = 8, pby = H - 8;
        const pbw  = W - 16;

        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this.drawRoundRect(ctx, pbx, pby - 4, pbw, 4, 2);
        ctx.fill();

        if (prog > 0) {
            const gr = ctx.createLinearGradient(this.dX(pbx), 0, this.dX(pbx + pbw * prog), 0);
            gr.addColorStop(0, '#B94FE3');
            gr.addColorStop(0.5, '#00D4FF');
            gr.addColorStop(1, '#00FF88');
            ctx.fillStyle = gr;
            this.drawRoundRect(ctx, pbx, pby - 4, pbw * prog, 4, 2);
            ctx.fill();
        }
    }

    // ============================================================
    // GAME LOOP
    // ============================================================
    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;
        if (!this.paused) this.update(timestamp, dt);
        this.draw(timestamp);
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused = !this.paused;
        if (!this.paused) {
            this.lastTime = performance.now();
        }
        return this.paused;
    }

    resize() {
        this.setupHDCanvas();
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile      = this.W < 768 || ('ontouchstart' in window);
        this.isSmallScreen = this.W < 380;
        this.stars = this.makeStars(this.isMobile ? 40 : 65);
        this.calculateTubePositions();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click',      this.boundClick);
        this.canvas.removeEventListener('touchstart', this.boundTouch);
    }
}