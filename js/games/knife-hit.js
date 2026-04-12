/* ============================================================
   KNIFE HIT v7.0 - ADDICTIVE EDITION
   4K Quality | Close Calls | Streaks | Satisfying FX
   ============================================================ */

'use strict';

class KnifeHit {
    constructor(canvas, onScore, options = {}) {
        this.canvas    = canvas;
        this.onScore   = onScore;
        this.options   = options;
        this.destroyed = false;
        this.paused    = false;
        this.isPaused  = false;
        this.gameOver  = false;

        // ── HD CANVAS — 4K Quality ──
        this.dpr = Math.min(window.devicePixelRatio || 1, 4);
        this.setupHDCanvas();
        this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
        this.W = this.canvas.width  / this.dpr;
        this.H = this.canvas.height / this.dpr;

        this.isMobile      = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window) || (window.innerWidth < 768);
        this.isSmallScreen = this.W < 380;

        this.TAU           = Math.PI * 2;
        this.MAX_PARTICLES = this.isMobile ? 120 : 220;
        this.MAX_POP_RINGS = 18;

        this.FONT_TITLE = '"Orbitron", "Rajdhani", "Segoe UI", monospace';
        this.FONT_UI    = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.FONT_MONO  = '"Rajdhani", "Segoe UI", Roboto, sans-serif';
        this.loadFonts();

        // ── AUDIO ──
        this.audioCtx   = null;
        this.masterGain = null;
        this.compressor = null;
        this.audioReady = false;

        // ── SAVE ──
        this.saveKey    = 'neonarcade_knifehit_v7';
        this.playerData = this.loadPlayerData();

        // ── GAME STATE ──
        this.score        = 0;
        this.level        = this.playerData.currentLevel || 1;
        this.stage        = 1;
        this.lives        = 3;
        this.maxLives     = 3;
        this.sessionCoins = 0;
        this.sessionDias  = 0;
        this.combo        = 0;
        this.maxCombo     = 0;

        // ── ADDICTIVE SYSTEMS ──
        this.streak           = 0;           // consecutive perfect hits
        this.streakRecord     = 0;
        this.closeCallCount   = 0;           // close calls this session
        this.perfectHits      = 0;           // hits with no collision this level
        this.lastHitAngleDiff = 0;           // for close call detection
        this.hitPulse         = 0;           // hit number pulse anim
        this.hitPulseTimer    = 0;
        this.levelStartTime   = Date.now();
        this.bestTime         = this.playerData.bestTime || 99999;

        // ── KNIFE ──
        this.knivesTotal  = 0;
        this.knivesLeft   = 0;
        this.knivesThrown = 0;

        // ── NO KNIVES STATE ──
        this.noKnivesLeft         = false;
        this.noKnivesOverlayAlpha = 0;

        // ── TARGET ──
        this.target = this.createTarget();

        // ── SKINS ──
        this.knifeSkins = {
            default: { blade:['#aaa','#e8e8e8','#fff'],       handle:['#2a0e04','#5a2a0e','#2a0e04'], guard:'#777',    name:'Classic' },
            neon:    { blade:['#00c4ef','#55e8ff','#fff'],     handle:['#081828','#10305a','#081828'], guard:'#00c4ef', name:'Neon'    },
            fire:    { blade:['#ee3300','#ff7700','#ffbb00'],  handle:['#2a0600','#500e00','#2a0600'], guard:'#ee3300', name:'Fire'    },
            gold:    { blade:['#bb8800','#FFD700','#fff8dc'],  handle:['#2a1e00','#5a3e00','#2a1e00'], guard:'#FFD700', name:'Gold'    },
            shadow:  { blade:['#333','#777','#bbb'],           handle:['#111','#222','#111'],          guard:'#444',    name:'Shadow'  },
            plasma:  { blade:['#8800ff','#bb44ff','#eeccff'],  handle:['#1a0030','#330066','#1a0030'], guard:'#9933ff', name:'Plasma'  },
            ice:     { blade:['#66ccff','#aaeeff','#ffffff'],  handle:['#0a2040','#1a4060','#0a2040'], guard:'#88ddff', name:'Ice'     }
        };
        this.currentSkin = this.playerData.currentSkin || 'default';

        // ── OBJECTS ──
        this.stuckKnives   = [];
        this.flyingKnife   = null;
        this.idleKnife     = null;
        this.apples        = [];
        this.orbitCoins    = [];

        // ── FX POOLS ──
        this.particles      = [];
        this.explosions     = [];
        this.scorePopups    = [];
        this.floatingTexts  = [];
        this.coinPickups    = [];
        this.breakPieces    = [];
        this.popRings       = [];
        this.trailParticles = [];
        this.shockwaves     = [];   // NEW: big hit shockwaves
        this.ribbons        = [];   // NEW: streak ribbons

        // ── SCREEN FX ──
        this.shakeX = 0; this.shakeY = 0;
        this.shakeTimer = 0; this.shakeForce = 0;
        this.flashTimer = 0; this.flashColor = '#ff0055';
        this.vignetteFlash = 0; this.vignetteColor = '#ff0055';

        // ── TIMING ──
        this.time  = 0;
        this.frame = 0;

        // ── FLAGS ──
        this.stageComplete      = false;
        this.stageCompleteTimer = 0;
        this.hudFlash           = {};
        this.showNewRecord      = false;
        this.newRecordTimer     = 0;

        // ── POWER-UPS ──
        this.powerUps = {
            extraKnife: { count: this.playerData.powerUps?.extraKnife ?? 2, cost:50,  icon:'🗡', name:'Extra',  color:'#00FF88' },
            slowTarget: { count: this.playerData.powerUps?.slowTarget ?? 1, cost:75,  icon:'🐢', name:'Slow',   color:'#00D4FF' },
            shield:     { count: this.playerData.powerUps?.shield     ?? 1, cost:100, icon:'🛡', name:'Shield', color:'#b347d9' },
            bomb:       { count: this.playerData.powerUps?.bomb       ?? 0, cost:150, icon:'💣', name:'Bomb',   color:'#FF8C00' }
        };
        this.activeEffects = { slow:false, slowTimer:0, shield:false };

        // ── DAILY REWARD ──
        this.showDailyReward    = false;
        this.dailyRewardClaimed = false;
        this.dailyRewardAnim    = 0;
        this.checkDailyReward();

        // ── MILESTONES ──
        this.milestones        = [5,10,20,30,50,75,100,150,200];
        this.milestonesClaimed = new Set();

        // ── BG ──
        this.stars    = this.makeStars(this.isMobile ? 55 : 100);
        this.nebulae  = this.makeNebulae();
        this.gridLines= [];
        this.makeGridLines();

        // ── FULLSCREEN ──
        this.fsBtn = null;
        this.createFullscreenButton();

        // ── INIT ──
        this.setupLevel();
        this.createIdleKnife();
        this.bindEvents();

