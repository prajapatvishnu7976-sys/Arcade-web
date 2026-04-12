/* ============================================================
   BLOCK VS BALL v2.1 — MOBILE FIXED
   NeonArcade Compatible | DPR Scaled | Zero Blur
   Fullscreen | Mobile-First | Premium Quality
   FIX: DPR 2.5→2 (lag fix) | setupHD parent-based (screen fit fix)
   ============================================================ */

'use strict';

class BlockVsBall {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.onScore = onScore;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;

        // ── FIX 1: DPR max 2 instead of 2.5 — big lag reduction on mobile ──
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this._setupHD();
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile = ('ontouchstart' in window) || window.innerWidth < 768;

        this.FT = '"Orbitron","Segoe UI",monospace';
        this.FU = '"Rajdhani",-apple-system,sans-serif';

        this.STATE = { WAIT:0, PLAY:1, DEAD:2 };
        this.state = this.STATE.WAIT;

        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bvb2_best') || '0');
        this.level = 1;
        this.lives = 3;
        this.combo = 0;
        this.maxCombo = 0;

        // Paddle
        this.paddle = {
            x: this.W / 2, y: this.H - 42,
            w: Math.min(this.W * 0.28, 120), h: 14,
            targetX: this.W / 2, trail: []
        };

        // Ball
        this.balls = [];
        this.baseSpeed = 4.5;

        // Blocks
        this.blocks = [];
        this.COLS = Math.min(8, Math.floor((this.W - 20) / 48));
        this.BCOLORS = [
            { fill:'#FF006E', lt:'#FF66AA', dk:'#CC0044', pts:10 },
            { fill:'#00D4FF', lt:'#88EEFF', dk:'#0088AA', pts:20 },
            { fill:'#00FF88', lt:'#88FFCC', dk:'#00AA55', pts:30 },
            { fill:'#FFD700', lt:'#FFEE88', dk:'#CC9900', pts:40 },
            { fill:'#B94FE3', lt:'#DD99FF', dk:'#7722AA', pts:50 },
            { fill:'#FF8C00', lt:'#FFBB66', dk:'#CC6600', pts:30 }
        ];

        // FX
        this.parts = [];
        this.pops = [];
        this.rings = [];
        this.MAX_PARTS = this.isMobile ? 40 : 100;
        this.shakeX = 0; this.shakeY = 0; this.shakeT = 0;
        this.flashA = 0; this.flashC = '#fff';
        this.deathA = 0;
        this.time = 0;

        // BG
        this.stars = this._mkStars(this.isMobile ? 20 : 45);

        // FS
        this.fsRect = { x:0, y:0, w:44, h:44 };

