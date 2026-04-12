'use strict';

class AngryBirds {
    constructor(canvas, onScore) {
        this.canvas = canvas;
        this.onScore = onScore;
        this.destroyed = false;
        this.paused = false;
        this.isPaused = false;

        this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        this._setupHD();
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.W = this.canvas.width / this.dpr;
        this.H = this.canvas.height / this.dpr;
        this.isMobile = ('ontouchstart' in window) || window.innerWidth < 768;

        this.FT = '"Orbitron","Segoe UI",monospace';
        this.FU = '"Rajdhani",-apple-system,sans-serif';

        this.STATE = { MENU:0, WAITING:1, AIMING:2, FLYING:3, SETTLE:4, DEAD:5, WIN:6 };
        this.state = this.STATE.MENU;

        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('ab_best_v2') || '0');
        this.level = 1;

        this.GRAVITY     = 0.32;
        this.RESTITUTION = 0.3;
        this.FRICTION    = 0.9;
        this.GROUND      = this.H - 52;

        this.sling = {
            x: this.W * 0.18,
            y: this.GROUND - 55,
            rx: 0, ry: 0,
            pulled: false,
            maxPull: 85,
            power: 0.28
        };

        this.BIRD_TYPES = [
            { id:'red',    col:'#FF2D4E', light:'#FF8899', dark:'#AA0022', r:14, special:'none',      name:'Red'    },
            { id:'blue',   col:'#00AAFF', light:'#88DDFF', dark:'#0055AA', r:11, special:'split',     name:'Blue'   },
            { id:'yellow', col:'#FFD700', light:'#FFEE88', dark:'#AA8800', r:13, special:'boost',     name:'Yellow' },
            { id:'black',  col:'#334455', light:'#667788', dark:'#111822', r:17, special:'bomb',      name:'Black'  },
            { id:'white',  col:'#DDDDEF', light:'#FFFFFF', dark:'#9999BB', r:14, special:'egg',       name:'White'  },
            { id:'green',  col:'#22CC44', light:'#88FF99', dark:'#005522', r:13, special:'boomerang', name:'Green'  }
        ];

        this.birdQueue   = [];
        this.bird        = null;
        this.activeBirds = [];

        this.PIGTYPE = [
            { col:'#44CC22', light:'#88FF55', dark:'#116600', hp:1, r:14, pts:500  },
            { col:'#33AA11', light:'#66EE44', dark:'#0A5500', hp:2, r:17, pts:800  },
            { col:'#228800', light:'#55CC22', dark:'#083300', hp:3, r:20, pts:1200 }
        ];
        this.pigs = [];

        this.BTYPE = {
            wood:  { col:'#B8944A', light:'#D8B86A', dark:'#786020', hp:3, density:1.0 },
            stone: { col:'#787888', light:'#9999AA', dark:'#444450', hp:6, density:2.5 },
            ice:   { col:'#AACCEE', light:'#DDEEFF', dark:'#5588AA', hp:2, density:0.6 },
            plank: { col:'#A07030', light:'#C09050', dark:'#604010', hp:4, density:1.2 }
        };
        this.blocks = [];

        this.parts   = [];
        this.pops    = [];
        this.rings   = [];
        this.debris  = [];
        this.MAX_PARTS = this.isMobile ? 55 : 110;

        this.camX       = 0;
        this.targetCamX = 0;
        this.worldW     = this.W * 2;

        this.shakeX = 0; this.shakeY = 0; this.shakeT = 0; this.shakeF = 0;
        this.flashA = 0; this.flashC = '#fff';
        this.overlayA = 0;

        this.time = 0; this.bgTime = 0; this.menuTime = 0;
        this.settleTimer = 0;

        // Win delay timer — gives time for pig death effects before checking win
        this.winCheckDelay = 0;
        this.allPigsDead = false;

        this.clouds    = this._mkClouds(8);
        this.stars     = this._mkStars(50);
        this.mountains = this._mkMountains();

        this.trajDots = [];
        this.fsRect = { x:0, y:0, w:44, h:44 };
        this._lastSounds = {};

