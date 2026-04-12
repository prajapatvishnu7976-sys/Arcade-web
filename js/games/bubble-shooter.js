'use strict';

class BubbleShooter {
    constructor(canvas, onScore, options = {}) {
        this.canvas = canvas;
        this.onScore = onScore;
        this.options = options;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;
        this.gameOver = false;

        // ✅ MOBILE FIX: DPR cap 1.5 on mobile, 2 on desktop
        this.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || ('ontouchstart' in window)
            || (window.innerWidth < 768);
        this.dpr = this.isMobile ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2);

        this.setupHDCanvas();

        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: false
        });

        // ✅ MOBILE FIX: Disable smoothing on mobile for speed
        this.ctx.imageSmoothingEnabled = !this.isMobile;
        if (!this.isMobile) this.ctx.imageSmoothingQuality = 'low';

        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isSmallScreen = this.W < 380;

        this.FONT_UI    = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        this.FONT_TITLE = '"Segoe UI", sans-serif';
        this.FONT_MONO  = '"Segoe UI", Roboto, sans-serif';

        this.cache = { bubbles: new Map(), glows: new Map() };

        this.saveKey    = 'neonarcade_bubbleshooter_v7';
        this.playerData = this.loadPlayerData();

        this.COLS      = this.isSmallScreen ? 8 : 10;
        this.ROWS      = 14;
        this.BUBBLE_R  = this.calculateBubbleRadius();

        this.COLORS = [
            { hex: '#FF1A6D', r:255, g:26,  b:109, name:'Rose',   glow:'rgba(255,26,109,',  light:'#FF4D8A', dark:'#CC1557' },
            { hex: '#00D4FF', r:0,   g:212, b:255, name:'Cyan',   glow:'rgba(0,212,255,',   light:'#4DE1FF', dark:'#00A8CC' },
            { hex: '#00FF88', r:0,   g:255, b:136, name:'Lime',   glow:'rgba(0,255,136,',   light:'#4DFFA3', dark:'#00CC6D' },
            { hex: '#FFD700', r:255, g:215, b:0,   name:'Gold',   glow:'rgba(255,215,0,',   light:'#FFE14D', dark:'#CCAC00' },
            { hex: '#B94FE3', r:185, g:79,  b:227, name:'Violet', glow:'rgba(185,79,227,',  light:'#CD7AEB', dark:'#9440B6' },
            { hex: '#FF8811', r:255, g:136, b:17,  name:'Amber',  glow:'rgba(255,136,17,',  light:'#FFA34D', dark:'#CC6D0E' },
            { hex: '#FF3864', r:255, g:56,  b:100, name:'Cherry', glow:'rgba(255,56,100,',  light:'#FF6B8A', dark:'#CC2D50' },
            { hex: '#18FFAB', r:24,  g:255, b:171, name:'Mint',   glow:'rgba(24,255,171,',  light:'#5CFFBF', dark:'#14CC89' }
        ];
        this.colorsInPlay = [];

        this.cellW   = this.BUBBLE_R * 2;
        this.cellH   = this.BUBBLE_R * 1.73;
        this.offsetX = 0;
        this.offsetY = this.isMobile ? 52 : 58;
        this.recalcGrid();

        this.shooterX        = this.W / 2;
        this.shooterY        = this.H - (this.isMobile ? 58 : 65);
        this.angle           = -Math.PI / 2;
        this.targetAngle     = -Math.PI / 2;
        this.currentBubble   = null;
        this.nextBubble      = null;
        this.projectile      = null;
        // ✅ MOBILE FIX: Reduce speed slightly for smoother arc
        this.projectileSpeed = this.isMobile ? 11 : 14;
        this.canShoot        = true;
        this.shootCooldown   = 0;

        this.swapAnim     = 0;
        this.swapColorIdx = 0;

        this.isFullscreen     = false;

        // ✅ MOBILE FIX: Drastically reduced limits
        this.particles      = [];
        this.fallingBubbles = [];
        this.aimDots        = [];
        this.popRings       = [];
        this.textPopups     = [];
        this.floatingTexts  = [];
        this.ripples        = [];

        this.MAX_PARTICLES = this.isMobile ? 25 : 80;
        this.MAX_FALLING   = this.isMobile ? 8  : 16;
        this.MAX_POP_RINGS = this.isMobile ? 5  : 12;
        this.MAX_POPUPS    = this.isMobile ? 5  : 10;

        this.shakeX = 0; this.shakeY = 0;
        this.shakeTimer = 0; this.shakeForce = 0;

        this.time  = 0;
        this.frame = 0;

        // ✅ MOBILE FIX: Frame skip for weak devices
        this.frameSkip    = 0;
        this.frameSkipMax = this.isMobile ? 1 : 0; // skip every 2nd frame on mobile if needed
        this.fpsHistory   = [];
        this.lastFpsCheck = 0;
        this.adaptiveMode = false;

        this.grid          = [];
        this.score         = 0;
        this.level         = this.playerData.currentLevel || 1;
        this.combo         = 0;
        this.maxCombo      = 0;
        this.bubblesPopped = 0;
        this.totalBubbles  = 0;
        this.shotsUsed     = 0;
        this.levelCoins    = 0;
        this.levelDiamonds = 0;

        this.levelConfig          = null;
        this.levelGoal            = 0;
        this.levelProgress        = 0;
        this.levelComplete        = false;
        this.levelTransition      = false;
        this.levelTransitionTimer = 0;
        this.starRating           = 0;
        this.showLevelComplete    = false;
        this.levelCompleteTimer   = 0;

        this.dropTimer    = 0;
        this.dropInterval = 30000;
        this.dropWarning  = false;

        this.gridBounce  = {};
        this.shootRecoil = 0;
        this.shootGlow   = 0;

        this.powerUps = {
            bomb:      { count: this.playerData.powerUps?.bomb      || 1, icon: 'B', name: 'Bomb',  cost: 100, color: '#FF8811' },
            precision: { count: this.playerData.powerUps?.precision || 2, icon: 'A', name: 'Aim+',  cost: 30,  color: '#00FF88' }
        };
        this.activePowerUp = null;

        this.hudFlash = {};

        this.showDailyReward    = false;
        this.dailyRewardClaimed = false;
        this.dailyRewardAnim    = 0;
        this.checkDailyReward();

        // ✅ MOBILE FIX: Fewer stars
        this.stars = this.makeStars(this.isMobile ? 25 : 60);

        this.initLevel(this.level);
        this.generateShooter();
        this.preRenderAll();

        this.pointerDown  = false;
        this.lastPointerX = this.W / 2;
        this.lastPointerY = this.H / 2;
        this.bindEvents();

        this.boundFSChange = this.onFullscreenChange.bind(this);
        document.addEventListener('fullscreenchange',       this.boundFSChange);
        document.addEventListener('webkitfullscreenchange', this.boundFSChange);

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

    // ============================================================
    // FULLSCREEN
    // ============================================================
    toggleFullscreen() {
        const el = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) req.call(el).catch(() => {});
        } else {
            const ex = document.exitFullscreen || document.webkitExitFullscreen;
            if (ex) ex.call(document);
        }
    }

    onFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        setTimeout(() => this.resize(), 200);
    }

    // ============================================================
    // DPR HELPERS — ✅ Inline math for speed
    // ============================================================
    dX(x) { return x * this.dpr | 0; }
    dY(y) { return y * this.dpr | 0; }
    dS(s) { return s * this.dpr; }

    // ============================================================
    // CRISP TEXT
    // ============================================================
    drawText(ctx, text, x, y, options = {}) {
        const {
            size = 14, weight = 'bold', color = '#FFFFFF',
            align = 'left', baseline = 'alphabetic',
            family = null, glow = false, glowColor = null, glowBlur = 0,
            stroke = false, strokeColor = '#000', strokeWidth = 3,
            opacity = 1, maxWidth = 0
        } = options;

        ctx.save();
        const sx = x * this.dpr;
        const sy = y * this.dpr;
        ctx.globalAlpha = opacity;
        ctx.font = `${weight} ${Math.round(size * this.dpr)}px ${family || this.FONT_UI}`;
        ctx.textAlign    = align;
        ctx.textBaseline = baseline;

        if (stroke) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth   = strokeWidth * this.dpr;
            ctx.lineJoin    = 'round';
            ctx.strokeText(text, sx, sy);
        }

        // ✅ MOBILE FIX: Only glow on desktop
        if (glow && glowBlur > 0 && !this.isMobile) {
            ctx.shadowBlur  = glowBlur * this.dpr;
            ctx.shadowColor = glowColor || color;
        }

        ctx.fillStyle = color;
        ctx.fillText(text, sx, sy);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ============================================================
    // SHAPES — ✅ Fast integer math
    // ============================================================
    drawCircle(ctx, x, y, r) {
        ctx.beginPath();
        ctx.arc(x * this.dpr, y * this.dpr, r * this.dpr, 0, 6.2832);
    }

    drawRoundRect(ctx, x, y, w, h, radius) {
        const dx = x * this.dpr | 0;
        const dy = y * this.dpr | 0;
        const dw = w * this.dpr;
        const dh = h * this.dpr;
        const dr = radius * this.dpr;
        ctx.beginPath();
        ctx.moveTo(dx + dr, dy);
        ctx.arcTo(dx + dw, dy,      dx + dw, dy + dh, dr);
        ctx.arcTo(dx + dw, dy + dh, dx,      dy + dh, dr);
        ctx.arcTo(dx,      dy + dh, dx,      dy,      dr);
        ctx.arcTo(dx,      dy,      dx + dw, dy,      dr);
        ctx.closePath();
    }

    // ============================================================
    // PRE-RENDER BUBBLES — ✅ Simpler shading on mobile
    // ============================================================
    preRenderAll() {
        this.cache.bubbles.clear();
        this.cache.glows.clear();
        const r = this.BUBBLE_R;

        this.COLORS.forEach((col, idx) => {
            const bSize = Math.ceil((r + 3) * 2 * this.dpr);
            const bC = document.createElement('canvas');
            bC.width = bC.height = bSize;
            const bCtx = bC.getContext('2d');

            if (this.isMobile) {
                // ✅ MOBILE FIX: Simple 2-stop gradient, no multiple layers
                this.renderSimpleBubble(bCtx, bSize/2, bSize/2, r * this.dpr, col);
            } else {
                this.renderHDBubble(bCtx, bSize/2, bSize/2, r * this.dpr, col);
            }
            this.cache.bubbles.set(idx, bC);

            // ✅ MOBILE FIX: Skip glow cache on mobile
            if (!this.isMobile) {
                const gSize = Math.ceil((r + 12) * 2 * this.dpr);
                const gC = document.createElement('canvas');
                gC.width = gC.height = gSize;
                const gCtx = gC.getContext('2d');
                const gcx = gSize/2, gcy = gSize/2;
                const gg = gCtx.createRadialGradient(gcx, gcy, r*this.dpr*0.3, gcx, gcy, (r+10)*this.dpr);
                gg.addColorStop(0, col.glow + '0.2)');
                gg.addColorStop(1, 'rgba(0,0,0,0)');
                gCtx.fillStyle = gg;
                gCtx.beginPath();
                gCtx.arc(gcx, gcy, (r+10)*this.dpr, 0, 6.2832);
                gCtx.fill();
                this.cache.glows.set(idx, gC);
            }
        });
    }

    // ✅ NEW: Fast simple bubble for mobile
    renderSimpleBubble(ctx, cx, cy, r, col) {
        const grad = ctx.createRadialGradient(cx - r*0.2, cy - r*0.25, r*0.05, cx, cy, r);
        grad.addColorStop(0, col.light);
        grad.addColorStop(0.7, col.hex);
        grad.addColorStop(1, col.dark);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fillStyle = grad;
        ctx.fill();

        // Simple highlight
        const hl = ctx.createRadialGradient(cx - r*0.28, cy - r*0.3, 0, cx - r*0.15, cy - r*0.15, r*0.45);
        hl.addColorStop(0, 'rgba(255,255,255,0.55)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.fill();
    }

    renderHDBubble(ctx, cx, cy, r, col) {
        const baseGrad = ctx.createRadialGradient(cx-r*0.25, cy-r*0.3, r*0.05, cx+r*0.05, cy+r*0.1, r);
        baseGrad.addColorStop(0, col.light);
        baseGrad.addColorStop(0.35, col.hex);
        baseGrad.addColorStop(1, col.dark);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fillStyle = baseGrad; ctx.fill();

        const edgeGrad = ctx.createRadialGradient(cx, cy, r*0.65, cx, cy, r);
        edgeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        edgeGrad.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = edgeGrad;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();

        const hl = ctx.createRadialGradient(cx-r*0.3, cy-r*0.35, 0, cx-r*0.15, cy-r*0.15, r*0.55);
        hl.addColorStop(0, 'rgba(255,255,255,0.6)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
    }

    calculateBubbleRadius() {
        const maxR = Math.floor((this.W - 16) / (this.COLS * 2 + 0.5));
        return Math.min(maxR, this.isMobile ? 17 : 20);
    }

    recalcGrid() {
        this.cellW   = this.BUBBLE_R * 2;
        this.cellH   = this.BUBBLE_R * 1.73;
        const totalW = this.COLS * this.cellW;
        this.offsetX = (this.W - totalW) / 2 + this.BUBBLE_R;
    }

    // ============================================================
    // SAVE / LOAD
    // ============================================================
    loadPlayerData() {
        const def = {
            coins:0, diamonds:0, currentLevel:1, highestLevel:1,
            totalScore:0, totalPopped:0, totalCoinsEarned:0, totalDiamondsEarned:0,
            dailyStreak:0, lastDailyReward:null, levelStars:{},
            powerUps:{ bomb:1, precision:2 }, gamesPlayed:0
        };
        try {
            const s = JSON.parse(localStorage.getItem(this.saveKey));
            if (s) return { ...def, ...s };
        } catch(e) {}
        return def;
    }

    savePlayerData() {
        this.playerData.powerUps = {};
        for (const k in this.powerUps) this.playerData.powerUps[k] = this.powerUps[k].count;
        try { localStorage.setItem(this.saveKey, JSON.stringify(this.playerData)); } catch(e) {}
    }

    // ============================================================
    // DAILY REWARD
    // ============================================================
    checkDailyReward() {
        const today = new Date().toDateString();
        if (this.playerData.lastDailyReward !== today) {
            if (this.playerData.lastDailyReward) {
                const diff = Math.floor((new Date() - new Date(this.playerData.lastDailyReward)) / 86400000);
                this.playerData.dailyStreak = diff === 1 ? this.playerData.dailyStreak + 1 : 0;
            }
            this.showDailyReward    = true;
            this.dailyRewardClaimed = false;
            this.dailyRewardAnim    = 0;
        }
    }

    claimDailyReward() {
        if (this.dailyRewardClaimed) return;
        const streak   = this.playerData.dailyStreak;
        const coins    = Math.floor(50 * Math.min(1 + streak * 0.25, 3));
        const diamonds = Math.floor(2 * Math.max(1, Math.floor(streak / 3)));
        this.playerData.coins    += coins;
        this.playerData.diamonds += diamonds;
        this.playerData.totalCoinsEarned    += coins;
        this.playerData.totalDiamondsEarned += diamonds;
        this.playerData.lastDailyReward = new Date().toDateString();
        this.playerData.dailyStreak++;
        this.dailyRewardClaimed = true;
        this.showDailyReward    = false;
        this.addFloatingText(this.W/2, this.H/2-30, `+${coins} Coins`, '#FFD700', 22);
        this.addFloatingText(this.W/2, this.H/2+10, `+${diamonds} Gems`, '#00D4FF', 20);
        this.savePlayerData();
    }

    // ============================================================
    // LEVEL SYSTEM
    // ============================================================
    getLevelConfig(lvl) {
        const configs = {
            1:  { rows:4,  colors:3, goal:25,  drop:45000, name:'Warm Up',        layout:'std'        },
            2:  { rows:4,  colors:3, goal:30,  drop:42000, name:'Getting Started', layout:'std'        },
            3:  { rows:5,  colors:4, goal:40,  drop:40000, name:'Color Mix',       layout:'std'        },
            4:  { rows:5,  colors:4, goal:45,  drop:38000, name:'Rising Tide',     layout:'std'        },
            5:  { rows:6,  colors:4, goal:55,  drop:35000, name:'The Wall',        layout:'boss_wall'  },
            6:  { rows:5,  colors:5, goal:50,  drop:35000, name:'Rainbow Rush',    layout:'std'        },
            7:  { rows:5,  colors:5, goal:55,  drop:33000, name:'Quick Fire',      layout:'zigzag'     },
            8:  { rows:6,  colors:5, goal:60,  drop:32000, name:'Deep Colors',     layout:'std'        },
            9:  { rows:6,  colors:5, goal:65,  drop:30000, name:'Speed Run',       layout:'diamond'    },
            10: { rows:7,  colors:5, goal:75,  drop:28000, name:'Pyramid',         layout:'boss_pyr'   },
            11: { rows:6,  colors:6, goal:70,  drop:28000, name:'Hex Mix',         layout:'std'        },
            12: { rows:6,  colors:6, goal:75,  drop:26000, name:'Cascade',         layout:'checker'    },
            13: { rows:7,  colors:6, goal:80,  drop:25000, name:'Tight Squeeze',   layout:'std'        },
            14: { rows:7,  colors:6, goal:85,  drop:24000, name:'Storm',           layout:'zigzag'     },
            15: { rows:7,  colors:6, goal:90,  drop:22000, name:'The Cross',       layout:'boss_cross' },
            16: { rows:7,  colors:7, goal:85,  drop:22000, name:'Spectrum',        layout:'std'        },
            17: { rows:7,  colors:7, goal:90,  drop:20000, name:'Maze Runner',     layout:'maze'       },
            18: { rows:8,  colors:7, goal:95,  drop:20000, name:'Dense Pack',      layout:'std'        },
            19: { rows:8,  colors:7, goal:100, drop:18000, name:'Pressure',        layout:'diamond'    },
            20: { rows:8,  colors:7, goal:110, drop:16000, name:'Spiral',          layout:'boss_spiral'},
            21: { rows:8,  colors:8, goal:100, drop:16000, name:'Octachrome',      layout:'std'        },
            22: { rows:8,  colors:8, goal:110, drop:15000, name:'Blitz',           layout:'checker'    },
            23: { rows:9,  colors:8, goal:120, drop:14000, name:'Endurance',       layout:'zigzag'     },
            24: { rows:9,  colors:8, goal:130, drop:12000, name:'Nightmare',       layout:'maze'       },
            25: { rows:10, colors:8, goal:150, drop:10000, name:'FINAL BOSS',      layout:'boss_final' }
        };
        if (configs[lvl]) return configs[lvl];
        return {
            rows: Math.min(10, 6 + Math.floor(lvl/5)),
            colors: Math.min(8, 3 + Math.floor(lvl/3)),
            goal: 50 + lvl * 10,
            drop: Math.max(8000, 30000 - lvl * 800),
            name: `Endless ${lvl}`,
            layout: ['std','zigzag','diamond','checker','maze'][lvl % 5]
        };
    }

    initLevel(level) {
        this.levelConfig   = this.getLevelConfig(level);
        this.ROWS          = Math.max(12, this.levelConfig.rows + 5);
        this.dropInterval  = this.levelConfig.drop;
        this.dropTimer     = 0;
        this.bubblesPopped = 0;
        this.shotsUsed     = 0;
        this.levelCoins    = 0;
        this.levelDiamonds = 0;
        this.combo         = 0;
        this.maxCombo      = 0;
        this.levelComplete      = false;
        this.showLevelComplete  = false;
        this.levelGoal          = this.levelConfig.goal;
        this.levelProgress      = 0;
        this.activePowerUp      = null;
        this.totalBubbles       = 0;
        this.gridBounce         = {};

        this.grid = [];
        for (let r = 0; r < this.ROWS; r++) this.grid[r] = new Array(this.COLS).fill(null);

        this.buildLayout(this.levelConfig);
        this.updateColorsInPlay();

        this.particles      = [];
        this.fallingBubbles = [];
        this.popRings       = [];
        this.ripples        = [];

        this.addFloatingText(this.W/2, this.H/2-35, `Level ${level}`, '#B94FE3', 26);
        this.addFloatingText(this.W/2, this.H/2+5,  this.levelConfig.name, '#00D4FF', 14);
    }

    buildLayout(cfg) {
        const n = cfg.colors, rows = cfg.rows;
        switch (cfg.layout) {
            case 'zigzag':
                for (let r=0;r<rows;r++) for (let c=0;c<this.COLS;c++)
                    if ((r+c)%2===0) this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
                break;
            case 'diamond': {
                const mid = Math.floor(this.COLS/2);
                for (let r=0;r<rows;r++) {
                    const half = Math.min(r, rows-1-r);
                    for (let c=mid-half;c<=mid+half;c++)
                        if (c>=0&&c<this.COLS) this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
                }
                break;
            }
            case 'checker':
                for (let r=0;r<rows;r++) for (let c=0;c<this.COLS;c++)
                    this.grid[r][c]=this.makeBubble((r+c)%n);
                break;
            case 'maze':
                for (let r=0;r<rows;r++) for (let c=0;c<this.COLS;c++)
                    if (r%2===0||c%3===0) this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
                break;
            case 'boss_wall':
                for (let r=0;r<6;r++) for (let c=0;c<this.COLS;c++)
                    this.grid[r][c]=this.makeBubble(r%n);
                break;
            case 'boss_pyr':
                for (let r=0;r<7;r++) {
                    const s=Math.max(0,Math.floor(r/2)), e=Math.min(this.COLS,this.COLS-Math.floor(r/2));
                    for (let c=s;c<e;c++) this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
                }
                break;
            case 'boss_cross': {
                const m=Math.floor(this.COLS/2);
                for (let r=0;r<7;r++) {
                    if (r===3) for (let c=0;c<this.COLS;c++) this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
                    for (let c=m-1;c<=m+1;c++) if(c>=0&&c<this.COLS) this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
                }
                break;
            }
            case 'boss_spiral': {
                const cx2=Math.floor(this.COLS/2);
                for (let r=0;r<8;r++) for (let c=0;c<this.COLS;c++) {
                    const dx=c-cx2, d=Math.sqrt(dx*dx+r*r);
                    if (d<6&&(Math.floor(Math.atan2(r,dx)*3+d)%2===0))
                        this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
                }
                break;
            }
            case 'boss_final':
                for (let r=0;r<8;r++) for (let c=0;c<this.COLS;c++)
                    this.grid[r][c]=this.makeBubble(r<3?(r%n):Math.floor(Math.random()*n));
                break;
            default:
                for (let r=0;r<rows;r++) for (let c=0;c<this.COLS;c++)
                    this.grid[r][c]=this.makeBubble(Math.floor(Math.random()*n));
        }
    }

    makeBubble(ci) {
        this.totalBubbles++;
        // ✅ MOBILE FIX: No breathe animation tracking needed live
        return { ci, scale:1, flash:0, breathe: Math.random()*6.28, isNew:false };
    }

    // ============================================================
    // ECONOMY
    // ============================================================
    earnCoins(amt, x, y) {
        this.playerData.coins += amt;
        this.playerData.totalCoinsEarned += amt;
        this.levelCoins += amt;
        this.addTextPopup(x, y, `+${amt}C`, '#FFD700');
        this.hudFlash.coins = 12;
    }

    earnDiamonds(amt, x, y) {
        this.playerData.diamonds += amt;
        this.playerData.totalDiamondsEarned += amt;
        this.levelDiamonds += amt;
        this.addTextPopup(x, y-15, `+${amt}D`, '#00D4FF');
        this.hudFlash.diamonds = 12;
    }

    // ============================================================
    // POWER-UPS
    // ============================================================
    activatePowerUp(type) {
        if (!this.powerUps[type] || this.powerUps[type].count <= 0) return;
        if (this.activePowerUp === type) { this.activePowerUp = null; return; }
        this.activePowerUp = null;
        this.powerUps[type].count--;
        this.activePowerUp = type;
        this.addFloatingText(this.W/2, this.H/2, `${this.powerUps[type].name}!`, this.powerUps[type].color, 20);
        this.savePlayerData();
    }

    // ============================================================
    // INPUT
    // ============================================================
    bindEvents() {
        this.canvas.style.touchAction = 'none';
        this.canvas.style.userSelect  = 'none';

        if (window.PointerEvent) {
            this.canvas.addEventListener('pointermove', e => { e.preventDefault(); this.handlePointerMove(e); }, { passive: false });
            this.canvas.addEventListener('pointerup',   e => { e.preventDefault(); this.handlePointerUp(e);   }, { passive: false });
            this.canvas.addEventListener('pointerdown', e => { e.preventDefault(); this.pointerDown = true;    }, { passive: false });
        } else {
            this.canvas.addEventListener('mousemove',  e => this.handleMouseMove(e));
            this.canvas.addEventListener('click',      e => this.handleClick(e));
            this.canvas.addEventListener('touchmove',  e => { e.preventDefault(); this.handleTouchMove(e); }, { passive: false });
            this.canvas.addEventListener('touchend',   e => { e.preventDefault(); this.handleTouchEnd(e);  }, { passive: false });
            this.canvas.addEventListener('touchstart', e => { e.preventDefault(); },                          { passive: false });
        }
        document.addEventListener('keydown', e => this.handleKey(e));
    }

    getLogicalPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.W / rect.width;
        const scaleY = this.H / rect.height;
        let cx, cy;
        if (e.touches) {
            cx = e.touches[0] ? e.touches[0].clientX : e.changedTouches[0].clientX;
            cy = e.touches[0] ? e.touches[0].clientY : e.changedTouches[0].clientY;
        } else { cx = e.clientX; cy = e.clientY; }
        return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
    }

    handlePointerMove(e) {
        if (this.paused || this.gameOver) return;
        const p = this.getLogicalPos(e);
        this.lastPointerX = p.x; this.lastPointerY = p.y;
        this.aimAt(p.x, p.y);
    }

    handlePointerUp(e) {
        const p = this.getLogicalPos(e);
        this.lastPointerX = p.x; this.lastPointerY = p.y;
        if (this.handleUIClick(p.x, p.y)) return;
        this.aimAt(p.x, p.y);
        this.tryShoot();
    }

    handleMouseMove(e) {
        if (this.paused || this.gameOver) return;
        const p = this.getLogicalPos(e);
        this.aimAt(p.x, p.y);
    }

    handleClick(e) {
        const p = this.getLogicalPos(e);
        if (this.handleUIClick(p.x, p.y)) return;
        this.aimAt(p.x, p.y);
        this.tryShoot();
    }

    handleTouchMove(e) {
        if (this.paused || this.gameOver) return;
        const p = this.getLogicalPos(e);
        this.aimAt(p.x, p.y);
    }

    handleTouchEnd(e) {
        const p = this.getLogicalPos(e);
        if (this.handleUIClick(p.x, p.y)) return;
        this.aimAt(p.x, p.y);
        this.tryShoot();
    }

    handleKey(e) {
        if (this.destroyed) return;
        if (e.key === '1') this.activatePowerUp('bomb');
        if (e.key === '2') this.activatePowerUp('precision');
        if (e.key === ' ') { e.preventDefault(); this.tryShoot(); }
        if (e.key === 'c' || e.key === 'C') this.swapCurrentBubble();
        if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
    }

    // ============================================================
    // UI CLICK
    // ============================================================
    handleUIClick(x, y) {
        if (this.showDailyReward && !this.dailyRewardClaimed) { this.claimDailyReward(); return true; }
        if (this.showLevelComplete) { this.goNextLevel(); return true; }

        const fsBtn = this.getFullscreenBtnRect();
        if (x >= fsBtn.x && x <= fsBtn.x+fsBtn.w && y >= fsBtn.y && y <= fsBtn.y+fsBtn.h) {
            this.toggleFullscreen(); return true;
        }

        const bubbleRadius = this.BUBBLE_R + (this.isMobile ? 14 : 10);
        const dx = x - this.shooterX, dy = y - this.shooterY;
        if (dx*dx + dy*dy < bubbleRadius*bubbleRadius) {
            this.swapCurrentBubble(); return true;
        }

        const btnS = this.isMobile ? 44 : 38;
        const btnGap = 8;
        const btnY = this.H - btnS - (this.isMobile ? 12 : 10);
        let i = 0;
        for (const key in this.powerUps) {
            const bx = 8 + i * (btnS + btnGap);
            if (x >= bx && x <= bx+btnS && y >= btnY && y <= btnY+btnS) {
                this.activatePowerUp(key); return true;
            }
            i++;
        }
        return false;
    }

    // ============================================================
    // SWAP BUBBLE
    // ============================================================
    swapCurrentBubble() {
        if (!this.canShoot || this.projectile) return;
        const pool = this.colorsInPlay.length ? this.colorsInPlay : [0,1,2];
        const curIdx  = pool.indexOf(this.currentBubble.ci);
        const newCi   = pool[(curIdx + 1) % pool.length];
        this.swapAnim     = 1;
        this.swapColorIdx = newCi;
        this.currentBubble = { ci: newCi, color: this.COLORS[newCi].hex };
        // ✅ MOBILE FIX: Fewer swap particles
        if (!this.isMobile) {
            const col = this.COLORS[newCi];
            for (let i = 0; i < 6; i++) {
                const a = Math.PI * 2 * i / 6;
                this.addParticle(this.shooterX + Math.cos(a)*this.BUBBLE_R, this.shooterY + Math.sin(a)*this.BUBBLE_R,
                    Math.cos(a)*2, Math.sin(a)*2, col.hex, 2, 30);
            }
        }
        this.calcAimLine();
    }

    getFullscreenBtnRect() {
        const btnW = this.isMobile ? 44 : 38;
        const btnH = this.isMobile ? 44 : 38;
        const margin = this.isMobile ? 12 : 10;
        return { x: this.W - btnW - margin, y: this.H - btnH - margin, w: btnW, h: btnH };
    }

    // ============================================================
    // AIM
    // ============================================================
    aimAt(mx, my) {
        let a = Math.atan2(my - this.shooterY, mx - this.shooterX);
        a = Math.max(-Math.PI + 0.1, Math.min(-0.1, a));
        this.targetAngle = a;
        this.calcAimLine();
    }

    tryShoot() {
        if (this.showDailyReward || this.showLevelComplete) return;
        if (this.paused || this.gameOver || !this.canShoot || this.projectile) return;
        if (this.levelComplete || this.levelTransition || this.shootCooldown > 0) return;
        this.shoot();
    }

    // ============================================================
    // AIM LINE — ✅ Fewer dots on mobile
    // ============================================================
    calcAimLine() {
        this.aimDots = [];
        let x = this.shooterX, y = this.shooterY;
        let vx = Math.cos(this.targetAngle), vy = Math.sin(this.targetAngle);
        let bounces = 0;
        const maxB     = this.activePowerUp === 'precision' ? 4 : 2;
        const step     = this.isMobile ? 14 : 10;
        const maxSteps = this.isMobile ? 20 : 30;

        for (let i = 0; i < maxSteps; i++) {
            x += vx * step; y += vy * step;
            if (x <= this.BUBBLE_R)          { x = this.BUBBLE_R;          vx = -vx; bounces++; }
            if (x >= this.W - this.BUBBLE_R) { x = this.W - this.BUBBLE_R; vx = -vx; bounces++; }
            if (y <= this.offsetY || y > this.shooterY + 10) break;
            if (bounces >= maxB) break;

            let hit = false;
            for (let r = 0; r < this.ROWS && !hit; r++) {
                for (let c = 0; c < this.COLS && !hit; c++) {
                    if (!this.grid[r]?.[c]) continue;
                    const pos = this.bubblePos(r, c);
                    const dx = x - pos.x, dy = y - pos.y;
                    if (dx*dx + dy*dy < (this.BUBBLE_R * 1.8)**2) hit = true;
                }
            }
            this.aimDots.push({ x, y, t: i / maxSteps });
            if (hit) break;
        }
    }

    // ============================================================
    // SHOOT
    // ============================================================
    shoot() {
        this.canShoot    = false;
        this.shotsUsed++;
        this.shootCooldown = 6;
        this.shootRecoil   = 5;
        this.shootGlow     = 1;

        const isBomb = this.activePowerUp === 'bomb';
        this.projectile = {
            x: this.shooterX, y: this.shooterY,
            vx: Math.cos(this.angle) * this.projectileSpeed,
            vy: Math.sin(this.angle) * this.projectileSpeed,
            ci: this.currentBubble.ci,
            color: this.COLORS[this.currentBubble.ci].hex,
            trail: [], isBomb, age: 0
        };

        // ✅ MOBILE FIX: Fewer shoot particles
        if (!this.isMobile) {
            for (let i = 0; i < 3; i++) {
                const spread = (Math.random()-0.5)*0.4;
                this.addParticle(this.shooterX + Math.cos(this.angle)*20, this.shooterY + Math.sin(this.angle)*20,
                    Math.cos(this.angle+spread)*2, Math.sin(this.angle+spread)*2,
                    this.currentBubble.color, 2, 25);
            }
        }

        this.activePowerUp = null;
        this.generateShooter();
    }

    // ============================================================
    // UPDATE
    // ============================================================
    update(dt) {
        if (this.paused || this.gameOver) return;

        this.time += dt;
        this.frame++;
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (this.swapAnim > 0) this.swapAnim = Math.max(0, this.swapAnim - 0.07);

        if (this.showDailyReward) this.dailyRewardAnim = Math.min(1, this.dailyRewardAnim + 0.06);
        if (this.showLevelComplete) { this.levelCompleteTimer++; this.updateFX(dt); return; }

        if (this.levelTransition) {
            this.levelTransitionTimer--;
            if (this.levelTransitionTimer <= 0) {
                this.levelTransition = false;
                this.initLevel(this.level);
                this.generateShooter();
            }
            return;
        }

        // ✅ MOBILE FIX: Faster angle lerp on mobile
        this.angle += (this.targetAngle - this.angle) * (this.isMobile ? 0.45 : 0.3);

        if (this.shootRecoil > 0) this.shootRecoil *= 0.8;
        if (this.shootGlow > 0)   this.shootGlow   *= 0.88;

        // ✅ MOBILE FIX: Reduced shake
        if (this.shakeTimer > 0) {
            const f = this.shakeForce * (this.shakeTimer / 10) * (this.isMobile ? 0.5 : 1);
            this.shakeX = (Math.random()-0.5) * f;
            this.shakeY = (Math.random()-0.5) * f * 0.3;
            this.shakeTimer--;
        } else { this.shakeX = 0; this.shakeY = 0; }

        for (const k in this.hudFlash) if (this.hudFlash[k] > 0) this.hudFlash[k]--;

        // ✅ MOBILE FIX: Update stars every 2nd frame
        if (!this.isMobile || this.frame % 2 === 0) {
            this.stars.forEach(s => { s.phase += s.speed; });
        }

        if (this.projectile) this.updateProjectile();

        // ✅ MOBILE FIX: Simplified bubble updates - no breathe on mobile
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;
                if (b.isNew) {
                    b.scale += (1 - b.scale) * 0.2;
                    if (b.scale > 0.97) { b.scale = 1; b.isNew = false; }
                }
                if (b.flash > 0) b.flash -= 0.8;
                if (!this.isMobile) b.breathe += 0.015;
                const bk = `${r},${c}`;
                if (this.gridBounce[bk]) {
                    this.gridBounce[bk] *= 0.82;
                    if (Math.abs(this.gridBounce[bk]) < 0.2) delete this.gridBounce[bk];
                }
            }
        }

        this.dropTimer += dt;
        if (this.dropTimer >= this.dropInterval) { this.dropTimer = 0; this.dropRow(); }
        this.dropWarning = (this.dropInterval - this.dropTimer) < 5000;

        this.levelProgress = Math.min(1, this.bubblesPopped / this.levelGoal);
        if (this.bubblesPopped >= this.levelGoal && !this.levelComplete) this.completeLevel();

        const remaining = this.grid.flat().filter(Boolean).length;
        if (remaining === 0 && !this.levelComplete && this.totalBubbles > 0) {
            this.earnCoins(100, this.W/2, this.H/2);
            this.completeLevel();
        }

        this.checkGameOver();
        this.updateFX(dt);
    }

    updateFX(dt) {
        // ✅ MOBILE FIX: Batch update with early exit
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--; p.vx *= 0.97;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
            const b = this.fallingBubbles[i];
            b.vy += 0.5; b.y += b.vy; b.x += b.vx; b.life--;
            if (b.life <= 0 || b.y > this.H + 40) this.fallingBubbles.splice(i, 1);
        }
        for (let i = this.popRings.length - 1; i >= 0; i--) {
            const r = this.popRings[i];
            r.radius += 3; r.opacity -= 0.05;
            if (r.opacity <= 0) this.popRings.splice(i, 1);
        }
        for (let i = this.textPopups.length - 1; i >= 0; i--) {
            const t = this.textPopups[i];
            t.y -= 1.0; t.life--; t.opacity = Math.min(1, t.life / 20);
            if (t.life <= 0) this.textPopups.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 0.5; t.life--; t.opacity = Math.min(1, t.life / 25);
            t.scale += (1 - t.scale) * 0.15;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.radius += 2.5; r.opacity -= 0.035;
            if (r.opacity <= 0) this.ripples.splice(i, 1);
        }
    }

    updateProjectile() {
        const p = this.projectile;
        p.age++;

        // ✅ MOBILE FIX: Shorter trail
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > (this.isMobile ? 5 : 9)) p.trail.shift();

        p.x += p.vx; p.y += p.vy;

        if (p.x <= this.BUBBLE_R)          { p.x = this.BUBBLE_R;          p.vx = -p.vx; }
        if (p.x >= this.W - this.BUBBLE_R) { p.x = this.W - this.BUBBLE_R; p.vx = -p.vx; }
        if (p.y <= this.BUBBLE_R + this.offsetY) { this.snapBubble(); return; }
        if (p.y > this.H + 20) { this.projectile = null; this.canShoot = true; return; }

        const r2 = (this.BUBBLE_R * 1.85) ** 2;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.grid[r]?.[c]) continue;
                const pos = this.bubblePos(r, c);
                const dx = p.x - pos.x, dy = p.y - pos.y;
                if (dx*dx + dy*dy < r2) { this.snapBubble(); return; }
            }
        }
    }

    // ============================================================
    // SNAP & MATCH
    // ============================================================
    snapBubble() {
        if (!this.projectile) return;
        const p = this.projectile;

        let bestR = -1, bestC = -1, bestD = Infinity;
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (this.grid[r]?.[c]) continue;
                const pos = this.bubblePos(r, c);
                const dx = p.x - pos.x, dy = p.y - pos.y;
                const d = dx*dx + dy*dy;
                if (d < bestD && d < (this.BUBBLE_R * 3.5)**2) { bestD = d; bestR = r; bestC = c; }
            }
        }

        if (bestR === -1) {
            bestR = 0;
            bestC = Math.max(0, Math.min(this.COLS-1, Math.round((p.x - this.offsetX) / this.cellW)));
        }

        if (bestR !== -1 && bestC !== -1) {
            if (p.isBomb) { this.explodeBomb(bestR, bestC); this.projectile = null; this.canShoot = true; return; }

            this.grid[bestR][bestC] = { ci: p.ci, scale: 0.2, flash: 5, breathe: 0, isNew: true };

            const nbs = this.getNeighbors(bestR, bestC);
            for (const [nr, nc] of nbs) if (this.grid[nr]?.[nc]) this.gridBounce[`${nr},${nc}`] = 2;

            const matches = this.findMatches(bestR, bestC);
            if (matches.length >= 3) {
                this.combo++;
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this.popMatches(matches, bestR, bestC);
            } else {
                this.combo = 0;
            }

            setTimeout(() => this.dropFloating(), 100);
        }

        this.projectile = null;
        this.canShoot   = true;
        this.updateColorsInPlay();
    }

    explodeBomb(r, c) {
        let count = 0;
        const pos = this.bubblePos(r, c);
        for (let dr = -3; dr <= 3; dr++) {
            for (let dc = -3; dc <= 3; dc++) {
                const nr = r+dr, nc = c+dc;
                if (nr<0||nr>=this.ROWS||nc<0||nc>=this.COLS||!this.grid[nr]?.[nc]) continue;
                if (dr*dr + dc*dc > 6.25) continue;
                const bp = this.bubblePos(nr, nc);
                this.spawnPop(bp.x, bp.y, this.COLORS[this.grid[nr][nc].ci].hex, this.isMobile ? 3 : 5);
                this.grid[nr][nc] = null;
                count++;
            }
        }
        this.bubblesPopped += count;
        this.score += count * 15;
        this.onScore(this.score);
        this.earnCoins(count*3, pos.x, pos.y);
        this.shake(8, 6);
        this.addTextPopup(pos.x, pos.y-15, `Bomb +${count*15}`, '#FF8811');
        setTimeout(() => this.dropFloating(), 150);
    }

    findMatches(sr, sc) {
        if (!this.grid[sr]?.[sc]) return [];
        const target = this.grid[sr][sc].ci;
        const visited = new Set(), matches = [], queue = [[sr, sc]];
        while (queue.length) {
            const [r, c] = queue.shift();
            const k = `${r},${c}`;
            if (visited.has(k)) continue;
            if (r<0||r>=this.ROWS||c<0||c>=this.COLS) continue;
            if (!this.grid[r]?.[c] || this.grid[r][c].ci !== target) continue;
            visited.add(k);
            matches.push([r, c]);
            for (const n of this.getNeighbors(r, c)) queue.push(n);
        }
        return matches;
    }

    getNeighbors(r, c) {
        return r%2===1
            ? [[r-1,c],[r-1,c+1],[r,c-1],[r,c+1],[r+1,c],[r+1,c+1]]
            : [[r-1,c-1],[r-1,c],[r,c-1],[r,c+1],[r+1,c-1],[r+1,c]];
    }

    bubblePos(r, c) {
        const ox = r%2===1 ? this.BUBBLE_R : 0;
        return { x: this.offsetX + c*this.cellW + ox, y: this.offsetY + r*this.cellH };
    }

    updateColorsInPlay() {
        const used = new Set();
        for (let r=0;r<this.ROWS;r++) for (let c=0;c<this.COLS;c++) if (this.grid[r]?.[c]) used.add(this.grid[r][c].ci);
        this.colorsInPlay = [...used];
        if (!this.colorsInPlay.length) this.colorsInPlay = Array.from({length: Math.min(3, this.levelConfig?.colors||3)}, (_,i)=>i);
    }

    generateShooter() {
        this.currentBubble = this.nextBubble || this.randBubble();
        this.nextBubble    = this.randBubble();
    }

    randBubble() {
        const pool = this.colorsInPlay.length ? this.colorsInPlay : [0,1,2];
        const ci   = pool[Math.floor(Math.random() * pool.length)];
        return { ci, color: this.COLORS[ci].hex };
    }

    // ============================================================
    // POP & DROP
    // ============================================================
    popMatches(matches, oR, oC) {
        const combo = Math.min(this.combo, 10);
        const pts   = matches.length * 10 * combo;
        this.score += pts;
        this.bubblesPopped += matches.length;

        const oPos = this.bubblePos(oR, oC);
        this.earnCoins(Math.floor(matches.length * (1 + combo*0.5)), oPos.x, oPos.y);
        if (combo >= 3 || (matches.length >= 5 && Math.random() < 0.3)) {
            this.earnDiamonds(combo >= 5 ? 2 : 1, oPos.x, oPos.y-20);
        }

        // ✅ MOBILE FIX: Batch pop, fewer particles
        matches.forEach(([r, c], i) => {
            const delay = this.isMobile ? i * 15 : i * 25;
            setTimeout(() => {
                if (this.destroyed) return;
                const pos = this.bubblePos(r, c);
                const col = this.grid[r]?.[c] ? this.COLORS[this.grid[r][c].ci].hex : '#FFF';
                this.spawnPop(pos.x, pos.y, col, this.isMobile ? 4 : 7);
                if (this.grid[r]) this.grid[r][c] = null;
            }, delay);
        });

        this.addTextPopup(oPos.x, oPos.y-12, combo>1 ? `x${combo}! +${pts}` : `+${pts}`, combo>2 ? '#FFD700' : '#00FF88');
        this.onScore(this.score);
        this.shake(combo>2 ? 8 : 3, combo>2 ? 5 : 2);
    }

    dropFloating() {
        const connected = new Set(), queue = [];
        for (let c=0;c<this.COLS;c++) if (this.grid[0]?.[c]) queue.push([0,c]);
        while (queue.length) {
            const [r,c] = queue.shift();
            const k = `${r},${c}`;
            if (connected.has(k)) continue;
            if (r<0||r>=this.ROWS||c<0||c>=this.COLS||!this.grid[r]?.[c]) continue;
            connected.add(k);
            for (const n of this.getNeighbors(r,c)) queue.push(n);
        }
        let dropped = 0;
        for (let r=0;r<this.ROWS;r++) {
            for (let c=0;c<this.COLS;c++) {
                if (this.grid[r]?.[c] && !connected.has(`${r},${c}`)) {
                    const pos = this.bubblePos(r,c);
                    if (this.fallingBubbles.length < this.MAX_FALLING)
                        this.fallingBubbles.push({ x:pos.x, y:pos.y, vx:(Math.random()-0.5)*2.5, vy:-Math.random()*2.5-0.5, ci:this.grid[r][c].ci, life:60 });
                    this.grid[r][c] = null;
                    dropped++;
                    this.bubblesPopped++;
                }
            }
        }
        if (dropped > 0) {
            const bonus = dropped * 15;
            this.score += bonus;
            this.earnCoins(dropped*2, this.W/2, this.H/2);
            this.onScore(this.score);
            this.addTextPopup(this.W/2, this.H/2, `${dropped} Drop! +${bonus}`, '#FF8811');
        }
    }

    dropRow() {
        for (let r=this.ROWS-1;r>0;r--) this.grid[r] = this.grid[r-1] ? [...this.grid[r-1]] : new Array(this.COLS).fill(null);
        this.grid[0] = [];
        const n = this.levelConfig?.colors||4;
        for (let c=0;c<this.COLS;c++) {
            const b = this.makeBubble(Math.floor(Math.random()*n));
            b.isNew = true; b.scale = 0;
            this.grid[0][c] = b;
        }
        this.updateColorsInPlay();
        this.shake(6, 4);
    }

    completeLevel() {
        this.levelComplete     = true;
        this.showLevelComplete = true;
        this.levelCompleteTimer = 0;
        const eff = this.levelGoal / Math.max(1, this.shotsUsed);
        this.starRating = eff >= 0.8 ? 3 : eff >= 0.5 ? 2 : 1;
        const lc = 50 + this.level*10 + this.starRating*20 + this.maxCombo*5;
        const ld = this.starRating >= 3 ? 3 : this.starRating >= 2 ? 1 : 0;
        this.earnCoins(lc, this.W/2, this.H/2-50);
        if (ld > 0) this.earnDiamonds(ld, this.W/2, this.H/2-25);
        const prev = this.playerData.levelStars[this.level] || 0;
        if (this.starRating > prev) this.playerData.levelStars[this.level] = this.starRating;
        if (this.level >= this.playerData.highestLevel) this.playerData.highestLevel = this.level+1;
        this.playerData.currentLevel = this.level;
        this.playerData.totalScore  += this.score;
        this.playerData.totalPopped += this.bubblesPopped;
        this.playerData.gamesPlayed++;
        this.savePlayerData();
    }

    goNextLevel() {
        this.level++;
        this.score = 0;
        this.showLevelComplete    = false;
        this.levelTransition      = true;
        this.levelTransitionTimer = 40;
        this.playerData.currentLevel = this.level;
        this.savePlayerData();
    }

    checkGameOver() {
        for (let c=0;c<this.COLS;c++) {
            if (this.grid[this.ROWS-2]?.[c]) {
                this.gameOver = true;
                this.playerData.totalScore  += this.score;
                this.playerData.totalPopped += this.bubblesPopped;
                this.playerData.gamesPlayed++;
                this.savePlayerData();
                setTimeout(() => this.onScore(this.score, true, { level: this.level, coins: this.levelCoins, diamonds: this.levelDiamonds }), 1200);
                return;
            }
        }
    }

    // ============================================================
    // FX HELPERS — ✅ Reduced on mobile
    // ============================================================
    addParticle(x, y, vx, vy, color, size, life) {
        if (this.particles.length >= this.MAX_PARTICLES) return;
        this.particles.push({ x, y, vx, vy, color, size, life, maxLife: life });
    }

    spawnPop(x, y, color, count) {
        const c = this.isMobile ? Math.min(count, 4) : count;
        for (let i=0;i<c;i++) {
            const a = Math.PI*2*i/c;
            const spd = Math.random()*3+1.5;
            this.addParticle(x, y, Math.cos(a)*spd, Math.sin(a)*spd, color, Math.random()*2.5+1, 35);
        }
        if (this.popRings.length < this.MAX_POP_RINGS)
            this.popRings.push({ x, y, radius: this.BUBBLE_R*0.3, opacity: 0.55, color });
    }

    addTextPopup(x, y, text, color) {
        if (this.textPopups.length >= this.MAX_POPUPS) this.textPopups.shift();
        this.textPopups.push({ x, y, text, color, life: 50, opacity: 1 });
    }

    addFloatingText(x, y, text, color, size) {
        this.floatingTexts.push({ x, y, text, color, size: size||16, life: 90, opacity: 1, scale: 0.4 });
    }

    shake(timer, force) {
        this.shakeTimer = this.isMobile ? Math.ceil(timer*0.6) : timer;
        this.shakeForce = force;
    }

    makeStars(count) {
        return Array.from({ length: count }, () => ({
            x: Math.random()*this.W, y: Math.random()*this.H,
            size: Math.random()*1.2+0.3, phase: Math.random()*6.28,
            speed: Math.random()*0.012+0.004,
            color: Math.random()>0.7 ? '#B94FE3' : '#FFF'
        }));
    }

    fmtNum(n) {
        if (n>=1e6) return (n/1e6).toFixed(1)+'M';
        if (n>=1e3) return (n/1e3).toFixed(1)+'K';
        return ''+n;
    }

    // ============================================================
    // DRAW — ✅ Main draw, all optimized
    // ============================================================
    draw() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.shakeX || this.shakeY) ctx.translate(this.dS(this.shakeX), this.dS(this.shakeY));

        this.drawBG(ctx, W, H);
        this.drawProgressBar(ctx, W);
        if (this.dropWarning) this.drawDropWarningFX(ctx, W, H);
        this.drawGridBubbles(ctx);
        this.drawPopRingsFX(ctx);
        this.drawAimLineFX(ctx);
        this.drawShooterFX(ctx);
        this.drawProjectileFX(ctx);
        this.drawFallingBubblesFX(ctx);
        this.drawParticlesFX(ctx);
        this.drawTextPopupsFX(ctx);
        this.drawFloatingTextsFX(ctx);
        this.drawHUD(ctx, W, H);
        this.drawPowerUpButtons(ctx);
        this.drawFullscreenBtn(ctx);

        ctx.restore();

        if (this.showDailyReward && !this.dailyRewardClaimed) this.drawDailyRewardScreen(ctx, W, H);
        if (this.showLevelComplete) this.drawLevelCompleteScreen(ctx, W, H);
        if (this.levelTransition)   this.drawTransition(ctx, W, H);
        if (this.gameOver)          this.drawGameOverScreen(ctx, W, H);
    }

    // ============================================================
    // DRAW: BG — ✅ Static gradient on mobile
    // ============================================================
    drawBG(ctx, W, H) {
        if (!this.bgGrad || this._bgW !== W || this._bgH !== H) {
            this.bgGrad = ctx.createRadialGradient(this.dX(W/2), this.dY(H*0.3), 0, this.dX(W/2), this.dY(H*0.5), this.dS(H));
            this.bgGrad.addColorStop(0, '#110825');
            this.bgGrad.addColorStop(1, '#030210');
            this._bgW = W; this._bgH = H;
        }
        ctx.fillStyle = this.bgGrad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // ✅ MOBILE FIX: Stars every 2 frames
        if (!this.isMobile || this.frame % 2 === 0) {
            for (const s of this.stars) {
                const alpha = 0.15 + ((Math.sin(s.phase)+1)/2)*0.55;
                ctx.globalAlpha = alpha;
                ctx.fillStyle   = s.color;
                ctx.beginPath();
                ctx.arc(s.x * this.dpr, s.y * this.dpr, s.size * this.dpr, 0, 6.2832);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    drawProgressBar(ctx, W) {
        const bw = W-20, bh = 4, bx = 10, by = this.offsetY - 8;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        this.drawRoundRect(ctx, bx, by, bw, bh, 2); ctx.fill();
        if (this.levelProgress > 0) {
            const fw = bw * this.levelProgress;
            const gr = ctx.createLinearGradient(this.dX(bx), 0, this.dX(bx+fw), 0);
            gr.addColorStop(0, '#B94FE3');
            gr.addColorStop(1, '#00D4FF');
            ctx.fillStyle = gr;
            this.drawRoundRect(ctx, bx, by, fw, bh, 2); ctx.fill();
        }
    }

    drawDropWarningFX(ctx, W, H) {
        const pulse = Math.abs(Math.sin(this.time/200));
        const alpha = ((1-(this.dropInterval-this.dropTimer)/5000))*0.08*pulse;
        ctx.fillStyle = `rgba(255,0,50,${alpha.toFixed(3)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ============================================================
    // DRAW: GRID — ✅ No glow on mobile, integer positions
    // ============================================================
    drawGridBubbles(ctx) {
        const R = this.BUBBLE_R;
        for (let r=0;r<this.ROWS;r++) {
            for (let c=0;c<this.COLS;c++) {
                const b = this.grid[r]?.[c];
                if (!b) continue;
                const pos   = this.bubblePos(r, c);
                const scale = b.isNew ? b.scale : (this.isMobile ? 1 : 1 + Math.sin(b.breathe)*0.005);
                const bounce = this.gridBounce[`${r},${c}`] || 0;
                const px = pos.x, py = pos.y - bounce;

                // Glow: desktop only
                if (!this.isMobile) {
                    const glowImg = this.cache.glows.get(b.ci);
                    if (glowImg) {
                        ctx.globalAlpha = 0.28;
                        const gs = (R+12)*2*scale;
                        ctx.drawImage(glowImg, this.dX(px)-this.dS(gs/2), this.dY(py)-this.dS(gs/2), this.dS(gs), this.dS(gs));
                        ctx.globalAlpha = 1;
                    }
                }

                if (b.flash > 0) ctx.globalAlpha = 0.7 + (b.flash/5)*0.3;

                const bubImg = this.cache.bubbles.get(b.ci);
                if (bubImg) {
                    const bs = (R+3)*2*scale;
                    ctx.drawImage(bubImg, this.dX(px) - this.dS(bs/2), this.dY(py) - this.dS(bs/2), this.dS(bs), this.dS(bs));
                }
                ctx.globalAlpha = 1;
            }
        }
    }

    drawFallingBubblesFX(ctx) {
        for (const b of this.fallingBubbles) {
            ctx.globalAlpha = Math.min(1, b.life/30);
            const bubImg = this.cache.bubbles.get(b.ci);
            if (bubImg) {
                const bs = (this.BUBBLE_R+3)*2;
                ctx.drawImage(bubImg, this.dX(b.x) - this.dS(bs/2), this.dY(b.y) - this.dS(bs/2), this.dS(bs), this.dS(bs));
            }
        }
        ctx.globalAlpha = 1;
    }

    drawPopRingsFX(ctx) {
        for (const r of this.popRings) {
            ctx.globalAlpha = r.opacity;
            ctx.strokeStyle = r.color;
            ctx.lineWidth   = this.dS(2*r.opacity);
            this.drawCircle(ctx, r.x, r.y, r.radius); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // DRAW: AIM LINE — ✅ Simpler on mobile
    // ============================================================
    drawAimLineFX(ctx) {
        if (!this.aimDots.length || this.projectile) return;
        const anim = this.time / 80;
        const col  = this.COLORS[this.currentBubble?.ci || 0];

        for (let i=0;i<this.aimDots.length;i++) {
            const d     = this.aimDots[i];
            const alpha = (1 - d.t) * 0.5;
            const size  = this.isMobile ? 2.5 : (2 - d.t*1.2);
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = col.hex;
            ctx.beginPath();
            ctx.arc(d.x * this.dpr, d.y * this.dpr, Math.max(1, size) * this.dpr, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ============================================================
    // DRAW: SHOOTER — ✅ Simplified on mobile
    // ============================================================
    drawShooterFX(ctx) {
        const x = this.shooterX, y = this.shooterY;

        ctx.save();
        ctx.translate(this.dX(x), this.dY(y));
        ctx.rotate(this.angle);

        const recoil = -this.shootRecoil;
        ctx.fillStyle = '#9944cc';
        const rx = this.dS(8+recoil), ry = this.dS(-4.5);
        const rw = this.dS(26), rh = this.dS(9), rr = this.dS(3);
        ctx.beginPath();
        ctx.moveTo(rx+rr, ry);
        ctx.arcTo(rx+rw, ry, rx+rw, ry+rh, rr);
        ctx.arcTo(rx+rw, ry+rh, rx, ry+rh, rr);
        ctx.arcTo(rx, ry+rh, rx, ry, rr);
        ctx.arcTo(rx, ry, rx+rw, ry, rr);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Current bubble
        const bci    = this.currentBubble.ci;
        const bubImg = this.cache.bubbles.get(bci);
        const pulse  = this.isMobile ? 1 : (1 + Math.sin(this.time/500)*0.025);

        if (bubImg) {
            const bs = (this.BUBBLE_R+3)*2*pulse;
            ctx.drawImage(bubImg, this.dX(x)-this.dS(bs/2), this.dY(y)-this.dS(bs/2), this.dS(bs), this.dS(bs));
        }

        if (this.swapAnim > 0) {
            const col = this.COLORS[this.swapColorIdx];
            ctx.globalAlpha = this.swapAnim;
            ctx.strokeStyle = col.hex;
            ctx.lineWidth   = this.dS(2.5);
            this.drawCircle(ctx, x, y, this.BUBBLE_R + 4 + (1-this.swapAnim)*8);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Tap hint
        const hAlpha = 0.2 + Math.sin(this.time/450)*0.18;
        this.drawText(ctx, 'TAP = COLOR', x, y + this.BUBBLE_R + (this.isMobile ? 15 : 13), {
            size: this.isMobile ? 8 : 7, color: '#ffffff',
            align: 'center', baseline: 'top', opacity: hAlpha, family: this.FONT_MONO, weight: '500'
        });

        // Next bubble
        this.drawText(ctx, 'NEXT', x+48, y+2, {
            size: 8, color: 'rgba(255,255,255,0.3)', align: 'center', baseline: 'middle', weight: '600'
        });
        const nImg = this.cache.bubbles.get(this.nextBubble.ci);
        if (nImg) {
            ctx.globalAlpha = 0.7;
            const ns = (this.BUBBLE_R+3)*2*0.62;
            ctx.drawImage(nImg, this.dX(x+48)-this.dS(ns/2), this.dY(y+18)-this.dS(ns/2), this.dS(ns), this.dS(ns));
            ctx.globalAlpha = 1;
        }
    }

    drawProjectileFX(ctx) {
        if (!this.projectile) return;
        const p = this.projectile;

        // Trail
        for (let i=0;i<p.trail.length;i++) {
            const t = p.trail[i];
            const prog = i / p.trail.length;
            ctx.globalAlpha = prog * 0.28;
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(t.x * this.dpr, t.y * this.dpr, this.BUBBLE_R * prog * 0.45 * this.dpr, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        const bubImg = this.cache.bubbles.get(p.ci);
        if (bubImg) {
            const bs = (this.BUBBLE_R+3)*2;
            ctx.drawImage(bubImg, this.dX(p.x)-this.dS(bs/2), this.dY(p.y)-this.dS(bs/2), this.dS(bs), this.dS(bs));
        }
    }

    drawParticlesFX(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle   = p.color;
            ctx.beginPath();
            ctx.arc(p.x * this.dpr, p.y * this.dpr, Math.max(0.5, p.size*(p.life/p.maxLife)) * this.dpr, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawTextPopupsFX(ctx) {
        for (const t of this.textPopups) {
            this.drawText(ctx, t.text, t.x, t.y, {
                size: 12, weight: 'bold', color: t.color,
                align: 'center', baseline: 'middle',
                stroke: true, strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 2,
                opacity: t.opacity, family: this.FONT_UI
            });
        }
    }

    drawFloatingTextsFX(ctx) {
        for (const t of this.floatingTexts) {
            this.drawText(ctx, t.text, t.x, t.y, {
                size: (t.size||14) * Math.min(1, t.scale||1),
                weight: 'bold', color: t.color,
                align: 'center', baseline: 'middle',
                stroke: true, strokeColor: 'rgba(0,0,0,0.5)', strokeWidth: 2.5,
                glow: !this.isMobile, glowColor: t.color, glowBlur: 6,
                opacity: t.opacity, family: this.FONT_UI
            });
        }
    }

    // ============================================================
    // DRAW: FULLSCREEN BTN — Bottom Right
    // ============================================================
    drawFullscreenBtn(ctx) {
        const r   = this.getFullscreenBtnRect();
        const isFS = this.isFullscreen;

        ctx.fillStyle = `rgba(185,79,227,${isFS ? 0.18 : 0.13})`;
        this.drawRoundRect(ctx, r.x, r.y, r.w, r.h, 10);
        ctx.fill();

        ctx.strokeStyle = `rgba(185,79,227,${isFS ? 0.5 : 0.3})`;
        ctx.lineWidth   = this.dS(0.8);
        this.drawRoundRect(ctx, r.x, r.y, r.w, r.h, 10);
        ctx.stroke();

        const cx = r.x + r.w/2, cy = r.y + r.h/2;
        const sz = this.isMobile ? 7 : 6;
        const arm = this.isMobile ? 4 : 3.5;

        ctx.strokeStyle = 'rgba(255,255,255,0.82)';
        ctx.lineWidth   = this.dS(this.isMobile ? 1.8 : 1.5);
        ctx.lineCap = 'round';

        const corners = [[-1,-1],[1,-1],[1,1],[-1,1]];
        if (!isFS) {
            corners.forEach(([sx, sy]) => {
                const tx = cx + sx*sz, ty = cy + sy*sz;
                ctx.beginPath();
                ctx.moveTo(this.dX(tx - sx*arm), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty - sy*arm));
                ctx.stroke();
            });
        } else {
            const ins = sz - arm*0.6;
            corners.forEach(([sx, sy]) => {
                const tx = cx + sx*ins, ty = cy + sy*ins;
                ctx.beginPath();
                ctx.moveTo(this.dX(tx + sx*arm), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty));
                ctx.lineTo(this.dX(tx), this.dY(ty + sy*arm));
                ctx.stroke();
            });
        }
        ctx.lineCap = 'butt';
    }

    // ============================================================
    // DRAW: HUD
    // ============================================================
    drawHUD(ctx, W, H) {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(0, 0, this.canvas.width, this.dY(44));

        this.drawText(ctx, `LVL ${this.level}`, 10, 17, {
            size: 12, weight: 'bold', color: '#B94FE3', family: this.FONT_UI,
            glow: !this.isMobile, glowColor: '#B94FE3', glowBlur: 4
        });
        this.drawText(ctx, this.levelConfig?.name || '', 10, 33, {
            size: 9, color: 'rgba(255,255,255,0.38)', family: this.FONT_MONO
        });

        this.drawText(ctx, `${this.bubblesPopped}/${this.levelGoal}`, W/2, 17, {
            size: 11, weight: '600', color: '#00D4FF', align: 'center', family: this.FONT_MONO
        });

        if (this.combo > 1) {
            this.drawText(ctx, `x${this.combo} COMBO`, W/2, 33, {
                size: 10, weight: 'bold', color: '#FFD700',
                align: 'center', family: this.FONT_UI,
                glow: !this.isMobile, glowColor: '#FFD700', glowBlur: 4
            });
        }

        const coinFlash = this.hudFlash.coins > 0;
        this.drawText(ctx, `C ${this.fmtNum(this.playerData.coins)}`, W-10, 17, {
            size: coinFlash ? 11 : 10, weight: 'bold',
            color: coinFlash ? '#FFFFFF' : '#FFD700',
            align: 'right', family: this.FONT_UI
        });

        const diaFlash = this.hudFlash.diamonds > 0;
        this.drawText(ctx, `D ${this.fmtNum(this.playerData.diamonds)}`, W-10, 33, {
            size: diaFlash ? 11 : 10, weight: 'bold',
            color: diaFlash ? '#FFFFFF' : '#00D4FF',
            align: 'right', family: this.FONT_UI
        });
    }

    // ============================================================
    // DRAW: POWER-UP BUTTONS
    // ============================================================
    drawPowerUpButtons(ctx) {
        const btnS = this.isMobile ? 44 : 38;
        const btnGap = 8;
        const btnY = this.H - btnS - (this.isMobile ? 12 : 10);
        let idx = 0;

        for (const [key, pup] of Object.entries(this.powerUps)) {
            const bx     = 8 + idx * (btnS + btnGap);
            const active = this.activePowerUp === key;
            const has    = pup.count > 0;

            ctx.fillStyle = active ? (pup.color + '44') : `rgba(185,79,227,${has ? 0.1 : 0.04})`;
            this.drawRoundRect(ctx, bx, btnY, btnS, btnS, 10); ctx.fill();

            ctx.strokeStyle = active ? pup.color : (has ? 'rgba(185,79,227,0.22)' : 'rgba(80,80,80,0.1)');
            ctx.lineWidth   = this.dS(active ? 1.5 : 0.5);
            this.drawRoundRect(ctx, bx, btnY, btnS, btnS, 10); ctx.stroke();

            ctx.globalAlpha = has ? 1 : 0.22;
            this.drawText(ctx, pup.icon, bx+btnS/2, btnY+btnS/2-(this.isMobile?6:5), {
                size: this.isMobile ? 19 : 15, weight: 'bold',
                color: pup.color, align: 'center', baseline: 'middle', family: this.FONT_UI
            });
            this.drawText(ctx, pup.name, bx+btnS/2, btnY+btnS-(this.isMobile?9:8), {
                size: this.isMobile ? 7 : 6, color: 'rgba(255,255,255,0.55)',
                align: 'center', baseline: 'middle', family: this.FONT_MONO
            });

            if (has) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                this.drawCircle(ctx, bx+btnS-6, btnY+6, this.isMobile ? 8 : 7); ctx.fill();
                this.drawText(ctx, `${pup.count}`, bx+btnS-6, btnY+6, {
                    size: this.isMobile ? 8 : 7, weight: 'bold', color: '#00FF88',
                    align: 'center', baseline: 'middle', family: this.FONT_UI
                });
            }
            ctx.globalAlpha = 1;
            idx++;
        }

        if (!this.isMobile) {
            this.drawText(ctx, '1=Bomb  2=Aim+  C=Color  F=Full', 8, btnY-6, {
                size: 6, color: 'rgba(255,255,255,0.15)', family: this.FONT_MONO
            });
        }
    }

    // ============================================================
    // OVERLAY HELPERS
    // ============================================================
    drawCardBG(ctx, x, y, w, h, borderColor) {
        ctx.fillStyle = 'rgba(8,5,20,0.96)';
        this.drawRoundRect(ctx, x, y, w, h, 12); ctx.fill();
        ctx.strokeStyle = borderColor + '45';
        ctx.lineWidth   = this.dS(1.5);
        this.drawRoundRect(ctx, x, y, w, h, 12); ctx.stroke();
    }

    drawBtn(ctx, cx, cy, w, h, text, c1, c2) {
        const bx = cx-w/2, by = cy-h/2;
        const grad = ctx.createLinearGradient(this.dX(bx), 0, this.dX(bx+w), 0);
        grad.addColorStop(0, c1); grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        this.drawRoundRect(ctx, bx, by, w, h, h/2); ctx.fill();
        this.drawText(ctx, text, cx, cy+1, {
            size: 13, weight: 'bold', color: '#FFF',
            align: 'center', baseline: 'middle', family: this.FONT_UI
        });
    }

    easeOutBack(t) {
        const c1=1.70158, c3=c1+1;
        return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);
    }

    drawDailyRewardScreen(ctx, W, H) {
        const a = this.dailyRewardAnim;
        ctx.fillStyle = `rgba(0,0,0,${0.85*a})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (a < 0.3) return;

        const cw = Math.min(270, W-36), ch = 240;
        const cx = (W-cw)/2, cy = (H-ch)/2;
        this.drawCardBG(ctx, cx, cy, cw, ch, '#FFD700');

        const streak = this.playerData.dailyStreak;
        const coins  = Math.floor(50*Math.min(1+streak*0.25,3));
        const dias   = Math.floor(2*Math.max(1,Math.floor(streak/3)));

        this.drawText(ctx, 'Daily Reward!', W/2, cy+36, { size:20, weight:'bold', color:'#FFD700', align:'center', family:this.FONT_UI });
        this.drawText(ctx, `Day ${streak+1} Streak`, W/2, cy+58, { size:11, color:'#00D4FF', align:'center', family:this.FONT_MONO });
        this.drawText(ctx, `${coins} Coins`, W/2, cy+95, { size:22, weight:'bold', color:'#FFD700', align:'center', family:this.FONT_UI });
        this.drawText(ctx, `${dias} Gems`, W/2, cy+124, { size:18, weight:'bold', color:'#00D4FF', align:'center', family:this.FONT_UI });
        this.drawBtn(ctx, W/2, cy+ch-38, 145, 34, 'CLAIM!', '#B94FE3', '#FF1A6D');
    }

    drawLevelCompleteScreen(ctx, W, H) {
        const prog  = Math.min(1, this.levelCompleteTimer/25);
        const eased = this.easeOutBack(prog);

        ctx.fillStyle = `rgba(0,0,0,${0.8*prog})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (prog < 0.2) return;

        const cw = Math.min(295, W-30), ch = 310;
        const cx = (W-cw)/2, cy = (H-ch)/2;

        ctx.save();
        ctx.translate(this.dX(W/2), this.dY(H/2));
        ctx.scale(eased, eased);
        ctx.translate(-this.dX(W/2), -this.dY(H/2));

        this.drawCardBG(ctx, cx, cy, cw, ch, '#00FF88');
        this.drawText(ctx, 'LEVEL COMPLETE!', W/2, cy+34, { size:19, weight:'bold', color:'#00FF88', align:'center', family:this.FONT_UI });

        for (let i=0;i<3;i++) {
            const sx = W/2+(i-1)*38;
            this.drawText(ctx, i<this.starRating ? '*' : 'o', sx, cy+68, {
                size: 26, color: i<this.starRating ? '#FFD700' : 'rgba(255,255,255,0.2)',
                align:'center', baseline:'middle', family:this.FONT_UI, opacity: i<this.starRating ? 1 : 0.2
            });
        }

        const stats = [`Score: ${this.fmtNum(this.score)}`, `Popped: ${this.bubblesPopped}`, `Combo: x${this.maxCombo}`, `Shots: ${this.shotsUsed}`];
        stats.forEach((s,i) => {
            this.drawText(ctx, s, W/2, cy+108+i*22, { size:11, color:'rgba(255,255,255,0.6)', align:'center', family:this.FONT_MONO });
        });
        this.drawText(ctx, `Coins +${this.levelCoins}`, W/2, cy+210, { size:14, weight:'bold', color:'#FFD700', align:'center', family:this.FONT_UI });
        if (this.levelDiamonds>0)
            this.drawText(ctx, `Gems +${this.levelDiamonds}`, W/2, cy+233, { size:13, weight:'bold', color:'#00D4FF', align:'center', family:this.FONT_UI });

        if (this.levelCompleteTimer>30)
            this.drawBtn(ctx, W/2, cy+ch-38, 155, 34, 'NEXT LEVEL', '#00D4FF', '#00FF88');
        ctx.restore();
    }

    drawTransition(ctx, W, H) {
        const prog  = 1-(this.levelTransitionTimer/40);
        const alpha = prog<0.5 ? prog*2 : 2-prog*2;
        ctx.fillStyle = `rgba(3,2,10,${alpha})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (prog>0.3 && prog<0.7) {
            this.drawText(ctx, `Level ${this.level}`, W/2, H/2, {
                size:22, weight:'bold', color:'#B94FE3',
                align:'center', baseline:'middle', family:this.FONT_UI,
                glow:!this.isMobile, glowColor:'#B94FE3', glowBlur:8,
                opacity: 1-Math.abs(prog-0.5)*5
            });
        }
    }

    drawGameOverScreen(ctx, W, H) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawText(ctx, 'GAME OVER', W/2, H/2-48, {
            size:26, weight:'bold', color:'#FF1A6D',
            align:'center', baseline:'middle', family:this.FONT_UI,
            glow:!this.isMobile, glowColor:'#FF1A6D', glowBlur:12
        });
        this.drawText(ctx, `Score: ${this.fmtNum(this.score)}`, W/2, H/2-4, { size:13, color:'rgba(255,255,255,0.7)', align:'center', baseline:'middle', family:this.FONT_MONO });
        this.drawText(ctx, `Level ${this.level} | Combo x${this.maxCombo}`, W/2, H/2+22, { size:10, color:'rgba(255,255,255,0.45)', align:'center', baseline:'middle', family:this.FONT_MONO });
        this.drawText(ctx, `+${this.levelCoins} Coins`, W/2, H/2+58, { size:12, weight:'bold', color:'#FFD700', align:'center', baseline:'middle', family:this.FONT_UI });
        this.drawText(ctx, `+${this.levelDiamonds} Gems`, W/2, H/2+80, { size:12, weight:'bold', color:'#00D4FF', align:'center', baseline:'middle', family:this.FONT_UI });
        const blink = 0.45+Math.sin(this.time/420)*0.4;
        this.drawText(ctx, 'Tap restart to play again', W/2, H/2+115, { size:10, color:'rgba(200,200,220,1)', align:'center', baseline:'middle', family:this.FONT_MONO, opacity:blink });
    }

    // ============================================================
    // GAME LOOP — ✅ Adaptive FPS on weak devices
    // ============================================================
    loop(timestamp) {
        if (this.destroyed) return;
        const dt = Math.min(timestamp - (this.lastTime || timestamp), 50);
        this.lastTime = timestamp;

        // ✅ MOBILE FIX: Adaptive frame skip detection
        if (this.isMobile) {
            this.fpsHistory.push(dt);
            if (this.fpsHistory.length > 30) this.fpsHistory.shift();
            if (this.fpsHistory.length === 30) {
                const avg = this.fpsHistory.reduce((a,b)=>a+b,0)/30;
                this.adaptiveMode = avg > 22; // below ~45fps = adaptive mode
            }

            if (this.adaptiveMode && this.frame % 2 === 1) {
                // Skip draw, still update
                if (!this.paused) this.update(dt);
                this.animId = requestAnimationFrame(t => this.loop(t));
                return;
            }
        }

        if (!this.paused) this.update(dt);
        this.draw();
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    togglePause() {
        this.paused   = !this.paused;
        this.isPaused = this.paused;
        return this.paused;
    }

    resize() {
        // ✅ Recalc DPR on resize too
        this.dpr = this.isMobile ? Math.min(window.devicePixelRatio||1, 1.5) : Math.min(window.devicePixelRatio||1, 2);
        this.setupHDCanvas();
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile      = this.W < 768 || ('ontouchstart' in window);
        this.isSmallScreen = this.W < 380;
        this.COLS          = this.isSmallScreen ? 8 : 10;
        this.BUBBLE_R      = this.calculateBubbleRadius();
        this.recalcGrid();
        this.shooterX = this.W / 2;
        this.shooterY = this.H - (this.isMobile ? 58 : 65);
        this.stars    = this.makeStars(this.isMobile ? 25 : 60);
        this.bgGrad   = null; // force recreate
        this.preRenderAll();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        document.removeEventListener('fullscreenchange',       this.boundFSChange);
        document.removeEventListener('webkitfullscreenchange', this.boundFSChange);
        this.cache.bubbles.clear();
        this.cache.glows.clear();
        this.savePlayerData();
    }
}