/* ============================================================
   JEWEL LEGEND v2.0 — PREMIUM MATCH-3 GAME
   Candy Crush Style | HD Quality | Zero Blur
   Proper Match-3 Logic | Cascade Combos | Mobile-First
   ============================================================ */

'use strict';

class JewelLegend {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.onScore = onScore;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;

        // HD
        this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        this._setupHD();
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile = ('ontouchstart' in window) || window.innerWidth < 768;

        this.FT = '"Orbitron","Segoe UI",monospace';
        this.FU = '"Rajdhani",-apple-system,sans-serif';

        // States
        this.PHASE = {
            WAIT: 0, IDLE: 1, SWAP: 2, SWAP_BACK: 3,
            MATCH: 4, FALL: 5, DEAD: 6
        };
        this.phase = this.PHASE.WAIT;

        // Score
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('jewel_best2') || '0');
        this.moves = 25;
        this.maxMoves = 25;
        this.level = 1;
        this.target = 800;
        this.combo = 0;
        this.totalMatched = 0;

        // Grid
        this.COLS = 7;
        this.ROWS = 8;
        this.CELL = 0;
        this.gx = 0;
        this.gy = 0;
        this._calcGrid();

        // 6 gem types
        this.GEMS = [
            { col: '#FF2D6F', lt: '#FF88BB', dk: '#CC0044', shape: 'diamond' },
            { col: '#00D4FF', lt: '#88EEFF', dk: '#0088CC', shape: 'circle' },
            { col: '#00FF88', lt: '#88FFCC', dk: '#00AA55', shape: 'hexagon' },
            { col: '#FFD700', lt: '#FFEE88', dk: '#CC9900', shape: 'star' },
            { col: '#B94FE3', lt: '#DD99FF', dk: '#7722AA', shape: 'triangle' },
            { col: '#FF8C00', lt: '#FFBB66', dk: '#CC6600', shape: 'square' }
        ];

        // Board: 2D array of gem ids (-1 = empty)
        this.board = [];
        this.gemObjs = []; // visual objects for animation

        // Selection
        this.sel = null; // {r,c}
        this.swapFrom = null;
        this.swapTo = null;
        this.swapProgress = 0;
        this.swapDuration = 200;
        this.swapStart = 0;

        // Matching
        this.matchedCells = [];
        this.matchTimer = 0;
        this.matchDuration = 280;

        // Falling
        this.fallTimer = 0;
        this.fallDuration = 250;
        this.fallData = []; // [{col, fromRow, toRow, id}]

        // FX
        this.parts = [];
        this.pops = [];
        this.rings = [];
        this.banners = [];
        this.MAX_PARTS = this.isMobile ? 60 : 120;

        this.shakeX = 0; this.shakeY = 0; this.shakeT = 0;
        this.flashA = 0; this.flashC = '#fff';
        this.deathA = 0;
        this.time = 0;

        // Hint
        this.hintTimer = 0;
        this.hintCell = null;

        // BG
        this.stars = this._mkStars(this.isMobile ? 25 : 45);

        // FS button
        this.fsRect = { x: 0, y: 0, w: 46, h: 46 };

        // Touch
        this.touchStart = null;

        this._initBoard();
        this._bind();
        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this._loop(t));
    }

    // ═══════════ HD SETUP ═══════════

    _setupHD() {
        const r = this.canvas.getBoundingClientRect();
        const w = r.width || this.canvas.clientWidth || 400;
        const h = r.height || this.canvas.clientHeight || 700;
        this.canvas.width = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    _calcGrid() {
        const HUD_T = 65, HUD_B = 55;
        const avail = this.H - HUD_T - HUD_B;
        this.CELL = Math.floor(Math.min(avail / this.ROWS, (this.W - 16) / this.COLS));
        this.gx = Math.round((this.W - this.COLS * this.CELL) / 2);
        this.gy = HUD_T + Math.round((avail - this.ROWS * this.CELL) / 2);
    }

    S(v) { return v * this.dpr; }
    X(v) { return Math.round(v * this.dpr); }

    // ═══════════ TEXT ═══════════

    _txt(text, x, y, o = {}) {
        const ctx = this.ctx;
        const { sz = 14, wt = 'bold', col = '#fff', al = 'left', bl = 'alphabetic', ff = null, op = 1, stroke = false, sc = 'rgba(0,0,0,0.6)', sw = 3 } = o;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.textAlign = al;
        ctx.textBaseline = bl;
        ctx.font = `${wt} ${Math.round(sz * this.dpr)}px ${ff || (sz > 14 ? this.FT : this.FU)}`;
        if (stroke) {
            ctx.strokeStyle = sc;
            ctx.lineWidth = sw * this.dpr;
            ctx.lineJoin = 'round';
            ctx.strokeText(text, this.X(x), this.X(y));
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = col;
        ctx.fillText(text, this.X(x), this.X(y));
        ctx.restore();
    }

    // ═══════════ SHAPES ═══════════

    _circle(x, y, r) {
        this.ctx.beginPath();
        this.ctx.arc(this.X(x), this.X(y), this.S(r), 0, Math.PI * 2);
    }

    _rrect(x, y, w, h, r) {
        const ctx = this.ctx;
        const dx = this.X(x), dy = this.X(y), dw = this.X(x + w) - dx, dh = this.X(y + h) - dy, dr = this.S(r);
        ctx.beginPath();
        ctx.moveTo(dx + dr, dy);
        ctx.arcTo(dx + dw, dy, dx + dw, dy + dh, dr);
        ctx.arcTo(dx + dw, dy + dh, dx, dy + dh, dr);
        ctx.arcTo(dx, dy + dh, dx, dy, dr);
        ctx.arcTo(dx, dy, dx + dw, dy, dr);
        ctx.closePath();
    }

    _mkStars(n) {
        return Array.from({ length: n }, () => ({
            x: Math.random() * this.W, y: Math.random() * this.H,
            r: Math.random() * 1.3 + 0.3, ph: Math.random() * 6.28,
            sp: Math.random() * 0.01 + 0.003,
            col: Math.random() > 0.7 ? '#B94FE3' : Math.random() > 0.5 ? '#00D4FF' : '#dde8ff'
        }));
    }

    // ═══════════ BOARD INIT ═══════════

    _initBoard() {
        this.board = [];
        this.gemObjs = [];
        for (let r = 0; r < this.ROWS; r++) {
            this.board[r] = [];
            this.gemObjs[r] = [];
            for (let c = 0; c < this.COLS; c++) {
                let id;
                do { id = Math.floor(Math.random() * this.GEMS.length); }
                while (this._matchAt(r, c, id));
                this.board[r][c] = id;
                this.gemObjs[r][c] = {
                    x: this._cx(c), y: this._cy(r),
                    targetY: this._cy(r),
                    scale: 1, alpha: 1,
                    pulse: Math.random() * 6.28,
                    removing: false
                };
            }
        }
        // No initial match should exist, but ensure moves exist
        if (!this._hasValidMove()) this._shuffleBoard();
        this._findHint();
    }

    _matchAt(r, c, id) {
        // Check left 2
        if (c >= 2 && this.board[r][c - 1] === id && this.board[r][c - 2] === id) return true;
        // Check up 2
        if (r >= 2 && this.board[r - 1]?.[c] === id && this.board[r - 2]?.[c] === id) return true;
        return false;
    }

    _cx(c) { return this.gx + c * this.CELL + this.CELL / 2; }
    _cy(r) { return this.gy + r * this.CELL + this.CELL / 2; }

    // ═══════════ MATCH DETECTION ═══════════

    _findAllMatches() {
        const matched = new Set();
        const R = this.ROWS, C = this.COLS, b = this.board;

        // Horizontal runs
        for (let r = 0; r < R; r++) {
            let c = 0;
            while (c < C) {
                const id = b[r][c];
                if (id < 0) { c++; continue; }
                let len = 1;
                while (c + len < C && b[r][c + len] === id) len++;
                if (len >= 3) {
                    for (let k = 0; k < len; k++) matched.add(r * C + c + k);
                }
                c += len;
            }
        }

        // Vertical runs
        for (let c = 0; c < C; c++) {
            let r = 0;
            while (r < R) {
                const id = b[r][c];
                if (id < 0) { r++; continue; }
                let len = 1;
                while (r + len < R && b[r + len][c] === id) len++;
                if (len >= 3) {
                    for (let k = 0; k < len; k++) matched.add((r + k) * C + c);
                }
                r += len;
            }
        }
        return [...matched].map(idx => ({ r: Math.floor(idx / C), c: idx % C }));
    }

    _hasValidMove() {
        const R = this.ROWS, C = this.COLS, b = this.board;
        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                // Try swap right
                if (c + 1 < C) {
                    this._rawSwap(r, c, r, c + 1);
                    if (this._findAllMatches().length > 0) { this._rawSwap(r, c, r, c + 1); return true; }
                    this._rawSwap(r, c, r, c + 1);
                }
                // Try swap down
                if (r + 1 < R) {
                    this._rawSwap(r, c, r + 1, c);
                    if (this._findAllMatches().length > 0) { this._rawSwap(r, c, r + 1, c); return true; }
                    this._rawSwap(r, c, r + 1, c);
                }
            }
        }
        return false;
    }

    _rawSwap(r1, c1, r2, c2) {
        const t = this.board[r1][c1];
        this.board[r1][c1] = this.board[r2][c2];
        this.board[r2][c2] = t;
    }

    _shuffleBoard() {
        let attempts = 0;
        do {
            for (let r = 0; r < this.ROWS; r++)
                for (let c = 0; c < this.COLS; c++)
                    this.board[r][c] = Math.floor(Math.random() * this.GEMS.length);
            // Remove initial matches
            let m = this._findAllMatches();
            while (m.length > 0) {
                m.forEach(({ r, c }) => { this.board[r][c] = Math.floor(Math.random() * this.GEMS.length); });
                m = this._findAllMatches();
            }
            attempts++;
        } while (!this._hasValidMove() && attempts < 50);
        this._syncGemObjs();
    }

    _syncGemObjs() {
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.gemObjs[r]) this.gemObjs[r] = [];
                this.gemObjs[r][c] = {
                    x: this._cx(c), y: this._cy(r),
                    targetY: this._cy(r),
                    scale: 1, alpha: 1,
                    pulse: Math.random() * 6.28,
                    removing: false
                };
            }
        }
    }

    _findHint() {
        this.hintCell = null;
        this.hintTimer = 0;
        const R = this.ROWS, C = this.COLS;
        for (let r = 0; r < R && !this.hintCell; r++) {
            for (let c = 0; c < C && !this.hintCell; c++) {
                if (c + 1 < C) {
                    this._rawSwap(r, c, r, c + 1);
                    if (this._findAllMatches().length > 0) this.hintCell = { r, c };
                    this._rawSwap(r, c, r, c + 1);
                }
                if (!this.hintCell && r + 1 < R) {
                    this._rawSwap(r, c, r + 1, c);
                    if (this._findAllMatches().length > 0) this.hintCell = { r, c };
                    this._rawSwap(r, c, r + 1, c);
                }
            }
        }
    }

    // ═══════════ EVENTS ═══════════

    _bind() {
        this._onTS = e => {
            e.preventDefault();
            const p = this._tpos(e.touches[0]);
            const b = this.fsRect;
            if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this._toggleFS(); return; }
            if (this.phase === this.PHASE.WAIT) { this.phase = this.PHASE.IDLE; return; }
            if (this.phase === this.PHASE.DEAD && this.deathA > 0.8) { this._restart(); return; }
            if (this.phase === this.PHASE.IDLE) {
                this.touchStart = p;
                this._handleTap(p.x, p.y);
            }
        };
        this._onTM = e => {
            e.preventDefault();
            if (!this.touchStart || this.phase !== this.PHASE.IDLE || !this.sel) return;
            const p = this._tpos(e.touches[0]);
            const dx = p.x - this.touchStart.x;
            const dy = p.y - this.touchStart.y;
            if (Math.abs(dx) > 22 || Math.abs(dy) > 22) {
                this._handleSwipe(dx, dy);
                this.touchStart = null;
            }
        };
        this._onTE = e => { e.preventDefault(); this.touchStart = null; };
        this._onCk = e => {
            if (this.phase === this.PHASE.WAIT) { this.phase = this.PHASE.IDLE; return; }
            if (this.phase === this.PHASE.DEAD && this.deathA > 0.8) { this._restart(); return; }
            const p = this._mpos(e);
            if (this.phase === this.PHASE.IDLE) this._handleTap(p.x, p.y);
        };

        this.canvas.addEventListener('touchstart', this._onTS, { passive: false });
        this.canvas.addEventListener('touchmove', this._onTM, { passive: false });
        this.canvas.addEventListener('touchend', this._onTE, { passive: false });
        this.canvas.addEventListener('click', this._onCk);
    }

    _tpos(t) { const r = this.canvas.getBoundingClientRect(); return { x: (t.clientX - r.left) * (this.W / r.width), y: (t.clientY - r.top) * (this.H / r.height) }; }
    _mpos(e) { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (this.W / r.width), y: (e.clientY - r.top) * (this.H / r.height) }; }

    _handleTap(tx, ty) {
        const c = Math.floor((tx - this.gx) / this.CELL);
        const r = Math.floor((ty - this.gy) / this.CELL);
        if (r < 0 || r >= this.ROWS || c < 0 || c >= this.COLS) { this.sel = null; return; }

        if (!this.sel) {
            this.sel = { r, c };
            this.hintTimer = 0;
            if (window.audioManager) audioManager.play('click');
        } else {
            const dr = Math.abs(r - this.sel.r), dc = Math.abs(c - this.sel.c);
            if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
                this._startSwap(this.sel.r, this.sel.c, r, c);
            } else {
                this.sel = { r, c };
            }
        }
    }

    _handleSwipe(dx, dy) {
        if (!this.sel) return;
        let nr = this.sel.r, nc = this.sel.c;
        if (Math.abs(dx) > Math.abs(dy)) nc += dx > 0 ? 1 : -1;
        else nr += dy > 0 ? 1 : -1;
        if (nr >= 0 && nr < this.ROWS && nc >= 0 && nc < this.COLS) {
            this._startSwap(this.sel.r, this.sel.c, nr, nc);
        }
    }

    _toggleFS() {
        const el = this.canvas.parentElement || this.canvas;
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (!isFS) { (el.requestFullscreen || el.webkitRequestFullscreen || function () {}).call(el); }
        else { (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document); }
        setTimeout(() => this.resize(), 200);
    }

    // ═══════════ SWAP LOGIC ═══════════

    _startSwap(r1, c1, r2, c2) {
        this.swapFrom = { r: r1, c: c1 };
        this.swapTo = { r: r2, c: c2 };
        this.swapProgress = 0;
        this.swapStart = performance.now();

        // Check if valid
        this._rawSwap(r1, c1, r2, c2);
        const matches = this._findAllMatches();
        this._rawSwap(r1, c1, r2, c2);

        if (matches.length > 0) {
            this.phase = this.PHASE.SWAP;
            this.moves--;
            if (window.audioManager) audioManager.play('click');
        } else {
            this.phase = this.PHASE.SWAP_BACK;
            if (window.audioManager) audioManager.play('fail');
        }
        this.sel = null;
    }

    // ═══════════ UPDATE ═══════════

    update(ts, dt) {
        if (this.paused) return;
        this.time += dt;
        this.stars.forEach(s => s.ph += s.sp);

        // Shake
        if (this.shakeT > 0) {
            this.shakeX = (Math.random() - .5) * 6 * (this.shakeT / 16);
            this.shakeY = (Math.random() - .5) * 3 * (this.shakeT / 16);
            this.shakeT--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - 0.04);

        // Gem pulse
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.gemObjs[r]?.[c]) this.gemObjs[r][c].pulse += 0.045;

        // FX
        this.parts = this.parts.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.96; p.life -= p.dec; p.r *= 0.96; return p.life > 0 && p.r > 0.3; });
        this.rings = this.rings.filter(r => { r.r += 2.8; r.a -= 0.035; return r.a > 0; });
        this.pops = this.pops.filter(p => { p.y -= 1.1; p.life -= dt; p.op = Math.min(1, p.life / 500); return p.life > 0; });
        this.banners = this.banners.filter(b => { b.y -= 0.4; b.life--; b.op = Math.min(1, b.life / 30); return b.life > 0; });

        if (this.phase === this.PHASE.DEAD) { this.deathA = Math.min(1, this.deathA + 0.015); return; }
        if (this.phase === this.PHASE.WAIT) return;

        // Hint timer
        if (this.phase === this.PHASE.IDLE) {
            this.hintTimer += dt;
        }

        // SWAP animation
        if (this.phase === this.PHASE.SWAP || this.phase === this.PHASE.SWAP_BACK) {
            this.swapProgress = Math.min(1, (performance.now() - this.swapStart) / this.swapDuration);
            const f = this.swapFrom, t = this.swapTo;
            const ease = this._easeInOut(this.swapProgress);

            const g1 = this.gemObjs[f.r][f.c];
            const g2 = this.gemObjs[t.r][t.c];
            const x1 = this._cx(f.c), y1 = this._cy(f.r);
            const x2 = this._cx(t.c), y2 = this._cy(t.r);

            if (this.phase === this.PHASE.SWAP) {
                g1.x = x1 + (x2 - x1) * ease; g1.y = y1 + (y2 - y1) * ease;
                g2.x = x2 + (x1 - x2) * ease; g2.y = y2 + (y1 - y2) * ease;
            } else {
                // Swap back: first half go, second half return
                const half = this.swapProgress < 0.5 ? this.swapProgress * 2 : 2 - this.swapProgress * 2;
                const e2 = this._easeInOut(half) * 0.4;
                g1.x = x1 + (x2 - x1) * e2; g1.y = y1 + (y2 - y1) * e2;
                g2.x = x2 + (x1 - x2) * e2; g2.y = y2 + (y1 - y2) * e2;
            }

            if (this.swapProgress >= 1) {
                if (this.phase === this.PHASE.SWAP) {
                    // Commit swap
                    this._rawSwap(f.r, f.c, t.r, t.c);
                    const tObj = this.gemObjs[f.r][f.c];
                    this.gemObjs[f.r][f.c] = this.gemObjs[t.r][t.c];
                    this.gemObjs[t.r][t.c] = tObj;
                    // Reset positions
                    this.gemObjs[f.r][f.c].x = this._cx(f.c);
                    this.gemObjs[f.r][f.c].y = this._cy(f.r);
                    this.gemObjs[t.r][t.c].x = this._cx(t.c);
                    this.gemObjs[t.r][t.c].y = this._cy(t.r);
                    this.combo = 0;
                    this._startMatch();
                } else {
                    // Reset positions
                    this.gemObjs[f.r][f.c].x = this._cx(f.c);
                    this.gemObjs[f.r][f.c].y = this._cy(f.r);
                    this.gemObjs[t.r][t.c].x = this._cx(t.c);
                    this.gemObjs[t.r][t.c].y = this._cy(t.r);
                    this.phase = this.PHASE.IDLE;
                }
            }
        }

        // MATCH animation (gems shrink and disappear)
        if (this.phase === this.PHASE.MATCH) {
            this.matchTimer += dt;
            const prog = Math.min(1, this.matchTimer / this.matchDuration);

            this.matchedCells.forEach(({ r, c }) => {
                const g = this.gemObjs[r]?.[c];
                if (g) {
                    g.scale = 1 - prog;
                    g.alpha = 1 - prog;
                }
            });

            if (prog >= 1) {
                // Remove matched gems
                this.matchedCells.forEach(({ r, c }) => {
                    this.board[r][c] = -1;
                });
                this._startFall();
            }
        }

        // FALL animation
        if (this.phase === this.PHASE.FALL) {
            this.fallTimer += dt;
            const prog = Math.min(1, this.fallTimer / this.fallDuration);
            const ease = this._easeOutBounce(prog);

            this.fallData.forEach(fd => {
                const g = this.gemObjs[fd.toRow]?.[fd.col];
                if (g) {
                    g.y = fd.startY + (fd.endY - fd.startY) * ease;
                }
            });

            if (prog >= 1) {
                // Settle positions
                this.fallData.forEach(fd => {
                    const g = this.gemObjs[fd.toRow]?.[fd.col];
                    if (g) g.y = fd.endY;
                });

                // Check for new matches
                const newM = this._findAllMatches();
                if (newM.length > 0) {
                    this._startMatch();
                } else {
                    // Turn done
                    this.combo = 0;
                    if (!this._hasValidMove()) {
                        this._shuffleBoard();
                        this.banners.push({ x: this.W / 2, y: this.H / 2, text: '🔄 SHUFFLE!', col: '#FFD700', sz: 18, life: 80, op: 1 });
                    }
                    this._findHint();
                    if (this.moves <= 0) {
                        this._gameOver();
                    } else {
                        this.phase = this.PHASE.IDLE;
                    }
                }
            }
        }
    }

    _startMatch() {
        const matches = this._findAllMatches();
        if (matches.length === 0) { this.phase = this.PHASE.IDLE; return; }

        this.matchedCells = matches;
        this.matchTimer = 0;
        this.phase = this.PHASE.MATCH;
        this.combo++;

        // Score
        const pts = matches.length * 50 * this.combo;
        this.score += pts;
        this.totalMatched += matches.length;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('jewel_best2', this.bestScore);
        }
        this.onScore(this.score);

        // FX
        matches.forEach(({ r, c }) => {
            const id = this.board[r][c];
            if (id >= 0) {
                const cx = this._cx(c), cy = this._cy(r);
                this._burst(cx, cy, this.GEMS[id].col, 8);
                this.rings.push({ x: cx, y: cy, r: this.CELL * 0.4, a: 0.7, col: this.GEMS[id].col });
            }
        });

        // Score popup
        const first = matches[0];
        this.pops.push({
            x: this._cx(first.c), y: this._cy(first.r) - 12,
            text: this.combo > 1 ? `+${pts} ×${this.combo}` : `+${pts}`,
            col: this.combo > 2 ? '#FFD700' : this.GEMS[this.board[first.r][first.c]]?.col || '#fff',
            life: 1200, op: 1
        });

        if (this.combo > 1) {
            this.banners.push({
                x: this.W / 2, y: this.gy - 18,
                text: this.combo >= 4 ? `🔥 ${this.combo}× AMAZING!` : `${this.combo}× COMBO!`,
                col: this.combo >= 4 ? '#FF2D6F' : '#FFD700', sz: this.combo >= 4 ? 20 : 16,
                life: 80, op: 1
            });
        }

        if (this.score >= this.target) this._levelUp();

        this.flashA = 0.05 + this.combo * 0.02;
        this.flashC = this.GEMS[this.board[first.r][first.c]]?.col || '#fff';
        if (this.combo >= 3) { this.shakeT = 8; }

        if (window.audioManager) {
            if (this.combo >= 3) audioManager.play('combo', { level: this.combo });
            else audioManager.play('score');
        }
    }

    _startFall() {
        this.fallData = [];
        this.fallTimer = 0;

        for (let c = 0; c < this.COLS; c++) {
            // Drop existing gems
            let writeRow = this.ROWS - 1;
            for (let r = this.ROWS - 1; r >= 0; r--) {
                if (this.board[r][c] >= 0) {
                    if (r !== writeRow) {
                        this.board[writeRow][c] = this.board[r][c];
                        this.board[r][c] = -1;
                        // Move gem obj
                        this.gemObjs[writeRow][c] = this.gemObjs[r][c];
                        this.gemObjs[r][c] = null;
                        this.fallData.push({
                            col: c, toRow: writeRow,
                            startY: this.gemObjs[writeRow][c].y,
                            endY: this._cy(writeRow)
                        });
                    }
                    writeRow--;
                }
            }

            // Fill empty from top
            for (let r = writeRow; r >= 0; r--) {
                const id = Math.floor(Math.random() * this.GEMS.length);
                this.board[r][c] = id;
                this.gemObjs[r][c] = {
                    x: this._cx(c),
                    y: this.gy - (writeRow - r + 1) * this.CELL,
                    targetY: this._cy(r),
                    scale: 1, alpha: 1,
                    pulse: Math.random() * 6.28,
                    removing: false
                };
                this.fallData.push({
                    col: c, toRow: r,
                    startY: this.gemObjs[r][c].y,
                    endY: this._cy(r)
                });
            }
        }

        this.phase = this.PHASE.FALL;
    }

    _levelUp() {
        this.level++;
        this.target = this.level * 800 + (this.level - 1) * 400;
        this.moves = Math.min(this.maxMoves, this.moves + 8);
        this.banners.push({ x: this.W / 2, y: this.H / 2, text: `⬆ LEVEL ${this.level}`, col: '#00FF88', sz: 22, life: 100, op: 1 });
        this.flashA = 0.2; this.flashC = '#00FF88';
        this.shakeT = 10;
        if (window.audioManager) audioManager.play('levelUp');
    }

    _gameOver() {
        this.phase = this.PHASE.DEAD;
        this.flashA = 0.4; this.flashC = '#FF0044';
        this.shakeT = 14;
        setTimeout(() => this.onScore(this.score, true), 1000);
        if (window.audioManager) audioManager.play('gameOver');
    }

    _restart() {
        this.score = 0; this.onScore(0);
        this.phase = this.PHASE.WAIT;
        this.moves = this.maxMoves; this.level = 1;
        this.target = 800; this.combo = 0;
        this.totalMatched = 0; this.deathA = 0;
        this.flashA = 0; this.sel = null;
        this.parts = []; this.pops = []; this.rings = []; this.banners = [];
        this._initBoard();
    }

    _burst(x, y, col, n) {
        for (let i = 0; i < n && this.parts.length < this.MAX_PARTS; i++) {
            const a = Math.random() * Math.PI * 2, sp = Math.random() * 5 + 2;
            this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 4.5 + 1.5, life: 1, dec: 0.04, col, g: 0.1 });
        }
    }

    _easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    _easeOutBounce(t) {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
        if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
        t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
    }

    // ═══════════ DRAW ═══════════

    draw(ts) {
        const ctx = this.ctx;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.shakeX || this.shakeY) ctx.translate(this.S(this.shakeX), this.S(this.shakeY));

        this._drawBG();
        this._drawGrid(ts);
        this._drawRings();
        this._drawGems(ts);
        this._drawParts();
        this._drawPops();
        this._drawBanners();

        if (this.flashA > 0) {
            ctx.globalAlpha = this.flashA;
            ctx.fillStyle = this.flashC;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.globalAlpha = 1;
        }

        const vg = ctx.createRadialGradient(this.X(this.W / 2), this.X(this.H / 2), this.S(this.H * 0.25), this.X(this.W / 2), this.X(this.H / 2), this.S(this.H * 0.82));
        vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(0,0,5,0.5)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.restore();

        this._drawHUD(ts);
        this._drawFSBtn(ts);

        if (this.phase === this.PHASE.WAIT) this._drawWait(ts);
        if (this.phase === this.PHASE.DEAD) this._drawDeath(ts);
    }

    _drawBG() {
        const ctx = this.ctx;
        const g = ctx.createRadialGradient(this.X(this.W / 2), this.X(this.H / 2), 0, this.X(this.W / 2), this.X(this.H / 2), this.S(this.H));
        g.addColorStop(0, '#120828'); g.addColorStop(0.6, '#080518'); g.addColorStop(1, '#030210');
        ctx.fillStyle = g; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.stars.forEach(s => {
            ctx.globalAlpha = 0.1 + ((Math.sin(s.ph) + 1) / 2) * 0.45;
            ctx.fillStyle = s.col;
            this._circle(s.x, s.y, s.r); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    _drawGrid(ts) {
        const ctx = this.ctx;
        const gw = this.COLS * this.CELL, gh = this.ROWS * this.CELL;

        ctx.fillStyle = 'rgba(5,2,20,0.55)';
        this._rrect(this.gx - 4, this.gy - 4, gw + 8, gh + 8, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(185,79,227,0.28)'; ctx.lineWidth = this.S(1.5);
        this._rrect(this.gx - 4, this.gy - 4, gw + 8, gh + 8, 10); ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = this.S(0.5);
        for (let r = 0; r <= this.ROWS; r++) { ctx.beginPath(); ctx.moveTo(this.X(this.gx), this.X(this.gy + r * this.CELL)); ctx.lineTo(this.X(this.gx + gw), this.X(this.gy + r * this.CELL)); ctx.stroke(); }
        for (let c = 0; c <= this.COLS; c++) { ctx.beginPath(); ctx.moveTo(this.X(this.gx + c * this.CELL), this.X(this.gy)); ctx.lineTo(this.X(this.gx + c * this.CELL), this.X(this.gy + gh)); ctx.stroke(); }

        // Selected
        if (this.sel && this.phase === this.PHASE.IDLE) {
            const { r, c } = this.sel;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = this.S(2);
            this._rrect(this.gx + c * this.CELL + 2, this.gy + r * this.CELL + 2, this.CELL - 4, this.CELL - 4, 6);
            ctx.fill(); ctx.stroke();
        }

        // Hint
        if (this.hintCell && this.hintTimer > 2500 && this.phase === this.PHASE.IDLE) {
            const { r, c } = this.hintCell;
            const pa = 0.35 + Math.sin(ts / 200) * 0.35;
            ctx.fillStyle = `rgba(255,215,0,${pa * 0.18})`;
            ctx.strokeStyle = `rgba(255,215,0,${pa * 0.65})`;
            ctx.lineWidth = this.S(2.5);
            this._rrect(this.gx + c * this.CELL + 2, this.gy + r * this.CELL + 2, this.CELL - 4, this.CELL - 4, 6);
            ctx.fill(); ctx.stroke();
        }
    }

    _drawGems(ts) {
        const ctx = this.ctx;
        const C = this.CELL;

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const id = this.board[r][c];
                if (id < 0) continue;
                const g = this.gemObjs[r]?.[c];
                if (!g) continue;

                const gem = this.GEMS[id];
                const gx = g.x, gy = g.y;
                const sel = this.sel && this.sel.r === r && this.sel.c === c;
                const pulse = 1 + Math.sin(g.pulse) * 0.04;
                const sc = (sel ? 1.12 : 1) * pulse * g.scale;
                const sz = C * 0.36 * sc;

                ctx.save();
                ctx.globalAlpha = g.alpha;
                ctx.translate(this.X(gx), this.X(gy));

                this._drawGemShape(ctx, gem, sz, ts, sel);

                ctx.restore();
            }
        }
    }

    _drawGemShape(ctx, gem, sz, ts, selected) {
        const S = v => this.S(v);

        switch (gem.shape) {
            case 'diamond': {
                const s = sz * 1.1;
                const bg = ctx.createRadialGradient(S(-s * .25), S(-s * .25), 0, 0, 0, S(s));
                bg.addColorStop(0, gem.lt); bg.addColorStop(0.55, gem.col); bg.addColorStop(1, gem.dk);
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.moveTo(0, S(-s)); ctx.lineTo(S(s * .7), 0);
                ctx.lineTo(0, S(s)); ctx.lineTo(S(-s * .7), 0);
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = S(0.8); ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = S(0.5);
                ctx.beginPath(); ctx.moveTo(0, S(-s)); ctx.lineTo(0, S(s)); ctx.moveTo(S(-s * .7), 0); ctx.lineTo(S(s * .7), 0); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath(); ctx.ellipse(S(-s * .2), S(-s * .28), S(s * .2), S(s * .13), -0.5, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'circle': {
                const bg = ctx.createRadialGradient(S(-sz * .28), S(-sz * .3), S(sz * .04), 0, 0, S(sz));
                bg.addColorStop(0, gem.lt); bg.addColorStop(0.5, gem.col); bg.addColorStop(1, gem.dk);
                ctx.fillStyle = bg;
                ctx.beginPath(); ctx.arc(0, 0, S(sz), 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = S(0.8); ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = S(0.5);
                ctx.beginPath(); ctx.arc(0, 0, S(sz * .6), 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.44)';
                ctx.beginPath(); ctx.ellipse(S(-sz * .24), S(-sz * .28), S(sz * .26), S(sz * .17), -0.5, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'hexagon': {
                const bg = ctx.createRadialGradient(S(-sz * .25), S(-sz * .25), 0, 0, 0, S(sz));
                bg.addColorStop(0, gem.lt); bg.addColorStop(0.55, gem.col); bg.addColorStop(1, gem.dk);
                ctx.fillStyle = bg;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 6; i === 0 ? ctx.moveTo(S(sz * Math.cos(a)), S(sz * Math.sin(a))) : ctx.lineTo(S(sz * Math.cos(a)), S(sz * Math.sin(a))); }
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = S(0.8); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.42)';
                ctx.beginPath(); ctx.ellipse(S(-sz * .2), S(-sz * .25), S(sz * .22), S(sz * .14), -0.5, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'star': {
                const bg = ctx.createRadialGradient(S(-sz * .2), S(-sz * .2), 0, 0, 0, S(sz));
                bg.addColorStop(0, gem.lt); bg.addColorStop(0.5, gem.col); bg.addColorStop(1, gem.dk);
                ctx.fillStyle = bg;
                ctx.beginPath();
                for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2; const rr = i % 2 === 0 ? sz : sz * .45; ctx.lineTo(S(rr * Math.cos(a)), S(rr * Math.sin(a))); }
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = S(0.8); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath(); ctx.arc(0, 0, S(sz * .18), 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'triangle': {
                const bg = ctx.createRadialGradient(S(-sz * .15), S(-sz * .2), 0, 0, 0, S(sz));
                bg.addColorStop(0, gem.lt); bg.addColorStop(0.5, gem.col); bg.addColorStop(1, gem.dk);
                ctx.fillStyle = bg;
                ctx.beginPath();
                ctx.moveTo(0, S(-sz)); ctx.lineTo(S(sz * .9), S(sz * .7)); ctx.lineTo(S(-sz * .9), S(sz * .7));
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = S(0.8); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.38)';
                ctx.beginPath(); ctx.ellipse(S(-sz * .12), S(-sz * .2), S(sz * .2), S(sz * .12), -0.3, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'square': {
                const s = sz * 0.85;
                const bg = ctx.createRadialGradient(S(-s * .25), S(-s * .25), 0, 0, 0, S(s * 1.2));
                bg.addColorStop(0, gem.lt); bg.addColorStop(0.5, gem.col); bg.addColorStop(1, gem.dk);
                ctx.fillStyle = bg;
                ctx.beginPath(); ctx.roundRect(S(-s), S(-s), S(s * 2), S(s * 2), S(s * 0.25)); ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = S(0.8); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.fillRect(S(-s + 3), S(-s + 3), S(s * 1.1), S(3));
                break;
            }
        }

        if (selected) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = S(2.2);
            ctx.beginPath(); ctx.arc(0, 0, S(sz + 3), 0, Math.PI * 2); ctx.stroke();
        }
    }

    _drawRings() { this.rings.forEach(r => { this.ctx.save(); this.ctx.globalAlpha = r.a; this.ctx.strokeStyle = r.col; this.ctx.lineWidth = this.S(2 * r.a); this._circle(r.x, r.y, r.r); this.ctx.stroke(); this.ctx.restore(); }); }
    _drawParts() { this.parts.forEach(p => { this.ctx.save(); this.ctx.globalAlpha = Math.max(0, p.life); this.ctx.fillStyle = p.col; this._circle(p.x, p.y, Math.max(0.3, p.r * p.life)); this.ctx.fill(); this.ctx.restore(); }); }
    _drawPops() { this.pops.forEach(p => { this._txt(p.text, p.x, p.y, { sz: 13, wt: 'bold', col: p.col, al: 'center', op: p.op, stroke: true, sc: 'rgba(0,0,0,0.55)', sw: 2.5, ff: this.FT }); }); }
    _drawBanners() { this.banners.forEach(b => { this._txt(b.text, b.x, b.y, { sz: b.sz || 18, wt: 'bold', col: b.col, al: 'center', bl: 'middle', op: b.op, stroke: true, sc: 'rgba(0,0,0,0.5)', sw: 3, ff: this.FT }); }); }

    // ─── HUD ───

    _drawHUD(ts) {
        const ctx = this.ctx, W = this.W;
        const hg = ctx.createLinearGradient(0, 0, 0, this.X(52));
        hg.addColorStop(0, 'rgba(0,0,0,0.78)'); hg.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, this.canvas.width, this.X(52));

        this._txt(this.score.toLocaleString(), W / 2, 22, { sz: 18, wt: 'bold', col: '#fff', al: 'center', ff: this.FT });
        if (this.bestScore > 0) this._txt(`BEST  ${this.bestScore.toLocaleString()}`, W / 2, 38, { sz: 8, col: 'rgba(255,215,0,0.45)', al: 'center', ff: this.FU });

        ctx.fillStyle = 'rgba(185,79,227,0.2)'; ctx.strokeStyle = 'rgba(185,79,227,0.45)'; ctx.lineWidth = this.S(1);
        this._rrect(8, 8, 52, 22, 6); ctx.fill(); ctx.stroke();
        this._txt(`LVL ${this.level}`, 34, 20, { sz: 11, wt: 'bold', col: '#cc80ff', al: 'center', ff: this.FT });

        ctx.fillStyle = 'rgba(0,212,255,0.15)'; ctx.strokeStyle = 'rgba(0,212,255,0.4)'; ctx.lineWidth = this.S(1);
        this._rrect(W - 70, 8, 62, 22, 6); ctx.fill(); ctx.stroke();
        this._txt(`${this.moves}`, W - 52, 20, { sz: 13, wt: 'bold', col: this.moves <= 5 ? '#FF2D6F' : '#00D4FF', al: 'left', ff: this.FT });
        this._txt('LEFT', W - 36, 20, { sz: 7, col: 'rgba(0,212,255,0.6)', al: 'left', ff: this.FU });

        // Progress bar
        const pct = Math.min(1, this.score / this.target);
        const bx = this.gx, by = this.gy - 22, bw = this.COLS * this.CELL, bh = 7;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this._rrect(bx, by, bw, bh, 4); ctx.fill();
        if (pct > 0) {
            const pg = ctx.createLinearGradient(this.X(bx), 0, this.X(bx + bw * pct), 0);
            pg.addColorStop(0, '#B94FE3'); pg.addColorStop(1, '#FF006E');
            ctx.fillStyle = pg;
            this._rrect(bx, by, bw * pct, bh, 4); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = this.S(0.8);
        this._rrect(bx, by, bw, bh, 4); ctx.stroke();

        const bBy = this.gy + this.ROWS * this.CELL + 10;
        this._txt(`TARGET: ${this.target.toLocaleString()}`, W / 2, bBy, { sz: 9, col: 'rgba(255,255,255,0.25)', al: 'center', ff: this.FU });
    }

    // ─── FS Button ───

    _drawFSBtn(ts) {
        const ctx = this.ctx, bw = 46, bh = 46, mg = 12;
        const bx = this.W - bw - mg, by = this.H - bh - mg;
        this.fsRect = { x: bx, y: by, w: bw, h: bh };
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const pulse = 0.45 + Math.sin(ts / 1400) * 0.18;

        ctx.save(); ctx.globalAlpha = pulse;
        ctx.fillStyle = 'rgba(0,0,10,0.55)'; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = this.S(1.2);
        this._rrect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();

        const cx = bx + bw / 2, cy = by + bh / 2, ic = 7.5;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = this.S(2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const corners = !isFS ? [
            [cx - ic + 3, cy - ic, cx - ic, cy - ic, cx - ic, cy - ic + 3],
            [cx + ic - 3, cy - ic, cx + ic, cy - ic, cx + ic, cy - ic + 3],
            [cx - ic + 3, cy + ic, cx - ic, cy + ic, cx - ic, cy + ic - 3],
            [cx + ic - 3, cy + ic, cx + ic, cy + ic, cx + ic, cy + ic - 3]
        ] : [
            [cx - ic + 4, cy - ic, cx - ic + 4, cy - ic + 4, cx - ic, cy - ic + 4],
            [cx + ic - 4, cy - ic, cx + ic - 4, cy - ic + 4, cx + ic, cy - ic + 4],
            [cx - ic + 4, cy + ic, cx - ic + 4, cy + ic - 4, cx - ic, cy + ic - 4],
            [cx + ic - 4, cy + ic, cx + ic - 4, cy + ic - 4, cx + ic, cy + ic - 4]
        ];
        corners.forEach(([x1, y1, x2, y2, x3, y3]) => { ctx.beginPath(); ctx.moveTo(this.X(x1), this.X(y1)); ctx.lineTo(this.X(x2), this.X(y2)); ctx.lineTo(this.X(x3), this.X(y3)); ctx.stroke(); });
        ctx.restore();
    }

    // ─── Waiting ───

    _drawWait(ts) {
        const cx = this.W / 2, cy = this.H / 2, cw = Math.min(this.W - 40, 285), ch = 110;
        this.ctx.fillStyle = 'rgba(4,2,16,0.86)';
        this._rrect(cx - cw / 2, cy - ch / 2, cw, ch, 16); this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255,215,0,0.35)'; this.ctx.lineWidth = this.S(1.5);
        this._rrect(cx - cw / 2, cy - ch / 2, cw, ch, 16); this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(255,215,0,0.1)';
        this.ctx.fillRect(this.X(cx - cw / 2), this.X(cy - ch / 2), this.X(cw), this.S(3));

        this._txt('💎 JEWEL LEGEND', cx, cy - 22, { sz: 20, wt: 'bold', col: '#FFD700', al: 'center', ff: this.FT });
        this.ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this.ctx.fillRect(this.X(cx - cw * .36), this.X(cy - 4), this.X(cw * .72), this.S(1));
        this._txt('Match 3+ same gems to score', cx, cy + 14, { sz: 11, col: 'rgba(200,200,230,0.6)', al: 'center', ff: this.FU });
        const bob = Math.sin(this.time / 440) * 4;
        this._txt('Tap to start', cx, cy + ch / 2 - 10 + bob, { sz: 10, col: `rgba(255,215,0,${0.4 + Math.sin(this.time / 440) * 0.4})`, al: 'center', ff: this.FU });
    }

    // ─── Death ───

    _drawDeath(ts) {
        const ctx = this.ctx, cx = this.W / 2, cy = this.H / 2, a = this.deathA;
        ctx.fillStyle = `rgba(0,0,0,${a * 0.76})`; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (a < 0.5) return;
        const pa = Math.min(1, (a - 0.5) / 0.5);
        const pw = Math.min(this.W - 32, 295), ph = 280, px = cx - pw / 2, py = cy - ph / 2;

        ctx.save(); ctx.globalAlpha = pa;
        ctx.fillStyle = 'rgba(6,2,18,0.97)';
        this._rrect(px, py, pw, ph, 20); ctx.fill();
        ctx.strokeStyle = this.score >= this.target ? 'rgba(0,255,88,0.45)' : 'rgba(255,215,0,0.4)';
        ctx.lineWidth = this.S(1.5);
        this._rrect(px, py, pw, ph, 20); ctx.stroke();
        ctx.fillStyle = this.score >= this.target ? 'rgba(0,255,88,0.1)' : 'rgba(255,215,0,0.1)';
        ctx.fillRect(this.X(px), this.X(py), this.X(pw), this.S(3));
        ctx.globalAlpha = 1;

        this._txt(this.score >= this.target ? '✦ LEVEL CLEAR ✦' : 'NO MOVES LEFT', cx, py + 44, {
            sz: 20, wt: 'bold', col: this.score >= this.target ? '#00FF88' : '#FFD700', al: 'center', op: pa, ff: this.FT
        });

        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`; ctx.fillRect(this.X(px + 22), this.X(py + 62), this.X(pw - 44), this.S(1));

        const rows = [
            { l: 'SCORE', v: this.score.toLocaleString(), c: this.score >= this.bestScore ? '#00fff5' : '#fff' },
            { l: 'BEST', v: this.bestScore.toLocaleString(), c: this.score >= this.bestScore ? '#FFD700' : '#aaa' },
            { l: 'LEVEL', v: String(this.level), c: '#c070ff' },
            { l: 'COMBOS', v: String(this.combo), c: '#FFD700' },
            { l: 'GEMS MATCHED', v: String(this.totalMatched), c: '#00FF88' },
            { l: 'TARGET', v: this.target.toLocaleString(), c: '#FF8C00' }
        ];
        rows.forEach((r, i) => {
            const ry = py + 82 + i * 26;
            this._txt(r.l, px + 22, ry, { sz: 9, wt: '600', col: `rgba(140,140,170,${pa})`, ff: this.FU });
            this._txt(r.v, px + pw - 22, ry, { sz: i === 0 ? 15 : 12, wt: 'bold', col: r.c, al: 'right', op: pa, ff: this.FT });
        });

        if (this.score > 0 && this.score >= this.bestScore) {
            ctx.fillStyle = 'rgba(255,215,0,0.1)'; ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = this.S(1);
            this._rrect(cx - 52, py + 70, 104, 18, 6); ctx.fill(); ctx.stroke();
            this._txt('✦ NEW BEST ✦', cx, py + 81, { sz: 9, wt: 'bold', col: '#FFD700', al: 'center', bl: 'middle', op: pa, ff: this.FT });
        }

        ctx.fillStyle = `rgba(255,255,255,${0.07 * pa})`; ctx.fillRect(this.X(px + 22), this.X(py + ph - 48), this.X(pw - 44), this.S(1));
        const blink = 0.38 + Math.sin(this.time / 380) * 0.45;
        this._txt('● TAP TO PLAY AGAIN ●', cx, py + ph - 18, { sz: 11, col: 'rgba(200,200,230,0.85)', al: 'center', op: blink * pa, ff: this.FU });
        ctx.restore();
    }

    // ═══════════ LOOP ═══════════

    _loop(ts) {
        if (this.destroyed) return;
        const dt = Math.min(ts - (this.lastTime || ts), 50);
        this.lastTime = ts;
        this.update(ts, dt);
        this.draw(ts);
        this.animId = requestAnimationFrame(t => this._loop(t));
    }

    togglePause() { this.paused = this.isPaused = !this.paused; if (!this.paused) this.lastTime = performance.now(); return this.paused; }

    resize() {
        this._setupHD();
        this.W = this.canvas.width / this.dpr; this.H = this.canvas.height / this.dpr;
        this._calcGrid();
        this.stars = this._mkStars(this.isMobile ? 25 : 45);
        this._syncGemObjs();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('touchstart', this._onTS);
        this.canvas.removeEventListener('touchmove', this._onTM);
        this.canvas.removeEventListener('touchend', this._onTE);
        this.canvas.removeEventListener('click', this._onCk);
    }
}