        this.lastTime = 0;
        this.animId = requestAnimationFrame(t => this.loop(t));
    }

    /* ══════════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════════ */
    clamp(v,mn,mx){ return Math.max(mn,Math.min(mx,v)); }
    rand(mn,mx)   { return mn + Math.random()*(mx-mn); }

    /* ══════════════════════════════════════════════
       HD CANVAS — 4K
    ══════════════════════════════════════════════ */
    setupHDCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const w    = rect.width  || this.canvas.clientWidth  || 400;
        const h    = rect.height || this.canvas.clientHeight || 700;
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

    /* ── DPR Helpers ── */
    dX(x)  { return Math.round(x * this.dpr); }
    dY(y)  { return Math.round(y * this.dpr); }
    dS(s)  { return s * this.dpr; }
    dSr(s) { return Math.round(s * this.dpr); }

    /* ══════════════════════════════════════════════
       CRISP TEXT — 4K
    ══════════════════════════════════════════════ */
    drawText(ctx, text, x, y, opts = {}) {
        const {
            size=14, weight='bold', color='#FFFFFF',
            align='left', baseline='alphabetic',
            family=null, glow=false, glowColor=null, glowBlur=0,
            stroke=false, strokeColor='rgba(0,0,0,0.7)', strokeWidth=3,
            opacity=1, maxWidth=0
        } = opts;

        if (opacity <= 0) return;
        ctx.save();
        ctx.globalAlpha  = Math.min(1, opacity);
        ctx.textAlign    = align;
        ctx.textBaseline = baseline;
        ctx.font = `${weight} ${Math.round(size * this.dpr)}px ${family || (size > 16 ? this.FONT_TITLE : this.FONT_UI)}`;

        const px = this.dX(x), py = this.dY(y);
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
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = Math.min(1, opacity * 0.6);
            ctx.fillText(text, px, py, mw);
            ctx.globalAlpha = prevAlpha;
        }
        ctx.shadowBlur  = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle   = color;
        ctx.fillText(text, px, py, mw);
        ctx.restore();
    }

    /* ══════════════════════════════════════════════
       SHAPE HELPERS
    ══════════════════════════════════════════════ */
    fillRect(ctx,x,y,w,h) { ctx.fillRect(this.dX(x),this.dY(y),this.dSr(w),this.dSr(h)); }
    drawCircle(ctx,x,y,r) { ctx.beginPath(); ctx.arc(this.dX(x),this.dY(y),this.dS(r),0,this.TAU); }
    drawRoundRect(ctx,x,y,w,h,r) {
        const dx=this.dX(x),dy=this.dY(y),dw=this.dSr(w),dh=this.dSr(h),dr=this.dS(r);
        ctx.beginPath();
        ctx.moveTo(dx+dr,dy);
        ctx.arcTo(dx+dw,dy,dx+dw,dy+dh,dr);
        ctx.arcTo(dx+dw,dy+dh,dx,dy+dh,dr);
        ctx.arcTo(dx,dy+dh,dx,dy,dr);
        ctx.arcTo(dx,dy,dx+dw,dy,dr);
        ctx.closePath();
    }
    drawLine(ctx,x1,y1,x2,y2) {
        ctx.beginPath();
        ctx.moveTo(this.dX(x1),this.dY(y1));
        ctx.lineTo(this.dX(x2),this.dY(y2));
    }

    /* ══════════════════════════════════════════════
       FULLSCREEN BUTTON
    ══════════════════════════════════════════════ */
    createFullscreenButton() {
        const existing = document.getElementById('knifeHitFsBtn');
        if (existing) existing.remove();

        this.fsBtn = document.createElement('button');
        this.fsBtn.id    = 'knifeHitFsBtn';
        this.fsBtn.title = 'Fullscreen';
        this.fsBtn.setAttribute('aria-label','Toggle fullscreen');

        Object.assign(this.fsBtn.style, {
            position:'fixed', bottom:'18px', right:'18px', zIndex:'9999',
            width:'44px', height:'44px', border:'none', borderRadius:'12px',
            background:'rgba(10,5,20,0.82)',
            backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
            boxShadow:'0 4px 20px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(179,71,217,0.2)',
            cursor:'pointer', display:'flex', alignItems:'center',
            justifyContent:'center', padding:'0',
            transition:'background .2s, transform .15s, box-shadow .2s'
        });

        this.fsBtn.innerHTML = this._fsExpandSVG();
        document.body.appendChild(this.fsBtn);

        this.fsBtn.addEventListener('mouseenter', () => {
            this.fsBtn.style.background  = 'rgba(30,10,60,0.95)';
            this.fsBtn.style.transform   = 'scale(1.1)';
            this.fsBtn.style.boxShadow   = '0 6px 24px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(179,71,217,0.4)';
        });
        this.fsBtn.addEventListener('mouseleave', () => {
            this.fsBtn.style.background  = 'rgba(10,5,20,0.82)';
            this.fsBtn.style.transform   = 'scale(1)';
            this.fsBtn.style.boxShadow   = '0 4px 20px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(179,71,217,0.2)';
        });

        this._boundFsClick  = () => this._toggleFullscreen();
        this._boundFsChange = () => this._updateFsIcon();
        this.fsBtn.addEventListener('click', this._boundFsClick);
        document.addEventListener('fullscreenchange',       this._boundFsChange);
        document.addEventListener('webkitfullscreenchange', this._boundFsChange);
    }

    _fsExpandSVG() {
        return `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:#b347d9;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    }
    _fsCollapseSVG() {
        return `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:#b347d9;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
            <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
            <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`;
    }
    _isFullscreen()  { return !!(document.fullscreenElement||document.webkitFullscreenElement); }
    _updateFsIcon()  { if(this.fsBtn) this.fsBtn.innerHTML = this._isFullscreen() ? this._fsCollapseSVG() : this._fsExpandSVG(); }
    _toggleFullscreen() {
        const el=document.documentElement;
        if (!this._isFullscreen()) (el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen).call(el);
        else (document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen).call(document);
    }

    /* ══════════════════════════════════════════════
       AUDIO — Satisfying Sounds
    ══════════════════════════════════════════════ */
    initAudio() {
        if (this.audioCtx) {
            if (this.audioCtx.state==='suspended') this.audioCtx.resume().then(()=>{this.audioReady=true;});
            return;
        }
        try {
            const AC = window.AudioContext||window.webkitAudioContext;
            if (!AC) return;
            this.audioCtx   = new AC();
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            this.compressor = this.audioCtx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-16, this.audioCtx.currentTime);
            this.compressor.knee.setValueAtTime(6,  this.audioCtx.currentTime);
            this.compressor.ratio.setValueAtTime(4,  this.audioCtx.currentTime);
            this.compressor.attack.setValueAtTime(0.002, this.audioCtx.currentTime);
            this.compressor.release.setValueAtTime(0.12, this.audioCtx.currentTime);
            this.compressor.connect(this.masterGain);
            this.masterGain.connect(this.audioCtx.destination);
            this.audioCtx.state==='suspended'
                ? this.audioCtx.resume().then(()=>{this.audioReady=true;})
                : (this.audioReady=true);
        } catch(e){}
    }

    _audioOk() { return this.audioCtx && this.audioReady && this.audioCtx.state==='running'; }
    _out()     { return this.compressor || this.masterGain; }

    _tone(type,freq,dur,vol,endMul=1,delay=0) {
        if(!this._audioOk()) return;
        try {
            const ctx=this.audioCtx, now=ctx.currentTime+delay;
            const osc=ctx.createOscillator(), g=ctx.createGain();
            osc.type=type;
            osc.frequency.setValueAtTime(Math.max(20,freq),now);
            if(endMul!==1) osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq*endMul),now+dur);
            g.gain.setValueAtTime(0.0001,now);
            g.gain.linearRampToValueAtTime(vol,now+0.005);
            g.gain.exponentialRampToValueAtTime(0.0001,now+Math.max(dur,0.01));
            osc.connect(g); g.connect(this._out());
            osc.start(now); osc.stop(now+dur+0.05);
        } catch(e){}
    }

    _noise(dur,vol,hp=800,delay=0) {
        if(!this._audioOk()) return;
        try {
            const ctx=this.audioCtx, now=ctx.currentTime+delay;
            const sr=ctx.sampleRate, len=Math.max(1,Math.floor(sr*dur));
            const buf=ctx.createBuffer(1,len,sr), data=buf.getChannelData(0);
            for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/len,0.5);
            const src=ctx.createBufferSource(); src.buffer=buf;
            const hpf=ctx.createBiquadFilter(); hpf.type='highpass'; hpf.frequency.value=hp;
            const g=ctx.createGain();
            g.gain.setValueAtTime(vol,now);
            g.gain.exponentialRampToValueAtTime(0.0001,now+Math.max(dur,0.01));
            src.connect(hpf); hpf.connect(g); g.connect(this._out());
            src.start(now); src.stop(now+dur+0.04);
        } catch(e){}
    }

    // Satisfying knife throw — whoosh sound
    playKnifeThrow() {
        if(!this._audioOk()) return;
        this._noise(0.09,0.18,1200,0);
        this._tone('sine',380,0.07,0.10,2.8,0);
        this._tone('triangle',520,0.05,0.06,0.4,0.01);
    }

    // Deep satisfying THUNK when knife hits log
    playKnifeHit(combo=1) {
        if(!this._audioOk()) return;
        const vol = Math.min(0.35, 0.18+combo*0.02);
        this._tone('sine',70,0.14,vol*1.2,0.25,0);
        this._tone('triangle',140,0.10,vol,0.4,0.01);
        this._noise(0.07,vol*0.9,500,0);
        this._noise(0.04,0.10,2200,0.03);
        // Satisfying mid-tone punch
        this._tone('sine',220,0.06,vol*0.7,0.5,0.01);
    }

    // Close call — near miss sound
    playCloseCall() {
        if(!this._audioOk()) return;
        this._tone('sine',880,0.08,0.12,1.5,0);
        this._tone('triangle',1200,0.06,0.08,0.8,0.04);
        this._noise(0.05,0.06,3000,0);
    }

    // Streak sounds — escalating pitch
    playStreakSound(streak) {
        if(!this._audioOk()) return;
        const freqs=[440,523,659,784,880,1047,1175,1319];
        const f=freqs[Math.min(streak-1,freqs.length-1)];
        this._tone('sine',f,0.15,0.14,1.05,0);
        this._tone('triangle',f*1.5,0.10,0.10,1.02,0.05);
        if(streak>=5) {
            this._tone('sine',f*2,0.08,0.12,1.02,0.10);
        }
    }

    playKnifeCollision() {
        if(!this._audioOk()) return;
        this._tone('square',1800,0.14,0.18,0.2,0);
        this._tone('triangle',2400,0.10,0.12,0.15,0.02);
        this._tone('sine',900,0.22,0.15,0.3,0);
        this._noise(0.12,0.25,1200,0);
        this._tone('sine',60,0.25,0.22,0.2,0.02);
    }

    playAppleHit(type) {
        if(!this._audioOk()) return;
        if(type==='diamond') {
            this._tone('sine',2000,0.16,0.12,0.5,0);
            this._tone('triangle',3000,0.12,0.10,0.3,0.04);
            this._tone('sine',4200,0.08,0.08,0.2,0.08);
            this._noise(0.08,0.14,3500,0);
        } else if(type==='golden') {
            this._tone('sine',1100,0.18,0.12,1.02,0);
            this._tone('sine',1650,0.14,0.10,1.02,0.06);
            this._tone('triangle',2200,0.10,0.08,0.8,0.12);
        } else {
            this._tone('sine',280,0.10,0.14,0.4,0);
            this._tone('triangle',460,0.08,0.10,0.5,0.02);
            this._noise(0.12,0.16,1600,0);
        }
    }

    playCoinCollect() {
        if(!this._audioOk()) return;
        this._tone('sine',900,0.08,0.07,1.5,0);
        this._tone('sine',1350,0.06,0.05,1.2,0.05);
    }

    playCombo(count) {
        if(!this._audioOk()) return;
        const base=[523,587,659,740,784,880,988,1047];
        const n=Math.min(count-1,base.length-1);
        for(let i=0;i<=Math.min(n,3);i++) this._tone('sine',base[Math.min(i,base.length-1)],0.12,0.08,1,i*0.06);
        this._tone('triangle',base[n],0.18,0.10,1.05,n*0.06);
    }

    playStageComplete() {
        if(!this._audioOk()) return;
        [523,659,784,1047,1319,1568].forEach((f,i)=>{
            this._tone('sine',f,0.24,0.12,1.02,i*0.10);
            this._tone('triangle',f*2,0.14,0.06,1.01,i*0.10+0.05);
        });
    }

    playGameOverSound() {
        if(!this._audioOk()) return;
        [400,340,280,220,160].forEach((f,i)=>{
            this._tone('sine',f,0.55,0.14,0.6,i*0.22);
            this._tone('triangle',f*1.5,0.38,0.08,0.5,i*0.22+0.05);
        });
    }

    playNoKnives() {
        if(!this._audioOk()) return;
        this._tone('sine',300,0.20,0.14,0.5,0);
        this._tone('triangle',200,0.28,0.12,0.4,0.12);
        this._noise(0.18,0.10,300,0);
    }

    playPowerUp() {
        if(!this._audioOk()) return;
        this._tone('sine',600,0.12,0.10,2.0,0);
        this._tone('sine',900,0.10,0.08,1.8,0.06);
        this._tone('triangle',1200,0.12,0.08,1.5,0.12);
    }

    playBomb() {
        if(!this._audioOk()) return;
        this._tone('sine',50,0.30,0.30,0.15,0);
        this._tone('sawtooth',100,0.20,0.18,0.2,0);
        this._noise(0.30,0.35,150,0);
        this._noise(0.20,0.20,500,0.06);
    }

    playReward() {
        if(!this._audioOk()) return;
        [660,880,1100,1320].forEach((f,i)=>this._tone('sine',f,0.16,0.10,1.02,i*0.08));
    }

    playTick() { if(!this._audioOk()) return; this._tone('sine',1000,0.03,0.04,1.1,0); }

    playNewRecord() {
        if(!this._audioOk()) return;
        [523,659,784,1047,1319,1568,2093].forEach((f,i)=>{
            this._tone('sine',f,0.20,0.15,1.02,i*0.08);
            this._tone('triangle',f*1.5,0.12,0.08,1.01,i*0.08+0.04);
        });
    }

    /* ══════════════════════════════════════════════
       SAVE / LOAD
    ══════════════════════════════════════════════ */
    loadPlayerData() {
        const defaults = {
            coins:0, diamonds:0, currentLevel:1, highestLevel:1,
            bestScore:0, totalKnivesThrown:0, totalApplesHit:0,
            gamesPlayed:0, totalCoinsEarned:0, totalDiamondsEarned:0,
            dailyStreak:0, lastDailyReward:null, bestTime:99999,
            levelStars:{}, powerUps:{}, currentSkin:'default', skinsUnlocked:['default']
        };
        try {
            const s=JSON.parse(localStorage.getItem(this.saveKey));
            return s?{...defaults,...s}:defaults;
        } catch { return defaults; }
    }

    savePlayerData() {
        this.playerData.powerUps={};
        Object.keys(this.powerUps).forEach(k=>{this.playerData.powerUps[k]=this.powerUps[k].count;});
        try { localStorage.setItem(this.saveKey, JSON.stringify(this.playerData)); } catch(e){}
    }

    /* ══════════════════════════════════════════════
       DAILY REWARD
    ══════════════════════════════════════════════ */
    checkDailyReward() {
        const today=new Date().toDateString(), last=this.playerData.lastDailyReward;
        if(last!==today) {
            if(last){const diff=Math.floor((new Date()-new Date(last))/86400000);if(diff>1)this.playerData.dailyStreak=0;}
            this.showDailyReward=true; this.dailyRewardClaimed=false; this.dailyRewardAnim=0;
        }
    }

    claimDailyReward() {
        if(this.dailyRewardClaimed) return;
        const streak=this.playerData.dailyStreak, mult=Math.min(1+streak*0.3,4);
        const coins=Math.floor(60*mult), dias=Math.floor(2*Math.max(1,Math.floor(streak/3)));
        let bonusPup=null;
        if(streak>0&&streak%5===0){const keys=Object.keys(this.powerUps);bonusPup=keys[Math.floor(Math.random()*keys.length)];this.powerUps[bonusPup].count++;}
        this.playerData.coins+=coins; this.playerData.diamonds+=dias;
        this.playerData.totalCoinsEarned+=coins; this.playerData.totalDiamondsEarned+=dias;
        this.playerData.lastDailyReward=new Date().toDateString(); this.playerData.dailyStreak++;
        this.dailyRewardClaimed=true; this.showDailyReward=false;
        this.addFloatingText(this.W/2,this.H/2-40,`+${coins} Coins`,'#FFD700',22,160);
        this.addFloatingText(this.W/2,this.H/2,`+${dias} Diamonds`,'#00D4FF',20,160);
        if(bonusPup) this.addFloatingText(this.W/2,this.H/2+40,`+1 ${this.powerUps[bonusPup].name}!`,'#00FF88',16,160);
        this.spawnCelebration(this.W/2,this.H/2,22); this.playReward(); this.savePlayerData();
    }

    /* ══════════════════════════════════════════════
       LEVEL CONFIG — Easier Early Levels
    ══════════════════════════════════════════════ */
    getLevelConfig(level) {
        const l=Math.min(level,25);
        const configs={
            // EASY — hook players first
            1: {knives:8, speed:0.012,pattern:'constant',apples:0,bossMode:false,name:'Warm Up'},
            2: {knives:8, speed:0.016,pattern:'constant',apples:1,bossMode:false,name:'First Apple'},
            3: {knives:9, speed:0.018,pattern:'constant',apples:1,bossMode:false,name:'Steady'},
            4: {knives:9, speed:0.022,pattern:'wobble',  apples:1,bossMode:false,name:'Wobbler'},
            5: {knives:10,speed:0.026,pattern:'wobble',  apples:2,bossMode:true, name:'BOSS 1'},
            // MEDIUM
            6: {knives:9, speed:0.028,pattern:'reverse', apples:2,bossMode:false,name:'Reversal'},
            7: {knives:10,speed:0.032,pattern:'wobble',  apples:2,bossMode:false,name:'Speedster'},
            8: {knives:10,speed:0.036,pattern:'erratic', apples:2,bossMode:false,name:'Erratic'},
            9: {knives:11,speed:0.038,pattern:'erratic', apples:3,bossMode:false,name:'Triple Threat'},
            10:{knives:12,speed:0.044,pattern:'erratic', apples:2,bossMode:true, name:'BOSS 2'},
            // HARD
            11:{knives:11,speed:0.040,pattern:'reverse', apples:3,bossMode:false,name:'Fast Spin'},
            12:{knives:12,speed:0.044,pattern:'crazy',   apples:2,bossMode:false,name:'Going Crazy'},
            13:{knives:12,speed:0.048,pattern:'crazy',   apples:3,bossMode:false,name:'Nonstop'},
            14:{knives:13,speed:0.052,pattern:'crazy',   apples:3,bossMode:false,name:'Intense'},
            15:{knives:14,speed:0.056,pattern:'crazy',   apples:4,bossMode:true, name:'BOSS 3'},
            // EXPERT
            16:{knives:12,speed:0.050,pattern:'erratic', apples:3,bossMode:false,name:'Storm'},
            17:{knives:13,speed:0.054,pattern:'crazy',   apples:3,bossMode:false,name:'Vortex'},
            18:{knives:13,speed:0.058,pattern:'crazy',   apples:4,bossMode:false,name:'Chaos'},
            19:{knives:14,speed:0.062,pattern:'crazy',   apples:4,bossMode:false,name:'Mayhem'},
            20:{knives:15,speed:0.068,pattern:'crazy',   apples:4,bossMode:true, name:'MEGA BOSS'},
            // MASTER
            21:{knives:13,speed:0.064,pattern:'crazy',   apples:4,bossMode:false,name:'Legend'},
            22:{knives:14,speed:0.066,pattern:'crazy',   apples:4,bossMode:false,name:'Mythic'},
            23:{knives:14,speed:0.070,pattern:'crazy',   apples:4,bossMode:false,name:'Divine'},
            24:{knives:15,speed:0.074,pattern:'crazy',   apples:4,bossMode:false,name:'Immortal'},
            25:{knives:16,speed:0.078,pattern:'crazy',   apples:4,bossMode:true, name:'FINAL BOSS'}
        };
        if(configs[l]) return configs[l];
        return{knives:Math.min(8+Math.floor(l/3),20),speed:Math.min(0.015+l*0.004,0.12),pattern:'crazy',apples:Math.min(Math.floor(l/4),4),bossMode:l%5===0,name:`Endless ${l}`};
    }

    /* ══════════════════════════════════════════════
       TARGET & LEVEL SETUP
    ══════════════════════════════════════════════ */
    createTarget() {
        return {
            x:this.W/2, y:this.H/2-60,
            radius:Math.min(this.W,this.H)*0.155,
            angle:0, speed:0.015, baseSpeed:0.015,
            direction:1, pattern:'constant',
            patternTimer:0, wobbleY:0,
            bossMode:false, bossAngle:0, config:null
        };
    }

    setupLevel() {
        const cfg=this.getLevelConfig(this.level);
        this.levelCfg=cfg;
        this.stuckKnives=[]; this.apples=[]; this.orbitCoins=[];
        this.flyingKnife=null;
        this.knivesTotal=cfg.knives; this.knivesLeft=cfg.knives; this.knivesThrown=0;
        this.combo=0; this.streak=0; this.perfectHits=0;
        this.stageComplete=false; this.stageCompleteTimer=0;
        this.noKnivesLeft=false; this.noKnivesOverlayAlpha=0;
        this.breakPieces=[]; this.particles=[]; this.explosions=[];
        this.scorePopups=[]; this.popRings=[]; this.trailParticles=[];
        this.shockwaves=[]; this.ribbons=[];
        this.levelStartTime=Date.now();

        const t=this.target;
        t.radius=Math.min(this.W,this.H)*0.155;
        t.angle=0; t.direction=1;
        t.speed=cfg.speed; t.baseSpeed=cfg.speed;
        t.pattern=cfg.pattern; t.patternTimer=0;
        t.bossMode=cfg.bossMode; t.bossAngle=0; t.wobbleY=0;
        t.config=cfg; t.x=this.W/2; t.y=this.H/2-60;

        this.spawnApples(cfg.apples);
        this.spawnOrbitCoins();

        const col = cfg.bossMode?'#FF006E':'#00FF88';
        this.addFloatingText(this.W/2,this.H/2,`Level ${this.level}`,col,26,120);
        this.addFloatingText(this.W/2,this.H/2+34,cfg.name,col,15,110);
        this.createIdleKnife();
    }

    createIdleKnife() {
        this.idleKnife={
            x:this.W/2,
            y:this.H-(this.isMobile?75:90),
            wobble:0, bounce:0, readyPulse:0
        };
    }

    spawnApples(count) {
        this.apples=[];
        const used=[];
        for(let i=0;i<count;i++){
            let angle, tries=0;
            do{angle=Math.random()*this.TAU;tries++;}
            while(used.some(a=>Math.abs(a-angle)<0.9)&&tries<60);
            used.push(angle);
            const isDiamond=Math.random()<0.1;
            const isGolden=!isDiamond&&Math.random()<0.25;
            this.apples.push({angle,hit:false,scale:1,wobble:0,type:isDiamond?'diamond':isGolden?'golden':'red',hitAnim:0});
        }
    }

    spawnOrbitCoins() {
        this.orbitCoins=[];
        const count=Math.min(2+Math.floor(this.level/3),5);
        for(let i=0;i<count;i++){
            this.orbitCoins.push({angle:(this.TAU*i)/count,orbitR:this.target.radius+30,collected:false,wobble:0});
        }
    }

    /* ══════════════════════════════════════════════
       EVENTS
    ══════════════════════════════════════════════ */
    bindEvents() {
        this._onClick=(e)=>{
            this.initAudio();
            if(this.showDailyReward){this.claimDailyReward();return;}
            if(this.noKnivesLeft&&this.noKnivesOverlayAlpha>0.8){
                const p=this.getLogicalPos(e);
                if(this._isRetryBtnHit(p.x,p.y)){this._retryLevel();return;}
                if(this._isNextBtnHit(p.x,p.y)){this._goGameOver();return;}
                return;
            }
            if(this.paused||this.gameOver) return;
            const p=this.getLogicalPos(e);
            if(this.handleUIClick(p.x,p.y)) return;
            if(this.stageComplete||this.flyingKnife||this.knivesLeft<=0) return;
            this.throwKnife();
        };

        this._onTouch=(e)=>{
            e.preventDefault();
            this.initAudio();
            if(this.showDailyReward){this.claimDailyReward();return;}
            if(this.noKnivesLeft&&this.noKnivesOverlayAlpha>0.8){
                const p=this.getLogicalPos(e);
                if(this._isRetryBtnHit(p.x,p.y)){this._retryLevel();return;}
                if(this._isNextBtnHit(p.x,p.y)){this._goGameOver();return;}
                return;
            }
            if(this.paused||this.gameOver) return;
            const p=this.getLogicalPos(e);
            if(this.handleUIClick(p.x,p.y)) return;
            if(this.stageComplete||this.flyingKnife||this.knivesLeft<=0) return;
            this.throwKnife();
        };

        this._onKey=(e)=>{
            if(this.destroyed) return;
            this.initAudio();
            if(e.code==='Space'){e.preventDefault();if(!this.noKnivesLeft)this.throwKnife();}
            if(e.code==='KeyR'&&this.noKnivesLeft)this._retryLevel();
            const keys=['extraKnife','slowTarget','shield','bomb'];
            if(e.key>='1'&&e.key<='4') this.usePowerUp(keys[+e.key-1]);
        };

        this.canvas.addEventListener('click',this._onClick);
        this.canvas.addEventListener('touchstart',this._onTouch,{passive:false});
        document.addEventListener('keydown',this._onKey);
    }

    /* ── No Knives popup hit detection ── */
    _noKnivesPopupDims(){
        const pw=Math.min(this.W-30,320),ph=280;
        const px=(this.W-pw)/2,py=(this.H-ph)/2;
        return{pw,ph,px,py};
    }
    _isRetryBtnHit(mx,my){
        const{pw,ph,px,py}=this._noKnivesPopupDims();
        const bx=px+pw/2-80,by=py+ph-68,bw=160,bh=42;
        return mx>=bx&&mx<=bx+bw&&my>=by&&my<=by+bh;
    }
    _isNextBtnHit(mx,my){
        const{pw,ph,px,py}=this._noKnivesPopupDims();
        const bx=px+pw/2-80,by=py+ph-22,bw=160,bh=20;
        return mx>=bx&&mx<=bx+bw&&my>=by&&my<=by+bh;
    }
    _retryLevel(){
        this.lives=Math.max(1,this.lives);
        this.noKnivesLeft=false; this.noKnivesOverlayAlpha=0;
        this.setupLevel();
    }
    _goGameOver(){
        this.noKnivesLeft=false; this.lives=0;
        this.onCollisionDeath();
    }

    getLogicalPos(e){
        const rect=this.canvas.getBoundingClientRect();
        const sx=this.W/rect.width, sy=this.H/rect.height;
        let cx,cy;
        if(e.touches){cx=(e.touches[0]||e.changedTouches[0]).clientX;cy=(e.touches[0]||e.changedTouches[0]).clientY;}
        else{cx=e.clientX;cy=e.clientY;}
        return{x:(cx-rect.left)*sx,y:(cy-rect.top)*sy};
    }

    handleUIClick(mx,my){
        const btnS=this.isMobile?40:36;
        const btnY=this.idleKnife?this.idleKnife.y+42:this.H-46;
        let idx=0;
        for(const key of Object.keys(this.powerUps)){
            const bx=8+idx*(btnS+6);
            if(mx>=bx&&mx<=bx+btnS&&my>=btnY&&my<=btnY+btnS){this.usePowerUp(key);return true;}
            idx++;
        }
        return false;
    }

    /* ══════════════════════════════════════════════
       POWER-UPS
    ══════════════════════════════════════════════ */
    usePowerUp(type){
        const pup=this.powerUps[type];
        if(!pup||pup.count<=0||this.gameOver||this.stageComplete) return;
        pup.count--;
        switch(type){
            case 'extraKnife':
                this.knivesLeft+=2; this.knivesTotal+=2;
                this.noKnivesLeft=false; this.noKnivesOverlayAlpha=0;
                this.addFloatingText(this.W/2,this.H*0.35,'+2 Knives!','#00FF88',18,90);
                break;
            case 'slowTarget':
                this.activeEffects.slow=true; this.activeEffects.slowTimer=5000;
                this.target.speed=this.target.baseSpeed*0.35;
                this.addFloatingText(this.W/2,this.H*0.35,'Slow Motion!','#00D4FF',18,90);
                break;
            case 'shield':
                this.activeEffects.shield=true;
                this.addFloatingText(this.W/2,this.H*0.35,'Shield ON!','#b347d9',18,90);
                break;
            case 'bomb':
                this.bombClear();
                break;
        }
        this.playPowerUp(); this.savePlayerData();
    }

    bombClear(){
        const count=this.stuckKnives.length;
        if(count===0) return;
        this.stuckKnives.forEach(sk=>{
            const pos=this.getKnifeWorldPos(sk);
            this.spawnParticles(pos.x,pos.y,'#FF8C00',10);
            this.explosions.push({x:pos.x,y:pos.y,radius:5,opacity:0.9,color:'#FF8C00'});
        });
        this.stuckKnives=[];
        const bonus=count*5; this.score+=bonus; this.onScore(this.score);
        this.earnCoins(count*2,this.target.x,this.target.y);
        this.addFloatingText(this.W/2,this.H/2,`BOOM! +${bonus}`,'#FF8C00',22,100);
        this.shake(14,10); this.playBomb();
    }

    /* ══════════════════════════════════════════════
       THROW KNIFE — Fast & Satisfying
    ══════════════════════════════════════════════ */
    throwKnife(){
        if(this.flyingKnife||this.knivesLeft<=0||this.stageComplete||this.gameOver||this.noKnivesLeft) return;
        this.knivesLeft--;
        this.knivesThrown++;
        this.playerData.totalKnivesThrown++;
        if(this.idleKnife) this.idleKnife.bounce=10;

        // Faster knife speed — more satisfying
        const knifeSpeed = this.isMobile ? 16 : 20;

        this.flyingKnife={
            x:this.W/2,
            y:this.idleKnife?this.idleKnife.y:this.H-90,
            vy:-knifeSpeed,
            vx:0, trail:[], skin:this.currentSkin,
            launchTime:this.time
        };
        this.playKnifeThrow();
    }

    /* ══════════════════════════════════════════════
       UPDATE
    ══════════════════════════════════════════════ */
    update(dt){
        if(this.paused||this.gameOver) return;
        this.time+=dt; this.frame++;

        // No knives overlay animation
        if(this.noKnivesLeft){
            this.noKnivesOverlayAlpha=Math.min(1,this.noKnivesOverlayAlpha+0.04);
            this.updateParticles(); this.updateFloatingTexts(); this.updatePopRings();
            this.updateExplosions(); this.updateCoinPickups();
            return;
        }

        if(this.showDailyReward){this.dailyRewardAnim=Math.min(1,this.dailyRewardAnim+0.06);}

        if(this.stageComplete){
            this.stageCompleteTimer++;
            this.updateBreakPieces(); this.updateParticles();
            this.updateFloatingTexts(); this.updatePopRings();
            this.updateShockwaves(); this.updateRibbons();
            if(this.stageCompleteTimer>=80){
                this.level++; this.stage++;
                this.playerData.currentLevel=this.level;
                if(this.level>this.playerData.highestLevel) this.playerData.highestLevel=this.level;
                this.savePlayerData();
                this.setupLevel();
            }
            return;
        }

        // Shake
        if(this.shakeTimer>0){
            const f=this.shakeForce*(this.shakeTimer/14);
            this.shakeX=(Math.random()-0.5)*f; this.shakeY=(Math.random()-0.5)*f*0.5;
            this.shakeTimer--;
        } else {this.shakeX=0;this.shakeY=0;}

        if(this.flashTimer>0) this.flashTimer--;
        if(this.vignetteFlash>0) this.vignetteFlash--;
        if(this.hitPulseTimer>0) this.hitPulseTimer--;
        if(this.newRecordTimer>0) this.newRecordTimer--;
        Object.keys(this.hudFlash).forEach(k=>{if(this.hudFlash[k]>0)this.hudFlash[k]--;});

        if(this.activeEffects.slow){
            this.activeEffects.slowTimer-=dt;
            if(this.activeEffects.slowTimer<=0){
                this.activeEffects.slow=false;
                this.target.speed=this.target.baseSpeed;
                this.addFloatingText(this.W/2,this.H*0.35,'Slow Ended','#888',13,60);
            }
        }

        this.updateTargetRotation(dt);

        if(this.target.bossMode){this.target.bossAngle+=0.045;this.target.wobbleY=Math.sin(this.target.bossAngle)*24;}
        else this.target.wobbleY=0;

        if(this.flyingKnife) this.updateFlyingKnife();

        if(this.idleKnife){
            this.idleKnife.wobble=Math.sin(this.time/700)*3.5;
            this.idleKnife.readyPulse=Math.sin(this.time/320)*0.3+0.7;
            if(this.idleKnife.bounce>0) this.idleKnife.bounce-=0.8;
        }

        this.updateOrbitCoins();
        this.apples.forEach(a=>{
            if(!a.hit) a.wobble=Math.sin(this.time/320+a.angle)*0.045;
            else a.scale=Math.max(0,a.scale-0.08);
        });
        this.stars.forEach(s=>{s.phase+=s.speed;});
        this.updateGridLines();

        this.updateParticles(); this.updateExplosions();
        this.updateScorePopups(); this.updateFloatingTexts();
        this.updateCoinPickups(); this.updatePopRings();
        this.updateTrailParticles(); this.updateShockwaves();
        this.updateRibbons();
    }

    updateTargetRotation(dt){
        const t=this.target; t.patternTimer+=dt||16;
        const slow=this.activeEffects.slow?0.35:1;
        switch(t.pattern){
            case 'constant': t.angle+=t.speed*t.direction*slow; break;
            case 'wobble':   t.angle+=t.speed*t.direction*slow;if(t.patternTimer>1800){t.direction*=-1;t.patternTimer=0;}break;
            case 'reverse':  t.speed=t.baseSpeed*(1+0.5*Math.abs(Math.sin(t.patternTimer/900)));t.angle+=t.speed*t.direction*slow;if(t.patternTimer>1200+Math.random()*600){t.direction*=-1;t.patternTimer=0;}break;
            case 'erratic':  t.speed=t.baseSpeed*(1+0.8*Math.abs(Math.sin(t.patternTimer/600)));t.angle+=t.speed*t.direction*slow;if(t.patternTimer>700+Math.random()*1000){t.direction*=-1;t.patternTimer=0;this.shake(2,3);}break;
            case 'crazy':    t.speed=t.baseSpeed*(1+Math.abs(Math.sin(t.patternTimer/400)));t.angle+=t.speed*t.direction*slow;if(Math.random()<0.006){t.direction*=-1;t.patternTimer=0;this.shake(3,4);}if(Math.random()<0.002)t.angle+=t.direction*0.3*slow;break;
        }
    }

    updateFlyingKnife(){
        const k=this.flyingKnife;
        k.trail.push({x:k.x,y:k.y});
        if(k.trail.length>16) k.trail.shift();

        if(this.frame%2===0&&this.trailParticles.length<40){
            this.trailParticles.push({x:k.x+this.rand(-2,2),y:k.y+this.rand(0,6),life:1,decay:0.09,size:this.rand(1.5,3.5),color:this.getSkinColor()});
        }

        k.x+=k.vx; k.y+=k.vy;
        const ty=this.target.y+this.target.wobbleY;
        const dx=k.x-this.target.x, dy=k.y-ty;
        const dist=Math.sqrt(dx*dx+dy*dy);

        if(dist<=this.target.radius+12){this.onKnifeHitTarget(dx,dy,dist);return;}
        if(k.y<-100||k.y>this.H+100) this.flyingKnife=null;
    }

    updateOrbitCoins(){
        this.orbitCoins.forEach(c=>{
            c.angle+=0.020; c.wobble+=0.055;
            if(c.collected) return;
            const angle=this.target.angle+c.angle;
            const cx=this.target.x+Math.cos(angle)*c.orbitR;
            const cy=this.target.y+this.target.wobbleY+Math.sin(angle)*c.orbitR;
            if(this.flyingKnife){
                const dx=this.flyingKnife.x-cx,dy=this.flyingKnife.y-cy;
                if(Math.sqrt(dx*dx+dy*dy)<22){
                    c.collected=true;
                    this.earnCoins(1+Math.floor(this.level/5),cx,cy);
                    this.spawnParticles(cx,cy,'#FFD700',8);
                    this.popRings.push({x:cx,y:cy,radius:5,opacity:0.8,color:'#FFD700'});
                    this.playCoinCollect();
                }
            }
        });
    }

    updateParticles()    {for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=p.grav||0.14;p.vx*=0.985;p.life-=p.decay;p.size*=0.975;if(p.life<=0||p.size<0.3)this.particles.splice(i,1);}}
    updateExplosions()   {for(let i=this.explosions.length-1;i>=0;i--){const e=this.explosions[i];e.radius+=4;e.opacity-=0.052;if(e.opacity<=0)this.explosions.splice(i,1);}}
    updateScorePopups()  {for(let i=this.scorePopups.length-1;i>=0;i--){const p=this.scorePopups[i];p.y-=1.4;p.life-=2;p.opacity=p.life/60;if(p.life<=0)this.scorePopups.splice(i,1);}}
    updateFloatingTexts(){for(let i=this.floatingTexts.length-1;i>=0;i--){const t=this.floatingTexts[i];t.y-=0.7;t.life-=1;t.opacity=Math.min(1,t.life/40);t.scale+=(1-t.scale)*0.14;if(t.life<=0)this.floatingTexts.splice(i,1);}}
    updateCoinPickups()  {for(let i=this.coinPickups.length-1;i>=0;i--){const p=this.coinPickups[i];p.y+=p.vy;p.life-=2;p.opacity=Math.min(1,p.life/40);if(p.life<=0)this.coinPickups.splice(i,1);}}
    updatePopRings()     {for(let i=this.popRings.length-1;i>=0;i--){const r=this.popRings[i];r.radius+=3;r.opacity-=0.045;if(r.opacity<=0)this.popRings.splice(i,1);}}
    updateBreakPieces()  {for(let i=this.breakPieces.length-1;i>=0;i--){const p=this.breakPieces[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.30;p.rotation+=p.rotSpeed;p.vx*=0.99;p.life--;if(p.life<=0)this.breakPieces.splice(i,1);}}
    updateTrailParticles(){for(let i=this.trailParticles.length-1;i>=0;i--){const p=this.trailParticles[i];p.life-=p.decay;p.size*=0.93;if(p.life<=0)this.trailParticles.splice(i,1);}}
    updateShockwaves()   {for(let i=this.shockwaves.length-1;i>=0;i--){const s=this.shockwaves[i];s.r+=s.speed;s.opacity-=0.032;s.lineW=Math.max(0.5,s.lineW-0.06);if(s.opacity<=0)this.shockwaves.splice(i,1);}}
    updateRibbons()      {for(let i=this.ribbons.length-1;i>=0;i--){const r=this.ribbons[i];r.life--;r.y-=r.vy;r.vy*=0.96;r.x+=r.vx;r.alpha=r.life/r.maxLife;if(r.life<=0)this.ribbons.splice(i,1);}}
    updateGridLines()    {this.gridLines.forEach(g=>{g.offset=(g.offset||0)+g.speed;if(g.offset>g.spacing)g.offset-=g.spacing;});}

    /* ══════════════════════════════════════════════
       KNIFE HIT TARGET — Close Call Detection
    ══════════════════════════════════════════════ */
    onKnifeHitTarget(dx,dy,dist){
        const k=this.flyingKnife;
        const relAngle=Math.atan2(dy,dx)-this.target.angle;

        // ── Check close call BEFORE collision check ──
        let closestDiff = Infinity;
        let hitStuck=false;

        for(const sk of this.stuckKnives){
            let diff=Math.abs(relAngle-sk.angle)%(this.TAU);
            if(diff>Math.PI) diff=this.TAU-diff;
            if(diff<closestDiff) closestDiff=diff;
            if(diff<0.20){hitStuck=true;break;}
        }

        // ── CLOSE CALL detection (0.20 to 0.38 radians = very close!) ──
        const isCloseCall = !hitStuck && closestDiff<0.36 && closestDiff>=0.20 && this.stuckKnives.length>0;

        if(hitStuck){
            if(this.activeEffects.shield){
                this.activeEffects.shield=false;
                this.flashTimer=10; this.flashColor='#b347d9';
                this.shake(8,5);
                this.addFloatingText(this.W/2,this.target.y-55,'SHIELD BLOCKED!','#b347d9',18,90);
                this.flyingKnife=null; this.combo=0; this.streak=0;
                if(this.knivesLeft>0) this.createIdleKnife();
                else this.triggerNoKnivesLeft();
                this.playTick();
                return;
            }
            this.onCollision(); return;
        }

        // ── CLOSE CALL REWARD ──
        if(isCloseCall){
            this.closeCallCount++;
            const ccBonus=30+this.level*5;
            this.score+=ccBonus; this.onScore(this.score);
            this.addFloatingText(this.W/2,this.target.y-45,'⚡ CLOSE CALL! +'+ccBonus,'#FF8C00',17,100);
            this.spawnShockwave(this.target.x,this.target.y+this.target.wobbleY,'#FF8C00',this.target.radius);
            this.playCloseCall();
            this.shake(4,3);
        }

        // Apple check
        for(let i=0;i<this.apples.length;i++){
            const a=this.apples[i];
            if(a.hit) continue;
            let diff=Math.abs(relAngle-a.angle)%this.TAU;
            if(diff>Math.PI) diff=this.TAU-diff;
            if(diff<0.40){this.hitApple(i,a);break;}
        }

        this.stuckKnives.push({angle:relAngle,skin:k.skin});

        // ── STREAK SYSTEM ──
        this.streak++;
        this.streakRecord=Math.max(this.streakRecord,this.streak);
        this.combo++;
        this.maxCombo=Math.max(this.maxCombo,this.combo);
        this.perfectHits++;

        // Hit pulse for visual feedback
        this.hitPulse=1; this.hitPulseTimer=24;

        const comboMult=Math.min(this.combo,10);
        const streakBonus=this.streak>=5?Math.floor(this.streak*1.5):0;
        const scoreGain=10*comboMult+this.level*2+streakBonus;
        this.score+=scoreGain; this.onScore(this.score);

        const coinEarn=1+Math.floor(this.combo/3)+Math.floor(this.level/5);
        this.earnCoins(coinEarn,k.x,k.y-20);
        if(this.combo>0&&this.combo%5===0) this.earnDiamonds(1,k.x,k.y-40);
        this.checkMilestones();

        // Score popup color by combo
        const popCol=this.combo>=8?'#FF006E':this.combo>=5?'#FFD700':this.combo>=3?'#00FF88':'#ffffff';
        this.scorePopups.push({
            x:k.x+(Math.random()-0.5)*45, y:k.y-28,
            text:this.combo>1?(this.streak>=5?`🔥x${comboMult} +${scoreGain}`:`x${comboMult} +${scoreGain}`):`+${scoreGain}`,
            color:popCol, life:70, opacity:1
        });

        // Hit FX
        const ty=this.target.y+this.target.wobbleY;
        const ex=this.target.x+Math.cos(this.target.angle+relAngle)*this.target.radius;
        const ey=ty+Math.sin(this.target.angle+relAngle)*this.target.radius;

        this.spawnParticles(ex,ey,this.getSkinColor(),10);
        this.spawnParticles(ex,ey,'#fff',5);
        if(this.popRings.length<this.MAX_POP_RINGS)
            this.popRings.push({x:ex,y:ey,radius:5,opacity:0.7,color:this.getSkinColor()});

        // Streak milestones with big FX
        if(this.streak===3){this.addFloatingText(this.W/2,this.target.y-70,'🎯 3 IN A ROW!','#00FF88',17,100);this.spawnShockwave(this.target.x,ty,'#00FF88',this.target.radius*0.5);}
        if(this.streak===5){this.addFloatingText(this.W/2,this.target.y-70,'🔥 5 STREAK!','#FFD700',20,110);this.spawnShockwave(this.target.x,ty,'#FFD700',this.target.radius*0.7);this.spawnCelebrationBurst(this.target.x,ty,8);}
        if(this.streak===10){this.addFloatingText(this.W/2,this.target.y-80,'⚡ 10 STREAK!!','#FF006E',24,130);this.spawnShockwave(this.target.x,ty,'#FF006E',this.target.radius);this.spawnCelebrationBurst(this.target.x,ty,16);this.vignetteFlash=30;this.vignetteColor='#FF006E';}
        if(this.streak>0&&this.streak%5===0) this.playStreakSound(this.streak);
        else if(this.combo>=3) this.playCombo(this.combo);

        this.playKnifeHit(this.combo);
        this.shake(this.combo>=5?5:3, this.combo>=5?4:3);
        if(this.combo>=3){this.flashTimer=4;this.flashColor=popCol;}
        this.flyingKnife=null;

        // Ribbon particles for streaks
        if(this.streak>=3){
            for(let i=0;i<3;i++){
                this.ribbons.push({x:ex+(Math.random()-0.5)*30,y:ey,vx:(Math.random()-0.5)*3,vy:-(Math.random()*4+3),maxLife:40,life:40,alpha:1,color:popCol,w:3+Math.random()*5,h:1.5});
            }
        }

        // Check end conditions
        if(this.knivesLeft===0){
            const allApples=this.apples.every(a=>a.hit);
            setTimeout(()=>this.completeStage(allApples),380);
        } else {
            this.createIdleKnife();
        }
    }

    /* ══════════════════════════════════════════════
       NO KNIVES LEFT
    ══════════════════════════════════════════════ */
    triggerNoKnivesLeft(){
        if(this.stageComplete||this.gameOver||this.noKnivesLeft) return;
        const allApples=this.apples.every(a=>a.hit);
        if(allApples){setTimeout(()=>this.completeStage(true),380);return;}
        this.noKnivesLeft=true; this.noKnivesOverlayAlpha=0;
        this.shake(10,6);
        this.flashTimer=15; this.flashColor='#ff6600';
        this.playNoKnives();
    }

    onCollision(){
        this.lives--; this.combo=0; this.streak=0;
        this.shake(24,14);
        this.flashTimer=22; this.flashColor='#ff0055';
        this.vignetteFlash=40; this.vignetteColor='#ff0055';
        const k=this.flyingKnife;
        this.explosions.push({x:k.x,y:k.y,radius:5,opacity:1,color:'#ff0055'});
        this.spawnParticles(k.x,k.y,'#ff0055',28);
        this.spawnParticles(k.x,k.y,'#FFD700',12);
        this.spawnShockwave(k.x,k.y,'#ff0055',8);
        this.addFloatingText(this.W/2,this.H/2-25,`COLLISION!`,'#FF0055',20,110);
        this.addFloatingText(this.W/2,this.H/2+8,`Lives: ${this.lives}`,'#FF8888',14,100);
        this.playKnifeCollision();
        this.flyingKnife=null;

        if(this.lives<=0){
            this.onCollisionDeath();
        } else {
            this.createIdleKnife();
            if(this.knivesLeft===0) this.triggerNoKnivesLeft();
        }
    }

    onCollisionDeath(){
        this.gameOver=true;
        // Check best score
        if(this.score>this.playerData.bestScore){
            this.playerData.bestScore=this.score;
            this.showNewRecord=true; this.newRecordTimer=120;
            this.playNewRecord();
        }
        // Check best time for this level
        const elapsed=(Date.now()-this.levelStartTime)/1000;
        if(elapsed<this.playerData.bestTime){
            this.playerData.bestTime=elapsed;
        }
        this.playerData.totalCoinsEarned+=this.sessionCoins;
        this.playerData.totalDiamondsEarned+=this.sessionDias;
        this.playerData.gamesPlayed++;
        this.savePlayerData();
        this.playGameOverSound();
        setTimeout(()=>this.onScore(this.score,true,{level:this.level,coins:this.sessionCoins,diamonds:this.sessionDias}),900);
    }

    hitApple(idx,apple){
        apple.hit=true; this.playerData.totalApplesHit++;
        const pos=this.getAppleWorldPos(apple);
        const rewards={diamond:{score:100,coins:18,dias:3,color:'#00D4FF',text:'DIAMOND! +100'},golden:{score:60,coins:12,dias:1,color:'#FFD700',text:'GOLDEN! +60'},red:{score:30,coins:5,dias:0,color:'#FF4444',text:'APPLE! +30'}};
        const r=rewards[apple.type];
        this.score+=r.score; this.onScore(this.score);
        this.earnCoins(r.coins,pos.x,pos.y);
        if(r.dias>0) this.earnDiamonds(r.dias,pos.x,pos.y-22);
        this.spawnAppleParticles(pos.x,pos.y,apple.type);
        this.explosions.push({x:pos.x,y:pos.y,radius:5,opacity:0.95,color:r.color});
        this.spawnShockwave(pos.x,pos.y,r.color,12);
        this.scorePopups.push({x:pos.x,y:pos.y-32,text:r.text,color:r.color,life:95,opacity:1});
        if(this.popRings.length<this.MAX_POP_RINGS) this.popRings.push({x:pos.x,y:pos.y,radius:8,opacity:0.9,color:r.color});
        this.flashTimer=12; this.flashColor=r.color;
        this.shake(8,6); this.playAppleHit(apple.type);
    }

    /* ══════════════════════════════════════════════
       STAGE COMPLETE
    ══════════════════════════════════════════════ */
    completeStage(allApples=false){
        this.stageComplete=true; this.stageCompleteTimer=0;

        // Time bonus
        const elapsed=(Date.now()-this.levelStartTime)/1000;
        const timeBonus=Math.max(0,Math.floor(300-elapsed*5));

        const levelBonus=60+this.level*30;
        const comboBonus=this.maxCombo*12;
        const perfBonus=allApples?150:0;
        const streakBonus=this.streakRecord>=5?this.streakRecord*10:0;
        const totalBonus=levelBonus+comboBonus+perfBonus+timeBonus+streakBonus;

        this.score+=totalBonus; this.onScore(this.score);

        const coins=35+this.level*10+this.maxCombo*4;
        const dias=(this.levelCfg?.bossMode?6:2)+(allApples?3:0)+(this.streakRecord>=5?2:0);
        this.earnCoins(coins,this.W/2,this.H/2-55);
        this.earnDiamonds(dias,this.W/2,this.H/2-25);

        const stars=this.knivesThrown<=this.knivesTotal*0.65?3:this.knivesThrown<=this.knivesTotal*0.85?2:1;
        if(!this.playerData.levelStars[this.level]||stars>this.playerData.levelStars[this.level])
            this.playerData.levelStars[this.level]=stars;

        this.spawnBreakPieces();
        this.shake(20,12); this.flashTimer=28; this.flashColor='#00FF88';
        this.vignetteFlash=50; this.vignetteColor='#00FF88';

        const headText=allApples?'🍎 PERFECT CLEAR!':'✓ STAGE CLEAR!';
        this.addFloatingText(this.W/2,this.H/2-40,headText,'#00FF88',26,150);

        let bonusLines=[`+${totalBonus} pts`];
        if(allApples) bonusLines.push('All Apples! 🍎');
        if(this.streakRecord>=5) bonusLines.push(`Best Streak x${this.streakRecord}! 🔥`);
        if(timeBonus>0) bonusLines.push(`Time Bonus +${timeBonus}`);
        this.addFloatingText(this.W/2,this.H/2+18,bonusLines.join('  ·  '),'#FFD700',12,140);

        this.spawnCelebration(this.W/2,this.H/3,28);
        this.playStageComplete();

        // Big shockwaves
        for(let i=0;i<3;i++){
            setTimeout(()=>this.spawnShockwave(this.W/2,this.target.y+this.target.wobbleY,'#00FF88',this.target.radius*(0.5+i*0.4)),i*200);
        }
    }

    spawnBreakPieces(){
        const tx=this.target.x,ty=this.target.y+this.target.wobbleY;
        for(let i=0;i<18;i++){
            const angle=(this.TAU*i)/18+Math.random()*0.4,speed=Math.random()*7+4;
            this.breakPieces.push({x:tx,y:ty,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-2,w:Math.random()*25+12,h:Math.random()*25+12,rotation:Math.random()*this.TAU,rotSpeed:(Math.random()-0.5)*0.25,life:80,color:this.target.bossMode?'#aa2200':'#8B4513'});
        }
        this.stuckKnives.forEach(sk=>{
            const angle=this.target.angle+sk.angle;
            this.breakPieces.push({x:tx+Math.cos(angle)*this.target.radius,y:ty+Math.sin(angle)*this.target.radius,vx:Math.cos(angle)*(Math.random()*5+2),vy:Math.sin(angle)*(Math.random()*5+2)-2.5,w:4,h:36,rotation:angle,rotSpeed:(Math.random()-0.5)*0.22,life:65,color:'#dddddd'});
        });
    }

    /* ══════════════════════════════════════════════
       ECONOMY
    ══════════════════════════════════════════════ */
    earnCoins(amount,x,y)    {this.playerData.coins+=amount;this.playerData.totalCoinsEarned+=amount;this.sessionCoins+=amount;this.hudFlash.coins=20;this.coinPickups.push({x,y,text:`+${amount} Coins`,color:'#FFD700',life:80,opacity:1,vy:-1.3});}
    earnDiamonds(amount,x,y) {this.playerData.diamonds+=amount;this.playerData.totalDiamondsEarned+=amount;this.sessionDias+=amount;this.hudFlash.diamonds=20;this.coinPickups.push({x,y,text:`+${amount} Dia`,color:'#00D4FF',life:95,opacity:1,vy:-1.1});this.playReward();}
    checkMilestones()        {for(const m of this.milestones){if(this.score>=m*10&&!this.milestonesClaimed.has(m)){this.milestonesClaimed.add(m);this.earnDiamonds(1,this.W/2,this.H*0.3);this.addFloatingText(this.W/2,this.H*0.28,`${m*10} pts! +1 Diamond`,'#00D4FF',15,110);}}}

    /* ══════════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════════ */
    getAppleWorldPos(a)  {const angle=this.target.angle+a.angle;return{x:this.target.x+Math.cos(angle)*this.target.radius,y:this.target.y+this.target.wobbleY+Math.sin(angle)*this.target.radius};}
    getKnifeWorldPos(sk) {const angle=this.target.angle+sk.angle;return{x:this.target.x+Math.cos(angle)*this.target.radius,y:this.target.y+this.target.wobbleY+Math.sin(angle)*this.target.radius};}
    getSkinColor()       {return this.knifeSkins[this.currentSkin]?.blade[1]||'#e8e8e8';}
    addFloatingText(x,y,text,color,size=16,life=80) {this.floatingTexts.push({x,y,text,color,size,life,opacity:1,scale:0.2});}
    spawnParticles(x,y,color,count) {for(let i=0;i<count&&this.particles.length<this.MAX_PARTICLES;i++){const angle=Math.random()*this.TAU,speed=Math.random()*7+2;this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-1.5,color,size:Math.random()*5.5+2,life:1,decay:Math.random()*0.035+0.018,grav:0.15});}}
    spawnAppleParticles(x,y,type)   {const cols={diamond:['#00D4FF','#88eeff','#fff'],golden:['#FFD700','#FFA500','#fff'],red:['#FF4444','#FF8888','#fff']};const c=cols[type]||cols.red;for(let i=0;i<28&&this.particles.length<this.MAX_PARTICLES;i++){const angle=Math.random()*this.TAU,speed=Math.random()*9+3;this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-3.5,color:c[Math.floor(Math.random()*c.length)],size:Math.random()*7+2,life:1,decay:0.020,grav:0.18});}}
    spawnCelebration(cx,cy,count)   {for(let i=0;i<count;i++){setTimeout(()=>{if(this.destroyed)return;const x=cx+(Math.random()-0.5)*this.W*0.7,y=cy+(Math.random()-0.5)*this.H*0.3;this.spawnParticles(x,y,this.getSkinColor(),7);if(this.popRings.length<this.MAX_POP_RINGS)this.popRings.push({x,y,radius:5,opacity:0.7,color:this.getSkinColor()});},i*40);}}
    spawnCelebrationBurst(x,y,count){for(let i=0;i<count;i++){const angle=(this.TAU*i)/count,speed=this.rand(4,10);this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,color:['#FFD700','#00FF88','#FF006E','#00D4FF'][i%4],size:Math.random()*7+3,life:1,decay:0.018,grav:0.12});}}
    spawnShockwave(x,y,color,startR){this.shockwaves.push({x,y,r:startR||5,speed:4.5,opacity:0.9,color,lineW:3.5});}
    shake(timer,force) {this.shakeTimer=Math.max(this.shakeTimer,timer);this.shakeForce=Math.max(this.shakeForce,force);}
    makeStars(count)   {return Array.from({length:count},()=>({x:Math.random()*this.W,y:Math.random()*this.H,size:Math.random()*1.8+0.3,phase:Math.random()*this.TAU,speed:Math.random()*0.018+0.005,color:Math.random()>0.85?'#b347d9':Math.random()>0.6?'#00d4ff':'#ffffff'}));}
    makeNebulae()      {return Array.from({length:4},()=>({x:Math.random()*this.W,y:Math.random()*this.H*0.65,r:this.rand(70,160),color:this.rand(0,1)>0.5?'rgba(179,71,217,':'rgba(0,212,255,',alpha:this.rand(0.02,0.07)}));}
    makeGridLines()    {this.gridLines=[{dir:'h',spacing:50,offset:0,speed:0.15},{dir:'v',spacing:50,offset:0,speed:0.12}];}
    fmtNum(n)          {if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return''+n;}
    hexToRgba(hex,a)   {if(!hex||!hex.startsWith('#'))return hex;return`rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${Math.max(0,Math.min(1,a))})`;}
    hexToRgbParts(hex) {if(!hex||!hex.startsWith('#'))return'255,255,255';return`${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;}
    darkenHex(hex,amt) {if(!hex||!hex.startsWith('#'))return hex;return`rgb(${Math.max(0,parseInt(hex.slice(1,3),16)-amt)},${Math.max(0,parseInt(hex.slice(3,5),16)-amt)},${Math.max(0,parseInt(hex.slice(5,7),16)-amt)})`;}
        /* ══════════════════════════════════════════════
       DRAW — MAIN
    ══════════════════════════════════════════════ */
    draw(){
        const ctx=this.ctx;
        ctx.fillStyle='#050510';
        ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

        ctx.save();
        if(this.shakeX||this.shakeY) ctx.translate(this.dS(this.shakeX),this.dS(this.shakeY));

        this.drawBackground(ctx);

        // Flash overlay
        if(this.flashTimer>0){
            const a=(this.flashTimer/22)*0.20;
            ctx.fillStyle=this.hexToRgba(this.flashColor,a);
            ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        }

        if(this.stageComplete){
            this.drawStageComplete(ctx);
        } else {
            this.drawOrbitCoins(ctx);
            this.drawTarget(ctx);
            this.drawShockwaves(ctx);
            this.drawExplosions(ctx);
            this.drawPopRings(ctx);
            this.drawRibbons(ctx);
            this.drawParticles(ctx);
            this.drawTrailParticles(ctx);
            this.drawScorePopups(ctx);
            this.drawCoinPickups(ctx);
            if(this.flyingKnife) this.drawFlyingKnife(ctx);
            else if(!this.noKnivesLeft) this.drawIdleKnife(ctx);
            this.drawFloatingTexts(ctx);
            this.drawHitPulse(ctx);
            this.drawStreakIndicator(ctx);
        }

        this.drawHUD(ctx);
        if(!this.noKnivesLeft&&!this.stageComplete) this.drawPowerUpBar(ctx);

        // Vignette flash
        if(this.vignetteFlash>0){
            const va=(this.vignetteFlash/50)*0.45;
            const vg=ctx.createRadialGradient(this.dX(this.W/2),this.dY(this.H/2),this.dS(this.H*0.1),this.dX(this.W/2),this.dY(this.H/2),this.dS(this.H*0.85));
            vg.addColorStop(0,'rgba(0,0,0,0)');
            vg.addColorStop(1,this.hexToRgba(this.vignetteColor,va));
            ctx.fillStyle=vg;
            ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        }

        // New record banner
        if(this.showNewRecord&&this.newRecordTimer>0){
            const pulse=0.7+Math.sin(this.time/80)*0.3;
            this.drawText(ctx,'🏆 NEW HIGH SCORE!',this.W/2,this.H/2-this.H*0.25,{
                size:22,weight:'bold',color:'#FFD700',align:'center',family:this.FONT_TITLE,
                glow:true,glowColor:'#FFD700',glowBlur:16,opacity:pulse,
                stroke:true,strokeColor:'rgba(0,0,0,0.7)',strokeWidth:3
            });
        }

        ctx.restore();

        // Overlays — no shake
        if(this.noKnivesLeft)                               this.drawNoKnivesOverlay(ctx);
        if(this.showDailyReward&&!this.dailyRewardClaimed)  this.drawDailyReward(ctx);
        if(this.gameOver)                                    this.drawGameOver(ctx);
    }

    /* ══════════════════════════════════════════════
       DRAW: BACKGROUND — Animated Grid
    ══════════════════════════════════════════════ */
    drawBackground(ctx){
        const W=this.W, H=this.H;
        const bg=ctx.createRadialGradient(this.dX(W/2),this.dY(H*0.38),0,this.dX(W/2),this.dY(H/2),this.dS(H));
        bg.addColorStop(0,this.target.bossMode?'#1c0408':'#130924');
        bg.addColorStop(0.5,this.target.bossMode?'#0e0204':'#080518');
        bg.addColorStop(1,'#040210');
        ctx.fillStyle=bg; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

        // Animated grid
        ctx.save();
        ctx.globalAlpha=0.028;
        ctx.strokeStyle=this.target.bossMode?'#ff3355':'#4455ff';
        ctx.lineWidth=this.dS(0.6);
        if(this.gridLines.length){
            const hg=this.gridLines[0], vg=this.gridLines[1]||this.gridLines[0];
            const gS=this.dS(hg.spacing);
            for(let x=this.dS(-hg.spacing)+((hg.offset*this.dpr)%gS);x<this.canvas.width+gS;x+=gS){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,this.canvas.height);ctx.stroke();}
            const vS=this.dS(vg.spacing);
            for(let y=this.dS(-vg.spacing)+((vg.offset*this.dpr)%vS);y<this.canvas.height+vS;y+=vS){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(this.canvas.width,y);ctx.stroke();}
        }
        ctx.restore();

        // Nebulae
        for(const n of this.nebulae){
            const ng=ctx.createRadialGradient(this.dX(n.x),this.dY(n.y),0,this.dX(n.x),this.dY(n.y),this.dS(n.r));
            ng.addColorStop(0,n.color+n.alpha+')'); ng.addColorStop(1,n.color+'0)');
            ctx.fillStyle=ng; ctx.fillRect(this.dX(n.x-n.r),this.dY(n.y-n.r),this.dSr(n.r*2),this.dSr(n.r*2));
        }

        // Stars
        for(const s of this.stars){
            const alpha=0.15+((Math.sin(s.phase)+1)/2)*0.6;
            ctx.globalAlpha=alpha; ctx.fillStyle=s.color;
            this.drawCircle(ctx,s.x,s.y,s.size); ctx.fill();
        }
        ctx.globalAlpha=1;

        // Vignette
        const vg=ctx.createRadialGradient(this.dX(W/2),this.dY(H/2),this.dS(H*0.12),this.dX(W/2),this.dY(H/2),this.dS(H*0.88));
        vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.52)');
        ctx.fillStyle=vg; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    }

    /* ══════════════════════════════════════════════
       DRAW: TARGET
    ══════════════════════════════════════════════ */
    drawTarget(ctx){
        const t=this.target;
        const tx=this.dX(t.x), ty=this.dY(t.y+t.wobbleY), tr=this.dS(t.radius);

        ctx.save(); ctx.translate(tx,ty);

        // Outer pulse glow
        const glowPulse=0.3+Math.abs(Math.sin(this.time/220))*0.35;
        ctx.save();
        ctx.shadowBlur=t.bossMode?this.dS(38):this.dS(22);
        ctx.shadowColor=t.bossMode?'#ff0050':'#ff8c00';
        ctx.strokeStyle=t.bossMode?`rgba(255,0,50,${glowPulse})`:`rgba(255,140,60,${glowPulse*0.7})`;
        ctx.lineWidth=this.dS(6);
        ctx.beginPath(); ctx.arc(0,0,tr+this.dS(5),0,this.TAU); ctx.stroke();
        ctx.shadowBlur=0; ctx.restore();

        ctx.rotate(t.angle);

        // Log body
        const lg=ctx.createRadialGradient(-tr*0.25,-tr*0.25,tr*0.06,0,0,tr);
        if(t.bossMode){lg.addColorStop(0,'#b83800');lg.addColorStop(0.35,'#8c1200');lg.addColorStop(0.7,'#6e0a00');lg.addColorStop(1,'#3a0000');}
        else{lg.addColorStop(0,'#d48438');lg.addColorStop(0.35,'#aa6422');lg.addColorStop(0.7,'#7c4218');lg.addColorStop(1,'#5c2e0c');}
        ctx.beginPath(); ctx.arc(0,0,tr,0,this.TAU); ctx.fillStyle=lg; ctx.fill();

        // Wood grain clip
        ctx.save(); ctx.beginPath(); ctx.arc(0,0,tr,0,this.TAU); ctx.clip();
        ctx.globalAlpha=0.055;
        for(let i=-tr;i<tr;i+=this.dS(9)){
            ctx.beginPath();
            ctx.moveTo(i,-tr);
            ctx.bezierCurveTo(i+this.dS(5),-tr/2,i-this.dS(5),0,i+this.dS(3),tr);
            ctx.strokeStyle=t.bossMode?'#ff4400':'#c8a060';
            ctx.lineWidth=this.dS(2.2);
            ctx.stroke();
        }
        ctx.globalAlpha=1;
        const ringAlpha=t.bossMode?[0.18,0.12,0.08,0.05]:[0.14,0.09,0.06,0.04];
        for(let i=1;i<=4;i++){
            ctx.beginPath(); ctx.arc(0,0,tr*(i/4.8),0,this.TAU);
            ctx.strokeStyle=t.bossMode?`rgba(255,90,10,${ringAlpha[i-1]})`:`rgba(255,210,150,${ringAlpha[i-1]})`;
            ctx.lineWidth=i===1?this.dS(2.8):this.dS(1.6);
            ctx.stroke();
        }
        ctx.restore();

        // Bullseye center
        const cg=ctx.createRadialGradient(0,0,0,0,0,tr*0.14);
        cg.addColorStop(0,t.bossMode?'#ff7700':'#f2b470');
        cg.addColorStop(1,t.bossMode?'#cc2500':'#b07838');
        ctx.beginPath(); ctx.arc(0,0,tr*0.12,0,this.TAU); ctx.fillStyle=cg; ctx.fill();

        // ── STUCK KNIVES ──
        this.stuckKnives.forEach(sk=>{
            ctx.save();
            ctx.rotate(sk.angle);
            this.drawStuckKnifeOnLog(ctx,sk.skin||this.currentSkin,t.radius);
            ctx.restore();
        });

        // Apples
        this.apples.forEach(a=>{
            if(a.hit&&a.scale<=0) return;
            ctx.save();
            ctx.rotate(a.angle); ctx.translate(tr,0);
            ctx.rotate(-a.angle-t.angle+a.wobble);
            ctx.scale(a.scale,a.scale);
            this.drawApple(ctx,0,0,a.type);
            ctx.restore();
        });

        ctx.restore();

        if(t.bossMode){
            const pulse=0.7+Math.sin(this.time/170)*0.3;
            this.drawText(ctx,'BOSS',t.x,t.y+t.wobbleY-t.radius-16,{size:13,weight:'bold',color:'#ff3355',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#ff0055',glowBlur:10,opacity:pulse});
        }
    }

    /* ══════════════════════════════════════════════
       KNIFE ON LOG — Fixed Orientation (tip outward)
    ══════════════════════════════════════════════ */
    drawStuckKnifeOnLog(ctx,skinName,logRadius){
        const skin=this.knifeSkins[skinName]||this.knifeSkins.default;
        ctx.save();
        const sc=this.dpr*0.88;
        ctx.scale(sc,sc);
        const rimX=logRadius/sc;
        const tipX=rimX+40, guardX=rimX, handleEnd=rimX-28, capX=rimX-28;

        ctx.shadowBlur=6; ctx.shadowColor=skin.blade[1];
        const bg=ctx.createLinearGradient(tipX,-2,guardX,2);
        bg.addColorStop(0,skin.blade[2]); bg.addColorStop(0.5,skin.blade[1]); bg.addColorStop(1,skin.blade[0]);
        ctx.fillStyle=bg;
        ctx.beginPath();
        ctx.moveTo(guardX,0); ctx.lineTo(guardX+9,-3.8); ctx.lineTo(tipX-4,-2.2);
        ctx.lineTo(tipX,0); ctx.lineTo(tipX-4,2.2); ctx.lineTo(guardX+9,3.8);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;

        // Blade shine
        ctx.fillStyle='rgba(255,255,255,0.38)';
        ctx.beginPath();
        ctx.moveTo(guardX+7,-0.5); ctx.lineTo(tipX-6,-1.8);
        ctx.lineTo(tipX-6,0.6); ctx.lineTo(guardX+7,1);
        ctx.closePath(); ctx.fill();

        // Guard
        ctx.fillStyle=skin.guard; ctx.fillRect(guardX-5,-7.5,7,15);
        const gg=ctx.createLinearGradient(guardX-5,-7.5,guardX+2,-7.5);
        gg.addColorStop(0,'rgba(255,255,255,0.2)'); gg.addColorStop(1,'rgba(0,0,0,0.2)');
        ctx.fillStyle=gg; ctx.fillRect(guardX-5,-7.5,7,15);

        // Handle
        const hg=ctx.createLinearGradient(guardX-5,-5.5,guardX-5,5.5);
        hg.addColorStop(0,skin.handle[0]); hg.addColorStop(0.5,skin.handle[1]); hg.addColorStop(1,skin.handle[2]);
        ctx.fillStyle=hg; ctx.fillRect(handleEnd,-5.8,guardX-5-handleEnd,11.6);

        ctx.strokeStyle='rgba(255,200,100,0.28)'; ctx.lineWidth=1;
        for(let gx=handleEnd+2;gx<guardX-8;gx+=4.8){ctx.beginPath();ctx.moveTo(gx,-5);ctx.lineTo(gx,5);ctx.stroke();}

        ctx.fillStyle=skin.handle[0];
        ctx.beginPath(); ctx.ellipse(capX,0,3.2,5.8,0,0,this.TAU); ctx.fill();
        ctx.restore();
    }

    /* ══════════════════════════════════════════════
       KNIFE SHAPE — Pointing UP (flying/idle)
    ══════════════════════════════════════════════ */
    drawKnifeAtShooter(ctx,skinName='default',scale=1){
        const skin=this.knifeSkins[skinName]||this.knifeSkins.default;
        ctx.save(); ctx.scale(this.dpr*scale,this.dpr*scale);

        ctx.shadowBlur=8; ctx.shadowColor=skin.blade[1];
        const bg=ctx.createLinearGradient(-3,-40,3,0);
        bg.addColorStop(0,skin.blade[2]); bg.addColorStop(0.4,skin.blade[1]); bg.addColorStop(1,skin.blade[0]);
        ctx.fillStyle=bg;
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(-3.8,-11); ctx.lineTo(-2.2,-36);
        ctx.lineTo(0,-40); ctx.lineTo(2.2,-36); ctx.lineTo(3.8,-11);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;

        // Blade shine
        ctx.fillStyle='rgba(255,255,255,0.42)';
        ctx.beginPath();
        ctx.moveTo(0.6,-7); ctx.lineTo(-0.4,-32); ctx.lineTo(2,-32); ctx.lineTo(2,-7);
        ctx.closePath(); ctx.fill();

        // Guard
        ctx.fillStyle=skin.guard; ctx.fillRect(-7.5,-5.5,15,6.5);
        const gg=ctx.createLinearGradient(0,-5.5,0,1);
        gg.addColorStop(0,'rgba(255,255,255,0.2)'); gg.addColorStop(1,'rgba(0,0,0,0.2)');
        ctx.fillStyle=gg; ctx.fillRect(-7.5,-5.5,15,6.5);

        // Handle
        const hg=ctx.createLinearGradient(-5.8,0,5.8,0);
        hg.addColorStop(0,skin.handle[0]); hg.addColorStop(0.5,skin.handle[1]); hg.addColorStop(1,skin.handle[2]);
        ctx.fillStyle=hg; ctx.fillRect(-5.8,1,11.6,25);

        ctx.strokeStyle='rgba(255,200,100,0.3)'; ctx.lineWidth=1;
        for(let i=5;i<23;i+=4.8){ctx.beginPath();ctx.moveTo(-5.5,i);ctx.lineTo(5.5,i);ctx.stroke();}

        ctx.fillStyle=skin.handle[0];
        ctx.beginPath(); ctx.ellipse(0,26,5.5,3.2,0,0,this.TAU); ctx.fill();
        ctx.restore();
    }

    /* ══════════════════════════════════════════════
       DRAW: FLYING KNIFE
    ══════════════════════════════════════════════ */
    drawFlyingKnife(ctx){
        const k=this.flyingKnife;
        k.trail.forEach((t,i)=>{
            const ratio=i/k.trail.length;
            ctx.save(); ctx.globalAlpha=ratio*0.28;
            ctx.translate(this.dX(t.x),this.dY(t.y));
            this.drawKnifeAtShooter(ctx,k.skin,ratio*0.7);
            ctx.restore();
        });
        ctx.globalAlpha=1;
        ctx.save(); ctx.translate(this.dX(k.x),this.dY(k.y));
        this.drawKnifeAtShooter(ctx,k.skin,1);
        ctx.restore();
    }

    /* ══════════════════════════════════════════════
       DRAW: IDLE KNIFE — Ready to throw
    ══════════════════════════════════════════════ */
    drawIdleKnife(ctx){
        if(!this.idleKnife||this.knivesLeft<=0) return;
        const k=this.idleKnife;
        const bY=k.bounce>0?k.bounce*-1.8:k.wobble;

        // Ready pulse glow under knife
        const pulseA=(k.readyPulse||0.7)*0.18;
        const pg=ctx.createRadialGradient(this.dX(k.x),this.dY(k.y+30),this.dS(8),this.dX(k.x),this.dY(k.y+30),this.dS(55));
        pg.addColorStop(0,`rgba(179,71,217,${pulseA})`);
        pg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=pg;
        ctx.beginPath(); ctx.ellipse(this.dX(k.x),this.dY(k.y+32),this.dS(56),this.dS(12),0,0,this.TAU); ctx.fill();

        ctx.save(); ctx.translate(this.dX(k.x),this.dY(k.y+bY));
        this.drawKnifeAtShooter(ctx,this.currentSkin,1);
        ctx.restore();

        // Knife counter dots — vertical bars
        const total=this.knivesTotal, left=this.knivesLeft;
        const dotSpacing=14, dotsW=total*dotSpacing;
        const startX=k.x-dotsW/2;
        for(let i=0;i<total;i++){
            const dx=startX+i*dotSpacing, dy=k.y+52;
            ctx.save();
            if(i<left){
                ctx.shadowBlur=this.dS(6); ctx.shadowColor='#b347d9';
                ctx.fillStyle='#b347d9';
            } else {
                ctx.fillStyle='rgba(100,100,120,0.22)';
            }
            this.fillRect(ctx,dx-1.8,dy-9,3.5,18);
            ctx.restore();
        }

        // "Tap / Space" hint
        if(this.knivesThrown===0){
            const pulse=0.4+Math.sin(this.time/380)*0.5;
            const hintText=this.isMobile?'TAP TO THROW':'TAP or SPACE to THROW';
            this.drawText(ctx,hintText,k.x,k.y+76,{size:10,weight:'600',color:'#ffffff',align:'center',opacity:pulse*0.75,family:this.FONT_MONO});
        }
    }

    /* ══════════════════════════════════════════════
       DRAW: APPLE
    ══════════════════════════════════════════════ */
    drawApple(ctx,x,y,type){
        const styles={
            diamond:{body:'#00D4FF',shine:'#aaeeff',stem:'#2a5a8a',leaf:'#1a4a6a',glow:'#00D4FF'},
            golden:{body:'#FFD700',shine:'#FFF8C0',stem:'#5a3a10',leaf:'#2a8a2a',glow:'#FFD700'},
            red:{body:'#FF3333',shine:'#FF9999',stem:'#5a3010',leaf:'#2a8a2a',glow:'#FF3333'}
        };
        const s=styles[type]||styles.red;
        ctx.save();
        ctx.shadowBlur=this.dS(12); ctx.shadowColor=s.glow;
        const ag=ctx.createRadialGradient(-this.dS(3),-this.dS(3),this.dS(1),0,this.dS(1),this.dS(12));
        ag.addColorStop(0,s.shine); ag.addColorStop(0.5,s.body); ag.addColorStop(1,this.darkenHex(s.body,32));
        ctx.fillStyle=ag;
        ctx.beginPath(); ctx.ellipse(0,this.dS(2),this.dS(10),this.dS(11),0,0,this.TAU); ctx.fill();
        ctx.shadowBlur=0;
        ctx.globalAlpha=0.42; ctx.fillStyle=s.shine;
        ctx.beginPath(); ctx.ellipse(this.dS(-3),this.dS(-2),this.dS(3.5),this.dS(4.5),-0.5,0,this.TAU); ctx.fill();
        ctx.globalAlpha=1;
        ctx.strokeStyle=s.stem; ctx.lineWidth=this.dS(2);
        ctx.beginPath(); ctx.moveTo(0,this.dS(-9)); ctx.quadraticCurveTo(this.dS(5),this.dS(-15),this.dS(2),this.dS(-18)); ctx.stroke();
        ctx.fillStyle=s.leaf;
        ctx.beginPath(); ctx.ellipse(this.dS(4),this.dS(-14),this.dS(6),this.dS(3.5),0.5,0,this.TAU); ctx.fill();
        if(type==='diamond'){
            ctx.fillStyle='rgba(255,255,255,0.7)';
            [[0,-5],[7,2],[-6,4]].forEach(([sx,sy])=>{ctx.beginPath();ctx.arc(this.dS(sx),this.dS(sy),this.dS(1.8),0,this.TAU);ctx.fill();});
        }
        ctx.restore();
    }

    /* ══════════════════════════════════════════════
       DRAW: ORBIT COINS
    ══════════════════════════════════════════════ */
    drawOrbitCoins(ctx){
        const t=this.target;
        this.orbitCoins.forEach(c=>{
            if(c.collected) return;
            const angle=t.angle+c.angle;
            const cx=t.x+Math.cos(angle)*c.orbitR, cy=t.y+t.wobbleY+Math.sin(angle)*c.orbitR;
            const pulse=0.84+Math.sin(c.wobble)*0.16;
            ctx.save(); ctx.translate(this.dX(cx),this.dY(cy)); ctx.scale(pulse,pulse);
            ctx.shadowBlur=this.dS(10); ctx.shadowColor='#FFD700'; ctx.fillStyle='#FFD700';
            ctx.beginPath(); ctx.arc(0,0,this.dS(7.5),0,this.TAU); ctx.fill();
            ctx.shadowBlur=0; ctx.fillStyle='#FFF8C0';
            ctx.beginPath(); ctx.arc(this.dS(-2.2),this.dS(-2.2),this.dS(2.8),0,this.TAU); ctx.fill();
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.font=`bold ${this.dSr(8)}px Arial`;
            ctx.fillStyle='#AA7700'; ctx.fillText('$',0,this.dS(1));
            ctx.restore();
        });
    }

    /* ══════════════════════════════════════════════
       DRAW: HIT PULSE — Satisfying center flash
    ══════════════════════════════════════════════ */
    drawHitPulse(ctx){
        if(this.hitPulseTimer<=0) return;
        const t=this.hitPulseTimer/24;
        const r=this.target.radius*(1.2+(1-t)*0.5);
        const col=this.getSkinColor();
        ctx.save();
        ctx.globalAlpha=t*0.22;
        ctx.shadowBlur=this.dS(20);
        ctx.shadowColor=col;
        ctx.strokeStyle=col;
        ctx.lineWidth=this.dS(3*t);
        ctx.beginPath();
        ctx.arc(this.dX(this.target.x),this.dY(this.target.y+this.target.wobbleY),this.dS(r),0,this.TAU);
        ctx.stroke();
        ctx.restore();
    }

    /* ══════════════════════════════════════════════
       DRAW: STREAK INDICATOR
    ══════════════════════════════════════════════ */
    drawStreakIndicator(ctx){
        if(this.streak<3) return;
        const colors=['#00FF88','#00FF88','#00FF88','#FFD700','#FFD700','#FF8C00','#FF8C00','#FF006E','#FF006E','#b347d9'];
        const col=colors[Math.min(this.streak-1,colors.length-1)];
        const pulse=0.8+Math.sin(this.time/100)*0.2;
        const x=this.W-14, baseY=this.H/2;

        // Vertical streak bar
        const barH=Math.min(this.streak*18,160);
        const grad=ctx.createLinearGradient(0,this.dY(baseY),0,this.dY(baseY-barH));
        grad.addColorStop(0,'rgba(0,0,0,0)');
        grad.addColorStop(1,this.hexToRgba(col,0.6));
        ctx.fillStyle=grad;
        ctx.fillRect(this.dX(x-5),this.dY(baseY-barH),this.dSr(10),this.dSr(barH));

        this.drawText(ctx,`🔥${this.streak}`,x,baseY-barH-12,{
            size:13,weight:'bold',color:col,align:'center',
            family:this.FONT_TITLE,glow:true,glowColor:col,glowBlur:10,opacity:pulse
        });
    }

    /* ══════════════════════════════════════════════
       DRAW: FX
    ══════════════════════════════════════════════ */
    drawShockwaves(ctx){
        ctx.save();
        this.shockwaves.forEach(s=>{
            ctx.globalAlpha=Math.max(0,s.opacity);
            ctx.shadowBlur=this.dS(8); ctx.shadowColor=s.color;
            ctx.strokeStyle=s.color; ctx.lineWidth=this.dS(s.lineW);
            ctx.beginPath(); ctx.arc(this.dX(s.x),this.dY(s.y),this.dS(s.r),0,this.TAU); ctx.stroke();
            ctx.shadowBlur=0;
        });
        ctx.restore();
    }

    drawRibbons(ctx){
        ctx.save();
        this.ribbons.forEach(r=>{
            ctx.globalAlpha=r.alpha*0.75;
            ctx.fillStyle=r.color;
            ctx.fillRect(this.dX(r.x-r.w/2),this.dY(r.y-r.h/2),this.dSr(r.w),this.dSr(r.h));
        });
        ctx.restore();
    }

    drawExplosions(ctx){
        ctx.save();
        this.explosions.forEach(e=>{
            ctx.globalAlpha=e.opacity;
            ctx.shadowBlur=this.dS(14); ctx.shadowColor=e.color;
            ctx.strokeStyle=e.color; ctx.lineWidth=this.dS(3.5);
            ctx.beginPath(); ctx.arc(this.dX(e.x),this.dY(e.y),this.dS(e.radius),0,this.TAU); ctx.stroke();
            ctx.globalAlpha=e.opacity*0.22;
            ctx.fillStyle=e.color;
            ctx.beginPath(); ctx.arc(this.dX(e.x),this.dY(e.y),this.dS(e.radius*0.5),0,this.TAU); ctx.fill();
            ctx.shadowBlur=0;
        });
        ctx.restore();
    }

    drawPopRings(ctx){
        ctx.save();
        for(const r of this.popRings){
            ctx.globalAlpha=r.opacity;
            ctx.strokeStyle=r.color; ctx.lineWidth=this.dS(2.2*r.opacity);
            ctx.beginPath(); ctx.arc(this.dX(r.x),this.dY(r.y),this.dS(r.radius),0,this.TAU); ctx.stroke();
        }
        ctx.restore();
    }

    drawParticles(ctx){
        ctx.save();
        this.particles.forEach(p=>{
            ctx.globalAlpha=Math.min(1,p.life);
            ctx.shadowBlur=this.dS(5); ctx.shadowColor=p.color;
            ctx.fillStyle=p.color;
            this.drawCircle(ctx,p.x,p.y,Math.max(0.5,p.size*p.life));
            ctx.fill(); ctx.shadowBlur=0;
        });
        ctx.restore();
    }

    drawTrailParticles(ctx){
        ctx.save();
        for(const p of this.trailParticles){
            ctx.globalAlpha=p.life*0.45;
            ctx.fillStyle=p.color;
            this.drawCircle(ctx,p.x,p.y,Math.max(0.3,p.size*p.life));
            ctx.fill();
        }
        ctx.globalAlpha=1; ctx.restore();
    }

    drawScorePopups(ctx){
        this.scorePopups.forEach(p=>{
            this.drawText(ctx,p.text,p.x,p.y,{size:14,weight:'bold',color:p.color,align:'center',opacity:p.opacity,stroke:true,strokeColor:'rgba(0,0,0,0.65)',strokeWidth:2.5,glow:true,glowColor:p.color,glowBlur:7,family:this.FONT_TITLE});
        });
    }

    drawCoinPickups(ctx){
        this.coinPickups.forEach(p=>{
            this.drawText(ctx,p.text,p.x,p.y,{size:11,weight:'bold',color:p.color,align:'center',opacity:p.opacity,family:this.FONT_TITLE});
        });
    }

    drawFloatingTexts(ctx){
        this.floatingTexts.forEach(t=>{
            const sc=t.scale||1;
            this.drawText(ctx,t.text,t.x,t.y,{size:(t.size||16)*Math.min(1,sc),weight:'bold',color:t.color,align:'center',opacity:t.opacity,stroke:true,strokeColor:'rgba(0,0,0,0.55)',strokeWidth:3,glow:true,glowColor:t.color,glowBlur:10,family:this.FONT_TITLE});
        });
    }

    /* ══════════════════════════════════════════════
       DRAW: STAGE COMPLETE
    ══════════════════════════════════════════════ */
    drawStageComplete(ctx){
        this.drawBackground(ctx);
        this.breakPieces.forEach(p=>{
            ctx.save(); ctx.globalAlpha=Math.max(0,p.life/80);
            ctx.translate(this.dX(p.x),this.dY(p.y)); ctx.rotate(p.rotation);
            ctx.fillStyle=p.color; this.fillRect(ctx,-p.w/2,-p.h/2,p.w,p.h);
            ctx.restore();
        });
        this.drawShockwaves(ctx);
        this.drawParticles(ctx); this.drawPopRings(ctx);
        this.drawFloatingTexts(ctx); this.drawCoinPickups(ctx);
    }

    /* ══════════════════════════════════════════════
       DRAW: NO KNIVES OVERLAY
    ══════════════════════════════════════════════ */
    drawNoKnivesOverlay(ctx){
        const a=this.noKnivesOverlayAlpha;
        if(a<=0) return;
        ctx.fillStyle=`rgba(0,0,0,${a*0.84})`;
        ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        if(a<0.4) return;
        const pa=Math.min(1,(a-0.4)/0.6);
        const{pw,ph,px,py}=this._noKnivesPopupDims();

        ctx.globalAlpha=pa;
        ctx.fillStyle='rgba(6,3,18,0.97)';
        this.drawRoundRect(ctx,px,py,pw,ph,16); ctx.fill();
        ctx.shadowBlur=this.dS(14); ctx.shadowColor='#ff6600';
        ctx.strokeStyle='rgba(255,102,0,0.6)'; ctx.lineWidth=this.dS(1.8);
        this.drawRoundRect(ctx,px,py,pw,ph,16); ctx.stroke();
        ctx.shadowBlur=0;

        const tg=ctx.createLinearGradient(this.dX(px+20),0,this.dX(px+pw-20),0);
        tg.addColorStop(0,'rgba(0,0,0,0)'); tg.addColorStop(0.5,'rgba(255,102,0,0.45)'); tg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=tg; ctx.fillRect(this.dX(px+20),this.dY(py+1),this.dSr(pw-40),this.dSr(3));

        // Knife icon
        ctx.save();
        ctx.translate(this.dX(this.W/2),this.dY(py+48));
        const iconPulse=1+Math.sin(this.time/280)*0.10;
        ctx.scale(iconPulse,iconPulse);
        ctx.globalAlpha=pa*0.9;
        ctx.font=`${this.dSr(34)}px Arial`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='#ff8844'; ctx.fillText('🗡',0,0);
        ctx.restore();

        this.drawText(ctx,'NO KNIVES LEFT!',this.W/2,py+82,{size:21,weight:'bold',color:'#ff7733',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#ff5500',glowBlur:12,opacity:pa});
        this.drawText(ctx,'You ran out of knives',this.W/2,py+104,{size:11,color:'rgba(200,160,120,0.7)',align:'center',family:this.FONT_MONO,opacity:pa});

        ctx.globalAlpha=pa*0.08; ctx.fillStyle='#ffffff';
        this.fillRect(ctx,px+20,py+117,pw-40,1); ctx.globalAlpha=pa;

        const statRows=[
            ['Level',`${this.level} · ${this.levelCfg?.name||''}`, '#ccaaff'],
            ['Score',this.score.toLocaleString(),'#ffffff'],
            ['Knives Used',`${this.knivesThrown} / ${this.knivesTotal}`,'#ffcc88'],
            ['Best Streak',`🔥 x${this.streakRecord}`,'#FFD700'],
            ['Close Calls',`⚡ ${this.closeCallCount}`,'#FF8C00']
        ];
        statRows.forEach((row,i)=>{
            const ry=py+136+i*21;
            this.drawText(ctx,row[0],px+18,ry,{size:9,color:'rgba(140,140,180,0.7)',family:this.FONT_MONO,opacity:pa});
            this.drawText(ctx,row[1],px+pw-18,ry,{size:10,weight:'bold',color:row[2],align:'right',family:this.FONT_TITLE,opacity:pa});
        });

        ctx.globalAlpha=pa*0.08; ctx.fillStyle='#ffffff';
        this.fillRect(ctx,px+20,py+ph-78,pw-40,1); ctx.globalAlpha=pa;

        // Retry button
        const rbX=px+pw/2-80, rbY=py+ph-70, rbW=160, rbH=44;
        const rg=ctx.createLinearGradient(this.dX(rbX),0,this.dX(rbX+rbW),0);
        rg.addColorStop(0,'#b347d9'); rg.addColorStop(1,'#7722bb');
        ctx.fillStyle=rg;
        this.drawRoundRect(ctx,rbX,rbY,rbW,rbH,rbH/2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.09)';
        this.drawRoundRect(ctx,rbX,rbY,rbW,rbH/2,rbH/2); ctx.fill();
        this.drawText(ctx,'↺  RETRY LEVEL',this.W/2,rbY+rbH/2,{size:13,weight:'bold',color:'#ffffff',align:'center',baseline:'middle',family:this.FONT_TITLE,opacity:pa,glow:true,glowColor:'#cc66ff',glowBlur:7});

        const blink=0.3+Math.sin(this.time/360)*0.35;
        this.drawText(ctx,'or tap anywhere to end run',this.W/2,py+ph-14,{size:9,color:'rgba(150,130,160,1)',align:'center',family:this.FONT_MONO,opacity:pa*blink});

        const hasExtra=this.powerUps.extraKnife.count>0;
        if(hasExtra){
            this.drawText(ctx,`💡 ${this.powerUps.extraKnife.count}x Extra Knife available! Press [1]`,this.W/2,py-20,{size:9.5,color:'#00FF88',align:'center',family:this.FONT_MONO,opacity:pa*(0.5+Math.sin(this.time/180)*0.5)});
        }
        ctx.globalAlpha=1;
    }

    /* ══════════════════════════════════════════════
       DRAW: HUD — 4K Crisp
    ══════════════════════════════════════════════ */
    drawHUD(ctx){
        const W=this.W;
        const hudGrad=ctx.createLinearGradient(0,0,0,this.dY(44));
        hudGrad.addColorStop(0,'rgba(0,0,0,0.78)'); hudGrad.addColorStop(1,'rgba(0,0,0,0.08)');
        ctx.fillStyle=hudGrad; ctx.fillRect(0,0,this.canvas.width,this.dY(44));
        ctx.strokeStyle='rgba(179,71,217,0.18)'; ctx.lineWidth=this.dS(0.6);
        this.drawLine(ctx,0,44,W,44); ctx.stroke();

        this.drawText(ctx,`LV.${this.level}`,11,18,{size:13,weight:'bold',color:'#cc66ff',family:this.FONT_TITLE,glow:true,glowColor:'#b347d9',glowBlur:6});
        this.drawText(ctx,this.levelCfg?.name||'',11,33,{size:9,weight:'500',color:'rgba(200,200,255,0.38)',family:this.FONT_MONO});

        // Stage + pattern center
        this.drawText(ctx,`STAGE ${this.stage}`,W/2,18,{size:12,weight:'600',color:'#44ddff',align:'center',family:this.FONT_MONO});
        const patNames={constant:'STEADY',wobble:'WOBBLE',reverse:'REVERSE',erratic:'ERRATIC',crazy:'CRAZY'};
        this.drawText(ctx,patNames[this.target.pattern]||'',W/2,33,{size:8,weight:'600',color:'rgba(255,200,0,0.48)',align:'center',family:this.FONT_TITLE});

        // Coins / Diamonds
        const cF=this.hudFlash.coins>0, dF=this.hudFlash.diamonds>0;
        ctx.fillStyle='rgba(0,0,0,0.38)'; this.drawRoundRect(ctx,W-96,4,88,36,7); ctx.fill();
        this.drawText(ctx,`C ${this.fmtNum(this.playerData.coins)}`,W-10,18,{size:cF?12:10.5,weight:'bold',color:cF?'#ffffff':'#FFD700',align:'right',family:this.FONT_TITLE,glow:cF,glowColor:'#FFD700',glowBlur:6});
        this.drawText(ctx,`D ${this.fmtNum(this.playerData.diamonds)}`,W-10,33,{size:dF?12:10.5,weight:'bold',color:dF?'#ffffff':'#00D4FF',align:'right',family:this.FONT_TITLE,glow:dF,glowColor:'#00D4FF',glowBlur:6});

        // Lives
        for(let i=0;i<this.maxLives;i++){
            const alive=i<this.lives;
            ctx.save();
            ctx.shadowBlur=alive?this.dS(7):0; ctx.shadowColor='#ff0055';
            ctx.font=`${this.dSr(17)}px serif`;
            ctx.textAlign='right'; ctx.textBaseline='alphabetic';
            ctx.globalAlpha=alive?1:0.16;
            ctx.fillStyle='#ff0055'; ctx.fillText('\u2665',this.dX(W-98-i*22),this.dY(24));
            ctx.restore();
        }

        // Slow bar
        if(this.activeEffects.slow){
            const pct=this.activeEffects.slowTimer/5000;
            ctx.fillStyle='rgba(0,0,0,0.38)'; this.fillRect(ctx,8,46,88,8);
            const slg=ctx.createLinearGradient(this.dX(8),0,this.dX(8+88*pct),0);
            slg.addColorStop(0,'#00D4FF'); slg.addColorStop(1,'#00FF88');
            ctx.fillStyle=slg; this.fillRect(ctx,8,46,88*pct,8);
            this.drawText(ctx,'SLOW MO',10,63,{size:8,color:'#00D4FF',family:this.FONT_TITLE});
        }

        if(this.activeEffects.shield){
            const sp=0.6+Math.sin(this.time/160)*0.4;
            this.drawText(ctx,'🛡 SHIELD ACTIVE',W/2,56,{size:11,weight:'bold',color:'#cc77ff',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#b347d9',glowBlur:7,opacity:sp});
        }

        // Combo display
        if(this.combo>1){
            const ca=0.75+Math.sin(this.time/110)*0.25;
            const comboCol=this.combo>=8?'#FF006E':this.combo>=5?'#FFD700':'#00FF88';
            this.drawText(ctx,`×${this.combo} COMBO`,W/2,this.H-16,{size:16,weight:'bold',color:comboCol,align:'center',opacity:ca,glow:true,glowColor:comboCol,glowBlur:10,family:this.FONT_TITLE});
        }

        // Boss warning
        if(this.target.bossMode&&!this.stageComplete){
            const ba=0.65+Math.sin(this.time/190)*0.35;
            this.drawText(ctx,'👹 BOSS STAGE!',W/2,64,{size:13,weight:'bold',color:'#ff3366',align:'center',opacity:ba,glow:true,glowColor:'#ff0055',glowBlur:12,family:this.FONT_TITLE});
        }

        // Score top center
        this.drawText(ctx,this.score.toLocaleString(),W/2,this.H-36,{size:12,weight:'bold',color:'rgba(255,255,255,0.28)',align:'center',family:this.FONT_TITLE});
    }

    /* ══════════════════════════════════════════════
       DRAW: POWER-UP BAR
    ══════════════════════════════════════════════ */
    drawPowerUpBar(ctx){
        const btnS=this.isMobile?42:38;
        const btnY=this.idleKnife?this.idleKnife.y+46:this.H-48;
        let idx=0;
        for(const[key,pup]of Object.entries(this.powerUps)){
            const bx=8+idx*(btnS+7), canUse=pup.count>0;
            ctx.fillStyle=canUse?`rgba(${this.hexToRgbParts(pup.color)},0.12)`:'rgba(18,18,20,0.30)';
            this.drawRoundRect(ctx,bx,btnY,btnS,btnS,9); ctx.fill();
            ctx.strokeStyle=canUse?`rgba(${this.hexToRgbParts(pup.color)},0.50)`:'rgba(60,60,70,0.22)';
            ctx.lineWidth=this.dS(1.2); this.drawRoundRect(ctx,bx,btnY,btnS,btnS,9); ctx.stroke();
            ctx.save(); ctx.globalAlpha=canUse?1:0.22;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.font=`${this.dSr(this.isMobile?17:15)}px Arial`;
            ctx.fillStyle='#fff'; ctx.fillText(pup.icon,this.dX(bx+btnS/2),this.dY(btnY+btnS/2-4));
            ctx.restore();
            if(canUse){
                ctx.fillStyle='rgba(0,0,0,0.7)';
                ctx.beginPath(); ctx.arc(this.dX(bx+btnS-4),this.dY(btnY+btnS-5),this.dS(7.5),0,this.TAU); ctx.fill();
                this.drawText(ctx,`${pup.count}`,bx+btnS-4,btnY+btnS-5,{size:7.5,weight:'bold',color:'#00FF88',align:'center',baseline:'middle',family:this.FONT_TITLE});
            }
            this.drawText(ctx,`${idx+1}`,bx+4,btnY+11,{size:7.5,color:'rgba(255,255,255,0.28)',family:this.FONT_UI});
            idx++;
        }
    }

    /* ══════════════════════════════════════════════
       DRAW: DAILY REWARD
    ══════════════════════════════════════════════ */
    drawDailyReward(ctx){
        const a=this.dailyRewardAnim;
        ctx.fillStyle=`rgba(0,0,0,${0.90*a})`; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        if(a<0.3) return;
        const W=this.W,H=this.H,cw=Math.min(288,W-30),ch=262,cx=(W-cw)/2,cy=(H-ch)/2;
        this.drawCardBG(ctx,cx,cy,cw,ch,'#FFD700');
        const streak=this.playerData.dailyStreak,mult=Math.min(1+streak*0.3,4);
        const coins=Math.floor(60*mult),dias=Math.floor(2*Math.max(1,Math.floor(streak/3)));
        this.drawText(ctx,'🎁 Daily Reward!',W/2,cy+40,{size:20,weight:'bold',color:'#FFD700',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#FFD700',glowBlur:8});
        this.drawText(ctx,`Day ${streak+1} Streak!`,W/2,cy+62,{size:12,color:'#00D4FF',align:'center',family:this.FONT_MONO});
        ctx.fillStyle='rgba(255,255,255,0.07)'; this.fillRect(ctx,cx+16,cy+72,cw-32,1);
        this.drawText(ctx,`${coins} Coins`,W/2,cy+110,{size:25,weight:'bold',color:'#FFD700',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#FFD700',glowBlur:6});
        this.drawText(ctx,`${dias} Diamonds`,W/2,cy+146,{size:21,weight:'bold',color:'#00D4FF',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#00D4FF',glowBlur:6});
        if(streak>0&&streak%5===0) this.drawText(ctx,'+ Bonus Power-up!',W/2,cy+172,{size:12,color:'#00FF88',align:'center',family:this.FONT_MONO});
        this.drawBtn(ctx,W/2,cy+ch-46,155,40,'CLAIM!','#B94FE3','#FF006E');
    }

    /* ══════════════════════════════════════════════
       DRAW: GAME OVER — "One More Try" Feel
    ══════════════════════════════════════════════ */
    drawGameOver(ctx){
        const W=this.W,H=this.H;
        ctx.fillStyle='rgba(0,0,0,0.88)'; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);

        const pw=Math.min(W-28,305),ph=308,px=(W-pw)/2,py=(H-ph)/2;
        this.drawCardBG(ctx,px,py,pw,ph,'#b347d9');
        ctx.fillStyle='rgba(255,0,110,0.14)'; this.fillRect(ctx,px,py,pw,3);

        this.drawText(ctx,'GAME OVER',W/2,py+48,{size:28,weight:'bold',color:'#FF006E',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#FF006E',glowBlur:16,stroke:true,strokeColor:'rgba(0,0,0,0.5)',strokeWidth:3});
        this.drawText(ctx,`Level ${this.level}  ·  ${this.levelCfg?.name||''}`,W/2,py+72,{size:12,color:'#556677',align:'center',family:this.FONT_MONO});

        ctx.fillStyle='rgba(255,255,255,0.07)'; this.fillRect(ctx,px+16,py+82,pw-32,1);

        const isNewBest=this.score>=this.playerData.bestScore;
        const rows=[
            ['SCORE',this.score.toLocaleString(),isNewBest?'#FFD700':'#ffffff'],
            ['BEST', this.playerData.bestScore.toLocaleString(),isNewBest?'#FFD700':'#888888'],
            ['LEVEL REACHED',String(this.level),'#cc88ff'],
            ['BEST STREAK',`🔥 x${this.streakRecord}`,'#FFD700'],
            ['CLOSE CALLS',`⚡ ${this.closeCallCount}`,'#FF8C00'],
            ['KNIVES THROWN',String(this.knivesThrown),'#aabbcc'],
            ['COINS EARNED',`+${this.sessionCoins}`,'#FFD700'],
        ];
        rows.forEach((row,i)=>{
            const ry=py+102+i*24;
            this.drawText(ctx,row[0],px+20,ry,{size:9.5,weight:'bold',color:'#445566',family:this.FONT_TITLE});
            this.drawText(ctx,row[1],px+pw-20,ry,{size:i<=1?14:11,weight:'bold',color:row[2],align:'right',family:this.FONT_TITLE});
        });

        if(isNewBest&&this.score>0){
            const pulse=0.7+Math.sin(this.time/120)*0.3;
            this.drawText(ctx,'🏆 NEW HIGH SCORE!',W/2,py+82+rows.length*24+10,{size:13,weight:'bold',color:'#FFD700',align:'center',family:this.FONT_TITLE,glow:true,glowColor:'#FFD700',glowBlur:8,opacity:pulse});
        }

        ctx.fillStyle='rgba(255,255,255,0.07)'; this.fillRect(ctx,px+16,py+ph-60,pw-32,1);

        const blink=0.45+Math.sin(this.time/380)*0.45;
        this.drawText(ctx,'— Tap restart to play again —',W/2,py+ph-16,{size:11,color:'#8888aa',align:'center',opacity:blink,family:this.FONT_MONO});
    }

    /* ══════════════════════════════════════════════
       UI HELPERS
    ══════════════════════════════════════════════ */
    drawCardBG(ctx,x,y,w,h,borderColor){
        ctx.fillStyle='rgba(5,2,14,0.97)'; this.drawRoundRect(ctx,x,y,w,h,15); ctx.fill();
        ctx.strokeStyle=borderColor+'50'; ctx.lineWidth=this.dS(1.8); this.drawRoundRect(ctx,x,y,w,h,15); ctx.stroke();
        const tg=ctx.createLinearGradient(this.dX(x+20),0,this.dX(x+w-20),0);
        tg.addColorStop(0,'rgba(0,0,0,0)'); tg.addColorStop(0.5,borderColor+'38'); tg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=tg; ctx.fillRect(this.dX(x+20),this.dY(y+1),this.dSr(w-40),this.dSr(2));
    }

    drawBtn(ctx,cx,cy,w,h,text,c1,c2){
        const bx=cx-w/2,by=cy-h/2;
        const grd=ctx.createLinearGradient(this.dX(bx),0,this.dX(bx+w),0);
        grd.addColorStop(0,c1); grd.addColorStop(1,c2);
        ctx.fillStyle=grd; this.drawRoundRect(ctx,bx,by,w,h,h/2); ctx.fill();
        const sg=ctx.createLinearGradient(this.dX(bx),0,this.dX(bx+w),0);
        sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(0.5,'rgba(255,255,255,0.12)'); sg.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=sg; this.drawRoundRect(ctx,bx,by,w,h,h/2); ctx.fill();
        this.drawText(ctx,text,cx,cy+1,{size:14,weight:'bold',color:'#ffffff',align:'center',baseline:'middle',family:this.FONT_TITLE});
    }

    /* ══════════════════════════════════════════════
       GAME LOOP
    ══════════════════════════════════════════════ */
    loop(timestamp){
        if(this.destroyed) return;
        const dt=Math.min(timestamp-(this.lastTime||timestamp),50);
        this.lastTime=timestamp;
        if(!this.paused) this.update(dt);
        this.draw();
        this.animId=requestAnimationFrame(t=>this.loop(t));
    }

    togglePause(){ this.paused=!this.paused; this.isPaused=this.paused; return this.paused; }

    resize(){
        this.setupHDCanvas();
        this.W=this.canvas.width/this.dpr; this.H=this.canvas.height/this.dpr;
        this.isMobile=this.W<768||('ontouchstart' in window);
        this.isSmallScreen=this.W<380;
        this.target.x=this.W/2; this.target.y=this.H/2-60;
        this.target.radius=Math.min(this.W,this.H)*0.155;
        if(this.idleKnife){this.idleKnife.x=this.W/2;this.idleKnife.y=this.H-(this.isMobile?75:90);}
        this.stars=this.makeStars(this.isMobile?55:100);
        this.nebulae=this.makeNebulae();
        this.makeGridLines();
    }

    destroy(){
        this.destroyed=true;
        cancelAnimationFrame(this.animId);
        this.canvas.removeEventListener('click',this._onClick);
        this.canvas.removeEventListener('touchstart',this._onTouch);
        document.removeEventListener('keydown',this._onKey);
        if(this.fsBtn){
            this.fsBtn.removeEventListener('click',this._boundFsClick);
            document.removeEventListener('fullscreenchange',this._boundFsChange);
            document.removeEventListener('webkitfullscreenchange',this._boundFsChange);
            this.fsBtn.remove();
        }
        if(this.audioCtx){try{this.audioCtx.close();}catch(e){}}
        this.savePlayerData();
    }
}