        this._bind();
        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this._loop(t));
    }

    _setupHD() {
        const r = this.canvas.getBoundingClientRect();
        const w = r.width  || this.canvas.clientWidth  || 480;
        const h = r.height || this.canvas.clientHeight || 700;
        this.canvas.width  = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
        this.canvas.style.width  = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    S(v) { return v * this.dpr; }
    X(v) { return Math.round(v * this.dpr); }

    _sfx(name, cooldownMs = 80) {
        if (!window.audioManager) return;
        const now = performance.now();
        if (this._lastSounds[name] && now - this._lastSounds[name] < cooldownMs) return;
        this._lastSounds[name] = now;
        try { audioManager.play(name); } catch(e) {}
    }

    _utxt(text, x, y, o = {}) {
        const ctx = this.ctx;
        const { sz=14, wt='bold', col='#fff', al='left', bl='alphabetic',
                ff=null, op=1, stroke=false, sc='rgba(0,0,0,0.75)', sw=3 } = o;
        if (op <= 0) return;
        ctx.save();
        ctx.globalAlpha  = Math.min(1, op);
        ctx.textAlign    = al;
        ctx.textBaseline = bl;
        ctx.font = `${wt} ${Math.round(sz * this.dpr)}px ${ff || (sz > 14 ? this.FT : this.FU)}`;
        const px = this.X(x), py = this.X(y);
        if (stroke) {
            ctx.strokeStyle = sc; ctx.lineWidth = sw * this.dpr;
            ctx.lineJoin = 'round'; ctx.strokeText(text, px, py);
        }
        ctx.shadowBlur = 0; ctx.fillStyle = col;
        ctx.fillText(text, px, py);
        ctx.restore();
    }

    _ctxt(text, x, y, o = {}) {
        this._utxt(text, x - this.camX, y, o);
    }

    _circle(x, y, r, cam = true) {
        const cx = cam ? x - this.camX : x;
        this.ctx.beginPath();
        this.ctx.arc(this.X(cx), this.X(y), Math.max(0.5, this.S(r)), 0, Math.PI * 2);
    }

    _rrect(x, y, w, h, r, cam = false) {
        const ctx = this.ctx;
        const cx = cam ? x - this.camX : x;
        const dx = this.X(cx), dy = this.X(y);
        const dw = Math.round(w * this.dpr), dh = Math.round(h * this.dpr);
        const dr = Math.min(this.S(r), dw / 2, dh / 2);
        ctx.beginPath();
        ctx.moveTo(dx + dr, dy);
        ctx.arcTo(dx + dw, dy, dx + dw, dy + dh, dr);
        ctx.arcTo(dx + dw, dy + dh, dx, dy + dh, dr);
        ctx.arcTo(dx, dy + dh, dx, dy, dr);
        ctx.arcTo(dx, dy, dx + dw, dy, dr);
        ctx.closePath();
    }

    _fillRect(x, y, w, h, cam = true) {
        const cx = cam ? x - this.camX : x;
        this.ctx.fillRect(this.X(cx), this.X(y), Math.round(w * this.dpr), Math.round(h * this.dpr));
    }

    _mkStars(n) {
        return Array.from({length:n}, () => ({
            x: Math.random() * (this.W * 3), y: Math.random() * this.H * 0.52,
            r: Math.random() * 1.3 + 0.2, ph: Math.random() * 6.28,
            sp: Math.random() * 0.012 + 0.003
        }));
    }

    _mkClouds(n) {
        return Array.from({length:n}, (_,i) => ({
            x: (this.W * 3 / n) * i + Math.random() * 100,
            y: Math.random() * this.H * 0.3 + 15,
            w: Math.random() * 85 + 55, h: Math.random() * 26 + 16,
            spd: Math.random() * 0.12 + 0.04,
            alpha: Math.random() * 0.2 + 0.08
        }));
    }

    _mkMountains() {
        const pts = []; let x = 0;
        while (x < this.W * 3) {
            pts.push({
                x, h: Math.random() * 80 + 30,
                w: Math.random() * 120 + 60,
                col: `rgba(${20+Math.random()*20},${40+Math.random()*30},${20+Math.random()*15},${Math.random()*0.12+0.06})`
            });
            x += Math.random() * 80 + 50;
        }
        return pts;
    }

    _getLevels() {
        return [
            {
                birds: ['red','red','red'],
                pigs: [{ x:0, y:0, type:0 }],
                structures: [
                    { type:'wood',  x:-35, y:0,   w:70, h:12 },
                    { type:'wood',  x:-35, y:-55, w:10, h:55 },
                    { type:'wood',  x:25,  y:-55, w:10, h:55 },
                    { type:'plank', x:-42, y:-62, w:84, h:10 },
                    { type:'wood',  x:-30, y:-80, w:10, h:22 },
                    { type:'wood',  x:20,  y:-80, w:10, h:22 },
                    { type:'plank', x:-38, y:-85, w:76, h:8  }
                ]
            },
            {
                birds: ['red','yellow','blue'],
                pigs: [{ x:0, y:0, type:0 }, { x:120, y:0, type:1 }],
                structures: [
                    { type:'stone', x:-30,  y:0,   w:60, h:10 },
                    { type:'stone', x:-30,  y:-50, w:10, h:50 },
                    { type:'stone', x:20,   y:-50, w:10, h:50 },
                    { type:'wood',  x:-38,  y:-58, w:76, h:10 },
                    { type:'wood',  x:-24,  y:-78, w:10, h:24 },
                    { type:'wood',  x:14,   y:-78, w:10, h:24 },
                    { type:'plank', x:-32,  y:-84, w:64, h:8  },
                    { type:'wood',  x:90,   y:0,   w:60, h:10 },
                    { type:'wood',  x:90,   y:-46, w:10, h:46 },
                    { type:'wood',  x:140,  y:-46, w:10, h:46 },
                    { type:'plank', x:84,   y:-54, w:72, h:10 },
                    { type:'plank', x:98,   y:-72, w:44, h:8  }
                ]
            },
            {
                birds: ['yellow','black','red','blue'],
                pigs: [
                    { x:0,   y:0,   type:1 },
                    { x:145, y:0,   type:0 },
                    { x:145, y:-60, type:0 },
                    { x:290, y:0,   type:2 }
                ],
                structures: [
                    { type:'stone', x:-28, y:0,   w:56, h:12 },
                    { type:'stone', x:-28, y:-68, w:12, h:68 },
                    { type:'stone', x:16,  y:-68, w:12, h:68 },
                    { type:'stone', x:-34, y:-76, w:68, h:10 },
                    { type:'stone', x:-22, y:-100,w:10, h:28 },
                    { type:'stone', x:12,  y:-100,w:10, h:28 },
                    { type:'plank', x:-28, y:-106,w:56, h:8  },
                    { type:'wood',  x:112, y:0,   w:66, h:10 },
                    { type:'wood',  x:112, y:-48, w:10, h:48 },
                    { type:'wood',  x:168, y:-48, w:10, h:48 },
                    { type:'plank', x:108, y:-54, w:74, h:8  },
                    { type:'wood',  x:118, y:-90, w:10, h:38 },
                    { type:'wood',  x:162, y:-90, w:10, h:38 },
                    { type:'plank', x:112, y:-96, w:66, h:8  },
                    { type:'ice',   x:258, y:0,   w:64, h:10 },
                    { type:'ice',   x:258, y:-58, w:10, h:58 },
                    { type:'ice',   x:312, y:-58, w:10, h:58 },
                    { type:'ice',   x:252, y:-65, w:76, h:10 },
                    { type:'ice',   x:270, y:-88, w:10, h:28 },
                    { type:'ice',   x:300, y:-88, w:10, h:28 },
                    { type:'plank', x:264, y:-94, w:52, h:8  }
                ]
            },
            {
                birds: ['black','red','yellow','green','blue'],
                pigs: [
                    { x:0,   y:0,   type:2 },
                    { x:100, y:0,   type:1 },
                    { x:200, y:0,   type:1 },
                    { x:300, y:0,   type:0 },
                    { x:150, y:-80, type:0 }
                ],
                structures: [
                    { type:'stone', x:-30, y:0,   w:60, h:12 },
                    { type:'stone', x:-30, y:-80, w:12, h:80 },
                    { type:'stone', x:18,  y:-80, w:12, h:80 },
                    { type:'stone', x:-36, y:-88, w:72, h:10 },
                    { type:'stone', x:-20, y:-108,w:10, h:24 },
                    { type:'stone', x:10,  y:-108,w:10, h:24 },
                    { type:'plank', x:-26, y:-114,w:52, h:8  },
                    { type:'wood',  x:70,  y:0,   w:60, h:10 },
                    { type:'wood',  x:70,  y:-55, w:10, h:55 },
                    { type:'wood',  x:120, y:-55, w:10, h:55 },
                    { type:'plank', x:64,  y:-62, w:72, h:8  },
                    { type:'ice',   x:170, y:0,   w:60, h:10 },
                    { type:'ice',   x:170, y:-55, w:10, h:55 },
                    { type:'ice',   x:220, y:-55, w:10, h:55 },
                    { type:'plank', x:164, y:-62, w:72, h:8  },
                    { type:'wood',  x:100, y:-88, w:10, h:30 },
                    { type:'wood',  x:130, y:-88, w:10, h:30 },
                    { type:'plank', x:94,  y:-94, w:52, h:8  },
                    { type:'stone', x:270, y:0,   w:60, h:12 },
                    { type:'stone', x:270, y:-70, w:10, h:70 },
                    { type:'stone', x:320, y:-70, w:10, h:70 },
                    { type:'plank', x:264, y:-76, w:72, h:8  }
                ]
            },
            {
                birds: ['green','black','white','yellow','red','blue'],
                pigs: [
                    { x:0,   y:0,   type:2 },
                    { x:80,  y:0,   type:2 },
                    { x:200, y:0,   type:1 },
                    { x:320, y:0,   type:1 },
                    { x:150, y:-80, type:0 },
                    { x:260, y:-60, type:0 }
                ],
                structures: [
                    { type:'stone', x:-35, y:0,   w:70, h:12 },
                    { type:'stone', x:-35, y:-90, w:12, h:90 },
                    { type:'stone', x:23,  y:-90, w:12, h:90 },
                    { type:'stone', x:-42, y:-98, w:84, h:10 },
                    { type:'plank', x:-30, y:-116,w:60, h:8  },
                    { type:'stone', x:-22, y:-120,w:10, h:28 },
                    { type:'stone', x:12,  y:-120,w:10, h:28 },
                    { type:'plank', x:-28, y:-126,w:56, h:8  },
                    { type:'stone', x:45,  y:0,   w:70, h:12 },
                    { type:'stone', x:45,  y:-90, w:12, h:90 },
                    { type:'stone', x:103, y:-90, w:12, h:90 },
                    { type:'stone', x:39,  y:-98, w:84, h:10 },
                    { type:'plank', x:50,  y:-116,w:60, h:8  },
                    { type:'wood',  x:110, y:0,   w:60, h:10 },
                    { type:'wood',  x:110, y:-60, w:10, h:60 },
                    { type:'wood',  x:160, y:-60, w:10, h:60 },
                    { type:'plank', x:104, y:-66, w:72, h:8  },
                    { type:'wood',  x:120, y:-96, w:10, h:32 },
                    { type:'wood',  x:148, y:-96, w:10, h:32 },
                    { type:'plank', x:114, y:-102,w:52, h:8  },
                    { type:'ice',   x:175, y:0,   w:60, h:10 },
                    { type:'ice',   x:175, y:-70, w:10, h:70 },
                    { type:'ice',   x:225, y:-70, w:10, h:70 },
                    { type:'plank', x:169, y:-76, w:72, h:8  },
                    { type:'ice',   x:235, y:-62, w:10, h:64 },
                    { type:'ice',   x:285, y:-62, w:10, h:64 },
                    { type:'plank', x:229, y:-68, w:72, h:8  },
                    { type:'stone', x:290, y:0,   w:60, h:12 },
                    { type:'stone', x:290, y:-75, w:10, h:75 },
                    { type:'stone', x:340, y:-75, w:10, h:75 },
                    { type:'plank', x:284, y:-81, w:72, h:8  }
                ]
            }
        ];
    }

    _loadLevel() {
        this.birdQueue   = [];
        this.pigs        = [];
        this.blocks      = [];
        this.bird        = null;
        this.activeBirds = [];
        this.debris      = [];
        this.parts = []; this.pops = []; this.rings = [];
        this.trajDots    = [];
        this.settleTimer = 0;
        this.overlayA    = 0;
        this.camX        = 0;
        this.targetCamX  = 0;
        this.allPigsDead = false;
        this.winCheckDelay = 0;

        const levels = this._getLevels();
        const lvl    = levels[(this.level - 1) % levels.length];
        const baseX  = this.W * 0.6;

        lvl.birds.forEach(bt => {
            const bd = this.BIRD_TYPES.find(b => b.id === bt) || this.BIRD_TYPES[0];
            this.birdQueue.push({ ...bd });
        });

        lvl.pigs.forEach((p, pi) => {
            const pt = this.PIGTYPE[Math.min(p.type||0, this.PIGTYPE.length-1)];
            const px = baseX + p.x + pi * 10;
            const py = p.y ? this.GROUND + p.y - pt.r : this.GROUND - pt.r;
            this.pigs.push({
                x:px, y:py, vx:0, vy:0,
                r:pt.r, hp:pt.hp, maxHp:pt.hp,
                col:pt.col, light:pt.light, dark:pt.dark,
                pts:pt.pts, hitAnim:0, dead:false,
                phase: Math.random() * 6.28
            });
        });

        lvl.structures.forEach(s => {
            const bt = this.BTYPE[s.type] || this.BTYPE.wood;
            const bx = baseX + s.x + s.w / 2;
            const by = this.GROUND + s.y - s.h / 2;
            this.blocks.push({
                x:bx, y:by, w:s.w, h:s.h,
                vx:0, vy:0, angle:0, angV:0,
                col:bt.col, light:bt.light, dark:bt.dark,
                type:s.type, hp:bt.hp, maxHp:bt.hp,
                density:bt.density, dead:false, hitAnim:0,
                crackseed: Math.random() * 100
            });
        });

        this._nextBird();
        this.state = this.STATE.WAITING;
    }

    _nextBird() {
        if (this.birdQueue.length === 0) { this.bird = null; return; }

        const bd = this.birdQueue.shift();
        const startX = this.sling.x - 36;
        const startY = this.GROUND - bd.r;

        this.bird = {
            ...bd,
            x: startX,
            y: startY,
            vx: 0, vy: 0,
            launched: false, dead: false,
            hitAnim: 0, specialUsed: false,
            trail: [], phase: 0, explodeTimer: -1,
            groundBounces: 0,
            enterAnim:    1.0,
            enterStartX:  startX,
            enterStartY:  startY,
            enterTargetX: this.sling.x,
            enterTargetY: this.sling.y
        };

        this.sling.rx = 0; this.sling.ry = 0;
        this.sling.pulled = false;
        this.trajDots = [];
    }

    _bind() {
        this._onTS = e => { e.preventDefault(); this._processInput(this._evPos(e.touches[0])); };
        this._onTM = e => { e.preventDefault(); if (this.state===this.STATE.AIMING) this._moveDrag(this._evPos(e.touches[0])); };
        this._onTE = e => { e.preventDefault(); if (this.state===this.STATE.AIMING) this._releaseDrag(); };
        this._onMD = e => { this._processInput(this._evPos(e)); };
        this._onMM = e => { if (this.state===this.STATE.AIMING) this._moveDrag(this._evPos(e)); };
        this._onMU = () => { if (this.state===this.STATE.AIMING) this._releaseDrag(); };

        this.canvas.addEventListener('touchstart', this._onTS, {passive:false});
        this.canvas.addEventListener('touchmove',  this._onTM, {passive:false});
        this.canvas.addEventListener('touchend',   this._onTE, {passive:false});
        this.canvas.addEventListener('mousedown',  this._onMD);
        this.canvas.addEventListener('mousemove',  this._onMM);
        this.canvas.addEventListener('mouseup',    this._onMU);
    }

    _evPos(e) {
        const r = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (this.W / r.width),
            y: (e.clientY - r.top)  * (this.H / r.height)
        };
    }

    _processInput(pos) {
        const f = this.fsRect;
        if (pos.x>=f.x && pos.x<=f.x+f.w && pos.y>=f.y && pos.y<=f.y+f.h) {
            this._toggleFS(); return;
        }
        if (this.state === this.STATE.MENU)    { this._startNewGame(); return; }
        if (this.state === this.STATE.WAITING || this.state === this.STATE.AIMING) {
            this.state = this.STATE.AIMING;
            this._startDrag(pos); return;
        }
        if (this.state === this.STATE.FLYING)  { this._useSpecial(); return; }

        // DEAD or WIN overlay — tap to proceed
        if (this.state === this.STATE.DEAD && this.overlayA > 0.7) {
            // Retry same level
            this.score = 0; this.onScore(0);
            this._loadLevel();
            return;
        }
        if (this.state === this.STATE.WIN && this.overlayA > 0.7) {
            // Next level!
            this.level++;
            this._loadLevel();
            return;
        }
    }

    _startDrag(pos) {
        if (!this.bird || this.bird.launched) return;
        if (this.bird.enterAnim > 0.08) return;
        const dx = pos.x - this.sling.x, dy = pos.y - this.sling.y;
        if (Math.hypot(dx, dy) < 60) this.sling.pulled = true;
    }

    _moveDrag(pos) {
        if (!this.sling.pulled || !this.bird) return;
        let dx = pos.x - this.sling.x;
        let dy = pos.y - this.sling.y;
        if (dx > 15) dx = 15;
        const dist = Math.hypot(dx, dy);
        if (dist > this.sling.maxPull) { const s = this.sling.maxPull/dist; dx*=s; dy*=s; }
        this.sling.rx = dx; this.sling.ry = dy;
        this.bird.x = this.sling.x + dx;
        this.bird.y = this.sling.y + dy;
        this._calcTrajectory();
    }

    _releaseDrag() {
        if (!this.bird || !this.sling.pulled) return;
        const pullDist = Math.hypot(this.sling.rx, this.sling.ry);
        if (pullDist < 12) {
            this.bird.x = this.sling.x; this.bird.y = this.sling.y;
            this.sling.rx = 0; this.sling.ry = 0;
            this.sling.pulled = false;
            this.trajDots = [];
            this.state = this.STATE.WAITING; return;
        }
        this.bird.vx = -this.sling.rx * this.sling.power;
        this.bird.vy = -this.sling.ry * this.sling.power;
        this.bird.launched = true;
        this.sling.pulled  = false;
        this.sling.rx = 0; this.sling.ry = 0;
        this.state = this.STATE.FLYING;
        this.trajDots = [];
        this._burstAt(this.bird.x, this.bird.y, this.bird.col, 8);
        this.rings.push({x:this.bird.x, y:this.bird.y, r:this.bird.r, a:0.55, col:this.bird.col});
        this._sfx('shoot', 50);
    }

    _calcTrajectory() {
        const dots = [];
        let x=this.bird.x, y=this.bird.y;
        let vx=-this.sling.rx*this.sling.power, vy=-this.sling.ry*this.sling.power;
        for (let i=0; i<40; i++) {
            vx*=0.997; vy+=this.GRAVITY; x+=vx; y+=vy;
            if (y>this.GROUND) break;
            if (i%2===0) dots.push({x,y,a:1-i/40});
        }
        this.trajDots = dots;
    }

    _useSpecial() {
        if (!this.bird || !this.bird.launched || this.bird.specialUsed || this.bird.dead) return;
        this.bird.specialUsed = true;
        switch (this.bird.special) {
            case 'split':     this._doSplit();     break;
            case 'boost':     this._doBoost();     break;
            case 'bomb':      this._doBomb();      break;
            case 'egg':       this._doEgg();       break;
            case 'boomerang': this._doBoomerang(); break;
        }
        this._sfx('powerup', 100);
    }

    _doSplit() {
        const b = this.bird;
        const spd = Math.hypot(b.vx, b.vy);
        const ang = Math.atan2(b.vy, b.vx);
        const bd  = this.BIRD_TYPES.find(bt => bt.id==='blue');
        [-20,20].forEach(deg => {
            const a = ang + deg*Math.PI/180;
            this.activeBirds.push({
                ...bd, x:b.x, y:b.y,
                vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
                launched:true, dead:false, hitAnim:0,
                specialUsed:true, trail:[], phase:0,
                explodeTimer:-1, groundBounces:0
            });
        });
        this._burstAt(b.x, b.y, '#00AAFF', 12);
    }

    _doBoost() {
        const b   = this.bird;
        const ang = Math.atan2(b.vy, b.vx);
        const spd = Math.hypot(b.vx, b.vy) * 2.6;
        b.vx = Math.cos(ang)*spd; b.vy = Math.sin(ang)*spd*0.25;
        this._burstAt(b.x, b.y, '#FFD700', 14);
    }

    _doBomb() {
        this.bird.explodeTimer = 50;
        this._burstAt(this.bird.x, this.bird.y, '#FF4400', 8);
    }

    _doEgg() {
        this._explodeAt(this.bird.x, this.bird.y+30, 65, '#EEEEFF');
    }

    _doBoomerang() {
        const b = this.bird;
        b.vx = -Math.abs(b.vx)*1.3; b.vy *= 0.3;
        this._burstAt(b.x, b.y, '#22CC44', 12);
    }

    /* ══════════════════ HELPER: Are all pigs dead? ══════════════════ */

    _allPigsAreDead() {
        return this.pigs.every(p => p.dead);
    }

    /* ══════════════════ PHYSICS ══════════════════ */

    _updatePhysics(dt) {
        const spd = dt / 16.67;

        // Main bird
        if (this.bird && this.bird.launched && !this.bird.dead) {
            this._stepBird(this.bird, spd);
            this.bird.trail.push({x:this.bird.x, y:this.bird.y, a:1});
            if (this.bird.trail.length > 18) this.bird.trail.shift();
            this.bird.trail.forEach(t => t.a -= 0.055);
            this.bird.trail = this.bird.trail.filter(t => t.a > 0);
            this._checkBirdHits(this.bird);

            if (this.bird.explodeTimer > 0) {
                this.bird.explodeTimer--;
                if (this.bird.explodeTimer === 0) {
                    this._explodeAt(this.bird.x, this.bird.y, 85, '#FF4400');
                    this.bird.dead = true;
                }
            }
            if (this.bird.x < -200 || this.bird.x > this.worldW+200) this.bird.dead = true;

            if (this.bird.dead) {
                this._onBirdDone();
            }
        }

        // Active split birds
        for (let i = this.activeBirds.length-1; i >= 0; i--) {
            const ab = this.activeBirds[i];
            if (!ab.launched || ab.settled) continue;
            this._stepBird(ab, spd);
            this._checkBirdHits(ab);
            if (ab.y > this.GROUND+80 || ab.dead) ab.settled = true;
        }

        // Blocks
        this.blocks.forEach(bl => {
            if (bl.dead) return;
            bl.vy  += this.GRAVITY*0.7*spd;
            bl.x   += bl.vx*spd; bl.y += bl.vy*spd;
            bl.angle += bl.angV*spd;
            bl.angV  *= Math.pow(0.94, spd);
            bl.vx    *= Math.pow(this.FRICTION, spd);
            bl.hitAnim = Math.max(0, bl.hitAnim-0.05*spd);
            if (bl.y+bl.h/2 >= this.GROUND) {
                bl.y  = this.GROUND - bl.h/2;
                bl.vy *= -this.RESTITUTION;
                bl.vx *= this.FRICTION;
                bl.angV *= 0.6;
                if (Math.abs(bl.vy) < 0.6) bl.vy = 0;
            }
        });
        this.blocks = this.blocks.filter(bl => !bl.dead);

        for (let i=0; i<this.blocks.length; i++)
            for (let j=i+1; j<this.blocks.length; j++)
                this._blockBlockCollide(this.blocks[i], this.blocks[j]);

        // Pigs
        this.pigs.forEach(pg => {
            if (pg.dead) return;
            pg.phase   += 0.035*spd;
            pg.hitAnim  = Math.max(0, pg.hitAnim-0.045*spd);
            pg.vy      += this.GRAVITY*0.4*spd;
            pg.x       += pg.vx*spd; pg.y += pg.vy*spd;
            pg.vx      *= Math.pow(this.FRICTION, spd);
            if (pg.y+pg.r >= this.GROUND) {
                pg.y   = this.GROUND - pg.r;
                pg.vy *= -this.RESTITUTION;
                if (Math.abs(pg.vy) < 0.4) pg.vy = 0;
            }
        });

        // Debris
        this.debris = this.debris.filter(d => {
            d.x+=d.vx*spd; d.y+=d.vy*spd;
            d.vy+=0.3*spd; d.angle+=d.av*spd;
            d.life-=0.02*spd;
            return d.life>0 && d.y<this.GROUND+40;
        });
    }

    _stepBird(b, spd) {
        b.phase  += 0.07*spd;
        b.vx     *= Math.pow(0.998, spd);
        b.vy     += this.GRAVITY*spd;
        b.x      += b.vx*spd; b.y += b.vy*spd;
        b.hitAnim = Math.max(0, b.hitAnim-0.055*spd);

        if (b.y+b.r >= this.GROUND) {
            b.y = this.GROUND-b.r;
            b.vy *= -this.RESTITUTION*0.45;
            b.vx *= this.FRICTION*0.85;
            b.groundBounces = (b.groundBounces||0)+1;
            b.hitAnim = 0.4;
            this._sfx('bounce', 120);
            if (b.groundBounces >= 3 || Math.abs(b.vy) < 0.8) b.dead = true;
        }
    }

    _checkBirdHits(b) {
        if (b.dead) return;
        const bspd = Math.hypot(b.vx, b.vy);

        this.pigs.forEach((pg, i) => {
            if (pg.dead) return;
            const d = Math.hypot(b.x-pg.x, b.y-pg.y);
            if (d < b.r+pg.r) {
                const dmg = Math.max(1, Math.floor(bspd*0.25));
                pg.hp -= dmg; pg.hitAnim = 1;
                pg.vx += b.vx*0.35; pg.vy += b.vy*0.35-1.5;
                b.vx *= -0.25; b.vy *= -0.25; b.hitAnim = 1;
                this._sfx('hit', 80);
                if (pg.hp <= 0) this._killPig(i);
                else this._burstAt(pg.x, pg.y, pg.col, 4);
            }
        });

        this.blocks.forEach((bl, i) => {
            if (bl.dead) return;
            const nx = Math.max(bl.x-bl.w/2, Math.min(b.x, bl.x+bl.w/2));
            const ny = Math.max(bl.y-bl.h/2, Math.min(b.y, bl.y+bl.h/2));
            const d  = Math.hypot(b.x-nx, b.y-ny);
            if (d < b.r) {
                const dmg = Math.max(1, Math.floor(bspd*0.2/bl.density));
                bl.hp -= dmg; bl.hitAnim = 1;
                bl.vx += b.vx*0.12/bl.density;
                bl.vy += b.vy*0.12/bl.density-0.6;
                bl.angV += (Math.random()-.5)*0.15;
                b.vx *= -0.22; b.vy *= -0.22; b.hitAnim = 1;
                this._sfx('hit', 80);
                if (bl.hp <= 0) this._destroyBlock(bl, i);
                else this._burstAt(nx, ny, bl.col, 3);
            }
        });
    }

    _blockBlockCollide(a, b) {
        if (a.dead||b.dead) return;
        const ax1=a.x-a.w/2, ax2=a.x+a.w/2, ay1=a.y-a.h/2, ay2=a.y+a.h/2;
        const bx1=b.x-b.w/2, bx2=b.x+b.w/2, by1=b.y-b.h/2, by2=b.y+b.h/2;
        if (ax1<bx2&&ax2>bx1&&ay1<by2&&ay2>by1) {
            const ox=Math.min(ax2-bx1,bx2-ax1), oy=Math.min(ay2-by1,by2-ay1);
            if (ox<oy) {
                const dir=a.x<b.x?-1:1;
                a.x+=dir*ox*0.5; b.x-=dir*ox*0.5;
                a.vx*=-0.3; b.vx*=-0.3;
            } else {
                const dir=a.y<b.y?-1:1;
                a.y+=dir*oy*0.5; b.y-=dir*oy*0.5;
                a.vy*=-0.3; b.vy*=-0.3;
            }
        }
    }

    _destroyBlock(bl, idx) {
        bl.dead = true;
        this._burstAt(bl.x, bl.y, bl.col, 10);
        this.score += 100; this.onScore(this.score);
        this.pops.push({x:bl.x, y:bl.y-15, text:'+100', col:bl.col, life:900, op:1});
        for (let i=0; i<4; i++) {
            this.debris.push({
                x: bl.x+(Math.random()-.5)*bl.w,
                y: bl.y+(Math.random()-.5)*bl.h,
                vx: (Math.random()-.5)*6,
                vy: -Math.random()*5-2,
                w: bl.w*0.3, h: bl.h*0.3,
                angle: Math.random()*Math.PI,
                av: (Math.random()-.5)*0.3,
                col: bl.col, life: 1
            });
        }
        this._sfx('pop', 60);
    }

    _killPig(idx) {
        const pg = this.pigs[idx];
        if (!pg || pg.dead) return;
        pg.dead = true;

        const bonus = this.birdQueue.length * 200;
        const pts   = pg.pts + bonus;
        this.score += pts;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('ab_best_v2', this.bestScore);
        }
        this.onScore(this.score);
        this._burstAt(pg.x, pg.y, '#44FF22', 18);
        this.rings.push({x:pg.x, y:pg.y, r:pg.r, a:0.9, col:'#22CC44'});
        this.pops.push({x:pg.x, y:pg.y-22, text:`+${pts}`, col:'#FFD700', life:1400, op:1});
        this._shake(14, 10);
        this.flashA = 0.12; this.flashC = '#22CC44';
        this._sfx('success', 50);

        // Mark that all pigs are dead — will be checked in settle phase
        if (this._allPigsAreDead()) {
            this.allPigsDead = true;
        }
    }

    _explodeAt(x, y, radius, col) {
        this._burstAt(x, y, col, 24);
        this._burstAt(x, y, '#FF8800', 12);
        this.rings.push({x,y,r:6,a:1,col});
        this.rings.push({x,y,r:6,a:0.7,col:'#FF8800'});
        this._shake(20, 14);
        this.flashA = 0.28; this.flashC = col;
        this._sfx('explosion', 100);

        this.pigs.forEach((pg,i) => {
            if (pg.dead) return;
            if (Math.hypot(pg.x-x, pg.y-y) < radius+pg.r) this._killPig(i);
        });
        this.blocks.forEach((bl,i) => {
            if (bl.dead) return;
            const d = Math.hypot(bl.x-x, bl.y-y);
            if (d < radius+Math.max(bl.w,bl.h)) {
                bl.hp -= 3;
                const ang = Math.atan2(bl.y-y, bl.x-x);
                bl.vx += Math.cos(ang)*8; bl.vy += Math.sin(ang)*8-3;
                bl.angV += (Math.random()-.5)*0.4;
                if (bl.hp <= 0) this._destroyBlock(bl, i);
            }
        });
    }

    /* ══════════════════ BIRD DONE — ENTER SETTLE ══════════════════ */

    _onBirdDone() {
        if (this.state === this.STATE.SETTLE || this.state === this.STATE.WIN || this.state === this.STATE.DEAD) return;
        this.state = this.STATE.SETTLE;
        this.settleTimer = 90; // ~1.5 seconds for things to settle
    }

    /* ══════════════════ WIN ══════════════════ */

    _doWin() {
        if (this.state === this.STATE.WIN) return;

        this.state = this.STATE.WIN;
        const bonus = this.birdQueue.length * 1000;
        if (bonus > 0) { this.score += bonus; this.onScore(this.score); }
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('ab_best_v2', this.bestScore);
        }
        this.overlayA = 0;
        this._sfx('win', 100);
    }

    /* ══════════════════ GAME OVER ══════════════════ */

    _doGameOver() {
        if (this.state === this.STATE.DEAD || this.state === this.STATE.WIN) return;

        this.state = this.STATE.DEAD;
        this.overlayA = 0;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('ab_best_v2', this.bestScore);
        }
        this._sfx('gameOver', 100);
    }

    _startNewGame() {
        this.score = 0; this.onScore(0);
        this.level = 1;
        this._loadLevel();
    }

    _burstAt(x, y, col, n) {
        for (let i=0; i<n && this.parts.length<this.MAX_PARTS; i++) {
            const a=Math.random()*Math.PI*2, sp=Math.random()*5.5+1.5;
            this.parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,r:Math.random()*4.5+1.5,life:1,dec:0.03,col,g:0.14});
        }
    }

    _shake(t, f) { this.shakeT=t; this.shakeF=f; }

    _toggleFS() {
        const el = document.documentElement;
        const isFS = !!(document.fullscreenElement||document.webkitFullscreenElement);
        if (!isFS) { (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el); }
        else       { (document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document); }
        setTimeout(() => this.resize(), 200);
    }

    /* ══════════════════ MAIN UPDATE ══════════════════ */

    update(ts, dt) {
        if (this.paused) return;
        this.time += dt; this.bgTime += dt*0.001; this.menuTime += dt*0.001;
        this.stars.forEach(s => s.ph += s.sp);

        if (this.shakeT > 0) {
            const f = this.shakeF*(this.shakeT/18);
            this.shakeX=(Math.random()-.5)*f; this.shakeY=(Math.random()-.5)*f*0.4;
            this.shakeT--;
        } else { this.shakeX=0; this.shakeY=0; }

        if (this.flashA > 0) this.flashA = Math.max(0, this.flashA-0.03);

        this.clouds.forEach(c => {
            c.x -= c.spd*(dt/16.67);
            if (c.x < -c.w*2) c.x = this.W*3+c.w;
        });

        if (this.state === this.STATE.MENU) return;

        // Overlay fade-in for end screens
        if (this.state === this.STATE.DEAD || this.state === this.STATE.WIN) {
            this.overlayA = Math.min(1, this.overlayA + 0.018);
            return;
        }

        if (this.state === this.STATE.WAITING) {
            this._updateEnterAnim(dt);
            return;
        }

        if (this.state === this.STATE.AIMING) {
            this._updateEnterAnim(dt);
        }

        if (this.state === this.STATE.FLYING || this.state === this.STATE.SETTLE) {
            this._updatePhysics(dt);
        }

        // Camera follow
        if (this.bird && this.bird.launched && !this.bird.dead) {
            this.targetCamX = Math.max(0, Math.min(this.bird.x - this.W*0.3, this.worldW-this.W));
        }
        this.camX += (this.targetCamX - this.camX) * 0.065;

        /* ═══════════════════════════════════════════════
           SETTLE PHASE — THE CORE FIX
           Check pigs FIRST before checking birds.
           ═══════════════════════════════════════════════ */
        if (this.state === this.STATE.SETTLE) {
            this.settleTimer -= dt;

            if (this.settleTimer <= 0) {
                // ──── CHECK 1: All pigs dead? → WIN! ────
                if (this._allPigsAreDead()) {
                    this._doWin();
                    return;
                }

                // ──── CHECK 2: Birds remaining? → Load next bird ────
                if (this.birdQueue.length > 0) {
                    this._nextBird();
                    this.state = this.STATE.WAITING;
                    this.targetCamX = 0;
                    this._sfx('navigate', 200);
                    return;
                }

                // ──── CHECK 3: No birds AND pigs alive → GAME OVER ────
                this._doGameOver();
                return;
            }

            // EARLY WIN CHECK — don't wait for timer if all pigs already dead
            if (this._allPigsAreDead() && this.settleTimer < 60) {
                this._doWin();
                return;
            }
        }

        // FX update
        const spd = dt/16.67;
        this.parts = this.parts.filter(p => {
            p.x+=p.vx*spd; p.y+=p.vy*spd; p.vy+=p.g*spd;
            p.vx*=Math.pow(0.965,spd); p.life-=p.dec*spd; p.r*=Math.pow(0.96,spd);
            return p.life>0 && p.r>0.3;
        });
        this.rings = this.rings.filter(r => { r.r+=3.5*spd; r.a-=0.04*spd; return r.a>0; });
        this.pops  = this.pops.filter(p => { p.y-=1.1*spd; p.life-=dt; p.op=Math.min(1,p.life/500); return p.life>0; });
    }

    /* ══════════════════ ENTER ANIMATION ══════════════════ */

    _updateEnterAnim(dt) {
        if (!this.bird || this.bird.launched || this.bird.enterAnim <= 0) return;
        this.bird.enterAnim = Math.max(0, this.bird.enterAnim - dt/600);
        const t    = 1 - this.bird.enterAnim;
        const ease = t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
        this.bird.x = this.bird.enterStartX + (this.bird.enterTargetX - this.bird.enterStartX) * ease;
        this.bird.y = this.bird.enterStartY + (this.bird.enterTargetY - this.bird.enterStartY) * ease;
        this.bird.y -= Math.abs(Math.sin(t * Math.PI * 3)) * 10 * (1-t);
        this.bird.phase += 0.08;
    }

    /* ══════════════════ DRAW ══════════════════ */

    draw(ts) {
        const ctx = this.ctx;
        ctx.fillStyle = '#040308';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === this.STATE.MENU) { this._drawMenu(ts); this._drawFSBtn(ts); return; }

        ctx.save();
        if (this.shakeX||this.shakeY) ctx.translate(this.S(this.shakeX), this.S(this.shakeY));

        this._drawSky();
        this._drawMountains();
        this._drawClouds();
        this._drawGround();
        this._drawBlocks();
        this._drawDebris();
        this._drawPigs(ts);
        this._drawSling();
        this._drawTrajectory();
        this._drawActiveBirds(ts);
        this._drawBirdWithQueue(ts);
        this._drawRings();
        this._drawParts();
        this._drawPops();

        if (this.flashA > 0) {
            ctx.globalAlpha = this.flashA; ctx.fillStyle = this.flashC;
            ctx.fillRect(0,0,this.canvas.width,this.canvas.height); ctx.globalAlpha = 1;
        }

        ctx.restore();

        this._drawHUD(ts);
        this._drawFSBtn(ts);

        if (this.state===this.STATE.FLYING && this.bird && !this.bird.specialUsed && this.bird.special!=='none' && !this.bird.dead) {
            const sa = 0.5+Math.sin(ts/260)*0.4;
            this._utxt(`TAP — ${this.bird.name} SPECIAL!`, this.W/2, this.H-65, {
                sz:12, wt:'bold', col:'#FFD700', al:'center', bl:'middle', op:sa,
                stroke:true, sc:'rgba(0,0,0,0.5)', sw:2, ff:this.FT
            });
        }

        if (this.state===this.STATE.WAITING && this.bird && this.bird.enterAnim<=0) {
            this._drawWaitHint(ts);
        }

        if (this.state===this.STATE.DEAD) this._drawRetryOverlay(ts);
        if (this.state===this.STATE.WIN)  this._drawWinOverlay(ts);
    }

    _drawSky() {
        const ctx=this.ctx;
        const g=ctx.createLinearGradient(0,0,0,this.X(this.GROUND));
        g.addColorStop(0,'#0a0520'); g.addColorStop(0.5,'#080418'); g.addColorStop(1,'#060312');
        ctx.fillStyle=g; ctx.fillRect(0,0,this.canvas.width,this.X(this.GROUND+4));
        this.stars.forEach(s=>{
            ctx.globalAlpha=0.1+((Math.sin(s.ph)+1)/2)*0.5;
            ctx.fillStyle='#dde8ff';
            ctx.beginPath(); ctx.arc(this.X(s.x-this.camX*0.18),this.X(s.y),this.S(s.r),0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;
    }

    _drawMountains() {
        const ctx=this.ctx;
        this.mountains.forEach(m=>{
            ctx.fillStyle=m.col;
            const mx=this.X(m.x-this.camX*0.08);
            ctx.beginPath();
            ctx.moveTo(mx, this.X(this.GROUND));
            ctx.lineTo(mx+this.S(m.w/2), this.X(this.GROUND-m.h));
            ctx.lineTo(mx+this.S(m.w),   this.X(this.GROUND));
            ctx.closePath(); ctx.fill();
        });
    }

    _drawClouds() {
        const ctx=this.ctx;
        this.clouds.forEach(c=>{
            ctx.globalAlpha=c.alpha; ctx.fillStyle='rgba(200,210,255,0.65)';
            const cx=this.X(c.x-this.camX*0.12), cy=this.X(c.y);
            ctx.beginPath(); ctx.ellipse(cx,cy,this.S(c.w),this.S(c.h),0,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx-this.S(c.w*.3),cy+this.S(c.h*.1),this.S(c.w*.5),this.S(c.h*.7),0,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx+this.S(c.w*.3),cy,this.S(c.w*.45),this.S(c.h*.65),0,0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;
    }

    _drawGround() {
        const ctx=this.ctx, gy=this.GROUND;
        ctx.fillStyle='#0a2a0a'; ctx.fillRect(0,this.X(gy+16),this.canvas.width,this.canvas.height);
        const g=ctx.createLinearGradient(0,this.X(gy-2),0,this.X(gy+20));
        g.addColorStop(0,'#2a6a1a'); g.addColorStop(0.3,'#1d5512'); g.addColorStop(1,'#0d3a0a');
        ctx.fillStyle=g; ctx.fillRect(0,this.X(gy-2),this.canvas.width,this.X(22));
        ctx.fillStyle='rgba(100,220,55,0.2)'; ctx.fillRect(0,this.X(gy-2),this.canvas.width,this.S(2.5));
        const tw=20, off=(((-this.camX*1.02)%tw)+tw)%tw;
        for (let x=-tw+off; x<this.W+tw*2; x+=tw) {
            const h=2.5+Math.sin(x*0.45+this.bgTime)*1.8;
            ctx.fillStyle='rgba(80,200,40,0.3)';
            ctx.fillRect(this.X(x),this.X(gy-2-h),this.S(1.5),this.S(h));
        }
    }

    _drawBlocks() {
        const ctx=this.ctx;
        this.blocks.forEach(bl=>{
            if (bl.dead) return;
            ctx.save();
            ctx.translate(this.X(bl.x-this.camX),this.X(bl.y));
            ctx.rotate(bl.angle);
            ctx.fillStyle='rgba(0,0,0,0.16)';
            ctx.fillRect(this.S(-bl.w/2+1.5),this.S(-bl.h/2+1.5),this.S(bl.w),this.S(bl.h));
            const bg=ctx.createLinearGradient(this.S(-bl.w/2),this.S(-bl.h/2),this.S(bl.w/2),this.S(bl.h/2));
            bg.addColorStop(0,bl.hitAnim>0?'#fff':bl.light);
            bg.addColorStop(0.5,bl.col); bg.addColorStop(1,bl.dark);
            ctx.fillStyle=bg;
            ctx.fillRect(this.S(-bl.w/2),this.S(-bl.h/2),this.S(bl.w),this.S(bl.h));
            if (bl.type==='wood'||bl.type==='plank') {
                ctx.strokeStyle='rgba(80,50,20,0.25)'; ctx.lineWidth=this.S(0.7);
                for (let i=0;i<3;i++) {
                    const ly=this.S(-bl.h/2+(i+1)*bl.h/4);
                    ctx.beginPath();
                    ctx.moveTo(this.S(-bl.w/2+2),ly);
                    ctx.lineTo(this.S(bl.w/2-2),ly+this.S(Math.sin(bl.crackseed+i)*2));
                    ctx.stroke();
                }
            } else if (bl.type==='stone') {
                ctx.strokeStyle='rgba(40,40,50,0.2)'; ctx.lineWidth=this.S(0.6);
                ctx.beginPath(); ctx.moveTo(0,this.S(-bl.h/2)); ctx.lineTo(0,this.S(bl.h/2)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(this.S(-bl.w/2),0); ctx.lineTo(this.S(bl.w/2),0); ctx.stroke();
            }
            const hpR=bl.hp/bl.maxHp;
            if (hpR < 0.65) {
                ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=this.S(0.8); ctx.lineCap='round';
                const n=hpR<0.35?5:2;
                for (let i=0;i<n;i++) {
                    const s=bl.crackseed+i*7.3;
                    ctx.beginPath();
                    ctx.moveTo(this.S(Math.sin(s)*bl.w*0.28),this.S(Math.cos(s*1.3)*bl.h*0.28));
                    ctx.lineTo(this.S(Math.sin(s*2.1)*bl.w*0.3),this.S(Math.cos(s*0.7)*bl.h*0.3));
                    ctx.stroke();
                }
            }
            ctx.strokeStyle=`rgba(255,255,255,${bl.hitAnim>0?0.5:0.12})`; ctx.lineWidth=this.S(0.8);
            ctx.strokeRect(this.S(-bl.w/2),this.S(-bl.h/2),this.S(bl.w),this.S(bl.h));
            ctx.fillStyle='rgba(255,255,255,0.15)';
            ctx.fillRect(this.S(-bl.w/2+1.5),this.S(-bl.h/2+1.5),this.S(bl.w*0.4),this.S(3));
            ctx.restore();
        });
    }

    _drawDebris() {
        const ctx=this.ctx;
        this.debris.forEach(d=>{
            ctx.save(); ctx.globalAlpha=d.life;
            ctx.translate(this.X(d.x-this.camX),this.X(d.y)); ctx.rotate(d.angle);
            ctx.fillStyle=d.col;
            ctx.fillRect(this.S(-d.w/2),this.S(-d.h/2),this.S(d.w),this.S(d.h));
            ctx.restore();
        });
    }

    _drawPigs(ts) {
        const ctx=this.ctx;
        this.pigs.forEach(pg=>{
            if (pg.dead) return;
            const sc=pg.hitAnim>0?1+pg.hitAnim*0.12:1+Math.sin(pg.phase)*0.02;
            const r=pg.r*sc;
            ctx.save(); ctx.translate(this.X(pg.x-this.camX),this.X(pg.y));
            ctx.fillStyle='rgba(0,0,0,0.14)';
            ctx.beginPath(); ctx.ellipse(this.S(2),this.S(r*.65),this.S(r*.8),this.S(r*.18),0,0,Math.PI*2); ctx.fill();
            const bg=ctx.createRadialGradient(this.S(-r*.25),this.S(-r*.28),0,0,0,this.S(r));
            bg.addColorStop(0,pg.hitAnim>0?'#BBFFBB':pg.light); bg.addColorStop(0.55,pg.col); bg.addColorStop(1,pg.dark);
            ctx.fillStyle=bg;
            ctx.beginPath(); ctx.arc(0,0,this.S(r),0,Math.PI*2); ctx.fill();
            ctx.strokeStyle=`rgba(255,255,255,${pg.hitAnim>0?0.42:0.1})`; ctx.lineWidth=this.S(0.7); ctx.stroke();
            if (pg.hp<pg.maxHp&&pg.maxHp>1) {
                ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(this.S(-r),this.S(-r-8),this.S(r*2),this.S(4));
                ctx.fillStyle='#22DD44'; ctx.fillRect(this.S(-r),this.S(-r-8),this.S(r*2*(pg.hp/pg.maxHp)),this.S(4));
            }
            [-1,1].forEach(side=>{
                const ex=this.S(side*r*.36), ey=this.S(-r*.12);
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,ey,this.S(r*.24),0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex+this.S(side*1.2),ey+this.S(1.2),this.S(r*.12),0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex+this.S(side*1.2+.6),ey+this.S(.2),this.S(r*.05),0,Math.PI*2); ctx.fill();
            });
            ctx.fillStyle='#228800';
            ctx.beginPath(); ctx.ellipse(0,this.S(r*.1),this.S(r*.2),this.S(r*.12),0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#004400';
            [-1,1].forEach(s=>{ ctx.beginPath(); ctx.arc(this.S(s*r*.09),this.S(r*.1),this.S(r*.05),0,Math.PI*2); ctx.fill(); });
            ctx.fillStyle='rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.ellipse(this.S(-r*.22),this.S(-r*.28),this.S(r*.22),this.S(r*.15),-.5,0,Math.PI*2); ctx.fill();
            ctx.restore();
        });
    }

    _drawSling() {
        const ctx=this.ctx, sx=this.sling.x, sy=this.sling.y;
        const fH=48, sw=7;
        ctx.fillStyle='rgba(0,0,0,0.15)';
        ctx.fillRect(this.X(sx-sw/2-this.camX+2),this.X(sy+3),this.S(sw),this.X(this.GROUND-sy));
        const sg=ctx.createLinearGradient(0,this.X(sy),0,this.X(this.GROUND));
        sg.addColorStop(0,'#8B5A2B'); sg.addColorStop(1,'#5C3A1E');
        ctx.fillStyle=sg;
        this._fillRect(sx-sw/2,sy,sw,this.GROUND-sy);
        ctx.strokeStyle='#6B4A2A'; ctx.lineWidth=this.S(sw-1.5); ctx.lineCap='round';
        [[-22,-fH],[22,-fH]].forEach(([dx,dy])=>{
            ctx.beginPath();
            ctx.moveTo(this.X(sx-this.camX),this.X(sy));
            ctx.lineTo(this.X(sx+dx-this.camX),this.X(sy+dy));
            ctx.stroke();
        });
        ctx.strokeStyle='#9B7A4A'; ctx.lineWidth=this.S(3);
        [[-22,-fH],[22,-fH]].forEach(([dx,dy])=>{
            ctx.beginPath();
            ctx.moveTo(this.X(sx+dx-this.camX-4),this.X(sy+dy));
            ctx.lineTo(this.X(sx+dx-this.camX+4),this.X(sy+dy));
            ctx.stroke();
        });
        if (this.bird && !this.bird.launched) {
            const bx=this.bird.x, by=this.bird.y;
            ctx.strokeStyle='rgba(110,55,18,0.78)'; ctx.lineWidth=this.S(2.5); ctx.lineCap='round';
            [[sx-22,sy-fH],[sx+22,sy-fH]].forEach(([lx,ly])=>{
                ctx.beginPath(); ctx.moveTo(this.X(lx-this.camX),this.X(ly));
                ctx.lineTo(this.X(bx-this.camX),this.X(by)); ctx.stroke();
            });
        } else {
            ctx.strokeStyle='rgba(90,45,15,0.35)'; ctx.lineWidth=this.S(1.8);
            ctx.beginPath();
            ctx.moveTo(this.X(sx-22-this.camX),this.X(sy-fH));
            ctx.lineTo(this.X(sx-this.camX),this.X(sy-7));
            ctx.lineTo(this.X(sx+22-this.camX),this.X(sy-fH));
            ctx.stroke();
        }
        ctx.fillStyle='#5C3A1E';
        ctx.beginPath(); ctx.arc(this.X(sx-this.camX),this.X(sy),this.S(4.2),0,Math.PI*2); ctx.fill();
    }

    _drawTrajectory() {
        if (!this.trajDots.length) return;
        const ctx=this.ctx;
        this.trajDots.forEach(d=>{
            ctx.globalAlpha=d.a*0.6;
            ctx.fillStyle='rgba(255,255,200,0.85)';
            this._circle(d.x,d.y,2.2); ctx.fill();
        });
        ctx.globalAlpha=1;
    }

    _drawBirdWithQueue(ts) {
        if (!this.bird) return;
        this.birdQueue.forEach((bd, i) => {
            const qx  = this.sling.x - 36 - i * 28;
            const qy  = this.GROUND - bd.r;
            const bob = Math.sin(this.time/550 + i*1.2) * 2.5;
            this._drawBirdAt(this.ctx, qx - this.camX, qy + bob, bd.r*0.72, bd, ts);
        });
        if (this.bird.enterAnim > 0 && !this.bird.launched) {
            this._drawBirdAt(this.ctx, this.bird.x - this.camX, this.bird.y, this.bird.r, this.bird, ts);
        } else {
            this._renderBirdFull(this.bird, ts);
        }
    }

    _drawActiveBirds(ts) {
        this.activeBirds.forEach(ab => {
            if (!ab.launched || ab.settled) return;
            this._renderBirdFull(ab, ts);
        });
    }

    _renderBirdFull(b, ts) {
        if (!b) return;
        const ctx=this.ctx;
        if (b.trail && b.trail.length) {
            b.trail.forEach((tp,i)=>{
                if (tp.a<=0) return;
                ctx.globalAlpha=tp.a*0.18;
                ctx.fillStyle=b.col;
                this._circle(tp.x,tp.y,Math.max(0.4,b.r*(i/b.trail.length)*0.5));
                ctx.fill();
            });
            ctx.globalAlpha=1;
        }
        const p=b.hitAnim>0?1+b.hitAnim*0.15:1+Math.sin(b.phase||0)*0.03;
        ctx.save();
        ctx.translate(this.X(b.x-this.camX),this.X(b.y));
        if (b.launched) ctx.rotate(Math.atan2(b.vy,b.vx)*0.35);
        ctx.scale(p,p);
        this._drawBirdAt(ctx,0,0,b.r,b,ts);
        ctx.restore();
    }

    _drawBirdAt(ctx, x, y, r, bd, ts) {
        ctx.fillStyle='rgba(0,0,0,0.12)';
        ctx.beginPath(); ctx.ellipse(this.S(x+1.5),this.S(y+r*.6),this.S(r*.85),this.S(r*.18),0,0,Math.PI*2); ctx.fill();
        const bg=ctx.createRadialGradient(this.S(x-r*.28),this.S(y-r*.28),this.S(r*.04),this.S(x),this.S(y),this.S(r));
        bg.addColorStop(0,bd.light); bg.addColorStop(0.42,bd.col); bg.addColorStop(1,bd.dark);
        ctx.fillStyle=bg;
        ctx.beginPath(); ctx.arc(this.S(x),this.S(y),this.S(r),0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=this.S(0.7); ctx.stroke();
        [-1,1].forEach(side=>{
            const ex=this.S(x+side*r*.28), ey=this.S(y-r*.06);
            ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,ey,this.S(r*.25),0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex+this.S(side*.6),ey+this.S(.8),this.S(r*.13),0,Math.PI*2); ctx.fill();
        });
        ctx.fillStyle='#FF8C00';
        ctx.beginPath();
        ctx.moveTo(this.S(x+r*.32),this.S(y+r*.06));
        ctx.lineTo(this.S(x+r*.88),this.S(y));
        ctx.lineTo(this.S(x+r*.32),this.S(y-r*.06));
        ctx.closePath(); ctx.fill();
        if (bd.id==='red') {
            ctx.fillStyle='#EE0011';
            ctx.beginPath();
            ctx.moveTo(this.S(x-r*.08),this.S(y-r));
            ctx.lineTo(this.S(x+r*.16),this.S(y-r*1.35));
            ctx.lineTo(this.S(x+r*.35),this.S(y-r*.9));
            ctx.closePath(); ctx.fill();
        }
        if (bd.id==='black') {
            ctx.strokeStyle='#FFD700'; ctx.lineWidth=this.S(1.6); ctx.lineCap='round';
            ctx.beginPath();
            ctx.moveTo(this.S(x),this.S(y-r));
            ctx.quadraticCurveTo(this.S(x+r*.35),this.S(y-r*1.45),this.S(x+r*.2),this.S(y-r*1.82));
            ctx.stroke();
        }
        if (bd.id==='yellow') {
            ctx.fillStyle='rgba(255,200,0,0.25)';
            ctx.beginPath();
            ctx.moveTo(this.S(x+r*.7),this.S(y));
            ctx.lineTo(this.S(x-r*.4),this.S(y-r*.55));
            ctx.lineTo(this.S(x-r*.4),this.S(y+r*.55));
            ctx.closePath(); ctx.fill();
        }
        if (bd.id==='blue') {
            ctx.fillStyle=bd.dark;
            ctx.beginPath();
            ctx.moveTo(this.S(x-r*.7),this.S(y));
            ctx.lineTo(this.S(x-r*1.3),this.S(y-r*.4));
            ctx.lineTo(this.S(x-r*1.2),this.S(y+r*.3));
            ctx.closePath(); ctx.fill();
        }
        if (bd.id==='green') {
            ctx.fillStyle=bd.dark;
            ctx.beginPath();
            ctx.moveTo(this.S(x-r*.8),this.S(y));
            ctx.lineTo(this.S(x-r*1.5),this.S(y+r*.2));
            ctx.lineTo(this.S(x-r*1.3),this.S(y-r*.4));
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle='rgba(255,255,255,0.38)';
        ctx.beginPath();
        ctx.ellipse(this.S(x-r*.2),this.S(y-r*.28),this.S(r*.26),this.S(r*.17),-.5,0,Math.PI*2);
        ctx.fill();
    }

    _drawRings() {
        const ctx=this.ctx;
        this.rings.forEach(r=>{
            ctx.save(); ctx.globalAlpha=Math.max(0,r.a);
            ctx.strokeStyle=r.col; ctx.lineWidth=this.S(2*r.a);
            this._circle(r.x,r.y,r.r); ctx.stroke();
            ctx.restore();
        });
    }

    _drawParts() {
        const ctx=this.ctx;
        this.parts.forEach(p=>{
            ctx.save(); ctx.globalAlpha=Math.max(0,p.life);
            ctx.fillStyle=p.col;
            this._circle(p.x,p.y,Math.max(0.3,p.r*p.life)); ctx.fill();
            ctx.restore();
        });
    }

    _drawPops() {
        this.pops.forEach(p=>{
            this._ctxt(p.text,p.x,p.y,{
                sz:13,wt:'bold',col:p.col,al:'center',op:p.op,
                stroke:true,sc:'rgba(0,0,0,0.55)',sw:2.5,ff:this.FT
            });
        });
    }

    _drawHUD(ts) {
        const ctx=this.ctx, W=this.W;
        const hg=ctx.createLinearGradient(0,0,0,this.X(52));
        hg.addColorStop(0,'rgba(0,0,0,0.8)'); hg.addColorStop(1,'rgba(0,0,0,0.04)');
        ctx.fillStyle=hg; ctx.fillRect(0,0,this.canvas.width,this.X(52));
        this._utxt(this.score.toLocaleString(),W/2,24,{sz:20,wt:'bold',col:'#fff',al:'center',bl:'middle',ff:this.FT});
        if (this.bestScore>0) this._utxt(`BEST ${this.bestScore.toLocaleString()}`,W/2,42,{sz:8,col:'rgba(255,215,0,0.4)',al:'center',bl:'middle',ff:this.FU});
        ctx.fillStyle='rgba(185,79,227,0.18)'; ctx.strokeStyle='rgba(185,79,227,0.4)'; ctx.lineWidth=this.S(1);
        this._rrect(8,8,54,24,6); ctx.fill(); ctx.stroke();
        this._utxt(`LVL ${this.level}`,35,20,{sz:11,wt:'bold',col:'#cc80ff',al:'center',bl:'middle',ff:this.FT});
        const qLen = this.birdQueue.length + (this.bird && !this.bird.dead ? 1 : 0);
        this._utxt(`🐦 ${qLen}`,W-12,22,{sz:13,wt:'bold',col:'#FFD700',al:'right',bl:'middle',ff:this.FT});
        const pAlive = this.pigs.filter(p=>!p.dead).length;
        this._utxt(`🐷 ${pAlive}`,W/2+55,22,{sz:11,wt:'bold',col:'#22CC44',al:'left',bl:'middle',ff:this.FT});
    }

    _drawFSBtn(ts) {
        const ctx=this.ctx, bw=42,bh=42,mg=10;
        const bx=this.W-bw-mg, by=this.H-bh-mg;
        this.fsRect={x:bx,y:by,w:bw,h:bh};
        const pulse=0.4+Math.sin(ts/1200)*0.18;
        ctx.save(); ctx.globalAlpha=pulse;
        ctx.fillStyle='rgba(0,0,10,0.5)'; ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineWidth=this.S(1);
        this._rrect(bx,by,bw,bh,9); ctx.fill(); ctx.stroke();
        const cx=bx+bw/2, cy=by+bh/2, ic=7;
        ctx.strokeStyle='#fff'; ctx.lineWidth=this.S(1.8); ctx.lineCap='round';
        [[-ic,-(ic-3),-ic,-ic,-(ic-3),-ic],
         [ic-3,-ic,ic,-ic,ic,-(ic-3)],
         [-ic,ic-3,-ic,ic,-(ic-3),ic],
         [ic-3,ic,ic,ic,ic,ic-3]
        ].forEach(([x1,y1,x2,y2,x3,y3])=>{
            ctx.beginPath();
            ctx.moveTo(this.X(cx+x1),this.X(cy+y1));
            ctx.lineTo(this.X(cx+x2),this.X(cy+y2));
            ctx.lineTo(this.X(cx+x3),this.X(cy+y3));
            ctx.stroke();
        });
        ctx.restore();
    }

    _drawWaitHint(ts) {
        const cx=this.W/2, cy=this.H/2;
        const cw=Math.min(this.W-36,272), ch=82;
        this.ctx.fillStyle='rgba(4,2,16,0.82)';
        this._rrect(cx-cw/2,cy-ch/2,cw,ch,14); this.ctx.fill();
        this.ctx.strokeStyle='rgba(255,140,0,0.3)'; this.ctx.lineWidth=this.S(1.2);
        this._rrect(cx-cw/2,cy-ch/2,cw,ch,14); this.ctx.stroke();
        if (this.bird) {
            this._utxt(`${this.bird.name} Bird Ready!`, cx, cy-14, {
                sz:14, wt:'bold', col:this.bird.col, al:'center', bl:'middle', ff:this.FT
            });
            const specials = {
                none:'Basic bird — no special',
                split:'TAP mid-air to split into 3!',
                boost:'TAP mid-air for speed boost!',
                bomb:'TAP mid-air to set explosion!',
                egg:'TAP mid-air to drop egg bomb!',
                boomerang:'TAP mid-air to reverse!'
            };
            this._utxt(specials[this.bird.special]||'', cx, cy+3, {
                sz:9, col:'rgba(255,220,130,0.5)', al:'center', bl:'middle', ff:this.FU
            });
        }
        const bob=Math.sin(this.time/380)*4;
        this._utxt('← Pull bird back to launch', cx, cy+ch/2-10+bob, {
            sz:9, col:`rgba(255,210,0,${0.35+Math.sin(this.time/380)*0.35})`,
            al:'center', bl:'middle', ff:this.FU
        });
    }

    _drawRetryOverlay(ts) {
        const ctx=this.ctx, W=this.W, H=this.H, a=this.overlayA;
        ctx.fillStyle=`rgba(0,0,0,${a*0.76})`; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        if (a<0.4) return;
        const pa=Math.min(1,(a-0.4)/0.6);
        const pw=Math.min(W-28,285), ph=228;
        const px=W/2-pw/2, py=H/2-ph/2;
        ctx.save(); ctx.globalAlpha=pa;
        ctx.fillStyle='rgba(6,2,18,0.97)';
        this._rrect(px,py,pw,ph,20); ctx.fill();
        ctx.strokeStyle='rgba(255,80,60,0.4)'; ctx.lineWidth=this.S(1.5);
        this._rrect(px,py,pw,ph,20); ctx.stroke();
        ctx.fillStyle='rgba(255,80,60,0.12)';
        ctx.fillRect(this.X(px),this.X(py),this.X(pw),this.S(3));
        ctx.globalAlpha=1;
        ctx.font=`${Math.round(28*this.dpr)}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.globalAlpha=pa;
        ctx.fillText('😡', this.X(W/2), this.X(py+38));
        ctx.globalAlpha=1;
        this._utxt('LEVEL FAILED!', W/2, py+66, {sz:22,wt:'bold',col:'#FF4444',al:'center',bl:'middle',op:pa,ff:this.FT});
        this._utxt('Pigs survived!', W/2, py+86, {sz:11,col:'rgba(200,180,180,0.55)',al:'center',bl:'middle',op:pa,ff:this.FU});
        ctx.fillStyle=`rgba(255,255,255,${0.07*pa})`;
        ctx.fillRect(this.X(px+22),this.X(py+100),this.X(pw-44),this.S(1));
        const rows=[
            {l:'SCORE',    v:this.score.toLocaleString(),            c:this.score>=this.bestScore?'#00fff5':'#fff'},
            {l:'BEST',     v:this.bestScore.toLocaleString(),         c:this.score>=this.bestScore?'#FFD700':'#999'},
            {l:'LEVEL',    v:`${this.level}`,                         c:'#c070ff'},
            {l:'PIGS LEFT',v:`${this.pigs.filter(p=>!p.dead).length}`,c:'#22CC44'}
        ];
        rows.forEach((r,i)=>{
            const ry=py+115+i*26;
            this._utxt(r.l, px+22, ry, {sz:10,col:`rgba(140,140,170,${pa})`,ff:this.FU});
            this._utxt(r.v, px+pw-22, ry, {sz:i===0?15:12,wt:'bold',col:r.c,al:'right',op:pa,ff:this.FT});
        });
        if (this.score>0&&this.score>=this.bestScore) {
            ctx.fillStyle='rgba(255,215,0,0.1)'; ctx.strokeStyle='rgba(255,215,0,0.38)'; ctx.lineWidth=this.S(1);
            this._rrect(W/2-52,py+104,104,18,6); ctx.fill(); ctx.stroke();
            this._utxt('✦ NEW BEST ✦',W/2,py+115,{sz:9,wt:'bold',col:'#FFD700',al:'center',bl:'middle',op:pa,ff:this.FT});
        }
        ctx.fillStyle=`rgba(255,255,255,${0.07*pa})`;
        ctx.fillRect(this.X(px+22),this.X(py+ph-48),this.X(pw-44),this.S(1));
        const blink=0.4+Math.sin(this.time/320)*0.45;
        this._utxt('● TAP TO RETRY ●',W/2,py+ph-18,{
            sz:12,wt:'bold',col:'rgba(255,150,150,0.9)',al:'center',bl:'middle',op:blink*pa,ff:this.FT
        });
        ctx.restore();
    }

    _drawWinOverlay(ts) {
        const ctx=this.ctx, W=this.W, H=this.H, a=this.overlayA;
        ctx.fillStyle=`rgba(0,0,0,${a*0.72})`; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        if (a<0.4) return;
        const pa=Math.min(1,(a-0.4)/0.6);
        const pw=Math.min(W-28,285), ph=228;
        const px=W/2-pw/2, py=H/2-ph/2;
        ctx.save(); ctx.globalAlpha=pa;
        ctx.fillStyle='rgba(4,14,4,0.97)';
        this._rrect(px,py,pw,ph,20); ctx.fill();
        ctx.strokeStyle='rgba(0,255,88,0.4)'; ctx.lineWidth=this.S(1.5);
        this._rrect(px,py,pw,ph,20); ctx.stroke();
        ctx.fillStyle='rgba(0,255,88,0.1)';
        ctx.fillRect(this.X(px),this.X(py),this.X(pw),this.S(3));
        ctx.globalAlpha=1;
        const bl=0.7+Math.sin(ts/180)*0.28;
        ['⭐','⭐','⭐'].forEach((s,i)=>{
            const sc=bl*(0.82+i*0.09);
            ctx.font=`${Math.round(22*sc*this.dpr)}px serif`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.globalAlpha=pa*sc;
            ctx.fillText(s,this.X(W/2-42+i*42),this.X(py+36));
        });
        ctx.globalAlpha=1;
        this._utxt('LEVEL CLEAR!',W/2,py+68,{sz:22,wt:'bold',col:'#00FF88',al:'center',bl:'middle',op:pa,ff:this.FT});
        ctx.fillStyle=`rgba(255,255,255,${0.07*pa})`;
        ctx.fillRect(this.X(px+22),this.X(py+84),this.X(pw-44),this.S(1));
        const rows=[
            {l:'SCORE',      v:this.score.toLocaleString(),      c:this.score>=this.bestScore?'#00fff5':'#fff'},
            {l:'BEST',       v:this.bestScore.toLocaleString(),   c:this.score>=this.bestScore?'#FFD700':'#999'},
            {l:'NEXT LEVEL', v:`${this.level + 1}`,              c:'#c070ff'},
            {l:'BIRD BONUS', v:`+${this.birdQueue.length*1000}`,  c:'#FFD700'}
        ];
        rows.forEach((r,i)=>{
            const ry=py+100+i*28;
            this._utxt(r.l, px+22, ry, {sz:10,col:`rgba(140,170,140,${pa})`,ff:this.FU});
            this._utxt(r.v, px+pw-22, ry, {sz:i===0?15:12,wt:'bold',col:r.c,al:'right',op:pa,ff:this.FT});
        });
        if (this.score>0&&this.score>=this.bestScore) {
            ctx.fillStyle='rgba(255,215,0,0.1)'; ctx.strokeStyle='rgba(255,215,0,0.38)'; ctx.lineWidth=this.S(1);
            this._rrect(W/2-52,py+88,104,18,6); ctx.fill(); ctx.stroke();
            this._utxt('✦ NEW BEST ✦',W/2,py+99,{sz:9,wt:'bold',col:'#FFD700',al:'center',bl:'middle',op:pa,ff:this.FT});
        }
        ctx.fillStyle=`rgba(255,255,255,${0.07*pa})`;
        ctx.fillRect(this.X(px+22),this.X(py+ph-48),this.X(pw-44),this.S(1));
        const blink=0.4+Math.sin(this.time/320)*0.45;
        this._utxt('● TAP FOR NEXT LEVEL ●',W/2,py+ph-18,{
            sz:11,col:'rgba(150,255,180,0.9)',al:'center',bl:'middle',op:blink*pa,ff:this.FU
        });
        ctx.restore();
    }

    _drawMenu(ts) {
        const ctx=this.ctx, W=this.W, H=this.H, t=this.menuTime;
        const bg=ctx.createLinearGradient(0,0,0,this.X(H));
        bg.addColorStop(0,'#0a0520'); bg.addColorStop(0.5,'#080418'); bg.addColorStop(1,'#060312');
        ctx.fillStyle=bg; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        this.stars.forEach(s=>{
            ctx.globalAlpha=0.1+((Math.sin(s.ph)+1)/2)*0.48;
            ctx.fillStyle='#dde8ff';
            ctx.beginPath(); ctx.arc(this.X(s.x),this.X(s.y),this.S(s.r),0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;
        this.clouds.forEach(c=>{
            ctx.globalAlpha=c.alpha; ctx.fillStyle='rgba(200,210,255,0.6)';
            ctx.beginPath(); ctx.ellipse(this.X(c.x),this.X(c.y),this.S(c.w),this.S(c.h),0,0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;
        ctx.fillStyle='#1a4a1a'; ctx.fillRect(0,this.X(H*.78),this.canvas.width,this.canvas.height);
        ctx.fillStyle='rgba(100,220,55,0.2)'; ctx.fillRect(0,this.X(H*.78-2),this.canvas.width,this.S(2.5));
        const cw=Math.min(W-30,310), ch=95, cx=W/2, cy=H*0.2;
        ctx.fillStyle='rgba(4,1,16,0.88)';
        this._rrect(cx-cw/2,cy,cw,ch,18); ctx.fill();
        ctx.strokeStyle='rgba(255,140,0,0.4)'; ctx.lineWidth=this.S(1.5);
        this._rrect(cx-cw/2,cy,cw,ch,18); ctx.stroke();
        this._utxt('ANGRY BIRDS',cx,cy+36,{sz:24,wt:'bold',col:'#FF8C00',al:'center',bl:'middle',ff:this.FT});
        this._utxt('NEON EDITION',cx,cy+60,{sz:10,col:'rgba(255,200,100,0.5)',al:'center',bl:'middle',ff:this.FU});
        this._utxt(`BEST: ${this.bestScore.toLocaleString()}`,cx,cy+80,{sz:9,col:'rgba(255,215,0,0.4)',al:'center',bl:'middle',ff:this.FU});
        const birdTypes=['red','yellow','black','blue','green'];
        const btw=38, brow=H*0.52;
        const bstx=cx-(birdTypes.length*btw)/2+btw/2;
        birdTypes.forEach((id,i)=>{
            const bd=this.BIRD_TYPES.find(b=>b.id===id);
            const bob=Math.sin(t*2.2+i*0.9)*7;
            this._drawBirdAt(ctx,bstx+i*btw,brow+bob,bd.r*0.82,bd,ts);
        });
        const tips=['🏹  Drag bird back to aim','⚡  Tap while flying for SPECIAL','🐷  Destroy all pigs to win!'];
        tips.forEach((tip,i)=>{
            this._utxt(tip,cx,H*0.66+i*20,{sz:9.5,col:'rgba(200,200,220,0.5)',al:'center',bl:'middle',ff:this.FU});
        });
        const pb={x:cx-80,y:H*0.82,w:160,h:48};
        const pulse=0.55+Math.sin(t*2.8)*0.3;
        const pg=ctx.createLinearGradient(this.X(pb.x),0,this.X(pb.x),this.X(pb.y+pb.h));
        pg.addColorStop(0,`rgba(255,140,0,${0.35+pulse*.08})`);
        pg.addColorStop(1,`rgba(200,80,0,${0.22+pulse*.05})`);
        ctx.fillStyle=pg; this._rrect(pb.x,pb.y,pb.w,pb.h,14); ctx.fill();
        ctx.strokeStyle=`rgba(255,180,50,${0.55+pulse*.3})`; ctx.lineWidth=this.S(1.8);
        this._rrect(pb.x,pb.y,pb.w,pb.h,14); ctx.stroke();
        this._utxt('▶  PLAY',cx,pb.y+pb.h/2,{sz:17,wt:'900',col:'#FFE066',al:'center',bl:'middle',ff:this.FT});
    }

    _loop(ts) {
        if (this.destroyed) return;
        const dt = Math.min(ts-(this.lastTime||ts), 50);
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
        this._setupHD();
        this.W = this.canvas.width/this.dpr; this.H = this.canvas.height/this.dpr;
        this.GROUND = this.H-52; this.worldW = this.W*2;
        this.sling.x = this.W*0.18; this.sling.y = this.GROUND-55;
        this.clouds    = this._mkClouds(8);
        this.stars     = this._mkStars(50);
        this.mountains = this._mkMountains();
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('touchstart', this._onTS);
        this.canvas.removeEventListener('touchmove',  this._onTM);
        this.canvas.removeEventListener('touchend',   this._onTE);
        this.canvas.removeEventListener('mousedown',  this._onMD);
        this.canvas.removeEventListener('mousemove',  this._onMM);
        this.canvas.removeEventListener('mouseup',    this._onMU);
    }
}