        this._genLevel();
        this._resetBall();
        this._bind();

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this._loop(t));
    }

    // ── FIX 2: setupHD uses parent element dimensions for reliable mobile height ──
    _setupHD() {
        // Try parent element first (game-wrapper — most reliable on mobile)
        const parent = this.canvas.parentElement;
        let w, h;

        if (parent && parent.clientWidth > 10 && parent.clientHeight > 10) {
            w = parent.clientWidth;
            h = parent.clientHeight;
        } else {
            // Fallback: getBoundingClientRect
            const r = this.canvas.getBoundingClientRect();
            w = (r.width  > 10 ? r.width  : this.canvas.clientWidth)  || window.innerWidth;
            h = (r.height > 10 ? r.height : this.canvas.clientHeight) || window.innerHeight;
        }

        this.canvas.width  = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
        this.canvas.style.width  = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    S(v) { return v * this.dpr; }
    X(v) { return Math.round(v * this.dpr); }

    _txt(t, x, y, o = {}) {
        const c = this.ctx;
        const { sz=14, wt='bold', col='#fff', al='left', bl='alphabetic',
                ff=null, op=1, stroke=false, sc='rgba(0,0,0,0.6)', sw=3 } = o;
        c.save(); c.globalAlpha = op;
        c.textAlign = al; c.textBaseline = bl;
        c.font = `${wt} ${Math.round(sz * this.dpr)}px ${ff || (sz > 14 ? this.FT : this.FU)}`;
        if (stroke) { c.strokeStyle = sc; c.lineWidth = sw * this.dpr; c.lineJoin = 'round'; c.strokeText(t, this.X(x), this.X(y)); }
        c.shadowBlur = 0; c.fillStyle = col; c.fillText(t, this.X(x), this.X(y));
        c.restore();
    }

    _circle(x, y, r) { this.ctx.beginPath(); this.ctx.arc(this.X(x), this.X(y), this.S(r), 0, Math.PI * 2); }

    _rrect(x, y, w, h, r) {
        const c = this.ctx;
        const dx = this.X(x), dy = this.X(y), dw = this.X(x+w)-dx, dh = this.X(y+h)-dy, dr = this.S(r);
        c.beginPath();
        c.moveTo(dx + dr, dy);
        c.arcTo(dx + dw, dy, dx + dw, dy + dh, dr);
        c.arcTo(dx + dw, dy + dh, dx, dy + dh, dr);
        c.arcTo(dx, dy + dh, dx, dy, dr);
        c.arcTo(dx, dy, dx + dw, dy, dr);
        c.closePath();
    }

    _mkStars(n) {
        return Array.from({length: n}, () => ({
            x: Math.random() * this.W, y: Math.random() * this.H,
            r: Math.random() * 1.2 + 0.3, ph: Math.random() * 6.28,
            sp: Math.random() * 0.01 + 0.003
        }));
    }

    _sfx(name, cd = 80) {
        if (!window.audioManager) return;
        try { audioManager.play(name); } catch(e) {}
    }

    // ─── Level Gen ───

    _genLevel() {
        this.blocks = [];
        const rows = Math.min(5 + Math.floor(this.level / 2), 10);
        const cols = this.COLS;
        const pad = 4;
        const bw = (this.W - 20 - (cols - 1) * pad) / cols;
        const bh = Math.min(22, this.H * 0.032);
        const ox = 10;
        const oy = 55;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.08) continue;
                const ci = (r * 3 + c * 2) % this.BCOLORS.length;
                const hp = 1 + Math.floor(r / 3) + Math.floor(this.level / 3);
                this.blocks.push({
                    x: ox + c * (bw + pad), y: oy + r * (bh + pad),
                    w: bw, h: bh, ci, hp, maxHp: hp,
                    hitAnim: 0, scale: 0, dead: false
                });
            }
        }
    }

    _resetBall() {
        const spd = this.baseSpeed + this.level * 0.25;
        this.balls = [{
            x: this.paddle.x, y: this.paddle.y - 12,
            dx: 0, dy: 0, r: 6,
            speed: spd, attached: true,
            trail: []
        }];
    }

    // ─── Events ───

    _bind() {
        this._onMM = e => {
            const r = this.canvas.getBoundingClientRect();
            this.paddle.targetX = (e.clientX - r.left) * (this.W / r.width);
        };
        this._onTS = e => {
            e.preventDefault();
            const r = this.canvas.getBoundingClientRect();
            const tx = (e.touches[0].clientX - r.left) * (this.W / r.width);
            const ty = (e.touches[0].clientY - r.top) * (this.H / r.height);

            const f = this.fsRect;
            if (tx >= f.x && tx <= f.x + f.w && ty >= f.y && ty <= f.y + f.h) { this._toggleFS(); return; }

            this.paddle.targetX = tx;
            this._handleTap();
        };
        this._onTM = e => {
            e.preventDefault();
            const r = this.canvas.getBoundingClientRect();
            this.paddle.targetX = (e.touches[0].clientX - r.left) * (this.W / r.width);
        };
        this._onClick = () => this._handleTap();

        this.canvas.addEventListener('mousemove', this._onMM);
        this.canvas.addEventListener('touchstart', this._onTS, { passive: false });
        this.canvas.addEventListener('touchmove', this._onTM, { passive: false });
        this.canvas.addEventListener('click', this._onClick);
    }

    _handleTap() {
        if (this.state === this.STATE.WAIT) {
            this.state = this.STATE.PLAY;
            this.balls.forEach(b => {
                if (b.attached) {
                    b.attached = false;
                    b.dx = (Math.random() - 0.5) * 3;
                    b.dy = -b.speed;
                }
            });
            this._sfx('click');
            return;
        }
        if (this.state === this.STATE.DEAD && this.deathA > 0.8) {
            this._restart();
            return;
        }
        this.balls.forEach(b => {
            if (b.attached) {
                b.attached = false;
                b.dx = (Math.random() - 0.5) * 3;
                b.dy = -b.speed;
                this._sfx('shoot');
            }
        });
    }

    _restart() {
        this.score = 0; this.onScore(0);
        this.level = 1; this.lives = 3;
        this.combo = 0; this.maxCombo = 0;
        this.deathA = 0; this.flashA = 0;
        this.parts = []; this.pops = []; this.rings = [];
        this._genLevel(); this._resetBall();
        this.state = this.STATE.WAIT;
    }

    _toggleFS() {
        const el = this.canvas.parentElement || this.canvas;
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (!isFS) { (el.requestFullscreen || el.webkitRequestFullscreen || function(){}).call(el); }
        else { (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document); }
        setTimeout(() => this.resize(), 200);
    }

    // ─── Update ───

    update(ts, dt) {
        if (this.paused) return;
        this.time += dt;
        this.stars.forEach(s => s.ph += s.sp);

        if (this.shakeT > 0) {
            this.shakeX = (Math.random() - .5) * 6 * (this.shakeT / 16);
            this.shakeY = (Math.random() - .5) * 3 * (this.shakeT / 16);
            this.shakeT--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - 0.04);

        this.blocks.forEach(b => {
            b.scale = Math.min(1, b.scale + 0.06);
            b.hitAnim = Math.max(0, b.hitAnim - 0.06);
        });

        this.parts = this.parts.filter(p => {
            p.x += p.vx; p.y += p.vy; p.vy += p.g;
            p.vx *= 0.96; p.life -= p.dec; p.r *= 0.96;
            return p.life > 0 && p.r > 0.3;
        });
        this.rings = this.rings.filter(r => { r.r += 2.5; r.a -= 0.035; return r.a > 0; });
        this.pops = this.pops.filter(p => { p.y -= 1.1; p.life -= dt; p.op = Math.min(1, p.life / 500); return p.life > 0; });

        if (this.state === this.STATE.DEAD) { this.deathA = Math.min(1, this.deathA + 0.016); return; }
        if (this.state === this.STATE.WAIT) {
            this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.15;
            this.paddle.x = Math.max(this.paddle.w / 2 + 5, Math.min(this.W - this.paddle.w / 2 - 5, this.paddle.x));
            this.balls.forEach(b => { if (b.attached) { b.x = this.paddle.x; b.y = this.paddle.y - b.r - 2; } });
            return;
        }

        this.paddle.x += (this.paddle.targetX - this.paddle.x) * 0.18;
        this.paddle.x = Math.max(this.paddle.w / 2 + 5, Math.min(this.W - this.paddle.w / 2 - 5, this.paddle.x));

        this.paddle.trail.push({ x: this.paddle.x, y: this.paddle.y });
        if (this.paddle.trail.length > 8) this.paddle.trail.shift();

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            if (b.attached) { b.x = this.paddle.x; b.y = this.paddle.y - b.r - 2; continue; }

            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 6) b.trail.shift();

            b.x += b.dx;
            b.y += b.dy;

            if (b.x - b.r < 2) { b.x = b.r + 2; b.dx = Math.abs(b.dx); this._sfx('bounce'); }
            if (b.x + b.r > this.W - 2) { b.x = this.W - b.r - 2; b.dx = -Math.abs(b.dx); this._sfx('bounce'); }
            if (b.y - b.r < 2) { b.y = b.r + 2; b.dy = Math.abs(b.dy); this._sfx('bounce'); }

            const pw = this.paddle.w / 2 + 4;
            if (b.dy > 0 &&
                b.y + b.r >= this.paddle.y - this.paddle.h / 2 &&
                b.y - b.r <= this.paddle.y + this.paddle.h / 2 &&
                b.x >= this.paddle.x - pw && b.x <= this.paddle.x + pw) {

                const hit = (b.x - this.paddle.x) / pw;
                const angle = hit * Math.PI / 3;
                const spd = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
                b.dx = Math.sin(angle) * spd;
                b.dy = -Math.abs(Math.cos(angle) * spd);
                b.y = this.paddle.y - this.paddle.h / 2 - b.r - 1;
                this.combo = 0;
                this._sfx('bounce');
                this.shakeT = 3;
            }

            for (let j = this.blocks.length - 1; j >= 0; j--) {
                const bl = this.blocks[j];
                if (bl.dead) continue;

                if (b.x + b.r > bl.x && b.x - b.r < bl.x + bl.w &&
                    b.y + b.r > bl.y && b.y - b.r < bl.y + bl.h) {

                    const oleft = (b.x + b.r) - bl.x;
                    const oright = (bl.x + bl.w) - (b.x - b.r);
                    const otop = (b.y + b.r) - bl.y;
                    const obot = (bl.y + bl.h) - (b.y - b.r);
                    const min = Math.min(oleft, oright, otop, obot);

                    if (min === oleft) b.dx = -Math.abs(b.dx);
                    else if (min === oright) b.dx = Math.abs(b.dx);
                    else if (min === otop) b.dy = -Math.abs(b.dy);
                    else b.dy = Math.abs(b.dy);

                    bl.hp--;
                    bl.hitAnim = 1;

                    if (bl.hp <= 0) {
                        bl.dead = true;
                        this.combo++;
                        this.maxCombo = Math.max(this.maxCombo, this.combo);

                        const bc = this.BCOLORS[bl.ci];
                        const pts = bc.pts * Math.max(1, this.combo);
                        this.score += pts;
                        this.onScore(this.score);
                        if (this.score > this.bestScore) {
                            this.bestScore = this.score;
                            localStorage.setItem('bvb2_best', this.bestScore);
                        }

                        const cx = bl.x + bl.w / 2, cy = bl.y + bl.h / 2;
                        this._burst(cx, cy, bc.fill, 10);
                        this.rings.push({ x: cx, y: cy, r: bl.w * 0.4, a: 0.7, col: bc.fill });
                        this.pops.push({
                            x: cx, y: cy - 10,
                            text: this.combo > 1 ? `+${pts} ×${this.combo}` : `+${pts}`,
                            col: this.combo > 3 ? '#FFD700' : bc.fill,
                            life: 1000, op: 1
                        });

                        this.shakeT = Math.min(12, this.combo * 2);
                        this.flashA = Math.min(0.2, 0.04 + this.combo * 0.02);
                        this.flashC = bc.fill;
                        this._sfx(this.combo > 3 ? 'combo' : 'score');
                    } else {
                        this._sfx('hit');
                    }
                    break;
                }
            }

            if (b.y > this.H + 20) {
                this.balls.splice(i, 1);
            }
        }

        if (this.balls.length === 0) {
            this.lives--;
            this.combo = 0;
            this.shakeT = 14;
            this.flashA = 0.4; this.flashC = '#FF0044';
            this._sfx('fail');

            if (this.lives <= 0) {
                this._gameOver();
            } else {
                this._resetBall();
                this.state = this.STATE.WAIT;
            }
        }

        if (this.blocks.every(b => b.dead)) {
            this.level++;
            this.score += 500 * this.level;
            this.onScore(this.score);
            this._genLevel();
            this._resetBall();
            this.state = this.STATE.WAIT;
            this.flashA = 0.25; this.flashC = '#00FF88';
            this.shakeT = 10;
            this._sfx('levelUp');
            this.pops.push({ x: this.W / 2, y: this.H / 2 - 20, text: `LEVEL ${this.level}!`, col: '#00FF88', life: 1500, op: 1 });
        }

        this.blocks = this.blocks.filter(b => !b.dead || b.hitAnim > 0);
    }

    _gameOver() {
        this.state = this.STATE.DEAD;
        this.deathA = 0;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bvb2_best', this.bestScore);
        }
        setTimeout(() => { if (!this.destroyed) this.onScore(this.score, true); }, 1200);
        this._sfx('gameOver');
    }

    _burst(x, y, col, n) {
        for (let i = 0; i < n && this.parts.length < this.MAX_PARTS; i++) {
            const a = Math.random() * Math.PI * 2, sp = Math.random() * 5 + 2;
            this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 4 + 1.5, life: 1, dec: 0.04, col, g: 0.1 });
        }
    }

    // ─── Draw ───

    draw(ts) {
        const ctx = this.ctx;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.shakeX || this.shakeY) ctx.translate(this.S(this.shakeX), this.S(this.shakeY));

        this._drawBG();
        this._drawRings();
        this._drawBlocks(ts);
        this._drawPaddle(ts);
        this._drawBalls(ts);
        this._drawParts();
        this._drawPops();

        if (this.flashA > 0) {
            ctx.globalAlpha = this.flashA; ctx.fillStyle = this.flashC;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); ctx.globalAlpha = 1;
        }

        // Vignette — skip on mobile for performance
        if (!this.isMobile) {
            const vg = ctx.createRadialGradient(this.X(this.W/2), this.X(this.H/2), this.S(this.H*0.25), this.X(this.W/2), this.X(this.H/2), this.S(this.H*0.82));
            vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(0,0,5,0.5)');
            ctx.fillStyle = vg; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        ctx.restore();

        this._drawHUD(ts);
        this._drawFSBtn(ts);

        if (this.state === this.STATE.WAIT && this.level === 1 && this.balls[0]?.attached) this._drawWait(ts);
        if (this.state === this.STATE.DEAD) this._drawDeath(ts);
    }

    _drawBG() {
        const ctx = this.ctx;
        // Simplified BG on mobile
        if (this.isMobile) {
            ctx.fillStyle = '#080820';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            const g = ctx.createRadialGradient(this.X(this.W/2), this.X(this.H/2), 0, this.X(this.W/2), this.X(this.H/2), this.S(this.H));
            g.addColorStop(0, '#0a0820'); g.addColorStop(0.6, '#060515'); g.addColorStop(1, '#030210');
            ctx.fillStyle = g; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.stars.forEach(s => {
            ctx.globalAlpha = 0.1 + ((Math.sin(s.ph) + 1) / 2) * 0.45;
            ctx.fillStyle = '#dde8ff';
            this._circle(s.x, s.y, s.r); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    _drawBlocks(ts) {
        const ctx = this.ctx;
        this.blocks.forEach(bl => {
            if (bl.dead && bl.hitAnim <= 0) return;
            const bc = this.BCOLORS[bl.ci];
            const sc = bl.scale * (bl.dead ? bl.hitAnim : 1);
            const cx = bl.x + bl.w / 2, cy = bl.y + bl.h / 2;

            ctx.save();
            ctx.translate(this.X(cx), this.X(cy));

            const hitSc = bl.hitAnim > 0.5 ? 1 + (bl.hitAnim - 0.5) * 0.15 : 1;
            ctx.scale(sc * hitSc, sc * hitSc);

            if (bl.dead) { ctx.globalAlpha = bl.hitAnim; }

            const bg = ctx.createLinearGradient(this.S(-bl.w/2), this.S(-bl.h/2), this.S(bl.w/2), this.S(bl.h/2));
            bg.addColorStop(0, bl.hitAnim > 0.5 ? '#fff' : bc.lt);
            bg.addColorStop(0.5, bc.fill);
            bg.addColorStop(1, bc.dk);
            ctx.fillStyle = bg;
            ctx.beginPath();
            const dw = this.S(bl.w), dh = this.S(bl.h), dr = this.S(4);
            ctx.roundRect(this.S(-bl.w/2), this.S(-bl.h/2), dw, dh, dr);
            ctx.fill();

            ctx.strokeStyle = `rgba(255,255,255,${bl.hitAnim > 0 ? 0.5 : 0.12})`;
            ctx.lineWidth = this.S(0.8);
            ctx.stroke();

            if (bl.hp > 1 && !bl.dead) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${this.X(Math.min(bl.h * 0.55, 11))}px ${this.FT}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(String(bl.hp), 0, this.S(1));
            }

            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(this.S(-bl.w/2 + 2), this.S(-bl.h/2 + 1.5), this.S(bl.w * 0.5), this.S(2.5));

            ctx.restore();
        });
    }

    _drawPaddle(ts) {
        const ctx = this.ctx;
        const p = this.paddle;

        p.trail.forEach((t, i) => {
            const ratio = i / p.trail.length;
            ctx.globalAlpha = ratio * 0.15;
            ctx.fillStyle = '#00D4FF';
            this._rrect(t.x - p.w * ratio * 0.4, p.y - p.h / 2, p.w * ratio * 0.8, p.h, 6);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        const pg = ctx.createLinearGradient(this.X(p.x - p.w/2), 0, this.X(p.x + p.w/2), 0);
        pg.addColorStop(0, '#00D4FF'); pg.addColorStop(0.5, '#0088FF'); pg.addColorStop(1, '#00D4FF');
        ctx.fillStyle = pg;
        this._rrect(p.x - p.w/2, p.y - p.h/2, p.w, p.h, 7);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = this.S(1);
        this._rrect(p.x - p.w/2, p.y - p.h/2, p.w, p.h, 7);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(this.X(p.x - p.w/2 + 4), this.X(p.y - p.h/2 + 2), this.S(p.w * 0.4), this.S(3));

        for (let i = 0; i < this.lives; i++) {
            ctx.fillStyle = i === 0 ? '#FF006E' : '#FF006E88';
            this._circle(p.x - 14 + i * 14, p.y + p.h / 2 + 10, 4);
            ctx.fill();
        }
    }

    _drawBalls(ts) {
        const ctx = this.ctx;
        this.balls.forEach(b => {
            b.trail.forEach((t, i) => {
                const ratio = i / b.trail.length;
                ctx.globalAlpha = ratio * 0.3;
                ctx.fillStyle = '#00D4FF';
                this._circle(t.x, t.y, b.r * ratio * 0.7);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            const bg = ctx.createRadialGradient(this.X(b.x - b.r * 0.3), this.X(b.y - b.r * 0.3), 0, this.X(b.x), this.X(b.y), this.S(b.r));
            bg.addColorStop(0, '#fff'); bg.addColorStop(0.4, '#eef8ff'); bg.addColorStop(1, '#00D4FF');
            ctx.fillStyle = bg;
            this._circle(b.x, b.y, b.r); ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = this.S(1);
            this._circle(b.x, b.y, b.r); ctx.stroke();
        });
    }

    _drawRings() { this.rings.forEach(r => { this.ctx.save(); this.ctx.globalAlpha = r.a; this.ctx.strokeStyle = r.col; this.ctx.lineWidth = this.S(2 * r.a); this._circle(r.x, r.y, r.r); this.ctx.stroke(); this.ctx.restore(); }); }
    _drawParts() { this.parts.forEach(p => { this.ctx.save(); this.ctx.globalAlpha = Math.max(0, p.life); this.ctx.fillStyle = p.col; this._circle(p.x, p.y, Math.max(0.3, p.r * p.life)); this.ctx.fill(); this.ctx.restore(); }); }
    _drawPops() { this.pops.forEach(p => { this._txt(p.text, p.x, p.y, { sz: 12, wt: 'bold', col: p.col, al: 'center', op: p.op, stroke: true, sc: 'rgba(0,0,0,0.5)', sw: 2.5, ff: this.FT }); }); }

    _drawHUD(ts) {
        const ctx = this.ctx, W = this.W;
        const hg = ctx.createLinearGradient(0, 0, 0, this.X(48));
        hg.addColorStop(0, 'rgba(0,0,0,0.78)'); hg.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, this.canvas.width, this.X(48));

        this._txt(this.score.toLocaleString(), W / 2, 22, { sz: 18, wt: 'bold', col: '#fff', al: 'center', ff: this.FT });
        if (this.bestScore > 0) this._txt(`BEST  ${this.bestScore.toLocaleString()}`, W / 2, 38, { sz: 8, col: 'rgba(255,215,0,0.45)', al: 'center', ff: this.FU });

        ctx.fillStyle = 'rgba(0,212,255,0.2)'; ctx.strokeStyle = 'rgba(0,212,255,0.45)'; ctx.lineWidth = this.S(1);
        this._rrect(8, 8, 52, 22, 6); ctx.fill(); ctx.stroke();
        this._txt(`LVL ${this.level}`, 34, 20, { sz: 11, wt: 'bold', col: '#00D4FF', al: 'center', ff: this.FT });

        this._txt(`❤️ ${this.lives}`, W - 12, 20, { sz: 11, wt: 'bold', col: '#FF006E', al: 'right', ff: this.FT });

        if (this.combo > 1) {
            this._txt(`×${this.combo} COMBO`, W / 2, this.H - 65, {
                sz: 13, wt: 'bold', col: '#FFD700', al: 'center',
                op: Math.min(1, 0.5 + Math.sin(ts / 200) * 0.5),
                stroke: true, sc: 'rgba(0,0,0,0.5)', sw: 2, ff: this.FT
            });
        }
    }

    _drawFSBtn(ts) {
        const ctx = this.ctx, bw = 44, bh = 44, mg = 10;
        const bx = this.W - bw - mg, by = this.H - bh - mg;
        this.fsRect = { x: bx, y: by, w: bw, h: bh };
        const pulse = 0.45 + Math.sin(ts / 1400) * 0.18;
        ctx.save(); ctx.globalAlpha = pulse;
        ctx.fillStyle = 'rgba(0,0,10,0.55)'; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = this.S(1.2);
        this._rrect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
        const cx = bx + bw / 2, cy = by + bh / 2, ic = 7;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = this.S(1.8); ctx.lineCap = 'round';
        [[-ic, -(ic-3), -ic, -ic, -(ic-3), -ic], [ic-3, -ic, ic, -ic, ic, -(ic-3)],
         [-ic, ic-3, -ic, ic, -(ic-3), ic], [ic-3, ic, ic, ic, ic, ic-3]
        ].forEach(([x1,y1,x2,y2,x3,y3]) => {
            ctx.beginPath();
            ctx.moveTo(this.X(cx+x1), this.X(cy+y1));
            ctx.lineTo(this.X(cx+x2), this.X(cy+y2));
            ctx.lineTo(this.X(cx+x3), this.X(cy+y3));
            ctx.stroke();
        });
        ctx.restore();
    }

    _drawWait(ts) {
        const cx = this.W / 2, cy = this.H / 2, cw = Math.min(this.W - 40, 280), ch = 105;
        this.ctx.fillStyle = 'rgba(4,2,16,0.86)';
        this._rrect(cx - cw/2, cy - ch/2, cw, ch, 16); this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0,212,255,0.35)'; this.ctx.lineWidth = this.S(1.5);
        this._rrect(cx - cw/2, cy - ch/2, cw, ch, 16); this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(0,212,255,0.1)';
        this.ctx.fillRect(this.X(cx - cw/2), this.X(cy - ch/2), this.X(cw), this.S(3));

        this._txt('BLOCK VS BALL', cx, cy - 20, { sz: 20, wt: 'bold', col: '#00D4FF', al: 'center', ff: this.FT });
        this.ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this.ctx.fillRect(this.X(cx - cw * .36), this.X(cy - 3), this.X(cw * .72), this.S(1));
        this._txt('Move paddle to control', cx, cy + 14, { sz: 11, col: 'rgba(180,200,220,0.6)', al: 'center', ff: this.FU });
        const bob = Math.sin(this.time / 440) * 4;
        this._txt('Tap to launch ball', cx, cy + ch / 2 - 10 + bob, {
            sz: 10, col: `rgba(0,212,255,${0.4 + Math.sin(this.time / 440) * 0.4})`, al: 'center', ff: this.FU
        });
    }

    _drawDeath(ts) {
        const ctx = this.ctx, cx = this.W / 2, cy = this.H / 2, a = this.deathA;
        ctx.fillStyle = `rgba(0,0,0,${a * 0.76})`; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (a < 0.5) return;
        const pa = Math.min(1, (a - 0.5) / 0.5);
        const pw = Math.min(this.W - 32, 290), ph = 260, px = cx - pw / 2, py = cy - ph / 2;

        ctx.save(); ctx.globalAlpha = pa;
        ctx.fillStyle = 'rgba(6,2,18,0.97)';
        this._rrect(px, py, pw, ph, 20); ctx.fill();
        ctx.strokeStyle = 'rgba(0,180,255,0.45)'; ctx.lineWidth = this.S(1.5);
        this._rrect(px, py, pw, ph, 20); ctx.stroke();
        ctx.fillStyle = 'rgba(0,180,255,0.1)'; ctx.fillRect(this.X(px), this.X(py), this.X(pw), this.S(3));
        ctx.globalAlpha = 1;

        this._txt('GAME OVER', cx, py + 44, { sz: 22, wt: 'bold', col: '#FF006E', al: 'center', op: pa, ff: this.FT });

        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`;
        ctx.fillRect(this.X(px + 22), this.X(py + 62), this.X(pw - 44), this.S(1));

        const rows = [
            { l: 'SCORE', v: this.score.toLocaleString(), c: this.score >= this.bestScore ? '#00fff5' : '#fff' },
            { l: 'BEST', v: this.bestScore.toLocaleString(), c: this.score >= this.bestScore ? '#FFD700' : '#aaa' },
            { l: 'LEVEL', v: String(this.level), c: '#00D4FF' },
            { l: 'MAX COMBO', v: `×${this.maxCombo}`, c: '#FFD700' },
            { l: 'LIVES', v: '0', c: '#FF006E' }
        ];
        rows.forEach((r, i) => {
            const ry = py + 82 + i * 28;
            this._txt(r.l, px + 22, ry, { sz: 10, wt: '600', col: `rgba(140,160,180,${pa})`, ff: this.FU });
            this._txt(r.v, px + pw - 22, ry, { sz: i === 0 ? 16 : 13, wt: 'bold', col: r.c, al: 'right', op: pa, ff: this.FT });
        });

        if (this.score > 0 && this.score >= this.bestScore) {
            ctx.fillStyle = 'rgba(255,215,0,0.1)'; ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = this.S(1);
            this._rrect(cx - 52, py + 70, 104, 18, 6); ctx.fill(); ctx.stroke();
            this._txt('✦ NEW BEST ✦', cx, py + 81, { sz: 9, wt: 'bold', col: '#FFD700', al: 'center', bl: 'middle', op: pa, ff: this.FT });
        }

        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`;
        ctx.fillRect(this.X(px + 22), this.X(py + ph - 48), this.X(pw - 44), this.S(1));

        const blink = 0.38 + Math.sin(this.time / 380) * 0.45;
        this._txt('● TAP TO PLAY AGAIN ●', cx, py + ph - 18, { sz: 11, col: 'rgba(150,220,255,0.85)', al: 'center', op: blink * pa, ff: this.FU });
        ctx.restore();
    }

    // ─── Loop ───

    _loop(ts) {
        if (this.destroyed) return;
        const dt = Math.min(ts - (this.lastTime || ts), 50);
        this.lastTime = ts;
        this.update(ts, dt);
        this.draw(ts);
        this.animId = requestAnimationFrame(t => this._loop(t));
    }

    togglePause() {
        this.paused = this.isPaused = !this.paused;
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
            this._setupHD();
        }
        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.paddle.y = this.H - 42;
        this.paddle.w = Math.min(this.W * 0.28, 120);
        this.COLS = Math.min(8, Math.floor((this.W - 20) / 48));
        this.stars = this._mkStars(this.isMobile ? 20 : 45);
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('mousemove', this._onMM);
        this.canvas.removeEventListener('touchstart', this._onTS);
        this.canvas.removeEventListener('touchmove', this._onTM);
        this.canvas.removeEventListener('click', this._onClick);
    }
}